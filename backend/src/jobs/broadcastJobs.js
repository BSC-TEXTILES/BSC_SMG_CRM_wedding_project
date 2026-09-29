/**
 * Broadcast Background Jobs & Schedulers
 * - dispatchScheduled (every 1 min): Dispatches broadcasts that are scheduled for now
 * - expireBroadcasts (every 5 min): Marks broadcasts as expired when past expires_at
 * - cleanupOldDrafts (every 24 hours): Optionally cleans up very old drafts
 */

const pool = require('../config/db');
const { log: auditLog } = require('../services/auditService');

let dispatchInterval = null;
let expiryInterval = null;
let cleanupInterval = null;

async function dispatchScheduledBroadcasts() {
  try {
    const now = new Date();
    
    const [scheduledBroadcasts] = await pool.query(
      `SELECT * FROM broadcast_messages 
       WHERE status = 'Scheduled' 
       AND scheduled_at IS NOT NULL 
       AND scheduled_at <= ?`,
      [now]
    );
    
    for (const broadcast of scheduledBroadcasts) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        
        // Update status to Dispatched
        await conn.query(
          `UPDATE broadcast_messages 
           SET status = 'Dispatched', dispatched_at = NOW(), updated_at = NOW() 
           WHERE id = ?`,
          [broadcast.id]
        );
        
        // Resolve recipients
        const audienceGroups = broadcast.target_role.split(',').map(g => g.trim()).filter(g => g);
        const { where, params } = buildAudienceQuery(audienceGroups, { isGlobalAdmin: false, locationId: null });
        
        const query = `SELECT id FROM users WHERE active = 1 AND ${where}`;
        const [users] = await conn.query(query, params);
        
        if (users.length > 0) {
          const placeholders = users.map(() => '(?, ?, ?, ?, ?, NOW())').join(', ');
          const values = [];
          for (const user of users) {
            values.push(broadcast.id, user.id, now, null, 'PENDING');
          }
          
          await conn.query(
            `INSERT INTO broadcast_recipients (broadcast_id, user_id, delivered_at, read_at, status, created_at)
             VALUES ${placeholders}
             ON DUPLICATE KEY UPDATE status = VALUES(status), delivered_at = VALUES(delivered_at)`,
            values
          );
        }
        
        // Audit log
        await conn.query(
          `INSERT INTO broadcast_audit_log (broadcast_id, user_id, action, metadata, created_at)
           VALUES (?, ?, ?, ?, NOW())`,
          [broadcast.id, broadcast.created_by, 'AUTO_DISPATCHED', JSON.stringify({ 
            recipientCount: users.length, scheduledAt: broadcast.scheduled_at 
          })]
        );
        
        await conn.commit();
        
        // Emit socket event for real-time
        const io = global.broadcastIO;
        if (io) {
          io.emit('NEW_BROADCAST', { 
            ...broadcast, 
            status: 'Dispatched', 
            dispatched_at: new Date().toISOString(),
            recipients_count: users.length 
          });
        }
        
        console.info(`[BroadcastJob] Auto-dispatched broadcast ${broadcast.id} (${broadcast.title}) to ${users.length} recipients`);
        
      } catch (err) {
        await conn.rollback();
        console.error(`[BroadcastJob] Error dispatching broadcast ${broadcast.id}:`, err.message);
      } finally {
        conn.release();
      }
    }
  } catch (err) {
    console.error('[BroadcastJob] dispatchScheduledBroadcasts error:', err.message);
  }
}

function buildAudienceQuery(groups, user) {
  if (!groups || groups.length === 0) return { where: '1=0', params: [] };
  
  if (groups.includes('Everyone')) {
    return { where: '1=1', params: [] };
  }
  
  const conditions = [];
  const params = [];
  
  for (const group of groups) {
    switch (group) {
      case 'HR Team':
        conditions.push('(`role` = ? OR `role` = ?)');
        params.push('HR', 'HR Manager');
        break;
      case 'Recruiters':
        conditions.push('`role` = ?');
        params.push('Recruiter');
        break;
      case 'Store Managers':
        conditions.push('`role` IN (?, ?, ?)');
        params.push('Manager', 'Store Manager', 'Floor Manager');
        break;
      case 'Interview Panel':
        conditions.push('`role` = ?');
        params.push('Interviewer');
        break;
      case 'Employees':
        conditions.push('`role` NOT IN (?, ?, ?, ?)');
        params.push('Admin', 'Super Admin', 'System Administrator', 'Guest');
        break;
      case 'Admins':
        conditions.push('`role` IN (?, ?, ?)');
        params.push('Admin', 'Super Admin', 'System Administrator');
        break;
      default:
        conditions.push('`role` = ?');
        params.push(group);
    }
  }
  
  if (user && !user.isGlobalAdmin && user.locationId) {
    conditions.push('`location_id` = ?');
    params.push(user.locationId);
  }
  
  const where = conditions.length > 0 ? `(${conditions.join(' OR ')})` : '1=0';
  return { where, params };
}

