/**
 * BSC Textiles Portal — User Tracking Controller
 * Tracks user login, logout, and activity events for monitoring and reporting.
 */

const pool = require('../config/db');
const auditService = require('../services/auditService');
const { successRes, errorRes } = require('../utils/response');
const { getLocationFilter, getEffectiveLocationId } = require('../middleware/auth');

// Track user login
async function trackLogin(req, res) {
  try {
    const { userId, username, ipAddress, userAgent, locationId, locationName } = req.body;
    
    if (!userId && !username) {
      return errorRes(res, 'Username or user ID is required', [], 400);
    }

    // Log to audit_logs
    await auditService.log({
      req,
      action: 'USER_LOGIN',
      module: 'UserTracking',
      details: { locationId, locationName },
      userId,
      username,
      success: true
    });

    // Also store in user_sessions for active user tracking
    try {
      await pool.query(
        `INSERT INTO user_sessions 
        (user_id, username, session_id, ip_address, user_agent, login_time, location_id, location_name, is_active)
        VALUES (?, ?, ?, ?, ?, NOW(), ?, ?, TRUE)
        ON DUPLICATE KEY UPDATE 
          session_id = VALUES(session_id),
          ip_address = VALUES(ip_address),
          user_agent = VALUES(user_agent),
          login_time = NOW(),
          location_id = VALUES(location_id),
          location_name = VALUES(location_name),
          is_active = TRUE`,
        [userId, username, req.body.sessionId || null, ipAddress, userAgent, locationId, locationName]
      );
    } catch (e) {
      // Table might not exist yet - create it
      await pool.query(
        `CREATE TABLE IF NOT EXISTS user_sessions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NULL,
          username VARCHAR(150) NOT NULL,
          session_id VARCHAR(255) NULL,
          ip_address VARCHAR(50) NULL,
          user_agent TEXT NULL,
          login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          logout_time TIMESTAMP NULL,
          location_id INT NULL,
          location_name VARCHAR(150) NULL,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
      );
      
      // Retry the insert
      await pool.query(
        `INSERT INTO user_sessions 
        (user_id, username, session_id, ip_address, user_agent, login_time, location_id, location_name, is_active)
        VALUES (?, ?, ?, ?, ?, NOW(), ?, ?, TRUE)`,
        [userId, username, req.body.sessionId || null, ipAddress, userAgent, locationId, locationName]
      );
    }

    return successRes(res, {}, 'User login tracked successfully');
  } catch (err) {
    return errorRes(res, 'Failed to track login', [err.message], 500);
  }
}

// Track user logout
async function trackLogout(req, res) {
  try {
    const { userId, username, ipAddress, sessionId } = req.body;
    
    if (!userId && !username) {
      return errorRes(res, 'Username or user ID is required', [], 400);
    }

    // Log to audit_logs
    await auditService.log({
      req,
      action: 'USER_LOGOUT',
      module: 'UserTracking',
      userId,
      username,
      success: true
    });

    // Update user_sessions
    try {
      await pool.query(
        `UPDATE user_sessions 
        SET is_active = FALSE, logout_time = NOW()
        WHERE username = ? AND is_active = TRUE`,
        [username]
      );
    } catch (e) {
      // Ignore if table doesn't exist
    }

    return successRes(res, {}, 'User logout tracked successfully');
  } catch (err) {
    return errorRes(res, 'Failed to track logout', [err.message], 500);
  }
}

// Track user activity (page navigation, actions, etc.)
async function trackActivity(req, res) {
  try {
    const { userId, username, action, page, url, metadata, locationId } = req.body;
    
    if (!userId && !username) {
      return errorRes(res, 'Username or user ID is required', [], 400);
    }
    if (!action) {
      return errorRes(res, 'Action is required', [], 400);
    }

    // Log to audit_logs
    await auditService.log({
      req,
      action: `USER_ACTIVITY: ${action}`,
      module: 'UserTracking',
      details: { page, url, metadata },
      userId,
      username,
      success: true
    });

    return successRes(res, {}, 'User activity tracked successfully');
  } catch (err) {
    return errorRes(res, 'Failed to track activity', [err.message], 500);
  }
}

// Get active users
async function getActiveUsers(req, res) {
  try {
    const { clause: locClause, params: locParams } = await getLocationFilter(req, 'user_sessions');
    const [rows] = await pool.query(
      `SELECT 
        user_id as id,
        username,
        login_time,
        ip_address,
        location_id,
        location_name,
        user_agent,
        session_id
       FROM user_sessions 
       WHERE is_active = TRUE ${locClause}
       ORDER BY login_time DESC`,
      locParams
    );
    
    return successRes(res, { activeUsers: rows }, 'Active users retrieved');
  } catch (err) {
    return errorRes(res, 'Failed to get active users', [err.message], 500);
  }
}

// Get user tracking dashboard stats
async function getUserTrackingStats(req, res) {
  try {
    const results = {};
    const { clause: locClause, params: locParams } = await getLocationFilter(req, 'audit_logs');
    const { clause: usLocClause, params: usLocParams } = await getLocationFilter(req, 'us');

    // Total logins today
    try {
      const [[{ count }]] = await pool.query(
        `SELECT COUNT(*) as count FROM audit_logs WHERE action = 'USER_LOGIN' AND DATE(created_at) = CURDATE() ${locClause}`,
        locParams
      );
      results.totalLoginsToday = count || 0;
    } catch { results.totalLoginsToday = 0; }

    // Total logouts today
    try {
      const [[{ count }]] = await pool.query(
        `SELECT COUNT(*) as count FROM audit_logs WHERE action = 'USER_LOGOUT' AND DATE(created_at) = CURDATE() ${locClause}`,
        locParams
      );
      results.totalLogoutsToday = count || 0;
    } catch { results.totalLogoutsToday = 0; }

    // Currently active users from audit_logs (users who logged in but haven't logged out)
    try {
      const [rows] = await pool.query(
        `SELECT username, user_id, MAX(created_at) as last_activity
         FROM audit_logs 
         WHERE action IN ('USER_LOGIN', 'USER_ACTIVITY: Page Navigation')
         AND DATE(created_at) = CURDATE() ${locClause}
         GROUP BY username, user_id
         ORDER BY last_activity DESC`,
        locParams
      );
      results.activeUsersToday = rows.length;
      results.recentActiveUsers = rows.slice(0, 10);
    } catch { 
      results.activeUsersToday = 0;
      results.recentActiveUsers = [];
    }

    // Recent login activity
    try {
      const [rows] = await pool.query(
        `SELECT id, username, user_id, action, module, details, created_at, ip_address
         FROM audit_logs 
         WHERE action IN ('USER_LOGIN', 'USER_LOGOUT', 'USER_ACTIVITY: Page Navigation') ${locClause}
         ORDER BY created_at DESC LIMIT 20`,
        locParams
      );
      results.recentActivity = rows;
    } catch { results.recentActivity = []; }

    // Users by role (from active sessions)
    try {
      const [rows] = await pool.query(
        `SELECT 
          u.role,
          COUNT(DISTINCT us.username) as user_count
         FROM user_sessions us
         JOIN users u ON u.username = us.username
         WHERE us.is_active = TRUE ${usLocClause}
         GROUP BY u.role`,
        usLocParams
      );
      results.usersByRole = rows;
    } catch { results.usersByRole = []; }

    return successRes(res, results, 'User tracking stats retrieved');
  } catch (err) {
    return errorRes(res, 'Failed to get user tracking stats', [err.message], 500);
  }
}

// Get user activity history with filtering
async function getUserActivity(req, res) {
  try {
    const { userId, username, action, fromDate, toDate, limit, offset } = req.query;
    const { clause: locClause, params: locParams } = await getLocationFilter(req, 'audit_logs');
    
    const conditions = [];
    const params = [];

    if (username) { 
      conditions.push('username = ?'); 
      params.push(username); 
    }
    if (userId) { 
      conditions.push('user_id = ?'); 
      params.push(userId); 
    }
    if (action) { 
      conditions.push('action LIKE ?'); 
      params.push(`%${action}%`); 
    }
    if (fromDate) { 
      conditions.push('created_at >= ?'); 
      params.push(fromDate); 
    }
    if (toDate) { 
      conditions.push('created_at <= ?'); 
      params.push(toDate); 
    }

    // Only show user tracking related actions
    conditions.push("action LIKE 'USER_%' OR action LIKE '%USER_ACTIVITY%'");

    let where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : 'WHERE 1=1';
    where += ` ${locClause}`;
    const allParams = [...params, ...locParams];

    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500);
    const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

    // Get total count
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM audit_logs ${where}`, allParams
    );

    // Get paginated results
    const [rows] = await pool.query(
      `SELECT id, username, user_id, action, module, details, ip_address, created_at
       FROM audit_logs ${where}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...allParams, safeLimit, safeOffset]
    );

    return successRes(res, { 
      activity: rows.map(r => ({
        ...r,
        details: (() => { try { return r.details ? JSON.parse(r.details) : null; } catch { return null; } })()
      })),
      total,
      limit: safeLimit,
      offset: safeOffset
    }, 'User activity retrieved');
  } catch (err) {
    return errorRes(res, 'Failed to get user activity', [err.message], 500);
  }
}

module.exports = {
  trackLogin,
  trackLogout,
  trackActivity,
  getActiveUsers,
  getUserTrackingStats,
  getUserActivity
};
