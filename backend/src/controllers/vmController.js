/**
 * BSC Textiles CRM — Visual Merchandising (VM) Controller
 * Complete VM Checklist, VM Dashboard Analytics, Audit History, Live Data & Photo Linking
 */

const pool = require('../config/db');
const crypto = require('crypto');
const { errorRes } = require('../utils/response');
const { logAction } = require('../utils/logger');
const { getLocationFilter } = require('../middleware/auth');
const realtimeService = require('../services/realtimeService');
const { getISTDateString } = require('../utils/dates');
const vmAuditAccess = require('../services/vmAuditAccess');
const vmHistory = require('../services/vmAuditHistory');
const { assertLocationAccess, resolveAuditLocationId, mapVmPhoto, getVmPhotos } = require('./vmPhotoController');

function getUUID() {
  return 'vm_' + crypto.randomBytes(12).toString('hex');
}

// Statuses of vmsubmissions.status. Draft rows are in-progress work: they are never
// counted as an audit until they are submitted.
const VM_STATUS = { DRAFT: 'Draft', COMPLETED: 'Completed', REVIEW: 'Review' };
// An audit at or above this score is "Completed"; anything lower is filed as "Review".
const VM_PASS_MARK = 80;
// The guided flow offers exactly these shifts; anything else would silently create a
// second history row the store never performs.
const VM_SHIFT_WHITELIST = ['Opening', 'Mid-Day', 'Closing'];
// Roles that may write an audit they did not create (the rest can only touch their
// own). Resolved by the same service the photo routes and the navigation read, so a
// store role is never told "you may inspect the floor" here and "you may not" there.

/** Canonical answer value from anything the client sends. */
function normalizeScore(raw) {
  const v = String(raw === null || raw === undefined ? '' : raw).trim().toLowerCase();
  if (v === 'pass') return 'Pass';
  if (v === 'fail' || v === 'failed') return 'Fail';
  if (v === 'na' || v === 'n/a' || v === 'n.a' || v === 'not applicable') return 'NA';
  return null;
}

/**
 * The score of a set of answers.
 *
 * N/A is NOT a failure. It is a checkpoint that did not apply to this section, so it
 * is excluded from the denominator entirely: graded = passed + failed and
 * percent = passed / graded. Anything the auditor never touched is `unrated`, which
 * is a third bucket again — it neither passes nor fails nor is skipped.
 */
function countAnswers(rows = []) {
  let passed = 0;
  let failed = 0;
  let na = 0;
  (rows || []).forEach(e => {
    const s = normalizeScore(e.score);
    if (s === 'Pass') passed++;
    else if (s === 'Fail') failed++;
    else if (s === 'NA') na++;
  });
  return { passed, failed, na };
}

function buildScore({ passed, failed, na, totalQuestions }) {
  const graded = passed + failed;
  const rated = graded + na;
  const total = Number(totalQuestions || 0);
  return {
    percent: graded > 0 ? Math.round((passed / graded) * 100) : 0,
    passed,
    failed,
    notApplicable: na,
    unrated: Math.max(0, total - rated),
    totalQuestions: total,
    rated,
    graded
  };
}

/** Score from answer rows (either raw table rows or contract-shaped entries). */
function scoreFromEntries(rows, totalQuestions) {
  const { passed, failed, na } = countAnswers(rows);
  return buildScore({ passed, failed, na, totalQuestions });
}

/**
 * 'YYYY-MM-DD' from a mysql2 value.
 *
 * The pool runs with dateStrings:true and a +05:30 session, so DATE/DATETIME arrive
 * as already-local strings. new Date(x).toISOString() re-serialises them in UTC and
 * moves anything before 05:30 back a day, which is how "today" filters missed the
 * day's own audits.
 */
function dateKey(value) {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m && !/^0000-00-00/.test(m[1])) return m[1];
  const d = new Date(s.replace(' ', 'T'));
  if (isNaN(d.getTime())) return null;
  return getISTDateString(d);
}

/** Answer row → contract VmAuditEntry, keeping the legacy keys already stored. */
function mapVmEntry(e) {
  const comment = e.comment !== null && e.comment !== undefined && String(e.comment) !== ''
    ? String(e.comment)
    : (e.remarks !== null && e.remarks !== undefined ? String(e.remarks) : '');
  return {
    ...e,
    pointId: e.pointId,
    pointTitle: e.pointTitle,
    score: normalizeScore(e.score) || String(e.score || ''),
    comment,
    observation: e.observation === null || e.observation === undefined ? '' : String(e.observation),
    correctiveAction: e.corrective_action === null || e.corrective_action === undefined ? '' : String(e.corrective_action),
    position: Number(e.position || 0)
  };
}

/** Active checkpoints — the denominator of every VM score comes from here. */
async function getActiveVmPoints() {
  const [rows] = await pool.query(
    'SELECT id, title, description, section, position FROM vmchecklistpoints WHERE isActive = TRUE ORDER BY position ASC, id ASC'
  );
  return rows || [];
}

/** Answer rows of an audit, in checkpoint order. Runs on the caller's connection so
 *  it can be used inside an open transaction. */
async function loadAuditEntries(auditId, executor = pool) {
  const [rows] = await executor.query(
    'SELECT * FROM vmsubmissionentries WHERE submissionId = ? ORDER BY position ASC, pointId ASC',
    [auditId]
  );
  return rows || [];
}

/**
 * Writes one answer row, creating it the first time and updating it afterwards, so
 * repeated autosaves of the same checkpoint never duplicate a row.
 */
