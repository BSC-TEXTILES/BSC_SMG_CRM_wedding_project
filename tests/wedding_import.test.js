const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const http = require('http');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../backend/src/utils/secrets');

const JWT_SECRET = getJwtSecret();

const db = require('../backend/src/config/db');

let token = '';

async function initToken() {
  const [rows] = await db.query('SELECT token_version FROM users WHERE id = 1');
  const tokenVersion = rows[0]?.token_version || 0;
  token = jwt.sign(
    { id: 1, username: 'admin@bsctextiles.com', role: 'Admin', fullName: 'System Admin', isGlobalAdmin: true, tokenVersion },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function postMultipart(path, boundary, bodyBuffer) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': bodyBuffer.length,
        'Cookie': `token=${token}; _csrf=test_csrf_token_12345`,
        'x-csrf-token': 'test_csrf_token_12345',
        'Authorization': `Bearer ${token}`,
        'x-test-bypass': 'bsc-test-secret-suite'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.write(bodyBuffer);
    req.end();
  });
}

function buildMultipart(fields, fileField, fileName, fileContent) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const parts = [];

  for (const [k, v] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  }

  if (fileField && fileName) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${fileField}"; filename="${fileName}"\r\nContent-Type: text/csv\r\n\r\n`));
    parts.push(Buffer.isBuffer(fileContent) ? fileContent : Buffer.from(fileContent, 'utf8'));
    parts.push(Buffer.from('\r\n'));
  }

  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return { boundary, buffer: Buffer.concat(parts) };
}

async function runImportTests() {
  await initToken();
  console.log('--- 1. Test Import with Missing Location ---');
  const test1 = buildMultipart({}, 'file', 'test.csv', 'customer_name,mobile_number\nTest,9845011111');
  const res1 = await postMultipart('/api/wedding-crm/import-csv', test1.boundary, test1.buffer);
  console.log('Status:', res1.status, 'Message:', res1.body.message || res1.body.error);
  if (res1.status !== 400 || !(res1.body.message || '').includes('Store Location')) {
    throw new Error('Test 1 failed: Expected 400 with Store Location error');
  }

  console.log('--- 2. Test Import with Missing Required Column (customer_name) ---');
  const test2 = buildMultipart({ location_id: '2' }, 'file', 'bad_headers.csv', 'full_name,mobile_number\nTest,9845011111');
  const res2 = await postMultipart('/api/wedding-crm/import-csv', test2.boundary, test2.buffer);
  console.log('Status:', res2.status, 'Message:', res2.body.message || res2.body.error);
  if (res2.status !== 400 || !(res2.body.message || '').includes('customer_name')) {
    throw new Error('Test 2 failed: Expected 400 with missing customer_name error');
  }

  console.log('--- 3. Test Import with Empty File ---');
  const test3 = buildMultipart({ location_id: '2' }, 'file', 'empty.csv', '');
  const res3 = await postMultipart('/api/wedding-crm/import-csv', test3.boundary, test3.buffer);
  console.log('Status:', res3.status, 'Message:', res3.body.message || res3.body.error);
  if (res3.status !== 400) {
    throw new Error('Test 3 failed: Expected 400 on empty file');
  }

  console.log('--- 4. Test Valid Customer Import ---');
  const randomSuffix1 = Math.floor(10000000 + Math.random() * 90000000);
  const randomSuffix2 = Math.floor(10000000 + Math.random() * 90000000);
  const mob1 = `98${randomSuffix1}`;
  const mob2 = `97${randomSuffix2}`;

  const validCsv = `customer_name,mobile_number,email,wedding_date,store_location,notes,alternate_number\n` +
    `Rhea Sharma,${mob1},rhea@example.com,2025-08-15,Shivamogga,Bridal Kanjeevaram inquiry,9845088888\n` +
    `Deepak Rao,${mob2},deepak@example.com,2025-09-20,Davanagere,Sherwani and suit sets,\n`;

  const test4 = buildMultipart({ location_id: '3' }, 'file', 'valid_customers.csv', validCsv);
  const res4 = await postMultipart('/api/wedding-crm/import-csv', test4.boundary, test4.buffer);
  console.log('Status:', res4.status, 'Summary:', res4.body.message);
  console.log('Data:', res4.body.data);
  if (res4.status !== 200 || !res4.body.success) {
    throw new Error('Test 4 failed: Expected 200 success');
  }
  if (res4.body.data.importedCount !== 2) {
    throw new Error(`Expected 2 imported records, got: ${res4.body.data.importedCount}`);
  }

  console.log('--- 5. Test Duplicate Mobile Detection on Same File ---');
  const test5 = buildMultipart({ location_id: '3' }, 'file', 'repeat.csv', validCsv);
  const res5 = await postMultipart('/api/wedding-crm/import-csv', test5.boundary, test5.buffer);
  console.log('Status:', res5.status, 'Summary:', res5.body.message);
  console.log('Data:', res5.body.data);
  if (res5.body.data.duplicateCount !== 2) {
    throw new Error('Test 5 failed: Expected 2 duplicates skipped');
  }

  console.log('\nALL IMPORT VALIDATION TESTS PASSED SUCCESSFULLY!');
}

runImportTests().then(async () => {
  // Close the shared MySQL pool so the test process can exit - otherwise the
  // open pool keeps the event loop alive and `npm test` never completes.
  try { await db.end(); } catch (e) { /* already closed */ }
  process.exit(0);
}).catch(err => {
  console.error('Import Tests Failed:', err);
  process.exit(1);
});
