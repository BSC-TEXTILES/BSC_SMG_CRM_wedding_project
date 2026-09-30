const crypto = require('crypto');

const generateCsrfToken = () => crypto.randomBytes(32).toString('hex');

// Routes that don't require CSRF protection (public auth, landing, registration endpoints)
const CSRF_EXEMPT_PATHS = new Set([
  '/auth/captcha',
  '/auth/lock-status',
  '/auth/login',
  '/auth/refresh',
  '/auth/verify',
  '/auth/request-password-reset',
  '/auth/verify-password-reset-token',
  '/auth/reset-password',
  '/api/auth/captcha',
  '/api/auth/lock-status',
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/verify',
  '/api/auth/request-password-reset',
  '/api/auth/verify-password-reset-token',
  '/api/auth/reset-password',
  '/landing/locations',
  '/landing/enquiry',
  '/landing/event',
  '/api/landing/locations',
  '/api/landing/enquiry',
  '/api/landing/event',
  '/feedback-qr/scan',
  '/api/feedback-qr/scan',
  '/security/log-event',
  '/api/security/log-event',
  '/user-tracking/login',
  '/api/user-tracking/login',
  '/user-tracking/logout',
  '/api/user-tracking/logout',
  '/user-tracking/activity',
  '/api/user-tracking/activity',
  '/contact',
  '/api/contact',
  '/profile-site/contact',
  '/api/profile-site/contact',
  '/crm/verify-pin',
  '/api/crm/verify-pin'
]);

const csrfProtection = (req, res, next) => {
  // Allow safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Check if path is exempt from CSRF
  const path = req.path || '';
  const originalUrl = req.originalUrl ? req.originalUrl.split('?')[0] : '';
  if (
    CSRF_EXEMPT_PATHS.has(path) ||
    CSRF_EXEMPT_PATHS.has(originalUrl) ||
    path.startsWith('/feedback-qr/scan/') ||
    originalUrl.startsWith('/api/feedback-qr/scan/') ||
    path.includes('/wedding-registration/public/') ||
    originalUrl.includes('/wedding-registration/public/') ||
    path.includes('/public/') ||
    originalUrl.includes('/public/') ||
    path.startsWith('/v1/connect') ||
    originalUrl.startsWith('/api/v1/connect') ||
    (req.headers.authorization && (req.headers.authorization.startsWith('Bearer LIVE_') || req.headers.authorization.startsWith('Bearer TEST_')))
  ) {
    return next();
  }

  const tokenFromHeader = req.headers['x-csrf-token'];
  const tokenFromCookie = req.cookies['_csrf'];

  if (!tokenFromHeader || !tokenFromCookie || tokenFromHeader !== tokenFromCookie) {
    const err = new Error('Invalid CSRF token');
    err.code = 'CSRF_ERROR';
    return next(err);
  }

  next();
};

const setCsrfCookie = (req, res, next) => {
  if (!req.cookies['_csrf']) {
    const token = generateCsrfToken();
    res.cookie('_csrf', token, {
      httpOnly: false, // Must be readable by JS to send in x-csrf-token header (double-submit cookie pattern)
      // The CSRF token itself is not secret - it's a random value validated by the server
      // The authentication JWT is in a separate HttpOnly cookie
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/'
    });
  }
  next();
};

module.exports = {
  csrfProtection,
  setCsrfCookie
};
