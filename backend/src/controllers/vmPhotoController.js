const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const pool = require('../config/db');
const { errorRes } = require('../utils/response');
const { logAction } = require('../utils/logger');
const { getLocationFilter, injectLocationId } = require('../middleware/auth');
const upload = require('../middleware/upload');
const realtimeService = require('../services/realtimeService');
const { getISTDateString } = require('../utils/dates');

const uploadRoot = upload.uploadDir || path.join(__dirname, '../../uploads');

/** Roles that are not pinned to a single store and may act anywhere. */
const VM_BYPASS_ROLES = ['admin', 'super admin', 'system administrator'];

/**
 * Asserts that the requesting user may act on the given store location.
 *
 * This used to end in an unconditional `return true`, so it read like enforcement
 * and enforced nothing: any signed-in user could file photos against another
 * store. The rule now matches the semantics of getLocationFilter()/
 * injectLocationId() in middleware/auth.js:
 *   • Admin / Super Admin / System Administrator — no location pin.
 *   • Manager / Store Manager / Floor Manager / VM / CRM Manager and everyone
 *     else — only their own location, or one granted through user_locations.
 * A missing or unparsable target is denied rather than waved through.
 *
 * @returns {Promise<boolean>}
 */
async function assertLocationAccess(reqUser, targetLocationId) {
  if (!reqUser) return false;

  const role = String(reqUser.role || '').trim().toLowerCase();
  if (VM_BYPASS_ROLES.includes(role)) return true;

  const target = Number(targetLocationId);
  if (!Number.isFinite(target) || target <= 0) return false;

  if (Number(reqUser.locationId) === target) return true;

  const allowed = Array.isArray(reqUser.allowedLocations) ? reqUser.allowedLocations.map(Number) : [];
  if (allowed.includes(target)) return true;

  // Multi-location grants live in user_locations, exactly like getLocationFilter reads them.
  try {
    const [rows] = await pool.query('SELECT location_id FROM user_locations WHERE user_id = ?', [reqUser.id]);
    return (rows || []).some(r => Number(r.location_id) === target);
  } catch (err) {
    // Junction table unavailable — a user we cannot verify is a user we must deny.
    return false;
  }
}

/**
 * The store an audit/photo belongs to: an explicit request value first (admins may
 * target any store; restricted users are caught by assertLocationAccess), then the
 * clamped injectLocationId() resolution, then the account's own store.
 */
function resolveAuditLocationId(req) {
  const body = req.body || {};
  const requested = Number(body.locationId || body.location_id) || null;
  return requested || injectLocationId(req) || (req.user ? Number(req.user.locationId) : null) || null;
}

/**
 * One photo row → the camelCase `VmPhoto` the frontend contract declares
 * (frontend/src/pages/vm/vmTypes.ts). The legacy keys the old page reads
 * (fileUrl / streamUrl / original_name) stay, so this is add-only.
 */
function mapVmPhoto(p) {
  return {
    id: p.id,
    submissionId: p.submission_id !== undefined ? p.submission_id : p.submissionId,
    locationId: p.location_id !== undefined ? p.location_id : p.locationId,
    locationName: p.location_name !== undefined ? p.location_name : p.locationName,
    floor: p.floor,
    section: p.section,
    pointId: p.point_id !== undefined ? p.point_id : p.pointId,
    fileName: p.file_name !== undefined ? p.file_name : p.fileName,
    original_name: p.file_name !== undefined ? p.file_name : p.fileName,
    fileUrl: p.file_path !== undefined ? p.file_path : p.filePath,
    url: `/api/vm/photos/${p.id}/file`,
    streamUrl: `/api/vm/photos/${p.id}/file`,
    fileSize: Number((p.file_size !== undefined ? p.file_size : p.fileSize) || 0),
    mimeType: p.mime_type !== undefined ? p.mime_type : p.mimeType,
    uploadedBy: p.uploaded_by !== undefined ? p.uploaded_by : p.uploadedBy,
    inspectionDate: p.inspection_date !== undefined ? p.inspection_date : p.inspectionDate,
    createdAt: p.created_at !== undefined ? p.created_at : p.createdAt,
    status: p.status
  };
}

/** Active photos of one or many audits, newest first — one query, never per audit. */
async function getVmPhotos(submissionIds = []) {
  const ids = (Array.isArray(submissionIds) ? submissionIds : [submissionIds]).filter(Boolean);
  if (ids.length === 0) return [];
  const [rows] = await pool.query(
    "SELECT * FROM vm_checklist_photos WHERE submission_id IN (?) AND status != 'Deleted' AND deleted_at IS NULL ORDER BY created_at DESC",
    [ids]
  );
  return (rows || []).map(mapVmPhoto);
}


