const multer = require('multer');

// In-memory cache for calling desk to reduce DB hits (30 seconds TTL)
const deskCache = new Map();
const DESK_CACHE_TTL_MS = 30000;
const pool = require('../config/db');
const { successRes, errorRes } = require('../utils/response');
const { getLocationFilter, injectLocationId } = require('../middleware/auth');
const { encryptField, decryptRows, decryptRow } = require('../utils/crypto');
const { parseCsv, rowsToObjects } = require('../utils/csv');

// Free-text PII fields stored encrypted at rest (AES-256-GCM, see utils/crypto.js)
const ENCRYPTED_FIELDS = ['customer_notes', 'visit_notes', 'appointment_notes', 'purchase_notes', 'note_content', 'communication_details'];
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

  const isGlobal = !req.user.locationId || req.user.isGlobalAdmin || ['Admin', 'Super Admin'].includes(req.user.role);

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

  if (requestedLocationId) {
    if (allowed.includes(requestedLocationId)) {
      return {
        clause: `AND ${col} = ?`,
        params: [requestedLocationId]
      };
    }
    // Unauthorized location requested by branch user
    return { clause: `AND 1 = 0`, params: [] };
  }

  if (allowed.length > 1) {
    const placeholders = allowed.map(() => '?').join(', ');
    return {
      clause: `AND ${col} IN (${placeholders})`,
      params: allowed
    };
  } else if (allowed.length === 1) {
    return {
      clause: `AND ${col} = ?`,
      params: [allowed[0]]
    };
  }

  return { clause: `AND 1 = 0`, params: [] };
}

