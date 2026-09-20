import React, { useState, useEffect } from 'react';
import { Bell, Clock, Search, Activity, Command, ShieldAlert, ShieldOff, Menu } from 'lucide-react';
import { UserSession } from '../services/api';
import { NotificationService } from '../services/notificationService';
import NotificationDrawer from './ui/NotificationDrawer';
import ActivityPanel from './ui/ActivityPanel';
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
  session: UserSession | null;
  onMenuClick: () => void;
  rightElement?: React.ReactNode;
}

export default function Topbar({ title, breadcrumbs, session, onMenuClick, rightElement }: TopbarProps) {
  const crumbs = useBreadcrumbs(breadcrumbs);
  const [clock, setClock] = useState<string>('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [bypassDevTools, setBypassDevTools] = useState(false);

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

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      clearInterval(interval);
      unsub();
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  return (
    <>
      <header className="w-full max-w-full bg-white border-b border-[#E5DCD2] sticky top-0 z-30 shadow-2xs flex-shrink-0">
        {/* ── Row 1: Hamburger, Title, Search, Tools ────────────────────── */}
        <div className="h-14 sm:h-16 px-2 sm:px-3 lg:px-5 flex items-center justify-between gap-2">
        {/* ── Left Area: Hamburger + Title ──────────────────────────────── */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-shrink-0">
          {/* Mobile Hamburger Menu Button — visible only below lg breakpoint */}
          <button
            type="button"
            onClick={onMenuClick}
            className="lg:hidden flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#4A0F24] text-white hover:bg-[#320817] active:scale-95 transition-all shadow-sm border border-[#4A0F24] focus:outline-none focus:ring-2 focus:ring-[#C9A45C] focus:ring-offset-1 cursor-pointer flex-shrink-0"
            aria-label="Open navigation menu"
            title="Open navigation menu"
          >
            <Menu className="w-5 h-5 text-white" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm md:text-base font-black text-[#4A0F24] tracking-tight leading-none truncate max-w-[80px] sm:max-w-[160px] md:max-w-[200px] lg:max-w-none">
              {title}
            </h1>
          </div>
        </div>

        {/* ── Center Area: Fixed Search Directory (Ctrl+K) ──────── */}
        <div className="flex-1 flex items-center justify-center px-1 sm:px-3 min-w-0 mx-auto">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="w-full max-w-[130px] sm:max-w-xs md:max-w-sm lg:max-w-md flex items-center justify-between gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-xl border border-[#E5DCD2] bg-[#F7F3ED] hover:bg-white text-[10px] sm:text-xs font-semibold text-[#21151A] hover:border-[#C9A45C] transition-all shadow-2xs group cursor-pointer"
            title="Search directory (Ctrl+K)"
            aria-label="Search directory (Ctrl+K)"
          >
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 truncate">
              <Search className="w-3.5 h-3.5 text-[#C9A45C] flex-shrink-0 group-hover:scale-110 transition-transform" />
              <span className="truncate text-[#6F6265] group-hover:text-[#21151A]">Search directory...</span>
            </div>
            <kbd className="hidden lg:inline-flex items-center gap-0.5 font-mono text-[9px] bg-white border border-[#E5DCD2] px-1.5 py-0.5 rounded text-[#4A0F24] font-bold shadow-2xs flex-shrink-0 select-none">
              <Command className="w-2.5 h-2.5 text-[#C9A45C]" />
              <span>K</span>
            </kbd>
          </button>
        </div>

        {/* ── Right Area: Tools, Notifications, Profile & Custom Actions ─── */}
        <div className="flex items-center gap-0.5 sm:gap-1 lg:gap-1.5 flex-shrink-0 min-w-0">
          {/* Clock - only on large screens */}
          <div className="hidden 2xl:flex items-center gap-1.5 text-[10px] sm:text-xs text-[#21151A] bg-[#F7F3ED] px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-[#E5DCD2] font-mono shadow-2xs">
            <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#C9A45C]" />
            <span className="font-semibold whitespace-nowrap">{clock}</span>
          </div>

          {/* Activity Panel Trigger */}
          <button
            onClick={() => setActivityOpen(true)}
            className="hidden sm:flex p-1.5 sm:p-2 rounded-xl text-[#4A0F24] hover:bg-[#F7F3ED] border border-transparent hover:border-[#E5DCD2] transition-all"
            title="Live Activity Intelligence"
          >
            <Activity className="w-4 h-4 text-[#16805B]" />
          </button>

          {/* DevTools Bypass Toggle (Admin roles with global scope only) */}
          {session?.isGlobalAdmin && ['Admin', 'Super Admin'].includes(session.role) && (
            <button
              onClick={() => {
                const newState = !bypassDevTools;
                setBypassDevTools(newState);
                localStorage.setItem('bsc_shield_bypass', newState ? 'true' : 'false');
                window.dispatchEvent(new Event('dev_tools_bypass_changed'));
              }}
              className="hidden sm:flex p-1.5 sm:p-2 rounded-xl text-[#4A0F24] hover:bg-[#F7F3ED] border border-transparent hover:border-[#E5DCD2] transition-all"
              title={bypassDevTools ? "DevTools Protection Bypassed" : "DevTools Protection Active"}
            >
              {bypassDevTools ? (
                <ShieldOff className="w-4 h-4 text-[#C98218]" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-[#4A0F24]" />
              )}
            </button>
          )}

          {/* Branch Location Switcher */}
          <LocationSwitcher />

          {/* Notification Drawer Trigger */}
          <button
            onClick={() => setNotifOpen(true)}
            className="relative p-1.5 sm:p-2 rounded-xl text-[#4A0F24] hover:bg-[#F7F3ED] border border-transparent hover:border-[#E5DCD2] transition-all"
            title="Notification Center"
          >
            <Bell className="w-4 h-4 text-[#4A0F24]" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[#C7374A] text-white font-black text-[8px] sm:text-[9px] flex items-center justify-center border-2 border-white shadow-xs">
                {unreadCount}
              </span>
            )}
          </button>

          {/* User Profile Dropdown */}
          <ProfileDropdown
            session={session}
            onOpenNotifications={() => setNotifOpen(true)}
            onOpenActivity={() => setActivityOpen(true)}
            onOpenSearch={() => setSearchOpen(true)}
          />

          {rightElement}
        </div>
        </div>

        {/* ── Row 2: Route-derived breadcrumb trail (own row → can never
               overlap top navigation, search, notifications or profile) ── */}
        <div className="px-2 sm:px-3 lg:px-5 pb-1.5 bg-[#F7F3ED]/70 border-t border-[#E5DCD2]/40">
          <Breadcrumbs items={crumbs} />
        </div>
      </header>

      {/* Drawers & Modals */}
      <NotificationDrawer isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
      <ActivityPanel isOpen={activityOpen} onClose={() => setActivityOpen(false)} />
      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
