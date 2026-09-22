const db = require('../config/db');
let QRCode = null;
try {
  QRCode = require('qrcode');
} catch (e) {
  console.warn('[FeedbackQrController] qrcode module not found. QR generation will be skipped:', e.message);
}
const crypto = require('crypto');

// Helper to generate UUIDs
function getUUID() {
  try {
    return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
  } catch (e) {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}

function getISTDateString() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + istOffset);
  return istDate.toISOString().split('T')[0];
}

function getISTTimeString(d = new Date()) {
  try {
    let dateObj = d;
    if (typeof d === 'string') {
      const formattedStr = d.includes('Z') || d.includes('+') ? d : d.replace(' ', 'T') + 'Z';
      dateObj = new Date(formattedStr);
      if (isNaN(dateObj.getTime())) dateObj = new Date(d);
    }
    if (!dateObj || isNaN(dateObj.getTime())) return '';
    return dateObj.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: true, 
      timeZone: 'Asia/Kolkata' 
    });
  } catch (e) {
    return '';
  }
}

// Generate sequential QR Code ID (QR-001, QR-002, etc.)
async function generateNextQrCodeId() {
  try {
    const [maxRows] = await db.query(`
      SELECT qrCodeId FROM FeedbackQrCode 
      WHERE qrCodeId REGEXP '^QR-[0-9]+$' AND LENGTH(qrCodeId) <= 7
      ORDER BY CAST(SUBSTRING(qrCodeId, 4) AS UNSIGNED) DESC 
      LIMIT 1
    `);

    if (maxRows && maxRows[0] && maxRows[0].qrCodeId) {
      const rawIdStr = String(maxRows[0].qrCodeId).replace(/^QR-/, '');
      const lastNum = parseInt(rawIdStr, 10);
      if (!isNaN(lastNum) && lastNum >= 0) {
        const nextNum = lastNum + 1;
        return `QR-${String(nextNum).padStart(3, '0')}`;
      }
    }
    return 'QR-001';
  } catch (e) {
    return 'QR-001';
  }
}

// Generate QR Code image (PNG data URL and SVG)
async function generateQrCodeImages(targetUrl) {
  if (!QRCode) {
    return { qrCodeDataUrl: '', qrCodeSvg: '' };
  }
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(targetUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#0B1F35',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    });

    const qrCodeSvg = await QRCode.toString(targetUrl, {
      type: 'svg',
      width: 300,
      margin: 2,
      color: {
        dark: '#0B1F35',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    });

    return { qrCodeDataUrl, qrCodeSvg };
  } catch (err) {
    console.error('[QR Code Generation Error]', err);
    return { qrCodeDataUrl: null, qrCodeSvg: null };
  }
}

// Parse user agent for device info
function parseUserAgent(userAgent) {
  if (!userAgent) return { deviceType: 'unknown', browser: 'unknown', os: 'unknown' };
  
  const ua = userAgent.toLowerCase();
  let deviceType = 'desktop';
  let browser = 'unknown';
  let os = 'unknown';

  // Device type
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    deviceType = 'mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    deviceType = 'tablet';
  }

  // Browser
  if (ua.includes('chrome') && !ua.includes('edg')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('edg')) browser = 'Edge';
  else if (ua.includes('opera') || ua.includes('opr')) browser = 'Opera';

  // OS
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac os') || ua.includes('macos')) os = 'macOS';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';
  else if (ua.includes('linux')) os = 'Linux';

  return { deviceType, browser, os };
}

// Global Admin checker: Admin, Super Admin, and global users bypass location lock
function checkIsGlobalAdmin(session) {
  if (!session) return false;
  return !session.locationId || !!session.isGlobalAdmin || ['Admin', 'Super Admin', 'system administrator'].includes(session.role);
}

