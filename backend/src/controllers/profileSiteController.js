/**
 * Profile Website REST API Controller
 * 
 * Handles all public visitor and protected admin operations with:
 * - Proper HTTP status codes and consistent response structure:
 *   { success: true, message: "...", data: {...} }
 * - Validation, honeypot anti-spam, and rate-limiting safeguards
 * - Audit logging and centralized error handling
 */

const profileDb = require('../services/profileDbService');
const path = require('path');
const fs = require('fs');

class ProfileSiteController {
  // ── Public Endpoints ─────────────────────────────────────────────────────────

  async getProfile(req, res) {
    try {
      const data = await profileDb.getProfile();
      return res.status(200).json({
        success: true,
        message: 'Profile retrieved successfully',
        data
      });
    } catch (err) {
      console.error('[ProfileController.getProfile]', err);
      return res.status(500).json({ success: false, message: 'Failed to retrieve profile data' });
    }
  }

  async getExperience(req, res) {
    try {
      const data = await profileDb.getExperience(false);
      return res.status(200).json({
        success: true,
        message: 'Experience timeline retrieved successfully',
        data
      });
    } catch (err) {
      console.error('[ProfileController.getExperience]', err);
      return res.status(500).json({ success: false, message: 'Failed to retrieve experience data' });
    }
  }

  async getSkills(req, res) {
    try {
      const data = await profileDb.getSkills(false);
      return res.status(200).json({
        success: true,
        message: 'Skills retrieved successfully',
        data
      });
    } catch (err) {
      console.error('[ProfileController.getSkills]', err);
      return res.status(500).json({ success: false, message: 'Failed to retrieve skills' });
    }
  }

  async getServices(req, res) {
    try {
      const data = await profileDb.getServices(false);
      return res.status(200).json({
        success: true,
        message: 'Services retrieved successfully',
        data
      });
    } catch (err) {
      console.error('[ProfileController.getServices]', err);
      return res.status(500).json({ success: false, message: 'Failed to retrieve services' });
    }
  }

  async getServiceBySlug(req, res) {
    try {
      const { slug } = req.params;
      const data = await profileDb.getServiceBySlug(slug);
      if (!data) {
        return res.status(404).json({ success: false, message: 'Service not found' });
      }
      return res.status(200).json({
        success: true,
        message: 'Service details retrieved',
        data
      });
    } catch (err) {
      console.error('[ProfileController.getServiceBySlug]', err);
      return res.status(500).json({ success: false, message: 'Failed to retrieve service' });
    }
  }

  async getProjects(req, res) {
    try {
      const { category, search, limit, offset } = req.query;
      const result = await profileDb.getProjects({
        category,
        search,
        includeUnpublished: false,
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : 0
      });
      return res.status(200).json({
        success: true,
        message: 'Projects retrieved successfully',
        data: result.projects,
        total: result.total
      });
    } catch (err) {
      console.error('[ProfileController.getProjects]', err);
      return res.status(500).json({ success: false, message: 'Failed to retrieve projects' });
    }
  }

  async getProjectBySlug(req, res) {
    try {
      const { slug } = req.params;
      const data = await profileDb.getProjectBySlug(slug);
      if (!data) {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }
      return res.status(200).json({
        success: true,
        message: 'Project retrieved successfully',
        data
      });
    } catch (err) {
      console.error('[ProfileController.getProjectBySlug]', err);
      return res.status(500).json({ success: false, message: 'Failed to retrieve project' });
    }
  }

  async getAchievements(req, res) {
    try {
      const data = await profileDb.getAchievements(false);
      return res.status(200).json({
        success: true,
        message: 'Achievements retrieved successfully',
        data
      });
    } catch (err) {
      console.error('[ProfileController.getAchievements]', err);
      return res.status(500).json({ success: false, message: 'Failed to retrieve achievements' });
    }
  }

  async getTestimonials(req, res) {
    try {
      const data = await profileDb.getTestimonials(false);
      return res.status(200).json({
        success: true,
        message: 'Testimonials retrieved successfully',
        data
      });
    } catch (err) {
      console.error('[ProfileController.getTestimonials]', err);
      return res.status(500).json({ success: false, message: 'Failed to retrieve testimonials' });
    }
  }

  async getGallery(req, res) {
    try {
      const data = await profileDb.getGallery(false);
      return res.status(200).json({
        success: true,
        message: 'Gallery media retrieved successfully',
        data
      });
    } catch (err) {
      console.error('[ProfileController.getGallery]', err);
      return res.status(500).json({ success: false, message: 'Failed to retrieve gallery' });
    }
  }

  async getSocialLinks(req, res) {
    try {
      const data = await profileDb.getSocialLinks();
      return res.status(200).json({
        success: true,
        message: 'Social links retrieved',
        data: data.filter(l => l.is_active)
      });
    } catch (err) {
      console.error('[ProfileController.getSocialLinks]', err);
      return res.status(500).json({ success: false, message: 'Failed to retrieve social links' });
    }
  }

