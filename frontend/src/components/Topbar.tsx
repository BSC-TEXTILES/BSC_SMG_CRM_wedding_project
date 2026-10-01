import React, { useState, useEffect } from 'react';
import { Bell, Clock, Search, Command, ShieldAlert, ShieldOff, Menu } from 'lucide-react';
import { UserSession } from '../services/api';
import { NotificationService } from '../services/notificationService';
import NotificationDrawer from './ui/NotificationDrawer';
import GlobalSearchModal from './ui/GlobalSearchModal';
import ProfileDropdown from './ui/ProfileDropdown';
import LocationSwitcher from './ui/LocationSwitcher';
import Breadcrumbs from './ui/Breadcrumbs';
import { useBreadcrumbs, BreadcrumbCrumb } from '../utils/breadcrumbs';

interface TopbarProps {
  title: string;
  /**
   * Optional dynamic sub-crumb(s) rendered after the page crumb — e.g. the
   * active tab or an entity name. The root + page crumbs are derived from
   * the current route automatically, so never pass them here.
   */
  breadcrumbs?: BreadcrumbCrumb[] | null;
  hideBreadcrumbs?: boolean;
  session: UserSession | null;
  onMenuClick: () => void;
  rightElement?: React.ReactNode;
}

export default function Topbar({ title, breadcrumbs, hideBreadcrumbs, session, onMenuClick, rightElement }: TopbarProps) {
  const crumbs = useBreadcrumbs(breadcrumbs);
  const [clock, setClock] = useState<string>('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [bypassDevTools, setBypassDevTools] = useState(false);

  // Ctrl/Cmd+K focuses the directory search. This is the only place the chord
  // is bound — GlobalSearchModal deliberately does not listen for it too.
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    setBypassDevTools(localStorage.getItem('bsc_shield_bypass') === 'true');
    
    const updateTime = () => {
      const now = new Date();
      setClock(
        now.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' }) +
        ' · ' +
        now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);

    const unsub = NotificationService.subscribe(() => {
      setUnreadCount(NotificationService.getUnreadCount());
    });

    return () => {
      clearInterval(interval);
      unsub();
    };
  }, []);

  return (
    <>
      <header className="w-full max-w-full bg-[#FFFFFF] border-b border-[#E1DDD3] sticky top-0 z-40 shadow-xs flex-shrink-0">
        {/* ── Row 1: Hamburger, Title & Tools ───────────────────────────── */}
        <div className="h-14 sm:h-16 px-4 sm:px-5 lg:px-6 flex items-center justify-between gap-2">
        {/* ── Left Area: Hamburger + Title ──────────────────────────────── */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-shrink-0">
          {/* Mobile Hamburger Menu Button — visible only below lg breakpoint */}
          <button
            type="button"
            onClick={onMenuClick}
            className="lg:hidden flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#123C35] text-white hover:bg-[#082821] active:scale-95 transition-all shadow-sm border border-[#123C35] focus:outline-none focus:ring-2 focus:ring-[#C9A45C] focus:ring-offset-1 cursor-pointer flex-shrink-0"
            aria-label="Open navigation menu"
            title="Open navigation menu"
          >
            <Menu className="w-5 h-5 text-white" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm md:text-base font-black text-[#123C35] tracking-tight leading-none truncate max-w-[110px] xs:max-w-[150px] sm:max-w-[200px] md:max-w-[260px] lg:max-w-none">
              {title}
            </h1>
          </div>
        </div>

        {/* ── Center Area: Directory Search ──────── */}
        <div className="flex items-center justify-center px-1 sm:px-3 min-w-0 mx-auto">
          {/* Mobile Search Icon Button */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="sm:hidden p-2 rounded-xl border border-[#E1DDD3] bg-[#F7F5F0] hover:bg-white text-[#17201D] transition-all flex items-center justify-center shadow-xs cursor-pointer"
            title="Search directory (Ctrl+K)"
            aria-label="Search directory"
          >
            <Search className="w-4 h-4 text-[#123C35]" />
          </button>

          {/* Desktop/Tablet Full Search Bar */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="hidden sm:flex w-full sm:max-w-xs md:max-w-sm lg:max-w-md items-center justify-between gap-2 px-3 py-1.5 rounded-xl border border-[#E1DDD3] bg-[#F7F5F0] hover:bg-white text-xs font-semibold text-[#17201D] hover:border-[#C9A45C] transition-all shadow-xs group cursor-pointer"
            title="Search directory (Ctrl+K)"
            aria-label="Search directory (Ctrl+K)"
          >
            <div className="flex items-center gap-2 min-w-0 truncate">
              <Search className="w-3.5 h-3.5 text-[#123C35] flex-shrink-0 group-hover:scale-110 transition-transform" />
              <span className="truncate text-[#65716C] group-hover:text-[#17201D]">Search directory...</span>
            </div>
            <kbd className="hidden lg:inline-flex items-center gap-0.5 font-mono text-[9px] bg-white border border-[#E1DDD3] px-1.5 py-0.5 rounded text-[#123C35] font-bold shadow-xs flex-shrink-0 select-none">
              <Command className="w-2.5 h-2.5 text-[#C9A45C]" />
              <span>K</span>
            </kbd>
          </button>
        </div>

        {/* ── Right Area: Tools, Notifications, Profile & Custom Actions ─── */}
        <div className="flex items-center gap-0.5 sm:gap-1 lg:gap-1.5 flex-shrink-0 min-w-0">
          {/* Clock - only on large screens */}
          <div className="hidden 2xl:flex items-center gap-1.5 text-[10px] sm:text-xs text-[#17201D] bg-[#F7F5F0] px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-[#E1DDD3] font-mono shadow-xs">
            <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#123C35]" />
            <span className="font-semibold whitespace-nowrap">{clock}</span>
          </div>

          {/* DevTools Bypass Toggle (Admin roles with global scope only) */}
          {session?.isGlobalAdmin && ['Admin', 'Super Admin'].includes(session.role) && (
            <button
              onClick={() => {
                const newState = !bypassDevTools;
                setBypassDevTools(newState);
                localStorage.setItem('bsc_shield_bypass', newState ? 'true' : 'false');
                window.dispatchEvent(new Event('dev_tools_bypass_changed'));
              }}
              className="hidden sm:flex p-1.5 sm:p-2 rounded-xl text-[#17201D] hover:bg-[#F7F5F0] border border-transparent hover:border-[#E1DDD3] transition-all cursor-pointer"
              title={bypassDevTools ? "DevTools Protection Bypassed" : "DevTools Protection Active"}
            >
              {bypassDevTools ? (
                <ShieldOff className="w-4 h-4 text-[#C58A16]" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-[#123C35]" />
              )}
            </button>
          )}

          {/* Branch Location Switcher */}
          <LocationSwitcher />

          {/* Notification Drawer Trigger */}
          <button
            type="button"
            onClick={() => setNotifOpen(true)}
            className="relative p-1.5 sm:p-2 rounded-xl text-[#17201D] hover:bg-[#F7F5F0] border border-transparent hover:border-[#E1DDD3] transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#C9A45C]"
            title="Notification Center"
            aria-label="Open Notification Center"
          >
            <Bell className="w-4 h-4 text-[#123C35]" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[#C9A45C] text-[#17201D] font-black text-[8px] sm:text-[9px] flex items-center justify-center border-2 border-white shadow-xs">
                {unreadCount}
              </span>
            )}
          </button>

          {/* User Profile Dropdown */}
          <ProfileDropdown
            session={session}
            onOpenNotifications={() => setNotifOpen(true)}
          />

          {rightElement}
        </div>
        </div>

        {/* ── Row 2: Route-derived breadcrumb trail (own row → can never
               overlap top navigation, notifications or profile) ── */}
        {!hideBreadcrumbs && (
          <div className="px-4 sm:px-5 lg:px-6 pb-1.5 bg-[#FFFFFF] border-t border-[#E1DDD3]">
            <Breadcrumbs items={crumbs} />
          </div>
        )}
      </header>

      {/* Drawers & Modals */}
      <NotificationDrawer isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
