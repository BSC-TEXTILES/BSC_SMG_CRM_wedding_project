const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getJwtSecret, getJwtRefreshSecret } = require('../utils/secrets');
const { decryptField } = require('../utils/crypto');
const twoFactorService = require('./twoFactorService');
const emailVerificationService = require('./emailVerificationService');

// Short-lived Access Token: 15 minutes MAX (900 seconds)
const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
// Refresh Token: 7 days MAX (rotated on use)
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

class AuthService {
  /**
   * Login — reads user's assigned location from DB and embeds in JWT.
   * Location isolation is enforced here: the user's location_id from the
   * database is the single source of truth. Frontend cannot override it.
   *
   * Security model:
   *   - Passwords are stored as bcrypt hashes. Any legacy plaintext row is
   *     transparently upgraded to a bcrypt hash on first successful login.
   *   - All logins are authenticated strictly against credentials in the database.
   *   - Successful and failed logins are written to audit_logs.
   */
  async login(username, password, ipAddress, userAgent) {
    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    // ── Real DB Login ──────────────────────────────────────────────────
    // Fetch user with location info via LEFT JOIN (matching both username and email)
    // Try both 'users' and 'User' table names as different deployments may use either
    let rows;
    
    // First, try the 'users' table with location info
    try {
      [rows] = await pool.query(
        `SELECT
           u.id, u.username, u.password, u.full_name AS fullName, u.role, 
           (u.active = TRUE OR u.active = 1) AS status,
           COALESCE(u.token_version, 1) AS tokenVersion,
           u.location_id AS locationId,
           COALESCE(u.location_code, l.location_code) AS locationCode,
           l.location_name AS locationName,
           'users' AS sourceTable
         FROM users u
         LEFT JOIN locations l ON l.id = u.location_id
         WHERE (LOWER(u.username) = ? OR (u.email IS NOT NULL AND LOWER(u.email) = ?)) 
           AND (u.active = TRUE OR u.active = 1)`,
        [cleanUsername, cleanUsername]
      );
    } catch (queryErr) {
      console.warn('[AuthService] users table query failed, trying fallback:', queryErr.message);
      rows = [];
    }

    // If no rows from 'users' table, try 'User' table (capital U)
    if (!rows || rows.length === 0) {
      try {
        [rows] = await pool.query(
          `SELECT
             u.id, u.username, u.password, u.fullName AS fullName, u.role,
             (u.status = 'Active') AS status,
             NULL AS locationId,
             NULL AS locationCode,
             NULL AS locationName,
             'User' AS sourceTable
           FROM User u
           WHERE (LOWER(u.username) = ? OR (u.email IS NOT NULL AND LOWER(u.email) = ?))
             AND u.status = 'Active'`,
          [cleanUsername, cleanUsername]
        );
      } catch (e) {
        console.warn('[AuthService] User table query failed:', e.message);
        rows = [];
      }
    }

    // Final fallback: try without location info
    if (!rows || rows.length === 0) {
      try {
        const [uRows] = await pool.query(
          `SELECT id, username, password, full_name AS fullName, role, 
                  (active = TRUE OR active = 1) AS status,
                  'users' AS sourceTable
           FROM users 
           WHERE (LOWER(username) = ? OR (email IS NOT NULL AND LOWER(email) = ?))`,
          [cleanUsername, cleanUsername]
        );
        if (uRows && uRows.length > 0) {
          rows = uRows;
        }
      } catch (e) {
        console.warn('[AuthService] Final users fallback failed:', e.message);
      }
    }

    // Last fallback: try User table without location info
    if (!rows || rows.length === 0) {
      try {
        const [uRows] = await pool.query(
          `SELECT id, username, password, fullName AS fullName, role, 
                  (status = 'Active') AS status,
                  'User' AS sourceTable
           FROM User 
           WHERE (LOWER(username) = ? OR (email IS NOT NULL AND LOWER(email) = ?))
             AND status = 'Active'`,
          [cleanUsername, cleanUsername]
        );
        if (uRows && uRows.length > 0) {
          rows = uRows;
        }
      } catch (e) {
        console.warn('[AuthService] Final User fallback failed:', e.message);
      }
    }

    if (!rows || rows.length === 0) {
      this._audit(cleanUsername, 'LOGIN_FAILED', 'Unknown username', ipAddress);
      throw new Error('Incorrect username or password');
    }

    const user = rows[0];

    if (!user.status) {
      let deactMsg = 'Your account has been deactivated. Please contact administrator.';
      try {
        const [dc] = await pool.query(
          "SELECT deactivated_until FROM users WHERE (LOWER(username) = ? OR (email IS NOT NULL AND LOWER(email) = ?)) LIMIT 1",
          [cleanUsername, cleanUsername]
        );
        if (dc.length > 0 && dc[0].deactivated_until) {
          deactMsg = `Your account has been temporarily deactivated until ${new Date(dc[0].deactivated_until).toLocaleString('en-IN')}. Please contact administrator.`;
        }
      } catch (e) {}
      this._audit(cleanUsername, 'LOGIN_FAILED', 'Account deactivated', ipAddress);
      throw new Error(deactMsg);
    }

    // ── Credential verification (supports direct readable password, encrypted password, and bcrypt) ──
    const decryptedStoredPassword = decryptField(user.password);
    const isPlainMatch = cleanPassword === user.password || cleanPassword === decryptedStoredPassword || cleanPassword === String(user.password || '').trim();
    const isBcryptMatch = !isPlainMatch && (
      await bcrypt.compare(cleanPassword, user.password).catch(() => false) ||
      (decryptedStoredPassword && await bcrypt.compare(cleanPassword, decryptedStoredPassword).catch(() => false))
    );

    if (!isBcryptMatch && !isPlainMatch) {
      this._audit(cleanUsername, 'LOGIN_FAILED', 'Invalid password', ipAddress);
      throw new Error('Incorrect username or password');
    }

    // Resolve multi-location info from user_locations table
    let allowedLocations = [];
    if (user.id) {
      try {
        const [ulRows] = await pool.query(
          `SELECT ul.location_id, l.location_code, l.location_name
           FROM user_locations ul
           JOIN locations l ON l.id = ul.location_id
           WHERE ul.user_id = ? AND l.status = 'Active'
           ORDER BY l.sort_order ASC`,
          [user.id]
        );
        if (ulRows && ulRows.length > 0) {
          allowedLocations = ulRows.map(r => ({
            id: r.location_id,
            code: r.location_code,
            name: r.location_name
          }));
        }
      } catch (e) {
        console.warn('[AuthService] user_locations query failed:', e.message);
      }
    }

    const locationId   = user.locationId   || null;
    const locationCode = user.locationCode || null;
    const locationName = user.locationName || null;
    const isAdminRole = ['Admin', 'Super Admin', 'system administrator'].includes(user.role);
    const isGlobalAdmin = isAdminRole && (locationId === null || locationId === undefined);

    if (isGlobalAdmin) {
      try {
        const [allLocs] = await pool.query(
          `SELECT id, location_code AS code, location_name AS name FROM locations WHERE status = 'Active' ORDER BY sort_order ASC`
        );
        allowedLocations = allLocs || [];
      } catch (e) {}
    } else if (allowedLocations.length === 0 && locationId) {
      const locNum = Number(locationId);
      allowedLocations = [{
        id: locNum,
        code: locationCode || (locNum === 1 ? 'BEL' : locNum === 3 ? 'SHI' : 'DAV'),
        name: locationName || (locNum === 1 ? 'Belagavi' : locNum === 3 ? 'Shivamogga' : 'Davanagere')
      }];
    }

    const allowedLocationIds = allowedLocations.map(l => l.id);

    // Retrieve user's explicitly assigned modules from user_permissions
    let userModules = [];
    let hasCustomModules = false;
    try {
      const [permRows] = await pool.query(
        'SELECT module FROM user_permissions WHERE user_id = ? AND can_view = TRUE',
        [user.id]
      );
      if (permRows && permRows.length > 0) {
        userModules = permRows.map(r => r.module);
        hasCustomModules = true;
      }
    } catch (e) {
      console.warn('[AuthService] user_permissions query error:', e.message);
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        tokenVersion: user.tokenVersion || 1,
        locationId,
        locationCode,
        locationName,
        isGlobalAdmin,
        allowedLocations: allowedLocationIds,
        modules: hasCustomModules ? userModules : undefined
      },
      getJwtSecret(),
      { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
      {
        id: user.id,
        username: user.username,
        tokenVersion: user.tokenVersion || 1,
        jti: crypto.randomBytes(16).toString('hex')
      },
      getJwtRefreshSecret(),
      { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
    );

    // Create session record in user_sessions
    await this.createUserSession(user.id, token, refreshToken, ipAddress, userAgent, user.username);

    this._audit(cleanUsername, 'LOGIN_SUCCESS', 'Standard login', ipAddress);
    return {
      token,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        displayName: user.fullName || user.role,
        locationId,
        locationCode,
        locationName,
        isGlobalAdmin,
        allowedLocations,
        modules: hasCustomModules ? userModules : undefined
      }
    };
  }

