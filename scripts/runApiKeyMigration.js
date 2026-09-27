const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });
const pool = require('../backend/src/config/db');

async function migrate() {
  try {
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

    console.log('API Key tables created successfully in database');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
