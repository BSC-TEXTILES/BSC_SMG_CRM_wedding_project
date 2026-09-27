/**
 * Enterprise API Key Management Service
 * - Lifecycle: Request -> Admin Approval -> Active (24h Daily Window) -> Daily Re-Auth
 * - Envelope Encryption: AES-256-GCM for DEK and sensitive fields
 * - Audit Trail: Comprehensive logging without leaking raw keys or hashes
 */

const { v4: uuidv4 } = require('crypto');
const crypto = require('crypto');
const pool = require('../config/db');
const {
  generateDEK,
  encryptDEK,
  decryptDEK,
  encryptField,
  decryptField,
  generateApiKey,
  verifyKeyFormat,
  computeLookupHash,
  verifyKeyHash
} = require('../security/apiKeyCrypto');

const VALID_ACCESS_LEVELS = ['READ', 'READ_WRITE', 'FULL_ACCESS', 'ADMIN_CONNECT'];

const ALL_SCOPES = [
  'data:read',
  'data:write',
  'data:delete',
  'website:connect',
  'website:read',
  'website:write',
  'analytics:read',
  'users:read',
  'api:manage',
  'export:data',
  'cross:connect'
];

class ApiKeyService {
  /**
   * Decrypt sensitive fields of an API key record using its DEK
   */
  decryptRecord(row) {
    if (!row) return null;
    let scopes = [];
    let ipWhitelist = [];
    let keyHint = row.key_hint;

    try {
      const dek = decryptDEK(row.encrypted_dek);
      if (row.scopes_encrypted) {
        scopes = decryptField(row.scopes_encrypted, dek) || [];
      }
      if (row.ip_whitelist_encrypted) {
        ipWhitelist = decryptField(row.ip_whitelist_encrypted, dek) || [];
      }
      if (row.encrypted_key_hint) {
        keyHint = decryptField(row.encrypted_key_hint, dek) || row.key_hint;
      }
    } catch (e) {
      console.warn(`[ApiKeyService] Decryption warning for key ${row.public_id}:`, e.message);
      try { scopes = JSON.parse(row.scopes_encrypted); } catch {}
    }

    return {
      id: row.id,
      publicId: row.public_id,
      userId: row.user_id,
      username: row.username,
      userRole: row.user_role,
      name: row.name,
      prefix: row.prefix,
      keyHint,
      accessLevel: row.access_level,
      scopes,
      status: row.status,
      encryptionKeyVersion: row.encryption_key_version,
      dailyApprovedAt: row.daily_approved_at,
      dailyApprovalExpires: row.daily_approval_expires,
      approvedByAdminId: row.approved_by_admin_id,
      ipWhitelist,
      rateLimitPerMinute: row.rate_limit_per_minute,
      requestCount: Number(row.request_count || 0),
      lastUsedAt: row.last_used_at,
      lastUsedIp: row.last_used_ip,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Log an audit event for an API key
   */
  async logAuditEvent({
    keyPublicId,
    eventType,
    userId = null,
    adminId = null,
    ip = null,
    userAgent = null,
    scopeUsed = null,
    result = 'SUCCESS',
    metadata = null
  }) {
    try {
      const id = crypto.randomUUID();
      await pool.query(
        `INSERT INTO api_key_audit_log 
         (id, key_public_id, event_type, user_id, admin_id, ip_address, user_agent, scope_used, result, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          keyPublicId,
          eventType,
          userId,
          adminId,
          ip ? String(ip).slice(0, 50) : null,
          userAgent ? String(userAgent).slice(0, 500) : null,
          scopeUsed,
          result,
          metadata ? JSON.stringify(metadata) : null
        ]
      );
    } catch (err) {
      console.warn('[ApiKeyAudit] Failed to record event:', err.message);
    }
  }

  /**
   * Create a new API key request (status: PENDING until approved by admin)
   */
  async createApiKeyRequest(arg1, arg2 = {}) {
    let userId;
    let options;
    if (typeof arg1 === 'object' && arg1 !== null && !arg2.name) {
      userId = arg1.userId;
      options = arg1;
    } else {
      userId = arg1;
      options = arg2;
    }

    const {
      name,
      prefix = 'LIVE',
      accessLevel = 'READ',
      scopes = ['data:read'],
      ipWhitelist = [],
      expiresAt = null,
      rateLimitPerMinute = 60
    } = options;

    if (!name || String(name).trim().length === 0) {
      throw new Error('API key name is required');
    }
    if (!VALID_ACCESS_LEVELS.includes(accessLevel)) {
      throw new Error(`Invalid access level. Allowed: ${VALID_ACCESS_LEVELS.join(', ')}`);
    }

    const cleanScopes = Array.isArray(scopes) ? scopes.filter(s => ALL_SCOPES.includes(s)) : ['data:read'];
    if (cleanScopes.length === 0) cleanScopes.push('data:read');

    // 1. Generate key and envelope encryption keys
    const generated = generateApiKey(prefix);
    const dek = generateDEK();
    const encryptedDEK = encryptDEK(dek);

    // 2. Encrypt sensitive fields with DEK
    const scopesEncrypted = encryptField(cleanScopes, dek);
    const ipWhitelistEncrypted = ipWhitelist && ipWhitelist.length > 0 ? encryptField(ipWhitelist, dek) : null;
    const encryptedKeyHint = encryptField(generated.keyHint, dek);

    // 3. Set hard expiration (default 1 year, maximum 1 year)
    const maxExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    let hardExpiry = expiresAt ? new Date(expiresAt) : maxExpiry;
    if (isNaN(hardExpiry.getTime()) || hardExpiry > maxExpiry) {
      hardExpiry = maxExpiry;
    }

    const id = crypto.randomUUID();
    const publicId = crypto.randomUUID();

    // 4. Save to DB with status = PENDING
    await pool.query(
      `INSERT INTO api_keys (
        id, public_id, user_id, name, prefix, lookup_hash, key_hash, key_hint, encrypted_key_hint,
        access_level, scopes_encrypted, status, encrypted_dek, encryption_key_version,
        ip_whitelist_encrypted, rate_limit_per_minute, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, 1, ?, ?, ?)`,
      [
        id,
        publicId,
        userId,
        name.trim(),
        generated.prefix,
        generated.lookupHash,
        generated.keyHash,
        generated.keyHint,
        encryptedKeyHint,
        accessLevel,
        scopesEncrypted,
        encryptedDEK,
        ipWhitelistEncrypted,
        rateLimitPerMinute || 60,
        hardExpiry
      ]
    );

    // 5. Audit log
    await this.logAuditEvent({
      keyPublicId: publicId,
      eventType: 'CREATED',
      userId,
      result: 'SUCCESS',
      metadata: { name: name.trim(), accessLevel, scopes: cleanScopes }
    });

    // 6. Return rawKey ONCE to user (never stored or sent again)
    return {
      publicId,
      rawKey: generated.rawKey,
      keyHint: generated.keyHint,
      name: name.trim(),
      prefix: generated.prefix,
      accessLevel,
      scopes: cleanScopes,
      status: 'PENDING',
      message: 'API key generated. Admin approval is required before activation. Save your secret key now—it will not be shown again.'
    };
  }

  /**
   * List keys owned by a specific user
   */
  async listUserKeys(userId) {
    const [rows] = await pool.query(
      `SELECT k.*, u.username, u.role AS user_role
       FROM api_keys k
       JOIN users u ON u.id = k.user_id
       WHERE k.user_id = ?
       ORDER BY k.created_at DESC`,
      [userId]
    );
    return rows.map(r => this.decryptRecord(r));
  }

  /**
   * List all keys for Admin dashboard with filtering and pagination
   */
  async listAdminKeys({ status = 'ALL', search = '', page = 1, limit = 50 }) {
    const offset = Math.max(0, (page - 1) * limit);
    let query = `
      SELECT k.*, u.username, u.role AS user_role, u.full_name AS user_full_name
      FROM api_keys k
      JOIN users u ON u.id = k.user_id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'ALL') {
      query += ` AND k.status = ?`;
      params.push(status);
    }
    if (search && search.trim()) {
      query += ` AND (k.name LIKE ? OR u.username LIKE ? OR u.full_name LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    query += ` ORDER BY 
      CASE WHEN k.status = 'PENDING' THEN 1 
           WHEN k.status = 'NEEDS_REAUTH' THEN 2 
           WHEN k.status = 'ACTIVE' THEN 3 
           ELSE 4 END,
      k.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await pool.query(query, params);

    // Count query
    const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM api_keys`);

    return {
      keys: rows.map(r => this.decryptRecord(r)),
      total: countRows[0]?.total || 0,
      page,
      limit
    };
  }

  /**
   * Admin approves an API key (activates key for 24 hours)
   */
  async approveKey(arg1, arg2, modifications = {}) {
    let publicId = (typeof arg1 === 'string' && (arg1.length === 36 || arg1.includes('-'))) ? arg1 : arg2;
    let adminId = (publicId === arg1) ? arg2 : arg1;

    const [rows] = await pool.query(`SELECT * FROM api_keys WHERE public_id = ? LIMIT 1`, [publicId]);
    if (rows.length === 0) throw new Error('API key not found');
    const existing = rows[0];

    const now = new Date();
    const expires24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    let accessLevel = existing.access_level;
    let scopesEncrypted = existing.scopes_encrypted;

    // Apply any modifications if provided by admin
    if (modifications.accessLevel && VALID_ACCESS_LEVELS.includes(modifications.accessLevel)) {
      accessLevel = modifications.accessLevel;
    }
    if (Array.isArray(modifications.scopes)) {
      const dek = decryptDEK(existing.encrypted_dek);
      scopesEncrypted = encryptField(modifications.scopes, dek);
    }

    await pool.query(
      `UPDATE api_keys 
       SET status = 'ACTIVE',
           access_level = ?,
           scopes_encrypted = ?,
           daily_approved_at = ?,
           daily_approval_expires = ?,
           approved_by_admin_id = ?
       WHERE public_id = ?`,
      [accessLevel, scopesEncrypted, now, expires24h, adminId, publicId]
    );

    await this.logAuditEvent({
      keyPublicId: publicId,
      eventType: 'APPROVED',
      adminId,
      result: 'SUCCESS',
      metadata: { dailyApprovalExpires: expires24h.toISOString(), accessLevel }
    });

    return {
      success: true,
      publicId,
      status: 'ACTIVE',
      dailyApprovalExpires: expires24h,
      daily_approval_expires: expires24h
    };
  }

  /**
   * Admin rejects an API key
   */
  async rejectKey(arg1, arg2, reason = 'Administrative decision') {
    let publicId = (typeof arg1 === 'string' && (arg1.length === 36 || arg1.includes('-'))) ? arg1 : arg2;
    let adminId = (publicId === arg1) ? arg2 : arg1;

    await pool.query(
      `UPDATE api_keys SET status = 'REVOKED' WHERE public_id = ?`,
      [publicId]
    );

    await this.logAuditEvent({
      keyPublicId: publicId,
      eventType: 'REJECTED',
      adminId,
      result: 'REVOKED',
      metadata: { reason }
    });

    return { success: true, publicId, status: 'REVOKED' };
  }

  /**
   * Suspend an active key
   */
  async suspendKey(arg1, arg2, reason = 'Temporarily suspended by administrator') {
    let publicId = (typeof arg1 === 'string' && (arg1.length === 36 || arg1.includes('-'))) ? arg1 : arg2;
    let adminId = (publicId === arg1) ? arg2 : arg1;

    await pool.query(
      `UPDATE api_keys SET status = 'SUSPENDED' WHERE public_id = ?`,
      [publicId]
    );

    await this.logAuditEvent({
      keyPublicId: publicId,
      eventType: 'SUSPENDED',
      adminId,
      result: 'SUSPENDED',
      metadata: { reason }
    });

    return { success: true, publicId, status: 'SUSPENDED' };
  }

  /**
   * Revoke an API key permanently
   */
  async revokeKey(arg1, arg2, reason = 'User/Admin revoked') {
    let publicId = (typeof arg1 === 'string' && (arg1.length === 36 || arg1.includes('-'))) ? arg1 : arg2;
    let actorId = (publicId === arg1) ? arg2 : arg1;

    await pool.query(
      `UPDATE api_keys SET status = 'REVOKED' WHERE public_id = ?`,
      [publicId]
    );

    await this.logAuditEvent({
      keyPublicId: publicId,
      eventType: 'REVOKED',
      userId: actorId,
      result: 'REVOKED',
      metadata: { reason }
    });

    return { success: true, publicId, status: 'REVOKED' };
  }

  /**
   * Daily Re-Authorization: extends an active or pending key for exactly 24 hours
   */
  async reauthorizeDaily(arg1, arg2) {
    let publicId = (typeof arg1 === 'string' && (arg1.length === 36 || arg1.includes('-'))) ? arg1 : arg2;
    let adminId = (publicId === arg1) ? arg2 : arg1;

    const now = new Date();
    const expires24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const [res] = await pool.query(
      `UPDATE api_keys
       SET status = 'ACTIVE',
           daily_approved_at = ?,
           daily_approval_expires = ?,
           approved_by_admin_id = ?
       WHERE public_id = ? AND status IN ('ACTIVE', 'NEEDS_REAUTH', 'PENDING')`,
      [now, expires24h, adminId, publicId]
    );

    if (res.affectedRows === 0) {
      throw new Error('API key not found or is revoked/expired');
    }

    await pool.query(
      `UPDATE api_key_reauth_requests 
       SET status = 'APPROVED', approved_at = ?, approved_by = ?
       WHERE key_public_id = ? AND status = 'PENDING'`,
      [now, adminId, publicId]
    );

    await this.logAuditEvent({
      keyPublicId: publicId,
      eventType: 'DAILY_REAUTH',
      adminId,
      result: 'SUCCESS',
      metadata: { extendedTo: expires24h.toISOString() }
    });

    return {
      success: true,
      publicId,
      status: 'ACTIVE',
      dailyApprovalExpires: expires24h,
      daily_approval_expires: expires24h
    };
  }

  /**
   * Bulk daily re-authorization
   */
  async bulkReauthorizeDaily(arg1, arg2 = []) {
    let publicIds = Array.isArray(arg1) ? arg1 : arg2;
    let adminId = (publicIds === arg1) ? arg2 : arg1;

    if (!Array.isArray(publicIds) || publicIds.length === 0) return { updated: 0 };
    const results = [];
    for (const pid of publicIds) {
      try {
        await this.reauthorizeDaily(adminId, pid);
        results.push({ publicId: pid, success: true });
      } catch (e) {
        results.push({ publicId: pid, success: false, error: e.message });
      }
    }
    return { success: true, results };
  }

  /**
   * Validate and authenticate an incoming raw API key from Authorization header
   */
  async authenticateKey(rawKey, requiredScope = null, clientIp = null, userAgent = null) {
    let scope = requiredScope;
    let ip = clientIp;
    let ua = userAgent;
    if (typeof requiredScope === 'object' && requiredScope !== null) {
      scope = requiredScope.requiredScope || null;
      ip = requiredScope.clientIp || null;
      ua = requiredScope.userAgent || null;
    }

    // 1. Format & Checksum Verification
    if (!verifyKeyFormat(rawKey)) {
      return { valid: false, authenticated: false, code: 'INVALID_KEY_FORMAT', error: 'Malformed API key or invalid checksum' };
    }

    // 2. Fast O(1) indexed lookup via HMAC lookup hash
    const lookupHash = computeLookupHash(rawKey);
    const [rows] = await pool.query(
      `SELECT k.*, u.username, u.role AS user_role, (u.active = 1) AS user_active
       FROM api_keys k
       JOIN users u ON u.id = k.user_id
       WHERE k.lookup_hash = ? LIMIT 1`,
      [lookupHash]
    );

    if (rows.length === 0) {
      return { valid: false, authenticated: false, code: 'KEY_NOT_FOUND', error: 'API key does not exist or has been revoked' };
    }

    const row = rows[0];

    // 3. Timing-safe cryptographic hash comparison
    const isHashValid = await verifyKeyHash(rawKey, row.key_hash);
    if (!isHashValid) {
      await this.logAuditEvent({
        keyPublicId: row.public_id,
        eventType: 'FAILED_AUTH',
        ip: clientIp,
        userAgent,
        result: 'HASH_MISMATCH'
      });
      return { valid: false, authenticated: false, code: 'INVALID_CREDENTIALS', error: 'API key authentication failed' };
    }

    // 4. User account status
    if (!row.user_active) {
      return { valid: false, authenticated: false, code: 'USER_INACTIVE', error: 'User account associated with this key is inactive' };
    }

    // 5. Hard Expiry Check
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      await pool.query(`UPDATE api_keys SET status = 'EXPIRED' WHERE id = ?`, [row.id]);
      return { valid: false, authenticated: false, code: 'KEY_EXPIRED', error: 'This API key has reached its hard expiration date' };
    }

    // 6. Status check
    if (row.status === 'PENDING') {
      return { valid: false, authenticated: false, code: 'APPROVAL_PENDING', error: 'KEY_PENDING_APPROVAL' };
    }
    if (['SUSPENDED', 'REVOKED', 'EXPIRED'].includes(row.status)) {
      await this.logAuditEvent({
        keyPublicId: row.public_id,
        eventType: 'ANOMALY',
        ip,
        userAgent: ua,
        result: 'ATTEMPT_ON_INACTIVE_KEY',
        metadata: { attemptedStatus: row.status }
      });
      return { valid: false, authenticated: false, code: 'KEY_INACTIVE', error: `This API key is currently ${row.status.toLowerCase()}` };
    }

    // 7. Daily 24h Re-Authorization Check (Module 4)
    const now = new Date();
    if (!row.daily_approval_expires || new Date(row.daily_approval_expires) < now) {
      await pool.query(`UPDATE api_keys SET status = 'NEEDS_REAUTH' WHERE id = ?`, [row.id]);
      await this.logAuditEvent({
        keyPublicId: row.public_id,
        eventType: 'ANOMALY',
        ip: clientIp,
        userAgent,
        result: 'DAILY_REAUTH_EXPIRED'
      });
      return {
        valid: false,
        authenticated: false,
        code: 'DAILY_REAUTH_REQUIRED',
        error: 'DAILY_REAUTH_REQUIRED',
        message: 'This API key requires daily admin re-authorization. Contact your administrator.',
        key_public_id: row.public_id,
        expired_at: row.daily_approval_expires
      };
    }

    // 8. Decrypt sensitive record fields
    const keyData = this.decryptRecord(row);

    // 9. IP Whitelist Enforcement
    if (keyData.ipWhitelist && keyData.ipWhitelist.length > 0 && clientIp) {
      const allowed = keyData.ipWhitelist.includes(clientIp) ||
                      keyData.ipWhitelist.includes('127.0.0.1') ||
                      keyData.ipWhitelist.includes('::1') ||
                      keyData.ipWhitelist.includes('localhost');
      if (!allowed) {
        await this.logAuditEvent({
          keyPublicId: row.public_id,
          eventType: 'ANOMALY',
          ip: clientIp,
          userAgent,
          result: 'IP_NOT_WHITELISTED',
          metadata: { clientIp }
        });
        return { valid: false, code: 'IP_NOT_ALLOWED', error: `Client IP ${clientIp} is not in the authorized whitelist for this key` };
      }
    }

    // 10. Scope and Access Level Enforcement
    if (scope) {
      const hasScope = keyData.accessLevel === 'ADMIN_CONNECT' ||
                       keyData.scopes.includes('*') ||
                       keyData.scopes.includes(scope);
      if (!hasScope) {
        return {
          valid: false,
          authenticated: false,
          code: 'INSUFFICIENT_SCOPE',
          error: 'INSUFFICIENT_SCOPE',
          message: `Missing required scope: '${scope}'. Granted: [${keyData.scopes.join(', ')}]`
        };
      }
    }

    // 11. Update usage metadata (non-blocking)
    pool.query(
      `UPDATE api_keys 
       SET last_used_at = NOW(),
           last_used_ip = ?,
           request_count = request_count + 1 
       WHERE id = ?`,
      [clientIp ? String(clientIp).slice(0, 50) : null, row.id]
    ).catch(() => {});

    return {
      valid: true,
      authenticated: true,
      key: keyData,
      keyData
    };
  }

  /**
   * Auto-generate personalized API Documentation for an approved key
   */
  async getPersonalizedDocs(publicId) {
    const [rows] = await pool.query(
      `SELECT k.*, u.username FROM api_keys k JOIN users u ON u.id = k.user_id WHERE k.public_id = ? LIMIT 1`,
      [publicId]
    );
    if (rows.length === 0) throw new Error('API Key not found');
    const key = this.decryptRecord(rows[0]);

    const endpointCatalog = [
      {
        path: '/api/v1/connect/data',
        method: 'GET',
        scope: 'data:read',
        description: 'Retrieve catalog of all connected datasets permitted by this key',
        example: `curl -H "Authorization: Bearer ${key.prefix}_..._${key.keyHint}" https://bsctextiles.in/api/v1/connect/data`
      },
      {
        path: '/api/v1/connect/data/:resource',
        method: 'GET',
        scope: 'data:read',
        description: 'Read paginated records from a permitted resource (candidates, customers, inventory)',
        example: `curl -H "Authorization: Bearer ${key.prefix}_..._${key.keyHint}" https://bsctextiles.in/api/v1/connect/data/candidates?page=1&limit=25`
      },
      {
        path: '/api/v1/connect/data/:resource',
        method: 'POST',
        scope: 'data:write',
        description: 'Create a new record in the specified resource',
        example: `curl -X POST -H "Authorization: Bearer ${key.prefix}_..._${key.keyHint}" -H "Content-Type: application/json" -d '{"name":"Sample"}' https://bsctextiles.in/api/v1/connect/data/customers`
      },
      {
        path: '/api/v1/connect/website',
        method: 'GET',
        scope: 'website:read',
        description: 'Retrieve website structure, store counters, and publication status',
        example: `curl -H "Authorization: Bearer ${key.prefix}_..._${key.keyHint}" https://bsctextiles.in/api/v1/connect/website`
      },
      {
        path: '/api/v1/connect/analytics',
        method: 'GET',
        scope: 'analytics:read',
        description: 'Retrieve real-time visitor footfall, conversion, and consultation metrics',
        example: `curl -H "Authorization: Bearer ${key.prefix}_..._${key.keyHint}" https://bsctextiles.in/api/v1/connect/analytics`
      },
      {
        path: '/api/v1/connect/export',
        method: 'GET',
        scope: 'export:data',
        description: 'Full data archive export in JSON format (requires export:data permission)',
        example: `curl -H "Authorization: Bearer ${key.prefix}_..._${key.keyHint}" https://bsctextiles.in/api/v1/connect/export`
      },
      {
        path: '/api/v1/connect/cross',
        method: 'POST',
        scope: 'cross:connect',
        description: 'Dispatch a cross-website synchronized bridge request',
        example: `curl -X POST -H "Authorization: Bearer ${key.prefix}_..._${key.keyHint}" -d '{"target":"davanagere","action":"sync"}' https://bsctextiles.in/api/v1/connect/cross`
      }
    ];

    const accessibleEndpoints = endpointCatalog.filter(ep =>
      key.accessLevel === 'ADMIN_CONNECT' ||
      key.scopes.includes('*') ||
      key.scopes.includes(ep.scope)
    );

    return {
      name: key.name,
      publicId: key.publicId,
      keyHint: `****...${key.keyHint}`,
      accessLevel: key.accessLevel,
      status: key.status,
      dailyApprovalExpires: key.dailyApprovalExpires,
      rateLimitPerMinute: key.rateLimitPerMinute,
      permittedScopes: key.scopes,
      accessibleEndpoints,
      baseUrl: 'https://bsctextiles.in/api/v1'
    };
  }
}

module.exports = new ApiKeyService();
