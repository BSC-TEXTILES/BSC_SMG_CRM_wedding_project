/**
 * Real-time Data Synchronization Service
 * Manages Socket.IO connection lifecycle, room subscriptions, role/location isolation,
 * and standard entity-level data change broadcasts.
 */

const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../utils/secrets');

let ioInstance = null;

/**
 * Maps location codes to location IDs
 */
const LOCATION_CODE_MAP = {
  'BEL': 1,
  'DAV': 2,
  'SHI': 3
};

/**
 * Parse a location ID safely
 */
function parseLocationId(val) {
  if (val === undefined || val === null || val === '' || val === 'ALL' || val === 'all') return null;
  const num = parseInt(val, 10);
  if (!isNaN(num)) return num;
  if (typeof val === 'string') {
    return LOCATION_CODE_MAP[val.trim().toUpperCase()] || null;
  }
  return null;
}

/**
 * Initialize Socket.IO instance and register middleware & room handlers
 */
function init(io) {
  ioInstance = io;

  // Socket Authentication Middleware
  io.use((socket, next) => {
    try {
      // Extract token from auth handshake, x-auth-token header, query, or cookies
      let token = socket.handshake.auth?.token || socket.handshake.headers?.['x-auth-token'];
      
      if (!token && socket.handshake.headers?.authorization) {
        const parts = socket.handshake.headers.authorization.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
          token = parts[1];
        }
      }

      if (!token && socket.handshake.headers?.cookie) {
        const cookies = socket.handshake.headers.cookie.split(';');
        for (const cookie of cookies) {
          const [name, val] = cookie.trim().split('=');
          if (name === 'token') {
            token = decodeURIComponent(val);
            break;
          }
        }
      }

      if (!token) {
        // Allow guest / kiosk connections (TV Display, Greeter, Public forms)
        // They will join only public or location-specific display rooms
        socket.data.isGuest = true;
        socket.data.role = 'Guest';
        socket.data.locationId = parseLocationId(socket.handshake.query?.locationId);
        return next();
      }

      const decoded = jwt.verify(token, getJwtSecret());
      socket.data.user = decoded;
      socket.data.userId = decoded.id;
      socket.data.role = decoded.role || 'Staff';
      socket.data.locationId = parseLocationId(decoded.locationId);
      socket.data.isGlobalAdmin = !decoded.locationId || decoded.isGlobalAdmin || ['Admin', 'Super Admin'].includes(decoded.role);
      socket.data.allowedLocations = Array.isArray(decoded.allowedLocations) ? decoded.allowedLocations : [];

      next();
    } catch (err) {
      // If token is invalid, degrade to guest rather than killing connection
      socket.data.isGuest = true;
      socket.data.role = 'Guest';
      socket.data.locationId = parseLocationId(socket.handshake.query?.locationId);
      next();
    }
  });

  io.on('connection', (socket) => {
    const data = socket.data;

    // Join personal user room
    if (data.userId) {
      socket.join(`user:${data.userId}`);
    }

    // Join role room
    if (data.role) {
      socket.join(`role:${data.role}`);
    }

    // Join location rooms
    if (data.isGlobalAdmin) {
      // Global Admins receive all location streams
      socket.join('location:ALL');
      socket.join('location:1');
      socket.join('location:2');
      socket.join('location:3');
    } else {
      if (data.locationId) {
        socket.join(`location:${data.locationId}`);
      }
      if (Array.isArray(data.allowedLocations)) {
        data.allowedLocations.forEach(locId => {
          if (locId) socket.join(`location:${locId}`);
        });
      }
    }

    // Allow client to join explicit location room if authorized
    socket.on('join_location', (locId) => {
      const parsed = parseLocationId(locId);
      if (!parsed) {
        if (data.isGlobalAdmin) socket.join('location:ALL');
        return;
      }
      if (data.isGlobalAdmin || data.locationId === parsed || (data.allowedLocations && data.allowedLocations.includes(parsed))) {
        socket.join(`location:${parsed}`);
      }
    });

    socket.on('disconnect', () => {
      // Cleanup handled automatically by socket.io
    });
  });

  console.log('[RealtimeService] Socket.io real-time engine initialized with location & role isolation');
}

