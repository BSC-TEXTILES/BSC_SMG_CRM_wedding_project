/**
 * Comprehensive Automated Verification for Live TV Kiosk Flow
 */
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

async function verifyLiveTvKiosk() {
  console.log('========================================================');
  console.log(' LIVE TV KIOSK END-TO-END VERIFICATION');
  console.log('========================================================\n');

  let passed = 0;
  let total = 0;

  // 1. Verify Invalid Password Rejection
  total++;
  console.log('1. Testing invalid kiosk password rejection...');
  const failRes = await fetch(`${BASE_URL}/api/crm/verify-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'tv', pin: 'WRONG999', locationId: 1 })
  });
  const failData = await failRes.json();
  if (failRes.status === 401 && failData.message === 'Incorrect kiosk password. Please try again.') {
    console.log('✓ Rejected invalid password with exact message:', failData.message);
    passed++;
  } else {
    console.error('✗ Failed invalid password test:', failRes.status, failData);
  }

  // 2. Verify Valid Kiosk Password for Belagavi (BEL - ID: 1)
  total++;
  console.log('\n2. Testing valid kiosk password verification for Belagavi (ID: 1)...');
  const belPinRes = await fetch(`${BASE_URL}/api/crm/verify-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'tv', pin: '1234', locationId: 1 })
  });
  const belPinData = await belPinRes.json();
  if (
    belPinRes.ok &&
    belPinData.success &&
    belPinData.message === 'Live TV Kiosk unlocked.' &&
    belPinData.token &&
    belPinData.location?.code === 'BEL'
  ) {
    console.log('✓ Belagavi kiosk unlocked successfully.');
    console.log('  Token issued:', Boolean(belPinData.token));
    console.log('  Location verified:', belPinData.location);
    console.log('  ExpiresAt epoch:', belPinData.expiresAt);
    passed++;
  } else {
    console.error('✗ Failed Belagavi kiosk verification:', belPinData);
  }

  // 3. Verify Belagavi Live TV Data with Bearer Token
  total++;
  console.log('\n3. Testing GET /api/crm/tv-display?locationId=1 with bearer token...');
  const belDataRes = await fetch(`${BASE_URL}/api/crm/tv-display?locationId=1`, {
    headers: { Authorization: `Bearer ${belPinData.token}` }
  });
  const belData = await belDataRes.json();
  if (belDataRes.ok && belData.success && belData.store.location_code === 'BEL') {
    console.log('✓ Belagavi Live Data loaded:');
    console.log('  Store:', belData.store.location_name, `(${belData.store.location_code})`);
    console.log('  Status:', belData.status.statusText, `(${belData.status.openTime} – ${belData.status.closeTime})`);
    console.log('  Today Footfall:', belData.footfall.todayTotal, 'visitors');
    console.log('  Hourly distribution slots:', belData.footfall.distribution.length);
    console.log('  CSAT:', belData.csat.satisfactionPct !== null ? `${belData.csat.satisfactionPct}%` : 'No data');
    console.log('  Active Diverts:', belData.diverts.totalActive);
    console.log('  Live Feed events:', belData.feed.length);
    console.log('  Broadcast:', belData.broadcast.title);
    passed++;
  } else {
    console.error('✗ Failed loading Belagavi Live TV data:', belData);
  }

  // 4. Verify Davanagere (DAV - ID: 2) Kiosk Unlock & Live Data
  total++;
  console.log('\n4. Testing Davanagere (ID: 2) kiosk unlock and data isolation...');
  const davPinRes = await fetch(`${BASE_URL}/api/crm/verify-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'tv', pin: '1234', locationId: 2 })
  });
  const davPinData = await davPinRes.json();
  const davDataRes = await fetch(`${BASE_URL}/api/crm/tv-display?locationId=2`, {
    headers: { Authorization: `Bearer ${davPinData.token}` }
  });
  const davData = await davDataRes.json();
  if (davDataRes.ok && davData.success && davData.store.location_code === 'DAV') {
    console.log('✓ Davanagere Live Data isolated:');
    console.log('  Store:', davData.store.location_name, `(${davData.store.location_code})`);
    passed++;
  } else {
    console.error('✗ Failed Davanagere data:', davData);
  }

  // 5. Verify Shivamogga (SHI - ID: 3) Kiosk Unlock & Live Data
  total++;
  console.log('\n5. Testing Shivamogga (ID: 3) kiosk unlock and data isolation...');
  const shiPinRes = await fetch(`${BASE_URL}/api/crm/verify-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'tv', pin: '1234', locationId: 3 })
  });
  const shiPinData = await shiPinRes.json();
  const shiDataRes = await fetch(`${BASE_URL}/api/crm/tv-display?locationId=3`, {
    headers: { Authorization: `Bearer ${shiPinData.token}` }
  });
  const shiData = await shiDataRes.json();
  if (shiDataRes.ok && shiData.success && shiData.store.location_code === 'SHI') {
    console.log('✓ Shivamogga Live Data isolated:');
    console.log('  Store:', shiData.store.location_name, `(${shiData.store.location_code})`);
    passed++;
  } else {
    console.error('✗ Failed Shivamogga data:', shiData);
  }

  // 6. Verify Public Locations List Endpoint
  total++;
  console.log('\n6. Testing store locations list availability...');
  const locRes = await fetch(`${BASE_URL}/api/locations`);
  const locData = await locRes.json();
  const locList = Array.isArray(locData) ? locData : locData.locations || locData.data || [];
  if (locRes.ok && locList.length >= 3) {
    console.log('✓ Retrieved store locations count:', locList.length);
    passed++;
  } else {
    console.error('✗ Failed locations retrieval:', locData);
  }

  console.log('\n========================================================');
  console.log(` RESULTS: ${passed}/${total} TESTS PASSED`);
  console.log('========================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

verifyLiveTvKiosk().catch((err) => {
  console.error('Fatal error during test:', err);
  process.exit(1);
});
