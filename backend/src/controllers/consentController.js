const pool = require('../config/db');
const { successRes, errorRes } = require('../utils/response');

// Current policy versions — bump these when policies are updated
const CURRENT_PRIVACY_POLICY_VERSION = '1.0';
const CURRENT_TERMS_VERSION = '1.0';

class ConsentController {
  /**
   * GET /api/consent/status
   * Returns the user's current consent status and whether they need to accept new versions.
   */
  async getStatus(req, res) {
    try {
      const username = req.user?.username;
      const userId = req.user?.id;
      if (!username) return errorRes(res, 'Authentication required', [], 401);

      // Get current policy versions
      const [ppVersion] = await pool.query(
        'SELECT version FROM policy_versions WHERE policy_type = ? AND is_current = 1 LIMIT 1',
        ['privacy_policy']
      );
      const [tVersion] = await pool.query(
        'SELECT version FROM policy_versions WHERE policy_type = ? AND is_current = 1 LIMIT 1',
        ['terms']
      );

      const currentPPVersion = ppVersion?.[0]?.version || CURRENT_PRIVACY_POLICY_VERSION;
      const currentTVersion = tVersion?.[0]?.version || CURRENT_TERMS_VERSION;

      // Get user's consent record
      const [consents] = await pool.query(
        'SELECT * FROM user_consents WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
        [userId]
      );

      const consent = consents?.[0];

      // Check if user has accepted current versions
      const ppAccepted = consent?.privacy_policy_accepted === 1 &&
                         consent?.privacy_policy_version === currentPPVersion;
      const tAccepted = consent?.terms_accepted === 1 &&
                        consent?.terms_version === currentTVersion;
      const fullyConsented = ppAccepted && tAccepted;

      return successRes(res, {
        consented: fullyConsented,
        privacyPolicy: {
          accepted: ppAccepted,
          version: currentPPVersion,
          acceptedVersion: consent?.privacy_policy_version || null,
          acceptedAt: consent?.privacy_policy_accepted_at || null
        },
        terms: {
          accepted: tAccepted,
          version: currentTVersion,
          acceptedVersion: consent?.terms_version || null,
          acceptedAt: consent?.terms_accepted_at || null
        },
        consentStatus: consent?.consent_status || 'pending'
      }, 'Consent status retrieved');
    } catch (err) {
      console.error('[ConsentController.getStatus]', err.message);
      return errorRes(res, 'Failed to check consent status', [err.message], 500);
    }
  }

  /**
   * POST /api/consent/accept
   * Records the user's consent for privacy policy and/or terms.
   */
  async accept(req, res) {
    try {
      const username = req.user?.username;
      const userId = req.user?.id;
      if (!username) return errorRes(res, 'Authentication required', [], 401);

      const { privacyPolicyAccepted, termsAccepted } = req.body || {};

      if (!privacyPolicyAccepted || !termsAccepted) {
        return errorRes(res, 'Both Privacy Policy and Terms must be accepted', [], 400);
      }

      // Get current policy versions
      const [ppVersion] = await pool.query(
        'SELECT version FROM policy_versions WHERE policy_type = ? AND is_current = 1 LIMIT 1',
        ['privacy_policy']
      );
      const [tVersion] = await pool.query(
        'SELECT version FROM policy_versions WHERE policy_type = ? AND is_current = 1 LIMIT 1',
        ['terms']
      );

      const currentPPVersion = ppVersion?.[0]?.version || CURRENT_PRIVACY_POLICY_VERSION;
      const currentTVersion = tVersion?.[0]?.version || CURRENT_TERMS_VERSION;

      // Check if already accepted current versions
      const [existing] = await pool.query(
        'SELECT * FROM user_consents WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
        [userId]
      );

      const consent = existing?.[0];
      const alreadyAccepted = consent?.privacy_policy_accepted === 1 &&
                              consent?.privacy_policy_version === currentPPVersion &&
                              consent?.terms_accepted === 1 &&
                              consent?.terms_version === currentTVersion;

      if (alreadyAccepted) {
        return successRes(res, { alreadyAccepted: true }, 'Consent already accepted for current versions');
      }

      // Insert or update consent record
      const ip = req.ip || req.connection?.remoteAddress;
      const userAgent = req.headers['user-agent'];

      if (consent) {
        // Update existing record
        await pool.query(
          `UPDATE user_consents SET
            privacy_policy_accepted = 1,
            privacy_policy_version = ?,
            privacy_policy_accepted_at = NOW(),
            terms_accepted = 1,
            terms_version = ?,
            terms_accepted_at = NOW(),
            consent_status = 'accepted',
            ip_address = ?,
            user_agent = ?,
            updated_at = NOW()
          WHERE id = ?`,
          [currentPPVersion, currentTVersion, ip, userAgent, consent.id]
        );
      } else {
        // Insert new record
        await pool.query(
          `INSERT INTO user_consents
            (user_id, username, privacy_policy_accepted, privacy_policy_version, privacy_policy_accepted_at,
             terms_accepted, terms_version, terms_accepted_at, consent_status, ip_address, user_agent)
           VALUES (?, ?, 1, ?, NOW(), 1, ?, NOW(), 'accepted', ?, ?)`,
          [userId, username, currentPPVersion, currentTVersion, ip, userAgent]
        );
      }

      // Log to audit
      try {
        await pool.query(
          `INSERT INTO audit_logs (username, user_id, action, module, details, ip_address, user_agent, success)
           VALUES (?, ?, 'CONSENT_ACCEPTED', 'Consent', ?, ?, ?, 1)`,
          [
            username, userId,
            JSON.stringify({ privacyPolicyVersion: currentPPVersion, termsVersion: currentTVersion }),
            ip, userAgent
          ]
        );
      } catch (e) { /* non-blocking */ }

      return successRes(res, {
        privacyPolicyVersion: currentPPVersion,
        termsVersion: currentTVersion,
        acceptedAt: new Date().toISOString()
      }, 'Consent accepted successfully');
    } catch (err) {
      console.error('[ConsentController.accept]', err.message);
      return errorRes(res, 'Failed to record consent', [err.message], 500);
    }
  }

