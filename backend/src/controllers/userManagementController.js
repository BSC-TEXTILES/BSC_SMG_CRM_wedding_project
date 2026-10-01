const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { successRes, errorRes } = require('../utils/response');
const { logAction } = require('../utils/logger');
const userSyncService = require('../services/userSyncService');
const authorizationService = require('../services/authorizationService');
const { invalidateUserStatusCache } = require('../middleware/auth');
const realtimeService = require('../services/realtimeService');
const { encryptField, decryptField } = require('../utils/crypto');
const userValidator = require('../validators/userValidator');
const {
  EMPLOYEE_CSV_HEADERS,
  EMPLOYEE_CSV_MAX_ROWS,
  EMPLOYEE_CSV_MAX_BYTES,
  EMPLOYEE_CSV_INVALID_FORMAT_MESSAGE,
  parseCsv,
  isEmptyRow,
  validateHeaderRow,
  rowToBody,
  buildSampleCsv,
  looksBinary
} = require('../utils/employeeCsv');

function _isGlobalAdminUser(user) {
  if (!user) return false;
  const isAdminRole = ['Admin', 'Super Admin'].includes(user.role);
  return user.role === 'Super Admin' || (isAdminRole && (!user.locationId || user.isGlobalAdmin === true));
}

/**
 * Parses the `id:name` pairs produced by GROUP_CONCAT in listUsers.
 * A single aggregate is used (instead of two parallel GROUP_CONCATs) because
 * DISTINCT aggregates are not guaranteed to be ordered identically — pairing
 * them positionally could show location A's name against location B's id.
 */
function _parseLocationPairs(pairs, row = {}) {
  if (pairs) {
    return String(pairs)
      .split(',')
      .map(pair => {
        const idx = pair.indexOf(':');
        const id = Number(idx === -1 ? pair : pair.slice(0, idx));
        const name = idx === -1 ? null : (pair.slice(idx + 1) || null);
        return { id, name };
      })
      .filter(l => Number.isFinite(l.id) && l.id > 0);
  }
  // Fallback: no user_locations rows — derive from the single location_id
  if (row.location_id) {
    return [{ id: row.location_id, name: row.location_name || null }];
  }
  return [];
}

/**
 * Assigned locations must be real store locations from the `locations` table.
 * Rejects non-numeric ids, empty selections, and ids that do not exist.
 * Returns { ok, ids } — ids are the cleaned unique integers when ok.
 */
async function _validateAssignedLocations(locationIds) {
  if (!Array.isArray(locationIds) || locationIds.length === 0) {
    return { ok: false, ids: [] };
  }
  const ids = locationIds.map(Number);
  if (ids.some(id => !Number.isInteger(id) || id <= 0)) {
    return { ok: false, ids: [] };
  }
  const unique = [...new Set(ids)];
  const placeholders = unique.map(() => '?').join(',');
  const [rows] = await db.query(`SELECT id FROM locations WHERE id IN (${placeholders})`, unique);
  const found = new Set(rows.map(r => Number(r.id)));
  const allValid = unique.every(id => found.has(id));
  return { ok: allValid && unique.length > 0, ids: allValid ? unique : [] };
}

const MODULE_REGISTRY = [
  { key: 'dashboard', label: 'Dashboard', section: 'Enterprise' },
  { key: 'wedding_crm', label: 'Wedding CRM', section: 'Store Operations' },
  { key: 'wedding_registration', label: 'Wedding Customer Registration', section: 'Store Operations' },
  { key: 'telecaller_desk', label: 'Telecaller Calling Desk', section: 'Store Operations' },
  { key: 'telecaller_dashboard', label: 'Telecaller Dashboard', section: 'Store Operations' },
  { key: 'wedding_operations', label: 'Wedding Operations', section: 'Store Operations' },
  { key: 'footfall', label: 'Hourly Footfall', section: 'Store Operations' },
  { key: 'feedback_collection', label: 'Feedback Collection', section: 'Store Operations' },
  { key: 'feedback_list', label: 'Feedback Call Queue', section: 'Store Operations' },
  { key: 'feedback_qr', label: 'Feedback QR Code', section: 'Store Operations' },
  { key: 'divert', label: 'Sourcing Diverts', section: 'Store Operations' },
  { key: 'pm_view', label: 'Purchase Manager View', section: 'Store Operations' },
  { key: 'vm_checklist', label: 'VM Checklist', section: 'Store Operations' },
  { key: 'attendance', label: 'Attendance & Roster', section: 'Store Operations' },
  { key: 'candidates', label: 'Candidate CRM', section: 'Talent' },
  { key: 'offer', label: 'Offer Desk', section: 'Talent' },
  { key: 'openings', label: 'Manpower Planning', section: 'Talent' },
  { key: 'employees', label: 'Employee Directory', section: 'Enterprise' },
  { key: 'dept_hiring', label: 'Department Hiring Status', section: 'Talent' },
  { key: 'section_allocation', label: 'Section Allocation', section: 'Talent' },
  { key: 'batch_plan', label: 'Batch Plan', section: 'Daily Operations' },
  { key: 'doj_desk', label: 'DOJ Not Joined Desk', section: 'Talent' },
  { key: 'joining_desk', label: 'Store Joining Desk', section: 'Talent' },
  { key: 'regional_analytics', label: 'Regional Analytics', section: 'Enterprise' },
  { key: 'broadcast', label: 'Broadcast Center', section: 'Administration' },
  { key: 'settings', label: 'System Settings', section: 'Administration' },
  { key: 'daily_mcheck', label: 'Daily MCheck', section: 'Daily Operations' },
  { key: 'mcheck_reports', label: 'MCheck Reports', section: 'Daily Operations' },
  { key: 'mcheck_history', label: 'MCheck History', section: 'Daily Operations' },
  { key: 'mcheck_audit', label: 'MCheck Store Audit', section: 'Daily Operations' },
  { key: 'greyhr', label: 'GreyHR Sync', section: 'Enterprise' },
  { key: 'user_management', label: 'User Management', section: 'Administration' },
  { key: 'system_admin', label: 'System Administrator', section: 'Administration' },
  { key: 'candidate_apply', label: 'Job Applicant Registration', section: 'Public Portals' },
  { key: 'greeter', label: 'Greeter Kiosk', section: 'Public Portals' },
  { key: 'tv', label: 'Live TV Kiosk', section: 'Public Portals' },
  { key: 'feedback_public', label: 'Customer Feedback QR', section: 'Public Portals' }
];

