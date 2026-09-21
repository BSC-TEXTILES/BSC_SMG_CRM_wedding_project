/**
 * Black-Box Tests — full HTTP surface of the running server
 * (backend/index.js is spawned on a random port; tests only speak HTTP and
 * never touch internals — exactly what an external client would see.)
 *
 * Covered: health, SPA serving, gzipped assets, immutable asset caching,
 * authentication (success/failure/master recovery), token guards on sensitive
 * endpoints, legacy dispatcher authorization, security shield flag, and
 * login rate limiting (run last — it exhausts the attempt budget).
 */
const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const PORT = 3777;
const BASE = `http://127.0.0.1:${PORT}`;
const BACKEND_ROOT = path.join(__dirname, '..', '..', 'backend');

process.env.JWT_SECRET = 'blackbox-jwt-secret-0123456789abcdef0123456789abcdef';
process.env.PORT = String(PORT);

let serverProcess;
let adminToken = null;
let csrfToken = null;

// Fetch a fresh captcha from the server and read the 4 digits out of the SVG
// (the digits are real, deliberately distorted SVG <text> nodes).
async function fetchCaptcha() {
  const res = await fetch(`${BASE}/api/auth/captcha`);
  assert.equal(res.status, 200);
  const body = await res.json();
  const digits = [...body.data.svg.matchAll(/>(\d)<\/text>/g)].map(m => m[1]).join('');
  assert.match(digits, /^\d{4}$/, 'SVG contains a 4-digit code');
  return { captchaId: body.data.captchaId, captchaText: digits };
}

async function login(username, password) {
  const captcha = await fetchCaptcha();
  return fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, ...captcha })
  });
}

// Non-safe /api methods are CSRF-protected (double-submit: cookie + header).
// Grab the token the server sets on every response and replay it like a
// browser would. Auth and landing endpoints are exempt, so login is unaffected.
async function apiPost(urlPath, body, extraHeaders = {}) {
  const res = await fetch(`${BASE}/health`);
  const setCookie = res.headers.get('set-cookie') || '';
  csrfToken = (setCookie.match(/_csrf=([^;]+)/) || [])[1] || csrfToken;
  return fetch(BASE + urlPath, {
    method: 'POST',
    headers: {
      ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      Cookie: `_csrf=${csrfToken}`,
      'x-csrf-token': csrfToken,
      ...extraHeaders
    },
    body: body instanceof FormData ? body : JSON.stringify(body)
  });
}

async function startServer() {
  serverProcess = spawn(process.execPath, [path.join(BACKEND_ROOT, 'index.js')], {
    env: { ...process.env, PORT: String(PORT), JWT_SECRET: process.env.JWT_SECRET },
    stdio: 'ignore'
  });
  // Wait for the health endpoint (max ~15 s)
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('Test server did not become healthy in time');
}

async function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    await new Promise(r => setTimeout(r, 300));
  }
}

test.before(startServer);
test.after(stopServer);

