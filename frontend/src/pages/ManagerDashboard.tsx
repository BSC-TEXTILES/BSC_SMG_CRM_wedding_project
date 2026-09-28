import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layouts/DashboardLayout';
import PageContainer from '../components/ui/PageContainer';
import { API, Auth, UserSession } from '../services/api';
import MetricCard from '../components/ui/MetricCard';
import GlobalLocationSelector from '../components/ui/GlobalLocationSelector';
import { Users, UserCheck, Footprints, Target, Heart, Clock, Sparkles, MessageSquare, SquareCheck, Layers, Search, RefreshCw, ArrowRight, MapPin, AlertTriangle, CheckCircle, FileText, Store, ClipboardList } from 'lucide-react';
import { useLocationContext } from '../context/LocationContext';

export default function ManagerDashboard() {
  const navigate = useNavigate();
  const {
    currentLocation,
    currentLocationLabel,
    activeLocation,
    isGlobalAdmin
  } = useLocationContext();

  const [session] = useState<UserSession | null>(() => Auth.get());
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter for Store Team table
  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  const [teamSectionFilter, setTeamSectionFilter] = useState('ALL');

  // Load live data from dedicated backend endpoint
  const loadDashboardData = useCallback(async (targetLoc?: string) => {
    try {
      setIsRefreshing(true);
      setError(null);
      const loc = targetLoc !== undefined ? targetLoc : currentLocation;
      const res = await API.getManagerDashboard(loc && loc !== 'ALL' ? loc : undefined);
      if (res && res.success && res.data) {
        setData(res.data);
      } else {
        setError(res?.message || 'Failed to load live Store Manager metrics');
      }
    } catch (err: any) {
      console.error('[ManagerDashboard] Failed to fetch live data:', err);
      setError(err?.message || 'Unable to connect to Store Manager dashboard API');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [currentLocation]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const counts = data?.counts || {};
  const store = data?.store || {};
  const sectionAllocations = data?.sectionAllocations || [];
  const openDivertsList = data?.openDivertsList || [];
  const todayFollowupsList = data?.todayFollowupsList || [];
  const negativeFeedbackAlerts = data?.negativeFeedbackAlerts || [];
  const storeTeam = data?.storeTeam || [];
  const recentActivities = data?.recentActivities || [];

  // Filtered store team members
  const filteredTeam = useMemo(() => {
    return storeTeam.filter((member: any) => {
      const q = teamSearchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        (member.name && member.name.toLowerCase().includes(q)) ||
        (member.employeeId && member.employeeId.toLowerCase().includes(q)) ||
        (member.phone && member.phone.includes(q)) ||
        (member.designation && member.designation.toLowerCase().includes(q));

      const matchesSection = teamSectionFilter === 'ALL' || member.section === teamSectionFilter;
      return matchesSearch && matchesSection;
    });
  }, [storeTeam, teamSearchQuery, teamSectionFilter]);

  // Unique sections for filter dropdown
  const uniqueSections = useMemo(() => {
    const s = new Set<string>();
    storeTeam.forEach((m: any) => {
      if (m.section) s.add(m.section);
    });
    return Array.from(s);
  }, [storeTeam]);

  return (
    <DashboardLayout
      title="Store Manager Dashboard"
      breadcrumbs={[{ label: 'Store Operations' }, { label: 'Store Manager Dashboard' }]}
    >
      <PageContainer maxWidth="full">
        {/* =========================================================================
            HEADER: STORE IDENTITY & OPERATIONAL WORKSPACE
        ========================================================================== */}
        <div className="bg-white rounded-2xl border border-[#DFDDD7] shadow-xs p-5 sm:p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#101C36] text-[#C9A45C] text-[10px] font-black uppercase tracking-widest mb-2 border border-[#C9A45C]/30">
                <Store className="w-3.5 h-3.5" />
                <span>BSC Textiles · STORE FLOOR OPERATIONS</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-[#182033] tracking-tight leading-tight">
                {store.name ? `STORE MANAGER DASHBOARD — ${store.name.toUpperCase()}` : 'STORE MANAGER DASHBOARD'}
              </h1>
              <p className="text-xs sm:text-sm font-semibold text-[#687080] mt-1">
                Live Store Floor Performance, Team Rosters, Customer Diverts &amp; Wedding Pipeline.
              </p>
            </div>

            {/* Store Location & Refresh */}
            <div className="flex items-center gap-2.5 flex-shrink-0 self-start md:self-center">
              {isGlobalAdmin ? (
                <GlobalLocationSelector />
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F6F4EF] border border-[#DFDDD7] text-xs font-bold text-[#182033]">
                  <MapPin className="w-3.5 h-3.5 text-[#C9A45C]" />
                  <span>{store.name || activeLocation.name || 'Store'} Branch #{store.id || activeLocation.id}</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => loadDashboardData()}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#DFDDD7] bg-[#F6F4EF] hover:bg-white text-[#182033] text-xs font-bold transition-all shadow-2xs hover:border-[#C9A45C] cursor-pointer"
                title="Refresh live store metrics from database"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#C9A45C] ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* =========================================================================
            SECTION 1: PRIMARY OPERATIONAL KPI CARDS (8 Metric Cards)
        ========================================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <MetricCard
            title="Store Team Strength"
            value={counts.totalTeam || 0}
            subtext={`${counts.activeFloorStaff || 0} active on shift`}
            icon={Users}
            color="navy"
            onClick={() => navigate('/section-allocation')}
          />

          <MetricCard
            title="Active Floor Staff"
            value={counts.activeFloorStaff || 0}
            subtext={`${counts.allocatedStaff || 0} counter assigned`}
            icon={UserCheck}
            color="emerald"
            onClick={() => navigate('/section-allocation')}
          />

          <MetricCard
            title="Today's Footfall"
            value={counts.todayFootfall || 0}
            subtext="Store walk-ins recorded today"
            icon={Footprints}
            color="emerald"
            onClick={() => navigate('/footfall')}
          />

          <MetricCard
            title="Open Diverts"
            value={counts.openDiverts || 0}
            subtext={`${counts.totalDiverts || 0} total requests logged`}
            icon={Target}
            color="rose"
            onClick={() => navigate('/divert')}
          />

          <MetricCard
            title="Wedding Store Leads"
            value={counts.totalLeads || 0}
            subtext={`${counts.newLeads || 0} registered recently`}
            icon={Sparkles}
            color="gold"
            onClick={() => navigate('/wedding-crm/dashboard')}
          />

          <MetricCard
            title="Overdue Follow-ups"
            value={counts.overdueFollowups || 0}
            subtext="Customer calls needing escalation"
            icon={Clock}
            color="amber"
            onClick={() => navigate('/wedding-crm/calendar')}
          />

          <MetricCard
            title="Shopping Confirmed"
            value={counts.shoppingConfirmed || 0}
            subtext={`${counts.convertedLeads || 0} converted customers`}
            icon={CheckCircle}
            color="indigo"
            onClick={() => navigate('/wedding-crm/dashboard')}
          />

          <MetricCard
            title="Customer CSAT Index"
            value={`${counts.csatIndex || 100}%`}
            subtext={`${counts.positiveFeedback || 0} positive of ${counts.totalFeedback || 0}`}
            icon={MessageSquare}
            color="teal"
            onClick={() => navigate('/feedback-collection')}
          />
        </div>

        {/* =========================================================================
            SECTION 2: MANAGER QUICK ACTIONS (Working Operational Buttons)
        ========================================================================== */}
        <div className="bg-white rounded-2xl border border-[#DFDDD7] shadow-xs p-5 sm:p-6 mb-6">
          <div className="flex items-center justify-between border-b border-[#DFDDD7] pb-3 mb-4">
            <h2 className="text-sm font-black text-[#182033] uppercase tracking-wider flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-[#C9A45C]" />
              <span>Store Floor Quick Actions</span>
            </h2>
            <span className="text-[11px] font-bold text-[#687080]">Direct Operational Tools</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { label: 'Record Footfall', path: '/footfall', icon: Footprints, desc: 'Hourly walk-ins' },
              { label: 'Section Allocation', path: '/section-allocation', icon: Layers, desc: 'Assign counters' },
              { label: 'Counter Diverts', path: '/divert', icon: Target, desc: 'Sourcing requests' },
              { label: 'Wedding CRM', path: '/wedding-crm/dashboard', icon: Sparkles, desc: 'Leads & visits' },
              { label: 'Customer Reg', path: '/wedding/customer-registration', icon: Heart, desc: 'New bride/groom' },
              { label: 'VM Checklist', path: '/vm-checklist', icon: SquareCheck, desc: 'Daily floor audit' },
              { label: 'Customer CSAT', path: '/feedback-collection', icon: MessageSquare, desc: 'Feedback review' },
              { label: 'Store Reports', path: '/wedding-crm/reports', icon: FileText, desc: 'Export analytics' }
            ].map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => navigate(action.path)}
                  className="p-3 rounded-xl border border-[#DFDDD7] bg-[#F6F4EF] hover:bg-white hover:border-[#C9A45C] transition-all text-left group shadow-2xs cursor-pointer flex flex-col justify-between"
                >
                  <div className="w-7 h-7 rounded-lg bg-white border border-[#DFDDD7] group-hover:bg-[#101C36] group-hover:text-white transition-colors flex items-center justify-center text-[#182033] mb-2">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-extrabold text-[11px] text-[#182033] group-hover:text-[#101C36] tracking-tight">{action.label}</div>
                    <div className="text-[9px] text-[#687080] font-medium mt-0.5 truncate">{action.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* =========================================================================
            SECTION 3: SECTION FLOOR ALLOCATIONS & SOURCING DIVERTS (Split Layout)
        ========================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Floor Section Allocation */}
          <div className="bg-white rounded-2xl border border-[#DFDDD7] shadow-xs p-5 sm:p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-[#DFDDD7] pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#101C36] text-[#C9A45C] flex items-center justify-center border border-[#C9A45C]/30 flex-shrink-0">
                    <Layers className="w-4 h-4 text-[#C9A45C]" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-[#182033] tracking-tight">FLOOR SECTION ALLOCATIONS</h2>
                    <p className="text-[11px] font-semibold text-[#687080]">Store counter &amp; section staff coverage</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/section-allocation')}
                  className="px-3 py-1.5 rounded-xl bg-[#101C36] text-white hover:bg-[#07101F] text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  <span>Assign Floor</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {sectionAllocations.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {sectionAllocations.map((sec: any) => (
                    <div key={sec.section} className="p-3 rounded-xl bg-[#F6F4EF] border border-[#DFDDD7] flex items-center justify-between">
                      <div className="min-w-0 pr-2">
                        <span className="font-extrabold text-xs text-[#182033] block truncate">{sec.section}</span>
                        <span className="text-[10px] text-[#687080]">Floor Section</span>
                      </div>
                      <span className="font-black text-sm text-[#101C36] px-2 py-0.5 rounded-lg bg-white border border-[#DFDDD7]">
                        {sec.count} staff
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center text-xs text-[#687080] font-semibold">
                  No section allocations recorded yet for this store.
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-[#DFDDD7] flex items-center justify-between text-xs">
              <span className="text-[#687080] font-semibold">Total Floor Staff: {counts.activeFloorStaff || 0}</span>
              <button
                type="button"
                onClick={() => navigate('/section-allocation')}
                className="text-xs font-bold text-[#C9A45C] hover:underline"
              >
                Modify Allocation →
              </button>
            </div>
          </div>

          {/* Sourcing Diverts Desk */}
          <div className="bg-white rounded-2xl border border-[#DFDDD7] shadow-xs p-5 sm:p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-[#DFDDD7] pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#101C36] text-[#C9A45C] flex items-center justify-center border border-[#C9A45C]/30 flex-shrink-0">
                    <Target className="w-4 h-4 text-[#C9A45C]" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-[#182033] tracking-tight">OPEN SOURCING DIVERTS</h2>
                    <p className="text-[11px] font-semibold text-[#687080]">Customer product requests needing procurement</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/divert')}
                  className="px-3 py-1.5 rounded-xl border border-[#DFDDD7] bg-[#F6F4EF] hover:bg-white text-[#182033] text-xs font-bold transition-all shadow-2xs hover:border-[#C9A45C] cursor-pointer"
                >
                  Diverts Desk
                </button>
              </div>

              {openDivertsList.length > 0 ? (
                <div className="space-y-2.5">
                  {openDivertsList.map((d: any) => (
                    <div key={d.id} className="p-3 rounded-xl bg-[#F6F4EF] border border-[#DFDDD7] flex items-center justify-between text-xs">
                      <div className="min-w-0 pr-3">
                        <div className="font-extrabold text-[#182033] truncate">{d.productWanted}</div>
                        <div className="text-[11px] text-[#687080]">
                          Customer: {d.customerName || 'Walk-in'} {d.customerMobile ? `(${d.customerMobile})` : ''} · Qty: {d.quantity || 1}
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800">
                          {d.status || 'Open'}
                        </span>
                        <div className="text-[10px] text-[#687080] mt-0.5">{d.priceRange || 'Standard'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center text-xs text-[#687080] font-semibold">
                  No open diverts currently pending resolution for this store.
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-[#DFDDD7] flex items-center justify-between text-xs">
              <span className="text-[#687080] font-semibold">Total Open: {counts.openDiverts || 0}</span>
              <button
                type="button"
                onClick={() => navigate('/divert')}
                className="text-xs font-bold text-[#C9A45C] hover:underline"
              >
                Log New Divert →
              </button>
            </div>
          </div>
        </div>

        {/* =========================================================================
            SECTION 4: OVERDUE WEDDING CUSTOMER FOLLOW-UPS QUEUE
        ========================================================================== */}
        <div className="bg-white rounded-2xl border border-[#DFDDD7] shadow-xs p-5 sm:p-6 mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DFDDD7] pb-3">
            <div>
              <h2 className="font-black text-sm uppercase tracking-wider text-[#182033] flex items-center gap-2">
                <Clock className="w-4 h-4 text-rose-600" />
                <span>Pending / Overdue Customer Follow-ups</span>
              </h2>
              <p className="text-xs font-semibold text-[#687080] mt-0.5">
                Wedding customer calls requiring store manager supervision &amp; follow-up
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/wedding-crm/calendar')}
              className="px-3 py-2 rounded-xl bg-[#101C36] text-white hover:bg-[#07101F] text-xs font-bold transition-all shadow-xs whitespace-nowrap cursor-pointer"
            >
              Open Follow-up Calendar
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#DFDDD7] text-[10.5px] font-black uppercase text-[#687080] bg-[#F6F4EF]/60">
                  <th className="py-3 px-4">Lead Code</th>
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Pipeline Status</th>
                  <th className="py-3 px-4">Assigned Telecaller</th>
                  <th className="py-3 px-4">Follow-up Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DFDDD7]/60">
                {todayFollowupsList.length > 0 ? (
                  todayFollowupsList.map((wc: any) => (
                    <tr key={wc.id || wc.customerCode} className="hover:bg-[#F6F4EF]/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#182033]">{wc.customerCode || `WED-${wc.id}`}</td>
                      <td className="py-3 px-4 font-extrabold text-[#182033]">{wc.customerName}</td>
                      <td className="py-3 px-4 font-mono text-[#687080]">{wc.mobileNumber || '—'}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#C9A45C]/15 text-[#101C36] border border-[#C9A45C]/30">
                          {wc.status || 'New'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#182033]">{wc.telecaller || 'Calling Desk'}</td>
                      <td className="py-3 px-4 text-rose-700 font-bold">
                        {wc.followUpDate ? new Date(wc.followUpDate).toLocaleDateString() : 'Overdue'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => navigate(`/wedding-crm/customers/${wc.id}`)}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg border border-[#DFDDD7] bg-white hover:bg-[#101C36] hover:text-white transition-colors cursor-pointer"
                        >
                          Customer File
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-[#687080] font-semibold">
                      {loading ? 'Checking follow-up queue...' : 'No overdue follow-up calls pending for this store.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* =========================================================================
            SECTION 5: STORE TEAM DIRECTORY TABLE
        ========================================================================== */}
        <div className="bg-white rounded-2xl border border-[#DFDDD7] shadow-xs p-5 sm:p-6 mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DFDDD7] pb-3">
            <div>
              <h2 className="font-black text-sm uppercase tracking-wider text-[#182033] flex items-center gap-2">
                <Users className="w-4 h-4 text-[#C9A45C]" />
                <span>Store Team Members</span>
              </h2>
              <p className="text-xs font-semibold text-[#687080] mt-0.5">
                Floor staff currently registered and active at {store.name || activeLocation.name || 'this store'}
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="w-4 h-4 text-[#687080] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search team by name, ID, role..."
                  value={teamSearchQuery}
                  onChange={(e) => setTeamSearchQuery(e.target.value)}
                  className="input-modern pl-9 pr-4 text-xs py-2 w-full sm:w-64"
                />
              </div>

              {uniqueSections.length > 0 && (
                <select
                  value={teamSectionFilter}
                  onChange={(e) => setTeamSectionFilter(e.target.value)}
                  aria-label="Filter team members by floor section"
                  className="input-modern text-xs py-2 px-3 border border-[#DFDDD7] rounded-xl bg-white"
                >
                  <option value="ALL">All Sections</option>
                  {uniqueSections.map((sec) => (
                    <option key={sec} value={sec}>{sec}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#DFDDD7] text-[10.5px] font-black uppercase text-[#687080] bg-[#F6F4EF]/60">
                  <th className="py-3 px-4">Emp ID</th>
                  <th className="py-3 px-4">Team Member</th>
                  <th className="py-3 px-4">Role &amp; Designation</th>
                  <th className="py-3 px-4">Floor Section</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DFDDD7]/60">
                {filteredTeam.length > 0 ? (
                  filteredTeam.map((emp: any) => (
                    <tr key={emp.id} className="hover:bg-[#F6F4EF]/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#182033]">{emp.employeeId}</td>
                      <td className="py-3 px-4">
                        <div className="font-extrabold text-[#182033]">{emp.name}</div>
                        <div className="text-[11px] text-[#687080]">{emp.role}</div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#182033]">{emp.designation}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#F6F4EF] border border-[#DFDDD7] text-[#182033]">
                          {emp.section || 'General Floor'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#687080]">{emp.department}</td>
                      <td className="py-3 px-4 font-mono text-[#687080]">{emp.phone || '—'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-[#687080] font-semibold">
                      {loading ? 'Loading store team...' : 'No matching team members found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* =========================================================================
            SECTION 6: RECENT STORE ACTIVITY & OPERATIONAL AUDIT
        ========================================================================== */}
        <div className="bg-white rounded-2xl border border-[#DFDDD7] shadow-xs p-5 sm:p-6 mb-6">
          <div className="flex items-center justify-between border-b border-[#DFDDD7] pb-3 mb-4">
            <h2 className="text-sm font-black text-[#182033] uppercase tracking-wider flex items-center gap-2">
              <Store className="w-4 h-4 text-[#C9A45C]" />
              <span>Recent Store Operational Events</span>
            </h2>
            <span className="text-[11px] font-bold text-[#687080]">Store Audit Trail</span>
          </div>

          {recentActivities.length > 0 ? (
            <div className="space-y-2.5">
              {recentActivities.map((act: any) => (
                <div key={act.id} className="p-3 rounded-xl bg-[#F6F4EF] border border-[#DFDDD7] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white border border-[#DFDDD7] flex items-center justify-center font-black text-xs text-[#101C36]">
                      {(act.username || 'OP').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-[#182033]">{act.action}</div>
                      <div className="text-[11px] text-[#687080]">{act.details || `Module: ${act.module}`}</div>
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-[#687080]">
                    <span className="block font-medium">{new Date(act.createdAt).toLocaleDateString()}</span>
                    <span>{new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-[#687080] font-semibold">
              No recent operational events logged for this store.
            </div>
          )}
        </div>
      </PageContainer>
    </DashboardLayout>
  );
}
