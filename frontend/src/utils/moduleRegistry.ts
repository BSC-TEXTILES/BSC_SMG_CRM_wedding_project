/**
 * Centralized Enterprise Module Registry & Role-Based Landing Engine
 * BSC EXCLUSIVE CRM
 *
 * Rules:
 * 1. Single source of truth for all modules, page keys, and route definitions.
 * 2. User Management module assignments directly dictate route authorization.
 * 3. Never redirect a user to /wedding-crm or /dashboard unless explicitly authorized.
 * 4. Users with 0 assigned modules land on /no-access.
 */

import { getRoleNavMap, resolveAllowedPages } from './rbac';
import { permissionsCache } from '../context/PermissionsCache';

export interface AppModuleDefinition {
  key: string;
  label: string;
  route: string;
  permission: string;
  section: string;
  landingPriority: number; // lower number = higher default landing priority
  description?: string;
}

export const MODULE_REGISTRY: AppModuleDefinition[] = [
  // Enterprise & Executive
  { key: 'dashboard', label: 'Admin Dashboard', route: '/dashboard', permission: 'dashboard', section: 'Enterprise', landingPriority: 5 },
  { key: 'regional_analytics', label: 'Regional Analytics', route: '/dashboard', permission: 'regional_analytics', section: 'Enterprise', landingPriority: 10 },
  { key: 'employees', label: 'Employee Directory', route: '/employees', permission: 'employees', section: 'Enterprise', landingPriority: 30 },
  { key: 'greyhr', label: 'GreyHR Sync', route: '/employees', permission: 'greyhr', section: 'Enterprise', landingPriority: 80 },

  // Store Operations — Wedding CRM
  { key: 'telecaller_dashboard', label: 'Telecaller Dashboard', route: '/telecaller-dashboard', permission: 'telecaller_dashboard', section: 'Store Operations', landingPriority: 10 },
  { key: 'telecaller_desk', label: 'Telecaller Desk', route: '/telecaller/desk', permission: 'telecaller_desk', section: 'Store Operations', landingPriority: 15 },
  { key: 'wedding_crm', label: 'Wedding CRM', route: '/wedding-crm/dashboard', permission: 'wedding_crm', section: 'Store Operations', landingPriority: 20 },
  { key: 'wedding_registration', label: 'Wedding Customer Registration', route: '/wedding/customer-registration', permission: 'wedding_registration', section: 'Store Operations', landingPriority: 25 },
  { key: 'wedding_operations', label: 'Wedding Operations Desk', route: '/wedding-operations', permission: 'wedding_operations', section: 'Store Operations', landingPriority: 28 },

  // Store Operations — Retail & Customer Experience
  { key: 'footfall', label: 'Hourly Footfall', route: '/footfall', permission: 'footfall', section: 'Store Operations', landingPriority: 22 },
  { key: 'feedback_collection', label: 'Feedback Collection', route: '/feedback-collection', permission: 'feedback_collection', section: 'Store Operations', landingPriority: 26 },
  { key: 'feedback_list', label: 'Feedback Call Queue', route: '/feedback-list', permission: 'feedback_list', section: 'Store Operations', landingPriority: 27 },
  { key: 'feedback_qr', label: 'Feedback QR Codes', route: '/feedback-qr-management', permission: 'feedback_qr', section: 'Store Operations', landingPriority: 35 },
  { key: 'divert', label: 'Sourcing Diverts', route: '/divert', permission: 'divert', section: 'Store Operations', landingPriority: 40 },
  { key: 'pm_view', label: 'Purchase Manager View', route: '/pm-view', permission: 'pm_view', section: 'Store Operations', landingPriority: 45 },
  { key: 'vm_checklist', label: 'VM Checklist', route: '/vm-checklist', permission: 'vm_checklist', section: 'Store Operations', landingPriority: 20 },
  { key: 'attendance', label: 'Attendance & Roster', route: '/attendance', permission: 'attendance', section: 'Store Operations', landingPriority: 35 },

  // Talent & HR
  { key: 'candidates', label: 'Candidate CRM', route: '/candidates', permission: 'candidates', section: 'Talent', landingPriority: 25 },
  { key: 'offer', label: 'Offer Desk', route: '/offer-process', permission: 'offer', section: 'Talent', landingPriority: 32 },
  { key: 'openings', label: 'Manpower Planning', route: '/openings', permission: 'openings', section: 'Talent', landingPriority: 33 },
  { key: 'dept_hiring', label: 'Department Hiring Status', route: '/department-hiring', permission: 'dept_hiring', section: 'Talent', landingPriority: 34 },
  { key: 'section_allocation', label: 'Section Allocation', route: '/section-allocation', permission: 'section_allocation', section: 'Talent', landingPriority: 36 },
  { key: 'doj_desk', label: 'DOJ Not Joined Desk', route: '/doj-desk', permission: 'doj_desk', section: 'Talent', landingPriority: 38 },
  { key: 'joining_desk', label: 'Store Joining Desk', route: '/doj-desk', permission: 'joining_desk', section: 'Talent', landingPriority: 39 },

  // Daily Operations
  { key: 'daily_mcheck', label: 'Daily MCheck', route: '/daily-mcheck', permission: 'daily_mcheck', section: 'Daily Operations', landingPriority: 20 },
  { key: 'mcheck_reports', label: 'MCheck Reports', route: '/mcheck-reports', permission: 'mcheck_reports', section: 'Daily Operations', landingPriority: 24 },
  { key: 'mcheck_history', label: 'MCheck History', route: '/mcheck-history', permission: 'mcheck_history', section: 'Daily Operations', landingPriority: 40 },
  { key: 'batch_plan', label: 'Batch Plan', route: '/batch-plan', permission: 'batch_plan', section: 'Daily Operations', landingPriority: 45 },

  // Administration
  { key: 'broadcast', label: 'Broadcast Center', route: '/broadcast-center', permission: 'broadcast', section: 'Administration', landingPriority: 50 },
  { key: 'user_management', label: 'User Management', route: '/user-management', permission: 'user_management', section: 'Administration', landingPriority: 55 },
  { key: 'settings', label: 'System Settings', route: '/settings', permission: 'settings', section: 'Administration', landingPriority: 60 },
  { key: 'system_admin', label: 'System Administrator', route: '/system-admin', permission: 'system_admin', section: 'Administration', landingPriority: 65 },

  // Kiosk / Public Facing
  { key: 'greeter', label: 'Greeter Kiosk', route: '/greeter', permission: 'greeter', section: 'Public Portals', landingPriority: 10 },
  { key: 'tv', label: 'Live TV Kiosk', route: '/tv', permission: 'tv', section: 'Public Portals', landingPriority: 15 },
  { key: 'candidate_apply', label: 'Job Application Portal', route: '/apply', permission: 'candidate_apply', section: 'Public Portals', landingPriority: 90 },
  { key: 'feedback_public', label: 'Customer Feedback Portal', route: '/feedback-public', permission: 'feedback_public', section: 'Public Portals', landingPriority: 90 }
];

