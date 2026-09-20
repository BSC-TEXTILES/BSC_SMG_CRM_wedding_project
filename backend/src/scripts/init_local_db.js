const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

// Load backend .env
const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = parseInt(process.env.DB_PORT || '3306', 10);
const dbUser = process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD || '';
const dbName = process.env.DB_NAME || 'u101820758_bsc_smg_crm';

async function main() {
  console.log(`[DB Check] Checking MySQL connection on ${dbHost}:${dbPort}...`);
  let connection;
  try {
    connection = await mysql.createConnection({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName
    });
    console.log(`[DB Check] Successfully connected to database: ${dbName}`);
  } catch (err) {
    console.log(`[DB Check] Direct login as ${dbUser} failed (${err.message}). Attempting root setup...`);
    const rootPasswords = ['root', '', 'admin', '123456', 'password'];
    let rootConn = null;
    for (const p of rootPasswords) {
      try {
        rootConn = await mysql.createConnection({
          host: '127.0.0.1',
          port: dbPort,
          user: 'root',
          password: p
        });
        console.log(`[DB Check] Connected as MySQL root.`);
        break;
      } catch (e) {}
    }

    if (!rootConn) {
      console.error('[DB Check] Could not connect to MySQL as root or configured user. Please verify MySQL service.');
      process.exit(1);
    }

    // Ensure database and user exist
    await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    try {
      await rootConn.query(`CREATE USER IF NOT EXISTS '${dbUser}'@'localhost' IDENTIFIED BY '${dbPassword}'`);
      await rootConn.query(`ALTER USER '${dbUser}'@'localhost' IDENTIFIED BY '${dbPassword}'`);
      await rootConn.query(`GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${dbUser}'@'localhost'`);

      await rootConn.query(`CREATE USER IF NOT EXISTS '${dbUser}'@'127.0.0.1' IDENTIFIED BY '${dbPassword}'`);
      await rootConn.query(`ALTER USER '${dbUser}'@'127.0.0.1' IDENTIFIED BY '${dbPassword}'`);
      await rootConn.query(`GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${dbUser}'@'127.0.0.1'`);

      await rootConn.query(`CREATE USER IF NOT EXISTS '${dbUser}'@'%' IDENTIFIED BY '${dbPassword}'`);
      await rootConn.query(`ALTER USER '${dbUser}'@'%' IDENTIFIED BY '${dbPassword}'`);
      await rootConn.query(`GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${dbUser}'@'%'`);
      await rootConn.query('FLUSH PRIVILEGES');
      console.log(`[DB Check] Local database and user permissions configured.`);
    } catch (e) {
      console.warn(`[DB Check Warning] ${e.message}`);
    }
    await rootConn.end();

    connection = await mysql.createConnection({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName
    });
  }

  const [tables] = await connection.query('SHOW TABLES');
  console.log(`[DB Check] Total tables found: ${tables.length}`);
  if (tables.length < 5) {
    console.log('[DB Check] Initializing database tables and default data...');
    await connection.end();
    const pool = require('../config/db');
    const { autoInitializeDatabase } = require('../config/dbInitializer');
    await autoInitializeDatabase(pool);
    console.log('[DB Check] Auto-initialization completed.');
    await pool.end();
  } else {
    console.log('[DB Check] Database tables are verified and ready.');
    await connection.end();
  }
}

if (require.main === module) {
  main().then(() => {
    console.log('[DB Check] Ready for application startup.');
    process.exit(0);
  }).catch(err => {
    console.error('[DB Check Error]', err.message);
    process.exit(1);
  });
}

module.exports = { main };
