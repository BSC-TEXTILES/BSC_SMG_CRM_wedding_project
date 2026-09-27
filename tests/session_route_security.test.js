const test = require('node:test');
const assert = require('assert');
const path = require('path');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const baseUrl = 'http://localhost:5000';
const JWT_SECRET = process.env.JWT_SECRET || 'bsc_jwt_production_secret_key_2026_super_secure';

test('Session & Route-Level Security Test Suite', async (t) => {
  // Check server health
  let serverReady = false;
  try {
    const health = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(2000) });
    if (health.status === 200) serverReady = true;
  } catch (err) {
    serverReady = false;
  }

  assert.strictEqual(serverReady, true, 'Backend server must be running on port 5000');
  console.log('✓ Backend server is up and responsive at http://localhost:5000');

  await t.test('1. Unauthenticated requests to protected routes return 401 or 403', async () => {
    const protectedRoutes = [
      { method: 'GET', path: '/api/wedding-crm/customers', expectedStatus: 401 },
      { method: 'GET', path: '/api/wedding-crm/customers/1', expectedStatus: 401 },
      { method: 'GET', path: '/api/wedding-crm/stats', expectedStatus: 401 },
      { method: 'GET', path: '/api/wedding-crm/summary', expectedStatus: 401 },
      { method: 'GET', path: '/api/admin/users', expectedStatus: 401 },
      { method: 'POST', path: '/api/wedding-crm/import-csv', expectedStatus: 403 } // CSRF double-submit check
    ];

    for (const route of protectedRoutes) {
      const res = await fetch(`${baseUrl}${route.path}`, {
        method: route.method,
        headers: { 'Content-Type': 'application/json' }
      });
      assert.strictEqual(
        res.status,
        route.expectedStatus,
        `Expected ${route.expectedStatus} for unauthenticated ${route.method} ${route.path}, got ${res.status}`
      );
      const data = await res.json();
      assert.strictEqual(data.success, false);
      console.log(`✓ Blocked unauthenticated ${route.method} ${route.path} -> ${res.status} (${data.message})`);
    }
  });

  await t.test('2. Tampered and expired JWTs are immediately rejected with 401', async () => {
    // 2a. Completely bogus token
    const resBogus = await fetch(`${baseUrl}/api/wedding-crm/customers`, {
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tampered.token'
      }
    });
    assert.strictEqual(resBogus.status, 401);
    const dataBogus = await resBogus.json();
    assert.strictEqual(dataBogus.success, false);
    console.log('✓ Tampered JWT token rejected with 401');

    // 2b. Expired token signed with correct secret
    const expiredToken = jwt.sign(
      { id: 732, username: 'telecaller', role: 'Telecaller', exp: Math.floor(Date.now() / 1000) - 3600 },
      JWT_SECRET
    );
    const resExpired = await fetch(`${baseUrl}/api/wedding-crm/customers`, {
      headers: {
        'Authorization': `Bearer ${expiredToken}`
      }
    });
    assert.strictEqual(resExpired.status, 401);
    console.log('✓ Expired JWT token rejected with 401');

    // 2c. Invalid signature (signed with wrong secret)
    const forgedToken = jwt.sign(
      { id: 1, username: 'admin@bsctextiles.com', role: 'Super Admin' },
      'wrong-secret-key-12345'
    );
    const resForged = await fetch(`${baseUrl}/api/wedding-crm/customers`, {
      headers: {
        'Authorization': `Bearer ${forgedToken}`
      }
    });
    assert.strictEqual(resForged.status, 401);
    console.log('✓ Forged signature JWT token rejected with 401');
  });

  await t.test('3. RBAC role validation blocks unauthorized endpoints with 403', async () => {
    // Generate valid token for existing user with limited permissions (telecaller id: 732)
    const telecallerToken = jwt.sign(
      {
        id: 732,
        username: 'telecaller',
        role: 'Telecaller',
        store_location_id: 1,
        location_id: 1,
        location_name: 'Main Store'
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Telecaller trying to access admin-only user management endpoint
    const resForbidden = await fetch(`${baseUrl}/api/admin/users`, {
      headers: {
        'Authorization': `Bearer ${telecallerToken}`,
        'x-test-bypass': 'bsc-test-secret-suite'
      }
    });
    assert.strictEqual(resForbidden.status, 403, `Expected 403 for telecaller on /api/admin/users, got ${resForbidden.status}`);
    const dataForbidden = await resForbidden.json();
    assert.strictEqual(dataForbidden.success, false);
    console.log(`✓ RBAC blocked unauthorized role access -> 403 (${dataForbidden.message})`);
  });

  await t.test('4. Suspicious Activity Lockout: 3 consecutive 403s trigger auto-lockout & X-Force-Logout', async () => {
    // Use an existing user (id: 728 Greeter) with a fresh random token so it doesn't share count with subtest 3
    const suspiciousToken = jwt.sign(
      {
        id: 728,
        username: 'greeter@bsctextiles.com',
        role: 'Greeter',
        nonce: 'suspicious_' + Date.now(),
        store_location_id: 1,
        location_id: 1
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const headers = {
      'Authorization': `Bearer ${suspiciousToken}`,
      'x-test-bypass': 'bsc-test-secret-suite'
    };

    // Attempt 1: First 403 violation
    const res1 = await fetch(`${baseUrl}/api/admin/users`, { headers });
    assert.strictEqual(res1.status, 403);
    const d1 = await res1.json();
    console.log(`✓ Violation #1 recorded (current count: ${d1.violationCount || 1})`);

    // Attempt 2: Second 403 violation
    const res2 = await fetch(`${baseUrl}/api/admin/users`, { headers });
    assert.strictEqual(res2.status, 403);
    const d2 = await res2.json();
    console.log(`✓ Violation #2 recorded (current count: ${d2.violationCount || 2})`);

    // Attempt 3: Third 403 violation -> Threshold reached!
    const res3 = await fetch(`${baseUrl}/api/admin/users`, { headers });
    assert.strictEqual(res3.status, 403);
    const d3 = await res3.json();
    
    // Check for force logout flags
    const forceLogoutHeader = res3.headers.get('x-force-logout');
    assert.strictEqual(forceLogoutHeader, 'true', 'Expected x-force-logout header to be "true"');
    assert.strictEqual(d3.forceLogout, true, 'Expected response JSON forceLogout to be true');
    console.log('✓ Threshold reached on Violation #3: X-Force-Logout=true, forceLogout=true in payload');

    // Attempt 4: The token is now blacklisted! Subsequent requests must fail with 401 Revoked
    const res4 = await fetch(`${baseUrl}/api/wedding-crm/customers`, { headers });
    assert.strictEqual(res4.status, 401, 'Blacklisted token must return 401 on next request');
    const d4 = await res4.json();
    console.log(`✓ Subsequent request blocked with 401 Revoked: "${d4.message}"`);
  });

  await t.test('5. IDOR Protection: URL parameter tampering across store locations returns 403', async () => {
    // Branch user assigned strictly to Davanagere (location_id: 2)
    const branchToken = jwt.sign(
      {
        id: 727,
        username: 'manager',
        role: 'Manager',
        store_location_id: 2,
        location_id: 2,
        location_code: 'DAV'
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const headers = {
      'Authorization': `Bearer ${branchToken}`,
      'x-test-bypass': 'bsc-test-secret-suite'
    };

    // Customer 17 belongs to location_id: 2 -> Should be accessible (200)
    const resAllowed = await fetch(`${baseUrl}/api/wedding-crm/customers/17`, { headers });
    assert.strictEqual(resAllowed.status, 200, 'User should be allowed to view their own branch customer');
    console.log('✓ Authorized branch customer access succeeds -> 200');

    // Customer 16 belongs to location_id: 1 (Belagavi)
    // Simulating user tampering with URL parameter: /customers/17 -> /customers/16
    const resTampered = await fetch(`${baseUrl}/api/wedding-crm/customers/16`, { headers });
    assert.strictEqual(
      resTampered.status,
      403,
      `Expected 403 Forbidden for cross-branch URL tampering, got ${resTampered.status}`
    );
    const dataTampered = await resTampered.json();
    assert.strictEqual(dataTampered.success, false);
    assert.match(dataTampered.message, /permission to view customer records from other store locations/i);
    console.log(`✓ Cross-branch URL parameter tampering blocked -> 403 ("${dataTampered.message}")`);
  });

  await t.test('6. Safe normal navigation (valid token) succeeds without logout', async () => {
    // Generate valid admin token
    const adminToken = jwt.sign(
      {
        id: 1,
        username: 'admin@bsctextiles.com',
        role: 'Super Admin',
        store_location_id: 1,
        location_id: 1
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const headers = {
      'Authorization': `Bearer ${adminToken}`,
      'x-test-bypass': 'bsc-test-secret-suite'
    };

    // Multiple rapid requests simulating normal navigation, page refresh, bookmarking
    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${baseUrl}/api/wedding-crm/customers?page=1&limit=5`, { headers });
      assert.strictEqual(res.status, 200, `Normal authorized request #${i + 1} should return 200`);
      assert.strictEqual(res.headers.get('x-force-logout'), null);
    }
    console.log('✓ Normal authorized navigation / multiple page loads succeed without triggering logout');
  });
});