async function expireBroadcasts() {
  try {
    const now = new Date();
    
    const [expiredBroadcasts] = await pool.query(
      `SELECT * FROM broadcast_messages 
       WHERE status IN ('Dispatched', 'Active', 'Sent')
       AND expires_at IS NOT NULL 
       AND expires_at <= ?`,
      [now]
    );
    
    for (const broadcast of expiredBroadcasts) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        
        await conn.query(
          `UPDATE broadcast_messages 
           SET status = 'Expired', updated_at = NOW() 
           WHERE id = ?`,
          [broadcast.id]
        );
        
        // Audit log
        await conn.query(
          `INSERT INTO broadcast_audit_log (broadcast_id, user_id, action, metadata, created_at)
           VALUES (?, ?, ?, ?, NOW())`,
          [broadcast.id, broadcast.created_by, 'EXPIRED', JSON.stringify({ 
            expiresAt: broadcast.expires_at 
          })]
        );
        
        await conn.commit();
        
        // Emit socket event
        const io = global.broadcastIO;
        if (io) {
          io.emit('BROADCAST_EXPIRED', { id: broadcast.id });
        }
        
        console.info(`[BroadcastJob] Expired broadcast ${broadcast.id} (${broadcast.title})`);
        
      } catch (err) {
        await conn.rollback();
        console.error(`[BroadcastJob] Error expiring broadcast ${broadcast.id}:`, err.message);
      } finally {
        conn.release();
      }
    }
  } catch (err) {
    console.error('[BroadcastJob] expireBroadcasts error:', err.message);
  }
}

async function cleanupOldDrafts() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const [oldDrafts] = await pool.query(
      `SELECT id FROM broadcast_messages 
       WHERE status = 'Draft' 
       AND updated_at < ?`,
      [thirtyDaysAgo]
    );
    
    for (const draft of oldDrafts) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        
        await conn.query('DELETE FROM broadcast_audience WHERE broadcast_id = ?', [draft.id]);
        await conn.query('DELETE FROM broadcast_recipients WHERE broadcast_id = ?', [draft.id]);
        await conn.query('DELETE FROM broadcast_audit_log WHERE broadcast_id = ?', [draft.id]);
        await conn.query('DELETE FROM broadcast_messages WHERE id = ?', [draft.id]);
        
        await conn.commit();
        console.info(`[BroadcastJob] Cleaned up old draft ${draft.id}`);
      } catch (err) {
        await conn.rollback();
        console.error(`[BroadcastJob] Error cleaning up draft ${draft.id}:`, err.message);
      } finally {
        conn.release();
      }
    }
  } catch (err) {
    console.error('[BroadcastJob] cleanupOldDrafts error:', err.message);
  }
}

function initBroadcastJobs(io) {
  global.broadcastIO = io;
  
  dispatchScheduledBroadcasts();
  expireBroadcasts();
  
  dispatchInterval = setInterval(dispatchScheduledBroadcasts, 60 * 1000);
  if (dispatchInterval.unref) dispatchInterval.unref();
  
  expiryInterval = setInterval(expireBroadcasts, 5 * 60 * 1000);
  if (expiryInterval.unref) expiryInterval.unref();
  
  cleanupInterval = setInterval(cleanupOldDrafts, 24 * 60 * 60 * 1000);
  if (cleanupInterval.unref) cleanupInterval.unref();
  
  console.info('[BroadcastJobs] Broadcast background scheduler initialized (1m dispatch, 5m expiry, 24h cleanup).');
}

function stopBroadcastJobs() {
  if (dispatchInterval) clearInterval(dispatchInterval);
  if (expiryInterval) clearInterval(expiryInterval);
  if (cleanupInterval) clearInterval(cleanupInterval);
  global.broadcastIO = null;
}

module.exports = {
  initBroadcastJobs,
  stopBroadcastJobs,
  dispatchScheduledBroadcasts,
  expireBroadcasts,
  cleanupOldDrafts
};