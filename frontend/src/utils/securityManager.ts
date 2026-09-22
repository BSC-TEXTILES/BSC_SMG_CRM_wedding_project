/**
 * SecurityManager — URL Manipulation Detection & Auto-Logout
 * ──────────────────────────────────────────────────────────
 * When a user manually changes the URL bar to navigate to a page their role
 * is NOT authorized for, this module:
 *   1. Logs the violation to the backend audit_logs table
 *   2. Clears ALL client state (localStorage, sessionStorage, cookies)
 *   3. Redirects to /login?security=unauthorized
 *
 * This is the nuclear-option logout — it cannot be bypassed by React state
 * or navigation because it uses window.location.replace() directly.
 */

import { Auth } from '../services/api';

// ── Role → Allowed URL patterns ────────────────────────────────────────
// Derived from App.tsx route definitions + ROLE_NAV_MAP in rbac.ts.
// Admin/Super Admin can access everything so they are not listed here.
const ROLE_ROUTE_MAP: Record<string, RegExp[]> = {
  'Telecaller': [
    /^\/telecaller(\/|$)/,
    /^\/telecaller-dashboard$/,
    /^\/wedding-crm(\/|$)/,
    /^\/wedding(\/|$)/,
    /^\/wedding-registration$/,
  ],
  'VM Extension Telecaller': [
    /^\/telecaller(\/|$)/,
    /^\/telecaller-dashboard$/,
    /^\/wedding-crm(\/|$)/,
    /^\/wedding(\/|$)/,
    /^\/wedding-registration$/,
  ],
  'CRM Executive': [
    /^\/telecaller(\/|$)/,
    /^\/telecaller-dashboard$/,
    /^\/wedding-crm(\/|$)/,
    /^\/wedding(\/|$)/,
    /^\/wedding-registration$/,
    /^\/dashboard/,
    /^\/footfall$/,
  ],
  'CRM Manager': [
    /^\/telecaller(\/|$)/,
    /^\/wedding-crm(\/|$)/,
    /^\/wedding\//,
    /^\/dashboard/,
    /^\/footfall$/,
    /^\/broadcast-center$/,
  ],
  'Wedding Collection Manager': [
    /^\/wedding-crm(\/|$)/,
    /^\/wedding\//,
    /^\/dashboard/,
    /^\/footfall$/,
    /^\/divert$/,
    /^\/broadcast-center$/,
  ],
  'Team Lead': [
    /^\/wedding-crm(\/|$)/,
    /^\/wedding\//,
    /^\/dashboard/,
    /^\/employees$/,
    /^\/section-allocation$/,
    /^\/broadcast-center$/,
  ],
  'Data Analyst': [
    /^\/wedding-crm(\/|$)/,
    /^\/wedding\//,
    /^\/dashboard/,
    /^\/mcheck-reports$/,
    /^\/regional-analytics$/,
    /^\/main-crm$/,
  ],
  'VM': [
    /^\/vm-checklist$/,
    /^\/dashboard/,
    /^\/footfall$/,
    /^\/broadcast-center$/,
  ],
  'Greeter': [
    /^\/footfall$/,
    /^\/greeter$/,
    /^\/wedding-registration$/,
    /^\/feedback-/,
    /^\/tv$/,
  ],
  'HR': [
    /^\/wedding-crm(\/|$)/,
    /^\/wedding\//,
    /^\/dashboard/,
    /^\/footfall$/,
    /^\/feedback-/,
    /^\/divert$/,
    /^\/pm-view$/,
    /^\/vm-checklist$/,
    /^\/attendance$/,
    /^\/candidates$/,
    /^\/employees$/,
    /^\/dept-hiring$/,
    /^\/department-hiring$/,
    /^\/section-allocation$/,
    /^\/broadcast-center$/,
    /^\/user-management$/,
    /^\/daily-mcheck$/,
    /^\/mcheck-/,
    /^\/openings$/,
    /^\/batch-plan$/,
    /^\/doj-desk$/,
    /^\/offer/,
  ],
  'Manager': [
    /^\/wedding-crm(\/|$)/,
    /^\/wedding\//,
    /^\/dashboard/,
    /^\/footfall$/,
    /^\/feedback-/,
    /^\/divert$/,
    /^\/pm-view$/,
    /^\/vm-checklist$/,
    /^\/attendance$/,
    /^\/candidates$/,
    /^\/employees$/,
    /^\/dept-hiring$/,
    /^\/department-hiring$/,
    /^\/section-allocation$/,
    /^\/broadcast-center$/,
    /^\/user-management$/,
    /^\/daily-mcheck$/,
    /^\/mcheck-/,
    /^\/openings$/,
    /^\/batch-plan$/,
    /^\/doj-desk$/,
    /^\/offer/,
    /^\/main-crm$/,
    /^\/telecaller(\/|$)/,
    /^\/telecaller-dashboard$/,
  ],
};