async function upsertAuditEntry(conn, auditId, entry, pointMap) {
  const score = normalizeScore(entry.score);
  if (!score) {
    // Never default an unreadable answer to 'Pass' — that would invent compliance.
    throw new Error(`Answer "${entry.score === undefined || entry.score === null ? '' : entry.score}" for checkpoint "${entry.pointId}" is not one of Pass, Fail, NA`);
  }
  const point = pointMap.get(entry.pointId);
  const pointTitle = String(entry.pointTitle || (point ? point.title : '') || 'Check Point').slice(0, 255);
  const comment = String(entry.comment || '').slice(0, 5000);
  const observation = String(entry.observation || '').slice(0, 5000);
  const correctiveAction = String(entry.correctiveAction || entry.corrective_action || '').slice(0, 5000);
  const position = point ? Number(point.position || 0) : 0;
  const photoUrl = entry.photoUrl !== undefined ? String(entry.photoUrl).slice(0, 500) : '';

  // `remarks` is the column the legacy dashboard and CSV export read, so the
  // per-checkpoint note is mirrored into it while `comment` is the real source.
  const [updated] = await conn.query(
    `UPDATE vmsubmissionentries
        SET pointTitle = ?, score = ?, remarks = ?, comment = ?, observation = ?, corrective_action = ?, position = ?,
            photoUrl = COALESCE(NULLIF(?, ''), photoUrl)
      WHERE submissionId = ? AND pointId = ?`,
    [pointTitle, score, comment, comment, observation, correctiveAction, position, photoUrl, auditId, entry.pointId]
  );

  if (!updated || updated.affectedRows === 0) {
    await conn.query(
      `INSERT INTO vmsubmissionentries
         (id, submissionId, pointId, pointTitle, score, remarks, photoUrl, comment, observation, corrective_action, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['vme_' + crypto.randomBytes(10).toString('hex'), auditId, entry.pointId, pointTitle, score,
        comment, photoUrl, comment, observation, correctiveAction, position]
    );
  }
}

/** Recompute and persist the stored counters + score of an audit from its answers. */
async function recomputeAuditScore(executor, auditId, totalQuestions) {
  const score = scoreFromEntries(await loadAuditEntries(auditId, executor), totalQuestions);
  await executor.query(
    `UPDATE vmsubmissions
        SET passed_count = ?, failed_count = ?, na_count = ?, unrated_count = ?,
            total_questions = ?, scorePercent = ?
      WHERE id = ?`,
    [score.passed, score.failed, score.notApplicable, score.unrated, score.totalQuestions, score.percent, auditId]
  );
  return score;
}

/**
 * Shared guard for the two write-by-id endpoints: the audit must exist, the caller
 * must own it (or manage the store), and it must still be an open Draft.
 * Returns the audit row, or has already answered the request.
 */
async function loadWritableAudit(req, res) {
  const [rows] = await pool.query('SELECT * FROM vmsubmissions WHERE id = ? LIMIT 1', [req.params.id]);
  if (!rows || rows.length === 0) {
    res.status(404).json({ success: false, message: 'VM audit not found' });
    return null;
  }
  const audit = rows[0];

  if (!await assertLocationAccess(req.user, audit.location_id)) {
    res.status(403).json({
      success: false,
      message: `Access denied: this audit belongs to store location ${audit.location_id}, which is not assigned to your account`
    });
    return null;
  }

  const mayWriteAnyAudit = vmAuditAccess.isVmInspectionRole(req.user && req.user.role);
  const auditorId = audit.auditor_user_id !== null && audit.auditor_user_id !== undefined
    ? Number(audit.auditor_user_id)
    : null;
  const names = req.user ? [req.user.fullName, req.user.name, req.user.username].filter(Boolean).map(String) : [];
  const isCreator = (auditorId !== null && req.user && Number(auditorId) === Number(req.user.id)) ||
    (audit.submittedBy && names.includes(String(audit.submittedBy)));

  if (!mayWriteAnyAudit && !isCreator) {
    res.status(403).json({ success: false, message: 'Access denied: only the auditor who opened this draft (or a store manager) can change it' });
    return null;
  }

  return audit;
}

/** Reject a write that would overwrite an audit that is already in the history. */
function refuseIfSubmitted(audit, res) {
  if (String(audit.status) === VM_STATUS.DRAFT) return true;
  res.status(409).json({
    success: false,
    message: `This audit is already ${audit.status} and cannot be changed. Previous audits are never overwritten — start a new draft for this shift instead.`,
    auditId: audit.id,
    status: audit.status
  });
  return false;
}


/**
 * Format date helpers for consistent SQL queries
 */
function getDateCondition(dateRange, dateFrom, dateTo, column = 's.entryDate') {
  // IST calendar day, not the UTC day: an audit filed at 09:00 IST would otherwise
  // be invisible to the "today" filter for the rest of that Indian working day.
  const today = getISTDateString();
  if (dateRange === 'today') {
    return { clause: `AND ${column} = ?`, params: [today] };
  }
  if (dateRange === 'yesterday') {
    const yest = getISTDateString(new Date(), -86400000);
    return { clause: `AND ${column} = ?`, params: [yest] };
  }
  if (dateRange === 'week') {
    return { clause: `AND ${column} >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`, params: [] };
  }
  if (dateRange === 'month') {
    return { clause: `AND ${column} >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`, params: [] };
  }
  if (dateRange === 'last_month') {
    return {
      clause: `AND ${column} >= DATE_SUB(DATE_SUB(CURDATE(), INTERVAL DAY(CURDATE())-1 DAY), INTERVAL 1 MONTH) AND ${column} < DATE_SUB(CURDATE(), INTERVAL DAY(CURDATE())-1 DAY)`,
      params: []
    };
  }
  if (dateRange === 'custom' || dateFrom || dateTo) {
    const clauses = [];
    const params = [];
    if (dateFrom) {
      clauses.push(`${column} >= ?`);
      params.push(dateFrom);
    }
    if (dateTo) {
      clauses.push(`${column} <= ?`);
      params.push(dateTo);
    }
    return { clause: clauses.length > 0 ? `AND ${clauses.join(' AND ')}` : '', params };
  }
  return { clause: '', params: [] };
}

// ── 1. GET VM DASHBOARD LIVE METRICS ─────────────────────────────────────────
exports.getVmDashboard = async (req, res) => {
  try {
    const {
      locationId,
      floor,
      section,
      dateRange,
      dateFrom,
      dateTo,
      auditor,
      status
    } = req.query || {};

    const whereClauses = [];
    const params = [];

    // Location Security:
    const { clause: locClause, params: locParams } = await getLocationFilter(req, 's');
    if (locClause) {
      whereClauses.push(locClause.replace(/^\s*AND\s*/i, ''));
      params.push(...locParams);
    }

    if (locationId && locationId !== 'All' && locationId !== 'ALL') {
      whereClauses.push('s.location_id = ?');
      params.push(Number(locationId));
    }

    if (floor && floor !== 'All') {
      whereClauses.push('s.floor = ?');
      params.push(floor);
    }

    if (section && section !== 'All') {
      whereClauses.push('s.section = ?');
      params.push(section);
    }

    if (auditor && auditor !== 'All') {
      whereClauses.push('s.submittedBy = ?');
      params.push(auditor);
    }

    if (status && status !== 'All') {
      if (status === 'Passed') {
        whereClauses.push('s.scorePercent >= 80');
      } else if (status === 'Review') {
        whereClauses.push('s.scorePercent >= 50 AND s.scorePercent < 80');
      } else if (status === 'Failed') {
        whereClauses.push('s.scorePercent < 50');
      } else {
        whereClauses.push('s.status = ?');
        params.push(status);
      }
    }

    // Draft rows are in-progress work, not audits: counting them would inflate every
    // KPI on this page. They are still reachable by asking for status=Draft.
    if (status !== VM_STATUS.DRAFT) {
      whereClauses.push('s.status <> ?');
      params.push(VM_STATUS.DRAFT);
    }

    const dateFilter = getDateCondition(dateRange, dateFrom, dateTo, 's.entryDate');
    if (dateFilter.clause) {
      whereClauses.push(dateFilter.clause.replace(/^\s*AND\s*/i, ''));
      params.push(...dateFilter.params);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // ── 1A. High-Level Aggregated KPI Cards ──────────────────────────────────
    const [kpiRows] = await pool.query(`
      SELECT 
        COUNT(*) as totalAudits,
        COALESCE(SUM(CASE WHEN s.entryDate = CURDATE() THEN 1 ELSE 0 END), 0) as auditsToday,
        COALESCE(SUM(CASE WHEN s.entryDate >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 ELSE 0 END), 0) as auditsThisWeek,
        COALESCE(SUM(CASE WHEN s.entryDate >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END), 0) as auditsThisMonth,
        COALESCE(SUM(CASE WHEN s.scorePercent >= 80 OR s.status = 'Completed' THEN 1 ELSE 0 END), 0) as completedAudits,
        COALESCE(SUM(CASE WHEN s.scorePercent < 80 OR s.status = 'Pending' THEN 1 ELSE 0 END), 0) as pendingAudits,
        COALESCE(AVG(s.scorePercent), 0) as avgScore,
        COALESCE(SUM(CASE WHEN s.scorePercent >= 80 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) * 100, 0) as compliancePercent,
        COUNT(DISTINCT s.section) as sectionsAudited,
        COUNT(DISTINCT s.floor) as floorsAudited,
        COUNT(DISTINCT s.location_id) as storesAudited,
        MAX(s.createdAt) as latestAuditDate,
        COALESCE(SUM(s.passed_count), 0) as totalPassedChecks,
        COALESCE(SUM(s.failed_count), 0) as totalFailedChecks,
        COALESCE(SUM(s.na_count), 0) as totalNaChecks,
        COALESCE(SUM(s.unrated_count), 0) as totalUnratedChecks,
        COALESCE(SUM(s.total_questions), 0) as totalQuestionsChecked
      FROM vmsubmissions s
      ${whereSql}
    `, params);

    const kpi = kpiRows[0] || {};

    // Total Configured Sections Count across floors
    let totalConfiguredSections = 4;
    try {
      const [floorRows] = await pool.query('SELECT sections FROM vmfloors');
      let count = 0;
      (floorRows || []).forEach(f => {
        try {
          const arr = typeof f.sections === 'string' ? JSON.parse(f.sections) : (f.sections || []);
          count += arr.length;
        } catch (e) {
          count += 1;
        }
      });
      if (count > 0) totalConfiguredSections = count;
    } catch (e) {}

    // Images Uploaded Count
    let totalImagesUploaded = 0;
    try {
      const photoWhereClauses = ["p.deleted_at IS NULL", "p.status != 'Deleted'"];
      const photoParams = [];
      const { clause: photoLocClause, params: photoLocParams } = await getLocationFilter(req, 'p');
      if (photoLocClause) {
        photoWhereClauses.push(photoLocClause.replace(/^\s*AND\s*/i, ''));
        photoParams.push(...photoLocParams);
      }
      if (locationId && locationId !== 'All' && locationId !== 'ALL') {
        photoWhereClauses.push('p.location_id = ?');
        photoParams.push(Number(locationId));
      }
      if (floor && floor !== 'All') {
        photoWhereClauses.push('p.floor = ?');
        photoParams.push(floor);
      }
      if (section && section !== 'All') {
        photoWhereClauses.push('p.section = ?');
        photoParams.push(section);
      }
      const pCountDateFilter = getDateCondition(dateRange, dateFrom, dateTo, 'COALESCE(p.inspection_date, DATE(p.created_at))');
      if (pCountDateFilter.clause) {
        photoWhereClauses.push(pCountDateFilter.clause.replace(/^\s*AND\s*/i, ''));
        photoParams.push(...pCountDateFilter.params);
      }
      const [imgRows] = await pool.query(
        `SELECT COUNT(*) as cnt FROM vm_checklist_photos p WHERE ${photoWhereClauses.join(' AND ')}`,
        photoParams
      );
      totalImagesUploaded = imgRows[0]?.cnt || 0;
    } catch (e) {}

    const totalAudits = Number(kpi.totalAudits || 0);
    const passedAudits = Number(kpi.completedAudits || 0);
    const failedAudits = Number(kpi.pendingAudits || 0);

    const summaryCards = {
      totalAudits,
      auditsToday: Number(kpi.auditsToday || 0),
      auditsThisWeek: Number(kpi.auditsThisWeek || 0),
      auditsThisMonth: Number(kpi.auditsThisMonth || 0),
      pendingAudits: failedAudits,
      completedAudits: passedAudits,
      sectionsAudited: Number(kpi.sectionsAudited || 0),
      sectionsPending: Math.max(0, totalConfiguredSections - Number(kpi.sectionsAudited || 0)),
      questionsChecked: Number(kpi.totalQuestionsChecked || 0),
      passedChecks: Number(kpi.totalPassedChecks || 0),
      failedChecks: Number(kpi.totalFailedChecks || 0),
      // Reported apart because N/A is excluded from the score denominator, so
      // passed + failed no longer equals questions checked.
      naChecks: Number(kpi.totalNaChecks || 0),
      unratedChecks: Number(kpi.totalUnratedChecks || 0),
      averageScore: Number(Number(kpi.avgScore || 0).toFixed(1)),
      compliancePercentage: Number(Number(kpi.compliancePercent || 0).toFixed(1)),
      imagesUploaded: totalImagesUploaded,
      storesAudited: Number(kpi.storesAudited || 0),
      floorsAudited: Number(kpi.floorsAudited || 0),
      latestAuditDate: dateKey(kpi.latestAuditDate)
    };

    // ── 1B. Floor Performance Chart ──────────────────────────────────────────
    const [floorPerfRows] = await pool.query(`
      SELECT 
        s.floor as name,
        COUNT(*) as audits,
        COALESCE(AVG(s.scorePercent), 0) as score,
        COALESCE(SUM(CASE WHEN s.scorePercent >= 80 THEN 1 ELSE 0 END), 0) as passed,
        COALESCE(SUM(CASE WHEN s.scorePercent < 80 THEN 1 ELSE 0 END), 0) as failed
      FROM vmsubmissions s
      ${whereSql}
      GROUP BY s.floor
      ORDER BY audits DESC
    `, params);

    const floorChartData = floorPerfRows.map(f => ({
      name: f.name || 'Floor',
      score: Number(Number(f.score || 0).toFixed(1)),
      audits: Number(f.audits || 0),
      passed: Number(f.passed || 0),
      failed: Number(f.failed || 0)
    }));

    // ── 1C. Section Performance ──────────────────────────────────────────────
    const [secPerfRows] = await pool.query(`
      SELECT 
        s.section as name,
        s.floor as floor,
        COUNT(*) as audits,
        COALESCE(AVG(s.scorePercent), 0) as score,
        MAX(s.entryDate) as lastDate
      FROM vmsubmissions s
      ${whereSql}
      GROUP BY s.section, s.floor
      ORDER BY audits DESC
    `, params);

    const sectionChartData = secPerfRows.map(s => ({
      name: s.name || 'General',
      floor: s.floor || 'Ground Floor',
      score: Number(Number(s.score || 0).toFixed(1)),
      audits: Number(s.audits || 0),
      lastDate: dateKey(s.lastDate)
    }));

    // ── 1D. Store Comparison (Multi-Location Performance) ────────────────────
    const [storeRows] = await pool.query(`
      SELECT 
        s.location_id,
        COALESCE(l.location_name, CASE s.location_id WHEN 1 THEN 'Belagavi' WHEN 2 THEN 'Davanagere' ELSE 'Shivamogga' END) as storeName,
        COALESCE(l.location_code, CASE s.location_id WHEN 1 THEN 'BEL' WHEN 2 THEN 'DAV' ELSE 'SHI' END) as storeCode,
        COUNT(*) as audits,
        COALESCE(AVG(s.scorePercent), 0) as score,
        COALESCE(SUM(CASE WHEN s.scorePercent >= 80 THEN 1 ELSE 0 END), 0) as passed,
        COALESCE(SUM(CASE WHEN s.scorePercent < 80 THEN 1 ELSE 0 END), 0) as failed
      FROM vmsubmissions s
      LEFT JOIN locations l ON l.id = s.location_id
      ${whereSql}
      GROUP BY s.location_id, l.location_name, l.location_code
      ORDER BY s.location_id ASC
    `, params);

    const storePerformance = storeRows.map(st => ({
      locationId: st.location_id,
      store: st.storeName,
      code: st.storeCode,
      audits: Number(st.audits || 0),
      score: Number(Number(st.score || 0).toFixed(1)),
      passed: Number(st.passed || 0),
      failed: Number(st.failed || 0)
    }));

    // ── 1E. Score & Status Distribution Charts ───────────────────────────────
    let passedCount = 0;
    let reviewCount = 0;
    let failedCount = 0;

    const [scoreDistRows] = await pool.query(`
      SELECT 
        SUM(CASE WHEN s.scorePercent >= 80 THEN 1 ELSE 0 END) as passedCnt,
        SUM(CASE WHEN s.scorePercent >= 50 AND s.scorePercent < 80 THEN 1 ELSE 0 END) as reviewCnt,
        SUM(CASE WHEN s.scorePercent < 50 THEN 1 ELSE 0 END) as failedCnt
      FROM vmsubmissions s
      ${whereSql}
    `, params);

    if (scoreDistRows && scoreDistRows[0]) {
      passedCount = Number(scoreDistRows[0].passedCnt || 0);
      reviewCount = Number(scoreDistRows[0].reviewCnt || 0);
      failedCount = Number(scoreDistRows[0].failedCnt || 0);
    }

    const scoreDistribution = [
      { name: 'Passed (≥80%)', value: passedCount, fill: '#2D8659' },
      { name: 'Review (50-79%)', value: reviewCount, fill: '#F39C12' },
      { name: 'Failed (<50%)', value: failedCount, fill: '#C0392B' }
    ].filter(item => totalAudits > 0 || item.value > 0);

    const auditCompletion = [
      { name: 'Passed / Completed', value: passedAudits, fill: '#2D8659' },
      { name: 'Needs Attention', value: failedAudits, fill: '#E67E22' }
    ].filter(item => totalAudits > 0 || item.value > 0);

    // ── 1F. Audit Score Trend (Day-by-Day) ────────────────────────────────────
    const [trendRows] = await pool.query(`
      SELECT 
        s.entryDate as date,
        COUNT(*) as count,
        COALESCE(AVG(s.scorePercent), 0) as avgScore
      FROM vmsubmissions s
      ${whereSql}
      GROUP BY s.entryDate
      ORDER BY s.entryDate ASC
      LIMIT 30
    `, params);

    const trendChartData = trendRows.map(t => ({
      date: dateKey(t.date) || '—',
      score: Number(Number(t.avgScore || 0).toFixed(1)),
      count: Number(t.count || 0)
    }));

    // ── 1G. Question-Level Compliance ────────────────────────────────────────
    let questionChartData = [];
    try {
      const [qPoints] = await pool.query('SELECT id, title, position FROM vmchecklistpoints WHERE isActive = TRUE ORDER BY position ASC');
      const pointIds = (qPoints || []).map(q => q.id);

      if (pointIds.length > 0 && totalAudits > 0) {
        const [entryStats] = await pool.query(`
          SELECT 
            e.pointId,
            COUNT(*) as totalAnswers,
            SUM(CASE WHEN e.score = 'Pass' THEN 1 ELSE 0 END) as passCount,
            SUM(CASE WHEN e.score = 'Fail' THEN 1 ELSE 0 END) as failCount,
            SUM(CASE WHEN e.score = 'NA' THEN 1 ELSE 0 END) as naCount
          FROM vmsubmissionentries e
          INNER JOIN vmsubmissions s ON s.id = e.submissionId
          ${whereSql}
          GROUP BY e.pointId
        `, params);

        const statsMap = {};
        (entryStats || []).forEach(st => {
          statsMap[st.pointId] = st;
        });

        questionChartData = qPoints.map(q => {
          const st = statsMap[q.id] || { totalAnswers: 0, passCount: 0, failCount: 0, naCount: 0 };
          const tot = Number(st.totalAnswers || 0);
          const pass = Number(st.passCount || 0);
          const fail = Number(st.failCount || 0);
          // Same rule as the audit score: N/A is not a failure and leaves the
          // denominator, so a checkpoint nobody answers is 0% — never a silent 100%.
          const graded = pass + fail;
          const passPercent = graded > 0 ? Number(((pass / graded) * 100).toFixed(1)) : 0;
          return {
            id: q.id,
            number: q.position || 1,
            title: q.title,
            passCount: pass,
            failCount: fail,
            naCount: Number(st.naCount || 0),
            totalAnswers: tot,
            passPercent
          };
        });
      } else {
        questionChartData = (qPoints || []).map(q => ({
          id: q.id,
          number: q.position || 1,
          title: q.title,
          passCount: 0,
          failCount: 0,
          naCount: 0,
          totalAnswers: 0,
          passPercent: 0
        }));
      }
    } catch (e) {}

    // ── 1H. Recent VM Activity (Live Audit Timeline with Images) ──────────────
    const [recentRows] = await pool.query(`
      SELECT 
        s.id,
        s.location_id,
        COALESCE(l.location_name, CASE s.location_id WHEN 1 THEN 'Belagavi' WHEN 2 THEN 'Davanagere' ELSE 'Shivamogga' END) as locationName,
        COALESCE(l.location_code, CASE s.location_id WHEN 1 THEN 'BEL' WHEN 2 THEN 'DAV' ELSE 'SHI' END) as locationCode,
        s.floor,
        s.section,
        s.shift,
        s.scorePercent,
        s.status,
        s.submittedBy,
        s.remarks,
        s.entryDate,
        s.createdAt
      FROM vmsubmissions s
      LEFT JOIN locations l ON l.id = s.location_id
      ${whereSql}
      ORDER BY s.createdAt DESC
      LIMIT 15
    `, params);

    // Attach photos to recent activity
    const recentSubIds = recentRows.map(r => r.id);
    let recentPhotosMap = {};
    if (recentSubIds.length > 0) {
      try {
        const [photoRows] = await pool.query(
          "SELECT id, submission_id, file_name, file_path, file_size, mime_type, floor, section, created_at FROM vm_checklist_photos WHERE submission_id IN (?) AND status != 'Deleted' AND deleted_at IS NULL",
          [recentSubIds]
        );
        (photoRows || []).forEach(p => {
          if (!recentPhotosMap[p.submission_id]) recentPhotosMap[p.submission_id] = [];
          recentPhotosMap[p.submission_id].push({
            id: p.id,
            fileName: p.file_name,
            fileUrl: p.file_path,
            streamUrl: `/api/vm/photos/${p.id}/file`,
            floor: p.floor,
            section: p.section
          });
        });
      } catch (e) {}
    }

    const recentActivity = recentRows.map(r => ({
      id: r.id,
      locationId: r.location_id,
      locationName: r.locationName,
      locationCode: r.locationCode,
      floor: r.floor,
      section: r.section,
      shift: r.shift,
      scorePercent: Number(r.scorePercent || 0),
      status: r.status || (Number(r.scorePercent || 0) >= 80 ? 'Passed' : 'Review'),
      submittedBy: r.submittedBy,
      remarks: r.remarks || '',
      entryDate: dateKey(r.entryDate) || '',
      createdAt: r.createdAt,
      photos: recentPhotosMap[r.id] || []
    }));

    // ── 1I. Live VM Audit Photo Timeline (Chronological Real Photos) ────────
    let photoTimeline = [];
    try {
      const photoWhereClauses = ["p.deleted_at IS NULL", "p.status != 'Deleted'"];
      const photoParams = [];
      const { clause: pLocClause, params: pLocParams } = await getLocationFilter(req, 'p');
      if (pLocClause) {
        photoWhereClauses.push(pLocClause.replace(/^\s*AND\s*/i, ''));
        photoParams.push(...pLocParams);
      }
      if (locationId && locationId !== 'All' && locationId !== 'ALL') {
        photoWhereClauses.push('p.location_id = ?');
        photoParams.push(Number(locationId));
      }
      if (floor && floor !== 'All') {
        photoWhereClauses.push('p.floor = ?');
        photoParams.push(floor);
      }
      if (section && section !== 'All') {
        photoWhereClauses.push('p.section = ?');
        photoParams.push(section);
      }
      if (auditor && auditor !== 'All') {
        photoWhereClauses.push('(p.uploaded_by = ? OR s.submittedBy = ?)');
        photoParams.push(auditor, auditor);
      }
      if (status && status !== 'All') {
        if (status === 'Passed') {
          photoWhereClauses.push('s.scorePercent >= 80');
        } else if (status === 'Review') {
          photoWhereClauses.push('s.scorePercent >= 50 AND s.scorePercent < 80');
        } else if (status === 'Failed') {
          photoWhereClauses.push('s.scorePercent < 50');
        } else {
          photoWhereClauses.push('s.status = ?');
          photoParams.push(status);
        }
      }
      const pDateFilter = getDateCondition(dateRange, dateFrom, dateTo, 'COALESCE(p.inspection_date, DATE(p.created_at))');
      if (pDateFilter.clause) {
        photoWhereClauses.push(pDateFilter.clause.replace(/^\s*AND\s*/i, ''));
        photoParams.push(...pDateFilter.params);
      }

      const [timelinePhotoRows] = await pool.query(`
        SELECT 
          p.id,
          p.submission_id as submissionId,
          p.location_id as locationId,
          COALESCE(l.location_name, p.location_name, CASE p.location_id WHEN 1 THEN 'Belagavi' WHEN 2 THEN 'Davanagere' ELSE 'Shivamogga' END) as locationName,
          COALESCE(l.location_code, CASE p.location_id WHEN 1 THEN 'BEL' WHEN 2 THEN 'DAV' ELSE 'SHI' END) as locationCode,
          p.floor,
          p.section,
          p.point_id as pointId,
          p.file_name as fileName,
          p.file_path as filePath,
          p.file_size as fileSize,
          p.mime_type as mimeType,
          p.uploaded_by as uploadedBy,
          p.created_at as createdAt,
          p.inspection_date as inspectionDate,
          s.scorePercent,
          s.status as auditStatus,
          s.shift,
          s.submittedBy as auditAuditor,
          s.remarks as auditRemarks
        FROM vm_checklist_photos p
        LEFT JOIN vmsubmissions s ON s.id = p.submission_id
        LEFT JOIN locations l ON l.id = p.location_id
        WHERE ${photoWhereClauses.join(' AND ')}
        ORDER BY p.created_at DESC
        LIMIT 60
      `, photoParams);

      photoTimeline = (timelinePhotoRows || []).map(p => ({
        id: p.id,
        submissionId: p.submissionId,
        locationId: p.locationId,
        locationName: p.locationName,
        locationCode: p.locationCode,
        floor: p.floor,
        section: p.section,
        pointId: p.pointId,
        fileName: p.fileName,
        fileSize: Number(p.fileSize || 0),
        mimeType: p.mimeType,
        uploadedBy: p.uploadedBy || p.auditAuditor || 'CRM Manager',
        createdAt: p.createdAt,
        inspectionDate: p.inspectionDate || dateKey(p.createdAt) || '',
        scorePercent: p.scorePercent !== null && p.scorePercent !== undefined ? Number(p.scorePercent) : null,
        status: p.auditStatus || (p.scorePercent !== null && p.scorePercent !== undefined ? (Number(p.scorePercent) >= 80 ? 'Passed' : 'Review') : 'Verified'),
        shift: p.shift || 'Opening',
        remarks: p.auditRemarks || '',
        url: `/api/vm/photos/${p.id}/file`,
        streamUrl: `/api/vm/photos/${p.id}/file`
      }));
    } catch (photoErr) {
      console.error('[VM Dashboard Photo Timeline Error]', photoErr);
    }

    return res.json({
      success: true,
      summaryCards,
      charts: {
        floorPerformance: floorChartData,
        sectionPerformance: sectionChartData,
        storePerformance,
        scoreDistribution,
        auditCompletion,
        auditTrend: trendChartData,
        questionCompliance: questionChartData
      },
      recentActivity,
      photoTimeline
    });
  } catch (err) {
    console.error('[VM Dashboard Error]', err);
    return errorRes(res, 'Unable to load the VM dashboard. Please try again.', [], 500);
  }
};

// ── 2. GET PAGINATED VM AUDITS (AUDIT HISTORY) ──────────────────────────────
exports.getVmAudits = async (req, res) => {
  try {
    const {
      locationId,
      floor,
      section,
      dateRange,
      dateFrom,
      dateTo,
      auditor,
      status,
      minScore,
      maxScore,
      search,
      limit = 20,
      page = 1
    } = req.query || {};

    const whereClauses = [];
    const params = [];

    const { clause: locClause, params: locParams } = await getLocationFilter(req, 's');
    if (locClause) {
      whereClauses.push(locClause.replace(/^\s*AND\s*/i, ''));
      params.push(...locParams);
    }

    if (locationId && locationId !== 'All' && locationId !== 'ALL') {
      whereClauses.push('s.location_id = ?');
      params.push(Number(locationId));
    }

    if (floor && floor !== 'All') {
      whereClauses.push('s.floor = ?');
      params.push(floor);
    }

    if (section && section !== 'All') {
      whereClauses.push('s.section = ?');
      params.push(section);
    }

    if (auditor && auditor !== 'All') {
      whereClauses.push('s.submittedBy = ?');
      params.push(auditor);
    }

    if (status && status !== 'All') {
      if (status === 'Passed') {
        whereClauses.push('s.scorePercent >= 80');
      } else if (status === 'Review') {
        whereClauses.push('s.scorePercent >= 50 AND s.scorePercent < 80');
      } else if (status === 'Failed') {
        whereClauses.push('s.scorePercent < 50');
      } else {
        whereClauses.push('s.status = ?');
        params.push(status);
      }
    }

    if (minScore !== undefined && minScore !== '') {
      whereClauses.push('s.scorePercent >= ?');
      params.push(Number(minScore));
    }
    if (maxScore !== undefined && maxScore !== '') {
      whereClauses.push('s.scorePercent <= ?');
      params.push(Number(maxScore));
    }

    if (search && search.trim()) {
      whereClauses.push('(s.floor LIKE ? OR s.section LIKE ? OR s.submittedBy LIKE ? OR s.remarks LIKE ?)');
      const sTerm = `%${search.trim()}%`;
      params.push(sTerm, sTerm, sTerm, sTerm);
    }

    const dateFilter = getDateCondition(dateRange, dateFrom, dateTo, 's.entryDate');
    if (dateFilter.clause) {
      whereClauses.push(dateFilter.clause.replace(/^\s*AND\s*/i, ''));
      params.push(...dateFilter.params);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (safePage - 1) * safeLimit;

    const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM vmsubmissions s ${whereSql}`, params);
    const total = countRows[0]?.total || 0;

    const [rows] = await pool.query(`
      SELECT 
        s.id,
        s.location_id,
        COALESCE(l.location_name, CASE s.location_id WHEN 1 THEN 'Belagavi' WHEN 2 THEN 'Davanagere' ELSE 'Shivamogga' END) as locationName,
        COALESCE(l.location_code, CASE s.location_id WHEN 1 THEN 'BEL' WHEN 2 THEN 'DAV' ELSE 'SHI' END) as locationCode,
        s.floor,
        s.section,
        s.shift,
        s.scorePercent,
        s.status,
        s.submittedBy,
        s.remarks,
        s.passed_count,
        s.failed_count,
        s.na_count,
        s.unrated_count,
        s.total_questions,
        s.auditor_user_id,
        s.updatedBy,
        s.submittedAt,
        s.entryDate,
        s.createdAt,
        s.updatedAt
      FROM vmsubmissions s
      LEFT JOIN locations l ON l.id = s.location_id
      ${whereSql}
      ORDER BY s.createdAt DESC
      LIMIT ? OFFSET ?
    `, [...params, safeLimit, offset]);

    const auditIds = rows.map(r => r.id);
    const entriesMap = {};
    const photosMap = {};
    const photoCountMap = {};

    if (auditIds.length > 0) {
      try {
        const [entries] = await pool.query(
          'SELECT * FROM vmsubmissionentries WHERE submissionId IN (?) ORDER BY position ASC, pointId ASC',
          [auditIds]
        );
        (entries || []).forEach(e => {
          if (!entriesMap[e.submissionId]) entriesMap[e.submissionId] = [];
          entriesMap[e.submissionId].push(mapVmEntry(e));
        });
      } catch (e) {
        console.error('[Get VM Audits Entries Error]', e);
      }

      try {
        const [photos] = await pool.query(
          "SELECT * FROM vm_checklist_photos WHERE submission_id IN (?) AND status != 'Deleted' AND deleted_at IS NULL ORDER BY created_at DESC",
          [auditIds]
        );
        (photos || []).forEach(p => {
          if (!photosMap[p.submission_id]) photosMap[p.submission_id] = [];
          photosMap[p.submission_id].push(mapVmPhoto(p));
        });
      } catch (e) {
        console.error('[Get VM Audits Photos Error]', e);
      }

      // One grouped count for the whole page, never a COUNT per row.
      try {
        const [counts] = await pool.query(
          "SELECT submission_id, COUNT(*) as cnt FROM vm_checklist_photos WHERE submission_id IN (?) AND status != 'Deleted' AND deleted_at IS NULL GROUP BY submission_id",
          [auditIds]
        );
        (counts || []).forEach(c => { photoCountMap[c.submission_id] = Number(c.cnt || 0); });
      } catch (e) {
        console.error('[Get VM Audits Photo Counts Error]', e);
      }
    }

    const audits = rows.map(r => ({
      ...r,
      scorePercent: Number(r.scorePercent || 0),
      entryDate: dateKey(r.entryDate) || '',
      // camelCase mirror of the stored row for the guided-flow list (VmAuditListItem).
      locationId: r.location_id,
      locationName: r.locationName,
      passedCount: Number(r.passed_count || 0),
      failedCount: Number(r.failed_count || 0),
      naCount: Number(r.na_count || 0),
      unratedCount: Number(r.unrated_count || 0),
      totalQuestions: Number(r.total_questions || 0),
      auditorUserId: r.auditor_user_id === null ? null : Number(r.auditor_user_id),
      submittedBy: r.submittedBy,
      submittedAt: r.submittedAt || null,
      createdAt: r.createdAt || null,
      photoCount: photoCountMap[r.id] || 0,
      entries: entriesMap[r.id] || [],
      photos: photosMap[r.id] || []
    }));

    return res.json({
      success: true,
      audits,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1
    });
  } catch (err) {
    console.error('[Get VM Audits Error]', err);
    return errorRes(res, 'Unable to load the checklist history. Please try again.', [], 500);
  }
};

