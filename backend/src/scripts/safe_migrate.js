require('dotenv').config();
const mysql = require('mysql2/promise');
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hrms_db',
};

async function safeMigrate() {
  const connection = await mysql.createConnection(dbConfig);
  try {
    console.log('Running safe migrations...');
    const newCols = [
      'religion VARCHAR(100) NULL',
      'caste VARCHAR(100) NULL'
    ];

    for (let col of newCols) {
      try {
        await connection.query(`ALTER TABLE candidates ADD COLUMN ${col}`);
        console.log(`Added ${col}`);
      } catch (e) {
        console.log(`Column ${col.split(' ')[0]} might already exist or error:`, e.message);
      }
    }
    console.log('Safe migration completed without deleting data!');
  } catch (err) {
    console.error('Fatal Error:', err);
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  safeMigrate();
}

module.exports = { safeMigrate };
