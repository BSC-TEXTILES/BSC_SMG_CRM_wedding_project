import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import PageContainer from '../../components/ui/PageContainer';
import ToastContainer, { showToast } from '../../components/Toast';
import { API, Auth, UserSession } from '../../services/api';
import WeddingNav from './WeddingNav';
import LocationFilterSelect from '../../components/ui/LocationFilterSelect';
import { Download, RefreshCw, History, FileText, Loader2, Trash2 } from 'lucide-react';

export default function WeddingReports() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(() => Auth.get());
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState('conversion');
  const [locationFilter, setLocationFilter] = useState<number | ''>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('bsc_selected_location') : null;
    return saved && saved !== 'ALL' ? Number(saved) : '';
  });
  const [locations, setLocations] = useState<any[]>([]);

  // Listen to global location changes (e.g. from Topbar)
  useEffect(() => {
    const handleLocChange = (e: any) => {
      const locId = e?.detail?.locationId;
      const parsed = locId && locId !== 'ALL' ? Number(locId) : '';
      setLocationFilter(parsed);
    };
    window.addEventListener('bsc_location_changed', handleLocChange);
    return () => window.removeEventListener('bsc_location_changed', handleLocChange);
  }, []);

  const [reportData, setReportData] = useState<any>(null);
  const [telecallerPerf, setTelecallerPerf] = useState<any[]>([]);
  const [importLogs, setImportLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const loadImportLogs = useCallback(async () => {
    if (!API.getWeddingImportLogs) return;
    setLogsLoading(true);
    try {
      const res = await API.getWeddingImportLogs(20);
      const list = res?.imports || res?.data?.imports || [];
      if (Array.isArray(list)) setImportLogs(list);
    } catch (err: any) {
      console.warn('Failed to load import history', err?.message || err);
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

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const [repRes, perfRes, locsRes] = await Promise.all([
        API.getWeddingReports(reportType, locationFilter !== '' ? locationFilter : undefined),
        API.getWeddingEmployeePerformance(locationFilter !== '' ? locationFilter : undefined).catch(() => null),
        API.getLocations().catch(() => ({ locations: [] }))
      ]);

      if (locsRes?.locations) setLocations(locsRes.locations);
      if (repRes?.data) setReportData(repRes.data);
      if (perfRes?.data) setTelecallerPerf(Array.isArray(perfRes.data) ? perfRes.data : []);
    } catch (err: any) {
      showToast('Error loading reports: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [reportType, locationFilter]);

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    const sess = Auth.get();
    setSession(sess);
    if (sess?.locationId && !sess.isGlobalAdmin) {
      setLocationFilter(sess.locationId);
    }
    loadReport();
    loadImportLogs();
  }, [loadReport, loadImportLogs, navigate]);

  const handleExport = () => {
    if (!telecallerPerf || telecallerPerf.length === 0) {
      showToast('No report records to export', 'error');
      return;
    }

    const rows = telecallerPerf.map((p) => ({
      'Telecaller Name': p.name || p.telecaller_name,
      'Location': p.location_name || '',
      'Total Calls Made': p.total_calls || 0,
      'Connected Calls': p.connected || 0,
      'Confirmed Shopping': p.confirmed || 0,
      'Converted Won': p.converted || 0,
      'Conversion Rate': p.total_calls ? `${Math.round(((p.converted || 0) / p.total_calls) * 100)}%` : '0%'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Telecaller Performance');
    XLSX.writeFile(wb, `BSC_Wedding_Performance_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('Report exported to Excel', 'success');
  };

  return (
    <DashboardLayout title="Wedding CRM Reports">
      <PageContainer maxWidth="full">
        <ToastContainer />
        <div className="space-y-6">

          <WeddingNav
            currentPageTitle="Wedding CRM Reports & Analytics"
            actions={
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <LocationFilterSelect
                  value={locationFilter}
                  onChange={(val) => setLocationFilter(val)}
                />
                <button
                  onClick={handleExport}
                  className="px-3.5 py-2 bg-[#FFFDFC] hover:bg-[#FFF7F2] border border-[#E8D9D4] rounded-xl text-xs font-bold text-[#4A173A] flex items-center gap-1.5 shadow-2xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-[#B76E79]" />
                  <span>Export Report</span>
                </button>
                <button
                  onClick={loadReport}
                  disabled={loading}
                  className="px-3.5 py-2 bg-[#FFFDFC] hover:bg-[#FFF7F2] border border-[#E8D9D4] rounded-xl text-xs font-bold text-[#4A173A] flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#B76E79]' : 'text-[#B76E79]'}`} />
                  <span>Refresh</span>
                </button>
              </div>
            }
          />

          {/* Telecaller Performance Table Card */}
          <div className="bg-[#FFFDFC] rounded-3xl border border-[#E8D9D4] shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E8D9D4] pb-3">
              <div>
                <h3 className="text-sm font-black text-[#4A173A] uppercase tracking-wider">
                  Telecaller & Staff Performance Matrix
                </h3>
                <div className="text-xs text-[#6F5963]">
                  Calls logged, confirmations, store visits, and sales won per telecaller
                </div>
              </div>
              <span className="text-xs font-bold text-[#6F5963]">
                {telecallerPerf.length} active staff
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-[#E8D9D4]">
              <table className="w-full text-left text-xs text-[#2B1722]">
                <thead className="bg-[#F8EDE8] text-[#4A173A] uppercase text-[10px] tracking-wider border-b border-[#E8D9D4]">
                  <tr>
                    <th className="py-3 px-4 font-black">Telecaller Name</th>
                    <th className="py-3 px-4 font-black">Location</th>
                    <th className="py-3 px-4 font-black">Total Calls</th>
                    <th className="py-3 px-4 font-black">Connected</th>
                    <th className="py-3 px-4 font-black">Shopping Confirmed</th>
                    <th className="py-3 px-4 font-black">Won / Converted</th>
                    <th className="py-3 px-4 font-black text-right">Conversion Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8D9D4] bg-[#FFFDFC]">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-[#6F5963]">
                        <RefreshCw className="w-5 h-5 animate-spin text-[#B76E79] mx-auto mb-2" />
                        <span>Loading performance data...</span>
                      </td>
                    </tr>
                  ) : telecallerPerf.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-[#6F5963]">
                        No performance records found for the selected store location.
                      </td>
                    </tr>
                  ) : (
                    telecallerPerf.map((p: any, idx: number) => {
                      const total = p.total_calls || 0;
                      const won = p.converted || 0;
                      const rate = total > 0 ? Math.round((won / total) * 100) : 0;

                      return (
                        <tr key={idx} className="hover:bg-[#FFF1F2] transition-colors">
                          <td className="py-3 px-4 font-black text-[#4A173A]">
                            👤 {p.name || p.telecaller_name}
                          </td>
                          <td className="py-3 px-4 font-medium text-[#6F5963]">
                            📍 {p.location_name || 'Store'}
                          </td>
                          <td className="py-3 px-4 font-bold text-[#2B1722]">
                            {total}
                          </td>
                          <td className="py-3 px-4 font-bold text-[#356AE6]">
                            {p.connected || 0}
                          </td>
                          <td className="py-3 px-4 font-bold text-[#6A2853]">
                            {p.confirmed || 0}
                          </td>
                          <td className="py-3 px-4 font-black text-[#198754]">
                            {won}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-black bg-[#E8F5EE] text-[#198754] border border-[#198754]/30">
                              {rate}%
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Import History */}
          <div className="bg-[#FFFDFC] rounded-3xl border border-[#E8D9D4] shadow-xs p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E8D9D4]">
              <h3 className="text-sm font-black text-[#4A173A] flex items-center gap-2">
                <History className="w-4.5 h-4.5 text-[#B76E79]" />
                <span>Bulk Import History</span>
              </h3>
              <div className="flex items-center gap-2">
                <Link
                  to="/wedding-crm/import"
                  className="text-[11px] font-black text-[#4A173A] hover:text-[#6A2853] inline-flex items-center gap-1.5 underline"
                >
                  <FileText className="w-3 h-3 text-[#B76E79]" />
                  New Import
                </Link>
                {importLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearLogs}
                    disabled={clearingLogs}
                    className="text-[11px] font-bold text-[#B42318] hover:text-[#8B1A12] inline-flex items-center gap-1 underline disabled:opacity-60 cursor-pointer"
                  >
                    {clearingLogs && <Loader2 className="w-3 h-3 animate-spin" />}
                    Clear All
                  </button>
                )}
                <button
                  type="button"
                  onClick={loadImportLogs}
                  disabled={logsLoading}
                  className="text-[11px] font-bold text-[#4A173A] hover:text-[#6A2853] inline-flex items-center gap-1.5 underline disabled:opacity-60 cursor-pointer"
                >
                  {logsLoading && <Loader2 className="w-3 h-3 animate-spin text-[#B76E79]" />}
                  Refresh
                </button>
              </div>
            </div>

            {importLogs.length === 0 ? (
              <p className="text-xs text-[#6F5963] py-3">
                No bulk imports recorded for your stores yet.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[#E8D9D4]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8EDE8] text-[#4A173A] font-black text-[11px] border-b border-[#E8D9D4]">
                    <tr>
                      <th className="py-2.5 pr-3 pl-3">When</th>
                      <th className="py-2.5 px-3">File</th>
                      <th className="py-2.5 px-3">Store</th>
                      <th className="py-2.5 px-3">Uploaded By</th>
                      <th className="py-2.5 px-3 text-right">Rows</th>
                      <th className="py-2.5 px-3 text-right">Imported</th>
                      <th className="py-2.5 px-3 text-right">Duplicates</th>
                      <th className="py-2.5 px-3 text-right">Errors</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 pl-3 pr-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EADBD7] text-[#2B1722] bg-[#FFFDFC]">
                    {importLogs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-[#FFF1F2] transition-colors">
                        <td className="py-2.5 pr-3 pl-3 font-mono whitespace-nowrap text-[#6F5963]">
                          {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                        </td>
                        <td className="py-2.5 px-3 font-medium max-w-[200px] truncate text-[#4A173A]" title={log.file_name}>
                          {log.file_name || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-[#6F5963]">{log.location_name || (log.location_id ? `#${log.location_id}` : 'All')}</td>
                        <td className="py-2.5 px-3 font-semibold text-[#2B1722]">{log.user_name || '—'}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-[#6F5963]">{log.total_rows ?? 0}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-[#198754]">{log.imported_count ?? 0}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-[#C58A18] font-bold">{log.duplicate_count ?? 0}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-[#B42318]">{log.error_count ?? 0}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              String(log.status || '').toLowerCase().replace(/[\s-]+/g, '_') === 'completed_with_errors'
                                ? 'bg-[#FFF4D6] text-[#C58A18]'
                                : String(log.status || '').toLowerCase().replace(/[\s-]+/g, '_') === 'failed'
                                ? 'bg-[#FDE8E7] text-[#B42318]'
                                : 'bg-[#E8F5EE] text-[#198754]'
                            }`}
                          >
                            {String(log.status || 'Completed').replace(/[\s-]+/g, ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 pl-3 pr-3 text-center whitespace-nowrap">
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
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-[10px] text-[#6F5963]">
              Every CSV / Excel upload into the customer register is logged here with its user, store and row counts.
            </p>
          </div>
        </div>
      </PageContainer>
    </DashboardLayout>
  );
}
