/**
 * BSC SMG CRM — Daily MCheck Controller
 * Daily Management Checklist & Reporting System
 */

const db = require('../config/db');
const { getLocationFilter, injectLocationId } = require('../middleware/auth');

function getISTDateString(offset = 0) {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + istOffset + offset);
  return istDate.toISOString().split('T')[0];
}

function formatDateForDisplay(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}

// ── Get All Modules ──────────────────────────────────────────────
exports.getModules = async (req, res) => {
  try {
    const [modules] = await db.query(`
      SELECT m.*, COUNT(c.id) as total_checkpoints
      FROM mcheck_modules m
      LEFT JOIN mcheck_checkpoints c ON c.module_id = m.id AND c.is_active = 1
      WHERE m.is_active = 1
      GROUP BY m.id
      ORDER BY m.sort_order ASC
    `);
    return res.json({ success: true, modules });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Dashboard KPIs ──────────────────────────────────────────────
exports.getDashboard = async (req, res) => {
  try {
    const date = req.query.date || getISTDateString();
    const { clause: locClause, params: locParams } = await getLocationFilter(req, 'r');

    // Get all active checkpoints with location-filtered responses
    const [checkpoints] = await db.query(`
      SELECT cp.id, cp.module_id, cp.checklist_id, cp.checkpoint_title, 
             cp.responsible_department, cp.scheduled_time,
             m.module_name, m.module_key,
             r.system_status, r.is_draft, r.compliance_status, r.accuracy
      FROM mcheck_checkpoints cp
      JOIN mcheck_modules m ON m.id = cp.module_id
      LEFT JOIN mcheck_responses r ON r.checkpoint_id = cp.id AND r.response_date = ? ${locClause}
      WHERE cp.is_active = 1 AND m.is_active = 1
      ORDER BY m.sort_order ASC, cp.sort_order ASC
    `, [date, ...locParams]);

    const total = checkpoints.length;
    let done = 0, notDone = 0, inProgress = 0, postponed = 0, pending = 0;

    // Module-wise aggregation
    const moduleMap = {};
    for (const cp of checkpoints) {
      const status = cp.system_status || 'PENDING';
      if (status === 'DONE') done++;
      else if (status === 'NOT_DONE') notDone++;
      else if (status === 'IN_PROGRESS') inProgress++;
      else if (status === 'POSTPONED') postponed++;
      else pending++;

      if (!moduleMap[cp.module_id]) {
        moduleMap[cp.module_id] = {
          module_id: cp.module_id,
          module_name: cp.module_name,
          module_key: cp.module_key,
          total: 0, done: 0, not_done: 0, in_progress: 0, postponed: 0, pending: 0
        };
      }
      moduleMap[cp.module_id].total++;
      if (status === 'DONE') moduleMap[cp.module_id].done++;
      else if (status === 'NOT_DONE') moduleMap[cp.module_id].not_done++;
      else if (status === 'IN_PROGRESS') moduleMap[cp.module_id].in_progress++;
      else if (status === 'POSTPONED') moduleMap[cp.module_id].postponed++;
      else moduleMap[cp.module_id].pending++;
    }

    const moduleStats = Object.values(moduleMap).map(m => ({
      ...m,
      completion_pct: m.total > 0 ? Math.round((m.done / m.total) * 100) : 0
    }));

    const completionPct = total > 0 ? Math.round((done / total) * 100) : 0;

    return res.json({
      success: true,
      date,
      dateDisplay: formatDateForDisplay(date),
      kpis: { total, done, notDone, inProgress, postponed, pending, completionPct },
      moduleStats
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Get Module Detail ──────────────────────────────────────────────
exports.getModuleDetail = async (req, res) => {
  try {
    const { moduleId } = req.params;
    const date = req.query.date || getISTDateString();
    const { clause: locClause, params: locParams } = await getLocationFilter(req, 'r');

    const [module] = await db.query(`SELECT * FROM mcheck_modules WHERE id = ?`, [moduleId]);
    if (!module.length) return res.status(404).json({ success: false, error: 'Module not found' });

    const [checklists] = await db.query(`
      SELECT * FROM mcheck_checklists WHERE module_id = ? AND is_active = 1 ORDER BY sort_order ASC
    `, [moduleId]);

    const [checkpoints] = await db.query(`
      SELECT cp.*,
             r.id as response_id,
             r.system_status, r.compliance_status, r.accuracy,
             r.remarks, r.corrective_action, r.photo_url,
             r.is_draft, r.submitted_by, r.submitted_at, r.updated_by,
             r.created_at as response_created_at, r.updated_at as response_updated_at
      FROM mcheck_checkpoints cp
      LEFT JOIN mcheck_responses r ON r.checkpoint_id = cp.id AND r.response_date = ? ${locClause}
      WHERE cp.module_id = ? AND cp.is_active = 1
      ORDER BY cp.sort_order ASC
    `, [date, ...locParams, moduleId]);

    // Aggregate module stats
    let total = checkpoints.length, done = 0, notDone = 0, inProgress = 0, postponed = 0, pending = 0;
    for (const cp of checkpoints) {
      const s = cp.system_status || 'PENDING';
      if (s === 'DONE') done++;
      else if (s === 'NOT_DONE') notDone++;
      else if (s === 'IN_PROGRESS') inProgress++;
      else if (s === 'POSTPONED') postponed++;
      else pending++;
    }
    const completionPct = total > 0 ? Math.round((done / total) * 100) : 0;

    return res.json({
      success: true,
      date,
      dateDisplay: formatDateForDisplay(date),
      module: module[0],
      checklists,
      checkpoints,
      stats: { total, done, notDone, inProgress, postponed, pending, completionPct }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Save / Submit Response ───────────────────────────────────────
exports.saveResponse = async (req, res) => {
  try {
    const {
      checkpoint_id, response_date, compliance_status, accuracy,
      remarks, corrective_action, photo_url, system_status, is_submit, updated_by
    } = req.body;

    if (!checkpoint_id || !response_date) {
      return res.status(400).json({ success: false, error: 'checkpoint_id and response_date are required' });
    }

    // Location from JWT — cannot be overridden by frontend
    const locationId = req.user ? (req.user.locationId || 2) : 2;

    // Fetch checkpoint to get module/checklist IDs
    const [cpRows] = await db.query(
      `SELECT id, module_id, checklist_id FROM mcheck_checkpoints WHERE id = ?`, [checkpoint_id]
    );
    if (!cpRows.length) return res.status(404).json({ success: false, error: 'Checkpoint not found' });
    const cp = cpRows[0];

    // Determine system status
    let finalStatus = system_status || 'PENDING';
    if (is_submit) {
      if (!finalStatus || finalStatus === 'PENDING' || finalStatus === 'IN_PROGRESS') {
        if (compliance_status === 'Not Followed') finalStatus = 'NOT_DONE';
        else if (compliance_status && compliance_status !== '') finalStatus = 'DONE';
        else finalStatus = 'DONE';
      }
    } else if (compliance_status || remarks || corrective_action) {
      if (finalStatus === 'PENDING') finalStatus = 'IN_PROGRESS';
    }

    const isDraft = is_submit ? 0 : 1;
    const submittedAt = is_submit ? new Date() : null;
    const submittedBy = is_submit ? (updated_by || null) : null;

    // Check if existing response exists (for audit log)
    const [existing] = await db.query(
      `SELECT id, system_status, remarks, compliance_status FROM mcheck_responses WHERE checkpoint_id = ? AND response_date = ? AND location_id = ?`,
      [checkpoint_id, response_date, locationId]
    );

    let responseId;
    if (existing.length > 0) {
      // Record audit before update
      const prev = existing[0];
      await db.query(`
        INSERT INTO mcheck_audit_log (response_id, checkpoint_id, response_date, changed_by, prev_status, new_status, prev_remarks, new_remarks, prev_compliance, new_compliance, change_type, location_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [prev.id, checkpoint_id, response_date, updated_by || 'System', prev.system_status, finalStatus, prev.remarks, remarks, prev.compliance_status, compliance_status, is_submit ? 'submit' : 'draft', locationId]).catch(() => {});

      await db.query(`
        UPDATE mcheck_responses SET
          system_status = ?, compliance_status = ?, accuracy = ?, remarks = ?,
          corrective_action = ?, photo_url = COALESCE(?, photo_url), is_draft = ?,
          submitted_by = COALESCE(?, submitted_by), submitted_at = COALESCE(?, submitted_at),
          updated_by = ?, updated_at = NOW()
        WHERE checkpoint_id = ? AND response_date = ? AND location_id = ?
      `, [finalStatus, compliance_status, accuracy, remarks, corrective_action, photo_url, isDraft, submittedBy, submittedAt, updated_by, checkpoint_id, response_date, locationId]);
      responseId = prev.id;
    } else {
      const [ins] = await db.query(`
        INSERT INTO mcheck_responses (checkpoint_id, checklist_id, module_id, response_date, system_status, compliance_status, accuracy, remarks, corrective_action, photo_url, is_draft, submitted_by, submitted_at, updated_by, location_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [checkpoint_id, cp.checklist_id, cp.module_id, response_date, finalStatus, compliance_status, accuracy, remarks, corrective_action, photo_url, isDraft, submittedBy, submittedAt, updated_by, locationId]);
      responseId = ins.insertId;

      // Audit for new
      if (responseId) {
        await db.query(`
          INSERT INTO mcheck_audit_log (response_id, checkpoint_id, response_date, changed_by, prev_status, new_status, prev_compliance, new_compliance, change_type, location_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [responseId, checkpoint_id, response_date, updated_by || 'System', 'PENDING', finalStatus, null, compliance_status, is_submit ? 'submit' : 'draft', locationId]).catch(() => {});
      }
    }

    return res.json({ success: true, responseId, system_status: finalStatus, is_draft: isDraft, message: is_submit ? 'Submitted successfully' : 'Draft saved' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Submit All (Module-level) ────────────────────────────────────
exports.submitAll = async (req, res) => {
  try {
    const { module_id, response_date, updated_by } = req.body;
    if (!module_id || !response_date) {
      return res.status(400).json({ success: false, error: 'module_id and response_date are required' });
    }

    // Resolve location
    let locationId = req.user ? (req.user.locationId || 2) : 2;
    const isGlobalAdmin = !req.user?.locationId || req.user?.isGlobalAdmin || ['Admin', 'Super Admin'].includes(req.user?.role);
    if (isGlobalAdmin && (req.body.location_id || req.body.locationId)) {
      locationId = parseInt(req.body.location_id || req.body.locationId, 10);
    }

    const [checkpoints] = await db.query(
      `SELECT cp.id, r.id as response_id, r.system_status, r.compliance_status, r.is_draft
       FROM mcheck_checkpoints cp
       LEFT JOIN mcheck_responses r ON r.checkpoint_id = cp.id AND r.response_date = ? AND r.location_id = ?
       WHERE cp.module_id = ? AND cp.is_active = 1`,
      [response_date, locationId, module_id]
    );

    let submitted = 0, skipped = 0;
    for (const cp of checkpoints) {
      if (cp.is_draft === 0 && cp.system_status && cp.system_status !== 'PENDING') {
        skipped++;
        continue; // Already finalized
      }

      if (!cp.response_id) {
        // Create new submitted record with location_id
        const [ins] = await db.query(`
          INSERT INTO mcheck_responses (checkpoint_id, checklist_id, module_id, response_date, system_status, compliance_status, accuracy, is_draft, submitted_by, submitted_at, updated_by, location_id)
          VALUES (?, 1, ?, ?, 'DONE', 'Fully Followed', 'Fully accurate', 0, ?, NOW(), ?, ?)
        `, [cp.id, module_id, response_date, updated_by || 'User', updated_by || 'User', locationId]);
        if (ins.insertId) {
          await db.query(`
            INSERT INTO mcheck_audit_log (response_id, checkpoint_id, response_date, changed_by, prev_status, new_status, change_type, location_id)
            VALUES (?, ?, ?, ?, 'PENDING', 'DONE', 'submit_all', ?)
          `, [ins.insertId, cp.id, response_date, updated_by || 'System', locationId]).catch(() => {});
        }
        submitted++;
      } else {
        let finalStatus = cp.system_status;
        if (!finalStatus || finalStatus === 'PENDING' || finalStatus === 'IN_PROGRESS') {
          finalStatus = cp.compliance_status === 'Not Followed' ? 'NOT_DONE' : 'DONE';
        }

        await db.query(`
          UPDATE mcheck_responses SET system_status = ?, is_draft = 0, submitted_by = ?, submitted_at = NOW(), updated_by = ?
          WHERE id = ? AND location_id = ?
        `, [finalStatus, updated_by, updated_by, cp.response_id, locationId]);

        await db.query(`
          INSERT INTO mcheck_audit_log (response_id, checkpoint_id, response_date, changed_by, prev_status, new_status, change_type, location_id)
          VALUES (?, ?, ?, ?, ?, ?, 'submit_all', ?)
        `, [cp.response_id, cp.id, response_date, updated_by || 'System', cp.system_status, finalStatus, locationId]).catch(() => {});

        submitted++;
      }
    }

    return res.json({ success: true, submitted, skipped, message: `${submitted} checkpoints submitted` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Management Reports ───────────────────────────────────────────
exports.getReports = async (req, res) => {
  try {
    const { date, fromDate, toDate, module_id, status, search } = req.query;
    const { clause: locClause, params: locParams } = await getLocationFilter(req, 'r');

    let dateFilter = '';
    const params = [];

    if (date) {
      dateFilter = `AND r.response_date = ?`;
      params.push(date);
    } else if (fromDate && toDate) {
      dateFilter = `AND r.response_date BETWEEN ? AND ?`;
      params.push(fromDate, toDate);
    } else {
      const today = getISTDateString();
      dateFilter = `AND r.response_date = ?`;
      params.push(today);
    }

    let moduleFilter = module_id ? `AND cp.module_id = ?` : '';
    if (module_id) params.push(module_id);

    let statusFilter = status && status !== 'ALL' ? `AND COALESCE(r.system_status, 'PENDING') = ?` : '';
    if (status && status !== 'ALL') params.push(status);

    let searchFilter = '';
    if (search) {
      searchFilter = `AND (cp.checkpoint_title LIKE ? OR cp.responsible_department LIKE ? OR r.remarks LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [rows] = await db.query(`
      SELECT 
        cp.id as checkpoint_id, cp.checkpoint_title, cp.checkpoint_description,
        cp.responsible_department, cp.responsible_person, cp.scheduled_time,
        m.id as module_id, m.module_name, m.module_key,
        cl.checklist_name,
        r.id as response_id, r.response_date,
        COALESCE(r.system_status, 'PENDING') as system_status,
        r.compliance_status, r.accuracy, r.remarks, r.corrective_action,
        r.photo_url, r.is_draft, r.submitted_by, r.submitted_at, r.updated_by,
        r.created_at as response_created_at, r.updated_at as response_updated_at
      FROM mcheck_checkpoints cp
      JOIN mcheck_modules m ON m.id = cp.module_id AND m.is_active = 1
      JOIN mcheck_checklists cl ON cl.id = cp.checklist_id
      LEFT JOIN mcheck_responses r ON r.checkpoint_id = cp.id ${dateFilter} ${locClause}
      WHERE cp.is_active = 1 ${moduleFilter} ${statusFilter} ${searchFilter}
      ORDER BY m.sort_order ASC, cp.sort_order ASC, r.response_date DESC
    `, [...params, ...locParams]);

    // Build summary stats
    const total = rows.length;
    let done = 0, notDone = 0, inProgress = 0, postponed = 0, pending = 0;
    const moduleStats = {};

    for (const r of rows) {
      const s = r.system_status || 'PENDING';
      if (s === 'DONE') done++;
      else if (s === 'NOT_DONE') notDone++;
      else if (s === 'IN_PROGRESS') inProgress++;
      else if (s === 'POSTPONED') postponed++;
      else pending++;

      if (!moduleStats[r.module_id]) {
        moduleStats[r.module_id] = { module_name: r.module_name, total: 0, done: 0, not_done: 0, in_progress: 0, postponed: 0, pending: 0 };
      }
      moduleStats[r.module_id].total++;
      if (s === 'DONE') moduleStats[r.module_id].done++;
      else if (s === 'NOT_DONE') moduleStats[r.module_id].not_done++;
      else if (s === 'IN_PROGRESS') moduleStats[r.module_id].in_progress++;
      else if (s === 'POSTPONED') moduleStats[r.module_id].postponed++;
      else moduleStats[r.module_id].pending++;
    }

    const completionPct = total > 0 ? Math.round((done / total) * 100) : 0;
    const attentionItems = rows.filter(r => ['NOT_DONE', 'IN_PROGRESS', 'POSTPONED'].includes(r.system_status));

    return res.json({
      success: true,
      kpis: { total, done, notDone, inProgress, postponed, pending, completionPct },
      moduleStats: Object.values(moduleStats).map(m => ({ ...m, completion_pct: m.total > 0 ? Math.round((m.done / m.total) * 100) : 0 })),
      checkpoints: rows,
      attentionItems,
      dateDisplay: date ? formatDateForDisplay(date) : (fromDate ? `${formatDateForDisplay(fromDate)} – ${formatDateForDisplay(toDate)}` : 'Today')
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── History (date-wise list) ─────────────────────────────────────
exports.getHistory = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '60');
    const offset = parseInt(req.query.offset || '0');
    const { clause: locClause, params: locParams } = await getLocationFilter(req, 'r');

    const [rows] = await db.query(`
      SELECT 
        r.response_date,
        COUNT(DISTINCT cp.id) as total_checkpoints,
        SUM(CASE WHEN r.system_status = 'DONE' THEN 1 ELSE 0 END) as done,
        SUM(CASE WHEN r.system_status = 'NOT_DONE' THEN 1 ELSE 0 END) as not_done,
        SUM(CASE WHEN r.system_status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN r.system_status = 'POSTPONED' THEN 1 ELSE 0 END) as postponed
      FROM mcheck_responses r
      JOIN mcheck_checkpoints cp ON cp.id = r.checkpoint_id AND cp.is_active = 1
      WHERE 1=1 ${locClause}
      GROUP BY r.response_date
      ORDER BY r.response_date DESC
      LIMIT ? OFFSET ?
    `, [...locParams, limit, offset]);

    const history = rows.map(row => {
      const done = parseInt(row.done) || 0;
      const total = parseInt(row.total_checkpoints) || 0;
      return {
        ...row,
        completion_pct: total > 0 ? Math.round((done / total) * 100) : 0,
        date_display: formatDateForDisplay(row.response_date)
      };
    });

    const [countRows] = await db.query(`SELECT COUNT(DISTINCT response_date) as cnt FROM mcheck_responses r WHERE 1=1 ${locClause}`, locParams);
    return res.json({ success: true, history, total: countRows[0]?.cnt || 0 });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Daily Trend (last N days) ────────────────────────────────────
exports.getTrend = async (req, res) => {
  try {
    const days = parseInt(req.query.days || '14');
    const { clause: locClause, params: locParams } = await getLocationFilter(req, 'r');

    const [rows] = await db.query(`
      SELECT 
        dates.d as response_date,
        COUNT(cp.id) as total_checkpoints,
        SUM(CASE WHEN r.system_status = 'DONE' THEN 1 ELSE 0 END) as done
      FROM (
        SELECT DATE_SUB(CURDATE(), INTERVAL n DAY) as d
        FROM (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
              UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9
              UNION SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14
              UNION SELECT 15 UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19
              UNION SELECT 20 UNION SELECT 21 UNION SELECT 22 UNION SELECT 23 UNION SELECT 24
              UNION SELECT 25 UNION SELECT 26 UNION SELECT 27 UNION SELECT 28 UNION SELECT 29) nums
        WHERE n < ?
      ) dates
      CROSS JOIN mcheck_checkpoints cp
      JOIN mcheck_modules m ON m.id = cp.module_id AND m.is_active = 1
      LEFT JOIN mcheck_responses r ON r.checkpoint_id = cp.id AND DATE(r.response_date) = dates.d ${locClause}
      WHERE cp.is_active = 1
      GROUP BY dates.d
      ORDER BY dates.d ASC
    `, [days, ...locParams]);

    const trend = rows.map(row => ({
      date: row.response_date,
      date_display: formatDateForDisplay(row.response_date),
      total: parseInt(row.total_checkpoints) || 40,
      done: parseInt(row.done) || 0,
      completion_pct: row.total_checkpoints > 0 ? Math.round(((parseInt(row.done) || 0) / parseInt(row.total_checkpoints)) * 100) : 0
    }));

    return res.json({ success: true, trend });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Audit Log ────────────────────────────────────────────────────
exports.getAuditLog = async (req, res) => {
  try {
    const { checkpoint_id, response_date } = req.query;
    const [rows] = await db.query(`
      SELECT a.*, cp.checkpoint_title
      FROM mcheck_audit_log a
      JOIN mcheck_checkpoints cp ON cp.id = a.checkpoint_id
      WHERE a.checkpoint_id = ? ${response_date ? 'AND a.response_date = ?' : ''}
      ORDER BY a.changed_at DESC
      LIMIT 50
    `, response_date ? [checkpoint_id, response_date] : [checkpoint_id]);
    return res.json({ success: true, auditLog: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Upload Photo Evidence ────────────────────────────────────────
exports.uploadPhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    const photoUrl = `/uploads/mcheck-photos/${req.file.filename}`;
    return res.json({ success: true, photoUrl });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// Override storage destination for MCheck photo uploads
// (handled by multer 'photo' fieldname → uploads/mcheck-photos via route-specific config)

// ── Admin: Get Modules/Checklists/Checkpoints ────────────────────
exports.adminGetStructure = async (req, res) => {
  try {
    const [modules] = await db.query(`SELECT * FROM mcheck_modules ORDER BY sort_order ASC`);
    const [checklists] = await db.query(`SELECT * FROM mcheck_checklists ORDER BY module_id ASC, sort_order ASC`);
    const [checkpoints] = await db.query(`SELECT * FROM mcheck_checkpoints ORDER BY module_id ASC, sort_order ASC`);
    return res.json({ success: true, modules, checklists, checkpoints });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Admin: Save Module ───────────────────────────────────────────
exports.adminSaveModule = async (req, res) => {
  try {
    const { id, module_name, module_key, description, sort_order, responsible_department, is_active } = req.body;
    if (id) {
      await db.query(`UPDATE mcheck_modules SET module_name=?, module_key=?, description=?, sort_order=?, responsible_department=?, is_active=? WHERE id=?`,
        [module_name, module_key, description, sort_order, responsible_department, is_active !== false ? 1 : 0, id]);
    } else {
      await db.query(`INSERT INTO mcheck_modules (module_name, module_key, description, sort_order, responsible_department) VALUES (?,?,?,?,?)`,
        [module_name, module_key, description, sort_order || 0, responsible_department]);
    }
    return res.json({ success: true, message: 'Module saved' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Admin: Save Checkpoint ───────────────────────────────────────
exports.adminSaveCheckpoint = async (req, res) => {
  try {
    const { id, checklist_id, module_id, checkpoint_title, checkpoint_description, responsible_department, responsible_person, scheduled_time, photo_required, sort_order, is_active } = req.body;
    if (id) {
      await db.query(`UPDATE mcheck_checkpoints SET checklist_id=?, module_id=?, checkpoint_title=?, checkpoint_description=?, responsible_department=?, responsible_person=?, scheduled_time=?, photo_required=?, sort_order=?, is_active=? WHERE id=?`,
        [checklist_id, module_id, checkpoint_title, checkpoint_description, responsible_department, responsible_person, scheduled_time, photo_required ? 1 : 0, sort_order || 0, is_active !== false ? 1 : 0, id]);
    } else {
      await db.query(`INSERT INTO mcheck_checkpoints (checklist_id, module_id, checkpoint_title, checkpoint_description, responsible_department, responsible_person, scheduled_time, photo_required, sort_order) VALUES (?,?,?,?,?,?,?,?,?)`,
        [checklist_id, module_id, checkpoint_title, checkpoint_description, responsible_department, responsible_person, scheduled_time, photo_required ? 1 : 0, sort_order || 0]);
    }
    return res.json({ success: true, message: 'Checkpoint saved' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Admin: Reorder Checkpoints ───────────────────────────────────
exports.adminReorderCheckpoints = async (req, res) => {
  try {
    const { order } = req.body; // Array of { id, sort_order }
    for (const item of order) {
      await db.query(`UPDATE mcheck_checkpoints SET sort_order = ? WHERE id = ?`, [item.sort_order, item.id]);
    }
    return res.json({ success: true, message: 'Order updated' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Export PDF ───────────────────────────────────────────────────
exports.exportPdf = async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');
    const { date, fromDate, toDate, module_id, status } = req.query;
    const { clause: locClause, params: locParams } = await getLocationFilter(req, 'r');

    // Fetch report data (reuse report logic)
    let dateFilter = '', params = [];
    const reportDate = date || getISTDateString();
    dateFilter = `AND r.response_date = ?`;
    params.push(date || reportDate);

    const [rows] = await db.query(`
      SELECT cp.checkpoint_title, cp.responsible_department, cp.scheduled_time,
             m.module_name, cl.checklist_name,
             COALESCE(r.system_status, 'PENDING') as system_status,
             r.compliance_status, r.accuracy, r.remarks, r.corrective_action,
             r.submitted_by, r.submitted_at, r.response_date
      FROM mcheck_checkpoints cp
      JOIN mcheck_modules m ON m.id = cp.module_id AND m.is_active = 1
      JOIN mcheck_checklists cl ON cl.id = cp.checklist_id
      LEFT JOIN mcheck_responses r ON r.checkpoint_id = cp.id ${dateFilter} ${locClause}
      WHERE cp.is_active = 1 ${module_id ? 'AND cp.module_id = ?' : ''} ${status && status !== 'ALL' ? 'AND COALESCE(r.system_status,\'PENDING\') = ?' : ''}
      ORDER BY m.sort_order ASC, cp.sort_order ASC
    `, [...params, ...locParams, ...(module_id ? [module_id] : []), ...(status && status !== 'ALL' ? [status] : [])]);

    const total = rows.length;
    let done = 0, notDone = 0, inProgress = 0, postponed = 0, pending = 0;
    for (const r of rows) {
      if (r.system_status === 'DONE') done++;
      else if (r.system_status === 'NOT_DONE') notDone++;
      else if (r.system_status === 'IN_PROGRESS') inProgress++;
      else if (r.system_status === 'POSTPONED') postponed++;
      else pending++;
    }

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="mcheck-report-${reportDate}.pdf"`);
    doc.pipe(res);

    const navy = '#1E2D4E', gold = '#C9952A', green = '#2d8a4e', red = '#C0272D', orange = '#f97316', gray = '#6b7280';

    // Header
    doc.rect(0, 0, doc.page.width, 90).fill(navy);
    doc.fillColor('#FFFFFF').fontSize(18).font('Helvetica-Bold')
      .text('BSC TEXTILES PVT LTD', 40, 20);
    doc.fontSize(10).font('Helvetica')
      .text('The Textile Mall — Davangere', 40, 43);
    doc.fontSize(14).font('Helvetica-Bold').fillColor(gold)
      .text('DAILY MANAGEMENT CHECKLIST REPORT', 40, 60);

    doc.fillColor('#333').moveDown(2);
    const infoY = 100;
    doc.fontSize(10).font('Helvetica')
      .fillColor(gray)
      .text(`Date: ${formatDateForDisplay(reportDate)}   |   Generated: ${new Date().toLocaleString('en-IN')}   |   Total Checkpoints: ${total}`, 40, infoY);

    doc.moveTo(40, infoY + 18).lineTo(doc.page.width - 40, infoY + 18).stroke(navy);

    // Executive Summary
    doc.moveDown(0.5).fontSize(13).font('Helvetica-Bold').fillColor(navy).text('EXECUTIVE SUMMARY', 40, infoY + 28);

    const summaryY = infoY + 50;
    const colW = (doc.page.width - 80) / 6;
    const metrics = [
      { label: 'TOTAL', value: total, color: navy },
      { label: 'DONE', value: done, color: green },
      { label: 'NOT DONE', value: notDone, color: red },
      { label: 'IN PROGRESS', value: inProgress, color: orange },
      { label: 'POSTPONED', value: postponed, color: '#7c4dbd' },
      { label: 'COMPLETION', value: `${total > 0 ? Math.round((done / total) * 100) : 0}%`, color: green }
    ];
    metrics.forEach((m, i) => {
      const x = 40 + i * colW;
      doc.rect(x, summaryY, colW - 4, 50).fill('#f8f9fa').stroke('#e5e7eb');
      doc.fillColor(m.color).fontSize(18).font('Helvetica-Bold').text(String(m.value), x + 4, summaryY + 6, { width: colW - 12, align: 'center' });
      doc.fillColor(gray).fontSize(7).font('Helvetica').text(m.label, x + 4, summaryY + 30, { width: colW - 12, align: 'center' });
    });

    // Module Summary
    doc.moveDown(0.5).y = summaryY + 65;
    doc.fontSize(13).font('Helvetica-Bold').fillColor(navy).text('MODULE-WISE PERFORMANCE', 40);
    doc.moveDown(0.3);

    const moduleGroups = {};
    for (const r of rows) {
      if (!moduleGroups[r.module_name]) moduleGroups[r.module_name] = { total: 0, done: 0, not_done: 0, in_progress: 0, postponed: 0 };
      moduleGroups[r.module_name].total++;
      if (r.system_status === 'DONE') moduleGroups[r.module_name].done++;
      else if (r.system_status === 'NOT_DONE') moduleGroups[r.module_name].not_done++;
      else if (r.system_status === 'IN_PROGRESS') moduleGroups[r.module_name].in_progress++;
      else if (r.system_status === 'POSTPONED') moduleGroups[r.module_name].postponed++;
    }

    const tableHeaders = ['Module', 'Total', 'Done', 'Not Done', 'In Progress', 'Completion'];
    const colWidths = [160, 50, 50, 65, 75, 75];
    let tx = 40, ty = doc.y;
    doc.rect(tx, ty, doc.page.width - 80, 18).fill(navy);
    let cx = tx;
    tableHeaders.forEach((h, i) => {
      doc.fillColor('#fff').fontSize(8).font('Helvetica-Bold').text(h, cx + 3, ty + 5, { width: colWidths[i] - 4, align: 'left' });
      cx += colWidths[i];
    });
    ty += 18;

    let rowIdx = 0;
    for (const [modName, stats] of Object.entries(moduleGroups)) {
      const rowH = 16;
      doc.rect(tx, ty, doc.page.width - 80, rowH).fill(rowIdx % 2 === 0 ? '#f9fafb' : '#fff');
      cx = tx;
      const rowData = [modName, stats.total, stats.done, stats.not_done, stats.in_progress, `${stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0}%`];
      rowData.forEach((v, i) => {
        const clr = i === 5 ? (stats.done === stats.total ? green : (stats.total > 0 && stats.done / stats.total < 0.5 ? red : orange)) : '#333';
        doc.fillColor(clr).fontSize(8).font(i === 5 ? 'Helvetica-Bold' : 'Helvetica').text(String(v), cx + 3, ty + 4, { width: colWidths[i] - 4, align: 'left' });
        cx += colWidths[i];
      });
      ty += rowH;
      rowIdx++;
    }

    // Detailed Section
    doc.addPage();
    doc.fontSize(13).font('Helvetica-Bold').fillColor(navy).text('DETAILED CHECKLIST REPORT', 40, 40);

    let currentModule = '';
    let dy = 60;
    for (const r of rows) {
      if (dy > doc.page.height - 100) { doc.addPage(); dy = 40; }
      if (r.module_name !== currentModule) {
        currentModule = r.module_name;
        doc.rect(40, dy, doc.page.width - 80, 20).fill(navy);
        doc.fillColor(gold).fontSize(10).font('Helvetica-Bold').text(r.module_name, 44, dy + 5);
        dy += 24;
      }
      const statusColor = r.system_status === 'DONE' ? green : r.system_status === 'NOT_DONE' ? red : r.system_status === 'IN_PROGRESS' ? orange : r.system_status === 'POSTPONED' ? '#7c4dbd' : gray;
      doc.rect(40, dy, doc.page.width - 80, 1).fill('#e5e7eb');
      doc.fillColor('#222').fontSize(8).font('Helvetica-Bold').text(r.checkpoint_title, 44, dy + 4, { width: 280 });
      doc.fillColor(statusColor).fontSize(8).font('Helvetica-Bold').text(r.system_status.replace('_', ' '), 340, dy + 4, { width: 80 });
      doc.fillColor(gray).fontSize(7).font('Helvetica').text(r.compliance_status || '—', 420, dy + 4, { width: 130 });
      dy += 14;
      if (r.remarks) {
        doc.fillColor(gray).fontSize(7).font('Helvetica').text(`Remarks: ${r.remarks}`, 48, dy, { width: doc.page.width - 100 }); dy += 10;
      }
      if (r.corrective_action) {
        doc.fillColor(orange).fontSize(7).font('Helvetica').text(`Action: ${r.corrective_action}`, 48, dy, { width: doc.page.width - 100 }); dy += 10;
      }
    }

    // Attention Section
    const attItems = rows.filter(r => ['NOT_DONE', 'IN_PROGRESS', 'POSTPONED'].includes(r.system_status));
    if (attItems.length > 0) {
      doc.addPage();
      doc.rect(40, 40, doc.page.width - 80, 24).fill(red);
      doc.fillColor('#fff').fontSize(12).font('Helvetica-Bold').text('⚠ ATTENTION REQUIRED', 50, 47);
      let ay = 74;
      for (const r of attItems) {
        if (ay > doc.page.height - 60) { doc.addPage(); ay = 40; }
        doc.rect(40, ay, doc.page.width - 80, 1).fill('#fecaca');
        doc.fillColor('#222').fontSize(8).font('Helvetica-Bold').text(r.checkpoint_title, 44, ay + 4, { width: 220 });
        doc.fillColor(red).fontSize(8).text(r.module_name, 270, ay + 4, { width: 120 });
        const sc = r.system_status === 'NOT_DONE' ? red : r.system_status === 'IN_PROGRESS' ? orange : '#7c4dbd';
        doc.fillColor(sc).font('Helvetica-Bold').text(r.system_status.replace('_', ' '), 400, ay + 4, { width: 90 });
        ay += 16;
        if (r.remarks) { doc.fillColor(gray).fontSize(7).font('Helvetica').text(`Remarks: ${r.remarks}`, 48, ay, { width: doc.page.width - 100 }); ay += 10; }
      }
    }

    // Footer on last page
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fillColor(gray).fontSize(7).text(`BSC Textiles Pvt Ltd · Daily MCheck Report · Page ${i + 1} of ${pageCount} · CONFIDENTIAL`, 40, doc.page.height - 25, { align: 'center' });
    }

    doc.end();
  } catch (err) {
    console.error('[MCheck PDF Export Error]', err.message);
    if (!res.headersSent) res.status(500).json({ success: false, error: err.message });
  }
};

// ── Export Excel ─────────────────────────────────────────────────
exports.exportExcel = async (req, res) => {
  try {
    const ExcelJS = require('exceljs');
    const { date, fromDate, toDate, module_id, status } = req.query;
    const { clause: locClause, params: locParams } = await getLocationFilter(req, 'r');
    const reportDate = date || getISTDateString();

    let dateFilter = `AND r.response_date = ?`;
    let params = [date || reportDate];
    if (!date && fromDate && toDate) {
      dateFilter = `AND r.response_date BETWEEN ? AND ?`;
      params = [fromDate, toDate];
    }

    const [rows] = await db.query(`
      SELECT cp.checkpoint_title, cp.responsible_department, cp.responsible_person, cp.scheduled_time,
             m.module_name, cl.checklist_name,
             COALESCE(r.system_status, 'PENDING') as system_status,
             r.compliance_status, r.accuracy, r.remarks, r.corrective_action,
             r.submitted_by, r.submitted_at, r.updated_by, r.updated_at, r.response_date
      FROM mcheck_checkpoints cp
      JOIN mcheck_modules m ON m.id = cp.module_id AND m.is_active = 1
      JOIN mcheck_checklists cl ON cl.id = cp.checklist_id
      LEFT JOIN mcheck_responses r ON r.checkpoint_id = cp.id ${dateFilter} ${locClause}
      WHERE cp.is_active = 1 ${module_id ? 'AND cp.module_id = ?' : ''} ${status && status !== 'ALL' ? 'AND COALESCE(r.system_status,\'PENDING\') = ?' : ''}
      ORDER BY m.sort_order ASC, cp.sort_order ASC
    `, [...params, ...locParams, ...(module_id ? [module_id] : []), ...(status && status !== 'ALL' ? [status] : [])]);

    const [histRows] = await db.query(`
      SELECT r.response_date, COUNT(*) as total,
             SUM(CASE WHEN r.system_status='DONE' THEN 1 ELSE 0 END) as done,
             SUM(CASE WHEN r.system_status='NOT_DONE' THEN 1 ELSE 0 END) as not_done,
             SUM(CASE WHEN r.system_status='IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress,
             SUM(CASE WHEN r.system_status='POSTPONED' THEN 1 ELSE 0 END) as postponed
      FROM mcheck_responses r
      JOIN mcheck_checkpoints cp ON cp.id = r.checkpoint_id AND cp.is_active = 1
      WHERE 1=1 ${locClause}
      GROUP BY r.response_date ORDER BY r.response_date DESC LIMIT 30
    `, locParams);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'BSC SMG CRM';
    workbook.created = new Date();

    const navyHex = '1E2D4E', goldHex = 'C9952A', greenHex = '2d8a4e', redHex = 'C0272D';
    const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + navyHex } };
    const headerAlignment = { horizontal: 'center', vertical: 'middle' };

    const addHeaderRow = (sheet, cols) => {
      const row = sheet.addRow(cols.map(c => c.header));
      row.eachCell(cell => {
        cell.font = headerFont;
        cell.fill = headerFill;
        cell.alignment = headerAlignment;
        cell.border = { bottom: { style: 'thin', color: { argb: 'FF' + goldHex } } };
      });
      row.height = 22;
      cols.forEach((c, i) => { sheet.getColumn(i + 1).width = c.width || 20; });
    };

    // Sheet 1: Executive Summary
    const s1 = workbook.addWorksheet('Executive Summary');
    s1.addRow(['BSC TEXTILES PVT LTD — DAILY MANAGEMENT CHECKLIST REPORT']).font = { bold: true, size: 14, color: { argb: 'FF' + navyHex } };
    s1.addRow([`Date: ${formatDateForDisplay(reportDate)} | Generated: ${new Date().toLocaleString('en-IN')}`]).font = { italic: true, size: 10, color: { argb: 'FF888888' } };
    s1.addRow([]);
    const total = rows.length;
    let done = 0, notDone = 0, inProg = 0, post = 0;
    for (const r of rows) {
      if (r.system_status === 'DONE') done++;
      else if (r.system_status === 'NOT_DONE') notDone++;
      else if (r.system_status === 'IN_PROGRESS') inProg++;
      else if (r.system_status === 'POSTPONED') post++;
    }
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    [['Metric', 'Value'], ['Total Checkpoints', total], ['Done', done], ['Not Done', notDone], ['In Progress', inProg], ['Postponed', post], ['Pending', total - done - notDone - inProg - post], ['Overall Completion %', `${pct}%`]].forEach((r, i) => {
      const row = s1.addRow(r);
      if (i === 0) { row.eachCell(c => { c.font = headerFont; c.fill = headerFill; }); }
      if (i % 2 === 0 && i > 0) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } }; });
    });
    s1.getColumn(1).width = 30; s1.getColumn(2).width = 20;

    // Sheet 2: Module Summary
    const s2 = workbook.addWorksheet('Module Summary');
    addHeaderRow(s2, [
      { header: 'Module', width: 28 }, { header: 'Total', width: 12 }, { header: 'Done', width: 12 },
      { header: 'Not Done', width: 14 }, { header: 'In Progress', width: 16 }, { header: 'Postponed', width: 14 }, { header: 'Pending', width: 14 }, { header: 'Completion %', width: 16 }
    ]);
    const modSummary = {};
    for (const r of rows) {
      if (!modSummary[r.module_name]) modSummary[r.module_name] = { total: 0, done: 0, not_done: 0, in_progress: 0, postponed: 0 };
      modSummary[r.module_name].total++;
      if (r.system_status === 'DONE') modSummary[r.module_name].done++;
      else if (r.system_status === 'NOT_DONE') modSummary[r.module_name].not_done++;
      else if (r.system_status === 'IN_PROGRESS') modSummary[r.module_name].in_progress++;
      else if (r.system_status === 'POSTPONED') modSummary[r.module_name].postponed++;
    }
    let ridx = 0;
    for (const [mn, ms] of Object.entries(modSummary)) {
      const pend = ms.total - ms.done - ms.not_done - ms.in_progress - ms.postponed;
      const p = ms.total > 0 ? Math.round((ms.done / ms.total) * 100) : 0;
      const row = s2.addRow([mn, ms.total, ms.done, ms.not_done, ms.in_progress, ms.postponed, pend, `${p}%`]);
      if (ridx % 2 === 0) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } }; });
      ridx++;
    }

    // Sheet 3: Detailed Checkpoints
    const s3 = workbook.addWorksheet('Detailed Checkpoints');
    addHeaderRow(s3, [
      { header: 'Date', width: 14 }, { header: 'Module', width: 24 }, { header: 'Checklist', width: 30 },
      { header: 'Checkpoint', width: 40 }, { header: 'Responsible Dept', width: 22 }, { header: 'Responsible Person', width: 22 },
      { header: 'Compliance Status', width: 22 }, { header: 'Accuracy', width: 18 }, { header: 'System Status', width: 18 },
      { header: 'Remarks', width: 40 }, { header: 'Corrective Action', width: 40 },
      { header: 'Updated By', width: 18 }, { header: 'Updated Date', width: 16 }, { header: 'Updated Time', width: 14 }
    ]);
    rows.forEach((r, i) => {
      const upd = r.updated_at ? new Date(r.updated_at) : null;
      const row = s3.addRow([
        r.response_date, r.module_name, r.checklist_name, r.checkpoint_title,
        r.responsible_department || '', r.responsible_person || '',
        r.compliance_status || '', r.accuracy || '', r.system_status,
        r.remarks || '', r.corrective_action || '',
        r.updated_by || r.submitted_by || '', upd ? upd.toLocaleDateString('en-IN') : '', upd ? upd.toLocaleTimeString('en-IN') : ''
      ]);
      if (i % 2 === 0) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } }; });
      const statusCell = row.getCell(9);
      if (r.system_status === 'DONE') statusCell.font = { bold: true, color: { argb: 'FF' + greenHex } };
      else if (r.system_status === 'NOT_DONE') statusCell.font = { bold: true, color: { argb: 'FF' + redHex } };
      else if (r.system_status === 'IN_PROGRESS') statusCell.font = { bold: true, color: { argb: 'FFF97316' } };
    });

    // Sheet 4: Attention Required
    const s4 = workbook.addWorksheet('Attention Required');
    addHeaderRow(s4, [
      { header: 'Checkpoint', width: 40 }, { header: 'Module', width: 24 }, { header: 'Status', width: 16 },
      { header: 'Responsible Dept', width: 22 }, { header: 'Remarks', width: 40 }, { header: 'Corrective Action', width: 40 }, { header: 'Date', width: 14 }
    ]);
    const attRows = rows.filter(r => ['NOT_DONE', 'IN_PROGRESS', 'POSTPONED'].includes(r.system_status));
    attRows.forEach((r, i) => {
      const row = s4.addRow([r.checkpoint_title, r.module_name, r.system_status, r.responsible_department || '', r.remarks || '', r.corrective_action || '', r.response_date]);
      if (i % 2 === 0) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF5F5' } }; });
    });

    // Sheet 5: Daily History
    const s5 = workbook.addWorksheet('Daily History');
    addHeaderRow(s5, [
      { header: 'Date', width: 16 }, { header: 'Total', width: 12 }, { header: 'Done', width: 12 },
      { header: 'Not Done', width: 14 }, { header: 'In Progress', width: 16 }, { header: 'Postponed', width: 14 }, { header: 'Completion %', width: 16 }
    ]);
    histRows.forEach((r, i) => {
      const d = parseInt(r.done) || 0, tot = parseInt(r.total) || 0;
      const row = s5.addRow([r.response_date, tot, d, parseInt(r.not_done) || 0, parseInt(r.in_progress) || 0, parseInt(r.postponed) || 0, `${tot > 0 ? Math.round((d / tot) * 100) : 0}%`]);
      if (i % 2 === 0) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } }; });
    });

    // Sheet 6: Time & Department
    const s6 = workbook.addWorksheet('Time & Department');
    addHeaderRow(s6, [
      { header: 'Scheduled Time', width: 18 }, { header: 'Department', width: 26 }, { header: 'Done', width: 12 },
      { header: 'Total', width: 12 }, { header: 'Not Done', width: 14 }, { header: 'Completion %', width: 16 }
    ]);
    const timeDeptMap = {};
    for (const r of rows) {
      const key = `${r.scheduled_time || 'Daily'}__${r.responsible_department || 'General'}`;
      if (!timeDeptMap[key]) timeDeptMap[key] = { time: r.scheduled_time || 'Daily', dept: r.responsible_department || 'General', total: 0, done: 0, not_done: 0 };
      timeDeptMap[key].total++;
      if (r.system_status === 'DONE') timeDeptMap[key].done++;
      else if (r.system_status === 'NOT_DONE') timeDeptMap[key].not_done++;
    }
    let i6 = 0;
    for (const v of Object.values(timeDeptMap)) {
      const p = v.total > 0 ? Math.round((v.done / v.total) * 100) : 0;
      const row = s6.addRow([v.time, v.dept, v.done, v.total, v.not_done, `${p}%`]);
      if (i6 % 2 === 0) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } }; });
      i6++;
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="mcheck-report-${reportDate}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[MCheck Excel Export Error]', err.message);
    if (!res.headersSent) res.status(500).json({ success: false, error: err.message });
  }
};
