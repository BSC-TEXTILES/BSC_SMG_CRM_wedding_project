import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import { useLocationContext } from '../context/LocationContext';
import { getSidebarCollapsed, subscribeSidebarCollapsed } from '../utils/sidebarState';
import {
  CalendarClock,
  TriangleAlert,
  CheckCircle,
  Clock,
  Search,
  Phone,
  Calendar,
  UserCheck,
  CircleX,
  Store,
  RefreshCw,
  X,
  Eye,
  Plus,
  MessageSquare,
  ChevronRight,
  Filter,
  User,
  Building2,
  MapPin,
  Sparkles,
  AlertCircle,
  FileText,
  Mail,
  Briefcase,
  History,
  PhoneCall,
  Clock3,
  CalendarPlus,
  ArrowUpDown,
  Tag
} from 'lucide-react';
import ModalPortal from '../components/ui/ModalPortal';

// ── Interfaces ────────────────────────────────────────────────────────
interface CandidateDojItem {
  app_no: string;
  name: string;
  phone: string;
  email?: string;
  designation?: string;
  department?: string;
  section?: string;
  source?: string;
  referrer?: string;
  reporting_manager?: string;
  salary?: string | number;
  experience?: string;
  qualification?: string;
  city_state?: string;
  candidate_remarks?: string;
  candidate_status: string;
  offer_date?: string;
  scheduled_doj: string;
  offer_status?: string;
  notice_period?: string;
  offer_remarks?: string;
  location_id: number;
  location_name?: string;
  location_code?: string;
  delay_days: number;
  doj_urgency: 'Overdue' | 'Joining Today' | 'Upcoming';
  last_followup_date?: string;
  last_contact_result?: string;
  last_followup_remarks?: string;
  next_action?: string;
}

interface JoinedEmployeeItem {
  id?: number;
  app_no?: string;
  emp_code: string;
  name: string;
  phone: string;
  email?: string;
  designation: string;
  department: string;
  section?: string;
  joined_date: string;
  location_id: number;
  location_name: string;
  location_code: string;
  reporting_manager?: string;
  staff_status: string;
  joining_verification?: string;
}

interface DojHistoryEvent {
  id: number;
  app_no: string;
  event_type: string;
  previous_doj?: string | null;
  new_doj?: string | null;
  contact_result?: string | null;
  candidate_response?: string | null;
  reporting_time?: string | null;
  reason?: string | null;
  remarks?: string | null;
  verification_status?: string | null;
  performed_by: string;
  created_at: string;
}

interface DeskStats {
  total: number;
  overdue: number;
  today: number;
  upcoming: number;
  activeStaff: number;
}

type TabKey = 'not_joined' | 'today' | 'overdue' | 'upcoming' | 'joined_store';

