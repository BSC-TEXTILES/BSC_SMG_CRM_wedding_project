import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import PageContainer from '../../components/ui/PageContainer';
import ToastContainer from '../../components/Toast';
import { toastManager } from '../../utils/toastManager';
import { useTelecallerQueue } from '../../hooks/useTelecallerQueue';
import { API, Auth, UserSession } from '../../services/api';
import { parseDate, formatDateDisplay, toISODateInput } from '../../utils/dateUtils';
import WeddingNav from './WeddingNav';
import {
  WeddingCustomer,
  CUSTOMER_STATUSES,
  CALL_OUTCOMES,
  CALL_TIME_OPTIONS,
  getStatusBadge
} from './weddingTypes';
import LocationFilterSelect from '../../components/ui/LocationFilterSelect';
import { PhoneCall, CircleCheck, Search, MessageCircle, Eye, RefreshCw, X, Target, Check, Award } from 'lucide-react';

export default function TelecallerDeskPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [session, setSession] = useState<UserSession | null>(() => Auth.get());

  const [activeQueue, setActiveQueue] = useState<'dueToday' | 'overdue' | 'callbacks' | 'upcoming' | 'priority' | 'newLeads' | 'myQueue'>(
    (searchParams.get('queue') as any) || 'dueToday'
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState<number | ''>(() => {
    const sess = Auth.get();
    const isAdminRole = ['Admin', 'Super Admin', 'system administrator'].includes(sess?.role || '');
    const isGlobal = isAdminRole && (!sess?.locationId || sess?.isGlobalAdmin === true);
    if (!isGlobal && sess?.locationId) {
      return sess.locationId;
    }
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('bsc_selected_location') : null;
    return saved && saved !== 'ALL' ? Number(saved) : '';
  });
  const [locations, setLocations] = useState<any[]>([]);

  // Listen to global location changes (e.g. from Topbar)
  useEffect(() => {
    const handleLocChange = (e: any) => {
      const sess = Auth.get();
      const isAdminRole = ['Admin', 'Super Admin', 'system administrator'].includes(sess?.role || '');
      const isGlobal = isAdminRole && (!sess?.locationId || sess?.isGlobalAdmin === true);
      if (!isGlobal && sess?.locationId) {
        setLocationFilter(sess.locationId);
        return;
      }
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
    const isAdminRole = ['Admin', 'Super Admin', 'system administrator'].includes(sess?.role || '');
    const isGlobal = isAdminRole && (!sess?.locationId || sess?.isGlobalAdmin === true);
    if (!isGlobal && sess?.locationId) {
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
      // <input type="date"> only accepts YYYY-MM-DD, so normalise the stored
      // value — a zero date or DD/MM/YYYY would otherwise prefill an empty
      // picker that the telecaller then submits back.
      next_follow_up_date: toISODateInput(cust.follow_up_date) || new Date().toISOString().slice(0, 10),
      next_follow_up_time: cust.preferred_call_time || 'Morning (10 AM - 1 PM)',
      expected_shopping_date: toISODateInput(cust.expected_shopping_date),
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

      toastManager.success('Call activity saved successfully.');
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
      toastManager.success(`Customer status updated successfully to "${targetStatus}".`);
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
    <DashboardLayout
      title="Telecaller Desk & Queues"
      breadcrumbs={[{ label: 'Wedding CRM', href: '/wedding-crm/dashboard' }, { label: 'Telecaller Desk' }]}
    >
      <PageContainer maxWidth="full">
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
                  className="px-3.5 py-2 bg-[#FFFDFC] hover:bg-[#FFF7F2] border border-[#E8D9D4] rounded-xl text-xs font-semibold text-[#4A173A] flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#B76E79]' : 'text-[#B76E79]'}`} />
                  <span>Refresh Queue</span>
                </button>
              </div>
            }
          />

          {/* Daily Target & Calls Status Strip */}
          <div className="bg-[#4A173A] text-white p-5 rounded-3xl border border-[#B76E79]/30 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#B76E79]/20 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#B76E79] text-white flex items-center justify-center font-bold shadow-md">
                  <Target className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight text-white">
                    Telecaller Daily Calling Target & Performance
                  </h2>
                  <div className="text-[11px] text-[#E8C7A8] font-medium">
                    {isGlobalOrAdmin ? 'Admin Supervised Calling Desk · All Telecaller Queues' : `${session?.fullName || 'Telecaller Desk'} · Live Telephony Queue`}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <div className="bg-[#351027]/80 px-3.5 py-2 rounded-xl border border-[#B76E79]/30">
                  <span className="text-[#E8C7A8] text-[10px] uppercase font-bold block">Daily Target</span>
                  <span className="text-sm font-bold text-white">{deskSummary.dailyTarget} calls</span>
                </div>
                <div className="bg-[#351027]/80 px-3.5 py-2 rounded-xl border border-[#B76E79]/30">
                  <span className="text-[#E8C7A8] text-[10px] uppercase font-bold block">Remaining</span>
                  <span className="text-sm font-bold text-[#D89AA3]">{deskSummary.remainingCalls} to go</span>
                </div>
              </div>
            </div>

            {/* Daily Metrics Pill Row */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center text-xs">
              <div className="bg-[#351027]/80 p-3 rounded-2xl border border-[#B76E79]/20">
                <div className="text-[10px] uppercase font-semibold text-[#E8C7A8]">Total Assigned</div>
                <div className="text-xl font-bold text-white mt-1">{deskSummary.assignedCalls}</div>
              </div>
              <div className="bg-[#351027]/80 p-3 rounded-2xl border border-[#B76E79]/20">
                <div className="text-[10px] uppercase font-semibold text-[#198754]">Calls Done Today</div>
                <div className="text-xl font-bold text-[#E8F5EE] mt-1">{deskSummary.completedToday}</div>
              </div>
              <div className="bg-[#351027]/80 p-3 rounded-2xl border border-[#B76E79]/20">
                <div className="text-[10px] uppercase font-semibold text-[#D89AA3]">Connected Calls</div>
                <div className="text-xl font-bold text-white mt-1">{deskSummary.connectedCalls}</div>
              </div>
              <div className="bg-[#351027]/80 p-3 rounded-2xl border border-[#B76E79]/20">
                <div className="text-[10px] uppercase font-semibold text-[#E8C7A8]">Callbacks Requested</div>
                <div className="text-xl font-bold text-[#E8C7A8] mt-1">{deskSummary.callbackCount}</div>
              </div>
              <div className="bg-[#351027]/80 p-3 rounded-2xl border border-[#B76E79]/20">
                <div className="text-[10px] uppercase font-semibold text-[#FFF4D6]">Pending in Queue</div>
                <div className="text-xl font-bold text-[#FFF4D6] mt-1">{deskSummary.pendingCalls}</div>
              </div>
            </div>
          </div>

          {/* Work Queue Tabs & Filters */}
          <div className="bg-[#FFFDFC] rounded-3xl border border-[#E8D9D4] shadow-xs p-5 space-y-4">
            {/* Queue Selection Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8D9D4] pb-3">
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1">
                {[
                  { key: 'dueToday', label: "Today's Calls", count: queueRecords.dueToday.length, color: 'text-[#C58A18] bg-[#FFF4D6]' },
                  { key: 'overdue', label: 'Overdue Calls', count: queueRecords.overdue.length, color: 'text-[#B42318] bg-[#FDE8E7]' },
                  { key: 'callbacks', label: 'Callbacks', count: queueRecords.callbacks.length, color: 'text-[#6A2853] bg-[#EDE7F6]' },
                  { key: 'upcoming', label: 'Upcoming', count: queueRecords.upcoming.length, color: 'text-[#4A173A] bg-[#FFFAF7]' },
                  { key: 'priority', label: 'VIP / Priority', count: queueRecords.priority.length, color: 'text-[#4A173A] bg-[#F6E2E5]' },
                  { key: 'newLeads', label: 'New Leads', count: queueRecords.newLeads.length, color: 'text-[#6A2853] bg-[#EDE7F6]' },
                  { key: 'myQueue', label: 'My Queue', count: queueRecords.myQueue.length, color: 'text-[#C58A18] bg-[#FFF4D6]' }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveQueue(tab.key as any)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                      activeQueue === tab.key
                        ? 'bg-[#B76E79] text-white shadow-xs'
                        : 'bg-[#FFF7F2] text-[#6F5963] hover:text-[#4A173A] hover:bg-[#F6E2E5]'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${tab.color}`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Queue Search Box */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-[#9A858D] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter by customer / phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl text-xs text-[#2B1722] placeholder-[#9A858D] focus:outline-none focus:border-[#B76E79]"
                />
              </div>
            </div>

            {/* Mobile Queue Card View (< md) */}
            <div className="md:hidden space-y-3">
              {loading ? (
                <div className="text-center py-10 bg-[#FFFDFC] rounded-2xl border border-[#E8D9D4]">
                  <RefreshCw className="w-5 h-5 animate-spin text-[#B76E79] mx-auto mb-2" />
                  <span className="text-xs text-[#6F5963]">Loading telecaller queue...</span>
                </div>
              ) : currentList.length === 0 ? (
                <div className="text-center py-10 bg-[#FFFDFC] rounded-2xl border border-[#E8D9D4] p-4">
                  <CircleCheck className="w-10 h-10 text-[#198754] mx-auto mb-2" />
                  <div className="font-bold text-sm text-[#4A173A]">Queue is currently clear!</div>
                  <div className="text-xs text-[#6F5963] mt-0.5">All calls in this queue have been handled.</div>
                </div>
              ) : (
                currentList.map((cust) => {
                  const badge = getStatusBadge(cust.customer_status);
                  const followUp = parseDate(cust.follow_up_date);
                  const isOverdue =
                    !!followUp && followUp.getTime() < new Date().setHours(0, 0, 0, 0);

                  return (
                    <div
                      key={cust.id}
                      className="p-4 bg-[#FFFDFC] rounded-2xl border border-[#E8D9D4] shadow-xs space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Link
                              to={`/wedding-crm/customers/${cust.id}`}
                              className="font-bold text-sm text-[#2B1722] hover:text-[#4A173A]"
                            >
                              {cust.customer_name}
                            </Link>
                            <span className="text-[10px] font-mono text-white bg-[#4A173A] px-1.5 py-0.5 rounded">
                              {cust.customer_code}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#6F5963] mt-0.5">
                            {cust.preferred_shopping_category || 'General Wedding'} · 📍 {cust.location_name || 'Store'}
                          </div>
                        </div>

                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                          {cust.customer_status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-[#FFFAF7] p-2.5 rounded-xl border border-[#E8D9D4]">
                        <div>
                          <span className="text-[10px] text-[#6F5963] uppercase font-semibold block">Wedding Date</span>
                          <span className="font-semibold text-[#B76E79]">
                            {parseDate(cust.wedding_date) ? `💍 ${formatDateDisplay(cust.wedding_date, 'TBD')}` : 'TBD'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#6F5963] uppercase font-semibold block">Follow-up</span>
                          <span className={`font-semibold ${isOverdue ? 'text-[#B42318]' : 'text-[#2B1722]'}`}>
                            {formatDateDisplay(cust.follow_up_date, 'None')}
                            {isOverdue && <span className="ml-1 text-[9px] bg-[#FDE8E7] text-[#B42318] px-1 rounded font-bold">OVERDUE</span>}
                          </span>
                        </div>
                        <div className="col-span-2 flex items-center justify-between text-[11px] pt-1 border-t border-[#E8D9D4]">
                          <span className="text-[#6F5963]">Assigned: {cust.assigned_telecaller ? `👤 ${cust.assigned_telecaller}` : 'Unassigned'}</span>
                          <span className="text-[#4A173A] font-semibold">{parseDate(cust.expected_shopping_date) ? `Shop: ${formatDateDisplay(cust.expected_shopping_date, 'TBD')}` : ''}</span>
                        </div>
                      </div>

                      {/* Mobile action buttons */}
                      <div className="flex items-center gap-2 pt-1 flex-wrap sm:flex-nowrap">
                        <button
                          onClick={() => handleOpenCallModal(cust)}
                          className="flex-1 min-w-[110px] py-2 bg-[#4A173A] hover:bg-[#6A2853] text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs border border-[#B76E79]/30"
                        >
                          <PhoneCall className="w-3.5 h-3.5 text-[#E8C7A8]" />
                          <span>Call & Log</span>
                        </button>
                        <a
                          href={`https://wa.me/91${cust.mobile_number.replace(/\D/g, '')}?text=Namaste%20${encodeURIComponent(cust.customer_name)}%2C%20greetings%20from%20BSC%20Exclusive!`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-[#198754] hover:bg-[#16805B] text-white rounded-xl text-xs flex items-center justify-center"
                          title="WhatsApp"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => handleQuickStatus(cust, 'Shopping Confirmed')}
                          className="p-2 bg-[#F6E2E5] hover:bg-[#D89AA3]/30 text-[#4A173A] rounded-xl text-xs border border-[#E8D9D4]"
                          title="Confirm Shopping"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleQuickStatus(cust, 'Won')}
                          className="p-2 bg-[#E8F5EE] hover:bg-[#198754]/20 text-[#198754] rounded-xl text-xs border border-[#E8D9D4]"
                          title="Won"
                        >
                          <Award className="w-4 h-4" />
                        </button>
                        <Link
                          to={`/wedding-crm/customers/${cust.id}`}
                          className="p-2 bg-[#FFFAF7] hover:bg-[#FFF7F2] text-[#4A173A] rounded-xl text-xs border border-[#E8D9D4] flex items-center justify-center"
                          title="Profile"
                        >
                          <Eye className="w-4 h-4 text-[#B76E79]" />
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Queue Table (hidden on < md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-[#2B1722]">
                <thead className="bg-[#F8EDE8] text-[#4A173A] border-b border-[#E8D9D4] uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4 font-bold">Reg ID</th>
                    <th className="py-3 px-4 font-bold">Customer</th>
                    <th className="py-3 px-4 font-bold">Mobile</th>
                    <th className="py-3 px-4 font-bold">Telecaller</th>
                    <th className="py-3 px-4 font-bold">Location</th>
                    <th className="py-3 px-4 font-bold">Wedding Date</th>
                    <th className="py-3 px-4 font-bold">Expected Shopping</th>
                    <th className="py-3 px-4 font-bold">Status</th>
                    <th className="py-3 px-4 font-bold">Next Follow-up</th>
                    <th className="py-3 px-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8D9D4]">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="text-center py-12 text-[#6F5963]">
                        <RefreshCw className="w-5 h-5 animate-spin text-[#B76E79] mx-auto mb-2" />
                        <span>Loading telecaller queue...</span>
                      </td>
                    </tr>
                  ) : currentList.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-12 text-[#6F5963]">
                        <CircleCheck className="w-10 h-10 text-[#198754] mx-auto mb-2" />
                        <div className="font-bold text-sm text-[#4A173A]">Queue is currently clear!</div>
                        <div className="text-xs text-[#6F5963] mt-0.5">All calls in this queue have been handled.</div>
                      </td>
                    </tr>
                  ) : (
                    currentList.map((cust) => {
                      const badge = getStatusBadge(cust.customer_status);
                      const followUp = parseDate(cust.follow_up_date);
                      const isOverdue =
                        !!followUp && followUp.getTime() < new Date().setHours(0, 0, 0, 0);

                      return (
                        <tr key={cust.id} className="hover:bg-[#FFF1F2] transition-colors">
                          <td className="py-3 px-4 font-bold text-[#4A173A]">
                            <Link
                              to={`/wedding-crm/customers/${cust.id}`}
                              className="hover:text-[#B76E79] hover:underline"
                            >
                              {cust.customer_code}
                            </Link>
                          </td>
                          <td className="py-3 px-4">
                            <Link
                              to={`/wedding-crm/customers/${cust.id}`}
                              className="font-semibold text-[#2B1722] hover:text-[#4A173A] block"
                            >
                              {cust.customer_name}
                            </Link>
                            <span className="text-[10px] text-[#6F5963] block mt-0.5">
                              {cust.preferred_shopping_category || 'General Wedding'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-[#2B1722]">
                            {cust.mobile_number}
                          </td>
                          <td className="py-3 px-4 font-medium text-[#6F5963]">
                            {cust.assigned_telecaller ? (
                              <span className="bg-[#FFFAF7] border border-[#E8D9D4] text-[#4A173A] px-2 py-0.5 rounded-full text-[11px] font-semibold">
                                👤 {cust.assigned_telecaller}
                              </span>
                            ) : (
                              <span className="text-[#9A858D] italic text-[11px]">Unassigned</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-medium text-[#6F5963]">
                            📍 {cust.location_name || 'Store'}
                          </td>
                          <td className="py-3 px-4">
                            {parseDate(cust.wedding_date) ? (
                              <span className="text-[#B76E79] font-medium">
                                💍 {formatDateDisplay(cust.wedding_date, 'TBD')}
                              </span>
                            ) : (
                              <span className="text-[#9A858D]">TBD</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-semibold text-[#4A173A]">
                            {parseDate(cust.expected_shopping_date) ? (
                              formatDateDisplay(cust.expected_shopping_date, 'TBD')
                            ) : (
                              <span className="text-[#9A858D] font-normal">TBD</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                              {cust.customer_status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {parseDate(cust.follow_up_date) ? (
                              <span className={`font-semibold ${isOverdue ? 'text-[#B42318]' : 'text-[#2B1722]'}`}>
                                {formatDateDisplay(cust.follow_up_date, 'None')}
                                {isOverdue && <span className="ml-1 text-[9px] bg-[#FDE8E7] text-[#B42318] px-1 rounded uppercase font-bold">Overdue</span>}
                              </span>
                            ) : (
                              <span className="text-[#9A858D]">None</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Log Call Button */}
                              <button
                                onClick={() => handleOpenCallModal(cust)}
                                className="px-3 py-1.5 bg-[#4A173A] hover:bg-[#6A2853] text-white font-semibold rounded-xl text-xs flex items-center gap-1 shadow-xs border border-[#B76E79]/30"
                                title="Call & Log Outcome"
                              >
                                <PhoneCall className="w-3.5 h-3.5 text-[#E8C7A8]" />
                                <span>Call</span>
                              </button>

                              {/* WhatsApp Button */}
                              <a
                                href={`https://wa.me/91${cust.mobile_number.replace(/\D/g, '')}?text=Namaste%20${encodeURIComponent(cust.customer_name)}%2C%20greetings%20from%20BSC%20Exclusive!`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 bg-[#198754] hover:bg-[#16805B] text-white rounded-xl text-xs"
                                title="Chat on WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </a>

                              {/* Mark Shopping Confirmed Quick Action */}
                              <button
                                onClick={() => handleQuickStatus(cust, 'Shopping Confirmed')}
                                className="p-1.5 bg-[#F6E2E5] hover:bg-[#D89AA3]/30 text-[#4A173A] rounded-xl text-xs border border-[#E8D9D4]"
                                title="Mark Shopping Confirmed"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>

                              {/* Mark Won Quick Action */}
                              <button
                                onClick={() => handleQuickStatus(cust, 'Won')}
                                className="p-1.5 bg-[#E8F5EE] hover:bg-[#198754]/20 text-[#198754] rounded-xl text-xs border border-[#E8D9D4]"
                                title="Mark Won"
                              >
                                <Award className="w-3.5 h-3.5" />
                              </button>

                              {/* View Details */}
                              <Link
                                to={`/wedding-crm/customers/${cust.id}`}
                                className="p-1.5 bg-[#FFFAF7] hover:bg-[#FFF7F2] text-[#4A173A] rounded-xl text-xs border border-[#E8D9D4]"
                                title="Open Full Profile"
                              >
                                <Eye className="w-3.5 h-3.5 text-[#B76E79]" />
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

          {/* Call Logging Form Modal */}
          {callModalOpen && activeCustomer && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <div className="bg-[#FFFDFC] rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-[#E8D9D4] space-y-4 animate-scale-in max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between pb-3 border-b border-[#E8D9D4]">
                  <div>
                    <h3 className="text-base font-bold text-[#4A173A]">
                      Log Call: {activeCustomer.customer_name}
                    </h3>
                    <div className="text-xs text-[#6F5963]">
                      {activeCustomer.customer_code} · 📱 {activeCustomer.mobile_number} · 📍 {activeCustomer.location_name || 'Store'}
                    </div>
                  </div>
                  <button onClick={() => setCallModalOpen(false)} className="p-1 text-[#6F5963] hover:text-[#4A173A] hover:bg-[#FFF7F2] rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveCall} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Call Outcome */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[#6F5963] mb-1">
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
                        className="w-full px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                      >
                        {CALL_OUTCOMES.map((out) => (
                          <option key={out} value={out}>
                            {out}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Customer Status Update */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[#6F5963] mb-1">
                        Update Customer Status
                      </label>
                      <select
                        value={callForm.new_customer_status}
                        onChange={(e) => setCallForm({ ...callForm, new_customer_status: e.target.value })}
                        className="w-full px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-[#4A173A] focus:outline-none focus:border-[#B76E79]"
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
                      <label className="block text-[10px] font-bold uppercase text-[#6F5963] mb-1">
                        Next Follow-up Date
                      </label>
                      <input
                        type="date"
                        value={callForm.next_follow_up_date}
                        onChange={(e) => setCallForm({ ...callForm, next_follow_up_date: e.target.value })}
                        className="w-full px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                      />
                    </div>

                    {/* Preferred Call Time */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[#6F5963] mb-1">
                        Preferred Call Window
                      </label>
                      <select
                        value={callForm.next_follow_up_time}
                        onChange={(e) => setCallForm({ ...callForm, next_follow_up_time: e.target.value })}
                        className="w-full px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-medium text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
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
                      <label className="block text-[10px] font-bold uppercase text-[#6F5963] mb-1">
                        Expected Shopping Date (Updated from call)
                      </label>
                      <input
                        type="date"
                        value={callForm.expected_shopping_date}
                        onChange={(e) => setCallForm({ ...callForm, expected_shopping_date: e.target.value })}
                        className="w-full px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                      />
                    </div>
                  </div>

                  {/* Customer Remarks */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#6F5963] mb-1">
                      Call Notes & Customer Response *
                    </label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Enter customer response, family shopping schedule, saree/fabric preferences, budget discussed..."
                      value={callForm.remarks}
                      onChange={(e) => setCallForm({ ...callForm, remarks: e.target.value })}
                      className="w-full px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-medium text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#E8D9D4]">
                    <div className="text-[10px] text-[#6F5963]">
                      Will create a call audit record under your profile.
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCallModalOpen(false)}
                        className="px-4 py-2 rounded-xl bg-[#FFFAF7] hover:bg-[#FFF7F2] border border-[#E8D9D4] font-semibold text-[#4A173A]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingCall}
                        className="px-6 py-2 rounded-xl bg-[#4A173A] hover:bg-[#6A2853] text-white font-semibold shadow-xs border border-[#B76E79]/30"
                      >
                        {savingCall ? 'Saving...' : 'Save & Log Outcome'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
      </PageContainer>
    </DashboardLayout>
  );
}
