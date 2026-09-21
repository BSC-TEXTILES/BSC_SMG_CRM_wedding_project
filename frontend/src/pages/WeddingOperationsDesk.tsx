import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import {
  Search, FileText, Phone, Calendar,
  MapPin, Clock, Edit3, Heart, ShoppingBag, Eye,
  RefreshCw, X, Save, User
} from 'lucide-react';
import { getSidebarCollapsed, subscribeSidebarCollapsed } from '../utils/sidebarState';

// ── Status mapping: backend DB values ↔ frontend display values ──
const DB_TO_DISPLAY: Record<string, string> = {
  'New': 'New Registration',
  'Contacted': 'Contacted',
  'Interested': 'Contacted',
  'Follow-up Pending': 'Follow-up Scheduled',
  'Shopping Date Confirmed': 'Shopping Confirmed',
  'Visited Store': 'Visited',
  'Converted': 'Completed',
  'Not Interested': 'Not Interested',
  'Cancelled': 'Cancelled',
  'Closed': 'Completed',
  'No Response': 'Contact Pending',
};

const DISPLAY_TO_DB: Record<string, string> = {
  'New Registration': 'New',
  'Contact Pending': 'No Response',
  'Contacted': 'Contacted',
  'Follow-up Scheduled': 'Follow-up Pending',
  'Visit Planned': 'Follow-up Pending',
  'Visited': 'Visited Store',
  'Shopping In Progress': 'Interested',
  'Shopping Confirmed': 'Shopping Date Confirmed',
  'Completed': 'Converted',
  'Not Interested': 'Not Interested',
  'Cancelled': 'Cancelled',
};

const STATUS_TABS = [
  'All Customers', 'New Registration', 'Contact Pending', 'Contacted',
  'Follow-up Scheduled', 'Visit Planned', 'Visited',
  'Shopping In Progress', 'Shopping Confirmed', 'Completed', 'Not Interested'
];

interface WeddingCustomer {
  id: number;
  customer_code: string;
  customer_name: string;
  mobile_number: string;
  alternate_mobile?: string;
  email?: string;
  location_id?: number;
  location_name?: string;
  location_code?: string;
  wedding_date?: string;
  wedding_date_flexibility?: string;
  wedding_functions?: string;
  preferred_shopping_category?: string;
  preferred_shopping_date?: string;
  preferred_call_time?: string;
  preferred_contact_method?: string;
  customer_status: string;
  call_status?: string;
  follow_up_date?: string;
  assigned_telecaller?: string;
  assigned_telecaller_id?: number;
  created_at?: string;
  total_calls_count?: number;
  last_call_date?: string;
  last_call_outcome?: string;
  customer_notes?: string;
  bride_name?: string;
  groom_name?: string;
  budget_range?: string;
  lead_source?: string;
  priority?: string;
  overdue_days?: number;
}

// Map backend row to frontend display shape
function mapCustomer(row: WeddingCustomer) {
  const displayStatus = DB_TO_DISPLAY[row.customer_status] || row.customer_status || '';
  return {
    ...row,
    registrationId: row.customer_code,
    customerName: row.customer_name,
    mobile: row.mobile_number,
    locationName: row.location_name,
    locationCode: row.location_code,
    weddingDate: row.wedding_date,
    dateFlexibility: row.wedding_date_flexibility,
    functions: row.wedding_functions,
    shoppingCategory: row.preferred_shopping_category,
    preferredShoppingDate: row.preferred_shopping_date,
    preferredTime: row.preferred_call_time,
    contactMethod: row.preferred_contact_method,
    status: displayStatus,
    rawStatus: row.customer_status,
    callStatus: row.call_status,
    nextFollowUp: row.follow_up_date,
    assignedTelecallerName: row.assigned_telecaller,
    registrationDate: row.created_at,
    totalCalls: row.total_calls_count || 0,
    lastCallDate: row.last_call_date,
    lastCallOutcome: row.last_call_outcome,
    alternateMobile: row.alternate_mobile,
    brideName: row.bride_name,
    groomName: row.groom_name,
    budgetRange: row.budget_range,
    leadSource: row.lead_source,
    priority: row.priority,
    overdueDays: row.overdue_days || 0,
  };
}

