/**
 * Profile Website Routes
 * 
 * Sets up public visitor APIs and protected management routes.
 */

const express = require('express');
const router = express.Router();
const controller = require('../controllers/profileSiteController');
const { authenticate } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'profile-media');
if (!fs.existsSync(uploadDir)) {
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
  } catch (e) {}
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${cleanName}_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif|svg|pdf/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) {
      return cb(null, true);
    }
    cb(new Error('Only image files (jpeg, jpg, png, webp, svg) and PDF documents are allowed.'));
  }
});

// Admin Authorization Middleware (Allows Admin, Super Admin, and Editor)
const requireProfileAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  const role = String(req.user.role || '').toLowerCase();
  if (role.includes('admin') || role.includes('editor') || role.includes('manager') || role.includes('owner')) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Access denied: Profile management privileges required' });
};

// ── Public Routes ─────────────────────────────────────────────────────────────
router.get('/profile', (req, res) => controller.getProfile(req, res));
router.get('/experience', (req, res) => controller.getExperience(req, res));
router.get('/skills', (req, res) => controller.getSkills(req, res));
router.get('/services', (req, res) => controller.getServices(req, res));
router.get('/services/:slug', (req, res) => controller.getServiceBySlug(req, res));
router.get('/projects', (req, res) => controller.getProjects(req, res));
router.get('/projects/:slug', (req, res) => controller.getProjectBySlug(req, res));
router.get('/achievements', (req, res) => controller.getAchievements(req, res));
router.get('/testimonials', (req, res) => controller.getTestimonials(req, res));
router.get('/gallery', (req, res) => controller.getGallery(req, res));
router.get('/social-links', (req, res) => controller.getSocialLinks(req, res));
router.get('/settings', (req, res) => controller.getPublicSettings(req, res));
router.post('/contact', (req, res) => controller.submitContact(req, res));

// ── Protected Admin Routes ───────────────────────────────────────────────────
router.get('/admin/stats', authenticate, requireProfileAdmin, (req, res) => controller.getAdminStats(req, res));
router.put('/admin/profile', authenticate, requireProfileAdmin, (req, res) => controller.updateProfile(req, res));

// Experience
router.get('/admin/experience', authenticate, requireProfileAdmin, (req, res) => controller.getAdminExperience(req, res));
router.post('/admin/experience', authenticate, requireProfileAdmin, (req, res) => controller.saveExperience(req, res));
router.put('/admin/experience/:id', authenticate, requireProfileAdmin, (req, res) => {
  req.body.id = req.params.id;
  controller.saveExperience(req, res);
});
router.delete('/admin/experience/:id', authenticate, requireProfileAdmin, (req, res) => controller.deleteExperience(req, res));

// Skills
router.post('/admin/skills', authenticate, requireProfileAdmin, (req, res) => controller.saveSkill(req, res));
router.put('/admin/skills/:id', authenticate, requireProfileAdmin, (req, res) => {
  req.body.id = req.params.id;
  controller.saveSkill(req, res);
});
router.delete('/admin/skills/:id', authenticate, requireProfileAdmin, (req, res) => controller.deleteSkill(req, res));

// Services
router.post('/admin/services', authenticate, requireProfileAdmin, (req, res) => controller.saveService(req, res));
router.put('/admin/services/:id', authenticate, requireProfileAdmin, (req, res) => {
  req.body.id = req.params.id;
  controller.saveService(req, res);
});
router.delete('/admin/services/:id', authenticate, requireProfileAdmin, (req, res) => controller.deleteService(req, res));

// Projects
router.get('/admin/projects', authenticate, requireProfileAdmin, (req, res) => controller.getAdminProjects(req, res));
router.post('/admin/projects', authenticate, requireProfileAdmin, (req, res) => controller.saveProject(req, res));
router.put('/admin/projects/:id', authenticate, requireProfileAdmin, (req, res) => {
  req.body.id = req.params.id;
  controller.saveProject(req, res);
});
router.delete('/admin/projects/:id', authenticate, requireProfileAdmin, (req, res) => controller.deleteProject(req, res));

// Achievements
router.post('/admin/achievements', authenticate, requireProfileAdmin, (req, res) => controller.saveAchievement(req, res));
router.put('/admin/achievements/:id', authenticate, requireProfileAdmin, (req, res) => {
  req.body.id = req.params.id;
  controller.saveAchievement(req, res);
});
router.delete('/admin/achievements/:id', authenticate, requireProfileAdmin, (req, res) => controller.deleteAchievement(req, res));

// Testimonials
router.post('/admin/testimonials', authenticate, requireProfileAdmin, (req, res) => controller.saveTestimonial(req, res));
router.put('/admin/testimonials/:id', authenticate, requireProfileAdmin, (req, res) => {
  req.body.id = req.params.id;
  controller.saveTestimonial(req, res);
});
router.delete('/admin/testimonials/:id', authenticate, requireProfileAdmin, (req, res) => controller.deleteTestimonial(req, res));

// Gallery
router.post('/admin/gallery', authenticate, requireProfileAdmin, (req, res) => controller.saveGalleryItem(req, res));
router.put('/admin/gallery/:id', authenticate, requireProfileAdmin, (req, res) => {
  req.body.id = req.params.id;
  controller.saveGalleryItem(req, res);
});
router.delete('/admin/gallery/:id', authenticate, requireProfileAdmin, (req, res) => controller.deleteGalleryItem(req, res));

// Messages
router.get('/admin/messages', authenticate, requireProfileAdmin, (req, res) => controller.getContactMessages(req, res));
router.put('/admin/messages/:id', authenticate, requireProfileAdmin, (req, res) => controller.updateContactMessage(req, res));
router.delete('/admin/messages/:id', authenticate, requireProfileAdmin, (req, res) => controller.deleteContactMessage(req, res));

// Social Links & Settings
router.put('/admin/social-links', authenticate, requireProfileAdmin, (req, res) => controller.updateSocialLinks(req, res));
router.get('/admin/settings', authenticate, requireProfileAdmin, (req, res) => controller.getAdminSettings(req, res));
router.put('/admin/settings', authenticate, requireProfileAdmin, (req, res) => controller.updateSettings(req, res));
router.get('/admin/audit-logs', authenticate, requireProfileAdmin, (req, res) => controller.getAuditLogs(req, res));

// Media Upload
router.post('/admin/upload', authenticate, requireProfileAdmin, upload.single('file'), (req, res) => controller.uploadMedia(req, res));

module.exports = router;
