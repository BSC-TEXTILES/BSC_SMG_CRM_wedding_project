/**
 * VM Checklist — guided audit flow schema.
 *
 * Standalone, idempotent migration for the redesigned audit flow. Safe to re-run:
 * every statement is either guarded by a presence check or swallowed on the
 * "already exists" MySQL error code, so a second pass changes nothing.
 *
 * Additive ONLY. No column is dropped, renamed or widened and no row is touched,
 * so the audit history already in `vmsubmissions` survives the rollout and the
 * running server keeps serving the old columns throughout.
 *
 *   node backend/migrations/migrate_vm_audit_flow.js
 *
 * The same DDL also lives in src/config/dbInitializer.js (SHOW COLUMNS + ALTER
 * guard), which is what makes a cold-start / zero-downtime rollout converge.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../src/config/db');

const VM_SCORE_COLUMNS = [
  // N/A is not a failure: it is excluded from the score denominator, so it needs
  // its own counter instead of inflating failed_count.
  { table: 'vmsubmissions', col: 'na_count', def: 'INT DEFAULT 0' },
  // Active checkpoints the auditor never answered (a submitted audit must have none).
  { table: 'vmsubmissions', col: 'unrated_count', def: 'INT DEFAULT 0' },
  // Drafts are per auditor, so resume/idempotency cannot key on submittedBy alone.
  { table: 'vmsubmissions', col: 'auditor_user_id', def: 'INT NULL' },
  // Draft rows have never been submitted; submitVm used to leave history with no timestamp.
  { table: 'vmsubmissions', col: 'submittedAt', def: 'TIMESTAMP NULL DEFAULT NULL' },
  { table: 'vmsubmissions', col: 'updatedBy', def: 'VARCHAR(100) NULL' },
  // Each note belongs to one checkpoint, never to the whole audit.
  { table: 'vmsubmissionentries', col: 'comment', def: 'TEXT NULL' },
  { table: 'vmsubmissionentries', col: 'observation', def: 'TEXT NULL' },
  { table: 'vmsubmissionentries', col: 'corrective_action', def: 'TEXT NULL' },
  { table: 'vmsubmissionentries', col: 'position', def: 'INT DEFAULT 0' }
];

const VM_SCORE_INDEXES = [
  // One row per (store, floor, section, shift, day, auditor) — the draft resume key,
  // and the status predicate every dashboard/list read uses.
  {
    table: 'vmsubmissions',
    name: 'idx_vmsub_draft_lookup',
    cols: '(`location_id`, `floor`, `section`, `shift`, `entryDate`, `status`)'
  },
  // Autosave upserts answers by (submissionId, pointId); without this the lookup
  // scans every answer row of every audit.
  {
    table: 'vmsubmissionentries',
    name: 'idx_vmentries_sub_point',
    cols: '(`submissionId`, `pointId`)'
  }
];

async function hasColumn(table, col) {
  const [rows] = await db.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [col]);
  return rows && rows.length > 0;
}

async function hasIndex(table, name) {
  const [rows] = await db.query(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
    [table, name]
  );
  return rows && rows.length > 0;
}

async function addColumns() {
  for (const item of VM_SCORE_COLUMNS) {
    if (await hasColumn(item.table, item.col)) {
      console.log(`- ${item.table}.${item.col} already present`);
      continue;
    }
    await db.query(`ALTER TABLE \`${item.table}\` ADD COLUMN \`${item.col}\` ${item.def}`);
    console.log(`+ ${item.table}.${item.col} ${item.def}`);
  }
}

async function addIndexes() {
  for (const item of VM_SCORE_INDEXES) {
    if (await hasIndex(item.table, item.name)) {
      console.log(`- ${item.table} index ${item.name} already present`);
      continue;
    }
    await db.query(`ALTER TABLE \`${item.table}\` ADD INDEX \`${item.name}\` ${item.cols}`);
    console.log(`+ ${item.table} index ${item.name} ${item.cols}`);
  }
}

async function showResult() {
  for (const table of ['vmsubmissions', 'vmsubmissionentries']) {
    const [cols] = await db.query(`SHOW COLUMNS FROM \`${table}\``);
    console.log(`\n=== SHOW COLUMNS FROM \`${table}\` (${cols.length} columns) ===`);
    console.table(cols.map(c => ({ Field: c.Field, Type: c.Type, Null: c.Null, Default: c.Default })));
    const [idx] = await db.query(
      `SELECT INDEX_NAME nm, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) cols
         FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
        GROUP BY INDEX_NAME`,
      [table]
    );
    console.log(`=== indexes on ${table}: ` + idx.map(r => `${r.nm}(${r.cols})`).join(' | '));
  }
}

async function run() {
  console.log('[Migration] VM checklist audit flow (additive schema only)...');
  await addColumns();
  await addIndexes();
  await showResult();
  console.log('[Migration] Complete. No VM rows were modified or removed.');
  process.exit(0);
}

run().catch(e => { console.error('[Migration Error]', e.message); process.exit(1); });
