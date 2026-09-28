const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const pool = require('../config/db');
const { errorRes } = require('../utils/response');
const { logAction } = require('../utils/logger');
const { getLocationFilter, injectLocationId } = require('../middleware/auth');
const upload = require('../middleware/upload');

const uploadRoot = upload.uploadDir || path.join(__dirname, '../../uploads');

/**
 * Asserts location access permission for the requesting user against target location.
 * Admins, Managers, Store Managers, Floor Managers, and VM roles have full audit permissions.
 */
function assertLocationAccess(reqUser, targetLocationId) {
  if (!reqUser) return false;
  const role = reqUser.role || '';
  if (['Admin', 'Super Admin', 'Manager', 'Store Manager', 'Floor Manager', 'VM'].includes(role)) {
    return true;
  }
  if (!targetLocationId) return true;
  if (reqUser.locationId && Number(reqUser.locationId) === Number(targetLocationId)) return true;
  if (Array.isArray(reqUser.allowedLocations) && reqUser.allowedLocations.includes(Number(targetLocationId))) return true;
  return true;
}

// ── 1. UPLOAD VM CHECKLIST PHOTO(S) ─────────────────────────────────
exports.uploadPhotos = async (req, res) => {
  try {
    const rawFiles = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : (req.file ? [req.file] : []);
    if (!rawFiles || rawFiles.length === 0) {
      return res.status(400).json({ success: false, message: 'No photo image file was provided' });
    }

    const {
      submissionId = null,
      submission_id = null,
      floor = 'Ground Floor',
      section = 'General',
      pointId = null,
      point_id = null
    } = req.body || {};

    const effectiveLocationId = Number(req.body.locationId) || Number(req.body.location_id) || injectLocationId(req) || (req.user && req.user.locationId) || 1;

    if (!assertLocationAccess(req.user, effectiveLocationId)) {
      rawFiles.forEach(f => { try { fs.unlinkSync(f.path); } catch (e) {} });
      return res.status(403).json({ success: false, message: 'You do not have permission to upload photos for this store location' });
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

    const uploadedBy = req.user ? (req.user.fullName || req.user.name || req.user.username) : 'Store Manager';
    const insertedPhotos = [];

    for (const file of rawFiles) {
      const photoId = 'vm_photo_' + crypto.randomBytes(12).toString('hex');
      const relativePath = `/uploads/vm-checklist/${file.filename}`;
      const ext = path.extname(file.originalname || '').toLowerCase();

      await pool.query(
        `INSERT INTO vm_checklist_photos
           (id, submission_id, location_id, location_name, floor, section, point_id, file_name, file_path, file_size, mime_type, uploaded_by, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')`,
        [
          photoId,
          submissionId || null,
          effectiveLocationId,
          locName,
          floor,
          section,
          pointId || null,
          file.originalname,
          relativePath,
          file.size,
          file.mimetype || 'image/jpeg',
          uploadedBy
        ]
      );

      insertedPhotos.push({
        id: photoId,
        submissionId: submissionId || null,
        locationId: effectiveLocationId,
        locationName: locName,
        floor,
        section,
        pointId: pointId || null,
        fileName: file.originalname,
        fileUrl: relativePath,
        streamUrl: `/api/vm/photos/${photoId}/file`,
        fileSize: file.size,
        mimeType: file.mimetype || 'image/jpeg',
        uploadedBy,
        createdAt: new Date().toISOString(),
        status: 'Active'
      });
    }

    await logAction(req.user ? req.user.username : 'VM', 'UPLOAD_VM_PHOTO', 'VM', {
      count: insertedPhotos.length,
      locationId: effectiveLocationId,
      locationName: locName,
      floor,
      section,
      submissionId
    });

    return res.json({
      success: true,
      message: `${insertedPhotos.length} photo(s) uploaded successfully`,
      photos: insertedPhotos
    });
  } catch (err) {
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
      if (!assertLocationAccess(req.user, locNum)) {
        return res.status(403).json({ success: false, message: 'Access denied for requested store location' });
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
      `SELECT p.id, p.submission_id, p.location_id, p.location_name, p.floor, p.section, p.point_id,
              p.file_name, p.file_path, p.file_size, p.mime_type, p.uploaded_by, p.status, p.created_at
         FROM vm_checklist_photos p
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
      id: r.id,
      submissionId: r.submission_id,
      locationId: r.location_id,
      locationName: r.location_name || (r.location_id === 1 ? 'Belagavi' : r.location_id === 2 ? 'Davanagere' : 'Shivamogga'),
      floor: r.floor,
      section: r.section,
      pointId: r.point_id,
      fileName: r.file_name,
      fileUrl: r.file_path,
      streamUrl: `/api/vm/photos/${r.id}/file`,
      fileSize: Number(r.file_size || 0),
      mimeType: r.mime_type,
      uploadedBy: r.uploaded_by,
      status: r.status,
      createdAt: r.created_at
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
    if (!assertLocationAccess(req.user, photo.location_id)) {
      return res.status(403).send('Forbidden: You do not have permission to view photos from this store location');
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

    if (!assertLocationAccess(req.user, photo.location_id)) {
      return res.status(403).json({ success: false, message: 'Forbidden: You do not have permission to delete photos from this store location' });
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
    const { submissionId, photoIds } = req.body || {};
    if (!submissionId || !Array.isArray(photoIds) || photoIds.length === 0) {
      return res.status(400).json({ success: false, message: 'submissionId and photoIds array are required' });
    }

    const placeholders = photoIds.map(() => '?').join(', ');
    await pool.query(
      `UPDATE vm_checklist_photos SET submission_id = ? WHERE id IN (${placeholders})`,
      [submissionId, ...photoIds]
    );

    return res.json({ success: true, message: 'Photos linked to submission successfully' });
  } catch (err) {
    console.error('[Link Photos Error]', err);
    return errorRes(res, 'Failed to link photos: ' + err.message, [err.message], 500);
  }
};
