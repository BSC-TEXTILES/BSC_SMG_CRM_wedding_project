import React, { useEffect, useState, useMemo } from 'react';
import { Navigate, useLocation, Link, useNavigate } from 'react-router-dom';
import { Auth } from '../services/api';
import { getDefaultLandingRoute } from '../utils/moduleRegistry';
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
  const navigate = useNavigate();

  // Lazy-initialize resolution to eliminate loading spinner flicker for pre-authorized sessions
  const [resolution, setResolution] = useState<'checking' | 'allowed' | 'denied' | 'anonymous'>(() => {
    const session = Auth.get();
    if (!Auth.check() || !session) {
      return 'anonymous';
    }

    const role = session.role || '';
    const norm = role.trim().toLowerCase().replace(/[_\s-]+/g, ' ');

    // Admin & Super Admin have full unrestricted access to all routes
    if (norm === 'admin' || norm === 'super admin' || norm === 'system administrator') {
      return 'allowed';
    }

    // Direct token/session module list check
    if (Array.isArray(session.modules) && session.modules.includes(pageKey)) {
      return 'allowed';
    }

    // Base role navigation check
    const roleKeys = getRoleNavMap(role);
    if (roleKeys.includes(pageKey)) {
      return 'allowed';
    }

    return 'checking';
  });

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

      setResolution('allowed');
    }).catch(() => {
      if (cancelled) return;
      // Fallback: check static role navigation map
      const roleKeys = getRoleNavMap(role);
      setAllowedModules(roleKeys);
      if (roleKeys.includes(pageKey)) {
        setResolution('allowed');
      } else {
        setDeniedReason('Access restricted for your user role.');
        setResolution('denied');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [pageKey, location.pathname]);

  const returnRoute = useMemo(() => {
    const session = Auth.get();
    return getDefaultLandingRoute(session, allowedModules);
  }, [allowedModules]);

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

    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center select-none font-sans">
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
            <button
              type="button"
              onClick={() => {
                if (window.history.length > 1) {
                  navigate(-1);
                } else {
                  navigate(returnRoute);
                }
              }}
              className="px-4 py-2.5 text-xs font-bold text-primary/80 bg-white border border-[#DFDDD7] hover:bg-neutral-50 rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Go Back</span>
            </button>
            <Link
              to={returnRoute}
              className="btn-gold flex-1 py-2.5 text-xs font-black flex items-center justify-center gap-2 rounded-xl shadow-sm"
            >
              <Home className="w-4 h-4" />
              <span>{returnRoute === '/no-access' ? 'View Account Status' : 'Return to Workspace'}</span>
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
