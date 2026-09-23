const pool = require('../config/db');
const fs = require('fs');
const path = require('path');
const userSyncService = require('./userSyncService');
const { formatISTDate, getISTDateRange, isDateInRange, getBusinessDate } = require('../utils/dateUtils');

class CandidateService {
  async generateCandidateCode() {
    const year = new Date().getFullYear();
    const [rows] = await pool.query(`SELECT id, app_no FROM candidates`);

    if (!rows || rows.length === 0) {
      return {
        appNo: `BSC-${year}-0001`
      };
    }

    let maxNum = 0;
    const existing = new Set();

    for (const r of rows) {
      if (!r.app_no) continue;
      existing.add(r.app_no);

      const matches = r.app_no.match(/\d+/g);
      if (matches && matches.length > 0) {
        const lastNum = parseInt(matches[matches.length - 1], 10);
        if (!isNaN(lastNum) && lastNum > maxNum) {
          maxNum = lastNum;
        }
      }
    }

    let nextNum = maxNum > 0 ? maxNum + 1 : 1;
    let candidateCode = `BSC-${year}-${String(nextNum).padStart(4, '0')}`;

    while (existing.has(candidateCode)) {
      nextNum++;
      candidateCode = `BSC-${year}-${String(nextNum).padStart(4, '0')}`;
    }

    return {
      appNo: candidateCode
    };
  }

