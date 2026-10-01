/**
 * Real-time Data Synchronization Service
 * Manages Socket.IO connection lifecycle, room subscriptions, role/location isolation,
 * and standard entity-level data change broadcasts.
 */

const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../utils/secrets');
const pool = require('../config/db');

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
 * Is this socket's user entitled to the given store?
 *
 * The requested location used to be taken straight from the handshake query, so any
 * page could subscribe to another store's live feed by naming it. Token claims answer
 * first (cheap, covers the normal case); the `user_locations` grant is consulted when
 * the claims don't cover it, because a token issued before a store was assigned to the
 * user would otherwise deny access they genuinely have.
 *
 * @returns {Promise<boolean>}
 */
async function isAuthorizedForLocation(data, locId) {
  const target = parseLocationId(locId);
  if (!target) return false;
  if (data && data.isGlobalAdmin) return true;
  if (data && Number(data.locationId) === target) return true;
  const allowed = data && Array.isArray(data.allowedLocations) ? data.allowedLocations.map(Number) : [];
  if (allowed.includes(target)) return true;
  if (!data || !data.userId) return false;
  try {
    const [rows] = await pool.query('SELECT location_id FROM user_locations WHERE user_id = ?', [data.userId]);
    return (rows || []).some((r) => Number(r.location_id) === target);
  } catch (err) {
    // Unverifiable means unauthorized.
    console.warn('[RealtimeService] Location grant lookup failed:', err.message);
    return false;
  }
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
      const isAdminRole = ['Admin', 'Super Admin'].includes(decoded.role);
      socket.data.isGlobalAdmin = decoded.role === 'Super Admin' || (isAdminRole && (!decoded.locationId || decoded.isGlobalAdmin === true));
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

    // Allow client to join an explicit location room, only if authorized for it.
    // The claim check used to compare a parsed number against token strings, so
    // `allowedLocations: ['2']` never matched and the user could not switch to a
    // store they are assigned to; the grant table is consulted as well now.
    socket.on('join_location', async (locId) => {
      const parsed = parseLocationId(locId);
      if (!parsed) {
        if (data.isGlobalAdmin) socket.join('location:ALL');
        return;
      }
      if (!await isAuthorizedForLocation(data, parsed)) return;

      // Only one browsed store at a time, so events from the store the user switched
      // away from stop arriving. Rooms the account is entitled to by default are kept,
      // because leaving one would silently cut a legitimate live feed.
      const inherent = new Set([data.locationId, ...(Array.isArray(data.allowedLocations) ? data.allowedLocations.map(Number) : [])].filter(Boolean));
      if (data.viewedLocation && data.viewedLocation !== parsed && !inherent.has(data.viewedLocation)) {
        socket.leave(`location:${data.viewedLocation}`);
      }
      data.viewedLocation = parsed;
      socket.join(`location:${parsed}`);
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
    const target = locId ? `location:${locId}` : null;
    const rooms = [];

    // If restricted by role
    if (Array.isArray(roles) && roles.length > 0) {
      roles.forEach(role => rooms.push(`role:${role}`));
    } else if (target) {
      // Emit to matching location room AND to Global Admins room
      rooms.push(target, 'location:ALL');
    }

    const names = [eventName, legacyEvent].filter(Boolean);

    if (rooms.length === 0) {
      // Genuinely system-wide change (no store, no role restriction).
      names.forEach(name => ioInstance.emit(name, payload));
      return;
    }

    names.forEach(name => {
      // Chained .to() is one delivery per socket, even for a socket sitting in
      // several of these rooms.
      const target = rooms.reduce((acc, room) => acc.to(room), ioInstance);
      target.emit(name, payload);
    });
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
    emitToAdmins('permissions:update', payload);
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

/**
 * "Tell Caller" instruction. One event name for every transition so the desk only
 * needs one subscription; the payload carries which one happened. Delivered to the
 * recipient's own room, their store room, and the global-admin room.
 */
function emitTelecallerInstruction(action, instruction = {}) {
  if (!ioInstance) return;
  const payload = {
    entity: 'TELECALLER_INSTRUCTION',
    action: String(action || 'CREATE').toUpperCase(),
    id: instruction.id ? String(instruction.id) : null,
    locationId: parseLocationId(instruction.location_id),
    meta: {
      customer_id: instruction.customer_id ?? null,
      customer_name: instruction.customer_name ?? null,
      telecaller_user_id: instruction.telecaller_user_id ?? null,
      status: instruction.status ?? null,
      priority: instruction.priority ?? null
    },
    timestamp: new Date().toISOString()
  };
  const rooms = [];
  if (payload.meta.telecaller_user_id) rooms.push(`user:${payload.meta.telecaller_user_id}`);
  if (payload.locationId) rooms.push(`location:${payload.locationId}`);
  rooms.push('location:ALL');
  try {
    rooms.reduce((acc, room) => acc.to(room), ioInstance).emit('telecaller_instruction:changed', payload);
  } catch (err) {
    console.warn('[RealtimeService] Failed to emit instruction event:', err.message);
  }
}

function emitWeddingChange(action, customer = {}, locationId = null) {  emitEntityChange({
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

/**
 * Broadcast changes for one store.
 *
 * These used to be bare `io.emit(...)` calls, so a Belagavi announcement pushed to
 * every connected browser in every store, and the live TV screen never heard it at
 * all because it listens for the lowercase `broadcast:*` names this service uses.
 * Room-targeting fixes both: only the store the broadcast is addressed to (plus
 * global admins) is notified.
 *
 * @param {'CREATE'|'UPDATE'|'DELETE'|'CANCEL'|'EXPIRE'|'ACKNOWLEDGE'} action
 */
function emitBroadcastChange(action, broadcast = {}, meta = {}) {
  emitEntityChange({
    entity: 'BROADCAST',
    action,
    id: broadcast.id || broadcast.broadcastId || null,
    locationId: broadcast.location_id || broadcast.locationId || null,
    meta: {
      title: broadcast.title || broadcast.message || null,
      targetLocations: broadcast.target_locations || broadcast.targetLocations || null,
      ...meta
    }
  });
}

/**
 * Send one payload to every event name, scoped to the store it belongs to.
 *
 * A change with no store attached is genuinely system-wide and still goes to
 * everyone; anything tied to a location is delivered to that location's room plus
 * the global-admin room. This is what stops a correction made in Belagavi from
 * waking every screen in Davanagere and Shivamogga.
 */
function emitToLocationRooms(eventNames, payload, locId) {
  if (!ioInstance) return;
  const names = Array.isArray(eventNames) ? eventNames : [eventNames];
  const target = parseLocationId(locId);
  try {
    names.forEach((name) => {
      if (!name) return;
      if (target) {
        // One call with both rooms: Socket.IO delivers once per socket even when the
        // socket is in both rooms. Two separate calls handed global admins a
        // duplicate, which made screens refetch twice per change.
        ioInstance.to(`location:${target}`).to('location:ALL').emit(name, payload);
      } else {
        ioInstance.emit(name, payload);
      }
    });
  } catch (err) {
    console.warn(`[RealtimeService] Failed to emit ${names.join(', ')}:`, err.message);
  }
}

const ADMIN_ROLE_ROOMS = ['role:Admin', 'role:Super Admin', 'role:system administrator'];

/**
 * A policy change every browser must apply immediately (currently the developer-tools
 * shield toggle). The payload carries no one's data — broadcasting it is the point.
 */
function emitToAll(eventNames, payload) {
  if (!ioInstance) return;
  const names = Array.isArray(eventNames) ? eventNames : [eventNames];
  try {
    names.forEach((name) => { if (name) ioInstance.emit(name, payload); });
  } catch (err) {
    console.warn(`[RealtimeService] Failed to broadcast ${names.join(', ')}:`, err.message);
  }
}

/**
 * Admin-only push (security incidents, access requests).
 *
 * These payloads carry another person's username, IP address and device details.
 * Emitting them to every connected browser handed that to ordinary staff accounts
 * and to public kiosk screens, which is not who the event is for.
 */
function emitToAdmins(eventNames, payload) {
  if (!ioInstance) return;
  const names = Array.isArray(eventNames) ? eventNames : [eventNames];
  try {
    names.forEach((name) => {
      if (!name) return;
      ADMIN_ROLE_ROOMS.reduce((acc, room) => acc.to(room), ioInstance).emit(name, payload);
    });
  } catch (err) {
    console.warn(`[RealtimeService] Failed to emit ${names.join(', ')} to admins:`, err.message);
  }
}

/**
 * Push a saved footfall entry to the screens that show it.
 *
 * The Footfall page and the live TV board read the flat fields (entryDate,
 * slotHour, visitors, remarks, submittedBy) rather than an entity envelope, so the
 * saved row is passed through as-is under both the legacy and the canonical name.
 */
function emitFootfallUpdate(payload = {}) {
  const locId = payload.location_id ?? payload.locationId ?? null;
  emitToLocationRooms(['footfall:updated', 'footfall:update'], payload, locId);
}

function emitVmChange(action, audit = {}, locationId = null) {
  emitEntityChange({
    entity: 'VM',
    action: (action || 'UPDATE').toUpperCase(),
    id: audit.id || audit.submissionId,
    locationId: locationId || audit.location_id || audit.locationId || null,
    meta: {
      floor: audit.floor,
      section: audit.section,
      scorePercent: audit.scorePercent,
      status: audit.status || 'Completed'
    },
    legacyEvent: 'vm:updated'
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
  emitTelecallerInstruction,
  emitWeddingRegistrationChange,
  emitFeedbackChange,
  emitCallQueueChange,
  emitQrChange,
  emitFootfallChange,
  emitDivertChange,
  emitBroadcastChange,
  emitFootfallUpdate,
  emitToLocationRooms,
  emitToAdmins,
  emitToAll,
  emitVmChange,
  isAuthorizedForLocation
};
