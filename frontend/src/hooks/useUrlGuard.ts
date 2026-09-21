/**
 * useUrlGuard — Real-time URL manipulation detection hook
 * ────────────────────────────────────────────────────────
 * Monitors location.pathname changes (including browser back/forward,
 * address bar typed URLs) and cross-references against the user's role.
 *
 * If the new path is unauthorized → calls SecurityManager.forceLogout().
 *
 * This hook is mounted once in App.tsx (inside the Router) so it catches
 * ALL navigation events, including those that bypass the RouteGuard
 * component tree (e.g., React.lazy loading race conditions).
 */

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Auth } from '../services/api';
import { securityManager } from '../utils/securityManager';

export function useUrlGuard(): void {
  const location = useLocation();
  const lastCheckedPath = useRef<string>('');

  useEffect(() => {
    const pathname = location.pathname;

    // Don't re-check the same path
    if (pathname === lastCheckedPath.current) return;
    lastCheckedPath.current = pathname;

    // Only enforce for authenticated users
    if (!Auth.check()) return;

    const session = Auth.get();
    if (!session?.role) return;

    // Check if this URL is unauthorized for this role
    if (securityManager.isUrlManipulation(session.role, pathname)) {
      securityManager.forceLogout(
        `Role "${session.role}" attempted unauthorized access to "${pathname}"`,
        pathname
      );
    }
  }, [location.pathname]);
}
