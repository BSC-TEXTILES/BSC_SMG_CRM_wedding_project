const candidateService = require('../services/candidateService');
const userSyncService = require('../services/userSyncService');
const db = require('../config/db');
const { logAction } = require('../utils/logger');
const { successRes, errorRes } = require('../utils/response');
const { getLocationFilter, injectLocationId, getEffectiveLocationId } = require('../middleware/auth');
const realtimeService = require('../services/realtimeService');

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
           ORDER BY LOWER(u.full_name) ASC`,
          params
        );

        const colors = ['navy', 'gold', 'green', 'red', 'purple', 'teal'];
        const mapped = (rows || []).map(r => ({
          ...r,
          id: r.id,
          userId: r.id,
          name: r.name || r.username || 'Employee',
          fullName: r.name || r.username || 'Employee',
          appNo: r.empNo || `EMP-${String(r.id).padStart(4, '0')}`,
          employeeCode: r.empNo || `EMP-${String(r.id).padStart(4, '0')}`,
          empNo: r.empNo || `EMP-${String(r.id).padStart(4, '0')}`,
          status: r.active ? 'Joined' : 'Inactive',
          color: colors[(r.id || 0) % colors.length],
          initials: (r.name || 'E').split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || 'E',
          photoUrl: '',
          hasPhoto: false,
          hasDocuments: false,
          canViewSensitive: ['Admin', 'Super Admin', 'HR', 'Manager'].includes(req.user?.role)
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
      const { clause: locClause, params: locParams } = await getLocationFilter(req, 'c');
      const { search, status, overdueOnly } = req.query;

      let sql = `
        SELECT 
          c.app_no,
          c.name,
          c.phone,
          c.designation,
          c.department,
          c.section,
          c.status as candidate_status,
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
          END as doj_urgency
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

      if (status && status !== 'all') {
        sql += ` AND (so.status = ? OR c.status = ?)`;
        params.push(status, status);
      }

      if (overdueOnly === 'true' || overdueOnly === true) {
        sql += ` AND COALESCE(so.est_doj, c.offered_doj) < CURDATE()`;
      }

      if (search) {
        sql += ` AND (c.name LIKE ? OR c.app_no LIKE ? OR c.phone LIKE ? OR c.designation LIKE ?)`;
        const s = `%${search}%`;
        params.push(s, s, s, s);
      }

      sql += ` ORDER BY COALESCE(so.est_doj, c.offered_doj) ASC`;

      const [rows] = await db.query(sql, params);

      const total = rows.length;
      const overdue = rows.filter(r => r.doj_urgency === 'Overdue').length;
      const today = rows.filter(r => r.doj_urgency === 'Joining Today').length;
      const upcoming = rows.filter(r => r.doj_urgency === 'Upcoming').length;

      return res.json({
        success: true,
        stats: { total, overdue, today, upcoming },
        candidates: rows
      });
    } catch (err) {
      console.error('[getNotJoinedDesk ERROR]', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  async handleNotJoinedAction(req, res) {
    try {
      const db = require('../config/db');
      const { appNo, action, new_doj, reason } = req.body;
      if (!appNo || !action) {
        return res.status(400).json({ success: false, message: 'appNo and action are required' });
      }

      const now = new Date();
      const username = req.user ? req.user.username : 'HR';

      if (action === 'reschedule') {
        if (!new_doj) {
          return res.status(400).json({ success: false, message: 'new_doj is required for reschedule' });
        }
        await db.query(`UPDATE candidates SET offered_doj = ?, updated_at = ? WHERE app_no = ?`, [new_doj, now, appNo]);
        await db.query(`UPDATE selection_offers SET est_doj = ?, remarks = CONCAT(COALESCE(remarks, ''), '\nRescheduled DOJ: ', ?, ' Reason: ', ?), updated_at = ? WHERE app_no = ?`, [new_doj, new_doj, reason || 'No reason specified', now, appNo]);
        await logAction(username, 'RESCHEDULE_DOJ', 'NOT_JOINED_DESK', { appNo, new_doj, reason });
        return res.json({ success: true, message: 'DOJ rescheduled successfully' });
      } else if (action === 'mark_not_joining') {
        await db.query(`UPDATE candidates SET status = 'Not Joined', remarks = CONCAT(COALESCE(remarks, ''), '\nNot Joining: ', ?), updated_at = ? WHERE app_no = ?`, [reason || 'Not Joined', now, appNo]);
        await db.query(`UPDATE selection_offers SET status = 'Offer Rejected', remarks = CONCAT(COALESCE(remarks, ''), '\nNot Joined: ', ?), updated_at = ? WHERE app_no = ?`, [reason || 'Not Joined', now, appNo]);
        await logAction(username, 'MARK_NOT_JOINING', 'NOT_JOINED_DESK', { appNo, reason });
        return res.json({ success: true, message: 'Candidate marked as Not Joining' });
      } else if (action === 'mark_joined') {
        const actualDoj = new_doj || now.toISOString().split('T')[0];
        await db.query(`UPDATE candidates SET status = 'Joined', offered_doj = ?, updated_at = ? WHERE app_no = ?`, [actualDoj, now, appNo]);
        await db.query(`UPDATE selection_offers SET status = 'Joined', actual_doj = ?, updated_at = ? WHERE app_no = ?`, [actualDoj, now, appNo]);
        await logAction(username, 'MARK_JOINED', 'NOT_JOINED_DESK', { appNo, actualDoj });
        return res.json({ success: true, message: 'Candidate marked as Joined' });
      }

      return res.status(400).json({ success: false, message: `Unknown action: ${action}` });
    } catch (err) {
      console.error('[handleNotJoinedAction ERROR]', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  async getJoinedStoreDirectory(req, res) {
    try {
      const db = require('../config/db');
      const { clause: locClause, params: locParams } = await getLocationFilter(req, 'c');
      const { search, department } = req.query;

      let sql = `
        SELECT 
          c.app_no,
          COALESCE(u.employee_id, c.app_no) as emp_code,
          c.name,
          c.phone,
          c.email,
          COALESCE(c.designation, u.designation) as designation,
          COALESCE(c.department, u.department) as department,
          COALESCE(c.section, u.section) as section,
          COALESCE(so.actual_doj, c.offered_doj, u.created_at) as joined_date,
          c.location_id,
          l.location_name,
          l.location_code,
          'Active Staff' as staff_status
        FROM candidates c
        LEFT JOIN locations l ON l.id = c.location_id
        LEFT JOIN selection_offers so ON c.app_no = so.app_no
        LEFT JOIN users u ON u.candidate_app_no = c.app_no OR (c.phone = u.phone AND c.phone IS NOT NULL)
        WHERE (c.is_deleted = 0 OR c.is_deleted IS NULL)
          AND (c.status = 'Joined' OR so.status = 'Joined' OR (u.active = 1 AND u.id IS NOT NULL))
          ${locClause}
      `;
      const params = [...locParams];

      if (department && department !== 'all') {
        sql += ` AND (c.department = ? OR u.department = ?)`;
        params.push(department, department);
      }

      if (search) {
        sql += ` AND (c.name LIKE ? OR c.app_no LIKE ? OR c.phone LIKE ? OR u.employee_id LIKE ?)`;
        const s = `%${search}%`;
        params.push(s, s, s, s);
      }

      sql += ` ORDER BY COALESCE(so.actual_doj, c.offered_doj, u.created_at) DESC`;

      const [rows] = await db.query(sql, params);
      return res.json({ success: true, count: rows.length, employees: rows });
    } catch (err) {
      console.error('[getJoinedStoreDirectory ERROR]', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = new CandidateController();
