require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const pool = require('../config/db');

async function migrate() {
  const [cols] = await pool.query('DESCRIBE Diverts');
  const have = new Set(cols.map(c => c.Field));
  const newCols = [
    ['size', 'VARCHAR(64) NULL'],
    ['colour', 'VARCHAR(64) NULL'],
    ['other_product_details', 'TEXT NULL'],
    ['required_by_date', 'VARCHAR(32) NULL'],
    ['reference_image', 'VARCHAR(512) NULL'],
    ['remarks', 'TEXT NULL']
  ];

  for (const [col, def] of newCols) {
    if (!have.has(col)) {
      console.log('Adding column:', col);
      await pool.query(`ALTER TABLE Diverts ADD COLUMN \`${col}\` ${def}`);
    } else {
      console.log('Column already exists:', col);
    }
  }

  const [afterCols] = await pool.query('DESCRIBE Diverts');
  console.log('Updated Diverts columns:', afterCols.map(c => c.Field));
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
