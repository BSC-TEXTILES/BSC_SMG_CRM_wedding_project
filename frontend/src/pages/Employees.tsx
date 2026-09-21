import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import { getSidebarCollapsed, subscribeSidebarCollapsed } from '../utils/sidebarState';
import MetricCard from '../components/ui/MetricCard';
import StatusBadge from '../components/ui/StatusBadge';
import {
  Users, Search, Filter, Phone, Mail, Calendar, MapPin, Briefcase,
  FileText, CheckCircle, Trash2, Edit3, X, ExternalLink, UserCheck, DollarSign, Image as ImageIcon, FileCheck, Upload, Download, TrendingUp, Building2, User
} from 'lucide-react';
import * as XLSX from 'xlsx';

import { isDateInRange, getBusinessDate } from '../utils/dateUtils';
import { BSC_DEPARTMENTS, getUniqueDepartments } from '../utils/bscDepartments';
import { formatName } from '../utils/formatName';
import EmployeeProfileModal from '../components/ui/EmployeeProfileModal';

export default function EmployeesPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(getSidebarCollapsed());

  useEffect(() => {
    return subscribeSidebarCollapsed(setCollapsed);
  }, []);

  const [employees, setEmployees] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [desigFilter, setDesigFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'newest' | 'salary'>('name');

  // Recruitment Analytics & Pipeline Date Range Filter State
  const [activeRange, setActiveRange] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'last_month' | 'custom'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Drawer Overview State
  const [drawerEmp, setDrawerEmp] = useState<any | null>(null);
  const [drawerTab, setDrawerTab] = useState<'overview' | 'personal' | 'professional' | 'documents'>('overview');

  // Comprehensive In-Page Edit Modal State
  const [editModal, setEditModal] = useState<{ open: boolean; emp: any | null }>({ open: false, emp: null });
  const [editTab, setEditTab] = useState<'basic' | 'workplace' | 'compensation' | 'experience' | 'personal'>('basic');
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    email: '',
    gender: 'MALE',
    dob: '',
    bloodGroup: '',
    aadhaarNumber: '',
    desig: '',
    department: '',
    section: '',
    branch: '',
    reportingManager: '',
    status: 'Joined',
    salary: '',
    incentive: '',
    offeredDoj: '',
    experience: '',
    retailExperience: '',
    qualification: '',
    previousCompany: '',
    previousDesignation: '',
    previousSalary: '',
    fatherDetails: '',
    motherDetails: '',
    religion: '',
    caste: '',
    languagesKnown: '',
    remarks: ''
  });
  const [saving, setSaving] = useState(false);

  const parseSalaryAndIncentive = (val: any) => {
    if (!val) return { base: 0, incentive: 0, total: 0, rawBase: '', rawIncentive: '' };
    const str = String(val).trim();
    if (str.includes('|')) {
      const parts = str.split('|');
      const base = parseFloat(parts[0]) || 0;
      const inc = parseFloat(parts[1]) || 0;
      return { base, incentive: inc, total: base + inc, rawBase: parts[0] || '', rawIncentive: parts[1] || '' };
    }
    if (str.includes('+')) {
      const parts = str.split('+');
      const base = parseFloat(parts[0].replace(/[^0-9.]/g, '')) || 0;
      const inc = parseFloat(parts[1].replace(/[^0-9.]/g, '')) || 0;
      return { base, incentive: inc, total: base + inc, rawBase: String(base), rawIncentive: String(inc) };
    }
    const base = parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
    return { base, incentive: 0, total: base, rawBase: str, rawIncentive: '' };
  };

  const loadEmployees = useCallback(async () => {
    try {
      const [empData, secData] = await Promise.all([
        API.getEmployees(),
        API.getSectionAllocations().catch(() => ({ allocations: [] }))
      ]);

      if (empData && empData.employees) {
        const allocMap: Record<string, string> = {};
        if (secData && secData.allocations) {
          secData.allocations.forEach((alloc: any) => {
            if (alloc.employee_id) allocMap[alloc.employee_id] = alloc.section;
            if (alloc.app_no) allocMap[alloc.app_no] = alloc.section;
          });
        }

        const rawList = Array.isArray(empData) 
          ? empData 
          : (Array.isArray(empData?.employees) 
              ? empData.employees 
              : (Array.isArray(empData?.data) ? empData.data : []));

        const merged = rawList.map((e: any) => {
          const key = e.appNo || e.empNo;
          const assignedSec = e.section || (key && allocMap[key]) || '';
          return {
            ...e,
            section: assignedSec
          };
        });
        setEmployees(merged);
      }
    } catch (err: any) {
      showToast('Could not load employees: ' + err.message, 'error');
    }
  }, []);

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    const sess = Auth.get();
    setSession(sess);
    loadEmployees();
  }, [navigate, loadEmployees]);

  // Unique lists for filtering
  const isAdmin = session?.role === 'Admin' || session?.role === 'Super Admin';
  const uniqueDesigs = Array.from(new Set(employees.map(e => e.desig).filter(Boolean)));

  const uniqueSections = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      if (e.section) set.add(e.section);
    });
    Object.values(BSC_DEPARTMENTS).forEach(deptObj => {
      if (deptObj && Array.isArray((deptObj as any).sections)) {
        (deptObj as any).sections.forEach((s: string) => set.add(s));
      }
    });
    return Array.from(set).sort();
  }, [employees]);

  const uniqueDepts = useMemo(() => {
    return getUniqueDepartments(employees.map(e => e.department));
  }, [employees]);

  // Filtering & Alphabetical Sorting (A-Z)
  useEffect(() => {
    let list = [...employees];

    if (activeRange && activeRange !== 'all') {
      list = list.filter(e => isDateInRange(getBusinessDate(e, 'EMPLOYEES'), activeRange, fromDate, toDate));
    }

    if (deptFilter) {
      list = list.filter(e => (e.department || '').toLowerCase().trim() === deptFilter.toLowerCase().trim());
    }

    if (sectionFilter) {
      list = list.filter(e => {
        const sec = (e.section || '').toLowerCase().trim();
        const f = sectionFilter.toLowerCase().trim();
        return sec === f || sec.includes(f);
      });
    }

    if (desigFilter) {
      list = list.filter(e => e.desig === desigFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e =>
        (e.name || '').toLowerCase().includes(q) ||
        (e.appNo || '').toLowerCase().includes(q) ||
        (e.phone || '').toLowerCase().includes(q) ||
        (e.section || '').toLowerCase().includes(q)
      );
    }

    // Dynamic Sorting
    if (sortBy === 'name') {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sortBy === 'newest') {
      list.sort((a, b) => {
        const dateA = a.actualDoj || a.offeredDoj || a.date ? new Date(a.actualDoj || a.offeredDoj || a.date).getTime() : 0;
        const dateB = b.actualDoj || b.offeredDoj || b.date ? new Date(b.actualDoj || b.offeredDoj || b.date).getTime() : 0;
        if (dateA !== dateB) return dateB - dateA;
        return String(b.appNo || '').localeCompare(String(a.appNo || ''));
      });
    } else if (sortBy === 'salary') {
      list.sort((a, b) => parseSalaryAndIncentive(b.salary).total - parseSalaryAndIncentive(a.salary).total);
    }

    setFiltered(list);
  }, [employees, deptFilter, sectionFilter, desigFilter, searchQuery, sortBy, activeRange, fromDate, toDate]);

  const fileUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    let clean = url.trim();
    if (!clean) return null;
    if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;

    if (clean.startsWith('uploads/')) {
      clean = `/${clean}`;
    }

    const filename = clean.split('/').pop() || clean;

    if (filename.startsWith('photo') && !clean.includes('applicants')) return `/uploads/candidate-photos/${filename}`;
    if (filename.startsWith('resume') && !clean.includes('applicants')) return `/uploads/candidate-resumes/${filename}`;
    if ((filename.startsWith('aadhar') || filename.startsWith('aadhaar') || filename.startsWith('pan') || filename.startsWith('document')) && !clean.includes('applicants')) return `/uploads/employee-documents/${filename}`;

    if (clean.startsWith('/uploads/')) return clean;
    return `/uploads/misc/${filename}`;
  };

  const handleOpenEdit = (emp: any) => {
    setEditModal({ open: true, emp });
    setEditTab('basic');
    const parsedSal = parseSalaryAndIncentive(emp.salary);
    
    let langsStr = '';
    if (Array.isArray(emp.languagesKnown)) {
      langsStr = emp.languagesKnown.join(', ');
    } else if (typeof emp.languagesKnown === 'string') {
      langsStr = emp.languagesKnown;
    }

    setEditForm({
      name: emp.name || emp.fullName || '',
      phone: emp.phone || '',
      email: emp.email || '',
      gender: emp.gender || 'MALE',
      dob: emp.dob ? emp.dob.split('T')[0] : '',
      bloodGroup: emp.bloodGroup || emp.blood_group || '',
      aadhaarNumber: emp.aadhaarNumber || emp.aadhaar_number || '',
      desig: emp.desig || emp.designation || '',
      department: emp.department || '',
      section: emp.section || '',
      branch: emp.branch || 'BSC EXCLUSIVE DAVANAGERE',
      reportingManager: emp.reportingManager || emp.reporting_manager || '',
      status: emp.status || 'Joined',
      salary: parsedSal.rawBase || (parsedSal.base ? String(parsedSal.base) : ''),
      incentive: parsedSal.rawIncentive || (parsedSal.incentive ? String(parsedSal.incentive) : ''),
      offeredDoj: emp.offeredDoj || emp.estDoj || emp.actualDoj || '',
      experience: emp.experience || '',
      retailExperience: emp.retailExperience || emp.retail_experience || '',
      qualification: emp.qualification || '',
      previousCompany: emp.previousCompany || emp.previous_company || '',
      previousDesignation: emp.previousDesignation || emp.previous_designation || '',
      previousSalary: emp.previousSalary || emp.previous_salary || '',
      fatherDetails: emp.fatherDetails || emp.father_details || '',
      motherDetails: emp.motherDetails || emp.mother_details || '',
      religion: emp.religion || '',
      caste: emp.caste || emp.religionCaste || emp.religion_caste || '',
      languagesKnown: langsStr,
      remarks: emp.remarks || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editModal.emp) return;
    if (!editForm.name.trim() || !editForm.phone.trim()) {
      showToast('Employee Name and Phone Number are required', 'error');
      return;
    }

    setSaving(true);
    try {
      const combinedSalary = editForm.incentive && editForm.incentive.trim()
        ? `${editForm.salary.trim()}|${editForm.incentive.trim()}`
        : editForm.salary.trim();

      const langsArray = editForm.languagesKnown.split(',').map(s => s.trim()).filter(Boolean);

      const updatedData = {
        isFullEdit: true,
        name: editForm.name.trim(),
        phone: editForm.phone.trim().length === 10 ? `+91${editForm.phone.trim()}` : editForm.phone.trim(),
        email: editForm.email.trim(),
        gender: editForm.gender,
        dob: editForm.dob,
        bloodGroup: editForm.bloodGroup,
        aadhaarNumber: editForm.aadhaarNumber,
        desig: editForm.desig,
        department: editForm.department,
        section: editForm.section,
        branch: editForm.branch,
        reportingManager: editForm.reportingManager,
        status: editForm.status,
        salary: combinedSalary,
        offeredDoj: editForm.offeredDoj,
        experience: editForm.experience,
        retailExperience: editForm.retailExperience,
        qualification: editForm.qualification,
        previousCompany: editForm.previousCompany,
        previousDesignation: editForm.previousDesignation,
        previousSalary: editForm.previousSalary,
        fatherDetails: editForm.fatherDetails,
        motherDetails: editForm.motherDetails,
        religion: editForm.religion,
        caste: editForm.caste,
        languagesKnown: langsArray,
        remarks: editForm.remarks
      };

      await API.updateCandidate(editModal.emp.appNo, updatedData);

      showToast('Complete employee information saved successfully!', 'success');
      setEditModal({ open: false, emp: null });
      
      // Update drawer payload if currently viewing the same employee
      if (drawerEmp && drawerEmp.appNo === editModal.emp.appNo) {
        setDrawerEmp({
          ...drawerEmp,
          ...updatedData
        });
      }
      
      loadEmployees();
    } catch (err: any) {
      showToast('Error saving employee details: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEmployee = async (appNo: string, empName: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete employee ${empName} (${appNo})?`)) return;
    try {
      await API.deleteCandidate(appNo);
      showToast('Employee record deleted', 'success');
      setDrawerEmp(null);
      loadEmployees();
    } catch (err: any) {
      showToast('Failed to delete employee: ' + err.message, 'error');
    }
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        if (data.length === 0) {
          showToast('No data found in excel sheet', 'error');
          setSaving(false);
          return;
        }

        const res = await fetch('/api/employees/bulk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.token}`,
            'x-auth-token': session?.token || ''
          },
          body: JSON.stringify({ employees: data })
        });
        
        const json = await res.json();
        if (json.success) {
          showToast(`Successfully imported ${json.addedCount} employees`, 'success');
          loadEmployees();
        } else {
          showToast(`Failed: ${json.error}`, 'error');
        }
      } catch (err: any) {
        showToast('Error reading Excel: ' + err.message, 'error');
      } finally {
        setSaving(false);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleDownloadSample = () => {
    const ws = XLSX.utils.json_to_sheet([{
      Name: 'Rahul Sharma',
      Phone: '9876543210',
      Email: 'rahul@bsctextiles.com',
      Gender: 'MALE',
      DOB: '1995-05-15',
      BloodGroup: 'O+',
      Religion: 'Hindu',
      Caste: 'General',
      Designation: 'Section Supervisor',
      Department: 'Mens',
      Section: 'Ethnic Wear',
      Salary: '25000',
      DOJ: '2023-01-15'
    }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employees");
    XLSX.writeFile(wb, "Sample_Employee_Import.xlsx");
  };

  return (
    <div className="min-h-screen bg-background flex">
      <ToastContainer />
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${collapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        <Topbar
          title="Employee Master Directory"
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="p-4 lg:p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Recruitment Analytics & Pipeline Banner */}
          <div className="card-glass p-5 space-y-4 border-2 border-primary/10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-accent-soft pb-3.5">
              <div>
                <h3 className="font-extrabold text-primary text-base tracking-tight flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-accent" />
                  <span>Workforce Overview &amp; Section Analytics</span>
                </h3>
                <p className="text-xs text-primary font-medium mt-0.5">
                  Real-time active employee records, department floor allocations &amp; section master lists.
                </p>
              </div>

              {/* Date Filter Quick Range Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
                {[
                  { key: 'all', label: 'All Time' },
                  { key: 'today', label: 'Today' },
                  { key: 'yesterday', label: 'Yesterday' },
                  { key: 'week', label: 'Week' },
                  { key: 'month', label: 'Month' },
                  { key: 'last_month', label: 'Last Month' }
                ].map(range => (
                  <button
                    key={range.key}
                    onClick={() => { setActiveRange(range.key as any); setFromDate(''); setToDate(''); }}
                    className={`px-3 py-1.5 rounded-xl transition-all ${
                      activeRange === range.key
                        ? 'bg-primary text-white font-extrabold shadow-xs'
                        : 'bg-background text-[#5D4E42] border border-accent-soft hover:bg-white'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Date Range Picker */}
            <div className="flex flex-wrap items-center gap-3 bg-background p-3 rounded-2xl border border-accent-soft text-xs font-bold text-primary">
              <span className="text-primary uppercase text-[10.5px] font-black">Custom Date Range:</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => { setFromDate(e.target.value); setActiveRange('custom'); }}
                  className="px-2.5 py-1.5 rounded-xl border border-accent-soft bg-white font-semibold outline-none text-xs"
                />
                <span className="text-primary font-extrabold">to</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => { setToDate(e.target.value); setActiveRange('custom'); }}
                  className="px-2.5 py-1.5 rounded-xl border border-accent-soft bg-white font-semibold outline-none text-xs"
                />
              </div>
              {(fromDate || toDate || activeRange !== 'all') && (
                <button
                  onClick={() => { setActiveRange('all'); setFromDate(''); setToDate(''); }}
                  className="text-rose-600 hover:underline text-[11px] font-extrabold ml-auto"
                >
                  Reset Date Filter
                </button>
              )}
            </div>
          </div>

          {/* Header */}
          <div className="card-glass p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-primary tracking-tight flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-accent" />
                <span>Onboarded Staff Directory</span>
              </h2>
              <p className="text-xs text-primary font-medium mt-0.5 font-sans">Active company workforce records, store section allocations &amp; employee profiles.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="flex gap-2">
                <button
                  onClick={handleDownloadSample}
                  className="px-3 py-1.5 rounded-xl border border-accent-soft bg-white text-xs font-bold text-primary hover:bg-background flex items-center gap-1.5 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" /> Sample
                </button>
                <label className="px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold cursor-pointer hover:bg-primary flex items-center gap-1.5 shadow-xs">
                  <Upload className="w-3.5 h-3.5" /> Import Excel
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportExcel} disabled={saving} />
                </label>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search employee, phone, section..."
                  className="pl-9 pr-3 py-1.5 rounded-xl border border-accent-soft bg-background text-xs font-semibold text-primary focus:outline-none focus:border-primary w-56 shadow-xs"
                />
              </div>

              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-accent-soft bg-background text-xs font-semibold text-primary"
              >
                <option value="">All Departments</option>
                {uniqueDepts.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              {/* Working Section Filter */}
              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-accent-soft bg-background text-xs font-bold text-primary"
              >
                <option value="">All Sections</option>
                {uniqueSections.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <select
                value={desigFilter}
                onChange={(e) => setDesigFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-accent-soft bg-background text-xs font-semibold text-primary"
              >
                <option value="">All Designations</option>
                {uniqueDesigs.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-1.5 rounded-xl border border-accent-soft bg-background text-xs font-bold text-primary"
              >
                <option value="name">Sort: Name (A-Z)</option>
                <option value="newest">Sort: Newest Joined</option>
                <option value="salary">Sort: Highest Package</option>
              </select>
            </div>
          </div>

          {/* Metric Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard
              title="Total Active Employees"
              value={employees.length}
              subtext="Fully onboarded staff"
              icon={UserCheck}
              color="teal"
            />
            <MetricCard
              title="Store Sections Allocated"
              value={uniqueSections.length}
              subtext="Active department floor sections"
              icon={Building2}
              color="gold"
            />
            <MetricCard
              title="Designations Covered"
              value={uniqueDesigs.length}
              subtext="Active company roles"
              icon={Briefcase}
              color="navy"
            />
          </div>

          {/* Main Employees Directory Table */}
          <div className="card-glass p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-accent-soft pb-3">
              <h3 className="font-extrabold text-primary text-sm tracking-tight">
                Staff Register ({filtered.length} Employees)
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-accent-soft text-[10.5px] font-black uppercase text-primary bg-background/60">
                    <th className="py-3 px-3 text-center">#</th>
                    <th className="py-3 px-4">Emp / App No</th>
                    <th className="py-3 px-4">Employee Name</th>
                    <th className="py-3 px-4">Designation</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Section</th>
                    <th className="py-3 px-4">Phone</th>
                    <th className="py-3 px-4">Joining Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-accent-soft/60">
                  {filtered.map((emp, idx) => (
                    <tr key={emp.appNo || idx} onClick={() => setDrawerEmp(emp)} className="hover:bg-black/5 cursor-pointer transition-colors font-medium">
                      <td className="py-3.5 px-3 text-center font-bold text-primary">{idx + 1}</td>
                      <td className="py-3.5 px-4 font-mono text-[#5D4E42] font-bold">{emp.appNo || emp.empNo}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3 group text-left">
                          <div className="w-8 h-8 rounded-full bg-primary text-white font-black text-xs flex items-center justify-center shadow-xs">
                            {emp.initials || emp.name?.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-extrabold text-primary group-hover:underline block">{formatName(emp.name)}</span>
                            {emp.email && <span className="text-[10px] text-[#6B5D50] font-semibold truncate max-w-[150px] block">{emp.email}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-primary font-extrabold">{emp.desig || emp.designation || 'Staff'}</td>
                      <td className="py-3.5 px-4 text-[#5D4E42] font-semibold">{emp.department || '—'}</td>
                      <td className="py-3.5 px-4 text-accent font-extrabold">{emp.section || 'Unassigned'}</td>
                      <td className="py-3.5 px-4 font-mono text-[#5D4E42]">{emp.phone}</td>
                      <td className="py-3.5 px-4 font-bold text-primary">
                        {emp.offeredDoj || emp.estDoj || emp.actualDoj || '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={emp.status || 'Joined'} size="sm" />
                      </td>
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {isAdmin && (
                          <button
                            onClick={() => handleOpenEdit(emp)}
                            className="p-1.5 rounded-lg border border-emerald-600 text-emerald-700 font-bold hover:bg-emerald-50 transition-colors shadow-xs"
                            title="Edit Complete Employee Information"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          )}
                          {isAdmin && (
                          <button
                            onClick={() => handleDeleteEmployee(emp.appNo, emp.name)}
                            className="p-1.5 rounded-lg border border-rose-200 text-rose-600 font-bold hover:bg-rose-50 transition-colors shadow-xs"
                            title="Delete Employee Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-xs text-[#6B5D50] font-semibold">
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

      {/* Comprehensive In-Page Complete Employee Edit Modal */}
      {editModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-primary/60 backdrop-blur-md transition-all animate-fade-in">
          <div className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-accent/40">
            {/* Modal Header */}
            <div className="bg-primary text-white p-4 sm:p-5 flex items-center justify-between border-b border-accent/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent text-white font-black text-lg flex items-center justify-center shadow-md">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-black text-base sm:text-lg">Edit Employee Details — {editModal.emp?.name}</h3>
                  <div className="text-xs text-accent font-mono mt-0.5 font-bold">
                    App/Emp ID: {editModal.emp?.appNo || editModal.emp?.empNo}
                  </div>
                </div>
              </div>

              <button onClick={() => setEditModal({ open: false, emp: null })} className="p-2 rounded-xl bg-black/10 text-black hover:bg-black/20 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs Navigation */}
            <div className="flex items-center gap-2 p-3 bg-background border-b border-accent-soft overflow-x-auto text-xs font-bold">
              {[
                { id: 'basic', label: '👤 Basic Info', icon: User },
                { id: 'workplace', label: '🏢 Workplace & Section', icon: Building2 },
                { id: 'compensation', label: '💰 Salary & Package', icon: DollarSign },
                { id: 'experience', label: '💼 Experience & Ed', icon: Briefcase },
                { id: 'personal', label: '📋 Personal & Family', icon: FileText }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setEditTab(tab.id as any)}
                  className={`px-3.5 py-2 rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 text-xs font-extrabold ${
                    editTab === tab.id
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-[#5D4E42] hover:bg-white hover:text-primary'
                  }`}
                >
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Modal Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs bg-background">
              {/* TAB 1: BASIC INFO */}
              {editTab === 'basic' && (
                <div className="space-y-4 bg-white p-5 rounded-2xl border border-accent-soft shadow-xs">
                  <div>
                    <label className="block font-bold text-primary mb-1">Full Employee Name *</label>
                    <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="input-modern font-extrabold text-primary" required />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-primary mb-1">Phone Number *</label>
                      <div className="flex">
                        <span className="p-2.5 bg-accent-soft/50 border border-r-0 border-accent-soft rounded-l-xl font-extrabold text-xs text-[#5D4E42] flex items-center">
                          +91
                        </span>
                        <input type="tel" maxLength={10} value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} className="input-modern font-mono rounded-l-none" required />
                      </div>
                    </div>
                    <div>
                      <label className="block font-bold text-primary mb-1">Email Address</label>
                      <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="input-modern" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-primary mb-1">Gender</label>
                      <select value={editForm.gender} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })} className="select-modern font-bold">
                        <option value="MALE">MALE</option>
                        <option value="FEMALE">FEMALE</option>
                        <option value="OTHER">OTHER</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-primary mb-1">Date of Birth (DOB)</label>
                      <input type="date" value={editForm.dob} onChange={(e) => setEditForm({ ...editForm, dob: e.target.value })} className="input-modern" />
                    </div>
                    <div>
                      <label className="block font-bold text-primary mb-1">Blood Group</label>
                      <input type="text" placeholder="e.g. O+, A+" value={editForm.bloodGroup} onChange={(e) => setEditForm({ ...editForm, bloodGroup: e.target.value })} className="input-modern" />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-primary mb-1">Aadhaar Card Number</label>
                    <input type="text" placeholder="12-digit Aadhaar number" value={editForm.aadhaarNumber} onChange={(e) => setEditForm({ ...editForm, aadhaarNumber: e.target.value })} className="input-modern font-mono" />
                  </div>
                </div>
              )}

              {/* TAB 2: WORKPLACE & SECTION */}
              {editTab === 'workplace' && (
                <div className="space-y-4 bg-white p-5 rounded-2xl border border-accent-soft shadow-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-primary mb-1">Designation Role</label>
                      <input type="text" value={editForm.desig} onChange={(e) => setEditForm({ ...editForm, desig: e.target.value })} className="input-modern font-extrabold text-primary" />
                    </div>
                    <div>
                      <label className="block font-bold text-primary mb-1">Allocated Department</label>
                      <select value={editForm.department || ''} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} className="select-modern font-bold">
                        <option value="">Select Department</option>
                        <option value="Ground Floor Saree">Ground Floor Saree</option>
                        <option value="First Floor Saree">First Floor Saree</option>
                        <option value="Mens">Mens</option>
                        <option value="Ladies">Ladies</option>
                        <option value="Kids">Kids</option>
                        <option value="Home Furnishing">Home Furnishing</option>
                        <option value="Operations & Support">Operations &amp; Support</option>
                        <option value="Accounts & Billing">Accounts &amp; Billing</option>
                        <option value="Security & Housekeeping">Security &amp; Housekeeping</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-primary mb-1">Assigned Floor Section</label>
                      <input type="text" placeholder="e.g. Ethnic Wear, Silk, Cash Counter" value={editForm.section} onChange={(e) => setEditForm({ ...editForm, section: e.target.value })} className="input-modern font-extrabold text-accent" />
                    </div>
                    <div>
                      <label className="block font-bold text-primary mb-1">Employment Status</label>
                      <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="select-modern font-bold">
                        <option value="Joined">Joined (Active Staff)</option>
                        <option value="New">New Candidate</option>
                        <option value="Offer Accepted">Offer Accepted</option>
                        <option value="Notice Period">Notice Period</option>
                        <option value="Completed Exit">Completed Exit</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-primary mb-1">Branch Location</label>
                      <input type="text" value={editForm.branch} onChange={(e) => setEditForm({ ...editForm, branch: e.target.value })} className="input-modern" />
                    </div>
                    <div>
                      <label className="block font-bold text-primary mb-1">Reporting Manager</label>
                      <input type="text" value={editForm.reportingManager} onChange={(e) => setEditForm({ ...editForm, reportingManager: e.target.value })} className="input-modern" />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: SALARY & PACKAGE */}
              {editTab === 'compensation' && (
                <div className="space-y-4 bg-white p-5 rounded-2xl border border-accent-soft shadow-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-primary mb-1">Base Monthly Salary (₹)</label>
                      <input type="text" placeholder="e.g. 20000" value={editForm.salary} onChange={(e) => setEditForm({ ...editForm, salary: e.target.value })} className="input-modern font-mono font-bold text-primary" />
                    </div>
                    <div>
                      <label className="block font-bold text-primary mb-1">Monthly Incentive / Bonus (₹)</label>
                      <input type="text" placeholder="e.g. 3000" value={editForm.incentive} onChange={(e) => setEditForm({ ...editForm, incentive: e.target.value })} className="input-modern font-mono font-bold text-emerald-700" />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-primary mb-1">Date of Joining (DOJ)</label>
                    <input type="date" value={editForm.offeredDoj} onChange={(e) => setEditForm({ ...editForm, offeredDoj: e.target.value })} className="input-modern" />
                  </div>
                </div>
              )}

              {/* TAB 4: EXPERIENCE & EDUCATION */}
              {editTab === 'experience' && (
                <div className="space-y-4 bg-white p-5 rounded-2xl border border-accent-soft shadow-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-primary mb-1">Total Work Experience</label>
                      <input type="text" placeholder="e.g. 3 Years" value={editForm.experience} onChange={(e) => setEditForm({ ...editForm, experience: e.target.value })} className="input-modern" />
                    </div>
                    <div>
                      <label className="block font-bold text-primary mb-1">Prior / Retail Experience</label>
                      <input type="text" placeholder="e.g. 2 Years in Textiles" value={editForm.retailExperience} onChange={(e) => setEditForm({ ...editForm, retailExperience: e.target.value })} className="input-modern" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-primary mb-1">Previous Company</label>
                      <input type="text" value={editForm.previousCompany} onChange={(e) => setEditForm({ ...editForm, previousCompany: e.target.value })} className="input-modern" />
                    </div>
                    <div>
                      <label className="block font-bold text-primary mb-1">Previous Designation</label>
                      <input type="text" value={editForm.previousDesignation} onChange={(e) => setEditForm({ ...editForm, previousDesignation: e.target.value })} className="input-modern" />
                    </div>
                    <div>
                      <label className="block font-bold text-primary mb-1">Previous Salary</label>
                      <input type="text" value={editForm.previousSalary} onChange={(e) => setEditForm({ ...editForm, previousSalary: e.target.value })} className="input-modern font-mono" />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-primary mb-1">Highest Qualification</label>
                    <input type="text" placeholder="e.g. SSLC, PUC, B.Com" value={editForm.qualification} onChange={(e) => setEditForm({ ...editForm, qualification: e.target.value })} className="input-modern" />
                  </div>
                </div>
              )}

              {/* TAB 5: PERSONAL & FAMILY */}
              {editTab === 'personal' && (
                <div className="space-y-4 bg-white p-5 rounded-2xl border border-accent-soft shadow-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-primary mb-1">Father's Details</label>
                      <input type="text" value={editForm.fatherDetails} onChange={(e) => setEditForm({ ...editForm, fatherDetails: e.target.value })} className="input-modern" />
                    </div>
                    <div>
                      <label className="block font-bold text-primary mb-1">Mother's Details</label>
                      <input type="text" value={editForm.motherDetails} onChange={(e) => setEditForm({ ...editForm, motherDetails: e.target.value })} className="input-modern" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-primary mb-1">Religion</label>
                      <input type="text" value={editForm.religion} onChange={(e) => setEditForm({ ...editForm, religion: e.target.value })} className="input-modern" />
                    </div>
                    <div>
                      <label className="block font-bold text-primary mb-1">Caste / Category</label>
                      <input type="text" value={editForm.caste} onChange={(e) => setEditForm({ ...editForm, caste: e.target.value })} className="input-modern" />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-primary mb-1">Languages Known (comma separated)</label>
                    <input type="text" placeholder="e.g. Kannada, English, Hindi" value={editForm.languagesKnown} onChange={(e) => setEditForm({ ...editForm, languagesKnown: e.target.value })} className="input-modern" />
                  </div>

                  <div>
                    <label className="block font-bold text-primary mb-1">HR &amp; Executive Remarks</label>
                    <textarea
                      rows={2}
                      value={editForm.remarks}
                      onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })}
                      placeholder="Enter employee notes or remarks..."
                      className="input-modern"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Sticky Footer */}
            <div className="flex items-center justify-between p-4 bg-background border-t border-accent-soft">
              <div className="text-[11px] text-primary font-semibold">
                Changes persist directly to MySQL Database.
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setEditModal({ open: false, emp: null })} className="px-4 py-2 rounded-xl border border-accent-soft bg-white font-extrabold text-xs text-[#5D4E42]">
                  Cancel
                </button>
                <button onClick={handleSaveEdit} disabled={saving} className="btn-primary text-xs shadow-md disabled:opacity-50 px-6 py-2">
                  {saving ? 'Saving Details...' : 'Save Employee Details'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Universal 360 Employee Profile Overview Modal */}
      <EmployeeProfileModal
        employee={drawerEmp}
        onClose={() => setDrawerEmp(null)}
        onUpdated={loadEmployees}
      />
    </div>
  );
}
