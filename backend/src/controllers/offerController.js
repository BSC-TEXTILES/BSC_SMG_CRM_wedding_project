const db = require('../config/db');
const { successRes, errorRes } = require('../utils/response');
const { logAction } = require('../utils/logger');
const userSyncService = require('../services/userSyncService');

/**
 * When a candidate is marked Joined an Employee Directory entry AND a login
 * account must exist. `users` is the single source of truth, so the account is
 * created through the shared synchronization service - the exact same code path
 * used by User Management and the legacy backfill, which guarantees the two
 * dashboards can never disagree.
 */
const autoProvisionUser = async (appNo, options = {}) => {
  const result = await userSyncService.provisionUserForCandidate(appNo, options);
  if (result.created) {
    console.log(`[Offer] Employee account provisioned for ${appNo} (user #${result.userId}, ${result.username})`);
  }
  return result;
};

const getOffers = async (req, res) => {
  try {
    // Bidirectional auto-synchronization between selection_offers and candidates for Joined status
    try {
      await db.query(`
        UPDATE selection_offers so
        JOIN candidates c ON so.app_no = c.app_no
        SET so.status = 'Joined'
        WHERE LOWER(TRIM(c.status)) = 'joined' AND LOWER(TRIM(so.status)) != 'joined'
      `);
      await db.query(`
        UPDATE candidates c
        JOIN selection_offers so ON c.app_no = so.app_no
        SET c.status = 'Joined'
        WHERE LOWER(TRIM(so.status)) = 'joined' AND LOWER(TRIM(c.status)) != 'joined'
      `);
    } catch (e) {}

    const [rows] = await db.query(`
      SELECT 
        so.*,
        he.hr_score_json,
        he.assigned_score_json,
        c.salary,
        c.section as cand_section,
        c.department as cand_department,
        c.status as cand_status
      FROM selection_offers so
      LEFT JOIN hr_evaluations he ON so.app_no = he.app_no
      LEFT JOIN candidates c ON so.app_no = c.app_no
      ORDER BY so.created_at DESC
    `);

    const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
    const iso = (d) => {
      if (!d) return '';
      if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return '';
      const yyyy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    const colors = ['navy', 'gold', 'green', 'red', 'purple', 'teal'];

    const offers = rows.map((r) => {
      const initials = (r.name || 'XX').split(' ').slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();
      const colorIndex = ((r.name || 'X').charCodeAt(0) + ((r.name || 'X').charCodeAt(1) || 0)) % colors.length;

      const createdDate = new Date(r.created_at || Date.now());
      // Preserve actual status — Joined if either table is Joined
      const isJoined = (r.status || '').toLowerCase().trim() === 'joined' || (r.cand_status || '').toLowerCase().trim() === 'joined';
      const status = isJoined ? 'Joined' : (r.status || 'Shortlisted');
      const joinedDateObj = r.actual_doj ? new Date(r.actual_doj) : (r.updated_at ? new Date(r.updated_at) : createdDate);
      const rawDate = isJoined
        ? (isNaN(joinedDateObj.getTime()) ? createdDate.getTime() : joinedDateObj.getTime())
        : (isNaN(createdDate.getTime()) ? Date.now() : createdDate.getTime());

      return {
        appNo: r.app_no,
        name: r.name,
        initials,
        color: colors[colorIndex],
        desig: r.designation,
        noticePd: r.notice_period || '',
        estDoj: iso(r.est_doj),
        actualDoj: iso(r.actual_doj),
        call1: fmt(r.call1_date),
        call1Remarks: r.call1_remarks || '',
        call2: fmt(r.call2_date),
        call2Remarks: r.call2_remarks || '',
        confirm: fmt(r.confirm_date),
        confirmRemarks: r.confirm_remarks || '',
        status,
        salary: r.salary || '',
        remarks: r.remarks || '',
        section: r.cand_section || r.section || '',
        department: r.cand_department || r.department || '',
        hrScore: (() => { try { return r.hr_score_json ? JSON.parse(r.hr_score_json) : null; } catch { return null; } })(),
        assignedScore: (() => { try { return r.assigned_score_json ? JSON.parse(r.assigned_score_json) : null; } catch { return null; } })(),
        createdAt: r.created_at || null,
        rawDate,
        date: fmt(r.created_at)
      };
    });

    return res.json({ offers, total: offers.length });
  } catch (err) {
    return res.json({ offers: [], total: 0 });
  }
};

const logOfferCall = async (req, res) => {
  try {
    const { appNo, callNo, date, remarks } = req.body;
    if (!appNo || !callNo) return errorRes(res, 'AppNo and callNo are required', [], 400);

    const callDate = date ? new Date(date) : new Date();
    const updFields = ['updated_at = ?'];
    const params = [new Date()];

    if (callNo === 1) {
      updFields.push('call1_date = ?');
      params.push(callDate);
      if (remarks) { updFields.push('call1_remarks = ?'); params.push(remarks); }
    } else if (callNo === 2) {
      updFields.push('call2_date = ?');
      params.push(callDate);
      if (remarks) { updFields.push('call2_remarks = ?'); params.push(remarks); }
    } else if (callNo === 3) {
      updFields.push('confirm_date = ?');
      params.push(callDate);
      if (remarks) { updFields.push('confirm_remarks = ?'); params.push(remarks); }
    }

    params.push(appNo);
    await db.query(`UPDATE selection_offers SET ${updFields.join(', ')} WHERE app_no = ?`, params);

    await logAction(req.user ? req.user.username : 'HR', 'LOG_OFFER_CALL', 'OFFER', { appNo, callNo });

    return res.json({ success: true });
  } catch (err) {
    return errorRes(res, 'Failed to log offer call', [err.message], 500);
  }
};

const updateOfferDetails = async (req, res) => {
  try {
    const { appNo, noticePd, estDoj, salaryOffered, department, otherSection, finalDesignation, remarks, status } = req.body;
    if (!appNo) return errorRes(res, 'Application number is required', [], 400);

    const updFields = ['updated_at = ?'];
    const params = [new Date()];

    if (noticePd) { updFields.push('notice_period = ?'); params.push(noticePd); }
    if (estDoj) { updFields.push('est_doj = ?'); params.push(new Date(estDoj)); }
    if (finalDesignation) { updFields.push('designation = ?'); params.push(finalDesignation); }
    if (department) { updFields.push('department = ?'); params.push(department + (otherSection ? ` - ${otherSection}` : '')); }
    if (remarks !== undefined) { updFields.push('remarks = ?'); params.push(remarks); }
    if (status) { updFields.push('status = ?'); params.push(status); }

    params.push(appNo);
    await db.query(`UPDATE selection_offers SET ${updFields.join(', ')} WHERE app_no = ?`, params);

    // Sync with candidates table
    const candUpd = ['updated_at = ?'];
    const candParams = [new Date()];
    if (noticePd) { candUpd.push('notice_period = ?'); candParams.push(noticePd); }
    if (estDoj) { candUpd.push('offered_doj = ?'); candParams.push(new Date(estDoj)); }
    if (salaryOffered) { candUpd.push('salary = ?'); candParams.push(salaryOffered); }
    if (finalDesignation) { candUpd.push('designation = ?'); candParams.push(finalDesignation); }
    if (department) { candUpd.push('department = ?'); candParams.push(department + (otherSection ? ` - ${otherSection}` : '')); }
    if (remarks !== undefined) { candUpd.push('remarks = ?'); candParams.push(remarks); }
    if (status) { candUpd.push('status = ?'); candParams.push(status); }
    candParams.push(appNo);
    await db.query(`UPDATE candidates SET ${candUpd.join(', ')} WHERE app_no = ?`, candParams);

    await logAction(req.user ? req.user.username : 'HR', 'UPDATE_OFFER_DETAILS', 'OFFER', { appNo, noticePd, estDoj, salaryOffered, status });

    return res.json({ success: true });
  } catch (err) {
    return errorRes(res, 'Failed to update offer details', [err.message], 500);
  }
};

const acceptOffer = async (req, res) => {
  try {
    const { appNo, remarks, joiningDate } = req.body;
    if (!appNo) return errorRes(res, 'Application number is required', [], 400);

    const now = new Date();
    const doj = joiningDate ? new Date(joiningDate) : now;
    const dojVal = isNaN(doj.getTime()) ? now : doj;

    // Set both tables to Joined
    await db.query(`UPDATE selection_offers SET status = 'Joined', actual_doj = ?, updated_at = ? WHERE app_no = ?`, [dojVal, now, appNo]);
    await db.query(`UPDATE candidates SET status = 'Joined', offered_doj = ?, updated_at = ? WHERE app_no = ?`, [dojVal, now, appNo]);

    await logAction(req.user ? req.user.username : 'HR', 'ACCEPT_OFFER_JOINED', 'OFFER', { appNo, remarks, joiningDate: dojVal });
    await autoProvisionUser(appNo, { grantedBy: req.user ? req.user.username : 'HR' });

    return res.json({ success: true });
  } catch (err) {
    return errorRes(res, 'Failed to accept offer', [err.message], 500);
  }
};

const rejectOffer = async (req, res) => {
  try {
    const { appNo, remarks } = req.body;

    const now = new Date();
    await db.query(`UPDATE selection_offers SET status = 'Offer Rejected', remarks = COALESCE(?, remarks), updated_at = ? WHERE app_no = ?`, [remarks || null, now, appNo]);
    await db.query(`UPDATE candidates SET status = 'Offer Rejected', updated_at = ? WHERE app_no = ?`, [now, appNo]);

    await logAction(req.user ? req.user.username : 'HR', 'REJECT_OFFER', 'OFFER', { appNo, remarks });

    return res.json({ success: true });
  } catch (err) {
    return errorRes(res, 'Failed to reject offer', [err.message], 500);
  }
};

const markJoined = async (req, res) => {
  try {
    const { appNo, joiningDate } = req.body;
    if (!joiningDate) return errorRes(res, 'Joining date is required', [], 400);

    const now = new Date();
    const doj = new Date(joiningDate);

    await db.query(`UPDATE selection_offers SET status = 'Joined', actual_doj = ?, updated_at = ? WHERE app_no = ?`, [doj, now, appNo]);
    await db.query(`UPDATE candidates SET status = 'Joined', updated_at = ? WHERE app_no = ?`, [now, appNo]);

    await logAction(req.user ? req.user.username : 'HR', 'MARK_JOINED', 'OFFER', { appNo, joiningDate });
    await autoProvisionUser(appNo, { grantedBy: req.user ? req.user.username : 'HR' });

    return res.json({ success: true });
  } catch (err) {
    return errorRes(res, 'Failed to mark joined', [err.message], 500);
  }
};

const updateOfferStatus = async (req, res) => {
  try {
    const { appNo, status, remarks } = req.body;
    const now = new Date();
    await db.query(`UPDATE selection_offers SET status = ?, remarks = COALESCE(?, remarks), updated_at = ? WHERE app_no = ?`, [status, remarks || null, now, appNo]);
    await db.query(`UPDATE candidates SET status = ?, updated_at = ? WHERE app_no = ?`, [status, now, appNo]);
    await logAction(req.user ? req.user.username : 'HR', 'UPDATE_OFFER_STATUS', 'OFFER', { appNo, status, remarks });
    return res.json({ success: true });
  } catch (err) {
    return errorRes(res, 'Failed to update offer status', [err.message], 500);
  }
};

const createDirectOffer = async (req, res) => {
  try {
    const { appNo, salaryOffered, estDoj, designation, department, section, remarks } = req.body;
    if (!salaryOffered) return errorRes(res, 'Offered salary is mandatory', [], 400);

    const now = new Date();
    const doj = estDoj ? new Date(estDoj) : null;

    // If offer already exists, update it instead of erroring
    const [existing] = await db.query(`SELECT id FROM selection_offers WHERE app_no = ?`, [appNo]);

    const [candRows] = await db.query(`SELECT name, designation, department FROM candidates WHERE app_no = ?`, [appNo]);
    if (candRows.length === 0) return errorRes(res, 'Candidate not found', [], 404);
    const c = candRows[0];

    const finalDesig = designation || c.designation;
    const finalDept = department || c.department;

    if (existing.length > 0) {
      // Update existing offer
      await db.query(
        `UPDATE selection_offers SET designation = ?, department = ?, est_doj = ?, status = 'Shortlisted', remarks = COALESCE(?, remarks), updated_at = ? WHERE app_no = ?`,
        [finalDesig, finalDept, doj, remarks || null, now, appNo]
      );
    } else {
      // Insert new offer
      await db.query(
        `INSERT INTO selection_offers (app_no, name, designation, department, notice_period, est_doj, status, created_at, updated_at, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [appNo, c.name, finalDesig, finalDept, null, doj, 'Shortlisted', now, now, remarks || null]
      );
    }

    // Update candidates table — status = Shortlisted (not Offer Sent)
    await db.query(
      `UPDATE candidates SET status = 'Shortlisted', salary = ?, designation = ?, department = ?, section = COALESCE(?, section), offered_doj = ?, remarks = COALESCE(?, remarks), updated_at = ? WHERE app_no = ?`,
      [salaryOffered, finalDesig, finalDept, section || null, doj, remarks || null, now, appNo]
    );

    await logAction(req.user ? req.user.username : 'HR', 'SHORTLIST_OFFER', 'OFFER', { appNo, salaryOffered, estDoj, department, section });

    return res.json({ success: true });
  } catch (err) {
    return errorRes(res, 'Failed to create direct offer', [err.message], 500);
  }
};

module.exports = {
  getOffers,
  logOfferCall,
  updateOfferDetails,
  acceptOffer,
  rejectOffer,
  markJoined,
  updateOfferStatus,
  createDirectOffer
};
