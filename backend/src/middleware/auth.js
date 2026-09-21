const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { errorRes } = require('../utils/response');
const { getJwtSecret } = require('../utils/secrets');
const pool = require('../config/db');
const { authorizeLocationAccess } = require('../services/authorizationService');
const { getCache, setCache, isReady } = require('../config/redisClient');

// ── JWT Blacklist Cache ────────────────────────────────────────────
// In-memory set of token hashes that have been blacklisted (logout/force-logout).
// Periodically synced from the database to avoid a DB check on every request.
const BLACKLIST_CACHE = new Set();
let blacklistLastSync = 0;
const BLACKLIST_SYNC_TTL_MS = 30000; // sync every 30 seconds

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function isTokenBlacklisted(token) {
  const tokenHash = hashToken(token);
  if (BLACKLIST_CACHE.has(tokenHash)) return true;

  if (isReady()) {
    try {
      const redisBlacklisted = await getCache(`app:prod:jwt_blacklist:${tokenHash}`);
      if (redisBlacklisted) {
        BLACKLIST_CACHE.add(tokenHash);
        return true;
      }
    } catch (e) {}
  }

  // Periodic sync from DB
  if (Date.now() - blacklistLastSync > BLACKLIST_SYNC_TTL_MS) {
    try {
      const [rows] = await pool.query(
        'SELECT token_jti FROM jwt_blacklist WHERE expires_at > NOW() LIMIT 500'
      );
      BLACKLIST_CACHE.clear();
      rows.forEach(r => BLACKLIST_CACHE.add(r.token_jti));
      blacklistLastSync = Date.now();
    } catch (err) {
      // Table may not exist yet — fail open
    }
  }

  return BLACKLIST_CACHE.has(tokenHash);
}

/**
 * Add a token to the blacklist (called on logout, force-logout, password change).
 */
async function blacklistToken(token, userId, username, reason = 'logout') {
  try {
    const decoded = jwt.decode(token);
    const tokenHash = hashToken(token);
    const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 6 * 60 * 60 * 1000);

    if (isReady()) {
      const remainingSeconds = Math.max(60, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      await setCache(`app:prod:jwt_blacklist:${tokenHash}`, true, remainingSeconds);
    }

    await pool.query(
      `INSERT IGNORE INTO jwt_blacklist (token_jti, user_id, username, reason, expires_at) VALUES (?, ?, ?, ?, ?)`,
      [tokenHash, userId || null, username || null, reason, expiresAt]
    );
    BLACKLIST_CACHE.add(tokenHash);
  } catch (err) {
    console.warn('[blacklistToken] Failed to blacklist token:', err.message);
  }
}

/**
 * Log session activity (non-blocking).
 */