// ── List all users with their permission counts ───────────────────
const listUsers = async (req, res) => {
  try {
    // Auto-reactivate accounts whose temporary deactivation has expired
    try {
      await db.query(`
        UPDATE users 
        SET active = 1, deactivated_until = NULL, deactivation_reason = NULL
        WHERE active = 0 AND deactivated_until IS NOT NULL AND deactivated_until <= NOW()
      `);
    } catch (autoReactivateErr) {
      console.warn('[UserMgmt] Auto-reactivation check:', autoReactivateErr.message);
    }

    const isGlobal = _isGlobalAdminUser(req.user);
    let locWhere = '';
    const queryParams = [];
    if (!isGlobal && req.user) {
      const allowed = req.user?.allowedLocations?.length ? req.user.allowedLocations : (req.user?.locationId ? [req.user.locationId] : []);
      if (allowed.length > 0) {
        locWhere = ' WHERE (u.location_id IN (?) OR EXISTS (SELECT 1 FROM user_locations ulx WHERE ulx.user_id = u.id AND ulx.location_id IN (?))) ';
        queryParams.push(allowed, allowed);
      } else {
        locWhere = ' WHERE 1 = 0 ';
      }
    }

    const [rawUsers] = await db.query(`
      SELECT
        u.id, u.username, u.password, u.full_name AS fullName, u.email, u.phone,
        u.employee_id AS employeeId,
        u.department, u.designation, u.role, u.active,
        u.deactivated_until, u.deactivation_reason,
        u.location_id, u.location_code, u.max_modules,
        u.last_login_at, u.created_at, u.updated_at,
        l.location_name,
        GROUP_CONCAT(DISTINCT CONCAT(ul.location_id, ':', COALESCE(l2.location_name, ''))) AS assigned_location_pairs
      FROM users u
      LEFT JOIN locations l ON l.id = u.location_id
      LEFT JOIN user_locations ul ON ul.user_id = u.id
      LEFT JOIN locations l2 ON l2.id = ul.location_id
      ${locWhere}
      GROUP BY u.id
      ORDER BY u.created_at ASC
    `, queryParams);

    // Every stored matrix row, so the list can tell an explicitly configured
    // account apart from one that is still running on its role defaults.
    let permissionRows = [];
    try {
      const [rows] = await db.query('SELECT user_id, module, can_view FROM user_permissions');
      permissionRows = rows;
    } catch (permErr) {
      console.warn('[UserMgmt] user_permissions unreadable:', permErr.message);
    }

    const permsByUser = new Map();
    for (const row of permissionRows) {
      if (!permsByUser.has(row.user_id)) permsByUser.set(row.user_id, []);
      permsByUser.get(row.user_id).push(row);
    }

    const users = rawUsers.map(u => {
      const { assigned_location_pairs, ...rest } = u;
      const storedRows = permsByUser.get(rest.id) || [];
      const explicitKeys = storedRows.filter(r => r.can_view).map(r => r.module);

      // Role-default accounts still receive the modules their role grants —
      // authorizationService falls back to them whenever no rows exist, so the
      // count shown here must match what is actually enforced.
      const permission_source = userSyncService.ADMIN_ROLES.includes(rest.role)
        ? 'bypass'
        : (storedRows.length > 0 ? 'custom' : 'role_default');
      const module_keys = permission_source === 'role_default'
        ? authorizationService.resolveRoleDefaultPermissions(rest.role).map(p => p.module)
        : explicitKeys;

      return {
        ...rest,
        modules_assigned: module_keys.length,
        permission_source,
        module_keys,
        password: decryptField(rest.password),
        assigned_locations: _parseLocationPairs(assigned_location_pairs, rest)
      };
    });

    return successRes(res, { users }, 'Users retrieved');
  } catch (err) {
    // Fallback if user_permissions table doesn't exist yet
    try {
      const isGlobal = _isGlobalAdminUser(req.user);
      let locWhere = '';
      const queryParams = [];
      if (!isGlobal && req.user) {
        const allowed = req.user?.allowedLocations?.length ? req.user.allowedLocations : (req.user?.locationId ? [req.user.locationId] : []);
        if (allowed.length > 0) {
          locWhere = ' WHERE (u.location_id IN (?) OR EXISTS (SELECT 1 FROM user_locations ulx WHERE ulx.user_id = u.id AND ulx.location_id IN (?))) ';
          queryParams.push(allowed, allowed);
        } else {
          locWhere = ' WHERE 1 = 0 ';
        }
      }

      const [rawUsers] = await db.query(`
        SELECT
          u.id, u.username, u.password, u.full_name AS fullName, u.email, u.phone,
          u.employee_id AS employeeId,
          u.department, u.designation, u.role, u.active,
          u.location_id, u.location_code,
          u.last_login_at, u.created_at,
          l.location_name,
          GROUP_CONCAT(DISTINCT CONCAT(ul.location_id, ':', COALESCE(l2.location_name, ''))) AS assigned_location_pairs
        FROM users u
        LEFT JOIN locations l ON l.id = u.location_id
        LEFT JOIN user_locations ul ON ul.user_id = u.id
        LEFT JOIN locations l2 ON l2.id = ul.location_id
        ${locWhere}
        GROUP BY u.id
        ORDER BY u.created_at ASC
      `, queryParams);

      const users = rawUsers.map(u => {
        const { assigned_location_pairs, ...rest } = u;
        const permission_source = userSyncService.ADMIN_ROLES.includes(rest.role) ? 'bypass' : 'role_default';
        const module_keys = permission_source === 'bypass'
          ? []
          : authorizationService.resolveRoleDefaultPermissions(rest.role).map(p => p.module);
        return {
          ...rest,
          modules_assigned: permission_source === 'bypass' ? 0 : module_keys.length,
          permission_source,
          module_keys,
          password: decryptField(rest.password),
          assigned_locations: _parseLocationPairs(assigned_location_pairs, rest)
        };
      });

      return successRes(res, { users }, 'Users retrieved (no permissions table yet)');
    } catch (fallbackErr) {
      return errorRes(res, 'Failed to retrieve users', [fallbackErr.message], 500);
    }
  }
};

