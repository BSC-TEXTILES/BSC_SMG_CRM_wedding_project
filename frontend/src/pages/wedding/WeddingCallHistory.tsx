import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import PageContainer from '../../components/ui/PageContainer';
import ToastContainer, { showToast } from '../../components/Toast';
import { API, Auth, UserSession } from '../../services/api';
import WeddingNav from './WeddingNav';
import LocationFilterSelect from '../../components/ui/LocationFilterSelect';
import { CallLog, CALL_OUTCOMES } from './weddingTypes';
import {
  History,
  PhoneCall,
  Search,
  Filter,
  Download,
  Calendar,
  MapPin,
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight,
  User,
  Clock,
  Sparkles,
  CircleCheck,
  CircleX,
  PhoneOff,
  PhoneMissed
} from 'lucide-react';

export default function WeddingCallHistory() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(() => Auth.get());

  const [loading, setLoading] = useState(true);
  const [callLogs, setCallLogs] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  // Filters - initialized from persistent selection
  const [searchQuery, setSearchQuery] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState<number | ''>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('bsc_selected_location') : null;
    return saved && saved !== 'ALL' ? Number(saved) : '';
  });
  const [locations, setLocations] = useState<any[]>([]);
  const [telecallerFilter, setTelecallerFilter] = useState('');
  const [telecallers, setTelecallers] = useState<any[]>([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Listen to global location changes (e.g. from Topbar)
  useEffect(() => {
    const handleLocChange = (e: any) => {
      const locId = e?.detail?.locationId;
      const parsed = locId && locId !== 'ALL' ? Number(locId) : '';
      setLocationFilter(parsed);
      setCurrentPage(1);
    };
    window.addEventListener('bsc_location_changed', handleLocChange);
    return () => window.removeEventListener('bsc_location_changed', handleLocChange);
  }, []);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const [exportRes, locsRes, callersRes] = await Promise.all([
        API.getWeddingExportData({
          type: 'call_logs',
          location_id: locationFilter !== '' ? locationFilter : undefined,
          from_date: fromDate || undefined,
          to_date: toDate || undefined
        }),
        API.getLocations().catch(() => ({ locations: [] })),
        API.getWeddingTelecallers().catch(() => ({ telecallers: [] }))
      ]);

      if (locsRes?.locations) setLocations(locsRes.locations);
      if (callersRes?.telecallers) setTelecallers(callersRes.telecallers);

      const rawLogs = Array.isArray(exportRes) 
        ? exportRes 
        : (Array.isArray(exportRes?.data) 
            ? exportRes.data 
            : (Array.isArray(exportRes?.logs) 
                ? exportRes.logs 
                : (Array.isArray(exportRes?.records) ? exportRes.records : [])));
      setCallLogs(rawLogs);
      setTotalCount(rawLogs.length);
    } catch (err: any) {
      showToast('Error loading call history: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [locationFilter, fromDate, toDate]);

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
    loadLogs();
  }, [loadLogs, navigate]);

  // Export Call Logs
  const handleExport = () => {
    if (callLogs.length === 0) {
      showToast('No call logs to export', 'error');
      return;
    }

    const rows = callLogs.map((c: any) => ({
      'Call Date': c.call_date,
      'Call Time': c.call_time,
      'Customer Name': c.customer_name || '',
      'Mobile Number': c.customer_mobile || c.mobile_number || '',
      'Telecaller': c.telecaller_name || '',
      'Status': c.call_status || '',
      'Outcome': c.call_outcome || '',
      'Remarks': c.remarks || '',
      'Next Follow-up Date': c.next_follow_up_date || '',
      'Updated Shopping Date': c.expected_shopping_date_updated || ''
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Call History');
    XLSX.writeFile(wb, `BSC_Wedding_Call_Logs_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('Call history exported to Excel', 'success');
  };

  // Filter logs locally based on search, outcome, caller
  const filteredLogs = callLogs.filter((log: any) => {
    if (outcomeFilter && log.call_outcome !== outcomeFilter) return false;
    if (telecallerFilter && log.telecaller_name !== telecallerFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const name = (log.customer_name || '').toLowerCase();
      const mob = (log.customer_mobile || log.mobile_number || '').toLowerCase();
      const notes = (log.remarks || '').toLowerCase();
      if (!name.includes(q) && !mob.includes(q) && !notes.includes(q)) return false;
    }
    return true;
  });

  const paginatedLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <DashboardLayout
      title="Wedding Call History"
      breadcrumbs={[{ label: 'Wedding CRM', href: '/wedding-crm/dashboard' }, { label: 'Call History' }]}
    >
      <PageContainer maxWidth="full">
        <div className="space-y-6">
          <ToastContainer />

          <WeddingNav
            currentPageTitle="Wedding Call History"
            actions={
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExport}
                  className="px-3.5 py-2 bg-white hover:bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl text-xs font-bold text-[#182033] flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-[#C98218]" />
                  <span>Export Logs</span>
                </button>
                <button
                  onClick={loadLogs}
                  disabled={loading}
                  className="px-3.5 py-2 bg-white hover:bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl text-xs font-bold text-[#182033] flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#C9A45C]' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            }
          />

          {/* Search & Filter Toolbar */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#DFDDD7] shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search customer, mobile, remarks..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-8 pr-3 py-2 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-medium focus:outline-none focus:border-[#C9A45C]"
                />
              </div>

              {/* Outcome Filter */}
              <div>
                <select
                  value={outcomeFilter}
                  onChange={(e) => {
                    setOutcomeFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-bold focus:outline-none focus:border-[#C9A45C]"
                >
                  <option value="">Outcome: All Outcomes</option>
                  {CALL_OUTCOMES.map((out) => (
                    <option key={out} value={out}>
                      {out}
                    </option>
                  ))}
                </select>
              </div>

              {/* Telecaller Filter */}
              <div>
                <select
                  value={telecallerFilter}
                  onChange={(e) => {
                    setTelecallerFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-bold focus:outline-none focus:border-[#C9A45C]"
                >
                  <option value="">Telecaller: All Staff</option>
                  {telecallers.map((t) => (
                    <option key={t.id} value={t.name}>
                      👤 {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Location Filter */}
              <div>
                <LocationFilterSelect
                  value={locationFilter}
                  className="w-full"
                  onChange={(val) => {
                    setLocationFilter(val);
                    setCurrentPage(1);
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#DFDDD7] text-xs text-muted">
              <span>
                Showing <strong className="text-primary">{filteredLogs.length}</strong> total call logs recorded
              </span>
            </div>
          </div>

          {/* Mobile Call Logs List (< md) */}
          <div className="md:hidden space-y-3">
            {loading ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-[#DFDDD7]">
                <RefreshCw className="w-5 h-5 animate-spin text-[#C9A45C] mx-auto mb-2" />
                <span className="text-xs text-muted">Loading call records...</span>
              </div>
            ) : paginatedLogs.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-[#DFDDD7]">
                <History className="w-8 h-8 text-muted mx-auto mb-2" />
                <div className="font-bold text-sm text-[#182033]">No call logs found</div>
                <div className="text-xs text-muted mt-0.5">Calls logged by telecallers will appear here.</div>
              </div>
            ) : (
              paginatedLogs.map((log: any, idx: number) => (
                <div key={idx} className="p-4 bg-white rounded-2xl border border-[#DFDDD7] shadow-xs space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-sm text-[#182033]">
                        {log.customer_name || 'Customer'}
                      </div>
                      <div className="text-xs text-muted">
                        📱 {log.customer_mobile || log.mobile_number || '—'}
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-800 border border-blue-200">
                      {log.call_outcome}
                    </span>
                  </div>

                  <div className="text-xs bg-[#F6F4EF] p-2.5 rounded-xl border border-[#DFDDD7]/60 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted">📅 {log.call_date} {log.call_time}</span>
                      <span className="text-primary font-semibold">👤 {log.telecaller_name || 'Staff'}</span>
                    </div>
                    {log.remarks && (
                      <p className="text-gray-700 italic pt-1 border-t border-[#DFDDD7]/60 text-[11px]">
                        "{log.remarks}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-muted">
                      {log.next_follow_up_date ? (
                        <span className="text-amber-800 font-bold">Next: {new Date(log.next_follow_up_date).toLocaleDateString()}</span>
                      ) : (
                        'No follow-up'
                      )}
                    </span>
                    {log.customer_id && (
                      <Link
                        to={`/wedding-crm/customers/${log.customer_id}`}
                        className="px-2.5 py-1 bg-[#101C36] text-[#C9A45C] rounded-lg text-xs font-bold shadow-xs flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Profile</span>
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Call Logs Table (hidden on < md) */}
          <div className="hidden md:block bg-white rounded-2xl border border-[#DFDDD7] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#182033]">
                <thead className="bg-[#07101F] text-white uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4 font-black">Date & Time</th>
                    <th className="py-3 px-4 font-black">Customer</th>
                    <th className="py-3 px-4 font-black">Mobile</th>
                    <th className="py-3 px-4 font-black">Telecaller</th>
                    <th className="py-3 px-4 font-black">Outcome</th>
                    <th className="py-3 px-4 font-black">Remarks / Conversation Notes</th>
                    <th className="py-3 px-4 font-black">Next Follow-up</th>
                    <th className="py-3 px-4 font-black text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DFDDD7]">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-muted">
                        <RefreshCw className="w-5 h-5 animate-spin text-[#C9A45C] mx-auto mb-2" />
                        <span>Loading call records...</span>
                      </td>
                    </tr>
                  ) : paginatedLogs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-muted">
                        <History className="w-8 h-8 text-muted mx-auto mb-2" />
                        <div className="font-bold text-sm text-[#182033]">No call logs found</div>
                        <div className="text-xs text-muted mt-0.5">Calls logged by telecallers will appear here.</div>
                      </td>
                    </tr>
                  ) : (
                    paginatedLogs.map((log: any, idx: number) => (
                      <tr key={idx} className="hover:bg-[#F6F4EF]/70 transition-colors">
                        <td className="py-3 px-4 font-bold text-[#182033]">
                          <div>{log.call_date}</div>
                          <div className="text-[10px] text-muted font-medium">{log.call_time}</div>
                        </td>
                        <td className="py-3 px-4 font-black text-primary">
                          {log.customer_name || 'Customer'}
                        </td>
                        <td className="py-3 px-4 font-semibold text-muted">
                          {log.customer_mobile || log.mobile_number || '—'}
                        </td>
                        <td className="py-3 px-4 font-bold text-primary">
                          👤 {log.telecaller_name || 'Staff'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-800 border border-blue-200">
                            {log.call_outcome}
                          </span>
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          {log.remarks ? (
                            <p className="line-clamp-2 text-gray-700 italic">"{log.remarks}"</p>
                          ) : (
                            <span className="text-muted italic">No remarks</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-semibold">
                          {log.next_follow_up_date ? (
                            <span className="text-amber-800 font-bold">
                              {new Date(log.next_follow_up_date).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-muted">None</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {log.customer_id && (
                            <Link
                              to={`/wedding-crm/customers/${log.customer_id}`}
                              className="p-1.5 bg-[#F6F4EF] hover:bg-[#DFDDD7] text-primary rounded-lg inline-flex items-center"
                              title="View Customer Profile"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-[#DFDDD7] bg-[#F6F4EF] flex items-center justify-between text-xs">
              <div className="text-muted">
                Showing page <strong className="text-primary">{currentPage}</strong> of{' '}
                <strong className="text-primary">{Math.max(1, Math.ceil(filteredLogs.length / pageSize))}</strong>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg bg-white border border-[#DFDDD7] font-bold text-[#182033] disabled:opacity-40"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setCurrentPage((p) => (p * pageSize < filteredLogs.length ? p + 1 : p))}
                  disabled={currentPage * pageSize >= filteredLogs.length}
                  className="px-3 py-1.5 rounded-lg bg-white border border-[#DFDDD7] font-bold text-[#182033] disabled:opacity-40"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </PageContainer>
    </DashboardLayout>
  );
}
