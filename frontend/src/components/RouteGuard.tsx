import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Auth } from '../services/api';
import { getDashboardRouteForRole } from '../utils/dashboardRouting';
import { getRoleNavMap, resolveAllowedPages } from '../utils/rbac';
import { permissionsCache } from '../context/PermissionsCache';
import { Loader2 } from 'lucide-react';

/**
 * Frontend RBAC Route Guard (UX layer).
 *
 * The backend independently enforces authorization on every API call — this
 * guard only prevents a user from OPENING a page their role is not assigned
 * to (defense against URL tampering / sidebar-less navigation), and redirects
 * unauthenticated visitors to login.
 *
 * PERFORMANCE FIX (2026-09-21):
 * Previously this called API.getMyPermissions() + API.getPageSettings() on
 * every mount AND every location.pathname change, generating 20–40 requests
 * per navigation cycle and causing HTTP 429 rate-limit errors.
 *
 * Now it uses a module-level PermissionsCache singleton that fetches once,
 * caches for 5 minutes, and deduplicates concurrent calls.
 */
export default function RouteGuard({ pageKey, children }: { pageKey: string; children: React.ReactNode }) {
  const location = useLocation();
  const [resolution, setResolution] = useState<'checking' | 'allowed' | 'denied' | 'anonymous'>('checking');

  useEffect(() => {
    const session = Auth.get();
    if (!Auth.check() || !session) {
      setResolution('anonymous');
      return;
    }

    const role = session.role || '';
    const roleKeys = getRoleNavMap(role);

    // Role map is the immediate baseline (no flash of blocked content)
    if (!roleKeys.includes(pageKey)) {
      setResolution('denied');
      return;
    }

    let cancelled = false;

    // Use shared cache — no redundant network calls across route changes
    permissionsCache.get().then(({ myPerms, pageSettings }) => {
      if (cancelled) return;
      const userModules = myPerms?.custom && Array.isArray(myPerms.modules) ? myPerms.modules : null;
      const allowed = resolveAllowedPages(role, pageSettings, userModules);
      setResolution(allowed.includes(pageKey) ? 'allowed' : 'denied');
    });

    return () => { cancelled = true; };
    // IMPORTANT: pageKey only (not location.pathname).
    // location.pathname caused this effect to re-run on every navigation,
    // triggering a fresh API call on each page visit.
  }, [pageKey]);

  if (resolution === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-xs font-bold text-primary">
          <Loader2 className="w-4 h-4 animate-spin text-accent" />
          Verifying access…
        </div>
      </div>
    );
  }

  if (resolution === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (resolution === 'denied') {
    // Never show another role's page — bounce to THIS role's own dashboard
    return <Navigate to={getDashboardRouteForRole(Auth.get()?.role)} replace />;
  }

  return <>{children}</>;
}
