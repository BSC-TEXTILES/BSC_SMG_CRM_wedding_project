import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Auth, API } from '../services/api';
import { getDashboardRouteForRole } from '../utils/dashboardRouting';
import { getRoleNavMap, resolveAllowedPages } from '../utils/rbac';
import { permissionsCache } from '../context/PermissionsCache';
import { securityManager } from '../utils/securityManager';
import { Loader2 } from 'lucide-react';

/**
 * Frontend RBAC Route Guard (UX layer).
 *
 * SECURITY UPDATE (2026-09-21):
 * - Backend JWT blacklist check: invalidates logged-out / force-logged-out tokens
 * - Backend route validation: confirms pathname against allowed_routes table
 * - Backend session activity logging: tracks all API calls for anomaly detection
 * - Force-logout now clears JWT server-side, not just client-side
 *
 * The guard now performs 3 layers of validation:
 *   1. Client-side role map check (instant, no network)
 *   2. DB-level permissions cache (5-min TTL, no redundant calls)
 *   3. Backend route validation (server-side allowed_routes table)
 *
 * PERFORMANCE: Backend validation is fire-and-forget for allowed routes.
 * Only triggers force-logout when the backend explicitly denies.
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

    // Layer 1: Instant client-side role map check (no flash of blocked content)
    if (!roleKeys.includes(pageKey)) {
      securityManager.forceLogout(
        `Role "${role}" denied page key "${pageKey}" at "${location.pathname}"`,
        location.pathname
      );
      return;
    }

    let cancelled = false;

    // Layer 2: DB-level permissions cache (5-min TTL)
    permissionsCache.get().then(({ myPerms, pageSettings }) => {
      if (cancelled) return;
      const userModules = myPerms?.custom && Array.isArray(myPerms.modules) ? myPerms.modules : null;
      const allowed = resolveAllowedPages(role, pageSettings, userModules);
      if (!allowed.includes(pageKey)) {
        securityManager.forceLogout(
          `Role "${role}" denied page key "${pageKey}" by DB permissions at "${location.pathname}"`,
          location.pathname
        );
        return;
      }

      // Layer 3: Backend route validation (fire-and-forget for speed)
      // Only triggers force-logout if backend explicitly denies
      API.validateRoute(location.pathname).then((result: any) => {
        if (cancelled) return;
        if (result && result.success && result.allowed === false) {
          securityManager.forceLogout(
            `Backend denied route "${location.pathname}" for role "${role}": ${result.reason}`,
            location.pathname
          );
        }
      }).catch(() => {
        // Validation unavailable — frontend guard is primary, fail open
      });

      setResolution('allowed');
    });

    return () => { cancelled = true; };
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
    // This state should not normally be reached because forceLogout()
    // redirects via window.location.replace(). Fallback just in case.
    return <Navigate to={getDashboardRouteForRole(Auth.get()?.role)} replace />;
  }

  return <>{children}</>;
}

