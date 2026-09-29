/**
 * Wedding WhatsApp Service
 * Manages location-specific WhatsApp templates (BEL, DAV, SHI),
 * variable interpolation, message preparation, and audit logging.
 */
const pool = require('../config/db');

// Location Profiles with actual verified store details
const STORE_LOCATION_PROFILES = {
  1: {
    code: 'BEL',
    city: 'Belagavi',
    store_name: 'BSC Exclusive Textiles — Belagavi',
    store_address: 'Khade Bazar, Belagavi, Karnataka - 590001',
    store_phone: '+91 831 242 5555',
    whatsapp_helpline: '+91 96069 98851'
  },
  2: {
    code: 'DAV',
    city: 'Davanagere',
    store_name: 'BSC Exclusive Textiles — Davanagere',
    store_address: 'Mandipet / Main Road, Davanagere, Karnataka - 577001',
    store_phone: '+91 8192 230 456',
    whatsapp_helpline: '+91 96069 98852'
  },
  3: {
    code: 'SHI',
    city: 'Shivamogga',
    store_name: 'BSC Exclusive Textiles — Shivamogga',
    store_address: 'Nehru Road / Durgigudi, Shivamogga, Karnataka - 577201',
    store_phone: '+91 8182 222 123',
    whatsapp_helpline: '+91 96069 98853'
  }
};

class WeddingWhatsAppService {
  /**
   * Get store profile for a given location ID
   */
  getStoreProfile(locationId) {
    const id = parseInt(locationId, 10);
    return STORE_LOCATION_PROFILES[id] || STORE_LOCATION_PROFILES[2]; // Default to Davanagere if unspecified
  }