// ── Get a single user with full details ───────────────────────────
const getUser = async (req, res) => {
  try {
    const { id } = req.params;
    const [[user]] = await db.query(`
      SELECT
        u.id, u.username, u.password, u.full_name AS fullName, u.email, u.phone,
        u.employee_id AS employeeId,
        u.department, u.designation, u.role, u.active,
        u.deactivated_until, u.deactivation_reason,
        u.location_id, u.location_code, u.max_modules,
        u.last_login_at, u.created_at, u.updated_at,
        l.location_name
      FROM users u
      LEFT JOIN locations l ON l.id = u.location_id
      WHERE u.id = ?
    `, [id]);

    if (!user) {
      return errorRes(res, 'User not found', [], 404);
    }

    const isGlobal = _isGlobalAdminUser(req.user);
    if (!isGlobal && req.user) {
      const allowed = req.user?.allowedLocations?.length ? req.user.allowedLocations : (req.user?.locationId ? [req.user.locationId] : []);
      const [userLocs] = await db.query('SELECT location_id FROM user_locations WHERE user_id = ?', [id]);
      const targetLocs = [user.location_id, ...userLocs.map(l => l.location_id)].filter(Boolean);
      const hasOverlap = targetLocs.some(l => allowed.includes(Number(l)));
      if (!hasOverlap) {
        return errorRes(res, 'You do not have permission to view users in this location.', [], 403);
      }
    }

    user.password = decryptField(user.password);

    // Fetch assigned locations from user_locations
    let assignedLocations = [];
    try {
      const [locs] = await db.query(
        `SELECT ul.location_id AS id, l.location_name AS name
         FROM user_locations ul
         LEFT JOIN locations l ON l.id = ul.location_id
         WHERE ul.user_id = ?`,
        [id]
      );
      assignedLocations = locs;
    } catch (e) {
      // user_locations table may not exist yet — fall back to single location
      if (user.location_id) {
        assignedLocations = [{ id: user.location_id, name: user.location_name }];
      }
    }
    if (assignedLocations.length === 0 && user.location_id) {
      assignedLocations = [{ id: user.location_id, name: user.location_name }];
    }
    user.assigned_locations = assignedLocations;

    // Get permissions
    let permissions = [];
    try {
      const [perms] = await db.query(
        `SELECT module, can_view, can_add, can_edit, can_delete, can_export, can_approve, granted_by, granted_at
         FROM user_permissions WHERE user_id = ?`,
        [id]
      );
      permissions = perms;
    } catch (e) {
      // user_permissions table may not exist yet
    }

    // Get recent audit logs for this user
    let recentActivity = [];
    try {
      const [logs] = await db.query(
        `SELECT action, module, details, ip_address, created_at
         FROM audit_logs WHERE username = ? ORDER BY created_at DESC LIMIT 50`,
        [user.username]
      );
      recentActivity = logs;
    } catch (e) {}

    return successRes(res, { user, permissions, recentActivity }, 'User details retrieved');
  } catch (err) {
    return errorRes(res, 'Failed to retrieve user', [err.message], 500);
  }
};

// ── Create a new user ─────────────────────────────────────────────
const createUser = async (req, res) => {
  try {
    const { username, password, role, fullName, email, phone, department, designation,
            employeeId, section, joiningDate, locationId, locationIds, allLocations, maxModules, permissions } = req.body;

    if (!username || !password || !role) {
      return errorRes(res, 'Username, password, and role are required', [], 400);
    }
    if (password.length < 6) {
      return errorRes(res, 'Password must be at least 6 characters', [], 400);
    }

    // ── Uniqueness checks (no duplicate accounts may ever exist) ─────
    const [existing] = await db.query(`SELECT id FROM users WHERE LOWER(username) = ?`, [username.trim().toLowerCase()]);
    if (existing.length > 0) {
      return errorRes(res, 'Username already exists', [], 409);
    }

    if (email) {
      const [dupEmail] = await db.query(`SELECT id FROM users WHERE email = ? AND email IS NOT NULL`, [String(email).trim()]);
      if (dupEmail.length > 0) {
        return errorRes(res, 'A user with this email address already exists', [], 409);
      }
    }

    const cleanEmployeeId = employeeId ? String(employeeId).trim() : null;
    if (cleanEmployeeId) {
      const [dupEmp] = await db.query(`SELECT id FROM users WHERE employee_id = ?`, [cleanEmployeeId]);
      if (dupEmp.length > 0) {
        return errorRes(res, 'This Employee ID is already assigned to another user', [], 409);
      }
    }

    const isGlobal = _isGlobalAdminUser(req.user);
    if (!isGlobal && req.user) {
      if (allLocations) {
        return errorRes(res, 'You do not have permission to create global users.', [], 403);
      }
      const allowed = req.user?.allowedLocations?.length ? req.user.allowedLocations : (req.user?.locationId ? [req.user.locationId] : []);
      if (Array.isArray(locationIds) && locationIds.length > 0) {
        const outOfScope = locationIds.some(lid => !allowed.includes(Number(lid)));
        if (outOfScope) {
          return errorRes(res, 'You do not have permission to assign users to this location.', [], 403);
        }
      } else if (locationId && !allowed.includes(Number(locationId))) {
        return errorRes(res, 'You do not have permission to assign users to this location.', [], 403);
      }
    }

    // Location scope: explicit allLocations=true grants global access (NULL
    // location). Otherwise the user is pinned to a single store location.
    const wantsAllLocations = isGlobal && allLocations === true;
    const isGlobalRole = isGlobal && (role === 'Admin' || 'Super Admin' === role);
    const defaultStoreId = req.user?.locationId || 2;
    const resolvedLocationId = wantsAllLocations
      ? null
      : (locationId || (isGlobalRole ? null : defaultStoreId));

    // ── Assigned locations must be valid actual store locations ─────
    if (Array.isArray(locationIds) && locationIds.length > 0) {
      const check = await _validateAssignedLocations(locationIds);
      if (!check.ok) {
        return errorRes(res, 'Assigned locations must be valid actual store locations', [], 400);
      }
    } else if (!wantsAllLocations && locationId) {
      const check = await _validateAssignedLocations([locationId]);
      if (!check.ok) {
        return errorRes(res, 'Assigned location must be a valid actual store location', [], 400);
      }
    }

    return _insertUser(req, res, { username, password, role, fullName, email, phone, department, designation,
                                     employeeId: cleanEmployeeId, section, joiningDate,
                                     resolvedLocationId, locationIds, allLocations: wantsAllLocations, maxModules, permissions });
  } catch (err) {
    return errorRes(res, 'Failed to create user', [err.message], 500);
  }
};

