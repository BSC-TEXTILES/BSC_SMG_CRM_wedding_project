require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const db = require('../config/db');

/**
 * FootfallEntries historically had UNIQUE (entryDate, slotHour). The store-ops
 * migration added UNIQUE (location_id, entryDate, slotHour) but left the old key
 * in place. ON DUPLICATE KEY UPDATE fires on *any* unique key, so a save for one
 * store silently overwrote another store's row for the same hour — and the
 * overwriting store saw nothing at all. Only the old key is dropped; no rows are
 * touched.
 */
async function dropLegacyUniqueKey() {
  const [idx] = await db.query(`
    SELECT INDEX_NAME nm, NON_UNIQUE nu,
           GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) cols
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'FootfallEntries'
    GROUP BY INDEX_NAME, NON_UNIQUE
  `);

  const legacy = idx.filter((r) => r.nu === 0 && r.nm !== 'PRIMARY' && r.cols === 'entryDate,slotHour');
  if (!legacy.length) {
    console.log('- legacy (entryDate, slotHour) unique key already absent');
    return false;
  }

  for (const r of legacy) {
    await db.query(`ALTER TABLE FootfallEntries DROP INDEX \`${r.nm}\``);
    console.log(`+ dropped legacy unique key ${r.nm} (${r.cols})`);
  }
  return true;
}

async function ensureCompoundKey() {
  const [idx] = await db.query(`
    SELECT INDEX_NAME nm, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) cols
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'FootfallEntries'
    GROUP BY INDEX_NAME
  `);
  const hasCompound = idx.some((r) => r.cols === 'location_id,entryDate,slotHour');
  if (hasCompound) {
    console.log('- compound (location_id, entryDate, slotHour) key already present');
    return;
  }

  // Rows that already collide across stores on the same hour cannot be separated
  // automatically, so surface them instead of guessing which store owned them.
  const [clash] = await db.query(`
    SELECT entryDate, slotHour, COUNT(*) n, GROUP_CONCAT(CONCAT(location_id, ':', visitors)) detail
    FROM FootfallEntries
    WHERE location_id IS NULL
    GROUP BY entryDate, slotHour HAVING n > 1
  `);
  if (clash.length) console.warn('! rows with NULL location sharing an hour:', JSON.stringify(clash));

  await db.query('ALTER TABLE FootfallEntries ADD UNIQUE KEY idx_loc_date_slot (location_id, entryDate, slotHour)');
  console.log('+ added compound unique key idx_loc_date_slot (location_id, entryDate, slotHour)');
}

async function migrate() {
  console.log('[Migration] Footfall per-store uniqueness fix...');
  const [tables] = await db.query(`
    SELECT TABLE_NAME t FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('FootfallEntries','footfallentries')
  `);
  if (!tables.length) {
    console.error('FootfallEntries table not found — aborting.');
    process.exit(1);
  }
  await dropLegacyUniqueKey();
  await ensureCompoundKey();
  console.log('[Migration] Complete. Existing rows were not modified.');
  process.exit(0);
}

migrate().catch((e) => { console.error('[Migration Error]', e.message); process.exit(1); });
