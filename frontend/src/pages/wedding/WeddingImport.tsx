import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import PageContainer from '../../components/ui/PageContainer';
import ToastContainer, { showToast } from '../../components/Toast';
import { API, Auth, UserSession } from '../../services/api';
import WeddingNav from './WeddingNav';
import { FileSpreadsheet, Upload, Download, CircleAlert, CircleCheck, AlertTriangle, Sparkles, Loader2, CheckCircle2, XCircle, Info, ChevronDown, ChevronUp, History, FileDown, RefreshCw, Trash2, ExternalLink, Search, Check, Globe, Settings, X, Link2, Lock, Table } from 'lucide-react';

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
  failed?: number;
  skipped?: number;
  warningCount?: number;
  totalRows?: number;
  summary?: string;
  importId?: number;
  insertedCodes?: string[];
  errors?: ValidationError[];
  duplicateDetails?: ValidationError[];
  warnings?: ValidationError[];
  processingTime?: string;
  processingTimeMs?: number;
  storeBranch?: string;
  fileName?: string;
  sheetTitle?: string;
  sheetName?: string;
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

interface GoogleStatus {
  isConfigured: boolean;
  isConnected: boolean;
  email?: string | null;
  name?: string | null;
  connectedAt?: string | null;
  expiresAt?: string | null;
}

interface GoogleSheetItem {
  id: string;
  name: string;
  lastModified?: string;
  url?: string;
}

interface WorksheetItem {
  sheetId?: number | string;
  title: string;
  rowCount?: number;
  columnCount?: number;
}

interface SheetPreviewData {
  spreadsheetId: string;
  sheetName: string;
  totalRows: number;
  previewCount: number;
  headerValidation: {
    isValid: boolean;
    hasCustomerName: boolean;
    hasMobileNumber: boolean;
    missingHeaders: string[];
    rawHeaders: string[];
    canonicalHeaders: string[];
  };
  previewRows: Array<{
    rowNumber: number;
    data: Record<string, string>;
    isValid: boolean;
    errors: string[];
  }>;
}