// Shared insert used by createUser for all location-scope combinations
async function _insertUser(req, res, { username, password, role, fullName, email, phone, department, designation,
                                        employeeId, section, joiningDate,
                                        resolvedLocationId, locationIds, allLocations, maxModules, permissions }) {
  try {
    // Get location_code
    let locationCode = null;
    if (resolvedLocationId) {
      try {
        const [[loc]] = await db.query(`SELECT location_code FROM locations WHERE id = ?`, [resolvedLocationId]);
        locationCode = loc ? loc.location_code : 'DAV';
      } catch (e) {
        locationCode = resolvedLocationId === 1 ? 'BEL' : resolvedLocationId === 3 ? 'SHI' : 'DAV';
      }
    }

    const cleanPassword = password.trim();
    const encryptedPassword = encryptField(cleanPassword);

    const [result] = await db.query(
      `INSERT INTO users (username, password, role, full_name, email, phone, department, designation,
                          employee_id, section, joining_date, active, location_id, location_code, max_modules)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?, ?)`,
      [username.trim(), encryptedPassword, role, fullName || role, email || null, phone || null,
       department || null, designation || null, employeeId || null,
       section || null, joiningDate || null,
       resolvedLocationId, locationCode, maxModules || null]
    );

    const newUserId = result.insertId;

    // ── Employee ID is part of the account contract: every dashboard shows it,
    // ── so it can never be left empty.
    const finalEmployeeId = employeeId
      || await userSyncService.ensureEmployeeId(newUserId);

    // ── Multi-location: insert into user_locations ──────────────────
    const wantsAllLocations = allLocations === true;
    if (!wantsAllLocations && Array.isArray(locationIds) && locationIds.length > 0) {
      for (const locId of locationIds) {
        try {
          await db.query(
            `INSERT INTO user_locations (user_id, location_id) VALUES (?, ?)`,
            [newUserId, locId]
          );
        } catch (e) {
          console.warn('[UserMgmt] user_locations insert warning:', e.message);
        }
      }
    } else if (!wantsAllLocations && !locationIds && resolvedLocationId) {
      // Single locationId provided — insert that one into user_locations
      try {
        await db.query(
          `INSERT INTO user_locations (user_id, location_id) VALUES (?, ?)`,
          [newUserId, resolvedLocationId]
        );
      } catch (e) {
        console.warn('[UserMgmt] user_locations insert warning:', e.message);
      }
    }
    // If wantsAllLocations is true, do NOT insert into user_locations
    // (NULL location_id on users table signals global access)

    // Save permissions if provided
    if (permissions && Array.isArray(permissions) && permissions.length > 0) {
      const grantedBy = req.user ? req.user.username : 'Admin';
      for (const perm of permissions) {
        try {
          await db.query(
            `INSERT INTO user_permissions (user_id, module, can_view, can_add, can_edit, can_delete, can_export, can_approve, granted_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE can_view=VALUES(can_view), can_add=VALUES(can_add), can_edit=VALUES(can_edit),
               can_delete=VALUES(can_delete), can_export=VALUES(can_export), can_approve=VALUES(can_approve), granted_by=VALUES(granted_by)`,
            [newUserId, perm.module, !!perm.can_view, !!perm.can_add, !!perm.can_edit,
             !!perm.can_delete, !!perm.can_export, !!perm.can_approve, grantedBy]
          );
        } catch (e) {
          console.warn('[UserMgmt] Permission insert warning:', e.message);
        }
      }
    } else {
      // No "Initial Module Access" selected — grant exactly what the role
      // implies so navigation and the permissions matrix agree from day one.
      await userSyncService.seedRoleDefaultPermissions(
        newUserId, role, req.user ? req.user.username : 'Admin'
      );
    }

    await _audit(req, 'CREATE_USER', { username, role, employeeId: finalEmployeeId,
                                        locationId: resolvedLocationId,
                                        allLocations: wantsAllLocations, locationIds });

    realtimeService.emitUserChange('CREATE', {
      id: newUserId,
      username,
      role,
      employeeId: finalEmployeeId,
      locationId: resolvedLocationId,
      active: true
    });

    return successRes(res, { id: newUserId, username, employeeId: finalEmployeeId }, 'User created successfully');
  } catch (err) {
    return errorRes(res, 'Failed to create user', [err.message], 500);
  }
}

