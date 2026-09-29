/**
 * Migration: Advanced Telecaller Workspace & Wedding CRM Authority Upgrade
 * - Adds last_contacted_by, last_contacted_by_user_id, last_updated_by, last_updated_by_user_id to wedding_customers
 * - Creates wedding_whatsapp_logs table
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const pool = require('../config/db');

async function migrate() {
  console.log('[Migration] Starting Telecaller Workspace Migration...');
  const conn = await pool.getConnection();

  try {
    // 1. Check existing columns in wedding_customers
    const [cols] = await conn.query('DESCRIBE wedding_customers');
    const existing = new Set(cols.map(c => c.Field));

    const columnsToAdd = [
      { name: 'last_contacted_by', def: 'VARCHAR(150) NULL' },
      { name: 'last_contacted_by_user_id', def: 'INT NULL' },
      { name: 'last_updated_by', def: 'VARCHAR(150) NULL' },
      { name: 'last_updated_by_user_id', def: 'INT NULL' }
    ];

    for (const col of columnsToAdd) {
      if (!existing.has(col.name)) {
        console.log(`[Migration] Adding column ${col.name} to wedding_customers...`);
        await conn.query(`ALTER TABLE wedding_customers ADD COLUMN \`${col.name}\` ${col.def}`);
      } else {
        console.log(`[Migration] Column ${col.name} already exists in wedding_customers.`);
      }
    }

    // 2. Create wedding_whatsapp_logs table if not exists
    console.log('[Migration] Ensuring wedding_whatsapp_logs table...');
    await conn.query(`
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

    console.log('[Migration] Telecaller Workspace Migration completed successfully!');
  } catch (err) {
    console.error('[Migration Error]', err);
    throw err;
  } finally {
    conn.release();
    process.exit(0);
  }
}

migrate().catch(() => process.exit(1));
