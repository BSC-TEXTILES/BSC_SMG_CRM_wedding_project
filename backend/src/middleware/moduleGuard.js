'use strict';

/**
 * moduleGuard — module-scoped RBAC middleware built on the same enforcement
 * chain used everywhere else (admin bypass → Access Control Matrix → role defaults).
 *
 * Differences from authorizeAction():
 *   • records every denial in the security audit log via record403Violation
 *   • returns the standard errorRes payload so the UI can show a real message
 *   • triggers the force-logout (X-Force-Logout) header when the violation
 *     threshold is reached, which the frontend interceptor turns into an
 *     immediate logout.
 */

const { checkPermission } = require('../services/authorizationService');
const { record403Violation } = require('./suspiciousActivityTracker');
const { errorRes } = require('../utils/response');

const requireModuleAction = (moduleName, action = 'can_view') => {
  return async (req, res, next) => {
    if (!req.user || !req.user.id) {
      return errorRes(res, 'Authentication required', [], 401);
    }

    try {
      const result = await checkPermission(req.user, { module: moduleName, action });

      if (result.allowed) {
        return next();
      }

      const violation = record403Violation(
        req,
        res,
        `Denied ${action} on ${moduleName}: ${result.reason}`
      );

      if (violation && violation.forceLogout) {
        return res.status(403).json({
          success: false,
          message: violation.message,
          errors: ['Session terminated after repeated unauthorized attempts'],
          forceLogout: true
        });
      }

      return errorRes(
        res,
        `Access denied: ${result.reason || 'you do not have permission for this module'}`,
        [`${moduleName}:${action}`],
        403
      );
    } catch (err) {
      console.error('[moduleGuard] Permission check failed:', err.message);
      return errorRes(res, 'Permission check failed. Please try again.', [], 500);
    }
  };
};

module.exports = { requireModuleAction };
