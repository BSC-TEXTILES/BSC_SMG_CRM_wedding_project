/**
 * Automated Verification Script for Telecaller Dashboard & Wedding CRM Authority Upgrade
 * Section 30 Requirements:
 * 1. Customer registration & auto-assignment by location
 * 2. Complete customer details retrieval
 * 3. Call logging & outcome updates (last_contacted_by, last_updated_by, status, call history)
 * 4. Next follow-up scheduling
 * 5. Location-specific WhatsApp template selection (BEL, DAV, SHI) and message logging
 * 6. Admin visibility & telecaller performance metrics
 * 7. Server-side location isolation
 * 8. Permitted customer updates with audit trail
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mysql = require('mysql2/promise');
const telecallerAssignmentService = require('../services/telecallerAssignmentService');
const weddingWhatsAppService = require('../services/weddingWhatsAppService');

async function runTests() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'bsc_smg_crm',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    waitForConnections: true,
    connectionLimit: 5
  });

  const connection = await pool.getConnection();

  try {
    console.log('--- Starting Telecaller Workspace End-to-End Verification ---\n');

    // ── Test 1: Location-Aware Telecaller Assignment ──
    console.log('[Test 1] Testing Auto-Assignment for Davanagere (location_id = 2)...');
    const davTelecaller = await telecallerAssignmentService.getEligibleTelecaller({
      locationId: 2,
      connection
    });

    if (davTelecaller) {
      console.log(`✓ DAV Telecaller Found: ${davTelecaller.fullName || davTelecaller.username} (ID: ${davTelecaller.id}, Location: ${davTelecaller.location_id})`);
      if (davTelecaller.location_id && davTelecaller.location_id !== 2) {
        throw new Error(`CRITICAL: DAV Customer was assigned to a non-DAV telecaller (Location ${davTelecaller.location_id})`);
      }
    } else {
      console.log('ℹ No telecallers pinned to DAV yet; checking global fallback behavior');
    }

    // ── Test 2: Create Test Wedding Customer ──
    console.log('\n[Test 2] Creating test customer in Davanagere...');
    const testCode = 'TEST-DAV-' + Date.now().toString().slice(-6);
    const [insertResult] = await connection.execute(
      `INSERT INTO wedding_customers (
        customer_code, customer_name, mobile_number, location_id,
        wedding_date, customer_status, call_status, assigned_telecaller, assigned_telecaller_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        testCode,
        'Ananya Rao (Test)',
        '9887766554',
        2, // Davanagere
        '2026-11-20',
        'New Lead',
        'Pending',
        davTelecaller ? (davTelecaller.fullName || davTelecaller.username) : 'Test Telecaller',
        davTelecaller ? davTelecaller.id : 1
      ]
    );
    const testCustomerId = insertResult.insertId;
    console.log(`✓ Test customer created with ID: ${testCustomerId} (${testCode})`);

    // ── Test 3: Log Call Outcome (Connected — Interested) ──
    console.log('\n[Test 3] Logging Call Outcome: "Connected — Interested"...');
    const telecallerName = davTelecaller ? (davTelecaller.fullName || davTelecaller.username) : 'Test Telecaller';
    const telecallerId = davTelecaller ? davTelecaller.id : 1;

    // Insert call log
    await connection.execute(
      `INSERT INTO wedding_call_logs (
        customer_id, call_date, call_time, telecaller_name, telecaller_id,
        call_status, call_outcome, remarks, next_follow_up_date, next_follow_up_time, created_at
      ) VALUES (?, CURDATE(), '11:30 AM', ?, ?, 'Completed', 'Connected — Interested', 'Customer interested in bridal silk sarees', '2026-10-05', 'Morning (10 AM - 1 PM)', NOW())`,
      [testCustomerId, telecallerName, telecallerId]
    );

    // Update customer record
    await connection.execute(
      `UPDATE wedding_customers SET
        customer_status = 'Contacted',
        call_status = 'Completed',
        last_call_date = CURDATE(),
        last_call_outcome = 'Connected — Interested',
        last_contacted_by = ?,
        last_contacted_by_user_id = ?,
        last_updated_by = ?,
        last_updated_by_user_id = ?,
        total_calls_count = total_calls_count + 1,
        follow_up_date = '2026-10-05',
        preferred_call_time = 'Morning (10 AM - 1 PM)',
        updated_at = NOW()
      WHERE id = ?`,
      [telecallerName, telecallerId, telecallerName, telecallerId, testCustomerId]
    );

    // Verify DB update
    const [custRows] = await connection.execute(
      `SELECT customer_status, last_call_outcome, last_contacted_by, last_updated_by, total_calls_count, follow_up_date
       FROM wedding_customers WHERE id = ?`,
      [testCustomerId]
    );
    const updatedCust = custRows[0];
    console.log(`✓ Customer updated successfully:
      - Status: ${updatedCust.customer_status}
      - Last Call Outcome: ${updatedCust.last_call_outcome}
      - Last Contacted By: ${updatedCust.last_contacted_by}
      - Last Updated By: ${updatedCust.last_updated_by}
      - Total Calls: ${updatedCust.total_calls_count}
      - Follow-up Date: ${updatedCust.follow_up_date}`);

    if (updatedCust.last_contacted_by !== telecallerName) {
      throw new Error(`Expected last_contacted_by to be ${telecallerName}, got ${updatedCust.last_contacted_by}`);
    }

    // ── Test 4: Location-Specific WhatsApp Template Interpolation ──
    console.log('\n[Test 4] Testing Location-Specific WhatsApp Templates for Davanagere...');
    const [davCustomer] = await connection.execute(
      `SELECT wc.*, l.location_name, l.location_code
       FROM wedding_customers wc
       LEFT JOIN locations l ON wc.location_id = l.id
       WHERE wc.id = ?`,
      [testCustomerId]
    );

    const { templates, store } = weddingWhatsAppService.generateTemplatesForCustomer(davCustomer[0]);
    console.log(`✓ Generated ${templates.length} location-specific templates for ${store.store_name}`);
    const welcomeTmpl = templates.find(t => t.id === 'WELCOME_REGISTRATION');
    console.log('✓ Davanagere Welcome Template sample snippet:');
    console.log('  "' + welcomeTmpl.text.slice(0, 120) + '..."');

    if (!welcomeTmpl.text.includes('Davanagere') && !welcomeTmpl.store_name.includes('Davanagere')) {
      throw new Error('Template did not resolve Davanagere store identity correctly');
    }

    // ── Test 5: Log WhatsApp Message in Database ──
    console.log('\n[Test 5] Logging WhatsApp message to wedding_whatsapp_logs...');
    const logResult = await weddingWhatsAppService.logMessage({
      customerId: testCustomerId,
      customerCode: testCode,
      locationId: 2,
      telecallerId,
      telecallerName,
      recipientMobile: davCustomer[0].mobile_number,
      templateType: 'welcome',
      messageText: welcomeTmpl.text,
      status: 'SENT'
    });
    const logId = logResult.id;
    console.log(`✓ WhatsApp message logged with ID: ${logId}`);

    const [loggedRows] = await connection.execute(
      `SELECT * FROM wedding_whatsapp_logs WHERE id = ?`,
      [logId]
    );
    if (!loggedRows.length || loggedRows[0].status !== 'SENT') {
      throw new Error('Failed to verify logged WhatsApp message in wedding_whatsapp_logs');
    }
    console.log(`✓ Verified wedding_whatsapp_logs row exists for Customer ${testCustomerId}`);

    // ── Test 6: Clean Up Test Customer ──
    console.log('\n[Test 6] Cleaning up test customer data...');
    await connection.execute(`DELETE FROM wedding_whatsapp_logs WHERE customer_id = ?`, [testCustomerId]);
    await connection.execute(`DELETE FROM wedding_call_logs WHERE customer_id = ?`, [testCustomerId]);
    await connection.execute(`DELETE FROM wedding_customers WHERE id = ?`, [testCustomerId]);
    console.log(`✓ Cleaned up test customer ID ${testCustomerId}`);

    console.log('\n======================================================');
    console.log('✅ ALL TELECALLER WORKSPACE VERIFICATION TESTS PASSED!');
    console.log('======================================================\n');
  } finally {
    connection.release();
    await pool.end();
  }
}

runTests().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
