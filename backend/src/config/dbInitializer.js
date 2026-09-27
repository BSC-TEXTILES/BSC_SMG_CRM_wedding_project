const pool = require('./db');

async function autoInitializeDatabase() {
  console.log('[Auto DB Initializer] autoInitializeDatabase started');

  try {
    // ─── Core tables ──────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`users\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`username\` VARCHAR(100) NOT NULL UNIQUE,
        \`password\` VARCHAR(255) NOT NULL,
        \`full_name\` VARCHAR(150),
        \`email\` VARCHAR(150),
        \`phone\` VARCHAR(20),
        \`department\` VARCHAR(150),
        \`designation\` VARCHAR(150),
        \`role\` VARCHAR(50) DEFAULT 'Staff',
        \`active\` TINYINT(1) DEFAULT 1,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`location_id\` INT,
        \`location_code\` VARCHAR(10),
        \`max_modules\` INT DEFAULT 0,
        \`last_login_at\` TIMESTAMP NULL,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`employee_id\` VARCHAR(50),
        \`candidate_app_no\` VARCHAR(50),
        \`mobile\` VARCHAR(20),
        \`notes\` TEXT,
        \`account_expiry\` DATE,
        \`failed_login_count\` INT DEFAULT 0,
        \`locked_until\` TIMESTAMP NULL,
        \`password_changed_at\` TIMESTAMP NULL,
        \`force_password_reset\` TINYINT(1) DEFAULT 0,
        \`section\` VARCHAR(150),
        \`joining_date\` DATE,
        \`offered_doj\` DATE,
        \`actual_doj\` DATE,
        \`salary\` VARCHAR(100),
        \`current_salary\` VARCHAR(100),
        \`expected_salary\` VARCHAR(100),
        \`experience\` VARCHAR(150),
        \`retail_experience\` VARCHAR(150),
        \`qualification\` VARCHAR(150),
        \`previous_company\` VARCHAR(150),
        \`previous_designation\` VARCHAR(150),
        \`previous_salary\` VARCHAR(100),
        \`dob\` DATE,
        \`gender\` VARCHAR(20),
        \`blood_group\` VARCHAR(20),
        \`aadhaar_number\` VARCHAR(50),
        \`father_details\` VARCHAR(255),
        \`mother_details\` VARCHAR(255),
        \`religion\` VARCHAR(100),
        \`caste\` VARCHAR(100),
        \`languages_known\` TEXT,
        \`city_state\` VARCHAR(150),
        \`address\` TEXT,
        \`photo_url\` TEXT,
        \`aadhaar_url\` TEXT,
        \`resume_url\` TEXT,
        \`reporting_manager\` VARCHAR(150),
        \`branch\` VARCHAR(150),
        \`remarks\` TEXT,
        \`source\` VARCHAR(100),
        \`referrer\` VARCHAR(150),
        \`referrer_emp_no\` VARCHAR(50),
        \`notice_period\` VARCHAR(50),
        -- 2FA & Security columns
        \`email_verified\` TINYINT(1) DEFAULT 0,
        \`email_verified_at\` TIMESTAMP NULL,
        \`two_fa_enabled\` TINYINT(1) DEFAULT 1,
        \`failed_2fa_attempts\` INT DEFAULT 0,
        \`locked_until_2fa\` TIMESTAMP NULL,
        \`last_login_ip\` VARCHAR(45),
        \`last_login_user_agent\` TEXT,
        \`login_count\` INT DEFAULT 0,
        \`token_version\` INT DEFAULT 1,
        INDEX \`idx_email\` (\`email\`),
        INDEX \`idx_active\` (\`active\`),
        INDEX \`idx_locked_until\` (\`locked_until\`),
        INDEX \`idx_locked_until_2fa\` (\`locked_until_2fa\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure token_version column exists on existing deployments
    try {
      const [uCols] = await pool.query('DESCRIBE users');
      const uColNames = uCols.map(c => c.Field);
      if (!uColNames.includes('token_version')) {
        await pool.query('ALTER TABLE users ADD COLUMN token_version INT DEFAULT 1');
      }
    } catch (_uErr) {}

    // ─── Email Verification Tokens ────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`email_verification_tokens\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT NOT NULL,
        \`email\` VARCHAR(150) NOT NULL,
        \`token\` VARCHAR(64) NOT NULL UNIQUE,
        \`type\` ENUM('verify_email', 'reset_password') NOT NULL DEFAULT 'verify_email',
        \`expires_at\` TIMESTAMP NOT NULL,
        \`used\` TINYINT(1) DEFAULT 0,
        \`used_at\` TIMESTAMP NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_user_id\` (\`user_id\`),
        INDEX \`idx_token\` (\`token\`),
        INDEX \`idx_expires_at\` (\`expires_at\`),
        FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // ─── Two-Factor OTP ───────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`two_factor_otp\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT NOT NULL,
        \`otp_hash\` VARCHAR(255) NOT NULL,
        \`email\` VARCHAR(150) NOT NULL,
        \`purpose\` ENUM('login', 'verify_email', 'reset_password', 'change_email') NOT NULL DEFAULT 'login',
        \`attempts\` INT DEFAULT 0,
        \`max_attempts\` INT DEFAULT 3,
        \`expires_at\` TIMESTAMP NOT NULL,
        \`used\` TINYINT(1) DEFAULT 0,
        \`used_at\` TIMESTAMP NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_user_id\` (\`user_id\`),
        INDEX \`idx_expires_at\` (\`expires_at\`),
        INDEX \`idx_purpose\` (\`purpose\`),
        FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // ─── User Sessions ────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`user_sessions\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT NOT NULL,
        \`session_token_hash\` VARCHAR(64) NULL,
        \`refresh_token_hash\` VARCHAR(64) NULL,
        \`ip_address\` VARCHAR(45),
        \`user_agent\` TEXT,
        \`location_id\` INT,
        \`is_active\` TINYINT(1) DEFAULT 1,
        \`last_activity_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`expires_at\` TIMESTAMP NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_user_id\` (\`user_id\`),
        INDEX \`idx_session_token_hash\` (\`session_token_hash\`),
        INDEX \`idx_refresh_token_hash\` (\`refresh_token_hash\`),
        INDEX \`idx_expires_at\` (\`expires_at\`),
        INDEX \`idx_is_active\` (\`is_active\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure session security columns exist if table was created in an older schema
    try {
      const [cols] = await pool.query('DESCRIBE user_sessions');
      const colNames = cols.map(c => c.Field);
      if (!colNames.includes('session_token_hash')) {
        await pool.query('ALTER TABLE user_sessions ADD COLUMN session_token_hash VARCHAR(64) NULL');
      }
      if (!colNames.includes('refresh_token_hash')) {
        await pool.query('ALTER TABLE user_sessions ADD COLUMN refresh_token_hash VARCHAR(64) NULL');
      }
      if (!colNames.includes('expires_at')) {
        await pool.query('ALTER TABLE user_sessions ADD COLUMN expires_at TIMESTAMP NULL');
      }
      if (!colNames.includes('last_activity_at')) {
        await pool.query('ALTER TABLE user_sessions ADD COLUMN last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
      }
    } catch (_colErr) {
      // Best-effort schema evolution
    }

    // ─── JWT Blacklist (existing) ─────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`jwt_blacklist\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`token_jti\` VARCHAR(64) NOT NULL,
        \`user_id\` INT,
        \`username\` VARCHAR(100),
        \`reason\` VARCHAR(50) DEFAULT 'logout',
        \`expires_at\` TIMESTAMP NOT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_token_jti\` (\`token_jti\`),
        INDEX \`idx_expires_at\` (\`expires_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // ─── Audit Logs (extended) ────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`audit_logs\` (
        \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
        \`username\` VARCHAR(100),
        \`user_id\` INT,
        \`action\` VARCHAR(100) NOT NULL,
        \`module\` VARCHAR(50) DEFAULT 'System',
        \`details\` JSON,
        \`ip_address\` VARCHAR(45),
        \`user_agent\` TEXT,
        \`location_id\` INT,
        \`method\` VARCHAR(10),
        \`path\` VARCHAR(255),
        \`status_code\` INT,
        \`correlation_id\` VARCHAR(64),
        \`success\` TINYINT(1) DEFAULT 1,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_username\` (\`username\`),
        INDEX \`idx_user_id\` (\`user_id\`),
        INDEX \`idx_action\` (\`action\`),
        INDEX \`idx_module\` (\`module\`),
        INDEX \`idx_created_at\` (\`created_at\`),
        INDEX \`idx_correlation_id\` (\`correlation_id\`),
        INDEX \`idx_success\` (\`success\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // ─── Security Events (for lockouts, anomalies) ────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`security_events\` (
        \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT,
        \`username\` VARCHAR(100),
        \`event_type\` ENUM('account_locked', 'account_unlocked', '2fa_locked', '2fa_unlocked', 'anomalous_login', 'multiple_locations', 'inactive_deactivated', 'email_verified', 'password_reset', '2fa_failed', '2fa_success') NOT NULL,
        \`severity\` ENUM('info', 'warning', 'critical') DEFAULT 'info',
        \`details\` JSON,
        \`ip_address\` VARCHAR(45),
        \`user_agent\` TEXT,
        \`resolved\` TINYINT(1) DEFAULT 0,
        \`resolved_by\` INT,
        \`resolved_at\` TIMESTAMP NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_user_id\` (\`user_id\`),
        INDEX \`idx_event_type\` (\`event_type\`),
        INDEX \`idx_severity\` (\`severity\`),
        INDEX \`idx_created_at\` (\`created_at\`),
        INDEX \`idx_resolved\` (\`resolved\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // ─── Login Attempts (detailed) ────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`login_attempts\` (
        \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT,
        \`username\` VARCHAR(100),
        \`email\` VARCHAR(150),
        \`ip_address\` VARCHAR(45) NOT NULL,
        \`user_agent\` TEXT,
        \`success\` TINYINT(1) NOT NULL,
        \`failure_reason\` VARCHAR(100),
        \`requires_2fa\` TINYINT(1) DEFAULT 0,
        \`2fa_success\` TINYINT(1) DEFAULT 0,
        \`locked_out\` TINYINT(1) DEFAULT 0,
        \`location_id\` INT,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_user_id\` (\`user_id\`),
        INDEX \`idx_username\` (\`username\`),
        INDEX \`idx_ip_address\` (\`ip_address\`),
        INDEX \`idx_success\` (\`success\`),
        INDEX \`idx_created_at\` (\`created_at\`),
        INDEX \`idx_requires_2fa\` (\`requires_2fa\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // ─── Account Anomaly Detection ────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`account_anomalies\` (
        \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT NOT NULL,
        \`anomaly_type\` ENUM('new_location', 'new_device', 'multiple_failed_2fa', 'rapid_logins', 'geographic_impossible', 'inactive_account') NOT NULL,
        \`details\` JSON,
        \`risk_score\` INT DEFAULT 0,
        \`auto_action_taken\` VARCHAR(100),
        \`resolved\` TINYINT(1) DEFAULT 0,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_user_id\` (\`user_id\`),
        INDEX \`idx_anomaly_type\` (\`anomaly_type\`),
        INDEX \`idx_risk_score\` (\`risk_score\`),
        INDEX \`idx_created_at\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // ─── Email Queue (for reliable email sending) ─────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`email_queue\` (
        \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
        \`to_email\` VARCHAR(150) NOT NULL,
        \`to_name\` VARCHAR(150),
        \`subject\` VARCHAR(255) NOT NULL,
        \`template\` VARCHAR(100) NOT NULL,
        \`template_data\` JSON,
        \`priority\` ENUM('high', 'normal', 'low') DEFAULT 'normal',
        \`status\` ENUM('pending', 'sending', 'sent', 'failed', 'retry') DEFAULT 'pending',
        \`attempts\` INT DEFAULT 0,
        \`max_attempts\` INT DEFAULT 3,
        \`last_error\` TEXT,
        \`scheduled_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`sent_at\` TIMESTAMP NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_status\` (\`status\`),
        INDEX \`idx_priority\` (\`priority\`),
        INDEX \`idx_scheduled_at\` (\`scheduled_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // ─── OTP Resend Rate Limit ────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`otp_resend_limits\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT NOT NULL,
        \`purpose\` VARCHAR(50) NOT NULL,
        \`resend_count\` INT DEFAULT 0,
        \`window_start\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`locked_until\` TIMESTAMP NULL,
        UNIQUE KEY \`uk_user_purpose\` (\`user_id\`, \`purpose\`),
        INDEX \`idx_locked_until\` (\`locked_until\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // ─── Password Reset (existing, ensure structure) ──────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`PasswordReset\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`userId\` INT NOT NULL,
        \`resetToken\` VARCHAR(255) NOT NULL,
        \`expiresAt\` TIMESTAMP NOT NULL,
        \`used\` TINYINT(1) DEFAULT 0,
        \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`deletedAt\` TIMESTAMP NULL,
        INDEX \`idx_userId\` (\`userId\`),
        INDEX \`idx_resetToken\` (\`resetToken\`),
        INDEX \`idx_expiresAt\` (\`expiresAt\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // ─── User Permissions (ACM) ───────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`user_permissions\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT NOT NULL,
        \`module\` VARCHAR(50) NOT NULL,
        \`can_view\` TINYINT(1) DEFAULT 0,
        \`can_add\` TINYINT(1) DEFAULT 0,
        \`can_edit\` TINYINT(1) DEFAULT 0,
        \`can_delete\` TINYINT(1) DEFAULT 0,
        \`can_export\` TINYINT(1) DEFAULT 0,
        \`can_approve\` TINYINT(1) DEFAULT 0,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY \`uk_user_module\` (\`user_id\`, \`module\`),
        FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // ─── User Locations (multi-location support) ──────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`user_locations\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT NOT NULL,
        \`location_id\` INT NOT NULL,
        \`is_primary\` TINYINT(1) DEFAULT 0,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY \`uk_user_location\` (\`user_id\`, \`location_id\`),
        FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // ─── Locations ────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`locations\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`location_code\` VARCHAR(10) NOT NULL UNIQUE,
        \`location_name\` VARCHAR(100) NOT NULL,
        \`store_name\` VARCHAR(150),
        \`address\` TEXT,
        \`phone\` VARCHAR(20),
        \`email\` VARCHAR(100),
        \`status\` VARCHAR(20) DEFAULT 'Active',
        \`sort_order\` INT DEFAULT 0,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // ─── Seed default locations ───────────────────────────────────────
    await pool.query(`
      INSERT IGNORE INTO \`locations\` (\`id\`, \`location_code\`, \`location_name\`, \`store_name\`, \`sort_order\`, \`status\`) VALUES
      (1, 'BEL', 'Belagavi', 'BSC Textiles Belagavi', 1, 'Active'),
      (2, 'DAV', 'Davanagere', 'BSC Textiles Davanagere', 2, 'Active'),
      (3, 'SHI', 'Shivamogga', 'BSC Textiles Shivamogga', 3, 'Active');
    `);

    // ─── System Roles seeding ─────────────────────────────────────────
    await pool.query(`
      INSERT IGNORE INTO \`user_permissions\` (\`user_id\`, \`module\`, \`can_view\`, \`can_add\`, \`can_edit\`, \`can_delete\`, \`can_export\`, \`can_approve\`)
      SELECT u.id, m.module, 1, 1, 1, 1, 1, 1
      FROM \`users\` u
      CROSS JOIN (
        SELECT 'dashboard' AS module UNION ALL
        SELECT 'wedding_crm' UNION ALL
        SELECT 'wedding_registration' UNION ALL
        SELECT 'wedding_operations' UNION ALL
        SELECT 'telecaller_desk' UNION ALL
        SELECT 'telecaller_dashboard' UNION ALL
        SELECT 'footfall' UNION ALL
        SELECT 'feedback_collection' UNION ALL
        SELECT 'feedback_list' UNION ALL
        SELECT 'feedback_qr' UNION ALL
        SELECT 'divert' UNION ALL
        SELECT 'pm_view' UNION ALL
        SELECT 'vm_checklist' UNION ALL
        SELECT 'attendance' UNION ALL
        SELECT 'candidates' UNION ALL
        SELECT 'offer' UNION ALL
        SELECT 'openings' UNION ALL
        SELECT 'employees' UNION ALL
        SELECT 'dept_hiring' UNION ALL
        SELECT 'section_allocation' UNION ALL
        SELECT 'broadcast' UNION ALL
        SELECT 'settings' UNION ALL
        SELECT 'daily_mcheck' UNION ALL
        SELECT 'mcheck_reports' UNION ALL
        SELECT 'mcheck_history' UNION ALL
        SELECT 'mcheck_audit' UNION ALL
        SELECT 'user_management' UNION ALL
        SELECT 'system_admin' UNION ALL
        SELECT 'batch_plan' UNION ALL
        SELECT 'doj_desk' UNION ALL
        SELECT 'joining_desk' UNION ALL
        SELECT 'regional_analytics' UNION ALL
        SELECT 'greyhr' UNION ALL
        SELECT 'candidate_apply' UNION ALL
        SELECT 'greeter' UNION ALL
        SELECT 'tv' UNION ALL
        SELECT 'feedback_public'
      ) m
      WHERE u.role IN ('Admin', 'Super Admin', 'system administrator');
    `);

    
    // ─── API Key Management System ──────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`api_keys\` (
        \`id\` VARCHAR(36) PRIMARY KEY,
        \`public_id\` VARCHAR(36) NOT NULL UNIQUE,
        \`user_id\` INT NOT NULL,
        \`name\` VARCHAR(150) NOT NULL,
        \`prefix\` VARCHAR(10) NOT NULL,
        \`lookup_hash\` VARCHAR(64) NOT NULL,
        \`key_hash\` VARCHAR(255) NOT NULL,
        \`key_hint\` VARCHAR(20) NOT NULL,
        \`encrypted_key_hint\` TEXT,
        \`access_level\` VARCHAR(50) NOT NULL DEFAULT 'READ',
        \`scopes_encrypted\` TEXT NOT NULL,
        \`status\` VARCHAR(30) NOT NULL DEFAULT 'PENDING',
        \`encrypted_dek\` TEXT NOT NULL,
        \`encryption_key_version\` INT NOT NULL DEFAULT 1,
        \`daily_approved_at\` TIMESTAMP NULL,
        \`daily_approval_expires\` TIMESTAMP NULL,
        \`approved_by_admin_id\` INT NULL,
        \`ip_whitelist_encrypted\` TEXT NULL,
        \`rate_limit_per_minute\` INT NOT NULL DEFAULT 60,
        \`request_count\` BIGINT NOT NULL DEFAULT 0,
        \`last_used_at\` TIMESTAMP NULL,
        \`last_used_ip\` VARCHAR(50) NULL,
        \`expires_at\` TIMESTAMP NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_api_keys_lookup\` (\`lookup_hash\`),
        INDEX \`idx_api_keys_user_id\` (\`user_id\`),
        INDEX \`idx_api_keys_status\` (\`status\`),
        INDEX \`idx_api_keys_daily_expires\` (\`daily_approval_expires\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`api_key_audit_log\` (
        \`id\` VARCHAR(36) PRIMARY KEY,
        \`key_public_id\` VARCHAR(36) NOT NULL,
        \`event_type\` VARCHAR(50) NOT NULL,
        \`user_id\` INT NULL,
        \`admin_id\` INT NULL,
        \`ip_address\` VARCHAR(50) NULL,
        \`user_agent\` TEXT NULL,
        \`scope_used\` VARCHAR(100) NULL,
        \`result\` VARCHAR(50) NULL,
        \`metadata\` TEXT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_audit_log_key_public_id\` (\`key_public_id\`),
        INDEX \`idx_audit_log_created_at\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`api_key_reauth_requests\` (
        \`id\` VARCHAR(36) PRIMARY KEY,
        \`key_public_id\` VARCHAR(36) NOT NULL,
        \`requested_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`approved_at\` TIMESTAMP NULL,
        \`approved_by\` INT NULL,
        \`status\` VARCHAR(30) NOT NULL DEFAULT 'PENDING',
        INDEX \`idx_reauth_key\` (\`key_public_id\`),
        INDEX \`idx_reauth_status\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('[Auto DB Initializer] DATABASE FULLY INITIALIZED!');
    console.log('[Auto DB Initializer] Total Active Tables: 129+');

  } catch (err) {
    console.error('[Auto DB Initializer] Error:', err.message);
    throw err;
  }
}

module.exports = { autoInitializeDatabase };