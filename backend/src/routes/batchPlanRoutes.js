const express = require('express');
const router = express.Router();
const batchPlanController = require('../controllers/batchPlanController');
const { authenticate, authorizeLocationAccess, authorize } = require('../middleware/auth');

// All batch plan routes require authentication and location authorization
router.use(authenticate);
router.use(authorizeLocationAccess());

// ── Batch Routes ─────────────────────────────────────────────
router.get('/stats', batchPlanController.getStats);
router.get('/batches', batchPlanController.getBatches);
router.get('/batches/:id', batchPlanController.getBatchById);
router.post('/batches', batchPlanController.createBatch);
router.put('/batches/:id', batchPlanController.updateBatch);
router.delete('/batches/:id', authorize('Admin', 'Super Admin'), batchPlanController.deleteBatch);

// ── Batch Group Routes ───────────────────────────────────────
router.post('/batches/:batchId/groups', batchPlanController.addGroup);
router.put('/groups/:groupId', batchPlanController.updateGroup);
router.delete('/groups/:groupId', batchPlanController.deleteGroup);

// ── Batch Member Routes ──────────────────────────────────────
router.post('/groups/:groupId/members', batchPlanController.addMember);
router.put('/members/:memberId', batchPlanController.updateMember);
router.delete('/members/:memberId', batchPlanController.deleteMember);

module.exports = router;