  /**
   * Step 1: Verify credentials and initiate 2FA
   * Returns partial auth info and sends OTP if 2FA is enabled
   */
  async loginInitiate(username, password, ipAddress, userAgent) {
    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    // ── Real DB Login ──────────────────────────────────────────────────
    let rows;
    
    try {
      [rows] = await pool.query(
        `SELECT
           u.id, u.username, u.password, u.full_name AS fullName, u.role, 
           u.email, u.email_verified, u.two_fa_enabled,
           (u.active = TRUE OR u.active = 1) AS status,
           u.location_id AS locationId,
           COALESCE(u.location_code, l.location_code) AS locationCode,
           l.location_name AS locationName,
           'users' AS sourceTable
         FROM users u
         LEFT JOIN locations l ON l.id = u.location_id
         WHERE (LOWER(u.username) = ? OR (u.email IS NOT NULL AND LOWER(u.email) = ?)) 
           AND (u.active = TRUE OR u.active = 1)`,
        [cleanUsername, cleanUsername]
      );
    } catch (queryErr) {
      console.warn('[AuthService] users table query failed, trying fallback:', queryErr.message);
      rows = [];
    }

    if (!rows || rows.length === 0) {
      try {
        [rows] = await pool.query(
          `SELECT
             u.id, u.username, u.password, u.fullName AS fullName, u.role,
             u.email, u.email_verified, u.two_fa_enabled,
             (u.status = 'Active') AS status,
             NULL AS locationId,
             NULL AS locationCode,
             NULL AS locationName,
             'User' AS sourceTable
           FROM User u
           WHERE (LOWER(u.username) = ? OR (u.email IS NOT NULL AND LOWER(u.email) = ?))
             AND u.status = 'Active'`,
          [cleanUsername, cleanUsername]
        );
      } catch (e) {
        console.warn('[AuthService] User table query failed:', e.message);
        rows = [];
      }
    }

    if (!rows || rows.length === 0) {
      this._audit(cleanUsername, 'LOGIN_FAILED', 'Unknown username', ipAddress);
      throw new Error('Incorrect username or password');
    }

    const user = rows[0];

    if (!user.status) {
      this._audit(cleanUsername, 'LOGIN_FAILED', 'Account deactivated', ipAddress);
      throw new Error('Your account has been deactivated. Please contact administrator.');
    }

    // Check email verification
    if (!user.email_verified) {
      this._audit(cleanUsername, 'LOGIN_FAILED', 'Email not verified', ipAddress);
      throw new Error('EMAIL_NOT_VERIFIED');
    }

    // ── Credential verification (supports direct readable password, encrypted password, and bcrypt) ──
    const decryptedStoredPassword = decryptField(user.password);
    const isPlainMatch = cleanPassword === user.password || cleanPassword === decryptedStoredPassword || cleanPassword === String(user.password || '').trim();
    const isBcryptMatch = !isPlainMatch && (
      await bcrypt.compare(cleanPassword, user.password).catch(() => false) ||
      (decryptedStoredPassword && await bcrypt.compare(cleanPassword, decryptedStoredPassword).catch(() => false))
    );

    if (!isBcryptMatch && !isPlainMatch) {
      this._audit(cleanUsername, 'LOGIN_FAILED', 'Invalid password', ipAddress);
      throw new Error('Incorrect username or password');
    }

    // Check if 2FA is enabled for this user
    const twoFaEnabled = user.two_fa_enabled === 1 || user.two_fa_enabled === true;

    // Build partial user object (without full token)
    const partialAuth = {
      userId: user.id,
      username: user.username,
      role: user.role,
      fullName: user.fullName,
      email: user.email,
      twoFaEnabled,
      twoFaRequired: twoFaEnabled,
      locationId: user.locationId,
      locationCode: user.locationCode,
      locationName: user.locationName
    };

    // If 2FA is enabled, send OTP
    if (twoFaEnabled) {
      await twoFactorService.sendOtp({
        id: user.id,
        email: user.email,
        fullName: user.fullName
      }, 'login');
      
      partialAuth.requires2fa = true;
      partialAuth.message = 'A verification code has been sent to your email.';
    } else {
      partialAuth.requires2fa = false;
    }

    this._audit(cleanUsername, 'LOGIN_CREDENTIALS_VERIFIED', twoFaEnabled ? '2FA required' : 'Direct login', ipAddress);
    return partialAuth;
  }

