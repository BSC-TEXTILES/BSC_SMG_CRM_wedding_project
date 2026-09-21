const { buildResilientLimiter, ipKeyGenerator } = require('./rateLimiterFactory');

// Helper to extract a unique identifier (User ID if logged in, otherwise client IP)
const keyGenerator = (req) => {
  if (req.user && req.user.id) {
    return `user_${req.user.id}`;
  }
  // Safe IPv4 / IPv6 fallback
  return ipKeyGenerator(req);
};

// Telecaller Queue Limiter (60 requests per minute per user)
const telecallerQueueLimiter = buildResilientLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per user
  keyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    success: false, 
    message: 'Rate limit exceeded for telecaller queue. Please wait a moment.', 
    errors: [] 
  }
});

// General Internal Dashboard Limiter (120 requests per minute per user)
const dashboardLimiter = buildResilientLimiter({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    success: false, 
    message: 'Too many dashboard requests. Please try again later.', 
    errors: [] 
  }
});

module.exports = {
  telecallerQueueLimiter,
  dashboardLimiter,
  keyGenerator
};
