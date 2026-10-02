/**
 * BSC Textiles — Executive Daily Report Scheduler & Aggregator
 * Runs daily at midnight 12:00 AM IST (18:30 UTC)
 * Aggregates:
 *  1. Total Footfall (store breakdown + overall)
 *  2. Customer Feedbacks (ratings, sentiment, counts)
 *  3. M-Check checklist compliance
 *  4. VM (Visual Merchandising) submissions & photos
 *  5. Wedding CRM registrations
 * Dispatches HTML Executive Summary to ADMIN_EMAIL / system settings email.
 */

const db = require('../config/db');
const { sendDailyAdminReportEmail } = require('../config/email');

// Helper to get formatted IST date strings
function getISTDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  // Using Asia/Kolkata timezone
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
}

function formatDisplayDate(dateStr) {
  try {
    const [y, m, d] = dateStr.split('-');
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    return dt.toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (e) {
    return dateStr;
  }
}

/**
 * Fetch the configured recipient email for admin reports.
 * Checks `Setting` table (key: `admin_report_email` or `admin_email`), then falls back to `process.env.ADMIN_EMAIL`.
 */
async function getAdminReportEmail() {
  try {
    const [rows] = await db.query(
      `SELECT settingValue FROM Setting WHERE settingKey IN ('admin_report_email', 'admin_email') AND settingValue IS NOT NULL AND settingValue != '' ORDER BY id DESC LIMIT 1`
    );
    if (rows && rows.length > 0 && rows[0].settingValue) {
      return String(rows[0].settingValue).trim();
    }
  } catch (err) {
    console.warn('[ReportScheduler] Setting lookup notice:', err.message);
  }
  return process.env.ADMIN_EMAIL || process.env.SMTP_USER || '';
}

/**
 * Compile all metrics for a given calendar date (YYYY-MM-DD in IST).
 */
async function compileDailyReportData(dateStr) {
  const reportDate = dateStr || getISTDate(-1); // Default to yesterday's completed day
  const dateFormatted = formatDisplayDate(reportDate);

  // ── 1. Footfall Metrics ──────────────────────────────────────────────────
  let totalFootfall = 0;
  const storeFootfalls = [];

  const storeConfigs = [
    { id: 1, code: 'BEL', name: 'BSC Textiles Belagavi' },
    { id: 2, code: 'DAV', name: 'BSC Textiles Davanagere' },
    { id: 3, code: 'SHI', name: 'BSC Textiles Shivamogga' }
  ];

  for (const store of storeConfigs) {
    try {
      const [rows] = await db.query(
        `SELECT 
           COALESCE(SUM(visitors), 0) AS totalVisitors,
           COUNT(DISTINCT slotHour) AS activeSlots,
           MAX(visitors) AS peakVisitors
         FROM FootfallEntries 
         WHERE location_id = ? AND entryDate = ?`,
        [store.id, reportDate]
      );

      const [peakRow] = await db.query(
        `SELECT slotHour, visitors 
         FROM FootfallEntries 
         WHERE location_id = ? AND entryDate = ? AND visitors > 0
         ORDER BY visitors DESC, slotHour ASC LIMIT 1`,
        [store.id, reportDate]
      );

      const storeTotal = Number(rows[0]?.totalVisitors || 0);
      totalFootfall += storeTotal;

      let peakHourStr = 'N/A';
      if (peakRow && peakRow[0]) {
        const h = Number(peakRow[0].slotHour);
        const formatHour = h > 12 ? `${h - 12}:00 PM` : h === 12 ? '12:00 PM' : `${h}:00 AM`;
        peakHourStr = `${formatHour} (${peakRow[0].visitors} visitors)`;
      }

      storeFootfalls.push({
        storeId: store.id,
        storeName: store.name,
        code: store.code,
        visitors: storeTotal,
        activeSlots: Number(rows[0]?.activeSlots || 0),
        peakHour: peakHourStr,
        peakVisitors: Number(rows[0]?.peakVisitors || 0)
      });
    } catch (err) {
      console.warn(`[ReportScheduler] Footfall query error for store ${store.code}:`, err.message);
      storeFootfalls.push({ storeId: store.id, storeName: store.name, code: store.code, visitors: 0, activeSlots: 0, peakHour: 'N/A' });
    }
  }

  // ── 2. Feedback Metrics ──────────────────────────────────────────────────
  let totalFeedbacks = 0;
  let totalRatingSum = 0;
  let escalatedFeedbacks = 0;
  const storeFeedbacks = [];

  const feedbackTables = [
    { code: 'BEL', name: 'BSC Textiles Belagavi', table: 'BSC_Feedback_Belagavi' },
    { code: 'DAV', name: 'BSC Textiles Davanagere', table: 'BSC_Feedback_Davanagere' },
    { code: 'SHI', name: 'BSC Textiles Shivamogga', table: 'BSC_Feedback_Shivamogga' }
  ];

  for (const ft of feedbackTables) {
    try {
      const [fRows] = await db.query(
        `SELECT 
           COUNT(*) AS count,
           COALESCE(AVG(overallRating), 0) AS avgRating,
           SUM(CASE WHEN overallRating >= 4 THEN 1 ELSE 0 END) AS posCount,
           SUM(CASE WHEN overallRating = 3 THEN 1 ELSE 0 END) AS neuCount,
           SUM(CASE WHEN overallRating <= 2 AND overallRating > 0 THEN 1 ELSE 0 END) AS negCount
         FROM ${ft.table}
         WHERE DATE(createdAt) = ? OR entryDate = ?`,
        [reportDate, reportDate]
      );

      const cnt = Number(fRows[0]?.count || 0);
      const avg = Number(fRows[0]?.avgRating || 0);
      const pos = Number(fRows[0]?.posCount || 0);
      const neu = Number(fRows[0]?.neuCount || 0);
      const neg = Number(fRows[0]?.negCount || 0);

      totalFeedbacks += cnt;
      totalRatingSum += (avg * cnt);
      escalatedFeedbacks += neg;

      storeFeedbacks.push({
        code: ft.code,
        storeName: ft.name,
        count: cnt,
        avg: avg > 0 ? avg.toFixed(1) : '5.0',
        positive: pos,
        neutral: neu,
        negative: neg
      });
    } catch (err) {
      console.warn(`[ReportScheduler] Feedback query error for ${ft.table}:`, err.message);
      storeFeedbacks.push({ code: ft.code, storeName: ft.name, count: 0, avg: '5.0', positive: 0, neutral: 0, negative: 0 });
    }
  }

  const overallAvgRating = totalFeedbacks > 0 ? (totalRatingSum / totalFeedbacks).toFixed(1) : '5.0';

  // ── 3. M-Check Compliance ────────────────────────────────────────────────
  const mcheckBreakdown = [];
  let mcheckTotal = 0;
  let mcheckPassed = 0;
  let mcheckFailed = 0;

  for (const store of storeConfigs) {
    try {
      const [mRows] = await db.query(
        `SELECT 
           COUNT(*) AS total,
           SUM(CASE WHEN compliance_status = 'compliant' OR system_status IN ('PASS', 'COMPLETED') THEN 1 ELSE 0 END) AS passed,
           SUM(CASE WHEN compliance_status = 'non_compliant' OR system_status = 'FAIL' THEN 1 ELSE 0 END) AS failed
         FROM mcheck_responses
         WHERE location_id = ? AND response_date = ?`,
        [store.id, reportDate]
      );

      const tot = Number(mRows[0]?.total || 0);
      const pass = Number(mRows[0]?.passed || 0);
      const fail = Number(mRows[0]?.failed || 0);
      const rate = tot > 0 ? Math.round((pass / tot) * 100) : 100;

      mcheckTotal += tot;
      mcheckPassed += pass;
      mcheckFailed += fail;

      mcheckBreakdown.push({
        storeName: store.name,
        total: tot,
        passed: pass,
        failed: fail,
        complianceRate: rate
      });
    } catch (err) {
      mcheckBreakdown.push({ storeName: store.name, total: 0, passed: 0, failed: 0, complianceRate: 100 });
    }
  }

  const overallMcheckRate = mcheckTotal > 0 ? Math.round((mcheckPassed / mcheckTotal) * 100) : 100;

  // ── 4. VM (Visual Merchandising) ─────────────────────────────────────────
  const vmBreakdown = [];
  let vmTotalSubmissions = 0;
  let vmTotalPhotos = 0;

  for (const store of storeConfigs) {
    try {
      const [vRows] = await db.query(
        `SELECT COUNT(*) AS cnt 
         FROM vmsubmissions 
         WHERE location_id = ? AND (DATE(submission_date) = ? OR DATE(created_at) = ?)`,
        [store.id, reportDate, reportDate]
      );
      const [pRows] = await db.query(
        `SELECT COUNT(*) AS cnt 
         FROM vm_checklist_photos 
         WHERE location_id = ? AND DATE(created_at) = ? AND (status != 'Deleted' OR status IS NULL)`,
        [store.id, reportDate]
      );

      const subs = Number(vRows[0]?.cnt || 0);
      const photos = Number(pRows[0]?.cnt || 0);

      vmTotalSubmissions += subs;
      vmTotalPhotos += photos;

      vmBreakdown.push({
        storeName: store.name,
        submissions: subs,
        photos: photos
      });
    } catch (err) {
      vmBreakdown.push({ storeName: store.name, submissions: 0, photos: 0 });
    }
  }

  // ── 5. Wedding CRM Registrations ─────────────────────────────────────────
  const weddingBreakdown = [];
  let totalWeddingLeads = 0;

  for (const store of storeConfigs) {
    try {
      const [wRows] = await db.query(
        `SELECT COUNT(*) AS cnt 
         FROM wedding_customers 
         WHERE location_id = ? AND DATE(created_at) = ?`,
        [store.id, reportDate]
      );
      const cnt = Number(wRows[0]?.cnt || 0);
      totalWeddingLeads += cnt;
      weddingBreakdown.push({ storeName: store.name, count: cnt });
    } catch (err) {
      weddingBreakdown.push({ storeName: store.name, count: 0 });
    }
  }

  return {
    reportDate,
    dateFormatted,
    totalFootfall,
    storeFootfalls,
    totalFeedbacks,
    storeFeedbacks,
    avgRating: overallAvgRating,
    escalatedFeedbacks,
    mcheckStats: {
      total: mcheckTotal,
      passed: mcheckPassed,
      failed: mcheckFailed,
      complianceRate: overallMcheckRate,
      storeBreakdown: mcheckBreakdown
    },
    vmStats: {
      totalSubmissions: vmTotalSubmissions,
      totalPhotos: vmTotalPhotos,
      storeBreakdown: vmBreakdown
    },
    weddingStats: {
      totalLeads: totalWeddingLeads,
      storeBreakdown: weddingBreakdown
    }
  };
}

/**
 * Generate and send the daily report.
 * Can be triggered automatically by midnight scheduler or manually via API.
 */
async function generateAndSendDailyReport(targetDate = null, manualRecipient = null) {
  try {
    const recipient = manualRecipient || await getAdminReportEmail();
    if (!recipient) {
      console.warn('[ReportScheduler] Cannot send daily report: no recipient email configured in Setting or ADMIN_EMAIL');
      return { success: false, error: 'No admin report email configured' };
    }

    // If no target date supplied, calculate the completed day's date
    const dateToReport = targetDate || getISTDate(-1);
    console.log(`[ReportScheduler] Generating daily report for ${dateToReport} to ${recipient}...`);

    const reportData = await compileDailyReportData(dateToReport);
    const result = await sendDailyAdminReportEmail({
      to: recipient,
      reportDate: dateToReport,
      reportData
    });

    if (result.success) {
      console.log(`[ReportScheduler] Daily report successfully delivered to ${recipient}`);
    } else {
      console.error('[ReportScheduler] Failed to deliver daily report:', result.error);
    }
    return { ...result, reportData, recipient };
  } catch (err) {
    console.error('[ReportScheduler] Exception in generateAndSendDailyReport:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Calculate milliseconds remaining until the next Midnight 12:00:00 AM IST (Asia/Kolkata).
 */
function msUntilNextMidnightIST() {
  const now = new Date();
  
  // Convert current time to IST string
  const istString = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const istNow = new Date(istString);

  // Midnight next day in IST
  const nextMidnightIST = new Date(istNow);
  nextMidnightIST.setHours(24, 0, 0, 0); // 00:00:00 next day

  const diffMs = nextMidnightIST.getTime() - istNow.getTime();
  return Math.max(1000, diffMs);
}

let schedulerTimer = null;

function initDailyReportScheduler() {
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
  }

  const msToMidnight = msUntilNextMidnightIST();
  const minutesToMidnight = Math.round(msToMidnight / 60000);
  console.log(`[ReportScheduler] Midnight 12:00 AM IST daily report scheduled in ${minutesToMidnight} minutes (${(msToMidnight / 3600000).toFixed(1)} hrs)`);

  schedulerTimer = setTimeout(async () => {
    console.log('[ReportScheduler] Midnight 12:00 AM IST trigger fired. Dispatching executive daily report...');
    try {
      // At midnight of day N+1, the report is for the day N that just ended
      const yesterdayIST = getISTDate(-1);
      await generateAndSendDailyReport(yesterdayIST);
    } catch (e) {
      console.error('[ReportScheduler] Midnight job error:', e);
    }
    // Re-schedule for the next midnight
    initDailyReportScheduler();
  }, msToMidnight);
}

module.exports = {
  initDailyReportScheduler,
  generateAndSendDailyReport,
  compileDailyReportData,
  getAdminReportEmail
};
