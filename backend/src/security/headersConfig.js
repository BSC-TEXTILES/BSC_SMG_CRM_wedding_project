/**
 * Production Security Headers Configuration
 * Comprehensive HTTP response headers defending against clickjacking,
 * MIME sniffing, protocol downgrades, and Cross-Site Scripting (XSS).
 */

const helmet = require('helmet');

const isProduction = process.env.NODE_ENV === 'production';

const helmetSecurityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://www.gstatic.com", "https://www.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://www.gstatic.com"],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https://images.unsplash.com",
        "https://*.googleusercontent.com",
        "https://www.gstatic.com"
      ],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      connectSrc: [
        "'self'",
        "ws:",
        "wss:",
        "https://www.googleapis.com",
        "https://generativelanguage.googleapis.com"
      ],
      mediaSrc: ["'self'", "data:", "blob:"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: isProduction ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  hsts: isProduction ? {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  } : false,
  noSniff: true,
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
});

/**
 * Extended headers middleware:
 * - Permissions-Policy (disables unneeded hardware features)
 * - Cache-Control for sensitive API routes
 */
const extendedSecurityHeaders = (req, res, next) => {
  // Prevent clickjacking & framing
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent browser feature abuse
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');

  // No-cache for sensitive administrative & auth routes
  const path = req.path || '';
  if (
    path.startsWith('/api/auth') ||
    path.startsWith('/api/admin') ||
    path.startsWith('/api/security') ||
    path.startsWith('/security')
  ) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  next();
};

module.exports = {
  helmetSecurityHeaders,
  extendedSecurityHeaders
};
