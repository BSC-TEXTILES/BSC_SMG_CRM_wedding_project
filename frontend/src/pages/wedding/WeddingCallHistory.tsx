import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import PageContainer from '../../components/ui/PageContainer';
import ToastContainer, { showToast } from '../../components/Toast';
import { API, Auth, UserSession } from '../../services/api';
import { parseDate, formatDateDisplay } from '../../utils/dateUtils';
import WeddingNav from './WeddingNav';
import LocationFilterSelect from '../../components/ui/LocationFilterSelect';
import { CALL_OUTCOMES, getStatusBadge } from './weddingTypes';
import WeddingCustomerFlowModal from '../../components/wedding/WeddingCustomerFlowModal';
import {
  History,
  Search,
  Download,
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Calendar,
  ShoppingBag,
  MessageCircle,
  MapPin,
  Sparkles
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

  // Flow Modal State
  const [flowModalOpen, setFlowModalOpen] = useState(false);
  const [selectedCustomerForFlow, setSelectedCustomerForFlow] = useState<any>(null);

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

  // Export Call Logs with Rich Customer Details
  const handleExport = () => {
    if (callLogs.length === 0) {
      showToast('No call logs to export', 'error');
      return;
    }

    const rows = callLogs.map((c: any) => ({
      'Call Date': c.call_date,
      'Call Time': c.call_time,
      'Customer Code': c.customer_code || '',
      'Customer Name': c.customer_name || '',
      'Bride Name': c.bride_name || '',
      'Groom Name': c.groom_name || '',
      'Mobile Number': c.customer_mobile || c.mobile_number || '',
      'Store Location': c.location_name || '',
      'Shopping Category': c.preferred_shopping_category || '',
      'Budget Range': c.budget || c.budget_range || '',
      'Wedding Date': c.wedding_date || '',
      'Expected Shopping Date': c.expected_shopping_date || c.expected_shopping_date_updated || '',
      'Telecaller': c.telecaller_name || '',
      'Customer Status': c.customer_status || '',
      'Call Outcome': c.call_outcome || '',
      'Remarks / Response': c.remarks || c.customer_response || '',
      'Next Follow-up Date': c.next_follow_up_date || '',
      'Next Follow-up Time': c.next_follow_up_time || ''
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Call History');
    XLSX.writeFile(wb, `BSC_Wedding_Call_Logs_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('Call history exported with complete customer details', 'success');
  };

  // Filter logs locally based on search, outcome, caller
  const filteredLogs = callLogs.filter((log: any) => {
    if (outcomeFilter && log.call_outcome !== outcomeFilter) return false;
    if (telecallerFilter && log.telecaller_name !== telecallerFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const name = (log.customer_name || '').toLowerCase();
      const code = (log.customer_code || '').toLowerCase();
      const bride = (log.bride_name || '').toLowerCase();
      const groom = (log.groom_name || '').toLowerCase();
      const mob = (log.customer_mobile || log.mobile_number || '').toLowerCase();
      const cat = (log.preferred_shopping_category || '').toLowerCase();
      const notes = (log.remarks || '').toLowerCase();
      if (!name.includes(q) && !mob.includes(q) && !notes.includes(q) && !code.includes(q) && !bride.includes(q) && !groom.includes(q) && !cat.includes(q)) {
        return false;
      }
    }
    return true;
  });

  const paginatedLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const openFlowForRecord = (log: any) => {
    setSelectedCustomerForFlow({
      id: log.customer_id,
      customer_id: log.customer_id,
      customer_code: log.customer_code,
      customer_name: log.customer_name,
      mobile_number: log.customer_mobile || log.mobile_number,
      bride_name: log.bride_name,
      groom_name: log.groom_name,
      wedding_date: log.wedding_date,
      expected_shopping_date: log.expected_shopping_date || log.expected_shopping_date_updated,
      preferred_shopping_category: log.preferred_shopping_category,
      budget: log.budget || log.budget_range,
      location_name: log.location_name,
      assigned_telecaller: log.telecaller_name || log.assigned_telecaller,
      customer_status: log.customer_status,
      priority: log.priority
    });
    setFlowModalOpen(true);
  };

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
                  className="px-3.5 py-2 bg-[#FFFFFF] hover:bg-[#EDF3F0] border border-[#E1DDD3] rounded-xl text-xs font-bold text-[#123C35] flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#C9A45C]" />
                  <span>Export Logs</span>
                </button>
                <button
                  onClick={loadLogs}
                  disabled={loading}
                  className="px-3.5 py-2 bg-[#FFFFFF] hover:bg-[#EDF3F0] border border-[#E1DDD3] rounded-xl text-xs font-bold text-[#123C35] flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#C9A45C]' : 'text-[#C9A45C]'}`} />
                  <span>Refresh</span>
                </button>
              </div>
            }
          />

          {/* Search & Filter Toolbar */}
          <div className="bg-[#FFFFFF] p-4 sm:p-5 rounded-2xl border border-[#E1DDD3] shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#9A858D] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search customer, bride, groom, mobile, remarks..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-8 pr-3 py-2 bg-[#F7F5F0] border border-[#E1DDD3] rounded-xl font-medium text-[#17201D] placeholder:text-[#9A858D] focus:outline-none focus:border-[#C9A45C]"
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
                  className="w-full px-3 py-2 bg-[#F7F5F0] border border-[#E1DDD3] rounded-xl font-bold text-[#17201D] focus:outline-none focus:border-[#C9A45C]"
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
                  className="w-full px-3 py-2 bg-[#F7F5F0] border border-[#E1DDD3] rounded-xl font-bold text-[#17201D] focus:outline-none focus:border-[#C9A45C]"
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

            <div className="flex flex-wrap items-center justify-between pt-2 border-t border-[#E1DDD3] text-xs text-[#65716C] gap-2">
              <div className="flex items-center gap-2">
                <span>
                  Showing <strong className="text-[#123C35]">{filteredLogs.length}</strong> call records with complete customer details
                </span>
                <span className="text-[10px] bg-[#E8F5EE] text-[#198754] font-bold px-2 py-0.5 rounded-full border border-[#198754]/20">
                  Interactive Flow Enabled
                </span>
              </div>

              <div className="text-[11px] text-[#9A858D]">
                Click <strong className="text-[#123C35]">"View Flow"</strong> on any record to open the full journey & add live steps
              </div>
            </div>
          </div>

          {/* Mobile Call Logs Cards List (< md) */}
          <div className="md:hidden space-y-3">
            {loading ? (
              <div className="p-8 text-center bg-[#FFFFFF] rounded-2xl border border-[#E1DDD3]">
                <RefreshCw className="w-5 h-5 animate-spin text-[#C9A45C] mx-auto mb-2" />
                <span className="text-xs text-[#65716C]">Loading call records & customer details...</span>
              </div>
            ) : paginatedLogs.length === 0 ? (
              <div className="p-8 text-center bg-[#FFFFFF] rounded-2xl border border-[#E1DDD3]">
                <History className="w-8 h-8 text-[#C9A45C] mx-auto mb-2 opacity-70" />
                <div className="font-bold text-sm text-[#123C35]">No call logs found</div>
                <div className="text-xs text-[#65716C] mt-0.5">Calls logged by telecallers will appear here.</div>
              </div>
            ) : (
              paginatedLogs.map((log: any, idx: number) => {
                const badge = getStatusBadge(log.customer_status || 'New');
                const cleanPhone = (log.customer_mobile || log.mobile_number || '').replace(/\D/g, '');
                return (
                  <div key={idx} className="p-4 bg-[#FFFFFF] rounded-2xl border border-[#E1DDD3] shadow-xs space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-sm text-[#123C35] flex items-center gap-1.5">
                          <span>{log.customer_name || 'Customer'}</span>
                          <span className="text-[10px] text-[#65716C] font-mono">({log.customer_code || 'BSC-WED'})</span>
                        </div>
                        <div className="text-xs text-[#65716C] mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>📱 {log.customer_mobile || log.mobile_number || '—'}</span>
                          <span>·</span>
                          <span>📍 {log.location_name || 'Store'}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#EDF3F0] text-[#123C35] border border-[#E1DDD3]">
                          {log.call_outcome}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${badge.bg}`}>
                          {log.customer_status || 'New'}
                        </span>
                      </div>
                    </div>

                    {/* Wedding Details Strip */}
                    {(log.bride_name || log.groom_name || log.wedding_date || log.preferred_shopping_category) && (
                      <div className="p-2.5 bg-[#EDF3F0] rounded-xl border border-[#E1DDD3] text-[11px] text-[#123C35] space-y-1">
                        <div className="font-semibold flex items-center justify-between">
                          <span>
                            {log.bride_name ? `👰 ${log.bride_name}` : ''}
                            {log.bride_name && log.groom_name ? ' · ' : ''}
                            {log.groom_name ? `🤵 ${log.groom_name}` : ''}
                          </span>
                          {log.budget && (
                            <span className="text-[#198754] font-bold">₹ {log.budget}</span>
                          )}
                        </div>
                        <div className="text-[10px] text-[#65716C] flex items-center gap-2 flex-wrap">
                          {log.wedding_date && (
                            <span className="text-[#C9A45C] font-medium">💍 {formatDateDisplay(log.wedding_date)}</span>
                          )}
                          {log.preferred_shopping_category && (
                            <span>🏷️ {log.preferred_shopping_category}</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Call notes */}
                    <div className="text-xs bg-[#F7F5F0] p-2.5 rounded-xl border border-[#E1DDD3] space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#65716C]">📅 {log.call_date} {log.call_time}</span>
                        <span className="text-[#123C35] font-semibold">👤 {log.telecaller_name || 'Staff'}</span>
                      </div>
                      {log.remarks && (
                        <p className="text-[#17201D] italic pt-1 border-t border-[#E1DDD3] text-[11px]">
                          "{log.remarks}"
                        </p>
                      )}
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-[#65716C]">
                        {parseDate(log.next_follow_up_date) ? (
                          <span className="text-[#C58A18] font-bold">Next: {formatDateDisplay(log.next_follow_up_date, 'No follow-up')}</span>
                        ) : (
                          'No follow-up'
                        )}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {cleanPhone && (
                          <a
                            href={`https://wa.me/91${cleanPhone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 bg-[#198754] hover:bg-[#16805B] text-white rounded-lg text-xs"
                            title="WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => openFlowForRecord(log)}
                          className="px-2.5 py-1 bg-[#123C35] hover:bg-[#082821] text-white rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <TrendingUp className="w-3 h-3 text-[#E4CB92]" />
                          <span>View Flow</span>
                        </button>

                        {log.customer_id && (
                          <Link
                            to={`/wedding-crm/customers/${log.customer_id}`}
                            className="p-1.5 bg-[#EDF3F0] hover:bg-[#E1DDD3] text-[#123C35] border border-[#E1DDD3] rounded-lg text-xs"
                            title="Profile"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#C9A45C]" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Call Logs Table (hidden on < md) */}
          <div className="hidden md:block bg-[#FFFFFF] rounded-2xl border border-[#E1DDD3] shadow-xs overflow-hidden">
            <div className="table-frame custom-scrollbar">
              <table className="w-full text-left text-xs text-[#17201D]">
                <thead className="bg-[#F8EDE8] text-[#123C35] uppercase text-[10px] tracking-wider border-b border-[#E1DDD3]">
                  <tr>
                    <th className="py-3 px-3.5 font-black">Date & Time</th>
                    <th className="py-3 px-3.5 font-black">Customer Details</th>
                    <th className="py-3 px-3.5 font-black">Wedding & Shopping</th>
                    <th className="py-3 px-3.5 font-black">Telecaller</th>
                    <th className="py-3 px-3.5 font-black">Outcome & Status</th>
                    <th className="py-3 px-3.5 font-black">Remarks / Customer Response</th>
                    <th className="py-3 px-3.5 font-black">Next Follow-up</th>
                    <th className="py-3 px-3.5 font-black text-right">Customer Flow & Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E1DDD3] bg-[#FFFFFF]">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-[#65716C]">
                        <RefreshCw className="w-5 h-5 animate-spin text-[#C9A45C] mx-auto mb-2" />
                        <span>Loading complete call records & customer details...</span>
                      </td>
                    </tr>
                  ) : paginatedLogs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-[#65716C]">
                        <History className="w-8 h-8 text-[#C9A45C] mx-auto mb-2 opacity-70" />
                        <div className="font-bold text-sm text-[#123C35]">No call logs found</div>
                        <div className="text-xs text-[#65716C] mt-0.5">Calls logged by telecallers will appear here.</div>
                      </td>
                    </tr>
                  ) : (
                    paginatedLogs.map((log: any, idx: number) => {
                      const badge = getStatusBadge(log.customer_status || 'New');
                      const cleanPhone = (log.customer_mobile || log.mobile_number || '').replace(/\D/g, '');

                      return (
                        <tr key={idx} className="hover:bg-[#FFF1F2]/60 transition-colors">
                          {/* 1. Date & Time */}
                          <td className="py-3 px-3.5 font-bold text-[#17201D] whitespace-nowrap">
                            <div>{log.call_date}</div>
                            <div className="text-[10px] text-[#65716C] font-medium">{log.call_time}</div>
                          </td>

                          {/* 2. Customer Details */}
                          <td className="py-3 px-3.5">
                            <div className="font-black text-[#123C35] text-xs">
                              {log.customer_name || 'Customer'}
                            </div>
                            <div className="text-[10px] text-[#65716C] font-mono mt-0.5">
                              {log.customer_code || 'BSC-WED'} · 📱 {log.customer_mobile || log.mobile_number || '—'}
                            </div>
                            {(log.bride_name || log.groom_name) && (
                              <div className="text-[10px] text-[#C9A45C] font-medium mt-0.5">
                                {log.bride_name ? `👰 ${log.bride_name}` : ''}
                                {log.bride_name && log.groom_name ? ' · ' : ''}
                                {log.groom_name ? `🤵 ${log.groom_name}` : ''}
                              </div>
                            )}
                          </td>

                          {/* 3. Wedding & Shopping */}
                          <td className="py-3 px-3.5">
                            <div className="flex items-center gap-1 font-bold text-[#C9A45C] text-xs whitespace-nowrap">
                              <Calendar className="w-3 h-3 text-[#C9A45C]" />
                              <span>{formatDateDisplay(log.wedding_date, 'Date TBD')}</span>
                            </div>
                            <div className="text-[10px] text-[#17201D] font-semibold mt-0.5 truncate max-w-[150px]">
                              {log.preferred_shopping_category || 'General Wedding'}
                            </div>
                            <div className="text-[10px] text-[#198754] font-bold mt-0.5">
                              {log.budget || log.budget_range ? `₹ ${log.budget || log.budget_range}` : 'Budget TBD'}
                            </div>
                          </td>

                          {/* 4. Telecaller */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <div className="font-bold text-[#123C35]">
                              👤 {log.telecaller_name || 'Staff'}
                            </div>
                            <div className="text-[10px] text-[#65716C] flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-[#C9A45C]" />
                              <span>{log.location_name || 'Store'}</span>
                            </div>
                          </td>

                          {/* 5. Outcome & Status */}
                          <td className="py-3 px-3.5 whitespace-nowrap space-y-1">
                            <div>
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#EDF3F0] text-[#123C35] border border-[#E1DDD3]">
                                {log.call_outcome}
                              </span>
                            </div>
                            <div>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${badge.bg}`}>
                                {log.customer_status || 'New'}
                              </span>
                            </div>
                          </td>

                          {/* 6. Remarks */}
                          <td className="py-3 px-3.5 max-w-xs">
                            {log.remarks ? (
                              <p className="line-clamp-2 text-[#17201D] italic text-[11px]">"{log.remarks}"</p>
                            ) : (
                              <span className="text-[#9A858D] italic text-[11px]">No remarks</span>
                            )}
                            {log.expected_shopping_date_updated && (
                              <div className="text-[10px] text-[#198754] font-bold mt-0.5">
                                🛍️ Shopping: {formatDateDisplay(log.expected_shopping_date_updated)}
                              </div>
                            )}
                          </td>

                          {/* 7. Next Follow-up */}
                          <td className="py-3 px-3.5 font-semibold whitespace-nowrap">
                            {parseDate(log.next_follow_up_date) ? (
                              <div>
                                <span className="text-[#C58A18] font-bold text-xs">
                                  {formatDateDisplay(log.next_follow_up_date, 'None')}
                                </span>
                                {log.next_follow_up_time && (
                                  <div className="text-[10px] text-[#65716C] font-medium">{log.next_follow_up_time}</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-[#9A858D]">None</span>
                            )}
                          </td>

                          {/* 8. Actions (View Flow Modal + Profile) */}
                          <td className="py-3 px-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* VIEW FLOW BUTTON */}
                              <button
                                type="button"
                                onClick={() => openFlowForRecord(log)}
                                className="px-3 py-1.5 bg-[#123C35] hover:bg-[#082821] text-white rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer border border-[#C9A45C]/30 hover:scale-[1.02]"
                                title="Open Customer Flow & Timeline to view journey or add a step"
                              >
                                <TrendingUp className="w-3.5 h-3.5 text-[#E4CB92]" />
                                <span>View Flow</span>
                              </button>

                              {cleanPhone && (
                                <a
                                  href={`https://wa.me/91${cleanPhone}?text=Namaste%20${encodeURIComponent(log.customer_name || 'Customer')}%2C%20greetings%20from%20BSC%20Exclusive%20Textiles!`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 bg-[#198754] hover:bg-[#16805B] text-white rounded-xl transition-colors"
                                  title="WhatsApp"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </a>
                              )}

                              {log.customer_id && (
                                <Link
                                  to={`/wedding-crm/customers/${log.customer_id}`}
                                  className="p-1.5 bg-[#EDF3F0] hover:bg-[#E1DDD3] text-[#123C35] border border-[#E1DDD3] rounded-xl inline-flex items-center transition-colors"
                                  title="View Full Profile"
                                >
                                  <Eye className="w-3.5 h-3.5 text-[#C9A45C]" />
                                </Link>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-[#E1DDD3] bg-[#F7F5F0] flex items-center justify-between text-xs">
              <div className="text-[#65716C]">
                Showing page <strong className="text-[#123C35]">{currentPage}</strong> of{' '}
                <strong className="text-[#123C35]">{Math.max(1, Math.ceil(filteredLogs.length / pageSize))}</strong>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg bg-[#FFFFFF] border border-[#E1DDD3] font-bold text-[#123C35] disabled:opacity-40 hover:bg-[#EDF3F0] transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setCurrentPage((p) => (p * pageSize < filteredLogs.length ? p + 1 : p))}
                  disabled={currentPage * pageSize >= filteredLogs.length}
                  className="px-3 py-1.5 rounded-lg bg-[#FFFFFF] border border-[#E1DDD3] font-bold text-[#123C35] disabled:opacity-40 hover:bg-[#EDF3F0] transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Customer Flow Modal */}
          {flowModalOpen && (
            <WeddingCustomerFlowModal
              isOpen={flowModalOpen}
              onClose={() => setFlowModalOpen(false)}
              customerId={selectedCustomerForFlow?.customer_id || selectedCustomerForFlow?.id}
              initialCustomer={selectedCustomerForFlow}
              onFlowUpdated={() => {
                loadLogs();
              }}
            />
          )}

        </div>
      </PageContainer>
    </DashboardLayout>
  );
}
