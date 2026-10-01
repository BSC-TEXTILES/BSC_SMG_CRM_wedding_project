import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import ToastContainer from '../../components/Toast';
import { toastManager } from '../../utils/toastManager';
import { useTelecallerQueue } from '../../hooks/useTelecallerQueue';
import { useRealtimeSection } from '../../hooks/useRealtimeSection';
import { API, Auth, UserSession } from '../../services/api';
import { parseDate, formatDateDisplay, toISODateInput } from '../../utils/dateUtils';
import { lockBodyScroll, unlockBodyScroll } from '../../components/ui/ModalPortal';
import WeddingNav from './WeddingNav';
import {
  WeddingCustomer,
  WeddingWhatsAppTemplate,
  WeddingWhatsAppLog,
  WeddingActivityItem,
  TelecallerPerformanceMetric,
  CUSTOMER_STATUSES,
  CALL_TIME_OPTIONS,
  BUDGET_RANGES,
  CATEGORY_OPTIONS,
  ARCHIVE_SUCCESS_MESSAGE,
  getStatusBadge
} from './weddingTypes';
import LocationFilterSelect from '../../components/ui/LocationFilterSelect';
import {
  PhoneCall, CircleCheck, Search, MessageCircle, Eye, RefreshCw, X,
  Check, Award, MapPin, Calendar, Clock, Edit3, Send, Sparkles,
  UserCheck, AlertTriangle, ArrowUpDown, History,
  ShoppingBag, PhoneForwarded, Users, CheckCircle2, Copy
} from 'lucide-react';

