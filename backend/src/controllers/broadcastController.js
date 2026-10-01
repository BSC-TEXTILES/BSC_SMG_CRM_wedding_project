const pool = require('../config/db');
const conn = pool;
const { log: auditLog, AuditEvents } = require('../services/auditService');
const realtimeService = require('../services/realtimeService');
const crypto = require('crypto');

let broadcastSchemaChecked = false;
let broadcastSchemaPromise = null;
async function ensureBroadcastSchema() {
  if (broadcastSchemaChecked) return;
  if (!broadcastSchemaPromise) {
    broadcastSchemaPromise = (async () => {
      try {
        // 1. Ensure broadcast_messages table exists
        await pool.query(`
          CREATE TABLE IF NOT EXISTS \`broadcast_messages\` (
            \`id\` INT AUTO_INCREMENT PRIMARY KEY,
            \`title\` VARCHAR(255) NOT NULL,
            \`subject\` VARCHAR(255) NULL,
            \`message\` TEXT NOT NULL,
            \`priority\` VARCHAR(50) DEFAULT 'normal',
            \`category\` VARCHAR(100) DEFAULT 'General',
            \`target_role\` VARCHAR(255) NULL,
            \`sender_name\` VARCHAR(255) NULL,
            \`location_id\` INT NULL,
            \`status\` VARCHAR(50) DEFAULT 'Dispatched',
            \`require_ack\` TINYINT(1) DEFAULT 0,
            \`pinned\` TINYINT(1) DEFAULT 0,
            \`scheduled_at\` TIMESTAMP NULL,
            \`dispatched_at\` TIMESTAMP NULL,
            \`expires_at\` TIMESTAMP NULL,
            \`acknowledgement_required\` TINYINT(1) DEFAULT 0,
            \`created_by\` INT NULL,
            \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX \`idx_bm_status\` (\`status\`),
            INDEX \`idx_bm_loc\` (\`location_id\`)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `).catch(() => {});

        // Ensure columns in broadcast_messages
        const colsToAdd = [
          { name: 'location_id', def: 'INT NULL AFTER sender_name' },
          { name: 'scheduled_at', def: 'TIMESTAMP NULL' },
          { name: 'dispatched_at', def: 'TIMESTAMP NULL' },
          { name: 'expires_at', def: 'TIMESTAMP NULL' },
          { name: 'acknowledgement_required', def: 'TINYINT(1) DEFAULT 0' },
          { name: 'created_by', def: 'INT NULL' },
          { name: 'updated_at', def: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
        ];
        for (const col of colsToAdd) {
          try {
            await pool.query(`ALTER TABLE \`broadcast_messages\` ADD COLUMN \`${col.name}\` ${col.def}`);
          } catch (e) { /* already exists */ }
        }

        // 2. Ensure broadcast_audience table exists
        await pool.query(`
          CREATE TABLE IF NOT EXISTS \`broadcast_audience\` (
            \`id\` INT AUTO_INCREMENT PRIMARY KEY,
            \`broadcast_id\` INT NOT NULL,
            \`audience_group\` VARCHAR(50) NOT NULL,
            \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX \`idx_ba_broadcast\` (\`broadcast_id\`),
            INDEX \`idx_ba_group\` (\`audience_group\`)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `).catch(() => {});

        // 3. Ensure broadcast_recipients table exists
        await pool.query(`
          CREATE TABLE IF NOT EXISTS \`broadcast_recipients\` (
            \`id\` INT AUTO_INCREMENT PRIMARY KEY,
            \`broadcast_id\` INT NOT NULL,
            \`user_id\` INT NOT NULL,
            \`delivered_at\` TIMESTAMP NULL,
            \`read_at\` TIMESTAMP NULL,
            \`acknowledged_at\` TIMESTAMP NULL,
            \`status\` VARCHAR(20) DEFAULT 'PENDING',
            \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX \`idx_br_broadcast\` (\`broadcast_id\`),
            INDEX \`idx_br_user\` (\`user_id\`),
            INDEX \`idx_br_status\` (\`status\`)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `).catch(() => {});

        // 4. Ensure broadcast_audit_log table exists
        await pool.query(`
          CREATE TABLE IF NOT EXISTS \`broadcast_audit_log\` (
            \`id\` INT AUTO_INCREMENT PRIMARY KEY,
            \`broadcast_id\` INT NULL,
            \`user_id\` INT NULL,
            \`action\` VARCHAR(60) NOT NULL,
            \`metadata\` JSON NULL,
            \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX \`idx_bal_broadcast\` (\`broadcast_id\`),
            INDEX \`idx_bal_user\` (\`user_id\`)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `).catch(() => {});

        broadcastSchemaChecked = true;
      } catch (e) {
        console.warn('[Broadcast] Schema check warning:', e.message);
      }
    })();
  }
  return broadcastSchemaPromise;
}

const AUDIENCE_GROUPS = [
  'Everyone',
  'HR Team',
  'Recruiters',
  'Store Managers',
  'Interview Panel',
  'Employees',
  'Admins'
];

const PRIORITY_LEVELS = ['low', 'normal', 'high', 'critical'];
const CATEGORIES = [
  'General',
  'HR',
  'Recruitment',
  'Interview',
  'Offer',
  'Joining',
  'Payroll',
  'System',
  'Emergency'
];
const STATUSES = ['Draft', 'Scheduled', 'Sent', 'Dispatched', 'Active', 'Expired', 'Cancelled'];

function validateBroadcastData(data, isUpdate = false) {
  const errors = [];
  
  if (!isUpdate || data.title !== undefined) {
    if (!data.title || !data.title.trim()) {
      errors.push('Broadcast Title is required');
    } else if (data.title.length > 255) {
      errors.push('Broadcast Title must be 255 characters or less');
    }
  }
  
  if (!isUpdate || data.message !== undefined) {
    if (!data.message || !data.message.trim()) {
      errors.push('Broadcast Message Body is required');
    } else if (data.message.length > 10000) {
      errors.push('Broadcast Message Body must be 10000 characters or less');
    }
  }
  
  if (data.priority !== undefined && !PRIORITY_LEVELS.includes(data.priority)) {
    errors.push('Invalid Priority Level');
  }
  
  if (data.category !== undefined && !CATEGORIES.includes(data.category)) {
    errors.push('Invalid Broadcast Category');
  }
  
  if (data.audience !== undefined) {
    if (!Array.isArray(data.audience) || data.audience.length === 0) {
      errors.push('At least one Target Audience / Recipient Group is required');
    } else {
      const invalidGroups = data.audience.filter(g => !AUDIENCE_GROUPS.includes(g));
      if (invalidGroups.length > 0) {
        errors.push(`Invalid audience groups: ${invalidGroups.join(', ')}`);
      }
    }
  }
  
  if (data.scheduledAt !== undefined && data.scheduledAt) {
    const scheduled = new Date(data.scheduledAt);
    if (isNaN(scheduled.getTime())) {
      errors.push('Invalid Schedule Dispatch Date & Time');
    } else if (scheduled <= new Date()) {
      errors.push('Schedule Dispatch Date & Time must be in the future');
    }
  }
  
  if (data.expiresAt !== undefined && data.expiresAt) {
    const expires = new Date(data.expiresAt);
    if (isNaN(expires.getTime())) {
      errors.push('Invalid Expiry Date');
    } else if (data.scheduledAt && new Date(data.expiresAt) <= new Date(data.scheduledAt)) {
      errors.push('Expiry Date must be after Schedule Dispatch Date & Time');
    } else if (!data.scheduledAt && expires <= new Date()) {
      errors.push('Expiry Date must be in the future');
    }
  }
  
  return errors;
}

function buildAudienceQuery(groups, user) {
  if (!groups || groups.length === 0) return { where: '1=0', params: [] };
  
  if (groups.includes('Everyone')) {
    return { where: '1=1', params: [] };
  }
  
  const conditions = [];
  const params = [];
  
  for (const group of groups) {
    switch (group) {
      case 'HR Team':
        conditions.push('(`role` = ? OR `role` = ?)');
        params.push('HR', 'HR Manager');
        break;
      case 'Recruiters':
        conditions.push('`role` = ?');
        params.push('Recruiter');
        break;
      case 'Store Managers':
        conditions.push('`role` IN (?, ?, ?)');
        params.push('Manager', 'Store Manager', 'Floor Manager');
        break;
      case 'Interview Panel':
        conditions.push('`role` = ?');
        params.push('Interviewer');
        break;
      case 'Employees':
        conditions.push('`role` NOT IN (?, ?, ?, ?)');
        params.push('Admin', 'Super Admin', 'System Administrator', 'Guest');
        break;
      case 'Admins':
        conditions.push('`role` IN (?, ?, ?)');
        params.push('Admin', 'Super Admin', 'System Administrator');
        break;
      default:
        conditions.push('`role` = ?');
        params.push(group);
    }
  }
  
  if (user && !user.isGlobalAdmin && user.locationId) {
    conditions.push('`location_id` = ?');
    params.push(user.locationId);
  }
  
  const where = conditions.length > 0 ? `(${conditions.join(' OR ')})` : '1=0';
  return { where, params };
}

async function resolveRecipients(broadcastId, audienceGroups, senderId, conn = pool) {
  const { where, params } = buildAudienceQuery(audienceGroups, { isGlobalAdmin: false, locationId: null });
  
  const query = `
    SELECT id FROM users 
    WHERE active = 1 AND ${where}
  `;
  
  const [users] = await conn.query(query, params);
  
  if (users.length === 0) {
    return { count: 0, userIds: [] };
  }
  
  const placeholders = users.map(() => '(?, ?, ?, ?, ?, NOW())').join(', ');
  const values = [];
  for (const user of users) {
    values.push(broadcastId, user.id, null, null, 'PENDING');
  }
  
  await conn.query(
    `INSERT INTO broadcast_recipients (broadcast_id, user_id, delivered_at, read_at, status, created_at)
     VALUES ${placeholders}
     ON DUPLICATE KEY UPDATE status = VALUES(status)`,
    values
  );
  
  return { count: users.length, userIds: users.map(u => u.id) };
}

async function logAudit(req, action, broadcastId, details = {}) {
  try {
    await auditLog({
      req,
      action,
      module: 'Broadcast',
      details: { broadcastId, ...details },
      targetId: broadcastId,
      targetType: 'broadcast'
    });
  } catch (err) {
    console.warn('[Broadcast] Audit log failed:', err.message);
  }
}

/**
 * Accept either spelling of every broadcast field.
 *
 * The Broadcast Center posts snake_case (`target_role`, `require_ack`, `sender_name`)
 * and its own names for timing (`scheduledAt`, `expiryDate`), while this API was
 * written against `audience`, `requireAck` and `expiresAt`. Nothing complained: the
 * record simply saved with no recipients, the acknowledgement toggle did nothing,
 * and the schedule/expiry the user picked were dropped.
 */
function normalizeBroadcastInput(body = {}) {
  const firstValue = (...values) => values.find(v => v !== undefined && v !== null && v !== '');

  const audience = Array.isArray(body.audience) && body.audience.length > 0
    ? body.audience
    : String(firstValue(body.target_role, body.targetRole, '') || 'Everyone')
      .split(',')
      .map(group => group.trim())
      .filter(Boolean);

  const requireAck = firstValue(body.requireAck, body.require_ack, body.requireAcknowledgement, false);
  const scheduledAt = firstValue(body.scheduledAt, body.scheduled_at, body.startDate, null);
  const expiresAt = firstValue(body.expiresAt, body.expires_at, body.expiryDate, null);

  return {
    ...body,
    audience,
    target_role: audience.join(', '),
    requireAck: requireAck === true || requireAck === 1 || String(requireAck) === 'true',
    pinned: body.pinned === true || body.pinNotification === true || body.pinned === 1,
    sender_name: firstValue(body.sender_name, body.senderName, null),
    scheduledAt,
    expiresAt
  };
}

exports.getBroadcasts = async (req, res) => {
  try {
    if (!req.user || req.user.role === 'Guest' || req.user.id === 'anonymous') {
      return res.json({ success: true, broadcasts: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    }
    
    await ensureBroadcastSchema();

    const { status, priority, category, audience, dateFrom, dateTo, page = 1, limit = 20 } = req.query;
    const pageNumber = parseInt(page) || 1;
    const pageSize = parseInt(limit) || 20;
    const offset = (pageNumber - 1) * pageSize;

    /**
     * Filter list and its parameters, built together so the `?` placeholders and the
     * bound values can never disagree.
     *
     * `withAudience: false` drops only the condition that needs the audience table;
     * the store scoping stays in every variant, because a degraded read must not
     * become a wider one.
     */
    const buildWhere = ({ withAudience = true } = {}) => {
      const clauses = ['1=1'];
      const values = [];
      if (status) { clauses.push('bm.status = ?'); values.push(status); }
      if (priority) { clauses.push('bm.priority = ?'); values.push(priority); }
      if (category) { clauses.push('bm.category = ?'); values.push(category); }
      if (dateFrom) { clauses.push('DATE(bm.created_at) >= ?'); values.push(dateFrom); }
      if (dateTo) { clauses.push('DATE(bm.created_at) <= ?'); values.push(dateTo); }
      // Global notices (location_id IS NULL) plus this user's own branch notices.
      if (!req.user.isGlobalAdmin && req.user.locationId) {
        clauses.push('(bm.location_id IS NULL OR bm.location_id = ?)');
        values.push(req.user.locationId);
      }
      if (withAudience && audience) {
        clauses.push('EXISTS (SELECT 1 FROM broadcast_audience ba WHERE ba.broadcast_id = bm.id AND ba.audience_group = ?)');
        values.push(audience);
      }
      return { clause: `WHERE ${clauses.join(' AND ')}`, values };
    };

    const { clause: filterClause, values: filterParams } = buildWhere();

    let rows = [];
    let countRows = [];
    let total = 0;
    try {
      [rows] = await conn.query(`
        SELECT
          bm.*,
          u.full_name as creator_name,
          COALESCE((SELECT COUNT(*) FROM broadcast_recipients br WHERE br.broadcast_id = bm.id), 0) as total_recipients,
          COALESCE((SELECT COUNT(*) FROM broadcast_recipients br WHERE br.broadcast_id = bm.id AND br.read_at IS NOT NULL), 0) as read_count,
          COALESCE((SELECT COUNT(*) FROM broadcast_recipients br WHERE br.broadcast_id = bm.id AND br.acknowledged_at IS NOT NULL), 0) as acknowledged_count,
          (SELECT JSON_ARRAYAGG(audience_group) FROM broadcast_audience ba WHERE ba.broadcast_id = bm.id) as audience_groups
        FROM broadcast_messages bm
        LEFT JOIN users u ON bm.created_by = u.id
        ${filterClause}
        ORDER BY bm.created_at DESC
        LIMIT ? OFFSET ?
      `, [...filterParams, pageSize, offset]);

      [countRows] = await conn.query(`
        SELECT COUNT(*) as total FROM broadcast_messages bm ${filterClause}
      `, filterParams);
      total = Number(countRows?.[0]?.total || 0);
    } catch (primaryErr) {
      console.warn('[Broadcast] List query failed, retrying without the recipient subqueries:', primaryErr.message);
      try {
        const reduced = buildWhere({ withAudience: false });
        [rows] = await conn.query(`
          SELECT
            bm.*,
            0 as total_recipients,
            0 as read_count,
            0 as acknowledged_count,
            JSON_ARRAY() as audience_groups
          FROM broadcast_messages bm
          ${reduced.clause}
          ORDER BY bm.created_at DESC
          LIMIT ? OFFSET ?
        `, [...reduced.values, pageSize, offset]);

        [countRows] = await conn.query(`
          SELECT COUNT(*) as total FROM broadcast_messages bm ${reduced.clause}
        `, reduced.values);
        total = Number(countRows?.[0]?.total || 0);
      } catch (fallbackErr) {
        console.error('[Broadcast] Fallback list query failed:', fallbackErr.message);
        // A failed read must not look like "there are no broadcasts".
        return res.status(500).json({
          success: false,
          message: 'Unable to load broadcasts. Please try again.',
          errors: [fallbackErr.message]
        });
      }
    }

    res.json({
      success: true,
      // The screen reads camelCase (`requireAcknowledgement`, `scheduledAt`) while the
      // table columns are snake_case; without both spellings the acknowledgement and
      // schedule figures sat at zero no matter what was stored.
      broadcasts: (rows || []).map(b => ({
        ...b,
        requireAcknowledgement: !!(b.require_ack ?? b.acknowledgement_required),
        scheduledAt: b.scheduled_at ?? b.scheduledAt ?? null,
        expiresAt: b.expires_at ?? b.expiresAt ?? null,
        targetRole: b.target_role ?? null
      })),
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (err) {
    console.error('[Broadcast getBroadcasts Error]', err.message);
    // Answering "no broadcasts" when the read failed is how a store misses an
    // announcement while believing everything is fine.
    return res.status(500).json({
      success: false,
      message: 'Unable to load broadcasts. Please try again.',
      errors: [err.message]
    });
  }
};


exports.getBroadcastById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rows] = await conn.query(`
      SELECT 
        bm.*,
        u.full_name as creator_name,
        (SELECT JSON_ARRAYAGG(audience_group) FROM broadcast_audience ba WHERE ba.broadcast_id = bm.id) as audience_groups,
        (SELECT COUNT(*) FROM broadcast_recipients br WHERE br.broadcast_id = bm.id) as total_recipients,
        (SELECT COUNT(*) FROM broadcast_recipients br WHERE br.broadcast_id = bm.id AND br.delivered_at IS NOT NULL) as delivered_count,
        (SELECT COUNT(*) FROM broadcast_recipients br WHERE br.broadcast_id = bm.id AND br.read_at IS NOT NULL) as read_count,
        (SELECT COUNT(*) FROM broadcast_recipients br WHERE br.broadcast_id = bm.id AND br.acknowledged_at IS NOT NULL) as acknowledged_count
      FROM broadcast_messages bm
      LEFT JOIN users u ON bm.created_by = u.id
      WHERE bm.id = ?
    `, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Broadcast not found' });
    }
    
    const broadcast = rows[0];
    
    const [recipients] = await conn.query(`
      SELECT 
        br.*,
        u.username,
        u.full_name,
        u.role,
        u.location_id
      FROM broadcast_recipients br
      JOIN users u ON br.user_id = u.id
      WHERE br.broadcast_id = ?
      ORDER BY br.created_at DESC
    `, [id]);
    
    res.json({ success: true, broadcast, recipients });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.createBroadcast = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    const {
      title, subject, message, priority, category,
      audience, scheduledAt, expiresAt,
      requireAck, pinned, action, sender_name, status
    } = normalizeBroadcastInput(req.body);

    const errors = validateBroadcastData({
      title, subject, message, priority, category,
      audience, scheduledAt, expiresAt
    });
    if (errors.length > 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, error: errors.join(', ') });
    }

    // `action` is what this API was written against; the Broadcast Center sends a
    // plain status instead, and that spelling had to win or every dispatch from the
    // page would have been filed with the wrong lifecycle state.
    const finalStatus = action === 'schedule'
      ? 'Scheduled'
      : (action === 'draft'
        ? 'Draft'
        : (STATUSES.includes(status) ? status : 'Dispatched'));
    const isLive = finalStatus === 'Dispatched' || finalStatus === 'Sent';
    const now = new Date();
    const dispatchedAt = isLive ? now : null;
    
    const [result] = await conn.query(
      `INSERT INTO broadcast_messages 
      (title, subject, message, priority, category, target_role, sender_name, status, 
       require_ack, pinned, scheduled_at, expires_at, dispatched_at, created_by, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        title.trim(), subject || null, message.trim(), 
        priority || 'normal', category || 'General', 
        audience.join(', '), sender_name || req.user.fullName || req.user.username,
        finalStatus, requireAck ? 1 : 0, pinned ? 1 : 0,
        scheduledAt || null, expiresAt || null, dispatchedAt, req.user.id
      ]
    );
    
    const broadcastId = result.insertId;
    
    // Insert audience groups
    for (const group of audience) {
      await conn.query(
        'INSERT INTO broadcast_audience (broadcast_id, audience_group) VALUES (?, ?)',
        [broadcastId, group]
      );
    }
    
    let recipientResult = { count: 0 };
    if (isLive) {
      recipientResult = await resolveRecipients(broadcastId, audience, req.user.id, conn);
    }
    
    // Audit log
    await conn.query(
      `INSERT INTO broadcast_audit_log (broadcast_id, user_id, action, metadata, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [broadcastId, req.user.id, 'CREATED', JSON.stringify({ 
        title, audience, status: finalStatus, scheduledAt, expiresAt, 
        requireAck: !!requireAck, pinned: !!pinned 
      })]
    );
    
    await conn.commit();
    
    const [newBroadcast] = await conn.query('SELECT * FROM broadcast_messages WHERE id = ?', [broadcastId]);
    
    // Push to the store this broadcast was addressed to (and to global admins),
    // instead of to every browser in every store.
    if (isLive) {
      realtimeService.emitBroadcastChange('CREATE', newBroadcast[0], { recipientsCount: recipientResult.count });
    }
    
    await logAudit(req, 'BROADCAST_CREATED', broadcastId, { 
      title, status: finalStatus, recipientCount: recipientResult.count 
    });
    
    res.json({ 
      success: true, 
      broadcast: newBroadcast[0],
      recipients: recipientResult.count,
      message: action === 'draft' ? 'Draft saved successfully' : 
               action === 'schedule' ? 'Broadcast scheduled successfully' : 
               'Broadcast dispatched successfully'
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    conn.release();
  }
};

exports.updateBroadcast = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    const { id } = req.params;
    const {
      title, subject, message, priority, category,
      audience, scheduledAt, expiresAt,
      requireAck, pinned, action, status
    } = normalizeBroadcastInput(req.body);
    
    const [existing] = await conn.query('SELECT * FROM broadcast_messages WHERE id = ?', [id]);
    if (existing.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, error: 'Broadcast not found' });
    }
    
    const broadcast = existing[0];
    if (broadcast.status === 'Dispatched' || broadcast.status === 'Active' || broadcast.status === 'Expired') {
      await conn.rollback();
      return res.status(400).json({ success: false, error: 'Cannot edit a dispatched/active/expired broadcast' });
    }
    
    const errors = validateBroadcastData(req.body, true);
    if (errors.length > 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, error: errors.join(', ') });
    }
    
    let finalStatus = broadcast.status;
    let dispatchedAt = broadcast.dispatched_at;
    
    if (action === 'dispatch' && broadcast.status === 'Draft') {
      finalStatus = 'Dispatched';
      dispatchedAt = new Date();
    } else if (action === 'schedule' && broadcast.status === 'Draft') {
      finalStatus = 'Scheduled';
      dispatchedAt = null;
    } else if (action === 'draft') {
      finalStatus = 'Draft';
      dispatchedAt = null;
    }
    
    await conn.query(
      `UPDATE broadcast_messages SET 
        title = ?, subject = ?, message = ?, priority = ?, category = ?, 
        target_role = ?, status = ?, require_ack = ?, pinned = ?, 
        scheduled_at = ?, expires_at = ?, dispatched_at = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        title.trim(), subject || null, message.trim(), 
        priority || 'normal', category || 'General', 
        audience.join(', '), finalStatus, requireAck ? 1 : 0, pinned ? 1 : 0,
        scheduledAt || null, expiresAt || null, dispatchedAt, id
      ]
    );
    
    // Update audience groups
    await conn.query('DELETE FROM broadcast_audience WHERE broadcast_id = ?', [id]);
    for (const group of audience) {
      await conn.query(
        'INSERT INTO broadcast_audience (broadcast_id, audience_group) VALUES (?, ?)',
        [id, group]
      );
    }
    
    let recipientResult = { count: 0 };
    if (action === 'dispatch' && broadcast.status !== 'Dispatched') {
      recipientResult = await resolveRecipients(id, audience, req.user.id, conn);
    }
    
    // Audit log
    await conn.query(
      `INSERT INTO broadcast_audit_log (broadcast_id, user_id, action, metadata, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [id, req.user.id, action === 'dispatch' ? 'DISPATCHED' : 'UPDATED', JSON.stringify({ 
        title, audience, status: finalStatus, scheduledAt, expiresAt 
      })]
    );
    
    await conn.commit();
    
    const [updatedBroadcast] = await conn.query('SELECT * FROM broadcast_messages WHERE id = ?', [id]);
    
    // Push to the addressed store so the live screens react.
    if (action === 'dispatch') {
      realtimeService.emitBroadcastChange('CREATE', updatedBroadcast[0], { recipientsCount: recipientResult.count });
    }
    
    await logAudit(req, action === 'dispatch' ? 'BROADCAST_DISPATCHED' : 'BROADCAST_UPDATED', id, { 
      status: finalStatus, recipientCount: recipientResult.count 
    });
    
    res.json({ 
      success: true, 
      broadcast: updatedBroadcast[0],
      recipients: recipientResult.count,
      message: action === 'dispatch' ? 'Broadcast dispatched successfully' : 
               action === 'schedule' ? 'Broadcast scheduled successfully' : 
               'Broadcast updated successfully'
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    conn.release();
  }
};

exports.deleteBroadcast = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    const { id } = req.params;
    const [existing] = await conn.query('SELECT * FROM broadcast_messages WHERE id = ?', [id]);
    
    if (existing.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, error: 'Broadcast not found' });
    }
    
    const broadcast = existing[0];
    if (broadcast.status === 'Dispatched' || broadcast.status === 'Active') {
      await conn.rollback();
      return res.status(400).json({ success: false, error: 'Cannot delete a dispatched/active broadcast. Cancel it first.' });
    }
    
    await conn.query('DELETE FROM broadcast_audience WHERE broadcast_id = ?', [id]);
    await conn.query('DELETE FROM broadcast_recipients WHERE broadcast_id = ?', [id]);
    await conn.query('DELETE FROM broadcast_audit_log WHERE broadcast_id = ?', [id]);
    await conn.query('DELETE FROM broadcast_messages WHERE id = ?', [id]);
    
    await conn.commit();
    
    // Emit socket event
    realtimeService.emitBroadcastChange('DELETE', broadcast);
    
    await logAudit(req, 'BROADCAST_DELETED', parseInt(id), { title: broadcast.title });
    
    res.json({ success: true, message: 'Broadcast deleted successfully' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    conn.release();
  }
};

