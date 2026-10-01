const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const { errorRes } = require('../utils/response');
const { logAction } = require('../utils/logger');
const userSyncService = require('../services/userSyncService');
const employeeMasterService = require('../services/employeeMasterService');
const upload = require('../middleware/upload');

const uploadRoot = upload.uploadDir || path.join(__dirname, '../../uploads');

/**
 * Resolves an employee database user row from id, username, or candidate app_no
 */
async function resolveEmployeeUser(identifier) {
  if (!identifier) return null;
  const isNumeric = /^\d+$/.test(String(identifier).trim());
  if (isNumeric) {
    const [rows] = await pool.query(
      'SELECT id, username, full_name, email, phone, role, photo_url, candidate_app_no, employee_id, location_id, active FROM users WHERE id = ? LIMIT 1',
      [Number(identifier)]
    );
    if (rows && rows.length > 0) return rows[0];
  }

  const clean = String(identifier).trim().toLowerCase();
  const [rows] = await pool.query(
    'SELECT id, username, full_name, email, phone, role, photo_url, candidate_app_no, employee_id, location_id, active FROM users WHERE LOWER(username) = ? OR LOWER(employee_id) = ? OR LOWER(candidate_app_no) = ? OR LOWER(email) = ? LIMIT 1',
    [clean, clean, clean, clean]
  );
  if (rows && rows.length > 0) return rows[0];

  // Try via candidates app_no
  const [candRows] = await pool.query(
    'SELECT app_no, photo_url, location_id, name, phone, email FROM candidates WHERE LOWER(app_no) = ? LIMIT 1',
    [clean]
  );
  if (candRows && candRows.length > 0) {
    const c = candRows[0];
    // Find or create synthetic user object for candidate
    const [uRows] = await pool.query(
      'SELECT id, username, full_name, email, phone, role, photo_url, candidate_app_no, employee_id, location_id, active FROM users WHERE candidate_app_no = ? OR phone = ? LIMIT 1',
      [c.app_no, c.phone]
    );
    if (uRows && uRows.length > 0) return uRows[0];
    return {
      id: null,
      candidate_app_no: c.app_no,
      full_name: c.name,
      photo_url: c.photo_url,
      location_id: c.location_id
    };
  }

  return null;
}

/**
 * Asserts location access permission for the requesting user against employee's location
 */
function assertLocationAccess(reqUser, targetLocationId) {
  if (!reqUser) return false;
  const isAdminRole = ['Admin', 'Super Admin'].includes(reqUser.role);
  const isGlobalAdmin = reqUser.role === 'Super Admin' || (isAdminRole && (!reqUser.locationId || reqUser.isGlobalAdmin === true));
  if (isGlobalAdmin) return true;
  if (!targetLocationId) return false;
  if (reqUser.locationId && Number(reqUser.locationId) === Number(targetLocationId)) return true;
  if (Array.isArray(reqUser.allowedLocations) && reqUser.allowedLocations.includes(Number(targetLocationId))) return true;
  return false;
}

