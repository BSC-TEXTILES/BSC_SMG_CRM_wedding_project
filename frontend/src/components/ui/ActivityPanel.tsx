import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Activity, X, LogIn, LogOut, Eye, PlusCircle, Edit3, Trash2,
  RefreshCw, Search, ShieldCheck, Heart, PhoneCall, CheckCircle2, Clock
} from 'lucide-react';
import { API } from '../../services/api';

interface ActivityPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ActivityPanel({ isOpen, onClose }: ActivityPanelProps) {
  const [activities, setActivities] = useState<any[]>([]);
  const [stats, setStats] = useState<{ totalLogins: number; totalLogouts: number; activeUsers: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'logins' | 'wedding' | 'system'>('all');
  const closeButtonRef = useRef<HTMLButtonElement>(null);

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

  // ── Fetch Activity & Stats ─────────────────────────────────────────────
  const fetchActivity = () => {
    setIsLoading(true);
    API.getUserTrackingStats()
      .then((res) => {
        if (res && res.recentActivity) {
          setActivities(res.recentActivity);
          setStats({
            totalLogins: res.totalLoginsToday || 0,
            totalLogouts: res.totalLogoutsToday || 0,
            activeUsers: res.activeUsersToday || 0
          });
        }
      })
      .catch(() => {
        API.getActivity({ limit: 30 })
          .then((res) => {
            if (res && res.activity) {
              setActivities(res.activity);
            }
          })
          .catch(() => {});
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchActivity();
    const intervalId = setInterval(fetchActivity, 15000);
    return () => clearInterval(intervalId);
  }, [isOpen]);

  // ── Helpers ────────────────────────────────────────────────────────────
  const formatTimelineTimestamp = (dateStr?: string) => {
    if (!dateStr) return 'Just now';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

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

  const formatActionText = (action?: string, details?: any) => {
    if (!action) return 'Accessed System';
    const act = String(action).toUpperCase();
    if (act === 'USER_LOGIN' || act === 'LOGIN') return 'User Logged In';
    if (act === 'USER_LOGOUT' || act === 'LOGOUT') return 'User Logged Out';
    if (act.includes('VIEW') || act.includes('READ')) {
      const target = details?.page || details?.module || act.replace(/^VIEW_?/, '').replace(/^VIEWED_?/, '');
      return `Viewed ${target ? target.replace(/_/g, ' ') : 'Workspace'}`;
    }
    if (act.includes('CREATE') || act.includes('ADD') || act.includes('REGISTER')) {
      return `Created new record in ${details?.module || 'system'}`;
    }
    if (act.includes('UPDATE') || act.includes('EDIT')) {
      return `Updated record in ${details?.module || 'system'}`;
    }
    if (act.includes('DELETE') || act.includes('REMOVE')) {
      return `Removed record`;
    }
    return action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const getActionIconConfig = (action?: string) => {
    const act = String(action || '').toUpperCase();
    if (act.includes('LOGIN')) {
      return { icon: LogIn, bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
    if (act.includes('LOGOUT')) {
      return { icon: LogOut, bg: 'bg-rose-50 text-rose-700 border-rose-200' };
    }
    if (act.includes('WEDDING') || act.includes('CUSTOMER')) {
      return { icon: Heart, bg: 'bg-[#C9A45C]/10 text-[#C9A45C] border-[#C9A45C]/20' };
    }
    if (act.includes('CALL') || act.includes('TELECALLER')) {
      return { icon: PhoneCall, bg: 'bg-teal-50 text-teal-700 border-teal-200' };
    }
    if (act.includes('CREATE') || act.includes('ADD')) {
      return { icon: PlusCircle, bg: 'bg-amber-50 text-amber-700 border-amber-200' };
    }
    if (act.includes('UPDATE') || act.includes('EDIT')) {
      return { icon: Edit3, bg: 'bg-blue-50 text-blue-700 border-blue-200' };
    }
    if (act.includes('VIEW')) {
      return { icon: Eye, bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    }
    return { icon: Activity, bg: 'bg-[#123C35]/5 text-[#123C35] border-[#E1DDD3]' };
  };

  // ── Filtered Activities ────────────────────────────────────────────────
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      if (activeFilter === 'logins') {
        const a = String(act.action).toUpperCase();
        if (!a.includes('LOGIN') && !a.includes('LOGOUT')) return false;
      } else if (activeFilter === 'wedding') {
        const a = `${act.action} ${act.module || ''}`.toUpperCase();
        if (!a.includes('WEDDING') && !a.includes('CUSTOMER') && !a.includes('CALL')) return false;
      } else if (activeFilter === 'system') {
        const a = `${act.action} ${act.module || ''}`.toUpperCase();
        if (!a.includes('SYSTEM') && !a.includes('CONFIG') && !a.includes('ADMIN')) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const user = String(act.username || '').toLowerCase();
        const action = String(act.action || '').toLowerCase();
        const mod = String(act.module || '').toLowerCase();
        return user.includes(q) || action.includes(q) || mod.includes(q);
      }
      return true;
    });
  }, [activities, activeFilter, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
      {/* Blurred Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Centered Timeline Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="timeline-modal-title"
        className="relative w-full max-w-2xl bg-white/95 backdrop-blur-xl rounded-3xl shadow-[0_25px_60px_rgba(16,28,54,0.25)] border border-[#E1DDD3] overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[88vh] z-10 animate-modal-in"
      >
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-[#E1DDD3] bg-[#FFFFFF]/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#123C35] text-[#C9A45C] flex items-center justify-center flex-shrink-0 shadow-xs border border-[#C9A45C]/30">
              <Activity className="w-5 h-5 text-[#C9A45C]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2
                  id="timeline-modal-title"
                  className="font-black text-base sm:text-lg tracking-tight text-[#17201D] leading-tight truncate"
                >
                  Live Activity Intelligence
                </h2>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  LIVE
                </span>
              </div>
              <p className="text-xs text-[#65716C] font-medium mt-0.5 truncate">
                User Activity Timeline &amp; system audit log
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={fetchActivity}
              disabled={isLoading}
              className="p-2 rounded-xl text-[#65716C] hover:text-[#17201D] hover:bg-white border border-transparent hover:border-[#E1DDD3] transition-all cursor-pointer"
              title="Refresh timeline"
              aria-label="Refresh activity"
            >
              <RefreshCw className={`w-4 h-4 text-[#C9A45C] ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-[#65716C] hover:text-[#17201D] hover:bg-white border border-transparent hover:border-[#E1DDD3] transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#C9A45C]"
              aria-label="Close activity timeline"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Stats Pill Row */}
        {stats && (
          <div className="px-4 sm:px-6 py-3 bg-[#FFFFFF]/40 border-b border-[#E1DDD3]/60 grid grid-cols-3 gap-2.5 text-center">
            <div className="p-2.5 rounded-xl bg-white border border-[#E1DDD3]/80">
              <span className="text-[10px] uppercase font-bold text-[#65716C] block">Active Users</span>
              <span className="text-base font-black text-[#17201D]">{stats.activeUsers}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white border border-[#E1DDD3]/80">
              <span className="text-[10px] uppercase font-bold text-[#65716C] block">Logins Today</span>
              <span className="text-base font-black text-emerald-700">{stats.totalLogins}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white border border-[#E1DDD3]/80">
              <span className="text-[10px] uppercase font-bold text-[#65716C] block">Logouts Today</span>
              <span className="text-base font-black text-rose-700">{stats.totalLogouts}</span>
            </div>
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="p-3 sm:p-4 border-b border-[#E1DDD3]/60 space-y-2.5 bg-white">
          <div className="relative">
            <Search className="w-4 h-4 text-[#65716C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search user, action or module..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-[#E1DDD3] bg-[#FFFFFF]/60 text-xs text-[#17201D] font-medium focus:bg-white focus:outline-none focus:border-[#C9A45C] focus:ring-1 focus:ring-[#C9A45C]"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {[
              { id: 'all', label: 'All Activities' },
              { id: 'logins', label: 'Logins & Sessions' },
              { id: 'wedding', label: 'Wedding CRM' },
              { id: 'system', label: 'System & Admin' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id as any)}
                className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  activeFilter === tab.id
                    ? 'bg-[#123C35] text-[#FAF7F2]'
                    : 'text-[#65716C] hover:bg-[#F7F5F0]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Timeline Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs overscroll-contain">
          {filteredActivities.length > 0 ? (
            <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E8DFC8]">
              {filteredActivities.map((act, idx) => {
                let details: any = act.details;
                try {
                  if (typeof details === 'string') {
                    details = JSON.parse(details);
                  }
                } catch {
                  // Keep as string
                }

                const iconConfig = getActionIconConfig(act.action);
                const IconComponent = iconConfig.icon;

                return (
                  <div key={idx} className="relative group">
                    {/* Timeline Node Icon */}
                    <div
                      className={`absolute -left-6 top-1 w-5 h-5 rounded-full border flex items-center justify-center shadow-2xs ${iconConfig.bg}`}
                    >
                      <IconComponent className="w-2.5 h-2.5" />
                    </div>

                    {/* Timeline Activity Card */}
                    <div className="p-3.5 sm:p-4 rounded-2xl border border-[#E1DDD3] bg-white hover:border-[#C9A45C] hover:shadow-sm transition-all space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          {/* User Name */}
                          <h4 className="font-extrabold text-sm text-[#17201D] tracking-tight truncate">
                            {act.username || 'System User'}
                          </h4>
                          {/* Action Description */}
                          <p className="text-xs font-semibold text-[#5F4E44] mt-0.5">
                            {formatActionText(act.action, details)}
                          </p>
                        </div>

                        {/* Section / Module Tag */}
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#123C35]/5 text-[#123C35] border border-[#123C35]/10 whitespace-nowrap shrink-0">
                          {act.module || details?.module || 'Workspace'}
                        </span>
                      </div>

                      {/* Footer Row: Timestamp + Status */}
                      <div className="flex items-center justify-between text-[11px] text-[#65716C] pt-2 border-t border-[#E1DDD3]/40 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-[#C9A45C]" />
                          <span>{formatTimelineTimestamp(act.created_at)}</span>
                        </div>
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[10px]">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Recorded</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-[#65716C] space-y-2">
              <Activity className="w-8 h-8 text-[#C9A45C]/50 mx-auto" />
              <p className="font-bold text-sm text-[#17201D]">No activities found</p>
              <p className="text-xs">No user activities recorded for this filter.</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-[#FFFFFF]/80 border-t border-[#E1DDD3] flex items-center justify-between text-xs text-[#65716C]">
          <span className="font-medium">
            Showing {filteredActivities.length} recorded event{filteredActivities.length === 1 ? '' : 's'}
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
  );
}