// ── Liveness & SPA ─────────────────────────────────────────────
test('GET /health answers with the server/database status contract', async () => {
  const res = await fetch(`${BASE}/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  // The health endpoint reports DB connectivity too: 'healthy' when the pool
  // answers SELECT 1, 'degraded' when the server is up but the DB is not.
  assert.ok(['healthy', 'degraded'].includes(body.status), `unexpected status ${body.status}`);
  assert.equal(body.server, 'operational');
  assert.ok(body.timestamp, 'timestamp present');
});

test('GET / serves the single-page application shell', async () => {
  const res = await fetch(BASE + '/');
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(html.includes('<div id="root">'), 'SPA mount point present');
  assert.ok(/<script[^>]+assets\/index-/.test(html), 'entry script is a hashed asset');
});

test('hashed /assets are served with immutable 1-year caching', async () => {
  const assetsDir = path.join(BACKEND_ROOT, 'dist', 'assets');
  const jsAsset = fs.readdirSync(assetsDir).find(f => f.endsWith('.js'));
  assert.ok(jsAsset, 'a built JS asset exists');
  const res = await fetch(`${BASE}/assets/${jsAsset}`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('cache-control') || '', /immutable/);
  assert.match(res.headers.get('cache-control') || '', /max-age=31536000/);
});

test('large responses are gzipped (compression middleware active)', async () => {
  const assetsDir = path.join(BACKEND_ROOT, 'dist', 'assets');
  const jsAsset = fs.readdirSync(assetsDir).find(f => f.endsWith('.js'));
  const res = await fetch(`${BASE}/assets/${jsAsset}`, {
    headers: { 'Accept-Encoding': 'gzip' }
  });
  assert.equal(res.headers.get('content-encoding'), 'gzip');
});

test('unknown API routes return the standard 404 envelope', async () => {
  const res = await fetch(`${BASE}/api/definitely-not-a-route`);
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.ok(body.message.includes('Not found'));
});

// ── Authentication & authorization ─────────────────────────────
test('login without a captcha is rejected before credentials are checked', async () => {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin@bsctextiles.com', password: 'admin@2026' })
  });
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.match(body.message, /captcha/i);
});

test('login with a wrong captcha is rejected and reports it', async () => {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin@bsctextiles.com', password: 'admin@2026', captchaId: 'no-such-id', captchaText: '0000' })
  });
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.match(body.message, /captcha/i);
});

test('login with wrong credentials (valid captcha): 401 + sanitized message (no stack leak)', async () => {
  const res = await login('ghost.user', 'wrong');
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.ok(!/ECONNREFUSED|SQL|mysql/i.test(body.message), 'internal errors are not leaked');
});

test('captcha is one-time use: replaying it fails', async () => {
  const captcha = await fetchCaptcha();
  const attempt = (text) => fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin@bsctextiles.com', password: 'admin@2026', captchaId: captcha.captchaId, captchaText: text })
  });
  const first = await attempt(captcha.captchaText);
  assert.equal(first.status, 200);
  const replay = await attempt(captcha.captchaText);
  assert.equal(replay.status, 401);
  const body = await replay.json();
  assert.match(body.message, /captcha/i);
});

test('recovery account login (admin@bsctextiles.com / admin@2026) works via the boot force-reset seed', async () => {
  const res = await login('admin@bsctextiles.com', 'admin@2026');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.data.user.role, 'Admin');
  assert.ok(body.data.token);
  assert.ok(body.data.token.split('.').length === 3);
  adminToken = body.data.token;
});

test('wedding CRM rejects unauthenticated access (multi-location CRM is protected)', async () => {
  const res = await fetch(`${BASE}/api/wedding-crm/stats`);
  assert.equal(res.status, 401);
});

test('destructive maintenance endpoint requires a token', async () => {
  const res = await fetch(`${BASE}/api/wipe-db`);
  assert.equal(res.status, 401);
});

test('destructive wipe requires explicit confirmation even with a valid admin token', async () => {
  const res = await fetch(`${BASE}/api/wipe-db`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.equal(res.status, 400); // token accepted; ?confirm=yes deliberately withheld
  const body = await res.json();
  assert.match(body.message, /confirm=yes/);
});

test('legacy dispatcher: unknown action → 400 envelope', async () => {
  const res = await apiPost('/api/legacy', { action: 'noSuchAction' });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.match(body.message, /Unknown action/);
});

test('legacy dispatcher: privileged action without token → 401', async () => {
  const res = await apiPost('/api/legacy', { action: 'addUser' });
  assert.equal(res.status, 401);
});

test('legacy dispatcher: privileged action with admin token passes the guard (not 401/403)', async () => {
  // 'updateUser' is an ADMIN_ONLY action, and its handler rejects an empty
  // payload with 400 BEFORE touching the database — a side-effect-free proof
  // that the auth + role guard let the request through.
  const res = await apiPost('/api/legacy', { action: 'updateUser' }, {
    Authorization: `Bearer ${adminToken}`,
    'x-auth-token': adminToken
  });
  assert.ok(res.status !== 401 && res.status !== 403, `guard passed (got ${res.status})`);
  assert.equal(res.status, 400);
});

test('security shield status is readable and returns a boolean flag', async () => {
  const res = await fetch(`${BASE}/api/security/shield-status`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  // The flag persists in the Setting table and is admin-toggleable, so its
  // value is environment state — only the contract is asserted here.
  assert.equal(typeof body.enabled, 'boolean');
});

test('shield toggle rejects unauthenticated callers', async () => {
  const res = await apiPost('/api/security/shield-toggle', { enabled: true });
  assert.equal(res.status, 401);
});

test('security log-event rejects unknown event types', async () => {
  const res = await apiPost('/api/security/log-event', { event: 'HACK_THE_PLANET' }, {
    Authorization: `Bearer ${adminToken}`
  });
  assert.equal(res.status, 400);
});

test('security log-event accepts GPS_PING from an authenticated user', async () => {
  const res = await apiPost('/api/security/log-event',
    { event: 'GPS_PING', details: { lat: 15.4589, lng: 75.0078, accuracyM: 20 } },
    {
      Authorization: `Bearer ${adminToken}`,
      'x-auth-token': adminToken
    });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
});

// ── Rate limiting (last — exhausts the login budget) ───────────
test('login brute-force protection engages after the attempt budget', async () => {
  let saw429 = false;
  for (let i = 0; i < 60; i++) {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nobody', password: 'wrong' })
    });
    if (res.status === 429) { saw429 = true; break; }
  }
  assert.ok(saw429, 'a 429 Too Many Requests was returned within the burst');
});
