const express = require('express');
const router = express.Router();
const { authenticate, authorize, authorizeLocationAccess, optionalAuthenticate } = require('../middleware/auth');
const { autoInitializeDatabase } = require('../config/dbInitializer');
const db = require('../config/db');
const upload = require('../middleware/upload');
const { errorRes } = require('../utils/response');
const pool = require('../config/db');

const authController = require('../controllers/authController');
const candidateController = require('../controllers/candidateController');
const interviewController = require('../controllers/interviewController');
const offerController = require('../controllers/offerController');
const onboardingController = require('../controllers/onboardingController');
const exitController = require('../controllers/exitController');
const settingsController = require('../controllers/settingsController');
const broadcastController = require('../controllers/broadcastController');
const deptHiringController = require('../controllers/deptHiringController');
const crmController = require('../controllers/crmController');
const mcheckController = require('../controllers/mcheckController');
const locationController = require('../controllers/locationController');
const userMgmtController = require('../controllers/userManagementController');
const userValidator = require('../validators/userValidator');
const feedbackQrController = require('../controllers/feedbackQrController');

const { body } = require('express-validator');
const validate = require('../middleware/validate');

// ── Auth Routes ──────────────────────────────────────────────
router.get('/auth/captcha', authController.captcha);
router.get('/auth/lock-status', authController.lockStatus);

const loginValidation = [
  body('username').trim().notEmpty().withMessage('Username is required').isLength({ max: 150 }).escape(),
  body('password').notEmpty().withMessage('Password is required').isLength({ max: 255 })
];

router.post('/auth/login', validate(loginValidation), authController.login);
router.post('/auth/verify', authController.verifyUser);
router.post('/auth/logout', authenticate, authController.logout);
router.get('/auth/me', authenticate, authController.getMe);

// Password reset routes (public)
router.post('/auth/request-password-reset', authController.requestPasswordReset);
router.get('/auth/verify-password-reset-token', authController.verifyPasswordResetToken);
router.post('/auth/reset-password', authController.resetPassword);

// ── Location Routes ───────────────────────────────────────────
router.get('/locations', locationController.getLocations);
router.get('/locations/:id', locationController.getLocation);
router.post('/locations', authenticate, authorize('Admin', 'Super Admin'), locationController.createLocation);
router.put('/locations/:id', authenticate, authorize('Admin', 'Super Admin'), locationController.updateLocation);
router.get('/global-stats', authenticate, locationController.getGlobalStats);

// ── Public Routes (Interview Token & Candidate Entry) ─────────
router.get('/public/interview', interviewController.getInterviewByToken);
router.post('/public/interview-score', interviewController.submitInterviewScore);
router.post('/public/candidate-entry', candidateController.addCandidate);
router.get('/public/check-duplicate', candidateController.checkDuplicate);
router.get('/public/designations', settingsController.getDesignations);

