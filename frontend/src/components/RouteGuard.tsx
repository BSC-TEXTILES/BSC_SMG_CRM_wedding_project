import React, { useEffect, useState, useMemo } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Auth, triggerSecurityLogout } from '../services/api';
import { getDefaultLandingRoute } from '../utils/moduleRegistry';
import { getRoleNavMap, resolveAllowedPages } from '../utils/rbac';
import { permissionsCache } from '../context/PermissionsCache';
import { Loader2 } from 'lucide-react';
import AuthGuard, { PrivateRoute } from './AuthGuard';

export { AuthGuard, PrivateRoute };

/**
 * RouteGuard
 * ──────────
 * Centralized Route-Level Security Guard:
 * 1. Verifies that a valid active session exists before rendering.
 * 2. Validates RBAC & module permissions.
 * 3. Immediately terminates session and redirects to /login on any unauthorized access attempt or expired token.
 */
export default function RouteGuard({ pageKey, children }: { pageKey: string; children: React.ReactNode }) {
  const location = useLocation();

  // Lazy-initialize resolution to eliminate loading spinner flicker for pre-authorized sessions
  const [resolution, setResolution] = useState<'checking' | 'allowed' | 'denied' | 'anonymous'>(() => {
    const session = Auth.get();
    if (!Auth.check() || !session || !session.id || !session.username || !session.role) {
      return 'anonymous';
    }

    const role = (session.role || '').trim().toLowerCase().replace(/[_\s-]+/g, ' ');

    // Admin & Super Admin have full unrestricted access to all routes
    if (role === 'admin' || role === 'super admin' || role === 'system administrator') {
      return 'allowed';
    }

    // Direct token/session module list check
    if (Array.isArray(session.modules) && session.modules.includes(pageKey)) {
      return 'allowed';
    }

    // Base role navigation check
    const roleKeys = getRoleNavMap(session.role);
    if (roleKeys.includes(pageKey)) {
      return 'allowed';
    }

    return 'checking';
  });

  useEffect(() => {
    const session = Auth.get();
    if (!Auth.check() || !session || !session.id || !session.username || !session.role) {
      setResolution('anonymous');
      return;
    }

    const role = (session.role || '').trim().toLowerCase().replace(/[_\s-]+/g, ' ');

    // Admin & Super Admin have full unrestricted access to all routes
    if (role === 'admin' || role === 'super admin' || role === 'system administrator') {
      setResolution('allowed');
      return;
    }

    let cancelled = false;

    // Check DB-level permissions cache (user custom permissions from ACM + page visibility settings)
    permissionsCache.get().then(({ myPerms, pageSettings }) => {
      if (cancelled) return;

      const userModules = myPerms?.custom && Array.isArray(myPerms.modules) ? myPerms.modules : null;
      const allowed = resolveAllowedPages(session.role, pageSettings, userModules);

      // Check if pageKey is authorized
      if (!allowed.includes(pageKey)) {
        setResolution('denied');
        return;
      }

      setResolution('allowed');
    }).catch(() => {
      if (cancelled) return;
      const roleKeys = getRoleNavMap(session.role);
      if (roleKeys.includes(pageKey)) {
        setResolution('allowed');
      } else {
        setResolution('denied');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [pageKey, location.pathname]);

  if (resolution === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F4EF]">
        <div className="flex items-center gap-2 text-xs font-bold text-[#101C36]">
          <Loader2 className="w-4 h-4 animate-spin text-[#C98218]" />
          <span>Verifying permissions…</span>
        </div>
      </div>
    );
  }

  if (resolution === 'anonymous') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (resolution === 'denied') {
    return <Navigate to="/no-access" replace />;
  }

  return <>{children}</>;
}