  async getCandidates(filters = {}, locationId = null) {
    const { 
      status, desig, source, gender, cityState, 
      minSalary, maxSalary, minExp, maxExp,
      fromDate, toDate, q, page = 1, limit = 50000, sortDir = 'desc' 
    } = filters;

    // Auto-synchronize candidate status to 'Joined' if offer status is 'Joined'
    try {
      await pool.query(`
        UPDATE candidates c
        JOIN selection_offers so ON c.app_no = so.app_no
        SET c.status = 'Joined'
        WHERE LOWER(TRIM(so.status)) = 'joined' AND LOWER(TRIM(c.status)) != 'joined'
      `);
    } catch (e) {}

    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS employees (
          id INT AUTO_INCREMENT PRIMARY KEY,
          employee_id VARCHAR(100) NULL UNIQUE,
          app_no VARCHAR(50) NULL,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(150) NULL,
          phone VARCHAR(20) NULL,
          department VARCHAR(150) NULL,
          designation VARCHAR(150) NULL,
          section VARCHAR(150) NULL,
          branch VARCHAR(150) NULL,
          status VARCHAR(50) DEFAULT 'Joined',
          joining_date DATE NULL,
          salary DECIMAL(10,2) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    } catch (e) {}

    let query = `
      SELECT c.*, 
             so.status as offer_status,
             emp.id as employee_id
      FROM candidates c 
      LEFT JOIN selection_offers so ON c.app_no = so.app_no 
      LEFT JOIN employees emp ON (c.app_no = emp.app_no OR (c.phone IS NOT NULL AND c.phone != '' AND c.phone = emp.phone))
      WHERE 1=1
    `;
    const params = [];

    // ── Location isolation (backend-enforced) ──
    if (locationId !== null && locationId !== undefined) {
      query += ` AND c.location_id = ?`;
      params.push(locationId);
    }

    if (status && status !== 'all') {
      query += ` AND (LOWER(c.status) = LOWER(?) OR LOWER(so.status) = LOWER(?))`;
      params.push(status, status);
    }
    if (desig) {
      query += ` AND c.designation = ?`;
      params.push(desig);
    }
    if (source) {
      query += ` AND c.source = ?`;
      params.push(source);
    }
    if (gender) {
      query += ` AND LOWER(c.gender) = LOWER(?)`;
      params.push(gender);
    }
    if (cityState) {
      query += ` AND LOWER(c.city_state) LIKE ?`;
      params.push(`%${cityState.toLowerCase()}%`);
    }
    if (minSalary) {
      query += ` AND c.expected_salary >= ?`;
      params.push(parseFloat(minSalary));
    }
    if (maxSalary) {
      query += ` AND c.expected_salary <= ?`;
      params.push(parseFloat(maxSalary));
    }
    if (fromDate) {
      query += ` AND c.created_at >= ?`;
      params.push(new Date(fromDate));
    }
    if (toDate) {
      query += ` AND c.created_at <= ?`;
      params.push(new Date(new Date(toDate).setHours(23, 59, 59)));
    }
    if (q) {
      query += ` AND (LOWER(c.name) LIKE ? OR LOWER(c.app_no) LIKE ? OR c.phone LIKE ? OR LOWER(c.email) LIKE ?)`;
      const term = `%${q.toLowerCase()}%`;
      params.push(term, term, term, term);
    }
    if (filters.appNo) {
      query += ` AND c.app_no = ?`;
      params.push(filters.appNo);
    }

    const order = sortDir.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    query += ` ORDER BY c.created_at ${order}`;

    const [allRows] = await pool.query(query, params);
    const total = allRows.length;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = allRows.slice(startIndex, startIndex + limitNum);

    const candidates = paginated.map((r) => {
      const initials = r.name
        ? r.name
            .split(' ')
            .slice(0, 2)
            .map((w) => w[0] || '')
            .join('')
            .toUpperCase()
        : 'C';

      const colors = ['navy', 'gold', 'green', 'red', 'purple', 'teal'];
      const colorIndex = ((r.name ? r.name.charCodeAt(0) : 0) + (r.name ? r.name.charCodeAt(1) || 0 : 0)) % colors.length;

      const createdDate = new Date(r.created_at);
      const daysIn = Math.max(0, Math.floor((Date.now() - createdDate.getTime()) / 86400000));
      
      const isEmp = Boolean(r.employee_id);
      const osLower = (r.offer_status || '').toLowerCase().trim();
      const csLower = (r.status || '').toLowerCase().trim();

      // Preserve actual status from DB — never override Shortlisted, Joined, Offer Rejected etc.
      const computedStatus = r.status || 'New';

      return {
        id: r.id,
        candidateCode: r.app_no,
        appNo: r.app_no,
        name: r.name,
        initials,
        color: colors[colorIndex],
        phone: r.phone,
        email: r.email || '',
        dob: (r.dob && !isNaN(new Date(r.dob).getTime())) ? new Date(r.dob).toISOString().split('T')[0] : '',
        gender: r.gender || '',
        cityState: r.city_state || '',
        address: r.address || '',
        desig: r.designation,
        occupation: r.occupation || '',
        qualification: r.qualification || '',
        experience: r.experience || '',
        currentSalary: r.current_salary || '',
        salary: r.salary || (r.expected_salary ? r.expected_salary.toString() : ''),
        expectedSalary: r.expected_salary,
        noticePeriod: r.notice_period || '',
        ownVehicle: r.own_vehicle || 'No',
        source: r.source,
        referrer: r.referrer || '',
        referrerEmpNo: r.referrer_emp_no || '',
        sourceDetail: r.source_detail || '',
        date: createdDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        rawDate: createdDate.getTime(),
        status: computedStatus,
        daysIn,
        resumeUrl: r.resume_url || '',
        bloodGroup: r.blood_group || '',
        offeredDoj: (r.offered_doj && !isNaN(new Date(r.offered_doj).getTime())) ? new Date(r.offered_doj).toISOString().split('T')[0] : '',
        retailExperience: r.retail_experience || '',
        previousCompany: r.previous_company || '',
        previousDesignation: r.previous_designation || '',
        aadhaarNumber: r.aadhaar_number || '',
        fatherDetails: r.father_details || '',
        motherDetails: r.mother_details || '',
        religionCaste: r.religion_caste || '',
        religion: r.religion || '',
        caste: r.caste || '',
        languagesKnown: (() => { try { return r.languages_known ? JSON.parse(r.languages_known) : []; } catch(e) { return typeof r.languages_known === 'string' ? r.languages_known.split(',') : []; } })(),
        photoUrl: r.photo_url || '',
        aadharUrl: r.aadhaar_url || '',
        q1: r.q1 || '',
        q2: r.q2 || '',
        q3: r.q3 || '',
        q4: r.q4 || '',
        remarks: r.remarks || '',
        department: r.department || '',
        section: r.section || '',
        designation: r.designation || '',
        branch: r.branch || '',
        createdAt: r.created_at || null,
        updatedAt: r.updated_at || null
      };
    });

    return { candidates, total, page: pageNum };
  }

