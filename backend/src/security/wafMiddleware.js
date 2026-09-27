/**
 * Enterprise Web Application Firewall (WAF) Middleware
 * Real-time inspection of HTTP requests, payload screening,
 * automated attack mitigation, and IP reputation management.
 */

const {
  ALLOWED_HTTP_METHODS,
  SCANNER_USER_AGENTS,
  inspectString,
  inspectObject
} = require('./wafRules');
const securityLogger = require('./securityLogger');

// ── In-Memory IP Reputation & Temporary Jail ─────────────────────────────────
// Tracks aggressive attackers: 10 violations in 5 minutes -> 15-minute temporary IP ban.
const IP_VIOLATIONS = new Map();
const IP_JAIL = new Map();
const VIOLATION_WINDOW_MS = 5 * 60 * 1000;
const JAIL_DURATION_MS = 15 * 60 * 1000;
const MAX_VIOLATIONS_BEFORE_JAIL = 10;

// Periodic cleanup of expired entries
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of IP_VIOLATIONS.entries()) {
    if (now - entry.lastSeen > VIOLATION_WINDOW_MS) {
      IP_VIOLATIONS.delete(ip);
    }
  }
  for (const [ip, unjailTime] of IP_JAIL.entries()) {
    if (now > unjailTime) {
      IP_JAIL.delete(ip);
    }
  }
}, 60 * 1000).unref();

const LOOPBACK_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost']);

function recordViolation(ip) {
  // Never jail localhost loopback addresses or automated test suites
  if (LOOPBACK_IPS.has(ip) || process.env.NODE_ENV === 'test') {
    return false;
  }

  const now = Date.now();
  let entry = IP_VIOLATIONS.get(ip);
  if (!entry) {
    entry = { count: 0, lastSeen: now };
    IP_VIOLATIONS.set(ip, entry);
  }
  entry.count += 1;
  entry.lastSeen = now;

  if (entry.count >= MAX_VIOLATIONS_BEFORE_JAIL) {
    IP_JAIL.set(ip, now + JAIL_DURATION_MS);
    IP_VIOLATIONS.delete(ip);
    return true; // Jailed
  }
  return false;
}

function isJailed(ip) {
  if (LOOPBACK_IPS.has(ip) || process.env.NODE_ENV === 'test') {
    return false;
  }
  const unjailTime = IP_JAIL.get(ip);
  if (!unjailTime) return false;
  if (Date.now() > unjailTime) {
    IP_JAIL.delete(ip);
    return false;
  }
  return true;
}

function clearIpJail() {
  IP_VIOLATIONS.clear();
  IP_JAIL.clear();
}

/**
 * Check if the request path represents a static asset or low-risk diagnostic ping
 * that can bypass heavy WAF payload inspection for maximum throughput.
 */
function isStaticOrBypassPath(reqPath) {
  if (!reqPath) return false;
  return (
    reqPath.startsWith('/assets/') ||
    reqPath.startsWith('/uploads/') ||
    reqPath.startsWith('/dist/') ||
    reqPath === '/favicon.ico' ||
    reqPath === '/manifest.json' ||
    reqPath === '/manifest.webmanifest' ||
    reqPath === '/robots.txt' ||
    reqPath === '/health' ||
    reqPath === '/api/health' ||
    reqPath === '/db-status' ||
    reqPath === '/api/db-status'
  );
}