/** Route -> Primary page key mapping */
export const ROUTE_TO_PAGE_KEY: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/wedding-crm': 'wedding_crm',
  '/wedding-crm/dashboard': 'wedding_crm',
  '/wedding-crm/customers': 'wedding_crm',
  '/wedding-crm/customers/new': 'wedding_registration',
  '/wedding-crm/telecaller': 'wedding_crm',
  '/wedding-crm/calls': 'wedding_crm',
  '/wedding-crm/calendar': 'wedding_crm',
  '/wedding-crm/pipeline': 'wedding_crm',
  '/wedding-crm/status-board': 'wedding_crm',
  '/wedding-crm/reports': 'wedding_crm',
  '/wedding-crm/import': 'wedding_crm',
  '/wedding/customer-registration': 'wedding_registration',
  '/wedding-operations': 'wedding_operations',
  '/telecaller/desk': 'telecaller_desk',
  '/telecaller/queue': 'telecaller_desk',
  '/telecaller-dashboard': 'telecaller_dashboard',
  '/footfall': 'footfall',
  '/feedback-collection': 'feedback_collection',
  '/feedback-list': 'feedback_list',
  '/feedback-qr-management': 'feedback_qr',
  '/divert': 'divert',
  '/pm-view': 'pm_view',
  '/vm-checklist': 'vm_checklist',
  '/attendance': 'attendance',
  '/candidates': 'candidates',
  '/offer-process': 'offer',
  '/openings': 'openings',
  '/employees': 'employees',
  '/department-hiring': 'dept_hiring',
  '/section-allocation': 'section_allocation',
  '/daily-mcheck': 'daily_mcheck',
  '/mcheck-reports': 'mcheck_reports',
  '/mcheck-history': 'mcheck_history',
  '/broadcast-center': 'broadcast',
  '/user-management': 'user_management',
  '/settings': 'settings',
  '/system-admin': 'system_admin',
  '/batch-plan': 'batch_plan',
  '/doj-desk': 'doj_desk',
  '/greeter': 'greeter',
  '/tv': 'tv'
};

/** Normalize role string */
export function normalizeRole(role?: string): string {
  return (role || '').trim().toLowerCase().replace(/[_\s-]+/g, ' ');
}

