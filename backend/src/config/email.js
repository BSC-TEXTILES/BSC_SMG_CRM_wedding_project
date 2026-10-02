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

  // Hostinger SMTP defaults as requested
  const host = process.env.SMTP_HOST || 'smtp.hostinger.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.EMAIL_PASS;

  if (!user || !pass) {
    console.warn('[Email] SMTP credentials not set. Set SMTP_USER and SMTP_PASS in .env');
    return null;
  }

  try {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: { rejectUnauthorized: false }
    });
    console.log(`[Email] Hostinger SMTP transporter initialized (${host}:${port})`);
    return transporter;
  } catch (err) {
    console.error('[Email] Failed to create transport:', err.message);
    return null;
  }
}

async function sendEmail({ to, subject, html, text, idempotencyKey, attachments, tags }) {
  if (!to) {
    return { success: false, error: 'Recipient email address is required' };
  }

  // 1. Resend Node.js SDK (if API key present)
  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = require('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      const fromName = process.env.RESEND_FROM_NAME || process.env.EMAIL_FROM_NAME || 'BSC Textiles';
      const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.SMTP_FROM || 'onboarding@resend.dev';
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
        console.error('[Email] Resend error, attempting SMTP fallback:', error);
      } else {
        console.log('[Email] Resend email sent successfully:', data?.id);
        return { success: true, messageId: data?.id, data };
      }
    } catch (sdkErr) {
      console.warn('[Email] Resend attempt threw error, attempting SMTP fallback:', sdkErr.message);
    }
  }

  // 2. SMTP Transporter (Hostinger SMTP default: smtp.hostinger.com:465)
  const transport = getTransporter();
  if (!transport) {
    console.warn('[Email] Skipping send - SMTP credentials not configured in environment (SMTP_USER/SMTP_PASS)');
    return { success: false, error: 'Email service not configured in environment' };
  }

  try {
    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@bsctextiles.in';
    const fromName = process.env.EMAIL_FROM_NAME || 'BSC Textiles';
    const from = fromAddress.includes('<') ? fromAddress : `"${fromName}" <${fromAddress}>`;

    const info = await transport.sendMail({
      from,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html,
      text: text || (html ? html.replace(/<[^>]*>/g, '') : '')
    });
    console.log('[Email] Hostinger SMTP Sent:', info.messageId, 'to:', to);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('[Email] Hostinger SMTP Send failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Trigger 1: Thank-you email sent to customer after submitting public feedback.
 */
async function sendFeedbackCustomerEmail({ to, customerName, storeName, locationCode, rating, refNo, comments }) {
  if (!to || !to.includes('@')) {
    return { success: false, error: 'No valid recipient email provided' };
  }

  const name = customerName || 'Valued Patron';
  const store = storeName || `BSC Textiles (${locationCode || 'Store'})`;
  const ratingStars = rating ? '★'.repeat(Math.min(5, Math.max(1, Number(rating)))) : '5★';
  const reference = refNo || `BSC-${Date.now().toString().slice(-6)}`;

  const subject = `Thank You for Your Feedback — BSC Textiles ${locationCode || ''}`.trim();

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #E2DDD2;">
      <div style="background: linear-gradient(135deg, #123C35 0%, #1A5247 100%); padding: 32px 24px; text-align: center;">
        <span style="display: inline-block; padding: 4px 14px; background: rgba(201, 164, 92, 0.2); border: 1px solid #C9A45C; border-radius: 999px; color: #C9A45C; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 12px;">
          Patron Voice Acknowledged
        </span>
        <h1 style="color: #ffffff; margin: 0 0 6px; font-size: 24px; font-weight: 800; letter-spacing: -0.02em;">BSC Textiles</h1>
        <p style="color: #F7F4ED; margin: 0; font-size: 13px; opacity: 0.9;">${store}</p>
      </div>
      
      <div style="padding: 32px 28px;">
        <p style="color: #182033; font-size: 16px; margin: 0 0 16px;">Dear <strong>${name}</strong>,</p>
        <p style="color: #687080; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
          Thank you for gracing us with your presence and for taking the time to share your feedback. Every response directly guides our store managers and master stylists to elevate your boutique experience.
        </p>

        <div style="background: #F7F4ED; border: 1px solid #E2DDD2; border-left: 4px solid #C9A45C; border-radius: 8px; padding: 18px 20px; margin: 24px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr>
              <td style="padding: 6px 0; color: #687080; width: 140px;">Acknowledgment Ref:</td>
              <td style="padding: 6px 0; color: #123C35; font-weight: 700; font-family: monospace;">${reference}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #687080;">Store Visited:</td>
              <td style="padding: 6px 0; color: #182033; font-weight: 600;">${store}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #687080;">Overall Rating:</td>
              <td style="padding: 6px 0; color: #C9A45C; font-weight: 800; font-size: 15px;">${ratingStars} (${rating || 5}/5)</td>
            </tr>
            ${comments ? `
            <tr>
              <td style="padding: 6px 0; color: #687080; vertical-align: top;">Your Note:</td>
              <td style="padding: 6px 0; color: #182033; font-style: italic;">"${comments}"</td>
            </tr>` : ''}
          </table>
        </div>

        <p style="color: #687080; font-size: 13px; line-height: 1.6; margin: 0 0 24px;">
          Our leadership team regularly reviews your observations. We look forward to welcoming you back for your family's next milestone celebration.
        </p>

        <div style="text-align: center; margin: 28px 0 10px;">
          <a href="https://bsctextiles.in" style="background: #123C35; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 999px; font-weight: 700; font-size: 13px; display: inline-block; letter-spacing: 0.03em;">Explore BSC Collections</a>
        </div>
      </div>

      <div style="background: #F7F4ED; padding: 20px 24px; text-align: center; border-top: 1px solid #E2DDD2; color: #8C827A; font-size: 12px;">
        <p style="margin: 0 0 4px; font-weight: 600; color: #123C35;">BSC Textiles Private Limited</p>
        <p style="margin: 0;">Belagavi · Davanagere · Shivamogga</p>
        <p style="margin: 6px 0 0; font-size: 10px; color: #A09890;">This is an automated patron acknowledgement email.</p>
      </div>
    </div>
  `;

  return sendEmail({ to, subject, html });
}

/**
 * Trigger 1 (Admin alert): Sent to admin when a new feedback is submitted.
 */
async function sendFeedbackAdminNotification({ adminEmail, customerName, mobile, storeName, locationCode, rating, comments, isNegative, refNo }) {
  if (!adminEmail || !adminEmail.includes('@')) return { success: false, error: 'No admin email' };

  const prefix = isNegative ? '⚠️ ESCALATION: Negative Feedback' : '📝 New Feedback Received';
  const subject = `[BSC Alert] ${prefix} — ${storeName} (${rating || 0}★)`;

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
      <div style="background: ${isNegative ? '#8B0000' : '#123C35'}; color: #fff; padding: 20px 24px;">
        <h2 style="margin: 0; font-size: 18px;">${prefix}</h2>
        <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">Store: ${storeName} (${locationCode}) · Ref: ${refNo || 'N/A'}</p>
      </div>
      <div style="padding: 24px;">
        <p style="margin: 0 0 12px; font-size: 14px;"><strong>Customer:</strong> ${customerName || 'Anonymous'} | <strong>Contact:</strong> ${mobile || 'Not provided'}</p>
        <p style="margin: 0 0 12px; font-size: 14px;"><strong>Rating:</strong> <span style="font-size: 16px; color: #d4af37;">${'★'.repeat(Math.max(1, Number(rating) || 1))}</span> (${rating || 0}/5)</p>
        ${comments ? `<div style="background: #f7f7f7; padding: 12px; border-left: 3px solid ${isNegative ? '#8B0000' : '#123C35'}; font-size: 13px; font-style: italic; margin: 16px 0;">"${comments}"</div>` : ''}
        ${isNegative ? '<p style="color: #8B0000; font-weight: bold; font-size: 13px;">This feedback has been auto-queued to CallQueue for immediate manager follow-up.</p>' : ''}
      </div>
    </div>
  `;

  return sendEmail({ to: adminEmail, subject, html });
}

/**
 * Trigger 2: Welcome confirmation email to wedding couples registered via CRM or kiosk.
 */
async function sendWeddingCustomerWelcomeEmail({ to, customerName, customerCode, storeName, locationCode, weddingDate, shoppingDate, budget, leadSource }) {
  if (!to || !to.includes('@')) {
    return { success: false, error: 'No email provided' };
  }

  const name = customerName || 'Valued Couple';
  const code = customerCode || 'WED-REGISTERED';
  const store = storeName || 'BSC Textiles Boutique';
  const wDate = weddingDate ? new Date(weddingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'To be confirmed';
  const sDate = shoppingDate ? new Date(shoppingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'To be scheduled';

  const subject = `Welcome to BSC Textiles — Royal Wedding Experience (${code})`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #E2DDD2;">
      <div style="background: linear-gradient(135deg, #123C35 0%, #1A5247 100%); padding: 36px 24px; text-align: center;">
        <span style="display: inline-block; padding: 5px 16px; background: rgba(201, 164, 92, 0.2); border: 1px solid #C9A45C; border-radius: 999px; color: #C9A45C; font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 12px;">
          Royal Wedding Experience
        </span>
        <h1 style="color: #ffffff; margin: 0 0 6px; font-size: 24px; font-weight: 800;">BSC Textiles</h1>
        <p style="color: #F7F4ED; margin: 0; font-size: 13px;">Grand Silk Showrooms & Bridal Concierge</p>
      </div>

      <div style="padding: 32px 28px;">
        <p style="color: #182033; font-size: 16px; margin: 0 0 16px;">Dear <strong>${name}</strong>,</p>
        <p style="color: #687080; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
          Congratulations on your upcoming celebration! We are truly honoured that you have chosen BSC Textiles for your wedding journey. Your registration has been assigned to our dedicated Bridal & Wedding Concierge Desk.
        </p>

        <div style="background: #F7F4ED; border: 1px solid #E2DDD2; border-left: 4px solid #C9A45C; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr>
              <td style="padding: 6px 0; color: #687080; width: 160px;">Wedding Journey ID:</td>
              <td style="padding: 6px 0; color: #123C35; font-weight: 800; font-size: 15px; font-family: monospace;">${code}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #687080;">Selected Showroom:</td>
              <td style="padding: 6px 0; color: #182033; font-weight: 600;">${store}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #687080;">Celebration Date:</td>
              <td style="padding: 6px 0; color: #182033; font-weight: 600;">${wDate}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #687080;">Preferred Shopping Date:</td>
              <td style="padding: 6px 0; color: #182033; font-weight: 600;">${sDate}</td>
            </tr>
          </table>
        </div>

        <h3 style="color: #123C35; font-size: 15px; margin: 24px 0 10px;">What You Receive:</h3>
        <ul style="color: #687080; font-size: 13px; line-height: 1.7; padding-left: 20px; margin: 0 0 24px;">
          <li><strong>Private Bridal Lounge & Family Consultation</strong> with senior silk drapers.</li>
          <li><strong>Hand-curated Silk Sarees, Sherwanis & Designer Lehengas</strong> reserved for your trial.</li>
          <li><strong>Personal Concierge Coordination</strong> for alterations, matched accessories, and packaging.</li>
        </ul>

        <div style="text-align: center; margin: 30px 0 10px;">
          <a href="https://bsctextiles.in" style="background: #123C35; color: #ffffff; padding: 13px 32px; text-decoration: none; border-radius: 999px; font-weight: 700; font-size: 13px; display: inline-block;">View Bridal Showcase</a>
        </div>
      </div>

      <div style="background: #F7F4ED; padding: 20px 24px; text-align: center; border-top: 1px solid #E2DDD2; color: #8C827A; font-size: 12px;">
        <p style="margin: 0 0 4px; font-weight: 600; color: #123C35;">BSC Textiles — Wedding Concierge Division</p>
        <p style="margin: 0;">Belagavi · Davanagere · Shivamogga</p>
      </div>
    </div>
  `;

  return sendEmail({ to, subject, html });
}

/**
 * Trigger 2 (Admin alert): Alert sent to wedding desk / admin upon new registration.
 */
async function sendWeddingAdminAlert({ adminEmail, customerName, customerCode, mobile, storeName, weddingDate, budget, leadSource }) {
  if (!adminEmail || !adminEmail.includes('@')) return { success: false, error: 'No admin email' };

  const subject = `[Wedding CRM] New Wedding Registration: ${customerName} (${storeName})`;

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
      <div style="background: #123C35; color: #C9A45C; padding: 20px 24px;">
        <h2 style="margin: 0; color: #fff; font-size: 18px;">💍 New Wedding CRM Registration</h2>
        <p style="margin: 4px 0 0; color: #C9A45C; font-size: 13px;">Code: ${customerCode} · Store: ${storeName}</p>
      </div>
      <div style="padding: 24px; font-size: 14px; color: #333;">
        <p><strong>Customer:</strong> ${customerName} | <strong>Mobile:</strong> ${mobile || 'N/A'}</p>
        <p><strong>Wedding Date:</strong> ${weddingDate || 'TBD'} | <strong>Budget:</strong> ${budget || 'Not specified'}</p>
        <p><strong>Lead Source:</strong> ${leadSource || 'Store Walk-in'}</p>
      </div>
    </div>
  `;

  return sendEmail({ to: adminEmail, subject, html });
}

/**
 * Trigger 3: Executive Daily Report sent to Admin at Midnight (12:00 AM IST).
 */
async function sendDailyAdminReportEmail({ to, reportDate, reportData }) {
  if (!to || !to.includes('@')) {
    return { success: false, error: 'No admin recipient email configured' };
  }

  const {
    dateFormatted,
    totalFootfall = 0,
    storeFootfalls = [],
    totalFeedbacks = 0,
    storeFeedbacks = [],
    avgRating = '0.0',
    escalatedFeedbacks = 0,
    mcheckStats = { total: 0, passed: 0, failed: 0, complianceRate: 0, storeBreakdown: [] },
    vmStats = { totalSubmissions: 0, totalPhotos: 0, storeBreakdown: [] },
    weddingStats = { totalLeads: 0, storeBreakdown: [] }
  } = reportData;

  const subject = `BSC Textiles — Executive Daily Summary Report [${dateFormatted}]`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 720px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #E2DDD2;">
      {/* Header */}
      <div style="background: linear-gradient(135deg, #123C35 0%, #1A5247 100%); padding: 32px 28px; text-align: center;">
        <span style="display: inline-block; padding: 4px 14px; background: rgba(201, 164, 92, 0.2); border: 1px solid #C9A45C; border-radius: 999px; color: #C9A45C; font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 12px;">
          Midnight Executive Briefing
        </span>
        <h1 style="color: #ffffff; margin: 0 0 6px; font-size: 24px; font-weight: 800;">BSC Textiles — Daily Operational Report</h1>
        <p style="color: #F7F4ED; margin: 0; font-size: 14px; opacity: 0.95;">Business Date: <strong>${dateFormatted}</strong></p>
      </div>

      {/* KPI Cards Ribbon */}
      <div style="padding: 24px 28px; background: #FAF8F5; border-bottom: 1px solid #E2DDD2;">
        <table style="width: 100%; border-collapse: collapse; text-align: center;">
          <tr>
            <td style="padding: 12px; background: #ffffff; border: 1px solid #E2DDD2; border-radius: 8px; width: 25%;">
              <div style="font-size: 11px; color: #687080; font-weight: 700; text-transform: uppercase;">Total Footfall</div>
              <div style="font-size: 24px; font-weight: 800; color: #123C35; margin-top: 4px;">${totalFootfall.toLocaleString('en-IN')}</div>
              <div style="font-size: 10px; color: #9A958A;">Visitors Recorded</div>
            </td>
            <td style="width: 10px;"></td>
            <td style="padding: 12px; background: #ffffff; border: 1px solid #E2DDD2; border-radius: 8px; width: 25%;">
              <div style="font-size: 11px; color: #687080; font-weight: 700; text-transform: uppercase;">Feedbacks</div>
              <div style="font-size: 24px; font-weight: 800; color: #C9A45C; margin-top: 4px;">${totalFeedbacks}</div>
              <div style="font-size: 10px; color: #9A958A;">Avg: ${avgRating}★</div>
            </td>
            <td style="width: 10px;"></td>
            <td style="padding: 12px; background: #ffffff; border: 1px solid #E2DDD2; border-radius: 8px; width: 25%;">
              <div style="font-size: 11px; color: #687080; font-weight: 700; text-transform: uppercase;">M-Check</div>
              <div style="font-size: 24px; font-weight: 800; color: #123C35; margin-top: 4px;">${mcheckStats.complianceRate}%</div>
              <div style="font-size: 10px; color: #9A958A;">${mcheckStats.passed}/${mcheckStats.total} Passed</div>
            </td>
            <td style="width: 10px;"></td>
            <td style="padding: 12px; background: #ffffff; border: 1px solid #E2DDD2; border-radius: 8px; width: 25%;">
              <div style="font-size: 11px; color: #687080; font-weight: 700; text-transform: uppercase;">VM Photos</div>
              <div style="font-size: 24px; font-weight: 800; color: #123C35; margin-top: 4px;">${vmStats.totalPhotos}</div>
              <div style="font-size: 10px; color: #9A958A;">${vmStats.totalSubmissions} Submissions</div>
            </td>
          </tr>
        </table>
      </div>

      <div style="padding: 28px;">
        {/* Section 1: Store Footfall */}
        <h3 style="color: #123C35; font-size: 15px; margin: 0 0 12px; padding-bottom: 6px; border-bottom: 2px solid #C9A45C; display: flex; align-items: center; justify-content: space-between;">
          <span>1. Store Footfall Breakdown</span>
          <span style="font-size: 12px; color: #687080; font-weight: normal;">Total: ${totalFootfall.toLocaleString('en-IN')} visitors</span>
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px;">
          <thead>
            <tr style="background: #F7F4ED; text-align: left; color: #123C35;">
              <th style="padding: 8px 10px; border: 1px solid #E2DDD2;">Boutique Location</th>
              <th style="padding: 8px 10px; border: 1px solid #E2DDD2; text-align: right;">Total Visitors</th>
              <th style="padding: 8px 10px; border: 1px solid #E2DDD2; text-align: center;">Active Slots</th>
              <th style="padding: 8px 10px; border: 1px solid #E2DDD2; text-align: right;">Peak Traffic</th>
            </tr>
          </thead>
          <tbody>
            ${storeFootfalls.map(s => `
              <tr>
                <td style="padding: 8px 10px; border: 1px solid #E2DDD2; font-weight: 600;">${s.storeName}</td>
                <td style="padding: 8px 10px; border: 1px solid #E2DDD2; text-align: right; font-weight: 700; color: #123C35;">${Number(s.visitors || 0).toLocaleString('en-IN')}</td>
                <td style="padding: 8px 10px; border: 1px solid #E2DDD2; text-align: center;">${s.activeSlots || 12} / 12 hrs</td>
                <td style="padding: 8px 10px; border: 1px solid #E2DDD2; text-align: right; color: #C9A45C; font-weight: 600;">${s.peakHour || `${s.peakVisitors || 0} peak`}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        {/* Section 2: Customer Feedbacks */}
        <h3 style="color: #123C35; font-size: 15px; margin: 0 0 12px; padding-bottom: 6px; border-bottom: 2px solid #C9A45C;">
          2. Customer Feedbacks & Experience Ratings
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px;">
          <thead>
            <tr style="background: #F7F4ED; text-align: left; color: #123C35;">
              <th style="padding: 8px 10px; border: 1px solid #E2DDD2;">Boutique</th>
              <th style="padding: 8px 10px; border: 1px solid #E2DDD2; text-align: center;">Feedbacks</th>
              <th style="padding: 8px 10px; border: 1px solid #E2DDD2; text-align: center;">Avg Rating</th>
              <th style="padding: 8px 10px; border: 1px solid #E2DDD2; text-align: center;">Positive (4-5★)</th>
              <th style="padding: 8px 10px; border: 1px solid #E2DDD2; text-align: center;">Neutral (3★)</th>
              <th style="padding: 8px 10px; border: 1px solid #E2DDD2; text-align: center;">Negative (1-2★)</th>
            </tr>
          </thead>
          <tbody>
            ${storeFeedbacks.map(f => `
              <tr>
                <td style="padding: 8px 10px; border: 1px solid #E2DDD2; font-weight: 600;">${f.storeName}</td>
                <td style="padding: 8px 10px; border: 1px solid #E2DDD2; text-align: center; font-weight: 700;">${f.count}</td>
                <td style="padding: 8px 10px; border: 1px solid #E2DDD2; text-align: center; color: #C9A45C; font-weight: 700;">${f.avg}★</td>
                <td style="padding: 8px 10px; border: 1px solid #E2DDD2; text-align: center; color: #123C35;">${f.positive}</td>
                <td style="padding: 8px 10px; border: 1px solid #E2DDD2; text-align: center; color: #718096;">${f.neutral}</td>
                <td style="padding: 8px 10px; border: 1px solid #E2DDD2; text-align: center; color: ${f.negative > 0 ? '#C53030; font-weight: bold;' : '#718096;'}">${f.negative}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        {/* Section 3: M-Check & Visual Merchandising (VM) */}
        <h3 style="color: #123C35; font-size: 15px; margin: 0 0 12px; padding-bottom: 6px; border-bottom: 2px solid #C9A45C;">
          3. Store Audits & Display Compliance (M-Check & VM)
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px;">
          <thead>
            <tr style="background: #F7F4ED; text-align: left; color: #123C35;">
              <th style="padding: 8px 10px; border: 1px solid #E2DDD2;">Store</th>
              <th style="padding: 8px 10px; border: 1px solid #E2DDD2; text-align: center;">M-Check Audits</th>
              <th style="padding: 8px 10px; border: 1px solid #E2DDD2; text-align: center;">Compliance</th>
              <th style="padding: 8px 10px; border: 1px solid #E2DDD2; text-align: center;">VM Submissions</th>
              <th style="padding: 8px 10px; border: 1px solid #E2DDD2; text-align: center;">VM Photos Uploaded</th>
            </tr>
          </thead>
          <tbody>
            ${(mcheckStats.storeBreakdown || []).map((m, idx) => {
              const vm = (vmStats.storeBreakdown || [])[idx] || { submissions: 0, photos: 0 };
              return `
              <tr>
                <td style="padding: 8px 10px; border: 1px solid #E2DDD2; font-weight: 600;">${m.storeName}</td>
                <td style="padding: 8px 10px; border: 1px solid #E2DDD2; text-align: center;">${m.total} checks (${m.passed} passed)</td>
                <td style="padding: 8px 10px; border: 1px solid #E2DDD2; text-align: center; font-weight: 700; color: ${m.complianceRate >= 90 ? '#123C35;' : '#D69E2E;'}">${m.complianceRate}%</td>
                <td style="padding: 8px 10px; border: 1px solid #E2DDD2; text-align: center;">${vm.submissions || 0}</td>
                <td style="padding: 8px 10px; border: 1px solid #E2DDD2; text-align: center; font-weight: 600; color: #123C35;">${vm.photos || 0} photos</td>
              </tr>
            `;}).join('')}
          </tbody>
        </table>

        {/* Section 4: Wedding CRM Registrations */}
        <h3 style="color: #123C35; font-size: 15px; margin: 0 0 12px; padding-bottom: 6px; border-bottom: 2px solid #C9A45C;">
          4. Wedding CRM — New Couple Enquiries Today
        </h3>
        <p style="font-size: 13px; color: #687080; margin: 0 0 8px;">
          Total New Wedding Registrations: <strong>${weddingStats.totalLeads} couples</strong>
        </p>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 12px;">
          <tbody>
            ${(weddingStats.storeBreakdown || []).map(w => `
              <tr>
                <td style="padding: 6px 10px; border: 1px solid #E2DDD2; width: 60%; font-weight: 600;">${w.storeName}</td>
                <td style="padding: 6px 10px; border: 1px solid #E2DDD2; text-align: right; color: #123C35; font-weight: 700;">${w.count} wedding leads</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style="background: #F7F4ED; padding: 20px 28px; text-align: center; border-top: 1px solid #E2DDD2; color: #8C827A; font-size: 12px;">
        <p style="margin: 0 0 4px; font-weight: 700; color: #123C35;">BSC Textiles Private Limited — Executive Management System</p>
        <p style="margin: 0;">Dispatched automatically at 12:00 AM IST to ${to}</p>
      </div>
    </div>
  `;

  return sendEmail({ to, subject, html });
}

// Re-export original helper for backwards compatibility
async function sendWeddingRegistrationConfirmation(registration) {
  return sendWeddingCustomerWelcomeEmail({
    to: registration.email,
    customerName: registration.customer_name,
    customerCode: registration.registration_id || registration.tracking_id,
    storeName: registration.store_name,
    locationCode: registration.location_code,
    weddingDate: registration.wedding_date,
    shoppingDate: registration.preferred_shopping_date
  });
}

module.exports = {
  getTransporter,
  sendEmail,
  sendFeedbackCustomerEmail,
  sendFeedbackAdminNotification,
  sendWeddingCustomerWelcomeEmail,
  sendWeddingAdminAlert,
  sendDailyAdminReportEmail,
  sendWeddingRegistrationConfirmation
};