// ── Update an existing user ───────────────────────────────────────
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, phone, department, designation, role, employeeId,
            section, joiningDate,
            locationId, locationIds, allLocations, maxModules, active } = req.body;

    // Check user exists
    const [[user]] = await db.query(`SELECT id, username, role as prevRole, location_id FROM users WHERE id = ?`, [id]);
    if (!user) {
      return errorRes(res, 'User not found', [], 404);
    }

    const isGlobal = _isGlobalAdminUser(req.user);
    if (!isGlobal && req.user) {
      const allowed = req.user?.allowedLocations?.length ? req.user.allowedLocations : (req.user?.locationId ? [req.user.locationId] : []);
      const [userLocs] = await db.query('SELECT location_id FROM user_locations WHERE user_id = ?', [id]);
      const targetLocs = [user.location_id, ...userLocs.map(l => l.location_id)].filter(Boolean);
      const hasOverlap = targetLocs.some(l => allowed.includes(Number(l)));
      if (!hasOverlap) {
        return errorRes(res, 'You do not have permission to modify users in this location.', [], 403);
      }
      if (allLocations) {
        return errorRes(res, 'You do not have permission to grant All Locations access.', [], 403);
      }
      if (Array.isArray(locationIds) && locationIds.length > 0) {
        const outOfScope = locationIds.some(lid => !allowed.includes(Number(lid)));
        if (outOfScope) {
          return errorRes(res, 'You do not have permission to assign users to this location.', [], 403);
        }
      } else if (locationId && !allowed.includes(Number(locationId))) {
        return errorRes(res, 'You do not have permission to assign users to this location.', [], 403);
      }
    }

    const updates = [];
    const params = [];

    if (fullName !== undefined) { updates.push('full_name = ?'); params.push(fullName); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email || null); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone || null); }
    if (department !== undefined) { updates.push('department = ?'); params.push(department || null); }
    if (designation !== undefined) { updates.push('designation = ?'); params.push(designation || null); }
    if (role !== undefined) { updates.push('role = ?'); params.push(role); }
    if (active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0); }
    if (maxModules !== undefined) { updates.push('max_modules = ?'); params.push(maxModules); }
    if (section !== undefined) { updates.push('section = ?'); params.push(section || null); }
    if (joiningDate !== undefined) { updates.push('joining_date = ?'); params.push(joiningDate || null); }
    if (req.body.password && String(req.body.password).trim().length >= 6) {
      updates.push('password = ?');
      params.push(encryptField(String(req.body.password).trim()));
    }

    // Employee ID is unique — reject a value already owned by someone else
    if (employeeId !== undefined) {
      const cleanEmployeeId = employeeId ? String(employeeId).trim() : null;
      if (cleanEmployeeId) {
        const [dupEmp] = await db.query(`SELECT id FROM users WHERE employee_id = ? AND id != ?`, [cleanEmployeeId, id]);
        if (dupEmp.length > 0) {
          return errorRes(res, 'This Employee ID is already assigned to another user', [], 409);
        }
        updates.push('employee_id = ?');
        params.push(cleanEmployeeId);
      }
    }

    // Location scope. `locationIds` alone must also update the primary
    // location column — otherwise the account would keep its old store in
    // `users.location_id` while user_locations says otherwise and login,
    // location dashboards and the user list would disagree.
    const hasLocationIds = Array.isArray(locationIds) && locationIds.length > 0;
    const scopeProvided = allLocations !== undefined || locationId !== undefined || hasLocationIds;

    // ── Assigned locations must be valid actual store locations ─────
    if (hasLocationIds) {
      const check = await _validateAssignedLocations(locationIds);
      if (!check.ok) {
        return errorRes(res, 'Assigned locations must be valid actual store locations', [], 400);
      }
    } else if (locationId) {
      const check = await _validateAssignedLocations([locationId]);
      if (!check.ok) {
        return errorRes(res, 'Assigned location must be a valid actual store location', [], 400);
      }
    }

    if (scopeProvided) {
      const wantsAllLocations = allLocations === true;
      // Primary location = the explicitly requested one, else the first
      // assigned location, else global (NULL).
      const resolvedLocationId = wantsAllLocations
        ? null
        : (locationId !== undefined ? (locationId || null) : (hasLocationIds ? locationIds[0] : null));

      updates.push('location_id = ?');
      params.push(resolvedLocationId);

      let locationCode = null;
      if (resolvedLocationId) {
        try {
          const [[loc]] = await db.query(`SELECT location_code FROM locations WHERE id = ?`, [resolvedLocationId]);
          locationCode = loc ? loc.location_code : 'DAV';
        } catch (e) {
          locationCode = resolvedLocationId === 1 ? 'BEL' : resolvedLocationId === 3 ? 'SHI' : 'DAV';
        }
      }
      updates.push('location_code = ?');
      params.push(locationCode);
    }

    if (updates.length > 0) {
      params.push(id);
      await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    // Status, location, and role changes must hit live sessions immediately
    if (active !== undefined || scopeProvided || role !== undefined) {
      invalidateUserStatusCache(id);
    }

    // ── Role change: re-seed default permissions if user has no custom ones ──
    if (role !== undefined && role !== user.prevRole) {
      try {
        const [existingPerms] = await db.query(
          'SELECT COUNT(*) AS cnt FROM user_permissions WHERE user_id = ?',
          [id]
        );
        if (!existingPerms[0] || Number(existingPerms[0].cnt) === 0) {
          await userSyncService.seedRoleDefaultPermissions(
            id, role, req.user ? req.user.username : 'Admin'
          );
        }
      } catch (e) {
        console.warn('[UserMgmt] Role-change permission seeding skipped:', e.message);
      }
    }

    // ── Multi-location: sync user_locations ─────────────────────────
    const wantsAllLocations = allLocations === true;
    if (wantsAllLocations) {
      // Global access — remove all user_locations rows
      try {
        await db.query(`DELETE FROM user_locations WHERE user_id = ?`, [id]);
      } catch (e) {
        console.warn('[UserMgmt] user_locations delete warning:', e.message);
      }
    } else if (Array.isArray(locationIds) && locationIds.length > 0) {
      // Explicit array of locations provided — replace
      try {
        await db.query(`DELETE FROM user_locations WHERE user_id = ?`, [id]);
        for (const locId of locationIds) {
          await db.query(
            `INSERT INTO user_locations (user_id, location_id) VALUES (?, ?)`,
            [id, locId]
          );
        }
      } catch (e) {
        console.warn('[UserMgmt] user_locations sync warning:', e.message);
      }
    } else if (locationId !== undefined && locationId) {
      // Single locationId updated — strictly synchronize user_locations
      try {
        await db.query(`DELETE FROM user_locations WHERE user_id = ?`, [id]);
        await db.query(
          `INSERT INTO user_locations (user_id, location_id) VALUES (?, ?)`,
          [id, locationId]
        );
      } catch (e) {
        console.warn('[UserMgmt] user_locations sync warning:', e.message);
      }
    }

    // ── Propagate the change to every dashboard that reads this person ──
    await userSyncService.ensureEmployeeId(id);
    await userSyncService.syncCandidateFromUser(id);

    await _audit(req, 'UPDATE_USER', { userId: id, username: user.username, changes: req.body });

    realtimeService.emitUserChange('UPDATE', {
      id,
      username: user.username,
      role: role !== undefined ? role : user.prevRole,
      active: active !== undefined ? active : true,
      locationId: req.body.locationId
    });

    return successRes(res, { id }, 'User updated successfully');
  } catch (err) {
    return errorRes(res, 'Failed to update user', [err.message], 500);
  }
};

