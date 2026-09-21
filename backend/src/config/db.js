const mysql = require('mysql2/promise');

// NOTE: Do NOT call dotenv.config() here.
// server/index.js handles all env loading BEFORE this module is required.
// Calling dotenv here would use process.cwd() which is unreliable on Hostinger.

const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = parseInt(process.env.DB_PORT || '3306', 10);
const dbUser = process.env.DB_USER || '';
const dbPassword = process.env.DB_PASSWORD || '';
const dbName = process.env.DB_NAME || '';

console.log(`[DB Config] Initializing MySQL pool: Host=${dbHost}, Port=${dbPort}, User=${dbUser ? 'configured' : 'NOT SET'}, DB=${dbName ? 'configured' : 'NOT SET'}`);

const pool = mysql.createPool({
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  waitForConnections: true,
  connectionLimit: 20,     // sized for high-concurrency retail usage across 3 locations
  queueLimit: 100,        // bounded queue: shed excess load instead of exhausting memory
  dateStrings: true,
  connectTimeout: 5000,  // 5s max per connection attempt (was 10s - too slow for Passenger timeout)
  enableKeepAlive: true, // Keep connections alive to prevent stale connection 503s
  keepAliveInitialDelay: 0
});

// Verify connection at startup (non-blocking - NEVER blocks the app from starting)
pool.getConnection()
  .then(conn => {
    console.log(`====================================================`);
    console.log(`  [MySQL DB] CONNECTED SUCCESSFULLY!`);
    console.log(`  Host: ${dbHost}:${dbPort} | Database: ${dbName ? 'configured' : 'N/A'}`);
    console.log(`====================================================`);
    return conn.query('SHOW TABLES').then(([tables]) => {
      console.log(`  [MySQL DB Audit] Total Tables Found: ${tables.length}`);
      conn.release();
    });
  })
  .catch(err => {
    console.error(`====================================================`);
    console.error(`  [MySQL DB CONNECTION ERROR] Failed to connect!`);
    console.error(`  Host: ${dbHost}:${dbPort} | Database: ${dbName ? 'configured' : 'N/A'}`);
    console.error(`  Error Code: ${err.code || 'UNKNOWN'}`);
    console.error(`  Error Message: ${err.message}`);
    console.error(`====================================================`);
    // DO NOT exit here — app stays alive so health endpoint works even when DB is down
  });

module.exports = pool;
