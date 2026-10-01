/**
 * Migrate all user passwords in database to direct readable/plain format
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
if (!process.env.DB_USER) {
  require('dotenv').config({ path: require('path').join(__dirname, '../../backend/.env') });
}
const pool = require('../config/db');

async function migrate() {
  console.log('[Migration] Updating all user passwords to readable plaintext format...');
  
  const updates = [
    { username: 'admin', password: 'password123' },
    { username: 'admin@bsctextiles.com', password: 'admin@2026' },
    { username: 'hr', password: 'password123' },
    { username: 'hr@bsctextiles.com', password: 'password123' },
    { username: 'manager', password: 'password123' },
    { username: 'manager@bsctextiles.com', password: 'password123' },
    { username: 'telecaller', password: 'password123' },
    { username: 'greeter', password: 'bsc@123' },
    { username: 'greeter@bsctextiles.com', password: 'bsc@123' },
    { username: 'staff', password: 'password123' },
    { username: 'customer', password: 'password123' },
    { username: 'test@bsctextiles.com', password: 'password123' },
    { username: 'vm_caller', password: 'test@2026' },
    { username: 'floor_mgr', password: 'test@2026' }
  ];

  for (const item of updates) {
    await pool.query(
      `UPDATE users SET password = ? WHERE username = ?`,
      [item.password, item.username]
    );
  }

  // Also for any other users whose passwords start with $2a$ or $2b$, default to 'password123'
  await pool.query(
    `UPDATE users SET password = 'password123' WHERE password LIKE '$2%'`
  );

  const [rows] = await pool.query('SELECT id, username, password, role FROM users');
  console.table(rows);
  console.log('✓ All passwords saved in readable format in database.');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