exports.cancelBroadcast = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    const { id } = req.params;
    const [existing] = await conn.query('SELECT * FROM broadcast_messages WHERE id = ?', [id]);
    
    if (existing.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, error: 'Broadcast not found' });
    }
    
    const broadcast = existing[0];
    // 'Sent' is what the Broadcast Center files an immediate dispatch as, so it has
    // to be withdrawable too — otherwise the only way back is the database.
    if (!['Dispatched', 'Active', 'Scheduled', 'Sent'].includes(broadcast.status)) {
      await conn.rollback();
      return res.status(400).json({ success: false, error: 'Only dispatched, active, scheduled or sent broadcasts can be cancelled' });
    }
    
    await conn.query(
      'UPDATE broadcast_messages SET status = ?, updated_at = NOW() WHERE id = ?',
      ['Cancelled', id]
    );
    
    // Audit log
    await conn.query(
      `INSERT INTO broadcast_audit_log (broadcast_id, user_id, action, metadata, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [id, req.user.id, 'CANCELLED', JSON.stringify({ previousStatus: broadcast.status })]
    );
    
    await conn.commit();
    
    // Emit socket event
    realtimeService.emitBroadcastChange('CANCEL', broadcast);
    
    await logAudit(req, 'BROADCAST_CANCELLED', parseInt(id));
    
    res.json({ success: true, message: 'Broadcast cancelled successfully' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    conn.release();
  }
};

exports.acknowledgeBroadcast = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    const { id } = req.params;
    const userId = req.user.id;
    
    const [broadcast] = await conn.query('SELECT * FROM broadcast_messages WHERE id = ?', [id]);
    if (broadcast.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, error: 'Broadcast not found' });
    }
    
    if (!broadcast[0].require_ack && !broadcast[0].acknowledgement_required) {
      await conn.rollback();
      return res.status(400).json({ success: false, error: 'This broadcast does not require acknowledgement' });
    }
    
    const [recipient] = await conn.query(
      'SELECT * FROM broadcast_recipients WHERE broadcast_id = ? AND user_id = ?',
      [id, userId]
    );
    
    if (recipient.length === 0) {
      await conn.rollback();
      return res.status(403).json({ success: false, error: 'You are not a recipient of this broadcast' });
    }
    
    if (recipient[0].acknowledged_at) {
      await conn.rollback();
      return res.status(400).json({ success: false, error: 'Already acknowledged' });
    }
    
    await conn.query(
      'UPDATE broadcast_recipients SET acknowledged_at = NOW(), status = ? WHERE broadcast_id = ? AND user_id = ?',
      ['ACKNOWLEDGED', id, userId]
    );
    
    // Audit log
    await conn.query(
      `INSERT INTO broadcast_audit_log (broadcast_id, user_id, action, metadata, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [id, userId, 'ACKNOWLEDGED', JSON.stringify({ username: req.user.username })]
    );
    
    await conn.commit();
    
    // Emit socket event for real-time updates
    realtimeService.emitBroadcastChange('ACKNOWLEDGE', broadcast[0], { userId, username: req.user.username });
    
    await logAudit(req, 'BROADCAST_ACKNOWLEDGED', parseInt(id), { username: req.user.username });
    
    res.json({ success: true, message: 'Acknowledgement recorded' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    conn.release();
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    await conn.query(
      'UPDATE broadcast_recipients SET read_at = COALESCE(read_at, NOW()), status = ? WHERE broadcast_id = ? AND user_id = ?',
      ['READ', id, userId]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getBroadcastReport = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [broadcast] = await conn.query('SELECT * FROM broadcast_messages WHERE id = ?', [id]);
    if (broadcast.length === 0) {
      return res.status(404).json({ success: false, error: 'Broadcast not found' });
    }
    
    const [stats] = await conn.query(`
      SELECT 
        COUNT(*) as total_recipients,
        SUM(CASE WHEN delivered_at IS NOT NULL THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN read_at IS NOT NULL THEN 1 ELSE 0 END) as read_count,
        SUM(CASE WHEN acknowledged_at IS NOT NULL THEN 1 ELSE 0 END) as acknowledged,
        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'ACKNOWLEDGED' THEN 1 ELSE 0 END) as acknowledged_count
      FROM broadcast_recipients WHERE broadcast_id = ?
    `, [id]);
    
    const [recipients] = await conn.query(`
      SELECT 
        br.*,
        u.username, u.full_name, u.role, u.location_id
      FROM broadcast_recipients br
      JOIN users u ON br.user_id = u.id
      WHERE br.broadcast_id = ?
      ORDER BY br.created_at DESC
    `, [id]);
    
    res.json({ 
      success: true, 
      broadcast: broadcast[0],
      stats: stats[0],
      recipients 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getBroadcastStats = async (req, res) => {
  try {
    if (!req.user || req.user.role === 'Guest' || req.user.id === 'anonymous') {
      return res.json({ success: true, stats: { total: 0, drafts: 0, scheduled: 0, dispatched: 0, expired: 0, cancelled: 0, ack_required: 0 } });
    }
    
    await ensureBroadcastSchema();

    let where = 'WHERE 1=1';
    const params = [];
    
    if (!req.user.isGlobalAdmin && req.user.locationId && broadcastSchemaChecked) {
      where += ' AND (location_id IS NULL OR location_id = ?)';
      params.push(req.user.locationId);
    }
    
    let stats = [{}];
    try {
      [stats] = await conn.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'Draft' THEN 1 ELSE 0 END) as drafts,
          SUM(CASE WHEN status = 'Scheduled' THEN 1 ELSE 0 END) as scheduled,
          SUM(CASE WHEN status IN ('Dispatched', 'Active') THEN 1 ELSE 0 END) as dispatched,
          SUM(CASE WHEN status = 'Expired' THEN 1 ELSE 0 END) as expired,
          SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled,
          SUM(CASE WHEN require_ack = 1 OR acknowledgement_required = 1 THEN 1 ELSE 0 END) as ack_required
        FROM broadcast_messages ${where}
      `, params);
    } catch (statErr) {
      try {
        [stats] = await conn.query(`
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'Draft' THEN 1 ELSE 0 END) as drafts,
            SUM(CASE WHEN status = 'Scheduled' THEN 1 ELSE 0 END) as scheduled,
            SUM(CASE WHEN status IN ('Dispatched', 'Active') THEN 1 ELSE 0 END) as dispatched,
            SUM(CASE WHEN status = 'Expired' THEN 1 ELSE 0 END) as expired,
            SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled,
            SUM(CASE WHEN require_ack = 1 OR acknowledgement_required = 1 THEN 1 ELSE 0 END) as ack_required
          FROM broadcast_messages WHERE 1=1
        `);
      } catch (fallbackErr) {
        return res.json({ success: true, stats: { total: 0, drafts: 0, scheduled: 0, dispatched: 0, expired: 0, cancelled: 0, ack_required: 0 } });
      }
    }
    
    res.json({ success: true, stats: stats[0] || {} });
  } catch (err) {
    console.warn('[Broadcast getBroadcastStats Error]', err.message);
    res.json({ success: true, stats: { total: 0, drafts: 0, scheduled: 0, dispatched: 0, expired: 0, cancelled: 0, ack_required: 0 } });
  }
};