/** Check if user role is Super Admin / System Admin */
export function isSuperOrSystemAdmin(role?: string): boolean {
  const norm = normalizeRole(role);
  return norm === 'super admin' || norm === 'admin' || norm === 'system administrator';
}

/** Check if a module is allowed for a user */
export function canAccessModule(
  moduleKey: string,
  allowedModules?: string[] | null,
  role?: string
): boolean {
  if (isSuperOrSystemAdmin(role)) {
    return true;
  }
  if (allowedModules && Array.isArray(allowedModules)) {
    return allowedModules.includes(moduleKey);
  }
  const roleKeys = getRoleNavMap(role);
  return roleKeys.includes(moduleKey);
}

/** Check if a route/pathname is allowed for a user */
export function canAccessRoute(
  pathname: string,
  allowedModules?: string[] | null,
  role?: string
): boolean {
  if (isSuperOrSystemAdmin(role)) {
    return true;
  }

  // Public routes always accessible
  const publicPrefixes = ['/login', '/forgot-password', '/apply', '/feedback-public', '/feedback-qr', '/tv', '/no-access'];
  if (publicPrefixes.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return true;
  }

  // Strip query & trailing slashes
  const cleanPath = pathname.split('?')[0].replace(/\/+$/, '') || '/';
  
  // Find matching pageKey
  let pageKey = ROUTE_TO_PAGE_KEY[cleanPath];
  if (!pageKey) {
    // Check prefix matches
    if (cleanPath.startsWith('/wedding-crm')) pageKey = 'wedding_crm';
    else if (cleanPath.startsWith('/telecaller')) pageKey = 'telecaller_desk';
    else if (cleanPath.startsWith('/feedback-qr')) pageKey = 'feedback_qr';
    else if (cleanPath.startsWith('/mcheck-')) pageKey = 'mcheck_reports';
  }

  if (!pageKey) {
    return false;
  }

  return canAccessModule(pageKey, allowedModules, role);
}

/**
 * Deterministically calculates the user's authorized default landing route.
 * Strictly guarantees that unauthorized routes (like /wedding-crm) are NEVER returned.
 */
