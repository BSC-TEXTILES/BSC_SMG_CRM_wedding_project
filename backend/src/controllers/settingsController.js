const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { successRes, errorRes } = require('../utils/response');
const { logAction } = require('../utils/logger');
const { DEFAULT_DEPARTMENTS, mergeOptions } = require('../utils/directoryLists');
const userMgmtController = require('./userManagementController');

/**
 * Legacy Settings-module user endpoints.
 * ------------------------------------------------------------------
 * `users` is the single source of truth, so these handlers no longer keep a
 * private copy of the account list (the previous hard-coded defaults and the
 * synthetic `greeter` row made Settings show accounts that did not exist in
 * the database). They now read and write exactly what User Management reads
 * and writes, so both sections always agree.
 */
const getUsers = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT u.id, u.username, u.password, u.role, u.active, u.full_name as fullName,
             u.email, u.phone, u.department, u.designation,
             u.employee_id as employeeId,
             u.location_id, u.location_code,
             l.location_name,
             u.created_at, u.updated_at
      FROM users u
      LEFT JOIN locations l ON l.id = u.location_id
      ORDER BY u.created_at ASC, u.id ASC
    `);

    const users = rows.map((r) => ({
      id: r.id,
      username: r.username,
      password: r.password || '',
      role: r.role,
      active: !!r.active,
      fullName: r.fullName || r.role,
      email: r.email || null,
      phone: r.phone || null,
      department: r.department || null,
      designation: r.designation || null,
      employeeId: r.employeeId || null,
      location_id: r.location_id,
      location_code: r.location_code,
      location_name: r.location_name,
      created_at: r.created_at,
      updated_at: r.updated_at
    }));

    return res.json({ users });
  } catch (err) {
    return errorRes(res, 'Failed to load user accounts', [err.message], 500);
  }
};

const addUser = async (req, res) => {
  // Delegate to the canonical create flow (validation, uniqueness checks,
  // location scope, permissions seeding) so an account created here is
  // identical to one created in User Management.
  return userMgmtController.createUser(req, res);
};

const updateUser = async (req, res) => {
  const { username, id } = req.body;
  try {
    if (username) {
      const [[row]] = await db.query(
        `SELECT id FROM users WHERE username = ? OR LOWER(username) = ?`,
        [username, String(username).toLowerCase()]
      );
      if (!row) {
        return errorRes(res, 'User not found', [], 404);
      }
      req.params = { id: row.id };
    } else if (id) {
      req.params = { id };
    } else {
      return errorRes(res, 'Username or user id is required', [], 400);
    }
    return userMgmtController.updateUser(req, res);
  } catch (err) {
    return errorRes(res, 'Failed to update user', [err.message], 500);
  }
};

const deleteUser = async (req, res) => {
  try {
    const identifier = req.params.id || req.body.id || req.body.username;
    if (!identifier) {
      return errorRes(res, 'User ID or username is required for deletion', [], 400);
    }

    // Disallow deleting yourself (kept from the legacy flow)
    if (req.user && req.body.username && String(req.user.username).toLowerCase() === String(req.body.username).toLowerCase()) {
      return errorRes(res, 'You cannot delete your own active administrator account', [], 400);
    }

    req.params = { id: identifier };
    return userMgmtController.deleteUser(req, res);
  } catch (err) {
    return errorRes(res, 'Failed to delete user: ' + err.message, [err.message], 500);
  }
};

const getPageSettings = async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT role_page_key, allowed FROM page_visibility`);
    const settings = {};
    rows.forEach((r) => {
      settings[r.role_page_key] = !!r.allowed;
    });
    return res.json(settings);
  } catch (err) {
    // Log the actual DB error for diagnostics
    console.error('[getPageSettings ERROR] DB query failed:', err.code, err.message);
    // Return HTTP 500 with error - do NOT return empty object
    return errorRes(res, 'Failed to load page settings', [err.message], 500);
  }
};