// ── 1. UPLOAD VM CHECKLIST PHOTO(S) ─────────────────────────────────
exports.uploadPhotos = async (req, res) => {
  const rawFiles = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : (req.file ? [req.file] : []);
  try {
    if (!rawFiles || rawFiles.length === 0) {
      return res.status(400).json({ success: false, message: 'No photo image file was provided' });
    }

    // Server-side role check: CRM Managers, Managers, VM, and System Administrators (plus Super Admin / Admin)
    const allowedRoles = ['admin', 'super admin', 'system administrator', 'crm manager', 'manager', 'store manager', 'floor manager', 'vm'];
    const userRole = (req.user && req.user.role ? String(req.user.role).trim().toLowerCase() : '');
    if (!allowedRoles.includes(userRole)) {
      rawFiles.forEach(f => { try { fs.unlinkSync(f.path); } catch (e) {} });
      return res.status(403).json({
        success: false,
        message: 'Permission denied: Only authorized VM auditors and administrators can attach inspection photos'
      });
    }

    // Configurable limits: 5MB per image, 5 images per section
    const MAX_IMAGE_SIZE_BYTES = parseInt(process.env.VM_MAX_IMAGE_SIZE_BYTES || (5 * 1024 * 1024), 10); // 5MB default
    const MAX_IMAGES_PER_SECTION = parseInt(process.env.VM_MAX_IMAGES_PER_SECTION || 5, 10); // 5 images per section

    // Check individual file size limits
    for (const file of rawFiles) {
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        rawFiles.forEach(f => { try { fs.unlinkSync(f.path); } catch (e) {} });
        return res.status(400).json({
          success: false,
          message: `Photo "${file.originalname}" exceeds the maximum allowed size of 5MB`
        });
      }
    }

    const {
      submissionId = null,
      submission_id = null,
      floor = 'Ground Floor',
      section = 'General',
      pointId = null,
      point_id = null,
      inspectionDate = null,
      inspection_date = null
    } = req.body || {};

    const effectiveAuditId = submissionId || submission_id || null;
    // The audit day is the Asia/Kolkata calendar day. toISOString() is UTC, so every
    // photo uploaded between 00:00 and 05:29 IST was filed under yesterday.
    const effectiveInspectionDate = inspectionDate || inspection_date || getISTDateString();

    // Check section image count limit
    if (rawFiles.length > MAX_IMAGES_PER_SECTION) {
      rawFiles.forEach(f => { try { fs.unlinkSync(f.path); } catch (e) {} });
      return res.status(400).json({
        success: false,
        message: `Cannot upload more than ${MAX_IMAGES_PER_SECTION} photos at a time for this section`
      });
    }

    if (effectiveAuditId) {
      const [existingPhotos] = await pool.query(
        "SELECT COUNT(*) as cnt FROM vm_checklist_photos WHERE submission_id = ? AND floor = ? AND section = ? AND status != 'Deleted'",
        [effectiveAuditId, floor, section]
      );
      if ((existingPhotos[0]?.cnt || 0) + rawFiles.length > MAX_IMAGES_PER_SECTION) {
        rawFiles.forEach(f => { try { fs.unlinkSync(f.path); } catch (e) {} });
        return res.status(400).json({
          success: false,
          message: `Exceeds maximum limit of ${MAX_IMAGES_PER_SECTION} photos for this section in audit #${effectiveAuditId}`
        });
      }
    }

    const effectiveLocationId = resolveAuditLocationId(req);

    // Photos cannot be attached to an audit that does not exist, and the audit's own
    // store is authoritative: a mismatched body locationId must not move evidence to
    // another store.
    let targetAudit = null;
    if (effectiveAuditId) {
      const [auditRows] = await pool.query(
        'SELECT id, location_id, floor, section, status FROM vmsubmissions WHERE id = ? LIMIT 1',
        [effectiveAuditId]
      );
      if (!auditRows || auditRows.length === 0) {
        rawFiles.forEach(f => { try { fs.unlinkSync(f.path); } catch (e) {} });
        return res.status(404).json({ success: false, message: `VM audit "${effectiveAuditId}" not found` });
      }
      targetAudit = auditRows[0];
    }

    const sameLocation = !effectiveAuditId ||
      !targetAudit ||
      !effectiveLocationId ||
      Number(targetAudit.location_id) === Number(effectiveLocationId);

    if (!sameLocation) {
      rawFiles.forEach(f => { try { fs.unlinkSync(f.path); } catch (e) {} });
      return res.status(400).json({
        success: false,
        message: `Photo store location ${effectiveLocationId} does not match audit location ${targetAudit.location_id}`
      });
    }

    if (!await assertLocationAccess(req.user, effectiveLocationId || (targetAudit && targetAudit.location_id))) {
      rawFiles.forEach(f => { try { fs.unlinkSync(f.path); } catch (e) {} });
      return res.status(403).json({
        success: false,
        message: `Access denied: store location ${effectiveLocationId} is not assigned to your account. Photos can only be attached to an audit of your own store.`
      });
    }

    // Resolve location name
    let locName = req.body.locationName || req.body.location_name || '';
    if (!locName) {
      try {
        const [locRows] = await pool.query('SELECT location_name FROM locations WHERE id = ? LIMIT 1', [effectiveLocationId]);
        if (locRows && locRows.length > 0) locName = locRows[0].location_name;
      } catch (e) {}
    }
    if (!locName) {
      locName = effectiveLocationId === 1 ? 'Belagavi' : effectiveLocationId === 2 ? 'Davanagere' : 'Shivamogga';
    }

    const uploadedBy = req.user ? (req.user.fullName || req.user.name || req.user.username) : 'CRM Manager';
    const insertedPhotos = [];

    for (const file of rawFiles) {
      const photoId = 'vm_photo_' + crypto.randomBytes(12).toString('hex');
      const relativePath = `/uploads/vm-checklist/${file.filename}`;

      await pool.query(
        `INSERT INTO vm_checklist_photos
           (id, submission_id, location_id, location_name, floor, section, point_id, file_name, file_path, file_size, mime_type, uploaded_by, inspection_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')`,
        [
          photoId,
          effectiveAuditId,
          effectiveLocationId,
          locName,
          floor,
          section,
          pointId || point_id || null,
          file.originalname,
          relativePath,
          file.size,
          file.mimetype || 'image/jpeg',
          uploadedBy,
          effectiveInspectionDate
        ]
      );

      insertedPhotos.push({
        id: photoId,
        submissionId: effectiveAuditId,
        locationId: effectiveLocationId,
        locationName: locName,
        floor,
        section,
        pointId: pointId || point_id || null,
        fileName: file.originalname,
        original_name: file.originalname,
        fileUrl: relativePath,
        url: `/api/vm/photos/${photoId}/file`,
        streamUrl: `/api/vm/photos/${photoId}/file`,
        fileSize: file.size,
        mimeType: file.mimetype || 'image/jpeg',
        uploadedBy,
        inspectionDate: effectiveInspectionDate,
        createdAt: new Date().toISOString(),
        status: 'Active'
      });
    }

    await logAction(req.user ? req.user.username : 'CRM Manager', 'UPLOAD_VM_PHOTO', 'VM', {
      count: insertedPhotos.length,
      locationId: effectiveLocationId,
      locationName: locName,
      floor,
      section,
      submissionId: effectiveAuditId,
      inspectionDate: effectiveInspectionDate
    });

    try {
      realtimeService.emitVmChange('UPDATE', {
        id: effectiveAuditId || 'photo_upload',
        floor,
        section,
        location_id: effectiveLocationId
      }, effectiveLocationId);
    } catch (wsErr) {}

    return res.json({
      success: true,
      message: `${insertedPhotos.length} photo(s) attached successfully`,
      photos: insertedPhotos
    });
  } catch (err) {
    if (rawFiles && rawFiles.length > 0) {
      rawFiles.forEach(f => { try { fs.unlinkSync(f.path); } catch (e) {} });
    }
    console.error('[VM Photo Upload Error]', err);
    return errorRes(res, 'Failed to upload VM checklist photos: ' + err.message, [err.message], 500);
  }
};

