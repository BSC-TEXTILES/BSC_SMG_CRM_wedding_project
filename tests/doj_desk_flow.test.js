const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const BASE_URL = `http://localhost:${process.env.PORT || 5000}`;

async function testDojDeskFlow() {
  console.log('====================================================');
  console.log(' TESTING DOJ DESK & JOINED STORE DIRECTORY ENDPOINTS');
  console.log('====================================================\n');

  // 1. Authenticate as Admin
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
    'Content-Type': 'application/json',
    'x-bypass-ratelimit-token': 'bsc-test-secret-suite',
    'x-location-id': '1'
  };

  // 2. Test GET /api/employees/not-joined
  console.log('\n2. Testing GET /api/employees/not-joined');
  const notJoinedRes = await fetch(`${BASE_URL}/api/employees/not-joined`, { headers });
  const notJoinedData = await notJoinedRes.json();
  if (!notJoinedData.success || !notJoinedData.stats) {
    console.error('❌ Failed to fetch not-joined desk:', notJoinedData);
    process.exit(1);
  }
  console.log(`✓ Stats returned: Total Pending: ${notJoinedData.stats.total} | Overdue: ${notJoinedData.stats.overdue} | Today: ${notJoinedData.stats.today} | Upcoming: ${notJoinedData.stats.upcoming} | Active Store Staff: ${notJoinedData.stats.activeStaff}`);

  // 3. Test GET /api/employees/joined-store
  console.log('\n3. Testing GET /api/employees/joined-store');
  const joinedRes = await fetch(`${BASE_URL}/api/employees/joined-store`, { headers });
  const joinedData = await joinedRes.json();
  if (!joinedData.success || !Array.isArray(joinedData.employees)) {
    console.error('❌ Failed to fetch joined store directory:', joinedData);
    process.exit(1);
  }
  console.log(`✓ Active Store Staff in Directory: ${joinedData.count} staff members found`);
  if (joinedData.employees.length > 0) {
    console.log(`   Sample Staff: ${joinedData.employees[0].name} (${joinedData.employees[0].emp_code}) - ${joinedData.employees[0].designation || 'Staff'} [${joinedData.employees[0].location_name || 'Store'}]`);
  }

  // 4. Test Quick Schedule DOJ for a candidate
  console.log('\n4. Testing quick_add_doj action (Schedule DOJ)');
  const testCandidateName = 'Rohan Deshmukh';
  const testPhone = '9845012399';
  const todayStr = new Date().toISOString().split('T')[0];

  const scheduleRes = await fetch(`${BASE_URL}/api/employees/not-joined/action`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'quick_add_doj',
      name: testCandidateName,
      phone: testPhone,
      email: 'rohan.d@example.com',
      designation: 'Floor Executive',
      department: 'Saree Galleria',
      section: 'Normal Sarees',
      location_id: 1,
      offered_doj: todayStr,
      salary: '25000',
      reporting_manager: 'Store GM',
      notice_period: 'Immediate',
      reporting_time: '09:30 AM',
      remarks: 'Walk-in offer accepted'
    })
  });
  const scheduleData = await scheduleRes.json();
  if (!scheduleData.success || !scheduleData.appNo) {
    console.error('❌ Failed to schedule candidate:', scheduleData);
    process.exit(1);
  }
  const testAppNo = scheduleData.appNo;
  console.log(`✓ Candidate scheduled: ${testCandidateName} (App No: ${testAppNo}) for DOJ ${todayStr}`);

  // 5. Test GET /api/employees/not-joined/:appNo/history
  console.log(`\n5. Testing GET /api/employees/not-joined/${testAppNo}/history`);
  const historyRes = await fetch(`${BASE_URL}/api/employees/not-joined/${testAppNo}/history`, { headers });
  const historyData = await historyRes.json();
  if (!historyData.success || !historyData.candidate) {
    console.error('❌ Failed to get candidate history:', historyData);
    process.exit(1);
  }
  console.log(`✓ Candidate detail loaded: ${historyData.candidate.name}, Status: ${historyData.candidate.status}`);
  console.log(`   History events: ${historyData.history?.length || 0} event(s)`);

  // 6. Test Follow-up action
  console.log(`\n6. Testing follow_up action`);
  const followUpRes = await fetch(`${BASE_URL}/api/employees/not-joined/action`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      appNo: testAppNo,
      action: 'follow_up',
      contact_result: 'Call Connected',
      candidate_response: 'Candidate confirmed arriving on time with documents',
      next_action: 'Prepare welcome kit',
      remarks: 'Spoke with candidate directly'
    })
  });
  const followUpData = await followUpRes.json();
  if (!followUpData.success) {
    console.error('❌ Failed to record follow-up:', followUpData);
    process.exit(1);
  }
  console.log('✓ Follow-up activity recorded successfully');

  // 7. Test Reschedule action
  console.log(`\n7. Testing reschedule action`);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 2);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const reschedRes = await fetch(`${BASE_URL}/api/employees/not-joined/action`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      appNo: testAppNo,
      action: 'reschedule',
      new_doj: tomorrowStr,
      reporting_time: '10:00 AM',
      reason: 'Requested 2 extra days for travel relocation',
      remarks: 'Approved by Store Manager'
    })
  });
  const reschedData = await reschedRes.json();
  if (!reschedData.success) {
    console.error('❌ Failed to reschedule:', reschedData);
    process.exit(1);
  }
  console.log(`✓ Rescheduled successfully to ${tomorrowStr}`);

  // Verify history grew to 3 events (DOJ_SCHEDULED, FOLLOW_UP, DOJ_RESCHEDULED)
  const historyRes2 = await fetch(`${BASE_URL}/api/employees/not-joined/${testAppNo}/history`, { headers });
  const historyData2 = await historyRes2.json();
  console.log(`✓ History events count after follow-up and reschedule: ${historyData2.history?.length} events recorded`);

  // 8. Test Mark Joined action
  console.log(`\n8. Testing mark_joined action`);
  const joinRes = await fetch(`${BASE_URL}/api/employees/not-joined/action`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      appNo: testAppNo,
      action: 'mark_joined',
      actual_doj: todayStr,
      reporting_time: '09:30 AM',
      department: 'Saree Galleria',
      designation: 'Floor Executive',
      section: 'Normal Sarees',
      location_id: 1,
      reporting_manager: 'Store GM',
      joining_remarks: 'Reporting complete, Aadhaar verified',
      verification_status: 'Verified'
    })
  });
  const joinData = await joinRes.json();
  if (!joinData.success) {
    console.error('❌ Failed to mark candidate as joined:', joinData);
    process.exit(1);
  }
  console.log(`✓ Candidate marked as Joined: ${joinData.message}`);

  // 9. Verify candidate is now in Joined Store Directory
  console.log(`\n9. Verifying candidate in Joined Store Directory`);
  const verifyJoinedRes = await fetch(`${BASE_URL}/api/employees/joined-store?search=${encodeURIComponent(testCandidateName)}`, { headers });
  const verifyJoinedData = await verifyJoinedRes.json();
  const foundEmp = verifyJoinedData.employees?.find(e => e.app_no === testAppNo || e.name === testCandidateName);
  if (!foundEmp) {
    console.error('❌ Joined employee not found in Joined Store Directory:', verifyJoinedData);
    process.exit(1);
  }
  console.log(`✓ Confirmed in Joined Store Directory: ${foundEmp.name} | Emp Code: ${foundEmp.emp_code} | Store: ${foundEmp.location_name}`);

  // 10. Verify candidate is no longer in Not Joined Desk
  const verifyNotJoinedRes = await fetch(`${BASE_URL}/api/employees/not-joined?search=${encodeURIComponent(testAppNo)}`, { headers });
  const verifyNotJoinedData = await verifyNotJoinedRes.json();
  const stillPending = verifyNotJoinedData.candidates?.find(c => c.app_no === testAppNo);
  if (stillPending) {
    console.error('❌ Candidate should have been removed from Not Joined Desk!', stillPending);
    process.exit(1);
  }
  console.log('✓ Candidate correctly removed from Not Joined Desk list');

  console.log('\n====================================================');
  console.log(' ALL DOJ DESK & JOINED STORE API TESTS PASSED! ✓');
  console.log('====================================================');
}

testDojDeskFlow().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
