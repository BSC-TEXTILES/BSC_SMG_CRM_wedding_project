import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, ArrowUpRight, ShieldCheck, Sparkles, User, LogIn } from 'lucide-react';
import { LANDING_DATA } from '../landingData';
import { Auth, UserSession } from '../../../services/api';

interface HeaderNavProps {
  activeSection?: string;
  onNavigate?: (id: string) => void;
}

export default function HeaderNav({ activeSection = 'hero', onNavigate }: HeaderNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [session, setSession] = useState<UserSession | null>(null);

  useEffect(() => {
    setSession(Auth.get());
  }, []);

  const handleLinkClick = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    if (onNavigate) {
      onNavigate(id);
    } else {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#FAF7F2]/80 backdrop-blur-md border-b border-[#E8DFC8]/60 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
        
        {/* LEFT: Clean Brand Logo */}
        <a
          href="#hero"
          onClick={(e) => handleLinkClick('hero', e)}
          className="flex items-center gap-2.5 sm:gap-3 group select-none"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#1C1510] text-[#E8C7A8] flex items-center justify-center font-serif text-sm sm:text-base font-bold shadow-sm transition-transform duration-300 group-hover:scale-105">
            B
          </div>
          <div className="flex flex-col">
            <span className="font-serif tracking-widest text-xs sm:text-sm font-bold text-[#1C1510] uppercase">
              {LANDING_DATA.navigation.brandText}
            </span>
            <span className="text-[9px] tracking-wider text-[#7A695C] uppercase font-medium -mt-0.5">
              ESTD 1938 · KARNATAKA
            </span>
          </div>
        </a>

        {/* CENTER: Compact Minimal Navigation Links */}
        <nav className="hidden lg:flex items-center gap-6 xl:gap-8">
          {LANDING_DATA.navigation.links.map((link) => {
            const isActive = activeSection === link.id;
            return (
              <a
                key={link.id}
                href={`#${link.id}`}
                onClick={(e) => handleLinkClick(link.id, e)}
                className={`text-xs uppercase tracking-wider font-semibold transition-all duration-200 py-1 relative ${
                  isActive
                    ? 'text-[#1C1510]'
                    : 'text-[#6F5F53] hover:text-[#1C1510]'
                }`}
              >
                {link.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 w-full h-[1.5px] bg-[#B76E79] rounded-full animate-fade-in" />
                )}
              </a>
            );
          })}
        </nav>

        {/* RIGHT: Minimal Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Staff Login / Profile Action */}
          {session ? (
            <Link
              to="/dashboard"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-[#1C1510] bg-[#EFE8DD] hover:bg-[#E4D9C8] transition-colors"
            >
              <User className="w-3.5 h-3.5 text-[#B76E79]" />
              <span>{session.name?.split(' ')[0] || 'Staff'}</span>
            </Link>
          ) : (
            <Link
              to="/login"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-[#6F5F53] hover:text-[#1C1510] hover:bg-[#EFE8DD]/70 transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Staff Login</span>
            </Link>
          )}

          {/* Primary CTA: Wedding Register */}
          <Link
            to={LANDING_DATA.navigation.primaryAction.href}
            className="inline-flex items-center gap-1.5 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-[#1C1510] hover:bg-[#32231A] text-[#FAF7F2] text-xs font-semibold tracking-wide shadow-md transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>{LANDING_DATA.navigation.primaryAction.label}</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#E8C7A8]" />
          </Link>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl text-[#1C1510] hover:bg-[#EFE8DD] transition-colors focus:outline-none"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* MOBILE DRAWER */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#FAF7F2]/95 backdrop-blur-xl border-b border-[#E8DFC8] px-6 py-6 shadow-xl animate-fade-in">
          <nav className="flex flex-col gap-3">
            {LANDING_DATA.navigation.links.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                onClick={(e) => handleLinkClick(link.id, e)}
                className="text-sm font-semibold tracking-wider uppercase text-[#1C1510] py-2 border-b border-[#E8DFC8]/40 hover:text-[#B76E79] transition-colors"
              >
                {link.label}
              </a>
            ))}
            <div className="pt-3 flex flex-col gap-2.5">
              <Link
                to={LANDING_DATA.navigation.primaryAction.href}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2.5 rounded-full bg-[#1C1510] text-[#FAF7F2] text-xs font-bold uppercase tracking-wider shadow-sm"
              >
                {LANDING_DATA.navigation.primaryAction.label}
              </Link>
              <Link
                to={session ? '/dashboard' : '/login'}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2 rounded-full border border-[#D5C6B5] text-[#1C1510] text-xs font-bold uppercase tracking-wider"
              >
                {session ? 'Go to Staff Dashboard' : 'Staff Login'}
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
