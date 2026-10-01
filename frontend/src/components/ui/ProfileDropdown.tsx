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

/**
 * ProfileDropdown — Executive Account & Profile Menu for BSC Textiles.
 *
 * Implements:
 *   • Correct absolute anchoring directly below the profile button
 *   • Responsive width (320-340px desktop, safe margins on mobile)
 *   • Full profile header ([SA], Name, Role badge, Email) without arbitrary truncation
 *   • Aligned Notifications row with live unread counter
 *   • Integrated Recent Activity & History launcher with click handler
 *   • Integrated Audio Alerts sound toggle
 *   • Connected action section: System Administrator, Update Password, Sign Out
 *   • Proper z-index layering above headers, sticky rails, and dashboard content
 *   • Native click-outside and Escape key handling with zero duplicate listeners
 *   • Zero layout shifts on toggle
 */
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

  // Robust outside-click and Escape key handler
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
      showToast('Notification audio alerts enabled (Full Volume)', 'info', 'Audio Alerts ON');
    } else {
      showToast('Notification audio alerts muted', 'warn', 'Audio Alerts Muted');
    }
  };

  const isAdminRole =
    session?.role === 'Admin' || session?.role === 'Super Admin' || Boolean(session?.isGlobalAdmin);

  return (
    <div className="relative inline-block text-left">
      {/* ── Header Profile Trigger Button ──────────────────────────────────── */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Open user profile menu"
        className={`flex items-center gap-2 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border transition-all cursor-pointer select-none ${
          open
            ? 'bg-[#FFFFFF] border-[#C9A45C] shadow-xs'
            : 'hover:bg-[#F7F5F0] border-transparent hover:border-[#E1DDD3]'
        }`}
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#123C35] to-[#1D5148] text-white font-black text-xs flex items-center justify-center shadow-xs border border-[#C9A45C]/40 shrink-0">
          {initials}
        </div>
        <div className="hidden sm:block text-left min-w-0">
          <div className="font-extrabold text-xs text-[#123C35] leading-tight truncate max-w-[130px] md:max-w-[180px] lg:max-w-[220px]">
            {displayName}
          </div>
          <div className="text-[9.5px] text-[#C9A45C] font-black uppercase tracking-wider">
            {role}
          </div>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#123C35] transition-transform duration-200 shrink-0 ${
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
          className="absolute right-0 top-full mt-2 w-80 sm:w-[340px] max-w-[calc(100vw-1.5rem)] bg-[#FFFFFF] rounded-2xl shadow-2xl border border-[#E1DDD3] z-50 overflow-hidden animate-fade-in flex flex-col"
        >
          {/* ── 1. Profile Header Section ───────────────────────────────────── */}
          <div className="p-3.5 bg-gradient-to-br from-[#F7F5F0] via-[#FFFFFF] to-[#EDF3F0] border-b border-[#E1DDD3]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#123C35] to-[#1D5148] text-[#FFFFFF] font-black text-sm flex items-center justify-center shadow-sm border border-[#C9A45C]/30 shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="font-black text-xs sm:text-sm text-[#123C35] truncate leading-tight">
                    {displayName}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-[#123C35]/10 border border-[#123C35]/20 text-[#123C35] text-[9.5px] font-black uppercase tracking-wider shrink-0">
                    {role}
                  </span>
                </div>
                <p className="text-[11px] text-[#65716C] font-medium truncate mt-0.5" title={emailDisplay}>
                  {emailDisplay}
                </p>
              </div>
            </div>
          </div>

          {/* ── 2. Notifications & Activity Section ─────────────────────────── */}
          <div className="p-2 space-y-1 bg-[#FFFFFF]">
            {/* Notification Row */}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenNotifications();
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-[#17201D] hover:bg-[#EDF3F0] hover:text-[#123C35] transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#F7F5F0] text-[#123C35] flex items-center justify-center border border-[#E1DDD3] group-hover:bg-white group-hover:border-[#C9A45C]/40 transition-colors">
                  <Bell className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold">Notifications</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black border transition-colors ${
                  unreadCount > 0
                    ? 'bg-[#C83B4A]/10 text-[#C83B4A] border-[#C83B4A]/25'
                    : 'bg-[#F7F5F0] text-[#65716C] border-[#E1DDD3]'
                }`}
              >
                {unreadCount}
              </span>
            </button>

            {/* History / Recent Activity Row */}
            <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-[#F7F5F0] border border-[#E1DDD3]">
              <div className="flex items-center gap-2 min-w-0">
                <Activity className="w-3.5 h-3.5 text-[#16805C] shrink-0" />
                <span className="text-xs font-bold text-[#123C35] truncate">Recent Activity</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setActivityOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-[#123C35] text-[#123C35] hover:text-white border border-[#E1DDD3] hover:border-[#123C35] text-[11px] font-black transition-all shadow-2xs cursor-pointer shrink-0"
                title="View user activity and audit history"
              >
                <History className="w-3 h-3 text-[#C9A45C]" />
                <span>History</span>
              </button>
            </div>

            {/* Audio Alerts Toggle */}
            <button
              type="button"
              onClick={handleToggleSound}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-[#17201D] hover:bg-[#EDF3F0] hover:text-[#123C35] transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#F7F5F0] text-[#65716C] flex items-center justify-center border border-[#E1DDD3] group-hover:bg-white transition-colors">
                  {soundEnabled ? (
                    <Volume2 className="w-3.5 h-3.5 text-[#16805C]" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5 text-[#65716C]" />
                  )}
                </div>
                <span className="text-xs font-bold">Audio Alerts</span>
              </div>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                  soundEnabled
                    ? 'bg-[#E5F4EE] text-[#16805C] border-[#A2DAC6]'
                    : 'bg-[#F7F5F0] text-[#65716C] border-[#E1DDD3]'
                }`}
              >
                {soundEnabled ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>

          {/* ── 3. Lower Action Section ─────────────────────────────────────── */}
          <div className="p-2 border-t border-[#E1DDD3] space-y-1 bg-[#FFFFFF]">
            {/* System Administrator Link (Admin/Super Admin only) */}
            {isAdminRole && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate('/system-admin');
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#17201D] hover:bg-[#EDF3F0] hover:text-[#123C35] transition-colors cursor-pointer group text-xs font-bold"
              >
                <div className="w-7 h-7 rounded-lg bg-[#F7F5F0] text-[#123C35] flex items-center justify-center border border-[#E1DDD3] group-hover:bg-white group-hover:border-[#C9A45C]/40 transition-colors">
                  <Settings className="w-3.5 h-3.5" />
                </div>
                <span>System Administrator</span>
              </button>
            )}

            {/* Update Password Option */}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setChangePasswordOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#17201D] hover:bg-[#EDF3F0] hover:text-[#123C35] transition-colors cursor-pointer group text-xs font-bold"
            >
              <div className="w-7 h-7 rounded-lg bg-[#F7F5F0] text-[#123C35] flex items-center justify-center border border-[#E1DDD3] group-hover:bg-white group-hover:border-[#C9A45C]/40 transition-colors">
                <KeyRound className="w-3.5 h-3.5" />
              </div>
              <span>Update Password</span>
            </button>
          </div>

          {/* ── 4. Sign Out Section ─────────────────────────────────────────── */}
          <div className="p-2 border-t border-[#E1DDD3] bg-[#FFFFFF]">
            <button
              type="button"
              onClick={() => Auth.logout()}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#C83B4A] hover:bg-[#C83B4A]/10 hover:text-[#A92A38] transition-colors cursor-pointer group text-xs font-black"
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
