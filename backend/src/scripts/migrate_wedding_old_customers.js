require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const pool = require('../config/db');

async function migrate() {
  console.log('[Migration] Starting Old Customers migration on wedding_customers...');
  const statements = [
    "ALTER TABLE `wedding_customers` ADD COLUMN `lifecycle_status` VARCHAR(50) NOT NULL DEFAULT 'ACTIVE'",
    "ALTER TABLE `wedding_customers` ADD COLUMN `archived_at` DATETIME NULL",
    "ALTER TABLE `wedding_customers` ADD COLUMN `archived_by` VARCHAR(150) NULL",
    "ALTER TABLE `wedding_customers` ADD COLUMN `archived_by_user_id` INT NULL",
    "ALTER TABLE `wedding_customers` ADD COLUMN `archive_reason` TEXT NULL",
    "ALTER TABLE `wedding_customers` ADD COLUMN `previous_status` VARCHAR(50) NULL",
    "ALTER TABLE `wedding_customers` ADD INDEX `idx_wed_lifecycle` (`lifecycle_status`)",
    "ALTER TABLE `wedding_customers` ADD INDEX `idx_wed_archived_at` (`archived_at`)"
  ];

  for (const sql of statements) {
    try {
      await pool.query(sql);
      console.log('✓ Executed:', sql);
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_DUP_KEYNAME') {
        console.log('- Already exists:', sql);
      } else {
        console.warn('! Notice on SQL:', sql, err.message);
      }
    }
  }

  // Ensure default lifecycle_status is ACTIVE for any existing NULL values
  try {
    const [res] = await pool.query("UPDATE `wedding_customers` SET `lifecycle_status` = 'ACTIVE' WHERE `lifecycle_status` IS NULL");
    console.log(`✓ Set default ACTIVE lifecycle for ${res.affectedRows || 0} existing records`);
  } catch (e) {
    console.warn('! Notice setting defaults:', e.message);
  }

  console.log('[Migration] Old Customers schema migration completed successfully.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('[Migration Error]', err);
  process.exit(1);
});
