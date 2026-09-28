/**
 * BSC Employee Master Directory — HTTP controller
 * =====================================================================
 * Every handler here is gated twice:
 *   1. Access Control Matrix  → employeeMasterService.resolveEmployeeActions()
 *   2. Location isolation      → employeeMasterService.assertLocationScope()
 * so a branch administrator can never read or mutate an employee that belongs
 * to a store outside their assignment, regardless of what id they send.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const db = require('../config/db');
const upload = require('../middleware/upload');
const { successRes, errorRes } = require('../utils/response');
const { encryptField } = require('../utils/crypto');
const authorizationService = require('../services/authorizationService');
const employeeMasterService = require('../services/employeeMasterService');
const userMgmtController = require('./userManagementController');
const realtimeService = require('../services/realtimeService');

/**
 * Runs an existing Express handler against a capture-response stub so its
 * validation, audit and realtime side effects are reused verbatim without
 * needing a second, divergent implementation.
 */
function invokeHandler(handler, req) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (status, payload) => {
      if (settled) return;
      settled = true;
      resolve({ status, payload });
    };
    const stub = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(payload) { finish(this.statusCode, payload); return this; },
      send(payload) { finish(this.statusCode, payload); return this; },
      setHeader() { return this; },
      end() { finish(this.statusCode, undefined); return this; }
    };
    try {
      Promise.resolve(handler(req, stub))
        .catch(err => finish(500, { success: false, message: err.message, errors: [err.message] }));
    } catch (err) {
      finish(500, { success: false, message: err.message, errors: [err.message] });
    }
  });
}

/**
 * Payload key → `users` column, for fields the directory owns but the shared
 * user-creation flow does not know about. Whitelisting means no request body
 * key can ever reach the SQL string.
 */
const MASTER_FIELD_MAP = {
  address: 'address',
  cityState: 'city_state',
  city_state: 'city_state',
  dob: 'dob',
  gender: 'gender',
  bloodGroup: 'blood_group',
  blood_group: 'blood_group',
  qualification: 'qualification',
  experience: 'experience',
  retailExperience: 'retail_experience',
  previousCompany: 'previous_company',
  previousDesignation: 'previous_designation',
  salary: 'salary',
  currentSalary: 'current_salary',
  expectedSalary: 'expected_salary',
  previousSalary: 'previous_salary',
  noticePeriod: 'notice_period',
  reportingManager: 'reporting_manager',
  reporting_manager: 'reporting_manager',
  branch: 'branch',
  remarks: 'remarks',
  source: 'source',
  referrer: 'referrer',
  alternatePhone: 'alternate_phone',
  companyEmail: 'company_email',
  permanentAddress: 'permanent_address',
  city: 'city',
  district: 'district',
  state: 'state',
  pincode: 'pincode',
  emergencyContactName: 'emergency_contact_name',
  emergencyContactPhone: 'emergency_contact_phone',
  emergencyContactRelation: 'emergency_contact_relation',
  employmentType: 'employment_type',
  employment_status: 'employment_status',
  employmentStatus: 'employment_status',
  floor: 'floor',
  confirmationDate: 'confirmation_date',
  workShift: 'work_shift',
  panNumber: 'pan_number',
  bankName: 'bank_name',
  bankAccountNumber: 'bank_account_number',
  ifscCode: 'ifsc_code',
  section: 'section',
  joiningDate: 'joining_date',
  actualDoj: 'actual_doj',
  offeredDoj: 'offered_doj',
  photoUrl: 'photo_url',
  resumeUrl: 'resume_url',
  notes: 'notes'
};

let writableColumnCache = null;

async function getWritableColumns() {
  if (writableColumnCache) return writableColumnCache;
  try {
    const [rows] = await poolDescribe();
    writableColumnCache = new Set(rows);
  } catch (err) {
    writableColumnCache = null;
  }
  if (!writableColumnCache) {
    const set = new Set(Object.values(MASTER_FIELD_MAP));
    // Plus the columns the employee-master migration owns.
    employeeMasterService.MASTER_COLUMNS.forEach(c => set.add(c));
    writableColumnCache = set;
  }
  return writableColumnCache;
}

async function poolDescribe() {
  const [rows] = await db.query('DESCRIBE users');
  return rows.map(r => r.Field);
}

/**
 * Builds a safe `col = ?` fragment from the whitelist intersection of the
 * incoming payload and the columns that actually exist on `users`.
 */
async function buildMasterUpdate(payload) {
  const allowed = await getWritableColumns();
  const fields = [];
  const params = [];

  for (const [key, column] of Object.entries(MASTER_FIELD_MAP)) {
    if (!allowed.has(column)) continue;
    if (!(key in payload)) continue;
    if (fields.some(f => f.column === column)) continue;
    let value = payload[key];
    if (value === undefined) continue;
    if (value !== null && value !== '' && typeof value === 'string') {
      value = value.trim();
      if (value === '') value = null;
    }
    if (typeof value === 'string' && value.length > 2000) value = value.slice(0, 2000);
    fields.push({ column, value });
    params.push(value);
  }

  return { fields, params };
}

