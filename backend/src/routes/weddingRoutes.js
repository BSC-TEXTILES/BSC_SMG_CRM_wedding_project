const express = require('express');
const router = express.Router();
const weddingController = require('../controllers/weddingController');
const { authenticate, authorize } = require('../middleware/auth');
const { errorRes } = require('../utils/response');
const multer = require('multer');

// CSV uploads are parsed in-memory (max 2 MB) — nothing touches the disk.
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /\.csv$/i.test(file.originalname) || file.mimetype === 'text/csv';
    cb(ok ? null : new Error('Only .csv files are allowed'), ok);
  }
});

// All wedding CRM routes require authentication
router.use(authenticate);

// ── Dashboard & Stats ─────────────────────────────────────────
router.get('/stats', weddingController.getDashboardStats);

// ── Calling Desk ──────────────────────────────────────────────
const { telecallerQueueLimiter } = require('../middleware/smartRateLimiter');
router.get('/calling-desk', telecallerQueueLimiter, weddingController.getCallingDesk);

// ── Follow-up Calendar ────────────────────────────────────────
router.get('/calendar', weddingController.getCalendar);

// ── Analytics & Conversion Funnel ─────────────────────────────
router.get('/analytics', weddingController.getAnalytics);

// ── Telecallers List (for assignment dropdown) ────────────────
router.get('/telecallers', weddingController.getTelecallers);

// ── Export Data (Excel / CSV / Report data) ────────────────────
router.get('/export', weddingController.exportData);

// ── Bulk CSV Import (strict validation) ───────────────────────
router.post('/import-csv', (req, res, next) => {
  csvUpload.single('file')(req, res, (err) => {
    if (err) return errorRes(res, err.message || 'CSV upload failed', [], 400);
    return weddingController.importCsv(req, res, next);
  });
});

// ── Duplicate Phone Check ─────────────────────────────────────
router.post('/check-duplicate', weddingController.checkDuplicate);

// ── Log Call Outcome ──────────────────────────────────────────
router.post('/log-call', weddingController.logCall);

// ── Enhanced Dashboard ─────────────────────────────────────────
router.get('/dashboard/enhanced', weddingController.getEnhancedDashboardStats);
router.get('/dashboard/charts', weddingController.getDashboardCharts);
router.get('/employee-performance', weddingController.getEmployeePerformance);
router.get('/pipeline', weddingController.getStatusPipeline);
router.get('/upcoming-weddings', weddingController.getUpcomingWeddings);

// ── Advanced Search ────────────────────────────────────────────
router.get('/search', weddingController.searchCustomers);

// ── Reports ────────────────────────────────────────────────────
router.get('/reports', weddingController.getReports);

// ── Customer Sources ───────────────────────────────────────────
router.get('/sources', weddingController.getCustomerSources);

// ── Extended Calendar ──────────────────────────────────────────
router.get('/calendar/extended', weddingController.getExtendedCalendar);

// ── Customer CRUD ─────────────────────────────────────────────
router.get('/customers', weddingController.getCustomers);
router.post('/customers', weddingController.createCustomer);
router.get('/customers/:id', weddingController.getCustomerById);
router.get('/customers/:id/full-profile', weddingController.getFullCustomerProfile);
router.put('/customers/:id', weddingController.updateCustomer);
router.delete('/customers/:id', authorize('Admin', 'Super Admin', 'HR', 'Manager'), weddingController.deleteCustomer);

// ── Status Management ──────────────────────────────────────────
router.get('/customers/:id/status-history', weddingController.getStatusHistory);
router.put('/customers/:id/status', weddingController.changeStatus);

// ── Visits ─────────────────────────────────────────────────────
router.get('/customers/:id/visits', weddingController.getVisits);
router.post('/customers/:id/visits', weddingController.createVisit);
router.put('/visits/:visitId', weddingController.updateVisit);

// ── Appointments ───────────────────────────────────────────────
router.get('/customers/:id/appointments', weddingController.getAppointments);
router.post('/customers/:id/appointments', weddingController.createAppointment);
router.put('/appointments/:appointmentId', weddingController.updateAppointment);

// ── Purchases ──────────────────────────────────────────────────
router.get('/customers/:id/purchases', weddingController.getPurchases);
router.post('/customers/:id/purchases', weddingController.createPurchase);
router.put('/purchases/:purchaseId', weddingController.updatePurchase);

// ── Notes ──────────────────────────────────────────────────────
router.get('/customers/:id/notes', weddingController.getNotes);
router.post('/customers/:id/notes', weddingController.createNote);

// ── Communication History ──────────────────────────────────────
router.get('/customers/:id/communications', weddingController.getCommunicationHistory);
router.post('/customers/:id/communications', weddingController.createCommunication);

// ── Documents ──────────────────────────────────────────────────
router.get('/customers/:id/documents', weddingController.getDocuments);

// ── Merge Duplicates ───────────────────────────────────────────
router.post('/customers/merge', weddingController.mergeCustomers);

// ── Bulk Operations ────────────────────────────────────────────
router.post('/bulk/status', weddingController.bulkUpdateStatus);
router.post('/bulk/assign', weddingController.bulkAssign);

module.exports = router;
