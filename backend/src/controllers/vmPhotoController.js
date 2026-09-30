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
    status: p.status,
    // Management fields: an image with no observation attached proves very little.
    caption: p.caption !== undefined ? p.caption : (p.captionText || null),
    label: p.label !== undefined ? p.label : (p.photoLabel || null),
    correctiveAction: p.corrective_action !== undefined ? p.corrective_action : (p.correctiveAction || null),
    photoOrder: Number((p.photo_order !== undefined ? p.photo_order : p.photoOrder) || 0),
    updatedAt: p.updated_at !== undefined ? p.updated_at : (p.updatedAt || null),
    updatedBy: p.updated_by !== undefined ? p.updated_by : (p.updatedBy || null),
    // Present when the query joined vmsubmissions for the admin gallery filters.
    // listPhotos aliases those columns as `shift` / `scorePercent` / `entryDate`,
    // so both spellings are read here rather than guessing which caller ran.
    auditShift: p.audit_shift !== undefined ? p.audit_shift : (p.shift ?? p.auditShift ?? null),
    auditScorePercent: (() => {
      const raw = p.audit_score !== undefined ? p.audit_score : (p.scorePercent ?? p.auditScorePercent);
      return raw === null || raw === undefined ? null : Number(raw);
    })(),
    auditDate: p.audit_entry_date !== undefined ? p.audit_entry_date : (p.entryDate ?? p.auditDate ?? null)
  };
}

/**
 * Append one management action on a photo.
 *
 * Audit evidence must never change silently, so every upload, edit, replacement and
 * delete records who did it, when, and which file was swapped for which. This is
 * append-only: no code path in the app removes rows from it.
 */