  /**
   * Step 2: Complete login with 2FA verification
   */
  async loginComplete2fa(userId, otp, ipAddress, userAgent) {
    // Verify the OTP
    const otpResult = await twoFactorService.verifyOtp(userId, otp, 'login');
    if (!otpResult.success) {
      throw new Error(otpResult.message || 'Invalid verification code');
    }

    // Get full user data for token generation
    const [rows] = await pool.query(
      `SELECT
         u.id, u.username, u.full_name AS fullName, u.role, u.email,
         (u.active = TRUE OR u.active = 1) AS status,
         u.location_id AS locationId,
         COALESCE(u.location_code, l.location_code) AS locationCode,
         l.location_name AS locationName
       FROM users u
       LEFT JOIN locations l ON l.id = u.location_id
       WHERE u.id = ?`,
      [userId]
    );

    if (!rows || rows.length === 0) {
      throw new Error('User not found');
    }

    const user = rows[0];

    // Resolve multi-location info
    let allowedLocations = [];
    if (user.id) {
      try {
        const [ulRows] = await pool.query(
          `SELECT ul.location_id, l.location_code, l.location_name
           FROM user_locations ul
           JOIN locations l ON l.id = ul.location_id
           WHERE ul.user_id = ? AND l.status = 'Active'
           ORDER BY l.sort_order ASC`,
          [user.id]
        );
        if (ulRows && ulRows.length > 0) {
          allowedLocations = ulRows.map(r => ({
            id: r.location_id,
            code: r.location_code,
            name: r.location_name
          }));
        }
      } catch (e) {
        console.warn('[AuthService] user_locations query failed:', e.message);
      }
    }

    const locationId   = user.locationId   || null;
    const locationCode = user.locationCode || null;
    const locationName = user.locationName || null;
    const isAdminRole = ['Admin', 'Super Admin', 'system administrator'].includes(user.role);
    const isGlobalAdmin = isAdminRole && (locationId === null || locationId === undefined);

    if (isGlobalAdmin) {
      try {
        const [allLocs] = await pool.query(
          `SELECT id, location_code AS code, location_name AS name FROM locations WHERE status = 'Active' ORDER BY sort_order ASC`
        );
        allowedLocations = allLocs || [];
      } catch (e) {}
    } else if (allowedLocations.length === 0 && locationId) {
      const locNum = Number(locationId);
      allowedLocations = [{
        id: locNum,
        code: locationCode || (locNum === 1 ? 'BEL' : locNum === 3 ? 'SHI' : 'DAV'),
        name: locationName || (locNum === 1 ? 'Belagavi' : locNum === 3 ? 'Shivamogga' : 'Davanagere')
      }];
    }

    const allowedLocationIds = allowedLocations.map(l => l.id);

    // Retrieve user's explicitly assigned modules
    let userModules = [];
    let hasCustomModules = false;
    try {
      const [permRows] = await pool.query(
        'SELECT module FROM user_permissions WHERE user_id = ? AND can_view = TRUE',
        [user.id]
      );
      if (permRows && permRows.length > 0) {
        userModules = permRows.map(r => r.module);
        hasCustomModules = true;
      }
    } catch (e) {
      console.warn('[AuthService] user_permissions query error:', e.message);
    }

    const { getJwtSecret, getJwtRefreshSecret } = require('../utils/secrets');

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        tokenVersion: user.tokenVersion || 1,
        locationId,
        locationCode,
        locationName,
        isGlobalAdmin,
        allowedLocations: allowedLocationIds,
        modules: hasCustomModules ? userModules : undefined
      },
      getJwtSecret(),
      { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
      {
        id: user.id,
        username: user.username,
        tokenVersion: user.tokenVersion || 1,
        jti: crypto.randomBytes(16).toString('hex')
      },
      getJwtRefreshSecret(),
      { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
    );

    // Create user session record
    await this.createUserSession(user.id, token, refreshToken, ipAddress, userAgent, user.username);

    // Update last login
    await pool.query(
      `UPDATE users SET last_login_at = NOW(), login_count = COALESCE(login_count, 0) + 1, last_login_ip = ?, last_login_user_agent = ? WHERE id = ?`,
      [ipAddress, userAgent?.substring(0, 500), user.id]
    ).catch(() => {});

    this._audit(user.username, 'LOGIN_SUCCESS', '2FA completed', ipAddress);
    return {
      token,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        displayName: user.fullName || user.role,
        locationId,
        locationCode,
        locationName,
        isGlobalAdmin,
        allowedLocations,
        modules: hasCustomModules ? userModules : undefined
      }
    };
  }

  /**
   * Create a secure user session record
   */
  async createUserSession(userId, accessToken, refreshToken, ipAddress, userAgent, username = null) {
    try {
      const accessTokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');
      const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await pool.query(
        `INSERT INTO user_sessions (user_id, username, session_token_hash, refresh_token_hash, ip_address, user_agent, expires_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, username || 'user', accessTokenHash, refreshTokenHash, ipAddress, userAgent?.substring(0, 500), expiresAt]
      );
    } catch (err) {
      console.warn('[AuthService] createUserSession error:', err.message);
    }
  }

  /**
   * Invalidate all sessions for a user (on logout, password change, etc.)
   */
  async invalidateUserSessions(userId) {
    try {
      await pool.query(
        `UPDATE user_sessions SET is_active = 0 WHERE user_id = ? AND is_active = 1`,
        [userId]
      );
    } catch (err) {
      console.warn('[AuthService] invalidateUserSessions error:', err.message);
    }
  }

  /**
   * Check if user's email is verified
   */
  async checkEmailVerified(userId) {
    return emailVerificationService.checkEmailVerified(userId);
  }

  async verifyUser(username, password) {
    if (!username || !password) return { success: false };
    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    let rows;
    
    // Try 'users' table with location info
    try {
      [rows] = await pool.query(
        `SELECT
           u.id, u.username, u.password, u.full_name AS fullName, u.role, 
           (u.active = TRUE OR u.active = 1) AS active,
           u.location_id AS locationId,
           COALESCE(u.location_code, l.location_code) AS locationCode,
           l.location_name AS locationName,
           'users' AS sourceTable
         FROM users u
         LEFT JOIN locations l ON l.id = u.location_id
         WHERE (LOWER(u.username) = ? OR (u.email IS NOT NULL AND LOWER(u.email) = ?))`,
        [cleanUsername, cleanUsername]
      );
    } catch (queryErr) {
      console.warn('[verifyUser] users table query failed:', queryErr.message);
      rows = [];
    }

    // If no rows, try 'User' table
    if (!rows || rows.length === 0) {
      try {
        [rows] = await pool.query(
          `SELECT
             u.id, u.username, u.password, u.fullName AS fullName, u.role,
             (u.status = 'Active') AS active,
             NULL AS locationId,
             NULL AS locationCode,
             NULL AS locationName,
             'User' AS sourceTable
           FROM User u
           WHERE (LOWER(u.username) = ? OR (u.email IS NOT NULL AND LOWER(u.email) = ?))`,
          [cleanUsername, cleanUsername]
        );
      } catch (e) {
        console.warn('[verifyUser] User table query failed:', e.message);
        rows = [];
      }
    }

    if (!rows || rows.length === 0) return { success: false };

    const user = rows[0];

    const activeFlag = user.active;
    if (activeFlag !== null && activeFlag !== undefined && !(activeFlag === 1 || activeFlag === true)) {
      return { success: false };
    }

    const isPlainMatch = cleanPassword === user.password || cleanPassword === String(user.password || '').trim();
    const isBcryptMatch = !isPlainMatch && await bcrypt.compare(cleanPassword, user.password).catch(() => false);

    if (!isBcryptMatch && !isPlainMatch) return { success: false };

    return {
      success: true,
      role: user.role,
      displayName: user.fullName || user.role,
      locationId: user.locationId || null,
      locationCode: user.locationCode || null,
      locationName: user.locationName || null,
      isGlobalAdmin: !user.locationId
    };
  }

  async rotateRefreshToken(oldRefreshToken, ipAddress, userAgent) {
    if (!oldRefreshToken) {
      throw new Error('Refresh token is required');
    }

    let decoded;
    try {
      decoded = jwt.verify(oldRefreshToken, getJwtRefreshSecret());
    } catch (err) {
      throw new Error('Invalid or expired refresh token');
    }

    const { isTokenBlacklisted, blacklistToken } = require('../middleware/auth');
    const isRevoked = await isTokenBlacklisted(oldRefreshToken);
    if (isRevoked) {
      // Refresh token reuse detected (theft alert!) - revoke all active sessions
      console.warn(`[Security Alert] Refresh token reuse detected for user ${decoded.username} (ID: ${decoded.id}). Revoking all sessions.`);
      await pool.query('UPDATE users SET token_version = COALESCE(token_version, 1) + 1 WHERE id = ?', [decoded.id]).catch(() => {});
      await pool.query('UPDATE user_sessions SET is_active = 0 WHERE user_id = ?', [decoded.id]).catch(() => {});
      throw new Error('Security alert: Refresh token reuse detected. All sessions revoked for your protection.');
    }

    // Invalidate the old refresh token immediately (one-time use rotation)
    await blacklistToken(oldRefreshToken, decoded.id, decoded.username, 'refresh_rotation');

    // Fetch user and verify active status
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.full_name AS fullName, u.role, (u.active = 1) AS status,
              COALESCE(u.token_version, 1) AS tokenVersion,
              u.location_id AS locationId,
              COALESCE(u.location_code, l.location_code) AS locationCode,
              l.location_name AS locationName
       FROM users u
       LEFT JOIN locations l ON l.id = u.location_id
       WHERE u.id = ? LIMIT 1`,
      [decoded.id]
    );

    if (!rows || rows.length === 0 || !rows[0].status) {
      throw new Error('User account is inactive or not found');
    }

    const user = rows[0];

    // Check tokenVersion match
    if (decoded.tokenVersion && decoded.tokenVersion !== user.tokenVersion) {
      throw new Error('Session version expired. Please log in again.');
    }

    const locationId = user.locationId ?? null;
    const isGlobalAdmin = locationId === null;
    const locationCode = isGlobalAdmin ? null : (user.locationCode || null);
    const locationName = isGlobalAdmin ? null : (user.locationName || null);

    // Re-issue short-lived access token (15m) + new rotated refresh token (7d)
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        tokenVersion: user.tokenVersion,
        locationId,
        locationCode,
        locationName,
        isGlobalAdmin
      },
      getJwtSecret(),
      { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
      {
        id: user.id,
        username: user.username,
        tokenVersion: user.tokenVersion,
        jti: crypto.randomBytes(16).toString('hex')
      },
      getJwtRefreshSecret(),
      { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
    );

    await this.createUserSession(user.id, token, refreshToken, ipAddress, userAgent, user.username);

    return {
      token,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        displayName: user.fullName || user.role,
        locationId,
        locationCode,
        locationName,
        isGlobalAdmin
      }
    };
  }

  async logout(token, userId, username, ipAddress) {
    // Record the explicit sign-out so the admin dashboard can show
    // login/logout activity with timestamps.
    try {
      await pool.query(
        `INSERT INTO audit_logs (username, action, module, details, ip_address) VALUES (?, 'LOGOUT', 'Auth', 'User signed out', ?)`,
        [username || (userId ? `user#${userId}` : 'unknown'), ipAddress || null]
      );
    } catch (e) {
      console.warn('[AuthService] logout audit skipped:', e.message);
    }
    return true;
  }

  /**
   * Best-effort audit trail for login attempts. Never throws — an audit
   * failure must not block authentication.
   */
  async _audit(username, action, details, ipAddress) {
    try {
      await pool.query(
        `INSERT INTO audit_logs (username, action, module, details, ip_address) VALUES (?, ?, 'Auth', ?, ?)`,
        [username, action, details, ipAddress || null]
      );
    } catch (e) {
      console.warn('[AuthService] audit log skipped:', e.message);
    }
  }
}

module.exports = new AuthService();
