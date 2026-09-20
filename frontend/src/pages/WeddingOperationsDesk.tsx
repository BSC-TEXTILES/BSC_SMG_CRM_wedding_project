import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import {
  Search, FileText, Phone, Calendar, 
  MapPin, Clock, Edit3, Heart, ShoppingBag, Eye,
  ChevronRight, RefreshCw, X, Save, User
} from 'lucide-react';
import { isDateInRange } from '../utils/dateUtils';
import { getSidebarCollapsed, subscribeSidebarCollapsed } from '../utils/sidebarState';

interface WeddingCustomer {
  id: number;
  registrationId?: string;
  customerName: string;
  mobile: string;
  email?: string;
  locationId?: number;
  locationName?: string;
  weddingDate?: string;
  dateFlexibility?: string;
  functions?: string;
  shoppingCategory?: string;
  preferredShoppingDate?: string;
  preferredTime?: string;
  contactMethod?: string;
  status: string;
  callStatus?: string;
  visitStatus?: string;
  shoppingStatus?: string;
  nextFollowUp?: string;
  assignedTelecallerName?: string;
  registrationDate?: string;
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

  const [customers, setCustomers] = useState<WeddingCustomer[]>([]);
  const [filtered, setFiltered] = useState<WeddingCustomer[]>([]);
  const [activeFilter, setActiveFilter] = useState(() => searchParams.get('filter') || 'All Customers');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<any>({});

