import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import PageContainer from '../../components/ui/PageContainer';
import ToastContainer, { showToast } from '../../components/Toast';
import { API, Auth, UserSession } from '../../services/api';
import WeddingNav from './WeddingNav';
import { getSidebarCollapsed, subscribeSidebarCollapsed } from '../../utils/sidebarState';
import { useRealtimeSection } from '../../hooks/useRealtimeSection';
import { parseDate, formatDateDisplay, formatDateTimeDisplay } from '../../utils/dateUtils';
import { WeddingCustomer, getStatusBadge } from './weddingTypes';
import {
  Search, Eye, RotateCcw, Download, RefreshCw, ChevronLeft, ChevronRight,
  Archive, Users, Calendar, MapPin, Phone, Mail, Sparkles, Filter,
  Building2, CheckCircle2, History, AlertTriangle, ArrowUpDown
} from 'lucide-react';

/**
 * Old Customer rows are wedding_customers joined with locations, so the
 * archive list carries the computed `display_archived_at` (COALESCE of
 * archived_at / updated_at) that the base type does not declare.
 */
type ArchivedWeddingCustomer = WeddingCustomer & {
  display_archived_at?: string | null;
};

/** The three BSC stores the archive summary cards always report on. */
const STORE_CARDS: { code: string; label: string }[] = [
  { code: 'BEL', label: 'Belagavi' },
  { code: 'DAV', label: 'Davanagere' },
  { code: 'SHI', label: 'Shivamogga' }
];

interface OldCustomerStats {
  totalOldCustomers: number;
  byStore: { name: string; code?: string | null; count: number }[];
  byPreviousStatus: { status: string; count: number }[];
  archivedThisMonth: number;
  archivedThisYear?: number;
  completedThisMonth?: number;
  completedThisYear?: number;
}

/**
 * Factual count for one store, straight out of stats.byStore. The backend only
 * emits stores that actually have archived rows, so a missing entry is 0 —
 * never a fabricated number and never an assumed presence.
 */
function storeArchiveCount(stats: OldCustomerStats, code: string, label: string): number {
  const byCode = stats.byStore.find(
    s => String(s.code ?? '').trim().toUpperCase() === code.toUpperCase()
  );
  if (byCode) return Number(byCode.count) || 0;
  const wanted = label.trim().toLowerCase();
  const byName = stats.byStore.find(s => String(s.name ?? '').trim().toLowerCase() === wanted);
  if (byName) return Number(byName.count) || 0;
  const partial = stats.byStore.find(s => String(s.name ?? '').trim().toLowerCase().includes(wanted));
  return partial ? Number(partial.count) || 0 : 0;
}

