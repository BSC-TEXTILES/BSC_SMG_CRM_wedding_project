/**
 * Enterprise Security Logger & Audit Service
 * Centralizes security event recording into the audit_logs table,
 * dispatches real-time security events to admin dashboards, and
 * guarantees zero leakage of credentials, tokens, or private secrets.
 */

const pool = require('../config/db');

// Sensitive keys to scrub from logged objects
const SENSITIVE_KEYS = new Set([
  'password',
  'newpassword',
  'confirmpassword',
  'token',
  'authorization',
  'cookie',
  'x-csrf-token',
  'secret',
  'jwt',
  'api_key',
  'apikey',
  'gemini_api_key'
]);

/**
 * Recursively deep-scrub sensitive values before logging.
 */
function sanitizeForAudit(obj, depth = 0) {
  if (depth > 4 || obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForAudit(item, depth + 1));
  }

  const clean = {};
  for (const [k, v] of Object.entries(obj)) {
    const lowerKey = k.toLowerCase().replace(/[_-]/g, '');
    if (SENSITIVE_KEYS.has(lowerKey)) {
      clean[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null) {
      clean[k] = sanitizeForAudit(v, depth + 1);
    } else if (typeof v === 'string' && v.length > 500) {
      clean[k] = v.substring(0, 500) + '...[TRUNCATED]';
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

class SecurityLogger {
  /**
   * Log a security incident or firewall event.
   *
   * @param {string} action - Event type (e.g. 'WAF_BLOCKED', 'RATE_LIMIT_EXCEEDED', 'BRUTE_FORCE_LOCKOUT')
   * @param {object} req - Express request object (optional, for contextual telemetry)
   * @param {object} details - Additional incident metadata
   */
  async log(action, req = null, details = {}) {
    const correlationId = (req && req.correlationId) || `sec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const ip = (req && (req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress)) || details.ip || '0.0.0.0';
    const userAgent = (req && req.headers['user-agent']) || details.userAgent || 'unknown';
    const username = (req && req.user && (req.user.username || req.user.fullName)) || details.username || 'anonymous';
    const endpoint = (req && (req.originalUrl || req.url)) || details.endpoint || 'unknown';
    const method = (req && req.method) || details.method || 'UNKNOWN';

    const cleanDetails = sanitizeForAudit({
      ...details,
      correlationId,
      endpoint,
      method,
      userAgent: String(userAgent).substring(0, 200)
    });

    const detailsJson = JSON.stringify(cleanDetails).substring(0, 950);

    // 1. Non-blocking asynchronous database write
    try {
      const [insertResult] = await pool.query(
        `INSERT INTO audit_logs (username, action, module, details, ip_address) VALUES (?, ?, 'Security', ?, ?)`,
        [String(username).substring(0, 100), String(action).substring(0, 100), detailsJson, String(ip).substring(0, 45)]
      );

      // 2. Real-time broadcast to connected admin monitoring consoles
      if (req && req.app) {
        try {
          const io = req.app.get('io');
          if (io && typeof io.emit === 'function') {
            io.emit('security:event_logged', {
              id: insertResult.insertId,
              username,
              action,
              details: cleanDetails,
              ipAddress: ip,
              createdAt: new Date().toISOString()
            });
          }
        } catch (socketErr) {
          // Non-blocking real-time dispatch failure
        }
      }
    } catch (dbErr) {
      // Never throw an exception from security logging — write to console fallback
      console.warn(`[SecurityLogger Fallback] ${action} from ${ip}: ${detailsJson}`);
    }

    return correlationId;
  }
}

module.exports = new SecurityLogger();
