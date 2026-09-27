/**
 * Enterprise Rate Limiting Suite
 * Granular, role-aware, and endpoint-specific rate limiters.
 * Powered by Redis with automatic, transparent in-memory fallback.
 */

const { buildResilientLimiter, ipKeyGenerator } = require('../middleware/rateLimiterFactory');
const securityLogger = require('./securityLogger');

// Helper to generate key by User ID when authenticated, otherwise Client IP
const userOrIpKey = (req) => {
  if (req.user && req.user.id) {
    return `usr_${req.user.id}`;
  }
  return ipKeyGenerator(req);
};

// Handler for rate limit violations to log security audit event
const onLimitReached = (limiterName) => (req, res) => {
  securityLogger.log('RATE_LIMIT_EXCEEDED', req, {
    limiter: limiterName,
    ip: req.ip,
    path: req.originalUrl || req.path
  });
};

/**
 * 1. Authentication Rate Limiter
 * Protects login, verify, and password reset endpoints.
 * 15 attempts per 15 minutes per IP.
 */
const authRateLimiter = buildResilientLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    onLimitReached('AUTH_LIMITER')(req, res);
    res.status(429).json({
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Please wait 15 minutes before trying again.',
      correlationId: req.correlationId
    });
  }
});

/**
 * 2. Public Registration Rate Limiter
 * Protects public wedding and candidate registration submissions.
 * 25 submissions per 15 minutes per IP.
 */
const publicRegistrationRateLimiter = buildResilientLimiter({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    onLimitReached('PUBLIC_REGISTRATION_LIMITER')(req, res);
    res.status(429).json({
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many registrations submitted from this network. Please contact the store directly.',
      correlationId: req.correlationId
    });
  }
});

/**
 * 3. Public Tracking Rate Limiter
 * Protects public wedding status and registration lookup.
 * 40 queries per 15 minutes per IP.
 */
const publicTrackingRateLimiter = buildResilientLimiter({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    onLimitReached('PUBLIC_TRACKING_LIMITER')(req, res);
    res.status(429).json({
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many status inquiries. Please wait a few minutes before checking again.',
      correlationId: req.correlationId
    });
  }
});

/**
 * 4. Duplicate Check Rate Limiter
 * Prevents phone number harvesting / brute-force phone enumeration.
 * 35 queries per 15 minutes per IP.
 */
const duplicateCheckRateLimiter = buildResilientLimiter({
  windowMs: 15 * 60 * 1000,
  max: 35,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    onLimitReached('DUPLICATE_CHECK_LIMITER')(req, res);
    res.status(429).json({
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many verification requests. Please try again shortly.',
      correlationId: req.correlationId
    });
  }
});

/**
 * 5. Gemini AI Chat Rate Limiter
 * Protects AI inference endpoints against quota exhaustion.
 * 30 requests per minute per user/IP.
 */
const geminiRateLimiter = buildResilientLimiter({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    onLimitReached('GEMINI_CHAT_LIMITER')(req, res);
    res.status(429).json({
      success: false,
      code: 'AI_RATE_LIMIT_EXCEEDED',
      message: 'AI Assistant rate limit reached. Please wait a few moments before sending your next question.',
      correlationId: req.correlationId
    });
  }
});

/**
 * 6. File Upload Rate Limiter
 * Protects resume, photo, and document upload endpoints.
 * 30 uploads per 15 minutes per user/IP.
 */
const uploadRateLimiter = buildResilientLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    onLimitReached('FILE_UPLOAD_LIMITER')(req, res);
    res.status(429).json({
      success: false,
      code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
      message: 'Upload frequency limit reached. Please wait a few minutes before uploading more documents.',
      correlationId: req.correlationId
    });
  }
});

/**
 * 7. Kiosk PIN Verification Rate Limiter
 * Protects store PIN / kiosk access endpoints against brute-force guessing.
 * 15 attempts per 15 minutes per IP.
 */
const kioskPinRateLimiter = buildResilientLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    onLimitReached('KIOSK_PIN_LIMITER')(req, res);
    res.status(429).json({
      success: false,
      code: 'PIN_LIMIT_EXCEEDED',
      message: 'Too many invalid PIN attempts. Access locked for 15 minutes.',
      correlationId: req.correlationId
    });
  }
});

/**
 * 8. Sensitive Admin Action Limiter
 * Protects user management, system settings, and permission changes.
 * 150 operations per 5 minutes per user.
 */
const adminActionRateLimiter = buildResilientLimiter({
  windowMs: 5 * 60 * 1000,
  max: 150,
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    onLimitReached('ADMIN_ACTION_LIMITER')(req, res);
    res.status(429).json({
      success: false,
      code: 'ADMIN_LIMIT_EXCEEDED',
      message: 'Administrative request limit reached. Please pause for a moment.',
      correlationId: req.correlationId
    });
  }
});

/**
 * 9. Global API Rate Limiter
 * Broad boundary protection for general API requests across the system.
 * 2000 requests per 10 minutes per IP (generous for multi-user store networks).
 */
const globalApiRateLimiter = buildResilientLimiter({
  windowMs: 10 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const url = req.originalUrl || req.url || '';
    return (
      url.includes('/security/shield-status') ||
      url.includes('/health') ||
      url.includes('/db-status')
    );
  },
  handler: (req, res) => {
    onLimitReached('GLOBAL_API_LIMITER')(req, res);
    res.status(429).json({
      success: false,
      code: 'API_RATE_LIMIT_EXCEEDED',
      message: 'Too many API requests from this connection. Please try again in a few minutes.',
      correlationId: req.correlationId
    });
  }
});

module.exports = {
  authRateLimiter,
  publicRegistrationRateLimiter,
  publicTrackingRateLimiter,
  duplicateCheckRateLimiter,
  geminiRateLimiter,
  uploadRateLimiter,
  kioskPinRateLimiter,
  adminActionRateLimiter,
  globalApiRateLimiter
};