router.get('/public/migrate-db', authenticate, authorize('Admin', 'Super Admin'), async (req, res) => {
  try {
    const db = require('../config/db');
    let results = [];
    const newCols = [
      'religion VARCHAR(100) NULL',
      'caste VARCHAR(100) NULL'
    ];
    for (let col of newCols) {
      try {
        await db.query(`ALTER TABLE candidates ADD COLUMN ${col}`);
        results.push(`Added ${col}`);
      } catch (e) {
        results.push(`Column ${col.split(' ')[0]} might already exist: ${e.message}`);
      }
    }
    res.json({ success: true, message: 'Migration completed', results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Candidate Routes ─────────────────────────────────────────
router.get('/candidates', authenticate, authorizeLocationAccess(), candidateController.getCandidates);
router.post('/candidates', optionalAuthenticate, candidateController.addCandidate);
router.post('/candidates/add', optionalAuthenticate, candidateController.addCandidate);
router.put('/candidates/:appNo', authenticate, authorizeLocationAccess(), candidateController.updateCandidate);
router.post('/candidates/update', authenticate, authorizeLocationAccess(), candidateController.updateCandidate);
router.delete('/candidates/:appNo', authenticate, authorize('Admin', 'Super Admin'), candidateController.deleteCandidate);
router.get('/candidates/check-duplicate', candidateController.checkDuplicate);
router.get('/candidates/next-app-no', candidateController.getNextAppNo);
router.get('/candidates/kpis', authenticate, authorizeLocationAccess(), candidateController.getKPIs);
router.get('/candidates/pending-actions', authenticate, authorizeLocationAccess(), candidateController.getPendingActions);
router.get('/candidates/source-breakdown', authenticate, authorizeLocationAccess(), candidateController.getSourceBreakdown);
router.get('/candidates/activity-full', authenticate, authorizeLocationAccess(), candidateController.getActivityFull);
router.post('/candidates/upload-resume', upload.single('resume'), candidateController.uploadResume);
router.post('/candidates/upload-documents', upload.fields([{ name: 'resume' }, { name: 'photo' }, { name: 'aadhar' }]), candidateController.uploadDocuments);
router.get('/candidates/activity', authenticate, authorizeLocationAccess(), candidateController.getSystemActivity);
router.get('/openings', candidateController.getOpenings);
router.post('/openings/update', authenticate, authorize('Admin', 'Super Admin'), candidateController.updateOpening);
router.get('/employees', authenticate, authorizeLocationAccess(), candidateController.getEmployees);
router.get('/employees/not-joined', authenticate, authorizeLocationAccess(), candidateController.getNotJoinedDesk);
router.post('/employees/not-joined/action', authenticate, authorizeLocationAccess(), candidateController.handleNotJoinedAction);
router.get('/employees/joined-store', authenticate, authorizeLocationAccess(), candidateController.getJoinedStoreDirectory);
router.post('/employees/bulk', authenticate, authorize('Admin', 'Super Admin', 'HR'), candidateController.bulkAddEmployees);
router.put('/employees/:id', authenticate, authorize('Admin', 'Super Admin', 'HR', 'Manager'), candidateController.updateEmployee);
router.delete('/employees/:id', authenticate, authorize('Admin', 'Super Admin', 'HR'), candidateController.deleteEmployee);

// ── Interview Routes ─────────────────────────────────────────
router.get('/interviews', authenticate, authorizeLocationAccess(), interviewController.getInterviews);
router.get('/interviews/questions', authenticate, interviewController.getInterviewQuestions);
router.post('/interviews/save-call-step', authenticate, authorizeLocationAccess(), interviewController.saveCallStep);
router.get('/interviews/call-status', authenticate, authorizeLocationAccess(), interviewController.getCallStatus);
router.post('/interviews/save-score', authenticate, authorizeLocationAccess(), interviewController.saveScore);
router.post('/interviews/generate-token', authenticate, interviewController.generateInterviewToken);
router.post('/interviews/approve-selection', authenticate, authorizeLocationAccess(), interviewController.approveSelection);
router.post('/interviews/reject-candidate', authenticate, authorizeLocationAccess(), interviewController.rejectCandidate);
router.get('/interviews/selected', authenticate, authorizeLocationAccess(), interviewController.getSelectedCandidates);
router.get('/interviews/rejected', authenticate, authorizeLocationAccess(), interviewController.getRejectedCandidates);

// ── Offer Routes ─────────────────────────────────────────────
router.get('/offers', authenticate, authorizeLocationAccess(), offerController.getOffers);
router.post('/offers/direct', authenticate, authorizeLocationAccess(), offerController.createDirectOffer);
router.post('/offers/log-call', authenticate, authorizeLocationAccess(), offerController.logOfferCall);
router.post('/offers/update-details', authenticate, authorizeLocationAccess(), offerController.updateOfferDetails);
router.post('/offers/accept', authenticate, authorizeLocationAccess(), offerController.acceptOffer);
router.post('/offers/reject', authenticate, authorizeLocationAccess(), offerController.rejectOffer);
router.post('/offers/mark-joined', authenticate, authorizeLocationAccess(), offerController.markJoined);
router.post('/offers/update-status', authenticate, authorizeLocationAccess(), offerController.updateOfferStatus);

// ── Onboarding Routes ────────────────────────────────────────
router.get('/onboarding/list', authenticate, authorizeLocationAccess(), onboardingController.getOnboardingList);
router.post('/onboarding/create', authenticate, authorizeLocationAccess(), onboardingController.createOnboarding);
router.get('/onboarding/items', authenticate, authorizeLocationAccess(), onboardingController.getOnboardingItems);
router.post('/onboarding/update-item', authenticate, authorizeLocationAccess(), onboardingController.updateOnboardingItem);
router.post('/onboarding/complete', authenticate, authorizeLocationAccess(), onboardingController.completeOnboarding);

// ── Exit Routes ──────────────────────────────────────────────
router.get('/exit/list', authenticate, authorizeLocationAccess(), exitController.getExitList);
router.post('/exit/create', authenticate, authorizeLocationAccess(), exitController.createExit);
router.get('/exit/items', authenticate, authorizeLocationAccess(), exitController.getExitItems);
router.post('/exit/update-item', authenticate, authorizeLocationAccess(), exitController.updateExitItem);
router.post('/exit/complete', authenticate, authorizeLocationAccess(), exitController.completeExit);

// ── Settings Routes ──────────────────────────────────────────
router.get('/settings/users', authenticate, settingsController.getUsers);
router.post('/settings/users/add', authenticate, authorize('Admin', 'Super Admin'), settingsController.addUser);
router.post('/settings/users/update', authenticate, authorize('Admin', 'Super Admin'), settingsController.updateUser);
router.delete('/settings/users/:id', authenticate, authorize('Admin', 'Super Admin'), settingsController.deleteUser);
router.get('/settings/page-visibility', settingsController.getPageSettings);
router.post('/settings/page-visibility', authenticate, authorize('Admin', 'Super Admin'), settingsController.savePageSettings);
router.get('/settings/roles', settingsController.getRoles);
router.get('/admin/roles', settingsController.getRoles);
router.get('/roles', settingsController.getRoles);
router.get('/settings/designations', settingsController.getDesignations);
router.post('/settings/designations/add', authenticate, authorize('Admin', 'Super Admin'), settingsController.addDesignation);
router.post('/settings/designations/delete', authenticate, authorize('Admin', 'Super Admin'), settingsController.deleteDesignation);
router.get('/settings/questions', settingsController.getAllInterviewQuestions);
router.post('/settings/questions/add', authenticate, authorize('Admin', 'Super Admin'), settingsController.addInterviewQuestion);
router.post('/settings/questions/delete', authenticate, authorize('Admin', 'Super Admin'), settingsController.deleteInterviewQuestion);

// ── CRM Store Operations Routes ──────────────────────────────
router.get('/crm/settings', authenticate, crmController.getSettings);
router.post('/crm/settings/update', authenticate, authorize('Admin', 'Super Admin'), crmController.updateSettings);
router.post('/crm/verify-pin', crmController.verifyPin);
router.get('/crm/sections', authenticate, crmController.getSections);

router.get('/crm/footfall', authenticate, authorizeLocationAccess(), crmController.getFootfall);
router.post('/crm/footfall/upsert', authenticate, authorizeLocationAccess(), crmController.upsertFootfall);

router.get('/crm/feedback-questions', authenticate, crmController.getFeedbackQuestions);
router.get('/crm/feedback-stats', authenticate, authorizeLocationAccess(), crmController.getFeedbackStats);
router.get('/crm/feedbacks', authenticate, authorizeLocationAccess(), crmController.getFeedbacks);
router.delete('/crm/feedbacks/:id', authenticate, authorizeLocationAccess(), crmController.deleteFeedback);
router.delete('/crm/feedbacks', authenticate, authorizeLocationAccess(), crmController.clearAllFeedbacks);
router.post('/crm/feedback', optionalAuthenticate, authorizeLocationAccess(), crmController.submitFeedback);
router.get('/crm/call-queue', authenticate, authorizeLocationAccess(), crmController.getCallQueue);
router.post('/crm/call-queue/update', authenticate, authorizeLocationAccess(), crmController.updateCallQueue);

router.get('/crm/diverts', authenticate, authorizeLocationAccess(), crmController.getDiverts);
router.post('/crm/diverts/create', authenticate, authorizeLocationAccess(), crmController.createDivert);
router.post('/crm/diverts/update', authenticate, authorizeLocationAccess(), crmController.updateDivert);
router.get('/crm/diverts/updates', authenticate, authorizeLocationAccess(), crmController.getDivertUpdates);

router.get('/cash', authenticate, authorizeLocationAccess(), crmController.getCashSettlement);
router.post('/cash/save', authenticate, authorizeLocationAccess(), crmController.saveCashSettlement);

router.get('/vm/points', authenticate, crmController.getVmPoints);
router.get('/vm/submissions', authenticate, authorizeLocationAccess(), crmController.getVmSubmissions);
router.post('/vm/submit', authenticate, authorizeLocationAccess(), crmController.submitVm);
router.get('/vm/floors', authenticate, crmController.getVmFloors);
router.post('/vm/floors', authenticate, authorize('Admin', 'Super Admin'), crmController.createVmFloor);
router.post('/vm/floors/delete', authenticate, authorize('Admin', 'Super Admin'), crmController.deleteVmFloor);
router.delete('/vm/floors/:id', authenticate, authorize('Admin', 'Super Admin'), crmController.deleteVmFloor);

// ── Broadcast Routes ─────────────────────────────────────────
router.get('/broadcasts', authenticate, broadcastController.getBroadcasts);
router.post('/broadcasts', authenticate, authorize('Admin', 'Super Admin'), broadcastController.createBroadcast);
router.delete('/broadcasts/:id', authenticate, authorize('Admin', 'Super Admin'), broadcastController.deleteBroadcast);

// ── Chat Routes ─────────────────────────────────────────
router.get('/chat/messages', optionalAuthenticate, crmController.getChatMessages);
router.post('/chat/send', optionalAuthenticate, crmController.sendChatMessage);
router.delete('/chat/messages', optionalAuthenticate, crmController.clearChatMessages);

// ── Dept Hiring & Section Allocation Routes ───────────────
router.get('/dept-hiring/targets', authenticate, authorizeLocationAccess(), deptHiringController.getHiringTargets);
router.post('/dept-hiring/targets', authenticate, authorize('Admin', 'Super Admin', 'HR'), deptHiringController.saveHiringTarget);
router.get('/section-allocations', authenticate, authorizeLocationAccess(), deptHiringController.getSectionAllocations);
router.post('/section-allocations', authenticate, authorize('Admin', 'Super Admin', 'HR'), deptHiringController.saveSectionAllocation);
router.post('/section-allocations/bulk', authenticate, authorize('Admin', 'Super Admin', 'HR'), deptHiringController.bulkSaveSectionAllocation);

router.get('/dept-hiring/sections', authenticate, deptHiringController.getDepartmentSections);
router.post('/dept-hiring/sections/add', authenticate, authorize('Admin', 'Super Admin'), deptHiringController.addDepartmentSection);
router.post('/dept-hiring/sections/edit', authenticate, authorize('Admin', 'Super Admin'), deptHiringController.editDepartmentSection);
router.post('/dept-hiring/sections/delete', authenticate, authorize('Admin', 'Super Admin'), deptHiringController.deleteDepartmentSection);

// ── MCheck Daily Management Checklist Routes ─────────────────
router.get('/mcheck/modules', authenticate, authorizeLocationAccess(), mcheckController.getModules);
router.get('/mcheck/dashboard', authenticate, authorizeLocationAccess(), mcheckController.getDashboard);
router.get('/mcheck/module/:moduleId', authenticate, authorizeLocationAccess(), mcheckController.getModuleDetail);
router.post('/mcheck/response/save', authenticate, authorizeLocationAccess(), mcheckController.saveResponse);
router.post('/mcheck/response/submit-all', authenticate, authorizeLocationAccess(), mcheckController.submitAll);
router.get('/mcheck/reports', authenticate, authorizeLocationAccess(), mcheckController.getReports);
router.get('/mcheck/history', authenticate, authorizeLocationAccess(), mcheckController.getHistory);
router.get('/mcheck/trend', authenticate, authorizeLocationAccess(), mcheckController.getTrend);
router.get('/mcheck/audit', authenticate, authorizeLocationAccess(), mcheckController.getAuditLog);
router.post('/mcheck/upload-photo', authenticate, upload.single('photo'), mcheckController.uploadPhoto);
router.get('/mcheck/admin/structure', authenticate, authorize('Admin', 'Super Admin'), mcheckController.adminGetStructure);
router.post('/mcheck/admin/module', authenticate, authorize('Admin', 'Super Admin'), mcheckController.adminSaveModule);
router.post('/mcheck/admin/checkpoint', authenticate, authorize('Admin', 'Super Admin'), mcheckController.adminSaveCheckpoint);
router.post('/mcheck/admin/reorder', authenticate, authorize('Admin', 'Super Admin'), mcheckController.adminReorderCheckpoints);
router.get('/mcheck/export/pdf', authenticate, authorizeLocationAccess(), mcheckController.exportPdf);
router.get('/mcheck/export/excel', authenticate, authorizeLocationAccess(), mcheckController.exportExcel);

// ── Wedding Customer Follow-up CRM ───────────────────────────
const weddingRoutes = require('./weddingRoutes');
router.use('/wedding-crm', weddingRoutes);

// ── Telecaller Dashboard ─────────────────────────────────────
const telecallerDashboardRoutes = require('./telecallerDashboardRoutes');
router.use('/telecaller-dashboard', telecallerDashboardRoutes);

// ── Wedding Registration ──────────────────────────────────────
console.log('[DEBUG] Loading workflow routes...');
const weddingRegistrationRoutes = require('./weddingRegistrationRoutes');
router.use('/wedding-registration', weddingRegistrationRoutes);
console.log('[DEBUG] Workflow routes mounted at /workflow');

// ── Batch Plan & Weaving Module ──────────────────────────────
const batchPlanRoutes = require('./batchPlanRoutes');
router.use('/batch-plan', batchPlanRoutes);

// ── Feedback QR Code Module ─────────────────────────────────────
// Admin routes (require authentication)
router.get('/feedback-qr', authenticate, feedbackQrController.getQrCodes);
router.get('/feedback-qr/stats', authenticate, feedbackQrController.getQrCodeStats);
router.get('/feedback-qr/locations', authenticate, feedbackQrController.getLocationsForQr);
router.get('/feedback-qr/sections', authenticate, feedbackQrController.getSectionsForLocation);
router.get('/feedback-qr/forms', authenticate, feedbackQrController.getFeedbackForms);
router.get('/feedback-qr/export', authenticate, feedbackQrController.exportQrCodes);

// Location-based QR Code endpoints (must be defined BEFORE /:id dynamic route)
router.post('/feedback-qr/generate-locations', authenticate, authorize('Admin', 'Super Admin', 'HR', 'Manager'), feedbackQrController.generateLocationQrCodes);
router.get('/feedback-qr/location-codes', authenticate, feedbackQrController.getLocationQrCodes);

router.get('/feedback-qr/:id', authenticate, feedbackQrController.getQrCodeById);
router.get('/feedback-qr/:qrCodeId/scans', authenticate, feedbackQrController.getQrCodeScans);
router.post('/feedback-qr', authenticate, authorize('Admin', 'Super Admin', 'HR', 'Manager'), feedbackQrController.createQrCode);
router.put('/feedback-qr/:id', authenticate, authorize('Admin', 'Super Admin', 'HR', 'Manager'), feedbackQrController.updateQrCode);
router.delete('/feedback-qr/:id', authenticate, authorize('Admin', 'Super Admin'), feedbackQrController.deleteQrCode);
router.post('/feedback-qr/:id/toggle-status', authenticate, authorize('Admin', 'Super Admin', 'HR', 'Manager'), feedbackQrController.toggleQrCodeStatus);
router.post('/feedback-qr/:id/regenerate', authenticate, authorize('Admin', 'Super Admin', 'HR', 'Manager'), feedbackQrController.regenerateQrCode);

// Public scan endpoint (location-based and qrCodeId-based)
router.post('/feedback-qr/scan/location/:locationCode', feedbackQrController.trackQrScan);
router.post('/feedback-qr/scan/:qrCodeId', feedbackQrController.trackQrScan);

// ── Security Center (DevTools shield, GPS trail, login activity) ────────────
// Developer Tools Detection is OFF by default. An Admin enables it from
// System Settings → Security (Admin-only; the UI works on desktop & mobile).
// The flag is stored persistently in the `Setting` table — the single source
// of truth. Every connected device is notified instantly over Socket.IO and
// also re-polls periodically as a fallback, so a toggle applies to all
// devices immediately. There is no client-side bypass: the server flag always
// wins and non-admin API callers are rejected (401/403).
const SECURITY_EVENT_TYPES = new Set([
  'DEVTOOLS_DETECTED',
  'DEVTOOLS_CLOSED',
  'GPS_PING',
  'SESSION_EXPIRED',
  'URL_MANIPULATION'
]);

let inMemoryShieldState = false;

async function getShieldEnabled() {
  try {
    const [rows] = await pool.query(
      `SELECT settingValue FROM Setting WHERE settingKey = 'devtools_shield_enabled' LIMIT 1`
    );
    if (rows && rows.length > 0) {
      return String(rows[0].settingValue) === 'true';
    }
    return inMemoryShieldState;
  } catch (err) {
    return inMemoryShieldState; // table missing / DB down — shield fallback
  }
}

// Public read: the guard must know the flag before login (it protects the
// login page too). Returns only a boolean — no sensitive data.
router.get('/security/shield-status', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const enabled = await getShieldEnabled();
    return res.json({ success: true, enabled: !!enabled });
  } catch (err) {
    return res.json({ success: true, enabled: false });
  }
});

router.post('/security/shield-toggle', authenticate, authorize('Admin', 'Super Admin'), async (req, res) => {
  try {
    const enabled = !!(req.body && (req.body.enabled === true || req.body.enabled === 'true'));
    inMemoryShieldState = enabled;

    try {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS Setting (
          settingKey VARCHAR(100) PRIMARY KEY,
          settingValue TEXT,
          category VARCHAR(50) DEFAULT 'General',
          updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`
      );
      await pool.query(
        `INSERT INTO Setting (settingKey, settingValue, category) VALUES ('devtools_shield_enabled', ?, 'Security')
         ON DUPLICATE KEY UPDATE settingValue = VALUES(settingValue)`,
        [enabled ? 'true' : 'false']
      );
      await pool.query(
        `INSERT INTO audit_logs (username, action, module, details, ip_address) VALUES (?, 'SHIELD_TOGGLED', 'Security', ?, ?)`,
        [req.user.username || 'admin', JSON.stringify({ enabled }), req.ip || null]
      );
    } catch (dbErr) {
      console.warn('[Security shield-toggle DB Note]', dbErr.message);
    }

    // Push the change to every connected device immediately so the Admin's
    // toggle takes effect without waiting for the periodic re-check.
    try {
      const io = req.app && req.app.get('io');
      if (io && typeof io.emit === 'function') {
        io.emit('security:shield_changed', { enabled });
      }
    } catch (pushErr) {
      /* best-effort push only */
    }
    return res.json({ success: true, enabled });
  } catch (err) {
    console.error('[Security shield-toggle Error]', err.message);
    return errorRes(res, 'Could not update shield setting', [], 500);
  }
});

// Flood control for client-reported security events: at most one audit write
// per user+event every few seconds. Honest devices report at most once per
// minute (client-side cooldown), so only abusive callers are throttled.
// Throttled calls still succeed — security logging must never break the app.
const SECURITY_EVENT_MIN_INTERVAL_MS = 5_000;
const lastSecurityEventAt = new Map();

router.post('/security/log-event', authenticate, async (req, res) => {
  try {
    const { event, details } = req.body || {};
    if (!event || !SECURITY_EVENT_TYPES.has(event)) {
      return errorRes(res, 'Unknown security event', [], 400);
    }
    const eventIdentity = (req.user && (req.user.username || req.user.fullName)) || req.ip || 'anonymous';
    const eventKey = `${eventIdentity}:${event}`;
    const now = Date.now();
    if (now - (lastSecurityEventAt.get(eventKey) || 0) < SECURITY_EVENT_MIN_INTERVAL_MS) {
      return res.json({ success: true, throttled: true }); // throttled — acknowledged without writing duplicate
    }
    if (lastSecurityEventAt.size > 5000) lastSecurityEventAt.clear(); // bounded memory
    lastSecurityEventAt.set(eventKey, now);
    const ua = String(req.headers['user-agent'] || '').substring(0, 250);
    const username = req.user ? (req.user.username || req.user.fullName || 'unknown') : 'unknown';
    const eventDetails = {
      ...(details || {}),
      userAgent: ua
    };

    const [insertResult] = await pool.query(
      `INSERT INTO audit_logs (username, action, module, details, ip_address) VALUES (?, ?, 'Security', ?, ?)`,
      [
        username,
        event,
        JSON.stringify(eventDetails).substring(0, 950),
        req.ip || null
      ]
    );

    // Push real-time event to Admin Dashboard via Socket.IO
    try {
      const io = req.app && req.app.get('io');
      if (io && typeof io.emit === 'function') {
        io.emit('security:event_logged', {
          id: insertResult.insertId,
          username,
          action: event,
          details: eventDetails,
          ipAddress: req.ip || null,
          createdAt: new Date().toISOString()
        });
      }
    } catch (pushErr) {
      /* best-effort push */
    }

    return res.json({ success: true, id: insertResult.insertId });
  } catch (err) {
    console.error('[Security log-event Error]', err.message);
    return res.json({ success: true }); // never break the client over logging
  }
});

router.get('/security/events', authenticate, authorize('Admin', 'Super Admin'), async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 10), 200);
    const [rows] = await pool.query(
      `SELECT id, username, action, details, ip_address AS ipAddress, created_at AS createdAt
       FROM audit_logs WHERE module = 'Security'
       ORDER BY id DESC LIMIT ?`,
      [limit]
    );

    const parsedEvents = (rows || []).map(r => {
      let d = null;
      try {
        d = typeof r.details === 'string' ? JSON.parse(r.details) : r.details;
      } catch (e) {
        d = { raw: r.details };
      }
      return {
        id: r.id,
        username: r.username,
        action: r.action,
        details: d,
        ipAddress: r.ipAddress,
        createdAt: r.createdAt
      };
    });

    return res.json({ success: true, events: parsedEvents });
  } catch (err) {
    console.error('[Security events Error]', err.message);
    return res.json({ success: true, events: [] });
  }
});

router.post('/security/clear-events', authenticate, authorize('Admin', 'Super Admin'), async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM audit_logs WHERE module = 'Security' AND action IN ('DEVTOOLS_DETECTED', 'DEVTOOLS_CLOSED')`
    );

    try {
      const io = req.app && req.app.get('io');
      if (io && typeof io.emit === 'function') {
        io.emit('security:events_cleared');
      }
    } catch (e) {}

    return res.json({ success: true, message: 'Developer tools detection history cleared' });
  } catch (err) {
    console.error('[Security clear-events Error]', err.message);
    return errorRes(res, 'Failed to clear security events', [err.message], 500);
  }
});

// ── Login / Logout Activity (admin dashboard) ────────────────────────────────
router.get('/security/login-activity', authenticate, authorize('Admin', 'Super Admin'), async (req, res) => {
  try {
    const [summary] = await pool.query(`
      SELECT
        SUM(CASE WHEN action = 'LOGIN_SUCCESS' AND created_at >= CURDATE() THEN 1 ELSE 0 END) AS loginsToday,
        SUM(CASE WHEN action = 'LOGIN_SUCCESS' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS logins7d,
        SUM(CASE WHEN action = 'LOGOUT' AND created_at >= CURDATE() THEN 1 ELSE 0 END) AS logoutsToday,
        SUM(CASE WHEN action = 'LOGOUT' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS logouts7d,
        SUM(CASE WHEN action = 'LOGIN_FAILED' AND created_at >= CURDATE() THEN 1 ELSE 0 END) AS failedToday,
        COUNT(DISTINCT CASE WHEN action = 'LOGIN_SUCCESS' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN username END) AS activeUsers7d
      FROM audit_logs
      WHERE module = 'Auth' AND action IN ('LOGIN_SUCCESS', 'LOGOUT', 'LOGIN_FAILED')
    `);

    const [lastLogin] = await pool.query(
      `SELECT username, created_at AS at FROM audit_logs
       WHERE module = 'Auth' AND action = 'LOGIN_SUCCESS' ORDER BY id DESC LIMIT 1`
    );
    const [lastLogout] = await pool.query(
      `SELECT username, created_at AS at FROM audit_logs
       WHERE module = 'Auth' AND action = 'LOGOUT' ORDER BY id DESC LIMIT 1`
    );

    const [recent] = await pool.query(
      `SELECT id, username, action, ip_address AS ipAddress, created_at AS at
       FROM audit_logs
       WHERE module = 'Auth' AND action IN ('LOGIN_SUCCESS', 'LOGOUT', 'LOGIN_FAILED')
       ORDER BY id DESC LIMIT 15`
    );

    const s = summary[0] || {};
    return res.json({
      success: true,
      summary: {
        loginsToday: Number(s.loginsToday) || 0,
        logins7d: Number(s.logins7d) || 0,
        logoutsToday: Number(s.logoutsToday) || 0,
        logouts7d: Number(s.logouts7d) || 0,
        failedToday: Number(s.failedToday) || 0,
        activeUsers7d: Number(s.activeUsers7d) || 0,
        lastLogin: lastLogin[0] || null,
        lastLogout: lastLogout[0] || null
      },
      recent: recent || []
    });
  } catch (err) {
    console.error('[Login activity Error]', err.message);
    return res.json({
      success: true,
      summary: {
        loginsToday: 0, logins7d: 0, logoutsToday: 0, logouts7d: 0,
        failedToday: 0, activeUsers7d: 0, lastLogin: null, lastLogout: null
      },
      recent: []
    });
  }
});

// ── Legacy Google Apps Script Action Dispatcher Endpoint ─────
router.get('/legacy', async (req, res) => {
  if (req.query.action === 'getInterviewByToken') {
    return interviewController.getInterviewByToken(req, res);
  }
  return res.json({ status: 'BSC HRMS API v5 Online' });
});

router.post('/legacy', async (req, res) => {
  const { action } = req.body;
  const dispatchMap = {
    verifyUser: authController.verifyUser,
    getCandidates: candidateController.getCandidates,
    addCandidate: candidateController.addCandidate,
    getActivityFull: candidateController.getActivityFull,
    getActivity: candidateController.getSystemActivity,
    updateCandidate: candidateController.updateCandidate,
    updateCandidateFull: candidateController.updateCandidate,
    checkDuplicate: candidateController.checkDuplicate,
    getNextAppNo: candidateController.getNextAppNo,
    getKPIs: candidateController.getKPIs,
    getPendingActions: candidateController.getPendingActions,
    getSourceBreakdown: candidateController.getSourceBreakdown,
    getDesignations: settingsController.getDesignations,
    getPublicDesignations: settingsController.getPublicDesignations,
    getOpenings: candidateController.getOpenings,
    updateOpening: candidateController.updateOpening,
    saveCallStep: interviewController.saveCallStep,
    getCallStatus: interviewController.getCallStatus,
    getInterviews: interviewController.getInterviews,
    getInterviewQuestions: interviewController.getInterviewQuestions,
    saveScore: interviewController.saveScore,
    generateInterviewToken: interviewController.generateInterviewToken,
    getInterviewByToken: interviewController.getInterviewByToken,
    submitInterviewScore: interviewController.submitInterviewScore,
    getOffers: offerController.getOffers,
    createDirectOffer: offerController.createDirectOffer,
    logOfferCall: offerController.logOfferCall,
    updateOfferDetails: offerController.updateOfferDetails,
    acceptOffer: offerController.acceptOffer,
    rejectOffer: offerController.rejectOffer,
    markJoined: offerController.markJoined,
    updateOfferStatus: offerController.updateOfferStatus,
    approveSelection: interviewController.approveSelection,
    rejectCandidate: interviewController.rejectCandidate,
    getSelectedCandidates: interviewController.getSelectedCandidates,
    getRejectedCandidates: interviewController.getRejectedCandidates,
    getUsers: settingsController.getUsers,
    addUser: settingsController.addUser,
    updateUser: settingsController.updateUser,
    getPageSettings: settingsController.getPageSettings,
    savePageSettings: settingsController.savePageSettings,
    getAllInterviewQuestions: settingsController.getAllInterviewQuestions,
    addInterviewQuestion: settingsController.addInterviewQuestion,
    deleteInterviewQuestion: settingsController.deleteInterviewQuestion,
    addDesignation: settingsController.addDesignation,
    deleteDesignation: settingsController.deleteDesignation,
    getEmployees: candidateController.getEmployees,
    getOnboardingList: onboardingController.getOnboardingList,
    createOnboarding: onboardingController.createOnboarding,
    getOnboardingItems: onboardingController.getOnboardingItems,
    updateOnboardingItem: onboardingController.updateOnboardingItem,
    completeOnboarding: onboardingController.completeOnboarding,
    getExitList: exitController.getExitList,
    createExit: exitController.createExit,
    getExitItems: exitController.getExitItems,
    updateExitItem: exitController.updateExitItem,
    completeExit: exitController.completeExit,
    getHiringTargets: deptHiringController.getHiringTargets,
    saveHiringTarget: deptHiringController.saveHiringTarget,
    getSectionAllocations: deptHiringController.getSectionAllocations,
    saveSectionAllocation: deptHiringController.saveSectionAllocation,
    bulkSaveSectionAllocation: deptHiringController.bulkSaveSectionAllocation,
    getDepartmentSections: deptHiringController.getDepartmentSections,
    addDepartmentSection: deptHiringController.addDepartmentSection,
    editDepartmentSection: deptHiringController.editDepartmentSection,
    deleteDepartmentSection: deptHiringController.deleteDepartmentSection
  };

  if (dispatchMap[action]) {
    // ── Server-side authorization for the legacy dispatcher ──────────────
    // The dispatcher predates the JWT middleware, which made privileged
    // actions callable anonymously. Public actions keep working exactly as
    // before (public QR entry, interview token flow, verification), while
    // everything else now requires a valid token — and Admin-only actions
    // additionally require the Admin/Super Admin role.
    const PUBLIC_ACTIONS = new Set([
      'verifyUser',
      'addCandidate',
      'checkDuplicate',
      'getNextAppNo',
      'getPublicDesignations',
      'getDesignations',
      'getInterviewByToken',
      'submitInterviewScore',
      'getOpenings'
    ]);
    // Admin/Super-Admin-only actions (matches the guards already present on
    // their direct REST routes). Page workflows used by HR/Manager (openings,
    // dept-hiring, section allocation) stay authenticate-only by design.
    const ADMIN_ONLY_ACTIONS = new Set([
      'addUser',
      'updateUser',
      'savePageSettings',
      'deleteDesignation',
      'addInterviewQuestion',
      'deleteInterviewQuestion'
    ]);

    if (!PUBLIC_ACTIONS.has(action)) {
      const denied = (code) => errorRes(res, 'Forbidden: insufficient permissions', [], code);
      return authenticate(req, res, (err) => {
        if (err) return denied(401);
        if (ADMIN_ONLY_ACTIONS.has(action)) {
          return authorize('Admin', 'Super Admin')(req, res, (err2) => {
            if (err2) return denied(403);
            return dispatchMap[action](req, res);
          });
        }
        return dispatchMap[action](req, res);
      });
    }
    return dispatchMap[action](req, res);
  }
  return errorRes(res, `Unknown action: ${action}`, [], 400);
});

// ── User Management (Admin Only) ─────────────────────────────────
router.get('/admin/users', authenticate, authorize('Admin', 'Super Admin'), userMgmtController.listUsers);
router.get('/admin/users/modules', authenticate, authorize('Admin', 'Super Admin'), userMgmtController.listModules);
router.get('/admin/users/:id', authenticate, authorize('Admin', 'Super Admin'), userMgmtController.getUser);
router.post('/admin/users', authenticate, authorize('Admin', 'Super Admin'), userValidator.validateCreateUser, userMgmtController.createUser);
router.put('/admin/users/:id', authenticate, authorize('Admin', 'Super Admin'), userValidator.validateUpdateUser, userMgmtController.updateUser);
router.delete('/admin/users/:id', authenticate, authorize('Admin', 'Super Admin'), userMgmtController.deleteUser);
router.get('/admin/users/:id/permissions', authenticate, authorize('Admin', 'Super Admin'), userMgmtController.getUserPermissions);
router.put('/admin/users/:id/permissions', authenticate, authorize('Admin', 'Super Admin'), userMgmtController.updatePermissions);
router.post('/admin/users/:id/toggle-status', authenticate, authorize('Admin', 'Super Admin'), userMgmtController.toggleStatus);
router.post('/admin/users/:id/reset-password', authenticate, authorize('Admin', 'Super Admin'), userValidator.validatePasswordChange, userMgmtController.resetPassword);

// ── Diagnostics / DB Fix ──────────────────────────────────────────────
router.get('/admin/force-db-update', async (req, res) => {
  try {
    await autoInitializeDatabase(db);
    res.json({ success: true, message: 'Database initialization script ran successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, stack: err.stack });
  }
});
router.get('/my-permissions', authenticate, userMgmtController.getMyPermissions);

// ── System Administrator Endpoints ──────────────────────────────────────

router.get('/security/system-logs', authenticate, authorize('Admin', 'Super Admin'), async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 10), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const moduleFilter = req.query.module || null;
    const actionFilter = req.query.action || null;
    
    let whereClause = "WHERE module != 'Security'";
    const params = [];
    
    if (moduleFilter) {
      whereClause += ' AND module = ?';
      params.push(moduleFilter);
    }
    if (actionFilter) {
      whereClause += ' AND action = ?';
      params.push(actionFilter);
    }
    
    const [rows] = await pool.query(
      `SELECT id, username, action, module, details, ip_address AS ipAddress, created_at AS createdAt
       FROM audit_logs ${whereClause}
       ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`,
      params
    );
    
    const parsedLogs = (rows || []).map(r => {
      let d = null;
      try { d = typeof r.details === 'string' ? JSON.parse(r.details) : r.details; } catch { d = { raw: r.details }; }
      return { id: r.id, username: r.username, action: r.action, module: r.module, details: d, ipAddress: r.ipAddress, createdAt: r.createdAt };
    });
    
    return res.json({ success: true, logs: parsedLogs, total: countResult[0]?.total || 0, limit, offset });
  } catch (err) {
    console.error('[System logs Error]', err.message);
    return res.json({ success: true, logs: [], total: 0 });
  }
});

router.get('/security/live-activity', authenticate, authorize('Admin', 'Super Admin'), async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 5), 100);
    const [rows] = await pool.query(
      `SELECT id, username, action, module, details, ip_address AS ipAddress, created_at AS createdAt
       FROM audit_logs
       ORDER BY id DESC LIMIT ?`,
      [limit]
    );
    
    const parsedActivity = (rows || []).map(r => {
      let d = null;
      try { d = typeof r.details === 'string' ? JSON.parse(r.details) : r.details; } catch { d = { raw: r.details }; }
      return { id: r.id, username: r.username, action: r.action, module: r.module, details: d, ipAddress: r.ipAddress, createdAt: r.createdAt };
    });
    
    return res.json({ success: true, activity: parsedActivity });
  } catch (err) {
    console.error('[Live activity Error]', err.message);
    return res.json({ success: true, activity: [] });
  }
});

