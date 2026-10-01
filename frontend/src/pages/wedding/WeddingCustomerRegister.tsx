import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import PageContainer from '../../components/ui/PageContainer';
import { showToast } from '../../components/Toast';
import { API, Auth, UserSession } from '../../services/api';
import WeddingNav from './WeddingNav';
import { getSidebarCollapsed, subscribeSidebarCollapsed } from '../../utils/sidebarState';
import { useRealtimeSection } from '../../hooks/useRealtimeSection';
import { parseDate, formatDateDisplay } from '../../utils/dateUtils';
import {
  WeddingCustomer,
  CUSTOMER_STATUSES,
  CALL_OUTCOMES,
  isCompletionStatus,
  ARCHIVE_PROTECTED_MESSAGE,
  getStatusBadge
} from './weddingTypes';
import LocationFilterSelect from '../../components/ui/LocationFilterSelect';
import { UserPlus, Search, PhoneCall, UserCheck, MapPin, MessageCircle, Download, RefreshCw, ChevronLeft, ChevronRight, Eye, X, CircleCheck, CircleAlert, Trash2, Archive, Lock, MessageSquareQuote } from 'lucide-react';
import TellCallerModal from '../../components/wedding/TellCallerModal';
import { permissionsCache } from '../../context/PermissionsCache';

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
    const sess = Auth.get();
    const isAdminRole = ['Admin', 'Super Admin', 'system administrator'].includes(sess?.role || '');
    const isGlobal = isAdminRole && (!sess?.locationId || sess?.isGlobalAdmin === true);
    if (!isGlobal && sess?.locationId) {
      return sess.locationId;
    }
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
      const sess = Auth.get();
      const isAdminRole = ['Admin', 'Super Admin', 'system administrator'].includes(sess?.role || '');
      const isGlobal = isAdminRole && (!sess?.locationId || sess?.isGlobalAdmin === true);
      if (!isGlobal && sess?.locationId) {
        setLocationFilter(sess.locationId);
        setCurrentPage(1);
        return;
      }
      const locId = e?.detail?.locationId;
      const parsed = locId && locId !== 'ALL' ? Number(locId) : '';
      setLocationFilter(parsed);
      setCurrentPage(1);
    };
    window.addEventListener('bsc_location_changed', handleLocChange);
    return () => window.removeEventListener('bsc_location_changed', handleLocChange);
  }, []);

  // Real-time sync for wedding customer changes
  useRealtimeSection(['wedding', 'wedding_reg'], () => {
    loadData();
  });

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

  // Move to Old Customers Modal
  const [customerToArchive, setCustomerToArchive] = useState<WeddingCustomer | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [archiving, setArchiving] = useState(false);

  // Tell Caller
  const [tellCallerCustomer, setTellCallerCustomer] = useState<WeddingCustomer | null>(null);
  const [canTellCaller, setCanTellCaller] = useState(() => {
    const role = (Auth.get()?.role || '').trim().toLowerCase();
    return ['admin', 'super admin', 'system administrator', 'manager', 'crm manager', 'store manager', 'floor manager', 'wedding collection manager', 'crm executive'].some(r => role.includes(r));
  });

  useEffect(() => {
    let active = true;
    const role = (Auth.get()?.role || '').trim().toLowerCase();
    const isManagerial = ['admin', 'super admin', 'system administrator', 'manager', 'crm manager', 'store manager', 'floor manager', 'wedding collection manager', 'crm executive'].some(r => role.includes(r));
    if (isManagerial) {
      setCanTellCaller(true);
    } else {
      permissionsCache.get().then(() => {
        if (!active) return;
        const currentRole = Auth.get()?.role;
        setCanTellCaller(
          permissionsCache.canAction('wedding_tell_caller', 'can_add', currentRole) ||
          permissionsCache.canAction('wedding_crm', 'can_edit', currentRole) ||
          permissionsCache.canAction('wedding_crm', 'can_add', currentRole)
        );
      });
    }
    return () => { active = false; };
  }, []);

  const handleMoveToOldCustomers = async () => {
    if (!customerToArchive) return;
    setArchiving(true);
    try {
      await API.moveWeddingCustomerToOld(customerToArchive.id, archiveReason || 'Manually moved to Old Customers');
      showToast(`Customer "${customerToArchive.customer_name}" moved to Old Customers successfully.`, 'success');
      setCustomerToArchive(null);
      setArchiveReason('');
      loadData();
    } catch (err: any) {
      showToast('Error moving customer: ' + (err.message || 'Server error'), 'error');
    } finally {
      setArchiving(false);
    }
  };

  // Delete Modal
  const [customerToDelete, setCustomerToDelete] = useState<WeddingCustomer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteCustomer = async () => {
    if (!customerToDelete) return;
    setDeleting(true);
    try {
      await API.deleteWeddingCustomer(customerToDelete.id);
      showToast(`Customer "${customerToDelete.customer_name}" deleted successfully.`, 'success');
      setCustomerToDelete(null);
      loadData();
    } catch (err: any) {
      // DELETE now answers with a JSON body carrying `message`. Completed/archived rows
      // return 403 "Completed customer records are permanently protected." — show the
      // server wording verbatim instead of a generic "Error deleting customer".
      const serverMessage = err?.message || err?.data?.message || err?.response?.data?.message;
      if (err?.status === 403) {
        // Record stays in the register — surface the protection message, keep modal open.
        showToast(serverMessage || ARCHIVE_PROTECTED_MESSAGE, 'error');
      } else {
        showToast(serverMessage || 'Server error. Please try again.', 'error');
        setCustomerToDelete(null);
      }
    } finally {
      setDeleting(false);
    }
  };

  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input to avoid flooding the API
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Load locations once on mount
  useEffect(() => {
    API.getLocations()
      .then(res => { if (res?.locations) setLocations(res.locations); })
      .catch(() => {});
  }, []);

  // Compute effective location
  const sess = Auth.get();
  const isAdminRole = ['Admin', 'Super Admin', 'system administrator'].includes(sess?.role || '');
  const isGlobal = isAdminRole && (!sess?.locationId || sess?.isGlobalAdmin === true);
  const effectiveLoc = !isGlobal ? (sess?.locationId || 3) : (locationFilter !== '' ? locationFilter : undefined);

  // Load telecallers when effective location changes
  useEffect(() => {
    API.getWeddingTelecallers(effectiveLoc)
      .then(res => { if (res?.telecallers) setTelecallers(res.telecallers); })
      .catch(() => {});
  }, [effectiveLoc]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
        search: debouncedSearch.trim() || undefined,
        status: statusFilter || undefined,
        location_id: effectiveLoc,
        telecaller_id: telecallerFilter || undefined,
        date_filter: dateFilter !== 'all' ? dateFilter : undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined
      };

      const custRes = await API.getWeddingCustomers(params);

      if (custRes?.customers) {
        setCustomers(custRes.customers);
        // The API reports the full match count under `pagination.total`; reading
        // `total` instead silently capped it at one page of rows.
        setTotalCount(custRes.pagination?.total ?? custRes.total ?? custRes.customers.length);
      }
    } catch (err: any) {
      showToast('Error loading customer register: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, debouncedSearch, statusFilter, effectiveLoc, telecallerFilter, dateFilter, fromDate, toDate]);

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
      'Preferred Shopping Category': c.preferred_shopping_category || '',
      'Estimated Family Size': c.estimated_family_size ?? '',
      'Budget': c.budget || '',
      'Assigned Telecaller': c.assigned_telecaller || 'Unassigned',
      'Customer Notes': c.customer_notes || '',
      'Follow-up Date': c.follow_up_date || '',
      'Status': c.customer_status,
      'Call Status': c.call_status,
      'Total Calls': c.total_calls_count || 0,
      'Last Call Outcome': c.last_call_outcome || '',
      'Registered Date': formatDateDisplay(c.created_at, '')
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
    if (!assignCustomer || savingAssign) return;
    setSavingAssign(true);
    try {
      // Match by ID (number) for reliability
      const callerObj = telecallers.find((t: any) => String(t.id) === String(targetTelecaller));
      if (!callerObj) {
        showToast('Please select a valid telecaller.', 'error');
        setSavingAssign(false);
        return;
      }
      await API.updateWeddingCustomer(assignCustomer.id, {
        assigned_telecaller: callerObj.full_name || callerObj.name,
        assigned_telecaller_id: callerObj.id
      });

      const isReassign = assignCustomer.assigned_telecaller &&
        assignCustomer.assigned_telecaller !== 'Auto-Assigned' &&
        assignCustomer.assigned_telecaller !== 'Staff';
      showToast(
        isReassign
          ? `Telecaller reassigned to ${callerObj.full_name || callerObj.name} successfully.`
          : `Telecaller assigned to ${callerObj.full_name || callerObj.name} successfully.`,
        'success'
      );
      setAssignCustomer(null);
      setTargetTelecaller('');
      loadData();
    } catch (err: any) {
      showToast('Unable to assign telecaller. Please try again.', 'error');
    } finally {
      setSavingAssign(false);
    }
  };

  return (
    <DashboardLayout
      title="Wedding Customer Register"
      breadcrumbs={[{ label: 'Wedding CRM', href: '/wedding-crm/dashboard' }, { label: 'Customer Register' }]}
    >
      <PageContainer maxWidth="full">

          <WeddingNav
            currentPageTitle="Wedding Customer Register"
            actions={
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExport}
                  className="px-3.5 py-2 bg-[#FFFDFC] hover:bg-[#FFF7F2] border border-[#E8D9D4] rounded-xl text-xs font-semibold text-[#4A173A] flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-[#B76E79]" />
                  <span>Export Excel</span>
                </button>
                <Link
                  to="/wedding/customer-registration"
                  className="px-4 py-2 bg-[#4A173A] hover:bg-[#6A2853] text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-all border border-[#B76E79]/30"
                >
                  <UserPlus className="w-3.5 h-3.5 text-[#E8C7A8]" />
                  <span>Register Customer</span>
                </Link>
              </div>
            }
          />

          {/* Search & Filter Toolbar */}
          <div className="bg-[#FFFDFC] p-4 sm:p-5 rounded-2xl border border-[#E8D9D4] shadow-xs space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Search Bar */}
              <div className="lg:col-span-2 relative">
                <Search className="w-4 h-4 text-[#9A858D] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search customer name, mobile, reg ID..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-9 pr-4 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl text-xs text-[#2B1722] placeholder-[#9A858D] focus:outline-none focus:border-[#B76E79]"
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
                  className="w-full px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl text-xs font-medium text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                >
                  <option value="">All Statuses</option>
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
                  className="w-full px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl text-xs font-medium text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
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
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#E8D9D4] text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[#6F5963] font-semibold">Shopping Period:</span>
                {['all', 'today', 'tomorrow', 'this_week', 'this_month'].map((df) => (
                  <button
                    key={df}
                    onClick={() => {
                      setDateFilter(df);
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-all capitalize ${
                      dateFilter === df
                        ? 'bg-[#B76E79] text-white shadow-xs'
                        : 'bg-[#FFFAF7] text-[#6F5963] hover:text-[#4A173A] hover:bg-[#F6E2E5]'
                    }`}
                  >
                    {df.replace('_', ' ')}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={loadData}
                  className="p-1.5 rounded-lg bg-[#FFFAF7] hover:bg-[#FFF7F2] text-[#B76E79] border border-[#E8D9D4] transition-colors"
                  title="Reload Customer Register"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#B76E79]' : ''}`} />
                </button>
                <span className="text-[#6F5963] font-medium">
                  Showing <strong className="text-[#4A173A]">{customers.length}</strong> of {totalCount} records
                </span>
              </div>
            </div>
          </div>

          {/* Customer Table & Mobile Cards */}
          <div className="bg-[#FFFDFC] rounded-2xl border border-[#E8D9D4] shadow-xs overflow-hidden">
            {/* Mobile Customer Cards (< md) */}
            <div className="md:hidden divide-y divide-[#E8D9D4]">
              {loading ? (
                <div className="text-center py-12 text-[#6F5963]">
                  <RefreshCw className="w-5 h-5 animate-spin text-[#B76E79] mx-auto mb-2" />
                  <span>Loading customer register...</span>
                </div>
              ) : customers.length === 0 ? (
                <div className="text-center py-12 text-[#6F5963] p-6">
                  <Search className="w-8 h-8 mx-auto text-[#9A858D] mb-2" />
                  <div className="font-bold text-sm text-[#4A173A]">No customers match your criteria</div>
                  <div className="text-xs text-[#6F5963] mt-1">Try resetting your filters or search keywords.</div>
                </div>
              ) : (
                customers.map((cust) => {
                  const badge = getStatusBadge(cust.customer_status);
                  return (
                    <div
                      key={cust.id}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('a,button,input,select,textarea')) return;
                        navigate(`/wedding-crm/customers/${cust.id}`);
                      }}
                      className="p-4 space-y-3 hover:bg-[#FFF1F2]/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-mono font-bold text-[#9A858D] uppercase tracking-wider block">
                            {cust.customer_code}
                          </span>
                          <Link
                            to={`/wedding-crm/customers/${cust.id}`}
                            className="font-bold text-sm text-[#2B1722] hover:text-[#4A173A] block"
                          >
                            {cust.customer_name}
                          </Link>
                          <div className="text-xs font-medium text-[#2B1722] mt-0.5">
                            {cust.mobile_number}
                          </div>
                        </div>

                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                          {cust.customer_status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 text-xs text-[#6F5963] pt-2 border-t border-[#E8D9D4]">
                        <div>
                          <span className="font-semibold text-[#4A173A]">Location:</span> {cust.location_name || 'Store'}
                        </div>
                        <div>
                          <span className="font-semibold text-[#4A173A]">Wedding:</span>{' '}
                          {cust.wedding_date ? (
                            <span className="text-[#B76E79] font-medium">
                              {formatDateDisplay(cust.wedding_date, 'TBD')}
                            </span>
                          ) : (
                            'TBD'
                          )}
                        </div>
                        <div>
                          <span className="font-semibold text-[#4A173A]">Assigned:</span>{' '}
                          <span className="text-[#2B1722] font-medium">{cust.assigned_telecaller || 'Unassigned'}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-[#4A173A]">Follow-up:</span>{' '}
                          {formatDateDisplay(cust.follow_up_date, 'None')}
                        </div>
                      </div>

                      {/* Quick Action Buttons */}
                      <div className="flex items-center gap-2 pt-2 border-t border-[#E8D9D4]">
                        <Link
                          to={`/wedding-crm/customers/${cust.id}`}
                          className="flex-1 py-2 rounded-xl bg-[#FFFAF7] hover:bg-[#FFF7F2] text-[#4A173A] border border-[#E8D9D4] font-semibold text-xs text-center transition-colors"
                        >
                          View
                        </Link>
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
                          className="flex-1 py-2 rounded-xl bg-[#4A173A] text-white hover:bg-[#6A2853] font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs border border-[#B76E79]/30"
                        >
                          <PhoneCall className="w-3.5 h-3.5 text-[#E8C7A8]" />
                          <span>Call</span>
                        </button>
                        <a
                          href={`https://wa.me/91${cust.mobile_number.replace(/\D/g, '')}?text=Namaste%20${encodeURIComponent(cust.customer_name)}%2C%20greetings%20from%20BSC%20Exclusive!`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-xl bg-[#198754] hover:bg-[#16805B] text-white transition-colors"
                          title="Chat on WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => {
                            setAssignCustomer(cust);
                            setTargetTelecaller(cust.assigned_telecaller || '');
                          }}
                          className="p-2 rounded-xl bg-[#FFFAF7] hover:bg-[#FFF7F2] text-[#4A173A] border border-[#E8D9D4] transition-colors"
                          title="Assign Telecaller"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setCustomerToArchive(cust);
                            setArchiveReason('Completed wedding shopping / journey');
                          }}
                          className="p-2 rounded-xl bg-[#FAF0E6] hover:bg-[#FAF0E6]/80 text-[#B76E79] border border-[#E8D9D4] transition-colors"
                          title="Move to Old Customers"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop & Tablet Table (md+) */}
            <div className="hidden md:block table-frame custom-scrollbar">
              {/* min-width keeps every column at its natural size so the table
                  scrolls horizontally on narrow laptops instead of squeezing the
                  Actions cell until its buttons spill over neighbouring columns. */}
              <table className="w-full min-w-[1180px] text-left text-xs text-[#2B1722]">
                <thead className="bg-[#F8EDE8] text-[#4A173A] border-b border-[#E8D9D4] uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4 font-bold whitespace-nowrap">Reg ID</th>
                    <th className="py-3 px-4 font-bold whitespace-nowrap">Customer</th>
                    <th className="py-3 px-4 font-bold whitespace-nowrap">Mobile</th>
                    <th className="py-3 px-4 font-bold whitespace-nowrap">Location</th>
                    <th className="py-3 px-4 font-bold whitespace-nowrap">Wedding Date</th>
                    <th className="py-3 px-4 font-bold whitespace-nowrap">Expected Shopping</th>
                    <th className="py-3 px-4 font-bold whitespace-nowrap">Telecaller</th>
                    <th className="py-3 px-4 font-bold whitespace-nowrap">Status</th>
                    <th className="py-3 px-4 font-bold whitespace-nowrap">Next Follow-up</th>
                    <th className="py-3 px-4 font-bold text-right whitespace-nowrap w-[210px] border-l border-[#E8D9D4]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8D9D4]">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="text-center py-12 text-[#6F5963]">
                        <RefreshCw className="w-5 h-5 animate-spin text-[#B76E79] mx-auto mb-2" />
                        <span>Loading customer register...</span>
                      </td>
                    </tr>
                  ) : customers.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-12 text-[#6F5963]">
                        <div className="w-12 h-12 rounded-2xl bg-[#FFFAF7] text-[#9A858D] border border-[#E8D9D4] flex items-center justify-center mx-auto mb-3">
                          <Search className="w-6 h-6" />
                        </div>
                        <div className="font-bold text-sm text-[#4A173A]">No customers match your criteria</div>
                        <div className="text-xs text-[#6F5963] mt-1">Try resetting your filters or search keywords.</div>
                      </td>
                    </tr>
                  ) : (
                    customers.map((cust) => {
                      const badge = getStatusBadge(cust.customer_status);
                      const followUp = parseDate(cust.follow_up_date);
                      const isOverdue =
                        !!followUp && followUp.getTime() < new Date().setHours(0, 0, 0, 0);

                      return (
                        <tr
                          key={cust.id}
                          onClick={(e) => {
                            // Nested controls (links, buttons, inputs) keep their own
                            // behaviour; only bare row clicks open the customer.
                            if ((e.target as HTMLElement).closest('a,button,input,select,textarea')) return;
                            navigate(`/wedding-crm/customers/${cust.id}`);
                          }}
                          className="hover:bg-[#FFF1F2] transition-colors cursor-pointer"
                        >
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
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 font-medium text-[11px] text-[#6F5963]">
                              <MapPin className="w-3 h-3 text-[#B76E79]" />
                              {cust.location_name || 'Store'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium">
                            {parseDate(cust.wedding_date) ? (
                              <span className="text-[#B76E79] font-medium">
                                💍 {formatDateDisplay(cust.wedding_date, 'Not specified')}
                              </span>
                            ) : (
                              <span className="text-[#9A858D]">Not specified</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-semibold text-[#4A173A]">
                            {parseDate(cust.expected_shopping_date) ? (
                              formatDateDisplay(cust.expected_shopping_date, 'Not Scheduled')
                            ) : (
                              <span className="text-[#9A858D] font-normal">Not Scheduled</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {cust.assigned_telecaller && cust.assigned_telecaller !== 'Auto-Assigned' ? (
                              <div>
                                <div className="flex items-center">
                                  <span className="font-semibold text-[#4A173A] text-xs">
                                    {cust.assigned_telecaller}
                                  </span>
                                  <button
                                    onClick={() => {
                                      setAssignCustomer(cust);
                                      setTargetTelecaller('');
                                    }}
                                    className="ml-2 text-[9px] font-bold text-[#B76E79] hover:underline"
                                    title="Reassign Telecaller"
                                  >
                                    Reassign
                                  </button>
                                </div>
                                {cust.last_contacted_by && (
                                  <div className="text-[10px] text-[#6F5963] mt-0.5">
                                    Last Call: <span className="font-medium text-[#2B1722]">{cust.last_contacted_by}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setAssignCustomer(cust);
                                  setTargetTelecaller('');
                                }}
                                className="text-[10px] font-semibold text-[#B76E79] hover:underline"
                              >
                                + Assign
                              </button>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                              {cust.customer_status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {followUp ? (
                              <span className={`font-semibold ${isOverdue ? 'text-[#B42318]' : 'text-[#2B1722]'}`}>
                                {formatDateDisplay(cust.follow_up_date, 'None')}
                                {isOverdue && <span className="ml-1 text-[9px] bg-[#FDE8E7] text-[#B42318] px-1 rounded uppercase font-bold">Overdue</span>}
                              </span>
                            ) : (
                              <span className="text-[#9A858D]">None</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap border-l border-[#E8D9D4] align-middle">
                            <div className="inline-flex flex-nowrap items-center justify-end gap-1.5">
                              {/* View Profile */}
                              <Link
                                to={`/wedding-crm/customers/${cust.id}`}
                                className="shrink-0 p-1.5 rounded-lg bg-[#FFFAF7] hover:bg-[#FFF7F2] text-[#4A173A] border border-[#E8D9D4] transition-colors"
                                title="View Customer Profile"
                              >
                                <Eye className="w-3.5 h-3.5 text-[#B76E79]" />
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
                                className="shrink-0 p-1.5 rounded-lg bg-[#F6E2E5] hover:bg-[#D89AA3]/30 text-[#4A173A] transition-colors border border-[#E8D9D4]"
                                title="Log Call Outcome"
                              >
                                <PhoneCall className="w-3.5 h-3.5" />
                              </button>

                              {/* WhatsApp */}
                              <a
                                href={`https://wa.me/91${cust.mobile_number.replace(/\D/g, '')}?text=Namaste%20${encodeURIComponent(cust.customer_name)}%2C%20greetings%20from%20BSC%20Exclusive%20Textiles!`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 p-1.5 rounded-lg bg-[#E8F5EE] hover:bg-[#198754]/20 text-[#198754] transition-colors border border-[#198754]/20"
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
                                className="shrink-0 p-1.5 rounded-lg bg-[#FFF4D6] hover:bg-[#FFF4D6]/70 text-[#C58A18] transition-colors border border-[#C58A18]/20"
                                title="Assign Telecaller"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                              </button>

                              {/* Tell Caller — CRM instruction to a telecaller */}
                              {canTellCaller && cust.lifecycle_status !== 'OLD_CUSTOMER' && (
                                <button
                                  onClick={() => setTellCallerCustomer(cust)}
                                  className="shrink-0 p-1.5 rounded-lg bg-[#EAF1FA] hover:bg-[#356AE6]/15 text-[#356AE6] transition-colors border border-[#356AE6]/20"
                                  title="Tell Caller — send an instruction to a telecaller"
                                >
                                  <MessageSquareQuote className="w-3.5 h-3.5" />
                                </button>
                              )}

                               {/* Move to Old Customers — hidden once the row is archived */}
                              {cust.lifecycle_status !== 'OLD_CUSTOMER' && (
                                <button
                                  onClick={() => {
                                    setCustomerToArchive(cust);
                                    setArchiveReason('Completed wedding shopping / journey');
                                  }}
                                  className="shrink-0 p-1.5 rounded-lg bg-[#FAF0E6] hover:bg-[#FAF0E6]/80 text-[#B76E79] transition-colors border border-[#E8D9D4]"
                                  title="Move to Old Customers"
                                >
                                  <Archive className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Delete Customer — archived/completed records are permanently protected (403),
                                  so the control is not offered at all. Restore the record first. */}
                              {cust.lifecycle_status !== 'OLD_CUSTOMER' && !isCompletionStatus(cust.customer_status) ? (
                                <button
                                  onClick={() => setCustomerToDelete(cust)}
                                  className="shrink-0 p-1.5 rounded-lg bg-[#FDE8E7] hover:bg-[#FDE8E7]/70 text-[#B42318] transition-colors border border-[#B42318]/20"
                                  title="Delete Customer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled
                                  title={ARCHIVE_PROTECTED_MESSAGE}
                                  className="shrink-0 p-1.5 rounded-lg bg-[#F5F5F5] text-[#9A858D] border border-[#E8D9D4] cursor-not-allowed opacity-60"
                                >
                                  <Lock className="w-3.5 h-3.5" />
                                </button>
                              )}
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
            <div className="p-4 border-t border-[#E8D9D4] bg-[#FFFAF7] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-[#6F5963]">
                Page <strong className="text-[#4A173A]">{currentPage}</strong> of{' '}
                <strong className="text-[#4A173A]">{Math.max(1, Math.ceil(totalCount / pageSize))}</strong>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg bg-[#FFFDFC] border border-[#E8D9D4] font-semibold text-[#4A173A] hover:bg-[#FFF7F2] disabled:opacity-40 transition-colors flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                <button
                  onClick={() => setCurrentPage((p) => (p * pageSize < totalCount ? p + 1 : p))}
                  disabled={currentPage * pageSize >= totalCount}
                  className="px-3 py-1.5 rounded-lg bg-[#FFFDFC] border border-[#E8D9D4] font-semibold text-[#4A173A] hover:bg-[#FFF7F2] disabled:opacity-40 transition-colors flex items-center gap-1"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Quick Call Log Modal */}
          {activeCallCustomer && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <div className="bg-[#FFFDFC] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#E8D9D4] space-y-4 animate-scale-in">
                <div className="flex items-center justify-between pb-3 border-b border-[#E8D9D4]">
                  <div>
                    <h3 className="text-base font-bold text-[#4A173A]">
                      Log Call: {activeCallCustomer.customer_name}
                    </h3>
                    <div className="text-xs text-[#6F5963]">
                      {activeCallCustomer.customer_code} · {activeCallCustomer.mobile_number}
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveCallCustomer(null)}
                    className="p-1 rounded-lg hover:bg-[#FFF7F2] text-[#6F5963] hover:text-[#4A173A]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveCall} className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[#6F5963] mb-1">
                        Call Outcome *
                      </label>
                      <select
                        value={callLogForm.call_outcome}
                        onChange={(e) => setCallLogForm({ ...callLogForm, call_outcome: e.target.value })}
                        className="w-full px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                      >
                        {CALL_OUTCOMES.map((out) => (
                          <option key={out} value={out}>
                            {out}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[#6F5963] mb-1">
                        Next Follow-up Date
                      </label>
                      <input
                        type="date"
                        value={callLogForm.next_follow_up_date}
                        onChange={(e) => setCallLogForm({ ...callLogForm, next_follow_up_date: e.target.value })}
                        className="w-full px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-medium text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#6F5963] mb-1">
                      Expected Shopping Date (Updated)
                    </label>
                    <input
                      type="date"
                      value={callLogForm.expected_shopping_date}
                      onChange={(e) => setCallLogForm({ ...callLogForm, expected_shopping_date: e.target.value })}
                      className="w-full px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-medium text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#6F5963] mb-1">
                      Customer Feedback / Notes
                    </label>
                    <textarea
                      rows={3}
                      placeholder="What did the customer say regarding shopping timing, silk categories, or budget?"
                      value={callLogForm.remarks}
                      onChange={(e) => setCallLogForm({ ...callLogForm, remarks: e.target.value })}
                      className="w-full px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-medium text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E8D9D4]">
                    <button
                      type="button"
                      onClick={() => setActiveCallCustomer(null)}
                      className="px-4 py-2 rounded-xl bg-[#FFFAF7] hover:bg-[#FFF7F2] border border-[#E8D9D4] font-semibold text-[#4A173A]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingCall}
                      className="px-5 py-2 rounded-xl bg-[#4A173A] hover:bg-[#6A2853] text-white font-semibold shadow-xs border border-[#B76E79]/30"
                    >
                      {savingCall ? 'Saving...' : 'Save Call Outcome'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Quick Assign / Reassign Telecaller Modal */}
          {assignCustomer && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <div className="bg-[#FFFDFC] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#E8D9D4] space-y-4 animate-scale-in">
                <div className="flex items-center justify-between pb-3 border-b border-[#E8D9D4]">
                  <div>
                    <h3 className="text-base font-bold text-[#4A173A]">
                      {assignCustomer.assigned_telecaller && assignCustomer.assigned_telecaller !== 'Auto-Assigned'
                        ? 'Reassign Telecaller'
                        : 'Assign Telecaller'}
                    </h3>
                    <div className="text-xs text-[#6F5963] mt-0.5">
                      Customer: <strong className="text-[#2B1722]">{assignCustomer.customer_name}</strong> &middot; {assignCustomer.customer_code}
                    </div>
                    {assignCustomer.assigned_telecaller && assignCustomer.assigned_telecaller !== 'Auto-Assigned' && (
                      <div className="text-xs text-[#6F5963] mt-1">
                        Currently assigned to: <strong className="text-[#4A173A]">{assignCustomer.assigned_telecaller}</strong>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => { setAssignCustomer(null); setTargetTelecaller(''); }}
                    className="p-1 rounded-lg hover:bg-[#FFF7F2] text-[#6F5963] hover:text-[#4A173A]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveAssign} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#6F5963] mb-2">
                      Select Telecaller
                    </label>
                    {telecallers.length === 0 ? (
                      <div className="text-center py-6 text-[#6F5963]">
                        <CircleAlert className="w-6 h-6 mx-auto mb-2 text-[#C58A18]" />
                        <p className="font-semibold text-[#4A173A]">No telecallers available.</p>
                        <p className="text-[10px] mt-1">Please ensure active telecaller accounts exist in User Management.</p>
                      </div>
                    ) : (
                      <div className="max-h-60 overflow-y-auto space-y-1.5 border border-[#E8D9D4] rounded-xl p-2 bg-[#FFFAF7]">
                        {telecallers.map((t: any) => {
                          const isSelected = String(t.id) === String(targetTelecaller);
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setTargetTelecaller(String(t.id))}
                              className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                                isSelected
                                  ? 'bg-[#4A173A] text-white border-[#B76E79] shadow-xs'
                                  : 'bg-[#FFFDFC] border-[#E8D9D4] hover:border-[#B76E79]/50 hover:bg-[#F6E2E5]'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className={`text-xs font-semibold ${isSelected ? 'text-white' : 'text-[#2B1722]'}`}>
                                    {t.full_name || t.name || t.username}
                                  </div>
                                  <div className={`text-[10px] mt-0.5 font-mono ${isSelected ? 'text-[#E8C7A8]' : 'text-[#9A858D]'}`}>
                                    {t.employee_id || `EMP-${t.id}`}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className={`text-[9px] font-bold uppercase ${isSelected ? 'text-[#E8C7A8]' : 'text-[#6F5963]'}`}>
                                    {t.role}
                                  </div>
                                  <div className={`text-[9px] ${isSelected ? 'text-[#D89AA3]' : 'text-[#9A858D]'}`}>
                                    {t.location_name || 'All Locations'}
                                  </div>
                                </div>
                              </div>
                              {isSelected && (
                                <div className="mt-1 flex items-center gap-1">
                                  <CircleCheck className="w-3 h-3 text-[#E8C7A8]" />
                                  <span className="text-[9px] text-[#E8C7A8] font-bold">Selected</span>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E8D9D4]">
                    <button
                      type="button"
                      onClick={() => { setAssignCustomer(null); setTargetTelecaller(''); }}
                      className="px-4 py-2 rounded-xl bg-[#FFFAF7] hover:bg-[#FFF7F2] border border-[#E8D9D4] font-semibold text-[#4A173A]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingAssign || !targetTelecaller}
                      className="px-5 py-2 rounded-xl bg-[#4A173A] hover:bg-[#6A2853] text-white font-semibold shadow-xs border border-[#B76E79]/30 disabled:opacity-40 flex items-center gap-2"
                    >
                      {savingAssign ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-[#E8C7A8]/30 border-t-[#E8C7A8] rounded-full animate-spin" />
                          Assigning...
                        </>
                      ) : (
                        assignCustomer.assigned_telecaller && assignCustomer.assigned_telecaller !== 'Auto-Assigned'
                          ? 'Reassign Telecaller'
                          : 'Assign Telecaller'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {customerToDelete && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
              <div className="bg-[#FFFDFC] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#E8D9D4] space-y-4 animate-scale-in">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#FDE8E7] text-[#B42318] flex items-center justify-center flex-shrink-0">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#4A173A]">Delete Wedding Customer</h3>
                    <p className="text-xs text-[#6F5963]">This action will archive the customer record.</p>
                  </div>
                </div>

                <div className="p-4 bg-[#FFFAF7] rounded-2xl border border-[#E8D9D4] space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#6F5963]">Customer Name:</span>
                    <strong className="text-[#2B1722]">{customerToDelete.customer_name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6F5963]">Registration ID:</span>
                    <strong className="text-[#4A173A] font-mono">{customerToDelete.customer_code}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6F5963]">Mobile Number:</span>
                    <span className="font-semibold text-[#2B1722]">{customerToDelete.mobile_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6F5963]">Store Location:</span>
                    <span className="font-semibold text-[#2B1722]">{customerToDelete.location_name || 'Store'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8D9D4]">
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => setCustomerToDelete(null)}
                    className="px-4 py-2 rounded-xl bg-[#FFFAF7] hover:bg-[#FFF7F2] border border-[#E8D9D4] font-semibold text-[#4A173A] text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={handleDeleteCustomer}
                    className="px-5 py-2 rounded-xl bg-[#B42318] hover:bg-[#B42318]/90 text-white font-semibold text-xs shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {deleting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Confirm Delete</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* Tell Caller Modal */}
          {tellCallerCustomer && (
            <TellCallerModal
              customer={tellCallerCustomer}
              onClose={() => setTellCallerCustomer(null)}
              onSent={loadData}
            />
          )}

          {/* Move to Old Customers Modal */}
          {customerToArchive && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
              <div className="bg-[#FFFDFC] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#E8D9D4] space-y-4 animate-scale-in">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#FAF0E6] text-[#4A173A] flex items-center justify-center flex-shrink-0 border border-[#E8D9D4]">
                    <Archive className="w-5 h-5 text-[#B76E79]" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#4A173A]">Move Customer to Old Customers?</h3>
                    <p className="text-xs text-[#6F5963]">Historical archive with complete record retention</p>
                  </div>
                </div>

                <div className="p-4 bg-[#FFFAF7] rounded-2xl border border-[#E8D9D4] space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#6F5963]">Customer Name:</span>
                    <strong className="text-[#2B1722]">{customerToArchive.customer_name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6F5963]">Customer ID:</span>
                    <strong className="text-[#4A173A] font-mono">{customerToArchive.customer_code}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6F5963]">Mobile Number:</span>
                    <span className="font-semibold text-[#2B1722]">{customerToArchive.mobile_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6F5963]">Store Location:</span>
                    <span className="font-semibold text-[#2B1722]">{customerToArchive.location_name || 'Store'}</span>
                  </div>
                </div>

                <p className="text-[11.5px] text-[#6F5963] leading-relaxed">
                  The customer record and complete history will remain available in the Old Customers section. You can restore this customer at any time.
                </p>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[#4A173A] uppercase">Reason for Archiving (Optional):</label>
                  <input
                    type="text"
                    value={archiveReason}
                    onChange={(e) => setArchiveReason(e.target.value)}
                    placeholder="e.g., Completed wedding shopping / lifecycle closed"
                    className="w-full px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl text-xs font-semibold text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8D9D4]">
                  <button
                    type="button"
                    disabled={archiving}
                    onClick={() => setCustomerToArchive(null)}
                    className="px-4 py-2 rounded-xl bg-[#FFFAF7] hover:bg-[#FFF7F2] border border-[#E8D9D4] font-semibold text-[#4A173A] text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={archiving}
                    onClick={handleMoveToOldCustomers}
                    className="px-5 py-2 rounded-xl bg-[#4A173A] hover:bg-[#6A2853] text-white font-semibold text-xs shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {archiving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Moving...</span>
                      </>
                    ) : (
                      <>
                        <Archive className="w-3.5 h-3.5" />
                        <span>Move Customer</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
      </PageContainer>
    </DashboardLayout>
  );
}