const savePageSettings = async (req, res) => {
  try {
    const settings = req.body.settings || req.body;
    for (const key of Object.keys(settings)) {
      const [role, pageKey] = key.split('_');
      if (role && pageKey) {
        await db.query(
          `INSERT INTO page_visibility (role_page_key, role, page_key, allowed)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE allowed = VALUES(allowed)`,
          [key, role, pageKey, settings[key] ? 1 : 0]
        );
      }
    }

    await logAction(req.user ? req.user.username : 'Admin', 'SAVE_PAGE_SETTINGS', 'SETTINGS', settings);

    return res.json({ success: true });
  } catch (err) {
    return errorRes(res, 'Failed to save page settings', [err.message], 500);
  }
};

const getDesignations = async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT name FROM designations WHERE active = TRUE ORDER BY name ASC`);
    const designations = rows.map((r) => r.name);
    return res.json({ designations });
  } catch (err) {
    return res.json({ designations: [] });
  }
};

const getPublicDesignations = async (req, res) => {
  try {
    // 1. Auto-close filled openings
    const [hiredRows] = await db.query(`
      SELECT designation, COUNT(*) as cnt FROM candidates 
      WHERE LOWER(TRIM(status)) IN ('offer accepted', 'joined', 'offer finalized') 
      GROUP BY designation
    `);
    const [reqRows] = await db.query(`SELECT id, designation, required_count, status FROM manpower_requisitions`);
    
    for (const r of reqRows) {
      const match = hiredRows.find(h => h.designation && h.designation.trim().toLowerCase() === r.designation.trim().toLowerCase());
      const hiredCount = match ? match.cnt : 0;
      if (hiredCount >= r.required_count && r.required_count > 0 && r.status !== 'Filled' && r.status !== 'Closed') {
        await db.query(`UPDATE manpower_requisitions SET status = 'Filled' WHERE id = ?`, [r.id]);
        r.status = 'Filled';
      }
    }

    // 2. Fetch designations that are active AND have open vacancies
    const [rows] = await db.query(`
      SELECT DISTINCT d.name 
      FROM designations d
      LEFT JOIN manpower_requisitions mr ON LOWER(TRIM(d.name)) = LOWER(TRIM(mr.designation))
      WHERE d.active = TRUE 
      AND (mr.status IS NULL OR mr.status = 'Open')
      AND (mr.required_count IS NULL OR mr.required_count > 0)
      ORDER BY d.name ASC
    `);
    
    const designations = rows.map((r) => r.name);
    return res.json({ designations });
  } catch (err) {
    console.error('[Public Designations Error]', err);
    return res.json({ designations: [] });
  }
};

const addDesignation = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return errorRes(res, 'Designation name is required', [], 400);

    await db.query(
      `INSERT INTO designations (role_scope, name, active) VALUES ('All', ?, TRUE) ON DUPLICATE KEY UPDATE active = TRUE`,
      [name.trim()]
    );

    await logAction(req.user ? req.user.username : 'Admin', 'ADD_DESIGNATION', 'SETTINGS', { name });

    return res.json({ success: true });
  } catch (err) {
    return errorRes(res, 'Failed to add designation', [err.message], 500);
  }
};

const deleteDesignation = async (req, res) => {
  try {
    const { name } = req.body;
    await db.query(`UPDATE designations SET active = FALSE WHERE name = ?`, [name]);
    await db.query(`DELETE FROM manpower_requisitions WHERE designation = ?`, [name]);

    await logAction(req.user ? req.user.username : 'Admin', 'DELETE_DESIGNATION', 'SETTINGS', { name });

    return res.json({ success: true });
  } catch (err) {
    return errorRes(res, 'Failed to delete designation', [err.message], 500);
  }
};

const getAllInterviewQuestions = async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT * FROM interview_questions WHERE active = TRUE ORDER BY designation, round, q_id ASC`);
    const questions = rows.map((r) => ({
      desig: r.designation,
      round: r.round,
      qId: r.q_id,
      text: r.question,
      type: r.type,
      max: r.max_score,
      options: r.options || ''
    }));
    return res.json({ questions });
  } catch (err) {
    return res.json({ questions: [] });
  }
};

