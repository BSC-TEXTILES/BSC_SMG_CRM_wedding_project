const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const path = require('path');

class EmailService {
  constructor() {
    this.resend = null;
    this.resendFrom = null;
    this.transporter = null;
    this.initialized = false;
    this.initClients();
  }

  initClients() {
    // 1. Initialize Resend Node.js SDK if RESEND_API_KEY is configured
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      try {
        this.resend = new Resend(resendApiKey);
        const fromName = process.env.RESEND_FROM_NAME || process.env.EMAIL_FROM_NAME || 'BSC Textiles';
        const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM_ADDRESS || 'onboarding@resend.dev';
        this.resendFrom = `"${fromName}" <${fromEmail}>`;
        this.initialized = true;
        console.log('[EmailService] Resend Node.js SDK initialized successfully');
      } catch (err) {
        console.error('[EmailService] Failed to initialize Resend client:', err.message);
        this.resend = null;
      }
    }

    // 2. Initialize SMTP transporter as fallback
    this.initTransporter();
  }

  initTransporter() {
    try {
      const host = process.env.SMTP_HOST || process.env.EMAIL_HOST;
      const port = parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || '587', 10);
      const secure = String(process.env.SMTP_SECURE || process.env.EMAIL_SECURE || 'false') === 'true';
      const user = process.env.SMTP_USER || process.env.EMAIL_USER;
      const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
      const fromName = process.env.EMAIL_FROM_NAME || 'BSC Textiles Private';
      const fromEmail = process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER || process.env.EMAIL_USER;

      if (!host || !user || !pass) {
        console.warn('[EmailService] SMTP credentials not configured. Emails will be logged instead of sent.');
        this.transporter = null;
        return;
      }

      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        rateDelta: 1000,
        rateLimit: 5
      });

      this.defaultFrom = `"${fromName}" <${fromEmail}>`;
      this.initialized = true;
      console.log('[EmailService] SMTP transporter initialized');
    } catch (err) {
      console.error('[EmailService] Failed to initialize transporter:', err.message);
      this.transporter = null;
    }
  }

  async sendEmail({ to, toName, subject, html, text, template, templateData, attachments, tags, idempotencyKey, priority = 'normal' }) {
    if (template && typeof this.renderTemplate === 'function') {
      const rendered = this.renderTemplate(template, templateData || {});
      subject = subject || rendered.subject;
      html = html || rendered.html;
    }

    const plainText = text || this.htmlToText(html);

    // 1. Resend Node.js SDK (Primary Email Provider)
    if (this.resend) {
      const payload = {
        from: this.resendFrom,
        to: Array.isArray(to) ? to : (toName ? [`"${toName}" <${to}>`] : [to]),
        subject,
        html,
        text: plainText
      };

      if (idempotencyKey) {
        payload.idempotencyKey = idempotencyKey;
      }
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        payload.attachments = attachments;
      }
      if (tags && Array.isArray(tags) && tags.length > 0) {
        payload.tags = tags;
      }

      const { data, error } = await this.resend.emails.send(payload);

      if (error) {
        console.error('[EmailService] Resend delivery error:', error);
        return { success: false, error: error.message };
      }

      console.log('[EmailService] Resend email delivered:', { id: data.id, to, subject });
      return { success: true, messageId: data.id, data };
    }

    // 2. SMTP Transporter (Fallback)
    if (this.transporter) {
      const emailData = {
        from: this.defaultFrom,
        to: toName ? `"${toName}" <${to}>` : to,
        subject,
        html,
        text: plainText
      };

      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        emailData.attachments = attachments;
      }

      try {
        const info = await this.transporter.sendMail(emailData);
        console.log('[EmailService] SMTP email sent:', { to, subject, messageId: info.messageId });
        return { success: true, messageId: info.messageId };
      } catch (err) {
        console.error('[EmailService] Failed to send email via SMTP:', err.message);
        return { success: false, error: err.message };
      }
    }

    // 3. Dev Mode Simulation
    console.log('[EmailService] [DEV MODE] Would send email:', { to, subject, html: html?.substring(0, 200) });
    return { success: true, devMode: true, messageId: `dev-${Date.now()}` };
  }

  htmlToText(html) {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  renderTemplate(templateName, data) {
    const templates = {
      otp: (d) => ({
        subject: d.subject || 'Your One-Time Passcode',
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f6f4ef;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #dfddd7;">
    <tr>
      <td style="padding:40px 30px;text-align:center;">
        <div style="width:60px;height:60px;border-radius:12px;background:#101c36;display:inline-flex;align-items:center;justify-content:center;margin-bottom:24px;border:2px solid #c9a45c;">
          <span style="font-size:24px;font-weight:800;color:#c9a45c;">${d.otp}</span>
        </div>
        <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#182033;">${d.title || 'Verification Code'}</h1>
        <p style="margin:0 0 24px;font-size:15px;color:#687080;line-height:1.6;">${d.message || 'Enter this code to complete your login.'}</p>
        <p style="margin:0 0 8px;font-size:13px;color:#687080;">This code expires in <strong>${d.expiryMinutes || 10} minutes</strong> and can only be used once.</p>
        <p style="margin:0;font-size:12px;color:#9a9a9a;">If you didn't request this, please ignore this email or contact support.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 30px;background:#f6f4ef;border-top:1px solid #dfddd7;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9a9a9a;">BSC Textiles • Secure Authentication</p>
      </td>
    </tr>
  </table>
</body>
</html>`
      }),
      verifyEmail: (d) => ({
        subject: d.subject || 'Verify Your Email Address',
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f6f4ef;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #dfddd7;">
    <tr>
      <td style="padding:40px 30px;text-align:center;">
        <div style="width:60px;height:60px;border-radius:12px;background:#101c36;display:inline-flex;align-items:center;justify-content:center;margin-bottom:24px;border:2px solid #c9a45c;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="#c9a45c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="22 4 12 14.01 9 11.01" stroke="#c9a45c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#182033;">Welcome to BSC Textiles!</h1>
        <p style="margin:0 0 24px;font-size:15px;color:#687080;line-height:1.6;">Thank you for registering. Please verify your email address to activate your account and access all features.</p>
        <a href="${d.verificationUrl}" style="display:inline-block;padding:14px 32px;background:#101c36;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;color:#c9a45c;border:2px solid #c9a45c;">Verify Email Address</a>
        <p style="margin:24px 0 0;font-size:13px;color:#9a9a9a;">Or copy this link: <br><span style="word-break:break-all;color:#101c36;">${d.verificationUrl}</span></p>
        <p style="margin:16px 0 0;font-size:12px;color:#9a9a9a;">This link expires in <strong>24 hours</strong> and can only be used once.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 30px;background:#f6f4ef;border-top:1px solid #dfddd7;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9a9a9a;">BSC Textiles • Account Security</p>
      </td>
    </tr>
  </table>
</body>
</html>`
      }),
      passwordReset: (d) => ({
        subject: d.subject || 'Password Reset Request',
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f6f4ef;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #dfddd7;">
    <tr>
      <td style="padding:40px 30px;text-align:center;">
        <div style="width:60px;height:60px;border-radius:12px;background:#101c36;display:inline-flex;align-items:center;justify-content:center;margin-bottom:24px;border:2px solid #c9a45c;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#c9a45c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" stroke="#c9a45c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#182033;">Reset Your Password</h1>
        <p style="margin:0 0 24px;font-size:15px;color:#687080;line-height:1.6;">You requested a password reset. Click the button below to create a new password.</p>
        <a href="${d.resetUrl}" style="display:inline-block;padding:14px 32px;background:#101c36;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;color:#c9a45c;border:2px solid #c9a45c;">Reset Password</a>
        <p style="margin:24px 0 0;font-size:13px;color:#9a9a9a;">Or copy this link: <br><span style="word-break:break-all;color:#101c36;">${d.resetUrl}</span></p>
        <p style="margin:16px 0 0;font-size:12px;color:#9a9a9a;">This link expires in <strong>1 hour</strong> and can only be used once.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 30px;background:#f6f4ef;border-top:1px solid #dfddd7;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9a9a9a;">BSC Textiles • Account Security</p>
      </td>
    </tr>
  </table>
</body>
</html>`
      }),
      accountLocked: (d) => ({
        subject: d.subject || 'Account Temporarily Locked',
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f6f4ef;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #dfddd7;">
    <tr>
      <td style="padding:40px 30px;text-align:center;">
        <div style="width:60px;height:60px;border-radius:12px;background:#b82837;display:inline-flex;align-items:center;justify-content:center;margin-bottom:24px;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="20" height="20" rx="4" stroke="#ffffff" stroke-width="2"/><path d="M12 9v4M12 17h.01" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/></svg>
        </div>
        <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#182033;">Account Locked for Security</h1>
        <p style="margin:0 0 24px;font-size:15px;color:#687080;line-height:1.6;">Your account has been temporarily locked after multiple failed login attempts.</p>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:24px 0;text-align:left;">
          <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#991b1b;">Lock Details:</p>
          <p style="margin:0;font-size:13px;color:#7f1d1d;">Reason: ${d.reason || '5 failed login attempts'}</p>
          <p style="margin:8px 0 0;font-size:13px;color:#7f1d1d;">Unlock in: ${d.unlockMinutes || 10} minutes</p>
        </div>
        <p style="margin:0;font-size:13px;color:#9a9a9a;">If this wasn't you, please contact support immediately.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 30px;background:#f6f4ef;border-top:1px solid #dfddd7;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9a9a9a;">BSC Textiles • Security Alert</p>
      </td>
    </tr>
  </table>
</body>
</html>`
      }),
      securityAlert: (d) => ({
        subject: d.subject || 'Security Alert - Unusual Activity Detected',
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f6f4ef;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #dfddd7;">
    <tr>
      <td style="padding:40px 30px;text-align:center;">
        <div style="width:60px;height:60px;border-radius:12px;background:#b87b19;display:inline-flex;align-items:center;justify-content:center;margin-bottom:24px;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="#101c36" stroke-width="2"/><path d="M12 9v4M12 17h.01" stroke="#101c36" stroke-width="2" stroke-linecap="round"/></svg>
        </div>
        <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#182033;">Security Alert</h1>
        <p style="margin:0 0 24px;font-size:15px;color:#687080;line-height:1.6;">We detected unusual activity on your account.</p>
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:24px 0;text-align:left;">
          <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#92400e;">${d.alertType || 'Unusual Activity'}</p>
          <p style="margin:0;font-size:13px;color:#78350f;">${d.details || 'Please review your recent activity.'}</p>
        </div>
        <p style="margin:0;font-size:13px;color:#9a9a9a;">If this wasn't you, please secure your account immediately.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 30px;background:#f6f4ef;border-top:1px solid #dfddd7;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9a9a9a;">BSC Textiles • Security Monitoring</p>
      </td>
    </tr>
  </table>
</body>
</html>`
      }),
      inactiveWarning: (d) => ({
        subject: d.subject || 'Account Inactivity Notice',
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f6f4ef;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #dfddd7;">
    <tr>
      <td style="padding:40px 30px;text-align:center;">
        <div style="width:60px;height:60px;border-radius:12px;background:#101c36;display:inline-flex;align-items:center;justify-content:center;margin-bottom:24px;border:2px solid #c9a45c;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="#c9a45c" stroke-width="2"/><path d="M12 6v6l4 2" stroke="#c9a45c" stroke-width="2" stroke-linecap="round"/></svg>
        </div>
        <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#182033;">Account Inactivity Notice</h1>
        <p style="margin:0 0 24px;font-size:15px;color:#687080;line-height:1.6;">Your account has been inactive for <strong>${d.inactiveMonths || 12} months</strong>.</p>
        <p style="margin:0 0 16px;font-size:14px;color:#687080;">To keep your account active, please log in within the next <strong>${d.warningDays || 30} days</strong>.</p>
        <a href="${d.loginUrl}" style="display:inline-block;padding:14px 32px;background:#101c36;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;color:#c9a45c;border:2px solid #c9a45c;">Log In Now</a>
        <p style="margin:24px 0 0;font-size:12px;color:#9a9a9a;">Accounts inactive for 12+ months may be deactivated per our security policy.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 30px;background:#f6f4ef;border-top:1px solid #dfddd7;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9a9a9a;">BSC Textiles • Account Management</p>
      </td>
    </tr>
  </table>
</body>
</html>`
      })
    };

    const template = templates[templateName];
    if (!template) {
      throw new Error(`Unknown email template: ${templateName}`);
    }
    return template(data);
  }

  async sendOtpEmail(user, otp, purpose = 'login', expiryMinutes = 10) {
    const templateData = {
      otp,
      title: purpose === 'login' ? 'Login Verification Code' : 'Verification Code',
      message: purpose === 'login' 
        ? 'Enter this code to complete your login to BSC Textiles.' 
        : 'Enter this code to verify your email address.',
      expiryMinutes
    };
    const { subject, html } = this.renderTemplate('otp', templateData);
    return this.sendEmail({
      to: user.email,
      toName: user.fullName || user.username,
      subject,
      html
    });
  }

  async sendVerificationEmail(user, verificationUrl) {
    const { subject, html } = this.renderTemplate('verifyEmail', {
      verificationUrl,
      fullName: user.fullName || user.username
    });
    return this.sendEmail({
      to: user.email,
      toName: user.fullName || user.username,
      subject,
      html
    });
  }

  async sendPasswordResetEmail(user, resetUrl) {
    const { subject, html } = this.renderTemplate('passwordReset', {
      resetUrl,
      fullName: user.fullName || user.username
    });
    return this.sendEmail({
      to: user.email,
      toName: user.fullName || user.username,
      subject,
      html
    });
  }

  async sendAccountLockedEmail(user, reason, unlockMinutes = 10) {
    const { subject, html } = this.renderTemplate('accountLocked', {
      reason,
      unlockMinutes
    });
    return this.sendEmail({
      to: user.email,
      toName: user.fullName || user.username,
      subject,
      html
    });
  }

  async sendSecurityAlertEmail(user, alertType, details) {
    const { subject, html } = this.renderTemplate('securityAlert', {
      alertType,
      details
    });
    return this.sendEmail({
      to: user.email,
      toName: user.fullName || user.username,
      subject,
      html
    });
  }

  async sendInactiveWarningEmail(user, inactiveMonths = 12, warningDays = 30, loginUrl) {
    const { subject, html } = this.renderTemplate('inactiveWarning', {
      inactiveMonths,
      warningDays,
      loginUrl: loginUrl || process.env.FRONTEND_URL || 'https://bsctextiles.in'
    });
    return this.sendEmail({
      to: user.email,
      toName: user.fullName || user.username,
      subject,
      html
    });
  }

  async queueEmail({ to, toName, subject, template, templateData, priority = 'normal' }) {
    const { html } = this.renderTemplate(template, templateData);
    const pool = require('../config/db');
    await pool.query(
      `INSERT INTO email_queue (to_email, to_name, subject, template, template_data, priority, status, scheduled_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [to, toName, subject, template, JSON.stringify(templateData), priority]
    );
    return { success: true, queued: true };
  }
}

module.exports = new EmailService();