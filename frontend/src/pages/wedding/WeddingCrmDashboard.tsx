import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import ToastContainer, { showToast } from '../../components/Toast';
import { API, Auth, UserSession } from '../../services/api';
import { getSidebarCollapsed, subscribeSidebarCollapsed } from '../../utils/sidebarState';
import WeddingNav from './WeddingNav';
import { WeddingStats, getStatusBadge } from './weddingTypes';
import LocationFilterSelect from '../../components/ui/LocationFilterSelect';
import { useLocationContext } from '../../context/LocationContext';
import {
  Users,
  UserPlus,
  PhoneCall,
  Calendar,
  Sparkles,
  TrendingUp,
  MapPin,
  Clock,
  PhoneForwarded,
  CircleCheck,
  CircleX,
  CircleAlert,
  TriangleAlert,
  Award,
  ArrowRight,
  ChevronRight,
  ShoppingBag,
  Store,
  RefreshCw,
  Eye,
  Plus
} from 'lucide-react';

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

      const [statsRes, enhRes, locsRes, perfRes, pipeRes, upRes] = await Promise.all([
        API.getWeddingStats(targetLoc).catch(() => null),
        API.getWeddingEnhancedDashboard(targetLoc).catch(() => null),
        API.getLocations().catch(() => ({ locations: [] })),
        API.getWeddingEmployeePerformance(targetLoc).catch(() => null),
        API.getWeddingPipeline(targetLoc).catch(() => null),
        API.getWeddingUpcoming(30, targetLoc).catch(() => null)
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
    } catch (err: any) {
      showToast('Error loading wedding CRM dashboard: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

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
          title="Wedding CRM Dashboard"
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto space-y-6">
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
                  className="px-3 py-2 bg-white hover:bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl text-xs font-bold text-[#182033] flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#C9A45C]' : ''}`} />
                  <span>Refresh</span>
                </button>
                <Link
                  to="/wedding/customer-registration"
                  className="px-4 py-2 bg-[#101C36] hover:bg-[#07101F] text-[#C9A45C] font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all border border-[#C9A45C]/30"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add Customer</span>
                </Link>
              </div>
            }
          />

          {/* KPI Metrics Grid (12 Cards per Section 8 specification) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {/* 1. Total Leads */}
            <div className="bg-white p-4 rounded-2xl border border-[#DFDDD7] shadow-xs relative overflow-hidden group hover:border-[#C9A45C] transition-all">
              <div className="flex items-center justify-between text-[#687080] mb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider">Total Leads</span>
                <Users className="w-4 h-4 text-[#101C36]" />
              </div>
              <div className="text-2xl font-black text-[#101C36]">{stats.totalCustomers || 0}</div>
              <div className="text-[10px] text-muted font-bold mt-1">All registered brides/families</div>
            </div>

            {/* 2. New Leads */}
            <div className="bg-white p-4 rounded-2xl border border-[#DFDDD7] shadow-xs relative overflow-hidden group hover:border-[#C9A45C] transition-all">
              <div className="flex items-center justify-between text-[#687080] mb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider">New Leads</span>
                <Sparkles className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-blue-700">{stats.todayNewCustomers || stats.newRequests || 0}</div>
              <div className="text-[10px] text-blue-600 font-bold mt-1">Awaiting telecaller reachout</div>
            </div>

            {/* 3. Today's Calls */}
            <div className="bg-white p-4 rounded-2xl border border-[#DFDDD7] shadow-xs relative overflow-hidden group hover:border-[#C9A45C] transition-all">
              <div className="flex items-center justify-between text-[#687080] mb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider">Today's Calls</span>
                <PhoneCall className="w-4 h-4 text-[#C9A45C]" />
              </div>
              <div className="text-2xl font-black text-[#C98218]">{stats.todayFollowUps || 0}</div>
              <div className="text-[10px] text-amber-700 font-bold mt-1">Scheduled for today</div>
            </div>

            {/* 4. Overdue */}
            <div className="bg-white p-4 rounded-2xl border border-[#DFDDD7] shadow-xs relative overflow-hidden group hover:border-red-400 transition-all">
              <div className="flex items-center justify-between text-[#687080] mb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider">Overdue Calls</span>
                <TriangleAlert className="w-4 h-4 text-[#C7374A]" />
              </div>
              <div className="text-2xl font-black text-[#C7374A]">{stats.overdueFollowUps || 0}</div>
              <div className="text-[10px] text-[#C7374A] font-bold mt-1">Requires immediate call</div>
            </div>

            {/* 5. Pending Calls */}
            <div className="bg-white p-4 rounded-2xl border border-[#DFDDD7] shadow-xs relative overflow-hidden group hover:border-[#C9A45C] transition-all">
              <div className="flex items-center justify-between text-[#687080] mb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider">Pending Calls</span>
                <Clock className="w-4 h-4 text-text-secondary" />
              </div>
              <div className="text-2xl font-black text-text-primary">{stats.callsPending || 0}</div>
              <div className="text-[10px] text-text-secondary font-bold mt-1">In telecaller queue</div>
            </div>

            {/* 6. Connected */}
            <div className="bg-white p-4 rounded-2xl border border-[#DFDDD7] shadow-xs relative overflow-hidden group hover:border-emerald-400 transition-all">
              <div className="flex items-center justify-between text-[#687080] mb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider">Connected</span>
                <CircleCheck className="w-4 h-4 text-[#16805B]" />
              </div>
              <div className="text-2xl font-black text-[#16805B]">{stats.connectedCalls || stats.callsCompleted || 0}</div>
              <div className="text-[10px] text-[#16805B] font-bold mt-1">Successful contact</div>
            </div>

            {/* 7. Callbacks */}
            <div className="bg-white p-4 rounded-2xl border border-[#DFDDD7] shadow-xs relative overflow-hidden group hover:border-purple-400 transition-all">
              <div className="flex items-center justify-between text-[#687080] mb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider">Callbacks</span>
                <PhoneForwarded className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-black text-purple-800">{stats.callbackRequests || 0}</div>
              <div className="text-[10px] text-purple-600 font-bold mt-1">Customer requested callback</div>
            </div>

            {/* 8. Shopping Confirmed */}
            <div className="bg-white p-4 rounded-2xl border border-[#DFDDD7] shadow-xs relative overflow-hidden group hover:border-blue-400 transition-all">
              <div className="flex items-center justify-between text-[#687080] mb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider">Shopping Confirmed</span>
                <Calendar className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-blue-800">{stats.shoppingConfirmed || 0}</div>
              <div className="text-[10px] text-blue-600 font-bold mt-1">Date locked by customer</div>
            </div>

            {/* 9. Visits Scheduled */}
            <div className="bg-white p-4 rounded-2xl border border-[#DFDDD7] shadow-xs relative overflow-hidden group hover:border-indigo-400 transition-all">
              <div className="flex items-center justify-between text-[#687080] mb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider">Visits Scheduled</span>
                <MapPin className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-black text-indigo-800">{stats.todayAppointments || 0}</div>
              <div className="text-[10px] text-indigo-600 font-bold mt-1">Store appointments</div>
            </div>

            {/* 10. Visited */}
            <div className="bg-white p-4 rounded-2xl border border-[#DFDDD7] shadow-xs relative overflow-hidden group hover:border-teal-400 transition-all">
              <div className="flex items-center justify-between text-[#687080] mb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider">Store Visited</span>
                <ShoppingBag className="w-4 h-4 text-teal-600" />
              </div>
              <div className="text-2xl font-black text-teal-800">{stats.visitedConverted || 0}</div>
              <div className="text-[10px] text-teal-600 font-bold mt-1">Arrived at store</div>
            </div>

            {/* 11. Won */}
            <div className="bg-white p-4 rounded-2xl border border-[#DFDDD7] shadow-xs relative overflow-hidden group hover:border-emerald-500 transition-all">
              <div className="flex items-center justify-between text-[#687080] mb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider">Won / Converted</span>
                <Award className="w-4 h-4 text-[#16805B]" />
              </div>
              <div className="text-2xl font-black text-[#16805B]">{stats.convertedCustomers || stats.visitedConverted || 0}</div>
              <div className="text-[10px] text-[#16805B] font-bold mt-1">Purchase finalized</div>
            </div>

            {/* 12. Not Interested */}
            <div className="bg-white p-4 rounded-2xl border border-[#DFDDD7] shadow-xs relative overflow-hidden group hover:border-gray-400 transition-all">
              <div className="flex items-center justify-between text-[#687080] mb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider">Not Interested</span>
                <Clock className="w-4 h-4 text-gray-500" />
              </div>
              <div className="text-2xl font-black text-gray-700">{stats.notInterested || 0}</div>
              <div className="text-[10px] text-gray-500 font-bold mt-1">Closed / Lost</div>
            </div>
          </div>

          {/* Quick Operations Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/telecaller/desk"
              className="bg-white p-5 rounded-2xl border border-[#DFDDD7] hover:border-[#C9A45C] shadow-xs flex items-center justify-between transition-all group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-[#C98218] flex items-center justify-center border border-amber-200">
                  <PhoneCall className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-extrabold text-sm text-[#182033] group-hover:text-[#101C36]">
                    Open Telecaller Desk
                  </div>
                  <div className="text-xs text-muted">
                    {stats.todayFollowUps || 0} calls scheduled for today
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted group-hover:text-[#C9A45C] group-hover:translate-x-1 transition-all" />
            </Link>

            <Link
              to="/wedding-crm/customers"
              className="bg-white p-5 rounded-2xl border border-[#DFDDD7] hover:border-[#C9A45C] shadow-xs flex items-center justify-between transition-all group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-extrabold text-sm text-[#182033] group-hover:text-[#101C36]">
                    Browse Customer Register
                  </div>
                  <div className="text-xs text-muted">
                    {stats.totalCustomers || 0} registered wedding customers
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted group-hover:text-[#C9A45C] group-hover:translate-x-1 transition-all" />
            </Link>

            <Link
              to="/wedding-crm/calendar"
              className="bg-white p-5 rounded-2xl border border-[#DFDDD7] hover:border-[#C9A45C] shadow-xs flex items-center justify-between transition-all group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-extrabold text-sm text-[#182033] group-hover:text-[#101C36]">
                    Follow-up Calendar
                  </div>
                  <div className="text-xs text-muted">View upcoming appointments & shopping dates</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted group-hover:text-[#C9A45C] group-hover:translate-x-1 transition-all" />
            </Link>
          </div>

          {/* Two-Column Analytics Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Location Performance & Pipeline Summary */}
            <div className="lg:col-span-2 space-y-6">
              {/* Location Cards */}
              <div className="bg-white p-5 rounded-2xl border border-[#DFDDD7] shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-black text-[#182033] uppercase tracking-wider flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#C9A45C]" />
                    <span>Location-wise Customer Distribution</span>
                  </h3>
                  <span className="text-xs font-bold text-muted">Live Store Data</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {filteredLocationCards.length > 0 ? (
                    filteredLocationCards.map((loc: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-[#F6F4EF] border border-[#DFDDD7] hover:border-[#C9A45C] transition-all"
                      >
                        <div className="font-black text-xs text-[#182033] flex items-center justify-between">
                          <span>{loc.location_name || loc.name}</span>
                          <span className="text-[10px] bg-white px-2 py-0.5 rounded-full border border-[#DFDDD7] font-bold">
                            {loc.customer_count || loc.total_customers || loc.count || 0} leads
                          </span>
                        </div>
                        <div className="mt-2 text-xs space-y-1 text-muted">
                          <div className="flex justify-between">
                            <span>Confirmed:</span>
                            <span className="font-bold text-blue-700">{loc.confirmed_count || loc.purchases || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Visited / Won:</span>
                            <span className="font-bold text-emerald-700">{loc.won_count || loc.visits || 0}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-3 text-center py-6 text-xs text-muted">
                      No location data available for your assigned scope.
                    </div>
                  )}
                </div>
              </div>

              {/* Conversion Pipeline Flow */}
              <div className="bg-white p-5 rounded-2xl border border-[#DFDDD7] shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-black text-[#182033] uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#16805B]" />
                    <span>Conversion Funnel & Status Pipeline</span>
                  </h3>
                  <Link
                    to="/wedding-crm/pipeline"
                    className="text-xs font-bold text-[#C98218] hover:underline flex items-center gap-1"
                  >
                    View Status Board <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                  <div className="p-3 rounded-xl bg-primary-soft border border-border">
                    <div className="text-[10px] font-bold text-text-secondary uppercase">1. New Leads</div>
                    <div className="text-lg font-black text-text-primary mt-1">{stats.newRequests || stats.todayNewCustomers || 0}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                    <div className="text-[10px] font-bold text-amber-800 uppercase">2. Contacted</div>
                    <div className="text-lg font-black text-amber-900 mt-1">{stats.connectedCalls || 0}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                    <div className="text-[10px] font-bold text-blue-800 uppercase">3. Shopping Confirmed</div>
                    <div className="text-lg font-black text-blue-900 mt-1">{stats.shoppingConfirmed || 0}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200">
                    <div className="text-[10px] font-bold text-indigo-800 uppercase">4. Store Visited</div>
                    <div className="text-lg font-black text-indigo-900 mt-1">{stats.visitedConverted || 0}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                    <div className="text-[10px] font-bold text-emerald-800 uppercase">5. Won / Converted</div>
                    <div className="text-lg font-black text-emerald-900 mt-1">{stats.convertedCustomers || stats.visitedConverted || 0}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Telecaller Performance & Upcoming Weddings */}
            <div className="space-y-6">
              {/* Telecaller Performance Leaderboard */}
              <div className="bg-white p-5 rounded-2xl border border-[#DFDDD7] shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-black text-[#182033] uppercase tracking-wider flex items-center gap-2">
                    <PhoneCall className="w-4 h-4 text-[#C9A45C]" />
                    <span>Telecaller Performance</span>
                  </h3>
                  <Link to="/wedding-crm/reports" className="text-xs font-bold text-muted hover:text-primary">
                    Details
                  </Link>
                </div>

                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {telecallerPerformance.length > 0 ? (
                    telecallerPerformance.map((caller: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-[#F6F4EF] border border-[#DFDDD7] flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-[#182033]">{caller.name || caller.telecaller_name}</div>
                          <div className="text-[10px] text-muted">{caller.location_name || 'Store Operations'}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-black text-[#16805B]">{caller.calls_today || caller.total_calls || 0} calls</div>
                          <div className="text-[10px] text-muted">{caller.converted || 0} won</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-xs text-muted">
                      No telecaller metrics recorded yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Upcoming Weddings */}
              <div className="bg-white p-5 rounded-2xl border border-[#DFDDD7] shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-black text-[#182033] uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-pink-600" />
                    <span>Upcoming Weddings</span>
                  </h3>
                  <Link to="/wedding-crm/customers" className="text-xs font-bold text-muted hover:text-primary">
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
                          className="p-3 rounded-xl bg-[#F6F4EF] border border-[#DFDDD7] hover:border-[#C9A45C] flex items-center justify-between text-xs transition-all block group"
                        >
                          <div>
                            <div className="font-black text-[#182033] group-hover:text-[#101C36]">
                              {cust.customer_name}
                            </div>
                            <div className="text-[10px] text-muted flex items-center gap-1.5 mt-0.5">
                              <span>📍 {cust.location_name || 'Store'}</span>
                              <span>·</span>
                              <span className="text-pink-700 font-bold">
                                💍 {cust.wedding_date ? new Date(cust.wedding_date).toLocaleDateString() : 'TBD'}
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
                    <div className="text-center py-6 text-xs text-muted">
                      No upcoming weddings recorded in the next 30 days.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