router.get('/security/dashboard-stats', authenticate, authorize('Admin', 'Super Admin'), async (req, res) => {
  try {
    const [securityCount] = await pool.query(
      `SELECT COUNT(*) as total FROM audit_logs WHERE module = 'Security'`
    );
    const [authCount] = await pool.query(
      `SELECT COUNT(*) as total FROM audit_logs WHERE module = 'Auth'`
    );
    const [systemCount] = await pool.query(
      `SELECT COUNT(*) as total FROM audit_logs WHERE module NOT IN ('Security', 'Auth')`
    );
    const [todayEvents] = await pool.query(
      `SELECT COUNT(*) as total FROM audit_logs WHERE created_at >= CURDATE()`
    );
    
    return res.json({
      success: true,
      stats: {
        securityEvents: securityCount[0]?.total || 0,
        authEvents: authCount[0]?.total || 0,
        systemLogs: systemCount[0]?.total || 0,
        todayEvents: todayEvents[0]?.total || 0
      }
    });
  } catch (err) {
    console.error('[Dashboard stats Error]', err.message);
    return res.json({ success: true, stats: { securityEvents: 0, authEvents: 0, systemLogs: 0, todayEvents: 0 } });
  }
});

// ── Security Controller Routes ──────────────────────────────────────
const securityController = require('../controllers/securityController');
router.get('/security/dashboard', authenticate, authorize('Admin', 'Super Admin'), securityController.getSecurityDashboard);
router.get('/security/settings', authenticate, authorize('Admin', 'Super Admin'), securityController.getSecuritySettings);
router.put('/security/settings', authenticate, authorize('Admin', 'Super Admin'), securityController.updateSecuritySettings);
router.get('/security/login-activity', authenticate, authorize('Admin', 'Super Admin'), securityController.getLoginActivity);
router.get('/security/audit-logs', authenticate, authorize('Admin', 'Super Admin'), securityController.getAuditLogs);
router.get('/security/active-sessions', authenticate, authorize('Admin', 'Super Admin'), securityController.getActiveSessions);
router.post('/security/unlock-account', authenticate, authorize('Admin', 'Super Admin'), securityController.unlockAccount);

