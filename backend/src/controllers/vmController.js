/**
 * BSC Textiles CRM — Visual Merchandising (VM) Controller
 * Complete VM Checklist, VM Dashboard Analytics, Audit History, Live Data & Photo Linking
 */

const pool = require('../config/db');
const crypto = require('crypto');
const { errorRes } = require('../utils/response');
const { logAction } = require('../utils/logger');
const { getLocationFilter, injectLocationId } = require('../middleware/auth');
const realtimeService = require('../services/realtimeService');

function getUUID() {
  return 'vm_' + crypto.randomBytes(12).toString('hex');
}

/**
 * Format date helpers for consistent SQL queries
 */
function getDateCondition(dateRange, dateFrom, dateTo, column = 's.entryDate') {
  const today = new Date().toISOString().split('T')[0];
  if (dateRange === 'today') {
    return { clause: `AND ${column} = ?`, params: [today] };
  }
  if (dateRange === 'yesterday') {
    const yest = new Date(Date.now() - 86400000).toISOString().split('T')[0];
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
      averageScore: Number(Number(kpi.avgScore || 0).toFixed(1)),
      compliancePercentage: Number(Number(kpi.compliancePercent || 0).toFixed(1)),
      imagesUploaded: totalImagesUploaded,
      storesAudited: Number(kpi.storesAudited || 0),
      floorsAudited: Number(kpi.floorsAudited || 0),
      latestAuditDate: kpi.latestAuditDate ? new Date(kpi.latestAuditDate).toISOString().split('T')[0] : null
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
      lastDate: s.lastDate ? new Date(s.lastDate).toISOString().split('T')[0] : null
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
      date: t.date ? new Date(t.date).toISOString().split('T')[0] : '—',
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
            SUM(CASE WHEN e.score != 'Pass' THEN 1 ELSE 0 END) as failCount
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
          const st = statsMap[q.id] || { totalAnswers: 0, passCount: 0, failCount: 0 };
          const tot = Number(st.totalAnswers || 0);
          const pass = Number(st.passCount || 0);
          const passPercent = tot > 0 ? Number(((pass / tot) * 100).toFixed(1)) : 100;
          return {
            id: q.id,
            number: q.position || 1,
            title: q.title,
            passCount: pass,
            failCount: Number(st.failCount || 0),
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
      entryDate: r.entryDate ? new Date(r.entryDate).toISOString().split('T')[0] : '',
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
        inspectionDate: p.inspectionDate || (p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : ''),
        scorePercent: p.scorePercent !== null && p.scorePercent !== undefined ? Number(p.scorePercent) : null,
        status: p.auditStatus || (p.scorePercent !== null && p.scorePercent !== undefined ? (Number(p.scorePercent) >= 80 ? 'Passed' : 'Review') : 'Verified'),
        shift: p.shift || 'Opening',
        remarks: p.auditRemarks || '',
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
    return errorRes(res, 'Failed to fetch VM dashboard metrics: ' + err.message, [err.message], 500);
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
        s.total_questions,
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

    if (auditIds.length > 0) {
      try {
        const [entries] = await pool.query(
          'SELECT id, submissionId, pointId, pointTitle, score, remarks, photoUrl FROM vmsubmissionentries WHERE submissionId IN (?) ORDER BY pointId ASC',
          [auditIds]
        );
        (entries || []).forEach(e => {
          if (!entriesMap[e.submissionId]) entriesMap[e.submissionId] = [];
          entriesMap[e.submissionId].push(e);
        });
      } catch (e) {}

      try {
        const [photos] = await pool.query(
          "SELECT id, submission_id, location_name, floor, section, point_id, file_name, file_path, file_size, mime_type, uploaded_by, inspection_date, created_at FROM vm_checklist_photos WHERE submission_id IN (?) AND status != 'Deleted' AND deleted_at IS NULL ORDER BY created_at DESC",
          [auditIds]
        );
        (photos || []).forEach(p => {
          if (!photosMap[p.submission_id]) photosMap[p.submission_id] = [];
          photosMap[p.submission_id].push({
            id: p.id,
            submissionId: p.submission_id,
            locationName: p.location_name,
            floor: p.floor,
            section: p.section,
            pointId: p.point_id,
            fileName: p.file_name,
            fileUrl: p.file_path,
            streamUrl: `/api/vm/photos/${p.id}/file`,
            fileSize: p.file_size,
            mimeType: p.mime_type,
            uploadedBy: p.uploaded_by,
            createdAt: p.created_at
          });
        });
      } catch (e) {}
    }

    const audits = rows.map(r => ({
      ...r,
      scorePercent: Number(r.scorePercent || 0),
      entryDate: r.entryDate ? new Date(r.entryDate).toISOString().split('T')[0] : '',
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
    return errorRes(res, 'Failed to fetch VM audits: ' + err.message, [err.message], 500);
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

    const [entries] = await pool.query(
      'SELECT * FROM vmsubmissionentries WHERE submissionId = ? ORDER BY pointId ASC',
      [auditId]
    );

    const [photos] = await pool.query(
      "SELECT * FROM vm_checklist_photos WHERE submission_id = ? AND status != 'Deleted' AND deleted_at IS NULL ORDER BY created_at DESC",
      [auditId]
    );

    const formattedPhotos = (photos || []).map(p => ({
      id: p.id,
      submissionId: p.submission_id,
      locationId: p.location_id,
      locationName: p.location_name,
      floor: p.floor,
      section: p.section,
      pointId: p.point_id,
      fileName: p.file_name,
      fileUrl: p.file_path,
      streamUrl: `/api/vm/photos/${p.id}/file`,
      fileSize: p.file_size,
      mimeType: p.mime_type,
      uploadedBy: p.uploaded_by,
      inspectionDate: p.inspection_date,
      createdAt: p.created_at
    }));

    return res.json({
      success: true,
      audit: {
        ...audit,
        scorePercent: Number(audit.scorePercent || 0),
        entryDate: audit.entryDate ? new Date(audit.entryDate).toISOString().split('T')[0] : '',
        entries: entries || [],
        photos: formattedPhotos
      }
    });
  } catch (err) {
    console.error('[Get VM Audit Detail Error]', err);
    return errorRes(res, 'Failed to fetch VM audit detail: ' + err.message, [err.message], 500);
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

    const locationId = Number(req.body.locationId) || Number(req.body.location_id) || injectLocationId(req) || (req.user && req.user.locationId) || 1;
    const submissionId = getUUID();
    const entryDate = new Date().toISOString().split('T')[0];

    // Compute passed and failed count
    let passedCount = 0;
    let failedCount = 0;
    const totalQuestions = entries.length > 0 ? entries.length : 10;

    if (Array.isArray(entries) && entries.length > 0) {
      entries.forEach(e => {
        if (e.score === 'Pass') passedCount++;
        else failedCount++;
      });
    }

    const calculatedScore = totalQuestions > 0 ? Number(((passedCount / totalQuestions) * 100).toFixed(2)) : (scorePercent !== undefined ? Number(scorePercent) : 100.00);
    const finalScore = scorePercent !== undefined ? Number(scorePercent) : calculatedScore;
    const auditStatus = finalScore >= 80 ? 'Completed' : 'Review';
    const auditorName = submittedBy || (req.user ? (req.user.fullName || req.user.name || req.user.username) : 'CRM Manager');

    // Insert Audit
    await pool.query(`
      INSERT INTO vmsubmissions 
        (id, location_id, entryDate, shift, floor, section, scorePercent, status, submittedBy, remarks, passed_count, failed_count, total_questions)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      passedCount,
      failedCount,
      totalQuestions
    ]);

    // Insert Entries
    if (Array.isArray(entries) && entries.length > 0) {
      for (const e of entries) {
        const eId = 'vme_' + crypto.randomBytes(10).toString('hex');
        await pool.query(`
          INSERT INTO vmsubmissionentries (id, submissionId, pointId, pointTitle, score, remarks, photoUrl)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          eId,
          submissionId,
          e.pointId || e.id || 'vm_q',
          e.pointTitle || e.title || 'Check Point',
          e.score || 'Pass',
          e.remarks || '',
          e.photoUrl || ''
        ]);
      }
    }

    // Link uploaded photos to this submission
    if (Array.isArray(photoIds) && photoIds.length > 0) {
      const placeholders = photoIds.map(() => '?').join(', ');
      await pool.query(
        `UPDATE vm_checklist_photos SET submission_id = ?, inspection_date = ? WHERE id IN (${placeholders})`,
        [submissionId, entryDate, ...photoIds]
      );
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
        scorePercent: finalScore,
        status: auditStatus,
        submittedBy: auditorName,
        photosCount: photoIds.length
      }
    });
  } catch (err) {
    console.error('[Submit VM Error]', err);
    return errorRes(res, 'Failed to submit VM audit: ' + err.message, [err.message], 500);
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
        r.entryDate ? new Date(r.entryDate).toISOString().split('T')[0] : '',
        r.shift || 'Opening',
        r.floor || '',
        r.section || '',
        `${r.scorePercent || 0}%`,
        r.status || 'Completed',
        r.passed_count || 0,
        r.failed_count || 0,
        r.total_questions || 10,
        r.photoCount || 0,
        r.submittedBy || '',
        r.remarks || ''
      ];
      csvContent += row.map(csvEscape).join(',') + '\r\n';
    });

    const filename = `BSC_VM_Audits_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (err) {
    console.error('[Export VM Audits Error]', err);
    return errorRes(res, 'Failed to export VM audits: ' + err.message, [err.message], 500);
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
    const { name, description, sections } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Floor name is required' });
    }
    const secList = Array.isArray(sections) ? sections.map((s) => String(s).trim()).filter(Boolean) : [];
    if (secList.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one section is required for this floor' });
    }

    const id = getUUID();
    await pool.query(`
      INSERT INTO vmfloors (id, name, description, sections)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE description = VALUES(description), sections = VALUES(sections)
    `, [id, name.trim(), description ? description.trim() : '', JSON.stringify(secList)]);

    return res.json({
      success: true,
      message: 'Store floor created successfully',
      floor: { id, name: name.trim(), description: description ? description.trim() : '', sections: secList }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── 8. DELETE VM FLOOR ──────────────────────────────────────────────────────
exports.deleteVmFloor = async (req, res) => {
  try {
    const floorId = req.params.id || req.body.id;
    if (!floorId) {
      return res.status(400).json({ success: false, message: 'Floor ID is required' });
    }
    await pool.query('DELETE FROM vmfloors WHERE id = ?', [floorId]);
    return res.json({ success: true, message: 'Floor deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── 9. GET VM CHECKLIST POINTS (QUESTIONS) ──────────────────────────────────
exports.getVmPoints = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM vmchecklistpoints WHERE isActive = TRUE ORDER BY position ASC');
    if (rows && rows.length >= 10) {
      return res.json({ success: true, points: rows });
    }
    return res.json({ success: true, points: [] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
