/**
 * Broadcast System Database Migration
 * Creates new tables and extends broadcast_messages for the Enterprise Broadcast Notice system
 */

require('dotenv').config();
const pool = require('../config/db');

async function migrate() {
  const conn = await pool.getConnection();
  try {
    console.log('[Broadcast Migration] Starting database migration...');
    
    // Start transaction
    await conn.beginTransaction();

    // 1. Extend broadcast_messages table with new columns
    console.log('[Broadcast Migration] Extending broadcast_messages table...');
    
    const columnsToAdd = [
      { name: 'scheduled_at', def: 'TIMESTAMP NULL' },
      { name: 'dispatched_at', def: 'TIMESTAMP NULL' },
      { name: 'expires_at', def: 'TIMESTAMP NULL' },
      { name: 'acknowledgement_required', def: 'TINYINT(1) DEFAULT 0' },
      { name: 'created_by', def: 'INT NULL' },
      { name: 'updated_at', def: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
    ];

    for (const col of columnsToAdd) {
      const [exists] = await conn.query(`SHOW COLUMNS FROM \`broadcast_messages\` LIKE ?`, [col.name]);
      if (!exists || exists.length === 0) {
        await conn.query(`ALTER TABLE \`broadcast_messages\` ADD COLUMN \`${col.name}\` ${col.def}`);
        console.log(`[Broadcast Migration] Added column: ${col.name}`);
      } else {
        console.log(`[Broadcast Migration] Column ${col.name} already exists, skipping`);
      }
    }

    // 2. Create broadcast_audience table
    console.log('[Broadcast Migration] Creating broadcast_audience table...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`broadcast_audience\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`broadcast_id\` INT NOT NULL,
        \`audience_group\` VARCHAR(50) NOT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY \`uq_broadcast_audience\` (\`broadcast_id\`, \`audience_group\`),
        INDEX \`idx_broadcast_audience_broadcast\` (\`broadcast_id\`),
        INDEX \`idx_broadcast_audience_group\` (\`audience_group\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('[Broadcast Migration] Created broadcast_audience table');

    // 3. Create broadcast_recipients table
    console.log('[Broadcast Migration] Creating broadcast_recipients table...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`broadcast_recipients\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`broadcast_id\` INT NOT NULL,
        \`user_id\` INT NOT NULL,
        \`delivered_at\` TIMESTAMP NULL,
        \`read_at\` TIMESTAMP NULL,
        \`acknowledged_at\` TIMESTAMP NULL,
        \`status\` VARCHAR(20) DEFAULT 'PENDING',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY \`uq_broadcast_recipient\` (\`broadcast_id\`, \`user_id\`),
        INDEX \`idx_broadcast_recipients_broadcast\` (\`broadcast_id\`),
        INDEX \`idx_broadcast_recipients_user\` (\`user_id\`),
        INDEX \`idx_broadcast_recipients_status\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('[Broadcast Migration] Created broadcast_recipients table');

    // 4. Create broadcast_audit_log table
    console.log('[Broadcast Migration] Creating broadcast_audit_log table...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`broadcast_audit_log\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`broadcast_id\` INT NULL,
        \`user_id\` INT NULL,
        \`action\` VARCHAR(60) NOT NULL,
        \`metadata\` JSON NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_broadcast_audit_broadcast\` (\`broadcast_id\`),
        INDEX \`idx_broadcast_audit_user\` (\`user_id\`),
        INDEX \`idx_broadcast_audit_action\` (\`action\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('[Broadcast Migration] Created broadcast_audit_log table');

    // 5. Add indexes to broadcast_messages for better query performance
    console.log('[Broadcast Migration] Adding indexes to broadcast_messages...');
    const indexesToAdd = [
      { name: 'idx_broadcast_messages_status', cols: 'status' },
      { name: 'idx_broadcast_messages_scheduled_at', cols: 'scheduled_at' },
      { name: 'idx_broadcast_messages_expires_at', cols: 'expires_at' },
      { name: 'idx_broadcast_messages_created_by', cols: 'created_by' }
    ];

    for (const idx of indexesToAdd) {
      try {
        const [exists] = await conn.query(`SHOW INDEX FROM \`broadcast_messages\` WHERE Key_name = ?`, [idx.name]);
        if (!exists || exists.length === 0) {
          await conn.query(`ALTER TABLE \`broadcast_messages\` ADD INDEX \`${idx.name}\` (\`${idx.cols}\`)`);
          console.log(`[Broadcast Migration] Added index: ${idx.name}`);
        } else {
          console.log(`[Broadcast Migration] Index ${idx.name} already exists, skipping`);
        }
      } catch (e) {
        console.warn(`[Broadcast Migration] Could not add index ${idx.name}:`, e.message);
      }
    }

    // 6. Migrate existing data: populate broadcast_audience from target_role
    console.log('[Broadcast Migration] Migrating existing target_role data to broadcast_audience...');
    const [existingBroadcasts] = await conn.query(
      'SELECT id, target_role FROM broadcast_messages WHERE target_role IS NOT NULL AND target_role != ""'
    );
    
    for (const broadcast of existingBroadcasts) {
      const groups = broadcast.target_role.split(',').map(g => g.trim()).filter(g => g);
      for (const group of groups) {
        try {
          await conn.query(
            'INSERT IGNORE INTO broadcast_audience (broadcast_id, audience_group) VALUES (?, ?)',
            [broadcast.id, group]
          );
        } catch (e) {
          console.warn(`[Broadcast Migration] Could not migrate audience for broadcast ${broadcast.id}:`, e.message);
        }
      }
    }
    console.log(`[Broadcast Migration] Migrated ${existingBroadcasts.length} broadcasts to broadcast_audience`);

    // Commit transaction
    await conn.commit();
    console.log('[Broadcast Migration] Migration completed successfully!');
    
  } catch (err) {
    await conn.rollback();
    console.error('[Broadcast Migration] Migration failed:', err);
    throw err;
  } finally {
    conn.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('[Broadcast Migration] Fatal error:', err);
  process.exit(1);
});