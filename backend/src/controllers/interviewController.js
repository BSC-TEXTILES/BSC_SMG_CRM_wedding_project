const db = require('../config/db');
const { successRes, errorRes } = require('../utils/response');
const { logAction } = require('../utils/logger');
const crypto = require('crypto');

const generateToken = () => {
  return crypto.randomBytes(16).toString('hex');
};

const saveCallStep = async (req, res) => {
  try {
    const { appNo, candidate, desig, step, date, remarks, doneBy } = req.body;
    const user = doneBy || (req.user ? req.user.username : 'HR');

    if (!appNo || !step || !date) {
      return errorRes(res, 'AppNo, step, and date are required', [], 400);
    }

    const [cRows] = await db.query(`SELECT id, name, designation FROM candidates WHERE app_no = ?`, [appNo]);
    if (cRows.length === 0) {
      return errorRes(res, 'Candidate record missing or corrupted. Please delete this interview and recreate.', [], 400);
    }
    const cand = cRows[0];

    const statusMap = { 1: '1st Call', 2: 'Interview Scheduled' };
    const newStatus = statusMap[step] || 'Scheduled';

    const [schRows] = await db.query(`SELECT id FROM interview_schedules WHERE app_no = ?`, [appNo]);
    const callDate = new Date(date);

    if (schRows.length > 0) {
      const updFields = ['step = ?', 'status = ?', 'updated_at = ?'];
      const params = [step, newStatus, new Date()];

      if (step === 1) {
        updFields.push('call1_date = ?', 'call1_remarks = ?');
        params.push(callDate, remarks);
      } else if (step === 2) {
        updFields.push('interview_date = ?', 'interview_remarks = ?');
        params.push(callDate, remarks);
      }

      params.push(appNo);
      await db.query(`UPDATE interview_schedules SET ${updFields.join(', ')} WHERE app_no = ?`, params);
    } else {
      const colNames = ['candidate_id', 'app_no', 'candidate_name', 'designation', 'step', 'status'];
      const colVals = [cand.id, appNo, candidate || cand.name, desig || cand.designation, step, newStatus];

      if (step === 1) {
        colNames.push('call1_date', 'call1_remarks');
        colVals.push(callDate, remarks);
      } else if (step === 2) {
        colNames.push('interview_date', 'interview_remarks');
        colVals.push(callDate, remarks);
      }

      const placeholders = colNames.map(() => '?').join(', ');
      await db.query(`INSERT INTO interview_schedules (${colNames.join(', ')}) VALUES (${placeholders})`, colVals);
    }

    await db.query(`UPDATE candidates SET status = ?, updated_at = ? WHERE app_no = ?`, [newStatus, new Date(), appNo]);

    // Activity log
    const actLabelMap = { 1: '1st Follow-up Call', 2: 'Interview Scheduled' };
    const actIconMap = { 1: '📞', 2: '📅' };
    await db.query(
      `INSERT INTO candidate_activities (candidate_id, app_no, action_type, icon, label, remarks, by_user, color)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [cand.id, appNo, `step_${step}`, actIconMap[step], actLabelMap[step], remarks, user, step === 2 ? 'navy' : 'gold']
    );

    await logAction(user, 'SAVE_CALL_STEP', 'INTERVIEW', { appNo, step, newStatus });

    return res.json({ success: true, newStatus });
  } catch (err) {
    console.error('saveCallStep error:', err);
    return errorRes(res, 'Failed to save call step', [err.message], 500);
  }
};

const getCallStatus = async (req, res) => {
  try {
    const appNo = req.query.appNo || req.body.appNo;
    const [rows] = await db.query(`SELECT * FROM interview_schedules WHERE app_no = ?`, [appNo]);

    if (rows.length === 0) {
      return res.json({ step: 0, status: 'Not Started' });
    }

    const r = rows[0];
    const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

    return res.json({
      step: r.step || 0,
      status: r.status || '',
      call1Date: fmt(r.call1_date),
      call1Remarks: r.call1_remarks || '',
      call2Date: fmt(r.call2_date),
      call2Remarks: r.call2_remarks || '',
      interviewDate: fmt(r.interview_date),
      interviewRemarks: r.interview_remarks || ''
    });
  } catch (err) {
    return res.json({ step: 0, status: 'Not Started' });
  }
};

const getInterviews = async (req, res) => {
  try {
    const [candRows] = await db.query(
      `SELECT app_no, name as candidate_name, designation, status, created_at FROM candidates WHERE status IN ('Interview Scheduled', 'Interviewed') ORDER BY updated_at DESC`
    );

    const [evalRows] = await db.query(`SELECT * FROM hr_evaluations`);
    const scoreMap = {};
    evalRows.forEach((r) => {
      scoreMap[r.app_no] = {
        hrScore: (() => { try { return r.hr_score_json ? JSON.parse(r.hr_score_json) : null; } catch { return null; } })(),
        assignedScore: (() => { try { return r.assigned_score_json ? JSON.parse(r.assigned_score_json) : null; } catch { return null; } })(),
        isNewRole: !!r.is_new_role,
        suggestedDesig: r.suggested_designation || null,
        suggestionReason: r.suggestion_reason || null
      };
    });

    const [tokenRows] = await db.query(`SELECT * FROM interview_tokens`);
    const tokenMap = {};
    tokenRows.forEach((r) => {
      tokenMap[r.app_no] = {
        token: r.token,
        assignedName: r.assigned_name,
        assignedDesig: r.assigned_designation,
        tokenStatus: r.status
      };
    });

    const interviews = candRows.map((r) => {
      const sc = scoreMap[r.app_no] || {};
      const tk = tokenMap[r.app_no] || {};
      const colors = ['navy', 'gold', 'green', 'red', 'purple', 'teal'];
      const colorIndex = (r.candidate_name.charCodeAt(0) + (r.candidate_name.charCodeAt(1) || 0)) % colors.length;
      const initials = r.candidate_name.split(' ').slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();

      const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

      const createdDate = new Date(r.created_at || Date.now());

      return {
        appNo: r.app_no,
        candidate: r.candidate_name,
        initials,
        color: colors[colorIndex],
        desig: r.designation,
        call1Date: '—',
        call1Remarks: '',
        call2Date: '—',
        call2Remarks: '',
        interviewDate: fmt(r.created_at),
        interviewRemarks: '',
        status: r.status,
        hrScore: sc.hrScore || null,
        assignedScore: sc.assignedScore || null,
        isNewRole: sc.isNewRole || false,
        suggestedDesig: sc.suggestedDesig || null,
        suggestionReason: sc.suggestionReason || null,
        assignedName: tk.assignedName || '',
        assignedDesig: tk.assignedDesig || '',
        tokenStatus: tk.tokenStatus || '',
        token: tk.token || '',
        createdAt: r.created_at || null,
        rawDate: isNaN(createdDate.getTime()) ? Date.now() : createdDate.getTime()
      };
    });

    return res.json({ interviews });
  } catch (err) {
    // Log the actual DB error with full details for diagnostics
    console.error('[getInterviews ERROR] DB query failed:', err.code, err.message);
    // Return HTTP 200 with empty array to maintain backward API compatibility
    // Candidate CRM (Candidates.tsx) checks (res && res.interviews) before rendering
    return res.json({ interviews: [] });
  }
};

const getInterviewQuestions = async (req, res) => {
  try {
    const round = req.query.round || req.body.round || 'HR';
    const desig = req.query.desig || req.body.desig || '';

    let roundVariants = [round];
    if (round === 'Round 2') roundVariants = ['Round 2', 'FM', 'ASSIGNED'];
    if (round === 'HR') roundVariants = ['HR'];

    const [rows] = await db.query(`SELECT * FROM interview_questions WHERE active = TRUE`);

    let filtered = rows.filter((r) => {
      const rm = !r.round || r.round === 'All' || roundVariants.includes(r.round);
      const dm = !r.designation || r.designation === 'All' || !desig || r.designation === desig;
      return rm && dm;
    });

    const specific = filtered.filter((r) => r.designation === desig);
    if (specific.length > 0) filtered = specific;

    const questions = filtered.map((r) => ({
      id: r.q_id.toString(),
      text: r.question,
      type: r.type || 'score',
      max: r.max_score || 10,
      options: r.options ? r.options.split(',').map((o) => o.trim()) : [],
      round: r.round || 'HR'
    }));

    return res.json({ questions });
  } catch (err) {
    return res.json({ questions: [] });
  }
};

const saveScore = async (req, res) => {
  try {
    const { appNo, round, scores, offeredSalary, offeredDoj } = req.body;
    const user = req.user ? req.user.username : 'HR';

    if (!scores) {
      return errorRes(res, 'Scores are missing', [], 400);
    }

    const [cRows] = await db.query(`SELECT id FROM candidates WHERE app_no = ?`, [appNo]);
    if (cRows.length === 0) return errorRes(res, 'Candidate record missing or corrupted. Please delete this interview and recreate.', [], 400);
    const candId = cRows[0].id;

    // Update Salary and DOJ if provided
    const updFields = [];
    const updVals = [];
    if (offeredSalary !== undefined && offeredSalary !== '') {
      updFields.push('salary = ?');
      updVals.push(offeredSalary);
    }
    if (offeredDoj !== undefined && offeredDoj !== '') {
      updFields.push('offered_doj = ?');
      updVals.push(offeredDoj);
    }
    
    if (updFields.length > 0) {
      updVals.push(appNo);
      await db.query(`UPDATE candidates SET ${updFields.join(', ')} WHERE app_no = ?`, updVals);
    }

    const scoreStr = JSON.stringify(scores);
    const now = new Date();

    const [evalRows] = await db.query(`SELECT id FROM hr_evaluations WHERE app_no = ?`, [appNo]);

    if (evalRows.length > 0) {
      const colName = round === 'ASSIGNED' || round === 'Round 2' ? 'assigned_score_json' : 'hr_score_json';
      await db.query(`UPDATE hr_evaluations SET ${colName} = ?, updated_at = ? WHERE app_no = ?`, [scoreStr, now, appNo]);
    } else {
      const colHR = round === 'ASSIGNED' || round === 'Round 2' ? null : scoreStr;
      const colAssigned = round === 'ASSIGNED' || round === 'Round 2' ? scoreStr : null;
      await db.query(
        `INSERT INTO hr_evaluations (candidate_id, app_no, hr_score_json, assigned_score_json) VALUES (?, ?, ?, ?)`,
        [candId, appNo, colHR, colAssigned]
      );
    }

    // Activity log
    const rndLabel = round === 'ASSIGNED' || round === 'Round 2' ? 'Round 2 Assessment' : 'HR Round 1 Assessment';
    const rndIcon = round === 'ASSIGNED' || round === 'Round 2' ? '🤝' : '🎯';
    const rndColor = round === 'ASSIGNED' || round === 'Round 2' ? 'teal' : 'navy';
    
    await db.query(
      `INSERT INTO candidate_activities (candidate_id, app_no, action_type, icon, label, score, max_score, remarks, by_user, color)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [candId, appNo, round === 'ASSIGNED' || round === 'Round 2' ? 'r2_score' : 'hr_score', rndIcon, rndLabel, scores.total || 0, scores.maxTotal || 60, scores.remarks, user, rndColor]
    );

    await logAction(user, 'SAVE_SCORE', 'INTERVIEW', { appNo, total: scores.total, round });

    return res.json({ success: true });
  } catch (err) {
    return errorRes(res, 'Failed to save score', [err.message], 500);
  }
};

