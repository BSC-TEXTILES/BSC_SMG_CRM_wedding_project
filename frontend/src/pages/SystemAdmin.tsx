import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer from '../components/Toast';
import { Auth, UserSession, apiFetch } from '../services/api';
import { getSidebarCollapsed, subscribeSidebarCollapsed } from '../utils/sidebarState';
import { NotificationService } from '../services/notificationService';
import DevToolsMonitoringPanel from '../components/DevToolsMonitoringPanel';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Users,
  Activity,
  FileText,
  Clock,
  RefreshCw,
  Search,
  Filter,
  Trash2,
  CircleCheck,
  CircleX,
  TriangleAlert,
  Laptop,
  LogIn,
  LogOut,
  Eye,
  ChevronRight,
  BarChart3,
  Loader2
} from 'lucide-react';

// ── IST formatting helper ────────────────────────────────────────────────
function formatIST(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch { return '—'; }
}

function formatTimeIST(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  } catch { return '—'; }
}

type TabKey = 'devtools' | 'security' | 'auth' | 'live' | 'logs' | 'events';

interface AuthActivity {
  summary: {
    loginsToday: number; logins7d: number; logoutsToday: number; logouts7d: number;
    failedToday: number; activeUsers7d: number;
    lastLogin: { username: string; at: string } | null;
    lastLogout: { username: string; at: string } | null;
  };
  recent: Array<{ id: number; username: string; action: string; ipAddress: string | null; at: string }>;
}

interface SecurityEventItem {
  id: number;
  username: string;
  action: string;
  details: any;
  ipAddress: string | null;
  createdAt: string;
}

interface SystemLogItem {
  id: number;
  username: string;
  action: string;
  module: string;
  details: any;
  ipAddress: string | null;
  createdAt: string;
}

interface LiveActivityItem {
  id: number;
  username: string;
  action: string;
  module: string;
  details: any;
  ipAddress: string | null;
  createdAt: string;
}

