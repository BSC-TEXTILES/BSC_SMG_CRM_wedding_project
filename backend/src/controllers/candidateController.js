const candidateService = require('../services/candidateService');
const userSyncService = require('../services/userSyncService');
const db = require('../config/db');
const { logAction } = require('../utils/logger');
const { successRes, errorRes } = require('../utils/response');
const { getLocationFilter, injectLocationId, getEffectiveLocationId } = require('../middleware/auth');
const realtimeService = require('../services/realtimeService');
let _dojSchemaChecked = false;
async function ensureDojSchema(database) {
  if (_dojSchemaChecked) return;
  try {
    await database.query(`
      CREATE TABLE IF NOT EXISTS candidate_doj_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        app_no VARCHAR(50) NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        new_doj DATE NULL,
        reporting_time VARCHAR(50) NULL,
        contact_result VARCHAR(150) NULL,
        candidate_response TEXT NULL,
        reason VARCHAR(255) NULL,
        remarks TEXT NULL,
        action_by VARCHAR(100) NULL,
        performed_by VARCHAR(100) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_cdh_app_no (app_no),
        INDEX idx_cdh_event (event_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(() => {});

    await database.query(`
      CREATE TABLE IF NOT EXISTS selection_offers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        candidate_id INT NULL,
        app_no VARCHAR(50) NOT NULL,
        name VARCHAR(150) NULL,
        designation VARCHAR(150) NULL,
        department VARCHAR(150) NULL,
        section VARCHAR(150) NULL,
        salary VARCHAR(100) NULL,
        notice_period VARCHAR(50) NULL,
        est_doj DATE NULL,
        actual_doj DATE NULL,
        status VARCHAR(50) DEFAULT 'Shortlisted',
        remarks TEXT NULL,
        location_id INT NULL,
        reporting_manager VARCHAR(150) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_so_app_no (app_no),
        INDEX idx_so_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(() => {});

    await database.query("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS offered_doj DATE NULL").catch(() => {});
    await database.query("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS is_deleted TINYINT(1) DEFAULT 0").catch(() => {});

    _dojSchemaChecked = true;
  } catch (err) {
    console.warn('[DOJ Desk ensureDojSchema Warning]', err.message);
  }
}

class CandidateController {
  async getCandidates(req, res) {
    try {
      // Pass authoritative locationId to service layer
      const locationId = getEffectiveLocationId(req);
      // Accept filters from either the query string or the JSON body: the
      // legacy `/legacy` dispatcher forwards params in req.body while the REST
      // route forwards them in req.query.
      const bodyFilters = (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) ? req.body : {};
      const result = await candidateService.getCandidates({ ...bodyFilters, ...req.query }, locationId);
      return res.json(result);
    } catch (err) {
      console.error('getCandidates ERROR:', err);
      return errorRes(res, 'DB_ERR: ' + err.message, [err.message], 500);
    }
  }

  async addCandidate(req, res) {
    try {
      const d = req.body.data || req.body;
      let locationId = injectLocationId(req);
      if (!locationId && (d.locationId || d.location_id)) {
        const rawLoc = d.locationId || d.location_id;
        const parsed = parseInt(rawLoc, 10);
        locationId = (!isNaN(parsed) && parsed > 0) ? parsed : null;
      }
      if (!locationId && req.user && req.user.locationId) {
        locationId = req.user.locationId;
      }
      if (!locationId) {
        locationId = 1;
      }
      const locCodeMap = { 1: 'BEL', 2: 'DAV', 3: 'SHI' };
      const locationCode = (req.user && req.user.locationCode) ? req.user.locationCode : (locCodeMap[locationId] || 'BEL');
      const result = await candidateService.addCandidate({ ...d, locationId, locationCode });
      realtimeService.emitCandidateChange('CREATE', { appNo: result.appNo, candidateCode: result.candidateCode, ...d }, locationId);
      return res.json({ success: true, appNo: result.appNo, candidateCode: result.candidateCode });
    } catch (err) {
      return errorRes(res, `Failed to add candidate: ${err.message}`, [err.message], 500);
    }
  }

  async updateCandidate(req, res) {
    try {
      const appNo = req.params.appNo || req.params.id || req.body.appNo;
      if (!appNo) {
        return errorRes(res, 'Application number is required', ['appNo missing'], 400);
      }

      let updates = req.body;
      if (req.body && typeof req.body.updates === 'object' && req.body.updates !== null) {
        updates = { ...req.body, ...req.body.updates };
      }
      const user = req.body.doneBy || updates.doneBy || (req.user ? req.user.username : 'HR');

      const result = await candidateService.updateCandidateFull(appNo, updates, user);
      realtimeService.emitCandidateChange('UPDATE', { appNo, ...updates }, req.user ? req.user.locationId : null);
      return res.json(result);
    } catch (err) {
      console.error('[updateCandidate Controller Error]:', err);
      return errorRes(res, 'Failed to update candidate: ' + err.message, [err.message], 500);
    }
  }

  async deleteCandidate(req, res) {
    try {
      const { appNo } = req.params;
      const result = await candidateService.deleteCandidate(appNo);
      realtimeService.emitCandidateChange('DELETE', { appNo }, req.user ? req.user.locationId : null);
      return res.json(result);
    } catch (err) {
      return errorRes(res, 'Failed to delete candidate', [err.message], 500);
    }
  }

  async checkDuplicate(req, res) {
    try {
      const phone = req.query.phone || req.body.phone;
      const result = await candidateService.checkDuplicate(phone);
      return res.json(result);
    } catch (err) {
      return res.json({ exists: false });
    }
  }

  async getNextAppNo(req, res) {
    try {
      const result = await candidateService.generateCandidateCode();
      return res.json({ appNo: result.appNo });
    } catch (err) {
      return res.json({ appNo: 'BSC-2026-0001' });
    }
  }

  async getKPIs(req, res) {
    try {
      const { range, fromDate, toDate } = req.query;
      const locationId = getEffectiveLocationId(req);
      const result = await candidateService.getKPIs(range, fromDate, toDate, locationId);
      return res.json(result);
    } catch (err) {
      return res.json({ total: 0 });
    }
  }

  async getActivityFull(req, res) {
    try {
      const appNo = req.query.appNo || req.body.appNo;
      const result = await candidateService.getActivityFull(appNo);
      return res.json(result);
    } catch (err) {
      return res.json({ success: false, error: err.message });
    }
  }

  async getSystemActivity(req, res) {
    try {
      const limit = parseInt(req.query.limit, 10) || 10;
      const locationId = getEffectiveLocationId(req);
      const result = await candidateService.getSystemActivity(limit, locationId);
      return res.json(result);
    } catch (err) {
      return res.json({ success: false, activity: [] });
    }
  }

  async uploadResume(req, res) {
    try {
      if (!req.file) {
        return errorRes(res, 'No file uploaded', [], 400);
      }
      const fileUrl = `/uploads/candidate-resumes/${req.file.filename}`;
      if (req.body.appNo) {
        await candidateService.updateCandidate(req.body.appNo, { resumeUrl: fileUrl });
      }
      return res.json({
        success: true,
        fileUrl,
        fileName: req.file.filename
      });
    } catch (err) {
      return errorRes(res, 'File upload failed', [err.message], 500);
    }
  }

  async uploadDocuments(req, res) {
    try {
      const result = {};
      const appNo = req.headers['x-app-no'] || req.body.appNo || req.query.appNo;
      
      if (req.files) {
        if (req.files['resume'] && req.files['resume'][0]) {
          result.resumeUrl = appNo 
            ? `uploads/applicants/${appNo}/${req.files['resume'][0].filename}` 
            : `uploads/candidate-resumes/${req.files['resume'][0].filename}`;
        }
        if (req.files['photo'] && req.files['photo'][0]) {
          result.photoUrl = appNo 
            ? `uploads/applicants/${appNo}/${req.files['photo'][0].filename}` 
            : `uploads/candidate-photos/${req.files['photo'][0].filename}`;
        }
        if (req.files['aadhar'] && req.files['aadhar'][0]) {
          result.aadhaarUrl = appNo 
            ? `uploads/applicants/${appNo}/${req.files['aadhar'][0].filename}` 
            : `uploads/employee-documents/${req.files['aadhar'][0].filename}`;
        }
      }
      return res.json({ success: true, ...result });
    } catch (err) {
      return errorRes(res, 'File upload failed', [err.message], 500);
    }
  }

  async getPendingActions(req, res) {
    try {
      const locationId = getEffectiveLocationId(req);
      const result = await candidateService.getPendingActions(locationId);
      return res.json(result);
    } catch (err) {
      return res.json({ actions: [] });
    }
  }

  async getSourceBreakdown(req, res) {
    try {
      const locationId = getEffectiveLocationId(req);
      const result = await candidateService.getSourceBreakdown(locationId);
      return res.json(result);
    } catch (err) {
      return res.json({ breakdown: [] });
    }
  }

  async getOpenings(req, res) {
    try {
      const db = require('../config/db');
      const { clause: locClause, params: locParams } = await getLocationFilter(req, 'c');

      const [reqRows] = await db.query(`SELECT designation, required_count FROM manpower_requisitions`);
      const reqMap = {};
      reqRows.forEach(r => {
        if (r.designation) reqMap[r.designation.trim().toLowerCase()] = r.required_count;
      });

      // Count hired candidates filtered by location
      const [hiredRows] = await db.query(
        `SELECT c.designation, COUNT(*) as cnt 
         FROM candidates c
         LEFT JOIN selection_offers so ON c.app_no = so.app_no
         WHERE (LOWER(TRIM(c.status)) IN ('joined', 'hired') 
            OR LOWER(TRIM(so.status)) IN ('joined'))
         ${locClause}
         GROUP BY c.designation`,
        locParams
      );
      const hiredMap = {};
      hiredRows.forEach(r => {
        if (r.designation) {
          const key = r.designation.trim().toLowerCase();
          hiredMap[key] = (hiredMap[key] || 0) + r.cnt;
        }
      });

      const [desigRows] = await db.query(`SELECT name FROM designations WHERE active = TRUE`);
      const desigSet = new Set([...desigRows.map(d => d.name)]);
      
      reqRows.forEach(r => { if (r.designation) desigSet.add(r.designation); });
      hiredRows.forEach(r => { if (r.designation) desigSet.add(r.designation); });

      const openings = Array.from(desigSet).map(desigName => {
        const key = desigName.trim().toLowerCase();
        const required = reqMap[key] || 0;
        const hired = hiredMap[key] || 0;
        return {
          designation: desigName,
          required,
          hired,
          remaining: Math.max(0, required - hired)
        };
      });

      openings.sort((a, b) => (a.designation || '').localeCompare(b.designation || ''));
      return res.json({ success: true, openings });
    } catch (err) {
      return errorRes(res, 'Failed to fetch openings', [err.message], 500);
    }
  }

  async updateOpening(req, res) {
    try {
      const db = require('../config/db');
      const { designation, required_count } = req.body;
      
      const [rows] = await db.query(`SELECT id FROM manpower_requisitions WHERE designation = ?`, [designation]);
      if (rows.length > 0) {
        await db.query(`UPDATE manpower_requisitions SET required_count = ? WHERE designation = ?`, [required_count, designation]);
      } else {
        await db.query(`INSERT INTO manpower_requisitions (designation, required_count) VALUES (?, ?)`, [designation, required_count]);
      }
      
      return res.json({ success: true });
    } catch (err) {
      return errorRes(res, 'Failed to update opening', [err.message], 500);
    }
  }

  /**
   * GET /api/employees — Employee Master Directory listing.
   *
   * Delegates to employeeMasterService so the directory page and the four
   * pre-existing consumers (Attendance, Dashboard, DepartmentHiring,
   * SectionAllocation) share one query, one location scope and one DTO.
   *
   * Back-compatible contract: `{ success, employees, total }`. The directory
   * additionally receives `stats`, `facets`, `actions` and pagination fields.
   */
  async getEmployees(req, res) {
    try {
      const employeeMasterService = require('../services/employeeMasterService');
      const result = await employeeMasterService.listEmployees(req, req.query || {});
      return res.json({
        success: true,
        employees: Array.isArray(result?.employees) ? result.employees : [],
        total: result?.filteredTotal ?? (result?.employees?.length || 0),
        filteredTotal: result?.filteredTotal ?? (result?.employees?.length || 0),
        page: result?.page || 1,
        pageSize: result?.pageSize || (result?.employees?.length || 0),
        stats: result?.stats || {},
        facets: result?.facets || {},
        actions: result?.actions || { can_view: true, can_add: false, can_edit: false, can_delete: false, can_export: false }
      });
    } catch (err) {
      console.error('[candidateController.getEmployees Error]', err?.message, err?.stack);

      // Resilient fallback: query active users table directly so the Employee Directory never returns 500
      try {
        const pool = require('../config/db');
        const { getLocationFilter } = require('../middleware/auth');
        const { clause, params } = await getLocationFilter(req, 'u');
        const [rows] = await pool.query(
          `SELECT u.id, u.id as user_id, u.username, u.full_name as name, u.full_name as fullName,
                  u.email, u.phone, u.employee_id as empNo, u.employee_id as employeeId,
                  u.role, u.department, u.designation, u.section, u.active, u.location_id as locationId,
                  u.joining_date as joiningDate, l.location_name as locationName
           FROM users u
           LEFT JOIN locations l ON l.id = u.location_id
           WHERE u.active = 1 ${clause}
             AND LOWER(COALESCE(u.role, '')) NOT IN ('admin', 'super admin', 'system administrator', 'customer', 'guest')
             AND LOWER(COALESCE(u.username, '')) NOT IN ('admin', 'admin@bsctextiles.com', 'ghost')
             AND LOWER(COALESCE(u.full_name, '')) NOT LIKE '%system administrator%'
           ORDER BY LOWER(u.full_name) ASC`,
          params
        );

        const canViewSensitive = ['Admin', 'Super Admin', 'system administrator'].includes(req.user?.role) || req.user?.isGlobalAdmin;
        const colors = ['navy', 'gold', 'green', 'red', 'purple', 'teal'];
        const mapped = (rows || []).map(r => ({
          ...r,
          id: r.id,
          userId: r.id,
          name: r.name || r.username || 'Employee',
          fullName: r.name || r.username || 'Employee',
          appNo: r.empNo || `EMP-${String(r.id).padStart(4, '0')}`,
          employeeCode: r.empNo || `EMP-${String(r.id).padStart(4, '0')}`,
          empNo: canViewSensitive ? (r.empNo || `EMP-${String(r.id).padStart(4, '0')}`) : '',
          phone: canViewSensitive ? (r.phone || '') : '',
          email: canViewSensitive ? (r.email || '') : '',
          status: r.active ? 'Joined' : 'Inactive',
          color: colors[(r.id || 0) % colors.length],
          initials: (r.name || 'E').split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || 'E',
          photoUrl: '',
          hasPhoto: false,
          hasDocuments: false,
          canViewSensitive
        }));

        return res.json({
          success: true,
          employees: mapped,
          total: mapped.length,
          filteredTotal: mapped.length,
          page: 1,
          pageSize: mapped.length,
          stats: { total: mapped.length, active: mapped.length, inactive: 0 },
          facets: {},
          actions: {
            can_view: true,
            can_add: ['Admin', 'Super Admin', 'HR', 'Manager'].includes(req.user?.role),
            can_edit: ['Admin', 'Super Admin', 'HR', 'Manager'].includes(req.user?.role),
            can_delete: ['Admin', 'Super Admin'].includes(req.user?.role),
            can_export: true
          }
        });
      } catch (fallbackErr) {
        console.error('[candidateController.getEmployees Fallback Error]', fallbackErr?.message);
        return res.json({
          success: true,
          employees: [],
          total: 0,
          filteredTotal: 0,
          page: 1,
          pageSize: 0,
          stats: { total: 0, active: 0, inactive: 0 },
          facets: {},
          actions: { can_view: true, can_add: false, can_edit: false, can_delete: false, can_export: false }
        });
      }
    }
  }

  /**
   * Update an Employee Directory record.
   * ------------------------------------------------------------------
   * `users` is the single source of truth, so the master account fields are
   * written first and the linked recruitment record is then aligned. The
   * Employee Directory, User Management, location dashboards and department
   * sections all read the same row, so one save updates every section.
   *
   * :id accepts a user id, a username or a candidate application number.
   */
  async updateEmployee(req, res) {
    try {
      const identifier = req.params.id;
      const payload = { ...(req.body || {}) };
      if (payload.data && typeof payload.data === 'object') Object.assign(payload, payload.data);
      if (payload.updates && typeof payload.updates === 'object') Object.assign(payload, payload.updates);

      const user = await userSyncService.resolveUser(identifier);
      if (!user) {
        return errorRes(res, 'Employee not found', [], 404);
      }

      const doneBy = req.user ? req.user.username : 'HR';
      const linkedAppNo = user.candidate_app_no || payload.appNo || payload.candidateAppNo || null;

      // 1. HR-owned recruitment fields (DOB, salary, documents, section …)
      //    `syncUser: false` keeps this function the single writer so the two
      //    tables cannot bounce values off each other.
      if (linkedAppNo) {
        await candidateService.updateCandidateFull(linkedAppNo, payload, doneBy, { syncUser: false });
      }

      // 2. Master account fields — authoritative for the shared values
      const fields = [];
      const params = [];

      const fullName = payload.fullName !== undefined ? payload.fullName : payload.name;
      if (fullName !== undefined && String(fullName).trim() !== '') {
        fields.push('full_name = ?');
        params.push(String(fullName).trim());
      }
      if (payload.email !== undefined) { fields.push('email = ?'); params.push(payload.email || null); }
      if (payload.phone !== undefined) { fields.push('phone = ?'); params.push(payload.phone || null); }
      if (payload.department !== undefined) { fields.push('department = ?'); params.push(payload.department || null); }

      const designation = payload.designation !== undefined ? payload.designation : payload.desig;
      if (designation !== undefined) { fields.push('designation = ?'); params.push(designation || null); }

      const employeeId = payload.employeeId !== undefined ? payload.employeeId : payload.empNo;
      if (employeeId !== undefined && employeeId !== null && String(employeeId).trim() !== '') {
        fields.push('employee_id = ?');
        params.push(String(employeeId).trim());
      }
      if (payload.active !== undefined) { fields.push('active = ?'); params.push(payload.active ? 1 : 0); }

      if (fields.length > 0) {
        params.push(user.id);
        await db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
      }

      // 3. Push the account values outward so every other view converges
      await userSyncService.ensureEmployeeId(user.id);
      await userSyncService.syncCandidateFromUser(user.id);

      await logAction(req.user ? req.user.username : 'HR', 'UPDATE_EMPLOYEE', 'EMPLOYEES', {
        userId: user.id, appNo: linkedAppNo, changes: Object.keys(payload)
      });

      realtimeService.emitEmployeeChange('UPDATE', {
        id: user.id,
        appNo: linkedAppNo,
        department: payload.department,
        designation: payload.designation || payload.desig,
        status: payload.status
      }, user.location_id || (req.user ? req.user.locationId : null));

      return res.json({ success: true, userId: user.id, appNo: linkedAppNo });
    } catch (err) {
      console.error('[updateEmployee ERROR]', err);
      return errorRes(res, 'Failed to update employee: ' + err.message, [err.message], 500);
    }
  }

  /**
   * Delete an Employee Directory record.
   * Removes the recruitment history AND the master login account it was
   * derived from, then releases every cross-module reference, so no dashboard
   * can keep showing a stale or duplicate employee.
   */
  async deleteEmployee(req, res) {
    try {
      const identifier = req.params.id;
      const user = await userSyncService.resolveUser(identifier);

      // Access Control Matrix: only roles with can_delete on `employees` may
      // remove a record — the route-level role list is a second, coarser gate.
      const employeeMasterService = require('../services/employeeMasterService');
      const actions = await employeeMasterService.resolveEmployeeActions(req.user);
      if (!actions.can_delete) {
        return errorRes(res, 'You do not have permission to delete employees', [], 403);
      }
      if (user) {
        const inScope = await employeeMasterService.assertLocationScope(req, user.location_id);
        if (!inScope) {
          return errorRes(res, 'You do not have access to this employee record', [], 403);
        }
        if (req.user && user.id === req.user.id) {
          return errorRes(res, 'You cannot delete your own account', [], 400);
        }
      }

      if (user && ['admin@bsctextiles.com', 'admin'].includes(String(user.username).toLowerCase())) {
        return errorRes(res, 'Cannot delete the built-in system administrator account', [], 403);
      }

      const appNo = (user && user.candidate_app_no) || (req.body && req.body.appNo) || null;

      // Deleting the candidate cascades to offers/interviews/activities and to
      // the linked master account (see candidateService.deleteCandidate).
      if (appNo) {
        await candidateService.deleteCandidate(appNo);
      }
      // Idempotent safety net for accounts that have no candidate record.
      if (user) {
        await userSyncService.deleteUserCompletely(user.id);
      }

      await logAction(req.user ? req.user.username : 'HR', 'DELETE_EMPLOYEE', 'EMPLOYEES', {
        userId: user ? user.id : null, appNo, identifier
      });

      realtimeService.emitEmployeeChange('DELETE', {
        id: user ? user.id : identifier,
        appNo
      }, user?.location_id || (req.user ? req.user.locationId : null));

      return res.json({ success: true });
    } catch (err) {
      console.error('[deleteEmployee ERROR]', err);
      return errorRes(res, 'Failed to delete employee', [err.message], 500);
    }
  }

  async bulkAddEmployees(req, res) {
    try {
      const { employees } = req.body;
      if (!employees || !Array.isArray(employees)) {
        return res.status(400).json({ success: false, error: 'Invalid payload' });
      }
      
      const user = req.user ? req.user.username : 'HR';
      const result = await candidateService.bulkAddEmployees(employees, user);
      realtimeService.emitEmployeeChange('CREATE', { count: employees.length }, req.user ? req.user.locationId : null);
      return res.json(result);
    } catch (err) {
      return errorRes(res, 'Failed to bulk import employees', [err.message], 500);
    }
  }

  // ── DOJ & Not Joined Desk ────────────────────────────────────
  async getNotJoinedDesk(req, res) {
    try {
      const db = require('../config/db');
      await ensureDojSchema(db);

      const { clause: locClause, params: locParams } = await getLocationFilter(req, 'c');
      const { search, status, overdueOnly, filterType, department, locationId } = req.query;

      let sql = `
        SELECT 
          c.app_no,
          c.name,
          c.phone,
          c.email,
          c.designation,
          c.department,
          c.section,
          c.source,
          c.referrer,
          c.reporting_manager,
          c.salary,
          c.experience,
          c.qualification,
          c.city_state,
          c.remarks as candidate_remarks,
          c.status as candidate_status,
          COALESCE(c.created_at, so.created_at) as offer_date,
          COALESCE(so.est_doj, c.offered_doj) as scheduled_doj,
          so.status as offer_status,
          so.notice_period,
          so.remarks as offer_remarks,
          c.location_id,
          l.location_name,
          l.location_code,
          DATEDIFF(CURDATE(), COALESCE(so.est_doj, c.offered_doj)) as delay_days,
          CASE 
            WHEN COALESCE(so.est_doj, c.offered_doj) < CURDATE() THEN 'Overdue'
            WHEN COALESCE(so.est_doj, c.offered_doj) = CURDATE() THEN 'Joining Today'
            ELSE 'Upcoming'
          END as doj_urgency,
          (SELECT created_at FROM candidate_doj_history WHERE app_no = c.app_no AND event_type = 'FOLLOW_UP' ORDER BY id DESC LIMIT 1) as last_followup_date,
          (SELECT contact_result FROM candidate_doj_history WHERE app_no = c.app_no AND event_type = 'FOLLOW_UP' ORDER BY id DESC LIMIT 1) as last_contact_result,
          (SELECT remarks FROM candidate_doj_history WHERE app_no = c.app_no AND event_type = 'FOLLOW_UP' ORDER BY id DESC LIMIT 1) as last_followup_remarks,
          (SELECT reason FROM candidate_doj_history WHERE app_no = c.app_no AND event_type = 'FOLLOW_UP' ORDER BY id DESC LIMIT 1) as next_action
        FROM candidates c
        LEFT JOIN locations l ON l.id = c.location_id
        LEFT JOIN selection_offers so ON c.app_no = so.app_no
        WHERE (c.is_deleted = 0 OR c.is_deleted IS NULL)
          AND (c.offered_doj IS NOT NULL OR so.est_doj IS NOT NULL)
          AND COALESCE(so.status, c.status) NOT IN ('Joined', 'Offer Rejected', 'Rejected', 'Not Joined')
          AND c.app_no NOT IN (SELECT candidate_app_no FROM users WHERE candidate_app_no IS NOT NULL AND active = 1)
          ${locClause}
      `;
      const params = [...locParams];

      if (locationId && locationId !== 'all' && !locClause.includes('location_id')) {
        sql += ` AND c.location_id = ?`;
        params.push(locationId);
      }

      if (department && department !== 'all') {
        sql += ` AND LOWER(COALESCE(c.department, '')) = LOWER(?)`;
        params.push(department);
      }

      if (status && status !== 'all') {
        sql += ` AND (so.status = ? OR c.status = ?)`;
        params.push(status, status);
      }

      if (overdueOnly === 'true' || overdueOnly === true || filterType === 'overdue') {
        sql += ` AND COALESCE(so.est_doj, c.offered_doj) < CURDATE()`;
      } else if (filterType === 'today') {
        sql += ` AND COALESCE(so.est_doj, c.offered_doj) = CURDATE()`;
      } else if (filterType === 'upcoming') {
        sql += ` AND COALESCE(so.est_doj, c.offered_doj) > CURDATE()`;
      }

      if (search) {
        sql += ` AND (c.name LIKE ? OR c.app_no LIKE ? OR c.phone LIKE ? OR c.designation LIKE ? OR c.department LIKE ?)`;
        const s = `%${search}%`;
        params.push(s, s, s, s, s);
      }

      sql += ` ORDER BY COALESCE(so.est_doj, c.offered_doj) ASC`;

      const [rows] = await db.query(sql, params).catch(async (queryErr) => {
        console.warn('[getNotJoinedDesk] Primary query issue:', queryErr.message);
        // Fallback: query without subqueries in case of older schema
        const fallbackSql = `
          SELECT 
            c.app_no, c.name, c.phone, c.email, c.designation, c.department, c.section,
            c.source, c.referrer, c.reporting_manager, c.salary, c.experience, c.qualification,
            c.city_state, c.remarks as candidate_remarks, c.status as candidate_status,
            COALESCE(c.created_at, so.created_at) as offer_date,
            COALESCE(so.est_doj, c.offered_doj) as scheduled_doj,
            so.status as offer_status, so.notice_period, so.remarks as offer_remarks,
            c.location_id, l.location_name, l.location_code,
            DATEDIFF(CURDATE(), COALESCE(so.est_doj, c.offered_doj)) as delay_days,
            CASE 
              WHEN COALESCE(so.est_doj, c.offered_doj) < CURDATE() THEN 'Overdue'
              WHEN COALESCE(so.est_doj, c.offered_doj) = CURDATE() THEN 'Joining Today'
              ELSE 'Upcoming'
            END as doj_urgency,
            NULL as last_followup_date, NULL as last_contact_result,
            NULL as last_followup_remarks, NULL as next_action
          FROM candidates c
          LEFT JOIN locations l ON l.id = c.location_id
          LEFT JOIN selection_offers so ON c.app_no = so.app_no
          WHERE (c.is_deleted = 0 OR c.is_deleted IS NULL)
            AND (c.offered_doj IS NOT NULL OR so.est_doj IS NOT NULL)
            AND COALESCE(so.status, c.status) NOT IN ('Joined', 'Offer Rejected', 'Rejected', 'Not Joined')
            AND c.app_no NOT IN (SELECT candidate_app_no FROM users WHERE candidate_app_no IS NOT NULL AND active = 1)
            ${locClause}
          ORDER BY COALESCE(so.est_doj, c.offered_doj) ASC
        `;
        const [fallbackRows] = await db.query(fallbackSql, locParams).catch(() => [[]]);
        return [fallbackRows || []];
      });

      // Compute stats for all pending candidates in scope without filterType restriction
      let statsSql = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN COALESCE(so.est_doj, c.offered_doj) < CURDATE() THEN 1 ELSE 0 END) as overdue,
          SUM(CASE WHEN COALESCE(so.est_doj, c.offered_doj) = CURDATE() THEN 1 ELSE 0 END) as today,
          SUM(CASE WHEN COALESCE(so.est_doj, c.offered_doj) > CURDATE() THEN 1 ELSE 0 END) as upcoming
        FROM candidates c
        LEFT JOIN selection_offers so ON c.app_no = so.app_no
        WHERE (c.is_deleted = 0 OR c.is_deleted IS NULL)
          AND (c.offered_doj IS NOT NULL OR so.est_doj IS NOT NULL)
          AND COALESCE(so.status, c.status) NOT IN ('Joined', 'Offer Rejected', 'Rejected', 'Not Joined')
          AND c.app_no NOT IN (SELECT candidate_app_no FROM users WHERE candidate_app_no IS NOT NULL AND active = 1)
          ${locClause}
      `;
      const statsParams = [...locParams];
      if (locationId && locationId !== 'all' && !locClause.includes('location_id')) {
        statsSql += ` AND c.location_id = ?`;
        statsParams.push(locationId);
      }
      const [statsRows] = await db.query(statsSql, statsParams).catch(() => [[{ total: 0, overdue: 0, today: 0, upcoming: 0 }]]);
      const statsBase = statsRows[0] || {};
      const total = Number(statsBase.total) || 0;
      const overdue = Number(statsBase.overdue) || 0;
      const today = Number(statsBase.today) || 0;
      const upcoming = Number(statsBase.upcoming) || 0;

      // Active Store Staff count (across permitted locations)
      let activeStaff = 0;
      try {
        const { clause: uLocClause, params: uLocParams } = await getLocationFilter(req, 'u');
        const [activeStaffRows] = await db.query(
          `SELECT COUNT(*) as cnt FROM users u WHERE u.active = 1 ${uLocClause}
           AND LOWER(COALESCE(u.role, '')) NOT IN ('admin', 'super admin', 'system administrator', 'customer', 'guest')
           AND LOWER(COALESCE(u.username, '')) NOT IN ('admin', 'admin@bsctextiles.com', 'ghost')
           AND LOWER(COALESCE(u.full_name, '')) NOT LIKE '%system administrator%'`,
          uLocParams
        ).catch(() => [[{ cnt: 0 }]]);
        activeStaff = Number(activeStaffRows[0]?.cnt) || 0;
      } catch (_uErr) {
        activeStaff = 0;
      }

      return res.json({
        success: true,
        stats: { total, overdue, today, upcoming, activeStaff },
        candidates: rows || []
      });
    } catch (err) {
      console.error('[getNotJoinedDesk ERROR]', err);
      return res.status(500).json({ success: false, error: err.message, stats: { total: 0, overdue: 0, today: 0, upcoming: 0, activeStaff: 0 }, candidates: [] });
    }
  }

  async handleNotJoinedAction(req, res) {
    try {
      const db = require('../config/db');
      await ensureDojSchema(db);
      const { 
        appNo, 
        action, 
        new_doj, 
        reporting_time, 
        reason, 
        remarks, 
        contact_result, 
        candidate_response, 
        next_action, 
        next_followup_date,
        actual_doj,
        department,
        designation,
        section,
        location_id,
        reporting_manager,
        employee_id,
        joining_remarks,
        verification_status
      } = req.body;

      if (!action) {
        return res.status(400).json({ success: false, message: 'Action is required' });
      }

      const now = new Date();
      const username = req.user ? (req.user.fullName || req.user.username) : 'HR Operations';

      // Action: Quick Add / Schedule new candidate for DOJ from the desk
      if (action === 'quick_add_doj' || action === 'schedule_doj') {
        const { name, phone, email, offered_doj, salary, notice_period } = req.body;
        if (!name || !phone || !offered_doj) {
          return res.status(400).json({ success: false, message: 'Name, phone, and offered DOJ date are required' });
        }

        // Generate app_no
        const [lastRow] = await db.query('SELECT app_no FROM candidates ORDER BY id DESC LIMIT 1');
        let nextNum = 1001;
        if (lastRow && lastRow[0]?.app_no) {
          const m = String(lastRow[0].app_no).match(/\d+/);
          if (m) nextNum = parseInt(m[0], 10) + 1;
        }
        const assignedAppNo = appNo || `BSC-${nextNum}`;

        const locId = location_id || req.user?.locationId || 1;
        let locCode = 'SHI';
        try {
          const [lRow] = await db.query('SELECT location_code FROM locations WHERE id = ? LIMIT 1', [locId]);
          if (lRow && lRow[0]?.location_code) locCode = lRow[0].location_code;
        } catch (e) {}

        await db.query(
          `INSERT INTO candidates 
            (app_no, name, phone, email, designation, department, section, location_id, location_code, offered_doj, salary, notice_period, reporting_manager, remarks, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Offer Accepted', ?, ?)`,
          [
            assignedAppNo,
            name,
            phone,
            email || null,
            designation || 'Retail Associate',
            department || 'Store Operations',
            section || null,
            locId,
            locCode,
            offered_doj,
            salary || null,
            notice_period || 'Immediate',
            reporting_manager || null,
            remarks || 'DOJ scheduled via DOJ Desk',
            now,
            now
          ]
        );

        await db.query(
          `INSERT INTO selection_offers 
            (app_no, name, designation, status, est_doj, notice_period, department, reporting_manager, section, salary, location_id, created_at, updated_at)
           VALUES (?, ?, ?, 'Offer Accepted', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            assignedAppNo,
            name,
            designation || 'Retail Associate',
            offered_doj,
            notice_period || 'Immediate',
            department || 'Store Operations',
            reporting_manager || null,
            section || null,
            salary || null,
            locId,
            now,
            now
          ]
        );

        await db.query(
          `INSERT INTO candidate_doj_history
            (app_no, event_type, new_doj, reporting_time, reason, remarks, performed_by, created_at)
           VALUES (?, 'DOJ_SCHEDULED', ?, ?, ?, ?, ?, ?)`,
          [assignedAppNo, offered_doj, reporting_time || '10:00 AM', 'Initial DOJ scheduled', remarks || 'Scheduled via DOJ Desk', username, now]
        );

        await logAction(username, 'SCHEDULE_DOJ', 'DOJ_DESK', { appNo: assignedAppNo, name, offered_doj });
        return res.json({ success: true, message: `Candidate ${name} (${assignedAppNo}) scheduled for DOJ on ${offered_doj}!`, appNo: assignedAppNo });
      }

      if (!appNo) {
        return res.status(400).json({ success: false, message: 'appNo is required' });
      }

      // Action: Reschedule DOJ
      if (action === 'reschedule') {
        if (!new_doj) {
          return res.status(400).json({ success: false, message: 'New DOJ date is required for rescheduling' });
        }

        // Get previous DOJ
        const [candRows] = await db.query('SELECT offered_doj, name, location_id FROM candidates WHERE app_no = ? LIMIT 1', [appNo]);
        const prevDoj = candRows[0]?.offered_doj ? new Date(candRows[0].offered_doj).toISOString().split('T')[0] : null;

        await db.query(`UPDATE candidates SET offered_doj = ?, updated_at = ? WHERE app_no = ?`, [new_doj, now, appNo]);
        await db.query(
          `UPDATE selection_offers SET est_doj = ?, remarks = CONCAT(COALESCE(remarks, ''), '\nRescheduled DOJ: ', ?, ' Reason: ', ?), updated_at = ? WHERE app_no = ?`,
          [new_doj, new_doj, reason || remarks || 'No reason specified', now, appNo]
        );

        await db.query(
          `INSERT INTO candidate_doj_history
            (app_no, event_type, previous_doj, new_doj, reporting_time, reason, remarks, performed_by, created_at)
           VALUES (?, 'DOJ_RESCHEDULED', ?, ?, ?, ?, ?, ?, ?)`,
          [appNo, prevDoj, new_doj, reporting_time || null, reason || 'DOJ Rescheduled', remarks || null, username, now]
        );

        await logAction(username, 'RESCHEDULE_DOJ', 'DOJ_DESK', { appNo, prevDoj, new_doj, reason, reporting_time });
        return res.json({ success: true, message: `Date of Joining successfully updated to ${new_doj}` });
      }

      // Action: Follow-Up
      if (action === 'follow_up') {
        const contactResult = contact_result || 'Call Connected';
        const candResponse = candidate_response || remarks || 'Followed up with candidate';
        const nextAction = next_action || 'Continue follow-up';

        await db.query(
          `INSERT INTO candidate_doj_history
            (app_no, event_type, contact_result, candidate_response, reason, new_doj, remarks, performed_by, created_at)
           VALUES (?, 'FOLLOW_UP', ?, ?, ?, ?, ?, ?, ?)`,
          [appNo, contactResult, candResponse, nextAction, next_followup_date || null, remarks || null, username, now]
        );

        await db.query(
          `UPDATE candidates SET remarks = CONCAT(COALESCE(remarks, ''), '\nFollow-up: ', ?), updated_at = ? WHERE app_no = ?`,
          [`[${now.toLocaleDateString()}] ${contactResult}: ${candResponse}`, now, appNo]
        );

        await logAction(username, 'CANDIDATE_FOLLOW_UP', 'DOJ_DESK', { appNo, contactResult, nextAction });
        return res.json({ success: true, message: 'Follow-up activity recorded successfully' });
      }

      // Action: Mark Not Joining
      if (action === 'mark_not_joining') {
        const dropReason = reason || remarks || 'Candidate confirmed not joining';
        await db.query(`UPDATE candidates SET status = 'Not Joined', remarks = CONCAT(COALESCE(remarks, ''), '\nNot Joining: ', ?), updated_at = ? WHERE app_no = ?`, [dropReason, now, appNo]);
        await db.query(`UPDATE selection_offers SET status = 'Offer Rejected', remarks = CONCAT(COALESCE(remarks, ''), '\nNot Joined: ', ?), updated_at = ? WHERE app_no = ?`, [dropReason, now, appNo]);

        await db.query(
          `INSERT INTO candidate_doj_history
            (app_no, event_type, reason, remarks, performed_by, created_at)
           VALUES (?, 'NOT_JOINING', ?, ?, ?, ?)`,
          [appNo, dropReason, remarks || null, username, now]
        );

        await logAction(username, 'MARK_NOT_JOINING', 'DOJ_DESK', { appNo, reason: dropReason });
        return res.json({ success: true, message: 'Candidate marked as Not Joining' });
      }

      // Action: Mark Joined
      if (action === 'mark_joined') {
        const effectiveDoj = actual_doj || new_doj || now.toISOString().split('T')[0];
        
        // 1. Fetch existing candidate info
        const [candRows] = await db.query(
          `SELECT c.*, l.location_name, l.location_code FROM candidates c
           LEFT JOIN locations l ON l.id = c.location_id
           WHERE c.app_no = ? LIMIT 1`,
          [appNo]
        );
        const cand = candRows[0] || {};

        const effectiveDept = department || cand.department || 'Store Operations';
        const effectiveDesig = designation || cand.designation || 'Retail Associate';
        const effectiveSec = section || cand.section || null;
        const effectiveLocId = location_id || cand.location_id || 1;
        const effectiveLocCode = cand.location_code || 'SHI';
        const effectiveRepMgr = reporting_manager || cand.reporting_manager || null;

        // 2. Update candidate & offer status
        await db.query(`UPDATE candidates SET status = 'Joined', offered_doj = ?, updated_at = ? WHERE app_no = ?`, [effectiveDoj, now, appNo]);
        await db.query(`UPDATE selection_offers SET status = 'Joined', actual_doj = ?, updated_at = ? WHERE app_no = ?`, [effectiveDoj, now, appNo]);

        // 3. Sync to employees table (avoiding duplicates)
        const [existingEmp] = await db.query(
          'SELECT id, employee_id FROM employees WHERE app_no = ? OR phone = ? LIMIT 1',
          [appNo, cand.phone]
        );

        let finalEmpCode = employee_id || existingEmp[0]?.employee_id || null;
        if (!finalEmpCode) {
          // Generate EMP-XXXX code
          const [maxEmp] = await db.query('SELECT employee_id FROM employees WHERE employee_id LIKE "EMP-%" ORDER BY id DESC LIMIT 1');
          let nextId = 5010;
          if (maxEmp && maxEmp[0]?.employee_id) {
            const num = parseInt(String(maxEmp[0].employee_id).replace(/\D+/g, ''), 10);
            if (!isNaN(num)) nextId = num + 1;
          }
          finalEmpCode = `EMP-${nextId}`;
        }

        if (existingEmp.length > 0) {
          await db.query(
            `UPDATE employees SET 
              name = ?, email = COALESCE(?, email), phone = ?, department = ?, designation = ?, section = ?, branch = ?, status = 'Active', joining_date = ?, updated_at = ?
             WHERE id = ?`,
            [cand.name || 'Store Staff', cand.email, cand.phone || '', effectiveDept, effectiveDesig, effectiveSec, effectiveLocCode, effectiveDoj, now, existingEmp[0].id]
          );
        } else {
          await db.query(
            `INSERT INTO employees 
              (employee_id, app_no, name, email, phone, department, designation, section, branch, status, joining_date, salary, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?, ?, ?)`,
            [
              finalEmpCode,
              appNo,
              cand.name || 'Store Staff',
              cand.email || null,
              cand.phone || '',
              effectiveDept,
              effectiveDesig,
              effectiveSec,
              effectiveLocCode,
              effectiveDoj,
              cand.salary || null,
              now,
              now
            ]
          );
        }

        // 4. Sync/Update users table as active store staff
        const [existingUser] = await db.query(
          'SELECT id FROM users WHERE candidate_app_no = ? OR (phone = ? AND phone IS NOT NULL AND phone != "") LIMIT 1',
          [appNo, cand.phone]
        );

        if (existingUser.length > 0) {
          await db.query(
            `UPDATE users SET 
              active = 1, department = ?, designation = ?, section = ?, location_id = ?, joining_date = ?, employee_id = COALESCE(employee_id, ?), updated_at = ?
             WHERE id = ?`,
            [effectiveDept, effectiveDesig, effectiveSec, effectiveLocId, effectiveDoj, finalEmpCode, now, existingUser[0].id]
          );
        } else if (cand.name && cand.phone) {
          const userSlug = (cand.name.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + appNo.replace(/\D+/g, '')).slice(0, 30);
          await db.query(
            `INSERT INTO users 
              (username, password, full_name, phone, email, department, designation, section, role, active, location_id, employee_id, candidate_app_no, joining_date, created_at, updated_at)
             VALUES (?, 'BSC_STORE_STAFF_PLACEHOLDER_HASH', ?, ?, ?, ?, ?, ?, 'Staff', 1, ?, ?, ?, ?, ?, ?)`,
            [
              userSlug,
              cand.name,
              cand.phone,
              cand.email || null,
              effectiveDept,
              effectiveDesig,
              effectiveSec,
              effectiveLocId,
              finalEmpCode,
              appNo,
              effectiveDoj,
              now,
              now
            ]
          );
        }

        // 5. Record joining in candidate_doj_history
        await db.query(
          `INSERT INTO candidate_doj_history
            (app_no, event_type, new_doj, reporting_time, verification_status, remarks, performed_by, created_at)
           VALUES (?, 'MARKED_JOINED', ?, ?, ?, ?, ?, ?)`,
          [appNo, effectiveDoj, reporting_time || '10:00 AM', verification_status || 'Verified', joining_remarks || remarks || 'Successfully joined store', username, now]
        );

        await logAction(username, 'MARK_JOINED', 'DOJ_DESK', { appNo, actualDoj: effectiveDoj, empCode: finalEmpCode, department: effectiveDept });
        return res.json({ 
          success: true, 
          message: `${cand.name || appNo} successfully marked as Joined! Employee record created (${finalEmpCode}).`,
          employeeCode: finalEmpCode
        });
      }

      return res.status(400).json({ success: false, message: `Unknown action: ${action}` });
    } catch (err) {
      console.error('[handleNotJoinedAction ERROR]', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ── Candidate DOJ History & Detail ────────────────────────────
  async getCandidateDojHistory(req, res) {
    try {
      const db = require('../config/db');
      await ensureDojSchema(db);
      const { appNo } = req.params;
      if (!appNo) {
        return res.status(400).json({ success: false, message: 'appNo is required' });
      }

      const [candRows] = await db.query(
        `SELECT 
          c.*,
          l.location_name,
          l.location_code,
          so.status as offer_status,
          so.est_doj,
          so.actual_doj,
          so.notice_period as offer_notice_period,
          so.remarks as offer_remarks
        FROM candidates c
        LEFT JOIN locations l ON l.id = c.location_id
        LEFT JOIN selection_offers so ON so.app_no = c.app_no
        WHERE c.app_no = ? LIMIT 1`,
        [appNo]
      );

      if (!candRows || candRows.length === 0) {
        return res.status(404).json({ success: false, message: 'Candidate not found' });
      }

      const candidate = candRows[0];

      // Fetch history events
      const [historyRows] = await db.query(
        `SELECT * FROM candidate_doj_history WHERE app_no = ? ORDER BY created_at DESC, id DESC`,
        [appNo]
      ).catch(() => [[]]);

      return res.json({
        success: true,
        candidate,
        history: historyRows || []
      });
    } catch (err) {
      console.error('[getCandidateDojHistory ERROR]', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  async getJoinedStoreDirectory(req, res) {
    try {
      const db = require('../config/db');
      await ensureDojSchema(db);
      const { clause: locClause, params: locParams } = await getLocationFilter(req, 'u');
      const { search, department, locationId } = req.query;

      // Query active non-admin users in store directory
      let sql = `
        SELECT 
          u.id,
          COALESCE(u.employee_id, CONCAT('EMP-', LPAD(u.id, 4, '0'))) as emp_code,
          u.full_name as name,
          u.phone,
          u.email,
          COALESCE(u.designation, 'Store Associate') as designation,
          COALESCE(u.department, 'Store Operations') as department,
          u.section,
          COALESCE(u.joining_date, u.actual_doj, u.created_at) as joined_date,
          u.location_id,
          l.location_name,
          l.location_code,
          u.reporting_manager,
          u.candidate_app_no as app_no,
          'Active Staff' as staff_status,
          'Verified' as joining_verification
        FROM users u
        LEFT JOIN locations l ON l.id = u.location_id
        WHERE u.active = 1
          AND LOWER(COALESCE(u.role, '')) NOT IN ('admin', 'super admin', 'system administrator', 'customer', 'guest')
          AND LOWER(COALESCE(u.username, '')) NOT IN ('admin', 'admin@bsctextiles.com', 'ghost')
          AND LOWER(COALESCE(u.full_name, '')) NOT LIKE '%system administrator%'
          ${locClause}
      `;
      const params = [...locParams];

      if (locationId && locationId !== 'all' && !locClause.includes('location_id')) {
        sql += ` AND u.location_id = ?`;
        params.push(locationId);
      }

      if (department && department !== 'all') {
        sql += ` AND LOWER(COALESCE(u.department, '')) = LOWER(?)`;
        params.push(department);
      }

      if (search) {
        sql += ` AND (u.full_name LIKE ? OR u.employee_id LIKE ? OR u.phone LIKE ? OR u.designation LIKE ? OR u.department LIKE ?)`;
        const s = `%${search}%`;
        params.push(s, s, s, s, s);
      }

      sql += ` ORDER BY COALESCE(u.joining_date, u.created_at) DESC`;

      const [rows] = await db.query(sql, params);

      // Also include any candidates marked Joined who are not yet in users table
      const { clause: cLocClause, params: cLocParams } = await getLocationFilter(req, 'c');
      let candSql = `
        SELECT 
          c.id,
          COALESCE(so.app_no, c.app_no) as emp_code,
          c.name,
          c.phone,
          c.email,
          c.designation,
          c.department,
          c.section,
          COALESCE(so.actual_doj, c.offered_doj, c.updated_at) as joined_date,
          c.location_id,
          l.location_name,
          l.location_code,
          c.reporting_manager,
          c.app_no,
          'Active Staff' as staff_status,
          'Verified' as joining_verification
        FROM candidates c
        LEFT JOIN locations l ON l.id = c.location_id
        LEFT JOIN selection_offers so ON c.app_no = so.app_no
        WHERE (c.is_deleted = 0 OR c.is_deleted IS NULL)
          AND (c.status = 'Joined' OR so.status = 'Joined')
          AND c.app_no NOT IN (SELECT candidate_app_no FROM users WHERE candidate_app_no IS NOT NULL)
          AND (c.phone IS NULL OR c.phone NOT IN (SELECT phone FROM users WHERE phone IS NOT NULL AND phone != ''))
          ${cLocClause}
      `;
      const candParams = [...cLocParams];

      if (locationId && locationId !== 'all' && !cLocClause.includes('location_id')) {
        candSql += ` AND c.location_id = ?`;
        candParams.push(locationId);
      }

      if (department && department !== 'all') {
        candSql += ` AND LOWER(COALESCE(c.department, '')) = LOWER(?)`;
        candParams.push(department);
      }

      if (search) {
        candSql += ` AND (c.name LIKE ? OR c.app_no LIKE ? OR c.phone LIKE ? OR c.designation LIKE ? OR c.department LIKE ?)`;
        const s = `%${search}%`;
        candParams.push(s, s, s, s, s);
      }

      const [candRows] = await db.query(candSql, candParams);
      const combined = [...rows, ...candRows];

      return res.json({ success: true, count: combined.length, employees: combined });
    } catch (err) {
      console.error('[getJoinedStoreDirectory ERROR]', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = new CandidateController();

