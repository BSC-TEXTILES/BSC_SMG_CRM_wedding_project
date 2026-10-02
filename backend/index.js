/**
 * BSC Enterprise HRMS - Entry Point
 * Hostinger/Passenger: PassengerStartupFile=index.js, PassengerAppType=node
 *
 * Passenger SETS the PORT env var via its preload-timestamp.js script.
 * The app MUST call app.listen(PORT) on Passenger's assigned port.
 * Do NOT hardcode PORT=5000 - Passenger assigns a dynamic port each time.
 */

const fs = require('fs');
const path = require('path');

// ── Directory References ──────────────────────────────────────────────────────
const APP_ROOT = __dirname;
const SERVER_DIR = path.join(APP_ROOT, 'server');

// ── Global Crash Handlers (Mounted immediately before any other requires) ────
// crash.log is truncated once it exceeds this size. Without a cap a restart
// loop grows the file without bound (it has reached 4+ MB / 39k lines here).
const CRASH_LOG_MAX_BYTES = 1024 * 1024;

function writeCrashLog(msg) {
  try {
    const file = path.join(APP_ROOT, 'crash.log');
    try {
      const stat = fs.statSync(file);
      if (stat.size > CRASH_LOG_MAX_BYTES) fs.writeFileSync(file, '');
    } catch (e) { /* file does not exist yet */ }
    fs.appendFileSync(file, msg);
  } catch (e) { /* logging must never throw */ }
}

// Socket/transport errors that only affect a single already-broken request or
// the stdout pipe. Killing the process for these is what turns a momentary
// network blip into a proxy-level "503 Service Unavailable" page.
const BENIGN_ERROR_CODES = new Set([
  'EPIPE',
  'ECONNRESET',
  'ECONNABORTED',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'ENOTFOUND',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ERR_STREAM_DESTROYED',
  'ERR_STREAM_PREMATURE_CLOSE',
  'ERR_STREAM_WRITE_AFTER_END',
  'ERR_STREAM_NULL_VALUES',
  'ERR_HTTP_HEADERS_SENT',
  'ERR_HTTP_REQUEST_TIMEOUT',
  'ABORT_ERR',
  'UND_ERR_CONNECT_TIMEOUT'
]);

process.on('uncaughtException', (err) => {
  if (BENIGN_ERROR_CODES.has(err?.code)) {
    console.warn(`[Ignored benign exception] ${err.code} ${err.message}`);
    return;
  }
  const msg = `[CRITICAL uncaughtException] ${new Date().toISOString()} ${err?.code || ''} ${err?.message || err}\n${err?.stack || ''}\n`;
  console.error(msg);
  writeCrashLog(msg);
  process.exit(1); // Exit so Passenger/process manager can cleanly restart
});
process.on('unhandledRejection', (reason) => {
  const msg = `[CRITICAL unhandledRejection] ${new Date().toISOString()} ${reason?.message || reason}\n${reason?.stack || ''}\n`;
  console.error(msg);
  writeCrashLog(msg);
});

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const http = require('http');

let Server = null;
try {
  Server = require('socket.io').Server;
} catch (e) {
  console.warn('[Boot] socket.io module not found or failed to load. Real-time updates disabled:', e.message);
}

// ── Preserve Hostinger / CloudLinux / Passenger Assigned Port ─────────────────
// Hostinger/CloudLinux sets process.env.PORT (e.g. numeric port or socket path).
// We MUST preserve it and never overwrite it with 'passenger' if a port is given.
const hostPort = process.env.PORT;

// ── Load .env as FALLBACK only ────────────────────────────────────────────────
dotenv.config({ path: path.join(APP_ROOT, '..', '.env') });
dotenv.config({ path: path.join(APP_ROOT, '.env') });
dotenv.config({ path: path.join(SERVER_DIR, '.env') });

// If Hostinger or platform already set a PORT in the environment, restore it!
if (hostPort !== undefined && hostPort !== null && String(hostPort).trim().length > 0) {
  process.env.PORT = hostPort;
}

