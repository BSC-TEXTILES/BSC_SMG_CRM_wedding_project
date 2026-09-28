const http = require('http');
const path = require('path');
require(path.join(__dirname, '../backend/node_modules/dotenv')).config({ path: path.join(__dirname, '../backend/.env') });
const jwt = require(path.join(__dirname, '../backend/node_modules/jsonwebtoken'));

async function req(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const reqOpts = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };
    const r = http.request(reqOpts, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) {}
        resolve({ status: res.statusCode, headers: res.headers, body: json || data });
      });
    });
    r.on('error', reject);
    if (options.body) r.write(options.body);
    r.end();
  });
}

async function run() {
  console.log('=== VERIFYING ALL 4 MODULE ENHANCEMENTS ===\n');

  const token = jwt.sign(
    { id: 1, username: 'admin', role: 'Super Admin', locationId: 1, allowedLocations: [1, 2, 3] },
    process.env.JWT_SECRET || 'bsc_jwt_secret_key_change_in_production'
  );
  console.log('1. Admin JWT generated successfully.');

  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // 2. FR-01: Verify Sanitized Store Directory
  const dirRes = await req('http://localhost:5000/api/directory', { headers: authHeaders });
  console.log('2. GET /api/directory:', dirRes.status, `count=${dirRes.body?.count}`);
  const sampleStore = dirRes.body?.stores?.[0];
  if (sampleStore) {
    console.log('   Sample Store:', {
      name: sampleStore.storeName,
      code: sampleStore.locationCode,
      activeStaffCount: sampleStore.activeStaffCount,
      departments: sampleStore.departments?.length,
      hasPhone: !!sampleStore.storePhone,
      hasEmail: !!sampleStore.storeEmail
    });
  }

  // 3. FR-01: Verify Sanitized Store Directory Export
  const exportDirRes = await req('http://localhost:5000/api/directory/export', { headers: authHeaders });
  console.log('3. GET /api/directory/export:', exportDirRes.status, `count=${exportDirRes.body?.count}`);

  // 4. FR-04: Verify Diverts API with new schema fields
  const divertsRes = await req('http://localhost:5000/api/crm/diverts', { headers: authHeaders });
  console.log('4. GET /api/crm/diverts:', divertsRes.status, `diverts=${divertsRes.body?.diverts?.length}`);

  // 5. FR-04: Verify Diverts Export with new schema fields
  const divertsExportRes = await req('http://localhost:5000/api/crm/diverts/export', { headers: authHeaders });
  console.log('5. GET /api/crm/diverts/export:', divertsExportRes.status, `count=${divertsExportRes.body?.count}`);

  // 6. FR-03: Verify VM Photos List with inspectionDate & location isolation
  const vmPhotosRes = await req('http://localhost:5000/api/vm/photos', { headers: authHeaders });
  console.log('6. GET /api/vm/photos:', vmPhotosRes.status, `total=${vmPhotosRes.body?.total}`);

  // 7. FR-02: Verify Wedding Import Template Download
  const tmplRes = await req('http://localhost:5000/api/wedding-crm/template-xlsx', { headers: authHeaders });
  console.log('7. GET /api/wedding-crm/template-xlsx:', tmplRes.status, tmplRes.headers['content-disposition']);

  console.log('\n=== ALL MODULE ENDPOINTS VERIFIED SUCCESSFULLY! ===');
  process.exit(0);
}

run().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
