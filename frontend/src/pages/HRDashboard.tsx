import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layouts/DashboardLayout';
import PageContainer from '../components/ui/PageContainer';
import { API, Auth, UserSession } from '../services/api';
import MetricCard from '../components/ui/MetricCard';
import GlobalLocationSelector from '../components/ui/GlobalLocationSelector';
import { Users, UserCheck, UserX, UserPlus, Clock, Calendar, CalendarCheck, Building2, FileCheck, Briefcase, Search, RefreshCw, ArrowRight, Sparkles, TrendingUp, MapPin, CheckCircle, AlertCircle, Layers, ShieldCheck, UserCog } from 'lucide-react';
import EmployeeProfileModal from '../components/ui/EmployeeProfileModal';
import { useLocationContext } from '../context/LocationContext';

export default function HRDashboard() {
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

  // Selected employee for modal preview
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);

  // Search & Filter for live staff table
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [staffDeptFilter, setStaffDeptFilter] = useState('ALL');
  const [staffCurrentPage, setStaffCurrentPage] = useState(1);
  const staffPageSize = 6;

  // Search & Filter for recent candidate applicants
  const [candSearchQuery, setCandSearchQuery] = useState('');
  const [candStatusFilter, setCandStatusFilter] = useState('ALL');

  // Load live data from dedicated backend endpoint
  const loadDashboardData = useCallback(async (targetLoc?: string) => {
    try {
      setIsRefreshing(true);
      setError(null);
      const loc = targetLoc !== undefined ? targetLoc : currentLocation;
      const res = await API.getHRDashboard(loc && loc !== 'ALL' ? loc : undefined);
      if (res && res.success && res.data) {
        setData(res.data);
      } else {
        setError(res?.message || 'Failed to load live HR metrics');
      }
    } catch (err: any) {
      console.error('[HRDashboard] Failed to fetch live data:', err);
      setError(err?.message || 'Unable to connect to HR dashboard API');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [currentLocation]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Derived filtered staff list
  const staffList = data?.recentStaff || [];
  const filteredStaff = useMemo(() => {
    return staffList.filter((emp: any) => {
      const q = staffSearchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        (emp.name && emp.name.toLowerCase().includes(q)) ||
        (emp.employeeId && emp.employeeId.toLowerCase().includes(q)) ||
        (emp.phone && emp.phone.includes(q)) ||
        (emp.designation && emp.designation.toLowerCase().includes(q));

      const matchesDept = staffDeptFilter === 'ALL' || emp.department === staffDeptFilter;
      return matchesSearch && matchesDept;
    });
  }, [staffList, staffSearchQuery, staffDeptFilter]);

  const totalStaffPages = Math.ceil(filteredStaff.length / staffPageSize) || 1;
  const paginatedStaff = useMemo(() => {
    const start = (staffCurrentPage - 1) * staffPageSize;
    return filteredStaff.slice(start, start + staffPageSize);
  }, [filteredStaff, staffCurrentPage, staffPageSize]);

  // Derived filtered candidate applicants
  const candidateList = data?.recentCandidates || [];
  const filteredCandidates = useMemo(() => {
    return candidateList.filter((c: any) => {
      const q = candSearchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.appNo && c.appNo.toLowerCase().includes(q)) ||
        (c.designation && c.designation.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q));

      const matchesStatus = candStatusFilter === 'ALL' || (c.status || '').toLowerCase() === candStatusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [candidateList, candSearchQuery, candStatusFilter]);

  const counts = data?.counts || {};
  const deptDist = data?.departmentDistribution || [];
  const desigDist = data?.designationDistribution || [];
  const locDist = data?.locationDistribution || [];
  const candPipeline = data?.candidatePipeline || [];
  const manpowerTargets = data?.manpowerTargets || [];
  const recentActivities = data?.recentActivities || [];

  return (
    <DashboardLayout
      title="HR Manager Dashboard"
      breadcrumbs={[{ label: 'HR Workspace' }, { label: 'HR Manager Dashboard' }]}
    >
      <PageContainer maxWidth="full">
        {/* =========================================================================
            HEADER: HR WORKSPACE IDENTITY & LOCATION SCOPE
        ========================================================================== */}
        <div className="bg-white rounded-2xl border border-[#DFDDD7] shadow-xs p-5 sm:p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#101C36] text-[#C9A45C] text-[10px] font-black uppercase tracking-widest mb-2 border border-[#C9A45C]/30">
                <Users className="w-3.5 h-3.5" />
                <span>BSC Textiles · HR OPERATIONS DESK</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-[#182033] tracking-tight leading-tight">
                HR MANAGER DASHBOARD
              </h1>
              <p className="text-xs sm:text-sm font-semibold text-[#687080] mt-1">
                Workforce Intelligence, Recruitment Pipeline &amp; Talent Lifecycle across authorized locations.
              </p>
            </div>

            {/* Location Switcher & Refresh */}
            <div className="flex items-center gap-2.5 flex-shrink-0 self-start md:self-center">
              <GlobalLocationSelector />

              <button
                type="button"
                onClick={() => loadDashboardData()}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#DFDDD7] bg-[#F6F4EF] hover:bg-white text-[#182033] text-xs font-bold transition-all shadow-2xs hover:border-[#C9A45C] cursor-pointer"
                title="Refresh live HR statistics from database"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#C9A45C] ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* =========================================================================
            SECTION 1: PRIMARY HR METRIC CARDS (8 KPI Cards)
        ========================================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <MetricCard
            title="Total Employees"
            value={counts.totalEmployees || 0}
            subtext={`${counts.activeEmployees || 0} currently active`}
            icon={Users}
            color="navy"
            onClick={() => navigate('/employees')}
          />

          <MetricCard
            title="Active Staff"
            value={counts.activeEmployees || 0}
            subtext="On-duty workforce"
            icon={UserCheck}
            color="emerald"
            onClick={() => navigate('/employees')}
          />

          <MetricCard
            title="Inactive / Exited"
            value={counts.inactiveEmployees || 0}
            subtext="Exited / deactivated staff"
            icon={UserX}
            color="rose"
            onClick={() => navigate('/employees')}
          />

          <MetricCard
            title="New Joiners (30d)"
            value={counts.newEmployees || 0}
            subtext="Joined in last 30 days"
            icon={Sparkles}
            color="gold"
            onClick={() => navigate('/employees')}
          />

          <MetricCard
            title="Total Candidates"
            value={candidateList.length || counts.totalCandidates || 0}
            subtext="Applicant database records"
            icon={Briefcase}
            color="indigo"
            onClick={() => navigate('/candidates')}
          />

          <MetricCard
            title="Pending Offers (DOJ)"
            value={counts.pendingDoj || 0}
            subtext="Offers awaiting joining date"
            icon={Clock}
            color="amber"
            onClick={() => navigate('/offer-process')}
          />

          <MetricCard
            title="Interviews Today"
            value={counts.todayInterviews || 0}
            subtext={`${counts.upcomingInterviews || 0} upcoming sessions`}
            icon={CalendarCheck}
            color="teal"
            onClick={() => navigate('/candidates')}
          />

          <MetricCard
            title="Joined via Offers"
            value={counts.joinedOffers || 0}
            subtext={`Avg salary ₹${(counts.avgOfferedSalary || 0).toLocaleString()}`}
            icon={CheckCircle}
            color="emerald"
            onClick={() => navigate('/offer-process')}
          />
        </div>

        {/* =========================================================================
            SECTION 2: HR QUICK ACTIONS (Real Working Shortcuts)
        ========================================================================== */}
        <div className="bg-white rounded-2xl border border-[#DFDDD7] shadow-xs p-5 sm:p-6 mb-6">
          <div className="flex items-center justify-between border-b border-[#DFDDD7] pb-3 mb-4">
            <h2 className="text-sm font-black text-[#182033] uppercase tracking-wider flex items-center gap-2">
              <UserCog className="w-4 h-4 text-[#C9A45C]" />
              <span>HR Management Quick Actions</span>
            </h2>
            <span className="text-[11px] font-bold text-[#687080]">Direct HR Tools</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { label: '+ Candidate', path: '/candidates?add=true', icon: UserPlus, desc: 'Register candidate' },
              { label: 'Candidate CRM', path: '/candidates', icon: Users, desc: 'View applicants' },
              { label: 'Offer Desk', path: '/offer-process', icon: FileCheck, desc: 'Selection offers' },
              { label: 'Employee Dir', path: '/employees', icon: UserCheck, desc: 'All staff directory' },
              { label: 'Hiring Targets', path: '/department-hiring', icon: TrendingUp, desc: 'Dept requirements' },
              { label: 'Manpower Req', path: '/openings', icon: Briefcase, desc: 'Open vacancies' },
              { label: 'Attendance', path: '/attendance', icon: Calendar, desc: 'Daily attendance' },
              { label: 'Floor Roster', path: '/section-allocation', icon: Layers, desc: 'Section assignment' }
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
            SECTION 3: RECRUITMENT FUNNEL & DEPARTMENT DISTRIBUTION (Split Layout)
        ========================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Recruitment Funnel & Candidate Stages */}
          <div className="bg-white rounded-2xl border border-[#DFDDD7] shadow-xs p-5 sm:p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-[#DFDDD7] pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#101C36] text-[#C9A45C] flex items-center justify-center border border-[#C9A45C]/30 flex-shrink-0">
                    <Briefcase className="w-4 h-4 text-[#C9A45C]" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-[#182033] tracking-tight">CANDIDATE RECRUITMENT FUNNEL</h2>
                    <p className="text-[11px] font-semibold text-[#687080]">Live application pipeline stages</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/candidates')}
                  className="px-3 py-1.5 rounded-xl bg-[#101C36] text-white hover:bg-[#07101F] text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  <span>Candidate CRM</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {candPipeline.length > 0 ? (
                <div className="space-y-3">
                  {candPipeline.map((item: any) => {
                    const statusName = item.status || 'New';
                    const count = Number(item.count || 0);
                    return (
                      <div key={statusName} className="p-3 rounded-xl bg-[#F6F4EF] border border-[#DFDDD7] flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-[#C9A45C]" />
                          <span className="font-bold text-xs text-[#182033]">{statusName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-[#182033]">{count}</span>
                          <span className="text-[10px] text-[#687080]">applicants</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-10 text-center text-xs text-[#687080] font-semibold">
                  No candidate records currently registered in the database.
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-[#DFDDD7] flex items-center justify-between text-xs">
              <span className="text-[#687080] font-semibold">Total Offers Issued: {counts.totalOffers || 0}</span>
              <button
                type="button"
                onClick={() => navigate('/offer-process')}
                className="text-xs font-bold text-[#C9A45C] hover:underline"
              >
                View Offer Desk →
              </button>
            </div>
          </div>

          {/* Department Headcount Breakdown */}
          <div className="bg-white rounded-2xl border border-[#DFDDD7] shadow-xs p-5 sm:p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-[#DFDDD7] pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#101C36] text-[#C9A45C] flex items-center justify-center border border-[#C9A45C]/30 flex-shrink-0">
                    <Building2 className="w-4 h-4 text-[#C9A45C]" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-[#182033] tracking-tight">DEPARTMENT HEADCOUNT DISTRIBUTION</h2>
                    <p className="text-[11px] font-semibold text-[#687080]">Active staff allocation per business unit</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/department-hiring')}
                  className="px-3 py-1.5 rounded-xl border border-[#DFDDD7] bg-[#F6F4EF] hover:bg-white text-[#182033] text-xs font-bold transition-all shadow-2xs hover:border-[#C9A45C] cursor-pointer"
                >
                  Hiring Targets
                </button>
              </div>

              {deptDist.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {deptDist.map((dept: any) => (
                    <div key={dept.department} className="p-3 rounded-xl bg-[#F6F4EF] border border-[#DFDDD7] flex items-center justify-between">
                      <div className="min-w-0 pr-2">
                        <span className="font-extrabold text-xs text-[#182033] block truncate">{dept.department}</span>
                        <span className="text-[10px] text-[#687080]">Department Unit</span>
                      </div>
                      <span className="font-black text-sm text-[#101C36] px-2 py-0.5 rounded-lg bg-white border border-[#DFDDD7]">
                        {dept.count}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center text-xs text-[#687080] font-semibold">
                  No department statistics found.
                </div>
              )}
            </div>

            {/* Store Location Breakdown */}
            <div className="mt-4 pt-3 border-t border-[#DFDDD7]">
              <span className="text-[10px] font-black uppercase text-[#687080] block mb-2">STORE LOCATION HEADCOUNT</span>
              <div className="grid grid-cols-3 gap-2">
                {locDist.map((loc: any) => (
                  <div key={loc.locationId} className="p-2 rounded-xl bg-white border border-[#DFDDD7] text-center">
                    <span className="text-[10px] font-bold text-[#687080] block truncate">{loc.locationName}</span>
                    <span className="font-black text-sm text-[#182033]">{loc.staffCount}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            SECTION 4: RECENT CANDIDATE APPLICANTS TABLE
        ========================================================================== */}
        <div className="bg-white rounded-2xl border border-[#DFDDD7] shadow-xs p-5 sm:p-6 mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DFDDD7] pb-3">
            <div>
              <h2 className="font-black text-sm uppercase tracking-wider text-[#182033] flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#C9A45C]" />
                <span>Recent Candidate Applications</span>
              </h2>
              <p className="text-xs font-semibold text-[#687080] mt-0.5">
                Live applicants registered in the talent recruitment portal
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="w-4 h-4 text-[#687080] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search candidate by name, app no, role..."
                  value={candSearchQuery}
                  onChange={(e) => setCandSearchQuery(e.target.value)}
                  className="input-modern pl-9 pr-4 text-xs py-2 w-full sm:w-64"
                />
              </div>
              <button
                type="button"
                onClick={() => navigate('/candidates?add=true')}
                className="px-3 py-2 rounded-xl bg-[#101C36] text-white hover:bg-[#07101F] text-xs font-bold transition-all shadow-xs whitespace-nowrap cursor-pointer"
              >
                + Add Candidate
              </button>
            </div>
          </div>

          <div className="table-frame custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#DFDDD7] text-[10.5px] font-black uppercase text-[#687080] bg-[#F6F4EF]/60">
                  <th className="py-3 px-4">App No</th>
                  <th className="py-3 px-4">Candidate Name</th>
                  <th className="py-3 px-4">Designation</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Store Location</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DFDDD7]/60">
                {filteredCandidates.length > 0 ? (
                  filteredCandidates.map((c: any) => (
                    <tr key={c.id || c.appNo} className="hover:bg-[#F6F4EF]/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#182033]">{c.appNo || '—'}</td>
                      <td className="py-3 px-4">
                        <div className="font-extrabold text-[#182033]">{c.name}</div>
                        <div className="text-[11px] text-[#687080]">{c.phone || c.email || '—'}</div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#182033]">{c.designation || 'Candidate'}</td>
                      <td className="py-3 px-4 font-semibold text-[#687080]">{c.department || 'Retail Operations'}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#101C36]/5 text-[#101C36] border border-[#101C36]/10">
                          <MapPin className="w-3 h-3 text-[#C9A45C]" />
                          <span>{c.locationName || 'Assigned Store'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#C9A45C]/15 text-[#101C36] border border-[#C9A45C]/30">
                          {c.status || 'New'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => navigate(`/candidates?appNo=${encodeURIComponent(c.appNo || '')}`)}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg border border-[#DFDDD7] bg-white hover:bg-[#101C36] hover:text-white transition-colors cursor-pointer"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-[#687080] font-semibold">
                      {loading ? 'Loading candidates...' : 'No candidate records found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* =========================================================================
            SECTION 5: ACTIVE EMPLOYEE DIRECTORY TABLE
        ========================================================================== */}
        <div className="bg-white rounded-2xl border border-[#DFDDD7] shadow-xs p-5 sm:p-6 mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DFDDD7] pb-3">
            <div>
              <h2 className="font-black text-sm uppercase tracking-wider text-[#182033] flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#C9A45C]" />
                <span>Active Employee Directory</span>
              </h2>
              <p className="text-xs font-semibold text-[#687080] mt-0.5">
                Authorized staff across {currentLocation === 'ALL' ? 'All Stores' : `BSC Textiles ${activeLocation.name}`}
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="w-4 h-4 text-[#687080] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search staff by name, ID, phone..."
                  value={staffSearchQuery}
                  onChange={(e) => setStaffSearchQuery(e.target.value)}
                  className="input-modern pl-9 pr-4 text-xs py-2 w-full sm:w-64"
                />
              </div>

              <button
                type="button"
                onClick={() => navigate('/employees')}
                className="px-3 py-2 rounded-xl bg-[#101C36] text-white hover:bg-[#07101F] text-xs font-bold transition-all shadow-xs whitespace-nowrap cursor-pointer"
              >
                Open Directory
              </button>
            </div>
          </div>

          <div className="table-frame custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#DFDDD7] text-[10.5px] font-black uppercase text-[#687080] bg-[#F6F4EF]/60">
                  <th className="py-3 px-4">Emp ID</th>
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Role &amp; Designation</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Store Location</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DFDDD7]/60">
                {paginatedStaff.length > 0 ? (
                  paginatedStaff.map((emp: any) => (
                    <tr key={emp.id || emp.employeeId} className="hover:bg-[#F6F4EF]/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#182033]">{emp.employeeId || `EMP-${emp.id}`}</td>
                      <td className="py-3 px-4">
                        <div className="font-extrabold text-[#182033]">{emp.name}</div>
                        <div className="text-[11px] text-[#687080]">{emp.phone || emp.email || '—'}</div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#182033]">{emp.designation || emp.role || 'Staff'}</td>
                      <td className="py-3 px-4 font-semibold text-[#687080]">{emp.department || 'Store Operations'}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#101C36]/5 text-[#101C36] border border-[#101C36]/10">
                          <MapPin className="w-3 h-3 text-[#C9A45C]" />
                          <span>{emp.locationName || 'Assigned Store'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedEmployee(emp)}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg border border-[#DFDDD7] bg-white hover:bg-[#101C36] hover:text-white transition-colors cursor-pointer"
                        >
                          View Profile
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-[#687080] font-semibold">
                      {loading ? 'Loading staff records...' : 'No staff records found in database.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalStaffPages > 1 && (
            <div className="flex items-center justify-between pt-3 border-t border-[#DFDDD7] text-xs">
              <span className="text-[#687080] font-semibold">
                Showing {Math.min(filteredStaff.length, (staffCurrentPage - 1) * staffPageSize + 1)} to {Math.min(filteredStaff.length, staffCurrentPage * staffPageSize)} of {filteredStaff.length} employees
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setStaffCurrentPage(p => Math.max(1, p - 1))}
                  disabled={staffCurrentPage === 1}
                  className="px-2.5 py-1 rounded-lg border border-[#DFDDD7] bg-white text-[#182033] font-bold disabled:opacity-40 cursor-pointer"
                >
                  Prev
                </button>
                <span className="font-bold text-[#182033] px-1">{staffCurrentPage} / {totalStaffPages}</span>
                <button
                  type="button"
                  onClick={() => setStaffCurrentPage(p => Math.min(totalStaffPages, p + 1))}
                  disabled={staffCurrentPage === totalStaffPages}
                  className="px-2.5 py-1 rounded-lg border border-[#DFDDD7] bg-white text-[#182033] font-bold disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* =========================================================================
            SECTION 6: RECENT HR ACTIVITIES & AUDIT LOGS
        ========================================================================== */}
        <div className="bg-white rounded-2xl border border-[#DFDDD7] shadow-xs p-5 sm:p-6 mb-6">
          <div className="flex items-center justify-between border-b border-[#DFDDD7] pb-3 mb-4">
            <h2 className="text-sm font-black text-[#182033] uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#C9A45C]" />
              <span>Recent HR Activity &amp; Audit Log</span>
            </h2>
            <span className="text-[11px] font-bold text-[#687080]">Real-time system events</span>
          </div>

          {recentActivities.length > 0 ? (
            <div className="space-y-2.5">
              {recentActivities.map((act: any) => (
                <div key={act.id} className="p-3 rounded-xl bg-[#F6F4EF] border border-[#DFDDD7] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white border border-[#DFDDD7] flex items-center justify-center font-black text-xs text-[#101C36]">
                      {(act.username || 'HR').slice(0, 2).toUpperCase()}
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
              No recent HR audit records available.
            </div>
          )}
        </div>

        {/* Employee Profile Preview Modal */}
        {selectedEmployee && (
          <EmployeeProfileModal
            employee={selectedEmployee}
            onClose={() => setSelectedEmployee(null)}
          />
        )}
      </PageContainer>
    </DashboardLayout>
  );
}
