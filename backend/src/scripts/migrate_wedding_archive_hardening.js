require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const pool = require('../config/db');

const COMPLETION_STATUSES = ['Wedding Process Completed', 'Completed'];

async function extendStatusEnum() {
  const [rows] = await pool.query(`
    SELECT COLUMN_TYPE AS def, DATA_TYPE AS dtype, IS_NULLABLE AS nullable, COLUMN_DEFAULT AS dflt
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wedding_customers' AND COLUMN_NAME = 'customer_status'
  `);
  const meta = rows[0];
  if (!meta) throw new Error('wedding_customers.customer_status not found');
  if (meta.dtype !== 'enum') {
    console.log(`- customer_status is ${meta.dtype}; no enum change needed`);
    return;
  }

  const inner = String(meta.def).slice(String(meta.def).indexOf('(') + 1, String(meta.def).lastIndexOf(')'));
  const values = [];
  const re = /'((?:[^']|'')*)'/g;
  let m;
  while ((m = re.exec(inner))) values.push(m[1].replace(/''/g, "'"));

  const missing = COMPLETION_STATUSES.filter((s) => !values.includes(s));
  if (!missing.length) {
    console.log('- customer_status enum already contains the completion statuses');
    return;
  }

  // Append only — existing values keep their positions, so stored rows are untouched.
  const next = [...values, ...missing].map((s) => `'${s.replace(/'/g, "''")}'`).join(',');
  const nullability = meta.nullable === 'NO' ? 'NOT NULL' : 'NULL';
  const dflt = meta.dflt === null ? '' : `DEFAULT '${String(meta.dflt).replace(/'/g, "''")}'`;
  await pool.query(`ALTER TABLE wedding_customers MODIFY COLUMN customer_status ENUM(${next}) ${nullability} ${dflt}`.trim());
  console.log(`+ customer_status extended with: ${missing.join(', ')}`);
}

async function protectCallHistoryFromCascade() {
  const [fks] = await pool.query(`
    SELECT k.CONSTRAINT_NAME AS name, r.DELETE_RULE AS rule
    FROM information_schema.KEY_COLUMN_USAGE k
    JOIN information_schema.REFERENTIAL_CONSTRAINTS r
      ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
    WHERE k.TABLE_SCHEMA = DATABASE() AND k.TABLE_NAME = 'wedding_call_logs'
      AND k.REFERENCED_TABLE_NAME = 'wedding_customers'
  `);
  const replaceable = fks.filter((f) => f.rule === 'CASCADE');
  for (const f of replaceable) {
    await pool.query(`ALTER TABLE wedding_call_logs DROP FOREIGN KEY \`${f.name}\``);
    console.log(`- dropped ${f.name} (${f.rule})`);
  }
  if (replaceable.length || !fks.length) {
    await pool.query(
      `ALTER TABLE wedding_call_logs ADD CONSTRAINT \`fk_wed_call_logs_customer\` FOREIGN KEY (customer_id) REFERENCES wedding_customers(id) ON DELETE RESTRICT`
    );
    console.log('+ wedding_call_logs FK now ON DELETE RESTRICT (archived history cannot be cascade-wiped)');
  } else {
    console.log('- wedding_call_logs FK already non-cascading');
  }
}

async function migrate() {
  console.log('[Migration] Wedding CRM archive hardening...');

  const additive = [
    "ALTER TABLE `wedding_customers` ADD COLUMN `previous_customer_id` INT NULL",
    "ALTER TABLE `wedding_customers` ADD INDEX `idx_wed_prev_customer` (`previous_customer_id`)",
    "ALTER TABLE `wedding_customers` ADD COLUMN `lifecycle_status` VARCHAR(50) NOT NULL DEFAULT 'ACTIVE'",
    "ALTER TABLE `wedding_customers` ADD COLUMN `archived_at` DATETIME NULL",
    "ALTER TABLE `wedding_customers` ADD COLUMN `archived_by` VARCHAR(150) NULL",
    "ALTER TABLE `wedding_customers` ADD COLUMN `archived_by_user_id` INT NULL",
    "ALTER TABLE `wedding_customers` ADD COLUMN `archive_reason` TEXT NULL",
    "ALTER TABLE `wedding_customers` ADD COLUMN `previous_status` VARCHAR(50) NULL"
  ];

  for (const sql of additive) {
    try {
      await pool.query(sql);
      console.log('+ Executed:', sql);
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_DUP_KEYNAME') console.log('- Already exists');
      else console.warn('! Notice:', sql, err.message);
    }
  }

  await extendStatusEnum();
  await protectCallHistoryFromCascade();

  console.log('[Migration] Archive hardening complete.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('[Migration Error]', err);
  process.exit(1);
});
