const http = require('http');

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function test() {
  // Get captcha
  const captchaRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/captcha',
    method: 'GET'
  });
  const captchaData = JSON.parse(captchaRes.body);
  console.log('Captcha:', captchaData.data.captchaId, captchaData.data.svg.match(/>([0-9])</g).map(m => m.slice(1, -1)).join(''));
  
  // Login with captcha
  const loginBody = JSON.stringify({
    username: 'admin@bsctextiles.com',
    password: 'admin@2026',
    captchaId: captchaData.data.captchaId,
    captchaText: captchaData.data.svg.match(/>([0-9])</g).map(m => m.slice(1, -1)).join('')
  });
  
  const loginRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginBody)
    }
  }, loginBody);
  
  console.log('Login response:', loginRes.statusCode, loginRes.body);
}

test().catch(console.error);