/**
 * Runtime Secret Management
 * ─────────────────────────
 * Central resolver for all cryptographic secrets used by the application.
 *
 * Resolution order for every secret:
 *   1. Environment variable (JWT_SECRET / ENCRYPTION_KEY / JWT_REFRESH_SECRET)
 *   2. Persisted runtime secret file  (server/config/.runtime-secrets.json)
 *   3. Auto-generate a cryptographically strong value and persist it
 *
 * The runtime secret file is written OUTSIDE git (covered by .gitignore) so
 * secrets survive restarts without ever being committed to the repository.
 * Production deployments should always set the env vars explicitly; the
 * auto-generated values guarantee the app is never left running on the old
 * hardcoded fallback keys.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SECRETS_FILE = path.join(__dirname, '..', 'config', '.runtime-secrets.json');

let cache = null;

function loadSecretsFile() {
  try {
    if (fs.existsSync(SECRETS_FILE)) {
      return JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('[Secrets] Could not parse runtime secrets file, regenerating:', e.message);
  }
  return {};
}

function persistSecretsFile(secrets) {
  try {
    const dir = path.dirname(SECRETS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SECRETS_FILE, JSON.stringify(secrets, null, 2), { mode: 0o600 });
  } catch (e) {
    // Read-only filesystem (some PaaS) — secrets regenerate per boot, still secure
    console.warn('[Secrets] Runtime secrets file not writable:', e.message);
  }
}

function resolveSecret(envVar, fileKey, byteLength) {
  if (process.env[envVar] && process.env[envVar].trim().length >= 16) {
    return process.env[envVar].trim();
  }

  const secrets = loadSecretsFile();
  if (secrets[fileKey]) {
    return secrets[fileKey];
  }

  const generated = crypto.randomBytes(byteLength).toString('hex');
  secrets[fileKey] = generated;
  persistSecretsFile(secrets);
  console.warn(`[Secrets] ${envVar} not set — generated a strong value and stored it in ${SECRETS_FILE}`);
  console.warn(`[Secrets] For production, set ${envVar} explicitly in .env (see .env.production.example).`);
  return generated;
}

/**
 * JWT signing/verification secret. 32 bytes of entropy.
 */
function getJwtSecret() {
  if (!cache) cache = {};
  if (!cache.jwt) cache.jwt = resolveSecret('JWT_SECRET', 'jwt_secret', 32);
  return cache.jwt;
}

/**
 * JWT refresh token secret. Independent from the access-token secret.
 */
function getJwtRefreshSecret() {
  if (!cache) cache = {};
  if (!cache.jwtRefresh) cache.jwtRefresh = resolveSecret('JWT_REFRESH_SECRET', 'jwt_refresh_secret', 32);
  return cache.jwtRefresh;
}

/**
 * AES-256 field-encryption key. Any passphrase/secret material is accepted;
 * it is stretched to exactly 32 bytes via SHA-256 so that a human-readable
 * passphrase in .env still yields a proper 256-bit key.
 */
function getFieldEncryptionKey() {
  if (!cache) cache = {};
  if (!cache.fieldKey) {
    const material = resolveSecret('ENCRYPTION_KEY', 'field_encryption_key', 32);
    cache.fieldKey = crypto.createHash('sha256').update(String(material)).digest();
  }
  return cache.fieldKey;
}

module.exports = {
  getJwtSecret,
  getJwtRefreshSecret,
  getFieldEncryptionKey
};
