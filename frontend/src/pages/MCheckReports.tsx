import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { API, Auth, UserSession } from '../services/api';
import { getSidebarCollapsed, subscribeSidebarCollapsed } from '../utils/sidebarState';
import {
  BarChart3, Download, FileSpreadsheet, Filter, Search, RefreshCw,
  Calendar, CheckCircle2, XCircle, Clock, AlertCircle, Circle,
  ChevronDown, AlertTriangle, TrendingUp, TrendingDown, Minus,
  ClipboardList, Target, Eye, ChevronRight, UserCheck, ArrowRight
} from 'lucide-react';

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  DONE:        { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  NOT_DONE:    { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     dot: 'bg-red-500' },
  IN_PROGRESS: { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-black' },
  POSTPONED:   { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200',  dot: 'bg-purple-500' },
  PENDING:     { bg: 'bg-gray-50',    text: 'text-gray-500',    border: 'border-gray-200',    dot: 'bg-gray-400' },
};

const MODULE_BARS = ['bg-primary', 'bg-accent', 'bg-emerald-600', 'bg-purple-600', 'bg-rose-600', 'bg-teal-600'];

function Toast({ msg, type }: { msg: string; type: string }) {
  const bg = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-red-600' : 'bg-primary';
  return <div className={`fixed bottom-6 right-6 z-[200] px-5 py-3 rounded-xl text-black text-sm font-semibold shadow-xl animate-slide-up ${bg}`}>{msg}</div>;
}

export default function MCheckReports() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(getSidebarCollapsed());
  const [toast, setToast] = useState<any>(null);

  useEffect(() => {
    return subscribeSidebarCollapsed(setCollapsed);
  }, []);

  const today = (() => {
    const n = new Date();
    const ist = new Date(n.getTime() + (n.getTimezoneOffset() * 60000) + (5.5 * 3600000));
    return ist.toISOString().split('T')[0];
  })();

  const [filterMode, setFilterMode] = useState<'date' | 'range'>('date');
  const [filterDate, setFilterDate] = useState(today);
  const [filterFrom, setFilterFrom] = useState(today);
  const [filterTo, setFilterTo] = useState(today);
  const [filterModule, setFilterModule] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterSearch, setFilterSearch] = useState('');

  const [reportData, setReportData] = useState<any>(null);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCheckpoint, setExpandedCheckpoint] = useState<number | null>(null);

  const showToast = (msg: string, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { status: filterStatus || 'ALL', search: filterSearch };
      if (filterMode === 'date') params.date = filterDate;
      else { params.fromDate = filterFrom; params.toDate = filterTo; }
      if (filterModule) params.module_id = filterModule;

      const [repData, trendRes, modRes] = await Promise.all([
        API.getMCheckReports(params),
        API.getMCheckTrend(14),
        API.getMCheckModules()
      ]);
      if (repData.success) setReportData(repData);
      if (trendRes.success) setTrendData(trendRes.trend || []);
      if (modRes.success) setModules(modRes.modules || []);
    } catch (e) { showToast('Failed to load report', 'error'); }
    finally { setLoading(false); }
  }, [filterMode, filterDate, filterFrom, filterTo, filterModule, filterStatus, filterSearch]);

  useEffect(() => {
    if (!Auth.check()) { navigate('/login'); return; }
    setSession(Auth.get());
    loadReport();
  }, [navigate, loadReport]);

  const handleExport = (type: 'pdf' | 'excel') => {
    const params: any = { status: filterStatus || 'ALL' };
    if (filterMode === 'date') params.date = filterDate;
    else { params.fromDate = filterFrom; params.toDate = filterTo; }
    if (filterModule) params.module_id = filterModule;
    const url = API.getMCheckExportUrl(type, params);
    window.open(url, '_blank');
  };

  const kpi = reportData?.kpis;
  const attentionItems: any[] = reportData?.attentionItems || [];
  const moduleStats: any[] = reportData?.moduleStats || [];
  const checkpoints: any[] = reportData?.checkpoints || [];

  const StatusBadge = ({ status }: { status: string }) => {
    const s = STATUS_COLORS[status] || STATUS_COLORS.PENDING;
    const label = status === 'IN_PROGRESS' ? 'In Progress' : status === 'NOT_DONE' ? 'Not Done' : status ? status.charAt(0) + status.slice(1).toLowerCase() : 'Pending';
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${s.bg} ${s.text} ${s.border}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
        {label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${collapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        <Topbar title="MCheck Reports" session={session} onMenuClick={() => setSidebarOpen(true)} />
        {toast && <Toast msg={toast.msg} type={toast.type} />}

        <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-primary flex items-center gap-2">
                <BarChart3 className="w-7 h-7 text-accent" /> Daily MCheck Management Dashboard
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">Management Performance Review & Operational Attention Desk</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => handleExport('pdf')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-black text-sm font-bold hover:bg-red-700 transition-all shadow-md cursor-pointer"
                title="Download formatted PDF report"
              >
                <Download className="w-4 h-4" /> Download PDF
              </button>
              <button
                onClick={() => handleExport('excel')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-all shadow-md cursor-pointer"
                title="Export detailed 6-sheet Excel workbook"
              >
                <FileSpreadsheet className="w-4 h-4" /> Export Excel
              </button>
              <button
                onClick={loadReport}
                className="p-2.5 rounded-xl bg-white border border-gray-200 hover:bg-primary hover:text-white hover:border-primary transition-all shadow-sm cursor-pointer"
                title="Refresh Report"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3 shadow-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-1">
                {(['date', 'range'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setFilterMode(m)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${filterMode === m ? 'bg-primary text-white shadow' : 'text-gray-500 hover:text-gray-800'}`}
                  >
                    {m === 'date' ? 'Single Date' : 'Date Range'}
                  </button>
                ))}
              </div>
              {filterMode === 'date' ? (
                <input
                  type="date"
                  value={filterDate}
                  max={today}
                  onChange={e => setFilterDate(e.target.value)}
                  className="input-modern !w-auto !py-2"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={filterFrom}
                    max={today}
                    onChange={e => setFilterFrom(e.target.value)}
                    className="input-modern !w-auto !py-2"
                  />
                  <span className="text-gray-400 font-bold text-sm">to</span>
                  <input
                    type="date"
                    value={filterTo}
                    max={today}
                    min={filterFrom}
                    onChange={e => setFilterTo(e.target.value)}
                    className="input-modern !w-auto !py-2"
                  />
                </div>
              )}
              <select
                value={filterModule}
                onChange={e => setFilterModule(e.target.value)}
                className="select-modern !w-auto !py-2"
              >
                <option value="">All Modules</option>
                {modules.map(m => <option key={m.id} value={m.id}>{m.module_name}</option>)}
              </select>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="select-modern !w-auto !py-2"
              >
                {['ALL', 'DONE', 'PENDING', 'NOT_DONE', 'IN_PROGRESS', 'POSTPONED'].map(s => (
                  <option key={s} value={s}>
                    {s === 'ALL' ? 'All Statuses' : s === 'IN_PROGRESS' ? 'In Progress' : s === 'NOT_DONE' ? 'Not Done' : s}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search checkpoints, dept, remarks..."
                  value={filterSearch}
                  onChange={e => setFilterSearch(e.target.value)}
                  className="input-modern !pl-9 !py-2"
                />
              </div>
              <button onClick={loadReport} className="btn-primary text-xs py-2 px-4 flex items-center gap-2">
                <Filter className="w-3.5 h-3.5" /> Apply
              </button>
            </div>
          </div>

          {loading ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-12 flex items-center justify-center shadow-sm">
              <div className="flex items-center gap-3 text-gray-500">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="font-semibold text-sm">Loading reports...</span>
              </div>
            </div>
          ) : (
            <>
              {/* Executive Summary KPI Cards (Section 13) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-black text-gray-500 uppercase tracking-widest">
                    DAILY MCHECK — {reportData?.dateDisplay?.toUpperCase() || filterDate}
                  </h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                  {[
                    { label: 'Total Checkpoints', value: kpi?.total ?? 0, bg: 'bg-primary', icon: Target },
                    { label: 'Completed', value: kpi?.done ?? 0, bg: 'bg-emerald-600', icon: CheckCircle2 },
                    { label: 'Pending', value: kpi?.pending ?? 0, bg: 'bg-gray-400', icon: Circle },
                    { label: 'Not Done', value: kpi?.notDone ?? 0, bg: 'bg-red-500', icon: XCircle },
                    { label: 'In Progress', value: kpi?.inProgress ?? 0, bg: 'bg-black', icon: Clock },
                    { label: 'Postponed', value: kpi?.postponed ?? 0, bg: 'bg-purple-600', icon: AlertCircle },
                    { label: 'Overall Completion', value: `${kpi?.completionPct ?? 0}%`, bg: 'bg-accent', icon: BarChart3 },
                  ].map((item, i) => {
                    const Icon = item.icon;
                    return (
                      <div key={i} className="bg-white border border-gray-100 p-4 rounded-2xl shadow-xs flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${item.bg}`}>
                          <Icon className="w-4 h-4 text-black" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xl font-black text-primary leading-tight">{item.value}</div>
                          <div className="text-[9.5px] font-bold text-gray-500 uppercase tracking-wide truncate">{item.label}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Module Performance (Section 14) + Trend */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Module Performance — Clicking opens module checklist */}
                <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-black text-gray-500 uppercase tracking-widest">MODULE PERFORMANCE</h2>
                    <span className="text-xs text-gray-400 font-medium">Click module to view checklist</span>
                  </div>
                  <div className="space-y-4">
                    {moduleStats.length > 0 ? moduleStats.map((m, i) => (
                      <div
                        key={i}
                        onClick={() => navigate(`/daily-mcheck?moduleId=${m.module_id || (i + 1)}&date=${filterDate}`)}
                        className="p-3 rounded-xl border border-gray-100 hover:border-accent hover:bg-amber-50/20 transition-all cursor-pointer group"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="font-extrabold text-sm text-primary group-hover:text-accent transition-colors truncate">
                              {m.module_name}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-accent group-hover:translate-x-1 transition-all" />
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                            <span className="text-xs font-bold text-gray-500">{m.done} / {m.total}</span>
                            <span className={`text-sm font-black ${m.completion_pct === 100 ? 'text-emerald-600' : m.completion_pct >= 50 ? 'text-primary' : 'text-red-500'}`}>
                              {m.completion_pct}%
                            </span>
                            {m.completion_pct < 50 && m.total > 0 && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${MODULE_BARS[i % 6]}`}
                            style={{ width: `${m.completion_pct}%` }}
                          />
                        </div>

                        {/* Quick Stats */}
                        <div className="flex items-center gap-3 text-[10.5px] text-gray-500 flex-wrap">
                          <span className="text-emerald-600 font-bold">✓ {m.done} Done</span>
                          <span className="text-gray-400 font-medium">● {m.pending} Pending</span>
                          <span className="text-red-500 font-bold">✗ {m.not_done} Not Done</span>
                          <span className="text-amber-600 font-medium">↻ {m.in_progress} In Prog</span>
                          {m.postponed > 0 && <span className="text-purple-600 font-medium">↷ {m.postponed} Postponed</span>}
                        </div>
                      </div>
                    )) : (
                      <div className="text-center text-gray-400 text-sm py-6">No module data for selected filters</div>
                    )}
                  </div>
                </div>

                {/* Daily Trend */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
                  <h2 className="text-sm font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-accent" /> DAILY TREND
                  </h2>
                  <div className="space-y-2.5">
                    {trendData.slice(-10).map((t, i, arr) => {
                      const prev = arr[i - 1];
                      const diff = prev ? t.completion_pct - prev.completion_pct : 0;
                      return (
                        <div key={t.date} className="flex items-center gap-2">
                          <div className="text-[11px] text-gray-500 w-20 flex-shrink-0 font-medium">
                            {new Date(t.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </div>
                          <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${t.completion_pct >= 80 ? 'bg-emerald-500' : t.completion_pct >= 50 ? 'bg-black' : 'bg-red-400'}`}
                              style={{ width: `${t.completion_pct}%` }}
                            />
                          </div>
                          <div className="text-[11px] font-black text-primary w-10 text-right">{t.completion_pct}%</div>
                          <div className="w-4 flex-shrink-0">
                            {diff > 0 ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : diff < 0 ? <TrendingDown className="w-3 h-3 text-red-400" /> : <Minus className="w-3 h-3 text-gray-300" />}
                          </div>
                        </div>
                      );
                    })}
                    {trendData.length === 0 && <div className="text-center text-gray-400 text-sm py-4">No trend data available</div>}
                  </div>
                </div>
              </div>

              {/* Attention Required (Section 15: NOT DONE, IN PROGRESS, POSTPONED) */}
              {attentionItems.length > 0 && (
                <div className="bg-white rounded-2xl overflow-hidden border border-red-200 shadow-sm">
                  <div className="bg-red-50 px-5 py-3.5 flex items-center justify-between border-b border-red-200">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                      <h2 className="text-sm font-black text-red-700 uppercase tracking-wide">
                        ATTENTION REQUIRED ({attentionItems.length})
                      </h2>
                    </div>
                    <span className="text-xs text-red-600 font-bold">Unresolved & Postponed Issues</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {attentionItems.map((item: any, i: number) => {
                      const updatedDateFormatted = item.response_updated_at || item.submitted_at
                        ? new Date(item.response_updated_at || item.submitted_at).toLocaleString('en-IN')
                        : item.response_date || '—';

                      return (
                        <div key={i} className="p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-primary text-sm">{item.checkpoint_title}</span>
                                <span className="text-[11px] font-bold text-gray-400 px-2 py-0.5 rounded-md bg-gray-100">
                                  {item.module_name}
                                </span>
                              </div>

                              <div className="text-xs text-gray-600 flex items-center gap-4 flex-wrap">
                                <span>Responsible: <strong className="text-primary">{item.responsible_person || item.responsible_department || 'Assigned Staff'}</strong></span>
                                {item.scheduled_time && <span>Scheduled: <strong>{item.scheduled_time}</strong></span>}
                              </div>

                              {item.remarks && (
                                <div className="text-xs text-gray-700 mt-1 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                  <span className="font-bold text-gray-500">Remarks: </span>
                                  <span>{item.remarks}</span>
                                </div>
                              )}

                              {item.corrective_action && (
                                <div className="text-xs text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200">
                                  <span className="font-bold">Corrective Action: </span>
                                  <span>{item.corrective_action}</span>
                                </div>
                              )}

                              <div className="text-[10.5px] text-gray-400 pt-1">
                                Updated by: <strong className="text-gray-700">{item.updated_by || item.submitted_by || 'Staff'}</strong> · {updatedDateFormatted}
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              <StatusBadge status={item.system_status} />
                              {item.compliance_status && (
                                <span className="text-[10px] text-gray-400 font-medium">{item.compliance_status}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Detailed Checkpoints Report (Section 17) */}
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-black text-gray-500 uppercase tracking-widest">
                      DETAILED CHECKPOINT REPORT ({checkpoints.length})
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">Comprehensive audit trail of all operational checkpoints</p>
                  </div>
                </div>
                <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                  {checkpoints.length > 0 ? checkpoints.map((cp: any, i: number) => (
                    <div
                      key={i}
                      className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setExpandedCheckpoint(expandedCheckpoint === i ? null : i)}
                    >
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">{cp.module_name}</span>
                            <span className="text-gray-300">·</span>
                            <span className="text-xs font-bold text-gray-500">{cp.responsible_department}</span>
                          </div>
                          <div className="font-bold text-primary text-sm mt-0.5">{cp.checkpoint_title}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            Responsible: <strong className="text-gray-700">{cp.responsible_person || 'Unassigned'}</strong>
                            {cp.scheduled_time ? ` · ${cp.scheduled_time}` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <StatusBadge status={cp.system_status} />
                          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedCheckpoint === i ? 'rotate-180' : ''}`} />
                        </div>
                      </div>

                      {expandedCheckpoint === i && (
                        <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs animate-fade-in bg-[#FBF8F5] p-3 rounded-xl">
                          <div><span className="font-bold text-gray-500">Compliance Status:</span> <strong className="text-primary">{cp.compliance_status || '—'}</strong></div>
                          <div><span className="font-bold text-gray-500">Accuracy:</span> <strong className="text-primary">{cp.accuracy || '—'}</strong></div>
                          <div><span className="font-bold text-gray-500">Updated By:</span> <strong className="text-primary">{cp.updated_by || cp.submitted_by || '—'}</strong></div>
                          <div><span className="font-bold text-gray-500">Updated Date/Time:</span> <strong className="text-primary">{cp.response_updated_at ? new Date(cp.response_updated_at).toLocaleString('en-IN') : cp.response_date || '—'}</strong></div>
                          {cp.remarks && <div className="sm:col-span-2"><span className="font-bold text-gray-500">Remarks:</span> <span className="text-gray-700 italic">"{cp.remarks}"</span></div>}
                          {cp.corrective_action && <div className="sm:col-span-2"><span className="font-bold text-amber-700">Corrective Action:</span> <span className="text-amber-800">{cp.corrective_action}</span></div>}
                          {cp.photo_url && (
                            <div className="sm:col-span-2 flex items-center gap-2">
                              <span className="font-bold text-gray-500">Photo Evidence:</span>
                              <a href={cp.photo_url} target="_blank" rel="noreferrer" className="text-xs text-accent font-bold underline flex items-center gap-1">
                                <Eye className="w-3.5 h-3.5" /> View Photo
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )) : (
                    <div className="text-center text-gray-400 text-sm py-10">No checkpoints found for selected filters</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
