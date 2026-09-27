/**
 * BSC WEDDING COLLECTIONS LANDING PAGE — public routes.
 *
 * ADDITIVE MODULE: mounted at /api/landing in backend/index.js.
 * These routes are intentionally public (marketing surface) but strictly
 * rate-limited and validated; they never expose existing CRM data beyond
 * the public store list.
 */

const express = require('express');
const router = express.Router();
const { buildResilientLimiter } = require('../middleware/rateLimiterFactory');
const landingController = require('../controllers/landingController');

// General landing API: 120 requests / 5 min / IP (page loads + events).
const generalLimiter = buildResilientLimiter({
  windowMs: 5 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { success: false, message: 'Too many requests, please slow down.', errors: [] }
});

// Enquiry submission: 35 per 15 min / IP — generous for humans, hostile to bots.
const enquiryLimiter = buildResilientLimiter({
  windowMs: 15 * 60 * 1000,
  max: 35,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { success: false, message: 'Too many enquiries from this device. Please call the store instead.', errors: [] }
});

router.use(generalLimiter);

// ── Public store list (for the Locations section) ──────────────────────
router.get('/locations', landingController.getLocations);

// ── Public enquiry / registration → wedding_customers ──────────────────
router.post('/enquiry', enquiryLimiter, landingController.createEnquiry);

// ── Landing analytics (clicks, scroll depth, section views, time) ──────
router.post('/event', landingController.trackEvent);

module.exports = router;
