const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const BASE_URL = `http://localhost:${process.env.PORT || 5000}`;

async function testVmAuditFlow() {
  console.log('====================================================');
  console.log(' TESTING VM CHECKLIST AUDIT FLOW END-TO-END');
  console.log('====================================================\n');

  // 1. Authenticate
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
  console.log('✓ Authentication successful as Admin');

  const csrfToken = 'test_csrf_token_secret_12345';
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Cookie': `_csrf=${csrfToken}`,
    'x-csrf-token': csrfToken,
    'x-bypass-ratelimit-token': 'bsc-test-secret-suite',
    'x-location-id': '1'
  };

  // 2. GET /api/vm/floor-summary
  console.log('\n2. Testing GET /api/vm/floor-summary');
  const floorRes = await fetch(`${BASE_URL}/api/vm/floor-summary`, { headers });
  const floorData = await floorRes.json();
  if (!floorData.success || !Array.isArray(floorData.floors)) {
    console.error('❌ Failed floor summary:', floorData);
    process.exit(1);
  }
  console.log(`✓ Loaded ${floorData.floors.length} floors (Today: ${floorData.today})`);
  floorData.floors.forEach(f => {
    console.log(`   - Floor: "${f.name}" | Sections: [${f.sections.join(', ')}] | Last Score: ${f.lastScore ?? '—'}`);
  });

  // Verify all 4 floors exist
  const expectedFloors = ['Ground Floor', 'First Floor', 'Second Floor', 'Third Floor'];
  for (const ef of expectedFloors) {
    const found = floorData.floors.some(f => f.name.toLowerCase() === ef.toLowerCase());
    if (!found) {
      console.error(`❌ Missing expected floor: ${ef}`);
      process.exit(1);
    }
  }
  console.log('✓ All 4 standard floors verified');

  // 3. GET /api/vm/points
  console.log('\n3. Testing GET /api/vm/points');
  const pointsRes = await fetch(`${BASE_URL}/api/vm/points`, { headers });
  const pointsData = await pointsRes.json();
  const points = pointsData.data || pointsData.points || [];
  console.log(`✓ Loaded ${points.length} active VM checklist checkpoints`);
  if (points.length === 0) {
    console.error('❌ Checkpoints list is empty!');
    process.exit(1);
  }

  // 4. POST /api/vm/audits/draft (Ground Floor -> Normal Sarees -> Opening)
  console.log('\n4. Testing POST /api/vm/audits/draft (Create/Resume Draft)');
  const draftRes = await fetch(`${BASE_URL}/api/vm/audits/draft`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      floor: 'Ground Floor',
      section: 'Normal Sarees',
      shift: 'Opening'
    })
  });
  const draftData = await draftRes.json();
  if (!draftData.success || !draftData.auditId) {
    console.error('❌ Failed to create/resume draft:', draftData);
    process.exit(1);
  }
  const auditId = draftData.auditId;
  console.log(`✓ Draft open: Audit ID #${auditId} (Resumed: ${draftData.resumed}, Status: ${draftData.status})`);

  // 5. PUT /api/vm/audits/:id/draft (Autosave answers with comments)
  console.log(`\n5. Testing PUT /api/vm/audits/${auditId}/draft (Save Answers & Notes)`);
  const entriesToSave = points.map((p, idx) => {
    // Make 1st question Fail to test corrective action and fail scoring
    if (idx === 0) {
      return {
        pointId: p.id,
        pointTitle: p.title,
        score: 'Fail',
        comment: 'Rack 2 has two misaligned saree hangers.',
        observation: 'Front display corner rack',
        correctiveAction: 'Realign hangers before 11:30 AM walkthrough.'
      };
    }
    return {
      pointId: p.id,
      pointTitle: p.title,
      score: 'Pass',
      comment: 'Section in good order.',
      observation: '',
      correctiveAction: ''
    };
  });

  const saveRes = await fetch(`${BASE_URL}/api/vm/audits/${auditId}/draft`, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      shift: 'Opening',
      entries: entriesToSave
    })
  });
  const saveData = await saveRes.json();
  if (!saveData.success) {
    console.error('❌ Failed to save draft answers:', saveData);
    process.exit(1);
  }
  console.log(`✓ Draft answers saved: ${saveData.progress?.rated}/${saveData.progress?.total} rated | Score: ${saveData.score?.percent}% (Passed: ${saveData.score?.passed}, Failed: ${saveData.score?.failed})`);

  // 6. POST /api/vm/photos (Upload an inspection photo for this section)
  console.log(`\n6. Testing POST /api/vm/photos (Upload Section Inspection Photo)`);
  // Create a minimal 1x1 PNG buffer
  const samplePngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const sampleBuffer = Buffer.from(samplePngBase64, 'base64');

  const formData = new FormData();
  const blob = new Blob([sampleBuffer], { type: 'image/png' });
  formData.append('photos', blob, 'test_display_rack.png');
  formData.append('submissionId', auditId);
  formData.append('floor', 'Ground Floor');
  formData.append('section', 'Normal Sarees');
  formData.append('pointId', points[0].id);

  const uploadRes = await fetch(`${BASE_URL}/api/vm/photos`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Cookie': `_csrf=${csrfToken}`,
      'x-csrf-token': csrfToken,
      'x-bypass-ratelimit-token': 'bsc-test-secret-suite',
      'x-location-id': '1'
    },
    body: formData
  });
  const uploadData = await uploadRes.json();
  if (!uploadData.success || !Array.isArray(uploadData.photos) || uploadData.photos.length === 0) {
    console.error('❌ Photo upload failed:', uploadData);
    process.exit(1);
  }
  const photo = uploadData.photos[0];
  console.log(`✓ Photo uploaded successfully: ID "${photo.id}", File "${photo.fileName}", URL: ${photo.url}`);

  // 7. GET /api/vm/photos?submissionId=...
  console.log(`\n7. Testing GET /api/vm/photos?submissionId=${auditId}`);
  const listPhotosRes = await fetch(`${BASE_URL}/api/vm/photos?submissionId=${auditId}`, { headers });
  const listPhotosData = await listPhotosRes.json();
  if (!listPhotosData.success || !Array.isArray(listPhotosData.photos)) {
    console.error('❌ Failed to list photos:', listPhotosData);
    process.exit(1);
  }
  console.log(`✓ Retrieved ${listPhotosData.photos.length} photos linked to Audit #${auditId}`);

  // 8. POST /api/vm/audits/:id/submit
  console.log(`\n8. Testing POST /api/vm/audits/${auditId}/submit (Final Audit Submission)`);
  const submitRes = await fetch(`${BASE_URL}/api/vm/audits/${auditId}/submit`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      confirm: true,
      floor: 'Ground Floor',
      section: 'Normal Sarees',
      shift: 'Opening'
    })
  });
  const submitData = await submitRes.json();
  if (!submitData.success) {
    console.error('❌ Audit submission failed:', submitData);
    process.exit(1);
  }
  console.log(`✓ Audit submitted successfully: Status "${submitData.status}", Final Score: ${submitData.score?.percent}%`);

  // 9. GET /api/vm/audits (Verify in history list)
  console.log(`\n9. Testing GET /api/vm/audits (Audit History & Filters)`);
  const auditsRes = await fetch(`${BASE_URL}/api/vm/audits?floor=Ground Floor&section=Normal Sarees`, { headers });
  const auditsData = await auditsRes.json();
  if (!auditsData.success || !Array.isArray(auditsData.audits)) {
    console.error('❌ Failed to get audits history:', auditsData);
    process.exit(1);
  }
  const matchingAudit = auditsData.audits.find(a => a.id === auditId);
  if (!matchingAudit) {
    console.error(`❌ Submitted audit #${auditId} not found in history!`);
    process.exit(1);
  }
  console.log(`✓ Verified Audit #${auditId} in Recent Inspections: Score ${matchingAudit.scorePercent}%, Status ${matchingAudit.status}, Photos ${matchingAudit.photoCount}`);

  // 10. GET /api/vm/audits/:id (Verify detailed record)
  console.log(`\n10. Testing GET /api/vm/audits/${auditId} (Full Detail Modal)`);
  const detailRes = await fetch(`${BASE_URL}/api/vm/audits/${auditId}`, { headers });
  const detailData = await detailRes.json();
  if (!detailData.success || !detailData.audit) {
    console.error('❌ Failed to get audit detail:', detailData);
    process.exit(1);
  }
  const detail = detailData.audit;
  console.log(`✓ Detail verified: ${detail.entries?.length} answers recorded, ${detail.photos?.length} photos attached.`);
  console.log(`   - Sample Answer Q1: "${detail.entries[0]?.pointTitle}" -> ${detail.entries[0]?.score}`);
  console.log(`   - Comment: "${detail.entries[0]?.comment}"`);
  console.log(`   - Corrective Action: "${detail.entries[0]?.correctiveAction}"`);

  // 11. GET /api/vm/attention (Areas Requiring Attention)
  console.log(`\n11. Testing GET /api/vm/attention (Low Performing Analysis)`);
  const attentionRes = await fetch(`${BASE_URL}/api/vm/attention`, { headers });
  const attentionData = await attentionRes.json();
  if (!attentionData.success) {
    console.error('❌ Failed to get attention data:', attentionData);
    process.exit(1);
  }
  console.log(`✓ Areas Requiring Attention loaded successfully:`);
  console.log(`   - Lowest sections count: ${attentionData.lowestSections?.length ?? 0}`);
  console.log(`   - Lowest questions count: ${attentionData.lowestQuestions?.length ?? 0}`);

  // 12. Testing remaining floors: First Floor, Second Floor, Third Floor
  console.log('\n12. Testing all other floors (Isolation & Creation)');
  const otherFloors = [
    { floor: 'First Floor', section: 'Silk Sarees (Upto Lakhs)', shift: 'Mid-Day' },
    { floor: 'Second Floor', section: 'Ladies Wear and Kids Wear', shift: 'Closing' },
    { floor: 'Third Floor', section: 'Mens Wear and Home Furnishing', shift: 'Opening' }
  ];

  for (const item of otherFloors) {
    const res = await fetch(`${BASE_URL}/api/vm/audits/draft`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
    const data = await res.json();
    if (!data.success || data.floor !== item.floor || data.section !== item.section) {
      console.error(`❌ Failed draft for ${item.floor}:`, data);
      process.exit(1);
    }
    console.log(`✓ Verified ${item.floor} -> ${item.section} (Audit #${data.auditId})`);
  }

  console.log('\n====================================================');
  console.log(' ALL 4 STORE FLOORS & VM FLOW TESTS PASSED! ✓');
  console.log('====================================================');
}

testVmAuditFlow().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