export default function DojDesk() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(getSidebarCollapsed());
  const [loading, setLoading] = useState(true);

  // Active View Tab
  const [activeTab, setActiveTab] = useState<TabKey>('not_joined');

  // Candidate and Employee Data
  const [candidates, setCandidates] = useState<CandidateDojItem[]>([]);
  const [stats, setStats] = useState<DeskStats>({ total: 0, overdue: 0, today: 0, upcoming: 0, activeStaff: 0 });
  const [joinedEmployees, setJoinedEmployees] = useState<JoinedEmployeeItem[]>([]);
  const [joinedCount, setJoinedCount] = useState(0);

  // Search & Filters
  const { isGlobalAdmin, availableLocations, currentLocation } = useLocationContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLocation, setFilterLocation] = useState<string>(() => {
    return isGlobalAdmin ? 'all' : (currentLocation !== 'ALL' ? currentLocation : String(Auth.get()?.locationId || '3'));
  });
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');

  // Modals State
  const [markJoinedModal, setMarkJoinedModal] = useState<{
    open: boolean;
    candidate: CandidateDojItem | null;
    actualDoj: string;
    reportingTime: string;
    department: string;
    designation: string;
    section: string;
    locationId: number;
    reportingManager: string;
    employeeCode: string;
    verificationStatus: string;
    joiningRemarks: string;
  }>({
    open: false,
    candidate: null,
    actualDoj: '',
    reportingTime: '09:30 AM',
    department: '',
    designation: '',
    section: '',
    locationId: 1,
    reportingManager: '',
    employeeCode: '',
    verificationStatus: 'Verified',
    joiningRemarks: ''
  });

  const [rescheduleModal, setRescheduleModal] = useState<{
    open: boolean;
    candidate: CandidateDojItem | null;
    newDoj: string;
    reportingTime: string;
    reason: string;
    remarks: string;
  }>({
    open: false,
    candidate: null,
    newDoj: '',
    reportingTime: '10:00 AM',
    reason: 'Candidate requested extra time',
    remarks: ''
  });

  const [followUpModal, setFollowUpModal] = useState<{
    open: boolean;
    candidate: CandidateDojItem | null;
    contactResult: string;
    candidateResponse: string;
    nextAction: string;
    nextFollowupDate: string;
    remarks: string;
  }>({
    open: false,
    candidate: null,
    contactResult: 'Call Connected - Confirmed',
    candidateResponse: '',
    nextAction: 'Ready for Joining',
    nextFollowupDate: '',
    remarks: ''
  });

  const [dropModal, setDropModal] = useState<{
    open: boolean;
    candidate: CandidateDojItem | null;
    reason: string;
    remarks: string;
  }>({
    open: false,
    candidate: null,
    reason: 'Accepted another offer',
    remarks: ''
  });

  const [detailModal, setDetailModal] = useState<{
    open: boolean;
    candidate: CandidateDojItem | null;
    history: DojHistoryEvent[];
    loadingHistory: boolean;
  }>({
    open: false,
    candidate: null,
    history: [],
    loadingHistory: false
  });

  const [quickAddModal, setQuickAddModal] = useState<{
    open: boolean;
    name: string;
    phone: string;
    email: string;
    designation: string;
    department: string;
    section: string;
    locationId: number;
    offeredDoj: string;
    reportingTime: string;
    salary: string;
    noticePeriod: string;
    reportingManager: string;
    remarks: string;
  }>({
    open: false,
    name: '',
    phone: '',
    email: '',
    designation: 'Floor Executive',
    department: 'Sales',
    section: 'Normal Sarees',
    locationId: 1,
    offeredDoj: new Date().toISOString().split('T')[0],
    reportingTime: '09:30 AM',
    salary: '',
    noticePeriod: 'Immediate',
    reportingManager: '',
    remarks: ''
  });

  const [actionBusy, setActionBusy] = useState(false);

  // Sync sidebar collapsed
  useEffect(() => {
    return subscribeSidebarCollapsed(setCollapsed);
  }, []);

  // Check auth
  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    setSession(Auth.get());
  }, [navigate]);

  // Load Data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Determine query filterType according to active tab
      let filterType = 'all';
      if (activeTab === 'today') filterType = 'today';
      else if (activeTab === 'overdue') filterType = 'overdue';
      else if (activeTab === 'upcoming') filterType = 'upcoming';

      if (activeTab === 'joined_store') {
        const q = new URLSearchParams();
        if (searchQuery.trim()) q.append('search', searchQuery.trim());
        if (filterDepartment !== 'all') q.append('department', filterDepartment);
        if (filterLocation !== 'all') q.append('locationId', filterLocation);

        const res = await API.get(`/employees/joined-store?${q.toString()}`);
        if (res.success) {
          setJoinedEmployees(res.employees || []);
          setJoinedCount(res.count || (res.employees || []).length);
        }
      } else {
        const q = new URLSearchParams();
        if (searchQuery.trim()) q.append('search', searchQuery.trim());
        if (filterDepartment !== 'all') q.append('department', filterDepartment);
        if (filterLocation !== 'all') q.append('locationId', filterLocation);
        if (filterType !== 'all') q.append('filterType', filterType);

        const res = await API.get(`/employees/not-joined?${q.toString()}`);
        if (res.success) {
          setCandidates(res.candidates || []);
          if (res.stats) {
            setStats(res.stats);
          }
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load desk data', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery, filterDepartment, filterLocation]);

  useEffect(() => {
    loadData();

    const handleLocChange = () => {
      loadData();
    };
    window.addEventListener('bsc_location_changed', handleLocChange);
    return () => window.removeEventListener('bsc_location_changed', handleLocChange);
  }, [loadData]);

  // Unique departments for filter dropdown
  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    candidates.forEach((c) => {
      if (c.department) set.add(c.department);
    });
    joinedEmployees.forEach((e) => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set).sort();
  }, [candidates, joinedEmployees]);

  // Filtered candidate list based on date range (client-side refinement)
  const displayCandidates = useMemo(() => {
    let list = candidates;
    if (filterDateFrom) {
      list = list.filter((c) => c.scheduled_doj && c.scheduled_doj >= filterDateFrom);
    }
    if (filterDateTo) {
      list = list.filter((c) => c.scheduled_doj && c.scheduled_doj <= filterDateTo);
    }
    return list;
  }, [candidates, filterDateFrom, filterDateTo]);

  // Filtered employee directory based on date range
  const displayEmployees = useMemo(() => {
    let list = joinedEmployees;
    if (filterDateFrom) {
      list = list.filter((e) => e.joined_date && e.joined_date >= filterDateFrom);
    }
    if (filterDateTo) {
      list = list.filter((e) => e.joined_date && e.joined_date <= filterDateTo);
    }
    return list;
  }, [joinedEmployees, filterDateFrom, filterDateTo]);

  // Clear all filters
  const handleClearFilters = () => {
    setSearchQuery('');
    setFilterLocation('all');
    setFilterDepartment('all');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  // ── Open Detail Drawer & Fetch History ─────────────────────────
  const handleOpenDetail = async (candidate: CandidateDojItem) => {
    setDetailModal({
      open: true,
      candidate,
      history: [],
      loadingHistory: true
    });
    try {
      const res = await API.get(`/employees/not-joined/${candidate.app_no}/history`);
      if (res.success) {
        setDetailModal((prev) => ({
          ...prev,
          history: res.history || [],
          loadingHistory: false
        }));
      }
    } catch (e) {
      setDetailModal((prev) => ({ ...prev, loadingHistory: false }));
    }
  };

  // ── Handle Action Submissions ──────────────────────────────────
  const handleMarkJoinedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cand = markJoinedModal.candidate;
    if (!cand) return;

    try {
      setActionBusy(true);
      const res = await API.post('/employees/not-joined/action', {
        action: 'mark_joined',
        appNo: cand.app_no,
        actual_doj: markJoinedModal.actualDoj,
        reporting_time: markJoinedModal.reportingTime,
        department: markJoinedModal.department,
        designation: markJoinedModal.designation,
        section: markJoinedModal.section,
        location_id: markJoinedModal.locationId,
        reporting_manager: markJoinedModal.reportingManager,
        employee_id: markJoinedModal.employeeCode,
        joining_remarks: markJoinedModal.joiningRemarks,
        verification_status: markJoinedModal.verificationStatus
      });

      if (res.success) {
        showToast(res.message || `${cand.name} marked as Joined successfully!`, 'success');
        setMarkJoinedModal((prev) => ({ ...prev, open: false, candidate: null }));
        if (detailModal.open) setDetailModal((prev) => ({ ...prev, open: false }));
        loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to mark as joined', 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cand = rescheduleModal.candidate;
    if (!cand || !rescheduleModal.newDoj) return;

    try {
      setActionBusy(true);
      const res = await API.post('/employees/not-joined/action', {
        action: 'reschedule',
        appNo: cand.app_no,
        new_doj: rescheduleModal.newDoj,
        reporting_time: rescheduleModal.reportingTime,
        reason: rescheduleModal.reason,
        remarks: rescheduleModal.remarks
      });

      if (res.success) {
        showToast(res.message || 'DOJ updated successfully!', 'success');
        setRescheduleModal((prev) => ({ ...prev, open: false, candidate: null }));
        if (detailModal.open) handleOpenDetail(cand);
        loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to reschedule DOJ', 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const handleFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cand = followUpModal.candidate;
    if (!cand) return;

    try {
      setActionBusy(true);
      const res = await API.post('/employees/not-joined/action', {
        action: 'follow_up',
        appNo: cand.app_no,
        contact_result: followUpModal.contactResult,
        candidate_response: followUpModal.candidateResponse,
        next_action: followUpModal.nextAction,
        next_followup_date: followUpModal.nextFollowupDate,
        remarks: followUpModal.remarks
      });

      if (res.success) {
        showToast('Follow-up activity recorded successfully!', 'success');
        setFollowUpModal((prev) => ({ ...prev, open: false, candidate: null }));
        if (detailModal.open) handleOpenDetail(cand);
        loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to record follow-up', 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const handleDropSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cand = dropModal.candidate;
    if (!cand) return;

    try {
      setActionBusy(true);
      const res = await API.post('/employees/not-joined/action', {
        action: 'mark_not_joining',
        appNo: cand.app_no,
        reason: dropModal.reason,
        remarks: dropModal.remarks
      });

      if (res.success) {
        showToast('Candidate recorded as Not Joining', 'info');
        setDropModal((prev) => ({ ...prev, open: false, candidate: null }));
        if (detailModal.open) setDetailModal((prev) => ({ ...prev, open: false }));
        loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update candidate status', 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddModal.name || !quickAddModal.phone || !quickAddModal.offeredDoj) {
      showToast('Please fill all required fields', 'warn');
      return;
    }

    try {
      setActionBusy(true);
      const res = await API.post('/employees/not-joined/action', {
        action: 'quick_add_doj',
        name: quickAddModal.name,
        phone: quickAddModal.phone,
        email: quickAddModal.email,
        designation: quickAddModal.designation,
        department: quickAddModal.department,
        section: quickAddModal.section,
        location_id: quickAddModal.locationId,
        offered_doj: quickAddModal.offeredDoj,
        reporting_time: quickAddModal.reportingTime,
        salary: quickAddModal.salary,
        notice_period: quickAddModal.noticePeriod,
        reporting_manager: quickAddModal.reportingManager,
        remarks: quickAddModal.remarks
      });

      if (res.success) {
        showToast(res.message || 'Candidate scheduled successfully!', 'success');
        setQuickAddModal((prev) => ({
          ...prev,
          open: false,
          name: '',
          phone: '',
          email: '',
          salary: '',
          remarks: ''
        }));
        loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to schedule candidate', 'error');
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans">
      <ToastContainer />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} session={session} />

      <div className={`flex-1 flex flex-col min-w-0 overflow-y-auto transition-all duration-300 ${collapsed ? 'lg:pl-[72px]' : 'lg:pl-64'}`}>
        <Topbar
          title="DOJ Desk & Joined Store Directory"
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
          breadcrumbs={[{ label: 'Store Operations' }, { label: 'DOJ & Not Joined Desk' }]}
        />

        <main className="p-3 sm:p-5 lg:p-7 space-y-5 max-w-7xl mx-auto w-full">
          {/* ── Top Header Banner ─────────────────────────────────── */}
          <div className="bg-gradient-to-r from-[#4A173A] via-[#5C1E48] to-[#2E0B22] text-white rounded-3xl p-5 sm:p-6 shadow-md relative overflow-hidden">
            <div className="absolute right-0 top-0 bottom-0 w-72 bg-gradient-to-l from-white/5 to-transparent pointer-events-none" />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-xs text-[#E8C7A8] text-[11px] font-semibold uppercase tracking-wider mb-2">
                  <CalendarClock className="w-3.5 h-3.5" />
                  <span>HR & Recruitment Operations</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  <span>Date of Joining (DOJ) Desk</span>
                  <Sparkles className="w-5 h-5 text-[#E8C7A8]" />
                </h1>
                <p className="text-xs sm:text-sm text-white/80 mt-1 max-w-2xl">
                  Track and verify candidate onboarding, manage expected store reporting dates, conduct follow-ups, and maintain the live Joined Store Directory.
                </p>
              </div>

              {/* Header Actions */}
              <div className="flex items-center gap-2 self-start md:self-center flex-wrap">
                <button
                  type="button"
                  onClick={() => setQuickAddModal((prev) => ({ ...prev, open: true }))}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#E8C7A8] hover:bg-[#dfbba0] text-[#4A173A] font-bold text-xs transition-all shadow-sm cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Schedule Candidate DOJ</span>
                </button>
                <button
                  type="button"
                  onClick={() => loadData()}
                  disabled={loading}
                  className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
                  title="Refresh Data"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* ── Top 4 KPI Summary Cards ───────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Card 1: Pending Joining */}
            <div
              onClick={() => setActiveTab('not_joined')}
              className={`p-4 rounded-3xl border transition-all cursor-pointer shadow-xs ${
                activeTab === 'not_joined'
                  ? 'bg-white border-[#4A173A] ring-2 ring-[#4A173A]/10'
                  : 'bg-white border-accent-soft hover:border-accent'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary/70">Pending Joining</span>
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <CalendarClock className="w-4 h-4 text-accent" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-primary mt-2">{stats.total}</p>
              <p className="text-[11px] text-accent font-bold mt-1">
                {stats.upcoming} scheduled · {stats.today} today
              </p>
            </div>

            {/* Card 2: Overdue DOJ */}
            <div
              onClick={() => setActiveTab('overdue')}
              className={`p-4 rounded-3xl border transition-all cursor-pointer shadow-xs ${
                activeTab === 'overdue'
                  ? 'bg-red-50/50 border-[#B42318] ring-2 ring-[#B42318]/10'
                  : 'bg-white border-accent-soft hover:border-red-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary/70">Overdue DOJ</span>
                <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center text-[#B42318]">
                  <TriangleAlert className="w-4 h-4 text-[#B42318]" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-[#B42318] mt-2">{stats.overdue}</p>
              <p className="text-[11px] text-red-600 font-bold mt-1">
                {stats.overdue > 0 ? 'Immediate follow-up required' : 'All scheduled joinings on track'}
              </p>
            </div>

            {/* Card 3: Joining Today */}
            <div
              onClick={() => setActiveTab('today')}
              className={`p-4 rounded-3xl border transition-all cursor-pointer shadow-xs ${
                activeTab === 'today'
                  ? 'bg-orange-50/50 border-orange-500 ring-2 ring-orange-500/10'
                  : 'bg-white border-accent-soft hover:border-orange-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary/70">Joining Today</span>
                <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
                  <Clock className="w-4 h-4 text-orange-600" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-orange-600 mt-2">{stats.today}</p>
              <p className="text-[11px] text-orange-600 font-bold mt-1">Ready for store verification</p>
            </div>

            {/* Card 4: Active Store Staff */}
            <div
              onClick={() => setActiveTab('joined_store')}
              className={`p-4 rounded-3xl border transition-all cursor-pointer shadow-xs ${
                activeTab === 'joined_store'
                  ? 'bg-green-50/50 border-[#198754] ring-2 ring-[#198754]/10'
                  : 'bg-white border-accent-soft hover:border-green-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary/70">Active Store Staff</span>
                <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center text-[#198754]">
                  <Store className="w-4 h-4 text-[#198754]" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-[#198754] mt-2">
                {stats.activeStaff || joinedCount || 0}
              </p>
              <p className="text-[11px] text-[#198754] font-bold mt-1">Across permitted store branches</p>
            </div>
          </div>

          {/* ── Tabs Navigation & Filters Toolbar ─────────────────── */}
          <div className="bg-white p-3 sm:p-4 rounded-3xl border border-accent-soft shadow-xs space-y-3">
            {/* Tab Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                type="button"
                onClick={() => setActiveTab('not_joined')}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'not_joined'
                    ? 'bg-[#4A173A] text-white shadow-xs'
                    : 'bg-background hover:bg-primary/5 text-primary border border-accent-soft'
                }`}
              >
                <CalendarClock className="w-3.5 h-3.5" />
                <span>All Pending</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'not_joined' ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
                  {stats.total}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('today')}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'today'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'bg-background hover:bg-primary/5 text-primary border border-accent-soft'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-orange-500" />
                <span>Joining Today</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'today' ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-700'}`}>
                  {stats.today}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('overdue')}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'overdue'
                    ? 'bg-[#B42318] text-white shadow-xs'
                    : 'bg-background hover:bg-primary/5 text-primary border border-accent-soft'
                }`}
              >
                <TriangleAlert className="w-3.5 h-3.5 text-red-500" />
                <span>Overdue DOJ</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'overdue' ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700'}`}>
                  {stats.overdue}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('upcoming')}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'upcoming'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-background hover:bg-primary/5 text-primary border border-accent-soft'
                }`}
              >
                <CalendarPlus className="w-3.5 h-3.5 text-blue-500" />
                <span>Upcoming Joining</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'upcoming' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'}`}>
                  {stats.upcoming}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('joined_store')}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'joined_store'
                    ? 'bg-[#198754] text-white shadow-xs'
                    : 'bg-background hover:bg-primary/5 text-primary border border-accent-soft'
                }`}
              >
                <Store className="w-3.5 h-3.5 text-green-600" />
                <span>Joined Store Directory</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'joined_store' ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'}`}>
                  {stats.activeStaff || joinedCount}
                </span>
              </button>
            </div>

            {/* Filter Controls Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 pt-2 border-t border-accent-soft/60">
              {/* Search Field */}
              <div className="relative col-span-1 sm:col-span-2">
                <Search className="w-3.5 h-3.5 text-primary/40 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search candidate name, ID, phone, role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              {/* Location Filter */}
              <div>
                <select
                  value={filterLocation}
                  onChange={(e) => setFilterLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {isGlobalAdmin && <option value="all">All Locations</option>}
                  {availableLocations.map((loc) => (
                    <option key={loc.id} value={String(loc.id)}>
                      {loc.name} ({loc.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Department Filter */}
              <div>
                <select
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="all">All Departments</option>
                  {departmentOptions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date From */}
              <div>
                <input
                  type="date"
                  placeholder="DOJ From"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  title="Filter by DOJ from date"
                />
              </div>

              {/* Date To & Clear Filters */}
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  placeholder="DOJ To"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  title="Filter by DOJ to date"
                />
                {(searchQuery || filterLocation !== 'all' || filterDepartment !== 'all' || filterDateFrom || filterDateTo) && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="p-2 rounded-xl border border-accent-soft text-primary/60 hover:text-primary hover:bg-background transition-colors"
                    title="Clear Filters"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Main Content Area ─────────────────────────────────── */}
          {loading ? (
            <div className="py-24 text-center bg-white rounded-3xl border border-accent-soft shadow-xs">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              <p className="mt-3 text-xs font-bold text-primary/70">Loading workspace records...</p>
            </div>
          ) : activeTab === 'joined_store' ? (
            /* TAB: JOINED STORE DIRECTORY */
            displayEmployees.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 sm:p-14 text-center border border-accent-soft shadow-xs space-y-4">
                <Store className="w-12 h-12 text-[#198754] mx-auto opacity-70" />
                <div>
                  <h3 className="text-base font-black text-primary">No Store Staff Found</h3>
                  <p className="text-xs text-primary/60 mt-1 max-w-md mx-auto">
                    No employees matching the current filters were found in the Joined Store Directory.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-background border border-accent-soft text-primary text-xs font-bold hover:bg-primary/5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset Filters</span>
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-accent-soft shadow-xs overflow-hidden">
                <div className="px-5 py-3.5 bg-background/60 border-b border-accent-soft flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-[#198754]" />
                    <span className="text-xs font-black text-primary uppercase tracking-wider">
                      Joined Store Directory ({displayEmployees.length})
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-primary/60">
                    Live database synchronization with Employee Master
                  </span>
                </div>

                <div className="table-frame custom-scrollbar">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-background/40 border-b border-accent-soft text-primary/70 font-extrabold text-[11px] uppercase tracking-wider">
                        <th className="py-3 px-4">Employee Code & Name</th>
                        <th className="py-3 px-4">Role & Store Branch</th>
                        <th className="py-3 px-4">Department & Section</th>
                        <th className="py-3 px-4">Date of Joining</th>
                        <th className="py-3 px-4">Verification</th>
                        <th className="py-3 px-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-accent-soft/40">
                      {displayEmployees.map((emp) => (
                        <tr key={emp.emp_code || emp.id} className="hover:bg-background/40 transition-colors">
                          <td className="py-3.5 px-4">
                            <p className="font-extrabold text-primary">{emp.name}</p>
                            <p className="font-mono text-[10px] text-accent font-bold mt-0.5">{emp.emp_code}</p>
                            {emp.phone && (
                              <p className="text-[11px] text-primary/60 flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3 text-primary/40" /> {emp.phone}
                              </p>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <p className="font-bold text-primary">{emp.designation || 'Retail Staff'}</p>
                            <span className="inline-block font-bold text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary mt-1">
                              {emp.location_name} ({emp.location_code})
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <p className="font-bold text-primary/80">{emp.department || 'Store Operations'}</p>
                            <p className="text-[11px] text-primary/50">{emp.section || 'General'}</p>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-primary">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-accent" />
                              <span>
                                {emp.joined_date
                                  ? new Date(emp.joined_date).toLocaleDateString('en-IN', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric'
                                    })
                                  : '—'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-[#198754] border border-[#198754]/20">
                              <CheckCircle className="w-3 h-3 text-[#198754]" />
                              <span>Verified</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-green-100 text-green-800">
                              Active Staff
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          ) : (
            /* TABS: NOT JOINED / TODAY / OVERDUE / UPCOMING */
            displayCandidates.length === 0 ? (
              <div className="space-y-4">
                {/* Compact Professional Empty State */}
                <div className="bg-white rounded-3xl p-8 sm:p-10 text-center border border-accent-soft shadow-xs space-y-3">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-[#198754] mx-auto">
                    <CheckCircle className="w-6 h-6 text-[#198754]" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-primary">
                      {activeTab === 'overdue'
                        ? 'NO OVERDUE DOJ CASES'
                        : activeTab === 'today'
                        ? 'NO JOININGS SCHEDULED FOR TODAY'
                        : activeTab === 'upcoming'
                        ? 'NO UPCOMING JOININGS'
                        : 'NO PENDING DOJ CASES'}
                    </h3>
                    <p className="text-xs text-primary/60 mt-1 max-w-md mx-auto">
                      {activeTab === 'overdue'
                        ? 'All scheduled joinings are currently on track. No candidate is overdue.'
                        : activeTab === 'today'
                        ? 'No offered candidates are scheduled to report today.'
                        : 'All current offered candidates have completed their joining process or are not yet due for onboarding.'}
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setActiveTab('joined_store')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover transition-colors shadow-2xs"
                    >
                      <Store className="w-3.5 h-3.5" />
                      <span>View Joined Store Directory ({stats.activeStaff || joinedCount})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickAddModal((prev) => ({ ...prev, open: true }))}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-background border border-accent-soft text-primary text-xs font-bold hover:bg-primary/5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 text-accent" />
                      <span>Schedule New Joining</span>
                    </button>
                  </div>
                </div>

                {/* Useful Store-Wise Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-4 rounded-2xl bg-white border border-accent-soft shadow-xs">
                    <p className="text-xs font-bold text-primary/60">Belagavi Store (BEL)</p>
                    <p className="text-base font-black text-primary mt-1">Main Retail Galleria</p>
                    <p className="text-[11px] text-primary/50 mt-1">Ground Floor Sarees & Menswear</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white border border-accent-soft shadow-xs">
                    <p className="text-xs font-bold text-primary/60">Davanagere Store (DAV)</p>
                    <p className="text-base font-black text-primary mt-1">City Flagship Store</p>
                    <p className="text-[11px] text-primary/50 mt-1">Wedding Saree Galleria & Kids</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white border border-accent-soft shadow-xs">
                    <p className="text-xs font-bold text-primary/60">Shivamogga Store (SHI)</p>
                    <p className="text-base font-black text-primary mt-1">Regional Branch</p>
                    <p className="text-[11px] text-primary/50 mt-1">Silk & Ladies Wear Collection</p>
                  </div>
                </div>
              </div>
            ) : (
              /* CANDIDATES TABLE / LIST */
              <div className="bg-white rounded-3xl border border-accent-soft shadow-xs overflow-hidden">
                <div className="px-5 py-3.5 bg-background/60 border-b border-accent-soft flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-accent" />
                    <span className="text-xs font-black text-primary uppercase tracking-wider">
                      {activeTab === 'overdue'
                        ? `Overdue Candidates (${displayCandidates.length})`
                        : activeTab === 'today'
                        ? `Joining Today (${displayCandidates.length})`
                        : activeTab === 'upcoming'
                        ? `Upcoming Joinings (${displayCandidates.length})`
                        : `Pending Candidates (${displayCandidates.length})`}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-primary/60">
                    Showing candidates awaiting store reporting
                  </span>
                </div>

                <div className="table-frame custom-scrollbar">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-background/40 border-b border-accent-soft text-primary/70 font-extrabold text-[11px] uppercase tracking-wider">
                        <th className="py-3 px-4">Candidate & App No</th>
                        <th className="py-3 px-4">Role & Store Location</th>
                        <th className="py-3 px-4">Scheduled DOJ</th>
                        <th className="py-3 px-4">Urgency / Delay</th>
                        <th className="py-3 px-4">Latest Follow-Up</th>
                        <th className="py-3 px-4 text-right">Desk Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-accent-soft/40">
                      {displayCandidates.map((cand) => (
                        <tr key={cand.app_no} className="hover:bg-background/40 transition-colors">
                          {/* Candidate Name & Contact */}
                          <td className="py-3.5 px-4">
                            <button
                              type="button"
                              onClick={() => handleOpenDetail(cand)}
                              className="font-extrabold text-primary hover:text-accent transition-colors text-left"
                            >
                              {cand.name}
                            </button>
                            <p className="font-mono text-[10px] text-accent font-bold mt-0.5">{cand.app_no}</p>
                            <p className="text-[11px] text-primary/60 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-primary/40" />
                              <a href={`tel:${cand.phone}`} className="hover:underline">
                                {cand.phone}
                              </a>
                            </p>
                          </td>

                          {/* Role & Store */}
                          <td className="py-3.5 px-4">
                            <p className="font-bold text-primary">{cand.designation || 'Retail Staff'}</p>
                            <p className="text-[11px] text-primary/60">{cand.department || 'Floor'}</p>
                            <span className="inline-block font-bold text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary mt-1">
                              {cand.location_name || 'Store'} ({cand.location_code || 'BSC'})
                            </span>
                          </td>

                          {/* Scheduled DOJ & Details */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 font-bold text-primary">
                              <Calendar className="w-3.5 h-3.5 text-accent" />
                              <span>
                                {cand.scheduled_doj
                                  ? new Date(cand.scheduled_doj).toLocaleDateString('en-IN', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric'
                                    })
                                  : 'Not Set'}
                              </span>
                            </div>
                            {cand.notice_period && (
                              <p className="text-[10px] text-primary/50 mt-0.5">Notice: {cand.notice_period}</p>
                            )}
                          </td>

                          {/* Urgency Badge */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                                cand.doj_urgency === 'Overdue'
                                  ? 'bg-red-100 text-red-800 border border-red-200'
                                  : cand.doj_urgency === 'Joining Today'
                                  ? 'bg-orange-100 text-orange-800 border border-orange-200'
                                  : 'bg-blue-100 text-blue-800 border border-blue-200'
                              }`}
                            >
                              {cand.doj_urgency === 'Overdue' && <TriangleAlert className="w-3 h-3 text-red-600" />}
                              {cand.doj_urgency === 'Joining Today' && <Clock className="w-3 h-3 text-orange-600" />}
                              {cand.doj_urgency === 'Upcoming' && <CalendarPlus className="w-3 h-3 text-blue-600" />}
                              <span>{cand.doj_urgency}</span>
                              {cand.delay_days > 0 && <span>({cand.delay_days}d overdue)</span>}
                            </span>
                          </td>

                          {/* Latest Follow-Up / Remarks */}
                          <td className="py-3.5 px-4 max-w-xs">
                            {cand.last_contact_result ? (
                              <div>
                                <p className="font-bold text-primary text-[11px] truncate">{cand.last_contact_result}</p>
                                <p className="text-[10px] text-primary/60 truncate">{cand.next_action || 'Follow up'}</p>
                              </div>
                            ) : cand.offer_remarks ? (
                              <p className="text-[11px] text-primary/60 italic truncate">{cand.offer_remarks}</p>
                            ) : (
                              <span className="text-[11px] text-primary/40">—</span>
                            )}
                          </td>

                          {/* Action Buttons */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {/* Mark Joined */}
                              <button
                                type="button"
                                onClick={() =>
                                  setMarkJoinedModal({
                                    open: true,
                                    candidate: cand,
                                    actualDoj: new Date().toISOString().split('T')[0],
                                    reportingTime: '09:30 AM',
                                    department: cand.department || 'Store Operations',
                                    designation: cand.designation || 'Retail Associate',
                                    section: cand.section || 'General',
                                    locationId: cand.location_id || 1,
                                    reportingManager: cand.reporting_manager || '',
                                    employeeCode: '',
                                    verificationStatus: 'Verified',
                                    joiningRemarks: ''
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#198754] text-white hover:bg-green-700 font-bold text-[11px] shadow-2xs transition-colors cursor-pointer"
                                title="Candidate has arrived and joined the store"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Mark Joined</span>
                              </button>

                              {/* Follow Up */}
                              <button
                                type="button"
                                onClick={() =>
                                  setFollowUpModal({
                                    open: true,
                                    candidate: cand,
                                    contactResult: 'Call Connected - Confirmed',
                                    candidateResponse: '',
                                    nextAction: 'Ready for Joining',
                                    nextFollowupDate: '',
                                    remarks: ''
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] border border-blue-200 transition-colors cursor-pointer"
                                title="Record phone call or follow-up note"
                              >
                                <PhoneCall className="w-3.5 h-3.5" />
                                <span>Follow-Up</span>
                              </button>

                              {/* Reschedule DOJ */}
                              <button
                                type="button"
                                onClick={() =>
                                  setRescheduleModal({
                                    open: true,
                                    candidate: cand,
                                    newDoj: cand.scheduled_doj ? cand.scheduled_doj.split('T')[0] : '',
                                    reportingTime: '10:00 AM',
                                    reason: 'Candidate requested extra time',
                                    remarks: ''
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-accent-soft hover:border-accent text-primary font-bold text-[11px] shadow-2xs transition-colors cursor-pointer"
                                title="Reschedule Date of Joining"
                              >
                                <CalendarClock className="w-3.5 h-3.5 text-accent" />
                                <span>Reschedule</span>
                              </button>

                              {/* View Details */}
                              <button
                                type="button"
                                onClick={() => handleOpenDetail(cand)}
                                className="p-1.5 rounded-xl border border-accent-soft hover:bg-background text-primary/70 hover:text-primary transition-colors cursor-pointer"
                                title="View Complete Candidate Dossier"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {/* Mark Not Joining */}
                              <button
                                type="button"
                                onClick={() =>
                                  setDropModal({
                                    open: true,
                                    candidate: cand,
                                    reason: 'Accepted another offer',
                                    remarks: ''
                                  })
                                }
                                className="p-1.5 rounded-xl hover:bg-red-50 text-red-600 transition-colors cursor-pointer"
                                title="Candidate rejected or not joining"
                              >
                                <CircleX className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </main>
      </div>

      {/* ── MARK AS JOINED MODAL ──────────────────────────────────── */}
      <ModalPortal
        isOpen={Boolean(markJoinedModal.open)}
        onClose={() => setMarkJoinedModal((prev) => ({ ...prev, open: false, candidate: null }))}
      >
        <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-accent-soft space-y-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-accent-soft pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center text-[#198754]">
                <UserCheck className="w-4 h-4" />
              </div>
              <h3 className="text-sm sm:text-base font-black text-primary">Confirm Store Joining</h3>
            </div>
            <button
              onClick={() => setMarkJoinedModal((prev) => ({ ...prev, open: false, candidate: null }))}
              className="text-primary/60 hover:text-primary"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {markJoinedModal.candidate && (
            <div className="p-3 bg-background rounded-2xl border border-accent-soft text-xs space-y-1">
              <p className="font-extrabold text-primary text-sm">{markJoinedModal.candidate.name}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-primary/70 text-[11px]">
                <span>App No: {markJoinedModal.candidate.app_no}</span>
                <span>Phone: {markJoinedModal.candidate.phone}</span>
                <span>Branch: {markJoinedModal.candidate.location_name}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleMarkJoinedSubmit} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-primary mb-1">Actual Joining Date *</label>
                <input
                  type="date"
                  required
                  value={markJoinedModal.actualDoj}
                  onChange={(e) => setMarkJoinedModal((prev) => ({ ...prev, actualDoj: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-primary mb-1">Reporting Time</label>
                <input
                  type="text"
                  placeholder="e.g. 09:30 AM"
                  value={markJoinedModal.reportingTime}
                  onChange={(e) => setMarkJoinedModal((prev) => ({ ...prev, reportingTime: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-primary mb-1">Assigned Department</label>
                <input
                  type="text"
                  value={markJoinedModal.department}
                  onChange={(e) => setMarkJoinedModal((prev) => ({ ...prev, department: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-primary mb-1">Designation</label>
                <input
                  type="text"
                  value={markJoinedModal.designation}
                  onChange={(e) => setMarkJoinedModal((prev) => ({ ...prev, designation: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-primary mb-1">Section</label>
                <input
                  type="text"
                  placeholder="e.g. Silk Sarees, Menswear"
                  value={markJoinedModal.section}
                  onChange={(e) => setMarkJoinedModal((prev) => ({ ...prev, section: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-primary mb-1">Employee ID / Code</label>
                <input
                  type="text"
                  placeholder="Auto-generated (e.g. EMP-5010)"
                  value={markJoinedModal.employeeCode}
                  onChange={(e) => setMarkJoinedModal((prev) => ({ ...prev, employeeCode: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-primary mb-1">Store Branch</label>
                <select
                  value={markJoinedModal.locationId}
                  onChange={(e) => setMarkJoinedModal((prev) => ({ ...prev, locationId: Number(e.target.value) }))}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
                >
                  <option value={1}>Belagavi (BEL)</option>
                  <option value={2}>Davanagere (DAV)</option>
                  <option value={3}>Shivamogga (SHI)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-primary mb-1">Verification Status</label>
                <select
                  value={markJoinedModal.verificationStatus}
                  onChange={(e) => setMarkJoinedModal((prev) => ({ ...prev, verificationStatus: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
                >
                  <option value="Verified">Verified & Documents Approved</option>
                  <option value="Provisional">Provisional Joining (Pending Docs)</option>
                  <option value="Pending Aadhaar">Pending Aadhaar Verification</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold text-primary mb-1">Reporting Manager</label>
              <input
                type="text"
                placeholder="e.g. Store General Manager"
                value={markJoinedModal.reportingManager}
                onChange={(e) => setMarkJoinedModal((prev) => ({ ...prev, reportingManager: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-primary mb-1">Joining Remarks</label>
              <textarea
                rows={2}
                placeholder="Notes on reporting, onboarding orientation, uniform issued..."
                value={markJoinedModal.joiningRemarks}
                onChange={(e) => setMarkJoinedModal((prev) => ({ ...prev, joiningRemarks: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-accent-soft">
              <button
                type="button"
                onClick={() => setMarkJoinedModal((prev) => ({ ...prev, open: false, candidate: null }))}
                className="px-4 py-2 rounded-xl border border-accent-soft text-xs font-bold text-primary hover:bg-background cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionBusy}
                className="px-4 py-2 rounded-xl bg-[#198754] text-white text-xs font-bold hover:bg-green-700 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {actionBusy ? 'Recording...' : 'Confirm & Mark as Joined'}
              </button>
            </div>
          </form>
        </div>
      </ModalPortal>

      {/* ── RESCHEDULE DOJ MODAL ──────────────────────────────────── */}
      <ModalPortal
        isOpen={Boolean(rescheduleModal.open)}
        onClose={() => setRescheduleModal((prev) => ({ ...prev, open: false, candidate: null }))}
      >
        <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-accent-soft space-y-4">
          <div className="flex items-center justify-between border-b border-accent-soft pb-3">
            <h3 className="text-sm font-black text-primary">Reschedule Date of Joining (DOJ)</h3>
            <button
              onClick={() => setRescheduleModal((prev) => ({ ...prev, open: false, candidate: null }))}
              className="text-primary/60 hover:text-primary"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {rescheduleModal.candidate && (
            <p className="text-xs text-primary/70">
              Rescheduling joining date for <strong className="text-primary">{rescheduleModal.candidate.name}</strong> ({rescheduleModal.candidate.app_no}).
            </p>
          )}

          <form onSubmit={handleRescheduleSubmit} className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-primary mb-1">New Date of Joining *</label>
              <input
                type="date"
                required
                value={rescheduleModal.newDoj}
                onChange={(e) => setRescheduleModal((prev) => ({ ...prev, newDoj: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-primary mb-1">Expected Reporting Time</label>
              <input
                type="text"
                value={rescheduleModal.reportingTime}
                onChange={(e) => setRescheduleModal((prev) => ({ ...prev, reportingTime: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-primary mb-1">Reason for Rescheduling *</label>
              <select
                value={rescheduleModal.reason}
                onChange={(e) => setRescheduleModal((prev) => ({ ...prev, reason: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
              >
                <option value="Candidate requested extra time">Candidate requested extra time</option>
                <option value="Relocation / travel delay">Relocation / travel delay</option>
                <option value="Notice period extension at prior employer">Notice period extension at prior employer</option>
                <option value="Store requirement / shift adjustment">Store requirement / shift adjustment</option>
                <option value="Personal / family reason">Personal / family reason</option>
                <option value="Medical leave">Medical leave</option>
                <option value="Other">Other reason</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-primary mb-1">Detailed Remarks</label>
              <textarea
                rows={2}
                placeholder="Notes for follow-up record..."
                value={rescheduleModal.remarks}
                onChange={(e) => setRescheduleModal((prev) => ({ ...prev, remarks: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-accent-soft">
              <button
                type="button"
                onClick={() => setRescheduleModal((prev) => ({ ...prev, open: false, candidate: null }))}
                className="px-4 py-2 rounded-xl border border-accent-soft text-xs font-bold text-primary hover:bg-background cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionBusy}
                className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-xs cursor-pointer disabled:opacity-50"
              >
                {actionBusy ? 'Saving...' : 'Save New DOJ'}
              </button>
            </div>
          </form>
        </div>
      </ModalPortal>

      {/* ── RECORD FOLLOW-UP MODAL ────────────────────────────────── */}
      <ModalPortal
        isOpen={Boolean(followUpModal.open)}
        onClose={() => setFollowUpModal((prev) => ({ ...prev, open: false, candidate: null }))}
      >
        <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-accent-soft space-y-4">
          <div className="flex items-center justify-between border-b border-accent-soft pb-3">
            <div className="flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-black text-primary">Record Follow-Up Call / Note</h3>
            </div>
            <button
              onClick={() => setFollowUpModal((prev) => ({ ...prev, open: false, candidate: null }))}
              className="text-primary/60 hover:text-primary"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {followUpModal.candidate && (
            <p className="text-xs text-primary/70">
              Candidate: <strong className="text-primary">{followUpModal.candidate.name}</strong> ({followUpModal.candidate.phone})
            </p>
          )}

          <form onSubmit={handleFollowUpSubmit} className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-primary mb-1">Contact Result *</label>
              <select
                value={followUpModal.contactResult}
                onChange={(e) => setFollowUpModal((prev) => ({ ...prev, contactResult: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
              >
                <option value="Call Connected - Confirmed">Call Connected - Confirmed Joining</option>
                <option value="Call Connected - Reschedule Requested">Call Connected - Reschedule Requested</option>
                <option value="Call Connected - Doubts/Queries">Call Connected - Queries / Salary Discussed</option>
                <option value="Call Connected - Not Joining">Call Connected - Refused / Not Joining</option>
                <option value="Not Reachable / Busy">Not Reachable / Ringing / Busy</option>
                <option value="Left Message / WhatsApp">Left Message / WhatsApp Sent</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-primary mb-1">Candidate Response / Conversation</label>
              <textarea
                rows={2}
                required
                placeholder="What did the candidate say during the call?"
                value={followUpModal.candidateResponse}
                onChange={(e) => setFollowUpModal((prev) => ({ ...prev, candidateResponse: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-primary mb-1">Next Action</label>
                <select
                  value={followUpModal.nextAction}
                  onChange={(e) => setFollowUpModal((prev) => ({ ...prev, nextAction: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
                >
                  <option value="Ready for Joining">Ready for Joining</option>
                  <option value="Follow up tomorrow">Follow up tomorrow</option>
                  <option value="Follow up on DOJ morning">Follow up on DOJ morning</option>
                  <option value="Pending Reschedule Approval">Pending Reschedule Approval</option>
                  <option value="Escalate to Store Manager">Escalate to Store Manager</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-primary mb-1">Next Follow-Up Date</label>
                <input
                  type="date"
                  value={followUpModal.nextFollowupDate}
                  onChange={(e) => setFollowUpModal((prev) => ({ ...prev, nextFollowupDate: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-accent-soft">
              <button
                type="button"
                onClick={() => setFollowUpModal((prev) => ({ ...prev, open: false, candidate: null }))}
                className="px-4 py-2 rounded-xl border border-accent-soft text-xs font-bold text-primary hover:bg-background cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionBusy}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {actionBusy ? 'Saving...' : 'Save Follow-Up'}
              </button>
            </div>
          </form>
        </div>
      </ModalPortal>

      {/* ── NOT JOINING / DROP MODAL ──────────────────────────────── */}
      <ModalPortal
        isOpen={Boolean(dropModal.open)}
        onClose={() => setDropModal((prev) => ({ ...prev, open: false, candidate: null }))}
      >
        <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-accent-soft space-y-4">
          <div className="flex items-center justify-between border-b border-accent-soft pb-3">
            <h3 className="text-sm font-black text-[#C0392B] flex items-center gap-1.5">
              <TriangleAlert className="w-4 h-4" />
              <span>Mark Candidate Not Joining</span>
            </h3>
            <button
              onClick={() => setDropModal((prev) => ({ ...prev, open: false, candidate: null }))}
              className="text-primary/60 hover:text-primary"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {dropModal.candidate && (
            <p className="text-xs text-primary/70">
              Confirm that <strong className="text-primary">{dropModal.candidate.name}</strong> will not be joining BSC Textiles.
            </p>
          )}

          <form onSubmit={handleDropSubmit} className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-primary mb-1">Reason for Dropping *</label>
              <select
                value={dropModal.reason}
                onChange={(e) => setDropModal((prev) => ({ ...prev, reason: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
              >
                <option value="Accepted another offer">Accepted another offer</option>
                <option value="Compensation / salary mismatch">Compensation / salary mismatch</option>
                <option value="Shift timing or store location issue">Shift timing or store location issue</option>
                <option value="Unreachable after multiple attempts">Unreachable after multiple attempts</option>
                <option value="Personal / family objection">Personal / family objection</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-primary mb-1">Details & HR Feedback</label>
              <textarea
                rows={3}
                required
                placeholder="Explain the reason for archive..."
                value={dropModal.remarks}
                onChange={(e) => setDropModal((prev) => ({ ...prev, remarks: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-accent-soft">
              <button
                type="button"
                onClick={() => setDropModal((prev) => ({ ...prev, open: false, candidate: null }))}
                className="px-4 py-2 rounded-xl border border-accent-soft text-xs font-bold text-primary hover:bg-background cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionBusy}
                className="px-4 py-2 rounded-xl bg-[#C0392B] text-white text-xs font-bold hover:bg-red-700 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {actionBusy ? 'Processing...' : 'Confirm Not Joining'}
              </button>
            </div>
          </form>
        </div>
      </ModalPortal>

      {/* ── CANDIDATE DETAIL & ACTIVITY DRAWER ────────────────────── */}
      <ModalPortal
        isOpen={Boolean(detailModal.open)}
        onClose={() => setDetailModal((prev) => ({ ...prev, open: false, candidate: null }))}
      >
        <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-accent-soft space-y-5 max-h-[90vh] overflow-y-auto">
          {detailModal.candidate ? (
            <>
              {/* Header */}
              <div className="flex items-start justify-between border-b border-accent-soft pb-4">
                <div>
                  <span className="text-[10px] font-mono text-accent font-bold px-2 py-0.5 rounded bg-accent/10">
                    {detailModal.candidate.app_no}
                  </span>
                  <h3 className="text-lg font-black text-primary mt-1">{detailModal.candidate.name}</h3>
                  <p className="text-xs text-primary/60">
                    {detailModal.candidate.designation || 'Retail Associate'} · {detailModal.candidate.department || 'Store Operations'}
                  </p>
                </div>
                <button
                  onClick={() => setDetailModal((prev) => ({ ...prev, open: false, candidate: null }))}
                  className="text-primary/60 hover:text-primary"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Grid Information */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-background rounded-2xl border border-accent-soft/70">
                  <span className="text-[10px] font-bold text-primary/50 uppercase">Phone</span>
                  <p className="font-bold text-primary mt-0.5">{detailModal.candidate.phone}</p>
                </div>
                <div className="p-3 bg-background rounded-2xl border border-accent-soft/70">
                  <span className="text-[10px] font-bold text-primary/50 uppercase">Store Branch</span>
                  <p className="font-bold text-primary mt-0.5">{detailModal.candidate.location_name || 'Store'}</p>
                </div>
                <div className="p-3 bg-background rounded-2xl border border-accent-soft/70">
                  <span className="text-[10px] font-bold text-primary/50 uppercase">Scheduled DOJ</span>
                  <p className="font-bold text-accent mt-0.5">
                    {detailModal.candidate.scheduled_doj
                      ? new Date(detailModal.candidate.scheduled_doj).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })
                      : 'Not Set'}
                  </p>
                </div>
                <div className="p-3 bg-background rounded-2xl border border-accent-soft/70">
                  <span className="text-[10px] font-bold text-primary/50 uppercase">Reporting Manager</span>
                  <p className="font-bold text-primary mt-0.5">{detailModal.candidate.reporting_manager || 'Store GM'}</p>
                </div>
                <div className="p-3 bg-background rounded-2xl border border-accent-soft/70">
                  <span className="text-[10px] font-bold text-primary/50 uppercase">Salary</span>
                  <p className="font-bold text-primary mt-0.5">
                    {detailModal.candidate.salary ? `₹${detailModal.candidate.salary}` : '—'}
                  </p>
                </div>
                <div className="p-3 bg-background rounded-2xl border border-accent-soft/70">
                  <span className="text-[10px] font-bold text-primary/50 uppercase">Status</span>
                  <p className="font-bold text-primary mt-0.5">{detailModal.candidate.candidate_status}</p>
                </div>
              </div>

              {/* Activity Timeline */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-xs font-black text-primary uppercase tracking-wider">
                  <History className="w-4 h-4 text-accent" />
                  <span>Activity & Follow-Up Timeline</span>
                </div>

                {detailModal.loadingHistory ? (
                  <div className="py-6 text-center text-xs text-primary/60">Loading timeline...</div>
                ) : detailModal.history.length === 0 ? (
                  <div className="p-4 bg-background/50 rounded-2xl border border-accent-soft text-xs text-primary/60 text-center">
                    No activity recorded for this candidate yet.
                  </div>
                ) : (
                  <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-accent-soft">
                    {detailModal.history.map((ev) => (
                      <div key={ev.id} className="relative text-xs">
                        <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-accent ring-4 ring-white" />
                        <div className="flex items-center justify-between text-[11px] text-primary/50">
                          <span className="font-bold text-primary">{ev.event_type.replace(/_/g, ' ')}</span>
                          <span>
                            {new Date(ev.created_at).toLocaleString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        {ev.new_doj && (
                          <p className="text-accent font-bold mt-0.5">
                            DOJ: {new Date(ev.new_doj).toLocaleDateString()} {ev.reporting_time ? `(${ev.reporting_time})` : ''}
                          </p>
                        )}
                        {ev.contact_result && (
                          <p className="text-primary font-bold mt-0.5">{ev.contact_result}</p>
                        )}
                        {ev.candidate_response && (
                          <p className="text-primary/70 mt-0.5 italic">"{ev.candidate_response}"</p>
                        )}
                        {ev.reason && <p className="text-primary/80 mt-0.5">Reason: {ev.reason}</p>}
                        {ev.remarks && <p className="text-primary/70 mt-0.5">{ev.remarks}</p>}
                        <p className="text-[10px] text-primary/40 mt-1">Logged by: {ev.performed_by}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-accent-soft flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFollowUpModal({
                        open: true,
                        candidate: detailModal.candidate,
                        contactResult: 'Call Connected - Confirmed',
                        candidateResponse: '',
                        nextAction: 'Ready for Joining',
                        nextFollowupDate: '',
                        remarks: ''
                      });
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200 hover:bg-blue-100 cursor-pointer"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>Follow-Up</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRescheduleModal({
                        open: true,
                        candidate: detailModal.candidate,
                        newDoj: detailModal.candidate?.scheduled_doj ? detailModal.candidate.scheduled_doj.split('T')[0] : '',
                        reportingTime: '10:00 AM',
                        reason: 'Candidate requested extra time',
                        remarks: ''
                      });
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-accent-soft text-primary text-xs font-bold hover:bg-background cursor-pointer"
                  >
                    <CalendarClock className="w-3.5 h-3.5 text-accent" />
                    <span>Reschedule</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const cand = detailModal.candidate;
                    if (!cand) return;
                    setMarkJoinedModal({
                      open: true,
                      candidate: cand,
                      actualDoj: new Date().toISOString().split('T')[0],
                      reportingTime: '09:30 AM',
                      department: cand.department || 'Store Operations',
                      designation: cand.designation || 'Retail Associate',
                      section: cand.section || 'General',
                      locationId: cand.location_id || 1,
                      reportingManager: cand.reporting_manager || '',
                      employeeCode: '',
                      verificationStatus: 'Verified',
                      joiningRemarks: ''
                    });
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#198754] text-white text-xs font-bold hover:bg-green-700 cursor-pointer shadow-xs"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Mark as Joined</span>
                </button>
              </div>
            </>
          ) : null}
        </div>
      </ModalPortal>

      {/* ── QUICK SCHEDULE DOJ MODAL (FAB) ────────────────────────── */}
      <ModalPortal
        isOpen={Boolean(quickAddModal.open)}
        onClose={() => setQuickAddModal((prev) => ({ ...prev, open: false }))}
      >
        <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-accent-soft space-y-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-accent-soft pb-3">
            <div className="flex items-center gap-2">
              <CalendarPlus className="w-5 h-5 text-accent" />
              <h3 className="text-sm sm:text-base font-black text-primary">Schedule Candidate Date of Joining</h3>
            </div>
            <button
              onClick={() => setQuickAddModal((prev) => ({ ...prev, open: false }))}
              className="text-primary/60 hover:text-primary"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleQuickAddSubmit} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-primary mb-1">Full Candidate Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Patil"
                  value={quickAddModal.name}
                  onChange={(e) => setQuickAddModal((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-primary mb-1">Mobile Number *</label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9845012345"
                  value={quickAddModal.phone}
                  onChange={(e) => setQuickAddModal((prev) => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-primary mb-1">Position / Designation *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Saree Consultant, Cashier"
                  value={quickAddModal.designation}
                  onChange={(e) => setQuickAddModal((prev) => ({ ...prev, designation: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-primary mb-1">Department *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sales, Store Operations"
                  value={quickAddModal.department}
                  onChange={(e) => setQuickAddModal((prev) => ({ ...prev, department: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-primary mb-1">Store Branch *</label>
                <select
                  value={quickAddModal.locationId}
                  onChange={(e) => setQuickAddModal((prev) => ({ ...prev, locationId: Number(e.target.value) }))}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
                >
                  <option value={1}>Belagavi (BEL)</option>
                  <option value={2}>Davanagere (DAV)</option>
                  <option value={3}>Shivamogga (SHI)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-primary mb-1">Offered Monthly Salary (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 24000"
                  value={quickAddModal.salary}
                  onChange={(e) => setQuickAddModal((prev) => ({ ...prev, salary: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-primary mb-1">Offered Date of Joining (DOJ) *</label>
                <input
                  type="date"
                  required
                  value={quickAddModal.offeredDoj}
                  onChange={(e) => setQuickAddModal((prev) => ({ ...prev, offeredDoj: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-primary mb-1">Reporting Time</label>
                <input
                  type="text"
                  placeholder="09:30 AM"
                  value={quickAddModal.reportingTime}
                  onChange={(e) => setQuickAddModal((prev) => ({ ...prev, reportingTime: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-primary mb-1">Reporting Manager</label>
              <input
                type="text"
                placeholder="e.g. Store General Manager"
                value={quickAddModal.reportingManager}
                onChange={(e) => setQuickAddModal((prev) => ({ ...prev, reportingManager: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-primary mb-1">Offer Remarks</label>
              <textarea
                rows={2}
                placeholder="Additional notes for store onboarding..."
                value={quickAddModal.remarks}
                onChange={(e) => setQuickAddModal((prev) => ({ ...prev, remarks: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-accent-soft">
              <button
                type="button"
                onClick={() => setQuickAddModal((prev) => ({ ...prev, open: false }))}
                className="px-4 py-2 rounded-xl border border-accent-soft text-xs font-bold text-primary hover:bg-background cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionBusy}
                className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-xs cursor-pointer disabled:opacity-50"
              >
                {actionBusy ? 'Scheduling...' : 'Schedule & Add to Desk'}
              </button>
            </div>
          </form>
        </div>
      </ModalPortal>
    </div>
  );
}