const generateInterviewToken = async (req, res) => {
  try {
    const { appNo, candidate, desig, assignedName, assignedDesig } = req.body;
    const [cRows] = await db.query(`SELECT id FROM candidates WHERE app_no = ?`, [appNo]);
    if (cRows.length === 0) return errorRes(res, 'Candidate record missing or corrupted. Please delete this interview and recreate.', [], 400);

    const token = generateToken();

    await db.query(`UPDATE interview_tokens SET status = 'replaced' WHERE app_no = ? AND status = 'pending'`, [appNo]);
    await db.query(
      `INSERT INTO interview_tokens (token, candidate_id, app_no, candidate_name, designation, assigned_name, assigned_designation, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [token, cRows[0].id, appNo, candidate, desig, assignedName, assignedDesig]
    );

    const baseUrl = req.protocol + '://' + req.get('host');
    const link = `${baseUrl}/interview-form.html?token=${token}`;

    await logAction(req.user ? req.user.username : 'HR', 'GENERATE_INTERVIEW_TOKEN', 'INTERVIEW', { appNo, assignedName });

    return res.json({ success: true, token, link });
  } catch (err) {
    return errorRes(res, 'Failed to generate token', [err.message], 500);
  }
};

const getInterviewByToken = async (req, res) => {
  try {
    const token = req.query.token || req.body.token;
    const [rows] = await db.query(`SELECT * FROM interview_tokens WHERE token = ?`, [token]);

    if (rows.length === 0) return res.json({ success: false, error: 'Invalid or expired link' });
    const r = rows[0];

    if (r.status === 'completed') return res.json({ success: false, error: 'This interview has already been submitted' });

    const qRes = await getInterviewQuestions({ query: { round: 'Round 2', desig: r.designation } }, { json: (d) => d });
    let questions = qRes.questions || [];

    const hrQRes = await getInterviewQuestions({ query: { round: 'HR', desig: r.designation } }, { json: (d) => d });

    const [hrRows] = await db.query(`SELECT hr_score_json FROM hr_evaluations WHERE app_no = ?`, [r.app_no]);
    let hrScores = null;
    if (hrRows.length > 0 && hrRows[0].hr_score_json) {
      try { hrScores = JSON.parse(hrRows[0].hr_score_json); } catch (e) {}
    }

    const [cRows] = await db.query(`SELECT q1, q2, q3, q4, remarks FROM candidates WHERE app_no = ?`, [r.app_no]);
    let candidateInfo = null;
    if (cRows.length > 0) {
      candidateInfo = cRows[0];
    }

    return res.json({
      success: true,
      token: r.token,
      appNo: r.app_no,
      candidate: r.candidate_name,
      desig: r.designation,
      assignedName: r.assigned_name,
      assignedDesig: r.assigned_designation,
      questions,
      hrQuestions: hrQRes.questions || [],
      hrScores,
      candidateInfo
    });
  } catch (err) {
    return res.json({ success: false, error: err.message });
  }
};

const submitInterviewScore = async (req, res) => {
  try {
    const { token, scores, total, remarks } = req.body;

    const [tokenRows] = await db.query(`SELECT * FROM interview_tokens WHERE token = ?`, [token]);
    if (tokenRows.length === 0) return errorRes(res, 'Token not found', [], 404);
    const r = tokenRows[0];

    const scoreObj = { scores, total, remarks };
    const scoreStr = JSON.stringify(scoreObj);
    const now = new Date();

    await db.query(
      `UPDATE interview_tokens SET status = 'completed', completed_at = ?, scores_json = ?, remarks = ? WHERE id = ?`,
      [now, scoreStr, remarks, r.id]
    );

    const [evalRows] = await db.query(`SELECT id FROM hr_evaluations WHERE app_no = ?`, [r.app_no]);
    if (evalRows.length > 0) {
      await db.query(`UPDATE hr_evaluations SET assigned_score_json = ?, updated_at = ? WHERE app_no = ?`, [scoreStr, now, r.app_no]);
    } else {
      await db.query(
        `INSERT INTO hr_evaluations (candidate_id, app_no, assigned_score_json) VALUES (?, ?, ?)`,
        [r.candidate_id, r.app_no, scoreStr]
      );
    }

    // Activity log
    await db.query(
      `INSERT INTO candidate_activities (candidate_id, app_no, action_type, icon, label, score, max_score, remarks, assigned_by, color)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [r.candidate_id, r.app_no, 'r2_score', '🤝', 'Round 2 Assessment', total, 60, remarks, `${r.assigned_name} (${r.assigned_designation})`, 'teal']
    );

    await logAction(r.assigned_name, 'SUBMIT_INTERVIEW_SCORE', 'INTERVIEW', { appNo: r.app_no, total });

    return res.json({ success: true });
  } catch (err) {
    return errorRes(res, 'Failed to submit score', [err.message], 500);
  }
};