  /**
   * GET /api/consent/policy-versions
   * Returns current policy versions (public).
   */
  async getPolicyVersions(req, res) {
    try {
      const [ppVersion] = await pool.query(
        'SELECT version, title FROM policy_versions WHERE policy_type = ? AND is_current = 1 LIMIT 1',
        ['privacy_policy']
      );
      const [tVersion] = await pool.query(
        'SELECT version, title FROM policy_versions WHERE policy_type = ? AND is_current = 1 LIMIT 1',
        ['terms']
      );

      return successRes(res, {
        privacyPolicy: {
          version: ppVersion?.[0]?.version || CURRENT_PRIVACY_POLICY_VERSION,
          title: ppVersion?.[0]?.title || 'Privacy Policy'
        },
        terms: {
          version: tVersion?.[0]?.version || CURRENT_TERMS_VERSION,
          title: tVersion?.[0]?.title || 'Terms and Conditions'
        }
      }, 'Policy versions retrieved');
    } catch (err) {
      console.error('[ConsentController.getPolicyVersions]', err.message);
      return successRes(res, {
        privacyPolicy: { version: CURRENT_PRIVACY_POLICY_VERSION, title: 'Privacy Policy' },
        terms: { version: CURRENT_TERMS_VERSION, title: 'Terms and Conditions' }
      }, 'Policy versions retrieved (fallback)');
    }
  }

  /**
   * GET /api/consent/admin/user-consents
   * Admin: List all user consent records.
   */
  async getUserConsents(req, res) {
    try {
      const { username, status, limit = 100, offset = 0 } = req.query;
      let where = 'WHERE 1=1';
      const params = [];

      if (username) { where += ' AND username LIKE ?'; params.push(`%${username}%`); }
      if (status) { where += ' AND consent_status = ?'; params.push(status); }

      const safeLimit = Math.min(parseInt(limit) || 100, 500);
      const safeOffset = Math.max(parseInt(offset) || 0, 0);

      const [rows] = await pool.query(
        `SELECT * FROM user_consents ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
        [...params, safeLimit, safeOffset]
      );
      const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) as total FROM user_consents ${where}`,
        params
      );

      return successRes(res, { data: rows, total, limit: safeLimit, offset: safeOffset }, 'User consents retrieved');
    } catch (err) {
      console.error('[ConsentController.getUserConsents]', err.message);
      return errorRes(res, 'Failed to retrieve user consents', [err.message], 500);
    }
  }
}

module.exports = new ConsentController();
