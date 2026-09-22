import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { Auth, API } from '../services/api';
import { getDashboardRouteForRole } from '../utils/dashboardRouting';
import { getRoleNavMap, resolveAllowedPages } from '../utils/rbac';
import { permissionsCache } from '../context/PermissionsCache';
import { Loader2, ShieldAlert, ArrowLeft, Home } from 'lucide-react';

/**
 * Frontend RBAC Route Guard (Authoritative UX Layer).
 *
 * Ensures that permissions assigned in the Admin Access Control Matrix (ACM)
 * govern effective page access.
 *
 * RULES:
 * 1. If Admin grants VIEW = ON for a pageKey, the page must open.
 * 2. If access is missing, show an in-page Access Denied card while preserving the active session.
 * 3. NEVER destroy the user's session or force-logout authenticated users on navigation.
 */
export default function RouteGuard({ pageKey, children }: { pageKey: string; children: React.ReactNode }) {
  const location = useLocation();
  const [resolution, setResolution] = useState<'checking' | 'allowed' | 'denied' | 'anonymous'>('checking');
  const [deniedReason, setDeniedReason] = useState<string>('');
  const [allowedModules, setAllowedModules] = useState<string[]>([]);

  useEffect(() => {
    const session = Auth.get();
    if (!Auth.check() || !session) {
      setResolution('anonymous');
      return;
    }

    const role = session.role || '';
    const norm = role.trim().toLowerCase().replace(/[_\s-]+/g, ' ');

    // Admin & Super Admin have full unrestricted access to all routes
    if (norm === 'admin' || norm === 'super admin' || norm === 'system administrator') {
      setResolution('allowed');
      return;
    }

    let cancelled = false;

    // Check DB-level permissions cache (user custom permissions from ACM + page visibility settings)
    permissionsCache.get().then(({ myPerms, pageSettings }) => {
      if (cancelled) return;

      const userModules = myPerms?.custom && Array.isArray(myPerms.modules) ? myPerms.modules : null;
      const allowed = resolveAllowedPages(role, pageSettings, userModules);
      setAllowedModules(allowed);

      // Check if pageKey is authorized
      if (!allowed.includes(pageKey)) {
        setDeniedReason(`Your account does not have permission to access the "${pageKey.replace(/_/g, ' ')}" module.`);
        setResolution('denied');
        return;
      }

      // Backend route validation (secondary verification)
      API.validateRoute(location.pathname).then((result: any) => {
        if (cancelled) return;
        if (result && result.success && result.allowed === false) {
          setDeniedReason(result.reason || 'Route access restricted by server security policy.');
          setResolution('denied');
          return;
        }
        setResolution('allowed');
      }).catch(() => {
        // Validation endpoint unavailable — fail open since frontend permissions passed
        setResolution('allowed');
      });
    }).catch(() => {
      // Fallback: check static role navigation map
      const roleKeys = getRoleNavMap(role);
      if (roleKeys.includes(pageKey)) {
        setResolution('allowed');
      } else {
        setDeniedReason('Access restricted for your user role.');
        setResolution('denied');
      }
    });

    return () => { cancelled = true; };
  }, [pageKey, location.pathname]);

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
    const session = Auth.get();
    const defaultDashboard = getDashboardRouteForRole(session?.role);

    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="card-glass max-w-md w-full p-8 border border-red-200/60 shadow-2xl rounded-2xl flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4 border border-red-200 shadow-inner">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-primary tracking-tight mb-2">
            Access Restricted
          </h2>
          <p className="text-xs text-primary/70 mb-6 leading-relaxed">
            {deniedReason || 'You do not have permission to view this page. Please contact your system administrator if you require access.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <Link
              to={defaultDashboard}
              className="btn-gold flex-1 py-2.5 text-xs font-black flex items-center justify-center gap-2 rounded-xl shadow-sm"
            >
              <Home className="w-4 h-4" />
              <span>Return to Dashboard</span>
            </Link>
          </div>
          <div className="mt-4 text-[10px] text-primary/40 font-medium">
            Session active: @{session?.username || 'user'} ({session?.role || 'Staff'})
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