const approveSelection = async (req, res) => {
  try {
    const { appNo, candidate, desig, remarks, probation, doneBy, salaryOffered, estDoj, finalDesignation, department, noticePd } = req.body;
    const user = doneBy || (req.user ? req.user.username : 'Store Manager');

    const [cRows] = await db.query(`SELECT * FROM candidates WHERE app_no = ?`, [appNo]);
    if (cRows.length === 0) return errorRes(res, 'Candidate record missing or corrupted. Please delete this interview and recreate.', [], 400);
    const cand = cRows[0];
    
    const useDesig = finalDesignation || desig || cand.designation;

    const now = new Date();
    
    const candUpd = ['status = ?', 'updated_at = ?'];
    const candParams = ['Selected', now];
    if (salaryOffered) { candUpd.push('salary = ?'); candParams.push(salaryOffered); }
    if (estDoj) { candUpd.push('offered_doj = ?'); candParams.push(new Date(estDoj)); }
    if (useDesig) { candUpd.push('designation = ?'); candParams.push(useDesig); }
    if (department) { candUpd.push('department = ?'); candParams.push(department); }
    if (noticePd) { candUpd.push('notice_period = ?'); candParams.push(noticePd); }
    candParams.push(appNo);

    await db.query(`UPDATE candidates SET ${candUpd.join(', ')} WHERE app_no = ?`, candParams);

    const [hrRows] = await db.query(`SELECT * FROM hr_evaluations WHERE app_no = ?`, [appNo]);
    let hrScore = 0;
    let assignedScore = 0;

    if (hrRows.length > 0) {
      const hr = hrRows[0];
      if (hr.hr_score_json) { try { hrScore = JSON.parse(hr.hr_score_json).total || 0; } catch (e) {} }
      if (hr.assigned_score_json) { try { assignedScore = JSON.parse(hr.assigned_score_json).total || 0; } catch (e) {} }
    }

    await db.query(`DELETE FROM selected_candidates WHERE app_no = ?`, [appNo]);
    await db.query(
      `INSERT INTO selected_candidates (candidate_id, app_no, name, phone, designation, source, hr_score, assigned_score, total_score, decision_date, decision_by, is_probation, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [cand.id, appNo, candidate || cand.name, cand.phone, useDesig, cand.source, hrScore, assignedScore, hrScore + assignedScore, now, user, probation ? 1 : 0, remarks]
    );

    const [offRows] = await db.query(`SELECT id FROM selection_offers WHERE app_no = ?`, [appNo]);
    if (offRows.length === 0) {
      await db.query(
        `INSERT INTO selection_offers (candidate_id, app_no, name, designation, department, notice_period, est_doj, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [cand.id, appNo, candidate || cand.name, useDesig, department || null, noticePd || null, estDoj ? new Date(estDoj) : null, 'Pending Accept']
      );
    } else {
      const offUpd = [];
      const offParams = [];
      if (useDesig) { offUpd.push('designation = ?'); offParams.push(useDesig); }
      if (department) { offUpd.push('department = ?'); offParams.push(department); }
      if (noticePd) { offUpd.push('notice_period = ?'); offParams.push(noticePd); }
      if (estDoj) { offUpd.push('est_doj = ?'); offParams.push(new Date(estDoj)); }
      if (offUpd.length > 0) {
        offParams.push(appNo);
        await db.query(`UPDATE selection_offers SET ${offUpd.join(', ')} WHERE app_no = ?`, offParams);
      }
    }

    // Activity log
    await db.query(
      `INSERT INTO candidate_activities (candidate_id, app_no, action_type, icon, label, by_user, remarks, color)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [cand.id, appNo, 'selected', '✅', probation ? 'Selected (Probation)' : 'Selected by Manager', user, remarks, 'green']
    );

    await logAction(user, 'APPROVE_SELECTION', 'INTERVIEW', { appNo, probation });

    return res.json({ success: true });
  } catch (err) {
    return errorRes(res, 'Failed to approve selection', [err.message], 500);
  }
};

const rejectCandidate = async (req, res) => {
  try {
    const { appNo, remarks, doneBy } = req.body;
    const user = doneBy || (req.user ? req.user.username : 'HR');

    const [cRows] = await db.query(`SELECT * FROM candidates WHERE app_no = ?`, [appNo]);
    if (cRows.length === 0) return errorRes(res, 'Candidate record missing or corrupted. Please delete this interview and recreate.', [], 400);
    const cand = cRows[0];

    const now = new Date();
    await db.query(`UPDATE candidates SET status = 'Rejected', remarks = ?, updated_at = ? WHERE app_no = ?`, [remarks, now, appNo]);

    const [hrRows] = await db.query(`SELECT hr_score_json FROM hr_evaluations WHERE app_no = ?`, [appNo]);
    const stage = hrRows.length > 0 && hrRows[0].hr_score_json ? 'Post Interview' : 'Pre Interview';

    await db.query(`DELETE FROM rejected_candidates WHERE app_no = ?`, [appNo]);
    await db.query(
      `INSERT INTO rejected_candidates (candidate_id, app_no, name, phone, designation, source, stage, rejection_date, rejected_by, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [cand.id, appNo, cand.name, cand.phone, cand.designation, cand.source, stage, now, user, remarks]
    );

    await logAction(user, 'REJECT_CANDIDATE', 'INTERVIEW', { appNo, stage, remarks });

    return res.json({ success: true });
  } catch (err) {
    return errorRes(res, 'Failed to reject candidate', [err.message], 500);
  }
};

const getSelectedCandidates = async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT * FROM selected_candidates ORDER BY decision_date DESC`);
    const candidates = rows.map((r) => ({
      appNo: r.app_no,
      name: r.name,
      phone: r.phone,
      desig: r.designation,
      source: r.source || '',
      hrScore: r.hr_score,
      assignedScore: r.assigned_score,
      totalScore: r.total_score,
      decisionDate: new Date(r.decision_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      remarks: r.remarks || ''
    }));
    return res.json({ candidates });
  } catch (err) {
    return res.json({ candidates: [] });
  }
};

const getRejectedCandidates = async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT * FROM rejected_candidates ORDER BY rejection_date DESC`);
    const candidates = rows.map((r) => ({
      appNo: r.app_no,
      name: r.name,
      phone: r.phone,
      desig: r.designation,
      source: r.source || '',
      stage: r.stage,
      rejectionDate: new Date(r.rejection_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      remarks: r.remarks || ''
    }));
    return res.json({ candidates });
  } catch (err) {
    return res.json({ candidates: [] });
  }
};

module.exports = {
  saveCallStep,
  getCallStatus,
  getInterviews,
  getInterviewQuestions,
  saveScore,
  generateInterviewToken,
  getInterviewByToken,
  submitInterviewScore,
  approveSelection,
  rejectCandidate,
  getSelectedCandidates,
  getRejectedCandidates
};
