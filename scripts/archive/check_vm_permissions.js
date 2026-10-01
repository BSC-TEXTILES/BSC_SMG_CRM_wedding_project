const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const pool = require('../config/db');

async function check() {
  const [users] = await pool.query("SELECT id, username, role, location_id FROM users ORDER BY id ASC");
  console.log('All Users:', users);
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
