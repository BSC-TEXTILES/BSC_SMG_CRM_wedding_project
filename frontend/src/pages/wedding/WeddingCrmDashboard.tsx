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
import { Users, UserPlus, PhoneCall, Calendar, Sparkles, TrendingUp, MapPin, Clock, PhoneForwarded, CircleCheck, TriangleAlert, Award, ArrowRight, ChevronRight, ShoppingBag, RefreshCw, History, MessageCircle } from 'lucide-react';
import WeddingCustomerFlowModal from '../../components/wedding/WeddingCustomerFlowModal';

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
    } catch (err: any) {
      showToast('Error loading wedding CRM dashboard: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

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
                  className="px-3.5 py-2 bg-[#FFFDFC] hover:bg-[#FFF7F2] border border-[#E8D9D4] rounded-xl text-xs font-semibold text-[#4A173A] flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#B76E79]' : 'text-[#B76E79]'}`} />
                  <span>Refresh</span>
                </button>
                <Link
                  to="/wedding/customer-registration"
                  className="px-4 py-2 bg-[#4A173A] hover:bg-[#6A2853] text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all border border-[#B76E79]/30"
                >
                  <UserPlus className="w-3.5 h-3.5 text-[#E8C7A8]" />
                  <span>Add Customer</span>
                </Link>
              </div>
            }
          />

          {/* KPI Metrics Grid (12 Cards) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {/* 1. Total Leads */}
            <div className="bg-[#FFFDFC] p-4 rounded-2xl border border-[#E8D9D4] shadow-xs relative overflow-hidden group hover:border-[#B76E79] hover:shadow-sm transition-all">
              <div className="flex items-center justify-between text-[#6F5963] mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">Total Leads</span>
                <Users className="w-4 h-4 text-[#B76E79]" />
              </div>
              <div className="text-2xl font-black text-[#4A173A]">{stats.totalCustomers || 0}</div>
              <div className="text-[10px] text-[#9A858D] font-medium mt-1">All registered brides/families</div>
            </div>

            {/* 2. New Leads */}
            <div className="bg-[#FFFDFC] p-4 rounded-2xl border border-[#E8D9D4] shadow-xs relative overflow-hidden group hover:border-[#B76E79] hover:shadow-sm transition-all">
              <div className="flex items-center justify-between text-[#6F5963] mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">New Leads</span>
                <Sparkles className="w-4 h-4 text-[#B76E79]" />
              </div>
              <div className="text-2xl font-black text-[#6A2853]">{stats.todayNewCustomers || stats.newRequests || 0}</div>
              <div className="text-[10px] text-[#6F5963] font-medium mt-1">Awaiting telecaller reachout</div>
            </div>

            {/* 3. Today's Calls */}
            <div className="bg-[#FFFDFC] p-4 rounded-2xl border border-[#E8D9D4] shadow-xs relative overflow-hidden group hover:border-[#B76E79] hover:shadow-sm transition-all">
              <div className="flex items-center justify-between text-[#6F5963] mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">Today's Calls</span>
                <PhoneCall className="w-4 h-4 text-[#B76E79]" />
              </div>
              <div className="text-2xl font-black text-[#C58A18]">{stats.todayFollowUps || 0}</div>
              <div className="text-[10px] text-[#6F5963] font-medium mt-1">Scheduled for today</div>
            </div>

            {/* 4. Overdue */}
            <div className="bg-[#FFFDFC] p-4 rounded-2xl border border-[#E8D9D4] shadow-xs relative overflow-hidden group hover:border-[#B42318] hover:shadow-sm transition-all">
              <div className="flex items-center justify-between text-[#6F5963] mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">Overdue Calls</span>
                <TriangleAlert className="w-4 h-4 text-[#B42318]" />
              </div>
              <div className="text-2xl font-black text-[#B42318]">{stats.overdueFollowUps || 0}</div>
              <div className="text-[10px] text-[#B42318] font-medium mt-1">Requires immediate call</div>
            </div>

            {/* 5. Pending Calls */}
            <div className="bg-[#FFFDFC] p-4 rounded-2xl border border-[#E8D9D4] shadow-xs relative overflow-hidden group hover:border-[#B76E79] hover:shadow-sm transition-all">
              <div className="flex items-center justify-between text-[#6F5963] mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">Pending Calls</span>
                <Clock className="w-4 h-4 text-[#9A858D]" />
              </div>
              <div className="text-2xl font-black text-[#2B1722]">{stats.callsPending || 0}</div>
              <div className="text-[10px] text-[#9A858D] font-medium mt-1">In telecaller queue</div>
            </div>

            {/* 6. Connected */}
            <div className="bg-[#FFFDFC] p-4 rounded-2xl border border-[#E8D9D4] shadow-xs relative overflow-hidden group hover:border-[#198754] hover:shadow-sm transition-all">
              <div className="flex items-center justify-between text-[#6F5963] mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">Connected</span>
                <CircleCheck className="w-4 h-4 text-[#198754]" />
              </div>
              <div className="text-2xl font-black text-[#198754]">{stats.connectedCalls || stats.callsCompleted || 0}</div>
              <div className="text-[10px] text-[#198754] font-medium mt-1">Successful contact</div>
            </div>

            {/* 7. Callbacks */}
            <div className="bg-[#FFFDFC] p-4 rounded-2xl border border-[#E8D9D4] shadow-xs relative overflow-hidden group hover:border-[#B76E79] hover:shadow-sm transition-all">
              <div className="flex items-center justify-between text-[#6F5963] mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">Callbacks</span>
                <PhoneForwarded className="w-4 h-4 text-[#B76E79]" />
              </div>
              <div className="text-2xl font-black text-[#4A173A]">{stats.callbackRequests || 0}</div>
              <div className="text-[10px] text-[#6F5963] font-medium mt-1">Customer requested callback</div>
            </div>

            {/* 8. Shopping Confirmed */}
            <div className="bg-[#FFFDFC] p-4 rounded-2xl border border-[#E8D9D4] shadow-xs relative overflow-hidden group hover:border-[#B76E79] hover:shadow-sm transition-all">
              <div className="flex items-center justify-between text-[#6F5963] mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">Shopping Confirmed</span>
                <Calendar className="w-4 h-4 text-[#B76E79]" />
              </div>
              <div className="text-2xl font-black text-[#4A173A]">{stats.shoppingConfirmed || 0}</div>
              <div className="text-[10px] text-[#6F5963] font-medium mt-1">Date locked by customer</div>
            </div>

            {/* 9. Visits Scheduled */}
            <div className="bg-[#FFFDFC] p-4 rounded-2xl border border-[#E8D9D4] shadow-xs relative overflow-hidden group hover:border-[#B76E79] hover:shadow-sm transition-all">
              <div className="flex items-center justify-between text-[#6F5963] mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">Visits Scheduled</span>
                <MapPin className="w-4 h-4 text-[#B76E79]" />
              </div>
              <div className="text-2xl font-black text-[#6A2853]">{stats.todayAppointments || 0}</div>
              <div className="text-[10px] text-[#6F5963] font-medium mt-1">Store appointments</div>
            </div>

            {/* 10. Visited */}
            <div className="bg-[#FFFDFC] p-4 rounded-2xl border border-[#E8D9D4] shadow-xs relative overflow-hidden group hover:border-[#B76E79] hover:shadow-sm transition-all">
              <div className="flex items-center justify-between text-[#6F5963] mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">Store Visited</span>
                <ShoppingBag className="w-4 h-4 text-[#B76E79]" />
              </div>
              <div className="text-2xl font-black text-[#4A173A]">{stats.visitedConverted || 0}</div>
              <div className="text-[10px] text-[#6F5963] font-medium mt-1">Arrived at store</div>
            </div>

            {/* 11. Won */}
            <div className="bg-[#FFFDFC] p-4 rounded-2xl border border-[#E8D9D4] shadow-xs relative overflow-hidden group hover:border-[#198754] hover:shadow-sm transition-all">
              <div className="flex items-center justify-between text-[#6F5963] mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">Won / Converted</span>
                <Award className="w-4 h-4 text-[#198754]" />
              </div>
              <div className="text-2xl font-black text-[#198754]">{stats.convertedCustomers || stats.visitedConverted || 0}</div>
              <div className="text-[10px] text-[#198754] font-medium mt-1">Purchase finalized</div>
            </div>

            {/* 12. Not Interested */}
            <div className="bg-[#FFFDFC] p-4 rounded-2xl border border-[#E8D9D4] shadow-xs relative overflow-hidden group hover:border-[#9A858D] hover:shadow-sm transition-all">
              <div className="flex items-center justify-between text-[#6F5963] mb-2">
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
              className="bg-[#FFFDFC] p-5 rounded-2xl border border-[#E8D9D4] hover:border-[#B76E79] shadow-xs flex items-center justify-between transition-all group hover:shadow-sm"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#FFF4D6] text-[#C58A18] flex items-center justify-center border border-[#E8D9D4]">
                  <PhoneCall className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-[#2B1722] group-hover:text-[#4A173A]">
                    Open Telecaller Desk
                  </div>
                  <div className="text-xs text-[#6F5963]">
                    {stats.todayFollowUps || 0} calls scheduled for today
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-[#9A858D] group-hover:text-[#B76E79] group-hover:translate-x-1 transition-all" />
            </Link>

            <Link
              to="/wedding-crm/customers"
              className="bg-[#FFFDFC] p-5 rounded-2xl border border-[#E8D9D4] hover:border-[#B76E79] shadow-xs flex items-center justify-between transition-all group hover:shadow-sm"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#F6E2E5] text-[#4A173A] flex items-center justify-center border border-[#E8D9D4]">
                  <Users className="w-5 h-5 text-[#B76E79]" />
                </div>
                <div>
                  <div className="font-bold text-sm text-[#2B1722] group-hover:text-[#4A173A]">
                    Browse Customer Register
                  </div>
                  <div className="text-xs text-[#6F5963]">
                    {stats.totalCustomers || 0} registered wedding customers
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-[#9A858D] group-hover:text-[#B76E79] group-hover:translate-x-1 transition-all" />
            </Link>

            <Link
              to="/wedding-crm/calendar"
              className="bg-[#FFFDFC] p-5 rounded-2xl border border-[#E8D9D4] hover:border-[#B76E79] shadow-xs flex items-center justify-between transition-all group hover:shadow-sm"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#EDE7F6] text-[#6A2853] flex items-center justify-center border border-[#E8D9D4]">
                  <Calendar className="w-5 h-5 text-[#6A2853]" />
                </div>
                <div>
                  <div className="font-bold text-sm text-[#2B1722] group-hover:text-[#4A173A]">
                    Follow-up Calendar
                  </div>
                  <div className="text-xs text-[#6F5963]">View upcoming appointments & shopping dates</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-[#9A858D] group-hover:text-[#B76E79] group-hover:translate-x-1 transition-all" />
            </Link>
          </div>

          {/* Live Customer Journey & Recent Call Stream */}
          <div className="bg-[#FFFDFC] p-5 sm:p-6 rounded-3xl border border-[#E8D9D4] shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E8D9D4]">
              <div>
                <h3 className="text-sm font-bold text-[#4A173A] uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#B76E79]" />
                  <span>Live Wedding Customer Flow & Call Activity Stream</span>
                </h3>
                <p className="text-xs text-[#6F5963] mt-0.5">
                  Latest customer consultations and telecaller touchpoints with instant step progression.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  to="/wedding-crm/calls"
                  className="px-3.5 py-1.5 rounded-xl bg-[#FFF7F2] hover:bg-[#E8D9D4] border border-[#E8D9D4] text-xs font-bold text-[#4A173A] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <History className="w-3.5 h-3.5 text-[#B76E79]" />
                  <span>View All Call History</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {recentCallLogs.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#6F5963] bg-[#FFFAF7] rounded-2xl border border-[#E8D9D4] p-4">
                No recent wedding call activities logged yet. Calls recorded by telecallers will appear here in real time.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {recentCallLogs.map((log: any, idx: number) => {
                  const badge = getStatusBadge(log.customer_status || 'New');
                  const cleanPhone = (log.customer_mobile || log.mobile_number || '').replace(/\D/g, '');
                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-[#FFFAF7] border border-[#E8D9D4] hover:border-[#B76E79] shadow-2xs hover:shadow-xs transition-all space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-sm text-[#4A173A] flex items-center gap-1">
                              <span>{log.customer_name || 'Customer'}</span>
                            </div>
                            <div className="text-[10px] text-[#6F5963] font-mono mt-0.5">
                              {log.customer_code || 'BSC-WED'} · 📍 {log.location_name || 'Store'}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#F6E2E5] text-[#4A173A] border border-[#E8D9D4]">
                              {log.call_outcome}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${badge.bg}`}>
                              {log.customer_status || 'New'}
                            </span>
                          </div>
                        </div>

                        {/* Bride & Groom / Wedding Date */}
                        <div className="p-2.5 rounded-xl bg-[#FFFDFC] border border-[#E8D9D4]/80 text-[11px] space-y-1">
                          {(log.bride_name || log.groom_name) && (
                            <div className="font-semibold text-[#B76E79]">
                              {log.bride_name ? `👰 ${log.bride_name}` : ''}
                              {log.bride_name && log.groom_name ? ' · ' : ''}
                              {log.groom_name ? `🤵 ${log.groom_name}` : ''}
                            </div>
                          )}
                          <div className="flex items-center justify-between text-[#6F5963] text-[10px]">
                            <span>💍 {formatDateDisplay(log.wedding_date, 'TBD')}</span>
                            <span className="font-bold text-[#198754]">₹ {log.budget || log.budget_range || 'TBD'}</span>
                          </div>
                          {log.remarks && (
                            <p className="text-[#2B1722] italic pt-1 border-t border-[#E8D9D4] text-[10px] line-clamp-2">
                              "{log.remarks}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Footer & Actions */}
                      <div className="pt-2 border-t border-[#E8D9D4]/60 flex items-center justify-between text-[11px]">
                        <span className="text-[#6F5963] text-[10px]">
                          👤 {log.telecaller_name || 'Staff'} · {log.call_date}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {cleanPhone && (
                            <a
                              href={`https://wa.me/91${cleanPhone}?text=Namaste%20${encodeURIComponent(log.customer_name || 'Customer')}%2C%20greetings%20from%20BSC%20Exclusive%20Textiles!`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 bg-[#198754] hover:bg-[#16805B] text-white rounded-lg text-xs"
                              title="WhatsApp"
                            >
                              <MessageCircle className="w-3 h-3" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCustomerForFlow({
                                id: log.customer_id || log.id,
                                customer_id: log.customer_id || log.id,
                                customer_code: log.customer_code,
                                customer_name: log.customer_name,
                                mobile_number: log.customer_mobile || log.mobile_number,
                                bride_name: log.bride_name,
                                groom_name: log.groom_name,
                                wedding_date: log.wedding_date,
                                expected_shopping_date: log.expected_shopping_date || log.expected_shopping_date_updated,
                                preferred_shopping_category: log.preferred_shopping_category,
                                budget: log.budget || log.budget_range,
                                location_name: log.location_name,
                                assigned_telecaller: log.telecaller_name || log.assigned_telecaller,
                                customer_status: log.customer_status,
                                priority: log.priority
                              });
                              setFlowModalOpen(true);
                            }}
                            className="px-2.5 py-1 bg-[#4A173A] hover:bg-[#6A2853] text-white rounded-lg text-[11px] font-bold shadow-2xs flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <TrendingUp className="w-3 h-3 text-[#E8C7A8]" />
                            <span>View Flow</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Two-Column Analytics Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Location Performance & Pipeline Summary */}
            <div className="lg:col-span-2 space-y-6">
              {/* Location Cards */}
              <div className="bg-[#FFFDFC] p-5 rounded-2xl border border-[#E8D9D4] shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-[#4A173A] uppercase tracking-wider flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#B76E79]" />
                    <span>Location-wise Customer Distribution</span>
                  </h3>
                  <span className="text-xs font-medium text-[#6F5963]">Live Store Data</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {filteredLocationCards.length > 0 ? (
                    filteredLocationCards.map((loc: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-[#FFFAF7] border border-[#E8D9D4] hover:border-[#B76E79] transition-all"
                      >
                        <div className="font-bold text-xs text-[#2B1722] flex items-center justify-between">
                          <span>{loc.location_name || loc.name}</span>
                          <span className="text-[10px] bg-[#FFFDFC] px-2 py-0.5 rounded-full border border-[#E8D9D4] font-semibold text-[#4A173A]">
                            {loc.customer_count || loc.total_customers || loc.count || 0} leads
                          </span>
                        </div>
                        <div className="mt-2 text-xs space-y-1 text-[#6F5963]">
                          <div className="flex justify-between">
                            <span>Confirmed:</span>
                            <span className="font-semibold text-[#4A173A]">{loc.confirmed_count || loc.purchases || 0}</span>
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
              <div className="bg-[#FFFDFC] p-5 rounded-2xl border border-[#E8D9D4] shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-[#4A173A] uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#B76E79]" />
                    <span>Conversion Funnel & Status Pipeline</span>
                  </h3>
                  <Link
                    to="/wedding-crm/pipeline"
                    className="text-xs font-semibold text-[#B76E79] hover:text-[#4A173A] hover:underline flex items-center gap-1"
                  >
                    View Status Board <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                  <div className="p-3 rounded-xl bg-[#EDE7F6] border border-[#E8D9D4]">
                    <div className="text-[10px] font-bold text-[#6A2853] uppercase">1. New Leads</div>
                    <div className="text-lg font-black text-[#6A2853] mt-1">{stats.newRequests || stats.todayNewCustomers || 0}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#FFF4D6] border border-[#E8D9D4]">
                    <div className="text-[10px] font-bold text-[#C58A18] uppercase">2. Contacted</div>
                    <div className="text-lg font-black text-[#C58A18] mt-1">{stats.connectedCalls || 0}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F6E2E5] border border-[#E8D9D4]">
                    <div className="text-[10px] font-bold text-[#4A173A] uppercase">3. Shopping Confirmed</div>
                    <div className="text-lg font-black text-[#4A173A] mt-1">{stats.shoppingConfirmed || 0}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#FFFAF7] border border-[#E8D9D4]">
                    <div className="text-[10px] font-bold text-[#B76E79] uppercase">4. Store Visited</div>
                    <div className="text-lg font-black text-[#B76E79] mt-1">{stats.visitedConverted || 0}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#E8F5EE] border border-[#E8D9D4]">
                    <div className="text-[10px] font-bold text-[#198754] uppercase">5. Won / Converted</div>
                    <div className="text-lg font-black text-[#198754] mt-1">{stats.convertedCustomers || stats.visitedConverted || 0}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Telecaller Performance & Upcoming Weddings */}
            <div className="space-y-6">
              {/* Telecaller Performance Leaderboard */}
              <div className="bg-[#FFFDFC] p-5 rounded-2xl border border-[#E8D9D4] shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-[#4A173A] uppercase tracking-wider flex items-center gap-2">
                    <PhoneCall className="w-4 h-4 text-[#B76E79]" />
                    <span>Telecaller Performance</span>
                  </h3>
                  <Link to="/wedding-crm/reports" className="text-xs font-semibold text-[#B76E79] hover:text-[#4A173A]">
                    Details
                  </Link>
                </div>

                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {telecallerPerformance.length > 0 ? (
                    telecallerPerformance.map((caller: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-[#FFFAF7] border border-[#E8D9D4] flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-[#2B1722]">{caller.name || caller.telecaller_name}</div>
                          <div className="text-[10px] text-[#6F5963]">{caller.location_name || 'Store Operations'}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-black text-[#198754]">{caller.calls_today || caller.total_calls || 0} calls</div>
                          <div className="text-[10px] text-[#6F5963]">{caller.converted || 0} won</div>
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
              <div className="bg-[#FFFDFC] p-5 rounded-2xl border border-[#E8D9D4] shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-[#4A173A] uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#B76E79]" />
                    <span>Upcoming Weddings</span>
                  </h3>
                  <Link to="/wedding-crm/customers" className="text-xs font-semibold text-[#B76E79] hover:text-[#4A173A]">
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
                          className="p-3 rounded-xl bg-[#FFFAF7] border border-[#E8D9D4] hover:border-[#B76E79] flex items-center justify-between text-xs transition-all block group"
                        >
                          <div>
                            <div className="font-bold text-[#2B1722] group-hover:text-[#4A173A]">
                              {cust.customer_name}
                            </div>
                            <div className="text-[10px] text-[#6F5963] flex items-center gap-1.5 mt-0.5">
                              <span>📍 {cust.location_name || 'Store'}</span>
                              <span>·</span>
                              <span className="text-[#B76E79] font-medium">
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
