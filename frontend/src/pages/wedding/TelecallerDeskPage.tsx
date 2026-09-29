import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import PageContainer from '../../components/ui/PageContainer';
import ToastContainer from '../../components/Toast';
import { toastManager } from '../../utils/toastManager';
import { useTelecallerQueue } from '../../hooks/useTelecallerQueue';
import { API, Auth, UserSession } from '../../services/api';
import { parseDate, formatDateDisplay, toISODateInput } from '../../utils/dateUtils';
import WeddingNav from './WeddingNav';
import {
  WeddingCustomer,
  WeddingWhatsAppTemplate,
  WeddingWhatsAppLog,
  WeddingActivityItem,
  TelecallerPerformanceMetric,
  CUSTOMER_STATUSES,
  CALL_OUTCOMES,
  CALL_TIME_OPTIONS,
  BUDGET_RANGES,
  CATEGORY_OPTIONS,
  ARCHIVE_SUCCESS_MESSAGE,
  getStatusBadge
} from './weddingTypes';
import LocationFilterSelect from '../../components/ui/LocationFilterSelect';
import {
  PhoneCall, CircleCheck, Search, MessageCircle, Eye, RefreshCw, X, Target,
  Check, Award, MapPin, Calendar, Clock, Edit3, Send, Sparkles, Filter,
  ChevronRight, UserCheck, AlertTriangle, ArrowUpDown, History, ShieldCheck,
  ShoppingBag, PhoneOff, PhoneForwarded, Users, CheckCircle2, Copy
} from 'lucide-react';

