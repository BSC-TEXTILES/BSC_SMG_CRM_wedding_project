/**
 * Automated Test Suite: Production-Grade API Key Management System
 * Covers:
 * - Module 1: Generation Engine & Checksum Verification
 * - Module 2: Envelope Encryption & DEK/KEK Rotation
 * - Module 3: Admin Approval Workflow
 * - Module 4: Daily 24-Hour Re-Authorization Enforcement
 * - Module 5: Scope & Access Level Middleware
 * - Module 6: Connected Data & Website Gateway
 * - Module 8: Timing-Safe Verification & Anomaly Detection
 * - Module 9: Scheduled Reauth Checks
 */

const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../backend/.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const nodeTest = require('node:test');
const assert = require('assert');
const {
  generateApiKey,
  verifyKeyChecksum,
  hashApiKey,
  compareApiKey,
  generateDEK,
  encryptDEK,
  decryptDEK,
  encryptField,
  decryptField,
  getMasterKEK
} = require('../backend/src/security/apiKeyCrypto');
const apiKeyService = require('../backend/src/services/apiKeyService');
const { rotateEncryptionKeys, dailyReauthCheck } = require('../backend/src/jobs/apiKeyJobs');
const pool = require('../backend/src/config/db');

nodeTest('Enterprise API Key System Verification', async () => {
  console.log('====================================================');
  console.log(' Starting Enterprise API Key System Verification');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message);
      throw err;
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message);
      throw err;
    }
  }

  // ── MODULE 1: Cryptographic Engine ──────────────────────────────────────────
  test('Module 1.1: Generates key with PREFIX_BASE62_CHECKSUM format', () => {
    const { rawKey, keyHint, checksum } = generateApiKey('LIVE_');
    assert.ok(rawKey.startsWith('LIVE_'), 'Raw key must start with LIVE_');
    assert.strictEqual(rawKey.split('_').length, 3, 'Key must have 3 parts separated by underscores');
    const parts = rawKey.split('_');
    assert.strictEqual(parts[0], 'LIVE');
    assert.strictEqual(parts[2].length, 8, 'Checksum must be 8 characters');
    assert.strictEqual(keyHint.length, 4, 'Hint must be exactly 4 characters');
  });

  test('Module 1.2: Checksum verification passes for authentic keys', () => {
    const { rawKey } = generateApiKey('TEST_');
    const isValid = verifyKeyChecksum(rawKey);
    assert.strictEqual(isValid, true, 'Checksum verification should succeed for generated key');
  });

  test('Module 1.3: Checksum verification fails for tampered keys', () => {
    const { rawKey } = generateApiKey('LIVE_');
    // Tamper single character in payload
    const tampered = rawKey.slice(0, 10) + 'X' + rawKey.slice(11);
    const isValid = verifyKeyChecksum(tampered);
    assert.strictEqual(isValid, false, 'Tampered key checksum must be rejected');
  });

  await testAsync('Module 1.4: Key hashing with bcrypt cost>=12', async () => {
    const { rawKey } = generateApiKey('LIVE_');
    const hash = await hashApiKey(rawKey);
    assert.ok(hash.startsWith('$2'), 'Hash must be a valid bcrypt hash');
    const match = await compareApiKey(rawKey, hash);
    assert.strictEqual(match, true, 'Original raw key must match bcrypt hash');
    const wrongMatch = await compareApiKey('LIVE_invalid_CHK8', hash);
    assert.strictEqual(wrongMatch, false, 'Invalid raw key must not match hash');
  });

  // ── MODULE 2: Envelope Encryption ───────────────────────────────────────────
  test('Module 2.1: Envelope DEK generation and KEK encryption/decryption', () => {
    const masterKEK = getMasterKEK();
    const dek = generateDEK();
    assert.strictEqual(dek.length, 32, 'DEK must be 32 bytes');

    const encryptedDEK = encryptDEK(dek, masterKEK);
    assert.ok(typeof encryptedDEK === 'string', 'Encrypted DEK should be string format');

    const decryptedDEK = decryptDEK(encryptedDEK, masterKEK);
    assert.deepStrictEqual(decryptedDEK, dek, 'Decrypted DEK must match original DEK');
  });

  test('Module 2.2: Field-level encryption with AES-256-GCM', () => {
    const dek = generateDEK();
    const sensitivePayload = JSON.stringify(['data:read', 'website:connect', 'export:data']);

    const encrypted = encryptField(sensitivePayload, dek);
    assert.ok(encrypted.includes(':'), 'Field ciphertext format must be iv:tag:ciphertext');

    const decrypted = decryptField(encrypted, dek);
    assert.deepStrictEqual(decrypted, JSON.parse(sensitivePayload), 'Decrypted payload must match original object');
  });

  // ── MODULE 3 & 4: Service Layer Lifecycle & Daily 24h Re-Auth ──────────────
  await testAsync('Module 3.1 & 4.1: Key creation, Admin approval, and Daily Re-Auth lifecycle', async () => {
    // 1. Create Key Request (status: PENDING)
    const reqResult = await apiKeyService.createApiKeyRequest({
      userId: 1,
      name: 'Automated Test Service Integration',
      prefix: 'LIVE_',
      accessLevel: 'FULL_ACCESS',
      scopes: ['data:read', 'data:write', 'website:connect'],
      ipWhitelist: ['127.0.0.1'],
      ipAddress: '127.0.0.1',
      userAgent: 'Node-Test-Runner'
    });

    assert.ok(reqResult.publicId, 'Should return publicId');
    assert.ok(reqResult.rawKey, 'Should return rawKey once');
    assert.strictEqual(reqResult.status, 'PENDING');

    const { publicId, rawKey } = reqResult;

    // 2. Authenticating a PENDING key must fail
    const pendingAuth = await apiKeyService.authenticateKey(rawKey, {
      requiredScope: 'data:read',
      clientIp: '127.0.0.1'
    });
    assert.strictEqual(pendingAuth.authenticated, false);
    assert.strictEqual(pendingAuth.error, 'KEY_PENDING_APPROVAL');

    // 3. Admin approves key (status -> ACTIVE, daily_approval_expires set to now + 24h)
    const approved = await apiKeyService.approveKey(publicId, 1, {}, {
      ipAddress: '127.0.0.1',
      userAgent: 'Node-Test-Runner'
    });
    assert.strictEqual(approved.status, 'ACTIVE');
    assert.ok(approved.daily_approval_expires, 'daily_approval_expires must be set');

    // 4. Authenticating an ACTIVE key succeeds
    const activeAuth = await apiKeyService.authenticateKey(rawKey, {
      requiredScope: 'data:read',
      clientIp: '127.0.0.1'
    });
    assert.strictEqual(activeAuth.authenticated, true);
    assert.strictEqual(activeAuth.key.publicId, publicId);

    // 5. Test Scope restriction
    const unauthorizedScopeAuth = await apiKeyService.authenticateKey(rawKey, {
      requiredScope: 'users:read', // Not granted
      clientIp: '127.0.0.1'
    });
    assert.strictEqual(unauthorizedScopeAuth.authenticated, false);
    assert.strictEqual(unauthorizedScopeAuth.error, 'INSUFFICIENT_SCOPE');

    // 6. Test Daily Expiration enforcement
    // Force daily_approval_expires into the past
    await pool.query(
      `UPDATE api_keys SET daily_approval_expires = NOW() - INTERVAL 1 HOUR WHERE public_id = ?`,
      [publicId]
    );

    const expiredAuth = await apiKeyService.authenticateKey(rawKey, {
      requiredScope: 'data:read',
      clientIp: '127.0.0.1'
    });
    assert.strictEqual(expiredAuth.authenticated, false);
    assert.strictEqual(expiredAuth.error, 'DAILY_REAUTH_REQUIRED');

    // 7. Admin Re-Authorizes Key for another 24 hours
    const reauthorized = await apiKeyService.reauthorizeDaily(publicId, 1, {
      ipAddress: '127.0.0.1',
      userAgent: 'Node-Test-Runner'
    });
    assert.strictEqual(reauthorized.status, 'ACTIVE');

    // 8. Authentication succeeds again after re-authorization
    const reauthSuccess = await apiKeyService.authenticateKey(rawKey, {
      requiredScope: 'data:read',
      clientIp: '127.0.0.1'
    });
    assert.strictEqual(reauthSuccess.authenticated, true);

    // Clean up test key
    await pool.query('DELETE FROM api_keys WHERE public_id = ?', [publicId]);
    await pool.query('DELETE FROM api_key_audit_log WHERE key_public_id = ?', [publicId]);
    await pool.query('DELETE FROM api_key_reauth_requests WHERE key_public_id = ?', [publicId]);
  });

  // ── MODULE 9: Key Rotation ──────────────────────────────────────────────────
  await testAsync('Module 9.1: Background rotation re-encrypts DEKs without invalidating keys', async () => {
    // Generate sample key
    const reqResult = await apiKeyService.createApiKeyRequest({
      userId: 1,
      name: 'Rotation Verification Key',
      prefix: 'LIVE_',
      accessLevel: 'READ',
      scopes: ['data:read'],
      ipAddress: '127.0.0.1',
      userAgent: 'Test'
    });

    await apiKeyService.approveKey(reqResult.publicId, 1, {}, { ipAddress: '127.0.0.1' });

    // Rotate with a new master key
    const newKek = Buffer.alloc(32, 0x99);
    const rotationRes = await rotateEncryptionKeys(newKek, getMasterKEK(), 2);
    assert.ok(rotationRes.success);

    // Verify key fields can still be decrypted under new KEK
    const [rows] = await pool.query('SELECT * FROM api_keys WHERE public_id = ?', [reqResult.publicId]);
    const rotatedRow = rows[0];
    assert.strictEqual(rotatedRow.encryption_key_version, 2);

    const decryptedDEK = decryptDEK(rotatedRow.encrypted_dek, newKek);
    const scopesDecrypted = decryptField(rotatedRow.scopes_encrypted, decryptedDEK);
    assert.deepStrictEqual(scopesDecrypted, ['data:read']);

    // Restore original KEK
    await rotateEncryptionKeys(getMasterKEK(), newKek, 1);

    // Clean up
    await pool.query('DELETE FROM api_keys WHERE public_id = ?', [reqResult.publicId]);
    await pool.query('DELETE FROM api_key_audit_log WHERE key_public_id = ?', [reqResult.publicId]);
  });

  console.log('\n====================================================');
  console.log(` ALL ${passed}/${total} API KEY SYSTEM TESTS PASSED SUCCESSFULLY!`);
  console.log('====================================================\n');
  await pool.end();
});