  /**
   * Interpolate variables in text: {{customer_name}}, {{store_name}}, etc.
   */
  interpolate(text, vars) {
    if (!text) return '';
    return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
      return vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : '';
    });
  }

  /**
   * Generates location-specific templates filled with customer context.
   */
  generateTemplatesForCustomer(customer) {
    const store = this.getStoreProfile(customer.location_id);
    const cleanMobile = customer.mobile_number ? customer.mobile_number.replace(/\D/g, '').slice(-10) : '';

    const vars = {
      customer_name: customer.customer_name || 'Valued Customer',
      customer_code: customer.customer_code || '',
      store_name: store.store_name,
      store_city: store.city,
      store_address: store.store_address,
      store_phone: store.store_phone,
      wedding_date: customer.wedding_date ? new Date(customer.wedding_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'TBD',
      shopping_date: customer.expected_shopping_date ? new Date(customer.expected_shopping_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'TBD',
      telecaller_name: customer.assigned_telecaller || 'Your BSC Wedding Consultant',
      followup_date: customer.follow_up_date ? new Date(customer.follow_up_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Soon',
      followup_time: customer.preferred_call_time || 'as scheduled'
    };

    const templates = [
      {
        id: 'WELCOME_REGISTRATION',
        title: 'Welcome & Congratulations',
        category: 'Registration',
        text: this.interpolate(
`Namaste {{customer_name}} ji! 🙏
Heartiest congratulations from all of us at {{store_name}} on the upcoming wedding celebration in your family ({{wedding_date}})! 🎉

I am {{telecaller_name}}, your dedicated Wedding Trousseau Consultant. We have reserved our premier bridal silks, designer menswear, and family wedding collections for you.

📍 Store: {{store_address}}
📞 Helpline: {{store_phone}}

Please let us know your preferred dates for a personalized VIP trial lounge visit. Wishing you a wonderful day! 🌸`,
          vars
        )
      },
      {
        id: 'FOLLOWUP_SCHEDULED',
        title: 'Follow-up Call Confirmation',
        category: 'Follow-up',
        text: this.interpolate(
`Namaste {{customer_name}} ji! 🙏
This is {{telecaller_name}} from {{store_name}}.

As per our recent discussion, I have scheduled our next conversation on {{followup_date}} at {{followup_time}} to assist with your wedding shopping preparations.

If you have any specific saree, suit, or sherwani requirement before then, feel free to message here directly or call {{store_phone}}.

Looking forward to speaking with you! 🌸`,
          vars
        )
      },
      {
        id: 'SHOPPING_CONFIRMED',
        title: 'Wedding Shopping Confirmed',
        category: 'Confirmation',
        text: this.interpolate(
`Namaste {{customer_name}} ji! ✨
We are delighted to confirm your wedding shopping visit at {{store_name}} on {{shopping_date}}! 🛍️💍

Our bridal trousseau specialists and VIP shopping lounge have been reserved for you and your family.

📍 Location: {{store_address}}
📞 Helpline: {{store_phone}}
Coordinator: {{telecaller_name}}

We look forward to making your wedding shopping a truly royal experience! 🎊`,
          vars
        )
      },
      {
        id: 'VISIT_PLANNED',
        title: 'VIP Store Visit Planned',
        category: 'Visit',
        text: this.interpolate(
`Namaste {{customer_name}} ji! 🌸
Your visit to {{store_name}} has been planned for {{shopping_date}}.

Our collection curators are preparing the freshest pure silk weaves and groom ensembles specifically for your family trousseau.

📍 Store Address: {{store_address}}
📞 Contact: {{store_phone}} (Coordinator: {{telecaller_name}})

See you soon at BSC Textiles! 👑`,
          vars
        )
      },
      {
        id: 'CALL_NO_ANSWER',
        title: 'Missed Call / Follow-up Note',
        category: 'Callback',
        text: this.interpolate(
`Namaste {{customer_name}} ji,
I tried reaching you from {{store_name}} regarding your upcoming wedding shopping ({{wedding_date}}), but could not connect.

Whenever you are free, please reply to this message or call us at {{store_phone}}.
Coordinator: {{telecaller_name}}

Thank you and have a pleasant day! 🙏`,
          vars
        )
      }
    ];

    return {
      store,
      variables: vars,
      recipientMobile: cleanMobile ? `+91${cleanMobile}` : '',
      templates
    };
  }

  /**
   * Log a WhatsApp message sent to a customer and audit it.
   */
  async logMessage({
    customerId,
    customerCode = null,
    locationId,
    telecallerId = null,
    telecallerName = 'Telecaller',
    recipientMobile,
    templateType,
    templateName = null,
    messageText,
    status = 'SENT',
    failureReason = null
  }) {
    try {
      const cleanMobile = recipientMobile ? recipientMobile.replace(/\D/g, '').slice(-10) : '';
      const formattedMobile = cleanMobile ? `+91${cleanMobile}` : (recipientMobile || '');

      const [res] = await pool.query(`
        INSERT INTO wedding_whatsapp_logs (
          customer_id,
          customer_code,
          location_id,
          telecaller_id,
          telecaller_name,
          recipient_mobile,
          template_type,
          template_name,
          message_text,
          status,
          failure_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        customerId,
        customerCode,
        locationId,
        telecallerId,
        telecallerName,
        formattedMobile,
        templateType || 'CUSTOM',
        templateName || templateType || 'Custom Message',
        messageText,
        status,
        failureReason
      ]);

      // Audit log entry
      await pool.query(`
        INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details)
        VALUES (?, ?, ?, 'WhatsApp Message Sent', ?)
      `, [
        customerId,
        locationId,
        telecallerName,
        `Sent WhatsApp [${templateName || templateType}]: ${messageText.slice(0, 100)}...`
      ]);

      return {
        id: res.insertId,
        waUrl: `https://wa.me/91${cleanMobile}?text=${encodeURIComponent(messageText)}`
      };
    } catch (err) {
      console.error('[WeddingWhatsAppService.logMessage Error]', err);
      throw err;
    }
  }

  /**
   * Fetch WhatsApp message history for a customer
   */
  async getCustomerWhatsAppLogs(customerId) {
    try {
      const [rows] = await pool.query(`
        SELECT * FROM wedding_whatsapp_logs
        WHERE customer_id = ?
        ORDER BY created_at DESC
      `, [customerId]);
      return rows || [];
    } catch (err) {
      console.error('[WeddingWhatsAppService.getCustomerWhatsAppLogs Error]', err);
      return [];
    }
  }
}

module.exports = new WeddingWhatsAppService();
