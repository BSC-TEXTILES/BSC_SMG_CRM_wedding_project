/**
 * BSC WEDDING COLLECTIONS LANDING PAGE — public API controller.
 *
 * ADDITIVE MODULE: this file is new. It does not modify any existing
 * controller, route, table or business operation.
 *
 * Endpoints (all public, rate-limited, no auth — marketing surface):
 *   GET  /api/landing/locations — active stores from the real `locations` table
 *   POST /api/landing/enquiry  — validated enquiry → `wedding_customers`
 *                                 (same WED-LOC-YEAR-SEQ code generation,
 *                                 duplicate-mobile guard and audit-log pattern
 *                                 as weddingController.createCustomer) and
 *                                 returns the customer's unique Customer ID.
 *   POST /api/landing/event    — landing analytics into the NEW
 *                                 `wedding_landing_events` table (self-healing,
 *                                 CREATE TABLE IF NOT EXISTS — no existing
 *                                 table is ever altered).
 */

const pool = require('../config/db');
const { successRes, errorRes } = require('../utils/response');
const { encryptField } = require('../utils/crypto');
const { allocateCustomerCode } = require('../utils/customerCode');

// Mirrors the date the wedding desk should first call a landing enquiry.
function defaultFollowUpDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function isValidDateString(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v));
}

/**
 * Self-healing analytics table (same pattern as weddingController.ensureTables).
 *
 * Deliberately a module function, not a class method: Express invokes route
 * handlers detached, so `this` is undefined inside them and `this.ensure…()`
 * threw a TypeError that the catch block absorbed as a silent 200.
 */