// ── Validate Startup Secrets (Fails fast in production on unsafe config) ──────
const { validateStartupSecrets } = require('./src/security/secretsValidator');
validateStartupSecrets();

// ── Load modules ──────────────────────────────────────────────────────────────
const pool = require('./src/config/db');
const { autoInitializeDatabase } = require('./src/config/dbInitializer');
const { redisClient, isReady } = require('./src/config/redisClient');
const apiRoutes = require('./src/routes/api');
const landingRoutes = require('./src/routes/landingRoutes');
const { errorRes } = require('./src/utils/response');
const { authenticate, authorize } = require('./src/middleware/auth');
const feedbackQrController = require('./src/controllers/feedbackQrController');
const { setCsrfCookie, csrfProtection } = require('./src/middleware/csrf');

// ── Daily Executive Report Scheduler (Midnight 12:00 AM IST) ─────────────────
try {
  const { initDailyReportScheduler } = require('./src/services/reportScheduler');
  initDailyReportScheduler();
} catch (schedulerErr) {
  console.warn('[ReportScheduler] Failed to initialize scheduler on boot:', schedulerErr.message);
}

// ── Application Security & Firewall Layer ─────────────────────────────────────
const wafMiddleware = require('./src/security/wafMiddleware');
const { helmetSecurityHeaders, extendedSecurityHeaders } = require('./src/security/headersConfig');
const { corsMiddleware } = require('./src/security/corsConfig');
const { inputSanitizer } = require('./src/security/inputSanitizer');
const { validateContentType } = require('./src/middleware/validateContentType');
const { globalApiRateLimiter } = require('./src/security/rateLimiters');

// ── Express App ───────────────────────────────────────────────────────────────
const app = express();

// Resilient PORT parsing:
// 1. If typeof(PhusionPassenger) !== 'undefined' and no PORT is given -> 'passenger'
// 2. If rawPort is explicitly 'passenger' -> 'passenger'
// 3. If rawPort is a number -> numeric port
// 4. If rawPort is a socket path -> domain socket
// 5. Fallback -> 5000 (or 3000 if production without PORT)
let rawPort = process.env.PORT;
let PORT = 5000;
let isSocketPort = false;

if (typeof(PhusionPassenger) !== 'undefined' && (!rawPort || String(rawPort).toLowerCase() === 'passenger')) {
  try { PhusionPassenger.configure({ autoInstall: false }); } catch (e) {}
  PORT = 'passenger';
  isSocketPort = true;
} else if (rawPort !== undefined && rawPort !== null && String(rawPort).trim().length > 0) {
  const trimmed = String(rawPort).trim();
  if (trimmed.toLowerCase() === 'passenger') {
    PORT = 'passenger';
    isSocketPort = true;
  } else if (/^\d+$/.test(trimmed)) {
    PORT = parseInt(trimmed, 10);
    isSocketPort = false;
  } else {
    PORT = trimmed;
    isSocketPort = true;
  }
} else if (process.env.NODE_ENV === 'production') {
  PORT = 3000;
}

console.log(`[Boot] PORT=${PORT} (${isSocketPort ? 'socket/passenger' : 'network'}) | DB=${process.env.DB_NAME} | ENV=${process.env.NODE_ENV}`);

const isProduction = process.env.NODE_ENV === 'production';

// In development the Vite proxy points at one fixed port, so drifting to the next
// free one makes the browser talk to a server that is not this process: every call
// answers 503/ECONNREFUSED and it looks exactly like a crashed backend. Only the
// production/Passenger startup may search for a free port.
const ALLOW_PORT_FALLBACK = isProduction;

// Trust first proxy (nginx/Caddy) for correct client IP, secure cookie detection, and rate limiting
// In production behind reverse proxy, '1' trusts the first hop (the reverse proxy)
app.set('trust proxy', isProduction ? 1 : false);

// ── Security Headers Layer ───────────────────────────────────────────────────
app.use(helmetSecurityHeaders);
app.use(extendedSecurityHeaders);

