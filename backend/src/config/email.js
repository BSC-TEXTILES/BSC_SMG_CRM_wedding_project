let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  console.warn('[Email] nodemailer is not installed or failed to load:', e.message);
}

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!nodemailer) {
    console.warn('[Email] nodemailer is not available');
    return null;
  }

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) {
    console.warn('[Email] SMTP not configured. Emails will not be sent. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD in .env');
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
  });

  return transporter;
}

async function sendEmail({ to, subject, html, text, idempotencyKey, attachments, tags }) {
  // 1. Resend Node.js SDK
  if (process.env.RESEND_API_KEY) {
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromName = process.env.RESEND_FROM_NAME || 'BSC Textiles';
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    const from = `"${fromName}" <${fromEmail}>`;

    const payload = {
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text: text || (html ? html.replace(/<[^>]*>/g, '') : '')
    };

    if (idempotencyKey) payload.idempotencyKey = idempotencyKey;
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      payload.attachments = attachments;
    }
    if (tags && Array.isArray(tags) && tags.length > 0) {
      payload.tags = tags;
    }

    const { data, error } = await resend.emails.send(payload);

    if (error) {
      console.error('[Email] Resend error:', error);
      return { success: false, error: error.message };
    }

    console.log('[Email] Resend email sent successfully:', data.id);
    return { success: true, messageId: data.id, data };
  }

  // 2. SMTP Transporter Fallback
  const transport = getTransporter();
  if (!transport) {
    console.warn('[Email] Skipping send - SMTP not configured');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    const info = await transport.sendMail({ from, to, subject, html, text });
    console.log('[Email] Sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('[Email] Send failed:', err.message);
    return { success: false, error: err.message };
  }
}

async function sendWeddingRegistrationConfirmation(registration) {
  const { customer_name, mobile, email, registration_id, tracking_id, store_name, wedding_date, preferred_shopping_date, location_code } = registration;

  if (!email) {
    console.log('[Email] No email provided for registration', registration_id);
    return { success: false, error: 'No email address provided' };
  }

  const customerId = registration_id;
  const trackId = tracking_id || registration_id;
  const weddingDateFormatted = wedding_date ? new Date(wedding_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Not specified';
  const shopDateFormatted = preferred_shopping_date ? new Date(preferred_shopping_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Not specified';

  const subject = 'BSC Textiles — Wedding Request Successfully Registered';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%); padding: 30px; text-align: center;">
        <h1 style="color: #d4af37; margin: 0; font-size: 24px;">BSC Textiles Private</h1>
        <p style="color: #e2e8f0; margin: 5px 0 0; font-size: 12px; letter-spacing: 2px;">WEDDING REQUEST SUCCESSFULLY REGISTERED</p>
      </div>
      <div style="padding: 30px;">
        <p style="color: #333; font-size: 15px;">Dear <strong>${customer_name}</strong>,</p>
        <p style="color: #555; font-size: 14px; line-height: 1.6;">Thank you for choosing BSC Textiles. Your wedding request has been successfully registered. Our team members will connect with you shortly.</p>

        <div style="background: #f7fafc; border-left: 4px solid #d4af37; padding: 20px; margin: 20px 0; border-radius: 4px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; color: #718096; font-size: 13px; width: 180px;">Customer ID</td>
              <td style="padding: 6px 0; color: #1a365d; font-weight: bold; font-size: 15px;">${customerId}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #718096; font-size: 13px;">Tracking ID</td>
              <td style="padding: 6px 0; color: #1a365d; font-weight: bold; font-size: 15px;">${trackId}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #718096; font-size: 13px;">Registration Date</td>
              <td style="padding: 6px 0; color: #333; font-size: 14px;">${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #718096; font-size: 13px;">Selected Store</td>
              <td style="padding: 6px 0; color: #333; font-size: 14px;">${store_name} (${location_code})</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #718096; font-size: 13px;">Wedding Date</td>
              <td style="padding: 6px 0; color: #333; font-size: 14px;">${weddingDateFormatted}</td>
            </tr>
          </table>
        </div>

        <p style="color: #555; font-size: 14px; line-height: 1.6;">You can use your <strong>Tracking ID</strong> to check the status of your request.</p>

        <div style="text-align: center; margin: 25px 0;">
          <a href="${process.env.TRACKING_URL || 'http://localhost:5173/track'}" style="background: #1a365d; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">Track Your Request</a>
        </div>
      </div>
      <div style="background: #f7fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="color: #a0aec0; font-size: 12px; margin: 0;">Regards,<br/>BSC Textiles — Wedding Team</p>
        <p style="color: #a0aec0; font-size: 11px; margin: 5px 0 0;">This is an automated confirmation email. Please do not reply.</p>
      </div>
    </div>
  `;

  const textContent = `BSC Textiles - Wedding Request Successfully Registered

Dear ${customer_name},

Thank you for choosing BSC Textiles.

Your wedding request has been successfully registered.

Customer ID: ${customerId}
Tracking ID: ${trackId}
Registration Date: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
Selected Store: ${store_name} (${location_code})
Wedding Date: ${weddingDateFormatted}

Our team members will connect with you shortly.

You can use your Tracking ID to check the status of your request.

Regards,
BSC Textiles
Wedding Team`;

  return sendEmail({ to: email, subject, html, text: textContent });
}

module.exports = { sendEmail, sendWeddingRegistrationConfirmation };