// ── 1. EMPLOYEE PHOTO: UPLOAD / REPLACE ─────────────────────────────
exports.uploadPhoto = async (req, res) => {
  try {
    const identifier = req.params.id;
    const file = req.file || (req.files && (req.files.photo?.[0] || req.files.file?.[0] || Object.values(req.files).flat()[0]));
    if (!file) {
      return res.status(400).json({ success: false, message: 'No photo image file was provided' });
    }

    const user = await resolveEmployeeUser(identifier);
    if (!user) {
      // Remove uploaded file to prevent orphan
      try { fs.unlinkSync(req.file.path); } catch (e) {}
      return errorRes(res, 'Employee record not found', [], 404);
    }

    if (!assertLocationAccess(req.user, user.location_id)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
      return res.status(403).json({ success: false, message: 'You do not have permission to modify employees at this location' });
    }

    const relativePath = `/uploads/employee-photos/${file.filename}`;
    const oldPhotoUrl = user.photo_url;

    // 1. Update users table if id exists
    if (user.id) {
      await pool.query('UPDATE users SET photo_url = ?, updated_at = NOW() WHERE id = ?', [relativePath, user.id]);
    }

    // 2. Update linked candidates table if candidate_app_no exists
    const appNo = user.candidate_app_no || identifier;
    if (appNo) {
      await pool.query('UPDATE candidates SET photo_url = ?, updated_at = NOW() WHERE app_no = ?', [relativePath, appNo]).catch(() => {});
    }

    // 3. Remove old photo from disk if it was a stored local upload
    if (oldPhotoUrl && oldPhotoUrl.startsWith('/uploads/employee-photos/')) {
      const oldFilename = path.basename(oldPhotoUrl);
      const oldPath = path.join(uploadRoot, 'employee-photos', oldFilename);
      if (fs.existsSync(oldPath) && oldFilename !== file.filename) {
        try { fs.unlinkSync(oldPath); } catch (e) {}
      }
    }

    await logAction(req.user ? req.user.username : 'HR', 'UPLOAD_EMPLOYEE_PHOTO', 'EMPLOYEES', {
      userId: user.id,
      appNo,
      fileName: file.filename,
      fileSize: file.size
    });

    return res.json({
      success: true,
      message: 'Photo uploaded successfully',
      photoUrl: relativePath,
      user: {
        id: user.id,
        appNo,
        photoUrl: relativePath
      }
    });
  } catch (err) {
    console.error('[Employee Photo Upload Error]', err);
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    return errorRes(res, 'Failed to upload employee photo: ' + err.message, [err.message], 500);
  }
};

// ── 2. EMPLOYEE PHOTO: REMOVE ───────────────────────────────────────
exports.removePhoto = async (req, res) => {
  try {
    const identifier = req.params.id;
    const user = await resolveEmployeeUser(identifier);
    if (!user) {
      return errorRes(res, 'Employee record not found', [], 404);
    }

    if (!assertLocationAccess(req.user, user.location_id)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to modify employees at this location' });
    }

    const oldPhotoUrl = user.photo_url;

    if (user.id) {
      await pool.query('UPDATE users SET photo_url = NULL, updated_at = NOW() WHERE id = ?', [user.id]);
    }
    const appNo = user.candidate_app_no || identifier;
    if (appNo) {
      await pool.query('UPDATE candidates SET photo_url = NULL, updated_at = NOW() WHERE app_no = ?', [appNo]).catch(() => {});
    }

    if (oldPhotoUrl && oldPhotoUrl.startsWith('/uploads/employee-photos/')) {
      const oldFilename = path.basename(oldPhotoUrl);
      const oldPath = path.join(uploadRoot, 'employee-photos', oldFilename);
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch (e) {}
      }
    }

    await logAction(req.user ? req.user.username : 'HR', 'REMOVE_EMPLOYEE_PHOTO', 'EMPLOYEES', {
      userId: user.id,
      appNo
    });

    return res.json({
      success: true,
      message: 'Photo removed successfully'
    });
  } catch (err) {
    console.error('[Employee Photo Remove Error]', err);
    return errorRes(res, 'Failed to remove employee photo: ' + err.message, [err.message], 500);
  }
};