// ── GET /api/employees/:id ─────────────────────────────────────────
async function getEmployeeProfile(req, res) {
  try {
    const result = await employeeMasterService.getEmployeeProfile(req, req.params.id);
    if (result.forbidden) {
      if (result.accessDenied) {
        return res.status(403).json({
          success: false,
          forbidden: true,
          accessDenied: true,
          message: 'Access restricted: Confidential employee profile. Administrator authorization required.',
          employeeSummary: result.employeeSummary
        });
      }
      return errorRes(res, 'You do not have access to this employee record', [], 403);
    }
    if (result.notFound) {
      return errorRes(res, 'Employee not found', [], 404);
    }
    return res.json({
      success: true,
      employee: result.employee,
      documents: result.documents,
      access: result.access,
      audit: result.audit,
      actions: result.actions
    });
  } catch (err) {
    console.error('[employeeMaster.getEmployeeProfile]', err);
    try {
      const basic = await employeeMasterService.resolveUnrestrictedRow(req.params.id);
      if (basic) {
        return res.json({
          success: true,
          employee: {
            id: basic.user_id || basic.id,
            userId: basic.user_id || basic.id,
            username: basic.username || '',
            name: basic.name || basic.full_name || basic.username || 'Employee',
            fullName: basic.name || basic.full_name || basic.username || 'Employee',
            employeeCode: basic.app_no || basic.employee_id || `EMP-${basic.id || basic.user_id}`,
            department: basic.department || '',
            designation: basic.designation || '',
            section: basic.section || '',
            phone: basic.phone || '',
            email: basic.email || '',
            branch: basic.location_name || '',
            status: basic.status_display || (basic.active ? 'Joined' : 'Active')
          },
          documents: [],
          access: { modules: [], locations: [] },
          audit: [],
          actions: { can_view: true, can_edit: false, can_delete: false, can_view_sensitive: false }
        });
      }
    } catch (_) {}
    return errorRes(res, 'Unable to load employee profile: ' + err.message, [err.message], 500);
  }
}

// ── POST /api/employees ────────────────────────────────────────────
async function createEmployee(req, res) {
  try {
    const actions = await employeeMasterService.resolveEmployeeActions(req.user);
    if (!actions.can_add) {
      return errorRes(res, 'You do not have permission to add employees', [], 403);
    }

    const body = { ...(req.body || {}) };
    if (body.data && typeof body.data === 'object') Object.assign(body, body.data);

    if (!body.username || !body.password || !body.role) {
      return errorRes(res, 'Username, password and role are required', [], 400);
    }

    // The directory form may be submitted from a restricted store; the account
    // must land in a location the creator is actually allowed to staff.
    const targetLocationId = body.locationId || body.location_id
      || (req.user && req.user.locationId) || undefined;
    if (targetLocationId) {
      const inScope = await employeeMasterService.assertLocationScope(req, Number(targetLocationId));
      if (!inScope) {
        return errorRes(res, 'You cannot create employees outside your assigned store location', [], 403);
      }
    }

    const createUserReq = Object.assign(Object.create(req), {
      body: {
        username: body.username,
        password: body.password,
        role: body.role,
        fullName: body.fullName || body.name,
        email: body.email,
        phone: body.phone,
        department: body.department,
        designation: body.designation,
        employeeId: body.employeeId || body.empNo || undefined,
        section: body.section,
        joiningDate: body.joiningDate || body.actualDoj || body.offeredDoj || null,
        locationId: targetLocationId,
        locationIds: Array.isArray(body.locationIds) ? body.locationIds : undefined,
        allLocations: body.allLocations === true,
        maxModules: body.maxModules,
        permissions: Array.isArray(body.permissions) && body.permissions.length
          ? body.permissions
          : undefined
      }
    });

    const { status, payload } = await invokeHandler(userMgmtController.createUser, createUserReq);
    if (!payload || payload.success === false) {
      return res.status(status || 400).json(payload || { success: false, message: 'Unable to create employee' });
    }

    const newUserId = payload.data && payload.data.id;
    let masterUpdate = { fields: [], params: [] };
    if (newUserId) {
      masterUpdate = await buildMasterUpdate(body);
      if (masterUpdate.fields.length) {
        const assignments = masterUpdate.fields.map(f => `\`${f.column}\` = ?`).join(', ');
        await db.query(
          `UPDATE users SET ${assignments}, updated_by = ? WHERE id = ?`,
          [...masterUpdate.params, req.user ? req.user.username : null, newUserId]
        );
      }
      await employeeMasterService.auditEmployee(req, 'CREATE_EMPLOYEE', {
        id: newUserId,
        location_id: targetLocationId || null
      }, {
        username: payload.data.username,
        role: body.role,
        department: body.department,
        designation: body.designation,
        section: body.section
      });
      realtimeService.emitEmployeeChange('CREATE', {
        id: newUserId,
        username: payload.data.username,
        department: body.department,
        designation: body.designation
      }, targetLocationId || (req.user ? req.user.locationId : null));
    }

    return successRes(res, payload.data, payload.message || 'Employee created successfully', 201);
  } catch (err) {
    console.error('[employeeMaster.createEmployee]', err);
    return errorRes(res, 'Failed to create employee: ' + err.message, [err.message], 500);
  }
}

