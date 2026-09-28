import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ShieldAlert, XOctagon } from 'lucide-react';
import { Auth, API } from '../services/api';
import { NotificationService } from '../services/notificationService';
import { DevToolsDetector } from '../services/devToolsDetector';

const SHIELD_FLAG_KEY = 'bsc_shield_enabled';

/**
 * The shield protects staff data, so it never runs on the public marketing and
 * kiosk surfaces. Its detector writes to the console on every cycle, which would
 * otherwise spam the landing page.
 */
function isPublicGuardPath(pathname: string): boolean {
  return pathname === '/'
    || pathname.startsWith('/madt')
    || pathname.startsWith('/feedback')
    || pathname === '/login'
    || pathname === '/apply';
}

function readCachedFlag(): boolean {
  try {
    return localStorage.getItem(SHIELD_FLAG_KEY) === 'true';
  } catch {
    return false;
  }
}

export default function DevToolsGuard() {
  const location = useLocation();
  const isPublicPage = isPublicGuardPath(location.pathname);
  const [armed, setArmed] = useState<boolean>(() => !isPublicGuardPath(typeof window !== 'undefined' ? window.location.pathname : '') && readCachedFlag());
  const [isOpen, setIsOpen] = useState(false);
  const [bypass, setBypass] = useState(false);

  // Sync bypass state from localStorage and custom events
  useEffect(() => {
    const updateBypass = () => {
      try {
        const bp = localStorage.getItem('bsc_shield_bypass') === 'true';
        setBypass(bp);
      } catch {
        setBypass(false);
      }
    };
    updateBypass();
    window.addEventListener('dev_tools_bypass_changed', updateBypass);
    window.addEventListener('storage', updateBypass);
    return () => {
      window.removeEventListener('dev_tools_bypass_changed', updateBypass);
      window.removeEventListener('storage', updateBypass);
    };
  }, []);

  // Synchronize shield armed state from server (on mount, window focus, interval, and Socket.IO push)
  useEffect(() => {
    if (isPublicPage) {
      return;
    }

    let disposed = false;

    const fetchStatus = async () => {
      try {
        const res = await API.getShieldStatus();
        const enabled = res && res.enabled === true;
        try {
          localStorage.setItem(SHIELD_FLAG_KEY, enabled ? 'true' : 'false');
        } catch {}
        if (!disposed) {
          setArmed(enabled);
          DevToolsDetector.arm(enabled);
        }
      } catch {
        /* offline fallback */
      }
    };

    // Stagger initial check slightly so it doesn't collide with socket connection
    const initialTimer = window.setTimeout(fetchStatus, 500);

    // Fallback sync every 60s (Socket.IO handles instant updates)
    const intervalId = window.setInterval(fetchStatus, 60_000);

    // Recheck on window focus
    const onFocus = () => {
      fetchStatus();
    };
    window.addEventListener('focus', onFocus);

    const unsubscribe = NotificationService.onShieldChanged((enabled) => {
      if (!disposed) {
        setArmed(enabled);
        DevToolsDetector.arm(enabled);
        try {
          localStorage.setItem(SHIELD_FLAG_KEY, enabled ? 'true' : 'false');
        } catch {}
      }
    });

    return () => {
      disposed = true;
      window.clearTimeout(initialTimer);
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      unsubscribe();
    };
  }, [isPublicPage]);

  // Subscribe to live DevToolsDetector state
  useEffect(() => {
    if (isPublicPage) {
      return;
    }

    const unsub = DevToolsDetector.subscribe((state) => {
      setIsOpen(prev => prev !== state.isOpen ? state.isOpen : prev);
    });
    return unsub;
  }, [isPublicPage]);

  // Arm/disarm the detector. Public surfaces stay disarmed even when a cached
  // flag from an earlier staff session says the shield is on; navigating into the
  // app re-arms via this effect, and the server sync below confirms the flag.
  useEffect(() => {
    if (isPublicPage) {
      DevToolsDetector.arm(false);
      setIsOpen(false);
      return;
    }
    DevToolsDetector.arm(armed);
  }, [armed, isPublicPage]);

  // If shield is off, or DevTools are closed, or admin has bypassed protection, do not block screen
  const session = Auth.get();
  const isAdmin = session?.role === 'Admin' || session?.role === 'Super Admin';
  // Allow Admins to view the Admin Dashboard (/dashboard), Settings (/settings), and System Administrator (/system-admin) without blocking screen
  // so they can monitor telemetry and configure DevTools detection live
  const isAdminMonitoringPage = location.pathname === '/dashboard' || location.pathname === '/settings' || location.pathname === '/system-admin';
  const shouldBlock = !isPublicPage && armed && isOpen && !(isAdmin && (bypass || isAdminMonitoringPage));

  if (!shouldBlock) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="devtools-guard-title"
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-primary/95 backdrop-blur-sm px-4 animate-fade-in select-none"
    >
      <div className="max-w-md w-full text-center p-6 rounded-3xl bg-black/5 border border-black/10 shadow-2xl">
        <div className="mx-auto w-20 h-20 rounded-2xl bg-[#C0392B]/15 border border-[#C0392B]/40 flex items-center justify-center mb-6 shadow-2xl">
          <XOctagon className="w-10 h-10 text-[#E57373]" strokeWidth={1.75} />
        </div>
        <h2
          id="devtools-guard-title"
          className="text-2xl font-black text-white tracking-tight mb-3"
        >
          Developer Tools Detected
        </h2>
        <p className="text-[#E8DDD4] leading-relaxed mb-2 font-medium text-sm">
          For the security of customer and business data, this application is
          locked while developer tools or debuggers are open.
        </p>
        <p className="text-accent font-bold text-sm mb-6">
          Please close Developer Tools to continue using the application.
        </p>
        <div className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl bg-black/5 border border-black/10 text-[#9A8D82] text-xs font-semibold uppercase tracking-widest">
          <ShieldAlert className="w-4 h-4 text-accent" />
          <span>BSC Security Shield</span>
        </div>
      </div>
    </div>
  );
}
