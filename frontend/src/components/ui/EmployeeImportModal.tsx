import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X, Download, Check, RotateCcw } from 'lucide-react';
import * as XLSX from 'xlsx';
import ModalPortal from './ModalPortal';
import { API } from '../../services/api';
import { showToast } from '../Toast';

interface EmployeeImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedEmployeeRow {
  rowNum: number;
  fullName: string;
  employeeId: string;
  username: string;
  password?: string;
  role: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  section: string;
  location: string;
  joiningDate: string;
  salary: string | number;
  status: string;
  address: string;
  city: string;
  aadhaarNumber: string;
  isValid: boolean;
  errors: string[];
}

export default function EmployeeImportModal({ isOpen, onClose, onSuccess }: EmployeeImportModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<ParsedEmployeeRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [filterValidOnly, setFilterValidOnly] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // ── Template Generator ─────────────────────────────────────────────
  const downloadTemplate = (format: 'xlsx' | 'csv') => {
    try {
      const sampleData = [
        {
          'Employee Code': 'EMP-1001',
          'Full Name': 'Rajesh Kumar',
          'Username': 'rajesh.k',
          'Password': '',
          'Role': 'Staff',
          'Email': 'rajesh.kumar@bsctextiles.com',
          'Phone': '9876543210',
          'Department': 'Sales',
          'Designation': 'Sales Executive',
          'Section': 'Menswear',
          'Location': 'Belagavi',
          'Joining Date': '2024-01-15',
          'Salary': 25000,
          'Status': 'Active',
          'Permanent Address': '123 Market Bazaar',
          'City': 'Belagavi',
          'Aadhaar Number': '123456789012'
        },
        {
          'Employee Code': 'EMP-1002',
          'Full Name': 'Sunita Patil',
          'Username': 'sunita.p',
          'Password': '',
          'Role': 'Staff',
          'Email': 'sunita.patil@bsctextiles.com',
          'Phone': '9876543211',
          'Department': 'Billing',
          'Designation': 'Cashier',
          'Section': 'Billing Counter',
          'Location': 'Davanagere',
          'Joining Date': '2024-02-01',
          'Salary': 22000,
          'Status': 'Active',
          'Permanent Address': '45 Station Road',
          'City': 'Davanagere',
          'Aadhaar Number': '987654321098'
        }
      ];

      const ws = XLSX.utils.json_to_sheet(sampleData);

      // Auto-fit column widths
      const colWidths = Object.keys(sampleData[0]).map(key => ({
        wch: Math.max(key.length, 16)
      }));
      ws['!cols'] = colWidths;

      if (format === 'xlsx') {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Employee_Template');
        XLSX.writeFile(wb, 'BSC_Employee_Import_Template.xlsx');
      } else {
        const csv = XLSX.utils.sheet_to_csv(ws);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'BSC_Employee_Import_Template.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      showToast(`Sample ${format.toUpperCase()} template downloaded`, 'success');
    } catch (err: any) {
      showToast('Failed to generate template: ' + err.message, 'error');
    }
  };

  // ── File Parsing ───────────────────────────────────────────────────
  const processFile = async (selectedFile: File) => {
    const validExts = ['.csv', '.xlsx', '.xls'];
    const lowerName = selectedFile.name.toLowerCase();
    const isValidExt = validExts.some(ext => lowerName.endsWith(ext));

    if (!isValidExt) {
      showToast('Please upload an approved CSV or Excel (.xlsx / .xls) file.', 'error');
      return;
    }

    setFile(selectedFile);
    setParsing(true);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) throw new Error('File contains no sheets');

      const worksheet = workbook.Sheets[firstSheetName];
      const rawJson = XLSX.utils.sheet_to_json<any>(worksheet, { defval: '', raw: false });

      if (!rawJson || rawJson.length === 0) {
        showToast('The uploaded sheet is empty or has no data rows.', 'error');
        setRows([]);
        return;
      }

      const parsed: ParsedEmployeeRow[] = rawJson.map((row, idx) => {
        const getVal = (...keys: string[]): string => {
          for (const k of keys) {
            for (const rowKey of Object.keys(row)) {
              if (rowKey.trim().toLowerCase() === k.toLowerCase()) {
                return String(row[rowKey] || '').trim();
              }
            }
          }
          return '';
        };

        const fullName = getVal('Full Name', 'Name', 'Employee Name', 'fullname', 'emp_name');
        const employeeId = getVal('Employee Code', 'Employee ID', 'Emp Code', 'emp_id', 'employee_id');
        const username = getVal('Username', 'User Name', 'username');
        const password = getVal('Password', 'password');
        const role = getVal('Role', 'role') || 'Staff';
        const email = getVal('Email', 'Email ID', 'email');
        const phone = getVal('Phone', 'Mobile', 'Contact', 'phone', 'mobile').replace(/[^0-9+]/g, '');
        const department = getVal('Department', 'Dept', 'department', 'dept') || 'General';
        const designation = getVal('Designation', 'Position', 'Title', 'designation') || 'Staff';
        const section = getVal('Section', 'Floor', 'section');
        const location = getVal('Location', 'Branch', 'Store', 'location', 'branch');
        const joiningDate = getVal('Joining Date', 'DOJ', 'Date of Joining', 'joining_date');
        const salary = getVal('Salary', 'CTC', 'salary');
        const status = getVal('Status', 'Employment Status', 'status') || 'Active';
        const address = getVal('Permanent Address', 'Address', 'address');
        const city = getVal('City', 'city');
        const aadhaarNumber = getVal('Aadhaar Number', 'Aadhaar', 'aadhaar').replace(/[^0-9]/g, '');

        const errors: string[] = [];
        if (!fullName) errors.push('Full Name is required');
        if (phone && phone.replace(/\D/g, '').length > 0 && phone.replace(/\D/g, '').length < 10) {
          errors.push('Phone must have at least 10 digits');
        }

        return {
          rowNum: idx + 2, // 1-indexed Excel row (row 1 is header)
          fullName,
          employeeId,
          username,
          password,
          role,
          email,
          phone,
          department,
          designation,
          section,
          location,
          joiningDate,
          salary,
          status,
          address,
          city,
          aadhaarNumber,
          isValid: errors.length === 0,
          errors
        };
      }).filter(r => r.fullName || r.employeeId || r.phone || r.email);

      setRows(parsed);
      if (parsed.length === 0) {
        showToast('No valid employee records found in file.', 'error');
      } else {
        const validCount = parsed.filter(r => r.isValid).length;
        showToast(`Parsed ${parsed.length} rows (${validCount} valid)`, 'success');
      }
    } catch (err: any) {
      console.error('[EmployeeImportModal] Parse error:', err);
      showToast('Failed to parse file: ' + err.message, 'error');
      setRows([]);
    } finally {
      setParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  // ── Submit Bulk Import ─────────────────────────────────────────────
  const handleSaveToDatabase = async () => {
    const validRows = rows.filter(r => r.isValid);
    if (validRows.length === 0) {
      showToast('No valid employee rows to import. Please check file errors.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = validRows.map(r => ({
        fullName: r.fullName,
        employeeId: r.employeeId,
        username: r.username,
        password: r.password,
        role: r.role,
        email: r.email,
        phone: r.phone,
        department: r.department,
        designation: r.designation,
        section: r.section,
        location: r.location,
        joiningDate: r.joiningDate,
        salary: r.salary,
        status: r.status,
        address: r.address,
        city: r.city,
        aadhaarNumber: r.aadhaarNumber
      }));

      const res = await API.bulkImportEmployees(payload);
      if (res && res.success) {
        showToast(res.message || `Successfully imported ${validRows.length} employees to database!`, 'success');
        onSuccess();
        onClose();
      } else {
        throw new Error(res?.message || 'Failed to complete bulk import');
      }
    } catch (err: any) {
      console.error('[EmployeeImportModal] Import error:', err);
      showToast(err.message || 'Bulk import failed. Please review your file.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const totalCount = rows.length;
  const validCount = rows.filter(r => r.isValid).length;
  const invalidCount = totalCount - validCount;
  const displayedRows = filterValidOnly ? rows.filter(r => r.isValid) : rows;

  return (
    <ModalPortal isOpen={isOpen} onClose={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl border-2 border-accent/40 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-primary via-primary to-[#3D2B1F] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-accent text-primary flex items-center justify-center font-black shadow-md shrink-0">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Import Employee Directory
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-accent/30 text-accent-light border border-accent/40">
                  CSV & Excel
                </span>
              </div>
              <p className="text-xs text-white/80 font-medium mt-0.5">
                Bulk upload employee master records directly into the company database across all locations.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* Top Banner / Template Download Bar */}
          <div className="p-4 rounded-2xl bg-primary/5 border border-primary/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-xs font-black text-primary flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-accent" />
                Need the standard import format?
              </span>
              <p className="text-[11px] text-primary/70">
                Download the pre-configured template with correct column headers and sample data.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => downloadTemplate('xlsx')}
                className="btn-outline text-xs px-3 py-1.5 font-bold flex items-center gap-1.5 cursor-pointer bg-white shadow-2xs hover:border-accent flex-1 sm:flex-initial justify-center"
              >
                <Download className="w-3.5 h-3.5 text-accent" />
                <span>Excel (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={() => downloadTemplate('csv')}
                className="btn-outline text-xs px-3 py-1.5 font-bold flex items-center gap-1.5 cursor-pointer bg-white shadow-2xs hover:border-accent flex-1 sm:flex-initial justify-center"
              >
                <Download className="w-3.5 h-3.5 text-accent" />
                <span>CSV Template</span>
              </button>
            </div>
          </div>

          {/* Upload Drop Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative p-6 sm:p-8 rounded-2xl border-2 border-dashed text-center cursor-pointer transition-all duration-200
              ${dragActive ? 'border-accent bg-accent/10 scale-[0.99]' : 'border-accent/40 bg-accent/5 hover:border-accent hover:bg-accent/10'}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv, .xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  processFile(e.target.files[0]);
                }
              }}
              className="hidden"
            />
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-white border border-accent/30 shadow-xs flex items-center justify-center text-accent">
                <Upload className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-black text-primary">
                  {file ? file.name : 'Choose a CSV or Excel spreadsheet, or drag and drop here'}
                </p>
                <p className="text-xs text-primary/60 font-medium">
                  {file
                    ? `File size: ${(file.size / 1024).toFixed(1)} KB — Click to choose a different file`
                    : 'Supports .csv, .xlsx, and .xls files with multiple workforce columns'}
                </p>
              </div>
            </div>
          </div>

          {/* Parsing Spinner */}
          {parsing && (
            <div className="py-8 text-center space-y-2">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              <p className="text-xs font-bold text-primary/70">Analyzing spreadsheet data...</p>
            </div>
          )}

          {/* Live Preview Table */}
          {!parsing && rows.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-accent-soft pb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black text-primary">Data Preview:</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-primary/10 text-primary">
                    Total: {totalCount}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Valid: {validCount}
                  </span>
                  {invalidCount > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Issues: {invalidCount}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-primary/80 flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterValidOnly}
                      onChange={e => setFilterValidOnly(e.target.checked)}
                      className="rounded text-primary focus:ring-accent"
                    />
                    <span>Show valid only</span>
                  </label>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto max-h-64 border border-accent-soft rounded-2xl shadow-inner bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#FAF7F5] border-b border-accent-soft sticky top-0 z-10 text-[11px] font-black uppercase text-primary">
                    <tr>
                      <th className="p-2.5 pl-3">Row</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Emp Code</th>
                      <th className="p-2.5">Full Name</th>
                      <th className="p-2.5">Department</th>
                      <th className="p-2.5">Designation</th>
                      <th className="p-2.5">Role</th>
                      <th className="p-2.5">Phone</th>
                      <th className="p-2.5">Location</th>
                      <th className="p-2.5">Joining Date</th>
                      <th className="p-2.5 pr-3">Salary</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-accent-soft/60">
                    {displayedRows.map((r) => (
                      <tr
                        key={r.rowNum}
                        className={`transition-colors ${r.isValid ? 'hover:bg-accent/5' : 'bg-rose-50/60 hover:bg-rose-50'}`}
                      >
                        <td className="p-2.5 pl-3 font-mono font-bold text-primary/70">{r.rowNum}</td>
                        <td className="p-2.5">
                          {r.isValid ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                              <Check className="w-3 h-3" /> Ready
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md"
                              title={r.errors.join(', ')}
                            >
                              <AlertCircle className="w-3 h-3" /> {r.errors[0]}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 font-mono font-semibold text-primary">{r.employeeId || 'Auto'}</td>
                        <td className="p-2.5 font-bold text-primary">{r.fullName}</td>
                        <td className="p-2.5 text-primary/80">{r.department}</td>
                        <td className="p-2.5 text-primary/80">{r.designation}</td>
                        <td className="p-2.5 text-primary/80">{r.role}</td>
                        <td className="p-2.5 font-mono text-primary/80">{r.phone || '—'}</td>
                        <td className="p-2.5 text-primary/80">{r.location || 'Default'}</td>
                        <td className="p-2.5 font-mono text-primary/80">{r.joiningDate || '—'}</td>
                        <td className="p-2.5 pr-3 font-mono text-primary/80">{r.salary || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-background border-t border-accent-soft flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-xl border border-accent-soft text-primary text-xs font-bold hover:bg-card cursor-pointer transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSaveToDatabase}
            disabled={submitting || validCount === 0}
            className="btn-gold text-xs px-5 py-2.5 font-black flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin" />
                <span>Saving to Database...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Save to Database ({validCount} Records)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </ModalPortal>
  );
}
