import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../components/layouts/DashboardLayout';
import PageContainer from '../components/ui/PageContainer';
import { API, Auth, UserSession } from '../services/api';
import { showToast } from '../components/Toast';
import {
  CircleCheck, Circle, CircleAlert, Clock, CircleX, ChevronDown, ChevronRight,
  ChevronUp, Calendar, RefreshCw, Send, Save, Upload, X, Eye, FileText,
  ClipboardList, BarChart3, Zap, Target, TriangleAlert, Camera, Image,
  Settings, ArrowLeft, ArrowUp, ArrowDown, Plus, Edit2, Check, SquareCheck
} from 'lucide-react';

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; icon: React.FC<any> }> = {
  DONE:        { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300', icon: CircleCheck },
  NOT_DONE:    { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-300',     icon: CircleX },
  IN_PROGRESS: { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-300',   icon: Clock },
  POSTPONED:   { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-300',  icon: CircleAlert },
  PENDING:     { bg: 'bg-gray-50',    text: 'text-gray-600',    border: 'border-gray-200',    icon: Circle },
};

const MODULE_COLORS = [
  { bar: 'bg-primary', ring: 'border-primary', light: 'bg-blue-50' },
  { bar: 'bg-accent', ring: 'border-accent', light: 'bg-amber-50' },
  { bar: 'bg-emerald-600', ring: 'border-emerald-600', light: 'bg-emerald-50' },
  { bar: 'bg-purple-600', ring: 'border-purple-600', light: 'bg-purple-50' },
  { bar: 'bg-rose-600', ring: 'border-rose-600', light: 'bg-rose-50' },
  { bar: 'bg-teal-600', ring: 'border-teal-600', light: 'bg-teal-50' },
];

const COMPLIANCE_OPTIONS = [
  'Fully Followed',
  'Partially Followed',
  'Not Followed',
  'No Transaction',
  'Yet to Implement'
];

const ACCURACY_OPTIONS = [
  'Fully accurate',
  'Partly accurate',
  'Inaccurate',
  'NA'
];

const STATUS_OPTIONS = ['PENDING', 'IN_PROGRESS', 'DONE', 'NOT_DONE', 'POSTPONED'];

export default function DailyMCheck() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [session, setSession] = useState<any>(() => Auth.get());

  const [selectedDate, setSelectedDate] = useState(() => {
    const urlDate = searchParams.get('date');
    if (urlDate) return urlDate;
    const now = new Date();
    const ist = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (5.5 * 3600000));
    return ist.toISOString().split('T')[0];
  });
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [dashData, setDashData] = useState<any>(null);
  const [dashLoading, setDashLoading] = useState(true);

  // Module view
  const [selectedModule, setSelectedModule] = useState<any>(null);
  const [moduleData, setModuleData] = useState<any>(null);
  const [moduleLoading, setModuleLoading] = useState(false);

  // Checkpoint expansion
  const [expandedCheckpoint, setExpandedCheckpoint] = useState<number | null>(null);
  const [responses, setResponses] = useState<Record<number, any>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [submitAllLoading, setSubmitAllLoading] = useState(false);

  // Admin Configuration Modal
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminStructure, setAdminStructure] = useState<any[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminSelectedModId, setAdminSelectedModId] = useState<number | null>(null);
  const [editingCheckpoint, setEditingCheckpoint] = useState<any | null>(null);
  const [isAddingCheckpoint, setIsAddingCheckpoint] = useState(false);
  const [checkpointForm, setCheckpointForm] = useState<any>({
    checkpoint_title: '',
    checkpoint_description: '',
    responsible_department: '',
    responsible_person: '',
    scheduled_time: '',
    is_active: 1
  });

  // Load Dashboard
  const loadDashboard = useCallback(async () => {
    setDashLoading(true);
    try {
      const data = await API.getMCheckDashboard(selectedDate);
      if (data.success) {
        setDashData(data);
        const modIdFromUrl = searchParams.get('moduleId');
        if (modIdFromUrl && data.moduleStats) {
          const targetMod = data.moduleStats.find((m: any) => String(m.module_id) === modIdFromUrl);
          if (targetMod) {
            loadModule(targetMod);
          }
        }
      }
    } catch (e) {
      console.warn('MCheck dashboard load error', e);
    } finally {
      setDashLoading(false);
    }
  }, [selectedDate, searchParams]);

  // Load Module
  const loadModule = useCallback(async (mod: any) => {
    setModuleLoading(true);
    setSelectedModule(mod);
    try {
      const data = await API.getMCheckModuleDetail(mod.module_id || mod.id, selectedDate);
      if (data.success) {
        setModuleData(data);
        const initResp: Record<number, any> = {};
        for (const cp of data.checkpoints) {
          initResp[cp.id] = {
            compliance_status: cp.compliance_status || '',
            accuracy: cp.accuracy || '',
            remarks: cp.remarks || '',
            corrective_action: cp.corrective_action || '',
            photo_url: cp.photo_url || '',
            system_status: cp.system_status || 'PENDING',
          };
        }
        setResponses(initResp);
        setExpandedCheckpoint(null);
      }
    } catch (e) {
      showToast('Failed to load module', 'error');
    } finally {
      setModuleLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (!Auth.check()) { navigate('/login'); return; }
    setSession(Auth.get());
    loadDashboard();

    const handleLocChange = () => {
      loadDashboard();
    };
    window.addEventListener('bsc_location_changed', handleLocChange);
    return () => window.removeEventListener('bsc_location_changed', handleLocChange);
  }, [navigate, loadDashboard]);

  const handleSave = async (cpId: number, isSubmit: boolean) => {
    setSaving(prev => ({ ...prev, [cpId]: true }));
    try {
      const r = responses[cpId] || {};
      let autoStatus = r.system_status;
      if (isSubmit) {
        if (!autoStatus || autoStatus === 'PENDING' || autoStatus === 'IN_PROGRESS') {
          autoStatus = r.compliance_status === 'Not Followed' ? 'NOT_DONE' : 'DONE';
        }
      }
      const res = await API.saveMCheckResponse({
        checkpoint_id: cpId,
        response_date: selectedDate,
        compliance_status: r.compliance_status,
        accuracy: r.accuracy,
        remarks: r.remarks,
        corrective_action: r.corrective_action,
        photo_url: r.photo_url,
        system_status: autoStatus,
        is_submit: isSubmit,
        updated_by: session?.fullName || session?.username || 'User'
      });
      if (res.success) {
        showToast(isSubmit ? 'Checkpoint submitted successfully.' : 'Checkpoint draft saved successfully.', 'success');
        setResponses(prev => ({ ...prev, [cpId]: { ...prev[cpId], system_status: res.system_status } }));
        if (selectedModule) await loadModule(selectedModule);
        await loadDashboard();
        if (isSubmit) setExpandedCheckpoint(null);
      } else {
        showToast(res.error || 'Unable to save checkpoint. Please try again.', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Unable to save checkpoint. Please try again.', 'error');
    } finally {
      setSaving(prev => ({ ...prev, [cpId]: false }));
    }
  };

  const handlePhotoUpload = async (cpId: number, file: File) => {
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const res = await API.uploadMCheckPhoto(fd);
      if (res.success) {
        setResponses(prev => ({ ...prev, [cpId]: { ...prev[cpId], photo_url: res.photoUrl } }));
        showToast('Photo evidence uploaded successfully.', 'success');
      }
    } catch (e) {
      showToast('Photo upload failed. Please try again.', 'error');
    }
  };

  const handleSubmitAll = async () => {
    if (!selectedModule || !moduleData) return;
    if (!confirm(`Submit all checkpoints for ${moduleData.module.module_name}?`)) return;
    setSubmitAllLoading(true);
    try {
      const res = await API.submitAllMCheck({
        module_id: selectedModule.module_id || selectedModule.id,
        response_date: selectedDate,
        updated_by: session?.fullName || 'User'
      });
      if (res.success) {
        showToast(`${res.submitted} checkpoint(s) submitted successfully.`, 'success');
        await loadModule(selectedModule);
        await loadDashboard();
      } else {
        showToast(res.error || 'Submit failed. Please try again.', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Submit failed. Please try again.', 'error');
    } finally {
      setSubmitAllLoading(false);
    }
  };

  // Admin Config Functions
  const loadAdminStructure = async () => {
    setAdminLoading(true);
    setShowAdminModal(true);
    try {
      const res = await API.getMCheckAdminStructure();
      if (res.success) {
        setAdminStructure(res.structure || []);
        if (res.structure && res.structure.length > 0) {
          setAdminSelectedModId(res.structure[0].id);
        }
      }
    } catch (e) {
      showToast('Failed to load admin structure', 'error');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleSaveCheckpointAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminSelectedModId) return;
    const currentMod = adminStructure.find(m => m.id === adminSelectedModId);
    const clId = currentMod?.checklists?.[0]?.id || 1;

    try {
      const payload = {
        ...checkpointForm,
        id: editingCheckpoint?.id,
        module_id: adminSelectedModId,
        checklist_id: clId,
      };
      const res = await API.saveMCheckAdminCheckpoint(payload);
      if (res.success) {
        showToast('Checkpoint configuration saved successfully.', 'success');
        setIsAddingCheckpoint(false);
        setEditingCheckpoint(null);
        await loadAdminStructure();
        await loadDashboard();
        if (selectedModule) await loadModule(selectedModule);
      } else {
        showToast(res.error || 'Unable to save checkpoint configuration. Please try again.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Unable to save checkpoint configuration. Please try again.', 'error');
    }
  };

  const handleReorder = async (cpId: number, direction: 'up' | 'down') => {
    if (!adminSelectedModId) return;
    const currentMod = adminStructure.find(m => m.id === adminSelectedModId);
    if (!currentMod || !currentMod.checkpoints) return;
    const cps = [...currentMod.checkpoints];
    const idx = cps.findIndex(c => c.id === cpId);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === cps.length - 1) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const temp = cps[idx];
    cps[idx] = cps[targetIdx];
    cps[targetIdx] = temp;

    const orderPayload = cps.map((c, i) => ({ id: c.id, sort_order: i + 1 }));
    try {
      await API.reorderMCheckCheckpoints(orderPayload);
      await loadAdminStructure();
      if (selectedModule) await loadModule(selectedModule);
    } catch (e) {
      showToast('Failed to reorder', 'error');
    }
  };

  const KpiCard = ({ label, value, color, icon: Icon }: any) => (
    <div className="card-glass p-4 flex items-center gap-3 min-w-0 bg-white border border-gray-100 shadow-sm rounded-2xl">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-black text-primary leading-tight">{value}</div>
        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wide truncate">{label}</div>
      </div>
    </div>
  );

  const StatusBadge = ({ status }: { status: string }) => {
    const s = STATUS_COLORS[status] || STATUS_COLORS.PENDING;
    const Icon = s.icon;
    const displayLabel = status === 'IN_PROGRESS' ? 'In Progress' : status === 'NOT_DONE' ? 'Not Done' : status.charAt(0) + status.slice(1).toLowerCase();
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${s.bg} ${s.text} ${s.border}`}>
        <Icon className="w-3 h-3" />
        {displayLabel}
      </span>
    );
  };

  const kpi = dashData?.kpis;
  const moduleStats: any[] = dashData?.moduleStats || [];

  return (
    <DashboardLayout title="Daily MCheck">
      <PageContainer maxWidth="full">
        <div className="space-y-6">

          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-primary flex items-center gap-2">
                <ClipboardList className="w-7 h-7 text-accent" />
                Daily MCheck
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">Daily Management Checklist & Operational Verification System</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Date Selector */}
              <div className="relative">
                <button
                  onClick={() => setShowDatePicker(v => !v)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary text-primary text-sm font-bold bg-white shadow-sm hover:bg-primary hover:text-white transition-all"
                >
                  <Calendar className="w-4 h-4" />
                  {dashData?.dateDisplay || selectedDate}
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {showDatePicker && (
                  <div className="absolute right-0 top-11 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-4 w-72">
                    <div className="text-xs font-bold text-gray-500 mb-2">SELECT DATE</div>
                    <input
                      type="date"
                      value={selectedDate}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={e => {
                        setSelectedDate(e.target.value);
                        setShowDatePicker(false);
                        setSelectedModule(null);
                        setModuleData(null);
                      }}
                      className="w-full input-modern mb-3"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      {[['Today', 0], ['Yesterday', 1]].map(([label, offset]) => (
                        <button
                          key={label as string}
                          onClick={() => {
                            const now = new Date();
                            const ist = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (5.5 * 3600000));
                            ist.setDate(ist.getDate() - (offset as number));
                            setSelectedDate(ist.toISOString().split('T')[0]);
                            setShowDatePicker(false);
                            setSelectedModule(null);
                            setModuleData(null);
                          }}
                          className="text-xs font-bold px-3 py-2 rounded-lg bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all"
                        >
                          {label as string}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Admin Config Button */}
              <button
                onClick={loadAdminStructure}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 hover:text-primary hover:border-primary text-xs font-bold transition-all shadow-sm"
                title="Checkpoint Configuration"
              >
                <Settings className="w-4 h-4 text-accent" />
                <span className="hidden sm:inline">Admin Config</span>
              </button>

              <button
                onClick={() => { setSelectedModule(null); setModuleData(null); loadDashboard(); }}
                className="p-2.5 rounded-xl bg-white border border-gray-200 hover:bg-primary hover:text-white hover:border-primary transition-all shadow-sm"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* M-Check Module Navigation */}
          <div className="bg-white p-2 rounded-2xl border border-accent-soft shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap pb-1 scrollbar-hide">
              <button
                onClick={() => { setSelectedModule(null); setModuleData(null); }}
                className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${
                  !selectedModule
                    ? 'bg-primary text-white shadow-md'
                    : 'text-primary hover:bg-background'
                }`}
              >
                <BarChart3 className="w-4 h-4 text-accent" />
                <span>MCheck Dashboard</span>
              </button>

              <button
                onClick={() => {
                  if (dashData?.moduleStats?.[0]) {
                    loadModule(dashData.moduleStats[0]);
                  }
                }}
                className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${
                  selectedModule
                    ? 'bg-primary text-white shadow-md'
                    : 'text-primary hover:bg-background'
                }`}
              >
                <SquareCheck className="w-4 h-4 text-accent" />
                <span>Start Checklist</span>
                {selectedModule && (
                  <span className="text-[10px] bg-accent/20 px-2 py-0.5 rounded-full text-[#9E762E] font-bold">
                    {selectedModule.module_name}
                  </span>
                )}
              </button>

              <button
                onClick={() => navigate('/mcheck-reports')}
                className="px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all text-primary hover:bg-background"
              >
                <FileText className="w-4 h-4 text-accent" />
                <span>Reports</span>
              </button>

              <button
                onClick={() => navigate('/mcheck-history')}
                className="px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all text-primary hover:bg-background"
              >
                <Clock className="w-4 h-4 text-accent" />
                <span>History</span>
              </button>
            </div>
          </div>

          {/* Main View: Dashboard Overview OR Module Checklist */}
          {!selectedModule ? (
            <>
              {/* Date Banner */}
              <div className="bg-primary rounded-2xl p-5 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-md border border-white/10">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-accent mb-1">BSC SMG CRM — DAILY MANAGEMENT CHECKLIST</div>
                  <div className="text-2xl font-black">{dashData?.dateDisplay || selectedDate}</div>
                  <div className="text-sm text-white/80 mt-0.5">
                    {dashLoading ? 'Loading metrics...' : `${kpi?.total ?? 0} Total Daily Checkpoints`}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-4xl font-black text-accent">{dashLoading ? '—' : `${kpi?.completionPct || 0}%`}</div>
                    <div className="text-[10px] font-bold text-white/70 uppercase tracking-wide">Overall Completion</div>
                  </div>
                  <div className="w-14 h-14 rounded-full border-4 border-white/20 flex items-center justify-center relative">
                    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 56 56">
                      <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
                      <circle
                        cx="28" cy="28" r="24" fill="none" stroke="var(--color-accent)" strokeWidth="5"
                        strokeDasharray={`${((kpi?.completionPct || 0) / 100) * 150.8} 150.8`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <BarChart3 className="w-5 h-5 text-accent relative z-10" />
                  </div>
                </div>
              </div>

              {/* KPI Cards: Dynamic from actual responses */}
              {dashLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                  {Array(7).fill(0).map((_, i) => (
                    <div key={i} className="card-glass p-4 h-20 animate-pulse bg-gray-100 rounded-2xl" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                  <KpiCard label="Total" value={kpi?.total ?? 0} color="bg-primary" icon={Target} />
                  <KpiCard label="Completed" value={kpi?.done ?? 0} color="bg-emerald-600" icon={CircleCheck} />
                  <KpiCard label="Pending" value={kpi?.pending ?? 0} color="bg-gray-400" icon={Circle} />
                  <KpiCard label="Not Done" value={kpi?.notDone ?? 0} color="bg-red-500" icon={CircleX} />
                  <KpiCard label="In Progress" value={kpi?.inProgress ?? 0} color="bg-black" icon={Clock} />
                  <KpiCard label="Postponed" value={kpi?.postponed ?? 0} color="bg-purple-600" icon={CircleAlert} />
                  <KpiCard label="Completion" value={`${kpi?.completionPct ?? 0}%`} color="bg-accent" icon={Zap} />
                </div>
              )}

              {/* 6 Core Modules Grid */}
              <div>
                <h2 className="text-sm font-black text-gray-500 uppercase tracking-widest mb-3">MODULE PERFORMANCE</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {moduleStats.map((mod: any, idx: number) => {
                    const color = MODULE_COLORS[idx % MODULE_COLORS.length];
                    const pct = mod.completion_pct ?? 0;
                    return (
                      <button
                        key={mod.module_id || idx}
                        onClick={() => mod.module_id && loadModule(mod)}
                        className="bg-white border border-gray-200 rounded-2xl text-left p-5 group transition-all cursor-pointer hover:shadow-lg hover:border-accent shadow-xs"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-black text-primary text-base truncate group-hover:text-accent transition-colors">
                              {mod.module_name}
                            </div>
                            <div className="text-[11px] text-gray-500 font-medium mt-0.5">
                              {mod.done} / {mod.total} submitted
                            </div>
                          </div>
                          <div className="ml-2 flex flex-col items-end">
                            <span className={`text-2xl font-black ${pct === 100 ? 'text-emerald-600' : pct >= 50 ? 'text-primary' : 'text-amber-600'}`}>
                              {pct}%
                            </span>
                          </div>
                        </div>

                        {/* Clean Progress Bar */}
                        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-3">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${color.bar}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>

                        {/* Breakdown Row */}
                        <div className="grid grid-cols-4 gap-1 pt-1 border-t border-gray-100">
                          {[
                            { label: 'Done', value: mod.done ?? 0, color: 'text-emerald-600' },
                            { label: 'Pending', value: mod.pending ?? 0, color: 'text-gray-400' },
                            { label: 'Not Done', value: mod.not_done ?? 0, color: 'text-red-500' },
                            { label: 'In Prog', value: mod.in_progress ?? 0, color: 'text-amber-600' }
                          ].map(s => (
                            <div key={s.label} className="text-center">
                              <div className={`text-xs font-black ${s.color}`}>{s.value}</div>
                              <div className="text-[9px] text-gray-400 font-medium">{s.label}</div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 pt-2 text-[11px] text-accent font-bold flex items-center justify-between">
                          <span>Open Checklist</span>
                          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            /* ── Module Checklist View (Section 8 & 9) ── */
            <div className="space-y-4 animate-fade-in">
              {/* Back to Modules Navigation */}
              <button
                onClick={() => { setSelectedModule(null); setModuleData(null); }}
                className="flex items-center gap-2 text-sm font-bold text-primary hover:text-accent transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Modules</span>
              </button>

              {moduleLoading ? (
                <div className="bg-white border border-gray-200 p-12 flex items-center justify-center rounded-2xl shadow-sm">
                  <div className="flex items-center gap-3 text-gray-500">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="font-semibold text-sm">Loading module checkpoints...</span>
                  </div>
                </div>
              ) : moduleData ? (
                <>
                  {/* Module Operational Header Card */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <div className="text-2xl font-black text-primary">{moduleData.module.module_name}</div>
                        <div className="text-xs text-accent font-bold mt-0.5">{dashData?.dateDisplay || selectedDate}</div>
                        <div className="text-sm text-gray-600 font-medium mt-1">
                          Module Progress: <span className="font-bold text-primary">{moduleData.stats.done} of {moduleData.stats.total} submitted</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={handleSubmitAll}
                          disabled={submitAllLoading}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary transition-all shadow-sm disabled:opacity-60"
                        >
                          {submitAllLoading ? (
                                    <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5 text-accent" />
                          )}
                          <span>Submit All</span>
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all duration-700"
                        style={{ width: `${moduleData.stats.completionPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Checkpoints List — Compact, Clean Scan Cards */}
                  <div className="space-y-3">
                    {moduleData.checkpoints.map((cp: any, idx: number) => {
                      const currentStatus = responses[cp.id]?.system_status || cp.system_status || 'PENDING';
                      const statusStyle = STATUS_COLORS[currentStatus] || STATUS_COLORS.PENDING;
                      const isExpanded = expandedCheckpoint === cp.id;
                      const resp = responses[cp.id] || {};

                      return (
                        <div
                          key={cp.id}
                          className={`bg-white rounded-2xl border ${statusStyle.border} shadow-xs transition-all overflow-hidden`}
                        >
                          {/* Compact Checkpoint Row */}
                          <button
                            onClick={() => setExpandedCheckpoint(isExpanded ? null : cp.id)}
                            className="w-full text-left p-4 flex items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <span className="text-xs font-black text-gray-400 w-6 flex-shrink-0">
                                {idx + 1}.
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="font-extrabold text-primary text-sm truncate">
                                  {cp.checkpoint_title}
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500 flex-wrap">
                                  {cp.responsible_department && (
                                    <span>Dept: <strong className="text-gray-700">{cp.responsible_department}</strong></span>
                                  )}
                                  {cp.responsible_person && (
                                    <span>Person: <strong className="text-gray-700">{cp.responsible_person}</strong></span>
                                  )}
                                  {cp.scheduled_time && (
                                    <span className="flex items-center gap-1 text-gray-400">
                                      <Clock className="w-3 h-3" /> {cp.scheduled_time}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 flex-shrink-0">
                              <StatusBadge status={currentStatus} />
                              <div className="w-5 h-5 flex items-center justify-center text-gray-400">
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </div>
                            </div>
                          </button>

                          {/* Response Form (Section 10) */}
                          {isExpanded && (
                            <div className="px-5 pb-6 border-t border-gray-100 pt-5 space-y-5 bg-white/60 animate-fade-in">
                              {/* Checkpoint Meta Details */}
                              <div className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                <div>
                                  <span className="text-gray-400 uppercase font-bold text-[10px] block">Checkpoint</span>
                                  <strong className="text-primary text-sm">{cp.checkpoint_title}</strong>
                                </div>
                                <div>
                                  <span className="text-gray-400 uppercase font-bold text-[10px] block">Responsible Department</span>
                                  <strong className="text-gray-800">{cp.responsible_department || 'General'}</strong>
                                </div>
                                <div>
                                  <span className="text-gray-400 uppercase font-bold text-[10px] block">Responsible Person</span>
                                  <strong className="text-gray-800">{cp.responsible_person || 'Assigned Officer'}</strong>
                                </div>
                              </div>

                              {/* Status and Compliance Grid */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Compliance Status Dropdown */}
                                <div>
                                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
                                    COMPLIANCE STATUS
                                  </label>
                                  <select
                                    value={resp.compliance_status || ''}
                                    onChange={e => setResponses(prev => ({
                                      ...prev,
                                      [cp.id]: { ...prev[cp.id], compliance_status: e.target.value }
                                    }))}
                                    className="select-modern w-full"
                                  >
                                    <option value="">-- Select Compliance Status --</option>
                                    {COMPLIANCE_OPTIONS.map(opt => (
                                      <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                  </select>
                                </div>

                                {/* Accuracy Dropdown */}
                                <div>
                                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
                                    ACCURACY
                                  </label>
                                  <select
                                    value={resp.accuracy || ''}
                                    onChange={e => setResponses(prev => ({
                                      ...prev,
                                      [cp.id]: { ...prev[cp.id], accuracy: e.target.value }
                                    }))}
                                    className="select-modern w-full"
                                  >
                                    <option value="">-- Select Accuracy --</option>
                                    {ACCURACY_OPTIONS.map(opt => (
                                      <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              {/* System Status Selection */}
                              <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
                                  SYSTEM STATUS
                                </label>
                                <div className="flex flex-wrap gap-2">
                                  {STATUS_OPTIONS.map(s => {
                                    const sc = STATUS_COLORS[s];
                                    const isSelected = resp.system_status === s;
                                    const label = s === 'IN_PROGRESS' ? 'IN PROGRESS' : s === 'NOT_DONE' ? 'NOT DONE' : s;
                                    return (
                                      <button
                                        type="button"
                                        key={s}
                                        onClick={() => setResponses(prev => ({
                                          ...prev,
                                          [cp.id]: { ...prev[cp.id], system_status: s }
                                        }))}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                          isSelected
                                            ? `${sc.bg} ${sc.text} ${sc.border} ring-2 ring-offset-1 ring-gray-300`
                                            : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                        }`}
                                      >
                                        {label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Remarks — Large Text Area */}
                              <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
                                  REMARKS
                                </label>
                                <textarea
                                  value={resp.remarks || ''}
                                  rows={3}
                                  onChange={e => setResponses(prev => ({
                                    ...prev,
                                    [cp.id]: { ...prev[cp.id], remarks: e.target.value }
                                  }))}
                                  className="textarea-modern w-full"
                                  placeholder="Enter operational observations, verification notes, or remarks..."
                                />
                              </div>

                              {/* Corrective Action — Large Text Area */}
                              <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
                                  CORRECTIVE ACTION
                                </label>
                                <textarea
                                  value={resp.corrective_action || ''}
                                  rows={3}
                                  onChange={e => setResponses(prev => ({
                                    ...prev,
                                    [cp.id]: { ...prev[cp.id], corrective_action: e.target.value }
                                  }))}
                                  className="textarea-modern w-full"
                                  placeholder="Enter corrective actions taken, assigned tasks, or resolution timeline..."
                                />
                              </div>

                              {/* Photo Evidence */}
                              <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
                                  PHOTO EVIDENCE <span className="text-gray-400 font-normal lowercase">(optional)</span>
                                </label>
                                {resp.photo_url ? (
                                  <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-gray-200 w-fit">
                                    <img src={resp.photo_url} alt="Evidence" className="w-16 h-16 object-cover rounded-lg border border-gray-100" />
                                    <button
                                      type="button"
                                      onClick={() => setResponses(prev => ({ ...prev, [cp.id]: { ...prev[cp.id], photo_url: '' } }))}
                                      className="text-xs text-red-600 font-bold flex items-center gap-1 hover:text-red-800"
                                    >
                                      <X className="w-3.5 h-3.5" /> Remove
                                    </button>
                                  </div>
                                ) : (
                                  <label className="flex items-center gap-2 cursor-pointer w-fit px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-300 hover:border-accent hover:bg-amber-50/50 transition-all text-xs text-gray-600 font-bold bg-white">
                                    <Camera className="w-4 h-4 text-accent" />
                                    <span>Take Photo / Choose from Gallery</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      capture="environment"
                                      onChange={e => e.target.files?.[0] && handlePhotoUpload(cp.id, e.target.files[0])}
                                    />
                                  </label>
                                )}
                              </div>

                              {/* Action Buttons: Save Draft & Submit */}
                              <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
                                <button
                                  type="button"
                                  onClick={() => handleSave(cp.id, false)}
                                  disabled={saving[cp.id]}
                                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 transition-all disabled:opacity-60"
                                >
                                  {saving[cp.id] ? (
                                    <div className="w-3.5 h-3.5 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <Save className="w-3.5 h-3.5" />
                                  )}
                                  <span>Save Draft</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSave(cp.id, true)}
                                  disabled={saving[cp.id]}
                                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary transition-all disabled:opacity-60 shadow-md"
                                >
                                  {saving[cp.id] ? (
                            <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <CircleCheck className="w-3.5 h-3.5 text-accent" />
                                  )}
                                  <span>Submit Verification</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>
      </PageContainer>

      {/* Admin Configuration Modal (Section 19) */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-primary/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in">
            {/* Modal Header */}
            <div className="bg-primary px-6 py-4 text-white flex items-center justify-between">
              <div>
                <h3 className="font-black text-lg flex items-center gap-2">
                  <Settings className="w-5 h-5 text-accent" />
                  MCheck Administrator Configuration
                </h3>
                <p className="text-xs text-white/80">Manage modules, checkpoints, assignments, and verification schedules</p>
              </div>
              <button onClick={() => setShowAdminModal(false)} className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {adminLoading ? (
                <div className="py-12 text-center text-gray-400">Loading configuration...</div>
              ) : (
                <>
                  {/* Module Selector Tabs */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-gray-100">
                    {adminStructure.map(mod => (
                      <button
                        key={mod.id}
                        onClick={() => {
                          setAdminSelectedModId(mod.id);
                          setIsAddingCheckpoint(false);
                          setEditingCheckpoint(null);
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                          adminSelectedModId === mod.id
                            ? 'bg-primary text-white shadow-sm'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {mod.module_name} ({mod.checkpoints?.length || 0})
                      </button>
                    ))}
                  </div>

                  {/* Selected Module Controls */}
                  {adminSelectedModId && (() => {
                    const currentMod = adminStructure.find(m => m.id === adminSelectedModId);
                    if (!currentMod) return null;

                    return (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-black text-sm text-primary">{currentMod.module_name} Checkpoints</h4>
                            <p className="text-xs text-gray-400">Manage daily checkpoints and assigned responsibility</p>
                          </div>
                          {!isAddingCheckpoint && !editingCheckpoint && (
                            <button
                              onClick={() => {
                                setIsAddingCheckpoint(true);
                                setCheckpointForm({
                                  checkpoint_title: '',
                                  checkpoint_description: '',
                                  responsible_department: currentMod.responsible_department || '',
                                  responsible_person: '',
                                  scheduled_time: '11:00 AM',
                                  is_active: 1
                                });
                              }}
                              className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add Checkpoint
                            </button>
                          )}
                        </div>

                        {/* Add / Edit Form */}
                        {(isAddingCheckpoint || editingCheckpoint) && (
                          <form onSubmit={handleSaveCheckpointAdmin} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                            <div className="text-xs font-black text-primary uppercase">
                              {editingCheckpoint ? 'Edit Checkpoint' : 'Add New Checkpoint'}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="sm:col-span-2">
                                <label className="block text-[11px] font-bold text-gray-600 mb-1">Checkpoint Title</label>
                                <input
                                  type="text"
                                  required
                                  value={checkpointForm.checkpoint_title}
                                  onChange={e => setCheckpointForm({ ...checkpointForm, checkpoint_title: e.target.value })}
                                  className="input-modern text-xs"
                                  placeholder="e.g. Bundle Inward Register"
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <label className="block text-[11px] font-bold text-gray-600 mb-1">Description / Verification Guide</label>
                                <textarea
                                  rows={2}
                                  value={checkpointForm.checkpoint_description}
                                  onChange={e => setCheckpointForm({ ...checkpointForm, checkpoint_description: e.target.value })}
                                  className="textarea-modern text-xs"
                                  placeholder="Detailed instructions for verification..."
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-gray-600 mb-1">Responsible Department</label>
                                <input
                                  type="text"
                                  value={checkpointForm.responsible_department}
                                  onChange={e => setCheckpointForm({ ...checkpointForm, responsible_department: e.target.value })}
                                  className="input-modern text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-gray-600 mb-1">Responsible Person</label>
                                <input
                                  type="text"
                                  value={checkpointForm.responsible_person}
                                  onChange={e => setCheckpointForm({ ...checkpointForm, responsible_person: e.target.value })}
                                  className="input-modern text-xs"
                                  placeholder="e.g. Floor Manager"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-gray-600 mb-1">Scheduled Review Time</label>
                                <input
                                  type="text"
                                  value={checkpointForm.scheduled_time}
                                  onChange={e => setCheckpointForm({ ...checkpointForm, scheduled_time: e.target.value })}
                                  className="input-modern text-xs"
                                  placeholder="e.g. 11:00 AM"
                                />
                              </div>
                              <div className="flex items-center gap-2 pt-5">
                                <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={checkpointForm.is_active === 1}
                                    onChange={e => setCheckpointForm({ ...checkpointForm, is_active: e.target.checked ? 1 : 0 })}
                                    className="rounded text-primary"
                                  />
                                  <span>Enabled / Active</span>
                                </label>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                              <button type="submit" className="btn-primary text-xs py-1.5 px-4">
                                Save Checkpoint
                              </button>
                              <button
                                type="button"
                                onClick={() => { setIsAddingCheckpoint(false); setEditingCheckpoint(null); }}
                                className="px-3 py-1.5 rounded-lg bg-gray-200 text-gray-700 text-xs font-bold hover:bg-gray-300"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        )}

                        {/* Checkpoints List in Admin */}
                        <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden bg-white">
                          {currentMod.checkpoints?.map((cp: any, i: number) => (
                            <div key={cp.id} className="p-3 flex items-center justify-between gap-3 hover:bg-gray-50 text-xs">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <span className="text-gray-400 font-bold w-5">{i + 1}.</span>
                                <div className="min-w-0 flex-1">
                                  <div className="font-extrabold text-primary truncate">{cp.checkpoint_title}</div>
                                  <div className="text-[10px] text-gray-400">
                                    {cp.responsible_department} · {cp.responsible_person || 'Unassigned'} · {cp.scheduled_time || 'Daily'}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleReorder(cp.id, 'up')}
                                  disabled={i === 0}
                                  className="p-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30"
                                  title="Move Up"
                                >
                                  <ArrowUp className="w-3.5 h-3.5 text-gray-600" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleReorder(cp.id, 'down')}
                                  disabled={i === currentMod.checkpoints.length - 1}
                                  className="p-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30"
                                  title="Move Down"
                                >
                                  <ArrowDown className="w-3.5 h-3.5 text-gray-600" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCheckpoint(cp);
                                    setIsAddingCheckpoint(false);
                                    setCheckpointForm({
                                      checkpoint_title: cp.checkpoint_title,
                                      checkpoint_description: cp.checkpoint_description || '',
                                      responsible_department: cp.responsible_department || '',
                                      responsible_person: cp.responsible_person || '',
                                      scheduled_time: cp.scheduled_time || '',
                                      is_active: cp.is_active ?? 1
                                    });
                                  }}
                                  className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary hover:text-white transition-all text-primary"
                                  title="Edit Checkpoint"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex items-center justify-end">
              <button
                onClick={() => setShowAdminModal(false)}
                className="btn-primary text-xs py-2 px-5"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
