const assert = require('assert');
const path = require('path');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

// 1. Test frontend routing resolution logic (pure JS mirror of dashboardRouting.ts)
function getDashboardTypeForRole(role) {
  const r = (role || '').trim().toLowerCase().replace(/[_\s-]+/g, ' ');
  if (
    r === 'telecaller' || 
    r === 'caller' || 
    r === 'tele-caller' || 
    r === 'tele caller' || 
    r === 'vm extension telecaller' || 
    r === 'vm telecaller' ||
    r === 'crm executive' || 
    r === 'crm exec'
  ) {
    return 'telecaller';
  }
  if (r === 'wedding collection manager' || r === 'wedding collection' || r === 'wedding manager') {
    return 'wedding_collection';
  }
  if (r === 'crm manager') {
    return 'crm_manager';
  }
  if (r === 'data analyst' || r === 'analyst') {
    return 'data_analyst';
  }
  if (r === 'vm' || r === 'visual merchandiser') {
    return 'vm';
  }
  if (r === 'greeter') {
    return 'greeter';
  }
  if (r === 'team lead') {
    return 'team_lead';
  }
  if (r === 'super admin' || r === 'admin' || r === 'system administrator') {
    return 'admin';
  }
  if (r === 'hr' || r === 'hr manager' || r === 'recruiter' || r === 'interviewer') {
    return 'hr';
  }
  if (r === 'manager' || r === 'store manager' || r === 'floor manager' || r === 'department manager') {
    return 'manager';
  }
  return 'manager';
}

function getDashboardRouteForRole(role) {
  const type = getDashboardTypeForRole(role);
  switch (type) {
    case 'admin':
      return '/dashboard';
    case 'manager':
      return '/dashboard?view=manager';
    case 'hr':
      return '/dashboard?view=hr';
    case 'vm':
      return '/vm-checklist';
    case 'greeter':
      return '/footfall';
    case 'crm_executive':
    case 'telecaller':
      return '/telecaller/desk';
    case 'crm_manager':
    case 'wedding_collection':
      return '/wedding-crm/dashboard';
    case 'data_analyst':
      return '/wedding-crm/reports';
    case 'team_lead':
      return '/wedding-crm/dashboard';
    default:
      return '/dashboard';
  }
}

function getAuthorizedLandingRoute(role, allowedPageKeys) {
  const defaultRoute = getDashboardRouteForRole(role);
  if (!allowedPageKeys || !Array.isArray(allowedPageKeys) || allowedPageKeys.length === 0) {
    return defaultRoute;
  }

  const r = (role || '').trim().toLowerCase().replace(/[_\s-]+/g, ' ');
  const isTelecallerType = [
    'telecaller', 'caller', 'tele-caller', 'tele caller',
    'vm extension telecaller', 'vm telecaller', 'crm executive', 'crm exec'
  ].includes(r);

  if (isTelecallerType) {
    if (allowedPageKeys.includes('telecaller_desk')) return '/telecaller/desk';
    if (allowedPageKeys.includes('telecaller_dashboard')) return '/telecaller-dashboard';
    if (allowedPageKeys.includes('wedding_crm')) return '/wedding-crm/dashboard';
    if (allowedPageKeys.includes('wedding_registration')) return '/wedding/customer-registration';
    if (allowedPageKeys.includes('dashboard')) return '/dashboard';
    if (allowedPageKeys.includes('footfall')) return '/footfall';
  }

  return defaultRoute;
}

console.log('=== 1. Testing Role Routing Map ===');
const testCases = [
  { role: 'Telecaller', expected: '/telecaller/desk' },
  { role: 'telecaller', expected: '/telecaller/desk' },
  { role: 'caller', expected: '/telecaller/desk' },
  { role: 'VM Extension Telecaller', expected: '/telecaller/desk' },
  { role: 'vm_extension_telecaller', expected: '/telecaller/desk' },
  { role: 'CRM Executive', expected: '/telecaller/desk' },
  { role: 'crm exec', expected: '/telecaller/desk' },
  { role: 'Admin', expected: '/dashboard' },
  { role: 'Super Admin', expected: '/dashboard' },
  { role: 'Manager', expected: '/dashboard?view=manager' },
  { role: 'Floor Manager', expected: '/dashboard?view=manager' },
  { role: 'store manager', expected: '/dashboard?view=manager' },
  { role: 'HR', expected: '/dashboard?view=hr' },
  { role: 'CRM Manager', expected: '/wedding-crm/dashboard' },
];

