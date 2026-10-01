require('dotenv').config();
const mysql = require('mysql2/promise');

async function fixCols() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
  });

  try {
    const [cols] = await pool.query('SHOW COLUMNS FROM employee_documents');
    const existing = new Set(cols.map(c => c.Field));

    if (!existing.has('status')) {
      await pool.query("ALTER TABLE employee_documents ADD COLUMN status VARCHAR(50) DEFAULT 'Approved'");
      console.log('Added column: status');
    }
    if (!existing.has('updated_at')) {
      await pool.query("ALTER TABLE employee_documents ADD COLUMN updated_at DATETIME NULL");
      console.log('Added column: updated_at');
    }
    console.log('employee_documents schema up to date.');
  } catch (err) {
    console.error('Error updating employee_documents columns:', err.message);
  } finally {
    await pool.end();
  }
}

fixCols();
