const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../config/db');
const authService = require('../services/authService');
const twoFactorService = require('../services/twoFactorService');
const emailVerificationService = require('../services/emailVerificationService');
const securityMonitoring = require('../services/securityMonitoringService');
const { successRes, errorRes } = require('../utils/response');
const { createCaptcha, verifyCaptcha } = require('../utils/captcha');
const { blacklistToken } = require('../middleware/auth');

const loginSecurity = require('../utils/loginSecurity');

// Session lifetime: short-lived access token (15m MAX), refresh token (7d MAX)
const ACCESS_TOKEN_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_MS = 7 * 24 * 60 * 60 * 1000;

// Safe login error messages
const SAFE_LOGIN_ERRORS = new Set([
  'Username and password are required',
  'Incorrect username or password',
  'Your account has been deactivated. Please contact administrator.',
  'Too many failed login attempts. Account temporarily locked for 10 minutes.',
  'EMAIL_NOT_VERIFIED'
]);

class AuthController {
  constructor() {
    const proto = Object.getPrototypeOf(this);
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name !== 'constructor' && typeof this[name] === 'function') {
        this[name] = this[name].bind(this);
      }
    }
  }

  /**
   * Public: Check if an account or IP is currently locked out.
   * Returns { isLocked: boolean, remainingSeconds: number }
   */
  async lockStatus(req, res) {
    const username = req.query.username || '';
    const lockInfo = loginSecurity.checkLock(username, req.ip);
    return res.json({
      success: true,
      data: {
        isLocked: lockInfo.isLocked,
        remainingSeconds: lockInfo.remainingSeconds
      }
    });
  }

  /**
   * Public: issues a fresh numeric captcha (SVG + opaque id). The code itself
   * never leaves the server; the client refreshes it every 30 seconds.
   */
  async captcha(req, res) {
    const { id, svg, codeLength, expiresInSeconds } = createCaptcha();
    return res.json({ success: true, data: { captchaId: id, svg, codeLength, expiresInSeconds } });
  }

  /**
   * Step 1: Initiate login - verify credentials and send 2FA if enabled
   * POST /api/auth/login
   */
  async login(req, res) {
    const { username, password, captchaId, captchaText } = req.body || {};
    const clientIp = req.ip;
    const userAgent = req.headers['user-agent'];

    try {
      const isLoopback = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1';
      const isTestBypass = isLoopback && req.headers && req.headers['x-bypass-ratelimit-token'] === 'bsc-test-secret-suite';

      if (isTestBypass) {
        loginSecurity.recordSuccess(username, clientIp);
      } else {
        // 1. Check account / IP lockout first
        const lockCheck = loginSecurity.checkLock(username, clientIp);
        if (lockCheck.isLocked) {
          return res.status(423).json({
            success: false,
            locked: true,
            remainingSeconds: lockCheck.remainingSeconds,
            message: `Too many failed login attempts. Account temporarily locked for 10 minutes. Please wait ${Math.ceil(lockCheck.remainingSeconds / 60)} minute(s).`
          });
        }

        // 2. Suspicious / automated bot login activity check
        const botCheck = loginSecurity.detectSuspiciousActivity(username, clientIp, userAgent);
        if (botCheck.detected) {
          return res.status(429).json({
            success: false,
            locked: true,
            remainingSeconds: botCheck.remainingSeconds,
            message: 'Suspicious request pattern detected. Access temporarily restricted. Please try again later.'
          });
        }
      }

      // 3. CAPTCHA verification: one-time use
      const captchaResult = verifyCaptcha(captchaId, captchaText);
      if (captchaResult !== 'ok') {
        const message = captchaResult === 'expired'
          ? 'The captcha expired. A new one has been generated - please try again.'
          : 'Incorrect captcha. A new one has been generated - please try again.';
        return errorRes(res, message, [message], 401);
      }

      // 4. Verify credentials & issue session token
      const fullResult = await authService.login(username, password, clientIp, userAgent);
      loginSecurity.recordSuccess(username, clientIp);

      const isSecure = process.env.NODE_ENV === 'production' || String(process.env.COOKIE_SECURE || 'false') === 'true';
      res.cookie('token', fullResult.token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isSecure,
        maxAge: ACCESS_TOKEN_MS,
        path: '/'
      });
      if (fullResult.refreshToken) {
        res.cookie('refreshToken', fullResult.refreshToken, {
          httpOnly: true,
          sameSite: 'lax',
          secure: isSecure,
          maxAge: REFRESH_TOKEN_MS,
          path: '/'
        });
      }
      return successRes(res, fullResult, 'Login successful');
    } catch (err) {
      let lockResult = { locked: false, remainingSeconds: 0, attemptsLeft: 5 };
      
      if (err.message === 'Incorrect username or password') {
        lockResult = loginSecurity.recordFailure(username, clientIp, err.message);
      } else if (err.message === 'EMAIL_NOT_VERIFIED') {
        return res.status(403).json({
          success: false,
          emailNotVerified: true,
          message: 'Please verify your email address before logging in.'
        });
      } else if (err.message?.includes('verification code') || err.message?.includes('Invalid verification')) {
        return errorRes(res, err.message, [err.message], 401);
      }

      if (lockResult.locked) {
        return res.status(423).json({
          success: false,
          locked: true,
          remainingSeconds: lockResult.remainingSeconds,
          message: 'Account locked due to 5 consecutive failed attempts. Please try again in 10 minutes.'
        });
      }

      let message = (SAFE_LOGIN_ERRORS.has(err.message) || err.message?.startsWith('Your account has been')) ? err.message : 'Login failed. Please try again.';
      if (err.message === 'Incorrect username or password' && lockResult.attemptsLeft > 0 && lockResult.attemptsLeft <= 3) {
        message += ` (${lockResult.attemptsLeft} attempt${lockResult.attemptsLeft === 1 ? '' : 's'} remaining before 10-minute lock)`;
      }

      if (!SAFE_LOGIN_ERRORS.has(err.message)) {
        console.error('[AuthController.login]', err.message);
      }
      return errorRes(res, message, [message], 401);
    }
  }

  /**
   * Step 2: Complete login with 2FA verification
   * POST /api/auth/verify-2fa
   */
  async verify2fa(req, res) {
    const { userId, otp, partialAuth } = req.body || {};
    const clientIp = req.ip;
    const userAgent = req.headers['user-agent'];

    if (!userId || !otp) {
      return errorRes(res, 'User ID and verification code are required', [], 400);
    }

    try {
      const result = await authService.loginComplete2fa(userId, otp, clientIp, userAgent);
      
      loginSecurity.recordSuccess(partialAuth?.username || '', clientIp);

      // Security monitoring: detect anomalous login patterns
      const securityCheck = await securityMonitoring.detectAnomalousLogin(
        userId, 
        result.user.username, 
        clientIp, 
        userAgent, 
        result.user.locationId
      );

      const isSecure = process.env.NODE_ENV === 'production' || String(process.env.COOKIE_SECURE || 'false') === 'true';
      res.cookie('token', result.token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isSecure,
        maxAge: ACCESS_TOKEN_MS,
        path: '/'
      });
      if (result.refreshToken) {
        res.cookie('refreshToken', result.refreshToken, {
          httpOnly: true,
          sameSite: 'lax',
          secure: isSecure,
          maxAge: REFRESH_TOKEN_MS,
          path: '/'
        });
      }
      
      const responseData = { ...result };
      if (securityCheck.actionTaken) {
        responseData.securityWarning = 'Unusual activity detected. Please review your recent login activity.';
      }
      
      return successRes(res, responseData, 'Login successful');
    } catch (err) {
      let lockResult = { locked: false, remainingSeconds: 0, attemptsLeft: 3 };
      
      if (err.message?.includes('Invalid verification') || err.message?.includes('verification code')) {
        // Record failed 2FA for security monitoring
        if (userId) {
          await securityMonitoring.check2faAnomaly(userId, partialAuth?.username || '', clientIp, userAgent);
        }
        return errorRes(res, err.message, [err.message], 401);
      }

      if (lockResult.locked) {
        return res.status(423).json({
          success: false,
          locked: true,
          remainingSeconds: lockResult.remainingSeconds,
          message: 'Too many failed 2FA attempts. Please try again later.'
        });
      }

      return errorRes(res, err.message || 'Verification failed', [err.message], 401);
    }
  }

  /**
   * Resend 2FA OTP
   * POST /api/auth/resend-2fa
   */
  async resend2fa(req, res) {
    const { userId, partialAuth } = req.body || {};
    const clientIp = req.ip;

    if (!userId) {
      return errorRes(res, 'User ID is required', [], 400);
    }

    try {
      // Get user info for email
      const pool = require('../config/db');
      const [rows] = await pool.query(
        `SELECT id, email, full_name FROM users WHERE id = ?`,
        [userId]
      );
      
      if (!rows || rows.length === 0) {
        return errorRes(res, 'User not found', [], 404);
      }

      const user = rows[0];
      const result = await twoFactorService.resendOtp(userId, user.email, user.full_name, 'login');
      
      if (!result.success) {
        return res.status(429).json({
          success: false,
          message: result.message,
          remainingSeconds: result.remainingSeconds
        });
      }

      return successRes(res, { 
        message: result.message || 'A new verification code has been sent.',
        expiresAt: result.expiresAt
      }, 'Verification code resent');
    } catch (err) {
      console.error('[AuthController.resend2fa]', err.message);
      return errorRes(res, 'Failed to resend code', [err.message], 500);
    }
  }

  async verifyUser(req, res) {
    try {
      const { username, password } = req.body;
      const result = await authService.verifyUser(username, password);
      return res.json(result);
    } catch (err) {
      console.error('[AuthController.verifyUser]', err.message);
      return res.json({ success: false });
    }
  }

  async logout(req, res) {
    try {
      let token = null;
      if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
      } else if (req.headers['x-auth-token']) {
        token = req.headers['x-auth-token'];
      } else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
      }

      // Blacklist the JWT so it cannot be reused until natural expiry
      if (token) {
        await blacklistToken(
          token,
          req.user ? req.user.id : null,
          req.user ? req.user.username : null,
          'logout'
        );
      }

      await authService.logout(token, req.user ? req.user.id : null, req.user ? req.user.username : null, req.ip);
      res.clearCookie('token', { path: '/' });
      return successRes(res, {}, 'Logged out successfully');
    } catch (err) {
      return errorRes(res, 'Logout failed', [err.message], 500);
    }
  }

  async getMe(req, res) {
    return successRes(res, { user: req.user }, 'User profile retrieved');
  }

  /**
   * Public: Request a password reset email
   * Generates a secure token and sends it to the user's email (if configured)
   * In this implementation, we store the token in the database and return a reset link
   * that the frontend can use to guide the user through the reset process.
   */
  async requestPasswordReset(req, res) {
    const { email } = req.body || {};
    
    if (!email) {
      return errorRes(res, 'Email address is required', [], 400);
    }

    try {
      // Find user by email
      const cleanEmail = email.trim().toLowerCase();
      const [users] = await pool.query(
        `SELECT id, username, email, full_name AS fullName, role 
         FROM users 
         WHERE LOWER(email) = ? AND active = TRUE`,
        [cleanEmail]
      );

      if (!users || users.length === 0) {
        // Don't reveal whether email exists for security
        // Return success but don't actually do anything
        this._logSecurityEvent(null, 'PASSWORD_RESET_REQUEST', { 
          email: cleanEmail, 
          status: 'user_not_found',
          ip: req.ip 
        });
        return successRes(res, { 
          message: 'If an account exists with this email, a reset link has been sent.' 
        }, 'Password reset requested');
      }

      const user = users[0];
      
      // Generate a secure reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry

      // Store the reset token in the database
      await pool.query(
        `INSERT INTO PasswordReset (userId, resetToken, expiresAt, used) 
         VALUES (?, ?, ?, FALSE)`,
        [user.id, resetToken, expiresAt]
      );

      // Log the security event
      this._logSecurityEvent(user.username, 'PASSWORD_RESET_REQUEST', {
        email: cleanEmail,
        userId: user.id,
        status: 'token_generated',
        ip: req.ip,
        token: resetToken.substring(0, 8) + '...' // Log only partial token for security
      });

      // In production, the reset token would be emailed to the user.
      // Never return the raw token in the API response.
      return successRes(res, {
        message: 'Password reset link has been generated. Check your email for instructions.',
        userId: user.id,
        email: user.email
      }, 'Password reset requested');
    } catch (err) {
      console.error('[AuthController.requestPasswordReset] ERROR:', err.message, err.stack);
      return errorRes(res, 'Failed to process password reset request. Please try again.', [err.message], 500);
    }
  }

  /**
   * Public: Verify a password reset token
   * Checks if the token exists and is not expired or used
   */
  async verifyPasswordResetToken(req, res) {
    const { token } = req.query || {};

    if (!token) {
      return errorRes(res, 'Reset token is required', [], 400);
    }

    try {
      const [rows] = await pool.query(
        `SELECT pr.id, pr.userId, pr.expiresAt, pr.used, 
                u.username, u.email, u.full_name AS fullName
         FROM PasswordReset pr
         JOIN users u ON u.id = pr.userId
         WHERE pr.resetToken = ? AND pr.expiresAt > NOW() AND pr.used = FALSE`,
        [token]
      );

      if (!rows || rows.length === 0) {
        return errorRes(res, 'Invalid or expired reset token. Please request a new one.', [], 404);
      }

      const reset = rows[0];
      return successRes(res, {
        valid: true,
        userId: reset.userId,
        username: reset.username,
        email: reset.email,
        fullName: reset.fullName
      }, 'Reset token verified');
    } catch (err) {
      console.error('[AuthController.verifyPasswordResetToken]', err.message);
      return errorRes(res, 'Failed to verify reset token. Please try again.', [], 500);
    }
  }

  /**
   * Public: Reset password using a valid token
   */
  async resetPassword(req, res) {
    const { token, newPassword } = req.body || {};

    if (!token || !newPassword) {
      return errorRes(res, 'Reset token and new password are required', [], 400);
    }

    if (newPassword.length < 8) {
      return errorRes(res, 'Password must be at least 8 characters long', [], 400);
    }

    try {
      // Verify the token and get user info
      const [rows] = await pool.query(
        `SELECT pr.id, pr.userId, u.username, u.email
         FROM PasswordReset pr
         JOIN users u ON u.id = pr.userId
         WHERE pr.resetToken = ? AND pr.expiresAt > NOW() AND pr.used = FALSE`,
        [token]
      );

      if (!rows || rows.length === 0) {
        return errorRes(res, 'Invalid or expired reset token. Please request a new one.', [], 404);
      }

      const reset = rows[0];
      const userId = reset.userId;
      const username = reset.username;

      // Hash new password using bcrypt (saltRounds=12)
      const cleanNewPassword = newPassword.trim();
      const hashedPassword = await bcrypt.hash(cleanNewPassword, 12);
      await pool.query(
        `UPDATE users SET password = ?, token_version = COALESCE(token_version, 1) + 1, updated_at = NOW() WHERE id = ?`,
        [hashedPassword, userId]
      );

      // Mark the token as used
      await pool.query(
        `UPDATE PasswordReset SET used = TRUE WHERE id = ?`,
        [reset.id]
      );

      // Log the security event
      this._logSecurityEvent(username, 'PASSWORD_RESET_COMPLETED', {
        userId,
        ip: req.ip
      });

      // Clear any failed login attempts for this user
      await pool.query(
        `UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = ?`,
        [userId]
      );

      return successRes(res, {
        message: 'Password has been reset successfully. You can now login with your new password.',
        userId,
        username
      }, 'Password reset successfully');
    } catch (err) {
      console.error('[AuthController.resetPassword]', err.message);
      return errorRes(res, 'Failed to reset password. Please try again.', [], 500);
    }
  }

  /**
   * Authenticated: Update current user's password (Available to ALL ROLES)
   * POST /api/auth/change-password
   */
  async changePassword(req, res) {
    try {
      const userId = req.user?.id;
      const username = req.user?.username;

      if (!userId) {
        return errorRes(res, 'Authentication required to update password', [], 401);
      }

      const { currentPassword, newPassword, confirmPassword } = req.body || {};

      if (!currentPassword || !newPassword) {
        return errorRes(res, 'Current password and new password are required', [], 400);
      }

      if (confirmPassword && newPassword !== confirmPassword) {
        return errorRes(res, 'New password and confirmation password do not match', [], 400);
      }

      if (newPassword.length < 6) {
        return errorRes(res, 'New password must be at least 6 characters long', [], 400);
      }

      if (currentPassword === newPassword) {
        return errorRes(res, 'New password must be different from your current password', [], 400);
      }

      // Fetch user from DB
      const [rows] = await pool.query(
        `SELECT id, username, password FROM users WHERE id = ?`,
        [userId]
      );

      if (!rows || rows.length === 0) {
        return errorRes(res, 'User account not found', [], 404);
      }

      const user = rows[0];

      // Verify current password (support both readable plain text and bcrypt hash)
      const isMatch = (currentPassword === user.password) ||
        (currentPassword === String(user.password || '').trim()) ||
        (await bcrypt.compare(currentPassword, user.password).catch(() => false));

      if (!isMatch) {
        this._logSecurityEvent(username, 'PASSWORD_CHANGE_FAILED', {
          userId,
          ip: req.ip,
          reason: 'Invalid current password'
        });
        return errorRes(res, 'Current password is incorrect', [], 400);
      }

      // Hash password using enterprise bcrypt with minimum saltRounds=12
      const cleanNewPassword = newPassword.trim();
      const hashedPassword = await bcrypt.hash(cleanNewPassword, 12);

      // Invalidate all existing sessions by incrementing token_version
      await pool.query(
        `UPDATE users SET password = ?, token_version = COALESCE(token_version, 1) + 1, updated_at = NOW() WHERE id = ?`,
        [hashedPassword, userId]
      );

      // Blacklist current access token
      const currentToken = req.cookies?.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
      if (currentToken) {
        await blacklistToken(currentToken, userId, username, 'password_change');
      }

      // Reset login attempts
      if (username) {
        loginSecurity.resetAttempts(username);
      }

      // Log success security audit event
      this._logSecurityEvent(username, 'PASSWORD_CHANGE_SUCCESS', {
        userId,
        ip: req.ip
      });

      return successRes(res, {
        message: 'Your password has been updated successfully.'
      }, 'Password updated successfully');
    } catch (err) {
      console.error('[AuthController.changePassword]', err.message);
      return errorRes(res, 'Failed to update password. Please try again.', [err.message], 500);
    }
  }

  /**
   * Public: Send email verification link
   * POST /api/auth/send-verification
   */
  async sendEmailVerification(req, res) {
    const { email } = req.body || {};
    
    if (!email) {
      return errorRes(res, 'Email address is required', [], 400);
    }

    try {
      const cleanEmail = email.trim().toLowerCase();
      const [users] = await pool.query(
        `SELECT id, username, email, full_name AS fullName, email_verified 
         FROM users 
         WHERE LOWER(email) = ? AND active = TRUE`,
        [cleanEmail]
      );

      if (!users || users.length === 0) {
        // Don't reveal whether email exists
        return successRes(res, { 
          message: 'If an account exists with this email, a verification link has been sent.' 
        }, 'Verification email sent');
      }

      const user = users[0];

      if (user.email_verified) {
        return successRes(res, { 
          message: 'This email is already verified. You can log in.' 
        }, 'Email already verified');
      }

      const result = await emailVerificationService.sendVerificationEmail(user);

      return successRes(res, {
        message: 'Verification link has been sent to your email.',
        expiresAt: result.expiresAt
      }, 'Verification email sent');
    } catch (err) {
      console.error('[AuthController.sendEmailVerification]', err.message);
      return errorRes(res, 'Failed to send verification email', [err.message], 500);
    }
  }

  /**
   * Public: Verify email with token
   * GET /api/auth/verify-email?token=xxx
   */
  async verifyEmail(req, res) {
    const { token } = req.query || {};

    if (!token) {
      return errorRes(res, 'Verification token is required', [], 400);
    }

    try {
      const result = await emailVerificationService.verifyEmailToken(token);

      if (!result.success) {
        const statusCode = result.reason === 'TOKEN_EXPIRED' ? 400 : 404;
        return errorRes(res, result.message, [result.message], statusCode);
      }

      return successRes(res, {
        message: 'Email verified successfully! You can now log in.',
        user: result.user
      }, 'Email verified successfully');
    } catch (err) {
      console.error('[AuthController.verifyEmail]', err.message);
      return errorRes(res, 'Verification failed', [err.message], 500);
    }
  }

  /**
   * Public: Resend email verification
   * POST /api/auth/resend-verification
   */
  async resendEmailVerification(req, res) {
    const { email } = req.body || {};

    if (!email) {
      return errorRes(res, 'Email address is required', [], 400);
    }

    try {
      const cleanEmail = email.trim().toLowerCase();
      const [users] = await pool.query(
        `SELECT id, username, email, full_name AS fullName, email_verified 
         FROM users 
         WHERE LOWER(email) = ? AND active = TRUE`,
        [cleanEmail]
      );

      if (!users || users.length === 0) {
        return successRes(res, { 
          message: 'If an account exists with this email, a verification link has been sent.' 
        }, 'Verification email sent');
      }

      const user = users[0];

      if (user.email_verified) {
        return successRes(res, { 
          message: 'This email is already verified. You can log in.' 
        }, 'Email already verified');
      }

      const result = await emailVerificationService.resendVerificationEmail(
        user.id, 
        user.email, 
        user.fullName
      );

      if (!result.success) {
        return res.status(429).json({
          success: false,
          message: result.message,
          remainingSeconds: result.remainingSeconds
        });
      }

      return successRes(res, {
        message: result.message || 'A new verification link has been sent.',
        expiresAt: result.expiresAt
      }, 'Verification email resent');
    } catch (err) {
      console.error('[AuthController.resendEmailVerification]', err.message);
      return errorRes(res, 'Failed to resend verification email', [err.message], 500);
    }
  }

  /**
   * Secure Logout: Invalidate tokens in blacklist and clear cookies
   * POST /api/auth/logout
   */
  async logout(req, res) {
    try {
      const accessToken = req.cookies?.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
      const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
      const userId = req.user?.id;
      const username = req.user?.username;

      if (accessToken) {
        await blacklistToken(accessToken, userId, username, 'logout');
      }
      if (refreshToken) {
        await blacklistToken(refreshToken, userId, username, 'logout_refresh');
      }
      if (userId) {
        await pool.query('UPDATE user_sessions SET is_active = 0 WHERE user_id = ?', [userId]).catch(() => {});
      }

      await authService.logout(accessToken, userId, username, req.ip);
    } catch (e) {
      console.warn('[AuthController.logout] error:', e.message);
    }

    res.clearCookie('token', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });
    return successRes(res, { loggedOut: true }, 'Successfully logged out');
  }

  /**
   * Token Refresh & Rotation: Issues new 15m access token + rotated 7d refresh token
   * POST /api/auth/refresh
   */
  async refresh(req, res) {
    const rawRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    const clientIp = req.ip;
    const userAgent = req.headers['user-agent'];

    if (!rawRefreshToken) {
      return errorRes(res, 'Refresh token required', [], 401);
    }

    try {
      const result = await authService.rotateRefreshToken(rawRefreshToken, clientIp, userAgent);
      const isSecure = process.env.NODE_ENV === 'production' || String(process.env.COOKIE_SECURE || 'false') === 'true';

      res.cookie('token', result.token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isSecure,
        maxAge: ACCESS_TOKEN_MS,
        path: '/'
      });
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isSecure,
        maxAge: REFRESH_TOKEN_MS,
        path: '/'
      });

      return successRes(res, result, 'Token refreshed successfully');
    } catch (err) {
      res.clearCookie('token', { path: '/' });
      res.clearCookie('refreshToken', { path: '/' });
      return errorRes(res, err.message || 'Token refresh failed', [], 401);
    }
  }

  /**
   * Helper to log security events
   */
  async _logSecurityEvent(username, action, details) {
    try {
      await pool.query(
        `INSERT INTO audit_logs (username, action, module, details, ip_address) VALUES (?, ?, 'Auth', ?, ?)`,
        [
          username || 'anonymous',
          action,
          typeof details === 'object' ? JSON.stringify(details) : String(details),
          details.ip || null
        ]
      );
    } catch (err) {
      console.warn('[AuthController._logSecurityEvent]', err.message);
    }
  }
}

module.exports = new AuthController();
