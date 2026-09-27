import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import PageContainer from '../../components/ui/PageContainer';
import ToastContainer, { showToast } from '../../components/Toast';
import { API, Auth, UserSession } from '../../services/api';
import WeddingNav from './WeddingNav';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CircleAlert,
  CircleCheck,
  AlertTriangle,
  FileText,
  MapPin,
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  Info,
  ChevronDown,
  ChevronUp,
  History,
  FileDown
} from 'lucide-react';

interface ValidationError {
  row: number;
  customerName?: string;
  mobile?: string;
  reason: string;
}

interface ImportSummaryResult {
  importedCount?: number;
  imported?: number;
  duplicateCount?: number;
  duplicates?: number;
  errorCount?: number;
  skipped?: number;
  warningCount?: number;
  totalRows?: number;
  summary?: string;
  importId?: number;
  insertedCodes?: string[];
  errors?: ValidationError[];
  warnings?: ValidationError[];
}

interface ImportLog {
  id: number;
  file_name?: string;
  file_type?: string;
  location_id?: number | null;
  location_name?: string | null;
  user_name?: string | null;
  total_rows?: number;
  imported_count?: number;
  duplicate_count?: number;
  error_count?: number;
  status?: string;
  summary?: string;
  created_at?: string;
}

interface ColumnSpec {
  name: string;
  required: boolean;
  hint: string;
  example: string;
  format?: string;
}

/**
 * Mirrors backend/src/utils/weddingTemplate.js — keep both in sync.
 * Legacy headers (name, phone, alternate_number, budget, store_location,
 * followup_call_date, notes, preferred_collection, estimated_members,
 * expected_visit_date) are still accepted by the importer.
 */
const COLUMN_SPECS: ColumnSpec[] = [
  { name: 'customer_name', required: true, hint: 'Bride / Groom / Customer full name', example: 'Ananya Hegde' },
  { name: 'mobile_number', required: true, hint: '10-digit mobile starting 6-9 (duplicate key)', example: '9845012345', format: 'Text' },
  { name: 'alternate_mobile', required: false, hint: 'Secondary contact number', example: '9845099999', format: 'Text' },
  { name: 'email', required: false, hint: 'Valid e-mail address', example: 'ananya@example.com' },
  { name: 'wedding_date', required: false, hint: 'Date of the wedding', example: '15-05-2025', format: 'dd-mm-yyyy' },
  { name: 'expected_shopping_date', required: false, hint: 'Expected store visit (derived if blank)', example: '20-04-2025', format: 'dd-mm-yyyy' },
  { name: 'preferred_shopping_category', required: false, hint: 'Collection — drop-down from CRM', example: 'Bridal Lehengas' },
  { name: 'estimated_family_size', required: false, hint: 'Shoppers expected (1 - 50)', example: '4', format: 'Whole number' },
  { name: 'budget_min', required: false, hint: 'Lower budget limit', example: '75000', format: '₹#,##,##0' },
  { name: 'budget_max', required: false, hint: 'Upper budget limit', example: '150000', format: '₹#,##,##0' },
  { name: 'assigned_telecaller', required: false, hint: 'Telecaller — drop-down from CRM', example: 'Pooja Sharma' },
  { name: 'customer_notes', required: false, hint: 'Remarks / requirements', example: 'Interested in zari collection' }
];

const TEMPLATE_FILE_NAME = 'BSC_Wedding_Customers_Template.xlsx';
const MAX_IMPORT_ROWS = 5000;

