import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import ToastContainer, { showToast } from '../../components/Toast';
import { API, Auth, UserSession } from '../../services/api';
import { getSidebarCollapsed, subscribeSidebarCollapsed } from '../../utils/sidebarState';
import WeddingNav from './WeddingNav';
import {
  BarChart3,
  TrendingUp,
  Download,
  Users,
  MapPin,
  Calendar,
  Award,
  RefreshCw,
  PhoneCall,
  CheckCircle2
} from 'lucide-react';

export default function WeddingReports() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(() => Auth.get());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(getSidebarCollapsed());

  useEffect(() => {
    return subscribeSidebarCollapsed(setCollapsed);
  }, []);

  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState('conversion');
  const [locationFilter, setLocationFilter] = useState<number | ''>('');
  const [locations, setLocations] = useState<any[]>([]);

  const [reportData, setReportData] = useState<any>(null);
  const [telecallerPerf, setTelecallerPerf] = useState<any[]>([]);

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
  }, [loadReport, navigate]);

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
    <div className="min-h-screen bg-[#F6F4EF] flex text-[#182033]">
      <Sidebar
        session={session}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          collapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        <Topbar
          title="Wedding CRM Reports"
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto space-y-6">
          <ToastContainer />

          <WeddingNav
            currentPageTitle="Wedding CRM Reports & Analytics"
            actions={
              <div className="flex items-center gap-2">
                {session?.isGlobalAdmin && (
                  <select
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value ? Number(e.target.value) : '')}
                    className="px-3 py-2 bg-white border border-[#DFDDD7] rounded-xl text-xs font-bold text-[#182033]"
                  >
                    <option value="">🌐 All Locations</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        📍 {loc.name}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  onClick={handleExport}
                  className="px-3.5 py-2 bg-white hover:bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl text-xs font-bold text-[#182033] flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-[#C98218]" />
                  <span>Export Report</span>
                </button>
                <button
                  onClick={loadReport}
                  disabled={loading}
                  className="px-3.5 py-2 bg-white hover:bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl text-xs font-bold text-[#182033] flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#C9A45C]' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            }
          />

          {/* Telecaller Performance Table Card */}
          <div className="bg-white rounded-3xl border border-[#DFDDD7] shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#DFDDD7] pb-3">
              <div>
                <h3 className="text-sm font-black text-[#182033] uppercase tracking-wider">
                  Telecaller & Staff Performance Matrix
                </h3>
                <div className="text-xs text-muted">
                  Calls logged, confirmations, store visits, and sales won per telecaller
                </div>
              </div>
              <span className="text-xs font-bold text-muted">
                {telecallerPerf.length} active staff
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#182033]">
                <thead className="bg-[#07101F] text-white uppercase text-[10px] tracking-wider">
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
                <tbody className="divide-y divide-[#DFDDD7]">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-muted">
                        <RefreshCw className="w-5 h-5 animate-spin text-[#C9A45C] mx-auto mb-2" />
                        <span>Loading performance data...</span>
                      </td>
                    </tr>
                  ) : telecallerPerf.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-muted">
                        No performance records found for the selected store location.
                      </td>
                    </tr>
                  ) : (
                    telecallerPerf.map((p: any, idx: number) => {
                      const total = p.total_calls || 0;
                      const won = p.converted || 0;
                      const rate = total > 0 ? Math.round((won / total) * 100) : 0;

                      return (
                        <tr key={idx} className="hover:bg-[#F6F4EF]/70 transition-colors">
                          <td className="py-3 px-4 font-black text-primary">
                            👤 {p.name || p.telecaller_name}
                          </td>
                          <td className="py-3 px-4 font-medium text-muted">
                            📍 {p.location_name || 'Store'}
                          </td>
                          <td className="py-3 px-4 font-bold text-[#182033]">
                            {total}
                          </td>
                          <td className="py-3 px-4 font-bold text-blue-700">
                            {p.connected || 0}
                          </td>
                          <td className="py-3 px-4 font-bold text-purple-700">
                            {p.confirmed || 0}
                          </td>
                          <td className="py-3 px-4 font-black text-[#16805B]">
                            {won}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-300">
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
        </main>
      </div>
    </div>
  );
}
