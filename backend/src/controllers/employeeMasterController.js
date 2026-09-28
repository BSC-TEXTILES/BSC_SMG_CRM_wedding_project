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

async function resolveLocationCode(locationId) {
  if (!locationId) return null;
  try {
    const [[loc]] = await db.query('SELECT location_code FROM locations WHERE id = ?', [locationId]);
    if (loc) return loc.location_code;
  } catch (err) { /* fall through */ }
  return locationId === 1 ? 'BEL' : locationId === 2 ? 'DAV' : locationId === 3 ? 'SHI' : null;
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
  updateEmployeeMaster
};