  async addCandidate(data) {
    let appNo = data.appNo;
    if (!appNo) {
      const codes = await this.generateCandidateCode();
      appNo = codes.appNo;
    } else {
      const [existing] = await pool.query(`SELECT id FROM candidates WHERE app_no = ?`, [appNo]);
      if (existing.length > 0) {
        const codes = await this.generateCandidateCode();
        appNo = codes.appNo;
      }
    }

    const locCodeMap = { 1: 'BEL', 2: 'DAV', 3: 'SHI' };
    const locationId = data.locationId ? Number(data.locationId) : null;
    const locationCode = data.locationCode || (locationId ? locCodeMap[locationId] : null);

    const [res] = await pool.query(
      `INSERT INTO candidates (
        app_no, name, phone, email, dob, gender, city_state, address, designation,
        occupation, qualification, experience, current_salary, expected_salary,
        notice_period, own_vehicle, source, referrer, referrer_emp_no, source_detail,
        q1, q2, q3, q4, status, salary, remarks, is_duplicate_phone, resume_url,
        blood_group, offered_doj, retail_experience, previous_company, previous_designation,
        aadhaar_number, father_details, mother_details, religion_caste, religion, caste, languages_known,
        photo_url, aadhaar_url, location_id, location_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        appNo,
        data.name || data.candidateName,
        data.phone || data.mobile,
        data.email || null,
        data.dob || null,
        data.gender || null,
        data.cityState || null,
        data.address || null,
        data.desig || data.designation,
        data.occupation || null,
        data.qualification || null,
        data.experience || null,
        data.previousSalary || data.currentSalary || null,
        data.expectedSalary || data.salary || null,
        data.noticePeriod || null,
        data.ownVehicle || 'No',
        data.source || 'Walk-in',
        data.referrer || null,
        data.referrerEmpNo || null,
        data.sourceDetail || null,
        data.q1 || null,
        data.q2 || null,
        data.q3 || null,
        data.q4 || null,
        'New',
        data.salary || null,
        data.remarks || null,
        data.isDuplicatePhone || 'No',
        data.resumeUrl || null,
        data.bloodGroup || null,
        data.offeredDoj || null,
        data.retailExperience || null,
        data.previousCompany || null,
        data.previousDesignation || null,
        data.aadhaarNumber || null,
        data.fatherDetails || null,
        data.motherDetails || null,
        data.religionCaste || null,
        data.religion || null,
        data.caste || null,
        data.languagesKnown ? JSON.stringify(data.languagesKnown) : null,
        data.photoUrl || null,
        data.aadhaarUrl || null,
        locationId,
        locationCode
      ]
    );

    const candidateId = res.insertId;

    await pool.query(
      `INSERT INTO candidate_activities (candidate_id, app_no, action_type, icon, label, by_user, color)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [candidateId, appNo, 'applied', '📋', 'Candidate Registered', 'Public', 'navy']
    );

    return { success: true, appNo, candidateId };
  }

  async updateCandidate(appNo, updates, doneBy = 'HR') {
    const fields = [];
    const values = [];

    if (updates.status) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.remarks !== undefined) {
      fields.push('remarks = ?');
      values.push(updates.remarks);
    }
    if (updates.resumeUrl) {
      fields.push('resume_url = ?');
      values.push(updates.resumeUrl);
    }

    if (fields.length > 0) {
      values.push(appNo);
      await pool.query(`UPDATE candidates SET ${fields.join(', ')} WHERE app_no = ?`, values);
    }