export default function TelecallerDeskPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [session, setSession] = useState<UserSession | null>(() => Auth.get());

  const isDashboardRoute = location.pathname.includes('telecaller-dashboard');
  const pageTitle = isDashboardRoute ? 'Telecaller Dashboard' : 'Telecaller Calling Desk';

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
  const [, setLocations] = useState<any[]>([]);

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

  // Live socket synchronization for real-time queue & desk updates
  useRealtimeSection(['wedding', 'callqueue'], () => {
    refreshQueue();
  }, { debounceMs: 600 });

  // ── Unified Customer Workspace State ─────────────────────────────
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<'call' | 'edit' | 'whatsapp' | 'timeline'>('call');
  const [activeCustomer, setActiveCustomer] = useState<WeddingCustomer | null>(null);
  const [copiedNumber, setCopiedNumber] = useState(false);

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
  const [, setLoadingTemplates] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [whatsappLogs, setWhatsappLogs] = useState<WeddingWhatsAppLog[]>([]);

  // Activity Timeline State
  const [timelineItems, setTimelineItems] = useState<WeddingActivityItem[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // Performance Scorecard Modal
  const [perfModalOpen, setPerfModalOpen] = useState(false);
  const [performanceMetrics, setPerformanceMetrics] = useState<TelecallerPerformanceMetric[]>([]);
  const [loadingPerf, setLoadingPerf] = useState(false);

  // Body scroll lock management when modals are open
  useEffect(() => {
    if (workspaceOpen || perfModalOpen) {
      lockBodyScroll();
    } else {
      unlockBodyScroll();
    }
    return () => {
      unlockBodyScroll();
    };
  }, [workspaceOpen, perfModalOpen]);

  // Escape key closes modals safely
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (workspaceOpen) setWorkspaceOpen(false);
        if (perfModalOpen) setPerfModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [workspaceOpen, perfModalOpen]);

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
    setCopiedNumber(false);

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

  const handleCopyMobile = (mobile: string) => {
    if (!mobile) return;
    navigator.clipboard.writeText(mobile);
    setCopiedNumber(true);
    setTimeout(() => setCopiedNumber(false), 2000);
    toastManager.success('Phone number copied to clipboard');
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
      const logRes = await API.getWeddingWhatsAppLogs(customerId);
      setWhatsappLogs(logRes?.logs || logRes?.data?.logs || []);
    } catch {
      // quiet fail fallback
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleTemplateSelect = (key: string) => {
    setSelectedTemplateKey(key);
    const tmpl = whatsappTemplates.find(t => t.key === key);
    if (tmpl) {
      setCustomWhatsAppMessage(tmpl.text);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!activeCustomer) return;
    const phone = activeCustomer.mobile_number.replace(/\D/g, '');
    if (!phone) {
      toastManager.error('whatsapp', 'Customer does not have a valid mobile number');
      return;
    }

    setSendingWhatsApp(true);
    try {
      await API.sendWeddingWhatsAppMessage(activeCustomer.id, {
        template_type: selectedTemplateKey,
        custom_message: customWhatsAppMessage,
        recipient_phone: phone
      });

      const encodedMsg = encodeURIComponent(customWhatsAppMessage);
      const waUrl = `https://wa.me/91${phone}?text=${encodedMsg}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');

      toastManager.success('WhatsApp message logged and link opened successfully.');
      const logRes = await API.getWeddingWhatsAppLogs(activeCustomer.id);
      setWhatsappLogs(logRes?.logs || logRes?.data?.logs || []);
      refreshQueue();
    } catch (err: any) {
      toastManager.error('whatsapp', 'Error logging WhatsApp: ' + err.message);
    } finally {
      setSendingWhatsApp(false);
    }
  };

  const loadTimeline = async (customerId: number) => {
    setLoadingTimeline(true);
    try {
      const res = await API.getWeddingCustomerTimeline(customerId);
      setTimelineItems(res?.timeline || res?.data?.timeline || []);
    } catch {
      // quiet fail
    } finally {
      setLoadingTimeline(false);
    }
  };

  // Submit Call Outcome
  const handleSaveCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCustomer) return;

    // Strict validation for callback outcomes
    const isCallback = ['Call Back Requested', 'Callback Requested', 'Callback', 'Customer Asked to Contact Later'].includes(callForm.call_outcome);
    if (isCallback && !callForm.next_follow_up_date) {
      toastManager.error('call-validate', 'Please select a valid next follow-up date for callback.');
      return;
    }

    if (!callForm.remarks.trim()) {
      toastManager.error('call-validate', 'Please enter discussion notes or call remarks.');
      return;
    }

    setSavingCall(true);
    try {
      const res: any = await API.logWeddingCall({
        customer_id: activeCustomer.id,
        call_date: new Date().toISOString().slice(0, 10),
        call_time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        call_status: callForm.call_status,
        call_outcome: callForm.call_outcome,
        remarks: callForm.remarks.trim(),
        customer_response: callForm.customer_response,
        next_follow_up_date: callForm.next_follow_up_date || undefined,
        next_follow_up_time: callForm.next_follow_up_time || undefined,
        expected_shopping_date_updated: callForm.expected_shopping_date || undefined,
        new_customer_status: callForm.new_customer_status || undefined
      });

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
      title={pageTitle}
      breadcrumbs={[{ label: 'Store Operations', href: '/dashboard' }, { label: pageTitle }]}
    >
      <div className="w-full space-y-4 pt-2">
        <ToastContainer />

        {/* ── Top Navigation Sub-Navigation Bar ── */}
        <WeddingNav
          currentPageTitle="Telecaller Workspace"
          hideTitleCard={true}
          actions={
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <LocationFilterSelect
                value={locationFilter}
                onChange={(val) => setLocationFilter(val)}
              />
              <button
                onClick={handleOpenPerformance}
                className="px-3 py-1.5 bg-[#FFFDFC] hover:bg-[#FFF7F2] border border-[#E8D9D4] rounded-xl text-xs font-bold text-[#4A173A] flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                title="View Team Performance Scorecard"
              >
                <Award className="w-3.5 h-3.5 text-[#B76E79]" />
                <span className="hidden sm:inline">Performance</span>
              </button>
              <button
                onClick={refreshQueue}
                disabled={loading}
                className="px-3 py-1.5 bg-[#FFFDFC] hover:bg-[#FFF7F2] border border-[#E8D9D4] rounded-xl text-xs font-bold text-[#4A173A] flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer disabled:opacity-60"
                title="Refresh telecaller queue"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#B76E79] ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          }
        />

        {/* ── TOP STATS RIBBON: 8 Operational Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
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
                className={`p-3 rounded-2xl border text-left transition-all hover:shadow-sm cursor-pointer ${
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
        <div className="bg-[#FFFDFC] rounded-3xl border border-[#E8D9D4] shadow-xs p-4 sm:p-5 space-y-4">
          {/* Queue Selection Tabs & Fast Search */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#E8D9D4] pb-3">
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                    activeQueue === tab.key
                      ? tab.isSpecial
                        ? 'bg-[#4A173A] text-white shadow-xs'
                        : 'bg-[#B76E79] text-white shadow-xs'
                      : tab.isSpecial
                        ? 'bg-[#F6E2E5] text-[#4A173A] hover:bg-[#D89AA3]/30'
                        : 'bg-[#FFF7F2] text-[#6F5963] hover:text-[#4A173A] hover:bg-[#F6E2E5]'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                    tab.alert && tab.count > 0 ? 'bg-[#FDE8E7] text-[#B42318]' : 'bg-black/10'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Fast Customer Search Box */}
            <div className="relative w-full sm:w-72 shrink-0">
              <Search className="w-3.5 h-3.5 text-[#9A858D] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search name, phone, reg ID..."
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
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                        {cust.customer_status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-[#E8D9D4]">
                      <div className="text-[#6F5963]">
                        Follow-up: <strong className={isOverdue ? 'text-[#B42318]' : 'text-[#2B1722]'}>
                          {cust.follow_up_date ? formatDateDisplay(cust.follow_up_date, 'None') : 'None'}
                        </strong>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleDirectCall(cust)}
                          className="px-3 py-1.5 bg-[#4A173A] hover:bg-[#6A2853] text-white font-bold rounded-xl text-xs flex items-center gap-1"
                        >
                          <PhoneCall className="w-3.5 h-3.5 text-[#E8C7A8]" />
                          <span>Call</span>
                        </button>
                        <button
                          onClick={() => handleOpenWorkspace(cust, 'call')}
                          className="p-1.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl text-[#4A173A]"
                          title="Open Workspace"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[#B76E79]" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ── Desktop Queue Table (md+) ── */}
          <div className="hidden md:block table-frame custom-scrollbar border border-[#E8D9D4] rounded-2xl">
            <table className="w-full min-w-[1100px] text-left text-xs text-[#2B1722] whitespace-nowrap">
              <thead className="bg-[#FFFAF7] text-[#4A173A] border-b border-[#E8D9D4] uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-3 font-black">Reg ID</th>
                  <th className="py-3 px-3 font-black">Customer Name</th>
                  <th className="py-3 px-3 font-black">Mobile</th>
                  <th className="py-3 px-3 font-black">Location</th>
                  <th className="py-3 px-3 font-black">Wedding Date</th>
                  <th className="py-3 px-3 font-black">Assigned To</th>
                  <th className="py-3 px-3 font-black">Last Contact</th>
                  <th className="py-3 px-3 font-black">Status</th>
                  <th className="py-3 px-3 font-black">Next Follow-up</th>
                  <th className="py-3 px-3 font-black text-right">Quick Actions</th>
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
                      <tr key={cust.id} className="hover:bg-[#FFF7F2] transition-colors">
                        <td className="py-3 px-3 font-bold text-[#4A173A]">
                          <button
                            onClick={() => handleOpenWorkspace(cust, 'timeline')}
                            className="hover:text-[#B76E79] hover:underline font-mono cursor-pointer"
                          >
                            {cust.customer_code}
                          </button>
                        </td>
                        <td className="py-3 px-3">
                          <button
                            onClick={() => handleOpenWorkspace(cust, 'call')}
                            className="font-bold text-[#2B1722] hover:text-[#4A173A] text-left block cursor-pointer"
                          >
                            {cust.customer_name}
                          </button>
                          <span className="text-[10px] text-[#6F5963] block mt-0.5">
                            {cust.preferred_shopping_category || 'General Wedding'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-medium text-[#2B1722]">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono">{cust.mobile_number}</span>
                            <button
                              onClick={() => handleCopyMobile(cust.mobile_number)}
                              className="text-[#9A858D] hover:text-[#4A173A] p-0.5 rounded cursor-pointer"
                              title="Copy mobile number"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                          {cust.alternate_mobile && (
                            <span className="text-[10px] text-[#6F5963] block font-mono">Alt: {cust.alternate_mobile}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-medium text-[#6F5963]">
                          📍 {cust.location_name || 'Store'}
                        </td>
                        <td className="py-3 px-3">
                          {parseDate(cust.wedding_date) ? (
                            <span className="text-[#B76E79] font-bold">
                              💍 {formatDateDisplay(cust.wedding_date, 'TBD')}
                            </span>
                          ) : (
                            <span className="text-[#9A858D]">TBD</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-medium">
                          {cust.assigned_telecaller ? (
                            <span className="bg-[#FFFAF7] border border-[#E8D9D4] text-[#4A173A] px-2 py-0.5 rounded-full text-[11px] font-bold">
                              👤 {cust.assigned_telecaller}
                            </span>
                          ) : (
                            <span className="text-[#9A858D] italic text-[11px]">Unassigned</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-[#6F5963]">
                          {cust.last_contacted_by ? (
                            <div>
                              <span className="font-bold text-[#4A173A] text-[11px] block">{cust.last_contacted_by}</span>
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
                            <span className={`font-bold ${isOverdue ? 'text-[#B42318]' : 'text-[#2B1722]'}`}>
                              {formatDateDisplay(cust.follow_up_date, 'None')}
                              {isOverdue && <span className="ml-1 text-[9px] bg-[#FDE8E7] text-[#B42318] px-1 rounded uppercase font-bold">Overdue</span>}
                            </span>
                          ) : (
                            <span className="text-[#9A858D]">None</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* 1. CALL (Prominent Call Action) */}
                            <button
                              onClick={() => handleDirectCall(cust)}
                              className="px-3 py-1.5 bg-[#4A173A] hover:bg-[#6A2853] text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-2xs border border-[#4A173A] cursor-pointer"
                              title="Call Customer & Open Workspace"
                            >
                              <PhoneCall className="w-3.5 h-3.5 text-[#E8C7A8]" />
                              <span>CALL</span>
                            </button>

                            {/* 2. UPDATE (Edit Details) */}
                            <button
                              onClick={() => handleOpenWorkspace(cust, 'edit')}
                              className="px-2.5 py-1.5 bg-[#FFF7F2] hover:bg-[#F6E2E5] text-[#4A173A] font-bold rounded-xl text-xs border border-[#E8D9D4] flex items-center gap-1 cursor-pointer"
                              title="Edit Customer Details"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-[#B76E79]" />
                              <span>Update</span>
                            </button>

                            {/* 3. WHATSAPP */}
                            <button
                              onClick={() => handleOpenWorkspace(cust, 'whatsapp')}
                              className="p-1.5 bg-[#198754] hover:bg-[#16805B] text-white rounded-xl text-xs cursor-pointer shadow-2xs"
                              title="Send WhatsApp Template"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </button>

                            {/* 4. TIMELINE */}
                            <button
                              onClick={() => handleOpenWorkspace(cust, 'timeline')}
                              className="p-1.5 bg-[#FFFAF7] hover:bg-[#FFF7F2] text-[#4A173A] rounded-xl text-xs border border-[#E8D9D4] cursor-pointer"
                              title="View Activity Timeline"
                            >
                              <History className="w-3.5 h-3.5 text-[#B76E79]" />
                            </button>

                            {/* 5. FULL PROFILE */}
                            <Link
                              to={`/wedding-crm/customers/${cust.id}`}
                              className="p-1.5 bg-[#FFFAF7] hover:bg-[#FFF7F2] text-[#4A173A] rounded-xl text-xs border border-[#E8D9D4]"
                              title="View Full Profile"
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
            PORTAL: UNIFIED TELECALLER WORKSPACE MODAL
            Viewport-constrained with fixed header, internal scroll, and sticky footer.
        ══════════════════════════════════════════════════════════════════════════ */}
        {workspaceOpen && activeCustomer && createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/60 backdrop-blur-xs overscroll-contain animate-fade-in">
            {/* Backdrop click to dismiss */}
            <div className="absolute inset-0" onClick={() => setWorkspaceOpen(false)} aria-hidden="true" />

            {/* Modal Dialog Card */}
            <div className="relative w-full max-w-3xl max-h-[calc(100dvh-2rem)] bg-[#FFFDFC] rounded-3xl shadow-2xl border border-[#E8D9D4] flex flex-col overflow-hidden z-10 my-auto">
              
              {/* 1. FIXED MODAL HEADER (shrink-0) */}
              <div className="p-4 sm:p-5 border-b border-[#E8D9D4] bg-[#FFFDFC] shrink-0 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg sm:text-xl font-black text-[#4A173A]">
                        {activeCustomer.customer_name}
                      </h3>
                      <span className="text-xs font-mono font-bold bg-[#4A173A] text-white px-2 py-0.5 rounded-lg">
                        {activeCustomer.customer_code}
                      </span>
                      <span className="text-xs bg-[#FFFAF7] text-[#B76E79] font-bold px-2 py-0.5 rounded-lg border border-[#E8D9D4]">
                        📍 {activeCustomer.location_name || 'Store'}
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-[#EDE7F6] text-[#6A2853] border border-[#6A2853]/20">
                        {activeCustomer.customer_status}
                      </span>
                    </div>

                    {/* Telecaller Details */}
                    <div className="flex items-center gap-3 text-xs text-[#6F5963] mt-1.5 flex-wrap">
                      <span>
                        Assigned: <strong className="text-[#4A173A]">{activeCustomer.assigned_telecaller || 'Unassigned'}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Last Contact: <strong className="text-[#2B1722]">{activeCustomer.last_contacted_by || 'None'}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Shopping Date: <strong className="text-[#2B1722]">{formatDateDisplay(activeCustomer.expected_shopping_date, 'Not Decided')}</strong>
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setWorkspaceOpen(false)}
                    className="p-1.5 text-[#6F5963] hover:text-[#4A173A] hover:bg-[#FFF7F2] rounded-xl transition-colors cursor-pointer shrink-0"
                    title="Close modal (Esc)"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Controlled Horizontal-Scroll Navigation Tabs */}
                <div className="flex items-center gap-2 border-t border-[#E8D9D4]/60 pt-2.5 overflow-x-auto scrollbar-hide text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setWorkspaceTab('call')}
                    className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                      workspaceTab === 'call'
                        ? 'bg-[#4A173A] text-white shadow-xs'
                        : 'bg-[#FFF7F2] text-[#6F5963] hover:text-[#4A173A]'
                    }`}
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>Call Customer & Outcome</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkspaceTab('edit')}
                    className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                      workspaceTab === 'edit'
                        ? 'bg-[#4A173A] text-white shadow-xs'
                        : 'bg-[#FFF7F2] text-[#6F5963] hover:text-[#4A173A]'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Customer Details</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkspaceTab('whatsapp')}
                    className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                      workspaceTab === 'whatsapp'
                        ? 'bg-[#198754] text-white shadow-xs'
                        : 'bg-[#FFF7F2] text-[#6F5963] hover:text-[#198754]'
                    }`}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp Automation</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkspaceTab('timeline')}
                    className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                      workspaceTab === 'timeline'
                        ? 'bg-[#4A173A] text-white shadow-xs'
                        : 'bg-[#FFF7F2] text-[#6F5963] hover:text-[#4A173A]'
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Activity Timeline</span>
                  </button>
                </div>
              </div>

              {/* 2. SCROLLABLE FORM CONTENT (flex-1 overflow-y-auto min-h-0 custom-scrollbar) */}
              <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 space-y-5 custom-scrollbar">
                
                {/* ── TAB 1: CALL FIRST WORKFLOW ── */}
                {workspaceTab === 'call' && (
                  <form id="call-form" onSubmit={handleSaveCall} className="space-y-4 text-xs">
                    {/* Direct Telephony Action Box */}
                    <div className="bg-[#4A173A] text-white p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md border border-[#B76E79]/30">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-[#E8C7A8]">
                          Direct Telephony Action
                        </div>
                        <div className="text-xl sm:text-2xl font-black mt-0.5 tracking-tight flex items-center gap-2">
                          <span>{activeCustomer.mobile_number}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyMobile(activeCustomer.mobile_number)}
                            className="p-1 hover:bg-white/20 rounded transition-colors text-white/80 cursor-pointer"
                            title="Copy number"
                          >
                            {copiedNumber ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                        <div className="text-xs text-[#E8C7A8] mt-0.5">
                          {activeCustomer.preferred_call_time ? `Preferred Window: ${activeCustomer.preferred_call_time}` : 'Window: Any Time'}
                        </div>
                      </div>

                      <a
                        href={`tel:+91${activeCustomer.mobile_number.replace(/\D/g, '')}`}
                        className="w-full sm:w-auto px-6 py-3 bg-[#198754] hover:bg-[#16805B] text-white font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer"
                      >
                        <PhoneCall className="w-4 h-4 text-white" />
                        <span>CALL CUSTOMER</span>
                      </a>
                    </div>

                    {/* Call Outcome Options (Grid) */}
                    <div>
                      <label className="block text-xs font-black uppercase text-[#4A173A] mb-2 tracking-wide">
                        What was the outcome of this call? *
                      </label>
                      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {[
                          { label: 'Connected — Interested', badge: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
                          { label: 'Connected — Follow-up Required', badge: 'bg-amber-50 text-amber-800 border-amber-200' },
                          { label: 'Connected — Shopping Confirmed', badge: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
                          { label: 'Connected — Visit Planned', badge: 'bg-purple-50 text-purple-800 border-purple-200' },
                          { label: 'Connected — Not Interested', badge: 'bg-rose-50 text-rose-800 border-rose-200' },
                          { label: 'No Answer', badge: 'bg-zinc-50 text-zinc-700 border-zinc-200' },
                          { label: 'Busy', badge: 'bg-zinc-50 text-zinc-700 border-zinc-200' },
                          { label: 'Switched Off', badge: 'bg-zinc-50 text-zinc-700 border-zinc-200' },
                          { label: 'Wrong Number', badge: 'bg-red-50 text-red-800 border-red-200' },
                          { label: 'Call Back Requested', badge: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
                          { label: 'Customer Asked to Contact Later', badge: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
                          { label: 'Other', badge: 'bg-gray-50 text-gray-700 border-gray-200' }
                        ].map(({ label }) => {
                          const isSelected = callForm.call_outcome === label;
                          return (
                            <button
                              type="button"
                              key={label}
                              onClick={() => {
                                let nextStatus = activeCustomer.customer_status;
                                if (label.includes('Interested') || label === 'Connected — Interested') nextStatus = 'Contacted';
                                if (label.includes('Follow-up') || label.includes('Contact Later')) nextStatus = 'Follow-up Scheduled';
                                if (label.includes('Shopping Confirmed')) nextStatus = 'Shopping Confirmed';
                                if (label.includes('Visit Planned')) nextStatus = 'Visit Scheduled';
                                if (label.includes('Not Interested')) nextStatus = 'Not Interested';
                                if (label.includes('Call Back')) nextStatus = 'Callback';
                                if (label === 'Wrong Number') nextStatus = 'Invalid Number';

                                setCallForm({
                                  ...callForm,
                                  call_outcome: label,
                                  new_customer_status: nextStatus
                                });
                              }}
                              className={`p-2.5 rounded-xl border text-left font-bold text-xs transition-all flex items-center justify-between min-h-[46px] cursor-pointer ${
                                isSelected
                                  ? 'bg-[#4A173A] text-white border-[#4A173A] shadow-xs'
                                  : 'bg-[#FFFAF7] text-[#2B1722] border-[#E8D9D4] hover:bg-[#FFF7F2] hover:border-[#B76E79]'
                              }`}
                            >
                              <span className="leading-tight">{label}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-[#E8C7A8] shrink-0 ml-1" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Operational Fields Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-[#E8D9D4]">
                      {/* Customer Status Update */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-[#6F5963] mb-1">
                          Customer Status *
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
                          Next Follow-up Date {['Call Back Requested', 'Customer Asked to Contact Later'].includes(callForm.call_outcome) ? '*' : ''}
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
                          Next Follow-up Time Window
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

                    {/* Remarks / Discussion Notes */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[#6F5963] mb-1">
                        Call Remarks & Discussion Notes *
                      </label>
                      <textarea
                        rows={3}
                        required
                        placeholder="Enter conversation highlights, customer requirements, objections, or wedding schedule details..."
                        value={callForm.remarks}
                        onChange={(e) => setCallForm({ ...callForm, remarks: e.target.value })}
                        className="w-full px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-medium text-[#2B1722] focus:outline-none focus:border-[#B76E79] leading-relaxed"
                      />
                    </div>
                  </form>
                )}

                {/* ── TAB 2: EDIT CUSTOMER DETAILS ── */}
                {workspaceTab === 'edit' && (
                  <form id="edit-form" onSubmit={handleSaveCustomerEdit} className="space-y-4 text-xs">
                    <div className="bg-[#FFF4D6] p-3 rounded-xl border border-[#C58A18]/30 text-[#C58A18] text-xs">
                      <strong>Telecaller Authority:</strong> Editing operational fields for <strong>{activeCustomer.customer_name}</strong>. Customer Reg ID, Location, and Wedding Date are locked for strict data integrity.
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
                  </form>
                )}

                {/* ── TAB 3: WHATSAPP AUTOMATION ── */}
                {workspaceTab === 'whatsapp' && (
                  <div className="space-y-4 text-xs">
                    <div className="flex items-center justify-between bg-[#E8F5EE] p-3 rounded-xl border border-[#198754]/30">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 bg-[#198754] text-white rounded-lg">
                          <MessageCircle className="w-4 h-4" />
                        </span>
                        <div>
                          <div className="font-bold text-[#198754]">
                            Store Location Template: {activeCustomer.location_name || 'Store'}
                          </div>
                          <div className="text-[11px] text-[#2B1722]">
                            Store phone, showroom address & wedding schedule placeholders are automatically resolved.
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[#6F5963] mb-1">
                        Choose WhatsApp Template
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {whatsappTemplates.map((tmpl) => (
                          <button
                            key={tmpl.key}
                            type="button"
                            onClick={() => handleTemplateSelect(tmpl.key)}
                            className={`p-2.5 rounded-xl border text-left font-bold text-xs transition-all cursor-pointer ${
                              selectedTemplateKey === tmpl.key
                                ? 'bg-[#198754] text-white border-[#198754] shadow-xs'
                                : 'bg-[#FFFAF7] text-[#2B1722] border-[#E8D9D4] hover:bg-[#FFF7F2]'
                            }`}
                          >
                            <div>{tmpl.label}</div>
                            <div className={`text-[10px] font-normal ${selectedTemplateKey === tmpl.key ? 'text-white/80' : 'text-[#6F5963]'}`}>
                              {tmpl.category}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

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
                          className="text-[10px] text-[#B76E79] font-bold hover:underline cursor-pointer"
                        >
                          Reset to Template
                        </button>
                      </div>
                      <textarea
                        rows={6}
                        value={customWhatsAppMessage}
                        onChange={(e) => setCustomWhatsAppMessage(e.target.value)}
                        className="w-full px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-mono text-xs text-[#2B1722] focus:outline-none focus:border-[#198754] leading-relaxed"
                      />
                    </div>

                    {whatsappLogs.length > 0 && (
                      <div className="pt-3 border-t border-[#E8D9D4]">
                        <div className="text-[10px] font-bold uppercase text-[#6F5963] mb-2">
                          Sent Message History ({whatsappLogs.length})
                        </div>
                        <div className="space-y-2 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
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
                                By: <strong>{log.telecaller_name || 'Telecaller'}</strong> · Status: <span className="text-[#198754] font-bold">{log.status}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── TAB 4: CHRONOLOGICAL ACTIVITY TIMELINE ── */}
                {workspaceTab === 'timeline' && (
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-[#E8D9D4]">
                      <span className="font-bold text-[#4A173A]">Complete CRM Audit Trail</span>
                      <button
                        onClick={() => loadTimeline(activeCustomer.id)}
                        className="text-[11px] text-[#B76E79] font-bold flex items-center gap-1 hover:underline cursor-pointer"
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
                      <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
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

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className="font-bold text-[#4A173A] truncate">
                                  {item.action}
                                </span>
                                <span className="text-[10px] text-[#6F5963] font-mono shrink-0">
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

              {/* 3. STICKY MODAL FOOTER (shrink-0) */}
              <div className="p-4 sm:px-6 py-3 bg-[#FFFAF7] border-t border-[#E8D9D4] flex items-center justify-between gap-3 shrink-0">
                <div className="text-xs text-[#6F5963]">
                  Logged In: <strong className="text-[#4A173A]">{session?.fullName || 'Active Telecaller'}</strong>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setWorkspaceOpen(false)}
                    className="px-4 py-2 rounded-xl bg-[#FFFDFC] hover:bg-[#FFF7F2] border border-[#E8D9D4] font-bold text-xs text-[#4A173A] cursor-pointer"
                  >
                    Cancel
                  </button>

                  {workspaceTab === 'call' && (
                    <button
                      type="submit"
                      form="call-form"
                      disabled={savingCall}
                      className="px-5 py-2 rounded-xl bg-[#4A173A] hover:bg-[#6A2853] text-white font-bold text-xs shadow-md cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                    >
                      {savingCall && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>{savingCall ? 'Saving Call...' : 'Save Call & Update CRM'}</span>
                    </button>
                  )}

                  {workspaceTab === 'edit' && (
                    <button
                      type="submit"
                      form="edit-form"
                      disabled={savingEdit}
                      className="px-5 py-2 rounded-xl bg-[#4A173A] hover:bg-[#6A2853] text-white font-bold text-xs shadow-md cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                    >
                      {savingEdit && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>{savingEdit ? 'Saving...' : 'Save Customer Details'}</span>
                    </button>
                  )}

                  {workspaceTab === 'whatsapp' && (
                    <button
                      type="button"
                      onClick={handleSendWhatsApp}
                      disabled={sendingWhatsApp}
                      className="px-5 py-2 rounded-xl bg-[#198754] hover:bg-[#16805B] text-white font-bold text-xs shadow-md cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{sendingWhatsApp ? 'Opening & Logging...' : 'Send WhatsApp Message'}</span>
                    </button>
                  )}

                  {workspaceTab === 'timeline' && (
                    <button
                      type="button"
                      onClick={() => setWorkspaceOpen(false)}
                      className="px-5 py-2 rounded-xl bg-[#4A173A] hover:bg-[#6A2853] text-white font-bold text-xs shadow-md cursor-pointer"
                    >
                      Done
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>,
          document.body
        )}

        {/* ══════════════════════════════════════════════════════════════════════════
            PORTAL: TELECALLER PERFORMANCE SCORECARD MODAL
        ══════════════════════════════════════════════════════════════════════════ */}
        {perfModalOpen && createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs overscroll-contain animate-fade-in">
            {/* Backdrop click to dismiss */}
            <div className="absolute inset-0" onClick={() => setPerfModalOpen(false)} aria-hidden="true" />

            {/* Modal Dialog */}
            <div className="relative w-full max-w-4xl max-h-[calc(100dvh-2rem)] bg-[#FFFDFC] rounded-3xl shadow-2xl border border-[#E8D9D4] flex flex-col overflow-hidden z-10 my-auto">
              {/* Fixed Header */}
              <div className="p-4 sm:p-5 border-b border-[#E8D9D4] flex items-center justify-between bg-[#FFFDFC] shrink-0">
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
                  className="p-1.5 text-[#6F5963] hover:text-[#4A173A] hover:bg-[#FFF7F2] rounded-xl cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
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
                  <div className="table-frame custom-scrollbar border border-[#E8D9D4] rounded-2xl">
                    <table className="w-full text-left text-xs text-[#2B1722] whitespace-nowrap">
                      <thead className="bg-[#FFFAF7] text-[#4A173A] border-b border-[#E8D9D4] uppercase text-[10px] tracking-wider">
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
                          <tr key={p.telecaller_id} className="hover:bg-[#FFF7F2]">
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

              {/* Fixed Footer */}
              <div className="p-4 bg-[#FFFAF7] border-t border-[#E8D9D4] flex items-center justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setPerfModalOpen(false)}
                  className="px-5 py-2 rounded-xl bg-[#4A173A] hover:bg-[#6A2853] text-white font-bold text-xs shadow-md cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      </div>
    </DashboardLayout>
  );
}