// ── 3. GET SINGLE VM AUDIT DETAIL ───────────────────────────────────────────
exports.getVmAuditDetail = async (req, res) => {
  try {
    const auditId = req.params.id;
    const [rows] = await pool.query(`
      SELECT 
        s.*,
        COALESCE(l.location_name, CASE s.location_id WHEN 1 THEN 'Belagavi' WHEN 2 THEN 'Davanagere' ELSE 'Shivamogga' END) as locationName,
        COALESCE(l.location_code, CASE s.location_id WHEN 1 THEN 'BEL' WHEN 2 THEN 'DAV' ELSE 'SHI' END) as locationCode
      FROM vmsubmissions s
      LEFT JOIN locations l ON l.id = s.location_id
      WHERE s.id = ?
      LIMIT 1
    `, [auditId]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'VM audit not found' });
    }

    const audit = rows[0];

    // The id alone must not be a licence to read another store's audit history:
    // every list the UI can click from is already location-filtered, so this only
    // blocks requests that bypassed those filters.
    if (!await assertLocationAccess(req.user, audit.location_id)) {
      return res.status(403).json({
        success: false,
        message: `Access denied: this audit belongs to store location ${audit.location_id}, which is not assigned to your account`
      });
    }

    const entries = await loadAuditEntries(auditId);
    const photos = await getVmPhotos(auditId);

    const formattedPhotos = (photos || []).map(p => ({ ...p }));
    const formattedEntries = (entries || []).map(mapVmEntry);
    const totalQuestions = Number(audit.total_questions || 0) || formattedEntries.length;
    const score = scoreFromEntries(entries, totalQuestions);

    return res.json({
      success: true,
      audit: {
        ...audit,
        scorePercent: Number(audit.scorePercent || 0),
        entryDate: dateKey(audit.entryDate) || '',
        // camelCase mirror of the stored row (VmAuditDetail); the legacy snake_case
        // keys above are untouched so the existing dashboard keeps working.
        locationId: audit.location_id,
        locationName: audit.locationName,
        passedCount: Number(audit.passed_count || 0),
        failedCount: Number(audit.failed_count || 0),
        naCount: Number(audit.na_count || 0),
        unratedCount: Number(audit.unrated_count || 0),
        totalQuestions,
        auditorUserId: audit.auditor_user_id === null ? null : Number(audit.auditor_user_id),
        submittedAt: audit.submittedAt || null,
        updatedBy: audit.updatedBy || null,
        remarks: audit.remarks || '',
        photoCount: formattedPhotos.length,
        score,
        entries: formattedEntries,
        photos: formattedPhotos
      }
    });
  } catch (err) {
    console.error('[Get VM Audit Detail Error]', err);
    return errorRes(res, 'Unable to open this checklist. Please try again.', [], 500);
  }
};