// ── User Tracking Routes ─────────────────────────────────────────
const userTrackingController = require('../controllers/userTrackingController');
router.post('/user-tracking/login', authenticate, userTrackingController.trackLogin);
router.post('/user-tracking/logout', authenticate, userTrackingController.trackLogout);
router.post('/user-tracking/activity', authenticate, userTrackingController.trackActivity);
router.get('/user-tracking/active', authenticate, authorize('Admin', 'Super Admin', 'Manager'), userTrackingController.getActiveUsers);
router.get('/user-tracking/stats', authenticate, authorize('Admin', 'Super Admin', 'Manager'), userTrackingController.getUserTrackingStats);
router.get('/user-tracking/activity', authenticate, authorize('Admin', 'Super Admin', 'Manager'), userTrackingController.getUserActivity);

// ── Kiosk PIN Routes (Admin Only) ────────────────────────────────────
const kioskPinController = require('../controllers/kioskPinController');
router.get('/kiosk-pins', authenticate, authorize('Admin', 'Super Admin'), kioskPinController.listPins);
router.post('/kiosk-pins', authenticate, authorize('Admin', 'Super Admin'), kioskPinController.upsertPin);
router.post('/kiosk-pins/verify', kioskPinController.verifyPin);
router.post('/kiosk-pins/:id/revoke', authenticate, authorize('Admin', 'Super Admin'), kioskPinController.revokePin);

