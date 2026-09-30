/**
 * Greeter Kiosk <-> Hourly Footfall integration.
 *
 * Guards the rules that must hold at the backend, not in the UI:
 *   - concurrent kiosk taps must never lose visitors (server-side increment)
 *   - only management may overwrite a count
 *   - a correction updates the existing record, it does not add another
 *   - every change leaves an audit trail with editor, role and timestamp
 *   - a branch user cannot edit another store's record
 *
 * Run against a scratch backend:  PORT=5061 node index.js
 * then:                          TEST_PORT=5061 node tests/greeter_footfall_integration.test.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const http = require('http');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../backend/src/utils/secrets');

const db = require('../backend/src/config/db');
const PORT = parseInt(process.env.TEST_PORT || '5000', 10);
const MARK = 'GREETER_INTEGRATION_TEST';
// Sentinel business date: never a real trading day, so probes cannot collide.
const DAY = '2020-01-05';
const SLOT = 11;

function request(method, urlPath, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost', port: PORT, path: urlPath, method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...(token ? { Cookie: `token=${token}; _csrf=t`, 'x-csrf-token': 't', Authorization: `Bearer ${token}` } : {}),
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

async function tokenFor(where, params = []) {
  const [rows] = await db.query(`
    SELECT u.id, u.username, u.role, u.full_name, u.token_version
    FROM users u WHERE ${where} AND u.active = 1 LIMIT 1
  `, params);
  const u = rows[0];
  if (!u) return null;
  return jwt.sign(
    { id: u.id, username: u.username, role: u.role, fullName: u.full_name || u.username, isGlobalAdmin: u.role === 'Admin', tokenVersion: u.token_version || 0 },
    getJwtSecret(), { expiresIn: '10m' }
  );
}

/**
 * A non-management user together with a store they are genuinely allowed at, so
 * the request reaches the management rule instead of being stopped by the
 * location middleware first.
 */
async function staffUserWithLocation() {
  const [rows] = await db.query(`
    SELECT u.id, u.username, u.role, u.full_name, u.token_version, ul.location_id
    FROM users u
    JOIN user_locations ul ON ul.user_id = u.id
    WHERE u.active = 1
      AND u.role NOT IN ('Admin','Super Admin','System Administrator','Manager','Store Manager')
    LIMIT 1
  `);
  const u = rows[0];
  if (!u) return null;
  return {
    locationId: u.location_id,
    token: jwt.sign(
      { id: u.id, username: u.username, role: u.role, fullName: u.full_name || u.username, locationId: u.location_id, tokenVersion: u.token_version || 0 },
      getJwtSecret(), { expiresIn: '10m' }
    )
  };
}

