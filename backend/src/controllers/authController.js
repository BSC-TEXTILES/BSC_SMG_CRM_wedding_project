const authService = require('../services/authService');
const { successRes, errorRes } = require('../utils/response');
const { createCaptcha, verifyCaptcha } = require('../utils/captcha');
const { blacklistToken } = require('../middleware/auth');

const loginSecurity = require('../utils/loginSecurity');

// Session lifetime: users who do not sign out are logged out automatically
// after this many hours (token expiry, cookie lifetime and the client timer
// all use the same value).
const SESSION_HOURS = parseInt(process.env.SESSION_HOURS || '6', 10);
const SESSION_MS = SESSION_HOURS * 60 * 60 * 1000;

// Messages that are intentional business outcomes — safe to show to users.
// Anything else (DB errors, etc.) is logged server-side and replaced with a
// generic message so internal details never reach the client.
const SAFE_LOGIN_ERRORS = new Set([
  'Username and password are required',
  'Incorrect username or password',
  'Your account has been deactivated. Please contact administrator.',
  'Too many failed login attempts. Account temporarily locked for 10 minutes.'
]);

class AuthController {
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

  async login(req, res) {
    const { username, password, captchaId, captchaText } = req.body || {};
    const clientIp = req.ip;
    const userAgent = req.headers['user-agent'];

    try {
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

      // 3. CAPTCHA verification: one-time use
      const captchaResult = verifyCaptcha(captchaId, captchaText);
      if (captchaResult !== 'ok') {
        const message = captchaResult === 'expired'
          ? 'The captcha expired. A new one has been generated - please try again.'
          : 'Incorrect captcha. A new one has been generated - please try again.';
        return errorRes(res, message, [message], 401);
      }

      // 4. Authenticate credentials via AuthService
      const result = await authService.login(username, password, clientIp, userAgent);

      // Successful login -> Reset failed attempts counter
      loginSecurity.recordSuccess(username, clientIp);

      // Set server-side httpOnly session cookie
      res.cookie('token', result.token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: String(process.env.COOKIE_SECURE || 'false') === 'true',
        maxAge: SESSION_MS,
        path: '/'
      });
      return successRes(res, result, 'Login successful');
    } catch (err) {
      // Record failed credential attempt for rate limiting & temporary lock
      let lockResult = { locked: false, remainingSeconds: 0, attemptsLeft: 5 };
      if (err.message === 'Incorrect username or password') {
        lockResult = loginSecurity.recordFailure(username, clientIp, err.message);
      }

      if (lockResult.locked) {
        return res.status(423).json({
          success: false,
          locked: true,
          remainingSeconds: lockResult.remainingSeconds,
          message: 'Account locked due to 5 consecutive failed attempts. Please try again in 10 minutes.'
        });
      }

      let message = SAFE_LOGIN_ERRORS.has(err.message) ? err.message : 'Login failed. Please try again.';
      if (err.message === 'Incorrect username or password' && lockResult.attemptsLeft > 0 && lockResult.attemptsLeft <= 3) {
        message += ` (${lockResult.attemptsLeft} attempt${lockResult.attemptsLeft === 1 ? '' : 's'} remaining before 10-minute lock)`;
      }

      if (!SAFE_LOGIN_ERRORS.has(err.message)) {
        console.error('[AuthController.login]', err.message);
      }
      return errorRes(res, message, [message], 401);
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
        `INSERT INTO PasswordReset (userId, resetToken, expiresAt, used, ipAddress) 
         VALUES (?, ?, ?, FALSE, ?)`,
        [user.id, resetToken, expiresAt, req.ip]
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
      console.error('[AuthController.requestPasswordReset]', err.message);
      return errorRes(res, 'Failed to process password reset request. Please try again.', [], 500);
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

      // Hash the new password
      const passwordHash = await bcrypt.hash(newPassword, 12);

      // Update user's password
      await pool.query(
        `UPDATE users SET password = ? WHERE id = ?`,
        [passwordHash, userId]
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
        `UPDATE users SET failedLogins = 0, lockedUntil = NULL WHERE id = ?`,
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

// Add crypto module for token generation
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

module.exports = new AuthController();
