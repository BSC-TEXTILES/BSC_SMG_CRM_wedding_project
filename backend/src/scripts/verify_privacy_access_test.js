require('dotenv').config();
const http = require('http');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'bsc_enterprise_secret_key_jwt_2024_secure';
const CSRF_TEST_TOKEN = 'test_csrf_token_secret_123';

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, rawBody: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runVerification() {
  console.log('========================================================');
  console.log('STARTING END-TO-END PRIVACY & ACCESS CONTROL SUITE');
  console.log('========================================================');

  // Generate tokens for Admin and Non-Admin (Staff)
  const adminToken = jwt.sign(
    { id: 1, username: 'admin@bsctextiles.com', role: 'Super Admin', isGlobalAdmin: true },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const staffUserId = 733;
  const staffToken = jwt.sign(
    { id: staffUserId, username: 'staff', role: 'Staff', locationId: 1 },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, detail = '') {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}: ${detail}`);
      failed++;
    }
  }

  try {
    // 1. Employee Directory Privacy for Non-Admin
    console.log('\n--- 1. Testing Employee Directory Privacy (GET /api/employees) ---');
    const dirRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/employees',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${staffToken}`,
        'Content-Type': 'application/json'
      }
    });

    assert(dirRes.status === 200, 'GET /api/employees returns 200');
    const empList = dirRes.body?.employees || [];
    assert(empList.length > 0, `Directory returned ${empList.length} employees`);

    // Verify sensitive fields are completely blank / redacted
    const sampleEmp = empList[0];
    assert(!sampleEmp.phone, 'Non-admin receives blank employee phone number in directory');
    assert(!sampleEmp.email, 'Non-admin receives blank employee email in directory');
    assert(!sampleEmp.salary, 'Non-admin receives blank employee salary in directory');
    assert(!sampleEmp.aadhaarNumber, 'Non-admin receives blank employee Aadhaar in directory');
    assert(!sampleEmp.address, 'Non-admin receives blank employee home address in directory');
    assert(sampleEmp.canViewSensitive === false, 'canViewSensitive flag is strictly false for non-admin');

    // 2. Sensitive Employee Details Access Control (HTTP 403)
    console.log('\n--- 2. Testing Employee Details Access Control (GET /api/employees/:id) ---');
    const targetEmpId = sampleEmp.id;
    const viewRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/employees/${targetEmpId}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${staffToken}`,
        'Content-Type': 'application/json'
      }
    });

    assert(viewRes.status === 403, 'Unauthorized staff receives HTTP 403 Forbidden for employee details');
    assert(viewRes.body?.accessDenied === true, 'Response specifies accessDenied: true');
    assert(Boolean(viewRes.body?.employeeSummary), 'Response includes safe employeeSummary only');
    assert(!('salary' in (viewRes.body?.employeeSummary || {})), 'Summary does not contain salary');
    assert(!('phone' in (viewRes.body?.employeeSummary || {})), 'Summary does not contain phone');

    // 3. Generate Access Request (POST /api/employees/:id/access-request)
    console.log('\n--- 3. Testing Access Request Generation ---');
    const reqRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/employees/${targetEmpId}/access-request`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${staffToken}`,
        'Content-Type': 'application/json',
        'Cookie': `_csrf=${CSRF_TEST_TOKEN}`,
        'x-csrf-token': CSRF_TEST_TOKEN
      }
    }, { reason: 'Need to review department assignment for upcoming event' });

    assert(reqRes.status === 200 || reqRes.status === 201, `POST /api/employees/:id/access-request returns success (Status: ${reqRes.status})`);
    const requestId = reqRes.body?.requestId;
    assert(Boolean(requestId), `Access request generated with ID #${requestId}`);

    // 4. Admin Access Requests List (GET /api/employees/access-requests)
    console.log('\n--- 4. Testing Admin Listing & Resolution of Requests ---');
    const listRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/employees/access-requests',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });

    assert(listRes.status === 200, 'GET /api/employees/access-requests returns 200 for Admin');
    const requests = listRes.body?.requests || [];
    const foundReq = requests.find(r => r.id === requestId);
    assert(Boolean(foundReq), `Created request #${requestId} found in admin list`);
    assert(String(foundReq?.status).toLowerCase() === 'pending', 'Created request status is pending');

    // 5. Admin Resolves Access Request (POST /api/employees/access-requests/:id/resolve)
    const resolveRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/employees/access-requests/${requestId}/resolve`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
        'Cookie': `_csrf=${CSRF_TEST_TOKEN}`,
        'x-csrf-token': CSRF_TEST_TOKEN
      }
    }, { action: 'APPROVE' });

    assert(resolveRes.status === 200, 'POST /api/employees/access-requests/:id/resolve returns 200 for Admin');
    assert(String(resolveRes.body?.status).toUpperCase() === 'APPROVED', 'Request status transitioned to APPROVED');

    // 6. Non-Admin Re-access after Approval (GET /api/employees/:id)
    console.log('\n--- 5. Testing Employee Details Access for Approved User ---');
    const approvedViewRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/employees/${targetEmpId}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${staffToken}`,
        'Content-Type': 'application/json'
      }
    });

    assert(approvedViewRes.status === 200, 'Approved user now successfully accesses employee details (HTTP 200)');
    assert(approvedViewRes.body?.success === true, 'Response contains full employee record for approved user');

    // 7. Non-Admin Attempting Employee Edit (PUT /api/employees/:id)
    console.log('\n--- 6. Testing Employee Edit RBAC (PUT /api/employees/:id) ---');
    const nonAdminEditRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/employees/${targetEmpId}`,
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${staffToken}`,
        'Content-Type': 'application/json',
        'Cookie': `_csrf=${CSRF_TEST_TOKEN}`,
        'x-csrf-token': CSRF_TEST_TOKEN
      }
    }, { department: 'Hacked Department' });

    assert(nonAdminEditRes.status === 403, 'Non-admin edit attempt strictly rejected with HTTP 403 Forbidden');

    // 8. Admin Performing Valid Edit (PUT /api/employees/:id)
    const adminEditRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/employees/${targetEmpId}`,
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
        'Cookie': `_csrf=${CSRF_TEST_TOKEN}`,
        'x-csrf-token': CSRF_TEST_TOKEN
      }
    }, { notes: 'Verified and approved by System Administrator' });

    assert(adminEditRes.status === 200, 'Admin edit successfully processed with HTTP 200 OK');

    // Clean up test access request
    const pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'u101820758_bsc_smg_crm',
      password: process.env.DB_PASSWORD || 'Btpldvg@2026',
      database: process.env.DB_NAME || 'u101820758_bsc_smg'
    });
    await pool.query('DELETE FROM employee_access_requests WHERE user_id = ?', [staffUserId]);
    await pool.end();

    console.log('\n========================================================');
    console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runVerification();
