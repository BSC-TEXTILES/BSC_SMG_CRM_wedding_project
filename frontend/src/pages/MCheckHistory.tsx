import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { API, Auth, UserSession } from '../services/api';
import { getSidebarCollapsed, subscribeSidebarCollapsed } from '../utils/sidebarState';
import {
  History, Calendar, ChevronRight, CheckCircle2, XCircle, Clock,
  AlertCircle, Circle, TrendingUp, TrendingDown, Minus, RefreshCw,
  FileSpreadsheet, Download, Search, BarChart3, Eye
} from 'lucide-react';

function Toast({ msg, type }: { msg: string; type: string }) {
  const bg = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-red-600' : 'bg-primary';
  return <div className={`fixed bottom-6 right-6 z-[200] px-5 py-3 rounded-xl text-black text-sm font-semibold shadow-xl animate-slide-up ${bg}`}>{msg}</div>;
}

export default function MCheckHistory() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(getSidebarCollapsed());
  const [toast, setToast] = useState<any>(null);

  useEffect(() => {
    return subscribeSidebarCollapsed(setCollapsed);
  }, []);

  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayReport, setDayReport] = useState<any>(null);
  const [dayReportLoading, setDayReportLoading] = useState(false);
  const [searchDate, setSearchDate] = useState('');

  const showToast = (msg: string, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.getMCheckHistory({ limit: 90 });
      if (res.success) setHistory(res.history || []);
    } catch (e) { showToast('Failed to load history', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!Auth.check()) { navigate('/login'); return; }
    setSession(Auth.get());
    loadHistory();
  }, [navigate, loadHistory]);

  const openDayReport = async (date: string) => {
    setSelectedDate(date);
    setDayReportLoading(true);
    try {
      const res = await API.getMCheckReports({ date });
      if (res.success) setDayReport(res);
    } catch (e) { showToast('Failed to load day report', 'error'); }
    finally { setDayReportLoading(false); }
  };

  const handleExport = (date: string, type: 'pdf' | 'excel') => {
    const url = API.getMCheckExportUrl(type, { date });
    window.open(url, '_blank');
  };

  const filteredHistory = searchDate
    ? history.filter(h => h.response_date.includes(searchDate))
    : history;

  const HistoryCard = ({ entry, prev }: { entry: any; prev: any }) => {
    const pct = entry.completion_pct;
    const prevPct = prev?.completion_pct;
    const diff = prevPct !== undefined ? pct - prevPct : null;
    const isSelected = selectedDate === entry.response_date;

    return (
      <div
        onClick={() => openDayReport(entry.response_date)}
        className={`card-glass rounded-2xl p-4 cursor-pointer transition-all border-2 ${isSelected ? 'border-accent shadow-lg' : 'border-transparent hover:border-gray-200 hover:shadow-md'}`}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="font-black text-primary text-sm">{entry.date_display}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{entry.total_checkpoints} checkpoints</div>
          </div>
          <div className="flex flex-col items-end">
            <div className={`text-xl font-black ${pct === 100 ? 'text-emerald-600' : pct >= 75 ? 'text-primary' : pct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{pct}%</div>
            {diff !== null && (
              <div className={`flex items-center gap-0.5 text-[10px] font-bold ${diff > 0 ? 'text-emerald-500' : diff < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                {diff > 0 ? <TrendingUp className="w-3 h-3" /> : diff < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                {diff > 0 ? '+' : ''}{diff}%
              </div>
            )}
          </div>
        </div>

        {/* Mini bar */}
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
          <div className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-emerald-500' : pct >= 75 ? 'bg-primary' : pct >= 50 ? 'bg-black' : 'bg-red-400'}`}
            style={{ width: `${pct}%` }} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-1 text-center">
          {[
            { label: 'Done', val: entry.done ?? 0, color: 'text-emerald-600' },
            { label: 'Not Done', val: entry.not_done ?? 0, color: 'text-red-500' },
            { label: 'In Prog', val: entry.in_progress ?? 0, color: 'text-amber-600' },
            { label: 'Postponed', val: entry.postponed ?? 0, color: 'text-purple-600' },
          ].map(s => (
            <div key={s.label}>
              <div className={`text-sm font-black ${s.color}`}>{s.val}</div>
              <div className="text-[8px] text-gray-400 font-semibold">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Export buttons */}
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-100">
          <button onClick={e => { e.stopPropagation(); handleExport(entry.response_date, 'pdf'); }}
            className="flex items-center gap-1 text-[10px] font-bold text-red-600 hover:text-red-800 transition-colors px-2 py-1 rounded-lg hover:bg-red-50">
            <Download className="w-3 h-3" /> PDF
          </button>
          <button onClick={e => { e.stopPropagation(); handleExport(entry.response_date, 'excel'); }}
            className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-800 transition-colors px-2 py-1 rounded-lg hover:bg-emerald-50">
            <FileSpreadsheet className="w-3 h-3" /> Excel
          </button>
          <span className="ml-auto text-[10px] text-accent font-bold flex items-center gap-0.5">
            <Eye className="w-3 h-3" /> View
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${collapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        <Topbar title="MCheck History" session={session} onMenuClick={() => setSidebarOpen(true)} />
        {toast && <Toast msg={toast.msg} type={toast.type} />}

        <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-primary flex items-center gap-2">
                <History className="w-7 h-7 text-accent" /> MCheck History
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">Historical daily management checklist records</p>
            </div>
            <button onClick={loadHistory} className="p-2.5 rounded-xl bg-white border border-gray-200 hover:bg-primary hover:text-white hover:border-primary transition-all shadow-sm w-fit">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="date" value={searchDate} onChange={e => setSearchDate(e.target.value)}
              className="input-modern !pl-9" placeholder="Filter by date" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* History List */}
            <div className="lg:col-span-1 space-y-3">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">
                {filteredHistory.length} DAILY RECORDS
              </h2>
              {loading ? (
                <div className="space-y-3">
                  {Array(5).fill(0).map((_, i) => (
                    <div key={i} className="card-glass h-32 rounded-2xl animate-pulse bg-gray-100" />
                  ))}
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="card-glass rounded-2xl p-8 text-center">
                  <History className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <div className="text-sm font-bold text-gray-400">No history found</div>
                  <div className="text-xs text-gray-300 mt-1">Complete some daily checklists to see history here</div>
                </div>
              ) : (
                <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                  {filteredHistory.map((entry, i) => (
                    <HistoryCard key={entry.response_date} entry={entry} prev={filteredHistory[i + 1]} />
                  ))}
                </div>
              )}
            </div>

            {/* Day Detail Panel */}
            <div className="lg:col-span-2">
              {!selectedDate ? (
                <div className="card-glass rounded-2xl p-10 flex flex-col items-center justify-center h-full text-center">
                  <Calendar className="w-12 h-12 text-gray-200 mb-4" />
                  <div className="text-base font-bold text-gray-400">Select a date from the list</div>
                  <div className="text-sm text-gray-300 mt-1">to view the detailed daily report</div>
                </div>
              ) : dayReportLoading ? (
                <div className="card-glass rounded-2xl p-10 flex items-center justify-center">
                  <div className="flex items-center gap-3 text-gray-400">
                    <div className="spinner border-primary" />
                    <span className="font-semibold text-sm">Loading report...</span>
                  </div>
                </div>
              ) : dayReport ? (
                <div className="space-y-4 animate-fade-in">
                  {/* Day header */}
                  <div className="bg-primary rounded-2xl p-5 text-white">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-black text-accent uppercase tracking-widest mb-1">DAILY REVIEW</div>
                        <div className="text-xl font-black">{dayReport.dateDisplay}</div>
                        <div className="text-sm text-black mt-1">{dayReport.kpis.total} total checkpoints</div>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-black text-accent">{dayReport.kpis.completionPct}%</div>
                        <div className="text-[10px] text-black/50 uppercase">Completion</div>
                      </div>
                    </div>
                    <div className="mt-3 h-2 bg-black/10 rounded-full overflow-hidden">
                      <div className="h-full bg-accent rounded-full" style={{ width: `${dayReport.kpis.completionPct}%` }} />
                    </div>
                    {/* KPI row */}
                    <div className="grid grid-cols-5 gap-2 mt-3">
                      {[
                        { label: 'Done', val: dayReport.kpis.done, color: 'text-emerald-400' },
                        { label: 'Not Done', val: dayReport.kpis.notDone, color: 'text-red-400' },
                        { label: 'In Prog', val: dayReport.kpis.inProgress, color: 'text-amber-400' },
                        { label: 'Postponed', val: dayReport.kpis.postponed, color: 'text-purple-400' },
                        { label: 'Pending', val: dayReport.kpis.pending, color: 'text-black/40' },
                      ].map(s => (
                        <div key={s.label} className="text-center">
                          <div className={`text-lg font-black ${s.color}`}>{s.val}</div>
                          <div className="text-[9px] text-black/40 font-semibold">{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Module Performance */}
                  <div className="card-glass rounded-2xl p-5">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">MODULE PERFORMANCE</h3>
                    <div className="space-y-2">
                      {dayReport.moduleStats.map((m: any, i: number) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="text-xs font-bold text-primary w-40 truncate flex-shrink-0">{m.module_name}</div>
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${m.completion_pct === 100 ? 'bg-emerald-500' : m.completion_pct >= 50 ? 'bg-black' : 'bg-red-400'}`}
                              style={{ width: `${m.completion_pct}%` }} />
                          </div>
                          <div className="text-xs font-black text-primary w-14 text-right flex-shrink-0">{m.done}/{m.total}</div>
                          <div className={`text-xs font-black w-10 text-right flex-shrink-0 ${m.completion_pct === 100 ? 'text-emerald-600' : m.completion_pct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{m.completion_pct}%</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Attention Required */}
                  {dayReport.attentionItems.length > 0 && (
                    <div className="card-glass rounded-2xl overflow-hidden border border-red-100">
                      <div className="px-4 py-3 bg-red-50 border-b border-red-100">
                        <div className="text-xs font-black text-red-700 uppercase tracking-wide">⚠ Attention Required ({dayReport.attentionItems.length})</div>
                      </div>
                      <div className="divide-y divide-gray-50 max-h-60 overflow-y-auto">
                        {dayReport.attentionItems.map((item: any, i: number) => (
                          <div key={i} className="px-4 py-2.5 flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold text-primary">{item.checkpoint_title}</div>
                              <div className="text-[10px] text-gray-400">{item.module_name}</div>
                              {item.remarks && <div className="text-[10px] text-gray-500 italic mt-0.5">"{item.remarks}"</div>}
                            </div>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0 ${item.system_status === 'NOT_DONE' ? 'bg-red-100 text-red-700' : item.system_status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700'}`}>
                              {item.system_status?.replace('_', ' ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Export and View for this date */}
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => navigate(`/mcheck-reports?date=${selectedDate}`)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary transition-all shadow-sm">
                      <BarChart3 className="w-3.5 h-3.5 text-accent" /> Open Dashboard
                    </button>
                    <button onClick={() => handleExport(selectedDate, 'pdf')}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-600 text-black text-xs font-bold hover:bg-red-700 transition-all shadow-sm">
                      <Download className="w-3.5 h-3.5" /> PDF
                    </button>
                    <button onClick={() => handleExport(selectedDate, 'excel')}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all shadow-sm">
                      <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
