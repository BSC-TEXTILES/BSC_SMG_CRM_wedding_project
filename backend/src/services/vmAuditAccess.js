'use strict';

/**
 * VM inspection access — one answer to "may this user act on VM audit evidence?".
 *
 * Until now the same question was answered four different ways: the upload path
 * carried one hardcoded role list, the edit/replace path another, the delete path a
 * third, and the route itself a fourth (`vm_checklist` through the central Access
 * Control Matrix). The lists disagreed, so a store role that an administrator had
 * explicitly granted the VM Checklist module still received "Only authorized VM
 * auditors" from the controller, and an inspector could be refused permission to
 * caption their own photograph.
 *
 * Every VM route and every photo action now asks this module, which in turn asks the
 * same authorizationService the rest of the application uses. Nothing here removes a
 * check: it widens the role family that may inspect the floor, and denies everything
 * else for the same reasons as before.
 */

const { checkPermission, ADMIN_ROLES } = require('./authorizationService');

/** Roles whose job is the physical inspection itself. */
const VM_AUDITOR_ROLES = [
  'vm',
  'vm auditor',
  'vm extension telecaller',
  'vm telecaller',
  'vm executive',
  'visual merchandiser',
  'visual merchandising',
  'merchandiser'
];

/**
 * Store roles that own the checklist result. They inherit the inspector rights and
 * additionally own the destructive ones — an inspector documents the floor, a manager
 * is allowed to withdraw evidence from it.
 */
const VM_MANAGER_ROLES = [
  'manager',
  'store manager',
  'floor manager',
  'department manager',
  'crm manager'
];

const NORMALISED_ADMIN_ROLES = ADMIN_ROLES.map((r) => String(r).trim().toLowerCase().replace(/[_\s-]+/g, ' '));

function normalizeRoleKey(role) {
  return String(role || '').trim().toLowerCase().replace(/[_\s-]+/g, ' ');
}

function isVmAuditorRole(role) {
  const key = normalizeRoleKey(role);
  if (!key) return false;
  // Spelling variants ('VM Auditor', 'Merchandising Executive') must not lock a real
  // inspector out, which is exactly how the old exact-match lists failed in the field.
  return VM_AUDITOR_ROLES.includes(key) || key.split(' ').includes('vm') || key.includes('merchandis');
}

function isVmManagerRole(role) {
  const key = normalizeRoleKey(role);
  if (!key) return false;
  return NORMALISED_ADMIN_ROLES.includes(key) || VM_MANAGER_ROLES.includes(key);
}

/** Anyone whose name is on the VM checklist: inspector or owning manager. */
function isVmInspectionRole(role) {
  return isVmAuditorRole(role) || isVmManagerRole(role);
}

/**
 * The role family entitled to a given action, before the Access Control Matrix is
 * consulted. Deletion is manager-only; everything the inspection itself needs is not.
 */
function roleEntitlementFor(action) {
  return action === 'can_delete' || action === 'can_approve' ? isVmManagerRole : isVmInspectionRole;
}

/**
 * Which denials are the absence of a decision rather than a decision.
 *
 * A row that says `can_add = 0` for the VM checklist is an administrator switching
 * the module off for one account — that is respected for everyone, inspectors
 * included. "No permissions configured for module", "Role X does not have access to
 * module" and the role-default "not permitted for role" lines all mean nobody ever
 * decided, so the role family decides instead. Everything else (deactivated, locked,
 * location denied, unauthenticated) is a real denial and is never overridden.
 */
function isUnconfiguredDenial(reason) {
  const text = String(reason || '');
  return /^No permissions configured for module/i.test(text)
    || /^Role .+ does not have access to module/i.test(text)
    || /^Action .+ not permitted for role/i.test(text);
}

/**
 * Resolve one `vm_checklist` action for one user.
 *
 * The central service is asked first so an explicit administrator decision always
 * wins. Only when the matrix has never been configured for this module does the VM
 * role family decide, which is what lets a newly created Manager or Floor Manager
 * account use the checklist without an admin having to touch anything first.
 *
 * @returns {Promise<{allowed: boolean, reason: string}>}
 */
async function resolveVmPermission(user, action = 'can_view') {
  if (!user || !user.id) {
    return { allowed: false, reason: 'Authentication required' };
  }

  let matrix = null;
  try {
    matrix = await checkPermission(user, { module: 'vm_checklist', action });
  } catch (err) {
    // An unreadable permission table must not become an open door for audit evidence.
    return { allowed: false, reason: `Permission check failed: ${err.message}` };
  }

  if (matrix.allowed) {
    return { allowed: true, reason: matrix.reason || `Permission granted (${action})` };
  }

  if (isUnconfiguredDenial(matrix.reason) && roleEntitlementFor(action)(user.role)) {
    return { allowed: true, reason: 'VM inspection role' };
  }

  return { allowed: false, reason: matrix.reason || `Action ${action} not permitted for the VM checklist` };
}

/** May read audits, floors and photos. */
const canView = (user) => resolveVmPermission(user, 'can_view');
/** May attach a new inspection photograph. */
const canAttachPhotos = (user) => resolveVmPermission(user, 'can_add');
/** May edit or replace an existing inspection photograph. */
const canManagePhotos = (user) => resolveVmPermission(user, 'can_edit');
/** May delete audit evidence. */
const canDeletePhotos = (user) => resolveVmPermission(user, 'can_delete');

module.exports = {
  VM_AUDITOR_ROLES,
  VM_MANAGER_ROLES,
  normalizeRoleKey,
  isVmAuditorRole,
  isVmManagerRole,
  isVmInspectionRole,
  resolveVmPermission,
  canView,
  canAttachPhotos,
  canManagePhotos,
  canDeletePhotos
};