export default function WeddingOldCustomers() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(() => Auth.get());
  const [collapsed, setCollapsed] = useState<boolean>(getSidebarCollapsed());

  useEffect(() => {
    return subscribeSidebarCollapsed(setCollapsed);
  }, []);

  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<ArchivedWeddingCustomer[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<OldCustomerStats>({
    totalOldCustomers: 0,
    byStore: [],
    byPreviousStatus: [],
    archivedThisMonth: 0,
    archivedThisYear: 0,
    completedThisMonth: 0,
    completedThisYear: 0
  });

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [previousStatusFilter, setPreviousStatusFilter] = useState('');
  const [telecallerFilter, setTelecallerFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Location scoping & permissions
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

  // Pagination & Sorting
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState<'archived_at' | 'customer_name' | 'wedding_date' | 'expected_shopping_date' | 'customer_code'>('archived_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Master Data
  const [locations, setLocations] = useState<any[]>([]);
  const [telecallers, setTelecallers] = useState<any[]>([]);

  // Modals
  const [customerToRestore, setCustomerToRestore] = useState<ArchivedWeddingCustomer | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [autoArchiving, setAutoArchiving] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Master lists
  useEffect(() => {
    API.getLocations()
      .then(res => { if (res?.locations) setLocations(res.locations); })
      .catch(() => {});
  }, []);

  const sess = Auth.get();
  const isAdminRole = ['Admin', 'Super Admin', 'system administrator'].includes(sess?.role || '');
  const isGlobal = isAdminRole && (!sess?.locationId || sess?.isGlobalAdmin === true);
  const effectiveLoc = !isGlobal ? (sess?.locationId || 3) : (locationFilter !== '' ? locationFilter : undefined);

  useEffect(() => {
    API.getWeddingTelecallers(effectiveLoc)
      .then(res => { if (res?.telecallers) setTelecallers(res.telecallers); })
      .catch(() => {});
  }, [effectiveLoc]);

  // Listen to Topbar branch switch
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

  // Real-time synchronization
  useRealtimeSection(['wedding', 'wedding_reg'], () => {
    loadOldCustomers();
  });

  const loadOldCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
        search: debouncedSearch.trim() || undefined,
        location_id: effectiveLoc,
        telecaller_id: telecallerFilter || undefined,
        previous_status: previousStatusFilter || undefined,
        date_filter: dateFilter !== 'all' ? dateFilter : undefined,
        archived_from: fromDate || undefined,
        archived_to: toDate || undefined,
        sort_by: sortBy,
        sort_order: sortOrder
      };

      const res = await API.getWeddingOldCustomers(params);

      if (res?.customers) {
        setCustomers(res.customers);
        setTotalCount(res.pagination?.total ?? res.total ?? res.customers.length);
        if (res.stats) {
          setStats(res.stats);
        }
      }
    } catch (err: any) {
      showToast('Error loading old customers: ' + (err.message || 'Server error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [pageSize, currentPage, debouncedSearch, effectiveLoc, telecallerFilter, previousStatusFilter, dateFilter, fromDate, toDate, sortBy, sortOrder]);

  useEffect(() => {
    loadOldCustomers();
  }, [loadOldCustomers]);

  // Handle Restore Customer Action
  const handleRestore = async () => {
    if (!customerToRestore) return;
    setRestoring(true);
    try {
      await API.restoreWeddingOldCustomer(customerToRestore.id);
      showToast(`Customer "${customerToRestore.customer_name}" restored to active customer list successfully.`, 'success');
      setCustomerToRestore(null);
      loadOldCustomers();
    } catch (err: any) {
      showToast('Failed to restore customer: ' + (err.message || 'Server error'), 'error');
    } finally {
      setRestoring(false);
    }
  };

  // Handle Automated Old Customer Archival Run
  const handleAutoArchive = async () => {
    if (!window.confirm('Run automated lifecycle check? This will identify completed wedding journeys (shopping confirmed / visited >14 days after wedding) and move them to Old Customers.')) {
      return;
    }
    setAutoArchiving(true);
    try {
      const res = await API.autoArchiveWeddingCustomers();
      showToast(res.message || `Lifecycle scan completed. ${res.count || 0} customer(s) moved to Old Customers.`, 'success');
      loadOldCustomers();
    } catch (err: any) {
      showToast('Auto-archive check failed: ' + (err.message || 'Server error'), 'error');
    } finally {
      setAutoArchiving(false);
    }
  };

  // Handle Export to Excel (.xlsx)
  const handleExport = async () => {
    setExporting(true);
    try {
      const queryParams: any = {
        search: debouncedSearch.trim() || undefined,
        location_id: effectiveLoc,
        telecaller_id: telecallerFilter || undefined,
        previous_status: previousStatusFilter || undefined
      };
      const cleanParams: any = {};
      Object.keys(queryParams).forEach(k => {
        if (queryParams[k] !== undefined && queryParams[k] !== '') cleanParams[k] = queryParams[k];
      });
      const q = new URLSearchParams(cleanParams).toString();
      const token = Auth.getToken();
      
      const response = await fetch(`/api/wedding-crm/old-customers/export${q ? `?${q}` : ''}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Export request failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BSC_Old_Customers_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast('Old Customers exported successfully.', 'success');
    } catch (err: any) {
      showToast('Export failed: ' + (err.message || 'Server error'), 'error');
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <DashboardLayout title="Old Customers · Wedding Concierge & CRM">
      <PageContainer maxWidth="full">
        <ToastContainer />
        <div className="space-y-6">

          {/* Navigation Bar */}
          <WeddingNav
            currentPageTitle="Old Customers"
            breadcrumbs={[
              { label: 'Wedding CRM', href: '/wedding-crm/dashboard' },
              { label: 'Old Customers' }
            ]}
            actions={
              <div className="flex items-center gap-2 flex-wrap">
                {/* Auto-Archive Button for authorized staff */}
                {(isGlobal || ['Admin', 'Super Admin', 'Wedding Collection Manager', 'Manager'].includes(session?.role || '')) && (
                  <button
                    type="button"
                    onClick={handleAutoArchive}
                    disabled={autoArchiving}
                    className="px-3.5 py-2 bg-[#FFFFFF] hover:bg-[#EDF3F0] border border-[#E1DDD3] rounded-xl text-xs font-semibold text-[#123C35] flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                    title="Automatically scan and move completed wedding journeys to Old Customers"
                  >
                    <Sparkles className={`w-3.5 h-3.5 text-[#C9A45C] ${autoArchiving ? 'animate-spin' : ''}`} />
                    <span>{autoArchiving ? 'Scanning...' : 'Auto-Identify Old Customers'}</span>
                  </button>
                )}

                {/* Export Button */}
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={exporting || customers.length === 0}
                  className="px-3.5 py-2 bg-[#123C35] hover:bg-[#082821] text-[#FAF7F2] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                  title="Export Old Customers to Excel"
                >
                  <Download className={`w-3.5 h-3.5 text-[#E4CB92] ${exporting ? 'animate-spin' : ''}`} />
                  <span>{exporting ? 'Exporting...' : 'Export Excel'}</span>
                </button>
              </div>
            }
          />

          {/* Top KPI & Summary Cards — factual counts straight from stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
            <div className="bg-[#FFFFFF] p-4 rounded-2xl border border-[#E1DDD3] shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FAF0E6] text-[#123C35] flex items-center justify-center shrink-0 border border-[#E1DDD3]">
                <Archive className="w-5 h-5 text-[#C9A45C]" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-[#65716C] uppercase tracking-wider block">Total Old Customers</span>
                <span className="text-xl font-black text-[#123C35] leading-tight">{stats.totalOldCustomers || totalCount}</span>
                <span className="text-[10px] text-[#9A858D] block">Historical CRM Records</span>
              </div>
            </div>

            {/* One card per store — 0 when that store has no archived rows yet */}
            {STORE_CARDS.map((store) => (
              <div key={store.code} className="bg-[#FFFFFF] p-4 rounded-2xl border border-[#E1DDD3] shadow-xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFF4D6] text-[#C58A18] flex items-center justify-center shrink-0 border border-[#C58A18]/20">
                  <Building2 className="w-5 h-5 text-[#C58A18]" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-bold text-[#65716C] uppercase tracking-wider block">{store.label}</span>
                  <span className="text-xl font-black text-[#123C35] leading-tight">
                    {storeArchiveCount(stats, store.code, store.label)}
                  </span>
                  <span className="text-[10px] text-[#9A858D] block">Old Customers · {store.code}</span>
                </div>
              </div>
            ))}

            <div className="bg-[#FFFFFF] p-4 rounded-2xl border border-[#E1DDD3] shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#E8F5EE] text-[#198754] flex items-center justify-center shrink-0 border border-[#198754]/20">
                <CheckCircle2 className="w-5 h-5 text-[#198754]" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-[#65716C] uppercase tracking-wider block">Completed This Month</span>
                <span className="text-xl font-black text-[#198754] leading-tight">
                  {stats.completedThisMonth ?? stats.archivedThisMonth ?? 0}
                </span>
                <span className="text-[10px] text-[#65716C] block">Journeys Closed This Month</span>
              </div>
            </div>

            <div className="bg-[#FFFFFF] p-4 rounded-2xl border border-[#E1DDD3] shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#EDF3F0] text-[#C9A45C] flex items-center justify-center shrink-0 border border-[#E1DDD3]">
                <Calendar className="w-5 h-5 text-[#C9A45C]" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-[#65716C] uppercase tracking-wider block">Completed This Year</span>
                <span className="text-xl font-black text-[#123C35] leading-tight">
                  {stats.completedThisYear ?? stats.archivedThisYear ?? 0}
                </span>
                <span className="text-[10px] text-[#65716C] block">Journeys Closed This Year</span>
              </div>
            </div>
          </div>

          {/* Search, Filter & Quick Action Bar */}
          <div className="bg-[#FFFFFF] p-4 rounded-2xl border border-[#E1DDD3] shadow-xs space-y-3">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#9A858D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search Old Customers by ID, Name, Mobile, Email, Wedding City, Store..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-[#F7F5F0] border border-[#E1DDD3] rounded-xl text-xs font-semibold text-[#17201D] placeholder:text-[#9A858D] focus:outline-none focus:border-[#C9A45C] focus:bg-white transition-all shadow-inner"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#9A858D] hover:text-[#123C35]"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Store Location Filter (Only for Global Admins) */}
              {isGlobal && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] font-bold text-[#65716C] uppercase">Store:</span>
                  <select
                    value={locationFilter}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Number(e.target.value);
                      setLocationFilter(val);
                      setCurrentPage(1);
                    }}
                    className="px-3 py-2 bg-[#F7F5F0] border border-[#E1DDD3] rounded-xl text-xs font-bold text-[#17201D] focus:outline-none focus:border-[#C9A45C]"
                  >
                    <option value="">All Locations</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.location_name} ({loc.location_code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Previous Status Filter */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] font-bold text-[#65716C] uppercase">Status:</span>
                <select
                  value={previousStatusFilter}
                  onChange={(e) => {
                    setPreviousStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 bg-[#F7F5F0] border border-[#E1DDD3] rounded-xl text-xs font-bold text-[#17201D] focus:outline-none focus:border-[#C9A45C]"
                >
                  <option value="">All Statuses</option>
                  <option value="Converted">Converted</option>
                  <option value="Visited">Visited Store</option>
                  <option value="Shopping Confirmed">Shopping Confirmed</option>
                  <option value="Shopping Planned">Shopping Planned</option>
                  <option value="Follow-up Scheduled">Follow-up Scheduled</option>
                  <option value="Not Interested">Not Interested</option>
                  <option value="Closed">Closed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              {/* Assigned Telecaller Filter */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] font-bold text-[#65716C] uppercase">Telecaller:</span>
                <select
                  value={telecallerFilter}
                  onChange={(e) => {
                    setTelecallerFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 bg-[#F7F5F0] border border-[#E1DDD3] rounded-xl text-xs font-bold text-[#17201D] focus:outline-none focus:border-[#C9A45C]"
                >
                  <option value="">All Telecallers</option>
                  {telecallers.map((tc) => (
                    <option key={tc.id} value={tc.id}>
                      {tc.name || tc.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Refresh Button */}
              <button
                type="button"
                onClick={loadOldCustomers}
                className="p-2 bg-[#F7F5F0] hover:bg-[#EDF3F0] border border-[#E1DDD3] rounded-xl text-[#123C35] transition-colors cursor-pointer shrink-0"
                title="Refresh Old Customers List"
              >
                <RefreshCw className={`w-4 h-4 text-[#C9A45C] ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Quick Date Filters row */}
            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-[#E1DDD3]/50 text-xs">
              <span className="text-[11px] font-bold text-[#65716C] uppercase">Completed Date:</span>
              {[
                { key: 'all', label: 'All Time' },
                { key: 'today', label: 'Today' },
                { key: 'this_week', label: 'This Week' },
                { key: 'this_month', label: 'This Month' },
                { key: 'last_month', label: 'Last Month' }
              ].map(f => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => { setDateFilter(f.key); setCurrentPage(1); }}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    dateFilter === f.key
                      ? 'bg-[#123C35] text-white shadow-xs'
                      : 'bg-[#F7F5F0] text-[#65716C] hover:text-[#123C35] border border-[#E1DDD3]'
                  }`}
                >
                  {f.label}
                </button>
              ))}

              <div className="ml-auto text-xs text-[#65716C] font-semibold">
                Showing <span className="font-bold text-[#123C35]">{customers.length}</span> of <span className="font-bold text-[#123C35]">{totalCount}</span> Old Customers
              </div>
            </div>
          </div>

          {/* Old Customers Main Table */}
          <div className="bg-[#FFFFFF] rounded-2xl border border-[#E1DDD3] shadow-xs overflow-hidden">
            <div className="table-frame custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#FAF0E6] text-[#123C35] font-black border-b border-[#E1DDD3] text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4">Customer ID</th>
                    <th className="py-3 px-4">Customer Name</th>
                    <th className="py-3 px-4">Mobile</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Store Location</th>
                    <th className="py-3 px-4">Wedding Date</th>
                    <th className="py-3 px-4">Shopping Date</th>
                    <th className="py-3 px-4">Shopping Category</th>
                    <th className="py-3 px-4">Family Size</th>
                    <th className="py-3 px-4">Previous Status</th>
                    <th className="py-3 px-4">Assigned Telecaller</th>
                    <th className="py-3 px-4">Total Calls</th>
                    <th className="py-3 px-4">Last Call</th>
                    <th className="py-3 px-4">Completed Date</th>
                    <th className="py-3 px-4">Completed By</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E1DDD3] bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan={16} className="py-16 text-center text-[#65716C]">
                        <RefreshCw className="w-6 h-6 animate-spin text-[#C9A45C] mx-auto mb-2" />
                        <span className="font-bold">Loading Old Customers...</span>
                      </td>
                    </tr>
                  ) : customers.length === 0 ? (
                    <tr>
                      <td colSpan={16} className="py-16 text-center text-[#65716C]">
                        <Archive className="w-10 h-10 text-[#C9A45C]/50 mx-auto mb-3" />
                        <h3 className="font-black text-sm text-[#123C35]">No Old Customers Found</h3>
                        <p className="text-xs text-[#8B776A] mt-1">
                          Completed or archived customers will appear here.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    customers.map((cust) => {
                      const displayStatus = cust.previous_status || cust.customer_status || 'Archived';
                      const badge = getStatusBadge(displayStatus);
                      // Completed Date = archived_at, with the backend's computed
                      // display_archived_at (COALESCE(archived_at, updated_at)) as
                      // the safety net for legacy rows.
                      const completedAt = cust.display_archived_at || cust.archived_at || cust.updated_at || null;

                      return (
                        <tr
                          key={cust.id}
                          className="hover:bg-[#EDF3F0]/60 transition-colors group"
                        >
                          {/* Customer ID */}
                          <td className="py-3 px-4 font-mono font-bold text-[#123C35]">
                            {cust.customer_code || `BSC-${cust.id}`}
                          </td>

                          {/* Customer Name */}
                          <td className="py-3 px-4">
                            <Link
                              to={`/wedding-crm/customers/${cust.id}`}
                              className="font-bold text-[#17201D] hover:text-[#C9A45C] transition-colors flex items-center gap-1.5"
                            >
                              <span>{cust.customer_name}</span>
                              <Eye className="w-3 h-3 text-[#C9A45C] opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Link>
                            {cust.wedding_city && (
                              <span className="text-[10px] text-[#8B776A] block">
                                {cust.wedding_city}
                              </span>
                            )}
                          </td>

                          {/* Mobile */}
                          <td className="py-3 px-4 font-semibold text-[#17201D]">
                            <div className="flex items-center gap-1.5">
                              <span>{cust.mobile_number}</span>
                              <a
                                href={`https://wa.me/91${cust.mobile_number.replace(/\D/g, '')}?text=Namaste%20${encodeURIComponent(cust.customer_name)}%2C%20greetings%20from%20BSC%20Exclusive%20Textiles!`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#198754] hover:opacity-80"
                                title="WhatsApp"
                              >
                                <Phone className="w-3 h-3" />
                              </a>
                            </div>
                          </td>

                          {/* Email */}
                          <td className="py-3 px-4 font-medium text-[#17201D]">
                            {cust.email ? (
                              <a
                                href={`mailto:${cust.email}`}
                                className="inline-flex items-center gap-1.5 text-[#123C35] hover:text-[#C9A45C] transition-colors"
                                title={cust.email}
                              >
                                <Mail className="w-3 h-3 shrink-0 text-[#C9A45C]" />
                                <span className="truncate max-w-[150px] inline-block align-bottom">{cust.email}</span>
                              </a>
                            ) : (
                              <span className="text-[#9A858D]">Not Recorded</span>
                            )}
                          </td>

                          {/* Store Location */}
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EDF3F0] border border-[#E1DDD3] text-[#123C35] font-semibold text-[10.5px]">
                              <MapPin className="w-2.5 h-2.5 text-[#C9A45C]" />
                              {cust.location_name || 'Store'}
                            </span>
                          </td>

                          {/* Wedding Date */}
                          <td className="py-3 px-4 font-medium text-[#17201D] whitespace-nowrap">
                            <span className={cust.wedding_date ? '' : 'text-[#9A858D]'}>
                              {formatDateDisplay(cust.wedding_date, 'Not Recorded')}
                            </span>
                          </td>

                          {/* Shopping Date */}
                          <td className="py-3 px-4 font-medium text-[#17201D] whitespace-nowrap">
                            <span className={cust.expected_shopping_date ? '' : 'text-[#9A858D]'}>
                              {formatDateDisplay(cust.expected_shopping_date, 'Not Recorded')}
                            </span>
                          </td>

                          {/* Shopping Category */}
                          <td className="py-3 px-4 font-medium text-[#17201D]">
                            {cust.preferred_shopping_category ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#FAF0E6] border border-[#E1DDD3] text-[#123C35] font-semibold text-[10.5px]">
                                {cust.preferred_shopping_category}
                              </span>
                            ) : (
                              <span className="text-[#9A858D]">Not Recorded</span>
                            )}
                          </td>

                          {/* Family Size */}
                          <td className="py-3 px-4 font-medium text-[#17201D]">
                            {cust.estimated_family_size ? (
                              <span className="font-semibold">{cust.estimated_family_size}</span>
                            ) : (
                              <span className="text-[#9A858D]">Not Recorded</span>
                            )}
                          </td>

                          {/* Previous Customer Status */}
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                              {displayStatus}
                            </span>
                          </td>

                          {/* Assigned Telecaller */}
                          <td className="py-3 px-4 font-medium text-[#17201D]">
                            {cust.assigned_telecaller && cust.assigned_telecaller !== 'Auto-Assigned' ? (
                              <span className="font-semibold text-[#123C35]">{cust.assigned_telecaller}</span>
                            ) : (
                              <span className="text-[#9A858D]">Unassigned</span>
                            )}
                          </td>

                          {/* Total Calls */}
                          <td className="py-3 px-4 font-medium text-[#17201D]">
                            <span className="font-bold text-[#123C35]">{Number(cust.total_calls_count) || 0}</span>
                          </td>

                          {/* Last Call */}
                          <td className="py-3 px-4 font-medium text-[#17201D] whitespace-nowrap">
                            <span className={cust.last_call_date ? '' : 'text-[#9A858D]'}>
                              {formatDateDisplay(cust.last_call_date, 'No Calls')}
                            </span>
                          </td>

                          {/* Completed Date (DATETIME) */}
                          <td className="py-3 px-4 text-[#65716C] font-medium whitespace-nowrap">
                            <span className={completedAt ? '' : 'text-[#9A858D]'}>
                              {formatDateTimeDisplay(completedAt, 'Not Recorded')}
                            </span>
                          </td>

                          {/* Completed By */}
                          <td className="py-3 px-4 text-[#65716C] font-medium">
                            <span className="truncate max-w-[120px] block" title={cust.archived_by || 'Staff'}>
                              {cust.archived_by || 'Staff'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right whitespace-nowrap border-l border-[#E1DDD3] align-middle">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              {/* View Full Profile */}
                              <Link
                                to={`/wedding-crm/customers/${cust.id}`}
                                className="px-2.5 py-1.5 rounded-xl bg-[#EDF3F0] hover:bg-[#FAF0E6] text-[#123C35] border border-[#E1DDD3] font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                                title="View Customer Profile"
                              >
                                <Eye className="w-3.5 h-3.5 text-[#C9A45C]" />
                                <span>View</span>
                              </Link>

                              {/* Restore Customer */}
                              <button
                                type="button"
                                onClick={() => setCustomerToRestore(cust)}
                                className="px-2.5 py-1.5 rounded-xl bg-[#E8F5EE] hover:bg-[#198754]/20 text-[#198754] border border-[#198754]/30 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                                title="Restore Customer to Active List"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Restore</span>
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

            {/* Pagination Bar */}
            <div className="p-4 border-t border-[#E1DDD3] bg-[#F7F5F0] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[#65716C]">Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 bg-white border border-[#E1DDD3] rounded-lg text-xs font-semibold text-[#17201D]"
                >
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-[#65716C] ml-2">
                  Page {currentPage} of {totalPages}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage <= 1 || loading}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-[#E1DDD3] bg-white text-[#123C35] hover:bg-[#EDF3F0] disabled:opacity-40 transition-colors cursor-pointer"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let p = i + 1;
                  if (totalPages > 5 && currentPage > 3) {
                    p = currentPage - 2 + i;
                    if (p > totalPages) p = totalPages - 4 + i;
                  }
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCurrentPage(p)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        currentPage === p
                          ? 'bg-[#123C35] text-white shadow-xs'
                          : 'border border-[#E1DDD3] bg-white text-[#65716C] hover:bg-[#EDF3F0]'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}

                <button
                  type="button"
                  disabled={currentPage >= totalPages || loading}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-[#E1DDD3] bg-white text-[#123C35] hover:bg-[#EDF3F0] disabled:opacity-40 transition-colors cursor-pointer"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Restore Customer Confirmation Modal */}
          {customerToRestore && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
              <div className="bg-[#FFFFFF] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#E1DDD3] space-y-4 animate-scale-in">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[#E8F5EE] text-[#198754] flex items-center justify-center shrink-0 border border-[#198754]/30">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#123C35]">Restore Customer</h3>
                    <p className="text-xs text-[#65716C]">Return this customer to the active CRM list.</p>
                  </div>
                </div>

                <div className="p-4 bg-[#F7F5F0] rounded-2xl border border-[#E1DDD3] space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#65716C]">Customer Name:</span>
                    <strong className="text-[#17201D]">{customerToRestore.customer_name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#65716C]">Customer ID:</span>
                    <strong className="text-[#123C35] font-mono">{customerToRestore.customer_code}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#65716C]">Store Location:</span>
                    <span className="font-semibold text-[#17201D]">{customerToRestore.location_name || 'Store'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#65716C]">Will Restore With Status:</span>
                    <span className="font-bold text-[#198754]">
                      {customerToRestore.previous_status || customerToRestore.customer_status || 'Follow-up Pending'}
                    </span>
                  </div>
                </div>

                <p className="text-[11.5px] text-[#65716C] leading-relaxed">
                  All previous call history, status history, notes, and profile details will remain completely intact. No duplicate record will be created.
                </p>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E1DDD3]">
                  <button
                    type="button"
                    disabled={restoring}
                    onClick={() => setCustomerToRestore(null)}
                    className="px-4 py-2 rounded-xl bg-[#F7F5F0] hover:bg-[#EDF3F0] border border-[#E1DDD3] font-semibold text-[#123C35] text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={restoring}
                    onClick={handleRestore}
                    className="px-5 py-2 rounded-xl bg-[#198754] hover:bg-[#157347] text-white font-semibold text-xs shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {restoring ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Restoring...</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore Customer</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </PageContainer>
    </DashboardLayout>
  );
}