// ── 3. EMPLOYEE PHOTO: GET / STREAM ─────────────────────────────────
exports.getPhoto = async (req, res) => {
  try {
    const identifier = req.params.id;
    const user = await resolveEmployeeUser(identifier);
    if (!user || !user.photo_url) {
      return res.status(404).json({ success: false, message: 'No profile photo uploaded' });
    }

    const photoUrl = user.photo_url;
    if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) {
      return res.redirect(photoUrl);
    }

    const cleanPath = photoUrl.replace(/^\//, '');
    const fullPath = path.join(uploadRoot, cleanPath.replace(/^uploads\//, ''));
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const ext = path.extname(fullPath).toLowerCase();
      let mime = 'image/jpeg';
      if (ext === '.png') mime = 'image/png';
      else if (ext === '.webp') mime = 'image/webp';
      res.setHeader('Content-Type', mime);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return fs.createReadStream(fullPath).pipe(res);
    }

    return res.status(404).json({ success: false, message: 'Photo file not found on disk' });
  } catch (err) {
    return errorRes(res, 'Failed to get employee photo', [err.message], 500);
  }
};

// ── 4. EMPLOYEE DOCUMENTS: LIST ─────────────────────────────────────
exports.listDocuments = async (req, res) => {
  try {
    const identifier = req.params.id;
    const user = await resolveEmployeeUser(identifier);
    if (!user) {
      return errorRes(res, 'Employee record not found', [], 404);
    }

    if (!assertLocationAccess(req.user, user.location_id)) {
      return res.status(403).json({ success: false, message: 'Access denied for this employee location' });
    }

    const userId = user.id;
    if (!userId) {
      return res.json({ success: true, documents: [] });
    }

    const [rows] = await pool.query(
      `SELECT id, user_id, document_type, file_name, file_path, file_size, file_ext, mime_type, uploaded_by, status, created_at, updated_at
         FROM employee_documents
        WHERE user_id = ? AND deleted_at IS NULL
        ORDER BY created_at DESC`,
      [userId]
    );

    const documents = (rows || []).map(r => ({
      id: r.id,
      userId: r.user_id,
      documentType: r.document_type,
      fileName: r.file_name,
      fileSize: Number(r.file_size || 0),
      fileExt: r.file_ext,
      mimeType: r.mime_type,
      uploadedBy: r.uploaded_by,
      status: r.status || 'Active',
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      viewUrl: `/api/employees/${identifier}/documents/${r.id}/view`,
      downloadUrl: `/api/employees/${identifier}/documents/${r.id}/download`
    }));

    return res.json({ success: true, documents });
  } catch (err) {
    console.error('[Employee Documents List Error]', err);
    return errorRes(res, 'Failed to list employee documents', [err.message], 500);
  }
};

// ── 5. EMPLOYEE DOCUMENTS: UPLOAD ───────────────────────────────────
exports.uploadDocument = async (req, res) => {
  try {
    const identifier = req.params.id;
    const file = req.file || (req.files && (req.files.document?.[0] || req.files.file?.[0] || Object.values(req.files).flat()[0]));
    if (!file) {
      return res.status(400).json({ success: false, message: 'No document file was provided' });
    }

    const user = await resolveEmployeeUser(identifier);
    if (!user) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
      return errorRes(res, 'Employee record not found', [], 404);
    }

    if (!assertLocationAccess(req.user, user.location_id)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
      return res.status(403).json({ success: false, message: 'Access denied for this employee location' });
    }

    let userId = user.id;
    // If user record doesn't exist in users table yet, ensure one
    if (!userId && user.candidate_app_no) {
      userId = await userSyncService.syncUserFromCandidate(user.candidate_app_no);
    }
    if (!userId) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
      return errorRes(res, 'Could not resolve system user account for document attachment', [], 400);
    }

    const documentType = req.body.documentType || 'Other HR Documents';
    const relativePath = `/uploads/employee-documents/${file.filename}`;
    const ext = path.extname(file.originalname || '').toLowerCase();
    const uploadedBy = req.user ? (req.user.name || req.user.username) : 'HR Executive';

    const [result] = await pool.query(
      `INSERT INTO employee_documents
         (user_id, document_type, file_name, file_path, file_size, file_ext, mime_type, uploaded_by, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active')`,
      [userId, documentType, file.originalname, relativePath, file.size, ext, file.mimetype, uploadedBy]
    );

    const docId = result.insertId;

    await logAction(req.user ? req.user.username : 'HR', 'UPLOAD_EMPLOYEE_DOCUMENT', 'EMPLOYEES', {
      userId,
      documentId: docId,
      documentType,
      fileName: file.originalname,
      fileSize: file.size
    });

    const newDoc = {
      id: docId,
      userId,
      documentType,
      fileName: file.originalname,
      fileSize: file.size,
      fileExt: ext,
      mimeType: file.mimetype,
      uploadedBy,
      status: 'Active',
      createdAt: new Date().toISOString(),
      viewUrl: `/api/employees/${identifier}/documents/${docId}/view`,
      downloadUrl: `/api/employees/${identifier}/documents/${docId}/download`
    };

    return res.json({
      success: true,
      message: 'Document uploaded successfully',
      document: newDoc
    });
  } catch (err) {
    console.error('[Employee Document Upload Error]', err);
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    return errorRes(res, 'Failed to upload document: ' + err.message, [err.message], 500);
  }
};

