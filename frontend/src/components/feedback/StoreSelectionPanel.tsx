import React, { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ChevronLeft,
  ArrowRight,
  MapPin,
  RotateCcw,
  ShieldCheck,
  Download,
  Copy,
  Check,
  Maximize2,
  X,
  QrCode,
  Sparkles,
  ExternalLink
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
        className="bfx-qr-grid"
        data-count="3"
        role="status"
        aria-busy="true"
        aria-label="Loading store access"
      >
        {[0, 1, 2].map((i) => (
          <div className="bfx-qr-card bfx-qr-card--skeleton" key={i} aria-hidden="true">
            <div className="bfx-qr-skeleton" style={{ width: '60%', height: '1.5rem', marginBottom: '0.5rem' }} />
            <div className="bfx-qr-skeleton" style={{ width: '85%', height: '0.875rem', marginBottom: '1rem' }} />
            <div className="bfx-qr-skeleton" style={{ width: '100%', height: '220px', borderRadius: '14px', marginBottom: '1rem' }} />
            <div className="bfx-qr-skeleton" style={{ width: '100%', height: '48px', borderRadius: '12px' }} />
          </div>
        ))}
      </div>
    );
  } else if (access.state === 'error') {
    content = (
      <div className="bfx-qr-state-card" role="alert">
        <span className="bfx-qr-state-icon" aria-hidden="true">
          <AlertCircle size={24} />
        </span>
        <h2 className="bfx-qr-state-title">Unable to load store access</h2>
        <p className="bfx-qr-state-note">
          Please check your connection or contact administrator to get access.
        </p>
        <button type="button" className="bfx-qr-btn-primary" style={{ width: 'auto', minWidth: '160px' }} onClick={handleRetry}>
          <RotateCcw size={16} />
          <span>Try again</span>
        </button>
      </div>
    );
  } else if (access.state === 'empty') {
    content = (
      <div className="bfx-qr-state-card" role="status">
        <span className="bfx-qr-state-icon" aria-hidden="true">
          <MapPin size={24} />
        </span>
        <h2 className="bfx-qr-state-title">No store assigned</h2>
        <p className="bfx-qr-state-note">
          No store location has been assigned to your account. Please contact your administrator.
        </p>
        <Link to="/" className="bfx-qr-btn-primary" style={{ width: 'auto', minWidth: '180px', textDecoration: 'none' }}>
          Back to BSC Textiles
        </Link>
      </div>
    );
  } else {
    content = (
      <div
        className="bfx-qr-grid"
        data-count={String(access.stores.length)}
        role="group"
        aria-label="Choose a BSC Textiles store or scan feedback QR"
      >
        {access.stores.map((store) => (
          <article key={store.code} className="bfx-qr-card">
            {/* Top Store Info */}
            <div>
              <div className="bfx-qr-card-header">
                <div className="bfx-qr-card-meta">
                  <h2 className="bfx-qr-card-city">{store.city}</h2>
                  <p className="bfx-qr-card-storename">{store.storeName}</p>
                </div>
                <span className="bfx-qr-code-pill" title={`Location code: ${store.code}`}>
                  <QrCode size={11} aria-hidden="true" />
                  <span>{store.code}</span>
                </span>
              </div>

              {/* Address */}
              <p className="bfx-qr-address" style={{ marginTop: '0.625rem' }}>
                {store.address}
              </p>
            </div>

            {/* Interactive Feedback QR Box */}
            <div
              className="bfx-qr-box"
              onClick={() => setModalStore(store)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setModalStore(store);
                }
              }}
              title={`Click to enlarge ${store.city} Feedback QR Code`}
              aria-label={`Enlarge ${store.city} Feedback QR Code`}
            >
              <div className="bfx-qr-corners" aria-hidden="true">
                <span className="bfx-qr-corner bfx-qr-corner-tl" />
                <span className="bfx-qr-corner bfx-qr-corner-tr" />
                <span className="bfx-qr-corner bfx-qr-corner-bl" />
                <span className="bfx-qr-corner bfx-qr-corner-br" />
              </div>
              <img
                src={getStoreQrUrl(store.code, 320)}
                alt={`${store.city} Feedback QR Code`}
                className="bfx-qr-img"
                width={200}
                height={200}
                loading="lazy"
                decoding="async"
              />
              <span className="bfx-qr-caption">
                Scan with smartphone camera
              </span>
            </div>

            {/* Public Link Box */}
            <div className="bfx-qr-link-box" title={getStoreTargetUrl(store.code)}>
              <span className="bfx-qr-link-text">
                bsctextiles.in/feedback-public?location={store.code}
              </span>
              <button
                type="button"
                className="bfx-qr-mini-copy"
                onClick={(e) => handleCopyLink(store, e)}
                title="Copy link"
                aria-label={`Copy link for ${store.city}`}
              >
                {copiedCode === store.code ? (
                  <Check size={14} className="bfx-qr-copied-text" aria-hidden="true" />
                ) : (
                  <Copy size={14} aria-hidden="true" />
                )}
              </button>
            </div>

            {/* Actions: Primary CTA + Secondary Toolbar */}
            <div className="bfx-qr-actions">
              <button
                type="button"
                className="bfx-qr-btn-primary"
                onClick={() => onSelect(store)}
              >
                <span>Open Feedback</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>

              <div className="bfx-qr-secondary-row">
                <button
                  type="button"
                  className="bfx-qr-btn-secondary"
                  onClick={() => setModalStore(store)}
                  title="Enlarge QR for full counter display"
                >
                  <Maximize2 size={13} aria-hidden="true" />
                  <span>Enlarge</span>
                </button>

                <button
                  type="button"
                  className="bfx-qr-btn-secondary"
                  onClick={(e) => handleDownloadPng(store, e)}
                  title="Download PNG for print/display"
                >
                  <Download size={13} aria-hidden="true" />
                  <span>Download</span>
                </button>

                <button
                  type="button"
                  className="bfx-qr-btn-secondary"
                  onClick={(e) => handleCopyLink(store, e)}
                  title="Copy direct survey link"
                >
                  {copiedCode === store.code ? (
                    <>
                      <Check size={13} className="bfx-qr-copied-text" aria-hidden="true" />
                      <span className="bfx-qr-copied-text">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} aria-hidden="true" />
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
    <div className="bfx-qr-page">
      {/* Accessibility Skip Link */}
      <a href="#bsc-feedback-main" className="bfx-qr-skip">
        Skip to main content
      </a>

      {/* Top Header */}
      <header className="bfx-qr-header">
        <div className="bfx-qr-container">
          <div className="bfx-qr-header-row">
            <Link
              to="/"
              className="bfx-qr-brand"
              aria-label="BSC Textiles — back to home"
            >
              <picture className="bfx-qr-logo-wrap">
                <source srcSet="/logo.webp" type="image/webp" />
                <img
                  className="bfx-qr-logo-img"
                  src="/logo.png"
                  alt="BSC Textiles"
                  width={52}
                  height={52}
                  loading="eager"
                  decoding="async"
                />
              </picture>
              <div className="bfx-qr-brand-text">
                <span className="bfx-qr-brand-title">BSC Textiles</span>
                <span className="bfx-qr-brand-sub">
                  Customer Feedback <span className="bfx-qr-brand-tag">· QR Codes</span>
                </span>
              </div>
            </Link>

            <Link to="/" className="bfx-qr-back-btn">
              <ChevronLeft aria-hidden="true" />
              <span>Back to Website</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bfx-qr-hero">
        <div className="bfx-qr-container">
          <div className="bfx-qr-hero-content">
            <span className="bfx-qr-badge">
              <Sparkles aria-hidden="true" />
              <span>Customer Experience</span>
            </span>

            <h1 className="bfx-qr-title">
              Customer Feedback QR Codes
            </h1>

            <p className="bfx-qr-subtitle">
              Scan the QR code at your store to share your shopping experience with BSC Textiles.
            </p>

            <span className="bfx-qr-accent-note">
              ✦ Your feedback helps us serve you better.
            </span>

            {/* Store Access Indicator Pill */}
            <div className="bfx-qr-access-pill" role="status">
              <MapPin aria-hidden="true" />
              <span className="bfx-qr-access-label">ACCESS</span>
              <span className="bfx-qr-access-sep">•</span>
              <span className="bfx-qr-access-val">{access.accessLabel || 'All Stores'}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="bfx-qr-main" id="bsc-feedback-main">
        <div className="bfx-qr-container">
          {content}
        </div>
      </main>

      {/* Enlarge QR Modal */}
      {modalStore && (
        <div
          className="bfx-qr-modal-backdrop"
          onClick={() => setModalStore(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`${modalStore.city} feedback QR code`}
        >
          <div className="bfx-qr-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="bfx-qr-modal-close"
              onClick={() => setModalStore(null)}
              aria-label="Close modal"
            >
              <X size={16} aria-hidden="true" />
            </button>

            <span className="bfx-qr-code-pill" style={{ marginBottom: '0.625rem' }}>
              Store Feedback QR · {modalStore.code}
            </span>

            <h2 className="bfx-qr-card-city" style={{ margin: '0.25rem 0 0', fontSize: '1.5rem' }}>
              BSC Textiles — {modalStore.city}
            </h2>
            <p className="bfx-qr-card-storename" style={{ margin: '0.25rem 0 0.875rem', fontSize: '0.8125rem' }}>
              {modalStore.storeName}
            </p>

            <div className="bfx-qr-modal-qr-wrap">
              <img
                src={getStoreQrUrl(modalStore.code, 480)}
                alt={`${modalStore.city} Feedback QR`}
                className="bfx-qr-modal-img"
                width={240}
                height={240}
                loading="lazy"
                decoding="async"
              />
            </div>

            <p style={{ margin: '0 0 0.75rem', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--bfx-ink-soft)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Point phone camera to open feedback survey
            </p>

            <div className="bfx-qr-link-box" style={{ margin: '0 auto 1rem', maxWidth: '340px' }}>
              <span className="bfx-qr-link-text">
                {getStoreTargetUrl(modalStore.code)}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <button
                type="button"
                className="bfx-qr-btn-secondary"
                style={{ minHeight: '42px', fontSize: '0.75rem' }}
                onClick={(e) => handleDownloadPng(modalStore, e)}
              >
                <Download size={14} aria-hidden="true" />
                <span>Download PNG</span>
              </button>

              <button
                type="button"
                className="bfx-qr-btn-secondary"
                style={{ minHeight: '42px', fontSize: '0.75rem' }}
                onClick={(e) => handleCopyLink(modalStore, e)}
              >
                {copiedCode === modalStore.code ? (
                  <>
                    <Check size={14} className="bfx-qr-copied-text" aria-hidden="true" />
                    <span className="bfx-qr-copied-text">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} aria-hidden="true" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>

            <button
              type="button"
              className="bfx-qr-btn-primary"
              onClick={() => {
                const s = modalStore;
                setModalStore(null);
                onSelect(s);
              }}
            >
              <span>Open Feedback Form</span>
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bfx-qr-footer">
        <div className="bfx-qr-container">
          <div className="bfx-qr-footer-content">
            <span className="bfx-qr-footer-brand">
              <Sparkles size={12} aria-hidden="true" />
              <span>BSC Textiles · Customer Experience</span>
            </span>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--bfx-ink-soft)' }}>
              Direct feedback to store management · Your feedback matters to BSC Textiles.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