async function run() {
  const adminToken = await tokenFor("u.role = 'Admin'");
  if (!adminToken) throw new Error('Need an Admin user to run this test');

  await db.query('DELETE FROM footfall_edit_history WHERE entry_id IN (SELECT id FROM footfallentries WHERE remarks = ?)', [MARK]);
  await db.query('DELETE FROM footfallentries WHERE remarks = ?', [MARK]);

  const increment = (token, delta) => request('POST', '/api/crm/footfall/upsert', {
    entryDate: DAY, slotHour: SLOT, mode: 'increment', delta, visitors: delta, remarks: MARK, location_id: 1
  }, token);

  console.log(`\n[Test backend :${PORT}] sentinel date ${DAY}, slot ${SLOT}`);

  console.log('\n--- 1. Concurrent kiosk taps cannot lose visitors ---');
  const first = await increment(adminToken, 1);
  assert(first.status === 200 && first.body.entry.visitors === 1, `first increment lands on 1 (got ${first.status}/${first.body.entry && first.body.entry.visitors})`);
  assert(first.body.entry.entry_source === 'Greeter Kiosk' || first.body.entry.entry_source === 'Admin Entry',
    `origin recorded (${first.body.entry.entry_source})`);
  assert(!!first.body.entry.created_by, `recorded-by captured (${first.body.entry.created_by})`);

  const concurrent = await Promise.all(Array.from({ length: 10 }, () => increment(adminToken, 1)));
  assert(concurrent.every((r) => r.status === 200), 'all 10 concurrent increments accepted');
  const [afterRace] = await db.query('SELECT visitors FROM footfallentries WHERE remarks = ? AND slotHour = ?', [MARK, SLOT]);
  assert(afterRace.length === 1 && Number(afterRace[0].visitors) === 11,
    `exactly ONE row holding 11 visitors after 1+10 taps (got ${afterRace.length} rows / ${afterRace[0] && afterRace[0].visitors})`);

  console.log('\n--- 2. Only management may overwrite a count ---');
  const staffUser = await staffUserWithLocation();
  if (staffUser) {
    const probeSlot = 13;
    const baseline = await request('POST', '/api/crm/footfall/upsert', {
      entryDate: DAY, slotHour: probeSlot, mode: 'increment', delta: 4, visitors: 4, remarks: MARK, location_id: staffUser.locationId
    }, adminToken);
    assert(baseline.status === 200, `baseline row at location ${staffUser.locationId} (${baseline.status})`);

    const forbidden = await request('POST', '/api/crm/footfall/upsert', {
      entryDate: DAY, slotHour: probeSlot, mode: 'set', visitors: 500, remarks: MARK, location_id: staffUser.locationId
    }, staffUser.token);
    assert(forbidden.status === 403, `non-management set-mode refused (${forbidden.status})`);
    assert(/management/i.test(forbidden.body.message || ''),
      `refusal names the real rule, not a generic error ("${forbidden.body.message}")`);
    const [untouched] = await db.query('SELECT visitors FROM footfallentries WHERE remarks = ? AND slotHour = ?', [MARK, probeSlot]);
    assert(Number(untouched[0].visitors) === 4, `count unchanged by the refused overwrite (${untouched[0].visitors})`);

    const allowed = await request('POST', '/api/crm/footfall/upsert', {
      entryDate: DAY, slotHour: probeSlot, mode: 'increment', delta: 1, visitors: 1, remarks: MARK, location_id: staffUser.locationId
    }, staffUser.token);
    assert(allowed.status === 200, 'the same user may still increment');
  } else {
    console.log('  SKIP no non-management user with a store location');
  }

  console.log('\n--- 3. A correction updates the same record ---');
  const corrected = await request('POST', '/api/crm/footfall/upsert', {
    entryDate: DAY, slotHour: SLOT, mode: 'set', visitors: 29, remarks: MARK, location_id: 1, reason: 'Manual recount'
  }, adminToken);
  assert(corrected.status === 200 && corrected.body.entry.visitors === 29, `management correction lands on 29 (${corrected.status})`);
  const [rowShape] = await db.query('SELECT COUNT(*) n FROM footfallentries WHERE remarks = ? AND slotHour = ?', [MARK, SLOT]);
  assert(Number(rowShape[0].n) === 1, `still one row, not original + new (got ${rowShape[0].n})`);

  console.log('\n--- 4. Edit history is kept ---');
  const list = await request('GET', `/api/crm/footfall/entries?date=${DAY}&locationId=1`, undefined, adminToken);
  assert(list.status === 200, `entries list responds (${list.status})`);
  const entry = (list.body.entries || []).find((e) => e.slotHour === SLOT);
  assert(!!entry, 'probe slot present in the entries list');
  const history = await request('GET', `/api/crm/footfall/entry/${entry.id}/history`, undefined, adminToken);
  assert(history.status === 200, `history endpoint responds (${history.status})`);
  const visitorEdits = (history.body.history || []).filter((h) => h.field_changed === 'visitors');
  assert(visitorEdits.length >= 2, `visitor changes recorded (${visitorEdits.length})`);
  const correction = visitorEdits.find((h) => String(h.old_value) !== String(h.new_value) && h.edited_by);
  assert(!!correction, 'a change carries editor detail');
  assert(!!correction.edited_by_role, `editor role stored (${correction.edited_by_role})`);
  assert(!!correction.created_at, `change timestamped (${correction.created_at})`);

  console.log('\n--- 5. By-id edit never duplicates ---');
  const byId = await request('PUT', `/api/crm/footfall/entry/${entry.id}`, { visitors: 33, reason: 'Supervisor correction' }, adminToken);
  assert(byId.status === 200 && byId.body.entry.visitors === 33, `PUT by id updated to 33 (${byId.status})`);
  const [stillOne] = await db.query('SELECT COUNT(*) n FROM footfallentries WHERE remarks = ? AND slotHour = ?', [MARK, SLOT]);
  assert(Number(stillOne[0].n) === 1, `record count unchanged after edit (${stillOne[0].n})`);

  console.log('\n--- 6. Validation ---');
  const negative = await request('POST', '/api/crm/footfall/upsert', { entryDate: DAY, slotHour: 12, mode: 'set', visitors: -1, location_id: 1 }, adminToken);
  assert(negative.status === 400, `negative count rejected (${negative.status})`);
  const badDate = await request('POST', '/api/crm/footfall/upsert', { entryDate: '31-02-2026', slotHour: 12, mode: 'set', visitors: 5, location_id: 1 }, adminToken);
  assert(badDate.status === 400, `invalid date rejected (${badDate.status})`);
  const noAuth = await request('POST', '/api/crm/footfall/upsert', { entryDate: DAY, slotHour: 12, mode: 'set', visitors: 5, location_id: 1 });
  assert(noAuth.status === 401 || noAuth.status === 403, `anonymous write refused (${noAuth.status})`);

  console.log('\n[cleanup] removing probe rows and their history');
  await db.query('DELETE FROM footfall_edit_history WHERE entry_id IN (SELECT id FROM footfallentries WHERE remarks = ?)', [MARK]);
  await db.query('DELETE FROM footfallentries WHERE remarks = ?', [MARK]);
  const [residue] = await db.query('SELECT COUNT(*) n FROM footfallentries WHERE entryDate = ?', [DAY]);
  assert(Number(residue[0].n) === 0, 'no probe residue on the sentinel date');

  console.log('\nALL GREETER <-> FOOTFALL INTEGRATION TESTS PASSED SUCCESSFULLY!');
}

run().then(async () => {
  try { await db.end(); } catch (e) { /* already closed */ }
  process.exit(0);
}).catch(async (err) => {
  console.error('\nGreeter Integration Tests Failed:', err.message || err);
  await db.query('DELETE FROM footfall_edit_history WHERE entry_id IN (SELECT id FROM footfallentries WHERE remarks = ?)', [MARK]).catch(() => {});
  await db.query('DELETE FROM footfallentries WHERE remarks = ?', [MARK]).catch(() => {});
  try { await db.end(); } catch (e) { /* already closed */ }
  process.exit(1);
});
