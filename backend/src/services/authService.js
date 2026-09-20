const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getJwtSecret, getJwtRefreshSecret } = require('../utils/secrets');

// Absolute session lifetime: users who never sign out are logged out after
// this many hours (matches the cookie max-age and the client timer).
const SESSION_HOURS = parseInt(process.env.SESSION_HOURS || '6', 10);
const SESSION_EXPIRES_IN = SESSION_HOURS + 'h';

class AuthService {
  /**
   * Login — reads user's assigned location from DB and embeds in JWT.
   * Location isolation is enforced here: the user's location_id from the
   * database is the single source of truth. Frontend cannot override it.
   *
   * Security model:
   *   - Passwords are stored as bcrypt hashes. Any legacy plaintext row is
   *     transparently upgraded to a bcrypt hash on first successful login.
   *   - The master recovery password (admin@2026) only unlocks the four
   *     built-in deployment accounts below — never arbitrary DB accounts.
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
           u.location_id AS locationId,
           COALESCE(u.location_code, l.location_code) AS locationCode,
           l.location_name AS locationName
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
             NULL AS locationName
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
                  (active = TRUE OR active = 1) AS status
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
                  (status = 'Active') AS status
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
      this._audit(cleanUsername, 'LOGIN_FAILED', 'Account deactivated', ipAddress);
      throw new Error('Your account has been deactivated. Please contact administrator.');
    }

    // ── Credential verification (bcrypt first; legacy plaintext upgraded) ──
    const isBcryptMatch = await bcrypt.compare(cleanPassword, user.password).catch(() => false);
    const isPlainMatch = !isBcryptMatch && cleanPassword === user.password;

    if (!isBcryptMatch && !isPlainMatch) {
      this._audit(cleanUsername, 'LOGIN_FAILED', 'Invalid password', ipAddress);
      throw new Error('Incorrect username or password');
    }

    // Transparent migration: hash any legacy plaintext password in place.
    if (isPlainMatch) {
      try {
        const upgradedHash = await bcrypt.hash(cleanPassword, 12);
        await pool.query(`UPDATE users SET password = ? WHERE id = ?`, [upgradedHash, user.id]).catch(() => {});
      } catch (e) {
        // Upgrade is best-effort — login must not fail because of it
      }
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
    const isGlobalAdmin = locationId === null; // null location = Global Admin (all locations)

    if (isGlobalAdmin) {
      try {
        const [allLocs] = await pool.query(
          `SELECT id, location_code AS code, location_name AS name FROM locations WHERE status = 'Active' ORDER BY sort_order ASC`
        );
        allowedLocations = allLocs || [];
      } catch (e) {}
    } else if (allowedLocations.length === 0 && locationId) {
      allowedLocations = [{
        id: locationId,
        code: locationCode || 'DAV',
        name: locationName || 'Davanagere'
      }];
    }

    const allowedLocationIds = allowedLocations.map(l => l.id);

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        locationId,
        locationCode,
        locationName,
        isGlobalAdmin,
        allowedLocations: allowedLocationIds
      },
      getJwtSecret(),
      { expiresIn: SESSION_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
      { id: user.id, username: user.username },
      getJwtRefreshSecret(),
      { expiresIn: SESSION_EXPIRES_IN }
    );

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
        allowedLocations
      }
    };
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
           (u.active = TRUE OR u.active = 1 OR u.status = 'Active') AS status,
           u.location_id AS locationId,
           COALESCE(u.location_code, l.location_code) AS locationCode,
           l.location_name AS locationName
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
             (u.status = 'Active') AS status,
             u.location_id AS locationId,
             COALESCE(u.location_code, l.location_code) AS locationCode,
             l.location_name AS locationName
           FROM User u
           LEFT JOIN locations l ON l.id = u.location_id
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
    const isBcryptMatch = await bcrypt.compare(cleanPassword, user.password).catch(() => false);
    const isPlainMatch = !isBcryptMatch && cleanPassword === user.password;

    if (!isBcryptMatch && !isPlainMatch) return { success: false };

    if (isPlainMatch) {
      try {
        const upgradedHash = await bcrypt.hash(cleanPassword, 10);
        await pool.query(`UPDATE users SET password = ? WHERE id = ?`, [upgradedHash, user.id]).catch(() => {});
      } catch (e) {}
    }

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
