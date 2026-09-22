/**
 * BSC Textiles Portal — Central Authorization Service
 * Single source of truth for permission resolution.
 *
 * Permission evaluation chain:
 *   Authentication → User active? → Role valid? → Location valid?
 *   → Module permission? → Action permission? → Resource-level restriction?
 *   → Allow/Deny
 */

const pool = require('../config/db');

// Roles that bypass module-level permission checks
const ADMIN_ROLES = ['Admin', 'Super Admin'];

// Valid permission actions
const VALID_ACTIONS = ['can_view', 'can_add', 'can_edit', 'can_delete', 'can_export', 'can_approve'];

/**
 * Full permission check — evaluates the entire authorization chain
 * @param {object} user - Decoded JWT user (req.user)
 * @param {object} options
 * @param {string} options.module - Module key (e.g., 'user_management')
 * @param {string} options.action - Action to check (e.g., 'can_edit')
 * @param {number} options.locationId - Target resource location ID (optional)
 * @returns {Promise<{allowed: boolean, reason: string}>}
 */
async function checkPermission(user, { module = null, action = 'can_view', locationId = null } = {}) {
  // 1. Authentication check
  if (!user || !user.id) {
    return { allowed: false, reason: 'Authentication required' };
  }

  // 2. User active check
  try {
    const [[dbUser]] = await pool.query(
      'SELECT id, active, role, location_id, locked_until FROM users WHERE id = ?',
      [user.id]
    );

    if (!dbUser) {
      return { allowed: false, reason: 'User account not found' };
    }

    if (!dbUser.active) {
      return { allowed: false, reason: 'User account is deactivated' };
    }

    // Check if account is locked
    if (dbUser.locked_until && new Date(dbUser.locked_until) > new Date()) {
      return { allowed: false, reason: 'Account is temporarily locked' };
    }
  } catch (err) {
    // If user table query fails, fall through to role-based check
    console.warn('[AuthzService] User status check failed:', err.message);
  }

  // 3. Role valid check
  const role = user.role;
  if (!role) {
    return { allowed: false, reason: 'No role assigned' };
  }

  // Admin/Super Admin bypass module-level checks
  if (ADMIN_ROLES.includes(role)) {
    return { allowed: true, reason: 'Admin role bypasses module checks' };
  }

  // 4. Location valid check
  if (locationId) {
    const locationAllowed = await checkLocationAccess(user, locationId);
    if (!locationAllowed) {
      return { allowed: false, reason: 'Location access denied' };
    }
  }

const ROLE_DEFAULT_MODULES = {
  'HR': ['dashboard', 'wedding_crm', 'wedding_registration', 'footfall', 'feedback_collection', 'feedback_list', 'feedback_qr',
         'divert', 'candidates', 'offer', 'openings', 'employees', 'dept_hiring', 'section_allocation',
         'broadcast', 'daily_mcheck', 'mcheck_reports', 'mcheck_history'],
  'Manager': ['dashboard', 'wedding_crm', 'wedding_registration', 'telecaller_desk', 'telecaller_dashboard', 'wedding_operations', 'footfall', 'feedback_collection', 'feedback_list', 'feedback_qr',
              'divert', 'candidates', 'offer', 'openings', 'employees', 'dept_hiring', 'section_allocation',
              'broadcast', 'daily_mcheck', 'mcheck_reports', 'mcheck_history'],
  'Telecaller': ['wedding_crm', 'telecaller_desk', 'telecaller_dashboard', 'wedding_registration'],
  'VM Extension Telecaller': ['wedding_crm', 'telecaller_desk', 'telecaller_dashboard', 'wedding_registration'],
  'CRM Executive': ['wedding_crm', 'telecaller_desk', 'telecaller_dashboard', 'wedding_registration', 'dashboard', 'footfall'],
  'CRM Manager': ['wedding_crm', 'telecaller_desk', 'telecaller_dashboard', 'wedding_registration', 'wedding_operations', 'dashboard', 'footfall', 'broadcast'],
  'Recruiter': ['dashboard', 'wedding_crm', 'candidates', 'broadcast'],
  'Interviewer': ['candidates'],
  'Employee': ['dashboard', 'wedding_crm', 'wedding_registration'],
  'Greeter': ['wedding_crm', 'wedding_registration', 'footfall', 'feedback_collection', 'feedback_list', 'feedback_qr', 'divert', 'tv', 'greeter'],
  'VM': ['vm_checklist', 'dashboard', 'footfall', 'broadcast'],
  'Guest': ['candidate_apply', 'feedback_public']
};

  // 5. Module + Action permission check
  if (module) {
    const safeAction = VALID_ACTIONS.includes(action) ? action : 'can_view';
    try {
      // Check if user has records in user_permissions
      const [allUserPerms] = await pool.query(
        'SELECT module, can_view, can_add, can_edit, can_delete, can_export, can_approve FROM user_permissions WHERE user_id = ?',
        [user.id]
      );

      if (allUserPerms && allUserPerms.length > 0) {
        // User has customized permissions from Admin Access Control Matrix
        let permRow = allUserPerms.find(p => p.module === module);

        // Check related aliases (e.g. wedding_registration grants wedding customer creation)
        if (!permRow && module === 'wedding_crm') {
          permRow = allUserPerms.find(p => p.module === 'wedding_registration' || p.module === 'telecaller_desk');
        }
        if (!permRow && module === 'wedding_registration') {
          permRow = allUserPerms.find(p => p.module === 'wedding_crm');
        }

        if (!permRow) {
          return { allowed: false, reason: `No permissions configured for module: ${module}` };
        }

        if (!permRow[safeAction]) {
          return { allowed: false, reason: `Action ${safeAction.replace('can_', '')} not permitted for module: ${module}` };
        }

        return { allowed: true, reason: 'Permission granted' };
      }

      // Fall back to role defaults if user has no custom matrix records
      const cleanRole = (role || '').trim().toLowerCase().replace(/[_\s-]+/g, ' ');
      const matchedRoleKey = Object.keys(ROLE_DEFAULT_MODULES).find(
        k => k.toLowerCase().replace(/[_\s-]+/g, ' ') === cleanRole
      );
      const roleModules = matchedRoleKey ? ROLE_DEFAULT_MODULES[matchedRoleKey] : (ROLE_DEFAULT_MODULES['Employee'] || []);

      if (!roleModules.includes(module)) {
        return { allowed: false, reason: `Role ${role} does not have access to module: ${module}` };
      }

      // If action is can_view, allow
      if (safeAction === 'can_view') {
        return { allowed: true, reason: 'Role default view permitted' };
      }

      // Check role default mutation rights
      if (['Manager', 'CRM Manager', 'Floor Manager'].includes(matchedRoleKey || '')) {
        return { allowed: true, reason: 'Manager mutation permitted' };
      }
      if (matchedRoleKey === 'HR' && safeAction !== 'can_delete') {
        return { allowed: true, reason: 'HR mutation permitted' };
      }
      if (['Telecaller', 'CRM Executive', 'VM Extension Telecaller'].includes(matchedRoleKey || '')) {
        if (['can_add', 'can_edit'].includes(safeAction)) {
          return { allowed: true, reason: 'Telecaller mutation permitted' };
        }
      }

      return { allowed: false, reason: `Action ${safeAction.replace('can_', '')} not permitted for role: ${role}` };
    } catch (err) {
      console.warn('[AuthzService] Permission check failed, falling back:', err.message);
      return { allowed: true, reason: 'Permission table unavailable, falling back to role-based access' };
    }
  }

  return { allowed: true, reason: 'Permission granted' };
}