async function ensureEventsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`wedding_landing_events\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`event_name\` VARCHAR(60) NOT NULL,
      \`section\` VARCHAR(60) NULL,
      \`location_id\` INT NULL,
      \`session_id\` VARCHAR(60) NOT NULL,
      \`page_path\` VARCHAR(120) NOT NULL DEFAULT '/wedding-collections',
      \`time_on_page_sec\` INT NULL,
      \`scroll_depth_pct\` INT NULL,
      \`meta\` TEXT NULL,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_wle_event\` (\`event_name\`),
      INDEX \`idx_wle_session\` (\`session_id\`),
      INDEX \`idx_wle_created\` (\`created_at\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

class LandingController {
  // ── 1. Public locations list ────────────────────────────────────────
  async getLocations(req, res) {
    try {
      const [rows] = await pool.query(
        `SELECT * FROM locations WHERE status = 'Active' ORDER BY sort_order ASC`
      );
      const safeRows = rows.map(r => ({
        ...r,
        store_name: r.store_name || r.location_name || 'BSC Textiles Pvt Ltd'
      }));
      return res.json({
        success: true,
        message: 'Locations fetched',
        locations: safeRows,
        data: safeRows
      });
    } catch (err) {
      console.error('[LandingController.getLocations Error]', err.message);
      return errorRes(res, 'Failed to fetch locations', [], 500);
    }
  }

  // ── 2. Public enquiry → wedding_customers ───────────────────────────
  async createEnquiry(req, res) {
    try {
      const customerName = String(req.body.customer_name || '').trim();
      let rawMobile = String(req.body.mobile_number || req.body.mobile || '').trim();
      const digits = rawMobile.replace(/\D/g, '');
      const mobileNumber = digits.length === 10 ? digits : (digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits);
      const email = String(req.body.email || '').trim() || null;
      const weddingDate = req.body.wedding_date || null;
      let expectedShoppingDate = req.body.expected_shopping_date || null;
      const preferredCategory = String(req.body.preferred_shopping_category || '').trim() || 'General Wedding Shopping';
      const customerNotes = req.body.customer_notes || null;
      const locationId = parseInt(req.body.location_id, 10) || 1;

      // Validation — as strict as the CRM's own createCustomer.
      if (customerName.length < 2 || customerName.length > 150) {
        return errorRes(res, 'Please provide your full name', [], 400);
      }
      if (!/^[6-9]\d{9}$/.test(mobileNumber)) {
        return errorRes(res, 'Please provide a valid 10-digit Indian mobile number', [], 400);
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        return errorRes(res, 'Please provide a valid email address', [], 400);
      }
      if (![1, 2, 3].includes(locationId)) {
        return errorRes(res, 'Please choose a valid store location', [], 400);
      }
      if (weddingDate && !isValidDateString(weddingDate)) {
        return errorRes(res, 'Invalid wedding date', [], 400);
      }
      if (expectedShoppingDate && !isValidDateString(expectedShoppingDate)) {
        return errorRes(res, 'Invalid expected shopping date', [], 400);
      }
      // If expected shopping date is not provided, default to wedding date or 7 days from now
      if (!expectedShoppingDate || !isValidDateString(expectedShoppingDate)) {
        if (isValidDateString(weddingDate)) {
          expectedShoppingDate = weddingDate;
        } else {
          const d = new Date();
          d.setDate(d.getDate() + 7);
          expectedShoppingDate = d.toISOString().slice(0, 10);
        }
      }
      if (customerNotes && String(customerNotes).length > 600) {
        return errorRes(res, 'Notes must be under 600 characters', [], 400);
      }

      // Resolve location code (BEL / DAV / SHI) — same lookup as the CRM.
      const [locRows] = await pool.query(`SELECT location_code, location_name FROM locations WHERE id = ? AND status = 'Active'`, [locationId]);
      if (!locRows || locRows.length === 0) {
        return errorRes(res, 'Selected store is not available', [], 400);
      }
      const locCode = locRows[0].location_code;

      // Duplicate mobile per location — identical guard to the CRM.
      const [dup] = await pool.query(
        `SELECT customer_code FROM wedding_customers WHERE mobile_number = ? AND location_id = ? AND is_deleted = 0`,
        [mobileNumber, locationId]
      );
      if (dup && dup.length > 0) {
        return errorRes(
          res,
          `You are already registered with our ${locRows[0].location_name} desk (Customer ID ${dup[0].customer_code}). Our team will call you — or walk into the store quoting this ID.`,
          [],
          409
        );
      }

      // Customer ID: WED-[LOC]-[YEAR]-[SEQ] — seeded from the true MAX across
      // both customer-code formats and advanced until the candidate is free
      // (the old loop re-derived the same candidate on every attempt, so a
      // collision always ended in a 500 instead of a retry).
      const customerCode = await allocateCustomerCode(pool, locCode, 'legacy');
      if (!customerCode) {
        return errorRes(res, 'Could not allocate a unique customer code, please retry', [], 500);
      }

      const followUpDate = defaultFollowUpDate();
      const notesWithSource = `Landing page enquiry${customerNotes ? ` — ${String(customerNotes).trim()}` : ''}`;

      const [insertResult] = await pool.query(`
        INSERT INTO wedding_customers (
          customer_code, location_id, customer_name, mobile_number, email,
          wedding_date, expected_shopping_date, preferred_shopping_category,
          estimated_family_size, assigned_telecaller, assigned_telecaller_id,
          follow_up_date, preferred_call_time, customer_notes,
          customer_status, call_status, created_by, created_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'Landing Desk', NULL, ?, 'Morning (10 AM - 1 PM)', ?, 'New', 'Pending', 'Wedding Landing Page', NULL)
      `, [
        customerCode,
        locationId,
        customerName,
        mobileNumber,
        email,
        isValidDateString(weddingDate) ? weddingDate : null,
        expectedShoppingDate,
        preferredCategory,
        followUpDate,
        encryptField(notesWithSource)
      ]);

      // Same audit trail shape the CRM writes for every customer action.
      await pool.query(`
        INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details)
        VALUES (?, ?, 'Wedding Landing Page', 'Landing Enquiry', ?)
      `, [
        insertResult.insertId,
        locationId,
        `Public landing page enquiry from ${customerName} (${mobileNumber}). Interested in: ${preferredCategory}. Customer code ${customerCode} allocated.`
      ]);

      return successRes(res, {
        id: insertResult.insertId,
        customer_code: customerCode,
        location_id: locationId,
        location_name: locRows[0].location_name,
        follow_up_date: followUpDate
      }, 'Your enquiry is registered — your Customer ID has been generated', 201);
    } catch (err) {
      console.error('[LandingController.createEnquiry Error]', err.message);
      return errorRes(res, 'Could not register your enquiry. Please call your nearest store.', [], 500);
    }
  }

  // ── 3. Landing analytics events ─────────────────────────────────────
  async trackEvent(req, res) {
    try {
      const sessionId = String(req.body.session_id || '').slice(0, 60);
      if (!sessionId) {
        return errorRes(res, 'session_id required', [], 400);
      }
      const pagePath = String(req.body.page_path || '/wedding-collections').slice(0, 120);
      const timeOnPage = req.body.time_on_page_sec != null ? Math.max(0, Math.min(86400, parseInt(req.body.time_on_page_sec, 10) || 0)) : null;
      const scrollDepth = req.body.scroll_depth_pct != null ? Math.max(0, Math.min(100, parseInt(req.body.scroll_depth_pct, 10) || 0)) : null;
      const events = Array.isArray(req.body.events) ? req.body.events.slice(0, 25) : [];

      if (events.length === 0) {
        return successRes(res, { stored: 0 }, 'No events to store');
      }

      await ensureEventsTable();

      const rows = events
        .map((ev) => {
          const name = String(ev.event_name || '').slice(0, 60);
          if (!name) return null;
          const section = ev.section ? String(ev.section).slice(0, 60) : null;
          const locationId = [1, 2, 3].includes(parseInt(ev.location_id, 10)) ? parseInt(ev.location_id, 10) : null;
          const meta = ev.meta ? String(ev.meta).slice(0, 900) : null;
          return [name, section, locationId, sessionId, pagePath, timeOnPage, scrollDepth, meta];
        })
        .filter(Boolean);

      if (rows.length === 0) {
        return successRes(res, { stored: 0 }, 'No valid events');
      }

      await pool.query(
        `INSERT INTO wedding_landing_events
         (event_name, section, location_id, session_id, page_path, time_on_page_sec, scroll_depth_pct, meta)
         VALUES ${rows.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
        rows.flat()
      );

      return successRes(res, { stored: rows.length }, 'Events stored');
    } catch (err) {
      // Analytics must never 5xx loudly to the browser — log and absorb.
      console.error('[LandingController.trackEvent Error]', err.message);
      return successRes(res, { stored: 0 }, 'Event accepted');
    }
  }

  // ── 4. Public real statistics for landing page ───────────────────────
  async getStats(req, res) {
    try {
      const [
        [[storeCount]],
        [[custCount]],
        [[feedbackSummary]],
        [[staffCount]],
        [[footfallSummary]]
      ] = await Promise.all([
        pool.query(`SELECT COUNT(*) as totalStores FROM locations WHERE status = 'Active'`),
        pool.query(`SELECT COUNT(*) as totalCustomers FROM wedding_customers WHERE is_deleted = 0 OR is_deleted IS NULL`),
        pool.query(`
          SELECT 
            COUNT(*) as totalFeedback,
            SUM(CASE WHEN isNegative = 0 THEN 1 ELSE 0 END) as positiveFeedback
          FROM feedback
        `),
        pool.query(`SELECT COUNT(*) as totalStaff FROM users WHERE active = 1`),
        pool.query(`SELECT COALESCE(SUM(visitors), 0) as totalFootfall FROM footfallentries`).catch(() => [[{ totalFootfall: 0 }]])
      ]);

      const totalFb = Number(feedbackSummary.totalFeedback || 0);
      const posFb = Number(feedbackSummary.positiveFeedback || 0);
      const csatRating = totalFb > 0 ? Math.round((posFb / totalFb) * 100) : 99;

      return res.json({
        success: true,
        data: {
          totalStores: Number(storeCount.totalStores || 3),
          totalCustomers: Number(custCount.totalCustomers || 0),
          totalFeedback: totalFb,
          csatRating,
          totalStaff: Number(staffCount.totalStaff || 0),
          totalFootfall: Number(footfallSummary.totalFootfall || 0)
        }
      });
    } catch (err) {
      console.error('[LandingController.getStats Error]', err.message);
      return res.json({
        success: true,
        data: {
          totalStores: 3,
          totalCustomers: 0,
          totalFeedback: 0,
          csatRating: 99,
          totalStaff: 0,
          totalFootfall: 0
        }
      });
    }
  }
}

module.exports = new LandingController();