const wafMiddleware = async (req, res, next) => {
  // Always attach correlation ID for end-to-end request tracing
  req.correlationId = req.correlationId || `waf_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  res.setHeader('X-WAF-Protection', 'BSC-Enterprise-Shield/3.0');

  const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '0.0.0.0';
  const reqPath = req.path || '';

  // 1. IP Jail Check
  if (isJailed(clientIp)) {
    await securityLogger.log('WAF_IP_JAILED_REJECT', req, {
      reason: 'IP temporarily banned due to repeated attack violations',
      ip: clientIp
    });
    return res.status(403).json({
      success: false,
      code: 'FIREWALL_IP_BLOCKED',
      message: 'Access temporarily restricted due to repeated security policy violations. Try again later.',
      correlationId: req.correlationId
    });
  }

  // 2. Fast-path exit for static files and health checks
  if (isStaticOrBypassPath(reqPath)) {
    return next();
  }

  // 3. HTTP Method Validation
  const method = (req.method || '').toUpperCase();
  if (!ALLOWED_HTTP_METHODS.has(method)) {
    await securityLogger.log('WAF_INVALID_HTTP_METHOD', req, { method });
    return res.status(405).json({
      success: false,
      code: 'METHOD_NOT_ALLOWED',
      message: `HTTP Method ${method} is not permitted.`,
      correlationId: req.correlationId
    });
  }

  // 4. Scanner User-Agent Detection (in production or against sensitive endpoints)
  const userAgent = req.headers['user-agent'] || '';
  for (const scannerRegex of SCANNER_USER_AGENTS) {
    if (scannerRegex.test(userAgent)) {
      recordViolation(clientIp);
      await securityLogger.log('WAF_SCANNER_BLOCKED', req, {
        scanner: scannerRegex.toString(),
        userAgent
      });
      return res.status(403).json({
        success: false,
        code: 'FIREWALL_BLOCKED',
        message: 'Automated vulnerability scanner signature detected.',
        correlationId: req.correlationId
      });
    }
  }

  // 5. Deep inspection of URL path and query parameters
  try {
    const rawUrl = req.originalUrl || req.url || '';
    const urlViolation = inspectString(rawUrl, 'url');
    if (urlViolation) {
      recordViolation(clientIp);
      await securityLogger.log(`WAF_BLOCKED_${urlViolation.type}`, req, urlViolation);
      return res.status(403).json({
        success: false,
        code: 'FIREWALL_BLOCKED',
        message: 'Malicious request pattern detected in URL.',
        correlationId: req.correlationId
      });
    }

    if (req.query && typeof req.query === 'object') {
      const queryViolation = inspectObject(req.query);
      if (queryViolation) {
        recordViolation(clientIp);
        await securityLogger.log(`WAF_BLOCKED_${queryViolation.type}`, req, queryViolation);
        return res.status(403).json({
          success: false,
          code: 'FIREWALL_BLOCKED',
          message: 'Malicious parameter detected in query string.',
          correlationId: req.correlationId
        });
      }
    }

    // 6. Deep inspection of Request Body
    if (req.body && typeof req.body === 'object') {
      const bodyViolation = inspectObject(req.body);
      if (bodyViolation) {
        recordViolation(clientIp);
        await securityLogger.log(`WAF_BLOCKED_${bodyViolation.type}`, req, bodyViolation);
        return res.status(403).json({
          success: false,
          code: 'FIREWALL_BLOCKED',
          message: 'Malicious payload pattern detected in request body.',
          correlationId: req.correlationId
        });
      }
    }

    // 7. Custom Headers inspection (inspect for path traversal or command injection in custom headers)
    const customHeaderKeys = Object.keys(req.headers).filter(k => k.startsWith('x-'));
    for (const hKey of customHeaderKeys) {
      const hVal = req.headers[hKey];
      if (typeof hVal === 'string') {
        const headerViolation = inspectString(hVal, hKey);
        if (headerViolation) {
          recordViolation(clientIp);
          await securityLogger.log(`WAF_BLOCKED_${headerViolation.type}`, req, headerViolation);
          return res.status(403).json({
            success: false,
            code: 'FIREWALL_BLOCKED',
            message: 'Malicious value detected in HTTP request header.',
            correlationId: req.correlationId
          });
        }
      }
    }
  } catch (err) {
    // Fail-safe: log parsing errors without breaking legitimate requests
    console.warn('[WAF Engine Warning]', err.message);
  }

  // Request passed all firewall inspection layers cleanly
  next();
};

wafMiddleware.clearIpJail = clearIpJail;

module.exports = wafMiddleware;