export default function WeddingImport() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(() => Auth.get());
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [filePreviewCount, setFilePreviewCount] = useState<number | null>(null);
  const [locationId, setLocationId] = useState<string>('');
  const [locationError, setLocationError] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [downloadingXlsx, setDownloadingXlsx] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportSummaryResult | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [showWarningDetails, setShowWarningDetails] = useState(false);
  const [importLogs, setImportLogs] = useState<ImportLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [lastFileName, setLastFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadImportLogs = React.useCallback(async () => {
    if (!API.getWeddingImportLogs) return;
    setLogsLoading(true);
    try {
      const res = await API.getWeddingImportLogs(20);
      const list = res?.imports || res?.data?.imports || [];
      if (Array.isArray(list)) setImportLogs(list);
    } catch (err) {
      console.warn('Failed to load import history', err);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    const sess = Auth.get();
    setSession(sess);
    if (sess?.locationId) setLocationId(String(sess.locationId));

    API.getLocations().then((res) => {
      const list = res?.locations || res?.data || [];
      if (Array.isArray(list)) setLocations(list);
    }).catch((err) => {
      console.warn('Failed to load locations', err);
    });

    loadImportLogs();
  }, [navigate, loadImportLogs]);

  // Client-side fallback template generator if the server is unreachable
  const generateFallbackCsv = () => {
    const headers = COLUMN_SPECS.map((c) => c.name).join(',');
    const rows = [
      ['Ananya Hegde', '9845012345', '9845099999', 'ananya.hegde@example.com', '15-05-2025', '20-04-2025', 'Bridal Lehengas', '4', '75000', '150000', '', 'Interested in pure zari wedding collection'],
      ['Pooja Patil', '9880198765', '', 'pooja.patil@example.com', '10-06-2025', '15-05-2025', 'Sherwanis & Suits', '6', '100000', '250000', '', 'Looking for designer lehengas and family sets'],
      ['Kavya Suresh', '9741234567', '', '', '22-07-2025', '25-06-2025', 'Family Matching Sets', '8', '50000', '100000', '', 'Family wedding shopping for 10 members']
    ];
    const csvContent = '\uFEFF' + [headers, ...rows.map((r) => r.join(','))].join('\r\n') + '\r\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'BSC_Wedding_Customers_Template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadTemplate = async (format: 'csv' | 'xlsx') => {
    if (format === 'csv') setDownloadingCsv(true);
    else setDownloadingXlsx(true);

    try {
      if (API.downloadWeddingTemplate) {
        await API.downloadWeddingTemplate(format);
      } else {
        // Direct browser navigation / fetch
        const res = await fetch(`/api/wedding-crm/template-${format}`);
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `BSC_Wedding_Customers_Template.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      showToast(`${format.toUpperCase()} template downloaded successfully`, 'success');
    } catch (err: any) {
      const message = String(err.message || '');
      // Auth / permission failures must surface instead of silently serving a local copy
      if (/\b401\b|\b403\b|access denied|session/i.test(message)) {
        console.warn(`Template download denied:`, message);
        showToast('You are not permitted to download the template. Ask your administrator to grant Wedding CRM access.', 'error');
        return;
      }
      console.warn(`Server template download error, using fallback:`, err.message);
      if (format === 'csv') {
        generateFallbackCsv();
        showToast('CSV template downloaded successfully', 'success');
      } else {
        showToast('Unable to download Excel template. Downloading CSV template instead.', 'info');
        generateFallbackCsv();
      }
    } finally {
      if (format === 'csv') setDownloadingCsv(false);
      else setDownloadingXlsx(false);
    }
  };

  // Pre-validate file when user chooses a file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(null);
    setFileError(null);
    setFilePreviewCount(null);
    setImportResult(null);

    if (!selectedFile) return;

    // 1. File Type Validation
    const fileName = selectedFile.name.toLowerCase();
    if (fileName.endsWith('.xls')) {
      setFileError('Legacy .xls files are not supported. Open the file in Excel and save it as .xlsx (File > Save As > Excel Workbook), then upload it again.');
      showToast('Legacy .xls is not supported — please save the file as .xlsx', 'error');
      return;
    }
    const isCsv = fileName.endsWith('.csv');
    const isXlsx = fileName.endsWith('.xlsx');

    if (!isCsv && !isXlsx) {
      setFileError('Invalid file format. Please upload a .csv or .xlsx file only.');
      showToast('Only .csv and .xlsx files are supported', 'error');
      return;
    }

    // 2. File Size Validation
    if (selectedFile.size === 0) {
      setFileError('The selected file is completely empty (0 bytes). Please select a file with customer records.');
      showToast('Selected file is empty', 'error');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setFileError('File size exceeds the 10 MB limit. Please split the file into smaller batches.');
      showToast('File too large (max 10MB)', 'error');
      return;
    }

    // 3. For CSV files: Inspect Header & UTF-8 Readability
    if (isCsv) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          if (!content || content.trim().length === 0) {
            setFileError('The CSV file has no content.');
            return;
          }

          const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
          if (lines.length < 1) {
            setFileError('The CSV file does not contain a header row.');
            return;
          }

          const headerLine = lines[0].toLowerCase().replace(/"/g, '');
          const headers = headerLine.split(',').map(h => h.trim().replace(/[^a-z0-9_]/g, '_'));

          const hasCustomerName = headers.some(h => ['customer_name', 'name', 'customer', 'bride_groom_name', 'customername'].includes(h));
          const hasMobileNumber = headers.some(h => ['mobile_number', 'mobile', 'phone', 'contact', 'phone_number'].includes(h));

          if (!hasCustomerName || !hasMobileNumber) {
            const missing: string[] = [];
            if (!hasCustomerName) missing.push('customer_name');
            if (!hasMobileNumber) missing.push('mobile_number');
            setFileError(`Missing required column headers: ${missing.join(', ')}. Row 1 must include "customer_name" and "mobile_number". Download the official template to get the exact headers.`);
            return;
          }

          const rowCount = Math.max(0, lines.length - 1);
          if (rowCount > MAX_IMPORT_ROWS) {
            setFileError(`The file contains ${rowCount} rows. The maximum per import is ${MAX_IMPORT_ROWS}. Please split it into smaller batches.`);
            showToast(`Too many rows (max ${MAX_IMPORT_ROWS})`, 'error');
            return;
          }
          setFilePreviewCount(rowCount);
          if (rowCount === 0) {
            setFileError('The file contains headers but no customer data rows below row 1.');
            return;
          }

          // File passed all pre-checks
          setFile(selectedFile);
          setLastFileName(selectedFile.name);
        } catch (err: any) {
          setFileError('Could not read the CSV file. Please ensure it is saved with UTF-8 encoding.');
        }
      };

      reader.onerror = () => {
        setFileError('Failed to read the file. Please ensure the file is not corrupted.');
      };

      reader.readAsText(selectedFile, 'UTF-8');
    } else {
      // Excel file: accepted for upload (the server checks the row count)
      setFile(selectedFile);
      setLastFileName(selectedFile.name);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!locationId) {
      setLocationError(true);
      showToast('Please select a store location before starting import', 'error');
      return;
    }
    setLocationError(false);

    if (!file) {
      showToast('Please choose a valid .csv or .xlsx file to import', 'error');
      return;
    }

    setUploading(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('location_id', locationId);

      const res = await API.importWeddingCustomers(formData);
      setImportResult(res);
      setLastFileName(file.name);

      const imported = res.importedCount ?? res.imported ?? 0;
      const skipped = res.duplicateCount ?? res.duplicates ?? 0;
      const errors = res.errorCount ?? res.errors?.length ?? 0;
      const warnings = res.warningCount ?? res.warnings?.length ?? 0;

      const summaryText = `${imported} customers imported, ${skipped} duplicates skipped, ${errors} errors${warnings ? `, ${warnings} warnings` : ''}.`;
      showToast(summaryText, imported > 0 ? 'success' : 'info');
      loadImportLogs();
    } catch (err: any) {
      const errMsg = err.message || 'Please check your file and try again.';
      showToast('Import failed: ' + errMsg, 'error');
      setImportResult({
        importedCount: 0,
        duplicateCount: 0,
        errorCount: 1,
        summary: 'Import failed: ' + errMsg,
        errors: [{ row: 0, reason: errMsg }]
      });
    } finally {
      setUploading(false);
    }
  };

  // Server-generated .xlsx error report (formula-injection sanitized)
  const handleDownloadErrorReport = async () => {
    if (!importResult?.errors?.length) return;
    setDownloadingReport(true);
    try {
      await API.downloadWeddingErrorReport({
        fileName: lastFileName || 'import.csv',
        summary:
          importResult.summary ||
          `${importedCount} customers imported, ${duplicateCount} duplicates skipped, ${errorCount} errors.`,
        counts: {
          imported: importedCount,
          duplicates: duplicateCount,
          errors: errorCount,
          totalRows: importResult.totalRows ?? 0
        },
        errors: importResult.errors
      });
      showToast('Error report downloaded — fix the listed rows and re-upload', 'success');
    } catch (err: any) {
      showToast('Could not download the error report: ' + (err.message || 'unknown error'), 'error');
    } finally {
      setDownloadingReport(false);
    }
  };

  const importedCount = importResult?.importedCount ?? importResult?.imported ?? 0;
  const duplicateCount = importResult?.duplicateCount ?? importResult?.duplicates ?? 0;
  const errorCount = importResult?.errorCount ?? importResult?.errors?.length ?? 0;
  const warningCount = importResult?.warningCount ?? importResult?.warnings?.length ?? 0;
  const totalRowsCount = importResult?.totalRows ?? (importedCount + duplicateCount + errorCount);

  return (
    <DashboardLayout title="Import Wedding Customers">
      <PageContainer maxWidth="full">
        <ToastContainer />
        <div className="space-y-6">

          <WeddingNav
            currentPageTitle="Bulk Import Wedding Customers"
            breadcrumbs={[
              { label: 'Customer Register', href: '/wedding-crm/customers' },
              { label: 'Import Customers' }
            ]}
          />

          {/* Main Card */}
          <div className="bg-white rounded-3xl border border-[#DFDDD7] shadow-xs p-6 sm:p-8 space-y-6">
            
            {/* Header with Template Downloads */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-[#DFDDD7]">
              <div>
                <h2 className="text-xl font-black text-[#182033] flex items-center gap-2">
                  <FileSpreadsheet className="w-6 h-6 text-[#C98218]" />
                  <span>Bulk Import Wedding Customers</span>
                </h2>
                <p className="text-xs text-muted mt-1 max-w-2xl leading-relaxed">
                  Upload customer registrations in bulk via CSV or Excel (.xlsx).
                  Duplicate mobile numbers will be skipped automatically to maintain clean customer history.
                </p>
                <p className="text-[11px] text-muted mt-1.5 flex items-start gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#C98218] shrink-0 mt-0.5" />
                  <span>
                    Official template: <span className="font-bold text-[#182033]">{TEMPLATE_FILE_NAME}</span> — keep row 1 unchanged,
                    delete the 3 grey sample rows, max {MAX_IMPORT_ROWS} rows per upload, store branch chosen below.
                  </span>
                </p>
              </div>

              {/* Template Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 self-start">
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate('csv')}
                  disabled={downloadingCsv}
                  className="px-4 py-2.5 bg-white hover:bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl text-xs font-bold text-[#182033] flex items-center gap-2 shadow-xs transition-all hover:border-[#C98218] active:scale-95 disabled:opacity-50"
                  title="Download standard UTF-8 CSV template"
                >
                  {downloadingCsv ? (
                    <Loader2 className="w-3.5 h-3.5 text-[#C98218] animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5 text-[#C98218]" />
                  )}
                  <span>Download CSV Template</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadTemplate('xlsx')}
                  disabled={downloadingXlsx}
                  className="px-4 py-2.5 bg-[#059669]/10 hover:bg-[#059669]/15 border border-[#059669]/30 rounded-xl text-xs font-bold text-[#065F46] flex items-center gap-2 shadow-xs transition-all active:scale-95 disabled:opacity-50"
                  title="Download Excel spreadsheet with color-coded headers"
                >
                  {downloadingXlsx ? (
                    <Loader2 className="w-3.5 h-3.5 text-[#059669] animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-3.5 h-3.5 text-[#059669]" />
                  )}
                  <span>Download Excel (.xlsx) Template</span>
                </button>
              </div>
            </div>

            {/* Companion Guidance & Format Legend Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF9F5] border border-[#DFDDD7] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-black text-[#182033] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#C98218]" />
                  <span>Column Specification & Legend</span>
                </span>
                <span className="text-[11px] font-medium text-muted">
                  Exact Row 1 headers · {COLUMN_SPECS.filter((c) => c.required).length} required ·{' '}
                  {COLUMN_SPECS.filter((c) => !c.required).length} optional · max {MAX_IMPORT_ROWS} rows
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                {COLUMN_SPECS.map((col) => (
                  <div
                    key={col.name}
                    className={`p-2.5 rounded-xl border space-y-1 ${
                      col.required ? 'bg-red-50 border-red-200' : 'bg-emerald-50/70 border-emerald-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`font-mono text-[11px] font-black break-all ${
                          col.required ? 'text-red-900' : 'text-emerald-900'
                        }`}
                      >
                        {col.name}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase shrink-0 ${
                          col.required ? 'bg-red-600 text-white' : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {col.required ? 'Required' : 'Optional'}
                      </span>
                    </div>
                    <p className={`text-[11px] ${col.required ? 'text-red-800' : 'text-emerald-800'}`}>{col.hint}</p>
                    <p className="text-[10px] text-muted font-mono italic break-words">
                      {col.format ? `${col.format} · ` : ''}e.g. {col.example}
                    </p>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-muted leading-relaxed">
                <span className="font-black text-[#182033]">Legacy headers still accepted:</span> name, phone,
                alternate_number, email_id, marriage_date, expected_visit_date, preferred_collection, estimated_members,
                budget, budget_range, store_location, followup_call_date, notes, telecaller.
              </p>
              <p className="text-[11px] text-muted leading-relaxed">
                <span className="font-black text-[#182033]">Before uploading:</span> delete the 3 grey sample rows from{' '}
                {TEMPLATE_FILE_NAME}, keep row 1 unchanged, and pick the store branch on this screen (the file does not
                contain a store column).
              </p>
            </div>

            {/* Import Form */}
            <form onSubmit={handleImport} className="space-y-6 max-w-2xl">
              {/* Store Location Selection */}
              <div>
                <label className="block text-xs font-black text-[#182033] mb-1.5">
                  Assign Store Location <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <select
                    value={locationId}
                    disabled={!session?.isGlobalAdmin}
                    onChange={(e) => {
                      setLocationId(e.target.value);
                      if (e.target.value) setLocationError(false);
                    }}
                    className={`w-full px-4 py-3 bg-[#F6F4EF] border ${
                      locationError ? 'border-red-500 ring-2 ring-red-200' : 'border-[#DFDDD7]'
                    } rounded-xl font-bold text-xs text-[#182033] focus:outline-hidden focus:border-[#101C36] transition-colors`}
                  >
                    <option value="">-- Choose Store Location (Required) --</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        📍 {loc.location_name || loc.name} ({loc.location_code})
                      </option>
                    ))}
                  </select>
                </div>
                {locationError && (
                  <p className="text-[11px] text-red-600 font-bold mt-1.5 flex items-center gap-1">
                    <CircleAlert className="w-3.5 h-3.5 shrink-0" />
                    <span>Please assign a store location to import customer records.</span>
                  </p>
                )}
                <span className="text-[11px] text-muted block mt-1">
                  Default branch for records where "store_location" is not specified in the file.
                </span>
              </div>

              {/* File Input */}
              <div>
                <label className="block text-xs font-black text-[#182033] mb-1.5">
                  Select Customer File (.csv or .xlsx) <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv, .xlsx, .xls"
                    onChange={handleFileChange}
                    className="w-full p-3.5 bg-[#F6F4EF] border border-[#DFDDD7] rounded-2xl file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-[#101C36] file:text-[#C9A45C] hover:file:bg-[#07101F] cursor-pointer text-xs font-medium text-[#182033]"
                  />
                </div>

                {/* File Error Alert */}
                {fileError && (
                  <div className="mt-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
                    <CircleAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">File Validation Error: </span>
                      <span>{fileError}</span>
                    </div>
                  </div>
                )}

                {/* File Ready Confirmation */}
                {file && !fileError && (
                  <div className="mt-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CircleCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <span className="font-bold">{file.name}</span>
                        {filePreviewCount !== null && (
                          <span className="text-emerald-700 ml-1.5">
                            ({filePreviewCount} customer {filePreviewCount === 1 ? 'row' : 'rows'} detected)
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-emerald-200/80 text-emerald-900">Ready</span>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={uploading || !file || !locationId || !!fileError}
                  className="px-8 py-3.5 rounded-xl bg-[#101C36] hover:bg-[#07101F] text-[#C9A45C] font-black text-xs shadow-md border border-[#C9A45C]/30 flex items-center gap-2.5 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#C9A45C]" />
                      <span>Processing & Importing Customer Records...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 text-[#C9A45C]" />
                      <span>Start Bulk Import</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Post-Import Result Summary */}
            {importResult && (
              <div className="p-5 sm:p-6 rounded-2xl bg-white border border-[#DFDDD7] shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-[#DFDDD7]">
                  <div className="flex items-center gap-2">
                    {importedCount > 0 ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    ) : errorCount > 0 ? (
                      <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                    ) : (
                      <Info className="w-5 h-5 text-amber-600 shrink-0" />
                    )}
                    <h3 className="font-black text-sm text-[#182033]">
                      Import Execution Summary
                    </h3>
                  </div>

                  {/* Exact summary requirement: "X customers imported, Y duplicates skipped, Z errors." */}
                  <span className="text-xs font-bold text-[#182033] bg-[#F6F4EF] px-3 py-1.5 rounded-xl border border-[#DFDDD7]">
                    {importedCount} customers imported, {duplicateCount} duplicates skipped, {errorCount} errors.
                  </span>
                </div>

                {/* Metric Badges */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                    <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Imported Successfully</span>
                    <span className="text-xl font-black text-emerald-900 mt-1 block">{importedCount}</span>
                    <span className="text-[10px] text-emerald-700 block mt-0.5">of {totalRowsCount} rows</span>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                    <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">Duplicates Skipped</span>
                    <span className="text-xl font-black text-amber-900 mt-1 block">{duplicateCount}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                    <span className="text-[11px] font-bold text-red-800 uppercase tracking-wider block">Errors / Invalid Rows</span>
                    <span className="text-xl font-black text-red-900 mt-1 block">{errorCount}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-sky-50 border border-sky-200">
                    <span className="text-[11px] font-bold text-sky-800 uppercase tracking-wider block">Warnings</span>
                    <span className="text-xl font-black text-sky-900 mt-1 block">{warningCount}</span>
                    <span className="text-[10px] text-sky-700 block mt-0.5">imported with notes</span>
                  </div>
                </div>

                {/* Actions: error report download + rerun */}
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  {errorCount > 0 && Array.isArray(importResult.errors) && importResult.errors.length > 0 && (
                    <button
                      type="button"
                      onClick={handleDownloadErrorReport}
                      disabled={downloadingReport}
                      className="text-xs font-black inline-flex items-center gap-1.5 bg-[#101C36] text-white px-3.5 py-2 rounded-xl hover:bg-[#1d2b52] transition-colors disabled:opacity-60"
                    >
                      {downloadingReport ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <FileDown className="w-3.5 h-3.5" />
                      )}
                      Download Error Report (.xlsx)
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setImportResult(null);
                      setShowErrorDetails(false);
                      setShowWarningDetails(false);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                      setFile(null);
                      setFilePreviewCount(null);
                    }}
                    className="text-xs font-black inline-flex items-center gap-1.5 bg-white text-[#101C36] border border-[#DFDDD7] px-3.5 py-2 rounded-xl hover:bg-[#FAF9F5] transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Fix rows & upload again
                  </button>
                </div>

                {/* Errors Detail Accordion */}
                {Array.isArray(importResult.errors) && importResult.errors.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowErrorDetails(!showErrorDetails)}
                      className="text-xs font-bold text-red-700 hover:text-red-900 flex items-center gap-1.5 underline"
                    >
                      <span>
                        {showErrorDetails ? 'Hide' : 'View'} Details of {importResult.errors.length} Skipped / Error Rows
                      </span>
                      {showErrorDetails ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {showErrorDetails && (
                      <div className="max-h-60 overflow-y-auto rounded-xl border border-red-200 bg-red-50/50 p-3 text-xs">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-red-200 text-red-900 text-[11px] font-black">
                              <th className="pb-1.5 pr-2">Row #</th>
                              <th className="pb-1.5 px-2">Customer</th>
                              <th className="pb-1.5 px-2">Mobile</th>
                              <th className="pb-1.5 pl-2">Reason</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-red-100 text-[11px] text-red-800 font-medium">
                            {importResult.errors.map((err, idx) => (
                              <tr key={idx}>
                                <td className="py-1.5 pr-2 font-mono font-bold text-red-900">
                                  {err.row > 0 ? `Row ${err.row}` : '—'}
                                </td>
                                <td className="py-1.5 px-2 font-medium">{err.customerName || '—'}</td>
                                <td className="py-1.5 px-2 font-mono">{err.mobile || '—'}</td>
                                <td className="py-1.5 pl-2">{err.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Warnings Detail Accordion */}
                {Array.isArray(importResult.warnings) && importResult.warnings.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowWarningDetails(!showWarningDetails)}
                      className="text-xs font-bold text-sky-700 hover:text-sky-900 flex items-center gap-1.5 underline"
                    >
                      <span>
                        {showWarningDetails ? 'Hide' : 'View'} {importResult.warnings.length} Warning{importResult.warnings.length === 1 ? '' : 's'} (rows still imported)
                      </span>
                      {showWarningDetails ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {showWarningDetails && (
                      <div className="max-h-48 overflow-y-auto rounded-xl border border-sky-200 bg-sky-50/60 p-3 text-xs">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-sky-200 text-sky-900 text-[11px] font-black">
                              <th className="pb-1.5 pr-2">Row #</th>
                              <th className="pb-1.5 px-2">Customer</th>
                              <th className="pb-1.5 px-2">Mobile</th>
                              <th className="pb-1.5 pl-2">Warning</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-sky-100 text-[11px] text-sky-800 font-medium">
                            {(importResult.warnings || []).map((warn, idx) => (
                              <tr key={idx}>
                                <td className="py-1.5 pr-2 font-mono font-bold text-sky-900">
                                  {warn.row > 0 ? `Row ${warn.row}` : '—'}
                                </td>
                                <td className="py-1.5 px-2 font-medium">{warn.customerName || '—'}</td>
                                <td className="py-1.5 px-2 font-mono">{warn.mobile || '—'}</td>
                                <td className="py-1.5 pl-2">{warn.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Navigation Link */}
                {importedCount > 0 && (
                  <div className="pt-2 flex items-center justify-between">
                    <Link
                      to="/wedding-crm/customers"
                      className="text-xs font-black text-[#101C36] hover:text-[#C98218] flex items-center gap-1.5 transition-colors underline"
                    >
                      <span>Open Customer Register to view imported records →</span>
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Import History */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#DFDDD7] shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-black text-[#182033] uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-[#C98218]" />
                  <span>Import History</span>
                </span>
                <button
                  type="button"
                  onClick={loadImportLogs}
                  disabled={logsLoading}
                  className="text-[11px] font-bold text-[#101C36] hover:text-[#C98218] inline-flex items-center gap-1.5 underline disabled:opacity-60"
                >
                  {logsLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                  Refresh
                </button>
              </div>

              {importLogs.length === 0 ? (
                <p className="text-[11px] text-muted py-2">
                  No imports recorded for your stores yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="border-b border-[#DFDDD7] text-[#182033] font-black">
                        <th className="py-2 pr-3">When</th>
                        <th className="py-2 px-3">File</th>
                        <th className="py-2 px-3">Store</th>
                        <th className="py-2 px-3">By</th>
                        <th className="py-2 px-3 text-right">Rows</th>
                        <th className="py-2 px-3 text-right">Imported</th>
                        <th className="py-2 px-3 text-right">Dupes</th>
                        <th className="py-2 px-3 text-right">Errors</th>
                        <th className="py-2 pl-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFEEE9] text-[#3a4160]">
                      {importLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-[#FAF9F5]">
                          <td className="py-2 pr-3 font-mono whitespace-nowrap">
                            {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                          </td>
                          <td className="py-2 px-3 font-medium max-w-[180px] truncate" title={log.file_name}>
                            {log.file_name || '—'}
                          </td>
                          <td className="py-2 px-3">{log.location_name || (log.location_id ? `#${log.location_id}` : 'All')}</td>
                          <td className="py-2 px-3">{log.user_name || '—'}</td>
                          <td className="py-2 px-3 text-right font-mono">{log.total_rows ?? 0}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">{log.imported_count ?? 0}</td>
                          <td className="py-2 px-3 text-right font-mono text-amber-700">{log.duplicate_count ?? 0}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-red-700">{log.error_count ?? 0}</td>
                          <td className="py-2 pl-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                String(log.status || '').toLowerCase().replace(/[\s-]+/g, '_') === 'completed_with_errors'
                                  ? 'bg-amber-100 text-amber-800'
                                  : String(log.status || '').toLowerCase().replace(/[\s-]+/g, '_') === 'failed'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {String(log.status || 'Completed').replace(/[\s-]+/g, ' ')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="text-[10px] text-muted">
                Same history is available under Wedding → Reports → Import History.
              </p>
            </div>

          </div>
        </div>
      </PageContainer>
    </DashboardLayout>
  );
}
