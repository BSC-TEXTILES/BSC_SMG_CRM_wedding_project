import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import PageContainer from '../../components/ui/PageContainer';
import { API, Auth, UserSession } from '../../services/api';
import { formatDateDisplay } from '../../utils/dateUtils';
import WeddingNav from './WeddingNav';
import { getStatusBadge } from './weddingTypes';
import LocationFilterSelect from '../../components/ui/LocationFilterSelect';
import { useLocationContext } from '../../context/LocationContext';
import { getSidebarCollapsed, subscribeSidebarCollapsed } from '../../utils/sidebarState';
import { useRealtimeSection } from '../../hooks/useRealtimeSection';
import ToastContainer, { showToast } from '../../components/Toast';
import { 
  Users, UserPlus, PhoneCall, Calendar, Sparkles, TrendingUp, MapPin, Clock, 
  PhoneForwarded, CircleCheck, TriangleAlert, Award, ArrowRight, ChevronRight, 
  ShoppingBag, RefreshCw, History, MessageCircle, Phone, Search, Filter, Copy, 
  Check, ExternalLink, Heart, AlertCircle, Eye, Tag, ChevronDown, CheckCircle2,
  X
} from 'lucide-react';
import WeddingCustomerFlowModal from '../../components/wedding/WeddingCustomerFlowModal';