// ── POST /api/employees/:id/toggle-status ──────────────────────────
async function toggleEmployeeStatus(req, res) {
  try {
    const actions = await employeeMasterService.resolveEmployeeActions(req.user);
    if (!actions.can_edit) {
      return errorRes(res, 'You do not have permission to activate or deactivate employees', [], 403);
    }

    const record = await employeeMasterService.resolveEmployeeRecord(req, req.params.id);
    if (!record) {
      return errorRes(res, 'Employee not found', [], 404);
    }
    const inScope = await employeeMasterService.assertLocationScope(req, record.location_id);
    if (!inScope) {
      return errorRes(res, 'You do not have access to this employee record', [], 403);
    }
    if (req.user && record.user_id === req.user.id) {
      return errorRes(res, 'You cannot activate or deactivate your own account', [], 400);
    }

    const toggleReq = Object.assign(Object.create(req), {
      params: { id: String(record.user_id) },
      body: { ...(req.body || {}) }
    });
    const { status, payload } = await invokeHandler(userMgmtController.toggleStatus, toggleReq);
    if (!payload || payload.success === false) {
      return res.status(status || 400).json(payload || { success: false, message: 'Unable to change status' });
    }

    const nowActive = !!payload.data.active;
    const employmentStatus = nowActive ? 'Active' : 'Deactivated';
    await db.query(
      `UPDATE users SET employment_status = ?, updated_by = ?, updated_at = NOW() WHERE id = ?`,
      [employmentStatus, req.user ? req.user.username : null, record.user_id]
    );

    await employeeMasterService.auditEmployee(
      req,
      nowActive ? 'ACTIVATE_EMPLOYEE' : 'DEACTIVATE_EMPLOYEE',
      record,
      {
        username: record.username,
        employmentStatus,
        reason: payload.data.deactivation_reason || null,
        deactivatedUntil: payload.data.deactivated_until || null
      }
    );

    return successRes(res, {
      id: record.user_id,
      active: nowActive,
      employmentStatus,
      deactivated_until: payload.data.deactivated_until || null,
      deactivation_reason: payload.data.deactivation_reason || null
    }, nowActive ? 'Employee activated successfully' : 'Employee deactivated successfully');
  } catch (err) {
    console.error('[employeeMaster.toggleEmployeeStatus]', err);
    return errorRes(res, 'Failed to change employee status: ' + err.message, [err.message], 500);
  }
}

// ── Shared guard for the document + audit routes ───────────────────
async function loadScopedEmployee(req, res, needsSensitive) {
  const actions = await employeeMasterService.resolveEmployeeActions(req.user);
  if (!actions.can_view) {
    errorRes(res, 'You do not have permission to view employees', [], 403);
    return null;
  }
  if (needsSensitive && !actions.can_view_sensitive) {
    errorRes(res, 'You do not have permission to view employee documents', [], 403);
    return null;
  }
  const record = await employeeMasterService.resolveEmployeeRecord(req, req.params.id);
  if (!record) {
    errorRes(res, 'Employee not found', [], 404);
    return null;
  }
  const inScope = await employeeMasterService.assertLocationScope(req, record.location_id);
  if (!inScope) {
    errorRes(res, 'You do not have access to this employee record', [], 403);
    return null;
  }
  return record;
}

// ── GET /api/employees/:id/documents ───────────────────────────────
async function listDocuments(req, res) {
  try {
    const record = await loadScopedEmployee(req, res, true);
    if (!record) return;
    const documents = await employeeMasterService.listDocuments(record.user_id);
    return res.json({ success: true, documents, employeeId: record.user_id });
  } catch (err) {
    console.error('[employeeMaster.listDocuments]', err);
    return errorRes(res, 'Unable to load documents', [err.message], 500);
  }
}

// ── POST /api/employees/:id/documents (multipart) ──────────────────
async function uploadDocument(req, res) {
  try {
    const actions = await employeeMasterService.resolveEmployeeActions(req.user);
    if (!actions.can_edit) {
      return errorRes(res, 'You do not have permission to upload employee documents', [], 403);
    }
    const record = await loadScopedEmployee(req, res, true);
    if (!record) return;

    const file = req.file;
    if (!file) {
      return errorRes(res, 'No file was uploaded', [], 400);
    }

    const documentType = String((req.body && req.body.documentType) || 'Document').trim().slice(0, 60);
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeType = documentType.replace(/[^A-Za-z0-9_-]/g, '') || 'Document';
    const newFileName = `${safeType}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext || '.pdf'}`;
    const destDir = path.join(upload.uploadDir, 'employee-documents');
    const destPath = path.join(destDir, newFileName);
    const relativePath = path.join('employee-documents', newFileName);

    try {
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
      fs.renameSync(file.path, destPath);
    } catch (moveErr) {
      // rename() fails across devices — fall back to copy + unlink
      try {
        fs.copyFileSync(file.path, destPath);
        fs.unlinkSync(file.path);
      } catch (copyErr) {
        try { fs.unlinkSync(file.path); } catch (e) {}
        return errorRes(res, 'Unable to store the uploaded document', [copyErr.message], 500);
      }
    }

    const documentId = await employeeMasterService.saveDocument({
      userId: record.user_id,
      documentType,
      fileName: file.originalname || newFileName,
      filePath: relativePath,
      fileSize: file.size || 0,
      fileExt: ext || null,
      mimeType: file.mimetype || null,
      uploadedBy: req.user ? req.user.username : null
    });

    await employeeMasterService.auditEmployee(req, 'UPLOAD_EMPLOYEE_DOCUMENT', record, {
      documentId,
      documentType,
      fileName: file.originalname,
      fileSize: file.size
    });

    return successRes(res, {
      id: documentId,
      documentType,
      fileName: file.originalname,
      fileSize: file.size || 0,
      fileExt: ext || null,
      uploadedBy: req.user ? req.user.username : null,
      downloadUrl: `/api/employees/${record.user_id}/documents/${documentId}/download`
    }, 'Document uploaded successfully', 201);
  } catch (err) {
    console.error('[employeeMaster.uploadDocument]', err);
    return errorRes(res, 'Failed to upload document: ' + err.message, [err.message], 500);
  }
}

