const pool = require('../config/db');

async function init() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS employee_access_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        employee_id INT NOT NULL,
        employee_name VARCHAR(255) NULL,
        user_id INT NOT NULL,
        username VARCHAR(150) NOT NULL,
        user_role VARCHAR(100) NULL,
        location_id INT NULL,
        requested_action VARCHAR(100) DEFAULT 'VIEW_EMPLOYEE_DETAILS',
        reason TEXT NULL,
        status ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
        resolved_by INT NULL,
        resolved_by_name VARCHAR(150) NULL,
        resolved_at DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_emp (employee_id),
        INDEX idx_user (user_id),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('employee_access_requests table created or already exists');

    // Also verify notifications table support for action payloads & category
    const [cols] = await pool.query('DESCRIBE notification');
    const colNames = new Set(cols.map(c => c.Field));
    if (!colNames.has('type')) {
      await pool.query("ALTER TABLE notification ADD COLUMN type VARCHAR(50) DEFAULT 'info'");
      console.log('Added type column to notification table');
    }
    if (!colNames.has('category')) {
      await pool.query("ALTER TABLE notification ADD COLUMN category VARCHAR(50) DEFAULT 'system'");
      console.log('Added category column to notification table');
    }
    if (!colNames.has('action_data')) {
      await pool.query("ALTER TABLE notification ADD COLUMN action_data JSON NULL");
      console.log('Added action_data column to notification table');
    }
    if (!colNames.has('priority')) {
      await pool.query("ALTER TABLE notification ADD COLUMN priority VARCHAR(20) DEFAULT 'normal'");
      console.log('Added priority column to notification table');
    }
  } catch (err) {
    console.error('Error in init:', err.message);
  } finally {
    process.exit(0);
  }
}

init();
