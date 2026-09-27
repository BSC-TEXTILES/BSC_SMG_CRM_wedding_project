import { useEffect } from 'react';
import { Auth } from '../services/api';

/**
 * SessionTimeoutGuard
 * ───────────────────
 * Absolute 6-hour session lifetime, enforced in the client as a final safety
 * net (the server enforces the same limit through the JWT expiry and the
 * httpOnly cookie max-age). Every 60 seconds the guard checks the session
 * age; when the 6-hour window is exceeded the user is signed out fully -
 * server logout (cookie cleared + audit trail), local session wipe and
 * redirect to the sign-in screen.
 */

const SESSION_MS = 6 * 60 * 60 * 1000; // 6 hours
const CHECK_INTERVAL_MS = 60 * 1000;   // 1 minute

export default function SessionTimeoutGuard() {
  useEffect(() => {
    const tick = () => {
      const session = Auth.get();
      if (!session) return; // not signed in - nothing to do
      const startedAt = session.loginAt || 0;
      if (Date.now() - startedAt > SESSION_MS) {
        Auth.logout();
      }
    };
    tick();
    const timer = window.setInterval(tick, CHECK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  return null;
}
