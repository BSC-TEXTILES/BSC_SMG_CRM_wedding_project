const express = require('express');
const router = express.Router();
const telecallerDashboardController = require('../controllers/telecallerDashboardController');
const { authenticate } = require('../middleware/auth');
const { dashboardLimiter } = require('../middleware/smartRateLimiter');

// All telecaller dashboard routes require authentication and rate limiting
router.use(authenticate, dashboardLimiter);

// ── Dashboard Stats ────────────────────────────────────────────
router.get('/stats', telecallerDashboardController.getDashboardStats);

// ── Follow-Up Pipeline ─────────────────────────────────────────
router.get('/pipeline', telecallerDashboardController.getFollowUpPipeline);

// ── Call History ───────────────────────────────────────────────
router.get('/call-history', telecallerDashboardController.getCallHistory);

// ── Performance Metrics ────────────────────────────────────────
router.get('/performance', telecallerDashboardController.getPerformanceMetrics);

// ── Customer Detail ────────────────────────────────────────────
router.get('/customers/:id', telecallerDashboardController.getCustomerDetail);

// ── Recent Customers ───────────────────────────────────────────
router.get('/recent-customers', telecallerDashboardController.getRecentCustomers);

module.exports = router;
