import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Bell, Settings, Volume2, VolumeX, LogOut, ChevronDown, KeyRound } from 'lucide-react';
import { Auth, UserSession } from '../../services/api';
import { NotificationService } from '../../services/notificationService';
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

  // Re-render the badge while the menu is open instead of freezing whatever the
  // last render happened to read.
  useEffect(() => {
    if (!open) return;
    setUnreadCount(NotificationService.getUnreadCount());
    return NotificationService.subscribe(() => setUnreadCount(NotificationService.getUnreadCount()));
  }, [open]);

  const role = session?.role || 'HR';
  const initials = session?.fullName
    ? session.fullName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : role.slice(0, 2).toUpperCase();

  const handleToggleSound = () => {
    const next = NotificationService.toggleSound();
    setSoundEnabled(next);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-primary/5 border border-transparent hover:border-accent-soft transition-all"
      >
        <div className="w-8 h-8 rounded-full bg-primary text-white font-black text-xs flex items-center justify-center shadow-xs border border-accent/30">
          {initials}
        </div>
        <div className="hidden sm:block text-left">
          <div className="font-extrabold text-xs text-primary leading-tight truncate max-w-[110px]">
            {session?.fullName || 'User'}
          </div>
          <div className="text-[9.5px] text-accent font-bold uppercase tracking-wider">
            {role}
          </div>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-primary" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-56 bg-card rounded-2xl shadow-2xl border border-border z-50 p-2 text-xs font-bold animate-fade-in space-y-1">
            <div className="p-3 rounded-xl bg-background border border-border mb-1">
              <div className="font-black text-text-primary">{session?.fullName || 'User Session'}</div>
              <div className="text-[10px] text-accent-dark font-mono mt-0.5">{session?.username}</div>
            </div>

            <button
              onClick={() => { setOpen(false); onOpenNotifications(); }}
              className="w-full flex items-center justify-between p-2 rounded-xl text-text-primary hover:bg-background transition-colors"
            >
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-accent" />
                <span>Notifications</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-status-danger/10 text-status-danger text-[10px] font-black border border-status-danger/20">
                {unreadCount}
              </span>
            </button>

            {/* Live Activities — reuses the existing activity timeline */}
            <button
              onClick={() => { setOpen(false); setActivityOpen(true); }}
              className="w-full flex items-center justify-between p-2 rounded-xl text-text-primary hover:bg-background transition-colors cursor-pointer"
              aria-label="Open live activities"
            >
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-status-success" />
                <span>Live Activities</span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wide text-status-success">
                <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse" />
                Live
              </span>
            </button>

            <button
              onClick={handleToggleSound}
              className="w-full flex items-center justify-between p-2 rounded-xl text-text-primary hover:bg-background transition-colors"
            >
              <div className="flex items-center gap-2">
                {soundEnabled ? <Volume2 className="w-4 h-4 text-status-success" /> : <VolumeX className="w-4 h-4 text-text-muted" />}
                <span>Audio Alerts</span>
              </div>
              <span className="text-[10px] text-text-secondary">{soundEnabled ? 'ON' : 'OFF'}</span>
            </button>

            {session?.role === 'Admin' || session?.role === 'Super Admin' ? (
              <button
                onClick={() => { setOpen(false); navigate('/system-admin'); }}
                className="w-full flex items-center gap-2 p-2 rounded-xl text-text-primary hover:bg-background transition-colors"
              >
                <Settings className="w-4 h-4 text-accent" />
                <span>System Administrator</span>
              </button>
            ) : null}

            {/* Update Password Option (Available to ALL ROLES) */}
            <button
              onClick={() => { setOpen(false); setChangePasswordOpen(true); }}
              className="w-full flex items-center gap-2 p-2 rounded-xl text-text-primary hover:bg-background transition-colors cursor-pointer"
            >
              <KeyRound className="w-4 h-4 text-[#B76E79]" />
              <span>Update Password</span>
            </button>

            <div className="pt-1 border-t border-border">
              <button
                onClick={() => Auth.logout()}
                className="w-full flex items-center gap-2 p-2 rounded-xl text-status-danger hover:bg-status-danger/10 font-black transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        session={session}
      />

      {/* Live Activities timeline */}
      <ActivityPanel
        isOpen={activityOpen}
        onClose={() => setActivityOpen(false)}
      />
    </div>
  );
}
