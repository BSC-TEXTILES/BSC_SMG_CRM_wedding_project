import React, { useState, useEffect } from 'react';
import { Bell, Clock, Search, ShieldAlert, ShieldOff, Menu } from 'lucide-react';
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
   * Optional dynamic sub-crumb(s) rendered after the page crumb.
   * Root and parent are derived automatically from route hierarchy.
   */
  breadcrumbs?: BreadcrumbCrumb[] | null;
  hideBreadcrumbs?: boolean;
  session: UserSession | null;
  onMenuClick: () => void;
  rightElement?: React.ReactNode;
}

export default function Topbar({
  title,
  breadcrumbs,
  hideBreadcrumbs,
  session,
  onMenuClick,
  rightElement
}: TopbarProps) {
  const crumbs = useBreadcrumbs(breadcrumbs);
  const [clock, setClock] = useState<string>('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [bypassDevTools, setBypassDevTools] = useState(false);

  // Ctrl/Cmd+K shortcut to toggle search modal
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
        now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
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
      <header className="w-full max-w-full bg-white border-b border-[#E2DDD2] sticky top-0 z-40 flex-shrink-0">
        {/* ── Row 1: Executive Top Navigation (Height 68–74px) ─────────────── */}
        <div className="h-16 sm:h-[70px] lg:h-[72px]">
          <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between gap-3 sm:gap-4">
            {/* ── Left: Hamburger Menu & Page Title ────────────────────────── */}
            <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 shrink-0">
              {/* Mobile hamburger menu */}
              <button
                type="button"
                onClick={onMenuClick}
                className="lg:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-[#F7F4ED] hover:bg-[#123C35] text-[#123C35] hover:text-white border border-[#E2DDD2] transition-colors cursor-pointer shrink-0 focus:outline-none focus:ring-2 focus:ring-[#C9A45C]"
                aria-label="Open navigation menu"
                title="Open navigation menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="min-w-0">
                <h1 className="text-base sm:text-lg md:text-xl lg:text-[22px] font-bold text-[#182033] tracking-tight leading-none truncate max-w-[130px] xs:max-w-[180px] sm:max-w-[260px] md:max-w-[340px] lg:max-w-none">
                  {title}
                </h1>
              </div>
            </div>

            {/* ── Center: Executive Global Search ──────────────────────────── */}
            <div className="flex items-center justify-center min-w-0 flex-1 max-w-[340px] mx-1 sm:mx-3">
              {/* Mobile Search Icon Button */}
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="sm:hidden p-2 rounded-xl border border-[#E2DDD2] bg-[#F7F4ED] hover:bg-white text-[#123C35] transition-colors shadow-xs cursor-pointer"
                title="Search directory (Ctrl+K)"
                aria-label="Search directory"
              >
                <Search className="w-4 h-4 text-[#123C35]" />
              </button>

              {/* Desktop/Tablet Full Search Bar */}
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="hidden sm:flex w-full items-center justify-between gap-2.5 px-3.5 py-2 rounded-xl border border-[#E2DDD2] bg-[#F7F4ED] hover:bg-white text-xs font-medium text-[#687080] hover:text-[#182033] hover:border-[#C9A45C] transition-all shadow-none group cursor-pointer"
                title="Search directory (Ctrl+K)"
                aria-label="Search directory (Ctrl+K)"
              >
                <div className="flex items-center gap-2 min-w-0 truncate">
                  <Search className="w-4 h-4 text-[#123C35] shrink-0 group-hover:scale-105 transition-transform" />
                  <span className="truncate">Search directory...</span>
                </div>
                <kbd className="hidden md:inline-flex items-center gap-0.5 font-mono text-[10px] bg-white border border-[#E2DDD2] px-1.5 py-0.5 rounded text-[#123C35] font-bold shadow-xs shrink-0 select-none">
                  ⌘K
                </kbd>
              </button>
            </div>

            {/* ── Right: System Status, Clock, Location, Alerts & Profile ──── */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0 min-w-0">
              {/* Subtle Live System Status Indicator */}
              <div
                className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E5F4EE] border border-[#A2DAC6]/50 text-[11px] font-semibold text-[#16805C] select-none"
                title="System status: Operational"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#16805C] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#16805C]"></span>
                </span>
                <span>Operational</span>
              </div>

              {/* Clock - subtle muted timestamp */}
              <div className="hidden 2xl:flex items-center gap-1.5 text-xs text-[#687080] font-medium px-2 py-1 select-none">
                <Clock className="w-3.5 h-3.5 text-[#687080]" />
                <span className="whitespace-nowrap">{clock}</span>
              </div>

              {/* DevTools Security Toggle (Admin roles only) */}
              {session?.isGlobalAdmin && ['Admin', 'Super Admin'].includes(session.role) && (
                <button
                  type="button"
                  onClick={() => {
                    const newState = !bypassDevTools;
                    setBypassDevTools(newState);
                    localStorage.setItem('bsc_shield_bypass', newState ? 'true' : 'false');
                    window.dispatchEvent(new Event('dev_tools_bypass_changed'));
                  }}
                  className="hidden sm:flex p-2 rounded-xl text-[#182033] hover:bg-[#F7F4ED] border border-transparent hover:border-[#E2DDD2] transition-colors cursor-pointer"
                  title={bypassDevTools ? "DevTools Protection Bypassed" : "DevTools Protection Active"}
                  aria-label="Security"
                >
                  {bypassDevTools ? (
                    <ShieldOff className="w-4 h-4 text-[#C58A16]" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-[#123C35]" />
                  )}
                </button>
              )}

              {/* Premium Location Selector */}
              <LocationSwitcher />

              {/* Notification Drawer Trigger */}
              <button
                type="button"
                onClick={() => setNotifOpen(true)}
                className="relative p-2 rounded-xl text-[#182033] hover:bg-[#F7F4ED] border border-transparent hover:border-[#E2DDD2] transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#C9A45C]"
                title="Notifications"
                aria-label="Open notifications"
              >
                <Bell className="w-4 h-4 text-[#182033]" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#C83B4A] text-white font-bold text-[9px] flex items-center justify-center border-2 border-white shadow-xs">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* User Profile Area */}
              <ProfileDropdown
                session={session}
                onOpenNotifications={() => setNotifOpen(true)}
              />

              {rightElement}
            </div>
          </div>
        </div>

        {/* ── Row 2: Breadcrumb Navigation Strip (Height 40–44px) ─────────── */}
        {!hideBreadcrumbs && (
          <div className="h-10 sm:h-11 bg-white border-t border-[#E2DDD2]/60 flex items-center shrink-0">
            <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
              <Breadcrumbs items={crumbs} />
            </div>
          </div>
        )}
      </header>

      {/* Drawers & Modals */}
      <NotificationDrawer isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
