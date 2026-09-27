const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const BASE_URL = `http://localhost:${process.env.PORT || 5000}`;

async function verifyAll() {
  console.log('====================================================');
  console.log(' Verifying All Frontend Endpoints on Live Backend');
  console.log('====================================================\n');

  // Authenticate as Admin
  const captchaRes = await fetch(`${BASE_URL}/api/auth/captcha`, {
    headers: { 'x-bypass-ratelimit-token': 'bsc-test-secret-suite' }
  });
  const captchaData = await captchaRes.json();
  const captchaId = captchaData.data?.captchaId || captchaData.id;
  const captchaText = captchaData.data?.svg 
    ? [...captchaData.data.svg.matchAll(/>(\d)</g)].map(m => m[1]).join('') 
    : (captchaId ? captchaId.slice(-4) : '1234');

  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-bypass-ratelimit-token': 'bsc-test-secret-suite' },
    body: JSON.stringify({ username: 'admin', password: 'password123', captchaId, captchaText })
  });
  const loginData = await loginRes.json();
  const token = loginData.data?.token;

  if (!token) {
    console.error('Failed to log in as admin:', loginData);
    process.exit(1);
  }

  const csrfToken = 'test_csrf_token_secret_12345';
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Cookie': `_csrf=${csrfToken}`,
    'x-csrf-token': csrfToken,
    'x-bypass-ratelimit-token': 'bsc-test-secret-suite',
    'x-location-id': '1'
  };

  // Test the key GET endpoints that the frontend loads on dashboards and pages
  const testEndpoints = [
    // Locations & Auth
    '/api/locations',
    '/api/auth/me',
    '/api/auth/lock-status',

    // Dashboards
    '/api/dashboard/hr',
    '/api/dashboard/manager',
    '/api/global-stats',

    // Talent & Hiring
    '/api/candidates',
    '/api/candidates/kpis',
    '/api/candidates/next-app-no',
    '/api/candidates/pending-actions',
    '/api/candidates/source-breakdown',
    '/api/interviews',
    '/api/interviews/selected',
    '/api/interviews/rejected',
    '/api/interviews/questions',
    '/api/offers',
    '/api/employees',
    '/api/section-allocations',
    '/api/dept-hiring/sections',
    '/api/dept-hiring/targets',

    // Daily Operations & CRM
    '/api/crm/sections',
    '/api/crm/footfall?date=2026-09-27',
    '/api/crm/feedback-questions',
    '/api/crm/feedback-stats',
    '/api/crm/feedbacks',
    '/api/crm/call-queue',
    '/api/crm/diverts',
    '/api/crm/settings',
    '/api/cash',
    '/api/vm/floors',
    '/api/vm/points',
    '/api/vm/submissions',
    '/api/broadcasts',

    // MCheck Store Audit
    '/api/mcheck/modules',
    '/api/mcheck/dashboard',
    '/api/mcheck/reports',
    '/api/mcheck/history',
    '/api/mcheck/trend',

    // Feedback QR
    '/api/feedback-qr',
    '/api/feedback-qr/stats',
    '/api/feedback-qr/locations',
    '/api/feedback-qr/sections',

    // Wedding CRM
    '/api/wedding-crm/calling-desk',
    '/api/wedding-crm/customers',
    '/api/wedding-crm/stats',
    '/api/wedding-crm/analytics',
    '/api/wedding-crm/upcoming-weddings',
    '/api/wedding-crm/calendar',
    '/api/wedding-crm/reports',
    '/api/wedding-crm/sources',
    '/api/wedding-crm/telecallers',

    // Wedding Registration
    '/api/wedding-registration/wedding-registrations',
    '/api/wedding-registration/wedding-registrations/stats',
    '/api/wedding-registration/public/wedding-registration/next-id',

    // Telecaller Desk
    '/api/telecaller-dashboard/stats',
    '/api/telecaller-dashboard/performance',
    '/api/telecaller-dashboard/pipeline',
    '/api/telecaller-dashboard/recent-customers',
    '/api/telecaller-dashboard/call-history',

    // Settings & Permissions & Admin
    '/api/admin/users',
    '/api/admin/users/modules',
    '/api/settings/roles',
    '/api/settings/designations',
    '/api/settings/page-visibility',
    '/api/my-permissions',
    '/api/consent/status',
    '/api/consent/policy-versions',
    '/api/security/shield-status',
    '/api/security/events',
    '/api/security/dashboard-stats',
    '/api/user-tracking/active',
    '/api/user-tracking/stats',

    // Landing
    '/api/landing/locations',
    '/api/landing/stats'
  ];

  let successCount = 0;
  let failCount = 0;
  const failures = [];

  for (const ep of testEndpoints) {
    try {
      const res = await fetch(`${BASE_URL}${ep}`, { headers });
      const text = await res.text();
      let isSuccess = false;

      if (res.status >= 200 && res.status < 400) {
        try {
          const json = JSON.parse(text);
          // Check if explicit error property exists
          if (json.success === false && res.status >= 400) {
            isSuccess = false;
          } else {
            isSuccess = true;
          }
        } catch {
          isSuccess = true;
        }
      }

      if (isSuccess) {
        console.log(`✓ [${res.status}] ${ep}`);
        successCount++;
      } else {
        console.error(`❌ [${res.status}] ${ep}`);
        try {
          const json = JSON.parse(text);
          console.error(`   Error details:`, json.error || json.message || text.slice(0, 150));
        } catch {
          console.error(`   Body:`, text.slice(0, 150));
        }
        failCount++;
        failures.push({ ep, status: res.status, text: text.slice(0, 200) });
      }
    } catch (err) {
      console.error(`❌ [CONN ERROR] ${ep}: ${err.message}`);
      failCount++;
      failures.push({ ep, status: 'CONN', text: err.message });
    }
  }

  console.log('\n====================================================');
  console.log(` Verification Summary: ${successCount} PASSED, ${failCount} FAILED out of ${testEndpoints.length}`);
  console.log('====================================================');

  if (failures.length > 0) {
    console.log('\nFailed endpoints:');
    failures.forEach(f => console.log(` - [${f.status}] ${f.ep} -> ${f.text}`));
  }
}

verifyAll();
