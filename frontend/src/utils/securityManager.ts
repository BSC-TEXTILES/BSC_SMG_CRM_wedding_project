/**
 * SecurityManager — URL Manipulation Detection & Auto-Logout
 * ──────────────────────────────────────────────────────────
 * When a user manually changes the URL bar to navigate to a page their role
 * is NOT authorized for, this module:
 *   1. Logs the violation to the backend audit_logs table
 *   2. Clears ALL client state (localStorage, sessionStorage)
 *   3. Redirects to /login?security=unauthorized (backend clears HttpOnly cookie)
 *
 * This is the nuclear-option logout — it cannot be bypassed by React state
 * or navigation because it uses window.location.replace() directly.
 *
 * NOTE: JWT token is stored in HttpOnly cookie (not accessible from JS).
 * All fetch calls use credentials: 'include' to send cookie automatically.
 */

import { Auth, getCsrfToken, apiFetch } from '../services/api';

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
  isUrlManipulation(role: string | undefined, pathname: string): boolean {
    if (!role) return true; // No role = unauthorized

    const normalizedRole = this.normalizeRole(role);

    // Admin roles have full access
    if (ADMIN_ROLES.includes(normalizedRole)) return false;

    // Public routes are always allowed
    if (PUBLIC_ROUTES.some(pattern => pattern.test(pathname))) return false;

    const allowedPatterns = ROLE_ROUTE_MAP[normalizedRole];
    if (!allowedPatterns || allowedPatterns.length === 0) {
      // Unknown role - deny access
      return true;
    }

    // Check if pathname matches any allowed pattern
    return !allowedPatterns.some(pattern => pattern.test(pathname));
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
   * Uses apiFetch which automatically includes HttpOnly cookie and CSRF token.
   */
  async logViolation(userId: string | number | undefined, username: string | undefined, role: string | undefined, attemptedPath: string): Promise<void> {
    try {
      const session = Auth.get();
      if (!session) return;

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

      // Use apiFetch which handles cookie auth and CSRF automatically
      await apiFetch('/security/log-event', {
        method: 'POST',
        body: JSON.stringify(payload),
        // keepalive not needed with apiFetch, but we use credentials: 'include' via apiFetch
      }).catch(() => {}); // Silently fail — logging must never block logout
    } catch {
      // Silently fail
    }
  }

  /**
   * Nuclear logout — obliterates ALL client state and redirects to login.
   * This cannot be intercepted by React state or navigation.
   * Backend will clear the HttpOnly cookie via /api/auth/logout
   */
  async forceLogout(reason: string, attemptedPath: string): Promise<void> {
    // Prevent multiple simultaneous logouts
    if (this.isLoggingOut) return;
    this.isLoggingOut = true;

    const session = Auth.get();

    // 1. Log the violation attempt (fire-and-forget)
    this.logViolation(session?.id, session?.username, session?.role, attemptedPath);

    // 2. Track logout on server (fire-and-forget) - backend clears HttpOnly cookie
    try {
      await apiFetch('/auth/logout', {
        method: 'POST',
        // credentials: 'include' is handled by apiFetch automatically
      }).catch(() => {});
    } catch {}

    // 3. Clear ALL localStorage (except we keep nothing sensitive now)
    try {
      localStorage.clear();
    } catch {}

    // 4. Clear ALL sessionStorage
    try {
      sessionStorage.clear();
    } catch {}

    // 5. NOTE: HttpOnly cookies cannot be cleared from JavaScript
    // They are cleared by the backend via /api/auth/logout
    // We only clear non-HttpOnly cookies here (like _csrf)
    try {
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const name = cookie.split('=')[0].trim();
        // Only clear non-HttpOnly cookies (JavaScript accessible)
        // HttpOnly cookies (like 'token') are cleared by backend
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
      }
    } catch {}

    // 6. Redirect to login with security warning
    // Using window.location.replace — this cannot be intercepted by React Router
    console.warn(`[SecurityManager] Force logout: ${reason} | Attempted: ${attemptedPath}`);
    window.location.replace('/login');
  }
}

export const securityManager = new SecurityManagerService();
