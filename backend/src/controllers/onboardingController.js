const db = require('../config/db');
const { successRes, errorRes } = require('../utils/response');
const { logAction } = require('../utils/logger');
const { getLocationFilter, getEffectiveLocationId } = require('../middleware/auth');

const DEFAULT_ONBOARDING_ITEMS = [
  { section: '1. Documentation & Verification', item: 'Aadhar Card & ID Proof collected', mandatory: true },
  { section: '1. Documentation & Verification', item: 'Educational Certificates & Marksheets verified', mandatory: true },
  { section: '1. Documentation & Verification', item: 'Previous Employment Relieving / Experience Letter', mandatory: false },
  { section: '1. Documentation & Verification', item: 'Bank Account Details & Cancelled Cheque collected', mandatory: true },
  { section: '2. Store & Team Induction', item: 'Store Tour & Department Allocation done', mandatory: true },
  { section: '2. Store & Team Induction', item: 'Introduction to Store Manager & Section In-charges', mandatory: true },
  { section: '3. Systems & Uniform', item: 'Uniform / Dress Code issued', mandatory: true },
  { section: '3. Systems & Uniform', item: 'Biometric / Attendance system registration done', mandatory: true }
];

const getOnboardingList = async (req, res) => {
  try {
    const { clause: locClause, params: locParams } = await getLocationFilter(req, 'onboarding_records');
    const [rows] = await db.query(`SELECT * FROM onboarding_records WHERE 1=1 ${locClause} ORDER BY created_at DESC`, locParams);

    const records = rows.map((r) => {
      const joiningDate = new Date(r.joining_date);
      const days = Math.max(1, Math.floor((Date.now() - joiningDate.getTime()) / 86400000) + 1);

      return {
        recordId: r.record_id,
        empName: r.emp_name,
        desig: r.designation,
        joiningDate: joiningDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        days,
        progress: r.progress,
        status: r.status,
        done: Math.round((r.progress / 100) * DEFAULT_ONBOARDING_ITEMS.length),
        total: DEFAULT_ONBOARDING_ITEMS.length
      };
    });

    return res.json({ records });
  } catch (err) {
    return res.json({ records: [] });
  }
};

const createOnboarding = async (req, res) => {
  try {
    const { empName, desig, joiningDate } = req.body;
    if (!empName || !desig || !joiningDate) {
      return errorRes(res, 'Employee name, designation, and joining date are required', [], 400);
    }

    const recordId = 'OB-' + Date.now().toString().slice(-6);
    const jDate = new Date(joiningDate);
    const locId = injectLocationId(req) || getEffectiveLocationId(req) || (req.user && req.user.locationId) || null;

    const [resArr] = await db.query(
      `INSERT INTO onboarding_records (record_id, emp_name, designation, joining_date, progress, status, location_id)
       VALUES (?, ?, ?, ?, 0, 'On Track', ?)`,
      [recordId, empName, desig, jDate, locId]
    );

    const onboardingId = resArr.insertId;

    for (let i = 0; i < DEFAULT_ONBOARDING_ITEMS.length; i++) {
      const item = DEFAULT_ONBOARDING_ITEMS[i];
      await db.query(
        `INSERT INTO onboarding_items (onboarding_id, record_id, section, item_id, item, mandatory)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [onboardingId, recordId, item.section, `item_${i + 1}`, item.item, item.mandatory]
      );
    }

    await logAction(req.user ? req.user.username : 'HR', 'CREATE_ONBOARDING', 'ONBOARDING', { recordId, empName });

    return res.json({ success: true, recordId });
  } catch (err) {
    return errorRes(res, 'Failed to create onboarding', [err.message], 500);
  }
};

const getOnboardingItems = async (req, res) => {
  try {
    const recordId = req.query.recordId || req.body.recordId;
    const [rows] = await db.query(`SELECT * FROM onboarding_items WHERE record_id = ? ORDER BY id ASC`, [recordId]);

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

const updateOnboardingItem = async (req, res) => {
  try {
    const { recordId, itemId, status, remarks, doneBy } = req.body;
    const user = doneBy || (req.user ? req.user.username : 'HR');

    const now = status ? new Date() : null;
    await db.query(
      `UPDATE onboarding_items SET status = ?, remarks = ?, done_by = ?, done_at = ? WHERE record_id = ? AND item_id = ?`,
      [status, remarks || null, status ? user : null, now, recordId, itemId]
    );

    // Recalculate progress
    const [itemRows] = await db.query(`SELECT status FROM onboarding_items WHERE record_id = ?`, [recordId]);
    const doneCount = itemRows.filter((r) => r.status === 'Yes' || r.status === 'NA').length;
    const progress = itemRows.length > 0 ? Math.round((doneCount / itemRows.length) * 100) : 0;

    let newStatus = 'On Track';
    if (progress === 100) newStatus = 'Completed';

    await db.query(`UPDATE onboarding_records SET progress = ?, status = ? WHERE record_id = ?`, [progress, newStatus, recordId]);

    return res.json({ success: true, progress });
  } catch (err) {
    return errorRes(res, 'Failed to update onboarding item', [err.message], 500);
  }
};

const completeOnboarding = async (req, res) => {
  try {
    const recordId = req.body.recordId;
    await db.query(`UPDATE onboarding_records SET progress = 100, status = 'Completed' WHERE record_id = ?`, [recordId]);

    await logAction(req.user ? req.user.username : 'HR', 'COMPLETE_ONBOARDING', 'ONBOARDING', { recordId });

    return res.json({ success: true });
  } catch (err) {
    return errorRes(res, 'Failed to complete onboarding', [err.message], 500);
  }
};

module.exports = {
  getOnboardingList,
  createOnboarding,
  getOnboardingItems,
  updateOnboardingItem,
  completeOnboarding
};
