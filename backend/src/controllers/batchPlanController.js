const db = require('../config/db');
const { getLocationFilter, injectLocationId } = require('../middleware/auth');

/**
 * Batch Plan & Weaving Module Controller
 * Multi-location isolated batch and trainee cohort management.
 */

// ── GET KPI Summary ──────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const { clause: locClause, params: locParams } = await getLocationFilter(req, 'b');

    const [batchCounts] = await db.query(`
      SELECT 
        COUNT(*) as totalBatches,
        SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as activeBatches,
        SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completedBatches,
        SUM(CASE WHEN status = 'Draft' THEN 1 ELSE 0 END) as draftBatches
      FROM batches b
      WHERE 1=1 ${locClause}
    `, locParams);

    const [memberCounts] = await db.query(`
      SELECT 
        COUNT(*) as totalMembers,
        SUM(CASE WHEN m.status = 'In Progress' THEN 1 ELSE 0 END) as inProgress,
        SUM(CASE WHEN m.status = 'Graduated' THEN 1 ELSE 0 END) as graduated,
        SUM(CASE WHEN m.status = 'Dropped' THEN 1 ELSE 0 END) as dropped
      FROM batch_group_members m
      JOIN batches b ON b.id = m.batch_id
      WHERE 1=1 ${locClause}
    `, locParams);

    const b = batchCounts[0] || {};
    const m = memberCounts[0] || {};

    return res.json({
      success: true,
      stats: {
        totalBatches: Number(b.totalBatches) || 0,
        activeBatches: Number(b.activeBatches) || 0,
        completedBatches: Number(b.completedBatches) || 0,
        draftBatches: Number(b.draftBatches) || 0,
        totalTrainees: Number(m.totalMembers) || 0,
        activeTrainees: Number(m.inProgress) || 0,
        graduatedTrainees: Number(m.graduated) || 0,
        droppedTrainees: Number(m.dropped) || 0
      }
    });
  } catch (err) {
    console.error('[BatchPlan getStats Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── GET Batches List ──────────────────────────────────────────
exports.getBatches = async (req, res) => {
  try {
    const { clause: locClause, params: locParams } = await getLocationFilter(req, 'b');
    const { status, search } = req.query;

    let sql = `
      SELECT 
        b.*,
        l.location_name,
        l.location_code,
        (SELECT COUNT(*) FROM batch_groups bg WHERE bg.batch_id = b.id) as group_count,
        (SELECT COUNT(*) FROM batch_group_members bgm WHERE bgm.batch_id = b.id) as total_trainees,
        (SELECT COUNT(*) FROM batch_group_members bgm WHERE bgm.batch_id = b.id AND bgm.status = 'Graduated') as graduated_count
      FROM batches b
      LEFT JOIN locations l ON l.id = b.location_id
      WHERE 1=1 ${locClause}
    `;
    const params = [...locParams];

    if (status && status !== 'all') {
      sql += ' AND b.status = ?';
      params.push(status);
    }

    if (search) {
      sql += ' AND (b.batch_number LIKE ? OR b.batch_name LIKE ? OR b.trainer_name LIKE ? OR b.department LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    sql += ' ORDER BY b.start_date DESC, b.id DESC';

    const [rows] = await db.query(sql, params);
    return res.json({ success: true, batches: rows });
  } catch (err) {
    console.error('[BatchPlan getBatches Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── GET Single Batch with Groups & Members ───────────────────
exports.getBatchById = async (req, res) => {
  try {
    const { id } = req.params;
    const { clause: locClause, params: locParams } = await getLocationFilter(req, 'b');

    const [batches] = await db.query(`
      SELECT b.*, l.location_name, l.location_code
      FROM batches b
      LEFT JOIN locations l ON l.id = b.location_id
      WHERE b.id = ? ${locClause}
    `, [id, ...locParams]);

    if (!batches || batches.length === 0) {
      return res.status(404).json({ success: false, message: 'Batch not found or access denied' });
    }

    const batch = batches[0];

    // Get groups
    const [groups] = await db.query(`
      SELECT * FROM batch_groups WHERE batch_id = ? ORDER BY id ASC
    `, [id]);

    // Get members
    const [members] = await db.query(`
      SELECT * FROM batch_group_members WHERE batch_id = ? ORDER BY id ASC
    `, [id]);

    // Organize members by group
    const membersByGroup = {};
    for (const m of members) {
      if (!membersByGroup[m.group_id]) membersByGroup[m.group_id] = [];
      membersByGroup[m.group_id].push(m);
    }

    const groupsWithMembers = groups.map(g => ({
      ...g,
      members: membersByGroup[g.id] || []
    }));

    return res.json({
      success: true,
      batch: {
        ...batch,
        groups: groupsWithMembers
      }
    });
  } catch (err) {
    console.error('[BatchPlan getBatchById Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── CREATE Batch ─────────────────────────────────────────────
exports.createBatch = async (req, res) => {
  try {
    const { batch_number, batch_name, start_date, target_end_date, status, department, trainer_name, notes } = req.body;
    const locationId = injectLocationId(req) || (req.user && req.user.locationId) || null;

    if (!batch_name || !start_date) {
      return res.status(400).json({ success: false, message: 'Batch Name and Start Date are required' });
    }

    // Auto-generate batch number if not provided: BSC-BP-YYYYMM-XX
    let bNum = batch_number;
    if (!bNum) {
      const ym = new Date(start_date).toISOString().slice(0, 7).replace('-', '');
      const [last] = await db.query(`SELECT id FROM batches ORDER BY id DESC LIMIT 1`);
      const nextId = (last[0]?.id || 0) + 1;
      bNum = `BP-${ym}-${String(nextId).padStart(3, '0')}`;
    }

    const [result] = await db.query(`
      INSERT INTO batches (
        batch_number, batch_name, location_id, start_date, target_end_date,
        status, department, trainer_name, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      bNum,
      batch_name,
      locationId,
      start_date,
      target_end_date || null,
      status || 'Draft',
      department || 'Weaving',
      trainer_name || '',
      notes || '',
      req.user?.username || 'System'
    ]);

    return res.json({
      success: true,
      message: 'Batch created successfully',
      batchId: result.insertId,
      batch_number: bNum
    });
  } catch (err) {
    console.error('[BatchPlan createBatch Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── UPDATE Batch ─────────────────────────────────────────────
exports.updateBatch = async (req, res) => {
  try {
    const { id } = req.params;
    const { clause: locClause, params: locParams } = await getLocationFilter(req, 'batches');
    const { batch_name, start_date, target_end_date, actual_end_date, status, department, trainer_name, notes } = req.body;

    const [existing] = await db.query(`SELECT id FROM batches WHERE id = ? ${locClause}`, [id, ...locParams]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Batch not found or access denied' });
    }

    await db.query(`
      UPDATE batches 
      SET batch_name = COALESCE(?, batch_name),
          start_date = COALESCE(?, start_date),
          target_end_date = ?,
          actual_end_date = ?,
          status = COALESCE(?, status),
          department = COALESCE(?, department),
          trainer_name = COALESCE(?, trainer_name),
          notes = COALESCE(?, notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [batch_name, start_date, target_end_date || null, actual_end_date || null, status, department, trainer_name, notes, id]);

    return res.json({ success: true, message: 'Batch updated successfully' });
  } catch (err) {
    console.error('[BatchPlan updateBatch Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── DELETE Batch ─────────────────────────────────────────────
exports.deleteBatch = async (req, res) => {
  try {
    const { id } = req.params;
    const { clause: locClause, params: locParams } = await getLocationFilter(req, 'batches');

    const [existing] = await db.query(`SELECT id FROM batches WHERE id = ? ${locClause}`, [id, ...locParams]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Batch not found or access denied' });
    }

    await db.query('DELETE FROM batches WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Batch deleted successfully' });
  } catch (err) {
    console.error('[BatchPlan deleteBatch Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── ADD Group to Batch ───────────────────────────────────────
exports.addGroup = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { group_name, mentor_name, target_count, notes } = req.body;

    if (!group_name) {
      return res.status(400).json({ success: false, message: 'Group Name is required' });
    }

    const [result] = await db.query(`
      INSERT INTO batch_groups (batch_id, group_name, mentor_name, target_count, notes)
      VALUES (?, ?, ?, ?, ?)
    `, [batchId, group_name, mentor_name || '', target_count || 0, notes || '']);

    return res.json({
      success: true,
      message: 'Group added successfully',
      groupId: result.insertId
    });
  } catch (err) {
    console.error('[BatchPlan addGroup Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── UPDATE Group ─────────────────────────────────────────────
exports.updateGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { group_name, mentor_name, target_count, notes } = req.body;

    await db.query(`
      UPDATE batch_groups
      SET group_name = COALESCE(?, group_name),
          mentor_name = COALESCE(?, mentor_name),
          target_count = COALESCE(?, target_count),
          notes = COALESCE(?, notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [group_name, mentor_name, target_count, notes, groupId]);

    return res.json({ success: true, message: 'Group updated successfully' });
  } catch (err) {
    console.error('[BatchPlan updateGroup Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── DELETE Group ─────────────────────────────────────────────
exports.deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    await db.query('DELETE FROM batch_groups WHERE id = ?', [groupId]);
    return res.json({ success: true, message: 'Group deleted successfully' });
  } catch (err) {
    console.error('[BatchPlan deleteGroup Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── ADD Member to Group ──────────────────────────────────────
exports.addMember = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { batch_id, candidate_id, employee_id, member_name, phone, status, join_date, remarks } = req.body;

    if (!member_name) {
      return res.status(400).json({ success: false, message: 'Member Name is required' });
    }

    const [result] = await db.query(`
      INSERT INTO batch_group_members (
        group_id, batch_id, candidate_id, employee_id, member_name, phone, status, join_date, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      groupId,
      batch_id,
      candidate_id || null,
      employee_id || null,
      member_name,
      phone || '',
      status || 'Assigned',
      join_date || new Date().toISOString().split('T')[0],
      remarks || ''
    ]);

    return res.json({
      success: true,
      message: 'Member added successfully',
      memberId: result.insertId
    });
  } catch (err) {
    console.error('[BatchPlan addMember Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── UPDATE Member Status & Details ───────────────────────────
exports.updateMember = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { status, completion_date, remarks, group_id } = req.body;

    await db.query(`
      UPDATE batch_group_members
      SET status = COALESCE(?, status),
          completion_date = COALESCE(?, completion_date),
          remarks = COALESCE(?, remarks),
          group_id = COALESCE(?, group_id),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status, completion_date, remarks, group_id, memberId]);

    return res.json({ success: true, message: 'Member status updated' });
  } catch (err) {
    console.error('[BatchPlan updateMember Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── DELETE Member ────────────────────────────────────────────
exports.deleteMember = async (req, res) => {
  try {
    const { memberId } = req.params;
    await db.query('DELETE FROM batch_group_members WHERE id = ?', [memberId]);
    return res.json({ success: true, message: 'Member removed successfully' });
  } catch (err) {
    console.error('[BatchPlan deleteMember Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
