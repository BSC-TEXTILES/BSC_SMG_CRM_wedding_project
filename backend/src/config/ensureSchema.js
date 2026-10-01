'use strict';

/**
 * Converge the schema that feature code depends on.
 *
 * Several features shipped with their columns and tables created by a hand-run
 * script under src/scripts. Any environment that never ran that script — a fresh
 * deploy, a restored backup, a second store — answers 500 for the whole screen,
 * because the SELECT names a column the database has never heard of. Production's
 * Hourly Footfall register is exactly that failure.
 *
 * Everything here is additive and idempotent: a missing column is created, an
 * existing one is left untouched, and no visitor count, customer or audit is ever
 * rewritten. The only data touched is the classification of rows written before an
 * origin column existed, which would otherwise be reported as unknown forever.
 *
 * Table names are resolved case-insensitively because Linux MySQL treats them as
 * case-sensitive: DDL issued against a differently-cased name would silently create
 * a second, empty table instead of fixing the one the application reads.
 */

/** @type {{ table: string, columns: { col: string, def: string }[] }[]} */
const REQUIRED_COLUMNS = [
  {
    // Hourly Footfall origin and correction trail (crmController).
    table: 'footfallentries',
    columns: [
      { col: 'entry_source', def: 'VARCHAR(30) NULL' },
      { col: 'created_by', def: 'VARCHAR(150) NULL' },
      { col: 'created_by_role', def: 'VARCHAR(60) NULL' },
      { col: 'updated_by', def: 'VARCHAR(150) NULL' },
      { col: 'updated_by_role', def: 'VARCHAR(60) NULL' }
    ]
  },
  {
    // Wedding CRM archive / old-customers lifecycle (weddingController).
    table: 'wedding_customers',
    columns: [
      { col: 'previous_customer_id', def: 'INT NULL' },
      { col: 'lifecycle_status', def: "VARCHAR(50) NOT NULL DEFAULT 'ACTIVE'" },
      { col: 'archived_at', def: 'DATETIME NULL' },
      { col: 'archived_by', def: 'VARCHAR(150) NULL' },
      { col: 'archived_by_user_id', def: 'INT NULL' },
      { col: 'archive_reason', def: 'TEXT NULL' },
      { col: 'previous_status', def: 'VARCHAR(50) NULL' }
    ]
  },
  {
    // Role scoping for designations (userManagementController).
    table: 'designations',
    columns: [
      { col: 'role_scope', def: 'VARCHAR(50) DEFAULT "All"' },
      { col: 'active', def: 'BOOLEAN DEFAULT TRUE' }
    ]
  },
  {
    // Dedupe key for Tell Caller instructions: the message itself is encrypted with
    // a random IV, so ciphertext can never be compared for an exact repeat.
    table: 'wedding_telecaller_instructions',
    columns: [
      { col: 'message_hash', def: 'CHAR(64) NULL' }
    ]
  }
];