async function recordPhotoHistory(req, { photoId, submissionId = null, action, field = null, oldValue = null, newValue = null, oldFileName = null, newFileName = null, oldFilePath = null, newFilePath = null }) {
  try {
    await pool.query(
      `INSERT INTO vm_photo_history
         (photo_id, submission_id, action, field, old_value, new_value, old_file_name, new_file_name, old_file_path, new_file_path, changed_by, changed_by_role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        photoId, submissionId, action, field,
        oldValue === null || oldValue === undefined ? null : String(oldValue),
        newValue === null || newValue === undefined ? null : String(newValue),
        oldFileName, newFileName, oldFilePath, newFilePath,
        req?.user ? (req.user.fullName || req.user.username) : null,
        req?.user ? req.user.role : null
      ]
    );
  } catch (err) {
    // A missing history table must not fail the user's upload; the write is logged
    // instead so the gap is visible rather than swallowed.
    console.error('[VM Photo History] write failed:', err.message);
  }
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

    // Server-side role check: CRM Managers, Managers, VM, Visual Merchandisers, VM Extension Telecaller, and Administrators
    const allowedRoles = [
      'admin',
      'super admin',
      'system administrator',
      'crm manager',
      'manager',
      'store manager',
      'floor manager',
      'vm',
      'visual merchandiser',
      'vm extension telecaller',
      'vm telecaller',
      'vm auditor',
      'auditor'
    ];
    const userRole = (req.user && req.user.role ? String(req.user.role).trim().toLowerCase() : '');
    const isVmRole = userRole.includes('vm') || userRole.includes('merchandis');
    if (!allowedRoles.includes(userRole) && !isVmRole) {
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

    // §8 display order has to live in the row, not in the client's array position,
    // or it changes every time the list is re-read after a refresh.
    let nextOrder = 0;
    if (effectiveAuditId) {
      try {
        const [maxRow] = await pool.query(
          'SELECT COALESCE(MAX(photo_order), 0) AS m FROM vm_checklist_photos WHERE submission_id = ? AND floor = ? AND section = ?',
          [effectiveAuditId, floor, section]
        );
        nextOrder = Number(maxRow[0]?.m || 0);
      } catch (e) {
        nextOrder = 0;
      }
    }

    const photoCaption = String(req.body.caption || req.body.observation || '').trim();
    const photoLabel = String(req.body.label || '').trim();
    const photoCorrective = String(req.body.correctiveAction || req.body.corrective_action || '').trim();

    for (const file of rawFiles) {
      const photoId = 'vm_photo_' + crypto.randomBytes(12).toString('hex');
      const relativePath = `/uploads/vm-checklist/${file.filename}`;
      nextOrder += 1;

      await pool.query(
        `INSERT INTO vm_checklist_photos
           (id, submission_id, location_id, location_name, floor, section, point_id, file_name, file_path, file_size, mime_type, uploaded_by, inspection_date, status, caption, label, corrective_action, photo_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?, ?, ?)`,
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
          effectiveInspectionDate,
          photoCaption || null,
          photoLabel || null,
          photoCorrective || null,
          nextOrder
        ]
      );

      await recordPhotoHistory(req, {
        photoId,
        submissionId: effectiveAuditId,
        action: 'UPLOADED',
        newFileName: file.originalname,
        newFilePath: relativePath,
        newValue: photoCaption || null
      });

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
        caption: photoCaption || null,
        label: photoLabel || null,
        correctiveAction: photoCorrective || null,
        photoOrder: nextOrder,
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
      shift,
      auditDate,
      minScore,
      maxScore,
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

    // §23 the admin gallery filters on the parent audit's shift and score. These
    // reference `s`, so the count query below has to carry the same join.
    if (shift && shift !== 'All') {
      whereClauses.push('s.shift = ?');
      params.push(shift);
    }
    if (minScore !== undefined && minScore !== '' && Number.isFinite(Number(minScore))) {
      whereClauses.push('s.scorePercent >= ?');
      params.push(Number(minScore));
    }
    if (maxScore !== undefined && maxScore !== '' && Number.isFinite(Number(maxScore))) {
      whereClauses.push('s.scorePercent <= ?');
      params.push(Number(maxScore));
    }
    if (auditDate && auditDate !== 'All') {
      whereClauses.push('p.inspection_date = ?');
      params.push(auditDate);
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
              p.caption, p.label, p.corrective_action, p.photo_order, p.updated_at, p.updated_by,
              s.scorePercent, s.status as audit_status, s.shift, s.entryDate as audit_entry_date
         FROM vm_checklist_photos p
         LEFT JOIN locations l ON l.id = p.location_id
         LEFT JOIN vmsubmissions s ON s.id = p.submission_id
         ${whereSql}
        ORDER BY p.photo_order ASC, p.created_at DESC
        LIMIT ? OFFSET ?`,
      [...params, safeLimit, safeOffset]
    );

    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total
         FROM vm_checklist_photos p
         LEFT JOIN vmsubmissions s ON s.id = p.submission_id
         ${whereSql}`,
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
      "UPDATE vm_checklist_photos SET deleted_at = NOW(), status = 'Deleted', updated_at = NOW(), updated_by = ? WHERE id = ?",
      [(req.user && (req.user.fullName || req.user.username)) || 'VM', photoId]
    );

    await recordPhotoHistory(req, {
      photoId,
      submissionId: photo.submission_id,
      action: 'DELETED',
      oldFileName: photo.file_name,
      oldFilePath: photo.file_path
    });

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

/**
 * Loads a photo and applies the same authorisation the delete path uses: a manager
 * role or the uploader, and only within the caller's own store. Shared so that
 * editing, replacing and deleting can never disagree about who may act.
 */
async function loadAuthorisedPhoto(req, res) {
  const photoId = req.params.photoId;
  const [rows] = await pool.query(
    'SELECT * FROM vm_checklist_photos WHERE id = ? AND deleted_at IS NULL LIMIT 1',
    [photoId]
  );
  if (!rows || rows.length === 0) {
    res.status(404).json({ success: false, message: 'Photo not found' });
    return null;
  }
  const photo = rows[0];

  const userRole = (req.user && req.user.role ? String(req.user.role).trim().toLowerCase() : '');
  const isManagerRole = ['admin', 'super admin', 'system administrator', 'crm manager', 'manager', 'store manager'].includes(userRole);
  const identity = req.user ? [req.user.fullName, req.user.name, req.user.username].filter(Boolean) : [];
  const isOwner = !!req.user && identity.some((v) => String(v) === String(photo.uploaded_by));
  if (!isManagerRole && !isOwner) {
    res.status(403).json({ success: false, message: 'Permission denied: You do not have permission to manage this audit photo' });
    return null;
  }
  if (!await assertLocationAccess(req.user, photo.location_id)) {
    res.status(403).json({ success: false, message: `Forbidden: store location ${photo.location_id} is not assigned to your account` });
    return null;
  }
  return photo;
}

// ── EDIT PHOTO METADATA ─────────────────────────────────────────────
// Changes the caption / label / observation / question link without touching the
// image bytes, and records each changed field in the history trail.
exports.updatePhotoMetadata = async (req, res) => {
  try {
    const photo = await loadAuthorisedPhoto(req, res);
    if (!photo) return;

    const { caption, observation, label, correctiveAction, corrective_action, pointId, point_id, photoOrder } = req.body || {};

    // Only fields the caller actually sent are written, so a partial edit cannot
    // blank out evidence the user never meant to change.
    const edits = [];
    const desired = {
      caption: (caption !== undefined ? caption : observation),
      label,
      corrective_action: (correctiveAction !== undefined ? correctiveAction : corrective_action),
      point_id: (pointId !== undefined ? pointId : point_id),
      photo_order: photoOrder
    };
    for (const [column, value] of Object.entries(desired)) {
      if (value === undefined) continue;
      const normalised = value === null || value === '' ? null : (column === 'photo_order' ? Number(value) : String(value).trim());
      const current = photo[column] === undefined ? null : photo[column];
      if (String(current ?? '') === String(normalised ?? '')) continue;
      edits.push({ column, from: current, to: normalised });
    }

    if (edits.length === 0) {
      return res.json({ success: true, message: 'No changes to save', photo: mapVmPhoto(photo) });
    }

    const sets = edits.map((e) => `\`${e.column}\` = ?`).join(', ');
    const params = edits.map((e) => e.to);
    await pool.query(
      `UPDATE vm_checklist_photos SET ${sets}, updated_at = NOW(), updated_by = ? WHERE id = ?`,
      [...params, (req.user && (req.user.fullName || req.user.username)) || 'VM', photo.id]
    );

    for (const e of edits) {
      await recordPhotoHistory(req, {
        photoId: photo.id, submissionId: photo.submission_id, action: 'EDITED', field: e.column,
        oldValue: e.from, newValue: e.to
      });
    }

    await logAction(req.user ? req.user.username : 'VM', 'EDIT_VM_PHOTO', 'VM', {
      photoId: photo.id, fields: edits.map((e) => e.column), floor: photo.floor, section: photo.section
    });

    const [refreshed] = await pool.query('SELECT * FROM vm_checklist_photos WHERE id = ?', [photo.id]);
    try {
      realtimeService.emitVmChange('UPDATE', { id: photo.submission_id || photo.id, floor: photo.floor, section: photo.section, location_id: photo.location_id }, photo.location_id);
    } catch (wsErr) {}

    return res.json({ success: true, message: 'Photo details updated successfully.', photo: mapVmPhoto(refreshed[0]) });
  } catch (err) {
    console.error('[Update VM Photo Metadata Error]', err);
    return errorRes(res, 'Failed to update photo details: ' + err.message, [err.message], 500);
  }
};

