const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const BASE_URL = `http://localhost:${process.env.PORT || 5000}`;

async function testBroadcasts() {
  console.log('Testing /api/broadcasts...');

  // Login as admin
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
    console.error('Login failed:', loginData);
    process.exit(1);
  }
  console.log('Admin login successful.');

  const res = await fetch(`${BASE_URL}/api/broadcasts`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-bypass-ratelimit-token': 'bsc-test-secret-suite',
      'x-location-id': '2'
    }
  });

  console.log('Status code:', res.status);
  const data = await res.json();
  console.log('Response body:', data);
}

testBroadcasts().catch(console.error);
