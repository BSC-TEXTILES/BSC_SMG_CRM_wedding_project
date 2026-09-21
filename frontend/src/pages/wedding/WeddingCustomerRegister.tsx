import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import ToastContainer, { showToast } from '../../components/Toast';
import { API, Auth, UserSession } from '../../services/api';
import { getSidebarCollapsed, subscribeSidebarCollapsed } from '../../utils/sidebarState';
import WeddingNav from './WeddingNav';
import {
  WeddingCustomer,
  CUSTOMER_STATUSES,
  CALL_OUTCOMES,
  getStatusBadge
} from './weddingTypes';
import LocationFilterSelect from '../../components/ui/LocationFilterSelect';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Plus,
  PhoneCall,
  UserCheck,
  Building2,
  MapPin,
  Calendar,
  Clock,
  Sparkles,
  MessageCircle,
  Download,
  Upload,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit,
  X,
  CircleCheck,
  CircleAlert
} from 'lucide-react';

export default function WeddingCustomerRegister() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(() => Auth.get());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(getSidebarCollapsed());

  useEffect(() => {
    return subscribeSidebarCollapsed(setCollapsed);
  }, []);

  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<WeddingCustomer[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  // Filters - initialized from persistent selection
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState<number | ''>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('bsc_selected_location') : null;
    return saved && saved !== 'ALL' ? Number(saved) : '';
  });
  const [telecallerFilter, setTelecallerFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Listen to global location changes (e.g. from Topbar)
  useEffect(() => {
    const handleLocChange = (e: any) => {
      const locId = e?.detail?.locationId;
      const parsed = locId && locId !== 'ALL' ? Number(locId) : '';
      setLocationFilter(parsed);
      setCurrentPage(1);
    };
    window.addEventListener('bsc_location_changed', handleLocChange);
    return () => window.removeEventListener('bsc_location_changed', handleLocChange);
  }, []);

  // Pagination & Sorting
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [sortBy, setSortBy] = useState<'created_at' | 'expected_shopping_date' | 'wedding_date' | 'customer_name'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Master Data
  const [locations, setLocations] = useState<any[]>([]);
  const [telecallers, setTelecallers] = useState<any[]>([]);

  // Quick Action Modals
  const [activeCallCustomer, setActiveCallCustomer] = useState<WeddingCustomer | null>(null);
  const [callLogForm, setCallLogForm] = useState({
    call_status: 'Completed',
    call_outcome: 'Connected',
    remarks: '',
    customer_response: '',
    next_follow_up_date: '',
    next_follow_up_time: 'Morning (10 AM - 1 PM)',
    expected_shopping_date: ''
  });
  const [savingCall, setSavingCall] = useState(false);

  // Quick Assign Modal
  const [assignCustomer, setAssignCustomer] = useState<WeddingCustomer | null>(null);
  const [targetTelecaller, setTargetTelecaller] = useState('');
  const [savingAssign, setSavingAssign] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
        search: searchQuery.trim() || undefined,
        status: statusFilter || undefined,
        location_id: locationFilter !== '' ? locationFilter : undefined,
        telecaller_id: telecallerFilter || undefined,
        date_filter: dateFilter !== 'all' ? dateFilter : undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined
      };

      const [custRes, locsRes, callersRes] = await Promise.all([
        API.getWeddingCustomers(params),
        API.getLocations().catch(() => ({ locations: [] })),
        API.getWeddingTelecallers(locationFilter !== '' ? locationFilter : undefined).catch(() => ({ telecallers: [] }))
      ]);

      if (custRes?.customers) {
        setCustomers(custRes.customers);
        setTotalCount(custRes.total || custRes.customers.length);
      }
      if (locsRes?.locations) setLocations(locsRes.locations);
      if (callersRes?.telecallers) setTelecallers(callersRes.telecallers);
    } catch (err: any) {
      showToast('Error loading customer register: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, searchQuery, statusFilter, locationFilter, telecallerFilter, dateFilter, fromDate, toDate]);

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
    loadData();
  }, [loadData, navigate]);

  // Export to Excel
  const handleExport = () => {
    if (customers.length === 0) {
      showToast('No records to export', 'error');
      return;
    }

    const rows = customers.map((c) => ({
      'Registration ID': c.customer_code,
      'Customer Name': c.customer_name,
      'Mobile Number': c.mobile_number,
      'Email': c.email || '',
      'Store Location': c.location_name || '',
      'Wedding Date': c.wedding_date || '',
      'Expected Shopping Date': c.expected_shopping_date || '',
      'Category': c.preferred_shopping_category || '',
      'Assigned Telecaller': c.assigned_telecaller || 'Unassigned',
      'Status': c.customer_status,
      'Next Follow-up': c.follow_up_date || '',
      'Total Calls': c.total_calls_count || 0,
      'Last Call Outcome': c.last_call_outcome || '',
      'Registered Date': c.created_at ? new Date(c.created_at).toLocaleDateString() : ''
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Wedding Customers');
    XLSX.writeFile(wb, `BSC_Wedding_Customers_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('Customer register exported to Excel', 'success');
  };

  // Submit Call Log
  const handleSaveCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCallCustomer) return;
    setSavingCall(true);
    try {
      await API.logWeddingCall({
        customer_id: activeCallCustomer.id,
        call_date: new Date().toISOString().slice(0, 10),
        call_time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        call_status: callLogForm.call_status,
        call_outcome: callLogForm.call_outcome,
        remarks: callLogForm.remarks,
        customer_response: callLogForm.customer_response,
        next_follow_up_date: callLogForm.next_follow_up_date || undefined,
        next_follow_up_time: callLogForm.next_follow_up_time || undefined,
        expected_shopping_date_updated: callLogForm.expected_shopping_date || undefined
      });

      showToast('Call logged successfully', 'success');
      setActiveCallCustomer(null);
      loadData();
    } catch (err: any) {
      showToast('Error logging call: ' + err.message, 'error');
    } finally {
      setSavingCall(false);
    }
  };

  // Submit Telecaller Assignment
  const handleSaveAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignCustomer) return;
    setSavingAssign(true);
    try {
      const callerObj = telecallers.find((t) => t.name === targetTelecaller || String(t.id) === targetTelecaller);
      await API.updateWeddingCustomer(assignCustomer.id, {
        assigned_telecaller: callerObj ? callerObj.name : targetTelecaller,
        assigned_telecaller_id: callerObj ? callerObj.id : undefined
      });

      showToast('Telecaller assigned successfully', 'success');
      setAssignCustomer(null);
      loadData();
    } catch (err: any) {
      showToast('Error assigning telecaller: ' + err.message, 'error');
    } finally {
      setSavingAssign(false);
    }
  };

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
          title="Wedding Customer Register"
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto space-y-6">
          <ToastContainer />

          <WeddingNav
            currentPageTitle="Wedding Customer Register"
            actions={
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExport}
                  className="px-3.5 py-2 bg-white hover:bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl text-xs font-bold text-[#182033] flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-[#C98218]" />
                  <span>Export Excel</span>
                </button>
                <Link
                  to="/wedding/customer-registration"
                  className="px-4 py-2 bg-[#101C36] hover:bg-[#07101F] text-[#C9A45C] font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all border border-[#C9A45C]/30"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Register Customer</span>
                </Link>
              </div>
            }
          />

          {/* Search & Filter Toolbar */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#DFDDD7] shadow-xs space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Search Bar */}
              <div className="lg:col-span-2 relative">
                <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search customer name, mobile, reg ID..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-9 pr-4 py-2 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl text-xs text-[#182033] focus:outline-none focus:border-[#C9A45C]"
                />
              </div>

              {/* Location Filter */}
              <div>
                <LocationFilterSelect
                  value={locationFilter}
                  className="w-full"
                  onChange={(val) => {
                    setLocationFilter(val);
                    setCurrentPage(1);
                  }}
                />
              </div>

              {/* Status Filter */}
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl text-xs font-semibold text-[#182033] focus:outline-none focus:border-[#C9A45C]"
                >
                  <option value="">Status: All Statuses</option>
                  {CUSTOMER_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              {/* Telecaller Filter */}
              <div>
                <select
                  value={telecallerFilter}
                  onChange={(e) => {
                    setTelecallerFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl text-xs font-semibold text-[#182033] focus:outline-none focus:border-[#C9A45C]"
                >
                  <option value="">Caller: All Telecallers</option>
                  {telecallers.map((t) => (
                    <option key={t.id} value={t.id}>
                      👤 {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Sub-Filters Row: Date Range */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#DFDDD7] text-xs">
              <div className="flex items-center gap-2">
                <span className="text-muted font-bold">Shopping Period:</span>
                {['all', 'today', 'tomorrow', 'this_week', 'this_month'].map((df) => (
                  <button
                    key={df}
                    onClick={() => {
                      setDateFilter(df);
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all capitalize ${
                      dateFilter === df
                        ? 'bg-[#101C36] text-[#C9A45C]'
                        : 'bg-[#F6F4EF] text-muted hover:text-primary'
                    }`}
                  >
                    {df.replace('_', ' ')}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={loadData}
                  className="p-1.5 rounded-lg bg-[#F6F4EF] hover:bg-[#DFDDD7] text-muted hover:text-primary transition-colors"
                  title="Reload Customer Register"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#C9A45C]' : ''}`} />
                </button>
                <span className="text-muted font-semibold">
                  Showing <strong className="text-primary">{customers.length}</strong> of {totalCount} records
                </span>
              </div>
            </div>
          </div>

          {/* Customer Table */}
          <div className="bg-white rounded-2xl border border-[#DFDDD7] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#182033]">
                <thead className="bg-[#07101F] text-white uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4 font-black">Reg ID</th>
                    <th className="py-3 px-4 font-black">Customer</th>
                    <th className="py-3 px-4 font-black">Mobile</th>
                    <th className="py-3 px-4 font-black">Location</th>
                    <th className="py-3 px-4 font-black">Wedding Date</th>
                    <th className="py-3 px-4 font-black">Expected Shopping</th>
                    <th className="py-3 px-4 font-black">Telecaller</th>
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
                        <span>Loading customer register...</span>
                      </td>
                    </tr>
                  ) : customers.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-12 text-muted">
                        <div className="w-12 h-12 rounded-2xl bg-[#F6F4EF] text-muted flex items-center justify-center mx-auto mb-3">
                          <Search className="w-6 h-6" />
                        </div>
                        <div className="font-bold text-sm text-[#182033]">No customers match your criteria</div>
                        <div className="text-xs text-muted mt-1">Try resetting your filters or search keywords.</div>
                      </td>
                    </tr>
                  ) : (
                    customers.map((cust) => {
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
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 font-semibold text-[11px] text-muted">
                              <MapPin className="w-3 h-3 text-[#C9A45C]" />
                              {cust.location_name || 'Store'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium">
                            {cust.wedding_date ? (
                              <span className="text-pink-700 font-bold">
                                💍 {new Date(cust.wedding_date).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-muted">Not specified</span>
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
                            {cust.assigned_telecaller ? (
                              <span className="font-semibold text-primary">
                                👤 {cust.assigned_telecaller}
                              </span>
                            ) : (
                              <button
                                onClick={() => setAssignCustomer(cust)}
                                className="text-[10px] font-bold text-[#C98218] hover:underline"
                              >
                                + Assign
                              </button>
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
                              {/* View Profile */}
                              <Link
                                to={`/wedding-crm/customers/${cust.id}`}
                                className="p-1.5 rounded-lg bg-[#F6F4EF] hover:bg-[#DFDDD7] text-primary transition-colors"
                                title="View Customer Profile"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Link>

                              {/* Quick Call */}
                              <button
                                onClick={() => {
                                  setActiveCallCustomer(cust);
                                  setCallLogForm({
                                    call_status: 'Completed',
                                    call_outcome: 'Connected',
                                    remarks: '',
                                    customer_response: '',
                                    next_follow_up_date: cust.follow_up_date || '',
                                    next_follow_up_time: cust.preferred_call_time || 'Morning (10 AM - 1 PM)',
                                    expected_shopping_date: cust.expected_shopping_date || ''
                                  });
                                }}
                                className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors border border-emerald-200"
                                title="Log Call Outcome"
                              >
                                <PhoneCall className="w-3.5 h-3.5" />
                              </button>

                              {/* WhatsApp */}
                              <a
                                href={`https://wa.me/91${cust.mobile_number.replace(/\D/g, '')}?text=Namaste%20${encodeURIComponent(cust.customer_name)}%2C%20greetings%20from%20BSC%20Exclusive%20Textiles!`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 transition-colors border border-green-200"
                                title="Chat on WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </a>

                              {/* Assign Telecaller */}
                              <button
                                onClick={() => {
                                  setAssignCustomer(cust);
                                  setTargetTelecaller(cust.assigned_telecaller || '');
                                }}
                                className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-[#C98218] transition-colors border border-amber-200"
                                title="Assign Telecaller"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-[#DFDDD7] bg-[#F6F4EF] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-muted">
                Page <strong className="text-primary">{currentPage}</strong> of{' '}
                <strong className="text-primary">{Math.max(1, Math.ceil(totalCount / pageSize))}</strong>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg bg-white border border-[#DFDDD7] font-bold text-[#182033] hover:bg-[#DFDDD7] disabled:opacity-40 transition-colors flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                <button
                  onClick={() => setCurrentPage((p) => (p * pageSize < totalCount ? p + 1 : p))}
                  disabled={currentPage * pageSize >= totalCount}
                  className="px-3 py-1.5 rounded-lg bg-white border border-[#DFDDD7] font-bold text-[#182033] hover:bg-[#DFDDD7] disabled:opacity-40 transition-colors flex items-center gap-1"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Quick Call Log Modal */}
          {activeCallCustomer && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#DFDDD7] space-y-4 animate-scale-in">
                <div className="flex items-center justify-between pb-3 border-b border-[#DFDDD7]">
                  <div>
                    <h3 className="text-base font-black text-[#182033]">
                      Log Call: {activeCallCustomer.customer_name}
                    </h3>
                    <div className="text-xs text-muted">
                      {activeCallCustomer.customer_code} · {activeCallCustomer.mobile_number}
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveCallCustomer(null)}
                    className="p-1 rounded-lg hover:bg-[#F6F4EF] text-muted"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveCall} className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-muted mb-1">
                        Call Outcome *
                      </label>
                      <select
                        value={callLogForm.call_outcome}
                        onChange={(e) => setCallLogForm({ ...callLogForm, call_outcome: e.target.value })}
                        className="w-full px-3 py-2 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-bold"
                      >
                        {CALL_OUTCOMES.map((out) => (
                          <option key={out} value={out}>
                            {out}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-muted mb-1">
                        Next Follow-up Date
                      </label>
                      <input
                        type="date"
                        value={callLogForm.next_follow_up_date}
                        onChange={(e) => setCallLogForm({ ...callLogForm, next_follow_up_date: e.target.value })}
                        className="w-full px-3 py-2 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-muted mb-1">
                      Expected Shopping Date (Updated)
                    </label>
                    <input
                      type="date"
                      value={callLogForm.expected_shopping_date}
                      onChange={(e) => setCallLogForm({ ...callLogForm, expected_shopping_date: e.target.value })}
                      className="w-full px-3 py-2 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-muted mb-1">
                      Customer Feedback / Notes
                    </label>
                    <textarea
                      rows={3}
                      placeholder="What did the customer say regarding shopping timing, silk categories, or budget?"
                      value={callLogForm.remarks}
                      onChange={(e) => setCallLogForm({ ...callLogForm, remarks: e.target.value })}
                      className="w-full px-3 py-2 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-medium"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#DFDDD7]">
                    <button
                      type="button"
                      onClick={() => setActiveCallCustomer(null)}
                      className="px-4 py-2 rounded-xl bg-[#F6F4EF] hover:bg-[#DFDDD7] font-bold text-[#182033]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingCall}
                      className="px-5 py-2 rounded-xl bg-[#101C36] hover:bg-[#07101F] text-[#C9A45C] font-black shadow-md border border-[#C9A45C]/30"
                    >
                      {savingCall ? 'Saving...' : 'Save Call Outcome'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Quick Assign Modal */}
          {assignCustomer && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-[#DFDDD7] space-y-4 animate-scale-in">
                <div className="flex items-center justify-between pb-3 border-b border-[#DFDDD7]">
                  <div>
                    <h3 className="text-base font-black text-[#182033]">Assign Telecaller</h3>
                    <div className="text-xs text-muted">{assignCustomer.customer_name}</div>
                  </div>
                  <button
                    onClick={() => setAssignCustomer(null)}
                    className="p-1 rounded-lg hover:bg-[#F6F4EF] text-muted"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveAssign} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-muted mb-1">
                      Select Telecaller
                    </label>
                    <select
                      value={targetTelecaller}
                      onChange={(e) => setTargetTelecaller(e.target.value)}
                      className="w-full px-3 py-2 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-bold"
                    >
                      <option value="">-- Choose Caller --</option>
                      {telecallers.map((t) => (
                        <option key={t.id} value={t.name}>
                          👤 {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#DFDDD7]">
                    <button
                      type="button"
                      onClick={() => setAssignCustomer(null)}
                      className="px-4 py-2 rounded-xl bg-[#F6F4EF] hover:bg-[#DFDDD7] font-bold text-[#182033]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingAssign || !targetTelecaller}
                      className="px-5 py-2 rounded-xl bg-[#101C36] hover:bg-[#07101F] text-[#C9A45C] font-black shadow-md border border-[#C9A45C]/30 disabled:opacity-40"
                    >
                      {savingAssign ? 'Assigning...' : 'Assign'}
                    </button>
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
