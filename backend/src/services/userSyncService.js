/**
 * BSC Textiles Portal — User / Employee Account Synchronization Service
 * =====================================================================
 * SINGLE SOURCE OF TRUTH
 * ----------------------
 * `users` is the master record for every account (login, role, location,
 * status, permissions). Recruitment keeps its own history inside
 * `candidates`, linked to the master account through
 * `users.candidate_app_no  <->  candidates.app_no`.
 *
 * Every dashboard is a *view* over those two tables:
 *   - User Management / Registered User Accounts  -> users
 *   - Employee Directory                          -> users JOIN candidates
 *   - Role & Permissions                          -> users + user_permissions
 *   - Location dashboards                         -> users.location_id / user_locations
 *   - Department / Designation sections           -> users.department / users.designation
 *
 * Shared fields (full name, email, phone, department, designation) are kept
 * identical in both tables by the two sync helpers below. Every write path
 * calls one of them, so no module can ever show stale data.
 *
 * Sync helpers never blank an existing value (COALESCE + NULLIF guard) so a
 * sparse update in one module cannot destroy data owned by the other.
 */

const pool = require('../config/db');
const bcrypt = require('bcryptjs');

// ── Roles that bypass module-level permission checks ──────────────
const ADMIN_ROLES = ['Admin', 'Super Admin'];

// ── Default password for auto-provisioned (joined candidate) accounts
const DEFAULT_EMPLOYEE_PASSWORD = 'Bsc@123';

/**
 * Role → default module visibility.
 * Mirrors `frontend/src/components/Sidebar.tsx` roleNavMap so the navigation
 * the user sees and the permissions stored in the database always agree.
 * Only keys present in the backend MODULE_REGISTRY are listed.
 */
const ROLE_DEFAULT_MODULES = {
  'HR': ['dashboard', 'wedding_crm', 'footfall', 'feedback_collection', 'feedback_list', 'feedback_qr',
         'divert', 'candidates', 'offer', 'openings', 'employees', 'dept_hiring', 'section_allocation',
         'broadcast', 'daily_mcheck', 'mcheck_reports', 'mcheck_history'],
  'Manager': ['dashboard', 'wedding_crm', 'telecaller_desk', 'telecaller_dashboard', 'footfall', 'feedback_collection', 'feedback_list', 'feedback_qr',
              'divert', 'candidates', 'offer', 'openings', 'employees', 'dept_hiring', 'section_allocation',
              'broadcast', 'daily_mcheck', 'mcheck_reports', 'mcheck_history'],
  'Telecaller': ['wedding_crm', 'telecaller_desk', 'telecaller_dashboard', 'wedding_registration'],
  'CRM Executive': ['wedding_crm', 'telecaller_desk', 'telecaller_dashboard', 'wedding_registration', 'dashboard', 'footfall'],
  'CRM Manager': ['wedding_crm', 'telecaller_desk', 'telecaller_dashboard', 'wedding_registration', 'dashboard', 'footfall', 'broadcast'],
  'Recruiter': ['dashboard', 'wedding_crm', 'candidates', 'broadcast'],
  'Interviewer': ['candidates'],
  'Employee': ['dashboard', 'wedding_crm'],
  'Greeter': ['wedding_crm', 'footfall', 'feedback_collection', 'feedback_list', 'feedback_qr', 'divert'],
  'Guest': []
};

function getRoleDefaultModules(role) {
  if (ADMIN_ROLES.includes(role)) {
    return Object.values(ROLE_DEFAULT_MODULES).reduce((acc, list) => acc.concat(list), []);
  }
  return ROLE_DEFAULT_MODULES[role] ? [...ROLE_DEFAULT_MODULES[role]] : [];
}

// ── Employee ID generator ─────────────────────────────────────────
/**
 * Builds the next sequential employee id, e.g. EMP-0007.
 * Only used when the caller did not supply one (candidate-linked accounts
 * use the candidate application number instead).
 */