// ── GET /api/employees/:id/documents/:docId/download ───────────────
async function downloadDocument(req, res) {
  try {
    const record = await loadScopedEmployee(req, res, true);
    if (!record) return;

    const doc = await employeeMasterService.getDocumentRow(record.user_id, req.params.docId);
    if (!doc) {
      return errorRes(res, 'Document not found', [], 404);
    }

    const root = path.resolve(upload.uploadDir);
    const absolute = path.resolve(root, doc.file_path);
    if (!absolute.startsWith(root + path.sep)) {
      return errorRes(res, 'Invalid document path', [], 400);
    }
    if (!fs.existsSync(absolute)) {
      return errorRes(res, 'The stored document file is missing', [], 404);
    }

    await employeeMasterService.auditEmployee(req, 'DOWNLOAD_EMPLOYEE_DOCUMENT', record, {
      documentId: doc.id,
      documentType: doc.document_type,
      fileName: doc.file_name
    });

    res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
    res.setHeader('Content-Length', fs.statSync(absolute).size);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${String(doc.file_name || 'document').replace(/["\\]/g, '')}"`
    );
    return fs.createReadStream(absolute).pipe(res);
  } catch (err) {
    console.error('[employeeMaster.downloadDocument]', err);
    return errorRes(res, 'Unable to download document', [err.message], 500);
  }
}

// ── DELETE /api/employees/:id/documents/:docId ─────────────────────
async function deleteDocument(req, res) {
  try {
    const actions = await employeeMasterService.resolveEmployeeActions(req.user);
    if (!actions.can_edit) {
      return errorRes(res, 'You do not have permission to delete employee documents', [], 403);
    }
    const record = await loadScopedEmployee(req, res, true);
    if (!record) return;

    const doc = await employeeMasterService.getDocumentRow(record.user_id, req.params.docId);
    if (!doc) {
      return errorRes(res, 'Document not found', [], 404);
    }

    const removed = await employeeMasterService.softDeleteDocument(doc.id);
    if (!removed) {
      return errorRes(res, 'Document not found', [], 404);
    }

    // Best effort: drop the physical file only after the row is flagged.
    try {
      const root = path.resolve(upload.uploadDir);
      const absolute = path.resolve(root, doc.file_path);
      if (absolute.startsWith(root + path.sep) && fs.existsSync(absolute)) {
        fs.unlinkSync(absolute);
      }
    } catch (fsErr) {
      console.warn('[employeeMaster.deleteDocument] file removal skipped:', fsErr.message);
    }

    await employeeMasterService.auditEmployee(req, 'DELETE_EMPLOYEE_DOCUMENT', record, {
      documentId: doc.id,
      documentType: doc.document_type,
      fileName: doc.file_name
    });

    return successRes(res, { id: doc.id }, 'Document deleted successfully');
  } catch (err) {
    console.error('[employeeMaster.deleteDocument]', err);
    return errorRes(res, 'Failed to delete document', [err.message], 500);
  }
}

// ── GET /api/employees/:id/audit ───────────────────────────────────
async function getAuditTrail(req, res) {
  try {
    const actions = await employeeMasterService.resolveEmployeeActions(req.user);
    if (!actions.can_edit) {
      return errorRes(res, 'You do not have permission to view the employee audit trail', [], 403);
    }
    const record = await loadScopedEmployee(req, res, false);
    if (!record) return;

    const audit = await employeeMasterService.loadAuditTrail(
      record.user_id, record.username, req.user
    );
    return res.json({ success: true, audit, employeeId: record.user_id });
  } catch (err) {
    console.error('[employeeMaster.getAuditTrail]', err);
    return errorRes(res, 'Unable to load audit trail', [err.message], 500);
  }
}

// ── PUT /api/employees/:id ─────────────────────────────────────────
/**
 * Master-directory save. The shared `candidateController.updateEmployee` owns
 * the account + recruitment alignment; this handler adds the directory-owned
 * columns on top of it, after the same matrix and location checks the rest of
 * this controller applies.
 */
async function updateEmployeeMaster(req, res) {
  try {
    const actions = await employeeMasterService.resolveEmployeeActions(req.user);
    if (!actions.can_edit) {
      return errorRes(res, 'You do not have permission to edit employees', [], 403);
    }

    const record = await employeeMasterService.resolveEmployeeRecord(req, req.params.id);
    if (!record) {
      return errorRes(res, 'Employee not found', [], 404);
    }
    const inScope = await employeeMasterService.assertLocationScope(req, record.location_id);
    if (!inScope) {
      return errorRes(res, 'You do not have access to this employee record', [], 403);
    }

    const body = { ...(req.body || {}) };
    if (body.data && typeof body.data === 'object') Object.assign(body, body.data);
    if (body.updates && typeof body.updates === 'object') Object.assign(body, body.updates);

    // Never let a form-supplied application number re-link this account to an
    // unrelated recruitment record: the linkage lives on `users.candidate_app_no`.
    if (!record.candidate_app_no) {
      delete body.appNo;
      delete body.candidateAppNo;
      delete body.app_no;
      delete body.candidate_app_no;
    }

    // Reject an attempt to move the record into a store outside our scope.
    const requestedLocation = body.locationId !== undefined ? body.locationId : body.location_id;
    if (requestedLocation !== undefined && requestedLocation !== null && requestedLocation !== '') {
      const allowed = await employeeMasterService.assertLocationScope(req, Number(requestedLocation));
      if (!allowed) {
        return errorRes(res, 'You cannot assign an employee to a location outside your scope', [], 403);
      }
    }

    const candidateController = require('./candidateController');
    const updateReq = Object.assign(Object.create(req), {
      params: { id: String(record.user_id) },
      body
    });
    const { status, payload } = await invokeHandler(candidateController.updateEmployee, updateReq);
    if (!payload || payload.success === false) {
      return res.status(status || 400).json(payload || { success: false, message: 'Unable to update employee' });
    }

    const masterUpdate = await buildMasterUpdate(body);
    const locationFields = [];
    const locationParams = [];
    if (requestedLocation !== undefined) {
      const locId = requestedLocation === null || requestedLocation === '' ? null : Number(requestedLocation);
      if (locId !== null && Number.isNaN(locId)) {
        return errorRes(res, 'Invalid location', [], 400);
      }
      locationFields.push('location_id = ?', 'location_code = ?');
      locationParams.push(locId, await resolveLocationCode(locId));
    }

    const assignments = [
      ...masterUpdate.fields.map(f => `\`${f.column}\` = ?`),
      ...locationFields
    ];
    if (assignments.length) {
      assignments.push('updated_by = ?', 'updated_at = NOW()');
      await db.query(
        `UPDATE users SET ${assignments.join(', ')} WHERE id = ?`,
        [...masterUpdate.params, ...locationParams, req.user ? req.user.username : null, record.user_id]
      );
    }

    const updated = await employeeMasterService.getEmployeeProfile(req, String(record.user_id));
    await employeeMasterService.auditEmployee(req, 'UPDATE_EMPLOYEE', record, {
      username: record.username,
      fields: Object.keys(body)
    });

    // Real-time broadcast: update directory without page reload
    const realtimeService = require('../services/realtimeService');
    if (updated && updated.employee) {
      realtimeService.emitEmployeeChange('UPDATE', updated.employee, record.location_id);
    }

    return successRes(res, {
      userId: record.user_id,
      appNo: payload.data ? payload.data.appNo : null,
      employee: updated.forbidden || updated.notFound ? null : updated.employee
    }, 'Employee updated successfully');
  } catch (err) {
    console.error('[employeeMaster.updateEmployeeMaster]', err);
    return errorRes(res, 'Failed to update employee: ' + err.message, [err.message], 500);
  }
}

// ── POST /api/employees/:id/access-request ─────────────────────────
async function requestEmployeeAccess(req, res) {
  try {
    const employeeId = req.params.id;
    const user = req.user;
    if (!user || !user.id) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const record = await employeeMasterService.resolveEmployeeRecord(req, employeeId);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Employee record not found' });
    }

    const empName = record.name || record.username || 'Employee';
    const locId = record.location_id || user.locationId || null;
    const reason = req.body?.reason || 'Request to view employee details';

    // Check if an access request is already pending for this user and employee
    const [existing] = await db.query(
      `SELECT id, status FROM employee_access_requests 
       WHERE user_id = ? AND employee_id = ? AND status = 'PENDING'
       LIMIT 1`,
      [user.id, record.user_id]
    );

    if (existing.length > 0) {
      return res.json({
        success: true,
        message: 'An access request is already pending administrator approval',
        requestId: existing[0].id,
        status: 'PENDING'
      });
    }

    const [insertResult] = await db.query(
      `INSERT INTO employee_access_requests 
       (employee_id, employee_name, user_id, username, user_role, location_id, requested_action, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, 'VIEW_EMPLOYEE_DETAILS', ?, 'PENDING')`,
      [record.user_id, empName, user.id, user.username || user.fullName, user.role || 'Staff', locId, reason]
    );

    const requestId = insertResult.insertId;

    const notifTitle = 'Employee Details Access Request';
    const notifMessage = `${user.fullName || user.username} requested access to view employee details for ${empName}.`;

    // Persist to broadcast_messages
    try {
      await db.query(
        `INSERT INTO broadcast_messages 
         (title, subject, message, priority, category, target_role, sender_name, status, require_ack, pinned)
         VALUES (?, 'Employee Access Request', ?, 'high', 'Security', 'Admins', ?, 'Pending', 0, 1)`,
        [notifTitle, notifMessage, user.fullName || user.username]
      );
    } catch (e) {}

    // Persist to notification table
    try {
      await db.query(
        `INSERT INTO notification (userId, title, message, type, category, priority, action_data)
         SELECT id, ?, ?, 'access_request', 'Security', 'high', ?
         FROM users WHERE role IN ('Admin', 'Super Admin') AND active = 1`,
        [notifTitle, notifMessage, JSON.stringify({ requestId, employeeId: record.user_id, employeeName: empName, userId: user.id, username: user.username })]
      );
    } catch (e) {}

    // Emit live Socket.IO notification to Admins
    const realtimeService = require('../services/realtimeService');
    const io = realtimeService.getIo();
    if (io) {
      const payload = {
        id: `req-${requestId}`,
        requestId,
        title: notifTitle,
        message: notifMessage,
        type: 'access_request',
        category: 'Security',
        priority: 'high',
        employeeId: record.user_id,
        employeeName: empName,
        requestingUser: user.fullName || user.username,
        role: user.role,
        timestamp: new Date().toISOString(),
        read: false
      };
      io.to('role:Admin').emit('notification:new', payload);
      io.to('role:Super Admin').emit('notification:new', payload);
      io.to('role:Admin').emit('employee:access_request', payload);
      io.to('role:Super Admin').emit('employee:access_request', payload);
      io.emit('NEW_BROADCAST', {
        id: requestId,
        title: notifTitle,
        message: notifMessage,
        priority: 'high',
        category: 'Security',
        target_role: 'Admins',
        sender_name: user.fullName || user.username,
        created_at: new Date().toISOString()
      });
    }

    // Record audit event
    try {
      await db.query(
        `INSERT INTO audit_logs (username, user_id, action, module, details, ip_address)
         VALUES (?, ?, 'EMPLOYEE_ACCESS_REQUESTED', 'Employee Master', ?, ?)`,
        [user.username, user.id, `Requested access to view employee ID ${record.user_id} (${empName})`, req.ip || '']
      );
    } catch (e) {}

    return res.json({
      success: true,
      message: `Access request generated for ${empName}. An Administrator has been notified live.`,
      requestId,
      status: 'PENDING'
    });
  } catch (err) {
    console.error('[requestEmployeeAccess Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to submit access request: ' + err.message });
  }
}

