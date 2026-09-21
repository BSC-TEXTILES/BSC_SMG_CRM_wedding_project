/**
 * Dashboard Routing & Role Resolution Utility
 * Maps authenticated user roles to their authorized landing pages:
 * 1. Super Admin → Admin Dashboard (/dashboard)
 * 2. Admin → Admin Dashboard (/dashboard)
 * 3. Manager → Manager Dashboard (/dashboard?view=manager)
 * 4. HR → HR Dashboard (/dashboard?view=hr)
 * 5. VM → VM Dashboard (/vm-checklist)
 * 6. Greeter → Greeter / Footfall Dashboard (/footfall)
 * 7. CRM Executive → CRM Executive Dashboard (/wedding-crm/dashboard)
 * 8. CRM Manager → CRM Manager Dashboard (/wedding-crm/dashboard)
 * 9. Data Analyst → Data Analyst Dashboard (/wedding-crm/reports)
 * 10. Telecaller → Telecaller Dashboard (/telecaller/desk)
 * 11. Wedding Collection Manager → Wedding Collection Dashboard (/wedding-crm/dashboard)
 */

export type DashboardType = 
  | 'admin'
  | 'hr'
  | 'manager'
  | 'vm'
  | 'greeter'
  | 'crm_executive'
  | 'crm_manager'
  | 'data_analyst'
  | 'telecaller'
  | 'wedding_collection'
  | 'team_lead';

export function getDashboardTypeForRole(role?: string): DashboardType {
  const r = (role || '').trim().toLowerCase().replace(/[_\s-]+/g, ' ');
  if (
    r === 'telecaller' || 
    r === 'caller' || 
    r === 'tele-caller' || 
    r === 'tele caller' || 
    r === 'vm extension telecaller' || 
    r === 'vm telecaller' ||
    r === 'crm executive' || 
    r === 'crm exec'
  ) {
    return 'telecaller';
  }
  if (r === 'wedding collection manager' || r === 'wedding collection' || r === 'wedding manager') {
    return 'wedding_collection';
  }
  if (r === 'crm manager') {
    return 'crm_manager';
  }
  if (r === 'data analyst' || r === 'analyst') {
    return 'data_analyst';
  }
  if (r === 'vm' || r === 'visual merchandiser') {
    return 'vm';
  }
  if (r === 'greeter') {
    return 'greeter';
  }
  if (r === 'team lead') {
    return 'team_lead';
  }
  if (r === 'super admin' || r === 'admin' || r === 'system administrator') {
    return 'admin';
  }
  if (r === 'hr' || r === 'hr manager' || r === 'recruiter' || r === 'interviewer') {
    return 'hr';
  }
  if (r === 'manager' || r === 'store manager' || r === 'floor manager' || r === 'department manager') {
    return 'manager';
  }
  return 'manager';
}

export function getDashboardLabelForRole(role?: string): string {
  const type = getDashboardTypeForRole(role);
  switch (type) {
    case 'telecaller':
      return 'Wedding CRM · Telecaller Desk';
    case 'wedding_collection':
      return 'Wedding Collection Dashboard';
    case 'crm_executive':
      return 'Wedding CRM · Telecaller Desk';
    case 'crm_manager':
      return 'CRM Manager Dashboard';
    case 'data_analyst':
      return 'Data Analyst Dashboard';
    case 'vm':
      return 'Visual Merchandising Dashboard';
    case 'greeter':
      return 'Footfall & Greeter Kiosk';
    case 'team_lead':
      return 'Team Lead Dashboard';
    case 'admin':
      return 'Admin Dashboard';
    case 'hr':
      return 'HR Dashboard';
    case 'manager':
      return 'Manager Dashboard';
  }
}

export function getDashboardRouteForRole(role?: string): string {
  const type = getDashboardTypeForRole(role);
  switch (type) {
    case 'admin':
      return '/dashboard';
    case 'manager':
      return '/dashboard?view=manager';
    case 'hr':
      return '/dashboard?view=hr';
    case 'vm':
      return '/vm-checklist';
    case 'greeter':
      return '/footfall';
    case 'crm_executive':
    case 'telecaller':
      return '/telecaller/desk';
    case 'crm_manager':
    case 'wedding_collection':
      return '/wedding-crm/dashboard';
    case 'data_analyst':
      return '/wedding-crm/reports';
    case 'team_lead':
      return '/wedding-crm/dashboard';
    default:
      return '/dashboard';
  }
}

/**
 * Resolves the authorized landing route for a user based on their role and
 * their effective allowed page keys from the Access Control Matrix (ACM).
 * If the role's default landing page is blocked in ACM, gracefully falls
 * back to the next authorized page.
 */
export function getAuthorizedLandingRoute(role?: string, allowedPageKeys?: string[] | null): string {
  const defaultRoute = getDashboardRouteForRole(role);
  if (!allowedPageKeys || !Array.isArray(allowedPageKeys) || allowedPageKeys.length === 0) {
    return defaultRoute;
  }

  const r = (role || '').trim().toLowerCase().replace(/[_\s-]+/g, ' ');
  const isTelecallerType = [
    'telecaller', 'caller', 'tele-caller', 'tele caller',
    'vm extension telecaller', 'vm telecaller', 'crm executive', 'crm exec'
  ].includes(r);

  if (isTelecallerType) {
    // If Telecaller has telecaller_desk permission, open telecaller desk
    if (allowedPageKeys.includes('telecaller_desk')) return '/telecaller/desk';
    // If telecaller_desk is disabled but telecaller_dashboard is enabled
    if (allowedPageKeys.includes('telecaller_dashboard')) return '/telecaller-dashboard';
    // If only general wedding_crm is enabled
    if (allowedPageKeys.includes('wedding_crm')) return '/wedding-crm/dashboard';
    // If wedding_registration is enabled
    if (allowedPageKeys.includes('wedding_registration')) return '/wedding/customer-registration';
    // Fallbacks if all wedding features are denied in ACM
    if (allowedPageKeys.includes('dashboard')) return '/dashboard';
    if (allowedPageKeys.includes('footfall')) return '/footfall';
  }

  const routeKeyMap: Record<string, string> = {
    '/dashboard': 'dashboard',
    '/dashboard?view=manager': 'dashboard',
    '/dashboard?view=hr': 'dashboard',
    '/vm-checklist': 'vm_checklist',
    '/footfall': 'footfall',
    '/wedding-crm/dashboard': 'wedding_crm',
    '/wedding-crm/reports': 'wedding_crm',
    '/telecaller/desk': 'telecaller_desk'
  };

  const requiredKey = routeKeyMap[defaultRoute];
  if (!requiredKey || allowedPageKeys.includes(requiredKey)) {
    return defaultRoute;
  }

  if (allowedPageKeys.includes('dashboard')) return '/dashboard';
  if (allowedPageKeys.includes('telecaller_desk')) return '/telecaller/desk';
  if (allowedPageKeys.includes('wedding_crm')) return '/wedding-crm/dashboard';
  if (allowedPageKeys.includes('footfall')) return '/footfall';

  return defaultRoute;
}


