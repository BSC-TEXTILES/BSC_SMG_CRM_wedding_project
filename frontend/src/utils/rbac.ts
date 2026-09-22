/**
 * Shared RBAC page-permission resolution (single source of truth).
 *
 * Used by BOTH the Sidebar (what to render) and the RouteGuard (which URLs a
 * role may open). This is the UX layer only — the backend independently
 * enforces the same boundaries on every API call, so tampering with frontend
 * state cannot expose data.
 */

export interface SessionLike {
  role?: string;
  locationId?: number | null;
  isGlobalAdmin?: boolean;
  fullName?: string;
}

// Role → allowed page keys. Mirrors the page_visibility defaults seeded in the
// backend; the DB (page_visibility / user_permissions) can narrow these but a
// key absent for a role here is hidden for that role.
const ALL_ADMIN_KEYS = [
  'wedding_crm', 'wedding_operations', 'wedding_registration', 'candidate_apply', 'footfall', 
  'feedback_collection', 'feedback_list', 'feedback_qr', 'divert', 'pm_view', 'vm_checklist', 
  'attendance', 'dashboard', 'candidates', 'offer', 'openings', 'daily_mcheck', 'mcheck_reports', 
  'mcheck_history', 'employees', 'dept_hiring', 'section_allocation', 'feedback_public', 'tv', 
  'greeter', 'broadcast', 'user_management', 'settings', 'system_admin', 'telecaller_dashboard', 
  'telecaller_desk', 'joining_desk', 'doj_desk', 'greyhr', 'batch_plan', 'mcheck_audit', 'main_crm', 
  'regional_analytics'
];

export const ROLE_NAV_MAP: Record<string, string[]> = {
  'Super Admin': ALL_ADMIN_KEYS,
  'Admin': ALL_ADMIN_KEYS,
  'Manager': [
    'wedding_crm', 'wedding_operations', 'wedding_registration', 'telecaller_desk', 'telecaller_dashboard', 'candidate_apply', 'footfall', 
    'feedback_collection', 'feedback_list', 'feedback_qr', 'divert', 'pm_view', 'vm_checklist', 
    'attendance', 'dashboard', 'candidates', 'offer', 'openings', 'daily_mcheck', 'mcheck_reports', 
    'mcheck_history', 'employees', 'dept_hiring', 'section_allocation', 'broadcast', 'user_management'
  ],
  'HR': [
    'wedding_crm', 'wedding_registration', 'candidate_apply', 'footfall', 'feedback_collection', 
    'feedback_list', 'feedback_qr', 'divert', 'pm_view', 'vm_checklist', 'attendance', 'dashboard', 
    'candidates', 'offer', 'openings', 'daily_mcheck', 'mcheck_reports', 'mcheck_history', 'employees', 
    'dept_hiring', 'section_allocation', 'broadcast', 'user_management'
  ],
  'VM': [
    'vm_checklist', 'dashboard', 'footfall', 'broadcast'
  ],
  'Greeter': [
    'footfall', 'greeter', 'wedding_registration', 'feedback_collection', 'feedback_list', 'feedback_qr', 'feedback_public', 'tv'
  ],
  'CRM Executive': [
    'wedding_crm', 'wedding_registration', 'wedding_operations', 'telecaller_desk', 'telecaller_dashboard', 'dashboard', 'footfall'
  ],
  'CRM Manager': [
    'wedding_crm', 'wedding_operations', 'wedding_registration', 'telecaller_desk', 'telecaller_dashboard', 'dashboard', 'footfall', 'broadcast'
  ],
  'Data Analyst': [
    'wedding_crm', 'wedding_operations', 'dashboard', 'mcheck_reports', 'regional_analytics', 'main_crm'
  ],
  'Telecaller': [
    'wedding_crm', 'telecaller_dashboard', 'telecaller_desk', 'wedding_registration'
  ],
  'VM Extension Telecaller': [
    'wedding_crm', 'telecaller_dashboard', 'telecaller_desk', 'wedding_registration'
  ],
  'Floor Manager': [
    'wedding_crm', 'wedding_operations', 'wedding_registration', 'telecaller_desk', 'telecaller_dashboard', 'candidate_apply', 'footfall', 
    'feedback_collection', 'feedback_list', 'feedback_qr', 'divert', 'pm_view', 'vm_checklist', 
    'attendance', 'dashboard', 'candidates', 'offer', 'openings', 'daily_mcheck', 'mcheck_reports', 
    'mcheck_history', 'employees', 'dept_hiring', 'section_allocation', 'broadcast', 'user_management'
  ],
  'Wedding Collection Manager': [
    'wedding_crm', 'wedding_operations', 'dashboard', 'wedding_registration', 'footfall', 'divert', 'broadcast'
  ],
  'Team Lead': [
    'wedding_crm', 'dashboard', 'wedding_registration', 'employees', 'section_allocation', 'broadcast'
  ],
  'Recruiter': ['candidates', 'dashboard', 'broadcast', 'candidate_apply'],
  'Interviewer': ['candidates'],
  'Employee': ['wedding_crm', 'wedding_registration', 'dashboard'],
  'Guest': ['wedding_registration', 'candidate_apply']
};

