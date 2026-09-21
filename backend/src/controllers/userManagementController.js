const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { successRes, errorRes } = require('../utils/response');
const { logAction } = require('../utils/logger');
const userSyncService = require('../services/userSyncService');
const { invalidateUserStatusCache } = require('../middleware/auth');

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

// ── Module Registry — matches sidebar navItems ────────────────────
const MODULE_REGISTRY = [
  { key: 'dashboard', label: 'Dashboard', section: 'Core Workspace' },
  { key: 'wedding_crm', label: 'Wedding Follow-up CRM', section: 'Store Operations' },
  { key: 'telecaller_desk', label: 'Telecaller Calling Desk', section: 'Store Operations' },
  { key: 'telecaller_dashboard', label: 'Telecaller Dashboard', section: 'Telecaller' },
  { key: 'footfall', label: 'Hourly Footfall', section: 'Store Operations' },
  { key: 'feedback_collection', label: 'Feedback Collection', section: 'Store Operations' },
  { key: 'feedback_list', label: 'Feedback Call Queue', section: 'Store Operations' },
  { key: 'feedback_qr', label: 'Feedback QR Code', section: 'Store Operations' },
  { key: 'divert', label: 'Sourcing Diverts', section: 'Store Operations' },
  { key: 'candidates', label: 'Candidate CRM', section: 'Core Workspace' },
  { key: 'offer', label: 'Offer Desk', section: 'Core Workspace' },
  { key: 'openings', label: 'Manpower Planning', section: 'Core Workspace' },
  { key: 'employees', label: 'Employee Directory', section: 'Talent Management' },
  { key: 'dept_hiring', label: 'Department Hiring Status', section: 'Talent Management' },
  { key: 'section_allocation', label: 'Section Allocation', section: 'Talent Management' },
  { key: 'broadcast', label: 'Broadcast Center', section: 'Administration' },
  { key: 'settings', label: 'System Settings', section: 'Administration' },
  { key: 'daily_mcheck', label: 'Daily MCheck', section: 'Daily Operations' },
  { key: 'mcheck_reports', label: 'MCheck Reports', section: 'Daily Operations' },
  { key: 'mcheck_history', label: 'MCheck History', section: 'Daily Operations' },
  { key: 'user_management', label: 'User Management', section: 'Administration' },
  { key: 'attendance', label: 'Attendance & Roster', section: 'Store Operations' },
  { key: 'pm_view', label: 'Purchase Manager View', section: 'Store Operations' },
  { key: 'vm_checklist', label: 'VM Checklist', section: 'Store Operations' },
  { key: 'greeter', label: 'Greeter Kiosk', section: 'Public Portals' },
  { key: 'tv', label: 'Live TV Kiosk', section: 'Public Portals' },
  { key: 'feedback_public', label: 'Customer Feedback QR', section: 'Public Portals' },
  { key: 'system_admin', label: 'System Administrator', section: 'Administration' },
  { key: 'wedding_registration', label: 'Applicant Registration', section: 'Public Portals' },
  { key: 'wedding_operations', label: 'Wedding Operations', section: 'Store Operations' }
];