export default function WeddingOperationsDesk() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(getSidebarCollapsed());

  useEffect(() => {
    return subscribeSidebarCollapsed(setCollapsed);
  }, []);

  const [customers, setCustomers] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState(() => searchParams.get('filter') || 'All Customers');
  const [searchQuery, setSearchQuery] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<any>({});

  // Date Range Filter
  const [activeRange, setActiveRange] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'last_month' | 'custom'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // View/Edit Modals
  const [detailCustomer, setDetailCustomer] = useState<any | null>(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [newStatus, setNewStatus] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [customersRes, statsRes] = await Promise.all([
        API.getWeddingCustomers({ limit: 5000 }),
        API.getWeddingEnhancedDashboard()
      ]);

      // Map snake_case backend rows to camelCase frontend fields
      const rawCustomers = customersRes?.customers || customersRes?.data?.customers || [];
      setCustomers(rawCustomers.map(mapCustomer));

      // Extract stats: API layer spreads res.data, so stats may be at statsRes.stats or statsRes.data.stats
      const rawStats = statsRes?.stats || statsRes?.data?.stats || {};
      const rawLocationCards = statsRes?.locationCards || statsRes?.data?.locationCards || [];
      
      // Compute pending follow-ups (customers with follow_up_date >= today and not in terminal states)
      const today = new Date().toISOString().slice(0, 10);
      const allCustomers = rawCustomers;
      const pendingFollowups = allCustomers.filter((c: any) =>
        c.follow_up_date && c.follow_up_date >= today &&
        !['Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed'].includes(c.customer_status)
      ).length;

      setStats({
        totalCustomers: rawStats.totalCustomers || 0,
        newRegistrations: rawStats.todayRegistrations || 0,
        pendingFollowups,
        overdueFollowups: rawStats.overdueFollowUps || 0,
        upcomingWeddings: rawStats.upcomingWeddings30 || 0,
        shoppingConfirmed: rawStats.shoppingConfirmed || 0,
        visitsScheduled: (rawStats.todayVisits || 0) + (rawStats.todayAppointments || 0),
        todayFollowups: rawStats.todayFollowUps || 0,
        locationCards: rawLocationCards,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load wedding operations data');
      showToast('Could not load wedding operations data: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    setSession(Auth.get());
    loadData();
  }, [navigate, loadData]);

  useEffect(() => {
    let list = [...customers];

    // Date Range Filter — filter by created_at (registration date) or follow_up_date
    if (activeRange && activeRange !== 'all') {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const yesterdayDate = new Date(now);
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      const startOfWeekStr = startOfWeek.toISOString().slice(0, 10);

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfMonthStr = startOfMonth.toISOString().slice(0, 10);

      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      const startOfLastMonthStr = startOfLastMonth.toISOString().slice(0, 10);
      const endOfLastMonthStr = endOfLastMonth.toISOString().slice(0, 10);

      list = list.filter(c => {
        const dateStr = c.registrationDate || c.created_at || c.follow_up_date || '';
        if (!dateStr) return false;
        const d = dateStr.slice(0, 10);

        switch (activeRange) {
          case 'today': return d === todayStr;
          case 'yesterday': return d === yesterdayStr;
          case 'week': return d >= startOfWeekStr && d <= todayStr;
          case 'month': return d >= startOfMonthStr && d <= todayStr;
          case 'last_month': return d >= startOfLastMonthStr && d <= endOfLastMonthStr;
          case 'custom': {
            if (!fromDate || !toDate) return true;
            return d >= fromDate && d <= toDate;
          }
          default: return true;
        }
      });
    }

    // Status Filter — match against display status
    if (activeFilter !== 'All Customers') {
      list = list.filter(c => c.status === activeFilter);
    }

    // Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c =>
        (c.customerName && c.customerName.toLowerCase().includes(q)) ||
        (c.mobile && c.mobile.toLowerCase().includes(q)) ||
        (c.registrationId && c.registrationId.toLowerCase().includes(q)) ||
        (c.locationName && c.locationName.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.assignedTelecallerName && c.assignedTelecallerName.toLowerCase().includes(q)) ||
        (c.alternateMobile && c.alternateMobile.toLowerCase().includes(q))
      );
    }
    setFiltered(list);
  }, [customers, activeFilter, searchQuery, activeRange, fromDate, toDate]);

  const handleUpdateStatus = async () => {
    if (!selectedCustomer || saving) return;
    setSaving(true);
    try {
      const dbStatus = DISPLAY_TO_DB[newStatus] || newStatus;
      await API.changeWeddingCustomerStatus(selectedCustomer.id, dbStatus);
      showToast(`Status updated to ${newStatus}`, 'success');
      setStatusModalOpen(false);
      loadData();
    } catch (e: any) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const renderStatus = (status?: string) => {
    if (!status) return <span className="text-slate-400">-</span>;
    const s = status.toLowerCase();
    let cls = 'bg-slate-100 text-slate-700';
    if (s.includes('new')) cls = 'bg-blue-50 text-blue-700 border-blue-200';
    if (s.includes('contact pending')) cls = 'bg-orange-50 text-orange-700 border-orange-200';
    if (s.includes('contacted')) cls = 'bg-indigo-50 text-indigo-700 border-indigo-200';
    if (s.includes('follow-up') || s.includes('scheduled')) cls = 'bg-violet-50 text-violet-700 border-violet-200';
    if (s.includes('visit planned')) cls = 'bg-cyan-50 text-cyan-700 border-cyan-200';
    if (s === 'visited') cls = 'bg-amber-50 text-amber-700 border-amber-200';
    if (s.includes('shopping in progress')) cls = 'bg-yellow-50 text-yellow-700 border-yellow-200';
    if (s.includes('shopping confirmed')) cls = 'bg-teal-50 text-teal-700 border-teal-200';
    if (s.includes('completed')) cls = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (s.includes('not interested')) cls = 'bg-rose-50 text-rose-700 border-rose-200';
    if (s.includes('cancel')) cls = 'bg-red-50 text-red-700 border-red-200';

    return <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold border ${cls}`}>{status}</span>;
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className={`flex-1 flex flex-col min-w-0 overflow-hidden transition-all duration-300 ${collapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        <Topbar title="Wedding Operations Desk" session={session} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <ToastContainer />

          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Wedding Operations Desk</h1>
                <p className="text-sm text-slate-500 mt-1">Real-time wedding customer registrations, follow-up status, visit planning, and operational activity.</p>
              </div>
              <button onClick={loadData} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 text-sm font-medium text-slate-700 transition-colors">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-accent' : ''}`} />
                Refresh
              </button>
            </div>

            {/* Date Filters */}
            <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-2 items-center">
              <Calendar className="w-4 h-4 text-slate-400 ml-2" />
              {(['all', 'today', 'yesterday', 'week', 'month', 'last_month', 'custom'] as const).map(range => (
                <button
                  key={range}
                  onClick={() => setActiveRange(range)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${activeRange === range ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  {range === 'all' ? 'All Time' :
                    range === 'today' ? 'Today' :
                      range === 'yesterday' ? 'Yesterday' :
                        range === 'week' ? 'This Week' :
                          range === 'month' ? 'This Month' :
                            range === 'last_month' ? 'Last Month' : 'Custom date'}
                </button>
              ))}
              {activeRange === 'custom' && (
                <div className="flex items-center gap-2 ml-auto">
                  <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="text-xs px-2 py-1.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-accent/50" />
                  <span className="text-slate-400 text-xs">to</span>
                  <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="text-xs px-2 py-1.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-accent/50" />
                </div>
              )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-2 -translate-y-2 group-hover:scale-110 transition-transform"><Heart className="w-16 h-16" /></div>
                <div className="text-sm font-semibold text-slate-500 mb-1 relative z-10">Total Wedding Customers</div>
                <div className="text-3xl font-extrabold text-slate-900 relative z-10">{stats.totalCustomers || 0}</div>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-5 rounded-2xl border border-blue-400 shadow-sm relative overflow-hidden text-white group">
                <div className="absolute top-0 right-0 p-4 opacity-20 transform translate-x-2 -translate-y-2 group-hover:scale-110 transition-transform"><FileText className="w-16 h-16" /></div>
                <div className="text-sm font-semibold text-blue-100 mb-1 relative z-10">New Registrations</div>
                <div className="text-3xl font-extrabold relative z-10">{stats.newRegistrations || 0}</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-2 -translate-y-2 group-hover:scale-110 transition-transform text-amber-500"><Phone className="w-16 h-16" /></div>
                <div className="text-sm font-semibold text-slate-500 mb-1 relative z-10">Pending Follow-ups</div>
                <div className="text-3xl font-extrabold text-slate-900 relative z-10">{stats.pendingFollowups || 0}</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-2 -translate-y-2 group-hover:scale-110 transition-transform text-rose-500"><Clock className="w-16 h-16" /></div>
                <div className="text-sm font-semibold text-slate-500 mb-1 relative z-10">Overdue Follow-ups</div>
                <div className="text-3xl font-extrabold text-slate-900 relative z-10">{stats.overdueFollowups || 0}</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-2 -translate-y-2 group-hover:scale-110 transition-transform"><Calendar className="w-16 h-16" /></div>
                <div className="text-sm font-semibold text-slate-500 mb-1 relative z-10">Upcoming Weddings</div>
                <div className="text-3xl font-extrabold text-slate-900 relative z-10">{stats.upcomingWeddings || 0}</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-2 -translate-y-2 group-hover:scale-110 transition-transform text-emerald-500"><ShoppingBag className="w-16 h-16" /></div>
                <div className="text-sm font-semibold text-slate-500 mb-1 relative z-10">Shopping Confirmed</div>
                <div className="text-3xl font-extrabold text-slate-900 relative z-10">{stats.shoppingConfirmed || 0}</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-2 -translate-y-2 group-hover:scale-110 transition-transform text-teal-500"><MapPin className="w-16 h-16" /></div>
                <div className="text-sm font-semibold text-slate-500 mb-1 relative z-10">Visits Scheduled</div>
                <div className="text-3xl font-extrabold text-slate-900 relative z-10">{stats.visitsScheduled || 0}</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-2 -translate-y-2 group-hover:scale-110 transition-transform text-indigo-500"><Phone className="w-16 h-16" /></div>
                <div className="text-sm font-semibold text-slate-500 mb-1 relative z-10">Today's Follow-ups</div>
                <div className="text-3xl font-extrabold text-slate-900 relative z-10">{stats.todayFollowups || 0}</div>
              </div>
            </div>

            {/* Pipeline Tabs */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="flex overflow-x-auto hide-scrollbar border-b border-slate-200 p-2">
                {STATUS_TABS.map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveFilter(tab)}
                    className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeFilter === tab
                        ? 'bg-accent/10 text-accent shadow-sm'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
                <div className="relative max-w-sm w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by ID, name, mobile, email, telecaller, location..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-shadow"
                  />
                </div>
                <div className="text-sm font-medium text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                  {filtered.length} Record{filtered.length !== 1 ? 's' : ''} Found
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-y border-slate-200">
                      <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">SL.NO</th>
                      <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                      <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Contact & Location</th>
                      <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Wedding & Shopping</th>
                      <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Telecaller & Follow-up</th>
                      <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500">
                          <div className="flex flex-col items-center justify-center space-y-3">
                            <div className="w-8 h-8 border-4 border-slate-200 border-t-accent rounded-full animate-spin"></div>
                            <p className="text-sm font-medium">Loading customers...</p>
                          </div>
                        </td>
                      </tr>
                    ) : error ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500">
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <Phone className="w-10 h-10 text-rose-300" />
                            <p className="text-sm font-medium text-rose-600">{error}</p>
                            <button onClick={loadData} className="text-accent hover:underline text-xs mt-2 font-semibold">
                              Retry
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500">
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <Search className="w-10 h-10 text-slate-300" />
                            <p className="text-sm font-medium">No wedding customers match your selected filters.</p>
                            <button onClick={() => { setActiveFilter('All Customers'); setSearchQuery(''); setActiveRange('all'); }} className="text-accent hover:underline text-xs mt-2 font-semibold">
                              Clear Filters
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filtered.map((c, idx) => (
                        <tr key={c.id} className="hover:bg-slate-50/80 transition-colors group">
                          <td className="py-3 px-4 text-sm font-medium text-slate-500">{idx + 1}</td>
                          <td className="py-3 px-4">
                            <div className="text-sm font-bold text-slate-900 group-hover:text-accent transition-colors cursor-pointer" onClick={() => setDetailCustomer(c)}>
                              {c.customerName}
                            </div>
                            <div className="text-xs text-slate-500 font-mono mt-0.5">{c.registrationId || `CUST-${c.id}`}</div>
                            {c.priority && c.priority !== 'Medium' && (
                              <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${c.priority === 'High' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}>
                                {c.priority}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm font-medium text-slate-700">{c.mobile}</div>
                            {c.alternateMobile && <div className="text-xs text-slate-400">Alt: {c.alternateMobile}</div>}
                            <div className="text-xs text-slate-500 mt-0.5">{c.locationName || 'N/A'} {c.locationCode ? `(${c.locationCode})` : ''}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm font-medium text-slate-700">{c.weddingDate ? new Date(c.weddingDate).toLocaleDateString('en-IN') : 'TBD'}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{c.shoppingCategory || 'Not specified'}</div>
                            {(c.brideName || c.groomName) && (
                              <div className="text-xs text-slate-400 mt-0.5">
                                {c.brideName && `Bride: ${c.brideName}`}
                                {c.brideName && c.groomName && ' · '}
                                {c.groomName && `Groom: ${c.groomName}`}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm font-medium text-slate-700">{c.assignedTelecallerName || 'Unassigned'}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{c.nextFollowUp ? new Date(c.nextFollowUp).toLocaleDateString('en-IN') : 'No follow-up'}</div>
                            {c.overdueDays > 0 && (
                              <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-700">
                                {c.overdueDays}d overdue
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-1.5 items-start">
                              {renderStatus(c.status)}
                              {c.callStatus && (
                                <span className="text-[10px] text-slate-400 font-medium">Call: {c.callStatus}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                            <button
                              onClick={() => navigate(`/wedding-crm/customers/${c.id}`)}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-[#101C36] hover:text-[#C9A45C] transition-colors"
                              title="View Customer Profile"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => { setSelectedCustomer(c); setNewStatus(c.status || 'Contacted'); setStatusModalOpen(true); }}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-[#101C36] hover:text-[#C9A45C] transition-colors"
                              title="Update Status"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Customer Details Modal */}
      {detailCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Heart className="w-5 h-5 text-accent" />
                Customer Details: {detailCustomer.customerName}
              </h2>
              <button onClick={() => setDetailCustomer(null)} className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Details */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-500" /> Basic Details
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-slate-500">Customer ID</span><span className="font-semibold text-slate-800 font-mono">{detailCustomer.registrationId || detailCustomer.id}</span></div>
                    <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-slate-500">Name</span><span className="font-medium text-slate-800">{detailCustomer.customerName}</span></div>
                    <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-slate-500">Mobile</span><span className="font-medium text-slate-800">{detailCustomer.mobile}</span></div>
                    {detailCustomer.alternateMobile && <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-slate-500">Alt Mobile</span><span className="font-medium text-slate-800">{detailCustomer.alternateMobile}</span></div>}
                    <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-slate-500">Email</span><span className="font-medium text-slate-800">{detailCustomer.email || 'N/A'}</span></div>
                    <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-slate-500">Location</span><span className="font-medium text-slate-800">{detailCustomer.locationName || 'N/A'} {detailCustomer.locationCode ? `(${detailCustomer.locationCode})` : ''}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Registered</span><span className="font-medium text-slate-800">{detailCustomer.registrationDate ? new Date(detailCustomer.registrationDate).toLocaleDateString('en-IN') : 'N/A'}</span></div>
                  </div>
                </div>

                {/* Wedding & Shopping Details */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
                    <Heart className="w-4 h-4 text-slate-500" /> Wedding & Shopping
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-slate-500">Wedding Date</span><span className="font-medium text-slate-800">{detailCustomer.weddingDate ? new Date(detailCustomer.weddingDate).toLocaleDateString('en-IN') : 'TBD'}</span></div>
                    <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-slate-500">Date Flexibility</span><span className="font-medium text-slate-800">{detailCustomer.dateFlexibility || 'N/A'}</span></div>
                    <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-slate-500">Shopping Category</span><span className="font-medium text-slate-800">{detailCustomer.shoppingCategory || 'N/A'}</span></div>
                    <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-slate-500">Bride</span><span className="font-medium text-slate-800">{detailCustomer.brideName || 'N/A'}</span></div>
                    <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-slate-500">Groom</span><span className="font-medium text-slate-800">{detailCustomer.groomName || 'N/A'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Budget</span><span className="font-medium text-slate-800">{detailCustomer.budgetRange || 'N/A'}</span></div>
                  </div>
                </div>

                {/* Follow-up & Operations */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-500" /> Follow-up & Operations
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-slate-500">Assigned Telecaller</span><span className="font-medium text-slate-800">{detailCustomer.assignedTelecallerName || 'N/A'}</span></div>
                    <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-slate-500">Next Follow-up</span><span className="font-medium text-slate-800">{detailCustomer.nextFollowUp ? new Date(detailCustomer.nextFollowUp).toLocaleDateString('en-IN') : 'N/A'}</span></div>
                    <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-slate-500">Preferred Time</span><span className="font-medium text-slate-800">{detailCustomer.preferredTime || 'N/A'}</span></div>
                    <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-slate-500">Total Calls</span><span className="font-medium text-slate-800">{detailCustomer.totalCalls || 0}</span></div>
                    <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-slate-500">Last Call</span><span className="font-medium text-slate-800">{detailCustomer.lastCallDate ? new Date(detailCustomer.lastCallDate).toLocaleDateString('en-IN') : 'N/A'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Customer Status</span><span>{renderStatus(detailCustomer.status)}</span></div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col items-center justify-center text-center">
                  <p className="text-sm text-slate-500 mb-4">View comprehensive history, remarks, and complete activity timeline.</p>
                  <button
                    onClick={() => navigate(`/wedding-crm/customers/${detailCustomer.id}`)}
                    className="px-5 py-2.5 bg-[#101C36] hover:bg-[#07101F] text-[#C9A45C] font-black rounded-xl text-xs shadow-sm transition-all flex items-center gap-2 border border-[#C9A45C]/30"
                  >
                    <FileText className="w-4 h-4" /> View Full Profile
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Update Status Modal */}
      {statusModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Update Status</h2>
              <button onClick={() => setStatusModalOpen(false)} className="p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Select Pipeline Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full text-sm border-slate-300 rounded-lg focus:ring-accent focus:border-accent py-2.5 px-3 shadow-sm border"
                >
                  <option value="New Registration">New Registration</option>
                  <option value="Contact Pending">Contact Pending</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Follow-up Scheduled">Follow-up Scheduled</option>
                  <option value="Visit Planned">Visit Planned</option>
                  <option value="Visited">Visited</option>
                  <option value="Shopping In Progress">Shopping In Progress</option>
                  <option value="Shopping Confirmed">Shopping Confirmed</option>
                  <option value="Completed">Completed</option>
                  <option value="Not Interested">Not Interested</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setStatusModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleUpdateStatus} disabled={saving} className="px-4 py-2 text-sm font-bold text-white bg-accent rounded-lg shadow-sm hover:bg-accent/90 transition-all disabled:opacity-50 flex items-center gap-2">
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                Save Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
