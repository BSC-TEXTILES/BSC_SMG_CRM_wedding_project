import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layouts/DashboardLayout';
import PageContainer from '../components/ui/PageContainer';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import MetricCard from '../components/ui/MetricCard';
import StatusBadge from '../components/ui/StatusBadge';
import { useRealtimeSection } from '../hooks/useRealtimeSection';
import { Users, Search, Filter, Building2, ChevronRight, FileSpreadsheet, RotateCcw, ShieldCheck, ShieldAlert, Lock, Clock, Layers, User, Briefcase, UserCheck, UserMinus, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import EmployeeProfileModal from '../components/ui/EmployeeProfileModal';
import EmployeeImportModal from '../components/ui/EmployeeImportModal';

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
  locationId: number | null;
  locationCode: string | null;
  locationName: string | null;
  employeeId: string;
  empNo: string;
  appNo: string;
  active: boolean;
}

/**
 * Directory rows are name-only. The API's `employeeCode` can fall back to the
 * account login name (for example `greeter@bsctextiles.com`), which is a login
 * identifier / email — never an employee code. Suppress it so a private
 * identifier is never rendered, searched on, or exported.
 */
const directoryCode = (e: EmployeeDirectoryItem): string => {
  const code = (e.employeeCode || '').trim();
  if (!code) return '';
  if (code.includes('@')) return '';
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
  const [desigFilter, setDesigFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'department' | 'designation' | 'status'>('name');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDirectoryItem | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  const isAdminOrManager = Boolean(
    session && ['admin', 'super admin', 'system administrator', 'manager', 'store manager', 'hr manager'].includes(
      String(session.role || '').toLowerCase()
    )
  );

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.getEmployees();
      if (res && res.success && Array.isArray(res.employees)) {
        setEmployees(res.employees.map(toDirectoryItem));
      } else if (Array.isArray(res)) {
        setEmployees(res.map(toDirectoryItem));
      } else {
        setEmployees([]);
        setLoadError('Unable to load Employee Directory. Please try again.');
        return;
      }
      setLoadError(null);
    } catch (err: any) {
      // Technical detail stays in the console/secure log only — the user gets a
      // friendly, actionable message instead of a raw HTTP/runtime error.
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

  const filteredEmployees = useMemo(() => {
    let list = [...employees];

    if (statusFilter === 'active') {
      list = list.filter(e => e.active);
    } else if (statusFilter === 'inactive') {
      list = list.filter(e => !e.active);
    }

    if (deptFilter) {
      list = list.filter(e => (e.department || '').toLowerCase().trim() === deptFilter.toLowerCase().trim());
    }

    if (desigFilter) {
      list = list.filter(e => e.designation === desigFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      // Name-only directory: search never matches on private contact details.
      list = list.filter(e =>
        (e.name || '').toLowerCase().includes(q) ||
        (e.employeeCode || '').toLowerCase().includes(q) ||
        (e.department || '').toLowerCase().includes(q) ||
        (e.designation || '').toLowerCase().includes(q) ||
        (e.section || '').toLowerCase().includes(q) ||
        (e.branch || '').toLowerCase().includes(q)
      );
    }

    if (sortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'department') {
      list.sort((a, b) => a.department.localeCompare(b.department) || a.name.localeCompare(b.name));
    } else if (sortBy === 'designation') {
      list.sort((a, b) => a.designation.localeCompare(b.designation) || a.name.localeCompare(b.name));
    } else if (sortBy === 'status') {
      list.sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    }

    return list;
  }, [employees, deptFilter, desigFilter, statusFilter, searchQuery, sortBy]);

  const uniqueDepartments = useMemo(() =>
    Array.from(new Set(employees.map(e => e.department).filter(Boolean))).sort()
  , [employees]);

  const uniqueDesignations = useMemo(() =>
    Array.from(new Set(employees.map(e => e.designation).filter(Boolean))).sort()
  , [employees]);

  const totalEmployees = employees.length;
  const activeEmployees = employees.filter(e => e.active).length;
  const inactiveEmployees = employees.filter(e => !e.active).length;
  const uniqueDepts = Array.from(new Set(employees.map(e => e.department).filter(Boolean))).length;

  const handleExportDirectory = async () => {
    setExporting(true);
    try {
      // Export the directory currently on screen (name-only). The shared
      // /directory/export endpoint returns store rows, so it is not used here.
      const exportRows = filteredEmployees.map((e, idx) => ({
        'S.No': idx + 1,
        'Employee Name': e.name,
        'Employee Code': e.employeeCode,
        'Department': e.department,
        'Designation': e.designation,
        'Section': e.section,
        'Branch': e.branch,
        'Status': e.status,
        'Location': e.locationName,
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

  const [profileModalData, setProfileModalData] = useState<any | null>(null);
  const [accessDeniedData, setAccessDeniedData] = useState<{
    summary: any;
    existingRequest?: any;
  } | null>(null);
  const [requestReason, setRequestReason] = useState('');
  const [submittingAccessRequest, setSubmittingAccessRequest] = useState(false);
  const [loadingDetailsId, setLoadingDetailsId] = useState<number | null>(null);

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
      console.warn('[Employees] Access check for employee details:', err);
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
        console.warn('[Employees] Server error loading full profile, showing directory overview:', err);
        if (emp) {
          setProfileModalData({
            ...emp,
            id: emp.id,
            userId: emp.id,
            fullName: emp.name || emp.fullName,
            name: emp.name || emp.fullName,
            employeeCode: emp.employeeCode || emp.empNo || emp.appNo,
            branch: emp.branch || emp.locationName,
          });
        } else {
          showToast(err.message || 'Unable to load employee details', 'error');
        }
      }
    } finally {
      setLoadingDetailsId(null);
    }
  };

  const handleSendAccessRequest = async () => {
    if (!accessDeniedData?.summary?.id) return;
    setSubmittingAccessRequest(true);
    try {
      const res = await API.requestEmployeeAccess(accessDeniedData.summary.id, requestReason);
      showToast('Access request submitted to Administrators in real-time.', 'success');
      setAccessDeniedData(prev => prev ? {
        ...prev,
        existingRequest: {
          id: res?.requestId,
          status: 'pending',
          created_at: new Date().toISOString(),
          reason: requestReason
        }
      } : null);
      setRequestReason('');
    } catch (err: any) {
      showToast(err.message || 'Failed to submit access request', 'error');
    } finally {
      setSubmittingAccessRequest(false);
    }
  };

  return (
    <DashboardLayout
      title="Employee Master Directory"
      breadcrumbs={[{ label: 'Operations', href: '/dashboard' }, { label: 'Employee Directory' }]}
    >
      <PageContainer maxWidth="full">
        <div className="space-y-6 animate-fade-in">
          <ToastContainer />

          {/* Top Banner & User Management Navigation */}
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
                    <ShieldCheck className="w-3 h-3 inline" /> PII Protected
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-primary tracking-tight mt-1">
                  Employee Master Directory
                </h1>
                <p className="text-xs text-primary font-medium mt-0.5">
                  Clean employee name directory — search, filter, and manage workforce across all locations.
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

              {isAdminOrManager && (
                <button
                  type="button"
                  onClick={() => navigate('/user-management')}
                  className="btn-gold text-xs px-4 py-2 font-extrabold flex items-center gap-1.5 cursor-pointer shadow-md shrink-0"
                  title="Manage individual user accounts, credentials, and roles"
                >
                  <Users className="w-4 h-4" />
                  <span>User & Staff Management</span>
                  <ChevronRight className="w-3.5 h-3.5" />
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

          {/* Privacy & Sanitization Notice Banner */}
          <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/15 flex items-center justify-between text-xs text-primary font-medium">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-accent shrink-0" />
              <span>
                <strong>Privacy Policy Compliance:</strong> Employee personal contact details (phone, email, address, ID) are restricted.
                This directory displays <strong>names only</strong>. Full profiles accessible in <strong>User Management</strong> with proper authorization.
              </span>
            </div>
          </div>

          {/* Metric Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Employees"
              value={totalEmployees}
              subtext="Registered in system"
              icon={Users}
              color="teal"
            />
            <MetricCard
              title="Active Staff"
              value={activeEmployees}
              subtext="Currently onboarded"
              icon={UserCheck}
              color="gold"
            />
            <MetricCard
              title="Inactive"
              value={inactiveEmployees}
              subtext="Deactivated / Left"
              icon={UserMinus}
              color="rose"
            />
            <MetricCard
              title="Departments"
              value={uniqueDepts}
              subtext="Across all locations"
              icon={Layers}
              color="rose"
            />
          </div>

          {/* Filter, Search, and Controls Bar */}
          <div className="card-glass p-4 bg-white border border-accent-soft/70 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-primary/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, code, department, designation, section, branch..."
                className="input-modern text-xs pl-9 pr-3 w-full"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-primary font-bold">
                <Filter className="w-3.5 h-3.5 text-accent" />
                <span>Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="select-modern text-xs font-semibold"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-primary font-bold">
                <Filter className="w-3.5 h-3.5 text-accent" />
                <span>Department:</span>
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="select-modern text-xs font-semibold"
                >
                  <option value="">All Departments</option>
                  {uniqueDepartments.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-primary font-bold">
                <Filter className="w-3.5 h-3.5 text-accent" />
                <span>Designation:</span>
                <select
                  value={desigFilter}
                  onChange={(e) => setDesigFilter(e.target.value)}
                  className="select-modern text-xs font-semibold"
                >
                  <option value="">All Designations</option>
                  {uniqueDesignations.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-primary font-bold">
                <span>Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="select-modern text-xs font-semibold"
                >
                  <option value="name">Name (A-Z)</option>
                  <option value="department">Department</option>
                  <option value="designation">Designation</option>
                  <option value="status">Status</option>
                </select>
              </div>

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

          {/* Employee Directory Cards Grid */}
          {loading ? (
            <div className="py-20 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              <p className="mt-2 text-xs font-semibold text-primary/60">Loading Employee Directory...</p>
            </div>
          ) : loadError ? (
            <div className="card-glass p-12 text-center bg-white border border-accent-soft">
              <Users className="w-12 h-12 text-primary/30 mx-auto mb-3" />
              <h3 className="text-base font-bold text-primary">Employee Directory unavailable</h3>
              <p className="text-xs text-primary/60 mt-1 max-w-sm mx-auto">
                {loadError}
              </p>
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
                No employees match your search criteria. Try clearing filters or search terms.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredEmployees.map((emp) => (
                  <div
                    key={emp.id}
                    className="card-glass p-4 bg-white border border-accent/30 hover:border-accent hover:shadow-xl transition-all duration-200 rounded-2xl flex flex-col justify-between group space-y-3 cursor-pointer"
                    onClick={() => openEmployeeDetails(emp)}
                  >
                    <div className="space-y-2">
                      {/* Header Row */}
                      <div className="flex items-start justify-between gap-2 border-b border-accent-soft/60 pb-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary font-mono">
                              {emp.employeeCode}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                              {emp.active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <h3 className="font-extrabold text-base text-primary group-hover:text-accent transition-colors mt-1">
                            {emp.name}
                          </h3>
                        </div>

                        <div className="p-2 rounded-2xl bg-accent/15 text-accent shrink-0 group-hover:scale-105 transition-transform">
                          <User className="w-5 h-5" />
                        </div>
                      </div>

                      {/* Employee Details */}
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-start gap-2 text-primary font-medium">
                          <Building2 className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                          <span className="line-clamp-1">{emp.department || '—'}</span>
                        </div>

                        <div className="flex items-center gap-2 text-primary font-medium">
                          <Briefcase className="w-3.5 h-3.5 text-accent shrink-0" />
                          <span className="line-clamp-1">{emp.designation || '—'}</span>
                        </div>

                        <div className="flex items-center gap-2 text-primary font-medium">
                          <Layers className="w-3.5 h-3.5 text-accent shrink-0" />
                          <span className="line-clamp-1">{emp.section || '—'}</span>
                        </div>

                        <div className="flex items-center gap-2 text-primary font-medium">
                          <Building2 className="w-3.5 h-3.5 text-accent shrink-0" />
                          <span className="line-clamp-1">{emp.branch || '—'}</span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="pt-1 border-t border-accent-soft/50 flex items-center justify-between">
                        <StatusBadge status={emp.status} size="sm" />
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="pt-2 border-t border-accent-soft/60 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black">
                          <Users className="w-3.5 h-3.5 text-accent" />
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-primary/60 block">Staff</span>
                          <span className="font-extrabold text-sm text-primary font-mono">{emp.employeeCode}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEmployeeDetails(emp);
                        }}
                        disabled={loadingDetailsId === emp.id}
                        className="text-xs font-bold text-accent group-hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <span>{loadingDetailsId === emp.id ? 'Loading…' : 'View Details'}</span>
                        {loadingDetailsId === emp.id ? (
                          <RotateCcw className="w-3.5 h-3.5 animate-spin text-accent" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Full Profile Modal for Authorized Admins / Approved Users */}
              {profileModalData && (
                <EmployeeProfileModal
                  employee={profileModalData}
                  onClose={() => setProfileModalData(null)}
                  onUpdated={() => {
                    fetchEmployees();
                  }}
                />
              )}

              {/* Access Restricted & Request Modal for Unauthorized Users */}
              {accessDeniedData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
                  <div className="bg-white rounded-3xl shadow-2xl border-2 border-accent/40 w-full max-w-lg overflow-hidden animate-scale-in flex flex-col">
                    {/* Modal Header */}
                    <div className="p-5 bg-gradient-to-r from-primary via-primary to-[#3D2B1F] text-white flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-400/30 flex items-center justify-center font-black">
                          <Lock className="w-5 h-5 text-rose-300" />
                        </div>
                        <div>
                          <h3 className="text-base font-extrabold text-white">
                            Access Restricted
                          </h3>
                          <p className="text-xs text-accent-light font-semibold">
                            Sensitive Employee Data Protected
                          </p>
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

                    {/* Content */}
                    <div className="p-6 space-y-4 text-xs">
                      <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-2.5">
                        <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-extrabold text-rose-950">PII & Salary Data Protected</p>
                          <p className="mt-0.5 text-rose-800 leading-relaxed">
                            Personal contact details, salary structure, documents, and identity numbers are restricted to authorized System Administrators under the company data protection policy.
                          </p>
                        </div>
                      </div>

                      {/* Public Summary */}
                      <div className="p-4 bg-background rounded-2xl border border-accent-soft space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-primary/60 block">Directory Record</span>
                        <div className="grid grid-cols-2 gap-2 text-primary">
                          <div>
                            <span className="text-[10px] text-primary/60 font-semibold block">Employee Name</span>
                            <span className="font-bold text-sm text-primary">{accessDeniedData.summary.full_name || accessDeniedData.summary.name}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-primary/60 font-semibold block">Employee Code</span>
                            <span className="font-mono font-bold text-sm text-primary">{accessDeniedData.summary.employee_code || accessDeniedData.summary.employeeCode || '—'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-primary/60 font-semibold block">Department</span>
                            <span className="font-semibold text-xs text-primary">{accessDeniedData.summary.department || '—'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-primary/60 font-semibold block">Designation</span>
                            <span className="font-semibold text-xs text-primary">{accessDeniedData.summary.designation || '—'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Existing Request or New Request Input */}
                      {accessDeniedData.existingRequest && accessDeniedData.existingRequest.status === 'pending' ? (
                        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5">
                          <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-extrabold text-amber-950">Access Request Pending Review</p>
                            <p className="mt-0.5 text-amber-800 leading-relaxed">
                              Your request to view this profile was submitted and is currently awaiting approval from an Administrator. You will receive a notification once resolved.
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

                    {/* Footer */}
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
            </>
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
