import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import ToastContainer, { showToast } from '../../components/Toast';
import { toastManager } from '../../utils/toastManager';
import { useTelecallerQueue } from '../../hooks/useTelecallerQueue';
import { API, Auth, UserSession } from '../../services/api';
import { getSidebarCollapsed, subscribeSidebarCollapsed } from '../../utils/sidebarState';
import WeddingNav from './WeddingNav';
import {
  WeddingCustomer,
  CUSTOMER_STATUSES,
  CALL_OUTCOMES,
  CALL_TIME_OPTIONS,
  getStatusBadge
} from './weddingTypes';
import LocationFilterSelect from '../../components/ui/LocationFilterSelect';
import {
  PhoneCall,
  PhoneForwarded,
  Clock,
  Calendar,
  TriangleAlert,
  Users,
  CircleCheck,
  Sparkles,
  MapPin,
  Search,
  MessageCircle,
  Eye,
  RefreshCw,
  X,
  Target,
  ChevronRight,
  User,
  Check,
  Award
} from 'lucide-react';

export default function TelecallerDeskPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [session, setSession] = useState<UserSession | null>(() => Auth.get());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(getSidebarCollapsed());

  useEffect(() => {
    return subscribeSidebarCollapsed(setCollapsed);
  }, []);

  const [activeQueue, setActiveQueue] = useState<'dueToday' | 'overdue' | 'callbacks' | 'upcoming' | 'priority' | 'newLeads' | 'myQueue'>(
    (searchParams.get('queue') as any) || 'dueToday'
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState<number | ''>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('bsc_selected_location') : null;
    return saved && saved !== 'ALL' ? Number(saved) : '';
  });
  const [locations, setLocations] = useState<any[]>([]);

  // Listen to global location changes (e.g. from Topbar)
  useEffect(() => {
    const handleLocChange = (e: any) => {
      const locId = e?.detail?.locationId;
      const parsed = locId && locId !== 'ALL' ? Number(locId) : '';
      setLocationFilter(parsed);
    };
    window.addEventListener('bsc_location_changed', handleLocChange);
    return () => window.removeEventListener('bsc_location_changed', handleLocChange);
  }, []);

  const { loading, deskSummary, queueRecords, refreshQueue } = useTelecallerQueue(locationFilter);

  // Call Logging Modal
  const [activeCustomer, setActiveCustomer] = useState<WeddingCustomer | null>(null);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callForm, setCallForm] = useState({
    call_status: 'Completed',
    call_outcome: 'Connected',
    remarks: '',
    customer_response: '',
    next_follow_up_date: '',
    next_follow_up_time: 'Morning (10 AM - 1 PM)',
    expected_shopping_date: '',
    new_customer_status: ''
  });
  const [savingCall, setSavingCall] = useState(false);

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    const sess = Auth.get();
    setSession(sess);
    if (sess?.locationId && !sess.isGlobalAdmin) {
      setLocationFilter(sess.locationId);
    }
    API.getLocations().then(res => {
      if (res?.locations) setLocations(res.locations);
    }).catch(() => {});
  }, [navigate]);

  // Open Log Call Modal for a customer
  const handleOpenCallModal = (cust: WeddingCustomer) => {
    setActiveCustomer(cust);
    setCallForm({
      call_status: 'Completed',
      call_outcome: 'Connected',
      remarks: '',
      customer_response: '',
      next_follow_up_date: cust.follow_up_date || new Date().toISOString().slice(0, 10),
      next_follow_up_time: cust.preferred_call_time || 'Morning (10 AM - 1 PM)',
      expected_shopping_date: cust.expected_shopping_date || '',
      new_customer_status: cust.customer_status
    });
    setCallModalOpen(true);
  };

  // Submit Call Outcome
  const handleSaveCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCustomer) return;
    setSavingCall(true);
    try {
      await API.logWeddingCall({
        customer_id: activeCustomer.id,
        call_date: new Date().toISOString().slice(0, 10),
        call_time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        call_status: callForm.call_status,
        call_outcome: callForm.call_outcome,
        remarks: callForm.remarks,
        customer_response: callForm.customer_response,
        next_follow_up_date: callForm.next_follow_up_date || undefined,
        next_follow_up_time: callForm.next_follow_up_time || undefined,
        expected_shopping_date_updated: callForm.expected_shopping_date || undefined
      });

      if (callForm.new_customer_status && callForm.new_customer_status !== activeCustomer.customer_status) {
        await API.changeWeddingCustomerStatus(activeCustomer.id, callForm.new_customer_status, `Telecaller call outcome: ${callForm.call_outcome}`);
      }

      toastManager.success(`Call logged for ${activeCustomer.customer_name}`);
      setCallModalOpen(false);
      setActiveCustomer(null);
      refreshQueue();
    } catch (err: any) {
      toastManager.error('call-log', 'Error saving call: ' + err.message);
    } finally {
      setSavingCall(false);
    }
  };

  // Quick Action: Mark Visited / Won directly
  const handleQuickStatus = async (cust: WeddingCustomer, targetStatus: string) => {
    try {
      await API.changeWeddingCustomerStatus(cust.id, targetStatus, `Telecaller desk quick action`);
      toastManager.success(`Updated ${cust.customer_name} status to ${targetStatus}`);
      refreshQueue();
    } catch (err: any) {
      toastManager.error('status-update', 'Error updating status: ' + err.message);
    }
  };

  const isGlobalOrAdmin = Boolean(
    session?.isGlobalAdmin ||
    ['Admin', 'Super Admin', 'System Administrator'].includes(session?.role || '') ||
    !session?.locationId
  );

  // Filter current active queue records
  const currentList = (queueRecords[activeQueue] || []).filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.customer_name.toLowerCase().includes(q) ||
      c.mobile_number.includes(q) ||
      (c.customer_code && c.customer_code.toLowerCase().includes(q)) ||
      (c.assigned_telecaller && c.assigned_telecaller.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-[#F6F4EF] flex text-[#182033]">
      <Sidebar
        session={session}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          collapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        <Topbar
          title="Telecaller Desk & Queues"
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto space-y-6">
          <ToastContainer />

          <WeddingNav
            currentPageTitle="Telecaller Desk & Queues"
            actions={
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <LocationFilterSelect
                  value={locationFilter}
                  onChange={(val) => setLocationFilter(val)}
                />
                <button
                  onClick={refreshQueue}
                  disabled={loading}
                  className="px-3.5 py-2 bg-white hover:bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl text-xs font-bold text-[#182033] flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#C9A45C]' : ''}`} />
                  <span>Refresh Queue</span>
                </button>
              </div>
            }
          />

          {/* Section 11: Daily Target & Calls Status Strip */}
          <div className="bg-[#101C36] text-white p-5 rounded-3xl border border-[#C9A45C]/30 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#C9A45C]/20 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#C9A45C] text-[#101C36] flex items-center justify-center font-black shadow-md">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black tracking-tight text-white">
                    Telecaller Daily Calling Target & Performance
                  </h2>
                  <div className="text-[11px] text-[#E4CB92] font-semibold">
                    {isGlobalOrAdmin ? 'Admin Supervised Calling Desk · All Telecaller Queues' : `${session?.fullName || 'Telecaller Desk'} · Live Telephony Queue`}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <div className="bg-[#07101F] px-3.5 py-2 rounded-xl border border-[#C9A45C]/30">
                  <span className="text-muted text-[10px] uppercase font-bold block">Daily Target</span>
                  <span className="text-sm font-black text-white">{deskSummary.dailyTarget} calls</span>
                </div>
                <div className="bg-[#07101F] px-3.5 py-2 rounded-xl border border-[#C9A45C]/30">
                  <span className="text-muted text-[10px] uppercase font-bold block">Remaining</span>
                  <span className="text-sm font-black text-[#C9A45C]">{deskSummary.remainingCalls} to go</span>
                </div>
              </div>
            </div>

            {/* Daily Metrics Pill Row */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center text-xs">
              <div className="bg-[#07101F]/80 p-3 rounded-2xl border border-[#C9A45C]/20">
                <div className="text-[10px] uppercase font-bold text-gray-400">Total Assigned</div>
                <div className="text-xl font-black text-white mt-1">{deskSummary.assignedCalls}</div>
              </div>
              <div className="bg-[#07101F]/80 p-3 rounded-2xl border border-[#C9A45C]/20">
                <div className="text-[10px] uppercase font-bold text-emerald-400">Calls Done Today</div>
                <div className="text-xl font-black text-emerald-400 mt-1">{deskSummary.completedToday}</div>
              </div>
              <div className="bg-[#07101F]/80 p-3 rounded-2xl border border-[#C9A45C]/20">
                <div className="text-[10px] uppercase font-bold text-blue-400">Connected Calls</div>
                <div className="text-xl font-black text-blue-400 mt-1">{deskSummary.connectedCalls}</div>
              </div>
              <div className="bg-[#07101F]/80 p-3 rounded-2xl border border-[#C9A45C]/20">
                <div className="text-[10px] uppercase font-bold text-purple-400">Callbacks Requested</div>
                <div className="text-xl font-black text-purple-400 mt-1">{deskSummary.callbackCount}</div>
              </div>
              <div className="bg-[#07101F]/80 p-3 rounded-2xl border border-[#C9A45C]/20">
                <div className="text-[10px] uppercase font-bold text-amber-400">Pending in Queue</div>
                <div className="text-xl font-black text-amber-400 mt-1">{deskSummary.pendingCalls}</div>
              </div>
            </div>
          </div>

          {/* Section 12: Work Queue Tabs & Filters */}
          <div className="bg-white rounded-3xl border border-[#DFDDD7] shadow-xs p-5 space-y-4">
            {/* Queue Selection Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DFDDD7] pb-3">
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1">
                {[
                  { key: 'dueToday', label: "Today's Calls", count: queueRecords.dueToday.length, color: 'text-amber-700 bg-amber-50' },
                  { key: 'overdue', label: 'Overdue Calls', count: queueRecords.overdue.length, color: 'text-[#C7374A] bg-red-50' },
                  { key: 'callbacks', label: 'Callbacks', count: queueRecords.callbacks.length, color: 'text-purple-700 bg-purple-50' },
                  { key: 'upcoming', label: 'Upcoming', count: queueRecords.upcoming.length, color: 'text-blue-700 bg-blue-50' },
                  { key: 'priority', label: 'VIP / Priority', count: queueRecords.priority.length, color: 'text-indigo-700 bg-indigo-50' },
                  { key: 'newLeads', label: 'New Leads', count: queueRecords.newLeads.length, color: 'text-emerald-700 bg-emerald-50' },
                  { key: 'myQueue', label: 'My Queue', count: queueRecords.myQueue.length, color: 'text-[#101C36] bg-slate-100' }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveQueue(tab.key as any)}
                    className={`px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all ${
                      activeQueue === tab.key
                        ? 'bg-[#101C36] text-[#C9A45C] shadow-md border border-[#C9A45C]/30'
                        : 'bg-[#F6F4EF] text-[#687080] hover:text-primary'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${tab.color}`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Queue Search Box */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter by customer / phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl text-xs text-[#182033] focus:outline-none focus:border-[#C9A45C]"
                />
              </div>
            </div>

            {/* Queue Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#182033]">
                <thead className="bg-[#07101F] text-white uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4 font-black">Reg ID</th>
                    <th className="py-3 px-4 font-black">Customer</th>
                    <th className="py-3 px-4 font-black">Mobile</th>
                    <th className="py-3 px-4 font-black">Telecaller</th>
                    <th className="py-3 px-4 font-black">Location</th>
                    <th className="py-3 px-4 font-black">Wedding Date</th>
                    <th className="py-3 px-4 font-black">Expected Shopping</th>
                    <th className="py-3 px-4 font-black">Status</th>
                    <th className="py-3 px-4 font-black">Next Follow-up</th>
                    <th className="py-3 px-4 font-black text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DFDDD7]">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="text-center py-12 text-muted">
                        <RefreshCw className="w-5 h-5 animate-spin text-[#C9A45C] mx-auto mb-2" />
                        <span>Loading telecaller queue...</span>
                      </td>
                    </tr>
                  ) : currentList.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-12 text-muted">
                        <CircleCheck className="w-10 h-10 text-[#16805B] mx-auto mb-2" />
                        <div className="font-bold text-sm text-[#182033]">Queue is currently clear!</div>
                        <div className="text-xs text-muted mt-0.5">All calls in this queue have been handled.</div>
                      </td>
                    </tr>
                  ) : (
                    currentList.map((cust) => {
                      const badge = getStatusBadge(cust.customer_status);
                      const isOverdue =
                        cust.follow_up_date &&
                        new Date(cust.follow_up_date).getTime() < new Date().setHours(0, 0, 0, 0);

                      return (
                        <tr key={cust.id} className="hover:bg-[#F6F4EF]/70 transition-colors">
                          <td className="py-3 px-4 font-black text-primary">
                            <Link
                              to={`/wedding-crm/customers/${cust.id}`}
                              className="hover:text-[#C98218] hover:underline"
                            >
                              {cust.customer_code}
                            </Link>
                          </td>
                          <td className="py-3 px-4">
                            <Link
                              to={`/wedding-crm/customers/${cust.id}`}
                              className="font-bold text-[#182033] hover:text-[#C98218] block"
                            >
                              {cust.customer_name}
                            </Link>
                            <span className="text-[10px] text-muted block mt-0.5">
                              {cust.preferred_shopping_category || 'General Wedding'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-[#182033]">
                            {cust.mobile_number}
                          </td>
                          <td className="py-3 px-4 font-semibold text-gray-700">
                            {cust.assigned_telecaller ? (
                              <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[11px] font-bold">
                                👤 {cust.assigned_telecaller}
                              </span>
                            ) : (
                              <span className="text-muted italic text-[11px]">Unassigned</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-medium text-muted">
                            📍 {cust.location_name || 'Store'}
                          </td>
                          <td className="py-3 px-4">
                            {cust.wedding_date ? (
                              <span className="text-pink-700 font-bold">
                                💍 {new Date(cust.wedding_date).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-muted">TBD</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-bold text-blue-900">
                            {cust.expected_shopping_date ? (
                              new Date(cust.expected_shopping_date).toLocaleDateString()
                            ) : (
                              <span className="text-muted font-normal">TBD</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${badge.bg}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                              {cust.customer_status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {cust.follow_up_date ? (
                              <span className={`font-bold ${isOverdue ? 'text-[#C7374A]' : 'text-[#182033]'}`}>
                                {new Date(cust.follow_up_date).toLocaleDateString()}
                                {isOverdue && <span className="ml-1 text-[9px] bg-red-100 text-red-700 px-1 rounded uppercase font-black">Overdue</span>}
                              </span>
                            ) : (
                              <span className="text-muted">None</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Log Call Button */}
                              <button
                                onClick={() => handleOpenCallModal(cust)}
                                className="px-3 py-1.5 bg-[#101C36] hover:bg-[#07101F] text-[#C9A45C] font-black rounded-xl text-xs flex items-center gap-1 shadow-xs border border-[#C9A45C]/30"
                                title="Call & Log Outcome"
                              >
                                <PhoneCall className="w-3.5 h-3.5" />
                                <span>Call</span>
                              </button>

                              {/* WhatsApp Button */}
                              <a
                                href={`https://wa.me/91${cust.mobile_number.replace(/\D/g, '')}?text=Namaste%20${encodeURIComponent(cust.customer_name)}%2C%20greetings%20from%20BSC%20Exclusive!`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs"
                                title="Chat on WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </a>

                              {/* Mark Shopping Confirmed Quick Action */}
                              <button
                                onClick={() => handleQuickStatus(cust, 'Shopping Confirmed')}
                                className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs border border-blue-200"
                                title="Mark Shopping Confirmed"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>

                              {/* Mark Won Quick Action */}
                              <button
                                onClick={() => handleQuickStatus(cust, 'Won')}
                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#16805B] rounded-xl text-xs border border-emerald-200"
                                title="Mark Won"
                              >
                                <Award className="w-3.5 h-3.5" />
                              </button>

                              {/* View Details */}
                              <Link
                                to={`/wedding-crm/customers/${cust.id}`}
                                className="p-1.5 bg-[#F6F4EF] hover:bg-[#DFDDD7] text-primary rounded-xl text-xs"
                                title="Open Full Profile"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Call Logging Form Modal (Section 14 Specification) */}
          {callModalOpen && activeCustomer && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-[#DFDDD7] space-y-4 animate-scale-in">
                <div className="flex items-center justify-between pb-3 border-b border-[#DFDDD7]">
                  <div>
                    <h3 className="text-base font-black text-[#182033]">
                      Log Call: {activeCustomer.customer_name}
                    </h3>
                    <div className="text-xs text-muted">
                      {activeCustomer.customer_code} · 📱 {activeCustomer.mobile_number} · 📍 {activeCustomer.location_name || 'Store'}
                    </div>
                  </div>
                  <button onClick={() => setCallModalOpen(false)} className="p-1 text-muted hover:bg-[#F6F4EF] rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveCall} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Call Outcome */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-muted mb-1">
                        Call Outcome *
                      </label>
                      <select
                        value={callForm.call_outcome}
                        onChange={(e) => {
                          const outcome = e.target.value;
                          let nextStatus = activeCustomer.customer_status;
                          if (outcome === 'Connected') nextStatus = 'Contacted';
                          if (outcome === 'Callback Requested') nextStatus = 'Callback';
                          if (outcome === 'Shopping Confirmed') nextStatus = 'Shopping Confirmed';
                          if (outcome === 'Visited') nextStatus = 'Visited';
                          if (outcome === 'Won') nextStatus = 'Won';
                          if (outcome === 'Not Interested') nextStatus = 'Not Interested';

                          setCallForm({
                            ...callForm,
                            call_outcome: outcome,
                            new_customer_status: nextStatus
                          });
                        }}
                        className="w-full px-3 py-2 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-bold"
                      >
                        {CALL_OUTCOMES.map((out) => (
                          <option key={out} value={out}>
                            {out}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Customer Status Update (Section 13 Workflow) */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-muted mb-1">
                        Update Customer Status
                      </label>
                      <select
                        value={callForm.new_customer_status}
                        onChange={(e) => setCallForm({ ...callForm, new_customer_status: e.target.value })}
                        className="w-full px-3 py-2 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-bold text-primary"
                      >
                        {CUSTOMER_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Next Follow-up Date */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-muted mb-1">
                        Next Follow-up Date
                      </label>
                      <input
                        type="date"
                        value={callForm.next_follow_up_date}
                        onChange={(e) => setCallForm({ ...callForm, next_follow_up_date: e.target.value })}
                        className="w-full px-3 py-2 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-bold"
                      />
                    </div>

                    {/* Preferred Call Time */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-muted mb-1">
                        Preferred Call Window
                      </label>
                      <select
                        value={callForm.next_follow_up_time}
                        onChange={(e) => setCallForm({ ...callForm, next_follow_up_time: e.target.value })}
                        className="w-full px-3 py-2 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-medium"
                      >
                        {CALL_TIME_OPTIONS.map((time) => (
                          <option key={time} value={time}>
                            {time}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Expected Shopping Date (Updated) */}
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold uppercase text-muted mb-1">
                        Expected Shopping Date (Updated from call)
                      </label>
                      <input
                        type="date"
                        value={callForm.expected_shopping_date}
                        onChange={(e) => setCallForm({ ...callForm, expected_shopping_date: e.target.value })}
                        className="w-full px-3 py-2 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-bold"
                      />
                    </div>
                  </div>

                  {/* Customer Remarks */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-muted mb-1">
                      Call Notes & Customer Response *
                    </label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Enter customer response, family shopping schedule, saree/fabric preferences, budget discussed..."
                      value={callForm.remarks}
                      onChange={(e) => setCallForm({ ...callForm, remarks: e.target.value })}
                      className="w-full px-3 py-2 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-medium"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#DFDDD7]">
                    <div className="text-[10px] text-muted">
                      Will create a call audit record under your profile.
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCallModalOpen(false)}
                        className="px-4 py-2 rounded-xl bg-[#F6F4EF] hover:bg-[#DFDDD7] font-bold text-[#182033]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingCall}
                        className="px-6 py-2 rounded-xl bg-[#101C36] hover:bg-[#07101F] text-[#C9A45C] font-black shadow-md border border-[#C9A45C]/30"
                      >
                        {savingCall ? 'Saving...' : 'Save & Log Outcome'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
