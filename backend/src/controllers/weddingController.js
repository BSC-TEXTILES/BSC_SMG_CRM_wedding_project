const multer = require('multer');
const crypto = require('crypto');

// In-memory cache for calling desk to reduce DB hits (30 seconds TTL)
const deskCache = new Map();
const DESK_CACHE_TTL_MS = 30000;
const pool = require('../config/db');
const { successRes, errorRes } = require('../utils/response');
const { getLocationFilter, injectLocationId } = require('../middleware/auth');
const realtimeService = require('../services/realtimeService');
const { encryptField, decryptField, decryptRows, decryptRow } = require('../utils/crypto');
const { parseCsv, rowsToObjects } = require('../utils/csv');
const { parseDate, getISTDateString } = require('../utils/dates');
const { maxSequence, allocateCustomerCode } = require('../utils/customerCode');
const {
  buildTemplateWorkbook,
  buildTemplateCsv,
  buildErrorReportWorkbook,
  HEADER_ALIASES,
  DEFAULT_CATEGORIES,
  MAX_IMPORT_ROWS,
  TEMPLATE_FILENAME,
  TEMPLATE_FILENAME_CSV,
  ERROR_REPORT_FILENAME
} = require('../utils/weddingTemplate');
const { record403Violation } = require('../middleware/suspiciousActivityTracker');
const ExcelJS = require('exceljs');
const { 
  getCache, setCache, delCache, delCachePattern, 
  acquireLock, releaseLock, bfAdd, bfExists, isReady 
} = require('../config/redisClient');

// Free-text PII fields stored encrypted at rest (AES-256-GCM, see utils/crypto.js)
const ENCRYPTED_FIELDS = ['customer_notes', 'visit_notes', 'appointment_notes', 'purchase_notes', 'note_content', 'communication_details', 'additional_notes'];
const CALL_LOG_ENCRYPTED_FIELDS = ['remarks'];

/**
 * Helper to build location filter dynamically.
 * If user is Global Admin and query.locationId / location_id is passed, filters by that location.
 * Otherwise uses standard getLocationFilter based on user's assigned branch.
 */
const LOCATION_CODE_MAP = {
  'BEL': 1,
  'DAV': 2,
  'SHI': 3
};

function parseTargetLocation(val) {
  if (val === undefined || val === null || val === '') return null;
  const s = String(val).trim().toLowerCase();
  if (s === 'all' || s === 'all locations' || s === 'all_locations') return null;
  let parsed = parseInt(val, 10);
  if (isNaN(parsed) && typeof val === 'string') {
    parsed = LOCATION_CODE_MAP[val.trim().toUpperCase()] || null;
  }
  return parsed;
}

/**
 * Helper to build location filter dynamically.
 * Supports Global Admin, multi-location users (e.g. Gagan), and branch users (e.g. Ananya).
 * Rejects unauthorized location requests with AND 1=0.
 */
function resolveLocFilter(req, tableAlias = 'w') {
  const col = tableAlias ? `${tableAlias}.location_id` : 'location_id';
  if (!req.user) {
    return { clause: `AND 1 = 0`, params: [] };
  }

  const rawParam = req.query?.locationId 
    || req.query?.location_id 
    || req.headers?.['x-location-id']
    || req.body?.locationId
    || req.body?.location_id;
  const requestedLocationId = parseTargetLocation(rawParam);

  const isAdminRole = ['Admin', 'Super Admin', 'system administrator'].includes(req.user.role);
  const isGlobal = req.user.role === 'Super Admin' || (isAdminRole && (!req.user.locationId || req.user.isGlobalAdmin === true));

  if (isGlobal) {
    if (requestedLocationId) {
      return {
        clause: `AND ${col} = ?`,
        params: [requestedLocationId]
      };
    }
    return { clause: '', params: [] };
  }

  // Determine user's allowed locations
  let allowed = [];
  if (Array.isArray(req.user.allowedLocations) && req.user.allowedLocations.length > 0) {
    allowed = req.user.allowedLocations;
  } else if (req.user.locationId) {
    allowed = [req.user.locationId];
  }

  // If single-location user, STRICTLY clamp to that location
  // Ignore any tampering attempts in URL parameters or body
  if (allowed.length === 1) {
    return {
      clause: `AND ${col} = ?`,
      params: [allowed[0]]
    };
  }

  // If multi-location user:
  if (allowed.length > 1) {
    if (requestedLocationId && allowed.includes(requestedLocationId)) {
      return {
        clause: `AND ${col} = ?`,
        params: [requestedLocationId]
      };
    }
    // Unauthorized location requested by branch user -> clamp to primary
    if (requestedLocationId && !allowed.includes(requestedLocationId)) {
      return {
        clause: `AND ${col} = ?`,
        params: [allowed[0]]
      };
    }
    const placeholders = allowed.map(() => '?').join(', ');
    return {
      clause: `AND ${col} IN (${placeholders})`,
      params: [...allowed]
    };
  }

  return { clause: `AND 1 = 0`, params: [] };
}

/**
 * Status values that end a wedding journey and permanently archive the customer.
 * Several code paths write customer_status, so every one of them is checked
 * against this single set.
 */
const COMPLETION_STATUSES = new Set(['Wedding Process Completed', 'Completed']);

/**
 * Pipeline stages keyed to the statuses the database actually stores.
 *
 * The previous board matched statuses such as 'Shopping Planned' and
 * 'Visit Scheduled' that no code path writes, while the real values
 * ('Shopping Date Confirmed', 'Follow-up Pending', 'Interested', 'No Response',
 * 'Not Interested', 'Cancelled', 'Closed') matched nothing — so a customer moved
 * to one of those statuses disappeared from the pipeline entirely. The list
 * below is the single source of truth: the board tags every row with a stage_key,
 * and anything unrecognised lands in 'other' rather than vanishing.
 */
const PIPELINE_STAGES = [
  { key: 'new', label: 'New Lead', order: 1, statuses: ['New', 'New Lead', 'Contact Pending'] },
  { key: 'contacted', label: 'Contacted', order: 2, statuses: ['Contacted', 'Interested'] },
  { key: 'follow_up', label: 'Follow-Up', order: 3, statuses: ['Follow-up Pending', 'Follow-up', 'Follow-Up Scheduled', 'Callback', 'Call Back Requested', 'No Response'] },
  { key: 'shopping_planned', label: 'Shopping Planned', order: 4, statuses: ['Shopping Date Confirmed', 'Shopping Planned', 'Shopping Confirmed', 'Visit Scheduled', 'Visit Planned'] },
  { key: 'visited', label: 'Visited Store', order: 5, statuses: ['Visited', 'Visited Store'] },
  { key: 'won', label: 'Won / Converted', order: 6, statuses: ['Won', 'Converted', ...Array.from(COMPLETION_STATUSES)] },
  { key: 'not_moving', label: 'Not Moving Forward', order: 7, statuses: ['Not Interested', 'Cancelled', 'Closed', 'Invalid Number'] },
  { key: 'other', label: 'Needs Review', order: 8, statuses: [] }
];

const STAGE_BY_STATUS = PIPELINE_STAGES.reduce((acc, stage) => {
  stage.statuses.forEach((s) => { acc[s.toLowerCase()] = stage.key; });
  return acc;
}, {});

function resolveStageKey(status) {
  return STAGE_BY_STATUS[String(status || '').trim().toLowerCase()] || 'other';
}

/**
 * The six visible pipeline stages, in display order. Every pipeline screen
 * (Status Board, dashboard funnel, pipeline API) derives its counts from the
 * customer_status of the customer record through this single definition, so
 * no screen can ever disagree with any other.
 */
const VISIBLE_PIPELINE_STAGES = PIPELINE_STAGES.filter((s) => s.order <= 6);

/**
 * Pipeline status authority.
 *
 * The CRM Manager is the status controller: only this role (plus the
 * system-admin roles that bypass every module check in this app) may change a
 * customer's pipeline status — manually, in bulk, or through any API. Every
 * write path below checks this, server-side, so a frontend state tamper or a
 * direct API call cannot move a customer to another stage.
 */
const STATUS_CONTROLLER_ROLES = ['CRM Manager', 'Admin', 'Super Admin', 'system administrator'];

function canControlPipelineStatus(user) {
  if (!user || !user.role) return false;
  const norm = String(user.role).trim().toLowerCase().replace(/[_\s-]+/g, ' ');
  return STATUS_CONTROLLER_ROLES.map((r) => r.toLowerCase()).includes(norm);
}

/**
 * Canonical customer_status values (single source of truth for manual edits).
 * Normalizing incoming values against this set prevents spelling/case drift
 * (e.g. 'contacted' vs 'Contacted') from fragmenting the pipeline counts.
 */
const CANONICAL_STATUS_INDEX = {};
PIPELINE_STAGES.forEach((stage) => {
  stage.statuses.forEach((s) => { CANONICAL_STATUS_INDEX[s.toLowerCase()] = s; });
});
CANONICAL_STATUS_INDEX['new lead'] = 'New Lead';

/** Returns the canonical status for an incoming value, or null if unknown. */
function normalizeStatusValue(value) {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return null;
  return CANONICAL_STATUS_INDEX[key] || null;
}

/**
 * Schema guards the permanent archive depends on. Both run on every boot and
 * are no-ops once satisfied.
 */
async function ensureArchiveSchemaGuards() {
  // customer_status is a restricted ENUM in deployed databases, so a completion
  // status cannot be written at all until the domain itself allows it.
  try {
    const [rows] = await pool.query(`
      SELECT COLUMN_TYPE AS def, IS_NULLABLE AS nullable, COLUMN_DEFAULT AS dflt, DATA_TYPE AS dtype
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wedding_customers' AND COLUMN_NAME = 'customer_status'
    `);
    const meta = rows[0];
    if (meta && meta.dtype === 'enum') {
      const inner = String(meta.def).slice(String(meta.def).indexOf('(') + 1, String(meta.def).lastIndexOf(')'));
      const values = [];
      const re = /'((?:[^']|'')*)'/g;
      let m;
      while ((m = re.exec(inner))) values.push(m[1].replace(/''/g, "'"));
      const missing = Array.from(COMPLETION_STATUSES).filter((s) => !values.includes(s));
      if (missing.length) {
        const next = [...values, ...missing].map((s) => `'${s.replace(/'/g, "''")}'`).join(',');
        const nullability = meta.nullable === 'NO' ? 'NOT NULL' : 'NULL';
        const dflt = meta.dflt === null ? '' : `DEFAULT '${String(meta.dflt).replace(/'/g, "''")}'`;
        await pool.query(`ALTER TABLE wedding_customers MODIFY COLUMN customer_status ENUM(${next}) ${nullability} ${dflt}`.trim());
        console.log(`[Wedding CRM] customer_status extended with: ${missing.join(', ')}`);
      }
    }
  } catch (e) {
    console.warn('[Wedding CRM] customer_status enum guard skipped:', e.message);
  }

  // Archived history must survive any delete of its parent row. CASCADE would let
  // one removal silently destroy the permanent call history.
  try {
    const [fks] = await pool.query(`
      SELECT k.CONSTRAINT_NAME AS name, r.DELETE_RULE AS rule
      FROM information_schema.KEY_COLUMN_USAGE k
      JOIN information_schema.REFERENTIAL_CONSTRAINTS r
        ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
      WHERE k.TABLE_SCHEMA = DATABASE() AND k.TABLE_NAME = 'wedding_call_logs'
        AND k.REFERENCED_TABLE_NAME = 'wedding_customers'
    `);
    const cascade = fks.filter((f) => f.rule !== 'RESTRICT' && f.rule !== 'NO ACTION');
    for (const f of cascade) {
      await pool.query(`ALTER TABLE wedding_call_logs DROP FOREIGN KEY \`${f.name}\``);
    }
    if (cascade.length) {
      await pool.query(
        `ALTER TABLE wedding_call_logs ADD CONSTRAINT \`fk_wed_call_logs_customer\` FOREIGN KEY (customer_id) REFERENCES wedding_customers(id) ON DELETE RESTRICT`
      );
      console.log('[Wedding CRM] wedding_call_logs FK converted to ON DELETE RESTRICT');
    } else if (!fks.length) {
      await pool.query(
        `ALTER TABLE wedding_call_logs ADD CONSTRAINT \`fk_wed_call_logs_customer\` FOREIGN KEY (customer_id) REFERENCES wedding_customers(id) ON DELETE RESTRICT`
      );
      console.log('[Wedding CRM] wedding_call_logs FK added with ON DELETE RESTRICT');
    }
  } catch (e) {
    console.warn('[Wedding CRM] wedding_call_logs FK guard skipped:', e.message);
  }
}

/**
 * Moves one customer into the permanent Old Customers archive.
 *
 * Shared by the completion trigger and the manual archive action so both leave
 * an identical lifecycle, queue and audit footprint. Archived rows are never
 * rewritten here — the full record is preserved as-is.
 *
 * @returns {Promise<{archived: boolean, reason?: string}>}
 */
async function archiveCustomerAsOld(customerId, actor, options = {}) {
  const custRows = await pool.query(`
    SELECT w.id, w.customer_code, w.customer_name, w.customer_status, w.lifecycle_status,
           w.location_id, w.assigned_telecaller, l.location_code
    FROM wedding_customers w
    LEFT JOIN locations l ON l.id = w.location_id
    WHERE w.id = ?
  `, [customerId]);
  const cust = custRows[0][0];
  if (!cust) return { archived: false, reason: 'not_found' };
  if (cust.lifecycle_status === 'OLD_CUSTOMER') return { archived: false, reason: 'already_archived' };

  const userName = actor?.fullName || actor?.username || 'System Automation';
  const userId = actor?.id || null;
  const reason = options.reason || 'Wedding process completed';
  const action = options.action || 'Moved to Old Customers';
  const completedStatus = options.completedStatus || cust.customer_status;
  const previousStatus = options.previousStatus || cust.customer_status;

  await pool.query(`
    UPDATE wedding_customers SET
      lifecycle_status = 'OLD_CUSTOMER',
      previous_status = ?,
      archived_at = NOW(),
      archived_by = ?,
      archived_by_user_id = ?,
      archive_reason = ?
    WHERE id = ?
  `, [previousStatus, userName, userId, reason, customerId]);

  // Permanent timeline entry — kept verbatim because §36 requires this activity
  // to remain readable in the customer's history forever.
  const details = [
    'Customer moved to Old Customers',
    `Status: ${completedStatus}`,
    `Location: ${cust.location_code || cust.location_id}`,
    `Assigned Telecaller: ${cust.assigned_telecaller || 'Unassigned'}`,
    `Completed By: ${userName}`,
    `Date/Time: ${new Date().toLocaleString('en-IN')}`
  ].join('\n');

  await pool.query(`
    INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details)
    VALUES (?, ?, ?, ?, ?)
  `, [customerId, cust.location_id, userName, action, details]);

  await delCachePattern(`app:prod:wedding:customer:${customerId}:*`);
  await delCachePattern('app:prod:wedding:dashboard:*');
  await delCachePattern('app:prod:wedding:desk:*');
  realtimeService.emitWeddingChange('ARCHIVED', {
    id: customerId,
    customer_code: cust.customer_code,
    lifecycle_status: 'OLD_CUSTOMER'
  }, cust.location_id);

  return { archived: true, customer: cust };
}

/**
 * Journey fields a CRM Manager can edit from the status board that the original
 * updateCustomer never persisted. Whitelisted: anything not listed here cannot be
 * written through the extended path, so archival and lifecycle columns stay safe.
 */
const EXTENSIBLE_CUSTOMER_FIELDS = [
  { column: 'priority', type: 'text' },
  { column: 'preferred_contact_method', type: 'text' },
  { column: 'preferred_followup_time', type: 'text' },
  { column: 'additional_notes', type: 'encrypted' },
  { column: 'bride_age', type: 'int' },
  { column: 'bride_contact', type: 'text' },
  { column: 'bride_shopping_required', type: 'bool' },
  { column: 'groom_age', type: 'int' },
  { column: 'groom_contact', type: 'text' },
  { column: 'groom_shopping_required', type: 'bool' },
  { column: 'wedding_date_flexibility', type: 'text' },
  { column: 'wedding_venue', type: 'text' },
  { column: 'wedding_type', type: 'text' },
  { column: 'wedding_functions', type: 'json' },
  { column: 'guest_count', type: 'int' },
  { column: 'shopping_requirements', type: 'json' },
  { column: 'preferred_shopping_date', type: 'date' },
  { column: 'preferred_shopping_time', type: 'text' },
  { column: 'expected_visitors', type: 'int' }
];

function camelCase(column) {
  return column.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

/**
 * Builds the SET list for the extended fields.
 * Returns { sets, params, error } — error is a plain-English message so the
 * caller can reject a bad value instead of silently dropping it.
 */
function buildExtendedFieldUpdate(body) {
  const sets = [];
  const params = [];

  for (const field of EXTENSIBLE_CUSTOMER_FIELDS) {
    const incoming = body[field.column] !== undefined ? body[field.column] : body[camelCase(field.column)];
    if (incoming === undefined) continue;

    if (field.type === 'int') {
      if (incoming === '' || incoming === null) {
        sets.push(`${field.column} = ?`); params.push(null); continue;
      }
      const num = Number(incoming);
      if (!Number.isInteger(num)) return { error: `Enter a whole number for ${camelCase(field.column)}.` };
      sets.push(`${field.column} = ?`); params.push(num); continue;
    }

    if (field.type === 'date') {
      if (incoming === '' || incoming === null) {
        sets.push(`${field.column} = ?`); params.push(null); continue;
      }
      const parsed = parseDate(incoming);
      if (!parsed) return { error: `Enter a valid date for ${camelCase(field.column)}.` };
      sets.push(`${field.column} = ?`); params.push(parsed); continue;
    }

    if (field.type === 'bool') {
      const truthy = incoming === true || incoming === 1 || incoming === '1' ||
        (typeof incoming === 'string' && ['true', 'yes'].includes(incoming.toLowerCase()));
      sets.push(`${field.column} = ?`); params.push(truthy ? 1 : 0); continue;
    }

    if (field.type === 'json') {
      if (incoming === '' || incoming === null) {
        sets.push(`${field.column} = ?`); params.push(null); continue;
      }
      if (typeof incoming === 'string') {
        try {
          JSON.parse(incoming);
          sets.push(`${field.column} = ?`); params.push(incoming);
        } catch {
          return { error: `${camelCase(field.column)} must be valid JSON.` };
        }
        continue;
      }
      sets.push(`${field.column} = ?`); params.push(JSON.stringify(incoming)); continue;
    }

    if (field.type === 'encrypted') {
      sets.push(`${field.column} = ?`);
      params.push(incoming === null || incoming === '' ? null : encryptField(String(incoming)));
      continue;
    }

    sets.push(`${field.column} = ?`);
    params.push(incoming === null || incoming === '' ? null : String(incoming).trim());
  }

  return { sets, params, error: null };
}

let tablesChecked = false;
let tablesInitPromise = null;
let weddingCustomersColumns = new Set();

// Immediately repair column nullability on startup
pool.query("ALTER TABLE wedding_customers MODIFY COLUMN expected_shopping_date DATE NULL DEFAULT NULL").catch(() => {});
pool.query("ALTER TABLE wedding_customers MODIFY COLUMN wedding_date DATE NULL DEFAULT NULL").catch(() => {});
pool.query("ALTER TABLE wedding_customers MODIFY COLUMN follow_up_date DATE NULL DEFAULT NULL").catch(() => {});
pool.query("ALTER TABLE wedding_customers MODIFY COLUMN total_calls_count INT NOT NULL DEFAULT 0").catch(() => {});

async function getWeddingCustomerColumns() {
  if (weddingCustomersColumns.size > 0) return weddingCustomersColumns;
  try {
    const [cols] = await pool.query('SHOW COLUMNS FROM wedding_customers');
    weddingCustomersColumns = new Set(cols.map(c => c.Field.toLowerCase()));
  } catch (e) {
    console.warn('[WeddingController] Failed to inspect wedding_customers columns:', e.message);
  }
  return weddingCustomersColumns;
}

async function ensureTables() {
  if (tablesChecked && weddingCustomersColumns.has('last_contacted_by') && weddingCustomersColumns.has('assigned_telecaller_id')) return;
  if (!tablesInitPromise) {
    tablesInitPromise = (async () => {
      try {
        await pool.query("SET time_zone = '+05:30'").catch(() => {});
        try { await pool.query("ALTER TABLE wedding_customers MODIFY COLUMN expected_shopping_date DATE NULL DEFAULT NULL"); } catch(e) {}
        try { await pool.query("ALTER TABLE wedding_customers MODIFY COLUMN wedding_date DATE NULL DEFAULT NULL"); } catch(e) {}
        try { await pool.query("ALTER TABLE wedding_customers MODIFY COLUMN follow_up_date DATE NULL DEFAULT NULL"); } catch(e) {}
        try { await pool.query("ALTER TABLE wedding_customers MODIFY COLUMN total_calls_count INT NOT NULL DEFAULT 0"); } catch(e) {}
        await pool.query(`
      CREATE TABLE IF NOT EXISTS \`wedding_customers\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`customer_code\` VARCHAR(50) NOT NULL UNIQUE,
        \`location_id\` INT NOT NULL DEFAULT 2,
        \`customer_name\` VARCHAR(150) NOT NULL,
        \`mobile_number\` VARCHAR(20) NOT NULL,
        \`email\` VARCHAR(150) NULL,
        \`wedding_date\` DATE NULL,
        \`expected_shopping_date\` DATE NULL,
        \`preferred_shopping_category\` VARCHAR(150) NULL,
        \`estimated_family_size\` INT NULL DEFAULT 1,
        \`assigned_telecaller\` VARCHAR(150) NULL,
        \`assigned_telecaller_id\` INT NULL,
        \`follow_up_date\` DATE NOT NULL,
        \`preferred_call_time\` VARCHAR(50) NULL,
        \`customer_notes\` TEXT NULL,
        \`customer_status\` VARCHAR(50) NOT NULL DEFAULT 'New',
        \`call_status\` VARCHAR(50) NOT NULL DEFAULT 'Pending',
        \`total_calls_count\` INT NOT NULL DEFAULT 0,
        \`last_call_date\` DATETIME NULL,
        \`last_call_outcome\` VARCHAR(100) NULL,
        \`created_by\` VARCHAR(150) NULL,
        \`created_by_user_id\` INT NULL,
        \`is_deleted\` TINYINT(1) NOT NULL DEFAULT 0,
        \`deleted_at\` DATETIME NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_wed_loc_status\` (\`location_id\`, \`customer_status\`, \`follow_up_date\`),
        INDEX \`idx_wed_mobile_loc\` (\`mobile_number\`, \`location_id\`),
        INDEX \`idx_wed_follow_up\` (\`follow_up_date\`),
        INDEX \`idx_wed_shop_date\` (\`expected_shopping_date\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`wedding_call_logs\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`customer_id\` INT NOT NULL,
        \`location_id\` INT NOT NULL DEFAULT 2,
        \`call_date\` DATE NOT NULL,
        \`call_time\` VARCHAR(20) NOT NULL,
        \`telecaller_name\` VARCHAR(150) NOT NULL,
        \`telecaller_id\` INT NULL,
        \`call_status\` VARCHAR(50) NOT NULL DEFAULT 'Completed',
        \`call_outcome\` VARCHAR(50) NOT NULL,
        \`remarks\` TEXT NULL,
        \`next_follow_up_date\` DATE NULL,
        \`next_follow_up_time\` VARCHAR(50) NULL,
        \`expected_shopping_date_updated\` DATE NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_call_cust\` (\`customer_id\`),
        INDEX \`idx_call_date\` (\`call_date\`),
        INDEX \`idx_call_loc\` (\`location_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`wedding_audit_logs\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`customer_id\` INT NULL,
        \`location_id\` INT NOT NULL DEFAULT 2,
        \`user_name\` VARCHAR(150) NOT NULL,
        \`action\` VARCHAR(100) NOT NULL,
        \`details\` TEXT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_audit_cust\` (\`customer_id\`),
        INDEX \`idx_audit_loc\` (\`location_id\`),
        INDEX \`idx_audit_action\` (\`action\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Wedding Visits
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`wedding_visits\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`customer_id\` INT NOT NULL,
        \`location_id\` INT NOT NULL DEFAULT 2,
        \`visit_date\` DATE NOT NULL,
        \`visit_time\` VARCHAR(20) NOT NULL,
        \`visitors_count\` INT DEFAULT 1,
        \`visited_by\` VARCHAR(150) NULL,
        \`purpose\` VARCHAR(255) NULL,
        \`products_viewed\` TEXT NULL,
        \`categories_viewed\` TEXT NULL,
        \`customer_requirement\` TEXT NULL,
        \`visit_result\` VARCHAR(100) NULL,
        \`next_action\` VARCHAR(255) NULL,
        \`visit_notes\` TEXT NULL,
        \`visit_status\` VARCHAR(50) NOT NULL DEFAULT 'Visit Planned',
        \`created_by\` VARCHAR(150) NULL,
        \`created_by_user_id\` INT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_visit_cust\` (\`customer_id\`),
        INDEX \`idx_visit_date\` (\`visit_date\`),
        INDEX \`idx_visit_loc\` (\`location_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Shopping Appointments
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`wedding_appointments\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`customer_id\` INT NOT NULL,
        \`location_id\` INT NOT NULL DEFAULT 2,
        \`appointment_date\` DATE NOT NULL,
        \`appointment_time\` VARCHAR(20) NOT NULL,
        \`store_location\` VARCHAR(150) NULL,
        \`assigned_employee\` VARCHAR(150) NULL,
        \`assigned_employee_id\` INT NULL,
        \`visitors_count\` INT DEFAULT 1,
        \`purpose\` VARCHAR(255) NULL,
        \`special_arrangement\` TEXT NULL,
        \`appointment_notes\` TEXT NULL,
        \`appointment_status\` VARCHAR(50) NOT NULL DEFAULT 'Scheduled',
        \`created_by\` VARCHAR(150) NULL,
        \`created_by_user_id\` INT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_appt_cust\` (\`customer_id\`),
        INDEX \`idx_appt_date\` (\`appointment_date\`),
        INDEX \`idx_appt_loc\` (\`location_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Purchases
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`wedding_purchases\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`customer_id\` INT NOT NULL,
        \`location_id\` INT NOT NULL DEFAULT 2,
        \`bill_number\` VARCHAR(100) NULL,
        \`purchase_date\` DATE NULL,
        \`store_location\` VARCHAR(150) NULL,
        \`total_amount\` DECIMAL(12,2) DEFAULT 0,
        \`discount_amount\` DECIMAL(12,2) DEFAULT 0,
        \`net_amount\` DECIMAL(12,2) DEFAULT 0,
        \`payment_status\` VARCHAR(50) DEFAULT 'Pending',
        \`sales_employee\` VARCHAR(150) NULL,
        \`product_categories\` TEXT NULL,
        \`purchase_notes\` TEXT NULL,
        \`purchase_status\` VARCHAR(50) NOT NULL DEFAULT 'Not Started',
        \`created_by\` VARCHAR(150) NULL,
        \`created_by_user_id\` INT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_purchase_cust\` (\`customer_id\`),
        INDEX \`idx_purchase_date\` (\`purchase_date\`),
        INDEX \`idx_purchase_loc\` (\`location_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Documents/Attachments
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`wedding_documents\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`customer_id\` INT NOT NULL,
        \`location_id\` INT NOT NULL DEFAULT 2,
        \`document_type\` VARCHAR(100) NOT NULL,
        \`file_name\` VARCHAR(255) NOT NULL,
        \`file_path\` TEXT NOT NULL,
        \`file_size\` INT DEFAULT 0,
        \`file_extension\` VARCHAR(20) NOT NULL,
        \`uploaded_by\` VARCHAR(150) NULL,
        \`uploaded_by_user_id\` INT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_doc_cust\` (\`customer_id\`),
        INDEX \`idx_doc_loc\` (\`location_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Notes (with history)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`wedding_notes\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`customer_id\` INT NOT NULL,
        \`location_id\` INT NOT NULL DEFAULT 2,
        \`note_content\` TEXT NOT NULL,
        \`note_type\` VARCHAR(50) DEFAULT 'General',
        \`created_by\` VARCHAR(150) NOT NULL,
        \`created_by_user_id\` INT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_note_cust\` (\`customer_id\`),
        INDEX \`idx_note_loc\` (\`location_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Status History
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`wedding_status_history\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`customer_id\` INT NOT NULL,
        \`location_id\` INT NOT NULL DEFAULT 2,
        \`old_status\` VARCHAR(50) NULL,
        \`new_status\` VARCHAR(50) NOT NULL,
        \`changed_by\` VARCHAR(150) NOT NULL,
        \`changed_by_user_id\` INT NULL,
        \`change_reason\` TEXT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_status_cust\` (\`customer_id\`),
        INDEX \`idx_status_loc\` (\`location_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Communication History (extended beyond call logs)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`wedding_communication\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`customer_id\` INT NOT NULL,
        \`location_id\` INT NOT NULL DEFAULT 2,
        \`communication_type\` VARCHAR(50) NOT NULL,
        \`communication_method\` VARCHAR(50) NOT NULL,
        \`communication_date\` DATE NOT NULL,
        \`communication_time\` VARCHAR(20) NOT NULL,
        \`employee_name\` VARCHAR(150) NOT NULL,
        \`employee_id\` INT NULL,
        \`outcome\` VARCHAR(100) NULL,
        \`communication_details\` TEXT NULL,
        \`next_follow_up_date\` DATE NULL,
        \`next_follow_up_time\` VARCHAR(50) NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_comm_cust\` (\`customer_id\`),
        INDEX \`idx_comm_date\` (\`communication_date\`),
        INDEX \`idx_comm_loc\` (\`location_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Customer Source tracking
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`wedding_customer_sources\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`source_name\` VARCHAR(100) NOT NULL UNIQUE,
        \`description\` TEXT NULL,
        \`is_active\` BOOLEAN DEFAULT TRUE,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Add source_id to wedding_customers if not exists
    // Add columns one by one for MySQL 5.x compatibility
    const weddingCols = [
      "ALTER TABLE wedding_customers ADD COLUMN source_id INT NULL",
      "ALTER TABLE wedding_customers ADD COLUMN alternate_mobile VARCHAR(20) NULL",
      "ALTER TABLE wedding_customers ADD COLUMN bride_name VARCHAR(150) NULL",
      "ALTER TABLE wedding_customers ADD COLUMN bride_age INT NULL",
      "ALTER TABLE wedding_customers ADD COLUMN bride_contact VARCHAR(20) NULL",
      "ALTER TABLE wedding_customers ADD COLUMN bride_shopping_required BOOLEAN DEFAULT TRUE",
      "ALTER TABLE wedding_customers ADD COLUMN groom_name VARCHAR(150) NULL",
      "ALTER TABLE wedding_customers ADD COLUMN groom_age INT NULL",
      "ALTER TABLE wedding_customers ADD COLUMN groom_contact VARCHAR(20) NULL",
      "ALTER TABLE wedding_customers ADD COLUMN groom_shopping_required BOOLEAN DEFAULT TRUE",
      "ALTER TABLE wedding_customers ADD COLUMN wedding_date_flexibility VARCHAR(50) NULL",
      "ALTER TABLE wedding_customers ADD COLUMN wedding_venue VARCHAR(255) NULL",
      "ALTER TABLE wedding_customers ADD COLUMN wedding_city VARCHAR(100) NULL",
      "ALTER TABLE wedding_customers ADD COLUMN wedding_type VARCHAR(50) NULL",
      "ALTER TABLE wedding_customers ADD COLUMN wedding_functions JSON NULL",
      "ALTER TABLE wedding_customers ADD COLUMN guest_count INT NULL",
      "ALTER TABLE wedding_customers ADD COLUMN family_size INT NULL",
      "ALTER TABLE wedding_customers ADD COLUMN shopping_requirements JSON NULL",
      "ALTER TABLE wedding_customers ADD COLUMN budget_range VARCHAR(50) NULL",
      "ALTER TABLE wedding_customers ADD COLUMN preferred_shopping_date DATE NULL",
      "ALTER TABLE wedding_customers ADD COLUMN preferred_shopping_time VARCHAR(50) NULL",
      "ALTER TABLE wedding_customers ADD COLUMN expected_visitors INT NULL",
      "ALTER TABLE wedding_customers ADD COLUMN existing_customer VARCHAR(20) NULL",
      "ALTER TABLE wedding_customers ADD COLUMN existing_customer_id VARCHAR(50) NULL",
      "ALTER TABLE wedding_customers ADD COLUMN previous_store VARCHAR(50) NULL",
      "ALTER TABLE wedding_customers ADD COLUMN preferred_contact_method VARCHAR(50) NULL",
      "ALTER TABLE wedding_customers ADD COLUMN preferred_followup_time VARCHAR(50) NULL",
      "ALTER TABLE wedding_customers ADD COLUMN additional_notes TEXT NULL",
      "ALTER TABLE wedding_customers ADD COLUMN consent BOOLEAN DEFAULT FALSE",
      "ALTER TABLE wedding_customers ADD COLUMN priority VARCHAR(50) DEFAULT 'Medium'",
      "ALTER TABLE wedding_customers ADD COLUMN budget VARCHAR(100) NULL",
      "ALTER TABLE wedding_customers ADD COLUMN lead_source VARCHAR(100) DEFAULT 'Wedding Registration'",
      "ALTER TABLE wedding_customers ADD COLUMN lifecycle_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE'",
      "ALTER TABLE wedding_customers ADD COLUMN archived_at DATETIME NULL",
      "ALTER TABLE wedding_customers ADD COLUMN archived_by VARCHAR(150) NULL",
      "ALTER TABLE wedding_customers ADD COLUMN archived_by_user_id INT NULL",
      "ALTER TABLE wedding_customers ADD COLUMN archive_reason TEXT NULL",
      "ALTER TABLE wedding_customers ADD COLUMN previous_status VARCHAR(50) NULL",
      "ALTER TABLE wedding_customers ADD COLUMN previous_customer_id INT NULL",
      "ALTER TABLE wedding_customers ADD COLUMN last_contacted_by VARCHAR(150) NULL",
      "ALTER TABLE wedding_customers ADD COLUMN last_contacted_by_user_id INT NULL",
      "ALTER TABLE wedding_customers ADD COLUMN last_updated_by VARCHAR(150) NULL",
      "ALTER TABLE wedding_customers ADD COLUMN last_updated_by_user_id INT NULL",
      "ALTER TABLE wedding_customers ADD COLUMN created_by VARCHAR(150) NULL",
      "ALTER TABLE wedding_customers ADD COLUMN created_by_user_id INT NULL",
      "ALTER TABLE wedding_customers ADD COLUMN assigned_telecaller_id INT NULL",
      "ALTER TABLE wedding_customers MODIFY COLUMN expected_shopping_date DATE NULL DEFAULT NULL",
      "ALTER TABLE wedding_customers MODIFY COLUMN wedding_date DATE NULL DEFAULT NULL",
      "ALTER TABLE wedding_customers MODIFY COLUMN follow_up_date DATE NULL DEFAULT NULL",
      "ALTER TABLE wedding_customers MODIFY COLUMN total_calls_count INT NOT NULL DEFAULT 0",
      "ALTER TABLE wedding_customers MODIFY COLUMN preferred_shopping_category VARCHAR(150) NULL DEFAULT 'General Wedding Shopping'",
      "ALTER TABLE wedding_customers MODIFY COLUMN preferred_call_time VARCHAR(50) NULL DEFAULT 'Morning (10 AM - 1 PM)'",
      "ALTER TABLE wedding_customers MODIFY COLUMN estimated_family_size INT NULL DEFAULT 1"
    ];
    for (const sql of weddingCols) {
      try { await pool.query(sql); } catch(e) { /* column already exists */ }
    }

    try { await pool.query("ALTER TABLE wedding_customers ADD INDEX idx_wed_lifecycle (lifecycle_status)"); } catch(e) {}
    try { await pool.query("ALTER TABLE wedding_customers ADD INDEX idx_wed_archived_at (archived_at)"); } catch(e) {}
    try { await pool.query("ALTER TABLE wedding_customers ADD INDEX idx_wed_prev_customer (previous_customer_id)"); } catch(e) {}
    try { await pool.query("ALTER TABLE wedding_customers ADD INDEX idx_wed_last_contact (last_contacted_by_user_id)"); } catch(e) {}
    try { await pool.query("ALTER TABLE wedding_customers ADD INDEX idx_wed_last_updated (last_updated_by_user_id)"); } catch(e) {}

    // Ensure wedding_whatsapp_logs table exists
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS \`wedding_whatsapp_logs\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`customer_id\` INT NOT NULL,
          \`customer_code\` VARCHAR(50) NULL,
          \`location_id\` INT NOT NULL DEFAULT 2,
          \`telecaller_id\` INT NULL,
          \`telecaller_name\` VARCHAR(150) NULL,
          \`recipient_mobile\` VARCHAR(30) NOT NULL,
          \`template_type\` VARCHAR(60) NOT NULL,
          \`template_name\` VARCHAR(100) NULL,
          \`message_text\` TEXT NOT NULL,
          \`status\` VARCHAR(50) NOT NULL DEFAULT 'SENT',
          \`failure_reason\` VARCHAR(255) NULL,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX \`idx_wa_cust\` (\`customer_id\`),
          INDEX \`idx_wa_loc\` (\`location_id\`),
          INDEX \`idx_wa_telecaller\` (\`telecaller_id\`),
          INDEX \`idx_wa_created\` (\`created_at\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    } catch (_waErr) {}

    // Backfill last_contacted_by & last_contacted_by_user_id from wedding_call_logs for historical records
    try {
      await pool.query(`
        UPDATE wedding_customers w
        INNER JOIN (
          SELECT customer_id, telecaller_name, telecaller_id
          FROM wedding_call_logs
          WHERE id IN (SELECT MAX(id) FROM wedding_call_logs GROUP BY customer_id)
        ) cl ON w.id = cl.customer_id
        SET w.last_contacted_by = cl.telecaller_name,
            w.last_contacted_by_user_id = cl.telecaller_id
        WHERE (w.last_contacted_by IS NULL OR w.last_contacted_by = '')
          AND cl.telecaller_name IS NOT NULL
      `);
    } catch (_bfErr) {}

    // Refresh known column set
    try {
      const [allCols] = await pool.query('SHOW COLUMNS FROM wedding_customers');
      weddingCustomersColumns = new Set(allCols.map(c => c.Field.toLowerCase()));
    } catch (e) {}

    await ensureArchiveSchemaGuards();

    // Ensure call log columns for duration and customer response
    try {
      try { await pool.query("ALTER TABLE `wedding_call_logs` ADD COLUMN call_duration VARCHAR(50) NULL"); } catch(e) {}
      try { await pool.query("ALTER TABLE `wedding_call_logs` ADD COLUMN customer_response TEXT NULL"); } catch(e) {}
    } catch (e) {}

    // Ensure roles table has the wedding crm & telecaller roles
    try {
      await pool.query(`
        INSERT IGNORE INTO \`Role\` (\`roleName\`, \`description\`, \`status\`) VALUES
        ('Super Admin', 'Full system access across all companies and settings', 'Active'),
        ('Admin', 'Administrator access with user and settings management', 'Active'),
        ('Wedding Collection Manager', 'Wedding Collection operational dashboard, pipeline & customer management', 'Active'),
        ('Team Lead', 'Team-level calling, performance and allocation management', 'Active'),
        ('Telecaller', 'Daily calling desk, customer follow-up and appointment workspace', 'Active')
      `);
    } catch (e) {}

    // Seed default customer sources
    await pool.query(`
      INSERT IGNORE INTO wedding_customer_sources (source_name, description) VALUES
      ('Wedding Registration', 'Customer registered through wedding registration portal'),
      ('Website', 'Customer from website inquiry'),
      ('Feedback QR', 'Customer from feedback QR code'),
      ('Store Walk-in', 'Customer walked into store'),
      ('WhatsApp', 'Customer contacted via WhatsApp'),
      ('Phone', 'Customer called store'),
      ('Reference', 'Customer referred by existing customer'),
      ('Campaign', 'Customer from marketing campaign'),
      ('Existing Customer', 'Returning customer'),
      ('Staff Entry', 'Manually added by staff'),
      ('Other', 'Other source')
    `);

    const [cnt] = await pool.query(`SELECT COUNT(*) AS total FROM wedding_customers WHERE is_deleted = 0`);
    if (!cnt || cnt[0]?.total === 0) {
      await pool.query(`
        INSERT IGNORE INTO wedding_customers (
          customer_code, location_id, customer_name, mobile_number, email, wedding_date,
          expected_shopping_date, preferred_shopping_category, estimated_family_size,
          assigned_telecaller, follow_up_date, preferred_call_time, customer_notes,
          customer_status, call_status
        ) VALUES
        ('WED-DAV-2026-0001', 2, 'Ananya Sharma', '9845012345', 'ananya.s@example.com', DATE_ADD(CURDATE(), INTERVAL 45 DAY), DATE_ADD(CURDATE(), INTERVAL 15 DAY), 'Bridal Lehengas', 4, 'Pooja Telecaller', CURDATE(), 'Morning (10 AM - 1 PM)', 'Interested in premium bridal lehengas', 'Follow-up Pending', 'Call Back Requested'),
        ('WED-DAV-2026-0002', 2, 'Rajeshwari Patil', '9741098765', 'rajeshwari.p@example.com', DATE_ADD(CURDATE(), INTERVAL 60 DAY), DATE_ADD(CURDATE(), INTERVAL 20 DAY), 'Pure Silk Sarees', 6, 'Sneha Follow-up', DATE_SUB(CURDATE(), INTERVAL 2 DAY), 'Afternoon (1 PM - 4 PM)', 'Pure Kanchipuram silk sarees for marriage ceremony', 'Contacted', 'No Answer'),
        ('WED-DAV-2026-0003', 2, 'Vijay Kumar Hegde', '9448054321', 'vijay.hegde@example.com', DATE_ADD(CURDATE(), INTERVAL 30 DAY), DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'Sherwanis & Suits', 3, 'Pooja Telecaller', CURDATE(), 'Evening (4 PM - 7 PM)', 'Groom sherwani and family shopping confirmed', 'Shopping Date Confirmed', 'Completed'),
        ('WED-BEL-2026-0001', 1, 'Deepa Kulkarni', '9980112233', 'deepa.k@example.com', DATE_ADD(CURDATE(), INTERVAL 40 DAY), DATE_ADD(CURDATE(), INTERVAL 10 DAY), 'Pure Silk Sarees', 5, 'Kiran CRM Desk', CURDATE(), 'Morning (10 AM - 1 PM)', 'Visited Belagavi store, follow up scheduled', 'New', 'Pending'),
        ('WED-SHI-2026-0001', 3, 'Manjunath Gowda', '9632009988', 'manjunath.g@example.com', DATE_ADD(CURDATE(), INTERVAL 50 DAY), DATE_ADD(CURDATE(), INTERVAL 18 DAY), 'Family Matching Sets', 8, 'Pooja Telecaller', DATE_ADD(CURDATE(), INTERVAL 2 DAY), 'Morning (10 AM - 1 PM)', 'Family wedding group for Shivamogga store', 'Interested', 'Completed')
      `);
    }

    // Import history — one row per bulk import run (Task: Import History / audit)
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS wedding_import_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          file_name VARCHAR(255) NULL,
          file_type VARCHAR(20) NULL,
          location_id INT NULL,
          location_name VARCHAR(150) NULL,
          user_id INT NULL,
          user_name VARCHAR(150) NULL,
          total_rows INT DEFAULT 0,
          imported_count INT DEFAULT 0,
          duplicate_count INT DEFAULT 0,
          error_count INT DEFAULT 0,
          status VARCHAR(30) DEFAULT 'Completed',
          summary VARCHAR(255) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_wil_created (created_at),
          INDEX idx_wil_location (location_id),
          INDEX idx_wil_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    } catch (e) {
      console.warn('[ensureTables] wedding_import_logs:', e.message);
    }

    try {
      await ensureTelecallerInstructionsTable();
    } catch (e) {
      console.warn('[ensureTables] wedding_telecaller_instructions:', e.message);
    }

        tablesChecked = true;
      } catch (err) {
        console.error('[WeddingController.ensureTables Error]', err.message);
      }
    })();
  }
  return tablesInitPromise;
}

