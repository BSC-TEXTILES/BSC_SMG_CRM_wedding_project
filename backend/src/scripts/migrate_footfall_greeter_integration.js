require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const db = require('../config/db');

/**
 * Greeter Kiosk <-> Hourly Footfall integration.
 *
 * The kiosk already wrote to `footfallentries`, but the table could not answer
 * "where did this come from" or "who corrected it": the kiosk stuffed its origin
 * into `remarks` and every write overwrote the row with no trace. These columns
 * make origin and editing auditable without touching the visitor counts.
 */
const COLUMNS = [
  "ALTER TABLE `footfallentries` ADD COLUMN `entry_source` VARCHAR(30) NULL AFTER `submittedBy`",
  "ALTER TABLE `footfallentries` ADD COLUMN `created_by` VARCHAR(150) NULL AFTER `entry_source`",
  "ALTER TABLE `footfallentries` ADD COLUMN `created_by_role` VARCHAR(60) NULL AFTER `created_by`",
  "ALTER TABLE `footfallentries` ADD COLUMN `updated_by` VARCHAR(150) NULL AFTER `created_by_role`",
  "ALTER TABLE `footfallentries` ADD COLUMN `updated_by_role` VARCHAR(60) NULL AFTER `updated_by`"
];

async function addColumns() {
  for (const sql of COLUMNS) {
    try {
      await db.query(sql);
      console.log('+', sql.replace('ALTER TABLE `footfallentries` ADD COLUMN ', ''));
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') console.log('- already present');
      else console.warn('! notice:', err.message);
    }
  }
}

/**
 * One-time classification of rows written before `entry_source` existed.
 * The kiosk's only origin signal was its remarks string, so that is what we use.
 */
async function backfillSource() {
  const [pending] = await db.query('SELECT COUNT(*) n FROM footfallentries WHERE entry_source IS NULL');
  if (!pending[0].n) {
    console.log('- no rows need a source');
    return;
  }

  await db.query(`
    UPDATE footfallentries
    SET entry_source = 'Greeter Kiosk',
        created_by = COALESCE(submittedBy, 'Greeter')
    WHERE entry_source IS NULL
      AND (remarks = 'Greeter Entrance Kiosk' OR LOWER(COALESCE(remarks,'')) LIKE '%kiosk%' OR submittedBy = 'Greeter')
  `);
  await db.query(`
    UPDATE footfallentries
    SET entry_source = 'Admin Entry',
        created_by = COALESCE(submittedBy, 'Staff')
    WHERE entry_source IS NULL
  `);

  const [after] = await db.query('SELECT entry_source, COUNT(*) n FROM footfallentries GROUP BY entry_source');
  console.log('+ source backfilled:', JSON.stringify(after));
}

async function createHistoryTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS \`footfall_edit_history\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`entry_id\` VARCHAR(50) NOT NULL,
      \`location_id\` INT NULL,
      \`entryDate\` DATE NULL,
      \`slotHour\` INT NULL,
      \`field_changed\` VARCHAR(60) NOT NULL,
      \`old_value\` VARCHAR(255) NULL,
      \`new_value\` VARCHAR(255) NULL,
      \`action\` VARCHAR(30) NOT NULL DEFAULT 'Edited',
      \`edited_by\` VARCHAR(150) NOT NULL,
      \`edited_by_role\` VARCHAR(60) NULL,
      \`reason\` VARCHAR(255) NULL,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_fe_entry\` (\`entry_id\`),
      INDEX \`idx_fe_loc_date\` (\`location_id\`, \`entryDate\`),
      INDEX \`idx_fe_created\` (\`created_at\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('+ footfall_edit_history ready');
}

async function showIndexes() {
  const [idx] = await db.query(`
    SELECT INDEX_NAME nm, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) cols, NON_UNIQUE nu
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'footfallentries'
    GROUP BY INDEX_NAME, NON_UNIQUE`);
  console.log('indexes:', idx.map(r => `${r.nm}(${r.cols})${r.nu ? '' : ' UNIQUE'}`).join(' | '));
  if (idx.some(r => r.cols === 'entryDate,slotHour')) {
    console.warn('! legacy UNIQUE (entryDate, slotHour) still present — cross-store overwrite bug');
  }
}

async function run() {
  console.log('[Migration] Greeter Kiosk <-> Footfall integration...');
  await addColumns();
  await backfillSource();
  await createHistoryTable();
  await showIndexes();
  console.log('[Migration] Complete. No visitor counts were altered.');
  process.exit(0);
}

run().catch(e => { console.error('[Migration Error]', e.message); process.exit(1); });
