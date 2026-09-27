const crypto = require('crypto');
const pool = require('../config/db');
const emailService = require('./emailService');

const VERIFICATION_TOKEN_EXPIRY_HOURS = 24;
const MAX_VERIFICATION_RESENDS = 3;
const VERIFICATION_RESEND_WINDOW_HOURS = 1;

class EmailVerificationService {
  generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  async createVerificationToken(userId, email, type = 'verify_email') {
    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO email_verification_tokens (user_id, email, token, type, expires_at) 
       VALUES (?, ?, ?, ?, ?)`,
      [userId, email, token, type, expiresAt]
    );

    return { token, expiresAt };
  }

  async sendVerificationEmail(user, baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000') {
    const { token, expiresAt } = await this.createVerificationToken(user.id, user.email, 'verify_email');
    const verificationUrl = `${baseUrl}/verify-email?token=${token}`;

    await emailService.sendVerificationEmail(user, verificationUrl);

    await this.logSecurityEvent(user.id, user.username, 'EMAIL_VERIFICATION_SENT', {
      email: user.email,
      expiresAt
    });

    return { success: true, expiresAt };
  }

  async verifyEmailToken(token) {
    try {
      const [rows] = await pool.query(
        `SELECT evt.*, u.username, u.email, u.full_name, u.email_verified 
         FROM email_verification_tokens evt
         JOIN users u ON u.id = evt.user_id
         WHERE evt.token = ? AND evt.type = 'verify_email' AND evt.used = FALSE`,
        [token]
      );

      if (!rows || rows.length === 0) {
        return { success: false, reason: 'INVALID_TOKEN', message: 'Invalid or expired verification link.' };
      }

      const record = rows[0];

      if (new Date(record.expires_at) < new Date()) {
        return { success: false, reason: 'TOKEN_EXPIRED', message: 'This verification link has expired. Please request a new one.' };
      }

      if (record.email_verified) {
        await pool.query(`UPDATE email_verification_tokens SET used = TRUE, used_at = NOW() WHERE id = ?`, [record.id]);
        return { success: false, reason: 'ALREADY_VERIFIED', message: 'This email is already verified. You can log in now.' };
      }

      await pool.query(`UPDATE users SET email_verified = 1, email_verified_at = NOW() WHERE id = ?`, [record.user_id]);
      await pool.query(`UPDATE email_verification_tokens SET used = TRUE, used_at = NOW() WHERE id = ?`, [record.id]);

      await this.logSecurityEvent(record.user_id, record.username, 'EMAIL_VERIFIED', {
        email: record.email,
        method: 'token_verification'
      });

      return { 
        success: true, 
        user: {
          id: record.user_id,
          username: record.username,
          email: record.email,
          fullName: record.full_name
        }
      };
    } catch (err) {
      console.error('[EmailVerificationService] verifyEmailToken error:', err.message);
      return { success: false, reason: 'SERVER_ERROR', message: 'Verification failed. Please try again.' };
    }
  }

  async resendVerificationEmail(userId, userEmail, userFullName, baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000') {
    const canResend = await this.canResendVerification(userId);
    if (!canResend.allowed) {
      return { 
        success: false, 
        reason: 'RESEND_RATE_LIMITED',
        message: `Please wait before requesting another verification email.`,
        remainingSeconds: canResend.remainingSeconds
      };
    }

    await this.recordVerificationResend(userId);
    return this.sendVerificationEmail({ id: userId, email: userEmail, fullName: userFullName }, baseUrl);
  }

  async canResendVerification(userId) {
    try {
      const [rows] = await pool.query(
        `SELECT COUNT(*) as count, MAX(created_at) as last_sent 
         FROM email_verification_tokens 
         WHERE user_id = ? AND type = 'verify_email' 
         AND created_at > DATE_SUB(NOW(), INTERVAL ? HOUR)`,
        [userId, VERIFICATION_RESEND_WINDOW_HOURS]
      );

      const count = rows?.[0]?.count || 0;
      if (count >= MAX_VERIFICATION_RESENDS) {
        const lastSent = new Date(rows[0].last_sent);
        const nextAllowed = new Date(lastSent.getTime() + VERIFICATION_RESEND_WINDOW_HOURS * 60 * 60 * 1000);
        const remainingSeconds = Math.ceil((nextAllowed.getTime() - Date.now()) / 1000);
        return { allowed: false, remainingSeconds: Math.max(0, remainingSeconds) };
      }

      return { allowed: true, remainingSeconds: 0 };
    } catch (err) {
      console.warn('[EmailVerificationService] canResendVerification error:', err.message);
      return { allowed: true, remainingSeconds: 0 };
    }
  }

  async recordVerificationResend(userId) {
    try {
      await pool.query(
        `INSERT INTO email_verification_tokens (user_id, email, token, type, expires_at, used) 
         SELECT u.id, u.email, 'RESEND_PLACEHOLDER', 'verify_email', NOW(), 1 
         FROM users u WHERE u.id = ?`,
        [userId]
      );
    } catch (err) {
      console.warn('[EmailVerificationService] recordVerificationResend error:', err.message);
    }
  }

  async checkEmailVerified(userId) {
    try {
      const [rows] = await pool.query(`SELECT email_verified FROM users WHERE id = ?`, [userId]);
      return rows?.[0]?.email_verified === 1;
    } catch (err) {
      console.warn('[EmailVerificationService] checkEmailVerified error:', err.message);
      return false;
    }
  }

  async logSecurityEvent(userId, username, action, details) {
    try {
      await pool.query(
        `INSERT INTO audit_logs (username, user_id, action, module, details, ip_address, created_at) 
         VALUES (?, ?, ?, 'EmailVerification', ?, NULL, NOW())`,
        [username || `user#${userId}`, userId, action, JSON.stringify(details)]
      );
    } catch (err) {
      console.warn('[EmailVerificationService] logSecurityEvent error:', err.message);
    }
  }

  async getVerificationStatus(userId) {
    try {
      const [rows] = await pool.query(
        `SELECT email_verified, email_verified_at FROM users WHERE id = ?`,
        [userId]
      );
      return rows?.[0] || { email_verified: 0, email_verified_at: null };
    } catch (err) {
      console.warn('[EmailVerificationService] getVerificationStatus error:', err.message);
      return { email_verified: 0, email_verified_at: null };
    }
  }
}

module.exports = new EmailVerificationService();