function getDaysUntil(dateStr?: string | null): { text: string; color: string; isPast: boolean } | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return { text: 'Today! 💍', color: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold', isPast: false };
  if (diffDays === 1) return { text: 'Tomorrow', color: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold', isPast: false };
  if (diffDays > 1) return { text: `In ${diffDays} days`, color: diffDays <= 30 ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold' : 'bg-[#EDF3F0] text-[#123C35] border-[#E1DDD3]', isPast: false };
  return { text: `${Math.abs(diffDays)}d ago`, color: 'bg-gray-100 text-gray-600 border-gray-200', isPast: true };
}

function formatPhoneDisplay(phone?: string | null): string {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 10) {
    return `${clean.slice(0, 5)} ${clean.slice(5)}`;
  }
  return phone;
}

export default function WeddingCrmDashboard() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(() => Auth.get());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(getSidebarCollapsed());

  useEffect(() => {
    return subscribeSidebarCollapsed(setCollapsed);
  }, []);

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCustomers: 0,
    todayNewCustomers: 0,
    newRequests: 0,
    activeLeads: 0,
    interestedCustomers: 0,
    todayFollowUps: 0,
    overdueFollowUps: 0,
    callsPending: 0,
    callsCompleted: 0,
    connectedCalls: 0,
    missedCalls: 0,
    callbackRequests: 0,
    shoppingConfirmed: 0,
    visitedConverted: 0,
    convertedCustomers: 0,
    lostCustomers: 0,
    notInterested: 0,
    todayAppointments: 0
  });

  const { currentLocation, isGlobalAdmin: globalAdminFromContext } = useLocationContext();

  const [enhancedStats, setEnhancedStats] = useState<any>(null);
  const [locationCards, setLocationCards] = useState<any[]>([]);
  const [pipelineData, setPipelineData] = useState<any>(null);
  const [upcomingWeddings, setUpcomingWeddings] = useState<any[]>([]);
  const [telecallerPerformance, setTelecallerPerformance] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [recentCallLogs, setRecentCallLogs] = useState<any[]>([]);
  const [flowModalOpen, setFlowModalOpen] = useState(false);
  const [selectedCustomerForFlow, setSelectedCustomerForFlow] = useState<any>(null);

  // Live Wedding Customer Flow & Call Activity Stream state
  const [streamCustomers, setStreamCustomers] = useState<any[]>([]);
  const [streamTotal, setStreamTotal] = useState<number>(0);
  const [streamLoading, setStreamLoading] = useState<boolean>(false);
  const [streamSearch, setStreamSearch] = useState<string>('');
  const [streamStatus, setStreamStatus] = useState<string>('all');
  const [streamViewMode, setStreamViewMode] = useState<'all' | 'calls_only'>('all');
  const [streamPage, setStreamPage] = useState<number>(1);
  const [streamLimit, setStreamLimit] = useState<number>(12);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const [selectedLocation, setSelectedLocation] = useState<number | ''>(() => {
    const sess = Auth.get();
    const isAdminRole = ['Admin', 'Super Admin', 'system administrator'].includes(sess?.role || '');
    const isGlobal = isAdminRole && (!sess?.locationId || sess?.isGlobalAdmin === true);
    if (!isGlobal && sess?.locationId) {
      return sess.locationId;
    }
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('bsc_selected_location') : null;
    return saved && saved !== 'ALL' ? Number(saved) : '';
  });

  const loadStream = useCallback(async (
    locId?: number | '',
    page = 1,
    limit = 12,
    search = '',
    status = 'all',
    view: 'all' | 'calls_only' = 'all'
  ) => {
    setStreamLoading(true);
    try {
      const sess = Auth.get();
      const isAdminRole = ['Admin', 'Super Admin', 'system administrator'].includes(sess?.role || '');
      const isGlobal = isAdminRole && (!sess?.locationId || sess?.isGlobalAdmin === true);

      let targetLoc: number | undefined;
      if (isGlobal) {
        targetLoc = locId !== undefined && locId !== '' ? Number(locId) : undefined;
      } else {
        targetLoc = sess?.locationId ? Number(sess.locationId) : (locId ? Number(locId) : 3);
      }

      const res = await API.getWeddingCustomerFlowStream({
        location_id: targetLoc,
        search: search.trim() || undefined,
        status: status !== 'all' ? status : undefined,
        view,
        page,
        limit
      }).catch(async () => {
        return API.getWeddingCustomers({
          location_id: targetLoc,
          search: search.trim() || undefined,
          status: status !== 'all' ? status : undefined,
          page,
          limit
        }).catch(() => null);
      });

      const list = res?.customers || res?.data?.customers || res?.data || [];
      const total = res?.total || res?.data?.total || list.length;
      setStreamCustomers(Array.isArray(list) ? list : []);
      setStreamTotal(total || 0);
    } catch (err: any) {
      console.warn('[loadStream error]', err);
    } finally {
      setStreamLoading(false);
    }
  }, []);

  const loadData = useCallback(async (locId?: number | '') => {
    setLoading(true);
    try {
      const sess = Auth.get();
      const isAdminRole = ['Admin', 'Super Admin', 'system administrator'].includes(sess?.role || '');
      const isGlobal = isAdminRole && (!sess?.locationId || sess?.isGlobalAdmin === true);

      let targetLoc: number | undefined;
      if (isGlobal) {
        targetLoc = locId !== undefined && locId !== '' ? Number(locId) : undefined;
      } else {
        targetLoc = sess?.locationId ? Number(sess.locationId) : (locId ? Number(locId) : 3);
      }

      const [statsRes, enhRes, locsRes, perfRes, pipeRes, upRes, logsRes] = await Promise.all([
        API.getWeddingStats(targetLoc).catch(() => null),
        API.getWeddingEnhancedDashboard(targetLoc).catch(() => null),
        API.getLocations().catch(() => ({ locations: [] })),
        API.getWeddingEmployeePerformance(targetLoc).catch(() => null),
        API.getWeddingPipeline(targetLoc).catch(() => null),
        API.getWeddingUpcoming(30, targetLoc).catch(() => null),
        API.getWeddingExportData({ type: 'call_logs', location_id: targetLoc }).catch(() => null)
      ]);

      if (statsRes?.data) setStats(statsRes.data);
      if (enhRes?.data) {
        setEnhancedStats(enhRes.data);
        const rawBreakdown = enhRes.data.locationBreakdown || enhRes.data.locationCards || [];
        if (Array.isArray(rawBreakdown)) {
          if (!isGlobal && targetLoc) {
            setLocationCards(rawBreakdown.filter((c: any) => Number(c.location_id || c.id) === targetLoc));
          } else {
            setLocationCards(rawBreakdown);
          }
        }
      }
      if (locsRes?.locations) setLocations(locsRes.locations);
      if (perfRes?.data) setTelecallerPerformance(Array.isArray(perfRes.data) ? perfRes.data : []);
      if (pipeRes?.data) setPipelineData(pipeRes.data);
      if (upRes?.data) setUpcomingWeddings(Array.isArray(upRes.data) ? upRes.data : []);

      const rawLogs = Array.isArray(logsRes)
        ? logsRes
        : (Array.isArray(logsRes?.data)
            ? logsRes.data
            : (Array.isArray(logsRes?.logs)
                ? logsRes.logs
                : (Array.isArray(logsRes?.records) ? logsRes.records : [])));
      setRecentCallLogs(rawLogs.slice(0, 6));

      // Load customer flow stream with full details
      loadStream(targetLoc, 1, streamLimit, streamSearch, streamStatus, streamViewMode);
    } catch (err: any) {
      showToast('Error loading wedding CRM dashboard: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [loadStream, streamLimit, streamSearch, streamStatus, streamViewMode]);

  // The KPI cards are SQL aggregates over wedding_customers, call logs and
  // appointments, so any CRM mutation has to trigger a re-read for the numbers
  // to stay live without a manual refresh or page reload.
  useRealtimeSection(['wedding', 'wedding_reg', 'callqueue'], () => {
    loadData(selectedLocation);
  });

  // Listen to global location changes (e.g. from Topbar)
  useEffect(() => {
    const handleLocChange = (e: any) => {
      const sess = Auth.get();
      const isAdminRole = ['Admin', 'Super Admin', 'system administrator'].includes(sess?.role || '');
      const isGlobal = isAdminRole && (!sess?.locationId || sess?.isGlobalAdmin === true);
      if (!isGlobal && sess?.locationId) {
        setSelectedLocation(sess.locationId);
        loadData(sess.locationId);
        return;
      }
      const locId = e?.detail?.locationId;
      const parsed = locId && locId !== 'ALL' ? Number(locId) : '';
      setSelectedLocation(parsed);
      loadData(parsed);
    };
    window.addEventListener('bsc_location_changed', handleLocChange);
    return () => window.removeEventListener('bsc_location_changed', handleLocChange);
  }, [loadData]);

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
      setSelectedLocation(sess.locationId);
      loadData(sess.locationId);
    } else {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('bsc_selected_location') : null;
      const initial = saved && saved !== 'ALL' ? Number(saved) : '';
      setSelectedLocation(initial);
      loadData(initial);
    }
  }, [navigate, loadData]);

  const handleStreamSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setStreamPage(1);
    loadStream(selectedLocation, 1, streamLimit, streamSearch, streamStatus, streamViewMode);
  };

  const handleStatusFilterChange = (newStatus: string) => {
    setStreamStatus(newStatus);
    setStreamPage(1);
    loadStream(selectedLocation, 1, streamLimit, streamSearch, newStatus, streamViewMode);
  };

  const handleViewModeChange = (newMode: 'all' | 'calls_only') => {
    setStreamViewMode(newMode);
    setStreamPage(1);
    loadStream(selectedLocation, 1, streamLimit, streamSearch, streamStatus, newMode);
  };

  const handleLimitChange = (newLimit: number) => {
    setStreamLimit(newLimit);
    setStreamPage(1);
    loadStream(selectedLocation, 1, newLimit, streamSearch, streamStatus, streamViewMode);
  };

  const handlePageChange = (newPage: number) => {
    setStreamPage(newPage);
    loadStream(selectedLocation, newPage, streamLimit, streamSearch, streamStatus, streamViewMode);
  };

  const handleCopyPhone = (id: number, phone: string) => {
    if (!phone) return;
    navigator.clipboard?.writeText(phone);
    setCopiedId(id);
    showToast(`Copied phone +91 ${phone} to clipboard`, 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredLocationCards = React.useMemo(() => {
    const isAdminRole = ['Admin', 'Super Admin', 'system administrator'].includes(session?.role || '');
    const isGlobal = globalAdminFromContext && isAdminRole && (!session?.locationId || session?.isGlobalAdmin === true);
    if (!isGlobal) {
      const myLoc = Number(session?.locationId || 3);
      return locationCards.filter((loc: any) => Number(loc.location_id || loc.id) === myLoc);
    }
    if (selectedLocation) {
      return locationCards.filter((loc: any) => Number(loc.location_id || loc.id) === Number(selectedLocation));
    }
    return locationCards;
  }, [locationCards, session, globalAdminFromContext, selectedLocation]);

  return (
    <DashboardLayout
      title="Wedding CRM Dashboard"
      breadcrumbs={[{ label: 'Wedding CRM', href: '/wedding-crm/dashboard' }, { label: 'Dashboard' }]}
    >
      <PageContainer maxWidth="full">
        <div className="space-y-6">
          <ToastContainer />

          <WeddingNav
            currentPageTitle="Wedding CRM Dashboard"
            actions={
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <LocationFilterSelect
                  value={selectedLocation}
                  onChange={(val) => {
                    setSelectedLocation(val);
                    loadData(val);
                  }}
                />
                <button
                  onClick={() => loadData(selectedLocation)}
                  disabled={loading}
                  className="px-3.5 py-2 bg-[#FFFFFF] hover:bg-[#EDF3F0] border border-[#E1DDD3] rounded-xl text-xs font-semibold text-[#123C35] flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#C9A45C]' : 'text-[#C9A45C]'}`} />
                  <span>Refresh</span>
                </button>
                <Link
                  to="/wedding/customer-registration"
                  className="px-4 py-2 bg-[#123C35] hover:bg-[#082821] text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all border border-[#C9A45C]/30"
                >
                  <UserPlus className="w-3.5 h-3.5 text-[#E4CB92]" />
                  <span>Add Customer</span>
                </Link>
              </div>
            }
          />

          {/* KPI Metrics Grid (12 Cards) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {/* 1. Total Leads */}
            <div className="bg-[#FFFFFF] p-4 rounded-2xl border border-[#E1DDD3] shadow-xs relative overflow-hidden group hover:border-[#C9A45C] hover:shadow-sm transition-all">
              <div className="flex items-center justify-between text-[#65716C] mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">Total Leads</span>
                <Users className="w-4 h-4 text-[#C9A45C]" />
              </div>
              <div className="text-2xl font-black text-[#123C35]">{stats.totalCustomers || 0}</div>
              <div className="text-[10px] text-[#9A858D] font-medium mt-1">All registered brides/families</div>
            </div>

            {/* 2. New Leads */}
            <div className="bg-[#FFFFFF] p-4 rounded-2xl border border-[#E1DDD3] shadow-xs relative overflow-hidden group hover:border-[#C9A45C] hover:shadow-sm transition-all">
              <div className="flex items-center justify-between text-[#65716C] mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">New Leads</span>
                <Sparkles className="w-4 h-4 text-[#C9A45C]" />
              </div>
              <div className="text-2xl font-black text-[#082821]">{stats.todayNewCustomers || stats.newRequests || 0}</div>
              <div className="text-[10px] text-[#65716C] font-medium mt-1">Awaiting telecaller reachout</div>
            </div>

            {/* 3. Today's Calls */}
            <div className="bg-[#FFFFFF] p-4 rounded-2xl border border-[#E1DDD3] shadow-xs relative overflow-hidden group hover:border-[#C9A45C] hover:shadow-sm transition-all">
              <div className="flex items-center justify-between text-[#65716C] mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">Today's Calls</span>
                <PhoneCall className="w-4 h-4 text-[#C9A45C]" />
              </div>
              <div className="text-2xl font-black text-[#C58A18]">{stats.todayFollowUps || 0}</div>
              <div className="text-[10px] text-[#65716C] font-medium mt-1">Scheduled for today</div>
            </div>

            {/* 4. Overdue */}
            <div className="bg-[#FFFFFF] p-4 rounded-2xl border border-[#E1DDD3] shadow-xs relative overflow-hidden group hover:border-[#B42318] hover:shadow-sm transition-all">
              <div className="flex items-center justify-between text-[#65716C] mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">Overdue Calls</span>
                <TriangleAlert className="w-4 h-4 text-[#B42318]" />
              </div>
              <div className="text-2xl font-black text-[#B42318]">{stats.overdueFollowUps || 0}</div>
              <div className="text-[10px] text-[#B42318] font-medium mt-1">Requires immediate call</div>
            </div>

            {/* 5. Pending Calls */}
            <div className="bg-[#FFFFFF] p-4 rounded-2xl border border-[#E1DDD3] shadow-xs relative overflow-hidden group hover:border-[#C9A45C] hover:shadow-sm transition-all">
              <div className="flex items-center justify-between text-[#65716C] mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">Pending Calls</span>
                <Clock className="w-4 h-4 text-[#9A858D]" />
              </div>
              <div className="text-2xl font-black text-[#17201D]">{stats.callsPending || 0}</div>
              <div className="text-[10px] text-[#9A858D] font-medium mt-1">In telecaller queue</div>
            </div>

            {/* 6. Connected */}
            <div className="bg-[#FFFFFF] p-4 rounded-2xl border border-[#E1DDD3] shadow-xs relative overflow-hidden group hover:border-[#198754] hover:shadow-sm transition-all">
              <div className="flex items-center justify-between text-[#65716C] mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">Connected</span>
                <CircleCheck className="w-4 h-4 text-[#198754]" />
              </div>
              <div className="text-2xl font-black text-[#198754]">{stats.connectedCalls || stats.callsCompleted || 0}</div>
              <div className="text-[10px] text-[#198754] font-medium mt-1">Successful contact</div>
            </div>

            {/* 7. Callbacks */}
            <div className="bg-[#FFFFFF] p-4 rounded-2xl border border-[#E1DDD3] shadow-xs relative overflow-hidden group hover:border-[#C9A45C] hover:shadow-sm transition-all">
              <div className="flex items-center justify-between text-[#65716C] mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">Callbacks</span>
                <PhoneForwarded className="w-4 h-4 text-[#C9A45C]" />
              </div>
              <div className="text-2xl font-black text-[#123C35]">{stats.callbackRequests || 0}</div>
              <div className="text-[10px] text-[#65716C] font-medium mt-1">Customer requested callback</div>
            </div>

            {/* 8. Shopping Confirmed */}
            <div className="bg-[#FFFFFF] p-4 rounded-2xl border border-[#E1DDD3] shadow-xs relative overflow-hidden group hover:border-[#C9A45C] hover:shadow-sm transition-all">
              <div className="flex items-center justify-between text-[#65716C] mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">Shopping Confirmed</span>
                <Calendar className="w-4 h-4 text-[#C9A45C]" />
              </div>
              <div className="text-2xl font-black text-[#123C35]">{stats.shoppingConfirmed || 0}</div>
              <div className="text-[10px] text-[#65716C] font-medium mt-1">Date locked by customer</div>
            </div>

            {/* 9. Visits Scheduled */}
            <div className="bg-[#FFFFFF] p-4 rounded-2xl border border-[#E1DDD3] shadow-xs relative overflow-hidden group hover:border-[#C9A45C] hover:shadow-sm transition-all">
              <div className="flex items-center justify-between text-[#65716C] mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">Visits Scheduled</span>
                <MapPin className="w-4 h-4 text-[#C9A45C]" />
              </div>
              <div className="text-2xl font-black text-[#082821]">{stats.todayAppointments || 0}</div>
              <div className="text-[10px] text-[#65716C] font-medium mt-1">Store appointments</div>
            </div>

            {/* 10. Visited */}
            <div className="bg-[#FFFFFF] p-4 rounded-2xl border border-[#E1DDD3] shadow-xs relative overflow-hidden group hover:border-[#C9A45C] hover:shadow-sm transition-all">
              <div className="flex items-center justify-between text-[#65716C] mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">Store Visited</span>
                <ShoppingBag className="w-4 h-4 text-[#C9A45C]" />
              </div>
              <div className="text-2xl font-black text-[#123C35]">{stats.visitedConverted || 0}</div>
              <div className="text-[10px] text-[#65716C] font-medium mt-1">Arrived at store</div>
            </div>

            {/* 11. Won */}
            <div className="bg-[#FFFFFF] p-4 rounded-2xl border border-[#E1DDD3] shadow-xs relative overflow-hidden group hover:border-[#198754] hover:shadow-sm transition-all">
              <div className="flex items-center justify-between text-[#65716C] mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">Won / Converted</span>
                <Award className="w-4 h-4 text-[#198754]" />
              </div>
              <div className="text-2xl font-black text-[#198754]">{stats.convertedCustomers || stats.visitedConverted || 0}</div>
              <div className="text-[10px] text-[#198754] font-medium mt-1">Purchase finalized</div>
            </div>

            {/* 12. Not Interested */}
            <div className="bg-[#FFFFFF] p-4 rounded-2xl border border-[#E1DDD3] shadow-xs relative overflow-hidden group hover:border-[#9A858D] hover:shadow-sm transition-all">
              <div className="flex items-center justify-between text-[#65716C] mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">Not Interested</span>
                <Clock className="w-4 h-4 text-[#9A858D]" />
              </div>
              <div className="text-2xl font-black text-[#737373]">{stats.notInterested || 0}</div>
              <div className="text-[10px] text-[#9A858D] font-medium mt-1">Closed / Lost</div>
            </div>
          </div>

          {/* Quick Operations Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/telecaller/desk"
              className="bg-[#FFFFFF] p-5 rounded-2xl border border-[#E1DDD3] hover:border-[#C9A45C] shadow-xs flex items-center justify-between transition-all group hover:shadow-sm"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#FFF4D6] text-[#C58A18] flex items-center justify-center border border-[#E1DDD3]">
                  <PhoneCall className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-[#17201D] group-hover:text-[#123C35]">
                    Open Telecaller Desk
                  </div>
                  <div className="text-xs text-[#65716C]">
                    {stats.todayFollowUps || 0} calls scheduled for today
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-[#9A858D] group-hover:text-[#C9A45C] group-hover:translate-x-1 transition-all" />
            </Link>

            <Link
              to="/wedding-crm/customers"
              className="bg-[#FFFFFF] p-5 rounded-2xl border border-[#E1DDD3] hover:border-[#C9A45C] shadow-xs flex items-center justify-between transition-all group hover:shadow-sm"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#EDF3F0] text-[#123C35] flex items-center justify-center border border-[#E1DDD3]">
                  <Users className="w-5 h-5 text-[#C9A45C]" />
                </div>
                <div>
                  <div className="font-bold text-sm text-[#17201D] group-hover:text-[#123C35]">
                    Browse Customer Register
                  </div>
                  <div className="text-xs text-[#65716C]">
                    {stats.totalCustomers || 0} registered wedding customers
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-[#9A858D] group-hover:text-[#C9A45C] group-hover:translate-x-1 transition-all" />
            </Link>

            <Link
              to="/wedding-crm/calendar"
              className="bg-[#FFFFFF] p-5 rounded-2xl border border-[#E1DDD3] hover:border-[#C9A45C] shadow-xs flex items-center justify-between transition-all group hover:shadow-sm"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#EDF3F0] text-[#082821] flex items-center justify-center border border-[#E1DDD3]">
                  <Calendar className="w-5 h-5 text-[#082821]" />
                </div>
                <div>
                  <div className="font-bold text-sm text-[#17201D] group-hover:text-[#123C35]">
                    Follow-up Calendar
                  </div>
                  <div className="text-xs text-[#65716C]">View upcoming appointments & shopping dates</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-[#9A858D] group-hover:text-[#C9A45C] group-hover:translate-x-1 transition-all" />
            </Link>
          </div>

          {/* Live Customer Journey & Activity Stream */}
          <div className="bg-[#FFFFFF] p-5 sm:p-6 rounded-3xl border border-[#E1DDD3] shadow-xs space-y-5">
            {/* Section Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E1DDD3]">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="w-8 h-8 rounded-xl bg-[#EDF3F0] text-[#C9A45C] flex items-center justify-center border border-[#E1DDD3]">
                    <TrendingUp className="w-4 h-4 text-[#C9A45C]" />
                  </div>
                  <h3 className="text-base font-bold text-[#123C35] tracking-tight flex items-center gap-2">
                    <span>Live Wedding Customer Flow & Call Activity Stream</span>
                  </h3>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Live Stream
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EDF3F0] text-[#123C35] border border-[#E1DDD3]">
                    {streamTotal} Wedding Customers
                  </span>
                </div>
                <p className="text-xs text-[#65716C]">
                  Real-time wedding consultations, full bride & groom profiles, shopping preferences, budget, telecaller notes, and pipeline touchpoints.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => loadStream(selectedLocation, streamPage, streamLimit, streamSearch, streamStatus, streamViewMode)}
                  disabled={streamLoading}
                  className="px-3 py-1.5 rounded-xl bg-[#FFFFFF] hover:bg-[#EDF3F0] border border-[#E1DDD3] text-xs font-semibold text-[#123C35] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  title="Refresh stream data"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-[#C9A45C] ${streamLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>

                <Link
                  to="/wedding-crm/customers"
                  className="px-3.5 py-1.5 rounded-xl bg-[#EDF3F0] hover:bg-[#E1DDD3] border border-[#E1DDD3] text-xs font-bold text-[#123C35] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5 text-[#C9A45C]" />
                  <span>Customer Register</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>

                <Link
                  to="/wedding-crm/calls"
                  className="px-3.5 py-1.5 rounded-xl bg-[#EDF3F0] hover:bg-[#E1DDD3] border border-[#E1DDD3] text-xs font-bold text-[#123C35] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <History className="w-3.5 h-3.5 text-[#C9A45C]" />
                  <span>Call History</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Stream Controls Toolbar: Search & Quick Filters */}
            <div className="space-y-3 bg-[#F7F5F0] p-3.5 sm:p-4 rounded-2xl border border-[#E1DDD3]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Search Bar */}
                <form onSubmit={handleStreamSearch} className="flex-1 min-w-[260px] max-w-lg relative">
                  <Search className="w-4 h-4 text-[#9A858D] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={streamSearch}
                    onChange={(e) => setStreamSearch(e.target.value)}
                    placeholder="Search by customer name, phone, bride, groom, code, city..."
                    className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#FFFFFF] border border-[#E1DDD3] focus:border-[#C9A45C] focus:outline-none text-xs text-[#17201D] placeholder:text-[#9A858D] shadow-2xs"
                  />
                  {streamSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setStreamSearch('');
                        setStreamPage(1);
                        loadStream(selectedLocation, 1, streamLimit, '', streamStatus, streamViewMode);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9A858D] hover:text-[#123C35]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </form>

                {/* View Mode & Page Limit */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* View Mode Toggle */}
                  <div className="inline-flex rounded-xl p-0.5 bg-[#FFFFFF] border border-[#E1DDD3] text-xs">
                    <button
                      type="button"
                      onClick={() => handleViewModeChange('all')}
                      className={`px-3 py-1 rounded-lg font-bold text-xs transition-colors ${
                        streamViewMode === 'all'
                          ? 'bg-[#123C35] text-white shadow-2xs'
                          : 'text-[#65716C] hover:text-[#123C35]'
                      }`}
                    >
                      All Wedding Customers
                    </button>
                    <button
                      type="button"
                      onClick={() => handleViewModeChange('calls_only')}
                      className={`px-3 py-1 rounded-lg font-bold text-xs transition-colors ${
                        streamViewMode === 'calls_only'
                          ? 'bg-[#123C35] text-white shadow-2xs'
                          : 'text-[#65716C] hover:text-[#123C35]'
                      }`}
                    >
                      Recent Calls Stream
                    </button>
                  </div>

                  {/* Limit Selector */}
                  <select
                    value={streamLimit}
                    onChange={(e) => handleLimitChange(Number(e.target.value))}
                    className="px-2.5 py-1.5 rounded-xl bg-[#FFFFFF] border border-[#E1DDD3] text-xs font-semibold text-[#123C35] focus:outline-none cursor-pointer"
                  >
                    <option value={12}>12 per page</option>
                    <option value={24}>24 per page</option>
                    <option value={48}>48 per page</option>
                    <option value={100}>100 per page</option>
                  </select>
                </div>
              </div>

              {/* Status Filter Chips */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1 text-xs">
                <span className="text-[#65716C] font-medium text-[11px] mr-1 flex items-center gap-1">
                  <Filter className="w-3 h-3 text-[#C9A45C]" /> Filter:
                </span>

                {[
                  { key: 'all', label: 'All Customers' },
                  { key: 'New', label: 'New Leads' },
                  { key: 'Contacted', label: 'Contacted' },
                  { key: 'Follow-up Scheduled', label: 'Follow-ups' },
                  { key: 'due_today', label: '📅 Due Today' },
                  { key: 'overdue', label: '⚠️ Overdue' },
                  { key: 'Shopping Date Confirmed', label: 'Shopping Confirmed' },
                  { key: 'Visited Store', label: 'Store Visited' },
                  { key: 'Converted', label: 'Converted' }
                ].map((chip) => {
                  const isActive = streamStatus === chip.key;
                  return (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => handleStatusFilterChange(chip.key)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#C9A45C] text-white shadow-2xs'
                          : 'bg-[#FFFFFF] text-[#65716C] hover:text-[#123C35] border border-[#E1DDD3] hover:border-[#C9A45C]'
                      }`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stream Customer Cards */}
            {streamLoading ? (
              <div className="text-center py-16 text-xs text-[#65716C] bg-[#F7F5F0] rounded-2xl border border-[#E1DDD3] p-6 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-6 h-6 text-[#C9A45C] animate-spin" />
                <span className="font-semibold text-sm text-[#123C35]">Loading live wedding customer flow & activity stream...</span>
              </div>
            ) : streamCustomers.length === 0 ? (
              <div className="text-center py-12 text-xs text-[#65716C] bg-[#F7F5F0] rounded-2xl border border-[#E1DDD3] p-6 space-y-2">
                <p className="font-bold text-sm text-[#123C35]">No wedding customers matched the current filter.</p>
                <p className="text-xs text-[#65716C]">Try adjusting your search query, status chip, or store location filter.</p>
                <button
                  type="button"
                  onClick={() => {
                    setStreamSearch('');
                    setStreamStatus('all');
                    setStreamViewMode('all');
                    loadStream(selectedLocation, 1, streamLimit, '', 'all', 'all');
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-[#123C35] text-white text-xs font-bold hover:bg-[#082821] transition-colors mt-2 cursor-pointer shadow-2xs"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {streamCustomers.map((cust: any, idx: number) => {
                  const badge = getStatusBadge(cust.customer_status || 'New');
                  const cleanPhone = (cust.mobile_number || cust.customer_mobile || '').replace(/\D/g, '');
                  const altPhone = (cust.alternate_mobile || '').replace(/\D/g, '');
                  const weddingCountdown = getDaysUntil(cust.wedding_date);
                  const isVip = (cust.priority || '').toLowerCase() === 'vip';
                  const isHighPriority = (cust.priority || '').toLowerCase() === 'high';
                  const isCopied = copiedId === cust.id;

                  return (
                    <div
                      key={cust.id || idx}
                      className="p-4 sm:p-5 rounded-2xl bg-[#F7F5F0] border border-[#E1DDD3] hover:border-[#C9A45C] shadow-2xs hover:shadow-md transition-all space-y-3.5 flex flex-col justify-between"
                    >
                      {/* Card Top: Customer Identity & Badges */}
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-base text-[#123C35]">{cust.customer_name || 'Wedding Customer'}</span>
                              {isVip && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-amber-400 to-amber-500 text-amber-950 shadow-2xs">
                                  🔥 VIP
                                </span>
                              )}
                              {isHighPriority && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                  ⭐ High
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 flex-wrap text-[11px] text-[#65716C]">
                              <span className="font-mono bg-[#FFFFFF] px-2 py-0.5 rounded-md border border-[#E1DDD3] font-semibold text-[#123C35]">
                                {cust.customer_code || 'BSC-WED'}
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FFFFFF] border border-[#E1DDD3]">
                                <MapPin className="w-3 h-3 text-[#C9A45C]" />
                                <span className="font-medium text-[#17201D]">{cust.location_name || 'Store'}</span>
                              </span>
                            </div>
                          </div>

                          {/* Status Pills */}
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border shadow-2xs ${badge.bg}`}>
                              {cust.customer_status || 'New'}
                            </span>
                            {cust.call_outcome && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-[#EDF3F0] text-[#123C35] border border-[#E1DDD3] max-w-[130px] truncate" title={cust.call_outcome}>
                                {cust.call_outcome}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Direct Contact Row */}
                        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#FFFFFF] border border-[#E1DDD3] text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            <a
                              href={`tel:${cleanPhone}`}
                              className="font-mono font-bold text-[#123C35] hover:text-[#C9A45C] flex items-center gap-1 transition-colors"
                              title="Click to dial"
                            >
                              <Phone className="w-3.5 h-3.5 text-[#198754]" />
                              <span>+91 {formatPhoneDisplay(cleanPhone)}</span>
                            </a>
                            {cleanPhone && (
                              <button
                                type="button"
                                onClick={() => handleCopyPhone(cust.id, cleanPhone)}
                                className="p-1 hover:bg-[#EDF3F0] rounded text-[#9A858D] hover:text-[#123C35] transition-colors cursor-pointer"
                                title="Copy phone"
                              >
                                {isCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-[#9A858D]" />}
                              </button>
                            )}
                            {altPhone && (
                              <span className="text-[10px] text-[#65716C] font-mono">
                                Alt: +91 {formatPhoneDisplay(altPhone)}
                              </span>
                            )}
                          </div>

                          {cust.wedding_city && (
                            <span className="text-[10px] text-[#65716C] font-medium shrink-0">
                              📍 {cust.wedding_city}
                            </span>
                          )}
                        </div>

                        {/* Wedding & Shopping Details Box */}
                        <div className="p-3 rounded-xl bg-[#FFFFFF] border border-[#E1DDD3] text-xs space-y-2">
                          {/* Bride & Groom Row */}
                          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[#E1DDD3]/70">
                            <div className="font-semibold text-xs text-[#C9A45C] flex items-center gap-1.5 flex-wrap">
                              {cust.bride_name ? <span>👰 {cust.bride_name}</span> : <span className="text-[#9A858D] italic text-[11px]">Bride name TBD</span>}
                              <span className="text-[#E1DDD3]">·</span>
                              {cust.groom_name ? <span>🤵 {cust.groom_name}</span> : <span className="text-[#9A858D] italic text-[11px]">Groom name TBD</span>}
                            </div>
                            {weddingCountdown && (
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border shrink-0 ${weddingCountdown.color}`}>
                                {weddingCountdown.text}
                              </span>
                            )}
                          </div>

                          {/* Wedding & Shopping Dates */}
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <span className="text-[10px] text-[#65716C] block">Wedding Date</span>
                              <span className="font-semibold text-[#17201D] flex items-center gap-1 mt-0.5">
                                <Calendar className="w-3 h-3 text-[#C9A45C]" />
                                {formatDateDisplay(cust.wedding_date, 'Date TBD')}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-[#65716C] block">Expected Shopping</span>
                              <span className="font-semibold text-[#17201D] flex items-center gap-1 mt-0.5">
                                <ShoppingBag className="w-3 h-3 text-[#C9A45C]" />
                                {formatDateDisplay(cust.expected_shopping_date || cust.expected_shopping_date_updated, 'Date TBD')}
                              </span>
                            </div>
                          </div>

                          {/* Shopping Category & Budget */}
                          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1.5 border-t border-[#E1DDD3]/60">
                            <div>
                              <span className="text-[10px] text-[#65716C] block">Preferred Category</span>
                              <span className="font-medium text-[#123C35] truncate block mt-0.5" title={cust.preferred_shopping_category || 'General Wedding Shopping'}>
                                👗 {cust.preferred_shopping_category || 'General Shopping'}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-[#65716C] block">Planned Budget</span>
                              <span className="font-bold text-[#198754] block mt-0.5">
                                ₹ {cust.budget || cust.budget_range || 'TBD'}
                              </span>
                            </div>
                          </div>

                          {/* Additional Context: Family & Source */}
                          <div className="flex items-center justify-between text-[10px] text-[#65716C] pt-1.5 border-t border-[#E1DDD3]/60">
                            <span>👥 {cust.estimated_family_size || 1} family members {cust.guest_count ? `· ${cust.guest_count} guests` : ''}</span>
                            <span>🏷️ {cust.lead_source || 'Wedding Registration'}</span>
                          </div>
                        </div>

                        {/* Telecaller Activity & Notes Box */}
                        <div className="p-3 rounded-xl bg-[#EDF3F0] border border-[#E1DDD3] text-xs space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[#65716C] flex items-center gap-1 font-medium">
                              <span>👤</span>
                              <span>{cust.telecaller_name || cust.assigned_telecaller || 'Unassigned Staff'}</span>
                            </span>
                            <span className="text-[10px] text-[#9A858D]">
                              {cust.call_date ? `${formatDateDisplay(cust.call_date)} ${cust.call_time || ''}` : `Reg: ${formatDateDisplay(cust.created_at)}`}
                            </span>
                          </div>

                          {/* Remarks or Notes preview */}
                          {(cust.call_remarks || cust.customer_notes) ? (
                            <p className="text-[11px] text-[#17201D] italic bg-[#FFFFFF] p-2 rounded-lg border border-[#E1DDD3]/70 line-clamp-2">
                              "{cust.call_remarks || cust.customer_notes}"
                            </p>
                          ) : (
                            <p className="text-[10px] text-[#9A858D] italic">
                              No consultation notes recorded yet.
                            </p>
                          )}

                          {/* Next Scheduled Follow-up */}
                          <div className="flex items-center justify-between text-[10px] pt-1">
                            <span className="text-[#65716C] flex items-center gap-1 font-medium">
                              <Clock className="w-3 h-3 text-[#C9A45C]" />
                              <span>Next: {formatDateDisplay(cust.next_follow_up_date || cust.follow_up_date, 'Not scheduled')}</span>
                              {(cust.next_follow_up_time || cust.preferred_call_time) && (
                                <span className="text-[#9A858D]">({cust.next_follow_up_time || cust.preferred_call_time})</span>
                              )}
                            </span>
                            {cust.overdue_days > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold border border-rose-200">
                                ⚠️ {cust.overdue_days}d overdue
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="pt-2 border-t border-[#E1DDD3] flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCustomerForFlow({
                                id: cust.customer_id || cust.id,
                                customer_id: cust.customer_id || cust.id,
                                customer_code: cust.customer_code,
                                customer_name: cust.customer_name,
                                mobile_number: cust.mobile_number || cust.customer_mobile,
                                alternate_mobile: cust.alternate_mobile,
                                bride_name: cust.bride_name,
                                groom_name: cust.groom_name,
                                wedding_date: cust.wedding_date,
                                expected_shopping_date: cust.expected_shopping_date || cust.expected_shopping_date_updated,
                                preferred_shopping_category: cust.preferred_shopping_category,
                                budget: cust.budget || cust.budget_range,
                                location_name: cust.location_name,
                                location_id: cust.location_id,
                                assigned_telecaller: cust.telecaller_name || cust.assigned_telecaller,
                                customer_status: cust.customer_status,
                                priority: cust.priority,
                                wedding_city: cust.wedding_city,
                                customer_notes: cust.customer_notes
                              });
                              setFlowModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-[#123C35] hover:bg-[#082821] text-white rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <TrendingUp className="w-3.5 h-3.5 text-[#E4CB92]" />
                            <span>View Flow</span>
                          </button>

                          <Link
                            to={`/wedding-crm/customers/${cust.customer_id || cust.id}`}
                            className="px-2.5 py-1.5 bg-[#FFFFFF] hover:bg-[#EDF3F0] border border-[#E1DDD3] text-[#123C35] hover:text-[#C9A45C] rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
                            title="Open full customer profile"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#C9A45C]" />
                            <span>Profile</span>
                          </Link>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {cleanPhone && (
                            <>
                              <a
                                href={`https://wa.me/91${cleanPhone}?text=Namaste%20${encodeURIComponent(cust.customer_name || 'Customer')}%2C%20greetings%20from%20BSC%20Exclusive%20Textiles!%20Regarding%20your%20upcoming%20wedding%20celebrations...`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 bg-[#198754] hover:bg-[#16805B] text-white rounded-xl text-xs flex items-center justify-center transition-colors shadow-2xs"
                                title="Send WhatsApp message"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </a>

                              <a
                                href={`tel:${cleanPhone}`}
                                className="p-2 bg-[#123C35] hover:bg-[#082821] text-white rounded-xl text-xs flex items-center justify-center transition-colors shadow-2xs"
                                title="Call customer directly"
                              >
                                <Phone className="w-3.5 h-3.5 text-[#E4CB92]" />
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination Controls Footer */}
            {streamTotal > 0 && (
              <div className="pt-3 border-t border-[#E1DDD3] flex flex-wrap items-center justify-between gap-3 text-xs text-[#65716C]">
                <div>
                  Showing <span className="font-bold text-[#123C35]">{Math.min(streamTotal, (streamPage - 1) * streamLimit + 1)}</span> to{' '}
                  <span className="font-bold text-[#123C35]">{Math.min(streamTotal, streamPage * streamLimit)}</span> of{' '}
                  <span className="font-bold text-[#123C35]">{streamTotal}</span> wedding customers
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={streamPage <= 1 || streamLoading}
                    onClick={() => handlePageChange(streamPage - 1)}
                    className="px-3 py-1.5 rounded-xl border border-[#E1DDD3] bg-[#FFFFFF] hover:bg-[#EDF3F0] font-semibold text-[#123C35] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Previous
                  </button>

                  <span className="px-2 font-mono font-bold text-[#123C35]">
                    Page {streamPage} of {Math.max(1, Math.ceil(streamTotal / streamLimit))}
                  </span>

                  <button
                    type="button"
                    disabled={streamPage >= Math.ceil(streamTotal / streamLimit) || streamLoading}
                    onClick={() => handlePageChange(streamPage + 1)}
                    className="px-3 py-1.5 rounded-xl border border-[#E1DDD3] bg-[#FFFFFF] hover:bg-[#EDF3F0] font-semibold text-[#123C35] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Two-Column Analytics Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Location Performance & Pipeline Summary */}
            <div className="lg:col-span-2 space-y-6">
              {/* Location Cards */}
              <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-[#E1DDD3] shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-[#123C35] uppercase tracking-wider flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#C9A45C]" />
                    <span>Location-wise Customer Distribution</span>
                  </h3>
                  <span className="text-xs font-medium text-[#65716C]">Live Store Data</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {filteredLocationCards.length > 0 ? (
                    filteredLocationCards.map((loc: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-[#F7F5F0] border border-[#E1DDD3] hover:border-[#C9A45C] transition-all"
                      >
                        <div className="font-bold text-xs text-[#17201D] flex items-center justify-between">
                          <span>{loc.location_name || loc.name}</span>
                          <span className="text-[10px] bg-[#FFFFFF] px-2 py-0.5 rounded-full border border-[#E1DDD3] font-semibold text-[#123C35]">
                            {loc.customer_count || loc.total_customers || loc.count || 0} leads
                          </span>
                        </div>
                        <div className="mt-2 text-xs space-y-1 text-[#65716C]">
                          <div className="flex justify-between">
                            <span>Confirmed:</span>
                            <span className="font-semibold text-[#123C35]">{loc.confirmed_count || loc.purchases || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Visited / Won:</span>
                            <span className="font-semibold text-[#198754]">{loc.won_count || loc.visits || 0}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-3 text-center py-6 text-xs text-[#9A858D]">
                      No location data available for your assigned scope.
                    </div>
                  )}
                </div>
              </div>

              {/* Conversion Pipeline Flow */}
              <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-[#E1DDD3] shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-[#123C35] uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#C9A45C]" />
                    <span>Conversion Funnel & Status Pipeline</span>
                  </h3>
                  <Link
                    to="/wedding-crm/pipeline"
                    className="text-xs font-semibold text-[#C9A45C] hover:text-[#123C35] hover:underline flex items-center gap-1"
                  >
                    View Status Board <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                  <div className="p-3 rounded-xl bg-[#EDF3F0] border border-[#E1DDD3]">
                    <div className="text-[10px] font-bold text-[#082821] uppercase">1. New Leads</div>
                    <div className="text-lg font-black text-[#082821] mt-1">{stats.newRequests || stats.todayNewCustomers || 0}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#FFF4D6] border border-[#E1DDD3]">
                    <div className="text-[10px] font-bold text-[#C58A18] uppercase">2. Contacted</div>
                    <div className="text-lg font-black text-[#C58A18] mt-1">{stats.connectedCalls || 0}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#EDF3F0] border border-[#E1DDD3]">
                    <div className="text-[10px] font-bold text-[#123C35] uppercase">3. Shopping Confirmed</div>
                    <div className="text-lg font-black text-[#123C35] mt-1">{stats.shoppingConfirmed || 0}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F7F5F0] border border-[#E1DDD3]">
                    <div className="text-[10px] font-bold text-[#C9A45C] uppercase">4. Store Visited</div>
                    <div className="text-lg font-black text-[#C9A45C] mt-1">{stats.visitedConverted || 0}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#E8F5EE] border border-[#E1DDD3]">
                    <div className="text-[10px] font-bold text-[#198754] uppercase">5. Won / Converted</div>
                    <div className="text-lg font-black text-[#198754] mt-1">{stats.convertedCustomers || stats.visitedConverted || 0}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Telecaller Performance & Upcoming Weddings */}
            <div className="space-y-6">
              {/* Telecaller Performance Leaderboard */}
              <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-[#E1DDD3] shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-[#123C35] uppercase tracking-wider flex items-center gap-2">
                    <PhoneCall className="w-4 h-4 text-[#C9A45C]" />
                    <span>Telecaller Performance</span>
                  </h3>
                  <Link to="/wedding-crm/reports" className="text-xs font-semibold text-[#C9A45C] hover:text-[#123C35]">
                    Details
                  </Link>
                </div>

                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {telecallerPerformance.length > 0 ? (
                    telecallerPerformance.map((caller: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-[#F7F5F0] border border-[#E1DDD3] flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-[#17201D]">{caller.name || caller.telecaller_name}</div>
                          <div className="text-[10px] text-[#65716C]">{caller.location_name || 'Store Operations'}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-black text-[#198754]">{caller.calls_today || caller.total_calls || 0} calls</div>
                          <div className="text-[10px] text-[#65716C]">{caller.converted || 0} won</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-xs text-[#9A858D]">
                      No telecaller metrics recorded yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Upcoming Weddings */}
              <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-[#E1DDD3] shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-[#123C35] uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#C9A45C]" />
                    <span>Upcoming Weddings</span>
                  </h3>
                  <Link to="/wedding-crm/customers" className="text-xs font-semibold text-[#C9A45C] hover:text-[#123C35]">
                    View All
                  </Link>
                </div>

                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {upcomingWeddings.length > 0 ? (
                    upcomingWeddings.slice(0, 5).map((cust: any) => {
                      const badge = getStatusBadge(cust.customer_status);
                      return (
                        <Link
                          key={cust.id}
                          to={`/wedding-crm/customers/${cust.id}`}
                          className="p-3 rounded-xl bg-[#F7F5F0] border border-[#E1DDD3] hover:border-[#C9A45C] flex items-center justify-between text-xs transition-all block group"
                        >
                          <div>
                            <div className="font-bold text-[#17201D] group-hover:text-[#123C35]">
                              {cust.customer_name}
                            </div>
                            <div className="text-[10px] text-[#65716C] flex items-center gap-1.5 mt-0.5">
                              <span>📍 {cust.location_name || 'Store'}</span>
                              <span>·</span>
                              <span className="text-[#C9A45C] font-medium">
                                💍 {formatDateDisplay(cust.wedding_date, 'TBD')}
                              </span>
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                            {cust.customer_status}
                          </span>
                        </Link>
                      );
                    })
                  ) : (
                    <div className="text-center py-6 text-xs text-[#9A858D]">
                      No upcoming weddings recorded in the next 30 days.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Customer Flow Modal */}
          {flowModalOpen && (
            <WeddingCustomerFlowModal
              isOpen={flowModalOpen}
              onClose={() => setFlowModalOpen(false)}
              customerId={selectedCustomerForFlow?.customer_id || selectedCustomerForFlow?.id}
              initialCustomer={selectedCustomerForFlow}
              onFlowUpdated={() => {
                loadData(selectedLocation);
              }}
            />
          )}

        </div>
      </PageContainer>
    </DashboardLayout>
  );
}