// ── 2. LIST VM CHECKLIST PHOTOS WITH ADMIN FILTERS ───────────────────
exports.listPhotos = async (req, res) => {
  try {
    const {
      locationId,
      floor,
      section,
      submissionId,
      pointId,
      date,
      dateFrom,
      dateTo,
      inspector,
      status,
      limit = 100,
      offset = 0
    } = req.query || {};

    const whereClauses = ['p.deleted_at IS NULL'];
    const params = [];

    // Location Security Isolation:
    const { clause: locClause, params: locParams } = await getLocationFilter(req, 'p');
    if (locClause) {
      whereClauses.push(locClause.replace(/^\s*AND\s*/i, ''));
      params.push(...locParams);
    }

    if (locationId && locationId !== 'All') {
      const locNum = Number(locationId);
      if (!await assertLocationAccess(req.user, locNum)) {
        return res.status(403).json({
          success: false,
          message: `Access denied: store location ${locNum} is not assigned to your account`
        });
      }
      whereClauses.push('p.location_id = ?');
      params.push(locNum);
    }

    if (floor && floor !== 'All') {
      whereClauses.push('p.floor = ?');
      params.push(floor);
    }

    if (section && section !== 'All') {
      whereClauses.push('p.section = ?');
      params.push(section);
    }

    if (submissionId) {
      whereClauses.push('p.submission_id = ?');
      params.push(submissionId);
    }

    if (pointId) {
      whereClauses.push('p.point_id = ?');
      params.push(pointId);
    }

    if (inspector && inspector !== 'All') {
      whereClauses.push('p.uploaded_by = ?');
      params.push(inspector);
    }

    if (status && status !== 'All') {
      whereClauses.push('p.status = ?');
      params.push(status);
    }

    if (date) {
      whereClauses.push('DATE(p.created_at) = ?');
      params.push(date);
    } else {
      if (dateFrom) {
        whereClauses.push('DATE(p.created_at) >= ?');
        params.push(dateFrom);
      }
      if (dateTo) {
        whereClauses.push('DATE(p.created_at) <= ?');
        params.push(dateTo);
      }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
    const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

    const [rows] = await pool.query(
      `SELECT p.id, p.submission_id, p.location_id,
              COALESCE(l.location_name, p.location_name, CASE p.location_id WHEN 1 THEN 'Belagavi' WHEN 2 THEN 'Davanagere' ELSE 'Shivamogga' END) as location_name,
              COALESCE(l.location_code, CASE p.location_id WHEN 1 THEN 'BEL' WHEN 2 THEN 'DAV' ELSE 'SHI' END) as location_code,
              p.floor, p.section, p.point_id,
              p.file_name, p.file_path, p.file_size, p.mime_type, p.uploaded_by, p.inspection_date, p.status, p.created_at,
              s.scorePercent, s.status as audit_status, s.shift
         FROM vm_checklist_photos p
         LEFT JOIN locations l ON l.id = p.location_id
         LEFT JOIN vmsubmissions s ON s.id = p.submission_id
         ${whereSql}
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?`,
      [...params, safeLimit, safeOffset]
    );

    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM vm_checklist_photos p ${whereSql}`,
      params
    );

    const photos = (rows || []).map(r => ({
      ...mapVmPhoto(r),
      locationCode: r.location_code,
      inspectionDate: r.inspection_date || (r.created_at ? String(r.created_at).slice(0, 10) : null),
      status: r.status,
      scorePercent: r.scorePercent !== null && r.scorePercent !== undefined ? Number(r.scorePercent) : null,
      auditStatus: r.audit_status || 'Completed',
      shift: r.shift || 'Opening'
    }));

    return res.json({
      success: true,
      photos,
      total: countRows[0]?.total || 0,
      limit: safeLimit,
      offset: safeOffset
    });
  } catch (err) {
    console.error('[VM Photos List Error]', err);
    return errorRes(res, 'Failed to list VM checklist photos', [err.message], 500);
  }
};

// ── 3. AUTHENTICATED IMAGE STREAM (LOCATION CONTROLLED) ──────────────
exports.streamPhoto = async (req, res) => {
  try {
    const photoId = req.params.photoId;
    const [rows] = await pool.query(
      'SELECT * FROM vm_checklist_photos WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      [photoId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).send('Photo not found');
    }
    const photo = rows[0];

    // Assert requesting user has permission for this photo's store location
    if (!await assertLocationAccess(req.user, photo.location_id)) {
      return res.status(403).send(`Forbidden: store location ${photo.location_id} is not assigned to your account`);
    }

    const cleanPath = String(photo.file_path || '').replace(/^\//, '');
    const fullPath = path.join(uploadRoot, cleanPath.replace(/^uploads\//, ''));

    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      return res.status(404).send('File not found on storage server');
    }

    const ext = path.extname(fullPath).toLowerCase();
    let mime = photo.mime_type || 'image/jpeg';
    if (ext === '.png') mime = 'image/png';
    else if (ext === '.webp') mime = 'image/webp';

    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    return fs.createReadStream(fullPath).pipe(res);
  } catch (err) {
    console.error('[Stream VM Photo Error]', err);
    return res.status(500).send('Unable to display photo');
  }
};

// ── 4. DELETE VM CHECKLIST PHOTO ────────────────────────────────────
exports.deletePhoto = async (req, res) => {
  try {
    const photoId = req.params.photoId;
    const [rows] = await pool.query(
      'SELECT * FROM vm_checklist_photos WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      [photoId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Photo not found' });
    }
    const photo = rows[0];
    const userRole = (req.user && req.user.role ? String(req.user.role).trim().toLowerCase() : '');
    const isManagerRole = ['admin', 'super admin', 'system administrator', 'crm manager', 'manager', 'store manager'].includes(userRole);
    // vm_checklist_photos has no user_id column — uploaded_by stores the person's name,
    // so ownership is matched on that (against both name and username) rather than on an
    // id that never existed on this table.
    const identity = req.user ? [req.user.fullName, req.user.name, req.user.username].filter(Boolean) : [];
    const isOwner = !!req.user && identity.some(v => String(v) === String(photo.uploaded_by));
    if (!isManagerRole && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied: You do not have permission to delete this audit photo'
      });
    }

    if (!await assertLocationAccess(req.user, photo.location_id)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: store location ${photo.location_id} is not assigned to your account`
      });
    }

    await pool.query(
      "UPDATE vm_checklist_photos SET deleted_at = NOW(), status = 'Deleted' WHERE id = ?",
      [photoId]
    );

    await logAction(req.user ? req.user.username : 'VM', 'DELETE_VM_PHOTO', 'VM', {
      photoId,
      locationId: photo.location_id,
      floor: photo.floor,
      section: photo.section,
      fileName: photo.file_name
    });

    try {
      realtimeService.emitVmChange('DELETE', {
        id: photo.submission_id || photo.id,
        floor: photo.floor,
        section: photo.section,
        location_id: photo.location_id
      }, photo.location_id);
    } catch (wsErr) {}

    return res.json({
      success: true,
      message: 'Photo deleted successfully'
    });
  } catch (err) {
    console.error('[Delete VM Photo Error]', err);
    return errorRes(res, 'Failed to delete photo: ' + err.message, [err.message], 500);
  }
};

