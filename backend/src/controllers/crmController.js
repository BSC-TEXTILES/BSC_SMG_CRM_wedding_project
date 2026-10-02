const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../utils/secrets');
const { getLocationFilter, injectLocationId, getEffectiveLocationId, parseTargetLocation } = require('../middleware/auth');
const realtimeService = require('../services/realtimeService');
const { getCache, setCache } = require('../config/redisClient');
const { resolveStoreLocation, STORE_LOCATIONS } = require('../config/storeLocations');
const dateUtils = require('../utils/dates');

// Singleton promise to ensure CRM schema tables exist once at boot without blocking request pipelines
let crmTablesChecked = false;
let crmInitPromise = null;
async function ensureCrmTables() {
  if (crmTablesChecked) return;
  if (!crmInitPromise) {
    crmInitPromise = (async () => {
      try {
        await db.query(`
          CREATE TABLE IF NOT EXISTS Sections (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(150) NOT NULL UNIQUE,
            sectionType VARCHAR(50) DEFAULT 'retail',
            manager VARCHAR(150) NULL,
            isActive TINYINT(1) DEFAULT 1
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `).catch(() => {});
        await db.query(`
          CREATE TABLE IF NOT EXISTS FeedbackQuestions (
            id VARCHAR(64) PRIMARY KEY,
            question TEXT NOT NULL,
            options TEXT NOT NULL,
            position INT DEFAULT 1,
            isActive TINYINT(1) DEFAULT 1
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `).catch(() => {});
        await db.query(`
          CREATE TABLE IF NOT EXISTS Feedback (
            id VARCHAR(64) PRIMARY KEY,
            date VARCHAR(32),
            source VARCHAR(32) DEFAULT 'qr',
            area VARCHAR(150),
            yourVoice TEXT,
            custName VARCHAR(255),
            custMobile VARCHAR(32),
            custDob VARCHAR(32),
            q0 VARCHAR(255), q0_other VARCHAR(255),
            q1 VARCHAR(255), q1_other VARCHAR(255),
            q2 VARCHAR(255), q2_other VARCHAR(255),
            q3 VARCHAR(255), q3_other VARCHAR(255),
            q4 VARCHAR(255), q4_other VARCHAR(255),
            q5 VARCHAR(255), q5_other VARCHAR(255),
            q6 VARCHAR(255), q6_other VARCHAR(255),
            q7 VARCHAR(255), q7_other VARCHAR(255),
            status VARCHAR(32) DEFAULT 'new',
            actionTaken TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            deleted_at TIMESTAMP NULL,
            entryDate VARCHAR(32),
            entryTime VARCHAR(32),
            customerName VARCHAR(255),
            mobile VARCHAR(32),
            email VARCHAR(150),
            dob VARCHAR(32),
            sectionId VARCHAR(64),
            answers TEXT,
            voice TEXT,
            isNegative TINYINT(1) DEFAULT 0,
            location_id INT NULL,
            locationCode VARCHAR(10),
            locationName VARCHAR(100),
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `).catch(() => {});
        await db.query(`
          CREATE TABLE IF NOT EXISTS CallQueue (
            id VARCHAR(64) PRIMARY KEY,
            feedbackId VARCHAR(64),
            entryDate VARCHAR(16),
            customerName VARCHAR(255),
            mobile VARCHAR(32),
            status VARCHAR(32) DEFAULT 'new',
            notes TEXT,
            attempts INT DEFAULT 0,
            followUpDate VARCHAR(32),
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `).catch(() => {});
        await db.query(`
          CREATE TABLE IF NOT EXISTS CallLogs (
            id VARCHAR(64) PRIMARY KEY,
            callQueueId VARCHAR(64),
            feedbackId VARCHAR(64),
            callStatus VARCHAR(32),
            callOutcome VARCHAR(64),
            executive VARCHAR(255) DEFAULT 'Store Executive',
            agentName VARCHAR(255),
            issueCategory VARCHAR(64),
            callDate VARCHAR(32),
            notes TEXT,
            followUpDate VARCHAR(64),
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `).catch(() => {});
        await db.query(`
          CREATE TABLE IF NOT EXISTS Diverts (
            id VARCHAR(64) PRIMARY KEY,
            location_id INT NOT NULL DEFAULT 2,
            refNo INT NOT NULL AUTO_INCREMENT,
            entryDate DATE NOT NULL,
            sectionId VARCHAR(150),
            productWanted TEXT NOT NULL,
            quantity INT DEFAULT 1,
            priceRange VARCHAR(128),
            reasonCode VARCHAR(64) DEFAULT 'OUT_OF_STOCK',
            customerName VARCHAR(150),
            customerMobile VARCHAR(32),
            status VARCHAR(32) DEFAULT 'open',
            createdBy VARCHAR(100),
            pmNotes TEXT,
            size VARCHAR(64),
            colour VARCHAR(64),
            other_product_details TEXT,
            required_by_date VARCHAR(32),
            reference_image VARCHAR(512),
            remarks TEXT,
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_diverts_refNo (refNo),
            KEY idx_diverts_loc (location_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `).catch(() => {});
        await db.query(`
          CREATE TABLE IF NOT EXISTS VmFloors (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE,
            description TEXT NULL,
            sections TEXT NOT NULL,
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `).catch(() => {});
        await db.query(`
          CREATE TABLE IF NOT EXISTS chat_messages (
            id VARCHAR(64) PRIMARY KEY,
            user_id VARCHAR(64) NOT NULL,
            message_text TEXT NOT NULL,
            sender ENUM('user', 'system') DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_chat_user (user_id),
            INDEX idx_chat_time (created_at)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `).catch(() => {});
        crmTablesChecked = true;
      } catch (e) {
        console.warn('[CRM Tables Init Notice]', e.message);
      }
    })();
  }
  return crmInitPromise;
}

// Helper to generate UUIDs
function getUUID() {
  try {
    const crypto = require('crypto');
    // crypto.randomUUID() requires Node 15.6.0+, fallback for Node 14 compatibility
    return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
  } catch (e) {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}

function getISTDateString() {
  return dateUtils.getISTDateString();
}

/**
 * Footfall rows are keyed by an IST calendar day. `toISOString().split('T')[0]`
 * yields the UTC day, which is still the previous day until 05:30 IST — so an
 * early-morning entry would be stored under yesterday and never appear in
 * "Today's Footfall".
 */
function toFootfallDateOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const s = String(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function getISTHour() {
  return dateUtils.getISTHour();
}

function getISTTimeString(d = new Date()) {
  try {
    let dateObj = d;
    if (typeof d === 'string') {
      const formattedStr = d.includes('Z') || d.includes('+') ? d : d.replace(' ', 'T') + 'Z';
      dateObj = new Date(formattedStr);
      if (isNaN(dateObj.getTime())) dateObj = new Date(d);
    }
    if (!dateObj || isNaN(dateObj.getTime())) return '';
    return dateObj.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: true, 
      timeZone: 'Asia/Kolkata' 
    });
  } catch (e) {
    return '';
  }
}