// ── Get All QR Codes (Admin Dashboard) ───────────────────────────
exports.getQrCodes = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search = '', 
      status = '', 
      locationId = '',
      floor = '',
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    const session = req.user;
    const isGlobalAdmin = checkIsGlobalAdmin(session);
    const userLocationId = session?.locationId;

    let sql = `
      SELECT 
        fqc.*,
        COALESCE(u.full_name, u.username, fqc.createdByName, 'Admin') as creatorName,
        (SELECT COUNT(*) FROM Feedback WHERE qrCodeId = fqc.qrCodeId) as feedbackCount
      FROM FeedbackQrCode fqc
      LEFT JOIN users u ON fqc.createdBy = u.id
      WHERE fqc.deletedAt IS NULL
    `;
    const params = [];

    // Location filter for non-global admins
    if (!isGlobalAdmin && userLocationId) {
      sql += ' AND fqc.locationId = ?';
      params.push(userLocationId);
    } else if (locationId) {
      sql += ' AND fqc.locationId = ?';
      params.push(locationId);
    }

    if (floor && floor !== 'all') {
      sql += ' AND fqc.floor = ?';
      params.push(floor);
    }

    if (search) {
      sql += ' AND (fqc.name LIKE ? OR fqc.qrCodeId LIKE ? OR fqc.description LIKE ? OR fqc.floor LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    if (status) {
      sql += ' AND fqc.status = ?';
      params.push(status);
    }

    // Validate sort parameters
    const allowedSortFields = ['createdAt', 'updatedAt', 'name', 'qrCodeId', 'scanCount', 'status', 'floor'];
    const allowedSortOrders = ['ASC', 'DESC'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const safeSortOrder = allowedSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

    // Get total count using robust regex replacement
    const countSql = sql.replace(/SELECT[\s\S]*?FROM FeedbackQrCode fqc/, 'SELECT COUNT(*) as total FROM FeedbackQrCode fqc');
    const [countResult] = await db.query(countSql, params);
    const total = countResult[0]?.total || 0;

    // Add pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ` ORDER BY fqc.${safeSortBy} ${safeSortOrder} LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const [rows] = await db.query(sql, params);

    return res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('[getQrCodes Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Get QR Code by ID ────────────────────────────────────────────
exports.getQrCodeById = async (req, res) => {
  try {
    const { id } = req.params;
    const session = req.user;
    const isGlobalAdmin = checkIsGlobalAdmin(session);
    const userLocationId = session?.locationId;

    let sql = `
      SELECT 
        fqc.*,
        COALESCE(u.full_name, u.username, fqc.createdByName, 'Admin') as creatorName,
        (SELECT COUNT(*) FROM Feedback WHERE qrCodeId = fqc.qrCodeId) as feedbackCount,
        (SELECT COUNT(*) FROM FeedbackQrScan WHERE qrCodeRefId = fqc.qrCodeId) as totalScans,
        (SELECT COUNT(*) FROM FeedbackQrScan WHERE qrCodeRefId = fqc.qrCodeId AND isFeedbackSubmitted = 1) as scansWithFeedback
      FROM FeedbackQrCode fqc
      LEFT JOIN users u ON fqc.createdBy = u.id
      WHERE fqc.deletedAt IS NULL AND fqc.id = ?
    `;
    const params = [id];

    if (!isGlobalAdmin && userLocationId) {
      sql += ' AND fqc.locationId = ?';
      params.push(userLocationId);
    }

    const [rows] = await db.query(sql, params);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, error: 'QR Code not found' });
    }

    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('[getQrCodeById Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Create QR Code ───────────────────────────────────────────────
exports.createQrCode = async (req, res) => {
  try {
    const session = req.user;
    const {
      name,
      description,
      locationId,
      locationCode,
      locationName,
      sectionId,
      sectionName,
      floor,
      feedbackFormId,
      status = 'active'
    } = req.body;

    // Validation
    if (!name || !locationId || !locationCode || !locationName) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name, locationId, locationCode, and locationName are required' 
      });
    }

    // Verify location exists in the locations table
    const parsedLocationId = parseInt(locationId, 10);
    if (isNaN(parsedLocationId) || parsedLocationId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid location ID. Please select a valid store location.' });
    }

    const [locationRows] = await db.query(
      'SELECT id, location_code, location_name FROM locations WHERE id = ? AND (status IS NULL OR status = ?)',
      [parsedLocationId, 'Active']
    );
    if (!locationRows || locationRows.length === 0) {
      return res.status(400).json({ success: false, error: 'Selected location does not exist or is inactive. Please select a valid store location.' });
    }

    const dbLocation = locationRows[0];
    // Use the verified database values for consistency
    const resolvedLocationId = dbLocation.id;
    const resolvedLocationCode = dbLocation.location_code || locationCode;
    const resolvedLocationName = dbLocation.location_name || locationName;

    // Verify location code/name match the selected location
    if (locationCode && locationCode.toUpperCase() !== resolvedLocationCode.toUpperCase()) {
      return res.status(400).json({ success: false, error: 'Location code mismatch. Please re-select the location.' });
    }

    // Verify location exists and user has access
    const isGlobalAdmin = checkIsGlobalAdmin(session);
    const userLocationId = session?.locationId;

    if (!isGlobalAdmin && userLocationId && userLocationId !== resolvedLocationId) {
      return res.status(403).json({ success: false, error: 'Access denied to this location' });
    }

    // Generate sequential QR Code ID
    const qrCodeId = await generateNextQrCodeId();

    // Build target URL (public feedback form with location parameter)
    const baseUrl = process.env.FRONTEND_URL || 'https://bsctextiles.in';
    const targetUrl = `${baseUrl}/feedback-public?location=${resolvedLocationCode}`;

    // Generate QR code images
    const { qrCodeDataUrl, qrCodeSvg } = await generateQrCodeImages(targetUrl);

    const id = getUUID();
    const createdBy = session?.id || 1;
    const createdByName = session?.fullName || session?.full_name || session?.username || 'System';

    await db.query(`
      INSERT INTO FeedbackQrCode (
        id, qrCodeId, name, description, locationId, locationCode, locationName,
        sectionId, sectionName, floor, feedbackFormId, targetUrl, qrCodeDataUrl, qrCodeSvg,
        status, createdBy, createdByName
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, qrCodeId, name, description || '', resolvedLocationId, resolvedLocationCode, resolvedLocationName,
      sectionId || null, sectionName || null, floor || null, feedbackFormId || null, targetUrl,
      qrCodeDataUrl, qrCodeSvg, status, createdBy, createdByName
    ]);

    // Log audit
    await db.query(`
      INSERT INTO audit_logs (username, action, module, details, ip_address)
      VALUES (?, 'CREATE', 'FeedbackQR', ?, ?)
    `, [session?.username || 'system', JSON.stringify({ qrCodeId, name, location: resolvedLocationName }), req.ip || null]);

    return res.json({ 
      success: true, 
      message: `${resolvedLocationName} QR Code created successfully`,
      data: { id, qrCodeId, name, locationId: resolvedLocationId, locationCode: resolvedLocationCode, locationName: resolvedLocationName, targetUrl, qrCodeDataUrl, qrCodeSvg }
    });
  } catch (err) {
    console.error('[createQrCode Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to create QR code. Please try again.' });
  }
};

// ── Update QR Code ───────────────────────────────────────────────
exports.updateQrCode = async (req, res) => {
  try {
    const { id } = req.params;
    const session = req.user;
    const {
      name,
      description,
      locationId,
      locationCode,
      locationName,
      sectionId,
      sectionName,
      floor,
      feedbackFormId,
      status
    } = req.body;

    const isGlobalAdmin = checkIsGlobalAdmin(session);
    const userLocationId = session?.locationId;

    // Check if QR code exists and user has access
    let checkSql = 'SELECT * FROM FeedbackQrCode WHERE id = ? AND deletedAt IS NULL';
    const checkParams = [id];

    if (!isGlobalAdmin && userLocationId) {
      checkSql += ' AND locationId = ?';
      checkParams.push(userLocationId);
    }

    const [existing] = await db.query(checkSql, checkParams);

    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, error: 'QR Code not found' });
    }

    const qrCode = existing[0];

    // Build update query
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (sectionId !== undefined) {
      updates.push('sectionId = ?');
      params.push(sectionId);
    }
    if (sectionName !== undefined) {
      updates.push('sectionName = ?');
      params.push(sectionName);
    }
    if (floor !== undefined) {
      updates.push('floor = ?');
      params.push(floor || null);
    }
    if (feedbackFormId !== undefined) {
      updates.push('feedbackFormId = ?');
      params.push(feedbackFormId);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }

    // Handle location change - validate against locations table
    if (locationId !== undefined) {
      const parsedLocationId = parseInt(locationId, 10);
      if (isNaN(parsedLocationId) || parsedLocationId <= 0) {
        return res.status(400).json({ success: false, error: 'Invalid location ID. Please select a valid store location.' });
      }

      const [locationRows] = await db.query(
        'SELECT id, location_code, location_name FROM locations WHERE id = ? AND (status IS NULL OR status = ?)',
        [parsedLocationId, 'Active']
      );
      if (!locationRows || locationRows.length === 0) {
        return res.status(400).json({ success: false, error: 'Selected location does not exist or is inactive. Please select a valid store location.' });
      }

      const dbLocation = locationRows[0];
      updates.push('locationId = ?');
      params.push(dbLocation.id);
      if (locationCode !== undefined) {
        updates.push('locationCode = ?');
        params.push(dbLocation.location_code || locationCode);
      }
      if (locationName !== undefined) {
        updates.push('locationName = ?');
        params.push(dbLocation.location_name || locationName);
      }

      // Regenerate target URL if location changed
      if (dbLocation.id !== qrCode.locationId) {
        const baseUrl = process.env.FRONTEND_URL || 'https://bsctextiles.in';
        const newTargetUrl = `${baseUrl}/feedback-public?location=${dbLocation.location_code}`;
        updates.push('targetUrl = ?');
        params.push(newTargetUrl);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    updates.push('updatedAt = CURRENT_TIMESTAMP');
    params.push(id);

    await db.query(`
      UPDATE FeedbackQrCode SET ${updates.join(', ')} WHERE id = ?
    `, params);

    // Log audit
    await db.query(`
      INSERT INTO audit_logs (username, action, module, details, ip_address)
      VALUES (?, 'UPDATE', 'FeedbackQR', ?, ?)
    `, [session?.username || 'system', JSON.stringify({ qrCodeId: qrCode.qrCodeId, updates }), req.ip || null]);

    return res.json({ success: true, message: 'QR Code updated successfully' });
  } catch (err) {
    console.error('[updateQrCode Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to update QR code. Please try again.' });
  }
};

// ── Delete QR Code (Soft Delete) ─────────────────────────────────
exports.deleteQrCode = async (req, res) => {
  try {
    const { id } = req.params;
    const session = req.user;

    const isGlobalAdmin = checkIsGlobalAdmin(session);
    const userLocationId = session?.locationId;

    let checkSql = 'SELECT * FROM FeedbackQrCode WHERE id = ? AND deletedAt IS NULL';
    const checkParams = [id];

    if (!isGlobalAdmin && userLocationId) {
      checkSql += ' AND locationId = ?';
      checkParams.push(userLocationId);
    }

    const [existing] = await db.query(checkSql, checkParams);

    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, error: 'QR Code not found' });
    }

    const qrCode = existing[0];

    // Soft delete
    await db.query(`
      UPDATE FeedbackQrCode SET deletedAt = CURRENT_TIMESTAMP, status = 'archived' WHERE id = ?
    `, [id]);

    // Log audit
    await db.query(`
      INSERT INTO audit_logs (username, action, module, details, ip_address)
      VALUES (?, 'DELETE', 'FeedbackQR', ?, ?)
    `, [session?.username || 'system', JSON.stringify({ qrCodeId: qrCode.qrCodeId, name: qrCode.name }), req.ip || null]);

    return res.json({ success: true, message: 'QR Code deleted successfully' });
  } catch (err) {
    console.error('[deleteQrCode Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Toggle QR Code Status ────────────────────────────────────────
exports.toggleQrCodeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const session = req.user;

    const isGlobalAdmin = checkIsGlobalAdmin(session);
    const userLocationId = session?.locationId;

    let checkSql = 'SELECT * FROM FeedbackQrCode WHERE id = ? AND deletedAt IS NULL';
    const checkParams = [id];

    if (!isGlobalAdmin && userLocationId) {
      checkSql += ' AND locationId = ?';
      checkParams.push(userLocationId);
    }

    const [existing] = await db.query(checkSql, checkParams);

    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, error: 'QR Code not found' });
    }

    const qrCode = existing[0];
    const newStatus = qrCode.status === 'active' ? 'inactive' : 'active';

    await db.query(`
      UPDATE FeedbackQrCode SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?
    `, [newStatus, id]);

    // Log audit
    await db.query(`
      INSERT INTO audit_logs (username, action, module, details, ip_address)
      VALUES (?, 'STATUS_TOGGLE', 'FeedbackQR', ?, ?)
    `, [session?.username || 'system', JSON.stringify({ qrCodeId: qrCode.qrCodeId, oldStatus: qrCode.status, newStatus }), req.ip || null]);

    return res.json({ success: true, message: `QR Code ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`, status: newStatus });
  } catch (err) {
    console.error('[toggleQrCodeStatus Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Regenerate QR Code Images ────────────────────────────────────
exports.regenerateQrCode = async (req, res) => {
  try {
    const { id } = req.params;
    const session = req.user;

    const isGlobalAdmin = checkIsGlobalAdmin(session);
    const userLocationId = session?.locationId;

    let checkSql = 'SELECT * FROM FeedbackQrCode WHERE id = ? AND deletedAt IS NULL';
    const checkParams = [id];

    if (!isGlobalAdmin && userLocationId) {
      checkSql += ' AND locationId = ?';
      checkParams.push(userLocationId);
    }

    const [existing] = await db.query(checkSql, checkParams);

    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, error: 'QR Code not found' });
    }

    const qrCode = existing[0];

    // Regenerate QR code images
    const { qrCodeDataUrl, qrCodeSvg } = await generateQrCodeImages(qrCode.targetUrl);

    await db.query(`
      UPDATE FeedbackQrCode SET qrCodeDataUrl = ?, qrCodeSvg = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?
    `, [qrCodeDataUrl, qrCodeSvg, id]);

    // Log audit
    await db.query(`
      INSERT INTO audit_logs (username, action, module, details, ip_address)
      VALUES (?, 'REGENERATE', 'FeedbackQR', ?, ?)
    `, [session?.username || 'system', JSON.stringify({ qrCodeId: qrCode.qrCodeId }), req.ip || null]);

    return res.json({ 
      success: true, 
      message: 'QR Code regenerated successfully',
      data: { qrCodeDataUrl, qrCodeSvg }
    });
  } catch (err) {
    console.error('[regenerateQrCode Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Get QR Code Dashboard Stats ──────────────────────────────────
exports.getQrCodeStats = async (req, res) => {
  try {
    const session = req.user;
    const isGlobalAdmin = checkIsGlobalAdmin(session);
    const userLocationId = session?.locationId;

    // Accept optional filter params from frontend
    const rawLoc = req.query.locationId || req.headers['x-location-id'];
    const { status, floor } = req.query;

    let locationFilter = '';
    const params = [];

    // Location scoping: non-global admins locked to their location
    if (!isGlobalAdmin && userLocationId) {
      locationFilter = ' AND fqc.locationId = ?';
      params.push(userLocationId);
    } else if (rawLoc && rawLoc !== 'ALL' && rawLoc !== 'all') {
      const parsedLocId = parseInt(rawLoc, 10) || (rawLoc.toUpperCase() === 'BEL' ? 1 : rawLoc.toUpperCase() === 'SHI' ? 3 : 2);
      locationFilter = ' AND fqc.locationId = ?';
      params.push(parsedLocId);
    }

    // Status filter
    let statusFilter = '';
    if (status && status !== 'all') {
      statusFilter = ' AND fqc.status = ?';
      params.push(status);
    }

    // Floor filter (if floor column exists in FeedbackQrCode)
    let floorFilter = '';
    if (floor && floor !== 'all') {
      floorFilter = ' AND fqc.floor = ?';
      params.push(floor);
    }

    // Total QR Codes
    const [totalRows] = await db.query(`
      SELECT COUNT(*) as total FROM FeedbackQrCode fqc WHERE fqc.deletedAt IS NULL ${locationFilter} ${statusFilter} ${floorFilter}
    `, params);

    // Active QR Codes
    const [activeRows] = await db.query(`
      SELECT COUNT(*) as total FROM FeedbackQrCode fqc WHERE fqc.deletedAt IS NULL AND fqc.status = 'active' ${locationFilter} ${statusFilter} ${floorFilter}
    `, params);

    // Inactive QR Codes
    const [inactiveRows] = await db.query(`
      SELECT COUNT(*) as total FROM FeedbackQrCode fqc WHERE fqc.deletedAt IS NULL AND fqc.status = 'inactive' ${locationFilter} ${statusFilter} ${floorFilter}
    `, params);

    // Total Scans
    let scanSql = `
      SELECT COUNT(*) as total FROM FeedbackQrScan fqs
      JOIN FeedbackQrCode fqc ON (fqs.qrCodeRefId = fqc.qrCodeId OR fqs.qrCodeId = fqc.qrCodeId)
      WHERE fqc.deletedAt IS NULL ${locationFilter} ${statusFilter} ${floorFilter}
    `;
    const [scanRows] = await db.query(scanSql, params);

    // Total Feedback directly from Feedback table
    let fbLocFilter = '';
    const fbParams = [];
    if (!isGlobalAdmin && userLocationId) {
      fbLocFilter = ' AND f.location_id = ?';
      fbParams.push(userLocationId);
    } else if (rawLoc && rawLoc !== 'ALL' && rawLoc !== 'all') {
      const parsedLocId = parseInt(rawLoc, 10) || (rawLoc.toUpperCase() === 'BEL' ? 1 : rawLoc.toUpperCase() === 'SHI' ? 3 : 2);
      fbLocFilter = ' AND f.location_id = ?';
      fbParams.push(parsedLocId);
    }
    const [feedbackRows] = await db.query(`SELECT COUNT(*) as total FROM Feedback f WHERE 1=1 ${fbLocFilter}`, fbParams);

    // Today's Feedback
    const today = getISTDateString();
    const [todayRows] = await db.query(`
      SELECT COUNT(*) as total FROM Feedback f 
      WHERE 1=1 ${fbLocFilter} AND (f.entryDate = ? OR DATE(f.createdAt) = ? OR DATE(f.created_at) = ?)
    `, [...fbParams, today, today, today]);

    // Average Rating (from feedback answers)
    let ratingSql = `
      SELECT 
        AVG(CASE 
          WHEN JSON_EXTRACT(f.answers, '$.q1') = '"Very satisfied"' THEN 5
          WHEN JSON_EXTRACT(f.answers, '$.q1') = '"Satisfied"' THEN 4
          WHEN JSON_EXTRACT(f.answers, '$.q1') = '"Neutral"' THEN 3
          WHEN JSON_EXTRACT(f.answers, '$.q1') = '"Dissatisfied"' THEN 2
          WHEN JSON_EXTRACT(f.answers, '$.q1') = '"Very dissatisfied"' THEN 1
          ELSE NULL
        END) as avgRating
      FROM Feedback f
      WHERE 1=1 ${fbLocFilter} AND f.answers IS NOT NULL AND f.answers != ''
    `;
    const [ratingRows] = await db.query(ratingSql, fbParams);

    // Scans by day (last 7 days)
    const scansByDay = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const [dayScanRows] = await db.query(`
        SELECT COUNT(*) as total FROM FeedbackQrScan fqs
        JOIN FeedbackQrCode fqc ON (fqs.qrCodeRefId = fqc.qrCodeId OR fqs.qrCodeId = fqc.qrCodeId)
        WHERE fqc.deletedAt IS NULL ${locationFilter} ${statusFilter} ${floorFilter}
        AND DATE(fqs.scannedAt) = ?
      `, [...params, dateStr]);
      
      scansByDay.push({ date: dateStr, scans: dayScanRows[0]?.total || 0 });
    }

    // Feedback by day (last 7 days)
    const feedbackByDay = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const [dayFeedbackRows] = await db.query(`
        SELECT COUNT(*) as total FROM Feedback f
        WHERE 1=1 ${fbLocFilter}
        AND (f.entryDate = ? OR DATE(f.createdAt) = ? OR DATE(f.created_at) = ?)
      `, [...fbParams, dateStr, dateStr, dateStr]);
      
      feedbackByDay.push({ date: dateStr, feedback: dayFeedbackRows[0]?.total || 0 });
    }

    // Location-specific breakdown (Belagavi, Davanagere, Shivamogga)
    const byLocation = {};
    for (const loc of STANDARD_LOCATIONS) {
      const [qCount] = await db.query(`SELECT COUNT(*) as total FROM FeedbackQrCode WHERE deletedAt IS NULL AND locationId = ?`, [loc.id]);
      const [sCount] = await db.query(`
        SELECT COUNT(*) as total FROM FeedbackQrScan fqs 
        JOIN FeedbackQrCode fqc ON (fqs.qrCodeRefId = fqc.qrCodeId OR fqs.qrCodeId = fqc.qrCodeId)
        WHERE fqc.deletedAt IS NULL AND fqc.locationId = ?
      `, [loc.id]);
      const [fCount] = await db.query(`SELECT COUNT(*) as total, SUM(CASE WHEN isNegative = 1 THEN 1 ELSE 0 END) as negCount FROM Feedback WHERE location_id = ? OR locationCode = ?`, [loc.id, loc.locationCode]);
      const [rRow] = await db.query(`
        SELECT AVG(CASE 
          WHEN JSON_EXTRACT(answers, '$.q1') = '"Very satisfied"' THEN 5
          WHEN JSON_EXTRACT(answers, '$.q1') = '"Satisfied"' THEN 4
          WHEN JSON_EXTRACT(answers, '$.q1') = '"Neutral"' THEN 3
          WHEN JSON_EXTRACT(answers, '$.q1') = '"Dissatisfied"' THEN 2
          WHEN JSON_EXTRACT(answers, '$.q1') = '"Very dissatisfied"' THEN 1
          ELSE NULL END) as avgRating
        FROM Feedback WHERE location_id = ? OR locationCode = ?
      `, [loc.id, loc.locationCode]);
      const [recentFb] = await db.query(`
        SELECT id, customerName, mobile, answers, isNegative, entryDate, entryTime, createdAt
        FROM Feedback
        WHERE location_id = ? OR locationCode = ?
        ORDER BY createdAt DESC LIMIT 5
      `, [loc.id, loc.locationCode]);

      const locTotal = fCount[0]?.total || 0;
      const locNeg = Number(fCount[0]?.negCount) || 0;
      const locPos = Math.max(0, locTotal - locNeg);

      byLocation[loc.locationCode.toLowerCase()] = {
        locationId: loc.id,
        locationCode: loc.locationCode,
        locationName: loc.locationName,
        storeName: loc.storeName,
        totalQrCodes: qCount[0]?.total || 0,
        totalScans: sCount[0]?.total || 0,
        totalFeedback: locTotal,
        positiveFeedback: locPos,
        negativeFeedback: locNeg,
        averageRating: rRow[0]?.avgRating ? parseFloat(rRow[0].avgRating).toFixed(1) : '5.0',
        recentFeedback: recentFb || []
      };
    }

    return res.json({
      success: true,
      stats: {
        totalQrCodes: totalRows[0]?.total || 0,
        activeQrCodes: activeRows[0]?.total || 0,
        inactiveQrCodes: inactiveRows[0]?.total || 0,
        totalScans: scanRows[0]?.total || 0,
        totalFeedback: feedbackRows[0]?.total || 0,
        todayFeedback: todayRows[0]?.total || 0,
        averageRating: ratingRows[0]?.avgRating ? parseFloat(ratingRows[0].avgRating).toFixed(1) : '5.0'
      },
      charts: {
        scansByDay,
        feedbackByDay
      },
      byLocation,
      locations: STANDARD_LOCATIONS.map(loc => ({
        locationId: loc.id,
        locationCode: loc.locationCode,
        locationName: loc.locationName,
        storeName: loc.storeName,
        ...(byLocation[loc.locationCode.toLowerCase()] || {})
      }))
    });
  } catch (err) {
    console.error('[getQrCodeStats Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Get QR Code Scan History ─────────────────────────────────────
exports.getQrCodeScans = async (req, res) => {
  try {
    const { qrCodeId } = req.params;
    const { page = 1, limit = 50, date } = req.query;
    const session = req.user;
    const isGlobalAdmin = checkIsGlobalAdmin(session);
    const userLocationId = session?.locationId;

    // Verify QR code access
    let checkSql = 'SELECT * FROM FeedbackQrCode WHERE qrCodeId = ? AND deletedAt IS NULL';
    const checkParams = [qrCodeId];

    if (!isGlobalAdmin && userLocationId) {
      checkSql += ' AND locationId = ?';
      checkParams.push(userLocationId);
    }

    const [existing] = await db.query(checkSql, checkParams);

    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, error: 'QR Code not found' });
    }

    let sql = `
      SELECT * FROM FeedbackQrScan 
      WHERE qrCodeRefId = ?
    `;
    const params = [qrCodeId];

    if (date) {
      sql += ' AND DATE(scannedAt) = ?';
      params.push(date);
    }

    // Get total count
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    const [countResult] = await db.query(countSql, params);
    const total = countResult[0]?.total || 0;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ' ORDER BY scannedAt DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [rows] = await db.query(sql, params);

    return res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('[getQrCodeScans Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Track QR Code Scan (Public Endpoint) ─────────────────────────
exports.trackQrScan = async (req, res) => {
  try {
    const { qrCodeId } = req.params;
    const { source } = req.body; // Optional: track where scan came from

    // Verify QR code exists and is active
    const [qrRows] = await db.query(`
      SELECT * FROM FeedbackQrCode WHERE qrCodeId = ? AND deletedAt IS NULL AND status = 'active'
    `, [qrCodeId]);

    if (!qrRows || qrRows.length === 0) {
      return res.status(404).json({ success: false, error: 'QR Code not found or inactive' });
    }

    const qrCode = qrRows[0];

    // Track scan
    const scanId = getUUID();
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || null;
    const userAgent = req.headers['user-agent'] || null;
    const { deviceType, browser, os } = parseUserAgent(userAgent);
    const referrer = req.headers.referer || req.headers.referrer || null;

    await db.query(`
      INSERT INTO FeedbackQrScan (
        id, qrCodeId, qrCodeRefId, ipAddress, userAgent, deviceType, browser, os, referrer
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [scanId, qrCodeId, qrCodeId, ipAddress, userAgent, deviceType, browser, os, referrer]);

    // Increment scan count
    await db.query(`
      UPDATE FeedbackQrCode SET scanCount = scanCount + 1, lastScannedAt = CURRENT_TIMESTAMP WHERE qrCodeId = ?
    `, [qrCodeId]);

    return res.json({ 
      success: true, 
      message: 'Scan tracked',
      data: { targetUrl: qrCode.targetUrl, qrCodeId: qrCode.qrCodeId }
    });
  } catch (err) {
    console.error('[trackQrScan Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Get Feedback Forms ───────────────────────────────────────────
exports.getFeedbackForms = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT * FROM FeedbackForm WHERE status = 'active' AND deletedAt IS NULL ORDER BY isDefault DESC, createdAt DESC
    `);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[getFeedbackForms Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Get Locations for QR Code Creation ───────────────────────────
exports.getLocationsForQr = async (req, res) => {
  try {
    const session = req.user;
    const isGlobalAdmin = !session?.locationId || session?.isGlobalAdmin || ['Admin', 'Super Admin', 'system administrator'].includes(session?.role);
    const userLocationId = session?.locationId;

    let rows = [];
    try {
      const [dbRows] = await db.query(`
        SELECT id, 
               COALESCE(location_code, 'LOC') as locationCode, 
               location_name as locationName,
               COALESCE(store_name, CONCAT('BSC Textiles ', location_name)) as storeName,
               status, sort_order
        FROM locations
        WHERE status IS NULL OR status = 'Active' OR status = 'active' OR status = 1
        ORDER BY COALESCE(sort_order, 99) ASC, location_name ASC
      `);
      rows = dbRows;
    } catch (dbErr) {
      console.warn('[getLocationsForQr] DB query warning:', dbErr.message);
    }

    // Default BSC Store Locations fallback so selection is always functional
    const masterDefaults = [
      { id: 1, locationCode: 'BEL', locationName: 'Belagavi', storeName: 'BSC Textiles Belagavi' },
      { id: 2, locationCode: 'DAV', locationName: 'Davanagere', storeName: 'BSC Textiles Davanagere' },
      { id: 3, locationCode: 'SHI', locationName: 'Shivamogga', storeName: 'BSC Textiles Shivamogga' }
    ];

    let combined = Array.isArray(rows) && rows.length > 0 ? rows : masterDefaults;

    if (!isGlobalAdmin && userLocationId) {
      const filtered = combined.filter(r => String(r.id) === String(userLocationId));
      if (filtered.length > 0) combined = filtered;
    }

    return res.json({ success: true, data: combined, locations: combined });
  } catch (err) {
    console.error('[getLocationsForQr Error]', err);
    const fallback = [
      { id: 1, locationCode: 'BEL', locationName: 'Belagavi', storeName: 'BSC Textiles Belagavi' },
      { id: 2, locationCode: 'DAV', locationName: 'Davanagere', storeName: 'BSC Textiles Davanagere' },
      { id: 3, locationCode: 'SHI', locationName: 'Shivamogga', storeName: 'BSC Textiles Shivamogga' }
    ];
    return res.json({ success: true, data: fallback, locations: fallback });
  }
};

// ── Get Sections for Location ────────────────────────────────────
exports.getSectionsForLocation = async (req, res) => {
  try {
    const { locationId } = req.query;
    let rows = [];
    try {
      const [secRows] = await db.query('SELECT id, name FROM Sections WHERE isActive = TRUE ORDER BY name ASC');
      rows = secRows;
    } catch (e) {
      try {
        const [deptRows] = await db.query('SELECT id, name FROM department_sections ORDER BY name ASC');
        rows = deptRows;
      } catch (e2) {
        rows = [];
      }
    }

    if (!rows || rows.length === 0) {
      rows = [
        { id: 'silk', name: 'Pure Silk Sarees' },
        { id: 'bridal', name: 'Bridal & Lehengas' },
        { id: 'menswear', name: 'Menswear & Sherwani' },
        { id: 'fancy', name: 'Fancy Sarees' },
        { id: 'kids', name: 'Kids Wear' },
        { id: 'matching', name: 'Family Matching' }
      ];
    }

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[getSectionsForLocation Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// Location constants for the 3 standard locations
const STANDARD_LOCATIONS = [
  { id: 1, locationCode: 'BEL', locationName: 'Belagavi', storeName: 'BSC Textiles Belagavi' },
  { id: 2, locationCode: 'DAV', locationName: 'Davanagere', storeName: 'BSC Textiles Davanagere' },
  { id: 3, locationCode: 'SHI', locationName: 'Shivamogga', storeName: 'BSC Textiles Shivamogga' }
];

// Validate location code
function isValidLocationCode(code) {
  return ['BEL', 'DAV', 'SHI'].includes(code?.toUpperCase());
}

function getLocationByCode(code) {
  const upperCode = code?.toUpperCase();
  return STANDARD_LOCATIONS.find(loc => loc.locationCode === upperCode);
}

function getLocationById(id) {
  return STANDARD_LOCATIONS.find(loc => loc.id === parseInt(id));
}

// ── Generate Location-Based QR Codes (One per Location) ────────────
exports.generateLocationQrCodes = async (req, res) => {
  try {
    const session = req.user;
    const isGlobalAdmin = checkIsGlobalAdmin(session);
    const userLocationId = session?.locationId;
    const reqLoc = req.query?.locationId || req.query?.locationCode || req.headers?.['x-location-id'];

    // Determine which locations to generate QR codes for
    let targetLocations = STANDARD_LOCATIONS;
    if (reqLoc && reqLoc !== 'ALL' && reqLoc !== 'all') {
      const parsedId = parseInt(reqLoc, 10);
      const upperCode = String(reqLoc).trim().toUpperCase();
      const filtered = STANDARD_LOCATIONS.filter(loc => loc.id === parsedId || loc.locationCode === upperCode);
      if (filtered.length > 0) targetLocations = filtered;
    } else if (!isGlobalAdmin && userLocationId) {
      targetLocations = STANDARD_LOCATIONS.filter(loc => loc.id === userLocationId);
    }

    const baseUrl = process.env.FRONTEND_URL || 'https://bsctextiles.in';
    const createdBy = session?.id || 1;
    const createdByName = session?.fullName || session?.full_name || session?.username || 'System';
    const results = [];

    for (const location of targetLocations) {
      const targetUrl = `${baseUrl}/feedback-public?location=${location.locationCode}`;
      const { qrCodeDataUrl, qrCodeSvg } = await generateQrCodeImages(targetUrl);

      // Check if QR code already exists for this location with location= url
      const [existing] = await db.query(`
        SELECT * FROM FeedbackQrCode 
        WHERE locationId = ? AND deletedAt IS NULL
        ORDER BY CASE WHEN targetUrl LIKE '%location=%' THEN 0 ELSE 1 END, createdAt DESC LIMIT 1
      `, [location.id]);

      let qrCode;
      if (existing && existing.length > 0) {
        qrCode = existing[0];
        await db.query(`
          UPDATE FeedbackQrCode 
          SET name = ?, description = ?, locationId = ?, locationCode = ?, locationName = ?,
              targetUrl = ?, qrCodeDataUrl = ?, qrCodeSvg = ?, status = 'active', updatedAt = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [
          `${location.locationName} Feedback`,
          `Official Customer Feedback QR for ${location.storeName}`,
          location.id,
          location.locationCode,
          location.locationName,
          targetUrl,
          qrCodeDataUrl,
          qrCodeSvg,
          qrCode.id
        ]);
        qrCode = { ...qrCode, targetUrl, qrCodeDataUrl, qrCodeSvg, locationCode: location.locationCode, locationName: location.locationName, status: 'active' };
      } else {
        // Create new distinct QR code for this location
        const qrCodeId = `QR-${location.locationCode}`;
        const id = getUUID();

        await db.query(`
          INSERT INTO FeedbackQrCode (
            id, qrCodeId, name, description, locationId, locationCode, locationName,
            sectionId, sectionName, floor, feedbackFormId, targetUrl, qrCodeDataUrl, qrCodeSvg,
            status, scanCount, createdBy, createdByName
          ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'Ground Floor', NULL, ?, ?, ?, 'active', 0, ?, ?)
        `, [
          id, qrCodeId, `${location.locationName} Feedback`, `Official Customer Feedback QR for ${location.storeName}`,
          location.id, location.locationCode, location.locationName,
          targetUrl, qrCodeDataUrl, qrCodeSvg,
          createdBy, createdByName
        ]);

        qrCode = { id, qrCodeId, name: `${location.locationName} Feedback`, locationId: location.id, locationCode: location.locationCode, locationName: location.locationName, targetUrl, qrCodeDataUrl, qrCodeSvg, status: 'active' };

        // Log audit
        await db.query(`
          INSERT INTO audit_logs (username, action, module, details, ip_address)
          VALUES (?, 'CREATE', 'FeedbackQR', ?, ?)
        `, [session?.username || 'system', JSON.stringify({ qrCodeId, name: qrCode.name, location: location.locationName }), req.ip || null]);
      }

      // Query real live stats for this location
      const [scanCount] = await db.query(`
        SELECT COUNT(*) as total FROM FeedbackQrScan fqs
        JOIN FeedbackQrCode fqc ON (fqs.qrCodeRefId = fqc.qrCodeId OR fqs.qrCodeId = fqc.qrCodeId)
        WHERE fqc.locationId = ?
      `, [location.id]);
      const [feedbackCount] = await db.query(`
        SELECT COUNT(*) as total FROM Feedback WHERE location_id = ? OR locationCode = ?
      `, [location.id, location.locationCode]);
      const [scansWithFeedback] = await db.query(`
        SELECT COUNT(*) as total FROM FeedbackQrScan fqs
        JOIN FeedbackQrCode fqc ON (fqs.qrCodeRefId = fqc.qrCodeId OR fqs.qrCodeId = fqc.qrCodeId)
        WHERE fqc.locationId = ? AND fqs.isFeedbackSubmitted = 1
      `, [location.id]);

      results.push({
        locationId: location.id,
        locationCode: location.locationCode,
        locationName: location.locationName,
        storeName: location.storeName,
        qrCodeId: qrCode.qrCodeId,
        name: qrCode.name,
        targetUrl: targetUrl,
        qrCodeDataUrl: qrCodeDataUrl,
        qrCodeSvg: qrCodeSvg,
        status: qrCode.status,
        scanCount: parseInt(scanCount[0]?.total || 0, 10),
        feedbackCount: parseInt(feedbackCount[0]?.total || 0, 10),
        scansWithFeedback: parseInt(scansWithFeedback[0]?.total || 0, 10),
        lastScannedAt: qrCode.lastScannedAt || null
      });
    }

    return res.json({ 
      success: true, 
      message: 'Location-based QR codes generated successfully for all stores',
      data: results
    });
  } catch (err) {
    console.error('[generateLocationQrCodes Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Get Location QR Codes (for Display) ───────────────────────────
exports.getLocationQrCodes = async (req, res) => {
  try {
    const session = req.user;
    const isGlobalAdmin = checkIsGlobalAdmin(session);
    const userLocationId = session?.locationId;

    // Requested location from query param or header
    const reqLoc = req.query?.locationId || req.query?.locationCode || req.headers?.['x-location-id'];
    let targetLocations = STANDARD_LOCATIONS;

    if (reqLoc && reqLoc !== 'ALL' && reqLoc !== 'all') {
      const parsedId = parseInt(reqLoc, 10);
      const upperCode = String(reqLoc).trim().toUpperCase();
      const filtered = STANDARD_LOCATIONS.filter(loc => loc.id === parsedId || loc.locationCode === upperCode);
      if (filtered.length > 0) targetLocations = filtered;
    } else if (!isGlobalAdmin && userLocationId) {
      targetLocations = STANDARD_LOCATIONS.filter(loc => loc.id === userLocationId);
    }

    const baseUrl = process.env.FRONTEND_URL || 'https://bsctextiles.in';
    const results = [];

    for (const location of targetLocations) {
      const targetUrl = `${baseUrl}/feedback-public?location=${location.locationCode}`;

      // Get existing QR code for this location
      let [existing] = await db.query(`
        SELECT * FROM FeedbackQrCode 
        WHERE locationId = ? AND deletedAt IS NULL
        ORDER BY CASE WHEN targetUrl LIKE '%location=%' THEN 0 ELSE 1 END, createdAt DESC LIMIT 1
      `, [location.id]);

      let qrCode = null;

      if (existing && existing.length > 0) {
        qrCode = existing[0];
        let qrCodeDataUrl = qrCode.qrCodeDataUrl;
        let qrCodeSvg = qrCode.qrCodeSvg;
        let currentTargetUrl = qrCode.targetUrl;
        let needsUpdate = false;

        // Ensure targetUrl contains location=
        if (!currentTargetUrl || !currentTargetUrl.includes(`location=${location.locationCode}`)) {
          currentTargetUrl = targetUrl;
          needsUpdate = true;
        }

        // Ensure QR images exist
        if (!qrCodeDataUrl || !qrCodeSvg || needsUpdate) {
          const images = await generateQrCodeImages(currentTargetUrl);
          qrCodeDataUrl = images.qrCodeDataUrl;
          qrCodeSvg = images.qrCodeSvg;
          needsUpdate = true;
        }

        if (needsUpdate) {
          await db.query(`
            UPDATE FeedbackQrCode 
            SET qrCodeDataUrl = ?, qrCodeSvg = ?, targetUrl = ?, locationCode = ?, locationName = ?, updatedAt = CURRENT_TIMESTAMP 
            WHERE id = ?
          `, [qrCodeDataUrl, qrCodeSvg, currentTargetUrl, location.locationCode, location.locationName, qrCode.id]);
        }

        qrCode.targetUrl = currentTargetUrl;
        qrCode.qrCodeDataUrl = qrCodeDataUrl;
        qrCode.qrCodeSvg = qrCodeSvg;
        qrCode.locationCode = location.locationCode;
        qrCode.locationName = location.locationName;
      } else {
        // Auto-provision on-demand so it's never empty
        const qrCodeId = `QR-${location.locationCode}`;
        const { qrCodeDataUrl, qrCodeSvg } = await generateQrCodeImages(targetUrl);
        const id = getUUID();

        await db.query(`
          INSERT INTO FeedbackQrCode (
            id, qrCodeId, name, description, locationId, locationCode, locationName,
            sectionId, sectionName, floor, feedbackFormId, targetUrl, qrCodeDataUrl, qrCodeSvg,
            status, scanCount, createdBy, createdByName
          ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'Ground Floor', NULL, ?, ?, ?, 'active', 0, 1, 'System')
        `, [
          id, qrCodeId, `${location.locationName} Feedback`, `Official Customer Feedback QR for ${location.storeName}`,
          location.id, location.locationCode, location.locationName,
          targetUrl, qrCodeDataUrl, qrCodeSvg
        ]);

        qrCode = {
          id,
          qrCodeId,
          name: `${location.locationName} Feedback`,
          locationId: location.id,
          locationCode: location.locationCode,
          locationName: location.locationName,
          targetUrl,
          qrCodeDataUrl,
          qrCodeSvg,
          status: 'active',
          lastScannedAt: null
        };
      }

      // Get scan and feedback counts strictly from database
      const [scanCount] = await db.query(`
        SELECT COUNT(*) as total FROM FeedbackQrScan fqs
        JOIN FeedbackQrCode fqc ON (fqs.qrCodeRefId = fqc.qrCodeId OR fqs.qrCodeId = fqc.qrCodeId)
        WHERE fqc.locationId = ?
      `, [location.id]);
      const [feedbackCount] = await db.query(`
        SELECT COUNT(*) as total FROM Feedback WHERE location_id = ? OR locationCode = ?
      `, [location.id, location.locationCode]);
      const [scansWithFeedback] = await db.query(`
        SELECT COUNT(*) as total FROM FeedbackQrScan fqs
        JOIN FeedbackQrCode fqc ON (fqs.qrCodeRefId = fqc.qrCodeId OR fqs.qrCodeId = fqc.qrCodeId)
        WHERE fqc.locationId = ? AND fqs.isFeedbackSubmitted = 1
      `, [location.id]);

      results.push({
        locationId: location.id,
        locationCode: location.locationCode,
        locationName: location.locationName,
        storeName: location.storeName,
        qrCodeId: qrCode.qrCodeId,
        name: qrCode.name || `${location.locationName} Feedback`,
        targetUrl: qrCode.targetUrl,
        qrCodeDataUrl: qrCode.qrCodeDataUrl,
        qrCodeSvg: qrCode.qrCodeSvg,
        status: qrCode.status || 'active',
        scanCount: parseInt(scanCount[0]?.total || 0, 10),
        feedbackCount: parseInt(feedbackCount[0]?.total || 0, 10),
        scansWithFeedback: parseInt(scansWithFeedback[0]?.total || 0, 10),
        lastScannedAt: qrCode.lastScannedAt || null
      });
    }

    return res.json({ 
      success: true, 
      data: results
    });
  } catch (err) {
    console.error('[getLocationQrCodes Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Track QR Code Scan (Public Endpoint) - Location & QR Code Based ─
exports.trackQrScan = async (req, res) => {
  try {
    const rawTarget = req.params.locationCode || req.params.qrCodeId || req.body.locationCode || req.body.qrCodeId;
    const { source } = req.body;

    if (!rawTarget) {
      return res.status(400).json({ success: false, error: 'Location code or QR Code ID is required' });
    }

    let location = null;
    const upperTarget = String(rawTarget).trim().toUpperCase();

    if (isValidLocationCode(upperTarget)) {
      location = getLocationByCode(upperTarget);
    } else {
      // Look up QR code by qrCodeId
      const [qrRows] = await db.query(`
        SELECT * FROM FeedbackQrCode WHERE qrCodeId = ? AND deletedAt IS NULL LIMIT 1
      `, [rawTarget]);
      if (qrRows && qrRows.length > 0) {
        location = getLocationById(qrRows[0].locationId) || getLocationByCode(qrRows[0].locationCode);
      }
    }

    if (!location) {
      console.warn(`[trackQrScan] Invalid location or QR code identifier: ${rawTarget}`);
      return res.status(404).json({ success: false, error: `Store location not found for "${rawTarget}". Allowed: Belagavi (BEL), Davanagere (DAV), Shivamogga (SHI)` });
    }

    // Find active QR code for this location
    let [qrRows] = await db.query(`
      SELECT * FROM FeedbackQrCode WHERE locationId = ? AND deletedAt IS NULL AND status = 'active'
      ORDER BY CASE WHEN targetUrl LIKE '%location=%' THEN 0 ELSE 1 END, createdAt DESC LIMIT 1
    `, [location.id]);

    let qrCode;
    const baseUrl = process.env.FRONTEND_URL || 'https://bsctextiles.in';
    const targetUrl = `${baseUrl}/feedback-public?location=${location.locationCode}`;

    if (!qrRows || qrRows.length === 0) {
      const qrCodeId = `QR-${location.locationCode}`;
      const { qrCodeDataUrl, qrCodeSvg } = await generateQrCodeImages(targetUrl);
      const id = getUUID();
      await db.query(`
        INSERT INTO FeedbackQrCode (
          id, qrCodeId, name, description, locationId, locationCode, locationName,
          sectionId, sectionName, floor, feedbackFormId, targetUrl, qrCodeDataUrl, qrCodeSvg,
          status, createdBy, createdByName
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'Ground Floor', NULL, ?, ?, ?, 'active', 1, 'System')
      `, [
        id, qrCodeId, `${location.locationName} Feedback`, `Official QR Code for ${location.storeName}`,
        location.id, location.locationCode, location.locationName, targetUrl, qrCodeDataUrl, qrCodeSvg
      ]);
      qrCode = { id, qrCodeId, targetUrl, locationId: location.id, locationCode: location.locationCode };
    } else {
      qrCode = qrRows[0];
    }

    // Track scan with location info
    const scanId = getUUID();
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || null;
    const userAgent = req.headers['user-agent'] || null;
    const { deviceType, browser, os } = parseUserAgent(userAgent);
    const referrer = req.headers.referer || req.headers.referrer || null;

    await db.query(`
      INSERT INTO FeedbackQrScan (
        id, qrCodeId, qrCodeRefId, ipAddress, userAgent, deviceType, browser, os, referrer
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [scanId, qrCode.qrCodeId, qrCode.qrCodeId, ipAddress, userAgent, deviceType, browser, os, referrer]);

    // Increment scan count
    await db.query(`
      UPDATE FeedbackQrCode SET scanCount = scanCount + 1, lastScannedAt = CURRENT_TIMESTAMP WHERE qrCodeId = ?
    `, [qrCode.qrCodeId]);

    return res.json({ 
      success: true, 
      message: `${location.locationName} scan tracked successfully`,
      data: {
        scanId,
        targetUrl: qrCode.targetUrl || targetUrl,
        qrCodeId: qrCode.qrCodeId,
        locationCode: location.locationCode,
        locationName: location.locationName
      }
    });
  } catch (err) {
    console.error('[trackQrScan Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Export QR Codes ──────────────────────────────────────────────
exports.exportQrCodes = async (req, res) => {
  try {
    const { format = 'csv', status, locationId } = req.query;
    const session = req.user;
    const isGlobalAdmin = checkIsGlobalAdmin(session);
    const userLocationId = session?.locationId;

    let sql = `
      SELECT 
        fqc.qrCodeId,
        fqc.name,
        fqc.description,
        fqc.locationName,
        fqc.sectionName,
        fqc.floor,
        fqc.status,
        fqc.scanCount,
        fqc.feedbackCount,
        fqc.lastScannedAt,
        fqc.createdAt,
        COALESCE(u.full_name, u.username, fqc.createdByName, 'Admin') as createdByName
      FROM FeedbackQrCode fqc
      LEFT JOIN users u ON fqc.createdBy = u.id
      WHERE fqc.deletedAt IS NULL
    `;
    const params = [];

    if (!isGlobalAdmin && userLocationId) {
      sql += ' AND fqc.locationId = ?';
      params.push(userLocationId);
    } else if (locationId) {
      sql += ' AND fqc.locationId = ?';
      params.push(locationId);
    }

    if (status) {
      sql += ' AND fqc.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY fqc.createdAt DESC';

    const [rows] = await db.query(sql, params);

    if (format === 'csv') {
      const headers = ['QR Code ID', 'Name', 'Description', 'Location', 'Section', 'Floor', 'Status', 'Scan Count', 'Feedback Count', 'Last Scanned', 'Created At', 'Created By'];
      const csvRows = rows.map(r => [
        r.qrCodeId,
        `"${(r.name || '').replace(/"/g, '""')}"`,
        `"${(r.description || '').replace(/"/g, '""')}"`,
        r.locationName || '',
        r.sectionName || '',
        r.floor || '',
        r.status,
        r.scanCount || 0,
        r.feedbackCount || 0,
        r.lastScannedAt || '',
        r.createdAt || '',
        r.createdByName || ''
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...csvRows.map(e => e.join(','))].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="feedback_qr_codes_${new Date().toISOString().split('T')[0]}.csv"`);
      return res.send(csvContent);
    }

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[exportQrCodes Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
