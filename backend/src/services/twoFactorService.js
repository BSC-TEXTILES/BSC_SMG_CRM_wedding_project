const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const emailService = require('./emailService');

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 3;
const OTP_RESEND_WINDOW_MINUTES = 10;
const MAX_RESENDS_PER_WINDOW = 3;

class TwoFactorService {
  generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString().padStart(OTP_LENGTH, '0');
  }

  async hashOtp(otp) {
    return bcrypt.hash(otp, 12);
  }

  async verifyOtpHash(otp, hash) {
    return bcrypt.compare(otp, hash).catch(() => false);
  }

  async canResendOtp(userId, purpose = 'login') {
    try {
      const [rows] = await pool.query(
        `SELECT resend_count, window_start, locked_until 
         FROM otp_resend_limits 
         WHERE user_id = ? AND purpose = ?`,
        [userId, purpose]
      );

      if (!rows || rows.length === 0) {
        return { allowed: true, resendCount: 0, remainingSeconds: 0 };
      }

      const limit = rows[0];
      const now = new Date();

      if (limit.locked_until && new Date(limit.locked_until) > now) {
        const remainingSeconds = Math.ceil((new Date(limit.locked_until).getTime() - now.getTime()) / 1000);
        return { allowed: false, resendCount: limit.resend_count, remainingSeconds, locked: true };
      }

      const windowStart = new Date(limit.window_start);
      const windowElapsedMinutes = (now.getTime() - windowStart.getTime()) / (1000 * 60);

      if (windowElapsedMinutes >= OTP_RESEND_WINDOW_MINUTES) {
        return { allowed: true, resendCount: 0, remainingSeconds: 0 };
      }

      if (limit.resend_count >= MAX_RESENDS_PER_WINDOW) {
        const remainingSeconds = Math.ceil((OTP_RESEND_WINDOW_MINUTES * 60) - windowElapsedMinutes * 60);
        return { allowed: false, resendCount: limit.resend_count, remainingSeconds, locked: true };
      }

      return { allowed: true, resendCount: limit.resend_count, remainingSeconds: 0 };
    } catch (err) {
      console.error('[TwoFactorService] canResendOtp error:', err.message);
      return { allowed: true, resendCount: 0, remainingSeconds: 0 };
    }
  }

  async recordResend(userId, purpose = 'login') {
    try {
      await pool.query(
        `INSERT INTO otp_resend_limits (user_id, purpose, resend_count, window_start) 
         VALUES (?, ?, 1, NOW()) 
         ON DUPLICATE KEY UPDATE 
         resend_count = resend_count + 1,
         window_start = CASE 
           WHEN TIMESTAMPDIFF(MINUTE, window_start, NOW()) >= ? THEN NOW() 
           ELSE window_start 
         END,
         locked_until = CASE 
           WHEN resend_count + 1 >= ? THEN DATE_ADD(NOW(), INTERVAL ? MINUTE) 
           ELSE locked_until 
         END`,
        [userId, purpose, OTP_RESEND_WINDOW_MINUTES, MAX_RESENDS_PER_WINDOW, OTP_RESEND_WINDOW_MINUTES]
      );
    } catch (err) {
      console.warn('[TwoFactorService] recordResend error:', err.message);
    }
  }

  async sendOtp(user, purpose = 'login', expiryMinutes = OTP_EXPIRY_MINUTES) {
    const otp = this.generateOtp();
    const otpHash = await this.hashOtp(otp);
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    await pool.query(
      `INSERT INTO two_factor_otp (user_id, otp_hash, email, purpose, expires_at, max_attempts) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user.id, otpHash, user.email, purpose, expiresAt, MAX_OTP_ATTEMPTS]
    );

    await emailService.sendOtpEmail(user, otp, purpose, expiryMinutes);

    await this.logSecurityEvent(user.id, user.username, '2FA_OTP_SENT', {
      purpose,
      email: user.email,
      expiryMinutes
    });

    return { success: true, expiresAt };
  }

  async verifyOtp(userId, otp, purpose = 'login') {
    try {
      const [rows] = await pool.query(
        `SELECT id, otp_hash, attempts, max_attempts, expires_at, used 
         FROM two_factor_otp 
         WHERE user_id = ? AND purpose = ? AND used = FALSE 
         ORDER BY created_at DESC LIMIT 1`,
        [userId, purpose]
      );

      if (!rows || rows.length === 0) {
        await this.logSecurityEvent(userId, null, '2FA_VERIFY_FAILED', { reason: 'no_otp_found', purpose });
        return { success: false, reason: 'INVALID_OTP', message: 'Invalid or expired code. Please request a new one.' };
      }

      const otpRecord = rows[0];

      if (otpRecord.used) {
        return { success: false, reason: 'OTP_ALREADY_USED', message: 'This code has already been used.' };
      }

      if (new Date(otpRecord.expires_at) < new Date()) {
        await pool.query(`UPDATE two_factor_otp SET used = TRUE, used_at = NOW() WHERE id = ?`, [otpRecord.id]);
        return { success: false, reason: 'OTP_EXPIRED', message: 'This code has expired. Please request a new one.' };
      }

      if (otpRecord.attempts >= otpRecord.max_attempts) {
        await pool.query(`UPDATE two_factor_otp SET used = TRUE, used_at = NOW() WHERE id = ?`, [otpRecord.id]);
        await this.logSecurityEvent(userId, null, '2FA_LOCKED_MAX_ATTEMPTS', { purpose, attempts: otpRecord.attempts });
        return { success: false, reason: 'MAX_ATTEMPTS_EXCEEDED', message: 'Too many failed attempts. Please request a new code.' };
      }

      const isValid = await this.verifyOtpHash(otp, otpRecord.otp_hash);

      if (!isValid) {
        await pool.query(
          `UPDATE two_factor_otp SET attempts = attempts + 1 WHERE id = ?`,
          [otpRecord.id]
        );
        await this.logSecurityEvent(userId, null, '2FA_VERIFY_FAILED', { reason: 'invalid_otp', attempts: otpRecord.attempts + 1 });
        const remaining = otpRecord.max_attempts - otpRecord.attempts - 1;
        return { 
          success: false, 
          reason: 'INVALID_OTP', 
          message: `Invalid code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
          attemptsLeft: remaining
        };
      }

      await pool.query(
        `UPDATE two_factor_otp SET used = TRUE, used_at = NOW() WHERE id = ?`,
        [otpRecord.id]
      );

      await this.logSecurityEvent(userId, null, '2FA_VERIFY_SUCCESS', { purpose });

      return { success: true };
    } catch (err) {
      console.error('[TwoFactorService] verifyOtp error:', err.message);
      return { success: false, reason: 'SERVER_ERROR', message: 'Verification failed. Please try again.' };
    }
  }

  async resendOtp(userId, userEmail, userFullName, purpose = 'login') {
    const canResend = await this.canResendOtp(userId, purpose);
    if (!canResend.allowed) {
      return { 
        success: false, 
        reason: canResend.locked ? 'RESEND_RATE_LIMITED' : 'RESEND_NOT_ALLOWED',
        message: `Please wait ${Math.ceil(canResend.remainingSeconds / 60)} minute(s) before requesting another code.`,
        remainingSeconds: canResend.remainingSeconds
      };
    }

    const user = { id: userId, email: userEmail, fullName: userFullName };
    await this.recordResend(userId, purpose);
    return this.sendOtp(user, purpose);
  }

  async cleanupExpiredOtps() {
    try {
      await pool.query(
        `DELETE FROM two_factor_otp WHERE expires_at < NOW() OR used = TRUE`
      );
    } catch (err) {
      console.warn('[TwoFactorService] cleanupExpiredOtps error:', err.message);
    }
  }

  async logSecurityEvent(userId, username, action, details) {
    try {
      await pool.query(
        `INSERT INTO audit_logs (username, user_id, action, module, details, ip_address, created_at) 
         VALUES (?, ?, ?, '2FA', ?, NULL, NOW())`,
        [username || `user#${userId}`, userId, action, JSON.stringify(details)]
      );
    } catch (err) {
      console.warn('[TwoFactorService] logSecurityEvent error:', err.message);
    }
  }

  async getOtpStatus(userId, purpose = 'login') {
    try {
      const [rows] = await pool.query(
        `SELECT id, attempts, max_attempts, expires_at, used, created_at 
         FROM two_factor_otp 
         WHERE user_id = ? AND purpose = ? 
         ORDER BY created_at DESC LIMIT 1`,
        [userId, purpose]
      );
      return rows?.[0] || null;
    } catch (err) {
      console.warn('[TwoFactorService] getOtpStatus error:', err.message);
      return null;
    }
  }
}

module.exports = new TwoFactorService();