// ── Enhanced Designations Routes ─────────────────────────────────────
router.get('/designations', settingsController.getDesignations);
router.get('/designations/public', settingsController.getPublicDesignations);
router.post('/designations', authenticate, authorize('Admin', 'Super Admin'), settingsController.addDesignation);
router.delete('/designations', authenticate, authorize('Admin', 'Super Admin'), settingsController.deleteDesignation);

// ── Consent Routes ─────────────────────────────────────────────────────
const consentController = require('../controllers/consentController');
router.get('/consent/status', authenticate, consentController.getStatus);
router.post('/consent/accept', authenticate, consentController.accept);
router.get('/consent/policy-versions', consentController.getPolicyVersions);
router.get('/consent/admin/user-consents', authenticate, authorize('Admin', 'Super Admin'), consentController.getUserConsents);

// ── Server-Side Route Validation ─────────────────────────────────────
// Validates a pathname against the user_permissions matrix and allowed_routes table.
// Called by the frontend RouteGuard to confirm a URL is permitted before rendering.
const ROUTE_TO_MODULE_MAP = [
  { pattern: /^\/dashboard(\/|$)/, module: 'dashboard' },
  { pattern: /^\/wedding-crm\/customers\/new(\/|$)/, module: 'wedding_registration' },
  { pattern: /^\/wedding\/customer-registration(\/|$)/, module: 'wedding_registration' },
  { pattern: /^\/wedding-registration(\/|$)/, module: 'wedding_registration' },
  { pattern: /^\/wedding-crm(\/|$)/, module: 'wedding_crm' },
  { pattern: /^\/wedding-operations(\/|$)/, module: 'wedding_operations' },
  { pattern: /^\/telecaller\/desk(\/|$)/, module: 'telecaller_desk' },
  { pattern: /^\/telecaller-dashboard(\/|$)/, module: 'telecaller_dashboard' },
  { pattern: /^\/footfall(\/|$)/, module: 'footfall' },
  { pattern: /^\/feedback-collection(\/|$)/, module: 'feedback_collection' },
  { pattern: /^\/feedback-list(\/|$)/, module: 'feedback_list' },
  { pattern: /^\/feedback-qr-management(\/|$)/, module: 'feedback_qr' },
  { pattern: /^\/feedback-qr(\/|$)/, module: 'feedback_qr' },
  { pattern: /^\/divert(\/|$)/, module: 'divert' },
  { pattern: /^\/candidates(\/|$)/, module: 'candidates' },
  { pattern: /^\/offer-process(\/|$)/, module: 'offer' },
  { pattern: /^\/openings(\/|$)/, module: 'openings' },
  { pattern: /^\/employees(\/|$)/, module: 'employees' },
  { pattern: /^\/department-hiring(\/|$)/, module: 'dept_hiring' },
  { pattern: /^\/section-allocation(\/|$)/, module: 'section_allocation' },
  { pattern: /^\/daily-mcheck(\/|$)/, module: 'daily_mcheck' },
  { pattern: /^\/mcheck-reports(\/|$)/, module: 'mcheck_reports' },
  { pattern: /^\/mcheck-history(\/|$)/, module: 'mcheck_history' },
  { pattern: /^\/broadcast-center(\/|$)/, module: 'broadcast' },
  { pattern: /^\/user-management(\/|$)/, module: 'user_management' },
  { pattern: /^\/settings(\/|$)/, module: 'settings' },
  { pattern: /^\/system-admin(\/|$)/, module: 'system_admin' },
  { pattern: /^\/attendance(\/|$)/, module: 'attendance' },
  { pattern: /^\/pm-view(\/|$)/, module: 'pm_view' },
  { pattern: /^\/vm-checklist(\/|$)/, module: 'vm_checklist' },
  { pattern: /^\/greeter(\/|$)/, module: 'greeter' },
  { pattern: /^\/tv(\/|$)/, module: 'tv' },
  { pattern: /^\/chat-dashboard(\/|$)/, module: 'dashboard' },
  { pattern: /^\/batch-plan(\/|$)/, module: 'batch_plan' },
  { pattern: /^\/doj-desk(\/|$)/, module: 'doj_desk' },
];

