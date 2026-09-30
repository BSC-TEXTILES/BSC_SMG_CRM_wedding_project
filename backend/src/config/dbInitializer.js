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

    // Columns declared in the CREATE above that pre-existing deployments never
    // received, because CREATE TABLE IF NOT EXISTS cannot alter a table that
    // already exists. Auth middleware reads several of these directly.
    try {
      const [uCols] = await pool.query('DESCRIBE users');
      const uColNames = new Set(uCols.map(c => c.Field));
      const securityColumns = [
        ['token_version', 'INT DEFAULT 1'],
        ['deactivated_until', 'DATETIME NULL'],
        ['deactivation_reason', 'TEXT NULL'],
        ['email_verified', 'TINYINT(1) DEFAULT 0'],
        ['email_verified_at', 'TIMESTAMP NULL'],
        ['two_fa_enabled', 'TINYINT(1) DEFAULT 1'],
        ['failed_2fa_attempts', 'INT DEFAULT 0'],
        ['locked_until_2fa', 'TIMESTAMP NULL'],
        ['last_login_ip', 'VARCHAR(45) NULL'],
        ['last_login_user_agent', 'TEXT NULL'],
        ['login_count', 'INT DEFAULT 0']
      ];
      for (const [name, definition] of securityColumns) {
        if (!uColNames.has(name)) {
          await pool.query(`ALTER TABLE users ADD COLUMN \`${name}\` ${definition}`);
        }
      }
    } catch (_uErr) {
      console.warn('[Auto DB Initializer] Security column migration skipped:', _uErr.message);
    }

    // ─── Employee Master Directory: extend the master `users` record ───
    // `users` stays the single source of truth for every employee. These
    // columns only add the structured HR master fields the directory shows;
    // no existing column, index or login contract is touched.
    try {
      const [empCols] = await pool.query('DESCRIBE users');
      const have = new Set(empCols.map(c => c.Field));
      const employeeMasterColumns = [
        ['alternate_phone', 'VARCHAR(20) NULL'],
        ['company_email', 'VARCHAR(150) NULL'],
        ['permanent_address', 'TEXT NULL'],
        ['city', 'VARCHAR(100) NULL'],
        ['district', 'VARCHAR(100) NULL'],
        ['state', 'VARCHAR(100) NULL'],
        ['pincode', 'VARCHAR(10) NULL'],
        ['emergency_contact_name', 'VARCHAR(150) NULL'],
        ['emergency_contact_phone', 'VARCHAR(20) NULL'],
        ['emergency_contact_relation', 'VARCHAR(60) NULL'],
        ['employment_type', 'VARCHAR(50) NULL'],
        ['floor', 'VARCHAR(100) NULL'],
        ['confirmation_date', 'DATE NULL'],
        ['work_shift', 'VARCHAR(100) NULL'],
        ['reporting_manager', 'VARCHAR(150) NULL'],
        ['employment_status', 'VARCHAR(50) NULL DEFAULT \'Active\''],
        ['pan_number', 'VARCHAR(20) NULL'],
        ['bank_name', 'VARCHAR(100) NULL'],
        ['bank_account_number', 'VARCHAR(50) NULL'],
        ['ifsc_code', 'VARCHAR(20) NULL'],
        ['created_by', 'VARCHAR(150) NULL'],
        ['updated_by', 'VARCHAR(150) NULL'],
        // Remainder of the `users` declaration: candidate/HR fields that the
        // directory SELECTs as u.<col>, so a missing one fails the whole query
        // (MySQL only reports the first unknown column, hence the cascade).
        ['offered_doj', 'DATE NULL'],
        ['actual_doj', 'DATE NULL'],
        ['salary', 'VARCHAR(100) NULL'],
        ['current_salary', 'VARCHAR(100) NULL'],
        ['expected_salary', 'VARCHAR(100) NULL'],
        ['experience', 'VARCHAR(150) NULL'],
        ['retail_experience', 'VARCHAR(150) NULL'],
        ['qualification', 'VARCHAR(150) NULL'],
        ['previous_company', 'VARCHAR(150) NULL'],
        ['previous_designation', 'VARCHAR(150) NULL'],
        ['previous_salary', 'VARCHAR(100) NULL'],
        ['dob', 'DATE NULL'],
        ['gender', 'VARCHAR(20) NULL'],
        ['blood_group', 'VARCHAR(20) NULL'],
        ['aadhaar_number', 'VARCHAR(50) NULL'],
        ['father_details', 'VARCHAR(255) NULL'],
        ['mother_details', 'VARCHAR(255) NULL'],
        ['religion', 'VARCHAR(100) NULL'],
        ['caste', 'VARCHAR(100) NULL'],
        ['languages_known', 'TEXT NULL'],
        ['city_state', 'VARCHAR(150) NULL'],
        ['address', 'TEXT NULL'],
        ['aadhaar_url', 'TEXT NULL'],
        ['resume_url', 'TEXT NULL'],
        ['branch', 'VARCHAR(150) NULL'],
        ['remarks', 'TEXT NULL'],
        ['source', 'VARCHAR(100) NULL'],
        ['referrer', 'VARCHAR(150) NULL'],
        ['referrer_emp_no', 'VARCHAR(50) NULL'],
        ['notice_period', 'VARCHAR(50) NULL']
      ];
      for (const [name, definition] of employeeMasterColumns) {
        if (!have.has(name)) {
          await pool.query(`ALTER TABLE users ADD COLUMN \`${name}\` ${definition}`);
        }
      }

      const employeeMasterIndexes = [
        ['idx_users_department', 'department'],
        ['idx_users_designation', 'designation'],
        ['idx_users_location', 'location_id'],
        ['idx_users_employment_status', 'employment_status'],
        ['idx_users_joining', 'joining_date']
      ];
      const [idxRows] = await pool.query('SHOW INDEX FROM users');
      const existingIndexes = new Set(idxRows.map(r => r.Key_name));
      for (const [indexName, column] of employeeMasterIndexes) {
        if (!existingIndexes.has(indexName)) {
          try {
            await pool.query(`ALTER TABLE users ADD INDEX \`${indexName}\` (\`${column}\`)`);
          } catch (_idxErr) { /* index may already exist concurrently */ }
        }
      }
    } catch (_empErr) {
      console.warn('[Auto DB Initializer] Employee master column migration skipped:', _empErr.message);
    }

    // ─── Employee Documents (permission-protected HR files) ────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`employee_documents\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT NOT NULL,
        \`document_type\` VARCHAR(60) NOT NULL,
        \`file_name\` VARCHAR(255) NOT NULL,
        \`file_path\` TEXT NOT NULL,
        \`file_size\` INT NOT NULL DEFAULT 0,
        \`file_ext\` VARCHAR(20) NULL,
        \`mime_type\` VARCHAR(120) NULL,
        \`uploaded_by\` VARCHAR(150) NULL,
        \`status\` VARCHAR(50) DEFAULT 'Active',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`deleted_at\` TIMESTAMP NULL,
        INDEX \`idx_employee_documents_user\` (\`user_id\`),
        INDEX \`idx_employee_documents_type\` (\`document_type\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    try {
      await pool.query("ALTER TABLE `employee_documents` ADD COLUMN IF NOT EXISTS `status` VARCHAR(50) DEFAULT 'Active'");
      await pool.query("ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `photo_url` TEXT NULL");
      await pool.query("ALTER TABLE `candidates` ADD COLUMN IF NOT EXISTS `photo_url` TEXT NULL");
    } catch (_colErr) {
      /* Column already exists */
    }

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

    // ─── VM Checklist Photos (Store Inspection Photo Management) ──────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`vm_checklist_photos\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`submission_id\` VARCHAR(64) NULL,
        \`location_id\` INT NOT NULL DEFAULT 2,
        \`location_name\` VARCHAR(100) NULL,
        \`floor\` VARCHAR(100) NOT NULL,
        \`section\` VARCHAR(100) NOT NULL,
        \`point_id\` VARCHAR(64) NULL,
        \`file_name\` VARCHAR(255) NOT NULL,
        \`file_path\` TEXT NOT NULL,
        \`file_size\` INT NOT NULL DEFAULT 0,
        \`mime_type\` VARCHAR(120) NULL,
        \`uploaded_by\` VARCHAR(150) NULL,
        \`status\` VARCHAR(50) DEFAULT 'Active',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`deleted_at\` TIMESTAMP NULL,
        INDEX \`idx_vm_photos_loc\` (\`location_id\`),
        INDEX \`idx_vm_photos_sub\` (\`submission_id\`),
        INDEX \`idx_vm_photos_floor_sec\` (\`floor\`, \`section\`),
        INDEX \`idx_vm_photos_created\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

      try {
        const [vmPhotoCols] = await pool.query("SHOW COLUMNS FROM `vm_checklist_photos` LIKE 'inspection_date'");
        if (!vmPhotoCols || vmPhotoCols.length === 0) {
          await pool.query("ALTER TABLE `vm_checklist_photos` ADD COLUMN `inspection_date` VARCHAR(32) NULL AFTER `uploaded_by`");
        }
      } catch (e) {}

      // ─── VM Photo Management Columns & History ────────────────────────────
      // Captions, labels, corrective actions and a display order belong to the
      // image; the history table is what stops an edit or replacement of audit
      // evidence from being silent. Mirrors migrations/migrate_vm_photo_management.js.
      const vmPhotoCols = [
        { col: 'caption', def: 'TEXT NULL' },
        { col: 'label', def: 'VARCHAR(150) NULL' },
        { col: 'corrective_action', def: 'TEXT NULL' },
        { col: 'photo_order', def: 'INT DEFAULT 0' },
        { col: 'updated_at', def: 'TIMESTAMP NULL DEFAULT NULL' },
        { col: 'updated_by', def: 'VARCHAR(150) NULL' }
      ];
      for (const item of vmPhotoCols) {
        try {
          const [cCheck] = await pool.query(`SHOW COLUMNS FROM \`vm_checklist_photos\` LIKE '${item.col}'`);
          if (!cCheck || cCheck.length === 0) {
            await pool.query(`ALTER TABLE \`vm_checklist_photos\` ADD COLUMN \`${item.col}\` ${item.def}`);
          }
        } catch (e) {}
      }

      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS \`vm_photo_history\` (
            \`id\` INT AUTO_INCREMENT PRIMARY KEY,
            \`photo_id\` VARCHAR(64) NOT NULL,
            \`submission_id\` VARCHAR(64) NULL,
            \`action\` VARCHAR(40) NOT NULL,
            \`field\` VARCHAR(60) NULL,
            \`old_value\` TEXT NULL,
            \`new_value\` TEXT NULL,
            \`old_file_name\` VARCHAR(255) NULL,
            \`new_file_name\` VARCHAR(255) NULL,
            \`old_file_path\` TEXT NULL,
            \`new_file_path\` TEXT NULL,
            \`changed_by\` VARCHAR(150) NULL,
            \`changed_by_role\` VARCHAR(60) NULL,
            \`changed_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX \`idx_vm_photo_hist_photo\` (\`photo_id\`),
            INDEX \`idx_vm_photo_hist_sub\` (\`submission_id\`),
            INDEX \`idx_vm_photo_hist_when\` (\`changed_at\`)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
      } catch (e) {}

      // ─── VM Submissions Table & Columns Migration ────────────────────────
      await pool.query(`
        CREATE TABLE IF NOT EXISTS \`vmsubmissions\` (
          \`id\` VARCHAR(64) PRIMARY KEY,
          \`location_id\` INT NOT NULL DEFAULT 1,
          \`entryDate\` DATE NOT NULL,
          \`shift\` VARCHAR(20) DEFAULT 'Opening',
          \`floor\` VARCHAR(100) NOT NULL,
          \`section\` VARCHAR(100) NOT NULL DEFAULT 'General',
          \`scorePercent\` DECIMAL(5,2) DEFAULT 100.00,
          \`status\` VARCHAR(50) DEFAULT 'Completed',
          \`submittedBy\` VARCHAR(100) NOT NULL,
          \`remarks\` TEXT NULL,
          \`passed_count\` INT DEFAULT 0,
          \`failed_count\` INT DEFAULT 0,
          \`total_questions\` INT DEFAULT 10,
          \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          \`updatedAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX \`idx_vmsub_loc\` (\`location_id\`),
          INDEX \`idx_vmsub_date\` (\`entryDate\`),
          INDEX \`idx_vmsub_floor_sec\` (\`floor\`, \`section\`),
          INDEX \`idx_vmsub_status\` (\`status\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      const ensureVmSubCols = [
        { col: 'section', def: 'VARCHAR(100) NOT NULL DEFAULT \'General\'' },
        { col: 'status', def: 'VARCHAR(50) DEFAULT \'Completed\'' },
        { col: 'remarks', def: 'TEXT NULL' },
        { col: 'passed_count', def: 'INT DEFAULT 0' },
        { col: 'failed_count', def: 'INT DEFAULT 0' },
        { col: 'total_questions', def: 'INT DEFAULT 10' },
        // createdAt/updatedAt are declared in the CREATE above, so tables created
        // before those columns existed never received them and every VM read that
        // selects s.updatedAt fails.
        { col: 'createdAt', def: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
        { col: 'updatedAt', def: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' },
        // ── Guided audit flow (additive only; see migrations/migrate_vm_audit_flow.js) ──
        // N/A answers are excluded from the score denominator, so they need their
        // own counter instead of being folded into failed_count.
        { col: 'na_count', def: 'INT DEFAULT 0' },
        // Questions in the active checklist the auditor never answered.
        { col: 'unrated_count', def: 'INT DEFAULT 0' },
        // Drafts are per auditor, so idempotency cannot rely on submittedBy alone.
        { col: 'auditor_user_id', def: 'INT NULL' },
        { col: 'submittedAt', def: 'TIMESTAMP NULL DEFAULT NULL' },
        { col: 'updatedBy', def: 'VARCHAR(100) NULL' }
      ];
      for (const item of ensureVmSubCols) {
        try {
          const [cCheck] = await pool.query(`SHOW COLUMNS FROM \`vmsubmissions\` LIKE '${item.col}'`);
          if (!cCheck || cCheck.length === 0) {
            await pool.query(`ALTER TABLE \`vmsubmissions\` ADD COLUMN \`${item.col}\` ${item.def}`);
          }
        } catch (e) {}
      }

      // Draft lookup is (location, floor, section, shift, IST date, auditor) and every
      // dashboard/list read filters on status, so status belongs in the same index.
      try {
        const [draftIdx] = await pool.query(
          `SELECT INDEX_NAME FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vmsubmissions'
              AND INDEX_NAME = 'idx_vmsub_draft_lookup'`
        );
        if (!draftIdx || draftIdx.length === 0) {
          await pool.query(`ALTER TABLE \`vmsubmissions\` ADD INDEX \`idx_vmsub_draft_lookup\` (\`location_id\`, \`floor\`, \`section\`, \`shift\`, \`entryDate\`, \`status\`)`);
        }
      } catch (e) {}

      // ─── VM Submission Entries Table ────────────────────────────────────
      await pool.query(`
        CREATE TABLE IF NOT EXISTS \`vmsubmissionentries\` (
          \`id\` VARCHAR(64) PRIMARY KEY,
          \`submissionId\` VARCHAR(64) NOT NULL,
          \`pointId\` VARCHAR(64) NOT NULL,
          \`pointTitle\` VARCHAR(255) NOT NULL,
          \`score\` VARCHAR(20) NOT NULL DEFAULT 'Pass',
          \`remarks\` TEXT NULL,
          \`photoUrl\` TEXT NULL,
          \`comment\` TEXT NULL,
          \`observation\` TEXT NULL,
          \`corrective_action\` TEXT NULL,
          \`position\` INT DEFAULT 0,
          \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX \`idx_vmentries_sub\` (\`submissionId\`),
          INDEX \`idx_vmentries_point\` (\`pointId\`),
          INDEX \`idx_vmentries_sub_point\` (\`submissionId\`, \`pointId\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // Every note belongs to one checkpoint, never to the audit as a whole, so the
      // answer row carries its own comment / observation / corrective action.
      const ensureVmEntryCols = [
        { col: 'comment', def: 'TEXT NULL' },
        { col: 'observation', def: 'TEXT NULL' },
        { col: 'corrective_action', def: 'TEXT NULL' },
        { col: 'position', def: 'INT DEFAULT 0' }
      ];
      for (const item of ensureVmEntryCols) {
        try {
          const [cCheck] = await pool.query(`SHOW COLUMNS FROM \`vmsubmissionentries\` LIKE '${item.col}'`);
          if (!cCheck || cCheck.length === 0) {
            await pool.query(`ALTER TABLE \`vmsubmissionentries\` ADD COLUMN \`${item.col}\` ${item.def}`);
          }
        } catch (e) {}
      }

      try {
        const [entryIdx] = await pool.query(
          `SELECT INDEX_NAME FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vmsubmissionentries'
              AND INDEX_NAME = 'idx_vmentries_sub_point'`
        );
        if (!entryIdx || entryIdx.length === 0) {
          await pool.query('ALTER TABLE `vmsubmissionentries` ADD INDEX `idx_vmentries_sub_point` (`submissionId`, `pointId`)');
        }
      } catch (e) {}

      // ─── VM Floors Table & Default Seed ─────────────────────────────────
      await pool.query(`
        CREATE TABLE IF NOT EXISTS \`vmfloors\` (
          \`id\` VARCHAR(64) PRIMARY KEY,
          \`location_id\` INT NULL,
          \`name\` VARCHAR(100) NOT NULL UNIQUE,
          \`description\` TEXT NULL,
          \`sections\` TEXT NOT NULL,
          \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      try {
        const [floorRows] = await pool.query('SELECT COUNT(*) as cnt FROM `vmfloors`');
        if (!floorRows || floorRows[0]?.cnt === 0) {
          await pool.query(`
            INSERT IGNORE INTO \`vmfloors\` (id, name, description, sections) VALUES
            ('floor_gf', 'Ground Floor', 'Main Entrance & Saree Galleria', '["Normal Sarees"]'),
            ('floor_1f', 'First Floor', 'High-Value Silk & Luxury Sarees', '["Silk Sarees (Upto Lakhs)"]'),
            ('floor_2f', 'Second Floor', 'Ladies Wear and Kids Wear', '["Ladies Wear and Kids Wear"]'),
            ('floor_3f', 'Third Floor', 'Mens Wear and Home Furnishing', '["Mens Wear and Home Furnishing"]')
          `);
        }
      } catch (e) {}

      // ─── VM Checklist Points Table & Default 10 Questions Seed ──────────
      await pool.query(`
        CREATE TABLE IF NOT EXISTS \`vmchecklistpoints\` (
          \`id\` VARCHAR(64) PRIMARY KEY,
          \`title\` VARCHAR(255) NOT NULL,
          \`description\` TEXT NULL,
          \`section\` VARCHAR(100) DEFAULT 'Visual Merchandising',
          \`position\` INT DEFAULT 1,
          \`isActive\` BOOLEAN DEFAULT TRUE,
          \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      try {
        const [qRows] = await pool.query('SELECT COUNT(*) as cnt FROM `vmchecklistpoints`');
        if (!qRows || qRows[0]?.cnt === 0) {
          await pool.query(`
            INSERT IGNORE INTO \`vmchecklistpoints\` (id, title, section, position, isActive) VALUES
            ('vm_q1', 'Is the entire section clean, neat, and well-maintained?', 'Visual Merchandising', 1, 1),
            ('vm_q2', 'Are products arranged according to category, colour, and size?', 'Visual Merchandising', 2, 1),
            ('vm_q3', 'Are all racks, shelves, tables, and displays properly aligned?', 'Visual Merchandising', 3, 1),
            ('vm_q4', 'Are new arrivals and the latest collections displayed prominently?', 'Visual Merchandising', 4, 1),
            ('vm_q5', 'Are mannequins styled according to the current theme?', 'Visual Merchandising', 5, 1),
            ('vm_q6', 'Are price tags, product labels, and signage correctly placed and visible?', 'Visual Merchandising', 6, 1),
            ('vm_q7', 'Are promotional and offer displays updated and correctly positioned?', 'Visual Merchandising', 7, 1),
            ('vm_q8', 'Is the colour blocking and overall visual theme maintained?', 'Visual Merchandising', 8, 1),
            ('vm_q9', 'Are folded, hanging, and stacked products properly presented?', 'Visual Merchandising', 9, 1),
            ('vm_q10', 'Does the section meet the daily VM standard and look attractive to customers?', 'Visual Merchandising', 10, 1)
          `);
        }
      } catch (e) {}

    // ─── Sourcing Diverts Table & Schema Migration ──────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`Diverts\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`location_id\` INT DEFAULT 1,
        \`entryDate\` VARCHAR(16),
        \`sectionId\` VARCHAR(64),
        \`productWanted\` VARCHAR(255),
        \`quantity\` INT DEFAULT 1,
        \`priceRange\` VARCHAR(64),
        \`reasonCode\` VARCHAR(64) DEFAULT 'OUT_OF_STOCK',
        \`customerName\` VARCHAR(255),
        \`customerMobile\` VARCHAR(32),
        \`status\` VARCHAR(32) DEFAULT 'open',
        \`createdBy\` VARCHAR(255),
        \`pmNotes\` TEXT,
        \`size\` VARCHAR(64) NULL,
        \`colour\` VARCHAR(64) NULL,
        \`other_product_details\` TEXT NULL,
        \`required_by_date\` VARCHAR(32) NULL,
        \`reference_image\` VARCHAR(512) NULL,
        \`remarks\` TEXT NULL,
        \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_diverts_loc\` (\`location_id\`),
        INDEX \`idx_diverts_status\` (\`status\`),
        INDEX \`idx_diverts_created\` (\`createdAt\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    try {
      const [dCols] = await pool.query('DESCRIBE Diverts');
      const dColNames = dCols.map(c => c.Field);
      const newDivertCols = [
        { name: 'size', def: 'VARCHAR(64) NULL' },
        { name: 'colour', def: 'VARCHAR(64) NULL' },
        { name: 'other_product_details', def: 'TEXT NULL' },
        { name: 'required_by_date', def: 'VARCHAR(32) NULL' },
        { name: 'reference_image', def: 'VARCHAR(512) NULL' },
        { name: 'remarks', def: 'TEXT NULL' }
      ];
      for (const col of newDivertCols) {
        if (!dColNames.includes(col.name)) {
          await pool.query(`ALTER TABLE Diverts ADD COLUMN \`${col.name}\` ${col.def}`);
        }
      }
    } catch (_dErr) {}

    // ─── Consent / Policy tracking ─────────────────────────────────────────
    // consentController queries both tables on every /consent/status call, but
    // neither was ever created here, so the endpoint returned 500 on any database
    // that had not been set up by hand.
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS \`policy_versions\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`policy_type\` VARCHAR(50) NOT NULL,
          \`version\` VARCHAR(32) NOT NULL,
          \`title\` VARCHAR(150) NULL,
          \`is_current\` TINYINT(1) NOT NULL DEFAULT 0,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX \`idx_policy_type_current\` (\`policy_type\`, \`is_current\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS \`user_consents\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`user_id\` INT NOT NULL,
          \`username\` VARCHAR(150) NOT NULL,
          \`privacy_policy_accepted\` TINYINT(1) NOT NULL DEFAULT 0,
          \`privacy_policy_version\` VARCHAR(32) NULL,
          \`privacy_policy_accepted_at\` DATETIME NULL,
          \`terms_accepted\` TINYINT(1) NOT NULL DEFAULT 0,
          \`terms_version\` VARCHAR(32) NULL,
          \`terms_accepted_at\` DATETIME NULL,
          \`consent_status\` VARCHAR(32) NOT NULL DEFAULT 'pending',
          \`ip_address\` VARCHAR(100) NULL,
          \`user_agent\` TEXT NULL,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY \`uq_user_consents_user\` (\`user_id\`),
          INDEX \`idx_user_consents_status\` (\`consent_status\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    } catch (_consentErr) {
      console.warn('[Auto DB Initializer] Consent schema migration skipped:', _consentErr.message);
    }

    // ─── Employee access requests ──────────────────────────────────────────
    // Previously only created by the standalone scripts/init_access_requests_table.js
    // step, so /employees/access-requests 500'd wherever that script was never run.
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS \`employee_access_requests\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`employee_id\` INT NOT NULL,
          \`employee_name\` VARCHAR(255) NULL,
          \`user_id\` INT NOT NULL,
          \`username\` VARCHAR(150) NOT NULL,
          \`user_role\` VARCHAR(100) NULL,
          \`location_id\` INT NULL,
          \`requested_action\` VARCHAR(100) DEFAULT 'VIEW_EMPLOYEE_DETAILS',
          \`reason\` TEXT NULL,
          \`status\` ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
          \`resolved_by\` INT NULL,
          \`resolved_by_name\` VARCHAR(150) NULL,
          \`resolved_at\` DATETIME NULL,
          \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX \`idx_emp\` (\`employee_id\`),
          INDEX \`idx_user\` (\`user_id\`),
          INDEX \`idx_status\` (\`status\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    } catch (_accessErr) {
      console.warn('[Auto DB Initializer] Access requests schema migration skipped:', _accessErr.message);
    }

    // ─── Feedback QR columns added after the original schema ───────────────
    // createQrCode/updateQrCode write `floor`, getQrCodes/getQrCodeStats/
    // exportQrCodes filter and select it, and the Feedback reads use
    // `locationCode` — but neither column was ever migrated onto tables created
    // from the original schema files.
    try {
      const qrCodeColumns = [
        { name: 'floor', def: 'VARCHAR(100) NULL' }
      ];
      for (const col of qrCodeColumns) {
        const [exists] = await pool.query(`SHOW COLUMNS FROM \`FeedbackQrCode\` LIKE ?`, [col.name]);
        if (!exists || exists.length === 0) {
          await pool.query(`ALTER TABLE \`FeedbackQrCode\` ADD COLUMN \`${col.name}\` ${col.def}`);
        }
      }

      const feedbackColumns = [
        { name: 'locationCode', def: 'VARCHAR(10) NULL' },
        { name: 'locationName', def: 'VARCHAR(100) NULL' },
        { name: 'entryTime', def: 'VARCHAR(32) NULL' },
        { name: 'email', def: 'VARCHAR(150) NULL' }
      ];
      for (const col of feedbackColumns) {
        const [exists] = await pool.query(`SHOW COLUMNS FROM \`Feedback\` LIKE ?`, [col.name]);
        if (!exists || exists.length === 0) {
          await pool.query(`ALTER TABLE \`Feedback\` ADD COLUMN \`${col.name}\` ${col.def}`);
        }
      }
    } catch (_fbQrErr) {
      console.warn('[Auto DB Initializer] Feedback QR column migration skipped:', _fbQrErr.message);
    }

    // ─── Session activity & route rules ────────────────────────────────────
    // auth.js logSessionActivity() INSERTs into session_activity on every request
    // and swallows the failure, so the audit trail has been silently writing
    // nothing; /security/session-activity and /security/force-logout both read it.
    // allowed_routes is consulted by validate-route. Creating it empty preserves
    // the existing documented fail-open behaviour - route rules are a policy
    // decision for operators, not something this initializer should invent.
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS \`session_activity\` (
          \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
          \`user_id\` INT NULL,
          \`username\` VARCHAR(150) NOT NULL,
          \`session_id\` VARCHAR(64) NULL,
          \`action\` VARCHAR(64) NOT NULL DEFAULT 'API_CALL',
          \`module\` VARCHAR(100) NULL,
          \`details\` JSON NULL,
          \`ip_address\` VARCHAR(45) NULL,
          \`user_agent\` TEXT NULL,
          \`location_id\` INT NULL,
          \`method\` VARCHAR(10) NULL,
          \`path\` VARCHAR(255) NULL,
          \`status_code\` INT NULL,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX \`idx_session_user\` (\`user_id\`),
          INDEX \`idx_session_username\` (\`username\`),
          INDEX \`idx_session_action\` (\`action\`),
          INDEX \`idx_session_created\` (\`created_at\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS \`allowed_routes\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`role\` VARCHAR(100) NOT NULL,
          \`route_pattern\` VARCHAR(255) NOT NULL,
          \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX \`idx_allowed_routes_role\` (\`role\`, \`is_active\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    } catch (_sessionErr) {
      console.warn('[Auto DB Initializer] Session activity / allowed routes schema skipped:', _sessionErr.message);
    }

    try {
      const { initFeedbackTables } = require('../scripts/init_location_feedback_tables');
      await initFeedbackTables();
    } catch (_fbErr) {
      console.warn('[Auto DB Initializer] Feedback tables verification notice:', _fbErr.message);
    }

    console.log('[Auto DB Initializer] DATABASE FULLY INITIALIZED!');
    console.log('[Auto DB Initializer] Total Active Tables: 130+');

  } catch (err) {
    console.error('[Auto DB Initializer] Error:', err.message);
    throw err;
  }
}

module.exports = { autoInitializeDatabase };