export default function TelecallerDeskPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [session, setSession] = useState<UserSession | null>(() => Auth.get());

  // Active queue tab: default to smart priority queue
  const initialQueue = (searchParams.get('queue') as any) || 'priorityQueue';
  const [activeQueue, setActiveQueue] = useState<
    'priorityQueue' | 'dueToday' | 'overdue' | 'callbacks' | 'newLeads' | 'shoppingConfirmed' | 'visitsPlanned' | 'upcoming' | 'myQueue'
  >(initialQueue);

  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState<number | ''>(() => {
    const sess = Auth.get();
    const isAdminRole = ['Admin', 'Super Admin', 'system administrator'].includes(sess?.role || '');
    const isGlobal = isAdminRole && (!sess?.locationId || sess?.isGlobalAdmin === true);
    if (!isGlobal && sess?.locationId) {
      return sess.locationId;
    }
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('bsc_selected_location') : null;
    return saved && saved !== 'ALL' ? Number(saved) : '';
  });
  const [locations, setLocations] = useState<any[]>([]);

  // Listen to global location changes (e.g. from Topbar)
  useEffect(() => {
    const handleLocChange = (e: any) => {
      const sess = Auth.get();
      const isAdminRole = ['Admin', 'Super Admin', 'system administrator'].includes(sess?.role || '');
      const isGlobal = isAdminRole && (!sess?.locationId || sess?.isGlobalAdmin === true);
      if (!isGlobal && sess?.locationId) {
        setLocationFilter(sess.locationId);
        return;
      }
      const locId = e?.detail?.locationId;
      const parsed = locId && locId !== 'ALL' ? Number(locId) : '';
      setLocationFilter(parsed);
    };
    window.addEventListener('bsc_location_changed', handleLocChange);
    return () => window.removeEventListener('bsc_location_changed', handleLocChange);
  }, []);

  const { loading, deskSummary, queueRecords, refreshQueue } = useTelecallerQueue(locationFilter);

  // ── Unified Customer Workspace State ─────────────────────────────
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<'call' | 'edit' | 'whatsapp' | 'timeline'>('call');
  const [activeCustomer, setActiveCustomer] = useState<WeddingCustomer | null>(null);

  // Call & Outcome Form
  const [callForm, setCallForm] = useState({
    call_status: 'Completed',
    call_outcome: 'Connected — Interested',
    remarks: '',
    customer_response: '',
    next_follow_up_date: '',
    next_follow_up_time: 'Morning (10 AM - 1 PM)',
    expected_shopping_date: '',
    new_customer_status: ''
  });
  const [savingCall, setSavingCall] = useState(false);

  // Telecaller Authority Edit Form
  const [editForm, setEditForm] = useState({
    alternate_mobile: '',
    preferred_call_time: 'Any Time',
    wedding_date: '',
    expected_shopping_date: '',
    shopping_requirements: '',
    preferred_shopping_category: '',
    estimated_family_size: 1,
    budget: '',
    customer_status: '',
    customer_notes: '',
    follow_up_date: '',
    remarks: ''
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // WhatsApp Automation Form & State
  const [whatsappTemplates, setWhatsappTemplates] = useState<WeddingWhatsAppTemplate[]>([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>('welcome');
  const [customWhatsAppMessage, setCustomWhatsAppMessage] = useState<string>('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [whatsappLogs, setWhatsappLogs] = useState<WeddingWhatsAppLog[]>([]);

  // Activity Timeline State
  const [timelineItems, setTimelineItems] = useState<WeddingActivityItem[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // Performance Scorecard Modal
  const [perfModalOpen, setPerfModalOpen] = useState(false);
  const [performanceMetrics, setPerformanceMetrics] = useState<TelecallerPerformanceMetric[]>([]);
  const [loadingPerf, setLoadingPerf] = useState(false);

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    const sess = Auth.get();
    setSession(sess);
    const isAdminRole = ['Admin', 'Super Admin', 'system administrator'].includes(sess?.role || '');
    const isGlobal = isAdminRole && (!sess?.locationId || sess?.isGlobalAdmin === true);
    if (!isGlobal && sess?.locationId) {
      setLocationFilter(sess.locationId);
    }
    API.getLocations().then(res => {
      if (res?.locations) setLocations(res.locations);
    }).catch(() => {});
  }, [navigate]);

  // Open Workspace for a Customer
  const handleOpenWorkspace = (cust: WeddingCustomer, initialTab: 'call' | 'edit' | 'whatsapp' | 'timeline' = 'call') => {
    setActiveCustomer(cust);
    setWorkspaceTab(initialTab);

    // Initialize Call Form
    setCallForm({
      call_status: 'Completed',
      call_outcome: cust.last_call_outcome || 'Connected — Interested',
      remarks: '',
      customer_response: '',
      next_follow_up_date: toISODateInput(cust.follow_up_date) || new Date().toISOString().slice(0, 10),
      next_follow_up_time: cust.preferred_call_time || 'Morning (10 AM - 1 PM)',
      expected_shopping_date: toISODateInput(cust.expected_shopping_date),
      new_customer_status: cust.customer_status
    });

    // Initialize Edit Form
    setEditForm({
      alternate_mobile: cust.alternate_mobile || '',
      preferred_call_time: cust.preferred_call_time || 'Any Time',
      wedding_date: toISODateInput(cust.wedding_date) || '',
      expected_shopping_date: toISODateInput(cust.expected_shopping_date) || '',
      shopping_requirements: cust.shopping_requirements || '',
      preferred_shopping_category: cust.preferred_shopping_category || 'General Wedding Shopping',
      estimated_family_size: cust.estimated_family_size || 1,
      budget: cust.budget || 'Not Decided',
      customer_status: cust.customer_status || 'New Lead',
      customer_notes: cust.customer_notes || '',
      follow_up_date: toISODateInput(cust.follow_up_date) || '',
      remarks: ''
    });

    setWorkspaceOpen(true);

    // Preload WhatsApp templates & Timeline
    loadWhatsAppTemplates(cust.id);
    loadTimeline(cust.id);
  };

  // Direct Call Action: triggers dialer & opens call workspace immediately
  const handleDirectCall = (cust: WeddingCustomer) => {
    const rawNumber = cust.mobile_number ? cust.mobile_number.replace(/\D/g, '') : '';
    if (rawNumber) {
      window.location.href = `tel:+91${rawNumber}`;
    }
    handleOpenWorkspace(cust, 'call');
  };

  // Load WhatsApp templates
  const loadWhatsAppTemplates = async (customerId: number) => {
    setLoadingTemplates(true);
    try {
      const res = await API.getWeddingWhatsAppTemplates(customerId);
      const list = res?.templates || res?.data?.templates || [];
      setWhatsappTemplates(list);
      if (list.length > 0) {
        setSelectedTemplateKey(list[0].key);
        setCustomWhatsAppMessage(list[0].text);
      }
      // Also fetch logs
      const logRes = await API.getWeddingWhatsAppLogs(customerId);
      setWhatsappLogs(logRes?.logs || logRes?.data?.logs || []);
    } catch (err: any) {
      // quiet fail or fallback
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Switch template
  const handleTemplateSelect = (key: string) => {
    setSelectedTemplateKey(key);
    const tmpl = whatsappTemplates.find(t => t.key === key);
    if (tmpl) {
      setCustomWhatsAppMessage(tmpl.text);
    }
  };

  // Send WhatsApp message (Opens wa.me & logs to server)
  const handleSendWhatsApp = async () => {
    if (!activeCustomer) return;
    const phone = activeCustomer.mobile_number.replace(/\D/g, '');
    if (!phone) {
      toastManager.error('whatsapp', 'Customer does not have a valid mobile number');
      return;
    }

    setSendingWhatsApp(true);
    try {
      // 1. Record on server
      await API.sendWeddingWhatsAppMessage(activeCustomer.id, {
        template_type: selectedTemplateKey,
        custom_message: customWhatsAppMessage,
        recipient_phone: phone
      });

      // 2. Open WhatsApp Web / App
      const encodedMsg = encodeURIComponent(customWhatsAppMessage);
      const waUrl = `https://wa.me/91${phone}?text=${encodedMsg}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');

      toastManager.success('WhatsApp message logged and link opened successfully.');

      // Refresh logs & queue
      const logRes = await API.getWeddingWhatsAppLogs(activeCustomer.id);
      setWhatsappLogs(logRes?.logs || logRes?.data?.logs || []);
      refreshQueue();
    } catch (err: any) {
      toastManager.error('whatsapp', 'Error logging WhatsApp: ' + err.message);
    } finally {
      setSendingWhatsApp(false);
    }
  };

  // Load Timeline
  const loadTimeline = async (customerId: number) => {
    setLoadingTimeline(true);
    try {
      const res = await API.getWeddingCustomerTimeline(customerId);
      setTimelineItems(res?.timeline || res?.data?.timeline || []);
    } catch (err: any) {
      // quiet fail
    } finally {
      setLoadingTimeline(false);
    }
  };

  // Submit Call Outcome
  const handleSaveCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCustomer) return;
    setSavingCall(true);
    try {
      const res: any = await API.logWeddingCall({
        customer_id: activeCustomer.id,
        call_date: new Date().toISOString().slice(0, 10),
        call_time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        call_status: callForm.call_status,
        call_outcome: callForm.call_outcome,
        remarks: callForm.remarks,
        customer_response: callForm.customer_response,
        next_follow_up_date: callForm.next_follow_up_date || undefined,
        next_follow_up_time: callForm.next_follow_up_time || undefined,
        expected_shopping_date_updated: callForm.expected_shopping_date || undefined,
        new_customer_status: callForm.new_customer_status || undefined
      });

      // Choosing a completion status archives the record permanently on the backend.
      if (res?.archived || res?.lifecycle_status === 'OLD_CUSTOMER') {
        toastManager.success(ARCHIVE_SUCCESS_MESSAGE);
      } else {
        toastManager.success(res?.message || `Call result saved: ${callForm.call_outcome}. CRM updated!`);
      }
      setWorkspaceOpen(false);
      setActiveCustomer(null);
      refreshQueue();
    } catch (err: any) {
      toastManager.error('call-log', err?.message || 'Error saving call outcome');
    } finally {
      setSavingCall(false);
    }
  };

  // Submit Telecaller Authority Edit Form
  const handleSaveCustomerEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCustomer) return;
    setSavingEdit(true);
    try {
      const res: any = await API.updateWeddingCustomerByTelecaller(activeCustomer.id, editForm);
      if (res?.archived || res?.lifecycle_status === 'OLD_CUSTOMER') {
        toastManager.success(ARCHIVE_SUCCESS_MESSAGE);
      } else {
        toastManager.success(res?.message || 'Customer details updated successfully.');
      }
      setWorkspaceOpen(false);
      setActiveCustomer(null);
      refreshQueue();
    } catch (err: any) {
      // Archived rows are read-only: surface the server wording (409/403) verbatim.
      toastManager.error('cust-edit', err?.message || 'Error updating customer');
    } finally {
      setSavingEdit(false);
    }
  };

  // Open Performance Scorecard
  const handleOpenPerformance = async () => {
    setPerfModalOpen(true);
    setLoadingPerf(true);
    try {
      const res = await API.getWeddingTelecallerPerformance({
        location_id: locationFilter !== '' ? locationFilter : undefined
      });
      setPerformanceMetrics(res?.performance || res?.data?.performance || []);
    } catch (err: any) {
      toastManager.error('perf-load', 'Error loading performance metrics: ' + err.message);
    } finally {
      setLoadingPerf(false);
    }
  };

  // Quick Action: Mark Shopping Confirmed or Won directly
  const handleQuickStatus = async (cust: WeddingCustomer, targetStatus: string) => {
    try {
      await API.changeWeddingCustomerStatus(cust.id, targetStatus, `Telecaller quick action from desk`);
      toastManager.success(`Status updated to "${targetStatus}".`);
      refreshQueue();
    } catch (err: any) {
      toastManager.error('status-update', 'Error updating status: ' + err.message);
    }
  };

  const isGlobalOrAdmin = Boolean(
    session?.isGlobalAdmin ||
    ['Admin', 'Super Admin', 'System Administrator'].includes(session?.role || '') ||
    !session?.locationId
  );

  // Filter current active queue records
  const currentList = (queueRecords[activeQueue] || []).filter((c: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.customer_name && c.customer_name.toLowerCase().includes(q)) ||
      (c.mobile_number && c.mobile_number.includes(q)) ||
      (c.customer_code && c.customer_code.toLowerCase().includes(q)) ||
      (c.wedding_date && c.wedding_date.includes(q)) ||
      (c.customer_status && c.customer_status.toLowerCase().includes(q)) ||
      (c.assigned_telecaller && c.assigned_telecaller.toLowerCase().includes(q))
    );
  });

  return (
    <DashboardLayout
      title="Telecaller Workspace & Priority Desk"
      breadcrumbs={[{ label: 'Wedding CRM', href: '/wedding-crm/dashboard' }, { label: 'Telecaller Workspace' }]}
    >
      <PageContainer maxWidth="full">
        <ToastContainer />

        <WeddingNav
          currentPageTitle="Telecaller Workspace"
          actions={
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <LocationFilterSelect
                value={locationFilter}
                onChange={(val) => setLocationFilter(val)}
              />
              <button
                onClick={handleOpenPerformance}
                className="px-3.5 py-2 bg-[#FFFDFC] hover:bg-[#FFF7F2] border border-[#E8D9D4] rounded-xl text-xs font-semibold text-[#4A173A] flex items-center gap-1.5 transition-colors shadow-xs"
                title="View Team Performance Scorecard"
              >
                <Award className="w-3.5 h-3.5 text-[#B76E79]" />
                <span className="hidden sm:inline">Performance</span>
              </button>
              <button
                onClick={refreshQueue}
                disabled={loading}
                className="px-3.5 py-2 bg-[#FFFDFC] hover:bg-[#FFF7F2] border border-[#E8D9D4] rounded-xl text-xs font-semibold text-[#4A173A] flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#B76E79]' : 'text-[#B76E79]'}`} />
                <span>Refresh</span>
              </button>
            </div>
          }
        />

        {/* ── TOP STATS RIBBON: 8 Operational Cards Required ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 my-4">
          {[
            {
              key: 'myQueue',
              label: 'My Customers',
              count: deskSummary.myCustomers,
              color: 'text-[#4A173A] bg-[#FFFDFC] border-[#E8D9D4]',
              badgeBg: 'bg-[#F6E2E5] text-[#4A173A]',
              icon: Users
            },
            {
              key: 'dueToday',
              label: 'Calls Due Today',
              count: queueRecords.dueToday?.length || 0,
              color: 'text-[#C58A18] bg-[#FFFDFC] border-[#E8D9D4]',
              badgeBg: 'bg-[#FFF4D6] text-[#C58A18]',
              icon: Clock
            },
            {
              key: 'overdue',
              label: 'Overdue',
              count: deskSummary.overdueCount || queueRecords.overdue?.length || 0,
              color: 'text-[#B42318] bg-[#FFFDFC] border-[#E8D9D4]',
              badgeBg: 'bg-[#FDE8E7] text-[#B42318]',
              icon: AlertTriangle
            },
            {
              key: 'callbacks',
              label: 'Callbacks',
              count: deskSummary.callbackCount,
              color: 'text-[#6A2853] bg-[#FFFDFC] border-[#E8D9D4]',
              badgeBg: 'bg-[#EDE7F6] text-[#6A2853]',
              icon: PhoneForwarded
            },
            {
              key: 'newLeads',
              label: 'New Customers',
              count: queueRecords.newLeads?.length || 0,
              color: 'text-[#2B1722] bg-[#FFFDFC] border-[#E8D9D4]',
              badgeBg: 'bg-[#FFF7F2] text-[#4A173A]',
              icon: Sparkles
            },
            {
              key: 'shoppingConfirmed',
              label: 'Shopping Confirmed',
              count: deskSummary.shoppingConfirmed,
              color: 'text-[#198754] bg-[#FFFDFC] border-[#E8D9D4]',
              badgeBg: 'bg-[#E8F5EE] text-[#198754]',
              icon: ShoppingBag
            },
            {
              key: 'visitsPlanned',
              label: 'Visits Planned',
              count: deskSummary.visitsPlanned,
              color: 'text-[#4A173A] bg-[#FFFDFC] border-[#E8D9D4]',
              badgeBg: 'bg-[#F6E2E5] text-[#4A173A]',
              icon: MapPin
            },
            {
              key: 'priorityQueue',
              label: 'Completed Today',
              count: deskSummary.completedToday,
              color: 'text-[#198754] bg-[#FFFDFC] border-[#E8D9D4]',
              badgeBg: 'bg-[#E8F5EE] text-[#198754]',
              icon: CheckCircle2
            }
          ].map((card) => {
            const Icon = card.icon;
            const isCurrent = activeQueue === card.key;
            return (
              <button
                key={card.label}
                onClick={() => setActiveQueue(card.key as any)}
                className={`p-3 rounded-2xl border text-left transition-all hover:shadow-sm ${
                  isCurrent
                    ? 'border-[#B76E79] ring-2 ring-[#B76E79]/30 bg-[#FFFAF7]'
                    : card.color
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`p-1.5 rounded-xl ${card.badgeBg}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-lg font-black">{card.count}</span>
                </div>
                <div className="text-[11px] font-bold text-[#6F5963] truncate">
                  {card.label}
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Call Queue Container ── */}
        <div className="bg-[#FFFDFC] rounded-3xl border border-[#E8D9D4] shadow-xs p-5 space-y-4">
          {/* Queue Selection Tabs & Fast Search */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8D9D4] pb-3">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1">
              {[
                { key: 'priorityQueue', label: '⚡ Smart Priority Queue', count: queueRecords.priorityQueue?.length || 0, isSpecial: true },
                { key: 'dueToday', label: "Due Today", count: queueRecords.dueToday?.length || 0 },
                { key: 'overdue', label: 'Overdue', count: queueRecords.overdue?.length || 0, alert: true },
                { key: 'callbacks', label: 'Callbacks', count: queueRecords.callbacks?.length || 0 },
                { key: 'newLeads', label: 'New Leads', count: queueRecords.newLeads?.length || 0 },
                { key: 'shoppingConfirmed', label: 'Shopping Confirmed', count: queueRecords.shoppingConfirmed?.length || 0 },
                { key: 'visitsPlanned', label: 'Visits Planned', count: queueRecords.visitsPlanned?.length || 0 },
                { key: 'upcoming', label: 'Upcoming', count: queueRecords.upcoming?.length || 0 },
                { key: 'myQueue', label: 'My Assigned Leads', count: queueRecords.myQueue?.length || 0 }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveQueue(tab.key as any)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                    activeQueue === tab.key
                      ? tab.isSpecial
                        ? 'bg-[#4A173A] text-white shadow-xs'
                        : 'bg-[#B76E79] text-white shadow-xs'
                      : tab.isSpecial
                        ? 'bg-[#F6E2E5] text-[#4A173A] hover:bg-[#D89AA3]/30 font-bold'
                        : 'bg-[#FFF7F2] text-[#6F5963] hover:text-[#4A173A] hover:bg-[#F6E2E5]'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    tab.alert && tab.count > 0 ? 'bg-[#FDE8E7] text-[#B42318]' : 'bg-black/10'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Fast Customer Search Box */}
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-[#9A858D] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search name, phone, reg ID, date..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl text-xs text-[#2B1722] placeholder-[#9A858D] focus:outline-none focus:border-[#B76E79]"
              />
            </div>
          </div>

          {/* ── Mobile Queue Card View (< md) ── */}
          <div className="md:hidden space-y-3">
            {loading ? (
              <div className="text-center py-10 bg-[#FFFDFC] rounded-2xl border border-[#E8D9D4]">
                <RefreshCw className="w-5 h-5 animate-spin text-[#B76E79] mx-auto mb-2" />
                <span className="text-xs text-[#6F5963]">Loading queue...</span>
              </div>
            ) : currentList.length === 0 ? (
              <div className="text-center py-10 bg-[#FFFDFC] rounded-2xl border border-[#E8D9D4] p-4">
                <CircleCheck className="w-10 h-10 text-[#198754] mx-auto mb-2" />
                <div className="font-bold text-sm text-[#4A173A]">Queue is currently clear!</div>
                <div className="text-xs text-[#6F5963] mt-0.5">No pending customer calls in this bucket.</div>
              </div>
            ) : (
              currentList.map((cust: WeddingCustomer) => {
                const badge = getStatusBadge(cust.customer_status);
                const followUp = parseDate(cust.follow_up_date);
                const isOverdue = !!followUp && followUp.getTime() < new Date().setHours(0, 0, 0, 0);

                return (
                  <div
                    key={cust.id}
                    className="p-4 bg-[#FFFDFC] rounded-2xl border border-[#E8D9D4] shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-sm text-[#2B1722]">
                            {cust.customer_name}
                          </span>
                          <span className="text-[10px] font-mono text-white bg-[#4A173A] px-1.5 py-0.5 rounded">
                            {cust.customer_code}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#6F5963] mt-0.5">
                          📍 {cust.location_name || 'Store'} · 💍 {cust.wedding_date ? formatDateDisplay(cust.wedding_date, 'TBD') : 'TBD'}
                        </div>
                      </div>

                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                        {cust.customer_status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-[#FFFAF7] p-2.5 rounded-xl border border-[#E8D9D4]">
                      <div>
                        <span className="text-[10px] text-[#6F5963] uppercase font-semibold block">Mobile</span>
                        <span className="font-bold text-[#2B1722]">{cust.mobile_number}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#6F5963] uppercase font-semibold block">Follow-up</span>
                        <span className={`font-semibold ${isOverdue ? 'text-[#B42318]' : 'text-[#2B1722]'}`}>
                          {formatDateDisplay(cust.follow_up_date, 'None')}
                          {isOverdue && <span className="ml-1 text-[9px] bg-[#FDE8E7] text-[#B42318] px-1 rounded font-bold">OVERDUE</span>}
                        </span>
                      </div>
                      <div className="col-span-2 flex items-center justify-between text-[11px] pt-1 border-t border-[#E8D9D4]">
                        <span className="text-[#6F5963]">
                          👤 Assigned: <strong className="text-[#4A173A]">{cust.assigned_telecaller || 'Unassigned'}</strong>
                        </span>
                        <span className="text-[#6F5963]">
                          Last: <strong className="text-[#2B1722]">{cust.last_contacted_by || cust.last_updated_by || 'None'}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Prominent Call & Action Buttons */}
                    <div className="flex items-center gap-2 pt-1 flex-wrap sm:flex-nowrap">
                      {/* CALL FIRST BUTTON */}
                      <button
                        onClick={() => handleDirectCall(cust)}
                        className="flex-1 min-w-[120px] py-2.5 bg-[#4A173A] hover:bg-[#6A2853] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm border border-[#B76E79]/30"
                      >
                        <PhoneCall className="w-4 h-4 text-[#E8C7A8]" />
                        <span>CALL</span>
                      </button>

                      {/* UPDATE BUTTON */}
                      <button
                        onClick={() => handleOpenWorkspace(cust, 'edit')}
                        className="px-3 py-2 bg-[#FFF7F2] hover:bg-[#F6E2E5] text-[#4A173A] font-semibold rounded-xl text-xs border border-[#E8D9D4] flex items-center gap-1"
                        title="Update Customer Details"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#B76E79]" />
                        <span>Update</span>
                      </button>

                      {/* WHATSAPP BUTTON */}
                      <button
                        onClick={() => handleOpenWorkspace(cust, 'whatsapp')}
                        className="p-2.5 bg-[#198754] hover:bg-[#16805B] text-white rounded-xl text-xs flex items-center justify-center"
                        title="WhatsApp Templates"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>

                      {/* TIMELINE / PROFILE */}
                      <button
                        onClick={() => handleOpenWorkspace(cust, 'timeline')}
                        className="p-2.5 bg-[#FFFAF7] hover:bg-[#FFF7F2] text-[#4A173A] rounded-xl text-xs border border-[#E8D9D4]"
                        title="Activity Timeline"
                      >
                        <History className="w-4 h-4 text-[#B76E79]" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ── Desktop Queue Table (md+) ── */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs text-[#2B1722]">
              <thead className="bg-[#F8EDE8] text-[#4A173A] border-b border-[#E8D9D4] uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-3 font-bold">Reg ID</th>
                  <th className="py-3 px-3 font-bold">Customer Name</th>
                  <th className="py-3 px-3 font-bold">Mobile</th>
                  <th className="py-3 px-3 font-bold">Location</th>
                  <th className="py-3 px-3 font-bold">Wedding Date</th>
                  <th className="py-3 px-3 font-bold">Assigned Telecaller</th>
                  <th className="py-3 px-3 font-bold">Last Contacted</th>
                  <th className="py-3 px-3 font-bold">Status</th>
                  <th className="py-3 px-3 font-bold">Next Follow-up</th>
                  <th className="py-3 px-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8D9D4]">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-[#6F5963]">
                      <RefreshCw className="w-5 h-5 animate-spin text-[#B76E79] mx-auto mb-2" />
                      <span>Loading telecaller queue...</span>
                    </td>
                  </tr>
                ) : currentList.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-[#6F5963]">
                      <CircleCheck className="w-10 h-10 text-[#198754] mx-auto mb-2" />
                      <div className="font-bold text-sm text-[#4A173A]">Queue is currently clear!</div>
                      <div className="text-xs text-[#6F5963] mt-0.5">All customer calls in this queue have been handled.</div>
                    </td>
                  </tr>
                ) : (
                  currentList.map((cust: WeddingCustomer) => {
                    const badge = getStatusBadge(cust.customer_status);
                    const followUp = parseDate(cust.follow_up_date);
                    const isOverdue = !!followUp && followUp.getTime() < new Date().setHours(0, 0, 0, 0);

                    return (
                      <tr key={cust.id} className="hover:bg-[#FFF1F2] transition-colors">
                        <td className="py-3 px-3 font-bold text-[#4A173A]">
                          <button
                            onClick={() => handleOpenWorkspace(cust, 'timeline')}
                            className="hover:text-[#B76E79] hover:underline font-mono"
                          >
                            {cust.customer_code}
                          </button>
                        </td>
                        <td className="py-3 px-3">
                          <button
                            onClick={() => handleOpenWorkspace(cust, 'call')}
                            className="font-bold text-[#2B1722] hover:text-[#4A173A] text-left block"
                          >
                            {cust.customer_name}
                          </button>
                          <span className="text-[10px] text-[#6F5963] block mt-0.5">
                            {cust.preferred_shopping_category || 'General Wedding'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-medium text-[#2B1722]">
                          <div className="flex items-center gap-1">
                            <span>{cust.mobile_number}</span>
                          </div>
                          {cust.alternate_mobile && (
                            <span className="text-[10px] text-[#6F5963] block">Alt: {cust.alternate_mobile}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-medium text-[#6F5963]">
                          📍 {cust.location_name || 'Store'}
                        </td>
                        <td className="py-3 px-3">
                          {parseDate(cust.wedding_date) ? (
                            <span className="text-[#B76E79] font-semibold">
                              💍 {formatDateDisplay(cust.wedding_date, 'TBD')}
                            </span>
                          ) : (
                            <span className="text-[#9A858D]">TBD</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-medium">
                          {cust.assigned_telecaller ? (
                            <span className="bg-[#FFFAF7] border border-[#E8D9D4] text-[#4A173A] px-2 py-0.5 rounded-full text-[11px] font-semibold">
                              👤 {cust.assigned_telecaller}
                            </span>
                          ) : (
                            <span className="text-[#9A858D] italic text-[11px]">Unassigned</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-[#6F5963]">
                          {cust.last_contacted_by ? (
                            <div>
                              <span className="font-semibold text-[#4A173A] text-[11px] block">{cust.last_contacted_by}</span>
                              <span className="text-[10px] text-[#9A858D]">{cust.last_call_outcome || 'Called'}</span>
                            </div>
                          ) : cust.last_updated_by ? (
                            <span className="text-[11px]">{cust.last_updated_by}</span>
                          ) : (
                            <span className="text-[#9A858D] italic">None</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                            {cust.customer_status}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {parseDate(cust.follow_up_date) ? (
                            <span className={`font-semibold ${isOverdue ? 'text-[#B42318]' : 'text-[#2B1722]'}`}>
                              {formatDateDisplay(cust.follow_up_date, 'None')}
                              {isOverdue && <span className="ml-1 text-[9px] bg-[#FDE8E7] text-[#B42318] px-1 rounded uppercase font-bold">Overdue</span>}
                            </span>
                          ) : (
                            <span className="text-[#9A858D]">None</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* 1. CALL (Prominent Call-First Action) */}
                            <button
                              onClick={() => handleDirectCall(cust)}
                              className="px-3 py-1.5 bg-[#4A173A] hover:bg-[#6A2853] text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-xs border border-[#B76E79]/30"
                              title="Call Customer & Open Workspace"
                            >
                              <PhoneCall className="w-3.5 h-3.5 text-[#E8C7A8]" />
                              <span>CALL</span>
                            </button>

                            {/* 2. UPDATE (Telecaller Authority Edit) */}
                            <button
                              onClick={() => handleOpenWorkspace(cust, 'edit')}
                              className="px-2.5 py-1.5 bg-[#FFF7F2] hover:bg-[#F6E2E5] text-[#4A173A] font-semibold rounded-xl text-xs border border-[#E8D9D4] flex items-center gap-1"
                              title="Edit Customer Information"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-[#B76E79]" />
                              <span>Update</span>
                            </button>

                            {/* 3. WHATSAPP (Location-Specific Templates) */}
                            <button
                              onClick={() => handleOpenWorkspace(cust, 'whatsapp')}
                              className="p-1.5 bg-[#198754] hover:bg-[#16805B] text-white rounded-xl text-xs"
                              title="Send WhatsApp Template"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </button>

                            {/* 4. TIMELINE */}
                            <button
                              onClick={() => handleOpenWorkspace(cust, 'timeline')}
                              className="p-1.5 bg-[#FFFAF7] hover:bg-[#FFF7F2] text-[#4A173A] rounded-xl text-xs border border-[#E8D9D4]"
                              title="View Activity Timeline"
                            >
                              <History className="w-3.5 h-3.5 text-[#B76E79]" />
                            </button>

                            {/* 5. FULL PROFILE */}
                            <Link
                              to={`/wedding-crm/customers/${cust.id}`}
                              className="p-1.5 bg-[#FFFAF7] hover:bg-[#FFF7F2] text-[#4A173A] rounded-xl text-xs border border-[#E8D9D4]"
                              title="Full Profile"
                            >
                              <Eye className="w-3.5 h-3.5 text-[#B76E79]" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════════
            UNIFIED TELECALLER WORKSPACE DRAWER / MODAL
        ══════════════════════════════════════════════════════════════════════════ */}
        {workspaceOpen && activeCustomer && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 z-50 animate-fade-in">
            <div className="bg-[#FFFDFC] rounded-3xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl border border-[#E8D9D4] space-y-4 max-h-[92vh] overflow-y-auto flex flex-col">
              
              {/* Workspace Header */}
              <div className="flex items-start justify-between pb-3 border-b border-[#E8D9D4]">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-black text-[#4A173A]">
                      {activeCustomer.customer_name}
                    </h3>
                    <span className="text-xs font-mono font-bold bg-[#4A173A] text-white px-2 py-0.5 rounded-lg">
                      {activeCustomer.customer_code}
                    </span>
                    <span className="text-xs bg-[#FFFAF7] text-[#B76E79] font-bold px-2 py-0.5 rounded-lg border border-[#E8D9D4]">
                      📍 {activeCustomer.location_name || 'Store'}
                    </span>
                  </div>

                  {/* Telecaller Ownership Details */}
                  <div className="flex items-center gap-3 text-xs text-[#6F5963] mt-1.5 flex-wrap">
                    <span>
                      Assigned Telecaller: <strong className="text-[#4A173A]">{activeCustomer.assigned_telecaller || 'Unassigned'}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Last Contacted: <strong className="text-[#2B1722]">{activeCustomer.last_contacted_by || 'None'}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Last Updated By: <strong className="text-[#2B1722]">{activeCustomer.last_updated_by || 'None'}</strong>
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setWorkspaceOpen(false)}
                  className="p-1.5 text-[#6F5963] hover:text-[#4A173A] hover:bg-[#FFF7F2] rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Workspace Navigation Tabs */}
              <div className="flex items-center gap-2 border-b border-[#E8D9D4] pb-2 text-xs font-bold overflow-x-auto">
                <button
                  onClick={() => setWorkspaceTab('call')}
                  className={`px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
                    workspaceTab === 'call'
                      ? 'bg-[#4A173A] text-white shadow-xs'
                      : 'bg-[#FFF7F2] text-[#6F5963] hover:text-[#4A173A]'
                  }`}
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Call First & Result</span>
                </button>
                <button
                  onClick={() => setWorkspaceTab('edit')}
                  className={`px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
                    workspaceTab === 'edit'
                      ? 'bg-[#4A173A] text-white shadow-xs'
                      : 'bg-[#FFF7F2] text-[#6F5963] hover:text-[#4A173A]'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Details</span>
                </button>
                <button
                  onClick={() => setWorkspaceTab('whatsapp')}
                  className={`px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
                    workspaceTab === 'whatsapp'
                      ? 'bg-[#198754] text-white shadow-xs'
                      : 'bg-[#FFF7F2] text-[#6F5963] hover:text-[#198754]'
                  }`}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp Automation</span>
                </button>
                <button
                  onClick={() => setWorkspaceTab('timeline')}
                  className={`px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
                    workspaceTab === 'timeline'
                      ? 'bg-[#4A173A] text-white shadow-xs'
                      : 'bg-[#FFF7F2] text-[#6F5963] hover:text-[#4A173A]'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Activity Timeline</span>
                </button>
              </div>

              {/* ── TAB 1: CALL FIRST WORKFLOW ── */}
              {workspaceTab === 'call' && (
                <div className="space-y-4">
                  {/* Huge Prominent CALL CUSTOMER Action Box */}
                  <div className="bg-[#4A173A] text-white p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md border border-[#B76E79]/30">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#E8C7A8]">
                        Direct Telephony Action
                      </div>
                      <div className="text-xl sm:text-2xl font-black mt-0.5 tracking-tight">
                        {activeCustomer.mobile_number}
                      </div>
                      <div className="text-xs text-[#E8C7A8] mt-0.5">
                        {activeCustomer.preferred_call_time ? `Preferred: ${activeCustomer.preferred_call_time}` : 'Any Time'}
                      </div>
                    </div>

                    <a
                      href={`tel:+91${activeCustomer.mobile_number.replace(/\D/g, '')}`}
                      className="w-full sm:w-auto px-6 py-3 bg-[#198754] hover:bg-[#16805B] text-white font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95"
                    >
                      <PhoneCall className="w-4 h-4" />
                      <span>CALL CUSTOMER</span>
                    </a>
                  </div>

                  {/* "What happened with this call?" Header */}
                  <form onSubmit={handleSaveCall} className="space-y-4 text-xs">
                    <div>
                      <label className="block text-xs font-black uppercase text-[#4A173A] mb-2">
                        What happened with this call? *
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[
                          'Connected — Interested',
                          'Connected — Follow-up Required',
                          'Connected — Shopping Confirmed',
                          'Connected — Visit Planned',
                          'Connected — Not Interested',
                          'No Answer',
                          'Busy',
                          'Switched Off',
                          'Wrong Number',
                          'Call Back Requested',
                          'Customer Asked to Contact Later',
                          'Other'
                        ].map((outcome) => {
                          const isSelected = callForm.call_outcome === outcome;
                          return (
                            <button
                              type="button"
                              key={outcome}
                              onClick={() => {
                                let nextStatus = activeCustomer.customer_status;
                                if (outcome.includes('Interested') || outcome === 'Connected — Interested') nextStatus = 'Contacted';
                                if (outcome.includes('Follow-up') || outcome.includes('Contact Later')) nextStatus = 'Follow-up Scheduled';
                                if (outcome.includes('Shopping Confirmed')) nextStatus = 'Shopping Confirmed';
                                if (outcome.includes('Visit Planned')) nextStatus = 'Visit Scheduled';
                                if (outcome.includes('Not Interested')) nextStatus = 'Not Interested';
                                if (outcome.includes('Call Back')) nextStatus = 'Callback';
                                if (outcome === 'Wrong Number') nextStatus = 'Invalid Number';

                                setCallForm({
                                  ...callForm,
                                  call_outcome: outcome,
                                  new_customer_status: nextStatus
                                });
                              }}
                              className={`p-2.5 rounded-xl border text-left font-bold text-xs transition-all ${
                                isSelected
                                  ? 'bg-[#4A173A] text-white border-[#4A173A] shadow-xs'
                                  : 'bg-[#FFFAF7] text-[#2B1722] border-[#E8D9D4] hover:bg-[#FFF7F2]'
                              }`}
                            >
                              {outcome}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#E8D9D4]">
                      {/* Customer Status Auto-Update */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-[#6F5963] mb-1">
                          Customer Status
                        </label>
                        <select
                          value={callForm.new_customer_status}
                          onChange={(e) => setCallForm({ ...callForm, new_customer_status: e.target.value })}
                          className="w-full px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-bold text-[#4A173A] focus:outline-none focus:border-[#B76E79]"
                        >
                          {CUSTOMER_STATUSES.map((st) => (
                            <option key={st} value={st}>{st}</option>
                          ))}
                        </select>
                      </div>

                      {/* Next Follow-up Date */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-[#6F5963] mb-1">
                          Next Follow-up Date
                        </label>
                        <input
                          type="date"
                          value={callForm.next_follow_up_date}
                          onChange={(e) => setCallForm({ ...callForm, next_follow_up_date: e.target.value })}
                          className="w-full px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                        />
                      </div>

                      {/* Next Follow-up Time Window */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-[#6F5963] mb-1">
                          Next Follow-up Time
                        </label>
                        <select
                          value={callForm.next_follow_up_time}
                          onChange={(e) => setCallForm({ ...callForm, next_follow_up_time: e.target.value })}
                          className="w-full px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-medium text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                        >
                          {CALL_TIME_OPTIONS.map((time) => (
                            <option key={time} value={time}>{time}</option>
                          ))}
                        </select>
                      </div>

                      {/* Expected Shopping Date */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-[#6F5963] mb-1">
                          Expected Shopping Date
                        </label>
                        <input
                          type="date"
                          value={callForm.expected_shopping_date}
                          onChange={(e) => setCallForm({ ...callForm, expected_shopping_date: e.target.value })}
                          className="w-full px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                        />
                      </div>
                    </div>

                    {/* Remarks / Customer Response */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[#6F5963] mb-1">
                        Call Remarks & Discussion Notes *
                      </label>
                      <textarea
                        rows={2}
                        required
                        placeholder="Enter conversation highlights, customer preferences, objections or wedding details..."
                        value={callForm.remarks}
                        onChange={(e) => setCallForm({ ...callForm, remarks: e.target.value })}
                        className="w-full px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-medium text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                      />
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between pt-3 border-t border-[#E8D9D4]">
                      <div className="text-[11px] text-[#6F5963]">
                        Caller: <strong className="text-[#4A173A]">{session?.fullName || 'Active Telecaller'}</strong>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setWorkspaceOpen(false)}
                          className="px-4 py-2 rounded-xl bg-[#FFFAF7] hover:bg-[#FFF7F2] border border-[#E8D9D4] font-semibold text-[#4A173A]"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={savingCall}
                          className="px-6 py-2 rounded-xl bg-[#4A173A] hover:bg-[#6A2853] text-white font-bold shadow-md"
                        >
                          {savingCall ? 'Saving...' : 'Save Call & Update CRM'}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              )}

              {/* ── TAB 2: EDIT CUSTOMER DETAILS (TELECALLER AUTHORITY) ── */}
              {workspaceTab === 'edit' && (
                <form onSubmit={handleSaveCustomerEdit} className="space-y-4 text-xs">
                  <div className="bg-[#FFF4D6] p-3 rounded-xl border border-[#C58A18]/30 text-[#C58A18] text-xs">
                    <strong>Telecaller Authority:</strong> You are editing customer operational fields for <strong>{activeCustomer.customer_name}</strong>. Reg ID and Store Location are permanently locked to maintain strict data integrity.
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Alternate Mobile */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[#6F5963] mb-1">
                        Alternate Mobile / WhatsApp
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 9876543210"
                        value={editForm.alternate_mobile}
                        onChange={(e) => setEditForm({ ...editForm, alternate_mobile: e.target.value })}
                        className="w-full px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                      />
                    </div>

                    {/* Preferred Call Time */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[#6F5963] mb-1">
                        Preferred Call Window
                      </label>
                      <select
                        value={editForm.preferred_call_time}
                        onChange={(e) => setEditForm({ ...editForm, preferred_call_time: e.target.value })}
                        className="w-full px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-medium text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                      >
                        {CALL_TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    {/* Wedding Date */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[#6F5963] mb-1">
                        Wedding Date
                      </label>
                      <input
                        type="date"
                        value={editForm.wedding_date}
                        onChange={(e) => setEditForm({ ...editForm, wedding_date: e.target.value })}
                        className="w-full px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                      />
                    </div>

                    {/* Expected Shopping Date */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[#6F5963] mb-1">
                        Expected Shopping Date
                      </label>
                      <input
                        type="date"
                        value={editForm.expected_shopping_date}
                        onChange={(e) => setEditForm({ ...editForm, expected_shopping_date: e.target.value })}
                        className="w-full px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                      />
                    </div>

                    {/* Shopping Category */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[#6F5963] mb-1">
                        Shopping Category
                      </label>
                      <select
                        value={editForm.preferred_shopping_category}
                        onChange={(e) => setEditForm({ ...editForm, preferred_shopping_category: e.target.value })}
                        className="w-full px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-medium text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                      >
                        {CATEGORY_OPTIONS.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    {/* Budget Range */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[#6F5963] mb-1">
                        Estimated Budget
                      </label>
                      <select
                        value={editForm.budget}
                        onChange={(e) => setEditForm({ ...editForm, budget: e.target.value })}
                        className="w-full px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-medium text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                      >
                        {BUDGET_RANGES.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>

                    {/* Customer Status */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[#6F5963] mb-1">
                        Customer Status
                      </label>
                      <select
                        value={editForm.customer_status}
                        onChange={(e) => setEditForm({ ...editForm, customer_status: e.target.value })}
                        className="w-full px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-bold text-[#4A173A] focus:outline-none focus:border-[#B76E79]"
                      >
                        {CUSTOMER_STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    {/* Next Follow-up Date */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[#6F5963] mb-1">
                        Next Follow-up Date
                      </label>
                      <input
                        type="date"
                        value={editForm.follow_up_date}
                        onChange={(e) => setEditForm({ ...editForm, follow_up_date: e.target.value })}
                        className="w-full px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                      />
                    </div>
                  </div>

                  {/* Shopping Requirements */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#6F5963] mb-1">
                      Shopping Requirements & Preferences
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Needs pure Kanchipuram silk sarees for bride & matching dhotis for groom's family..."
                      value={editForm.shopping_requirements}
                      onChange={(e) => setEditForm({ ...editForm, shopping_requirements: e.target.value })}
                      className="w-full px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-medium text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                    />
                  </div>

                  {/* Reason for Change / Audit Remarks */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#6F5963] mb-1">
                      Reason for Update / Edit Remarks
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Customer requested date change during follow-up call"
                      value={editForm.remarks}
                      onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })}
                      className="w-full px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-medium text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                    />
                  </div>

                  {/* Action Bar */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#E8D9D4]">
                    <div className="text-[11px] text-[#6F5963]">
                      Changes are permanently saved and recorded in audit trail.
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setWorkspaceOpen(false)}
                        className="px-4 py-2 rounded-xl bg-[#FFFAF7] hover:bg-[#FFF7F2] border border-[#E8D9D4] font-semibold text-[#4A173A]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingEdit}
                        className="px-6 py-2 rounded-xl bg-[#4A173A] hover:bg-[#6A2853] text-white font-bold shadow-md"
                      >
                        {savingEdit ? 'Saving Changes...' : 'Save Customer Details'}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* ── TAB 3: WHATSAPP AUTOMATION (LOCATION-SPECIFIC TEMPLATES) ── */}
              {workspaceTab === 'whatsapp' && (
                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between bg-[#E8F5EE] p-3 rounded-xl border border-[#198754]/30">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 bg-[#198754] text-white rounded-lg">
                        <MessageCircle className="w-4 h-4" />
                      </span>
                      <div>
                        <div className="font-bold text-[#198754]">
                          Location-Specific Template: {activeCustomer.location_name || 'Store'}
                        </div>
                        <div className="text-[11px] text-[#2B1722]">
                          Placeholders are automatically replaced with store phone, address & wedding schedule.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Template Picker */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#6F5963] mb-1">
                      Choose WhatsApp Template
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {whatsappTemplates.map((tmpl) => (
                        <button
                          key={tmpl.key}
                          type="button"
                          onClick={() => handleTemplateSelect(tmpl.key)}
                          className={`p-2.5 rounded-xl border text-left font-bold text-xs transition-all ${
                            selectedTemplateKey === tmpl.key
                              ? 'bg-[#198754] text-white border-[#198754] shadow-xs'
                              : 'bg-[#FFFAF7] text-[#2B1722] border-[#E8D9D4] hover:bg-[#FFF7F2]'
                          }`}
                        >
                          <div>{tmpl.label}</div>
                          <div className={`text-[10px] ${selectedTemplateKey === tmpl.key ? 'text-white/80' : 'text-[#6F5963]'}`}>
                            {tmpl.category}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Message Preview & Edit */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[10px] font-bold uppercase text-[#6F5963]">
                        Message Preview & Customization
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const tmpl = whatsappTemplates.find(t => t.key === selectedTemplateKey);
                          if (tmpl) setCustomWhatsAppMessage(tmpl.text);
                        }}
                        className="text-[10px] text-[#B76E79] font-bold hover:underline"
                      >
                        Reset Template
                      </button>
                    </div>
                    <textarea
                      rows={6}
                      value={customWhatsAppMessage}
                      onChange={(e) => setCustomWhatsAppMessage(e.target.value)}
                      className="w-full px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-mono text-xs text-[#2B1722] focus:outline-none focus:border-[#198754] leading-relaxed"
                    />
                  </div>

                  {/* Send Action */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#E8D9D4]">
                    <div className="text-[11px] text-[#6F5963]">
                      Recipient: <strong className="text-[#2B1722]">+91 {activeCustomer.mobile_number}</strong>
                    </div>

                    <button
                      type="button"
                      onClick={handleSendWhatsApp}
                      disabled={sendingWhatsApp}
                      className="px-6 py-2.5 rounded-xl bg-[#198754] hover:bg-[#16805B] text-white font-bold flex items-center gap-1.5 shadow-md transition-transform active:scale-95"
                    >
                      <Send className="w-4 h-4" />
                      <span>{sendingWhatsApp ? 'Opening & Logging...' : 'Send WhatsApp Message'}</span>
                    </button>
                  </div>

                  {/* Past Sent WhatsApp Messages Log */}
                  {whatsappLogs.length > 0 && (
                    <div className="pt-3 border-t border-[#E8D9D4]">
                      <div className="text-[10px] font-bold uppercase text-[#6F5963] mb-2">
                        WhatsApp Messages History ({whatsappLogs.length})
                      </div>
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {whatsappLogs.map((log) => (
                          <div key={log.id} className="p-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl text-xs space-y-1">
                            <div className="flex items-center justify-between font-bold text-[#4A173A]">
                              <span>{log.template_type}</span>
                              <span className="text-[10px] text-[#6F5963] font-normal">
                                {new Date(log.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                              </span>
                            </div>
                            <div className="text-[11px] text-[#2B1722] font-mono bg-white p-2 rounded border border-[#E8D9D4]/50">
                              {log.message_text}
                            </div>
                            <div className="text-[10px] text-[#6F5963]">
                              Sent by: <strong>{log.telecaller_name || 'Telecaller'}</strong> · Status: <span className="text-[#198754] font-bold">{log.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 4: CHRONOLOGICAL ACTIVITY TIMELINE (WHO + WHAT + WHEN) ── */}
              {workspaceTab === 'timeline' && (
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E8D9D4]">
                    <span className="font-bold text-[#4A173A]">Complete CRM Audit Trail</span>
                    <button
                      onClick={() => loadTimeline(activeCustomer.id)}
                      className="text-[11px] text-[#B76E79] font-bold flex items-center gap-1 hover:underline"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Refresh</span>
                    </button>
                  </div>

                  {loadingTimeline ? (
                    <div className="text-center py-8 text-[#6F5963]">
                      <RefreshCw className="w-4 h-4 animate-spin text-[#B76E79] mx-auto mb-2" />
                      <span>Loading activity feed...</span>
                    </div>
                  ) : timelineItems.length === 0 ? (
                    <div className="text-center py-8 text-[#6F5963]">
                      No recorded events yet for this customer.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                      {timelineItems.map((item, idx) => (
                        <div
                          key={item.id || idx}
                          className="p-3 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl flex items-start gap-3"
                        >
                          <div className="p-2 rounded-xl bg-[#4A173A] text-white shrink-0">
                            {item.type === 'CALL' && <PhoneCall className="w-3.5 h-3.5" />}
                            {item.type === 'WHATSAPP' && <MessageCircle className="w-3.5 h-3.5" />}
                            {item.type === 'STATUS_CHANGE' && <ArrowUpDown className="w-3.5 h-3.5" />}
                            {item.type === 'AUDIT' && <Edit3 className="w-3.5 h-3.5" />}
                            {item.type === 'ASSIGNMENT' && <UserCheck className="w-3.5 h-3.5" />}
                            {item.type === 'CREATED' && <Sparkles className="w-3.5 h-3.5" />}
                            {item.type === 'VISIT' && <MapPin className="w-3.5 h-3.5" />}
                            {item.type === 'APPOINTMENT' && <Calendar className="w-3.5 h-3.5" />}
                            {item.type === 'NOTE' && <History className="w-3.5 h-3.5" />}
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="font-bold text-[#4A173A]">
                                {item.action}
                              </span>
                              <span className="text-[10px] text-[#6F5963] font-mono">
                                {new Date(item.date_time).toLocaleString('en-IN', {
                                  dateStyle: 'medium',
                                  timeStyle: 'short'
                                })}
                              </span>
                            </div>

                            <div className="text-xs text-[#2B1722] mt-0.5">
                              {item.details}
                            </div>

                            {item.remarks && (
                              <div className="text-[11px] text-[#6F5963] italic mt-1 bg-white p-1.5 rounded border border-[#E8D9D4]/60">
                                "{item.remarks}"
                              </div>
                            )}

                            <div className="text-[10px] text-[#B76E79] font-semibold mt-1">
                              By: <strong>{item.performer_name || 'System'}</strong>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════════
            TELECALLER PERFORMANCE SCORECARD MODAL
        ══════════════════════════════════════════════════════════════════════════ */}
        {perfModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 z-50 animate-fade-in">
            <div className="bg-[#FFFDFC] rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-[#E8D9D4] space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-[#E8D9D4]">
                <div>
                  <h3 className="text-base font-bold text-[#4A173A] flex items-center gap-2">
                    <Award className="w-4 h-4 text-[#B76E79]" />
                    <span>Telecaller Operational Activity & Performance</span>
                  </h3>
                  <div className="text-xs text-[#6F5963]">
                    Factual performance metrics tracked live from customer call activity and CRM updates.
                  </div>
                </div>
                <button
                  onClick={() => setPerfModalOpen(false)}
                  className="p-1.5 text-[#6F5963] hover:text-[#4A173A] hover:bg-[#FFF7F2] rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {loadingPerf ? (
                <div className="text-center py-12 text-[#6F5963]">
                  <RefreshCw className="w-5 h-5 animate-spin text-[#B76E79] mx-auto mb-2" />
                  <span>Loading performance metrics...</span>
                </div>
              ) : performanceMetrics.length === 0 ? (
                <div className="text-center py-12 text-[#6F5963]">
                  No telecaller metrics available for the selected location.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-[#2B1722]">
                    <thead className="bg-[#F8EDE8] text-[#4A173A] border-b border-[#E8D9D4] uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3 px-3 font-bold">Telecaller</th>
                        <th className="py-3 px-3 font-bold">Location</th>
                        <th className="py-3 px-3 font-bold text-center">Assigned</th>
                        <th className="py-3 px-3 font-bold text-center">Calls Done</th>
                        <th className="py-3 px-3 font-bold text-center">Pending</th>
                        <th className="py-3 px-3 font-bold text-center">Overdue</th>
                        <th className="py-3 px-3 font-bold text-center">Connected</th>
                        <th className="py-3 px-3 font-bold text-center">No Answer</th>
                        <th className="py-3 px-3 font-bold text-center">Shop Confirmed</th>
                        <th className="py-3 px-3 font-bold text-center">Visits Planned</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8D9D4]">
                      {performanceMetrics.map((p) => (
                        <tr key={p.telecaller_id} className="hover:bg-[#FFF1F2]">
                          <td className="py-3 px-3 font-bold text-[#4A173A]">
                            👤 {p.telecaller_name}
                          </td>
                          <td className="py-3 px-3 font-medium text-[#6F5963]">
                            📍 {p.location_name || 'Store'}
                          </td>
                          <td className="py-3 px-3 font-bold text-center">{p.assignedCustomers}</td>
                          <td className="py-3 px-3 font-bold text-center text-[#198754]">{p.callsToday}</td>
                          <td className="py-3 px-3 font-semibold text-center text-[#C58A18]">{p.callsPending}</td>
                          <td className="py-3 px-3 font-bold text-center text-[#B42318]">{p.overdue}</td>
                          <td className="py-3 px-3 font-medium text-center">{p.connectedCalls}</td>
                          <td className="py-3 px-3 font-medium text-center">{p.noAnswer}</td>
                          <td className="py-3 px-3 font-bold text-center text-[#198754]">{p.shoppingConfirmed}</td>
                          <td className="py-3 px-3 font-bold text-center text-[#4A173A]">{p.visitsPlanned}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

      </PageContainer>
    </DashboardLayout>
  );
}
