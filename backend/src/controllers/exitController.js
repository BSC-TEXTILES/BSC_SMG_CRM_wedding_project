const db = require('../config/db');
const { successRes, errorRes } = require('../utils/response');
const { logAction } = require('../utils/logger');
const { getLocationFilter, getEffectiveLocationId } = require('../middleware/auth');

const DEFAULT_EXIT_ITEMS = [
  { section: '1. Resignation & Notice Period', item: 'Resignation Letter / Email received & accepted', mandatory: true },
  { section: '1. Resignation & Notice Period', item: 'Notice period served / Buyout approved', mandatory: true },
  { section: '2. Asset & Clearance Handover', item: 'Store Uniforms / ID Card / Access Cards returned', mandatory: true },
  { section: '2. Asset & Clearance Handover', item: 'Company Assets / POS Login & System Credentials revoked', mandatory: true },
  { section: '3. Finance & Accounts FnF', item: 'Pending Salary / Incentive calculation completed', mandatory: true },
  { section: '3. Finance & Accounts FnF', item: 'No Dues Certificate signed by Accounts & HR', mandatory: true },
  { section: '4. Documentation & Exit Interview', item: 'Exit Interview conducted & feedback logged', mandatory: false },
  { section: '4. Documentation & Exit Interview', item: 'Relieving Letter & Experience Certificate issued', mandatory: true }
];

const getExitList = async (req, res) => {
  try {
    const { clause: locClause, params: locParams } = await getLocationFilter(req, 'exit_records');
    const [rows] = await db.query(`SELECT * FROM exit_records WHERE 1=1 ${locClause} ORDER BY created_at DESC`, locParams);

    const records = rows.map((r) => {
      const lwdDate = new Date(r.lwd);
      return {
        recordId: r.record_id,
        empName: r.emp_name,
        desig: r.designation,
        lwd: lwdDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        progress: r.progress,
        status: r.status,
        done: Math.round((r.progress / 100) * DEFAULT_EXIT_ITEMS.length),
        total: DEFAULT_EXIT_ITEMS.length
      };
    });

    return res.json({ records });
  } catch (err) {
    return res.json({ records: [] });
  }
};

const createExit = async (req, res) => {
  try {
    const { empName, desig, lwd } = req.body;
    if (!empName || !lwd) {
      return errorRes(res, 'Employee name and last working day are required', [], 400);
    }

    const recordId = 'EX-' + Date.now().toString().slice(-6);
    const lwdDate = new Date(lwd);
    const locId = injectLocationId(req) || getEffectiveLocationId(req) || (req.user && req.user.locationId) || null;

    const [resArr] = await db.query(
      `INSERT INTO exit_records (record_id, emp_name, designation, lwd, progress, status, location_id)
       VALUES (?, ?, ?, ?, 0, 'Pending', ?)`,
      [recordId, empName, desig || 'Staff', lwdDate, locId]
    );

    const exitId = resArr.insertId;

    for (let i = 0; i < DEFAULT_EXIT_ITEMS.length; i++) {
      const item = DEFAULT_EXIT_ITEMS[i];
      await db.query(
        `INSERT INTO exit_items (exit_id, record_id, section, item_id, item, mandatory)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [exitId, recordId, item.section, `item_${i + 1}`, item.item, item.mandatory]
      );
    }

    await logAction(req.user ? req.user.username : 'HR', 'CREATE_EXIT', 'EXIT', { recordId, empName });

    return res.json({ success: true, recordId });
  } catch (err) {
    return errorRes(res, 'Failed to create exit process', [err.message], 500);
  }
};

const getExitItems = async (req, res) => {
  try {
    const recordId = req.query.recordId || req.body.recordId;
    const [rows] = await db.query(`SELECT * FROM exit_items WHERE record_id = ? ORDER BY id ASC`, [recordId]);

    const items = rows.map((r) => ({
      itemId: r.item_id,
      section: r.section,
      item: r.item,
      mandatory: !!r.mandatory,
      status: r.status || '',
      remarks: r.remarks || '',
      doneBy: r.done_by || '',
      doneAt: r.done_at ? new Date(r.done_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''
    }));

    const sections = {};
    items.forEach((item) => {
      if (!sections[item.section]) sections[item.section] = [];
      sections[item.section].push(item);
    });

    return res.json({ items, sections });
  } catch (err) {
    return res.json({ items: [], sections: {} });
  }
};

const updateExitItem = async (req, res) => {
  try {
    const { recordId, itemId, status, remarks, doneBy } = req.body;
    const user = doneBy || (req.user ? req.user.username : 'HR');

    const now = status ? new Date() : null;
    await db.query(
      `UPDATE exit_items SET status = ?, remarks = ?, done_by = ?, done_at = ? WHERE record_id = ? AND item_id = ?`,
      [status, remarks || null, status ? user : null, now, recordId, itemId]
    );

    // Recalculate progress
    const [itemRows] = await db.query(`SELECT status FROM exit_items WHERE record_id = ?`, [recordId]);
    const doneCount = itemRows.filter((r) => r.status === 'Done' || r.status === 'NA').length;
    const progress = itemRows.length > 0 ? Math.round((doneCount / itemRows.length) * 100) : 0;

    let newStatus = progress > 0 ? 'In Progress' : 'Pending';
    if (progress === 100) newStatus = 'Completed';

    await db.query(`UPDATE exit_records SET progress = ?, status = ? WHERE record_id = ?`, [progress, newStatus, recordId]);

    return res.json({ success: true, progress });
  } catch (err) {
    return errorRes(res, 'Failed to update exit item', [err.message], 500);
  }
};

const completeExit = async (req, res) => {
  try {
    const recordId = req.body.recordId;
    await db.query(`UPDATE exit_records SET progress = 100, status = 'Completed' WHERE record_id = ?`, [recordId]);

    await logAction(req.user ? req.user.username : 'HR', 'COMPLETE_EXIT', 'EXIT', { recordId });

    return res.json({ success: true });
  } catch (err) {
    return errorRes(res, 'Failed to complete exit process', [err.message], 500);
  }
};

module.exports = {
  getExitList,
  createExit,
  getExitItems,
  updateExitItem,
  completeExit
};
