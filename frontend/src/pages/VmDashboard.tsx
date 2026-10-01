import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layouts/DashboardLayout';
import { ClipboardList, CheckCircle2, AlertTriangle, Building2, TrendingUp, RotateCcw, Download, Eye, Camera, Layers, Store, Clock, Search, Maximize2, ChevronRight, ChevronLeft, Image as ImageIcon, UserCheck, RefreshCw, SlidersHorizontal, FileSpreadsheet, X, ZoomIn, ZoomOut, Trash2, LayoutGrid, ListFilter, Tag } from 'lucide-react';
import { API, Auth } from '../services/api';
import { showToast } from '../components/Toast';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie, AreaChart, Area } from 'recharts';

export default function VmDashboard() {
  const navigate = useNavigate();
  const session = Auth.get();
  const userRole = String(session?.role || '').trim().toLowerCase();
  const isSuperAdmin = userRole === 'super admin';
  const isAdminRole = ['admin', 'super admin', 'system administrator'].includes(userRole);
  const isGlobalAdmin = isSuperAdmin || (isAdminRole && (!session?.locationId || session?.isGlobalAdmin === true));
  const isAdmin = isGlobalAdmin;
  const isCrmManager = userRole === 'crm manager';
  const isManager = Boolean(session && ['manager', 'store manager', 'floor manager', 'vm', 'crm manager', 'system administrator', 'admin', 'super admin'].includes(userRole));
  const canDeletePhotos = isAdmin || isCrmManager || isManager;
  const userLocation = session?.locationName || (session as any)?.store_location || '';
  const userLocationId = session?.locationId ? Number(session.locationId) : null;

  // Filter States
  const [selectedLocation, setSelectedLocation] = useState<string>(
    (!isGlobalAdmin && userLocationId) ? String(userLocationId) : 'All'
  );
  const [selectedFloor, setSelectedFloor] = useState<string>('All');
  const [selectedSection, setSelectedSection] = useState<string>('All');
  const [dateRange, setDateRange] = useState<string>('month');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedAuditor, setSelectedAuditor] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Dashboard Data State
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [dashboardData, setDashboardData] = useState<any>({
    summaryCards: {
      totalAudits: 0,
      auditsToday: 0,
      auditsThisWeek: 0,
      auditsThisMonth: 0,
      pendingAudits: 0,
      completedAudits: 0,
      sectionsAudited: 0,
      sectionsPending: 0,
      questionsChecked: 0,
      passedChecks: 0,
      failedChecks: 0,
      averageScore: 0,
      compliancePercentage: 0,
      imagesUploaded: 0,
      storesAudited: 0,
      floorsAudited: 0,
      latestAuditDate: null
    },
    charts: {
      floorPerformance: [],
      sectionPerformance: [],
      storePerformance: [],
      scoreDistribution: [],
      auditCompletion: [],
      auditTrend: [],
      questionCompliance: []
    },
    recentActivity: [],
    photoTimeline: []
  });

  const [timelineViewMode, setTimelineViewMode] = useState<'photos' | 'audits'>('photos');
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);

  // History & Detailed Audits State
  const [auditsList, setAuditsList] = useState<any[]>([]);
  const [loadingAudits, setLoadingAudits] = useState<boolean>(false);
  const [auditPage, setAuditPage] = useState<number>(1);
  const [totalAuditsCount, setTotalAuditsCount] = useState<number>(0);
  const [floorsMaster, setFloorsMaster] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'history'>('overview');

  // Modal / Lightbox State
  const [selectedAuditForModal, setSelectedAuditForModal] = useState<any | null>(null);
  const [loadingModalDetail, setLoadingModalDetail] = useState<boolean>(false);
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);
  const [lightboxPhotos, setLightboxPhotos] = useState<any[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);
  const [lightboxZoom, setLightboxZoom] = useState<number>(1);

  // Available Store Locations
  const allMasterLocations = [
    { id: 1, name: 'Belagavi', code: 'BEL' },
    { id: 2, name: 'Davanagere', code: 'DAV' },
    { id: 3, name: 'Shivamogga', code: 'SHI' }
  ];
  const storeLocations = isGlobalAdmin
    ? allMasterLocations
    : allMasterLocations.filter(l => l.id === userLocationId || (Array.isArray(session?.allowedLocations) && session.allowedLocations.includes(l.id)));

  // Fetch Floor Masters
  useEffect(() => {
    API.getVmFloors().then(res => {
      if (res && res.floors && Array.isArray(res.floors)) {
        setFloorsMaster(res.floors);
      }
    }).catch(() => {});
  }, []);

  // Compute available sections based on selected floor
  const availableSections = useMemo(() => {
    if (!floorsMaster || floorsMaster.length === 0) {
      return ['Normal Sarees', 'Silk Sarees (Upto Lakhs)', 'Ladies Wear and Kids Wear', 'Mens Wear and Home Furnishing'];
    }
    if (selectedFloor === 'All') {
      const set = new Set<string>();
      floorsMaster.forEach(f => {
        (f.sections || []).forEach((s: string) => set.add(s));
      });
      return Array.from(set);
    }
    const match = floorsMaster.find(f => f.name === selectedFloor);
    return match ? (match.sections || []) : [];
  }, [floorsMaster, selectedFloor]);

  // Main Dashboard Data Loader
  const loadDashboard = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const params: any = {};
      if (selectedLocation !== 'All') params.locationId = selectedLocation;
      if (selectedFloor !== 'All') params.floor = selectedFloor;
      if (selectedSection !== 'All') params.section = selectedSection;
      if (selectedStatus !== 'All') params.status = selectedStatus;
      if (selectedAuditor !== 'All') params.auditor = selectedAuditor;
      if (dateRange && dateRange !== 'custom') params.dateRange = dateRange;
      if (dateRange === 'custom') {
        if (dateFrom) params.dateFrom = dateFrom;
        if (dateTo) params.dateTo = dateTo;
      }

      const res = await API.getVmDashboard(params);
      if (res && res.success) {
        setDashboardData(res);
      }
    } catch (err: any) {
      console.error('[VM Dashboard Load Error]', err);
      if (!isSilent) showToast('Failed to load VM dashboard data: ' + (err.message || 'Server error'), 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedLocation, selectedFloor, selectedSection, selectedStatus, selectedAuditor, dateRange, dateFrom, dateTo]);

  // Load Audits Table
  const loadAuditsHistory = useCallback(async () => {
    setLoadingAudits(true);
    try {
      const params: any = {
        page: auditPage,
        limit: 15
      };
      if (selectedLocation !== 'All') params.locationId = selectedLocation;
      if (selectedFloor !== 'All') params.floor = selectedFloor;
      if (selectedSection !== 'All') params.section = selectedSection;
      if (selectedStatus !== 'All') params.status = selectedStatus;
      if (selectedAuditor !== 'All') params.auditor = selectedAuditor;
      if (searchQuery) params.search = searchQuery;
      if (dateRange && dateRange !== 'custom') params.dateRange = dateRange;
      if (dateRange === 'custom') {
        if (dateFrom) params.dateFrom = dateFrom;
        if (dateTo) params.dateTo = dateTo;
      }

      const res = await API.getVmAudits(params);
      if (res && res.success) {
        setAuditsList(res.audits || []);
        setTotalAuditsCount(res.pagination?.total || (res.audits || []).length);
      }
    } catch (err: any) {
      console.error('[VM Audits History Error]', err);
    } finally {
      setLoadingAudits(false);
    }
  }, [selectedLocation, selectedFloor, selectedSection, selectedStatus, selectedAuditor, searchQuery, dateRange, dateFrom, dateTo, auditPage]);

  // Trigger loads on filter change
  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadAuditsHistory();
    }
  }, [activeTab, loadAuditsHistory]);

  // Real-time synchronization: listen for live VM changes
  useEffect(() => {
    const handleRealtimeVm = () => {
      // Background silent update without full reload
      loadDashboard(true);
      if (activeTab === 'history') {
        loadAuditsHistory();
      }
    };

    window.addEventListener('realtime:vm', handleRealtimeVm);
    return () => {
      window.removeEventListener('realtime:vm', handleRealtimeVm);
    };
  }, [loadDashboard, loadAuditsHistory, activeTab]);

  // Export CSV handler
  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const params: any = {};
      if (selectedLocation !== 'All') params.locationId = selectedLocation;
      if (selectedFloor !== 'All') params.floor = selectedFloor;
      if (selectedSection !== 'All') params.section = selectedSection;
      if (selectedStatus !== 'All') params.status = selectedStatus;
      if (selectedAuditor !== 'All') params.auditor = selectedAuditor;
      if (dateRange && dateRange !== 'custom') params.dateRange = dateRange;
      if (dateRange === 'custom') {
        if (dateFrom) params.dateFrom = dateFrom;
        if (dateTo) params.dateTo = dateTo;
      }
      await API.exportVmAudits(params);
      showToast('VM Audits exported successfully', 'success');
    } catch (e: any) {
      showToast('Export failed: ' + (e.message || 'Server error'), 'error');
    } finally {
      setExporting(false);
    }
  };

  // Open Detailed Audit Modal
  const openAuditDetail = async (audit: any) => {
    setSelectedAuditForModal(audit);
    setLoadingModalDetail(true);
    try {
      const res = await API.getVmAuditDetail(audit.id);
      if (res && res.success && res.audit) {
        setSelectedAuditForModal(res.audit);
      }
    } catch (e) {
      console.error('Failed to fetch full audit details:', e);
    } finally {
      setLoadingModalDetail(false);
    }
  };

  // Open Lightbox
  const openLightbox = (photos: any[], index = 0) => {
    if (!photos || photos.length === 0) return;
    setLightboxPhotos(photos);
    setLightboxIndex(index);
    setLightboxZoom(1);
    setLightboxOpen(true);
  };

  // Photo Delete Action
  const handleDeletePhoto = async (photo: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!photo || !photo.id) return;
    const confirmMsg = `Are you sure you want to delete this VM audit photo?\nStore: ${photo.locationName || 'Store'}\nFloor: ${photo.floor} — Section: ${photo.section}\nThis will permanently remove it from the audit records.`;
    if (!window.confirm(confirmMsg)) return;

    setDeletingPhotoId(photo.id);
    try {
      // 1. Optimistic UI update without waiting for API
      setDashboardData((prev: any) => ({
        ...prev,
        summaryCards: {
          ...prev.summaryCards,
          imagesUploaded: Math.max(0, (prev.summaryCards?.imagesUploaded || 1) - 1)
        },
        photoTimeline: (prev.photoTimeline || []).filter((p: any) => p.id !== photo.id),
        recentActivity: (prev.recentActivity || []).map((act: any) => ({
          ...act,
          photos: (act.photos || []).filter((p: any) => p.id !== photo.id)
        }))
      }));

      // If open in lightbox, update or close lightbox
      if (lightboxOpen) {
        setLightboxPhotos(prev => {
          const updated = prev.filter(p => p.id !== photo.id);
          if (updated.length === 0) {
            setLightboxOpen(false);
          } else if (lightboxIndex >= updated.length) {
            setLightboxIndex(Math.max(0, updated.length - 1));
          }
          return updated;
        });
      }

      // 2. Call backend delete API
      await API.deleteVmPhoto(photo.id);
      showToast('VM audit photo deleted successfully', 'success');

      // 3. Silent background refresh of metrics (NO page reload)
      loadDashboard(true);
      if (activeTab === 'history') {
        loadAuditsHistory();
      }
    } catch (err: any) {
      showToast('Failed to delete photo: ' + (err.message || 'Server error'), 'error');
      loadDashboard(true);
    } finally {
      setDeletingPhotoId(null);
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    if (isAdmin) setSelectedLocation('All');
    setSelectedFloor('All');
    setSelectedSection('All');
    setDateRange('month');
    setDateFrom('');
    setDateTo('');
    setSelectedStatus('All');
    setSelectedAuditor('All');
    setSearchQuery('');
  };

  const { summaryCards, charts, recentActivity = [], photoTimeline = [] } = dashboardData;

  return (
    <DashboardLayout title="Visual Merchandising Dashboard">
      <div className="space-y-6 pb-12 animate-fade-in">
        {/* ── Top Header & Actions ── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-primary via-primary-dark to-[#4A0E17] text-white p-6 rounded-2xl shadow-xl relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-inner">
                <Building2 className="w-7 h-7 text-accent" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
                    Visual Merchandising Dashboard
                  </h1>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE DATA
                  </span>
                </div>
                <p className="text-xs text-white/80 font-medium mt-1">
                  Real-time store audits, section compliance, floor standards & photo verification across BSC Textiles.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Action Navigation Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 relative z-10">
            <button
              onClick={() => navigate('/vm-checklist')}
              className="px-4 py-2.5 bg-accent hover:bg-accent/90 text-primary font-bold text-xs rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
            >
              <ClipboardList className="w-4 h-4" />
              <span>Perform VM Audit</span>
            </button>
            <button
              onClick={() => navigate('/vm-checklist?tab=gallery')}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/20 backdrop-blur-md transition-all flex items-center gap-2"
            >
              <ImageIcon className="w-4 h-4 text-accent" />
              <span>Audit Photos</span>
            </button>
            <button
              onClick={handleExportCsv}
              disabled={exporting}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/20 backdrop-blur-md transition-all flex items-center gap-2 disabled:opacity-50"
              title="Export Current VM Audits to CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>{exporting ? 'Exporting...' : 'Export CSV'}</span>
            </button>
            <button
              onClick={() => loadDashboard(false)}
              disabled={refreshing}
              className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/20 backdrop-blur-md transition-all"
              title="Refresh Live Metrics"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-accent' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── Interactive Live Filters ── */}
        <div className="card-glass p-4 bg-white/80 border border-primary/10 shadow-sm rounded-2xl">
          <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-primary/10">
            <div className="flex items-center gap-2 text-xs font-bold text-primary">
              <SlidersHorizontal className="w-4 h-4 text-accent" />
              <span>Live Dashboard Filters</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleResetFilters}
                className="text-[11px] font-bold text-primary/60 hover:text-primary flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
            {/* Store / Location Filter */}
            <div>
              <label className="block text-[10px] font-black uppercase text-primary/60 mb-1">Store / Location</label>
              <select
                value={selectedLocation}
                onChange={e => setSelectedLocation(e.target.value)}
                disabled={!isAdmin && Boolean(userLocationId)}
                className="select-modern text-xs w-full bg-white shadow-sm font-medium"
              >
                {isAdmin && <option value="All">All Locations</option>}
                {storeLocations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name} ({loc.code})</option>
                ))}
              </select>
            </div>

            {/* Floor Filter */}
            <div>
              <label className="block text-[10px] font-black uppercase text-primary/60 mb-1">Store Floor</label>
              <select
                value={selectedFloor}
                onChange={e => {
                  setSelectedFloor(e.target.value);
                  setSelectedSection('All');
                }}
                className="select-modern text-xs w-full bg-white shadow-sm font-medium"
              >
                <option value="All">All Floors</option>
                {floorsMaster.map(f => (
                  <option key={f.name} value={f.name}>{f.name}</option>
                ))}
              </select>
            </div>

            {/* Section Filter */}
            <div>
              <label className="block text-[10px] font-black uppercase text-primary/60 mb-1">Section</label>
              <select
                value={selectedSection}
                onChange={e => setSelectedSection(e.target.value)}
                className="select-modern text-xs w-full bg-white shadow-sm font-medium"
              >
                <option value="All">All Sections</option>
                {availableSections.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Date Range Preset */}
            <div>
              <label className="block text-[10px] font-black uppercase text-primary/60 mb-1">Date Period</label>
              <select
                value={dateRange}
                onChange={e => setDateRange(e.target.value)}
                className="select-modern text-xs w-full bg-white shadow-sm font-medium"
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="last_month">Previous Month</option>
                <option value="custom">Custom Date Range</option>
                <option value="">All Time</option>
              </select>
            </div>

            {/* Audit Status */}
            <div>
              <label className="block text-[10px] font-black uppercase text-primary/60 mb-1">Audit Status</label>
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="select-modern text-xs w-full bg-white shadow-sm font-medium"
              >
                <option value="All">All Statuses</option>
                <option value="Passed">Passed (≥80%)</option>
                <option value="Review">Needs Review (50-79%)</option>
                <option value="Failed">Failed (&lt;50%)</option>
              </select>
            </div>

            {/* Custom Date From (if custom) */}
            {dateRange === 'custom' ? (
              <>
                <div>
                  <label className="block text-[10px] font-black uppercase text-primary/60 mb-1">From Date</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="input-modern text-xs w-full bg-white shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-primary/60 mb-1">To Date</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    className="input-modern text-xs w-full bg-white shadow-sm"
                  />
                </div>
              </>
            ) : (
              <div className="col-span-2 flex items-end">
                <div className="text-[11px] text-primary/60 italic pb-2">
                  Showing live data for <strong className="text-primary font-bold">{dateRange ? dateRange.replace('_', ' ') : 'all time'}</strong>.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Main View Tabs (Overview / Activity / History) ── */}
        <div className="flex border-b border-primary/10 gap-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'overview'
                ? 'border-accent text-primary font-black'
                : 'border-transparent text-primary/60 hover:text-primary'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-accent" />
            <span>Executive KPI Overview</span>
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`pb-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'activity'
                ? 'border-accent text-primary font-black'
                : 'border-transparent text-primary/60 hover:text-primary'
            }`}
          >
            <ImageIcon className="w-4 h-4 text-accent" />
            <span>Live Audit Photo Timeline</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary font-bold">
              {photoTimeline.length > 0 ? photoTimeline.length : summaryCards.imagesUploaded}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'history'
                ? 'border-accent text-primary font-black'
                : 'border-transparent text-primary/60 hover:text-primary'
            }`}
          >
            <ClipboardList className="w-4 h-4 text-accent" />
            <span>Complete Audit Records</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-accent/20 text-accent font-bold">
              {summaryCards.totalAudits}
            </span>
          </button>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            TAB 1: EXECUTIVE KPI OVERVIEW & CHARTS
        ───────────────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Top Stat Cards (Calculated Strictly from Live Data) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
              {/* Card 1: Total Audits */}
              <div className="card-glass p-4 bg-white/90 border border-primary/10 shadow-sm rounded-2xl hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between text-primary/60 mb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider">Total VM Audits</span>
                  <div className="p-1.5 rounded-lg bg-primary/5 text-primary">
                    <ClipboardList className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-primary">
                  {summaryCards.totalAudits}
                </div>
                <div className="text-[10px] font-medium text-primary/60 mt-1 flex items-center justify-between">
                  <span>Today: <strong className="text-primary font-bold">{summaryCards.auditsToday}</strong></span>
                  <span>7D: <strong className="text-primary font-bold">{summaryCards.auditsThisWeek}</strong></span>
                </div>
              </div>

              {/* Card 2: Average Score */}
              <div className="card-glass p-4 bg-white/90 border border-primary/10 shadow-sm rounded-2xl hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between text-primary/60 mb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider">Average VM Score</span>
                  <div className="p-1.5 rounded-lg bg-accent/10 text-accent">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-primary">
                    {summaryCards.averageScore}%
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    summaryCards.averageScore >= 80 ? 'bg-emerald-100 text-emerald-800' :
                    summaryCards.averageScore >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {summaryCards.averageScore >= 80 ? 'Pass' : summaryCards.averageScore >= 50 ? 'Review' : 'Fail'}
                  </span>
                </div>
                <div className="w-full bg-primary/10 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      summaryCards.averageScore >= 80 ? 'bg-emerald-600' :
                      summaryCards.averageScore >= 50 ? 'bg-amber-500' : 'bg-rose-600'
                    }`}
                    style={{ width: `${Math.min(100, summaryCards.averageScore)}%` }}
                  />
                </div>
              </div>

              {/* Card 3: Compliance Percentage */}
              <div className="card-glass p-4 bg-white/90 border border-primary/10 shadow-sm rounded-2xl hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between text-primary/60 mb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider">Store Compliance</span>
                  <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-emerald-700">
                  {summaryCards.compliancePercentage}%
                </div>
                <div className="text-[10px] font-medium text-emerald-800/80 mt-1">
                  Passed audits (score ≥80%)
                </div>
              </div>

              {/* Card 4: Passed vs Failed */}
              <div className="card-glass p-4 bg-white/90 border border-primary/10 shadow-sm rounded-2xl hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between text-primary/60 mb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider">Audit Results</span>
                  <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div>
                    <span className="text-xs font-bold text-emerald-700 block">Passed</span>
                    <span className="text-lg font-bold text-emerald-800">{summaryCards.completedAudits}</span>
                  </div>
                  <div className="w-px h-7 bg-primary/10" />
                  <div>
                    <span className="text-xs font-bold text-amber-700 block">Review</span>
                    <span className="text-lg font-bold text-amber-800">{summaryCards.pendingAudits}</span>
                  </div>
                </div>
              </div>

              {/* Card 5: Sections Audited */}
              <div className="card-glass p-4 bg-white/90 border border-primary/10 shadow-sm rounded-2xl hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between text-primary/60 mb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider">Sections Covered</span>
                  <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
                    <Layers className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-primary">
                  {summaryCards.sectionsAudited}
                </div>
                <div className="text-[10px] font-medium text-primary/60 mt-1">
                  Across {summaryCards.floorsAudited} floor(s)
                </div>
              </div>

              {/* Card 6: Attached Verification Photos */}
              <div className="card-glass p-4 bg-white/90 border border-primary/10 shadow-sm rounded-2xl hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between text-primary/60 mb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider">Verified Photos</span>
                  <div className="p-1.5 rounded-lg bg-accent/10 text-accent">
                    <Camera className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-accent">
                  {summaryCards.imagesUploaded}
                </div>
                <div className="text-[10px] font-medium text-primary/60 mt-1">
                  Attached to live audits
                </div>
              </div>
            </div>

            {/* ── Main Charts Grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Chart 1: Floor Performance Bar Chart */}
              <div className="card-glass p-5 bg-white border border-primary/10 rounded-2xl shadow-sm lg:col-span-2">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-primary/10">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-primary">Floor Performance Breakdown</h3>
                    <p className="text-xs text-primary/60 mt-0.5">Average score (%) and audit volume by floor</p>
                  </div>
                  <span className="text-xs font-bold text-accent px-2 py-0.5 rounded bg-accent/10">
                    Live Score Comparison
                  </span>
                </div>
                {charts.floorPerformance && charts.floorPerformance.length > 0 ? (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={charts.floorPerformance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0ede9" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#3E2723' }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#3E2723' }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#2C1810', color: '#fff', borderRadius: 8, fontSize: 12 }}
                          formatter={(value: any, name: any) => [
                            name === 'score' ? `${value}%` : value,
                            name === 'score' ? 'Avg Score' : 'Total Audits'
                          ]}
                        />
                        <Bar dataKey="score" name="score" fill="#B8860B" radius={[6, 6, 0, 0]}>
                          {charts.floorPerformance.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.score >= 80 ? '#2D8659' : entry.score >= 50 ? '#D4AF37' : '#C0392B'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-primary/40 text-xs">
                    <Building2 className="w-8 h-8 mb-2 opacity-50" />
                    <span>No floor audit data available for current filters</span>
                  </div>
                )}
              </div>

              {/* Chart 2: Score Distribution Donut */}
              <div className="card-glass p-5 bg-white border border-primary/10 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-primary/10">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-primary">Score Distribution</h3>
                    <p className="text-xs text-primary/60 mt-0.5">Audit compliance categories</p>
                  </div>
                </div>
                {charts.scoreDistribution && charts.scoreDistribution.length > 0 ? (
                  <div className="h-64 w-full flex flex-col items-center justify-center">
                    <ResponsiveContainer width="100%" height="80%">
                      <PieChart>
                        <Pie
                          data={charts.scoreDistribution}
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {charts.scoreDistribution.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.fill || '#B8860B'} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: '#2C1810', color: '#fff', borderRadius: 8, fontSize: 12 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] font-bold mt-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#2D8659]" />
                        <span>Passed (≥80%)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#F39C12]" />
                        <span>Review (50-79%)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#C0392B]" />
                        <span>Failed (&lt;50%)</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-primary/40 text-xs">
                    <CheckCircle2 className="w-8 h-8 mb-2 opacity-50" />
                    <span>No audit results to display</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Charts Row 2: 30-Day Trend & Store Comparison ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Daily Audit Trend */}
              <div className="card-glass p-5 bg-white border border-primary/10 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-primary/10">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-primary">Audit Score & Volume Trend</h3>
                    <p className="text-xs text-primary/60 mt-0.5">Chronological timeline of daily inspection averages</p>
                  </div>
                </div>
                {charts.auditTrend && charts.auditTrend.length > 0 ? (
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={charts.auditTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#D4AF37" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0ede9" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#3E2723' }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#3E2723' }} />
                        <Tooltip contentStyle={{ backgroundColor: '#2C1810', color: '#fff', borderRadius: 8, fontSize: 12 }} />
                        <Area type="monotone" dataKey="score" stroke="#B8860B" strokeWidth={2} fillOpacity={1} fill="url(#scoreGrad)" name="Avg Score (%)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-60 flex flex-col items-center justify-center text-primary/40 text-xs">
                    <TrendingUp className="w-8 h-8 mb-2 opacity-50" />
                    <span>No timeline data recorded yet</span>
                  </div>
                )}
              </div>

              {/* Multi-Store Comparison */}
              <div className="card-glass p-5 bg-white border border-primary/10 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-primary/10">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-primary">Store Location Comparison</h3>
                    <p className="text-xs text-primary/60 mt-0.5">Performance across Belagavi, Davanagere & Shivamogga</p>
                  </div>
                </div>
                {charts.storePerformance && charts.storePerformance.length > 0 ? (
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={charts.storePerformance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0ede9" />
                        <XAxis dataKey="store" tick={{ fontSize: 11, fill: '#3E2723' }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#3E2723' }} />
                        <Tooltip contentStyle={{ backgroundColor: '#2C1810', color: '#fff', borderRadius: 8, fontSize: 12 }} />
                        <Bar dataKey="score" name="Avg Score (%)" fill="#722F37" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="audits" name="Total Audits" fill="#D4AF37" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-60 flex flex-col items-center justify-center text-primary/40 text-xs">
                    <Store className="w-8 h-8 mb-2 opacity-50" />
                    <span>Store performance data unavailable</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Question-Level Compliance Standards ── */}
            <div className="card-glass p-5 bg-white border border-primary/10 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-primary/10">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-primary">
                    10-Point Visual Merchandising Compliance Breakdown
                  </h3>
                  <p className="text-xs text-primary/60 mt-0.5">Passing rate across standard inspection checkpoints</p>
                </div>
              </div>

              {charts.questionCompliance && charts.questionCompliance.length > 0 ? (
                <div className="space-y-3">
                  {charts.questionCompliance.map((q: any) => (
                    <div key={q.id || q.number} className="p-3 bg-primary/[0.02] border border-primary/10 rounded-xl hover:bg-primary/[0.04] transition-colors">
                      <div className="flex items-center justify-between gap-4 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-accent/20 text-accent font-black text-[11px] flex items-center justify-center">
                            {q.number}
                          </span>
                          <span className="text-xs font-bold text-primary">{q.title}</span>
                        </div>
                        <div className="flex items-center gap-3 text-right">
                          <span className="text-xs font-black text-primary font-mono">{q.passPercent}%</span>
                          <span className="text-[10px] text-primary/60 font-medium">({q.passCount} pass / {q.failCount} fail)</span>
                        </div>
                      </div>
                      <div className="w-full bg-primary/10 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            q.passPercent >= 80 ? 'bg-emerald-600' :
                            q.passPercent >= 50 ? 'bg-amber-500' : 'bg-rose-600'
                          }`}
                          style={{ width: `${q.passPercent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-primary/40 text-xs">
                  Checklist question statistics will appear as audits are recorded.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 2: LIVE AUDIT PHOTO TIMELINE & RECENT ACTIVITY
        ───────────────────────────────────────────────────────────── */}
        {activeTab === 'activity' && (
          <div className="space-y-6">
            {/* Subheader with title, real-time counter, and view mode toggles */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-primary/10 shadow-xs">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black uppercase tracking-wider text-primary">
                    Live Audit Photo Timeline
                  </h3>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    LIVE CHRONOLOGICAL
                  </span>
                </div>
                <p className="text-xs text-primary/60 mt-0.5">
                  Real-time photo stream from VM inspections across stores (newest photos first)
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <div className="flex items-center bg-primary/5 p-1 rounded-xl border border-primary/10">
                  <button
                    type="button"
                    onClick={() => setTimelineViewMode('photos')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      timelineViewMode === 'photos'
                        ? 'bg-primary text-white shadow-xs'
                        : 'text-primary/70 hover:text-primary'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Photo Cards ({photoTimeline.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimelineViewMode('audits')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      timelineViewMode === 'audits'
                        ? 'bg-primary text-white shadow-xs'
                        : 'text-primary/70 hover:text-primary'
                    }`}
                  >
                    <ListFilter className="w-3.5 h-3.5" />
                    <span>Audit Feeds ({recentActivity.length})</span>
                  </button>
                </div>
              </div>
            </div>

            {/* MODE 1: PHOTO TIMELINE CARDS */}
            {timelineViewMode === 'photos' && (
              <>
                {photoTimeline && photoTimeline.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4.5">
                    {photoTimeline.map((photo: any, idx: number) => {
                      const photoScore = photo.scorePercent !== null && photo.scorePercent !== undefined ? Number(photo.scorePercent) : null;
                      const isPassing = photoScore !== null ? photoScore >= 80 : null;
                      const isReview = photoScore !== null ? photoScore >= 50 && photoScore < 80 : null;

                      return (
                        <div
                          key={photo.id}
                          className="card-glass bg-white border border-primary/15 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                        >
                          {/* Card Header: Store Location & Status */}
                          <div className="p-3 bg-gradient-to-r from-primary/5 via-accent/5 to-transparent border-b border-primary/10 flex items-center justify-between">
                            <div className="flex items-center gap-1.5 truncate">
                              <Store className="w-3.5 h-3.5 text-accent shrink-0" />
                              <span className="text-xs font-black text-primary truncate">
                                {photo.locationName || 'BSC Store'}
                              </span>
                              {photo.locationCode && (
                                <span className="text-[10px] text-primary/60 font-bold shrink-0">
                                  ({photo.locationCode})
                                </span>
                              )}
                            </div>
                            {photoScore !== null ? (
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 ${
                                isPassing ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                isReview ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                                'bg-rose-100 text-rose-800 border border-rose-300'
                              }`}>
                                {photoScore}% • {photo.status || (isPassing ? 'Passed' : 'Review')}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/25 shrink-0">
                                {photo.status || 'Verified'}
                              </span>
                            )}
                          </div>

                          {/* Thumbnail Stage with Lazy Loading */}
                          <div
                            onClick={() => openLightbox(photoTimeline, idx)}
                            className="relative aspect-[4/3] bg-primary/5 overflow-hidden cursor-pointer group/img"
                          >
                            <img
                              src={photo.streamUrl || API.getVmPhotoFileUrl(photo.id)}
                              alt={photo.fileName || 'VM Audit Photo'}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white">
                              <div className="px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-xs text-xs font-bold flex items-center gap-1.5">
                                <Maximize2 className="w-3.5 h-3.5 text-accent" />
                                <span>Preview Full Image</span>
                              </div>
                            </div>

                            {/* Bottom overlay on image: Shift */}
                            <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold">
                              {photo.shift || 'Opening'} Shift
                            </div>
                          </div>

                          {/* Card Body Details */}
                          <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
                            <div className="space-y-1">
                              <div className="text-xs font-black text-primary">
                                {photo.floor}
                              </div>
                              <div className="text-xs text-accent font-bold truncate" title={photo.section}>
                                {photo.section}
                              </div>
                              <div className="flex items-center gap-1.5 text-[10.5px] text-primary/70 font-mono pt-1">
                                <span className="text-primary/40 font-sans">Audit ID:</span>
                                <span className="font-bold text-primary truncate max-w-[150px]">
                                  {photo.submissionId ? `#${photo.submissionId}` : '—'}
                                </span>
                              </div>
                              {photo.pointId && (
                                <div className="text-[10px] text-primary/60 font-semibold flex items-center gap-1">
                                  <Tag className="w-3 h-3 text-accent" />
                                  <span>Question Point #{photo.pointId}</span>
                                </div>
                              )}
                            </div>

                            {/* Auditor & Timestamp */}
                            <div className="pt-2 border-t border-primary/10 flex items-center justify-between text-[10.5px] text-primary/60">
                              <div className="flex items-center gap-1 truncate" title={photo.uploadedBy}>
                                <UserCheck className="w-3 h-3 text-accent shrink-0" />
                                <span className="font-bold text-primary/80 truncate">{photo.uploadedBy || 'Auditor'}</span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0 text-[10px]">
                                <Clock className="w-3 h-3 text-primary/40" />
                                <span>
                                  {photo.createdAt
                                    ? new Date(photo.createdAt).toLocaleString(undefined, {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })
                                    : photo.inspectionDate || '—'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Card Actions Footer */}
                          <div className="p-2.5 bg-primary/[0.02] border-t border-primary/10 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => openLightbox(photoTimeline, idx)}
                              className="text-xs font-bold text-primary hover:text-accent flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-primary/5 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-accent" />
                              <span>Inspect</span>
                            </button>

                            {canDeletePhotos && (
                              <button
                                type="button"
                                onClick={(e) => handleDeletePhoto(photo, e)}
                                disabled={deletingPhotoId === photo.id}
                                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs font-bold flex items-center gap-1 transition-colors px-2 py-1 rounded-lg cursor-pointer disabled:opacity-50"
                                title="Delete photo from audit"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>{deletingPhotoId === photo.id ? 'Deleting…' : 'Delete'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-16 text-center text-primary/40 card-glass bg-white rounded-2xl border border-primary/10">
                    <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-40 text-accent" />
                    <h4 className="text-sm font-bold text-primary">No VM audit photos available for the selected filters.</h4>
                    <p className="text-xs text-primary/60 mt-1 max-w-sm mx-auto">
                      Photos uploaded or captured during floor visual merchandising inspections will appear here automatically in real time.
                    </p>
                    <button
                      onClick={() => navigate('/vm-checklist')}
                      className="mt-4 px-4 py-2 bg-accent text-primary font-bold text-xs rounded-xl shadow hover:bg-accent/90 transition-all cursor-pointer"
                    >
                      Start New Audit
                    </button>
                  </div>
                )}
              </>
            )}

            {/* MODE 2: AUDIT INSPECTION FEED */}
            {timelineViewMode === 'audits' && (
              <>
                {recentActivity && recentActivity.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {recentActivity.map((item: any) => (
                      <div
                        key={item.id}
                        className="card-glass bg-white border border-primary/15 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                      >
                        <div>
                          {/* Store & Floor Header */}
                          <div className="p-4 bg-gradient-to-r from-primary/5 via-accent/5 to-transparent border-b border-primary/10 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Store className="w-4 h-4 text-accent" />
                              <span className="text-xs font-black text-primary">{item.locationName}</span>
                              <span className="text-[10px] text-primary/60 font-bold">({item.locationCode})</span>
                            </div>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                              item.scorePercent >= 80 ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                              item.scorePercent >= 50 ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                              'bg-rose-100 text-rose-800 border border-rose-300'
                            }`}>
                              {item.scorePercent}% • {item.status}
                            </span>
                          </div>

                          {/* Content */}
                          <div className="p-4 space-y-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="text-xs font-black text-primary">{item.floor}</div>
                                <div className="text-xs text-accent font-bold mt-0.5">{item.section}</div>
                              </div>
                              <span className="text-[10px] font-semibold text-primary/60 bg-primary/5 px-2 py-0.5 rounded">
                                {item.shift} Shift
                              </span>
                            </div>

                            {item.remarks && (
                              <p className="text-xs text-primary/80 italic bg-primary/[0.02] p-2.5 rounded-xl border border-primary/10">
                                &ldquo;{item.remarks}&rdquo;
                              </p>
                            )}

                            {/* Image Preview Grid */}
                            {item.photos && item.photos.length > 0 ? (
                              <div>
                                <span className="block text-[10px] font-black uppercase text-primary/60 mb-1.5">
                                  Attached Audit Photos ({item.photos.length})
                                </span>
                                <div className="grid grid-cols-3 gap-2">
                                  {item.photos.slice(0, 3).map((p: any, idx: number) => (
                                    <div
                                      key={p.id}
                                      onClick={() => openLightbox(item.photos, idx)}
                                      className="relative aspect-square rounded-xl overflow-hidden cursor-pointer group border border-primary/20 shadow-sm"
                                    >
                                      <img
                                        src={p.streamUrl || API.getVmPhotoFileUrl(p.id)}
                                        alt="VM audit"
                                        loading="lazy"
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                      />
                                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                        <Maximize2 className="w-4 h-4" />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="p-3 bg-primary/[0.02] border border-dashed border-primary/10 rounded-xl text-center text-primary/40 text-[11px]">
                                No photo attached to this audit
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Footer Info */}
                        <div className="p-3.5 bg-primary/[0.02] border-t border-primary/10 flex items-center justify-between text-[11px] text-primary/70">
                          <div className="flex items-center gap-1.5">
                            <UserCheck className="w-3.5 h-3.5 text-accent" />
                            <span className="font-bold">{item.submittedBy || 'Auditor'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span>{item.entryDate}</span>
                            <button
                              onClick={() => openAuditDetail(item)}
                              className="text-accent hover:text-accent/80 font-bold flex items-center gap-0.5 ml-1 cursor-pointer"
                            >
                              <span>Inspect</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-16 text-center text-primary/40 card-glass bg-white rounded-2xl border border-primary/10">
                    <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-40 text-accent" />
                    <h4 className="text-sm font-bold text-primary">No recent audit activity found</h4>
                    <p className="text-xs text-primary/60 mt-1 max-w-sm mx-auto">
                      Perform a VM audit from the checklist screen to see live entries and inspection photos here.
                    </p>
                    <button
                      onClick={() => navigate('/vm-checklist')}
                      className="mt-4 px-4 py-2 bg-accent text-primary font-bold text-xs rounded-xl shadow cursor-pointer"
                    >
                      Start New Audit
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 3: COMPLETE AUDIT RECORDS TABLE
        ───────────────────────────────────────────────────────────── */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {/* Search & Export toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-primary/10 shadow-sm">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-primary/40 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search auditor, remarks, section..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="input-modern text-xs w-full pl-9 bg-white"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <span className="text-xs text-primary/60 font-medium">
                  Showing <strong>{auditsList.length}</strong> of <strong>{totalAuditsCount}</strong> records
                </span>
                <button
                  onClick={handleExportCsv}
                  disabled={exporting}
                  className="btn-outline text-xs flex items-center gap-1.5 py-1.5 px-3"
                >
                  <Download className="w-3.5 h-3.5 text-accent" />
                  <span>Export</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="card-glass bg-white border border-primary/15 rounded-2xl shadow-sm overflow-hidden">
              <div className="table-frame custom-scrollbar">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-primary/5 border-b border-primary/10 text-primary font-black uppercase text-[10px] tracking-wider">
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-4">Store</th>
                      <th className="py-3.5 px-4">Floor & Section</th>
                      <th className="py-3.5 px-4">Shift</th>
                      <th className="py-3.5 px-4">Score</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Auditor</th>
                      <th className="py-3.5 px-4 text-center">Photos</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/5">
                    {loadingAudits ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-primary/50">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-accent" />
                          <span>Loading inspection audits...</span>
                        </td>
                      </tr>
                    ) : auditsList.length > 0 ? (
                      auditsList.map((audit) => (
                        <tr key={audit.id} className="hover:bg-primary/[0.02] transition-colors">
                          <td className="py-3.5 px-4 font-mono font-medium text-primary">
                            {audit.entryDate || (audit.createdAt ? new Date(audit.createdAt).toISOString().split('T')[0] : '—')}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-primary">
                            {audit.locationName || `Store #${audit.location_id}`}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-primary">{audit.floor}</div>
                            <div className="text-[11px] text-accent font-medium">{audit.section}</div>
                          </td>
                          <td className="py-3.5 px-4 text-primary/70">{audit.shift || 'Opening'}</td>
                          <td className="py-3.5 px-4">
                            <span className="font-black text-primary font-mono text-sm">
                              {Number(audit.scorePercent || 0)}%
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                              Number(audit.scorePercent || 0) >= 80 ? 'bg-emerald-100 text-emerald-800' :
                              Number(audit.scorePercent || 0) >= 50 ? 'bg-amber-100 text-amber-800' :
                              'bg-rose-100 text-rose-800'
                            }`}>
                              {audit.status || (Number(audit.scorePercent || 0) >= 80 ? 'Passed' : 'Review')}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-medium text-primary/80">
                            {audit.submittedBy || 'Auditor'}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {audit.photos && audit.photos.length > 0 ? (
                              <button
                                onClick={() => openLightbox(audit.photos)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent/15 text-primary text-[10px] font-bold hover:bg-accent/25 transition-colors"
                              >
                                <Camera className="w-3 h-3 text-accent" />
                                <span>{audit.photos.length}</span>
                              </button>
                            ) : (
                              <span className="text-primary/30 text-[11px]">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => openAuditDetail(audit)}
                              className="btn-outline text-[11px] font-bold py-1 px-2.5 rounded-lg text-primary hover:text-accent"
                            >
                              <Eye className="w-3.5 h-3.5 inline mr-1" />
                              <span>View</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-primary/40">
                          <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <span>No VM audits match the selected filters</span>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalAuditsCount > 15 && (
                <div className="p-4 border-t border-primary/10 flex items-center justify-between">
                  <span className="text-xs text-primary/60">
                    Page <strong>{auditPage}</strong> of <strong>{Math.ceil(totalAuditsCount / 15)}</strong>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setAuditPage(p => Math.max(1, p - 1))}
                      disabled={auditPage === 1}
                      className="btn-outline text-xs px-2.5 py-1 disabled:opacity-40"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setAuditPage(p => p + 1)}
                      disabled={auditPage >= Math.ceil(totalAuditsCount / 15)}
                      className="btn-outline text-xs px-2.5 py-1 disabled:opacity-40"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── AUDIT DETAIL INSPECTION MODAL ── */}
        {selectedAuditForModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-primary/20">
              {/* Modal Header */}
              <div className="p-5 bg-gradient-to-r from-primary to-primary-dark text-white flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold">Audit Detail Inspection</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      selectedAuditForModal.scorePercent >= 80 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                      selectedAuditForModal.scorePercent >= 50 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                      'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}>
                      {selectedAuditForModal.scorePercent}% • {selectedAuditForModal.status}
                    </span>
                  </div>
                  <p className="text-xs text-white/70 mt-0.5">
                    {selectedAuditForModal.floor} — {selectedAuditForModal.section} ({selectedAuditForModal.locationName})
                  </p>
                </div>
                <button
                  onClick={() => setSelectedAuditForModal(null)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-5">
                {/* Meta details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3.5 bg-primary/5 rounded-xl border border-primary/10 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-black text-primary/60 block">Auditor</span>
                    <strong className="text-primary">{selectedAuditForModal.submittedBy || 'Auditor'}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-black text-primary/60 block">Inspection Date</span>
                    <strong className="text-primary">{selectedAuditForModal.entryDate || '—'}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-black text-primary/60 block">Shift</span>
                    <strong className="text-primary">{selectedAuditForModal.shift || 'Opening'}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-black text-primary/60 block">Score</span>
                    <strong className="text-primary font-mono text-sm">{selectedAuditForModal.scorePercent}%</strong>
                  </div>
                </div>

                {selectedAuditForModal.remarks && (
                  <div className="p-3 bg-accent/5 border border-accent/20 rounded-xl">
                    <span className="text-[10px] uppercase font-black text-accent block mb-1">Auditor Remarks</span>
                    <p className="text-xs text-primary italic">&ldquo;{selectedAuditForModal.remarks}&rdquo;</p>
                  </div>
                )}

                {/* Question items */}
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-primary mb-2.5">
                    Question-Level Breakdown
                  </h4>
                  {loadingModalDetail ? (
                    <div className="py-8 text-center text-primary/50 text-xs">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-accent" />
                      Loading detailed response items...
                    </div>
                  ) : selectedAuditForModal.entries && selectedAuditForModal.entries.length > 0 ? (
                    <div className="space-y-2">
                      {selectedAuditForModal.entries.map((entry: any, i: number) => (
                        <div
                          key={entry.id || i}
                          className="p-3 rounded-xl border border-primary/10 bg-white flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="space-y-0.5">
                            <span className="font-bold text-primary">
                              {i + 1}. {entry.pointTitle}
                            </span>
                            {entry.remarks && (
                              <p className="text-[11px] text-primary/60 italic">Note: {entry.remarks}</p>
                            )}
                          </div>
                          <span className={`px-2 py-0.5 rounded font-black text-[10px] uppercase shrink-0 ${
                            entry.score === 'Pass' ? 'bg-emerald-100 text-emerald-800' :
                            entry.score === 'Fail' ? 'bg-rose-100 text-rose-800' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {entry.score}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-primary/50 italic py-2">
                      Detailed question responses not stored for this legacy submission.
                    </div>
                  )}
                </div>

                {/* Attached Photos */}
                {selectedAuditForModal.photos && selectedAuditForModal.photos.length > 0 && (
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-primary mb-2.5">
                      Attached Inspection Photos ({selectedAuditForModal.photos.length})
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                      {selectedAuditForModal.photos.map((photo: any, index: number) => (
                        <div
                          key={photo.id}
                          onClick={() => openLightbox(selectedAuditForModal.photos, index)}
                          className="relative aspect-video rounded-xl overflow-hidden cursor-pointer group border border-primary/20 shadow-sm"
                        >
                          <img
                            src={photo.streamUrl || API.getVmPhotoFileUrl(photo.id)}
                            alt="Audit photo"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <ZoomIn className="w-5 h-5" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-primary/5 border-t border-primary/10 flex justify-end">
                <button
                  onClick={() => setSelectedAuditForModal(null)}
                  className="px-4 py-2 bg-primary text-white font-bold text-xs rounded-xl"
                >
                  Close Inspection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── PHOTO LIGHTBOX MODAL ── */}
        {lightboxOpen && lightboxPhotos.length > 0 && (() => {
          const currentPhoto = lightboxPhotos[lightboxIndex] || {};
          const photoScore = currentPhoto.scorePercent !== null && currentPhoto.scorePercent !== undefined ? Number(currentPhoto.scorePercent) : null;
          return (
            <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between p-4 animate-fade-in">
              {/* Top Toolbar */}
              <div className="flex items-center justify-between text-white py-2 px-4 border-b border-white/10 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <ImageIcon className="w-5 h-5 text-accent" />
                  <span className="text-xs font-bold">
                    {lightboxIndex + 1} of {lightboxPhotos.length}
                  </span>
                  <span className="text-xs text-white/80 font-semibold">
                    {currentPhoto.locationName ? `${currentPhoto.locationName} • ` : ''}
                    {currentPhoto.floor} • {currentPhoto.section}
                  </span>
                  {currentPhoto.submissionId && (
                    <span className="text-[11px] font-mono text-accent bg-accent/20 px-2 py-0.5 rounded">
                      #{currentPhoto.submissionId}
                    </span>
                  )}
                  {photoScore !== null && (
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                      photoScore >= 80 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                      photoScore >= 50 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                      'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}>
                      {photoScore}% • {currentPhoto.status || (photoScore >= 80 ? 'Passed' : 'Review')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {canDeletePhotos && currentPhoto.id && (
                    <button
                      type="button"
                      onClick={(e) => handleDeletePhoto(currentPhoto, e)}
                      disabled={deletingPhotoId === currentPhoto.id}
                      className="p-1.5 rounded-lg bg-rose-600/30 hover:bg-rose-600/60 text-rose-200 hover:text-white transition-colors flex items-center gap-1 text-xs font-bold cursor-pointer disabled:opacity-50"
                      title="Delete Photo"
                    >
                      <Trash2 className="w-4 h-4 text-rose-400" />
                      <span>{deletingPhotoId === currentPhoto.id ? 'Deleting…' : 'Delete'}</span>
                    </button>
                  )}
                  <button
                    onClick={() => setLightboxZoom(z => Math.max(0.5, z - 0.25))}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setLightboxZoom(1)}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors cursor-pointer"
                    title="Reset Zoom"
                  >
                    {Math.round(lightboxZoom * 100)}%
                  </button>
                  <button
                    onClick={() => setLightboxZoom(z => Math.min(3, z + 0.25))}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setLightboxOpen(false)}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors ml-2 cursor-pointer"
                    title="Close Lightbox"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Main Image Stage */}
              <div className="relative flex-1 flex items-center justify-center overflow-hidden my-3">
                <img
                  src={currentPhoto.streamUrl || API.getVmPhotoFileUrl(currentPhoto.id)}
                  alt="VM Preview"
                  style={{ transform: `scale(${lightboxZoom})`, transition: 'transform 0.2s ease-out' }}
                  className="max-h-[76vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
                />

                {/* Prev / Next buttons */}
                {lightboxPhotos.length > 1 && (
                  <>
                    <button
                      onClick={() => {
                        setLightboxIndex(i => (i > 0 ? i - 1 : lightboxPhotos.length - 1));
                        setLightboxZoom(1);
                      }}
                      className="absolute left-4 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-all backdrop-blur-md cursor-pointer"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button
                      onClick={() => {
                        setLightboxIndex(i => (i < lightboxPhotos.length - 1 ? i + 1 : 0));
                        setLightboxZoom(1);
                      }}
                      className="absolute right-4 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-all backdrop-blur-md cursor-pointer"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </>
                )}
              </div>

              {/* Bottom Photo Metadata Caption */}
              <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs text-white/80">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-white">{currentPhoto.fileName || 'Audit Photo'}</span>
                  {currentPhoto.fileSize > 0 && (
                    <span className="text-white/60">({Math.round(currentPhoto.fileSize / 1024)} KB)</span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-[11px] flex-wrap">
                  {currentPhoto.uploadedBy && (
                    <span>Auditor: <strong className="text-accent">{currentPhoto.uploadedBy}</strong></span>
                  )}
                  {currentPhoto.createdAt && (
                    <span>Timestamp: <strong>{new Date(currentPhoto.createdAt).toLocaleString()}</strong></span>
                  )}
                  {currentPhoto.status && (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                      {currentPhoto.status}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </DashboardLayout>
  );
}