  async getPublicSettings(req, res) {
    try {
      const settings = await profileDb.getSettings();
      // Expose only safe public fields
      const safe = {
        site_title: settings.site_title,
        meta_description: settings.meta_description,
        keywords: settings.keywords,
        canonical_url: settings.canonical_url,
        og_image: settings.og_image,
        contact_email: settings.contact_email,
        contact_phone: settings.contact_phone,
        theme_default: settings.theme_default,
        enable_cookie_consent: settings.enable_cookie_consent
      };
      return res.status(200).json({
        success: true,
        message: 'Settings retrieved',
        data: safe
      });
    } catch (err) {
      console.error('[ProfileController.getPublicSettings]', err);
      return res.status(500).json({ success: false, message: 'Failed to retrieve settings' });
    }
  }

  // ── Contact Form Submission (With Anti-Spam & Validation) ────────────────────
  async submitContact(req, res) {
    try {
      const { name, email, phone, company, subject, message, _hp_field } = req.body;

      // 1. Honeypot check (anti-bot trap: hidden field must remain empty)
      if (_hp_field && _hp_field.trim().length > 0) {
        return res.status(200).json({
          success: true,
          message: 'Thank you for your message. We will respond promptly.'
        });
      }

      // 2. Input validation
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Please provide your full name.' });
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
      }
      if (!message || message.trim().length < 10) {
        return res.status(400).json({ success: false, message: 'Message should be at least 10 characters.' });
      }

      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || '';

      const saved = await profileDb.saveContactMessage({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone ? phone.trim() : '',
        company: company ? company.trim() : '',
        subject: subject ? subject.trim() : 'General Profile Inquiry',
        message: message.trim(),
        ip_address: String(clientIp),
        user_agent: String(userAgent)
      });

      console.log(`[Contact] New inquiry from ${saved.name} <${saved.email}> stored with ID: ${saved.id}`);

      return res.status(201).json({
        success: true,
        message: 'Thank you! Your message has been received. Our team will contact you within 24 hours.',
        data: { id: saved.id, created_at: saved.created_at }
      });
    } catch (err) {
      console.error('[ProfileController.submitContact]', err);
      return res.status(500).json({ success: false, message: 'Failed to process inquiry. Please try again or reach us by phone.' });
    }
  }

  // ── Protected Admin Endpoints ────────────────────────────────────────────────

  async getAdminStats(req, res) {
    try {
      const stats = await profileDb.getDashboardStats();
      return res.status(200).json({
        success: true,
        message: 'Admin dashboard statistics retrieved',
        data: stats
      });
    } catch (err) {
      console.error('[ProfileController.getAdminStats]', err);
      return res.status(500).json({ success: false, message: 'Failed to calculate dashboard statistics' });
    }
  }

  async updateProfile(req, res) {
    try {
      const updates = req.body;
      const updated = await profileDb.updateProfile(updates, req.user);
      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: updated
      });
    } catch (err) {
      console.error('[ProfileController.updateProfile]', err);
      return res.status(500).json({ success: false, message: 'Failed to update profile' });
    }
  }

  // Experience Admin
  async getAdminExperience(req, res) {
    try {
      const data = await profileDb.getExperience(true);
      return res.status(200).json({ success: true, data });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  async saveExperience(req, res) {
    try {
      const item = req.body;
      if (!item.company || !item.position) {
        return res.status(400).json({ success: false, message: 'Company and Position are required fields' });
      }
      const saved = await profileDb.saveExperience(item, req.user);
      return res.status(200).json({
        success: true,
        message: item.id ? 'Experience updated successfully' : 'New experience milestone added',
        data: saved
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  async deleteExperience(req, res) {
    try {
      const { id } = req.params;
      await profileDb.deleteExperience(id, req.user);
      return res.status(200).json({ success: true, message: 'Experience entry deleted' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Skills Admin
  async saveSkill(req, res) {
    try {
      const item = req.body;
      if (!item.name || !item.category) {
        return res.status(400).json({ success: false, message: 'Skill name and Category are required' });
      }
      const saved = await profileDb.saveSkill(item, req.user);
      return res.status(200).json({
        success: true,
        message: item.id ? 'Skill updated' : 'Skill created',
        data: saved
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  async deleteSkill(req, res) {
    try {
      const { id } = req.params;
      await profileDb.deleteSkill(id, req.user);
      return res.status(200).json({ success: true, message: 'Skill deleted' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Services Admin
  async saveService(req, res) {
    try {
      const item = req.body;
      if (!item.title) {
        return res.status(400).json({ success: false, message: 'Service title is required' });
      }
      const saved = await profileDb.saveService(item, req.user);
      return res.status(200).json({
        success: true,
        message: item.id ? 'Service updated successfully' : 'New service created',
        data: saved
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  async deleteService(req, res) {
    try {
      const { id } = req.params;
      await profileDb.deleteService(id, req.user);
      return res.status(200).json({ success: true, message: 'Service removed' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Projects Admin
  async getAdminProjects(req, res) {
    try {
      const { category, search } = req.query;
      const result = await profileDb.getProjects({ category, search, includeUnpublished: true });
      return res.status(200).json({ success: true, data: result.projects, total: result.total });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  async saveProject(req, res) {
    try {
      const item = req.body;
      if (!item.title || !item.category) {
        return res.status(400).json({ success: false, message: 'Project title and Category are required' });
      }
      const saved = await profileDb.saveProject(item, req.user);
      return res.status(200).json({
        success: true,
        message: item.id ? 'Project updated' : 'Project added to portfolio',
        data: saved
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  async deleteProject(req, res) {
    try {
      const { id } = req.params;
      await profileDb.deleteProject(id, req.user);
      return res.status(200).json({ success: true, message: 'Project deleted' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Achievements Admin
  async saveAchievement(req, res) {
    try {
      const item = req.body;
      if (!item.title || !item.organization) {
        return res.status(400).json({ success: false, message: 'Title and Organization are required' });
      }
      const saved = await profileDb.saveAchievement(item, req.user);
      return res.status(200).json({
        success: true,
        message: item.id ? 'Achievement updated' : 'Achievement added',
        data: saved
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  async deleteAchievement(req, res) {
    try {
      const { id } = req.params;
      await profileDb.deleteAchievement(id, req.user);
      return res.status(200).json({ success: true, message: 'Achievement deleted' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Testimonials Admin
  async saveTestimonial(req, res) {
    try {
      const item = req.body;
      if (!item.client_name || !item.testimonial_text) {
        return res.status(400).json({ success: false, message: 'Client name and Testimonial text are required' });
      }
      const saved = await profileDb.saveTestimonial(item, req.user);
      return res.status(200).json({
        success: true,
        message: item.id ? 'Testimonial updated' : 'Testimonial added',
        data: saved
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  async deleteTestimonial(req, res) {
    try {
      const { id } = req.params;
      await profileDb.deleteTestimonial(id, req.user);
      return res.status(200).json({ success: true, message: 'Testimonial deleted' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Gallery Admin
  async saveGalleryItem(req, res) {
    try {
      const item = req.body;
      if (!item.title || !item.media_url) {
        return res.status(400).json({ success: false, message: 'Title and Media URL are required' });
      }
      const saved = await profileDb.saveGalleryItem(item, req.user);
      return res.status(200).json({
        success: true,
        message: item.id ? 'Gallery item updated' : 'Media added to gallery',
        data: saved
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  async deleteGalleryItem(req, res) {
    try {
      const { id } = req.params;
      await profileDb.deleteGalleryItem(id, req.user);
      return res.status(200).json({ success: true, message: 'Gallery item removed' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Messages Admin
  async getContactMessages(req, res) {
    try {
      const { status, search } = req.query;
      const data = await profileDb.getContactMessages({ status, search });
      return res.status(200).json({ success: true, data });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  async updateContactMessage(req, res) {
    try {
      const { id } = req.params;
      const { status, internal_notes } = req.body;
      const updated = await profileDb.updateContactMessageStatus(id, { status, internal_notes }, req.user);
      if (!updated) return res.status(404).json({ success: false, message: 'Message not found' });
      return res.status(200).json({ success: true, message: 'Message status updated', data: updated });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  async deleteContactMessage(req, res) {
    try {
      const { id } = req.params;
      await profileDb.deleteContactMessage(id, req.user);
      return res.status(200).json({ success: true, message: 'Message deleted' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Social Links Admin
  async updateSocialLinks(req, res) {
    try {
      const { links } = req.body;
      if (!Array.isArray(links)) {
        return res.status(400).json({ success: false, message: 'Links must be an array' });
      }
      const data = await profileDb.updateSocialLinks(links, req.user);
      return res.status(200).json({ success: true, message: 'Social channels saved', data });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Settings Admin
  async getAdminSettings(req, res) {
    try {
      const data = await profileDb.getSettings();
      return res.status(200).json({ success: true, data });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  async updateSettings(req, res) {
    try {
      const updates = req.body;
      const data = await profileDb.updateSettings(updates, req.user);
      return res.status(200).json({ success: true, message: 'Global site settings updated', data });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Audit Logs Admin
  async getAuditLogs(req, res) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
      const data = await profileDb.getAuditLogs(limit);
      return res.status(200).json({ success: true, data });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // File / Media Upload Handler
  async uploadMedia(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }
      // Return public URL path
      const publicPath = `/uploads/profile-media/${req.file.filename}`;
      return res.status(201).json({
        success: true,
        message: 'File uploaded successfully',
        data: {
          url: publicPath,
          filename: req.file.filename,
          size: req.file.size,
          mimetype: req.file.mimetype
        }
      });
    } catch (err) {
      console.error('[ProfileController.uploadMedia]', err);
      return res.status(500).json({ success: false, message: 'File upload failed' });
    }
  }
}

const controller = new ProfileSiteController();
module.exports = controller;
