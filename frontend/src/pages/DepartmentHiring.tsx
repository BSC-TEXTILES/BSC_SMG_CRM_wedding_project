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
import { BSC_DEPARTMENT_SECTIONS, BSC_DEPARTMENTS } from '../utils/bscDepartments';
import { 
  Building2, 
  Search, 
  Filter, 
  Edit3, 
  Save, 
  X, 
  BarChart3, 
  PieChart as PieIcon, 
  TrendingUp, 
  Users, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  Layers,
  Sparkles,
  ArrowRight,
  Maximize2,
  Minimize2,
  UserCheck,
  CheckCircle,
  Briefcase
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  Cell
} from 'recharts';

interface SectionHiringData {
  department: string;
  section: string;
  designation: string;
  required: number;
  filled: number;
  remaining: number;
  percentage: number;
  status: 'Completed' | 'In Progress' | 'Almost Full' | 'Vacant';
  remarks: string;
}

interface DeptHierarchyNode {
  department: string;
  required: number;
  filled: number;
  remaining: number;
  percentage: number;
  status: 'Completed' | 'In Progress' | 'Almost Full' | 'Vacant';
  sections: SectionHiringData[];
}

export default function DepartmentHiringPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(getSidebarCollapsed());

  useEffect(() => {
    return subscribeSidebarCollapsed(setCollapsed);
  }, []);

  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState<Record<string, { required: number; target: number; remarks: string }>>({});
  const [employees, setEmployees] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [dbSections, setDbSections] = useState<any[]>([]);
  const [designationsMaster, setDesignationsMaster] = useState<string[]>([]);
  const [manageSectionsOpen, setManageSectionsOpen] = useState(false);

  // Expanded department tree node states
  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>({});

  // Filter States
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedSection, setSelectedSection] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Edit Modal State (Updates Required Sales Executives for a Section)
  const [editModal, setEditModal] = useState<{
    open: boolean;
    rowKey: string;
    department: string;
    section: string;
    required: number;
    remarks: string;
  }>({
    open: false,
    rowKey: '',
    department: '',
    section: '',
    required: 10,
    remarks: ''
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [tRes, eRes, cRes, sRes, dRes] = await Promise.all([
        API.getHiringTargets(),
        API.getEmployees(),
        API.getCandidates(),
        API.getDepartmentSections(),
        API.getDesignations()
      ]);

      // Load hiring targets
      if (tRes && tRes.targets) {
        const targetMap: Record<string, { required: number; target: number; remarks: string }> = {};
        tRes.targets.forEach((t: any) => {
          const key = `${t.department}||${t.section}||Sales Executive`;
          targetMap[key] = {
            required: t.required_openings || t.hiring_target || 10,
            target: t.hiring_target || 10,
            remarks: t.remarks || ''
          };
        });
        setTargets(targetMap);
      }

      // Employees list
      if (Array.isArray(eRes)) setEmployees(eRes);
      else if (eRes && eRes.employees) setEmployees(eRes.employees);

      // Joined Candidates list
      if (Array.isArray(cRes)) setCandidates(cRes);
      else if (cRes && cRes.candidates) setCandidates(cRes.candidates);

      // Sections from Database
      if (sRes && sRes.sections) setDbSections(sRes.sections);

      // Designations master (from Manpower Planning / Settings)
      if (Array.isArray(dRes)) {
        setDesignationsMaster(dRes.map((d: any) => typeof d === 'string' ? d : d.name));
      } else if (dRes && dRes.designations) {
        setDesignationsMaster(dRes.designations.map((d: any) => typeof d === 'string' ? d : d.name));
      }
    } catch (err: any) {
      console.warn('Load Department Hiring data warning:', err.message);
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

  // Expand all departments by default when data loads
  useEffect(() => {
    const initialExpanded: Record<string, boolean> = {};
    BSC_DEPARTMENTS.forEach(dept => { initialExpanded[dept] = true; });
    setExpandedDepts(initialExpanded);
  }, []);

  // Department Section Mapping (Derived 100% dynamically from database records)
  const activeDeptSectionsMap = useMemo(() => {
    const map: Record<string, string[]> = {};

    if (dbSections && dbSections.length > 0) {
      dbSections.forEach(s => {
        if (s.department && s.section_name && s.active !== false) {
          if (!map[s.department]) map[s.department] = [];
          if (!map[s.department].includes(s.section_name)) {
            map[s.department].push(s.section_name);
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

  // Calculate Filled Sales Executives count per Department & Section
  const filledSalesExecCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    const processedEmpIds = new Set<string>();

    employees.forEach(emp => {
      const empId = String(emp.id || emp.appNo || emp.employeeCode || emp.app_no || '');
      if (empId && processedEmpIds.has(empId)) return;
      if (empId) processedEmpIds.add(empId);

      const desig = (emp.desig || emp.designation || '').toLowerCase().trim();
      if (!desig) return;

      // Strictly check for Sales Executive roles
      const isSalesExec = desig.includes('sales executive') || 
                          desig.includes('sales staff') || 
                          desig.includes('sales exec') || 
                          desig === 'sales executive' || 
                          desig === 'sales';
      if (!isSalesExec) return;

      const dept = emp.department || emp.dept;
      const sec = emp.section;

      if (dept && sec) {
        const key = `${dept}||${sec}`;
        map[key] = (map[key] || 0) + 1;
      }
    });

    return map;
  }, [employees]);

  // Build Department Hierarchy Nodes (Tree Data)
  const treeHierarchy = useMemo(() => {
    const list: DeptHierarchyNode[] = [];

    Object.keys(activeDeptSectionsMap).forEach(dept => {
      const sectionsList = activeDeptSectionsMap[dept] || ['General'];

      let deptReq = 0;
      let deptFilled = 0;

      const sectionNodes: SectionHiringData[] = sectionsList.map(sec => {
        const rowKey = `${dept}||${sec}||Sales Executive`;
        const target = targets[rowKey];

        const filled = filledSalesExecCountMap[`${dept}||${sec}`] || 0;
        const required = target ? target.required : (filled > 0 ? filled : 0);
        const remaining = Math.max(0, required - filled);
        const percentage = required > 0 ? Math.round((filled / required) * 100) : (filled > 0 ? 100 : 100);

        let status: 'Completed' | 'In Progress' | 'Almost Full' | 'Vacant' = 'In Progress';
        if (required === 0 && filled === 0) status = 'Completed';
        else if (percentage >= 100) status = 'Completed';
        else if (percentage >= 75) status = 'Almost Full';
        else if (percentage > 0) status = 'In Progress';
        else status = 'Vacant';

        deptReq += required;
        deptFilled += filled;

        return {
          department: dept,
          section: sec,
          designation: 'Sales Executive',
          required,
          filled,
          remaining,
          percentage,
          status,
          remarks: target?.remarks || ''
        };
      });

      const deptRemaining = Math.max(0, deptReq - deptFilled);
      const deptPct = deptReq > 0 ? Math.round((deptFilled / deptReq) * 100) : (deptFilled > 0 ? 100 : 100);

      let deptStatus: 'Completed' | 'In Progress' | 'Almost Full' | 'Vacant' = 'In Progress';
      if (deptPct >= 100) deptStatus = 'Completed';
      else if (deptPct >= 75) deptStatus = 'Almost Full';
      else if (deptPct > 0) deptStatus = 'In Progress';
      else deptStatus = 'Vacant';

      list.push({
        department: dept,
        required: deptReq,
        filled: deptFilled,
        remaining: deptRemaining,
        percentage: deptPct,
        status: deptStatus,
        sections: sectionNodes
      });
    });

    return list;
  }, [activeDeptSectionsMap, targets, filledSalesExecCountMap]);

  // Section options for filter dropdown
  const sectionFilterOptions = useMemo(() => {
    if (selectedDept === 'All') {
      const set = new Set<string>();
      Object.values(activeDeptSectionsMap).forEach(list => list.forEach(s => set.add(s)));
      return Array.from(set);
    }
    return activeDeptSectionsMap[selectedDept] || [];
  }, [selectedDept, activeDeptSectionsMap]);

  // Filtered Tree Nodes based on User Selection
  const filteredTreeHierarchy = useMemo(() => {
    return treeHierarchy.map(deptNode => {
      if (selectedDept !== 'All' && deptNode.department !== selectedDept) {
        return null;
      }

      // Filter sections inside department
      const matchingSections = deptNode.sections.filter(sec => {
        if (selectedSection !== 'All' && sec.section !== selectedSection) return false;
        if (selectedStatus !== 'All' && sec.status !== selectedStatus) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const match = sec.department.toLowerCase().includes(q) ||
                        sec.section.toLowerCase().includes(q) ||
                        sec.remarks.toLowerCase().includes(q);
          if (!match) return false;
        }

        return true;
      });

      if (matchingSections.length === 0 && selectedSection !== 'All') {
        return null;
      }

      // Recalculate summary metrics for matching view
      const reqSum = matchingSections.reduce((sum, s) => sum + s.required, 0);
      const fillSum = matchingSections.reduce((sum, s) => sum + s.filled, 0);
      const remSum = matchingSections.reduce((sum, s) => sum + s.remaining, 0);
      const pct = reqSum > 0 ? Math.round((fillSum / reqSum) * 100) : 0;

      let st: 'Completed' | 'In Progress' | 'Almost Full' | 'Vacant' = 'In Progress';
      if (pct >= 100) st = 'Completed';
      else if (pct >= 75) st = 'Almost Full';
      else if (pct > 0) st = 'In Progress';
      else st = 'Vacant';

      return {
        ...deptNode,
        required: reqSum,
        filled: fillSum,
        remaining: remSum,
        percentage: pct,
        status: st,
        sections: matchingSections
      };
    }).filter(Boolean) as DeptHierarchyNode[];
  }, [treeHierarchy, selectedDept, selectedSection, selectedStatus, searchQuery]);

  // Overall Dashboard Metrics
  const summary = useMemo(() => {
    let totalDepts = filteredTreeHierarchy.length;
    let totalSections = 0;
    let totalReq = 0;
    let totalFilled = 0;

    filteredTreeHierarchy.forEach(d => {
      totalSections += d.sections.length;
      totalReq += d.required;
      totalFilled += d.filled;
    });

    const totalRemaining = Math.max(0, totalReq - totalFilled);
    const overallPct = totalReq > 0 ? Math.round((totalFilled / totalReq) * 100) : 0;

    return {
      totalDepts,
      totalSections,
      totalReq,
      totalFilled,
      totalRemaining,
      overallPct
    };
  }, [filteredTreeHierarchy]);

  // Department Hiring Progress Bar Chart Data
  const deptChartData = useMemo(() => {
    return filteredTreeHierarchy.map(d => ({
      department: d.department,
      required: d.required,
      filled: d.filled,
      remaining: d.remaining,
      percentage: d.percentage
    }));
  }, [filteredTreeHierarchy]);

  // Top Performing & Needing Recruitment Departments
  const topPerformingDepts = useMemo(() => {
    return [...filteredTreeHierarchy]
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 4);
  }, [filteredTreeHierarchy]);

  const needingRecruitmentDepts = useMemo(() => {
    return [...filteredTreeHierarchy]
      .sort((a, b) => b.remaining - a.remaining)
      .slice(0, 4);
  }, [filteredTreeHierarchy]);

  // Save Edit for Required Sales Executives
  const handleSaveEdit = async () => {
    try {
      const res = await API.saveHiringTarget({
        department: editModal.department,
        section: editModal.section,
        designation: 'Sales Executive',
        requiredOpenings: editModal.required,
        hiringTarget: editModal.required,
        remarks: editModal.remarks
      });

      if (res && res.success !== false) {
        showToast(`Required Sales Executives target updated for ${editModal.section}`, 'success');
        setTargets(prev => ({
          ...prev,
          [`${editModal.department}||${editModal.section}||Sales Executive`]: {
            required: editModal.required,
            target: editModal.required,
            remarks: editModal.remarks
          }
        }));
        setEditModal(prev => ({ ...prev, open: false }));
      } else {
        showToast(res.error || 'Failed to save target', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Save error', 'error');
    }
  };

  const toggleExpandDept = (dept: string) => {
    setExpandedDepts(prev => ({ ...prev, [dept]: prev[dept] === false ? true : false }));
  };

  const expandAllTree = () => {
    const allExp: Record<string, boolean> = {};
    Object.keys(activeDeptSectionsMap).forEach(d => { allExp[d] = true; });
    setExpandedDepts(allExp);
  };

  const collapseAllTree = () => {
    const allColl: Record<string, boolean> = {};
    Object.keys(activeDeptSectionsMap).forEach(d => { allColl[d] = false; });
    setExpandedDepts(allColl);
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
          title="Department Hiring Status" 
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="p-4 lg:p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Header Banner */}
          <div className="card-glass p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-primary tracking-tight flex items-center gap-2">
                <Building2 className="w-5 h-5 text-accent" />
                <span>BSC Textiles - Sales Executive Workforce Dashboard</span>
              </h2>
              <p className="text-xs text-primary font-medium mt-0.5">
                Tree-based department &amp; section-wise Required, Filled and Remaining Sales Executives status.
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
                onClick={() => navigate('/openings')}
                className="btn-secondary text-xs flex items-center gap-1.5 shadow-xs"
              >
                <span>Manpower Planning</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Top 6 Summary Dashboard Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
            <MetricCard
              title="Departments"
              value={summary.totalDepts}
              subtext="BSC Textiles floors"
              icon={Building2}
              color="gold"
            />
            <MetricCard
              title="Sections"
              value={summary.totalSections}
              subtext="Showroom sections"
              icon={Layers}
              color="indigo"
            />
            <MetricCard
              title="Required Sales Execs"
              value={summary.totalReq}
              subtext="Total workforce target"
              icon={Briefcase}
              color="navy"
            />
            <MetricCard
              title="Filled Sales Execs"
              value={summary.totalFilled}
              subtext="Currently onboarded"
              icon={UserCheck}
              color="emerald"
            />
            <MetricCard
              title="Total Remaining"
              value={summary.totalRemaining}
              subtext="Pending recruitment"
              icon={Clock}
              color="rose"
            />
            <MetricCard
              title="Overall Hiring %"
              value={`${summary.overallPct}%`}
              subtext="Showroom fill rate"
              icon={TrendingUp}
              color="emerald"
            />
          </div>

          {/* Filter Bar & Quick Controls */}
          <div className="card-glass p-4 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-accent-soft pb-2.5">
              <div className="text-xs font-black text-primary uppercase tracking-wider flex items-center gap-2">
                <Filter className="w-4 h-4 text-accent" />
                <span>Filter Department &amp; Section Hierarchy</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={expandAllTree}
                  className="px-2.5 py-1 rounded-xl bg-white border border-accent-soft text-primary hover:bg-background text-xs font-extrabold flex items-center gap-1 shadow-xs"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>Expand All</span>
                </button>
                <button
                  onClick={collapseAllTree}
                  className="px-2.5 py-1 rounded-xl bg-white border border-accent-soft text-primary hover:bg-background text-xs font-extrabold flex items-center gap-1 shadow-xs"
                >
                  <Minimize2 className="w-3 h-3" />
                  <span>Collapse All</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Department Filter */}
              <div>
                <label className="text-[10.5px] font-extrabold text-[#5D4E42] uppercase block mb-1">Department</label>
                <select
                  value={selectedDept}
                  onChange={(e) => { setSelectedDept(e.target.value); setSelectedSection('All'); }}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-accent-soft bg-background text-xs font-bold text-primary focus:outline-none focus:border-primary"
                >
                  <option value="All">All Departments</option>
                  {activeDepartmentsList.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Section Filter */}
              <div>
                <label className="text-[10.5px] font-extrabold text-[#5D4E42] uppercase block mb-1">Section</label>
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-accent-soft bg-background text-xs font-bold text-primary focus:outline-none focus:border-primary"
                >
                  <option value="All">All Sections</option>
                  {sectionFilterOptions.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="text-[10.5px] font-extrabold text-[#5D4E42] uppercase block mb-1">Hiring Status</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-accent-soft bg-background text-xs font-bold text-primary focus:outline-none focus:border-primary"
                >
                  <option value="All">All Statuses</option>
                  <option value="Completed">Completed (Green 100%)</option>
                  <option value="In Progress">In Progress (Blue 1-74%)</option>
                  <option value="Almost Full">Almost Full (Orange 75-99%)</option>
                  <option value="Vacant">Vacant (Red 0%)</option>
                </select>
              </div>

              {/* Search */}
              <div>
                <label className="text-[10.5px] font-extrabold text-[#5D4E42] uppercase block mb-1">Search</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-primary" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search dept or section..."
                    className="w-full pl-8 pr-2.5 py-1.5 rounded-xl border border-accent-soft bg-background text-xs font-bold text-primary focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* TREE-BASED ENTERPRISE HIERARCHY LAYOUT */}
          <div className="card-glass p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-accent-soft pb-3">
              <div>
                <h3 className="font-extrabold text-primary text-base tracking-tight flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-accent" />
                  <span>Showroom Department &amp; Section Workforce Tree</span>
                </h3>
                <p className="text-xs text-primary font-medium mt-0.5">
                  Designation Target: <span className="font-bold text-primary bg-accent/20 px-2 py-0.5 rounded-md">Sales Executive</span>
                </p>
              </div>
            </div>

            {/* Tree Container */}
            <div className="space-y-3">
              {filteredTreeHierarchy.length > 0 ? (
                filteredTreeHierarchy.map((deptNode) => {
                  const isExpanded = expandedDepts[deptNode.department] !== false;

                  let deptBadgeColor = 'blue';
                  if (deptNode.status === 'Completed') deptBadgeColor = 'green';
                  else if (deptNode.status === 'Almost Full') deptBadgeColor = 'gold';
                  else if (deptNode.status === 'Vacant') deptBadgeColor = 'red';

                  return (
                    <div 
                      key={deptNode.department} 
                      className="border border-accent-soft rounded-2xl bg-white/80 overflow-hidden shadow-xs transition-all"
                    >
                      {/* Department Root Row */}
                      <div 
                        onClick={() => toggleExpandDept(deptNode.department)}
                        className="p-4 bg-background hover:bg-background/60 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-accent-soft/80"
                      >
                        <div className="flex items-center gap-3">
                          <button className="p-1 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                          <Building2 className="w-5 h-5 text-primary" />
                          <div>
                            <h4 className="font-black text-primary text-base tracking-tight">
                              {deptNode.department}
                            </h4>
                            <p className="text-[11px] text-primary font-medium">
                              {deptNode.sections.length} Showroom Sections
                            </p>
                          </div>
                        </div>

                        {/* Department Summary Metrics & Progress */}
                        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                          <div className="text-right text-xs">
                            <span className="text-[10px] text-primary font-extrabold uppercase block">Required</span>
                            <span className="font-extrabold text-primary text-sm">{deptNode.required}</span>
                          </div>

                          <div className="text-right text-xs">
                            <span className="text-[10px] text-emerald-700 font-extrabold uppercase block">Filled</span>
                            <span className="font-extrabold text-emerald-700 text-sm">{deptNode.filled}</span>
                          </div>

                          <div className="text-right text-xs">
                            <span className="text-[10px] text-rose-700 font-extrabold uppercase block">Remaining</span>
                            <span className="font-extrabold text-rose-700 text-sm">{deptNode.remaining}</span>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-36 sm:w-44 space-y-1">
                            <div className="flex items-center justify-between text-[11px] font-extrabold text-primary">
                              <span>{deptNode.filled} / {deptNode.required}</span>
                              <span>{deptNode.percentage}%</span>
                            </div>
                            <div className="w-full h-2.5 bg-accent-soft rounded-full overflow-hidden shadow-inner">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                  deptNode.percentage >= 100 ? 'bg-emerald-600' :
                                  deptNode.percentage >= 75 ? 'bg-accent' :
                                  deptNode.percentage > 0 ? 'bg-sky-600' : 'bg-rose-500'
                                }`}
                                style={{ width: `${Math.min(deptNode.percentage, 100)}%` }}
                              />
                            </div>
                          </div>

                          <StatusBadge status={deptNode.status} color={deptBadgeColor} size="sm" />
                        </div>
                      </div>

                      {/* Expanded Children: Sections Tree Branches */}
                      {isExpanded && (
                        <div className="divide-y divide-accent-soft/50 bg-white">
                          {deptNode.sections.map((secNode) => {
                            let secBadgeColor = 'blue';
                            if (secNode.status === 'Completed') secBadgeColor = 'green';
                            else if (secNode.status === 'Almost Full') secBadgeColor = 'gold';
                            else if (secNode.status === 'Vacant') secBadgeColor = 'red';

                            return (
                              <div 
                                key={secNode.section}
                                className="p-3.5 pl-6 sm:pl-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-background/80 transition-colors font-medium border-l-4 border-l-accent/40 ml-3 sm:ml-6 my-1"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-accent font-mono font-bold text-sm">├──</span>
                                  <Layers className="w-4 h-4 text-accent" />
                                  <div>
                                    <span className="font-extrabold text-primary text-xs sm:text-sm">
                                      {secNode.section}
                                    </span>
                                    <span className="text-[10px] text-primary block font-medium">
                                      Sales Executive Target
                                    </span>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                                  <div className="text-right text-xs">
                                    <span className="text-[9.5px] text-primary font-bold block">Required</span>
                                    <span className="font-extrabold text-primary">{secNode.required}</span>
                                  </div>

                                  <div className="text-right text-xs">
                                    <span className="text-[9.5px] text-emerald-700 font-bold block">Filled</span>
                                    <span className="font-extrabold text-emerald-700">{secNode.filled}</span>
                                  </div>

                                  <div className="text-right text-xs">
                                    <span className="text-[9.5px] text-rose-700 font-bold block">Remaining</span>
                                    <span className="font-extrabold text-rose-700">{secNode.remaining}</span>
                                  </div>

                                  {/* Section Progress Bar */}
                                  <div className="w-32 sm:w-36 space-y-1">
                                    <div className="flex items-center justify-between text-[10.5px] font-bold text-primary">
                                      <span>{secNode.filled} / {secNode.required}</span>
                                      <span>{secNode.percentage}%</span>
                                    </div>
                                    <div className="w-full h-2 bg-accent-soft rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full rounded-full transition-all duration-500 ${
                                          secNode.percentage >= 100 ? 'bg-emerald-600' :
                                          secNode.percentage >= 75 ? 'bg-accent' :
                                          secNode.percentage > 0 ? 'bg-sky-600' : 'bg-rose-500'
                                        }`}
                                        style={{ width: `${Math.min(secNode.percentage, 100)}%` }}
                                      />
                                    </div>
                                  </div>

                                  <StatusBadge status={secNode.status} color={secBadgeColor} size="sm" />

                                  {isHR && (
                                    <button
                                      onClick={() => setEditModal({
                                        open: true,
                                        rowKey: `${secNode.department}||${secNode.section}||Sales Executive`,
                                        department: secNode.department,
                                        section: secNode.section,
                                        required: secNode.required,
                                        remarks: secNode.remarks
                                      })}
                                      className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white font-bold text-xs transition-colors flex items-center gap-1"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                      <span>Edit</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-xs text-primary font-semibold bg-white rounded-2xl border border-accent-soft">
                  No department hiring hierarchy data matches your filters.
                </div>
              )}
            </div>
          </div>

          {/* MANAGEMENT RECHARTS DASHBOARD */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Department Hiring Comparison Bar Chart */}
            <div className="card-glass p-5 space-y-4">
              <h3 className="font-extrabold text-primary text-sm tracking-tight flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-accent" />
                <span>Department-Wise Required vs Filled Sales Executives</span>
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-accent-soft)" />
                    <XAxis dataKey="department" tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--color-primary)' }} />
                    <YAxis tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--color-primary)' }} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--color-primary)', borderRadius: '12px', color: '#000', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                    <Bar dataKey="required" name="Required Target" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="filled" name="Filled Staff" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Performing vs Needing Recruitment Panels */}
            <div className="card-glass p-5 space-y-4 flex flex-col justify-between">
              <h3 className="font-extrabold text-primary text-sm tracking-tight flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-accent" />
                <span>Department Hiring Performance Overview</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Top Performing */}
                <div className="p-3.5 rounded-2xl bg-white border border-accent-soft space-y-2.5">
                  <h4 className="font-black text-xs text-emerald-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-emerald-100 pb-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Top Performing Departments</span>
                  </h4>
                  <div className="space-y-2 text-xs">
                    {topPerformingDepts.map(d => (
                      <div key={d.department} className="flex justify-between items-center font-semibold">
                        <span className="text-primary">{d.department}</span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-extrabold">
                          {d.percentage}% ({d.filled}/{d.required})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Needing Recruitment */}
                <div className="p-3.5 rounded-2xl bg-white border border-accent-soft space-y-2.5">
                  <h4 className="font-black text-xs text-rose-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-rose-100 pb-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Needing Recruitment</span>
                  </h4>
                  <div className="space-y-2 text-xs">
                    {needingRecruitmentDepts.map(d => (
                      <div key={d.department} className="flex justify-between items-center font-semibold">
                        <span className="text-primary">{d.department}</span>
                        <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-extrabold">
                          {d.remaining} Vacant
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Edit Required Openings Target Modal */}
      {editModal.open && (
        <div className="fixed inset-0 z-50 bg-primary/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl border border-accent-soft shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-accent-soft pb-3">
              <div>
                <h3 className="font-extrabold text-primary text-base">Edit Sales Executive Target</h3>
                <p className="text-xs text-primary font-medium">
                  {editModal.department} · {editModal.section}
                </p>
              </div>
              <button 
                onClick={() => setEditModal(prev => ({ ...prev, open: false }))}
                className="w-8 h-8 rounded-full bg-primary/10 hover:bg-primary hover:text-white text-primary flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-semibold text-primary">
              <div>
                <label className="block text-[11px] font-black uppercase mb-1">
                  Required Sales Executives Target
                </label>
                <input
                  type="number"
                  min={1}
                  value={editModal.required}
                  onChange={(e) => setEditModal(prev => ({ ...prev, required: parseInt(e.target.value, 10) || 1 }))}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-white font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase mb-1">Target Remarks</label>
                <textarea
                  rows={3}
                  value={editModal.remarks}
                  onChange={(e) => setEditModal(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Enter notes or recruitment urgency..."
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-white font-medium text-xs focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-accent-soft">
              <button
                onClick={() => setEditModal(prev => ({ ...prev, open: false }))}
                className="px-4 py-2 rounded-xl border border-accent-soft bg-white text-primary font-bold text-xs hover:bg-background"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="btn-primary text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Openings Target</span>
              </button>
            </div>
          </div>
        </div>
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