// ── Compression & Gzip ───────────────────────────────────────────────────────
app.use(compression({ filter: (req, res) => (req.headers['x-no-compression'] ? false : compression.filter(req, res)) }));

// ── Hardened CORS Layer (Restricts to verified origins) ───────────────────────
app.use(corsMiddleware);

// ── Cookies & Body Parsers with Strict Size Limits ───────────────────────────
app.use(cookieParser()); // populates req.cookies for the httpOnly session cookie
app.use(express.json({ limit: '2mb' })); // Strict 2MB cap for JSON payloads
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(validateContentType);

// ── Web Application Firewall (WAF) Layer ─────────────────────────────────────
// Inspects incoming requests BEFORE sensitive route execution
app.use(wafMiddleware);

// ── Input Sanitization Layer ─────────────────────────────────────────────────
app.use(inputSanitizer);

// ── CSRF Protection Cookie ───────────────────────────────────────────────────
app.use(setCsrfCookie);

// ── Static Uploads ────────────────────────────────────────────────────────────
// One canonical storage root. A relative UPLOAD_DIR used to resolve against
// process.cwd(), so starting the server from a different folder wrote new files
// into a different tree than the one existing records pointed at, and an upload
// could succeed and still render as a broken image.
const { UPLOAD_ROOT, LEGACY_UPLOAD_ROOTS, ensureUploadDirs, findStoredFile } = require('./src/config/uploadPaths');

ensureUploadDirs();
console.log(`[Uploads] Storage root: ${UPLOAD_ROOT}`);

app.use('/uploads', express.static(UPLOAD_ROOT, { maxAge: '1h', etag: true }));
// Files written before the root was pinned down are still served, read-only, so
// no previously uploaded image or document stops displaying.
LEGACY_UPLOAD_ROOTS.filter((dir) => fs.existsSync(dir)).forEach((dir) => {
  app.use('/uploads', express.static(dir));
});

// Smart Uploads Fallback Handler (prevents 404 for photos & documents across subfolders)
app.get(['/uploads/*', '/candidate-resumes/*', '/candidate-photos/*', '/employee-photos/*', '/employee-documents/*', '/vm-checklist/*', '/:file(*.pdf)', '/:file(*.jpg)', '/:file(*.jpeg)', '/:file(*.png)', '/:file(*.webp)', '/:file(*.doc)', '/:file(*.docx)'], (req, res, next) => {
  const reqPath = req.params[0] || req.params.file || req.path.replace(/^\//, '');

  const found = findStoredFile(reqPath, { appNo: req.query.appNo || '' });
  if (found) return res.sendFile(found);

  next();
});

// ── Accidental /api/api URL Normalization ────────────────────────────────────
app.use((req, res, next) => {
  if (req.url.startsWith('/api/api/')) {
    req.url = req.url.replace(/^\/api\/api\//, '/api/');
  }
  next();
});

// ── Boundary Rate Limiter on API Endpoints ──────────────────────────────────
app.use('/api', globalApiRateLimiter);

// ── Health / Diagnostics (Always accessible, zero secrets leaked) ─────────────
app.get(['/health', '/api/health'], async (req, res) => {
  let dbStatus = 'healthy';
  let isHealthy = true;
  try {
    const conn = await pool.getConnection();
    await conn.query('SELECT 1');
    conn.release();
  } catch (dbErr) {
    dbStatus = 'degraded';
    isHealthy = false;
    console.warn('[Health Check] Database connectivity check failed:', dbErr.message);
  }

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    server: 'operational',
    database: dbStatus,
    redis: isReady() ? 'connected' : 'degraded',
    version: '3.0.1',
    timestamp: new Date().toISOString()
  });
});

app.get(['/db-status', '/api/db-status'], authenticate, authorize('Admin', 'Super Admin'), async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query('SHOW TABLES');
    conn.release();
    res.json({ connected: true, tables: rows.length });
  } catch (err) {
    res.status(500).json({ connected: false, error: 'Database service unavailable' });
  }
});

