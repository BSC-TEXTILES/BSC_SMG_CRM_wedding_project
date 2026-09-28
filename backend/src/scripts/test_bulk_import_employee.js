require('dotenv').config();
const http = require('http');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'f4a7c2b991823d0476831e5f8d22bb4756c9a109723e71d4cb803a64789df502';
const CSRF_TEST_TOKEN = 'test_csrf_token_secret_import';

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

async function run() {
  console.log('========================================================');
  console.log('TESTING BULK EMPLOYEE IMPORT (CSV / EXCEL DATA TO DB)');
  console.log('========================================================');

  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  // Clean up any old test records
  await pool.query("DELETE FROM employees WHERE employee_id IN ('TEST-EMP-001', 'TEST-EMP-002')");
  await pool.query("DELETE FROM users WHERE employee_id IN ('TEST-EMP-001', 'TEST-EMP-002')");

  const adminToken = jwt.sign(
    { id: 1, username: 'admin@bsctextiles.com', role: 'Super Admin', isGlobalAdmin: true },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const staffToken = jwt.sign(
    { id: 733, username: 'staff', role: 'Staff', locationId: 1 },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  let passed = 0;
  let failed = 0;
  function assert(cond, name, details = '') {
    if (cond) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}: ${details}`);
      failed++;
    }
  }

  // 1. Staff RBAC rejection test
  const staffRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/employees/bulk-import',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${staffToken}`,
      'Cookie': `_csrf=${CSRF_TEST_TOKEN}`,
      'x-csrf-token': CSRF_TEST_TOKEN
    }
  }, { employees: [{ fullName: 'Illegal Staff Entry' }] });

  assert(staffRes.status === 403, 'Non-admin staff is strictly rejected with HTTP 403 Forbidden', `Got status ${staffRes.status}`);

  // 2. Admin bulk import test (2 employees)
  const importPayload = {
    employees: [
      {
        fullName: 'Aarav Sharma',
        employeeId: 'TEST-EMP-001',
        department: 'Sales',
        designation: 'Floor Executive',
        role: 'Staff',
        email: 'aarav.sharma@bsctextiles.com',
        phone: '9888877771',
        location: 'Belagavi',
        joiningDate: '2024-03-01',
        salary: 28000,
        status: 'Active',
        section: 'Ethnic Wear',
        address: '101 Silk Street',
        city: 'Belagavi',
        aadhaarNumber: '111122223333'
      },
      {
        fullName: 'Pooja Hegde',
        employeeId: 'TEST-EMP-002',
        department: 'Inventory',
        designation: 'Stock Manager',
        role: 'Staff',
        email: 'pooja.hegde@bsctextiles.com',
        phone: '9888877772',
        location: 'Davanagere',
        joiningDate: '2024-03-15',
        salary: 32000,
        status: 'Active',
        section: 'Warehouse',
        address: '202 Textile Lane',
        city: 'Davanagere',
        aadhaarNumber: '444455556666'
      }
    ]
  };

  const adminRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/employees/bulk-import',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
      'Cookie': `_csrf=${CSRF_TEST_TOKEN}`,
      'x-csrf-token': CSRF_TEST_TOKEN
    }
  }, importPayload);

  assert(adminRes.status === 200, 'Admin bulk import returns HTTP 200 OK', `Status was ${adminRes.status}`);
  assert(adminRes.body?.success === true, 'Response indicates success: true');
  assert(adminRes.body?.stats?.inserted === 2, 'Stats confirm exactly 2 new employees inserted');

  // 3. Verify records were saved in the MySQL `employees` table
  const [empDbRows] = await pool.query(
    "SELECT * FROM employees WHERE employee_id IN ('TEST-EMP-001', 'TEST-EMP-002') ORDER BY employee_id ASC"
  );
  assert(empDbRows.length === 2, 'Database employees table now contains both imported employee records', `Found ${empDbRows.length}`);
  if (empDbRows.length === 2) {
    assert(empDbRows[0].name === 'Aarav Sharma', 'Employee 1 name matches in employees table');
    assert(empDbRows[0].department === 'Sales', 'Employee 1 department matches in employees table');
    assert(Number(empDbRows[0].salary) === 28000, 'Employee 1 salary matches in employees table');
    assert(empDbRows[1].name === 'Pooja Hegde', 'Employee 2 name matches in employees table');
    assert(empDbRows[1].department === 'Inventory', 'Employee 2 department matches in employees table');
    assert(Number(empDbRows[1].salary) === 32000, 'Employee 2 salary matches in employees table');
  }

  // 4. Verify records were saved in the MySQL `users` table
  const [userDbRows] = await pool.query(
    "SELECT id, username, full_name, employee_id, department, designation, salary FROM users WHERE employee_id IN ('TEST-EMP-001', 'TEST-EMP-002') ORDER BY employee_id ASC"
  );
  assert(userDbRows.length === 2, 'Database users table contains both accounts for Directory & Login', `Found ${userDbRows.length}`);
  if (userDbRows.length === 2) {
    assert(userDbRows[0].full_name === 'Aarav Sharma', 'User 1 full_name matches in users table');
    assert(userDbRows[1].full_name === 'Pooja Hegde', 'User 2 full_name matches in users table');
  }

  // 5. Test update path: re-import Aarav Sharma with salary increase
  const updatePayload = {
    employees: [
      {
        fullName: 'Aarav Sharma',
        employeeId: 'TEST-EMP-001',
        department: 'Sales',
        designation: 'Senior Sales Executive',
        salary: 35000,
        status: 'Active'
      }
    ]
  };

  const updateRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/employees/bulk-import',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
      'Cookie': `_csrf=${CSRF_TEST_TOKEN}`,
      'x-csrf-token': CSRF_TEST_TOKEN
    }
  }, updatePayload);

  assert(updateRes.status === 200, 'Re-importing existing employee returns HTTP 200');
  assert(updateRes.body?.stats?.updated === 1, 'Stats confirm record was updated rather than duplicated');

  const [[updatedUser]] = await pool.query("SELECT salary, designation FROM users WHERE employee_id = 'TEST-EMP-001'");
  assert(Number(updatedUser.salary) === 35000, 'Updated user salary reflected in MySQL users table');
  assert(updatedUser.designation === 'Senior Sales Executive', 'Updated designation reflected in MySQL users table');

  const [[updatedEmp]] = await pool.query("SELECT salary, designation FROM employees WHERE employee_id = 'TEST-EMP-001'");
  assert(Number(updatedEmp.salary) === 35000, 'Updated employee salary reflected in MySQL employees table');

  // Clean up test rows
  await pool.query("DELETE FROM employees WHERE employee_id IN ('TEST-EMP-001', 'TEST-EMP-002')");
  await pool.query("DELETE FROM users WHERE employee_id IN ('TEST-EMP-001', 'TEST-EMP-002')");
  await pool.end();

  console.log('========================================================');
  console.log(`BULK IMPORT VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
