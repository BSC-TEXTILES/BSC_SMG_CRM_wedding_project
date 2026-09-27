/**
 * API Key Background Jobs & Schedulers (Module 9)
 * - dailyReauthCheck (every 15 min): Flags keys expiring soon and sets expired active keys to NEEDS_REAUTH
 * - keyExpiryCleanup (every 1 hour): Expires keys past hard expires_at
 * - usageDigest (every 24 hours): Aggregates system security metrics
 * - rotateEncryptionKeys: Envelope DEK re-encryption under a new KEK version
 */

const pool = require('../config/db');
const { getMasterKEK, encryptDEK, decryptDEK } = require('../security/apiKeyCrypto');

let interval15Min = null;
let interval1Hour = null;
let interval24Hour = null;

/**
 * Check daily authorizations.
 * Runs every 15 minutes.
 */
async function dailyReauthCheck() {
  try {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    // 1. Expire keys that have passed daily_approval_expires
    const [expiredRows] = await pool.query(
      `SELECT id, public_id, user_id, name, daily_approval_expires 
       FROM api_keys 
       WHERE status = 'ACTIVE' AND daily_approval_expires <= ?`,
      [now]
    );

    for (const key of expiredRows) {
      await pool.query(
        `UPDATE api_keys SET status = 'NEEDS_REAUTH', updated_at = NOW() WHERE id = ?`,
        [key.id]
      );

      // Create a pending reauth request if one doesn't exist
      await pool.query(
        `INSERT INTO api_key_reauth_requests (key_public_id, requested_at, status)
         SELECT ?, NOW(), 'PENDING'
         WHERE NOT EXISTS (
           SELECT 1 FROM api_key_reauth_requests WHERE key_public_id = ? AND status = 'PENDING'
         )`,
        [key.public_id, key.public_id]
      );

      // Audit log entry
      await pool.query(
        `INSERT INTO api_key_audit_log (key_public_id, event_type, user_id, result, metadata)
         VALUES (?, 'SUSPENDED', ?, 'DAILY_AUTH_EXPIRED', ?)`,
        [key.public_id, key.user_id, JSON.stringify({ reason: 'Daily 24h approval expired. Status changed to NEEDS_REAUTH.' })]
      );

      console.warn(`[ApiKeyJob] Key ${key.public_id} (${key.name}) daily auth expired. Status updated to NEEDS_REAUTH.`);
    }

    // 2. Keys expiring within 1 hour (warning log / notify)
    const [warningRows] = await pool.query(
      `SELECT public_id, name, daily_approval_expires 
       FROM api_keys 
       WHERE status = 'ACTIVE' AND daily_approval_expires > ? AND daily_approval_expires <= ?`,
      [now, oneHourFromNow]
    );

    if (warningRows.length > 0) {
      console.info(`[ApiKeyJob] ${warningRows.length} active API key(s) require daily re-authorization within 1 hour.`);
    }
  } catch (err) {
    console.error('[ApiKeyJob] dailyReauthCheck error:', err.message);
  }
}

/**
 * Hard Expiry Cleanup Job.
 * Runs every 1 hour.
 */
async function keyExpiryCleanup() {
  try {
    const now = new Date();
    const [expiredRows] = await pool.query(
      `SELECT id, public_id, user_id, name 
       FROM api_keys 
       WHERE status NOT IN ('EXPIRED', 'REVOKED') AND expires_at IS NOT NULL AND expires_at <= ?`,
      [now]
    );

    for (const key of expiredRows) {
      await pool.query(
        `UPDATE api_keys SET status = 'EXPIRED', updated_at = NOW() WHERE id = ?`,
        [key.id]
      );

      await pool.query(
        `INSERT INTO api_key_audit_log (key_public_id, event_type, user_id, result, metadata)
         VALUES (?, 'REVOKED', ?, 'HARD_EXPIRY_REACHED', ?)`,
        [key.public_id, key.user_id, JSON.stringify({ reason: 'Hard expiration date reached. Status marked EXPIRED.' })]
      );

      console.info(`[ApiKeyJob] Key ${key.public_id} reached hard expiry.`);
    }
  } catch (err) {
    console.error('[ApiKeyJob] keyExpiryCleanup error:', err.message);
  }
}