// ── Destructive Maintenance Endpoints (Admin-only) ───────────────────────────
// These wipe or mutate the schema — they must never be reachable anonymously.
app.get('/api/wipe-db', authenticate, authorize('Admin', 'Super Admin'), async (req, res) => {
  // Two-layer safety: admin token + explicit ?confirm=yes query param.
  if (req.query.confirm !== 'yes') {
    return errorRes(res, 'Destructive action: append ?confirm=yes to confirm the wipe', [], 400);
  }
  const tables = ['candidates','interview_schedules','candidate_activities','hr_evaluations',
    'interview_tokens','selected_candidates','rejected_candidates',
    'selection_offers','onboarding_records','onboarding_items'];
  for (const t of tables) {
    try { await pool.query(`DELETE FROM \`${t}\``); } catch(e) {}
  }
  res.json({ success: true });
});

// ── Self-Healing DB Migration ─────────────────────────────────────────────────
// Hit /api/fix-db-schema once (as an authenticated Admin) to create any missing tables on the live server
app.get('/api/fix-db-schema', authenticate, authorize('Admin', 'Super Admin'), async (req, res) => {
  const results = [];
  try {
    const conn = await pool.getConnection();
    const migrations = [
      `CREATE TABLE IF NOT EXISTS \`page_visibility\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`role_page_key\` VARCHAR(200) NOT NULL UNIQUE,
        \`role\` VARCHAR(100) NOT NULL,
        \`page_key\` VARCHAR(100) NOT NULL,
        \`allowed\` BOOLEAN DEFAULT TRUE,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS \`department_sections\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`department\` VARCHAR(100) NOT NULL,
        \`section_name\` VARCHAR(100) NOT NULL,
        \`description\` VARCHAR(255),
        \`active\` BOOLEAN DEFAULT TRUE,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY \`dept_sec\` (\`department\`, \`section_name\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS \`department_hiring_targets\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`department\` VARCHAR(100) NOT NULL,
        \`section\` VARCHAR(100) NOT NULL,
        \`designation\` VARCHAR(100) NOT NULL,
        \`required_openings\` INT DEFAULT 10,
        \`hiring_target\` INT DEFAULT 10,
        \`remarks\` TEXT,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY \`dept_sec_desig\` (\`department\`, \`section\`, \`designation\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS \`locations\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`location_code\` VARCHAR(10) NOT NULL UNIQUE,
        \`location_name\` VARCHAR(100) NOT NULL,
        \`address\` TEXT NULL,
        \`phone\` VARCHAR(20) NULL,
        \`email\` VARCHAR(100) NULL,
        \`status\` VARCHAR(20) NOT NULL DEFAULT 'Active',
        \`sort_order\` INT NOT NULL DEFAULT 0,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `INSERT IGNORE INTO \`locations\` (\`id\`, \`location_code\`, \`location_name\`, \`sort_order\`, \`status\`) VALUES
       (1, 'BEL', 'Belagavi', 1, 'Active'),
       (2, 'DAV', 'Davanagere', 2, 'Active'),
       (3, 'SHI', 'Shivamogga', 3, 'Active')`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS location_id INT NULL DEFAULT 2`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS location_code VARCHAR(10) NULL`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50) NULL`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS candidate_app_no VARCHAR(50) NULL`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP NULL`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
      `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS location_id INT NOT NULL DEFAULT 2`,
      `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS location_code VARCHAR(10) NOT NULL DEFAULT 'DAV'`,
      `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS is_deleted TINYINT(1) NOT NULL DEFAULT 0`,
      `CREATE TABLE IF NOT EXISTS \`wedding_customers\` (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS \`wedding_call_logs\` (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS \`wedding_audit_logs\` (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    ];
    for (const sql of migrations) {
      try {
        await conn.query(sql);
        results.push({ ok: true, sql: sql.substring(0, 60) });
      } catch (e) {
        results.push({ ok: false, sql: sql.substring(0, 60), error: e.message });
      }
    }
    await conn.query('ALTER TABLE wedding_customers MODIFY COLUMN expected_shopping_date DATE NULL DEFAULT NULL').catch(() => {});
    // Seed default page_visibility rows (idempotent)
    const defaultVisibility = [
      ['HR_dashboard','HR','dashboard',true],['HR_candidates','HR','candidates',true],
      ['HR_interview','HR','interview',true],['HR_offer','HR','offer',true],
      ['HR_onboarding','HR','onboarding',true],['HR_exit','HR','exit',true],
      ['HR_employees','HR','employees',true],['HR_settings','HR','settings',false],
      ['HR_dept-hiring','HR','dept-hiring',true],
      ['Manager_dashboard','Manager','dashboard',true],['Manager_candidates','Manager','candidates',true],
      ['Manager_interview','Manager','interview',true],['Manager_offer','Manager','offer',false],
      ['Manager_onboarding','Manager','onboarding',true],['Manager_exit','Manager','exit',true],
      ['Manager_employees','Manager','employees',true],['Manager_settings','Manager','settings',false],
      ['Manager_dept-hiring','Manager','dept-hiring',true],
      ['Admin_dashboard','Admin','dashboard',true],['Admin_candidates','Admin','candidates',true],
      ['Admin_interview','Admin','interview',true],['Admin_offer','Admin','offer',true],
      ['Admin_onboarding','Admin','onboarding',true],['Admin_exit','Admin','exit',true],
      ['Admin_employees','Admin','employees',true],['Admin_settings','Admin','settings',true],
      ['Admin_dept-hiring','Admin','dept-hiring',true],
      ['HR_wedding_crm','HR','wedding_crm',true],
      ['Manager_wedding_crm','Manager','wedding_crm',true],
      ['Admin_wedding_crm','Admin','wedding_crm',true],
      ['Super Admin_wedding_crm','Super Admin','wedding_crm',true],
      ['Admin_telecaller_desk','Admin','telecaller_desk',true],
      ['Super Admin_telecaller_desk','Super Admin','telecaller_desk',true],
      ['Manager_telecaller_desk','Manager','telecaller_desk',true],
      ['Telecaller_telecaller_desk','Telecaller','telecaller_desk',true],
      ['CRM Executive_telecaller_desk','CRM Executive','telecaller_desk',true],
      ['CRM Manager_telecaller_desk','CRM Manager','telecaller_desk',true]
    ];
    for (const [key, role, page, allowed] of defaultVisibility) {
      try {
        await conn.query(
          `INSERT INTO page_visibility (role_page_key, role, page_key, allowed) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE allowed=allowed`,
          [key, role, page, allowed ? 1 : 0]
        );
      } catch(e) {}
    }
    conn.release();
    res.json({ success: true, message: 'Schema fix complete. Missing tables created.', results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── API Routes ────────────────────────────────────────────────────────────────
// Public Landing routes (no CSRF, no auth - for public wedding landing page)
app.use('/api/landing', landingRoutes);

// Public Feedback QR scan tracking (no CSRF, no auth - for QR code scanning by customers)
app.get('/api/feedback-qr/scan/:qrCodeId', feedbackQrController.trackQrScan);
app.post('/api/feedback-qr/scan/:qrCodeId', feedbackQrController.trackQrScan);

// Public Profile Website Routes & Admin Endpoints
const profileSiteRoutes = require('./src/routes/profileSiteRoutes');
app.use('/api/profile-site', profileSiteRoutes);
app.use('/api', profileSiteRoutes);

// Apply CSRF protection to all other API routes (auth routes exempted in middleware)
app.use('/api', csrfProtection, apiRoutes);

// ── Frontend SPA ──────────────────────────────────────────────────────────────
let distDir = path.join(APP_ROOT, 'dist');
if (!fs.existsSync(distDir) && fs.existsSync(path.join(APP_ROOT, '..', 'dist'))) {
  distDir = path.join(APP_ROOT, '..', 'dist');
} else if (!fs.existsSync(distDir) && fs.existsSync(path.join(APP_ROOT, '..', 'frontend', 'dist'))) {
  distDir = path.join(APP_ROOT, '..', 'frontend', 'dist');
}
// Favicon & Icon static route handler (prevents 503 / 404 errors on live server)
app.get(['/favicon.ico', '/favicon.png', '/logo.png'], (req, res) => {
  const iconName = path.basename(req.path);
  const possiblePaths = [
    path.join(distDir, iconName),
    path.join(APP_ROOT, '..', 'frontend', 'public', iconName),
    path.join(APP_ROOT, '..', 'frontend', 'public', 'favicon.ico'),
    path.join(APP_ROOT, '..', 'frontend', 'public', 'logo.png')
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      return res.sendFile(p);
    }
  }
  return res.status(204).end();
});

// Web App Manifest handler (serves manifest.json and manifest.webmanifest with correct MIME type)
app.get(['/manifest.json', '/manifest.webmanifest'], (req, res) => {
  const manifestName = path.basename(req.path);
  const possiblePaths = [
    path.join(distDir, manifestName),
    path.join(distDir, 'manifest.webmanifest'),
    path.join(distDir, 'manifest.json'),
    path.join(APP_ROOT, '..', 'frontend', 'public', manifestName),
    path.join(APP_ROOT, '..', 'frontend', 'public', 'manifest.webmanifest'),
    path.join(APP_ROOT, '..', 'frontend', 'public', 'manifest.json'),
    path.join(APP_ROOT, 'public', manifestName),
    path.join(APP_ROOT, 'public', 'manifest.webmanifest'),
    path.join(APP_ROOT, 'public', 'manifest.json')
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      res.type('application/manifest+json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.sendFile(p);
    }
  }
  return res.status(404).end();
});

if (fs.existsSync(distDir)) {
  console.log(`[Boot] Serving frontend from: ${distDir}`);
  // Vite emits content-hashed filenames — they are safe to cache forever.
  // This is the single biggest performance win for repeat visitors.
  app.use('/assets', express.static(path.join(distDir, 'assets'), {
    immutable: true,
    maxAge: '1y',
    setHeaders(res) { res.setHeader('X-Content-Hashed', '1'); }
  }));
  app.use(express.static(distDir, {
    etag: true,
    maxAge: '5m',
    setHeaders(res, filePath) {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache'); // always revalidate the entry point
      } else if (filePath.endsWith('sw.js')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Service-Worker-Allowed', '/');
      } else if (/\.(webp|png|jpe?g|svg|ico|woff2?|ttf|eot|webmanifest|json)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
      }
    }
  }));

  // Assets Fallback: Never return index.html (text/html) for CSS / JS asset requests!
  app.get('/assets/*', (req, res, next) => {
    const assetPath = path.join(distDir, req.path);
    if (fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
      return res.sendFile(assetPath);
    }
    const ext = path.extname(req.path).toLowerCase();
    const assetsFolder = path.join(distDir, 'assets');
    if (fs.existsSync(assetsFolder)) {
      const files = fs.readdirSync(assetsFolder);
      const match = files.find(f => path.extname(f).toLowerCase() === ext);
      if (match) {
        return res.sendFile(path.join(assetsFolder, match));
      }
    }
    return res.status(404).send('Asset file not found');
  });

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/assets') ||
        req.path.endsWith('.css') || req.path.endsWith('.js') || req.path.endsWith('.ico') || req.path.endsWith('.png') || req.path.endsWith('.svg') ||
        req.path === '/health' || req.path === '/db-status') return next();
    
    const fallback = path.join(distDir, 'index.html');
    if (fs.existsSync(fallback)) return res.sendFile(fallback);
    return next();
  });
} else {
  console.warn('[Boot] No dist/ folder found.');
}

// ── Error Handlers ────────────────────────────────────────────────────────────
app.use('/api/*', (req, res) => errorRes(res, `Not found: ${req.originalUrl}`, [], 404));
app.use((err, req, res, next) => {
  console.error(`[Error ${req.method} ${req.path}]`, err.message);

  if (err.message && err.message.includes('CORS Policy')) {
    return errorRes(res, 'Cross-origin request blocked by security policy.', [], 403);
  }
  if (err.type === 'entity.too.large' || err.code === 'LIMIT_FILE_SIZE') {
    return errorRes(res, 'Request payload exceeds maximum allowed size.', [], 413);
  }
  // multer's fileFilter rejects with a plain Error — surface it as a client
  // error so the upload form shows the real reason instead of a 500.
  if (err.message && /Only JPG, JPEG, and PNG images are allowed/i.test(err.message)) {
    return errorRes(res, err.message, [], 400);
  }
  if (err.code === 'CSRF_ERROR') {
    return errorRes(res, 'Invalid CSRF token.', [], 403);
  }

  const msg = process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message;
  errorRes(res, msg, [], err.status || 500);
});

// ── DB & Cache Init ───────────────────────────────────────────────────────────────────
autoInitializeDatabase(pool)
  .then(async () => {
    console.log('[Boot] DB init complete');
    const { initBloomFilter } = require('./src/config/redisClient');
    await initBloomFilter('wedding_customers_bf', 0.01, 100000).catch(() => {});
    
    // Initialize API Key security schedulers (15m reauth checks, 1h expiry cleanup, 24h digest)
    const { initApiKeyJobs } = require('./src/jobs/apiKeyJobs');
    initApiKeyJobs();
  })
  .catch(err => console.error('[Boot] DB init error:', err.message));

// ── START SERVER ──────────────────────────────────────────────────────────────
// Passenger (PassengerAppType=node) REQUIRES app.listen(PORT) to be called.
// Passenger sets PORT via its preload-timestamp.js script before this file runs.
// The listen() call is what signals to Passenger that the app is ready.
const server = http.createServer(app);
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

if (Server) {
  try {
    // Use same allowed origins as REST API CORS
    const { isOriginAllowed } = require('./src/security/corsConfig');
    const io = new Server(server, {
      cors: {
        origin: (origin, callback) => {
          if (isOriginAllowed(origin)) {
            callback(null, true);
          } else {
            console.warn(`[Socket.IO CORS] Blocked unauthorized origin: ${origin}`);
            callback(new Error('CORS Policy: Access from origin not permitted.'));
          }
        },
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true
      }
    });

    const realtimeService = require('./src/services/realtimeService');
    realtimeService.init(io);
    app.set('io', io);
    app.set('realtimeService', realtimeService);
    
    // Initialize Broadcast background jobs (scheduled dispatch, expiry, cleanup)
    const { initBroadcastJobs } = require('./src/jobs/broadcastJobs');
    initBroadcastJobs(io);
  } catch (socketErr) {
    console.warn('[Socket] Failed to initialize Socket.io:', socketErr.message);
  }
}

// ── Port binding ─────────────────────────────────────────────────────────────
// A previous instance (or another service) may still hold the requested port.
// The old behaviour was to try ONE fallback port and then process.exit(1) —
// which is what turns a busy port into the proxy's "503 Service Unavailable"
// page. Instead, walk a range of ports and, when every candidate is taken,
// keep retrying with a backoff so the process self-heals as soon as a port
// frees up instead of dying and never coming back.
const net = require('net');
const PORT_SCAN_RANGE = 20;
const PORT_SCAN_RETRY_DELAY_MS = 5000;
const PORT_BIND_STEP_DELAY_MS = 250;
const PORT_PROBE_TIMEOUT_MS = 750;
let portScanCursor = 0;
let portScanPasses = 0;

// A successful listen() does not prove the port was free: Windows lets one
// process hold `::` while another holds `0.0.0.0` on the same port, and the
// stale instance then keeps answering `localhost` while this one believes it
// owns the port (a split-brain that silently serves old code). Probe both
// loopbacks first and treat the port as taken whenever anything answers.
function isPortAccepting(port) {
  const probe = (host) => new Promise((resolve) => {
    const socket = net.connect({ port, host });
    const finish = (busy) => { socket.destroy(); resolve(busy); };
    socket.setTimeout(PORT_PROBE_TIMEOUT_MS, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
  return Promise.all([probe('127.0.0.1'), probe('::1')]).then((hits) => hits[0] || hits[1]);
}

function bindPort(candidate) {
  // Deliberately no host argument: Node then listens on `::` in dual-stack
  // mode so the bind conflicts with an existing `::` listener too.
  server.listen(candidate, () => {
    console.log('====================================================');
    console.log(`  BSC HRMS running on port ${candidate}`);
    console.log(`  Health: http://localhost:${candidate}/health`);
    if (candidate !== PORT) {
      console.warn(`[Server Recovery] Requested port ${PORT} was busy; using ${candidate} instead.`);
    }
    console.log('====================================================');
  });
}

