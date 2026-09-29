/**
 * Database Migration Script: Three Dedicated Feedback Tables
 * Creates BSC_Feedback_Belagavi, BSC_Feedback_Davanagere, and BSC_Feedback_Shivamogga
 * with identical schemas and migrates historical data from Feedback.
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') });

const db = require('../config/db');

const TABLES = [
  { name: 'BSC_Feedback_Belagavi', code: 'BEL', locId: 1, locName: 'Belagavi' },
  { name: 'BSC_Feedback_Davanagere', code: 'DAV', locId: 2, locName: 'Davanagere' },
  { name: 'BSC_Feedback_Shivamogga', code: 'SHI', locId: 3, locName: 'Shivamogga' }
];

async function initFeedbackTables() {
  console.log('[Feedback DB Init] Initializing dedicated location feedback tables...');

  for (const t of TABLES) {
    console.log(`[Feedback DB Init] Creating/verifying table ${t.name} (${t.code})...`);
    await db.query(`
      CREATE TABLE IF NOT EXISTS ${t.name} (
        id VARCHAR(64) PRIMARY KEY,
        location_id INT NOT NULL DEFAULT ${t.locId},
        locationCode VARCHAR(10) NOT NULL DEFAULT '${t.code}',
        locationName VARCHAR(100) NOT NULL DEFAULT '${t.locName}',
        storeLocation VARCHAR(150) NOT NULL DEFAULT 'BSC Textiles ${t.locName}',
        customerName VARCHAR(255) NULL,
        custName VARCHAR(255) NULL,
        mobile VARCHAR(32) NULL,
        custMobile VARCHAR(32) NULL,
        email VARCHAR(150) NULL,
        custEmail VARCHAR(150) NULL,
        dob VARCHAR(32) NULL,
        custDob VARCHAR(32) NULL,
        visitDate VARCHAR(32) NULL,
        date VARCHAR(32) NULL,
        entryDate VARCHAR(32) NULL,
        visitTime VARCHAR(32) NULL,
        entryTime VARCHAR(32) NULL,
        overallRating INT NULL,
        storeExperienceRating INT NULL,
        staffServiceRating INT NULL,
        productRating INT NULL,
        cleanlinessRating INT NULL,
        ambienceRating INT NULL,
        recommendationRating INT NULL,
        customerComments TEXT NULL,
        voice TEXT NULL,
        yourVoice TEXT NULL,
        category VARCHAR(100) NULL,
        sectionId VARCHAR(64) NULL,
        area VARCHAR(150) NULL,
        answers JSON NULL,
        q0 VARCHAR(255) NULL, q0_other VARCHAR(255) NULL,
        q1 VARCHAR(255) NULL, q1_other VARCHAR(255) NULL,
        q2 VARCHAR(255) NULL, q2_other VARCHAR(255) NULL,
        q3 VARCHAR(255) NULL, q3_other VARCHAR(255) NULL,
        q4 VARCHAR(255) NULL, q4_other VARCHAR(255) NULL,
        q5 VARCHAR(255) NULL, q5_other VARCHAR(255) NULL,
        q6 VARCHAR(255) NULL, q6_other VARCHAR(255) NULL,
        q7 VARCHAR(255) NULL, q7_other VARCHAR(255) NULL,
        source VARCHAR(32) DEFAULT 'qr',
        qrCodeId VARCHAR(64) NULL,
        sessionId VARCHAR(128) NULL,
        submissionRef VARCHAR(128) NULL,
        isNegative TINYINT(1) DEFAULT 0,
        status VARCHAR(32) DEFAULT 'new',
        actionTaken TEXT NULL,
        notes TEXT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL,
        INDEX idx_entryDate (entryDate),
        INDEX idx_locationCode (locationCode),
        INDEX idx_isNegative (isNegative),
        INDEX idx_status (status),
        INDEX idx_submissionRef (submissionRef)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Migrate historical records from Feedback table if any
    try {
      const [existingInNew] = await db.query(`SELECT COUNT(*) as c FROM ${t.name}`);
      const countInNew = existingInNew[0]?.c || 0;

      if (countInNew === 0) {
        console.log(`[Feedback DB Init] Migrating historical records into ${t.name}...`);
        await db.query(`
          INSERT IGNORE INTO ${t.name} (
            id, location_id, locationCode, locationName, storeLocation,
            customerName, custName, mobile, custMobile, email,
            dob, custDob, date, entryDate, visitDate, entryTime, visitTime,
            voice, yourVoice, customerComments, sectionId, area, category,
            answers, q0, q1, q2, q3, q4, q5, q6, q7,
            source, qrCodeId, isNegative, status, actionTaken,
            createdAt, created_at
          )
          SELECT 
            id, ${t.locId}, '${t.code}', '${t.locName}', 'BSC Textiles ${t.locName}',
            COALESCE(customerName, custName), COALESCE(custName, customerName),
            COALESCE(mobile, custMobile), COALESCE(custMobile, mobile), email,
            COALESCE(dob, custDob), COALESCE(custDob, dob),
            date, entryDate, COALESCE(entryDate, date), entryTime, entryTime,
            COALESCE(voice, yourVoice), COALESCE(yourVoice, voice), COALESCE(voice, yourVoice),
            sectionId, area, COALESCE(sectionId, area, 'General'),
            answers, q0, q1, q2, q3, q4, q5, q6, q7,
            COALESCE(source, 'qr'), qrCodeId, COALESCE(isNegative, 0), COALESCE(status, 'new'), actionTaken,
            COALESCE(createdAt, created_at, NOW()), COALESCE(created_at, createdAt, NOW())
          FROM Feedback
          WHERE (locationCode = '${t.code}' OR location_id = ${t.locId})
        `);
        const [migrated] = await db.query(`SELECT COUNT(*) as c FROM ${t.name}`);
        console.log(`[Feedback DB Init] Migrated ${migrated[0]?.c || 0} records into ${t.name}.`);
      } else {
        console.log(`[Feedback DB Init] ${t.name} already has ${countInNew} records. Preserved.`);
      }
    } catch (migErr) {
      console.warn(`[Feedback DB Init Warning for ${t.name}]:`, migErr.message);
    }
  }

  console.log('[Feedback DB Init] Dedicated location feedback tables initialized successfully.');
}

if (require.main === module) {
  initFeedbackTables()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Feedback DB Init Error]:', err);
      process.exit(1);
    });
}

module.exports = {
  initFeedbackTables,
  TABLES
};