// ── Delete a user ─────────────────────────────────────────────────
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Cannot delete built-in system admin
    const isNumeric = !isNaN(Number(id));
    const [[user]] = isNumeric
      ? await db.query(`SELECT id, username FROM users WHERE id = ?`, [id])
      : await db.query(`SELECT id, username FROM users WHERE username = ?`, [id]);
    if (!user) {
      return errorRes(res, 'User not found', [], 404);
    }

    const protectedUsers = ['admin@bsctextiles.com', 'admin'];
    if (protectedUsers.includes(user.username.toLowerCase())) {
      return errorRes(res, 'Cannot delete the built-in system administrator account', [], 403);
    }

    const isGlobal = _isGlobalAdminUser(req.user);
    if (!isGlobal && req.user) {
      const allowed = req.user?.allowedLocations?.length ? req.user.allowedLocations : (req.user?.locationId ? [req.user.locationId] : []);
      const [[targetLoc]] = await db.query('SELECT location_id FROM users WHERE id = ?', [user.id]);
      const [userLocs] = await db.query('SELECT location_id FROM user_locations WHERE user_id = ?', [user.id]);
      const targetLocs = [targetLoc?.location_id, ...userLocs.map(l => l.location_id)].filter(Boolean);
      const hasOverlap = targetLocs.some(l => allowed.includes(Number(l)));
      if (!hasOverlap) {
        return errorRes(res, 'You do not have permission to delete users in this location.', [], 403);
      }
    }

    // Delete permissions, location assignments and every cross-module
    // reference (wedding telecaller assignments, …) so nothing can point at a
    // user that no longer exists and no dashboard keeps a stale row.
    await userSyncService.deleteUserCompletely(user.id);

    invalidateUserStatusCache(user.id);

    await _audit(req, 'DELETE_USER', { userId: user.id, username: user.username });

    realtimeService.emitUserChange('DELETE', { id: user.id, username: user.username });

    return successRes(res, { id }, 'User deleted successfully');
  } catch (err) {
    return errorRes(res, 'Failed to delete user', [err.message], 500);
  }
};

// ── Get user permissions ──────────────────────────────────────────
const getUserPermissions = async (req, res) => {
  try {
    const { id } = req.params;

    const [permissions] = await db.query(
      `SELECT module, can_view, can_add, can_edit, can_delete, can_export, can_approve, granted_by, granted_at
       FROM user_permissions WHERE user_id = ?`,
      [id]
    );

    if (permissions && permissions.length > 0) {
      return successRes(res, { permissions, modules: MODULE_REGISTRY, permission_source: 'custom' }, 'Permissions retrieved');
    }

    // No stored matrix — the account runs on its role defaults, so preview the
    // access that authorizationService actually enforces instead of an empty grid.
    let role = null;
    try {
      const [[user]] = await db.query(`SELECT id, role FROM users WHERE id = ?`, [id]);
      role = user ? user.role : null;
    } catch (userErr) {
      console.warn('[UserMgmt] Role lookup for permissions failed:', userErr.message);
    }

    const roleDefaults = authorizationService.resolveRoleDefaultPermissions(role);
    if (roleDefaults.length > 0) {
      return successRes(
        res,
        { permissions: roleDefaults, modules: MODULE_REGISTRY, permission_source: 'role_default' },
        'Permissions retrieved (role defaults)'
      );
    }

    return successRes(res, { permissions: [], modules: MODULE_REGISTRY, permission_source: 'custom' }, 'Permissions retrieved (empty)');
  } catch (err) {
    // If table doesn't exist yet, return empty
    return successRes(res, { permissions: [], modules: MODULE_REGISTRY }, 'Permissions retrieved (empty)');
  }
};

