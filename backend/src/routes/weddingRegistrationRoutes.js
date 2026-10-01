const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const weddingRegistrationController = require('../controllers/weddingRegistrationController');
const { authenticate, authorize, authorizeLocationAccess } = require('../middleware/auth');
const { errorRes } = require('../utils/response');

const {
  publicRegistrationRateLimiter,
  duplicateCheckRateLimiter,
  publicTrackingRateLimiter
} = require('../security/rateLimiters');

// Public registration routes (no auth required for customer registration, strictly rate-limited)
router.post('/public/wedding-registration', publicRegistrationRateLimiter, weddingRegistrationController.createRegistration);
router.get('/public/wedding-registration/next-id', duplicateCheckRateLimiter, weddingRegistrationController.getNextRegistrationId);
router.post('/public/wedding-registration/check-duplicate', duplicateCheckRateLimiter, weddingRegistrationController.checkDuplicate);

// Public tracking route (no auth, rate-limited)
router.post('/public/wedding-registration/track', publicTrackingRateLimiter, weddingRegistrationController.trackRegistration);

// All other routes require authentication and store-level location access authorization
router.use(authenticate);
router.use(authorizeLocationAccess());

// Dashboard Stats
router.get('/wedding-registrations/stats', weddingRegistrationController.getDashboardStats);

// Registration CRUD
router.get('/wedding-registrations', weddingRegistrationController.getRegistrations);
// Must precede /:id — otherwise 'export' is captured as an id and parseInt gives NaN
router.get('/wedding-registrations/export', weddingRegistrationController.exportRegistrations);
router.get('/wedding-registrations/:id', weddingRegistrationController.getRegistrationById);
router.post('/wedding-registrations', weddingRegistrationController.createRegistration);
router.put('/wedding-registrations/:id', weddingRegistrationController.updateRegistration);
router.delete('/wedding-registrations/:id', authorize('Admin', 'Super Admin', 'HR', 'Manager'), weddingRegistrationController.deleteRegistration);
router.post('/wedding-registrations/:id/resend-email', weddingRegistrationController.resendConfirmationEmail);

// Duplicate Check
router.post('/wedding-registrations/check-duplicate', weddingRegistrationController.checkDuplicate);

module.exports = router;