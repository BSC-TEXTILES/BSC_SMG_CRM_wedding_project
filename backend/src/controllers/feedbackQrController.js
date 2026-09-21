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

// ── Get All QR Codes (Admin Dashboard) ───────────────────────────
exports.getQrCodes = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search = '', 
      status = '', 
      locationId = '',
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    const session = req.user;
    const isGlobalAdmin = session && (session.role === 'Super Admin' || session.isGlobalAdmin);
    const userLocationId = session?.locationId;

    let sql = `
      SELECT 
        fqc.*,
        u.fullName as creatorName,
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

    if (search) {
      sql += ' AND (fqc.name LIKE ? OR fqc.qrCodeId LIKE ? OR fqc.description LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    if (status) {
      sql += ' AND fqc.status = ?';
      params.push(status);
    }

    // Validate sort parameters
    const allowedSortFields = ['createdAt', 'updatedAt', 'name', 'qrCodeId', 'scanCount', 'status'];
    const allowedSortOrders = ['ASC', 'DESC'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const safeSortOrder = allowedSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

    // Get total count
    const countSql = sql.replace('SELECT fqc.*, u.fullName as creatorName, (SELECT COUNT(*) FROM Feedback WHERE qrCodeId = fqc.qrCodeId) as feedbackCount', 'SELECT COUNT(*) as total');
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
    const isGlobalAdmin = session && (session.role === 'Super Admin' || session.isGlobalAdmin);
    const userLocationId = session?.locationId;

    let sql = `
      SELECT 
        fqc.*,
        u.fullName as creatorName,
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

    // Verify location exists and user has access
    const isGlobalAdmin = session && (session.role === 'Super Admin' || session.isGlobalAdmin);
    const userLocationId = session?.locationId;

    if (!isGlobalAdmin && userLocationId && userLocationId !== parseInt(locationId)) {
      return res.status(403).json({ success: false, error: 'Access denied to this location' });
    }

    // Generate sequential QR Code ID
    const qrCodeId = await generateNextQrCodeId();

    // Build target URL (public feedback form with QR code parameter)
    const baseUrl = process.env.FRONTEND_URL || 'https://your-domain.com';
    const targetUrl = `${baseUrl}/feedback-public?qr=${qrCodeId}`;

    // Generate QR code images
    const { qrCodeDataUrl, qrCodeSvg } = await generateQrCodeImages(targetUrl);

    const id = getUUID();
    const createdBy = session?.id || 1;
    const createdByName = session?.fullName || 'System';

    await db.query(`
      INSERT INTO FeedbackQrCode (
        id, qrCodeId, name, description, locationId, locationCode, locationName,
        sectionId, sectionName, feedbackFormId, targetUrl, qrCodeDataUrl, qrCodeSvg,
        status, createdBy, createdByName
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, qrCodeId, name, description || '', locationId, locationCode, locationName,
      sectionId || null, sectionName || null, feedbackFormId || null, targetUrl,
      qrCodeDataUrl, qrCodeSvg, status, createdBy, createdByName
    ]);

    // Log audit
    await db.query(`
      INSERT INTO audit_logs (username, action, module, details, ip_address)
      VALUES (?, 'CREATE', 'FeedbackQR', ?, ?)
    `, [session?.username || 'system', JSON.stringify({ qrCodeId, name }), req.ip || null]);

    return res.json({ 
      success: true, 
      message: 'QR Code created successfully',
      data: { id, qrCodeId, name, targetUrl, qrCodeDataUrl, qrCodeSvg }
    });
  } catch (err) {
    console.error('[createQrCode Error]', err);
    return res.status(500).json({ success: false, error: err.message });
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
      sectionId,
      sectionName,
      feedbackFormId,
      status
    } = req.body;

    const isGlobalAdmin = session && (session.role === 'Super Admin' || session.isGlobalAdmin);
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
    if (feedbackFormId !== undefined) {
      updates.push('feedbackFormId = ?');
      params.push(feedbackFormId);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    updates.push('updatedAt = CURRENT_TIMESTAMP');
    params.push(id);

    await db.query(`
      UPDATE FeedbackQrCode SET ${updates.join(', ')} WHERE id = ?
    `, params);

    // If status changed to active/inactive, we might want to regenerate QR code
    // But targetUrl stays the same since qrCodeId doesn't change

    // Log audit
    await db.query(`
      INSERT INTO audit_logs (username, action, module, details, ip_address)
      VALUES (?, 'UPDATE', 'FeedbackQR', ?, ?)
    `, [session?.username || 'system', JSON.stringify({ qrCodeId: qrCode.qrCodeId, updates }), req.ip || null]);

    return res.json({ success: true, message: 'QR Code updated successfully' });
  } catch (err) {
    console.error('[updateQrCode Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Delete QR Code (Soft Delete) ─────────────────────────────────
exports.deleteQrCode = async (req, res) => {
  try {
    const { id } = req.params;
    const session = req.user;

    const isGlobalAdmin = session && (session.role === 'Super Admin' || session.isGlobalAdmin);
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

    const isGlobalAdmin = session && (session.role === 'Super Admin' || session.isGlobalAdmin);
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

    const isGlobalAdmin = session && (session.role === 'Super Admin' || session.isGlobalAdmin);
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
    const isGlobalAdmin = session && (session.role === 'Super Admin' || session.isGlobalAdmin);
    const userLocationId = session?.locationId;

    // Accept optional filter params from the frontend
    const { status, locationId } = req.query;

    let locationFilter = '';
    const params = [];

    // Location scoping: non-global admins always locked to their location
    if (!isGlobalAdmin && userLocationId) {
      locationFilter = ' AND locationId = ?';
      params.push(userLocationId);
    } else if (locationId) {
      // Global admin can filter by a specific location
      locationFilter = ' AND locationId = ?';
      params.push(locationId);
    }

    // Status filter
    let statusFilter = '';
    if (status && status !== 'all') {
      statusFilter = ' AND status = ?';
      params.push(status);
    }

    // Total QR Codes
    const [totalRows] = await db.query(`
      SELECT COUNT(*) as total FROM FeedbackQrCode WHERE deletedAt IS NULL ${locationFilter} ${statusFilter}
    `, params);

    // Active QR Codes
    const [activeRows] = await db.query(`
      SELECT COUNT(*) as total FROM FeedbackQrCode WHERE deletedAt IS NULL AND status = 'active' ${locationFilter} ${statusFilter}
    `, params);

    // Inactive QR Codes
    const [inactiveRows] = await db.query(`
      SELECT COUNT(*) as total FROM FeedbackQrCode WHERE deletedAt IS NULL AND status = 'inactive' ${locationFilter} ${statusFilter}
    `, params);

    // Total Scans
    let scanSql = `
      SELECT COUNT(*) as total FROM FeedbackQrScan fqs
      JOIN FeedbackQrCode fqc ON fqs.qrCodeRefId = fqc.qrCodeId
      WHERE fqc.deletedAt IS NULL ${locationFilter} ${statusFilter}
    `;
    const [scanRows] = await db.query(scanSql, params);

    // Total Feedback from QR
    let feedbackSql = `
      SELECT COUNT(*) as total FROM Feedback f
      JOIN FeedbackQrCode fqc ON f.qrCodeId = fqc.qrCodeId
      WHERE fqc.deletedAt IS NULL ${locationFilter} ${statusFilter}
    `;
    const [feedbackRows] = await db.query(feedbackSql, params);

    // Today's Feedback
    const today = getISTDateString();
    let todaySql = `
      SELECT COUNT(*) as total FROM Feedback f
      JOIN FeedbackQrCode fqc ON f.qrCodeId = fqc.qrCodeId
      WHERE fqc.deletedAt IS NULL ${locationFilter} ${statusFilter}
      AND f.entryDate = ?
    `;
    const todayParams = [...params, today];
    const [todayRows] = await db.query(todaySql, todayParams);

    // Average Rating (from feedback answers)
    let ratingSql = `
      SELECT 
        AVG(CASE 
          WHEN JSON_EXTRACT(answers, '$.q1') = '"Very satisfied"' THEN 5
          WHEN JSON_EXTRACT(answers, '$.q1') = '"Satisfied"' THEN 4
          WHEN JSON_EXTRACT(answers, '$.q1') = '"Neutral"' THEN 3
          WHEN JSON_EXTRACT(answers, '$.q1') = '"Dissatisfied"' THEN 2
          WHEN JSON_EXTRACT(answers, '$.q1') = '"Very dissatisfied"' THEN 1
          ELSE NULL
        END) as avgRating
      FROM Feedback f
      JOIN FeedbackQrCode fqc ON f.qrCodeId = fqc.qrCodeId
      WHERE fqc.deletedAt IS NULL ${locationFilter} ${statusFilter}
      AND f.answers IS NOT NULL AND f.answers != ''
    `;
    const [ratingRows] = await db.query(ratingSql, params);

    // Scans by day (last 7 days)
    const scansByDay = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const [dayScanRows] = await db.query(`
        SELECT COUNT(*) as total FROM FeedbackQrScan fqs
        JOIN FeedbackQrCode fqc ON fqs.qrCodeRefId = fqc.qrCodeId
        WHERE fqc.deletedAt IS NULL ${locationFilter} ${statusFilter}
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
        JOIN FeedbackQrCode fqc ON f.qrCodeId = fqc.qrCodeId
        WHERE fqc.deletedAt IS NULL ${locationFilter} ${statusFilter}
        AND f.entryDate = ?
      `, [...params, dateStr]);
      
      feedbackByDay.push({ date: dateStr, feedback: dayFeedbackRows[0]?.total || 0 });
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
        averageRating: ratingRows[0]?.avgRating ? parseFloat(ratingRows[0].avgRating).toFixed(1) : '0.0'
      },
      charts: {
        scansByDay,
        feedbackByDay
      }
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
    const isGlobalAdmin = session && (session.role === 'Super Admin' || session.isGlobalAdmin);
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
    const isGlobalAdmin = session && (session.role === 'Super Admin' || session.isGlobalAdmin);
    const userLocationId = session?.locationId;

    let sql = 'SELECT id, location_code as locationCode, location_name as locationName FROM locations WHERE status = \'Active\'';
    const params = [];

    if (!isGlobalAdmin && userLocationId) {
      sql += ' AND id = ?';
      params.push(userLocationId);
    }

    sql += ' ORDER BY sort_order ASC';

    const [rows] = await db.query(sql, params);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[getLocationsForQr Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Get Sections for Location ────────────────────────────────────
exports.getSectionsForLocation = async (req, res) => {
  try {
    const { locationId } = req.query;
    const session = req.user;
    const isGlobalAdmin = session && (session.role === 'Super Admin' || session.isGlobalAdmin);
    const userLocationId = session?.locationId;

    let sql = 'SELECT id, name FROM Sections WHERE isActive = TRUE';
    const params = [];

    const effectiveLocationId = isGlobalAdmin ? (locationId || userLocationId) : userLocationId;
    if (effectiveLocationId) {
      // Sections are not location-specific in current schema, but we can filter by manager or type if needed
    }

    sql += ' ORDER BY name ASC';

    const [rows] = await db.query(sql, params);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[getSectionsForLocation Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Export QR Codes ──────────────────────────────────────────────
exports.exportQrCodes = async (req, res) => {
  try {
    const { format = 'csv', status, locationId } = req.query;
    const session = req.user;
    const isGlobalAdmin = session && (session.role === 'Super Admin' || session.isGlobalAdmin);
    const userLocationId = session?.locationId;

    let sql = `
      SELECT 
        fqc.qrCodeId,
        fqc.name,
        fqc.description,
        fqc.locationName,
        fqc.sectionName,
        fqc.status,
        fqc.scanCount,
        fqc.feedbackCount,
        fqc.lastScannedAt,
        fqc.createdAt,
        u.fullName as createdByName
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
      const headers = ['QR Code ID', 'Name', 'Description', 'Location', 'Section', 'Status', 'Scan Count', 'Feedback Count', 'Last Scanned', 'Created At', 'Created By'];
      const csvRows = rows.map(r => [
        r.qrCodeId,
        `"${(r.name || '').replace(/"/g, '""')}"`,
        `"${(r.description || '').replace(/"/g, '""')}"`,
        r.locationName || '',
        r.sectionName || '',
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
