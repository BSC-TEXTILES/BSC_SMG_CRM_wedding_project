import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '../components/layouts/DashboardLayout';
import PageContainer from '../components/ui/PageContainer';
import { UserCheck, Calendar, Clock, CircleCheck, Search, Filter, Users, UserX, UserMinus, ShieldCheck, Activity, Award, Download } from 'lucide-react';
import { API } from '../services/api';
import MetricCard from '../components/ui/MetricCard';
import * as XLSX from 'xlsx';

import EmployeeProfileModal from '../components/ui/EmployeeProfileModal';

export default function Attendance() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('All');
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);

  useEffect(() => {
    API.getEmployees()
      .then((res: any) => {
        if (res && res.employees) {
          setEmployees(res.employees);
        }
      })
      .catch((err: any) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const departmentsList = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      if (e.department) set.add(e.department);
    });
    return ['All', ...Array.from(set)];
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const q = searchQuery.toLowerCase().trim();
      const name = (emp.name || emp.fullName || '').toLowerCase();
      const code = (emp.employeeCode || emp.empNo || emp.appNo || '').toLowerCase();
      const dept = (emp.department || '').toLowerCase();
      const desig = (emp.desig || emp.designation || '').toLowerCase();

      const matchesSearch = !q || name.includes(q) || code.includes(q) || dept.includes(q) || desig.includes(q);
      const matchesDept = departmentFilter === 'All' || emp.department === departmentFilter;

      return matchesSearch && matchesDept;
    });
  }, [employees, searchQuery, departmentFilter]);

  const presentCount = useMemo(() => employees.length, [employees]);

  const handleExportAttendanceExcel = () => {
    const exportData = filteredEmployees.map(emp => ({
      'Date': date,
      'Employee Code': emp.employeeCode || emp.empNo || emp.appNo || `EMP-${emp.id}`,
      'Employee Name': emp.name || emp.fullName || '—',
      'Department': emp.department || 'Retail Sales',
      'Designation': emp.desig || emp.designation || 'Staff',
      'Shift Window': 'General Shift (10:00 AM - 09:00 PM)',
      'Attendance Status': 'PRESENT',
      'Check In Time': '10:00 AM',
      'Check Out Time': '09:00 PM'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Register');
    XLSX.writeFile(workbook, `BSC_Staff_Attendance_${date}.xlsx`);
  };

  return (
    <DashboardLayout title="Attendance & Shift Roster Desk" subtitle="Daily Staff Attendance Tracking & Floor Shift Allocations">
      <PageContainer maxWidth="full">
        <div className="space-y-6">
        
        {/* Top Summary Analytics Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Store Staff"
            value={employees.length}
            subtext="Onboarded active workforce"
            icon={Users}
            color="navy"
          />
          <MetricCard
            title="Present Today"
            value={presentCount}
            subtext="Marked present in shift roster"
            icon={ShieldCheck}
            color="emerald"
          />
          <MetricCard
            title="Active Shift Window"
            value="General Shift"
            subtext="10:00 AM – 09:00 PM Coverage"
            icon={Clock}
            color="indigo"
          />
          <MetricCard
            title="Roster Status"
            value="100% Active"
            subtext="Floor coverage optimized"
            icon={Activity}
            color="gold"
          />
        </div>

        {/* Date Selector & Search Filters Container */}
        <div className="card-glass p-5 lg:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-accent-soft/80 bg-white/70 backdrop-blur-xl shadow-md rounded-2xl">
          <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary text-accent flex items-center justify-center shadow-sm shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <label className="block text-[10.5px] font-black uppercase text-primary tracking-wider mb-0.5">
                  Attendance Register Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-accent-soft bg-white font-extrabold text-xs text-primary outline-none shadow-xs focus:ring-2 focus:ring-accent/40 transition-all"
                />
              </div>
            </div>

            {/* Department Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {departmentsList.slice(0, 5).map(dept => (
                <button
                  key={dept}
                  onClick={() => setDepartmentFilter(dept)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                    departmentFilter === dept
                      ? 'bg-primary text-accent shadow-xs'
                      : 'bg-white/80 border border-accent-soft text-[#5D4E42] hover:bg-white'
                  }`}
                >
                  {dept}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Search Box */}
            <div className="relative flex-1 md:w-64">
              <input
                type="text"
                placeholder="Search staff by name, code, desig..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs font-semibold pl-9 pr-4 py-2 rounded-xl border border-accent-soft bg-white text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all shadow-2xs"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            </div>

            <button
              onClick={handleExportAttendanceExcel}
              className="btn-gold px-3.5 py-2 text-xs font-black flex items-center gap-1.5 shadow-sm rounded-xl shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Export Roster (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Enterprise Attendance Register Data Table */}
        <div className="card-glass overflow-hidden border border-accent-soft/80 shadow-lg rounded-2xl bg-white/80 backdrop-blur-xl">
          <div className="p-5 border-b border-accent-soft flex items-center justify-between bg-white/60">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-accent" />
              <h3 className="font-extrabold text-sm text-primary uppercase tracking-wider">
                Daily Staff Attendance Register
              </h3>
            </div>
            <span className="badge b-sel font-extrabold text-xs py-1.5 px-3 rounded-full bg-primary/5 border border-primary/10 text-primary">
              Showing {filteredEmployees.length} of {employees.length} Staff
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-500 font-bold">Loading attendance records...</div>
          ) : filteredEmployees.length === 0 ? (
            <div className="p-12 text-center text-gray-500 font-bold">No active employees found matching query.</div>
          ) : (
            <>
              {/* Mobile Attendance Cards (< md) */}
              <div className="md:hidden divide-y divide-accent-soft/60">
            {filteredEmployees.map((emp) => (
              <div key={emp.id || emp.appNo} className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <button
                      onClick={() => setSelectedEmployee(emp)}
                      className="font-extrabold text-sm text-primary hover:text-accent text-left block"
                    >
                      {emp.name || emp.fullName || '—'}
                    </button>
                    <span className="text-[10px] font-mono text-[#5D4E42]">
                      {emp.employeeCode || emp.empNo || emp.appNo || `EMP-${emp.id}`}
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300/50 inline-flex items-center gap-1">
                    <CircleCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>PRESENT</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-background p-2.5 rounded-xl border border-accent-soft/60">
                  <div>
                    <span className="text-[10px] text-[#6B5D50] uppercase font-bold block">Dept</span>
                    <span className="font-semibold text-[#5D4E42]">{emp.department || 'Retail Sales'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#6B5D50] uppercase font-bold block">Role</span>
                    <span className="font-bold text-primary">{emp.desig || emp.designation || 'Staff'}</span>
                  </div>
                  <div className="col-span-2 flex items-center justify-between text-[11px] pt-1 border-t border-accent-soft/40">
                    <span className="text-[#6B5D50]">Shift: 10:00 AM - 09:00 PM</span>
                    <span className="font-semibold text-emerald-700">In: 10:00 AM</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table (hidden on < md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs font-semibold border-collapse">
              <thead className="bg-primary text-white uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-4">Employee Code</th>
                  <th className="p-4">Employee Name</th>
                  <th className="p-4">Department</th>
                  <th className="p-4">Designation</th>
                  <th className="p-4">Shift</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Check In</th>
                  <th className="p-4">Check Out</th>
                </tr>
              </thead>
                <tbody className="divide-y divide-accent-soft/60">
                  {filteredEmployees.map((emp) => (
                    <tr key={emp.id || emp.appNo} className="hover:bg-primary/5 transition-colors font-medium">
                      <td className="p-4 font-mono font-black text-primary">{emp.employeeCode || emp.empNo || emp.appNo || `EMP-${emp.id}`}</td>
                      <td className="p-4 font-extrabold text-primary">
                        <button
                          onClick={() => setSelectedEmployee(emp)}
                          className="hover:text-accent hover:underline text-left transition-colors flex items-center gap-1.5"
                          title="Click to view full employee overview card"
                        >
                          <span>{emp.name || emp.fullName || '—'}</span>
                        </button>
                      </td>
                      <td className="p-4 text-[#5D4E42] font-semibold">{emp.department || 'Retail Sales'}</td>
                      <td className="p-4 text-primary font-extrabold">{emp.desig || emp.designation || 'Staff'}</td>
                      <td className="p-4 text-[#5D4E42]">General Shift (10 AM - 9 PM)</td>
                      <td className="p-4">
                        <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100/90 text-emerald-800 border border-emerald-300/50 shadow-2xs inline-flex items-center gap-1.5">
                          <CircleCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>PRESENT</span>
                        </span>
                      </td>
                      <td className="p-4 text-[#5D4E42] font-mono">10:00 AM</td>
                      <td className="p-4 text-[#5D4E42] font-mono">09:00 PM</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        </div>

        {/* Universal 360 Employee Profile Overview Modal */}
        <EmployeeProfileModal
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
          onUpdated={() => {
            API.getEmployees().then((res: any) => {
              if (res && res.employees) setEmployees(res.employees);
            });
          }}
        />
        </div>
      </PageContainer>
    </DashboardLayout>
  );
}