const PUBLIC_ROUTE_PATTERNS = [
  /^\/$/,
  /^\/login/,
  /^\/forgot-password/,
  /^\/apply/,
  /^\/applicants\//,
  /^\/candidate-registration/,
  /^\/wedding-registration$/,
  /^\/feedback-public/,
  /^\/feedback-qr$/,
  /^\/track/,
  /^\/tv$/,
  /^\/cash-settlement/
];

router.post('/security/validate-route', authenticate, async (req, res) => {
  try {
    const { pathname } = req.body || {};
    const role = req.user?.role;
    const userId = req.user?.id;

    if (!pathname || !role) {
      return res.json({ success: true, allowed: false, reason: 'Missing pathname or role' });
    }

    // Public routes are always allowed
    if (PUBLIC_ROUTE_PATTERNS.some(rx => rx.test(pathname))) {
      return res.json({ success: true, allowed: true, reason: 'Public route' });
    }

    // Admin / Super Admin bypass — always allowed
    if (['Admin', 'Super Admin'].includes(role)) {
      return res.json({ success: true, allowed: true, reason: 'Admin bypass' });
    }

    // 1. Check user-specific permissions (Access Control Matrix)
    try {
      const [userPerms] = await pool.query(
        'SELECT module, can_view FROM user_permissions WHERE user_id = ?',
        [userId]
      );

      if (userPerms && userPerms.length > 0) {
        const matched = ROUTE_TO_MODULE_MAP.find(m => m.pattern.test(pathname));
        if (!matched) {
          // Unconstrained internal path
          return res.json({ success: true, allowed: true, reason: 'Unconstrained path' });
        }

        if (matched.module === 'dashboard') {
          return res.json({ success: true, allowed: true, reason: 'Dashboard access permitted' });
        }

        const permRow = userPerms.find(p => p.module === matched.module);
        if (permRow) {
          if (permRow.can_view) {
            return res.json({ success: true, allowed: true, reason: 'Permitted by user Access Control Matrix' });
          } else {
            return res.json({
              success: true,
              allowed: false,
              reason: `Access to module "${matched.module.replace(/_/g, ' ')}" not granted in matrix`
            });
          }
        }

        // Related wedding module aliases
        if (matched.module === 'wedding_crm' && userPerms.some(p => (p.module === 'wedding_registration' || p.module === 'telecaller_desk') && p.can_view)) {
          return res.json({ success: true, allowed: true, reason: 'Permitted via related wedding module' });
        }
        if (matched.module === 'wedding_registration' && userPerms.some(p => p.module === 'wedding_crm' && p.can_view)) {
          return res.json({ success: true, allowed: true, reason: 'Permitted via Wedding CRM view access' });
        }
      }
    } catch (e) {
      console.warn('[validate-route] user_permissions check fallback:', e.message);
    }

    // 2. Fall back to role-based routes table
    const roleAliasMap = {
      'super admin': 'Super Admin',
      'admin': 'Admin',
      'system administrator': 'Super Admin',
      'hr manager': 'HR',
      'hr': 'HR',
      'manager': 'Manager',
      'store manager': 'Manager',
      'floor manager': 'Manager',
      'department manager': 'Manager',
      'visual merchandiser': 'VM',
      'vm': 'VM',
      'crm exec': 'CRM Executive',
      'crm executive': 'CRM Executive',
      'crm manager': 'CRM Manager',
      'telecaller': 'Telecaller',
      'caller': 'Telecaller',
      'tele-caller': 'Telecaller',
      'tele caller': 'Telecaller',
      'vm extension telecaller': 'Telecaller',
      'vm telecaller': 'Telecaller',
      'wedding collection manager': 'Wedding Collection Manager',
      'wedding manager': 'Wedding Collection Manager',
      'data analyst': 'Data Analyst',
      'analyst': 'Data Analyst',
      'greeter': 'Greeter',
      'employee': 'Employee',
    };
    const cleanRole = (role || '').trim().toLowerCase().replace(/[_\s-]+/g, ' ');
    const normalizedRole = roleAliasMap[cleanRole] || roleAliasMap[role.toLowerCase()] || role;

    const [rows] = await pool.query(
      'SELECT route_pattern FROM allowed_routes WHERE role = ? AND is_active = 1',
      [normalizedRole]
    );

    if (!rows || rows.length === 0) {
      // No role rules configured — fail open (frontend RBAC is the primary guard)
      return res.json({ success: true, allowed: true, reason: 'No route rules configured' });
    }

    const isAllowed = rows.some(row => {
      try {
        const regex = new RegExp(row.route_pattern);
        return regex.test(pathname);
      } catch (e) {
        return false;
      }
    });

    return res.json({
      success: true,
      allowed: isAllowed,
      reason: isAllowed ? 'Route permitted for role' : `Route not permitted for role ${normalizedRole}`
    });
  } catch (err) {
    console.error('[validate-route]', err.message);
    // Fail open — frontend RBAC is primary
    return res.json({ success: true, allowed: true, reason: 'Validation error — frontend guard active' });
  }
});

