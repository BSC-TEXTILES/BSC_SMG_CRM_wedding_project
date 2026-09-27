/**
 * API Key Authentication & Scope Enforcement Middleware
 * - Validates Bearer API Key from Authorization header
 * - Enforces 24-hour daily re-authorization check
 * - Sliding window rate limiter per key
 * - Brute force mitigation: blocks aggressive failed attempts
 */

const apiKeyService = require('../services/apiKeyService');

// In-memory sliding window rate limiter per key
const KEY_USAGE_WINDOWS = new Map();
// In-memory failed attempts tracker per IP (10 failures in 10 min -> block)
const FAILED_ATTEMPTS = new Map();

function checkBruteForce(ip) {
  if (!ip || ip === '127.0.0.1' || ip === '::1') return false;
  const now = Date.now();
  const entry = FAILED_ATTEMPTS.get(ip);
  if (!entry) return false;
  if (now - entry.firstAttempt > 10 * 60 * 1000) {
    FAILED_ATTEMPTS.delete(ip);
    return false;
  }
  return entry.count >= 10;
}

function recordFailedAttempt(ip) {
  if (!ip) return;
  const now = Date.now();
  let entry = FAILED_ATTEMPTS.get(ip);
  if (!entry || now - entry.firstAttempt > 10 * 60 * 1000) {
    entry = { count: 1, firstAttempt: now };
  } else {
    entry.count += 1;
  }
  FAILED_ATTEMPTS.set(ip, entry);
}

function checkKeyRateLimit(keyId, limitPerMinute = 60) {
  const now = Date.now();
  let window = KEY_USAGE_WINDOWS.get(keyId);
  if (!window || now - window.startTime > 60 * 1000) {
    window = { startTime: now, count: 1 };
    KEY_USAGE_WINDOWS.set(keyId, window);
    return { allowed: true, remaining: limitPerMinute - 1 };
  }
  window.count += 1;
  const remaining = Math.max(0, limitPerMinute - window.count);
  return { allowed: window.count <= limitPerMinute, remaining };
}

/**
 * Middleware factory enforcing API Key authentication and optional scope
 * @param {string|null} requiredScope - Scope required for this endpoint (e.g. 'data:read')
 */
function checkApiKeyAuth(requiredScope = null) {
  return async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        code: 'MISSING_API_KEY',
        message: 'API Key must be provided in Authorization header: Bearer <API_KEY>'
      });
    }

    const clientIp = req.ip || req.connection?.remoteAddress;
    if (checkBruteForce(clientIp)) {
      return res.status(429).json({
        success: false,
        code: 'IP_BLOCKED',
        message: 'Too many failed API key attempts. Access temporarily blocked for 10 minutes.'
      });
    }

    const rawKey = authHeader.slice(7).trim();

    try {
      const authResult = await apiKeyService.authenticateKey(
        rawKey,
        requiredScope,
        clientIp,
        req.headers['user-agent']
      );

      if (!authResult.valid) {
        recordFailedAttempt(clientIp);

        // Daily Re-Auth specific response (Module 4)
        if (authResult.code === 'DAILY_REAUTH_REQUIRED') {
          return res.status(403).json({
            error: 'DAILY_REAUTH_REQUIRED',
            message: 'This API key requires daily admin re-authorization. Contact your administrator.',
            key_public_id: authResult.key_public_id,
            expired_at: authResult.expired_at
          });
        }

        const statusCode = ['INSUFFICIENT_SCOPE', 'IP_NOT_ALLOWED'].includes(authResult.code) ? 403 : 401;
        return res.status(statusCode).json({
          success: false,
          code: authResult.code,
          message: authResult.error
        });
      }

      const keyData = authResult.keyData;

      // Rate limit per key
      const rateLimitCheck = checkKeyRateLimit(keyData.id, keyData.rateLimitPerMinute);
      res.setHeader('X-RateLimit-Limit', keyData.rateLimitPerMinute);
      res.setHeader('X-RateLimit-Remaining', rateLimitCheck.remaining);

      if (!rateLimitCheck.allowed) {
        return res.status(429).json({
          success: false,
          code: 'RATE_LIMIT_EXCEEDED',
          message: `API Key rate limit of ${keyData.rateLimitPerMinute} requests per minute exceeded.`,
          retryAfterSeconds: 60
        });
      }

      // Attach key context
      req.apiKey = keyData;
      req.user = {
        id: keyData.userId,
        username: keyData.username,
        role: keyData.userRole,
        isApiKey: true
      };

      next();
    } catch (err) {
      console.error('[ApiKeyAuth] Internal authentication error:', err.message);
      return res.status(500).json({
        success: false,
        code: 'AUTH_ERROR',
        message: 'Internal error during API key authentication.'
      });
    }
  };
}

module.exports = {
  checkApiKeyAuth
};
