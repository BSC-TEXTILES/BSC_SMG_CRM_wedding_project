import React, { useState, useEffect } from 'react';
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
  ChevronUp
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
  totalRows?: number;
  summary?: string;
  insertedCodes?: string[];
  errors?: ValidationError[];
}

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
  }, [navigate]);

  // Client-side fallback template generator if server is offline
  const generateFallbackCsv = () => {
    const csvContent =
      '\uFEFFcustomer_name,mobile_number,email,wedding_date,shopping_date,followup_call_date,store_location,notes,alternate_number\r\n' +
      'Ananya Hegde,9845012345,ananya.hegde@example.com,2025-05-15,2025-04-20,2025-03-30,Shivamogga,Interested in bridal Kanjeevaram sarees,9845099999\r\n' +
      'Pooja Patil,9880198765,pooja.patil@example.com,2025-06-10,2025-05-15,2025-04-10,Davanagere,Looking for designer lehengas and family sets,\r\n' +
      'Kavya Suresh,9741234567,,2025-07-22,2025-06-25,2025-05-20,Belagavi,Family wedding shopping for 10 members,9741234568\r\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'wedding_customer_template.csv';
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
        link.download = `wedding_customer_template.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      showToast(`${format.toUpperCase()} template downloaded successfully`, 'success');
    } catch (err: any) {
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
    const isCsv = fileName.endsWith('.csv');
    const isXlsx = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

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

          const hasCustomerName = headers.some(h => ['customer_name', 'name', 'customer', 'bride_groom_name'].includes(h));
          const hasMobileNumber = headers.some(h => ['mobile_number', 'mobile', 'phone', 'contact', 'phone_number'].includes(h));

          if (!hasCustomerName || !hasMobileNumber) {
            const missing: string[] = [];
            if (!hasCustomerName) missing.push('customer_name');
            if (!hasMobileNumber) missing.push('mobile_number');
            setFileError(`Missing required column headers: ${missing.join(', ')}. Row 1 must include "customer_name" and "mobile_number".`);
            return;
          }

          const rowCount = Math.max(0, lines.length - 1);
          setFilePreviewCount(rowCount);
          if (rowCount === 0) {
            setFileError('The file contains headers but no customer data rows below row 1.');
            return;
          }

          // File passed all pre-checks
          setFile(selectedFile);
        } catch (err: any) {
          setFileError('Could not read the CSV file. Please ensure it is saved with UTF-8 encoding.');
        }
      };

      reader.onerror = () => {
        setFileError('Failed to read the file. Please ensure the file is not corrupted.');
      };

      reader.readAsText(selectedFile, 'UTF-8');
    } else {
      // Excel file: accepted for upload
      setFile(selectedFile);
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

      const imported = res.importedCount ?? res.imported ?? 0;
      const skipped = res.duplicateCount ?? res.duplicates ?? 0;
      const errors = res.errorCount ?? res.errors?.length ?? 0;

      const summaryText = `${imported} customers imported, ${skipped} duplicates skipped, ${errors} errors.`;
      showToast(summaryText, imported > 0 ? 'success' : 'info');
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

  const importedCount = importResult?.importedCount ?? importResult?.imported ?? 0;
  const duplicateCount = importResult?.duplicateCount ?? importResult?.duplicates ?? 0;
  const errorCount = importResult?.errorCount ?? importResult?.errors?.length ?? 0;

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
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#182033] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#C98218]" />
                  <span>Column Specification & Legend</span>
                </span>
                <span className="text-[11px] font-medium text-muted">Exact Row 1 Headers Required</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-2.5 text-xs">
                {/* customer_name */}
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-red-900 font-mono text-[11px]">customer_name</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-red-600 text-white">Required</span>
                  </div>
                  <p className="text-[11px] text-red-800">Bride / Groom / Customer full name</p>
                  <p className="text-[10px] text-red-600 font-mono italic">e.g. Ananya Hegde</p>
                </div>

                {/* mobile_number */}
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-red-900 font-mono text-[11px]">mobile_number</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-red-600 text-white">Required</span>
                  </div>
                  <p className="text-[11px] text-red-800">10-digit primary mobile (starts 6-9)</p>
                  <p className="text-[10px] text-red-600 font-mono italic">e.g. 9845012345</p>
                </div>

                {/* email */}
                <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-900 font-mono text-[11px]">email</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-100 text-emerald-800">Optional</span>
                  </div>
                  <p className="text-[11px] text-emerald-800">Valid email address</p>
                  <p className="text-[10px] text-emerald-600 font-mono italic">ananya@example.com</p>
                </div>

                {/* wedding_date */}
                <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-900 font-mono text-[11px]">wedding_date</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-100 text-emerald-800">Optional</span>
                  </div>
                  <p className="text-[11px] text-emerald-800">Wedding Date (YYYY-MM-DD)</p>
                  <p className="text-[10px] text-emerald-600 font-mono italic">e.g. 2025-05-15</p>
                </div>

                {/* shopping_date */}
                <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-900 font-mono text-[11px]">shopping_date</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-100 text-emerald-800">Optional</span>
                  </div>
                  <p className="text-[11px] text-emerald-800">Shopping Date (YYYY-MM-DD)</p>
                  <p className="text-[10px] text-emerald-600 font-mono italic">e.g. 2025-04-20</p>
                </div>

                {/* followup_call_date */}
                <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-900 font-mono text-[11px]">followup_call_date</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-100 text-emerald-800">Optional</span>
                  </div>
                  <p className="text-[11px] text-emerald-800">Follow-up Call Date (YYYY-MM-DD)</p>
                  <p className="text-[10px] text-emerald-600 font-mono italic">e.g. 2025-03-30</p>
                </div>

                {/* store_location */}
                <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-900 font-mono text-[11px]">store_location</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-100 text-emerald-800">Optional</span>
                  </div>
                  <p className="text-[11px] text-emerald-800">Branch name or code</p>
                  <p className="text-[10px] text-emerald-600 font-mono italic">Shivamogga / DAV / BEL</p>
                </div>

                {/* notes */}
                <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-900 font-mono text-[11px]">notes</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-100 text-emerald-800">Optional</span>
                  </div>
                  <p className="text-[11px] text-emerald-800">Customer remarks / wishes</p>
                  <p className="text-[10px] text-emerald-600 font-mono italic">Kanjeevaram enquiry</p>
                </div>

                {/* alternate_number */}
                <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-900 font-mono text-[11px]">alternate_number</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-100 text-emerald-800">Optional</span>
                  </div>
                  <p className="text-[11px] text-emerald-800">Secondary contact number</p>
                  <p className="text-[10px] text-emerald-600 font-mono italic">e.g. 9845099999</p>
                </div>
              </div>
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                    <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Imported Successfully</span>
                    <span className="text-xl font-black text-emerald-900 mt-1 block">{importedCount}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                    <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">Duplicates Skipped</span>
                    <span className="text-xl font-black text-amber-900 mt-1 block">{duplicateCount}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                    <span className="text-[11px] font-bold text-red-800 uppercase tracking-wider block">Errors / Invalid Rows</span>
                    <span className="text-xl font-black text-red-900 mt-1 block">{errorCount}</span>
                  </div>
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

          </div>
        </div>
      </PageContainer>
    </DashboardLayout>
  );
}
