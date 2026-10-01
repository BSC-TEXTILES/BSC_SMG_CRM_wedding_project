import React, { useState, useEffect, useRef } from 'react';
import {
  X, Bell, CheckCheck, Trash2, Search, Volume2, VolumeX,
  MessageSquare, Sliders, CheckCircle, Clock, ShieldAlert, Sparkles, Filter
} from 'lucide-react';
import { NotificationService, SystemNotification } from '../../services/notificationService';
import NotificationPreferencesModal from './NotificationPreferencesModal';
import DirectMessagingModal from './DirectMessagingModal';
import { Auth } from '../../services/api';
import { showToast } from '../Toast';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationDrawer({ isOpen, onClose }: NotificationDrawerProps) {
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'broadcasts' | 'system' | 'archived'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [dmOpen, setDmOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(() => NotificationService.isSoundEnabled());
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const session = Auth.get();
  const unreadCount = NotificationService.getUnreadCount();

  // ── Lock background scroll & handle Escape key ─────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus close button on open
    setTimeout(() => closeButtonRef.current?.focus(), 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // ── Subscribe to notification service updates ──────────────────────────
  useEffect(() => {
    const unsubscribe = NotificationService.subscribe((list) => {
      setNotifications(list);
    });
    return () => unsubscribe();
  }, []);

  if (!isOpen) return null;

  const filtered = notifications.filter((n) => {
    if (activeTab === 'unread' && n.read) return false;
    if (activeTab === 'archived' && !n.archived) return false;
    if (activeTab !== 'archived' && n.archived) return false;
    if (activeTab === 'broadcasts' && n.category !== 'General' && n.category !== 'HR') return false;
    if (activeTab === 'system' && n.category !== 'System') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q);
    }
    return true;
  });

  const formatNotificationTime = (timestamp?: string) => {
    if (!timestamp) return 'Just now';
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return timestamp;

    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

    if (isToday) return `Today · ${timeStr}`;
    if (isYesterday) return `Yesterday · ${timeStr}`;

    const day = d.toLocaleDateString([], { day: 'numeric', month: 'short' });
    return `${day} · ${timeStr}`;
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critical':
        return (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
            CRITICAL
          </span>
        );
      case 'high':
        return (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-50 text-amber-700 border border-amber-200">
            HIGH
          </span>
        );
      case 'low':
        return (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-[#FFFFFF] text-[#8B776A] border border-[#E1DDD3]">
            LOW
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-50 text-blue-700 border border-blue-200">
            NORMAL
          </span>
        );
    }
  };

  const handleMarkAllRead = () => {
    NotificationService.markAllAsRead();
    showToast('All notifications marked as read', 'success');
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
        {/* Blurred Backdrop */}
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Centered Notification Modal */}
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="notification-modal-title"
          className="relative w-full max-w-2xl bg-white/95 backdrop-blur-xl rounded-3xl shadow-[0_25px_60px_rgba(16,28,54,0.25)] border border-[#E1DDD3] overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[88vh] z-10 animate-modal-in"
        >
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-[#E1DDD3] bg-[#FFFFFF]/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-[#123C35] text-[#C9A45C] flex items-center justify-center flex-shrink-0 shadow-xs border border-[#C9A45C]/30">
                <Bell className="w-5 h-5 text-[#C9A45C]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2
                    id="notification-modal-title"
                    className="font-black text-base sm:text-lg tracking-tight text-[#17201D] leading-tight truncate"
                  >
                    Notification Center
                  </h2>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-[#B76E79] text-white text-[10px] font-black shrink-0 shadow-2xs">
                      {unreadCount} New
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#65716C] font-medium mt-0.5 truncate">
                  Real-time alerts, broadcasts &amp; system updates
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const next = NotificationService.toggleSound();
                  setSoundOn(next);
                  if (next) {
                    NotificationService.playSound('normal');
                    showToast('Notification audio alerts enabled (Full Volume)', 'info', 'Audio Alerts ON');
                  } else {
                    showToast('Notification audio alerts muted', 'warn', 'Audio Alerts Muted');
                  }
                }}
                className={`p-2 rounded-xl border transition-all cursor-pointer ${
                  soundOn
                    ? 'text-[#C9A45C] bg-[#FFFFFF] border-[#C9A45C]/40 hover:bg-white'
                    : 'text-rose-500 bg-rose-50 border-rose-200 hover:bg-rose-100'
                }`}
                title={soundOn ? 'Audio Alerts: ON (click to mute)' : 'Audio Alerts: MUTED (click to enable)'}
                aria-label="Toggle sound"
              >
                {soundOn ? <Volume2 className="w-4 h-4 text-[#C9A45C]" /> : <VolumeX className="w-4 h-4 text-rose-500" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  NotificationService.playSound('normal');
                  showToast('Playing full notification audio alert chime', 'info', 'Audio Test');
                }}
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-[#17201D] bg-[#FFFFFF] hover:bg-white border border-[#E1DDD3] hover:border-[#C9A45C]/50 transition-all cursor-pointer shadow-2xs"
                title="Play full test notification sound"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#C9A45C]" />
                <span>Test Sound</span>
              </button>
              <button
                type="button"
                onClick={() => setDmOpen(true)}
                className="p-2 rounded-xl text-[#65716C] hover:text-[#17201D] hover:bg-white border border-transparent hover:border-[#E1DDD3] transition-all cursor-pointer"
                title="Direct Text Messaging"
                aria-label="Direct messaging"
              >
                <MessageSquare className="w-4 h-4 text-[#C9A45C]" />
              </button>
              <button
                type="button"
                onClick={() => setPrefsOpen(true)}
                className="p-2 rounded-xl text-[#65716C] hover:text-[#17201D] hover:bg-white border border-transparent hover:border-[#E1DDD3] transition-all cursor-pointer"
                title="Notification Preferences"
                aria-label="Preferences"
              >
                <Sliders className="w-4 h-4 text-[#C9A45C]" />
              </button>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-[#65716C] hover:text-[#17201D] hover:bg-white border border-transparent hover:border-[#E1DDD3] transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#C9A45C]"
                aria-label="Close notification center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search & Tabs Row */}
          <div className="p-3 sm:p-4 border-b border-[#E1DDD3]/60 space-y-2.5 bg-white">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#8B776A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search alerts & broadcasts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-[#E1DDD3] bg-[#FFFFFF]/60 text-xs text-[#17201D] font-medium focus:bg-white focus:outline-none focus:border-[#C9A45C] focus:ring-1 focus:ring-[#C9A45C]"
                />
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="px-3 py-1.5 rounded-xl bg-[#FFFFFF] hover:bg-[#123C35] hover:text-white border border-[#E1DDD3] text-[#17201D] text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-[#C9A45C]" />
                  <span className="hidden sm:inline">Mark all read</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {[
                { key: 'all', label: 'All Alerts' },
                { key: 'unread', label: `Unread (${unreadCount})` },
                { key: 'broadcasts', label: 'Broadcasts' },
                { key: 'system', label: 'System' },
                { key: 'archived', label: 'Archive' }
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key as any)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                    activeTab === t.key
                      ? 'bg-[#123C35] text-[#FAF7F2]'
                      : 'text-[#65716C] hover:bg-[#F7F5F0]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable Notification List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 text-xs overscroll-contain">
            {filtered.length > 0 ? (
              filtered.map((item) => (
                <div
                  key={item.id}
                  onClick={() => NotificationService.markAsRead(item.id)}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer relative group ${
                    !item.read
                      ? 'bg-[#FFFFFF] border-[#C9A45C]/40 shadow-xs'
                      : 'bg-white border-[#E1DDD3] hover:border-[#E1DDD3]/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                          !item.read
                            ? 'bg-[#123C35] text-[#C9A45C] border-[#C9A45C]/30'
                            : 'bg-[#F7F5F0] text-[#65716C] border-[#E1DDD3]'
                        }`}
                      >
                        <Bell className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-xs sm:text-sm text-[#17201D] tracking-tight truncate">
                            {item.title}
                          </h4>
                          {!item.read && (
                            <span className="w-2 h-2 rounded-full bg-[#B76E79] shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-[#5F4E44] font-medium mt-1 leading-relaxed line-clamp-3">
                          {item.message}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {getPriorityBadge(item.priority)}
                    </div>
                  </div>

                  {/* Notification Footer */}
                  <div className="flex items-center justify-between text-[11px] text-[#8B776A] pt-2.5 mt-2.5 border-t border-[#E1DDD3]/40 font-medium">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-[#B76E79]" />
                      <span>{formatNotificationTime(item.timestamp)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-[#E1DDD3] text-[#65716C]">
                        {item.category || 'General'}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          NotificationService.archive(item.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-[#8B776A] hover:text-[#17201D] p-1 transition-opacity cursor-pointer"
                        title="Archive notification"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-[#65716C] space-y-2">
                <Bell className="w-8 h-8 text-[#C9A45C]/50 mx-auto" />
                <p className="font-bold text-sm text-[#17201D]">No notifications found</p>
                <p className="text-xs">You're completely caught up with all alerts.</p>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-3 sm:p-4 bg-[#FFFFFF]/80 border-t border-[#E1DDD3] flex items-center justify-between text-xs text-[#65716C]">
            <span className="font-medium">
              Showing {filtered.length} notification{filtered.length === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl border border-[#E1DDD3] bg-white hover:bg-[#123C35] hover:text-white hover:border-[#123C35] text-[#17201D] font-bold text-xs transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Auxiliary Modals */}
      <NotificationPreferencesModal isOpen={prefsOpen} onClose={() => setPrefsOpen(false)} />
      <DirectMessagingModal isOpen={dmOpen} onClose={() => setDmOpen(false)} session={session} />
    </>
  );
}