async function scanPorts() {
  const first = PORT;
  if (portScanCursor < first || portScanCursor >= first + PORT_SCAN_RANGE) {
    portScanCursor = first;
    portScanPasses += 1;
    if (portScanPasses > 1) {
      const summary = `[Server] No free port in ${first}-${first + PORT_SCAN_RANGE - 1} at ${new Date().toISOString()}; retrying in ${PORT_SCAN_RETRY_DELAY_MS / 1000}s\n`;
      console.error(summary);
      writeCrashLog(summary);
      setTimeout(() => {
        portScanPasses = 0;
        scanPorts();
      }, PORT_SCAN_RETRY_DELAY_MS);
      return;
    }
  }

  const candidate = portScanCursor++;
  if (await isPortAccepting(candidate)) {
    console.warn(`[Server Recovery] Port ${candidate} is already in use; trying the next one.`);
    setTimeout(scanPorts, PORT_BIND_STEP_DELAY_MS);
    return;
  }
  bindPort(candidate);
}

if (PORT === 'passenger') {
  server.listen('passenger', () => {
    console.log(`====================================================`);
    console.log(`  BSC HRMS running under Phusion Passenger`);
    console.log(`====================================================`);
  });
} else if (isSocketPort) {
  server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`  BSC HRMS running on domain socket: ${PORT}`);
    console.log(`====================================================`);
  });
} else if (!ALLOW_PORT_FALLBACK) {
  server.listen(PORT, () => {
    console.log('====================================================');
    console.log(`  BSC HRMS running on port ${PORT}`);
    console.log(`  Health: http://localhost:${PORT}/health`);
    console.log('====================================================');
  });
} else {
  scanPorts();
}

