import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Bell,
  ChevronDown,
  History,
  KeyRound,
  LogOut,
  Settings,
  Volume2,
  VolumeX
} from 'lucide-react';
import { Auth, UserSession } from '../../services/api';
import { NotificationService } from '../../services/notificationService';
import { showToast } from '../Toast';
import ChangePasswordModal from './ChangePasswordModal';
import ActivityPanel from './ActivityPanel';

interface ProfileDropdownProps {
  session: UserSession | null;
  onOpenNotifications: () => void;
}

export default function ProfileDropdown({
  session,
  onOpenNotifications
}: ProfileDropdownProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(NotificationService.isSoundEnabled());
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(() => NotificationService.getUnreadCount());

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Subscribe to live unread counter updates while open
  useEffect(() => {
    if (!open) return;
    setUnreadCount(NotificationService.getUnreadCount());
    return NotificationService.subscribe(() => setUnreadCount(NotificationService.getUnreadCount()));
  }, [open]);

  // Click-outside and Escape key handling
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const role = session?.role || 'Admin';
  const displayName = session?.fullName || session?.displayName || session?.name || 'System Administrator';
  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || 'SA';

  const emailDisplay =
    session?.email ||
    (session?.username?.includes('@') ? session?.username : `${session?.username || 'admin'}@bsctextiles.com`);

  const handleToggleSound = () => {
    const next = NotificationService.toggleSound();
    setSoundEnabled(next);
    if (next) {
      NotificationService.playSound('normal');
      showToast('Notification audio alerts enabled', 'info', 'Audio Alerts ON');
    } else {
      showToast('Notification audio alerts muted', 'warn', 'Audio Alerts Muted');
    }
  };

  const isAdminRole =
    session?.role === 'Admin' || session?.role === 'Super Admin' || Boolean(session?.isGlobalAdmin);

  return (
    <div className="relative inline-block text-left">
      {/* ── Profile Trigger Button ────────────────────────────────────────── */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Open user profile menu"
        className={`flex items-center gap-2.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border transition-all cursor-pointer select-none ${
          open
            ? 'bg-[#F7F4ED] border-[#C9A45C] shadow-xs'
            : 'hover:bg-[#F7F4ED] border-transparent hover:border-[#E2DDD2]'
        }`}
      >
        <div className="w-10 h-10 rounded-xl bg-[#123C35] text-white font-bold text-xs flex items-center justify-center shadow-xs border border-[#C9A45C]/40 shrink-0">
          {initials}
        </div>
        <div className="hidden sm:block text-left min-w-0">
          <div className="font-bold text-[13px] text-[#182033] leading-tight truncate max-w-[130px] md:max-w-[180px] lg:max-w-[220px]">
            {displayName}
          </div>
          <div className="text-[11.5px] text-[#C9A45C] font-semibold uppercase tracking-wider mt-0.5">
            {role}
          </div>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#687080] transition-transform duration-200 shrink-0 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* ── Dropdown Menu Card ─────────────────────────────────────────────── */}
      {open && (
        <div
          ref={dropdownRef}
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 top-full mt-2 w-80 sm:w-[320px] max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl shadow-2xl border border-[#E2DDD2] z-50 overflow-hidden animate-fade-in flex flex-col"
        >
          {/* Header Section */}
          <div className="p-3.5 bg-gradient-to-br from-[#F7F4ED] to-[#FFFFFF] border-b border-[#E2DDD2]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#123C35] text-white font-bold text-xs flex items-center justify-center shadow-sm border border-[#C9A45C]/30 shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="font-bold text-[13px] text-[#182033] truncate leading-tight">
                    {displayName}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-[#123C35]/10 border border-[#123C35]/15 text-[#123C35] text-[11px] font-semibold uppercase tracking-wider shrink-0">
                    {role}
                  </span>
                </div>
                <p className="text-[11.5px] text-[#687080] font-medium truncate mt-0.5" title={emailDisplay}>
                  {emailDisplay}
                </p>
              </div>
            </div>
          </div>

          {/* Notifications & Activity Section */}
          <div className="p-2 space-y-1 bg-white">
            {/* Notification Row */}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onOpenNotifications();
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-[#182033] hover:bg-[#EDF3F0] hover:text-[#123C35] transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#F7F4ED] text-[#123C35] flex items-center justify-center border border-[#E2DDD2] group-hover:bg-white group-hover:border-[#C9A45C]/40 transition-colors">
                  <Bell className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-semibold">Notifications</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                  unreadCount > 0
                    ? 'bg-[#C83B4A]/10 text-[#C83B4A] border-[#C83B4A]/25'
                    : 'bg-[#F7F4ED] text-[#687080] border-[#E2DDD2]'
                }`}
              >
                {unreadCount}
              </span>
            </button>

            {/* Recent Activity Row */}
            <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-[#F7F4ED] border border-[#E2DDD2]">
              <div className="flex items-center gap-2 min-w-0">
                <Activity className="w-3.5 h-3.5 text-[#16805C] shrink-0" />
                <span className="text-xs font-semibold text-[#182033] truncate">Recent Activity</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setActivityOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-[#123C35] text-[#123C35] hover:text-white border border-[#E2DDD2] hover:border-[#123C35] text-[11px] font-bold transition-all shadow-xs cursor-pointer shrink-0"
                title="View user activity and audit history"
              >
                <History className="w-3 h-3 text-[#C9A45C]" />
                <span>History</span>
              </button>
            </div>

            {/* Audio Alerts Toggle */}
            <button
              type="button"
              role="menuitem"
              onClick={handleToggleSound}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-[#182033] hover:bg-[#EDF3F0] hover:text-[#123C35] transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#F7F4ED] text-[#687080] flex items-center justify-center border border-[#E2DDD2] group-hover:bg-white transition-colors">
                  {soundEnabled ? (
                    <Volume2 className="w-3.5 h-3.5 text-[#16805C]" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5 text-[#687080]" />
                  )}
                </div>
                <span className="text-xs font-semibold">Audio Alerts</span>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                  soundEnabled
                    ? 'bg-[#E5F4EE] text-[#16805C] border-[#A2DAC6]'
                    : 'bg-[#F7F4ED] text-[#687080] border-[#E2DDD2]'
                }`}
              >
                {soundEnabled ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>

          {/* Lower Action Section */}
          <div className="p-2 border-t border-[#E2DDD2] space-y-1 bg-white">
            {/* System Administrator Link */}
            {isAdminRole && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  navigate('/system-admin');
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#182033] hover:bg-[#EDF3F0] hover:text-[#123C35] transition-colors cursor-pointer group text-xs font-semibold"
              >
                <div className="w-7 h-7 rounded-lg bg-[#F7F4ED] text-[#123C35] flex items-center justify-center border border-[#E2DDD2] group-hover:bg-white group-hover:border-[#C9A45C]/40 transition-colors">
                  <Settings className="w-3.5 h-3.5" />
                </div>
                <span>System Administrator</span>
              </button>
            )}

            {/* Update Password Option */}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setChangePasswordOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#182033] hover:bg-[#EDF3F0] hover:text-[#123C35] transition-colors cursor-pointer group text-xs font-semibold"
            >
              <div className="w-7 h-7 rounded-lg bg-[#F7F4ED] text-[#123C35] flex items-center justify-center border border-[#E2DDD2] group-hover:bg-white group-hover:border-[#C9A45C]/40 transition-colors">
                <KeyRound className="w-3.5 h-3.5" />
              </div>
              <span>Update Password</span>
            </button>
          </div>

          {/* Sign Out Section */}
          <div className="p-2 border-t border-[#E2DDD2] bg-white">
            <button
              type="button"
              role="menuitem"
              onClick={() => Auth.logout()}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#C83B4A] hover:bg-[#C83B4A]/10 hover:text-[#A92A38] transition-colors cursor-pointer group text-xs font-bold"
            >
              <div className="w-7 h-7 rounded-lg bg-[#C83B4A]/10 text-[#C83B4A] flex items-center justify-center border border-[#C83B4A]/20 group-hover:bg-[#C83B4A] group-hover:text-white transition-colors">
                <LogOut className="w-3.5 h-3.5" />
              </div>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {/* Auxiliary Modals */}
      <ChangePasswordModal
        isOpen={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        session={session}
      />

      <ActivityPanel
        isOpen={activityOpen}
        onClose={() => setActivityOpen(false)}
      />
    </div>
  );
}