let tablesChecked = false;
async function ensureTables() {
  if (tablesChecked) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`wedding_customers\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`customer_code\` VARCHAR(50) NOT NULL UNIQUE,
        \`location_id\` INT NOT NULL DEFAULT 2,
        \`customer_name\` VARCHAR(150) NOT NULL,
        \`mobile_number\` VARCHAR(20) NOT NULL,
        \`email\` VARCHAR(150) NULL,
        \`wedding_date\` DATE NULL,
        \`expected_shopping_date\` DATE NOT NULL,
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
      "ALTER TABLE wedding_customers ADD COLUMN lead_source VARCHAR(100) DEFAULT 'Wedding Registration'"
    ];
    for (const sql of weddingCols) {
      try { await pool.query(sql); } catch(e) { /* column already exists */ }
    }

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

    tablesChecked = true;
  } catch (err) {
    console.error('[WeddingController.ensureTables Error]', err.message);
  }
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

      const [rows] = await pool.query(`
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
        WHERE w.is_deleted = 0 ${clause}
      `, params);

      // Appointments counts
      let apptParams = [];
      let apptWhere = '';
      if (req.user && req.user.locationId) {
        apptWhere += ' AND a.location_id = ?';
        apptParams.push(req.user.locationId);
      }
      const [apptRows] = await pool.query(`
        SELECT
          SUM(CASE WHEN a.appointment_date = CURDATE() THEN 1 ELSE 0 END) AS todayAppointments,
          SUM(CASE WHEN a.appointment_date > CURDATE() THEN 1 ELSE 0 END) AS upcomingAppointments,
          SUM(CASE WHEN a.appointment_status = 'Completed' THEN 1 ELSE 0 END) AS completedAppointments,
          SUM(CASE WHEN a.appointment_status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelledAppointments
        FROM wedding_appointments a
        WHERE 1=1 ${apptWhere}
      `, apptParams);

      const rawAppts = apptRows[0] || {};
      const raw = rows[0] || {};

      // Calls logged today count
      let callLogWhere = 'WHERE cl.call_date = CURDATE()';
      let callLogParams = [];
      if (req.user && req.user.locationId) {
        callLogWhere += ' AND cl.location_id = ?';
        callLogParams.push(req.user.locationId);
      }
      if (req.user && req.user.role === 'Telecaller') {
        callLogWhere += ' AND (cl.telecaller_id = ? OR cl.telecaller_name = ?)';
        callLogParams.push(req.user.id, req.user.fullName || req.user.username || '');
      }
      const [callTodayRows] = await pool.query(`
        SELECT COUNT(*) as callsToday FROM wedding_call_logs cl ${callLogWhere}
      `, callLogParams);

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
        due_today: Number(raw.todayFollowUps) || 0,
        overdue: Number(raw.overdueFollowUps) || 0,
        calls_pending: Number(raw.callsPending) || 0,
        calls_completed: Number(raw.callsCompleted) || 0,
        shopping_confirmed: Number(raw.shoppingConfirmed) || 0,
        visited_converted: Number(raw.visitedConverted) || 0,
        not_interested: Number(raw.notInterested) || 0
      };

      // Location breakdown if Global Admin
      let locationStats = [];
      if (!req.user || !req.user.locationId) {
        const [locRows] = await pool.query(`
          SELECT 
            l.id AS location_id,
            l.location_code,
            l.location_name,
            COUNT(w.id) AS total_customers,
            SUM(CASE WHEN w.follow_up_date = CURDATE() THEN 1 ELSE 0 END) AS today_follow_ups,
            SUM(CASE WHEN w.follow_up_date < CURDATE() AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed') THEN 1 ELSE 0 END) AS overdue_follow_ups
          FROM locations l
          LEFT JOIN wedding_customers w ON w.location_id = l.id AND w.is_deleted = 0
          GROUP BY l.id, l.location_code, l.location_name
          ORDER BY l.sort_order ASC
        `);
        locationStats = locRows || [];
      }

      return successRes(res, {
        stats,
        locationStats
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
        page = 1,
        limit = 50
      } = req.query;

      const { clause: locClause, params: queryParams } = resolveLocFilter(req, 'w');
      let whereClauses = [`w.is_deleted = 0`, `1=1 ${locClause}`];

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

      // Total count
      const [countResult] = await pool.query(
        `SELECT COUNT(*) as total FROM wedding_customers w WHERE ${whereSql}`,
        queryParams
      );
      const total = countResult[0]?.total || 0;

      // Pagination (guard against non-numeric input — LIMIT ? must bind an integer)
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 50));
      const offset = (pageNum - 1) * limitNum;

      const [customers] = await pool.query(`
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
      `, [...queryParams, limitNum, offset]);

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
        return errorRes(res, 'Mobile number is required', [], 400);
      }

      const cleanMobile = mobile.trim();
      const { clause: locClause, params } = resolveLocFilter(req, 'w');

      let sql = `
        SELECT w.id, w.customer_code, w.customer_name, w.mobile_number, w.customer_status, w.assigned_telecaller, l.location_name
        FROM wedding_customers w
        LEFT JOIN locations l ON l.id = w.location_id
        WHERE w.mobile_number = ? AND w.is_deleted = 0 ${locClause}
      `;
      const queryParams = [cleanMobile, ...params];

      if (customerId) {
        sql += ` AND w.id != ?`;
        queryParams.push(parseInt(customerId, 10));
      }

      const [rows] = await pool.query(sql, queryParams);

      if (rows && rows.length > 0) {
        return successRes(res, {
          exists: true,
          customer: rows[0],
          existingCustomer: rows[0]
        }, 'Duplicate customer found with this mobile number');
      }

      return successRes(res, { exists: false }, 'Mobile number is unique');
    } catch (err) {
      console.error('[WeddingController.checkDuplicate Error]', err);
      return errorRes(res, 'Failed to check duplicate', [err.message], 500);
    }
  }

  // ── 4. Create Wedding Customer ──────────────────────────────────────
  async createCustomer(req, res) {
    try {
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
      const weddingDate = req.body.wedding_date || req.body.weddingDate || null;
      const expectedShoppingDate = req.body.expected_shopping_date || req.body.expectedShoppingDate;
      const preferredCategory = req.body.preferred_shopping_category || req.body.preferredShoppingCategory || (Array.isArray(req.body.shopping_categories) ? req.body.shopping_categories.join(', ') : req.body.shopping_categories) || 'General Wedding Shopping';
      const estimatedFamilySize = parseInt(req.body.estimated_family_size || req.body.estimatedFamilySize || 1, 10);
      let assignedTelecaller = (req.body.assigned_telecaller || req.body.assignedTelecaller || '').trim() || null;
      let assignedTelecallerId = req.body.assigned_telecaller_id ? parseInt(req.body.assigned_telecaller_id, 10) : null;
      // follow_up_date: if not provided, default to 3 days from today
      const defaultFollowUp = new Date();
      defaultFollowUp.setDate(defaultFollowUp.getDate() + 3);
      const defaultFollowUpStr = defaultFollowUp.toISOString().slice(0, 10);
      const followUpDate = req.body.follow_up_date || req.body.followUpDate || defaultFollowUpStr;
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
      if (!expectedShoppingDate) {
        return errorRes(res, 'Expected shopping date is required', [], 400);
      }

      // Enforce location security: branch user strictly locked to their location
      let locationId = req.user ? req.user.locationId : null;
      if (!locationId) {
        // Global admin can specify location or defaults to 2 (Davanagere)
        locationId = requestedLocationId ? parseInt(requestedLocationId, 10) : 2;
      }

      // Fetch location code for code generation
      const [locRows] = await pool.query(`SELECT location_code FROM locations WHERE id = ?`, [locationId]);
      const locCode = locRows[0]?.location_code || 'BSC';

      // Duplicate mobile check per location
      const [dup] = await pool.query(`
        SELECT id, customer_code, customer_name FROM wedding_customers 
        WHERE mobile_number = ? AND location_id = ? AND is_deleted = 0
      `, [mobileNumber, locationId]);

      if (dup && dup.length > 0) {
        return errorRes(res, `Customer with mobile ${mobileNumber} already exists (${dup[0].customer_name} - ${dup[0].customer_code})`, [], 409);
      }

      // If assigned_telecaller_id provided without name, find name
      if (assignedTelecallerId && !assignedTelecaller) {
        const [u] = await pool.query(`SELECT full_name FROM users WHERE id = ?`, [assignedTelecallerId]);
        if (u && u.length > 0) assignedTelecaller = u[0].full_name;
      }
      if (!assignedTelecaller) {
        assignedTelecaller = req.user?.fullName || 'Staff';
        assignedTelecallerId = req.user?.id || null;
      }

      // Generate sequence code: WED-[LOC]-[YEAR]-[SEQ]
      // Collision-proof: derive the next sequence from the highest existing
      // suffix (COUNT(*)+1 collides once any customer is deleted, since the
      // column is UNIQUE). A short retry loop absorbs concurrent inserts.
      const year = new Date().getFullYear();
      const codePrefix = `WED-${locCode}-${year}-`;
      let customerCode = null;
      for (let attempt = 0; attempt < 5 && !customerCode; attempt++) {
        const [lastRows] = await pool.query(
          `SELECT customer_code FROM wedding_customers WHERE customer_code LIKE ? ORDER BY id DESC LIMIT 1`,
          [`${codePrefix}%`]
        );
        const lastSeq = lastRows && lastRows[0]
          ? parseInt(String(lastRows[0].customer_code).slice(-4), 10) || 0
          : 0;
        const candidate = `${codePrefix}${String(lastSeq + 1).padStart(4, '0')}`;
        const [exists] = await pool.query(
          `SELECT id FROM wedding_customers WHERE customer_code = ?`,
          [candidate]
        );
        if (!exists || exists.length === 0) {
          customerCode = candidate;
        }
      }
      if (!customerCode) {
        return errorRes(res, 'Could not allocate a unique customer code, please retry', [], 500);
      }

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
          created_by,
          created_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', 'Pending', ?, ?)
      `, [
        customerCode,
        locationId,
        customerName,
        mobileNumber,
        alternateMobile,
        email,
        weddingDate,
        expectedShoppingDate,
        preferredCategory,
        estimatedFamilySize,
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

      const newId = insertResult.insertId;

      // Audit Log
      await pool.query(`
        INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details)
        VALUES (?, ?, ?, 'Customer Added', ?)
      `, [
        newId,
        locationId,
        req.user?.fullName || 'Staff',
        `Created wedding customer ${customerName} (${customerCode}). Expected shopping: ${expectedShoppingDate}, Follow-up: ${followUpDate}`
      ]);

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
      }, 'Wedding customer added successfully', 201);
    } catch (err) {
      console.error('[WeddingController.createCustomer Error]', err);
      return errorRes(res, 'Failed to add wedding customer', [err.message], 500);
    }
  }

  // ── 5. Get Customer Profile & Full History ──────────────────────────
  async getCustomerById(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const { clause: locClause, params } = resolveLocFilter(req, 'w');

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
        return errorRes(res, 'Customer not found or access denied', [], 404);
      }

      const customer = rows[0];

      // IDOR protection: Telecallers may only inspect their assigned customers
      if (req.user && req.user.role === 'Telecaller') {
        const isAssigned = (customer.assigned_telecaller_id === req.user.id) ||
                           (customer.assigned_telecaller && customer.assigned_telecaller.toLowerCase() === (req.user.fullName || req.user.username || '').toLowerCase());
        if (!isAssigned) {
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

      return successRes(res, {
        customer,
        callLogs: callLogs || [],
        timeline: callLogs || [],
        auditLogs: auditLogs || []
      }, 'Customer details fetched successfully');
    } catch (err) {
      console.error('[WeddingController.getCustomerById Error]', err);
      return errorRes(res, 'Failed to fetch customer details', [err.message], 500);
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
      const weddingDate = req.body.wedding_date || req.body.weddingDate;
      const expectedShoppingDate = req.body.expected_shopping_date || req.body.expectedShoppingDate;
      const preferredCategory = req.body.preferred_shopping_category || req.body.preferredShoppingCategory || req.body.shopping_categories;
      const estimatedFamilySize = req.body.estimated_family_size || req.body.estimatedFamilySize;
      const assignedTelecaller = req.body.assigned_telecaller || req.body.assignedTelecaller;
      const assignedTelecallerId = req.body.assigned_telecaller_id || req.body.assignedTelecallerId;
      const followUpDate = req.body.follow_up_date || req.body.followUpDate;
      const preferredCallTime = req.body.preferred_call_time || req.body.preferredCallTime;
      const customerNotes = req.body.customer_notes || req.body.customerNotes || req.body.initial_notes;
      const customerStatus = req.body.customer_status || req.body.customerStatus || req.body.current_status;
      const callStatus = req.body.call_status || req.body.callStatus;

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
          call_status = ?
        WHERE id = ?
      `, [
        customerName ? customerName.trim() : prev.customer_name,
        mobileNumber ? mobileNumber.trim() : prev.mobile_number,
        email !== undefined ? (email ? email.trim() : null) : prev.email,
        weddingDate !== undefined ? weddingDate : prev.wedding_date,
        expectedShoppingDate || prev.expected_shopping_date,
        preferredCategory || prev.preferred_shopping_category,
        estimatedFamilySize ? parseInt(estimatedFamilySize, 10) : prev.estimated_family_size,
        assignedTelecaller || prev.assigned_telecaller,
        assignedTelecallerId ? parseInt(assignedTelecallerId, 10) : prev.assigned_telecaller_id,
        followUpDate || prev.follow_up_date,
        preferredCallTime || prev.preferred_call_time,
        customerNotes !== undefined ? encryptField(customerNotes) : prev.customer_notes,
        customerStatus || prev.customer_status,
        callStatus || prev.call_status,
        id
      ]);

      // Audit log
      const changes = [];
      if (customerStatus && customerStatus !== prev.customer_status) changes.push(`Status: ${prev.customer_status} → ${customerStatus}`);
      if (followUpDate && followUpDate !== prev.follow_up_date) changes.push(`Follow-up: ${prev.follow_up_date} → ${followUpDate}`);
      if (assignedTelecaller && assignedTelecaller !== prev.assigned_telecaller) changes.push(`Telecaller: ${prev.assigned_telecaller} → ${assignedTelecaller}`);
      if (expectedShoppingDate && expectedShoppingDate !== prev.expected_shopping_date) changes.push(`Shopping Date: ${prev.expected_shopping_date} → ${expectedShoppingDate}`);

      await pool.query(`
        INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details)
        VALUES (?, ?, ?, 'Customer Edited', ?)
      `, [
        id,
        prev.location_id,
        req.user?.fullName || 'Staff',
        changes.length > 0 ? changes.join(', ') : 'Updated customer profile details'
      ]);

      return successRes(res, { id }, 'Customer updated successfully');
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
        return errorRes(res, 'Customer not found or unauthorized', [], 404);
      }

      const prev = existing[0];

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

      return successRes(res, { id }, 'Customer archived successfully');
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
      let newCustomerStatus = cust.customer_status;
      let newCallStatus = callStatus;

      switch (callOutcome) {
        case 'Shopping Confirmed':
          newCustomerStatus = 'Shopping Date Confirmed';
          newCallStatus = 'Completed';
          break;
        case 'Interested':
          newCustomerStatus = 'Interested';
          newCallStatus = 'Completed';
          break;
        case 'Not Interested':
          newCustomerStatus = 'Not Interested';
          newCallStatus = 'Completed';
          break;
        case 'Connected':
          if (newCustomerStatus === 'New' || newCustomerStatus === 'Follow-up Pending') {
            newCustomerStatus = 'Contacted';
          }
          newCallStatus = 'Connected';
          break;
        case 'Call Back Requested':
          newCustomerStatus = 'Follow-up Pending';
          newCallStatus = 'Call Back Requested';
          break;
        case 'No Answer':
          newCallStatus = 'No Answer';
          break;
        case 'Busy':
          newCallStatus = 'Busy';
          break;
        case 'Switched Off':
          newCallStatus = 'Switched Off';
          break;
        case 'Wrong Number':
          newCallStatus = 'Wrong Number';
          newCustomerStatus = 'Cancelled';
          break;
        case 'Follow-Up Required':
          newCustomerStatus = 'Follow-up Pending';
          newCallStatus = 'Completed';
          break;
        case 'Appointment Requested':
          newCustomerStatus = 'Appointment';
          newCallStatus = 'Completed';
          break;
        case 'Converted':
          newCustomerStatus = 'Converted';
          newCallStatus = 'Completed';
          break;
        default:
          newCallStatus = 'Completed';
          break;
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
        `customer_status = ?`
      ];
      const updateParams = [callOutcome, newCallStatus, newCustomerStatus];

      // Schedule next follow-up if provided (unless Not Interested)
      if (callOutcome !== 'Not Interested') {
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
        `Logged call outcome: ${callOutcome}. Status: ${newCustomerStatus}. ${nextFollowUpDate ? `Next call: ${nextFollowUpDate}` : ''}`
      ]);

      return successRes(res, {
        customerId: cust.id,
        outcome: callOutcome,
        customerStatus: newCustomerStatus,
        nextFollowUpDate
      }, 'Call logged and follow-up updated successfully');
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

      // Telecaller scoping: telecallers only access their assigned queue
      if (req.user && req.user.role === 'Telecaller') {
        clause += ` AND (w.assigned_telecaller_id = ? OR w.assigned_telecaller = ?)`;
        params.push(req.user.id, req.user.fullName || req.user.username || '');
      }

      const cacheKey = `desk_${req.user ? req.user.id : 'anon'}_${JSON.stringify(locParams)}`;
      const cached = deskCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp < DESK_CACHE_TTL_MS)) {
        return res.json(cached.data);
      }

      // Overall desk counters
      const [counterRows] = await pool.query(`
        SELECT 
          COUNT(*) AS assignedCalls,
          SUM(CASE WHEN w.follow_up_date = CURDATE() AND w.call_status IN ('Pending', 'Call Back Requested', 'No Answer', 'Busy') THEN 1 ELSE 0 END) AS pendingCalls,
          SUM(CASE WHEN w.last_call_date >= CURDATE() THEN 1 ELSE 0 END) AS completedToday,
          SUM(CASE WHEN w.call_status = 'Connected' THEN 1 ELSE 0 END) AS connectedCalls,
          SUM(CASE WHEN w.call_status = 'No Answer' AND w.follow_up_date <= CURDATE() THEN 1 ELSE 0 END) AS noAnswerCount,
          SUM(CASE WHEN w.call_status = 'Call Back Requested' THEN 1 ELSE 0 END) AS callbackCount,
          SUM(CASE WHEN w.follow_up_date <= CURDATE() AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed') THEN 1 ELSE 0 END) AS remainingCalls
        FROM wedding_customers w
        WHERE w.is_deleted = 0 ${clause}
      `, params);

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
        WHERE w.is_deleted = 0 ${clause}
      `;

      // 1. Overdue (< CURDATE() and open)
      const [overdue] = await pool.query(`
        ${baseSelect}
        AND w.follow_up_date < CURDATE() 
        AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed')
        ORDER BY w.follow_up_date ASC, w.id ASC
        LIMIT 60
      `, params);

      // 2. Due Today (= CURDATE())
      const [dueToday] = await pool.query(`
        ${baseSelect}
        AND w.follow_up_date = CURDATE()
        AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed')
        ORDER BY 
          CASE WHEN w.call_status = 'Call Back Requested' THEN 0 WHEN w.call_status = 'Pending' THEN 1 ELSE 2 END,
          w.id ASC
        LIMIT 60
      `, params);

      // 3. Callback Requests (any date open)
      const [callbackRequests] = await pool.query(`
        ${baseSelect}
        AND w.call_status = 'Call Back Requested'
        AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed')
        ORDER BY w.follow_up_date ASC, w.id ASC
        LIMIT 40
      `, params);

      // 4. Upcoming (next 7 days)
      const [upcoming] = await pool.query(`
        ${baseSelect}
        AND w.follow_up_date > CURDATE() AND w.follow_up_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
        AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed')
        ORDER BY w.follow_up_date ASC, w.id ASC
        LIMIT 60
      `, params);

      // 5. Priority Calls (High/Urgent)
      const [priorityCalls] = await pool.query(`
        ${baseSelect}
        AND w.customer_status = 'Shopping Date Confirmed'
        AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed')
        ORDER BY w.follow_up_date ASC, w.id ASC
        LIMIT 40
      `, params);

      // 6. New Customers
      const [newCustomers] = await pool.query(`
        ${baseSelect}
        AND w.customer_status = 'New'
        ORDER BY w.created_at DESC, w.id DESC
        LIMIT 40
      `, params);

      // 7. Today's Appointments
      let apptWhere = '';
      let apptParams = [];
      if (req.user && req.user.locationId) {
        apptWhere += ' AND a.location_id = ?';
        apptParams.push(req.user.locationId);
      }
      const [todayAppointments] = await pool.query(`
        SELECT a.*, w.customer_name, w.mobile_number, w.customer_code
        FROM wedding_appointments a
        LEFT JOIN wedding_customers w ON w.id = a.customer_id
        WHERE a.appointment_date = CURDATE() ${apptWhere}
        ORDER BY a.appointment_time ASC
        LIMIT 30
      `, apptParams);

      const sum = counterRows[0] || {};

      // Restore conversation history for the queues before returning (see ENCRYPTED_FIELDS)
      for (const q of [overdue, dueToday, callbackRequests, upcoming, priorityCalls, newCustomers]) {
        decryptRows(q, ENCRYPTED_FIELDS);
      }

      const payload = {
        summary: {
          assignedCalls: Number(sum.assignedCalls) || 0,
          pendingCalls: Number(sum.pendingCalls) || 0,
          completedToday: Number(sum.completedToday) || 0,
          connectedCalls: Number(sum.connectedCalls) || 0,
          noAnswerCount: Number(sum.noAnswerCount) || 0,
          callbackCount: Number(sum.callbackCount) || 0,
          remainingCalls: Number(sum.remainingCalls) || 0
        },
        counts: {
          overdue: overdue.length,
          due_today: dueToday.length,
          dueToday: dueToday.length,
          callbacks: callbackRequests.length,
          callbackRequests: callbackRequests.length,
          upcoming: upcoming.length,
          priority: priorityCalls.length,
          priorityCalls: priorityCalls.length,
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
          overdue: overdue || [],
          dueToday: dueToday || [],
          due_today: dueToday || [],
          callbackRequests: callbackRequests || [],
          callbacks: callbackRequests || [],
          upcoming: upcoming || [],
          priorityCalls: priorityCalls || [],
          priority: priorityCalls || [],
          newCustomers: newCustomers || [],
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

      let sql = `
        SELECT id, username, full_name, role, location_id
        FROM users
        WHERE active = TRUE AND role = 'Telecaller'
      `;
      const params = [];

      if (locFilter) {
        // Branch context: own-branch telecallers plus global (location-less) telecaller accounts
        sql += ` AND (location_id = ? OR location_id IS NULL)`;
        params.push(locFilter);
      }

      sql += ` ORDER BY full_name ASC`;

      const [users] = await pool.query(sql, params);
      return successRes(res, { telecallers: users || [] }, 'Telecallers fetched successfully');
    } catch (err) {
      console.error('[WeddingController.getTelecallers Error]', err);
      return errorRes(res, 'Failed to fetch telecallers', [err.message], 500);
    }
  }


  // ── 14. Bulk CSV Import (strict validation — only related rows enter) ──
  async importCsv(req, res) {
    try {
      await ensureTables();
      if (!req.file || !req.file.buffer) {
        return errorRes(res, 'No CSV file uploaded. Attach the file in the "file" field.', [], 400);
      }

      // Location: branch users import into their own branch; global admins
      // may target one via ?location_id.
      let locationId = req.user ? req.user.locationId : null;
      if (!locationId) {
        const requested = req.query.location_id || req.body.location_id;
        locationId = requested && !isNaN(parseInt(requested, 10)) ? parseInt(requested, 10) : 2;
      }
      const [locRows] = await pool.query(`SELECT location_code FROM locations WHERE id = ?`, [locationId]);
      const locCode = locRows[0]?.location_code || 'BSC';

      const text = req.file.buffer.toString('utf8');
      const objects = rowsToObjects(parseCsv(text));
      if (objects.length === 0) {
        return errorRes(res, 'The CSV file has no data rows (a header row is required).', [], 400);
      }

      // ── Header mapping: accept the common column spellings ─────────────
      const pick = (obj, keys) => {
        for (const k of keys) {
          if (obj[k] !== undefined && obj[k] !== '') return obj[k];
        }
        return null;
      };

      // Date parsing: accepts YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY
      const parseDate = (raw) => {
        if (!raw) return null;
        const v = String(raw).trim();
        let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
        m = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
        const d = new Date(v);
        if (!isNaN(d.getTime())) {
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
        return null;
      };

      // Mobile normalisation: strip +91 / 91 prefix and separators, keep 10 digits
      const normalizeMobile = (raw) => {
        if (!raw) return null;
        let digits = String(raw).replace(/\D/g, '');
        if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
        if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
        if (digits.length !== 10 || !/^[6-9]/.test(digits)) return null;
        return digits;
      };

      const [yearRows] = await pool.query(
        `SELECT customer_code FROM wedding_customers WHERE customer_code LIKE ? ORDER BY id DESC LIMIT 1`,
        [`WED-${locCode}-${new Date().getFullYear()}-%`]
      );
      let seq = yearRows[0]
        ? parseInt(String(yearRows[0].customer_code).slice(-4), 10) || 0
        : 0;

      const inserted = [];
      const errors = [];
      let imported = 0;

      for (let idx = 0; idx < objects.length; idx++) {
        const row = objects[idx];
        const rowNo = idx + 2; // header offset
        const customerName = pick(row, ['customer_name', 'name', 'customer', 'bride_groom_name']);
        const mobile = normalizeMobile(pick(row, ['mobile_number', 'mobile', 'phone', 'contact', 'phone_number']));
        const emailRaw = pick(row, ['email', 'email_id', 'mail']);
        const email = emailRaw && /@/.test(emailRaw) ? emailRaw : null;
        const weddingDate = parseDate(pick(row, ['wedding_date', 'marriage_date', 'weddingdate']));
        const shoppingDate = parseDate(pick(row, ['expected_shopping_date', 'shopping_date', 'expectedshoppingdate']));
        const followUp = parseDate(pick(row, ['follow_up_date', 'followup_date', 'next_follow_up', 'follow_up'])) ||
          new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        const category = pick(row, ['preferred_shopping_category', 'category', 'shopping_category']) || 'General Wedding Shopping';
        const familyRaw = parseInt(pick(row, ['estimated_family_size', 'family_size', 'members']) || '1', 10);
        const familySize = !isNaN(familyRaw) && familyRaw > 0 && familyRaw < 100 ? familyRaw : 1;
        const notes = pick(row, ['customer_notes', 'notes', 'remarks', 'comments']);
        const telecaller = pick(row, ['assigned_telecaller', 'telecaller', 'assigned_to']);

        // ── Strict validation: only fully-related rows enter the CRM ──────
        if (!customerName) {
          errors.push({ row: rowNo, reason: 'Missing customer name — row skipped' });
          continue;
        }
        if (!mobile) {
          errors.push({ row: rowNo, reason: `Invalid/missing mobile number for "${customerName}" — row skipped` });
          continue;
        }
        if (!shoppingDate) {
          errors.push({ row: rowNo, reason: `Missing or unparseable expected shopping date for "${customerName}" — row skipped` });
          continue;
        }
        if (shoppingDate > '2100-01-01' || shoppingDate < '2000-01-01') {
          errors.push({ row: rowNo, reason: `Shopping date out of range for "${customerName}" — row skipped` });
          continue;
        }

        // Duplicate check within this location
        const [dup] = await pool.query(
          `SELECT customer_code FROM wedding_customers WHERE mobile_number = ? AND location_id = ? AND is_deleted = 0`,
          [mobile, locationId]
        );
        if (dup && dup.length > 0) {
          errors.push({ row: rowNo, reason: `Mobile ${mobile} already exists (${dup[0].customer_code}) — row skipped` });
          continue;
        }

        seq += 1;
        const customerCode = `WED-${locCode}-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`;
        try {
          await pool.query(
            `INSERT INTO wedding_customers (
              customer_code, location_id, customer_name, mobile_number, email,
              wedding_date, expected_shopping_date, preferred_shopping_category,
              estimated_family_size, assigned_telecaller, follow_up_date,
              customer_notes, customer_status, call_status, created_by, created_by_user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', 'Pending', ?, ?)`,
            [
              customerCode, locationId, String(customerName).substring(0, 150), mobile, email,
              weddingDate, shoppingDate, String(category).substring(0, 150),
              familySize, telecaller ? String(telecaller).substring(0, 150) : null, followUp,
              encryptField(notes), req.user?.fullName || 'CSV Import', req.user?.id || null
            ]
          );
          imported++;
          inserted.push(customerCode);
        } catch (rowErr) {
          errors.push({ row: rowNo, reason: `DB insert failed for "${customerName}": ${rowErr.message}` });
        }
      }

      await pool.query(
        `INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details)
         VALUES (NULL, ?, ?, 'CSV Import', ?)`,
        [locationId, req.user?.fullName || 'CSV Import', `Imported ${imported} rows from ${req.file.originalname}; ${errors.length} skipped`]
      );

      return successRes(res, {
        imported,
        skipped: errors.length,
        totalRows: objects.length,
        insertedCodes: inserted,
        errors
      }, `CSV import complete: ${imported} added, ${errors.length} skipped`);
    } catch (err) {
      console.error('[WeddingController.importCsv Error]', err);
      return errorRes(res, 'Failed to import CSV', [err.message], 500);
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
            w.mobile_number,
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

        decryptRows(rows, ENCRYPTED_FIELDS);

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
          w.preferred_shopping_category AS 'Shopping Category',
          w.estimated_family_size AS 'Family Size',
          COALESCE(w.assigned_telecaller, 'Unassigned') AS 'Assigned Telecaller',
          DATE_FORMAT(w.follow_up_date, '%d/%m/%Y') AS 'Next Follow-up Date',
          w.preferred_call_time AS 'Preferred Call Time',
          w.customer_status AS 'Customer Status',
          w.call_status AS 'Call Status',
          w.total_calls_count AS 'Total Calls',
          COALESCE(DATE_FORMAT(w.last_call_date, '%d/%m/%Y %H:%i'), '-') AS 'Last Call Date',
          COALESCE(w.last_call_outcome, '-') AS 'Last Call Result',
          COALESCE(w.customer_notes, '-') AS 'Remarks',
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
        `SELECT id, location_id FROM wedding_customers WHERE id = ? AND is_deleted = 0 ${locClause}`,
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
        `SELECT id, location_id FROM wedding_customers WHERE id = ? AND is_deleted = 0 ${locClause}`,
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
        `SELECT id, location_id FROM wedding_customers WHERE id = ? AND is_deleted = 0 ${locClause}`,
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
        `SELECT id, location_id FROM wedding_customers WHERE id = ? AND is_deleted = 0 ${locClause}`,
        [customerId, ...locParams]
      );
      if (!existing || existing.length === 0) return errorRes(res, 'Customer not found', [], 404);

      const { note_content, note_type } = req.body;
      if (!note_content || !note_content.trim()) return errorRes(res, 'Note content is required', [], 400);

      const locationId = existing[0].location_id;
      const [result] = await pool.query(`
        INSERT INTO wedding_notes (customer_id, location_id, note_content, note_type, created_by, created_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [customerId, locationId, encryptField(note_content.trim()), note_type || 'General', req.user?.fullName || 'Staff', req.user?.id || null]);

      return successRes(res, { id: result.insertId }, 'Note added', 201);
    } catch (err) {
      console.error('[WeddingController.createNote Error]', err);
      return errorRes(res, 'Failed to add note', [err.message], 500);
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
        `SELECT id, location_id FROM wedding_customers WHERE id = ? AND is_deleted = 0 ${locClause}`,
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
        `SELECT * FROM wedding_customers WHERE id = ? AND is_deleted = 0 ${locClause}`,
        [customerId, ...locParams]
      );
      if (!existing || existing.length === 0) return errorRes(res, 'Customer not found', [], 404);

      const { new_status, change_reason } = req.body;
      if (!new_status) return errorRes(res, 'New status is required', [], 400);

      const cust = existing[0];
      const oldStatus = cust.customer_status;

      await pool.query(`UPDATE wedding_customers SET customer_status = ? WHERE id = ?`, [new_status, customerId]);

      await pool.query(`
        INSERT INTO wedding_status_history (customer_id, location_id, old_status, new_status, changed_by, changed_by_user_id, change_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [customerId, cust.location_id, oldStatus, new_status, req.user?.fullName || 'Staff', req.user?.id || null, change_reason || null]);

      await pool.query(
        `INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details) VALUES (?, ?, ?, 'Status Changed', ?)`,
        [customerId, cust.location_id, req.user?.fullName || 'Staff', `Status: ${oldStatus} → ${new_status}${change_reason ? '. Reason: ' + change_reason : ''}`]
      );

      return successRes(res, { id: customerId, old_status: oldStatus, new_status: new_status }, 'Status updated');
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

      const [mainStats] = await pool.query(`
        SELECT
          COUNT(*) AS totalCustomers,
          SUM(CASE WHEN DATE(w.created_at) = CURDATE() THEN 1 ELSE 0 END) AS todayRegistrations,
          SUM(CASE WHEN w.follow_up_date = CURDATE() AND w.customer_status NOT IN ('Converted','Visited Store','Not Interested','Cancelled','Closed') THEN 1 ELSE 0 END) AS todayFollowUps,
          SUM(CASE WHEN w.follow_up_date < CURDATE() AND w.customer_status NOT IN ('Converted','Visited Store','Not Interested','Cancelled','Closed') THEN 1 ELSE 0 END) AS overdueFollowUps,
          SUM(CASE WHEN w.wedding_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS upcomingWeddings30,
          SUM(CASE WHEN w.wedding_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS upcomingWeddings7,
          (SELECT COUNT(*) FROM wedding_visits v WHERE v.customer_id IN (SELECT id FROM wedding_customers WHERE is_deleted=0) ${locClause.replace('w.', 'v.')} AND v.visit_date = CURDATE()) AS todayVisits,
          (SELECT COUNT(*) FROM wedding_appointments a WHERE a.customer_id IN (SELECT id FROM wedding_customers WHERE is_deleted=0) ${locClause.replace('w.', 'a.')} AND a.appointment_date = CURDATE()) AS todayAppointments,
          SUM(CASE WHEN w.customer_status = 'Shopping Date Confirmed' THEN 1 ELSE 0 END) AS shoppingConfirmed,
          SUM(CASE WHEN w.customer_status IN ('Visited Store') THEN 1 ELSE 0 END) AS storeVisitsDone,
          SUM(CASE WHEN w.customer_status = 'Converted' THEN 1 ELSE 0 END) AS purchaseCompleted,
          SUM(CASE WHEN w.customer_status = 'Not Interested' THEN 1 ELSE 0 END) AS notInterested,
          SUM(CASE WHEN w.customer_status IN ('Cancelled','Closed') THEN 1 ELSE 0 END) AS cancelledClosed
        FROM wedding_customers w
        WHERE w.is_deleted = 0 ${locClause}
      `, params);

      const main = mainStats[0] || {};

      const raw = main;
      const stats = {
        totalCustomers: Number(raw.totalCustomers) || 0,
        todayRegistrations: Number(raw.todayRegistrations) || 0,
        todayFollowUps: Number(raw.todayFollowUps) || 0,
        overdueFollowUps: Number(raw.overdueFollowUps) || 0,
        upcomingWeddings7: Number(raw.upcomingWeddings7) || 0,
        upcomingWeddings30: Number(raw.upcomingWeddings30) || 0,
        todayVisits: Number(raw.todayVisits) || 0,
        todayAppointments: Number(raw.todayAppointments) || 0,
        shoppingConfirmed: Number(raw.shoppingConfirmed) || 0,
        storeVisitsDone: Number(raw.storeVisitsDone) || 0,
        purchaseCompleted: Number(raw.purchaseCompleted) || 0,
        notInterested: Number(raw.notInterested) || 0,
        cancelledClosed: Number(raw.cancelledClosed) || 0
      };

      let locationCards = [];
      if (!req.user || !req.user.locationId) {
        const [locRows] = await pool.query(`
          SELECT
            l.id AS location_id, l.location_code, l.location_name,
            COUNT(w.id) AS total_customers,
            SUM(CASE WHEN DATE(w.created_at) = CURDATE() THEN 1 ELSE 0 END) AS new_customers,
            SUM(CASE WHEN w.follow_up_date < CURDATE() AND w.customer_status NOT IN ('Converted','Visited Store','Not Interested','Cancelled','Closed') THEN 1 ELSE 0 END) AS pending_followups,
            SUM(CASE WHEN w.wedding_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS upcoming_weddings,
            SUM(CASE WHEN w.customer_status IN ('Visited Store','Converted') THEN 1 ELSE 0 END) AS visits,
            SUM(CASE WHEN w.customer_status = 'Converted' THEN 1 ELSE 0 END) AS purchases
          FROM locations l
          LEFT JOIN wedding_customers w ON w.location_id = l.id AND w.is_deleted = 0
          GROUP BY l.id, l.location_code, l.location_name
          ORDER BY l.sort_order ASC
        `);
        locationCards = locRows || [];
      }

      return successRes(res, { stats, locationCards }, 'Enhanced dashboard stats fetched');
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
        SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS count
        FROM wedding_customers WHERE is_deleted = 0 ${locClause}
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
      const { clause: locClause, params: locParams } = resolveLocFilter(req, 'w');

      await pool.query(
        `UPDATE wedding_customers SET customer_status = ? WHERE id IN (${placeholders}) AND is_deleted = 0 ${locClause}`,
        [new_status, ...customer_ids, ...locParams]
      );

      for (const cid of customer_ids) {
        await pool.query(
          `INSERT INTO wedding_status_history (customer_id, location_id, new_status, changed_by, changed_by_user_id) VALUES (?, 0, ?, ?, ?)`,
          [cid, new_status, req.user?.fullName || 'Staff', req.user?.id || null]
        );
      }

      await pool.query(
        `INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details) VALUES (NULL, 0, ?, 'Bulk Status Update', ?)`,
        [req.user?.fullName || 'Staff', `Updated ${customer_ids.length} customers to "${new_status}"`]
      );

      return successRes(res, { updated: customer_ids.length }, `Bulk updated ${customer_ids.length} customers`);
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
      const { clause: locClause, params: locParams } = resolveLocFilter(req, 'w');

      await pool.query(
        `UPDATE wedding_customers SET assigned_telecaller = ?, assigned_telecaller_id = ? WHERE id IN (${placeholders}) AND is_deleted = 0 ${locClause}`,
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
            SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS today_new,
            SUM(CASE WHEN customer_status = 'Converted' THEN 1 ELSE 0 END) AS converted,
            SUM(CASE WHEN customer_status = 'Not Interested' THEN 1 ELSE 0 END) AS not_interested,
            SUM(CASE WHEN customer_status IN ('Cancelled','Closed') THEN 1 ELSE 0 END) AS closed,
            AVG(total_calls_count) AS avg_calls_per_customer
          FROM wedding_customers WHERE is_deleted = 0 ${locClause}
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
      if (!custRows?.length) return errorRes(res, 'Customer not found', [], 404);

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
        auditLogs: auditLogs || []
      }, 'Full profile fetched');
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
        WHERE w.is_deleted = 0 ${locClause}
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
        WHERE w.is_deleted = 0 AND w.wedding_date IS NOT NULL
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
        WHERE w.is_deleted = 0 ${locClause}
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

      const [followups] = await pool.query(`
        SELECT w.id, w.customer_name, w.follow_up_date AS date, 'followup' AS event_type, w.customer_status, w.assigned_telecaller
        FROM wedding_customers w
        WHERE w.is_deleted=0 AND w.follow_up_date >= ? AND w.follow_up_date < ? ${locClause}
        ORDER BY w.follow_up_date
      `, [start, end, ...params]);

      const [weddings] = await pool.query(`
        SELECT w.id, w.customer_name, w.wedding_date AS date, 'wedding' AS event_type, w.bride_name, w.groom_name
        FROM wedding_customers w
        WHERE w.is_deleted=0 AND w.wedding_date IS NOT NULL AND w.wedding_date >= ? AND w.wedding_date < ? ${locClause}
        ORDER BY w.wedding_date
      `, [start, end, ...params]);

      const [appts] = await pool.query(`
        SELECT a.id, a.customer_id, a.appointment_date AS date, a.appointment_time AS time, 'appointment' AS event_type, a.purpose, a.appointment_status
        FROM wedding_appointments a
        WHERE a.appointment_date >= ? AND a.appointment_date < ? ${locClause.replace('w.','a.')}
        ORDER BY a.appointment_date
      `, [start, end, ...params]);

      const [visits] = await pool.query(`
        SELECT v.id, v.customer_id, v.visit_date AS date, v.visit_time AS time, 'visit' AS event_type, v.purpose, v.visit_status
        FROM wedding_visits v
        WHERE v.visit_date >= ? AND v.visit_date < ? ${locClause.replace('w.','v.')}
        ORDER BY v.visit_date
      `, [start, end, ...params]);

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
}

module.exports = new WeddingController();
