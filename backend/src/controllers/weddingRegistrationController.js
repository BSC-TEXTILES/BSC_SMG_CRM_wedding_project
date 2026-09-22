const pool = require('../config/db');
const { successRes, errorRes } = require('../utils/response');
const { getLocationFilter, injectLocationId } = require('../middleware/auth');
const { encryptField, decryptRows, decryptRow } = require('../utils/crypto');
const { sendWeddingRegistrationConfirmation } = require('../config/email');
const realtimeService = require('../services/realtimeService');
const {
  isValidMobile,
  normalizeMobile,
  validateWeddingRegistration,
  parsePositiveInt
} = require('../validators/weddingValidator');

const ENCRYPTED_FIELDS = ['additional_notes', 'remarks'];

// ── Canonical Indian mobile digits ─────────────────────────────────
// Accepts +91 98765 43210 / 919876543210 / 09876543210 / 9876543210 and
// reduces every shape to the bare 10-digit number. Returns null when the
// input cannot be a valid Indian mobile number.
function canonicalMobileDigits(input) {
  const digits = String(input === undefined || input === null ? '' : input).replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  return null;
}

let tablesChecked = false;
async function ensureTables() {
  if (tablesChecked) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`wedding_registrations\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`registration_id\` VARCHAR(50) NOT NULL UNIQUE,
        \`customer_id\` VARCHAR(50) NULL,
        \`tracking_id\` VARCHAR(50) NULL,
        \`location_id\` INT NOT NULL DEFAULT 2,
        \`location_code\` VARCHAR(10) NOT NULL DEFAULT 'DAV',
        \`store_name\` VARCHAR(100) NOT NULL,
        \`store_address\` TEXT NULL,
        \`store_phone\` VARCHAR(20) NULL,
        \`customer_name\` VARCHAR(150) NOT NULL,
        \`mobile\` VARCHAR(20) NOT NULL,
        \`alternate_mobile\` VARCHAR(20) NULL,
        \`email\` VARCHAR(150) NULL,
        \`gender\` VARCHAR(20) NULL,
        \`age\` INT NULL,
        \`address\` TEXT NULL,
        \`area\` VARCHAR(150) NULL,
        \`city\` VARCHAR(100) NULL,
        \`pincode\` VARCHAR(10) NULL,
        \`wedding_date\` DATE NULL,
        \`wedding_date_flexibility\` VARCHAR(50) NULL,
        \`wedding_venue\` VARCHAR(255) NULL,
        \`wedding_city\` VARCHAR(100) NULL,
        \`wedding_type\` VARCHAR(50) NULL,
        \`wedding_functions\` JSON NULL,
        \`guest_count\` INT NULL,
        \`family_size\` INT NULL,
        \`bride_name\` VARCHAR(150) NULL,
        \`bride_age\` INT NULL,
        \`bride_contact\` VARCHAR(20) NULL,
        \`bride_shopping_required\` BOOLEAN DEFAULT TRUE,
        \`groom_name\` VARCHAR(150) NULL,
        \`groom_age\` INT NULL,
        \`groom_contact\` VARCHAR(20) NULL,
        \`groom_shopping_required\` BOOLEAN DEFAULT TRUE,
        \`shopping_requirements\` JSON NULL,
        \`budget_range\` VARCHAR(50) NULL,
        \`preferred_shopping_date\` DATE NULL,
        \`preferred_shopping_time\` VARCHAR(50) NULL,
        \`expected_visitors\` INT NULL,
        \`existing_customer\` VARCHAR(20) NULL,
        \`existing_customer_id\` VARCHAR(50) NULL,
        \`previous_store\` VARCHAR(50) NULL,
        \`preferred_contact_method\` VARCHAR(50) NULL,
        \`preferred_followup_time\` VARCHAR(50) NULL,
        \`additional_notes\` TEXT NULL,
        \`consent\` BOOLEAN DEFAULT FALSE,
        \`status\` VARCHAR(50) NOT NULL DEFAULT 'New',
        \`lead_source\` VARCHAR(50) DEFAULT 'Walk-in',
        \`assigned_employee\` VARCHAR(150) NULL,
        \`next_followup\` DATE NULL,
        \`call_result\` VARCHAR(100) NULL,
        \`remarks\` TEXT NULL,
        \`email_status\` VARCHAR(20) DEFAULT 'EMAIL_PENDING',
        \`email_sent_at\` DATETIME NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_wed_reg_loc\` (\`location_id\`),
        INDEX \`idx_wed_reg_mobile\` (\`mobile\`),
        INDEX \`idx_wed_reg_status\` (\`status\`),
        INDEX \`idx_wed_reg_wedding_date\` (\`wedding_date\`),
        INDEX \`idx_wed_reg_created\` (\`created_at\`),
        INDEX \`idx_wed_reg_customer_id\` (\`customer_id\`),
        UNIQUE INDEX \`idx_wed_reg_tracking_id\` (\`tracking_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Additive migration for databases created before these columns existed.
    // Each statement is wrapped so "duplicate column/index" errors are ignored.
    const additiveMigrations = [
      `ALTER TABLE locations ADD COLUMN store_name VARCHAR(100) NULL AFTER location_name`,
      `ALTER TABLE locations ADD COLUMN address TEXT NULL`,
      `ALTER TABLE locations ADD COLUMN phone VARCHAR(50) NULL`,
      `ALTER TABLE locations ADD COLUMN email VARCHAR(100) NULL`,
      `ALTER TABLE wedding_registrations ADD COLUMN customer_id VARCHAR(50) NULL AFTER registration_id`,
      `ALTER TABLE wedding_registrations ADD COLUMN tracking_id VARCHAR(50) NULL AFTER customer_id`,
      `ALTER TABLE wedding_registrations ADD COLUMN email_status VARCHAR(20) DEFAULT 'EMAIL_PENDING'`,
      `ALTER TABLE wedding_registrations ADD COLUMN email_sent_at DATETIME NULL`,
      `ALTER TABLE wedding_registrations ADD INDEX idx_wed_reg_customer_id (customer_id)`,
      `ALTER TABLE wedding_registrations ADD UNIQUE INDEX idx_wed_reg_tracking_id (tracking_id)`,
      `ALTER TABLE wedding_customers ADD COLUMN tracking_id VARCHAR(50) NULL`,
      `ALTER TABLE wedding_customers ADD INDEX idx_wc_tracking_id (tracking_id)`
    ];
    for (const sql of additiveMigrations) {
      try {
        await pool.query(sql);
      } catch (err) {
        // ER_DUP_FIELDNAME = column already exists, ER_DUP_KEYNAME = index exists
        if (err.code !== 'ER_DUP_FIELDNAME' && err.code !== 'ER_DUP_KEYNAME') {
          console.warn('[WeddingRegistrationController.ensureTables migration]', err.message);
        }
      }
    }

    tablesChecked = true;

    // One-time repair: records created by the Wedding CRM admin UI and the
    // landing page live only in wedding_customers and never received a
    // tracking ID. Backfill them so the public tracking page can find every
    // existing customer. Never deletes or duplicates rows.
    await backfillTrackingIds();
  } catch (err) {
    console.error('[WeddingRegistrationController.ensureTables Error]', err.message);
  }
}

// ── Tracking ID allocation used by the backfill (collision-checked
//    against BOTH tables) ────────────────────────────────────────────
async function generateUniqueTrackingId() {
  const today = new Date();
  const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = `BSC-WED-${ymd}-${String(Math.floor(1000 + Math.random() * 9000))}`;
    const [regHit] = await pool.query(`SELECT id FROM wedding_registrations WHERE tracking_id = ? LIMIT 1`, [candidate]);
    const [crmHit] = await pool.query(`SELECT id FROM wedding_customers WHERE tracking_id = ? LIMIT 1`, [candidate]);
    if ((!regHit || regHit.length === 0) && (!crmHit || crmHit.length === 0)) {
      return candidate;
    }
  }
  return null;
}

let backfillCompleted = false;
async function backfillTrackingIds() {
  if (backfillCompleted) return;
  backfillCompleted = true;
  try {
    const [crmRows] = await pool.query(`SELECT id FROM wedding_customers WHERE tracking_id IS NULL AND is_deleted = 0`);
    for (const row of crmRows) {
      const trackingId = await generateUniqueTrackingId();
      if (!trackingId) { console.warn('[Backfill] could not allocate a unique tracking ID, skipping remaining rows'); return; }
      await pool.query(`UPDATE wedding_customers SET tracking_id = ? WHERE id = ? AND tracking_id IS NULL`, [trackingId, row.id]);
      console.log(`[Backfill] wedding_customers id=${row.id} -> tracking_id=${trackingId}`);
    }
    const [regRows] = await pool.query(`SELECT id FROM wedding_registrations WHERE tracking_id IS NULL`);
    for (const row of regRows) {
      const trackingId = await generateUniqueTrackingId();
      if (!trackingId) { console.warn('[Backfill] could not allocate a unique tracking ID, skipping remaining rows'); return; }
      await pool.query(`UPDATE wedding_registrations SET tracking_id = ? WHERE id = ? AND tracking_id IS NULL`, [trackingId, row.id]);
      console.log(`[Backfill] wedding_registrations id=${row.id} -> tracking_id=${trackingId}`);
    }
  } catch (err) {
    console.warn('[Backfill] tracking ID backfill skipped:', err.message);
  }
}

class WeddingRegistrationController {
  constructor() {
    // Express detaches route handlers from this singleton, which would make
    // `this` undefined inside createRegistration (it calls
    // this.allocateUniqueIds / this.createWeddingCrmRecord /
    // this.updateEmailStatus). Bind every method so the class keeps working
    // no matter how it is wired into the router.
    const proto = Object.getPrototypeOf(this);
    for (const key of Object.getOwnPropertyNames(proto)) {
      if (typeof this[key] === 'function' && key !== 'constructor') {
        this[key] = this[key].bind(this);
      }
    }
  }

  async getDashboardStats(req, res) {
    try {
      await ensureTables();
      const { clause, params } = await getLocationFilter(req, 'wr');

      const [rows] = await pool.query(`
        SELECT
          COUNT(*) AS totalRegistrations,
          SUM(CASE WHEN DATE(wr.created_at) = CURDATE() THEN 1 ELSE 0 END) AS todayRegistrations,
          SUM(CASE WHEN wr.location_id = 1 THEN 1 ELSE 0 END) AS belagaviRegistrations,
          SUM(CASE WHEN wr.location_id = 2 THEN 1 ELSE 0 END) AS davanagereRegistrations,
          SUM(CASE WHEN wr.location_id = 3 THEN 1 ELSE 0 END) AS shivamoggaRegistrations,
          SUM(CASE WHEN wr.wedding_date >= CURDATE() AND wr.wedding_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS upcomingWeddings,
          SUM(CASE WHEN wr.status = 'New' AND (wr.next_followup IS NULL OR wr.next_followup <= CURDATE()) THEN 1 ELSE 0 END) AS pendingFollowups,
          SUM(CASE WHEN wr.status IN ('Contacted', 'Interested', 'Follow-up Pending') THEN 1 ELSE 0 END) AS visitedCustomers,
          SUM(CASE WHEN wr.status = 'Shopping Confirmed' THEN 1 ELSE 0 END) AS shoppingConfirmed,
          SUM(CASE WHEN wr.status = 'Converted' THEN 1 ELSE 0 END) AS convertedCustomers
        FROM wedding_registrations wr
        WHERE wr.status != 'Deleted' ${clause}
      `, params);

      const raw = rows[0] || {};
      const stats = {
        totalRegistrations: Number(raw.totalRegistrations) || 0,
        todayRegistrations: Number(raw.todayRegistrations) || 0,
        belagaviRegistrations: Number(raw.belagaviRegistrations) || 0,
        davanagereRegistrations: Number(raw.davanagereRegistrations) || 0,
        shivamoggaRegistrations: Number(raw.shivamoggaRegistrations) || 0,
        upcomingWeddings: Number(raw.upcomingWeddings) || 0,
        pendingFollowups: Number(raw.pendingFollowups) || 0,
        visitedCustomers: Number(raw.visitedCustomers) || 0,
        shoppingConfirmed: Number(raw.shoppingConfirmed) || 0,
        convertedCustomers: Number(raw.convertedCustomers) || 0
      };

      return successRes(res, { stats }, 'Dashboard stats fetched successfully');
    } catch (err) {
      console.error('[WeddingRegistrationController.getDashboardStats Error]', err);
      return errorRes(res, 'Failed to fetch wedding registration stats', [err.message], 500);
    }
  }

  async getRegistrations(req, res) {
    try {
      await ensureTables();
      const {
        status,
        locationId,
        search,
        fromDate,
        toDate,
        page = 1,
        limit = 50
      } = req.query;

      const { clause: locClause, params: queryParams } = await getLocationFilter(req, 'wr');
      let whereClauses = ['wr.status != \'Deleted\'', `1=1 ${locClause}`];

      if (status && status !== 'all') {
        whereClauses.push(`wr.status = ?`);
        queryParams.push(status);
      }

      if (locationId && locationId !== 'all') {
        whereClauses.push(`wr.location_id = ?`);
        queryParams.push(parseInt(locationId, 10));
      }

      if (search && search.trim()) {
        const q = `%${search.trim().toLowerCase()}%`;
        whereClauses.push(`(
          LOWER(wr.customer_name) LIKE ? OR
          wr.mobile LIKE ? OR
          LOWER(wr.registration_id) LIKE ? OR
          LOWER(COALESCE(wr.email, '')) LIKE ?
        )`);
        queryParams.push(q, q, q, q);
      }

      if (fromDate && toDate) {
        whereClauses.push(`DATE(wr.created_at) BETWEEN ? AND ?`);
        queryParams.push(fromDate, toDate);
      }

      const whereSql = whereClauses.join(' AND ');

      const [countResult] = await pool.query(
        `SELECT COUNT(*) as total FROM wedding_registrations wr WHERE ${whereSql}`,
        queryParams
      );
      const total = countResult[0]?.total || 0;

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 50));
      const offset = (pageNum - 1) * limitNum;

      const [registrations] = await pool.query(`
        SELECT 
          wr.*,
          l.location_code,
          l.location_name
        FROM wedding_registrations wr
        LEFT JOIN locations l ON l.id = wr.location_id
        WHERE ${whereSql}
        ORDER BY wr.created_at DESC
        LIMIT ? OFFSET ?
      `, [...queryParams, limitNum, offset]);

      decryptRows(registrations, ENCRYPTED_FIELDS);

      // Parse JSON fields
      registrations.forEach(reg => {
        if (reg.wedding_functions && typeof reg.wedding_functions === 'string') {
          try { reg.wedding_functions = JSON.parse(reg.wedding_functions); } catch {}
        }
        if (reg.shopping_requirements && typeof reg.shopping_requirements === 'string') {
          try { reg.shopping_requirements = JSON.parse(reg.shopping_requirements); } catch {}
        }
      });

      return successRes(res, {
        registrations: registrations || [],
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum)
        }
      }, 'Registrations fetched successfully');
    } catch (err) {
      console.error('[WeddingRegistrationController.getRegistrations Error]', err);
      return errorRes(res, 'Failed to fetch wedding registrations', [err.message], 500);
    }
  }

  async checkDuplicate(req, res) {
    try {
      const mobile = req.body.mobile || req.body.phone || req.body.mobile_number;
      const registrationId = req.body.registrationId || req.body.registration_id;

      if (!mobile || !mobile.trim()) {
        return errorRes(res, 'Mobile number is required', [], 400);
      }

      const cleanMobile = mobile.trim().replace(/\D/g, '');
      const normalizedMobile = cleanMobile.length === 10 ? `+91${cleanMobile}` : cleanMobile;
      const { clause: locClause, params } = await getLocationFilter(req, 'wr');

      let sql = `
        SELECT wr.id, wr.registration_id, wr.customer_name, wr.mobile, wr.status, wr.location_id,
               wr.wedding_date, wr.wedding_venue, wr.bride_name, wr.groom_name, wr.created_at, l.location_name
        FROM wedding_registrations wr
        LEFT JOIN locations l ON l.id = wr.location_id
        WHERE (wr.mobile = ? OR wr.mobile = ?) AND wr.status != 'Deleted' ${locClause}
      `;
      const queryParams = [normalizedMobile, cleanMobile, ...params];

      if (registrationId) {
        sql += ` AND wr.id != ?`;
        queryParams.push(parseInt(registrationId, 10));
      }

      sql += ` ORDER BY wr.created_at DESC`;

      const [rows] = await pool.query(sql, queryParams);

      if (rows && rows.length > 0) {
        return successRes(res, {
          exists: true,
          count: rows.length,
          registration: rows[0],
          existingRegistration: rows[0],
          allRecords: rows
        }, 'Existing wedding registration found with this mobile number.');
      }

      return successRes(res, { exists: false, allRecords: [] }, 'Mobile number is available.');
    } catch (err) {
      console.error('[WeddingRegistrationController.checkDuplicate Error]', err);
      return errorRes(res, 'Failed to check duplicate', [err.message], 500);
    }
  }

  async getNextRegistrationId(req, res) {
    try {
      const locationId = req.query.location_id || req.query.locationId || 2;
      const [locRows] = await pool.query(`SELECT location_code FROM locations WHERE id = ?`, [locationId]);
      const locCode = locRows[0]?.location_code || 'BSC';
      const year = new Date().getFullYear();
      const codePrefix = `BSC-WED-${locCode}-${year}-`;

      let registrationId = null;
      for (let attempt = 0; attempt < 5 && !registrationId; attempt++) {
        const [lastRows] = await pool.query(
          `SELECT registration_id FROM wedding_registrations WHERE registration_id LIKE ? ORDER BY id DESC LIMIT 1`,
          [`${codePrefix}%`]
        );
        const lastSeq = lastRows && lastRows[0]
          ? parseInt(String(lastRows[0].registration_id).slice(-6), 10) || 0
          : 0;
        const candidate = `${codePrefix}${String(lastSeq + 1).padStart(6, '0')}`;
        const [exists] = await pool.query(
          `SELECT id FROM wedding_registrations WHERE registration_id = ?`,
          [candidate]
        );
        if (!exists || exists.length === 0) {
          registrationId = candidate;
        }
      }

      if (!registrationId) {
        return errorRes(res, 'Could not allocate a unique registration ID, please retry', [], 500);
      }

      return successRes(res, { registrationId }, 'Registration ID generated');
    } catch (err) {
      console.error('[WeddingRegistrationController.getNextRegistrationId Error]', err);
      return errorRes(res, 'Failed to generate registration ID', [err.message], 500);
    }
  }

  // ── Server-side unique ID allocation ──────────────────────────────
  // Both IDs are generated on the backend (the DB is the source of truth)
  // and protected by UNIQUE constraints + retry-on-collision.
  async allocateUniqueIds(locationCode, executor = pool) {
    const year = new Date().getFullYear();
    const codePrefix = `BSC-WED-${locationCode}-${year}-`;

    // Customer / registration business ID: BSC-WED-{LOC}-{YEAR}-{000001..}
    let registrationId = null;
    for (let attempt = 0; attempt < 6 && !registrationId; attempt++) {
      const [lastRows] = await executor.query(
        `SELECT registration_id FROM wedding_registrations WHERE registration_id LIKE ? ORDER BY id DESC LIMIT 1`,
        [`${codePrefix}%`]
      );
      const lastSeq = lastRows && lastRows[0]
        ? parseInt(String(lastRows[0].registration_id).slice(-6), 10) || 0
        : 0;
      const candidate = `${codePrefix}${String(lastSeq + 1).padStart(6, '0')}`;
      const [exists] = await executor.query(
        `SELECT id FROM wedding_registrations WHERE registration_id = ? OR customer_id = ?`,
        [candidate, candidate]
      );
      if (!exists || exists.length === 0) {
        registrationId = candidate;
      }
    }

    // Public tracking ID: BSC-WED-{YYYYMMDD}-{XXXX}
    let trackingId = null;
    const today = new Date();
    const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    for (let attempt = 0; attempt < 6 && !trackingId; attempt++) {
      const suffix = String(Math.floor(1000 + Math.random() * 9000));
      const candidate = `BSC-WED-${ymd}-${suffix}`;
      const [exists] = await executor.query(
        `SELECT id FROM wedding_registrations WHERE tracking_id = ?`,
        [candidate]
      );
      if (!exists || exists.length === 0) {
        trackingId = candidate;
      }
    }

    return { registrationId, trackingId };
  }

  // ── Record email delivery state without failing the registration ──
  async updateEmailStatus(id, status, errorMessage = null) {
    try {
      await pool.query(
        `UPDATE wedding_registrations SET email_status = ?, email_sent_at = IF(? = 'EMAIL_SENT', NOW(), email_sent_at), call_result = ? WHERE id = ?`,
        [status, status, errorMessage ? `Email: ${String(errorMessage).slice(0, 90)}` : null, id]
      );
    } catch (err) {
      console.warn('[WeddingRegistrationController.updateEmailStatus]', err.message);
    }
  }

  async createRegistration(req, res) {
    let connection = null;
    try {
      await ensureTables();
      const data = req.body.data || req.body;

      // ── 1. Server-side validation (never trust the frontend) ──────
      const validation = validateWeddingRegistration(data);
      if (!validation.ok) {
        return errorRes(res, 'Please correct the highlighted fields.', validation.errors, 400);
      }

      // ── 2. Normalize phone numbers consistently ────────────────────
      const mobile = normalizeMobile(data.mobile);
      const alternateMobile = data.alternate_mobile ? normalizeMobile(data.alternate_mobile) : null;
      if (!mobile || !isValidMobile(mobile)) {
        return errorRes(res, 'Please enter a valid 10-digit Indian mobile number.', [], 400);
      }
      if (alternateMobile && !isValidMobile(alternateMobile)) {
        return errorRes(res, 'Please enter a valid alternate mobile number.', [], 400);
      }

      // ── 3. Location enforcement ────────────────────────────────────
      let locationId = req.user ? req.user.locationId : null;
      if (!locationId) {
        locationId = data.location_id ? parseInt(data.location_id, 10) : 2;
      }
      if (!locationId || isNaN(locationId)) locationId = 2;

      const [locRows] = await pool.query(
        `SELECT * FROM locations WHERE id = ?`,
        [locationId]
      );
      if (!locRows || locRows.length === 0) {
        return errorRes(res, 'Invalid location selected', [], 400);
      }
      const rawLoc = locRows[0];
      const location = {
        ...rawLoc,
        location_code: rawLoc.location_code || (locationId === 1 ? 'BEL' : locationId === 3 ? 'SHI' : 'DAV'),
        location_name: rawLoc.location_name || 'BSC Textiles',
        store_name: rawLoc.store_name || rawLoc.location_name || 'BSC Textiles Pvt Ltd',
        address: rawLoc.address || null,
        phone: rawLoc.phone || null,
        email: rawLoc.email || null
      };

      // ── 4. Duplicate check / multiple registrations handling ──────
      const [dup] = await pool.query(`
        SELECT id, registration_id, customer_name, wedding_date, status FROM wedding_registrations 
        WHERE (mobile = ? OR mobile = ?) AND location_id = ? AND status != 'Deleted'
        ORDER BY created_at DESC
      `, [mobile, mobile.replace(/\D/g, ''), locationId]);

      // Allow creating a new registration for the same mobile when explicitly confirmed
      const forceNew = data.force_create_new_registration === true 
        || data.allow_duplicate === true 
        || data.link_to_existing === true
        || Boolean(data.existing_customer_id);

      if (dup && dup.length > 0 && !forceNew) {
        return errorRes(res, `A wedding registration with this mobile number already exists (${dup[0].customer_name} — ${dup[0].registration_id}). You can register a new wedding under this customer or view the existing record.`, [{ existingRegistration: dup[0], allRegistrations: dup }], 409);
      }

      // ── 5. Allocate unique IDs server-side (DB is the source of truth) ──
      const { registrationId, trackingId } = await this.allocateUniqueIds(location.location_code);
      if (!registrationId || !trackingId) {
        return errorRes(res, 'Could not allocate unique IDs, please retry', [], 500);
      }

      // Parse JSON fields
      const weddingFunctions = data.wedding_functions ? JSON.stringify(data.wedding_functions) : null;
      const shoppingRequirements = data.shopping_requirements ? JSON.stringify(data.shopping_requirements) : null;

      // ── 6. Transaction: registration + CRM record + audit are atomic ──
      connection = await pool.getConnection();
      await connection.beginTransaction();

      // If linking to existing customer, use that customer's code/ID as customer_id
      const linkedCustomerId = data.existing_customer_id || data.customer_id || registrationId;

      const [insertResult] = await connection.query(`
        INSERT INTO wedding_registrations (
          registration_id,
          customer_id,
          tracking_id,
          location_id,
          location_code,
          store_name,
          store_address,
          store_phone,
          customer_name,
          mobile,
          alternate_mobile,
          email,
          gender,
          age,
          address,
          area,
          city,
          pincode,
          wedding_date,
          wedding_date_flexibility,
          wedding_venue,
          wedding_city,
          wedding_type,
          wedding_functions,
          guest_count,
          family_size,
          bride_name,
          bride_age,
          bride_contact,
          bride_shopping_required,
          groom_name,
          groom_age,
          groom_contact,
          groom_shopping_required,
          shopping_requirements,
          budget_range,
          preferred_shopping_date,
          preferred_shopping_time,
          expected_visitors,
          existing_customer,
          existing_customer_id,
          previous_store,
          preferred_contact_method,
          preferred_followup_time,
          additional_notes,
          consent,
          status,
          lead_source,
          email_status,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', 'Walk-in', 'EMAIL_PENDING', NOW())
      `, [
        registrationId,
        linkedCustomerId,
        trackingId,
        locationId,
        location.location_code,
        location.store_name || 'BSC Textiles Pvt Ltd',
        location.address || null,
        location.phone || null,
        data.customer_name?.trim(),
        mobile,
        alternateMobile,
        data.email?.trim() || null,
        data.gender || null,
        parsePositiveInt(data.age, { max: 120 }),
        data.address?.trim() || null,
        data.area?.trim() || null,
        data.city?.trim() || null,
        data.pincode?.trim() || null,
        data.wedding_date || null,
        data.wedding_date_flexibility || null,
        data.wedding_venue?.trim() || null,
        data.wedding_city?.trim() || null,
        data.wedding_type || null,
        weddingFunctions,
        parsePositiveInt(data.guest_count),
        parsePositiveInt(data.family_size, { max: 1000 }),
        data.bride_name?.trim() || null,
        parsePositiveInt(data.bride_age, { max: 120 }),
        data.bride_contact?.trim() || null,
        data.bride_shopping_required !== false,
        data.groom_name?.trim() || null,
        parsePositiveInt(data.groom_age, { max: 120 }),
        data.groom_contact?.trim() || null,
        data.groom_shopping_required !== false,
        shoppingRequirements,
        data.budget_range || null,
        data.preferred_shopping_date || null,
        data.preferred_shopping_time || null,
        parsePositiveInt(data.expected_visitors, { max: 1000 }),
        data.existing_customer || null,
        data.existing_customer_id?.trim() || null,
        data.previous_store?.trim() || null,
        data.preferred_contact_method || null,
        data.preferred_followup_time || null,
        data.additional_notes ? encryptField(data.additional_notes?.trim()) : null,
        data.consent === true || data.consent === 'true' || data.consent === 1
      ]);

      const newId = insertResult.insertId;

      // Auto-create Wedding CRM record (same transaction)
      await this.createWeddingCrmRecord({
        connection,
        registrationId,
        trackingId,
        locationId,
        locationCode: location.location_code,
        customerName: data.customer_name?.trim(),
        mobile,
        email: data.email?.trim() || null,
        weddingDate: data.wedding_date || null,
        expectedShoppingDate: data.preferred_shopping_date || data.wedding_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        preferredCategory: data.shopping_requirements ? Object.keys(data.shopping_requirements).join(', ') : 'General Wedding Shopping',
        estimatedFamilySize: parsePositiveInt(data.family_size, { max: 1000 }) || 1,
        followUpDate: data.preferred_shopping_date || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        preferredCallTime: data.preferred_followup_time || 'Morning (10 AM - 1 PM)',
        customerNotes: data.additional_notes?.trim() || `Wedding registration: ${registrationId}`,
        createdBy: req.user?.fullName || 'Customer Portal'
      });

      // Audit log (same transaction)
      await connection.query(`
        INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details)
        VALUES (?, ?, ?, 'Registration Created', ?)
      `, [
        newId,
        locationId,
        req.user?.fullName || 'Customer Portal',
        `Created wedding registration ${registrationId} (tracking ${trackingId}) for ${data.customer_name?.trim()}`
      ]);

      await connection.commit();
      connection.release();
      connection = null;

      // ── 7. Email (after commit — email failure must NOT roll back) ──
      sendWeddingRegistrationConfirmation({
        customer_name: data.customer_name?.trim(),
        mobile,
        email: data.email?.trim(),
        registration_id: registrationId,
        tracking_id: trackingId,
        store_name: location.location_name,
        location_code: location.location_code,
        wedding_date: data.wedding_date,
        preferred_shopping_date: data.preferred_shopping_date
      }).then(emailResult => {
        const status = emailResult && emailResult.success ? 'EMAIL_SENT' : 'EMAIL_FAILED';
        this.updateEmailStatus(newId, status, emailResult && !emailResult.success ? emailResult.error : null);
      }).catch(err => {
        this.updateEmailStatus(newId, 'EMAIL_FAILED', err.message);
      });

      realtimeService.emitWeddingRegistrationChange('CREATE', { id: newId, registration_id: registrationId, customer_name: data.customer_name?.trim() }, locationId);

      return successRes(res, {
        id: newId,
        customer_id: registrationId,
        registration_id: registrationId,
        tracking_id: trackingId,
        registration: {
          id: newId,
          registration_id: registrationId,
          tracking_id: trackingId,
          customer_name: data.customer_name?.trim(),
          mobile,
          location_id: locationId,
          location_name: location.location_name,
          store_name: location.store_name,
          location_code: location.location_code,
          wedding_date: data.wedding_date,
          preferred_shopping_date: data.preferred_shopping_date,
          preferred_contact_method: data.preferred_contact_method,
          preferred_followup_time: data.preferred_followup_time,
          status: 'New',
          submitted_at: new Date().toISOString()
        }
      }, 'Wedding registration created successfully.', 201);
    } catch (err) {
      if (connection) {
        try { await connection.rollback(); } catch (rollbackErr) { console.warn('[createRegistration rollback]', rollbackErr.message); }
        try { connection.release(); } catch (releaseErr) {}
      }
      // Duplicate key / unique constraint → friendly 409 instead of 500
      if (err.code === 'ER_DUP_ENTRY') {
        console.warn('[WeddingRegistrationController.createRegistration Duplicate]', err.message);
        return errorRes(res, 'A wedding registration with these details already exists. Please contact the selected BSC store.', [], 409);
      }
      console.error('[WeddingRegistrationController.createRegistration Error]', err);
      return errorRes(res, 'Unable to save your request right now. Please try again.', [err.message], 500);
    }
  }

  async createWeddingCrmRecord(data) {
    const executor = data.connection || pool;
    try {
      await executor.query(`
        INSERT INTO wedding_customers (
          customer_code,
          tracking_id,
          location_id,
          customer_name,
          mobile_number,
          email,
          wedding_date,
          expected_shopping_date,
          preferred_shopping_category,
          estimated_family_size,
          assigned_telecaller,
          assigned_telecaller_id,
          follow_up_date,
          preferred_call_time,
          customer_notes,
          customer_status,
          call_status,
          created_by,
          created_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', 'Pending', ?, ?)
      `, [
        data.registrationId,
        data.trackingId || null,
        data.locationId,
        data.customerName,
        data.mobile,
        data.email,
        data.weddingDate,
        data.expectedShoppingDate,
        data.preferredCategory,
        data.estimatedFamilySize,
        data.assignedTelecaller || 'Auto-Assigned',
        null,
        data.followUpDate,
        data.preferredCallTime,
        data.customerNotes,
        data.createdBy,
        null
      ]);
    } catch (err) {
      console.error('[WeddingRegistrationController.createWeddingCrmRecord Error]', err.message);
      // Re-throw so a failed CRM insert rolls back the whole registration transaction.
      throw err;
    }
  }

  async getRegistrationById(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const { clause: locClause, params } = await getLocationFilter(req, 'wr');

      const [rows] = await pool.query(`
        SELECT 
          wr.*,
          l.location_code,
          l.location_name
        FROM wedding_registrations wr
        LEFT JOIN locations l ON l.id = wr.location_id
        WHERE wr.id = ? AND wr.status != 'Deleted' ${locClause}
      `, [id, ...params]);

      if (!rows || rows.length === 0) {
        return errorRes(res, 'Registration not found or access denied', [], 404);
      }

      const registration = rows[0];
      decryptRow(registration, ENCRYPTED_FIELDS);

      // Parse JSON fields
      if (registration.wedding_functions && typeof registration.wedding_functions === 'string') {
        try { registration.wedding_functions = JSON.parse(registration.wedding_functions); } catch {}
      }
      if (registration.shopping_requirements && typeof registration.shopping_requirements === 'string') {
        try { registration.shopping_requirements = JSON.parse(registration.shopping_requirements); } catch {}
      }

      return successRes(res, { registration }, 'Registration details fetched successfully');
    } catch (err) {
      console.error('[WeddingRegistrationController.getRegistrationById Error]', err);
      return errorRes(res, 'Failed to fetch registration details', [err.message], 500);
    }
  }

  async updateRegistration(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const { clause: locClause, params: locParams } = await getLocationFilter(req, 'wr');

      const [existing] = await pool.query(`
        SELECT * FROM wedding_registrations wr WHERE wr.id = ? AND wr.status != 'Deleted' ${locClause}
      `, [id, ...locParams]);

      if (!existing || existing.length === 0) {
        return errorRes(res, 'Registration not found or unauthorized', [], 404);
      }

      const prev = existing[0];
      const data = req.body;

      // Normalize phone if changed
      let mobile = prev.mobile;
      if (data.mobile && data.mobile.trim() !== prev.mobile) {
        mobile = data.mobile;
        const digits = mobile.replace(/\D/g, '');
        if (digits.length === 10) mobile = `+91${digits}`;
        else if (digits.length === 12 && digits.startsWith('91')) mobile = `+${digits}`;
        else if (digits.length === 11 && digits.startsWith('0')) mobile = `+91${digits.slice(1)}`;

        // Duplicate check
        const [dup] = await pool.query(`
          SELECT id FROM wedding_registrations 
          WHERE mobile = ? AND location_id = ? AND id != ? AND status != 'Deleted'
        `, [mobile, prev.location_id, id]);
        if (dup && dup.length > 0) {
          return errorRes(res, `Another registration already exists with mobile ${mobile}`, [], 409);
        }
      }

      // Build update query
      const updateFields = [];
      const updateParams = [];

      const fields = {
        customer_name: data.customer_name,
        mobile,
        alternate_mobile: data.alternate_mobile,
        email: data.email,
        gender: data.gender,
        age: data.age ? parseInt(data.age, 10) : null,
        address: data.address,
        area: data.area,
        city: data.city,
        pincode: data.pincode,
        wedding_date: data.wedding_date,
        wedding_date_flexibility: data.wedding_date_flexibility,
        wedding_venue: data.wedding_venue,
        wedding_city: data.wedding_city,
        wedding_type: data.wedding_type,
        wedding_functions: data.wedding_functions ? JSON.stringify(data.wedding_functions) : null,
        guest_count: data.guest_count ? parseInt(data.guest_count, 10) : null,
        family_size: data.family_size ? parseInt(data.family_size, 10) : null,
        bride_name: data.bride_name,
        bride_age: data.bride_age ? parseInt(data.bride_age, 10) : null,
        bride_contact: data.bride_contact,
        bride_shopping_required: data.bride_shopping_required,
        groom_name: data.groom_name,
        groom_age: data.groom_age ? parseInt(data.groom_age, 10) : null,
        groom_contact: data.groom_contact,
        groom_shopping_required: data.groom_shopping_required,
        shopping_requirements: data.shopping_requirements ? JSON.stringify(data.shopping_requirements) : null,
        budget_range: data.budget_range,
        preferred_shopping_date: data.preferred_shopping_date,
        preferred_shopping_time: data.preferred_shopping_time,
        expected_visitors: data.expected_visitors ? parseInt(data.expected_visitors, 10) : null,
        existing_customer: data.existing_customer,
        existing_customer_id: data.existing_customer_id,
        previous_store: data.previous_store,
        preferred_contact_method: data.preferred_contact_method,
        preferred_followup_time: data.preferred_followup_time,
        additional_notes: data.additional_notes !== undefined ? encryptField(data.additional_notes?.trim()) : null,
        consent: data.consent,
        status: data.status,
        assigned_employee: data.assigned_employee,
        next_followup: data.next_followup,
        call_result: data.call_result,
        remarks: data.remarks !== undefined ? encryptField(data.remarks?.trim()) : null
      };

      Object.entries(fields).forEach(([key, value]) => {
        if (value !== undefined) {
          updateFields.push(`${key} = ?`);
          updateParams.push(value);
        }
      });

      if (updateFields.length > 0) {
        updateParams.push(id);
        await pool.query(`
          UPDATE wedding_registrations SET ${updateFields.join(', ')} WHERE id = ?
        `, updateParams);
      }

      // Audit log
      await pool.query(`
        INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details)
        VALUES (?, ?, ?, 'Registration Updated', ?)
      `, [
        id,
        prev.location_id,
        req.user?.fullName || 'Staff',
        'Updated wedding registration details'
      ]);

      realtimeService.emitWeddingRegistrationChange('UPDATE', { id, registration_id: prev.registration_id }, prev.location_id);

      return successRes(res, { id }, 'Wedding registration updated successfully.');
    } catch (err) {
      console.error('[WeddingRegistrationController.updateRegistration Error]', err);
      return errorRes(res, 'Failed to update registration', [err.message], 500);
    }
  }

  async deleteRegistration(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const { clause: locClause, params } = await getLocationFilter(req, 'wr');

      const [existing] = await pool.query(`
        SELECT * FROM wedding_registrations wr WHERE wr.id = ? AND wr.status != 'Deleted' ${locClause}
      `, [id, ...params]);

      if (!existing || existing.length === 0) {
        return errorRes(res, 'Registration not found or unauthorized', [], 404);
      }

      const prev = existing[0];

      await pool.query(`
        UPDATE wedding_registrations SET status = 'Deleted', updated_at = NOW() WHERE id = ?
      `, [id]);

      await pool.query(`
        INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details)
        VALUES (?, ?, ?, 'Registration Deleted', ?)
      `, [
        id,
        prev.location_id,
        req.user?.fullName || 'Staff',
        `Archived registration ${prev.customer_name} (${prev.registration_id})`
      ]);

      realtimeService.emitWeddingRegistrationChange('DELETE', { id, registration_id: prev.registration_id }, prev.location_id);

      return successRes(res, { id }, 'Registration archived successfully');
    } catch (err) {
      console.error('[WeddingRegistrationController.deleteRegistration Error]', err);
      return errorRes(res, 'Failed to delete registration', [err.message], 500);
    }
  }

  async exportRegistrations(req, res) {
    try {
      await ensureTables();
      const { status, locationId, fromDate, toDate } = req.query;

      const { clause: locClause, params: queryParams } = await getLocationFilter(req, 'wr');
      let whereClauses = ['wr.status != \'Deleted\'', `1=1 ${locClause}`];

      if (status && status !== 'all') {
        whereClauses.push(`wr.status = ?`);
        queryParams.push(status);
      }
      if (locationId && locationId !== 'all') {
        whereClauses.push(`wr.location_id = ?`);
        queryParams.push(parseInt(locationId, 10));
      }
      if (fromDate && toDate) {
        whereClauses.push(`DATE(wr.created_at) BETWEEN ? AND ?`);
        queryParams.push(fromDate, toDate);
      }

      const whereSql = whereClauses.join(' AND ');

      const [registrations] = await pool.query(`
        SELECT 
          wr.registration_id,
          wr.customer_name,
          wr.mobile,
          wr.email,
          wr.location_code,
          wr.location_name,
          wr.wedding_date,
          wr.preferred_shopping_date,
          wr.budget_range,
          wr.family_size,
          wr.status,
          wr.assigned_employee,
          wr.next_followup,
          wr.call_result,
          wr.created_at
        FROM wedding_registrations wr
        LEFT JOIN locations l ON l.id = wr.location_id
        WHERE ${whereSql}
        ORDER BY wr.created_at DESC
      `, queryParams);

      return successRes(res, { registrations: registrations || [] }, 'Export data fetched successfully');
    } catch (err) {
      console.error('[WeddingRegistrationController.exportRegistrations Error]', err);
      return errorRes(res, 'Failed to fetch export data', [err.message], 500);
    }
  }

  // ── Public tracking lookup ─────────────────────────────────────────
  // Customers reach this page with one of THREE real identifiers:
  //   • Portal registrations  → wedding_registrations.registration_id /
  //     customer_id (BSC-WED-<LOC>-<YEAR>-######) or tracking_id
  //     (BSC-WED-<YYYYMMDD>-####) — shown in the registration success popup/email.
  //   • CRM / landing enquiries → wedding_customers.customer_code
  //     (WED-<LOC>-<YEAR>-####) — shown by the Wedding CRM and landing page.
  // Both tables are searched; the ID and mobile must match the SAME row.
  async trackRegistration(req, res) {
    try {
      await ensureTables();
      const rawId = req.body ? req.body.registration_id : undefined;
      const rawMobile = req.body ? req.body.mobile : undefined;

      // 400 — missing input: validate BEFORE touching the database so a
      // malformed request can never be reported as "not found".
      if (rawId === undefined || rawId === null || !String(rawId).trim()) {
        return errorRes(res, 'Please enter your Wedding Request ID and registered mobile number.', [], 400);
      }
      if (rawMobile === undefined || rawMobile === null || !String(rawMobile).trim()) {
        return errorRes(res, 'Please enter your Wedding Request ID and registered mobile number.', [], 400);
      }

      // IDs never contain whitespace; strip it all and compare uppercased.
      const cleanId = String(rawId).trim().toUpperCase().replace(/\s+/g, '');

      // Canonical Indian mobile: reduce every accepted input shape
      // (+91 98765 43210 / 919876543210 / 09876543210 / 9876543210) to 10 digits.
      const canonicalMobile = canonicalMobileDigits(rawMobile);
      if (!canonicalMobile || !/^[6-9]\d{9}$/.test(canonicalMobile)) {
        return errorRes(res, 'Please enter a valid 10-digit registered mobile number.', [], 400);
      }

      // 404 — no row in EITHER table where the ID and mobile belong together.
      const [regRows] = await pool.query(`
        SELECT
          wr.registration_id,
          wr.customer_id,
          wr.tracking_id,
          wr.customer_name,
          wr.wedding_date,
          wr.preferred_shopping_date,
          wr.status,
          wr.next_followup,
          wr.created_at,
          wr.updated_at,
          l.location_name,
          l.location_code
        FROM wedding_registrations wr
        LEFT JOIN locations l ON l.id = wr.location_id
        WHERE (wr.registration_id = ? OR wr.tracking_id = ? OR wr.customer_id = ?)
          AND wr.status != 'Deleted'
          AND (wr.mobile = ? OR RIGHT(wr.mobile, 10) = ?)
        LIMIT 1
      `, [cleanId, cleanId, cleanId, `+91${canonicalMobile}`, canonicalMobile]);

      const [crmRows] = await pool.query(`
        SELECT
          wc.customer_code,
          wc.tracking_id,
          wc.customer_name,
          wc.wedding_date,
          wc.expected_shopping_date,
          wc.customer_status AS status,
          wc.follow_up_date AS next_followup,
          wc.created_at,
          wc.updated_at,
          l.location_name,
          l.location_code
        FROM wedding_customers wc
        LEFT JOIN locations l ON l.id = wc.location_id
        WHERE (wc.customer_code = ? OR wc.tracking_id = ?)
          AND wc.is_deleted = 0
          AND (wc.mobile_number = ? OR RIGHT(wc.mobile_number, 10) = ?)
        LIMIT 1
      `, [cleanId, cleanId, `+91${canonicalMobile}`, canonicalMobile]);

      const fromRegistration = regRows && regRows.length > 0;
      const fromCrm = !fromRegistration && crmRows && crmRows.length > 0;

      if (!fromRegistration && !fromCrm) {
        console.log(`[Track] no match for id=${cleanId} mobile=*****${canonicalMobile.slice(-4)}`);
        return errorRes(res, 'No registration was found for the Wedding Request ID and mobile number provided.', [], 404);
      }

      const reg = fromRegistration ? regRows[0] : crmRows[0];

      const statusTimeline = [
        'Registration Received',
        'Contact Pending',
        'Contacted',
        'Follow-up Scheduled',
        'Shopping Date Confirmed',
        'Visit Scheduled',
        'Visit Completed',
        'Purchase Processing',
        'Purchase Completed',
        'Completed',
        'Cancelled'
      ];

      // Real status vocabulary across both tables:
      // wedding_registrations.status and wedding_customers.customer_status.
      const statusMap = {
        'New': 'Registration Received',
        'Pending': 'Contact Pending',
        'Contacted': 'Contacted',
        'Follow-up Pending': 'Follow-up Scheduled',
        'Follow-up Scheduled': 'Follow-up Scheduled',
        'Interested': 'Follow-up Scheduled',
        'Shopping Confirmed': 'Shopping Date Confirmed',
        'Shopping Date Confirmed': 'Shopping Date Confirmed',
        'Visit Scheduled': 'Visit Scheduled',
        'Visited Store': 'Visit Completed',
        'Converted': 'Purchase Completed',
        'Purchase Completed': 'Purchase Completed',
        'Completed': 'Completed',
        'Closed': 'Completed',
        'Not Interested': 'Cancelled',
        'Cancelled': 'Cancelled'
      };

      const customerStatus = statusMap[reg.status] || 'Registration Received';
      const timeline = customerStatus === 'Cancelled'
        ? ['Registration Received', 'Cancelled']
        : statusTimeline.slice(0, statusTimeline.indexOf(customerStatus) + 1);

      const displayId = fromRegistration ? reg.registration_id : reg.customer_code;

      console.log(`[Track] found id=${displayId} source=${fromRegistration ? 'registration' : 'crm'}`);

      return successRes(res, {
        registration_id: displayId,
        customer_id: (fromRegistration && reg.customer_id) || displayId,
        tracking_id: reg.tracking_id || displayId,
        customer_name: reg.customer_name,
        store_name: reg.location_name,
        store_code: reg.location_code,
        registration_date: reg.created_at,
        wedding_date: reg.wedding_date,
        expected_shopping_date: fromRegistration ? reg.preferred_shopping_date : reg.expected_shopping_date,
        next_followup: reg.next_followup,
        last_updated: reg.updated_at,
        current_status: customerStatus,
        status_timeline: timeline
      }, 'Registration details fetched successfully');
    } catch (err) {
      console.error('[WeddingRegistrationController.trackRegistration Error]', err);
      return errorRes(res, 'We couldn\'t check your request right now. Please try again.', [], 500);
    }
  }

  // ── Resend confirmation email (Admin / HR retry mechanism) ───────
  async resendConfirmationEmail(req, res) {
    try {
      await ensureTables();
      const id = parseInt(req.params.id, 10);
      const { clause: locClause, params: locParams } = await getLocationFilter(req, 'wr');

      const [rows] = await pool.query(
        `SELECT wr.*, l.location_name FROM wedding_registrations wr
         LEFT JOIN locations l ON l.id = wr.location_id
         WHERE wr.id = ? AND wr.status != 'Deleted' ${locClause}`,
        [id, ...locParams]
      );

      if (!rows || rows.length === 0) {
        return errorRes(res, 'Registration not found or unauthorized', [], 404);
      }

      const reg = rows[0];
      if (!reg.email) {
        return errorRes(res, 'This registration has no email address on file.', [], 400);
      }

      const emailResult = await sendWeddingRegistrationConfirmation({
        customer_name: reg.customer_name,
        mobile: reg.mobile,
        email: reg.email,
        registration_id: reg.registration_id,
        tracking_id: reg.tracking_id || reg.registration_id,
        store_name: reg.store_name,
        location_code: reg.location_code,
        wedding_date: reg.wedding_date,
        preferred_shopping_date: reg.preferred_shopping_date
      });

      const status = emailResult && emailResult.success ? 'EMAIL_SENT' : 'EMAIL_FAILED';
      await this.updateEmailStatus(id, status, emailResult && !emailResult.success ? emailResult.error : null);

      if (!emailResult || !emailResult.success) {
        return errorRes(res, 'Email could not be sent right now. The customer remains registered.', [emailResult ? emailResult.error : 'unknown'], 502);
      }

      return successRes(res, { id, email_status: 'EMAIL_SENT' }, 'Confirmation email sent successfully.');
    } catch (err) {
      console.error('[WeddingRegistrationController.resendConfirmationEmail Error]', err);
      return errorRes(res, 'Failed to send email. Please try again.', [err.message], 500);
    }
  }
}

module.exports = new WeddingRegistrationController();