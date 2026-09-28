import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, LogIn } from 'lucide-react';
import { NAV_LINKS } from '../content';
import { lockScroll, scrollToId } from '../motion/smoothScroll';
import { useDocumentScroll } from '../motion/hooks';

interface NavigationProps {
  ready: boolean;
  active: string;
  isStaff: boolean;
  staffRoute: string;
}

/**
 * Floating navigation. It starts weightless over the hero, then condenses into
 * a dark capsule with a hairline gold edge once the page moves — never
 * covering content, never competing with it.
 */
export default function Navigation({ ready, active, isStaff, staffRoute }: NavigationProps) {
  const [stuck, setStuck] = useState(false);
  const [progress, setProgress] = useState(0);
  const [open, setOpen] = useState(false);

  useDocumentScroll(({ y, progress: p }) => {
    setStuck(y > 24);
    setProgress((prev) => (Math.abs(prev - p) < 0.002 ? prev : p));
  });

  useEffect(() => {
    document.body.classList.toggle('site-menu-open', open);
    if (open) lockScroll(true);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('site-menu-open');
      if (open) lockScroll(false);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const go = (id: string) => {
    const wasOpen = open;
    setOpen(false);
    window.setTimeout(() => scrollToId(id), wasOpen ? 420 : 0);
  };

  return (
    <>
      <div
        className="progress"
        style={{ ['--scroll']: progress } as React.CSSProperties}
        aria-hidden="true"
      />

      <div className={`nav-shell${ready ? ' is-ready' : ''}${stuck ? ' is-stuck' : ''}`}>
        <nav className="nav" aria-label="Primary">
          <Link to="/" className="nav__brand" aria-label="BSC Textiles — home">
            <img className="nav__logo" src="/logo.webp" width={50} height={38} alt="" />
            <span className="nav__brand-text">
              <span className="nav__brand-name">BSC Textiles</span>
              <span className="nav__brand-sub">Est. 1938 · Karnataka</span>
            </span>
          </Link>

          <div className="nav__links">
            {NAV_LINKS.map((link) => (
              <button
                key={link.id}
                type="button"
                className={`nav__link${active === link.id ? ' is-active' : ''}`}
                onClick={() => go(link.id)}
                aria-current={active === link.id ? 'true' : undefined}
              >
                {link.label}
              </button>
            ))}
          </div>

          <div className="nav__actions">
            <Link to={isStaff ? staffRoute : '/login'} className="btn btn--onink btn--sm">
              <LogIn className="w-3.5 h-3.5" />
              <span>{isStaff ? 'Workspace' : 'Staff login'}</span>
            </Link>
            <Link to="/wedding-registration" className="btn btn--gold btn--sm">
              <span>Reserve an hour</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <button
            type="button"
            className={`nav__burger${open ? ' is-open' : ''}`}
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            <i />
            <i />
          </button>
        </nav>
      </div>

      <div id="site-menu" className={`menu${open ? ' is-open' : ''}`} aria-hidden={!open}>
        <ul className="menu__list">
          {NAV_LINKS.map((link, i) => (
            <li className="menu__item" key={link.id}>
              <button
                type="button"
                className="menu__btn"
                onClick={() => go(link.id)}
                tabIndex={open ? 0 : -1}
                style={{ transitionDelay: open ? `${120 + i * 70}ms` : '0ms' }}
              >
                <span className="menu__idx">0{i + 1}</span>
                <span className="menu__label">{link.label}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="menu__foot">
          <div className="menu__ctas">
            <Link
              to="/wedding-registration"
              className="btn btn--gold btn--block"
              tabIndex={open ? 0 : -1}
              onClick={() => setOpen(false)}
            >
              <span>Reserve a wedding hour</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to={isStaff ? staffRoute : '/login'}
              className="btn btn--onink btn--block"
              tabIndex={open ? 0 : -1}
              onClick={() => setOpen(false)}
            >
              <LogIn className="w-4 h-4" />
              <span>{isStaff ? 'Open workspace' : 'Staff login'}</span>
            </Link>
          </div>
          <div className="menu__meta">
            <a href="tel:+918192221938" tabIndex={open ? 0 : -1}>
              +91 8192 221938
            </a>
            <span>Belagavi · Davanagere · Shivamogga</span>
            <Link to="/madt/privacy" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)}>
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