const LOCATION_CODE_MAP = {
  'BEL': 1,
  'DAV': 2,
  'SHI': 3
};

/**
 * Check if user has access to a specific location
 * @param {object} user - Decoded JWT user
 * @param {number|string} targetLocation - Location ID or Code to check access for
 * @returns {Promise<boolean>}
 */
async function checkLocationAccess(user, targetLocation) {
  if (!user) return false;

  // Resolve code to numeric ID if string passed (e.g. 'DAV' -> 2)
  let targetLocationId = parseInt(targetLocation, 10);
  if (isNaN(targetLocationId) && typeof targetLocation === 'string') {
    targetLocationId = LOCATION_CODE_MAP[targetLocation.trim().toUpperCase()] || null;
  }

  if (!targetLocationId) return false;

  // Global admin (null locationId or isGlobalAdmin) has access to all locations
  if (!user.locationId || user.isGlobalAdmin || ['Admin', 'Super Admin'].includes(user.role)) {
    return true;
  }

  // Check token pre-loaded allowedLocations array
  if (Array.isArray(user.allowedLocations) && user.allowedLocations.length > 0) {
    if (user.allowedLocations.includes(targetLocationId)) {
      return true;
    }
  }

  // Check single primary location match
  if (user.locationId === targetLocationId) {
    return true;
  }

  // Check multi-location via user_locations table in DB
  try {
    const [rows] = await pool.query(
      'SELECT location_id FROM user_locations WHERE user_id = ?',
      [user.id]
    );
    if (rows.length > 0) {
      return rows.some(r => r.location_id === targetLocationId);
    }
  } catch (err) {
    // user_locations table doesn't exist — fall through
  }

  return false;
}

