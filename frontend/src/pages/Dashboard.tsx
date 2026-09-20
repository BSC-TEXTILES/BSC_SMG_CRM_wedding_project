import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import { getSidebarCollapsed, subscribeSidebarCollapsed } from '../utils/sidebarState';
import { getDashboardTypeForRole, getDashboardLabelForRole } from '../utils/dashboardRouting';
import MetricCard from '../components/ui/MetricCard';
import PageHeader from '../components/ui/PageHeader';
import {
  Users,
  UserCheck,
  CheckCircle,
  UserPlus,
  Clock,
  Calendar,
  AlertTriangle,
  ArrowRight,
  Search,
  Filter,
  BarChart3,
  Sparkles,
  TrendingUp,
  CalendarCheck,
  Building2,
  FileCheck,
  LogOut,
  Target,
  DollarSign,
  Footprints,
  MessageSquare,
  PhoneCall,
  QrCode,
  LogIn,
  ShieldCheck,
  ShieldAlert,
  FileText,
  CheckSquare,
  Settings
} from 'lucide-react';
import EmployeeProfileModal from '../components/ui/EmployeeProfileModal';


export default function DashboardPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(getSidebarCollapsed());
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);

  useEffect(() => {
    return subscribeSidebarCollapsed(setCollapsed);
  }, []);

  // Employees & Operational Stats
  const [employees, setEmployees] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);

  // Operational Kiosk KPIs
  const [footfallToday, setFootfallToday] = useState(0);
  const [openDivertsCount, setOpenDivertsCount] = useState(0);

  // Feedback Collections Stats
  const [feedbackStats, setFeedbackStats] = useState({
    totalFeedback: 0,
    positiveFeedback: 0,
    negativeFeedback: 0,
    npsScore: 100,
    pendingCallQueue: 0,
    totalCallQueue: 0
  });

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  const loadData = useCallback(async () => {
    try {
      const [empData, candData, ffData, divData, fbData] = await Promise.all([
        API.getEmployees().catch(() => ({ employees: [] })),
        API.getCandidates({ limit: 500 }).catch(() => ({ candidates: [] })),
        API.getFootfall().catch(() => ({ entries: [] })),
        API.getDiverts().catch(() => ({ diverts: [] })),
        API.getFeedbackStats().catch(() => ({
          totalFeedback: 0,
          positiveFeedback: 0,
          negativeFeedback: 0,
          npsScore: 100,
          pendingCallQueue: 0,
          totalCallQueue: 0
        }))
      ]);

      if (empData && empData.employees) setEmployees(empData.employees);
      if (candData && candData.candidates) setCandidates(candData.candidates);

      if (ffData && ffData.entries) {
        const tot = ffData.entries.reduce((sum: number, e: any) => sum + (Number(e.visitors !== undefined ? e.visitors : e.visitorsCount || e.visitors_count) || 0), 0);
        setFootfallToday(tot);
      }
      if (divData && divData.diverts) {
        const openDivs = divData.diverts.filter((d: any) => d.status === 'Open' || d.status === 'In Progress').length;
        setOpenDivertsCount(openDivs);
      }
      if (fbData && fbData.success) {
        setFeedbackStats({
          totalFeedback: fbData.totalFeedback || 0,
          positiveFeedback: fbData.positiveFeedback || 0,
          negativeFeedback: fbData.negativeFeedback || 0,
          npsScore: fbData.npsScore || 100,
          pendingCallQueue: fbData.pendingCallQueue || 0,
          totalCallQueue: fbData.totalCallQueue || 0
        });
      }
    } catch (err: any) {
      console.warn('Dashboard data load warning:', err.message);
    }
  }, []);

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    const sess = Auth.get();
    if (sess?.role === 'Greeter') {
      navigate('/footfall', { replace: true });
      return;
    }
    setSession(sess);
    loadData();
  }, [loadData, navigate]);

  // Gender Statistics for Active Employees
  const femaleEmployees = useMemo(() => {
    return employees.filter(e => {
      const g = (e.gender || '').toLowerCase().trim();
      return ['f', 'female', 'girl', 'women', 'woman'].includes(g);
    }).length;
  }, [employees]);

  const maleEmployees = useMemo(() => {
    return employees.filter(e => {
      const g = (e.gender || '').toLowerCase().trim();
      return ['m', 'male', 'boy', 'men', 'man'].includes(g);
    }).length;
  }, [employees]);

  // Department Distribution Breakdown
  const deptBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    employees.forEach(e => {
      const d = e.department || 'General Floor Staff';
      counts[d] = (counts[d] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({
      name,
      count,
      pct: employees.length > 0 ? Math.round((count / employees.length) * 100) : 0
    }));
  }, [employees]);

  // Filtered Active Employee List
  const filteredEmployees = useMemo(() => {
    let list = [...employees];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e => 
        (e.name && e.name.toLowerCase().includes(q)) ||
        (e.empNo && e.empNo.toLowerCase().includes(q)) ||
        (e.appNo && e.appNo.toLowerCase().includes(q)) ||
        (e.department && e.department.toLowerCase().includes(q)) ||
        (e.desig && e.desig.toLowerCase().includes(q)) ||
        (e.section && e.section.toLowerCase().includes(q))
      );
    }
    return list;
  }, [employees, searchQuery]);

  const totalPages = Math.ceil(filteredEmployees.length / pageSize) || 1;
  const paginatedEmployees = filteredEmployees.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const isGreeter = session?.role === 'Greeter';

  // Role detection for the three dashboards: Admin Dashboard, HR Dashboard, Manager Dashboard
  const [searchParams] = useSearchParams();
  const requestedView = searchParams.get('view');
  const roleType = getDashboardTypeForRole(session?.role);
  const activeDashboard = (requestedView === 'admin' || requestedView === 'hr' || requestedView === 'manager')
    ? requestedView
    : roleType;

  const isAdminUser = ['Admin', 'Super Admin'].includes(session?.role || '');
  const isAdminDashboard = activeDashboard === 'admin';
  const isHRDashboard = activeDashboard === 'hr';
  const isManagerDashboard = activeDashboard === 'manager';

  const dashboardTitle = isGreeter
    ? "Entrance Greeter & Visitor Desk"
    : isAdminDashboard
    ? "Admin Dashboard"
    : isHRDashboard
    ? "HR Dashboard"
    : "Manager Dashboard";

  return (
    <div className="min-h-screen bg-background flex">
      <ToastContainer />
      
      <Sidebar 
        session={session} 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />

      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${collapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        <Topbar 
          title={dashboardTitle} 
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="p-4 lg:p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Header Banner */}
          <div className="card-glass p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary text-accent text-[10px] font-black uppercase tracking-widest mb-1.5">
                <Building2 className="w-3.5 h-3.5" />
                <span>
                  {isGreeter
                    ? 'GREETER KIOSK • BSC EXCLUSIVE'
                    : isAdminDashboard
                    ? 'ADMIN DASHBOARD • EXECUTIVE WORKSPACE'
                    : isHRDashboard
                    ? 'HR DASHBOARD • TALENT MANAGEMENT'
                    : 'MANAGER DASHBOARD • STORE OPERATIONS'}
                </span>
              </div>
              <h2 className="text-xl font-black text-primary tracking-tight flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-accent" />
                <span>
                  {isGreeter
                    ? 'Entrance Greeter & Visitor Operations Hub'
                    : isAdminDashboard
                    ? 'Admin Dashboard — Executive & Workforce Operations'
                    : isHRDashboard
                    ? 'HR Dashboard — Talent Acquisition & Employee Operations'
                    : 'Manager Dashboard — Store Floor & Service Operations'}
                </span>
              </h2>
              <p className="text-xs text-primary font-medium mt-0.5">
                {isGreeter 
                  ? 'Real-time visitor footfall counters, entrance greeter kiosk, customer feedback QR & sourcing diverts.'
                  : isAdminDashboard
                  ? 'Executive storewide operational metrics, active employee directory, customer CSAT index & admin controls.'
                  : isHRDashboard
                  ? 'Active workforce directory, candidate pipeline, recruitment offers & attendance rosters.'
                  : 'Daily MCheck audits, hourly footfall registers, feedback call queues & merchandise diverts.'
                }
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isAdminUser && (
                <div className="hidden md:flex items-center gap-1 bg-white p-1 rounded-xl border border-accent-soft shadow-xs text-xs font-bold mr-2">
                  <button
                    onClick={() => navigate('/dashboard?view=admin')}
                    className={`px-2.5 py-1.5 rounded-lg transition-all text-[11px] ${isAdminDashboard ? 'bg-primary text-white shadow-xs' : 'text-primary hover:text-primary'}`}
                  >
                    Admin
                  </button>
                  <button
                    onClick={() => navigate('/dashboard?view=hr')}
                    className={`px-2.5 py-1.5 rounded-lg transition-all text-[11px] ${isHRDashboard ? 'bg-primary text-white shadow-xs' : 'text-primary hover:text-primary'}`}
                  >
                    HR
                  </button>
                  <button
                    onClick={() => navigate('/dashboard?view=manager')}
                    className={`px-2.5 py-1.5 rounded-lg transition-all text-[11px] ${isManagerDashboard ? 'bg-primary text-white shadow-xs' : 'text-primary hover:text-primary'}`}
                  >
                    Manager
                  </button>
                </div>
              )}

              {isGreeter ? (
                <>
                  <button 
                    onClick={() => navigate('/greeter')} 
                    className="btn-gold text-xs px-4 py-2 flex items-center gap-1.5 shadow-sm font-extrabold"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>Greeter Kiosk</span>
                  </button>
                  <button 
                    onClick={() => navigate('/footfall')} 
                    className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 shadow-sm font-extrabold"
                  >
                    <Footprints className="w-4 h-4" />
                    <span>Hourly Footfall</span>
                  </button>
                  <button 
                    onClick={() => navigate('/feedback-qr')} 
                    className="px-4 py-2 rounded-xl bg-white border border-accent-soft text-primary text-xs font-extrabold hover:bg-gray-50 flex items-center gap-1.5 shadow-xs"
                  >
                    <QrCode className="w-4 h-4 text-accent" />
                    <span>Feedback QR</span>
                  </button>
                </>
              ) : isAdminDashboard ? (
                <>
                  <button 
                    onClick={() => navigate('/user-management')} 
                    className="btn-gold text-xs px-4 py-2 flex items-center gap-1.5 shadow-sm font-extrabold"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>User Management</span>
                  </button>
                  <button 
                    onClick={() => navigate('/settings')} 
                    className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 shadow-sm font-extrabold"
                  >
                    <Settings className="w-4 h-4" />
                    <span>System Settings</span>
                  </button>
                  <button 
                    onClick={() => navigate('/attendance')} 
                    className="px-4 py-2 rounded-xl bg-white border border-accent-soft text-primary text-xs font-extrabold hover:bg-gray-50 flex items-center gap-1.5 shadow-xs"
                  >
                    <CalendarCheck className="w-4 h-4 text-accent" />
                    <span>Attendance</span>
                  </button>
                </>
              ) : isHRDashboard ? (
                <>
                  <button 
                    onClick={() => navigate('/candidates')} 
                    className="btn-gold text-xs px-4 py-2 flex items-center gap-1.5 shadow-sm font-extrabold"
                  >
                    <Users className="w-4 h-4" />
                    <span>Candidate CRM</span>
                  </button>
                  <button 
                    onClick={() => navigate('/offer-process')} 
                    className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 shadow-sm font-extrabold"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Wedding Operations</span>
                  </button>
                  <button 
                    onClick={() => navigate('/attendance')} 
                    className="px-4 py-2 rounded-xl bg-white border border-accent-soft text-primary text-xs font-extrabold hover:bg-gray-50 flex items-center gap-1.5 shadow-xs"
                  >
                    <CalendarCheck className="w-4 h-4 text-accent" />
                    <span>Mark Attendance</span>
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => navigate('/daily-mcheck')} 
                    className="btn-gold text-xs px-4 py-2 flex items-center gap-1.5 shadow-sm font-extrabold"
                  >
                    <CheckSquare className="w-4 h-4" />
                    <span>Daily MCheck</span>
                  </button>
                  <button 
                    onClick={() => navigate('/footfall')} 
                    className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 shadow-sm font-extrabold"
                  >
                    <Footprints className="w-4 h-4" />
                    <span>Hourly Footfall</span>
                  </button>
                  <button 
                    onClick={() => navigate('/feedback-collection')} 
                    className="px-4 py-2 rounded-xl bg-white border border-accent-soft text-primary text-xs font-extrabold hover:bg-gray-50 flex items-center gap-1.5 shadow-xs"
                  >
                    <MessageSquare className="w-4 h-4 text-accent" />
                    <span>Feedback Queue</span>
                  </button>
                </>
              )}
            </div>
          </div>

          
          

          {/* Metric Cards Section */}
          {isGreeter ? (
            /* Greeter-Only Visitor Operational Metrics */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Today Visitor Count"
                value={footfallToday}
                subtext="Logged hourly footfall entries"
                icon={Footprints}
                color="emerald"
                onClick={() => navigate('/footfall')}
              />
              <MetricCard
                title="Entrance Greeter Kiosk"
                value="Launch Desk"
                subtext="Entrance clicker & visitor log"
                icon={UserCheck}
                color="navy"
                onClick={() => navigate('/greeter')}
              />
              <MetricCard
                title="Customer Feedback QR"
                value="Display QR"
                subtext="Display customer survey tablet QR"
                icon={QrCode}
                color="gold"
                onClick={() => navigate('/feedback-qr')}
              />
              <MetricCard
                title="Customer Feedbacks"
                value={feedbackStats.totalFeedback}
                subtext={`CSAT: ${feedbackStats.npsScore}% • Neg: ${feedbackStats.negativeFeedback}`}
                icon={MessageSquare}
                color="teal"
                onClick={() => navigate('/feedback-collection')}
              />
            </div>
          ) : (
            /* Admin / HR / Manager Full Metric Cards Grid */
            <>
              {/* Primary Metric Cards Grid - Row 1 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Active Store Staff"
                  value={employees.length}
                  subtext={`Female: ${femaleEmployees} • Male: ${maleEmployees}`}
                  icon={Users}
                  color="navy"
                  onClick={() => navigate('/employees')}
                />
                <MetricCard
                  title="Customer Feedbacks"
                  value={feedbackStats.totalFeedback}
                  subtext={`Positive: ${feedbackStats.positiveFeedback} • Neg: ${feedbackStats.negativeFeedback}`}
                  icon={MessageSquare}
                  color="gold"
                  onClick={() => navigate('/feedback-collection')}
                />
                <MetricCard
                  title="Pending Call Queue"
                  value={feedbackStats.pendingCallQueue}
                  subtext="Negative feedback calls awaiting action"
                  icon={PhoneCall}
                  color="rose"
                  onClick={() => navigate('/feedback-list')}
                />
                <MetricCard
                  title="Satisfaction NPS"
                  value={`${feedbackStats.npsScore}%`}
                  subtext="Customer feedback rating index"
                  icon={Sparkles}
                  color="teal"
                  onClick={() => navigate('/feedback-collection')}
                />
              </div>

              {/* Secondary Store Floor Operations KPIs - Row 2 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Today Visitor Count"
                  value={footfallToday}
                  subtext="Logged footfall entries today"
                  icon={Footprints}
                  color="emerald"
                  onClick={() => navigate('/footfall')}
                />
                <MetricCard
                  title="Total Call Queue"
                  value={feedbackStats.totalCallQueue}
                  subtext={`Pending: ${feedbackStats.pendingCallQueue} callbacks`}
                  icon={PhoneCall}
                  color="gold"
                  onClick={() => navigate('/feedback-list')}
                />
                <MetricCard
                  title="Sourcing Diverts"
                  value={openDivertsCount}
                  subtext="Active merchandise requests"
                  icon={Target}
                  color="amber"
                  onClick={() => navigate('/divert')}
                />
                <MetricCard
                  title="Feedback QR Portal"
                  value="Scan QR"
                  subtext="Display customer survey tablet QR"
                  icon={QrCode}
                  color="indigo"
                  onClick={() => navigate('/feedback-qr')}
                />
              </div>
            </>
          )}

          {/* Main Content Area */}
          {isGreeter ? (
            /* Greeter-Only Simplified Visitor Management Modules Grid */
            <div className="card-glass p-6 space-y-5">
              <div className="border-b border-accent-soft pb-3">
                <h3 className="font-extrabold text-primary text-base tracking-tight flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-accent" />
                  <span>Greeter Visitor Management Desks</span>
                </h3>
                <p className="text-xs text-primary font-medium mt-0.5">Quick access to assigned visitor and footfall operations.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { label: 'Greeter Kiosk', path: '/greeter', icon: UserCheck, desc: 'Entrance clicker counter & visitor logging tablet', color: 'bg-navy-50 text-primary' },
                  { label: 'Hourly Footfall Register', path: '/footfall', icon: Footprints, desc: 'View & submit hourly customer footfall entries', color: 'bg-emerald-50 text-emerald-800' },
                  { label: 'Customer Feedback QR', path: '/feedback-qr', icon: QrCode, desc: 'Display QR code for customer experience survey', color: 'bg-amber-50 text-amber-800' },
                  { label: 'Feedback Collection', path: '/feedback-collection', icon: MessageSquare, desc: 'View collected customer feedback entries & CSAT', color: 'bg-indigo-50 text-indigo-800' },
                  { label: 'Feedback Call Queue', path: '/feedback-list', icon: PhoneCall, desc: 'View telecaller followup queue for negative feedback', color: 'bg-rose-50 text-rose-800' },
                  { label: 'Sourcing Diverts', path: '/divert', icon: Target, desc: 'Raise merchandise requests for unsupplied items', color: 'bg-primary/5 text-primary' },
                  { label: 'VM Checklist Audit', path: '/vm-checklist', icon: FileCheck, desc: 'Visual merchandising daily checklist audit', color: 'bg-sky-50 text-sky-800' },
                  { label: 'Live TV Monitor Screen', path: '/tv', icon: BarChart3, desc: 'Live store operational monitor display', color: 'bg-purple-50 text-purple-800' }
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      onClick={() => navigate(item.path)}
                      className="p-5 rounded-2xl border border-accent-soft bg-background hover:bg-primary hover:text-white transition-all text-left group flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md"
                    >
                      <div className="flex items-center justify-between">
                        <div className="p-3 rounded-xl bg-white border border-accent-soft group-hover:bg-black/20 group-hover:border-black/30 text-primary group-hover:text-black">
                          <Icon className="w-5 h-5" />
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-black transition-transform group-hover:translate-x-1" />
                      </div>
                      <div>
                        <div className="font-black text-sm text-primary group-hover:text-black">{item.label}</div>
                        <div className="text-xs text-primary group-hover:text-black font-medium mt-1 leading-relaxed">{item.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Admin / HR / Manager Full Layout: Workforce Breakdown + Employee Table */
            <>
              {/* Middle Layout: Workforce Department Breakdown + Quick Operations Links */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Department Breakdown */}
                <div className="card-glass p-5 lg:col-span-2 space-y-5 flex flex-col justify-between">
                  <div>
                    <h3 className="font-extrabold text-primary text-base tracking-tight flex items-center justify-between">
                      <span>Workforce Distribution by Department</span>
                      <span className="text-xs font-bold text-accent bg-accent/10 px-2.5 py-1 rounded-full">
                        {employees.length} Total Onboarded Staff
                      </span>
                    </h3>
                    <p className="text-xs text-primary font-medium mt-1">Active staff strength across Mens, Ladies, Sarees, Kids &amp; Operations.</p>
                  </div>

                  <div className="space-y-3.5 my-2">
                    {deptBreakdown.length > 0 ? (
                      deptBreakdown.map((d) => (
                        <div key={d.name} className="space-y-1 text-xs">
                          <div className="flex items-center justify-between font-extrabold text-primary">
                            <span>{d.name}</span>
                            <span>{d.count} Staff ({d.pct}%)</span>
                          </div>
                          <div className="w-full h-2.5 bg-accent-soft rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full transition-all duration-300"
                              style={{ width: `${Math.max(d.pct, 4)}%` }}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-xs text-gray-500 font-semibold">
                        No department breakdown available. Add employees to populate.
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-accent-soft flex items-center justify-between text-xs font-bold text-primary">
                    <span>Registered Staff Members: {employees.length}</span>
                    <button onClick={() => navigate('/employees')} className="text-accent hover:underline flex items-center gap-1">
                      <span>View Full Employee Register</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Quick Operations Hub Links */}
                <div className="card-glass p-5 space-y-4 flex flex-col justify-between">
                  <div>
                    <h3 className="font-extrabold text-primary text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-accent" />
                      <span>Store Operations Quick Links</span>
                    </h3>
                    <p className="text-xs text-primary font-medium mt-0.5">Quick access to daily store floor desks</p>
                  </div>

                  <div className="space-y-2.5">
                    {[
                      { label: 'Feedback Collection', path: '/feedback-collection', icon: MessageSquare, desc: 'View collected customer feedbacks & CSAT' },
                      { label: 'Feedback Call Queue', path: '/feedback-list', icon: MessageSquare, desc: 'View customer survey call queue' },
                      { label: 'Employee Register', path: '/employees', icon: Users, desc: 'Manage full staff directory & profiles' },
                      { label: 'Section Allocation', path: '/section-allocation', icon: Building2, desc: 'Assign staff to store floor sections' },
                      { label: 'Staff Attendance', path: '/attendance', icon: CalendarCheck, desc: 'Mark daily attendance register' },
                      { label: 'Cash Settlement Desk', path: '/cash-settlement', icon: DollarSign, desc: 'POS daily cash counter settlement' },
                      { label: 'Candidate Applicants', path: '/candidates', icon: UserPlus, desc: 'View applicant pool for new hiring' }
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.label}
                          onClick={() => navigate(item.path)}
                          className="w-full p-3 rounded-xl border border-accent-soft bg-background hover:bg-primary hover:text-white transition-all text-left group flex items-center gap-3 shadow-xs"
                        >
                          <div className="p-2 rounded-lg bg-white border border-accent-soft group-hover:bg-black/20 group-hover:border-black/30 text-primary group-hover:text-black">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-extrabold text-xs text-primary group-hover:text-black">{item.label}</div>
                            <div className="text-[10px] text-primary group-hover:text-black">{item.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Active Employee Directory Table */}
              <div className="card-glass p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-accent-soft pb-3">
                  <div>
                    <h3 className="font-extrabold text-primary text-base tracking-tight flex items-center gap-2">
                      <UserCheck className="w-5 h-5 text-accent" />
                      <span>Active Store Staff Directory</span>
                    </h3>
                    <p className="text-xs text-primary font-medium mt-0.5">
                      Showing registered employees — {session?.isGlobalAdmin ? 'All Locations' : `BSC EXCLUSIVE ${(session?.locationName || 'DAVANAGERE').toUpperCase()}`}.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-initial">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search employee by name, ID, section..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="input-modern pl-9 pr-4 text-xs py-2 w-full sm:w-64"
                      />
                    </div>
                    <button onClick={() => navigate('/employees')} className="btn-primary text-xs py-2 whitespace-nowrap shadow-sm">
                      + Employee Directory
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-accent-soft text-[10.5px] font-black uppercase text-primary bg-background/60">
                        <th className="py-3 px-4">Emp / App ID</th>
                        <th className="py-3 px-4">Employee Name</th>
                        <th className="py-3 px-4">Designation</th>
                        <th className="py-3 px-4">Department</th>
                        <th className="py-3 px-4">Section</th>
                        <th className="py-3 px-4">Joining Date</th>
                        <th className="py-3 px-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-accent-soft/60">
                      {paginatedEmployees.length > 0 ? (
                        paginatedEmployees.map((emp) => (
                          <tr key={emp.appNo || emp.empNo} className="hover:bg-black/5 font-medium transition-colors">
                            <td className="py-3.5 px-4 font-mono font-extrabold text-primary">{emp.empNo || emp.appNo}</td>
                            <td className="py-3.5 px-4 font-extrabold text-primary">
                              <button
                                onClick={() => setSelectedEmployee(emp)}
                                className="hover:text-accent hover:underline text-left transition-colors flex items-center gap-1.5"
                                title="Click to view full employee overview card"
                              >
                                <span>{emp.name || emp.fullName}</span>
                              </button>
                            </td>
                            <td className="py-3.5 px-4 text-[#5D4E42] font-semibold">{emp.desig || emp.designation || 'Staff'}</td>
                            <td className="py-3.5 px-4 text-[#5D4E42] font-semibold">{emp.department || '—'}</td>
                            <td className="py-3.5 px-4 text-accent font-extrabold">{emp.section || 'Unassigned'}</td>
                            <td className="py-3.5 px-4 text-[#5D4E42] font-mono">{emp.actualDoj || emp.offeredDoj || emp.date || '—'}</td>
                            <td className="py-3.5 px-4 text-right">
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                                Active Staff
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-gray-500 font-semibold">
                            No employees found matching your query.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-3 border-t border-accent-soft text-xs font-bold">
                    <span className="text-gray-500">
                      Page {currentPage} of {totalPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => p - 1)}
                        className="px-3 py-1.5 rounded-lg border border-accent-soft bg-white text-primary disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(p => p + 1)}
                        className="px-3 py-1.5 rounded-lg border border-accent-soft bg-white text-primary disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Universal 360 Employee Profile Overview Modal */}
      <EmployeeProfileModal
        employee={selectedEmployee}
        onClose={() => setSelectedEmployee(null)}
        onUpdated={loadData}
      />
    </div>
  );
}