async function logSessionActivity(data) {
  try {
    await pool.query(
      `INSERT INTO session_activity (user_id, username, session_id, action, module, details, ip_address, user_agent, location_id, method, path, status_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.userId || null,
        data.username || 'anonymous',
        data.sessionId || null,
        data.action || 'API_CALL',
        data.module || null,
        data.details ? JSON.stringify(data.details) : null,
        data.ip || null,
        data.userAgent || null,
        data.locationId || null,
        data.method || null,
        data.path || null,
        data.statusCode || null
      ]
    );
  } catch (err) {
    // Non-blocking — never throw
  }
}

/**
 * authenticate — verifies JWT and attaches full user+location context to req.user
 * req.user.locationId   — INT or null (null = Global Admin)
 * req.user.locationCode — 'DAV' | 'BEL' | 'SHI' | null
 * req.user.locationName — 'Davanagere' | 'Belagavi' | 'Shivamogga' | null
 * req.user.isGlobalAdmin — true if locationId is null
 *
 * The token alone is never trusted as proof of an allowed session: the account
 * must still exist, still be active and not be locked. That is what makes
 * "deactivate account" take effect on live sessions (not just the next login)
 * and keeps the backend authoritative instead of relying on the frontend
 * hiding links.
 */
// Built-in deployment accounts. Their JWTs are issued without a database row
// (master recovery access), so they are the only identities allowed to proceed
// when no row is found for the id inside the token.
const BUILTIN_ACCOUNT_USERNAMES = [
  'admin@bsctextiles.com', 'admin',
  'hr@bsctextiles.com', 'hr',
  'manager@bsctextiles.com', 'manager',
  'greeter@bsctextiles.com', 'greeter'
];

// Short-TTL status cache: keeps the per-request cost of the check negligible
// while still picking up admin changes within a few seconds.
const STATUS_CACHE = new Map();
const STATUS_CACHE_TTL_MS = 5000;

function getCachedUserStatus(userId) {
  const entry = STATUS_CACHE.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.at > STATUS_CACHE_TTL_MS) {
    STATUS_CACHE.delete(userId);
    return null;
  }
  return entry.value;
}

function cacheUserStatus(userId, value) {
  if (STATUS_CACHE.size > 500) STATUS_CACHE.clear();
  STATUS_CACHE.set(userId, { at: Date.now(), value });
}

/**
 * Drops a user's cached status so a status/permission change made by an admin
 * is honoured immediately by subsequent requests.
 */
function invalidateUserStatusCache(userId) {
  if (userId === undefined || userId === null) {
    STATUS_CACHE.clear();
    return;
  }
  STATUS_CACHE.delete(userId);
}

const authenticate = async (req, res, next) => {
  try {
    let token = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.headers['x-auth-token']) {
      token = req.headers['x-auth-token'];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return errorRes(res, 'Authentication token required', [], 401);
    }

    const decoded = jwt.verify(token, getJwtSecret());

    // ── JWT Blacklist check ──────────────────────────────────────────
    // If the token has been blacklisted (logout / force-logout / password change),
    // reject immediately — the cookie/header is stale.
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      res.clearCookie('token', { path: '/' });
      return errorRes(res, 'Session has been invalidated. Please log in again.', [], 401);
    }

    req.user = decoded;
    // Attach correlation ID for request tracing
    req.correlationId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    // ── Account status enforcement ─────────────────────────────────
    const userId = decoded.id;
    const username = String(decoded.username || '').toLowerCase();
    let status = userId !== undefined && userId !== null ? getCachedUserStatus(userId) : null;

    if (!status) {
      try {
        let dbStatus = null;
        try {
          const [uRows] = await pool.query(
            "SELECT `active` FROM `users` WHERE `id` = ? LIMIT 1",
            [userId]
          );
          if (uRows && uRows.length > 0) {
            dbStatus = {
              exists: true,
              active: uRows[0].active === 1 || uRows[0].active === true,
              locked: false
            };
          }
        } catch (err) {
          // ignore error, try fallback
        }

        if (!dbStatus) {
          const [rows] = await pool.query(
            "SELECT `status`, `lockedUntil` FROM `User` WHERE `id` = ? LIMIT 1",
            [userId]
          );
          if (rows && rows.length > 0) {
            dbStatus = {
              exists: true,
              active: rows[0].status === 'Active',
              locked: !!(rows[0].lockedUntil && new Date(rows[0].lockedUntil) > new Date())
            };
          } else {
            dbStatus = { exists: false };
          }
        }
        
        status = dbStatus;
        cacheUserStatus(userId, status);
      } catch (dbErr) {
        // Database unreachable — fail open so kiosks/health checks keep working
        // (the same policy the rest of the platform uses for a DB outage).
        console.warn('[authenticate] account status check unavailable:', dbErr.message);
        status = null;
      }
    }

    if (status) {
      if (!status.exists) {
        if (!BUILTIN_ACCOUNT_USERNAMES.includes(username)) {
          res.clearCookie('token', { path: '/' });
          return errorRes(res, 'This account no longer exists', [], 401);
        }
      } else if (!status.active) {
        res.clearCookie('token', { path: '/' });
        return errorRes(res, 'Your account has been deactivated. Contact a system administrator.', [], 401);
      } else if (status.locked) {
        res.clearCookie('token', { path: '/' });
        return errorRes(res, 'Account is temporarily locked. Try again later.', [], 401);
      }
    }

    // ── Session activity logging (non-blocking) ──────────────────────
    logSessionActivity({
      userId: decoded.id,
      username: decoded.username,
      sessionId: req.correlationId,
      action: 'API_CALL',
      module: req.path?.split('/')[1] || 'unknown',
      details: { method: req.method, path: req.path },
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'],
      locationId: decoded.locationId,
      method: req.method,
      path: req.path
    });

    next();
  } catch (err) {
    return errorRes(res, 'Invalid or expired authentication token', [err.message], 401);
  }
};

/**
 * authorize — role-based access control
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return errorRes(res, 'Forbidden: insufficient permissions', [], 403);
    }
    next();
  };
};

/**
 * getLocationFilter — returns a WHERE clause fragment and params for location isolation.
 *
 * Supports multi-location users via the user_locations junction table.
 *
 * Usage in controllers (async):
 *   const { clause, params } = await getLocationFilter(req, 'c');
 *   db.query(`SELECT * FROM candidates c WHERE 1=1 ${clause}`, params);
 *
 * Global Admin (no locationId):  clause = '' (no filter, sees all locations)
 * Single-location user:          clause = 'AND c.location_id = ?' with [locationId]
 * Multi-location user:           clause = 'AND c.location_id IN (?, ?, ?)' with [id1, id2, ...]
 * Fallback (no user_locations):  clause = 'AND c.location_id = ?' with [locationId]
 *
 * @param {object} req        — Express request with req.user populated
 * @param {string} tableAlias — table alias prefix (e.g. 'c' → 'c.location_id')
 * @returns {Promise<{clause: string, params: Array}>}
 */
const LOCATION_CODE_MAP = {
  'BEL': 1,
  'DAV': 2,
  'SHI': 3
};

function parseTargetLocation(val) {
  if (val === undefined || val === null || val === '' || val === 'all') return null;
  let parsed = parseInt(val, 10);
  if (isNaN(parsed) && typeof val === 'string') {
    parsed = LOCATION_CODE_MAP[val.trim().toUpperCase()] || null;
  }
  return parsed;
}

/**
 * getLocationFilter — returns a WHERE clause fragment and params for location isolation.
 *
 * Supports multi-location users via the user_locations junction table and token allowedLocations.
 * Supports requested location filter via query param, header, or body.
 *
 * Usage in controllers (async):
 *   const { clause, params } = await getLocationFilter(req, 'c');
 *   db.query(`SELECT * FROM candidates c WHERE 1=1 ${clause}`, params);
 *
 * @param {object} req        — Express request with req.user populated
 * @param {string} tableAlias — table alias prefix (e.g. 'c' → 'c.location_id')
 * @returns {Promise<{clause: string, params: Array}>}
 */
const getLocationFilter = async (req, tableAlias = '') => {
  const col = tableAlias ? `${tableAlias}.location_id` : 'location_id';
  if (!req.user) {
    // Unauthenticated request should NEVER see data
    return { clause: `AND 1 = 0`, params: [] };
  }

  const rawRequested = req.query?.location_id 
    || req.query?.locationId 
    || req.headers?.['x-location-id']
    || req.body?.location_id
    || req.body?.locationId;
  const requestedLocationId = parseTargetLocation(rawRequested);

  const isGlobalAdmin = !req.user.locationId || req.user.isGlobalAdmin || ['Admin', 'Super Admin'].includes(req.user.role);

  if (isGlobalAdmin) {
    if (requestedLocationId) {
      return { clause: `AND ${col} = ?`, params: [requestedLocationId] };
    }
    return { clause: '', params: [] };
  }

  // Multi-location resolution
  let allowedLocationIds = [];
  if (Array.isArray(req.user.allowedLocations) && req.user.allowedLocations.length > 0) {
    allowedLocationIds = req.user.allowedLocations;
  } else if (req.user.id) {
    try {
      const [rows] = await pool.query(
        'SELECT location_id FROM user_locations WHERE user_id = ?',
        [req.user.id]
      );
      if (rows && rows.length > 0) {
        allowedLocationIds = rows.map(r => r.location_id);
      }
    } catch (err) {}
  }

  if (allowedLocationIds.length === 0 && req.user.locationId) {
    allowedLocationIds = [req.user.locationId];
  }

  // If a specific location was requested:
  if (requestedLocationId) {
    if (allowedLocationIds.includes(requestedLocationId)) {
      return { clause: `AND ${col} = ?`, params: [requestedLocationId] };
    }
    // Requested an unauthorized location! Reject with empty results
    return { clause: `AND 1 = 0`, params: [] };
  }

  // No specific location requested: filter to all allowed locations
  if (allowedLocationIds.length > 1) {
    const placeholders = allowedLocationIds.map(() => '?').join(', ');
    return {
      clause: `AND ${col} IN (${placeholders})`,
      params: allowedLocationIds
    };
  } else if (allowedLocationIds.length === 1) {
    return {
      clause: `AND ${col} = ?`,
      params: [allowedLocationIds[0]]
    };
  }

  return { clause: `AND 1 = 0`, params: [] };
};

/**
 * injectLocationId — for INSERT/UPDATE operations.
 * Returns the authenticated user's locationId, respecting requested location if authorized.
 */
const injectLocationId = (req) => {
  if (!req.user) return null;
  const rawRequested = req.body?.location_id 
    || req.body?.locationId 
    || req.query?.location_id 
    || req.query?.locationId 
    || req.headers?.['x-location-id'];
  const requestedLocationId = parseTargetLocation(rawRequested);

  const isGlobalAdmin = !req.user.locationId || req.user.isGlobalAdmin || ['Admin', 'Super Admin'].includes(req.user.role);

  if (isGlobalAdmin) {
    return requestedLocationId || 2; // default to Davanagere if not specified
  }

  let allowed = req.user.allowedLocations;
  if (!Array.isArray(allowed) || allowed.length === 0) {
    allowed = req.user.locationId ? [req.user.locationId] : [2];
  }

  if (requestedLocationId && allowed.includes(requestedLocationId)) {
    return requestedLocationId;
  }

  return allowed[0] || req.user.locationId || 2;
};

/**
 * authorizeModule — per-module permission check using user_permissions table.
 * Admin and Super Admin roles bypass this check entirely.
 * For other roles, checks the user_permissions table for the specified module
 * and action (can_view, can_add, can_edit, can_delete, can_export, can_approve).
 */
const authorizeModule = (moduleName, action = 'can_view') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return errorRes(res, 'Authentication required', [], 401);
      }

      // Admin/Super Admin bypass module-level checks
      if (['Admin', 'Super Admin'].includes(req.user.role)) {
        return next();
      }

      const validActions = ['can_view', 'can_add', 'can_edit', 'can_delete', 'can_export', 'can_approve'];
      const safeAction = validActions.includes(action) ? action : 'can_view';

      const [rows] = await pool.query(
        `SELECT ${safeAction} as allowed FROM user_permissions WHERE user_id = ? AND module = ?`,
        [req.user.id, moduleName]
      );

      if (!rows.length || !rows[0].allowed) {
        return errorRes(res, `Access denied: you do not have ${safeAction.replace('can_', '')} permission for this module`, [], 403);
      }

      next();
    } catch (err) {
      // If user_permissions table doesn't exist, fall back to role-based access
      console.warn('[authorizeModule] Permission check failed, falling back to role-based:', err.message);
      next();
    }
  };
};

/**
 * optionalAuthenticate — verifies JWT if present, otherwise creates a mock user from x-device-id header.
 * Used for public endpoints like the AI chatbot.
 */
const optionalAuthenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1] || req.headers['x-auth-token'];
  if (!token) {
    req.user = { id: req.headers['x-device-id'] || 'anonymous', role: 'Guest' };
    return next();
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.user = decoded;
    return next();
  } catch (err) {
    req.user = { id: req.headers['x-device-id'] || 'anonymous', role: 'Guest' };
    return next();
  }
};

module.exports = {
  authenticate,
  optionalAuthenticate,
  authorize,
  authorizeModule,
  authorizeLocationAccess,
  getLocationFilter,
  injectLocationId,
  invalidateUserStatusCache,
  blacklistToken,
  logSessionActivity,
  hashToken
};
