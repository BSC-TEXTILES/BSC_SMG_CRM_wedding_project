const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../../backend/.env') });
const pool = require('../config/db');

async function migrateUserSessions() {
  try {
    const [existing] = await pool.query('DESCRIBE user_sessions');
    const existingCols = existing.map(r => r.Field);
    console.log('[Migration] Existing user_sessions columns:', existingCols);

    const toAdd = [
      { name: 'session_token_hash', def: 'VARCHAR(64) NULL' },
      { name: 'refresh_token_hash', def: 'VARCHAR(64) NULL' },
      { name: 'expires_at', def: 'TIMESTAMP NULL' },
      { name: 'last_activity_at', def: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
    ];

    for (const col of toAdd) {
      if (!existingCols.includes(col.name)) {
        await pool.query(`ALTER TABLE user_sessions ADD COLUMN ${col.name} ${col.def}`);
        console.log(`[Migration] Added column: ${col.name}`);
      } else {
        console.log(`[Migration] Column ${col.name} already exists`);
      }
    }

    try {
      await pool.query('CREATE INDEX idx_user_sessions_token ON user_sessions (session_token_hash)');
      console.log('[Migration] Created index on session_token_hash');
    } catch (e) {
      // index already exists or not supported
    }

    console.log('[Migration] user_sessions migration completed successfully.');
  } catch (err) {
    console.error('[Migration Error]', err.message);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  migrateUserSessions();
}

module.exports = { migrateUserSessions };