  // Date Range Filter
  const [activeRange, setActiveRange] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'last_month' | 'custom'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // View/Edit Modals
  const [detailCustomer, setDetailCustomer] = useState<WeddingCustomer | null>(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<WeddingCustomer | null>(null);
  const [newStatus, setNewStatus] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch both customers and stats concurrently
      const [customersRes, statsRes] = await Promise.all([
        API.getWeddingCustomers({ limit: 5000 }),
        API.getWeddingEnhancedDashboard()
      ]);
      
      if (customersRes?.customers) {
        setCustomers(customersRes.customers);
      }
      if (statsRes?.data) {
        setStats(statsRes.data);
      }
    } catch (err: any) {
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

    if (activeRange && activeRange !== 'all') {
      list = list.filter(c => {
        // Use registrationDate as primary filter date if available, fallback to created_at logic
        const d = c.registrationDate || c.weddingDate || new Date().toISOString();
        return isDateInRange(new Date(d), activeRange, fromDate, toDate);
      });
    }

    if (activeFilter !== 'All Customers') {
      list = list.filter(c => c.status === activeFilter);
    }
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => 
        (c.customerName && c.customerName.toLowerCase().includes(q)) || 
        (c.mobile && c.mobile.toLowerCase().includes(q)) || 
        (c.registrationId && c.registrationId.toLowerCase().includes(q)) ||
        (c.locationName && c.locationName.toLowerCase().includes(q))
      );
    }
    setFiltered(list);
  }, [customers, activeFilter, searchQuery, activeRange, fromDate, toDate]);

  const handleUpdateStatus = async () => {
    if (!selectedCustomer || saving) return;
    setSaving(true);
    try {
      await API.updateWeddingCustomer(selectedCustomer.id, { status: newStatus });
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
    if (s.includes('new') || s.includes('pending')) cls = 'bg-blue-50 text-blue-700 border-blue-200';
    if (s.includes('contacted') || s.includes('scheduled')) cls = 'bg-indigo-50 text-indigo-700 border-indigo-200';
    if (s.includes('visit') || s.includes('progress')) cls = 'bg-amber-50 text-amber-700 border-amber-200';
    if (s.includes('confirm') || s.includes('completed')) cls = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (s.includes('not interested') || s.includes('cancel')) cls = 'bg-rose-50 text-rose-700 border-rose-200';
    
    return <span className={`inline-flex px-2 py-1 rounded-full text-[11px] font-bold border ${cls}`}>{status}</span>;
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className={`flex-1 flex flex-col min-w-0 overflow-hidden transition-all duration-300 ${collapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        <Topbar title="Wedding Operations Desk" session={session} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <ToastContainer />
          
          {/* Header */}
          <div className="max-w-7xl mx-auto space-y-6">
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeRange === range ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {range === 'all' ? 'All Time' :
                   range === 'today' ? 'Today' :
                   range === 'yesterday' ? 'Yesterday' :
                   range === 'week' ? 'This Week' :
                   range === 'month' ? 'This Month' :
                   range === 'last_month' ? 'Last Month' : 'Custom Range'}
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
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
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
                {['All Customers', 'New Registration', 'Contact Pending', 'Contacted', 'Follow-up Scheduled', 'Visit Planned', 'Visited', 'Shopping In Progress', 'Shopping Confirmed', 'Completed', 'Not Interested'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveFilter(tab)}
                    className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      activeFilter === tab 
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
                    placeholder="Search by ID, name, mobile, location..." 
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
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm font-medium text-slate-700">{c.mobile}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{c.locationName || 'N/A'}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm font-medium text-slate-700">{c.weddingDate ? new Date(c.weddingDate).toLocaleDateString() : 'TBD'}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{c.shoppingCategory || 'Not specified'}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm font-medium text-slate-700">{c.assignedTelecallerName || 'Unassigned'}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{c.nextFollowUp ? new Date(c.nextFollowUp).toLocaleDateString() : 'No follow-up'}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-1.5 items-start">
                              {renderStatus(c.status)}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                            <button 
                              onClick={() => setDetailCustomer(c)}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-accent hover:text-white transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => { setSelectedCustomer(c); setNewStatus(c.status || 'Contacted'); setStatusModalOpen(true); }}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-accent hover:text-white transition-colors"
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
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
                    <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-slate-500">ID</span><span className="font-semibold text-slate-800 font-mono">{detailCustomer.registrationId || detailCustomer.id}</span></div>
                    <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-slate-500">Mobile</span><span className="font-medium text-slate-800">{detailCustomer.mobile}</span></div>
                    <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-slate-500">Email</span><span className="font-medium text-slate-800">{detailCustomer.email || 'N/A'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Location</span><span className="font-medium text-slate-800">{detailCustomer.locationName || 'N/A'}</span></div>
                  </div>
                </div>

                {/* Wedding & Shopping Details */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
                    <Heart className="w-4 h-4 text-slate-500" /> Wedding & Shopping
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-slate-500">Wedding Date</span><span className="font-medium text-slate-800">{detailCustomer.weddingDate ? new Date(detailCustomer.weddingDate).toLocaleDateString() : 'N/A'}</span></div>
                    <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-slate-500">Date Flexibility</span><span className="font-medium text-slate-800">{detailCustomer.dateFlexibility || 'N/A'}</span></div>
                    <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-slate-500">Shopping Category</span><span className="font-medium text-slate-800">{detailCustomer.shoppingCategory || 'N/A'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Functions</span><span className="font-medium text-slate-800">{detailCustomer.functions || 'N/A'}</span></div>
                  </div>
                </div>

                {/* Follow-up & Operations */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-500" /> Follow-up & Operations
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-slate-500">Assigned Telecaller</span><span className="font-medium text-slate-800">{detailCustomer.assignedTelecallerName || 'N/A'}</span></div>
                    <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-slate-500">Next Follow-up</span><span className="font-medium text-slate-800">{detailCustomer.nextFollowUp ? new Date(detailCustomer.nextFollowUp).toLocaleDateString() : 'N/A'}</span></div>
                    <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-slate-500">Preferred Visit Date</span><span className="font-medium text-slate-800">{detailCustomer.preferredShoppingDate ? new Date(detailCustomer.preferredShoppingDate).toLocaleDateString() : 'N/A'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Customer Status</span><span>{renderStatus(detailCustomer.status)}</span></div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col items-center justify-center text-center">
                   <p className="text-sm text-slate-500 mb-4">View comprehensive history, remarks, and complete activity timeline.</p>
                   <button className="px-5 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-xl text-sm font-bold shadow-sm transition-all flex items-center gap-2">
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
