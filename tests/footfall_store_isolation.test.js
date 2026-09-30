/**
 * Footfall per-store isolation.
 *
 * Guards a data-loss bug: FootfallEntries historically had UNIQUE
 * (entryDate, slotHour). ON DUPLICATE KEY UPDATE fires on any unique key, so a
 * save for one store silently overwrote another store's row for the same hour —
 * and the overwriting store saw nothing at all.
 *
 * Also guards the IST calendar day: an entry taken before 05:30 IST must be
 * filed under today, not yesterday.
 *
 * Run against a scratch backend:  PORT=5061 node index.js
 * then:                          TEST_PORT=5061 node tests/footfall_store_isolation.test.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const http = require('http');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../backend/src/utils/secrets');

const db = require('../backend/src/config/db');
const PORT = parseInt(process.env.TEST_PORT || '5000', 10);
const MARK = 'FOOTFALL_ISOLATION_PROBE';
const SESSION = `probe-${Date.now()}`;

let token = '';

async function initToken() {
  const [rows] = await db.query('SELECT username, role, token_version FROM users WHERE id = 1');
  const u = rows[0];
  token = jwt.sign(
    { id: 1, username: u.username, role: u.role, fullName: 'Isolation Probe', isGlobalAdmin: true, tokenVersion: u.token_version || 0 },
    getJwtSecret(),
    { expiresIn: '1h' }
  );
}

function request(method, urlPath, body, locationId) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost', port: PORT, path: urlPath, method,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `token=${token}; _csrf=test_csrf_token_12345`,
        'x-csrf-token': 'test_csrf_token_12345',
        'Authorization': `Bearer ${token}`,
        'x-test-bypass': 'bsc-test-secret-suite',
        ...(locationId ? { 'X-Location-Id': String(locationId) } : {})
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

async function run() {
  await initToken();

  const [locs] = await db.query('SELECT id FROM locations ORDER BY id LIMIT 2');
  if (locs.length < 2) throw new Error('Need at least two store locations to test isolation');
  const [locA, locB] = locs.map((l) => l.id);

  // The probe writes under a sentinel date so it can never collide with a real
  // trading day, and removes only rows carrying its own marker.
  const probeDate = '2020-01-03';

  const [idx] = await db.query(`
    SELECT INDEX_NAME AS name, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS cols
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'FootfallEntries'
    GROUP BY INDEX_NAME
  `);
  const indexShapes = idx.map((r) => r.cols);
  console.log(`\n[Test backend :${PORT}] indexes: ${idx.map((r) => `${r.name}(${r.cols})`).join(' | ')}`);
  assert(!indexShapes.includes('entryDate,slotHour'),
    'no legacy UNIQUE (entryDate, slotHour) key — it allowed cross-store overwrite');
  assert(indexShapes.includes('location_id,entryDate,slotHour'),
    'UNIQUE (location_id, entryDate, slotHour) is in place');

  console.log('\n--- 1. Two stores may hold the same date and hour ---');
  const saveA = await request('POST', '/api/crm/footfall/upsert', {
    entryDate: probeDate, slotHour: 11, visitors: 40, remarks: MARK, submittedBy: 'Store A Manager', location_id: locA
  }, locA);
  assert(saveA.status < 300 && saveA.body.success, `store A save accepted (got ${saveA.status})`);
  assert(saveA.body.todayTotal === 40, `store A reports its own total (got ${saveA.body.todayTotal})`);

  const saveB = await request('POST', '/api/crm/footfall/upsert', {
    entryDate: probeDate, slotHour: 11, visitors: 245, remarks: MARK, submittedBy: 'Store B Manager', location_id: locB
  }, locB);
  assert(saveB.status < 300 && saveB.body.success, `store B save accepted (got ${saveB.status})`);
  assert(saveB.body.todayTotal === 245, `store B reports its own total, not A's (got ${saveB.body.todayTotal})`);

  const readA = await request('GET', `/api/crm/footfall?date=${probeDate}&locationId=${locA}`, undefined, locA);
  const readB = await request('GET', `/api/crm/footfall?date=${probeDate}&locationId=${locB}`, undefined, locB);
  const valA = (readA.body.entries || []).map((e) => e.visitors).join(',');
  const valB = (readB.body.entries || []).map((e) => e.visitors).join(',');
  assert(valA === '40', `store A still reads 40 — untouched by store B (got "${valA}")`);
  assert(valB === '245', `store B reads its own 245 (got "${valB}")`);

  console.log('\n--- 2. Stored row carries Entered By and timestamps ---');
  const entry = (readB.body.entries || [])[0] || {};
  assert(entry.submittedBy === 'Store B Manager', `Entered By persisted (${entry.submittedBy})`);
  assert(!!entry.createdAt, `Entry Time present (${entry.createdAt})`);
  assert(!!entry.updatedAt, `Last Updated present (${entry.updatedAt})`);

  console.log('\n--- 3. Today defaults to the IST calendar day ---');
  const istToday = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
  const noDate = await request('POST', '/api/crm/footfall/upsert', {
    slotHour: 9, visitors: 3, remarks: MARK, submittedBy: 'Probe', location_id: locA
  }, locA);
  assert(noDate.body.entryDate === istToday,
    `omitted entryDate stores ${istToday}, not the UTC date ${new Date().toISOString().split('T')[0]} (got ${noDate.body.entryDate})`);

  console.log('\n--- 4. A valid date is echoed back for the UI ---');
  assert(saveA.body.entry && saveA.body.entry.visitors === 40, 'response echoes the persisted row for immediate display');

  // History rows reference entry ids, so they must go with the entries or the
  // audit table accumulates orphans pointing at deleted records.
  await db.query('DELETE FROM footfall_edit_history WHERE entry_id IN (SELECT id FROM footfallentries WHERE remarks = ?)', [MARK]);
  const removed = await db.query('DELETE FROM footfallentries WHERE remarks = ?', [MARK]);
  const [left] = await db.query('SELECT COUNT(*) n FROM footfallentries WHERE entryDate = ?', [probeDate]);
  assert(left[0].n === 0, `probe rows removed (${removed[0].affectedRows} deleted), sentinel date left empty`);
  const [orphaned] = await db.query('SELECT COUNT(*) n FROM footfall_edit_history h WHERE NOT EXISTS (SELECT 1 FROM footfallentries f WHERE f.id = h.entry_id)');
  assert(orphaned[0].n === 0, `no orphaned audit rows left behind (${orphaned[0].n})`);

  console.log('\nALL FOOTFALL STORE ISOLATION TESTS PASSED SUCCESSFULLY!');
}

run().then(async () => {
  try { await db.end(); } catch (e) { /* already closed */ }
  process.exit(0);
}).catch(async (err) => {
  console.error('\nFootfall Isolation Tests Failed:', err.message || err);
  await db.query('DELETE FROM footfallentries WHERE remarks = ?', [MARK]).catch(() => {});
  try { await db.end(); } catch (e) { /* already closed */ }
  process.exit(1);
});