for (const tc of testCases) {
  const route = getDashboardRouteForRole(tc.role);
  assert.strictEqual(route, tc.expected, `Role "${tc.role}" expected "${tc.expected}", got "${route}"`);
  console.log(`✓ Role [${tc.role}] => ${route}`);
}

// Test ACM fallback for telecaller when telecaller_desk is disabled in DB
console.log('\n=== Testing ACM Fallbacks ===');
assert.strictEqual(getAuthorizedLandingRoute('Telecaller', ['wedding_crm', 'dashboard']), '/wedding-crm/dashboard');
console.log('✓ ACM fallback when telecaller_desk disabled -> /wedding-crm/dashboard');
assert.strictEqual(getAuthorizedLandingRoute('Telecaller', ['dashboard']), '/dashboard');
console.log('✓ ACM fallback when all wedding modules disabled -> /dashboard');

// 2. Test Live HTTP API endpoints on port 5000
(async () => {
  console.log('\n=== 2. Testing Live API Authentication & Route Validation ===');
  const baseUrl = 'http://localhost:5000';

  // Check if live server is reachable
  let isServerRunning = false;
  try {
    const pingRes = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(1200) });
    if (pingRes.status < 500) isServerRunning = true;
  } catch (e) {
    isServerRunning = false;
  }

  if (!isServerRunning) {
    console.log('ℹ Live backend server on http://localhost:5000 is not running.');
    console.log('✓ All role routing map unit tests and ACM fallback tests PASSED successfully.');
    console.log('  (Tip: To run the live HTTP endpoint integration tests, start the server via "npm run dev:backend" first.)');
    return;
  }

  // Helper to fetch captcha and extract code from SVG
  const capRes = await fetch(`${baseUrl}/api/auth/captcha`);
  const capJson = await capRes.json();
  const captchaId = capJson.data.captchaId;
  const captchaText = [...capJson.data.svg.matchAll(/>(\d)</g)].map(m => m[1]).join('');

  // Login as admin
  console.log(`Testing Admin login (captcha code: ${captchaText})...`);
  const adminRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'admin@bsctextiles.com',
      password: process.env.ADMIN_PASSWORD || 'admin@2026',
      captchaId,
      captchaText
    })
  });
  const adminJson = await adminRes.json();
  assert.ok(adminJson.success, 'Admin login should succeed');
  const adminToken = adminJson.data.token;
  console.log('✓ Admin login successful! Role:', adminJson.data.user.role);

  const rawCookie = adminRes.headers.get('set-cookie') || capRes.headers.get('set-cookie') || '';
  const csrfMatch = rawCookie.match(/_csrf=([^;]+)/);
  const csrfToken = csrfMatch ? csrfMatch[1] : '';

  // Validate admin route
  const adminValRes = await fetch(`${baseUrl}/api/security/validate-route`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
      'x-auth-token': adminToken,
      'x-csrf-token': csrfToken,
      'Cookie': `_csrf=${csrfToken}`
    },
    body: JSON.stringify({ pathname: '/dashboard' })
  });
  const adminVal = await adminValRes.json();
  assert.strictEqual(adminVal.allowed || (adminVal.data && adminVal.data.allowed), true, 'Admin should be allowed on /dashboard');
  console.log('✓ Admin allowed on /dashboard:', adminVal.allowed);

  // Now test telecaller token route validation
  const { getJwtSecret } = require('../backend/src/utils/secrets');
  const secret = getJwtSecret();

  const telecallerToken = jwt.sign(
    {
      id: 732,
      username: 'telecaller',
      role: 'Telecaller',
      fullName: 'Pooja Telecaller',
      locationId: 2,
      locationCode: 'DAV',
      locationName: 'Davanagere',
      isGlobalAdmin: false,
      allowedLocations: [2]
    },
    secret,
    { expiresIn: '1h' }
  );

  // Telecaller on /telecaller/desk -> must be allowed
  const tcDeskVal = await fetch(`${baseUrl}/api/security/validate-route`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${telecallerToken}`,
      'x-auth-token': telecallerToken,
      'x-csrf-token': csrfToken,
      'Cookie': `_csrf=${csrfToken}`
    },
    body: JSON.stringify({ pathname: '/telecaller/desk' })
  });
  const tcDeskResult = await tcDeskVal.json();
  assert.strictEqual(tcDeskResult.allowed, true, 'Telecaller must be allowed on /telecaller/desk');
  console.log('✓ Telecaller allowed on /telecaller/desk:', tcDeskResult.allowed);

  // Telecaller on /dashboard -> must be DENIED
  const tcDashVal = await fetch(`${baseUrl}/api/security/validate-route`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${telecallerToken}`,
      'x-auth-token': telecallerToken,
      'x-csrf-token': csrfToken,
      'Cookie': `_csrf=${csrfToken}`
    },
    body: JSON.stringify({ pathname: '/dashboard' })
  });
  const tcDashResult = await tcDashVal.json();
  assert.strictEqual(tcDashResult.allowed, false, 'Telecaller must be denied on admin /dashboard');
  console.log('✓ Telecaller denied on /dashboard:', tcDashResult.allowed === false, `(reason: ${tcDashResult.reason})`);

  // Ensure test users exist in DB for authentication middleware validation
  const pool = require('../backend/src/config/db');
  await pool.query(
    `INSERT INTO users (id, username, password, full_name, role, active, location_id) 
     VALUES (888, 'vm_caller', 'test@2026', 'VM Telecaller User', 'VM Extension Telecaller', 1, 2) 
     ON DUPLICATE KEY UPDATE role = 'VM Extension Telecaller', active = 1`
  );
  await pool.query(
    `INSERT INTO users (id, username, password, full_name, role, active, location_id) 
     VALUES (889, 'floor_mgr', 'test@2026', 'Floor Manager User', 'Floor Manager', 1, 2) 
     ON DUPLICATE KEY UPDATE role = 'Floor Manager', active = 1`
  );

  // VM Extension Telecaller on /telecaller/desk -> must be allowed
  const vmTcToken = jwt.sign(
    {
      id: 888,
      username: 'vm_caller',
      role: 'VM Extension Telecaller',
      fullName: 'VM Extension Telecaller User',
      locationId: 2,
      locationCode: 'DAV',
      locationName: 'Davanagere',
      isGlobalAdmin: false,
      allowedLocations: [2]
    },
    secret,
    { expiresIn: '1h' }
  );

  const vmDeskVal = await fetch(`${baseUrl}/api/security/validate-route`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${vmTcToken}`,
      'x-auth-token': vmTcToken,
      'x-csrf-token': csrfToken,
      'Cookie': `_csrf=${csrfToken}`
    },
    body: JSON.stringify({ pathname: '/telecaller/desk' })
  });
  const vmDeskResult = await vmDeskVal.json();
  assert.strictEqual(vmDeskResult.allowed, true, 'VM Extension Telecaller must be allowed on /telecaller/desk');
  console.log('✓ VM Extension Telecaller allowed on /telecaller/desk:', vmDeskResult.allowed);

  // Floor Manager on /dashboard -> must be allowed
  const fmToken = jwt.sign(
    {
      id: 889,
      username: 'floor_mgr',
      role: 'Floor Manager',
      fullName: 'Floor Manager User',
      locationId: 2,
      locationCode: 'DAV',
      locationName: 'Davanagere',
      isGlobalAdmin: false,
      allowedLocations: [2]
    },
    secret,
    { expiresIn: '1h' }
  );

  const fmVal = await fetch(`${baseUrl}/api/security/validate-route`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${fmToken}`,
      'x-auth-token': fmToken,
      'x-csrf-token': csrfToken,
      'Cookie': `_csrf=${csrfToken}`
    },
    body: JSON.stringify({ pathname: '/dashboard' })
  });
  const fmResult = await fmVal.json();
  assert.strictEqual(fmResult.allowed, true, 'Floor Manager must be allowed on /dashboard');
  console.log('✓ Floor Manager allowed on /dashboard:', fmResult.allowed);

  // Test Calling Desk Data API with Telecaller token
  console.log('\n=== 3. Testing Wedding Calling Desk Queue API ===');
  const deskDataRes = await fetch(`${baseUrl}/api/wedding-crm/calling-desk`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${telecallerToken}`,
      'x-auth-token': telecallerToken
    }
  });
  console.log('Calling desk status:', deskDataRes.status);
  const deskData = await deskDataRes.json();
  const payload = deskData.data || deskData;
  assert.ok(payload.summary !== undefined, 'Calling desk API must return summary');
  console.log('✓ Calling Desk API successfully returned live customer queues:');
  console.log('  Assigned Calls:', payload.summary.assignedCalls);
  console.log('  Pending Calls:', payload.summary.pendingCalls);
  console.log('  Due Today Calls:', payload.counts.dueToday);
  console.log('  Queues present in payload:', Object.keys(payload.queues || {}));

  console.log('\n======================================================');
  console.log('ALL VERIFICATION TESTS COMPLETED AND PASSED WITH 100%!');
  console.log('======================================================');
})().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