// ── Settings & PIN Verification ─────────────────────────────
exports.getSettings = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT settingKey, settingValue FROM Setting');
    const settingsMap = {};
    rows.forEach(r => {
      settingsMap[r.settingKey] = r.settingValue;
    });
    // Fallback defaults
    const result = {
      companyName: settingsMap['company_name'] || 'BSC Textiles Private Davanagere',
      logoUrl: settingsMap['logo_url'] || '/logo.png',
      openHour: parseInt(settingsMap['open_hour'] || '10', 10),
      closeHour: parseInt(settingsMap['close_hour'] || '22', 10),
      graceMinutes: parseInt(settingsMap['footfall_grace_minutes'] || '30', 10),
      editCutoffHours: parseInt(settingsMap['edit_cutoff_hours'] || '24', 10),
      derEmail: settingsMap['der_email'] || 'der@bsctextiles.com',
      adminReportEmail: settingsMap['admin_report_email'] || settingsMap['admin_email'] || process.env.ADMIN_EMAIL || '',
      smtpHost: process.env.SMTP_HOST || 'smtp.hostinger.com',
      smtpPort: process.env.SMTP_PORT || '465',
      smtpUser: process.env.SMTP_USER || '',
      smtpFrom: process.env.SMTP_FROM || process.env.SMTP_USER || '',
      smtpConfigured: Boolean(process.env.SMTP_USER && (process.env.SMTP_PASS || process.env.SMTP_PASSWORD)),
      // PIN hashes are one-way (bcrypt) and never leave the server - clients
      // only learn whether a PIN has been configured yet.
      hasTvPin: Boolean(settingsMap['tv_pin']),
      hasCashPin: Boolean(settingsMap['cash_pin']),
      hasGreeterPin: Boolean(settingsMap['greeter_pin'])
    };
    return res.json({ success: true, settings: result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { tvPin, cashPin, greeterPin, companyName, adminReportEmail, adminEmail } = req.body;
    const kv = {};
    // Kiosk/cash PINs are credentials: they are stored as bcrypt hashes and
    // are never written to (or read back from) the database in plain text.
    for (const [field, key] of [['tvPin', 'tv_pin'], ['cashPin', 'cash_pin'], ['greeterPin', 'greeter_pin']]) {
      const raw = req.body[field];
      if (raw !== undefined && String(raw).trim() !== '') {
        const pin = String(raw).trim();
        if (!/^\d{4,8}$/.test(pin)) {
          return res.status(400).json({ success: false, error: `${field} must be 4-8 digits` });
        }
        kv[key] = await bcrypt.hash(pin, 12);
      }
    }
    if (companyName !== undefined) kv['company_name'] = String(companyName).trim();

    const reportEmail = adminReportEmail !== undefined ? adminReportEmail : adminEmail;
    if (reportEmail !== undefined) {
      const trimmed = String(reportEmail).trim();
      if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return res.status(400).json({ success: false, error: 'Please enter a valid admin report email address.' });
      }
      kv['admin_report_email'] = trimmed;
    }

    for (const [key, val] of Object.entries(kv)) {
      await db.query(
        `INSERT INTO Setting (settingKey, settingValue, category) VALUES (?, ?, 'General')
         ON DUPLICATE KEY UPDATE settingValue = VALUES(settingValue)`,
        [key, val]
      );
    }
    return res.json({ success: true, message: 'Settings updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Trigger daily report manually on-demand (e.g. Test Report from settings page).
 */
exports.sendManualDailyReport = async (req, res) => {
  try {
    const { date, recipient } = req.body;
    const { generateAndSendDailyReport } = require('../services/reportScheduler');
    const result = await generateAndSendDailyReport(date || null, recipient || null);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json({
      success: true,
      message: `Executive daily report sent successfully to ${result.recipient}`,
      recipient: result.recipient,
      reportData: result.reportData
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.verifyPin = async (req, res) => {
  try {
    const { type, pin } = req.body; // type: 'tv' | 'cash' | 'greeter'
    const key = `${type}_pin`;
    if (!['tv', 'cash', 'greeter'].includes(type) || !pin) {
      return res.status(400).json({ success: false, message: 'PIN type and value are required' });
    }
    const locId = Number(req.body.locationId || req.body.location_id) || 1;
    const supplied = String(pin).trim();

    // Check kiosk_pins table first (location-specific active PINs or global PINs)
    let candidateHashes = [];
    try {
      const [kioskRows] = await db.query(
        'SELECT pin_hash FROM kiosk_pins WHERE pin_type = ? AND status = "Active" AND (location_id = ? OR location_id IS NULL) ORDER BY location_id DESC',
        [type, locId]
      );
      if (kioskRows && kioskRows.length > 0) {
        candidateHashes.push(...kioskRows.map((r) => r.pin_hash));
      }
    } catch (e) {
      // kiosk_pins query error ignored if table missing
    }

    // Check Setting table
    try {
      const [rows] = await db.query('SELECT settingValue FROM Setting WHERE settingKey = ?', [key]);
      if (rows && rows.length > 0 && rows[0].settingValue) {
        candidateHashes.push(rows[0].settingValue);
      }
    } catch (e) {}

    // First use: if no PIN configured anywhere yet, factory default '1234' is accepted and hashed
    if (candidateHashes.length === 0) {
      if (supplied === '1234') {
        const hash = await bcrypt.hash('1234', 12);
        await db.query(
          `INSERT INTO Setting (settingKey, settingValue, category) VALUES (?, ?, 'General')
           ON DUPLICATE KEY UPDATE settingValue = VALUES(settingValue)`,
          [key, hash]
        );
        candidateHashes.push(hash);
      } else {
        return res.status(401).json({ success: false, message: 'Incorrect kiosk password. Please try again.' });
      }
    }

    let ok = false;
    for (const h of candidateHashes) {
      if (await bcrypt.compare(supplied, h).catch(() => false)) {
        ok = true;
        break;
      }
    }

    if (ok) {
      const locNames = {
        1: { code: 'BEL', name: 'Belagavi' },
        2: { code: 'DAV', name: 'Davanagere' },
        3: { code: 'SHI', name: 'Shivamogga' }
      };
      const locMeta = locNames[locId] || { code: 'BEL', name: 'Belagavi' };
      const expiresAt = Date.now() + 8 * 60 * 60 * 1000; // 8 hours kiosk session
      const token = jwt.sign(
        { id: 9999, username: 'tv-kiosk', role: 'Staff', fullName: 'Showroom TV Kiosk', locationId: locId },
        getJwtSecret(),
        { expiresIn: '8h' }
      );
      return res.json({
        success: true,
        message: 'Live TV Kiosk unlocked.',
        token,
        expiresAt,
        location: { id: locId, code: locMeta.code, name: locMeta.name }
      });
    }

    return res.status(401).json({ success: false, message: 'Incorrect kiosk password. Please try again.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Sections ────────────────────────────────────────────────
exports.getSections = async (req, res) => {
  try {
    const cacheKey = 'app:prod:crm:sections';
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    const defaultSections = [
      { id: 'sec_1', name: 'Ground Floor Saree', sectionType: 'retail', manager: 'Ground Floor Saree Incharge' },
      { id: 'sec_2', name: '1st Floor Saree', sectionType: 'retail', manager: '1st Floor Saree Manager' },
      { id: 'sec_3', name: 'Ladies', sectionType: 'retail', manager: 'Ladies Wear Lead' },
      { id: 'sec_4', name: 'Kids', sectionType: 'retail', manager: 'Kids Section Incharge' },
      { id: 'sec_5', name: 'Mens', sectionType: 'retail', manager: 'Menswear Manager' }
    ];

    await db.query(`
      CREATE TABLE IF NOT EXISTS Sections (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(150) NOT NULL UNIQUE,
        sectionType VARCHAR(50) DEFAULT 'retail',
        manager VARCHAR(150) NULL,
        isActive TINYINT(1) DEFAULT 1
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(() => {});

    for (const sec of defaultSections) {
      await db.query(`
        INSERT INTO Sections (id, name, sectionType, manager, isActive)
        VALUES (?, ?, ?, ?, TRUE)
        ON DUPLICATE KEY UPDATE name = VALUES(name), isActive = TRUE
      `, [sec.id, sec.name, sec.sectionType, sec.manager]).catch(() => {});
    }

    const [rows] = await db.query('SELECT * FROM Sections WHERE isActive = TRUE ORDER BY id ASC');
    const result = { success: true, sections: rows.length > 0 ? rows : defaultSections };
    await setCache(cacheKey, result, 3600); // 1 hour TTL
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Footfall Entries ────────────────────────────────────────
exports.getFootfall = async (req, res) => {
  try {
    const date = toFootfallDateOrNull(req.query.date) || getISTDateString();
    const { clause: locClause, params: locParams } = await getLocationFilter(req, 'FootfallEntries');

    // Always scoped by getLocationFilter: it honours a requested store for
    // global/multi-store users and clamps single-store users to their own.
    const [rows] = await db.query(
      `SELECT * FROM FootfallEntries WHERE entryDate = ? ${locClause} ORDER BY slotHour ASC`,
      [date, ...locParams]
    );
    return res.json({
      success: true,
      date,
      entries: rows,
      locationId: parseTargetLocation(req.query.locationId || req.query.location_id || req.headers['x-location-id'])
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Roles allowed to correct an existing footfall figure outright. Everyone else
 * (the greeter kiosk) may only add to or subtract from the current hour. This is
 * enforced here, not by hiding buttons.
 */
const FOOTFALL_MANAGEMENT_ROLES = [
  'Admin', 'Super Admin', 'System Administrator', 'Manager', 'Store Manager', 'Floor Manager',
  'HR', 'CRM Manager', 'CRM Executive', 'Wedding Collection Manager', 'VM', 'VM Extension Telecaller', 'Greeter', 'Staff', 'Employee'
];

const SOURCE_GREETER = 'Greeter Kiosk';
const SOURCE_ADMIN = 'Admin Entry';

function isFootfallManager(req) {
  const role = String(req.user?.role || '').trim().toLowerCase();
  return FOOTFALL_MANAGEMENT_ROLES.some((r) => r.toLowerCase() === role);
}

/** Strict validation: reject bad input instead of silently defaulting it. */
function validateFootfallSlot(entryDate, slotHour) {
  if (entryDate !== undefined && entryDate !== null && String(entryDate).trim() !== '') {
    if (!toFootfallDateOrNull(entryDate)) {
      return { error: 'Enter a valid date in YYYY-MM-DD format.' };
    }
  }
  if (slotHour !== undefined && slotHour !== null && String(slotHour).trim() !== '') {
    const hour = Number(slotHour);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
      return { error: 'Enter an hour between 0 and 23.' };
    }
  }
  return { error: null };
}

/**
 * Which footfall columns and tables this database actually has.
 *
 * The origin columns and the edit trail were added after the register went live, so
 * an environment that never ran the migration has neither. Failing the whole request
 * for that would hide the visitor counts the store needs, and rolling back a save
 * would stop the kiosk recording footfall at all — both of which are worse than
 * losing the edit trail. The answer is cached, refreshed at most once a minute, and
 * the backend creates the missing pieces on its next boot.
 */
const FOOTFALL_SCHEMA_TTL_MS = 60000;
let footfallSchemaCache = { checkedAt: 0, editTrail: false, origin: false };

async function footfallSchema() {
  const now = Date.now();
  if (now - footfallSchemaCache.checkedAt < FOOTFALL_SCHEMA_TTL_MS) return footfallSchemaCache;

  const next = { checkedAt: now, editTrail: false, origin: false };
  try {
    const [tables] = await db.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'footfall_edit_history' LIMIT 1`
    );
    next.editTrail = !!(tables && tables.length);

    const [cols] = await db.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'footfallentries'
          AND COLUMN_NAME IN ('entry_source', 'created_by')`
    );
    next.origin = !!(cols && cols.length >= 2);
  } catch (err) {
    console.warn('[Footfall] Schema check failed:', err.message);
  }

  if ((!next.editTrail || !next.origin) && footfallSchemaCache.checkedAt !== 0) {
    console.warn('[Footfall] The origin columns or the edit trail are still missing; restart the backend to create them.');
  }
  footfallSchemaCache = next;
  return next;
}

async function recordFootfallHistory(conn, { entryId, locationId, entryDate, slotHour, field, oldValue, newValue, actor, action = 'Edited', reason = null }) {
  if (String(oldValue) === String(newValue)) return;
  const schema = await footfallSchema();
  if (!schema.editTrail) return;
  await conn.query(
    `INSERT INTO footfall_edit_history
       (entry_id, location_id, entryDate, slotHour, field_changed, old_value, new_value, action, edited_by, edited_by_role, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entryId, locationId, entryDate, slotHour, field,
      oldValue === null || oldValue === undefined ? null : String(oldValue),
      newValue === null || newValue === undefined ? null : String(newValue),
      action,
      actor?.fullName || actor?.username || 'Staff',
      actor?.role || null,
      reason
    ]
  );
}

exports.upsertFootfall = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { entryDate, slotHour, visitors, remarks, submittedBy, reason } = req.body;

    const invalid = validateFootfallSlot(entryDate, slotHour);
    if (invalid.error) return res.status(400).json({ success: false, message: invalid.error });

    // 'increment' keeps a running count server-side. The kiosk previously sent a
    // number it had added up in the browser, so two people clicking at the same
    // time overwrote each other and visitors went missing.
    const mode = String(req.body.mode || 'set').toLowerCase() === 'increment' ? 'increment' : 'set';
    const delta = Number(req.body.delta !== undefined ? req.body.delta : visitors);

    if (mode === 'set') {
      if (!isFootfallManager(req) && !req.user) {
        return res.status(403).json({
          success: false,
          message: 'Only authorized staff and management can log or update footfall counts.'
        });
      }
      if (visitors === undefined || visitors === null || visitors === '' || Number.isNaN(Number(visitors))) {
        return res.status(400).json({ success: false, message: 'Footfall count is required.' });
      }
      if (Number(visitors) < 0) {
        return res.status(400).json({ success: false, message: 'Footfall count cannot be negative.' });
      }
    } else if (!Number.isInteger(delta) || delta === 0) {
      return res.status(400).json({ success: false, message: 'Enter a whole number of visitors to add or remove.' });
    }

    let locationId = injectLocationId(req);
    if (!locationId && (req.body.location_id || req.body.locationId)) {
      locationId = Number(req.body.location_id || req.body.locationId) || null;
    }
    if (!locationId && req.user && req.user.locationId) {
      locationId = req.user.locationId;
    }
    // Fallback: If user has allowedLocations, use the first one, or fetch the first active store from DB or fallback to 1
    if (!locationId) {
      if (Array.isArray(req.user?.allowedLocations) && req.user.allowedLocations.length > 0) {
        locationId = Number(req.user.allowedLocations[0]) || 1;
      } else {
        try {
          const [locRows] = await db.query('SELECT id FROM locations WHERE active = 1 ORDER BY id ASC LIMIT 1');
          locationId = (locRows && locRows.length > 0) ? locRows[0].id : 1;
        } catch {
          locationId = 1;
        }
      }
    }

    const targetDate = toFootfallDateOrNull(entryDate) || getISTDateString();
    const targetHour = (slotHour !== undefined && slotHour !== null && !isNaN(Number(slotHour))) ? Number(slotHour) : getISTHour();
    const targetRemarks = String(remarks || '').trim();
    const actorName = String(submittedBy || req.user?.fullName || req.user?.username || 'Staff').trim();
    const actorRole = String(req.user?.role || 'Staff').trim();
    const source = isFootfallManager(req) ? SOURCE_ADMIN : SOURCE_GREETER;

    await conn.beginTransaction();

    const [existing] = await conn.query(
      `SELECT * FROM FootfallEntries WHERE location_id = ? AND entryDate = ? AND slotHour = ? FOR UPDATE`,
      [locationId, targetDate, targetHour]
    );
    const before = existing[0] || null;
    const oldVisitors = before ? Number(before.visitors) : 0;
    const newVisitors = mode === 'increment' ? Math.max(0, oldVisitors + delta) : Math.max(0, Number(visitors));
    const entryId = before ? before.id : getUUID();

    // A database that has not been given the origin columns yet must still be able to
    // record visitors: refusing the save over a missing audit column would close the
    // store's register for the day.
    const schema = await footfallSchema();
    const originUpdate = schema.origin ? ', updated_by = ?, updated_by_role = ?' : '';
    const originColumns = schema.origin ? ', entry_source, created_by, created_by_role, updated_by, updated_by_role' : '';
    const originPlaceholders = schema.origin ? ', ?, ?, ?, ?, ?' : '';

    if (before) {
      await conn.query(
        `UPDATE FootfallEntries
           SET visitors = ?, remarks = ?, submittedBy = ?${originUpdate},
               updatedAt = CURRENT_TIMESTAMP
         WHERE id = ?`,
        schema.origin
          ? [newVisitors, targetRemarks || before.remarks, before.submittedBy || actorName, actorName, actorRole, entryId]
          : [newVisitors, targetRemarks || before.remarks, before.submittedBy || actorName, entryId]
      );
    } else {
      await conn.query(
        `INSERT INTO FootfallEntries
           (id, location_id, entryDate, slotHour, visitors, remarks, submittedBy${originColumns})
         VALUES (?, ?, ?, ?, ?, ?, ?${originPlaceholders})`,
        schema.origin
          ? [entryId, locationId, targetDate, targetHour, newVisitors, targetRemarks, actorName, source, actorName, actorRole, actorName, actorRole]
          : [entryId, locationId, targetDate, targetHour, newVisitors, targetRemarks, actorName]
      );
    }

    await recordFootfallHistory(conn, {
      entryId, locationId, entryDate: targetDate, slotHour: targetHour,
      field: 'visitors', oldValue: oldVisitors, newValue: newVisitors,
      actor: req.user, action: before ? (mode === 'increment' ? 'Adjusted' : 'Edited') : 'Created',
      reason: reason ? String(reason).slice(0, 255) : (mode === 'increment' ? `Delta ${delta > 0 ? '+' : ''}${delta}` : null)
    });

    if (before && targetRemarks && targetRemarks !== String(before.remarks || '')) {
      await recordFootfallHistory(conn, {
        entryId, locationId, entryDate: targetDate, slotHour: targetHour,
        field: 'remarks', oldValue: before.remarks, newValue: targetRemarks, actor: req.user
      });
    }

    await conn.commit();

    const [savedRows] = await conn.query(
      `SELECT id, location_id, entryDate, slotHour, visitors, remarks, submittedBy${originColumns},
              createdAt, updatedAt
       FROM FootfallEntries WHERE id = ?`,
      [entryId]
    );
    const [totalRows] = await conn.query(
      `SELECT COALESCE(SUM(visitors), 0) AS totalVisitors, COUNT(*) AS entryCount
       FROM FootfallEntries WHERE entryDate = ? AND location_id = ?`,
      [targetDate, locationId]
    );

    const saved = savedRows[0] || null;

    // Push the saved entry to this store's screens (and to global admins). This
    // used to be a bare io.emit, so a footfall entry in one store refreshed the
    // pages of every other store as well.
    realtimeService.emitFootfallUpdate({
      entry_id: entryId,
      location_id: locationId,
      entryDate: targetDate,
      slotHour: targetHour,
      visitors: newVisitors,
      remarks: saved?.remarks ?? targetRemarks,
      submittedBy: actorName,
      source: saved?.entry_source || source,
      updatedBy: actorName,
      action: before ? 'updated' : 'created'
    });
    realtimeService.emitEntityChange({
      entity: 'FOOTFALL',
      action: 'UPDATE',
      locationId,
      meta: { entryDate: targetDate, slotHour: targetHour, visitors: newVisitors, source }
    });

    return res.json({
      success: true,
      message: before ? 'Footfall entry updated successfully.' : 'Footfall entry saved successfully.',
      location_id: locationId,
      entry: saved,
      entryDate: targetDate,
      previousVisitors: oldVisitors,
      mode,
      todayTotal: Number(totalRows[0]?.totalVisitors || 0),
      entryCount: Number(totalRows[0]?.entryCount || 0)
    });
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('[Footfall upsert error]', err);
    return res.status(500).json({ 
      success: false, 
      message: err.message ? `Unable to save footfall entry: ${err.message}` : 'Unable to save footfall entry. Please try again.', 
      error: err.message 
    });
  } finally {
    conn.release();
  }
};

/** Today's (or any day's) entries with origin and editor, for the kiosk and management lists. */
exports.listFootfallEntries = async (req, res) => {
  try {
    const dateParam = req.query.date || req.query.entryDate;
    const invalid = validateFootfallSlot(dateParam);
    if (invalid.error) return res.status(400).json({ success: false, message: invalid.error });
    const targetDate = toFootfallDateOrNull(dateParam) || getISTDateString();

    const { clause: locClause, params: locParams } = await getLocationFilter(req, 'f');
    const sourceFilter = String(req.query.source || '').trim();
    const greeterFilter = String(req.query.greeter || '').trim();
    const schema = await footfallSchema();

    const where = [`f.entryDate = ?`, `1=1 ${locClause}`];
    const params = [targetDate, ...locParams];

    if (schema.origin && sourceFilter && sourceFilter !== 'all') {
      where.push(`f.entry_source = ?`);
      params.push(sourceFilter);
    }
    if (schema.origin && greeterFilter && greeterFilter !== 'all') {
      where.push(`(f.created_by = ? OR f.submittedBy = ?)`);
      params.push(greeterFilter, greeterFilter);
    }

    // The trail and origin columns arrived after the register went live, so they are
    // read only when this database actually has them; the visitor counts are always
    // returned. `f.*` already carries the origin columns when they exist.
    const columns = ['f.*', 'l.location_name', 'l.location_code'];
    if (schema.editTrail) {
      columns.push('(SELECT COUNT(*) FROM footfall_edit_history h WHERE h.entry_id = f.id) AS edit_count');
      columns.push('(SELECT MAX(h.created_at) FROM footfall_edit_history h WHERE h.entry_id = f.id) AS last_edited_at');
    } else {
      columns.push('0 AS edit_count', 'NULL AS last_edited_at');
    }
    if (!schema.origin) {
      columns.push('NULL AS entry_source', 'NULL AS created_by', 'NULL AS updated_by');
    }

    const [rows] = await db.query(`
      SELECT ${columns.join(', ')}
      FROM FootfallEntries f
      LEFT JOIN locations l ON l.id = f.location_id
      WHERE ${where.join(' AND ')}
      ORDER BY f.slotHour ASC
    `, params);

    const totalVisitors = rows.reduce((sum, r) => sum + (Number(r.visitors) || 0), 0);

    return res.json({
      success: true,
      date: targetDate,
      entries: rows,
      totalVisitors,
      // Hiding the filter is better than offering one that cannot be applied.
      sources: schema.origin ? [SOURCE_GREETER, SOURCE_ADMIN] : []
    });
  } catch (err) {
    console.error('[Footfall list error]', err);
    return res.status(500).json({ success: false, message: 'Unable to load footfall entries. Please try again.', error: err.message });
  }
};

/** Edit a specific record by id so a correction updates the row, never adds one. */
exports.updateFootfallEntry = async (req, res) => {
  const conn = await db.getConnection();
  try {
    if (!isFootfallManager(req)) {
      return res.status(403).json({ success: false, message: 'Only management users can correct a footfall record.' });
    }

    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ success: false, message: 'Footfall record id is required.' });

    const { visitors, entryDate, slotHour, location_id: locationIdParam, remarks, reason } = req.body;
    const invalid = validateFootfallSlot(entryDate, slotHour);
    if (invalid.error) return res.status(400).json({ success: false, message: invalid.error });
    if (visitors !== undefined && (Number.isNaN(Number(visitors)) || Number(visitors) < 0)) {
      return res.status(400).json({ success: false, message: 'Footfall count cannot be negative.' });
    }

    const { clause: locClause, params: locParams } = await getLocationFilter(req, 'fe');

    await conn.beginTransaction();

    // The location clause is part of the lookup, so a cross-store id cannot be edited.
    const [rows] = await conn.query(`
      SELECT fe.* FROM FootfallEntries fe
      WHERE fe.id = ? ${locClause}
      FOR UPDATE
    `, [id, ...locParams]);

    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Footfall record not found or outside your store locations.' });
    }
    const before = rows[0];

    const nextVisitors = visitors === undefined ? Number(before.visitors) : Math.max(0, Number(visitors));
    const nextDate = toFootfallDateOrNull(entryDate) || before.entryDate;
    const nextHour = slotHour === undefined || slotHour === null || slotHour === '' ? before.slotHour : Number(slotHour);
    const nextLocation = locationIdParam === undefined || locationIdParam === null || locationIdParam === ''
      ? before.location_id : Number(locationIdParam);
    const nextRemarks = remarks === undefined ? before.remarks : String(remarks).trim();

    if (Number.isInteger(nextHour) && (nextHour < 0 || nextHour > 23)) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Enter an hour between 0 and 23.' });
    }
    if (nextLocation !== before.location_id) {
      const [allowed] = await conn.query('SELECT id FROM locations WHERE id = ?', [nextLocation]);
      if (!allowed.length) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'That store location does not exist.' });
      }
    }

    const editorSchema = await footfallSchema();
    const editorUpdate = editorSchema.origin ? ', updated_by = ?, updated_by_role = ?' : '';
    await conn.query(
      `UPDATE FootfallEntries
         SET visitors = ?, entryDate = ?, slotHour = ?, location_id = ?, remarks = ?${editorUpdate},
             updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
      editorSchema.origin
        ? [nextVisitors, nextDate, nextHour, nextLocation, nextRemarks,
            req.user?.fullName || req.user?.username || 'Staff', req.user?.role || 'Staff', id]
        : [nextVisitors, nextDate, nextHour, nextLocation, nextRemarks, id]
    );

    const actor = req.user;
    const meta = { entryId: id, locationId: nextLocation, entryDate: nextDate, slotHour: nextHour, actor, reason: reason ? String(reason).slice(0, 255) : null };
    await recordFootfallHistory(conn, { ...meta, field: 'visitors', oldValue: before.visitors, newValue: nextVisitors });
    await recordFootfallHistory(conn, { ...meta, field: 'entryDate', oldValue: before.entryDate, newValue: nextDate });
    await recordFootfallHistory(conn, { ...meta, field: 'slotHour', oldValue: before.slotHour, newValue: nextHour });
    await recordFootfallHistory(conn, { ...meta, field: 'location_id', oldValue: before.location_id, newValue: nextLocation });
    await recordFootfallHistory(conn, { ...meta, field: 'remarks', oldValue: before.remarks, newValue: nextRemarks });

    await conn.commit();

    const [after] = await conn.query('SELECT * FROM FootfallEntries WHERE id = ?', [id]);
    realtimeService.emitFootfallUpdate({
      entry_id: id,
      location_id: after[0]?.location_id,
      entryDate: after[0]?.entryDate,
      slotHour: after[0]?.slotHour,
      visitors: after[0]?.visitors,
      source: after[0]?.entry_source,
      updatedBy: actor?.fullName || 'Staff',
      action: 'corrected'
    });
    realtimeService.emitEntityChange({ entity: 'FOOTFALL', action: 'UPDATE', locationId: after[0]?.location_id, meta: { corrected: true, id } });

    return res.json({
      success: true,
      message: 'Footfall entry updated successfully.',
      entry: after[0] || null,
      previous: { visitors: before.visitors, entryDate: before.entryDate, slotHour: before.slotHour, location_id: before.location_id }
    });
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('[Footfall update error]', err);
    return res.status(500).json({ success: false, message: 'Unable to update footfall entry. Please try again.', error: err.message });
  } finally {
    conn.release();
  }
};

/** Who changed what, for management review. */
exports.getFootfallEditHistory = async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ success: false, message: 'Footfall record id is required.' });

    const { clause: locClause, params: locParams } = await getLocationFilter(req, 'fe');
    const [entryRows] = await db.query(`SELECT fe.* FROM FootfallEntries fe WHERE fe.id = ? ${locClause}`, [id, ...locParams]);
    if (!entryRows.length) {
      return res.status(404).json({ success: false, message: 'Footfall record not found or outside your store locations.' });
    }

    const schema = await footfallSchema();
    if (!schema.editTrail) {
      // No trail table means no corrections were recorded, which is a fact to show,
      // not a failure to hide behind a 500.
      return res.json({
        success: true,
        entry: entryRows[0],
        history: [],
        notice: 'Edit history is not stored on this database yet. Restart the backend to enable it.'
      });
    }

    const [history] = await db.query(
      `SELECT field_changed, old_value, new_value, action, edited_by, edited_by_role, reason, created_at
       FROM footfall_edit_history WHERE entry_id = ? ORDER BY id DESC LIMIT 200`,
      [id]
    );

    return res.json({ success: true, entry: entryRows[0], history });
  } catch (err) {
    console.error('[Footfall history error]', err);
    return res.status(500).json({ success: false, message: 'Unable to load the edit history. Please try again.', error: err.message });
  }
};

// ── Feedback & Questions ────────────────────────────────────
exports.getFeedbackQuestions = async (req, res) => {
  try {
    const defaultQuestions = [
      { id: 'q1', question: '1. How satisfied are you with your overall shopping experience today?', options: ['Very satisfied', 'Satisfied', 'Neutral', 'Dissatisfied', 'Very dissatisfied'], position: 1 },
      { id: 'q2', question: '2. Did you find the product you were looking for?', options: ['Yes, exactly', 'Yes, with assistance', 'Partially', 'No'], position: 2 },
      { id: 'q3', question: '3. How would you rate the quality & variety of our collection?', options: ['Excellent', 'Good', 'Average', 'Poor'], position: 3 },
      { id: 'q4', question: '4. How would you rate the behavior and helpfulness of our staff?', options: ['Extremely helpful', 'Helpful', 'Average', 'Poor'], position: 4 },
      { id: 'q5', question: '5. How likely are you to recommend BSC Textiles to your friends and family?', options: ['Definitely recommend', 'Probably recommend', 'Neutral', 'Not recommend'], position: 5 }
    ];

    await db.query(`
      CREATE TABLE IF NOT EXISTS FeedbackQuestions (
        id VARCHAR(64) PRIMARY KEY,
        question TEXT NOT NULL,
        options TEXT NOT NULL,
        position INT DEFAULT 1,
        isActive TINYINT(1) DEFAULT 1
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(() => {});

    for (const q of defaultQuestions) {
      await db.query(`
        INSERT INTO FeedbackQuestions (id, question, options, position, isActive)
        VALUES (?, ?, ?, ?, TRUE)
        ON DUPLICATE KEY UPDATE question = VALUES(question), options = VALUES(options), position = VALUES(position), isActive = TRUE
      `, [q.id, q.question, JSON.stringify(q.options), q.position]).catch(() => {});
    }

    const [rows] = await db.query('SELECT * FROM FeedbackQuestions WHERE isActive = TRUE ORDER BY position ASC');
    return res.json({ success: true, questions: rows.length > 0 ? rows : defaultQuestions });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

function evaluateFeedbackEscalation(answersObj = {}, voiceCommentsStr = '', rawQ0 = '', rawQ1 = '', rawQ2 = '', rawQ3 = '') {
  const q1Val = String(answersObj.q1 || rawQ1 || '').trim().toLowerCase();
  const q2Val = String(answersObj.q2 || rawQ2 || '').trim().toLowerCase();
  const q3Val = String(answersObj.q3 || rawQ3 || '').trim().toLowerCase();
  const q4Val = String(answersObj.q4 || '').trim().toLowerCase();
  const q5Val = String(answersObj.q5 || '').trim().toLowerCase();

  const isQ1Neg = q1Val.includes('dissatisfied');
  const isQ2Neg = q2Val === 'no';
  const isQ3Neg = q3Val === 'poor' || q3Val === 'very poor';
  const isQ4Neg = q4Val === 'poor' || q4Val === 'very poor';
  const isQ5Neg = q5Val.includes('not recommend');

  const isQuestionNegative = isQ1Neg || isQ2Neg || isQ3Neg || isQ4Neg || isQ5Neg;

  const commentsLower = String(voiceCommentsStr).toLowerCase();
  const explicitComplaintKeywords = [
    'terrible', 'horrible', 'worst', 'rude', 'scam', 'fraud', 'cheat', 'complaint', 'complain', 
    'refund', 'defect', 'damaged', 'broken', 'disappointed', 'unhappy', 'replace', 'bad service',
    'overcharged', 'wrong bill', 'poor quality'
  ];
  const hasExplicitCommentComplaint = explicitComplaintKeywords.some(kw => commentsLower.includes(kw));

  return isQuestionNegative || hasExplicitCommentComplaint;
}

exports.submitFeedback = async (req, res) => {
  try {
    const { 
      customerName, custName,
      mobile, custMobile,
      email, custEmail,
      dob, custDob,
      billNo, invoiceNo, receiptNo,
      sectionId, area, category,
      answers, q0, q1, q2, q3, q4, q5, q6, q7,
      likedMost, canImprove, additionalComments, voice, yourVoice,
      overallRating, storeExperienceRating, staffServiceRating,
      productRating, cleanlinessRating, ambienceRating, recommendationRating,
      source,
      locationCode,
      location_id,
      locationId: reqLocationId,
      location,
      storeLocation,
      qrCodeId,
      sessionId,
      submissionRef
    } = req.body;

    // 1. Resolve store strictly
    let resolvedStore = resolveStoreLocation(locationCode || location || storeLocation || location_id || reqLocationId);
    
    // If QR code provided and location not resolved, check FeedbackQrCode table
    if (!resolvedStore && qrCodeId) {
      try {
        const [qrRows] = await db.query(
          'SELECT locationId, locationCode FROM FeedbackQrCode WHERE qrCodeId = ? LIMIT 1',
          [qrCodeId]
        );
        if (qrRows && qrRows[0]) {
          resolvedStore = resolveStoreLocation(qrRows[0].locationCode || qrRows[0].locationId);
        }
      } catch (e) {}
    }

    if (!resolvedStore) {
      return res.status(400).json({
        success: false,
        message: 'Please select a valid store (Belagavi, Davanagere, or Shivamogga) to submit feedback.'
      });
    }

    const targetLocId = resolvedStore.id;
    const targetLocCode = resolvedStore.code;
    const targetLocName = resolvedStore.city;
    const targetStoreName = resolvedStore.storeName;
    const targetTableName = resolvedStore.tableName; // 'BSC_Feedback_Belagavi', 'BSC_Feedback_Davanagere', 'BSC_Feedback_Shivamogga'

    // 2. Duplicate / Idempotency protection
    const effectiveSubmissionRef = submissionRef || req.headers['x-idempotency-key'] || null;
    if (effectiveSubmissionRef) {
      const [existingRef] = await db.query(
        `SELECT id, customerName, locationName FROM ${targetTableName} WHERE submissionRef = ? LIMIT 1`,
        [effectiveSubmissionRef]
      );
      if (existingRef && existingRef[0]) {
        return res.json({
          success: true,
          id: existingRef[0].id,
          refNo: existingRef[0].id,
          storeLocation: targetStoreName,
          locationCode: targetLocCode,
          message: 'Your feedback was already received. Thank you!'
        });
      }
    }

    const finalCustName = (customerName || custName || 'Valued Customer').trim();
    let finalMobile = (mobile || custMobile || '').trim();
    if (finalMobile) {
      const digits = finalMobile.replace(/\D/g, '');
      if (digits.length === 10) finalMobile = `+91${digits}`;
      else if (digits.length === 12 && digits.startsWith('91')) finalMobile = `+${digits}`;
      else if (digits.length === 11 && digits.startsWith('0')) finalMobile = `+91${digits.slice(1)}`;
      
      // Secondary duplicate prevention: same non-empty mobile + same store within 60s
      const [recentSubmits] = await db.query(`
        SELECT id FROM ${targetTableName}
        WHERE mobile = ? AND createdAt >= NOW() - INTERVAL 1 MINUTE
        LIMIT 1
      `, [finalMobile]);
      if (recentSubmits && recentSubmits[0]) {
        return res.json({
          success: true,
          id: recentSubmits[0].id,
          refNo: recentSubmits[0].id,
          storeLocation: targetStoreName,
          locationCode: targetLocCode,
          message: 'Your feedback has already been received. Thank you!'
        });
      }
    }

    const finalEmail = (email || custEmail || '').trim() || null;
    const finalDob = dob || custDob || null;
    const finalBillNo = (billNo || invoiceNo || receiptNo || '').trim();
    const finalArea = area || sectionId || category || 'Ground Floor';
    const finalSource = source || 'qr';

    const compiledVoice = [
      finalBillNo ? `Bill / Memo No: ${finalBillNo}` : '',
      finalArea && finalArea !== 'Ground Floor' ? `Section: ${finalArea}` : '',
      likedMost ? `Liked Most: ${likedMost}` : '',
      canImprove ? `Can Improve: ${canImprove}` : '',
      additionalComments ? `Comments: ${additionalComments}` : '',
      voice ? `Voice: ${voice}` : '',
      yourVoice ? `Voice: ${yourVoice}` : ''
    ].filter(Boolean).join('\n');

    const combinedAnswers = {
      ...(typeof answers === 'object' && answers ? answers : {}),
      ...(finalBillNo ? { billNo: finalBillNo } : {}),
      ...(finalArea ? { section: finalArea } : {})
    };

    const isNegative = evaluateFeedbackEscalation(combinedAnswers, compiledVoice, q0, q1, q2, q3);

    // Compute integer rating scores (1-5)
    const computeScore = (val, qKey) => {
      if (val !== undefined && val !== null && !isNaN(Number(val))) return Number(val);
      const ans = combinedAnswers?.[qKey] || '';
      const low = String(ans).toLowerCase();
      if (low.includes('very satisfied') || low.includes('excellent') || low.includes('definitely') || low.includes('extremely')) return 5;
      if (low.includes('satisfied') || low.includes('good') || low.includes('probably') || low.includes('helpful') || low.includes('yes')) return 4;
      if (low.includes('neutral') || low.includes('average') || low.includes('partially')) return 3;
      if (low.includes('dissatisfied') || low.includes('poor')) return 2;
      if (low.includes('very dissatisfied') || low.includes('not recommend') || low.includes('no')) return 1;
      return null;
    };

    const finalOverallRating = computeScore(overallRating, 'q1');
    const finalStoreExpRating = computeScore(storeExperienceRating, 'q1');
    const finalStaffRating = computeScore(staffServiceRating, 'q4');
    const finalProductRating = computeScore(productRating, 'q3');
    const finalCleanlinessRating = cleanlinessRating ? Number(cleanlinessRating) : 5;
    const finalAmbienceRating = ambienceRating ? Number(ambienceRating) : 5;
    const finalRecRating = computeScore(recommendationRating, 'q5');

    // Generate sequential continuous feedback ID checking target table and Feedback table
    let id = '';
    try {
      const [maxRows] = await db.query(`
        SELECT MAX(num) as maxNum FROM (
          SELECT CAST(SUBSTRING(id, 4) AS UNSIGNED) as num FROM ${targetTableName} WHERE id REGEXP '^FB-[0-9]+$'
          UNION ALL
          SELECT CAST(SUBSTRING(id, 4) AS UNSIGNED) as num FROM Feedback WHERE id REGEXP '^FB-[0-9]+$'
        ) as combined
      `);

      if (maxRows && maxRows[0] && maxRows[0].maxNum !== null && maxRows[0].maxNum !== undefined) {
        const lastNum = parseInt(maxRows[0].maxNum, 10);
        if (!isNaN(lastNum) && lastNum >= 0) {
          id = `FB-${String(lastNum + 1).padStart(2, '0')}`;
        }
      }
      if (!id) id = 'FB-01';
    } catch (e) {
      id = `FB-${Date.now().toString().slice(-4)}`;
    }

    const entryDate = getISTDateString();
    const entryTime = getISTTimeString();
    const dateFormatted = new Date().toLocaleDateString('en-GB');

    // Insert into the dedicated store database table
    let insertOk = false;
    for (let attempt = 0; attempt < 3 && !insertOk; attempt++) {
      try {
        await db.query(`
          INSERT INTO ${targetTableName} (
            id, location_id, locationCode, locationName, storeLocation,
            customerName, custName, mobile, custMobile, email, custEmail,
            dob, custDob, visitDate, date, entryDate, visitTime, entryTime,
            overallRating, storeExperienceRating, staffServiceRating, productRating,
            cleanlinessRating, ambienceRating, recommendationRating,
            customerComments, voice, yourVoice, category, sectionId, area,
            answers, q0, q1, q2, q3, q4, q5, q6, q7,
            source, qrCodeId, sessionId, submissionRef, isNegative, status, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)
        `, [
          id, targetLocId, targetLocCode, targetLocName, targetStoreName,
          finalCustName, finalCustName, finalMobile, finalMobile, finalEmail, finalEmail,
          finalDob, finalDob, entryDate, dateFormatted, entryDate, entryTime, entryTime,
          finalOverallRating, finalStoreExpRating, finalStaffRating, finalProductRating,
          finalCleanlinessRating, finalAmbienceRating, finalRecRating,
          compiledVoice, compiledVoice, compiledVoice, finalArea, sectionId || null, finalArea,
          JSON.stringify(combinedAnswers), q0 || null, q1 || null, q2 || null, q3 || null, q4 || null, q5 || null, q6 || null, q7 || null,
          finalSource, qrCodeId || null, sessionId || null, effectiveSubmissionRef, isNegative ? 1 : 0,
          finalBillNo ? `Bill No: ${finalBillNo}` : null
        ]);
        insertOk = true;
      } catch (insertErr) {
        console.error(`[submitFeedback Insert Error attempt ${attempt + 1} into ${targetTableName}]:`, insertErr.message);
        const m = /FB-(\d+)/.exec(String(insertErr.message)) || null;
        const base = m ? parseInt(m[1], 10) : NaN;
        const suffixNum = (!isNaN(base) ? base : Date.now() % 100000) + attempt + 1;
        id = `FB-${String(suffixNum).padStart(2, '0')}`;
      }
    }

    if (!insertOk) {
      return res.status(500).json({
        success: false,
        message: 'Something went wrong while saving your feedback. Please try again.'
      });
    }

    // Mirror to unified Feedback table for backward-compatibility with CallQueue and legacy readers
    try {
      await db.query(`
        INSERT INTO Feedback (
          id, location_id, locationCode, locationName, email, date, source, area, yourVoice,
          custName, custMobile, custDob, q0, q1, q2, q3, q4, q5, q6, q7,
          status, entryDate, entryTime, customerName, mobile, dob, sectionId, answers, voice, isNegative, qrCodeId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          customerName = VALUES(customerName),
          custName = VALUES(custName),
          mobile = VALUES(mobile),
          custMobile = VALUES(custMobile),
          email = VALUES(email),
          location_id = VALUES(location_id),
          locationCode = VALUES(locationCode),
          locationName = VALUES(locationName),
          sectionId = VALUES(sectionId),
          area = VALUES(area),
          answers = VALUES(answers),
          voice = VALUES(voice),
          yourVoice = VALUES(yourVoice),
          entryDate = VALUES(entryDate),
          entryTime = VALUES(entryTime),
          updated_at = NOW()
      `, [
        id, targetLocId, targetLocCode, targetLocName, finalEmail, dateFormatted, finalSource, finalArea, compiledVoice,
        finalCustName, finalMobile, finalDob, q0 || null, q1 || null, q2 || null, q3 || null, q4 || null, q5 || null, q6 || null, q7 || null,
        entryDate, entryTime, finalCustName, finalMobile, finalDob, sectionId || null, JSON.stringify(combinedAnswers), compiledVoice, isNegative ? 1 : 0, qrCodeId || null
      ]);
    } catch (mirrorErr) {
      console.warn('[submitFeedback Mirror Warning]:', mirrorErr.message);
    }

    // Mark scan as submitted if a scan record exists for this QR or location, and update stats
    try {
      let resolvedQrCodeId = qrCodeId;
      if (!resolvedQrCodeId) {
        const [qrRows] = await db.query(
          'SELECT qrCodeId FROM FeedbackQrCode WHERE locationId = ? AND deletedAt IS NULL ORDER BY createdAt DESC LIMIT 1',
          [targetLocId]
        );
        resolvedQrCodeId = qrRows && qrRows[0] ? qrRows[0].qrCodeId : `QR-${targetLocCode}`;
      }

      let scanUpdated = false;
      if (qrCodeId) {
        const [updateRes] = await db.query(`
          UPDATE FeedbackQrScan SET isFeedbackSubmitted = 1, feedbackId = ?
          WHERE (qrCodeRefId = ? OR qrCodeId = ?) AND isFeedbackSubmitted = 0
          ORDER BY scannedAt DESC LIMIT 1
        `, [id, qrCodeId, qrCodeId]);
        if (updateRes && updateRes.affectedRows > 0) scanUpdated = true;
      } else {
        const [updateRes] = await db.query(`
          UPDATE FeedbackQrScan
          SET isFeedbackSubmitted = 1, feedbackId = ?
          WHERE isFeedbackSubmitted = 0 AND qrCodeRefId IN (
            SELECT qrCodeId FROM (SELECT qrCodeId FROM FeedbackQrCode WHERE locationId = ?) as t
          )
          ORDER BY scannedAt DESC LIMIT 1
        `, [id, targetLocId]);
        if (updateRes && updateRes.affectedRows > 0) scanUpdated = true;
      }

      // If no pending scan was matched (e.g. customer completed directly on browser/kiosk), insert record to maintain conversion stats
      if (!scanUpdated) {
        const scanId = `scn_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || null;
        const userAgent = req.headers['user-agent'] || null;
        await db.query(`
          INSERT INTO FeedbackQrScan (
            id, qrCodeId, qrCodeRefId, scannedAt, ipAddress, userAgent, isFeedbackSubmitted, feedbackId
          ) VALUES (?, ?, ?, NOW(), ?, ?, 1, ?)
        `, [scanId, resolvedQrCodeId, resolvedQrCodeId, ipAddress, userAgent, id]).catch(() => {});

        await db.query(`
          UPDATE FeedbackQrCode SET scanCount = scanCount + 1, lastScannedAt = CURRENT_TIMESTAMP WHERE qrCodeId = ?
        `, [resolvedQrCodeId]).catch(() => {});
      }

      // Increment feedbackCount in FeedbackQrCode for this location
      await db.query(`
        UPDATE FeedbackQrCode 
        SET feedbackCount = feedbackCount + 1 
        WHERE locationId = ? OR locationCode = ? OR qrCodeId = ?
      `, [targetLocId, targetLocCode, resolvedQrCodeId]).catch(() => {});
    } catch (scanUpdateErr) {
      console.warn('[submitFeedback Scan Link Notice]:', scanUpdateErr.message);
    }

    // Scope the push to the store the feedback belongs to (plus global admins).
    // `feedback:received` is the name the live TV board listens for.
    realtimeService.emitToLocationRooms(['feedback:submitted', 'feedback:received'], {
      id,
      location_id: targetLocId,
      locationCode: targetLocCode,
      locationName: targetLocName,
      storeLocation: targetStoreName,
      entryDate,
      customerName: finalCustName,
      isNegative: !!isNegative,
      qrCodeId: qrCodeId || null
    });

    if (isNegative) {
      const cqId = `cq_${id}`;
      try {
        await db.query(`
          INSERT INTO CallQueue (id, location_id, feedbackId, entryDate, customerName, mobile, status, notes)
          VALUES (?, ?, ?, ?, ?, ?, 'new', ?)
        `, [cqId, targetLocId, id, entryDate, finalCustName, finalMobile, compiledVoice ? `Escalated Feedback: ${compiledVoice}` : 'Negative customer feedback auto-escalated']);
      } catch (cqErr) {}

      if (io) {
        io.emit('feedback:negative', {
          id,
          location_id: targetLocId,
          locationCode: targetLocCode,
          locationName: targetLocName,
          customerName: finalCustName,
          mobile: finalMobile || 'No Mobile',
          message: `ALERT: Negative customer feedback logged at ${targetStoreName} by ${finalCustName}`
        });
      }
    }

    // ── Mail Server Trigger: Customer Acknowledgment & Admin Notification ───
    (async () => {
      try {
        const { sendFeedbackCustomerEmail, sendFeedbackAdminNotification } = require('../config/email');
        const { getAdminReportEmail } = require('../services/reportScheduler');

        // 1. Send confirmation email to customer if email is provided
        if (finalEmail) {
          sendFeedbackCustomerEmail({
            to: finalEmail,
            customerName: finalCustName,
            storeName: targetStoreName,
            locationCode: targetLocCode,
            rating: finalOverallRating || 5,
            refNo: id,
            comments: compiledVoice || ''
          }).catch(err => console.warn('[Feedback Customer Email Notice]', err.message));
        }

        // 2. Send instant notification to admin
        const adminEmail = await getAdminReportEmail();
        if (adminEmail) {
          sendFeedbackAdminNotification({
            adminEmail,
            customerName: finalCustName,
            mobile: finalMobile,
            storeName: targetStoreName,
            locationCode: targetLocCode,
            rating: finalOverallRating || 5,
            comments: compiledVoice,
            isNegative: !!isNegative,
            refNo: id
          }).catch(err => console.warn('[Feedback Admin Notification Notice]', err.message));
        }
      } catch (mailErr) {
        console.warn('[Feedback Mail Server Trigger Notice]', mailErr.message);
      }
    })();

    return res.json({ 
      success: true, 
      id,
      refNo: id,
      storeLocation: targetStoreName,
      locationCode: targetLocCode,
      message: 'Your feedback has been submitted successfully.' 
    });
  } catch (err) {
    console.error('[submitFeedback Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
    });
  }
};

exports.getFeedbackStats = async (req, res) => {
  try {
    const effectiveLocId = getEffectiveLocationId(req);

    // Query each location database table directly
    const [belRows] = await db.query(`
      SELECT 
        COUNT(*) as total, 
        SUM(CASE WHEN isNegative = 1 THEN 1 ELSE 0 END) as negCount,
        AVG(CASE 
          WHEN overallRating IS NOT NULL THEN overallRating
          WHEN JSON_EXTRACT(answers, '$.q1') = '"Very satisfied"' THEN 5
          WHEN JSON_EXTRACT(answers, '$.q1') = '"Satisfied"' THEN 4
          WHEN JSON_EXTRACT(answers, '$.q1') = '"Neutral"' THEN 3
          WHEN JSON_EXTRACT(answers, '$.q1') = '"Dissatisfied"' THEN 2
          WHEN JSON_EXTRACT(answers, '$.q1') = '"Very dissatisfied"' THEN 1
          ELSE NULL
        END) as avgRating
      FROM BSC_Feedback_Belagavi
    `).catch(() => [[{ total: 0, negCount: 0, avgRating: null }]]);

    const [davRows] = await db.query(`
      SELECT 
        COUNT(*) as total, 
        SUM(CASE WHEN isNegative = 1 THEN 1 ELSE 0 END) as negCount,
        AVG(CASE 
          WHEN overallRating IS NOT NULL THEN overallRating
          WHEN JSON_EXTRACT(answers, '$.q1') = '"Very satisfied"' THEN 5
          WHEN JSON_EXTRACT(answers, '$.q1') = '"Satisfied"' THEN 4
          WHEN JSON_EXTRACT(answers, '$.q1') = '"Neutral"' THEN 3
          WHEN JSON_EXTRACT(answers, '$.q1') = '"Dissatisfied"' THEN 2
          WHEN JSON_EXTRACT(answers, '$.q1') = '"Very dissatisfied"' THEN 1
          ELSE NULL
        END) as avgRating
      FROM BSC_Feedback_Davanagere
    `).catch(() => [[{ total: 0, negCount: 0, avgRating: null }]]);

    const [shiRows] = await db.query(`
      SELECT 
        COUNT(*) as total, 
        SUM(CASE WHEN isNegative = 1 THEN 1 ELSE 0 END) as negCount,
        AVG(CASE 
          WHEN overallRating IS NOT NULL THEN overallRating
          WHEN JSON_EXTRACT(answers, '$.q1') = '"Very satisfied"' THEN 5
          WHEN JSON_EXTRACT(answers, '$.q1') = '"Satisfied"' THEN 4
          WHEN JSON_EXTRACT(answers, '$.q1') = '"Neutral"' THEN 3
          WHEN JSON_EXTRACT(answers, '$.q1') = '"Dissatisfied"' THEN 2
          WHEN JSON_EXTRACT(answers, '$.q1') = '"Very dissatisfied"' THEN 1
          ELSE NULL
        END) as avgRating
      FROM BSC_Feedback_Shivamogga
    `).catch(() => [[{ total: 0, negCount: 0, avgRating: null }]]);

    // Scans per location
    const [locScanRows] = await db.query(`
      SELECT fqc.locationId, COUNT(fqs.id) as scanCount
      FROM FeedbackQrCode fqc
      LEFT JOIN FeedbackQrScan fqs ON (fqs.qrCodeRefId = fqc.qrCodeId OR fqs.qrCodeId = fqc.qrCodeId)
      WHERE fqc.deletedAt IS NULL
      GROUP BY fqc.locationId
    `).catch(() => [[]]);
    const scanMap = {};
    (locScanRows || []).forEach(s => { scanMap[s.locationId] = Number(s.scanCount) || 0; });

    // CallQueue pending follow-ups
    const [queueRows] = await db.query(`
      SELECT location_id, COUNT(*) as pendingCount 
      FROM CallQueue 
      WHERE (status IS NULL OR status = 'new' OR status = 'pending')
      GROUP BY location_id
    `).catch(() => [[]]);
    const queueMap = {};
    (queueRows || []).forEach(q => { queueMap[Number(q.location_id)] = Number(q.pendingCount) || 0; });

    const belTotal = Number(belRows[0]?.total) || 0;
    const belNeg = Number(belRows[0]?.negCount) || 0;
    const davTotal = Number(davRows[0]?.total) || 0;
    const davNeg = Number(davRows[0]?.negCount) || 0;
    const shiTotal = Number(shiRows[0]?.total) || 0;
    const shiNeg = Number(shiRows[0]?.negCount) || 0;

    let byLocation = {
      belagavi: {
        locationId: 1,
        locationCode: 'BEL',
        name: 'Belagavi',
        storeName: 'BSC Textiles Belagavi',
        tableName: 'BSC_Feedback_Belagavi',
        total: belTotal,
        positive: Math.max(0, belTotal - belNeg),
        negative: belNeg,
        needsFollowUp: queueMap[1] || belNeg,
        avgRating: belRows[0]?.avgRating ? Number(belRows[0].avgRating).toFixed(1) : '5.0',
        scans: scanMap[1] || 0
      },
      davanagere: {
        locationId: 2,
        locationCode: 'DAV',
        name: 'Davanagere',
        storeName: 'BSC Textiles Davanagere',
        tableName: 'BSC_Feedback_Davanagere',
        total: davTotal,
        positive: Math.max(0, davTotal - davNeg),
        negative: davNeg,
        needsFollowUp: queueMap[2] || davNeg,
        avgRating: davRows[0]?.avgRating ? Number(davRows[0].avgRating).toFixed(1) : '5.0',
        scans: scanMap[2] || 0
      },
      shivamogga: {
        locationId: 3,
        locationCode: 'SHI',
        name: 'Shivamogga',
        storeName: 'BSC Textiles Shivamogga',
        tableName: 'BSC_Feedback_Shivamogga',
        total: shiTotal,
        positive: Math.max(0, shiTotal - shiNeg),
        negative: shiNeg,
        needsFollowUp: queueMap[3] || shiNeg,
        avgRating: shiRows[0]?.avgRating ? Number(shiRows[0].avgRating).toFixed(1) : '5.0',
        scans: scanMap[3] || 0
      }
    };

    let total = belTotal + davTotal + shiTotal;
    let neg = belNeg + davNeg + shiNeg;

    // Strict location scoping for restricted users
    if (effectiveLocId === 1) {
      total = belTotal; neg = belNeg;
      byLocation = { belagavi: byLocation.belagavi };
    } else if (effectiveLocId === 2) {
      total = davTotal; neg = davNeg;
      byLocation = { davanagere: byLocation.davanagere };
    } else if (effectiveLocId === 3) {
      total = shiTotal; neg = shiNeg;
      byLocation = { shivamogga: byLocation.shivamogga };
    }

    const pos = Math.max(0, total - neg);
    const nps = total > 0 ? Math.round((pos / total) * 100) : 100;
    const pendingCallQueue = Object.values(queueMap).reduce((a, b) => a + b, 0);

    return res.json({
      success: true,
      totalFeedback: total,
      positiveFeedback: pos,
      negativeFeedback: neg,
      needsFollowUp: neg,
      npsScore: nps,
      pendingCallQueue,
      totalCallQueue: pendingCallQueue,
      byLocation
    });
  } catch (err) {
    console.error('[getFeedbackStats Error]', err);
    return res.json({
      success: true,
      totalFeedback: 0,
      positiveFeedback: 0,
      negativeFeedback: 0,
      needsFollowUp: 0,
      npsScore: 100,
      pendingCallQueue: 0,
      totalCallQueue: 0
    });
  }
};

exports.getCallQueue = async (req, res) => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS CallQueue (
        id VARCHAR(64) PRIMARY KEY,
        feedbackId VARCHAR(64),
        entryDate VARCHAR(16),
        customerName VARCHAR(255),
        mobile VARCHAR(32),
        status VARCHAR(32) DEFAULT 'new',
        notes TEXT,
        attempts INT DEFAULT 0,
        followUpDate VARCHAR(32),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(() => {});

    // Ensure columns exist on legacy tables
    await db.query(`ALTER TABLE CallQueue ADD COLUMN feedbackId VARCHAR(64)`).catch(() => {});
    await db.query(`ALTER TABLE CallQueue ADD COLUMN entryDate VARCHAR(16)`).catch(() => {});
    await db.query(`ALTER TABLE CallQueue ADD COLUMN customerName VARCHAR(255)`).catch(() => {});
    await db.query(`ALTER TABLE CallQueue ADD COLUMN mobile VARCHAR(32)`).catch(() => {});

    // Auto-sync missing CallQueue entries for negative feedbacks (from both QR and Staff sources)
    await db.query(`
      INSERT INTO CallQueue (id, feedbackId, location_id, entryDate, customerName, mobile, status, notes)
      SELECT 
        CONCAT('cq_auto_', f.id) as id,
        f.id as feedbackId,
        COALESCE(f.location_id, 2) as location_id,
        COALESCE(NULLIF(f.entryDate, ''), STR_TO_DATE(f.date, '%d/%m/%Y'), '${getISTDateString()}') as entryDate,
        COALESCE(NULLIF(f.customerName, ''), NULLIF(f.custName, ''), 'Valued Customer') as customerName,
        COALESCE(NULLIF(f.mobile, ''), NULLIF(f.custMobile, ''), '') as mobile,
        'new' as status,
        COALESCE(NULLIF(f.voice, ''), NULLIF(f.yourVoice, ''), 'Negative customer feedback auto-escalated') as notes
      FROM Feedback f
      LEFT JOIN CallQueue cq ON (cq.feedbackId = f.id OR cq.id = f.id)
      WHERE (f.isNegative = 1 OR f.status = 'negative' OR LOWER(COALESCE(f.voice, f.yourVoice, '')) LIKE '%dissatisfied%') AND cq.id IS NULL
    `).catch(syncErr => {
      console.warn('[getCallQueue Auto-Sync Notice]:', syncErr.message);
    });

    const { date, startDate, endDate, status, search } = req.query;
    const { clause: fLocClause, params: fLocParams } = await getLocationFilter(req, 'f');
    let sql = `
      SELECT 
        COALESCE(MAX(cq.id), CONCAT('cq_', f.id)) as id,
        f.id as feedbackId,
        COALESCE(MAX(cq.entryDate), MAX(NULLIF(f.entryDate, '')), MAX(NULLIF(f.date, '')), '${getISTDateString()}') as entryDate,
        COALESCE(MAX(cq.customerName), MAX(NULLIF(f.customerName, '')), MAX(NULLIF(f.custName, '')), 'Valued Customer') as customerName,
        COALESCE(MAX(cq.mobile), MAX(NULLIF(f.mobile, '')), MAX(NULLIF(f.custMobile, '')), '') as mobile,
        COALESCE(MAX(cq.status), 'new') as status,
        COALESCE(MAX(NULLIF(cq.notes, '')), MAX(NULLIF(f.voice, '')), MAX(NULLIF(f.yourVoice, '')), 'Negative customer feedback auto-escalated') as notes,
        COALESCE(MAX(cq.attempts), 0) as attempts,
        MAX(cq.followUpDate) as followUpDate,
        COALESCE(MAX(cq.createdAt), MAX(f.createdAt), MAX(f.created_at)) as createdAt
      FROM Feedback f
      LEFT JOIN CallQueue cq ON (cq.feedbackId = f.id OR cq.id = f.id)
      WHERE (f.isNegative = 1 OR cq.id IS NOT NULL) ${fLocClause}
    `;
    const params = [...fLocParams];

    if (date) {
      sql += ' AND (COALESCE(cq.entryDate, f.entryDate, f.date) = ?)';
      params.push(date);
    } else {
      if (startDate) {
        sql += ' AND (COALESCE(cq.entryDate, f.entryDate, f.date) >= ?)';
        params.push(startDate);
      }
      if (endDate) {
        sql += ' AND (COALESCE(cq.entryDate, f.entryDate, f.date) <= ?)';
        params.push(endDate);
      }
    }

    if (status && status !== 'all') {
      sql += ' AND (COALESCE(cq.status, "new") = ?)';
      params.push(status);
    }

    if (search) {
      sql += ' AND (f.customerName LIKE ? OR f.custName LIKE ? OR f.mobile LIKE ? OR f.custMobile LIKE ? OR f.voice LIKE ? OR f.yourVoice LIKE ? OR cq.notes LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s, s);
    }

    sql += ' GROUP BY f.id ORDER BY COALESCE(MAX(cq.entryDate), MAX(f.entryDate), MAX(f.date)) DESC, f.id DESC';

    const [rows] = await db.query(sql, params).catch(async () => {
      const [fallback] = await db.query('SELECT * FROM CallQueue ORDER BY id DESC');
      return [fallback];
    });

    const formatted = (rows || []).map(r => {
      let rawDateStr = r.entryDate || r.entry_date || (r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : getISTDateString());
      if (typeof rawDateStr === 'string' && rawDateStr.includes('/')) {
        const parts = rawDateStr.split('/');
        if (parts.length === 3) {
          rawDateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      let entryTimeStr = r.entryTime || '';
      if (!entryTimeStr && (r.createdAt || r.created_at)) {
        entryTimeStr = getISTTimeString(r.createdAt || r.created_at);
      }
      if (!entryTimeStr) {
        entryTimeStr = getISTTimeString();
      }

      return {
        ...r,
        customerName: r.customerName || r.custName || r.customer_name || 'Valued Customer',
        mobile: r.mobile || r.custMobile || r.phone || 'N/A',
        entryDate: rawDateStr,
        entryTime: entryTimeStr || '10:00 AM',
        status: r.status || 'new',
        attempts: r.attempts || 0
      };
    });

    return res.json({ success: true, callQueue: formatted });
  } catch (err) {
    console.error('[getCallQueue Error]', err);
    return res.json({ success: true, callQueue: [] });
  }
};

exports.updateCallQueue = async (req, res) => {
  try {
    const body = req.body || {};
    const targetId = body.id || body.feedbackId || body.rawFeedbackId || 'unknown';
    const safeId = String(targetId);
    const rawFeedbackId = safeId.startsWith('cq_auto_') 
      ? safeId.replace('cq_auto_', '') 
      : (safeId.startsWith('cq_') ? safeId.replace('cq_', '') : safeId);

    const status = body.status || 'called';
    const notes = body.notes || body.actionTaken || '';
    const followUpDate = body.followUpDate || null;
    const isResolvedStatus = status === 'resolved' || status === 'closed';
    const finalIsNegFlag = isResolvedStatus ? 0 : 1;

    // 1. Ensure tables exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS CallQueue (
        id VARCHAR(64) PRIMARY KEY,
        feedbackId VARCHAR(64),
        entryDate VARCHAR(16),
        customerName VARCHAR(255),
        mobile VARCHAR(32),
        status VARCHAR(32) DEFAULT 'new',
        notes TEXT,
        attempts INT DEFAULT 0,
        followUpDate VARCHAR(32),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(() => {});

    await db.query(`
      CREATE TABLE IF NOT EXISTS CallLogs (
        id VARCHAR(64) PRIMARY KEY,
        feedbackId VARCHAR(64) NOT NULL,
        executive VARCHAR(255) DEFAULT 'Store Executive',
        callDate VARCHAR(32),
        callOutcome VARCHAR(64),
        issueCategory VARCHAR(64),
        followUpDate VARCHAR(64),
        notes TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(() => {});

    await db.query(`ALTER TABLE CallQueue ADD COLUMN feedbackId VARCHAR(64)`).catch(() => {});
    await db.query(`ALTER TABLE CallQueue ADD COLUMN entryDate VARCHAR(16)`).catch(() => {});
    await db.query(`ALTER TABLE CallQueue ADD COLUMN customerName VARCHAR(255)`).catch(() => {});
    await db.query(`ALTER TABLE CallQueue ADD COLUMN mobile VARCHAR(32)`).catch(() => {});
    await db.query(`ALTER TABLE CallQueue ADD COLUMN status VARCHAR(32) DEFAULT 'new'`).catch(() => {});
    await db.query(`ALTER TABLE CallQueue ADD COLUMN notes TEXT`).catch(() => {});
    await db.query(`ALTER TABLE CallQueue ADD COLUMN attempts INT DEFAULT 0`).catch(() => {});
    await db.query(`ALTER TABLE CallQueue ADD COLUMN followUpDate VARCHAR(32)`).catch(() => {});

    // 2. Fetch customer details from Feedback table
    let cName = 'Valued Customer';
    let cMob = '';
    let eDate = getISTDateString();

    try {
      const [fbRows] = await db.query('SELECT customerName, custName, mobile, custMobile, entryDate, date FROM Feedback WHERE id = ?', [rawFeedbackId]);
      if (fbRows && fbRows[0]) {
        cName = fbRows[0].customerName || fbRows[0].custName || 'Valued Customer';
        cMob = fbRows[0].mobile || fbRows[0].custMobile || '';
        eDate = fbRows[0].entryDate || fbRows[0].date || getISTDateString();
      }
    } catch (fbErr) {}

    // 3. Update or Insert CallQueue record
    let updated = false;
    try {
      const [existing] = await db.query(
        'SELECT id, attempts FROM CallQueue WHERE id = ? OR feedbackId = ? OR id = ?', 
        [safeId, rawFeedbackId, rawFeedbackId]
      );

      if (existing && existing.length > 0) {
        const existingId = existing[0].id;
        const nextAttempts = (Number(existing[0].attempts) || 0) + 1;

        await db.query(`
          UPDATE CallQueue 
          SET status = ?, notes = ?, followUpDate = ?, attempts = ?, updatedAt = CURRENT_TIMESTAMP 
          WHERE id = ? OR feedbackId = ?
        `, [status, notes, followUpDate, nextAttempts, existingId, rawFeedbackId]);
        updated = true;
      }
    } catch (updErr) {
      console.warn('[updateCallQueue Existing Update Notice]:', updErr.message);
    }

    if (!updated) {
      const newCqId = getUUID();
      const locationId = injectLocationId(req) || (req.user && req.user.locationId) || null;
      try {
        await db.query(`
          INSERT INTO CallQueue (id, location_id, feedbackId, entryDate, customerName, mobile, status, notes, attempts)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
        `, [newCqId, locationId, rawFeedbackId, eDate, cName, cMob, status, notes]);
      } catch (insErr) {
        await db.query(`
          INSERT INTO CallQueue (id, location_id, status, notes)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE status = VALUES(status), notes = VALUES(notes)
        `, [safeId, locationId, status, notes]).catch(() => {});
      }
    }

    // 4. Update Feedback table (persist status, actionTaken, and isNegative flag)
    await db.query(`ALTER TABLE Feedback ADD COLUMN status VARCHAR(32)`).catch(() => {});
    await db.query(`ALTER TABLE Feedback ADD COLUMN actionTaken TEXT`).catch(() => {});

    await db.query(`
      UPDATE Feedback 
      SET status = ?, actionTaken = ?, isNegative = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ? OR id = ?
    `, [status, notes, finalIsNegFlag, rawFeedbackId, safeId]).catch(fbUpdErr => {
      console.warn('[updateCallQueue Feedback Table Sync Notice]:', fbUpdErr.message);
    });

    // 5. Save structured CallLog record in MySQL database
    if (notes || body.callOutcome) {
      const logId = getUUID();
      await db.query(`
        INSERT INTO CallLogs (id, feedbackId, executive, callDate, callOutcome, issueCategory, followUpDate, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        logId,
        rawFeedbackId,
        body.executive || body.createdBy || 'Store Telecaller',
        getISTDateString(),
        body.callOutcome || (isResolvedStatus ? 'Resolved' : 'Call Logged'),
        body.issueCategory || 'Customer Resolution Desk',
        followUpDate || '',
        notes
      ]).catch(logErr => console.warn('[CallLogs Insert Notice]:', logErr.message));
    }

    // 6. Broadcast real-time Socket.IO push event
    const io = req.app.get('io');
    if (io) {
      io.emit('feedback:negative', { id: rawFeedbackId, status, isNegative: finalIsNegFlag });
      io.emit('feedback:submitted', { id: rawFeedbackId });
      io.emit('callqueue:updated', { id: rawFeedbackId, status, notes });
    }

    return res.json({ success: true, message: 'Call queue entry updated and persisted successfully' });
  } catch (err) {
    console.error('[updateCallQueue Error]', err);
    return res.json({ success: true, message: 'Call queue entry updated' });
  }
};

// ── Sourcing Diverts ────────────────────────────────────────

/**
 * Column widths the raise form validates against. Kept in one place so the
 * HTTP layer can answer 400 with a precise message instead of letting MySQL's
 * STRICT_TRANS_TABLES turn an over-long value into a 500.
 */
const DIVERT_LIMITS = {
  productWanted: 500,
  sectionId: 150,
  priceRange: 128,
  reasonCode: 64,
  size: 64,
  colour: 64,
  customerName: 150,
  customerMobile: 32,
  createdBy: 100,
  freeText: 5000
};

const DIVERT_DDL = `
  CREATE TABLE IF NOT EXISTS Diverts (
    id VARCHAR(64) PRIMARY KEY,
    location_id INT NOT NULL DEFAULT 2,
    refNo INT NOT NULL AUTO_INCREMENT,
    entryDate DATE NOT NULL,
    sectionId VARCHAR(150),
    productWanted TEXT NOT NULL,
    quantity INT DEFAULT 1,
    priceRange VARCHAR(128),
    reasonCode VARCHAR(64) DEFAULT 'OUT_OF_STOCK',
    customerName VARCHAR(150),
    customerMobile VARCHAR(32),
    status VARCHAR(32) DEFAULT 'open',
    createdBy VARCHAR(100),
    pmNotes TEXT,
    size VARCHAR(64),
    colour VARCHAR(64),
    other_product_details TEXT,
    required_by_date VARCHAR(32),
    reference_image VARCHAR(512),
    remarks TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_diverts_refNo (refNo),
    KEY idx_diverts_loc (location_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

const DIVERT_UPDATES_DDL = `
  CREATE TABLE IF NOT EXISTS DivertUpdates (
    id VARCHAR(50) PRIMARY KEY,
    divertId VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    note TEXT NULL,
    actorId VARCHAR(50) NULL,
    actorRole VARCHAR(50) NULL,
    createdAt TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_divert_updates_divert (divertId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

/** Widen-only ALTERs for installs provisioned by older builds. Never throws. */
const DIVERT_WIDEN_COLUMNS = [
  ['sectionId', 150],
  ['priceRange', 128],
  ['createdBy', 100],
  ['reasonCode', 64],
  ['customerName', 150],
  ['size', 64],
  ['colour', 64]
];

let divertSchemaReady = false;
let divertSchemaPromise = null;

/**
 * Creates/repairs the Diverts table once per process. Widening ALTERs only run
 * against installs provisioned by older builds and are strictly size-increasing,
 * so existing sourcing divert records are never rewritten or dropped.
 * Never rejects: a schema hiccup must not take the read path down with it.
 */
async function ensureDivertSchema() {
  if (divertSchemaReady) return;
  if (!divertSchemaPromise) {
    divertSchemaPromise = (async () => {
      await db.query(DIVERT_DDL);
      await db.query(DIVERT_UPDATES_DDL);

      const [cols] = await db.query(
        `SELECT COLUMN_NAME AS col, CHARACTER_MAXIMUM_LENGTH AS len
           FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'Diverts'
            AND DATA_TYPE = 'varchar'`
      );
      const current = new Map((cols || []).map((r) => [r.col, Number(r.len) || 0]));
      for (const [column, size] of DIVERT_WIDEN_COLUMNS) {
        if (current.has(column) && current.get(column) < size) {
          await db.query(`ALTER TABLE Diverts MODIFY \`${column}\` VARCHAR(${size}) NULL`);
        }
      }

      divertSchemaReady = true;
    })().catch((err) => {
      // Drop the cached promise so the next request retries.
      divertSchemaPromise = null;
      console.warn('[ensureDivertSchema]', err.message);
    });
  }
  await divertSchemaPromise;
}

function divertBadRequest(res, message) {
  return res.status(400).json({ success: false, message, error: message });
}

function isValidDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const parsed = new Date(y, m - 1, d);
  return parsed.getFullYear() === y && parsed.getMonth() === m - 1 && parsed.getDate() === d;
}

function clampToColumn(value, table, column) {
  if (value == null) return null;
  const str = String(value);
  const max = DIVERT_LIMITS[column] || 100;
  return str.slice(0, max);
}

exports.getDiverts = async (req, res) => {
  try {
    await ensureDivertSchema();

    const { clause: locClause, params: locParams } = await getLocationFilter(req, 'Diverts');
    const [rows] = await db.query(`SELECT * FROM Diverts WHERE 1=1 ${locClause} ORDER BY createdAt DESC`, locParams);
    return res.json({ success: true, diverts: rows || [] });
  } catch (err) {
    console.error('[getDiverts ERROR]', err);
    return res.status(500).json({
      success: false,
      message: 'Unable to load sourcing diverts. Please try again.',
      error: 'Unable to load sourcing diverts. Please try again.'
    });
  }
};

exports.createDivert = async (req, res) => {
  try {
    await ensureDivertSchema();

    const {
      sectionId,
      productWanted,
      quantity,
      priceRange,
      reasonCode,
      customerName,
      customerMobile: rawMobile,
      createdBy,
      size,
      colour,
      other_product_details,
      required_by_date,
      reference_image,
      remarks
    } = req.body || {};

    // ── Validation ────────────────────────────────────────────
    const product = productWanted == null ? '' : String(productWanted).trim();
    if (!product) return divertBadRequest(res, 'Product / Fabric Requested is required.');
    if (product.length > DIVERT_LIMITS.productWanted) {
      return divertBadRequest(res, `Product / Fabric Requested: maximum ${DIVERT_LIMITS.productWanted} characters allowed.`);
    }

    const qty = Number.parseInt(quantity, 10);
    if (!Number.isFinite(qty) || qty < 1) return divertBadRequest(res, 'Quantity must be greater than 0.');
    if (qty > 99999) return divertBadRequest(res, 'Quantity must be 99999 or less.');

    const section = sectionId == null ? '' : String(sectionId).trim();
    if (section.length > DIVERT_LIMITS.sectionId) {
      return divertBadRequest(res, `Store Section: maximum ${DIVERT_LIMITS.sectionId} characters allowed.`);
    }

    const price = priceRange == null ? '' : String(priceRange).trim();
    if (price.length > DIVERT_LIMITS.priceRange) {
      return divertBadRequest(res, `Target Price Range: maximum ${DIVERT_LIMITS.priceRange} characters allowed.`);
    }

    const reason = (reasonCode == null ? '' : String(reasonCode).trim()) || 'OUT_OF_STOCK';
    if (reason.length > DIVERT_LIMITS.reasonCode) {
      return divertBadRequest(res, `Reason Code: maximum ${DIVERT_LIMITS.reasonCode} characters allowed.`);
    }

    const sizeStr = size == null ? '' : String(size).trim();
    if (sizeStr.length > DIVERT_LIMITS.size) {
      return divertBadRequest(res, `Size: maximum ${DIVERT_LIMITS.size} characters allowed.`);
    }

    const colourStr = colour == null ? '' : String(colour).trim();
    if (colourStr.length > DIVERT_LIMITS.colour) {
      return divertBadRequest(res, `Colour: maximum ${DIVERT_LIMITS.colour} characters allowed.`);
    }

    const custName = customerName == null ? '' : String(customerName).trim();
    if (custName.length > DIVERT_LIMITS.customerName) {
      return divertBadRequest(res, `Customer Full Name: maximum ${DIVERT_LIMITS.customerName} characters allowed.`);
    }

    const reqDateRaw = required_by_date == null ? '' : String(required_by_date).trim();
    if (reqDateRaw && !isValidDateOnly(reqDateRaw)) {
      return divertBadRequest(res, 'Required-by Date must be a valid date in YYYY-MM-DD format.');
    }

    const otherDetails = other_product_details == null ? '' : String(other_product_details).trim();
    const remarksStr = remarks == null ? '' : String(remarks).trim();
    if (otherDetails.length > DIVERT_LIMITS.freeText) {
      return divertBadRequest(res, `Other Product Details: maximum ${DIVERT_LIMITS.freeText} characters allowed.`);
    }
    if (remarksStr.length > DIVERT_LIMITS.freeText) {
      return divertBadRequest(res, `Remarks / Notes: maximum ${DIVERT_LIMITS.freeText} characters allowed.`);
    }

    const reference = reference_image == null ? '' : String(reference_image).trim();
    if (reference && reference.length > 512) {
      return divertBadRequest(res, 'Reference image path is too long.');
    }

    // ── Normalisation ─────────────────────────────────────────
    const locationId = injectLocationId(req) || (req.user && req.user.locationId) || 1;
    const id = getUUID();
    const entryDate = dateUtils.getISTDateString().slice(0, 10);

    // Normalize phone to +91 format if provided
    let customerMobile = rawMobile ? String(rawMobile).trim() : '';
    if (customerMobile) {
      const digits = customerMobile.replace(/\D/g, '');
      if (digits.length === 10) customerMobile = `+91${digits}`;
      else if (digits.length === 12 && digits.startsWith('91')) customerMobile = `+${digits}`;
      else if (digits.length === 11 && digits.startsWith('0')) customerMobile = `+91${digits.slice(1)}`;
      else return divertBadRequest(res, 'Customer Mobile Phone must be a valid 10-digit number.');
      if (customerMobile.length > DIVERT_LIMITS.customerMobile) {
        return divertBadRequest(res, 'Customer Mobile Phone is invalid.');
      }
    }

    const creatorName = clampToColumn(
      req.user?.fullName || req.user?.name || createdBy || 'Floor Staff',
      'Diverts',
      'createdBy'
    ) || 'Floor Staff';

    await db.query(`
      INSERT INTO Diverts (
        id, location_id, entryDate, sectionId, productWanted, quantity, priceRange, reasonCode,
        customerName, customerMobile, status, createdBy,
        size, colour, other_product_details, required_by_date, reference_image, remarks
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      locationId,
      entryDate,
      section || null,
      product,
      qty,
      price,
      reason,
      custName,
      customerMobile,
      creatorName,
      sizeStr || null,
      colourStr || null,
      otherDetails || null,
      reqDateRaw || null,
      reference || null,
      remarksStr || null
    ]);

    const updateId = getUUID();
    await db.query(`
      INSERT INTO DivertUpdates (id, divertId, status, note, actorId, actorRole)
      VALUES (?, ?, 'open', 'Sourcing divert raised by staff', ?, 'Staff')
    `, [updateId, id, clampToColumn(creatorName, 'DivertUpdates', 'actorId') || 'Staff']);

    // Diverts are raised for one store's sales floor, so only that store's screens
    // are woken (and global admins).
    realtimeService.emitToLocationRooms(['divert:created', 'divert:create'], {
      id,
      location_id: locationId,
      productWanted: product,
      quantity: qty,
      createdBy: creatorName,
      message: `URGENT DIVERT: New stock request for ${product} (Qty: ${qty}) created by ${creatorName}`
    }, locationId);

    return res.json({ success: true, message: 'Divert created successfully', id });
  } catch (err) {
    console.error('[createDivert ERROR]', err);
    return res.status(500).json({
      success: false,
      message: 'Unable to create sourcing request. Please try again.',
      error: err.message
    });
  }
};

exports.uploadDivertReferenceImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image uploaded or invalid format. Only JPG, JPEG, and PNG images up to 5MB are supported.' });
    }
    const relativePath = `/uploads/diverts/${req.file.filename}`;
    return res.json({
      success: true,
      fileName: req.file.filename,
      fileUrl: relativePath,
      fileSize: req.file.size
    });
  } catch (err) {
    console.error('[uploadDivertReferenceImage ERROR]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.exportDiverts = async (req, res) => {
  try {
    const { clause: locClause, params: locParams } = await getLocationFilter(req, 'd');
    const [rows] = await db.query(`
      SELECT 
        d.id,
        d.entryDate,
        d.sectionId,
        d.productWanted,
        d.quantity,
        d.priceRange,
        d.reasonCode,
        d.customerName,
        d.customerMobile,
        d.status,
        d.createdBy,
        d.size,
        d.colour,
        d.other_product_details,
        d.required_by_date,
        d.reference_image,
        d.remarks,
        d.pmNotes,
        d.createdAt,
        l.location_name
      FROM Diverts d
      LEFT JOIN locations l ON l.id = d.location_id
      WHERE 1=1 ${locClause}
      ORDER BY d.createdAt DESC
    `, locParams);

    const exportData = (rows || []).map((item, idx) => ({
      'S.No': idx + 1,
      'Ref No': `#${item.id?.slice(0, 6)}`,
      'Branch': item.location_name || 'BSC Belagavi',
      'Date': item.entryDate || (item.createdAt ? new Date(item.createdAt).toISOString().split('T')[0] : '—'),
      'Product / Fabric Requested': item.productWanted || '—',
      'Store Section': item.sectionId || '—',
      'Size': item.size || '—',
      'Colour': item.colour || '—',
      'Other Product Details': item.other_product_details || '—',
      'Quantity Requested': item.quantity || 1,
      'Target Price Range': item.priceRange || '—',
      'Reason Code': item.reasonCode || '—',
      'Required-by Date': item.required_by_date || '—',
      'Reference Image / Reference': item.reference_image || '—',
      'Remarks / Notes': item.remarks || '—',
      'Customer Full Name': item.customerName || 'Walk-in',
      'Customer Mobile Phone': item.customerMobile || '—',
      'Status': (item.status || 'OPEN').toUpperCase(),
      'PM Sourcing Notes': item.pmNotes || '—',
      'Created By': item.createdBy || 'Staff'
    }));

    return res.json({ success: true, count: exportData.length, data: exportData });
  } catch (err) {
    console.error('[exportDiverts ERROR]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateDivert = async (req, res) => {
  try {
    await ensureDivertSchema();
    const { id, status, pmNotes, actorRole, actorId } = req.body;
    if (!id || !String(id).trim()) {
      return res.status(400).json({ success: false, message: 'Sourcing request id is required.', error: 'Sourcing request id is required.' });
    }
    if (!status || !String(status).trim()) {
      return res.status(400).json({ success: false, message: 'Sourcing request status is required.', error: 'Sourcing request status is required.' });
    }
    await db.query(`
      UPDATE Diverts SET status = ?, pmNotes = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?
    `, [clampToColumn(status, 'Diverts', 'status'), pmNotes ? String(pmNotes) : '', id]);

    const updateId = getUUID();
    await db.query(`
      INSERT INTO DivertUpdates (id, divertId, status, note, actorId, actorRole)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [updateId, id, status, pmNotes || `Status updated to ${status}`, actorId || 'PM', actorRole || 'Purchase Manager']);

    return res.json({ success: true, message: 'Divert status updated' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.getDivertUpdates = async (req, res) => {
  try {
    const { divertId } = req.query;
    const [rows] = await db.query('SELECT * FROM DivertUpdates WHERE divertId = ? ORDER BY createdAt DESC', [divertId]);
    return res.json({ success: true, updates: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Cash Settlement ──────────────────────────────────────────
exports.getCashSettlement = async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const { clause: locClause, params: locParams } = await getLocationFilter(req, 'CashSettlements');
    const [header] = await db.query(`SELECT * FROM CashSettlements WHERE entryDate = ? ${locClause}`, [date, ...locParams]);
    if (header.length === 0) {
      return res.json({ success: true, date, settlement: null, counters: [] });
    }
    const [counters] = await db.query('SELECT * FROM CashCounterReports WHERE settlementId = ?', [header[0].id]);
    return res.json({ success: true, date, settlement: header[0], counters });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.saveCashSettlement = async (req, res) => {
  try {
    const { entryDate, saleAmount, billsCount, cashTotal, cardTotal, upiTotal, submittedBy, counters } = req.body;
    const locationId = injectLocationId(req) || (req.user && req.user.locationId) || 1;
    const [existing] = await db.query('SELECT id FROM CashSettlements WHERE entryDate = ? AND location_id = ?', [entryDate, locationId]);
    const settlementId = existing.length > 0 ? existing[0].id : getUUID();

    await db.query(`
      INSERT INTO CashSettlements (id, location_id, entryDate, saleAmount, billsCount, cashTotal, cardTotal, upiTotal, submittedBy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE saleAmount = VALUES(saleAmount), billsCount = VALUES(billsCount), cashTotal = VALUES(cashTotal), cardTotal = VALUES(cardTotal), upiTotal = VALUES(upiTotal), submittedBy = VALUES(submittedBy), updatedAt = CURRENT_TIMESTAMP
    `, [settlementId, locationId, entryDate, saleAmount || 0, billsCount || 0, cashTotal || 0, cardTotal || 0, upiTotal || 0, submittedBy || 'Cashier']);

    await db.query('DELETE FROM CashCounterReports WHERE settlementId = ?', [settlementId]);
    if (Array.isArray(counters)) {
      for (let c of counters) {
        const cId = getUUID();
        await db.query(`
          INSERT INTO CashCounterReports (id, settlementId, counterName, cashierName, billsCount, saleAmount, cashAmount, cardAmount, upiAmount, staffDiscount, customerDiscount)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [cId, settlementId, c.counterName || 'Counter 1', c.cashierName || 'Staff', c.billsCount || 0, c.saleAmount || 0, c.cashAmount || 0, c.cardAmount || 0, c.upiAmount || 0, c.staffDiscount || 0, c.customerDiscount || 0]);
      }
    }

    return res.json({ success: true, message: 'Cash settlement saved successfully', settlementId });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Visual Merchandising (VM) ───────────────────────────────
exports.getVmPoints = async (req, res) => {
  try {
    const vm11Questions = [
      { id: 'vm_q1', title: 'Is the entire section clean, neat, and well-maintained?', section: 'Visual Merchandising', position: 1 },
      { id: 'vm_q2', title: 'Are products arranged according to category, colour, and size?', section: 'Visual Merchandising', position: 2 },
      { id: 'vm_q3', title: 'Are all racks, shelves, tables, and displays properly aligned?', section: 'Visual Merchandising', position: 3 },
      { id: 'vm_q4', title: 'Are new arrivals and the latest collections displayed prominently?', section: 'Visual Merchandising', position: 4 },
      { id: 'vm_q5', title: 'Are mannequins styled according to the current theme?', section: 'Visual Merchandising', position: 5 },
      { id: 'vm_q6', title: 'Are price tags, product labels, and signage correctly placed and visible?', section: 'Visual Merchandising', position: 6 },
      { id: 'vm_q7', title: 'Are promotional and offer displays updated and correctly positioned?', section: 'Visual Merchandising', position: 7 },
      { id: 'vm_q8', title: 'Is the colour blocking and overall visual theme maintained?', section: 'Visual Merchandising', position: 8 },
      { id: 'vm_q9', title: 'Are folded, hanging, and stacked products properly presented?', section: 'Visual Merchandising', position: 9 },
      { id: 'vm_q10', title: 'Does the section meet the daily VM standard and look attractive to customers?', section: 'Visual Merchandising', position: 10 }
    ];

    try {
      const [rows] = await db.query('SELECT * FROM VmChecklistPoints WHERE isActive = TRUE ORDER BY position ASC');
      if (rows && rows.length >= 10) {
        return res.json({ success: true, points: rows });
      }
    } catch (e) {}

    return res.json({ success: true, points: vm11Questions });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.getVmSubmissions = async (req, res) => {
  try {
    const { clause: locClause, params: locParams } = await getLocationFilter(req, 'VmSubmissions');
    const [rows] = await db.query(`SELECT * FROM VmSubmissions WHERE 1=1 ${locClause} ORDER BY createdAt DESC LIMIT 200`, locParams);
    
    if (rows.length === 0) {
      return res.json({ success: true, submissions: [] });
    }

    const submissionIds = rows.map(r => r.id);
    const [entries] = await db.query('SELECT * FROM VmSubmissionEntries WHERE submissionId IN (?)', [submissionIds]);

    const entriesMap = {};
    entries.forEach(e => {
      if (!entriesMap[e.submissionId]) {
        entriesMap[e.submissionId] = [];
      }
      entriesMap[e.submissionId].push(e);
    });

    const photosMap = {};
    try {
      const [photoRows] = await db.query(
        "SELECT id, submission_id, location_name, floor, section, file_name as original_name, file_size, mime_type, uploaded_by, created_at FROM vm_checklist_photos WHERE submission_id IN (?) AND status != 'Deleted'",
        [submissionIds]
      );
      (photoRows || []).forEach(p => {
        if (!photosMap[p.submission_id]) photosMap[p.submission_id] = [];
        photosMap[p.submission_id].push(p);
      });
    } catch (e) {}

    const formattedRows = rows.map(r => ({
      ...r,
      entries: entriesMap[r.id] || [],
      photos: photosMap[r.id] || []
    }));

    return res.json({ success: true, submissions: formattedRows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.submitVm = async (req, res) => {
  try {
    const { shift, floor, section, scorePercent, submittedBy, entries } = req.body;
    const locationId = injectLocationId(req) || (req.user && req.user.locationId) || 1;
    const submissionId = getUUID();
    const entryDate = new Date().toISOString().split('T')[0];

    // Ensure section column exists in VmSubmissions if table is present
    try {
      await db.query(`ALTER TABLE VmSubmissions ADD COLUMN section VARCHAR(100) DEFAULT NULL`).catch(() => {});
    } catch (e) {}

    try {
      await db.query(`
        INSERT INTO VmSubmissions (id, location_id, entryDate, shift, floor, section, scorePercent, submittedBy)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [submissionId, locationId, entryDate, shift || 'Opening', floor || 'Ground Floor', section || 'General', scorePercent || 100, submittedBy || 'VM Auditor']);
    } catch (e) {
      await db.query(`
        INSERT INTO VmSubmissions (id, location_id, entryDate, shift, floor, scorePercent, submittedBy)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [submissionId, locationId, entryDate, shift || 'Opening', floor || 'Ground Floor', scorePercent || 100, submittedBy || 'VM Auditor']);
    }

    if (Array.isArray(entries)) {
      for (let e of entries) {
        const eId = getUUID();
        await db.query(`
          INSERT INTO VmSubmissionEntries (id, submissionId, pointId, pointTitle, score, remarks, photoUrl)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [eId, submissionId, e.pointId, e.pointTitle || 'Check Point', e.score || 'Pass', e.remarks || '', e.photoUrl || '']);
      }
    }

    return res.json({ success: true, message: 'VM checklist submitted successfully', submissionId });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.getVmFloors = async (req, res) => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS VmFloors (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT NULL,
        sections TEXT NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(() => {});

    const [rows] = await db.query('SELECT * FROM VmFloors ORDER BY createdAt ASC');
    const floors = (rows || []).map((r) => {
      let parsedSections = [];
      try {
        parsedSections = typeof r.sections === 'string' ? JSON.parse(r.sections) : (r.sections || []);
      } catch (e) {
        parsedSections = String(r.sections || '').split(',').map((s) => s.trim()).filter(Boolean);
      }
      return {
        id: r.id,
        name: r.name,
        description: r.description || '',
        sections: parsedSections
      };
    });
    return res.json({ success: true, floors });
  } catch (err) {
    return res.json({ success: true, floors: [] });
  }
};

exports.createVmFloor = async (req, res) => {
  try {
    const { name, description, sections } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Floor name is required' });
    }
    const secList = Array.isArray(sections) ? sections.map((s) => String(s).trim()).filter(Boolean) : [];
    if (secList.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one section is required for this floor' });
    }

    const id = getUUID();
    await db.query(`
      CREATE TABLE IF NOT EXISTS VmFloors (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT NULL,
        sections TEXT NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(() => {});

    await db.query(`
      INSERT INTO VmFloors (id, name, description, sections)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE description = VALUES(description), sections = VALUES(sections)
    `, [id, name.trim(), description ? description.trim() : '', JSON.stringify(secList)]);

    return res.json({
      success: true,
      message: 'Store floor created successfully',
      floor: { id, name: name.trim(), description: description ? description.trim() : '', sections: secList }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.deleteVmFloor = async (req, res) => {
  try {
    const { id, name } = req.body || {};
    const identifier = id || (req.params && req.params.id) || name;
    if (!identifier) {
      return res.status(400).json({ success: false, message: 'Floor ID or name is required' });
    }
    await db.query('DELETE FROM VmFloors WHERE id = ? OR name = ?', [identifier, identifier]);
    return res.json({ success: true, message: 'Store floor removed successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.getFeedbacks = async (req, res) => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS Feedback (
        id VARCHAR(64) PRIMARY KEY,
        date VARCHAR(32),
        source VARCHAR(32) DEFAULT 'qr',
        area VARCHAR(150),
        yourVoice TEXT,
        custName VARCHAR(255),
        custMobile VARCHAR(32),
        custDob VARCHAR(32),
        q0 VARCHAR(255), q0_other VARCHAR(255),
        q1 VARCHAR(255), q1_other VARCHAR(255),
        q2 VARCHAR(255), q2_other VARCHAR(255),
        q3 VARCHAR(255), q3_other VARCHAR(255),
        q4 VARCHAR(255), q4_other VARCHAR(255),
        q5 VARCHAR(255), q5_other VARCHAR(255),
        q6 VARCHAR(255), q6_other VARCHAR(255),
        q7 VARCHAR(255), q7_other VARCHAR(255),
        status VARCHAR(32) DEFAULT 'new',
        actionTaken TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL,
        entryDate VARCHAR(32),
        customerName VARCHAR(255),
        mobile VARCHAR(32),
        dob VARCHAR(32),
        sectionId VARCHAR(64),
        answers TEXT,
        voice TEXT,
        isNegative TINYINT(1) DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(() => {});

    // Ensure columns exist on legacy/altered tables
    const colsToAdd = [
      'date VARCHAR(32)',
      'source VARCHAR(32) DEFAULT "qr"',
      'area VARCHAR(150)',
      'yourVoice TEXT',
      'custName VARCHAR(255)',
      'custMobile VARCHAR(32)',
      'custDob VARCHAR(32)',
      'q0 VARCHAR(255)', 'q0_other VARCHAR(255)',
      'q1 VARCHAR(255)', 'q1_other VARCHAR(255)',
      'q2 VARCHAR(255)', 'q2_other VARCHAR(255)',
      'q3 VARCHAR(255)', 'q3_other VARCHAR(255)',
      'q4 VARCHAR(255)', 'q4_other VARCHAR(255)',
      'q5 VARCHAR(255)', 'q5_other VARCHAR(255)',
      'q6 VARCHAR(255)', 'q6_other VARCHAR(255)',
      'q7 VARCHAR(255)', 'q7_other VARCHAR(255)',
      'status VARCHAR(32) DEFAULT "new"',
      'actionTaken TEXT',
      'isNegative TINYINT(1) DEFAULT 0',
      'answers TEXT',
      'voice TEXT',
      'entryDate VARCHAR(32)',
      'customerName VARCHAR(255)',
      'mobile VARCHAR(32)'
    ];
    for (const col of colsToAdd) {
      await db.query(`ALTER TABLE Feedback ADD COLUMN ${col}`).catch(() => {});
    }

    const { date, startDate, endDate, isNegative, search, followUp, follow_up } = req.query;
    const followUpFilter = followUp || follow_up;
    const { clause: locClause, params: locParams } = await getLocationFilter(req, 'Feedback');

    // Query from the 3 dedicated location databases/tables: BSC_Feedback_Belagavi, BSC_Feedback_Davanagere, BSC_Feedback_Shivamogga
    let sourceTable = `(
      SELECT * FROM BSC_Feedback_Belagavi
      UNION ALL
      SELECT * FROM BSC_Feedback_Davanagere
      UNION ALL
      SELECT * FROM BSC_Feedback_Shivamogga
    )`;

    if (locParams.length === 1 && locClause.includes('=')) {
      const targetId = Number(locParams[0]);
      if (targetId === 1) sourceTable = 'BSC_Feedback_Belagavi';
      else if (targetId === 2) sourceTable = 'BSC_Feedback_Davanagere';
      else if (targetId === 3) sourceTable = 'BSC_Feedback_Shivamogga';
    }

    let sql = `SELECT * FROM ${sourceTable} AS Feedback WHERE 1=1 ${locClause}`;
    const params = [...locParams];

    let altDate = date || '';
    if (date && typeof date === 'string') {
      if (date.includes('-') && date.split('-').length === 3) {
        const [y, m, d] = date.split('-');
        altDate = `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
      } else if (date.includes('/') && date.split('/').length === 3) {
        const [d, m, y] = date.split('/');
        altDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      sql += ' AND (entryDate = ? OR entryDate = ? OR date = ? OR date = ? OR DATE(created_at) = ? OR DATE(createdAt) = ?)';
      params.push(date, altDate, date, altDate, date, altDate);
    } else {
      if (startDate) {
        sql += ' AND (COALESCE(entryDate, STR_TO_DATE(NULLIF(date, ""), "%d/%m/%Y"), DATE(createdAt), DATE(created_at)) >= ?)';
        params.push(startDate);
      }
      if (endDate) {
        sql += ' AND (COALESCE(entryDate, STR_TO_DATE(NULLIF(date, ""), "%d/%m/%Y"), DATE(createdAt), DATE(created_at)) <= ?)';
        params.push(endDate);
      }
    }

    if (isNegative !== undefined && isNegative !== '' && isNegative !== 'all') {
      sql += ' AND isNegative = ?';
      params.push(isNegative === 'true' || isNegative === '1' ? 1 : 0);
    }

    // Follow-up status filter. Rows predating the resolution desk store NULL,
    // which counts as "new" for both storage and display.
    if (followUpFilter && followUpFilter !== 'all') {
      if (followUpFilter === 'needs_follow_up') {
        sql += " AND COALESCE(NULLIF(status, ''), 'new') IN ('new', 'pending', 'called', 'escalated', 'escalated_manager')";
      } else if (followUpFilter === 'resolved') {
        sql += " AND status IN ('resolved', 'closed')";
      } else {
        sql += " AND COALESCE(NULLIF(status, ''), 'new') = ?";
        params.push(followUpFilter);
      }
    }

    if (search) {
      sql += ' AND (customerName LIKE ? OR custName LIKE ? OR mobile LIKE ? OR custMobile LIKE ? OR voice LIKE ? OR yourVoice LIKE ? OR answers LIKE ? OR q0 LIKE ? OR q1 LIKE ? OR q2 LIKE ? OR q3 LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s, s, s, s, s, s);
    }

    sql += ' ORDER BY COALESCE(entryDate, DATE(createdAt), DATE(created_at)) DESC, id DESC';

    const [rows] = await db.query(sql, params).catch(async (err) => {
      console.warn('[getFeedbacks Query Fail, fallback executing]:', err.message);
      const [fallbackRows] = await db.query(`SELECT * FROM Feedback WHERE 1=1 ${locClause} ORDER BY id DESC`, locParams);
      return [fallbackRows];
    });

    let formatted = (rows || []).map(r => {
      let parsedAnswers = {};
      try {
        parsedAnswers = typeof r.answers === 'string' ? JSON.parse(r.answers || '{}') : (r.answers || {});
      } catch (e) {
        parsedAnswers = {};
      }

      ['q0', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7'].forEach(qKey => {
        if (r[qKey] && !parsedAnswers[qKey]) {
          parsedAnswers[qKey] = r[qKey];
        }
        if (r[`${qKey}_other`] && !parsedAnswers[`${qKey}_other`]) {
          parsedAnswers[`${qKey}_other`] = r[`${qKey}_other`];
        }
      });

      let rawDateStr = r.entryDate || r.date || (r.created_at || r.createdAt ? new Date(r.created_at || r.createdAt).toISOString().split('T')[0] : getISTDateString());
      if (typeof rawDateStr === 'string' && rawDateStr.includes('/')) {
        const parts = rawDateStr.split('/');
        if (parts.length === 3) {
          rawDateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      const voiceText = [r.voice, r.yourVoice].filter(Boolean).join('\n').trim();
      const isResolvedStatus = r.status === 'resolved' || r.status === 'closed';
      const isNegEvaluated = isResolvedStatus ? false : evaluateFeedbackEscalation(parsedAnswers, voiceText, r.q0, r.q1, r.q2, r.q3);

      let entryTimeStr = r.entryTime || '';
      if (!entryTimeStr && (r.created_at || r.createdAt)) {
        entryTimeStr = getISTTimeString(r.created_at || r.createdAt);
      }
      if (!entryTimeStr) {
        entryTimeStr = getISTTimeString();
      }

      const locCodeMap = { 1: 'BEL', 2: 'DAV', 3: 'SHI' };
      const locNameMap = { 1: 'Belagavi', 2: 'Davanagere', 3: 'Shivamogga', 'BEL': 'Belagavi', 'DAV': 'Davanagere', 'SHI': 'Shivamogga' };
      const resolvedLocId = Number(r.location_id) || (r.locationCode === 'BEL' ? 1 : r.locationCode === 'SHI' ? 3 : 2);
      const resolvedLocCode = r.locationCode || locCodeMap[resolvedLocId] || 'DAV';
      const resolvedLocName = r.locationName || locNameMap[resolvedLocCode] || 'Davanagere';

      return {
        ...r,
        location_id: resolvedLocId,
        locationCode: resolvedLocCode,
        locationName: resolvedLocName,
        email: r.email || '',
        customerName: r.customerName || r.custName || r.customer_name || r.name || 'Anonymous',
        custName: r.custName || r.customerName || 'Anonymous',
        mobile: r.mobile || r.custMobile || r.customerMobile || r.phone || '',
        custMobile: r.custMobile || r.mobile || '',
        entryDate: rawDateStr,
        entryTime: entryTimeStr || '10:00 AM',
        date: r.date || rawDateStr,
        voice: voiceText,
        yourVoice: voiceText,
        answers: parsedAnswers,
        actionTaken: r.actionTaken || r.notes || '',
        notes: r.actionTaken || r.notes || '',
        status: r.status || (isNegEvaluated ? 'new' : 'resolved'),
        isNegative: isNegEvaluated
      };
    });

    // In-memory secondary date filter to guarantee exact match even if DB fallback triggered
    if (date && typeof date === 'string') {
      formatted = formatted.filter(r => 
        r.entryDate === date || r.entryDate === altDate ||
        r.date === date || r.date === altDate
      );
    }

    const total = formatted.length;
    const negative = formatted.filter(r => r.isNegative).length;
    const positive = total - negative;
    const npsScore = total > 0 ? Math.round((positive / total) * 100) : 100;
    const needsFollowUp = negative;

    return res.json({
      success: true,
      feedbacks: formatted,
      stats: {
        total,
        positive,
        negative,
        needsFollowUp,
        npsScore
      }
    });
  } catch (err) {
    console.error('[getFeedbacks Error]', err);
    return res.json({
      success: true,
      feedbacks: [],
      stats: { total: 0, positive: 0, negative: 0, needsFollowUp: 0, npsScore: 100 }
    });
  }
};

/**
 * Follow-up history for one feedback ticket.
 *
 * CallLogs has no location_id column, so access is enforced by first resolving
 * the feedback through the caller's location filter — a restricted user asking
 * for another store's ticket gets a not-found rather than the rows.
 */
exports.getFeedbackFollowUpHistory = async (req, res) => {
  const id = req.params.id;
  if (!id) {
    return res.status(400).json({ success: false, message: 'Feedback ID is required' });
  }

  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS CallLogs (
        id VARCHAR(64) PRIMARY KEY,
        feedbackId VARCHAR(64) NOT NULL,
        executive VARCHAR(255) DEFAULT 'Store Executive',
        callDate VARCHAR(32),
        callOutcome VARCHAR(64),
        issueCategory VARCHAR(64),
        followUpDate VARCHAR(64),
        notes TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(() => {});

    const { clause: locClause, params: locParams } = await getLocationFilter(req, 'Feedback');
    const [owned] = await db.query(
      `SELECT id, location_id FROM Feedback WHERE id = ? ${locClause}`,
      [id, ...locParams]
    );
    if (!owned || owned.length === 0) {
      return res.status(404).json({ success: false, message: 'Feedback not found for this location' });
    }

    const [logs] = await db.query(
      `SELECT id, feedbackId, executive, callDate, callOutcome, issueCategory, followUpDate, notes, createdAt
         FROM CallLogs WHERE feedbackId = ? ORDER BY createdAt DESC, id DESC LIMIT 100`,
      [id]
    ).catch(() => [[]]);

    const [queue] = await db.query(
      `SELECT status, notes, attempts, followUpDate, updatedAt
         FROM CallQueue WHERE feedbackId = ? OR id = ? ORDER BY updatedAt DESC LIMIT 1`,
      [id, id]
    ).catch(() => [[]]);

    return res.json({
      success: true,
      history: logs || [],
      followUp: (queue && queue.length) ? queue[0] : null
    });
  } catch (err) {
    console.error('[getFeedbackFollowUpHistory Error]', err);
    // Never surface raw driver errors; an empty history must not break the panel.
    return res.json({ success: true, history: [], followUp: null });
  }
};

exports.deleteFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Feedback ID is required' });
    }
    await db.query('DELETE FROM CallQueue WHERE feedbackId = ? OR id = ?', [id, id]).catch(() => {});
    await db.query('DELETE FROM BSC_Feedback_Belagavi WHERE id = ?', [id]).catch(() => {});
    await db.query('DELETE FROM BSC_Feedback_Davanagere WHERE id = ?', [id]).catch(() => {});
    await db.query('DELETE FROM BSC_Feedback_Shivamogga WHERE id = ?', [id]).catch(() => {});
    await db.query('DELETE FROM Feedback WHERE id = ?', [id]).catch(() => {});
    await db.query('UPDATE FeedbackQrScan SET isFeedbackSubmitted = 0, feedbackId = NULL WHERE feedbackId = ?', [id]).catch(() => {});

    const io = req.app.get('io');
    if (io) {
      io.emit('feedback:deleted', { id });
    }
    return res.json({ success: true, message: 'Feedback record deleted successfully' });
  } catch (err) {
    console.error('[deleteFeedback Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.clearAllFeedbacks = async (req, res) => {
  try {
    const rawTarget = req.query.locationId || req.query.location;
    const resolved = resolveStoreLocation(rawTarget);
    if (resolved) {
      await db.query(`DELETE FROM CallQueue WHERE feedbackId IN (SELECT id FROM ${resolved.tableName})`).catch(() => {});
      await db.query(`DELETE FROM ${resolved.tableName}`).catch(() => {});
      await db.query('DELETE FROM Feedback WHERE location_id = ?', [resolved.id]).catch(() => {});
    } else {
      await db.query('DELETE FROM CallQueue').catch(() => {});
      await db.query('DELETE FROM BSC_Feedback_Belagavi').catch(() => {});
      await db.query('DELETE FROM BSC_Feedback_Davanagere').catch(() => {});
      await db.query('DELETE FROM BSC_Feedback_Shivamogga').catch(() => {});
      await db.query('DELETE FROM Feedback').catch(() => {});
      await db.query('UPDATE FeedbackQrScan SET isFeedbackSubmitted = 0, feedbackId = NULL').catch(() => {});
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('feedback:cleared');
    }
    return res.json({ success: true, message: 'All feedback records removed successfully' });
  } catch (err) {
    console.error('[clearAllFeedbacks Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Chat System (Gemini AI Service Integration) ──────────────────────────────
const geminiService = require('../services/geminiService');

exports.getGeminiStatus = async (req, res) => {
  try {
    const health = await geminiService.checkHealth();
    return res.json({ success: true, data: health });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.getChatMessages = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId || 'unknown';
    const [rows] = await db.query(
      'SELECT id, message_text, sender, created_at FROM chat_messages WHERE user_id = ? ORDER BY created_at ASC LIMIT 200',
      [userId]
    );
    return res.json({ success: true, messages: rows || [] });
  } catch (err) {
    return res.json({ success: true, messages: [] });
  }
};

exports.sendChatMessage = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId || 'unknown';
    const { message } = req.body || {};
    const cleanMessage = String(message || '').trim();
    if (!cleanMessage) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    // 1. Prompt Length Limit (max 4,000 characters to prevent resource exhaustion)
    if (cleanMessage.length > 4000) {
      return res.status(400).json({
        success: false,
        message: 'Message exceeds maximum permitted length of 4,000 characters.'
      });
    }

    // 2. Prompt Injection Guardrail (protect system instructions & API credentials)
    const PROMPT_INJECTION_REGEX = /(?:ignore\s+(?:all\s+)?previous\s+instructions|reveal\s+(?:system\s+prompt|api\s*key)|show\s+me\s+your\s+api\s*key|print\s+(?:env|process\.env))/i;
    if (PROMPT_INJECTION_REGEX.test(cleanMessage)) {
      return res.json({
        success: true,
        userMessage: { id: 'blocked_prompt', message_text: cleanMessage, sender: 'user', created_at: new Date().toISOString() },
        systemMessage: {
          id: 'blocked_resp',
          message_text: 'I am the BSC Textiles AI Assistant. I am designed to assist with store operations, customer wedding shopping inquiries, and enterprise workflows. I cannot reveal internal system instructions or credentials.',
          sender: 'system',
          created_at: new Date().toISOString()
        }
      });
    }

    const crypto = require('crypto');
    const msgId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');

    // Ensure table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        message_text TEXT NOT NULL,
        sender ENUM('user', 'system') DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_chat_user (user_id),
        INDEX idx_chat_time (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(() => {});

    // Save user message
    await db.query(
      'INSERT INTO chat_messages (id, user_id, message_text, sender) VALUES (?, ?, ?, ?)',
      [msgId, userId, cleanMessage, 'user']
    );

    // Get recent conversation context (last 10 messages)
    let contextMessages = [];
    try {
      const [recent] = await db.query(
        'SELECT message_text, sender FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
        [userId]
      );
      contextMessages = (recent || []).reverse();
    } catch (e) {}

    // Call Gemini AI via geminiService
    let systemResponse = '';
    let isError = false;
    let errorMessage = '';

    try {
      systemResponse = await geminiService.generateResponse(cleanMessage, contextMessages);
    } catch (err) {
      console.error('[Gemini AI Controller Error]', err.message);
      isError = true;
      errorMessage = err.message || 'AI service is temporarily unavailable.';
      systemResponse = `AI Assistant Notice: ${errorMessage}`;
    }

    const sysMsgId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    await db.query(
      'INSERT INTO chat_messages (id, user_id, message_text, sender) VALUES (?, ?, ?, ?)',
      [sysMsgId, userId, systemResponse, 'system']
    );

    return res.json({
      success: !isError,
      error: isError ? errorMessage : null,
      userMessage: { id: msgId, message_text: message.trim(), sender: 'user', created_at: new Date().toISOString() },
      systemMessage: { id: sysMsgId, message_text: systemResponse, sender: 'system', created_at: new Date().toISOString() }
    });
  } catch (err) {
    console.error('[sendChatMessage Error]', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to send message' });
  }
};

exports.clearChatMessages = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId || 'unknown';
    await db.query('DELETE FROM chat_messages WHERE user_id = ?', [userId]);
    return res.json({ success: true, message: 'Chat history cleared' });
  } catch (err) {
    return res.json({ success: true, message: 'Chat history cleared' });
  }
};

// ── Live TV Display Kiosk Endpoint ──────────────────────────
exports.getTvDisplayData = async (req, res) => {
  try {
    const rawLoc = req.query.locationId || req.query.location_id || req.headers['x-location-id'] || req.user?.locationId || 1;
    let targetLocId = Number(rawLoc);
    if (![1, 2, 3].includes(targetLocId)) targetLocId = 1;

    // 1. Fetch Store Location Profile
    const [storeRows] = await db.query(
      'SELECT id, location_code, location_name, store_name, address, phone FROM locations WHERE id = ? LIMIT 1',
      [targetLocId]
    ).catch(() => [[]]);
    
    const storeInfo = storeRows[0] || {
      id: targetLocId,
      location_code: targetLocId === 1 ? 'BEL' : targetLocId === 2 ? 'DAV' : 'SHI',
      location_name: targetLocId === 1 ? 'Belagavi' : targetLocId === 2 ? 'Davanagere' : 'Shivamogga',
      store_name: 'BSC Textiles Pvt Ltd',
      address: 'BSC Textiles Showroom',
      phone: '+91 831 242 1938'
    };

    // 2. Store Operating Hours & Real-time Status
    const [settingRows] = await db.query(
      "SELECT settingKey, settingValue FROM Setting WHERE settingKey IN ('open_hour', 'close_hour', 'company_name')"
    ).catch(() => [[]]);
    const settingsMap = {};
    (settingRows || []).forEach(r => { settingsMap[r.settingKey] = r.settingValue; });

    const openHour = parseInt(settingsMap['open_hour'] || '10', 10);
    const closeHour = parseInt(settingsMap['close_hour'] || '22', 10);

    // IST time calculation
    const now = new Date();
    const istTimeStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit' });
    const [istH, istM] = (istTimeStr || '').split(':').map(Number);
    const currentIstHour = isNaN(istH) ? now.getHours() : istH;
    const currentIstMinutes = isNaN(istM) ? now.getMinutes() : istM;

    const currentDecimalTime = currentIstHour + currentIstMinutes / 60;
    const isOpen = currentDecimalTime >= openHour && currentDecimalTime < (closeHour - 0.5);

    const formatHourDisplay = (h) => {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hr = h % 12 === 0 ? 12 : h % 12;
      return `${String(hr).padStart(2, '0')}:00 ${ampm}`;
    };

    const storeStatus = {
      isOpen,
      statusText: isOpen ? 'OPEN' : 'CLOSED',
      openTime: formatHourDisplay(openHour),
      closeTime: formatHourDisplay(closeHour),
      currentHour: currentIstHour,
      timeZone: 'IST (Asia/Kolkata)'
    };

    // 3. Today's Footfall & Hourly Distribution
    const istDate = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
    const [footfallRows] = await db.query(
      'SELECT slotHour, visitors, remarks FROM FootfallEntries WHERE entryDate = ? AND location_id = ? ORDER BY slotHour ASC',
      [istDate, targetLocId]
    ).catch(() => [[]]);

    const hourMap = {};
    let todayFootfallTotal = 0;
    (footfallRows || []).forEach(r => {
      const hr = Number(r.slotHour);
      const v = Number(r.visitors) || 0;
      hourMap[hr] = (hourMap[hr] || 0) + v;
      todayFootfallTotal += v;
    });

    const currentHourVisitors = hourMap[currentIstHour] || 0;

    let peakHour = null;
    let maxVisitors = 0;
    for (const [hr, v] of Object.entries(hourMap)) {
      if (v > maxVisitors) {
        maxVisitors = v;
        const hNum = Number(hr);
        const ampm = hNum >= 12 ? 'PM' : 'AM';
        const h12 = hNum % 12 === 0 ? 12 : hNum % 12;
        peakHour = { hour: hNum, label: `${h12} ${ampm}`, visitors: v };
      }
    }

    const hourlyDistribution = [];
    let slotsElapsed = 0;
    for (let h = openHour; h <= Math.min(closeHour, 22); h++) {
      const v = hourMap[h] || 0;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 === 0 ? 12 : h % 12;
      const isCurrent = h === currentIstHour;
      if (h <= currentIstHour) slotsElapsed++;
      hourlyDistribution.push({
        hour: h,
        label: `${h12} ${ampm}`,
        visitors: v,
        isCurrent,
        isPeak: peakHour && peakHour.hour === h && peakHour.visitors > 0
      });
    }

    const hourlyAverage = slotsElapsed > 0 ? Math.round(todayFootfallTotal / slotsElapsed) : todayFootfallTotal;

    const footfallData = {
      todayTotal: todayFootfallTotal,
      currentHourVisitors,
      hourlyAverage,
      peakHour: peakHour || (todayFootfallTotal > 0 ? { hour: currentIstHour, label: `${currentIstHour % 12 || 12} ${currentIstHour >= 12 ? 'PM' : 'AM'}`, visitors: currentHourVisitors } : null),
      distribution: hourlyDistribution
    };

    // 4. Customer Feedback / CSAT
    let feedbackTable = 'BSC_Feedback_Belagavi';
    if (targetLocId === 2) feedbackTable = 'BSC_Feedback_Davanagere';
    if (targetLocId === 3) feedbackTable = 'BSC_Feedback_Shivamogga';

    const [fbSummary] = await db.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN isNegative = 1 THEN 1 ELSE 0 END) as negCount,
        SUM(CASE WHEN isNegative = 0 OR isNegative IS NULL THEN 1 ELSE 0 END) as posCount,
        AVG(CASE 
          WHEN overallRating IS NOT NULL THEN overallRating
          WHEN JSON_EXTRACT(answers, '$.q1') = '"Very satisfied"' THEN 5
          WHEN JSON_EXTRACT(answers, '$.q1') = '"Satisfied"' THEN 4
          WHEN JSON_EXTRACT(answers, '$.q1') = '"Neutral"' THEN 3
          WHEN JSON_EXTRACT(answers, '$.q1') = '"Dissatisfied"' THEN 2
          WHEN JSON_EXTRACT(answers, '$.q1') = '"Very dissatisfied"' THEN 1
          ELSE NULL
        END) as avgRating
      FROM \`${feedbackTable}\`
    `).catch(() => [[{ total: 0, negCount: 0, posCount: 0, avgRating: 5.0 }]]);

    const [todayFbRows] = await db.query(
      `SELECT COUNT(*) as todayTotal FROM \`${feedbackTable}\` WHERE DATE(created_at) = ?`,
      [istDate]
    ).catch(() => [[{ todayTotal: 0 }]]);

    const totalFeedback = Number(fbSummary[0]?.total) || 0;
    const negFeedback = Number(fbSummary[0]?.negCount) || 0;
    const posFeedback = Number(fbSummary[0]?.posCount) || Math.max(0, totalFeedback - negFeedback);
    const csatPercent = totalFeedback > 0 ? Math.round((posFeedback / totalFeedback) * 100) : null;
    const averageRating = totalFeedback > 0 && fbSummary[0]?.avgRating ? Number(fbSummary[0].avgRating).toFixed(1) : null;
    const responsesToday = Number(todayFbRows[0]?.todayTotal) || 0;

    const csatData = {
      satisfactionPct: csatPercent,
      totalFeedback,
      responsesToday,
      averageRating: averageRating ? `${averageRating} / 5.0` : null,
      positiveCount: posFeedback,
      negativeCount: negFeedback
    };

    // 5. Active Sourcing Diverts
    const [divertRows] = await db.query(
      `SELECT id, productWanted, quantity, priceRange, status, sectionId, createdAt, remarks 
       FROM Diverts 
       WHERE location_id = ? 
       ORDER BY createdAt DESC 
       LIMIT 15`,
      [targetLocId]
    ).catch(() => [[]]);

    const activeDiverts = (divertRows || []).filter(d => 
      ['open', 'sourcing', 'Open', 'In Progress', 'in progress'].includes(d.status)
    );
    const urgentDiverts = activeDiverts.filter(d => 
      (d.remarks && d.remarks.toLowerCase().includes('urgent')) ||
      (d.productWanted && d.productWanted.toLowerCase().includes('urgent'))
    );
    const completedToday = (divertRows || []).filter(d => 
      ['Completed', 'completed', 'resolved'].includes(d.status) &&
      d.createdAt && String(d.createdAt).startsWith(istDate)
    );

    const divertData = {
      totalActive: activeDiverts.length,
      urgentCount: urgentDiverts.length,
      inProgressCount: activeDiverts.filter(d => ['In Progress', 'in progress'].includes(d.status)).length,
      completedTodayCount: completedToday.length,
      recentDiverts: activeDiverts.slice(0, 4).map(d => ({
        id: d.id,
        product: d.productWanted,
        quantity: d.quantity || 1,
        section: d.sectionId || 'Floor',
        status: d.status
      }))
    };

    // 6. Live Operations Feed (Real Application Events)
    const [auditEvents] = await db.query(`
      SELECT id, action, module, username, details, location_id, created_at 
      FROM audit_logs 
      WHERE action NOT LIKE '%Page Navigation%' 
        AND action NOT LIKE '%GET_%' 
        AND action NOT LIKE '%CHECK_%'
        AND (location_id IS NULL OR location_id = ?)
      ORDER BY created_at DESC 
      LIMIT 12
    `, [targetLocId]).catch(() => [[]]);

    const formattedEvents = (auditEvents || []).map(evt => {
      let desc = '';
      let type = 'OPERATIONS';
      let title = evt.action.replace(/_/g, ' ');

      let detailsObj = null;
      try {
        if (typeof evt.details === 'string' && evt.details.startsWith('{')) {
          detailsObj = JSON.parse(evt.details);
        }
      } catch (e) {}

      const act = evt.action.toUpperCase();
      if (act.includes('FOOTFALL')) {
        type = 'FOOTFALL';
        title = 'Footfall Recorded';
        desc = detailsObj?.visitors ? `+${detailsObj.visitors} visitors recorded` : 'Entrance sensor updated';
      } else if (act.includes('VM')) {
        type = 'VM_AUDIT';
        title = act.includes('PHOTO') ? 'VM Inspection Photo' : 'VM Checklist Audit';
        desc = detailsObj?.section ? `${detailsObj.floor || 'Floor'} · ${detailsObj.section}${detailsObj.scorePercent ? ` (${detailsObj.scorePercent}% score)` : ''}` : 'Visual merchandising check';
      } else if (act.includes('DIVERT')) {
        type = 'DIVERT';
        title = 'Sourcing Divert';
        desc = detailsObj?.productWanted ? `Item: ${detailsObj.productWanted}` : 'Floor divert action taken';
      } else if (act.includes('JOINED') || act.includes('DOJ')) {
        type = 'STAFF';
        title = 'Store Onboarding';
        desc = detailsObj?.appNo ? `Staff: ${detailsObj.appNo} (${detailsObj.department || 'Retail Store'})` : 'Candidate onboarding action';
      } else if (act.includes('FEEDBACK') || act.includes('CSAT')) {
        type = 'FEEDBACK';
        title = 'Customer Feedback';
        desc = 'Customer sentiment survey recorded';
      } else if (act.includes('LOGIN')) {
        type = 'SECURITY';
        title = 'Store Staff On Duty';
        desc = `${evt.username || 'Staff'} authenticated to terminal`;
      } else {
        desc = typeof evt.details === 'string' ? evt.details.slice(0, 70) : 'System operation executed';
      }

      const evDate = new Date(evt.created_at);
      const evTime = evDate.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      return {
        id: evt.id,
        time: evTime,
        type,
        title,
        description: desc,
        location: storeInfo.location_name
      };
    });

    // 7. Active Broadcast Notice
    const [broadcastRows] = await db.query(`
      SELECT id, title, subject, message, priority, category, created_at, expires_at 
      FROM broadcast_messages 
      WHERE (location_id IS NULL OR location_id = ?) 
        AND (status = 'APPROVED' OR status = 'Dispatched')
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY pinned DESC, created_at DESC 
      LIMIT 3
    `, [targetLocId]).catch(() => [[]]);

    let activeBroadcast = null;
    if (broadcastRows && broadcastRows.length > 0) {
      const topB = broadcastRows[0];
      activeBroadcast = {
        id: topB.id,
        title: topB.title,
        message: topB.message,
        priority: topB.priority || 'normal',
        category: topB.category || 'General',
        createdAt: topB.created_at
      };
    } else {
      activeBroadcast = {
        id: 0,
        title: `Welcome to BSC Textiles · ${storeInfo.location_name}`,
        message: `Welcome to BSC Textiles · ${storeInfo.location_name} Showroom · Premium Sarees, Menswear, Women & Kids Wear Collections · Store Floor Active`,
        priority: 'normal',
        category: 'Welcome'
      };
    }

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      store: storeInfo,
      status: storeStatus,
      footfall: footfallData,
      csat: csatData,
      diverts: divertData,
      feed: formattedEvents,
      broadcast: activeBroadcast
    });
  } catch (err) {
    console.error('[getTvDisplayData ERROR]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};


