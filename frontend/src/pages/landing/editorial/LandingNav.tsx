import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BRAND,
  CTA_LOGIN,
  CTA_REGISTER,
  LOGIN_PATH,
  NAV_ITEMS,
  WEDDING_REGISTRATION_PATH
} from './content';

interface LandingNavProps {
  activeSection: string;
  onNavigate: (id: string) => void;
}

/**
 * Minimal landing navigation. The brand is set as a typographic wordmark rather
 * than a logo file, so the landing page loads no images at all.
 */
export default function LandingNav({ activeSection, onNavigate }: LandingNavProps) {
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);

  const go = useCallback((id: string) => {
    setOpen(false);
    onNavigate(id);
  }, [onNavigate]);

  // Close on Escape, and on any pointer press outside the header.
  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open]);

  // Leaving the route closes the menu; body scroll is never locked, so there is
  // no chance of a stuck overflow:hidden if the component unmounts while open.
  useEffect(() => { setOpen(false); }, []);

  return (
    <header ref={navRef} className="bsc-ed-nav">
      <div className="bsc-ed-shell">
        <div className="bsc-ed-nav-row">
          <button
            type="button"
            className="bsc-ed-wordmark bsc-ed-serif"
            onClick={() => go('hero')}
            aria-label={`${BRAND} — back to top`}
          >
            {/* WebP where supported, the official PNG (same file the app shell
                uses) as fallback. Height fixed + width auto preserves the
                logo's native 4:3 ratio so it is never stretched. */}
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
              <b>{BRAND}</b>
              <span className="bsc-ed-wordmark-mark">Est. 1938</span>
            </span>
          </button>

          <nav className="bsc-ed-links" aria-label="Landing page sections">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`bsc-ed-link ${activeSection === item.id ? 'bsc-ed-link-active' : ''}`}
                onClick={() => go(item.id === 'home' ? 'hero' : item.id)}
                aria-current={activeSection === item.id ? 'true' : undefined}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="bsc-ed-nav-actions">
            <Link to={LOGIN_PATH} className="bsc-ed-login">
              {CTA_LOGIN}
            </Link>
            <Link to={WEDDING_REGISTRATION_PATH} className="bsc-ed-btn bsc-ed-btn-primary bsc-ed-nav-cta">
              {CTA_REGISTER}
            </Link>
          </div>

          <button
            type="button"
            className="bsc-ed-menu-btn"
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            aria-controls="bsc-mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            <span aria-hidden="true">{open ? '✕' : '☰'}</span>
          </button>
        </div>
      </div>

      {open && (
        <div className="bsc-ed-mobile-panel" id="bsc-mobile-menu">
          <div className="bsc-ed-shell">
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {NAV_ITEMS.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="bsc-ed-mobile-link"
                    onClick={() => go(item.id === 'home' ? 'hero' : item.id)}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
            <Link
              to={WEDDING_REGISTRATION_PATH}
              className="bsc-ed-btn bsc-ed-btn-primary bsc-ed-mobile-cta"
              onClick={() => setOpen(false)}
            >
              {CTA_REGISTER}
            </Link>
            <Link
              to={LOGIN_PATH}
              className="bsc-ed-btn bsc-ed-btn-ghost bsc-ed-mobile-cta"
              onClick={() => setOpen(false)}
            >
              {CTA_LOGIN}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