/**
 * Daily Usage Digest.
 * Runs every 24 hours.
 */
async function usageDigest() {
  try {
    const [counts] = await pool.query(`
      SELECT 
        status, 
        COUNT(*) as count 
      FROM api_keys 
      GROUP BY status
    `);

    const [recentAudits] = await pool.query(`
      SELECT event_type, COUNT(*) as count 
      FROM api_key_audit_log 
      WHERE created_at >= NOW() - INTERVAL 24 HOUR 
      GROUP BY event_type
    `);

    console.info('[ApiKeyJob] ── 24h API Key Security Digest ──');
    console.info('[ApiKeyJob] Status breakdown:', JSON.stringify(counts));
    console.info('[ApiKeyJob] Audit events (last 24h):', JSON.stringify(recentAudits));
    console.info('[ApiKeyJob] ──────────────────────────────────');
  } catch (err) {
    console.error('[ApiKeyJob] usageDigest error:', err.message);
  }
}

/**
 * Key Rotation Job (Module 2).
 * Re-encrypts all Data Encryption Keys (DEKs) using a new Master KEK and increments encryption_key_version.
 * Does NOT invalidate existing API keys or modify hashed key hashes.
 */
async function rotateEncryptionKeys(newKekBuffer, oldKekBuffer = getMasterKEK(), newVersion = 2) {
  try {
    const [keys] = await pool.query('SELECT id, public_id, encrypted_dek, encryption_key_version FROM api_keys');
    console.info(`[ApiKeyJob] Starting envelope key rotation for ${keys.length} keys...`);

    let rotatedCount = 0;
    for (const row of keys) {
      let rawDek = null;
      try {
        rawDek = decryptDEK(row.encrypted_dek, oldKekBuffer);
      } catch (e) {
        try {
          rawDek = decryptDEK(row.encrypted_dek, getMasterKEK());
        } catch (e2) {
          console.warn(`[ApiKeyJob] Skipping key ${row.public_id} during rotation: decrypt failed`);
          continue;
        }
      }

      // Re-encrypt DEK with new KEK
      const newEncryptedDEK = encryptDEK(rawDek, newKekBuffer);
      // Update DB
      await pool.query(
        `UPDATE api_keys SET encrypted_dek = ?, encryption_key_version = ?, updated_at = NOW() WHERE id = ?`,
        [newEncryptedDEK, newVersion, row.id]
      );
      rotatedCount++;
    }

    console.info(`[ApiKeyJob] Key rotation complete. Successfully rotated ${rotatedCount} records to version ${newVersion}.`);
    return { success: true, rotatedCount, newVersion };
  } catch (err) {
    console.error('[ApiKeyJob] rotateEncryptionKeys error:', err);
    throw err;
  }
}

/**
 * Start background timers.
 */
function initApiKeyJobs() {
  // Run initial checks on boot
  dailyReauthCheck();
  keyExpiryCleanup();

  // Reauth check: every 15 minutes (900,000 ms)
  interval15Min = setInterval(dailyReauthCheck, 15 * 60 * 1000);
  if (interval15Min.unref) interval15Min.unref();

  // Hard expiry: every 1 hour (3,600,000 ms)
  interval1Hour = setInterval(keyExpiryCleanup, 60 * 60 * 1000);
  if (interval1Hour.unref) interval1Hour.unref();

  // Digest: every 24 hours (86,400,000 ms)
  interval24Hour = setInterval(usageDigest, 24 * 60 * 60 * 1000);
  if (interval24Hour.unref) interval24Hour.unref();

  console.info('[ApiKeyJobs] API Key background scheduler initialized (15m reauth, 1h expiry, 24h digest).');
}

function stopApiKeyJobs() {
  if (interval15Min) clearInterval(interval15Min);
  if (interval1Hour) clearInterval(interval1Hour);
  if (interval24Hour) clearInterval(interval24Hour);
}

module.exports = {
  initApiKeyJobs,
  stopApiKeyJobs,
  dailyReauthCheck,
  keyExpiryCleanup,
  usageDigest,
  rotateEncryptionKeys
};
