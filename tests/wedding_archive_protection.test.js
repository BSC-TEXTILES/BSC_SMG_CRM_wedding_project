/**
 * Wedding CRM — permanent Old Customer archive protection.
 *
 * Covers the rules that must hold at the backend/database level:
 *   - reaching a completion status archives the customer automatically
 *   - archived customers disappear from every active-pipeline surface
 *   - archived customers cannot be deleted or merged by any caller, Admin included
 *   - re-registering a known mobile creates a NEW row linked to the old one
 *
 * Run against a scratch backend:  PORT=5061 node index.js
 * then:                          TEST_PORT=5061 node tests/wedding_archive_protection.test.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const http = require('http');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../backend/src/utils/secrets');

const db = require('../backend/src/config/db');
const PORT = parseInt(process.env.TEST_PORT || '5000', 10);
const BASE = '/api/wedding-crm';

let token = '';

async function initToken() {
  const [rows] = await db.query('SELECT token_version FROM users WHERE id = 1');
  const tokenVersion = rows[0]?.token_version || 0;
  token = jwt.sign(
    { id: 1, username: 'admin@bsctextiles.com', role: 'Admin', fullName: 'System Admin', isGlobalAdmin: true, tokenVersion },
    getJwtSecret(),
    { expiresIn: '1h' }
  );
}

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path: urlPath,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `token=${token}; _csrf=test_csrf_token_12345`,
        'x-csrf-token': 'test_csrf_token_12345',
        'Authorization': `Bearer ${token}`,
        'x-test-bypass': 'bsc-test-secret-suite'
      }
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch { parsed = { raw: data }; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function assert(cond, message) {
  if (!cond) throw new Error(`ASSERT FAILED — ${message}`);
  console.log(`  PASS ${message}`);
}

async function findRow(id) {
  const [rows] = await db.query(
    'SELECT id, customer_code, customer_name, mobile_number, lifecycle_status, customer_status, previous_status, archived_at, archived_by, previous_customer_id FROM wedding_customers WHERE id = ?',
    [id]
  );
  return rows[0];
}

async function auditActions(id) {
  const [rows] = await db.query('SELECT action, details FROM wedding_audit_logs WHERE customer_id = ? ORDER BY id', [id]);
  return rows;
}

async function cleanup(ids) {
  for (const id of ids) {
    // Archived rows refuse deletion by design, so un-archive first.
    await db.query('UPDATE wedding_customers SET lifecycle_status = ? WHERE id = ?', ['ACTIVE', id]);
    await db.query('DELETE FROM wedding_customers WHERE id = ?', [id]);
    await db.query('DELETE FROM wedding_call_logs WHERE customer_id = ?', [id]);
    await db.query('DELETE FROM wedding_status_history WHERE customer_id = ?', [id]);
    await db.query('DELETE FROM wedding_audit_logs WHERE customer_id = ?', [id]);
  }
}

async function run() {
  await initToken();
  const createdIds = [];
  const mobile = `9${Math.floor(100000000 + Math.random() * 899999999)}`;

  try {
    console.log(`\n[Test backend :${PORT}] creating a journey for mobile ${mobile}`);
    const create = await request('POST', `${BASE}/customers`, {
      customer_name: 'Archive Probe',
      mobile_number: mobile,
      email: 'archive.probe@example.com',
      wedding_date: '2030-02-14',
      expected_shopping_date: '2030-01-20',
      follow_up_date: '2030-01-10',
      preferred_shopping_category: 'Bridal Silk',
      estimated_family_size: 6,
      location_id: 3,
      assigned_telecaller: 'Probe Telecaller'
    });
    assert(create.status === 200 && create.body.success, `customer created (got ${create.status} ${create.body.message})`);
    const id = create.body.data.id;
    createdIds.push(id);

    console.log('\n--- 1. Completion status archives automatically ---');
    const change = await request('PUT', `${BASE}/customers/${id}/status`, {
      new_status: 'Wedding Process Completed',
      change_reason: 'Shopping and wedding purchase finished'
    });
    assert(change.status === 200 && change.body.success, `status change accepted (got ${change.status} ${change.body.message})`);
    assert(change.body.data.archived === true, 'response reports archived=true');
    assert(change.body.data.lifecycle_status === 'OLD_CUSTOMER', 'response reports lifecycle_status=OLD_CUSTOMER');

    const row = await findRow(id);
    assert(row.lifecycle_status === 'OLD_CUSTOMER', `row is OLD_CUSTOMER in the database (${row.lifecycle_status})`);
    assert(row.customer_status === 'Wedding Process Completed', `completion status stored (${row.customer_status})`);
    assert(!!row.archived_at, 'completion date/time stored');
    assert(!!row.archived_by, `completed-by stored (${row.archived_by})`);
    assert(!!row.previous_status, `previous status preserved (${row.previous_status})`);

    console.log('\n--- 2. Archive activity entry is written ---');
    const logs = await auditActions(id);
    const archiveLog = logs.find((l) => l.action === 'Moved to Old Customers');
    assert(!!archiveLog, `audit action 'Moved to Old Customers' exists`);
    assert(/Customer moved to Old Customers/.test(archiveLog.details), 'audit detail leads with the required sentence');
    assert(/Status: Wedding Process Completed/.test(archiveLog.details), 'audit records the completion status');
    assert(/Completed By: System Admin/.test(archiveLog.details), 'audit records who completed it');

    console.log('\n--- 3. Gone from the active pipeline, visible in Old Customers ---');
    const active = await request('GET', `${BASE}/customers?search=${mobile}&limit=50`);
    const stillActive = (active.body.data?.customers || []).some((c) => c.id === id);
    assert(!stillActive, 'absent from the active customer register');

    const desk = await request('GET', `${BASE}/calling-desk`);
    const deskBlob = JSON.stringify(desk.body.data || {});
    assert(!deskBlob.includes(`"customer_code":"${row.customer_code}"`), 'absent from the telecaller calling desk');

    const oldList = await request('GET', `${BASE}/old-customers?search=${mobile}`);
    assert(oldList.status === 200 && oldList.body.success, `old customers list responds (got ${oldList.status})`);
    const listed = (oldList.body.data.customers || []).some((c) => c.id === id);
    assert(listed, 'present in Old Customers');
    const stats = oldList.body.data.stats || {};
    assert(typeof stats.completedThisYear === 'number', `stats expose completedThisYear (${stats.completedThisYear})`);
    assert(typeof stats.completedThisMonth === 'number', `stats expose completedThisMonth (${stats.completedThisMonth})`);
    assert(Array.isArray(stats.byStore) && stats.byStore.length > 0, 'stats expose per-store counts');

    console.log('\n--- 4. Deletion is refused for archived records ---');
    const del = await request('DELETE', `${BASE}/customers/${id}`);
    assert(del.status === 403, `DELETE returns 403 (got ${del.status})`);
    assert(del.body.message === 'Completed customer records are permanently protected.',
      `exact protection message returned (${del.body.message})`);
    const stillThere = await findRow(id);
    assert(!!stillThere && stillThere.lifecycle_status === 'OLD_CUSTOMER', 'row survives untouched after the refused delete');

    const merge = await request('POST', `${BASE}/customers/merge`, { primary_id: id, duplicate_id: id + 1 });
    if (merge.status !== 404) {
      assert(merge.status === 403, `merge against an archived row is refused (got ${merge.status})`);
    }

    console.log('\n--- 5. Status edits and call logging on archived rows are refused ---');
    const reopen = await request('PUT', `${BASE}/customers/${id}/status`, { new_status: 'Interested' });
    assert(reopen.status === 409, `re-opening an archived row returns 409 (got ${reopen.status})`);

    const callOnArchived = await request('POST', `${BASE}/log-call`, {
      customer_id: id,
      call_outcome: 'Connected',
      remarks: 'should be refused'
    });
    assert(callOnArchived.status === 409, `logging a call on an archived row returns 409 (got ${callOnArchived.status})`);

    console.log('\n--- 6. Repeat registration links instead of overwriting ---');
    const reReg = await request('POST', `${BASE}/customers`, {
      customer_name: 'Archive Probe',
      mobile_number: mobile,
      wedding_date: '2031-11-05',
      expected_shopping_date: '2031-10-01',
      follow_up_date: '2031-09-20',
      location_id: 3,
      link_to_existing: true
    });
    assert(reReg.status === 200 && reReg.body.success, `new journey created (got ${reReg.status} ${reReg.body.message})`);
    const newId = reReg.body.data.id;
    createdIds.push(newId);

    const newRow = await findRow(newId);
    const oldRow = await findRow(id);
    assert(newId !== id, 'a separate row was created, the archive was not reused');
    assert(newRow.previous_customer_id === id, `new journey points at the archived original (${newRow.previous_customer_id})`);
    assert(oldRow.lifecycle_status === 'OLD_CUSTOMER' && oldRow.customer_status === 'Wedding Process Completed',
      'archived original is unchanged');

    const profile = await request('GET', `${BASE}/customers/${newId}/full-profile`);
    const related = profile.body.data?.associatedCustomers || [];
    assert(related.some((c) => c.id === id), 'profile surfaces the previous journey to an authorized user');
    assert(profile.body.data?.customer?.lifecycle_status === 'ACTIVE', 'new journey is active');

    console.log('\n--- 7. Restore returns the customer to the active pipeline ---');
    const restore = await request('POST', `${BASE}/customers/${id}/restore`, {});
    assert(restore.status === 200 && restore.body.success, `restore succeeds (got ${restore.status})`);
    const restored = await findRow(id);
    assert(restored.lifecycle_status === 'ACTIVE', 'restored row is ACTIVE again');
    assert(restored.customer_status !== 'Wedding Process Completed', `restored off the completion status (${restored.customer_status})`);

    console.log('\n--- 8. Database refuses to cascade-delete customer history ---');
    const [ruleRows] = await db.query(`
      SELECT r.DELETE_RULE AS rule
      FROM information_schema.KEY_COLUMN_USAGE k
      JOIN information_schema.REFERENTIAL_CONSTRAINTS r
        ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
      WHERE k.TABLE_SCHEMA = DATABASE() AND k.TABLE_NAME = 'wedding_call_logs'
        AND k.REFERENCED_TABLE_NAME = 'wedding_customers'
    `);
    const rule = ruleRows[0]?.rule;
    assert(rule === 'RESTRICT' || rule === 'NO ACTION', `wedding_call_logs FK delete rule is ${rule || 'MISSING'}`);
  } finally {
    if (createdIds.length) {
      console.log(`\n[cleanup] removing probe rows ${createdIds.join(', ')}`);
      await cleanup(createdIds);
    }
    await db.end().catch(() => {});
  }

  console.log('\nALL OLD CUSTOMER ARCHIVE TESTS PASSED SUCCESSFULLY!');
}

run().then(() => process.exit(0)).catch((err) => {
  console.error('\nArchive Tests Failed:', err.message || err);
  db.end().catch(() => {});
  setTimeout(() => process.exit(1), 500);
});
