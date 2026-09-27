/**
 * API Key Management Controller
 * Handles user key requests, Admin approval workflows, daily re-authorization, and audit viewing.
 * Strictly enforces zero raw key leakage (raw key is emitted only ONCE upon creation).
 */

const apiKeyService = require('../services/apiKeyService');
const pool = require('../config/db');

// ── User Endpoints ─────────────────────────────────────────────────────────────

/**
 * Request / Create a new API key.
 * Generates key in PENDING status awaiting Admin approval.
 * Returns rawKey ONCE to the user.
 */
async function requestKey(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { name, prefix = 'LIVE_', accessLevel = 'READ', scopes = [], ipWhitelist = [], expiresAt = null } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Key name is required' });
    }

    const validLevels = ['READ', 'READ_WRITE', 'FULL_ACCESS', 'ADMIN_CONNECT'];
    if (!validLevels.includes(accessLevel)) {
      return res.status(400).json({ success: false, error: `Invalid access level. Must be one of: ${validLevels.join(', ')}` });
    }

    // Normal users cannot directly request ADMIN_CONNECT unless they are Admin
    if (accessLevel === 'ADMIN_CONNECT' && !['Admin', 'Super Admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Only administrators can request ADMIN_CONNECT level' });
    }

    // Enforce max expiry of 1 year
    let expiryDate = null;
    if (expiresAt) {
      const parsed = new Date(expiresAt);
      const maxExpiry = new Date();
      maxExpiry.setFullYear(maxExpiry.getFullYear() + 1);
      if (isNaN(parsed.getTime()) || parsed <= new Date()) {
        return res.status(400).json({ success: false, error: 'Invalid expiration date. Must be in the future.' });
      }
      expiryDate = parsed > maxExpiry ? maxExpiry : parsed;
    }

    const result = await apiKeyService.createApiKeyRequest({
      userId,
      name: name.trim(),
      prefix: prefix.startsWith('TEST') ? 'TEST_' : 'LIVE_',
      accessLevel,
      scopes: Array.isArray(scopes) ? scopes : [],
      ipWhitelist: Array.isArray(ipWhitelist) ? ipWhitelist : [],
      expiresAt: expiryDate,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    return res.status(201).json({
      success: true,
      message: 'API key requested. Save this secret key now. It will NEVER be shown again.',
      data: {
        publicId: result.publicId,
        rawKey: result.rawKey, // Shown ONLY ONCE
        hint: result.hint,
        name: result.name,
        accessLevel: result.accessLevel,
        status: result.status
      }
    });
  } catch (err) {
    console.error('[ApiKeyController] requestKey error:', err);
    return res.status(500).json({ success: false, error: 'Failed to generate API key request' });
  }
}

/**
 * List all API keys owned by the authenticated user.
 */
async function listMyKeys(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const keys = await apiKeyService.listUserKeys(userId);
    return res.json({ success: true, data: keys });
  } catch (err) {
    console.error('[ApiKeyController] listMyKeys error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch API keys' });
  }
}

/**
 * Revoke an API key owned by the authenticated user.
 */
async function revokeMyKey(req, res) {
  try {
    const userId = req.user?.id;
    const { publicId } = req.params;

    // Verify ownership
    const [rows] = await pool.query('SELECT user_id FROM api_keys WHERE public_id = ?', [publicId]);
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'API key not found' });
    }

    if (rows[0].user_id !== userId && !['Admin', 'Super Admin'].includes(req.user?.role)) {
      return res.status(403).json({ success: false, error: 'Not authorized to revoke this key' });
    }

    await apiKeyService.revokeKey(publicId, {
      adminId: userId,
      reason: req.body.reason || 'Revoked by owner',
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    return res.json({ success: true, message: 'API key revoked successfully' });
  } catch (err) {
    console.error('[ApiKeyController] revokeMyKey error:', err);
    return res.status(500).json({ success: false, error: 'Failed to revoke API key' });
  }
}

/**
 * Regenerate an API key: revokes existing key and creates a fresh key request.
 * Returns rawKey ONCE.
 */
