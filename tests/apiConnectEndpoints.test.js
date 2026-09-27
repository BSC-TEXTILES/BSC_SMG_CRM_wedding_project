/**
 * Integration Test: Module 6 Connect Endpoints & Daily Re-Auth Enforcement
 */

const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../backend/.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const test = require('node:test');
const assert = require('assert');
const apiKeyService = require('../backend/src/services/apiKeyService');
const pool = require('../backend/src/config/db');

test('Module 6 Connect Endpoints & Daily Re-Auth Enforcement', async () => {
  console.log('Testing Connect API & Middleware Flow...');

  // 1. Create a key with FULL_ACCESS and all scopes
  const reqResult = await apiKeyService.createApiKeyRequest({
    userId: 1,
    name: 'Connect E2E Test Key',
    prefix: 'LIVE_',
    accessLevel: 'FULL_ACCESS',
    scopes: ['data:read', 'data:write', 'website:read', 'analytics:read', 'export:data', 'cross:connect'],
    ipAddress: '127.0.0.1'
  });

  const { publicId, rawKey } = reqResult;

  // 2. Approve key
  await apiKeyService.approveKey(publicId, 1, {}, { ipAddress: '127.0.0.1' });

  // 3. Test authenticateKey with data:read scope
  const authRead = await apiKeyService.authenticateKey(rawKey, 'data:read', '127.0.0.1');
  assert.strictEqual(authRead.authenticated, true);
  assert.strictEqual(authRead.key.publicId, publicId);

  // 4. Test authenticateKey with data:write scope
  const authWrite = await apiKeyService.authenticateKey(rawKey, 'data:write', '127.0.0.1');
  assert.strictEqual(authWrite.authenticated, true);

  // 5. Test scope denial with ungranted scope
  const authAdmin = await apiKeyService.authenticateKey(rawKey, 'users:read', '127.0.0.1');
  assert.strictEqual(authAdmin.authenticated, false);
  assert.strictEqual(authAdmin.error, 'INSUFFICIENT_SCOPE');

  // 6. Test Daily Re-Auth Expired behavior
  await pool.query(
    `UPDATE api_keys SET daily_approval_expires = NOW() - INTERVAL 5 MINUTE WHERE public_id = ?`,
    [publicId]
  );

  const authExpired = await apiKeyService.authenticateKey(rawKey, 'data:read', '127.0.0.1');
  assert.strictEqual(authExpired.authenticated, false);
  assert.strictEqual(authExpired.code, 'DAILY_REAUTH_REQUIRED');
  assert.strictEqual(authExpired.error, 'DAILY_REAUTH_REQUIRED');
  assert.ok(authExpired.expired_at, 'expired_at timestamp must be returned');

  // 7. Test Admin Daily Renewal extends by 24h
  const renewed = await apiKeyService.reauthorizeDaily(publicId, 1, { ipAddress: '127.0.0.1' });
  assert.strictEqual(renewed.status, 'ACTIVE');

  // 8. Re-test auth succeeds after renewal
  const authRenewed = await apiKeyService.authenticateKey(rawKey, 'data:read', '127.0.0.1');
  assert.strictEqual(authRenewed.authenticated, true);

  // 9. Clean up
  await pool.query('DELETE FROM api_keys WHERE public_id = ?', [publicId]);
  await pool.query('DELETE FROM api_key_audit_log WHERE key_public_id = ?', [publicId]);
  await pool.query('DELETE FROM api_key_reauth_requests WHERE key_public_id = ?', [publicId]);

  console.log('[PASS] Connect API & Daily Re-Auth integration tests completed successfully!');
  await pool.end();
});