// ── 4b. AUDIT TRAIL OF ONE CHECKLIST ────────────────────────────────────────
/**
 * Who opened this checklist, what they changed, when it was filed and which evidence
 * came and went. Same location rule as the detail view: knowing the id is not a
 * licence to read another store's history.
 */
exports.getVmAuditHistory = async (req, res) => {
  try {
    const auditId = req.params.id;
    const [rows] = await pool.query(
      'SELECT id, location_id, floor, section, shift, entryDate, status, scorePercent, submittedBy, submittedAt, updatedBy FROM vmsubmissions WHERE id = ? LIMIT 1',
      [auditId]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'VM audit not found' });
    }
    const audit = rows[0];
    if (!await assertLocationAccess(req.user, audit.location_id)) {
      return res.status(403).json({
        success: false,
        message: `Access denied: this audit belongs to store location ${audit.location_id}, which is not assigned to your account`
      });
    }

    const history = await vmHistory.getVmAuditHistory(auditId, req.query.limit);

    return res.json({
      success: true,
      auditId,
      audit: {
        id: audit.id,
        locationId: Number(audit.location_id),
        floor: audit.floor,
        section: audit.section,
        shift: audit.shift,
        entryDate: dateKey(audit.entryDate) || '',
        status: audit.status,
        scorePercent: Number(audit.scorePercent || 0),
        submittedBy: audit.submittedBy || null,
        submittedAt: audit.submittedAt || null,
        updatedBy: audit.updatedBy || null
      },
      history
    });
  } catch (err) {
    console.error('[Get VM Audit History Error]', err);
    return errorRes(res, 'Unable to load the checklist history. Please try again.', [], 500);
  }
};