const addInterviewQuestion = async (req, res) => {
  try {
    const { desig, round, text, max } = req.body;
    if (!desig || !round || !text) {
      return errorRes(res, 'Designation, round, and question text are required', [], 400);
    }

    const [countRows] = await db.query(
      `SELECT COUNT(*) as cnt FROM interview_questions WHERE designation = ? AND round = ?`,
      [desig, round]
    );
    const nextQId = countRows[0].cnt + 1;

    await db.query(
      `INSERT INTO interview_questions (designation, round, q_id, question, type, max_score, active)
       VALUES (?, ?, ?, ?, 'score', ?, TRUE)`,
      [desig, round, nextQId, text.trim(), parseInt(max) || 10]
    );

    await logAction(req.user ? req.user.username : 'Admin', 'ADD_INTERVIEW_QUESTION', 'SETTINGS', { desig, round, text });

    return res.json({ success: true });
  } catch (err) {
    return errorRes(res, 'Failed to add interview question', [err.message], 500);
  }
};

const deleteInterviewQuestion = async (req, res) => {
  try {
    const { desig, round, text } = req.body;
    if (!desig || round === undefined || round === null || !text) {
      return errorRes(res, 'Designation, round and question text are required', [], 400);
    }
    const [result] = await db.query(
      `UPDATE interview_questions SET active = FALSE WHERE designation = ? AND round = ? AND question = ?`,
      [desig, round, text]
    );

    if (!result || !result.affectedRows) {
      return errorRes(res, 'Question not found — it may already have been removed', [], 404);
    }

    await logAction(req.user ? req.user.username : 'Admin', 'DELETE_INTERVIEW_QUESTION', 'SETTINGS', { desig, round, text });

    return res.json({ success: true });
  } catch (err) {
    return errorRes(res, 'Failed to delete interview question', [err.message], 500);
  }
};

const getDepartments = async (req, res) => {
  try {
    let dbDepartments = [];
    try {
      const [rows] = await db.query(
        `SELECT DISTINCT department FROM users WHERE department IS NOT NULL AND TRIM(department) <> '' ORDER BY department ASC`
      );
      dbDepartments = rows.map((r) => r.department);
    } catch (e) {}

    let sectionDepartments = [];
    try {
      const [rows] = await db.query(
        `SELECT DISTINCT department FROM department_sections WHERE department IS NOT NULL AND TRIM(department) <> ''`
      );
      sectionDepartments = rows.map((r) => r.department);
    } catch (e) {}

    return res.json({ departments: mergeOptions(DEFAULT_DEPARTMENTS, [...dbDepartments, ...sectionDepartments]) });
  } catch (err) {
    console.error('[Settings - getDepartments] error:', err.message);
    return res.json({ departments: DEFAULT_DEPARTMENTS });
  }
};

const getRoles = async (req, res) => {
  try {

    let roles = [];
    try {
      const [rows] = await db.query(
        `SELECT roleName as name FROM role WHERE (status = 'Active' OR status IS NULL) ORDER BY id ASC`
      );
      if (rows.length > 0) {
        roles = rows.map(r => r.name).filter(Boolean);
      }
    } catch (e1) {
      try {
        const [rows2] = await db.query(`SELECT name FROM roles ORDER BY id ASC`);
        if (rows2.length > 0) {
          roles = rows2.map(r => r.name).filter(Boolean);
        }
      } catch (e2) {}
    }

    return res.json({ roles });
  } catch (err) {
    console.error('[Settings - getRoles] error:', err.message);
    return errorRes(res, 'Failed to load roles', [err.message], 500);
  }
};

module.exports = {
  getUsers,
  addUser,
  updateUser,
  deleteUser,
  getPageSettings,
  savePageSettings,
  getDesignations,
  getPublicDesignations,
  addDesignation,
  deleteDesignation,
  getAllInterviewQuestions,
  addInterviewQuestion,
  deleteInterviewQuestion,
  getRoles,
  getDepartments
};
