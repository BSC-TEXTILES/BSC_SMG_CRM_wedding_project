const mysql = require('mysql2/promise');
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hrms_db',
};

async function migrate() {
  const connection = await mysql.createConnection(dbConfig);
  try {
    console.log('Running migrations...');

    // 1. Add missing columns to designations
    try {
      await connection.query('ALTER TABLE designations ADD COLUMN role_scope VARCHAR(50) DEFAULT "All"');
    } catch (e) { console.log('role_scope exists or error', e.message); }
    try {
      await connection.query('ALTER TABLE designations ADD COLUMN active BOOLEAN DEFAULT TRUE');
    } catch (e) { console.log('active exists or error', e.message); }

    // 2. Add missing columns to candidates
    const newCols = [
      'blood_group VARCHAR(20) NULL',
      'offered_doj DATE NULL',
      'retail_experience VARCHAR(150) NULL',
      'previous_company VARCHAR(150) NULL',
      'previous_designation VARCHAR(150) NULL',
      'aadhaar_number VARCHAR(50) NULL',
      'father_details VARCHAR(255) NULL',
      'mother_details VARCHAR(255) NULL',
      'religion_caste VARCHAR(150) NULL',
      'religion VARCHAR(100) NULL',
      'caste VARCHAR(100) NULL',
      'languages_known VARCHAR(255) NULL',
      'photo_url TEXT NULL',
      'aadhaar_url TEXT NULL'
    ];

    for (let col of newCols) {
      try {
        await connection.query(`ALTER TABLE candidates ADD COLUMN ${col}`);
      } catch (e) { console.log(`Error adding ${col.split(' ')[0]}:`, e.message); }
    }

    // 3. Create missing onboarding tables
    await connection.query(`
      CREATE TABLE IF NOT EXISTS onboarding_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        record_id VARCHAR(50) NOT NULL UNIQUE,
        emp_name VARCHAR(255) NOT NULL,
        designation VARCHAR(150) NOT NULL,
        joining_date DATE NULL,
        progress INT DEFAULT 0,
        status VARCHAR(50) DEFAULT 'On Track',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS onboarding_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        onboarding_id INT NULL,
        record_id VARCHAR(50) NOT NULL,
        section VARCHAR(100) NOT NULL,
        item_id VARCHAR(100) NOT NULL,
        item VARCHAR(255) NOT NULL,
        mandatory BOOLEAN DEFAULT FALSE,
        status VARCHAR(50) DEFAULT 'Pending',
        remarks TEXT NULL,
        done_by VARCHAR(150) NULL,
        done_at DATETIME NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 4. Delete sample data (COMMENTED OUT FOR SAFETY)
    // await connection.query('DELETE FROM candidates');
    // await connection.query('DELETE FROM interview_schedules');
    // await connection.query('DELETE FROM candidate_activities');
    // await connection.query('DELETE FROM hr_evaluations');
    // await connection.query('DELETE FROM interview_tokens');
    // await connection.query('DELETE FROM selected_candidates');
    // await connection.query('DELETE FROM rejected_candidates');
    // await connection.query('DELETE FROM selection_offers');
    // await connection.query('DELETE FROM onboarding_records');
    
    console.log('Migrations and cleanup completed!');
  } catch (err) {
    console.error('Fatal Error:', err);
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  migrate();
}

module.exports = { migrate };