// ── 6. EMPLOYEE DOCUMENTS: VIEW (AUTHENTICATED INLINE) ──────────────
exports.viewDocument = async (req, res) => {
  try {
    const { id: identifier, docId } = req.params;
    const user = await resolveEmployeeUser(identifier);
    if (!user) return res.status(404).send('Employee not found');

    if (!assertLocationAccess(req.user, user.location_id)) {
      return res.status(403).send('Forbidden: Access to documents at this store location is restricted');
    }

    const [rows] = await pool.query(
      'SELECT * FROM employee_documents WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      [Number(docId)]
    );
    if (!rows || rows.length === 0) return res.status(404).send('Document not found');
    const doc = rows[0];

    const cleanPath = String(doc.file_path || '').replace(/^\//, '');
    const fullPath = path.join(uploadRoot, cleanPath.replace(/^uploads\//, ''));

    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      return res.status(404).send('File not found on storage server');
    }

    const ext = path.extname(fullPath).toLowerCase();
    let mime = doc.mime_type || 'application/octet-stream';
    if (ext === '.pdf') mime = 'application/pdf';
    else if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
    else if (ext === '.png') mime = 'image/png';
    else if (ext === '.webp') mime = 'image/webp';

    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.file_name)}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return fs.createReadStream(fullPath).pipe(res);
  } catch (err) {
    console.error('[View Document Error]', err);
    return res.status(500).send('Unable to view document');
  }
};

