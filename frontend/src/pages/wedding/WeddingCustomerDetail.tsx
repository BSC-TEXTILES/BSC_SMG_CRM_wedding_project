import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import PageContainer from '../../components/ui/PageContainer';
import ToastContainer, { showToast } from '../../components/Toast';
import { lockBodyScroll, unlockBodyScroll } from '../../components/ui/ModalPortal';
import { API, Auth, UserSession } from '../../services/api';
import WeddingNav from './WeddingNav';
import { parseDate, formatDateDisplay, formatDateTimeDisplay } from '../../utils/dateUtils';
import {
  WeddingCustomer,
  WeddingAssociatedCustomer,
  CallLog,
  CUSTOMER_STATUSES,
  CALL_OUTCOMES,
  ARCHIVE_SUCCESS_MESSAGE,
  ARCHIVE_READONLY_MESSAGE,
  ARCHIVE_PROTECTED_MESSAGE,
  isCompletionStatus,
  getStatusBadge
} from './weddingTypes';
import {
  User, Heart, PhoneCall, MessageCircle, FileText, History, TrendingUp,
  ArrowLeft, Plus, X, CircleAlert, RefreshCw, Users, ExternalLink,
  Edit3, MapPin, Calendar, Clock, Save, Building2, Archive, RotateCcw,
  Check, Copy, Sparkles, CheckCircle2, ShoppingBag, Eye, Activity, MessageSquareQuote
} from 'lucide-react';
import { STORE_LOCATIONS_LIST } from '../../config/storeLocations';
import TellCallerModal from '../../components/wedding/TellCallerModal';
import { permissionsCache } from '../../context/PermissionsCache';

const SHOPPING_CATEGORIES = [
  'General Wedding Shopping',
  'Bridal Silk Sarees',
  'Groom Wear, Suits & Sherwanis',
  'Family Wedding Trousseau',
  'Festive & Party Wear',
  'Temple Jewellery & Accessories',
  'Home Furnishings & Linens'
];

const BUDGET_OPTIONS = [
  'Not Decided',
  'Under ₹25,000',
  '₹25,000 - ₹50,000',
  '₹50,000 - ₹1,00,000',
  '₹1,00,000 - ₹2,50,000',
  '₹2,50,000 - ₹5,00,000',
  '₹5,00,000+'
];

const LEAD_SOURCES = [
  'Wedding Registration',
  'In-store Walkin',
  'Phone Inquiry',
  'Website',
  'Social Media',
  'Referral / Word of Mouth',
  'Family Recommendation'
];

const CALL_TIMES = [
  'Any Time',
  'Morning (10 AM - 1 PM)',
  'Afternoon (1 PM - 4 PM)',
  'Evening (4 PM - 7 PM)',
  'After 7 PM'
];

