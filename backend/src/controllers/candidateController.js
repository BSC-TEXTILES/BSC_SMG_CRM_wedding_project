const candidateService = require('../services/candidateService');
const userSyncService = require('../services/userSyncService');
const db = require('../config/db');
const { logAction } = require('../utils/logger');
const { successRes, errorRes } = require('../utils/response');
const { getLocationFilter, injectLocationId } = require('../middleware/auth');

class CandidateController {
  async getCandidates(req, res) {
    try {
      // Pass locationId from authenticated user to service layer
      const locationId = req.user ? req.user.locationId : null;
      const result = await candidateService.getCandidates(req.query, locationId);
      return res.json(result);
    } catch (err) {
      console.error('getCandidates ERROR:', err);
      return errorRes(res, 'DB_ERR: ' + err.message, [err.message], 500);
    }
  }

  async addCandidate(req, res) {
    try {
      const d = req.body.data || req.body;
      // Inject authenticated user's location — frontend cannot override this
      const locationId = injectLocationId(req) || 2; // fallback to Davanagere
      const locationCode = (req.user && req.user.locationCode) ? req.user.locationCode : 'DAV';
      const result = await candidateService.addCandidate({ ...d, locationId, locationCode });
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
      const locationId = req.user ? req.user.locationId : null;
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
      const limit = req.query.limit || 10;
      const locationId = req.user ? req.user.locationId : null;
      const result = await candidateService.getSystemActivity(limit, locationId);
      return res.json(result);
    } catch (err) {
      return res.json({ success: false, error: err.message });
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
      const locationId = req.user ? req.user.locationId : null;
      const result = await candidateService.getPendingActions(locationId);
      return res.json(result);
    } catch (err) {
      return res.json({ actions: [] });
    }
  }