/** @type {string[]} */
const REQUIRED_TABLES = [
  `CREATE TABLE IF NOT EXISTS \`footfall_edit_history\` (
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
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`vm_submission_history\` (
     \`id\` INT AUTO_INCREMENT PRIMARY KEY,
     \`submission_id\` VARCHAR(64) NOT NULL,
     \`location_id\` INT NULL,
     \`action\` VARCHAR(40) NOT NULL,
     \`field\` VARCHAR(60) NULL,
     \`point_id\` VARCHAR(64) NULL,
     \`old_value\` TEXT NULL,
     \`new_value\` TEXT NULL,
     \`status_before\` VARCHAR(30) NULL,
     \`status_after\` VARCHAR(30) NULL,
     \`score_percent\` DECIMAL(5,2) NULL,
     \`summary\` VARCHAR(500) NULL,
     \`changed_by\` VARCHAR(150) NOT NULL,
     \`changed_by_user_id\` INT NULL,
     \`changed_by_role\` VARCHAR(60) NULL,
     \`changed_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     INDEX \`idx_vm_hist_sub\` (\`submission_id\`, \`changed_at\`),
     INDEX \`idx_vm_hist_loc\` (\`location_id\`),
     INDEX \`idx_vm_hist_when\` (\`changed_at\`)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // "Tell Caller": a CRM Manager's instruction about one customer to one telecaller.
  // Names are stored alongside the ids because an archived customer must keep
  // readable history, and `message` holds encrypted text like wedding_notes.
  `CREATE TABLE IF NOT EXISTS \`wedding_telecaller_instructions\` (
     \`id\` INT AUTO_INCREMENT PRIMARY KEY,
     \`customer_id\` INT NOT NULL,
     \`customer_code\` VARCHAR(40) NULL,
     \`customer_name\` VARCHAR(190) NULL,
     \`location_id\` INT NOT NULL,
     \`location_name\` VARCHAR(120) NULL,
     \`telecaller_user_id\` INT NOT NULL,
     \`telecaller_name\` VARCHAR(190) NOT NULL,
     \`sent_by_user_id\` INT NULL,
     \`sent_by_name\` VARCHAR(190) NOT NULL,
     \`sent_by_role\` VARCHAR(80) NULL,
     \`message\` TEXT NOT NULL,
     \`message_hash\` CHAR(64) NULL,
     \`priority\` VARCHAR(20) NOT NULL DEFAULT 'Normal',
     \`status\` VARCHAR(20) NOT NULL DEFAULT 'New',
     \`related_call_log_id\` INT NULL,
     \`seen_at\` DATETIME NULL,
     \`acknowledged_at\` DATETIME NULL,
     \`acknowledged_by\` VARCHAR(190) NULL,
     \`completed_at\` DATETIME NULL,
     \`completed_by\` VARCHAR(190) NULL,
     \`completed_by_user_id\` INT NULL,
     \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     INDEX \`idx_wti_telecaller\` (\`telecaller_user_id\`, \`status\`, \`created_at\`),
     INDEX \`idx_wti_customer\` (\`customer_id\`, \`created_at\`),
     INDEX \`idx_wti_location\` (\`location_id\`),
     INDEX \`idx_wti_created\` (\`created_at\`)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
];

/** Indexes the reads rely on; a duplicate is ignored rather than re-built. */
const REQUIRED_INDEXES = [
  { table: 'wedding_customers', name: 'idx_wed_lifecycle', cols: '`lifecycle_status`' },
  { table: 'wedding_customers', name: 'idx_wed_archived_at', cols: '`archived_at`' },
  { table: 'wedding_customers', name: 'idx_wed_prev_customer', cols: '`previous_customer_id`' }
];

async function resolveTableName(pool, wanted) {
  const [rows] = await pool.query(
    'SELECT TABLE_NAME nm FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = ? LIMIT 1',
    [wanted.toLowerCase()]
  );
  return rows && rows.length ? rows[0].nm : null;
}

async function hasColumn(pool, table, column) {
  const [rows] = await pool.query(
    'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
    [table, column]
  );
  return !!(rows && rows.length);
}

/**
 * Rows written before `entry_source` existed carry no origin at all. The kiosk's only
 * signal was its remarks text, so that is what they are classified by — once.
 */
async function backfillFootfallSource(pool, table) {
  const [pending] = await pool.query(`SELECT COUNT(*) n FROM \`${table}\` WHERE entry_source IS NULL`);
  const count = Number(pending?.[0]?.n || 0);
  if (!count) return;

  await pool.query(
    `UPDATE \`${table}\`
        SET entry_source = 'Greeter Kiosk', created_by = COALESCE(submittedBy, 'Greeter')
      WHERE entry_source IS NULL
        AND (remarks = 'Greeter Entrance Kiosk' OR LOWER(COALESCE(remarks,'')) LIKE '%kiosk%' OR submittedBy = 'Greeter')`
  );
  await pool.query(
    `UPDATE \`${table}\`
        SET entry_source = 'Admin Entry', created_by = COALESCE(submittedBy, 'Staff')
      WHERE entry_source IS NULL`
  );
  console.log(`[Schema] Classified ${count} footfall rows by origin`);
}

/**
 * Create whatever the feature code expects and the database does not have.
 * Reports each addition, and never throws: a schema that cannot be converged must
 * not stop the backend from starting.
 */
async function ensureFeatureSchema(pool) {
  for (const ddl of REQUIRED_TABLES) {
    try {
      await pool.query(ddl);
    } catch (err) {
      console.warn('[Schema] Table notice:', err.message);
    }
  }

  for (const spec of REQUIRED_COLUMNS) {
    let table;
    try {
      table = await resolveTableName(pool, spec.table);
    } catch (err) {
      continue;
    }
    if (!table) continue; // The feature's base table is absent; its own init creates it.

    for (const item of spec.columns) {
      try {
        if (await hasColumn(pool, table, item.col)) continue;
        await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${item.col}\` ${item.def}`);
        console.log(`[Schema] + ${table}.${item.col}`);
      } catch (err) {
        if (err.code !== 'ER_DUP_FIELDNAME') console.warn(`[Schema] Could not add ${table}.${item.col}:`, err.message);
      }
    }

    if (table && spec.table === 'footfallentries') {
      try { await backfillFootfallSource(pool, table); } catch (err) { console.warn('[Schema] Footfall origin backfill skipped:', err.message); }
    }
  }

  for (const idx of REQUIRED_INDEXES) {
    try {
      const table = await resolveTableName(pool, idx.table);
      if (!table) continue;
      await pool.query(`CREATE INDEX \`${idx.name}\` ON \`${table}\` (${idx.cols})`);
      console.log(`[Schema] + index ${idx.name}`);
    } catch (err) {
      // ER_DUP_KEYNAME simply means the index is already there.
      if (err.code !== 'ER_DUP_KEYNAME' && !/duplicate key name/i.test(err.message || '')) {
        console.warn(`[Schema] Index ${idx.name} notice:`, err.message);
      }
    }
  }
}

module.exports = { ensureFeatureSchema, REQUIRED_COLUMNS, REQUIRED_TABLES };
