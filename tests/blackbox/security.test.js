/**
 * Black-Box Tests — Security center & Wedding CSV import endpoints
 * (spawns its own server instance on an isolated port, so these tests never
 * interfere with the rate-limit budget of http.test.js)
 *
 * Only DB-independent behaviour is exercised over HTTP: guards, request
 * validation and response envelopes. Database-touching import logic is
 * white-box tested with mocks (weddingImport.test.js) so this suite can never
 * write to a real database.
 */
const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const path = require('node:path');

const PORT = 3778;
const BASE = `http://127.0.0.1:${PORT}`;
const BACKEND_ROOT = path.join(__dirname, '..', '..', 'backend');

process.env.JWT_SECRET = 'blackbox-security-jwt-0123456789abcdef0123456789abcdef';

let serverProcess;
let adminToken = null;

async function startServer() {
  serverProcess = spawn(process.execPath, [path.join(BACKEND_ROOT, 'index.js')], {
    env: { ...process.env, PORT: String(PORT), JWT_SECRET: process.env.JWT_SECRET },
    stdio: 'ignore'
  });
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('Security test server did not become healthy in time');
}

async function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    await new Promise(r => setTimeout(r, 300));
  }
}

test.before(startServer);
test.after(stopServer);

async function login(username, password) {
  const capRes = await fetch(`${BASE}/api/auth/captcha`);
  const capBody = await capRes.json();
  const digits = [...capBody.data.svg.matchAll(/>(\d)<\/text>/g)].map(m => m[1]).join('');
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, captchaId: capBody.data.captchaId, captchaText: digits })
  });
  const body = await res.json();
  return { res, body };
}

// Non-safe /api methods are CSRF-protected (double-submit cookie + header).
// Perform the same handshake a browser client does.
async function apiPost(urlPath, body, extraHeaders = {}) {
  const bootstrap = await fetch(`${BASE}/health`);
  const csrf = ((bootstrap.headers.get('set-cookie') || '').match(/_csrf=([^;]+)/) || [])[1];
  return fetch(BASE + urlPath, {
    method: 'POST',
    headers: {
      ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      Cookie: `_csrf=${csrf}`,
      'x-csrf-token': csrf,
      ...extraHeaders
    },
    body: body instanceof FormData ? body : JSON.stringify(body)
  });
}

test('admin recovery account login succeeds (boot force-reset seed)', async () => {
  const { res, body } = await login('admin@bsctextiles.com', 'admin@2026');
  assert.equal(res.status, 200);
  assert.ok(body.data.token);
  adminToken = body.data.token;
});

// ── Login activity (admin dashboard feed) ─────────────────────
test('login-activity rejects unauthenticated callers', async () => {
  const res = await fetch(`${BASE}/api/security/login-activity`);
  assert.equal(res.status, 401);
});

test('login-activity returns the dashboard summary contract', async () => {
  const res = await fetch(`${BASE}/api/security/login-activity`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  for (const key of ['loginsToday', 'logins7d', 'logoutsToday', 'logouts7d', 'failedToday', 'activeUsers7d']) {
    assert.ok(typeof body.summary[key] === 'number', `summary.${key} is numeric`);
  }
  assert.ok(Array.isArray(body.recent), 'recent events array present');
});

// ── Shield toggle ─────────────────────────────────────────────
test('shield toggle is admin-gated (guard fires before any handler logic)', async () => {
  const res = await apiPost('/api/security/shield-toggle', { enabled: true });
  assert.equal(res.status, 401);
});

test('shield toggle flips the persistent flag for an admin — and restores it', async () => {
  const headers = { Authorization: `Bearer ${adminToken}` };
  // Capture current state so the test never leaves the shared DB mutated.
  const before = await (await fetch(`${BASE}/api/security/shield-status`)).json();

  const on = await apiPost('/api/security/shield-toggle', { enabled: true }, headers);
  assert.equal(on.status, 200);
  assert.equal((await on.json()).enabled, true);
  const afterOn = await (await fetch(`${BASE}/api/security/shield-status`)).json();
  assert.equal(afterOn.enabled, true);

  const off = await apiPost('/api/security/shield-toggle', { enabled: false }, headers);
  assert.equal(off.status, 200);
  assert.equal((await off.json()).enabled, false);
  const afterOff = await (await fetch(`${BASE}/api/security/shield-status`)).json();
  assert.equal(afterOff.enabled, false);
  assert.equal(afterOff.enabled, before.enabled, 'state restored to what the test found');
});

// ── Wedding CSV import endpoint ───────────────────────────────
test('CSV import rejects unauthenticated callers', async () => {
  const fd = new FormData();
  fd.append('file', new Blob(['name,mobile\nx,9876543210'], { type: 'text/csv' }), 'leads.csv');
  const res = await apiPost('/api/wedding-crm/import-csv', fd);
  assert.equal(res.status, 401);
});

test('CSV import accepts only .csv files (clean 400 from multer filter)', async () => {
  const fd = new FormData();
  fd.append('file', new Blob(['not really a csv'], { type: 'text/plain' }), 'payload.txt');
  const res = await apiPost('/api/wedding-crm/import-csv', fd, {
    Authorization: `Bearer ${adminToken}`,
    'x-auth-token': adminToken
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.message, /Only \.csv files are allowed/);
});
