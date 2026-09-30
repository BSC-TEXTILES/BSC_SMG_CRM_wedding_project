/**
 * VM audit photos — captions, ordering, and a management audit trail.
 *
 * Standalone and idempotent: every statement is guarded by a presence check, so a
 * re-run changes nothing. Additive ONLY — no column is dropped, renamed or widened
 * and no existing row is touched, so photos already on file keep working while the
 * old server build is still running.
 *
 *   node backend/migrations/migrate_vm_photo_management.js
 *
 * The same DDL also lives in src/config/dbInitializer.js so a cold start converges.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../src/config/db');

const PHOTO_COLUMNS = [
  // §27 an observation belongs to the image, not to a general audit note.
  { col: 'caption', def: 'TEXT NULL' },
  // §14 a short human label ("Rack 4 - before") alongside the caption.
  { col: 'label', def: 'VARCHAR(150) NULL' },
  // §14 the corrective action a photo documents.
  { col: 'corrective_action', def: 'TEXT NULL' },
  // §8 display sequence inside one audit/section; ordering must survive a refresh.
  { col: 'photo_order', def: 'INT DEFAULT 0' },
  // §8 "updated date" — soft deletes and edits both stamp this.
  { col: 'updated_at', def: 'TIMESTAMP NULL DEFAULT NULL' },
  { col: 'updated_by', def: 'VARCHAR(150) NULL' }
];

async function columnExists(table, column) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return Number(rows[0]?.n) > 0;
}

async function ensureColumn(table, column, definition) {
  if (await columnExists(table, column)) {
    console.log(`  = ${table}.${column} already present`);
    return false;
  }
  await db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  console.log(`  + ${table}.${column}`);
  return true;
}

(async () => {
  console.log('[VM Photo Migration] start');

  for (const item of PHOTO_COLUMNS) {
    await ensureColumn('vm_checklist_photos', item.col, item.def);
  }

  // §16 management actions on evidence must never be silent: every upload, edit,
  // replacement and delete leaves a row here, including which file was swapped for
  // which. History is append-only — nothing in the app deletes from it.
  await db.query(`
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
  console.log('  + vm_photo_history (created if absent)');

  // §23 the admin gallery filters by shift and audit score, both of which live on
  // vmsubmissions; this index is what keeps that join cheap.
  try {
    const [idx] = await db.query(
      `SELECT COUNT(*) n FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vm_checklist_photos' AND INDEX_NAME = 'idx_vm_photos_sub'`
    );
    console.log(Number(idx[0].n) > 0 ? '  = idx_vm_photos_sub present' : '  ! idx_vm_photos_sub missing (submission_id is filtered on)');
  } catch (e) { /* index reporting only */ }

  const [cols] = await db.query(
    `SELECT COLUMN_NAME n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vm_checklist_photos'`
  );
  const [hist] = await db.query(
    `SELECT COUNT(*) n FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vm_photo_history'`
  );
  console.log('[VM Photo Migration] columns:', cols.map((c) => c.n).join(', '));
  console.log('[VM Photo Migration] history table rows exist:', Number(hist[0].n) === 1);
  console.log('[VM Photo Migration] done');

  await db.end();
  process.exit(0);
})().catch((err) => {
  console.error('[VM Photo Migration] FAILED:', err.message);
  process.exit(1);
});
