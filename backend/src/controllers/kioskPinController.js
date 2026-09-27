/**
 * BSC Textiles Portal — Kiosk PIN Controller
 * Secure management of store kiosk and cash PINs.
 * PINs are stored as bcrypt hashes — never displayed in plaintext.
 */

const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { successRes, errorRes } = require('../utils/response');
const auditService = require('../services/auditService');

// PIN types supported by the system
const PIN_TYPES = ['greeter', 'tv', 'cash', 'kiosk', 'manager'];

// ── List all PINs (status only, never plaintext) ─────────────────────
const listPins = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, pin_type, location_id, status, last_changed_at, last_changed_by, created_at,
              l.location_name
       FROM kiosk_pins kp
       LEFT JOIN locations l ON l.id = kp.location_id
       ORDER BY kp.pin_type, kp.location_id`
    );
    return successRes(res, { pins: rows }, 'PINs retrieved');
  } catch (err) {
    // Table might not exist yet — return empty
    return successRes(res, { pins: [] }, 'PINs retrieved (table may not exist)');
  }
};

// ── Create or rotate a PIN ───────────────────────────────────────────
const upsertPin = async (req, res) => {
  try {
    const { pinType, pin, locationId } = req.body;

    if (!pinType || !PIN_TYPES.includes(pinType)) {
      return errorRes(res, `Invalid PIN type. Must be one of: ${PIN_TYPES.join(', ')}`, [], 400);
    }
    if (!pin || pin.length < 4 || pin.length > 10) {
      return errorRes(res, 'PIN must be 4-10 characters', [], 400);
    }

    const resolvedLocationId = locationId || null;
    const hashedPin = await bcrypt.hash(pin, 12);
    const changedBy = req.user?.username || 'Admin';

    // Check if exists
    const [existing] = await pool.query(
      'SELECT id FROM kiosk_pins WHERE pin_type = ? AND (location_id = ? OR (location_id IS NULL AND ? IS NULL))',
      [pinType, resolvedLocationId, resolvedLocationId]
    );

    if (existing.length > 0) {
      await pool.query(
        `UPDATE kiosk_pins SET pin_hash = ?, status = 'Active', last_changed_at = NOW(), last_changed_by = ?
         WHERE id = ?`,
        [hashedPin, changedBy, existing[0].id]
      );

      await auditService.log({
        req,
        action: auditService.AuditEvents.PIN_ROTATE,
        module: 'KioskPins',
        details: { pinType, locationId: resolvedLocationId },
        targetId: existing[0].id,
        targetType: 'KioskPin'
      });

      return successRes(res, {}, 'PIN rotated successfully');
    } else {
      const [result] = await pool.query(
        `INSERT INTO kiosk_pins (pin_type, pin_hash, location_id, status, last_changed_at, last_changed_by)
         VALUES (?, ?, ?, 'Active', NOW(), ?)`,
        [pinType, hashedPin, resolvedLocationId, changedBy]
      );

      await auditService.log({
        req,
        action: auditService.AuditEvents.PIN_CREATE,
        module: 'KioskPins',
        details: { pinType, locationId: resolvedLocationId },
        targetId: result.insertId,
        targetType: 'KioskPin'
      });

      return successRes(res, { id: result.insertId }, 'PIN created successfully');
    }
  } catch (err) {
    return errorRes(res, 'Failed to save PIN', [err.message], 500);
  }
};

// ── Verify a PIN ─────────────────────────────────────────────────────
const verifyPin = async (req, res) => {
  try {
    const { pinType, pin, locationId } = req.body;

    if (!pinType || !pin) {
      return errorRes(res, 'PIN type and PIN value are required', [], 400);
    }

    let query = 'SELECT pin_hash, status FROM kiosk_pins WHERE pin_type = ? AND status = ?';
    const params = [pinType, 'Active'];

    if (locationId) {
      query += ' AND (location_id = ? OR location_id IS NULL)';
      params.push(locationId);
    }

    const [rows] = await pool.query(query, params);
    if (rows.length === 0) {
      return errorRes(res, 'No active PIN found for this type', [], 404);
    }

    const isValid = await bcrypt.compare(pin, rows[0].pin_hash);
    if (!isValid) {
      return errorRes(res, 'Invalid PIN', [], 401);
    }

    return successRes(res, { valid: true }, 'PIN verified');
  } catch (err) {
    return errorRes(res, 'PIN verification failed', [err.message], 500);
  }
};

// ── Revoke a PIN ─────────────────────────────────────────────────────
const revokePin = async (req, res) => {
  try {
    const { id } = req.params;

    const [[pin]] = await pool.query('SELECT id, pin_type, location_id FROM kiosk_pins WHERE id = ?', [id]);
    if (!pin) {
      return errorRes(res, 'PIN not found', [], 404);
    }

    await pool.query(
      `UPDATE kiosk_pins SET status = 'Revoked', last_changed_at = NOW(), last_changed_by = ? WHERE id = ?`,
      [req.user?.username || 'Admin', id]
    );

    await auditService.log({
      req,
      action: auditService.AuditEvents.PIN_REVOKE,
      module: 'KioskPins',
      details: { pinType: pin.pin_type, locationId: pin.location_id },
      targetId: id,
      targetType: 'KioskPin'
    });

    return successRes(res, {}, 'PIN revoked successfully');
  } catch (err) {
    return errorRes(res, 'Failed to revoke PIN', [err.message], 500);
  }
};

module.exports = {
  listPins,
  upsertPin,
  verifyPin,
  revokePin,
  PIN_TYPES
};