export function getDefaultLandingRoute(
  user: { role?: string; username?: string } | null,
  allowedModules?: string[] | null
): string {
  const role = user?.role || '';
  const norm = normalizeRole(role);

  // 1. Super Admin / Admin -> Always Admin Dashboard
  if (isSuperOrSystemAdmin(role)) {
    return '/dashboard';
  }

  // 2. If user has explicit ACM permissions configured
  if (allowedModules && Array.isArray(allowedModules)) {
    if (allowedModules.length === 0) {
      return '/no-access';
    }

    // Role-specific landing priority (if that assigned module is active for them):
    // Telecaller / CRM Executive
    if (
      norm === 'telecaller' || norm === 'caller' || norm === 'tele caller' ||
      norm === 'tele-caller' || norm === 'vm extension telecaller' || norm === 'vm telecaller' ||
      norm === 'crm executive' || norm === 'crm exec'
    ) {
      if (allowedModules.includes('telecaller_dashboard')) return '/telecaller-dashboard';
      if (allowedModules.includes('telecaller_desk')) return '/telecaller/desk';
      if (allowedModules.includes('wedding_crm')) return '/wedding-crm/dashboard';
      if (allowedModules.includes('wedding_registration')) return '/wedding/customer-registration';
      if (allowedModules.includes('footfall')) return '/footfall';
      if (allowedModules.includes('dashboard')) return '/dashboard';
    }

    // Wedding Collection Manager / CRM Manager
    if (norm === 'wedding collection manager' || norm === 'wedding collection' || norm === 'wedding manager' || norm === 'crm manager') {
      if (allowedModules.includes('wedding_crm')) return '/wedding-crm/dashboard';
      if (allowedModules.includes('wedding_operations')) return '/wedding-operations';
      if (allowedModules.includes('telecaller_dashboard')) return '/telecaller-dashboard';
      if (allowedModules.includes('telecaller_desk')) return '/telecaller/desk';
      if (allowedModules.includes('dashboard')) return '/dashboard';
    }

    // Greeter
    if (norm === 'greeter') {
      if (allowedModules.includes('greeter')) return '/greeter';
      if (allowedModules.includes('footfall')) return '/footfall';
      if (allowedModules.includes('wedding_registration')) return '/wedding/customer-registration';
    }

    // Visual Merchandiser (VM)
    if (norm === 'vm' || norm === 'visual merchandiser') {
      if (allowedModules.includes('vm_checklist')) return '/vm-checklist';
      if (allowedModules.includes('footfall')) return '/footfall';
      if (allowedModules.includes('dashboard')) return '/dashboard';
    }

    // HR
    if (norm === 'hr' || norm === 'hr manager' || norm === 'recruiter' || norm === 'interviewer') {
      if (allowedModules.includes('dashboard')) return '/dashboard?view=hr';
      if (allowedModules.includes('employees')) return '/employees';
      if (allowedModules.includes('candidates')) return '/candidates';
      if (allowedModules.includes('attendance')) return '/attendance';
      if (allowedModules.includes('dept_hiring')) return '/department-hiring';
    }

    // Manager
    if (norm === 'manager' || norm === 'store manager' || norm === 'floor manager' || norm === 'department manager') {
      if (allowedModules.includes('dashboard')) return '/dashboard?view=manager';
      if (allowedModules.includes('footfall')) return '/footfall';
      if (allowedModules.includes('wedding_crm')) return '/wedding-crm/dashboard';
      if (allowedModules.includes('telecaller_desk')) return '/telecaller/desk';
      if (allowedModules.includes('vm_checklist')) return '/vm-checklist';
    }

    // Data Analyst
    if (norm === 'data analyst' || norm === 'analyst') {
      if (allowedModules.includes('wedding_crm')) return '/wedding-crm/reports';
      if (allowedModules.includes('mcheck_reports')) return '/mcheck-reports';
      if (allowedModules.includes('dashboard')) return '/dashboard';
    }

    // If none of the role-preferred modules matched, pick the highest priority module from their assigned list:
    const prioritizedRegistry = [...MODULE_REGISTRY].sort((a, b) => a.landingPriority - b.landingPriority);
    for (const mod of prioritizedRegistry) {
      if (allowedModules.includes(mod.key)) {
        return mod.route;
      }
    }

    // Fallback: check any allowed module key against ROUTE_TO_PAGE_KEY inverted
    for (const key of allowedModules) {
      const match = MODULE_REGISTRY.find(m => m.key === key);
      if (match?.route) return match.route;
    }

    return '/no-access';
  }

  // 3. Fallback: Role default when no custom user_permissions override exists
  const roleKeys = getRoleNavMap(role);
  if (!roleKeys || roleKeys.length === 0) {
    return '/no-access';
  }

  if (norm.includes('telecaller') || norm.includes('crm exec')) {
    return roleKeys.includes('telecaller_dashboard') ? '/telecaller-dashboard' : '/telecaller/desk';
  }
  if (norm.includes('wedding') || norm.includes('crm manager')) {
    return roleKeys.includes('wedding_crm') ? '/wedding-crm/dashboard' : (roleKeys.includes('telecaller_dashboard') ? '/telecaller-dashboard' : '/no-access');
  }
  if (norm === 'vm' || norm === 'visual merchandiser') {
    return '/vm-checklist';
  }
  if (norm === 'greeter') {
    return roleKeys.includes('greeter') ? '/greeter' : '/footfall';
  }
  if (norm.includes('hr')) {
    return '/dashboard?view=hr';
  }
  if (norm.includes('manager')) {
    return '/dashboard?view=manager';
  }
  if (norm.includes('analyst')) {
    return roleKeys.includes('wedding_crm') ? '/wedding-crm/reports' : '/mcheck-reports';
  }

  return '/dashboard';
}

/**
 * Asynchronously loads current permissions from backend, validates optional saved route,
 * and resolves the exact authorized landing route.
 */
export async function resolvePostLoginRoute(
  user: any,
  savedRoute?: string | null
): Promise<string> {
  try {
    if (!user) {
      return '/login';
    }

    // Admin & Super Admin always land directly on Admin Dashboard
    if (isSuperOrSystemAdmin(user.role)) {
      return '/dashboard';
    }

    // Fetch fresh permissions from DB cache
    const { myPerms, pageSettings } = await permissionsCache.get(true);
    const userModules = myPerms?.custom && Array.isArray(myPerms.modules) ? myPerms.modules : null;
    const allowed = resolveAllowedPages(user.role, pageSettings, userModules);

    // If a saved returnUrl exists and is authorized, use it
    if (savedRoute && savedRoute !== '/' && savedRoute !== '/login' && savedRoute !== '/no-access') {
      if (canAccessRoute(savedRoute, allowed, user.role)) {
        return savedRoute;
      }
    }

    // Calculate default landing route
    return getDefaultLandingRoute(user, allowed);
  } catch (err) {
    console.warn('[resolvePostLoginRoute] Falling back to default landing calculation:', err);
    return getDefaultLandingRoute(user, null);
  }
}
