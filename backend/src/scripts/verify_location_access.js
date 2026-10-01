require('dotenv').config({ path: './backend/.env' });
const jwt = require('jsonwebtoken');
const http = require('http');
const { getJwtSecret } = require('../utils/secrets');

const SECRET = getJwtSecret();
const PORT = process.env.PORT || 5000;

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      locationId: user.locationId,
      location_id: user.locationId,
      locationCode: user.locationCode,
      isGlobalAdmin: user.isGlobalAdmin || false,
      tokenVersion: user.tokenVersion || 1
    },
    SECRET,
    { expiresIn: '1h' }
  );
}

const users = {
  globalAdmin: { id: 1, username: 'admin@bsctextiles.com', role: 'Super Admin', locationId: null, isGlobalAdmin: true, tokenVersion: 54 },
  davAdmin: { id: 906, username: 'ghost', role: 'Admin', locationId: 2, locationCode: 'DAV', tokenVersion: 1 },
  davTelecaller: { id: 725, username: 'test@bsctextiles.com', role: 'Telecaller', locationId: 2, locationCode: 'DAV', tokenVersion: 1 },
  shiManager: { id: 889, username: 'floor_mgr', role: 'Floor Manager', locationId: 3, locationCode: 'SHI', tokenVersion: 1 },
  belStaff: { id: 975, username: 'rohandeshmukh_1001', role: 'Staff', locationId: 1, locationCode: 'BEL', tokenVersion: 1 }
};