  async getSourceBreakdown(req, res) {
    try {
      const locationId = req.user ? req.user.locationId : null;
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

  async getEmployees(req, res) {
    try {
      const db = require('../config/db');
      const { clause: locClause, params: locParams } = await getLocationFilter(req, 'c');
      
      // ROW_NUMBER() derived table: one best candidate per user, ordered by
      // explicit candidate_app_no match first, then latest updated_at.
      // This eliminates the GROUP BY + non-aggregated columns violation.

let rows;
      try {
        [rows] = await db.query(
          `SELECT 
              u.id as user_id, u.username as username, u.employee_id as emp_no,
              u.full_name as name, u.email, u.phone,
              COALESCE(c.app_no, u.employee_id, u.username) as app_no,
              c.app_no as candidate_app_no,
              COALESCE(c.section, u.section) as section,
              COALESCE(c.reporting_manager, u.reporting_manager) as reporting_manager,
              COALESCE(c.offered_doj, u.offered_doj) as offered_doj,
              COALESCE(c.updated_at, u.updated_at) as candidate_updated_at,
              u.updated_at as user_updated_at, u.last_login_at,
              COALESCE(c.department, u.department) as department,
              COALESCE(c.designation, u.designation) as designation,
              u.role, u.active, u.created_at, u.location_id, u.location_code,
              COALESCE(c.dob, u.dob) as dob,
              COALESCE(c.gender, u.gender) as gender,
              COALESCE(c.blood_group, u.blood_group) as blood_group,
              COALESCE(c.aadhaar_number, u.aadhaar_number) as aadhaar_number,
              COALESCE(c.father_details, u.father_details) as father_details,
              COALESCE(c.mother_details, u.mother_details) as mother_details,
              COALESCE(c.religion_caste, CONCAT_WS('/', c.religion, c.caste)) as religion_caste,
              c.religion as religion,
              c.caste as caste,
              COALESCE(c.languages_known, u.languages_known) as languages_known,
              COALESCE(c.city_state, u.city_state) as city_state,
              COALESCE(c.address, u.address) as address,
              COALESCE(c.qualification, u.qualification) as qualification,
              COALESCE(c.experience, u.experience) as experience,
              COALESCE(c.retail_experience, u.retail_experience) as retail_experience,
              COALESCE(c.previous_company, u.previous_company) as previous_company,
              COALESCE(c.previous_designation, u.previous_designation) as previous_designation,
              COALESCE(c.salary, u.salary, u.previous_salary) as previous_salary,
              COALESCE(c.current_salary, u.current_salary) as current_salary,
              COALESCE(c.expected_salary, u.expected_salary) as expected_salary,
              COALESCE(c.photo_url, u.photo_url) as photo_url,
              COALESCE(c.aadhaar_url, u.aadhaar_url) as aadhaar_url,
              COALESCE(c.resume_url, u.resume_url) as resume_url,
              COALESCE(c.remarks, u.remarks) as remarks,
              COALESCE(c.source, u.source) as source,
              COALESCE(c.referrer, u.referrer) as referrer,
              COALESCE(c.referrer_emp_no, u.referrer_emp_no) as referrer_emp_no,
              COALESCE(so.notice_period, u.notice_period) as offer_notice_pd,
              COALESCE(so.est_doj, u.offered_doj) as offer_est_doj,
              COALESCE(so.actual_doj, u.actual_doj) as offer_actual_doj,
              so.status as offer_status,
              so.remarks as offer_remarks,
              so.updated_at as offer_updated_at,
              COALESCE(l.location_name, u.branch) as branch,
              u.joining_date, u.actual_doj, u.salary, u.expected_salary, u.experience,
              u.retail_experience, u.qualification, u.previous_company, u.previous_designation,
              u.previous_salary, u.current_salary, u.branch, u.reporting_manager,
              u.dob, u.gender, u.blood_group, u.aadhaar_number, u.father_details,
              u.mother_details, NULL as religion, NULL as caste, u.languages_known, u.city_state,
              u.address, u.photo_url, u.aadhaar_url, u.resume_url, u.remarks,
              u.source, u.referrer, u.referrer_emp_no, u.notice_period
           FROM users u
           LEFT JOIN locations l ON l.id = u.location_id
           LEFT JOIN (
             SELECT app_no, section, reporting_manager, offered_doj, updated_at,
                    dob, gender, blood_group, aadhaar_number, father_details, mother_details,
                    religion_caste, religion, caste, languages_known,
                    city_state, address, qualification, experience, retail_experience,
                    previous_company, previous_designation, salary, current_salary, expected_salary,
                    photo_url, aadhaar_url, resume_url, remarks, source, referrer, referrer_emp_no,
                    location_id, phone,
                    ROW_NUMBER() OVER (
                      PARTITION BY COALESCE(app_no, phone)
                      ORDER BY
                        CASE WHEN app_no IS NOT NULL THEN 0 ELSE 1 END,
                        COALESCE(updated_at, created_at) DESC,
                        id DESC
                    ) AS rn
                 FROM candidates
                 WHERE (is_deleted = 0 OR is_deleted IS NULL)
             ) c ON c.app_no = u.candidate_app_no OR (u.candidate_app_no IS NULL AND c.phone = u.phone AND c.phone IS NOT NULL AND c.rn = 1)
           LEFT JOIN selection_offers so ON c.app_no = so.app_no
           WHERE u.active = 1
           ${locClause.replace('c.', 'u.')}
           ORDER BY LOWER(u.full_name) ASC`,
          locParams
        );
      } catch (sqlErr) {
        console.warn('[getEmployees] Full query failed, trying simplified fallback:', sqlErr.message);
        const fallbackLocClause = locClause.replace('c.', 'u.');
        [rows] = await db.query(
          `SELECT 
              u.id as user_id, u.username as username, u.employee_id as emp_no,
              u.full_name as name, u.email, u.phone,
              COALESCE(u.employee_id, u.username) as app_no,
              NULL as candidate_app_no,
              u.section, u.reporting_manager, u.offered_doj, u.updated_at as candidate_updated_at,
              u.updated_at as user_updated_at, u.last_login_at,
              u.department, u.designation, u.role, u.active, u.created_at, u.location_id, u.location_code,
              u.dob, u.gender, u.blood_group, u.aadhaar_number, u.father_details, u.mother_details,
              CONCAT_WS('/', NULL, NULL) as religion_caste, NULL as religion, NULL as caste, u.languages_known,
              u.city_state, u.address, u.qualification, u.experience, u.retail_experience,
              u.previous_company, u.previous_designation, u.previous_salary, u.current_salary, u.expected_salary,
              u.photo_url, u.aadhaar_url, u.resume_url, u.remarks, u.source, u.referrer, u.referrer_emp_no,
              u.notice_period as offer_notice_pd, u.offered_doj as offer_est_doj, u.actual_doj as offer_actual_doj,
              NULL as offer_status, u.remarks as offer_remarks, u.updated_at as offer_updated_at,
              COALESCE(l.location_name, u.branch) as branch,
              u.joining_date, u.actual_doj, u.salary, u.expected_salary, u.experience,
              u.retail_experience, u.qualification, u.previous_company, u.previous_designation,
              u.previous_salary, u.current_salary, u.branch, u.reporting_manager,
              u.dob, u.gender, u.blood_group, u.aadhaar_number, u.father_details,
              u.mother_details, NULL as religion, NULL as caste, u.languages_known, u.city_state,
              u.address, u.photo_url, u.aadhaar_url, u.resume_url, u.remarks,
              u.source, u.referrer, u.referrer_emp_no, u.notice_period
           FROM users u
           LEFT JOIN locations l ON l.id = u.location_id
           WHERE u.active = 1
           ${fallbackLocClause}
           ORDER BY LOWER(u.full_name) ASC`,
          locParams
        );
      }

      const colors = ['navy', 'gold', 'green', 'red', 'purple', 'teal'];

      const formatLocalDate = (d) => {
        if (!d) return '';
        if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) {
          return d.slice(0, 10);
        }
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return '';
        const yyyy = dt.getFullYear();
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const dd = String(dt.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      };

      const employees = rows.map(r => {
        const initials = r.name
          ? r.name.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase()
          : 'E';
        const colorIndex = ((r.name ? r.name.charCodeAt(0) : 0) + (r.name ? r.name.charCodeAt(1) || 0 : 0)) % colors.length;
        
const createdDate = new Date(r.created_at || Date.now());

        // Use users table joining_date and actual_doj as primary, fallback to candidate/offer data
        const joiningDateObj = r.joining_date
          ? new Date(r.joining_date)
          : (r.offer_actual_doj
              ? new Date(r.offer_actual_doj)
              : (r.offered_doj ? new Date(r.offered_doj) : (r.offer_updated_at ? new Date(r.offer_updated_at) : createdDate)));
        
        const actualDojObj = r.actual_doj
          ? new Date(r.actual_doj)
          : (r.offer_actual_doj ? new Date(r.offer_actual_doj) : null);

        const rawDate = isNaN(joiningDateObj.getTime()) ? createdDate.getTime() : joiningDateObj.getTime();

        const actualDojStr = formatLocalDate(r.actual_doj || r.offer_actual_doj || r.offered_doj || r.offer_updated_at || r.candidate_updated_at || r.user_updated_at || r.created_at);
        const offeredDoj = formatLocalDate(r.offered_doj || r.offer_est_doj || r.offer_actual_doj);
        const estDojStr = formatLocalDate(r.offer_est_doj || r.offered_doj);
        const dobStr = formatLocalDate(r.dob);

        const salaryOffered = r.salary || r.current_salary || r.expected_salary || '—';

        return {
          id: r.user_id,
          userId: r.user_id,
          username: r.username || '',
          appNo: r.app_no,
          candidateAppNo: r.candidate_app_no || null,
          employeeCode: r.app_no,
          employeeId: r.emp_no || '',
          empNo: r.emp_no || '',
          role: r.role || '',
          active: !!r.active,
          lastLoginAt: r.last_login_at || null,
          name: r.name,
          fullName: r.name,
          initials,
          color: colors[colorIndex],
          phone: r.phone || '',
          email: r.email || '',
          dob: dobStr,
          gender: r.gender || '',
          cityState: r.city_state || '',
          address: r.address || '',
          desig: r.designation,
          designation: r.designation,
          department: r.department || '',
          branch: r.branch || '',
          reportingManager: r.reporting_manager || '',
          status: 'Joined',
          salary: salaryOffered,
          expectedSalary: r.expected_salary || '',
          previousSalary: r.current_salary || r.previous_salary || '',
          currentSalary: r.current_salary || '',
          offeredDoj,
          actualDoj: actualDojStr,
          estDoj: estDojStr,
          joiningDate: formatLocalDate(r.joining_date),
          noticePeriod: r.notice_period || r.offer_notice_pd || '',
          experience: r.experience || '',
          qualification: r.qualification || '',
          retailExperience: r.retail_experience || '',
          previousCompany: r.previous_company || '',
          previousDesignation: r.previous_designation || '',
          bloodGroup: r.blood_group || '',
          aadhaarNumber: r.aadhaar_number || '',
          fatherDetails: r.father_details || '',
          motherDetails: r.mother_details || '',
          religionCaste: r.religion_caste || '',
          religion: r.religion || '',
          caste: r.caste || '',
          languagesKnown: r.languages_known ? (typeof r.languages_known === 'string' ? (r.languages_known.startsWith('[') ? JSON.parse(r.languages_known) : [r.languages_known]) : r.languages_known) : [],
          photoUrl: r.photo_url || '',
          aadhaarUrl: r.aadhaar_url || '',
          aadharUrl: r.aadhaar_url || '',
          resumeUrl: r.resume_url || '',
          source: r.source || '',
          referrer: r.referrer || '',
          referrerEmpNo: r.referrer_emp_no || '',
          sourceDetail: r.source_detail || '',
          q1: r.q1 || '',
          q2: r.q2 || '',
          q3: r.q3 || '',
          q4: r.q4 || '',
          remarks: r.remarks || r.offer_remarks || '',
          section: r.section || '',
          locationId: r.location_id || 2,
          locationCode: r.location_code || 'DAV',
          createdAt: r.created_at || null,
          rawDate,
          date: joiningDateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        };
      });

      return res.json({ success: true, employees, total: employees.length });
    } catch (err) {
      console.error('[candidateController.getEmployees Error]', err);
      return errorRes(res, 'Unable to load employees right now. Please try again.', [], 500);
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