/**
 * Approved CRM customer columns (Mirrors backend/src/utils/weddingTemplate.js)
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

  // ── Import Mode: 'file' or 'google' ──
  const [importMode, setImportMode] = useState<'file' | 'google'>('file');

  // ── Store Location ──
  const [locationId, setLocationId] = useState<string>('');
  const [locationError, setLocationError] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);

  // ── Existing File Upload States ──
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [filePreviewCount, setFilePreviewCount] = useState<number | null>(null);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [downloadingXlsx, setDownloadingXlsx] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportSummaryResult | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(true);
  const [showWarningDetails, setShowWarningDetails] = useState(false);
  const [errorSearchQuery, setErrorSearchQuery] = useState('');
  const [importLogs, setImportLogs] = useState<ImportLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [lastFileName, setLastFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ── Google Sheets States ──
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null);
  const [googleStatusLoading, setGoogleStatusLoading] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false);

  // Google OAuth Config Modal (Admin only)
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configClientId, setConfigClientId] = useState('');
  const [configClientSecret, setConfigClientSecret] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  // Spreadsheets Listing
  const [spreadsheets, setSpreadsheets] = useState<GoogleSheetItem[]>([]);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [sheetSearchQuery, setSheetSearchQuery] = useState('');
  const [sheetSelectionMode, setSheetSelectionMode] = useState<'drive' | 'url'>('drive');
  const [manualUrl, setManualUrl] = useState('');
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Selected Google Sheet & Worksheet
  const [selectedSpreadsheet, setSelectedSpreadsheet] = useState<GoogleSheetItem | null>(null);
  const [worksheets, setWorksheets] = useState<WorksheetItem[]>([]);
  const [selectedWorksheet, setSelectedWorksheet] = useState<string>('');

  // Preview & Pre-validation
  const [previewData, setPreviewData] = useState<SheetPreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Google Import Progress States
  const [googleImporting, setGoogleImporting] = useState(false);
  const [importStep, setImportStep] = useState<
    'idle' | 'preparing' | 'reading' | 'validating' | 'importing' | 'completed'
  >('idle');
  const [importProgressPercent, setImportProgressPercent] = useState<number>(0);

  // ── Helper Formats ──
  const clearSelectedFile = React.useCallback(() => {
    setFile(null);
    setFileError(null);
    setFilePreviewCount(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatImportDate = (dateVal?: string | Date | null): string => {
    if (!dateVal) return '—';
    try {
      const str = String(dateVal).trim();
      if (!str || str === 'null' || str === 'undefined') return '—';

      const match = str.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/);
      if (match) {
        const [, year, month, day, hours, minutes, seconds] = match;
        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
      }

      const d = new Date(str);
      if (isNaN(d.getTime())) return str;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    } catch {
      return String(dateVal);
    }
  };

  // ── Load Import Logs ──
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

  const [deletingLogId, setDeletingLogId] = useState<number | null>(null);
  const [clearingLogs, setClearingLogs] = useState(false);

  const handleDeleteLog = async (id: number, fileName?: string) => {
    if (!window.confirm(`Are you sure you want to delete this import history entry${fileName ? ` for "${fileName}"` : ''}? This only removes the record from import history.`)) {
      return;
    }
    setDeletingLogId(id);
    try {
      await API.deleteWeddingImportLog(id);
      showToast('Import history entry deleted', 'success');
      setImportLogs(prev => prev.filter(log => log.id !== id));
    } catch (err: any) {
      showToast(err.message || 'Failed to delete import log', 'error');
    } finally {
      setDeletingLogId(null);
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Are you sure you want to clear all import history entries? This cannot be undone.')) {
      return;
    }
    setClearingLogs(true);
    try {
      await API.clearWeddingImportLogs();
      showToast('Import history cleared', 'success');
      setImportLogs([]);
    } catch (err: any) {
      showToast(err.message || 'Failed to clear import history', 'error');
    } finally {
      setClearingLogs(false);
    }
  };

  // ── Load Google Sheets Status ──
  const loadGoogleStatus = React.useCallback(async () => {
    setGoogleStatusLoading(true);
    try {
      const res = await API.getGoogleSheetsStatus();
      const data: GoogleStatus = res?.data || res;
      setGoogleStatus(data);
      if (data?.isConnected) {
        loadSpreadsheets();
      }
    } catch (err: any) {
      console.warn('Failed to check Google Sheets status:', err.message);
    } finally {
      setGoogleStatusLoading(false);
    }
  }, []);

  // ── Load Spreadsheets from Google Drive ──
  const loadSpreadsheets = async (search?: string) => {
    setLoadingSheets(true);
    try {
      const res = await API.getGoogleSpreadsheets(search);
      const list = res?.spreadsheets || res?.data?.spreadsheets || [];
      setSpreadsheets(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.warn('Failed to load spreadsheets from Google Drive:', err);
      if (err.message && err.message.includes('expired')) {
        showToast('Google Sheets authorization has expired. Please reconnect your Google account.', 'error');
        setGoogleStatus((prev) => (prev ? { ...prev, isConnected: false } : null));
      }
    } finally {
      setLoadingSheets(false);
    }
  };

  // ── Initial Setup & OAuth listener ──
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
    loadGoogleStatus();

    // Listen for OAuth popup completion
    const handleAuthMessage = (e: MessageEvent) => {
      if (e.data?.type === 'GOOGLE_AUTH_SUCCESS' || e.data?.type === 'GOOGLE_SHEETS_CONNECTED') {
        showToast('Google Account connected successfully!', 'success');
        loadGoogleStatus();
      }
    };
    window.addEventListener('message', handleAuthMessage);

    // Also check URL parameters if redirected in same window
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('google_connected') === 'true' || urlParams.get('google_auth') === 'success') {
      showToast('Google Account connected successfully!', 'success');
      window.history.replaceState({}, document.title, window.location.pathname);
      loadGoogleStatus();
    }

    return () => {
      window.removeEventListener('message', handleAuthMessage);
    };
  }, [navigate, loadImportLogs, loadGoogleStatus]);

  // ── Google OAuth Connection Handlers ──
  const handleConnectGoogle = async () => {
    try {
      setConnectingGoogle(true);
      const res = await API.getGoogleAuthUrl();
      const authUrl = res?.authUrl || res?.data?.authUrl;

      if (!authUrl) {
        showToast('Could not generate Google authorization URL.', 'error');
        return;
      }

      // Open OAuth popup window centered on user screen
      const width = 560;
      const height = 680;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      const popup = window.open(
        authUrl,
        'googleAuthPopup',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
      );

      if (!popup) {
        showToast('Popup was blocked by your browser. Please allow popups for this site.', 'error');
      }
    } catch (err: any) {
      if (err.message && err.message.includes('GOOGLE_NOT_CONFIGURED')) {
        showToast('Google Cloud credentials not configured yet. Administrators can configure them below.', 'info');
        setShowConfigModal(true);
      } else {
        showToast('Google authentication failed: ' + (err.message || 'unknown error'), 'error');
      }
    } finally {
      setConnectingGoogle(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!window.confirm('Are you sure you want to disconnect your Google account from the CRM?')) return;
    try {
      setDisconnectingGoogle(true);
      await API.disconnectGoogleAccount();
      setGoogleStatus((prev) => (prev ? { ...prev, isConnected: false, email: null, name: null } : null));
      setSpreadsheets([]);
      setSelectedSpreadsheet(null);
      setWorksheets([]);
      setSelectedWorksheet('');
      setPreviewData(null);
      setPreviewError(null);
      showToast('Google account disconnected successfully.', 'success');
    } catch (err: any) {
      showToast('Failed to disconnect Google account: ' + (err.message || 'error'), 'error');
    } finally {
      setDisconnectingGoogle(false);
    }
  };

  const handleSaveGoogleConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configClientId.trim() || !configClientSecret.trim()) {
      showToast('Both Client ID and Client Secret are required.', 'error');
      return;
    }
    setSavingConfig(true);
    try {
      await API.saveGoogleConfig(configClientId.trim(), configClientSecret.trim());
      showToast('Google Cloud credentials saved successfully!', 'success');
      setShowConfigModal(false);
      loadGoogleStatus();
    } catch (err: any) {
      showToast('Failed to save Google configuration: ' + (err.message || 'error'), 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  // ── Sheet & Worksheet Selection ──
  const handleSelectSpreadsheet = async (sheet: GoogleSheetItem) => {
    setSelectedSpreadsheet(sheet);
    setManualUrl('');
    setWorksheets([]);
    setSelectedWorksheet('');
    setPreviewData(null);
    setPreviewError(null);
    setImportResult(null);

    setLoadingDetails(true);
    try {
      const res = await API.getGoogleSpreadsheetDetails(sheet.id);
      const details = res?.data || res;
      const ws = details?.worksheets || [];
      setWorksheets(ws);
      if (ws.length > 0) {
        const firstTab = ws[0].title;
        setSelectedWorksheet(firstTab);
        loadSheetPreview(sheet.id, firstTab);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load spreadsheet worksheets', 'error');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleLoadManualUrl = async () => {
    if (!manualUrl.trim()) {
      showToast('Please enter a Google Sheet URL or ID.', 'error');
      return;
    }
    setLoadingDetails(true);
    setPreviewError(null);
    setPreviewData(null);
    setWorksheets([]);
    setSelectedWorksheet('');
    try {
      const res = await API.getGoogleSpreadsheetDetails(manualUrl.trim());
      const details = res?.data || res;
      const ws = details?.worksheets || [];
      const item: GoogleSheetItem = {
        id: details.spreadsheetId || manualUrl.trim(),
        name: details.title || 'Selected Google Sheet',
        url: `https://docs.google.com/spreadsheets/d/${details.spreadsheetId}/edit`
      };
      setSelectedSpreadsheet(item);
      setWorksheets(ws);
      if (ws.length > 0) {
        const firstTab = ws[0].title;
        setSelectedWorksheet(firstTab);
        loadSheetPreview(item.id, firstTab);
      }
      showToast(`Loaded: ${details.title || 'Google Sheet'}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Could not load Google Sheet from URL/ID. Please verify sheet sharing.', 'error');
    } finally {
      setLoadingDetails(false);
    }
  };

  const loadSheetPreview = async (spreadsheetId: string, sheetName: string) => {
    setLoadingPreview(true);
    setPreviewError(null);
    try {
      const res = await API.previewGoogleSheet(spreadsheetId, sheetName);
      const data: SheetPreviewData = res?.data || res;
      setPreviewData(data);
    } catch (err: any) {
      setPreviewError(err.message || 'Failed to generate worksheet preview');
      setPreviewData(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleWorksheetChange = (newSheetName: string) => {
    setSelectedWorksheet(newSheetName);
    setImportResult(null);
    if (selectedSpreadsheet && newSheetName) {
      loadSheetPreview(selectedSpreadsheet.id, newSheetName);
    }
  };

  const handleRefreshSheetData = () => {
    if (!selectedSpreadsheet || !selectedWorksheet) return;
    loadSheetPreview(selectedSpreadsheet.id, selectedWorksheet);
    showToast('Refreshing Google Sheet headers and rows...', 'info');
  };

  // ── Execute Google Sheets Bulk Import ──
  const handleGoogleImport = async () => {
    if (!selectedSpreadsheet || !selectedWorksheet) {
      showToast('Please select a Google Sheet and worksheet tab first.', 'error');
      return;
    }
    if (!locationId) {
      setLocationError(true);
      showToast('Please assign a Store Location before importing.', 'error');
      return;
    }
    if (!previewData?.headerValidation?.isValid) {
      showToast(
        'Header validation failed: Missing required columns ' +
          (previewData?.headerValidation?.missingHeaders?.join(', ') || 'customer_name, mobile_number'),
        'error'
      );
      return;
    }

    setGoogleImporting(true);
    setImportStep('preparing');
    setImportProgressPercent(15);
    setImportResult(null);

    try {
      // Step 1: Preparing
      await new Promise((r) => setTimeout(r, 400));
      setImportStep('reading');
      setImportProgressPercent(40);

      // Step 2: Reading & Validating
      await new Promise((r) => setTimeout(r, 400));
      setImportStep('validating');
      setImportProgressPercent(65);

      // Step 3: Transactional Server Import
      await new Promise((r) => setTimeout(r, 400));
      setImportStep('importing');
      setImportProgressPercent(85);

      const res = await API.importGoogleSheet({
        spreadsheetId: selectedSpreadsheet.id,
        sheetName: selectedWorksheet,
        locationId: Number(locationId)
      });

      const result: ImportSummaryResult = res?.data || res;
      setImportStep('completed');
      setImportProgressPercent(100);
      setImportResult(result);
      setLastFileName(`${selectedSpreadsheet.name} (${selectedWorksheet})`);

      const imp = result.importedCount ?? result.imported ?? 0;
      const dup = result.duplicateCount ?? result.duplicates ?? 0;
      const err = result.errorCount ?? result.failed ?? result.errors?.length ?? 0;

      if (err > 0 || (Array.isArray(result.errors) && result.errors.length > 0)) {
        setShowErrorDetails(true);
      }

      if (imp > 0) {
        showToast(`Import completed: ${imp} imported, ${dup} duplicates skipped, ${err} errors.`, 'success');
      } else if (err > 0) {
        showToast(`Import completed with errors: 0 imported, ${err} failed validation.`, 'error');
      } else {
        showToast(`Import completed: ${dup} duplicate rows skipped.`, 'info');
      }

      // Automatically refresh CRM import history without full page reload
      loadImportLogs();

      // Dispatch live CRM event so Customer Register & Dashboards update live
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('crm-customers-updated', {
            detail: { source: 'google_sheets', count: imp, spreadsheet: selectedSpreadsheet.name }
          })
        );
      }
    } catch (err: any) {
      showToast('Google Sheet import failed: ' + (err.message || 'unknown error'), 'error');
      setImportStep('idle');
    } finally {
      setGoogleImporting(false);
    }
  };

  // ── Existing File Upload Handlers (Preserved 100%) ──
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
      if (/\b401\b|\b403\b|access denied|session/i.test(message)) {
        showToast('You are not permitted to download the template. Ask your administrator.', 'error');
        return;
      }
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setImportResult(null);
    setFile(null);
    setFileError(null);
    setFilePreviewCount(null);

    if (!selectedFile) return;

    const fileName = selectedFile.name.toLowerCase();
    if (fileName.endsWith('.xls')) {
      setFile(null);
      setFileError('Legacy .xls files are not supported. Open the file in Excel and save it as .xlsx (File > Save As > Excel Workbook), then upload it again.');
      showToast('Legacy .xls is not supported — please save the file as .xlsx', 'error');
      return;
    }
    const isCsv = fileName.endsWith('.csv');
    const isXlsx = fileName.endsWith('.xlsx');

    if (!isCsv && !isXlsx) {
      setFile(null);
      setFileError('Invalid file format. Please upload a .csv or .xlsx file only.');
      showToast('Only .csv and .xlsx files are supported', 'error');
      return;
    }

    if (selectedFile.size === 0) {
      setFile(null);
      setFileError('The selected file is completely empty (0 bytes). Please select a file with customer records.');
      showToast('File is empty (0 bytes)', 'error');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setFile(null);
      setFileError(`File size exceeds 10 MB limit (${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB). Please upload a smaller file.`);
      showToast('File exceeds 10 MB limit', 'error');
      return;
    }

    setFile(selectedFile);
    setFileError(null);

    if (isCsv) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const text = (evt.target?.result as string) || '';
          const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
          const dataRows = Math.max(0, lines.length - 1);
          setFilePreviewCount(dataRows);
        } catch {
          setFilePreviewCount(null);
        }
      };
      reader.readAsText(selectedFile.slice(0, 64 * 1024));
    } else {
      setFilePreviewCount(null);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      setFileError('Please select a .csv or .xlsx file to upload.');
      showToast('Please select a file first', 'error');
      return;
    }

    if (!locationId) {
      setLocationError(true);
      showToast('Please assign a Store Location before importing.', 'error');
      return;
    }

    setLocationError(false);
    setUploading(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('location_id', locationId);

      const res = await API.importWeddingCustomers(formData);
      const result: ImportSummaryResult = res?.data || res;
      setImportResult(result);
      setLastFileName(file.name);

      const imp = result.importedCount ?? result.imported ?? 0;
      const dup = result.duplicateCount ?? result.duplicates ?? 0;
      const err = result.errorCount ?? result.skipped ?? result.errors?.length ?? 0;

      if (err > 0 || (Array.isArray(result.errors) && result.errors.length > 0)) {
        setShowErrorDetails(true);
      }

      if (imp > 0) {
        showToast(`Import completed: ${imp} imported, ${dup} duplicates skipped, ${err} errors.`, 'success');
      } else if (err > 0) {
        showToast(`Import completed with errors: 0 imported, ${err} errors.`, 'error');
      } else {
        showToast(`Import completed: ${dup} duplicate rows skipped.`, 'info');
      }

      loadImportLogs();
    } catch (err: any) {
      const msg = err.message || 'Failed to import file';
      showToast(msg, 'error');
      setFileError(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadErrorReport = async () => {
    const reportRows = [
      ...(Array.isArray(importResult?.errors) ? importResult!.errors! : []),
      ...(Array.isArray(importResult?.duplicateDetails) ? importResult!.duplicateDetails! : [])
    ];
    if (!reportRows.length) return;
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
        errors: reportRows
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
  const totalRowsCount = importResult?.totalRows ?? importedCount + duplicateCount + errorCount;

  // Every row the import did not create: genuine validation failures plus the
  // duplicates that were skipped. Listed together so each one still shows its
  // exact reason, while `errorCount` stays a true failure count.
  const notImportedRows: ValidationError[] = [
    ...(Array.isArray(importResult?.errors) ? importResult!.errors! : []),
    ...(Array.isArray(importResult?.duplicateDetails) ? importResult!.duplicateDetails! : [])
  ].sort((a, b) => (a.row || 0) - (b.row || 0));

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
          <div className="bg-[#FFFDFC] rounded-3xl border border-[#E8D9D4] shadow-xs p-6 sm:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-[#E8D9D4]">
              <div>
                <h2 className="text-xl font-black text-[#4A173A] flex items-center gap-2">
                  <FileSpreadsheet className="w-6 h-6 text-[#B76E79]" />
                  <span>Bulk Import Wedding Customers</span>
                </h2>
                <p className="text-xs text-[#6F5963] mt-1 max-w-2xl leading-relaxed">
                  Import customer registrations directly from CSV, Excel (.xlsx), or connected Google Sheets.
                  Duplicate mobile numbers will be skipped automatically to maintain clean customer history.
                </p>
              </div>

              {/* Template Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 self-start">
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate('csv')}
                  disabled={downloadingCsv}
                  className="px-4 py-2.5 bg-[#FFFDFC] hover:bg-[#FFF7F2] border border-[#B76E79] rounded-xl text-xs font-bold text-[#4A173A] flex items-center gap-2 shadow-2xs transition-all hover:border-[#4A173A] active:scale-95 disabled:opacity-50"
                  title="Download standard UTF-8 CSV template"
                >
                  {downloadingCsv ? (
                    <Loader2 className="w-3.5 h-3.5 text-[#B76E79] animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5 text-[#B76E79]" />
                  )}
                  <span>Download CSV Template</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadTemplate('xlsx')}
                  disabled={downloadingXlsx}
                  className="px-4 py-2.5 bg-[#FFF7F2] hover:bg-[#F6E2E5] border border-[#B76E79] rounded-xl text-xs font-bold text-[#4A173A] flex items-center gap-2 shadow-2xs transition-all active:scale-95 disabled:opacity-50"
                  title="Download Excel spreadsheet with color-coded headers"
                >
                  {downloadingXlsx ? (
                    <Loader2 className="w-3.5 h-3.5 text-[#B76E79] animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-3.5 h-3.5 text-[#B76E79]" />
                  )}
                  <span>Download Excel (.xlsx) Template</span>
                </button>
              </div>
            </div>

            {/* Import Mode Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-2xl">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="tab-file-import"
                  onClick={() => {
                    setImportMode('file');
                    setImportResult(null);
                  }}
                  className={`px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${
                    importMode === 'file'
                      ? 'bg-[#4A173A] text-white shadow-xs'
                      : 'text-[#6F5963] hover:text-[#4A173A] hover:bg-[#FFFDFC]'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload File (.CSV / .XLSX)</span>
                </button>

                <button
                  type="button"
                  id="tab-google-import"
                  onClick={() => {
                    setImportMode('google');
                    setImportResult(null);
                    if (googleStatus?.isConnected && spreadsheets.length === 0) {
                      loadSpreadsheets();
                    }
                  }}
                  className={`px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2.5 transition-all ${
                    importMode === 'google'
                      ? 'bg-[#4A173A] text-white shadow-xs'
                      : 'text-[#6F5963] hover:text-[#4A173A] hover:bg-[#FFFDFC]'
                  }`}
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#0F9D58" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
                    <path fill="#FFF" d="M14 2v6h6" opacity=".5" />
                    <path fill="#FFF" d="M8 13h8v2H8zm0 4h8v2H8zm0-8h4v2H8z" />
                  </svg>
                  <span>Import from Google Sheets</span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-[#0F9D58] text-white tracking-wider">
                    Live
                  </span>
                </button>
              </div>

              {/* Status indicator on the right of toggle */}
              <div className="flex items-center gap-2 pr-2">
                {importMode === 'google' && googleStatus?.isConnected && (
                  <span className="text-[11px] font-medium text-[#198754] flex items-center gap-1.5 bg-[#E8F5EE] px-3 py-1 rounded-xl border border-[#198754]/30">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#198754]" />
                    <span>Google Connected ({googleStatus.email})</span>
                  </span>
                )}
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════════════
                MODE 1: GOOGLE SHEETS IMPORT INTERFACE
               ══════════════════════════════════════════════════════════════════════════ */}
            {importMode === 'google' && (
              <div className="space-y-6">
                {/* 1. Google Account Connection Card */}
                <div className="p-5 sm:p-6 rounded-2xl bg-[#FFFAF7] border border-[#E8D9D4] space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-white border border-[#E8D9D4] shadow-2xs flex items-center justify-center shrink-0">
                        <svg className="w-6 h-6" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-[#4A173A]">Google Account Connection</h3>
                        <p className="text-[11px] text-[#6F5963] mt-0.5">
                          {googleStatus?.isConnected
                            ? `Authorized access to read spreadsheets for ${googleStatus.email || 'your account'}.`
                            : 'Connect your Google account securely via Google OAuth 2.0 to access your Google Sheets.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center">
                      {googleStatus?.isConnected ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleDisconnectGoogle}
                            disabled={disconnectingGoogle}
                            className="px-3.5 py-2 rounded-xl bg-white border border-[#B42318]/30 hover:bg-[#FDE8E7] text-[#B42318] text-xs font-bold transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                          >
                            {disconnectingGoogle ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <X className="w-3.5 h-3.5" />
                            )}
                            <span>Disconnect Google Account</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          id="btn-connect-google"
                          onClick={handleConnectGoogle}
                          disabled={connectingGoogle}
                          className="px-5 py-2.5 rounded-xl bg-[#4A173A] hover:bg-[#6A2853] text-white text-xs font-black shadow-xs transition-all active:scale-95 disabled:opacity-50 inline-flex items-center gap-2"
                        >
                          {connectingGoogle ? (
                            <Loader2 className="w-4 h-4 animate-spin text-[#B76E79]" />
                          ) : (
                            <Globe className="w-4 h-4 text-[#E8C7A8]" />
                          )}
                          <span>Connect Google Account</span>
                        </button>
                      )}

                      {/* Admin Google Cloud Credentials Setup */}
                      {(session?.role === 'Admin' || session?.role === 'Super Admin' || session?.isGlobalAdmin) && (
                        <button
                          type="button"
                          onClick={() => setShowConfigModal(true)}
                          className="p-2 rounded-xl bg-white border border-[#E8D9D4] hover:bg-[#FFF7F2] text-[#6F5963] hover:text-[#4A173A] transition-colors"
                          title="Configure Google Cloud OAuth Credentials"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Warning if OAuth credentials are not configured in system */}
                  {googleStatus && !googleStatus.isConfigured && !googleStatus.isConnected && (
                    <div className="p-3.5 rounded-xl bg-[#FFF4D6] border border-[#C58A18]/30 text-[#855D00] text-xs flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-[#C58A18] shrink-0 mt-0.5" />
                      <div className="leading-relaxed">
                        <span className="font-bold">Google Cloud credentials not configured: </span>
                        <span>
                          To enable Google OAuth for this CRM, an Administrator must provide the Google Cloud Client ID & Secret.
                        </span>
                        {(session?.role === 'Admin' || session?.role === 'Super Admin' || session?.isGlobalAdmin) && (
                          <button
                            type="button"
                            onClick={() => setShowConfigModal(true)}
                            className="font-black text-[#4A173A] underline ml-1.5 hover:text-[#6A2853]"
                          >
                            Configure Credentials Now →
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Google Sheet & Worksheet Selection */}
                {googleStatus?.isConnected ? (
                  <div className="space-y-6">
                    {/* Store Location Selection for Google Sheets */}
                    <div className="p-5 rounded-2xl bg-[#FFFDFC] border border-[#E8D9D4] space-y-4">
                      <div>
                        <label className="block text-xs font-black text-[#4A173A] mb-1.5">
                          Assign Store Location <span className="text-[#B42318]">*</span>
                        </label>
                        <select
                          value={locationId}
                          disabled={!session?.isGlobalAdmin}
                          onChange={(e) => {
                            setLocationId(e.target.value);
                            if (e.target.value) setLocationError(false);
                          }}
                          className={`w-full max-w-xl px-4 py-3 bg-[#FFFAF7] border ${
                            locationError ? 'border-[#B42318] ring-2 ring-[#B42318]/20' : 'border-[#E8D9D4]'
                          } rounded-xl font-bold text-xs text-[#2B1722] focus:outline-hidden focus:border-[#B76E79] transition-colors`}
                        >
                          <option value="">-- Choose Store Location (Required) --</option>
                          {locations.map((loc) => (
                            <option key={loc.id} value={loc.id}>
                              📍 {loc.location_name || loc.name} ({loc.location_code})
                            </option>
                          ))}
                        </select>
                        {locationError && (
                          <p className="text-[11px] text-[#B42318] font-bold mt-1.5 flex items-center gap-1">
                            <CircleAlert className="w-3.5 h-3.5 shrink-0" />
                            <span>Please assign a store location to import customer records.</span>
                          </p>
                        )}
                      </div>

                      {/* Sheet Picker Header & Mode Switcher */}
                      <div className="pt-2 border-t border-[#E8D9D4] space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <label className="text-xs font-black text-[#4A173A]">
                            Select Google Sheet <span className="text-[#B42318]">*</span>
                          </label>

                          <div className="flex items-center gap-2 self-start sm:self-center">
                            <button
                              type="button"
                              onClick={() => setSheetSelectionMode('drive')}
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                                sheetSelectionMode === 'drive'
                                  ? 'bg-[#4A173A] text-white'
                                  : 'bg-[#FFFAF7] border border-[#E8D9D4] text-[#6F5963] hover:text-[#4A173A]'
                              }`}
                            >
                              Choose from Drive
                            </button>
                            <button
                              type="button"
                              onClick={() => setSheetSelectionMode('url')}
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                                sheetSelectionMode === 'url'
                                  ? 'bg-[#4A173A] text-white'
                                  : 'bg-[#FFFAF7] border border-[#E8D9D4] text-[#6F5963] hover:text-[#4A173A]'
                              }`}
                            >
                              Paste Sheet Link / ID
                            </button>
                          </div>
                        </div>

                        {/* Mode A: Drive Spreadsheets List with Search */}
                        {sheetSelectionMode === 'drive' && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <div className="relative flex-1">
                                <Search className="w-4 h-4 text-[#6F5963] absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input
                                  type="text"
                                  placeholder="Search spreadsheets in your Google Drive..."
                                  value={sheetSearchQuery}
                                  onChange={(e) => {
                                    setSheetSearchQuery(e.target.value);
                                    loadSpreadsheets(e.target.value);
                                  }}
                                  className="w-full pl-10 pr-4 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl text-xs font-medium text-[#2B1722] focus:outline-hidden focus:border-[#B76E79]"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => loadSpreadsheets(sheetSearchQuery)}
                                disabled={loadingSheets}
                                className="px-3.5 py-2.5 rounded-xl bg-white border border-[#E8D9D4] hover:bg-[#FFF7F2] text-[#4A173A] text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                              >
                                {loadingSheets ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#B76E79]" />
                                ) : (
                                  <RefreshCw className="w-3.5 h-3.5 text-[#B76E79]" />
                                )}
                                <span>Refresh</span>
                              </button>
                            </div>

                            {/* Spreadsheets Grid */}
                            {loadingSheets ? (
                              <div className="p-8 text-center bg-[#FFFAF7] rounded-xl border border-[#E8D9D4]">
                                <Loader2 className="w-6 h-6 animate-spin text-[#B76E79] mx-auto mb-2" />
                                <p className="text-xs text-[#6F5963]">Fetching spreadsheets from your Google Drive...</p>
                              </div>
                            ) : spreadsheets.length === 0 ? (
                              <div className="p-6 text-center bg-[#FFFAF7] rounded-xl border border-[#E8D9D4] space-y-2">
                                <p className="text-xs text-[#6F5963]">
                                  No spreadsheets found in your Google Drive matching this query.
                                </p>
                                <p className="text-[11px] text-[#6F5963]">
                                  You can also click <strong>"Paste Sheet Link / ID"</strong> above to paste any sheet link directly.
                                </p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
                                {spreadsheets.map((sheet) => {
                                  const isSelected = selectedSpreadsheet?.id === sheet.id;
                                  return (
                                    <div
                                      key={sheet.id}
                                      onClick={() => handleSelectSpreadsheet(sheet)}
                                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start justify-between gap-2 ${
                                        isSelected
                                          ? 'bg-[#F9EEF4] border-[#4A173A] ring-2 ring-[#4A173A]/20'
                                          : 'bg-[#FFFDFC] border-[#E8D9D4] hover:border-[#B76E79] hover:bg-[#FFFAF7]'
                                      }`}
                                    >
                                      <div className="min-w-0 flex items-start gap-2.5">
                                        <svg className="w-5 h-5 shrink-0 mt-0.5" viewBox="0 0 24 24">
                                          <path fill="#0F9D58" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
                                          <path fill="#FFF" d="M14 2v6h6" opacity=".5" />
                                          <path fill="#FFF" d="M8 13h8v2H8zm0 4h8v2H8zm0-8h4v2H8z" />
                                        </svg>
                                        <div className="min-w-0">
                                          <h4 className="text-xs font-black text-[#4A173A] truncate" title={sheet.name}>
                                            {sheet.name}
                                          </h4>
                                          {sheet.lastModified && (
                                            <p className="text-[10px] text-[#6F5963] mt-0.5">
                                              Updated: {formatImportDate(sheet.lastModified)}
                                            </p>
                                          )}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1.5 shrink-0">
                                        {sheet.url && (
                                          <a
                                            href={sheet.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="p-1 rounded-lg hover:bg-white text-[#6F5963] hover:text-[#4A173A] transition-colors"
                                            title="Open in Google Sheets (Read-Only)"
                                          >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                          </a>
                                        )}
                                        {isSelected && (
                                          <span className="w-5 h-5 rounded-full bg-[#4A173A] text-white flex items-center justify-center">
                                            <Check className="w-3 h-3" />
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Mode B: Direct Sheet URL or ID paste */}
                        {sheetSelectionMode === 'url' && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Paste Google Sheet URL (e.g. https://docs.google.com/spreadsheets/d/.../edit) or Sheet ID"
                                value={manualUrl}
                                onChange={(e) => setManualUrl(e.target.value)}
                                className="flex-1 px-4 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl text-xs font-mono text-[#2B1722] focus:outline-hidden focus:border-[#B76E79]"
                              />
                              <button
                                type="button"
                                onClick={handleLoadManualUrl}
                                disabled={loadingDetails || !manualUrl.trim()}
                                className="px-5 py-2.5 rounded-xl bg-[#4A173A] hover:bg-[#6A2853] text-white text-xs font-bold transition-all active:scale-95 disabled:opacity-50 inline-flex items-center gap-1.5"
                              >
                                {loadingDetails ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Link2 className="w-3.5 h-3.5" />
                                )}
                                <span>Load Sheet</span>
                              </button>
                            </div>
                            <span className="text-[10px] text-[#6F5963] block">
                              Make sure the Google account connected above has at least Read access to this spreadsheet.
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Selected Spreadsheet & Worksheet (Tab) Selector */}
                      {selectedSpreadsheet && (
                        <div className="pt-4 border-t border-[#E8D9D4] space-y-3">
                          <div className="p-3.5 rounded-xl bg-[#E8F5EE] border border-[#198754]/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <CircleCheck className="w-4.5 h-4.5 text-[#198754] shrink-0" />
                              <div className="min-w-0">
                                <span className="font-bold text-[#198754] truncate block">
                                  {selectedSpreadsheet.name}
                                </span>
                                <span className="text-[10px] text-[#198754]/80 font-mono">
                                  ID: {selectedSpreadsheet.id}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <a
                                href={
                                  selectedSpreadsheet.url ||
                                  `https://docs.google.com/spreadsheets/d/${selectedSpreadsheet.id}/edit`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] font-bold text-[#198754] hover:underline inline-flex items-center gap-1"
                              >
                                <span>Open Sheet</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>

                          {/* Worksheet / Tab dropdown */}
                          <div className="max-w-md">
                            <label className="block text-xs font-black text-[#4A173A] mb-1.5">
                              Select Worksheet / Tab <span className="text-[#B42318]">*</span>
                            </label>
                            <select
                              value={selectedWorksheet}
                              onChange={(e) => handleWorksheetChange(e.target.value)}
                              disabled={loadingDetails || worksheets.length === 0}
                              className="w-full px-4 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl text-xs font-bold text-[#2B1722] focus:outline-hidden focus:border-[#B76E79]"
                            >
                              {worksheets.map((ws, idx) => (
                                <option key={idx} value={ws.title}>
                                  📄 {ws.title} {ws.rowCount ? `(${ws.rowCount} rows)` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 3. Live Sheet Preview & Pre-validation Card */}
                    {selectedSpreadsheet && selectedWorksheet && (
                      <div className="p-5 sm:p-6 rounded-2xl bg-[#FFFDFC] border border-[#E8D9D4] shadow-xs space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#E8D9D4]">
                          <div>
                            <div className="flex items-center gap-2">
                              <Table className="w-5 h-5 text-[#B76E79]" />
                              <h3 className="text-sm font-black text-[#4A173A]">
                                Worksheet Preview: {selectedWorksheet}
                              </h3>
                            </div>
                            <p className="text-[11px] text-[#6F5963] mt-0.5">
                              Live read-only preview of headers and data rows directly from Google Sheets.
                            </p>
                          </div>

                          <div className="flex items-center gap-2 self-start sm:self-center">
                            <button
                              type="button"
                              onClick={handleRefreshSheetData}
                              disabled={loadingPreview}
                              className="px-3.5 py-2 rounded-xl bg-[#FFF7F2] hover:bg-[#F6E2E5] border border-[#B76E79] text-[#4A173A] text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                              title="Re-read headers and rows from Google Sheets"
                            >
                              {loadingPreview ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#B76E79]" />
                              ) : (
                                <RefreshCw className="w-3.5 h-3.5 text-[#B76E79]" />
                              )}
                              <span>Refresh Sheet Data</span>
                            </button>
                          </div>
                        </div>

                        {loadingPreview ? (
                          <div className="p-10 text-center bg-[#FFFAF7] rounded-xl border border-[#E8D9D4]">
                            <Loader2 className="w-6 h-6 animate-spin text-[#B76E79] mx-auto mb-2" />
                            <p className="text-xs text-[#6F5963]">Reading worksheet data and validating headers...</p>
                          </div>
                        ) : previewError ? (
                          <div className="p-4 rounded-xl bg-[#FDE8E7] border border-[#B42318]/30 text-[#B42318] text-xs space-y-2">
                            <div className="flex items-center gap-2 font-bold">
                              <CircleAlert className="w-4 h-4 shrink-0" />
                              <span>Unable to preview worksheet</span>
                            </div>
                            <p className="text-[11px] leading-relaxed">{previewError}</p>
                            <button
                              type="button"
                              onClick={handleRefreshSheetData}
                              className="px-3 py-1.5 rounded-lg bg-white border border-[#B42318]/30 font-bold text-[11px] hover:bg-[#FDE8E7]"
                            >
                              Retry
                            </button>
                          </div>
                        ) : previewData ? (
                          <div className="space-y-4">
                            {/* Header Validation Banner */}
                            {previewData.headerValidation.isValid ? (
                              <div className="p-3.5 rounded-xl bg-[#E8F5EE] border border-[#198754]/30 text-[#198754] text-xs flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <CircleCheck className="w-4 h-4 shrink-0" />
                                  <div>
                                    <span className="font-bold">Header Validation Passed: </span>
                                    <span>
                                      Required headers <strong className="font-mono">customer_name</strong> and{' '}
                                      <strong className="font-mono">mobile_number</strong> detected in Row 1.
                                    </span>
                                  </div>
                                </div>
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-[#198754] text-white shrink-0">
                                  Valid Schema
                                </span>
                              </div>
                            ) : (
                              <div className="p-3.5 rounded-xl bg-[#FDE8E7] border border-[#B42318]/30 text-[#B42318] text-xs flex items-start gap-2.5">
                                <CircleAlert className="w-4 h-4 text-[#B42318] shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold">Header Validation Error: </span>
                                  <span>
                                    Row 1 is missing required columns:{' '}
                                    <strong className="font-mono">
                                      {previewData.headerValidation.missingHeaders.join(', ')}
                                    </strong>
                                    . Please add these columns in your Google Sheet before importing.
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Detected Columns Tags */}
                            <div className="p-3 bg-[#FFFAF7] rounded-xl border border-[#E8D9D4] space-y-1.5">
                              <span className="text-[10px] font-black text-[#4A173A] uppercase tracking-wider block">
                                Detected Columns in Google Sheet ({previewData.headerValidation.canonicalHeaders.length}):
                              </span>
                              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                {previewData.headerValidation.canonicalHeaders.map((col, idx) => {
                                  const isRequired = col === 'customer_name' || col === 'mobile_number';
                                  const isStandard = COLUMN_SPECS.some((c) => c.name === col);
                                  return (
                                    <span
                                      key={idx}
                                      className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                                        isRequired
                                          ? 'bg-[#198754] text-white'
                                          : isStandard
                                          ? 'bg-[#FFFDFC] text-[#4A173A] border border-[#E8D9D4]'
                                          : 'bg-[#FFF4D6] text-[#855D00] border border-[#C58A18]/30'
                                      }`}
                                    >
                                      {col} {isRequired ? '★' : ''}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Data Rows Preview Table */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-[11px] text-[#6F5963]">
                                <span>
                                  Showing first <strong>{previewData.previewRows.length}</strong> of{' '}
                                  <strong>{previewData.totalRows}</strong> rows in worksheet
                                </span>
                                <span className="font-mono text-[10px] text-[#6F5963]">
                                  Source: Read-Only (no modifications to Google Sheet)
                                </span>
                              </div>

                              <div className="overflow-x-auto table-sticky-head rounded-xl border border-[#E8D9D4] max-h-72">
                                <table className="w-full text-left text-[11px]">
                                  <thead className="bg-[#F8EDE8] sticky top-0 z-10">
                                    <tr className="border-b border-[#E8D9D4] text-[#4A173A] font-black">
                                      <th className="py-2.5 px-3">Row</th>
                                      <th className="py-2.5 px-3">Status</th>
                                      <th className="py-2.5 px-3">Customer Name</th>
                                      <th className="py-2.5 px-3">Mobile Number</th>
                                      <th className="py-2.5 px-3">Email</th>
                                      <th className="py-2.5 px-3">Wedding Date</th>
                                      <th className="py-2.5 px-3">Category</th>
                                      <th className="py-2.5 px-3">Budget</th>
                                      <th className="py-2.5 px-3">Telecaller</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#EADBD7] text-[#2B1722] bg-[#FFFDFC]">
                                    {previewData.previewRows.map((r, idx) => (
                                      <tr
                                        key={idx}
                                        className={`transition-colors ${
                                          !r.isValid ? 'bg-[#FDE8E7]/40 hover:bg-[#FDE8E7]/70' : 'hover:bg-[#FFF7F2]'
                                        }`}
                                      >
                                        <td className="py-2 px-3 font-mono font-bold text-[#6F5963]">
                                          #{r.rowNumber}
                                        </td>
                                        <td className="py-2 px-3 whitespace-nowrap">
                                          {r.isValid ? (
                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-[#E8F5EE] text-[#198754]">
                                              Valid
                                            </span>
                                          ) : (
                                            <span
                                              className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-[#FDE8E7] text-[#B42318]"
                                              title={r.errors.join('; ')}
                                            >
                                              {r.errors[0] || 'Error'}
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-2 px-3 font-medium text-[#4A173A]">
                                          {r.data.customer_name || '—'}
                                        </td>
                                        <td className="py-2 px-3 font-mono">
                                          {r.data.mobile_number || '—'}
                                        </td>
                                        <td className="py-2 px-3 text-[#6F5963]">{r.data.email || '—'}</td>
                                        <td className="py-2 px-3 font-mono text-[#6F5963]">
                                          {r.data.wedding_date || '—'}
                                        </td>
                                        <td className="py-2 px-3">{r.data.preferred_shopping_category || '—'}</td>
                                        <td className="py-2 px-3 font-mono">
                                          {r.data.budget_min || r.data.budget_max
                                            ? `₹${r.data.budget_min || '0'} - ₹${r.data.budget_max || '0'}`
                                            : '—'}
                                        </td>
                                        <td className="py-2 px-3 text-[#6F5963]">
                                          {r.data.assigned_telecaller || '—'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* Import Action & Progress Indicator */}
                            <div className="pt-4 border-t border-[#E8D9D4] space-y-4">
                              {googleImporting && (
                                <div className="p-4 rounded-xl bg-[#FFFAF7] border border-[#B76E79]/40 space-y-2.5">
                                  <div className="flex items-center justify-between text-xs font-bold text-[#4A173A]">
                                    <span className="flex items-center gap-2">
                                      <Loader2 className="w-4 h-4 animate-spin text-[#B76E79]" />
                                      <span>
                                        {importStep === 'preparing' && 'Preparing import...'}
                                        {importStep === 'reading' && 'Reading Google Sheet data...'}
                                        {importStep === 'validating' && 'Validating customer records & duplicate check...'}
                                        {importStep === 'importing' && 'Writing customer records into CRM database...'}
                                        {importStep === 'completed' && 'Import complete!'}
                                      </span>
                                    </span>
                                    <span className="font-mono">{importProgressPercent}%</span>
                                  </div>

                                  <div className="w-full bg-[#E8D9D4] h-2 rounded-full overflow-hidden">
                                    <div
                                      className="bg-[#4A173A] h-full transition-all duration-300 ease-out"
                                      style={{ width: `${importProgressPercent}%` }}
                                    />
                                  </div>
                                </div>
                              )}

                              <div className="flex flex-wrap items-center gap-3">
                                <button
                                  type="button"
                                  id="btn-import-google-sheet"
                                  onClick={handleGoogleImport}
                                  disabled={
                                    googleImporting ||
                                    !previewData.headerValidation.isValid ||
                                    !locationId ||
                                    previewData.totalRows === 0
                                  }
                                  className="px-8 py-3.5 rounded-xl bg-[#4A173A] hover:bg-[#6A2853] text-white font-black text-xs shadow-md border border-[#4A173A] flex items-center gap-2.5 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  {googleImporting ? (
                                    <>
                                      <Loader2 className="w-4 h-4 animate-spin text-[#B76E79]" />
                                      <span>Importing Google Sheet Records...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Download className="w-4 h-4 text-[#E8C7A8]" />
                                      <span>Import Valid Rows from Google Sheet</span>
                                    </>
                                  )}
                                </button>

                                <span className="text-[11px] text-[#6F5963]">
                                  Target: <strong>{previewData.totalRows}</strong> rows to validate & import into{' '}
                                  <strong>
                                    {locations.find((l) => String(l.id) === String(locationId))?.location_name ||
                                      'Selected Store'}
                                  </strong>
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : (
                  /* If not connected, show prominent prompt */
                  <div className="p-8 sm:p-12 text-center bg-[#FFFAF7] rounded-2xl border border-[#E8D9D4] space-y-4">
                    <div className="w-16 h-16 rounded-3xl bg-white border border-[#E8D9D4] shadow-xs flex items-center justify-center mx-auto">
                      <svg className="w-10 h-10" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                    </div>

                    <div className="max-w-md mx-auto space-y-1">
                      <h3 className="text-base font-black text-[#4A173A]">Connect to Google Sheets</h3>
                      <p className="text-xs text-[#6F5963] leading-relaxed">
                        Authorize the CRM with read-only access to select your spreadsheets, preview records,
                        validate mobile numbers, and import directly without manual file downloads.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleConnectGoogle}
                      disabled={connectingGoogle}
                      className="px-6 py-3 rounded-xl bg-[#4A173A] hover:bg-[#6A2853] text-white text-xs font-black shadow-md transition-all active:scale-95 inline-flex items-center gap-2"
                    >
                      {connectingGoogle ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[#B76E79]" />
                      ) : (
                        <Globe className="w-4 h-4 text-[#E8C7A8]" />
                      )}
                      <span>Connect Google Account</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════════
                MODE 2: EXISTING FILE UPLOAD (.CSV / .XLSX)
               ══════════════════════════════════════════════════════════════════════════ */}
            {importMode === 'file' && (
              <div className="space-y-6">
                {/* Companion Guidance & Format Legend Card */}
                <div className="p-4 sm:p-5 rounded-2xl bg-[#FFFAF7] border border-[#E8D9D4] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-black text-[#4A173A] uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#B76E79]" />
                      <span>Column Specification & Legend</span>
                    </span>
                    <span className="text-[11px] font-medium text-[#6F5963]">
                      Exact Row 1 headers · {COLUMN_SPECS.filter((c) => c.required).length} required ·{' '}
                      {COLUMN_SPECS.filter((c) => !c.required).length} optional · max {MAX_IMPORT_ROWS} rows
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                    {COLUMN_SPECS.map((col) => (
                      <div
                        key={col.name}
                        className={`p-2.5 rounded-xl border space-y-1 ${
                          col.required ? 'bg-[#FDE8E7] border-[#B42318]/30' : 'bg-[#FFFDFC] border-[#E8D9D4]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`font-mono text-[11px] font-black break-all ${
                              col.required ? 'text-[#B42318]' : 'text-[#4A173A]'
                            }`}
                          >
                            {col.name}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase shrink-0 ${
                              col.required ? 'bg-[#B42318] text-white' : 'bg-[#E8F5EE] text-[#198754]'
                            }`}
                          >
                            {col.required ? 'Required' : 'Optional'}
                          </span>
                        </div>
                        <p className={`text-[11px] ${col.required ? 'text-[#B42318]' : 'text-[#2B1722]'}`}>{col.hint}</p>
                        <p className="text-[10px] text-[#6F5963] font-mono italic break-words">
                          {col.format ? `${col.format} · ` : ''}e.g. {col.example}
                        </p>
                      </div>
                    ))}
                  </div>

                  <p className="text-[11px] text-[#6F5963] leading-relaxed">
                    <span className="font-black text-[#4A173A]">Legacy headers still accepted:</span> name, phone,
                    alternate_number, email_id, marriage_date, expected_visit_date, preferred_collection, estimated_members,
                    budget, budget_range, store_location, followup_call_date, notes, telecaller.
                  </p>
                </div>

                {/* Import Form */}
                <form onSubmit={handleImport} className="space-y-6 max-w-2xl">
                  {/* Store Location Selection */}
                  <div>
                    <label className="block text-xs font-black text-[#4A173A] mb-1.5">
                      Assign Store Location <span className="text-[#B42318]">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={locationId}
                        disabled={!session?.isGlobalAdmin}
                        onChange={(e) => {
                          setLocationId(e.target.value);
                          if (e.target.value) setLocationError(false);
                        }}
                        className={`w-full px-4 py-3 bg-[#FFFAF7] border ${
                          locationError ? 'border-[#B42318] ring-2 ring-[#B42318]/20' : 'border-[#E8D9D4]'
                        } rounded-xl font-bold text-xs text-[#2B1722] focus:outline-hidden focus:border-[#B76E79] transition-colors`}
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
                      <p className="text-[11px] text-[#B42318] font-bold mt-1.5 flex items-center gap-1">
                        <CircleAlert className="w-3.5 h-3.5 shrink-0" />
                        <span>Please assign a store location to import customer records.</span>
                      </p>
                    )}
                    <span className="text-[11px] text-[#6F5963] block mt-1">
                      Default branch for records where "store_location" is not specified in the file.
                    </span>
                  </div>

                  {/* File Input */}
                  <div>
                    <label className="block text-xs font-black text-[#4A173A] mb-1.5">
                      Select Customer File (.csv or .xlsx) <span className="text-[#B42318]">*</span>
                    </label>
                    <div className="relative">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv, .xlsx, .xls"
                        disabled={uploading}
                        onClick={(e) => {
                          (e.target as HTMLInputElement).value = '';
                        }}
                        onChange={handleFileChange}
                        className="w-full p-3.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-2xl file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-[#4A173A] file:text-white hover:file:bg-[#6A2853] cursor-pointer text-xs font-medium text-[#2B1722] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>

                    {/* File Error Alert */}
                    {fileError && (
                      <div className="mt-2.5 p-3 rounded-xl bg-[#FDE8E7] border border-[#B42318]/30 text-[#B42318] text-xs flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <CircleAlert className="w-4 h-4 text-[#B42318] shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">File Validation Error: </span>
                            <span>{fileError}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={clearSelectedFile}
                          className="text-[11px] font-bold text-[#B42318] hover:underline shrink-0"
                        >
                          Clear
                        </button>
                      </div>
                    )}

                    {/* File Ready Confirmation & Controls */}
                    {file && !fileError && (
                      <div className="mt-2.5 p-3.5 rounded-xl bg-[#E8F5EE] border border-[#198754]/30 text-[#198754] text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <CircleCheck className="w-4.5 h-4.5 text-[#198754] shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-[#198754] truncate max-w-[280px]" title={file.name}>
                                {file.name}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#198754]/15 text-[#198754] font-bold uppercase">
                                {file.name.toLowerCase().endsWith('.csv') ? 'CSV' : 'Excel (.xlsx)'}
                              </span>
                              <span className="text-[10px] font-mono text-[#198754]/80">
                                {formatFileSize(file.size)}
                              </span>
                            </div>
                            {filePreviewCount !== null && (
                              <p className="text-[11px] text-[#198754] mt-0.5">
                                {filePreviewCount} customer {filePreviewCount === 1 ? 'row' : 'rows'} detected & validated
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            disabled={uploading}
                            onClick={() => fileInputRef.current?.click()}
                            className="px-2.5 py-1.5 rounded-lg bg-white border border-[#198754]/40 hover:bg-[#E8F5EE] text-[#198754] font-bold text-[11px] inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                            title="Replace currently selected file"
                          >
                            <RefreshCw className="w-3 h-3 text-[#198754]" />
                            <span>Replace File</span>
                          </button>
                          <button
                            type="button"
                            disabled={uploading}
                            onClick={clearSelectedFile}
                            className="px-2 py-1.5 rounded-lg bg-white border border-[#B42318]/30 hover:bg-[#FDE8E7] text-[#B42318] font-bold text-[11px] inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                            title="Remove file"
                          >
                            <Trash2 className="w-3 h-3 text-[#B42318]" />
                            <span>Remove</span>
                          </button>
                          <span className="text-[10px] uppercase font-black px-2 py-1 rounded bg-[#198754] text-white tracking-wide">
                            Ready
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={uploading || !file || !locationId || !!fileError}
                      className="px-8 py-3.5 rounded-xl bg-[#4A173A] hover:bg-[#6A2853] text-white font-black text-xs shadow-md border border-[#4A173A] flex items-center gap-2.5 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-[#B76E79]" />
                          <span>Processing & Importing Customer Records...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 text-[#E8C7A8]" />
                          <span>Start Bulk Import</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════════
                POST-IMPORT EXECUTION SUMMARY (Common for File & Google Sheets)
               ══════════════════════════════════════════════════════════════════════════ */}
            {importResult && (
              <div className="p-5 sm:p-6 rounded-2xl bg-[#FFFDFC] border border-[#E8D9D4] shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-[#E8D9D4]">
                  <div className="flex items-center gap-2">
                    {importedCount > 0 ? (
                      <CheckCircle2 className="w-5 h-5 text-[#198754] shrink-0" />
                    ) : errorCount > 0 ? (
                      <XCircle className="w-5 h-5 text-[#B42318] shrink-0" />
                    ) : (
                      <Info className="w-5 h-5 text-[#C58A18] shrink-0" />
                    )}
                    <div>
                      <h3 className="font-black text-sm text-[#4A173A]">
                        Import Execution Summary
                      </h3>
                      <div className="text-[11px] text-[#6F5963] mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>
                          Source:{' '}
                          <strong className="text-[#4A173A]">
                            {importResult.sheetTitle
                              ? `${importResult.sheetTitle} (${importResult.sheetName})`
                              : importResult.fileName || lastFileName || file?.name || 'File'}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          Branch:{' '}
                          <strong className="text-[#4A173A]">
                            {importResult.storeBranch ||
                              locations.find((l) => String(l.id) === String(locationId))?.location_name ||
                              'Selected Store'}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          Processing Time:{' '}
                          <strong className="text-[#4A173A]">{importResult.processingTime || '< 1s'}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <span className="text-xs font-bold text-[#4A173A] bg-[#FFF7F2] px-3 py-1.5 rounded-xl border border-[#E8D9D4] self-start sm:self-center">
                    {importedCount} imported · {duplicateCount} duplicates · {errorCount} failed
                  </span>
                </div>

                {/* Metric Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-[#E8F5EE] border border-[#198754]/30">
                    <span className="text-[11px] font-bold text-[#198754] uppercase tracking-wider block">
                      Successfully Imported
                    </span>
                    <span className="text-xl font-black text-[#198754] mt-1 block">{importedCount}</span>
                    <span className="text-[10px] text-[#198754] block mt-0.5">of {totalRowsCount} total rows</span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#FFF4D6] border border-[#C58A18]/30">
                    <span className="text-[11px] font-bold text-[#C58A18] uppercase tracking-wider block">
                      Duplicate Rows
                    </span>
                    <span className="text-xl font-black text-[#C58A18] mt-1 block">{duplicateCount}</span>
                    <span className="text-[10px] text-[#C58A18] block mt-0.5">skipped (not overwritten)</span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#FDE8E7] border border-[#B42318]/30">
                    <span className="text-[11px] font-bold text-[#B42318] uppercase tracking-wider block">
                      Failed Rows
                    </span>
                    <span className="text-xl font-black text-[#B42318] mt-1 block">{errorCount}</span>
                    <span className="text-[10px] text-[#B42318] block mt-0.5">validation failed</span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#EDE7F6] border border-[#6A2853]/20">
                    <span className="text-[11px] font-bold text-[#6A2853] uppercase tracking-wider block">
                      Total Processed
                    </span>
                    <span className="text-xl font-black text-[#6A2853] mt-1 block">{totalRowsCount}</span>
                    <span className="text-[10px] text-[#6A2853] block mt-0.5">
                      time: {importResult.processingTime || '< 1s'}
                    </span>
                  </div>
                </div>

                {/* Actions: Download Failed Rows + rerun */}
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  {notImportedRows.length > 0 && (
                    <button
                      type="button"
                      onClick={handleDownloadErrorReport}
                      disabled={downloadingReport}
                      className="text-xs font-black inline-flex items-center gap-1.5 bg-[#B42318] text-white px-4 py-2.5 rounded-xl hover:bg-[#8B1A12] transition-colors disabled:opacity-60 shadow-xs"
                    >
                      {downloadingReport ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                      ) : (
                        <FileDown className="w-3.5 h-3.5 text-white" />
                      )}
                      <span>Download Failed Rows (.xlsx)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setImportResult(null);
                      setShowErrorDetails(false);
                      setShowWarningDetails(false);
                      if (importMode === 'file') {
                        setFile(null);
                        setFileError(null);
                        setFilePreviewCount(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                          fileInputRef.current.click();
                        }
                      } else {
                        // Refresh current google sheet
                        handleRefreshSheetData();
                      }
                    }}
                    className="text-xs font-black inline-flex items-center gap-1.5 bg-[#FFFDFC] text-[#4A173A] border border-[#E8D9D4] px-3.5 py-2.5 rounded-xl hover:bg-[#FFF7F2] transition-colors shadow-2xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[#B76E79]" />
                    <span>Run Another Import</span>
                  </button>
                </div>

                {/* Errors Detail Section (Always visible/expanded when errors exist) */}
                {notImportedRows.length > 0 && (
                  <div className="space-y-3 pt-3 border-t border-[#E8D9D4]">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 bg-[#FDE8E7] p-3.5 rounded-xl border border-[#B42318]/30">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CircleAlert className="w-5 h-5 text-[#B42318] shrink-0" />
                        <div>
                          <h4 className="text-xs font-black text-[#B42318]">
                            Failed Rows & Validation Error Details ({notImportedRows.length} rows not imported)
                          </h4>
                          <p className="text-[11px] text-[#B42318]/80 mt-0.5">
                            Each failed row is listed below with its row number, customer name, mobile, and exact validation reason.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                        <button
                          type="button"
                          onClick={() => setShowErrorDetails(!showErrorDetails)}
                          className="px-3.5 py-1.5 rounded-lg bg-white border border-[#B42318]/40 hover:bg-[#FDE8E7] text-[#B42318] font-black text-xs inline-flex items-center gap-1.5 transition-colors shadow-2xs"
                        >
                          <span>{showErrorDetails ? 'Collapse Error Details' : 'Expand Error Details'}</span>
                          {showErrorDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {showErrorDetails && (
                      <div className="space-y-2.5">
                        {notImportedRows.length > 5 && (
                          <div className="relative">
                            <Search className="w-4 h-4 text-[#6F5963] absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              placeholder="Search in error list by customer, mobile, row number, or error reason..."
                              value={errorSearchQuery}
                              onChange={(e) => setErrorSearchQuery(e.target.value)}
                              className="w-full pl-9 pr-4 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl text-xs font-medium text-[#2B1722] focus:outline-hidden focus:border-[#B42318]"
                            />
                          </div>
                        )}

                        <div className="max-h-80 overflow-y-auto table-sticky-head rounded-xl border border-[#B42318]/30 bg-[#FFFDFC] text-xs shadow-2xs">
                          <table className="w-full text-left">
                            <thead className="bg-[#FDE8E7] sticky top-0 z-10">
                              <tr className="border-b border-[#B42318]/20 text-[#B42318] text-[11px] font-black">
                                <th className="py-2.5 px-3">Row #</th>
                                <th className="py-2.5 px-3">Customer Name</th>
                                <th className="py-2.5 px-3">Mobile Number</th>
                                <th className="py-2.5 px-3">Validation Failure Reason</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#EADBD7] text-[11px]">
                              {notImportedRows
                                .filter((err) => {
                                  if (!errorSearchQuery.trim()) return true;
                                  const q = errorSearchQuery.toLowerCase().trim();
                                  return (
                                    String(err.row || '').includes(q) ||
                                    String(err.customerName || (err as any).customer_name || (err as any).name || '').toLowerCase().includes(q) ||
                                    String(err.mobile || (err as any).mobile_number || (err as any).phone || '').includes(q) ||
                                    String(err.reason || (err as any).error || (err as any).message || '').toLowerCase().includes(q)
                                  );
                                })
                                .map((err, idx) => (
                                  <tr key={idx} className="hover:bg-[#FDE8E7]/40 transition-colors">
                                    <td className="py-2 px-3 font-mono font-bold text-[#B42318] whitespace-nowrap">
                                      {err.row > 0 ? `Row ${err.row}` : (err as any).rowNo ? `Row ${(err as any).rowNo}` : `#${idx + 2}`}
                                    </td>
                                    <td className="py-2 px-3 font-medium text-[#2B1722]">
                                      {err.customerName || (err as any).customer_name || (err as any).name || '—'}
                                    </td>
                                    <td className="py-2 px-3 font-mono text-[#2B1722]">
                                      {err.mobile || (err as any).mobile_number || (err as any).phone || '—'}
                                    </td>
                                    <td className="py-2 px-3 text-[#B42318] font-medium leading-relaxed">
                                      {err.reason || (err as any).error || (err as any).message || 'Validation failed'}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
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
                      className="text-xs font-bold text-[#6A2853] hover:underline flex items-center gap-1.5"
                    >
                      <span>
                        {showWarningDetails ? 'Hide' : 'View'} {importResult.warnings.length} Warning
                        {importResult.warnings.length === 1 ? '' : 's'} (rows still imported)
                      </span>
                      {showWarningDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {showWarningDetails && (
                      <div className="max-h-48 overflow-y-auto table-sticky-head rounded-xl border border-[#6A2853]/20 bg-[#EDE7F6] p-3 text-xs">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-[#6A2853]/20 text-[#6A2853] text-[11px] font-black">
                              <th className="pb-1.5 pr-2">Row #</th>
                              <th className="pb-1.5 px-2">Customer</th>
                              <th className="pb-1.5 px-2">Mobile</th>
                              <th className="pb-1.5 pl-2">Warning</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#6A2853]/10 text-[11px] text-[#6A2853] font-medium">
                            {(importResult.warnings || []).map((warn, idx) => (
                              <tr key={idx}>
                                <td className="py-1.5 pr-2 font-mono font-bold text-[#6A2853]">
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
                      className="text-xs font-black text-[#4A173A] hover:text-[#6A2853] flex items-center gap-1.5 transition-colors underline"
                    >
                      <span>Open Customer Register to view imported records →</span>
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════════
                IMPORT HISTORY TABLE (Includes File & Google Sheets imports)
               ══════════════════════════════════════════════════════════════════════════ */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#FFFDFC] border border-[#E8D9D4] shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-black text-[#4A173A] uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-[#B76E79]" />
                  <span>Import History</span>
                </span>
                <div className="flex items-center gap-3">
                  {importLogs.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearLogs}
                      disabled={clearingLogs}
                      className="text-[11px] font-bold text-[#B42318] hover:text-[#8B1A12] inline-flex items-center gap-1 underline disabled:opacity-60 cursor-pointer"
                    >
                      {clearingLogs && <Loader2 className="w-3 h-3 animate-spin" />}
                      Clear All History
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={loadImportLogs}
                    disabled={logsLoading}
                    className="text-[11px] font-bold text-[#4A173A] hover:text-[#6A2853] inline-flex items-center gap-1.5 underline disabled:opacity-60 cursor-pointer"
                  >
                    {logsLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#B76E79]" />}
                    Refresh History
                  </button>
                </div>
              </div>

              {importLogs.length === 0 ? (
                <p className="text-[11px] text-[#6F5963] py-2">
                  No imports recorded for your stores yet.
                </p>
              ) : (
                <div className="table-frame custom-scrollbar rounded-xl border border-[#E8D9D4]">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-[#F8EDE8]">
                      <tr className="border-b border-[#E8D9D4] text-[#4A173A] font-black">
                        <th className="py-2.5 pr-3 pl-3">When</th>
                        <th className="py-2.5 px-3">Source</th>
                        <th className="py-2.5 px-3">File / Sheet</th>
                        <th className="py-2.5 px-3">Store</th>
                        <th className="py-2.5 px-3">By</th>
                        <th className="py-2.5 px-3 text-right">Rows</th>
                        <th className="py-2.5 px-3 text-right">Imported</th>
                        <th className="py-2.5 px-3 text-right">Dupes</th>
                        <th className="py-2.5 px-3 text-right">Errors</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 pl-3 pr-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EADBD7] text-[#2B1722] bg-[#FFFDFC]">
                      {importLogs.map((log) => {
                        const isGoogleSheet =
                          log.file_type === 'google_sheets' ||
                          String(log.file_name || '').toLowerCase().endsWith('.gsheet');

                        return (
                          <tr key={log.id} className="hover:bg-[#FFF1F2] transition-colors">
                            <td className="py-2 pr-3 pl-3 font-mono whitespace-nowrap text-[#6F5963]">
                              {formatImportDate(log.created_at || (log as any).uploaded_at)}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              {isGoogleSheet ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-[#E8F5EE] text-[#0F9D58] border border-[#0F9D58]/20">
                                  <svg className="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24">
                                    <path fill="#0F9D58" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
                                    <path fill="#FFF" d="M14 2v6h6" opacity=".5" />
                                    <path fill="#FFF" d="M8 13h8v2H8zm0 4h8v2H8zm0-8h4v2H8z" />
                                  </svg>
                                  <span>Google Sheet</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-[#FFF7F2] text-[#4A173A] border border-[#E8D9D4]">
                                  <FileSpreadsheet className="w-2.5 h-2.5 text-[#B76E79]" />
                                  <span>File</span>
                                </span>
                              )}
                            </td>
                            <td
                              className="py-2 px-3 font-medium max-w-[200px] truncate text-[#4A173A]"
                              title={log.file_name}
                            >
                              {log.file_name || '—'}
                            </td>
                            <td className="py-2 px-3 text-[#6F5963]">
                              {log.location_name || (log.location_id ? `#${log.location_id}` : 'All')}
                            </td>
                            <td className="py-2 px-3 font-semibold text-[#2B1722]">{log.user_name || '—'}</td>
                            <td className="py-2 px-3 text-right font-mono text-[#6F5963]">{log.total_rows ?? 0}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-[#198754]">
                              {log.imported_count ?? 0}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-[#C58A18] font-bold">
                              {log.duplicate_count ?? 0}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-[#B42318]">
                              {log.error_count ?? 0}
                            </td>
                            <td className="py-2 px-3">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                  String(log.status || '')
                                    .toLowerCase()
                                    .replace(/[\s-]+/g, '_') === 'completed_with_errors'
                                    ? 'bg-[#FFF4D6] text-[#C58A18]'
                                    : String(log.status || '')
                                        .toLowerCase()
                                        .replace(/[\s-]+/g, '_') === 'failed'
                                    ? 'bg-[#FDE8E7] text-[#B42318]'
                                    : 'bg-[#E8F5EE] text-[#198754]'
                                }`}
                              >
                                {String(log.status || 'Completed').replace(/[\s-]+/g, ' ')}
                              </span>
                            </td>
                            <td className="py-2 pl-3 pr-3 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleDeleteLog(log.id, log.file_name)}
                                disabled={deletingLogId === log.id}
                                className="p-1 rounded-lg hover:bg-[#FDE8E7] text-[#6F5963] hover:text-[#B42318] transition-colors cursor-pointer disabled:opacity-50"
                                title="Delete this import history record"
                                aria-label="Delete import log"
                              >
                                {deletingLogId === log.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#B42318]" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="text-[10px] text-[#6F5963]">
                Same history is available under Wedding → Reports → Import History.
              </p>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════════
            ADMIN MODAL: CONFIGURE GOOGLE CLOUD OAUTH CREDENTIALS
           ══════════════════════════════════════════════════════════════════════════ */}
        {showConfigModal && (
          <div className="fixed inset-0 z-50 bg-[#2B1722]/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-[#FFFDFC] rounded-3xl border border-[#E8D9D4] shadow-2xl max-w-lg w-full p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-[#E8D9D4]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#FFF7F2] border border-[#B76E79] flex items-center justify-center">
                    <Lock className="w-4 h-4 text-[#4A173A]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[#4A173A]">Configure Google Cloud OAuth</h3>
                    <p className="text-[11px] text-[#6F5963]">Admin setting for Google Sheets integration</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="p-1.5 rounded-lg hover:bg-[#FFFAF7] text-[#6F5963] hover:text-[#4A173A]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Instructions */}
              <div className="p-3.5 rounded-xl bg-[#FFFAF7] border border-[#E8D9D4] text-xs text-[#2B1722] space-y-2">
                <span className="font-black text-[#4A173A] block">Setup Instructions:</span>
                <ol className="list-decimal list-inside text-[11px] text-[#6F5963] space-y-1">
                  <li>Open Google Cloud Console &gt; APIs & Services &gt; Credentials</li>
                  <li>Enable "Google Sheets API" and "Google Drive API"</li>
                  <li>Create OAuth 2.0 Client ID (Web Application)</li>
                  <li>
                    Add Authorized redirect URI:
                    <span className="font-mono text-[10px] text-[#4A173A] bg-white px-1.5 py-0.5 rounded border border-[#E8D9D4] block mt-0.5 break-all select-all">
                      {typeof window !== 'undefined'
                        ? `${window.location.origin}/api/wedding-crm/google/callback`
                        : '/api/wedding-crm/google/callback'}
                    </span>
                  </li>
                  <li>Paste the Client ID and Client Secret below and click Save.</li>
                </ol>
              </div>

              <form onSubmit={handleSaveGoogleConfig} className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-[#4A173A] mb-1">
                    Google Client ID <span className="text-[#B42318]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={configClientId}
                    onChange={(e) => setConfigClientId(e.target.value)}
                    placeholder="e.g. 1234567890-abcdef.apps.googleusercontent.com"
                    className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl text-xs font-mono text-[#2B1722] focus:outline-hidden focus:border-[#B76E79]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-[#4A173A] mb-1">
                    Google Client Secret <span className="text-[#B42318]">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={configClientSecret}
                    onChange={(e) => setConfigClientSecret(e.target.value)}
                    placeholder="GOCSPX-..."
                    className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl text-xs font-mono text-[#2B1722] focus:outline-hidden focus:border-[#B76E79]"
                  />
                  <span className="text-[10px] text-[#6F5963] mt-1 block">
                    Credentials are stored securely in database settings and never exposed to client browsers.
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowConfigModal(false)}
                    className="px-4 py-2 rounded-xl bg-white border border-[#E8D9D4] text-xs font-bold text-[#6F5963] hover:text-[#4A173A]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingConfig}
                    className="px-5 py-2 rounded-xl bg-[#4A173A] hover:bg-[#6A2853] text-white text-xs font-black transition-all active:scale-95 disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    {savingConfig && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Save Credentials</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </PageContainer>
    </DashboardLayout>
  );
}