// ── 4. SUBMIT VM CHECKLIST AUDIT ────────────────────────────────────────────
exports.submitVm = async (req, res) => {
  try {
    const {
      shift = 'Opening',
      floor = 'Ground Floor',
      section = 'General',
      scorePercent,
      submittedBy,
      remarks = '',
      entries = [],
      photoIds = []
    } = req.body || {};

    if (!Array.isArray(entries)) {
      return errorRes(res, 'entries must be an array of checklist answers', ['entries must be an array']);
    }

    const badScore = entries.find(e => !normalizeScore(e && e.score));
    if (badScore) {
      return errorRes(
        res,
        `Answer "${badScore.score === undefined || badScore.score === null ? '' : badScore.score}" for checkpoint "${badScore.pointId || badScore.id || 'unknown'}" is not one of Pass, Fail, NA`,
        ['entries[].score must be Pass, Fail or NA']
      );
    }

    const locationId = resolveAuditLocationId(req);
    if (!locationId) {
      return errorRes(res, 'A store location is required to record a VM audit', ['locationId is required']);
    }
    if (!await assertLocationAccess(req.user, locationId)) {
      return res.status(403).json({
        success: false,
        message: `Access denied: store location ${locationId} is not assigned to your account`
      });
    }

    const submissionId = getUUID();
    // The audit day is the Asia/Kolkata calendar day, not the UTC one.
    const entryDate = getISTDateString();

    const activePoints = await getActiveVmPoints();
    const pointMap = new Map(activePoints.map(p => [p.id, p]));
    const totalQuestions = entries.length > 0 ? entries.length : activePoints.length;

    // N/A is skipped, not failed: graded = passed + failed is the denominator.
    const score = scoreFromEntries(entries, totalQuestions);
    const finalScore = scorePercent !== undefined ? Number(scorePercent) : score.percent;
    const auditStatus = finalScore >= VM_PASS_MARK ? VM_STATUS.COMPLETED : VM_STATUS.REVIEW;
    const auditorName = submittedBy || (req.user ? (req.user.fullName || req.user.name || req.user.username) : 'CRM Manager');

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Insert Audit
      await conn.query(`
        INSERT INTO vmsubmissions 
          (id, location_id, entryDate, shift, floor, section, scorePercent, status, submittedBy, remarks,
           passed_count, failed_count, na_count, unrated_count, total_questions, auditor_user_id, submittedAt, updatedBy)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
      `, [
        submissionId,
        locationId,
        entryDate,
        shift,
        floor,
        section,
        finalScore,
        auditStatus,
        auditorName,
        remarks || '',
        score.passed,
        score.failed,
        score.notApplicable,
        score.unrated,
        totalQuestions,
        req.user && req.user.id ? Number(req.user.id) : null,
        req.user ? (req.user.username || auditorName) : auditorName
      ]);

      // Insert Entries
      if (entries.length > 0) {
        for (const e of entries) {
          await upsertAuditEntry(conn, submissionId, {
            pointId: e.pointId || e.id || 'vm_q',
            pointTitle: e.pointTitle || e.title,
            score: e.score,
            comment: e.comment !== undefined ? e.comment : e.remarks,
            observation: e.observation,
            correctiveAction: e.correctiveAction !== undefined ? e.correctiveAction : e.corrective_action,
            photoUrl: e.photoUrl
          }, pointMap);
        }
      }

      // Link uploaded photos to this submission
      if (Array.isArray(photoIds) && photoIds.length > 0) {
        const placeholders = photoIds.map(() => '?').join(', ');
        await conn.query(
          `UPDATE vm_checklist_photos SET submission_id = ?, inspection_date = ? WHERE id IN (${placeholders})`,
          [submissionId, entryDate, ...photoIds]
        );
      }

      await conn.commit();
    } catch (txErr) {
      try { await conn.rollback(); } catch (e) {}
      throw txErr;
    } finally {
      conn.release();
    }

    // Emit live WebSocket event
    try {
      realtimeService.emitVmChange('CREATE', {
        id: submissionId,
        submissionId,
        location_id: locationId,
        floor,
        section,
        scorePercent: finalScore,
        status: auditStatus,
        submittedBy: auditorName
      }, locationId);
    } catch (wsErr) {
      console.warn('[VM Realtime Emit Error]', wsErr.message);
    }

    await logAction(req.user ? req.user.username : 'CRM Manager', 'SUBMIT_VM_CHECKLIST', 'VM', {
      submissionId,
      locationId,
      floor,
      section,
      scorePercent: finalScore,
      status: auditStatus,
      entriesCount: entries.length,
      photosLinked: photoIds.length
    });

    return res.json({
      success: true,
      message: 'VM audit submitted successfully',
      submissionId,
      audit: {
        id: submissionId,
        locationId,
        floor,
        section,
        shift,
        entryDate,
        scorePercent: finalScore,
        status: auditStatus,
        submittedBy: auditorName,
        submittedAt: new Date().toISOString(),
        score,
        photosCount: photoIds.length
      }
    });
  } catch (err) {
    console.error('[Submit VM Error]', err);
    return errorRes(res, 'Unable to submit the checklist. Please try again.', [], 500);
  }
};