// ── List all users with their permission counts ───────────────────
const listUsers = async (req, res) => {
  try {
    const [rawUsers] = await db.query(`
      SELECT
        u.id, u.username, u.full_name AS fullName, u.email, u.phone,
        u.employee_id AS employeeId,
        u.department, u.designation, u.role, u.active,
        u.location_id, u.location_code, u.max_modules,
        u.last_login_at, u.created_at, u.updated_at,
        l.location_name,
        GROUP_CONCAT(DISTINCT CONCAT(ul.location_id, ':', COALESCE(l2.location_name, ''))) AS assigned_location_pairs,
        (SELECT COUNT(*) FROM user_permissions up WHERE up.user_id = u.id AND up.can_view = TRUE) AS modules_assigned
      FROM users u
      LEFT JOIN locations l ON l.id = u.location_id
      LEFT JOIN user_locations ul ON ul.user_id = u.id
      LEFT JOIN locations l2 ON l2.id = ul.location_id
      GROUP BY u.id
      ORDER BY u.created_at ASC
    `);

    const users = rawUsers.map(u => {
      const { assigned_location_pairs, ...rest } = u;
      return { ...rest, assigned_locations: _parseLocationPairs(assigned_location_pairs, rest) };
    });

    return successRes(res, { users }, 'Users retrieved');
  } catch (err) {
    // Fallback if user_permissions table doesn't exist yet
    try {
      const [rawUsers] = await db.query(`
        SELECT
          u.id, u.username, u.full_name AS fullName, u.email, u.phone,
          u.employee_id AS employeeId,
          u.department, u.designation, u.role, u.active,
          u.location_id, u.location_code,
          u.last_login_at, u.created_at,
          l.location_name,
          GROUP_CONCAT(DISTINCT CONCAT(ul.location_id, ':', COALESCE(l2.location_name, ''))) AS assigned_location_pairs,
          0 AS modules_assigned
        FROM users u
        LEFT JOIN locations l ON l.id = u.location_id
        LEFT JOIN user_locations ul ON ul.user_id = u.id
        LEFT JOIN locations l2 ON l2.id = ul.location_id
        GROUP BY u.id
        ORDER BY u.created_at ASC
      `);

      const users = rawUsers.map(u => {
        const { assigned_location_pairs, ...rest } = u;
        return { ...rest, assigned_locations: _parseLocationPairs(assigned_location_pairs, rest) };
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
        u.id, u.username, u.full_name AS fullName, u.email, u.phone,
        u.employee_id AS employeeId,
        u.department, u.designation, u.role, u.active,
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


    // Location scope: explicit allLocations=true grants global access (NULL
    // location). Otherwise the user is pinned to a single store location.
    const wantsAllLocations = allLocations === true;
    const isGlobalRole = role === 'Admin' || 'Super Admin' === role;
    const resolvedLocationId = wantsAllLocations
      ? null
      : (locationId || (isGlobalRole ? null : 2));

    return _insertUser(req, res, { username, password, role, fullName, email, phone, department, designation,
                                     employeeId: cleanEmployeeId, section, joiningDate,
                                     resolvedLocationId, locationIds, allLocations, maxModules, permissions });
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

    const hashedPassword = await bcrypt.hash(password.trim(), 10);

    const [result] = await db.query(
      `INSERT INTO users (username, password, role, full_name, email, phone, department, designation,
                          employee_id, section, joining_date, active, location_id, location_code, max_modules)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?, ?)`,
      [username.trim(), hashedPassword, role, fullName || role, email || null, phone || null,
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
    const [[user]] = await db.query(`SELECT id, username, role as prevRole FROM users WHERE id = ?`, [id]);
    if (!user) {
      return errorRes(res, 'User not found', [], 404);
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
    // `users.location_id` while user_locations says otherwise, and login,
    // location dashboards and the user list would disagree.
    const hasLocationIds = Array.isArray(locationIds) && locationIds.length > 0;
    const scopeProvided = allLocations !== undefined || locationId !== undefined || hasLocationIds;
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

    // Status changes must hit live sessions immediately
    if (active !== undefined) {
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
    }
    // If neither allLocations nor locationIds provided, leave user_locations untouched

    // ── Propagate the change to every dashboard that reads this person ──
    await userSyncService.ensureEmployeeId(id);
    await userSyncService.syncCandidateFromUser(id);

    await _audit(req, 'UPDATE_USER', { userId: id, username: user.username, changes: req.body });

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

    // Delete permissions, location assignments and every cross-module
    // reference (wedding telecaller assignments, …) so nothing can point at a
    // user that no longer exists and no dashboard keeps a stale row.
    await userSyncService.deleteUserCompletely(user.id);

    invalidateUserStatusCache(user.id);

    await _audit(req, 'DELETE_USER', { userId: user.id, username: user.username });

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

    return successRes(res, { permissions, modules: MODULE_REGISTRY }, 'Permissions retrieved');
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

    // Delete existing permissions and re-insert
    await db.query(`DELETE FROM user_permissions WHERE user_id = ?`, [id]);

    for (const perm of permissions) {
      if (!perm.module) continue;
      // Only insert if at least one permission is granted
      if (perm.can_view || perm.can_add || perm.can_edit || perm.can_delete || perm.can_export || perm.can_approve) {
        await db.query(
          `INSERT INTO user_permissions (user_id, module, can_view, can_add, can_edit, can_delete, can_export, can_approve, granted_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, perm.module, !!perm.can_view, !!perm.can_add, !!perm.can_edit,
           !!perm.can_delete, !!perm.can_export, !!perm.can_approve, grantedBy]
        );
      }
    }

    await _audit(req, 'UPDATE_PERMISSIONS', { userId: id, username: user.username, moduleCount: permissions.filter(p => p.can_view).length });

    return successRes(res, { id }, 'Permissions updated successfully');
  } catch (err) {
    return errorRes(res, 'Failed to update permissions', [err.message], 500);
  }
};

// ── Toggle user active status ─────────────────────────────────────
const toggleStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const [[user]] = await db.query(`SELECT id, username, active FROM users WHERE id = ?`, [id]);
    if (!user) {
      return errorRes(res, 'User not found', [], 404);
    }

    const protectedUsers = ['admin@bsctextiles.com', 'admin'];
    if (protectedUsers.includes(user.username.toLowerCase())) {
      return errorRes(res, 'Cannot deactivate the built-in system administrator account', [], 403);
    }

    const newStatus = user.active ? 0 : 1;
    await db.query(`UPDATE users SET active = ? WHERE id = ?`, [newStatus, id]);

    // A deactivated account must lose access on live sessions immediately, and
    // a reactivated one must regain it — refresh the status cache used by the
    // auth middleware.
    invalidateUserStatusCache(id);

    await _audit(req, newStatus ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', { userId: id, username: user.username });

    return successRes(res, { id, active: !!newStatus }, `User ${newStatus ? 'activated' : 'deactivated'} successfully`);
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

    const hashedPassword = await bcrypt.hash(password.trim(), 10);
    await db.query(`UPDATE users SET password = ? WHERE id = ?`, [hashedPassword, id]);

    await _audit(req, 'RESET_PASSWORD', { userId: id, username: user.username });

    return successRes(res, { id }, 'Password reset successfully');
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

    if (!userId) {
      return errorRes(res, 'Authentication required', [], 401);
    }

    if (['Admin', 'Super Admin'].includes(role)) {
      return successRes(res, {
        isAdmin: true,
        custom: true,
        modules: MODULE_REGISTRY.map(m => m.key)
      }, 'Admin full permissions');
    }

    const [rows] = await db.query(
      `SELECT module, can_view, can_add, can_edit, can_delete, can_export, can_approve
       FROM user_permissions WHERE user_id = ?`,
      [userId]
    );

    if (!rows || rows.length === 0) {
      // No custom overrides set, fall back to role defaults
      return successRes(res, { isAdmin: false, custom: false, permissions: [] }, 'Using role defaults');
    }

    const viewableModules = rows.filter(r => r.can_view).map(r => r.module);

    return successRes(res, {
      isAdmin: false,
      custom: true,
      modules: viewableModules,
      permissions: rows
    }, 'User custom permissions retrieved');
  } catch (err) {
    return successRes(res, { isAdmin: false, custom: false, permissions: [] }, 'Fallback to role defaults');
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
  getMyPermissions
};
