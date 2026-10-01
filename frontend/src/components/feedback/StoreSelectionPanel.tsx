import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  MapPin,
  RotateCcw,
  ShieldCheck
} from 'lucide-react';
import { Auth } from '../../services/api';
import type { UserSession } from '../../services/api';
import { useLocationContext } from '../../context/LocationContext';
import type { LocationStatus } from '../../context/LocationContext';
import type { CentralStoreLocation } from '../../config/storeLocations';
import { resolveFeedbackStoreAccess } from './storeAccess';
import './storeSelection.css';

interface StoreSelectionPanelProps {
  onSelect: (store: CentralStoreLocation) => void;
}

/** Current signed-in session, or null for a public customer. */
function readSession(): UserSession | null {
  try {
    return Auth.check() ? Auth.get() : null;
  } catch {
    return null;
  }
}

/**
 * Customer Feedback location-selection screen.
 *
 * Renders the website's own header, typography and store-card language, and
 * lists only the stores the current user's existing role/location permissions
 * allow. Public visitors keep the full public store list.
 */
export default function StoreSelectionPanel({ onSelect }: StoreSelectionPanelProps) {
  const { locationStatus } = useLocationContext();
  const [session, setSession] = useState<UserSession | null>(() => readSession());

  // Stay in sync with sign-in / sign-out (same tab and other tabs) without
  // adding any API call — permissions already live in the session.
  useEffect(() => {
    const sync = () => setSession(readSession());
    window.addEventListener('bsc_auth_changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('bsc_auth_changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const [statusGraceElapsed, setStatusGraceElapsed] = useState(locationStatus !== 'loading');

  // The shared location lookup is app-wide state: a slow response must never
  // leave signed-in staff on the skeleton forever. Permissions come from the
  // local session, so after a short grace period we resolve from those.
  useEffect(() => {
    if (locationStatus !== 'loading') {
      setStatusGraceElapsed(true);
      return;
    }
    const timer = window.setTimeout(() => setStatusGraceElapsed(true), 2500);
    return () => window.clearTimeout(timer);
  }, [locationStatus]);

  const effectiveStatus: LocationStatus =
    locationStatus === 'error'
      ? 'error'
      : locationStatus === 'loading' && !statusGraceElapsed
        ? 'loading'
        : 'ready';

  const access = useMemo(
    () => resolveFeedbackStoreAccess(session, effectiveStatus),
    [session, effectiveStatus]
  );

  const handleRetry = () => setSession(readSession());

  let content: ReactNode = null;

  if (access.state === 'loading') {
    content = (
      <div
        className="bsc-fb-grid"
        data-count="3"
        role="status"
        aria-busy="true"
        aria-label="Loading your store access"
      >
        {[0, 1, 2].map((i) => (
          <div className="bsc-fb-store bsc-fb-store--skeleton" key={i} aria-hidden="true">
            <span className="bsc-fb-store-icon">
              <span className="bsc-ed-skeleton bsc-fb-skeleton-icon" />
            </span>
            <span className="bsc-ed-skeleton" style={{ width: '55%', height: '1.25rem' }} />
            <span className="bsc-ed-skeleton" style={{ width: '80%' }} />
            <span className="bsc-ed-skeleton" style={{ width: '92%' }} />
            <span
              className="bsc-ed-skeleton"
              style={{ width: '45%', marginTop: 'auto', height: '0.875rem' }}
            />
          </div>
        ))}
      </div>
    );
  } else if (access.state === 'error') {
    content = (
      <div className="bsc-fb-state" role="alert">
        <span className="bsc-fb-state-icon" aria-hidden="true">
          <AlertCircle size={20} strokeWidth={1.75} />
        </span>
        <p className="bsc-fb-state-title">Unable to load your store access. Please try again.</p>
        <div className="bsc-fb-state-actions">
          <button type="button" className="bsc-ed-btn bsc-ed-btn-ghost" onClick={handleRetry}>
            <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />
            <span>Try again</span>
          </button>
        </div>
      </div>
    );
  } else if (access.state === 'empty') {
    content = (
      <div className="bsc-fb-state" role="status">
        <span className="bsc-fb-state-icon" aria-hidden="true">
          <MapPin size={20} strokeWidth={1.75} />
        </span>
        <p className="bsc-fb-state-title">No store location has been assigned to your account.</p>
        <p className="bsc-fb-state-note">
          Please contact your administrator to get access to a BSC Textiles store.
        </p>
        <div className="bsc-fb-state-actions">
          <Link to="/" className="bsc-ed-btn bsc-ed-btn-ghost">
            Back to BSC Textiles
          </Link>
        </div>
      </div>
    );
  } else {
    content = (
      <div
        className="bsc-fb-grid"
        data-count={String(access.stores.length)}
        role="group"
        aria-label="Choose a BSC Textiles store"
      >
        {access.stores.map((store) => (
          <button
            key={store.code}
            type="button"
            className="bsc-fb-store"
            onClick={() => onSelect(store)}
          >
            <span className="bsc-fb-store-icon" aria-hidden="true">
              <MapPin size={18} strokeWidth={1.75} />
            </span>
            <span className="bsc-fb-store-city bsc-ed-serif">{store.city}</span>
            <span className="bsc-fb-store-name">{store.storeName}</span>
            <span className="bsc-fb-store-address">{store.address}</span>
            <span className="bsc-fb-store-cta">
              <span>Select Store</span>
              <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="bsc-ed-page bsc-fb-page">
      <a href="#bsc-feedback-main" className="bsc-ed-skip">
        Skip to main content
      </a>

      <header className="bsc-ed-nav">
        <div className="bsc-ed-shell">
          <div className="bsc-ed-nav-row">
            <Link
              to="/"
              className="bsc-ed-wordmark bsc-ed-serif"
              aria-label="BSC Textiles — back to the website"
            >
              <picture className="bsc-ed-logo-wrap">
                <source srcSet="/logo.webp" type="image/webp" />
                <img
                  className="bsc-ed-logo"
                  src="/logo.png"
                  alt="BSC Textiles"
                  width={360}
                  height={270}
                  loading="eager"
                  decoding="async"
                />
              </picture>
              <span className="bsc-ed-wordmark-text">
                <b>BSC Textiles</b>
                <span className="bsc-ed-wordmark-mark">Est. 1938</span>
              </span>
            </Link>

            <Link to="/" className="bsc-fb-back">
              <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
              <span>Back to website</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="bsc-fb-main" id="bsc-feedback-main">
        <section className="bsc-fb-section" aria-labelledby="bsc-feedback-title">
          <div className="bsc-ed-shell">
            <div className="bsc-fb-head">
              <p className="bsc-ed-label">Tell us about your visit</p>
              <h1 id="bsc-feedback-title" className="bsc-ed-h2 bsc-ed-serif">
                BSC Customer Feedback
              </h1>
              <p className="bsc-ed-lede">
                Please select the BSC Textiles store you visited today to start your feedback.
              </p>
              {access.authenticated && access.state === 'ready' && access.accessLabel && (
                <p className="bsc-fb-access">
                  <MapPin size={14} strokeWidth={1.75} aria-hidden="true" />
                  <span>
                    Access · <strong>{access.accessLabel}</strong>
                  </span>
                </p>
              )}
            </div>

            {content}
          </div>
        </section>
      </main>

      <footer className="bsc-fb-footer">
        <div className="bsc-ed-shell">
          <p className="bsc-fb-trust">
            <ShieldCheck size={14} strokeWidth={1.75} aria-hidden="true" />
            <span>Direct feedback to store management</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
