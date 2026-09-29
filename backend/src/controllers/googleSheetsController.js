/**
 * Google Sheets Integration Controller for BSC Textiles CRM
 * Provides Google OAuth 2.0 authentication, Google Drive spreadsheet listing,
 * worksheet inspection, live preview with pre-validation, and production-grade
 * bulk customer importing directly from Google Sheets into the Wedding CRM.
 */

const pool = require('../config/db');
const { successRes, errorRes } = require('../utils/response');
const { HEADER_ALIASES } = require('../utils/weddingTemplate');
const { encryptField } = require('../utils/crypto');
const { record403Violation } = require('../security/wafRules');

const MAX_IMPORT_ROWS = 5000;
const IMPORT_ADMIN_ROLES = ['Admin', 'Super Admin', 'system administrator'];

// ── Database Initialization ──────────────────────────────────────────────
let googleTablesChecked = false;
async function ensureGoogleTables() {
  if (googleTablesChecked) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_google_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        google_email VARCHAR(255) NULL,
        google_name VARCHAR(255) NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT NULL,
        scope TEXT NULL,
        token_type VARCHAR(50) DEFAULT 'Bearer',
        expiry_date BIGINT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_ugt_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    googleTablesChecked = true;
  } catch (err) {
    console.warn('[GoogleSheetsController.ensureGoogleTables Warning]', err.message);
  }
}

// ── OAuth Credentials Resolution ────────────────────────────────────────
async function getGoogleOAuthConfig() {
  let clientId = process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_SHEETS_CLIENT_ID || '';
  let clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_SHEETS_CLIENT_SECRET || '';

  // If not in env, check database settings table
  if (!clientId || !clientSecret) {
    try {
      const [rows] = await pool.query(
        "SELECT settingKey, settingValue FROM setting WHERE settingKey IN ('google_sheets_client_id', 'google_sheets_client_secret')"
      );
      (rows || []).forEach((r) => {
        if (r.settingKey === 'google_sheets_client_id' && !clientId) clientId = r.settingValue;
        if (r.settingKey === 'google_sheets_client_secret' && !clientSecret) clientSecret = r.settingValue;
      });
    } catch (e) {
      // settings table query fallback
    }
  }

  return { clientId: clientId.trim(), clientSecret: clientSecret.trim() };
}

// ── Token Management & Refresh ──────────────────────────────────────────
async function getUserGoogleToken(userId) {
  await ensureGoogleTables();
  const [rows] = await pool.query('SELECT * FROM user_google_tokens WHERE user_id = ? LIMIT 1', [userId]);
  if (!rows || rows.length === 0) return null;
  const token = rows[0];

  const now = Date.now();
  // If token expires in less than 2 minutes and refresh_token exists, refresh it
  if (token.expiry_date && token.expiry_date - now < 120000 && token.refresh_token) {
    const { clientId, clientSecret } = await getGoogleOAuthConfig();
    if (clientId && clientSecret) {
      try {
        const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: token.refresh_token,
            grant_type: 'refresh_token'
          })
        });

        if (refreshRes.ok) {
          const freshData = await refreshRes.json();
          const newExpiry = Date.now() + (freshData.expires_in || 3600) * 1000;
          await pool.query(
            'UPDATE user_google_tokens SET access_token = ?, expiry_date = ?, updated_at = NOW() WHERE id = ?',
            [freshData.access_token, newExpiry, token.id]
          );
          token.access_token = freshData.access_token;
          token.expiry_date = newExpiry;
        } else {
          console.warn('[GoogleTokenRefresh] Token refresh failed with status:', refreshRes.status);
        }
      } catch (err) {
        console.warn('[GoogleTokenRefresh Error]', err.message);
      }
    }
  }

  return token;
}

// Helper to determine if user has global import permissions
function isGlobalImportUser(user) {
  if (!user) return false;
  const isAdminRole = IMPORT_ADMIN_ROLES.includes(user.role);
  return (isAdminRole && (!user.locationId || user.isGlobalAdmin)) || (!user.locationId && !!user.isGlobalAdmin);
}

// Store-level RBAC check
async function assertStoreAccess(req, res, locationId) {
  const user = req.user || {};
  const targetId = parseInt(locationId, 10);
  if (isNaN(targetId)) return { allowed: false, reason: 'Invalid store location selected.' };

  if (isGlobalImportUser(user)) return { allowed: true, reason: 'Global admin' };
  if (user.locationId && parseInt(user.locationId, 10) === targetId) return { allowed: true, reason: 'Own store' };
  if (Array.isArray(user.allowedLocations) && user.allowedLocations.map(Number).includes(targetId)) {
    return { allowed: true, reason: 'Allowed store' };
  }

  try {
    const [rows] = await pool.query(
      'SELECT 1 FROM user_locations WHERE user_id = ? AND location_id = ? LIMIT 1',
      [user.id, targetId]
    );
    if (rows && rows.length > 0) return { allowed: true, reason: 'Allowed store' };
  } catch (err) {
    console.warn('[GoogleImport] user_locations lookup failed:', err.message);
  }

  record403Violation(req, res, `Cross-store import attempt: store ${targetId}`);
  return { allowed: false, reason: 'You are not allowed to import customers into this store.' };
}