export const MODULE_KEY_TO_ROUTE: Record<string, string> = {
  dashboard: '/dashboard',
  wedding_crm: '/wedding-crm',
  wedding_registration: '/wedding/customer-registration',
  wedding_operations: '/wedding-operations',
  telecaller_desk: '/telecaller/desk',
  telecaller_dashboard: '/telecaller-dashboard',
  footfall: '/footfall',
  feedback_collection: '/feedback-collection',
  feedback_list: '/feedback-list',
  feedback_qr: '/feedback-qr-management',
  divert: '/divert',
  pm_view: '/pm-view',
  vm_checklist: '/vm-checklist',
  attendance: '/attendance',
  candidates: '/candidates',
  offer: '/offer-process',
  openings: '/openings',
  employees: '/employees',
  dept_hiring: '/department-hiring',
  section_allocation: '/section-allocation',
  daily_mcheck: '/daily-mcheck',
  mcheck_reports: '/mcheck-reports',
  mcheck_history: '/mcheck-history',
  broadcast: '/broadcast-center',
  settings: '/settings',
  system_admin: '/system-admin',
  user_management: '/user-management',
  main_crm: '/main-crm',
  batch_plan: '/batch-plan',
  doj_desk: '/doj-desk',
  joining_desk: '/doj-desk',
  regional_analytics: '/main-crm',
  candidate_apply: '/apply',
  greeter: '/greeter',
  tv: '/tv',
  feedback_public: '/feedback-public'
};

export function getRoleNavMap(role?: string): string[] {
  const raw = (role || '').trim();
  if (ROLE_NAV_MAP[raw]) return ROLE_NAV_MAP[raw];

  // Normalized matching for role aliases (e.g. SUPER_ADMIN, super admin, etc.)
  const norm = raw.toLowerCase().replace(/[_\s-]+/g, ' ');
  if (norm === 'super admin' || norm === 'system administrator') return ROLE_NAV_MAP['Super Admin'];
  if (norm === 'admin') return ROLE_NAV_MAP['Admin'];
  if (norm === 'manager' || norm === 'store manager' || norm === 'floor manager' || norm === 'department manager') return ROLE_NAV_MAP['Manager'];
  if (norm === 'hr' || norm === 'hr manager') return ROLE_NAV_MAP['HR'];
  if (norm === 'vm' || norm === 'visual merchandiser') return ROLE_NAV_MAP['VM'];
  if (norm === 'greeter') return ROLE_NAV_MAP['Greeter'];
  if (norm === 'crm executive' || norm === 'crm exec') return ROLE_NAV_MAP['CRM Executive'];
  if (norm === 'crm manager') return ROLE_NAV_MAP['CRM Manager'];
  if (norm === 'data analyst' || norm === 'analyst') return ROLE_NAV_MAP['Data Analyst'];
  if (norm === 'telecaller' || norm === 'caller' || norm === 'tele caller' || norm === 'tele-caller' || norm === 'vm extension telecaller' || norm === 'vm telecaller') return ROLE_NAV_MAP['Telecaller'];
  if (norm === 'wedding collection manager' || norm === 'wedding manager') return ROLE_NAV_MAP['Wedding Collection Manager'];

  return ROLE_NAV_MAP['Employee'] || [];
}

/**
 * Resolve the effective page keys for a role, narrowed by the database-backed
 * page visibility settings (`${role}_${key}` → boolean) and/or user-specific
 * permissions.
 *
 * Rules:
 * 1. Admin & Super Admin always receive full access.
 * 2. If user has explicit ACM permissions (userModules array), those govern effective
 *    access, with 'dashboard' always guaranteed for authenticated users.
 * 3. If no ACM overrides exist, fall back to role defaults (narrowed by page_visibility dbSettings).
 * 4. 'dashboard' is always included so user lands cleanly on their dashboard.
 */
export function resolveAllowedPages(
  role: string | undefined,
  dbSettings: Record<string, boolean> | null | undefined,
  userModules?: string[] | null
): string[] {
  const roleKeys = getRoleNavMap(role);
  const r = (role || '').trim();
  const norm = r.toLowerCase().replace(/[_\s-]+/g, ' ');

  // Admin & Super Admin have full access to all system admin pages and cannot be restricted by module lists
  if (norm === 'admin' || norm === 'super admin' || norm === 'system administrator') {
    return roleKeys;
  }

  // User-specific permission overrides (exact module list assigned by Admin in Access Control Matrix)
  if (userModules && Array.isArray(userModules)) {
    const allowedSet = new Set<string>(userModules);
    // Ensure dashboard is always accessible to any authenticated user
    allowedSet.add('dashboard');
    return Array.from(allowedSet);
  }

  // Base role defaults narrowed by database page_visibility settings if configured
  if (dbSettings && Object.keys(dbSettings).length > 0) {
    const filtered = roleKeys.filter(key => {
      const dbKey = `${r}_${key}`;
      if (dbSettings[dbKey] !== undefined) return dbSettings[dbKey] === true;
      return true; // not explicitly configured → role-map default applies
    });
    if (!filtered.includes('dashboard')) {
      filtered.unshift('dashboard');
    }
    return filtered;
  }

  if (!roleKeys.includes('dashboard')) {
    return ['dashboard', ...roleKeys];
  }

  return roleKeys;
}
