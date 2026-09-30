/**
 * Sourcing Divert — end-to-end raise flow.
 *
 * Covers the whole pipeline the /divert page depends on:
 *   USER INPUT → API REQUEST → BACKEND ROUTE → CONTROLLER → DATABASE → RESPONSE
 *
 * Guards against the regressions that broke the Raise New Sourcing Divert form:
 *   - validation answered with an opaque 500 instead of a field-level 400
 *   - over-long values rejected by MySQL STRICT_TRANS_TABLES ("Data too long")
 *   - reference image upload not persisted against the created record
 *   - duplicate rows from repeated submissions
 *   - records vanishing on a subsequent read (refresh)
 *
 * Run against a scratch backend:  PORT=5062 node index.js
 * then:                          TEST_PORT=5062 node tests/divert_flow.test.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const http = require('http');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../backend/src/utils/secrets');

const db = require('../backend/src/config/db');
const PORT = parseInt(process.env.TEST_PORT || '5000', 10);
const MARK = 'DIVERT_FLOW_PROBE';
const LONG_PRODUCT =
  'Pure Kanjivaram Silk Saree - Bottle Green with Gold Zari Border / ' +
  'Premium Cotton Shirt Fabric - Navy Blue - 2.5 Metres';

// 1x1 transparent PNG (valid magic bytes for upload.verifyUploadedSignatures)
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

let token = '';

async function initToken() {
  const [rows] = await db.query('SELECT username, role, token_version FROM users WHERE id = 1');
  const u = rows[0];
  token = jwt.sign(
    {
      id: 1,
      username: u.username,
      role: u.role,
      // Deliberately longer than Diverts.createdBy so the controller has to
      // clamp it instead of letting STRICT_TRANS_TABLES fail the insert.
      fullName: `${MARK} ${'Very Long Staff Name '.repeat(6)}`.slice(0, 120),
      isGlobalAdmin: true,
      tokenVersion: u.token_version || 0
    },
    getJwtSecret(),
    { expiresIn: '1h' }
  );
}

function request(method, urlPath, body, locationId) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path: urlPath,
        method,
        headers: {
          'Content-Type': 'application/json',
          Cookie: `token=${token}; _csrf=test_csrf_token_12345`,
          'x-csrf-token': 'test_csrf_token_12345',
          Authorization: `Bearer ${token}`,
          'x-test-bypass': 'bsc-test-secret-suite',
          ...(locationId ? { 'X-Location-Id': String(locationId) } : {})
        }
      },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          let parsed = null;
          try { parsed = JSON.parse(data); } catch { parsed = { raw: data }; }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function multipartRequest(urlPath, fileName, content, contentType) {
  return new Promise((resolve, reject) => {
    const boundary = '----BscDivertProbe' + Date.now();
    const head = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="image"; filename="${fileName}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`
    );
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
    const payload = Buffer.concat([head, content, tail]);

    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path: urlPath,
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': payload.length,
          Cookie: `token=${token}; _csrf=test_csrf_token_12345`,
          'x-csrf-token': 'test_csrf_token_12345',
          Authorization: `Bearer ${token}`,
          'x-test-bypass': 'bsc-test-secret-suite',
          'X-Location-Id': '1'
        }
      },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          let parsed = null;
          try { parsed = JSON.parse(data); } catch { parsed = { raw: data }; }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function assert(cond, message) {
  if (!cond) throw new Error(`ASSERT FAILED — ${message}`);
  console.log(`  PASS ${message}`);
}

async function cleanup() {
  await db.query('DELETE FROM DivertUpdates WHERE note LIKE ?', [`%${MARK}%`]).catch(() => {});
  await db.query('DELETE FROM DivertUpdates WHERE actorId LIKE ?', [`${MARK}%`]).catch(() => {});
  await db.query('DELETE FROM Diverts WHERE remarks LIKE ?', [`%${MARK}%`]).catch(() => {});
}

async function run() {
  await initToken();
  await cleanup();

  console.log(`\n[Test backend :${PORT}] Sourcing Divert raise flow`);

  console.log('\n--- 1. List endpoint answers 200 with a usable payload ---');
  const list0 = await request('GET', '/api/crm/diverts', undefined, 1);
  assert(list0.status === 200, `GET /crm/diverts returns 200 (got ${list0.status})`);
  assert(list0.body.success === true, 'response carries success: true');
  assert(Array.isArray(list0.body.diverts), 'response carries a diverts array');

  console.log('\n--- 2. Required-field validation is a 400 with the real message ---');
  const noProduct = await request('POST', '/api/crm/diverts/create', { quantity: 1 }, 1);
  assert(noProduct.status === 400, `missing product is rejected with 400 (got ${noProduct.status})`);
  assert(
    /Product \/ Fabric Requested is required/i.test(noProduct.body.message || noProduct.body.error || ''),
    `message names the offending field (got "${noProduct.body.message}")`
  );

  const badQty = await request('POST', '/api/crm/diverts/create', { productWanted: 'Silk', quantity: 0 }, 1);
  assert(badQty.status === 400, `quantity 0 is rejected with 400 (got ${badQty.status})`);
  assert(/Quantity must be greater than 0/i.test(badQty.body.message || ''),
    `quantity message is specific (got "${badQty.body.message}")`);

  const negQty = await request('POST', '/api/crm/diverts/create', { productWanted: 'Silk', quantity: -5 }, 1);
  assert(negQty.status === 400, `negative quantity is rejected with 400 (got ${negQty.status})`);

  const badDate = await request('POST', '/api/crm/diverts/create', {
    productWanted: 'Silk', quantity: 1, required_by_date: '2026-02-31'
  }, 1);
  assert(badDate.status === 400, `impossible calendar date is rejected with 400 (got ${badDate.status})`);
  assert(/Required-by Date/i.test(badDate.body.message || ''),
    `date message is specific (got "${badDate.body.message}")`);

  const tooLong = await request('POST', '/api/crm/diverts/create', {
    productWanted: 'x'.repeat(501), quantity: 1
  }, 1);
  assert(tooLong.status === 400, `501-char product is rejected with 400 (got ${tooLong.status})`);
  assert(/maximum 500 characters/i.test(tooLong.body.message || ''),
    `length message is specific (got "${tooLong.body.message}")`);

  const rejectedRows = await db.query('SELECT COUNT(*) n FROM Diverts WHERE productWanted = ?', ['x'.repeat(501)]);
  assert(rejectedRows[0][0].n === 0, 'no partial row is written when validation fails');

  console.log('\n--- 3. A complete valid payload is created and persisted ---');
  const payload = {
    sectionId: 'Ground Floor Saree',
    productWanted: LONG_PRODUCT,
    quantity: 3,
    priceRange: '₹5,000 - ₹8,000',
    reasonCode: 'COLOR_UNAVAILABLE',
    size: '42 / XL / Free Size',
    colour: 'Bottle Green / Wine',
    other_product_details: 'Design: Temple border / Pattern: Checks / Fabric: 80s counts',
    required_by_date: '2026-12-31',
    remarks: `${MARK} - staff remarks with spaces, hyphens, slashes & punctuation`,
    customerName: 'Anitha Kumar',
    customerMobile: '9988776655',
    createdBy: 'Floor Staff'
  };
  const created = await request('POST', '/api/crm/diverts/create', payload, 1);
  assert(created.status === 200 && created.body.success === true,
    `create accepted (got ${created.status}: ${JSON.stringify(created.body)})`);
  assert(!!created.body.id, 'response returns the new record id');

  const [byId] = await db.query('SELECT * FROM Diverts WHERE id = ?', [created.body.id]);
  assert(byId.length === 1, 'row exists in the database after insert');
  const row = byId[0];
  assert(row.productWanted === LONG_PRODUCT, `full product text persisted (got ${row.productWanted.length} chars)`);
  assert(row.sectionId === 'Ground Floor Saree', `store section persisted (${row.sectionId})`);
  assert(row.size === '42 / XL / Free Size', `size persisted (${row.size})`);
  assert(row.colour === 'Bottle Green / Wine', `colour persisted (${row.colour})`);
  assert(row.other_product_details.includes('Temple border'), 'other product details persisted');
  assert(Number(row.quantity) === 3, `quantity persisted as ${row.quantity}`);
  assert(row.priceRange === '₹5,000 - ₹8,000', `target price range persisted (${row.priceRange})`);
  assert(row.reasonCode === 'COLOR_UNAVAILABLE', `reason code persisted (${row.reasonCode})`);
  assert(String(row.required_by_date).startsWith('2026-12-31'), `required-by date persisted (${row.required_by_date})`);
  assert(String(row.remarks).includes(MARK), 'remarks persisted');
  assert(row.customerName === 'Anitha Kumar', `customer name persisted (${row.customerName})`);
  assert(row.customerMobile === '+919988776655', `mobile normalised and persisted (${row.customerMobile})`);
  assert(row.status === 'open', `status defaults to open (${row.status})`);
  assert(!!row.createdBy && row.createdBy.length <= 100, `createdBy clamped to column width (${row.createdBy.length} chars)`);
  assert(row.location_id === 1, `location scoped (${row.location_id})`);
  assert(Number.isInteger(Number(row.refNo)), `refNo auto-assigned (${row.refNo})`);
  assert(!!row.createdAt, 'createdAt present');

  const [updates] = await db.query('SELECT * FROM DivertUpdates WHERE divertId = ?', [created.body.id]);
  assert(updates.length === 1, 'audit trail row created alongside the divert');

  console.log('\n--- 4. The record survives a re-read (page refresh) ---');
  const list1 = await request('GET', '/api/crm/diverts', undefined, 1);
  const found = (list1.body.diverts || []).find((d) => d.id === created.body.id);
  assert(!!found, 'record returned by a subsequent list call');
  assert(found.productWanted === LONG_PRODUCT, 'product text identical after re-read');
  assert(found.refNo === row.refNo, 'refNo identical after re-read');

  console.log('\n--- 5. Exactly one row per submission (no duplicates) ---');
  const [countRows] = await db.query('SELECT COUNT(*) n FROM Diverts WHERE id = ?', [created.body.id]);
  assert(countRows[0].n === 1, 'single row for the created id');
  const [markCount] = await db.query('SELECT COUNT(*) n FROM Diverts WHERE remarks LIKE ?', [`%${MARK}%`]);
  assert(markCount[0].n === 1, `exactly one probe record exists (${markCount[0].n})`);

  console.log('\n--- 6. Reference image upload → stored against the record ---');
  const upload = await multipartRequest('/api/crm/diverts/upload-image', 'probe.png', PNG_1PX, 'image/png');
  assert(upload.status === 200 && upload.body.success === true,
    `image upload accepted (got ${upload.status}: ${JSON.stringify(upload.body)})`);
  assert(upload.body.fileUrl && upload.body.fileUrl.startsWith('/uploads/diverts/'),
    `fileUrl returned (${upload.body.fileUrl})`);

  const withImage = await request('POST', '/api/crm/diverts/create', {
    ...payload,
    productWanted: `${LONG_PRODUCT} WITH IMAGE`,
    reference_image: upload.body.fileUrl
  }, 1);
  assert(withImage.status === 200 && !!withImage.body.id, 'divert with reference image created');

  const [imgRow] = await db.query('SELECT reference_image FROM Diverts WHERE id = ?', [withImage.body.id]);
  assert(imgRow[0].reference_image === upload.body.fileUrl,
    `reference image persisted on the record (${imgRow[0].reference_image})`);
  const onDisk = path.join(__dirname, '../uploads', path.basename(upload.body.fileUrl));
  assert(fs.existsSync(onDisk), 'uploaded file exists on disk');

  console.log('\n--- 7. A malformed image upload is a 400, not a 500 ---');
  const badUpload = await multipartRequest('/api/crm/diverts/upload-image', 'evil.txt', Buffer.from('not an image'), 'text/plain');
  assert(badUpload.status === 400, `non-image upload rejected with 400 (got ${badUpload.status})`);
  assert(/JPG, JPEG, and PNG/i.test(badUpload.body.message || ''),
    `upload message is specific (got "${badUpload.body.message}")`);

  console.log('\n--- 8. Audit trail and cleanup ---');
  const [imageUpdates] = await db.query('SELECT * FROM DivertUpdates WHERE divertId = ?', [withImage.body.id]);
  assert(imageUpdates.length === 1, 'second record also has an audit row');

  await cleanup();
  const [left] = await db.query('SELECT COUNT(*) n FROM Diverts WHERE remarks LIKE ?', [`%${MARK}%`]);
  assert(left[0].n === 0, `probe records removed (${left[0].n} left)`);
  const [leftUpdates] = await db.query('SELECT COUNT(*) n FROM DivertUpdates WHERE divertId NOT IN (SELECT id FROM Diverts)');
  assert(leftUpdates[0].n === 0, `no orphaned audit rows left behind (${leftUpdates[0].n})`);

  try { fs.unlinkSync(onDisk); } catch (e) { /* already gone */ }

  console.log('\nALL SOURCING DIVERT FLOW TESTS PASSED SUCCESSFULLY!');
}

run()
  .then(async () => {
    try { await db.end(); } catch (e) { /* already closed */ }
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('\nSourcing Divert Flow Tests Failed:', err.message || err);
    await cleanup().catch(() => {});
    try { await db.end(); } catch (e) { /* already closed */ }
    process.exit(1);
  });
