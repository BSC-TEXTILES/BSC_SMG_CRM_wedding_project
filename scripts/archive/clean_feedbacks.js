require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const pool = require('../config/db');

async function cleanFeedbacks() {
  console.log('[Clean Feedbacks] Starting cleanup of all test feedback records...');
  try {
    const conn = await pool.getConnection();

    // 1. Delete from CallQueue
    const [cqRes] = await conn.query(`
      DELETE FROM CallQueue 
      WHERE customerName IN ('Trial', 'test', 'demo', 'Demo', 'Test', 'T1', 'Suresh Gowda', 'Anita Patil', 'Ramesh Kumar', 'Valued Customer')
         OR mobile IN ('+919654186453', '9654186453', '+919849865416', '9849865416', '+919864685465', '9864685465', '+919987866534', '9987866534', '+919845464464', '9845464464', '+919798564168', '9798564168', '+918986541564', '8986541564', '6874685', '9741234567', '9845012345', '9876543210')
         OR LOWER(customerName) LIKE '%test%'
         OR LOWER(customerName) LIKE '%demo%'
         OR LOWER(customerName) LIKE '%trial%'
         OR feedbackId IN (
           SELECT id FROM Feedback 
           WHERE customerName IN ('Trial', 'test', 'demo', 'Demo', 'Test', 'T1', 'Suresh Gowda', 'Anita Patil', 'Ramesh Kumar')
              OR custName IN ('Trial', 'test', 'demo', 'Demo', 'Test', 'T1', 'Suresh Gowda', 'Anita Patil', 'Ramesh Kumar')
         )
    `);
    console.log(`[Clean Feedbacks] Removed ${cqRes.affectedRows || 0} CallQueue records.`);

    // 2. Delete from Feedback
    const [fbRes] = await conn.query(`
      DELETE FROM Feedback 
      WHERE customerName IN ('Trial', 'test', 'demo', 'Demo', 'Test', 'T1', 'Suresh Gowda', 'Anita Patil', 'Ramesh Kumar')
         OR custName IN ('Trial', 'test', 'demo', 'Demo', 'Test', 'T1', 'Suresh Gowda', 'Anita Patil', 'Ramesh Kumar')
         OR mobile IN ('+919654186453', '9654186453', '+919849865416', '9849865416', '+919864685465', '9864685465', '+919987866534', '9987866534', '+919845464464', '9845464464', '+919798564168', '9798564168', '+918986541564', '8986541564', '6874685', '9741234567', '9845012345', '9876543210')
         OR custMobile IN ('+919654186453', '9654186453', '+919849865416', '9849865416', '+919864685465', '9864685465', '+919987866534', '9987866534', '+919845464464', '9845464464', '+919798564168', '9798564168', '+918986541564', '8986541564', '6874685', '9741234567', '9845012345', '9876543210')
         OR LOWER(customerName) LIKE '%test%'
         OR LOWER(customerName) LIKE '%demo%'
         OR LOWER(customerName) LIKE '%trial%'
         OR customerName = 'T1'
    `);
    console.log(`[Clean Feedbacks] Removed ${fbRes.affectedRows || 0} Feedback records.`);

    // 3. Reset scans
    await conn.query(`
      UPDATE FeedbackQrScan SET isFeedbackSubmitted = 0, feedbackId = NULL 
      WHERE feedbackId IS NOT NULL AND feedbackId NOT IN (SELECT id FROM Feedback)
    `);
    console.log('[Clean Feedbacks] Reset orphan scan references.');

    conn.release();
    console.log('[Clean Feedbacks] Cleanup completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('[Clean Feedbacks Error]:', err.message);
    process.exit(1);
  }
}

cleanFeedbacks();