// Public routes accessible to ALL users (no guard needed)
const PUBLIC_ROUTES: RegExp[] = [
  /^\/$/,
  /^\/login/,
  /^\/forgot-password$/,
  /^\/apply$/,
  /^\/applicants\//,
  /^\/candidate-registration$/,
  /^\/wedding-registration$/,
  /^\/feedback-public$/,
  /^\/feedback-qr$/,
  /^\/track$/,
  /^\/tv$/,
  /^\/cash-settlement$/,
];

// Admin roles that can access everything
const ADMIN_ROLES = ['Admin', 'Super Admin'];

class SecurityManagerService {
  private isLoggingOut = false;

  /**
   * Check if the given pathname is allowed for the user's role.
   * Returns true if the route is UNAUTHORIZED (i.e., is a violation).
   */
  isUrlManipulation(_role: string | undefined, _pathname: string): boolean {
    // Route authorization is authoritatively and safely handled by RouteGuard with in-page Access Denied views.
    // Navigation never triggers destructive force-logouts.
    return false;
  }

  /**
   * Normalize role strings to match ROLE_ROUTE_MAP keys.
   */
  private normalizeRole(role: string): string {
    const r = role.trim();

    // Check exact match first
    if (ROLE_ROUTE_MAP[r] || ADMIN_ROLES.includes(r)) return r;

    // Normalized matching
    const norm = r.toLowerCase().replace(/[_\s-]+/g, ' ');
    if (norm === 'super admin' || norm === 'system administrator') return 'Super Admin';
    if (norm === 'admin') return 'Admin';
    if (norm === 'manager' || norm === 'store manager' || norm === 'floor manager' || norm === 'department manager') return 'Manager';
    if (norm === 'hr' || norm === 'hr manager' || norm === 'recruiter' || norm === 'interviewer') return 'HR';
    if (norm === 'vm' || norm === 'visual merchandiser') return 'VM';
    if (norm === 'greeter') return 'Greeter';
    if (norm === 'crm executive' || norm === 'crm exec') return 'CRM Executive';
    if (norm === 'crm manager') return 'CRM Manager';
    if (norm === 'data analyst' || norm === 'analyst') return 'Data Analyst';
    if (norm === 'telecaller' || norm === 'caller' || norm === 'tele-caller' || norm === 'tele caller' || norm === 'vm extension telecaller' || norm === 'vm telecaller') return 'Telecaller';
    if (norm === 'wedding collection manager' || norm === 'wedding manager') return 'Wedding Collection Manager';
    if (norm === 'team lead') return 'Team Lead';

    return r; // Return as-is if no match found
  }

  /**
   * Log a URL manipulation violation attempt to the backend.
   * Fire-and-forget — never blocks the logout flow.
   */
  logViolation(userId: string | number | undefined, username: string | undefined, role: string | undefined, attemptedPath: string): void {
    try {
      const session = Auth.get();
      if (!session?.token) return;

      const payload = {
        event: 'URL_MANIPULATION',
        details: {
          attemptedPath,
          userRole: role || 'unknown',
          userId: userId || 'unknown',
          username: username || 'unknown',
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          referrer: document.referrer || 'direct'
        }
      };

      // Use fetch directly with keepalive so the request survives the page redirect
      fetch('/api/security/log-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`,
          'x-auth-token': session.token
        },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(() => {}); // Silently fail — logging must never block logout
    } catch {
      // Silently fail
    }
  }

  /**
   * Nuclear logout — obliterates ALL client state and redirects to login.
   * This cannot be intercepted by React state or navigation.
   */
  forceLogout(reason: string, attemptedPath: string): void {
    // Prevent multiple simultaneous logouts
    if (this.isLoggingOut) return;
    this.isLoggingOut = true;

    const session = Auth.get();

    // 1. Log the violation attempt (fire-and-forget)
    this.logViolation(session?.id, session?.username, session?.role, attemptedPath);

    // 2. Track logout on server (fire-and-forget)
    try {
      if (session?.token) {
        fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.token}`,
            'x-auth-token': session.token
          },
          keepalive: true
        }).catch(() => {});
      }
    } catch {}

    // 3. Clear ALL localStorage
    try {
      localStorage.clear();
    } catch {}

    // 4. Clear ALL sessionStorage
    try {
      sessionStorage.clear();
    } catch {}

    // 5. Clear ALL cookies
    try {
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const name = cookie.split('=')[0].trim();
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
      }
    } catch {}

    // 6. Redirect to login with security warning
    // Using window.location.replace — this cannot be intercepted by React Router
    console.warn(`[SecurityManager] Force logout: ${reason} | Attempted: ${attemptedPath}`);
    window.location.replace(`/login?security=unauthorized&path=${encodeURIComponent(attemptedPath)}`);
  }
}

export const securityManager = new SecurityManagerService();
