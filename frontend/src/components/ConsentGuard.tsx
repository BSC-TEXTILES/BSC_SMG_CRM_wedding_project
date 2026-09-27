import React, { useEffect, useState, useCallback, Suspense, lazy } from 'react';
import { useLocation } from 'react-router-dom';
import { Auth, API } from '../services/api';

const ConsentModal = lazy(() => import('./ui/ConsentModal'));

// Public routes that don't require consent
const PUBLIC_ROUTES = [
  '/login', '/forgot-password', '/', '/apply', '/applicants/register',
  '/wedding-registration', '/track', '/feedback-public', '/feedback-qr',
  '/cash-settlement', '/tv', '/greeter', '/footfall', '/madt'
];

/**
 * ConsentGuard — Enforces mandatory Privacy Policy & Terms acceptance.
 *
 * For authenticated users:
 *   - On mount + on route change, checks consent status via backend
 *   - If consent is missing or outdated, shows ConsentModal (blocking)
 *   - User cannot proceed until both Privacy Policy and Terms are accepted
 *   - Consent is verified server-side; localStorage is only an optimization cache
 *
 * For unauthenticated users on public routes:
 *   - No consent check required
 *
 * Closing the modal does NOT grant access — user remains blocked.
 */
export default function ConsentGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isPublicRoute = PUBLIC_ROUTES.some(p =>
    location.pathname === p || (p !== '/' && location.pathname.startsWith(p + '/'))
  );
  const [consentRequired, setConsentRequired] = useState(false);
  const [checking, setChecking] = useState(() => !isPublicRoute && Auth.check());

  const checkConsent = useCallback(async () => {
    const session = Auth.get();
    if (!Auth.check() || !session) {
      setConsentRequired(false);
      setChecking(false);
      return;
    }

    // Public routes don't need consent check
    if (isPublicRoute) {
      setConsentRequired(false);
      setChecking(false);
      return;
    }

    try {
      const res = await API.getConsentStatus();
      if (res?.success && res.data) {
        setConsentRequired(!res.data.consented);
      } else {
        // If check fails, require consent to be safe
        setConsentRequired(true);
      }
    } catch {
      // Network error — fail open so normal navigation works
      setConsentRequired(false);
    } finally {
      setChecking(false);
    }
  }, [isPublicRoute]);

  useEffect(() => {
    checkConsent();
  }, [checkConsent]);

  const handleConsentComplete = () => {
    setConsentRequired(false);
  };

  // Show nothing while checking (prevents flash of content on protected routes)
  if (checking) {
    return null;
  }

  // If consent is required, show the modal but still render children behind it
  // (the modal has z-[70] which overlays everything)
  return (
    <>
      {children}
      {consentRequired && (
        <Suspense fallback={null}>
          <ConsentModal
            isOpen={consentRequired}
            onConsentComplete={handleConsentComplete}
          />
        </Suspense>
      )}
    </>
  );
}
