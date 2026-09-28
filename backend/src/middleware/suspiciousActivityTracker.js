/**
 * Suspicious Activity Tracker & IDOR Defense
 * ───────────────────────────────────────────
 * Tracks 403 Forbidden violations per user / IP in a sliding time window.
 * If 3 or more unauthorized access attempts occur within 5 minutes:
 * 1. Automatically revokes & blacklists the user's JWT session.
 * 2. Writes a high-priority incident into the security audit_logs table.
 * 3. Sets X-Force-Logout header to instruct the frontend to terminate immediately.
 */

const securityLogger = require('../security/securityLogger');
const { blacklistToken, isTokenBlacklisted } = require('./auth');

// In-memory sliding window: key -> Array of timestamps (ms)
const violationsMap = new Map();
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const VIOLATION_THRESHOLD = 3;   // 3 attempts triggers force-logout

/**
 * Clean up entries older than WINDOW_MS
 */
function pruneOldViolations(timestamps, now) {
  return timestamps.filter(ts => now - ts < WINDOW_MS);
}

/**
 * Record a 403 violation and determine if force-logout threshold is reached.
 *
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {string} reason - Description of violation (e.g. 'Cross-store IDOR attempt')
 * @returns {object} { forceLogout: boolean, violationCount: number, message: string }
 */
function record403Violation(req, res, reason = 'Unauthorized resource access') {
  const now = Date.now();
  const userId = req.user?.id || null;
  const username = req.user?.username || 'anonymous';
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  
  // Track by userId if authenticated, otherwise by IP
  const trackerKey = userId ? `user_${userId}` : `ip_${ip}`;

  const currentHistory = violationsMap.get(trackerKey) || [];
  const recent = pruneOldViolations(currentHistory, now);
  recent.push(now);
  violationsMap.set(trackerKey, recent);

  const count = recent.length;

  // Record violation in security audit log for administration review
  securityLogger.log('UNAUTHORIZED_ACCESS_ATTEMPT', req, {
    userId,
    username,
    violationCount: count,
    attemptedUrl: req.originalUrl || req.path,
    method: req.method,
    reason,
    ip
  });

  // Force-logout after VIOLATION_THRESHOLD violations
  if (count >= VIOLATION_THRESHOLD) {
    // Blacklist the token if we have one
    const authHeader = req.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        blacklistToken(token);
      } catch (e) { /* ignore blacklist errors */ }
    }
    
    // Set force-logout header for frontend
    res.setHeader('X-Force-Logout', 'true');
    
    return {
      forceLogout: true,
      violationCount: count,
      message: reason
    };
  }

  return {
    forceLogout: false,
    violationCount: count,
    message: reason
  };
}

module.exports = {
  record403Violation,
  VIOLATION_THRESHOLD,
  WINDOW_MS
};