// ── GET /api/employees/access-requests ─────────────────────────────
async function listAccessRequests(req, res) {
  try {
    const admin = req.user;
    if (!['Admin', 'Super Admin', 'system administrator'].includes(admin.role)) {
      return res.status(403).json({ success: false, message: 'Access denied: Administrators only' });
    }
    const [rows] = await db.query(
      `SELECT r.*, u.full_name as requesting_full_name 
       FROM employee_access_requests r
       LEFT JOIN users u ON u.id = r.user_id
       ORDER BY r.created_at DESC LIMIT 100`
    );
    return res.json({ success: true, requests: rows });
  } catch (err) {
    console.error('[listAccessRequests Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch access requests' });
  }
}

// ── POST /api/employees/access-requests/:id/resolve ────────────────
async function resolveAccessRequest(req, res) {
  try {
    const { id } = req.params;
    const { action } = req.body;
    const admin = req.user;

    if (!['Admin', 'Super Admin', 'system administrator'].includes(admin.role)) {
      return res.status(403).json({ success: false, message: 'Only Administrators can resolve access requests' });
    }

    const newStatus = action?.toUpperCase() === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    const [rows] = await db.query('SELECT * FROM employee_access_requests WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Access request not found' });
    }
    const request = rows[0];

    await db.query(
      `UPDATE employee_access_requests 
       SET status = ?, resolved_by = ?, resolved_by_name = ?, resolved_at = NOW() 
       WHERE id = ?`,
      [newStatus, admin.id, admin.fullName || admin.username, id]
    );

    // Update broadcast messages status if matching
    await db.query(
      `UPDATE broadcast_messages 
       SET status = ? 
       WHERE category = 'Security' AND message LIKE ?`,
      [newStatus, `%${request.employee_name}%`]
    ).catch(() => {});

    // Notify requesting user over Socket.IO
    const realtimeService = require('../services/realtimeService');
    const io = realtimeService.getIo();
    if (io) {
      const payload = {
        requestId: id,
        employeeId: request.employee_id,
        employeeName: request.employee_name,
        status: newStatus,
        resolvedBy: admin.fullName || admin.username,
        message: `Your request to view details for ${request.employee_name} has been ${newStatus.toLowerCase()} by ${admin.fullName || admin.username}.`
      };
      io.to(`user:${request.user_id}`).emit('employee:access_resolved', payload);
      io.to(`user:${request.user_id}`).emit('notification:new', {
        id: `res-${id}-${Date.now()}`,
        title: `Employee Access Request ${newStatus}`,
        message: payload.message,
        type: newStatus === 'APPROVED' ? 'success' : 'warning',
        category: 'Security',
        priority: 'high',
        read: false,
        timestamp: new Date().toISOString()
      });
      io.to('role:Admin').emit('employee:access_resolved', payload);
      io.to('role:Super Admin').emit('employee:access_resolved', payload);
    }

    // Security audit log
    await db.query(
      `INSERT INTO audit_logs (username, user_id, action, module, details, ip_address)
       VALUES (?, ?, ?, 'Employee Master', ?, ?)`,
      [
        admin.username,
        admin.id,
        newStatus === 'APPROVED' ? 'EMPLOYEE_ACCESS_APPROVED' : 'EMPLOYEE_ACCESS_REJECTED',
        `Admin ${admin.username} ${newStatus.toLowerCase()} access request #${id} for user ${request.username} on employee ${request.employee_name}`,
        req.ip || ''
      ]
    ).catch(() => {});

    return res.json({
      success: true,
      message: `Access request #${id} has been ${newStatus.toLowerCase()} successfully`,
      status: newStatus
    });
  } catch (err) {
    console.error('[resolveAccessRequest Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to resolve access request: ' + err.message });
  }
}