// ── 5. LINK UNLINKED SECTION PHOTOS TO CHECKLIST SUBMISSION ─────────
exports.linkPhotosToSubmission = async (req, res) => {
  try {
    const { submissionId, photoIds, inspectionDate } = req.body || {};
    if (!submissionId || !Array.isArray(photoIds) || photoIds.length === 0) {
      return res.status(400).json({ success: false, message: 'submissionId and photoIds array are required' });
    }

    const [auditRows] = await pool.query(
      'SELECT id, location_id, status FROM vmsubmissions WHERE id = ? LIMIT 1',
      [submissionId]
    );
    if (!auditRows || auditRows.length === 0) {
      return res.status(404).json({ success: false, message: `VM audit "${submissionId}" not found` });
    }
    const audit = auditRows[0];

    if (!await assertLocationAccess(req.user, audit.location_id)) {
      return res.status(403).json({
        success: false,
        message: `Access denied: store location ${audit.location_id} is not assigned to your account`
      });
    }

    const placeholders = photoIds.map(() => '?').join(', ');
    const [photoRows] = await pool.query(
      `SELECT id, location_id FROM vm_checklist_photos WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
      photoIds
    );
    if (!photoRows || photoRows.length !== photoIds.length) {
      return res.status(400).json({ success: false, message: 'One or more photos do not exist and cannot be linked' });
    }
    // A photo shot in one store must never be re-filed as evidence in another.
    const foreign = photoRows.filter(p => Number(p.location_id) !== Number(audit.location_id));
    if (foreign.length > 0) {
      return res.status(403).json({
        success: false,
        message: `Photos from another store location cannot be linked to this audit: ${foreign.map(p => p.id).join(', ')}`
      });
    }

    const linkDate = inspectionDate || getISTDateString();
    await pool.query(
      `UPDATE vm_checklist_photos SET submission_id = ?, inspection_date = ? WHERE id IN (${placeholders})`,
      [submissionId, linkDate, ...photoIds]
    );

    await logAction(req.user ? req.user.username : 'VM', 'LINK_VM_PHOTOS', 'VM', {
      submissionId,
      locationId: audit.location_id,
      photoCount: photoIds.length
    });

    return res.json({
      success: true,
      message: 'Photos linked to submission successfully',
      photos: await getVmPhotos(submissionId)
    });
  } catch (err) {
    console.error('[Link Photos Error]', err);
    return errorRes(res, 'Failed to link photos: ' + err.message, [err.message], 500);
  }
};

// Shared with vmController so the audit flow and the photo flow cannot drift apart
// on who may act on which store, or on how a photo row is presented to the client.
exports.assertLocationAccess = assertLocationAccess;
exports.resolveAuditLocationId = resolveAuditLocationId;
exports.mapVmPhoto = mapVmPhoto;
exports.getVmPhotos = getVmPhotos;