// ── Bulk-update user permissions ──────────────────────────────────
const updatePermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;

    if (!Array.isArray(permissions)) {
      return errorRes(res, 'Permissions must be an array', [], 400);
    }

    // Check user exists
    const [[user]] = await db.query(`SELECT id, username, max_modules FROM users WHERE id = ?`, [id]);
    if (!user) {
      return errorRes(res, 'User not found', [], 404);
    }

    // Check max_modules limit
    if (user.max_modules) {
      const viewableCount = permissions.filter(p => p.can_view).length;
      if (viewableCount > user.max_modules) {
        return errorRes(res, `Cannot assign more than ${user.max_modules} modules to this user`, [], 400);
      }
    }

    const grantedBy = req.user ? req.user.username : 'Admin';

    // Delete existing permissions and re-insert explicit matrix records
    await db.query(`DELETE FROM user_permissions WHERE user_id = ?`, [id]);

    for (const perm of permissions) {
      if (!perm.module) continue;
      await db.query(
        `INSERT INTO user_permissions (user_id, module, can_view, can_add, can_edit, can_delete, can_export, can_approve, granted_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, perm.module, perm.can_view ? 1 : 0, perm.can_add ? 1 : 0, perm.can_edit ? 1 : 0,
         perm.can_delete ? 1 : 0, perm.can_export ? 1 : 0, perm.can_approve ? 1 : 0, grantedBy]
      );
    }

    invalidateUserStatusCache(id);

    const activeViewModules = permissions.filter(p => p.can_view).map(p => p.module);
    await _audit(req, 'UPDATE_PERMISSIONS', { userId: id, username: user.username, moduleCount: activeViewModules.length });

    realtimeService.emitPermissionsChange(id, { username: user.username, modules: activeViewModules });
    realtimeService.emitUserChange('PERMISSIONS', { id, username: user.username, modules: activeViewModules });
    realtimeService.emitUserChange('UPDATE', { id, username: user.username });

    return successRes(res, { id, modules: activeViewModules }, 'Permissions updated successfully');
  } catch (err) {
    return errorRes(res, 'Failed to update permissions', [err.message], 500);
  }
};

// ── Toggle user active status / Deactivate with Duration ───────────
const toggleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { duration, customDate, reason } = req.body || {};

    const [[user]] = await db.query(`SELECT id, username, active, deactivated_until FROM users WHERE id = ?`, [id]);
    if (!user) {
      return errorRes(res, 'User not found', [], 404);
    }

    const protectedUsers = ['admin@bsctextiles.com', 'admin'];
    if (protectedUsers.includes(user.username.toLowerCase())) {
      return errorRes(res, 'Cannot deactivate the built-in system administrator account', [], 403);
    }

    // Determine target status
    // If currently inactive, reactivate it (active = 1, deactivated_until = null)
    // If currently active, deactivate it (active = 0) with optional duration
    const newStatus = user.active ? 0 : 1;
    let deactivatedUntil = null;
    let deactivationReason = reason ? String(reason).trim() : null;

    if (newStatus === 0) {
      const now = new Date();
      if (duration === '1_day') {
        deactivatedUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      } else if (duration === '7_days' || duration === '1_week') {
        deactivatedUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      } else if (duration === '30_days' || duration === '1_month') {
        deactivatedUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      } else if (duration === '6_months') {
        deactivatedUntil = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
      } else if (duration === 'custom' && customDate) {
        deactivatedUntil = new Date(customDate);
      }
      // If duration === 'indefinite', deactivatedUntil remains null
    }

    await db.query(
      `UPDATE users SET active = ?, deactivated_until = ?, deactivation_reason = ? WHERE id = ?`,
      [newStatus, deactivatedUntil, newStatus === 0 ? deactivationReason : null, id]
    );

    invalidateUserStatusCache(id);

    await _audit(req, newStatus ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', {
      userId: id,
      username: user.username,
      duration: newStatus === 0 ? (duration || 'indefinite') : undefined,
      deactivatedUntil: deactivatedUntil ? deactivatedUntil.toISOString() : null,
      reason: deactivationReason
    });

    realtimeService.emitUserChange('STATUS', {
      id,
      username: user.username,
      active: !!newStatus,
      deactivated_until: deactivatedUntil,
      deactivation_reason: deactivationReason
    });

    return successRes(res, {
      id,
      active: !!newStatus,
      deactivated_until: deactivatedUntil,
      deactivation_reason: deactivationReason
    }, `User ${newStatus ? 'activated' : 'deactivated'} successfully`);
  } catch (err) {
    return errorRes(res, 'Failed to toggle user status', [err.message], 500);
  }
};

// ── Reset user password ───────────────────────────────────────────
const resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return errorRes(res, 'Password must be at least 6 characters', [], 400);
    }

    const [[user]] = await db.query(`SELECT id, username FROM users WHERE id = ?`, [id]);
    if (!user) {
      return errorRes(res, 'User not found', [], 404);
    }

    const cleanPassword = password.trim();
    const encryptedPassword = encryptField(cleanPassword);
    await db.query(`UPDATE users SET password = ? WHERE id = ?`, [encryptedPassword, id]);

    await _audit(req, 'RESET_PASSWORD', { userId: id, username: user.username });

    return successRes(res, { id, password: cleanPassword }, 'Password reset successfully');
  } catch (err) {
    return errorRes(res, 'Failed to reset password', [err.message], 500);
  }
};

// ── List available modules ────────────────────────────────────────
const listModules = async (req, res) => {
  return successRes(res, { modules: MODULE_REGISTRY }, 'Modules retrieved');
};

// ── Get current user's active permissions ─────────────────────────
const getMyPermissions = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId || req.user?.role === 'Guest') {
      return successRes(res, {
        isAdmin: false,
        custom: false,
        modules: [],
        permissions: []
      }, 'Guest default permissions');
    }

    if (userSyncService.ADMIN_ROLES.includes(role)) {
      return successRes(res, {
        isAdmin: true,
        custom: true,
        modules: MODULE_REGISTRY.map(m => m.key),
        permissions: MODULE_REGISTRY.map(m => ({
          module: m.key,
          can_view: true,
          can_add: true,
          can_edit: true,
          can_delete: true,
          can_export: true,
          can_approve: true
        }))
      }, 'Admin full permissions');
    }

    const [rows] = await db.query(
      `SELECT module, can_view, can_add, can_edit, can_delete, can_export, can_approve
       FROM user_permissions WHERE user_id = ?`,
      [userId]
    );

    if (!rows || rows.length === 0) {
      // No custom overrides set, fall back to role defaults
      const roleDefaults = authorizationService.resolveRoleDefaultPermissions(role);
      const roleModules = roleDefaults.filter(r => r.can_view).map(r => r.module);
      return successRes(res, {
        isAdmin: false,
        custom: false,
        modules: roleModules,
        permissions: roleDefaults
      }, 'Using role defaults');
    }

    const viewableModules = rows.filter(r => r.can_view === 1 || r.can_view === true).map(r => r.module);

    return successRes(res, {
      isAdmin: false,
      custom: true,
      modules: viewableModules,
      permissions: rows
    }, 'User custom permissions retrieved');
  } catch (err) {
    const roleDefaults = authorizationService.resolveRoleDefaultPermissions(req.user?.role);
    const roleModules = roleDefaults.filter(r => r.can_view).map(r => r.module);
    return successRes(res, {
      isAdmin: false,
      custom: false,
      modules: roleModules,
      permissions: roleDefaults
    }, 'Fallback to role defaults');
  }
};

// ── Audit helper ──────────────────────────────────────────────────
async function _audit(req, action, details) {
  try {
    const username = req.user ? req.user.username : 'System';
    const detailStr = typeof details === 'object' ? JSON.stringify(details) : String(details);
    await db.query(
      `INSERT INTO audit_logs (username, action, module, details, ip_address) VALUES (?, ?, 'UserManagement', ?, ?)`,
      [username, action, detailStr, req.ip || null]
    );
  } catch (e) {
    console.warn('[UserMgmt] Audit log skipped:', e.message);
  }
}

// ── Employee / User CSV bulk import ────────────────────────────────────
//
// Every row is pushed through the very same validateCreateUser ->
// createUser pipeline that the "Create User" form uses, with the real
// authenticated admin attached to the request. Validation rules, duplicate
// detection, password hashing, employee-id generation, permission seeding,
// audit logging and realtime notifications are therefore identical to
// creating one user by hand — the import can never drift from the UI.

/** Capture res.status().json() without touching the real HTTP response. */
function _captureRes() {
  const box = { status: 200, body: null };
  const res = {
    status(code) { box.status = code || 200; return res; },
    json(payload) { box.body = payload; return res; }
  };
  return { res, box };
}

/** Run one create-user payload through the normal validation + insert pipeline. */
async function _runCreatePipeline(req, payload) {
  const mockReq = {
    body: payload,
    user: req.user,
    ip: req.ip,
    headers: req.headers,
    params: {},
    query: {}
  };

  const validation = _captureRes();
  let nextCalled = false;
  try {
    await userValidator.validateCreateUser(mockReq, validation.res, () => { nextCalled = true; });
  } catch (err) {
    console.warn('[UserMgmt.import] validator threw:', err.message);
    return { status: 400, body: { success: false, message: 'Validation failed', errors: [err.message] } };
  }
  if (!nextCalled) {
    return { status: validation.box.status || 400, body: validation.box.body };
  }

  const created = _captureRes();
  await createUser(mockReq, created.res);
  return { status: created.box.status || 200, body: created.box.body };
}

/** Map a single row outcome onto Imported / Skipped / Failed. */
function _classifyRow(outcome) {
  const httpStatus = outcome.status;
  const body = outcome.body || {};
  const errors = Array.isArray(body.errors) ? body.errors.filter(Boolean) : [];
  const message = body.message || '';

  if (httpStatus === 200) return { status: 'Imported', reason: '' };
  if (httpStatus === 409) return { status: 'Skipped', reason: message || 'Duplicate record' };
  if (httpStatus === 400) {
    return { status: 'Failed', reason: errors.length ? errors.join(' ') : (message || 'Validation failed') };
  }
  console.warn('[UserMgmt.import] row rejected:', httpStatus, message, errors.join(' | '));
  return {
    status: 'Failed',
    reason: 'Could not save this row. Please review the values and try again.'
  };
}

async function _loadLocationLookup() {
  const [locations] = await db.query(
    `SELECT id, location_code, location_name, store_name FROM locations`
  );
  const byKey = new Map();
  (locations || []).forEach(loc => {
    [loc.location_code, loc.location_name, loc.store_name]
      .filter(Boolean)
      .map(v => String(v).trim().toLowerCase())
      .forEach(key => { if (key && !byKey.has(key)) byKey.set(key, Number(loc.id)); });
  });
  return byKey;
}

const JOINING_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
function _isValidJoiningDate(value) {
  if (!value) return true;
  if (!JOINING_DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

/** GET /admin/users/import-template — CSV built from EMPLOYEE_CSV_HEADERS. */
const downloadUserImportTemplate = (req, res) => {
  try {
    const csv = buildSampleCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="BSC_User_Import_Template.csv"');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(csv);
  } catch (err) {
    console.error('[UserMgmt.import-template Error]', err);
    return errorRes(res, 'Could not build the sample CSV file.', [err.message], 500);
  }
};

/** POST /admin/users/import-csv — bulk account provisioning from an approved CSV. */
const importUsersCsv = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return errorRes(res, 'No file was uploaded. Choose an approved CSV file.', [], 400);
    }

    const fileName = String(req.file.originalname || '').trim();
    const buf = req.file.buffer;

    if (!/\.csv$/i.test(fileName)) {
      return errorRes(res, EMPLOYEE_CSV_INVALID_FORMAT_MESSAGE, [], 400);
    }
    if (buf.length === 0) {
      return errorRes(res, 'The uploaded file is empty.', [], 400);
    }
    if (buf.length > EMPLOYEE_CSV_MAX_BYTES) {
      return errorRes(res, `The file is too large. The maximum size is ${Math.round(EMPLOYEE_CSV_MAX_BYTES / 1024)} KB.`, [], 400);
    }
    if (looksBinary(buf)) {
      // A renamed .xlsx/.xls/.doc/.pdf/.zip keeps its original binary
      // signature even though the extension says .csv.
      return errorRes(res, EMPLOYEE_CSV_INVALID_FORMAT_MESSAGE, [], 400);
    }

    const parsedRows = parseCsv(buf.toString('utf8'));

    // Keep the original row number so a failure message points at the exact
    // line the user sees in their spreadsheet (header row = row 1).
    const entries = [];
    parsedRows.forEach((cells, idx) => {
      if (!isEmptyRow(cells)) entries.push({ row: idx + 1, cells });
    });

    if (entries.length === 0) {
      return errorRes(res, 'The file does not start with a header row.', [], 400);
    }

    const headerErrors = validateHeaderRow(entries[0].cells);
    if (headerErrors.length > 0) {
      return errorRes(res, 'The CSV header does not match the approved format.', headerErrors, 400);
    }

    const dataEntries = entries.slice(1);
    if (dataEntries.length === 0) {
      return errorRes(res, 'The file contains a header row but no data rows.', [], 400);
    }
    if (dataEntries.length > EMPLOYEE_CSV_MAX_ROWS) {
      return errorRes(
        res,
        `Too many rows. A single import may contain at most ${EMPLOYEE_CSV_MAX_ROWS} data rows (the file has ${dataEntries.length}).`,
        [],
        400
      );
    }

    const locationByKey = await _loadLocationLookup();

    const results = [];
    let imported = 0;
    let skipped = 0;
    let failed = 0;

    for (const entry of dataEntries) {
      const { row, cells } = entry;

      const reject = (reason, username) => {
        failed += 1;
        results.push({ row, status: 'Failed', reason, username: username || '' });
      };

      if (cells.length !== EMPLOYEE_CSV_HEADERS.length) {
        reject(`Expected ${EMPLOYEE_CSV_HEADERS.length} values but found ${cells.length}.`);
        continue;
      }

      const body = rowToBody(cells, EMPLOYEE_CSV_HEADERS);
      const username = body.username || '';

      if (!body.location) {
        reject('Location is required. Use a location code (BEL, DAV, SHI) or the location name.', username);
        continue;
      }
      const locationId = locationByKey.get(body.location.toLowerCase());
      if (!locationId) {
        reject(`Invalid location "${body.location}". Use a location code (BEL, DAV, SHI) or the location name.`, username);
        continue;
      }
      if (!_isValidJoiningDate(body.joiningDate)) {
        reject('Joining Date must be a valid date in YYYY-MM-DD format.', username);
        continue;
      }

      // Exactly the payload the Create User form submits.
      const payload = {
        username: body.username,
        password: body.password,
        role: body.role,
        fullName: body.fullName || body.username,
        email: body.email || null,
        phone: body.phone || null,
        department: body.department || null,
        designation: body.designation || null,
        employeeId: body.employeeId || null,
        section: body.section || null,
        joiningDate: body.joiningDate || null,
        allLocations: false,
        locationId,
        locationIds: [locationId]
      };

      const outcome = await _runCreatePipeline(req, payload);
      const classified = _classifyRow(outcome);
      results.push({ row, status: classified.status, reason: classified.reason, username });

      if (classified.status === 'Imported') imported += 1;
      else if (classified.status === 'Skipped') skipped += 1;
      else failed += 1;
    }

    const summary = `${imported} imported, ${skipped} skipped, ${failed} failed of ${dataEntries.length}`;
    await _audit(req, 'IMPORT_USERS_CSV', { fileName, summary });

    return successRes(res, {
      fileName,
      total: dataEntries.length,
      imported,
      skipped,
      failed,
      results
    }, `Import finished - ${summary}`);
  } catch (err) {
    console.error('[UserMgmt.importCsv Error]', err);
    return errorRes(res, 'The import could not be completed. Please try again.', [err.message], 500);
  }
};

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  getUserPermissions,
  updatePermissions,
  toggleStatus,
  resetPassword,
  listModules,
  getMyPermissions,
  downloadUserImportTemplate,
  importUsersCsv
};
