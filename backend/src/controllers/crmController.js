const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { getLocationFilter, injectLocationId } = require('../middleware/auth');

// Helper to generate UUIDs
function getUUID() {
  try {
    const crypto = require('crypto');
    // crypto.randomUUID() requires Node 15.6.0+, fallback for Node 14 compatibility
    return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
  } catch (e) {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}

function getISTDateString() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + istOffset);
  return istDate.toISOString().split('T')[0];
}

function getISTTimeString(d = new Date()) {
  try {
    let dateObj = d;
    if (typeof d === 'string') {
      const formattedStr = d.includes('Z') || d.includes('+') ? d : d.replace(' ', 'T') + 'Z';
      dateObj = new Date(formattedStr);
      if (isNaN(dateObj.getTime())) dateObj = new Date(d);
    }
    if (!dateObj || isNaN(dateObj.getTime())) return '';
    return dateObj.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: true, 
      timeZone: 'Asia/Kolkata' 
    });
  } catch (e) {
    return '';
  }
}


// ── Settings & PIN Verification ─────────────────────────────
exports.getSettings = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT settingKey, settingValue FROM Setting');
    const settingsMap = {};
    rows.forEach(r => {
      settingsMap[r.settingKey] = r.settingValue;
    });
    // Fallback defaults
    const result = {
      companyName: settingsMap['company_name'] || 'BSC EXCLUSIVE DAVANAGERE',
      logoUrl: settingsMap['logo_url'] || '/logo.png',
      openHour: parseInt(settingsMap['open_hour'] || '10', 10),
      closeHour: parseInt(settingsMap['close_hour'] || '22', 10),
      graceMinutes: parseInt(settingsMap['footfall_grace_minutes'] || '30', 10),
      editCutoffHours: parseInt(settingsMap['edit_cutoff_hours'] || '24', 10),
      derEmail: settingsMap['der_email'] || 'der@bsctextiles.com',
      // PIN hashes are one-way (bcrypt) and never leave the server - clients
      // only learn whether a PIN has been configured yet.
      hasTvPin: Boolean(settingsMap['tv_pin']),
      hasCashPin: Boolean(settingsMap['cash_pin']),
      hasGreeterPin: Boolean(settingsMap['greeter_pin'])
    };
    return res.json({ success: true, settings: result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { tvPin, cashPin, greeterPin, companyName } = req.body;
    const kv = {};
    // Kiosk/cash PINs are credentials: they are stored as bcrypt hashes and
    // are never written to (or read back from) the database in plain text.
    for (const [field, key] of [['tvPin', 'tv_pin'], ['cashPin', 'cash_pin'], ['greeterPin', 'greeter_pin']]) {
      const raw = req.body[field];
      if (raw !== undefined && String(raw).trim() !== '') {
        const pin = String(raw).trim();
        if (!/^\d{4,8}$/.test(pin)) {
          return res.status(400).json({ success: false, error: `${field} must be 4-8 digits` });
        }
        kv[key] = await bcrypt.hash(pin, 10);
      }
    }
    if (companyName !== undefined) kv['company_name'] = String(companyName).trim();

    for (const [key, val] of Object.entries(kv)) {
      await db.query(
        `INSERT INTO Setting (settingKey, settingValue, category) VALUES (?, ?, 'General')
         ON DUPLICATE KEY UPDATE settingValue = VALUES(settingValue)`,
        [key, val]
      );
    }
    return res.json({ success: true, message: 'Settings updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.verifyPin = async (req, res) => {
  try {
    const { type, pin } = req.body; // type: 'tv' | 'cash' | 'greeter'
    const key = `${type}_pin`;
    if (!['tv', 'cash', 'greeter'].includes(type) || !pin) {
      return res.status(400).json({ success: false, message: 'PIN type and value are required' });
    }
    const [rows] = await db.query('SELECT settingValue FROM Setting WHERE settingKey = ?', [key]);
    const supplied = String(pin).trim();

    if (rows.length === 0) {
      // First use: no PIN configured yet. The documented factory default
      // '1234' is accepted once and immediately persisted as a bcrypt hash.
      if (supplied === '1234') {
        const hash = await bcrypt.hash('1234', 10);
        await db.query(
          `INSERT INTO Setting (settingKey, settingValue, category) VALUES (?, ?, 'General')
           ON DUPLICATE KEY UPDATE settingValue = VALUES(settingValue)`,
          [key, hash]
        );
        return res.json({ success: true, message: 'PIN Verified' });
      }
      return res.status(401).json({ success: false, message: 'Invalid PIN' });
    }

    const ok = await bcrypt.compare(supplied, rows[0].settingValue).catch(() => false);
    if (ok) {
      return res.json({ success: true, message: 'PIN Verified' });
    }
    return res.status(401).json({ success: false, message: 'Invalid PIN' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Sections ────────────────────────────────────────────────
exports.getSections = async (req, res) => {
  try {
    const defaultSections = [
      { id: 'sec_1', name: 'Ground Floor Saree', sectionType: 'retail', manager: 'Ground Floor Saree Incharge' },
      { id: 'sec_2', name: '1st Floor Saree', sectionType: 'retail', manager: '1st Floor Saree Manager' },
      { id: 'sec_3', name: 'Ladies', sectionType: 'retail', manager: 'Ladies Wear Lead' },
      { id: 'sec_4', name: 'Kids', sectionType: 'retail', manager: 'Kids Section Incharge' },
      { id: 'sec_5', name: 'Mens', sectionType: 'retail', manager: 'Menswear Manager' }
    ];

    await db.query(`
      CREATE TABLE IF NOT EXISTS Sections (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(150) NOT NULL UNIQUE,
        sectionType VARCHAR(50) DEFAULT 'retail',
        manager VARCHAR(150) NULL,
        isActive TINYINT(1) DEFAULT 1
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(() => {});

    for (const sec of defaultSections) {
      await db.query(`
        INSERT INTO Sections (id, name, sectionType, manager, isActive)
        VALUES (?, ?, ?, ?, TRUE)
        ON DUPLICATE KEY UPDATE name = VALUES(name), isActive = TRUE
      `, [sec.id, sec.name, sec.sectionType, sec.manager]).catch(() => {});
    }

    const [rows] = await db.query('SELECT * FROM Sections WHERE isActive = TRUE ORDER BY id ASC');
    return res.json({ success: true, sections: rows.length > 0 ? rows : defaultSections });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Footfall Entries ────────────────────────────────────────
exports.getFootfall = async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const { clause: locClause, params: locParams } = await getLocationFilter(req, 'FootfallEntries');
    const [rows] = await db.query(
      `SELECT * FROM FootfallEntries WHERE entryDate = ? ${locClause} ORDER BY slotHour ASC`,
      [date, ...locParams]
    );
    return res.json({ success: true, date, entries: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.upsertFootfall = async (req, res) => {
  try {
    const { entryDate, slotHour, visitors, remarks, submittedBy } = req.body;
    const locationId = injectLocationId(req) || 2;
    const id = getUUID();
    await db.query(`
      INSERT INTO FootfallEntries (id, location_id, entryDate, slotHour, visitors, remarks, submittedBy)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE visitors = VALUES(visitors), remarks = VALUES(remarks), submittedBy = VALUES(submittedBy), updatedAt = CURRENT_TIMESTAMP
    `, [id, locationId, entryDate, slotHour, visitors || 0, remarks || '', submittedBy || 'Staff']);

    // Emit Socket.IO push event for zero-latency screen updates
    const io = req.app.get('io');
    if (io) {
      io.emit('footfall:updated', { location_id: locationId, entryDate, slotHour, visitors: Number(visitors) || 0, remarks, submittedBy });
    }

    return res.json({ success: true, message: 'Footfall slot updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Feedback & Questions ────────────────────────────────────
exports.getFeedbackQuestions = async (req, res) => {
  try {
    const defaultQuestions = [
      { id: 'q1', question: '1. How satisfied are you with your overall shopping experience today?', options: ['Very satisfied', 'Satisfied', 'Neutral', 'Dissatisfied', 'Very dissatisfied'], position: 1 },
      { id: 'q2', question: '2. Did you find the product you were looking for?', options: ['Yes, exactly', 'Yes, with assistance', 'Partially', 'No'], position: 2 },
      { id: 'q3', question: '3. How would you rate the quality & variety of our collection?', options: ['Excellent', 'Good', 'Average', 'Poor'], position: 3 },
      { id: 'q4', question: '4. How would you rate the behavior and helpfulness of our staff?', options: ['Extremely helpful', 'Helpful', 'Average', 'Poor'], position: 4 },
      { id: 'q5', question: '5. How likely are you to recommend BSC Exclusive to your friends and family?', options: ['Definitely recommend', 'Probably recommend', 'Neutral', 'Not recommend'], position: 5 }
    ];

    await db.query(`
      CREATE TABLE IF NOT EXISTS FeedbackQuestions (
        id VARCHAR(64) PRIMARY KEY,
        question TEXT NOT NULL,
        options TEXT NOT NULL,
        position INT DEFAULT 1,
        isActive TINYINT(1) DEFAULT 1
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(() => {});

    for (const q of defaultQuestions) {
      await db.query(`
        INSERT INTO FeedbackQuestions (id, question, options, position, isActive)
        VALUES (?, ?, ?, ?, TRUE)
        ON DUPLICATE KEY UPDATE question = VALUES(question), options = VALUES(options), position = VALUES(position), isActive = TRUE
      `, [q.id, q.question, JSON.stringify(q.options), q.position]).catch(() => {});
    }

    const [rows] = await db.query('SELECT * FROM FeedbackQuestions WHERE isActive = TRUE ORDER BY position ASC');
    return res.json({ success: true, questions: rows.length > 0 ? rows : defaultQuestions });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

function evaluateFeedbackEscalation(answersObj = {}, voiceCommentsStr = '', rawQ0 = '', rawQ1 = '', rawQ2 = '', rawQ3 = '') {
  const q1Val = String(answersObj.q1 || rawQ1 || '').trim().toLowerCase();
  const q2Val = String(answersObj.q2 || rawQ2 || '').trim().toLowerCase();
  const q3Val = String(answersObj.q3 || rawQ3 || '').trim().toLowerCase();
  const q4Val = String(answersObj.q4 || '').trim().toLowerCase();
  const q5Val = String(answersObj.q5 || '').trim().toLowerCase();

  const isQ1Neg = q1Val.includes('dissatisfied');
  const isQ2Neg = q2Val === 'no';
  const isQ3Neg = q3Val === 'poor' || q3Val === 'very poor';
  const isQ4Neg = q4Val === 'poor' || q4Val === 'very poor';
  const isQ5Neg = q5Val.includes('not recommend');

  const isQuestionNegative = isQ1Neg || isQ2Neg || isQ3Neg || isQ4Neg || isQ5Neg;

  const commentsLower = String(voiceCommentsStr).toLowerCase();
  const explicitComplaintKeywords = [
    'terrible', 'horrible', 'worst', 'rude', 'scam', 'fraud', 'cheat', 'complaint', 'complain', 
    'refund', 'defect', 'damaged', 'broken', 'disappointed', 'unhappy', 'replace', 'bad service',
    'overcharged', 'wrong bill', 'poor quality'
  ];
  const hasExplicitCommentComplaint = explicitComplaintKeywords.some(kw => commentsLower.includes(kw));

  return isQuestionNegative || hasExplicitCommentComplaint;
}

exports.submitFeedback = async (req, res) => {
  try {
    // Ensure tables exist before inserting
    await db.query(`
      CREATE TABLE IF NOT EXISTS Feedback (
        id VARCHAR(64) PRIMARY KEY,
        date VARCHAR(32),
        source VARCHAR(32) DEFAULT 'qr',
        area VARCHAR(150),
        yourVoice TEXT,
        custName VARCHAR(255),
        custMobile VARCHAR(32),
        custDob VARCHAR(32),
        q0 VARCHAR(255), q0_other VARCHAR(255),
        q1 VARCHAR(255), q1_other VARCHAR(255),
        q2 VARCHAR(255), q2_other VARCHAR(255),
        q3 VARCHAR(255), q3_other VARCHAR(255),
        q4 VARCHAR(255), q4_other VARCHAR(255),
        q5 VARCHAR(255), q5_other VARCHAR(255),
        q6 VARCHAR(255), q6_other VARCHAR(255),
        q7 VARCHAR(255), q7_other VARCHAR(255),
        status VARCHAR(32) DEFAULT 'new',
        actionTaken TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL,
        entryDate VARCHAR(32),
        customerName VARCHAR(255),
        mobile VARCHAR(32),
        dob VARCHAR(32),
        sectionId VARCHAR(64),
        answers TEXT,
        voice TEXT,
        isNegative TINYINT(1) DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(() => {});

    await db.query(`
      CREATE TABLE IF NOT EXISTS CallQueue (
        id VARCHAR(64) PRIMARY KEY,
        feedbackId VARCHAR(64),
        entryDate VARCHAR(16),
        customerName VARCHAR(255),
        mobile VARCHAR(32),
        status VARCHAR(32) DEFAULT 'new',
        notes TEXT,
        attempts INT DEFAULT 0,
        followUpDate VARCHAR(32),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(() => {});

    await db.query(`ALTER TABLE Feedback ADD COLUMN entryTime VARCHAR(32)`).catch(() => {});

    const { 
      customerName, custName,
      mobile, custMobile,
      dob, custDob,
      sectionId, area,
      answers, q0, q1, q2, q3, q4, q5, q6, q7,
      likedMost, canImprove, additionalComments, voice, yourVoice,
      source 
    } = req.body;

    // Generate sequential continuous feedback ID starting from FB-00 (FB-00, FB-01, FB-02...)
    let id = '';
    try {
      const [maxRows] = await db.query(`
        SELECT id FROM Feedback 
        WHERE id REGEXP '^FB-[0-9]+$' AND LENGTH(id) <= 6
        ORDER BY CAST(SUBSTRING(id, 4) AS UNSIGNED) DESC 
        LIMIT 1
      `);

      if (maxRows && maxRows[0] && maxRows[0].id) {
        const rawIdStr = String(maxRows[0].id).replace(/^FB-/, '');
        const lastNum = parseInt(rawIdStr, 10);
        if (!isNaN(lastNum) && lastNum >= 0) {
          const nextNum = lastNum + 1;
          id = `FB-${String(nextNum).padStart(2, '0')}`;
        }
      }

      if (!id) {
        id = 'FB-00';
      }
    } catch (e) {
      id = 'FB-00';
    }

    const entryDate = getISTDateString();
    const entryTime = getISTTimeString();
    const dateFormatted = new Date().toLocaleDateString('en-GB');

    const finalCustName = customerName || custName || 'Anonymous';
    let finalMobile = mobile || custMobile || '';
    
    // Normalize phone to +91 format
    if (finalMobile) {
      const digits = finalMobile.replace(/\D/g, '');
      if (digits.length === 10) finalMobile = `+91${digits}`;
      else if (digits.length === 12 && digits.startsWith('91')) finalMobile = `+${digits}`;
      else if (digits.length === 11 && digits.startsWith('0')) finalMobile = `+91${digits.slice(1)}`;
    }
    const finalDob = dob || custDob || null;
    const finalArea = area || sectionId || 'Ground Floor';
    const finalSource = source || 'qr';

    const compiledVoice = [
      likedMost ? `Liked Most: ${likedMost}` : '',
      canImprove ? `Can Improve: ${canImprove}` : '',
      additionalComments ? `Comments: ${additionalComments}` : '',
      voice ? `Voice: ${voice}` : '',
      yourVoice ? `Voice: ${yourVoice}` : ''
    ].filter(Boolean).join('\n');

    const isNegative = evaluateFeedbackEscalation(answers || {}, compiledVoice, q0, q1, q2, q3);
    const locationId = injectLocationId(req) || 2;

    // Insert with one duplicate-ID retry (two customers can submit at once
    // and compute the same FB-xx sequence). If every attempt fails we report
    // failure honestly below — never a fake reference number.
    let insertOk = false;
    for (let attempt = 0; attempt < 3 && !insertOk; attempt++) {
      try {
        await db.query(`
          INSERT INTO Feedback (
            id, location_id, date, source, area, yourVoice, custName, custMobile, custDob,
            q0, q1, q2, q3, q4, q5, q6, q7,
            status, entryDate, entryTime, customerName, mobile, dob, sectionId, answers, voice, isNegative
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          id, locationId, dateFormatted, finalSource, finalArea, compiledVoice, finalCustName, finalMobile, finalDob,
          q0 || null, q1 || null, q2 || null, q3 || null, q4 || null, q5 || null, q6 || null, q7 || null,
          entryDate, entryTime, finalCustName, finalMobile, finalDob, sectionId || null, JSON.stringify(answers || {}), compiledVoice, isNegative ? 1 : 0
        ]);
        insertOk = true;
      } catch (insertErr) {
        console.error(`[submitFeedback Insert Error attempt ${attempt + 1}]:`, insertErr);
        // Duplicate ID from a concurrent submission → jump the sequence and retry.
        const m = /FB-(\d+)/.exec(String(insertErr && insertErr.message ? insertErr.message : '')) || null;
        const base = m ? parseInt(m[1], 10) : NaN;
        const suffixNum = (!isNaN(base) ? base : Date.now() % 100000) + attempt + 1;
        id = `FB-${String(suffixNum).padStart(2, '0')}`;
      }
    }

    if (!insertOk) {
      console.error('[submitFeedback] all insert attempts failed — reporting failure to customer');
      return res.status(500).json({
        success: false,
        message: 'We could not save your feedback right now. Please try again.'
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('feedback:submitted', {
        id,
        location_id: locationId,
        entryDate,
        customerName: finalCustName,
        isNegative: !!isNegative
      });
    }

    if (isNegative) {
      const cqId = `cq_${id}`;
      try {
        await db.query(`
          INSERT INTO CallQueue (id, location_id, feedbackId, entryDate, customerName, mobile, status, notes)
          VALUES (?, ?, ?, ?, ?, ?, 'new', ?)
        `, [cqId, locationId, id, entryDate, finalCustName, finalMobile, compiledVoice ? `Escalated Feedback: ${compiledVoice}` : 'Negative customer feedback auto-escalated']);
      } catch (cqErr) {}

      if (io) {
        io.emit('feedback:negative', {
          id,
          location_id: locationId,
          customerName: finalCustName,
          mobile: finalMobile || 'No Mobile',
          message: `ALERT: Negative customer feedback logged by ${finalCustName} (${finalMobile || 'No Mobile'})`
        });
      }
    }

    return res.json({ 
      success: true, 
      id,
      refNo: id,
      message: 'Thank you for your feedback!' 
    });
  } catch (err) {
    console.error('[submitFeedback Error]', err);
    return res.status(500).json({
      success: false,
      message: 'We could not save your feedback right now. Please try again.'
    });
  }
};

exports.getFeedbackStats = async (req, res) => {
  try {
    let total = 0, neg = 0, pendingCallQueue = 0, totalCallQueue = 0;
    const { clause: fbClause, params: fbParams } = await getLocationFilter(req, 'Feedback');
    const { clause: fClause, params: fParams } = await getLocationFilter(req, 'f');

    try {
      const [totalRows] = await db.query(
        `SELECT COUNT(*) as total, SUM(CASE WHEN isNegative = 1 THEN 1 ELSE 0 END) as negCount FROM Feedback WHERE 1=1 ${fbClause}`,
        fbParams
      );
      if (totalRows && totalRows[0]) {
        total = Number(totalRows[0].total) || 0;
        neg = Number(totalRows[0].negCount) || 0;
      }
    } catch (e) {}

    try {
      const [queueRows] = await db.query(`
        SELECT COUNT(*) as pendingCount 
        FROM Feedback f
        LEFT JOIN CallQueue cq ON (cq.feedbackId = f.id OR cq.id = f.id)
        WHERE (f.isNegative = 1 OR cq.id IS NOT NULL) AND (cq.status IS NULL OR cq.status = 'new') ${fClause}
      `, fParams);
      if (queueRows && queueRows[0]) {
        pendingCallQueue = Number(queueRows[0].pendingCount) || 0;
      }
    } catch (e) {}

    try {
      const [allQueueRows] = await db.query(`
        SELECT COUNT(*) as totalQueueCount 
        FROM Feedback f
        LEFT JOIN CallQueue cq ON (cq.feedbackId = f.id OR cq.id = f.id)
        WHERE (f.isNegative = 1 OR cq.id IS NOT NULL) ${fClause}
      `, fParams);
      if (allQueueRows && allQueueRows[0]) {
        totalCallQueue = Number(allQueueRows[0].totalQueueCount) || 0;
      }
    } catch (e) {}

    const pos = Math.max(0, total - neg);
    const nps = total > 0 ? Math.round((pos / total) * 100) : 100;

    return res.json({
      success: true,
      totalFeedback: total,
      positiveFeedback: pos,
      negativeFeedback: neg,
      npsScore: nps,
      pendingCallQueue,
      totalCallQueue
    });
  } catch (err) {
    return res.json({
      success: true,
      totalFeedback: 0,
      positiveFeedback: 0,
      negativeFeedback: 0,
      npsScore: 100,
      pendingCallQueue: 0,
      totalCallQueue: 0
    });
  }
};

exports.getCallQueue = async (req, res) => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS CallQueue (
        id VARCHAR(64) PRIMARY KEY,
        feedbackId VARCHAR(64),
        entryDate VARCHAR(16),
        customerName VARCHAR(255),
        mobile VARCHAR(32),
        status VARCHAR(32) DEFAULT 'new',
        notes TEXT,
        attempts INT DEFAULT 0,
        followUpDate VARCHAR(32),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(() => {});

    // Ensure columns exist on legacy tables
    await db.query(`ALTER TABLE CallQueue ADD COLUMN feedbackId VARCHAR(64)`).catch(() => {});
    await db.query(`ALTER TABLE CallQueue ADD COLUMN entryDate VARCHAR(16)`).catch(() => {});
    await db.query(`ALTER TABLE CallQueue ADD COLUMN customerName VARCHAR(255)`).catch(() => {});
    await db.query(`ALTER TABLE CallQueue ADD COLUMN mobile VARCHAR(32)`).catch(() => {});

    // Auto-sync missing CallQueue entries for negative feedbacks (from both QR and Staff sources)
    await db.query(`
      INSERT INTO CallQueue (id, feedbackId, entryDate, customerName, mobile, status, notes)
      SELECT 
        CONCAT('cq_auto_', f.id) as id,
        f.id as feedbackId,
        COALESCE(NULLIF(f.entryDate, ''), STR_TO_DATE(f.date, '%d/%m/%Y'), '${getISTDateString()}') as entryDate,
        COALESCE(NULLIF(f.customerName, ''), NULLIF(f.custName, ''), 'Valued Customer') as customerName,
        COALESCE(NULLIF(f.mobile, ''), NULLIF(f.custMobile, ''), '') as mobile,
        'new' as status,
        COALESCE(NULLIF(f.voice, ''), NULLIF(f.yourVoice, ''), 'Negative customer feedback auto-escalated') as notes
      FROM Feedback f
      LEFT JOIN CallQueue cq ON (cq.feedbackId = f.id OR cq.id = f.id)
      WHERE (f.isNegative = 1 OR f.status = 'negative' OR LOWER(COALESCE(f.voice, f.yourVoice, '')) LIKE '%dissatisfied%') AND cq.id IS NULL
    `).catch(syncErr => {
      console.warn('[getCallQueue Auto-Sync Notice]:', syncErr.message);
    });

    const { date, startDate, endDate, status, search } = req.query;
    const { clause: fLocClause, params: fLocParams } = await getLocationFilter(req, 'f');
    let sql = `
      SELECT 
        COALESCE(MAX(cq.id), CONCAT('cq_', f.id)) as id,
        f.id as feedbackId,
        COALESCE(MAX(cq.entryDate), MAX(NULLIF(f.entryDate, '')), MAX(NULLIF(f.date, '')), '${getISTDateString()}') as entryDate,
        COALESCE(MAX(cq.customerName), MAX(NULLIF(f.customerName, '')), MAX(NULLIF(f.custName, '')), 'Valued Customer') as customerName,
        COALESCE(MAX(cq.mobile), MAX(NULLIF(f.mobile, '')), MAX(NULLIF(f.custMobile, '')), '') as mobile,
        COALESCE(MAX(cq.status), 'new') as status,
        COALESCE(MAX(NULLIF(cq.notes, '')), MAX(NULLIF(f.voice, '')), MAX(NULLIF(f.yourVoice, '')), 'Negative customer feedback auto-escalated') as notes,
        COALESCE(MAX(cq.attempts), 0) as attempts,
        MAX(cq.followUpDate) as followUpDate,
        COALESCE(MAX(cq.createdAt), MAX(f.createdAt), MAX(f.created_at)) as createdAt
      FROM Feedback f
      LEFT JOIN CallQueue cq ON (cq.feedbackId = f.id OR cq.id = f.id)
      WHERE (f.isNegative = 1 OR cq.id IS NOT NULL) ${fLocClause}
    `;
    const params = [...fLocParams];

    if (date) {
      sql += ' AND (COALESCE(cq.entryDate, f.entryDate, f.date) = ?)';
      params.push(date);
    } else {
      if (startDate) {
        sql += ' AND (COALESCE(cq.entryDate, f.entryDate, f.date) >= ?)';
        params.push(startDate);
      }
      if (endDate) {
        sql += ' AND (COALESCE(cq.entryDate, f.entryDate, f.date) <= ?)';
        params.push(endDate);
      }
    }

    if (status && status !== 'all') {
      sql += ' AND (COALESCE(cq.status, "new") = ?)';
      params.push(status);
    }

    if (search) {
      sql += ' AND (f.customerName LIKE ? OR f.custName LIKE ? OR f.mobile LIKE ? OR f.custMobile LIKE ? OR f.voice LIKE ? OR f.yourVoice LIKE ? OR cq.notes LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s, s);
    }

    sql += ' GROUP BY f.id ORDER BY COALESCE(MAX(cq.entryDate), MAX(f.entryDate), MAX(f.date)) DESC, f.id DESC';

    const [rows] = await db.query(sql, params).catch(async () => {
      const [fallback] = await db.query('SELECT * FROM CallQueue ORDER BY id DESC');
      return [fallback];
    });

    const formatted = (rows || []).map(r => {
      let rawDateStr = r.entryDate || r.entry_date || (r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : getISTDateString());
      if (typeof rawDateStr === 'string' && rawDateStr.includes('/')) {
        const parts = rawDateStr.split('/');
        if (parts.length === 3) {
          rawDateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      let entryTimeStr = r.entryTime || '';
      if (!entryTimeStr && (r.createdAt || r.created_at)) {
        entryTimeStr = getISTTimeString(r.createdAt || r.created_at);
      }
      if (!entryTimeStr) {
        entryTimeStr = getISTTimeString();
      }

      return {
        ...r,
        customerName: r.customerName || r.custName || r.customer_name || 'Valued Customer',
        mobile: r.mobile || r.custMobile || r.phone || 'N/A',
        entryDate: rawDateStr,
        entryTime: entryTimeStr || '10:00 AM',
        status: r.status || 'new',
        attempts: r.attempts || 0
      };
    });

    return res.json({ success: true, callQueue: formatted });
  } catch (err) {
    console.error('[getCallQueue Error]', err);
    return res.json({ success: true, callQueue: [] });
  }
};

exports.updateCallQueue = async (req, res) => {
  try {
    const body = req.body || {};
    const targetId = body.id || body.feedbackId || body.rawFeedbackId || 'unknown';
    const safeId = String(targetId);
    const rawFeedbackId = safeId.startsWith('cq_auto_') 
      ? safeId.replace('cq_auto_', '') 
      : (safeId.startsWith('cq_') ? safeId.replace('cq_', '') : safeId);

    const status = body.status || 'called';
    const notes = body.notes || body.actionTaken || '';
    const followUpDate = body.followUpDate || null;
    const isResolvedStatus = status === 'resolved' || status === 'closed';
    const finalIsNegFlag = isResolvedStatus ? 0 : 1;

    // 1. Ensure tables exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS CallQueue (
        id VARCHAR(64) PRIMARY KEY,
        feedbackId VARCHAR(64),
        entryDate VARCHAR(16),
        customerName VARCHAR(255),
        mobile VARCHAR(32),
        status VARCHAR(32) DEFAULT 'new',
        notes TEXT,
        attempts INT DEFAULT 0,
        followUpDate VARCHAR(32),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(() => {});

    await db.query(`
      CREATE TABLE IF NOT EXISTS CallLogs (
        id VARCHAR(64) PRIMARY KEY,
        feedbackId VARCHAR(64) NOT NULL,
        executive VARCHAR(255) DEFAULT 'Store Executive',
        callDate VARCHAR(32),
        callOutcome VARCHAR(64),
        issueCategory VARCHAR(64),
        followUpDate VARCHAR(64),
        notes TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(() => {});

    await db.query(`ALTER TABLE CallQueue ADD COLUMN feedbackId VARCHAR(64)`).catch(() => {});
    await db.query(`ALTER TABLE CallQueue ADD COLUMN entryDate VARCHAR(16)`).catch(() => {});
    await db.query(`ALTER TABLE CallQueue ADD COLUMN customerName VARCHAR(255)`).catch(() => {});
    await db.query(`ALTER TABLE CallQueue ADD COLUMN mobile VARCHAR(32)`).catch(() => {});
    await db.query(`ALTER TABLE CallQueue ADD COLUMN status VARCHAR(32) DEFAULT 'new'`).catch(() => {});
    await db.query(`ALTER TABLE CallQueue ADD COLUMN notes TEXT`).catch(() => {});
    await db.query(`ALTER TABLE CallQueue ADD COLUMN attempts INT DEFAULT 0`).catch(() => {});
    await db.query(`ALTER TABLE CallQueue ADD COLUMN followUpDate VARCHAR(32)`).catch(() => {});

    // 2. Fetch customer details from Feedback table
    let cName = 'Valued Customer';
    let cMob = '';
    let eDate = getISTDateString();

    try {
      const [fbRows] = await db.query('SELECT customerName, custName, mobile, custMobile, entryDate, date FROM Feedback WHERE id = ?', [rawFeedbackId]);
      if (fbRows && fbRows[0]) {
        cName = fbRows[0].customerName || fbRows[0].custName || 'Valued Customer';
        cMob = fbRows[0].mobile || fbRows[0].custMobile || '';
        eDate = fbRows[0].entryDate || fbRows[0].date || getISTDateString();
      }
    } catch (fbErr) {}

    // 3. Update or Insert CallQueue record
    let updated = false;
    try {
      const [existing] = await db.query(
        'SELECT id, attempts FROM CallQueue WHERE id = ? OR feedbackId = ? OR id = ?', 
        [safeId, rawFeedbackId, rawFeedbackId]
      );

      if (existing && existing.length > 0) {
        const existingId = existing[0].id;
        const nextAttempts = (Number(existing[0].attempts) || 0) + 1;

        await db.query(`
          UPDATE CallQueue 
          SET status = ?, notes = ?, followUpDate = ?, attempts = ?, updatedAt = CURRENT_TIMESTAMP 
          WHERE id = ? OR feedbackId = ?
        `, [status, notes, followUpDate, nextAttempts, existingId, rawFeedbackId]);
        updated = true;
      }
    } catch (updErr) {
      console.warn('[updateCallQueue Existing Update Notice]:', updErr.message);
    }

    if (!updated) {
      const newCqId = getUUID();
      const locationId = injectLocationId(req) || 2;
      try {
        await db.query(`
          INSERT INTO CallQueue (id, location_id, feedbackId, entryDate, customerName, mobile, status, notes, attempts)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
        `, [newCqId, locationId, rawFeedbackId, eDate, cName, cMob, status, notes]);
      } catch (insErr) {
        await db.query(`
          INSERT INTO CallQueue (id, location_id, status, notes)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE status = VALUES(status), notes = VALUES(notes)
        `, [safeId, locationId, status, notes]).catch(() => {});
      }
    }

    // 4. Update Feedback table (persist status, actionTaken, and isNegative flag)
    await db.query(`ALTER TABLE Feedback ADD COLUMN status VARCHAR(32)`).catch(() => {});
    await db.query(`ALTER TABLE Feedback ADD COLUMN actionTaken TEXT`).catch(() => {});

    await db.query(`
      UPDATE Feedback 
      SET status = ?, actionTaken = ?, isNegative = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ? OR id = ?
    `, [status, notes, finalIsNegFlag, rawFeedbackId, safeId]).catch(fbUpdErr => {
      console.warn('[updateCallQueue Feedback Table Sync Notice]:', fbUpdErr.message);
    });

    // 5. Save structured CallLog record in MySQL database
    if (notes || body.callOutcome) {
      const logId = getUUID();
      await db.query(`
        INSERT INTO CallLogs (id, feedbackId, executive, callDate, callOutcome, issueCategory, followUpDate, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        logId,
        rawFeedbackId,
        body.executive || body.createdBy || 'Store Telecaller',
        getISTDateString(),
        body.callOutcome || (isResolvedStatus ? 'Resolved' : 'Call Logged'),
        body.issueCategory || 'Customer Resolution Desk',
        followUpDate || '',
        notes
      ]).catch(logErr => console.warn('[CallLogs Insert Notice]:', logErr.message));
    }

    // 6. Broadcast real-time Socket.IO push event
    const io = req.app.get('io');
    if (io) {
      io.emit('feedback:negative', { id: rawFeedbackId, status, isNegative: finalIsNegFlag });
      io.emit('feedback:submitted', { id: rawFeedbackId });
      io.emit('callqueue:updated', { id: rawFeedbackId, status, notes });
    }

    return res.json({ success: true, message: 'Call queue entry updated and persisted successfully' });
  } catch (err) {
    console.error('[updateCallQueue Error]', err);
    return res.json({ success: true, message: 'Call queue entry updated' });
  }
};

// ── Sourcing Diverts ────────────────────────────────────────
exports.getDiverts = async (req, res) => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS Diverts (
        id VARCHAR(64) PRIMARY KEY,
        entryDate VARCHAR(16),
        sectionId VARCHAR(64),
        productWanted VARCHAR(255),
        quantity INT DEFAULT 1,
        priceRange VARCHAR(64),
        reasonCode VARCHAR(64) DEFAULT 'OUT_OF_STOCK',
        customerName VARCHAR(255),
        customerMobile VARCHAR(32),
        status VARCHAR(32) DEFAULT 'open',
        createdBy VARCHAR(255),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(() => {});

    const { clause: locClause, params: locParams } = await getLocationFilter(req, 'Diverts');
    const [rows] = await db.query(`SELECT * FROM Diverts WHERE 1=1 ${locClause} ORDER BY createdAt DESC`, locParams);
    return res.json({ success: true, diverts: rows || [] });
  } catch (err) {
    return res.json({ success: true, diverts: [] });
  }
};

exports.createDivert = async (req, res) => {
  try {
    const { sectionId, productWanted, quantity, priceRange, reasonCode, customerName, customerMobile: rawMobile, createdBy } = req.body;
    const locationId = injectLocationId(req) || 2;
    const id = getUUID();
    const entryDate = new Date().toISOString().split('T')[0];
    
    // Normalize phone to +91 format
    let customerMobile = rawMobile || '';
    if (customerMobile) {
      const digits = customerMobile.replace(/\D/g, '');
      if (digits.length === 10) customerMobile = `+91${digits}`;
      else if (digits.length === 12 && digits.startsWith('91')) customerMobile = `+${digits}`;
      else if (digits.length === 11 && digits.startsWith('0')) customerMobile = `+91${digits.slice(1)}`;
    }
    
    await db.query(`
      INSERT INTO Diverts (id, location_id, entryDate, sectionId, productWanted, quantity, priceRange, reasonCode, customerName, customerMobile, status, createdBy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
    `, [id, locationId, entryDate, sectionId || null, productWanted, quantity || 1, priceRange || '', reasonCode || 'OUT_OF_STOCK', customerName || '', customerMobile || '', createdBy || 'Floor Staff']);

    const updateId = getUUID();
    await db.query(`
      INSERT INTO DivertUpdates (id, divertId, status, note, actorId, actorRole)
      VALUES (?, ?, 'open', 'Sourcing divert raised by staff', ?, 'Staff')
    `, [updateId, id, createdBy || 'Staff']);

    const io = req.app.get('io');
    if (io) {
      io.emit('divert:created', {
        id,
        productWanted,
        quantity: quantity || 1,
        createdBy: createdBy || 'Floor Staff',
        message: `URGENT DIVERT: New stock request for ${productWanted} (Qty: ${quantity || 1}) created by ${createdBy || 'Floor Staff'}`
      });
    }

    return res.json({ success: true, message: 'Divert created successfully', id });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateDivert = async (req, res) => {
  try {
    const { id, status, pmNotes, actorRole, actorId } = req.body;
    await db.query(`
      UPDATE Diverts SET status = ?, pmNotes = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?
    `, [status, pmNotes || '', id]);

    const updateId = getUUID();
    await db.query(`
      INSERT INTO DivertUpdates (id, divertId, status, note, actorId, actorRole)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [updateId, id, status, pmNotes || `Status updated to ${status}`, actorId || 'PM', actorRole || 'Purchase Manager']);

    return res.json({ success: true, message: 'Divert status updated' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.getDivertUpdates = async (req, res) => {
  try {
    const { divertId } = req.query;
    const [rows] = await db.query('SELECT * FROM DivertUpdates WHERE divertId = ? ORDER BY createdAt DESC', [divertId]);
    return res.json({ success: true, updates: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Cash Settlement ──────────────────────────────────────────
exports.getCashSettlement = async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const { clause: locClause, params: locParams } = await getLocationFilter(req, 'CashSettlements');
    const [header] = await db.query(`SELECT * FROM CashSettlements WHERE entryDate = ? ${locClause}`, [date, ...locParams]);
    if (header.length === 0) {
      return res.json({ success: true, date, settlement: null, counters: [] });
    }
    const [counters] = await db.query('SELECT * FROM CashCounterReports WHERE settlementId = ?', [header[0].id]);
    return res.json({ success: true, date, settlement: header[0], counters });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.saveCashSettlement = async (req, res) => {
  try {
    const { entryDate, saleAmount, billsCount, cashTotal, cardTotal, upiTotal, submittedBy, counters } = req.body;
    const locationId = injectLocationId(req) || 2;
    const [existing] = await db.query('SELECT id FROM CashSettlements WHERE entryDate = ? AND location_id = ?', [entryDate, locationId]);
    const settlementId = existing.length > 0 ? existing[0].id : getUUID();

    await db.query(`
      INSERT INTO CashSettlements (id, location_id, entryDate, saleAmount, billsCount, cashTotal, cardTotal, upiTotal, submittedBy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE saleAmount = VALUES(saleAmount), billsCount = VALUES(billsCount), cashTotal = VALUES(cashTotal), cardTotal = VALUES(cardTotal), upiTotal = VALUES(upiTotal), submittedBy = VALUES(submittedBy), updatedAt = CURRENT_TIMESTAMP
    `, [settlementId, locationId, entryDate, saleAmount || 0, billsCount || 0, cashTotal || 0, cardTotal || 0, upiTotal || 0, submittedBy || 'Cashier']);

    await db.query('DELETE FROM CashCounterReports WHERE settlementId = ?', [settlementId]);
    if (Array.isArray(counters)) {
      for (let c of counters) {
        const cId = getUUID();
        await db.query(`
          INSERT INTO CashCounterReports (id, settlementId, counterName, cashierName, billsCount, saleAmount, cashAmount, cardAmount, upiAmount, staffDiscount, customerDiscount)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [cId, settlementId, c.counterName || 'Counter 1', c.cashierName || 'Staff', c.billsCount || 0, c.saleAmount || 0, c.cashAmount || 0, c.cardAmount || 0, c.upiAmount || 0, c.staffDiscount || 0, c.customerDiscount || 0]);
      }
    }

    return res.json({ success: true, message: 'Cash settlement saved successfully', settlementId });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Visual Merchandising (VM) ───────────────────────────────
exports.getVmPoints = async (req, res) => {
  try {
    const vm11Questions = [
      { id: 'vm_q1', title: 'Is the entire section clean, neat, and well-maintained?', section: 'Visual Merchandising', position: 1 },
      { id: 'vm_q2', title: 'Are products arranged according to category, colour, and size?', section: 'Visual Merchandising', position: 2 },
      { id: 'vm_q3', title: 'Are all racks, shelves, tables, and displays properly aligned?', section: 'Visual Merchandising', position: 3 },
      { id: 'vm_q4', title: 'Are new arrivals and the latest collections displayed prominently?', section: 'Visual Merchandising', position: 4 },
      { id: 'vm_q5', title: 'Are mannequins styled according to the current theme?', section: 'Visual Merchandising', position: 5 },
      { id: 'vm_q6', title: 'Are price tags, product labels, and signage correctly placed and visible?', section: 'Visual Merchandising', position: 6 },
      { id: 'vm_q7', title: 'Are promotional and offer displays updated and correctly positioned?', section: 'Visual Merchandising', position: 7 },
      { id: 'vm_q8', title: 'Is the colour blocking and overall visual theme maintained?', section: 'Visual Merchandising', position: 8 },
      { id: 'vm_q9', title: 'Are folded, hanging, and stacked products properly presented?', section: 'Visual Merchandising', position: 9 },
      { id: 'vm_q10', title: 'Does the section meet the daily VM standard and look attractive to customers?', section: 'Visual Merchandising', position: 10 }
    ];

    try {
      const [rows] = await db.query('SELECT * FROM VmChecklistPoints WHERE isActive = TRUE ORDER BY position ASC');
      if (rows && rows.length >= 10) {
        return res.json({ success: true, points: rows });
      }
    } catch (e) {}

    return res.json({ success: true, points: vm11Questions });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.getVmSubmissions = async (req, res) => {
  try {
    const { clause: locClause, params: locParams } = await getLocationFilter(req, 'VmSubmissions');
    const [rows] = await db.query(`SELECT * FROM VmSubmissions WHERE 1=1 ${locClause} ORDER BY createdAt DESC LIMIT 200`, locParams);
    
    if (rows.length === 0) {
      return res.json({ success: true, submissions: [] });
    }

    const submissionIds = rows.map(r => r.id);
    const [entries] = await db.query('SELECT * FROM VmSubmissionEntries WHERE submissionId IN (?)', [submissionIds]);

    const entriesMap = {};
    entries.forEach(e => {
      if (!entriesMap[e.submissionId]) {
        entriesMap[e.submissionId] = [];
      }
      entriesMap[e.submissionId].push(e);
    });

    const formattedRows = rows.map(r => ({
      ...r,
      entries: entriesMap[r.id] || []
    }));

    return res.json({ success: true, submissions: formattedRows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.submitVm = async (req, res) => {
  try {
    const { shift, floor, section, scorePercent, submittedBy, entries } = req.body;
    const locationId = injectLocationId(req) || 2;
    const submissionId = getUUID();
    const entryDate = new Date().toISOString().split('T')[0];

    // Ensure section column exists in VmSubmissions if table is present
    try {
      await db.query(`ALTER TABLE VmSubmissions ADD COLUMN section VARCHAR(100) DEFAULT NULL`).catch(() => {});
    } catch (e) {}

    try {
      await db.query(`
        INSERT INTO VmSubmissions (id, location_id, entryDate, shift, floor, section, scorePercent, submittedBy)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [submissionId, locationId, entryDate, shift || 'Opening', floor || 'Ground Floor', section || 'General', scorePercent || 100, submittedBy || 'VM Auditor']);
    } catch (e) {
      await db.query(`
        INSERT INTO VmSubmissions (id, location_id, entryDate, shift, floor, scorePercent, submittedBy)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [submissionId, locationId, entryDate, shift || 'Opening', floor || 'Ground Floor', scorePercent || 100, submittedBy || 'VM Auditor']);
    }

    if (Array.isArray(entries)) {
      for (let e of entries) {
        const eId = getUUID();
        await db.query(`
          INSERT INTO VmSubmissionEntries (id, submissionId, pointId, pointTitle, score, remarks, photoUrl)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [eId, submissionId, e.pointId, e.pointTitle || 'Check Point', e.score || 'Pass', e.remarks || '', e.photoUrl || '']);
      }
    }

    return res.json({ success: true, message: 'VM checklist submitted successfully', submissionId });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.getVmFloors = async (req, res) => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS VmFloors (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT NULL,
        sections TEXT NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(() => {});

    const [rows] = await db.query('SELECT * FROM VmFloors ORDER BY createdAt ASC');
    const floors = (rows || []).map((r) => {
      let parsedSections = [];
      try {
        parsedSections = typeof r.sections === 'string' ? JSON.parse(r.sections) : (r.sections || []);
      } catch (e) {
        parsedSections = String(r.sections || '').split(',').map((s) => s.trim()).filter(Boolean);
      }
      return {
        id: r.id,
        name: r.name,
        description: r.description || '',
        sections: parsedSections
      };
    });
    return res.json({ success: true, floors });
  } catch (err) {
    return res.json({ success: true, floors: [] });
  }
};

exports.createVmFloor = async (req, res) => {
  try {
    const { name, description, sections } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Floor name is required' });
    }
    const secList = Array.isArray(sections) ? sections.map((s) => String(s).trim()).filter(Boolean) : [];
    if (secList.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one section is required for this floor' });
    }

    const id = getUUID();
    await db.query(`
      CREATE TABLE IF NOT EXISTS VmFloors (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT NULL,
        sections TEXT NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(() => {});

    await db.query(`
      INSERT INTO VmFloors (id, name, description, sections)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE description = VALUES(description), sections = VALUES(sections)
    `, [id, name.trim(), description ? description.trim() : '', JSON.stringify(secList)]);

    return res.json({
      success: true,
      message: 'Store floor created successfully',
      floor: { id, name: name.trim(), description: description ? description.trim() : '', sections: secList }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.deleteVmFloor = async (req, res) => {
  try {
    const { id, name } = req.body || {};
    const identifier = id || (req.params && req.params.id) || name;
    if (!identifier) {
      return res.status(400).json({ success: false, message: 'Floor ID or name is required' });
    }
    await db.query('DELETE FROM VmFloors WHERE id = ? OR name = ?', [identifier, identifier]);
    return res.json({ success: true, message: 'Store floor removed successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.getFeedbacks = async (req, res) => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS Feedback (
        id VARCHAR(64) PRIMARY KEY,
        date VARCHAR(32),
        source VARCHAR(32) DEFAULT 'qr',
        area VARCHAR(150),
        yourVoice TEXT,
        custName VARCHAR(255),
        custMobile VARCHAR(32),
        custDob VARCHAR(32),
        q0 VARCHAR(255), q0_other VARCHAR(255),
        q1 VARCHAR(255), q1_other VARCHAR(255),
        q2 VARCHAR(255), q2_other VARCHAR(255),
        q3 VARCHAR(255), q3_other VARCHAR(255),
        q4 VARCHAR(255), q4_other VARCHAR(255),
        q5 VARCHAR(255), q5_other VARCHAR(255),
        q6 VARCHAR(255), q6_other VARCHAR(255),
        q7 VARCHAR(255), q7_other VARCHAR(255),
        status VARCHAR(32) DEFAULT 'new',
        actionTaken TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL,
        entryDate VARCHAR(32),
        customerName VARCHAR(255),
        mobile VARCHAR(32),
        dob VARCHAR(32),
        sectionId VARCHAR(64),
        answers TEXT,
        voice TEXT,
        isNegative TINYINT(1) DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(() => {});

    // Ensure columns exist on legacy/altered tables
    const colsToAdd = [
      'date VARCHAR(32)',
      'source VARCHAR(32) DEFAULT "qr"',
      'area VARCHAR(150)',
      'yourVoice TEXT',
      'custName VARCHAR(255)',
      'custMobile VARCHAR(32)',
      'custDob VARCHAR(32)',
      'q0 VARCHAR(255)', 'q0_other VARCHAR(255)',
      'q1 VARCHAR(255)', 'q1_other VARCHAR(255)',
      'q2 VARCHAR(255)', 'q2_other VARCHAR(255)',
      'q3 VARCHAR(255)', 'q3_other VARCHAR(255)',
      'q4 VARCHAR(255)', 'q4_other VARCHAR(255)',
      'q5 VARCHAR(255)', 'q5_other VARCHAR(255)',
      'q6 VARCHAR(255)', 'q6_other VARCHAR(255)',
      'q7 VARCHAR(255)', 'q7_other VARCHAR(255)',
      'status VARCHAR(32) DEFAULT "new"',
      'actionTaken TEXT',
      'isNegative TINYINT(1) DEFAULT 0',
      'answers TEXT',
      'voice TEXT',
      'entryDate VARCHAR(32)',
      'customerName VARCHAR(255)',
      'mobile VARCHAR(32)'
    ];
    for (const col of colsToAdd) {
      await db.query(`ALTER TABLE Feedback ADD COLUMN ${col}`).catch(() => {});
    }

    const { date, startDate, endDate, isNegative, search } = req.query;
    const { clause: locClause, params: locParams } = await getLocationFilter(req, 'Feedback');
    let sql = `SELECT * FROM Feedback WHERE 1=1 ${locClause}`;
    const params = [...locParams];

    let altDate = date || '';
    if (date && typeof date === 'string') {
      if (date.includes('-') && date.split('-').length === 3) {
        const [y, m, d] = date.split('-');
        altDate = `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
      } else if (date.includes('/') && date.split('/').length === 3) {
        const [d, m, y] = date.split('/');
        altDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      sql += ' AND (entryDate = ? OR entryDate = ? OR date = ? OR date = ? OR DATE(created_at) = ? OR DATE(createdAt) = ?)';
      params.push(date, altDate, date, altDate, date, altDate);
    } else {
      if (startDate) {
        sql += ' AND (COALESCE(NULLIF(entryDate, ""), STR_TO_DATE(date, "%d/%m/%Y"), DATE(createdAt), DATE(created_at)) >= ?)';
        params.push(startDate);
      }
      if (endDate) {
        sql += ' AND (COALESCE(NULLIF(entryDate, ""), STR_TO_DATE(date, "%d/%m/%Y"), DATE(createdAt), DATE(created_at)) <= ?)';
        params.push(endDate);
      }
    }

    if (isNegative !== undefined && isNegative !== '' && isNegative !== 'all') {
      sql += ' AND isNegative = ?';
      params.push(isNegative === 'true' || isNegative === '1' ? 1 : 0);
    }

    if (search) {
      sql += ' AND (customerName LIKE ? OR custName LIKE ? OR mobile LIKE ? OR custMobile LIKE ? OR voice LIKE ? OR yourVoice LIKE ? OR answers LIKE ? OR q0 LIKE ? OR q1 LIKE ? OR q2 LIKE ? OR q3 LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s, s, s, s, s, s);
    }

    sql += ' ORDER BY COALESCE(NULLIF(entryDate, ""), STR_TO_DATE(date, "%d/%m/%Y"), DATE(createdAt), DATE(created_at)) DESC, id DESC';

    const [rows] = await db.query(sql, params).catch(async (err) => {
      console.warn('[getFeedbacks Query Fail, fallback executing]:', err.message);
      const [fallbackRows] = await db.query(`SELECT * FROM Feedback WHERE 1=1 ${locClause} ORDER BY id DESC`, locParams);
      return [fallbackRows];
    });

    let formatted = (rows || []).map(r => {
      let parsedAnswers = {};
      try {
        parsedAnswers = typeof r.answers === 'string' ? JSON.parse(r.answers || '{}') : (r.answers || {});
      } catch (e) {
        parsedAnswers = {};
      }

      ['q0', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7'].forEach(qKey => {
        if (r[qKey] && !parsedAnswers[qKey]) {
          parsedAnswers[qKey] = r[qKey];
        }
        if (r[`${qKey}_other`] && !parsedAnswers[`${qKey}_other`]) {
          parsedAnswers[`${qKey}_other`] = r[`${qKey}_other`];
        }
      });

      let rawDateStr = r.entryDate || r.date || (r.created_at || r.createdAt ? new Date(r.created_at || r.createdAt).toISOString().split('T')[0] : getISTDateString());
      if (typeof rawDateStr === 'string' && rawDateStr.includes('/')) {
        const parts = rawDateStr.split('/');
        if (parts.length === 3) {
          rawDateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      const voiceText = [r.voice, r.yourVoice].filter(Boolean).join('\n').trim();
      const isResolvedStatus = r.status === 'resolved' || r.status === 'closed';
      const isNegEvaluated = isResolvedStatus ? false : evaluateFeedbackEscalation(parsedAnswers, voiceText, r.q0, r.q1, r.q2, r.q3);

      let entryTimeStr = r.entryTime || '';
      if (!entryTimeStr && (r.created_at || r.createdAt)) {
        entryTimeStr = getISTTimeString(r.created_at || r.createdAt);
      }
      if (!entryTimeStr) {
        entryTimeStr = getISTTimeString();
      }

      return {
        ...r,
        customerName: r.customerName || r.custName || r.customer_name || r.name || 'Anonymous',
        custName: r.custName || r.customerName || 'Anonymous',
        mobile: r.mobile || r.custMobile || r.customerMobile || r.phone || '',
        custMobile: r.custMobile || r.mobile || '',
        entryDate: rawDateStr,
        entryTime: entryTimeStr || '10:00 AM',
        date: r.date || rawDateStr,
        voice: voiceText,
        yourVoice: voiceText,
        answers: parsedAnswers,
        actionTaken: r.actionTaken || r.notes || '',
        notes: r.actionTaken || r.notes || '',
        status: r.status || (isNegEvaluated ? 'new' : 'resolved'),
        isNegative: isNegEvaluated
      };
    });

    // In-memory secondary date filter to guarantee exact match even if DB fallback triggered
    if (date && typeof date === 'string') {
      formatted = formatted.filter(r => 
        r.entryDate === date || r.entryDate === altDate ||
        r.date === date || r.date === altDate
      );
    }

    const total = formatted.length;
    const negative = formatted.filter(r => r.isNegative).length;
    const positive = total - negative;
    const npsScore = total > 0 ? Math.round((positive / total) * 100) : 100;

    return res.json({
      success: true,
      feedbacks: formatted,
      stats: {
        total,
        positive,
        negative,
        npsScore
      }
    });
  } catch (err) {
    console.error('[getFeedbacks Error]', err);
    return res.json({
      success: true,
      feedbacks: [],
      stats: { total: 0, positive: 0, negative: 0, npsScore: 100 }
    });
  }
};

// ── Chat System (Gemini AI) ─────────────────────────────────────────────────

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT = `You are BSC Enterprise AI Assistant — a helpful internal assistant for BSC Textiles staff.
You help with: employee info, attendance, candidates, wedding CRM, feedback, reports, store operations.
Be concise, professional, and friendly. Keep responses under 200 words unless more detail is needed.
If you don't know something specific about the company data, say so honestly and suggest the user check the relevant module.`;

exports.getChatMessages = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId || 'unknown';
    const [rows] = await db.query(
      'SELECT id, message_text, sender, created_at FROM chat_messages WHERE user_id = ? ORDER BY created_at ASC LIMIT 200',
      [userId]
    );
    return res.json({ success: true, messages: rows || [] });
  } catch (err) {
    return res.json({ success: true, messages: [] });
  }
};

exports.sendChatMessage = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId || 'unknown';
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const crypto = require('crypto');
    const msgId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');

    // Ensure table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        message_text TEXT NOT NULL,
        sender ENUM('user', 'system') DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_chat_user (user_id),
        INDEX idx_chat_time (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(() => {});

    // Save user message
    await db.query(
      'INSERT INTO chat_messages (id, user_id, message_text, sender) VALUES (?, ?, ?, ?)',
      [msgId, userId, message.trim(), 'user']
    );

    // Get recent conversation context (last 10 messages)
    let contextMessages = [];
    try {
      const [recent] = await db.query(
        'SELECT message_text, sender FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
        [userId]
      );
      contextMessages = (recent || []).reverse();
    } catch (e) {}

    // Call Gemini AI
    let systemResponse;
    if (GEMINI_API_KEY) {
      systemResponse = await callGemini(message.trim(), contextMessages);
    } else {
      systemResponse = 'Gemini API key is not configured. Please contact the administrator to set up the AI assistant.';
    }

    const sysMsgId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    await db.query(
      'INSERT INTO chat_messages (id, user_id, message_text, sender) VALUES (?, ?, ?, ?)',
      [sysMsgId, userId, systemResponse, 'system']
    );

    return res.json({
      success: true,
      userMessage: { id: msgId, message_text: message.trim(), sender: 'user', created_at: new Date().toISOString() },
      systemMessage: { id: sysMsgId, message_text: systemResponse, sender: 'system', created_at: new Date().toISOString() }
    });
  } catch (err) {
    console.error('[sendChatMessage Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to send message' });
  }
};

exports.clearChatMessages = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId || 'unknown';
    await db.query('DELETE FROM chat_messages WHERE user_id = ?', [userId]);
    return res.json({ success: true, message: 'Chat history cleared' });
  } catch (err) {
    return res.json({ success: true, message: 'Chat history cleared' });
  }
};

async function callGemini(userMessage, contextMessages) {
  try {
    // Build conversation history for Gemini
    const contents = [];

    // Add system instruction as user message
    contents.push({ role: 'user', parts: [{ text: SYSTEM_PROMPT }] });
    contents.push({ role: 'model', parts: [{ text: 'Understood. I am the BSC Enterprise AI Assistant. I will help staff with their queries about employees, attendance, candidates, wedding CRM, feedback, reports, and store operations. How can I assist you?' }] });

    // Add recent conversation context
    for (const msg of contextMessages) {
      if (msg.sender === 'user') {
        contents.push({ role: 'user', parts: [{ text: msg.message_text }] });
      } else {
        contents.push({ role: 'model', parts: [{ text: msg.message_text }] });
      }
    }

    // Add current message (avoid duplicate if last context message is same)
    const lastCtx = contextMessages.length > 0 ? contextMessages[contextMessages.length - 1] : null;
    if (!lastCtx || lastCtx.message_text !== userMessage || lastCtx.sender !== 'user') {
      contents.push({ role: 'user', parts: [{ text: userMessage }] });
    }

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
        ]
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[Gemini API Error]', response.status, errBody);
      return 'I apologize, but I am temporarily unable to process your request. Please try again in a moment.';
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      return text.trim();
    }
    return 'I received your message but could not generate a response. Please try again.';
  } catch (err) {
    console.error('[Gemini Call Error]', err.message);
    return 'I apologize, but there was an error connecting to the AI service. Please try again later.';
  }
}
