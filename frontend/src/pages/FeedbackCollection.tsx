import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import { getSidebarCollapsed, subscribeSidebarCollapsed } from '../utils/sidebarState';
import {
  MessageSquare,
  Search,
  Filter,
  Download,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Star,
  Calendar,
  TrendingUp,
  Phone,
  User,
  X,
  Eye,
  AlertCircle,
  CheckCircle,
  Sparkles,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Hash,
  ShieldAlert,
  FileText,
  Send,
  UserCheck
} from 'lucide-react';

export default function FeedbackCollection() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(getSidebarCollapsed());

  useEffect(() => {
    return subscribeSidebarCollapsed(setCollapsed);
  }, []);

  // Feedbacks & Stats
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ total: 0, positive: 0, negative: 0, npsScore: 100 });
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [sentimentFilter, setSentimentFilter] = useState<string>('all'); // all, positive, negative
  const [datePreset, setDatePreset] = useState<string>('all');
  const [startDateInput, setStartDateInput] = useState<string>('');
  const [endDateInput, setEndDateInput] = useState<string>('');

  // Selected Feedback Detail Modal
  const [selectedFeedback, setSelectedFeedback] = useState<any | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState<string>('called');
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [savingResolution, setSavingResolution] = useState<boolean>(false);

  const handleOpenModal = (f: any) => {
    setSelectedFeedback(f);
    setResolutionNotes(f.actionTaken || f.notes || '');
    setResolutionStatus(f.status || (f.isNegative ? 'called' : 'resolved'));
  };

  const handleSaveModalResolution = async (statusOverride?: string) => {
    if (!selectedFeedback) return;
    setSavingResolution(true);
    try {
      const targetStatus = statusOverride || resolutionStatus;
      await API.updateCallQueue({
        id: selectedFeedback.id,
        feedbackId: selectedFeedback.id,
        status: targetStatus,
        notes: resolutionNotes || 'Resolution saved from Customer Resolution Dashboard'
      });
      showToast('Customer resolution status updated and saved!', 'success');
      setSelectedFeedback(null);
      loadFeedbacks();
    } catch (err: any) {
      showToast('Failed to update resolution: ' + (err.message || 'Error'), 'error');
    } finally {
      setSavingResolution(false);
    }
  };

  const getISTDate = (d: Date = new Date()) => {
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(d.getTime() + (d.getTimezoneOffset() * 60000) + istOffset);
    return istDate.toISOString().split('T')[0];
  };

  const loadFeedbacks = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      const todayStr = getISTDate(new Date());

      if (datePreset === 'today') {
        params.date = todayStr;
      } else if (datePreset === 'yesterday') {
        const y = new Date(Date.now() - 86400000);
        params.date = getISTDate(y);
      } else if (datePreset === 'week') {
        const w = new Date(Date.now() - 6 * 86400000);
        params.startDate = getISTDate(w);
        params.endDate = todayStr;
      } else if (datePreset === 'month') {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        params.startDate = getISTDate(start);
        params.endDate = todayStr;
      } else if (datePreset === 'last_month') {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        params.startDate = getISTDate(start);
        params.endDate = getISTDate(end);
      } else if (datePreset === 'custom') {
        if (startDateInput) params.startDate = startDateInput;
        if (endDateInput) params.endDate = endDateInput;
      }

      if (sentimentFilter === 'negative') params.isNegative = 'true';
      if (sentimentFilter === 'positive') params.isNegative = 'false';
      if (search.trim()) params.search = search.trim();

      const res = await API.getFeedbacks(params);
      if (res && res.success) {
        setFeedbacks(res.feedbacks || []);
        if (res.stats) setStats(res.stats);
      }
    } catch (err: any) {
      console.warn('getFeedbacks background sync:', err?.message || err);
    } finally {
      setLoading(false);
    }
  }, [datePreset, startDateInput, endDateInput, sentimentFilter, search]);

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    setSession(Auth.get());
    loadFeedbacks();

    // Auto-refresh every 5 seconds for live feedback collection updates
    const interval = setInterval(() => {
      loadFeedbacks();
    }, 5000);
    return () => clearInterval(interval);
  }, [navigate, loadFeedbacks]);

  // Export CSV Handler
  const handleExportCSV = () => {
    if (feedbacks.length === 0) {
      showToast('No feedback records to export', 'error');
      return;
    }

    const headers = ['Feedback ID', 'Date', 'Customer Name', 'Mobile', 'Sentiment', 'Answers Summary', 'Customer Voice Notes'];
    const rows = feedbacks.map(f => [
      f.id || '',
      f.entryDate || '',
      `"${(f.customerName || 'Anonymous').replace(/"/g, '""')}"`,
      `"${(f.mobile || '').replace(/"/g, '""')}"`,
      f.isNegative ? 'Negative / Escalated' : 'Positive / Satisfied',
      `"${JSON.stringify(f.answers || {}).replace(/"/g, '""')}"`,
      `"${(f.voice || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BSC_Customer_Feedbacks_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Exported feedback data to CSV', 'success');
  };

  return (
    <div className="min-h-screen bg-background flex">
      <ToastContainer />
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${collapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        <Topbar
          title="Customer Feedback Collection & Analytics"
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="p-4 lg:p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Header & Quick Action Bar */}
          <div className="card-glass p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-accent text-[10px] font-black uppercase tracking-widest mb-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>BSC Exclusive Davanagere</span>
              </div>
              <h2 className="text-xl font-black text-primary tracking-tight flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-accent" />
                <span>Customer Feedback Repository</span>
              </h2>
              <p className="text-xs text-primary font-medium mt-0.5">Real-time log of customer survey responses, satisfaction scores &amp; voice of customer notes.</p>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                onClick={loadFeedbacks}
                className="px-3.5 py-2 rounded-xl bg-white border border-accent-soft text-primary text-xs font-extrabold hover:bg-gray-50 flex items-center gap-1.5 shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                onClick={handleExportCSV}
                className="btn-gold text-xs px-4 py-2 flex items-center gap-1.5 shadow-md"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Report (CSV)</span>
              </button>
            </div>
          </div>

          {/* Feedback Dashboard KPI Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Feedbacks */}
            <div className="card-glass p-5 flex items-center justify-between">
              <div>
                <div className="text-[10.5px] font-black uppercase tracking-wider text-primary">Total Feedbacks</div>
                <div className="text-2xl font-black text-primary mt-1">{stats.total || feedbacks.length}</div>
                <div className="text-[11px] text-emerald-700 font-bold mt-0.5 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> All Submitted Visits
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black">
                <MessageSquare className="w-6 h-6 text-primary" />
              </div>
            </div>

            {/* Satisfaction Rate / NPS */}
            <div className="card-glass p-5 flex items-center justify-between">
              <div>
                <div className="text-[10.5px] font-black uppercase tracking-wider text-primary">Satisfaction Rate</div>
                <div className="text-2xl font-black text-emerald-600 mt-1">{stats.npsScore || 100}%</div>
                <div className="text-[11px] text-gray-500 font-semibold mt-0.5">CSAT Index Score</div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-black">
                <Star className="w-6 h-6 fill-emerald-500 text-emerald-600" />
              </div>
            </div>

            {/* Positive Feedbacks */}
            <div className="card-glass p-5 flex items-center justify-between">
              <div>
                <div className="text-[10.5px] font-black uppercase tracking-wider text-primary">Positive Ratings</div>
                <div className="text-2xl font-black text-emerald-700 mt-1">{stats.positive || 0}</div>
                <div className="text-[11px] text-emerald-600 font-bold mt-0.5">Satisfied Shoppers</div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
                <ThumbsUp className="w-6 h-6" />
              </div>
            </div>

            {/* Negative Escalations */}
            <div className="card-glass p-5 flex items-center justify-between border-l-4 border-l-rose-500">
              <div>
                <div className="text-[10.5px] font-black uppercase tracking-wider text-primary">Needs Follow-up</div>
                <div className="text-2xl font-black text-rose-600 mt-1">{stats.negative || 0}</div>
                <div className="text-[11px] text-rose-600 font-bold mt-0.5 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Auto-Escalated to Queue
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
                <ThumbsDown className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="card-glass p-4 flex flex-col sm:flex-row items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by customer name, mobile, or feedback text..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-modern pl-9 py-2 text-xs font-semibold"
              />
            </div>

            {/* Sentiment Filter */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-3.5 h-3.5 text-accent hidden sm:block" />
              <select
                value={sentimentFilter}
                onChange={(e) => setSentimentFilter(e.target.value)}
                className="select-modern text-xs font-bold py-2"
              >
                <option value="all">All Sentiments</option>
                <option value="positive">Positive / Satisfied</option>
                <option value="negative">Negative / Needs Follow-up</option>
              </select>

              {/* Date Preset Filter */}
              <Calendar className="w-3.5 h-3.5 text-accent hidden sm:block ml-2" />
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value)}
                className="select-modern text-xs font-bold py-2"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="custom">Custom date</option>
              </select>

              {datePreset === 'custom' && (
                <div className="flex items-center gap-1.5 animate-fade-in">
                  <input
                    type="date"
                    value={startDateInput}
                    onChange={(e) => setStartDateInput(e.target.value)}
                    className="input-modern text-xs font-semibold py-1.5"
                    placeholder="Start"
                  />
                  <span className="text-xs font-bold text-gray-500">to</span>
                  <input
                    type="date"
                    value={endDateInput}
                    onChange={(e) => setEndDateInput(e.target.value)}
                    className="input-modern text-xs font-semibold py-1.5"
                    placeholder="End"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Feedback Data Table */}
          <div className="card-glass p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-accent-soft pb-3">
              <h3 className="font-extrabold text-primary text-sm uppercase tracking-wider flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-accent" />
                <span>Collected Survey Log ({feedbacks.length})</span>
              </h3>
              <span className="text-xs text-primary font-semibold">Showing real-time records</span>
            </div>

            {loading ? (
              <div className="py-12 text-center text-xs font-bold text-gray-500 flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-accent" />
                <span>Loading feedback entries...</span>
              </div>
            ) : feedbacks.length === 0 ? (
              <div className="py-12 text-center text-xs font-bold text-gray-500 space-y-2">
                <MessageSquare className="w-10 h-10 text-gray-300 mx-auto" />
                <div className="text-sm text-primary font-extrabold">No Feedback Submissions Found</div>
                <p className="text-gray-400 font-medium">Customer responses from the Customer Experience Survey will appear here in real-time.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-accent-soft text-[10.5px] font-black uppercase text-primary bg-background/80">
                      <th className="py-3 px-4">Date &amp; Time</th>
                      <th className="py-3 px-4">Customer Details</th>
                      <th className="py-3 px-4">Overall Experience</th>
                      <th className="py-3 px-4">Product Found</th>
                      <th className="py-3 px-4">Sentiment</th>
                      <th className="py-3 px-4">Voice of Customer</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-accent-soft/60">
                    {feedbacks.map((f: any) => {
                      const ans = f.answers || {};
                      const overallExp = ans['q1'] || 'Satisfied';
                      const productFound = ans['q2'] || 'Yes';

                      return (
                        <tr key={f.id} className="hover:bg-black/5 font-medium transition-colors">
                          <td className="py-3.5 px-4 text-[#5D4E42]">
                            <div className="font-bold text-primary font-mono text-[11px]">
                              {f.entryDate || 'Today'}
                            </div>
                            {f.entryTime && (
                              <div className="text-[10.5px] text-gray-500 font-semibold flex items-center gap-1 mt-0.5">
                                <Clock className="w-3 h-3 text-accent" />
                                <span>{f.entryTime}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-extrabold text-primary flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-accent" />
                              <span>{f.customerName || 'Anonymous'}</span>
                            </div>
                            {f.mobile && (
                              <div className="text-[11px] text-gray-500 font-mono flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3 text-gray-400" />
                                <span>{f.mobile}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-primary/10 text-primary">
                              {overallExp}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="text-xs font-bold text-gray-700">{productFound}</span>
                          </td>
                          <td className="py-3.5 px-4">
                            {f.status === 'resolved' || f.status === 'closed' ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 flex items-center gap-1 w-max shadow-xs">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Resolved &amp; Closed
                              </span>
                            ) : f.status === 'escalated_manager' ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-purple-100 text-purple-900 border border-purple-300 flex items-center gap-1 w-max shadow-xs">
                                <ShieldAlert className="w-3.5 h-3.5 text-purple-700" /> Escalated to Manager
                              </span>
                            ) : f.status === 'called' || f.status === 'in_progress' ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-blue-100 text-blue-800 flex items-center gap-1 w-max shadow-xs">
                                <Clock className="w-3.5 h-3.5" /> In Progress
                              </span>
                            ) : f.isNegative ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-100 text-rose-800 flex items-center gap-1 w-max shadow-xs">
                                <ThumbsDown className="w-3.5 h-3.5" /> Auto-Escalated (New)
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 flex items-center gap-1 w-max border border-emerald-200">
                                <ThumbsUp className="w-3.5 h-3.5 text-emerald-600" /> Satisfied
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 max-w-xs truncate text-[#5D4E42] font-medium text-[11px]">
                            {f.voice || 'No extra comments'}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => handleOpenModal(f)}
                              className="px-3 py-1.5 rounded-xl border border-primary text-primary font-extrabold text-[11px] hover:bg-primary hover:text-white transition-all flex items-center gap-1 ml-auto shadow-xs"
                            >
                              <Eye className="w-3.5 h-3.5" /> View Ticket
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Executive Customer Resolution Dashboard Modal */}
          {selectedFeedback && (
            <div className="fixed inset-0 bg-primary/70 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fade-in">
              <div className="card-glass max-w-5xl w-full p-6 sm:p-8 space-y-6 animate-scale-in max-h-[92vh] overflow-y-auto shadow-2xl rounded-3xl border border-black/40 bg-white/95 text-primary">

                {/* 1. Header Redesign */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-accent-soft pb-5">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      {selectedFeedback.isNegative ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-500/10 text-rose-700 border border-rose-300/50 text-[10px] font-black uppercase tracking-widest">
                          <AlertTriangle className="w-3 h-3 text-rose-600" /> Escalated Feedback
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-300/50 text-[10px] font-black uppercase tracking-widest">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Satisfied Customer Survey
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary text-accent text-[10px] font-black uppercase tracking-widest">
                        BSC EXCLUSIVE RETAIL
                      </span>
                    </div>

                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-primary">
                      {selectedFeedback.customerName || 'Valued Customer'}
                    </h2>

                    <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-primary pt-1">
                      <span className="flex items-center gap-1.5 font-mono">
                        <Phone className="w-3.5 h-3.5 text-accent" />
                        {selectedFeedback.mobile || 'No Mobile Provided'}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-accent" />
                        Collection Time: <strong>{selectedFeedback.entryDate || 'Today'} {selectedFeedback.entryTime ? `at ${selectedFeedback.entryTime}` : ''}</strong>
                      </span>
                      <span className="flex items-center gap-1.5 font-mono text-[11px]">
                        <Hash className="w-3.5 h-3.5 text-accent" />
                        ID: #{String(selectedFeedback.id).startsWith('FB-') ? selectedFeedback.id : `FB-${selectedFeedback.id}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-start md:self-auto">
                    {selectedFeedback.isNegative ? (
                      <span className="px-3.5 py-1.5 rounded-xl bg-rose-600 text-black font-extrabold text-xs shadow-sm flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4" /> High Priority Escalation
                      </span>
                    ) : (
                      <span className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white font-extrabold text-xs shadow-sm flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" /> Normal Priority
                      </span>
                    )}

                    <button
                      onClick={() => setSelectedFeedback(null)}
                      className="p-2 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-900 transition-all shadow-xs"
                      title="Close Modal"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* 2. Escalation Alert Card (ONLY shown for actual negative feedback) */}
                {selectedFeedback.isNegative && (
                  <div className="card-glass p-4 rounded-2xl border-l-4 border-l-rose-500 bg-rose-500/10 border border-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-rose-600 text-black shadow-sm shrink-0">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-black uppercase text-rose-900 tracking-wider">Escalated to Telecaller Call Queue</div>
                        <p className="text-xs font-semibold text-rose-800 mt-0.5">
                          Automatic escalation triggered due to negative ratings or dissatisfaction keywords. Follow-up action required by store executive.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <span className="px-3 py-1 rounded-full bg-rose-200 text-rose-900 font-extrabold text-xs">
                        Status: Pending Follow-up
                      </span>
                    </div>
                  </div>
                )}

                {/* 3. Customer Satisfaction Summary (Correct Question Mapping Grid) */}
                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-accent" />
                    <span>Customer Satisfaction Summary</span>
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="p-3.5 rounded-2xl bg-white border border-accent-soft shadow-xs text-center">
                      <div className="text-[10px] font-extrabold uppercase text-primary tracking-wider">Overall CSAT</div>
                      <div className={`text-sm font-black mt-1.5 ${selectedFeedback.isNegative ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {selectedFeedback.answers?.q1 || selectedFeedback.q1 || (selectedFeedback.isNegative ? 'Dissatisfied' : 'Very satisfied')}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white border border-accent-soft shadow-xs text-center">
                      <div className="text-[10px] font-extrabold uppercase text-primary tracking-wider">Product Found</div>
                      <div className="text-sm font-black text-primary mt-1.5">
                        {selectedFeedback.answers?.q2 || selectedFeedback.q2 || 'Yes, exactly'}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white border border-accent-soft shadow-xs text-center">
                      <div className="text-[10px] font-extrabold uppercase text-primary tracking-wider">Collection Quality</div>
                      <div className="text-sm font-black text-primary mt-1.5">
                        {selectedFeedback.answers?.q3 || selectedFeedback.q3 || 'Excellent'}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white border border-accent-soft shadow-xs text-center">
                      <div className="text-[10px] font-extrabold uppercase text-primary tracking-wider">Staff Courtesy</div>
                      <div className="text-sm font-black text-primary mt-1.5">
                        {selectedFeedback.answers?.q4 || selectedFeedback.q4 || 'Extremely helpful'}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white border border-accent-soft shadow-xs text-center col-span-2 sm:col-span-1">
                      <div className="text-[10px] font-extrabold uppercase text-primary tracking-wider">Recommendation</div>
                      <div className={`text-sm font-black mt-1.5 ${selectedFeedback.isNegative ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {selectedFeedback.answers?.q5 || selectedFeedback.q5 || 'Definitely recommend'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Mapped Questionnaire Responses Grid */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-accent" />
                    <span>Survey Questionnaire Responses</span>
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { key: 'q1', label: '1. Overall Shopping Experience (Q1)', val: selectedFeedback.answers?.q1 || selectedFeedback.q1 || 'Very satisfied' },
                      { key: 'q2', label: '2. Product Availability (Q2)', val: selectedFeedback.answers?.q2 || selectedFeedback.q2 || 'Yes, exactly' },
                      { key: 'q3', label: '3. Collection Quality & Variety (Q3)', val: selectedFeedback.answers?.q3 || selectedFeedback.q3 || 'Excellent' },
                      { key: 'q4', label: '4. Staff Courtesy & Helpfulness (Q4)', val: selectedFeedback.answers?.q4 || selectedFeedback.q4 || 'Extremely helpful' },
                      { key: 'q5', label: '5. Recommendation & NPS (Q5)', val: selectedFeedback.answers?.q5 || selectedFeedback.q5 || 'Definitely recommend' }
                    ].map((qItem, idx) => {
                      const valStr = String(qItem.val);
                      const isNegVal = ['dissatisfied', 'very dissatisfied', 'poor', 'very poor', 'no', 'partially', 'not recommend'].some(k => valStr.toLowerCase().includes(k));

                      return (
                        <div key={idx} className="p-3.5 rounded-2xl bg-white border border-accent-soft flex items-center justify-between gap-3 shadow-xs">
                          <span className="text-xs font-bold text-primary uppercase tracking-wider">
                            {qItem.label}
                          </span>
                          <span className={`px-3 py-1 rounded-xl text-xs font-extrabold shadow-2xs ${isNegVal
                              ? 'bg-rose-100 text-rose-800 border border-rose-300/40'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-300/40'
                            }`}>
                            {valStr}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 5. Voice of Customer Section (3 Accent Cards) */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-accent" />
                    <span>Voice of Customer Detailed Notes</span>
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-300/60 space-y-1.5">
                      <div className="text-[11px] font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                        <ThumbsUp className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Liked Most</span>
                      </div>
                      <p className="text-xs font-semibold text-emerald-950 whitespace-pre-line">
                        {selectedFeedback.voice?.includes('Liked Most:')
                          ? selectedFeedback.voice.split('Liked Most:')[1]?.split('\n')[0]
                          : 'Satisfied with overall experience.'}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-black/5 border border-black/20 space-y-1.5">
                      <div className="text-[11px] font-black text-black uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-black" />
                        <span>Can Improve</span>
                      </div>
                      <p className="text-xs font-semibold text-black whitespace-pre-line">
                        {selectedFeedback.voice?.includes('Can Improve:')
                          ? selectedFeedback.voice.split('Can Improve:')[1]?.split('\n')[0]
                          : 'No specific improvements noted.'}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-300/60 space-y-1.5">
                      <div className="text-[11px] font-black text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                        <span>Additional Comments</span>
                      </div>
                      <p className="text-xs font-semibold text-blue-950 whitespace-pre-line">
                        {selectedFeedback.voice || 'Customer submitted feedback directly through store QR Kiosk.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 6. Action Timeline */}
                <div className="space-y-3 pt-1 border-t border-accent-soft">
                  <h4 className="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-accent" />
                    <span>Customer Journey Escalation Timeline</span>
                  </h4>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="p-3 rounded-2xl bg-background border border-accent-soft text-center">
                      <div className="w-6 h-6 rounded-full bg-emerald-500 text-white font-bold text-xs flex items-center justify-center mx-auto mb-1">1</div>
                      <div className="text-[11px] font-extrabold text-primary">QR Submitted</div>
                      <div className="text-[9.5px] text-gray-500 font-mono mt-0.5">{selectedFeedback.entryDate || 'Today'}</div>
                    </div>

                    <div className="p-3 rounded-2xl bg-background border border-accent-soft text-center">
                      <div className="w-6 h-6 rounded-full bg-emerald-500 text-white font-bold text-xs flex items-center justify-center mx-auto mb-1">2</div>
                      <div className="text-[11px] font-extrabold text-primary">Feedback Recorded</div>
                      <div className="text-[9.5px] text-gray-500 mt-0.5">{selectedFeedback.isNegative ? 'Escalation Triggered' : 'Positive Rating'}</div>
                    </div>

                    <div className="p-3 rounded-2xl bg-background border border-accent-soft text-center">
                      <div className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center mx-auto mb-1 ${selectedFeedback.isNegative ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'
                        }`}>3</div>
                      <div className="text-[11px] font-extrabold text-primary">{selectedFeedback.isNegative ? 'Call Queue Added' : 'Survey Completed'}</div>
                      <div className="text-[9.5px] text-gray-500 mt-0.5">{selectedFeedback.isNegative ? 'Telecaller Pending' : 'CSAT Verified'}</div>
                    </div>

                    <div className="p-3 rounded-2xl bg-background border border-accent-soft text-center">
                      <div className="w-6 h-6 rounded-full bg-primary text-accent font-bold text-xs flex items-center justify-center mx-auto mb-1">4</div>
                      <div className="text-[11px] font-extrabold text-primary">Closed</div>
                      <div className="text-[9.5px] text-gray-500 mt-0.5">{selectedFeedback.isNegative ? 'Executive Workspace' : 'Status: Closed'}</div>
                    </div>
                  </div>
                </div>

                {/* 7. Resolution Workspace */}
                <div className="p-5 rounded-2xl bg-background border border-accent-soft space-y-4">
                  <div className="flex items-center justify-between border-b border-accent-soft pb-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-accent" />
                      <span>Resolution Workspace & Telecaller Logging</span>
                    </h4>
                    <span className="text-[10px] font-bold text-primary">BSC Operational CRM Desk</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10.5px] font-black uppercase text-primary tracking-wider mb-1">
                        Follow-Up Action Status
                      </label>
                      <select
                        value={resolutionStatus}
                        onChange={(e) => setResolutionStatus(e.target.value)}
                        className="select-modern text-xs font-bold py-2 bg-white"
                      >
                        <option value="called">Called - Follow Up Needed</option>
                        <option value="resolved">Resolved - Customer Satisfied</option>
                        <option value="escalated">Escalated to Store Manager</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10.5px] font-black uppercase text-primary tracking-wider mb-1">
                        Assigned Executive / Priority
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={selectedFeedback.isNegative ? 'Telecaller Team (High Priority)' : 'Floor Manager (Normal Priority)'}
                        className="input-modern text-xs font-semibold py-2 bg-gray-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-black uppercase text-primary tracking-wider mb-1">
                      Internal Telecaller Resolution Notes
                    </label>
                    <textarea
                      rows={3}
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      placeholder="Enter call details, customer explanation, voucher code issued, or resolution steps..."
                      className="textarea-modern text-xs font-medium bg-white"
                    ></textarea>
                  </div>
                </div>

                {/* 8. Action Buttons (Modal Footer) */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#DFDDD7]">
                  <button
                    onClick={() => setSelectedFeedback(null)}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white border border-[#DFDDD7] hover:bg-[#F6F4EF] text-[#182033] font-extrabold text-xs transition-all shadow-sm cursor-pointer"
                  >
                    Close Dashboard
                  </button>

                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => handleSaveModalResolution('called')}
                      disabled={savingResolution}
                      className="px-4 py-2.5 rounded-xl bg-white border border-[#DFDDD7] hover:bg-[#F6F4EF] text-[#182033] font-extrabold text-xs shadow-sm active:scale-95 transition-all cursor-pointer"
                    >
                      Mark In Progress
                    </button>

                    <button
                      onClick={() => handleSaveModalResolution('escalated_manager')}
                      disabled={savingResolution}
                      className="px-4 py-2.5 rounded-xl bg-white border border-[#DFDDD7] hover:bg-[#F6F4EF] text-[#182033] font-extrabold text-xs shadow-sm active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <ShieldAlert className="w-4 h-4 text-[#C7374A]" />
                      <span>Escalate to Store Manager</span>
                    </button>

                    <button
                      onClick={() => handleSaveModalResolution('resolved')}
                      disabled={savingResolution}
                      className="px-4 py-2.5 rounded-xl bg-white border border-[#DFDDD7] hover:bg-[#F6F4EF] text-[#182033] font-extrabold text-xs shadow-sm active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Mark Resolved</span>
                    </button>

                    <button
                      onClick={() => handleSaveModalResolution()}
                      disabled={savingResolution}
                      className="px-6 py-2.5 rounded-xl bg-[#101C36] hover:bg-[#07101F] text-white font-extrabold text-xs shadow-md active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>{savingResolution ? 'Saving...' : 'Save Resolution Notes'}</span>
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