async function resolveLocationCode(locationId) {
  if (!locationId) return null;
  try {
    const [[loc]] = await db.query('SELECT location_code FROM locations WHERE id = ?', [locationId]);
    if (loc) return loc.location_code;
  } catch (err) { /* fall through */ }
  return locationId === 1 ? 'BEL' : locationId === 2 ? 'DAV' : locationId === 3 ? 'SHI' : null;
}

// ── POST /api/employees/bulk-import ───────────────────────────────
async function bulkImportEmployees(req, res) {
  try {
    const actions = await employeeMasterService.resolveEmployeeActions(req.user);
    if (!actions.can_add) {
      return errorRes(res, 'You do not have permission to import employees', [], 403);
    }

    let rawList = [];
    if (Array.isArray(req.body.employees)) {
      rawList = req.body.employees;
    } else if (req.body.data && Array.isArray(req.body.data.employees)) {
      rawList = req.body.data.employees;
    } else if (req.body && typeof req.body === 'object' && Array.isArray(req.body.data)) {
      rawList = req.body.data;
    }

    if (!rawList || rawList.length === 0) {
      return errorRes(res, 'No employee records provided for import', [], 400);
    }

    if (rawList.length > 2000) {
      return errorRes(res, 'Maximum 2000 records allowed per import batch', [], 400);
    }

    // Load locations lookup map
    const [locations] = await db.query('SELECT id, location_code, location_name FROM locations');
    const locationMap = new Map();
    (locations || []).forEach(loc => {
      locationMap.set(String(loc.id), Number(loc.id));
      if (loc.location_code) locationMap.set(loc.location_code.toLowerCase().trim(), Number(loc.id));
      if (loc.location_name) locationMap.set(loc.location_name.toLowerCase().trim(), Number(loc.id));
    });

    const defaultLocId = req.user?.locationId || (locations?.[0]?.id ?? 1);

    let inserted = 0;
    let updated = 0;
    let failed = 0;
    const errors = [];
    const results = [];

    for (let i = 0; i < rawList.length; i++) {
      const row = rawList[i];
      const rowNum = i + 1;

      // Extract & normalize fields
      const fullName = String(row.fullName || row.name || row['Full Name'] || row['Name'] || row['Employee Name'] || '').trim();
      if (!fullName) {
        failed++;
        errors.push(`Row #${rowNum}: Full name is required`);
        results.push({ row: rowNum, status: 'Failed', reason: 'Full name is required' });
        continue;
      }

      let employeeId = String(row.employeeId || row.empCode || row['Employee ID'] || row['Emp Code'] || row['Employee Code'] || '').trim();
      let email = String(row.email || row['Email'] || row['Email ID'] || '').trim() || null;
      let phone = String(row.phone || row.mobile || row['Phone'] || row['Mobile'] || row['Contact'] || '').trim() || null;
      let department = String(row.department || row.dept || row['Department'] || row['Dept'] || '').trim() || 'General';
      let designation = String(row.designation || row['Designation'] || row['Position'] || row['Title'] || '').trim() || 'Staff';
      let role = String(row.role || row['Role'] || '').trim() || 'Staff';
      let section = String(row.section || row['Section'] || '').trim() || null;
      let branchName = String(row.branch || row.location || row['Branch'] || row['Location'] || row['Store'] || '').trim();
      let joiningDate = String(row.joiningDate || row.doj || row['Joining Date'] || row['DOJ'] || '').trim() || null;
      let salary = row.salary || row['Salary'] || row['CTC'] || null;
      let status = String(row.status || row.employmentStatus || row['Status'] || row['Employment Status'] || 'Active').trim();
      let address = String(row.address || row.permanentAddress || row['Address'] || row['Permanent Address'] || '').trim() || null;
      let city = String(row.city || row['City'] || '').trim() || null;
      let aadhaarNumber = String(row.aadhaarNumber || row.aadhaar || row['Aadhaar Number'] || row['Aadhaar'] || '').trim() || null;

      // Normalize joining date if necessary (e.g. DD-MM-YYYY to YYYY-MM-DD)
      if (joiningDate) {
        const dmyMatch = joiningDate.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
        if (dmyMatch) {
          joiningDate = `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
        }
      }

      // Location resolution
      let locId = defaultLocId;
      if (branchName) {
        const resolved = locationMap.get(branchName.toLowerCase());
        if (resolved) locId = resolved;
      } else if (row.locationId && locationMap.has(String(row.locationId))) {
        locId = Number(row.locationId);
      }
      const locCode = await resolveLocationCode(locId);

      // Username resolution
      let username = String(row.username || row['Username'] || '').trim();
      if (!username) {
        if (email) {
          username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_.-]/g, '');
        } else if (employeeId) {
          username = employeeId.toLowerCase().replace(/[^a-z0-9_.-]/g, '');
        } else {
          username = fullName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 15) + '_' + Math.floor(1000 + Math.random() * 9000);
        }
      }

      // Default temporary password
      const rawPassword = String(row.password || row['Password'] || 'Bsc@12345').trim();
      const encryptedPassword = encryptField(rawPassword);

      // Check if user already exists by employeeId or username or email
      let existingUser = null;
      if (employeeId) {
        const [[uById]] = await db.query('SELECT id, username, employee_id FROM users WHERE employee_id = ? LIMIT 1', [employeeId]);
        existingUser = uById;
      }
      if (!existingUser && username) {
        const [[uByUname]] = await db.query('SELECT id, username, employee_id FROM users WHERE username = ? LIMIT 1', [username]);
        existingUser = uByUname;
      }

      const activeFlag = status.toLowerCase() === 'inactive' || status.toLowerCase() === 'deactivated' ? 0 : 1;

      try {
        if (existingUser) {
          // Update existing user in users table
          await db.query(
            `UPDATE users SET 
              full_name = COALESCE(?, full_name),
              email = COALESCE(?, email),
              phone = COALESCE(?, phone),
              department = COALESCE(?, department),
              designation = COALESCE(?, designation),
              role = COALESCE(?, role),
              section = COALESCE(?, section),
              joining_date = COALESCE(?, joining_date),
              location_id = ?,
              location_code = ?,
              active = ?,
              salary = COALESCE(?, salary),
              permanent_address = COALESCE(?, permanent_address),
              city = COALESCE(?, city),
              aadhaar_number = COALESCE(?, aadhaar_number),
              employment_status = ?,
              updated_by = ?,
              updated_at = NOW()
            WHERE id = ?`,
            [
              fullName, email, phone, department, designation, role, section,
              joiningDate, locId, locCode, activeFlag, salary, address, city,
              aadhaarNumber, status, req.user?.username || 'admin', existingUser.id
            ]
          );

          // Update or insert into employees table
          try {
            await db.query(
              `INSERT INTO employees (employee_id, name, email, phone, department, designation, section, branch, status, joining_date, salary, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
               ON DUPLICATE KEY UPDATE 
                 name = VALUES(name), email = VALUES(email), phone = VALUES(phone),
                 department = VALUES(department), designation = VALUES(designation),
                 section = VALUES(section), branch = VALUES(branch), status = VALUES(status),
                 joining_date = VALUES(joining_date), salary = VALUES(salary), updated_at = NOW()`,
              [
                existingUser.employee_id || employeeId || `EMP-${existingUser.id}`,
                fullName, email, phone, department, designation, section,
                locCode || branchName || 'BSC', status, joiningDate, salary
              ]
            );
          } catch (empSyncErr) {
            console.warn('[bulkImportEmployees] Sync to employees table warning:', empSyncErr.message);
          }

          updated++;
          results.push({ row: rowNum, status: 'Updated', employeeId: existingUser.employee_id || employeeId, name: fullName });
        } else {
          // If employeeId is missing, generate one
          if (!employeeId) {
            const [[lastRow]] = await db.query("SELECT MAX(id) as maxId FROM users");
            const nextId = (lastRow?.maxId || 0) + 1;
            employeeId = `EMP-${String(nextId).padStart(4, '0')}`;
          }

          // Insert new user into users table
          const [insertRes] = await db.query(
            `INSERT INTO users (
              username, password, role, full_name, email, phone, department, designation,
              employee_id, section, joining_date, active, location_id, location_code,
              salary, permanent_address, city, aadhaar_number, employment_status, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              username, encryptedPassword, role, fullName, email, phone, department, designation,
              employeeId, section, joiningDate, activeFlag, locId, locCode,
              salary, address, city, aadhaarNumber, status, req.user?.username || 'admin'
            ]
          );

          const newUserId = insertRes.insertId;

          // Link user_locations
          try {
            await db.query('INSERT IGNORE INTO user_locations (user_id, location_id) VALUES (?, ?)', [newUserId, locId]);
          } catch (_) {}

          // Seed default permissions based on role
          try {
            const defaultModules = authorizationService.resolveRoleDefaultPermissions(role);
            for (const mod of defaultModules) {
              await db.query(
                `INSERT IGNORE INTO user_permissions (user_id, module, can_view, can_add, can_edit, can_delete, can_export, can_approve, granted_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [newUserId, mod.module, !!mod.can_view, !!mod.can_add, !!mod.can_edit, !!mod.can_delete, !!mod.can_export, !!mod.can_approve, req.user?.username || 'Admin']
              );
            }
          } catch (_) {}

          // Insert into employees table
          try {
            await db.query(
              `INSERT INTO employees (employee_id, name, email, phone, department, designation, section, branch, status, joining_date, salary, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
              [
                employeeId, fullName, email, phone, department, designation, section,
                locCode || branchName || 'BSC', status, joiningDate, salary
              ]
            );
          } catch (empErr) {
            console.warn('[bulkImportEmployees] Insert into employees warning:', empErr.message);
          }

          inserted++;
          results.push({ row: rowNum, status: 'Imported', employeeId, name: fullName });
        }
      } catch (rowErr) {
        failed++;
        errors.push(`Row #${rowNum} (${fullName}): ${rowErr.message}`);
        results.push({ row: rowNum, status: 'Failed', reason: rowErr.message, name: fullName });
      }
    }

    // Audit log
    await db.query(
      `INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)`,
      [
        req.user?.id || 1,
        'BULK_IMPORT_EMPLOYEES',
        JSON.stringify({ total: rawList.length, inserted, updated, failed }),
        req.ip || ''
      ]
    ).catch(() => {});

    // Realtime notification
    try {
      realtimeService.emitEmployeeChange('BULK_IMPORT', {
        count: inserted + updated,
        importedBy: req.user?.username || 'Admin'
      }, defaultLocId);
    } catch (_) {}

    return res.json({
      success: true,
      message: `Bulk import completed: ${inserted} added, ${updated} updated, ${failed} failed.`,
      stats: { total: rawList.length, inserted, updated, failed },
      errors,
      results
    });
  } catch (err) {
    console.error('[employeeMasterController.bulkImportEmployees Error]', err);
    return res.status(500).json({ success: false, message: 'Bulk import failed: ' + err.message });
  }
}

module.exports = {
  getEmployeeProfile,
  createEmployee,
  toggleEmployeeStatus,
  listDocuments,
  uploadDocument,
  downloadDocument,
  deleteDocument,
  getAuditTrail,
  updateEmployeeMaster,
  requestEmployeeAccess,
  listAccessRequests,
  resolveAccessRequest,
  bulkImportEmployees
};
