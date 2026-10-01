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
            ? 'bg-[#FFFDFC] border-[#B76E79] shadow-xs'
            : 'hover:bg-[#FFFDFC] border-transparent hover:border-[#E8D9D4]'
        }`}
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4A173A] to-[#6A2853] text-white font-black text-xs flex items-center justify-center shadow-xs border border-[#B76E79]/40 shrink-0">
          {initials}
        </div>
        <div className="hidden sm:block text-left min-w-0">
          <div className="font-extrabold text-xs text-[#4A173A] leading-tight truncate max-w-[130px] md:max-w-[180px] lg:max-w-[220px]">
            {displayName}
          </div>
          <div className="text-[9.5px] text-[#B76E79] font-black uppercase tracking-wider">
            {role}
          </div>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#4A173A] transition-transform duration-200 shrink-0 ${
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
          className="absolute right-0 top-full mt-2 w-80 sm:w-[340px] max-w-[calc(100vw-1.5rem)] bg-[#FFFDFC] rounded-2xl shadow-2xl border border-[#E8D9D4] z-50 overflow-hidden animate-fade-in flex flex-col"
        >
          {/* ── 1. Profile Header Section ───────────────────────────────────── */}
          <div className="p-3.5 bg-gradient-to-br from-[#FFF7F2] via-[#FFFDFC] to-[#FAF5F2] border-b border-[#E8D9D4]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#4A173A] to-[#6A2853] text-[#FAF6F0] font-black text-sm flex items-center justify-center shadow-sm border border-[#B76E79]/30 shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="font-black text-xs sm:text-sm text-[#4A173A] truncate leading-tight">
                    {displayName}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-[#4A173A]/10 border border-[#4A173A]/20 text-[#4A173A] text-[9.5px] font-black uppercase tracking-wider shrink-0">
                    {role}
                  </span>
                </div>
                <p className="text-[11px] text-[#6F5963] font-medium truncate mt-0.5" title={emailDisplay}>
                  {emailDisplay}
                </p>
              </div>
            </div>
          </div>

          {/* ── 2. Notifications & Activity Section ─────────────────────────── */}
          <div className="p-2 space-y-1 bg-[#FFFDFC]">
            {/* Notification Row */}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenNotifications();
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-[#2B1722] hover:bg-[#FFF7F2] hover:text-[#4A173A] transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#FAF5F2] text-[#B76E79] flex items-center justify-center border border-[#E8D9D4] group-hover:bg-white group-hover:border-[#B76E79]/40 transition-colors">
                  <Bell className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold">Notifications</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black border transition-colors ${
                  unreadCount > 0
                    ? 'bg-[#B42318]/10 text-[#B42318] border-[#B42318]/25'
                    : 'bg-[#FAF5F2] text-[#6F5963] border-[#E8D9D4]'
                }`}
              >
                {unreadCount}
              </span>
            </button>

            {/* History / Recent Activity Row */}
            <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-[#FAF5F2]/70 border border-[#E8D9D4]/70">
              <div className="flex items-center gap-2 min-w-0">
                <Activity className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-xs font-bold text-[#4A173A] truncate">Recent Activity</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setActivityOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-[#4A173A] text-[#4A173A] hover:text-white border border-[#E8D9D4] hover:border-[#4A173A] text-[11px] font-black transition-all shadow-2xs cursor-pointer shrink-0"
                title="View user activity and audit history"
              >
                <History className="w-3 h-3 text-[#B76E79]" />
                <span>History</span>
              </button>
            </div>

            {/* Audio Alerts Toggle */}
            <button
              type="button"
              onClick={handleToggleSound}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-[#2B1722] hover:bg-[#FFF7F2] hover:text-[#4A173A] transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#FAF5F2] text-[#6F5963] flex items-center justify-center border border-[#E8D9D4] group-hover:bg-white transition-colors">
                  {soundEnabled ? (
                    <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5 text-[#6F5963]" />
                  )}
                </div>
                <span className="text-xs font-bold">Audio Alerts</span>
              </div>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                  soundEnabled
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-[#FAF5F2] text-[#6F5963] border-[#E8D9D4]'
                }`}
              >
                {soundEnabled ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>

          {/* ── 3. Lower Action Section ─────────────────────────────────────── */}
          <div className="p-2 border-t border-[#E8D9D4] space-y-1 bg-[#FFFDFC]">
            {/* System Administrator Link (Admin/Super Admin only) */}
            {isAdminRole && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate('/system-admin');
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#2B1722] hover:bg-[#FFF7F2] hover:text-[#4A173A] transition-colors cursor-pointer group text-xs font-bold"
              >
                <div className="w-7 h-7 rounded-lg bg-[#FAF5F2] text-[#B76E79] flex items-center justify-center border border-[#E8D9D4] group-hover:bg-white group-hover:border-[#B76E79]/40 transition-colors">
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
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#2B1722] hover:bg-[#FFF7F2] hover:text-[#4A173A] transition-colors cursor-pointer group text-xs font-bold"
            >
              <div className="w-7 h-7 rounded-lg bg-[#FAF5F2] text-[#B76E79] flex items-center justify-center border border-[#E8D9D4] group-hover:bg-white group-hover:border-[#B76E79]/40 transition-colors">
                <KeyRound className="w-3.5 h-3.5" />
              </div>
              <span>Update Password</span>
            </button>
          </div>

          {/* ── 4. Sign Out Section ─────────────────────────────────────────── */}
          <div className="p-2 border-t border-[#E8D9D4] bg-[#FFFDFC]">
            <button
              type="button"
              onClick={() => Auth.logout()}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#B42318] hover:bg-[#B42318]/10 hover:text-[#911d14] transition-colors cursor-pointer group text-xs font-black"
            >
              <div className="w-7 h-7 rounded-lg bg-[#B42318]/10 text-[#B42318] flex items-center justify-center border border-[#B42318]/20 group-hover:bg-[#B42318] group-hover:text-white transition-colors">
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
