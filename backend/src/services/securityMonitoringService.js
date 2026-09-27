const pool = require('../config/db');
const emailService = require('./emailService');

const MAX_FAILED_2FA_ATTEMPTS = 5;
const LOCKOUT_2FA_DURATION_HOURS = 1;
const NEW_LOCATION_WINDOW_HOURS = 24;
const MAX_NEW_LOCATIONS_PER_WINDOW = 3;
const INACTIVE_MONTHS_THRESHOLD = 12;
const INACTIVE_WARNING_DAYS = 30;
const GEOGRAPHIC_IMPOSSIBLE_SPEED_KMH = 800;

class SecurityMonitoringService {
  /**
   * Check for suspicious 2FA activity and auto-lock if needed
   */
  async check2faAnomaly(userId, username, ipAddress, userAgent) {
    try {
      // Get recent 2FA failures
      const [failRows] = await pool.query(
        `SELECT COUNT(*) as failures, MAX(created_at) as last_failure 
         FROM two_factor_otp 
         WHERE user_id = ? AND purpose = 'login' AND used = FALSE 
         AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
        [userId]
      );

      const failures = failRows?.[0]?.failures || 0;

      if (failures >= MAX_FAILED_2FA_ATTEMPTS) {
        // Lock 2FA for this user
        await this.lock2fa(userId, username, 'MAX_2FA_ATTEMPTS_EXCEEDED', ipAddress);
        return { locked: true, reason: 'MAX_2FA_ATTEMPTS_EXCEEDED' };
      }

      // Check for rapid 2FA attempts (bot behavior)
      const [rapidRows] = await pool.query(
        `SELECT COUNT(*) as attempts FROM two_factor_otp 
         WHERE user_id = ? AND purpose = 'login' 
         AND created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)`,
        [userId]
      );

      if (rapidRows?.[0]?.attempts >= 10) {
        await this.lock2fa(userId, username, 'RAPID_2FA_ATTEMPTS', ipAddress);
        return { locked: true, reason: 'RAPID_2FA_ATTEMPTS' };
      }

      return { locked: false };
    } catch (err) {
      console.warn('[SecurityMonitoring] check2faAnomaly error:', err.message);
      return { locked: false };
    }
  }

  async lock2fa(userId, username, reason, ipAddress) {
    try {
      const lockedUntil = new Date(Date.now() + LOCKOUT_2FA_DURATION_HOURS * 60 * 60 * 1000);
      
      await pool.query(
        `UPDATE users SET failed_2fa_attempts = failed_2fa_attempts + 1, locked_until_2fa = ? WHERE id = ?`,
        [lockedUntil, userId]
      );

      await this.logSecurityEvent(userId, username, '2FA_AUTO_LOCKED', {
        reason,
        ip: ipAddress,
        lockedUntil
      });

      // Get user email for notification
      const [userRows] = await pool.query(`SELECT email, full_name FROM users WHERE id = ?`, [userId]);
      if (userRows && userRows.length > 0) {
        await emailService.sendSecurityAlertEmail(
          { email: userRows[0].email, fullName: userRows[0].full_name, username },
          '2FA Account Locked',
          `Your account has been temporarily locked due to ${reason.replace(/_/g, ' ').toLowerCase()}. It will be unlocked in ${LOCKOUT_2FA_DURATION_HOURS} hour(s).`
        );
      }
    } catch (err) {
      console.warn('[SecurityMonitoring] lock2fa error:', err.message);
    }
  }

  async unlock2fa(userId, username, unlockedBy = 'auto') {
    try {
      await pool.query(
        `UPDATE users SET failed_2fa_attempts = 0, locked_until_2fa = NULL WHERE id = ?`,
        [userId]
      );

      await this.logSecurityEvent(userId, username, '2FA_UNLOCKED', {
        unlockedBy,
        timestamp: new Date()
      });
    } catch (err) {
      console.warn('[SecurityMonitoring] unlock2fa error:', err.message);
    }
  }

  /**
   * Detect anomalous login patterns (new locations, devices, geographic impossibility)
   */
  async detectAnomalousLogin(userId, username, ipAddress, userAgent, locationId) {
    try {
      const anomalies = [];

      // 1. Check for new location login
      const locationAnomaly = await this.checkNewLocation(userId, locationId, ipAddress);
      if (locationAnomaly) anomalies.push(locationAnomaly);

      // 2. Check for new device
      const deviceAnomaly = await this.checkNewDevice(userId, userAgent, ipAddress);
      if (deviceAnomaly) anomalies.push(deviceAnomaly);

      // 3. Check for geographic impossibility (impossible travel)
      const geoAnomaly = await this.checkGeographicImpossible(userId, locationId, ipAddress);
      if (geoAnomaly) anomalies.push(geoAnomaly);

      // 4. Check for multiple failed 2FA attempts
      const failed2faAnomaly = await this.checkFailed2faPattern(userId);
      if (failed2faAnomaly) anomalies.push(failed2faAnomaly);

      // Store anomalies and calculate risk score
      if (anomalies.length > 0) {
        await this.storeAnomalies(userId, anomalies);
        
        // Calculate aggregate risk score
        const riskScore = anomalies.reduce((sum, a) => sum + (a.riskScore || 10), 0);
        
        // Auto-action based on risk score
        if (riskScore >= 50) {
          await this.triggerHighRiskAction(userId, username, anomalies, riskScore);
        } else if (riskScore >= 25) {
          await this.triggerMediumRiskAction(userId, username, anomalies, riskScore);
        }

        return { anomalies, riskScore, actionTaken: riskScore >= 25 };
      }

      return { anomalies: [], riskScore: 0, actionTaken: false };
    } catch (err) {
      console.warn('[SecurityMonitoring] detectAnomalousLogin error:', err.message);
      return { anomalies: [], riskScore: 0, actionTaken: false };
    }
  }

  async checkNewLocation(userId, locationId, ipAddress) {
    if (!locationId) return null;

    try {
      const [rows] = await pool.query(
        `SELECT COUNT(*) as count FROM login_attempts 
         WHERE user_id = ? AND location_id = ? AND success = 1 
         AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)`,
        [userId, locationId]
      );

      const isKnownLocation = rows?.[0]?.count > 0;

      if (!isKnownLocation) {
        // Check if this is one of many new locations in short time
        const [newLocRows] = await pool.query(
          `SELECT COUNT(DISTINCT location_id) as new_locations 
           FROM login_attempts 
           WHERE user_id = ? AND success = 1 
           AND created_at > DATE_SUB(NOW(), INTERVAL ? HOUR)
           AND location_id NOT IN (
             SELECT location_id FROM login_attempts 
             WHERE user_id = ? AND success = 1 
             AND created_at < DATE_SUB(NOW(), INTERVAL ? HOUR)
           )`,
          [userId, NEW_LOCATION_WINDOW_HOURS, userId, NEW_LOCATION_WINDOW_HOURS]
        );

        const newLocationCount = newLocRows?.[0]?.new_locations || 0;
        
        return {
          anomalyType: 'new_location',
          details: { locationId, ipAddress, newLocationCount, windowHours: NEW_LOCATION_WINDOW_HOURS },
          riskScore: newLocationCount > MAX_NEW_LOCATIONS_PER_WINDOW ? 25 : 15
        };
      }
    } catch (err) {
      console.warn('[SecurityMonitoring] checkNewLocation error:', err.message);
    }
    return null;
  }

  async checkNewDevice(userId, userAgent, ipAddress) {
    if (!userAgent) return null;

    try {
      const deviceFingerprint = this.generateDeviceFingerprint(userAgent, ipAddress);
      
      const [rows] = await pool.query(
        `SELECT COUNT(*) as count FROM login_attempts 
         WHERE user_id = ? AND user_agent = ? AND success = 1 
         AND created_at > DATE_SUB(NOW(), INTERVAL 90 DAY)`,
        [userId, userAgent]
      );

      const isKnownDevice = rows?.[0]?.count > 0;

      if (!isKnownDevice) {
        return {
          anomalyType: 'new_device',
          details: { userAgent: userAgent.substring(0, 200), ipAddress, deviceFingerprint },
          riskScore: 10
        };
      }
    } catch (err) {
      console.warn('[SecurityMonitoring] checkNewDevice error:', err.message);
    }
    return null;
  }

  generateDeviceFingerprint(userAgent, ip) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(`${userAgent}|${ip}`).digest('hex').substring(0, 16);
  }

  async checkGeographicImpossible(userId, locationId, ipAddress) {
    if (!locationId) return null;

    try {
      // Get last successful login with location
      const [rows] = await pool.query(
        `SELECT location_id, created_at FROM login_attempts 
         WHERE user_id = ? AND success = 1 AND location_id IS NOT NULL 
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );

      if (!rows || rows.length === 0 || rows[0].location_id === locationId) {
        return null;
      }

      const lastLogin = rows[0];
      const hoursSinceLastLogin = (Date.now() - new Date(lastLogin.created_at).getTime()) / (1000 * 60 * 60);

      // If last login was very recent (< 1 hour) and locations are different,
      // flag as potentially impossible travel
      if (hoursSinceLastLogin < 1 && lastLogin.location_id !== locationId) {
        return {
          anomalyType: 'geographic_impossible',
          details: { 
            lastLocationId: lastLogin.location_id, 
            currentLocationId: locationId,
            hoursSinceLastLogin: Math.round(hoursSinceLastLogin * 100) / 100
          },
          riskScore: 30
        };
      }
    } catch (err) {
      console.warn('[SecurityMonitoring] checkGeographicImpossible error:', err.message);
    }
    return null;
  }

  async checkFailed2faPattern(userId) {
    try {
      const [rows] = await pool.query(
        `SELECT COUNT(*) as failures FROM two_factor_otp 
         WHERE user_id = ? AND purpose = 'login' AND used = FALSE 
         AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
        [userId]
      );

      const failures = rows?.[0]?.failures || 0;
      
      if (failures >= 3) {
        return {
          anomalyType: 'multiple_failed_2fa',
          details: { failures },
          riskScore: failures * 5
        };
      }
    } catch (err) {
      console.warn('[SecurityMonitoring] checkFailed2faPattern error:', err.message);
    }
    return null;
  }

  async storeAnomalies(userId, anomalies) {
    try {
      for (const anomaly of anomalies) {
        await pool.query(
          `INSERT INTO account_anomalies (user_id, anomaly_type, details, risk_score) 
           VALUES (?, ?, ?, ?)`,
          [userId, anomaly.anomalyType, JSON.stringify(anomaly.details), anomaly.riskScore]
        );
      }
    } catch (err) {
      console.warn('[SecurityMonitoring] storeAnomalies error:', err.message);
    }
  }

  async triggerHighRiskAction(userId, username, anomalies, riskScore) {
    try {
      // Lock account temporarily
      const lockedUntil = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
      await pool.query(
        `UPDATE users SET locked_until = ? WHERE id = ?`,
        [lockedUntil, userId]
      );

      await this.logSecurityEvent(userId, username, 'ACCOUNT_AUTO_LOCKED_HIGH_RISK', {
        anomalies: anomalies.map(a => a.anomalyType),
        riskScore,
        lockedUntil
      });

      // Notify user
      const [userRows] = await pool.query(`SELECT email, full_name FROM users WHERE id = ?`, [userId]);
      if (userRows && userRows.length > 0) {
        await emailService.sendSecurityAlertEmail(
          { email: userRows[0].email, fullName: userRows[0].full_name, username },
          'Security Alert: Account Temporarily Locked',
          `We detected unusual activity on your account. It has been temporarily locked for 2 hours. Anomalies detected: ${anomalies.map(a => a.anomalyType).join(', ')}. If this wasn't you, please contact support immediately.`
        );
      }
    } catch (err) {
      console.warn('[SecurityMonitoring] triggerHighRiskAction error:', err.message);
    }
  }

  async triggerMediumRiskAction(userId, username, anomalies, riskScore) {
    try {
      // Send notification but don't lock
      await this.logSecurityEvent(userId, username, 'ANOMALOUS_ACTIVITY_DETECTED', {
        anomalies: anomalies.map(a => a.anomalyType),
        riskScore
      });

      const [userRows] = await pool.query(`SELECT email, full_name FROM users WHERE id = ?`, [userId]);
      if (userRows && userRows.length > 0) {
        await emailService.sendSecurityAlertEmail(
          { email: userRows[0].email, fullName: userRows[0].full_name, username },
          'Security Alert: Unusual Activity Detected',
          `We detected unusual activity on your account. Anomalies: ${anomalies.map(a => a.anomalyType).join(', ')}. Please review your recent activity.`
        );
      }
    } catch (err) {
      console.warn('[SecurityMonitoring] triggerMediumRiskAction error:', err.message);
    }
  }

  /**
   * Check and deactivate inactive accounts
   */
  async checkAndDeactivateInactiveAccounts() {
    try {
      const [rows] = await pool.query(
        `SELECT u.id, u.username, u.email, u.full_name, u.last_login_at,
                DATEDIFF(NOW(), COALESCE(u.last_login_at, u.created_at)) as inactive_days
         FROM users u
         WHERE u.active = 1 
         AND u.email_verified = 1
         AND u.id NOT IN (SELECT DISTINCT user_id FROM login_attempts WHERE created_at > DATE_SUB(NOW(), INTERVAL ? MONTH))
         AND DATEDIFF(NOW(), COALESCE(u.last_login_at, u.created_at)) >= ?`,
        [INACTIVE_MONTHS_THRESHOLD, INACTIVE_MONTHS_THRESHOLD * 30]
      );

      for (const user of rows) {
        if (user.inactive_days >= INACTIVE_MONTHS_THRESHOLD * 30) {
          // Send warning email if not sent recently
          const [warningRows] = await pool.query(
            `SELECT COUNT(*) as count FROM security_events 
             WHERE user_id = ? AND event_type = 'inactive_warning' 
             AND created_at > DATE_SUB(NOW(), INTERVAL ? DAY)`,
            [user.id, INACTIVE_WARNING_DAYS]
          );

          if (warningRows[0].count === 0) {
            await emailService.sendInactiveWarningEmail(
              { email: user.email, fullName: user.full_name, username: user.username },
              Math.floor(user.inactive_days / 30),
              INACTIVE_WARNING_DAYS,
              process.env.FRONTEND_URL || 'https://bsctextiles.in'
            );

            await this.logSecurityEvent(user.id, user.username, 'INACTIVE_WARNING_SENT', {
              inactiveDays: user.inactive_days
            });
          } else if (user.inactive_days >= (INACTIVE_MONTHS_THRESHOLD + 1) * 30) {
            // Deactivate account
            await pool.query(`UPDATE users SET active = 0 WHERE id = ?`, [user.id]);
            
            await this.logSecurityEvent(user.id, user.username, 'ACCOUNT_DEACTIVATED_INACTIVE', {
              inactiveDays: user.inactive_days
            });
          }
        }
      }

      return { processed: rows.length };
    } catch (err) {
      console.warn('[SecurityMonitoring] checkAndDeactivateInactiveAccounts error:', err.message);
      return { processed: 0 };
    }
  }

  async logSecurityEvent(userId, username, action, details) {
    try {
      await pool.query(
        `INSERT INTO security_events (user_id, username, event_type, severity, details, ip_address, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [
          userId,
          username || `user#${userId}`,
          action,
          action.includes('HIGH_RISK') || action.includes('ACCOUNT_LOCKED') ? 'critical' : 'warning',
          JSON.stringify(details),
          details.ip || null
        ]
      );
    } catch (err) {
      console.warn('[SecurityMonitoring] logSecurityEvent error:', err.message);
    }
  }

  /**
   * Get security dashboard data for a user
   */
  async getUserSecurityDashboard(userId) {
    try {
      const [anomalies] = await pool.query(
        `SELECT anomaly_type, details, risk_score, auto_action_taken, resolved, created_at 
         FROM account_anomalies 
         WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`,
        [userId]
      );

      const [securityEvents] = await pool.query(
        `SELECT event_type, severity, details, resolved, created_at 
         FROM security_events 
         WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`,
        [userId]
      );

      const [recentLogins] = await pool.query(
        `SELECT ip_address, user_agent, location_id, success, created_at 
         FROM login_attempts 
         WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`,
        [userId]
      );

      const [activeSessions] = await pool.query(
        `SELECT ip_address, user_agent, location_id, last_activity_at, created_at 
         FROM user_sessions 
         WHERE user_id = ? AND is_active = 1 AND expires_at > NOW()
         ORDER BY last_activity_at DESC`,
        [userId]
      );

      return {
        anomalies: anomalies || [],
        securityEvents: securityEvents || [],
        recentLogins: recentLogins || [],
        activeSessions: activeSessions || []
      };
    } catch (err) {
      console.warn('[SecurityMonitoring] getUserSecurityDashboard error:', err.message);
      return { anomalies: [], securityEvents: [], recentLogins: [], activeSessions: [] };
    }
  }
}

module.exports = new SecurityMonitoringService();