// ── 7. EMPLOYEE DOCUMENTS: DOWNLOAD (AUTHENTICATED ATTACHMENT) ──────
exports.downloadDocument = async (req, res) => {
  try {
    const { id: identifier, docId } = req.params;
    const user = await resolveEmployeeUser(identifier);
    if (!user) return res.status(404).send('Employee not found');

    if (!assertLocationAccess(req.user, user.location_id)) {
      return res.status(403).send('Forbidden: Access to documents at this store location is restricted');
    }

    const [rows] = await pool.query(
      'SELECT * FROM employee_documents WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      [Number(docId)]
    );
    if (!rows || rows.length === 0) return res.status(404).send('Document not found');
    const doc = rows[0];

    const cleanPath = String(doc.file_path || '').replace(/^\//, '');
    const fullPath = path.join(uploadRoot, cleanPath.replace(/^uploads\//, ''));

    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      return res.status(404).send('File not found on storage server');
    }

    await logAction(req.user ? req.user.username : 'HR', 'DOWNLOAD_EMPLOYEE_DOCUMENT', 'EMPLOYEES', {
      userId: user.id,
      documentId: doc.id,
      fileName: doc.file_name
    });

    return res.download(fullPath, doc.file_name);
  } catch (err) {
    console.error('[Download Document Error]', err);
    return res.status(500).send('Unable to download document');
  }
};

// ── 8. EMPLOYEE DOCUMENTS: REPLACE ──────────────────────────────────
exports.replaceDocument = async (req, res) => {
  try {
    const { id: identifier, docId } = req.params;
    const file = req.file || (req.files && (req.files.document?.[0] || req.files.file?.[0] || Object.values(req.files).flat()[0]));
    if (!file) {
      return res.status(400).json({ success: false, message: 'No replacement file was provided' });
    }

    const user = await resolveEmployeeUser(identifier);
    if (!user) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
      return errorRes(res, 'Employee record not found', [], 404);
    }

    if (!assertLocationAccess(req.user, user.location_id)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
      return res.status(403).json({ success: false, message: 'Access denied for this employee location' });
    }

    const [rows] = await pool.query(
      'SELECT * FROM employee_documents WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      [Number(docId)]
    );
    if (!rows || rows.length === 0) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
      return res.status(404).json({ success: false, message: 'Existing document not found' });
    }
    const oldDoc = rows[0];

    // Mark previous document as replaced
    await pool.query(
      "UPDATE employee_documents SET status = 'Replaced', deleted_at = NOW() WHERE id = ?",
      [oldDoc.id]
    );

    const relativePath = `/uploads/employee-documents/${file.filename}`;
    const ext = path.extname(file.originalname || '').toLowerCase();
    const docType = req.body.documentType || oldDoc.document_type;
    const uploadedBy = req.user ? (req.user.name || req.user.username) : 'HR Executive';

    const [result] = await pool.query(
      `INSERT INTO employee_documents
         (user_id, document_type, file_name, file_path, file_size, file_ext, mime_type, uploaded_by, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active')`,
      [oldDoc.user_id, docType, file.originalname, relativePath, file.size, ext, file.mimetype, uploadedBy]
    );

    const newDocId = result.insertId;

    await logAction(req.user ? req.user.username : 'HR', 'REPLACE_EMPLOYEE_DOCUMENT', 'EMPLOYEES', {
      userId: oldDoc.user_id,
      oldDocumentId: oldDoc.id,
      newDocumentId: newDocId,
      documentType: docType,
      newFileName: file.originalname
    });

    const newDoc = {
      id: newDocId,
      userId: oldDoc.user_id,
      documentType: docType,
      fileName: file.originalname,
      fileSize: file.size,
      fileExt: ext,
      mimeType: file.mimetype,
      uploadedBy,
      status: 'Active',
      createdAt: new Date().toISOString(),
      viewUrl: `/api/employees/${identifier}/documents/${newDocId}/view`,
      downloadUrl: `/api/employees/${identifier}/documents/${newDocId}/download`
    };

    return res.json({
      success: true,
      message: 'Document replaced successfully',
      document: newDoc
    });
  } catch (err) {
    console.error('[Replace Document Error]', err);
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    return errorRes(res, 'Failed to replace document: ' + err.message, [err.message], 500);
  }
};

// ── 9. EMPLOYEE DOCUMENTS: DELETE ───────────────────────────────────
exports.deleteDocument = async (req, res) => {
  try {
    const { id: identifier, docId } = req.params;
    const user = await resolveEmployeeUser(identifier);
    if (!user) {
      return errorRes(res, 'Employee record not found', [], 404);
    }

    if (!assertLocationAccess(req.user, user.location_id)) {
      return res.status(403).json({ success: false, message: 'Access denied for this employee location' });
    }

    const [rows] = await pool.query(
      'SELECT * FROM employee_documents WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      [Number(docId)]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Document not found or already deleted' });
    }
    const doc = rows[0];

    // Soft delete to preserve audit history
    await pool.query(
      "UPDATE employee_documents SET deleted_at = NOW(), status = 'Deleted' WHERE id = ?",
      [doc.id]
    );

    await logAction(req.user ? req.user.username : 'HR', 'DELETE_EMPLOYEE_DOCUMENT', 'EMPLOYEES', {
      userId: doc.user_id,
      documentId: doc.id,
      fileName: doc.file_name,
      documentType: doc.document_type
    });

    return res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (err) {
    console.error('[Delete Document Error]', err);
    return errorRes(res, 'Failed to delete document: ' + err.message, [err.message], 500);
  }
};

// ── 10. COMPLETE EMPLOYEE PROFILE ───────────────────────────────────
exports.getEmployeeProfile = async (req, res) => {
  try {
    const identifier = req.params.id;
    const result = await employeeMasterService.getEmployeeProfile(req, identifier);
    if (result.notFound) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    if (result.forbidden) {
      return res.status(403).json({ success: false, message: 'Access denied for this employee record' });
    }

    return res.json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error('[Get Employee Profile Error]', err);
    return errorRes(res, 'Failed to load employee profile', [err.message], 500);
  }
};