// ── REPLACE THE IMAGE ON THE SAME RECORD ────────────────────────────
// Keeps id / submission / floor / section / question intact and swaps only the
// bytes, so the audit relationship and the history chain survive (§14). The old
// file is removed only after the row has been updated, so a failed write can never
// leave a record pointing at a deleted image.
exports.replacePhoto = async (req, res) => {
  let savedFilePath = null;
  try {
    const photo = await loadAuthorisedPhoto(req, res);
    if (!photo) return;

    const file = req.file || (Array.isArray(req.files) ? req.files[0] : null);
    if (!file) {
      return res.status(400).json({ success: false, message: 'A replacement image file is required' });
    }

    const allowed = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowed.includes(String(file.mimetype).toLowerCase())) {
      try { fs.unlinkSync(file.path); } catch (e) {}
      return res.status(400).json({ success: false, message: 'Please upload a JPG, JPEG, or PNG image.' });
    }

    const caption = String(req.body?.caption ?? req.body?.observation ?? '').trim();
    const nextCorrective = String(req.body?.correctiveAction ?? req.body?.corrective_action ?? '').trim();
    savedFilePath = `/uploads/vm-checklist/${file.filename}`;

    await pool.query(
      `UPDATE vm_checklist_photos
          SET file_name = ?, file_path = ?, file_size = ?, mime_type = ?,
              caption = COALESCE(?, caption),
              corrective_action = COALESCE(?, corrective_action),
              updated_at = NOW(), updated_by = ?
        WHERE id = ?`,
      [
        file.originalname, savedFilePath, file.size, file.mimetype || 'image/jpeg',
        caption || null, nextCorrective || null,
        (req.user && (req.user.fullName || req.user.username)) || 'VM',
        photo.id
      ]
    );

    await recordPhotoHistory(req, {
      photoId: photo.id, submissionId: photo.submission_id, action: 'REPLACED',
      oldFileName: photo.file_name, newFileName: file.originalname,
      oldFilePath: photo.file_path, newFilePath: savedFilePath
    });

    // Row now points at the new file; the superseded image is cleaned up after.
    if (photo.file_path && photo.file_path !== savedFilePath) {
      try {
        const oldAbs = path.join(uploadRoot, photo.file_path.replace(/^\/uploads\//, ''));
        if (fs.existsSync(oldAbs)) fs.unlinkSync(oldAbs);
      } catch (e) {
        console.warn('[Replace VM Photo] old file cleanup failed:', e.message);
      }
    }

    await logAction(req.user ? req.user.username : 'VM', 'REPLACE_VM_PHOTO', 'VM', {
      photoId: photo.id, oldFile: photo.file_name, newFile: file.originalname, floor: photo.floor, section: photo.section
    });

    const [refreshed] = await pool.query('SELECT * FROM vm_checklist_photos WHERE id = ?', [photo.id]);
    try {
      realtimeService.emitVmChange('UPDATE', { id: photo.submission_id || photo.id, floor: photo.floor, section: photo.section, location_id: photo.location_id }, photo.location_id);
    } catch (wsErr) {}

    return res.json({ success: true, message: 'Photo replaced successfully.', photo: mapVmPhoto(refreshed[0]) });
  } catch (err) {
    // Storage succeeded but the database write did not: drop the orphan file.
    if (savedFilePath) {
      try {
        const abs = path.join(uploadRoot, savedFilePath.replace(/^\/uploads\//, ''));
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
      } catch (e) {}
    }
    console.error('[Replace VM Photo Error]', err);
    return errorRes(res, 'Failed to replace photo: ' + err.message, [err.message], 500);
  }
};

// ── PHOTO HISTORY ───────────────────────────────────────────────────
exports.getPhotoHistory = async (req, res) => {
  try {
    const photoId = req.params.photoId;
    const [rows] = await pool.query('SELECT * FROM vm_checklist_photos WHERE id = ? LIMIT 1', [photoId]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Photo not found' });
    }
    if (!await assertLocationAccess(req.user, rows[0].location_id)) {
      return res.status(403).json({ success: false, message: `Forbidden: store location ${rows[0].location_id} is not assigned to your account` });
    }

    const [hist] = await pool.query(
      'SELECT * FROM vm_photo_history WHERE photo_id = ? ORDER BY changed_at ASC, id ASC',
      [photoId]
    );
    return res.json({
      success: true,
      photo: mapVmPhoto(rows[0]),
      history: (hist || []).map((h) => ({
        id: h.id,
        action: h.action,
        field: h.field,
        oldValue: h.old_value,
        newValue: h.new_value,
        oldFileName: h.old_file_name,
        newFileName: h.new_file_name,
        changedBy: h.changed_by,
        changedByRole: h.changed_by_role,
        changedAt: h.changed_at
      }))
    });
  } catch (err) {
    console.error('[VM Photo History Error]', err);
    return errorRes(res, 'Failed to load photo history: ' + err.message, [err.message], 500);
  }
};

// Shared with vmController so the audit flow and the photo flow cannot drift apart
// on who may act on which store, or on how a photo row is presented to the client.
exports.assertLocationAccess = assertLocationAccess;
exports.resolveAuditLocationId = resolveAuditLocationId;
exports.mapVmPhoto = mapVmPhoto;
exports.getVmPhotos = getVmPhotos;

