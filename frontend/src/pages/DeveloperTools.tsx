import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { Auth, UserSession, apiFetch } from '../services/api';
import { getSidebarCollapsed, subscribeSidebarCollapsed } from '../utils/sidebarState';
import {
  Server, Database, Shield, Activity, Globe, Package, FileText,
  RefreshCw, CheckCircle2, XCircle, Clock, Cpu, HardDrive, AlertTriangle,
  ChevronRight, Loader2, Search, Filter, Eye, ExternalLink, Zap
} from 'lucide-react';

interface HealthData {
  status: string;
  uptime: number;
  timestamp: string;
  api: { healthy: boolean; latency: number };
  database: { healthy: boolean; latency: number; tables: number };
  memory: { rss: string; heapUsed: string; heapTotal: string };
}

interface RouteInfo {
  path: string;
  methods: string[];
  middleware: string[];
}

export default function DeveloperTools() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(getSidebarCollapsed());
  const [activeTab, setActiveTab] = useState<'health' | 'database' | 'routes' | 'logs' | 'diagnostics' | 'environment' | 'dependencies'>('health');

  useEffect(() => {
    return subscribeSidebarCollapsed(setCollapsed);
  }, []);
  const [loading, setLoading] = useState(false);

  // Data states
  const [health, setHealth] = useState<HealthData | null>(null);
  const [dbHealth, setDbHealth] = useState<any>(null);
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [dependencies, setDependencies] = useState<any>(null);

  // Filters
  const [logSearch, setLogSearch] = useState('');
  const [logModule, setLogModule] = useState('');
  const [routeSearch, setRouteSearch] = useState('');

  useEffect(() => {
    if (!Auth.check()) { navigate('/login'); return; }
    const s = Auth.get();
    if (!s || !['Admin', 'Super Admin'].includes(s.role)) {
      navigate('/dashboard');
      return;
    }
    setSession(s);
    loadHealth();
  }, []);

  const loadHealth = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/dev-tools/health');
      if (data?.data) setHealth(data.data);
    } catch (err: any) {
      showToast('Failed to load health data', 'error');
    }
    setLoading(false);
  }, []);

  const loadDbHealth = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/dev-tools/db-health');
      if (data?.data) setDbHealth(data.data);
    } catch { showToast('Failed to load DB health', 'error'); }
    setLoading(false);
  }, []);

  const loadRoutes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/dev-tools/routes');
      if (data?.data?.routes) setRoutes(data.data.routes);
    } catch { showToast('Failed to load routes', 'error'); }
    setLoading(false);
  }, []);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (logSearch) params.set('search', logSearch);
      if (logModule) params.set('module', logModule);
      params.set('limit', '100');
      const data = await apiFetch(`/dev-tools/logs?${params}`);
      if (data?.data?.logs) setLogs(data.data.logs);
    } catch { showToast('Failed to load logs', 'error'); }
    setLoading(false);
  }, [logSearch, logModule]);

  const loadDiagnostics = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/dev-tools/diagnostics');
      if (data?.data) setDiagnostics(data.data);
    } catch { showToast('Failed to load diagnostics', 'error'); }
    setLoading(false);
  }, []);

  const loadDependencies = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/dev-tools/dependencies');
      if (data?.data) setDependencies(data.data);
    } catch { showToast('Failed to load dependencies', 'error'); }
    setLoading(false);
  }, []);

  useEffect(() => {
    const loadMap: Record<string, () => void> = {
      health: loadHealth,
      database: loadDbHealth,
      routes: loadRoutes,
      logs: loadLogs,
      diagnostics: loadDiagnostics,
      dependencies: loadDependencies
    };
    loadMap[activeTab]?.();
  }, [activeTab]);

  const tabs = [
    { key: 'health', label: 'API Health', icon: Zap },
    { key: 'database', label: 'Database', icon: Database },
    { key: 'routes', label: 'API Routes', icon: Globe },
    { key: 'logs', label: 'App Logs', icon: FileText },
    { key: 'diagnostics', label: 'System', icon: Cpu },
    { key: 'dependencies', label: 'Dependencies', icon: Package }
  ];

  const filteredRoutes = routes.filter(r =>
    !routeSearch || r.path.toLowerCase().includes(routeSearch.toLowerCase()) ||
    r.methods.some(m => m.toLowerCase().includes(routeSearch.toLowerCase()))
  );

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const StatusBadge = ({ ok, label }: { ok: boolean; label: string }) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
      {ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {label}
    </span>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${collapsed ? 'lg:pl-20' : 'lg:pl-64'} overflow-hidden`}>
        <Topbar title="Developer Tools" session={session} onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-4">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-700 rounded-2xl p-4 sm:p-6 text-black shadow-xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-black/10 rounded-xl"><Server className="w-6 h-6" /></div>
              <div>
                <h2 className="text-lg sm:text-xl font-black">Developer Tools & System Diagnostics</h2>
                <p className="text-xs text-black">API health, database status, route inspection, system diagnostics & application logs</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    activeTab === tab.key
                      ? 'bg-primary text-white shadow-lg'
                      : 'bg-white text-primary hover:bg-primary/5 border border-gray-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
            <button onClick={() => { const loadMap: Record<string, () => void> = { health: loadHealth, database: loadDbHealth, routes: loadRoutes, logs: loadLogs, diagnostics: loadDiagnostics, dependencies: loadDependencies }; loadMap[activeTab]?.(); }} className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-white text-primary hover:bg-primary/5 border border-gray-200">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button 
              onClick={async () => {
                try {
                  const res = await apiFetch('/admin/force-db-update');
                  showToast(res.message || 'Database schema initialized successfully', 'success');
                } catch (err: any) {
                  showToast('Database update failed: ' + (err.message || 'Unknown error'), 'error');
                }
              }}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-300 ml-auto"
            >
              <HardDrive className="w-3.5 h-3.5" />
              Force DB Update
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}

          {/* ── Health Tab ──────────────────────────────────────────── */}
          {activeTab === 'health' && health && !loading && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-500">API Status</span>
                    <StatusBadge ok={health.api.healthy} label={health.api.healthy ? 'Healthy' : 'Down'} />
                  </div>
                  <div className="text-2xl font-black text-primary">{health.api.latency}ms</div>
                  <div className="text-[10px] text-gray-400">Response latency</div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-500">Database</span>
                    <StatusBadge ok={health.database.healthy} label={health.database.healthy ? 'Connected' : 'Error'} />
                  </div>
                  <div className="text-2xl font-black text-primary">{health.database.latency}ms</div>
                  <div className="text-[10px] text-gray-400">{health.database.tables} tables</div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-500">Memory</span>
                    <HardDrive className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="text-2xl font-black text-primary">{health.memory.heapUsed}</div>
                  <div className="text-[10px] text-gray-400">of {health.memory.heapTotal} heap</div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-500">Uptime</span>
                    <Clock className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="text-2xl font-black text-primary">{formatUptime(health.uptime)}</div>
                  <div className="text-[10px] text-gray-400">Server uptime</div>
                </div>
              </div>
            </div>
          )}

          {/* ── Database Tab ────────────────────────────────────────── */}
          {activeTab === 'database' && dbHealth && !loading && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-black text-primary">Database: {dbHealth.database}</h3>
                  <StatusBadge ok={dbHealth.connected} label={dbHealth.connected ? 'Connected' : 'Error'} />
                </div>
                <div className="text-xs text-gray-500 mb-3">{dbHealth.tables} tables found</div>

                {dbHealth.rowCounts && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                    {Object.entries(dbHealth.rowCounts).map(([table, count]) => (
                      <div key={table} className="bg-gray-50 rounded-lg p-2 text-center">
                        <div className="text-lg font-black text-primary">{String(count)}</div>
                        <div className="text-[10px] text-gray-500 truncate">{table}</div>
                      </div>
                    ))}
                  </div>
                )}

                {dbHealth.tableList && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 mb-2">All Tables</h4>
                    <div className="flex flex-wrap gap-1">
                      {dbHealth.tableList.map((t: string) => (
                        <span key={t} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-full font-medium">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Routes Tab ──────────────────────────────────────────── */}
          {activeTab === 'routes' && !loading && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={routeSearch}
                    onChange={e => setRouteSearch(e.target.value)}
                    placeholder="Search routes..."
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <span className="text-xs text-gray-400 font-bold">{filteredRoutes.length} routes</span>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="max-h-[60vh] overflow-y-auto">
                  {filteredRoutes.map((route, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <div className="flex gap-1 flex-shrink-0">
                        {route.methods.map(m => (
                          <span key={m} className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                            m === 'GET' ? 'bg-emerald-100 text-emerald-700' :
                            m === 'POST' ? 'bg-blue-100 text-blue-700' :
                            m === 'PUT' ? 'bg-amber-100 text-amber-700' :
                            m === 'DELETE' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                          }`}>{m}</span>
                        ))}
                      </div>
                      <code className="text-xs text-gray-700 font-mono truncate flex-1">{route.path}</code>
                      {route.middleware.length > 0 && (
                        <div className="flex gap-0.5 flex-shrink-0">
                          {route.middleware.slice(0, 3).map((mw, j) => (
                            <span key={j} className="px-1 py-0.5 bg-purple-50 text-purple-600 text-[8px] rounded font-medium">{mw}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Logs Tab ────────────────────────────────────────────── */}
          {activeTab === 'logs' && !loading && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={logSearch}
                    onChange={e => setLogSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && loadLogs()}
                    placeholder="Search logs..."
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <select
                  value={logModule}
                  onChange={e => { setLogModule(e.target.value); }}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold bg-white"
                >
                  <option value="">All Modules</option>
                  <option value="Auth">Auth</option>
                  <option value="Security">Security</option>
                  <option value="UserManagement">User Mgmt</option>
                  <option value="DevTools">DevTools</option>
                  <option value="KioskPins">Kiosk PINs</option>
                </select>
                <button onClick={loadLogs} className="px-3 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover transition-colors">
                  <Search className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="max-h-[60vh] overflow-y-auto">
                  {logs.length === 0 && <div className="text-center py-8 text-xs text-gray-400">No logs found</div>}
                  {logs.map((log, i) => (
                    <div key={i} className="px-3 py-2 border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                            log.success ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                          }`}>{log.action}</span>
                          <span className="text-[10px] text-gray-500 font-medium">{log.module}</span>
                          <span className="text-[10px] text-gray-400">by {log.username}</span>
                        </div>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">
                          {log.created_at ? new Date(log.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—'}
                        </span>
                      </div>
                      {log.details && (
                        <div className="text-[10px] text-gray-400 mt-0.5 truncate font-mono">
                          {typeof log.details === 'object' ? JSON.stringify(log.details).substring(0, 120) : String(log.details).substring(0, 120)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Diagnostics Tab ─────────────────────────────────────── */}
          {activeTab === 'diagnostics' && diagnostics && !loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <h3 className="text-sm font-black text-primary mb-3 flex items-center gap-2"><Cpu className="w-4 h-4" /> Node.js</h3>
                <div className="space-y-2">
                  {Object.entries(diagnostics.node || {}).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs">
                      <span className="text-gray-500 font-medium">{k}</span>
                      <span className="font-bold text-gray-700">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <h3 className="text-sm font-black text-primary mb-3 flex items-center gap-2"><Server className="w-4 h-4" /> Operating System</h3>
                <div className="space-y-2">
                  {Object.entries(diagnostics.os || {}).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs">
                      <span className="text-gray-500 font-medium">{k}</span>
                      <span className="font-bold text-gray-700 truncate max-w-[200px]">{Array.isArray(v) ? (v as number[]).map(n => n.toFixed(2)).join(', ') : String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm md:col-span-2">
                <h3 className="text-sm font-black text-primary mb-3 flex items-center gap-2"><HardDrive className="w-4 h-4" /> Process Memory</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.entries(diagnostics.process?.memoryUsage || {}).map(([k, v]) => (
                    <div key={k} className="text-center bg-gray-50 rounded-lg p-2">
                      <div className="text-lg font-black text-primary">{String(v)}</div>
                      <div className="text-[10px] text-gray-500">{k}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Dependencies Tab ─────────────────────────────────────── */}
          {activeTab === 'dependencies' && dependencies && !loading && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
                  <div className="text-xl font-black text-primary">{dependencies.totalDependencies}</div>
                  <div className="text-[10px] text-gray-500">Production</div>
                </div>
                <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
                  <div className="text-xl font-black text-gray-500">{dependencies.totalDevDependencies}</div>
                  <div className="text-[10px] text-gray-500">Development</div>
                </div>
                <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                  <div className="text-xs"><span className="font-bold">{dependencies.name}</span> v{dependencies.version}</div>
                  <div className="text-[10px] text-gray-500">Node: {dependencies.nodeEngine}</div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="max-h-[50vh] overflow-y-auto">
                  {(dependencies.dependencies || []).map((dep: any, i: number) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2 border-b border-gray-50 hover:bg-gray-50">
                      <code className="text-xs font-mono font-bold text-gray-700">{dep.name}</code>
                      <span className="text-xs text-gray-500 font-mono">{dep.version}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}
