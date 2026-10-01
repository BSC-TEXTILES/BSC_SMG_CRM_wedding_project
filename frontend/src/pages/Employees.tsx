import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layouts/DashboardLayout';
import PageContainer from '../components/ui/PageContainer';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import MetricCard from '../components/ui/MetricCard';
import { useRealtimeSection } from '../hooks/useRealtimeSection';
import {
  Users,
  Search,
  Filter,
  Building2,
  ChevronRight,
  FileSpreadsheet,
  RotateCcw,
  ShieldCheck,
  Clock,
  Layers,
  User,
  Upload,
  UserPlus,
  Pencil,
  Trash2,
  LayoutGrid,
  FolderTree,
  AlertTriangle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import EmployeeProfileModal from '../components/ui/EmployeeProfileModal';
import EmployeeImportModal from '../components/ui/EmployeeImportModal';
import AddEmployeeModal from '../components/ui/AddEmployeeModal';
import ModalPortal from '../components/ui/ModalPortal';

interface EmployeeDirectoryItem {
  id: number;
  employeeCode: string;
  username?: string;
  name: string;
  fullName: string;
  department: string;
  designation: string;
  section: string;
  branch: string;
  status: string;
  role?: string;
  locationId: number | null;
  locationCode: string | null;
  locationName: string | null;
  employeeId: string;
  empNo: string;
  appNo: string;
  active: boolean;
}

/**
 * Filter out Admin and System Administrator accounts.
 * Admin accounts must be completely hidden from the Employee Master Directory.
 */
const isAdminAccount = (e: any): boolean => {
  if (!e) return false;
  const role = String(e.role || '').toLowerCase().trim();
  const name = String(e.name || e.fullName || '').toLowerCase().trim();
  const user = String(e.username || '').toLowerCase().trim();
  return (
    ['admin', 'super admin', 'system administrator'].includes(role) ||
    name.includes('system administrator') ||
    user === 'admin' ||
    user.startsWith('admin@') ||
    user === 'ghost'
  );
};

const directoryCode = (e: EmployeeDirectoryItem): string => {
  const code = (e.employeeCode || '').trim();
  if (!code || code.includes('@')) return '';
  const user = (e.username || '').trim();
  if (user && code.toLowerCase() === user.toLowerCase()) return '';
  return code;
};

const toDirectoryItem = (raw: any): EmployeeDirectoryItem => ({
  ...raw,
  employeeCode: directoryCode(raw as EmployeeDirectoryItem),
});

export default function EmployeesPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeDirectoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'section' | 'department'>('name');
  const [viewMode, setViewMode] = useState<'section' | 'department' | 'grid'>('section');
  const [exporting, setExporting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [profileModalData, setProfileModalData] = useState<any | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<EmployeeDirectoryItem | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState(false);

  // PII Access Request
  const [accessDeniedData, setAccessDeniedData] = useState<{
    summary: any;
    existingRequest?: any;
  } | null>(null);
  const [requestReason, setRequestReason] = useState('');
  const [submittingAccessRequest, setSubmittingAccessRequest] = useState(false);
  const [loadingDetailsId, setLoadingDetailsId] = useState<number | null>(null);

  const isAdminOrManager = Boolean(
    session && ['admin', 'super admin', 'system administrator', 'manager', 'store manager', 'hr manager', 'hr'].includes(
      String(session.role || '').toLowerCase()
    )
  );

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.getEmployees();
      let rawList: any[] = [];
      if (res && res.success && Array.isArray(res.employees)) {
        rawList = res.employees;
      } else if (Array.isArray(res)) {
        rawList = res;
      } else {
        setEmployees([]);
        setLoadError('Unable to load Employee Directory. Please try again.');
        return;
      }

      // Exclude Admin and System Administrator accounts completely
      const validEmployees = rawList
        .filter((e) => !isAdminAccount(e))
        .map(toDirectoryItem);

      setEmployees(validEmployees);
      setLoadError(null);
    } catch (err: any) {
      console.error('[Employees] Directory fetch failed:', err);
      setEmployees([]);
      setLoadError('Unable to load Employee Directory. Please try again.');
      showToast('Unable to load Employee Directory. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useRealtimeSection(['employee'], () => {
    fetchEmployees();
  });

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    setSession(Auth.get());
    fetchEmployees();

    const handleLocChange = () => {
      fetchEmployees();
    };
    window.addEventListener('bsc_location_changed', handleLocChange);
    return () => window.removeEventListener('bsc_location_changed', handleLocChange);
  }, [navigate, fetchEmployees]);

  // Filtered & Sorted Employees (Always excludes admin accounts)
  const filteredEmployees = useMemo(() => {
    let list = employees.filter((e) => !isAdminAccount(e));

    if (statusFilter === 'active') {
      list = list.filter((e) => e.active);
    } else if (statusFilter === 'inactive') {
      list = list.filter((e) => !e.active);
    }

    if (sectionFilter) {
      list = list.filter((e) => (e.section || '').toLowerCase().trim() === sectionFilter.toLowerCase().trim());
    }

    if (deptFilter) {
      list = list.filter((e) => (e.department || '').toLowerCase().trim() === deptFilter.toLowerCase().trim());
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((e) =>
        (e.name || '').toLowerCase().includes(q) ||
        (e.section || '').toLowerCase().includes(q) ||
        (e.department || '').toLowerCase().includes(q)
      );
    }

    if (sortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'section') {
      list.sort((a, b) => (a.section || 'ZZZ').localeCompare(b.section || 'ZZZ') || a.name.localeCompare(b.name));
    } else if (sortBy === 'department') {
      list.sort((a, b) => (a.department || 'ZZZ').localeCompare(b.department || 'ZZZ') || a.name.localeCompare(b.name));
    }

    return list;
  }, [employees, sectionFilter, deptFilter, statusFilter, searchQuery, sortBy]);

  // Unique Sections & Departments for dropdown filters
  const uniqueSections = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.section && e.section.trim() && e.section.toLowerCase() !== 'na') {
        set.add(e.section.trim());
      }
    });
    return Array.from(set).sort();
  }, [employees]);

  const uniqueDepartments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.department && e.department.trim()) {
        set.add(e.department.trim());
      }
    });
    return Array.from(set).sort();
  }, [employees]);

  // Section Grouping: maps employees into distinct sections
  const groupedBySection = useMemo(() => {
    const groups: { [key: string]: { section: string; department: string; employees: EmployeeDirectoryItem[] } } = {};

    filteredEmployees.forEach((emp) => {
      const rawSec = (emp.section || '').trim();
      const secKey = !rawSec || rawSec.toLowerCase() === 'na' ? 'General / Unassigned Section' : rawSec;
      if (!groups[secKey]) {
        groups[secKey] = {
          section: secKey,
          department: emp.department || 'Store Operations',
          employees: []
        };
      }
      groups[secKey].employees.push(emp);
    });

    return Object.values(groups).sort((a, b) => {
      if (a.section === 'General / Unassigned Section') return 1;
      if (b.section === 'General / Unassigned Section') return -1;
      return a.section.localeCompare(b.section);
    });
  }, [filteredEmployees]);

  // Department Grouping: maps employees into distinct departments
  const groupedByDepartment = useMemo(() => {
    const groups: { [key: string]: { department: string; employees: EmployeeDirectoryItem[] } } = {};

    filteredEmployees.forEach((emp) => {
      const deptKey = (emp.department || '').trim() || 'Store Operations';
      if (!groups[deptKey]) {
        groups[deptKey] = {
          department: deptKey,
          employees: []
        };
      }
      groups[deptKey].employees.push(emp);
    });

    return Object.values(groups).sort((a, b) => a.department.localeCompare(b.department));
  }, [filteredEmployees]);

  // Accurate Summary Metrics (Excludes Admins)
  const totalEmployeesCount = employees.length;
  const activeEmployeesCount = employees.filter((e) => e.active).length;
  const totalSectionsCount = uniqueSections.length;
  const totalDepartmentsCount = uniqueDepartments.length;

  const handleExportDirectory = async () => {
    setExporting(true);
    try {
      const exportRows = filteredEmployees.map((e, idx) => ({
        'S.No': idx + 1,
        'Employee Name': e.name,
        'Section': e.section || 'General',
        'Department': e.department || 'Store Operations'
      }));

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Employee_Directory');
      const filename = `BSC_Employee_Directory_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
      showToast('Employee Directory exported successfully', 'success');
    } catch (err: any) {
      console.error('[Employees] Export failed:', err);
      showToast('Unable to export the Employee Directory. Please try again.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const openEmployeeDetails = async (emp: EmployeeDirectoryItem) => {
    setLoadingDetailsId(emp.id);
    try {
      const res = await API.getEmployeeDetails(emp.id);
      if (res && res.success && res.employee) {
        setProfileModalData(res.employee);
      } else if (res && res.employee) {
        setProfileModalData(res.employee);
      } else {
        setProfileModalData(res);
      }
    } catch (err: any) {
      const is403 = err.status === 403 || err.response?.status === 403 || err.data?.accessDenied;
      if (is403) {
        const errorData = err.data || err.response?.data || {};
        setAccessDeniedData({
          summary: errorData.employeeSummary || {
            id: emp.id,
            full_name: emp.name,
            employee_code: emp.employeeCode,
            department: emp.department,
            designation: emp.designation,
            section: emp.section,
            location_name: emp.branch || emp.locationName,
          },
          existingRequest: errorData.existingRequest || null,
        });
        setRequestReason('');
      } else {
        setProfileModalData({
          ...emp,
          id: emp.id,
          userId: emp.id,
          fullName: emp.name || emp.fullName,
          name: emp.name || emp.fullName,
          department: emp.department,
          section: emp.section
        });
      }
    } finally {
      setLoadingDetailsId(null);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!employeeToDelete) return;
    setDeletingEmployee(true);
    try {
      await API.deleteEmployee(employeeToDelete.id);
      showToast(`Employee "${employeeToDelete.name}" deleted successfully.`, 'success');
      setEmployeeToDelete(null);
      fetchEmployees();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete employee', 'error');
    } finally {
      setDeletingEmployee(false);
    }
  };

  const handleSendAccessRequest = async () => {
    if (!accessDeniedData?.summary?.id) return;
    setSubmittingAccessRequest(true);
    try {
      const res = await API.requestEmployeeAccess(accessDeniedData.summary.id, requestReason);
      showToast('Access request submitted to Administrators in real-time.', 'success');
      setAccessDeniedData((prev) =>
        prev
          ? {
              ...prev,
              existingRequest: {
                id: res?.requestId,
                status: 'pending',
                created_at: new Date().toISOString(),
                reason: requestReason
              }
            }
          : null
      );
      setRequestReason('');
    } catch (err: any) {
      showToast(err.message || 'Failed to submit access request', 'error');
    } finally {
      setSubmittingAccessRequest(false);
    }
  };

  /**
   * Helper component to render a single Employee Card.
   * STRICT REQUIREMENT: Shows ONLY:
   * - Employee Name
   * - Section / Department
   * All other details (ID, role, designation, location, status, staff number) are removed.
   */
  const renderEmployeeCard = (emp: EmployeeDirectoryItem) => {
    const initial = (emp.name || 'E').trim().charAt(0).toUpperCase();

    return (
      <div
        key={emp.id}
        className="card-glass p-5 bg-white border border-[#E8DFD8] hover:border-[#C9A45C] hover:shadow-xl transition-all duration-200 rounded-2xl flex flex-col justify-between group space-y-4 cursor-pointer relative overflow-hidden"
        onClick={() => openEmployeeDetails(emp)}
      >
        <div className="space-y-3.5">
          {/* Header Row: Initials Monogram & Employee Name */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#123C35] to-[#2B1E16] text-[#C9A45C] flex items-center justify-center font-black text-lg shadow-sm shrink-0 group-hover:scale-105 transition-transform border border-[#C9A45C]/30">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-black text-base sm:text-lg text-primary group-hover:text-accent transition-colors truncate leading-tight">
                {emp.name}
              </h3>
              <p className="text-[11px] font-semibold text-primary/60 mt-0.5 truncate">
                {emp.section ? `${emp.section}` : 'General Workforce'}
              </p>
            </div>
          </div>

          {/* Core Card Details: Section & Department ONLY */}
          <div className="space-y-2 pt-2 border-t border-[#EFEAE5]">
            {/* Section Badge */}
            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
              <div className="p-1 rounded-lg bg-white text-amber-700 shadow-2xs shrink-0">
                <Layers className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-amber-800/70 block">
                  Assigned Section
                </span>
                <span className="font-black text-xs text-amber-900 truncate block">
                  {emp.section && emp.section.toLowerCase() !== 'na' ? emp.section : 'General Section'}
                </span>
              </div>
            </div>

            {/* Department Badge */}
            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-primary/5 border border-primary/10 text-xs">
              <div className="p-1 rounded-lg bg-white text-primary shadow-2xs shrink-0">
                <Building2 className="w-3.5 h-3.5 text-accent" />
              </div>
              <div className="min-w-0">
                <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-primary/60 block">
                  Department
                </span>
                <span className="font-bold text-xs text-primary truncate block">
                  {emp.department || 'Store Operations'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card Footer: View Profile and Actions */}
        <div className="pt-3 border-t border-[#EFEAE5] flex items-center justify-between text-xs">
          <span className="text-xs font-bold text-accent group-hover:underline flex items-center gap-1">
            <span>{loadingDetailsId === emp.id ? 'Loading…' : 'View Profile'}</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </span>

          {isAdminOrManager && (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => openEmployeeDetails(emp)}
                className="p-1.5 rounded-lg hover:bg-accent/15 text-primary/70 hover:text-primary transition-colors cursor-pointer"
                title="Edit Employee"
              >
                <Pencil className="w-3.5 h-3.5 text-accent" />
              </button>
              <button
                type="button"
                onClick={() => setEmployeeToDelete(emp)}
                className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500 hover:text-rose-700 transition-colors cursor-pointer"
                title="Delete Employee"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout
      title="Employee Master Directory"
      breadcrumbs={[{ label: 'Operations', href: '/dashboard' }, { label: 'Employee Directory' }]}
    >
      <PageContainer maxWidth="full">
        <div className="space-y-6 animate-fade-in select-text">
          <ToastContainer />

          {/* Top Banner & Management Actions */}
          <div className="card-glass p-5 sm:p-6 bg-gradient-to-r from-primary/5 via-accent/5 to-white border-2 border-accent/30 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-primary text-accent flex items-center justify-center font-black shadow-md shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-accent/20 text-accent font-bold">
                    Official Directory
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 inline" /> Protected Workforce
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-primary tracking-tight mt-1">
                  Employee Master Directory
                </h1>
                <p className="text-xs text-primary font-medium mt-0.5">
                  Section and department workforce registry across all store locations.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto">
              <button
                type="button"
                onClick={handleExportDirectory}
                disabled={exporting}
                className="btn-outline text-xs px-3.5 py-2 font-bold flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                title="Download employee directory report"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-accent" />
                <span>{exporting ? 'Exporting…' : 'Export Directory'}</span>
              </button>

              {isAdminOrManager && (
                <button
                  type="button"
                  onClick={() => setShowImportModal(true)}
                  className="btn-outline text-xs px-3.5 py-2 font-bold flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0 text-primary border-accent/40 hover:border-accent hover:bg-accent/5"
                  title="Import employees from CSV or Excel (.xlsx / .xls)"
                >
                  <Upload className="w-3.5 h-3.5 text-accent" />
                  <span>Import (CSV / Excel)</span>
                </button>
              )}

              <button
                type="button"
                onClick={fetchEmployees}
                disabled={loading}
                className="p-2 rounded-xl border border-accent-soft hover:bg-background text-primary/70 hover:text-primary transition-all cursor-pointer"
                title="Refresh Directory"
              >
                <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Privacy Notice Banner */}
          <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/15 flex items-center justify-between text-xs text-primary font-medium">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-accent shrink-0" />
              <span>
                <strong>Privacy Policy Compliance:</strong> In accordance with corporate data protection standards,
                cards display <strong>Employee Name</strong> and <strong>Section / Department</strong> only.
              </span>
            </div>
          </div>

          {/* Summary Metric Cards (Accurate counts, strictly excluding admins) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Employees"
              value={totalEmployeesCount}
              subtext="Registered workforce"
              icon={Users}
              color="teal"
            />
            <MetricCard
              title="Active Staff"
              value={activeEmployeesCount}
              subtext="Currently on floor"
              icon={Building2}
              color="gold"
            />
            <MetricCard
              title="Total Sections"
              value={totalSectionsCount}
              subtext="Active assigned sections"
              icon={Layers}
              color="indigo"
            />
            <MetricCard
              title="Departments"
              value={totalDepartmentsCount}
              subtext="Across all retail operations"
              icon={FolderTree}
              color="rose"
            />
          </div>

          {/* Filter, Search, View Mode, and Controls Bar */}
          <div className="card-glass p-4 bg-white border border-accent-soft/70 shadow-xs flex flex-col gap-3.5">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-lg">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-primary/40" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by employee name, section, department..."
                  className="input-modern text-xs pl-9 pr-3 w-full"
                />
              </div>

              {/* View Mode Switcher */}
              <div className="flex items-center gap-1.5 p-1 bg-[#F5F2ED] rounded-xl border border-accent-soft self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setViewMode('section')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewMode === 'section'
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-primary/70 hover:text-primary hover:bg-white/60'
                  }`}
                  title="Group employees by section"
                >
                  <Layers className="w-3.5 h-3.5 text-accent" />
                  <span>Section View</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode('department')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewMode === 'department'
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-primary/70 hover:text-primary hover:bg-white/60'
                  }`}
                  title="Group employees by department"
                >
                  <FolderTree className="w-3.5 h-3.5 text-accent" />
                  <span>Department View</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewMode === 'grid'
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-primary/70 hover:text-primary hover:bg-white/60'
                  }`}
                  title="Flat grid view"
                >
                  <LayoutGrid className="w-3.5 h-3.5 text-accent" />
                  <span>All Cards Grid</span>
                </button>
              </div>
            </div>

            {/* Filter Dropdowns Bar */}
            <div className="flex items-center gap-2.5 flex-wrap pt-2 border-t border-accent-soft/60">
              {/* Section Filter */}
              <div className="flex items-center gap-1.5 text-xs text-primary font-bold">
                <Layers className="w-3.5 h-3.5 text-accent" />
                <span>Section:</span>
                <select
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value)}
                  className="select-modern text-xs font-semibold"
                >
                  <option value="">All Sections</option>
                  {uniqueSections.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Department Filter */}
              <div className="flex items-center gap-1.5 text-xs text-primary font-bold">
                <Building2 className="w-3.5 h-3.5 text-accent" />
                <span>Department:</span>
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="select-modern text-xs font-semibold"
                >
                  <option value="">All Departments</option>
                  {uniqueDepartments.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 text-xs text-primary font-bold">
                <Filter className="w-3.5 h-3.5 text-accent" />
                <span>Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="select-modern text-xs font-semibold"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active Staff</option>
                  <option value="inactive">Inactive Staff</option>
                </select>
              </div>

              {/* Sort By */}
              <div className="flex items-center gap-1.5 text-xs text-primary font-bold ml-auto">
                <span>Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="select-modern text-xs font-semibold"
                >
                  <option value="name">Name (A-Z)</option>
                  <option value="section">Section</option>
                  <option value="department">Department</option>
                </select>
              </div>
            </div>
          </div>

          {/* Directory Content Area */}
          {loading ? (
            <div className="py-20 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              <p className="mt-2 text-xs font-semibold text-primary/60">Loading Employee Directory...</p>
            </div>
          ) : loadError ? (
            <div className="card-glass p-12 text-center bg-white border border-accent-soft">
              <Users className="w-12 h-12 text-primary/30 mx-auto mb-3" />
              <h3 className="text-base font-bold text-primary">Employee Directory unavailable</h3>
              <p className="text-xs text-primary/60 mt-1 max-w-sm mx-auto">{loadError}</p>
              <button
                onClick={() => fetchEmployees()}
                className="mt-4 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="card-glass p-12 text-center bg-white border border-accent-soft">
              <Users className="w-12 h-12 text-primary/30 mx-auto mb-3" />
              <h3 className="text-base font-bold text-primary">No Employees Found</h3>
              <p className="text-xs text-primary/60 mt-1 max-w-sm mx-auto">
                No employee records match your selected section or search criteria.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* VIEW 1: Section-wise View (Grouped by Section) */}
              {viewMode === 'section' && (
                <div className="space-y-8">
                  {groupedBySection.map((group) => (
                    <div
                      key={group.section}
                      className="bg-white rounded-3xl border border-[#E1DDD3] shadow-xs p-5 sm:p-6 space-y-4"
                    >
                      {/* Section Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E1DDD3]">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#123C35] text-[#C9A45C] flex items-center justify-center font-bold shadow-xs">
                            <Layers className="w-5 h-5 text-[#C9A45C]" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h2 className="text-base sm:text-lg font-black text-primary tracking-tight">
                                {group.section}
                              </h2>
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-500/10 text-amber-800 border border-amber-500/20">
                                {group.employees.length} {group.employees.length === 1 ? 'Staff Member' : 'Staff Members'}
                              </span>
                            </div>
                            <p className="text-xs text-primary/60 font-semibold mt-0.5">
                              Department: {group.department}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Employee Cards Grid in this Section */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {group.employees.map(renderEmployeeCard)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* VIEW 2: Department-wise View */}
              {viewMode === 'department' && (
                <div className="space-y-8">
                  {groupedByDepartment.map((group) => (
                    <div
                      key={group.department}
                      className="bg-white rounded-3xl border border-[#E1DDD3] shadow-xs p-5 sm:p-6 space-y-4"
                    >
                      {/* Department Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E1DDD3]">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-primary text-accent flex items-center justify-center font-bold shadow-xs">
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h2 className="text-base sm:text-lg font-black text-primary tracking-tight">
                                {group.department}
                              </h2>
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-primary/10 text-primary border border-primary/20">
                                {group.employees.length} {group.employees.length === 1 ? 'Employee' : 'Employees'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Employee Cards Grid in this Department */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {group.employees.map(renderEmployeeCard)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* VIEW 3: Flat Grid of All Cards */}
              {viewMode === 'grid' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredEmployees.map(renderEmployeeCard)}
                </div>
              )}
            </div>
          )}

          {/* Full Employee Profile / Edit Modal */}
          {profileModalData && (
            <EmployeeProfileModal
              employee={profileModalData}
              onClose={() => setProfileModalData(null)}
              onUpdated={() => {
                fetchEmployees();
              }}
            />
          )}

          {/* Add Employee Modal */}
          <AddEmployeeModal
            isOpen={showAddModal}
            onClose={() => setShowAddModal(false)}
            onSuccess={() => fetchEmployees()}
            existingSections={uniqueSections}
            existingDepartments={uniqueDepartments}
          />

          {/* Delete Employee Confirmation Modal */}
          <ModalPortal
            isOpen={!!employeeToDelete}
            onClose={() => setEmployeeToDelete(null)}
            ariaLabel="Confirm Employee Deletion"
          >
            <div className="relative w-full max-w-sm bg-white rounded-3xl p-6 border-2 border-rose-300 shadow-2xl space-y-4 text-center select-text">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-primary text-base">
                  Remove Employee from Directory?
                </h3>
                <p className="text-xs text-primary/70 mt-1">
                  Are you sure you want to remove <strong>"{employeeToDelete?.name}"</strong>?
                  This action will update the master directory and database.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEmployeeToDelete(null)}
                  disabled={deletingEmployee}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold text-[#5D4E42] hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteEmployee}
                  disabled={deletingEmployee}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {deletingEmployee ? 'Removing…' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          </ModalPortal>

          {/* PII Access Request Modal */}
          {accessDeniedData && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
              <div className="bg-white rounded-3xl shadow-2xl border-2 border-accent/40 w-full max-w-lg overflow-hidden animate-scale-in flex flex-col">
                <div className="p-5 bg-gradient-to-r from-primary via-primary to-[#3D2B1F] text-white flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-400/30 flex items-center justify-center font-black">
                      <ShieldCheck className="w-5 h-5 text-rose-300" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-white">Access Restricted</h3>
                      <p className="text-xs text-accent-light font-semibold">Sensitive Employee Data Protected</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAccessDeniedData(null)}
                    className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    ✖
                  </button>
                </div>

                <div className="p-6 space-y-4 text-xs">
                  <div className="p-4 bg-background rounded-2xl border border-accent-soft space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-primary/60 block">Directory Record</span>
                    <div className="grid grid-cols-2 gap-2 text-primary">
                      <div>
                        <span className="text-[10px] text-primary/60 font-semibold block">Employee Name</span>
                        <span className="font-bold text-sm text-primary">{accessDeniedData.summary.full_name || accessDeniedData.summary.name}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-primary/60 font-semibold block">Section</span>
                        <span className="font-semibold text-xs text-primary">{accessDeniedData.summary.section || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-primary/60 font-semibold block">Department</span>
                        <span className="font-semibold text-xs text-primary">{accessDeniedData.summary.department || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {accessDeniedData.existingRequest && accessDeniedData.existingRequest.status === 'pending' ? (
                    <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5">
                      <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-extrabold text-amber-950">Access Request Pending Review</p>
                        <p className="mt-0.5 text-amber-800 leading-relaxed">
                          Your request to view this profile was submitted and is currently awaiting approval from an Administrator.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 pt-1">
                      <label className="text-[11px] font-bold text-primary block">
                        Business Justification / Reason (Optional)
                      </label>
                      <textarea
                        rows={2}
                        value={requestReason}
                        onChange={(e) => setRequestReason(e.target.value)}
                        placeholder="Explain why you need access to view full employee information..."
                        className="w-full p-2.5 rounded-xl border border-accent-soft bg-card text-xs text-primary focus:outline-none focus:border-accent"
                      />
                    </div>
                  )}
                </div>

                <div className="p-4 bg-background border-t border-accent-soft flex items-center justify-between shrink-0">
                  <button
                    type="button"
                    onClick={() => setAccessDeniedData(null)}
                    className="px-4 py-2 rounded-xl border border-accent-soft text-primary text-xs font-bold hover:bg-card cursor-pointer"
                  >
                    Cancel
                  </button>

                  {(!accessDeniedData.existingRequest || accessDeniedData.existingRequest.status !== 'pending') && (
                    <button
                      type="button"
                      onClick={handleSendAccessRequest}
                      disabled={submittingAccessRequest}
                      className="btn-gold text-xs px-4 py-2 font-black flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                    >
                      {submittingAccessRequest ? (
                        <span>Submitting…</span>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          <span>Request Access from Admin</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Bulk Import Modal */}
          <EmployeeImportModal
            isOpen={showImportModal}
            onClose={() => setShowImportModal(false)}
            onSuccess={() => fetchEmployees()}
          />
        </div>
      </PageContainer>
    </DashboardLayout>
  );
}
