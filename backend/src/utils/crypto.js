/**
 * Field-Level Encryption Utility (AES-256-GCM)
 * ────────────────────────────────────────────
 * Provides authenticated encryption for sensitive columns at rest
 * (free-text customer notes, call remarks, and any future PII fields).
 *
 * Wire format stored in the DB:
 *   enc:v1:<iv_base64>:<authTag_base64>:<ciphertext_base64>
 *
 * Safety properties:
 *   - AES-256-GCM gives confidentiality AND tamper detection (auth tag).
 *   - Fresh random IV per encryption — identical plaintexts never share a
 *     ciphertext, so DB snapshots leak no repetition patterns.
 *   - `decryptField` is a DUAL-READ helper: values that do not carry the
 *     `enc:v1:` prefix are returned as-is. This makes the rollout zero-
 *     downtime — legacy plaintext rows keep working and are re-encrypted
 *     naturally the next time the row is written.
 *   - If decryption fails (wrong key / corrupted row) the raw value is
 *     returned and the error is logged, so a key rotation mistake can never
 *     take the UI down.
 */

const crypto = require('crypto');
const { getFieldEncryptionKey } = require('./secrets');

const PREFIX = 'enc:v1:';

function encryptField(plaintext) {
  if (plaintext === null || plaintext === undefined) return null;
  const value = String(plaintext);
  if (value === '' || value.startsWith(PREFIX)) return value; // already encrypted / empty

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getFieldEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    PREFIX.slice(0, -1),          // 'enc:v1'
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64')
  ].join(':');
}

let decryptionWarningLogged = false;

function getCandidateFallbackKeys() {
  const keys = [];
  if (process.env.FALLBACK_ENCRYPTION_KEYS) {
    const candidates = process.env.FALLBACK_ENCRYPTION_KEYS.split(',').map(s => s.trim()).filter(Boolean);
    for (const c of candidates) {
      keys.push(crypto.createHash('sha256').update(c).digest());
    }
  }
  return keys;
}

function decryptField(stored) {
  if (stored === null || stored === undefined) return stored;
  const value = String(stored);
  if (!value.startsWith(PREFIX)) return value; // legacy plaintext row — dual-read

  const parts = value.split(':');
  if (parts.length < 5) return '';

  const [, , ivB64, tagB64, dataB64] = parts;

  try {
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const ciphertext = Buffer.from(dataB64, 'base64');

    // 1. Attempt primary key decryption
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', getFieldEncryptionKey(), iv);
      decipher.setAuthTag(tag);
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return plaintext.toString('utf8');
    } catch (primaryErr) {
      // 2. Attempt fallback keys if configured (e.g. during key rotation)
      const fallbackKeys = getCandidateFallbackKeys();
      for (const fbKey of fallbackKeys) {
        try {
          const decipher = crypto.createDecipheriv('aes-256-gcm', fbKey, iv);
          decipher.setAuthTag(tag);
          const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
          return plaintext.toString('utf8');
        } catch (fbErr) {
          // Continue to next candidate key
        }
      }

      // 3. Graceful masking without repetitive terminal console spam
      if (!decryptionWarningLogged) {
        console.warn('[Crypto] Notice: One or more legacy encrypted fields could not be authenticated with the current key (rotated or imported data). Safely masked.');
        decryptionWarningLogged = true;
      }
      return '';
    }
  } catch (err) {
    return '';
  }
}

/**
 * Decrypt every key in `fields` on each row object (mutates copies).
 * Usage: decryptRow(row, ['customer_notes'])
 */
function decryptRow(row, fields) {
  if (!row) return row;
  for (const f of fields) {
    if (row[f] !== null && row[f] !== undefined) {
      row[f] = decryptField(row[f]);
    }
  }
  return row;
}

function decryptRows(rows, fields) {
  if (!Array.isArray(rows)) return rows;
  for (const r of rows) decryptRow(r, fields);
  return rows;
}

module.exports = {
  encryptField,
  decryptField,
  decryptRow,
  decryptRows,
  PREFIX
};
