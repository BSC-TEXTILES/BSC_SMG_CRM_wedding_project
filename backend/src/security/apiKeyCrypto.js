/**
 * Enterprise API Key Cryptographic Suite
 * - CSPRNG Key Generation with Base62 encoding and HMAC Checksum
 * - Envelope Encryption: AES-256-GCM for Data Encryption Keys (DEK) and sensitive fields
 * - Constant-time equality checks against timing attacks
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Base62 Alphabet: URL-safe, alphanumeric, no confusing symbols
const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function toBase62(buffer) {
  let value = BigInt('0x' + buffer.toString('hex'));
  let result = '';
  const base = BigInt(62);
  while (value > 0n) {
    const remainder = Number(value % base);
    result = BASE62_CHARS[remainder] + result;
    value = value / base;
  }
  return result.padStart(43, '0'); // 32 bytes in base62 is ~43 chars
}

/**
 * Get Master Key Encryption Key (KEK) derived to 32 bytes
 */
function getMasterKEK() {
  const rawKey = process.env.API_KEY_KEK || process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'bsc_master_key_encryption_key_32_bytes_min!';
  return crypto.createHash('sha256').update(rawKey).digest();
}

/**
 * Generate 32 cryptographically secure random bytes as a Data Encryption Key (DEK)
 */
function generateDEK() {
  return crypto.randomBytes(32);
}

/**
 * Encrypt a DEK using the master Key Encryption Key (KEK) (Envelope Encryption)
 */
function encryptDEK(dek, kek = getMasterKEK()) {
  const iv = crypto.randomBytes(12); // Standard 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', kek, iv);
  const encrypted = Buffer.concat([cipher.update(dek), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt an encrypted DEK using KEK
 */
function decryptDEK(encryptedDEKString, kek = getMasterKEK()) {
  const [ivHex, tagHex, cipherHex] = encryptedDEKString.split(':');
  if (!ivHex || !tagHex || !cipherHex) {
    throw new Error('Malformed encrypted DEK format');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');
  const ciphertext = Buffer.from(cipherHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', kek, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Encrypt plaintext field using the record's DEK
 */
function encryptField(plaintext, dek) {
  if (plaintext === null || plaintext === undefined) return null;
  const text = typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
  const ciphertext = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/**
 * Decrypt ciphertext field using the record's DEK
 */
function decryptField(payloadString, dek) {
  if (!payloadString) return null;
  const parts = payloadString.split(':');
  if (parts.length !== 3) return payloadString; // fallback if already plaintext
  const [ivHex, tagHex, cipherHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');
  const ciphertext = Buffer.from(cipherHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', dek, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  try {
    return JSON.parse(decrypted);
  } catch {
    return decrypted;
  }
}

/**
 * Compute HMAC-SHA256 checksum (8 characters) for key verification
 */
function computeChecksum(prefix, payload) {
  const masterSecret = getMasterKEK();
  return crypto.createHmac('sha256', masterSecret)
    .update(`${prefix}_${payload}`)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();
}

/**
 * Generate high-security API key
 * Format: PREFIX_BASE62(32bytes)_CHECKSUM
 * Example: LIVE_4xK9mZqRyTw9...Yw2_CHK89123
 */
function generateApiKey(prefix = 'LIVE') {
  const cleanPrefix = (prefix || 'LIVE').toUpperCase().replace(/[^A-Z]/g, '');
  const rawBytes = crypto.randomBytes(32);
  const payload = toBase62(rawBytes);
  const checksum = computeChecksum(cleanPrefix, payload);
  const fullKey = `${cleanPrefix}_${payload}_${checksum}`;
  const keyHint = checksum.slice(-4);

  // Fast deterministic lookup hash (HMAC) to quickly locate the key record in DB
  const lookupHash = crypto.createHmac('sha256', getMasterKEK())
    .update(fullKey)
    .digest('hex');

  // Slow cryptographic hash (bcrypt saltRounds=12) for stored verification
  const bcryptHash = bcrypt.hashSync(fullKey, 12);

  return {
    rawKey: fullKey,
    prefix: cleanPrefix,
    payload,
    checksum,
    keyHint,
    lookupHash,
    keyHash: bcryptHash
  };
}

/**
 * Verify key structure and HMAC checksum in constant time
 */
function verifyKeyFormat(fullKey) {
  if (typeof fullKey !== 'string') return false;
  const parts = fullKey.split('_');
  if (parts.length !== 3) return false;
  const [prefix, payload, checksum] = parts;
  if (!prefix || !payload || !checksum || checksum.length !== 8) return false;

  const expectedChecksum = computeChecksum(prefix, payload);
  const a = Buffer.from(checksum);
  const b = Buffer.from(expectedChecksum);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Compute lookup hash for query indexing
 */
function computeLookupHash(fullKey) {
  return crypto.createHmac('sha256', getMasterKEK())
    .update(fullKey)
    .digest('hex');
}

/**
 * Verify full key against stored bcrypt hash using constant-time check
 */
async function verifyKeyHash(fullKey, storedBcryptHash) {
  return bcrypt.compare(fullKey, storedBcryptHash);
}

module.exports = {
  generateDEK,
  encryptDEK,
  decryptDEK,
  encryptField,
  decryptField,
  computeChecksum,
  generateApiKey,
  verifyKeyFormat,
  verifyKeyChecksum: verifyKeyFormat,
  computeLookupHash,
  verifyKeyHash,
  compareApiKey: verifyKeyHash,
  hashApiKey: async (key) => bcrypt.hash(key, 12),
  getMasterKEK
};
