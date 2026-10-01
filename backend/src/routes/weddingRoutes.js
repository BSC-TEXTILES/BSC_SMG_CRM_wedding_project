const express = require('express');
const router = express.Router();
const weddingController = require('../controllers/weddingController');
const { authenticate, authorize, authorizeLocationAccess } = require('../middleware/auth');
const { requireModuleAction } = require('../middleware/moduleGuard');
const { errorRes } = require('../utils/response');
const multer = require('multer');

// Bulk uploads (CSV and XLSX) are parsed in-memory (max 10 MB) — nothing touches the disk.
const bulkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/\.xls$/i.test(file.originalname)) {
      return cb(new Error('Legacy .xls files are not supported. Open the file and save it as .xlsx (File > Save As > Excel Workbook), then upload it again.'), false);
    }
    const isCsv = /\.csv$/i.test(file.originalname) || file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel';
    const isXlsx = /\.xlsx$/i.test(file.originalname) || file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (isCsv || isXlsx) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only .csv and .xlsx files are allowed.'), false);
    }
  }
});

const googleSheetsController = require('../controllers/googleSheetsController');

// ── Google OAuth Callback (Must be before authenticate as it is called directly by Google redirect) ──
router.get('/google/callback', (req, res, next) => googleSheetsController.handleCallback(req, res, next));

// All wedding CRM routes require authentication and store-level location access authorization
router.use(authenticate);
router.use(authorizeLocationAccess());

// Module-level RBAC (Access Control Matrix → role defaults) + audit + force logout
const canViewWedding = requireModuleAction('wedding_crm', 'can_view');
const canAddWedding = requireModuleAction('wedding_crm', 'can_add');

// ── Google Sheets Integration Routes (authenticated + module guarded) ──
router.get('/google/status', canViewWedding, (req, res, next) => googleSheetsController.getStatus(req, res, next));
router.get('/google/auth-url', canViewWedding, (req, res, next) => googleSheetsController.getAuthUrl(req, res, next));
router.post('/google/disconnect', canViewWedding, (req, res, next) => googleSheetsController.disconnect(req, res, next));
router.post('/google/config', canAddWedding, (req, res, next) => googleSheetsController.saveConfig(req, res, next));
router.get('/google/sheets', canViewWedding, (req, res, next) => googleSheetsController.listSpreadsheets(req, res, next));
router.get('/google/sheets/:id', canViewWedding, (req, res, next) => googleSheetsController.getSpreadsheetDetails(req, res, next));
router.get('/google/sheets/:id/preview', canViewWedding, (req, res, next) => googleSheetsController.previewWorksheet(req, res, next));
router.post('/google/import', canAddWedding, (req, res, next) => googleSheetsController.importSheet(req, res, next));

// ── Template Downloads (authenticated + wedding_crm view permission) ──
router.get('/template-csv', canViewWedding, (req, res, next) => weddingController.downloadCsvTemplate(req, res, next));
router.get('/template-xlsx', canViewWedding, (req, res, next) => weddingController.downloadXlsxTemplate(req, res, next));
router.get('/template', canViewWedding, (req, res, next) => weddingController.downloadCsvTemplate(req, res, next));

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
router.get('/export-customers-csv', weddingController.exportCustomersCsv);
router.get('/export-csv', weddingController.exportCustomersCsv);

// ── Bulk CSV / Excel Import (authenticated + wedding_crm add permission) ──
const handleBulkImport = (req, res, next) => {
  bulkUpload.single('file')(req, res, (err) => {
    if (err) return errorRes(res, err.message || 'File upload failed', [], 400);
    return weddingController.importCsv(req, res, next);
  });
};
router.post('/import-csv', canAddWedding, handleBulkImport);
router.post('/import', canAddWedding, handleBulkImport);

// ── Import Error Report (.xlsx) + Import History ──────────────
router.post('/import-error-report', canViewWedding, weddingController.downloadErrorReport);
router.get('/import-logs', canViewWedding, weddingController.getImportLogs);
router.delete('/import-logs/:id', canViewWedding, weddingController.deleteImportLog);
router.delete('/import-logs', canViewWedding, weddingController.clearImportLogs);

// ── Duplicate Phone Check ─────────────────────────────────────
router.post('/check-duplicate', weddingController.checkDuplicate);

// ── Log Call Outcome ──────────────────────────────────────────
router.post('/log-call', weddingController.logCall);

// ── Enhanced Dashboard ─────────────────────────────────────────
router.get('/dashboard/enhanced', weddingController.getEnhancedDashboardStats);
router.get('/dashboard/charts', weddingController.getDashboardCharts);
router.get('/employee-performance', weddingController.getEmployeePerformance);
router.get('/pipeline', weddingController.getStatusPipeline);
router.get('/pipeline/board', canViewWedding, weddingController.getPipelineBoard);
router.get('/upcoming-weddings', weddingController.getUpcomingWeddings);
router.get('/flow-stream', canViewWedding, weddingController.getCustomerFlowStream);

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

// ── Telecaller Authority & Workspace ──────────────────────────
router.put('/customers/:id/telecaller-edit', weddingController.updateCustomerByTelecaller);
router.get('/customers/:id/timeline', weddingController.getCustomerTimeline);
router.get('/customers/:id/whatsapp-templates', weddingController.getWhatsAppTemplates);
router.post('/customers/:id/whatsapp-send', weddingController.sendWhatsAppMessage);
router.get('/customers/:id/whatsapp-logs', weddingController.getWhatsAppLogs);
router.get('/telecaller-performance', weddingController.getTelecallerPerformance);

// ── Old Customers (Historical Archive) ─────────────────────────
router.get('/old-customers', canViewWedding, weddingController.getOldCustomers);
router.get('/old-customers/export', canViewWedding, weddingController.exportOldCustomers);
router.post('/old-customers/auto-archive', canAddWedding, weddingController.autoArchiveOldCustomers);
router.post('/customers/:id/archive', canAddWedding, weddingController.moveToOldCustomers);
router.post('/customers/:id/restore', canAddWedding, weddingController.restoreCustomer);

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