/**
 * Get Socket.IO instance
 */
function getIo() {
  return ioInstance;
}

/**
 * Emit a section data change event
 *
 * @param {Object} options
 * @param {string} options.entity - 'USER', 'EMPLOYEE', 'CANDIDATE', 'WEDDING', 'FEEDBACK', 'QR', 'FOOTFALL', 'DIVERT', etc.
 * @param {string} options.action - 'CREATE', 'UPDATE', 'DELETE', 'STATUS', 'SCAN', 'CALL_LOGGED'
 * @param {number|string|null} [options.locationId] - Location ID (1, 2, 3 or null for global)
 * @param {string|number} [options.id] - Entity record ID
 * @param {Object} [options.meta] - Additional metadata for the section (no sensitive raw DB rows)
 * @param {string[]} [options.roles] - Target roles (if restricted, e.g. ['Admin', 'Super Admin'])
 * @param {string} [options.legacyEvent] - Optional legacy event name to emit for backwards compatibility
 */
function emitEntityChange({ entity, action, locationId = null, id = null, meta = {}, roles = null, legacyEvent = null }) {
  if (!ioInstance) return;

  const eventName = `${entity.toLowerCase()}:${action.toLowerCase()}`;
  const payload = {
    entity: entity.toUpperCase(),
    action: action.toUpperCase(),
    locationId: parseLocationId(locationId),
    id: id ? String(id) : null,
    meta,
    timestamp: new Date().toISOString()
  };

  try {
    const locId = parseLocationId(locationId);

    // If restricted by role
    if (Array.isArray(roles) && roles.length > 0) {
      roles.forEach(role => {
        ioInstance.to(`role:${role}`).emit(eventName, payload);
        if (legacyEvent) ioInstance.to(`role:${role}`).emit(legacyEvent, payload);
      });
      return;
    }

    // If restricted by location
    if (locId) {
      // Emit to matching location room AND to Global Admins room
      ioInstance.to(`location:${locId}`).emit(eventName, payload);
      ioInstance.to('location:ALL').emit(eventName, payload);

      if (legacyEvent) {
        ioInstance.to(`location:${locId}`).emit(legacyEvent, payload);
        ioInstance.to('location:ALL').emit(legacyEvent, payload);
      }
    } else {
      // Global event (e.g. system-wide change)
      ioInstance.emit(eventName, payload);
      if (legacyEvent) {
        ioInstance.emit(legacyEvent, payload);
      }
    }
  } catch (err) {
    console.warn(`[RealtimeService] Failed to emit event ${eventName}:`, err.message);
  }
}

// ── Entity-Specific Helper Dispatchers ────────────────────────────────────────

function emitUserChange(action, user = {}) {
  emitEntityChange({
    entity: 'USER',
    action,
    id: user.id,
    locationId: user.location_id || user.locationId || null,
    meta: {
      username: user.username,
      role: user.role,
      active: user.active
    },
    roles: ['Admin', 'Super Admin']
  });
}

function emitPermissionsChange(userId, meta = {}) {
  if (!ioInstance) return;
  const payload = {
    entity: 'PERMISSIONS',
    action: 'UPDATE',
    userId: String(userId),
    meta,
    timestamp: new Date().toISOString()
  };
  try {
    ioInstance.to(`user:${userId}`).emit('permissions:update', payload);
    ioInstance.to('role:Admin').emit('permissions:update', payload);
    ioInstance.to('role:Super Admin').emit('permissions:update', payload);
    ioInstance.emit('permissions:update', payload);
  } catch (err) {
    console.warn('[RealtimeService] Failed to emit permissions update:', err.message);
  }
}