async function regenerateMyKey(req, res) {
  try {
    const userId = req.user?.id;
    const { publicId } = req.params;

    const [rows] = await pool.query('SELECT * FROM api_keys WHERE public_id = ?', [publicId]);
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'API key not found' });
    }
    const oldKey = rows[0];

    if (oldKey.user_id !== userId && !['Admin', 'Super Admin'].includes(req.user?.role)) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    // Revoke old key
    await apiKeyService.revokeKey(publicId, {
      adminId: userId,
      reason: 'Regenerated by owner',
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    // Decrypt old scopes and IP whitelist to carry over
    const dek = apiKeyService.crypto.decryptDEK(oldKey.encrypted_dek);
    let oldScopes = [];
    let oldIps = [];
    try {
      oldScopes = JSON.parse(apiKeyService.crypto.decryptField(oldKey.scopes_encrypted, dek));
      if (oldKey.ip_whitelist_encrypted) {
        oldIps = JSON.parse(apiKeyService.crypto.decryptField(oldKey.ip_whitelist_encrypted, dek));
      }
    } catch (e) {}

    // Create new key
    const result = await apiKeyService.createApiKeyRequest({
      userId,
      name: `${oldKey.name} (Regenerated)`,
      prefix: oldKey.prefix,
      accessLevel: oldKey.access_level,
      scopes: oldScopes,
      ipWhitelist: oldIps,
      expiresAt: oldKey.expires_at,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    return res.status(201).json({
      success: true,
      message: 'New API key created in PENDING status. Old key was revoked. Save your new key now!',
      data: {
        publicId: result.publicId,
        rawKey: result.rawKey,
        hint: result.hint,
        name: result.name,
        accessLevel: result.accessLevel,
        status: result.status
      }
    });
  } catch (err) {
    console.error('[ApiKeyController] regenerateMyKey error:', err);
    return res.status(500).json({ success: false, error: 'Failed to regenerate API key' });
  }
}

/**
 * Get personalized API documentation for an approved key.
 */
async function getPersonalizedDocs(req, res) {
  try {
    const { publicId } = req.params;
    const docs = await apiKeyService.getPersonalizedDocs(publicId);
    return res.json({ success: true, data: docs });
  } catch (err) {
    return res.status(404).json({ success: false, error: err.message });
  }
}

// ── Admin Endpoints ────────────────────────────────────────────────────────────

/**
 * List all keys across all users (Admin view with filters and stats).
 */
async function listAdminKeys(req, res) {
  try {
    const { status, user_id, access_level, search } = req.query;
    const result = await apiKeyService.listAdminKeys({
      status,
      userId: user_id,
      accessLevel: access_level,
      search
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[ApiKeyController] listAdminKeys error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch admin key directory' });
  }
}

/**
 * Approve a PENDING key (activates key and grants initial 24h authorization).
 */
async function approveKey(req, res) {
  try {
    const adminId = req.user.id;
    const { publicId } = req.params;
    const { accessLevel, scopes, rateLimit } = req.body;

    const updated = await apiKeyService.approveKey(publicId, adminId, { accessLevel, scopes, rateLimit }, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    return res.json({
      success: true,
      message: 'API key approved and activated for 24 hours.',
      data: updated
    });
  } catch (err) {
    console.error('[ApiKeyController] approveKey error:', err);
    return res.status(400).json({ success: false, error: err.message });
  }
}

/**
 * Reject a PENDING key.
 */
async function rejectKey(req, res) {
  try {
    const adminId = req.user.id;
    const { publicId } = req.params;
    const { reason = 'Rejected by administrator' } = req.body;

    await apiKeyService.rejectKey(publicId, adminId, reason, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    return res.json({ success: true, message: 'API key rejected successfully' });
  } catch (err) {
    console.error('[ApiKeyController] rejectKey error:', err);
    return res.status(400).json({ success: false, error: err.message });
  }
}

/**
 * Suspend an active key.
 */
async function suspendKey(req, res) {
  try {
    const adminId = req.user.id;
    const { publicId } = req.params;
    const { reason = 'Suspended by administrator' } = req.body;

    await apiKeyService.suspendKey(publicId, adminId, reason, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    return res.json({ success: true, message: 'API key suspended' });
  } catch (err) {
    console.error('[ApiKeyController] suspendKey error:', err);
    return res.status(400).json({ success: false, error: err.message });
  }
}

/**
 * Daily 24-hour re-authorization by admin.
 */
async function reauthorizeDaily(req, res) {
  try {
    const adminId = req.user.id;
    const { publicId } = req.params;

    const updated = await apiKeyService.reauthorizeDaily(publicId, adminId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    return res.json({
      success: true,
      message: 'API key daily authorization renewed for 24 hours.',
      data: updated
    });
  } catch (err) {
    console.error('[ApiKeyController] reauthorizeDaily error:', err);
    return res.status(400).json({ success: false, error: err.message });
  }
}

/**
 * Bulk daily re-authorization by admin.
 */
async function bulkReauthorizeDaily(req, res) {
  try {
    const adminId = req.user.id;
    const { publicIds } = req.body;

    if (!Array.isArray(publicIds) || publicIds.length === 0) {
      return res.status(400).json({ success: false, error: 'publicIds array is required' });
    }

    const count = await apiKeyService.bulkReauthorizeDaily(publicIds, adminId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    return res.json({
      success: true,
      message: `Successfully reauthorized ${count} API keys for 24 hours.`,
      count
    });
  } catch (err) {
    console.error('[ApiKeyController] bulkReauthorizeDaily error:', err);
    return res.status(500).json({ success: false, error: 'Bulk re-authorization failed' });
  }
}

/**
 * View audit log for API keys.
 */
async function getAuditLog(req, res) {
  try {
    const { publicId } = req.params;
    let query = `
      SELECT id, key_public_id, event_type, user_id, admin_id, ip_address, user_agent, scope_used, result, metadata, created_at
      FROM api_key_audit_log
    `;
    const params = [];
    if (publicId) {
      query += ' WHERE key_public_id = ?';
      params.push(publicId);
    }
    query += ' ORDER BY created_at DESC LIMIT 100';

    const [rows] = await pool.query(query, params);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[ApiKeyController] getAuditLog error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve audit log' });
  }
}

module.exports = {
  requestKey,
  listMyKeys,
  revokeMyKey,
  regenerateMyKey,
  getPersonalizedDocs,
  listAdminKeys,
  approveKey,
  rejectKey,
  suspendKey,
  reauthorizeDaily,
  bulkReauthorizeDaily,
  getAuditLog
};