// ── 5. EXPORT VM AUDITS AS CSV ──────────────────────────────────────────────
exports.exportVmAudits = async (req, res) => {
  try {
    const {
      locationId,
      floor,
      section,
      dateRange,
      dateFrom,
      dateTo,
      status
    } = req.query || {};

    const whereClauses = [];
    const params = [];

    const { clause: locClause, params: locParams } = await getLocationFilter(req, 's');
    if (locClause) {
      whereClauses.push(locClause.replace(/^\s*AND\s*/i, ''));
      params.push(...locParams);
    }

    if (locationId && locationId !== 'All' && locationId !== 'ALL') {
      whereClauses.push('s.location_id = ?');
      params.push(Number(locationId));
    }
    if (floor && floor !== 'All') {
      whereClauses.push('s.floor = ?');
      params.push(floor);
    }
    if (section && section !== 'All') {
      whereClauses.push('s.section = ?');
      params.push(section);
    }
    if (status && status !== 'All') {
      whereClauses.push('s.status = ?');
      params.push(status);
    }

    // Same rule as the dashboard: an unfinished Draft is not an audit yet.
    if (status !== VM_STATUS.DRAFT) {
      whereClauses.push('s.status <> ?');
      params.push(VM_STATUS.DRAFT);
    }

    const dateFilter = getDateCondition(dateRange, dateFrom, dateTo, 's.entryDate');
    if (dateFilter.clause) {
      whereClauses.push(dateFilter.clause.replace(/^\s*AND\s*/i, ''));
      params.push(...dateFilter.params);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const [rows] = await pool.query(`
      SELECT 
        s.id,
        s.entryDate,
        s.createdAt,
        COALESCE(l.location_name, CASE s.location_id WHEN 1 THEN 'Belagavi' WHEN 2 THEN 'Davanagere' ELSE 'Shivamogga' END) as storeName,
        s.floor,
        s.section,
        s.shift,
        s.scorePercent,
        s.status,
        s.submittedBy,
        s.remarks,
        s.passed_count,
        s.failed_count,
        s.na_count,
        s.total_questions,
        (SELECT COUNT(*) FROM vm_checklist_photos p WHERE p.submission_id = s.id AND p.status != 'Deleted' AND p.deleted_at IS NULL) as photoCount
      FROM vmsubmissions s
      LEFT JOIN locations l ON l.id = s.location_id
      ${whereSql}
      ORDER BY s.createdAt DESC
      LIMIT 1000
    `, params);

    const headers = [
      'Audit ID',
      'Store Location',
      'Date',
      'Shift',
      'Floor',
      'Section',
      'Score %',
      'Status',
      'Passed Checks',
      'Failed Checks',
      'Not Applicable',
      'Total Questions',
      'Photos Attached',
      'Auditor',
      'General Remarks'
    ];

    const csvEscape = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    let csvContent = '\uFEFF' + headers.join(',') + '\r\n';
    rows.forEach(r => {
      const row = [
        r.id,
        r.storeName,
        dateKey(r.entryDate) || '',
        r.shift || 'Opening',
        r.floor || '',
        r.section || '',
        `${r.scorePercent || 0}%`,
        r.status || 'Completed',
        r.passed_count || 0,
        r.failed_count || 0,
        r.na_count || 0,
        r.total_questions || 10,
        r.photoCount || 0,
        r.submittedBy || '',
        r.remarks || ''
      ];
      csvContent += row.map(csvEscape).join(',') + '\r\n';
    });

    const filename = `BSC_VM_Audits_${getISTDateString()}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (err) {
    console.error('[Export VM Audits Error]', err);
    return errorRes(res, 'Unable to export the checklist records. Please try again.', [], 500);
  }
};

// ── 6. GET VM FLOORS ────────────────────────────────────────────────────────
exports.getVmFloors = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM vmfloors ORDER BY createdAt ASC');
    const floors = (rows || []).map((r) => {
      let parsedSections = [];
      try {
        parsedSections = typeof r.sections === 'string' ? JSON.parse(r.sections) : (r.sections || []);
      } catch (e) {
        parsedSections = String(r.sections || '').split(',').map((s) => s.trim()).filter(Boolean);
      }
      return {
        id: r.id,
        name: r.name,
        description: r.description || '',
        sections: parsedSections
      };
    });
    return res.json({ success: true, floors });
  } catch (err) {
    console.error('[Get VM Floors Error]', err);
    return res.json({ success: true, floors: [] });
  }
};

// ── 7. CREATE VM FLOOR ──────────────────────────────────────────────────────
exports.createVmFloor = async (req, res) => {
  try {
    const { name, description, sections, location_id, floor_code } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Floor name is required' });
    }
    const secList = Array.isArray(sections)
      ? sections.map((s) => String(s).trim()).filter(Boolean)
      : (typeof sections === 'string' ? sections.split(',').map((s) => s.trim()).filter(Boolean) : []);
    if (secList.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one section is required for this floor' });
    }

    // Auto-generate floor ID slug if floor_code provided, e.g. floor_4f or sanitize name
    const code = floor_code ? String(floor_code).trim().toLowerCase().replace(/[^a-z0-9]/g, '_') : '';
    let id = code ? `floor_${code}` : `floor_${String(name).toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    if (!id || id === 'floor_' || id === 'floor__') {
      id = getUUID();
    }
    if (id.length > 64) {
      id = id.substring(0, 64);
    }

    const locId = location_id ? Number(location_id) : (req.user?.location_id ? Number(req.user.location_id) : 2);

    await pool.query(`
      INSERT INTO vmfloors (id, location_id, name, description, sections)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE location_id = VALUES(location_id), description = VALUES(description), sections = VALUES(sections)
    `, [id, locId, name.trim(), description ? description.trim() : '', JSON.stringify(secList)]);

    return res.json({
      success: true,
      message: 'Store floor created successfully',
      floor: { id, location_id: locId, name: name.trim(), description: description ? description.trim() : '', sections: secList }
    });
  } catch (err) {
    console.error('[Create VM Floor Error]', err);
    return res.status(500).json({ success: false, message: 'Unable to save the floor. Please try again.' });
  }
};

// ── 8. DELETE VM FLOOR ──────────────────────────────────────────────────────
exports.deleteVmFloor = async (req, res) => {
  try {
    const floorId = req.params.id || req.body.id || req.body.floorId;
    const floorName = req.body.name;
    if (!floorId && !floorName) {
      return res.status(400).json({ success: false, message: 'Floor ID or name is required' });
    }
    if (floorId) {
      await pool.query('DELETE FROM vmfloors WHERE id = ? OR name = ?', [floorId, floorId]);
    } else {
      await pool.query('DELETE FROM vmfloors WHERE name = ?', [floorName]);
    }
    return res.json({ success: true, message: 'Floor deleted successfully' });
  } catch (err) {
    console.error('[Delete VM Floor Error]', err);
    return res.status(500).json({ success: false, message: 'Unable to remove the floor. Please try again.' });
  }
};

// ── 9. GET VM CHECKLIST POINTS (QUESTIONS) ──────────────────────────────────
exports.getVmPoints = async (req, res) => {
  try {
    // Every active checkpoint, in checklist order. The old `rows.length >= 10` gate
    // made this answer `points: []` whenever the store changed how many checkpoints
    // it keeps, so no count is assumed here any more.
    const [rows] = await pool.query(
      'SELECT * FROM vmchecklistpoints WHERE isActive = TRUE ORDER BY position ASC, id ASC'
    );
    const points = rows || [];
    return res.json({ success: true, points, total: points.length });
  } catch (err) {
    console.error('[Get VM Points Error]', err);
    return errorRes(res, 'Unable to load the checklist questions. Please try again.', [], 500);
  }
};

// ── 10. GET VM FLOOR SUMMARY (guided flow, step 1) ──────────────────────────
/**
 * One card per configured store floor: completed audits, the date and score of the
 * newest one, any open Draft and the sections that have never been audited.
 *
 * Four grouped queries in total — floors, completed aggregates, audited sections and
 * open drafts — never one query per floor. Everything is read from stored rows, so a
 * store with no audits yet gets honest zeroes.
 */
exports.getVmFloorSummary = async (req, res) => {
  try {
    const activePoints = await getActiveVmPoints();
    const [floorRows] = await pool.query('SELECT * FROM vmfloors ORDER BY createdAt ASC');

    const baseWhere = [];
    const baseParams = [];
    const { clause: locClause, params: locParams } = await getLocationFilter(req, 's');
    if (locClause) {
      baseWhere.push(locClause.replace(/^\s*AND\s*/i, ''));
      baseParams.push(...locParams);
    }
    const scoped = (predicate, value) => ({
      sql: `WHERE ${baseWhere.concat(predicate).join(' AND ')}`,
      params: [...baseParams, value]
    });

    const completed = scoped('s.status <> ?', VM_STATUS.DRAFT);
    const drafts = scoped('s.status = ?', VM_STATUS.DRAFT);

    // lastScore = the score of the newest completed audit of that floor: answers are
    // concatenated newest-first (submission time, falling back to creation time for
    // rows filed before submittedAt existed) and only the first one is taken.
    const [aggRows] = await pool.query(`
      SELECT
        s.floor AS floor,
        COUNT(*) AS totalAudits,
        MAX(s.entryDate) AS lastAuditDate,
        SUBSTRING_INDEX(GROUP_CONCAT(s.scorePercent ORDER BY s.entryDate DESC, COALESCE(s.submittedAt, s.createdAt) DESC SEPARATOR ','), ',', 1) AS lastScore
      FROM vmsubmissions s
      ${completed.sql}
      GROUP BY s.floor
    `, completed.params);

    const [auditedSecRows] = await pool.query(`
      SELECT DISTINCT s.floor AS floor, s.section AS section
      FROM vmsubmissions s
      ${completed.sql}
    `, completed.params);

    const [draftRows] = await pool.query(`
      SELECT s.floor AS floor, COUNT(*) AS openDrafts,
             GROUP_CONCAT(DISTINCT s.section SEPARATOR ',') AS draftSections
      FROM vmsubmissions s
      ${drafts.sql}
      GROUP BY s.floor
    `, drafts.params);

    const aggMap = {};
    (aggRows || []).forEach(r => { aggMap[r.floor] = r; });
    const draftMap = {};
    (draftRows || []).forEach(r => { draftMap[r.floor] = r; });

    const auditedByFloor = {};
    (auditedSecRows || []).forEach(r => {
      if (!auditedByFloor[r.floor]) auditedByFloor[r.floor] = new Set();
      auditedByFloor[r.floor].add(r.section);
    });

    const floors = (floorRows || []).map(f => {
      let sections = [];
      try {
        sections = typeof f.sections === 'string' ? JSON.parse(f.sections) : (f.sections || []);
      } catch (e) {
        sections = String(f.sections || '').split(',').map(s => s.trim()).filter(Boolean);
      }
      sections = (sections || []).filter(Boolean);

      const agg = aggMap[f.name];
      const totalAudits = Number(agg ? agg.totalAudits : 0);
      const dr = draftMap[f.name];
      const draftSections = dr && dr.draftSections
        ? String(dr.draftSections).split(',').map(s => s.trim()).filter(Boolean)
        : [];
      const audited = auditedByFloor[f.name] || new Set();

      return {
        id: f.id,
        location_id: f.location_id,
        name: f.name,
        description: f.description || '',
        sections,
        sectionCount: sections.length,
        // Completed audits only, across every date for this floor.
        totalAudits,
        lastAuditDate: agg ? (dateKey(agg.lastAuditDate) || null) : null,
        lastScore: agg && agg.lastScore !== null && agg.lastScore !== undefined ? Number(agg.lastScore) : null,
        hasDraft: Number(dr ? dr.openDrafts : 0) > 0,
        draftSections,
        // A Draft is work in progress, so it does not make a section audited.
        unauditedSections: sections.filter(s => !audited.has(s))
      };
    });

    return res.json({
      success: true,
      today: getISTDateString(),
      totalQuestions: activePoints.length,
      floors
    });
  } catch (err) {
    console.error('[VM Floor Summary Error]', err);
    return errorRes(res, 'Unable to load the floor summary. Please try again.', [], 500);
  }
};

/** Answer payload validation shared by autosave and the legacy submit. */
function rejectBadEntries(entries, pointMap) {
  const bad = entries.find(e => !normalizeScore(e && e.score));
  if (bad) {
    return `Answer "${bad.score === undefined || bad.score === null ? '' : bad.score}" for checkpoint "${bad.pointId || bad.id || 'unknown'}" is not one of Pass, Fail, NA`;
  }
  const unknown = pointMap ? entries.find(e => !pointMap.has(String((e && e.pointId) || ''))) : null;
  if (unknown) {
    return `Checkpoint "${unknown.pointId}" is not part of the active VM checklist`;
  }
  return null;
}

/** VmDraftResponse — the audit exactly as stored, plus its recomputed score. */
async function buildDraftResponse(auditId, resumed) {
  const [rows] = await pool.query('SELECT * FROM vmsubmissions WHERE id = ? LIMIT 1', [auditId]);
  const audit = rows[0];
  const entries = await loadAuditEntries(auditId);
  const photos = await getVmPhotos(auditId);
  const score = scoreFromEntries(entries, Number(audit.total_questions || 0));

  return {
    success: true,
    auditId: audit.id,
    status: audit.status,
    floor: audit.floor,
    section: audit.section,
    shift: audit.shift,
    entryDate: dateKey(audit.entryDate) || '',
    locationId: audit.location_id,
    resumed: !!resumed,
    entries: entries.map(mapVmEntry),
    photos,
    score
  };
}

// ── 11. CREATE OR RESUME A DRAFT AUDIT ──────────────────────────────────────
/**
 * Idempotent by (store, floor, section, shift, IST day, auditor): calling it twice
 * returns the same open Draft with resumed:true instead of inserting a second row.
 * A different shift or a different day is a different row, so nothing in the audit
 * history is ever overwritten.
 */
exports.createOrResumeVmDraft = async (req, res) => {
  const body = req.body || {};
  const floor = String(body.floor || '').trim();
  const section = String(body.section || '').trim();
  const shift = String(body.shift || '').trim();

  if (!floor) return errorRes(res, 'A floor is required to start a VM audit', ['floor is required']);
  if (!section) return errorRes(res, 'A section is required to start a VM audit', ['section is required']);
  if (!VM_SHIFT_WHITELIST.includes(shift)) {
    return errorRes(res, `Shift must be one of ${VM_SHIFT_WHITELIST.join(', ')}`, ['shift is invalid']);
  }

  const locationId = resolveAuditLocationId(req);
  if (!locationId) {
    return errorRes(res, 'A store location is required to start a VM audit', ['locationId is required']);
  }
  if (!await assertLocationAccess(req.user, locationId)) {
    return res.status(403).json({
      success: false,
      message: `Access denied: store location ${locationId} is not assigned to your account`
    });
  }

  const entryDate = getISTDateString();
  const auditorId = req.user && req.user.id ? Number(req.user.id) : null;
  const auditorName = req.user ? (req.user.fullName || req.user.name || req.user.username) : 'CRM Manager';

  const conn = await pool.getConnection();
  try {
    const activePoints = await getActiveVmPoints();

    await conn.beginTransaction();

    // Locked read: two autosaving tabs must not both decide "no draft exists" and
    // each insert one.
    let sql = `SELECT id FROM vmsubmissions
                WHERE location_id = ? AND floor = ? AND section = ? AND shift = ? AND entryDate = ? AND status = ?`;
    const params = [locationId, floor, section, shift, entryDate, VM_STATUS.DRAFT];
    if (auditorId !== null) {
      sql += ' AND auditor_user_id = ?';
      params.push(auditorId);
    } else {
      sql += ' AND auditor_user_id IS NULL';
    }
    sql += ' ORDER BY createdAt DESC LIMIT 1 FOR UPDATE';

    const [found] = await conn.query(sql, params);
    if (found && found.length > 0) {
      await conn.commit();
      const response = await buildDraftResponse(found[0].id, true);
      await logAction(req.user ? req.user.username : auditorName, 'RESUME_VM_DRAFT', 'VM', {
        auditId: found[0].id,
        locationId,
        floor,
        section,
        shift,
        entryDate
      });
      return res.json(response);
    }

    const auditId = getUUID();
    await conn.query(`
      INSERT INTO vmsubmissions
        (id, location_id, entryDate, shift, floor, section, scorePercent, status, submittedBy, remarks,
         passed_count, failed_count, na_count, unrated_count, total_questions, auditor_user_id, updatedBy)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, '', 0, 0, 0, ?, ?, ?, ?)
    `, [
      auditId,
      locationId,
      entryDate,
      shift,
      floor,
      section,
      VM_STATUS.DRAFT,
      auditorName,
      activePoints.length,
      activePoints.length,
      auditorId,
      req.user ? (req.user.username || auditorName) : auditorName
    ]);

    await vmHistory.recordVmAuditEvent(conn, {
      submissionId: auditId,
      locationId,
      action: vmHistory.VM_EVENT.CREATED,
      statusAfter: VM_STATUS.DRAFT,
      summary: `${floor} · ${section} · ${shift} · ${activePoints.length} checkpoints`,
      actor: req.user
    });

    await conn.commit();

    const response = await buildDraftResponse(auditId, false);

    try {
      realtimeService.emitVmChange('CREATE', {
        id: auditId,
        location_id: locationId,
        floor,
        section,
        shift,
        status: VM_STATUS.DRAFT
      }, locationId);
    } catch (wsErr) {
      console.warn('[VM Realtime Emit Error]', wsErr.message);
    }

    await logAction(req.user ? req.user.username : auditorName, 'CREATE_VM_DRAFT', 'VM', {
      auditId,
      locationId,
      floor,
      section,
      shift,
      entryDate,
      totalQuestions: activePoints.length
    });

    return res.json(response);
  } catch (err) {
    try { await conn.rollback(); } catch (e) {}
    console.error('[Create VM Draft Error]', err);
    return errorRes(res, 'Unable to open the checklist. Please try again.', [], 500);
  } finally {
    conn.release();
  }
};

// ── 12. AUTOSAVE A DRAFT AUDIT ──────────────────────────────────────────────
/**
 * Debounced save of the answers typed so far. Answers are upserted by
 * (submissionId, pointId), so the same checkpoint saved ten times is still one row.
 * A submitted audit is refused: history is never rewritten.
 */
exports.saveVmDraft = async (req, res) => {
  const body = req.body || {};
  const entries = body.entries;
  const shift = body.shift;

  if (!Array.isArray(entries)) {
    return errorRes(res, 'entries must be an array of checklist answers', ['entries must be an array']);
  }
  if (shift !== undefined && !VM_SHIFT_WHITELIST.includes(String(shift).trim())) {
    return errorRes(res, `Shift must be one of ${VM_SHIFT_WHITELIST.join(', ')}`, ['shift is invalid']);
  }

  const audit = await loadWritableAudit(req, res);
  if (!audit) return;
  if (!refuseIfSubmitted(audit, res)) return;

  const auditId = audit.id;
  const activePoints = await getActiveVmPoints();
  const pointMap = new Map(activePoints.map(p => [String(p.id), p]));

  const problem = entries.length > 0 ? rejectBadEntries(entries, pointMap) : null;
  if (problem) return errorRes(res, problem, ['entries are invalid']);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const actor = req.user ? (req.user.username || req.user.fullName || 'VM') : 'VM';
    const beforeEntries = await loadAuditEntries(auditId, conn);
    const beforeScore = new Map(beforeEntries.map(e => [String(e.pointId), String(e.score || '')]));
    const beforeNote = new Map(beforeEntries.map(e => [String(e.pointId), String(e.comment || e.remarks || '')]));

    if (shift !== undefined && String(shift) !== String(audit.shift)) {
      await conn.query('UPDATE vmsubmissions SET shift = ?, updatedBy = ? WHERE id = ?', [String(shift).trim(), actor, auditId]);
    } else {
      await conn.query('UPDATE vmsubmissions SET updatedBy = ? WHERE id = ?', [actor, auditId]);
    }

    const changedPoints = [];
    for (const e of entries) {
      const pointId = String(e.pointId || e.id || '');
      const nextComment = e.comment !== undefined && e.comment !== null ? e.comment : e.remarks;
      const normalized = normalizeScore(e.score);
      if (String(beforeScore.get(pointId) || '') !== String(normalized || '') ||
          String(beforeNote.get(pointId) || '') !== String(nextComment || '')) {
        changedPoints.push(pointId);
      }
      await upsertAuditEntry(conn, auditId, {
        pointId,
        pointTitle: e.pointTitle || e.title,
        score: e.score,
        // The guided flow sends `comment`; the legacy page sends `remarks`.
        comment: nextComment,
        observation: e.observation,
        correctiveAction: e.correctiveAction !== undefined ? e.correctiveAction : e.corrective_action,
        photoUrl: e.photoUrl
      }, pointMap);
    }

    const score = await recomputeAuditScore(conn, auditId, activePoints.length);

    // Only a save that actually changed an answer is an event. Autosave fires on
    // every blur, so recording all of them would bury the real edits.
    if (changedPoints.length > 0) {
      await vmHistory.recordVmAuditEvent(conn, {
        submissionId: auditId,
        locationId: audit.location_id,
        action: vmHistory.VM_EVENT.DRAFT_SAVED,
        pointId: changedPoints.length === 1 ? changedPoints[0] : null,
        newValue: changedPoints.join(', ').slice(0, 5000),
        scorePercent: score.percent,
        summary: `${changedPoints.length} checkpoint${changedPoints.length === 1 ? '' : 's'} updated · ${vmHistory.describeScore(score)}`,
        actor: req.user
      });
    }

    const [saved] = await conn.query('SELECT updatedAt FROM vmsubmissions WHERE id = ? LIMIT 1', [auditId]);

    await conn.commit();

    return res.json({
      success: true,
      savedAt: (saved && saved[0] && saved[0].updatedAt) || new Date().toISOString(),
      score,
      progress: { rated: score.rated, total: score.totalQuestions }
    });
  } catch (err) {
    try { await conn.rollback(); } catch (e) {}
    console.error('[Save VM Draft Error]', err);
    return errorRes(res, 'Unable to save the checklist. Please try again.', [], 500);
  } finally {
    conn.release();
  }
};

// ── 13. SUBMIT A DRAFT AUDIT ────────────────────────────────────────────────
/**
 * Closes a Draft. The server re-reads the stored answers and recomputes the score
 * (N/A excluded from the denominator) — nothing about the result is taken from the
 * client. Submitting twice is refused with 409 instead of writing a second record.
 */
exports.submitVmAudit = async (req, res) => {
  const body = req.body || {};
  if (body.confirm !== true) {
    return errorRes(res, 'Confirm the submission before it is filed (confirm must be true)', ['confirm is required']);
  }

  const audit = await loadWritableAudit(req, res);
  if (!audit) return;
  if (!refuseIfSubmitted(audit, res)) return;

  const auditId = audit.id;
  const missingScope = [];
  if (!String(audit.floor || '').trim()) missingScope.push('floor');
  if (!String(audit.section || '').trim()) missingScope.push('section');
  if (!VM_SHIFT_WHITELIST.includes(String(audit.shift || '').trim())) missingScope.push('shift');
  if (missingScope.length > 0) {
    return errorRes(res, `This audit is missing: ${missingScope.join(', ')}`, ['audit scope incomplete']);
  }

  const activePoints = await getActiveVmPoints();
  if (activePoints.length === 0) {
    return errorRes(res, 'The VM checklist has no active checkpoints to score against', ['no active checkpoints']);
  }

  const entries = await loadAuditEntries(auditId);
  const answered = new Map(entries.map(e => [String(e.pointId), e]));

  const unanswered = activePoints.filter(p => {
    const row = answered.get(String(p.id));
    return !row || !normalizeScore(row.score);
  });
  if (unanswered.length > 0) {
    const preview = unanswered.slice(0, 3).map(p => `Q${p.position} ${p.title}`).join('; ');
    return errorRes(
      res,
      `${unanswered.length} of ${activePoints.length} checkpoints are unanswered: ${preview}` +
        (unanswered.length > 3 ? ' …' : ''),
      unanswered.map(p => p.id)
    );
  }

  // A Fail is only filable once the store has said what it will do about it, or
  // added a comment. A bare observation is not a follow-up, so it does not count.
  const needsAction = entries.filter(e => {
    if (normalizeScore(e.score) !== 'Fail') return false;
    return ![e.corrective_action, e.comment]
      .some(v => v !== null && v !== undefined && String(v).trim() !== '');
  });
  if (needsAction.length > 0) {
    const titles = needsAction.slice(0, 3).map(e => e.pointTitle || e.pointId).join('; ');
    return errorRes(
      res,
      `${needsAction.length} failed checkpoint(s) need a corrective action or a comment before this audit can be filed: ${titles}` +
        (needsAction.length > 3 ? ' …' : ''),
      needsAction.map(e => e.pointId)
    );
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const actor = req.user ? (req.user.username || req.user.fullName || 'VM') : 'VM';
    const score = await recomputeAuditScore(conn, auditId, activePoints.length);
    const status = score.percent >= VM_PASS_MARK ? VM_STATUS.COMPLETED : VM_STATUS.REVIEW;

    // Guarded on status = 'Draft': a concurrent submit loses here instead of
    // overwriting a filed audit.
    const [result] = await conn.query(
      `UPDATE vmsubmissions
          SET status = ?, submittedAt = NOW(), submittedBy = ?, updatedBy = ?
        WHERE id = ? AND status = ?`,
      [status, audit.submittedBy || actor, actor, auditId, VM_STATUS.DRAFT]
    );
    if (!result || result.affectedRows === 0) {
      await conn.rollback();
      return res.status(409).json({
        success: false,
        message: 'This audit was submitted by another session and is no longer a draft',
        auditId
      });
    }

    await vmHistory.recordVmAuditEvent(conn, {
      submissionId: auditId,
      locationId: audit.location_id,
      action: vmHistory.VM_EVENT.SUBMITTED,
      statusBefore: VM_STATUS.DRAFT,
      statusAfter: status,
      scorePercent: score.percent,
      summary: `${audit.floor} · ${audit.section} · ${audit.shift} · ${vmHistory.describeScore(score)}`,
      actor: req.user
    });

    await conn.commit();

    const [stamp] = await pool.query('SELECT submittedAt FROM vmsubmissions WHERE id = ? LIMIT 1', [auditId]);
    const response = await buildDraftResponse(auditId, false);
    response.submittedAt = (stamp && stamp[0] && stamp[0].submittedAt) || null;
    response.message = `VM audit submitted (${response.score.percent}% — ${response.status})`;

    try {
      realtimeService.emitVmChange('UPDATE', {
        id: auditId,
        location_id: audit.location_id,
        floor: audit.floor,
        section: audit.section,
        scorePercent: response.score.percent,
        status
      }, audit.location_id);
    } catch (wsErr) {
      console.warn('[VM Realtime Emit Error]', wsErr.message);
    }

    await logAction(req.user ? req.user.username : actor, 'SUBMIT_VM_AUDIT', 'VM', {
      auditId,
      locationId: audit.location_id,
      floor: audit.floor,
      section: audit.section,
      shift: audit.shift,
      scorePercent: response.score.percent,
      status,
      passed: score.passed,
      failed: score.failed,
      na: score.notApplicable
    });

    return res.json(response);
  } catch (err) {
    try { await conn.rollback(); } catch (e) {}
    console.error('[Submit VM Audit Error]', err);
    return errorRes(res, 'Unable to submit the checklist. Please try again.', [], 500);
  } finally {
    conn.release();
  }
};

// ── 14. GET WHAT NEEDS ATTENTION ────────────────────────────────────────────
/**
 * Ranked weak points, computed only from audits that are already filed. Nothing is
 * invented: with no stored audits the answer is two empty lists and
 * auditsConsidered 0, not a wall of 0% rows.
 */
exports.getVmAttention = async (req, res) => {
  try {
    const {
      locationId,
      dateFrom,
      dateTo,
      dateRange
    } = req.query || {};

    const whereClauses = ["s.status <> ?"];
    const params = [VM_STATUS.DRAFT];

    const { clause: locClause, params: locParams } = await getLocationFilter(req, 's');
    if (locClause) {
      whereClauses.push(locClause.replace(/^\s*AND\s*/i, ''));
      params.push(...locParams);
    }

    if (locationId && locationId !== 'All' && locationId !== 'ALL') {
      const locNum = Number(locationId);
      if (!await assertLocationAccess(req.user, locNum)) {
        return res.status(403).json({
          success: false,
          message: `Access denied: store location ${locNum} is not assigned to your account`
        });
      }
      whereClauses.push('s.location_id = ?');
      params.push(locNum);
    }

    const dateFilter = getDateCondition(dateRange, dateFrom, dateTo, 's.entryDate');
    if (dateFilter.clause) {
      whereClauses.push(dateFilter.clause.replace(/^\s*AND\s*/i, ''));
      params.push(...dateFilter.params);
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

    const [countRows] = await pool.query(`SELECT COUNT(*) AS audits FROM vmsubmissions s ${whereSql}`, params);
    const auditsConsidered = Number((countRows[0] && countRows[0].audits) || 0);

    if (auditsConsidered === 0) {
      return res.json({
        success: true,
        lowestQuestions: [],
        lowestSections: [],
        auditsConsidered: 0
      });
    }

    const [activePoints, questionRows, secAnswers, secScores] = await Promise.all([
      getActiveVmPoints(),
      pool.query(`
        SELECT
          e.pointId,
          SUM(CASE WHEN e.score = 'Pass' THEN 1 ELSE 0 END) AS passed,
          SUM(CASE WHEN e.score = 'Fail' THEN 1 ELSE 0 END) AS failed,
          SUM(CASE WHEN e.score = 'NA' THEN 1 ELSE 0 END) AS naCount
        FROM vmsubmissionentries e
        INNER JOIN vmsubmissions s ON s.id = e.submissionId
        ${whereSql}
        GROUP BY e.pointId
      `, params).then(([rows]) => rows),
      pool.query(`
        SELECT
          s.floor AS floor,
          s.section AS section,
          SUM(CASE WHEN e.score = 'Pass' THEN 1 ELSE 0 END) AS passed,
          SUM(CASE WHEN e.score = 'Fail' THEN 1 ELSE 0 END) AS failed
        FROM vmsubmissions s
        INNER JOIN vmsubmissionentries e ON e.submissionId = s.id
        ${whereSql}
        GROUP BY s.floor, s.section
      `, params).then(([rows]) => rows),
      pool.query(`
        SELECT s.floor AS floor, s.section AS section, COUNT(*) AS audits, AVG(s.scorePercent) AS avgScore
        FROM vmsubmissions s
        ${whereSql}
        GROUP BY s.floor, s.section
      `, params).then(([rows]) => rows)
    ]);

    const titles = {};
    (activePoints || []).forEach(p => { titles[p.id] = p.title; });

    const gradedRate = (passed, failed) => {
      const graded = Number(passed || 0) + Number(failed || 0);
      return graded > 0 ? Number(((Number(passed || 0) / graded) * 100).toFixed(1)) : null;
    };

    const lowestQuestions = (questionRows || [])
      .map(r => {
        const passed = Number(r.passed || 0);
        const failed = Number(r.failed || 0);
        const na = Number(r.naCount || 0);
        return {
          pointId: r.pointId,
          pointTitle: titles[r.pointId] || r.pointId,
          // N/A leaves the denominator, exactly as in the audit score.
          passRate: gradedRate(passed, failed),
          passed,
          failed,
          notApplicable: na,
          audits: passed + failed + na
        };
      })
      .filter(q => q.passRate !== null)
      .sort((a, b) => a.passRate - b.passRate || b.failed - a.failed);

    const scoreMap = {};
    (secScores || []).forEach(r => { scoreMap[`${r.floor}||${r.section}`] = r; });

    const lowestSections = (secAnswers || [])
      .map(r => {
        const key = `${r.floor}||${r.section}`;
        const sc = scoreMap[key] || {};
        return {
          floor: r.floor,
          section: r.section,
          passRate: gradedRate(r.passed, r.failed),
          audits: Number(sc.audits || 0),
          avgScore: sc.avgScore !== undefined && sc.avgScore !== null
            ? Number(Number(sc.avgScore).toFixed(1))
            : null
        };
      })
      .filter(s => s.passRate !== null)
      .sort((a, b) => a.passRate - b.passRate || a.avgScore - b.avgScore);

    return res.json({
      success: true,
      lowestQuestions,
      lowestSections,
      auditsConsidered
    });
  } catch (err) {
    console.error('[VM Attention Error]', err);
    return errorRes(res, 'Unable to load the attention list. Please try again.', [], 500);
  }
};
