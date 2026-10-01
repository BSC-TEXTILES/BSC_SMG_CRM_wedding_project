import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Auth } from '../services/api';
import { getRoleNavMap, resolveAllowedPages } from '../utils/rbac';
import { permissionsCache } from '../context/PermissionsCache';
import { Loader2 } from 'lucide-react';

export interface AuthGuardProps {
  children: React.ReactNode;
  pageKey?: string;
  allowedRoles?: string[];
}

/**
 * AuthGuard / PrivateRoute
 * ────────────────────────
 * Centralized Route-Level Security Guard:
 * 1. Verifies that a valid, unexpired, and untampered session exists BEFORE rendering.
 * 2. Verifies role and module permissions (RBAC).
 * 3. On ANY violation (missing session, expired token, unauthorized route, or URL tampering):
 *    - Immediately clears local session data & caches
 *    - Triggers auto-logout
 *    - Redirects to /login with security notice
 */
export function AuthGuard({ children, pageKey, allowedRoles }: AuthGuardProps) {
  const location = useLocation();

  const [status, setStatus] = useState<'checking' | 'allowed' | 'denied' | 'unauthorized'>(() => {
    // 1. Session Existence & Expiry Check
    if (!Auth.check()) {
      return 'denied';
    }

    const session = Auth.get();
    if (!session || !session.id || !session.username || !session.role) {
      return 'denied';
    }

    const role = (session.role || '').trim().toLowerCase().replace(/[_\s-]+/g, ' ');

    // Admin & Super Admin have full unrestricted access
    if (role === 'admin' || role === 'super admin' || role === 'system administrator') {
      return 'allowed';
    }

    // Role check if allowedRoles provided
    if (allowedRoles && allowedRoles.length > 0) {
      const match = allowedRoles.some(r => r.trim().toLowerCase() === role);
      if (!match) return 'unauthorized';
    }

    // Module check if pageKey provided
    if (pageKey) {
      if (Array.isArray(session.modules) && session.modules.includes(pageKey)) {
        return 'allowed';
      }
      const roleKeys = getRoleNavMap(session.role);
      if (roleKeys.includes(pageKey)) {
        return 'allowed';
      }
      // Need async permission cache check
      return 'checking';
    }

    return 'allowed';
  });

  useEffect(() => {
    // Re-verify on location change
    if (!Auth.check()) {
      setStatus('denied');
      return;
    }

    const session = Auth.get();
    if (!session || !session.id || !session.username || !session.role) {
      setStatus('denied');
      return;
    }

    const role = (session.role || '').trim().toLowerCase().replace(/[_\s-]+/g, ' ');
    if (role === 'admin' || role === 'super admin' || role === 'system administrator') {
      setStatus('allowed');
      return;
    }

    if (allowedRoles && allowedRoles.length > 0) {
      const match = allowedRoles.some(r => r.trim().toLowerCase() === role);
      if (!match) {
        setStatus('unauthorized');
        return;
      }
    }

    if (pageKey) {
      let cancelled = false;
      permissionsCache.get().then(({ myPerms, pageSettings }) => {
        if (cancelled) return;
        const userModules = myPerms?.custom && Array.isArray(myPerms.modules) ? myPerms.modules : null;
        const allowed = resolveAllowedPages(session.role, pageSettings, userModules);
        if (!allowed.includes(pageKey)) {
          setStatus('unauthorized');
        } else {
          setStatus('allowed');
        }
      }).catch(() => {
        if (cancelled) return;
        const roleKeys = getRoleNavMap(session.role);
        if (roleKeys.includes(pageKey)) {
          setStatus('allowed');
        } else {
          setStatus('unauthorized');
        }
      });

      return () => {
        cancelled = true;
      };
    } else {
      setStatus('allowed');
    }
  }, [location.pathname, pageKey, allowedRoles]);

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F5F0]">
        <div className="flex items-center gap-2 text-xs font-bold text-[#123C35]">
          <Loader2 className="w-4 h-4 animate-spin text-[#C98218]" />
          <span>Verifying permissions…</span>
        </div>
      </div>
    );
  }

  if (status === 'denied') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (status === 'unauthorized') {
    return <Navigate to="/no-access" replace />;
  }

  return <>{children}</>;
}

// Re-export as PrivateRoute alias
export { AuthGuard as PrivateRoute };
export default AuthGuard;
