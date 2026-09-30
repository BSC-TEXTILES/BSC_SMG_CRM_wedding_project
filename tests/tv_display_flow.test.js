/**
 * TV Display / Kiosk Live Operations End-to-End Verification Test
 */
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

async function runTvTests() {
  console.log('====================================================');
  console.log(' TESTING BSC TEXTILES LIVE TV / OPERATIONS KIOSK');
  console.log('====================================================\n');

  let passedCount = 0;

  // 1. Test PIN Verification
  console.log('1. Testing POST /api/crm/verify-pin...');
  const pinRes = await fetch(`${BASE_URL}/api/crm/verify-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'tv', pin: '1234', locationId: 1 })
  });
  const pinData = await pinRes.json();
  if (pinRes.ok && pinData.success) {
    console.log('✓ TV PIN verified successfully. Token issued:', Boolean(pinData.token));
    passedCount++;
  } else {
    console.error('✗ TV PIN verification failed:', pinData);
  }

  // 2. Test Live TV Display Endpoint for Belagavi (ID: 1)
  console.log('\n2. Testing GET /api/crm/tv-display?locationId=1 (Belagavi)...');
  const tvBelRes = await fetch(`${BASE_URL}/api/crm/tv-display?locationId=1`);
  const tvBelData = await tvBelRes.json();
  if (tvBelRes.ok && tvBelData.success) {
    console.log(`✓ Belagavi Store Profile: ${tvBelData.store.location_name} (${tvBelData.store.location_code})`);
    console.log(`   Status: ${tvBelData.status.statusText} (${tvBelData.status.openTime} – ${tvBelData.status.closeTime})`);
    console.log(`   Footfall Today: ${tvBelData.footfall.todayTotal} visitors | Hourly Slots: ${tvBelData.footfall.distribution.length}`);
    console.log(`   Customer CSAT: ${tvBelData.csat.satisfactionPct}% (${tvBelData.csat.positiveCount} positive)`);
    console.log(`   Active Diverts: ${tvBelData.diverts.totalActive} pending`);
    console.log(`   Live Operations Feed: ${tvBelData.feed.length} real events loaded`);
    console.log(`   Active Broadcast: "${tvBelData.broadcast.title}"`);
    passedCount++;
  } else {
    console.error('✗ Failed to load Belagavi TV Display data:', tvBelData);
  }

  // 3. Test Live TV Display Endpoint for Davanagere (ID: 2)
  console.log('\n3. Testing GET /api/crm/tv-display?locationId=2 (Davanagere)...');
  const tvDavRes = await fetch(`${BASE_URL}/api/crm/tv-display?locationId=2`);
  const tvDavData = await tvDavRes.json();
  if (tvDavRes.ok && tvDavData.success && tvDavData.store.location_code === 'DAV') {
    console.log(`✓ Davanagere Store Profile: ${tvDavData.store.location_name} (${tvDavData.store.location_code})`);
    passedCount++;
  } else {
    console.error('✗ Failed to load Davanagere TV data:', tvDavData);
  }

  // 4. Test Live TV Display Endpoint for Shivamogga (ID: 3)
  console.log('\n4. Testing GET /api/crm/tv-display?locationId=3 (Shivamogga)...');
  const tvShiRes = await fetch(`${BASE_URL}/api/crm/tv-display?locationId=3`);
  const tvShiData = await tvShiRes.json();
  if (tvShiRes.ok && tvShiData.success && tvShiData.store.location_code === 'SHI') {
    console.log(`✓ Shivamogga Store Profile: ${tvShiData.store.location_name} (${tvShiData.store.location_code})`);
    passedCount++;
  } else {
    console.error('✗ Failed to load Shivamogga TV data:', tvShiData);
  }

  console.log('\n====================================================');
  console.log(` TV DISPLAY TESTS COMPLETED: ${passedCount}/4 PASSED`);
  console.log('====================================================\n');
}

runTvTests().catch(console.error);