export default function SystemAdminPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(getSidebarCollapsed());
  const [activeTab, setActiveTab] = useState<TabKey>('devtools');

  useEffect(() => {
    return subscribeSidebarCollapsed(setCollapsed);
  }, []);

  // Auth Activity
  const [authActivity, setAuthActivity] = useState<AuthActivity | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Security Events
  const [securityEvents, setSecurityEvents] = useState<SecurityEventItem[]>([]);
  const [secLoading, setSecLoading] = useState(false);
  const [secSearch, setSecSearch] = useState('');
  const [secFilter, setSecFilter] = useState<'ALL' | 'OPENED' | 'CLOSED'>('ALL');

  // System Logs
  const [systemLogs, setSystemLogs] = useState<SystemLogItem[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsPage, setLogsPage] = useState(0);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsModuleFilter, setLogsModuleFilter] = useState('');
  const logsLimit = 20;

  // Live Activity
  const [liveActivity, setLiveActivity] = useState<LiveActivityItem[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);

  // Dashboard Stats
  const [dashStats, setDashStats] = useState({ securityEvents: 0, authEvents: 0, systemLogs: 0, todayEvents: 0 });
  const [statsLoading, setStatsLoading] = useState(false);

  // Error / Connection states
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const isAdmin = session?.role === 'Admin' || session?.role === 'Super Admin';

  // ── Data Loaders ────────────────────────────────────────────────────────

  const loadAuthActivity = useCallback(async () => {
    if (!isAdmin) return;
    setAuthLoading(true);
    try {
      const res = await apiFetch('/security/login-activity');
      if (res && res.summary) setAuthActivity(res);
      setConnectionError(null);
    } catch {
      setConnectionError('Unable to load authentication activity');
    } finally {
      setAuthLoading(false);
    }
  }, [isAdmin]);

  const loadSecurityEvents = useCallback(async () => {
    if (!isAdmin) return;
    setSecLoading(true);
    try {
      const res = await apiFetch('/security/events?limit=200');
      if (res && Array.isArray(res.events)) setSecurityEvents(res.events);
      setConnectionError(null);
    } catch {
      setConnectionError('Unable to load security events');
    } finally {
      setSecLoading(false);
    }
  }, [isAdmin]);

  const loadSystemLogs = useCallback(async () => {
    if (!isAdmin) return;
    setLogsLoading(true);
    try {
      const params: any = { limit: logsLimit, offset: logsPage * logsLimit };
      if (logsModuleFilter) params.module = logsModuleFilter;
      const q = new URLSearchParams(params).toString();
      const res = await apiFetch(`/security/system-logs?${q}`);
      if (res && Array.isArray(res.logs)) {
        setSystemLogs(res.logs);
        setLogsTotal(res.total || 0);
      }
      setConnectionError(null);
    } catch {
      setConnectionError('Unable to load system logs');
    } finally {
      setLogsLoading(false);
    }
  }, [isAdmin, logsPage, logsModuleFilter]);

  const loadLiveActivity = useCallback(async () => {
    if (!isAdmin) return;
    setLiveLoading(true);
    try {
      const res = await apiFetch('/security/live-activity?limit=30');
      if (res && Array.isArray(res.activity)) setLiveActivity(res.activity);
      setConnectionError(null);
    } catch {
      setConnectionError('Unable to load live activity');
    } finally {
      setLiveLoading(false);
    }
  }, [isAdmin]);

  const loadDashStats = useCallback(async () => {
    if (!isAdmin) return;
    setStatsLoading(true);
    try {
      const res = await apiFetch('/security/dashboard-stats');
      if (res && res.stats) setDashStats(res.stats);
    } catch {} finally {
      setStatsLoading(false);
    }
  }, [isAdmin]);

  // ── Initial Load & Real-time Updates ────────────────────────────────────

  useEffect(() => {
    if (!Auth.check()) { navigate('/login', { replace: true }); return; }
    const sess = Auth.get();
    if (sess?.role !== 'Admin' && sess?.role !== 'Super Admin') {
      navigate('/dashboard', { replace: true }); return;
    }
    setSession(sess);
    loadDashStats();
    loadAuthActivity();
    loadSecurityEvents();
    loadSystemLogs();
    loadLiveActivity();

    // Real-time updates via Socket.IO
    const unsubSecEvent = NotificationService.onSecurityEvent(() => {
      loadSecurityEvents();
      loadDashStats();
      loadLiveActivity();
    });
    const unsubSecCleared = NotificationService.onSecurityEventsCleared(() => {
      setSecurityEvents([]);
      loadDashStats();
    });

    // Polling fallback for auth and live activity (every 15s)
    const pollInterval = setInterval(() => {
      loadAuthActivity();
      loadLiveActivity();
      loadDashStats();
    }, 15000);

    return () => {
      unsubSecEvent();
      unsubSecCleared();
      clearInterval(pollInterval);
    };
  }, [navigate, loadDashStats, loadAuthActivity, loadSecurityEvents, loadSystemLogs, loadLiveActivity]);

  // Reload system logs when filter/page changes
  useEffect(() => {
    if (session) loadSystemLogs();
  }, [logsPage, logsModuleFilter, session, loadSystemLogs]);

  // ── Filtered Security Events ────────────────────────────────────────────

  const filteredSecEvents = useMemo(() => {
    return securityEvents.filter(ev => {
      if (secFilter === 'OPENED' && ev.action !== 'DEVTOOLS_DETECTED') return false;
      if (secFilter === 'CLOSED' && ev.action !== 'DEVTOOLS_CLOSED') return false;
      if (secSearch.trim()) {
        const q = secSearch.toLowerCase();
        return (ev.username?.toLowerCase().includes(q)) ||
               (ev.action?.toLowerCase().includes(q)) ||
               (ev.ipAddress?.toLowerCase().includes(q)) ||
               (ev.details?.page?.toLowerCase().includes(q)) ||
               (ev.details?.source?.toLowerCase().includes(q));
      }
      return true;
    });
  }, [securityEvents, secFilter, secSearch]);

  // ── Clear Security Events ───────────────────────────────────────────────

  const handleClearSecEvents = async () => {
    if (!window.confirm('Clear all Developer Tools detection history? This cannot be undone.')) return;
    try {
      await apiFetch('/security/clear-events', { method: 'POST' });
      setSecurityEvents([]);
      loadDashStats();
    } catch {}
  };

  // ── Tab Config ──────────────────────────────────────────────────────────

  const tabs: { key: TabKey; label: string; icon: any }[] = [
    { key: 'devtools', label: 'Developer Tools', icon: ShieldAlert },
    { key: 'security', label: 'Security Monitoring', icon: Shield },
    { key: 'auth', label: 'Authentication Activity', icon: LogIn },
    { key: 'live', label: 'Live Activity', icon: Activity },
    { key: 'logs', label: 'System Logs', icon: FileText },
    { key: 'events', label: 'Security Events', icon: Eye }
  ];

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background flex">
      <ToastContainer />
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${collapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        <Topbar
          title="System Administrator"
          breadcrumbs={[{ label: tabs.find(t => t.key === activeTab)?.label || 'Overview' }]}
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="p-4 lg:p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Header */}
          <div className="card-glass p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary text-accent text-[10px] font-black uppercase tracking-widest mb-1.5">
                <Shield className="w-3.5 h-3.5" />
                <span>System Administrator</span>
              </div>
              <h2 className="text-xl font-black text-primary tracking-tight flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-accent" />
                <span>Security &amp; System Administration</span>
              </h2>
              <p className="text-xs text-primary font-medium mt-0.5">
                Monitor developer tools, authentication activity, system logs, and security events across all connected sessions.
              </p>
            </div>
          </div>

          {/* Connection Error Banner */}
          {connectionError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3 text-xs font-bold text-red-700">
              <TriangleAlert className="w-4 h-4 flex-shrink-0" />
              <span>{connectionError}</span>
              <button onClick={() => setConnectionError(null)} className="ml-auto text-red-500 hover:text-red-700">
                <CircleX className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Quick Stats Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-white border border-accent/25 shadow-xs">
              <div className="text-[10px] font-black text-primary/60 uppercase tracking-wider">Security Events</div>
              <div className="text-lg font-black text-primary mt-0.5">{statsLoading ? '...' : dashStats.securityEvents}</div>
            </div>
            <div className="p-3 rounded-xl bg-white border border-accent/25 shadow-xs">
              <div className="text-[10px] font-black text-primary/60 uppercase tracking-wider">Auth Events</div>
              <div className="text-lg font-black text-primary mt-0.5">{statsLoading ? '...' : dashStats.authEvents}</div>
            </div>
            <div className="p-3 rounded-xl bg-white border border-accent/25 shadow-xs">
              <div className="text-[10px] font-black text-primary/60 uppercase tracking-wider">System Logs</div>
              <div className="text-lg font-black text-primary mt-0.5">{statsLoading ? '...' : dashStats.systemLogs}</div>
            </div>
            <div className="p-3 rounded-xl bg-white border border-accent/25 shadow-xs">
              <div className="text-[10px] font-black text-primary/60 uppercase tracking-wider">Today's Events</div>
              <div className="text-lg font-black text-primary mt-0.5">{statsLoading ? '...' : dashStats.todayEvents}</div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-accent-soft pb-1 overflow-x-auto scrollbar-none text-xs font-bold">
            {tabs.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`
                    px-4 py-2.5 rounded-xl transition-all duration-150 flex items-center gap-2 shadow-xs whitespace-nowrap
                    ${activeTab === t.key
                      ? 'bg-primary text-white shadow-md font-extrabold'
                      : 'bg-white text-[#5D4E42] border border-accent-soft hover:bg-background'}
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* ── TAB: Developer Tools ───────────────────────────────────── */}
          {activeTab === 'devtools' && (
            <div className="animate-fade-in">
              <DevToolsMonitoringPanel session={session} />
            </div>
          )}

          {/* ── TAB: Security Monitoring ───────────────────────────────── */}
          {activeTab === 'security' && (
            <div className="space-y-4 animate-fade-in">
              <div className="card-glass p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-extrabold text-primary text-sm uppercase tracking-wider flex items-center gap-2">
                      <Shield className="w-4 h-4 text-accent" />
                      <span>Security Monitoring Overview</span>
                    </h3>
                    <p className="text-[11px] text-primary font-medium mt-0.5">Real-time security event monitoring across all connected sessions.</p>
                  </div>
                  <button onClick={loadSecurityEvents} disabled={secLoading} className="p-1.5 rounded-xl bg-white border border-accent/25 text-primary hover:bg-gray-50 transition-colors cursor-pointer">
                    <RefreshCw className={`w-3.5 h-3.5 text-accent ${secLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                    <div className="text-[10px] font-black text-emerald-700 uppercase">Shield Status</div>
                    <div className="text-sm font-black text-emerald-800 mt-0.5">Monitored</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-accent/25">
                    <div className="text-[10px] font-black text-primary/60 uppercase">Total Events</div>
                    <div className="text-sm font-black text-primary mt-0.5">{securityEvents.length}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-accent/25">
                    <div className="text-[10px] font-black text-primary/60 uppercase">Last Event</div>
                    <div className="text-xs font-black text-primary mt-1 truncate">
                      {securityEvents.length > 0 ? formatIST(securityEvents[0].createdAt) : 'None'}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-accent/20 overflow-hidden bg-white">
                  <table className="w-full text-xs">
                    <thead className="bg-primary text-white text-[10px] font-black uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3 text-left">Timestamp</th>
                        <th className="py-2.5 px-3 text-left">User</th>
                        <th className="py-2.5 px-3 text-left">Event</th>
                        <th className="py-2.5 px-3 text-left hidden md:table-cell">Source</th>
                        <th className="py-2.5 px-3 text-right">IP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-accent/10">
                      {secLoading ? (
                        <tr><td colSpan={5} className="py-8 text-center text-primary/60"><Loader2 className="w-5 h-5 animate-spin mx-auto text-accent" /></td></tr>
                      ) : filteredSecEvents.length === 0 ? (
                        <tr><td colSpan={5} className="py-8 text-center text-primary/60 font-bold">No security events recorded</td></tr>
                      ) : filteredSecEvents.slice(0, 50).map(ev => (
                        <tr key={ev.id} className="hover:bg-accent/5 transition-colors">
                          <td className="py-2.5 px-3 whitespace-nowrap font-medium text-primary">{formatIST(ev.createdAt)}</td>
                          <td className="py-2.5 px-3 font-extrabold text-primary">@{ev.username || 'unknown'}</td>
                          <td className="py-2.5 px-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              ev.action === 'DEVTOOLS_DETECTED' ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}>
                              {ev.action === 'DEVTOOLS_DETECTED' ? <CircleX className="w-3 h-3" /> : <CircleCheck className="w-3 h-3" />}
                              {ev.action === 'DEVTOOLS_DETECTED' ? 'DevTools Opened' : 'DevTools Closed'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-primary text-[11px] hidden md:table-cell">{ev.details?.source || '—'}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-[10px] text-primary/60">{ev.ipAddress || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: Authentication Activity ───────────────────────────── */}
          {activeTab === 'auth' && (
            <div className="space-y-4 animate-fade-in">
              {authLoading && !authActivity ? (
                <div className="card-glass p-12 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-accent mb-3" />
                  <p className="font-bold text-primary text-sm">Loading authentication activity...</p>
                </div>
              ) : authActivity ? (
                <div className="card-glass p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-extrabold text-primary text-sm uppercase tracking-wider flex items-center gap-2">
                        <LogIn className="w-4 h-4 text-accent" />
                        <span>Authentication Activity</span>
                      </h3>
                      <p className="text-[11px] text-primary font-medium mt-0.5">Sign-in / sign-out trail across all locations.</p>
                    </div>
                    <button onClick={loadAuthActivity} disabled={authLoading} className="p-1.5 rounded-xl bg-white border border-accent/25 text-primary hover:bg-gray-50 cursor-pointer">
                      <RefreshCw className={`w-3.5 h-3.5 text-accent ${authLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                    <div className="p-3 rounded-xl bg-background border border-accent-soft">
                      <div className="text-[10px] font-black text-primary uppercase tracking-wider">Sign-ins Today</div>
                      <div className="text-lg font-black text-primary mt-0.5">{authActivity.summary.loginsToday}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-background border border-accent-soft">
                      <div className="text-[10px] font-black text-primary uppercase tracking-wider">Sign-outs Today</div>
                      <div className="text-lg font-black text-primary mt-0.5">{authActivity.summary.logoutsToday}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-background border border-accent-soft">
                      <div className="text-[10px] font-black text-primary uppercase tracking-wider">Failed Attempts Today</div>
                      <div className={`text-lg font-black mt-0.5 ${authActivity.summary.failedToday > 0 ? 'text-red-600' : 'text-primary'}`}>
                        {authActivity.summary.failedToday}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-background border border-accent-soft">
                      <div className="text-[10px] font-black text-primary uppercase tracking-wider">Active Users (7 days)</div>
                      <div className="text-lg font-black text-primary mt-0.5">{authActivity.summary.activeUsers7d}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-3 rounded-xl bg-background border border-accent-soft">
                      <div className="text-[10px] font-black text-primary uppercase tracking-wider">Sign-ins (7 days)</div>
                      <div className="text-lg font-black text-primary mt-0.5">{authActivity.summary.logins7d}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-background border border-accent-soft">
                      <div className="text-[10px] font-black text-primary uppercase tracking-wider">Sign-outs (7 days)</div>
                      <div className="text-lg font-black text-primary mt-0.5">{authActivity.summary.logouts7d}</div>
                    </div>
                  </div>

                  {/* Recent Auth Events Table */}
                  <div className="rounded-xl border border-accent-soft overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-primary text-white">
                        <tr>
                          <th className="text-left px-3 py-2 font-black uppercase tracking-wider text-[10px]">Timestamp</th>
                          <th className="text-left px-3 py-2 font-black uppercase tracking-wider text-[10px]">User</th>
                          <th className="text-left px-3 py-2 font-black uppercase tracking-wider text-[10px]">Event</th>
                          <th className="text-left px-3 py-2 font-black uppercase tracking-wider text-[10px] hidden md:table-cell">IP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {authActivity.recent.length === 0 ? (
                          <tr><td colSpan={4} className="px-3 py-6 text-center text-primary font-semibold">No authentication events recorded.</td></tr>
                        ) : authActivity.recent.map(ev => (
                          <tr key={ev.id} className="border-t border-accent-soft bg-white">
                            <td className="px-3 py-2 font-bold text-primary whitespace-nowrap">{formatIST(ev.at)}</td>
                            <td className="px-3 py-2 font-bold text-primary">{ev.username || 'Unknown'}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-[2px] rounded-full font-black text-[10px] uppercase ${
                                ev.action === 'LOGIN_SUCCESS' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : ev.action === 'LOGOUT' ? 'bg-[#F5F0EB] text-primary border border-accent-soft'
                                : 'bg-red-50 text-[#C0392B] border border-red-200'
                              }`}>
                                {ev.action === 'LOGIN_SUCCESS' ? 'Signed In' : ev.action === 'LOGOUT' ? 'Signed Out' : 'Failed Attempt'}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-mono text-primary hidden md:table-cell">{ev.ipAddress || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="card-glass p-12 text-center">
                  <ShieldCheck className="w-10 h-10 text-accent/40 mx-auto mb-3" />
                  <p className="font-bold text-primary text-sm">No authentication data available</p>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Live Activity ─────────────────────────────────────── */}
          {activeTab === 'live' && (
            <div className="space-y-4 animate-fade-in">
              <div className="card-glass p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-extrabold text-primary text-sm uppercase tracking-wider flex items-center gap-2">
                      <Activity className="w-4 h-4 text-accent" />
                      <span>Live Activity Feed</span>
                    </h3>
                    <p className="text-[11px] text-primary font-medium mt-0.5">Real-time system events via Socket.IO. Updates automatically.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Live
                    </span>
                    <button onClick={loadLiveActivity} disabled={liveLoading} className="p-1.5 rounded-xl bg-white border border-accent/25 text-primary hover:bg-gray-50 cursor-pointer">
                      <RefreshCw className={`w-3.5 h-3.5 text-accent ${liveLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {liveLoading && liveActivity.length === 0 ? (
                    <div className="py-8 text-center text-primary/60">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto text-accent mb-2" />
                      <p className="font-bold text-xs">Loading activity feed...</p>
                    </div>
                  ) : liveActivity.length === 0 ? (
                    <div className="py-8 text-center text-primary/60">
                      <Activity className="w-8 h-8 text-accent/40 mx-auto mb-2" />
                      <p className="font-bold text-sm text-primary">No recent activity</p>
                    </div>
                  ) : liveActivity.map(ev => (
                    <div key={ev.id} className="p-3 rounded-xl border border-accent-soft bg-white hover:bg-accent/5 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            ev.action.includes('LOGIN') ? 'bg-emerald-500' :
                            ev.action.includes('LOGOUT') ? 'bg-black' :
                            ev.action.includes('FAILED') ? 'bg-red-500' :
                            ev.action.includes('DEVTOOLS') ? 'bg-red-500' :
                            'bg-primary/30'
                          }`} />
                          <span className="font-extrabold text-primary text-xs">{ev.username || 'system'}</span>
                          <span className="text-primary/50 text-xs">·</span>
                          <span className="text-[11px] text-primary font-semibold">{ev.action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())}</span>
                          {ev.module && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-primary/10 text-primary uppercase">{ev.module}</span>
                          )}
                        </div>
                        <span className="text-[10px] text-primary/50 font-mono whitespace-nowrap">{formatIST(ev.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: System Logs ───────────────────────────────────────── */}
          {activeTab === 'logs' && (
            <div className="space-y-4 animate-fade-in">
              <div className="card-glass p-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="font-extrabold text-primary text-sm uppercase tracking-wider flex items-center gap-2">
                      <FileText className="w-4 h-4 text-accent" />
                      <span>System Logs</span>
                    </h3>
                    <p className="text-[11px] text-primary font-medium mt-0.5">Application audit trail — all non-security module events.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={logsModuleFilter}
                      onChange={(e) => { setLogsModuleFilter(e.target.value); setLogsPage(0); }}
                      className="px-3 py-1.5 rounded-xl border border-accent/25 bg-white text-xs font-bold text-primary cursor-pointer"
                    >
                      <option value="">All Modules</option>
                      <option value="Auth">Auth</option>
                      <option value="Recruitment">Recruitment</option>
                      <option value="HR">HR</option>
                      <option value="CRM">CRM</option>
                      <option value="System">System</option>
                    </select>
                    <button onClick={loadSystemLogs} disabled={logsLoading} className="p-1.5 rounded-xl bg-white border border-accent/25 text-primary hover:bg-gray-50 cursor-pointer">
                      <RefreshCw className={`w-3.5 h-3.5 text-accent ${logsLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-accent/20 overflow-hidden bg-white">
                  <table className="w-full text-xs">
                    <thead className="bg-primary text-white text-[10px] font-black uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3 text-left">Timestamp</th>
                        <th className="py-2.5 px-3 text-left">User</th>
                        <th className="py-2.5 px-3 text-left">Action</th>
                        <th className="py-2.5 px-3 text-left hidden md:table-cell">Module</th>
                        <th className="py-2.5 px-3 text-right hidden lg:table-cell">IP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-accent/10">
                      {logsLoading ? (
                        <tr><td colSpan={5} className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-accent" /></td></tr>
                      ) : systemLogs.length === 0 ? (
                        <tr><td colSpan={5} className="py-8 text-center text-primary/60 font-bold">No system logs found</td></tr>
                      ) : systemLogs.map(log => (
                        <tr key={log.id} className="hover:bg-accent/5 transition-colors">
                          <td className="py-2.5 px-3 whitespace-nowrap font-medium text-primary">{formatIST(log.createdAt)}</td>
                          <td className="py-2.5 px-3 font-extrabold text-primary">@{log.username || 'system'}</td>
                          <td className="py-2.5 px-3 font-bold text-primary">{log.action?.replace(/_/g, ' ') || '—'}</td>
                          <td className="py-2.5 px-3 hidden md:table-cell">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-primary/10 text-primary uppercase">{log.module || '—'}</span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-[10px] text-primary/60 hidden lg:table-cell">{log.ipAddress || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {logsTotal > logsLimit && (
                  <div className="flex items-center justify-between pt-3 text-xs font-bold">
                    <span className="text-gray-500">Showing {logsPage * logsLimit + 1}-{Math.min((logsPage + 1) * logsLimit, logsTotal)} of {logsTotal}</span>
                    <div className="flex items-center gap-2">
                      <button disabled={logsPage === 0} onClick={() => setLogsPage(p => p - 1)} className="px-3 py-1.5 rounded-lg border border-accent-soft bg-white text-primary disabled:opacity-40">Previous</button>
                      <button disabled={(logsPage + 1) * logsLimit >= logsTotal} onClick={() => setLogsPage(p => p + 1)} className="px-3 py-1.5 rounded-lg border border-accent-soft bg-white text-primary disabled:opacity-40">Next</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB: Security Events ───────────────────────────────────── */}
          {activeTab === 'events' && (
            <div className="space-y-4 animate-fade-in">
              <div className="card-glass p-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="font-extrabold text-primary text-sm uppercase tracking-wider flex items-center gap-2">
                      <Eye className="w-4 h-4 text-accent" />
                      <span>Security Events History</span>
                    </h3>
                    <p className="text-[11px] text-primary font-medium mt-0.5">Complete audit log of developer tools detection and security events.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-primary/40 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={secSearch}
                        onChange={(e) => setSecSearch(e.target.value)}
                        placeholder="Search user, page, IP..."
                        className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white border border-accent/25 focus:outline-none focus:ring-1 focus:ring-accent w-44"
                      />
                    </div>
                    <select
                      value={secFilter}
                      onChange={(e) => setSecFilter(e.target.value as any)}
                      className="px-2.5 py-1.5 rounded-xl border border-accent/25 bg-white text-xs font-bold text-primary cursor-pointer"
                    >
                      <option value="ALL">All Events</option>
                      <option value="OPENED">Opened Only</option>
                      <option value="CLOSED">Closed Only</option>
                    </select>
                    <button onClick={loadSecurityEvents} disabled={secLoading} className="p-1.5 rounded-xl bg-white border border-accent/25 text-primary hover:bg-gray-50 cursor-pointer">
                      <RefreshCw className={`w-3.5 h-3.5 text-accent ${secLoading ? 'animate-spin' : ''}`} />
                    </button>
                    {securityEvents.length > 0 && (
                      <button onClick={handleClearSecEvents} className="px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold flex items-center gap-1.5 border border-red-200 transition-colors cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Clear History</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-accent/20 overflow-hidden bg-white">
                  <table className="w-full text-xs">
                    <thead className="bg-primary text-white text-[10px] font-black uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3 text-left">Date / Time</th>
                        <th className="py-2.5 px-3 text-left">User</th>
                        <th className="py-2.5 px-3 text-left">Detection Event</th>
                        <th className="py-2.5 px-3 text-left hidden md:table-cell">Source &amp; Confidence</th>
                        <th className="py-2.5 px-3 text-left hidden lg:table-cell">Page</th>
                        <th className="py-2.5 px-3 text-right">IP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-accent/10">
                      {secLoading && securityEvents.length === 0 ? (
                        <tr><td colSpan={6} className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-accent" /></td></tr>
                      ) : filteredSecEvents.length === 0 ? (
                        <tr><td colSpan={6} className="py-8 text-center text-primary/60 font-bold">No events found</td></tr>
                      ) : filteredSecEvents.map(ev => {
                        const isOpened = ev.action === 'DEVTOOLS_DETECTED';
                        return (
                          <tr key={ev.id} className="hover:bg-accent/5 transition-colors">
                            <td className="py-2.5 px-3 whitespace-nowrap font-medium text-primary">{formatIST(ev.createdAt)}</td>
                            <td className="py-2.5 px-3 font-extrabold text-primary">@{ev.username || 'unknown'}</td>
                            <td className="py-2.5 px-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                isOpened ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}>
                                {isOpened ? <CircleX className="w-3 h-3" /> : <CircleCheck className="w-3 h-3" />}
                                {isOpened ? 'DevTools Opened' : 'DevTools Closed'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 hidden md:table-cell">
                              <div className="font-bold text-primary text-[11px]">{ev.details?.source || '—'}</div>
                              {isOpened && <span className="text-[9px] font-black text-accent uppercase">Confidence: {ev.details?.confidence || 'High'}</span>}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-primary hidden lg:table-cell">{ev.details?.page || '—'}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-[10px] text-primary/60">{ev.ipAddress || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="p-2.5 bg-primary/5 border-t border-accent/10 flex items-center justify-between text-[11px] text-primary/60 font-semibold">
                  <span>Showing {filteredSecEvents.length} of {securityEvents.length} events</span>
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                    Live Socket.IO Stream Active
                  </span>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