/**
 * Get all locations a user has access to
 * @param {object} user - Decoded JWT user
 * @returns {Promise<number[]>} Array of location IDs
 */
async function getUserLocations(user) {
  if (!user) return [];

  // Global admin gets all locations
  if (!user.locationId || user.isGlobalAdmin) {
    try {
      const [rows] = await pool.query('SELECT id FROM locations WHERE status = ?', ['Active']);
      return rows.map(r => r.id);
    } catch {
      return [];
    }
  }

  // Check multi-location via user_locations table
  try {
    const [rows] = await pool.query(
      'SELECT location_id FROM user_locations WHERE user_id = ?',
      [user.id]
    );
    if (rows.length > 0) {
      return rows.map(r => r.location_id);
    }
  } catch {
    // Fallback to single location
  }

  return user.locationId ? [user.locationId] : [];
}

/**
 * Get full permissions for a user
 * @param {object} user - Decoded JWT user
 * @returns {Promise<object[]>} Array of permission records
 */
async function getUserPermissions(user) {
  if (!user || !user.id) return [];

  // Admin roles have all permissions
  if (ADMIN_ROLES.includes(user.role)) {
    return [{ isAdmin: true, allPermissions: true }];
  }

  try {
    const [rows] = await pool.query(
      `SELECT module, can_view, can_add, can_edit, can_delete, can_export, can_approve
       FROM user_permissions WHERE user_id = ?`,
      [user.id]
    );
    return rows;
  } catch {
    return [];
  }
}

/**
 * Express middleware factory for module+action authorization
 * Usage: router.get('/api/users', authenticate, authorizeAction('user_management', 'can_view'), controller)
 */
function authorizeAction(moduleName, action = 'can_view') {
  return async (req, res, next) => {
    const result = await checkPermission(req.user, { module: moduleName, action });
    if (!result.allowed) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
        errors: [result.reason]
      });
    }
    next();
  };
}

/**
 * Express middleware factory for location authorization
 * Checks that the user can access the location specified in the request
 * The locationId can be in req.params.locationId, req.body.locationId, or req.query.locationId
 */
function authorizeLocationAccess(paramName = 'locationId') {
  return async (req, res, next) => {
    const rawVal = req.params[paramName] 
      || req.params['location_id']
      || req.body[paramName] 
      || req.body['location_id']
      || req.body['locationId']
      || req.query[paramName]
      || req.query['location_id']
      || req.query['locationId']
      || req.headers['x-location-id'];

    const isGlobal = !req.user?.locationId || req.user?.isGlobalAdmin || ['Admin', 'Super Admin'].includes(req.user?.role);

    if (rawVal === undefined || rawVal === null || rawVal === '') {
      return next(); // No specific location specified — let the controller handle filtering
    }

    if (String(rawVal).trim().toLowerCase() === 'all') {
      if (isGlobal) return next();
      return res.status(403).json({
        success: false,
        error: {
          code: 'LOCATION_ACCESS_DENIED',
          message: 'Access denied: You are restricted to your assigned store location.',
          details: { requestedLocation: rawVal }
        },
        message: 'Access denied: You are restricted to your assigned store location.',
        errors: ['Single-location accounts cannot access All Locations data.']
      });
    }

    // Public / unauthenticated requests (e.g., customer feedback submission) are not scoped to a logged-in user
    if (!req.user || !req.user.id || req.user.role === 'Guest' || req.user.id === 'anonymous') {
      return next();
    }

    const allowed = await checkLocationAccess(req.user, rawVal);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'LOCATION_ACCESS_DENIED',
          message: 'Access denied: you do not have permission to access data for this location',
          details: { requestedLocation: rawVal }
        },
        message: 'Access denied: you do not have permission to access data for this location',
        errors: ['You do not have permission to access data for this location']
      });
    }

    next();
  };
}

module.exports = {
  checkPermission,
  checkLocationAccess,
  getUserLocations,
  getUserPermissions,
  authorizeAction,
  authorizeLocationAccess,
  ADMIN_ROLES,
  VALID_ACTIONS
};