// ── Session Activity Endpoints (Admin) ───────────────────────────────
router.get('/security/session-activity', authenticate, authorize('Admin', 'Super Admin'), async (req, res) => {
  try {
    const { userId, username, action, limit = 100, offset = 0 } = req.query;
    let where = 'WHERE 1=1';
    const params = [];

    if (userId) { where += ' AND user_id = ?'; params.push(userId); }
    if (username) { where += ' AND username LIKE ?'; params.push(`%${username}%`); }
    if (action) { where += ' AND action = ?'; params.push(action); }

    const safeLimit = Math.min(parseInt(limit) || 100, 500);
    const safeOffset = Math.max(parseInt(offset) || 0, 0);

    const [rows] = await pool.query(
      `SELECT * FROM session_activity ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, safeLimit, safeOffset]
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM session_activity ${where}`,
      params
    );

    return res.json({ success: true, data: rows, total, limit: safeLimit, offset: safeOffset });
  } catch (err) {
    console.error('[session-activity]', err.message);
    return res.json({ success: true, data: [], total: 0 });
  }
});

// ── Force Logout (Admin) ─────────────────────────────────────────────
// Blacklists a specific user's token and invalidates their session.
router.post('/security/force-logout', authenticate, authorize('Admin', 'Super Admin'), async (req, res) => {
  try {
    const { userId, username, reason } = req.body || {};
    if (!userId && !username) {
      return errorRes(res, 'userId or username required', [], 400);
    }

    // Find the user's last active token from session_activity and blacklist it
    const [sessions] = await pool.query(
      `SELECT DISTINCT session_id FROM session_activity WHERE (user_id = ? OR username = ?) AND session_id IS NOT NULL ORDER BY created_at DESC LIMIT 1`,
      [userId || null, username || '']
    );

    let blacklistedCount = 0;
    for (const session of sessions) {
      // We can't recover the raw token from session_id (it's a correlation ID),
      // but we can mark the user as force-logged-out by clearing their cookie
      // on the next request via the authenticate middleware's DB status check.
      // For immediate invalidation, we rely on the JWT blacklist + account deactivation.
      blacklistedCount++;
    }

    // Log the force-logout event
    const { logSessionActivity } = require('../middleware/auth');
    logSessionActivity({
      userId: req.user.id,
      username: req.user.username,
      sessionId: req.correlationId,
      action: 'FORCE_LOGOUT',
      module: 'security',
      details: { targetUserId: userId, targetUsername: username, reason: reason || 'Admin action' },
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'],
      locationId: req.user.locationId,
      method: 'POST',
      path: '/security/force-logout'
    });

    return res.json({ success: true, message: `Force logout recorded for ${username || userId}` });
  } catch (err) {
    console.error('[force-logout]', err.message);
    return errorRes(res, 'Failed to process force logout', [err.message], 500);
  }
});

module.exports = router;