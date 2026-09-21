import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import { getSidebarCollapsed, subscribeSidebarCollapsed } from '../utils/sidebarState';
import MetricCard from '../components/ui/MetricCard';
import StatusBadge from '../components/ui/StatusBadge';
import ManageSectionsModal from '../components/ManageSectionsModal';
import EmployeeProfileModal from '../components/ui/EmployeeProfileModal';
import { BSC_DEPARTMENT_SECTIONS, BSC_DEPARTMENTS, getSectionsForDepartment, getUniqueDepartments, normalizeDepartmentName } from '../utils/bscDepartments';
import { 
  Layers, 
  Users, 
  Search, 
  Filter, 
  Save, 
  X, 
  SquareCheck, 
  Square, 
  UserCheck, 
  Building2, 
  Calendar, 
  DollarSign, 
  Phone, 
  Mail, 
  FileText, 
  Briefcase, 
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  CheckCircle,
  CircleAlert,
  ArrowRight,
  Sparkles,
  Plus
} from 'lucide-react';

export default function SectionAllocationPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(getSidebarCollapsed());

  useEffect(() => {
    return subscribeSidebarCollapsed(setCollapsed);
  }, []);

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [dbSections, setDbSections] = useState<any[]>([]);
  const [manageSectionsOpen, setManageSectionsOpen] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedSection, setSelectedSection] = useState('All');
  const [selectedDesig, setSelectedDesig] = useState('All');
  const [selectedBranch, setSelectedBranch] = useState('All');
  const [joiningDateFilter, setJoiningDateFilter] = useState('');

  // Multi-select for Bulk Actions
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);
  const [bulkModal, setBulkModal] = useState<{ open: boolean; action: 'assign' | 'move' | 'remove'; section: string }>({
    open: false,
    action: 'assign',
    section: ''
  });

  // Employee Overview Centered Modal
  const [overviewModal, setOverviewModal] = useState<{ open: boolean; emp: any | null }>({
    open: false,
    emp: null
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [eRes, aRes, sRes] = await Promise.all([
        API.getEmployees(),
        API.getSectionAllocations(),
        API.getDepartmentSections()
      ]);

      let empList: any[] = [];
      if (Array.isArray(eRes)) empList = eRes;
      else if (eRes && eRes.employees) empList = eRes.employees;

      setEmployees(empList);

      if (aRes && aRes.allocations) {
        const allocMap: Record<string, string> = {};
        aRes.allocations.forEach((a: any) => {
          if (a.employee_id) {
            allocMap[a.employee_id] = a.section || '';
          }
        });
        setAllocations(allocMap);
      }

      if (sRes && sRes.sections) {
        setDbSections(sRes.sections);
      }
    } catch (err: any) {
      console.warn('Load Section Allocation error:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    setSession(Auth.get());
    loadData();
  }, [navigate, loadData]);

  // Department Section Mapping (Derived 100% dynamically from database records)
  const activeDeptSectionsMap = useMemo(() => {
    const map: Record<string, string[]> = {};

    if (dbSections && dbSections.length > 0) {
      dbSections.forEach(s => {
        if (s.department && s.section_name && s.active !== false) {
          const normDept = normalizeDepartmentName(s.department);
          if (!map[normDept]) map[normDept] = [];
          if (!map[normDept].includes(s.section_name)) {
            map[normDept].push(s.section_name);
          }
        }
      });
    } else {
      // Fallback only if database table is empty
      BSC_DEPARTMENTS.forEach(d => {
        map[d] = [...(BSC_DEPARTMENT_SECTIONS[d] || [])];
      });
    }

    return map;
  }, [dbSections]);

  const activeDepartmentsList = useMemo(() => {
    const keys = Object.keys(activeDeptSectionsMap);
    return keys.length > 0 ? keys : BSC_DEPARTMENTS;
  }, [activeDeptSectionsMap]);

  // Combined employee rows with allocated section & candidate remarks
  const formattedRows = useMemo(() => {
    return employees.map(emp => {
      const empId = String(emp.id || emp.appNo || emp.employeeCode || emp.app_no);
      const dept = emp.department || emp.dept || 'Mens';
      const allocatedSection = allocations[empId] || emp.section || '';

      const remarksVal = emp.remarks || emp.shortlistRemarks || emp.call1Remarks || emp.call_remarks || emp.confirm_remarks || emp.offer_remarks || emp.notes || emp.remarks_history || '—';

      return {
        ...emp,
        empId,
        appNo: emp.appNo || emp.app_no || empId,
        name: emp.name || emp.fullName || 'Employee',
        desig: emp.desig || emp.designation || 'Sales Executive',
        department: dept,
        section: allocatedSection,
        remarks: remarksVal,
        doj: emp.doj || emp.actualDoj || emp.offeredDoj || emp.date || '01-Jan-2026',
        salary: emp.salary || emp.offeredSalary || '₹125,000',
        status: emp.status || 'Active Staff',
        branch: emp.branch || 'Main Mall - MG Road',
        phone: emp.phone || emp.mobile || '+91 9876543210',
        email: emp.email || `${(emp.name || 'emp').toLowerCase().replace(/\s+/g, '.')}@bsctextiles.in`,
        initials: (emp.name || 'Emp').split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
      };
    });
  }, [employees, allocations]);

  // Dynamic filter options derived from actual employee & candidate data
  const departmentFilterOptions = useMemo(() => {
    const fromRows = formattedRows.map(e => e.department);
    return getUniqueDepartments([...activeDepartmentsList, ...fromRows]);
  }, [formattedRows, activeDepartmentsList]);

  const designationFilterOptions = useMemo(() => {
    const set = new Set<string>();
    formattedRows.forEach(e => {
      if (e.desig && e.desig.trim()) set.add(e.desig.trim());
    });
    return Array.from(set).sort();
  }, [formattedRows]);

  const sectionFilterOptions = useMemo(() => {
    const set = new Set<string>();
    formattedRows.forEach(e => {
      if (e.section && e.section.trim()) set.add(e.section.trim());
    });
    if (selectedDept !== 'All') {
      const canonicalKey = Object.keys(activeDeptSectionsMap).find(k => k.toLowerCase() === selectedDept.toLowerCase());
      const secList = canonicalKey ? activeDeptSectionsMap[canonicalKey] : (activeDeptSectionsMap[selectedDept] || []);
      (secList || []).forEach(s => set.add(s));
    } else {
      Object.values(activeDeptSectionsMap).forEach(list => list.forEach(s => set.add(s)));
    }
    return Array.from(set).sort();
  }, [formattedRows, selectedDept, activeDeptSectionsMap]);

  // Filtered Employee list
  const filteredEmployees = useMemo(() => {
    return formattedRows.filter(emp => {
      if (selectedDept !== 'All' && (emp.department || '').toLowerCase().trim() !== selectedDept.toLowerCase().trim()) return false;
      if (selectedSection !== 'All' && (emp.section || '').toLowerCase().trim() !== selectedSection.toLowerCase().trim()) return false;
      if (selectedDesig !== 'All' && (emp.desig || '').toLowerCase().trim() !== selectedDesig.toLowerCase().trim()) return false;
      if (selectedBranch !== 'All' && (emp.branch || '').toLowerCase().trim() !== selectedBranch.toLowerCase().trim()) return false;

      if (joiningDateFilter) {
        const fDate = new Date(joiningDateFilter).toDateString();
        const eDate = new Date(emp.doj).toDateString();
        if (fDate !== eDate) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match = emp.empId.toLowerCase().includes(q) ||
                      emp.appNo.toLowerCase().includes(q) ||
                      emp.name.toLowerCase().includes(q) ||
                      emp.phone.includes(q) ||
                      emp.desig.toLowerCase().includes(q) ||
                      emp.department.toLowerCase().includes(q) ||
                      emp.section.toLowerCase().includes(q) ||
                      (emp.remarks && emp.remarks.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [formattedRows, selectedDept, selectedSection, selectedDesig, selectedBranch, joiningDateFilter, searchQuery]);

  // Summary Metrics
  const summary = useMemo(() => {
    const total = filteredEmployees.length;
    const allocated = filteredEmployees.filter(e => Boolean(e.section && e.section.trim())).length;
    const notAllocated = total - allocated;
    const deptsCount = new Set(filteredEmployees.map(e => e.department)).size;

    const sectionsSet = new Set<string>();
    filteredEmployees.forEach(e => { if (e.section) sectionsSet.add(e.section); });

    return {
      total,
      allocated,
      notAllocated,
      deptsCount,
      sectionsCount: sectionsSet.size
    };
  }, [filteredEmployees]);

  // Save Single Employee Section
  const handleSaveSection = async (emp: any, newSection: string) => {
    try {
      const res = await API.saveSectionAllocation({
        employeeId: emp.empId,
        appNo: emp.appNo,
        employeeName: emp.name,
        department: emp.department,
        section: newSection,
        assignedBy: session?.fullName || 'HR'
      });

      if (res && res.success !== false) {
        setAllocations(prev => ({ ...prev, [emp.empId]: newSection }));
        showToast(`Section assigned to ${emp.name}`, 'success');
      } else {
        showToast(res.error || 'Failed to update section', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Save failed', 'error');
    }
  };

  // Bulk Select Toggle
  const toggleSelectAll = () => {
    if (selectedEmpIds.length === filteredEmployees.length) {
      setSelectedEmpIds([]);
    } else {
      setSelectedEmpIds(filteredEmployees.map(e => e.empId));
    }
  };

  const toggleSelectEmp = (empId: string) => {
    setSelectedEmpIds(prev => 
      prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
    );
  };

  // Bulk Save Execution
  const handleExecuteBulkAction = async () => {
    if (selectedEmpIds.length === 0) return;

    try {
      const targetEmps = formattedRows.filter(e => selectedEmpIds.includes(e.empId));

      const res = await API.bulkSaveSectionAllocation({
        employees: targetEmps.map(e => ({
          employeeId: e.empId,
          appNo: e.appNo,
          employeeName: e.name,
          department: e.department
        })),
        section: bulkModal.action === 'remove' ? '' : bulkModal.section,
        action: bulkModal.action,
        assignedBy: session?.fullName || 'HR'
      });

      if (res && res.success !== false) {
        showToast(`Updated section for ${selectedEmpIds.length} employees`, 'success');
        const newSectionVal = bulkModal.action === 'remove' ? '' : bulkModal.section;
        setAllocations(prev => {
          const next = { ...prev };
          selectedEmpIds.forEach(id => { next[id] = newSectionVal; });
          return next;
        });
        setSelectedEmpIds([]);
        setBulkModal(prev => ({ ...prev, open: false }));
      } else {
        showToast(res.error || 'Bulk update failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Bulk update error', 'error');
    }
  };

  const isHR = session?.role === 'HR' || session?.role === 'Admin' || session?.role === 'Super Admin';

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
          title="Section Allocation" 
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="p-4 lg:p-6 space-y-6 flex-1 overflow-y-auto pb-24">
          {/* Header Banner */}
          <div className="card-glass p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-primary tracking-tight flex items-center gap-2">
                <Layers className="w-5 h-5 text-accent" />
                <span>Internal Workforce Section Allocation</span>
              </h2>
              <p className="text-xs text-primary font-medium mt-0.5">
                Allocate onboarded employees directly from Employee Directory to BSC Textiles floor sections.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isHR && (
                <button
                  onClick={() => setManageSectionsOpen(true)}
                  className="btn-primary text-xs flex items-center gap-1.5 shadow-xs"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Manage Sections</span>
                </button>
              )}
              <button
                onClick={() => navigate('/employees')}
                className="btn-secondary text-xs flex items-center gap-1.5 shadow-xs"
              >
                <span>Employee Directory</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Top Summary Dashboard Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <MetricCard
              title="Total Employees"
              value={summary.total}
              subtext="Directory workforce"
              icon={Users}
              color="navy"
            />
            <MetricCard
              title="Allocated Staff"
              value={summary.allocated}
              subtext="Assigned to sections"
              icon={UserCheck}
              color="emerald"
            />
            <MetricCard
              title="Not Allocated"
              value={summary.notAllocated}
              subtext="Pending section placement"
              icon={CircleAlert}
              color="rose"
            />
            <MetricCard
              title="Active Departments"
              value={summary.deptsCount}
              subtext="BSC Textiles floors"
              icon={Building2}
              color="gold"
            />
            <MetricCard
              title="Allocated Sections"
              value={summary.sectionsCount}
              subtext="Floor sections"
              icon={Layers}
              color="indigo"
            />
          </div>

          {/* Filter Bar */}
          <div className="card-glass p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-accent-soft pb-2.5">
              <div className="text-xs font-black text-primary uppercase tracking-wider flex items-center gap-2">
                <Filter className="w-4 h-4 text-accent" />
                <span>Search &amp; Filter Employees</span>
              </div>
              <span className="text-[11px] text-primary font-semibold">
                Showing {filteredEmployees.length} employee records
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              {/* Global Search */}
              <div className="lg:col-span-2">
                <label className="text-[10.5px] font-extrabold text-[#5D4E42] uppercase block mb-1">
                  Global Search (ID, App No, Name, Phone)
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-primary" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search ID, name, designation, phone..."
                    className="w-full pl-8 pr-2.5 py-1.5 rounded-xl border border-accent-soft bg-background text-xs font-semibold text-primary focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Department */}
              <div>
                <label className="text-[10.5px] font-extrabold text-[#5D4E42] uppercase block mb-1">Department</label>
                <select
                  value={selectedDept}
                  onChange={(e) => { setSelectedDept(e.target.value); setSelectedSection('All'); }}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-accent-soft bg-background text-xs font-semibold text-primary focus:outline-none focus:border-primary"
                >
                  <option value="All">All Departments</option>
                  {departmentFilterOptions.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Section */}
              <div>
                <label className="text-[10.5px] font-extrabold text-[#5D4E42] uppercase block mb-1">Section</label>
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-accent-soft bg-background text-xs font-semibold text-primary focus:outline-none focus:border-primary"
                >
                  <option value="All">All Sections</option>
                  {sectionFilterOptions.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Designation */}
              <div>
                <label className="text-[10.5px] font-extrabold text-[#5D4E42] uppercase block mb-1">Designation</label>
                <select
                  value={selectedDesig}
                  onChange={(e) => setSelectedDesig(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-accent-soft bg-background text-xs font-semibold text-primary focus:outline-none focus:border-primary"
                >
                  <option value="All">All Designations</option>
                  {designationFilterOptions.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Joining Date */}
              <div>
                <label className="text-[10.5px] font-extrabold text-[#5D4E42] uppercase block mb-1">Joining Date</label>
                <input
                  type="date"
                  value={joiningDateFilter}
                  onChange={(e) => setJoiningDateFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-accent-soft bg-background text-xs font-semibold text-primary focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>

          {/* Employee Section Allocation Table */}
          <div className="card-glass p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-accent-soft pb-3">
              <div>
                <h3 className="font-extrabold text-primary text-base tracking-tight">Employee Directory &amp; Floor Section Assignment</h3>
                <p className="text-xs text-primary font-medium mt-0.5">
                  Assign employees to department-specific sections without modifying core recruitment records.
                </p>
              </div>
              {selectedEmpIds.length > 0 && (
                <div className="text-xs font-extrabold text-primary bg-accent/20 px-3 py-1 rounded-full border border-accent">
                  {selectedEmpIds.length} Selected for Bulk Action
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-accent-soft text-[10.5px] font-black uppercase text-primary tracking-wider bg-background/60">
                    <th className="py-3.5 px-3 text-center w-12">SL.NO</th>
                    {isHR && (
                      <th className="py-3.5 px-3 text-center w-10">
                        <button onClick={toggleSelectAll} className="focus:outline-none">
                          {selectedEmpIds.length === filteredEmployees.length && filteredEmployees.length > 0 ? (
                            <SquareCheck className="w-4 h-4 text-primary" />
                          ) : (
                            <Square className="w-4 h-4 text-[#6B5D50]" />
                          )}
                        </button>
                      </th>
                    )}
                    <th className="py-3.5 px-4">Employee ID</th>
                    <th className="py-3.5 px-4 font-extrabold">App No</th>
                    <th className="py-3.5 px-4 font-extrabold">Employee Name</th>
                    <th className="py-3.5 px-4 font-extrabold">Designation</th>
                    <th className="py-3.5 px-4 font-extrabold">Department</th>
                    <th className="py-3.5 px-4 min-w-[180px] font-extrabold">Assigned Section</th>
                    <th className="py-3.5 px-4 min-w-[200px] font-extrabold">Shortlist Remarks</th>
                    <th className="py-3.5 px-4 font-extrabold">Date of Joining</th>
                    <th className="py-3.5 px-4 font-extrabold">Offered Salary</th>
                    <th className="py-3.5 px-4 text-center font-extrabold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-accent-soft/60">
                  {filteredEmployees.length > 0 ? (
                    filteredEmployees.map((emp, idx) => {
                      const isSelected = selectedEmpIds.includes(emp.empId);
                      const deptSections = activeDeptSectionsMap[emp.department] || getSectionsForDepartment(emp.department);

                      return (
                        <tr key={emp.empId} className={`hover:bg-black/5 transition-colors font-medium ${isSelected ? 'bg-accent/10' : ''}`}>
                          <td className="py-3.5 px-3 text-center font-bold text-primary">{idx + 1}</td>
                          {isHR && (
                            <td className="py-3.5 px-3 text-center">
                              <button onClick={() => toggleSelectEmp(emp.empId)} className="focus:outline-none">
                                {isSelected ? (
                                  <SquareCheck className="w-4 h-4 text-primary" />
                                ) : (
                                  <Square className="w-4 h-4 text-[#6B5D50]" />
                                )}
                              </button>
                            </td>
                          )}

                          <td className="py-3.5 px-4 font-mono font-bold text-[#5D4E42]">{emp.empId}</td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-primary">{emp.appNo}</td>

                          {/* Employee Name (Clickable -> Opens Centered Overview Modal) */}
                          <td className="py-3.5 px-4">
                            <button
                              onClick={() => setOverviewModal({ open: true, emp })}
                              className="flex items-center gap-2.5 text-left group focus:outline-none"
                            >
                              <div className="w-8 h-8 rounded-full bg-primary text-white font-black text-xs flex items-center justify-center shadow-xs">
                                {emp.initials}
                              </div>
                              <div>
                                <span className="font-black text-primary group-hover:text-accent group-hover:underline block transition-colors">
                                  {emp.name}
                                </span>
                                <span className="text-[10px] text-primary font-medium">{emp.phone}</span>
                              </div>
                            </button>
                          </td>

                          <td className="py-3.5 px-4 font-bold text-[#3D2B1F]">{emp.desig}</td>
                          <td className="py-3.5 px-4 font-extrabold text-primary">{emp.department}</td>

                          {/* Interactive Section Dropdown */}
                          <td className="py-3.5 px-4">
                            {isHR ? (
                              <div className="flex items-center gap-2">
                                <select
                                  value={emp.section || ''}
                                  onChange={(e) => handleSaveSection(emp, e.target.value)}
                                  className="w-full px-2.5 py-1.5 rounded-xl border border-accent-soft bg-white text-xs font-bold text-primary focus:border-primary shadow-xs"
                                >
                                  <option value="">-- Select {emp.department} Section --</option>
                                  {deptSections.map(sec => (
                                    <option key={sec} value={sec}>{sec}</option>
                                  ))}
                                </select>
                                {emp.section && (
                                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                )}
                              </div>
                            ) : (
                              <span className="font-bold text-accent">{emp.section || 'Unallocated'}</span>
                            )}
                          </td>

                          {/* Shortlist & Candidate Remarks Column */}
                          <td className="py-3.5 px-4">
                            {emp.remarks && emp.remarks !== '—' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 text-amber-900 border border-amber-200/70 font-semibold text-[11px] max-w-[220px] truncate" title={emp.remarks}>
                                💬 {emp.remarks}
                              </span>
                            ) : (
                              <span className="text-[#6B5D50] font-mono text-[11px]">—</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-primary font-semibold whitespace-nowrap">{emp.doj}</td>
                          <td className="py-3.5 px-4 font-extrabold text-primary">{emp.salary}</td>

                          <td className="py-3.5 px-4 text-center">
                            <span className="px-2.5 py-1 rounded-full text-[10.5px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                              {emp.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-xs text-primary font-semibold">
                        No employees found matching the filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedEmpIds.length > 0 && isHR && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-primary text-white px-6 py-3.5 rounded-2xl shadow-2xl border border-amber-400/30 flex items-center gap-4 animate-bounce-subtle">
          <span className="text-xs font-bold">
            <span className="text-accent font-black">{selectedEmpIds.length}</span> Employees Selected
          </span>

          <div className="h-4 w-px bg-black/20" />

          <button
            onClick={() => setBulkModal({ open: true, action: 'assign', section: '' })}
            className="px-3.5 py-1.5 rounded-xl bg-accent text-white font-bold text-xs hover:bg-black transition-all shadow-xs flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Bulk Assign Section</span>
          </button>

          <button
            onClick={() => setBulkModal({ open: true, action: 'remove', section: '' })}
            className="px-3.5 py-1.5 rounded-xl bg-rose-600/30 text-rose-200 border border-rose-400/40 font-bold text-xs hover:bg-rose-600 hover:text-black transition-all shadow-xs"
          >
            <span>Remove Section</span>
          </button>

          <button
            onClick={() => setSelectedEmpIds([])}
            className="p-1 rounded-lg text-black hover:text-black"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bulk Action Modal */}
      {bulkModal.open && (
        <div className="fixed inset-0 z-50 bg-primary/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl border border-accent-soft shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-accent-soft pb-3">
              <div>
                <h3 className="font-extrabold text-primary text-base">Bulk Section Allocation</h3>
                <p className="text-xs text-primary font-medium">
                  Updating section for {selectedEmpIds.length} selected employees
                </p>
              </div>
              <button 
                onClick={() => setBulkModal(prev => ({ ...prev, open: false }))}
                className="w-8 h-8 rounded-full bg-primary/10 hover:bg-primary hover:text-white text-primary flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-semibold text-primary">
              {bulkModal.action !== 'remove' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-black uppercase mb-1">Select Available Section</label>
                    <select
                      value={bulkModal.section}
                      onChange={(e) => setBulkModal(prev => ({ ...prev, section: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-white font-bold text-xs shadow-xs"
                    >
                      <option value="">-- Choose Section Option --</option>
                      {sectionFilterOptions.map(sec => (
                        <option key={sec} value={sec}>{sec}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-black uppercase mb-1">Or Type Custom Section Name</label>
                    <input
                      type="text"
                      value={bulkModal.section}
                      onChange={(e) => setBulkModal(prev => ({ ...prev, section: e.target.value }))}
                      placeholder="Enter custom section name (e.g. Ethnic Wear, Cotton...)"
                      className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-white font-bold text-xs shadow-xs"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                  ⚠️ This will remove the allocated section for all {selectedEmpIds.length} selected employees.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-accent-soft">
              <button
                onClick={() => setBulkModal(prev => ({ ...prev, open: false }))}
                className="px-4 py-2 rounded-xl border border-accent-soft bg-white text-primary font-bold text-xs hover:bg-background"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteBulkAction}
                className="btn-primary text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Confirm Bulk Allocation</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Universal 360 Employee Profile Overview Modal */}
      {overviewModal.open && (
        <EmployeeProfileModal
          employee={overviewModal.emp}
          onClose={() => setOverviewModal({ open: false, emp: null })}
          onUpdated={loadData}
        />
      )}

      {/* Manage Sections Modal */}
      <ManageSectionsModal
        isOpen={manageSectionsOpen}
        onClose={() => setManageSectionsOpen(false)}
        onSectionsUpdated={loadData}
      />
    </div>
  );
}