const tokens = {
  globalAdmin: createToken(users.globalAdmin),
  davAdmin: createToken(users.davAdmin),
  davTelecaller: createToken(users.davTelecaller),
  shiManager: createToken(users.shiManager),
  belStaff: createToken(users.belStaff)
};

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) {}
        resolve({ status: res.statusCode, headers: res.headers, body: json || data });
      });
    });
    req.on('error', reject);
    if (body) {
      const payload = typeof body === 'string' ? body : JSON.stringify(body);
      req.write(payload);
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log(' BSC TEXTILES — FULL WEBSITE ROLE & LOCATION AUDIT');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} ${details ? '--> ' + details : ''}`);
      failed++;
    }
  }

  try {
    // TEST 1: GET /api/locations scoping
    console.log('--- TEST 1: GET /api/locations scoped listing ---');
    const resLocGlobal = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/locations',
      method: 'GET',
      headers: { Authorization: `Bearer ${tokens.globalAdmin}` }
    });
    assert(
      resLocGlobal.status === 200 && resLocGlobal.body?.locations?.length >= 3,
      'Global Admin sees all 3 locations',
      `Count: ${resLocGlobal.body?.locations?.length}`
    );

    const resLocShi = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/locations',
      method: 'GET',
      headers: { Authorization: `Bearer ${tokens.shiManager}` }
    });
    assert(
      resLocShi.status === 200 && resLocShi.body?.locations?.length === 1 && resLocShi.body?.locations[0]?.id === 3,
      'SHI Manager receives ONLY SHI (location id 3)',
      `Returned: ${JSON.stringify(resLocShi.body?.locations?.map(l => l.id))}`
    );

    const resLocDav = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/locations',
      method: 'GET',
      headers: { Authorization: `Bearer ${tokens.davTelecaller}` }
    });
    assert(
      resLocDav.status === 200 && resLocDav.body?.locations?.length === 1 && resLocDav.body?.locations[0]?.id === 2,
      'DAV Telecaller receives ONLY DAV (location id 2)',
      `Returned: ${JSON.stringify(resLocDav.body?.locations?.map(l => l.id))}`
    );

    // TEST 2: GET /api/global-stats access control
    console.log('\n--- TEST 2: GET /api/global-stats global isolation ---');
    const resStatsGlobal = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/global-stats',
      method: 'GET',
      headers: { Authorization: `Bearer ${tokens.globalAdmin}` }
    });
    assert(resStatsGlobal.status === 200, 'Global Admin can access /api/global-stats');

    const resStatsDavAdmin = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/global-stats',
      method: 'GET',
      headers: { Authorization: `Bearer ${tokens.davAdmin}` }
    });
    assert(resStatsDavAdmin.status === 403, 'Branch Admin (DAV) is REJECTED (403) from /api/global-stats');

    const resStatsShi = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/global-stats',
      method: 'GET',
      headers: { Authorization: `Bearer ${tokens.shiManager}` }
    });
    assert(resStatsShi.status === 403, 'SHI Staff is REJECTED (403) from /api/global-stats');

    // TEST 3: Wedding CRM pipeline location bypass attempts
    console.log('\n--- TEST 3: Wedding CRM Pipeline Tampering Rejection ---');
    // SHI user tries to query BEL data
    const resPipeBel = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/wedding-crm/pipeline?location=BEL',
      method: 'GET',
      headers: { Authorization: `Bearer ${tokens.shiManager}` }
    });
    assert(resPipeBel.status === 403, 'SHI user requesting ?location=BEL receives 403 Forbidden');

    // SHI user tries to query DAV data
    const resPipeDav = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/wedding-crm/pipeline?location=DAV',
      method: 'GET',
      headers: { Authorization: `Bearer ${tokens.shiManager}` }
    });
    assert(resPipeDav.status === 403, 'SHI user requesting ?location=DAV receives 403 Forbidden');

    // SHI user tries to query ?location=all
    const resPipeAll = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/wedding-crm/pipeline?location=all',
      method: 'GET',
      headers: { Authorization: `Bearer ${tokens.shiManager}` }
    });
    assert(resPipeAll.status === 403, 'SHI user requesting ?location=all receives 403 Forbidden');

    // SHI user queries their own location or without param
    const resPipeShi = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/wedding-crm/pipeline?location=SHI',
      method: 'GET',
      headers: { Authorization: `Bearer ${tokens.shiManager}` }
    });
    assert(resPipeShi.status === 200, 'SHI user requesting their own store (SHI) succeeds with 200 OK');

    // TEST 4: Telecaller Dashboard location isolation
    console.log('\n--- TEST 4: Telecaller Dashboard Location Isolation ---');
    const resTeleBypass = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/telecaller-dashboard/stats?location=BEL',
      method: 'GET',
      headers: { Authorization: `Bearer ${tokens.davTelecaller}` }
    });
    assert(resTeleBypass.status === 403, 'DAV telecaller requesting BEL telecaller dashboard receives 403');

    const resTeleAll = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/telecaller-dashboard/stats?location=all',
      method: 'GET',
      headers: { Authorization: `Bearer ${tokens.davTelecaller}` }
    });
    assert(resTeleAll.status === 403, 'DAV telecaller requesting ?location=all telecaller dashboard receives 403');

    const resTeleOwn = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/telecaller-dashboard/stats?location=DAV',
      method: 'GET',
      headers: { Authorization: `Bearer ${tokens.davTelecaller}` }
    });
    assert(resTeleOwn.status === 200, 'DAV telecaller requesting DAV telecaller dashboard succeeds with 200 OK');

    // TEST 5: Wedding Registration location enforcement
    console.log('\n--- TEST 5: Wedding Registration Location Isolation ---');
    const resRegBypass = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/wedding-registration/wedding-registrations?locationId=1',
      method: 'GET',
      headers: { Authorization: `Bearer ${tokens.shiManager}` }
    });
    assert(resRegBypass.status === 403, 'SHI user requesting /api/wedding-registration for BEL receives 403');

    // TEST 6: User Management authorization & location scoping
    console.log('\n--- TEST 6: User Management Location Scoping ---');
    const resUsersGlobal = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/admin/users',
      method: 'GET',
      headers: { Authorization: `Bearer ${tokens.globalAdmin}` }
    });
    assert(resUsersGlobal.status === 200 && resUsersGlobal.body?.data?.users?.length > 0, 'Global Admin retrieves users across all stores');

    const resUsersDavAdmin = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/admin/users',
      method: 'GET',
      headers: { Authorization: `Bearer ${tokens.davAdmin}` }
    });
    if (resUsersDavAdmin.status === 200) {
      const usersList = resUsersDavAdmin.body?.data?.users || [];
      const hasOtherStoreUsers = usersList.some(u => u.location_id !== null && u.location_id !== 2);
      assert(!hasOtherStoreUsers, 'DAV Branch Admin ONLY sees DAV users (zero BEL/SHI users returned)');
    } else {
      assert(false, 'DAV Branch Admin user list request failed');
    }

    // DAV Branch Admin attempts to create a user for BEL (locationId = 1)
    const resCreateUnauthorizedLoc = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/admin/users',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokens.davAdmin}`,
        'Content-Type': 'application/json'
      }
    }, {
      username: `test_bel_${Date.now()}`,
      password: 'password123',
      role: 'Staff',
      locationId: 1
    });
    assert(resCreateUnauthorizedLoc.status === 403, 'DAV Branch Admin cannot create a user assigned to BEL (403)');

    // DAV Branch Admin attempts to create an All Locations user
    const resCreateAllLoc = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/admin/users',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokens.davAdmin}`,
        'Content-Type': 'application/json'
      }
    }, {
      username: `test_all_${Date.now()}`,
      password: 'password123',
      role: 'Staff',
      allLocations: true
    });
    assert(resCreateAllLoc.status === 403, 'DAV Branch Admin cannot create an All Locations user (403)');

    // TEST 7: Single location detail tampering
    console.log('\n--- TEST 7: Location ID direct access check ---');
    const resGetOtherLoc = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/locations/1', // BEL
      method: 'GET',
      headers: { Authorization: `Bearer ${tokens.shiManager}` } // SHI
    });
    assert(resGetOtherLoc.status === 403, 'SHI user requesting /api/locations/1 (BEL) receives 403 Forbidden');

    const resGetOwnLoc = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/locations/3', // SHI
      method: 'GET',
      headers: { Authorization: `Bearer ${tokens.shiManager}` } // SHI
    });
    assert(resGetOwnLoc.status === 200, 'SHI user requesting /api/locations/3 (SHI) succeeds with 200 OK');

    // TEST 8: Hourly Footfall location tampering rejection
    console.log('\n--- TEST 8: Footfall location tampering rejection ---');
    const resFootfallBypass = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/crm/footfall?location_id=1',
      method: 'GET',
      headers: { Authorization: `Bearer ${tokens.davTelecaller}` }
    });
    assert(resFootfallBypass.status === 403, 'DAV telecaller requesting BEL footfall receives 403 Forbidden');

    const resFootfallOwn = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/crm/footfall?location_id=2',
      method: 'GET',
      headers: { Authorization: `Bearer ${tokens.davTelecaller}` }
    });
    assert(resFootfallOwn.status === 200, 'DAV telecaller requesting DAV footfall succeeds with 200 OK');

    // TEST 9: Feedback & Call Queue location isolation
    console.log('\n--- TEST 9: Feedback & Call Queue location isolation ---');
    const resFbBypass = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/crm/feedbacks?location_id=2',
      method: 'GET',
      headers: { Authorization: `Bearer ${tokens.shiManager}` }
    });
    assert(resFbBypass.status === 403, 'SHI user requesting DAV feedbacks receives 403 Forbidden');

    const resCallQueueBypass = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/crm/call-queue?location_id=1',
      method: 'GET',
      headers: { Authorization: `Bearer ${tokens.shiManager}` }
    });
    assert(resCallQueueBypass.status === 403, 'SHI user requesting BEL call queue receives 403 Forbidden');

    // TEST 10: Sourcing Diverts location isolation
    console.log('\n--- TEST 10: Sourcing Diverts location isolation ---');
    const resDivertsBypass = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/crm/diverts?location_id=1',
      method: 'GET',
      headers: { Authorization: `Bearer ${tokens.shiManager}` }
    });
    assert(resDivertsBypass.status === 403, 'SHI user requesting BEL diverts receives 403 Forbidden');

    // TEST 11: MCheck Daily Operations isolation
    console.log('\n--- TEST 11: MCheck Daily Operations location isolation ---');
    const resMcheckBypass = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/mcheck/dashboard?location_id=1',
      method: 'GET',
      headers: { Authorization: `Bearer ${tokens.shiManager}` }
    });
    assert(resMcheckBypass.status === 403, 'SHI user requesting BEL MCheck dashboard receives 403 Forbidden');

    // TEST 12: Wedding CRM Reports location isolation
    console.log('\n--- TEST 12: Wedding CRM Reports location isolation ---');
    const resReportsBypass = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/wedding-crm/reports/daily?locationId=2',
      method: 'GET',
      headers: { Authorization: `Bearer ${tokens.shiManager}` }
    });
    assert(resReportsBypass.status === 403, 'SHI user requesting DAV reports receives 403 Forbidden');

    // TEST 13: Wedding CRM Old Customers location isolation
    console.log('\n--- TEST 13: Wedding CRM Old Customers location isolation ---');
    const resOldCustBypass = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/wedding-crm/old-customers?location_id=1',
      method: 'GET',
      headers: { Authorization: `Bearer ${tokens.shiManager}` }
    });
    assert(resOldCustBypass.status === 403, 'SHI user requesting BEL old customers receives 403 Forbidden');

    console.log('\n====================================================');
    console.log(` AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