server.on('error', (err) => {
  const canRecover = ALLOW_PORT_FALLBACK && !isSocketPort && typeof PORT === 'number'
    && (err.code === 'EADDRINUSE' || err.code === 'EACCES' || err.code === 'ENOTSUP');

  if (canRecover) {
    console.warn(`[Server Recovery] ${err.code} while binding; trying the next port.`);
    setTimeout(scanPorts, PORT_BIND_STEP_DELAY_MS);
    return;
  }

  const msg = `[Server listen error] ${new Date().toISOString()} ${err.code} ${err.message}\n`;
  console.error(msg);
  writeCrashLog(msg);

  if (err.code === 'ERR_SERVER_ALREADY_LISTEN') return;

  if (!ALLOW_PORT_FALLBACK && err.code === 'EADDRINUSE') {
    const blocked = `[Server] Port ${PORT} is already held by another process, so this server refused to start on a different one.\n`
      + `[Server] The frontend proxy talks to ${PORT}; starting elsewhere would look like a dead backend (503 / ECONNREFUSED).\n`
      + `[Server] Free the port (stop the older "node index.js") or move both: PORT=5050 with VITE_API_URL=http://localhost:5050\n`;
    console.error(blocked);
    writeCrashLog(blocked);
  }

  process.exit(1);
});

app.server = server;
module.exports = app;