    const [cand] = await pool.query(`SELECT id FROM candidates WHERE app_no = ?`, [appNo]);
    if (cand.length > 0) {
      await pool.query(
        `INSERT INTO candidate_activities (candidate_id, app_no, action_type, icon, label, remarks, by_user, color)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [cand[0].id, appNo, 'status_change', '📝', `Status changed to ${updates.status || 'Updated'}`, updates.remarks || '', doneBy, 'gold']
      );
    }

    return { success: true };
  }

  async updateCandidateFull(appNo, data, doneBy = 'HR', options = {}) {
    if (!appNo) return { success: false, error: 'App No missing' };
    const fields = [];
    const values = [];
    const allowed = ['name','email','phone','address','gender','blood_group','dob','offered_doj','designation','department','section','branch','reporting_manager','remarks','qualification','experience','retail_experience','previous_company','previous_designation','aadhaar_number','father_details','mother_details','religion_caste','languages_known', 'resume_url', 'photo_url', 'aadhaar_url', 'current_salary', 'expected_salary', 'salary', 'status'];
    
    const map = {
      blood_group: ['bloodGroup', 'blood_group'],
      offered_doj: ['offeredDoj', 'estDoj', 'doj', 'offered_doj'],
      designation: ['desig', 'designation', 'role'],
      section: ['section'],
      department: ['department'],
      reporting_manager: ['reportingManager', 'reporting_manager'],
      retail_experience: ['retailExperience', 'retail_experience'],
      previous_company: ['previousCompany', 'previous_company'],
      previous_designation: ['previousDesignation', 'previous_designation'],
      aadhaar_number: ['aadhaarNumber', 'aadharNumber', 'aadhaar_number', 'aadhar_number'],
      father_details: ['fatherDetails', 'father_details'],
      mother_details: ['motherDetails', 'mother_details'],
      religion_caste: ['religionCaste', 'caste', 'religion'],
      languages_known: ['languagesKnown', 'languages_known'],
      resume_url: ['resumeUrl', 'resume_url'],
      photo_url: ['photoUrl', 'photo_url'],
      aadhaar_url: ['aadhaarUrl', 'aadharUrl', 'aadhaar_url'],
      current_salary: ['previousSalary', 'currentSalary', 'previous_salary'],
      expected_salary: ['expectedSalary', 'expected_salary'],
      name: ['name', 'fullName', 'candName'],
      phone: ['phone', 'candPhone'],
      email: ['email', 'candEmail'],
      salary: ['salary', 'salaryOffered', 'offeredSalary', 'baseSalary']
    };

    // Safely query existing columns in candidates table
    let existingCols = new Set();
    try {
      const [colRows] = await pool.query(`SHOW COLUMNS FROM candidates`);
      colRows.forEach(c => existingCols.add(c.Field));
    } catch (e) {
      // Fallback if SHOW COLUMNS fails
    }

    for (const key of allowed) {
      if (existingCols.size > 0 && !existingCols.has(key)) continue;

      const candidateKeys = map[key] || [key];
      let foundValue = undefined;
      for (const k of candidateKeys) {
        if (data && data[k] !== undefined && data[k] !== null) {
          foundValue = data[k];
          break;
        }
      }

      if (foundValue !== undefined) {
        fields.push(`${key} = ?`);
        values.push(Array.isArray(foundValue) ? JSON.stringify(foundValue) : String(foundValue));
      }
    }

    if (fields.length > 0) {
      values.push(appNo);
      try {
        await pool.query(`UPDATE candidates SET ${fields.join(', ')} WHERE app_no = ?`, values);
      } catch (err) {
        console.error('[UPDATE candidates SQL Error]:', err.message);
        if (data.status) {
          await pool.query(`UPDATE candidates SET status = ? WHERE app_no = ?`, [data.status, appNo]).catch(()=>{});
        }
      }
    }

    // Sync selection_offers table if existing
    try {
      const salVal = data.salary || data.salaryOffered || data.offeredSalary;
      const desigVal = data.desig || data.designation;
      if (data.department || desigVal || data.status || data.remarks || salVal || data.section) {
        await pool.query(
          `UPDATE selection_offers 
           SET department = COALESCE(?, department), 
               designation = COALESCE(?, designation), 
               status = COALESCE(?, status), 
               remarks = COALESCE(?, remarks), 
               salary = COALESCE(?, salary),
               updated_at = NOW() 
           WHERE app_no = ?`,
          [data.department || null, desigVal || null, data.status || null, data.remarks || null, salVal || null, appNo]
        );
      }
    } catch (e) {
      // Ignore if selection_offers update optional columns fail
    }

    // Insert activity log safely
    try {
      const [cand] = await pool.query(`SELECT id FROM candidates WHERE app_no = ?`, [appNo]);
      if (cand && cand.length > 0) {
        await pool.query(
          `INSERT INTO candidate_activities (candidate_id, app_no, action_type, icon, label, remarks, by_user, color)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [cand[0].id, appNo, 'profile_edit', '✏️', `Profile updated by ${doneBy}`, data.remarks || 'Profile details saved', doneBy, 'gold']
        );
      }
    } catch (e) {
      // Activity log safety catch
    }

    // ── Synchronize the master user account ───────────────────────────
    // `users` is the single source of truth for the account, and the Employee
    // Directory / User Management both read it. A profile edit here must be
    // visible there immediately, so the shared fields are pushed across.
    // Callers that already wrote the authoritative account values (the
    // Employee Directory edit path) pass { syncUser: false } and then push
    // user → candidate instead, which prevents any ping-pong between tables.
    if (options.syncUser !== false) {
      await userSyncService.syncUserFromCandidate(appNo);
    }

    return { success: true };
  }

  async deleteCandidate(appNo) {
    if (!appNo) return { success: false, error: 'App Number is required' };

    // 1. Fetch file URLs before DB deletion
    let fileUrls = [];
    try {
      const [rows] = await pool.query(`SELECT resume_url, photo_url, aadhaar_url FROM candidates WHERE app_no = ?`, [appNo]);
      if (rows && rows.length > 0) {
        fileUrls = [rows[0].resume_url, rows[0].photo_url, rows[0].aadhaar_url].filter(Boolean);
      }
    } catch (e) {
      console.warn(`[DeleteCandidate] Could not fetch file URLs for ${appNo}:`, e.message);
    }

    // 2. Perform DB deletion in a transaction
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const tables = [
        'candidates',
        'selection_offers',
        'selected_candidates',
        'rejected_candidates',
        'candidate_activities',
        'interview_schedules',
        'hr_evaluations',
        'interview_tokens'
      ];
      for (const t of tables) {
        await conn.query(`DELETE FROM \`${t}\` WHERE app_no = ?`, [appNo]);
      }

      // Handle onboarding_records separately because it uses record_id instead of app_no
      await conn.query(`DELETE FROM \`onboarding_records\` WHERE record_id = ?`, [appNo]);

      // The master login account for this employee is derived from the
      // candidate record, so it must disappear with it — otherwise the
      // Employee Directory / User Management would keep showing a ghost row.
      try {
        const [linkedUsers] = await conn.query(
          'SELECT id FROM users WHERE candidate_app_no = ?',
          [appNo]
        );
        for (const u of linkedUsers) {
          await conn.query('DELETE FROM user_permissions WHERE user_id = ?', [u.id]);
          await conn.query('DELETE FROM user_locations WHERE user_id = ?', [u.id]);
          await conn.query('UPDATE wedding_customers SET assigned_telecaller_id = NULL WHERE assigned_telecaller_id = ?', [u.id]);
          await conn.query('DELETE FROM users WHERE id = ?', [u.id]);
        }
      } catch (linkErr) {
        console.warn(`[DeleteCandidate] Linked account cleanup notice for ${appNo}:`, linkErr.message);
      }

      await conn.commit();
    } catch (dbError) {
      await conn.rollback();
      throw dbError;
    } finally {
      conn.release();
    }

    // 3. Physical file & folder cleanup AFTER successful DB commit
    try {
      let uploadDir = process.env.UPLOAD_DIR;
      if (!uploadDir) {
        uploadDir = path.join(__dirname, '../../../uploads');
        if (!fs.existsSync(uploadDir)) {
          uploadDir = path.join(__dirname, '../../uploads');
        }
      }

      // 3a. Delete dedicated applicant directory: uploads/applicants/BSC-2026-0001
      const applicantFolder = path.join(uploadDir, 'applicants', appNo);
      if (fs.existsSync(applicantFolder)) {
        fs.rmSync(applicantFolder, { recursive: true, force: true });
        console.log(`[DeleteCandidate] Successfully removed applicant directory: ${applicantFolder}`);
      }

      // 3b. Delete any legacy flat files linked in DB columns
      for (const rawUrl of fileUrls) {
        if (!rawUrl || typeof rawUrl !== 'string') continue;
        const cleanPath = rawUrl.replace(/^\/uploads\//, '').replace(/^uploads\//, '');
        const targetPath = path.join(uploadDir, cleanPath);
        if (fs.existsSync(targetPath)) {
          fs.unlinkSync(targetPath);
          console.log(`[DeleteCandidate] Deleted file: ${targetPath}`);
        }
      }
    } catch (fsError) {
      console.warn(`[DeleteCandidate] File cleanup notice for ${appNo}:`, fsError.message);
    }

    return { success: true };
  }

  async checkDuplicate(phone, email) {
    let exists = false;
    let name = '';
    let appNo = '';
    let appliedOn = '';

    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      const [rows] = await pool.query(
        `SELECT app_no, name, created_at FROM candidates WHERE REPLACE(phone, ' ', '') LIKE ?`,
        [`%${cleanPhone.slice(-10)}%`]
      );
      if (rows.length > 0) {
        exists = true;
        name = rows[0].name;
        appNo = rows[0].app_no;
        appliedOn = new Date(rows[0].created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      }
    }

    if (!exists && email) {
      const [rows] = await pool.query(
        `SELECT app_no, name, created_at FROM candidates WHERE LOWER(email) = LOWER(?)`,
        [email.trim()]
      );
      if (rows.length > 0) {
        exists = true;
        name = rows[0].name;
        appNo = rows[0].app_no;
        appliedOn = new Date(rows[0].created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      }
    }

    return { exists, name, appNo, appliedOn };
  }

  async addDocument(candidateId, docType, fileName, filePath, fileSize, fileExt, userId) {
    // Left empty or we can just return success as we don't have candidate_documents table in dbInitializer yet.
    return { id: 1, filePath };
  }

  async getCandidateDocuments(candidateId) {
    return [];
  }

  async getKPIs(range, fromDate, toDate, locationId = null) {
    try {
      const todayStr = new Date().toDateString();

      const locFilter = locationId ? `AND c.location_id = ${parseInt(locationId)}` : '';

      // Auto-synchronize candidate status to Joined for any candidates marked Joined in selection_offers
      try {
        await pool.query(`
          UPDATE candidates c
          JOIN selection_offers so ON c.app_no = so.app_no
          SET c.status = 'Joined'
          WHERE LOWER(TRIM(so.status)) = 'joined' AND LOWER(TRIM(c.status)) != 'joined'
        `);
      } catch (e) {}

      const [candRows] = await pool.query(`
        SELECT c.id, c.app_no, c.gender, c.status, c.created_at, c.updated_at, so.actual_doj, so.status as offer_status
        FROM candidates c
        LEFT JOIN selection_offers so ON c.app_no = so.app_no
        WHERE 1=1 ${locFilter}
      `);

      const filteredRows = candRows.filter(r => isDateInRange(getBusinessDate(r, 'CRM'), range, fromDate, toDate));

      // 1. Total Pipeline = Total registered candidates in selected range (created_at)
      const total = filteredRows.length;
      const totalCandidatesAll = candRows.length;

      let offerRows = [];
      try {
        const [oRows] = await pool.query(`SELECT app_no, status, created_at, actual_doj FROM selection_offers`);
        offerRows = oRows || [];
      } catch (e) {}

      let selectedCandRows = [];
      try {
        const [scRows] = await pool.query(`SELECT app_no, candidate_id FROM selected_candidates`);
        selectedCandRows = scRows || [];
      } catch (e) {}

      const offerAppNos = new Set(offerRows.map(o => o.app_no).filter(Boolean));
      const selectedAppNos = new Set(selectedCandRows.map(sc => sc.app_no).filter(Boolean));

      // 2. Shortlisted = Candidates in Offer Desk OR selected_candidates OR in shortlisted/interviewed/selected/joined stages
      const shortlisted = filteredRows.filter(r => {
        const s = (r.status || '').toLowerCase().trim();
        const isInOfferDesk = r.app_no && offerAppNos.has(r.app_no);
        const isInSelected = r.app_no && selectedAppNos.has(r.app_no);
        const isShortlistedStatus = [
          'shortlisted', '1st call done', '2nd call done', 'interview scheduled', 
          'interviewed', 'selected', 'offer accepted', 'joined', 'hired'
        ].includes(s);
        return isInOfferDesk || isInSelected || isShortlistedStatus;
      }).length;

      // 3. Selected Pool = Candidates marked Selected OR present in selection_offers OR present in selected_candidates
      const selected = filteredRows.filter(r => {
        const s = (r.status || '').toLowerCase().trim();
        const isInOfferDesk = r.app_no && offerAppNos.has(r.app_no);
        const isInSelected = r.app_no && selectedAppNos.has(r.app_no);
        return s === 'selected' || s === 'shortlisted' || isInOfferDesk || isInSelected;
      }).length;

      // 4. Joined Staff = Employees in Employee Directory (status = Joined or Hired)
      // For date filtering: uses actual joining date (actual_doj / updated_at / created_at)
      const joined = candRows.filter(r => {
        const s = (r.status || '').toLowerCase().trim();
        const os = (r.offer_status || '').toLowerCase().trim();
        const isJoined = s === 'joined' || s === 'hired' || os === 'joined';
        if (!isJoined) return false;
        return isDateInRange(getBusinessDate(r, 'JOINED'), range, fromDate, toDate);
      }).length;

      // 5. Acceptance Rate = (Shortlisted / Total Registered Candidates) * 100
      const acceptanceRate = total > 0 ? Math.round((shortlisted / total) * 100) : 0;

      // 6. Awaiting Joining = Candidates inside Offer Desk whose status is Pending Accept, Pending, Accepted, Offer Sent, etc. (not Joined or Rejected)
      const awaitingJoining = offerRows.filter(r => {
        const s = (r.status || '').toLowerCase().trim();
        if (!s) return true;
        const isNotJoinedOrRejected = !['joined', 'hired', 'rejected', 'declined', 'withdrawn', 'cancelled'].includes(s);
        return isNotJoinedOrRejected;
      }).length;

      // 7. Interviews Today = Show interviews scheduled for today only
      let interviewsToday = 0;
      try {
        const [schedRows] = await pool.query(`SELECT interview_date FROM interview_schedules WHERE interview_date IS NOT NULL`);
        interviewsToday = (schedRows || []).filter(r => isDateInRange(getBusinessDate(r, 'INTERVIEW'), 'today')).length;
      } catch (e) {}

      // 9. Drop-off Metrics: Rejected & Hold
      const rejected = filteredRows.filter(r => (r.status || '').toLowerCase().trim() === 'rejected').length;
      const hold = filteredRows.filter(r => (r.status || '').toLowerCase().trim() === 'hold').length;

      let activeEmployees = 0;
      try {
        const [empRows] = await pool.query(`SELECT id FROM users WHERE active = TRUE`);
        activeEmployees = (empRows || []).length;
      } catch (e) {}

      const pendingReview = filteredRows.filter(r => (r.status || '').toLowerCase().trim() === 'new').length;
      const todayCandidates = candRows.filter(r => r.created_at && new Date(r.created_at).toDateString() === todayStr).length;

      // Gender Breakdown: Girls / Female and Mens / Male
      const femaleRegistered = filteredRows.filter(r => {
        const g = (r.gender || '').toLowerCase().trim();
        return ['f', 'female', 'girl', 'women', 'woman'].includes(g);
      }).length;

      const femaleJoined = candRows.filter(r => {
        const s = (r.status || '').toLowerCase().trim();
        const os = (r.offer_status || '').toLowerCase().trim();
        const isJoined = s === 'joined' || s === 'hired' || os === 'joined';
        if (!isJoined) return false;
        const g = (r.gender || '').toLowerCase().trim();
        const isFemale = ['f', 'female', 'girl', 'women', 'woman'].includes(g);
        if (!isFemale) return false;
        return isDateInRange(getBusinessDate(r, 'JOINED'), range, fromDate, toDate);
      }).length;

      const maleRegistered = filteredRows.filter(r => {
        const g = (r.gender || '').toLowerCase().trim();
        return ['m', 'male', 'boy', 'men', 'man'].includes(g);
      }).length;

      const maleJoined = candRows.filter(r => {
        const s = (r.status || '').toLowerCase().trim();
        const os = (r.offer_status || '').toLowerCase().trim();
        const isJoined = s === 'joined' || s === 'hired' || os === 'joined';
        if (!isJoined) return false;
        const g = (r.gender || '').toLowerCase().trim();
        const isMale = ['m', 'male', 'boy', 'men', 'man'].includes(g);
        if (!isMale) return false;
        return isDateInRange(getBusinessDate(r, 'JOINED'), range, fromDate, toDate);
      }).length;

      // Date-wise breakdown map
      const dailyMap = {};
      filteredRows.forEach(r => {
        if (!r.created_at) return;
        const d = new Date(r.created_at);
        if (isNaN(d.getTime())) return;

        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dateKey = `${yyyy}-${mm}-${dd}`;

        if (!dailyMap[dateKey]) {
          const formattedDate = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
          dailyMap[dateKey] = {
            date: dateKey,
            formattedDate,
            rawTimestamp: new Date(yyyy, d.getMonth(), d.getDate()).getTime(),
            total: 0,
            shortlisted: 0,
            selected: 0,
            joined: 0,
            rejected: 0,
            hold: 0,
            new: 0
          };
        }

        dailyMap[dateKey].total += 1;
        const s = (r.status || '').toLowerCase().trim();
        const isInOffer = r.app_no && offerAppNos.has(r.app_no);
        if (isInOffer || ['shortlisted', '1st call done', '2nd call done', 'interview scheduled', 'interviewed', 'selected', 'joined', 'hired'].includes(s)) {
          dailyMap[dateKey].shortlisted += 1;
        }
        if (s === 'selected') dailyMap[dateKey].selected += 1;
        if (s === 'joined' || s === 'hired') dailyMap[dateKey].joined += 1;
        if (s === 'rejected') dailyMap[dateKey].rejected += 1;
        if (s === 'hold') dailyMap[dateKey].hold += 1;
        if (s === 'new') dailyMap[dateKey].new += 1;
      });

      const dailyBreakdown = Object.values(dailyMap).sort((a, b) => b.rawTimestamp - a.rawTimestamp);

      return {
        totalCandidates: total,
        totalCandidatesAll,
        todayCandidates,
        pendingReview,
        interviewScheduled: interviewsToday,
        interviewCompleted: shortlisted,
        round1Cleared: shortlisted,
        round2Cleared: selected,
        selected,
        rejected,
        offerPending: awaitingJoining,
        offerAccepted: awaitingJoining,
        offerDeclined: 0,
        joiningPending: awaitingJoining,
        employeesJoined: joined,
        activeEmployees,
        acceptanceRate,
        avgDays: 5,
        total,
        shortlisted,
        joined,
        onboarding: awaitingJoining,
        awaitingJoining,
        interviewsToday,
        newCandidates: pendingReview,
        hold,
        femaleRegistered,
        femaleJoined,
        maleRegistered,
        maleJoined,
        dailyBreakdown
      };
    } catch (err) {
      return {
        totalCandidates: 0,
        todayCandidates: 0,
        pendingReview: 0,
        interviewScheduled: 0,
        interviewCompleted: 0,
        round1Cleared: 0,
        round2Cleared: 0,
        selected: 0,
        rejected: 0,
        offerPending: 0,
        offerAccepted: 0,
        offerDeclined: 0,
        joiningPending: 0,
        employeesJoined: 0,
        exitPending: 0,
        completedExit: 0,
        activeEmployees: 0,
        acceptanceRate: 0,
        avgDays: 0,
        total: 0,
        shortlisted: 0,
        joined: 0,
        onboarding: 0,
        interviewsToday: 0,
        newCandidates: 0,
        hold: 0,
        femaleRegistered: 0,
        femaleJoined: 0,
        maleRegistered: 0,
        maleJoined: 0
      };
    }
  }

  async getActivityFull(appNo) {
    const [acts] = await pool.query(`SELECT * FROM candidate_activities WHERE app_no = ? ORDER BY created_at ASC`, [appNo]);
    const activity = acts.map((a) => ({
      type: a.action_type,
      icon: a.icon || '📋',
      label: a.label,
      score: 0,
      maxScore: 100,
      remarks: a.remarks || '',
      assignedBy: '',
      by: a.by_user || '',
      date: new Date(a.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      color: a.color || 'navy'
    }));

    return { success: true, activity };
  }

  async getSystemActivity(limit = 10, locationId = null) {
    try {
      const locFilter = locationId ? `AND ca.location_id = ${parseInt(locationId)}` : '';
      const [acts] = await pool.query(`
        SELECT ca.* FROM candidate_activities ca
        WHERE 1=1 ${locFilter}
        ORDER BY ca.created_at DESC LIMIT ?`, [parseInt(limit, 10)]);
      return { success: true, activity: acts };
    } catch (e) {
      // Fallback without location filter if column doesn't exist yet
      const [acts] = await pool.query(`SELECT * FROM candidate_activities ORDER BY created_at DESC LIMIT ?`, [parseInt(limit, 10)]);
      return { success: true, activity: acts };
    }
  }

  async getPendingActions(locationId = null) {
    try {
      const locFilter = locationId ? `AND location_id = ${parseInt(locationId)}` : '';
      const [rows] = await pool.query(
        `SELECT app_no, name, designation as desig, status, created_at 
         FROM candidates 
         WHERE status IN ('New', 'Shortlisted', '1st Call Done', '2nd Call Done', 'Interview Scheduled')
         ${locFilter}
         ORDER BY created_at DESC LIMIT 10`
      );
      const actions = rows.map(r => ({
        appNo: r.app_no,
        candidate: r.name,
        text: `${r.name || 'Candidate'} (${r.desig || 'General'}) - ${r.status === 'New' ? 'Screening Required' : 'Follow-up Needed'}`,
        desig: r.desig,
        actionNeeded: r.status === 'New' ? 'Screen Candidate' : r.status === 'Interview Scheduled' ? 'Conduct Interview' : 'Follow-up Call',
        badgeColor: r.status === 'New' ? 'amber' : 'navy',
        priority: r.status === 'New' ? 'urgent' : 'normal',
        urgency: 'High'
      }));
      return { actions, items: actions };
    } catch (err) {
      return { actions: [], items: [] };
    }
  }

  async getSourceBreakdown(locationId = null) {
    try {
      const locFilter = locationId ? `WHERE location_id = ${parseInt(locationId)}` : '';
      const [rows] = await pool.query(
        `SELECT source, COUNT(*) as cnt FROM candidates ${locFilter} GROUP BY source`
      );
      const breakdown = rows.map(r => ({
        source: r.source || 'Other',
        count: r.cnt
      }));
      return { breakdown };
    } catch (err) {
      return { breakdown: [] };
    }
  }

  async bulkAddEmployees(employees, user) {
    let addedCount = 0;
    const errors = [];

    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      try {
        const codes = await this.generateCandidateCode();
        const appNo = codes.appNo;
        
        await pool.query(
          `INSERT INTO candidates (
            app_no, name, phone, email, dob, gender, designation, 
            salary, blood_group, religion, caste, religion_caste, 
            status, offered_doj, source
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Joined', ?, 'Bulk Import')`,
          [
            appNo,
            emp.Name || 'Unknown Employee',
            emp.Phone || null,
            emp.Email || null,
            emp.DOB ? new Date(emp.DOB).toISOString().split('T')[0] : null,
            emp.Gender || null,
            emp.Designation || null,
            emp.Salary || null,
            emp.BloodGroup || null,
            emp.Religion || null,
            emp.Caste || null,
            (emp.Religion && emp.Caste) ? `${emp.Religion} / ${emp.Caste}` : (emp.Religion || emp.Caste || null),
            emp.DOJ ? new Date(emp.DOJ).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          ]
        );
        
        await this.logActivity(appNo, 'Joined', `Employee bulk imported by ${user}`, user);
        addedCount++;

        // Bulk-imported employees are real staff: give each one the master
        // account + Employee Directory link so they show up everywhere
        // instead of only in the candidate table.
        await userSyncService.provisionUserForCandidate(appNo, { grantedBy: user });
      } catch (err) {
        errors.push(`Row ${i + 1}: ${err.message}`);
      }
    }
    
    return { success: true, addedCount, errors };
  }
}

module.exports = new CandidateService();