/**
 * Self-healing table creator for wedding_telecaller_instructions.
 * Guarantees table exists even if accessed before/outside ensureTables().
 */
async function ensureTelecallerInstructionsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`wedding_telecaller_instructions\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`customer_id\` INT NOT NULL,
      \`customer_code\` VARCHAR(40) NULL,
      \`customer_name\` VARCHAR(190) NULL,
      \`location_id\` INT NOT NULL DEFAULT 2,
      \`location_name\` VARCHAR(120) NULL,
      \`telecaller_user_id\` INT NOT NULL,
      \`telecaller_name\` VARCHAR(190) NOT NULL,
      \`sent_by_user_id\` INT NULL,
      \`sent_by_name\` VARCHAR(190) NOT NULL,
      \`sent_by_role\` VARCHAR(80) NULL,
      \`message\` TEXT NOT NULL,
      \`message_hash\` CHAR(64) NULL,
      \`priority\` VARCHAR(20) NOT NULL DEFAULT 'Normal',
      \`status\` VARCHAR(20) NOT NULL DEFAULT 'New',
      \`related_call_log_id\` INT NULL,
      \`seen_at\` DATETIME NULL,
      \`acknowledged_at\` DATETIME NULL,
      \`completed_at\` DATETIME NULL,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX \`idx_wti_loc_tele\` (\`location_id\`, \`telecaller_user_id\`),
      INDEX \`idx_wti_customer\` (\`customer_id\`),
      INDEX \`idx_wti_status\` (\`status\`),
      INDEX \`idx_wti_created\` (\`created_at\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

// ── Shared helpers for the bulk import / template feature ─────────────────────
const IMPORT_ADMIN_ROLES = ['Admin', 'Super Admin', 'system administrator'];
const TELECALLER_ROLES = ['Telecaller', 'CRM Executive', 'VM Extension Telecaller', 'VM Telecaller', 'Team Lead'];

/** Global admins may target any store; everyone else is pinned to their own. */
function isGlobalImportUser(user) {
  if (!user) return false;
  const isAdminRole = IMPORT_ADMIN_ROLES.includes(user.role);
  return (isAdminRole && (!user.locationId || user.isGlobalAdmin)) || (!user.locationId && !!user.isGlobalAdmin);
}

/**
 * Store-level RBAC: a user may only import into stores they are allowed to use.
 * Returns { allowed, reason } and records a 403 violation on denial.
 */
async function assertStoreAccess(req, res, locationId) {
  const user = req.user || {};
  const targetId = parseInt(locationId, 10);
  if (isNaN(targetId)) return { allowed: false, reason: 'Invalid store location selected.' };

  if (isGlobalImportUser(user)) return { allowed: true, reason: 'Global admin' };
  if (user.locationId && parseInt(user.locationId, 10) === targetId) return { allowed: true, reason: 'Own store' };
  if (Array.isArray(user.allowedLocations) && user.allowedLocations.map(Number).includes(targetId)) {
    return { allowed: true, reason: 'Allowed store' };
  }

  try {
    const [rows] = await pool.query(
      'SELECT 1 FROM user_locations WHERE user_id = ? AND location_id = ? LIMIT 1',
      [user.id, targetId]
    );
    if (rows && rows.length > 0) return { allowed: true, reason: 'Allowed store' };
  } catch (err) {
    console.warn('[importCsv] user_locations lookup failed:', err.message);
  }

  record403Violation(req, res, `Cross-store import attempt: store ${targetId}`);
  return { allowed: false, reason: 'You are not allowed to import customers into this store.' };
}

/** Distinct collections already present in the CRM (template drop-down source). */
async function getTemplateCategories() {
  try {
    const [rows] = await pool.query(
      `SELECT DISTINCT preferred_shopping_category AS v
         FROM wedding_customers
        WHERE is_deleted = 0
          AND preferred_shopping_category IS NOT NULL
          AND preferred_shopping_category <> ''
        ORDER BY 1
        LIMIT 60`
    );
    return (rows || []).map((r) => r.v);
  } catch (err) {
    console.warn('[template] category lookup failed:', err.message);
    return [];
  }
}

/** Active telecallers (template drop-down source). */
async function getTemplateTelecallers() {
  try {
    const [rows] = await pool.query(
      `SELECT DISTINCT COALESCE(NULLIF(TRIM(u.full_name), ''), u.username) AS v
         FROM users u
        WHERE u.active = TRUE
          AND u.role IN (?)
        ORDER BY 1
        LIMIT 100`,
      [TELECALLER_ROLES]
    );
    return (rows || []).map((r) => r.v).filter(Boolean);
  } catch (err) {
    console.warn('[template] telecaller lookup failed:', err.message);
    return [];
  }
}

function formatRupees(n) {
  return Number(n).toLocaleString('en-IN');
}

// ── Tell Caller (CRM → telecaller instructions) ─────────────────────────────
const INSTRUCTION_STATUSES = ['New', 'Seen', 'Acknowledged', 'Completed'];
const INSTRUCTION_PRIORITIES = ['Normal', 'High', 'Urgent'];
/** Forward-only lifecycle, so "Completed" can never quietly become "New" again. */
const INSTRUCTION_STATUS_RANK = { New: 1, Seen: 2, Acknowledged: 3, Completed: 4 };

/** The recipient must be a live telecaller-role account, not an arbitrary user id. */
async function loadInstructionRecipient(telecallerUserId) {
  const [rows] = await pool.query(
    `SELECT u.id, u.full_name, u.username, u.role, u.designation, u.department,
            u.location_id, u.active, l.location_name, l.location_code
       FROM users u
       LEFT JOIN locations l ON l.id = u.location_id
      WHERE u.id = ? AND u.active = TRUE AND u.role IN (?)
      LIMIT 1`,
    [telecallerUserId, TELECALLER_ROLES]
  );
  if (!rows || rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    full_name: r.full_name || r.username,
    role: r.role,
    designation: r.designation || null,
    department: r.department || null,
    location_id: r.location_id,
    location_name: r.location_name || 'All Locations'
  };
}

/** Row → API shape. The message is decrypted here and never leaves encrypted at rest. */
function mapInstructionRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    customerId: Number(row.customer_id),
    customerCode: row.customer_code || null,
    customerName: row.customer_name || null,
    locationId: row.location_id === null ? null : Number(row.location_id),
    locationName: row.location_name || null,
    telecallerUserId: Number(row.telecaller_user_id),
    telecallerName: row.telecaller_name || null,
    sentByUserId: row.sent_by_user_id === null ? null : Number(row.sent_by_user_id),
    sentByName: row.sent_by_name || null,
    sentByRole: row.sent_by_role || null,
    message: decryptField(row.message) || '',
    priority: row.priority || 'Normal',
    status: row.status || 'New',
    relatedCallLogId: row.related_call_log_id === null ? null : Number(row.related_call_log_id),
    seenAt: row.seen_at || null,
    acknowledgedAt: row.acknowledged_at || null,
    acknowledgedBy: row.acknowledged_by || null,
    completedAt: row.completed_at || null,
    completedBy: row.completed_by || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
}

/**
 * Store the caller may act in: global admins any, everyone else only their own /
 * explicitly granted stores. Written here rather than reusing the import helper so
 * the message a CRM Manager sees is about instructions, not imports.
 */
function canActForLocation(user, locationId) {
  if (!user) return false;
  const target = parseInt(locationId, 10);
  if (isNaN(target)) return false;
  const isAdminRole = ['Admin', 'Super Admin', 'system administrator'].includes(user.role);
  const isGlobal = user.role === 'Super Admin' || (isAdminRole && (!user.locationId || user.isGlobalAdmin === true));
  if (isGlobal) return true;
  if (user.locationId && Number(user.locationId) === target) return true;
  return Array.isArray(user.allowedLocations) && user.allowedLocations.map(Number).includes(target);
}

/** Exact-repeat key. The message column is encrypted with a random IV, so it cannot
 *  be compared for equality; this hash can. */
function instructionHash(message) {
  return crypto.createHash('sha256').update(String(message).trim()).digest('hex');
}

class WeddingController {
  // ── 1. Dashboard KPI Stats ──────────────────────────────────────────
  async getDashboardStats(req, res) {
    try {
      await ensureTables();
      const { clause: locClause, params: locParams } = resolveLocFilter(req, 'w');
      let clause = locClause;
      let params = [...locParams];

      // Scoping for Telecaller role: only their assigned customers
      if (req.user && req.user.role === 'Telecaller') {
        clause += ` AND (w.assigned_telecaller_id = ? OR w.assigned_telecaller = ?)`;
        params.push(req.user.id, req.user.fullName || req.user.username || '');
      }

      // Appointments filter
      const { clause: apptLocClause, params: apptLocParams } = resolveLocFilter(req, 'a');

      // Calls logged today filter
      const { clause: clLocClause, params: clLocParams } = resolveLocFilter(req, 'cl');
      let callLogWhere = `WHERE cl.call_date = CURDATE() ${clLocClause}`;
      let callLogParams = [...clLocParams];
      if (req.user && req.user.role === 'Telecaller') {
        callLogWhere += ' AND (cl.telecaller_id = ? OR cl.telecaller_name = ?)';
        callLogParams.push(req.user.id, req.user.fullName || req.user.username || '');
      }

      // Location breakdown filter
      const rawParam = req.query?.locationId || req.query?.location_id || req.headers?.['x-location-id'] || req.body?.locationId || req.body?.location_id;
      const requestedLoc = parseTargetLocation(rawParam);
      const activeLocId = requestedLoc || req.user?.locationId;

      let locQueryWhere = '';
      let locQueryParams = [];
      if (activeLocId) {
        locQueryWhere = 'WHERE l.id = ?';
        locQueryParams.push(activeLocId);
      }

      // Execute all 4 queries in parallel
      const [
        [rows],
        [apptRows],
        [callTodayRows],
        [locRows]
      ] = await Promise.all([
        pool.query(`
          SELECT
            COUNT(*) AS totalCustomers,
            SUM(CASE WHEN DATE(w.created_at) = CURDATE() THEN 1 ELSE 0 END) AS todayNewCustomers,
            SUM(CASE WHEN w.customer_status = 'New' THEN 1 ELSE 0 END) AS newRequests,
            SUM(CASE WHEN w.customer_status IN ('New', 'Contacted', 'Interested', 'Follow-up Pending', 'Shopping Date Confirmed') THEN 1 ELSE 0 END) AS activeLeads,
            SUM(CASE WHEN w.customer_status = 'Interested' THEN 1 ELSE 0 END) AS interestedCustomers,
            SUM(CASE WHEN w.follow_up_date = CURDATE() AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed') THEN 1 ELSE 0 END) AS todayFollowUps,
            SUM(CASE WHEN w.follow_up_date < CURDATE() AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed') THEN 1 ELSE 0 END) AS overdueFollowUps,
            SUM(CASE WHEN w.call_status IN ('Pending', 'Call Back Requested', 'No Answer', 'Busy') THEN 1 ELSE 0 END) AS callsPending,
            SUM(CASE WHEN w.call_status = 'Completed' THEN 1 ELSE 0 END) AS callsCompleted,
            SUM(CASE WHEN w.call_status = 'Connected' THEN 1 ELSE 0 END) AS connectedCalls,
            SUM(CASE WHEN w.call_status IN ('No Answer', 'Busy', 'Switched Off') THEN 1 ELSE 0 END) AS missedCalls,
            SUM(CASE WHEN w.call_status = 'Call Back Requested' THEN 1 ELSE 0 END) AS callbackRequests,
            SUM(CASE WHEN w.customer_status = 'Shopping Date Confirmed' THEN 1 ELSE 0 END) AS shoppingConfirmed,
            SUM(CASE WHEN w.customer_status IN ('Visited Store', 'Converted') THEN 1 ELSE 0 END) AS visitedConverted,
            SUM(CASE WHEN w.customer_status = 'Converted' THEN 1 ELSE 0 END) AS convertedCustomers,
            SUM(CASE WHEN w.customer_status IN ('Not Interested', 'Cancelled', 'Closed') THEN 1 ELSE 0 END) AS lostCustomers,
            SUM(CASE WHEN w.customer_status = 'Not Interested' THEN 1 ELSE 0 END) AS notInterested
          FROM wedding_customers w
          WHERE w.is_deleted = 0 AND (w.lifecycle_status = 'ACTIVE' OR w.lifecycle_status IS NULL) ${clause}
        `, params),
        pool.query(`
          SELECT
            SUM(CASE WHEN a.appointment_date = CURDATE() THEN 1 ELSE 0 END) AS todayAppointments,
            SUM(CASE WHEN a.appointment_date > CURDATE() THEN 1 ELSE 0 END) AS upcomingAppointments,
            SUM(CASE WHEN a.appointment_status = 'Completed' THEN 1 ELSE 0 END) AS completedAppointments,
            SUM(CASE WHEN a.appointment_status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelledAppointments
          FROM wedding_appointments a
          WHERE 1=1 ${apptLocClause}
        `, apptLocParams),
        pool.query(`
          SELECT COUNT(*) as callsToday FROM wedding_call_logs cl ${callLogWhere}
        `, callLogParams),
        pool.query(`
          SELECT 
            l.id AS location_id,
            l.location_code,
            l.location_name,
            COUNT(w.id) AS total_customers,
            SUM(CASE WHEN w.follow_up_date = CURDATE() THEN 1 ELSE 0 END) AS today_follow_ups,
            SUM(CASE WHEN w.follow_up_date < CURDATE() AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed') THEN 1 ELSE 0 END) AS overdue_follow_ups
          FROM locations l
          LEFT JOIN wedding_customers w ON w.location_id = l.id AND w.is_deleted = 0
          ${locQueryWhere}
          GROUP BY l.id, l.location_code, l.location_name
          ORDER BY l.sort_order ASC
        `, locQueryParams)
      ]);

      const rawAppts = apptRows[0] || {};
      const raw = rows[0] || {};
      const locationStats = locRows || [];

      const stats = {
        totalCustomers: Number(raw.totalCustomers) || 0,
        todayNewCustomers: Number(raw.todayNewCustomers) || 0,
        newRequests: Number(raw.newRequests) || 0,
        activeLeads: Number(raw.activeLeads) || 0,
        interestedCustomers: Number(raw.interestedCustomers) || 0,
        convertedCustomers: Number(raw.convertedCustomers) || 0,
        lostCustomers: Number(raw.lostCustomers) || 0,
        todayFollowUps: Number(raw.todayFollowUps) || 0,
        overdueFollowUps: Number(raw.overdueFollowUps) || 0,
        callsPending: Number(raw.callsPending) || 0,
        callsCompleted: Number(raw.callsCompleted) || 0,
        callsToday: Number(callTodayRows[0]?.callsToday) || 0,
        connectedCalls: Number(raw.connectedCalls) || 0,
        missedCalls: Number(raw.missedCalls) || 0,
        callbackRequests: Number(raw.callbackRequests) || 0,
        shoppingConfirmed: Number(raw.shoppingConfirmed) || 0,
        visitedConverted: Number(raw.visitedConverted) || 0,
        notInterested: Number(raw.notInterested) || 0,
        todayAppointments: Number(rawAppts.todayAppointments) || 0,
        upcomingAppointments: Number(rawAppts.upcomingAppointments) || 0,
        completedAppointments: Number(rawAppts.completedAppointments) || 0,
        cancelledAppointments: Number(rawAppts.cancelledAppointments) || 0,
        // Compatibility Aliases
        total_customers: Number(raw.totalCustomers) || 0,
        followUpsDueToday: Number(raw.todayFollowUps) || 0,
        due_today: Number(raw.todayFollowUps) || 0,
        overdue: Number(raw.overdueFollowUps) || 0,
        calls_pending: Number(raw.callsPending) || 0,
        calls_completed: Number(raw.callsCompleted) || 0,
        shopping_confirmed: Number(raw.shoppingConfirmed) || 0,
        visited_converted: Number(raw.visitedConverted) || 0,
        not_interested: Number(raw.notInterested) || 0,
        unassignedLeads: Number(raw.callsPending) || 0,
        convertedThisMonth: Number(raw.convertedCustomers) || 0
      };

      return successRes(res, {
        stats,
        locationStats,
        ...stats
      }, 'Dashboard stats fetched successfully');
    } catch (err) {
      console.error('[WeddingController.getDashboardStats Error]', err);
      return errorRes(res, 'Failed to fetch wedding dashboard stats', [err.message], 500);
    }
  }

  // ── 2. Get Filtered & Paginated Customers ───────────────────────────
  async getCustomers(req, res) {
    try {
      await ensureTables();
      const {
        dateView = req.query.date_filter || 'all',
        customerStatus = req.query.status,
        callStatus = req.query.call_status,
        telecaller = req.query.telecaller_id,
        search,
        startDate = req.query.from_date,
        endDate = req.query.to_date,
        page,
        limit = 50
      } = req.query;

      const { clause: locClause, params: queryParams } = resolveLocFilter(req, 'w');
      let whereClauses = [`w.is_deleted = 0`, `1=1 ${locClause}`];

      // Lifecycle status filter: default to ACTIVE customers so historical old customers don't clutter the active register
      const lifecycleStatus = req.query.lifecycle_status;
      if (lifecycleStatus && lifecycleStatus !== 'all') {
        whereClauses.push(`w.lifecycle_status = ?`);
        queryParams.push(lifecycleStatus);
      } else if (!lifecycleStatus) {
        whereClauses.push(`(w.lifecycle_status = 'ACTIVE' OR w.lifecycle_status IS NULL)`);
      }

      // Enforce Telecaller ownership scoping: Telecallers only see their assigned customers
      if (req.user && req.user.role === 'Telecaller') {
        whereClauses.push(`(w.assigned_telecaller_id = ? OR w.assigned_telecaller = ?)`);
        queryParams.push(req.user.id, req.user.fullName || req.user.username || '');
      }

      // Date Quick-view Filter
      if (dateView === 'today') {
        whereClauses.push(`w.follow_up_date = CURDATE()`);
      } else if (dateView === 'tomorrow') {
        whereClauses.push(`w.follow_up_date = DATE_ADD(CURDATE(), INTERVAL 1 DAY)`);
      } else if (dateView === 'overdue') {
        whereClauses.push(`w.follow_up_date < CURDATE() AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed')`);
      } else if (dateView === 'this_week') {
        whereClauses.push(`YEARWEEK(w.follow_up_date, 1) = YEARWEEK(CURDATE(), 1)`);
      } else if (dateView === 'next_week') {
        whereClauses.push(`YEARWEEK(w.follow_up_date, 1) = YEARWEEK(CURDATE(), 1) + 1`);
      } else if (dateView === 'custom' && startDate && endDate) {
        whereClauses.push(`w.follow_up_date BETWEEN ? AND ?`);
        queryParams.push(startDate, endDate);
      }

      // Customer Status Filter
      if (customerStatus && customerStatus !== 'all') {
        whereClauses.push(`w.customer_status = ?`);
        queryParams.push(customerStatus);
      }

      // Call Status Filter
      if (callStatus && callStatus !== 'all') {
        whereClauses.push(`w.call_status = ?`);
        queryParams.push(callStatus);
      }

      // Assigned Telecaller Filter
      if (telecaller && telecaller !== 'all') {
        if (!isNaN(parseInt(telecaller, 10))) {
          whereClauses.push(`(w.assigned_telecaller_id = ? OR w.assigned_telecaller = ?)`);
          queryParams.push(parseInt(telecaller, 10), telecaller);
        } else {
          whereClauses.push(`w.assigned_telecaller = ?`);
          queryParams.push(telecaller);
        }
      }

      // Fast Search Filter
      if (search && search.trim()) {
        const q = `%${search.trim().toLowerCase()}%`;
        whereClauses.push(`(
          LOWER(w.customer_name) LIKE ? OR
          w.mobile_number LIKE ? OR
          LOWER(w.customer_code) LIKE ? OR
          LOWER(COALESCE(w.email, '')) LIKE ?
        )`);
        queryParams.push(q, q, q, q);
      }

      const whereSql = whereClauses.join(' AND ');

      // Pagination (guard against non-numeric input — LIMIT ? must bind an integer)
      const limitNum = Math.min(5000, Math.max(1, parseInt(limit, 10) || 50));
      // Callers paginate two ways: by page number, or by an explicit row offset.
      // Honour both, otherwise a client sending `offset` is silently pinned to page 1.
      const parsedPage = parseInt(page, 10);
      const parsedOffset = parseInt(req.query.offset, 10);
      const pageNum = !isNaN(parsedPage)
        ? Math.max(1, parsedPage)
        : (!isNaN(parsedOffset) && parsedOffset > 0
          ? Math.floor(parsedOffset / limitNum) + 1
          : 1);
      const offset = (pageNum - 1) * limitNum;

      // Parallelize total count and paginated rows queries
      const [[countResult], [customers]] = await Promise.all([
        pool.query(
          `SELECT COUNT(*) as total FROM wedding_customers w LEFT JOIN locations l ON l.id = w.location_id WHERE ${whereSql}`,
          queryParams
        ),
        pool.query(`
          SELECT 
            w.*,
            l.location_code,
            l.location_name,
            CASE 
              WHEN w.follow_up_date < CURDATE() AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed')
              THEN DATEDIFF(CURDATE(), w.follow_up_date)
              ELSE 0 
            END AS overdue_days
          FROM wedding_customers w
          LEFT JOIN locations l ON l.id = w.location_id
          WHERE ${whereSql}
          ORDER BY 
            CASE WHEN w.follow_up_date < CURDATE() AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed') THEN 0 ELSE 1 END,
            w.follow_up_date ASC,
            w.id DESC
          LIMIT ? OFFSET ?
        `, [...queryParams, limitNum, offset])
      ]);

      const total = countResult[0]?.total || 0;

      decryptRows(customers, ENCRYPTED_FIELDS);

      return successRes(res, {
        customers: customers || [],
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum)
        }
      }, 'Customers fetched successfully');
    } catch (err) {
      console.error('[WeddingController.getCustomers Error]', err);
      return errorRes(res, 'Failed to fetch wedding customers', [err.message], 500);
    }
  }

  // ── 3. Duplicate Mobile Check ───────────────────────────────────────
  async checkDuplicate(req, res) {
    try {
      const mobile = req.body.mobile || req.body.phone || req.body.mobile_number;
      const customerId = req.body.customerId || req.body.customer_id;

      if (!mobile || !mobile.trim()) {
        return errorRes(res, 'Mobile number is required.', [], 400);
      }

      // Normalize to +91 format for consistent matching
      let cleanMobile = mobile.trim();
      const digits = cleanMobile.replace(/\D/g, '');
      if (digits.length === 10) cleanMobile = `+91${digits}`;
      else if (digits.length === 12 && digits.startsWith('91')) cleanMobile = `+${digits}`;
      else if (digits.length === 11 && digits.startsWith('0')) cleanMobile = `+91${digits.slice(1)}`;

      const { clause: locClause, params } = resolveLocFilter(req, 'w');

      let sql = `
        SELECT w.id, w.customer_code, w.customer_name, w.mobile_number, w.customer_status,
               w.assigned_telecaller, w.email, w.wedding_date, w.expected_shopping_date,
               w.follow_up_date, w.created_at, l.location_name, l.location_code
        FROM wedding_customers w
        LEFT JOIN locations l ON l.id = w.location_id
        WHERE (w.mobile_number = ? OR w.mobile_number = ?) AND w.is_deleted = 0 ${locClause}
      `;
      // Search both normalized and raw forms
      const queryParams = [cleanMobile, digits.length === 10 ? digits : cleanMobile, ...params];

      if (customerId) {
        sql += ` AND w.id != ?`;
        queryParams.push(parseInt(customerId, 10));
      }

      sql += ` ORDER BY w.created_at DESC`;

      const [rows] = await pool.query(sql, queryParams);

      if (rows && rows.length > 0) {
        return successRes(res, {
          exists: true,
          count: rows.length,
          customer: rows[0],
          existingCustomer: rows[0],
          allRecords: rows
        }, 'Existing customer found with this mobile number.');
      }

      return successRes(res, { exists: false }, 'Mobile number is available.');
    } catch (err) {
      console.error('[WeddingController.checkDuplicate Error]', err);
      return errorRes(res, 'Unable to verify mobile number. Please try again.', [err.message], 500);
    }
  }

  // ── 4. Create Wedding Customer ──────────────────────────────────────
  async createCustomer(req, res) {
    try {
      await ensureTables();
      const customerName = (req.body.customer_name || req.body.customerName || '').trim();
      let mobileNumber = (req.body.mobile_number || req.body.phone || req.body.mobile || '').trim();

      // Normalize phone to +91 format
      if (mobileNumber) {
        const digits = mobileNumber.replace(/\D/g, '');
        if (digits.length === 10) mobileNumber = `+91${digits}`;
        else if (digits.length === 12 && digits.startsWith('91')) mobileNumber = `+${digits}`;
        else if (digits.length === 11 && digits.startsWith('0')) mobileNumber = `+91${digits.slice(1)}`;
      }
      const email = (req.body.email || '').trim() || null;
      const alternateMobile = (req.body.alternate_mobile || req.body.alternateMobile || '').trim() || null;
      const weddingDate = parseDate(req.body.wedding_date || req.body.weddingDate);
      const expectedShoppingDate = parseDate(req.body.expected_shopping_date || req.body.expectedShoppingDate);
      const preferredCategory = req.body.preferred_shopping_category || req.body.preferredShoppingCategory || (Array.isArray(req.body.shopping_categories) ? req.body.shopping_categories.join(', ') : req.body.shopping_categories) || 'General Wedding Shopping';
      const estimatedFamilySize = (req.body.estimated_family_size !== undefined && req.body.estimated_family_size !== null && req.body.estimated_family_size !== '')
        ? parseInt(req.body.estimated_family_size, 10)
        : (req.body.estimatedFamilySize !== undefined && req.body.estimatedFamilySize !== null && req.body.estimatedFamilySize !== '' ? parseInt(req.body.estimatedFamilySize, 10) : null);
      let assignedTelecaller = (req.body.assigned_telecaller || req.body.assignedTelecaller || '').trim() || null;
      let assignedTelecallerId = req.body.assigned_telecaller_id ? parseInt(req.body.assigned_telecaller_id, 10) : null;
      // follow_up_date: if not provided, default to 3 days from today
      const defaultFollowUp = new Date();
      defaultFollowUp.setDate(defaultFollowUp.getDate() + 3);
      const defaultFollowUpStr = defaultFollowUp.toISOString().slice(0, 10);
      const followUpDate = parseDate(req.body.follow_up_date || req.body.followUpDate) || defaultFollowUpStr;
      const preferredCallTime = req.body.preferred_call_time || req.body.preferredCallTime || 'Morning (10 AM - 1 PM)';
      const customerNotes = req.body.customer_notes || req.body.customerNotes || req.body.initial_notes || null;
      const budget = (req.body.budget || req.body.budget_range || '').trim() || null;
      const leadSource = (req.body.lead_source || req.body.leadSource || 'In-store Walkin').trim();
      const priority = (req.body.priority || 'Medium').trim();
      const requestedLocationId = req.body.location_id || req.body.locationId;

      if (!customerName) {
        return errorRes(res, 'Customer name is required', [], 400);
      }
      if (!mobileNumber) {
        return errorRes(res, 'Mobile number is required', [], 400);
      }

      // Enforce location security: branch user strictly locked to their location
      let locationId = req.user ? req.user.locationId : null;
      if (!locationId) {
        // Global admin can specify location or defaults to 2 (Davanagere)
        locationId = requestedLocationId ? parseInt(requestedLocationId, 10) : 2;
      }
      if (!locationId || isNaN(locationId) || locationId <= 0) {
        locationId = 2;
      }

      // Fetch location code for code generation
      const [locRows] = await pool.query(`SELECT location_code FROM locations WHERE id = ?`, [locationId]);
      const locCode = locRows[0]?.location_code || 'BSC';

      // Duplicate mobile check per location — return existing info instead of hard-blocking
      const [dup] = await pool.query(`
        SELECT id, customer_code, customer_name, customer_status, assigned_telecaller,
               wedding_date, follow_up_date, created_at
        FROM wedding_customers 
        WHERE mobile_number = ? AND location_id = ? AND is_deleted = 0
      `, [mobileNumber, locationId]);

      // If caller explicitly wants to link to existing customer, skip duplicate block
      const forceNew = req.body.force_create_new_registration === true || req.body.link_to_existing === true;

      // A forced new journey for a known mobile is a repeat customer: the prior
      // row is left completely untouched and only referenced from the new one.
      const linkedPreviousId = (dup && dup.length > 0 && forceNew) ? dup[0].id : null;

      if (dup && dup.length > 0 && !forceNew) {
        return errorRes(res, `A customer with mobile ${mobileNumber} already exists (${dup[0].customer_name} — ${dup[0].customer_code}). To create a new wedding registration for this customer, please use the "Link New Wedding Request" option.`, [{ existingCustomer: dup[0] }], 409);
      }

      // If assigned_telecaller_id provided without name, find name
      if (assignedTelecallerId && !assignedTelecaller) {
        const [u] = await pool.query(`SELECT full_name FROM users WHERE id = ?`, [assignedTelecallerId]);
        if (u && u.length > 0) assignedTelecaller = u[0].full_name;
      }
      if (!assignedTelecaller || assignedTelecaller === 'Staff') {
        try {
          const telecallerAssignmentService = require('../services/telecallerAssignmentService');
          const autoAssigned = await telecallerAssignmentService.getEligibleTelecaller({
            locationId,
            connection: pool
          });
          if (autoAssigned) {
            assignedTelecaller = autoAssigned.full_name;
            assignedTelecallerId = autoAssigned.id;
          } else {
            assignedTelecaller = req.user?.fullName || 'Staff';
            assignedTelecallerId = req.user?.id || null;
          }
        } catch (assignErr) {
          assignedTelecaller = req.user?.fullName || 'Staff';
          assignedTelecallerId = req.user?.id || null;
        }
      }

      // Generate standardized code: BSC-WED-{LOC}-{YEAR}-{NNNNNN}
      const customerCode = await allocateCustomerCode(pool, locCode, 'current');
      if (!customerCode) {
        return errorRes(res, 'Unable to allocate a unique registration ID. Please try again.', [], 500);
      }

      let safeWeddingDate = weddingDate || null;
      let safeExpectedShoppingDate = expectedShoppingDate || null;

      let newId;
      try {
        const [insertResult] = await pool.query(`
          INSERT INTO wedding_customers (
            customer_code,
            location_id,
            customer_name,
            mobile_number,
            alternate_mobile,
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
            budget,
            lead_source,
            priority,
            customer_status,
            call_status,
            total_calls_count,
            created_by,
            created_by_user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', 'Pending', 0, ?, ?)
        `, [
          customerCode,
          locationId,
          customerName,
          mobileNumber,
          alternateMobile,
          email,
          safeWeddingDate,
          safeExpectedShoppingDate,
          preferredCategory,
          estimatedFamilySize || 1,
          assignedTelecaller,
          assignedTelecallerId,
          followUpDate,
          preferredCallTime,
          encryptField(customerNotes),
          budget,
          leadSource,
          priority,
          req.user?.fullName || 'Staff',
          req.user?.id || null
        ]);
        newId = insertResult.insertId;
      } catch (insertErr) {
        console.warn('[WeddingController.createCustomer] Primary insert failed:', insertErr.message);

        // Attempt on-the-fly column nullability repairs
        if (/expected_shopping_date/i.test(insertErr.message)) {
          await pool.query("ALTER TABLE wedding_customers MODIFY COLUMN expected_shopping_date DATE NULL DEFAULT NULL").catch(() => {});
        }
        if (/wedding_date/i.test(insertErr.message)) {
          await pool.query("ALTER TABLE wedding_customers MODIFY COLUMN wedding_date DATE NULL DEFAULT NULL").catch(() => {});
        }
        if (/follow_up_date/i.test(insertErr.message)) {
          await pool.query("ALTER TABLE wedding_customers MODIFY COLUMN follow_up_date DATE NULL DEFAULT NULL").catch(() => {});
        }

        try {
          const [fallbackResult] = await pool.query(`
            INSERT INTO wedding_customers (
              customer_code,
              location_id,
              customer_name,
              mobile_number,
              email,
              wedding_date,
              expected_shopping_date,
              preferred_shopping_category,
              estimated_family_size,
              assigned_telecaller,
              follow_up_date,
              preferred_call_time,
              customer_notes,
              customer_status,
              call_status,
              total_calls_count
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', 'Pending', 0)
          `, [
            customerCode,
            locationId,
            customerName,
            mobileNumber,
            email,
            safeWeddingDate,
            safeExpectedShoppingDate,
            preferredCategory,
            estimatedFamilySize || 1,
            assignedTelecaller,
            followUpDate,
            preferredCallTime,
            encryptField(customerNotes)
          ]);
          newId = fallbackResult.insertId;
        } catch (fallbackErr) {
          console.warn('[WeddingController.createCustomer] Fallback insert failed, attempting minimal safe insert:', fallbackErr.message);

          // If the DB strictly requires a non-null date for expected_shopping_date or wedding_date, provide valid date
          const todayIso = new Date().toISOString().slice(0, 10);
          const activeShoppingDate = safeExpectedShoppingDate || todayIso;
          const activeWeddingDate = safeWeddingDate || todayIso;

          const [minimalResult] = await pool.query(`
            INSERT INTO wedding_customers (
              customer_code,
              location_id,
              customer_name,
              mobile_number,
              wedding_date,
              expected_shopping_date,
              preferred_shopping_category,
              follow_up_date,
              customer_status,
              call_status,
              total_calls_count
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'New', 'Pending', 0)
          `, [
            customerCode,
            locationId,
            customerName,
            mobileNumber,
            activeWeddingDate,
            activeShoppingDate,
            preferredCategory || 'General Wedding Shopping',
            followUpDate || todayIso
          ]);
          newId = minimalResult.insertId;

          // If user had not entered dates, attempt to clean them to NULL in background
          if (!expectedShoppingDate) {
            pool.query('UPDATE wedding_customers SET expected_shopping_date = NULL WHERE id = ?', [newId]).catch(() => {});
          }
          if (!weddingDate) {
            pool.query('UPDATE wedding_customers SET wedding_date = NULL WHERE id = ?', [newId]).catch(() => {});
          }
        }

        // Progressively apply optional fields if columns exist
        if (budget) pool.query('UPDATE wedding_customers SET budget = ? WHERE id = ?', [budget, newId]).catch(() => {});
        if (leadSource) pool.query('UPDATE wedding_customers SET lead_source = ? WHERE id = ?', [leadSource, newId]).catch(() => {});
        if (priority) pool.query('UPDATE wedding_customers SET priority = ? WHERE id = ?', [priority, newId]).catch(() => {});
        if (alternateMobile) pool.query('UPDATE wedding_customers SET alternate_mobile = ? WHERE id = ?', [alternateMobile, newId]).catch(() => {});
        if (assignedTelecallerId) pool.query('UPDATE wedding_customers SET assigned_telecaller_id = ? WHERE id = ?', [assignedTelecallerId, newId]).catch(() => {});
        if (customerNotes) pool.query('UPDATE wedding_customers SET customer_notes = ? WHERE id = ?', [encryptField(customerNotes), newId]).catch(() => {});
        if (preferredCallTime) pool.query('UPDATE wedding_customers SET preferred_call_time = ? WHERE id = ?', [preferredCallTime, newId]).catch(() => {});
        if (req.user?.fullName) pool.query('UPDATE wedding_customers SET created_by = ?, created_by_user_id = ? WHERE id = ?', [req.user.fullName, req.user.id || null, newId]).catch(() => {});
      }

      // Repeat customer: the new journey points back at the archived original so
      // both stay separately traceable. The previous record is never modified.
      if (forceNew && dup && dup.length > 0) {
        try {
          await pool.query(`UPDATE wedding_customers SET previous_customer_id = ? WHERE id = ?`, [dup[0].id, newId]);
          await pool.query(`
            INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details)
            VALUES (?, ?, ?, 'New Journey Linked', ?)
          `, [
            newId,
            locationId,
            req.user?.fullName || 'Staff',
            `New wedding journey linked to previous customer ${dup[0].customer_name} (${dup[0].customer_code}). Previous record preserved unchanged.`
          ]);
        } catch (_linkErr) {
          console.warn('[WeddingController.createCustomer] Previous link non-fatal warning:', _linkErr.message);
        }
      }

      // Audit Log (guarded non-fatal)
      try {
        await pool.query(`
          INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details)
          VALUES (?, ?, ?, 'Customer Added', ?)
        `, [
          newId,
          locationId,
          req.user?.fullName || 'Staff',
          `Created wedding customer ${customerName} (${customerCode}). Expected shopping: ${expectedShoppingDate || 'N/A'}, Follow-up: ${followUpDate}`
        ]);
      } catch (_auditErr) {
        console.warn('[WeddingController.createCustomer] Audit log non-fatal warning:', _auditErr.message);
      }

      // Cache & Bloom Filter (guarded non-fatal)
      try {
        await bfAdd('wedding_customers_bf', newId.toString());
        await delCachePattern('app:prod:wedding:dashboard:*');
      } catch (_cacheErr) {}

      // Realtime event emit (guarded non-fatal)
      try {
        realtimeService.emitWeddingChange('CREATE', { id: newId, customer_code: customerCode, customer_name: customerName }, locationId);
      } catch (_rtErr) {}

      return successRes(res, {
        id: newId,
        customer_code: customerCode,
        customer: {
          id: newId,
          customer_code: customerCode,
          customer_name: customerName,
          mobile_number: mobileNumber,
          location_id: locationId
        }
      }, 'Customer created successfully.', 201);
    } catch (err) {
      console.error('[WeddingController.createCustomer Error]', err);
      return errorRes(res, 'Failed to add wedding customer. ' + (err.message || ''), [err.message], 500);
    }
  }

  // ── 5. Get Customer Profile & Full History ──────────────────────────
  async getCustomerById(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      
      // 1. Bloom Filter Check
      const mightExist = await bfExists('wedding_customers_bf', id.toString());
      if (!mightExist) {
        // Definitely doesn't exist, avoid DB hit completely
        return errorRes(res, 'Customer not found or access denied', [], 404);
      }

      const { clause: locClause, params } = resolveLocFilter(req, 'w');
      const cacheKey = `app:prod:wedding:customer:${id}:${req.user?.locationId || 'global'}:${req.user?.role || 'anon'}`;
      
      const cached = await getCache(cacheKey);
      if (cached) {
        return successRes(res, cached, 'Customer details retrieved from cache');
      }

      // Stampede protection
      let lockAcquired = false;
      const lockKey = `${cacheKey}:lock`;
      if (isReady()) {
        lockAcquired = await acquireLock(lockKey, 5);
        if (!lockAcquired) {
          await new Promise(r => setTimeout(r, 100));
          const retryCache = await getCache(cacheKey);
          if (retryCache) return successRes(res, retryCache, 'Customer details retrieved from cache');
        }
      }

      const [rows] = await pool.query(`
        SELECT 
          w.*,
          l.location_code,
          l.location_name,
          CASE 
            WHEN w.follow_up_date < CURDATE() AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed')
            THEN DATEDIFF(CURDATE(), w.follow_up_date)
            ELSE 0 
          END AS overdue_days
        FROM wedding_customers w
        LEFT JOIN locations l ON l.id = w.location_id
        WHERE w.id = ? AND w.is_deleted = 0 ${locClause}
      `, [id, ...params]);

      if (!rows || rows.length === 0) {
        if (lockAcquired) await releaseLock(lockKey);
        // IDOR URL-tampering check: does customer exist under another store?
        const [anyCust] = await pool.query(`SELECT id, location_id FROM wedding_customers WHERE id = ? AND is_deleted = 0 LIMIT 1`, [id]);
        if (anyCust && anyCust.length > 0) {
          const { record403Violation } = require('../middleware/suspiciousActivityTracker');
          const violation = record403Violation(req, res, `Cross-store URL tampering: user tried accessing customer #${id} from another location`);
          const msg = violation.forceLogout
            ? 'Session expired. Please log in again.'
            : 'Access denied: You do not have permission to view customer records from other store locations.';
          return res.status(403).json({
            success: false,
            message: msg,
            forceLogout: violation.forceLogout,
            violationCount: violation.violationCount
          });
        }
        return errorRes(res, 'Customer not found or access denied', [], 404);
      }

      const customer = rows[0];

      // IDOR protection: Telecallers may inspect their assigned customers, auto-assigned, or customers belonging to their assigned store location
      if (req.user && ['Telecaller', 'CRM Executive', 'VM Extension Telecaller'].includes(req.user.role)) {
        const matchesAssignedId = customer.assigned_telecaller_id === req.user.id;
        const matchesAssignedName = customer.assigned_telecaller &&
          customer.assigned_telecaller.toLowerCase() === (req.user.fullName || req.user.username || '').toLowerCase();
        const matchesLocation = req.user.locationId && Number(customer.location_id) === Number(req.user.locationId);
        const isUnassignedOrAuto = !customer.assigned_telecaller ||
          ['auto-assigned', 'unassigned', ''].includes(String(customer.assigned_telecaller).toLowerCase().trim());

        if (!matchesAssignedId && !matchesAssignedName && !matchesLocation && !isUnassignedOrAuto) {
          if (lockAcquired) await releaseLock(lockKey);
          return errorRes(res, 'Access denied: Customer is not assigned to your calling queue', [], 403);
        }
      }

      decryptRow(customer, ENCRYPTED_FIELDS);

      // Call logs timeline
      const [callLogs] = await pool.query(`
        SELECT * FROM wedding_call_logs
        WHERE customer_id = ?
        ORDER BY call_date DESC, id DESC
      `, [id]);
      decryptRows(callLogs, CALL_LOG_ENCRYPTED_FIELDS);

      // Audit trail
      const [auditLogs] = await pool.query(`
        SELECT * FROM wedding_audit_logs 
        WHERE customer_id = ? 
        ORDER BY created_at DESC
      `, [id]);

      const data = {
        customer,
        callLogs: callLogs || [],
        timeline: callLogs || [],
        auditLogs: auditLogs || []
      };

      await setCache(cacheKey, data, 120); // Cache for 2 minutes
      if (lockAcquired) await releaseLock(lockKey);

      return successRes(res, data, 'Customer details retrieved successfully');
    } catch (err) {
      if (lockAcquired) await releaseLock(lockKey).catch(() => {});
      console.error('[WeddingController.getCustomerById Error]', err);
      return errorRes(res, 'Failed to retrieve customer', [err.message], 500);
    }
  }

  // ── 6. Update Customer Details (CRUD) ───────────────────────────────
  async updateCustomer(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const { clause: locClause, params: locParams } = resolveLocFilter(req, 'w');

      const [existing] = await pool.query(`
        SELECT * FROM wedding_customers w WHERE w.id = ? AND w.is_deleted = 0 ${locClause}
      `, [id, ...locParams]);

      if (!existing || existing.length === 0) {
        const [anyCust] = await pool.query(`SELECT id, location_id FROM wedding_customers WHERE id = ? AND is_deleted = 0 LIMIT 1`, [id]);
        if (anyCust && anyCust.length > 0) {
          const { record403Violation } = require('../middleware/suspiciousActivityTracker');
          const violation = record403Violation(req, res, `Cross-store URL tampering: user tried modifying customer #${id} from another location`);
          const msg = violation.forceLogout
            ? 'Session expired. Please log in again.'
            : 'Access denied: You do not have permission to update customer records from other store locations.';
          return res.status(403).json({
            success: false,
            message: msg,
            forceLogout: violation.forceLogout,
            violationCount: violation.violationCount
          });
        }
        return errorRes(res, 'Customer not found or unauthorized', [], 404);
      }

      const prev = existing[0];
      const customerName = req.body.customer_name || req.body.customerName;
      let mobileNumber = req.body.mobile_number || req.body.phone || req.body.mobile;
      
      // Normalize phone to +91 format
      if (mobileNumber && typeof mobileNumber === 'string') {
        const digits = mobileNumber.replace(/\D/g, '');
        if (digits.length === 10) mobileNumber = `+91${digits}`;
        else if (digits.length === 12 && digits.startsWith('91')) mobileNumber = `+${digits}`;
        else if (digits.length === 11 && digits.startsWith('0')) mobileNumber = `+91${digits.slice(1)}`;
      }
      const email = req.body.email;
      // `undefined` means the caller did not send the field (keep the stored
      // value); a sent-but-empty/invalid value normalises to null so MySQL is
      // never handed a string it would coerce to the zero date.
      const weddingDateRaw = req.body.wedding_date ?? req.body.weddingDate;
      const weddingDate = weddingDateRaw === undefined ? undefined : parseDate(weddingDateRaw);
      const expectedShoppingDateRaw = req.body.expected_shopping_date ?? req.body.expectedShoppingDate;
      const expectedShoppingDate = expectedShoppingDateRaw === undefined ? undefined : parseDate(expectedShoppingDateRaw);
      const preferredCategory = req.body.preferred_shopping_category || req.body.preferredShoppingCategory || req.body.shopping_categories;
      const estimatedFamilySize = req.body.estimated_family_size || req.body.estimatedFamilySize;
      const assignedTelecaller = req.body.assigned_telecaller || req.body.assignedTelecaller;
      const assignedTelecallerId = req.body.assigned_telecaller_id || req.body.assignedTelecallerId;
      const followUpDateRaw = req.body.follow_up_date ?? req.body.followUpDate;
      const followUpDate = followUpDateRaw === undefined ? undefined : parseDate(followUpDateRaw);
      const preferredCallTime = req.body.preferred_call_time || req.body.preferredCallTime;
      const customerNotes = req.body.customer_notes || req.body.customerNotes || req.body.initial_notes;
      let customerStatus = req.body.customer_status || req.body.customerStatus || req.body.current_status;
      const callStatus = req.body.call_status || req.body.callStatus;
      const budget = req.body.budget !== undefined ? req.body.budget : (req.body.budget_range || req.body.budgetRange);
      const leadSource = req.body.lead_source || req.body.leadSource;
      const brideName = req.body.bride_name || req.body.brideName;
      const groomName = req.body.groom_name || req.body.groomName;
      const alternateMobile = req.body.alternate_mobile || req.body.alternateMobile || req.body.alternate_phone;
      const weddingCity = req.body.wedding_city || req.body.weddingCity || req.body.city;
      const locationId = req.body.location_id !== undefined ? Number(req.body.location_id) : (req.body.locationId !== undefined ? Number(req.body.locationId) : undefined);

      // Duplicate check if mobile is being changed
      if (mobileNumber && mobileNumber.trim() !== prev.mobile_number) {
        const [dup] = await pool.query(`
          SELECT id FROM wedding_customers 
          WHERE mobile_number = ? AND location_id = ? AND id != ? AND is_deleted = 0
        `, [mobileNumber.trim(), prev.location_id, id]);

        if (dup && dup.length > 0) {
          return errorRes(res, `Another customer already exists with mobile ${mobileNumber}`, [], 409);
        }
      }

      // Editing an archived record's details is allowed, but its terminal status
      // is pinned so an edit can never quietly pull it back into the pipeline.
      const editingArchived = prev.lifecycle_status === 'OLD_CUSTOMER';
      if (editingArchived && customerStatus && customerStatus !== prev.customer_status) {
        customerStatus = prev.customer_status;
      }

      await pool.query(`
        UPDATE wedding_customers SET
          customer_name = ?,
          mobile_number = ?,
          email = ?,
          wedding_date = ?,
          expected_shopping_date = ?,
          preferred_shopping_category = ?,
          estimated_family_size = ?,
          assigned_telecaller = ?,
          assigned_telecaller_id = ?,
          follow_up_date = ?,
          preferred_call_time = ?,
          customer_notes = ?,
          customer_status = ?,
          call_status = ?,
          budget = ?,
          budget_range = ?,
          lead_source = ?,
          bride_name = ?,
          groom_name = ?,
          alternate_mobile = ?,
          wedding_city = ?,
          location_id = ?
        WHERE id = ?
      `, [
        customerName ? customerName.trim() : prev.customer_name,
        mobileNumber ? mobileNumber.trim() : prev.mobile_number,
        email !== undefined ? (email ? email.trim() : null) : prev.email,
        weddingDate !== undefined ? weddingDate : prev.wedding_date,
        expectedShoppingDate !== undefined ? expectedShoppingDate : prev.expected_shopping_date,
        preferredCategory || prev.preferred_shopping_category,
        estimatedFamilySize ? parseInt(estimatedFamilySize, 10) : prev.estimated_family_size,
        assignedTelecaller || prev.assigned_telecaller,
        assignedTelecallerId ? parseInt(assignedTelecallerId, 10) : prev.assigned_telecaller_id,
        followUpDate || prev.follow_up_date,
        preferredCallTime || prev.preferred_call_time,
        customerNotes !== undefined ? encryptField(customerNotes) : prev.customer_notes,
        customerStatus || prev.customer_status,
        callStatus || prev.call_status,
        budget !== undefined ? budget : prev.budget,
        budget !== undefined ? budget : prev.budget_range,
        leadSource !== undefined ? leadSource : prev.lead_source,
        brideName !== undefined ? brideName : prev.bride_name,
        groomName !== undefined ? groomName : prev.groom_name,
        alternateMobile !== undefined ? alternateMobile : prev.alternate_mobile,
        weddingCity !== undefined ? weddingCity : prev.wedding_city,
        locationId !== undefined && !isNaN(locationId) && locationId > 0 ? locationId : prev.location_id,
        id
      ]);

      // Journey fields the main statement above has never carried. Applied as a
      // second, whitelisted update so a partial edit cannot blank stored data.
      const extended = buildExtendedFieldUpdate(req.body);
      if (extended.error) {
        return errorRes(res, extended.error, [], 400);
      }
      if (extended.sets.length) {
        await pool.query(
          `UPDATE wedding_customers SET ${extended.sets.join(', ')} WHERE id = ?`,
          [...extended.params, id]
        );
      }

      // Audit log — separate telecaller assignment tracking
      const changes = [];
      if (customerStatus && customerStatus !== prev.customer_status) changes.push(`Status: ${prev.customer_status} → ${customerStatus}`);
      if (followUpDate && followUpDate !== prev.follow_up_date) changes.push(`Follow-up: ${prev.follow_up_date} → ${followUpDate}`);
      if (expectedShoppingDate && expectedShoppingDate !== prev.expected_shopping_date) changes.push(`Shopping Date: ${prev.expected_shopping_date} → ${expectedShoppingDate}`);
      extended.sets.forEach((s) => {
        const column = s.split(' = ')[0];
        changes.push(`${camelCase(column)} updated`);
      });

      // Track telecaller assignment/reassignment as a distinct audit action
      const telecallerChanged = assignedTelecaller && assignedTelecaller !== prev.assigned_telecaller;
      if (telecallerChanged) {
        const isReassign = prev.assigned_telecaller && prev.assigned_telecaller !== 'Auto-Assigned' && prev.assigned_telecaller !== 'Staff';
        const auditAction = isReassign ? 'Telecaller Reassigned' : 'Telecaller Assigned';
        const auditDetail = isReassign
          ? `Telecaller reassigned from ${prev.assigned_telecaller} to ${assignedTelecaller}`
          : `Telecaller assigned: ${assignedTelecaller}`;
        await pool.query(`
          INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details)
          VALUES (?, ?, ?, ?, ?)
        `, [id, prev.location_id, req.user?.fullName || 'Staff', auditAction, auditDetail]);
      }

      // General edit audit log
      if (changes.length > 0 || !telecallerChanged) {
        await pool.query(`
          INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details)
          VALUES (?, ?, ?, 'Customer Edited', ?)
        `, [
          id,
          prev.location_id,
          req.user?.fullName || 'Staff',
          changes.length > 0 ? changes.join(', ') : 'Updated customer profile details'
        ]);
      }

      await delCachePattern(`app:prod:wedding:customer:${id}:*`);
      await delCachePattern('app:prod:wedding:dashboard:*');

      let archivedNow = false;
      if (!editingArchived && customerStatus && COMPLETION_STATUSES.has(String(customerStatus).trim())) {
        const result = await archiveCustomerAsOld(id, req.user, {
          completedStatus: String(customerStatus).trim(),
          previousStatus: prev.customer_status,
          reason: 'Wedding process completed'
        });
        archivedNow = result.archived;
      }

      // Professional success message based on what was changed
      let successMsg = 'Customer details updated successfully.';
      if (telecallerChanged && changes.length === 0) {
        const isReassign = prev.assigned_telecaller && prev.assigned_telecaller !== 'Auto-Assigned' && prev.assigned_telecaller !== 'Staff';
        successMsg = isReassign ? 'Telecaller reassigned successfully.' : 'Telecaller assigned successfully.';
      }
      if (archivedNow) successMsg = 'Customer completed and moved to Old Customers.';

      return successRes(res, {
        id,
        archived: archivedNow,
        lifecycle_status: archivedNow ? 'OLD_CUSTOMER' : prev.lifecycle_status
      }, successMsg);
    } catch (err) {
      console.error('[WeddingController.updateCustomer Error]', err);
      return errorRes(res, 'Failed to update customer', [err.message], 500);
    }
  }

  // ── 7. Soft Delete Customer ─────────────────────────────────────────
  async deleteCustomer(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const { clause: locClause, params } = resolveLocFilter(req, 'w');

      const [existing] = await pool.query(`
        SELECT * FROM wedding_customers w WHERE w.id = ? AND w.is_deleted = 0 ${locClause}
      `, [id, ...params]);

      if (!existing || existing.length === 0) {
        const [anyCust] = await pool.query(`SELECT id, location_id FROM wedding_customers WHERE id = ? AND is_deleted = 0 LIMIT 1`, [id]);
        if (anyCust && anyCust.length > 0) {
          const { record403Violation } = require('../middleware/suspiciousActivityTracker');
          const violation = record403Violation(req, res, `Cross-store URL tampering: user tried deleting customer #${id} from another location`);
          const msg = violation.forceLogout
            ? 'Session expired. Please log in again.'
            : 'Access denied: You do not have permission to delete customer records from other store locations.';
          return res.status(403).json({
            success: false,
            message: msg,
            forceLogout: violation.forceLogout,
            violationCount: violation.violationCount
          });
        }
        return errorRes(res, 'Customer not found or unauthorized', [], 404);
      }

      const prev = existing[0];

      // Permanent record protection. This is the control — the UI merely reflects
      // it, so a direct API call, bulk action or script hits the same wall.
      const isProtected = prev.lifecycle_status === 'OLD_CUSTOMER' || COMPLETION_STATUSES.has(prev.customer_status);
      if (isProtected) {
        await pool.query(`
          INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details)
          VALUES (?, ?, ?, 'Delete Blocked (Protected Record)', ?)
        `, [
          id,
          prev.location_id,
          req.user?.fullName || 'Staff',
          `Deletion refused for archived customer ${prev.customer_name} (${prev.customer_code}). Lifecycle: ${prev.lifecycle_status}, Status: ${prev.customer_status}.`
        ]);
        return res.status(403).json({
          success: false,
          message: 'Completed customer records are permanently protected.',
          code: 'OLD_CUSTOMER_PROTECTED'
        });
      }

      await pool.query(`
        UPDATE wedding_customers SET is_deleted = 1, deleted_at = NOW() WHERE id = ?
      `, [id]);

      await pool.query(`
        INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details)
        VALUES (?, ?, ?, 'Customer Deleted', ?)
      `, [
        id,
        prev.location_id,
        req.user?.fullName || 'Staff',
        `Archived customer ${prev.customer_name} (${prev.customer_code})`
      ]);

      await delCachePattern(`app:prod:wedding:customer:${id}:*`);
      await delCachePattern('app:prod:wedding:dashboard:*');

      return successRes(res, { id }, 'Customer record deleted successfully.');
    } catch (err) {
      console.error('[WeddingController.deleteCustomer Error]', err);
      return errorRes(res, 'Failed to delete customer', [err.message], 500);
    }
  }

  // ── 8. Log Call & Auto-manage Follow-up ──────────────────────────────
  async logCall(req, res) {
    try {
      const customerId = req.body.customerId || req.body.customer_id;
      const rawCallDate = req.body.callDate || req.body.call_date;
      const callTime = req.body.callTime || req.body.call_time;
      const callStatus = req.body.callStatus || req.body.call_status || 'Completed';
      const callOutcome = req.body.callOutcome || req.body.call_outcome || req.body.outcome;
      const remarks = req.body.remarks || req.body.call_notes || req.body.customer_feedback;
      const rawNextFollowUpDate = req.body.nextFollowUpDate || req.body.next_follow_up_date;
      const nextFollowUpTime = req.body.nextFollowUpTime || req.body.next_follow_up_time;
      const rawExpectedShoppingDate = req.body.expectedShoppingDate || req.body.expected_shopping_date;
      const callDuration = req.body.callDuration || req.body.call_duration || req.body.duration || null;
      const customerResponse = req.body.customerResponse || req.body.customer_response || null;

      if (!customerId) {
        return errorRes(res, 'Customer ID is required', [], 400);
      }
      if (!callOutcome) {
        return errorRes(res, 'Call outcome is required', [], 400);
      }

      // Sanitize dates to valid 'YYYY-MM-DD' or null to prevent MySQL truncation errors
      const sanitizeDate = (val) => {
        if (!val || typeof val !== 'string' || !val.trim()) return null;
        const clean = val.trim().slice(0, 10);
        return /^\d{4}-\d{2}-\d{2}$/.test(clean) ? clean : null;
      };

      const nextFollowUpDate = sanitizeDate(rawNextFollowUpDate);
      const expectedShoppingDate = sanitizeDate(rawExpectedShoppingDate);

      // Enforce strictness: Callback Requested mandates next_follow_up_date and next_follow_up_time
      const callbackOutcomes = ['Call Back Requested', 'Callback Requested', 'Callback', 'Call Back Later'];
      if (callbackOutcomes.includes(callOutcome)) {
        if (!nextFollowUpDate) {
          return errorRes(res, 'Next follow-up date is required when outcome is Call Back Requested', [], 400);
        }
        if (!nextFollowUpTime || !String(nextFollowUpTime).trim()) {
          return errorRes(res, 'Next follow-up time is required when outcome is Call Back Requested', [], 400);
        }
      }

      await ensureTables();

      // Branch users are isolated to their location, Global Admin can manage any
      const userLoc = req.user ? req.user.locationId : null;
      let locClause = '';
      let locParams = [];
      if (userLoc) {
        locClause = 'AND w.location_id = ?';
        locParams = [userLoc];
      }

      const [customers] = await pool.query(`
        SELECT * FROM wedding_customers w WHERE w.id = ? AND w.is_deleted = 0 ${locClause}
      `, [parseInt(customerId, 10), ...locParams]);

      if (!customers || customers.length === 0) {
        return errorRes(res, 'Customer not found or access denied', [], 404);
      }

      const cust = customers[0];

      // Archived customers are out of the active queue server-side too, so a
      // direct API call cannot re-open a completed journey.
      if (cust.lifecycle_status === 'OLD_CUSTOMER') {
        return res.status(409).json({
          success: false,
          message: 'This customer is archived in Old Customers. Restore the record before logging new calls.',
          code: 'OLD_CUSTOMER_READONLY'
        });
      }
      // Business date in the store's timezone (IST)
      const istToday = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const actualCallDate = sanitizeDate(rawCallDate) || istToday;
      const actualCallTime = callTime || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
      const telecallerName = req.user?.fullName || 'Telecaller';
      const telecallerId = req.user?.id || null;

      // 1. Insert into wedding_call_logs
      await pool.query(`
        INSERT INTO wedding_call_logs (
          customer_id,
          location_id,
          call_date,
          call_time,
          telecaller_name,
          telecaller_id,
          call_status,
          call_outcome,
          remarks,
          next_follow_up_date,
          next_follow_up_time,
          expected_shopping_date_updated,
          call_duration,
          customer_response
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        cust.id,
        cust.location_id,
        actualCallDate,
        actualCallTime,
        telecallerName,
        telecallerId,
        callStatus,
        callOutcome,
        encryptField(remarks || null),
        nextFollowUpDate || null,
        nextFollowUpTime || null,
        expectedShoppingDate || null,
        callDuration,
        customerResponse
      ]);

      // 2. Determine automated status transitions
      const rawOutcome = String(callOutcome).trim();
      let newCustomerStatus = cust.customer_status;
      let newCallStatus = 'Completed';

      if (/Shopping Confirmed/i.test(rawOutcome)) {
        newCustomerStatus = 'Shopping Date Confirmed';
        newCallStatus = 'Completed';
      } else if (/Visit Planned/i.test(rawOutcome)) {
        newCustomerStatus = 'Visit Planned';
        newCallStatus = 'Completed';
      } else if (/Interested/i.test(rawOutcome) && !/Not Interested/i.test(rawOutcome)) {
        newCustomerStatus = 'Interested';
        newCallStatus = 'Completed';
      } else if (/Not Interested/i.test(rawOutcome)) {
        newCustomerStatus = 'Not Interested';
        newCallStatus = 'Completed';
      } else if (/Call Back|Contact Later|Callback/i.test(rawOutcome)) {
        newCustomerStatus = 'Follow-up Pending';
        newCallStatus = 'Call Back Requested';
      } else if (/No Answer/i.test(rawOutcome)) {
        newCallStatus = 'No Answer';
      } else if (/Busy/i.test(rawOutcome)) {
        newCallStatus = 'Busy';
      } else if (/Switched Off/i.test(rawOutcome)) {
        newCallStatus = 'Switched Off';
      } else if (/Wrong Number/i.test(rawOutcome)) {
        newCallStatus = 'Wrong Number';
        newCustomerStatus = 'Cancelled';
      } else if (/Follow-?Up Required/i.test(rawOutcome)) {
        newCustomerStatus = 'Follow-up Pending';
        newCallStatus = 'Completed';
      } else if (/Connected/i.test(rawOutcome)) {
        if (newCustomerStatus === 'New' || newCustomerStatus === 'Follow-up Pending') {
          newCustomerStatus = 'Contacted';
        }
        newCallStatus = 'Connected';
      }

      // If caller manually passed new_customer_status, prioritize that
      if (req.body.new_customer_status || req.body.customer_status) {
        newCustomerStatus = req.body.new_customer_status || req.body.customer_status;
      }

      // 3. Update customer record
      const updateFields = [
        `total_calls_count = total_calls_count + 1`,
        `last_call_date = NOW()`,
        `last_call_outcome = ?`,
        `call_status = ?`,
        `customer_status = ?`,
        `last_contacted_by = ?`,
        `last_contacted_by_user_id = ?`,
        `last_updated_by = ?`,
        `last_updated_by_user_id = ?`,
        `updated_at = NOW()`
      ];
      const updateParams = [
        rawOutcome,
        newCallStatus,
        newCustomerStatus,
        telecallerName,
        telecallerId,
        telecallerName,
        telecallerId
      ];

      // Auto-assign telecaller if previously unassigned or 'Auto-Assigned'
      if (!cust.assigned_telecaller_id || !cust.assigned_telecaller || cust.assigned_telecaller === 'Auto-Assigned') {
        updateFields.push('assigned_telecaller = ?');
        updateParams.push(telecallerName);
        updateFields.push('assigned_telecaller_id = ?');
        updateParams.push(telecallerId);
      }

      // Schedule next follow-up if provided (unless Not Interested)
      if (rawOutcome !== 'Not Interested' && !/Not Interested/i.test(rawOutcome)) {
        if (nextFollowUpDate) {
          updateFields.push(`follow_up_date = ?`);
          updateParams.push(nextFollowUpDate);
        }
        if (nextFollowUpTime) {
          updateFields.push(`preferred_call_time = ?`);
          updateParams.push(nextFollowUpTime);
        }
      }

      // Update expected shopping date if confirmed
      if (expectedShoppingDate) {
        updateFields.push(`expected_shopping_date = ?`);
        updateParams.push(expectedShoppingDate);
      }

      if (remarks && remarks.trim()) {
        updateFields.push(`customer_notes = CONCAT(COALESCE(customer_notes, ''), '\n[', DATE_FORMAT(NOW(), '%d %b %Y, %h:%i %p'), ' - ', ?, ']: ', ?)`);
        updateParams.push(telecallerName, remarks.trim());
      }

      updateParams.push(cust.id);

      await pool.query(`
        UPDATE wedding_customers SET ${updateFields.join(', ')} WHERE id = ?
      `, updateParams);

      // 4. Audit Log
      await pool.query(`
        INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details)
        VALUES (?, ?, ?, 'Call Logged', ?)
      `, [
        cust.id,
        cust.location_id,
        telecallerName,
        `Logged call outcome: ${rawOutcome}. Status: ${newCustomerStatus}. ${nextFollowUpDate ? `Next call: ${nextFollowUpDate} (${nextFollowUpTime || 'General'})` : ''}`
      ]);

      let archivedNow = false;
      if (COMPLETION_STATUSES.has(String(newCustomerStatus).trim())) {
        const result = await archiveCustomerAsOld(cust.id, req.user, {
          completedStatus: String(newCustomerStatus).trim(),
          previousStatus: cust.customer_status,
          reason: 'Wedding process completed'
        });
        archivedNow = result.archived;
      }

      deskCache.clear();
      realtimeService.emitWeddingChange('CALL_LOGGED', {
        id: cust.id,
        customer_status: newCustomerStatus,
        call_status: newCallStatus,
        assigned_telecaller: cust.assigned_telecaller || telecallerName,
        last_contacted_by: telecallerName
      }, cust.location_id);

      return successRes(res, {
        customerId: cust.id,
        outcome: rawOutcome,
        customerStatus: newCustomerStatus,
        archived: archivedNow,
        lifecycle_status: archivedNow ? 'OLD_CUSTOMER' : cust.lifecycle_status,
        nextFollowUpDate,
        telecaller: telecallerName
      }, archivedNow ? 'Call saved. Wedding process completed — customer moved to Old Customers.' : 'Call activity saved successfully.');
    } catch (err) {
      console.error('[WeddingController.logCall Error]', err);
      return errorRes(res, 'Failed to log call', [err.message], 500);
    }
  }



  // ── 9. Telecaller Calling Desk Queue ─────────────────────────────────
  async getCallingDesk(req, res) {
    try {
      await ensureTables();
      const { clause: locClause, params: locParams } = resolveLocFilter(req, 'w');
      let clause = locClause;
      let params = [...locParams];

      // Telecaller scoping: telecallers access their assigned queue + unassigned store pool
      const userRoleNorm = String(req.user?.role || '').trim().toLowerCase().replace(/[_\s-]+/g, ' ');
      const isTelecallerScoped = [
        'telecaller', 'caller', 'tele-caller', 'tele caller',
        'vm extension telecaller', 'vm telecaller'
      ].includes(userRoleNorm);

      if (isTelecallerScoped && req.user) {
        const userFullName = String(req.user.fullName || req.user.username || '').trim();
        const userName = String(req.user.username || '').trim();
        clause += ` AND (
          w.assigned_telecaller_id = ? 
          OR (w.assigned_telecaller IS NOT NULL AND LOWER(TRIM(w.assigned_telecaller)) = LOWER(?))
          OR (w.assigned_telecaller IS NOT NULL AND LOWER(TRIM(w.assigned_telecaller)) = LOWER(?))
          OR w.assigned_telecaller IS NULL 
          OR w.assigned_telecaller = ''
          OR w.assigned_telecaller = 'Auto-Assigned'
        )`;
        params.push(req.user.id, userFullName, userName);
      }

      const cacheKey = `desk_${req.user ? req.user.id : 'anon'}_${JSON.stringify(locParams)}`;
      const cached = deskCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp < DESK_CACHE_TTL_MS)) {
        return res.json(cached.data);
      }

      const baseSelect = `
        SELECT 
          w.*,
          l.location_code,
          l.location_name,
          CASE 
            WHEN w.follow_up_date < CURDATE() THEN DATEDIFF(CURDATE(), w.follow_up_date)
            ELSE 0 
          END AS overdue_days
        FROM wedding_customers w
        LEFT JOIN locations l ON l.id = w.location_id
        WHERE w.is_deleted = 0 AND (w.lifecycle_status = 'ACTIVE' OR w.lifecycle_status IS NULL) ${clause}
      `;

      let apptWhere = '';
      let apptParams = [];
      if (req.user && req.user.locationId) {
        apptWhere += ' AND a.location_id = ?';
        apptParams.push(req.user.locationId);
      }

      // Parallelize counters and all desk queues concurrently
      const [
        [counterRows],
        [overdue],
        [dueToday],
        [callbackRequests],
        [upcoming],
        [priorityCalls],
        [newCustomers],
        [visitsPlanned],
        [myCustomers],
        [todayAppointments]
      ] = await Promise.all([
        pool.query(`
          SELECT 
            COUNT(*) AS assignedCalls,
            SUM(CASE WHEN w.follow_up_date = CURDATE() AND w.call_status IN ('Pending', 'Call Back Requested', 'No Answer', 'Busy') THEN 1 ELSE 0 END) AS pendingCalls,
            SUM(CASE WHEN w.last_call_date >= CURDATE() THEN 1 ELSE 0 END) AS completedToday,
            SUM(CASE WHEN w.call_status = 'Connected' THEN 1 ELSE 0 END) AS connectedCalls,
            SUM(CASE WHEN w.call_status = 'No Answer' AND w.follow_up_date <= CURDATE() THEN 1 ELSE 0 END) AS noAnswerCount,
            SUM(CASE WHEN w.call_status = 'Call Back Requested' THEN 1 ELSE 0 END) AS callbackCount,
            SUM(CASE WHEN w.customer_status = 'Shopping Date Confirmed' THEN 1 ELSE 0 END) AS shoppingConfirmedCount,
            SUM(CASE WHEN w.customer_status = 'Visit Planned' THEN 1 ELSE 0 END) AS visitsPlannedCount,
            SUM(CASE WHEN w.follow_up_date <= CURDATE() AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed') THEN 1 ELSE 0 END) AS remainingCalls
          FROM wedding_customers w
          WHERE w.is_deleted = 0 AND (w.lifecycle_status = 'ACTIVE' OR w.lifecycle_status IS NULL) ${clause}
        `, params),
        pool.query(`
          ${baseSelect}
          AND w.follow_up_date < CURDATE() 
          AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed')
          ORDER BY w.follow_up_date ASC, w.id ASC
          LIMIT 60
        `, params),
        pool.query(`
          ${baseSelect}
          AND w.follow_up_date = CURDATE()
          AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed')
          ORDER BY 
            CASE WHEN w.call_status = 'Call Back Requested' THEN 0 WHEN w.call_status = 'Pending' THEN 1 ELSE 2 END,
            w.id ASC
          LIMIT 60
        `, params),
        pool.query(`
          ${baseSelect}
          AND w.call_status = 'Call Back Requested'
          AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed')
          ORDER BY w.follow_up_date ASC, w.id ASC
          LIMIT 40
        `, params),
        pool.query(`
          ${baseSelect}
          AND w.follow_up_date > CURDATE() AND w.follow_up_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
          AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed')
          ORDER BY w.follow_up_date ASC, w.id ASC
          LIMIT 60
        `, params),
        pool.query(`
          ${baseSelect}
          AND w.customer_status = 'Shopping Date Confirmed'
          AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed')
          ORDER BY w.follow_up_date ASC, w.id ASC
          LIMIT 40
        `, params),
        pool.query(`
          ${baseSelect}
          AND w.customer_status = 'New'
          ORDER BY w.created_at DESC, w.id DESC
          LIMIT 40
        `, params),
        pool.query(`
          ${baseSelect}
          AND w.customer_status = 'Visit Planned'
          ORDER BY w.follow_up_date ASC, w.id ASC
          LIMIT 40
        `, params),
        pool.query(`
          SELECT 
            w.*,
            l.location_code,
            l.location_name,
            CASE 
              WHEN w.follow_up_date < CURDATE() THEN DATEDIFF(CURDATE(), w.follow_up_date)
              ELSE 0 
            END AS overdue_days
          FROM wedding_customers w
          LEFT JOIN locations l ON l.id = w.location_id
          WHERE w.is_deleted = 0 AND (w.lifecycle_status = 'ACTIVE' OR w.lifecycle_status IS NULL) ${locClause}
            AND (
              w.assigned_telecaller_id = ? 
              OR (w.assigned_telecaller IS NOT NULL AND LOWER(TRIM(w.assigned_telecaller)) = LOWER(?))
            )
          ORDER BY w.follow_up_date ASC, w.id DESC
          LIMIT 100
        `, [...locParams, req.user?.id || 0, String(req.user?.fullName || req.user?.username || '').trim()]),
        pool.query(`
          SELECT a.*, w.customer_name, w.mobile_number, w.customer_code
          FROM wedding_appointments a
          LEFT JOIN wedding_customers w ON w.id = a.customer_id
          WHERE a.appointment_date = CURDATE() ${apptWhere}
          ORDER BY a.appointment_time ASC
          LIMIT 30
        `, apptParams)
      ]);

      const sum = counterRows[0] || {};

      // Restore conversation history for the queues before returning (see ENCRYPTED_FIELDS)
      for (const q of [overdue, dueToday, callbackRequests, upcoming, priorityCalls, newCustomers, visitsPlanned, myCustomers]) {
        decryptRows(q, ENCRYPTED_FIELDS);
      }

      // Build deduplicated Smart Priority Queue (Overdue -> Due Today -> Callbacks -> New -> Confirmed -> Upcoming)
      const seenPriorityIds = new Set();
      const priorityQueue = [];
      const appendToPriority = (list, reasonTag) => {
        (list || []).forEach(item => {
          if (!seenPriorityIds.has(item.id)) {
            seenPriorityIds.add(item.id);
            priorityQueue.push({ ...item, priority_reason: reasonTag });
          }
        });
      };

      appendToPriority(overdue, 'Overdue Follow-up');
      appendToPriority(dueToday, 'Due Today');
      appendToPriority(callbackRequests, 'Callback Requested');
      appendToPriority(newCustomers, 'New Registration');
      appendToPriority(priorityCalls, 'Shopping Confirmed');
      appendToPriority(visitsPlanned, 'Visit Planned');
      appendToPriority(upcoming, 'Upcoming Call');

      const payload = {
        summary: {
          assignedCalls: Number(sum.assignedCalls) || 0,
          pendingCalls: Number(sum.pendingCalls) || 0,
          completedToday: Number(sum.completedToday) || 0,
          connectedCalls: Number(sum.connectedCalls) || 0,
          noAnswerCount: Number(sum.noAnswerCount) || 0,
          callbackCount: Number(sum.callbackCount) || 0,
          shoppingConfirmedCount: Number(sum.shoppingConfirmedCount) || priorityCalls.length,
          visitsPlannedCount: Number(sum.visitsPlannedCount) || visitsPlanned.length,
          remainingCalls: Number(sum.remainingCalls) || 0,
          myCustomersCount: myCustomers.length
        },
        counts: {
          overdue: overdue.length,
          due_today: dueToday.length,
          dueToday: dueToday.length,
          callbacks: callbackRequests.length,
          callbackRequests: callbackRequests.length,
          upcoming: upcoming.length,
          priority: priorityQueue.length,
          priorityCalls: priorityCalls.length,
          shopping_confirmed: priorityCalls.length,
          shoppingConfirmed: priorityCalls.length,
          visits_planned: visitsPlanned.length,
          visitsPlanned: visitsPlanned.length,
          my_customers: myCustomers.length,
          myCustomers: myCustomers.length,
          new_customers: newCustomers.length,
          newCustomers: newCustomers.length,
          appointments: todayAppointments.length,
          todayAppointments: todayAppointments.length,
          pending: Number(sum.pendingCalls) || 0,
          completed: Number(sum.completedToday) || 0,
          no_answer: Number(sum.noAnswerCount) || 0,
          remaining: Number(sum.remainingCalls) || 0
        },
        queues: {
          priority: priorityQueue || [],
          priorityQueue: priorityQueue || [],
          overdue: overdue || [],
          dueToday: dueToday || [],
          due_today: dueToday || [],
          callbackRequests: callbackRequests || [],
          callbacks: callbackRequests || [],
          upcoming: upcoming || [],
          priorityCalls: priorityCalls || [],
          shoppingConfirmed: priorityCalls || [],
          visitsPlanned: visitsPlanned || [],
          newCustomers: newCustomers || [],
          new_customers: newCustomers || [],
          myCustomers: myCustomers || [],
          my_customers: myCustomers || [],
          todayAppointments: todayAppointments || []
        }
      };

      deskCache.set(cacheKey, { timestamp: Date.now(), data: { success: true, message: 'Calling desk queue loaded successfully', data: payload } });

      return successRes(res, payload, 'Calling desk queue loaded successfully');
    } catch (err) {
      console.error('[WeddingController.getCallingDesk Error]', err);
      return errorRes(res, 'Failed to fetch calling desk', [err.message], 500);
    }
  }

  // ── 10. Date-wise Calendar ──────────────────────────────────────────
  async getCalendar(req, res) {
    try {
      const { year, month, date } = req.query;
      let targetYear = parseInt(year, 10);
      let targetMonth = parseInt(month, 10);

      if (typeof month === 'string' && month.includes('-')) {
        const parts = month.split('-');
        targetYear = parseInt(parts[0], 10);
        targetMonth = parseInt(parts[1], 10);
      }
      if (!targetYear || isNaN(targetYear)) targetYear = new Date().getFullYear();
      if (!targetMonth || isNaN(targetMonth)) targetMonth = new Date().getMonth() + 1;

      const { clause: locClause, params } = resolveLocFilter(req, 'w');

      const [rows] = await pool.query(`
        SELECT 
          DATE_FORMAT(w.follow_up_date, '%Y-%m-%d') AS date,
          COUNT(*) AS total,
          SUM(CASE WHEN w.follow_up_date < CURDATE() AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed') THEN 1 ELSE 0 END) AS overdue_count,
          SUM(CASE WHEN w.follow_up_date = CURDATE() THEN 1 ELSE 0 END) AS today_count,
          SUM(CASE WHEN w.customer_status = 'Shopping Date Confirmed' THEN 1 ELSE 0 END) AS shopping_confirmed_count,
          SUM(CASE WHEN w.call_status = 'Completed' THEN 1 ELSE 0 END) AS completed_count
        FROM wedding_customers w
        WHERE w.is_deleted = 0 
          AND (w.lifecycle_status = 'ACTIVE' OR w.lifecycle_status IS NULL)
          AND YEAR(w.follow_up_date) = ? 
          AND MONTH(w.follow_up_date) = ?
          ${locClause}
        GROUP BY DATE_FORMAT(w.follow_up_date, '%Y-%m-%d')
        ORDER BY date ASC
      `, [targetYear, targetMonth, ...params]);

      // All customers in that month for instant client-side date inspection
      const [allCustomersInMonth] = await pool.query(`
        SELECT 
          w.*,
          l.location_name,
          l.location_code,
          CASE 
            WHEN w.follow_up_date < CURDATE() AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed')
            THEN DATEDIFF(CURDATE(), w.follow_up_date)
            ELSE 0 
          END AS overdue_days
        FROM wedding_customers w
        LEFT JOIN locations l ON l.id = w.location_id
        WHERE w.is_deleted = 0 
          AND (w.lifecycle_status = 'ACTIVE' OR w.lifecycle_status IS NULL)
          AND YEAR(w.follow_up_date) = ? 
          AND MONTH(w.follow_up_date) = ?
          ${locClause}
        ORDER BY w.follow_up_date ASC, w.id DESC
      `, [targetYear, targetMonth, ...params]);

      decryptRows(allCustomersInMonth, ENCRYPTED_FIELDS);

      // Group customers by follow_up_date for day detail clicks
      const custsByDate = {};
      (allCustomersInMonth || []).forEach(c => {
        const dStr = c.follow_up_date ? String(c.follow_up_date).slice(0, 10) : null;
        if (dStr) {
          if (!custsByDate[dStr]) custsByDate[dStr] = [];
          custsByDate[dStr].push(c);
        }
      });

      const formattedDays = (rows || []).map(r => {
        const dStr = r.date ? String(r.date).slice(0, 10) : null;
        return {
          ...r,
          date: dStr,
          count: Number(r.total) || 0,
          customers: dStr && custsByDate[dStr] ? custsByDate[dStr] : []
        };
      });

      return successRes(res, {
        year: targetYear,
        month: targetMonth,
        days: formattedDays,
        calendarDays: formattedDays,
        customers: allCustomersInMonth || []
      }, 'Calendar follow-up data fetched successfully');
    } catch (err) {
      console.error('[WeddingController.getCalendar Error]', err);
      return errorRes(res, 'Failed to fetch calendar data', [err.message], 500);
    }
  }

  // ── 11. Analytics & Conversion Funnel ───────────────────────────────
  async getAnalytics(req, res) {
    try {
      const { clause: locClause, params } = resolveLocFilter(req, 'w');

      // 1. Conversion Funnel
      const [funnelRows] = await pool.query(`
        SELECT 
          COUNT(*) AS total_customers,
          SUM(CASE WHEN w.call_status IN ('Connected', 'Completed') OR w.total_calls_count > 0 THEN 1 ELSE 0 END) AS contacted,
          SUM(CASE WHEN w.customer_status IN ('Interested', 'Shopping Date Confirmed', 'Visited Store', 'Converted') THEN 1 ELSE 0 END) AS interested,
          SUM(CASE WHEN w.customer_status IN ('Shopping Date Confirmed', 'Visited Store', 'Converted') THEN 1 ELSE 0 END) AS shopping_confirmed,
          SUM(CASE WHEN w.customer_status IN ('Visited Store', 'Converted') THEN 1 ELSE 0 END) AS visited,
          SUM(CASE WHEN w.customer_status = 'Converted' THEN 1 ELSE 0 END) AS converted
        FROM wedding_customers w
        WHERE w.is_deleted = 0 ${locClause}
      `, params);

      // 2. Call outcomes breakdown
      const [outcomes] = await pool.query(`
        SELECT 
          COALESCE(w.last_call_outcome, 'No Calls Yet') AS outcome,
          COUNT(*) AS count
        FROM wedding_customers w
        WHERE w.is_deleted = 0 ${locClause}
        GROUP BY w.last_call_outcome
      `, params);

      // 3. Telecaller Performance Table
      const [telecallers] = await pool.query(`
        SELECT 
          COALESCE(w.assigned_telecaller, 'Unassigned') AS telecaller,
          COUNT(w.id) AS assigned_customers,
          SUM(CASE WHEN w.call_status = 'Completed' THEN 1 ELSE 0 END) AS calls_completed,
          SUM(CASE WHEN w.call_status = 'Connected' THEN 1 ELSE 0 END) AS connected,
          SUM(CASE WHEN w.call_status = 'No Answer' THEN 1 ELSE 0 END) AS no_answer,
          SUM(CASE WHEN w.call_status = 'Call Back Requested' THEN 1 ELSE 0 END) AS callbacks,
          SUM(CASE WHEN w.customer_status = 'Interested' THEN 1 ELSE 0 END) AS interested,
          SUM(CASE WHEN w.customer_status = 'Shopping Date Confirmed' THEN 1 ELSE 0 END) AS shopping_confirmed,
          SUM(CASE WHEN w.customer_status = 'Converted' THEN 1 ELSE 0 END) AS conversions,
          SUM(CASE WHEN w.follow_up_date <= CURDATE() AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed') THEN 1 ELSE 0 END) AS pending_followups
        FROM wedding_customers w
        WHERE w.is_deleted = 0 ${locClause}
        GROUP BY w.assigned_telecaller
        ORDER BY assigned_customers DESC
      `, params);

      return successRes(res, {
        funnel: funnelRows[0] || {},
        outcomes: outcomes || [],
        telecallers: telecallers || []
      }, 'Wedding analytics fetched successfully');
    } catch (err) {
      console.error('[WeddingController.getAnalytics Error]', err);
      return errorRes(res, 'Failed to fetch wedding analytics', [err.message], 500);
    }
  }

  // ── 12. List Telecallers for Assignment ─────────────────────────────
  async getTelecallers(req, res) {
    try {
      const userLoc = req.user ? req.user.locationId : null;
      // Global admins may narrow the dropdown to one branch via ?location_id
      let locFilter = null;
      if (!userLoc) {
        const requested = req.query.location_id || req.query.locationId;
        if (requested && requested !== 'all' && !isNaN(parseInt(requested, 10))) {
          locFilter = parseInt(requested, 10);
        }
      } else {
        locFilter = userLoc;
      }

      // Include Telecaller and related CRM roles for the assignment dropdown
      let sql = `
        SELECT u.id, u.username, u.full_name, u.employee_id, u.role, u.location_id, u.active,
               u.designation, u.department,
               l.location_name, l.location_code,
               (SELECT COUNT(*) FROM wedding_customers w
                 WHERE w.assigned_telecaller_id = u.id AND w.is_deleted = 0) AS assigned_count,
               (SELECT MAX(c.created_at) FROM wedding_call_logs c WHERE c.telecaller_id = u.id) AS last_activity
        FROM users u
        LEFT JOIN locations l ON l.id = u.location_id
        WHERE u.active = TRUE
          AND u.role IN ('Telecaller', 'CRM Executive', 'VM Extension Telecaller', 'VM Telecaller', 'Team Lead')
      `;
      const params = [];

      if (locFilter) {
        // Branch context: own-branch telecallers plus global (location-less) telecaller accounts
        sql += ` AND (u.location_id = ? OR u.location_id IS NULL)`;
        params.push(locFilter);
      }

      sql += ` ORDER BY u.full_name ASC`;

      const [users] = await pool.query(sql, params);

      // Map to consistent response shape with name alias for backward compatibility
      const telecallers = (users || []).map(u => ({
        id: u.id,
        username: u.username,
        full_name: u.full_name || u.username,
        name: u.full_name || u.username,  // backward compat alias
        employee_id: u.employee_id || `EMP-${u.id}`,
        role: u.role,
        designation: u.designation || u.role,
        department: u.department || null,
        location_id: u.location_id,
        location_name: u.location_name || 'All Locations',
        location_code: u.location_code || '',
        active: u.active,
        // Workload, so a manager can pick the free telecaller rather than the busiest
        // one without a second round trip.
        assigned_count: Number(u.assigned_count || 0),
        last_activity: u.last_activity || null
      }));

      return successRes(res, { telecallers }, 'Telecallers fetched successfully.');
    } catch (err) {
      console.error('[WeddingController.getTelecallers Error]', err);
      return errorRes(res, 'Unable to load telecaller list. Please try again.', [err.message], 500);
    }
  }


  // ── Template Download: Valid UTF-8 CSV with BOM and 3 sample rows ──
  async downloadCsvTemplate(req, res) {
    try {
      const csvData = buildTemplateCsv();

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${TEMPLATE_FILENAME_CSV}"`);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return res.status(200).send(csvData);
    } catch (err) {
      console.error('[WeddingController.downloadCsvTemplate Error]', err);
      if (!res.headersSent) {
        return res.status(500).json({ success: false, error: 'Failed to generate CSV template' });
      }
    }
  }

  // ── Template Download: Excel (.xlsx) — styled, validated, 2 sheets ──
  async downloadXlsxTemplate(req, res) {
    try {
      const [categories, telecallers] = await Promise.all([
        getTemplateCategories(),
        getTemplateTelecallers()
      ]);

      const workbook = await buildTemplateWorkbook({ categories, telecallers });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${TEMPLATE_FILENAME}"`);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      await workbook.xlsx.write(res);
      res.end();
    } catch (err) {
      console.error('[WeddingController.downloadXlsxTemplate Error]', err);
      if (!res.headersSent) {
        return res.status(500).json({ success: false, error: 'Failed to generate Excel template' });
      }
    }
  }

  // ── Import Error Report (.xlsx) returned for the failed rows ────
  async downloadErrorReport(req, res) {
    try {
      const body = req.body || {};
      const errors = Array.isArray(body.errors) ? body.errors : [];

      if (errors.length > MAX_IMPORT_ROWS) {
        return errorRes(
          res,
          `Too many rows in the error report (maximum ${MAX_IMPORT_ROWS}). Download the report for the first ${MAX_IMPORT_ROWS} rows.`,
          [], 400
        );
      }

      const workbook = buildErrorReportWorkbook({
        fileName: String(body.fileName || '').slice(0, 255),
        summary: String(body.summary || '').slice(0, 255),
        counts: body.counts && typeof body.counts === 'object' ? body.counts : {},
        errors
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${ERROR_REPORT_FILENAME}"`);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      await workbook.xlsx.write(res);
      res.end();
    } catch (err) {
      console.error('[WeddingController.downloadErrorReport Error]', err);
      if (!res.headersSent) {
        return errorRes(res, 'Failed to generate the error report', [err.message], 500);
      }
    }
  }

  // ── Import History (audit trail of every bulk import run) ──────
  async getImportLogs(req, res) {
    try {
      await ensureTables();

      const user = req.user || {};
      const params = [];
      let sql = `
        SELECT l.id, l.file_name, l.file_type, l.location_id, l.location_name,
               l.user_id, l.user_name, l.total_rows, l.imported_count,
               l.duplicate_count, l.error_count, l.status, l.summary, l.created_at
          FROM wedding_import_logs l
         WHERE 1 = 1`;

      if (!isGlobalImportUser(user)) {
        if (user.locationId) {
          sql += ' AND (l.location_id = ? OR l.location_id IS NULL)';
          params.push(user.locationId);
        }
        sql += ' AND l.user_id = ?';
        params.push(user.id);
      }

      const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
      sql += ' ORDER BY l.id DESC LIMIT ?';
      params.push(limit);

      const [rows] = await pool.query(sql, params);
      const mappedRows = (rows || []).map((r) => ({
        ...r,
        uploaded_at: r.created_at,
        imported_at: r.created_at
      }));
      return successRes(res, { imports: mappedRows }, 'Import history fetched successfully.');
    } catch (err) {
      console.error('[WeddingController.getImportLogs Error]', err);
      return errorRes(res, 'Failed to load import history', [err.message], 500);
    }
  }

  // ── Delete single import log entry ────────────────────────────
  async deleteImportLog(req, res) {
    try {
      await ensureTables();
      const { id } = req.params;
      const user = req.user || {};

      const [[log]] = await pool.query('SELECT * FROM wedding_import_logs WHERE id = ?', [id]);
      if (!log) {
        return errorRes(res, 'Import log not found', [], 404);
      }

      // Check permission: Global Admin or log creator or same store
      if (!isGlobalImportUser(user)) {
        if (log.user_id !== user.id && log.location_id !== user.locationId) {
          return errorRes(res, 'You do not have permission to delete this import log', [], 403);
        }
      }

      await pool.query('DELETE FROM wedding_import_logs WHERE id = ?', [id]);
      return successRes(res, { id: Number(id) }, 'Import log deleted successfully.');
    } catch (err) {
      console.error('[WeddingController.deleteImportLog Error]', err);
      return errorRes(res, 'Failed to delete import log', [err.message], 500);
    }
  }

  // ── Clear all import logs within user scope ────────────────────
  async clearImportLogs(req, res) {
    try {
      await ensureTables();
      const user = req.user || {};
      if (!isGlobalImportUser(user)) {
        if (user.locationId) {
          await pool.query('DELETE FROM wedding_import_logs WHERE location_id = ? OR user_id = ?', [user.locationId, user.id]);
        } else {
          await pool.query('DELETE FROM wedding_import_logs WHERE user_id = ?', [user.id]);
        }
      } else {
        await pool.query('DELETE FROM wedding_import_logs');
      }
      return successRes(res, null, 'Import history cleared successfully.');
    } catch (err) {
      console.error('[WeddingController.clearImportLogs Error]', err);
      return errorRes(res, 'Failed to clear import history', [err.message], 500);
    }
  }

// ── 14. Bulk Customer Import (CSV & XLSX with Robust Validation) ──
  async importCsv(req, res) {
    const importStartTime = Date.now();
    let conn = null;
    try {
      await ensureTables();

      if (!req.file || !req.file.buffer) {
        return errorRes(res, 'No file uploaded. Please attach a .csv or .xlsx file.', [], 400);
      }
      if (req.file.buffer.length === 0) {
        return errorRes(res, 'The uploaded file is empty. Please upload a file with customer data.', [], 400);
      }

      // ── Store location: required + store-level RBAC ──────────────
      let locationId = req.body.location_id || req.query.location_id;
      if (!locationId && req.user?.locationId) {
        locationId = req.user.locationId;
      }
      if (!locationId) {
        return errorRes(res, 'Assign Store Location is required before starting import.', [], 400);
      }
      const defaultLocationId = parseInt(locationId, 10);
      if (isNaN(defaultLocationId)) {
        return errorRes(res, 'Invalid store location selected. Please select a valid store location.', [], 400);
      }

      const storeAccess = await assertStoreAccess(req, res, defaultLocationId);
      if (!storeAccess.allowed) {
        return errorRes(res, storeAccess.reason, ['STORE_ACCESS_DENIED'], 403);
      }
      // Only unrestricted (global) users may split rows across branches via store_location
      const allowRowLocations = isGlobalImportUser(req.user);

      // ── Parse the file ───────────────────────────────────────────
      const isXlsx = /\.xlsx$/i.test(req.file.originalname) ||
                     (req.file.mimetype && req.file.mimetype.includes('openxmlformats'));

      let rows = [];

      if (isXlsx) {
        try {
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(req.file.buffer);
          const worksheet = workbook.worksheets[0];
          if (!worksheet) {
            return errorRes(res, 'The uploaded Excel file does not contain any worksheets.', [], 400);
          }
          worksheet.eachRow((row) => {
            const rowValues = [];
            for (let c = 1; c <= worksheet.columnCount; c++) {
              const cell = row.getCell(c);
              let val = cell.value;
              if (val && typeof val === 'object') {
                if (val instanceof Date) {
                  // Local calendar day — toISOString() would shift IST dates back one day
                  val = `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, '0')}-${String(val.getDate()).padStart(2, '0')}`;
                } else if (val.text) {
                  val = val.text;
                } else if (val.result !== undefined && val.result !== null) {
                  val = val.result;
                } else {
                  val = String(val);
                }
              }
              rowValues.push(val !== undefined && val !== null ? String(val).trim() : '');
            }
            if (rowValues.some((c) => c !== '')) {
              rows.push(rowValues);
            }
          });
        } catch (excelErr) {
          return errorRes(res, 'Failed to parse Excel file. Please ensure the file is a valid .xlsx file or use the CSV template.', [excelErr.message], 400);
        }
      } else {
        let text = '';
        try {
          text = req.file.buffer.toString('utf8');
        } catch (utfErr) {
          return errorRes(res, 'File is not UTF-8 encoded. Please save the CSV file as UTF-8 format.', [], 400);
        }

        if (!text || text.trim().length === 0) {
          return errorRes(res, 'The uploaded CSV file is empty. Please download the template and add your customer data.', [], 400);
        }

        rows = parseCsv(text);
      }

      if (!rows || rows.length === 0) {
        return errorRes(res, 'The uploaded file contains no data.', [], 400);
      }

      // ── Header row: must resolve to customer_name + mobile_number ─
      const normalizeHeader = (h) =>
        String(h).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

      const canonicalFor = (key) => {
        const canonicalKeys = Object.keys(HEADER_ALIASES);
        for (let i = 0; i < canonicalKeys.length; i++) {
          if (HEADER_ALIASES[canonicalKeys[i]].includes(key)) return canonicalKeys[i];
        }
        return key;
      };

      const canonicalHeaders = rows[0].map((h) => canonicalFor(normalizeHeader(h)));
      const hasCustomerName = canonicalHeaders.includes('customer_name');
      const hasMobileNumber = canonicalHeaders.includes('mobile_number');

      if (!hasCustomerName || !hasMobileNumber) {
        const missing = [];
        if (!hasCustomerName) missing.push('customer_name (REQUIRED)');
        if (!hasMobileNumber) missing.push('mobile_number (REQUIRED)');
        return errorRes(
          res,
          `Missing required column headers: ${missing.join(', ')}. Required headers: customer_name, mobile_number. Optional headers: alternate_mobile, email, wedding_date, expected_shopping_date, preferred_shopping_category, estimated_family_size, budget_min, budget_max, assigned_telecaller, customer_notes. Please download the official template.`,
          missing,
          400
        );
      }

      // ── Rows → objects keyed by canonical header ─────────────────
      const objects = [];
      for (let r = 1; r < rows.length; r++) {
        const obj = {};
        canonicalHeaders.forEach((key, idx) => {
          if (!key) return;
          const raw = rows[r][idx] !== undefined ? String(rows[r][idx]).trim() : '';
          if (raw !== '' && (obj[key] === undefined || obj[key] === '')) obj[key] = raw;
        });
        objects.push(obj);
      }

      if (objects.length === 0) {
        return errorRes(res, 'The file contains a header row but no customer records. Please add at least 1 customer row below the header.', [], 400);
      }
      if (objects.length > MAX_IMPORT_ROWS) {
        return errorRes(
          res,
          `The file contains ${objects.length} rows. The maximum allowed per import is ${MAX_IMPORT_ROWS}. Please split the file into smaller batches.`,
          [], 400
        );
      }

      // ── Field helpers ────────────────────────────────────────────
      const pick = (obj, keys) => {
        for (const k of keys) {
          if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') {
            return String(obj[k]).trim();
          }
        }
        return null;
      };

      // Excel/CSV cells written as ="9845012345" come back as that literal string
      const unwrapFormulaText = (value) => {
        if (value === null || value === undefined) return value;
        const s = String(value);
        const m = s.match(/^="([^"]*)"$/) || s.match(/^='([^']*)'$/);
        return m ? m[1] : s;
      };

      // Rejects impossible dates such as 31-02-2026 (the regex alone would accept them)
      const toIsoDate = (y, mo, d) => {
        const year = parseInt(y, 10);
        const month = parseInt(mo, 10);
        const day = parseInt(d, 10);
        const probe = new Date(year, month - 1, day);
        if (probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day) {
          return null;
        }
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      };

      const parseDate = (raw) => {
        if (!raw) return null;
        const v = String(raw).trim();
        let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (m) return toIsoDate(m[1], m[2], m[3]);
        m = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (m) return toIsoDate(m[3], m[2], m[1]); // dd-mm-yyyy
        const d = new Date(v);
        if (!isNaN(d.getTime())) {
          return toIsoDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
        }
        return null;
      };

      const normalizeMobile = (raw) => {
        if (!raw) return null;
        let digits = String(raw).replace(/\D/g, '');
        if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
        if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
        if (digits.length !== 10 || !/^[6-9]/.test(digits)) return null;
        return digits;
      };

      const parseNumber = (raw) => {
        if (raw === null || raw === undefined) return null;
        const cleaned = String(raw).replace(/[,\s₹]/g, '').replace(/\/-$/, '');
        if (cleaned === '' || !/^-?\d+(\.\d+)?$/.test(cleaned)) return NaN;
        return Number(cleaned);
      };

      // Locations lookup (store_location column in older templates)
      const [locationsList] = await pool.query(`SELECT id, location_name, location_code FROM locations`);
      const locationMap = new Map();
      locationsList.forEach((loc) => {
        locationMap.set(String(loc.id), loc);
        locationMap.set(loc.location_code.toUpperCase(), loc);
        locationMap.set(loc.location_name.toLowerCase(), loc);
        const lName = loc.location_name.toLowerCase();
        if (lName.includes('shivamogga') || lName.includes('shimoga')) {
          locationMap.set('shimoga', loc);
          locationMap.set('shivamogga', loc);
        }
        if (lName.includes('davanagere') || lName.includes('davangere')) {
          locationMap.set('davangere', loc);
          locationMap.set('davanagere', loc);
        }
        if (lName.includes('belagavi') || lName.includes('belgaum')) {
          locationMap.set('belgaum', loc);
          locationMap.set('belagavi', loc);
        }
      });

      // Telecaller name → id resolution
      const telecallerMap = new Map();
      try {
        const [tcRows] = await pool.query(
          `SELECT u.id, COALESCE(NULLIF(TRIM(u.full_name), ''), u.username) AS display_name, u.username
             FROM users u
            WHERE u.active = TRUE AND u.role IN (?)`,
          [TELECALLER_ROLES]
        );
        (tcRows || []).forEach((u) => {
          if (u.display_name) telecallerMap.set(u.display_name.toLowerCase(), u.id);
          if (u.username) telecallerMap.set(String(u.username).toLowerCase(), u.id);
        });
      } catch (tcErr) {
        console.warn('[importCsv] telecaller lookup failed:', tcErr.message);
      }

      const TEMPLATE_SAMPLE_ROWS = new Map([
        ['9845012345', 'ananya hegde'],
        ['9880198765', 'pooja patil'],
        ['9741234567', 'kavya suresh']
      ]);

      // Accepted collections must match what the downloaded template offers in
      // its own drop-down (DEFAULT_CATEGORIES + distinct CRM values). A
      // hard-coded list here rejected rows that were filled in correctly.
      const VALID_CRM_CATEGORIES = Array.from(
        new Set([...DEFAULT_CATEGORIES, ...(await getTemplateCategories())].filter(Boolean))
      );
      const validCategoryMap = new Map(VALID_CRM_CATEGORIES.map(c => [c.toLowerCase().trim(), c]));

      const errors = [];
      const warnings = [];
      const duplicateDetails = [];
      const candidates = [];
      let duplicates = 0;
      const seenInBatch = new Set();

      // ── Phase A: per-row validation ──────────────────────────────
      for (let idx = 0; idx < objects.length; idx++) {
        const row = objects[idx];
        const rowNo = idx + 2; // header is row 1

        const customerName = unwrapFormulaText(pick(row, ['customer_name']));
        const rawMobile = pick(row, ['mobile_number']);
        const mobile = normalizeMobile(rawMobile);
        const mobileForReport = mobile || unwrapFormulaText(rawMobile) || '';

        if (!customerName) {
          errors.push({ row: rowNo, customerName: 'N/A', mobile: mobileForReport || 'N/A', reason: 'Missing required field: customer_name' });
          continue;
        }

        if (!mobile) {
          errors.push({
            row: rowNo,
            customerName,
            mobile: mobileForReport,
            reason: `Invalid mobile number "${mobileForReport || ''}". Must be a valid 10-digit number starting with 6-9.`
          });
          continue;
        }

        // Unmodified template file — the grey sample rows must be deleted first
        if (TEMPLATE_SAMPLE_ROWS.has(mobile) &&
            TEMPLATE_SAMPLE_ROWS.get(mobile) === String(customerName).trim().toLowerCase()) {
          errors.push({
            row: rowNo,
            customerName,
            mobile,
            reason: 'Template sample row — delete the grey sample rows from the template before importing.'
          });
          continue;
        }

        if (seenInBatch.has(mobile)) {
          duplicates++;
          duplicateDetails.push({ row: rowNo, customerName, mobile, reason: `Duplicate mobile ${mobile} appears multiple times in uploaded file` });
          continue;
        }
        seenInBatch.add(mobile);

        // e-mail (warning only — never blocks the row)
        const emailRaw = unwrapFormulaText(pick(row, ['email']));
        let email = null;
        if (emailRaw) {
          if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
            email = emailRaw.trim();
          } else {
            warnings.push({ row: rowNo, customerName, mobile, reason: `Invalid e-mail "${emailRaw}" ignored — the customer was imported without an e-mail address.` });
          }
        }

        // wedding date
        const weddingDateRaw = pick(row, ['wedding_date']);
        const weddingDate = parseDate(weddingDateRaw);
        if (weddingDateRaw && !weddingDate) {
          errors.push({ row: rowNo, customerName, mobile, reason: `Invalid wedding_date "${weddingDateRaw}" — use dd-mm-yyyy (e.g. 15-05-2025).` });
          continue;
        }

        // expected shopping date
        const shoppingRaw = pick(row, ['expected_shopping_date']);
        const parsedShopping = parseDate(shoppingRaw);
        if (shoppingRaw && !parsedShopping) {
          errors.push({ row: rowNo, customerName, mobile, reason: `Invalid expected_shopping_date "${shoppingRaw}" — use dd-mm-yyyy (e.g. 20-04-2025).` });
          continue;
        }

        // family size
        const familyRaw = pick(row, ['estimated_family_size']);
        let familySize = 1;
        if (familyRaw !== null) {
          const parsedSize = Number(String(familyRaw).replace(/[^\d]/g, ''));
          if (!parsedSize || parsedSize < 1 || parsedSize > 50) {
            errors.push({ row: rowNo, customerName, mobile, reason: `Invalid estimated_family_size "${familyRaw}" — enter a whole number between 1 and 50.` });
            continue;
          }
          familySize = parsedSize;
        }

        // budget (min / max, or the legacy free-text budget column)
        const budgetMinRaw = pick(row, ['budget_min']);
        const budgetMaxRaw = pick(row, ['budget_max']);
        const legacyBudget = pick(row, ['budget']);
        let budget = null;
        if (budgetMinRaw !== null || budgetMaxRaw !== null) {
          const bMin = budgetMinRaw !== null ? parseNumber(budgetMinRaw) : null;
          const bMax = budgetMaxRaw !== null ? parseNumber(budgetMaxRaw) : null;
          if ((bMin !== null && (isNaN(bMin) || bMin < 0)) || (bMax !== null && (isNaN(bMax) || bMax < 0))) {
            errors.push({ row: rowNo, customerName, mobile, reason: `Invalid budget — budget_min/budget_max must be amounts in digits only (e.g. 75000). Received "${budgetMinRaw || ''}" / "${budgetMaxRaw || ''}".` });
            continue;
          }
          if (bMin !== null && bMax !== null && bMax < bMin) {
            errors.push({ row: rowNo, customerName, mobile, reason: `budget_max (${formatRupees(bMax)}) must not be smaller than budget_min (${formatRupees(bMin)}).` });
            continue;
          }
          if (bMin !== null && bMax !== null) budget = `${formatRupees(bMin)} - ${formatRupees(bMax)}`;
          else budget = formatRupees(bMin !== null ? bMin : bMax);
        } else if (legacyBudget) {
          budget = String(legacyBudget).substring(0, 100);
        }

        // Category validation against CRM options. The collection is optional,
        // so an unrecognised value must not discard an otherwise valid customer:
        // it falls back to the default and is surfaced as a warning instead.
        const categoryRaw = unwrapFormulaText(pick(row, ['preferred_shopping_category', 'preferred_collection', 'category']));
        let category = 'General Wedding Shopping';
        if (categoryRaw && categoryRaw.trim()) {
          const normalised = categoryRaw.trim().replace(/\s+/g, ' ').toLowerCase();
          const matchedCategory = validCategoryMap.get(normalised);
          if (matchedCategory) {
            category = matchedCategory;
          } else {
            warnings.push({
              row: rowNo,
              customerName,
              mobile: mobileForReport,
              reason: `Unrecognised preferred_shopping_category "${categoryRaw}" — the customer was imported as "${category}".`
            });
          }
        }

        // Telecaller validation against CRM telecallers
        const telecallerRaw = unwrapFormulaText(pick(row, ['assigned_telecaller', 'telecaller']));
        let telecallerName = null;
        let telecallerId = null;
        if (telecallerRaw && telecallerRaw.trim()) {
          const tKey = telecallerRaw.trim().toLowerCase();
          telecallerId = telecallerMap.get(tKey) || null;
          if (!telecallerId) {
            errors.push({
              row: rowNo,
              customerName,
              mobile: mobileForReport,
              reason: `Unknown telecaller "${telecallerRaw}". Must match an active CRM telecaller.`
            });
            continue;
          }
          telecallerName = telecallerRaw.trim();
        }

        candidates.push({
          rowNo,
          customerName: String(customerName).substring(0, 150).trim(),
          mobile,
          rawMobile: mobileForReport,
          altNumber: normalizeMobile(unwrapFormulaText(pick(row, ['alternate_mobile']))),
          email,
          weddingDate,
          shoppingDateRaw: shoppingRaw,
          parsedShopping,
          category,
          familySize,
          budget,
          telecallerName,
          telecallerId,
          notes: unwrapFormulaText(pick(row, ['customer_notes'])),
          followUp: (() => {
            const rawFollowUp = pick(row, ['followup_call_date']);
            return parseDate(rawFollowUp) || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
          })(),
          storeKey: allowRowLocations ? pick(row, ['store_location']) : null
        });
      }

      // ── Phase B: duplicate lookup against the CRM (batched) ─────
      const existingByMobile = new Map();
      const candidateMobiles = candidates.map((c) => c.mobile);
      for (let i = 0; i < candidateMobiles.length; i += 800) {
        const chunk = candidateMobiles.slice(i, i + 800);
        if (chunk.length === 0) continue;
        const [dupRows] = await pool.query(
          `SELECT mobile_number, customer_code FROM wedding_customers WHERE mobile_number IN (?) AND is_deleted = 0`,
          [chunk]
        );
        (dupRows || []).forEach((r) => existingByMobile.set(r.mobile_number, r.customer_code));
      }

      const ready = [];
      candidates.forEach((c) => {
        const existingCode = existingByMobile.get(c.mobile);
        if (existingCode) {
          // A duplicate is a skipped row, not a validation failure. Counting it
          // in both buckets made the summary exceed the row count and forced the
          // whole import to read as "Failed".
          duplicates++;
          duplicateDetails.push({
            row: c.rowNo,
            customerName: c.customerName,
            mobile: c.mobile,
            existingCustomerCode: existingCode,
            reason: `Mobile ${c.mobile} already registered in CRM (${existingCode})`
          });
        } else {
          ready.push(c);
        }
      });

      // ── Phase C: resolve store + customer code ───────────────────
      const seqByLoc = new Map();
      const insertRows = [];

      for (const c of ready) {
        let rowLocation = defaultLocationId;
        if (c.storeKey) {
          const key = String(c.storeKey).trim().toLowerCase();
          const matched = locationMap.get(key) || locationMap.get(key.toUpperCase());
          if (matched) {
            rowLocation = matched.id;
          } else {
            warnings.push({
              row: c.rowNo,
              customerName: c.customerName,
              mobile: c.mobile,
              reason: `Store "${c.storeKey}" not recognised — imported into the selected store instead.`
            });
          }
        }

        const shoppingDate = c.parsedShopping || null;

        const locObj = locationMap.get(String(rowLocation));
        const locCode = locObj?.location_code || 'BSC';

        if (!seqByLoc.has(rowLocation)) {
          // Seed from the true MAX across both customer-code formats. Reading a
          // single "most recent" row resets the counter as soon as that row uses
          // the other format (BSC-WED-... vs WED-...) and the insert then fails
          // with `Duplicate entry ... for key 'wedding_customers.customer_code'`.
          seqByLoc.set(rowLocation, await maxSequence(pool, locCode));
        }
        const nextSeq = seqByLoc.get(rowLocation) + 1;
        seqByLoc.set(rowLocation, nextSeq);
        const customerCode = `WED-${locCode}-${new Date().getFullYear()}-${String(nextSeq).padStart(4, '0')}`;

        const telecallerId = c.telecallerId || null;
        const telecallerName = c.telecallerName || null;

        insertRows.push({
          rowNo: c.rowNo,
          customerName: c.customerName,
          mobile: c.mobile,
          customerCode,
          params: [
            customerCode,
            rowLocation,
            c.customerName,
            c.mobile,
            c.altNumber || null,
            c.email,
            c.weddingDate,
            shoppingDate,
            String(c.category).substring(0, 150),
            c.familySize,
            c.budget,
            c.telecallerName ? String(c.telecallerName).substring(0, 150) : null,
            telecallerId,
            c.followUp,
            encryptField(c.notes ? String(c.notes).substring(0, 5000).trim() : null),
            'New',
            'Pending',
            req.user?.fullName || 'Bulk Import',
            req.user?.id || null
          ]
        });
      }

      // ── Phase D: insert (transaction + bulk chunks) ──────────────
      let imported = 0;
      const inserted = [];

      if (insertRows.length > 0) {
        const INSERT_SQL = `
          INSERT INTO wedding_customers (
            customer_code, location_id, customer_name, mobile_number, alternate_mobile, email,
            wedding_date, expected_shopping_date, preferred_shopping_category,
            estimated_family_size, budget, assigned_telecaller, assigned_telecaller_id, follow_up_date,
            customer_notes, customer_status, call_status, created_by, created_by_user_id
          ) VALUES ?`;

        conn = await pool.getConnection();
        await conn.beginTransaction();

        const CHUNK = 150;
        for (let i = 0; i < insertRows.length; i += CHUNK) {
          const slice = insertRows.slice(i, i + CHUNK);
          try {
            await conn.query(INSERT_SQL, [slice.map((r) => r.params)]);
            imported += slice.length;
            slice.forEach((r) => inserted.push(r.customerCode));
          } catch (chunkErr) {
            // Retry row-by-row so the failing row is reported precisely
            for (const r of slice) {
              try {
                await conn.query(INSERT_SQL, [[r.params]]);
                imported++;
                inserted.push(r.customerCode);
              } catch (rowErr) {
                console.error(`[importCsv] Row insert error row ${r.rowNo}:`, rowErr.message);
                errors.push({
                  row: r.rowNo,
                  customerName: r.customerName,
                  mobile: r.mobile,
                  reason: `Database insert failed: ${rowErr.message}`
                });
              }
            }
          }
        }

        await conn.commit();
      }

      // ── Summary + audit + import history ─────────────────────────
      const summary = `${imported} customers imported, ${duplicates} duplicates skipped, ${errors.length} errors.`;

      try {
        await pool.query(
          `INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details)
           VALUES (NULL, ?, ?, 'Bulk Import', ?)`,
          [defaultLocationId, req.user?.fullName || 'Bulk Import', `${summary} File: ${req.file.originalname}`]
        );
      } catch (auditErr) {
        console.warn('[importCsv] Audit log warning:', auditErr.message);
      }

      let importId = null;
      const importStatus = errors.length > 0
        ? (imported === 0 ? 'Failed' : 'Completed with Errors')
        : 'Completed';
      const serverTimestamp = new Date().toISOString();

      try {
        const [locRow] = await pool.query('SELECT location_name FROM locations WHERE id = ?', [defaultLocationId]);
        const [logRes] = await pool.query(
          `INSERT INTO wedding_import_logs
             (file_name, file_type, location_id, location_name, user_id, user_name,
              total_rows, imported_count, duplicate_count, error_count, status, summary, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            String(req.file.originalname || '').substring(0, 255),
            isXlsx ? 'xlsx' : 'csv',
            defaultLocationId,
            locRow && locRow[0] ? locRow[0].location_name : null,
            req.user?.id || null,
            req.user?.fullName || req.user?.username || null,
            objects.length,
            imported,
            duplicates,
            errors.length,
            importStatus,
            summary
          ]
        );
        importId = logRes.insertId;
      } catch (logErr) {
        console.warn('[importCsv] import log warning:', logErr.message);
      }

      const processingTimeMs = Date.now() - importStartTime;
      const processingTime = (processingTimeMs / 1000).toFixed(2) + 's';
      const selectedLoc = (locationsList || []).find((l) => Number(l.id) === Number(defaultLocationId));
      const storeBranch = selectedLoc ? selectedLoc.location_name : 'Selected Branch';

      return successRes(res, {
        importId,
        importedCount: imported,
        imported,
        duplicateCount: duplicates,
        duplicates,
        errorCount: errors.length,
        failed: errors.length,
        warningCount: warnings.length,
        totalRows: objects.length,
        processingTimeMs,
        processingTime,
        storeBranch,
        store: storeBranch,
        fileName: req.file.originalname,
        filename: req.file.originalname,
        status: importStatus,
        uploadedAt: serverTimestamp,
        uploaded_at: serverTimestamp,
        createdAt: serverTimestamp,
        created_at: serverTimestamp,
        insertedCodes: inserted.slice(0, 100),
        errors: errors.sort((a, b) => (a.row || 0) - (b.row || 0)),
        duplicateDetails: duplicateDetails.sort((a, b) => (a.row || 0) - (b.row || 0)),
        warnings: warnings.sort((a, b) => (a.row || 0) - (b.row || 0)),
        summary
      }, summary);
    } catch (err) {
      if (conn) {
        try { await conn.rollback(); } catch (rbErr) { /* connection already released */ }
      }
      console.error('[WeddingController.importCsv Error]', err);
      return errorRes(res, 'Failed to import customer records', [err.message], 500);
    } finally {
      if (conn) {
        try { conn.release(); } catch (relErr) { /* ignore */ }
      }
    }
  }

    // ── 12B. Live Wedding Customer Flow & Call Activity Stream ──────────
  async getCustomerFlowStream(req, res) {
    try {
      await ensureTables();
      const { clause: locClause, params } = resolveLocFilter(req, 'w');
      const search = req.query.search ? String(req.query.search).trim() : '';
      const status = req.query.status ? String(req.query.status).trim() : '';
      const priority = req.query.priority ? String(req.query.priority).trim() : '';
      const viewMode = req.query.view || 'all';
      const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 50));
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const offset = (page - 1) * limit;

      let whereConditions = [`w.is_deleted = 0`, `(w.lifecycle_status = 'ACTIVE' OR w.lifecycle_status IS NULL)`];
      let queryParams = [...params];

      if (status && status !== 'all') {
        if (status === 'overdue') {
          whereConditions.push(`w.follow_up_date < CURDATE() AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed')`);
        } else if (status === 'due_today') {
          whereConditions.push(`w.follow_up_date = CURDATE()`);
        } else {
          whereConditions.push(`w.customer_status = ?`);
          queryParams.push(status);
        }
      }

      if (priority && priority !== 'all') {
        whereConditions.push(`w.priority = ?`);
        queryParams.push(priority);
      }

      if (search) {
        const q = `%${search.toLowerCase()}%`;
        whereConditions.push(`(
          LOWER(w.customer_name) LIKE ? OR
          w.mobile_number LIKE ? OR
          w.alternate_mobile LIKE ? OR
          LOWER(w.customer_code) LIKE ? OR
          LOWER(COALESCE(w.bride_name, '')) LIKE ? OR
          LOWER(COALESCE(w.groom_name, '')) LIKE ? OR
          LOWER(COALESCE(w.wedding_city, '')) LIKE ?
        )`);
        queryParams.push(q, q, q, q, q, q, q);
      }

      if (viewMode === 'calls_only') {
        whereConditions.push(`lc.id IS NOT NULL`);
      }

      const whereClause = whereConditions.join(' AND ');

      const [countRows] = await pool.query(`
        SELECT COUNT(DISTINCT w.id) AS total
        FROM wedding_customers w
        LEFT JOIN (
          SELECT cl1.id, cl1.customer_id
          FROM wedding_call_logs cl1
          INNER JOIN (
            SELECT customer_id, MAX(id) AS max_id
            FROM wedding_call_logs
            GROUP BY customer_id
          ) cl2 ON cl1.id = cl2.max_id
        ) lc ON lc.customer_id = w.id
        WHERE ${whereClause} ${locClause}
      `, queryParams);

      const total = countRows?.[0]?.total || 0;

      const [rows] = await pool.query(`
        SELECT 
          w.id,
          w.id AS customer_id,
          w.customer_code,
          w.customer_name,
          w.mobile_number,
          w.alternate_mobile,
          w.email,
          w.bride_name,
          w.bride_contact,
          w.groom_name,
          w.groom_contact,
          w.wedding_date,
          w.wedding_venue,
          w.wedding_city,
          w.wedding_type,
          w.expected_shopping_date,
          w.preferred_shopping_category,
          w.budget,
          w.budget_range,
          w.priority,
          w.customer_status,
          w.call_status,
          w.assigned_telecaller,
          w.assigned_telecaller_id,
          w.follow_up_date,
          w.preferred_call_time,
          w.customer_notes,
          w.estimated_family_size,
          w.guest_count,
          w.lead_source,
          w.location_id,
          w.total_calls_count,
          w.created_at,
          w.updated_at,
          l.location_name,
          l.location_code,
          COALESCE(lc.call_outcome, w.last_call_outcome) AS call_outcome,
          lc.remarks AS call_remarks,
          COALESCE(lc.call_date, w.last_call_date) AS call_date,
          lc.call_time,
          COALESCE(lc.telecaller_name, w.assigned_telecaller) AS telecaller_name,
          lc.next_follow_up_date,
          lc.next_follow_up_time,
          lc.expected_shopping_date_updated,
          lc.call_duration,
          lc.customer_response,
          lc.id AS call_log_id,
          CASE 
            WHEN w.follow_up_date < CURDATE() AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed')
            THEN DATEDIFF(CURDATE(), w.follow_up_date)
            ELSE 0 
          END AS overdue_days
        FROM wedding_customers w
        LEFT JOIN locations l ON l.id = w.location_id
        LEFT JOIN (
          SELECT cl1.*
          FROM wedding_call_logs cl1
          INNER JOIN (
            SELECT customer_id, MAX(id) AS max_id
            FROM wedding_call_logs
            GROUP BY customer_id
          ) cl2 ON cl1.id = cl2.max_id
        ) lc ON lc.customer_id = w.id
        WHERE ${whereClause} ${locClause}
        ORDER BY 
          COALESCE(lc.created_at, w.updated_at, w.created_at) DESC
        LIMIT ? OFFSET ?
      `, [...queryParams, limit, offset]);

      decryptRows(rows, [...ENCRYPTED_FIELDS, ...CALL_LOG_ENCRYPTED_FIELDS, 'call_remarks']);

      return successRes(res, {
        customers: rows || [],
        data: rows || [],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }, 'Customer flow stream fetched successfully');
    } catch (err) {
      console.error('[WeddingController.getCustomerFlowStream Error]', err);
      return errorRes(res, 'Failed to fetch customer flow stream', [err.message], 500);
    }
  }

    // ── 13. Export Data Engine ──────────────────────────────────────────
  async exportData(req, res) {
    try {
      await ensureTables();
      const exportType = req.query.type || 'customers';
      const { clause: locClause, params } = resolveLocFilter(req, 'w');

      if (exportType === 'call_logs') {
        let callParams = [...params];
        let extraClause = '';
        if (req.query.from_date) {
          extraClause += ' AND c.call_date >= ?';
          callParams.push(req.query.from_date);
        }
        if (req.query.to_date) {
          extraClause += ' AND c.call_date <= ?';
          callParams.push(req.query.to_date);
        }
        if (req.query.outcome) {
          extraClause += ' AND c.call_outcome = ?';
          callParams.push(req.query.outcome);
        }
        if (req.query.telecaller) {
          extraClause += ' AND (c.telecaller_name LIKE ? OR c.telecaller_id = ?)';
          callParams.push(`%${req.query.telecaller}%`, req.query.telecaller);
        }

        const [rows] = await pool.query(`
          SELECT 
            c.id,
            c.customer_id,
            c.call_date,
            c.call_time,
            c.telecaller_name,
            c.telecaller_id,
            c.call_status,
            c.call_outcome,
            c.remarks,
            c.next_follow_up_date,
            c.next_follow_up_time,
            c.expected_shopping_date_updated,
            c.call_duration,
            c.customer_response,
            c.created_at,
            w.customer_code,
            w.customer_name,
            w.bride_name,
            w.groom_name,
            w.mobile_number,
            w.alternate_mobile,
            w.email,
            w.wedding_date,
            w.expected_shopping_date,
            w.preferred_shopping_category,
            w.budget,
            w.budget_range,
            w.lead_source,
            w.priority,
            w.estimated_family_size,
            w.wedding_city,
            w.customer_notes,
            w.assigned_telecaller,
            w.assigned_telecaller_id,
            w.call_status AS current_call_status,
            w.follow_up_date AS current_follow_up_date,
            w.customer_status,
            w.location_id,
            l.location_name,
            l.location_code
          FROM wedding_call_logs c
          JOIN wedding_customers w ON c.customer_id = w.id
          LEFT JOIN locations l ON l.id = w.location_id
          WHERE w.is_deleted = 0 ${locClause} ${extraClause}
          ORDER BY c.call_date DESC, c.call_time DESC, c.id DESC
        `, callParams);

        decryptRows(rows, [...ENCRYPTED_FIELDS, ...CALL_LOG_ENCRYPTED_FIELDS]);

        return successRes(res, {
          data: rows || [],
          logs: rows || [],
          records: rows || [],
          total: rows.length,
          exportedAt: new Date().toISOString()
        }, 'Call logs exported successfully');
      }

      const [rows] = await pool.query(`
        SELECT 
          w.customer_code AS 'Customer ID',
          w.customer_name AS 'Customer Name',
          w.mobile_number AS 'Mobile Number',
          COALESCE(w.email, '-') AS 'Email',
          l.location_name AS 'Location',
          COALESCE(DATE_FORMAT(w.wedding_date, '%d/%m/%Y'), '-') AS 'Wedding Date',
          DATE_FORMAT(w.expected_shopping_date, '%d/%m/%Y') AS 'Expected Shopping Date',
          w.preferred_shopping_category AS 'Preferred Shopping Category',
          w.estimated_family_size AS 'Estimated Family Size',
          COALESCE(w.budget_range, w.budget, '-') AS 'Budget',
          COALESCE(w.assigned_telecaller, 'Unassigned') AS 'Assigned Telecaller',
          DATE_FORMAT(w.follow_up_date, '%d/%m/%Y') AS 'Next Follow-up Date',
          w.preferred_call_time AS 'Preferred Call Time',
          w.customer_status AS 'Customer Status',
          w.call_status AS 'Call Status',
          w.total_calls_count AS 'Total Calls',
          COALESCE(DATE_FORMAT(w.last_call_date, '%d/%m/%Y %H:%i'), '-') AS 'Last Call Date',
          COALESCE(w.last_call_outcome, '-') AS 'Last Call Result',
          COALESCE(w.customer_notes, '-') AS 'Customer Notes',
          DATE_FORMAT(w.created_at, '%d/%m/%Y') AS 'Added On'
        FROM wedding_customers w
        LEFT JOIN locations l ON l.id = w.location_id
        WHERE w.is_deleted = 0 ${locClause}
        ORDER BY w.follow_up_date ASC, w.id DESC
      `, params);

      decryptRows(rows, ENCRYPTED_FIELDS);

      return successRes(res, {
        data: rows || [],
        records: rows || [],
        customers: rows || [],
        total: rows.length,
        exportedAt: new Date().toISOString()
      }, 'Export data generated successfully');
    } catch (err) {
      console.error('[WeddingController.exportData Error]', err);
      return errorRes(res, 'Failed to export data', [err.message], 500);
    }
  }

  // ── 13B. Export All Customer Details (CSV with Complete Fields) ──────
  async exportCustomersCsv(req, res) {
    try {
      await ensureTables();

      // Check cookie for token if hitting directly via browser link
      if (!req.user && req.cookies && req.cookies.token) {
        try {
          const { getJwtSecret } = require('../utils/secrets');
          req.user = jwt.verify(req.cookies.token, getJwtSecret());
        } catch (e) {}
      }

      const { clause: locClause, params } = resolveLocFilter(req, 'w');

      const [rows] = await pool.query(`
        SELECT 
          w.id,
          w.customer_code,
          w.customer_name,
          w.mobile_number,
          w.alternate_mobile,
          w.email,
          l.location_name,
          l.location_code,
          w.wedding_date,
          w.expected_shopping_date,
          w.preferred_shopping_category,
          w.estimated_family_size,
          w.assigned_telecaller,
          w.customer_status,
          w.call_status,
          w.follow_up_date,
          w.preferred_call_time,
          w.total_calls_count,
          w.last_call_date,
          w.last_call_outcome,
          w.customer_notes,
          w.bride_name,
          w.bride_age,
          w.bride_contact,
          w.bride_shopping_required,
          w.groom_name,
          w.groom_age,
          w.groom_contact,
          w.groom_shopping_required,
          w.wedding_venue,
          w.wedding_city,
          w.wedding_type,
          w.wedding_date_flexibility,
          w.guest_count,
          COALESCE(w.budget_range, w.budget) AS budget_range,
          w.preferred_shopping_date,
          w.preferred_shopping_time,
          w.expected_visitors,
          w.existing_customer,
          w.existing_customer_id,
          w.previous_store,
          w.preferred_contact_method,
          w.preferred_followup_time,
          w.priority,
          w.lead_source,
          w.tracking_id,
          w.created_by,
          w.created_at,
          w.updated_at
        FROM wedding_customers w
        LEFT JOIN locations l ON l.id = w.location_id
        WHERE w.is_deleted = 0 ${locClause}
        ORDER BY w.id DESC
      `, params);

      decryptRows(rows, ['customer_notes']);

      const headers = [
        'Customer Code',
        'Customer Name',
        'Mobile Number',
        'Alternate Number',
        'Email',
        'Store Location',
        'Store Code',
        'Wedding Date',
        'Expected Shopping Date',
        'Preferred Shopping Category',
        'Family Size',
        'Assigned Telecaller',
        'Customer Status',
        'Call Status',
        'Follow-up Date',
        'Preferred Call Time',
        'Total Calls',
        'Last Call Date',
        'Last Call Outcome',
        'Customer Notes',
        'Bride Name',
        'Bride Age',
        'Bride Contact',
        'Bride Shopping Required',
        'Groom Name',
        'Groom Age',
        'Groom Contact',
        'Groom Shopping Required',
        'Wedding Venue',
        'Wedding City',
        'Wedding Type',
        'Wedding Date Flexibility',
        'Guest Count',
        'Budget Range',
        'Preferred Shopping Date',
        'Preferred Shopping Time',
        'Expected Visitors',
        'Existing Customer',
        'Existing Customer ID',
        'Previous Store',
        'Preferred Contact Method',
        'Preferred Followup Time',
        'Priority',
        'Lead Source',
        'Tracking ID',
        'Created By',
        'Registration Date',
        'Last Updated'
      ];

      const formatDate = (d) => {
        if (!d) return '';
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return String(d);
        return dt.toISOString().split('T')[0];
      };

      const formatDateTime = (dt) => {
        if (!dt) return '';
        const d = new Date(dt);
        if (isNaN(d.getTime())) return String(dt);
        return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      };

      const escapeCell = (val) => {
        if (val === null || val === undefined) return '';
        const s = String(val);
        if (/[",\r\n]/.test(s)) {
          return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      };

      const csvLines = [headers.join(',')];

      for (const r of rows) {
        const rowVals = [
          r.customer_code || '',
          r.customer_name || '',
          r.mobile_number || '',
          r.alternate_mobile || '',
          r.email || '',
          r.location_name || '',
          r.location_code || '',
          formatDate(r.wedding_date),
          formatDate(r.expected_shopping_date),
          r.preferred_shopping_category || '',
          r.estimated_family_size || '',
          r.assigned_telecaller || '',
          r.customer_status || '',
          r.call_status || '',
          formatDate(r.follow_up_date),
          r.preferred_call_time || '',
          r.total_calls_count || 0,
          formatDateTime(r.last_call_date),
          r.last_call_outcome || '',
          r.customer_notes || '',
          r.bride_name || '',
          r.bride_age || '',
          r.bride_contact || '',
          r.bride_shopping_required ? 'Yes' : 'No',
          r.groom_name || '',
          r.groom_age || '',
          r.groom_contact || '',
          r.groom_shopping_required ? 'Yes' : 'No',
          r.wedding_venue || '',
          r.wedding_city || '',
          r.wedding_type || '',
          r.wedding_date_flexibility || '',
          r.guest_count || '',
          r.budget_range || '',
          formatDate(r.preferred_shopping_date),
          r.preferred_shopping_time || '',
          r.expected_visitors || '',
          r.existing_customer || '',
          r.existing_customer_id || '',
          r.previous_store || '',
          r.preferred_contact_method || '',
          r.preferred_followup_time || '',
          r.priority || '',
          r.lead_source || '',
          r.tracking_id || '',
          r.created_by || '',
          formatDateTime(r.created_at),
          formatDateTime(r.updated_at)
        ];
        csvLines.push(rowVals.map(escapeCell).join(','));
      }

      // Prepend UTF-8 BOM so Excel opens with proper encoding
      const csvContent = '\uFEFF' + csvLines.join('\r\n') + '\r\n';

      const dateStr = new Date().toISOString().split('T')[0];
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="wedding_customers_details_${dateStr}.csv"`);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return res.status(200).send(csvContent);
    } catch (err) {
      console.error('[WeddingController.exportCustomersCsv Error]', err);
      return errorRes(res, 'Failed to export customer details', [err.message], 500);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // VISITS
  // ═══════════════════════════════════════════════════════════════════

  async getVisits(req, res) {
    try {
      await ensureTables();
      const customerId = parseInt(req.params.id, 10);
      const { clause: locClause, params: locParams } = resolveLocFilter(req, 'v');

      const [visits] = await pool.query(`
        SELECT v.*, l.location_name, l.location_code
        FROM wedding_visits v
        LEFT JOIN locations l ON l.id = v.location_id
        WHERE v.customer_id = ? AND 1=1 ${locClause}
        ORDER BY v.visit_date DESC, v.id DESC
      `, [customerId, ...locParams]);

      decryptRows(visits, ['visit_notes']);
      return successRes(res, { visits: visits || [] }, 'Visits fetched');
    } catch (err) {
      console.error('[WeddingController.getVisits Error]', err);
      return errorRes(res, 'Failed to fetch visits', [err.message], 500);
    }
  }

  async createVisit(req, res) {
    try {
      await ensureTables();
      const customerId = parseInt(req.params.id, 10);
      const { clause: locClause, params: locParams } = resolveLocFilter(req, 'w');

      const [existing] = await pool.query(
        `SELECT id, location_id FROM wedding_customers w WHERE w.id = ? AND w.is_deleted = 0 ${locClause}`,
        [customerId, ...locParams]
      );
      if (!existing || existing.length === 0) return errorRes(res, 'Customer not found', [], 404);

      const { visit_date, visit_time, visitors_count, visited_by, purpose, products_viewed, categories_viewed, customer_requirement, visit_result, next_action, visit_notes, visit_status } = req.body;
      if (!visit_date || !visit_time) return errorRes(res, 'Visit date and time are required', [], 400);

      const locationId = existing[0].location_id;
      const [result] = await pool.query(`
        INSERT INTO wedding_visits (customer_id, location_id, visit_date, visit_time, visitors_count, visited_by, purpose, products_viewed, categories_viewed, customer_requirement, visit_result, next_action, visit_notes, visit_status, created_by, created_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        customerId, locationId, visit_date, visit_time,
        parseInt(visitors_count || 1, 10), visited_by || req.user?.fullName || null,
        purpose || null, products_viewed || null, categories_viewed || null,
        customer_requirement || null, visit_result || null, next_action || null,
        encryptField(visit_notes || null), visit_status || 'Visit Planned',
        req.user?.fullName || 'Staff', req.user?.id || null
      ]);

      await pool.query(
        `INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details) VALUES (?, ?, ?, 'Visit Created', ?)`,
        [customerId, locationId, req.user?.fullName || 'Staff', `Visit on ${visit_date} at ${visit_time}`]
      );

      return successRes(res, { id: result.insertId }, 'Visit created', 201);
    } catch (err) {
      console.error('[WeddingController.createVisit Error]', err);
      return errorRes(res, 'Failed to create visit', [err.message], 500);
    }
  }

  async updateVisit(req, res) {
    try {
      const visitId = parseInt(req.params.visitId, 10);
      const [existing] = await pool.query(`SELECT * FROM wedding_visits WHERE id = ?`, [visitId]);
      if (!existing || existing.length === 0) return errorRes(res, 'Visit not found', [], 404);

      const v = existing[0];
      const { visit_date, visit_time, visitors_count, visited_by, purpose, products_viewed, categories_viewed, customer_requirement, visit_result, next_action, visit_notes, visit_status } = req.body;

      await pool.query(`
        UPDATE wedding_visits SET visit_date=?, visit_time=?, visitors_count=?, visited_by=?, purpose=?, products_viewed=?, categories_viewed=?, customer_requirement=?, visit_result=?, next_action=?, visit_notes=?, visit_status=? WHERE id=?
      `, [
        visit_date || v.visit_date, visit_time || v.visit_time,
        visitors_count ? parseInt(visitors_count, 10) : v.visitors_count,
        visited_by || v.visited_by, purpose ?? v.purpose,
        products_viewed ?? v.products_viewed, categories_viewed ?? v.categories_viewed,
        customer_requirement ?? v.customer_requirement, visit_result ?? v.visit_result,
        next_action ?? v.next_action,
        visit_notes !== undefined ? encryptField(visit_notes) : v.visit_notes,
        visit_status || v.visit_status, visitId
      ]);

      return successRes(res, { id: visitId }, 'Visit updated');
    } catch (err) {
      console.error('[WeddingController.updateVisit Error]', err);
      return errorRes(res, 'Failed to update visit', [err.message], 500);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // APPOINTMENTS
  // ═══════════════════════════════════════════════════════════════════

  async getAppointments(req, res) {
    try {
      await ensureTables();
      const customerId = parseInt(req.params.id, 10);
      const { clause: locClause, params: locParams } = resolveLocFilter(req, 'a');

      const [appointments] = await pool.query(`
        SELECT a.*, l.location_name
        FROM wedding_appointments a
        LEFT JOIN locations l ON l.id = a.location_id
        WHERE a.customer_id = ? AND 1=1 ${locClause}
        ORDER BY a.appointment_date DESC, a.id DESC
      `, [customerId, ...locParams]);

      decryptRows(appointments, ['appointment_notes', 'special_arrangement']);
      return successRes(res, { appointments: appointments || [] }, 'Appointments fetched');
    } catch (err) {
      console.error('[WeddingController.getAppointments Error]', err);
      return errorRes(res, 'Failed to fetch appointments', [err.message], 500);
    }
  }

  async createAppointment(req, res) {
    try {
      await ensureTables();
      const customerId = parseInt(req.params.id, 10);
      const { clause: locClause, params: locParams } = resolveLocFilter(req, 'w');

      const [existing] = await pool.query(
        `SELECT id, location_id FROM wedding_customers w WHERE w.id = ? AND w.is_deleted = 0 ${locClause}`,
        [customerId, ...locParams]
      );
      if (!existing || existing.length === 0) return errorRes(res, 'Customer not found', [], 404);

      const { appointment_date, appointment_time, store_location, assigned_employee, assigned_employee_id, visitors_count, purpose, special_arrangement, appointment_notes, appointment_status } = req.body;
      if (!appointment_date || !appointment_time) return errorRes(res, 'Appointment date and time are required', [], 400);

      const locationId = existing[0].location_id;
      const [result] = await pool.query(`
        INSERT INTO wedding_appointments (customer_id, location_id, appointment_date, appointment_time, store_location, assigned_employee, assigned_employee_id, visitors_count, purpose, special_arrangement, appointment_notes, appointment_status, created_by, created_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        customerId, locationId, appointment_date, appointment_time,
        store_location || null, assigned_employee || null, assigned_employee_id ? parseInt(assigned_employee_id, 10) : null,
        parseInt(visitors_count || 1, 10), purpose || null,
        encryptField(special_arrangement || null), encryptField(appointment_notes || null),
        appointment_status || 'Scheduled', req.user?.fullName || 'Staff', req.user?.id || null
      ]);

      await pool.query(
        `INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details) VALUES (?, ?, ?, 'Appointment Created', ?)`,
        [customerId, locationId, req.user?.fullName || 'Staff', `Appointment on ${appointment_date} at ${appointment_time}`]
      );

      return successRes(res, { id: result.insertId }, 'Appointment created', 201);
    } catch (err) {
      console.error('[WeddingController.createAppointment Error]', err);
      return errorRes(res, 'Failed to create appointment', [err.message], 500);
    }
  }

  async updateAppointment(req, res) {
    try {
      const apptId = parseInt(req.params.appointmentId, 10);
      const [existing] = await pool.query(`SELECT * FROM wedding_appointments WHERE id = ?`, [apptId]);
      if (!existing || existing.length === 0) return errorRes(res, 'Appointment not found', [], 404);

      const a = existing[0];
      const { appointment_date, appointment_time, store_location, assigned_employee, assigned_employee_id, visitors_count, purpose, special_arrangement, appointment_notes, appointment_status } = req.body;

      await pool.query(`
        UPDATE wedding_appointments SET appointment_date=?, appointment_time=?, store_location=?, assigned_employee=?, assigned_employee_id=?, visitors_count=?, purpose=?, special_arrangement=?, appointment_notes=?, appointment_status=? WHERE id=?
      `, [
        appointment_date || a.appointment_date, appointment_time || a.appointment_time,
        store_location ?? a.store_location, assigned_employee ?? a.assigned_employee,
        assigned_employee_id ? parseInt(assigned_employee_id, 10) : a.assigned_employee_id,
        visitors_count ? parseInt(visitors_count, 10) : a.visitors_count,
        purpose ?? a.purpose,
        special_arrangement !== undefined ? encryptField(special_arrangement) : a.special_arrangement,
        appointment_notes !== undefined ? encryptField(appointment_notes) : a.appointment_notes,
        appointment_status || a.appointment_status, apptId
      ]);

      return successRes(res, { id: apptId }, 'Appointment updated');
    } catch (err) {
      console.error('[WeddingController.updateAppointment Error]', err);
      return errorRes(res, 'Failed to update appointment', [err.message], 500);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // PURCHASES
  // ═══════════════════════════════════════════════════════════════════

  async getPurchases(req, res) {
    try {
      await ensureTables();
      const customerId = parseInt(req.params.id, 10);
      const { clause: locClause, params: locParams } = resolveLocFilter(req, 'p');

      const [purchases] = await pool.query(`
        SELECT p.*, l.location_name
        FROM wedding_purchases p
        LEFT JOIN locations l ON l.id = p.location_id
        WHERE p.customer_id = ? AND 1=1 ${locClause}
        ORDER BY p.purchase_date DESC, p.id DESC
      `, [customerId, ...locParams]);

      decryptRows(purchases, ['purchase_notes']);
      return successRes(res, { purchases: purchases || [] }, 'Purchases fetched');
    } catch (err) {
      console.error('[WeddingController.getPurchases Error]', err);
      return errorRes(res, 'Failed to fetch purchases', [err.message], 500);
    }
  }

  async createPurchase(req, res) {
    try {
      await ensureTables();
      const customerId = parseInt(req.params.id, 10);
      const { clause: locClause, params: locParams } = resolveLocFilter(req, 'w');

      const [existing] = await pool.query(
        `SELECT id, location_id FROM wedding_customers w WHERE w.id = ? AND w.is_deleted = 0 ${locClause}`,
        [customerId, ...locParams]
      );
      if (!existing || existing.length === 0) return errorRes(res, 'Customer not found', [], 404);

      const { bill_number, purchase_date, store_location, total_amount, discount_amount, net_amount, payment_status, sales_employee, product_categories, purchase_notes, purchase_status } = req.body;
      if (!purchase_date) return errorRes(res, 'Purchase date is required', [], 400);

      const locationId = existing[0].location_id;
      const [result] = await pool.query(`
        INSERT INTO wedding_purchases (customer_id, location_id, bill_number, purchase_date, store_location, total_amount, discount_amount, net_amount, payment_status, sales_employee, product_categories, purchase_notes, purchase_status, created_by, created_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        customerId, locationId, bill_number || null, purchase_date,
        store_location || null, parseFloat(total_amount || 0), parseFloat(discount_amount || 0),
        parseFloat(net_amount || total_amount || 0), payment_status || 'Pending',
        sales_employee || null, product_categories || null,
        encryptField(purchase_notes || null), purchase_status || 'Purchase Completed',
        req.user?.fullName || 'Staff', req.user?.id || null
      ]);

      await pool.query(
        `INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details) VALUES (?, ?, ?, 'Purchase Recorded', ?)`,
        [customerId, locationId, req.user?.fullName || 'Staff', `Bill ${bill_number || 'N/A'}, Amount: ₹${net_amount || total_amount || 0}`]
      );

      return successRes(res, { id: result.insertId }, 'Purchase recorded', 201);
    } catch (err) {
      console.error('[WeddingController.createPurchase Error]', err);
      return errorRes(res, 'Failed to record purchase', [err.message], 500);
    }
  }

  async updatePurchase(req, res) {
    try {
      const purchaseId = parseInt(req.params.purchaseId, 10);
      const [existing] = await pool.query(`SELECT * FROM wedding_purchases WHERE id = ?`, [purchaseId]);
      if (!existing || existing.length === 0) return errorRes(res, 'Purchase not found', [], 404);

      const p = existing[0];
      const { bill_number, purchase_date, store_location, total_amount, discount_amount, net_amount, payment_status, sales_employee, product_categories, purchase_notes, purchase_status } = req.body;

      await pool.query(`
        UPDATE wedding_purchases SET bill_number=?, purchase_date=?, store_location=?, total_amount=?, discount_amount=?, net_amount=?, payment_status=?, sales_employee=?, product_categories=?, purchase_notes=?, purchase_status=? WHERE id=?
      `, [
        bill_number ?? p.bill_number, purchase_date || p.purchase_date,
        store_location ?? p.store_location,
        total_amount !== undefined ? parseFloat(total_amount) : p.total_amount,
        discount_amount !== undefined ? parseFloat(discount_amount) : p.discount_amount,
        net_amount !== undefined ? parseFloat(net_amount) : p.net_amount,
        payment_status || p.payment_status, sales_employee ?? p.sales_employee,
        product_categories ?? p.product_categories,
        purchase_notes !== undefined ? encryptField(purchase_notes) : p.purchase_notes,
        purchase_status || p.purchase_status, purchaseId
      ]);

      return successRes(res, { id: purchaseId }, 'Purchase updated');
    } catch (err) {
      console.error('[WeddingController.updatePurchase Error]', err);
      return errorRes(res, 'Failed to update purchase', [err.message], 500);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // NOTES
  // ═══════════════════════════════════════════════════════════════════

  async getNotes(req, res) {
    try {
      await ensureTables();
      const customerId = parseInt(req.params.id, 10);

      const [notes] = await pool.query(`
        SELECT n.*, l.location_name
        FROM wedding_notes n
        LEFT JOIN locations l ON l.id = n.location_id
        WHERE n.customer_id = ?
        ORDER BY n.created_at DESC
      `, [customerId]);

      decryptRows(notes, ['note_content']);
      return successRes(res, { notes: notes || [] }, 'Notes fetched');
    } catch (err) {
      console.error('[WeddingController.getNotes Error]', err);
      return errorRes(res, 'Failed to fetch notes', [err.message], 500);
    }
  }

  async createNote(req, res) {
    try {
      await ensureTables();
      const customerId = parseInt(req.params.id, 10);
      const { clause: locClause, params: locParams } = resolveLocFilter(req, 'w');

      const [existing] = await pool.query(
        `SELECT id, location_id FROM wedding_customers w WHERE w.id = ? AND w.is_deleted = 0 ${locClause}`,
        [customerId, ...locParams]
      );
      if (!existing || existing.length === 0) return errorRes(res, 'Customer not found', [], 404);

      const noteText = req.body.note_content || req.body.note;
      const note_type = req.body.note_type || 'General';
      if (!noteText || !String(noteText).trim()) return errorRes(res, 'Note content is required', [], 400);

      const locationId = existing[0].location_id;
      const [result] = await pool.query(`
        INSERT INTO wedding_notes (customer_id, location_id, note_content, note_type, created_by, created_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [customerId, locationId, encryptField(String(noteText).trim()), note_type, req.user?.fullName || 'Staff', req.user?.id || null]);

      return successRes(res, { id: result.insertId }, 'Note added', 201);
    } catch (err) {
      console.error('[WeddingController.createNote Error]', err);
      return errorRes(res, 'Failed to add note', [err.message], 500);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // TELL CALLER — CRM instructions sent to a telecaller about a customer
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Sends one instruction. Nothing here is trusted from the browser: the store is
   * read from the customer row, the recipient is re-checked against the caller's
   * own locations, and the audit entry that makes it show up in the customer's
   * history is written in the same transaction as the instruction itself.
   */
  async sendTelecallerInstruction(req, res) {
    const customerId = parseInt(req.params.id, 10);
    if (!customerId || isNaN(customerId)) return errorRes(res, 'A valid customer id is required', [], 400);

    const rawMessage = req.body?.message ?? req.body?.instruction ?? '';
    const message = String(rawMessage).trim();
    if (!message) {
      return errorRes(res, 'Please enter a message for the telecaller.', ['message is required'], 400);
    }
    if (message.length > 2000) {
      return errorRes(res, 'The message is too long. Please keep it under 2000 characters.', ['message too long'], 400);
    }

    const telecallerId = parseInt(req.body?.telecaller_user_id ?? req.body?.telecallerId ?? req.body?.telecaller_id, 10);
    if (!telecallerId || isNaN(telecallerId)) {
      return errorRes(res, 'Choose the telecaller this instruction is for.', ['telecaller_user_id is required'], 400);
    }

    const priority = INSTRUCTION_PRIORITIES.includes(req.body?.priority) ? req.body.priority : 'Normal';

    try {
      await ensureTables();

      // The customer must be inside the caller's own stores — a foreign id is a 404,
      // not a 403, so the endpoint cannot be used to probe which customers exist.
      const { clause: locClause, params: locParams } = resolveLocFilter(req, 'w');
      const [custRows] = await pool.query(
        `SELECT w.id, w.customer_code, w.customer_name, w.location_id, w.assigned_telecaller_id,
                l.location_name, l.location_code
           FROM wedding_customers w
           LEFT JOIN locations l ON l.id = w.location_id
          WHERE w.id = ? AND w.is_deleted = 0 ${locClause}`,
        [customerId, ...locParams]
      );
      if (!custRows || custRows.length === 0) return errorRes(res, 'Customer not found', [], 404);
      const customer = custRows[0];

      const recipient = await loadInstructionRecipient(telecallerId);
      if (!recipient) {
        return errorRes(res, 'The selected staff member is not an active telecaller.', ['telecaller is not assignable'], 400);
      }
      if (!canActForLocation(req.user, recipient.location_id ?? customer.location_id)) {
        return errorRes(res, 'You can only send instructions to telecallers in the stores you manage.', [], 403);
      }
      // A Shivamogga customer must not be handed to a Belagavi telecaller by someone
      // who is allowed to see both stores.
      if (recipient.location_id && Number(recipient.location_id) !== Number(customer.location_id)) {
        return errorRes(res, `This telecaller belongs to ${recipient.location_name || 'another store'}, not the customer's store.`, ['telecaller location mismatch'], 400);
      }

      // Double-click / retry guard: the same instruction to the same person about the
      // same customer inside a minute is one instruction, not two.
      const messageHash = instructionHash(message);
      const [dupes] = await pool.query(
        `SELECT id FROM wedding_telecaller_instructions
          WHERE customer_id = ? AND telecaller_user_id = ? AND message_hash = ?
            AND created_at >= DATE_SUB(NOW(), INTERVAL 60 SECOND)
          LIMIT 1`,
        [customerId, telecallerId, messageHash]
      );
      if (dupes && dupes.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'This instruction was just sent to the telecaller.',
          data: { id: dupes[0].id, duplicate: true }
        });
      }

      const senderName = req.user?.fullName || req.user?.username || 'CRM Manager';
      const sentAt = new Date().toLocaleString('en-IN');
      const auditDetails = [
        `CRM Manager sent instruction to ${recipient.full_name}`,
        `Customer: ${customer.customer_name} (${customer.customer_code})`,
        `Location: ${customer.location_name || customer.location_code || customer.location_id}`,
        `Message: "${message}"`,
        `Priority: ${priority}`,
        `Status: Sent`,
        `Sent By: ${senderName}${req.user?.role ? ` (${req.user.role})` : ''}`,
        `Date/Time: ${sentAt}`
      ].join('\n');

      const conn = await pool.getConnection();
      let instructionId;
      try {
        await conn.beginTransaction();

        const [result] = await conn.query(
          `INSERT INTO wedding_telecaller_instructions
             (customer_id, customer_code, customer_name, location_id, location_name,
              telecaller_user_id, telecaller_name, sent_by_user_id, sent_by_name, sent_by_role,
              message, message_hash, priority, status, related_call_log_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', ?)`,
          [
            customer.id, customer.customer_code || null, customer.customer_name || null,
            customer.location_id, customer.location_name || null,
            recipient.id, recipient.full_name,
            req.user?.id || null, senderName, req.user?.role || null,
            encryptField(message), messageHash, priority,
            Number.isInteger(parseInt(req.body?.related_call_log_id, 10)) ? parseInt(req.body.related_call_log_id, 10) : null
          ]
        );
        instructionId = result.insertId;

        await conn.query(
          `INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details)
           VALUES (?, ?, ?, ?, ?)`,
          [customer.id, customer.location_id, senderName, 'Telecaller Instructed', auditDetails]
        );

        await conn.commit();
      } catch (inner) {
        await conn.rollback();
        throw inner;
      } finally {
        conn.release();
      }

      await delCachePattern(`app:prod:wedding:customer:${customer.id}:*`);
      await delCachePattern('app:prod:wedding:desk:*');
      await delCachePattern('app:prod:wedding:dashboard:*');
      realtimeService.emitTelecallerInstruction('CREATE', {
        id: instructionId,
        customer_id: customer.id,
        customer_name: customer.customer_name,
        telecaller_user_id: recipient.id,
        location_id: customer.location_id,
        status: 'New',
        priority
      });

      const [saved] = await pool.query('SELECT * FROM wedding_telecaller_instructions WHERE id = ? LIMIT 1', [instructionId]);
      return successRes(res, { instruction: mapInstructionRow(saved[0]) }, 'Message sent to the telecaller successfully.', 201);
    } catch (err) {
      console.error('[WeddingController.sendTelecallerInstruction Error]', err);
      return errorRes(res, 'Unable to send the message to the telecaller. Please try again.', [], 500);
    }
  }

  /** Instructions visible to the caller: their own store(s), or the whole network for admins. */
  async listTelecallerInstructions(req, res) {
    try {
      await ensureTables();
      await ensureTelecallerInstructionsTable().catch(() => {});

      const where = [];
      const params = [];
      const { clause: locClause, params: locParams } = resolveLocFilter(req, 'i');
      // resolveLocFilter emits "AND <alias>.location_id = ?" — the alias is already qualified.
      if (locClause) {
        where.push(locClause.replace(/^AND\s+/, ''));
        params.push(...locParams);
      }

      const customerId = parseInt(req.query.customer_id, 10);
      if (customerId) { where.push('i.customer_id = ?'); params.push(customerId); }

      const telecallerId = parseInt(req.query.telecaller_id, 10);
      if (telecallerId) { where.push('i.telecaller_user_id = ?'); params.push(telecallerId); }

      // "mine" is how the Telecaller Desk asks for its own inbox, so the id never
      // has to travel through a editable query string.
      if (String(req.query.mine || '') === '1') {
        where.push('i.telecaller_user_id = ?');
        params.push(req.user.id);
      }

      if (INSTRUCTION_STATUSES.includes(req.query.status)) {
        where.push('i.status = ?');
        params.push(req.query.status);
      }

      const from = parseDate(req.query.dateFrom || req.query.from_date);
      if (from) { where.push('DATE(i.created_at) >= ?'); params.push(from); }
      const to = parseDate(req.query.dateTo || req.query.to_date);
      if (to) { where.push('DATE(i.created_at) <= ?'); params.push(to); }

      const search = String(req.query.search || '').trim();
      if (search) {
        where.push('(i.customer_name LIKE ? OR i.customer_code LIKE ? OR i.telecaller_name LIKE ? OR i.sent_by_name LIKE ?)');
        const like = `%${search}%`;
        params.push(like, like, like, like);
      }

      const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 50, 200));
      const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

      const [rows] = await pool.query(
        `SELECT i.* FROM wedding_telecaller_instructions i ${whereSql}
          ORDER BY i.created_at DESC, i.id DESC LIMIT ${limit} OFFSET ${offset}`,
        params
      );

      const [countRows] = await pool.query(
        `SELECT COUNT(*) AS total FROM wedding_telecaller_instructions i ${whereSql}`,
        params
      );

      return successRes(res, {
        instructions: (rows || []).map(mapInstructionRow),
        total: Number(countRows?.[0]?.total || 0),
        limit,
        offset
      }, 'Telecaller instructions fetched.');
    } catch (err) {
      console.error('[WeddingController.listTelecallerInstructions Error]', err);
      if (err.code === 'ER_NO_SUCH_TABLE' || (err.message && err.message.includes('wedding_telecaller_instructions'))) {
        try {
          await ensureTelecallerInstructionsTable();
          return successRes(res, { instructions: [], total: 0, limit: 50, offset: 0 }, 'Telecaller instructions initialized.');
        } catch(tableErr) {}
      }
      return errorRes(res, 'Unable to load the CRM instructions. Please try again.', [], 500);
    }
  }

  async getTelecallerInstruction(req, res) {
    try {
      await ensureTables();
      const id = parseInt(req.params.id, 10);
      if (!id) return errorRes(res, 'A valid instruction id is required', [], 400);

      const { clause: locClause, params: locParams } = resolveLocFilter(req, 'i');
      const [rows] = await pool.query(
        `SELECT i.* FROM wedding_telecaller_instructions i
          WHERE i.id = ? ${locClause ? locClause.replace(/^AND\s+/, 'AND ') : ''} LIMIT 1`,
        [id, ...locParams]
      );
      if (!rows || rows.length === 0) return errorRes(res, 'Instruction not found', [], 404);

      return successRes(res, { instruction: mapInstructionRow(rows[0]) }, 'Instruction fetched.');
    } catch (err) {
      console.error('[WeddingController.getTelecallerInstruction Error]', err);
      return errorRes(res, 'Unable to load this instruction. Please try again.', [], 500);
    }
  }

  /**
   * Seen / Acknowledged / Completed. Only the telecaller it was sent to (or an Admin)
   * may move it, and the status never moves backwards — the history has to stay
   * truthful for the CRM Manager who issued it.
   */
  async updateTelecallerInstructionStatus(req, res) {
    const id = parseInt(req.params.id, 10);
    if (!id) return errorRes(res, 'A valid instruction id is required', [], 400);

    const next = String(req.body?.status || '').trim();
    if (!['Seen', 'Acknowledged', 'Completed'].includes(next)) {
      return errorRes(res, 'Status must be Seen, Acknowledged or Completed.', ['status is invalid'], 400);
    }

    try {
      await ensureTables();
      const { clause: locClause, params: locParams } = resolveLocFilter(req, 'i');
      const [rows] = await pool.query(
        `SELECT i.* FROM wedding_telecaller_instructions i
          WHERE i.id = ? ${locClause ? locClause.replace(/^AND\s+/, 'AND ') : ''} LIMIT 1`,
        [id, ...locParams]
      );
      if (!rows || rows.length === 0) return errorRes(res, 'Instruction not found', [], 404);
      const current = rows[0];

      const isAdmin = ['Admin', 'Super Admin', 'system administrator'].includes(req.user?.role);
      if (!isAdmin && Number(current.telecaller_user_id) !== Number(req.user?.id)) {
        return errorRes(res, 'Only the telecaller this instruction was sent to can update it.', [], 403);
      }

      const rank = INSTRUCTION_STATUS_RANK;
      if ((rank[current.status] || 0) > (rank[next] || 0)) {
        return errorRes(res, `This instruction is already ${current.status} and cannot go back.`, ['status moves forward only'], 409);
      }

      const actorName = req.user?.fullName || req.user?.username || 'Telecaller';
      const sets = ['status = ?'];
      const params = [next];
      if (next !== 'New' && !current.seen_at) { sets.push('seen_at = NOW()'); }
      if (next === 'Acknowledged' && !current.acknowledged_at) {
        sets.push('acknowledged_at = NOW()', 'acknowledged_by = ?');
        params.push(actorName);
      }
      if (next === 'Completed') {
        sets.push('completed_at = NOW()', 'completed_by = ?', 'completed_by_user_id = ?');
        params.push(actorName, req.user?.id || null);
      }

      await pool.query(`UPDATE wedding_telecaller_instructions SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);

      await pool.query(
        `INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details)
         VALUES (?, ?, ?, ?, ?)`,
        [
          current.customer_id, current.location_id, actorName, `Instruction ${next}`,
          `Instruction #${current.id} marked ${next} by ${actorName} on ${new Date().toLocaleString('en-IN')}.`
        ]
      );

      await delCachePattern(`app:prod:wedding:customer:${current.customer_id}:*`);
      await delCachePattern('app:prod:wedding:desk:*');
      realtimeService.emitTelecallerInstruction(next.toUpperCase(), current);

      const [saved] = await pool.query('SELECT * FROM wedding_telecaller_instructions WHERE id = ? LIMIT 1', [id]);
      return successRes(res, { instruction: mapInstructionRow(saved[0]) }, `Instruction marked as ${next}.`);
    } catch (err) {
      console.error('[WeddingController.updateTelecallerInstructionStatus Error]', err);
      return errorRes(res, 'Unable to update this instruction. Please try again.', [], 500);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // COMMUNICATION HISTORY
  // ═══════════════════════════════════════════════════════════════════

  async getCommunicationHistory(req, res) {
    try {
      await ensureTables();
      const customerId = parseInt(req.params.id, 10);

      const [history] = await pool.query(`
        SELECT c.*, l.location_name
        FROM wedding_communication c
        LEFT JOIN locations l ON l.id = c.location_id
        WHERE c.customer_id = ?
        ORDER BY c.communication_date DESC, c.id DESC
      `, [customerId]);

      decryptRows(history, ['communication_details']);
      return successRes(res, { communications: history || [] }, 'Communication history fetched');
    } catch (err) {
      console.error('[WeddingController.getCommunicationHistory Error]', err);
      return errorRes(res, 'Failed to fetch communication history', [err.message], 500);
    }
  }

  async createCommunication(req, res) {
    try {
      await ensureTables();
      const customerId = parseInt(req.params.id, 10);
      const { clause: locClause, params: locParams } = resolveLocFilter(req, 'w');

      const [existing] = await pool.query(
        `SELECT id, location_id FROM wedding_customers w WHERE w.id = ? AND w.is_deleted = 0 ${locClause}`,
        [customerId, ...locParams]
      );
      if (!existing || existing.length === 0) return errorRes(res, 'Customer not found', [], 404);

      const { communication_type, communication_method, communication_date, communication_time, outcome, communication_details, next_follow_up_date, next_follow_up_time } = req.body;
      if (!communication_method || !communication_date) return errorRes(res, 'Method and date are required', [], 400);

      const locationId = existing[0].location_id;
      const [result] = await pool.query(`
        INSERT INTO wedding_communication (customer_id, location_id, communication_type, communication_method, communication_date, communication_time, employee_name, employee_id, outcome, communication_details, next_follow_up_date, next_follow_up_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        customerId, locationId, communication_type || 'General', communication_method,
        communication_date, communication_time || '',
        req.user?.fullName || 'Staff', req.user?.id || null,
        outcome || null, encryptField(communication_details || null),
        next_follow_up_date || null, next_follow_up_time || null
      ]);

      return successRes(res, { id: result.insertId }, 'Communication logged', 201);
    } catch (err) {
      console.error('[WeddingController.createCommunication Error]', err);
      return errorRes(res, 'Failed to log communication', [err.message], 500);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // STATUS HISTORY
  // ═══════════════════════════════════════════════════════════════════

  async getStatusHistory(req, res) {
    try {
      const customerId = parseInt(req.params.id, 10);

      const [history] = await pool.query(`
        SELECT * FROM wedding_status_history
        WHERE customer_id = ?
        ORDER BY created_at DESC
      `, [customerId]);

      return successRes(res, { statusHistory: history || [] }, 'Status history fetched');
    } catch (err) {
      console.error('[WeddingController.getStatusHistory Error]', err);
      return errorRes(res, 'Failed to fetch status history', [err.message], 500);
    }
  }

  async changeStatus(req, res) {
    try {
      await ensureTables();
      const customerId = parseInt(req.params.id, 10);
      const { clause: locClause, params: locParams } = resolveLocFilter(req, 'w');

      const [existing] = await pool.query(
        `SELECT * FROM wedding_customers w WHERE w.id = ? AND w.is_deleted = 0 ${locClause}`,
        [customerId, ...locParams]
      );
      if (!existing || existing.length === 0) return errorRes(res, 'Customer not found', [], 404);

      const { new_status, change_reason } = req.body;
      if (!new_status) return errorRes(res, 'New status is required', [], 400);

      const cust = existing[0];
      const oldStatus = cust.customer_status;

      // Archived rows are terminal — re-activating must go through Restore so the
      // archive always carries an intentional, audited transition.
      if (cust.lifecycle_status === 'OLD_CUSTOMER') {
        return res.status(409).json({
          success: false,
          message: 'This customer is in Old Customers. Restore the record before changing its status.',
          code: 'OLD_CUSTOMER_READONLY'
        });
      }

      await pool.query(`UPDATE wedding_customers SET customer_status = ? WHERE id = ?`, [new_status, customerId]);

      await pool.query(`
        INSERT INTO wedding_status_history (customer_id, location_id, old_status, new_status, changed_by, changed_by_user_id, change_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [customerId, cust.location_id, oldStatus, new_status, req.user?.fullName || 'Staff', req.user?.id || null, change_reason || null]);

      await pool.query(
        `INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details) VALUES (?, ?, ?, 'Status Changed', ?)`,
        [customerId, cust.location_id, req.user?.fullName || 'Staff', `Status: ${oldStatus} → ${new_status}${change_reason ? '. Reason: ' + change_reason : ''}`]
      );

      let archived = false;
      if (COMPLETION_STATUSES.has(String(new_status).trim())) {
        const result = await archiveCustomerAsOld(customerId, req.user, {
          completedStatus: String(new_status).trim(),
          previousStatus: oldStatus,
          reason: change_reason || 'Wedding process completed'
        });
        archived = result.archived;
      }

      return successRes(res, {
        id: customerId,
        old_status: oldStatus,
        new_status: new_status,
        archived,
        lifecycle_status: archived ? 'OLD_CUSTOMER' : cust.lifecycle_status
      }, archived ? 'Customer completed and moved to Old Customers.' : 'Status updated');
    } catch (err) {
      console.error('[WeddingController.changeStatus Error]', err);
      return errorRes(res, 'Failed to change status', [err.message], 500);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // DOCUMENTS
  // ═══════════════════════════════════════════════════════════════════

  async getDocuments(req, res) {
    try {
      const customerId = parseInt(req.params.id, 10);
      const [docs] = await pool.query(
        `SELECT * FROM wedding_documents WHERE customer_id = ? ORDER BY created_at DESC`, [customerId]
      );
      return successRes(res, { documents: docs || [] }, 'Documents fetched');
    } catch (err) {
      console.error('[WeddingController.getDocuments Error]', err);
      return errorRes(res, 'Failed to fetch documents', [err.message], 500);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // CUSTOMER SOURCES
  // ═══════════════════════════════════════════════════════════════════

  async getCustomerSources(req, res) {
    try {
      const [sources] = await pool.query(
        `SELECT * FROM wedding_customer_sources WHERE is_active = TRUE ORDER BY source_name ASC`
      );
      return successRes(res, { sources: sources || [] }, 'Sources fetched');
    } catch (err) {
      console.error('[WeddingController.getCustomerSources Error]', err);
      return errorRes(res, 'Failed to fetch sources', [err.message], 500);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // ENHANCED DASHBOARD STATS (Location Cards + Charts)
  // ═══════════════════════════════════════════════════════════════════

  async getEnhancedDashboardStats(req, res) {
    try {
      await ensureTables();
      const { clause: locClause, params } = resolveLocFilter(req, 'w');
      const istToday = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

      // Parallelize mainStats, visitRows, and apptRows queries
      const [
        [mainStats],
        visitResult,
        apptResult
      ] = await Promise.all([
        pool.query(`
          SELECT
            COUNT(*) AS totalCustomers,
            SUM(CASE WHEN DATE(w.created_at) = CURDATE() THEN 1 ELSE 0 END) AS todayRegistrations,
            SUM(CASE WHEN w.follow_up_date = CURDATE() AND w.customer_status NOT IN ('Converted','Visited Store','Not Interested','Cancelled','Closed') THEN 1 ELSE 0 END) AS todayFollowUps,
            SUM(CASE WHEN w.follow_up_date < CURDATE() AND w.customer_status NOT IN ('Converted','Visited Store','Not Interested','Cancelled','Closed') THEN 1 ELSE 0 END) AS overdueFollowUps,
            SUM(CASE WHEN w.wedding_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS upcomingWeddings30,
            SUM(CASE WHEN w.wedding_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS upcomingWeddings7,
            SUM(CASE WHEN w.customer_status = 'Shopping Date Confirmed' THEN 1 ELSE 0 END) AS shoppingConfirmed,
            SUM(CASE WHEN w.customer_status IN ('Visited Store') THEN 1 ELSE 0 END) AS storeVisitsDone,
            SUM(CASE WHEN w.customer_status = 'Converted' THEN 1 ELSE 0 END) AS purchaseCompleted,
            SUM(CASE WHEN w.customer_status = 'Not Interested' THEN 1 ELSE 0 END) AS notInterested,
            SUM(CASE WHEN w.customer_status IN ('Cancelled','Closed') THEN 1 ELSE 0 END) AS cancelledClosed
          FROM wedding_customers w
          WHERE w.is_deleted = 0 AND (w.lifecycle_status = 'ACTIVE' OR w.lifecycle_status IS NULL) ${locClause}
        `, params),
        pool.query(
          `SELECT COUNT(*) AS count FROM wedding_visits v WHERE v.visit_date = CURDATE() ${locClause.replace(/w\./g, 'v.')}`,
          params
        ).catch(vErr => {
          console.warn('[getEnhancedDashboardStats visits count fallback]', vErr.message);
          return [[{ count: 0 }]];
        }),
        pool.query(
          `SELECT COUNT(*) AS count FROM wedding_appointments a WHERE a.appointment_date = CURDATE() ${locClause.replace(/w\./g, 'a.')}`,
          params
        ).catch(aErr => {
          console.warn('[getEnhancedDashboardStats appts count fallback]', aErr.message);
          return [[{ count: 0 }]];
        })
      ]);

      const todayVisits = Number(visitResult?.[0]?.[0]?.count) || 0;
      const todayAppointments = Number(apptResult?.[0]?.[0]?.count) || 0;
      const main = mainStats[0] || {};
      const stats = {
        totalCustomers: Number(main.totalCustomers) || 0,
        todayRegistrations: Number(main.todayRegistrations) || 0,
        todayFollowUps: Number(main.todayFollowUps) || 0,
        overdueFollowUps: Number(main.overdueFollowUps) || 0,
        upcomingWeddings7: Number(main.upcomingWeddings7) || 0,
        upcomingWeddings30: Number(main.upcomingWeddings30) || 0,
        todayVisits,
        todayAppointments,
        shoppingConfirmed: Number(main.shoppingConfirmed) || 0,
        storeVisitsDone: Number(main.storeVisitsDone) || 0,
        purchaseCompleted: Number(main.purchaseCompleted) || 0,
        notInterested: Number(main.notInterested) || 0,
        cancelledClosed: Number(main.cancelledClosed) || 0
      };

      const rawParam = req.query?.locationId || req.query?.location_id || req.headers?.['x-location-id'] || req.body?.locationId || req.body?.location_id;
      const requestedLoc = parseTargetLocation(rawParam);

      const isAdminRole = ['Admin', 'Super Admin', 'system administrator'].includes(req.user?.role);
      const isGlobal = isAdminRole && (!req.user?.locationId || req.user?.isGlobalAdmin);

      let locCardsWhere = '';
      let locCardsParams = [];

      if (isGlobal) {
        if (requestedLoc) {
          locCardsWhere = 'WHERE l.id = ?';
          locCardsParams.push(requestedLoc);
        }
      } else {
        let allowed = [];
        if (Array.isArray(req.user?.allowedLocations) && req.user.allowedLocations.length > 0) {
          allowed = req.user.allowedLocations;
        } else if (req.user?.locationId) {
          allowed = [req.user.locationId];
        }

        if (allowed.length === 1) {
          locCardsWhere = 'WHERE l.id = ?';
          locCardsParams.push(allowed[0]);
        } else if (allowed.length > 1) {
          if (requestedLoc && allowed.includes(requestedLoc)) {
            locCardsWhere = 'WHERE l.id = ?';
            locCardsParams.push(requestedLoc);
          } else {
            const placeholders = allowed.map(() => '?').join(', ');
            locCardsWhere = `WHERE l.id IN (${placeholders})`;
            locCardsParams.push(...allowed);
          }
        } else {
          locCardsWhere = 'WHERE 1 = 0';
        }
      }

      let locationCards = [];
      try {
        const [locRows] = await pool.query(`
          SELECT
            l.id AS location_id, l.location_code, l.location_name, COALESCE(l.sort_order, 0) AS sort_order,
            COUNT(w.id) AS total_customers,
            SUM(CASE WHEN DATE(w.created_at) = CURDATE() THEN 1 ELSE 0 END) AS new_customers,
            SUM(CASE WHEN w.follow_up_date < CURDATE() AND w.customer_status NOT IN ('Converted','Visited Store','Not Interested','Cancelled','Closed') THEN 1 ELSE 0 END) AS pending_followups,
            SUM(CASE WHEN w.wedding_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS upcoming_weddings,
            SUM(CASE WHEN w.customer_status IN ('Visited Store','Converted') THEN 1 ELSE 0 END) AS visits,
            SUM(CASE WHEN w.customer_status = 'Converted' THEN 1 ELSE 0 END) AS purchases
          FROM locations l
          LEFT JOIN wedding_customers w ON w.location_id = l.id AND w.is_deleted = 0
          ${locCardsWhere}
          GROUP BY l.id, l.location_code, l.location_name, l.sort_order
          ORDER BY l.sort_order ASC, l.id ASC
        `, locCardsParams);
        locationCards = locRows || [];
      } catch (locErr) {
        console.warn('[getEnhancedDashboardStats locationCards query fallback]', locErr.message);
      }

      return successRes(res, { stats, locationCards, locationBreakdown: locationCards }, 'Enhanced dashboard stats fetched');
    } catch (err) {
      console.error('[WeddingController.getEnhancedDashboardStats Error]', err);
      return errorRes(res, 'Failed to fetch enhanced dashboard', [err.message], 500);
    }
  }

  async getDashboardCharts(req, res) {
    try {
      await ensureTables();
      const { clause: locClause, params } = resolveLocFilter(req, 'w');

      const [monthlyRegs] = await pool.query(`
        SELECT DATE_FORMAT(w.created_at, '%Y-%m') AS month, COUNT(*) AS count
        FROM wedding_customers w WHERE w.is_deleted = 0 ${locClause}
        GROUP BY month ORDER BY month DESC LIMIT 12
      `, params);

      const [locBreakdown] = await pool.query(`
        SELECT l.location_name, l.location_code, COUNT(w.id) AS count
        FROM wedding_customers w
        LEFT JOIN locations l ON l.id = w.location_id
        WHERE w.is_deleted = 0 ${locClause}
        GROUP BY l.id, l.location_name, l.location_code
      `, params);

      const [leadSources] = await pool.query(`
        SELECT COALESCE(src.source_name, 'Unknown') AS source, COUNT(w.id) AS count
        FROM wedding_customers w
        LEFT JOIN wedding_customer_sources src ON src.id = w.source_id
        WHERE w.is_deleted = 0 ${locClause}
        GROUP BY src.source_name ORDER BY count DESC
      `, params);

      const [statusDist] = await pool.query(`
        SELECT w.customer_status AS status, COUNT(*) AS count
        FROM wedding_customers w WHERE w.is_deleted = 0 ${locClause}
        GROUP BY w.customer_status ORDER BY count DESC
      `, params);

      const [weddingCat] = await pool.query(`
        SELECT COALESCE(w.preferred_shopping_category, 'General') AS category, COUNT(*) AS count
        FROM wedding_customers w WHERE w.is_deleted = 0 ${locClause}
        GROUP BY category ORDER BY count DESC LIMIT 10
      `, params);

      return successRes(res, {
        monthlyRegistrations: monthlyRegs || [],
        locationBreakdown: locBreakdown || [],
        leadSources: leadSources || [],
        statusDistribution: statusDist || [],
        weddingCategoryDistribution: weddingCat || []
      }, 'Dashboard charts fetched');
    } catch (err) {
      console.error('[WeddingController.getDashboardCharts Error]', err);
      return errorRes(res, 'Failed to fetch chart data', [err.message], 500);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // EMPLOYEE PERFORMANCE
  // ═══════════════════════════════════════════════════════════════════

  async getEmployeePerformance(req, res) {
    try {
      const { clause: locClause, params } = resolveLocFilter(req, 'w');

      const [performance] = await pool.query(`
        SELECT
          COALESCE(w.assigned_telecaller, 'Unassigned') AS employee,
          COUNT(w.id) AS assigned_customers,
          SUM(CASE WHEN w.customer_status = 'Converted' THEN 1 ELSE 0 END) AS converted,
          SUM(CASE WHEN w.follow_up_date <= CURDATE() AND w.customer_status NOT IN ('Converted','Visited Store','Not Interested','Cancelled','Closed') THEN 1 ELSE 0 END) AS pending_followups,
          SUM(CASE WHEN w.follow_up_date < CURDATE() AND w.customer_status NOT IN ('Converted','Visited Store','Not Interested','Cancelled','Closed') THEN 1 ELSE 0 END) AS overdue_followups,
          SUM(CASE WHEN w.customer_status IN ('Visited Store','Converted') THEN 1 ELSE 0 END) AS visits,
          SUM(CASE WHEN w.customer_status = 'Shopping Date Confirmed' THEN 1 ELSE 0 END) AS shopping_confirmed,
          SUM(CASE WHEN w.total_calls_count > 0 THEN 1 ELSE 0 END) AS total_called
        FROM wedding_customers w
        WHERE w.is_deleted = 0 ${locClause}
        GROUP BY w.assigned_telecaller
        ORDER BY assigned_customers DESC
      `, params);

      return successRes(res, { performance: performance || [] }, 'Employee performance fetched');
    } catch (err) {
      console.error('[WeddingController.getEmployeePerformance Error]', err);
      return errorRes(res, 'Failed to fetch performance', [err.message], 500);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // BULK OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async bulkUpdateStatus(req, res) {
    try {
      const { customer_ids, new_status } = req.body;
      if (!customer_ids || !Array.isArray(customer_ids) || customer_ids.length === 0) {
        return errorRes(res, 'customer_ids array is required', [], 400);
      }
      if (!new_status) return errorRes(res, 'new_status is required', [], 400);

      const placeholders = customer_ids.map(() => '?').join(',');
      const { clause: locClause, params: locParams } = resolveLocFilter(req, '');

      // Only active rows inside the caller's locations are eligible; archived
      // records are immune to bulk edits.
      const [eligible] = await pool.query(`
        SELECT id, customer_status, location_id FROM wedding_customers
        WHERE id IN (${placeholders}) AND is_deleted = 0
          AND (lifecycle_status = 'ACTIVE' OR lifecycle_status IS NULL) ${locClause}
      `, [...customer_ids, ...locParams]);

      if (eligible.length === 0) {
        return errorRes(res, 'No eligible customers were found for this bulk action', [], 404);
      }

      const eligibleIds = eligible.map((c) => c.id);
      const eligiblePlaceholders = eligibleIds.map(() => '?').join(',');

      await pool.query(
        `UPDATE wedding_customers SET customer_status = ? WHERE id IN (${eligiblePlaceholders})`,
        [new_status, ...eligibleIds]
      );

      for (const cust of eligible) {
        await pool.query(
          `INSERT INTO wedding_status_history (customer_id, location_id, old_status, new_status, changed_by, changed_by_user_id) VALUES (?, ?, ?, ?, ?, ?)`,
          [cust.id, cust.location_id, cust.customer_status, new_status, req.user?.fullName || 'Staff', req.user?.id || null]
        );
      }

      await pool.query(
        `INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details) VALUES (NULL, 0, ?, 'Bulk Status Update', ?)`,
        [req.user?.fullName || 'Staff', `Updated ${eligible.length} customers to "${new_status}"`]
      );

      let archivedCount = 0;
      if (COMPLETION_STATUSES.has(String(new_status).trim())) {
        for (const cust of eligible) {
          const result = await archiveCustomerAsOld(cust.id, req.user, {
            completedStatus: String(new_status).trim(),
            previousStatus: cust.customer_status,
            reason: 'Bulk completion — wedding process completed'
          });
          if (result.archived) archivedCount++;
        }
      }

      return successRes(res, {
        updated: eligible.length,
        skipped: customer_ids.length - eligible.length,
        archived: archivedCount
      }, archivedCount ? `Bulk updated ${eligible.length} customers, ${archivedCount} moved to Old Customers.` : `Bulk updated ${eligible.length} customers`);
    } catch (err) {
      console.error('[WeddingController.bulkUpdateStatus Error]', err);
      return errorRes(res, 'Failed to bulk update', [err.message], 500);
    }
  }

  async bulkAssign(req, res) {
    try {
      const { customer_ids, assigned_telecaller, assigned_telecaller_id } = req.body;
      if (!customer_ids || !Array.isArray(customer_ids) || customer_ids.length === 0) {
        return errorRes(res, 'customer_ids array is required', [], 400);
      }
      if (!assigned_telecaller) return errorRes(res, 'assigned_telecaller is required', [], 400);

      const placeholders = customer_ids.map(() => '?').join(',');
      const { clause: locClause, params: locParams } = resolveLocFilter(req, '');

      await pool.query(
        `UPDATE wedding_customers SET assigned_telecaller = ?, assigned_telecaller_id = ? WHERE id IN (${placeholders}) AND is_deleted = 0 AND (lifecycle_status = 'ACTIVE' OR lifecycle_status IS NULL) ${locClause}`,
        [assigned_telecaller, assigned_telecaller_id ? parseInt(assigned_telecaller_id, 10) : null, ...customer_ids, ...locParams]
      );

      await pool.query(
        `INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details) VALUES (NULL, 0, ?, 'Bulk Assign', ?)`,
        [req.user?.fullName || 'Staff', `Assigned ${customer_ids.length} customers to ${assigned_telecaller}`]
      );

      return successRes(res, { assigned: customer_ids.length }, `Assigned ${customer_ids.length} customers to ${assigned_telecaller}`);
    } catch (err) {
      console.error('[WeddingController.bulkAssign Error]', err);
      return errorRes(res, 'Failed to bulk assign', [err.message], 500);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // REPORTS
  // ═══════════════════════════════════════════════════════════════════

  async getReports(req, res) {
    try {
      const { report_type } = req.query;
      const { clause: locClause, params } = resolveLocFilter(req, 'w');

      let data = {};

      if (!report_type || report_type === 'overview') {
        const [overview] = await pool.query(`
          SELECT
            COUNT(*) AS total_customers,
            SUM(CASE WHEN DATE(w.created_at) = CURDATE() THEN 1 ELSE 0 END) AS today_new,
            SUM(CASE WHEN w.customer_status = 'Converted' THEN 1 ELSE 0 END) AS converted,
            SUM(CASE WHEN w.customer_status = 'Not Interested' THEN 1 ELSE 0 END) AS not_interested,
            SUM(CASE WHEN w.customer_status IN ('Cancelled','Closed') THEN 1 ELSE 0 END) AS closed,
            AVG(w.total_calls_count) AS avg_calls_per_customer
          FROM wedding_customers w WHERE w.is_deleted = 0 ${locClause}
        `, params);
        data.overview = overview[0] || {};
      }

      if (!report_type || report_type === 'location') {
        const [byLocation] = await pool.query(`
          SELECT l.location_name, l.location_code,
            COUNT(w.id) AS total, SUM(CASE WHEN w.customer_status='Converted' THEN 1 ELSE 0 END) AS converted
          FROM wedding_customers w LEFT JOIN locations l ON l.id=w.location_id
          WHERE w.is_deleted=0 ${locClause} GROUP BY l.id, l.location_name, l.location_code
        `, params);
        data.byLocation = byLocation || [];
      }

      if (!report_type || report_type === 'followup') {
        const [overdue] = await pool.query(`
          SELECT w.id, w.customer_name, w.mobile_number, w.follow_up_date, w.customer_status,
            DATEDIFF(CURDATE(), w.follow_up_date) AS days_overdue, w.assigned_telecaller,
            l.location_name
          FROM wedding_customers w LEFT JOIN locations l ON l.id=w.location_id
          WHERE w.is_deleted=0 AND w.follow_up_date < CURDATE()
            AND w.customer_status NOT IN ('Converted','Visited Store','Not Interested','Cancelled','Closed')
            ${locClause}
          ORDER BY w.follow_up_date ASC LIMIT 200
        `, params);
        data.overdueFollowUps = overdue || [];
      }

      return successRes(res, data, 'Reports generated');
    } catch (err) {
      console.error('[WeddingController.getReports Error]', err);
      return errorRes(res, 'Failed to generate reports', [err.message], 500);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // MERGE DUPLICATE CUSTOMERS
  // ═══════════════════════════════════════════════════════════════════

  async mergeCustomers(req, res) {
    try {
      const { primary_id, duplicate_id } = req.body;
      if (!primary_id || !duplicate_id) return errorRes(res, 'primary_id and duplicate_id required', [], 400);
      if (primary_id === duplicate_id) return errorRes(res, 'Cannot merge a customer with itself', [], 400);

      const [primary] = await pool.query(`SELECT * FROM wedding_customers WHERE id = ? AND is_deleted = 0`, [primary_id]);
      const [dup] = await pool.query(`SELECT * FROM wedding_customers WHERE id = ? AND is_deleted = 0`, [duplicate_id]);
      if (!primary?.length) return errorRes(res, 'Primary customer not found', [], 404);
      if (!dup?.length) return errorRes(res, 'Duplicate customer not found', [], 404);

      // Merge soft-deletes the duplicate and repoints its history, so it would
      // both destroy an archived record and strip the permanent trail.
      const archivedSide = [primary[0], dup[0]].find((c) => c.lifecycle_status === 'OLD_CUSTOMER');
      if (archivedSide) {
        return res.status(403).json({
          success: false,
          message: 'Completed customer records are permanently protected.',
          code: 'OLD_CUSTOMER_PROTECTED'
        });
      }

      const tables = [
        'wedding_call_logs', 'wedding_visits', 'wedding_appointments',
        'wedding_purchases', 'wedding_notes', 'wedding_communication',
        'wedding_status_history', 'wedding_documents', 'wedding_audit_logs'
      ];

      for (const table of tables) {
        await pool.query(`UPDATE ${table} SET customer_id = ? WHERE customer_id = ?`, [primary_id, duplicate_id]);
      }

      await pool.query(`UPDATE wedding_customers SET is_deleted = 1, deleted_at = NOW() WHERE id = ?`, [duplicate_id]);

      await pool.query(
        `INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details) VALUES (?, ?, ?, 'Customer Merged', ?)`,
        [primary_id, primary[0].location_id, req.user?.fullName || 'Staff', `Merged duplicate ${dup[0].customer_code} (${dup[0].customer_name}) into ${primary[0].customer_code}`]
      );

      return successRes(res, { primary_id, merged_from: duplicate_id }, 'Customers merged successfully');
    } catch (err) {
      console.error('[WeddingController.mergeCustomers Error]', err);
      return errorRes(res, 'Failed to merge customers', [err.message], 500);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // FULL CUSTOMER PROFILE (all related data)
  // ═══════════════════════════════════════════════════════════════════

  async getFullCustomerProfile(req, res) {
    try {
      await ensureTables();
      const id = parseInt(req.params.id, 10);
      const { clause: locClause, params } = resolveLocFilter(req, 'w');

      const [custRows] = await pool.query(`
        SELECT w.*, l.location_code, l.location_name,
          CASE WHEN w.wedding_date IS NOT NULL THEN DATEDIFF(w.wedding_date, CURDATE()) ELSE NULL END AS days_until_wedding
        FROM wedding_customers w LEFT JOIN locations l ON l.id = w.location_id
        WHERE w.id = ? AND w.is_deleted = 0 ${locClause}
      `, [id, ...params]);
      if (!custRows?.length) {
        const [anyCust] = await pool.query(`SELECT id, location_id FROM wedding_customers WHERE id = ? AND is_deleted = 0 LIMIT 1`, [id]);
        if (anyCust && anyCust.length > 0) {
          const { record403Violation } = require('../middleware/suspiciousActivityTracker');
          const violation = record403Violation(req, res, `Cross-store URL tampering: user tried accessing profile #${id} from another location`);
          const msg = violation.forceLogout
            ? 'Session expired. Please log in again.'
            : 'Access denied: You do not have permission to view customer records from other store locations.';
          return res.status(403).json({
            success: false,
            message: msg,
            forceLogout: violation.forceLogout,
            violationCount: violation.violationCount
          });
        }
        return errorRes(res, 'Customer not found', [], 404);
      }

      const customer = custRows[0];
      decryptRow(customer, ENCRYPTED_FIELDS);

      const [callLogs] = await pool.query(`SELECT * FROM wedding_call_logs WHERE customer_id = ? ORDER BY call_date DESC, id DESC`, [id]);
      decryptRows(callLogs, CALL_LOG_ENCRYPTED_FIELDS);

      const [visits] = await pool.query(`SELECT * FROM wedding_visits WHERE customer_id = ? ORDER BY visit_date DESC`, [id]);
      decryptRows(visits, ['visit_notes']);

      const [appointments] = await pool.query(`SELECT * FROM wedding_appointments WHERE customer_id = ? ORDER BY appointment_date DESC`, [id]);
      decryptRows(appointments, ['appointment_notes', 'special_arrangement']);

      const [purchases] = await pool.query(`SELECT * FROM wedding_purchases WHERE customer_id = ? ORDER BY purchase_date DESC`, [id]);
      decryptRows(purchases, ['purchase_notes']);

      const [notes] = await pool.query(`SELECT * FROM wedding_notes WHERE customer_id = ? ORDER BY created_at DESC`, [id]);
      decryptRows(notes, ['note_content']);

      const [statusHistory] = await pool.query(`SELECT * FROM wedding_status_history WHERE customer_id = ? ORDER BY created_at DESC`, [id]);

      const [communications] = await pool.query(`SELECT * FROM wedding_communication WHERE customer_id = ? ORDER BY communication_date DESC`, [id]);
      decryptRows(communications, ['communication_details']);

      const [documents] = await pool.query(`SELECT * FROM wedding_documents WHERE customer_id = ? ORDER BY created_at DESC`, [id]);

      const [auditLogs] = await pool.query(`SELECT * FROM wedding_audit_logs WHERE customer_id = ? ORDER BY created_at DESC LIMIT 50`, [id]);

      // Associated wedding registrations & records for this customer / mobile number
      const cleanMob = customer.mobile_number ? String(customer.mobile_number).replace(/\D/g, '') : '';
      const normMob = cleanMob.length === 10 ? `+91${cleanMob}` : (customer.mobile_number || '');
      const [associatedRegistrations] = await pool.query(`
        SELECT wr.id, wr.registration_id, wr.customer_name, wr.mobile, wr.wedding_date,
               wr.wedding_venue, wr.bride_name, wr.groom_name, wr.budget_range, wr.status,
               wr.location_code, wr.created_at, l.location_name
        FROM wedding_registrations wr
        LEFT JOIN locations l ON l.id = wr.location_id
        WHERE (wr.mobile = ? OR wr.mobile = ? OR wr.customer_id = ? OR wr.registration_id = ?)
          AND wr.status != 'Deleted'
        ORDER BY wr.created_at DESC
      `, [normMob, cleanMob, customer.customer_code || '', customer.customer_code || '']);

      // Repeat-customer journeys for the same mobile. Location-scoped like every
      // other read, so a Davanagere user cannot see a Shivamogga customer record.
      const { clause: assocClause, params: assocParams } = resolveLocFilter(req, 'wc');
      const [associatedCustomers] = await pool.query(`
        SELECT wc.id, wc.customer_code, wc.customer_name, wc.mobile_number, wc.wedding_date,
               wc.customer_status, wc.assigned_telecaller, wc.expected_shopping_date, wc.created_at,
               wc.lifecycle_status, wc.previous_status, wc.archived_at, wc.archived_by,
               wc.previous_customer_id,
               l.location_name, l.location_code
        FROM wedding_customers wc
        LEFT JOIN locations l ON l.id = wc.location_id
        WHERE (wc.mobile_number = ? OR wc.mobile_number = ?)
          AND wc.id != ? AND wc.is_deleted = 0 ${assocClause}
        ORDER BY wc.created_at DESC
      `, [normMob, cleanMob, id, ...assocParams]);

      let instructions = [];
      try {
        await ensureTelecallerInstructionsTable().catch(() => {});
        const [instrRows] = await pool.query(
          `SELECT * FROM wedding_telecaller_instructions WHERE customer_id = ? ORDER BY created_at DESC, id DESC LIMIT 50`,
          [id]
        );
        instructions = (instrRows || []).map(mapInstructionRow);
      } catch (e) {
        // Fallback gracefully
      }

      return successRes(res, {
        customer,
        callLogs: callLogs || [],
        timeline: callLogs || [],
        visits: visits || [],
        appointments: appointments || [],
        purchases: purchases || [],
        notes: notes || [],
        statusHistory: statusHistory || [],
        communications: communications || [],
        documents: documents || [],
        auditLogs: auditLogs || [],
        instructions: instructions || [],
        associatedRegistrations: associatedRegistrations || [],
        associatedCustomers: associatedCustomers || [],
        is_old_customer: customer.lifecycle_status === 'OLD_CUSTOMER'
      }, 'Full customer profile fetched successfully.');
    } catch (err) {
      console.error('[WeddingController.getFullCustomerProfile Error]', err);
      return errorRes(res, 'Failed to fetch full profile', [err.message], 500);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // ADVANCED SEARCH
  // ═══════════════════════════════════════════════════════════════════

  async searchCustomers(req, res) {
    try {
      const { q } = req.query;
      if (!q || !q.trim()) return errorRes(res, 'Search query required', [], 400);

      const searchTerm = `%${q.trim().toLowerCase()}%`;
      const { clause: locClause, params: locParams } = resolveLocFilter(req, 'w');

      const [results] = await pool.query(`
        SELECT w.id, w.customer_code, w.customer_name, w.mobile_number, w.email,
          w.wedding_date, w.customer_status, w.location_id, w.assigned_telecaller,
          l.location_name, l.location_code
        FROM wedding_customers w
        LEFT JOIN locations l ON l.id = w.location_id
        WHERE w.is_deleted = 0 AND (w.lifecycle_status = 'ACTIVE' OR w.lifecycle_status IS NULL) ${locClause}
          AND (
            LOWER(w.customer_name) LIKE ? OR
            LOWER(w.mobile_number) LIKE ? OR
            LOWER(w.customer_code) LIKE ? OR
            LOWER(COALESCE(w.email,'')) LIKE ? OR
            LOWER(COALESCE(w.bride_name,'')) LIKE ? OR
            LOWER(COALESCE(w.groom_name,'')) LIKE ? OR
            LOWER(COALESCE(w.wedding_venue,'')) LIKE ? OR
            LOWER(COALESCE(w.wedding_city,'')) LIKE ? OR
            LOWER(COALESCE(w.assigned_telecaller,'')) LIKE ? OR
            LOWER(COALESCE(w.customer_notes,'')) LIKE ?
          )
        ORDER BY w.follow_up_date ASC, w.id DESC
        LIMIT 100
      `, [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, ...locParams]);

      return successRes(res, { results: results || [], total: results?.length || 0 }, 'Search completed');
    } catch (err) {
      console.error('[WeddingController.searchCustomers Error]', err);
      return errorRes(res, 'Search failed', [err.message], 500);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // UPCOMING WEDDINGS
  // ═══════════════════════════════════════════════════════════════════

  async getUpcomingWeddings(req, res) {
    try {
      const { days = 30 } = req.query;
      const numDays = Math.min(365, Math.max(1, parseInt(days, 10) || 30));
      const { clause: locClause, params } = resolveLocFilter(req, 'w');

      const [weddings] = await pool.query(`
        SELECT w.id, w.customer_code, w.customer_name, w.mobile_number,
          w.wedding_date, w.bride_name, w.groom_name, w.wedding_venue,
          DATEDIFF(w.wedding_date, CURDATE()) AS days_remaining,
          w.customer_status, w.assigned_telecaller, w.location_id,
          l.location_name
        FROM wedding_customers w
        LEFT JOIN locations l ON l.id = w.location_id
        WHERE w.is_deleted = 0 AND (w.lifecycle_status = 'ACTIVE' OR w.lifecycle_status IS NULL) AND w.wedding_date IS NOT NULL
          AND w.wedding_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ${numDays} DAY)
          ${locClause}
        ORDER BY w.wedding_date ASC
      `, params);

      return successRes(res, { weddings: weddings || [], total: weddings?.length || 0 }, 'Upcoming weddings fetched');
    } catch (err) {
      console.error('[WeddingController.getUpcomingWeddings Error]', err);
      return errorRes(res, 'Failed to fetch upcoming weddings', [err.message], 500);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // PIPELINE / STATUS OVERVIEW
  // ═══════════════════════════════════════════════════════════════════

  async getStatusPipeline(req, res) {
    try {
      const { clause: locClause, params } = resolveLocFilter(req, 'w');

      const statuses = [
        'New', 'Contact Pending', 'Contacted', 'Interested', 'Follow-up',
        'Shopping Planned', 'Visit Scheduled', 'Visited Store',
        'Purchase in Progress', 'Converted', 'Not Interested', 'Cancelled', 'Closed'
      ];

      const [counts] = await pool.query(`
        SELECT w.customer_status AS status, COUNT(*) AS count
        FROM wedding_customers w
        WHERE w.is_deleted = 0 AND (w.lifecycle_status = 'ACTIVE' OR w.lifecycle_status IS NULL) ${locClause}
        GROUP BY w.customer_status
      `, params);

      const statusMap = {};
      for (const row of (counts || [])) {
        statusMap[row.status] = Number(row.count);
      }

      const pipeline = statuses.map(s => ({
        status: s,
        count: statusMap[s] || 0
      }));

      return successRes(res, { pipeline, statuses }, 'Pipeline fetched');
    } catch (err) {
      console.error('[WeddingController.getStatusPipeline Error]', err);
      return errorRes(res, 'Failed to fetch pipeline', [err.message], 500);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // EXTENDED CALENDAR (visits + appointments + weddings + followups)
  // ═══════════════════════════════════════════════════════════════════

  async getExtendedCalendar(req, res) {
    try {
      const { year, month } = req.query;
      let targetYear = parseInt(year, 10);
      let targetMonth = parseInt(month, 10);

      if (typeof month === 'string' && month.includes('-')) {
        const parts = month.split('-');
        targetYear = parseInt(parts[0], 10);
        targetMonth = parseInt(parts[1], 10);
      }
      if (!targetYear || isNaN(targetYear)) targetYear = new Date().getFullYear();
      if (!targetMonth || isNaN(targetMonth)) targetMonth = new Date().getMonth() + 1;

      const { clause: locClause, params } = resolveLocFilter(req, 'w');

      const start = `${targetYear}-${String(targetMonth).padStart(2,'0')}-01`;
      const endMonth = targetMonth === 12 ? 1 : targetMonth + 1;
      const endYear = targetMonth === 12 ? targetYear + 1 : targetYear;
      const end = `${endYear}-${String(endMonth).padStart(2,'0')}-01`;

      const [
        [followups],
        [weddings],
        [appts],
        [visits]
      ] = await Promise.all([
        pool.query(`
          SELECT w.id, w.customer_name, w.follow_up_date AS date, 'followup' AS event_type, w.customer_status, w.assigned_telecaller
          FROM wedding_customers w
          WHERE w.is_deleted=0 AND (w.lifecycle_status = 'ACTIVE' OR w.lifecycle_status IS NULL) AND w.follow_up_date >= ? AND w.follow_up_date < ? ${locClause}
          ORDER BY w.follow_up_date
        `, [start, end, ...params]),
        pool.query(`
          SELECT w.id, w.customer_name, w.wedding_date AS date, 'wedding' AS event_type, w.bride_name, w.groom_name
          FROM wedding_customers w
          WHERE w.is_deleted=0 AND (w.lifecycle_status = 'ACTIVE' OR w.lifecycle_status IS NULL) AND w.wedding_date IS NOT NULL AND w.wedding_date >= ? AND w.wedding_date < ? ${locClause}
          ORDER BY w.wedding_date
        `, [start, end, ...params]),
        pool.query(`
          SELECT a.id, a.customer_id, a.appointment_date AS date, a.appointment_time AS time, 'appointment' AS event_type, a.purpose, a.appointment_status
          FROM wedding_appointments a
          WHERE a.appointment_date >= ? AND a.appointment_date < ? ${locClause.replace('w.','a.')}
          ORDER BY a.appointment_date
        `, [start, end, ...params]),
        pool.query(`
          SELECT v.id, v.customer_id, v.visit_date AS date, v.visit_time AS time, 'visit' AS event_type, v.purpose, v.visit_status
          FROM wedding_visits v
          WHERE v.visit_date >= ? AND v.visit_date < ? ${locClause.replace('w.','v.')}
          ORDER BY v.visit_date
        `, [start, end, ...params])
      ]);

      const events = [
        ...(followups || []).map(e => ({ ...e, start: e.date, title: `Follow-up: ${e.customer_name}` })),
        ...(weddings || []).map(e => ({ ...e, start: e.date, title: `Wedding: ${e.customer_name}` })),
        ...(appts || []).map(e => ({ ...e, start: `${e.date}T${e.time || '00:00'}`, title: `Appointment: ${e.customer_name || e.customer_id}` })),
        ...(visits || []).map(e => ({ ...e, start: `${e.date}T${e.time || '00:00'}`, title: `Visit: ${e.customer_name || e.customer_id}` }))
      ];

      return successRes(res, { events, year: targetYear, month: targetMonth }, 'Extended calendar fetched');
    } catch (err) {
      console.error('[WeddingController.getExtendedCalendar Error]', err);
      return errorRes(res, 'Failed to fetch calendar', [err.message], 500);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // OLD CUSTOMERS (Historical CRM Lifecycle & Archives)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get Filtered & Paginated Old Customers with Breakdown Statistics
   */
  async getOldCustomers(req, res) {
    try {
      await ensureTables();
      const {
        search,
        location_id,
        telecaller_id,
        previous_status,
        customer_status,
        shopping_category,
        archived_from,
        archived_to,
        wedding_from,
        wedding_to,
        shopping_from,
        shopping_to,
        date_filter,
        page,
        limit = 50,
        sort_by = 'archived_at',
        sort_order = 'desc'
      } = req.query;

      const { clause: locClause, params: queryParams } = resolveLocFilter(req, 'w');
      let whereClauses = [
        `w.is_deleted = 0`,
        `w.lifecycle_status = 'OLD_CUSTOMER'`,
        `1=1 ${locClause}`
      ];

      // Telecaller scoping: Telecallers only see their assigned records
      if (req.user && req.user.role === 'Telecaller') {
        whereClauses.push(`(w.assigned_telecaller_id = ? OR w.assigned_telecaller = ?)`);
        queryParams.push(req.user.id, req.user.fullName || req.user.username || '');
      }

      // Fast Search Filter (Customer ID, Name, Mobile, Email, Wedding City, Store Location)
      if (search && search.trim()) {
        const q = `%${search.trim().toLowerCase()}%`;
        whereClauses.push(`(
          LOWER(w.customer_name) LIKE ? OR
          w.mobile_number LIKE ? OR
          LOWER(w.customer_code) LIKE ? OR
          LOWER(COALESCE(w.email, '')) LIKE ? OR
          LOWER(COALESCE(w.wedding_city, '')) LIKE ? OR
          LOWER(COALESCE(l.location_name, '')) LIKE ? OR
          LOWER(COALESCE(l.location_code, '')) LIKE ?
        )`);
        queryParams.push(q, q, q, q, q, q, q);
      }

      // Previous Status / Customer Status Filter
      const targetPrevStatus = previous_status || customer_status;
      if (targetPrevStatus && targetPrevStatus !== 'all') {
        whereClauses.push(`(w.previous_status = ? OR w.customer_status = ?)`);
        queryParams.push(targetPrevStatus, targetPrevStatus);
      }

      // Assigned Telecaller Filter
      if (telecaller_id && telecaller_id !== 'all') {
        if (!isNaN(parseInt(telecaller_id, 10))) {
          whereClauses.push(`(w.assigned_telecaller_id = ? OR w.assigned_telecaller = ?)`);
          queryParams.push(parseInt(telecaller_id, 10), telecaller_id);
        } else {
          whereClauses.push(`w.assigned_telecaller = ?`);
          queryParams.push(telecaller_id);
        }
      }

      // Shopping Category Filter
      if (shopping_category && shopping_category !== 'all') {
        whereClauses.push(`w.preferred_shopping_category LIKE ?`);
        queryParams.push(`%${shopping_category}%`);
      }

      // Archived Date Filters
      if (archived_from && archived_to) {
        whereClauses.push(`DATE(w.archived_at) BETWEEN ? AND ?`);
        queryParams.push(archived_from, archived_to);
      } else if (archived_from) {
        whereClauses.push(`DATE(w.archived_at) >= ?`);
        queryParams.push(archived_from);
      } else if (archived_to) {
        whereClauses.push(`DATE(w.archived_at) <= ?`);
        queryParams.push(archived_to);
      }

      // Wedding Date Filters
      if (wedding_from && wedding_to) {
        whereClauses.push(`w.wedding_date BETWEEN ? AND ?`);
        queryParams.push(wedding_from, wedding_to);
      } else if (wedding_from) {
        whereClauses.push(`w.wedding_date >= ?`);
        queryParams.push(wedding_from);
      } else if (wedding_to) {
        whereClauses.push(`w.wedding_date <= ?`);
        queryParams.push(wedding_to);
      }

      // Expected Shopping Date Filters
      if (shopping_from && shopping_to) {
        whereClauses.push(`w.expected_shopping_date BETWEEN ? AND ?`);
        queryParams.push(shopping_from, shopping_to);
      }

      // Quick Date Filter on Archived Date
      if (date_filter === 'today') {
        whereClauses.push(`DATE(w.archived_at) = CURDATE()`);
      } else if (date_filter === 'this_week') {
        whereClauses.push(`YEARWEEK(w.archived_at, 1) = YEARWEEK(CURDATE(), 1)`);
      } else if (date_filter === 'this_month') {
        whereClauses.push(`DATE_FORMAT(w.archived_at, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')`);
      } else if (date_filter === 'last_month') {
        whereClauses.push(`DATE_FORMAT(w.archived_at, '%Y-%m') = DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m')`);
      }

      const whereSql = whereClauses.join(' AND ');
      const fromSql = `FROM wedding_customers w LEFT JOIN locations l ON l.id = w.location_id`;

      // Pagination
      const limitNum = Math.min(5000, Math.max(1, parseInt(limit, 10) || 50));
      const parsedPage = parseInt(page, 10);
      const parsedOffset = parseInt(req.query.offset, 10);
      const pageNum = !isNaN(parsedPage)
        ? Math.max(1, parsedPage)
        : (!isNaN(parsedOffset) && parsedOffset > 0
          ? Math.floor(parsedOffset / limitNum) + 1
          : 1);
      const offset = (pageNum - 1) * limitNum;

      // Safe sorting column
      const validSortCols = {
        archived_at: 'COALESCE(w.archived_at, w.updated_at)',
        customer_name: 'w.customer_name',
        wedding_date: 'w.wedding_date',
        expected_shopping_date: 'w.expected_shopping_date',
        customer_code: 'w.customer_code',
        created_at: 'w.created_at'
      };
      const orderCol = validSortCols[sort_by] || 'COALESCE(w.archived_at, w.updated_at)';
      const orderDir = String(sort_order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

      // Parallelize Count, Paginated Rows, and Stats
      const [
        [countResult],
        [customers],
        [storeStats],
        [statusStats],
        [monthStats],
        [yearStats]
      ] = await Promise.all([
        pool.query(`SELECT COUNT(*) as total ${fromSql} WHERE ${whereSql}`, queryParams),
        pool.query(`
          SELECT 
            w.*,
            l.location_code,
            l.location_name,
            COALESCE(w.archived_at, w.updated_at) AS display_archived_at
          ${fromSql}
          WHERE ${whereSql}
          ORDER BY ${orderCol} ${orderDir}, w.id DESC
          LIMIT ? OFFSET ?
        `, [...queryParams, limitNum, offset]),
        pool.query(`
          SELECT l.location_name, l.location_code, COUNT(*) as count
          ${fromSql}
          WHERE ${whereSql}
          GROUP BY l.id, l.location_name, l.location_code
        `, queryParams),
        pool.query(`
          SELECT COALESCE(w.previous_status, w.customer_status, 'Unspecified') as status, COUNT(*) as count
          ${fromSql}
          WHERE ${whereSql}
          GROUP BY COALESCE(w.previous_status, w.customer_status, 'Unspecified')
        `, queryParams),
        // COALESCE keeps legacy rows (archived before the lifecycle columns
        // existed) countable without letting an unrelated edit bump updated_at
        // and re-credit the same completion to the current month.
        pool.query(`
          SELECT COUNT(*) as count
          ${fromSql}
          WHERE ${whereSql} AND COALESCE(w.archived_at, w.updated_at) >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
        `, queryParams),
        pool.query(`
          SELECT COUNT(*) as count
          ${fromSql}
          WHERE ${whereSql} AND YEAR(COALESCE(w.archived_at, w.updated_at)) = YEAR(CURDATE())
        `, queryParams)
      ]);

      const total = countResult[0]?.total || 0;
      decryptRows(customers, ENCRYPTED_FIELDS);

      const stats = {
        totalOldCustomers: total,
        byStore: (storeStats || []).map(r => ({ name: r.location_name || 'Unknown', code: r.location_code || null, count: Number(r.count) })),
        byPreviousStatus: (statusStats || []).map(r => ({ status: r.status, count: Number(r.count) })),
        archivedThisMonth: Number(monthStats[0]?.count || 0),
        archivedThisYear: Number(yearStats[0]?.count || 0),
        completedThisMonth: Number(monthStats[0]?.count || 0),
        completedThisYear: Number(yearStats[0]?.count || 0)
      };

      return successRes(res, {
        customers: customers || [],
        stats,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum)
        }
      }, 'Old customers fetched successfully');
    } catch (err) {
      console.error('[WeddingController.getOldCustomers Error]', err);
      return errorRes(res, 'Failed to fetch old customers', [err.message], 500);
    }
  }

  /**
   * Move Customer to Old Customers (Manual Archive)
   */
  async moveToOldCustomers(req, res) {
    try {
      await ensureTables();
      const id = parseInt(req.params.id, 10);
      if (isNaN(id) || id <= 0) {
        return errorRes(res, 'Invalid customer ID provided', [], 400);
      }

      const { clause: locClause, params } = resolveLocFilter(req, 'w');
      const [existing] = await pool.query(`
        SELECT * FROM wedding_customers w WHERE w.id = ? AND w.is_deleted = 0 ${locClause}
      `, [id, ...params]);

      if (!existing || existing.length === 0) {
        return errorRes(res, 'Customer not found or unauthorized', [], 404);
      }

      const prev = existing[0];
      const archiveReason = req.body.reason || req.body.archive_reason || 'Manually moved to Old Customers';

      // Same routine the completion trigger uses, so a manual archive and an
      // automatic one leave an identical lifecycle and audit footprint.
      const result = await archiveCustomerAsOld(id, req.user, {
        completedStatus: prev.customer_status,
        previousStatus: prev.customer_status,
        reason: archiveReason
      });

      if (!result.archived) {
        return errorRes(res, 'Customer is already in Old Customers', [], 409);
      }

      return successRes(res, {
        id,
        customer_code: prev.customer_code,
        customer_name: prev.customer_name,
        lifecycle_status: 'OLD_CUSTOMER',
        previous_status: prev.customer_status,
        archive_reason: archiveReason
      }, 'Customer moved to Old Customers successfully.');
    } catch (err) {
      console.error('[WeddingController.moveToOldCustomers Error]', err);
      return errorRes(res, 'Failed to move customer to Old Customers', [err.message], 500);
    }
  }

  /**
   * Restore Customer from Old Customers to Active Pipeline
   */
  async restoreCustomer(req, res) {
    try {
      await ensureTables();
      const id = parseInt(req.params.id, 10);
      if (isNaN(id) || id <= 0) {
        return errorRes(res, 'Invalid customer ID provided', [], 400);
      }

      const { clause: locClause, params } = resolveLocFilter(req, 'w');
      const [existing] = await pool.query(`
        SELECT * FROM wedding_customers w WHERE w.id = ? AND w.is_deleted = 0 ${locClause}
      `, [id, ...params]);

      if (!existing || existing.length === 0) {
        return errorRes(res, 'Customer not found or unauthorized', [], 404);
      }

      const prev = existing[0];
      const userName = req.user?.fullName || req.user?.username || 'Staff';
      const restoredStatus = prev.previous_status || prev.customer_status || 'Follow-up Pending';

      await pool.query(`
        UPDATE wedding_customers SET
          lifecycle_status = 'ACTIVE',
          customer_status = ?,
          archived_at = NULL,
          archived_by = NULL,
          archived_by_user_id = NULL,
          archive_reason = NULL,
          updated_at = NOW()
        WHERE id = ?
      `, [restoredStatus, id]);

      // Audit Trail
      await pool.query(`
        INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details)
        VALUES (?, ?, ?, 'Customer Restored', ?)
      `, [
        id,
        prev.location_id,
        userName,
        `Restored customer ${prev.customer_name} (${prev.customer_code}) from Old Customers to active pipeline. Status: ${restoredStatus}`
      ]);

      // Cache invalidation
      await delCachePattern(`app:prod:wedding:customer:${id}:*`);
      await delCachePattern('app:prod:wedding:dashboard:*');

      return successRes(res, {
        id,
        customer_code: prev.customer_code,
        customer_name: prev.customer_name,
        lifecycle_status: 'ACTIVE',
        customer_status: restoredStatus
      }, 'Customer restored to active customer list successfully.');
    } catch (err) {
      console.error('[WeddingController.restoreCustomer Error]', err);
      return errorRes(res, 'Failed to restore customer', [err.message], 500);
    }
  }

  /**
   * Automatic Archival: Moves completed journeys to Old Customers
   */
  async autoArchiveOldCustomers(req, res) {
    try {
      await ensureTables();
      const { clause: locClause, params } = resolveLocFilter(req, 'w');
      const includeExpired = String(req.query.include_expired || req.body?.include_expired || '') === '1';

      // Reconciliation pass for rows already at a completion status but never
      // archived (e.g. written before the trigger existed). The normal path is
      // event-driven in changeStatus / updateCustomer / logCall.
      const completionList = Array.from(COMPLETION_STATUSES);
      const statusPlaceholders = completionList.map(() => '?').join(',');
      const [candidates] = await pool.query(`
        SELECT w.id, w.customer_code, w.customer_name, w.customer_status, w.location_id
        FROM wedding_customers w
        WHERE w.is_deleted = 0
          AND (w.lifecycle_status = 'ACTIVE' OR w.lifecycle_status IS NULL)
          AND w.customer_status IN (${statusPlaceholders})
          ${locClause}
        LIMIT 500
      `, [...completionList, ...params]);

      // Opt-in sweep for journeys that simply ended (wedding date long past, or
      // closed/cancelled and untouched). Not the specified trigger, so it never
      // runs unless explicitly asked for.
      let expiredRows = [];
      if (includeExpired) {
        const [rows] = await pool.query(`
          SELECT w.id, w.customer_code, w.customer_name, w.customer_status, w.location_id
          FROM wedding_customers w
          WHERE w.is_deleted = 0
            AND (w.lifecycle_status = 'ACTIVE' OR w.lifecycle_status IS NULL)
            ${locClause}
            AND w.customer_status NOT IN (${statusPlaceholders})
            AND (
              (w.customer_status = 'Converted' AND w.wedding_date IS NOT NULL AND w.wedding_date < DATE_SUB(CURDATE(), INTERVAL 14 DAY))
              OR
              (w.customer_status IN ('Closed', 'Cancelled', 'Not Interested') AND w.updated_at < DATE_SUB(NOW(), INTERVAL 30 DAY))
            )
          LIMIT 500
        `, [...completionList, ...params]);
        expiredRows = rows || [];
      }

      const pending = [...candidates, ...expiredRows];
      if (pending.length === 0) {
        return successRes(res, { count: 0 }, 'No eligible customers for auto-archival at this time.');
      }

      const ids = [];
      for (const c of pending) {
        const result = await archiveCustomerAsOld(c.id, req.user, {
          completedStatus: c.customer_status,
          previousStatus: c.customer_status,
          reason: expiredRows.includes(c)
            ? 'Automated CRM lifecycle sweep (journey ended)'
            : 'Automated CRM lifecycle completion (Wedding process completed)'
        });
        if (result.archived) ids.push(c.id);
      }

      await delCachePattern('app:prod:wedding:*');

      return successRes(res, {
        count: ids.length,
        ids,
        evaluated: pending.length,
        skipped: pending.length - ids.length
      }, `Successfully moved ${ids.length} customer(s) to Old Customers.`);
    } catch (err) {
      console.error('[WeddingController.autoArchiveOldCustomers Error]', err);
      return errorRes(res, 'Failed to execute auto-archival', [err.message], 500);
    }
  }

  /**
   * Export Old Customers to Excel (.xlsx)
   */
  async exportOldCustomers(req, res) {
    try {
      await ensureTables();
      const { search, location_id, telecaller_id, previous_status } = req.query;
      const { clause: locClause, params: queryParams } = resolveLocFilter(req, 'w');

      let whereClauses = [
        `w.is_deleted = 0`,
        `w.lifecycle_status = 'OLD_CUSTOMER'`,
        `1=1 ${locClause}`
      ];

      if (search && search.trim()) {
        const q = `%${search.trim().toLowerCase()}%`;
        whereClauses.push(`(
          LOWER(w.customer_name) LIKE ? OR
          w.mobile_number LIKE ? OR
          LOWER(w.customer_code) LIKE ? OR
          LOWER(COALESCE(w.email, '')) LIKE ?
        )`);
        queryParams.push(q, q, q, q);
      }

      if (previous_status && previous_status !== 'all') {
        whereClauses.push(`(w.previous_status = ? OR w.customer_status = ?)`);
        queryParams.push(previous_status, previous_status);
      }

      if (telecaller_id && telecaller_id !== 'all') {
        whereClauses.push(`(w.assigned_telecaller_id = ? OR w.assigned_telecaller = ?)`);
        queryParams.push(telecaller_id, telecaller_id);
      }

      const whereSql = whereClauses.join(' AND ');

      const [customers] = await pool.query(`
        SELECT 
          w.*,
          l.location_name,
          l.location_code
        FROM wedding_customers w
        LEFT JOIN locations l ON l.id = w.location_id
        WHERE ${whereSql}
        ORDER BY COALESCE(w.archived_at, w.updated_at) DESC
        LIMIT 5000
      `, queryParams);

      decryptRows(customers, ENCRYPTED_FIELDS);

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'BSC Textiles Wedding CRM';
      workbook.created = new Date();

      const sheet = workbook.addWorksheet('Old Customers', {
        views: [{ state: 'frozen', ySplit: 1 }]
      });

      sheet.columns = [
        { header: 'Customer ID', key: 'customer_code', width: 20 },
        { header: 'Customer Name', key: 'customer_name', width: 25 },
        { header: 'Mobile', key: 'mobile_number', width: 16 },
        { header: 'Email', key: 'email', width: 25 },
        { header: 'Store Location', key: 'location_name', width: 20 },
        { header: 'Wedding Date', key: 'wedding_date', width: 16 },
        { header: 'Shopping Date', key: 'expected_shopping_date', width: 16 },
        { header: 'Assigned Telecaller', key: 'assigned_telecaller', width: 22 },
        { header: 'Previous Status', key: 'previous_status', width: 20 },
        { header: 'Archived Date', key: 'archived_at', width: 20 },
        { header: 'Archived By', key: 'archived_by', width: 20 },
        { header: 'Archive Reason', key: 'archive_reason', width: 35 },
        { header: 'Bride Name', key: 'bride_name', width: 20 },
        { header: 'Groom Name', key: 'groom_name', width: 20 },
        { header: 'Registered On', key: 'created_at', width: 20 }
      ];

      // Style Header row: Rich Burgundy #4A173A background with white bold text
      sheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF4A173A' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
      sheet.getRow(1).height = 28;

      // Populate Data Rows
      (customers || []).forEach((c) => {
        sheet.addRow({
          customer_code: c.customer_code || `BSC-${c.id}`,
          customer_name: c.customer_name || 'N/A',
          mobile_number: c.mobile_number || 'N/A',
          email: c.email || '',
          location_name: c.location_name || 'N/A',
          wedding_date: c.wedding_date ? new Date(c.wedding_date).toISOString().split('T')[0] : 'N/A',
          expected_shopping_date: c.expected_shopping_date ? new Date(c.expected_shopping_date).toISOString().split('T')[0] : 'N/A',
          assigned_telecaller: c.assigned_telecaller || 'Unassigned',
          previous_status: c.previous_status || c.customer_status || 'New',
          archived_at: c.archived_at ? new Date(c.archived_at).toLocaleString('en-IN') : 'N/A',
          archived_by: c.archived_by || 'Staff',
          archive_reason: c.archive_reason || 'Manual archival',
          bride_name: c.bride_name || '',
          groom_name: c.groom_name || '',
          created_at: c.created_at ? new Date(c.created_at).toISOString().split('T')[0] : ''
        });
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="BSC_Old_Customers_${new Date().toISOString().split('T')[0]}.xlsx"`);

      await workbook.xlsx.write(res);
      res.end();
    } catch (err) {
      console.error('[WeddingController.exportOldCustomers Error]', err);
      return errorRes(res, 'Failed to export old customers', [err.message], 500);
    }
  }

  // ── Telecaller Controlled CRM Edit ──────────────────────────────────────
  async updateCustomerByTelecaller(req, res) {
    try {
      const customerId = parseInt(req.params.id, 10);
      if (!customerId) return errorRes(res, 'Customer ID is required', [], 400);

      await ensureTables();
      const userLoc = req.user ? req.user.locationId : null;
      let locClause = '';
      let locParams = [];
      if (userLoc) {
        locClause = 'AND w.location_id = ?';
        locParams = [userLoc];
      }

      const [customers] = await pool.query(`
        SELECT * FROM wedding_customers w WHERE w.id = ? AND w.is_deleted = 0 ${locClause}
      `, [customerId, ...locParams]);

      if (!customers || customers.length === 0) {
        return errorRes(res, 'Customer not found or access denied', [], 404);
      }

      const cust = customers[0];
      // Archived rows keep their terminal status; detail edits stay allowed.
      const statusPinned = cust.lifecycle_status === 'OLD_CUSTOMER';
      const telecallerName = req.user?.fullName || req.user?.username || 'Telecaller';
      const telecallerId = req.user?.id || null;

      const {
        alternate_mobile,
        preferred_call_time,
        wedding_date,
        expected_shopping_date,
        preferred_shopping_category,
        budget,
        estimated_family_size,
        bride_name,
        groom_name,
        wedding_city,
        customer_status,
        follow_up_date,
        customer_notes,
        remarks
      } = req.body;

      const updateFields = [];
      const updateParams = [];
      const changes = [];

      if (alternate_mobile !== undefined) {
        const clean = alternate_mobile ? alternate_mobile.replace(/\D/g, '').slice(-10) : null;
        updateFields.push('alternate_mobile = ?');
        updateParams.push(clean ? `+91${clean}` : null);
        changes.push('alternate_mobile');
      }

      if (preferred_call_time !== undefined) {
        updateFields.push('preferred_call_time = ?');
        updateParams.push(preferred_call_time || 'Any Time');
        changes.push('preferred_call_time');
      }

      if (wedding_date !== undefined) {
        updateFields.push('wedding_date = ?');
        updateParams.push(wedding_date ? String(wedding_date).slice(0, 10) : null);
        changes.push('wedding_date');
      }

      if (expected_shopping_date !== undefined) {
        updateFields.push('expected_shopping_date = ?');
        updateParams.push(expected_shopping_date ? String(expected_shopping_date).slice(0, 10) : null);
        changes.push('expected_shopping_date');
      }

      if (preferred_shopping_category !== undefined) {
        updateFields.push('preferred_shopping_category = ?');
        updateParams.push(preferred_shopping_category || 'General Wedding Shopping');
        changes.push('preferred_shopping_category');
      }

      if (budget !== undefined) {
        updateFields.push('budget = ?');
        updateParams.push(budget || null);
        updateFields.push('budget_range = ?');
        updateParams.push(budget || null);
        changes.push('budget');
      }

      if (estimated_family_size !== undefined) {
        updateFields.push('estimated_family_size = ?');
        updateParams.push(parseInt(estimated_family_size, 10) || 1);
        changes.push('estimated_family_size');
      }

      if (bride_name !== undefined) {
        updateFields.push('bride_name = ?');
        updateParams.push(bride_name ? String(bride_name).trim() : null);
        changes.push('bride_name');
      }

      if (groom_name !== undefined) {
        updateFields.push('groom_name = ?');
        updateParams.push(groom_name ? String(groom_name).trim() : null);
        changes.push('groom_name');
      }

      if (wedding_city !== undefined) {
        updateFields.push('wedding_city = ?');
        updateParams.push(wedding_city ? String(wedding_city).trim() : null);
        changes.push('wedding_city');
      }

      if (!statusPinned && customer_status !== undefined && customer_status !== cust.customer_status) {
        updateFields.push('customer_status = ?');
        updateParams.push(customer_status);
        changes.push(`status: ${cust.customer_status} -> ${customer_status}`);
      }

      if (follow_up_date !== undefined) {
        updateFields.push('follow_up_date = ?');
        updateParams.push(follow_up_date ? String(follow_up_date).slice(0, 10) : null);
        changes.push('follow_up_date');
      }

      if (customer_notes !== undefined || remarks !== undefined) {
        const newNotes = customer_notes || remarks;
        if (newNotes && newNotes.trim()) {
          updateFields.push('customer_notes = ?');
          updateParams.push(newNotes.trim());
          changes.push('notes');
        }
      }

      // Always stamp last updated by telecaller
      updateFields.push('last_updated_by = ?');
      updateParams.push(telecallerName);
      updateFields.push('last_updated_by_user_id = ?');
      updateParams.push(telecallerId);
      updateFields.push('updated_at = NOW()');

      // If customer has no telecaller, assign to editor
      if (!cust.assigned_telecaller || cust.assigned_telecaller === 'Auto-Assigned') {
        updateFields.push('assigned_telecaller = ?');
        updateParams.push(telecallerName);
        updateFields.push('assigned_telecaller_id = ?');
        updateParams.push(telecallerId);
      }

      updateParams.push(cust.id);

      await pool.query(`
        UPDATE wedding_customers SET ${updateFields.join(', ')} WHERE id = ?
      `, updateParams);

      // Audit log
      await pool.query(`
        INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details)
        VALUES (?, ?, ?, 'Telecaller Edit', ?)
      `, [
        cust.id,
        cust.location_id,
        telecallerName,
        `Telecaller updated fields: ${changes.join(', ')}`
      ]);

      let archivedNow = false;
      if (customer_status !== undefined && COMPLETION_STATUSES.has(String(customer_status).trim())) {
        const result = await archiveCustomerAsOld(cust.id, req.user, {
          completedStatus: String(customer_status).trim(),
          previousStatus: cust.customer_status,
          reason: 'Wedding process completed'
        });
        archivedNow = result.archived;
      }

      deskCache.clear();
      realtimeService.emitWeddingChange('UPDATE', { id: cust.id, customer_status: customer_status || cust.customer_status }, cust.location_id);

      return successRes(res, { id: cust.id, updatedFields: changes }, 'Customer details updated successfully.');
    } catch (err) {
      console.error('[WeddingController.updateCustomerByTelecaller Error]', err);
      return errorRes(res, 'Failed to update customer details', [err.message], 500);
    }
  }

  // ── Unified Customer Activity Timeline ───────────────────────────────────
  async getCustomerTimeline(req, res) {
    try {
      const customerId = parseInt(req.params.id, 10);
      if (!customerId) return errorRes(res, 'Customer ID is required', [], 400);

      await ensureTables();
      const { clause: locClause, params: locParams } = resolveLocFilter(req, 'w');

      const [customers] = await pool.query(`
        SELECT w.*, l.location_name, l.location_code
        FROM wedding_customers w
        LEFT JOIN locations l ON l.id = w.location_id
        WHERE w.id = ? AND w.is_deleted = 0 ${locClause}
      `, [customerId, ...locParams]);

      if (!customers || customers.length === 0) {
        return errorRes(res, 'Customer not found or access denied', [], 404);
      }
      const cust = customers[0];

      // Fetch Call Logs
      const [callLogs] = await pool.query(`
        SELECT id, call_date, call_time, telecaller_name, call_status, call_outcome,
               remarks, next_follow_up_date, next_follow_up_time, created_at
        FROM wedding_call_logs
        WHERE customer_id = ?
        ORDER BY created_at DESC
      `, [customerId]);

      // Fetch WhatsApp Logs
      const [whatsappLogs] = await pool.query(`
        SELECT id, template_type, template_name, telecaller_name, recipient_mobile,
               message_text, status, created_at
        FROM wedding_whatsapp_logs
        WHERE customer_id = ?
        ORDER BY created_at DESC
      `, [customerId]);

      // Fetch Visits & Appointments
      const [visits] = await pool.query(`
        SELECT id, visit_date, visit_time, visitors_count, purpose, visit_status,
               visit_result, visit_notes, created_by, created_at
        FROM wedding_visits
        WHERE customer_id = ?
        ORDER BY created_at DESC
      `, [customerId]);

      // Fetch Audit Logs
      const [auditLogs] = await pool.query(`
        SELECT id, user_name, action, details, created_at
        FROM wedding_audit_logs
        WHERE customer_id = ?
        ORDER BY created_at DESC
      `, [customerId]);

      // Decrypt any encrypted fields
      decryptRows(callLogs, ['remarks']);
      decryptRows(visits, ['visit_notes', 'customer_requirement']);

      // Build unified chronological timeline items
      const timeline = [];

      // 1. Creation event
      timeline.push({
        id: `reg-${cust.id}`,
        type: 'REGISTRATION',
        title: 'Customer Registered',
        actor: cust.created_by || 'Registration Desk',
        timestamp: cust.created_at,
        details: `Customer registered for ${cust.location_name || 'Store'}. Registration ID: ${cust.customer_code}. Wedding Date: ${cust.wedding_date ? new Date(cust.wedding_date).toISOString().split('T')[0] : 'TBD'}.`,
        badgeColor: 'blue'
      });

      // 2. Call log events
      (callLogs || []).forEach(c => {
        timeline.push({
          id: `call-${c.id}`,
          type: 'CALL',
          title: `Call: ${c.call_outcome}`,
          actor: c.telecaller_name || 'Telecaller',
          timestamp: c.created_at || c.call_date,
          details: c.remarks ? `"${c.remarks}"` : `Call completed with outcome ${c.call_outcome}.`,
          subdetails: c.next_follow_up_date ? `Next Follow-up scheduled for ${c.next_follow_up_date} (${c.next_follow_up_time || 'General'})` : null,
          badgeColor: /Interested|Confirmed/i.test(c.call_outcome) ? 'emerald' : (/No Answer|Busy|Switched/i.test(c.call_outcome) ? 'amber' : 'purple')
        });
      });

      // 3. WhatsApp events
      (whatsappLogs || []).forEach(w => {
        timeline.push({
          id: `wa-${w.id}`,
          type: 'WHATSAPP',
          title: `WhatsApp: ${w.template_name || w.template_type}`,
          actor: w.telecaller_name || 'Telecaller',
          timestamp: w.created_at,
          details: w.message_text,
          badgeColor: 'emerald'
        });
      });

      // 4. Visit events
      (visits || []).forEach(v => {
        timeline.push({
          id: `visit-${v.id}`,
          type: 'VISIT',
          title: `Store Visit: ${v.visit_status}`,
          actor: v.created_by || 'Store Staff',
          timestamp: v.created_at || v.visit_date,
          details: `${v.purpose || 'Store Visit'} (${v.visitors_count || 1} visitors). ${v.visit_notes || ''}`,
          badgeColor: 'rose'
        });
      });

      // 5. Audit logs
      (auditLogs || []).forEach(a => {
        if (a.action !== 'Call Logged' && a.action !== 'WhatsApp Message Sent') {
          timeline.push({
            id: `audit-${a.id}`,
            type: 'AUDIT',
            title: a.action,
            actor: a.user_name || 'System',
            timestamp: a.created_at,
            details: a.details,
            badgeColor: 'slate'
          });
        }
      });

      // Sort timeline newest first
      timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return successRes(res, { customer: cust, timeline }, 'Customer timeline loaded successfully.');
    } catch (err) {
      console.error('[WeddingController.getCustomerTimeline Error]', err);
      return errorRes(res, 'Failed to fetch customer timeline', [err.message], 500);
    }
  }

  // ── WhatsApp Location-Specific Templates ─────────────────────────────────
  async getWhatsAppTemplates(req, res) {
    try {
      const customerId = parseInt(req.params.id, 10);
      if (!customerId) return errorRes(res, 'Customer ID is required', [], 400);

      const [customers] = await pool.query(`
        SELECT w.*, l.location_name, l.location_code
        FROM wedding_customers w
        LEFT JOIN locations l ON l.id = w.location_id
        WHERE w.id = ? AND w.is_deleted = 0
      `, [customerId]);

      if (!customers || customers.length === 0) {
        return errorRes(res, 'Customer not found', [], 404);
      }

      const cust = customers[0];
      const weddingWhatsAppService = require('../services/weddingWhatsAppService');
      const data = weddingWhatsAppService.generateTemplatesForCustomer(cust);

      return successRes(res, data, 'WhatsApp templates loaded successfully.');
    } catch (err) {
      console.error('[WeddingController.getWhatsAppTemplates Error]', err);
      return errorRes(res, 'Failed to load WhatsApp templates', [err.message], 500);
    }
  }

  async sendWhatsAppMessage(req, res) {
    try {
      const customerId = parseInt(req.params.id, 10);
      const { template_type, template_name, message_text, recipient_mobile } = req.body;

      if (!customerId) return errorRes(res, 'Customer ID is required', [], 400);
      if (!message_text || !String(message_text).trim()) {
        return errorRes(res, 'Message text cannot be empty', [], 400);
      }

      const [customers] = await pool.query(`
        SELECT w.*, l.location_name, l.location_code
        FROM wedding_customers w
        LEFT JOIN locations l ON l.id = w.location_id
        WHERE w.id = ? AND w.is_deleted = 0
      `, [customerId]);

      if (!customers || customers.length === 0) {
        return errorRes(res, 'Customer not found', [], 404);
      }
      const cust = customers[0];

      const telecallerName = req.user?.fullName || req.user?.username || 'Telecaller';
      const telecallerId = req.user?.id || null;

      const weddingWhatsAppService = require('../services/weddingWhatsAppService');
      const result = await weddingWhatsAppService.logMessage({
        customerId: cust.id,
        customerCode: cust.customer_code,
        locationId: cust.location_id,
        telecallerId,
        telecallerName,
        recipientMobile: recipient_mobile || cust.mobile_number,
        templateType: template_type || 'CUSTOM',
        templateName: template_name || 'Custom Message',
        messageText: message_text.trim()
      });

      realtimeService.emitWeddingChange('WHATSAPP_SENT', { id: cust.id, telecaller_name: telecallerName }, cust.location_id);

      return successRes(res, result, 'WhatsApp message logged successfully.');
    } catch (err) {
      console.error('[WeddingController.sendWhatsAppMessage Error]', err);
      return errorRes(res, 'Failed to log WhatsApp message', [err.message], 500);
    }
  }

  async getWhatsAppLogs(req, res) {
    try {
      const customerId = parseInt(req.params.id, 10);
      if (!customerId) return errorRes(res, 'Customer ID is required', [], 400);

      const weddingWhatsAppService = require('../services/weddingWhatsAppService');
      const logs = await weddingWhatsAppService.getCustomerWhatsAppLogs(customerId);

      return successRes(res, { logs }, 'WhatsApp logs loaded successfully.');
    } catch (err) {
      console.error('[WeddingController.getWhatsAppLogs Error]', err);
      return errorRes(res, 'Failed to fetch WhatsApp logs', [err.message], 500);
    }
  }

  // ── Telecaller Performance Metrics ───────────────────────────────────────
  async getTelecallerPerformance(req, res) {
    try {
      await ensureTables();
      const userLoc = req.user ? req.user.locationId : null;
      let locClause = '';
      let locParams = [];
      if (userLoc) {
        locClause = 'AND u.location_id = ?';
        locParams = [userLoc];
      }

      const [telecallerRows] = await pool.query(`
        SELECT 
          u.id, 
          u.full_name, 
          u.username, 
          u.employee_id, 
          u.role,
          u.location_id,
          l.location_name,
          l.location_code,
          (
            SELECT COUNT(*) 
            FROM wedding_customers wc 
            WHERE wc.assigned_telecaller_id = u.id 
              AND wc.is_deleted = 0 
              AND (wc.lifecycle_status = 'ACTIVE' OR wc.lifecycle_status IS NULL)
          ) AS total_assigned,
          (
            SELECT COUNT(*) 
            FROM wedding_call_logs cl 
            WHERE cl.telecaller_id = u.id 
              AND cl.call_date = CURDATE()
          ) AS calls_today,
          (
            SELECT COUNT(*) 
            FROM wedding_customers wc 
            WHERE wc.assigned_telecaller_id = u.id 
              AND wc.last_call_date >= CURDATE()
              AND wc.is_deleted = 0
          ) AS customers_called_today,
          (
            SELECT COUNT(*) 
            FROM wedding_customers wc 
            WHERE wc.assigned_telecaller_id = u.id 
              AND wc.follow_up_date < CURDATE()
              AND wc.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed')
              AND wc.is_deleted = 0
          ) AS overdue_calls,
          (
            SELECT COUNT(*) 
            FROM wedding_call_logs cl 
            WHERE cl.telecaller_id = u.id 
              AND (cl.call_outcome LIKE '%Interested%' OR cl.call_outcome LIKE '%Connected%')
          ) AS total_connected,
          (
            SELECT COUNT(*) 
            FROM wedding_call_logs cl 
            WHERE cl.telecaller_id = u.id 
              AND cl.call_outcome = 'No Answer'
          ) AS total_no_answer,
          (
            SELECT COUNT(*) 
            FROM wedding_customers wc 
            WHERE wc.assigned_telecaller_id = u.id 
              AND wc.customer_status = 'Shopping Date Confirmed'
              AND wc.is_deleted = 0
          ) AS shopping_confirmed,
          (
            SELECT COUNT(*) 
            FROM wedding_customers wc 
            WHERE wc.assigned_telecaller_id = u.id 
              AND wc.customer_status IN ('Visited Store', 'Converted')
              AND wc.is_deleted = 0
          ) AS completed_customers
        FROM users u
        LEFT JOIN locations l ON l.id = u.location_id
        WHERE u.active = TRUE
          AND u.role IN ('Telecaller', 'CRM Executive', 'VM Extension Telecaller', 'VM Telecaller', 'Team Lead')
          ${locClause}
        ORDER BY calls_today DESC, total_assigned DESC
      `, locParams);

      return successRes(res, { telecallers: telecallerRows || [] }, 'Telecaller performance retrieved successfully.');
    } catch (err) {
      console.error('[WeddingController.getTelecallerPerformance Error]', err);
      return errorRes(res, 'Failed to fetch telecaller performance', [err.message], 500);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // PIPELINE BOARD (redesigned status pipeline workspace)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Active pipeline customers with their history counts in a single query.
   *
   * The board cards need calls, follow-ups, feedback, visits and notes per
   * customer. Doing that from the client would be one request per card, so the
   * aggregates are resolved here. Location scoping uses the same
   * resolveLocFilter every other wedding read uses — it is enforced server-side,
   * not by hiding rows in the UI.
   */
  async getPipelineBoard(req, res) {
    try {
      await ensureTables();

      const {
        search,
        telecaller_id: telecallerId,
        priority,
        call_status: callStatus,
        stage,
        overdue,
        due_today: dueToday,
        follow_up_from: followUpFrom,
        follow_up_to: followUpTo,
        limit = 500
      } = req.query;

      const { clause: locClause, params: rawLocParams } = resolveLocFilter(req, 'w');
      const params = Array.isArray(rawLocParams) ? [...rawLocParams] : [];
      const whereClauses = [
        `w.is_deleted = 0`,
        `(w.lifecycle_status = 'ACTIVE' OR w.lifecycle_status IS NULL)`,
        `1=1 ${locClause}`
      ];

      // Telecallers are limited to their own book, same as the calling desk.
      const userRoleNorm = String(req.user?.role || '').trim().toLowerCase().replace(/[_\s-]+/g, ' ');
      if (['telecaller', 'caller', 'tele caller', 'vm extension telecaller', 'vm telecaller'].includes(userRoleNorm)) {
        whereClauses.push(`(w.assigned_telecaller_id = ? OR LOWER(TRIM(COALESCE(w.assigned_telecaller, ''))) = LOWER(?))`);
        params.push(req.user?.id || null, String(req.user?.fullName || req.user?.username || ''));
      } else if (telecallerId && telecallerId !== 'all') {
        const asNum = parseInt(telecallerId, 10);
        if (!isNaN(asNum)) {
          whereClauses.push(`(w.assigned_telecaller_id = ? OR w.assigned_telecaller = ?)`);
          params.push(asNum, String(telecallerId));
        } else {
          whereClauses.push(`w.assigned_telecaller = ?`);
          params.push(String(telecallerId));
        }
      }

      if (priority && priority !== 'all') {
        whereClauses.push(`w.priority = ?`);
        params.push(String(priority));
      }
      if (callStatus && callStatus !== 'all') {
        whereClauses.push(`w.call_status = ?`);
        params.push(String(callStatus));
      }
      if (stage && stage !== 'all') {
        const keys = String(stage).split(',').map((s) => s.trim()).filter(Boolean);
        const mapped = keys.reduce((acc, k) => {
          const found = PIPELINE_STAGES.find((s) => s.key === k);
          // 'other' is defined by exclusion, so it cannot be filtered by status list.
          if (found && found.key === 'other') {
            const known = Object.keys(STAGE_BY_STATUS);
            if (known.length > 0) {
              acc.push(`(w.customer_status IS NULL OR LOWER(w.customer_status) NOT IN (${known.map(() => '?').join(',')}))`);
              params.push(...known);
            }
          } else if (found && found.statuses && found.statuses.length > 0) {
            acc.push(`w.customer_status IN (${found.statuses.map(() => '?').join(',')})`);
            params.push(...found.statuses);
          }
          return acc;
        }, []);
        if (mapped.length) whereClauses.push(`(${mapped.join(' OR ')})`);
        else whereClauses.push(`1 = 0`);
      }
      if (overdue === '1') {
        whereClauses.push(`w.follow_up_date IS NOT NULL AND w.follow_up_date < CURDATE()`);
      }
      if (dueToday === '1') {
        whereClauses.push(`w.follow_up_date = CURDATE()`);
      }
      if (followUpFrom && followUpTo) {
        whereClauses.push(`w.follow_up_date BETWEEN ? AND ?`);
        params.push(String(followUpFrom), String(followUpTo));
      }
      if (search && String(search).trim()) {
        const q = `%${String(search).trim().toLowerCase()}%`;
        whereClauses.push(`(
          LOWER(COALESCE(w.customer_name, '')) LIKE ? OR
          LOWER(COALESCE(w.customer_code, '')) LIKE ? OR
          COALESCE(w.mobile_number, '') LIKE ? OR
          LOWER(COALESCE(w.email, '')) LIKE ? OR
          LOWER(COALESCE(w.assigned_telecaller, '')) LIKE ? OR
          LOWER(COALESCE(l.location_name, '')) LIKE ? OR
          LOWER(COALESCE(l.location_code, '')) LIKE ?
        )`);
        params.push(q, q, q, q, q, q, q);
      }

      const limitNum = Math.min(2000, Math.max(1, parseInt(limit, 10) || 500));
      const whereSql = whereClauses.join(' AND ');

      // Sanitize params array to ensure no undefined values reach mysql2
      const safeParams = params.map((p) => (p === undefined ? null : p));

      const cols = await getWeddingCustomerColumns();
      const lastContactedSelect = cols.has('last_contacted_by')
        ? `COALESCE(w.last_contacted_by, (SELECT cl.telecaller_name FROM wedding_call_logs cl WHERE cl.customer_id = w.id ORDER BY cl.id DESC LIMIT 1)) AS last_contacted_by`
        : `(SELECT cl.telecaller_name FROM wedding_call_logs cl WHERE cl.customer_id = w.id ORDER BY cl.id DESC LIMIT 1) AS last_contacted_by`;
      const lastUpdatedSelect = cols.has('last_updated_by')
        ? `w.last_updated_by`
        : `NULL AS last_updated_by`;

      const [rows] = await pool.query(`
        SELECT
          w.id,
          w.customer_code,
          w.customer_name,
          w.mobile_number,
          w.alternate_mobile,
          w.email,
          w.location_id,
          w.customer_status,
          w.call_status,
          w.priority,
          w.wedding_date,
          w.expected_shopping_date,
          w.preferred_shopping_category,
          w.estimated_family_size,
          w.assigned_telecaller,
          w.assigned_telecaller_id,
          w.follow_up_date,
          w.preferred_call_time,
          w.preferred_followup_time,
          w.preferred_contact_method,
          w.total_calls_count,
          w.last_call_date,
          w.last_call_outcome,
          ${lastContactedSelect},
          ${lastUpdatedSelect},
          w.bride_name,
          w.groom_name,
          w.wedding_venue,
          w.wedding_city,
          w.wedding_type,
          w.budget,
          w.budget_range,
          w.lead_source,
          w.created_at,
          w.updated_at,
          l.location_name,
          l.location_code,
          DATEDIFF(CURDATE(), w.follow_up_date) AS overdue_days,
          (SELECT COUNT(*) FROM wedding_call_logs cl WHERE cl.customer_id = w.id) AS calls_logged,
          (SELECT COUNT(*) FROM wedding_communication cm WHERE cm.customer_id = w.id AND cm.communication_type = 'Follow-Up') AS followups_logged,
          (SELECT COUNT(*) FROM wedding_communication cm WHERE cm.customer_id = w.id AND cm.communication_type = 'Feedback') AS feedback_count,
          (SELECT cm.communication_details FROM wedding_communication cm
            WHERE cm.customer_id = w.id AND cm.communication_type = 'Feedback'
            ORDER BY cm.id DESC LIMIT 1) AS latest_feedback,
          (SELECT COUNT(*) FROM wedding_visits v WHERE v.customer_id = w.id) AS visits_count,
          (SELECT COUNT(*) FROM wedding_notes n WHERE n.customer_id = w.id) AS notes_count
        FROM wedding_customers w
        LEFT JOIN locations l ON l.id = w.location_id
        WHERE ${whereSql}
        ORDER BY
          CASE WHEN w.follow_up_date IS NULL THEN 1 ELSE 0 END ASC,
          w.follow_up_date ASC,
          w.updated_at DESC
        LIMIT ${limitNum}
      `, safeParams);

      // Only `latest_feedback` is encrypted-and-aliased here; the note bodies the
      // board never renders stay out of the query entirely.
      const customers = (rows || []).map((row) => ({
        ...row,
        latest_feedback: row.latest_feedback ? decryptField(row.latest_feedback) : (row.latest_feedback || ''),
        stage_key: resolveStageKey(row.customer_status)
      }));

      // Counts per stage come from the same scoped row set, so the summary can
      // never disagree with the cards shown.
      const stageCounts = customers.reduce((acc, c) => {
        const k = c.stage_key || 'other';
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});

      return successRes(res, {
        customers,
        total: customers.length,
        stages: PIPELINE_STAGES.map(({ key, label, order }) => ({
          key,
          label,
          order,
          count: stageCounts[key] || 0
        })),
        today: getISTDateString()
      }, 'Pipeline board data retrieved successfully.');
    } catch (err) {
      console.error('[Wedding CRM Pipeline Error]', {
        endpoint: req.originalUrl || req.url,
        method: req.method,
        userId: req.user?.id,
        username: req.user?.username,
        locationId: req.user?.locationId,
        service: 'WeddingController.getPipelineBoard',
        error: err?.message,
        code: err?.code,
        sqlState: err?.sqlState,
        timestamp: new Date().toISOString()
      });
      return errorRes(
        res,
        'Failed to load pipeline board: Unable to retrieve pipeline records. Please try again.',
        process.env.NODE_ENV === 'development' ? [err.message] : [],
        500
      );
    }
  }
}

WeddingController.prototype.ensureWeddingTables = ensureTables;
WeddingController.prototype.ensureTables = ensureTables;
const weddingControllerInstance = new WeddingController();
weddingControllerInstance.ensureWeddingTables = ensureTables;
weddingControllerInstance.ensureTables = ensureTables;
module.exports = weddingControllerInstance;
