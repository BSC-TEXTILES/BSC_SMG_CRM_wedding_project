import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useProfileTheme } from '../themeContext';
import {
  Menu,
  X,
  Sun,
  Moon,
  Shield,
  ArrowRight,
  PhoneCall,
  Calendar,
  Sparkles
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Experience', href: '/experience' },
  { label: 'Skills', href: '/skills' },
  { label: 'Services', href: '/services' },
  { label: 'Portfolio', href: '/projects' },
  { label: 'Achievements', href: '/achievements' },
  { label: 'Testimonials', href: '/testimonials' },
  { label: 'Gallery', href: '/gallery' },
  { label: 'Contact', href: '/contact' }
];

export const ProfileHeader: React.FC = () => {
  const { theme, toggleTheme } = useProfileTheme();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Monitor scroll for subtle shadow & height change
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <header
        className={`sticky top-0 z-40 transition-all duration-300 ${
          scrolled
            ? 'pf-glass border-b border-[var(--pf-border)] shadow-[var(--pf-shadow-sm)] py-3'
            : 'bg-[var(--pf-bg)]/95 border-b border-[var(--pf-border-soft)] py-4'
        }`}
      >
        <div className="pf-container flex items-center justify-between gap-4">
          {/* Brand Logo & Heritage Mark */}
          <Link
            to="/"
            className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pf-gold)] rounded-lg p-1"
            aria-label="BSC Textiles Home"
          >
            <div className="w-10 h-10 rounded-full bg-[var(--pf-burgundy)] flex items-center justify-center text-white font-serif text-lg font-bold shadow-sm transition-transform duration-200 group-hover:scale-105">
              <span>B</span>
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-lg sm:text-xl font-bold tracking-tight text-[var(--pf-text-main)] group-hover:text-[var(--pf-burgundy)] transition-colors">
                BSC Textiles
              </span>
              <span className="text-[10px] uppercase tracking-widest text-[var(--pf-gold)] font-bold">
                Est. 1948 · Belagavi
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-2" aria-label="Main Navigation">
            {NAV_ITEMS.map(item => {
              const active = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${
                    active
                      ? 'bg-[var(--pf-burgundy)] text-white shadow-xs'
                      : 'text-[var(--pf-text-muted)] hover:text-[var(--pf-text-main)] hover:bg-[var(--pf-bg-alt)]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Action Icons & CTA */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-full border border-[var(--pf-border)] text-[var(--pf-text-muted)] hover:text-[var(--pf-text-main)] hover:bg-[var(--pf-bg-alt)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--pf-gold)]"
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
            </button>

            {/* Admin Portal Shortcut */}
            <Link
              to="/admin"
              className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-[var(--pf-border)] text-xs font-semibold text-[var(--pf-text-muted)] hover:text-[var(--pf-text-main)] hover:bg-[var(--pf-bg-alt)] transition-colors"
              title="Admin Management Dashboard"
            >
              <Shield className="w-3.5 h-3.5 text-[var(--pf-gold)]" />
              <span>Admin</span>
            </Link>

            {/* Primary Action Button */}
            <Link
              to="/contact"
              className="hidden md:inline-flex items-center gap-2 bg-[var(--pf-burgundy)] text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xs hover:bg-[var(--pf-burgundy-hover)] transition-all hover:shadow-sm"
            >
              <span>Book Consultation</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg border border-[var(--pf-border)] text-[var(--pf-text-main)] hover:bg-[var(--pf-bg-alt)] focus:outline-none focus:ring-2 focus:ring-[var(--pf-gold)]"
              aria-label={mobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Backdrop & Menu */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        >
          <div
            className="fixed inset-y-0 right-0 w-full max-w-xs bg-[var(--pf-bg)] shadow-2xl p-6 flex flex-col justify-between overflow-y-auto border-l border-[var(--pf-border)]"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-label="Mobile Navigation Menu"
          >
            <div>
              {/* Header inside drawer */}
              <div className="flex items-center justify-between pb-5 border-b border-[var(--pf-border)] mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[var(--pf-burgundy)] flex items-center justify-center text-white font-serif font-bold text-sm">
                    B
                  </div>
                  <div>
                    <span className="font-serif font-bold text-sm block">BSC Textiles</span>
                    <span className="text-[9px] uppercase tracking-wider text-[var(--pf-gold)] font-bold">Est. 1948</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg border border-[var(--pf-border)] text-[var(--pf-text-muted)] hover:bg-[var(--pf-bg-alt)]"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation links */}
              <nav className="flex flex-col gap-1">
                {NAV_ITEMS.map(item => {
                  const active = location.pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-between ${
                        active
                          ? 'bg-[var(--pf-burgundy)] text-white font-bold'
                          : 'text-[var(--pf-text-main)] hover:bg-[var(--pf-bg-alt)]'
                      }`}
                    >
                      <span>{item.label}</span>
                      {active && <span className="w-1.5 h-1.5 rounded-full bg-[var(--pf-gold)]" />}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Bottom drawer footer */}
            <div className="pt-6 border-t border-[var(--pf-border)] space-y-3">
              <Link
                to="/contact"
                className="w-full flex items-center justify-center gap-2 bg-[var(--pf-burgundy)] text-white py-3 rounded-full text-xs font-bold shadow-sm"
              >
                <span>Book VIP Consultation</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <div className="flex items-center justify-between text-xs text-[var(--pf-text-muted)] pt-2">
                <Link to="/admin" className="flex items-center gap-1.5 hover:text-[var(--pf-gold)]">
                  <Shield className="w-4 h-4" />
                  <span>Admin Portal</span>
                </Link>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex items-center gap-1.5 hover:text-[var(--pf-gold)]"
                >
                  {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProfileHeader;
