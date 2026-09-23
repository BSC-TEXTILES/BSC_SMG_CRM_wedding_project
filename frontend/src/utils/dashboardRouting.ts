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

import { getDefaultLandingRoute } from './moduleRegistry';

export { getDefaultLandingRoute };

/**
 * Resolves the authorized landing route for a user based on their role and
 * their effective allowed page keys from the Access Control Matrix (ACM).
 * Delegates to centralized moduleRegistry engine.
 */
export function getAuthorizedLandingRoute(role?: string, allowedPageKeys?: string[] | null): string {
  return getDefaultLandingRoute({ role }, allowedPageKeys);
}