function emitEmployeeChange(action, employee = {}, locationId = null) {
  emitEntityChange({
    entity: 'EMPLOYEE',
    action,
    id: employee.id || employee.appNo || employee.empNo,
    locationId: locationId || employee.location_id || employee.locationId || null,
    meta: {
      department: employee.department,
      designation: employee.designation,
      status: employee.status
    }
  });
}

function emitCandidateChange(action, candidate = {}, locationId = null) {
  emitEntityChange({
    entity: 'CANDIDATE',
    action,
    id: candidate.appNo || candidate.id,
    locationId: locationId || candidate.location_id || candidate.locationId || null,
    meta: {
      status: candidate.status,
      designation: candidate.designation
    }
  });
}

function emitWeddingChange(action, customer = {}, locationId = null) {
  emitEntityChange({
    entity: 'WEDDING',
    action,
    id: customer.id || customer.customer_code,
    locationId: locationId || customer.location_id || customer.locationId || null,
    meta: {
      customer_status: customer.customer_status,
      call_status: customer.call_status,
      assigned_telecaller: customer.assigned_telecaller
    }
  });
}

function emitWeddingRegistrationChange(action, reg = {}, locationId = null) {
  emitEntityChange({
    entity: 'WEDDING_REG',
    action,
    id: reg.id || reg.registration_id,
    locationId: locationId || reg.location_id || reg.locationId || null,
    meta: {
      status: reg.status,
      customer_name: reg.customer_name
    }
  });
}

function emitFeedbackChange(action, feedback = {}, locationId = null) {
  emitEntityChange({
    entity: 'FEEDBACK',
    action,
    id: feedback.id,
    locationId: locationId || feedback.location_id || feedback.locationId || null,
    meta: {
      isNegative: feedback.isNegative,
      qrCodeId: feedback.qrCodeId
    },
    legacyEvent: action === 'CREATE' ? 'feedback:submitted' : (action === 'DELETE' ? 'feedback:deleted' : 'feedback:cleared')
  });
}

function emitCallQueueChange(action, queueItem = {}, locationId = null) {
  emitEntityChange({
    entity: 'CALLQUEUE',
    action,
    id: queueItem.id || queueItem.feedbackId,
    locationId: locationId || queueItem.location_id || queueItem.locationId || null,
    meta: {
      status: queueItem.status
    },
    legacyEvent: 'callqueue:updated'
  });
}

function emitQrChange(action, qr = {}, locationId = null) {
  emitEntityChange({
    entity: 'QR',
    action,
    id: qr.id || qr.qr_code_id || qr.qrCodeId,
    locationId: locationId || qr.location_id || qr.locationId || null,
    meta: {
      status: qr.status,
      sectionId: qr.section_id || qr.sectionId
    },
    legacyEvent: action === 'SCAN' ? 'qr:scanned' : null
  });
}

function emitFootfallChange(entry = {}, locationId = null) {
  emitEntityChange({
    entity: 'FOOTFALL',
    action: 'UPDATE',
    id: entry.id || `${entry.entryDate}_${entry.slotHour}`,
    locationId: locationId || entry.location_id || entry.locationId || null,
    meta: {
      entryDate: entry.entryDate,
      slotHour: entry.slotHour,
      visitors: entry.visitors
    },
    legacyEvent: 'footfall:updated'
  });
}

function emitDivertChange(divert = {}, locationId = null) {
  emitEntityChange({
    entity: 'DIVERT',
    action: 'CREATE',
    id: divert.id,
    locationId: locationId || divert.location_id || divert.locationId || null,
    meta: {
      productWanted: divert.productWanted,
      quantity: divert.quantity
    },
    legacyEvent: 'divert:created'
  });
}

module.exports = {
  init,
  getIo,
  emitEntityChange,
  emitUserChange,
  emitPermissionsChange,
  emitEmployeeChange,
  emitCandidateChange,
  emitWeddingChange,
  emitWeddingRegistrationChange,
  emitFeedbackChange,
  emitCallQueueChange,
  emitQrChange,
  emitFootfallChange,
  emitDivertChange
};