async function nextEmployeeId(executor = pool) {
  try {
    const [rows] = await executor.query(
      `SELECT employee_id FROM users WHERE employee_id LIKE 'EMP-%' ORDER BY id DESC LIMIT 200`
    );
    let max = 0;
    for (const r of rows || []) {
      const m = String(r.employee_id || '').match(/(\d+)\s*$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return `EMP-${String(max + 1).padStart(4, '0')}`;
  } catch (e) {
    return `EMP-${String(Date.now()).slice(-6)}`;
  }
}

/**
 * Assigns a stable employee id to a user row that has none.
 * Uses the primary key so the value is guaranteed unique even when two
 * accounts are created in the same second.
 */
async function ensureEmployeeId(userId, executor = pool) {
  try {
    const [[row]] = await executor.query('SELECT id, employee_id FROM users WHERE id = ?', [userId]);
    if (!row) return null;
    if (row.employee_id && String(row.employee_id).trim() !== '') return row.employee_id;
    const generated = `EMP-${String(row.id).padStart(4, '0')}`;
    await executor.query('UPDATE users SET employee_id = ? WHERE id = ?', [generated, row.id]);
    return generated;
  } catch (e) {
    console.warn('[UserSync] ensureEmployeeId skipped:', e.message);
    return null;
  }
}

// ── Location helpers ──────────────────────────────────────────────
async function resolveLocationCode(locationId, executor = pool) {
  if (!locationId) return null;
  try {
    const [[loc]] = await executor.query('SELECT location_code FROM locations WHERE id = ?', [locationId]);
    return loc ? loc.location_code : null;
  } catch (e) {
    return locationId === 1 ? 'BEL' : locationId === 3 ? 'SHI' : 'DAV';
  }
}

// ── Permission helpers ───────────────────────────────────────────
/**
 * Seeds the role-default module visibility for a user that has no explicit
 * permission rows yet. Never overwrites permissions an admin already saved.
 */
async function seedRoleDefaultPermissions(userId, role, grantedBy = 'System', executor = pool) {
  try {
    const modules = getRoleDefaultModules(role);
    if (!modules.length) return 0;

    const [existing] = await executor.query(
      'SELECT COUNT(*) AS cnt FROM user_permissions WHERE user_id = ?',
      [userId]
    );
    if (existing && existing[0] && Number(existing[0].cnt) > 0) return 0;

    let inserted = 0;
    for (const module of modules) {
      try {
        await executor.query(
          `INSERT INTO user_permissions (user_id, module, can_view, granted_by)
           VALUES (?, ?, TRUE, ?)
           ON DUPLICATE KEY UPDATE can_view = VALUES(can_view), granted_by = VALUES(granted_by)`,
          [userId, module, grantedBy]
        );
        inserted++;
      } catch (e) { /* non-fatal */ }
    }
    return inserted;
  } catch (e) {
    console.warn('[UserSync] seedRoleDefaultPermissions skipped:', e.message);
    return 0;
  }
}

// ── Lookup helpers ────────────────────────────────────────────────
/**
 * Resolves a user row from a numeric id, a username, or a candidate
 * application number. This is what lets every dashboard address the same
 * record with whatever identifier it happens to hold.
 */
async function resolveUser(identifier, executor = pool) {
  if (identifier === null || identifier === undefined || identifier === '') return null;
  const value = String(identifier).trim();
  try {
    const isNumeric = /^\d+$/.test(value);
    const [[user]] = await executor.query(
      `SELECT u.*, l.location_name
         FROM users u
         LEFT JOIN locations l ON l.id = u.location_id
        WHERE ${isNumeric ? 'u.id = ?' : '(u.username = ? OR u.candidate_app_no = ?)'}
        LIMIT 1`,
      isNumeric ? [Number(value)] : [value, value]
    );
    return user || null;
  } catch (e) {
    console.warn('[UserSync] resolveUser failed:', e.message);
    return null;
  }
}

/** Finds the master account linked to a candidate application number. */
async function findUserByCandidateAppNo(appNo, executor = pool) {
  if (!appNo) return null;
  try {
    const [[user]] = await executor.query(
      'SELECT * FROM users WHERE candidate_app_no = ? LIMIT 1',
      [appNo]
    );
    return user || null;
  } catch (e) {
    return null;
  }
}

// ── Candidate → User sync (HR pipeline edits) ─────────────────────
/**
 * Mirrors a candidate's shared fields onto its linked master account.
 * Called after every candidate/employee profile update so the Employee
 * Directory and User Management never disagree.
 */
async function syncUserFromCandidate(appNo, executor = pool) {
  if (!appNo) return 0;
  try {
    const [result] = await executor.query(
      `UPDATE users u
         JOIN candidates c ON c.app_no = u.candidate_app_no
          SET u.full_name   = COALESCE(NULLIF(TRIM(c.name), ''), u.full_name),
              u.email       = COALESCE(NULLIF(TRIM(c.email), ''), u.email),
              u.phone       = COALESCE(NULLIF(TRIM(c.phone), ''), u.phone),
              u.department  = COALESCE(NULLIF(TRIM(c.department), ''), u.department),
              u.designation = COALESCE(NULLIF(TRIM(c.designation), ''), u.designation)
        WHERE u.candidate_app_no = ?`,
      [appNo]
    );
    return result ? result.affectedRows : 0;
  } catch (e) {
    console.warn('[UserSync] syncUserFromCandidate skipped:', e.message);
    return 0;
  }
}

// ── User → Candidate sync (User Management edits) ─────────────────
/**
 * Mirrors an account's shared fields onto its linked candidate record so the
 * Employee Directory / Offer Desk / Candidate CRM show the same values the
 * admin just saved in User Management.
 */
async function syncCandidateFromUser(userId, executor = pool) {
  if (!userId) return 0;
  try {
    const [result] = await executor.query(
      `UPDATE candidates c
         JOIN users u ON u.candidate_app_no = c.app_no
          SET c.name        = COALESCE(NULLIF(TRIM(u.full_name), ''), c.name),
              c.email       = COALESCE(NULLIF(TRIM(u.email), ''), c.email),
              c.phone       = COALESCE(NULLIF(TRIM(u.phone), ''), c.phone),
              c.department  = COALESCE(NULLIF(TRIM(u.department), ''), c.department),
              c.designation = COALESCE(NULLIF(TRIM(u.designation), ''), c.designation)
        WHERE u.id = ?`,
      [userId]
    );
    return result ? result.affectedRows : 0;
  } catch (e) {
    console.warn('[UserSync] syncCandidateFromUser skipped:', e.message);
    return 0;
  }
}

// ── Username uniqueness ───────────────────────────────────────────
async function buildUniqueUsername(preferred, candidateAppNo, executor = pool) {
  const base = (preferred && String(preferred).trim()) || `emp_${candidateAppNo || Date.now()}`;
  let candidate = base;
  let counter = 1;
  // Bounded loop — the DB unique index remains the final guard.
  for (let i = 0; i < 50; i++) {
    try {
      const [ex] = await executor.query(
        'SELECT id FROM users WHERE LOWER(username) = ? LIMIT 1',
        [candidate.toLowerCase()]
      );
      if (!ex.length) return candidate;
    } catch (e) {
      return candidate;
    }
    candidate = `${base}_${counter++}`;
  }
  return `${base}_${Date.now().toString().slice(-5)}`;
}

// ── Auto-provisioning (joined candidate → master account) ─────────
/**
 * Creates the master user account for a candidate that has joined.
 * Idempotent: a candidate can only ever own one master account, enforced by
 * the unique index on users.candidate_app_no.
 *
 * @param {string} appNo candidate application number
 * @param {object} [options] { username, password, role, grantedBy }
 * @returns {Promise<{created:boolean, userId?:number, username?:string}>}
 */
async function provisionUserForCandidate(appNo, options = {}) {
  if (!appNo) return { created: false };
  try {
    const [[cand]] = await pool.query('SELECT * FROM candidates WHERE app_no = ? LIMIT 1', [appNo]);
    if (!cand) return { created: false };

    const existing = await findUserByCandidateAppNo(appNo);
    if (existing) {
      // Keep the linked account aligned with the candidate record.
      await syncUserFromCandidate(appNo);
      await ensureEmployeeId(existing.id);
      return { created: false, userId: existing.id, username: existing.username };
    }

    const role = options.role || 'Employee';
    const username = await buildUniqueUsername(options.username || cand.phone, appNo);
    const hashedPassword = await bcrypt.hash(options.password || DEFAULT_EMPLOYEE_PASSWORD, 10);

    const locationId = cand.location_id || 2;
    const locationCode = await resolveLocationCode(locationId);

    const [result] = await pool.query(
      `INSERT INTO users
         (username, password, full_name, employee_id, candidate_app_no, email, phone,
          department, designation, role, active, location_id, location_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?)`,
      [
        username, hashedPassword, cand.name || 'Unknown', appNo, appNo,
        cand.email || null, cand.phone || null,
        cand.department || 'Store Operations', cand.designation || 'Staff',
        role, locationId, locationCode
      ]
    );

    const newUserId = result.insertId;

    // Assign the account to the same store so location dashboards match.
    if (locationId) {
      try {
        await pool.query(
          `INSERT INTO user_locations (user_id, location_id) VALUES (?, ?)
           ON DUPLICATE KEY UPDATE location_id = VALUES(location_id)`,
          [newUserId, locationId]
        );
      } catch (e) { /* table may not exist yet */ }
    }

    // Give the account the module access its role implies, so navigation and
    // the permissions matrix agree the moment the user first signs in.
    await seedRoleDefaultPermissions(newUserId, role, options.grantedBy || 'System');

    return { created: true, userId: newUserId, username };
  } catch (err) {
    // A concurrent provision loses the race on the unique index — that is safe.
    if (err && err.code === 'ER_DUP_ENTRY') {
      const existing = await findUserByCandidateAppNo(appNo);
      return { created: false, userId: existing ? existing.id : undefined, username: existing ? existing.username : undefined };
    }
    console.error('[UserSync] provisionUserForCandidate failed:', err.message);
    return { created: false };
  }
}

// ── Deletion / reference cleanup ──────────────────────────────────
/**
 * Removes every reference that would otherwise become a dangling pointer
 * once an account disappears from the users table.
 */
async function dereferenceUser(userId, executor = pool) {
  if (!userId) return;
  // Wedding CRM keeps the telecaller *name* for the audit trail but must not
  // keep pointing at a user id that no longer exists.
  try {
    await executor.query(
      'UPDATE wedding_customers SET assigned_telecaller_id = NULL WHERE assigned_telecaller_id = ?',
      [userId]
    );
  } catch (e) { /* table may not exist */ }
}

/**
 * Hard-deletes an account together with every dependent record.
 * Shared by User Management and the Employee Directory so both paths clean up
 * identically and no dashboard can keep showing a ghost row.
 */
async function deleteUserCompletely(userId) {
  if (!userId) return false;
  try { await pool.query('DELETE FROM user_permissions WHERE user_id = ?', [userId]); } catch (e) {}
  try { await pool.query('DELETE FROM user_locations WHERE user_id = ?', [userId]); } catch (e) {}
  await dereferenceUser(userId);
  await pool.query('DELETE FROM users WHERE id = ?', [userId]);
  return true;
}

/**
 * Deletes the master account that belongs to a candidate (permissions,
 * location rows and cross-module references included). Used when an employee
 * record is deleted so the Employee Directory cannot show a ghost row.
 */
async function removeUserForCandidate(appNo) {
  if (!appNo) return { removed: false };
  try {
    const user = await findUserByCandidateAppNo(appNo);
    if (!user) return { removed: false };
    await deleteUserCompletely(user.id);
    return { removed: true, userId: user.id, username: user.username };
  } catch (e) {
    console.warn('[UserSync] removeUserForCandidate skipped:', e.message);
    return { removed: false };
  }
}

// ── Legacy backfill (one-off reconciliation) ───────────────────────
/**
 * Every joined candidate must own exactly one master account. Safe to run on
 * every boot — it only touches candidates that have no linked account yet, so
 * existing data is never duplicated or overwritten.
 *
 * @param {object} connection  mysql2 connection (the initializer's own)
 * @param {function} log       logging callback
 */
async function backfillMissingUserAccounts(connection, log = () => {}) {
  const results = { scanned: 0, provisioned: 0, failed: 0 };
  try {
    const [missing] = await connection.query(`
      SELECT c.app_no
        FROM candidates c
        LEFT JOIN selection_offers so ON c.app_no = so.app_no
        LEFT JOIN users u ON u.candidate_app_no = c.app_no
       WHERE (LOWER(TRIM(c.status)) IN ('joined', 'hired') OR LOWER(TRIM(so.status)) = 'joined')
         AND u.id IS NULL
       GROUP BY c.app_no
    `);

    results.scanned = missing.length;
    for (const row of missing) {
      try {
        const [candRows] = await connection.query(
          'SELECT * FROM candidates WHERE app_no = ? LIMIT 1',
          [row.app_no]
        );
        const cand = candRows[0];
        if (!cand) continue;

        const username = await buildUniqueUsername(cand.phone, cand.app_no, connection);
        const hashedPassword = await bcrypt.hash(DEFAULT_EMPLOYEE_PASSWORD, 10);
        const locationId = cand.location_id || 2;
        const locationCode = await resolveLocationCode(locationId, connection);

        const [result] = await connection.query(
          `INSERT INTO users
             (username, password, full_name, employee_id, candidate_app_no, email, phone,
              department, designation, role, active, location_id, location_code)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Employee', TRUE, ?, ?)`,
          [
            username, hashedPassword, cand.name || 'Unknown', cand.app_no, cand.app_no,
            cand.email || null, cand.phone || null,
            cand.department || 'Store Operations', cand.designation || 'Staff',
            locationId, locationCode
          ]
        );

        const newUserId = result.insertId;
        if (locationId) {
          try {
            await connection.query(
              'INSERT INTO user_locations (user_id, location_id) VALUES (?, ?)',
              [newUserId, locationId]
            );
          } catch (e) {}
        }
        await seedRoleDefaultPermissions(newUserId, 'Employee', 'System', connection);
        results.provisioned++;
      } catch (e) {
        results.failed++;
        log(`[UserSync] Backfill skipped ${row.app_no}: ${e.message}`);
      }
    }
  } catch (e) {
    log(`[UserSync] Backfill aborted: ${e.message}`);
  }
  return results;
}

module.exports = {
  ADMIN_ROLES,
  DEFAULT_EMPLOYEE_PASSWORD,
  ROLE_DEFAULT_MODULES,
  getRoleDefaultModules,
  nextEmployeeId,
  ensureEmployeeId,
  resolveLocationCode,
  seedRoleDefaultPermissions,
  resolveUser,
  findUserByCandidateAppNo,
  syncUserFromCandidate,
  syncCandidateFromUser,
  buildUniqueUsername,
  provisionUserForCandidate,
  dereferenceUser,
  removeUserForCandidate,
  deleteUserCompletely,
  backfillMissingUserAccounts
};
