const rateLimit = require('express-rate-limit');

// Helper to extract a unique identifier (User ID if logged in, otherwise IP)
const keyGenerator = (req) => {
  if (req.user && req.user.id) {
    return `user_${req.user.id}`;
  }
  // Fallback to IP address for unauthenticated or malformed requests
  return req.ip;
};

// Telecaller Queue Limiter (60 requests per minute per user)
const telecallerQueueLimiter = rateLimit({
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
const dashboardLimiter = rateLimit({
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