// Extract spreadsheet ID from link or plain ID string
function extractSpreadsheetId(input) {
  if (!input) return null;
  const trimmed = String(input).trim();
  // Regex to match Google Sheet URL format: /spreadsheets/d/([a-zA-Z0-9-_]+)
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  // Plain ID string
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

// ── Date and Field Parsers ──────────────────────────────────────────────
const toIsoDate = (y, mo, d) => {
  const year = parseInt(y, 10);
  const month = parseInt(mo, 10);
  const day = parseInt(d, 10);
  const probe = new Date(year, month - 1, day);
  if (probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day) {
    return null;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const parseDate = (raw) => {
  if (raw === null || raw === undefined) return null;
  if (raw instanceof Date) {
    return `${raw.getFullYear()}-${String(raw.getMonth() + 1).padStart(2, '0')}-${String(raw.getDate()).padStart(2, '0')}`;
  }
  const s = String(raw).trim();
  if (!s) return null;

  // Handle Google Sheet serial number format (e.g. 45678)
  if (/^\d{5}$/.test(s)) {
    const serial = parseInt(s, 10);
    // Excel/Google Sheets origin is Dec 30 1899
    const dt = new Date((serial - 25569) * 86400 * 1000);
    if (!isNaN(dt.getTime())) {
      return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
    }
  }

  // YYYY-MM-DD
  let m = s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (m) {
    const res = toIsoDate(m[1], m[2], m[3]);
    if (res) return res;
  }

  // DD-MM-YYYY or DD/MM/YYYY
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (m) {
    const res = toIsoDate(m[3], m[2], m[1]);
    if (res) return res;
  }

  const parsed = new Date(s);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900 && parsed.getFullYear() < 2100) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  }
  return null;
};

// ── Controller Methods ──────────────────────────────────────────────────
class GoogleSheetsController {
  /**
   * GET /api/wedding-crm/google/status
   * Returns current Google connection status for the logged-in user
   */
  async getStatus(req, res) {
    try {
      const user = req.user || {};
      const { clientId } = await getGoogleOAuthConfig();
      const token = await getUserGoogleToken(user.id);

      return successRes(res, {
        isConfigured: !!clientId,
        isConnected: !!token,
        email: token?.google_email || null,
        name: token?.google_name || null,
        connectedAt: token?.created_at || null,
        expiresAt: token?.expiry_date ? new Date(token.expiry_date).toISOString() : null
      }, 'Google Sheets status retrieved successfully.');
    } catch (err) {
      console.error('[GoogleSheets.getStatus Error]', err);
      return errorRes(res, 'Failed to check Google Sheets connection status', [err.message], 500);
    }
  }

  /**
   * GET /api/wedding-crm/google/auth-url
   * Generates secure OAuth 2.0 authorization URL
   */
  async getAuthUrl(req, res) {
    try {
      const user = req.user || {};
      const { clientId } = await getGoogleOAuthConfig();
      if (!clientId) {
        return errorRes(
          res,
          'Google Sheets integration is not configured with a Google Cloud Client ID. Please configure GOOGLE_CLIENT_ID or save it in CRM settings.',
          ['GOOGLE_NOT_CONFIGURED'],
          400
        );
      }

      // Determine redirect URI based on server host or configured env
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers['x-forwarded-host'] || req.get('host');
      const defaultRedirectUri = `${protocol}://${host}/api/wedding-crm/google/callback`;
      const redirectUri = process.env.GOOGLE_REDIRECT_URI || defaultRedirectUri;

      // State parameter includes userId and timestamp for CSRF verification
      const statePayload = Buffer.from(
        JSON.stringify({ userId: user.id, time: Date.now() })
      ).toString('base64');

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: [
          'https://www.googleapis.com/auth/spreadsheets.readonly',
          'https://www.googleapis.com/auth/drive.readonly',
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile'
        ].join(' '),
        access_type: 'offline',
        prompt: 'consent',
        state: statePayload
      });

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      return successRes(res, { authUrl, redirectUri }, 'Authorization URL generated.');
    } catch (err) {
      console.error('[GoogleSheets.getAuthUrl Error]', err);
      return errorRes(res, 'Failed to generate Google authorization URL', [err.message], 500);
    }
  }

  /**
   * GET /api/wedding-crm/google/callback
   * OAuth callback endpoint that receives code from Google
   */
  async handleCallback(req, res) {
    try {
      const { code, state, error: googleError } = req.query;

      if (googleError) {
        return res.send(`
          <html>
            <body style="font-family:sans-serif;text-align:center;padding:50px;">
              <h2 style="color:#B42318;">Google Authorization Cancelled</h2>
              <p>${googleError}</p>
              <button onclick="window.close()" style="padding:10px 20px;border-radius:8px;background:#4A173A;color:white;border:none;cursor:pointer;">Close Window</button>
            </body>
          </html>
        `);
      }

      if (!code || !state) {
        return res.status(400).send('Missing authorization code or state.');
      }

      let parsedState = {};
      try {
        parsedState = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
      } catch (e) {
        return res.status(400).send('Invalid OAuth state parameter.');
      }

      const userId = parsedState.userId;
      if (!userId) return res.status(400).send('Invalid user session in OAuth state.');

      const { clientId, clientSecret } = await getGoogleOAuthConfig();
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers['x-forwarded-host'] || req.get('host');
      const defaultRedirectUri = `${protocol}://${host}/api/wedding-crm/google/callback`;
      const redirectUri = process.env.GOOGLE_REDIRECT_URI || defaultRedirectUri;

      // Exchange code for tokens
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: String(code),
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        })
      });

      if (!tokenRes.ok) {
        const errorText = await tokenRes.text();
        console.error('[GoogleOAuth.TokenExchange Error]', tokenRes.status, errorText);
        return res.status(500).send(`Failed to exchange token with Google: ${tokenRes.statusText}`);
      }

      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token || null;
      const expiryDate = Date.now() + (tokenData.expires_in || 3600) * 1000;

      // Retrieve user's Google profile email
      let userEmail = null;
      let userName = null;
      try {
        const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (userinfoRes.ok) {
          const profile = await userinfoRes.json();
          userEmail = profile.email || null;
          userName = profile.name || null;
        }
      } catch (profErr) {
        console.warn('[GoogleOAuth.UserInfo Error]', profErr.message);
      }

      // Upsert into user_google_tokens
      await ensureGoogleTables();
      await pool.query(
        `INSERT INTO user_google_tokens 
           (user_id, google_email, google_name, access_token, refresh_token, scope, token_type, expiry_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           google_email = VALUES(google_email),
           google_name = VALUES(google_name),
           access_token = VALUES(access_token),
           refresh_token = COALESCE(VALUES(refresh_token), refresh_token),
           scope = VALUES(scope),
           token_type = VALUES(token_type),
           expiry_date = VALUES(expiry_date),
           updated_at = NOW()`,
        [userId, userEmail, userName, accessToken, refreshToken, tokenData.scope, tokenData.token_type, expiryDate]
      );

      // Render parent window notifier script that closes popup or redirects
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Google Sheets Connected</title>
            <style>
              body { font-family: system-ui, -apple-system, sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; background:#FFFDFC; color:#4A173A; text-align:center; }
              .card { padding: 40px; border-radius: 20px; border: 1px solid #E8D9D4; box-shadow: 0 4px 12px rgba(0,0,0,0.05); max-width:400px; }
              .check { font-size: 48px; color: #198754; margin-bottom: 12px; }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="check">✓</div>
              <h2 style="margin:0 0 8px;">Google Connected!</h2>
              <p style="color:#6F5963;font-size:13px;margin:0 0 20px;">
                Successfully connected as <strong>${userEmail || 'Google User'}</strong>. You can now import your spreadsheets.
              </p>
              <script>
                if (window.opener) {
                  try {
                    window.opener.postMessage({ type: 'GOOGLE_SHEETS_CONNECTED', email: '${userEmail || ''}' }, '*');
                  } catch(e) {}
                  setTimeout(function() { window.close(); }, 1200);
                } else {
                  window.location.href = '/wedding-crm/import?google_connected=true';
                }
              </script>
            </div>
          </body>
        </html>
      `);
    } catch (err) {
      console.error('[GoogleSheets.handleCallback Error]', err);
      return res.status(500).send('OAuth callback processing failed: ' + err.message);
    }
  }

  /**
   * POST /api/wedding-crm/google/disconnect
   * Disconnects Google account by removing stored tokens
   */
  async disconnect(req, res) {
    try {
      const user = req.user || {};
      await ensureGoogleTables();
      await pool.query('DELETE FROM user_google_tokens WHERE user_id = ?', [user.id]);
      return successRes(res, { disconnected: true }, 'Google account disconnected successfully.');
    } catch (err) {
      console.error('[GoogleSheets.disconnect Error]', err);
      return errorRes(res, 'Failed to disconnect Google account', [err.message], 500);
    }
  }

  /**
   * POST /api/wedding-crm/google/config
   * Allows Administrators to configure Google OAuth Client ID and Secret
   */
  async saveConfig(req, res) {
    try {
      const user = req.user || {};
      if (!isGlobalImportUser(user) && user.role !== 'Admin' && user.role !== 'Super Admin') {
        return errorRes(res, 'Only administrators can configure Google Cloud credentials.', [], 403);
      }

      const { clientId, clientSecret } = req.body || {};
      if (!clientId || !clientSecret) {
        return errorRes(res, 'Both Client ID and Client Secret are required.', [], 400);
      }

      await pool.query(
        `INSERT INTO setting (settingKey, settingValue, category, createdAt, updatedAt)
         VALUES ('google_sheets_client_id', ?, 'Integrations', NOW(), NOW())
         ON DUPLICATE KEY UPDATE settingValue = VALUES(settingValue), updatedAt = NOW()`,
        [String(clientId).trim()]
      );

      await pool.query(
        `INSERT INTO setting (settingKey, settingValue, category, createdAt, updatedAt)
         VALUES ('google_sheets_client_secret', ?, 'Integrations', NOW(), NOW())
         ON DUPLICATE KEY UPDATE settingValue = VALUES(settingValue), updatedAt = NOW()`,
        [String(clientSecret).trim()]
      );

      return successRes(res, { configured: true }, 'Google Sheets OAuth configuration saved successfully.');
    } catch (err) {
      console.error('[GoogleSheets.saveConfig Error]', err);
      return errorRes(res, 'Failed to save Google configuration', [err.message], 500);
    }
  }

  /**
   * GET /api/wedding-crm/google/sheets
   * Lists available Google Spreadsheets from Google Drive
   */
  async listSpreadsheets(req, res) {
    try {
      const user = req.user || {};
      const token = await getUserGoogleToken(user.id);
      if (!token) {
        return errorRes(res, 'Google account is not connected. Please connect your Google account first.', ['GOOGLE_NOT_CONNECTED'], 401);
      }

      const q = req.query.q ? String(req.query.q).replace(/'/g, "\\'") : '';
      let driveQuery = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false";
      if (q) {
        driveQuery += ` and name contains '${q}'`;
      }

      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(driveQuery)}&fields=files(id,name,modifiedTime,webViewLink,owners)&orderBy=modifiedTime desc&pageSize=50`;
      const driveRes = await fetch(url, {
        headers: { Authorization: `Bearer ${token.access_token}` }
      });

      if (!driveRes.ok) {
        if (driveRes.status === 401) {
          return errorRes(res, 'Google authorization has expired. Please disconnect and reconnect your Google account.', ['TOKEN_EXPIRED'], 401);
        }
        const errText = await driveRes.text();
        console.error('[GoogleDrive.ListSheets Error]', driveRes.status, errText);
        return errorRes(res, 'Could not list spreadsheets from Google Drive. Please ensure Drive permissions are granted.', [errText], 500);
      }

      const data = await driveRes.json();
      const files = (data.files || []).map((f) => ({
        id: f.id,
        name: f.name,
        lastModified: f.modifiedTime,
        url: f.webViewLink || `https://docs.google.com/spreadsheets/d/${f.id}/edit`
      }));

      return successRes(res, { spreadsheets: files }, 'Spreadsheets retrieved successfully.');
    } catch (err) {
      console.error('[GoogleSheets.listSpreadsheets Error]', err);
      return errorRes(res, 'Failed to fetch spreadsheets from Google', [err.message], 500);
    }
  }

  /**
   * GET /api/wedding-crm/google/sheets/:id
   * Retrieves spreadsheet title and worksheets (tabs)
   */
  async getSpreadsheetDetails(req, res) {
    try {
      const user = req.user || {};
      const rawInput = req.params.id || req.query.url;
      const spreadsheetId = extractSpreadsheetId(rawInput);

      if (!spreadsheetId) {
        return errorRes(res, 'Invalid Google Spreadsheet ID or URL provided.', [], 400);
      }

      const token = await getUserGoogleToken(user.id);
      if (!token) {
        return errorRes(res, 'Google account is not connected. Please connect your Google account.', ['GOOGLE_NOT_CONNECTED'], 401);
      }

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties`;
      const sheetRes = await fetch(url, {
        headers: { Authorization: `Bearer ${token.access_token}` }
      });

      if (!sheetRes.ok) {
        if (sheetRes.status === 404) {
          return errorRes(res, 'Google Sheet could not be found or access was not granted.', ['SHEET_NOT_FOUND'], 404);
        }
        if (sheetRes.status === 403) {
          return errorRes(res, 'Permission denied. Your connected Google account does not have read access to this Google Sheet.', ['SHEET_ACCESS_DENIED'], 403);
        }
        const errText = await sheetRes.text();
        return errorRes(res, 'Failed to fetch Google Sheet information: ' + sheetRes.statusText, [errText], 500);
      }

      const data = await sheetRes.json();
      const title = data.properties?.title || 'Google Spreadsheet';
      const worksheets = (data.sheets || []).map((s) => ({
        sheetId: s.properties?.sheetId,
        title: s.properties?.title,
        rowCount: s.properties?.gridProperties?.rowCount || 0,
        columnCount: s.properties?.gridProperties?.columnCount || 0
      }));

      return successRes(res, {
        spreadsheetId,
        title,
        worksheets
      }, 'Spreadsheet details retrieved successfully.');
    } catch (err) {
      console.error('[GoogleSheets.getSpreadsheetDetails Error]', err);
      return errorRes(res, 'Failed to load spreadsheet details', [err.message], 500);
    }
  }

  /**
   * GET /api/wedding-crm/google/sheets/:id/preview
   * Fetches worksheet rows and performs header & row pre-validation
   */
  async previewWorksheet(req, res) {
    try {
      const user = req.user || {};
      const rawInput = req.params.id || req.query.url;
      const spreadsheetId = extractSpreadsheetId(rawInput);
      const sheetName = req.query.sheetName || 'Sheet1';
      const limit = Math.min(parseInt(req.query.limit, 10) || 15, 50);

      if (!spreadsheetId) {
        return errorRes(res, 'Invalid Google Spreadsheet ID or URL.', [], 400);
      }

      const token = await getUserGoogleToken(user.id);
      if (!token) {
        return errorRes(res, 'Google account is not connected.', ['GOOGLE_NOT_CONNECTED'], 401);
      }

      // Fetch values from Google Sheets API
      const range = encodeURIComponent(sheetName);
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueRenderOption=FORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;
      const valuesRes = await fetch(url, {
        headers: { Authorization: `Bearer ${token.access_token}` }
      });

      if (!valuesRes.ok) {
        const errText = await valuesRes.text();
        return errorRes(res, `Failed to load worksheet "${sheetName}": ${valuesRes.statusText}`, [errText], 400);
      }

      const valuesData = await valuesRes.json();
      const rawRows = valuesData.values || [];

      if (rawRows.length === 0) {
        return errorRes(res, `Worksheet "${sheetName}" is completely empty.`, ['EMPTY_SHEET'], 400);
      }

      // Header normalization
      const normalizeHeader = (h) =>
        String(h).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

      const canonicalFor = (key) => {
        const canonicalKeys = Object.keys(HEADER_ALIASES);
        for (let i = 0; i < canonicalKeys.length; i++) {
          if (HEADER_ALIASES[canonicalKeys[i]].includes(key)) return canonicalKeys[i];
        }
        return key;
      };

      const headerRow = rawRows[0] || [];
      const canonicalHeaders = headerRow.map((h) => canonicalFor(normalizeHeader(h)));
      const hasCustomerName = canonicalHeaders.includes('customer_name');
      const hasMobileNumber = canonicalHeaders.includes('mobile_number');

      const headerValidation = {
        isValid: hasCustomerName && hasMobileNumber,
        hasCustomerName,
        hasMobileNumber,
        missingHeaders: [
          ...(!hasCustomerName ? ['customer_name (REQUIRED)'] : []),
          ...(!hasMobileNumber ? ['mobile_number (REQUIRED)'] : [])
        ],
        rawHeaders: headerRow,
        canonicalHeaders
      };

      // Preview rows (excluding header)
      const dataRows = rawRows.slice(1);
      const totalRows = dataRows.length;
      const previewRows = [];

      for (let r = 0; r < Math.min(dataRows.length, limit); r++) {
        const row = dataRows[r];
        const obj = {};
        canonicalHeaders.forEach((key, idx) => {
          if (key && row[idx] !== undefined && row[idx] !== null) {
            obj[key] = String(row[idx]).trim();
          }
        });

        // Quick row-level validation check
        const errors = [];
        if (!obj.customer_name) errors.push('Customer Name is missing');
        const mob = String(obj.mobile_number || '').replace(/\D/g, '');
        if (!mob) errors.push('Mobile number missing');
        else if (mob.length !== 10 || !/^[6-9]/.test(mob)) errors.push('Invalid 10-digit Indian mobile');

        previewRows.push({
          rowNumber: r + 2,
          data: obj,
          isValid: errors.length === 0,
          errors
        });
      }

      return successRes(res, {
        spreadsheetId,
        sheetName,
        totalRows,
        previewCount: previewRows.length,
        headerValidation,
        previewRows
      }, 'Worksheet preview generated.');
    } catch (err) {
      console.error('[GoogleSheets.previewWorksheet Error]', err);
      return errorRes(res, 'Failed to generate worksheet preview', [err.message], 500);
    }
  }

  /**
   * POST /api/wedding-crm/google/import
   * Imports valid rows from the specified Google Sheet worksheet into wedding_customers
   */
  async importSheet(req, res) {
    const importStartTime = Date.now();
    let conn = null;

    try {
      const user = req.user || {};
      const { spreadsheetId: rawId, sheetName: requestedSheetName, location_id, locationId } = req.body || {};
      const spreadsheetId = extractSpreadsheetId(rawId);

      if (!spreadsheetId) {
        return errorRes(res, 'Valid Google Spreadsheet ID or URL is required.', [], 400);
      }

      const token = await getUserGoogleToken(user.id);
      if (!token) {
        return errorRes(res, 'Google account is not connected. Please connect your Google account.', ['GOOGLE_NOT_CONNECTED'], 401);
      }

      // Store Location & RBAC validation
      let defaultLocationId = location_id || locationId || user.locationId;
      if (!defaultLocationId) {
        return errorRes(res, 'Assign Store Location is required before starting import.', [], 400);
      }
      defaultLocationId = parseInt(defaultLocationId, 10);
      if (isNaN(defaultLocationId)) {
        return errorRes(res, 'Invalid store location selected.', [], 400);
      }

      const storeAccess = await assertStoreAccess(req, res, defaultLocationId);
      if (!storeAccess.allowed) {
        return errorRes(res, storeAccess.reason, ['STORE_ACCESS_DENIED'], 403);
      }

      const allowRowLocations = isGlobalImportUser(user);

      // Fetch spreadsheet title
      let spreadsheetTitle = 'Google Sheet';
      try {
        const metaRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title`,
          { headers: { Authorization: `Bearer ${token.access_token}` } }
        );
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          spreadsheetTitle = metaData.properties?.title || spreadsheetTitle;
        }
      } catch (e) {
        // ignore title fetch failure
      }

      // Fetch sheet values
      const sheetName = requestedSheetName || 'Sheet1';
      const range = encodeURIComponent(sheetName);
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueRenderOption=FORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;
      const valuesRes = await fetch(url, {
        headers: { Authorization: `Bearer ${token.access_token}` }
      });

      if (!valuesRes.ok) {
        const errText = await valuesRes.text();
        return errorRes(res, `Failed to read Google Sheet data: ${valuesRes.statusText}`, [errText], 400);
      }

      const valuesData = await valuesRes.json();
      const rows = valuesData.values || [];

      if (!rows || rows.length < 2) {
        return errorRes(res, `The worksheet "${sheetName}" contains no customer records below the header row.`, [], 400);
      }

      // Normalize headers
      const normalizeHeader = (h) =>
        String(h).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

      const canonicalFor = (key) => {
        const canonicalKeys = Object.keys(HEADER_ALIASES);
        for (let i = 0; i < canonicalKeys.length; i++) {
          if (HEADER_ALIASES[canonicalKeys[i]].includes(key)) return canonicalKeys[i];
        }
        return key;
      };

      const canonicalHeaders = rows[0].map((h) => canonicalFor(normalizeHeader(h)));
      const hasCustomerName = canonicalHeaders.includes('customer_name');
      const hasMobileNumber = canonicalHeaders.includes('mobile_number');

      if (!hasCustomerName || !hasMobileNumber) {
        const missing = [];
        if (!hasCustomerName) missing.push('customer_name (REQUIRED)');
        if (!hasMobileNumber) missing.push('mobile_number (REQUIRED)');
        return errorRes(
          res,
          `Missing required column headers: ${missing.join(', ')}. Google Sheet row 1 must include "customer_name" and "mobile_number".`,
          missing,
          400
        );
      }

      // Objects from rows
      const objects = [];
      for (let r = 1; r < rows.length; r++) {
        const obj = {};
        canonicalHeaders.forEach((key, idx) => {
          if (!key) return;
          const raw = rows[r][idx] !== undefined ? String(rows[r][idx]).trim() : '';
          if (raw !== '' && (obj[key] === undefined || obj[key] === '')) obj[key] = raw;
        });
        if (Object.keys(obj).length > 0) {
          objects.push({ rowNo: r + 1, data: obj });
        }
      }

      if (objects.length === 0) {
        return errorRes(res, 'The Google Sheet contains headers but no customer data rows.', [], 400);
      }
      if (objects.length > MAX_IMPORT_ROWS) {
        return errorRes(
          res,
          `The Google Sheet contains ${objects.length} rows. Maximum allowed per import is ${MAX_IMPORT_ROWS}. Please split into smaller batches.`,
          [],
          400
        );
      }

      // Load reference lookups (locations and telecallers)
      const [locationsList] = await pool.query('SELECT id, location_name, location_code FROM locations WHERE is_active = 1');
      const locationMap = new Map();
      (locationsList || []).forEach((loc) => {
        locationMap.set(String(loc.id), loc);
        locationMap.set(String(loc.location_name).trim().toLowerCase(), loc);
        locationMap.set(String(loc.location_code).trim().toLowerCase(), loc);
      });

      const [telecallerRows] = await pool.query(
        "SELECT id, full_name, username FROM users WHERE active = 1 AND role IN ('Telecaller', 'CRM Executive', 'VM Telecaller', 'Team Lead')"
      );
      const telecallerMap = new Map();
      (telecallerRows || []).forEach((tc) => {
        if (tc.full_name) telecallerMap.set(tc.full_name.trim().toLowerCase(), tc);
        if (tc.username) telecallerMap.set(tc.username.trim().toLowerCase(), tc);
      });

      // Phase A: Field validation
      const candidates = [];
      const errors = [];
      const warnings = [];
      let duplicates = 0;
      const seenMobilesInSheet = new Set();

      const pick = (obj, keys) => {
        for (const k of keys) {
          if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') {
            return String(obj[k]).trim();
          }
        }
        return null;
      };

      for (const item of objects) {
        const rowNo = item.rowNo;
        const row = item.data;

        const customerName = pick(row, ['customer_name']);
        if (!customerName || customerName.length < 2) {
          errors.push({ row: rowNo, reason: 'Customer Name is required (minimum 2 characters)' });
          continue;
        }

        const rawMobile = pick(row, ['mobile_number']);
        const mobile = String(rawMobile || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
        if (!mobile || mobile.length !== 10 || !/^[6-9]\d{9}$/.test(mobile)) {
          errors.push({
            row: rowNo,
            customerName,
            mobile: rawMobile,
            reason: `Invalid mobile number "${rawMobile || ''}". Must be 10 digits starting with 6-9.`
          });
          continue;
        }

        // Duplicate within the same sheet
        if (seenMobilesInSheet.has(mobile)) {
          duplicates++;
          errors.push({
            row: rowNo,
            customerName,
            mobile,
            reason: `Duplicate mobile number in sheet: ${mobile} appeared multiple times.`
          });
          continue;
        }
        seenMobilesInSheet.add(mobile);

        // Optional alternate mobile
        let altNumber = null;
        const rawAlt = pick(row, ['alternate_mobile']);
        if (rawAlt) {
          const cleanedAlt = String(rawAlt).replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
          if (cleanedAlt.length === 10 && /^[6-9]\d{9}$/.test(cleanedAlt)) {
            altNumber = cleanedAlt;
          } else {
            warnings.push({ row: rowNo, customerName, mobile, reason: `Invalid alternate mobile "${rawAlt}" ignored.` });
          }
        }

        // Optional email
        let email = null;
        const rawEmail = pick(row, ['email']);
        if (rawEmail) {
          if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
            email = rawEmail.toLowerCase();
          } else {
            warnings.push({ row: rowNo, customerName, mobile, reason: `Invalid email "${rawEmail}" ignored.` });
          }
        }

        // Dates
        const weddingDate = parseDate(pick(row, ['wedding_date']));
        const parsedShopping = parseDate(pick(row, ['expected_shopping_date']));

        // Budget
        let budget = null;
        const bMin = pick(row, ['budget_min']);
        const bMax = pick(row, ['budget_max']);
        const bSingle = pick(row, ['budget']);
        if (bMin || bMax) {
          const nMin = parseInt(String(bMin || '0').replace(/[^0-9]/g, ''), 10) || 0;
          const nMax = parseInt(String(bMax || '0').replace(/[^0-9]/g, ''), 10) || 0;
          if (nMin > 0 && nMax > 0) budget = `₹${nMin.toLocaleString('en-IN')} - ₹${nMax.toLocaleString('en-IN')}`;
          else if (nMin > 0) budget = `From ₹${nMin.toLocaleString('en-IN')}`;
          else if (nMax > 0) budget = `Up to ₹${nMax.toLocaleString('en-IN')}`;
        } else if (bSingle) {
          budget = bSingle.substring(0, 100);
        }

        // Category & Telecaller
        const category = pick(row, ['preferred_shopping_category']) || 'Wedding Shopping';
        const telecallerNameRaw = pick(row, ['assigned_telecaller']);
        let telecallerId = null;
        let telecallerName = null;
        if (telecallerNameRaw) {
          const matchedTc = telecallerMap.get(telecallerNameRaw.toLowerCase());
          if (matchedTc) {
            telecallerId = matchedTc.id;
            telecallerName = matchedTc.full_name || matchedTc.username;
          } else {
            telecallerName = telecallerNameRaw.substring(0, 150);
          }
        }

        candidates.push({
          rowNo,
          customerName,
          mobile,
          altNumber,
          email,
          weddingDate,
          parsedShopping,
          category,
          familySize: Math.min(Math.max(parseInt(pick(row, ['estimated_family_size']) || '1', 10) || 1, 1), 50),
          budget,
          telecallerName,
          telecallerId,
          notes: pick(row, ['customer_notes']),
          followUp: parseDate(pick(row, ['followup_call_date'])) || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
          storeKey: allowRowLocations ? pick(row, ['store_location']) : null
        });
      }

      // Phase B: Duplicate checking against CRM database
      const existingByMobile = new Map();
      const candidateMobiles = candidates.map((c) => c.mobile);
      for (let i = 0; i < candidateMobiles.length; i += 800) {
        const chunk = candidateMobiles.slice(i, i + 800);
        if (chunk.length === 0) continue;
        const [dupRows] = await pool.query(
          'SELECT mobile_number, customer_code FROM wedding_customers WHERE mobile_number IN (?) AND is_deleted = 0',
          [chunk]
        );
        (dupRows || []).forEach((r) => existingByMobile.set(r.mobile_number, r.customer_code));
      }

      const ready = [];
      candidates.forEach((c) => {
        const existingCode = existingByMobile.get(c.mobile);
        if (existingCode) {
          duplicates++;
          errors.push({
            row: c.rowNo,
            customerName: c.customerName,
            mobile: c.mobile,
            reason: `Mobile ${c.mobile} already registered in CRM (${existingCode})`
          });
        } else {
          ready.push(c);
        }
      });

      // Phase C: Generate Customer Codes
      const seqByLoc = new Map();
      const insertRows = [];

      for (const c of ready) {
        let rowLocation = defaultLocationId;
        if (c.storeKey) {
          const key = String(c.storeKey).trim().toLowerCase();
          const matched = locationMap.get(key);
          if (matched) rowLocation = matched.id;
        }

        const shoppingDate = c.parsedShopping || null;

        const locObj = locationMap.get(String(rowLocation));
        const locCode = locObj?.location_code || 'BSC';

        if (!seqByLoc.has(rowLocation)) {
          const [yearRows] = await pool.query(
            'SELECT customer_code FROM wedding_customers WHERE customer_code LIKE ? ORDER BY id DESC LIMIT 1',
            [`%WED-${locCode}-${new Date().getFullYear()}-%`]
          );
          let s = 0;
          if (yearRows && yearRows[0]) {
            const match = String(yearRows[0].customer_code).match(/(\d+)$/);
            if (match) s = parseInt(match[1], 10) || 0;
          }
          seqByLoc.set(rowLocation, s);
        }
        const nextSeq = seqByLoc.get(rowLocation) + 1;
        seqByLoc.set(rowLocation, nextSeq);
        const customerCode = `WED-${locCode}-${new Date().getFullYear()}-${String(nextSeq).padStart(4, '0')}`;

        insertRows.push({
          rowNo: c.rowNo,
          customerName: c.customerName,
          mobile: c.mobile,
          customerCode,
          params: [
            customerCode,
            rowLocation,
            c.customerName,
            c.mobile,
            c.altNumber,
            c.email,
            c.weddingDate,
            shoppingDate,
            String(c.category).substring(0, 150),
            c.familySize,
            c.budget,
            c.telecallerName ? String(c.telecallerName).substring(0, 150) : null,
            c.telecallerId,
            c.followUp,
            encryptField(c.notes ? String(c.notes).substring(0, 5000).trim() : null),
            'New',
            'Pending',
            user.fullName || user.username || 'Google Sheets Import',
            user.id || null
          ]
        });
      }

      // Phase D: Database Transaction Insert
      let imported = 0;
      const inserted = [];

      if (insertRows.length > 0) {
        const INSERT_SQL = `
          INSERT INTO wedding_customers (
            customer_code, location_id, customer_name, mobile_number, alternate_mobile, email,
            wedding_date, expected_shopping_date, preferred_shopping_category,
            estimated_family_size, budget, assigned_telecaller, assigned_telecaller_id, follow_up_date,
            customer_notes, customer_status, call_status, created_by, created_by_user_id
          ) VALUES ?`;

        conn = await pool.getConnection();
        await conn.beginTransaction();

        const CHUNK = 150;
        for (let i = 0; i < insertRows.length; i += CHUNK) {
          const slice = insertRows.slice(i, i + CHUNK);
          try {
            await conn.query(INSERT_SQL, [slice.map((r) => r.params)]);
            imported += slice.length;
            slice.forEach((r) => inserted.push(r.customerCode));
          } catch (chunkErr) {
            for (const r of slice) {
              try {
                await conn.query(INSERT_SQL, [[r.params]]);
                imported++;
                inserted.push(r.customerCode);
              } catch (rowErr) {
                errors.push({
                  row: r.rowNo,
                  customerName: r.customerName,
                  mobile: r.mobile,
                  reason: `Database insert failed: ${rowErr.message}`
                });
              }
            }
          }
        }
        await conn.commit();
      }

      // Phase E: Audit Trail & Import History
      const summary = `${imported} customers imported, ${duplicates} duplicates skipped, ${errors.length} errors.`;
      const fileNameLabel = `Google Sheet: ${spreadsheetTitle} (${sheetName})`;

      try {
        await pool.query(
          `INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details)
           VALUES (NULL, ?, ?, 'Google Sheets Import', ?)`,
          [defaultLocationId, user.fullName || user.username || 'Google Sheets', `${summary} [${fileNameLabel}]`]
        );
      } catch (auditErr) {
        console.warn('[GoogleImport] Audit log warning:', auditErr.message);
      }

      let importId = null;
      const importStatus = errors.length > 0
        ? (imported === 0 ? 'Failed' : 'Completed with Errors')
        : 'Completed';
      const serverTimestamp = new Date().toISOString();

      try {
        const [locRow] = await pool.query('SELECT location_name FROM locations WHERE id = ?', [defaultLocationId]);
        const [logRes] = await pool.query(
          `INSERT INTO wedding_import_logs
             (file_name, file_type, location_id, location_name, user_id, user_name,
              total_rows, imported_count, duplicate_count, error_count, status, summary, created_at)
           VALUES (?, 'google_sheets', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            fileNameLabel.substring(0, 255),
            defaultLocationId,
            locRow && locRow[0] ? locRow[0].location_name : null,
            user.id || null,
            user.fullName || user.username || null,
            objects.length,
            imported,
            duplicates,
            errors.length,
            importStatus,
            summary
          ]
        );
        importId = logRes.insertId;
      } catch (logErr) {
        console.warn('[GoogleImport] Import log insert warning:', logErr.message);
      }

      const processingTimeMs = Date.now() - importStartTime;
      const processingTime = (processingTimeMs / 1000).toFixed(2) + 's';
      const selectedLoc = (locationsList || []).find((l) => Number(l.id) === Number(defaultLocationId));
      const storeBranch = selectedLoc ? selectedLoc.location_name : 'Selected Branch';

      return successRes(res, {
        importId,
        importedCount: imported,
        imported,
        duplicateCount: duplicates,
        duplicates,
        errorCount: errors.length,
        failed: errors.length,
        warningCount: warnings.length,
        totalRows: objects.length,
        processingTimeMs,
        processingTime,
        storeBranch,
        store: storeBranch,
        fileName: fileNameLabel,
        filename: fileNameLabel,
        sheetTitle: spreadsheetTitle,
        sheetName,
        status: importStatus,
        uploadedAt: serverTimestamp,
        uploaded_at: serverTimestamp,
        createdAt: serverTimestamp,
        created_at: serverTimestamp,
        insertedCodes: inserted.slice(0, 100),
        errors: errors.sort((a, b) => (a.row || 0) - (b.row || 0)),
        warnings: warnings.sort((a, b) => (a.row || 0) - (b.row || 0)),
        summary
      }, summary);
    } catch (err) {
      if (conn) {
        try { await conn.rollback(); } catch (rbErr) {}
      }
      console.error('[GoogleSheets.importSheet Error]', err);
      return errorRes(res, 'Failed to import Google Sheet records: ' + err.message, [err.message], 500);
    } finally {
      if (conn) {
        try { conn.release(); } catch (relErr) {}
      }
    }
  }
}

module.exports = new GoogleSheetsController();
