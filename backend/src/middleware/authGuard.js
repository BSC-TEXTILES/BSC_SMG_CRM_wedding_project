/**
 * Centralized AuthGuard Middleware (Backend)
 * ─────────────────────────────────────────────
 * Enforces:
 * 1. Strict JWT validation on every request (tampered token, invalid signature, expired).
 * 2. Active account & session existence verification.
 * 3. Role-Based Access Control (RBAC) & permission matrix check.
 * 4. Suspicious activity tracking with auto-logout on repeated violations.
 */

const { authenticate, authorize, authorizeModule, authorizeLocationAccess } = require('./auth');
const { record403Violation } = require('./suspiciousActivityTracker');
const { errorRes } = require('../utils/response');

/**
 * Middleware: Requires active valid JWT session.
 * Rejects unauthenticated, expired, or tampered tokens with 401.
 */
const requireAuth = authenticate;

/**
 * Middleware: Requires specific role(s) to access endpoint.
 * If unauthorized, tracks 403 violation and forces logout if repeated.
 */
const requireRoles = (...roles) => {
  return async (req, res, next) => {
    // First ensure authentication
    await requireAuth(req, res, async () => {
      if (!req.user) {
        return errorRes(res, 'Authentication required', [], 401);
      }

      // Admin & Super Admin bypass role restriction
      if (['Admin', 'Super Admin'].includes(req.user.role)) {
        return next();
      }

      if (roles.includes(req.user.role)) {
        return next();
      }

      // User does not have authorized role
      const violation = record403Violation(
        req, 
        res, 
        `Role '${req.user.role}' attempted to access restricted endpoint requiring: [${roles.join(', ')}]`
      );

      const statusMsg = violation.forceLogout
        ? 'Session expired. Please log in again.'
        : `Forbidden: your role (${req.user.role}) does not have access to this resource.`;

      return res.status(403).json({
        success: false,
        message: statusMsg,
        forceLogout: violation.forceLogout,
        violationCount: violation.violationCount
      });
    });
  };
};

/**
 * Middleware: Enforces store location isolation (prevents cross-branch URL tampering).
 */
const requireLocationAccess = authorizeLocationAccess;

module.exports = {
  requireAuth,
  requireRoles,
  requireLocationAccess,
  record403Violation
};