export default function WeddingCustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(() => Auth.get());

  const isGlobalAdmin = useMemo(() => {
    const roleNorm = (session?.role || '').toLowerCase();
    return session?.isGlobalAdmin === true || (!session?.locationId && ['admin', 'super admin', 'system administrator'].includes(roleNorm));
  }, [session]);

  const allowedLocationIds = useMemo(() => {
    if (isGlobalAdmin) return [1, 2, 3];
    if (Array.isArray(session?.allowedLocations) && session.allowedLocations.length > 0) {
      return session.allowedLocations.map(Number);
    }
    return session?.locationId ? [Number(session.locationId)] : [1, 2, 3];
  }, [isGlobalAdmin, session]);
  const [customer, setCustomer] = useState<WeddingCustomer | null>(null);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [statusHistory, setStatusHistory] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [associatedRegistrations, setAssociatedRegistrations] = useState<any[]>([]);
  const [associatedCustomers, setAssociatedCustomers] = useState<WeddingAssociatedCustomer[]>([]);
  const [isOldCustomerProfile, setIsOldCustomerProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copiedMobile, setCopiedMobile] = useState(false);

  // Tell Caller & Instructions
  const [tellCallerOpen, setTellCallerOpen] = useState(false);
  const [canTellCaller, setCanTellCaller] = useState(() => {
    const role = (Auth.get()?.role || '').trim().toLowerCase();
    return ['admin', 'super admin', 'system administrator', 'manager', 'crm manager', 'store manager', 'floor manager', 'wedding collection manager', 'crm executive'].some(r => role.includes(r));
  });
  const [instructions, setInstructions] = useState<any[]>([]);
  const [instructionsLoading, setInstructionsLoading] = useState(false);

  // Active Profile Section Tab
  const [activeTab, setActiveTab] = useState<
    'overview' | 'calls' | 'visits' | 'notes' | 'timeline' | 'status_history' | 'associated_weddings' | 'caller_instructions'
  >('overview');

  // Edit Customer Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    customer_name: '',
    mobile_number: '',
    alternate_mobile: '',
    email: '',
    location_id: 1,
    lead_source: 'Wedding Registration',
    wedding_date: '',
    expected_shopping_date: '',
    preferred_shopping_category: 'General Wedding Shopping',
    budget: 'Not Decided',
    estimated_family_size: 1,
    bride_name: '',
    groom_name: '',
    wedding_city: '',
    preferred_call_time: 'Any Time',
    customer_notes: ''
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Reassign Telecaller Modal
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [telecallers, setTelecallers] = useState<any[]>([]);
  const [selectedTelecallerId, setSelectedTelecallerId] = useState('');
  const [savingReassign, setSavingReassign] = useState(false);

  // New Call Log Modal
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callForm, setCallForm] = useState({
    call_status: 'Completed',
    call_outcome: 'Connected',
    remarks: '',
    customer_response: '',
    next_follow_up_date: '',
    next_follow_up_time: 'Morning (10 AM - 1 PM)',
    expected_shopping_date: ''
  });
  const [savingCall, setSavingCall] = useState(false);

  // Status Change Modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);

  // New Note Modal
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Old Customer Lifecycle Actions
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [savingArchive, setSavingArchive] = useState(false);

  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [savingRestore, setSavingRestore] = useState(false);

  // Lock body scroll whenever ANY modal is open to eliminate background scrolling
  const anyModalOpen =
    editModalOpen || reassignModalOpen || callModalOpen || statusModalOpen || archiveModalOpen || restoreModalOpen;

  useEffect(() => {
    if (anyModalOpen) {
      lockBodyScroll();
    } else {
      unlockBodyScroll();
    }
    return () => {
      if (anyModalOpen) unlockBodyScroll();
    };
  }, [anyModalOpen]);

  // Escape key handler for all modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!savingEdit && !savingCall && !savingReassign && !savingStatus && !savingArchive && !savingRestore) {
          setEditModalOpen(false);
          setReassignModalOpen(false);
          setCallModalOpen(false);
          setStatusModalOpen(false);
          setArchiveModalOpen(false);
          setRestoreModalOpen(false);
        }
      }
    };
    if (anyModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [anyModalOpen, savingEdit, savingCall, savingReassign, savingStatus, savingArchive, savingRestore]);

  const loadCustomer = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [custRes, fullRes, instrRes] = await Promise.all([
        API.getWeddingCustomerById(id),
        API.getWeddingFullProfile(id).catch(() => null),
        API.getTelecallerInstructions({ customer_id: id, limit: 50 }).catch(() => null)
      ]);

      const loadedCustomer = custRes?.customer || custRes?.data || null;
      if (loadedCustomer) {
        setCustomer(loadedCustomer);
      }

      if (fullRes?.data) {
        if (Array.isArray(fullRes.data.callLogs)) setCallLogs(fullRes.data.callLogs);
        if (Array.isArray(fullRes.data.notes)) setNotes(fullRes.data.notes);
        if (Array.isArray(fullRes.data.statusHistory)) setStatusHistory(fullRes.data.statusHistory);
        if (Array.isArray(fullRes.data.visits)) setVisits(fullRes.data.visits);
        if (Array.isArray(fullRes.data.appointments)) setAppointments(fullRes.data.appointments);
        if (Array.isArray(fullRes.data.auditLogs)) setAuditLogs(fullRes.data.auditLogs);
        if (Array.isArray(fullRes.data.associatedRegistrations)) setAssociatedRegistrations(fullRes.data.associatedRegistrations);
        if (Array.isArray(fullRes.data.associatedCustomers)) setAssociatedCustomers(fullRes.data.associatedCustomers);
        setIsOldCustomerProfile(
          Boolean(fullRes.is_old_customer ?? fullRes.data.is_old_customer) ||
          loadedCustomer?.lifecycle_status === 'OLD_CUSTOMER'
        );
      } else if (custRes?.call_logs) {
        setCallLogs(custRes.call_logs);
        setIsOldCustomerProfile(loadedCustomer?.lifecycle_status === 'OLD_CUSTOMER');
      }

      const instrList = instrRes?.instructions || instrRes?.data?.instructions || (fullRes?.data as any)?.instructions || (fullRes as any)?.instructions || [];
      if (Array.isArray(instrList)) {
        setInstructions(instrList);
      }
    } catch (err: any) {
      showToast('Error loading customer details: ' + (err.message || 'Unable to load data'), 'error');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadInstructions = useCallback(async (customerId: number | string) => {
    try {
      setInstructionsLoading(true);
      const res = await API.getTelecallerInstructions({ customer_id: customerId, limit: 50 });
      const list = res?.instructions || res?.data?.instructions || [];
      if (Array.isArray(list)) {
        setInstructions(list);
      }
    } catch (err) {
      console.warn('[WeddingCustomerDetail] Could not load instructions:', err);
    } finally {
      setInstructionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    setSession(Auth.get());
    loadCustomer();
  }, [loadCustomer, navigate]);

  // Robust permission gate: Managerial roles allow Tell Caller directly
  useEffect(() => {
    let active = true;
    const role = (Auth.get()?.role || session?.role || '').trim().toLowerCase();
    const isManagerial = ['admin', 'super admin', 'system administrator', 'manager', 'crm manager', 'store manager', 'floor manager', 'wedding collection manager', 'crm executive'].some(r => role.includes(r));
    if (isManagerial) {
      setCanTellCaller(true);
    } else {
      permissionsCache.get().then(() => {
        if (!active) return;
        const currentRole = Auth.get()?.role || session?.role;
        setCanTellCaller(
          permissionsCache.canAction('wedding_tell_caller', 'can_add', currentRole) ||
          permissionsCache.canAction('wedding_crm', 'can_edit', currentRole) ||
          permissionsCache.canAction('wedding_crm', 'can_add', currentRole)
        );
      });
    }
    return () => { active = false; };
  }, [session?.role]);

  const handleCopyMobile = () => {
    if (!customer?.mobile_number) return;
    navigator.clipboard.writeText(customer.mobile_number);
    setCopiedMobile(true);
    showToast('Mobile number copied to clipboard', 'info');
    setTimeout(() => setCopiedMobile(false), 2000);
  };

  const handleOpenEdit = () => {
    if (!customer) return;
    setEditForm({
      customer_name: customer.customer_name || '',
      mobile_number: customer.mobile_number ? customer.mobile_number.replace(/\D/g, '').slice(-10) : '',
      alternate_mobile: (customer as any).alternate_mobile ? (customer as any).alternate_mobile.replace(/\D/g, '').slice(-10) : '',
      email: customer.email || '',
      location_id: Number(customer.location_id) || 1,
      lead_source: customer.lead_source || 'Wedding Registration',
      wedding_date: customer.wedding_date ? String(customer.wedding_date).split('T')[0] : '',
      expected_shopping_date: customer.expected_shopping_date ? String(customer.expected_shopping_date).split('T')[0] : '',
      preferred_shopping_category: customer.preferred_shopping_category || 'General Wedding Shopping',
      budget: customer.budget || (customer as any).budget_range || 'Not Decided',
      estimated_family_size: Number(customer.estimated_family_size) || 1,
      bride_name: (customer as any).bride_name || '',
      groom_name: (customer as any).groom_name || '',
      wedding_city: (customer as any).wedding_city || '',
      preferred_call_time: customer.preferred_call_time || 'Any Time',
      customer_notes: (customer as any).customer_notes || (customer as any).initial_notes || ''
    });
    setEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    if (!editForm.customer_name.trim()) {
      showToast('Customer name is required', 'error');
      return;
    }
    const cleanMobile = editForm.mobile_number.replace(/\D/g, '');
    if (!cleanMobile || cleanMobile.length !== 10) {
      showToast('Please enter a valid 10-digit mobile number', 'error');
      return;
    }
    if (editForm.alternate_mobile) {
      const cleanAlt = editForm.alternate_mobile.replace(/\D/g, '');
      if (cleanAlt.length !== 10) {
        showToast('Alternate mobile must be a valid 10-digit number', 'error');
        return;
      }
    }
    if (editForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email.trim())) {
      showToast('Please enter a valid email address', 'error');
      return;
    }

    setSavingEdit(true);
    try {
      const payload: any = {
        customer_name: editForm.customer_name.trim(),
        mobile_number: `+91${cleanMobile}`,
        alternate_mobile: editForm.alternate_mobile ? `+91${editForm.alternate_mobile.replace(/\D/g, '').slice(-10)}` : null,
        email: editForm.email.trim() || null,
        location_id: Number(editForm.location_id) || 1,
        lead_source: editForm.lead_source,
        wedding_date: editForm.wedding_date || null,
        expected_shopping_date: editForm.expected_shopping_date || null,
        preferred_shopping_category: editForm.preferred_shopping_category,
        budget: editForm.budget,
        budget_range: editForm.budget,
        estimated_family_size: Number(editForm.estimated_family_size) || 1,
        bride_name: editForm.bride_name.trim() || null,
        groom_name: editForm.groom_name.trim() || null,
        wedding_city: editForm.wedding_city.trim() || null,
        preferred_call_time: editForm.preferred_call_time,
        customer_notes: editForm.customer_notes.trim() || null
      };

      let res: any;
      try {
        res = await API.updateWeddingCustomer(customer.id, payload);
      } catch (err: any) {
        if (err?.status === 403 || err?.message?.toLowerCase().includes('telecaller')) {
          res = await API.updateWeddingCustomerByTelecaller(customer.id, payload);
        } else {
          throw err;
        }
      }

      if (res?.success === false) {
        showToast(res.message || 'Failed to update customer', 'error');
        return;
      }
      showToast('Customer profile updated successfully.', 'success');
      setEditModalOpen(false);
      await loadCustomer();
    } catch (err: any) {
      console.error('[handleSaveEdit Error]', err);
      showToast(err.message || 'Unable to update customer profile. Please try again.', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleOpenReassign = async () => {
    try {
      const res = await API.getWeddingTelecallers(customer?.location_id || session?.locationId || undefined);
      const list = res.telecallers || res.data || [];
      setTelecallers(list);
      if (customer?.assigned_telecaller_id) {
        setSelectedTelecallerId(String(customer.assigned_telecaller_id));
      } else {
        const match = list.find((t: any) => t.full_name === customer?.assigned_telecaller);
        if (match) setSelectedTelecallerId(String(match.id));
      }
      setReassignModalOpen(true);
    } catch (err: any) {
      showToast('Failed to load telecallers list: ' + err.message, 'error');
    }
  };

  const handleSaveReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer || !selectedTelecallerId) return;
    setSavingReassign(true);
    try {
      const callerObj = telecallers.find((t: any) => String(t.id) === String(selectedTelecallerId));
      const callerName = callerObj ? (callerObj.full_name || callerObj.username) : 'Assigned Staff';
      await API.assignWeddingTelecaller(customer.id, selectedTelecallerId, callerName);
      showToast('Telecaller reassigned successfully.', 'success');
      setReassignModalOpen(false);
      await loadCustomer();
    } catch (err: any) {
      showToast('Error reassigning telecaller: ' + err.message, 'error');
    } finally {
      setSavingReassign(false);
    }
  };

  const handleSaveCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    setSavingCall(true);
    try {
      await API.logWeddingCall({
        customer_id: customer.id,
        call_date: new Date().toISOString().slice(0, 10),
        call_time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        call_status: callForm.call_status,
        call_outcome: callForm.call_outcome,
        remarks: callForm.remarks,
        customer_response: callForm.customer_response,
        next_follow_up_date: callForm.next_follow_up_date || undefined,
        next_follow_up_time: callForm.next_follow_up_time || undefined,
        expected_shopping_date_updated: callForm.expected_shopping_date || undefined
      });

      showToast('Call activity saved successfully.', 'success');
      setCallModalOpen(false);
      await loadCustomer();
    } catch (err: any) {
      showToast('Error logging call: ' + err.message, 'error');
    } finally {
      setSavingCall(false);
    }
  };

  const handleSaveStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer || !newStatus) return;
    setSavingStatus(true);
    try {
      const res: any = await API.changeWeddingCustomerStatus(customer.id, newStatus, statusReason);
      if (res?.success === false) {
        showToast(res.message || 'Failed to update customer status', 'error');
        return;
      }
      if (res?.archived || res?.lifecycle_status === 'OLD_CUSTOMER') {
        showToast(ARCHIVE_SUCCESS_MESSAGE, 'success');
        setStatusModalOpen(false);
        setStatusReason('');
        await loadCustomer();
        return;
      }
      showToast('Customer status updated successfully.', 'success');
      setStatusModalOpen(false);
      await loadCustomer();
    } catch (err: any) {
      if (err?.status === 409 || err?.data?.code === 'OLD_CUSTOMER_READONLY') {
        showToast(err.message || ARCHIVE_READONLY_MESSAGE, 'error');
      } else {
        showToast(err.message || 'Error updating customer status', 'error');
      }
    } finally {
      setSavingStatus(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer || !noteText.trim()) return;
    setSavingNote(true);
    try {
      await API.createWeddingNote(customer.id, { note: noteText.trim() });
      showToast('Customer note added successfully.', 'success');
      setNoteText('');
      await loadCustomer();
    } catch (err: any) {
      showToast('Error adding note: ' + err.message, 'error');
    } finally {
      setSavingNote(false);
    }
  };

  const handleMoveToOld = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    setSavingArchive(true);
    try {
      const res: any = await API.moveWeddingCustomerToOld(customer.id, archiveReason.trim() || undefined);
      if (res?.success === false) {
        showToast(res.message || 'Failed to move customer to Old Customers', 'error');
        return;
      }
      showToast('Customer moved to Old Customers successfully.', 'success');
      setArchiveModalOpen(false);
      setArchiveReason('');
      await loadCustomer();
    } catch (err: any) {
      showToast(err.message || 'Error moving customer to Old Customers', 'error');
    } finally {
      setSavingArchive(false);
    }
  };

  const handleRestore = async () => {
    if (!customer) return;
    setSavingRestore(true);
    try {
      const res: any = await API.restoreWeddingOldCustomer(customer.id);
      if (res?.success === false) {
        showToast(res.message || 'Failed to restore customer', 'error');
        return;
      }
      showToast('Customer restored to active customer list successfully.', 'success');
      setRestoreModalOpen(false);
      await loadCustomer();
    } catch (err: any) {
      showToast(err.message || 'Error restoring customer', 'error');
    } finally {
      setSavingRestore(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Customer Profile">
        <PageContainer maxWidth="full">
          <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-[#B76E79]" />
            <div className="text-sm font-semibold text-[#4A173A]">Loading customer details...</div>
          </div>
        </PageContainer>
      </DashboardLayout>
    );
  }

  if (!customer) {
    return (
      <DashboardLayout title="Customer Not Found">
        <PageContainer maxWidth="full">
          <div className="min-h-[60vh] flex items-center justify-center p-4">
            <div className="bg-[#FFFDFC] p-8 rounded-3xl border border-[#E8D9D4] text-center max-w-md space-y-4 shadow-sm">
              <CircleAlert className="w-12 h-12 text-[#B42318] mx-auto" />
              <h2 className="text-lg font-bold text-[#4A173A]">Customer Not Found</h2>
              <p className="text-xs text-[#6F5963]">
                The requested customer profile does not exist or you do not have permission to view it.
              </p>
              <Link
                to="/wedding-crm/customers"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#4A173A] text-white hover:bg-[#6A2853] font-semibold rounded-xl text-xs shadow-xs transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Return to Customer Register
              </Link>
            </div>
          </div>
        </PageContainer>
      </DashboardLayout>
    );
  }

  const badge = getStatusBadge(customer.customer_status);
  const isArchived = customer.lifecycle_status === 'OLD_CUSTOMER' || isOldCustomerProfile;
  const previousJourneys = associatedCustomers.filter((c: any) => c && String(c.id) !== String(customer.id));

  return (
    <DashboardLayout
      title={`Customer Profile: ${customer.customer_name}`}
      hideTopbar={true}
      breadcrumbs={[
        {
          label: isArchived ? 'Old Customers' : 'Customer Register',
          href: isArchived ? '/wedding-crm/old-customers' : '/wedding-crm/customers'
        },
        { label: `${customer.customer_name} (${customer.customer_code})` }
      ]}
    >
      <div className="w-full space-y-5">
        <ToastContainer />

        {/* ── Sub-Navigation Strip (Dashboard, Customers, Calling Desk, Calendar, etc.) ── */}
        <WeddingNav hideTitleCard={true} />

        {/* ── Old Customer Alert Banner (if archived) ── */}
        {isArchived && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-amber-900 shadow-xs animate-fade-in">
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 text-amber-800 font-bold border border-amber-300">
                <Archive className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-2">
                  <span>Historical Old Customer Record</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/80 text-amber-900 border border-amber-300">
                    OLD CUSTOMER
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-amber-800">
                  <span>
                    Completed Date:{' '}
                    <strong className="font-semibold text-amber-900">
                      {formatDateTimeDisplay((customer as any).archived_at, 'N/A')}
                    </strong>
                  </span>
                  <span>
                    Completed By:{' '}
                    <strong className="font-semibold text-amber-900">
                      {(customer as any).archived_by || 'N/A'}
                    </strong>
                  </span>
                  {(customer as any).previous_status && (
                    <span>
                      Status Before Completion:{' '}
                      <strong className="font-semibold text-amber-900">{(customer as any).previous_status}</strong>
                    </span>
                  )}
                  {(customer as any).archive_reason && (
                    <span>
                      Reason: <em>&ldquo;{(customer as any).archive_reason}&rdquo;</em>
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-amber-700">
                  All call records, shopping requirements, and interaction history remain permanently intact. {ARCHIVE_PROTECTED_MESSAGE}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRestoreModalOpen(true)}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all shrink-0 cursor-pointer active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore Customer</span>
            </button>
          </div>
        )}

        {/* ── UNIFIED CUSTOMER PROFILE HEADER & COMMAND CENTER ── */}
        <div className="bg-[#FFFDFC] rounded-3xl border border-[#E8D9D4] shadow-xs p-5 sm:p-6 lg:p-7 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            {/* Left: Avatar, Name, Status, and Key Meta */}
            <div className="flex items-start sm:items-center gap-4 min-w-0">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#4A173A] text-white font-extrabold text-xl sm:text-2xl flex items-center justify-center border-2 border-[#B76E79]/40 shadow-md shrink-0 select-none">
                {customer.customer_name ? customer.customer_name.slice(0, 2).toUpperCase() : 'CU'}
              </div>
              <div className="min-w-0 space-y-1.5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-[#4A173A] tracking-tight truncate">
                    {customer.customer_name}
                  </h1>
                  <span className={`px-3 py-0.5 rounded-full text-xs font-bold border shadow-2xs ${badge.bg}`}>
                    {customer.customer_status}
                  </span>
                  {isArchived && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                      OLD CUSTOMER
                    </span>
                  )}
                </div>

                {/* Metadata Row */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#6F5963] font-medium pt-0.5">
                  <span className="flex items-center gap-1.5">
                    <span className="text-[#9A858D] font-normal">Customer ID:</span>
                    <strong className="text-[#4A173A] font-bold font-mono">{customer.customer_code}</strong>
                  </span>
                  <span className="hidden sm:inline text-[#E8D9D4]">•</span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#B76E79] shrink-0" />
                    <strong className="text-[#2B1722]">{customer.location_name || 'Store Showroom'}</strong>
                  </span>
                  <span className="hidden sm:inline text-[#E8D9D4]">•</span>
                  <span className="flex items-center gap-1.5">
                    <PhoneCall className="w-3.5 h-3.5 text-[#198754] shrink-0" />
                    <a
                      href={`tel:${customer.mobile_number}`}
                      className="text-[#2B1722] font-semibold hover:text-[#4A173A] transition-colors"
                      title="Click to dial"
                    >
                      {customer.mobile_number}
                    </a>
                    <button
                      type="button"
                      onClick={handleCopyMobile}
                      className="p-1 text-[#6F5963] hover:text-[#4A173A] rounded transition-colors"
                      title="Copy mobile number"
                    >
                      {copiedMobile ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </span>
                  <span className="hidden sm:inline text-[#E8D9D4]">•</span>
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#B76E79] shrink-0" />
                    <span>Assigned: <strong className="text-[#4A173A]">{customer.assigned_telecaller || 'Unassigned'}</strong></span>
                  </span>
                  <span className="hidden sm:inline text-[#E8D9D4]">•</span>
                  <span className="flex items-center gap-1.5 text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-[#9A858D] shrink-0" />
                    <span>Updated: <strong className="text-[#4A173A]">{formatDateTimeDisplay(customer.updated_at || customer.created_at, 'N/A')}</strong></span>
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Wedding Countdown Pill (if date present) */}
            {parseDate(customer.wedding_date) && (
              <div className="bg-[#F6E2E5]/80 border border-[#E8D9D4] rounded-2xl p-3 sm:px-4 flex items-center gap-3 text-[#4A173A] shrink-0 self-start lg:self-auto shadow-2xs">
                <Heart className="w-6 h-6 text-[#B76E79] shrink-0" />
                <div>
                  <div className="text-[10px] font-bold uppercase text-[#6F5963] tracking-wider">Wedding Date</div>
                  <div className="text-sm font-bold text-[#4A173A]">{formatDateDisplay(customer.wedding_date, 'TBD')}</div>
                </div>
                {(() => {
                  const weddingDay = parseDate(customer.wedding_date);
                  if (!weddingDay) return null;
                  const diffDays = Math.ceil((weddingDay.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  return diffDays > 0 ? (
                    <div className="ml-2 pl-3 border-l border-[#E8D9D4] text-right">
                      <div className="text-base font-black text-[#B76E79]">{diffDays}</div>
                      <div className="text-[9px] uppercase font-bold text-[#6F5963]">Days Left</div>
                    </div>
                  ) : diffDays === 0 ? (
                    <div className="ml-2 pl-3 border-l border-[#E8D9D4] text-right">
                      <span className="text-xs font-bold text-[#198754]">Today!</span>
                    </div>
                  ) : null;
                })()}
              </div>
            )}
          </div>

          {/* Action Toolbar Row: Back, Edit Customer, Log Call, WhatsApp, Reassign, Update Status, Archive/Restore */}
          <div className="pt-4 border-t border-[#E8D9D4] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link
                to={isArchived ? '/wedding-crm/old-customers' : '/wedding-crm/customers'}
                className="px-3.5 py-2 bg-[#FFFDFC] hover:bg-[#FFF7F2] border border-[#E8D9D4] rounded-xl text-xs font-semibold text-[#4A173A] flex items-center gap-1.5 transition-colors shadow-2xs"
                title="Return to customer register"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </Link>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Edit Customer */}
              <button
                type="button"
                onClick={handleOpenEdit}
                className="px-4 py-2 bg-[#B76E79] hover:bg-[#A85F6A] text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer active:scale-95"
              >
                <Edit3 className="w-3.5 h-3.5 text-white" />
                <span>Edit Customer</span>
              </button>

              {/* Log Call */}
              <button
                type="button"
                onClick={() => {
                  setCallForm({
                    call_status: 'Completed',
                    call_outcome: 'Connected',
                    remarks: '',
                    customer_response: '',
                    next_follow_up_date: customer.follow_up_date || '',
                    next_follow_up_time: customer.preferred_call_time || 'Morning (10 AM - 1 PM)',
                    expected_shopping_date: customer.expected_shopping_date || ''
                  });
                  setCallModalOpen(true);
                }}
                className="px-4 py-2 bg-[#4A173A] hover:bg-[#6A2853] text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition-all border border-[#B76E79]/30 active:scale-95 cursor-pointer"
              >
                <PhoneCall className="w-3.5 h-3.5 text-[#E8C7A8]" />
                <span>Log Call</span>
              </button>

              {/* WhatsApp */}
              <a
                href={`https://wa.me/91${customer.mobile_number.replace(/\D/g, '')}?text=Namaste%20${encodeURIComponent(customer.customer_name)}%2C%20greetings%20from%20BSC%20Exclusive%20Textiles!`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-[#198754] hover:bg-[#16805B] text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition-all active:scale-95"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </a>

              {/* Reassign Telecaller */}
              <button
                type="button"
                onClick={handleOpenReassign}
                className="px-3.5 py-2 bg-[#FFFDFC] hover:bg-[#FFF7F2] text-[#4A173A] border border-[#E8D9D4] font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer"
              >
                <Users className="w-3.5 h-3.5 text-[#B76E79]" />
                <span>Reassign Telecaller</span>
              </button>

              {/* Tell Caller — instruction to the telecaller, assignment unchanged */}
              {canTellCaller && !isArchived && (
                <button
                  type="button"
                  onClick={() => setTellCallerOpen(true)}
                  className="px-3.5 py-2 bg-[#FFFDFC] hover:bg-[#FDF4F6] text-[#4A173A] hover:text-[#6A2853] border border-[#E8D9D4] hover:border-[#B76E79] font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer"
                  title="Send an instruction to a telecaller about this customer"
                >
                  <MessageSquareQuote className="w-3.5 h-3.5 text-[#B76E79]" />
                  <span>Tell Caller</span>
                  {instructions.length > 0 && (
                    <span className="ml-0.5 px-1.5 py-0.2 bg-[#F6E2E5] text-[#6A2853] text-[10px] font-bold rounded-full">
                      {instructions.length}
                    </span>
                  )}
                </button>
              )}

              {/* Update Status */}
              <button
                type="button"
                onClick={() => {
                  setNewStatus(customer.customer_status);
                  setStatusReason('');
                  setStatusModalOpen(true);
                }}
                className="px-3.5 py-2 bg-[#FFFDFC] hover:bg-[#FFF7F2] text-[#4A173A] border border-[#E8D9D4] font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer"
              >
                <TrendingUp className="w-3.5 h-3.5 text-[#B76E79]" />
                <span>Update Status</span>
              </button>

              {/* Move to Old Customers / Restore */}
              {isArchived ? (
                <button
                  type="button"
                  onClick={() => setRestoreModalOpen(true)}
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer active:scale-95"
                  title="Restore customer to active customer register"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore Customer</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setArchiveReason('');
                    setArchiveModalOpen(true);
                  }}
                  className="px-3.5 py-2 bg-[#5F4B55] hover:bg-[#483740] text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer active:scale-95"
                  title="Move customer to Old Customers"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Move to Old Customers</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── PROFILE TABS BAR ── */}
        <div className="flex items-center gap-2 border-b border-[#E8D9D4] pb-2 text-xs font-semibold overflow-x-auto custom-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-[#B76E79] text-white shadow-xs font-bold'
                : 'bg-[#FFFDFC] text-[#6F5963] hover:text-[#4A173A] border border-[#E8D9D4]'
            }`}
          >
            Overview & Requirements
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('calls')}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'calls'
                ? 'bg-[#B76E79] text-white shadow-xs font-bold'
                : 'bg-[#FFFDFC] text-[#6F5963] hover:text-[#4A173A] border border-[#E8D9D4]'
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Call History ({callLogs.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('visits')}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'visits'
                ? 'bg-[#B76E79] text-white shadow-xs font-bold'
                : 'bg-[#FFFDFC] text-[#6F5963] hover:text-[#4A173A] border border-[#E8D9D4]'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Visits & Appointments ({visits.length + appointments.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('notes')}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'notes'
                ? 'bg-[#B76E79] text-white shadow-xs font-bold'
                : 'bg-[#FFFDFC] text-[#6F5963] hover:text-[#4A173A] border border-[#E8D9D4]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Notes & Preferences ({notes.length + (customer.customer_notes ? 1 : 0)})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'timeline'
                ? 'bg-[#B76E79] text-white shadow-xs font-bold'
                : 'bg-[#FFFDFC] text-[#6F5963] hover:text-[#4A173A] border border-[#E8D9D4]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Activity Timeline ({auditLogs.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('status_history')}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'status_history'
                ? 'bg-[#B76E79] text-white shadow-xs font-bold'
                : 'bg-[#FFFDFC] text-[#6F5963] hover:text-[#4A173A] border border-[#E8D9D4]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Status Audit History ({statusHistory.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('associated_weddings')}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'associated_weddings'
                ? 'bg-[#B76E79] text-white shadow-xs font-bold'
                : 'bg-[#FFFDFC] text-[#6F5963] hover:text-[#4A173A] border border-[#E8D9D4]'
            }`}
          >
            <Heart className="w-3.5 h-3.5" />
            <span>All Registrations ({associatedRegistrations.length + associatedCustomers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('caller_instructions')}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'caller_instructions'
                ? 'bg-[#B76E79] text-white shadow-xs font-bold'
                : 'bg-[#FFFDFC] text-[#6F5963] hover:text-[#4A173A] border border-[#E8D9D4]'
            }`}
          >
            <MessageSquareQuote className="w-3.5 h-3.5" />
            <span>Tell Caller / Instructions ({instructions.length})</span>
          </button>
        </div>

        {/* ── TAB 1: OVERVIEW & REQUIREMENTS ── */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
            {/* Section 1: Customer Details */}
            <div className="bg-[#FFFDFC] p-5 sm:p-6 rounded-3xl border border-[#E8D9D4] shadow-xs space-y-4 text-xs">
              <div className="flex items-center justify-between font-bold text-sm text-[#4A173A] border-b border-[#E8D9D4] pb-2.5">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-[#B76E79]" />
                  <span>Customer Details</span>
                </div>
                <button
                  type="button"
                  onClick={handleOpenEdit}
                  className="text-xs text-[#B76E79] hover:text-[#4A173A] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              </div>
              <div className="space-y-2.5">
                <div className="flex justify-between items-center py-1 border-b border-[#E8D9D4]/40">
                  <span className="text-[#6F5963]">Full Name:</span>
                  <strong className="text-[#2B1722] text-right font-bold">{customer.customer_name}</strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[#E8D9D4]/40">
                  <span className="text-[#6F5963]">Mobile Number:</span>
                  <strong className="text-[#2B1722] font-mono">{customer.mobile_number}</strong>
                </div>
                {(customer as any).alternate_mobile && (
                  <div className="flex justify-between items-center py-1 border-b border-[#E8D9D4]/40">
                    <span className="text-[#6F5963]">Alternate Mobile:</span>
                    <strong className="text-[#2B1722] font-mono">{(customer as any).alternate_mobile}</strong>
                  </div>
                )}
                {customer.email && (
                  <div className="flex justify-between items-center py-1 border-b border-[#E8D9D4]/40">
                    <span className="text-[#6F5963]">Email Address:</span>
                    <span className="text-[#2B1722] font-medium text-right break-all">{customer.email}</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-1 border-b border-[#E8D9D4]/40">
                  <span className="text-[#6F5963]">Store Showroom:</span>
                  <span className="text-[#4A173A] font-semibold">{customer.location_name || 'Store'}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[#E8D9D4]/40">
                  <span className="text-[#6F5963]">Lead Source:</span>
                  <span className="text-[#2B1722] font-medium">{customer.lead_source || 'In-store Walkin'}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-[#6F5963]">Registration Date:</span>
                  <span className="text-[#2B1722] font-medium">
                    {formatDateDisplay(customer.created_at, 'N/A')}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 2: Wedding & Shopping Information */}
            <div className="bg-[#FFFDFC] p-5 sm:p-6 rounded-3xl border border-[#E8D9D4] shadow-xs space-y-4 text-xs">
              <div className="flex items-center justify-between font-bold text-sm text-[#4A173A] border-b border-[#E8D9D4] pb-2.5">
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-[#B76E79]" />
                  <span>Wedding & Shopping Details</span>
                </div>
                <button
                  type="button"
                  onClick={handleOpenEdit}
                  className="text-xs text-[#B76E79] hover:text-[#4A173A] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              </div>
              <div className="space-y-2.5">
                {parseDate(customer.wedding_date) && (
                  <div className="flex justify-between items-center py-1 border-b border-[#E8D9D4]/40">
                    <span className="text-[#6F5963]">Wedding Date:</span>
                    <strong className="text-[#B76E79] font-bold">
                      {formatDateDisplay(customer.wedding_date, 'TBD')}
                    </strong>
                  </div>
                )}
                <div className="flex justify-between items-center py-1 border-b border-[#E8D9D4]/40">
                  <span className="text-[#6F5963]">Expected Shopping:</span>
                  <strong className="text-[#4A173A] font-bold">
                    {formatDateDisplay(customer.expected_shopping_date, 'Not scheduled')}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[#E8D9D4]/40">
                  <span className="text-[#6F5963]">Shopping Category:</span>
                  <strong className="text-[#2B1722] text-right font-medium">{customer.preferred_shopping_category || 'General Wedding Shopping'}</strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[#E8D9D4]/40">
                  <span className="text-[#6F5963]">Budget Range:</span>
                  <strong className="text-[#198754] font-semibold">{customer.budget || (customer as any).budget_range || 'Not Decided'}</strong>
                </div>
                {customer.estimated_family_size ? (
                  <div className="flex justify-between items-center py-1 border-b border-[#E8D9D4]/40">
                    <span className="text-[#6F5963]">Estimated Family Size:</span>
                    <strong className="text-[#2B1722]">{customer.estimated_family_size} members</strong>
                  </div>
                ) : null}
                {(customer as any).bride_name && (
                  <div className="flex justify-between items-center py-1 border-b border-[#E8D9D4]/40">
                    <span className="text-[#6F5963]">Bride Name:</span>
                    <strong className="text-[#2B1722]">{(customer as any).bride_name}</strong>
                  </div>
                )}
                {(customer as any).groom_name && (
                  <div className="flex justify-between items-center py-1 border-b border-[#E8D9D4]/40">
                    <span className="text-[#6F5963]">Groom Name:</span>
                    <strong className="text-[#2B1722]">{(customer as any).groom_name}</strong>
                  </div>
                )}
                {(customer as any).wedding_city && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-[#6F5963]">Wedding City / Venue:</span>
                    <strong className="text-[#2B1722] text-right">{(customer as any).wedding_city}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Section 3: Follow-up & Telecaller Desk */}
            <div className="bg-[#FFFDFC] p-5 sm:p-6 rounded-3xl border border-[#E8D9D4] shadow-xs space-y-4 text-xs">
              <div className="flex items-center justify-between font-bold text-sm text-[#4A173A] border-b border-[#E8D9D4] pb-2.5">
                <div className="flex items-center gap-2">
                  <PhoneCall className="w-4 h-4 text-[#B76E79]" />
                  <span>Follow-up & Telecaller Desk</span>
                </div>
                {canTellCaller && !isArchived && (
                  <button
                    type="button"
                    onClick={() => setTellCallerOpen(true)}
                    className="px-2.5 py-1 bg-[#FDF4F6] hover:bg-[#F6E2E5] text-[#6A2853] border border-[#B76E79]/30 font-semibold rounded-lg text-[11px] flex items-center gap-1 shadow-2xs transition-all active:scale-95 cursor-pointer"
                    title="Send instruction to telecaller"
                  >
                    <MessageSquareQuote className="w-3 h-3 text-[#B76E79]" />
                    <span>Tell Caller</span>
                  </button>
                )}
              </div>
              <div className="space-y-2.5">
                <div className="flex justify-between items-center py-1 border-b border-[#E8D9D4]/40">
                  <span className="text-[#6F5963]">Assigned Telecaller:</span>
                  <strong className="text-[#4A173A] font-bold">{customer.assigned_telecaller || 'Unassigned'}</strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[#E8D9D4]/40">
                  <span className="text-[#6F5963]">Next Follow-up Date:</span>
                  <strong className="text-[#C58A18] font-bold">
                    {formatDateDisplay(customer.follow_up_date, 'None scheduled')}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[#E8D9D4]/40">
                  <span className="text-[#6F5963]">Preferred Call Time:</span>
                  <span className="text-[#2B1722] font-medium">{customer.preferred_call_time || 'Any Time'}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[#E8D9D4]/40">
                  <span className="text-[#6F5963]">Call Status:</span>
                  <span className="text-[#2B1722] font-semibold">{customer.call_status || 'Pending'}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[#E8D9D4]/40">
                  <span className="text-[#6F5963]">Total Calls Logged:</span>
                  <strong className="text-[#4A173A] font-bold">{customer.total_calls_count || callLogs.length}</strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[#E8D9D4]/40">
                  <span className="text-[#6F5963]">Last Call Date:</span>
                  <strong className="text-[#4A173A]">{formatDateDisplay(customer.last_call_date, 'No calls yet')}</strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[#E8D9D4]/40">
                  <span className="text-[#6F5963]">Last Call Outcome:</span>
                  <strong className="text-[#4A173A]">{customer.last_call_outcome || 'Pending First Call'}</strong>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-[#6F5963]">Last Updated:</span>
                  <strong className="text-[#4A173A]">{formatDateTimeDisplay(customer.updated_at, '—')}</strong>
                </div>

                {/* Telecaller Instructions Summary Box */}
                <div className="mt-3 pt-3 border-t border-[#E8D9D4] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-bold text-[#4A173A]">
                      <MessageSquareQuote className="w-3.5 h-3.5 text-[#B76E79]" />
                      <span>Caller Instructions</span>
                      {instructions.length > 0 && (
                        <span className="px-1.5 py-0.2 bg-[#F6E2E5] text-[#6A2853] text-[10px] rounded-full font-bold">
                          {instructions.length}
                        </span>
                      )}
                    </span>
                    {canTellCaller && !isArchived && (
                      <button
                        type="button"
                        onClick={() => setTellCallerOpen(true)}
                        className="text-[11px] font-bold text-[#B76E79] hover:text-[#4A173A] flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Tell Caller</span>
                      </button>
                    )}
                  </div>

                  {instructions.length > 0 ? (
                    <div className="bg-[#FAF7F5] rounded-xl p-2.5 border border-[#E8D9D4]/60 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-[#4A173A] truncate max-w-[140px]">
                          To: {instructions[0].telecaller_name || instructions[0].telecallerName || 'Assigned Caller'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          instructions[0].status === 'Completed'
                            ? 'bg-[#E8F5EE] text-[#198754] border-[#198754]/30'
                            : instructions[0].status === 'Acknowledged'
                            ? 'bg-[#FFF4D6] text-[#8A6212] border-[#C58A18]/30'
                            : instructions[0].status === 'Seen'
                            ? 'bg-[#EAF1FA] text-[#356AE6] border-[#356AE6]/30'
                            : 'bg-[#F6E2E5] text-[#6A2853] border-[#B76E79]/30'
                        }`}>
                          {instructions[0].status || 'New'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#4A173A] line-clamp-2 italic">
                        "{instructions[0].message}"
                      </p>
                      <div className="flex items-center justify-between pt-1 text-[10px] text-[#6F5963]">
                        <span>{formatDateTimeDisplay(instructions[0].created_at || instructions[0].createdAt, 'Recent')}</span>
                        <button
                          type="button"
                          onClick={() => setActiveTab('caller_instructions')}
                          className="text-[#B76E79] hover:underline font-semibold"
                        >
                          View all ({instructions.length}) →
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#FAF7F5] rounded-xl p-2.5 border border-[#E8D9D4]/60 text-center">
                      <p className="text-[11px] text-[#6F5963]">No instructions given to telecaller yet.</p>
                      {canTellCaller && !isArchived && (
                        <button
                          type="button"
                          onClick={() => setTellCallerOpen(true)}
                          className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#B76E79] hover:text-[#4A173A]"
                        >
                          <Plus className="w-3 h-3" /> Send first instruction
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section 4: Archive & Lifecycle Information (if applicable) */}
            {(isArchived || (customer as any).archived_at) && (
              <div className="bg-[#FFFDFC] p-5 sm:p-6 rounded-3xl border border-amber-200 bg-amber-50/20 shadow-xs space-y-3 text-xs md:col-span-2 lg:col-span-3">
                <div className="flex items-center justify-between font-bold text-sm text-[#4A173A] border-b border-[#E8D9D4] pb-2.5">
                  <div className="flex items-center gap-2">
                    <Archive className="w-4 h-4 text-amber-700" />
                    <span>Archive & Lifecycle History</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    {customer.lifecycle_status || 'OLD_CUSTOMER'}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                  <div className="space-y-1">
                    <div className="text-[11px] font-medium text-[#6F5963]">Lifecycle Status</div>
                    <div className="font-bold text-amber-800 text-sm">{customer.lifecycle_status || 'OLD_CUSTOMER'}</div>
                  </div>
                  {(customer as any).previous_status && (
                    <div className="space-y-1">
                      <div className="text-[11px] font-medium text-[#6F5963]">Previous CRM Status</div>
                      <div className="font-bold text-[#4A173A] text-sm">{(customer as any).previous_status}</div>
                    </div>
                  )}
                  <div className="space-y-1">
                    <div className="text-[11px] font-medium text-[#6F5963]">Archived On</div>
                    <div className="font-semibold text-[#2B1722] text-sm">
                      {formatDateTimeDisplay((customer as any).archived_at, 'N/A')}
                    </div>
                  </div>
                  {(customer as any).archived_by && (
                    <div className="space-y-1">
                      <div className="text-[11px] font-medium text-[#6F5963]">Archived By Staff</div>
                      <div className="font-semibold text-[#2B1722] text-sm">{(customer as any).archived_by}</div>
                    </div>
                  )}
                </div>
                {(customer as any).archive_reason && (
                  <div className="pt-2 border-t border-amber-200 mt-2">
                    <div className="text-[11px] font-semibold text-[#6F5963] mb-1">Archive Reason / Note:</div>
                    <p className="italic text-[#2B1722] bg-white p-3 rounded-xl border border-amber-200">
                      "{(customer as any).archive_reason}"
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: CALL HISTORY ── */}
        {activeTab === 'calls' && (
          <div className="bg-[#FFFDFC] rounded-3xl border border-[#E8D9D4] shadow-xs p-5 sm:p-6 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8D9D4]">
              <div>
                <h3 className="text-sm font-bold text-[#4A173A] uppercase tracking-wider">
                  Call & Follow-up History ({callLogs.length})
                </h3>
                <p className="text-xs text-[#6F5963] mt-0.5">Chronological record of phone calls and telecaller interactions.</p>
              </div>
              <button
                type="button"
                onClick={() => setCallModalOpen(true)}
                className="px-4 py-2 bg-[#4A173A] text-white hover:bg-[#6A2853] font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-xs border border-[#B76E79]/30 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#E8C7A8]" />
                <span>Log New Call</span>
              </button>
            </div>

            {callLogs.length === 0 ? (
              <div className="text-center py-12 text-[#6F5963] text-xs space-y-2">
                <PhoneCall className="w-8 h-8 text-[#B76E79]/50 mx-auto" />
                <p className="font-semibold">No call records found for this customer yet.</p>
                <p className="text-[#9A858D]">Click &ldquo;Log New Call&rdquo; to record the first contact.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[650px] overflow-y-auto pr-1 custom-scrollbar">
                {callLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 rounded-2xl bg-[#FFFAF7] border border-[#E8D9D4] text-xs space-y-2.5 transition-all hover:border-[#B76E79]"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#4A173A] text-sm">{log.call_outcome}</span>
                        <span className="text-[#9A858D]">·</span>
                        <span className="text-[#6F5963] font-medium">
                          Logged by <strong className="text-[#2B1722]">{log.telecaller_name || 'Telecaller'}</strong>
                        </span>
                      </div>
                      <div className="text-[#6F5963] font-semibold text-[11px] bg-white px-2.5 py-1 rounded-lg border border-[#E8D9D4]">
                        {log.call_date} {log.call_time}
                      </div>
                    </div>

                    {log.remarks && (
                      <p className="text-[#2B1722] bg-[#FFFDFC] p-3 rounded-xl border border-[#E8D9D4] italic">
                        &ldquo;{log.remarks}&rdquo;
                      </p>
                    )}

                    {log.customer_response && (
                      <div className="text-[11px] text-[#4A173A]">
                        <span className="font-bold">Customer Response:</span> {log.customer_response}
                      </div>
                    )}

                    {parseDate(log.next_follow_up_date) && (
                      <div className="text-[11px] text-[#C58A18] font-bold flex items-center gap-1.5 pt-1 border-t border-[#E8D9D4]/60">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Next follow-up: {formatDateDisplay(log.next_follow_up_date, 'None')} ({log.next_follow_up_time || 'Any Time'})</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: VISITS & APPOINTMENTS ── */}
        {activeTab === 'visits' && (
          <div className="bg-[#FFFDFC] rounded-3xl border border-[#E8D9D4] shadow-xs p-5 sm:p-6 space-y-5 animate-fade-in">
            <div className="pb-3 border-b border-[#E8D9D4]">
              <h3 className="text-sm font-bold text-[#4A173A] uppercase tracking-wider">
                Showroom Visits & In-Store Appointments
              </h3>
              <p className="text-xs text-[#6F5963] mt-0.5">Records of physical store footfall, appointments, and shopping sessions.</p>
            </div>

            {visits.length === 0 && appointments.length === 0 ? (
              <div className="text-center py-12 text-[#6F5963] text-xs space-y-2">
                <Building2 className="w-8 h-8 text-[#B76E79]/50 mx-auto" />
                <p className="font-semibold">No showroom visits or appointments recorded yet.</p>
                <p className="text-[#9A858D]">Visits recorded at the store counter or greeter kiosk will appear here automatically.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[650px] overflow-y-auto pr-1 custom-scrollbar">
                {visits.map((v: any, idx: number) => (
                  <div key={`visit-${idx}`} className="p-4 rounded-2xl bg-[#FFFAF7] border border-[#E8D9D4] text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#E8F5EE] text-[#198754]">Store Visit</span>
                        <strong className="text-[#4A173A]">{v.store_name || v.location_name || 'Showroom'}</strong>
                      </div>
                      <span className="text-[#6F5963] font-semibold text-[11px]">{formatDateTimeDisplay(v.visit_date || v.created_at, 'N/A')}</span>
                    </div>
                    {v.visit_notes && <p className="text-[#2B1722] italic">{v.visit_notes}</p>}
                  </div>
                ))}

                {appointments.map((a: any, idx: number) => (
                  <div key={`appt-${idx}`} className="p-4 rounded-2xl bg-[#FFFAF7] border border-[#E8D9D4] text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EDE7F6] text-[#6A2853]">Appointment</span>
                        <strong className="text-[#4A173A]">{a.appointment_type || 'Showroom Visit'}</strong>
                      </div>
                      <span className="text-[#6F5963] font-semibold text-[11px]">{formatDateTimeDisplay(a.appointment_date, 'N/A')}</span>
                    </div>
                    {a.special_arrangement && <p className="text-[#2B1722]">{a.special_arrangement}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 4: NOTES & PREFERENCES ── */}
        {activeTab === 'notes' && (
          <div className="bg-[#FFFDFC] rounded-3xl border border-[#E8D9D4] shadow-xs p-5 sm:p-6 space-y-5 animate-fade-in">
            <div className="pb-3 border-b border-[#E8D9D4]">
              <h3 className="text-sm font-bold text-[#4A173A] uppercase tracking-wider">
                Customer Notes & Shopping Preferences
              </h3>
              <p className="text-xs text-[#6F5963] mt-0.5">Special requirements, trousseau notes, color choices, and fabric preferences.</p>
            </div>

            <form onSubmit={handleAddNote} className="space-y-3">
              <label className="block text-[11px] font-bold text-[#6F5963] uppercase tracking-wider">
                Add New Note / Special Instruction
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Interested in Kanjeevaram pure silk, looking for pastel bridal shades, budget ~₹1.5 Lakh..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="w-full p-3.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-2xl text-xs text-[#2B1722] placeholder-[#9A858D] focus:outline-none focus:border-[#B76E79]"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingNote || !noteText.trim()}
                  className="px-5 py-2.5 bg-[#4A173A] text-white hover:bg-[#6A2853] font-semibold rounded-xl text-xs shadow-xs border border-[#B76E79]/30 disabled:opacity-40 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {savingNote ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 text-[#E8C7A8]" />}
                  <span>{savingNote ? 'Saving...' : 'Add Note'}</span>
                </button>
              </div>
            </form>

            <div className="pt-3 border-t border-[#E8D9D4] space-y-3">
              <h4 className="text-xs font-bold uppercase text-[#4A173A] tracking-wider">Saved Notes</h4>
              {notes.length === 0 && !customer.customer_notes ? (
                <div className="text-center py-8 text-[#6F5963] text-xs">No notes recorded yet.</div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                  {customer.customer_notes && (
                    <div className="p-4 bg-[#FFFAF7] rounded-2xl border border-[#E8D9D4] text-xs space-y-1">
                      <div className="text-[10px] uppercase font-bold text-[#6F5963]">Initial Registration Note</div>
                      <p className="text-[#2B1722] italic font-medium">&ldquo;{customer.customer_notes}&rdquo;</p>
                    </div>
                  )}
                  {notes.map((n: any, idx: number) => (
                    <div key={idx} className="p-4 bg-[#FFFAF7] rounded-2xl border border-[#E8D9D4] text-xs space-y-1.5">
                      <p className="text-[#2B1722] font-medium leading-relaxed">{n.note || n.details || n.note_content}</p>
                      <div className="text-[10px] text-[#6F5963] font-semibold flex items-center gap-2 pt-1 border-t border-[#E8D9D4]/40">
                        <span>{n.created_by || n.user_name || 'Staff'}</span>
                        <span>·</span>
                        <span>{formatDateTimeDisplay(n.created_at, '')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 5: ACTIVITY TIMELINE ── */}
        {activeTab === 'timeline' && (
          <div className="bg-[#FFFDFC] rounded-3xl border border-[#E8D9D4] shadow-xs p-5 sm:p-6 space-y-4 animate-fade-in">
            <div className="pb-3 border-b border-[#E8D9D4]">
              <h3 className="text-sm font-bold text-[#4A173A] uppercase tracking-wider">
                Full Activity & Audit Timeline ({auditLogs.length})
              </h3>
              <p className="text-xs text-[#6F5963] mt-0.5">Automated history of customer creations, edits, status transitions, and staff actions.</p>
            </div>

            {auditLogs.length === 0 ? (
              <div className="text-center py-12 text-[#6F5963] text-xs space-y-2">
                <Activity className="w-8 h-8 text-[#B76E79]/50 mx-auto" />
                <p className="font-semibold">No activity logs recorded yet.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[650px] overflow-y-auto pr-1 custom-scrollbar">
                {auditLogs.map((log: any, idx: number) => (
                  <div key={`audit-${idx}`} className="p-4 rounded-2xl bg-[#FFFAF7] border border-[#E8D9D4] text-xs space-y-1.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#4A173A] text-sm">{log.action}</span>
                        <span className="text-[#9A858D]">·</span>
                        <span className="text-[#6F5963]">By {log.user_name || 'System'}</span>
                      </div>
                      <span className="text-[11px] text-[#6F5963] font-mono">{formatDateTimeDisplay(log.created_at, 'N/A')}</span>
                    </div>
                    {log.details && (
                      <p className="text-[#2B1722] leading-relaxed text-xs">{log.details}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 6: STATUS AUDIT HISTORY ── */}
        {activeTab === 'status_history' && (
          <div className="bg-[#FFFDFC] rounded-3xl border border-[#E8D9D4] shadow-xs p-5 sm:p-6 space-y-4 animate-fade-in">
            <div className="pb-3 border-b border-[#E8D9D4]">
              <h3 className="text-sm font-bold text-[#4A173A] uppercase tracking-wider">
                Status Transitions & Progression Trail
              </h3>
              <p className="text-xs text-[#6F5963] mt-0.5">Audit log of every CRM funnel status change for this lead.</p>
            </div>

            {statusHistory.length === 0 ? (
              <div className="text-center py-12 text-[#6F5963] text-xs space-y-2">
                <History className="w-8 h-8 text-[#B76E79]/50 mx-auto" />
                <p className="font-semibold">Current lead status is &ldquo;{customer.customer_status}&rdquo;.</p>
                <p className="text-[#9A858D]">No further status changes have been recorded.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[650px] overflow-y-auto pr-1 custom-scrollbar">
                {statusHistory.map((sh: any, idx: number) => (
                  <div key={idx} className="p-4 bg-[#FFFAF7] rounded-2xl border border-[#E8D9D4] text-xs flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="font-semibold text-[#2B1722]">
                        Changed to <span className="text-[#4A173A] font-bold text-sm">{sh.new_status}</span>
                      </div>
                      {sh.change_reason && <p className="text-[#6F5963] italic">&ldquo;{sh.change_reason}&rdquo;</p>}
                    </div>
                    <div className="text-right text-[11px] text-[#6F5963] shrink-0 font-medium">
                      <div className="text-[#2B1722] font-semibold">{sh.user_name || 'System Staff'}</div>
                      <div>{formatDateDisplay(sh.created_at, '')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 7: ALL REGISTRATIONS & RELATED JOURNEYS ── */}
        {activeTab === 'associated_weddings' && (
          <div className="bg-[#FFFDFC] rounded-3xl border border-[#E8D9D4] shadow-xs p-5 sm:p-6 space-y-6 animate-fade-in">
            <div>
              <h3 className="text-sm font-bold text-[#4A173A] uppercase tracking-wider">
                Associated Wedding Registrations for Mobile: {customer.mobile_number}
              </h3>
              <p className="text-xs text-[#6F5963] mt-1">
                Families often plan multiple weddings (e.g. son, daughter, sibling). All wedding registrations registered under this mobile number are tracked here independently.
              </p>
            </div>

            {associatedRegistrations.length === 0 && associatedCustomers.length === 0 ? (
              <div className="text-center py-12 bg-[#FFFAF7] rounded-2xl border border-[#E8D9D4] text-[#6F5963] text-xs space-y-2">
                <Heart className="w-8 h-8 text-[#B76E79]/50 mx-auto" />
                <p className="font-semibold">This customer currently has one active wedding registration ({customer.customer_code}).</p>
                <p className="text-[#9A858D]">Future wedding registrations with this mobile number will appear here automatically.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Active Primary Record Banner */}
                <div className="p-4 rounded-2xl bg-[#F6E2E5] border border-[#E8D9D4] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#4A173A] text-sm">{customer.customer_name}</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#4A173A] text-white">Current Active Record</span>
                    </div>
                    <div className="text-[#6F5963] text-[11px] mt-1">
                      Reg ID: <strong className="text-[#4A173A] font-mono">{customer.customer_code}</strong> · Wedding Date: <strong>{formatDateDisplay(customer.wedding_date, 'TBD')}</strong> · Telecaller: <strong>{customer.assigned_telecaller || 'Unassigned'}</strong>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-[#4A173A] bg-[#FFFDFC] border border-[#E8D9D4] px-3 py-1 rounded-xl shrink-0">
                    Status: {customer.customer_status}
                  </span>
                </div>

                {/* List of other registrations */}
                {associatedRegistrations.map((reg) => (
                  <div
                    key={reg.id}
                    className="p-4 rounded-2xl bg-[#FFFAF7] border border-[#E8D9D4] hover:border-[#B76E79] transition-all text-xs flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[#2B1722] text-sm">{reg.customer_name}</span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#EDE7F6] text-[#6A2853] border border-[#E8D9D4]">
                          Reg ID: {reg.registration_id}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#FFFDFC] text-[#6F5963] border border-[#E8D9D4]">
                          {reg.status || 'New'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[#6F5963] text-[11px]">
                        {parseDate(reg.wedding_date) && (
                          <span>Wedding Date: <strong className="text-[#B76E79]">{formatDateDisplay(reg.wedding_date, 'TBD')}</strong></span>
                        )}
                        {reg.bride_name && <span>Bride: <strong>{reg.bride_name}</strong></span>}
                        {reg.groom_name && <span>Groom: <strong>{reg.groom_name}</strong></span>}
                        {reg.wedding_venue && <span>Venue: <strong>{reg.wedding_venue}</strong></span>}
                        {reg.location_name && <span>Store: <strong>{reg.location_name}</strong></span>}
                      </div>
                    </div>
                    <div className="text-[11px] text-[#6F5963] text-right shrink-0">
                      Registered: {formatDateDisplay(reg.created_at, 'N/A')}
                    </div>
                  </div>
                ))}

                {/* Related Journeys */}
                {previousJourneys.length > 0 && (
                  <div className="pt-2">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#4A173A] mb-2">
                      Previous / Related Journeys ({previousJourneys.length})
                    </h4>
                    <div className="space-y-3">
                      {previousJourneys.map((cust: any) => {
                        const relatedArchived = cust.lifecycle_status === 'OLD_CUSTOMER';
                        const relatedBadge = getStatusBadge(cust.customer_status);
                        return (
                          <div
                            key={`journey-${cust.id}`}
                            className={`p-4 rounded-2xl border text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 transition-all hover:border-[#B76E79] ${
                              relatedArchived
                                ? 'bg-amber-50 border-amber-200'
                                : 'bg-[#FFFAF7] border-[#E8D9D4]'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-[#2B1722] text-sm">{cust.customer_name}</span>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#E8F5EE] text-[#198754] border border-[#198754]/20 font-mono">
                                  {cust.customer_code}
                                </span>
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${relatedBadge.bg}`}>
                                  {cust.customer_status}
                                </span>
                                {relatedArchived && (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/80 text-amber-900 border border-amber-300">
                                    OLD CUSTOMER
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[#6F5963] text-[11px]">
                                {parseDate(cust.wedding_date) && (
                                  <span>Wedding Date: <strong className="text-[#B76E79]">{formatDateDisplay(cust.wedding_date, 'TBD')}</strong></span>
                                )}
                                {cust.location_name && (
                                  <span>Location: <strong>{cust.location_name}</strong></span>
                                )}
                                <span>Telecaller: <strong>{cust.assigned_telecaller || 'Unassigned'}</strong></span>
                                <span>Registered: <strong>{formatDateDisplay(cust.created_at, 'N/A')}</strong></span>
                              </div>
                            </div>
                            <Link
                              to={`/wedding-crm/customers/${cust.id}`}
                              className="px-3.5 py-1.5 rounded-xl bg-[#FFFDFC] hover:bg-[#FFF7F2] border border-[#E8D9D4] text-xs font-semibold text-[#4A173A] flex items-center gap-1.5 shrink-0 shadow-2xs"
                            >
                              <span>View Journey</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 8: TELL CALLER / INSTRUCTIONS ── */}
        {activeTab === 'caller_instructions' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FFFDFC] p-4 sm:p-5 rounded-3xl border border-[#E8D9D4] shadow-xs">
              <div>
                <h3 className="text-base font-bold text-[#4A173A] flex items-center gap-2">
                  <MessageSquareQuote className="w-5 h-5 text-[#B76E79]" />
                  <span>Telecaller Instructions & Directives ({instructions.length})</span>
                </h3>
                <p className="text-xs text-[#6F5963] mt-0.5">
                  Guidance and priority instructions sent by CRM managers to the assigned telecaller for {customer.customer_name}.
                </p>
              </div>
              {canTellCaller && !isArchived && (
                <button
                  type="button"
                  onClick={() => setTellCallerOpen(true)}
                  className="px-4 py-2 bg-[#4A173A] hover:bg-[#6A2853] text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-2xs transition-all active:scale-95 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tell Caller / New Instruction</span>
                </button>
              )}
            </div>

            {instructionsLoading ? (
              <div className="bg-[#FFFDFC] p-8 rounded-3xl border border-[#E8D9D4] flex flex-col items-center justify-center text-center text-[#6F5963]">
                <RefreshCw className="w-6 h-6 animate-spin text-[#B76E79] mb-2" />
                <p className="text-xs">Loading instructions...</p>
              </div>
            ) : instructions.length === 0 ? (
              <div className="bg-[#FFFDFC] p-10 rounded-3xl border border-[#E8D9D4] flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-[#F6E2E5] flex items-center justify-center text-[#B76E79] mb-3">
                  <MessageSquareQuote className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-[#4A173A]">No Instructions Sent Yet</h4>
                <p className="text-xs text-[#6F5963] max-w-md mt-1 mb-4">
                  Use "Tell Caller" to send specific instructions, guidance, or urgent reminders to the telecaller handling {customer.customer_name}.
                </p>
                {canTellCaller && !isArchived && (
                  <button
                    type="button"
                    onClick={() => setTellCallerOpen(true)}
                    className="px-4 py-2 bg-[#4A173A] hover:bg-[#6A2853] text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Send Instruction Now</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {instructions.map((inst, idx) => {
                  const statusColors: Record<string, string> = {
                    Completed: 'bg-[#E8F5EE] text-[#198754] border-[#198754]/30',
                    Acknowledged: 'bg-[#FFF4D6] text-[#8A6212] border-[#C58A18]/30',
                    Seen: 'bg-[#EAF1FA] text-[#356AE6] border-[#356AE6]/30',
                    New: 'bg-[#F6E2E5] text-[#6A2853] border-[#B76E79]/30'
                  };
                  const priorityColors: Record<string, string> = {
                    Urgent: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
                    High: 'bg-amber-100 text-amber-800 border-amber-300 font-bold',
                    Normal: 'bg-blue-50 text-blue-700 border-blue-200'
                  };

                  return (
                    <div
                      key={inst.id || idx}
                      className="bg-[#FFFDFC] p-4 sm:p-5 rounded-2xl border border-[#E8D9D4] shadow-xs space-y-3 hover:border-[#B76E79]/40 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E8D9D4]/40 pb-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-[#4A173A]">
                            To: {inst.telecaller_name || inst.telecallerName || 'Assigned Telecaller'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${priorityColors[inst.priority || 'Normal'] || priorityColors.Normal}`}>
                            {inst.priority || 'Normal'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${statusColors[inst.status || 'New'] || statusColors.New}`}>
                            {inst.status || 'New'}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#6F5963] flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#9A858D]" />
                          <span>{formatDateTimeDisplay(inst.created_at || inst.createdAt, 'N/A')}</span>
                        </div>
                      </div>

                      <div className="bg-[#FAF7F5] rounded-xl p-3 border border-[#E8D9D4]/60">
                        <p className="text-xs text-[#2B1722] leading-relaxed whitespace-pre-wrap font-normal">
                          {inst.message}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-between text-[11px] text-[#6F5963] pt-1 gap-2">
                        <div>
                          <span>Sent By: </span>
                          <strong className="text-[#4A173A]">{inst.sent_by_name || inst.sentByName || 'CRM Manager'}</strong>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          {inst.seen_at && (
                            <span className="flex items-center gap-1 text-blue-700">
                              <Eye className="w-3 h-3" /> Seen: {formatDateTimeDisplay(inst.seen_at, '')}
                            </span>
                          )}
                          {inst.acknowledged_at && (
                            <span className="flex items-center gap-1 text-amber-700">
                              <Check className="w-3 h-3" /> Acknowledged: {formatDateTimeDisplay(inst.acknowledged_at, '')}
                            </span>
                          )}
                          {inst.completed_at && (
                            <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                              <CheckCircle2 className="w-3 h-3" /> Completed: {formatDateTimeDisplay(inst.completed_at, '')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* ── MODALS (VIEWPORT CONSTRAINED, FIXED HEADERS & FOOTERS, SCROLLABLE BODY) ── */}
        {/* ========================================================================= */}

        {/* ── 1. EDIT CUSTOMER PROFILE MODAL ── */}
        {editModalOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/60 backdrop-blur-xs overscroll-contain animate-fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget && !savingEdit) setEditModalOpen(false);
            }}
          >
            <div
              className="bg-[#FFFDFC] rounded-2xl sm:rounded-3xl max-w-3xl w-full max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)] shadow-2xl border border-[#E8D9D4] flex flex-col overflow-hidden animate-scale-in"
              role="dialog"
              aria-modal="true"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#E8D9D4] bg-[#FFFDFC] shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#4A173A] text-white flex items-center justify-center shrink-0 shadow-sm border border-[#B76E79]/30">
                    <Edit3 className="w-5 h-5 text-[#E8C7A8]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-bold text-[#4A173A] truncate leading-tight">
                      Edit Customer Profile
                    </h3>
                    <p className="text-xs text-[#6F5963] truncate mt-0.5">
                      Customer ID: <strong className="text-[#4A173A] font-mono">{customer.customer_code}</strong> · {customer.customer_name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => !savingEdit && setEditModalOpen(false)}
                  className="p-2 text-[#6F5963] hover:text-[#4A173A] hover:bg-[#FFF7F2] rounded-xl transition-colors cursor-pointer shrink-0"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Form Body */}
              <form id="edit-customer-form" onSubmit={handleSaveEdit} className="flex-1 overflow-y-auto min-h-0 px-5 sm:px-6 py-5 space-y-6 text-xs custom-scrollbar overscroll-contain">
                {/* Section 1: Customer Contact & Showroom */}
                <div className="space-y-3.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#4A173A] pb-1.5 border-b border-[#E8D9D4]">
                    <User className="w-4 h-4 text-[#B76E79]" />
                    <span>Customer Contact & Showroom Location</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-[#6F5963] mb-1">
                        Full Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editForm.customer_name}
                        onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })}
                        placeholder="Customer full name"
                        className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-xs text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-[#6F5963] mb-1">
                        Mobile Number (10 Digits) <span className="text-rose-500">*</span>
                      </label>
                      <div className="flex rounded-xl border border-[#E8D9D4] bg-[#FFFAF7] overflow-hidden focus-within:border-[#B76E79]">
                        <span className="px-3.5 py-2.5 bg-[#F6E2E5]/50 border-r border-[#E8D9D4] text-xs font-mono font-bold text-[#4A173A] select-none">
                          +91
                        </span>
                        <input
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          required
                          value={editForm.mobile_number}
                          onChange={(e) => setEditForm({ ...editForm, mobile_number: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                          placeholder="9876543210"
                          className="flex-1 px-3.5 py-2.5 text-xs font-mono font-semibold text-[#2B1722] bg-transparent outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-[#6F5963] mb-1">
                        Alternate Mobile (Optional)
                      </label>
                      <div className="flex rounded-xl border border-[#E8D9D4] bg-[#FFFAF7] overflow-hidden focus-within:border-[#B76E79]">
                        <span className="px-3.5 py-2.5 bg-[#F6E2E5]/50 border-r border-[#E8D9D4] text-xs font-mono font-bold text-[#4A173A] select-none">
                          +91
                        </span>
                        <input
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          value={editForm.alternate_mobile}
                          onChange={(e) => setEditForm({ ...editForm, alternate_mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                          placeholder="Optional alternate mobile"
                          className="flex-1 px-3.5 py-2.5 text-xs font-mono font-semibold text-[#2B1722] bg-transparent outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-[#6F5963] mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        placeholder="customer@example.com"
                        className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-xs text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-[#6F5963] mb-1">
                        Store Location Showroom <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={editForm.location_id}
                        disabled={!isGlobalAdmin && allowedLocationIds.length <= 1}
                        onChange={(e) => setEditForm({ ...editForm, location_id: Number(e.target.value) })}
                        className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-xs text-[#4A173A] focus:outline-none focus:border-[#B76E79] disabled:opacity-80 disabled:cursor-not-allowed"
                      >
                        {STORE_LOCATIONS_LIST.filter((loc) => isGlobalAdmin || allowedLocationIds.includes(loc.id)).map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            📍 {loc.city} ({loc.storeName})
                          </option>
                        ))}
                      </select>
                      {!isGlobalAdmin && allowedLocationIds.length <= 1 && (
                        <p className="text-[10px] font-semibold text-[#6F5963] mt-1">
                          Scoped to your assigned store location.
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-[#6F5963] mb-1">
                        Lead Source
                      </label>
                      <select
                        value={editForm.lead_source}
                        onChange={(e) => setEditForm({ ...editForm, lead_source: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-xs text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                      >
                        {LEAD_SOURCES.map((src) => (
                          <option key={src} value={src}>{src}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section 2: Wedding & Shopping Information */}
                <div className="space-y-3.5 pt-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#4A173A] pb-1.5 border-b border-[#E8D9D4]">
                    <Heart className="w-4 h-4 text-[#B76E79]" />
                    <span>Wedding & Shopping Details</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-[#6F5963] mb-1">
                        Wedding Date
                      </label>
                      <input
                        type="date"
                        value={editForm.wedding_date}
                        onChange={(e) => setEditForm({ ...editForm, wedding_date: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-xs text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-[#6F5963] mb-1">
                        Expected Shopping Date
                      </label>
                      <input
                        type="date"
                        value={editForm.expected_shopping_date}
                        onChange={(e) => setEditForm({ ...editForm, expected_shopping_date: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-xs text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-[#6F5963] mb-1">
                        Shopping Category
                      </label>
                      <select
                        value={editForm.preferred_shopping_category}
                        onChange={(e) => setEditForm({ ...editForm, preferred_shopping_category: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-xs text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                      >
                        {SHOPPING_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-[#6F5963] mb-1">
                        Budget Range
                      </label>
                      <select
                        value={editForm.budget}
                        onChange={(e) => setEditForm({ ...editForm, budget: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-xs text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                      >
                        {BUDGET_OPTIONS.map((bg) => (
                          <option key={bg} value={bg}>{bg}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-[#6F5963] mb-1">
                        Estimated Family Size
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={editForm.estimated_family_size}
                        onChange={(e) => setEditForm({ ...editForm, estimated_family_size: parseInt(e.target.value, 10) || 1 })}
                        className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-xs text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-[#6F5963] mb-1">
                        Wedding City / Venue
                      </label>
                      <input
                        type="text"
                        value={editForm.wedding_city}
                        onChange={(e) => setEditForm({ ...editForm, wedding_city: e.target.value })}
                        placeholder="e.g. Shivamogga, Belagavi, Palace Grounds"
                        className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-xs text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-[#6F5963] mb-1">
                        Bride Name
                      </label>
                      <input
                        type="text"
                        value={editForm.bride_name}
                        onChange={(e) => setEditForm({ ...editForm, bride_name: e.target.value })}
                        placeholder="Bride's name"
                        className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-xs text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-[#6F5963] mb-1">
                        Groom Name
                      </label>
                      <input
                        type="text"
                        value={editForm.groom_name}
                        onChange={(e) => setEditForm({ ...editForm, groom_name: e.target.value })}
                        placeholder="Groom's name"
                        className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-xs text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Telecalling & Special Notes */}
                <div className="space-y-3.5 pt-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#4A173A] pb-1.5 border-b border-[#E8D9D4]">
                    <PhoneCall className="w-4 h-4 text-[#B76E79]" />
                    <span>Telecaller Follow-up & Special Notes</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-[#6F5963] mb-1">
                        Preferred Call Time
                      </label>
                      <select
                        value={editForm.preferred_call_time}
                        onChange={(e) => setEditForm({ ...editForm, preferred_call_time: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-xs text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                      >
                        {CALL_TIMES.map((time) => (
                          <option key={time} value={time}>{time}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-[#6F5963] mb-1">
                      Customer Notes & Special Requirements
                    </label>
                    <textarea
                      rows={3}
                      value={editForm.customer_notes}
                      onChange={(e) => setEditForm({ ...editForm, customer_notes: e.target.value })}
                      placeholder="Add notes about trousseau requirements, color choices, VIP handling..."
                      className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-medium text-xs text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                    />
                  </div>
                </div>
              </form>

              {/* Fixed Footer */}
              <div className="flex items-center justify-end gap-3 px-5 sm:px-6 py-4 border-t border-[#E8D9D4] bg-[#FFFDFC] shrink-0 shadow-xs">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  disabled={savingEdit}
                  className="px-4 py-2.5 rounded-xl bg-[#FFFAF7] hover:bg-[#FFF7F2] border border-[#E8D9D4] font-semibold text-xs text-[#4A173A] transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="edit-customer-form"
                  disabled={savingEdit}
                  className="px-6 py-2.5 rounded-xl bg-[#4A173A] hover:bg-[#6A2853] text-white font-semibold text-xs shadow-md border border-[#B76E79]/30 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  {savingEdit ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5 text-[#E8C7A8]" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 2. LOG CALL MODAL ── */}
        {callModalOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overscroll-contain animate-fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget && !savingCall) setCallModalOpen(false);
            }}
          >
            <div
              className="bg-[#FFFDFC] rounded-2xl sm:rounded-3xl max-w-lg w-full max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)] shadow-2xl border border-[#E8D9D4] flex flex-col overflow-hidden animate-scale-in"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#E8D9D4] bg-[#FFFDFC] shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#4A173A] text-white flex items-center justify-center shrink-0">
                    <PhoneCall className="w-4 h-4 text-[#E8C7A8]" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#4A173A]">Log Customer Call</h3>
                    <p className="text-xs text-[#6F5963]">{customer.customer_name} ({customer.customer_code})</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => !savingCall && setCallModalOpen(false)}
                  className="p-1.5 text-[#6F5963] hover:text-[#4A173A] hover:bg-[#FFF7F2] rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form id="log-call-form" onSubmit={handleSaveCall} className="flex-1 overflow-y-auto min-h-0 px-5 sm:px-6 py-5 space-y-4 text-xs custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-[#6F5963] mb-1">
                      Call Outcome <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={callForm.call_outcome}
                      onChange={(e) => setCallForm({ ...callForm, call_outcome: e.target.value })}
                      className="w-full px-3 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                    >
                      {CALL_OUTCOMES.map((out) => (
                        <option key={out} value={out}>
                          {out}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-[#6F5963] mb-1">
                      Next Follow-up Date
                    </label>
                    <input
                      type="date"
                      value={callForm.next_follow_up_date}
                      onChange={(e) => setCallForm({ ...callForm, next_follow_up_date: e.target.value })}
                      className="w-full px-3 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-[#6F5963] mb-1">
                      Preferred Call Time
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 11 AM - 1 PM"
                      value={callForm.next_follow_up_time}
                      onChange={(e) => setCallForm({ ...callForm, next_follow_up_time: e.target.value })}
                      className="w-full px-3 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-medium text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-[#6F5963] mb-1">
                      Expected Shopping Date
                    </label>
                    <input
                      type="date"
                      value={callForm.expected_shopping_date}
                      onChange={(e) => setCallForm({ ...callForm, expected_shopping_date: e.target.value })}
                      className="w-full px-3 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-[#6F5963] mb-1">
                    Call Notes & Customer Remarks
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Details discussed during the call..."
                    value={callForm.remarks}
                    onChange={(e) => setCallForm({ ...callForm, remarks: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-medium text-xs text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                  />
                </div>
              </form>

              <div className="flex items-center justify-end gap-3 px-5 sm:px-6 py-4 border-t border-[#E8D9D4] bg-[#FFFDFC] shrink-0">
                <button
                  type="button"
                  onClick={() => setCallModalOpen(false)}
                  disabled={savingCall}
                  className="px-4 py-2 rounded-xl bg-[#FFFAF7] hover:bg-[#FFF7F2] border border-[#E8D9D4] font-semibold text-xs text-[#4A173A]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="log-call-form"
                  disabled={savingCall}
                  className="px-5 py-2 rounded-xl bg-[#4A173A] hover:bg-[#6A2853] text-white font-semibold text-xs shadow-xs border border-[#B76E79]/30 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  {savingCall ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 text-[#E8C7A8]" />}
                  <span>{savingCall ? 'Saving Call...' : 'Save Call'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 2b. TELL CALLER MODAL ── */}
        {tellCallerOpen && customer && (
          <TellCallerModal
            customer={customer}
            onClose={() => setTellCallerOpen(false)}
            onSent={() => {
              loadCustomer();
              if (customer?.id) loadInstructions(customer.id);
            }}
          />
        )}

        {/* ── 3. REASSIGN TELECALLER MODAL ── */}
        {reassignModalOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overscroll-contain animate-fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget && !savingReassign) setReassignModalOpen(false);
            }}
          >
            <div
              className="bg-[#FFFDFC] rounded-2xl sm:rounded-3xl max-w-md w-full max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)] shadow-2xl border border-[#E8D9D4] flex flex-col overflow-hidden animate-scale-in"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#E8D9D4] bg-[#FFFDFC] shrink-0">
                <div>
                  <h3 className="text-base font-bold text-[#4A173A]">Reassign Telecaller</h3>
                  <p className="text-xs text-[#6F5963]">{customer.customer_name} ({customer.customer_code})</p>
                </div>
                <button
                  type="button"
                  onClick={() => !savingReassign && setReassignModalOpen(false)}
                  className="p-1.5 text-[#6F5963] hover:text-[#4A173A] hover:bg-[#FFF7F2] rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form id="reassign-form" onSubmit={handleSaveReassign} className="flex-1 overflow-y-auto min-h-0 px-5 sm:px-6 py-5 space-y-4 text-xs custom-scrollbar">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-[#6F5963] mb-1">
                    Currently Assigned
                  </label>
                  <div className="p-3 bg-[#FFFAF7] rounded-xl border border-[#E8D9D4] font-semibold text-[#4A173A]">
                    {customer.assigned_telecaller || 'Unassigned'}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-[#6F5963] mb-1">
                    Select New Telecaller / CRM Staff <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedTelecallerId}
                    onChange={(e) => setSelectedTelecallerId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-xs text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                    required
                  >
                    <option value="">-- Choose Staff Member --</option>
                    {telecallers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name || t.username} — {t.employee_id || `EMP-${t.id}`} ({t.role || 'Telecaller'}{t.location_name ? ` · ${t.location_name}` : ''})
                      </option>
                    ))}
                  </select>
                </div>
              </form>

              <div className="flex items-center justify-end gap-3 px-5 sm:px-6 py-4 border-t border-[#E8D9D4] bg-[#FFFDFC] shrink-0">
                <button
                  type="button"
                  onClick={() => setReassignModalOpen(false)}
                  disabled={savingReassign}
                  className="px-4 py-2 rounded-xl bg-[#FFFAF7] hover:bg-[#FFF7F2] border border-[#E8D9D4] font-semibold text-xs text-[#4A173A]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="reassign-form"
                  disabled={savingReassign || !selectedTelecallerId}
                  className="px-5 py-2 rounded-xl bg-[#4A173A] hover:bg-[#6A2853] text-white font-semibold text-xs shadow-xs border border-[#B76E79]/30 disabled:opacity-40 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {savingReassign ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 text-[#E8C7A8]" />}
                  <span>{savingReassign ? 'Reassigning...' : 'Confirm Assignment'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 4. UPDATE STATUS MODAL ── */}
        {statusModalOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overscroll-contain animate-fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget && !savingStatus) setStatusModalOpen(false);
            }}
          >
            <div
              className="bg-[#FFFDFC] rounded-2xl sm:rounded-3xl max-w-sm w-full max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)] shadow-2xl border border-[#E8D9D4] flex flex-col overflow-hidden animate-scale-in"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#E8D9D4] bg-[#FFFDFC] shrink-0">
                <h3 className="text-base font-bold text-[#4A173A]">Update Customer Status</h3>
                <button
                  type="button"
                  onClick={() => !savingStatus && setStatusModalOpen(false)}
                  className="p-1.5 text-[#6F5963] hover:text-[#4A173A] hover:bg-[#FFF7F2] rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form id="status-form" onSubmit={handleSaveStatus} className="flex-1 overflow-y-auto min-h-0 px-5 sm:px-6 py-5 space-y-4 text-xs custom-scrollbar">
                {isArchived && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                    <CircleAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
                    <p className="text-[11px]">
                      This record is archived in Old Customers and is read-only. {ARCHIVE_READONLY_MESSAGE}
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold uppercase text-[#6F5963] mb-1">
                    New Status <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-xs text-[#4A173A] focus:outline-none focus:border-[#B76E79]"
                  >
                    {CUSTOMER_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>

                  {isCompletionStatus(newStatus) && !isArchived && (
                    <div className="flex items-start gap-2 mt-2.5 p-3 rounded-xl bg-[#E8F5EE] border border-[#198754]/30 text-[#198754]">
                      <Archive className="w-4 h-4 shrink-0 mt-0.5" />
                      <p className="text-[11px] leading-relaxed">
                        <strong>Wedding Process Completed</strong> moves <strong>{customer.customer_name}</strong> into the permanent <strong>Old Customers</strong> archive. All history is preserved.
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-[#6F5963] mb-1">
                    Reason / Remarks
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Why is the status transitioning?"
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-medium text-xs text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                  />
                </div>
              </form>

              <div className="flex items-center justify-end gap-3 px-5 sm:px-6 py-4 border-t border-[#E8D9D4] bg-[#FFFDFC] shrink-0">
                <button
                  type="button"
                  onClick={() => setStatusModalOpen(false)}
                  disabled={savingStatus}
                  className="px-4 py-2 rounded-xl bg-[#FFFAF7] hover:bg-[#FFF7F2] border border-[#E8D9D4] font-semibold text-xs text-[#4A173A]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="status-form"
                  disabled={savingStatus || !newStatus}
                  className="px-5 py-2 rounded-xl bg-[#4A173A] hover:bg-[#6A2853] text-white font-semibold text-xs shadow-xs border border-[#B76E79]/30 disabled:opacity-40 transition-all cursor-pointer"
                >
                  {savingStatus ? 'Updating...' : 'Update Status'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 5. MOVE TO OLD CUSTOMERS MODAL ── */}
        {archiveModalOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overscroll-contain animate-fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget && !savingArchive) setArchiveModalOpen(false);
            }}
          >
            <div
              className="bg-[#FFFDFC] border border-[#E8D9D4] rounded-2xl sm:rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl flex flex-col max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)] overflow-hidden animate-scale-in"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-center gap-3 pb-3 border-b border-[#E8D9D4] shrink-0">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-300">
                  <Archive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#4A173A]">Move to Old Customers?</h3>
                  <p className="text-xs text-[#6F5963]">
                    The customer record will be preserved in Old Customers.
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0 py-4 space-y-4 text-xs custom-scrollbar">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900">
                  <p className="font-semibold">{customer.customer_name} ({customer.customer_code})</p>
                  <p className="text-[11px] text-amber-700 mt-1">
                    Updates the lifecycle status to <strong>OLD_CUSTOMER</strong>. No records or history will be deleted.
                  </p>
                </div>

                <form id="archive-form" onSubmit={handleMoveToOld} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#6F5963] uppercase tracking-wider mb-1">
                      Archive Reason / Note (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={archiveReason}
                      onChange={(e) => setArchiveReason(e.target.value)}
                      placeholder="e.g. Wedding shopping completed, relocated..."
                      className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl text-xs text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                    />
                  </div>
                </form>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E8D9D4] shrink-0">
                <button
                  type="button"
                  onClick={() => setArchiveModalOpen(false)}
                  disabled={savingArchive}
                  className="px-4 py-2 rounded-xl bg-[#FFFAF7] hover:bg-[#FFF7F2] border border-[#E8D9D4] text-xs font-semibold text-[#4A173A] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="archive-form"
                  disabled={savingArchive}
                  className="px-5 py-2 rounded-xl bg-[#4A173A] hover:bg-[#6A2853] text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingArchive ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5 text-[#E8C7A8]" />}
                  <span>{savingArchive ? 'Moving Customer...' : 'Move Customer'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 6. RESTORE CUSTOMER MODAL ── */}
        {restoreModalOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overscroll-contain animate-fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget && !savingRestore) setRestoreModalOpen(false);
            }}
          >
            <div
              className="bg-[#FFFDFC] border border-[#E8D9D4] rounded-2xl sm:rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl flex flex-col max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)] overflow-hidden animate-scale-in"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-center gap-3 pb-3 border-b border-[#E8D9D4] shrink-0">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-300">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#4A173A]">Restore Customer?</h3>
                  <p className="text-xs text-[#6F5963]">
                    Return this customer to the active Wedding Customer Register.
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0 py-4 space-y-3 text-xs custom-scrollbar">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-900">
                  <p className="font-semibold">{customer.customer_name} ({customer.customer_code})</p>
                  <p className="text-[11px] text-emerald-700 mt-1">
                    The customer's status, call history, and requirements will be restored without creating any duplicate records.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E8D9D4] shrink-0">
                <button
                  type="button"
                  onClick={() => setRestoreModalOpen(false)}
                  disabled={savingRestore}
                  className="px-4 py-2 rounded-xl bg-[#FFFAF7] hover:bg-[#FFF7F2] border border-[#E8D9D4] text-xs font-semibold text-[#4A173A] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRestore}
                  disabled={savingRestore}
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingRestore ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  <span>{savingRestore ? 'Restoring Customer...' : 'Restore Customer'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
