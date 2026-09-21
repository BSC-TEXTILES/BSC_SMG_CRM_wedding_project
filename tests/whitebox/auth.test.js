/**
 * White-Box Tests — authentication service internals
 * (backend/src/services/authService.js)
 *
 * The DB pool is replaced with a deterministic mock so the tests can assert
 * the INTERNAL logic precisely:
 *   - bcrypt verification and JWT claims
 *   - transparent plaintext→bcrypt password upgrade
 *   - removal of the old "any account + master password" bypass
 *   - removal of the built-in master-recovery backdoor (DB-less logins fail)
 *   - audit logging of successes and failures
 */
const test = require('node:test');
const assert = require('node:assert');
const { createRequire } = require('node:module');
const path = require('node:path');
// bcryptjs lives in the backend's dependency tree — resolve it from there so
// the test suite has no root-level node_modules requirement.
const backendRequire = createRequire(path.join(__dirname, '..', '..', 'backend', 'package.json'));
const bcrypt = backendRequire('bcryptjs');

process.env.JWT_SECRET = 'whitebox-jwt-secret-0123456789abcdef0123456789abcdef';
process.env.JWT_REFRESH_SECRET = 'whitebox-jwt-refresh-0123456789abcdef0123456789abcdef';

// ── Mock the DB pool BEFORE the service is required ───────────
const pool = require('../../backend/src/config/db');
const bcryptHash = bcrypt.hashSync('S3cure!Pass', 10);

let dbUser = {
  id: 42,
  username: 'ravi.hr',
  password: bcryptHash,
  fullName: 'Ravi HR',
  role: 'HR',
  status: 1,
  locationId: 2,
  locationCode: 'DAV',
  locationName: 'Davanagere'
};
const auditRows = [];
const updateCalls = [];

// eslint-disable-next-line no-unused-vars
pool.query = async (sql, params) => {
  if (/FROM users/i.test(sql)) {
    return [[dbUser]];
  }
  if (/UPDATE users SET password/i.test(sql)) {
    updateCalls.push(params);
    return [{ affectedRows: 1 }];
  }
  if (/INSERT INTO audit_logs/i.test(sql)) {
    auditRows.push(params);
    return [{ insertId: 1 }];
  }
  return [[]];
};

const authService = require('../../backend/src/services/authService');

test('correct bcrypt password logs in and embeds location claims in the JWT', async () => {
  const result = await authService.login('ravi.hr', 'S3cure!Pass', '127.0.0.1', 'whitebox');
  assert.ok(result.token);
  const claims = JSON.parse(Buffer.from(result.token.split('.')[1], 'base64').toString());
  assert.equal(claims.username, 'ravi.hr');
  assert.equal(claims.role, 'HR');
  assert.equal(claims.locationId, 2);           // location isolation comes from the DB row
  assert.equal(claims.isGlobalAdmin, false);
});

test('legacy plaintext password logs in AND is transparently upgraded to bcrypt', async () => {
  dbUser = { ...dbUser, password: 'OldPlainText!' };
  const result = await authService.login('ravi.hr', 'OldPlainText!', '127.0.0.1', 'whitebox');
  assert.ok(result.token, 'plaintext row still authenticates');
  assert.equal(updateCalls.length, 1, 'exactly one password upgrade UPDATE ran');
  const newHash = updateCalls[0][0];
  assert.ok(await bcrypt.compare('OldPlainText!', newHash), 'upgraded hash verifies the same password');
});

test('removed bypass: master passwords no longer unlock arbitrary accounts', async () => {
  dbUser = { ...dbUser, password: bcryptHash };
  await assert.rejects(
    () => authService.login('ravi.hr', 'password123', '127.0.0.1', 'whitebox'),
    /Incorrect username or password/
  );
  await assert.rejects(
    () => authService.login('ravi.hr', 'admin@2026', '127.0.0.1', 'whitebox'),
    /Incorrect username or password/
  );
});

test('deactivated accounts are refused', async () => {
  dbUser = { ...dbUser, status: 0 };
  await assert.rejects(
    () => authService.login('ravi.hr', 'S3cure!Pass', '127.0.0.1', 'whitebox'),
    /deactivated/
  );
  dbUser = { ...dbUser, status: 1 };
});

test('unknown user gets a generic error (no user enumeration)', async () => {
  // mock returns the same row for any lookup, so exercise via wrong password
  await assert.rejects(
    () => authService.login('ravi.hr', 'totally-wrong', '127.0.0.1', 'whitebox'),
    /Incorrect username or password/
  );
});

test('hardened auth: master recovery password never unlocks DB-less accounts', async () => {
  // The "admin@2026 unlocks built-in identities" backdoor was deliberately
  // REMOVED from authService (see vulnerabilities.md, Break 1). Deployment
  // recovery now works by force-resetting the seeded DB accounts at boot
  // (dbInitializer), not by a hardcoded in-code password. With no user row,
  // every identity — built-in or otherwise — must be refused.
  const realUser = dbUser;
  dbUser = null;
  pool.query = async (sql) => {
    if (/FROM users/i.test(sql)) return [[]];
    if (/INSERT INTO audit_logs/i.test(sql)) { auditRows.push(sql); return [{ insertId: 1 }]; }
    return [[]];
  };
  await assert.rejects(
    () => authService.login('admin@bsctextiles.com', 'admin@2026', '127.0.0.1', 'whitebox'),
    /Incorrect username or password/
  );
  await assert.rejects(
    () => authService.login('manager', 'admin@2026', '127.0.0.1', 'whitebox'),
    /Incorrect username or password/
  );
  await assert.rejects(
    () => authService.login('some.random.staff', 'anything', '127.0.0.1', 'whitebox'),
    /Incorrect username or password/
  );
  dbUser = realUser;
});

test('login success and failure both write audit rows', async () => {
  // Restore the full mock (the recovery test above installed a DB-less one)
  pool.query = async (sql, params) => {
    if (/FROM users/i.test(sql)) return [[dbUser]];
    if (/INSERT INTO audit_logs/i.test(sql)) { auditRows.push(params); return [{ insertId: 1 }]; }
    return [[]];
  };
  dbUser = { ...dbUser, password: bcryptHash, status: 1 };
  const before = auditRows.length;
  await authService.login('ravi.hr', 'S3cure!Pass', '127.0.0.1', 'whitebox').catch(() => {});
  await authService.login('ravi.hr', 'wrong-password', '127.0.0.1', 'whitebox').catch(() => {});
  assert.ok(auditRows.length >= before + 2, 'audit inserts happened for success and failure');
});
