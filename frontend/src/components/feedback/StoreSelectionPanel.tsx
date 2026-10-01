import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  MapPin,
  RotateCcw,
  ShieldCheck,
  Download,
  Copy,
  Check,
  Maximize2,
  X,
  QrCode
} from 'lucide-react';
import { Auth } from '../../services/api';
import type { UserSession } from '../../services/api';
import { useLocationContext } from '../../context/LocationContext';
import type { LocationStatus } from '../../context/LocationContext';
import type { CentralStoreLocation } from '../../config/storeLocations';
import { resolveFeedbackStoreAccess } from './storeAccess';
import { showToast } from '../Toast';
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
 * Renders the official Customer Feedback QR codes for each BSC store (Belagavi,
 * Davanagere, Shivamogga) with instant smartphone camera scanning, PNG downloads,
 * link copy, and online direct response.
 */
export default function StoreSelectionPanel({ onSelect }: StoreSelectionPanelProps) {
  const { locationStatus } = useLocationContext();
  const [session, setSession] = useState<UserSession | null>(() => readSession());
  const [modalStore, setModalStore] = useState<CentralStoreLocation | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

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

  const getStoreTargetUrl = (code: string) => `https://bsctextiles.in/feedback-public?location=${code}`;

  const getStoreQrUrl = (code: string, size = 400) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(getStoreTargetUrl(code))}`;

  const handleCopyLink = (store: CentralStoreLocation, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const url = getStoreTargetUrl(store.code);
    navigator.clipboard.writeText(url);
    setCopiedCode(store.code);
    showToast(`${store.city} feedback link copied!`, 'success');
    setTimeout(() => setCopiedCode(null), 2200);
  };

  const handleDownloadPng = async (store: CentralStoreLocation, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const qrUrl = getStoreQrUrl(store.code, 600);
      const res = await fetch(qrUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `BSC_Feedback_QR_${store.code}_${store.city}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      showToast(`${store.city} QR Code downloaded.`, 'success');
    } catch {
      window.open(getStoreQrUrl(store.code, 600), '_blank');
      showToast(`${store.city} QR Code opened for download.`, 'info');
    }
  };

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
        aria-label="Choose a BSC Textiles store or scan feedback QR"
      >
        {access.stores.map((store) => (
          <article key={store.code} className="bsc-fb-card">
            {/* Top Store Info */}
            <div className="bsc-fb-card-top">
              <div className="bsc-fb-card-meta">
                <span className="bsc-fb-store-city bsc-ed-serif">{store.city}</span>
                <span className="bsc-fb-store-name">{store.storeName}</span>
              </div>
              <span className="bsc-fb-badge bsc-fb-badge--active" title={`Location code: ${store.code}`}>
                <QrCode size={11} strokeWidth={2.5} />
                <span>{store.code}</span>
              </span>
            </div>

            <p className="bsc-fb-store-address">{store.address}</p>

            {/* Interactive Feedback QR Preview Box */}
            <div
              className="bsc-fb-qr-frame"
              onClick={() => setModalStore(store)}
              title={`Click to enlarge ${store.city} Feedback QR Code`}
            >
              <div className="bsc-fb-qr-corners">
                <span className="bsc-fb-corner bsc-fb-corner-tl" />
                <span className="bsc-fb-corner-tr" />
                <span className="bsc-fb-corner-bl" />
                <span className="bsc-fb-corner-br" />
              </div>
              <img
                src={getStoreQrUrl(store.code, 320)}
                alt={`${store.city} Feedback QR Code`}
                className="bsc-fb-qr-img"
                loading="lazy"
              />
              <span className="bsc-fb-qr-caption">
                Scan with smartphone camera
              </span>
            </div>

            <div className="bsc-fb-qr-url-pill" title={getStoreTargetUrl(store.code)}>
              bsctextiles.in/feedback-public?location={store.code}
            </div>

            {/* Quick Actions */}
            <div className="bsc-fb-actions-group">
              <button
                type="button"
                className="bsc-fb-btn-fill"
                onClick={() => onSelect(store)}
              >
                <span>Fill Feedback Here</span>
                <ChevronRight size={16} strokeWidth={2} />
              </button>

              <div className="bsc-fb-btn-actions">
                <button
                  type="button"
                  className="bsc-fb-tool-btn"
                  onClick={() => setModalStore(store)}
                  title="Enlarge QR for full counter display"
                >
                  <Maximize2 size={13} strokeWidth={2} />
                  <span>Enlarge</span>
                </button>

                <button
                  type="button"
                  className="bsc-fb-tool-btn"
                  onClick={(e) => handleDownloadPng(store, e)}
                  title="Download PNG for print/display"
                >
                  <Download size={13} strokeWidth={2} />
                  <span>Download</span>
                </button>

                <button
                  type="button"
                  className="bsc-fb-tool-btn"
                  onClick={(e) => handleCopyLink(store, e)}
                  title="Copy direct survey link"
                >
                  {copiedCode === store.code ? (
                    <>
                      <Check size={13} strokeWidth={2} className="text-emerald-600" />
                      <span className="text-emerald-600">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} strokeWidth={2} />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </article>
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
              <p className="bsc-ed-label">Customer Feedback & QR Codes</p>
              <h1 id="bsc-feedback-title" className="bsc-ed-h2 bsc-ed-serif">
                BSC Customer Feedback QR
              </h1>
              <p className="bsc-ed-lede">
                Scan the QR code with your smartphone camera to submit feedback instantly, or select your store to complete your review directly.
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

      {/* Enlarge QR Modal for Kiosk / Counter Display */}
      {modalStore && (
        <div className="bsc-fb-modal-backdrop" onClick={() => setModalStore(null)}>
          <div className="bsc-fb-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="bsc-fb-modal-close"
              onClick={() => setModalStore(null)}
              aria-label="Close modal"
            >
              <X size={18} />
            </button>

            <span className="bsc-fb-badge bsc-fb-badge--active" style={{ marginBottom: '0.5rem' }}>
              Store Feedback QR · {modalStore.code}
            </span>
            <h3 className="bsc-ed-serif" style={{ margin: '0.25rem 0', fontSize: '1.5rem', color: 'var(--ed-ink)' }}>
              BSC Textiles — {modalStore.city}
            </h3>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--ed-ink-soft)' }}>
              {modalStore.storeName}
            </p>

            <div className="bsc-fb-modal-qr-wrap">
              <img
                src={getStoreQrUrl(modalStore.code, 480)}
                alt={`${modalStore.city} Feedback QR`}
                className="bsc-fb-modal-qr-img"
              />
            </div>

            <p style={{ margin: '0.5rem 0 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--ed-ink-soft)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Point phone camera to open feedback survey
            </p>

            <div className="bsc-fb-qr-url-pill" style={{ margin: '0 auto 1.25rem', maxWidth: '320px' }}>
              {getStoreTargetUrl(modalStore.code)}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <button
                type="button"
                className="bsc-fb-tool-btn"
                style={{ padding: '0.625rem 0.5rem', fontSize: '0.75rem' }}
                onClick={(e) => handleDownloadPng(modalStore, e)}
              >
                <Download size={14} />
                <span>Download PNG</span>
              </button>

              <button
                type="button"
                className="bsc-fb-tool-btn"
                style={{ padding: '0.625rem 0.5rem', fontSize: '0.75rem' }}
                onClick={(e) => handleCopyLink(modalStore, e)}
              >
                {copiedCode === modalStore.code ? (
                  <>
                    <Check size={14} className="text-emerald-600" />
                    <span className="text-emerald-600">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>

            <button
              type="button"
              className="bsc-fb-btn-fill"
              onClick={() => {
                const s = modalStore;
                setModalStore(null);
                onSelect(s);
              }}
            >
              <span>Fill Feedback on this Screen</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

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
