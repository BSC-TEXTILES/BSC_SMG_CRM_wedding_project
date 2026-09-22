/**
 * useUrlGuard — URL Navigation Monitor
 * ─────────────────────────────────────
 * Monitors pathname transitions. Does NOT destroy authenticated sessions or force-logout users.
 * Authoritative access validation is handled gracefully by RouteGuard.
 */

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Auth } from '../services/api';

export function useUrlGuard(): void {
  const location = useLocation();
  const lastCheckedPath = useRef<string>('');

  useEffect(() => {
    const pathname = location.pathname;
    if (pathname === lastCheckedPath.current) return;
    lastCheckedPath.current = pathname;

    if (!Auth.check()) return;
    const session = Auth.get();
    if (!session?.role) return;

    // Track navigation for session analytics without disrupting active sessions
  }, [location.pathname]);
}
