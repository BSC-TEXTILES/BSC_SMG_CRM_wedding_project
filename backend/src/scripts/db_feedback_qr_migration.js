require('dotenv').config({ path: './backend/.env' });
const db = require('../config/db');
const QRCode = require('qrcode');
const crypto = require('crypto');

function getUUID() {
  try {
    return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
  } catch (e) {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}

async function runMigration() {
  console.log('=== Starting Feedback QR Location Migration ===');

  try {
    // 1. Ensure columns exist on Feedback table
    console.log('1. Checking Feedback table columns...');
    await db.query(`
      ALTER TABLE Feedback 
      ADD COLUMN IF NOT EXISTS locationCode VARCHAR(10) NULL AFTER location_id,
      ADD COLUMN IF NOT EXISTS locationName VARCHAR(100) NULL AFTER locationCode,
      ADD COLUMN IF NOT EXISTS email VARCHAR(150) NULL AFTER mobile,
      ADD COLUMN IF NOT EXISTS entryTime VARCHAR(32) NULL AFTER entryDate
    `).catch(async (err) => {
      // Fallback for MySQL versions that don't support IF NOT EXISTS in ALTER TABLE
      console.log('Running individual ALTER TABLE statements for Feedback...');
      const cols = [
        'ADD COLUMN locationCode VARCHAR(10) NULL',
        'ADD COLUMN locationName VARCHAR(100) NULL',
        'ADD COLUMN email VARCHAR(150) NULL',
        'ADD COLUMN entryTime VARCHAR(32) NULL'
      ];
      for (const col of cols) {
        try {
          await db.query(`ALTER TABLE Feedback ${col}`);
        } catch (e) {
          // Column already exists, ignore
        }
      }
    });

    // 2. Sync existing feedback rows to have locationCode and locationName
    console.log('2. Updating existing feedback location codes & names...');
    await db.query(`
      UPDATE Feedback SET locationCode = 'BEL', locationName = 'Belagavi' 
      WHERE location_id = 1 AND (locationCode IS NULL OR locationCode = '')
    `);
    await db.query(`
      UPDATE Feedback SET locationCode = 'DAV', locationName = 'Davanagere' 
      WHERE (location_id = 2 OR location_id IS NULL OR location_id = 0) AND (locationCode IS NULL OR locationCode = '')
    `);
    await db.query(`
      UPDATE Feedback SET locationCode = 'SHI', locationName = 'Shivamogga' 
      WHERE location_id = 3 AND (locationCode IS NULL OR locationCode = '')
    `);

    // 3. Ensure distinct location QR codes in FeedbackQrCode
    console.log('3. Setting up Location QR codes for BEL, DAV, SHI...');
    const baseUrl = process.env.FRONTEND_URL || 'https://bsctextiles.in';

    const locations = [
      { id: 1, code: 'BEL', name: 'Belagavi', storeName: 'BSC Textiles Belagavi', qrId: 'QR-BEL' },
      { id: 2, code: 'DAV', name: 'Davanagere', storeName: 'BSC Textiles Davanagere', qrId: 'QR-DAV' },
      { id: 3, code: 'SHI', name: 'Shivamogga', storeName: 'BSC Textiles Shivamogga', qrId: 'QR-SHI' }
    ];

    for (const loc of locations) {
      const targetUrl = `${baseUrl}/feedback-public?location=${loc.code}`;

      // Generate QR images
      const qrCodeDataUrl = await QRCode.toDataURL(targetUrl, {
        width: 360,
        margin: 2,
        color: { dark: '#0B1F35', light: '#FFFFFF' },
        errorCorrectionLevel: 'M'
      });

      const qrCodeSvg = await QRCode.toString(targetUrl, {
        type: 'svg',
        width: 360,
        margin: 2,
        color: { dark: '#0B1F35', light: '#FFFFFF' },
        errorCorrectionLevel: 'M'
      });

      // Check if QR code exists for this location
      const [existing] = await db.query(`
        SELECT * FROM FeedbackQrCode 
        WHERE locationId = ? AND deletedAt IS NULL 
        ORDER BY CASE WHEN targetUrl LIKE '%location=' THEN 0 ELSE 1 END, createdAt DESC 
        LIMIT 1
      `, [loc.id]);

      if (existing && existing.length > 0) {
        const current = existing[0];
        console.log(`Updating existing QR code ${current.qrCodeId} for ${loc.name}...`);
        await db.query(`
          UPDATE FeedbackQrCode 
          SET name = ?, description = ?, locationId = ?, locationCode = ?, locationName = ?,
              targetUrl = ?, qrCodeDataUrl = ?, qrCodeSvg = ?, status = 'active', updatedAt = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [
          `${loc.name} Feedback`,
          `Official Customer Feedback QR for ${loc.storeName}`,
          loc.id,
          loc.code,
          loc.name,
          targetUrl,
          qrCodeDataUrl,
          qrCodeSvg,
          current.id
        ]);
      } else {
        console.log(`Creating new QR code ${loc.qrId} for ${loc.name}...`);
        const newId = getUUID();
        await db.query(`
          INSERT INTO FeedbackQrCode (
            id, qrCodeId, name, description, locationId, locationCode, locationName,
            sectionId, sectionName, floor, feedbackFormId, targetUrl, qrCodeDataUrl, qrCodeSvg,
            status, scanCount, createdBy, createdByName
          ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'Ground Floor', NULL, ?, ?, ?, 'active', 0, 1, 'System Admin')
        `, [
          newId,
          loc.qrId,
          `${loc.name} Feedback`,
          `Official Customer Feedback QR for ${loc.storeName}`,
          loc.id,
          loc.code,
          loc.name,
          targetUrl,
          qrCodeDataUrl,
          qrCodeSvg
        ]);
      }
    }

    // Fix any inconsistent records in FeedbackQrCode (e.g. locationId = 3 with locationCode = 'BEL')
    await db.query(`
      UPDATE FeedbackQrCode SET locationCode = 'BEL', locationName = 'Belagavi' WHERE locationId = 1;
    `);
    await db.query(`
      UPDATE FeedbackQrCode SET locationCode = 'DAV', locationName = 'Davanagere' WHERE locationId = 2;
    `);
    await db.query(`
      UPDATE FeedbackQrCode SET locationCode = 'SHI', locationName = 'Shivamogga' WHERE locationId = 3;
    `);

    // Verify
    const [qrs] = await db.query(`
      SELECT qrCodeId, name, locationId, locationCode, locationName, targetUrl, status,
             LENGTH(qrCodeDataUrl) as dataLen, LENGTH(qrCodeSvg) as svgLen
      FROM FeedbackQrCode
      WHERE deletedAt IS NULL
      ORDER BY locationId ASC
    `);
    console.log('=== Migration Complete! Current Active QR Codes: ===');
    console.log(qrs);

    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
