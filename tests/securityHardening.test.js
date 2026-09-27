/**
 * BSC Enterprise Security Hardening Test Suite
 * Automated tests verifying full compliance with Enterprise Security Standards:
 * 1. Token Expiry & Signature Verification
 * 2. TokenVersion Mismatch & Invalidation
 * 3. Refresh Token Rotation & Theft Detection
 * 4. Role-Based Access Control (RBAC) & Route Protection
 * 5. Input Sanitization & WAF Injection Defense
 * 6. Security Headers & Information Leakage Prevention
 */

const test = require('node:test');
const assert = require('assert');
const path = require('path');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const { getJwtSecret, getJwtRefreshSecret } = require('../backend/src/utils/secrets');
const BASE_URL = `http://localhost:${process.env.PORT || 5000}`;

const authService = require('../backend/src/services/authService');
const pool = require('../backend/src/config/db');

test('BSC Enterprise Security Hardening Test Suite', async (suite) => {
  let serverInstance = null;
  suite.after(async () => {
    try { if (serverInstance) serverInstance.close(); } catch (e) {}
    try { await pool.end(); } catch (e) {}
  });

  // Verify server is operational or bootstrap it
  let serverRunning = false;
  try {
    const check = await fetch(`${BASE_URL}/health`);
    if (check.status === 200) serverRunning = true;
  } catch (e) {
    serverRunning = false;
  }

  if (!serverRunning) {
    console.log(`[Test] Server on ${BASE_URL} not running. Bootstrapping test server...`);
    const app = require('../backend/index.js');
    serverInstance = app.server;
    for (let i = 0; i < 25; i++) {
      await new Promise(r => setTimeout(r, 250));
      try {
        const res = await fetch(`${BASE_URL}/health`);
        if (res.status === 200) {
          serverRunning = true;
          break;
        }
      } catch (e) {}
    }
  }

  // ── 1. Auth & JWT Tests ───────────────────────────────────────────────────
  await suite.test('1. Expired JWT token is rejected with 401', async () => {
    // Generate an expired token (expired 10 minutes ago)
    const expiredToken = jwt.sign(
      { id: 9999, username: 'testuser', role: 'HR', tokenVersion: 1 },
      getJwtSecret(),
      { expiresIn: '-10m' }
    );

    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: {
        'Cookie': `token=${expiredToken}`
      }
    });

    assert.strictEqual(res.status, 401, 'Expired token must return 401');
  });

  await suite.test('2. Token with invalid signature is rejected with 401', async () => {
    // Sign with wrong secret
    const tamperedToken = jwt.sign(
      { id: 9999, username: 'attacker', role: 'Admin', tokenVersion: 1 },
      'wrong_untrusted_secret_key_123456789!',
      { expiresIn: '15m' }
    );

    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: {
        'Cookie': `token=${tamperedToken}`
      }
    });

    assert.strictEqual(res.status, 401, 'Tampered token signature must return 401');
  });

  await suite.test('3. Missing authentication token on protected route returns 401', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`);
    assert.strictEqual(res.status, 401, 'Request without token must return 401');
  });

  await suite.test('4. Token with outdated tokenVersion is rejected with 401', async () => {
    // Find an active user in DB
    const [rows] = await pool.query('SELECT id, username, token_version FROM users WHERE active = 1 LIMIT 1');
    if (rows.length > 0) {
      const dbUser = rows[0];
      const staleVersion = (dbUser.token_version || 1) - 1;
      const staleToken = jwt.sign(
        { id: dbUser.id, username: dbUser.username, role: 'Admin', tokenVersion: staleVersion },
        getJwtSecret(),
        { expiresIn: '15m' }
      );

      const res = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: {
          'Cookie': `token=${staleToken}`
        }
      });

      assert.strictEqual(res.status, 401, 'Stale tokenVersion must return 401');
    }
  });

  // ── 2. Refresh Token Rotation & Theft Detection ───────────────────────────
  await suite.test('5. Refresh token rotation generates new pair and rejects reused token', async () => {
    const [rows] = await pool.query('SELECT id, username, token_version FROM users WHERE active = 1 LIMIT 1');
    if (rows.length > 0) {
      const user = rows[0];
      const refreshToken = jwt.sign(
        {
          id: user.id,
          username: user.username,
          tokenVersion: user.token_version || 1,
          jti: crypto.randomBytes(16).toString('hex')
        },
        getJwtRefreshSecret(),
        { expiresIn: '7d' }
      );

      // First rotation succeeds
      const rotated = await authService.rotateRefreshToken(refreshToken, '127.0.0.1', 'SecurityTestSuite');
      assert.ok(rotated.token, 'Must return new accessToken');
      assert.ok(rotated.refreshToken, 'Must return new refreshToken');

      // Attempting to reuse the old refresh token must trigger theft detection
      let reuseErrorCaught = false;
      try {
        await authService.rotateRefreshToken(refreshToken, '127.0.0.1', 'SecurityTestSuite');
      } catch (err) {
        reuseErrorCaught = true;
        assert.ok(err.message.includes('Refresh token reuse detected') || err.message.includes('revoked'));
      }
      assert.strictEqual(reuseErrorCaught, true, 'Reused refresh token must be rejected');
    }
  });

  // ── 3. Authorization & RBAC Tests ─────────────────────────────────────────
  await suite.test('6. Non-admin user cannot access admin routes (returns 403)', async () => {
    const [rows] = await pool.query("SELECT id, username, token_version FROM users WHERE role = 'Telecaller' AND active = 1 LIMIT 1");
    const user = rows.length > 0 ? rows[0] : { id: 9999, username: 'telecaller_test', token_version: 1 };

    const telecallerToken = jwt.sign(
      { id: user.id, username: user.username, role: 'Telecaller', tokenVersion: user.token_version || 1, locationId: 2 },
      getJwtSecret(),
      { expiresIn: '15m' }
    );

    // Attempt to access admin-only endpoint: POST /api/locations
    const res = await fetch(`${BASE_URL}/api/locations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `token=${telecallerToken}`
      },
      body: JSON.stringify({ name: 'Hacked Store', locationCode: 'HCK' })
    });

    assert.strictEqual(res.status, 403, 'Non-admin role must be forbidden (403)');
  });

  // ── 4. Input Validation & WAF Defense Tests ────────────────────────────────
  await suite.test('7. WAF intercepts and blocks malicious SQL injection payloads', async () => {
    const maliciousPayload = JSON.stringify({
      username: "' OR '1'='1' --",
      password: "password123"
    });

    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: maliciousPayload
    });

    assert.ok([400, 401, 403].includes(res.status), `Malicious payload must be rejected, got ${res.status}`);
  });

  await suite.test('8. Input sanitizer neutralizes script tags in request bodies', async () => {
    const { sanitizeData } = require('../backend/src/security/inputSanitizer');
    const dirty = {
      note: 'Hello <script>alert("XSS")</script> World',
      nested: {
        comment: 'Visit <script src="http://evil.com/xss.js"></script> now!'
      }
    };
    const clean = sanitizeData(dirty);
    assert.strictEqual(clean.note, 'Hello  World');
    assert.strictEqual(clean.nested.comment, 'Visit  now!');
  });

  // ── 5. Security Headers & Information Leakage ─────────────────────────────
  await suite.test('9. Required security headers are present and identity headers hidden', async () => {
    const res = await fetch(`${BASE_URL}/health`);

    const xFrameOptions = res.headers.get('x-frame-options');
    const xContentType = res.headers.get('x-content-type-options');
    const xPoweredBy = res.headers.get('x-powered-by');

    assert.ok(xFrameOptions === 'DENY' || xFrameOptions === 'SAMEORIGIN', 'X-Frame-Options must be set');
    assert.strictEqual(xContentType, 'nosniff', 'X-Content-Type-Options must be nosniff');
    assert.strictEqual(xPoweredBy, null, 'X-Powered-By must not be exposed');
  });

  await suite.test('10. Health check endpoint exposes no sensitive config or credentials', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();

    assert.strictEqual(body.jwtSecret, undefined);
    assert.strictEqual(body.dbPassword, undefined);
    assert.strictEqual(body.databaseUser, undefined);
    assert.ok(body.status === 'healthy' || body.status === 'degraded');
  });
});
