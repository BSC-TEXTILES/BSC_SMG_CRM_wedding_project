import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import PageContainer from '../../components/ui/PageContainer';
import ToastContainer, { showToast } from '../../components/Toast';
import { API, Auth, UserSession } from '../../services/api';
import WeddingNav from './WeddingNav';
import { parseDate, formatDateDisplay, formatDateTimeDisplay } from '../../utils/dateUtils';
import {
  WeddingCustomer,
  CallLog,
  CUSTOMER_STATUSES,
  CALL_OUTCOMES,
  getStatusBadge
} from './weddingTypes';
import {
  User, Heart, PhoneCall, MessageCircle, FileText, History, TrendingUp,
  ArrowLeft, Plus, X, CircleAlert, RefreshCw, Users, ExternalLink,
  Edit3, MapPin, Calendar, Clock, Save, Building2, Archive, RotateCcw
} from 'lucide-react';
import { STORE_LOCATIONS_LIST } from '../../config/storeLocations';

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
  const [customer, setCustomer] = useState<WeddingCustomer | null>(null);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [statusHistory, setStatusHistory] = useState<any[]>([]);
  const [associatedRegistrations, setAssociatedRegistrations] = useState<any[]>([]);
  const [associatedCustomers, setAssociatedCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Profile Section Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'calls' | 'notes' | 'status_history' | 'associated_weddings'>('overview');

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

  const loadCustomer = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [custRes, fullRes] = await Promise.all([
        API.getWeddingCustomerById(id),
        API.getWeddingFullProfile(id).catch(() => null)
      ]);

      if (custRes?.customer) {
        setCustomer(custRes.customer);
      } else if (custRes?.data) {
        setCustomer(custRes.data);
      }

      if (fullRes?.data) {
        if (Array.isArray(fullRes.data.callLogs)) setCallLogs(fullRes.data.callLogs);
        if (Array.isArray(fullRes.data.notes)) setNotes(fullRes.data.notes);
        if (Array.isArray(fullRes.data.statusHistory)) setStatusHistory(fullRes.data.statusHistory);
        if (Array.isArray(fullRes.data.associatedRegistrations)) setAssociatedRegistrations(fullRes.data.associatedRegistrations);
        if (Array.isArray(fullRes.data.associatedCustomers)) setAssociatedCustomers(fullRes.data.associatedCustomers);
      } else if (custRes?.call_logs) {
        setCallLogs(custRes.call_logs);
      }
    } catch (err: any) {
      showToast('Error loading customer details: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [id]);

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

      const res: any = await API.updateWeddingCustomer(customer.id, payload);
      if (res?.success === false) {
        showToast(res.message || 'Failed to update customer', 'error');
        return;
      }
      showToast('Customer details updated successfully.', 'success');
      setEditModalOpen(false);
      await loadCustomer();
    } catch (err: any) {
      console.error('[handleSaveEdit Error]', err);
      showToast(err.message || 'Failed to update customer details', 'error');
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
      loadCustomer();
    } catch (err: any) {
      showToast('Error reassigning telecaller: ' + err.message, 'error');
    } finally {
      setSavingReassign(false);
    }
  };

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    setSession(Auth.get());
    loadCustomer();
  }, [loadCustomer, navigate]);

  // Handle Log Call Submission
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
      loadCustomer();
    } catch (err: any) {
      showToast('Error logging call: ' + err.message, 'error');
    } finally {
      setSavingCall(false);
    }
  };

  // Handle Status Change Submission
  const handleSaveStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer || !newStatus) return;
    setSavingStatus(true);
    try {
      await API.changeWeddingCustomerStatus(customer.id, newStatus, statusReason);
      showToast('Customer status updated successfully.', 'success');
      setStatusModalOpen(false);
      loadCustomer();
    } catch (err: any) {
      showToast('Error updating status: ' + err.message, 'error');
    } finally {
      setSavingStatus(false);
    }
  };

  // Handle Add Note Submission
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer || !noteText.trim()) return;
    setSavingNote(true);
    try {
      await API.createWeddingNote(customer.id, { note: noteText.trim() });
      showToast('Customer note added successfully.', 'success');
      setNoteText('');
      loadCustomer();
    } catch (err: any) {
      showToast('Error adding note: ' + err.message, 'error');
    } finally {
      setSavingNote(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFF7F2] flex items-center justify-center">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#4A173A]">
          <RefreshCw className="w-5 h-5 animate-spin text-[#B76E79]" />
          Loading wedding customer profile...
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-[#FFF7F2] flex items-center justify-center p-4">
        <div className="bg-[#FFFDFC] p-8 rounded-3xl border border-[#E8D9D4] text-center max-w-md space-y-4 shadow-sm">
          <CircleAlert className="w-10 h-10 text-[#B42318] mx-auto" />
          <h2 className="text-lg font-bold text-[#4A173A]">Customer Not Found</h2>
          <p className="text-xs text-[#6F5963]">
            The requested customer profile does not exist or you do not have permission to view it.
          </p>
          <Link
            to="/wedding-crm/customers"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#4A173A] text-white hover:bg-[#6A2853] font-semibold rounded-xl text-xs shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Customer Register
          </Link>
        </div>
      </div>
    );
  }

  const badge = getStatusBadge(customer.customer_status);

  return (
    <DashboardLayout title={customer ? `Customer Profile: ${customer.customer_name}` : 'Customer Details'}>
      <PageContainer maxWidth="full">
        <ToastContainer />
        <div className="space-y-6">

          <WeddingNav
            currentPageTitle={customer.customer_name}
            breadcrumbs={[
              {
                label: customer.lifecycle_status === 'OLD_CUSTOMER' ? 'Old Customers' : 'Customer Register',
                href: customer.lifecycle_status === 'OLD_CUSTOMER' ? '/wedding-crm/old-customers' : '/wedding-crm/customers'
              },
              { label: customer.customer_code }
            ]}
            actions={
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <Link
                  to={customer.lifecycle_status === 'OLD_CUSTOMER' ? '/wedding-crm/old-customers' : '/wedding-crm/customers'}
                  className="px-3 py-2 bg-[#FFFDFC] hover:bg-[#FFF7F2] border border-[#E8D9D4] rounded-xl text-xs font-semibold text-[#4A173A] flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </Link>

                <button
                  type="button"
                  onClick={handleOpenEdit}
                  className="px-3.5 py-2 bg-[#B76E79] hover:bg-[#A85F6A] text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-white" />
                  <span>Edit Details</span>
                </button>

                <button
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
                  className="px-4 py-2 bg-[#4A173A] hover:bg-[#6A2853] text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-all border border-[#B76E79]/30"
                >
                  <PhoneCall className="w-3.5 h-3.5 text-[#E8C7A8]" />
                  <span>Log Call</span>
                </button>

                <a
                  href={`https://wa.me/91${customer.mobile_number.replace(/\D/g, '')}?text=Namaste%20${encodeURIComponent(customer.customer_name)}%2C%20greetings%20from%20BSC%20Exclusive%20Textiles!`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 bg-[#198754] hover:bg-[#16805B] text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>

                <button
                  onClick={handleOpenReassign}
                  className="px-3.5 py-2 bg-[#B76E79] hover:bg-[#A85F6A] text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Reassign Telecaller</span>
                </button>

                <button
                  onClick={() => {
                    setNewStatus(customer.customer_status);
                    setStatusReason('');
                    setStatusModalOpen(true);
                  }}
                  className="px-3.5 py-2 bg-[#4A173A] hover:bg-[#6A2853] text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-xs border border-[#B76E79]/30"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-[#E8C7A8]" />
                  <span>Update Status</span>
                </button>

                {customer.lifecycle_status === 'OLD_CUSTOMER' ? (
                  <button
                    type="button"
                    onClick={() => setRestoreModalOpen(true)}
                    className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
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
                    className="px-3.5 py-2 bg-[#5F4B55] hover:bg-[#483740] text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    title="Move to Old Customers section"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>Move to Old Customers</span>
                  </button>
                )}
              </div>
            }
          />

          {/* Old Customer Alert Banner */}
          {customer.lifecycle_status === 'OLD_CUSTOMER' && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 shadow-xs">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 text-amber-800 font-bold">
                  <Archive className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-2">
                    <span>Historical Old Customer Record</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/80 text-amber-900 border border-amber-300">
                      OLD CUSTOMER
                    </span>
                  </div>
                  <div className="text-xs text-amber-700 mt-0.5">
                    Archived on <span className="font-semibold">{formatDateDisplay((customer as any).archived_at, 'N/A')}</span>
                    {(customer as any).archived_by && <span> by <span className="font-semibold">{(customer as any).archived_by}</span></span>}
                    {(customer as any).archive_reason && <span> — <em>"{(customer as any).archive_reason}"</em></span>}
                  </div>
                  <div className="text-[11px] text-amber-600 mt-0.5">
                    All call records, shopping requirements, and interaction history remain permanently intact.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRestoreModalOpen(true)}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore Customer</span>
              </button>
            </div>
          )}

          {/* Customer Header Card */}
          <div className="bg-[#FFFDFC] p-5 sm:p-6 rounded-3xl border border-[#E8D9D4] shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#4A173A] text-white font-bold text-xl flex items-center justify-center border border-[#B76E79]/30 shadow-md">
                {customer.customer_name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl sm:text-2xl font-bold text-[#4A173A]">
                    {customer.customer_name}
                  </h2>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${badge.bg}`}>
                    {customer.customer_status}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-[#6F5963] font-medium mt-1">
                  <span>Reg ID: <strong className="text-[#4A173A]">{customer.customer_code}</strong></span>
                  <span>·</span>
                  <span>📱 {customer.mobile_number}</span>
                  <span>·</span>
                  <span>📍 {customer.location_name || 'Store'}</span>
                  <span>·</span>
                  <span>Telecaller: <strong className="text-[#4A173A]">{customer.assigned_telecaller || 'Unassigned'}</strong></span>
                </div>
              </div>
            </div>

            {/* Wedding Countdown Pill */}
            {parseDate(customer.wedding_date) && (
              <div className="bg-[#F6E2E5] border border-[#E8D9D4] rounded-2xl p-3 sm:px-5 flex items-center gap-3 text-[#4A173A]">
                <Heart className="w-6 h-6 text-[#B76E79] flex-shrink-0" />
                <div>
                  <div className="text-[10px] font-bold uppercase text-[#6F5963]">Wedding Date</div>
                  <div className="text-sm font-bold text-[#4A173A]">{formatDateDisplay(customer.wedding_date, 'TBD')}</div>
                </div>
                {(() => {
                  const weddingDay = parseDate(customer.wedding_date);
                  if (!weddingDay) return null;
                  const diffDays = Math.ceil(
                    (weddingDay.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                  );
                  return diffDays > 0 ? (
                    <div className="ml-auto pl-3 border-l border-[#E8D9D4] text-right">
                      <div className="text-base font-bold text-[#B76E79]">{diffDays}</div>
                      <div className="text-[9px] uppercase font-semibold text-[#6F5963]">Days Left</div>
                    </div>
                  ) : null;
                })()}
              </div>
            )}
          </div>

          {/* Tabs Bar */}
          <div className="flex items-center gap-2 border-b border-[#E8D9D4] pb-2 text-xs font-semibold overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'bg-[#B76E79] text-white shadow-xs'
                  : 'bg-[#FFFDFC] text-[#6F5963] hover:text-[#4A173A] border border-[#E8D9D4]'
              }`}
            >
              Overview & Requirements
            </button>
            <button
              onClick={() => setActiveTab('calls')}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'calls'
                  ? 'bg-[#B76E79] text-white shadow-xs'
                  : 'bg-[#FFFDFC] text-[#6F5963] hover:text-[#4A173A] border border-[#E8D9D4]'
              }`}
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Call History ({callLogs.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'notes'
                  ? 'bg-[#B76E79] text-white shadow-xs'
                  : 'bg-[#FFFDFC] text-[#6F5963] hover:text-[#4A173A] border border-[#E8D9D4]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Notes & Preferences</span>
            </button>
            <button
              onClick={() => setActiveTab('status_history')}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'status_history'
                  ? 'bg-[#B76E79] text-white shadow-xs'
                  : 'bg-[#FFFDFC] text-[#6F5963] hover:text-[#4A173A] border border-[#E8D9D4]'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Status Audit History</span>
            </button>
            <button
              onClick={() => setActiveTab('associated_weddings')}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'associated_weddings'
                  ? 'bg-[#B76E79] text-white shadow-xs'
                  : 'bg-[#FFFDFC] text-[#6F5963] hover:text-[#4A173A] border border-[#E8D9D4]'
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              <span>All Registrations ({associatedRegistrations.length + associatedCustomers.length})</span>
            </button>
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Section 1: Customer Details */}
              <div className="bg-[#FFFDFC] p-5 rounded-3xl border border-[#E8D9D4] shadow-xs space-y-3 text-xs">
                <div className="flex items-center justify-between font-bold text-sm text-[#4A173A] border-b border-[#E8D9D4] pb-2">
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
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[#6F5963]">Full Name:</span>
                    <strong className="text-[#2B1722]">{customer.customer_name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6F5963]">Mobile Number:</span>
                    <strong className="text-[#2B1722]">{customer.mobile_number}</strong>
                  </div>
                  {(customer as any).alternate_mobile && (
                    <div className="flex justify-between">
                      <span className="text-[#6F5963]">Alternate Mobile:</span>
                      <strong className="text-[#2B1722]">{(customer as any).alternate_mobile}</strong>
                    </div>
                  )}
                  {customer.email && (
                    <div className="flex justify-between">
                      <span className="text-[#6F5963]">Email:</span>
                      <span className="text-[#2B1722] font-medium">{customer.email}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-[#6F5963]">Store Location:</span>
                    <span className="text-[#4A173A] font-semibold">{customer.location_name || 'Store'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6F5963]">Lead Source:</span>
                    <span className="text-[#2B1722] font-medium">{customer.lead_source || 'In-store Walkin'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6F5963]">Registration Date:</span>
                    <span className="text-[#2B1722] font-medium">
                      {formatDateDisplay(customer.created_at, 'N/A')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 2: Wedding & Shopping Details */}
              <div className="bg-[#FFFDFC] p-5 rounded-3xl border border-[#E8D9D4] shadow-xs space-y-3 text-xs">
                <div className="flex items-center justify-between font-bold text-sm text-[#4A173A] border-b border-[#E8D9D4] pb-2">
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4 text-[#B76E79]" />
                    <span>Wedding & Shopping Information</span>
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
                <div className="space-y-2">
                  {parseDate(customer.wedding_date) ? (
                    <div className="flex justify-between">
                      <span className="text-[#6F5963]">Wedding Date:</span>
                      <strong className="text-[#B76E79]">
                        {formatDateDisplay(customer.wedding_date, 'TBD')}
                      </strong>
                    </div>
                  ) : null}
                  <div className="flex justify-between">
                    <span className="text-[#6F5963]">Expected Shopping:</span>
                    <strong className="text-[#4A173A]">
                      {formatDateDisplay(customer.expected_shopping_date, 'TBD')}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6F5963]">Category:</span>
                    <strong className="text-[#2B1722]">{customer.preferred_shopping_category || 'General Wedding'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6F5963]">Budget Range:</span>
                    <strong className="text-[#198754]">{customer.budget || (customer as any).budget_range || 'Not Decided'}</strong>
                  </div>
                  {customer.estimated_family_size ? (
                    <div className="flex justify-between">
                      <span className="text-[#6F5963]">Family Size:</span>
                      <strong className="text-[#2B1722]">{customer.estimated_family_size} members</strong>
                    </div>
                  ) : null}
                  {(customer as any).bride_name && (
                    <div className="flex justify-between">
                      <span className="text-[#6F5963]">Bride:</span>
                      <strong className="text-[#2B1722]">{(customer as any).bride_name}</strong>
                    </div>
                  )}
                  {(customer as any).groom_name && (
                    <div className="flex justify-between">
                      <span className="text-[#6F5963]">Groom:</span>
                      <strong className="text-[#2B1722]">{(customer as any).groom_name}</strong>
                    </div>
                  )}
                  {(customer as any).wedding_city && (
                    <div className="flex justify-between">
                      <span className="text-[#6F5963]">City / Venue:</span>
                      <strong className="text-[#2B1722]">{(customer as any).wedding_city}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: Follow-up & Telecaller Desk */}
              <div className="bg-[#FFFDFC] p-5 rounded-3xl border border-[#E8D9D4] shadow-xs space-y-3 text-xs">
                <div className="flex items-center gap-2 font-bold text-sm text-[#4A173A] border-b border-[#E8D9D4] pb-2">
                  <PhoneCall className="w-4 h-4 text-[#B76E79]" />
                  <span>Follow-up & Telecaller Desk</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[#6F5963]">Assigned Telecaller:</span>
                    <strong className="text-[#4A173A]">{customer.assigned_telecaller || 'Unassigned'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6F5963]">Next Follow-up Date:</span>
                    <strong className="text-[#C58A18]">
                      {formatDateDisplay(customer.follow_up_date, 'None')}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6F5963]">Preferred Call Time:</span>
                    <span className="text-[#2B1722] font-medium">{customer.preferred_call_time || 'Any Time'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6F5963]">Call Status:</span>
                    <span className="text-[#2B1722] font-medium">{customer.call_status || 'Not Started'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6F5963]">Total Calls Made:</span>
                    <strong className="text-[#4A173A]">{customer.total_calls_count || callLogs.length}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6F5963]">Last Call Date:</span>
                    <strong className="text-[#4A173A]">{formatDateDisplay(customer.last_call_date, 'No calls yet')}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6F5963]">Last Call Outcome:</span>
                    <strong className="text-[#4A173A]">{customer.last_call_outcome || 'Pending First Call'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6F5963]">Registered On:</span>
                    <strong className="text-[#4A173A]">{formatDateTimeDisplay(customer.created_at, '—')}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6F5963]">Last Updated:</span>
                    <strong className="text-[#4A173A]">{formatDateTimeDisplay(customer.updated_at, '—')}</strong>
                  </div>
                </div>
              </div>

              {/* Section 4: Archive & Lifecycle Information */}
              {(customer.lifecycle_status === 'OLD_CUSTOMER' || (customer as any).archived_at) && (
                <div className="bg-[#FFFDFC] p-5 rounded-3xl border border-amber-200 bg-amber-50/20 shadow-xs space-y-3 text-xs md:col-span-2 lg:col-span-3">
                  <div className="flex items-center justify-between font-bold text-sm text-[#4A173A] border-b border-[#E8D9D4] pb-2">
                    <div className="flex items-center gap-2">
                      <Archive className="w-4 h-4 text-amber-700" />
                      <span>Archive & Lifecycle Information</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                      {customer.lifecycle_status || 'OLD_CUSTOMER'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-medium text-[#6F5963]">Lifecycle Status</div>
                      <div className="font-bold text-amber-800 text-sm">{customer.lifecycle_status || 'OLD_CUSTOMER'}</div>
                    </div>
                    {(customer as any).previous_status && (
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-medium text-[#6F5963]">Previous CRM Status</div>
                        <div className="font-bold text-[#4A173A] text-sm">{(customer as any).previous_status}</div>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-medium text-[#6F5963]">Archived On</div>
                      <div className="font-semibold text-[#2B1722] text-sm">
                        {formatDateTimeDisplay((customer as any).archived_at, 'N/A')}
                      </div>
                    </div>
                    {(customer as any).archived_by && (
                      <div className="space-y-1.5">
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

          {/* TAB 2: CALL HISTORY */}
          {activeTab === 'calls' && (
            <div className="bg-[#FFFDFC] rounded-3xl border border-[#E8D9D4] shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#4A173A] uppercase tracking-wider">
                  Call & Follow-up Logs ({callLogs.length})
                </h3>
                <button
                  onClick={() => setCallModalOpen(true)}
                  className="px-3.5 py-1.5 bg-[#4A173A] text-white hover:bg-[#6A2853] font-semibold rounded-xl text-xs flex items-center gap-1 shadow-xs border border-[#B76E79]/30"
                >
                  <Plus className="w-3.5 h-3.5 text-[#E8C7A8]" /> Log Call
                </button>
              </div>

              {callLogs.length === 0 ? (
                <div className="text-center py-10 text-[#6F5963] text-xs">
                  No call logs recorded for this customer yet. Click "Log Call" to record the first contact.
                </div>
              ) : (
                <div className="space-y-3">
                  {callLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-4 rounded-2xl bg-[#FFFAF7] border border-[#E8D9D4] text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#4A173A]">{log.call_outcome}</span>
                          <span className="text-[#9A858D]">·</span>
                          <span className="text-[#6F5963] font-medium">
                            By {log.telecaller_name || 'Telecaller'}
                          </span>
                        </div>
                        <div className="text-[#6F5963] font-semibold text-[11px]">
                          {log.call_date} {log.call_time}
                        </div>
                      </div>

                      {log.remarks && (
                        <p className="text-[#2B1722] bg-[#FFFDFC] p-2.5 rounded-xl border border-[#E8D9D4] italic">
                          "{log.remarks}"
                        </p>
                      )}

                      {parseDate(log.next_follow_up_date) && (
                        <div className="text-[11px] text-[#C58A18] font-bold">
                          Next follow-up scheduled for: {formatDateDisplay(log.next_follow_up_date, 'None')} ({log.next_follow_up_time || 'Any Time'})
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: NOTES */}
          {activeTab === 'notes' && (
            <div className="bg-[#FFFDFC] rounded-3xl border border-[#E8D9D4] shadow-xs p-5 space-y-5">
              <h3 className="text-sm font-bold text-[#4A173A] uppercase tracking-wider">
                Customer Notes & Preferences
              </h3>

              <form onSubmit={handleAddNote} className="space-y-3">
                <textarea
                  rows={3}
                  placeholder="Add a new customer requirement, preference (e.g. Kanjeevaram pure silk, budget notes)..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="w-full p-3 bg-[#FFFAF7] border border-[#E8D9D4] rounded-2xl text-xs text-[#2B1722] placeholder-[#9A858D] focus:outline-none focus:border-[#B76E79]"
                />
                <button
                  type="submit"
                  disabled={savingNote || !noteText.trim()}
                  className="px-4 py-2 bg-[#4A173A] text-white hover:bg-[#6A2853] font-semibold rounded-xl text-xs shadow-xs border border-[#B76E79]/30 disabled:opacity-40"
                >
                  {savingNote ? 'Saving...' : 'Add Note'}
                </button>
              </form>

              {notes.length === 0 && !customer.customer_notes ? (
                <div className="text-center py-6 text-[#6F5963] text-xs">No notes recorded yet.</div>
              ) : (
                <div className="space-y-2.5 pt-3 border-t border-[#E8D9D4]">
                  {customer.customer_notes && (
                    <div className="p-3 bg-[#FFFAF7] rounded-xl border border-[#E8D9D4] text-xs">
                      <div className="text-[10px] uppercase font-bold text-[#6F5963] mb-1">Registration Note</div>
                      <p className="text-[#2B1722] italic">{customer.customer_notes}</p>
                    </div>
                  )}
                  {notes.map((n: any, idx: number) => (
                    <div key={idx} className="p-3 bg-[#FFFAF7] rounded-xl border border-[#E8D9D4] text-xs space-y-1">
                      <p className="text-[#2B1722]">{n.note || n.details}</p>
                      <div className="text-[10px] text-[#6F5963] font-medium">
                        {n.created_by || 'Staff'} · {formatDateTimeDisplay(n.created_at, '')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: STATUS AUDIT HISTORY */}
          {activeTab === 'status_history' && (
            <div className="bg-[#FFFDFC] rounded-3xl border border-[#E8D9D4] shadow-xs p-5 space-y-4">
              <h3 className="text-sm font-bold text-[#4A173A] uppercase tracking-wider">
                Status Transitions & Audit Trail
              </h3>

              {statusHistory.length === 0 ? (
                <div className="text-center py-8 text-[#6F5963] text-xs">
                  Initial lead status is "{customer.customer_status}". No further status transitions logged.
                </div>
              ) : (
                <div className="space-y-3">
                  {statusHistory.map((sh: any, idx: number) => (
                    <div key={idx} className="p-3 bg-[#FFFAF7] rounded-xl border border-[#E8D9D4] text-xs flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-[#2B1722]">
                          Changed to <span className="text-[#4A173A] font-bold">{sh.new_status}</span>
                        </div>
                        {sh.change_reason && <p className="text-[#6F5963] mt-0.5">{sh.change_reason}</p>}
                      </div>
                      <div className="text-right text-[10px] text-[#6F5963] font-medium">
                        <div>{sh.user_name || 'System'}</div>
                        <div>{formatDateDisplay(sh.created_at, '')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: ASSOCIATED WEDDINGS & REGISTRATIONS */}
          {activeTab === 'associated_weddings' && (
            <div className="bg-[#FFFDFC] rounded-3xl border border-[#E8D9D4] shadow-xs p-5 space-y-6">
              <div>
                <h3 className="text-sm font-bold text-[#4A173A] uppercase tracking-wider">
                  Associated Wedding Registrations for Mobile: {customer.mobile_number}
                </h3>
                <p className="text-xs text-[#6F5963] mt-1">
                  Families often plan multiple weddings (e.g. son, daughter, sibling). All wedding registrations registered under this mobile number are tracked here independently.
                </p>
              </div>

              {associatedRegistrations.length === 0 && associatedCustomers.length === 0 ? (
                <div className="text-center py-10 bg-[#FFFAF7] rounded-2xl border border-[#E8D9D4] text-[#6F5963] text-xs">
                  This customer currently has one active wedding registration ({customer.customer_code}). Future wedding registrations with this mobile number will appear here automatically.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Active Primary Record Banner */}
                  <div className="p-4 rounded-2xl bg-[#F6E2E5] border border-[#E8D9D4] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#4A173A] text-sm">{customer.customer_name}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#4A173A] text-white">Current Active Record</span>
                      </div>
                      <div className="text-[#6F5963] text-[11px] mt-1">
                        Reg ID: <strong className="text-[#4A173A]">{customer.customer_code}</strong> · Wedding Date: <strong>{formatDateDisplay(customer.wedding_date, 'TBD')}</strong> · Telecaller: <strong>{customer.assigned_telecaller || 'Unassigned'}</strong>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-[#4A173A] bg-[#FFFDFC] border border-[#E8D9D4] px-3 py-1 rounded-xl">
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
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#2B1722] text-sm">{reg.customer_name}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#EDE7F6] text-[#6A2853] border border-[#E8D9D4]">
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
                      <div className="text-[11px] text-[#6F5963] text-right">
                        Registered: {formatDateDisplay(reg.created_at, 'N/A')}
                      </div>
                    </div>
                  ))}

                  {/* Other CRM Customer records if any */}
                  {associatedCustomers.map((cust) => (
                    <div
                      key={cust.id}
                      className="p-4 rounded-2xl bg-[#FFFAF7] border border-[#E8D9D4] hover:border-[#B76E79] transition-all text-xs flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#2B1722] text-sm">{cust.customer_name}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E8F5EE] text-[#198754] border border-[#198754]/20">
                            CRM Code: {cust.customer_code}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#FFFDFC] text-[#6F5963] border border-[#E8D9D4]">
                            {cust.customer_status}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[#6F5963] text-[11px]">
                          {parseDate(cust.wedding_date) && (
                            <span>Wedding Date: <strong className="text-[#B76E79]">{formatDateDisplay(cust.wedding_date, 'TBD')}</strong></span>
                          )}
                          {cust.location_name && <span>Store: <strong>{cust.location_name}</strong></span>}
                          <span>Telecaller: <strong>{cust.assigned_telecaller || 'Unassigned'}</strong></span>
                        </div>
                      </div>
                      <Link
                        to={`/wedding-crm/customers/${cust.id}`}
                        className="px-3 py-1.5 rounded-xl bg-[#FFFDFC] hover:bg-[#FFF7F2] border border-[#E8D9D4] text-xs font-semibold text-[#4A173A] flex items-center gap-1"
                      >
                        <span>View Customer</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Log Call Modal */}
          {callModalOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <div className="bg-[#FFFDFC] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#E8D9D4] space-y-4 animate-scale-in">
                <div className="flex items-center justify-between pb-3 border-b border-[#E8D9D4]">
                  <h3 className="text-base font-bold text-[#4A173A]">
                    Log Call: {customer.customer_name}
                  </h3>
                  <button onClick={() => setCallModalOpen(false)} className="p-1 text-[#6F5963] hover:text-[#4A173A] hover:bg-[#FFF7F2] rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveCall} className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[#6F5963] mb-1">
                        Call Outcome *
                      </label>
                      <select
                        value={callForm.call_outcome}
                        onChange={(e) => setCallForm({ ...callForm, call_outcome: e.target.value })}
                        className="w-full px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                      >
                        {CALL_OUTCOMES.map((out) => (
                          <option key={out} value={out}>
                            {out}
                          </option>
                        ))}
                      </select>
                    </div>

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
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[#6F5963] mb-1">
                        Preferred Call Time
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 11 AM"
                        value={callForm.next_follow_up_time}
                        onChange={(e) => setCallForm({ ...callForm, next_follow_up_time: e.target.value })}
                        className="w-full px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-medium text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                      />
                    </div>

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

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#6F5963] mb-1">
                      Call Notes & Customer Response
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Notes from customer call..."
                      value={callForm.remarks}
                      onChange={(e) => setCallForm({ ...callForm, remarks: e.target.value })}
                      className="w-full px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-medium text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E8D9D4]">
                    <button
                      type="button"
                      onClick={() => setCallModalOpen(false)}
                      className="px-4 py-2 rounded-xl bg-[#FFFAF7] hover:bg-[#FFF7F2] border border-[#E8D9D4] font-semibold text-[#4A173A]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingCall}
                      className="px-5 py-2 rounded-xl bg-[#4A173A] hover:bg-[#6A2853] text-white font-semibold shadow-xs border border-[#B76E79]/30"
                    >
                      {savingCall ? 'Saving...' : 'Save Call'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Update Status Modal */}
          {statusModalOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <div className="bg-[#FFFDFC] rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-[#E8D9D4] space-y-4 animate-scale-in">
                <div className="flex items-center justify-between pb-3 border-b border-[#E8D9D4]">
                  <h3 className="text-base font-bold text-[#4A173A]">Update Customer Status</h3>
                  <button onClick={() => setStatusModalOpen(false)} className="p-1 text-[#6F5963] hover:text-[#4A173A] hover:bg-[#FFF7F2] rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveStatus} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#6F5963] mb-1">
                      New Status *
                    </label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="w-full px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-[#4A173A] focus:outline-none focus:border-[#B76E79]"
                    >
                      {CUSTOMER_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#6F5963] mb-1">
                      Reason / Remarks
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Why is the status transitioning?"
                      value={statusReason}
                      onChange={(e) => setStatusReason(e.target.value)}
                      className="w-full px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-medium text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E8D9D4]">
                    <button
                      type="button"
                      onClick={() => setStatusModalOpen(false)}
                      className="px-4 py-2 rounded-xl bg-[#FFFAF7] hover:bg-[#FFF7F2] border border-[#E8D9D4] font-semibold text-[#4A173A]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingStatus || !newStatus}
                      className="px-5 py-2 rounded-xl bg-[#4A173A] hover:bg-[#6A2853] text-white font-semibold shadow-xs border border-[#B76E79]/30 disabled:opacity-40"
                    >
                      {savingStatus ? 'Updating...' : 'Update Status'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Reassign Telecaller Modal */}
          {reassignModalOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
              <div className="bg-[#FFFDFC] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#E8D9D4] space-y-4 animate-scale-in">
                <div className="flex items-center justify-between pb-3 border-b border-[#E8D9D4]">
                  <div>
                    <h3 className="text-base font-bold text-[#4A173A]">Reassign Telecaller</h3>
                    <p className="text-xs text-[#6F5963]">Customer: {customer.customer_name} ({customer.customer_code})</p>
                  </div>
                  <button onClick={() => setReassignModalOpen(false)} className="p-1 text-[#6F5963] hover:text-[#4A173A] hover:bg-[#FFF7F2] rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveReassign} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#6F5963] mb-1">
                      Currently Assigned
                    </label>
                    <div className="p-2.5 bg-[#FFFAF7] rounded-xl border border-[#E8D9D4] font-semibold text-[#4A173A]">
                      {customer.assigned_telecaller || 'Unassigned'}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#6F5963] mb-1">
                      Select New Telecaller / CRM Staff *
                    </label>
                    <select
                      value={selectedTelecallerId}
                      onChange={(e) => setSelectedTelecallerId(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-xs text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
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

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E8D9D4]">
                    <button
                      type="button"
                      onClick={() => setReassignModalOpen(false)}
                      className="px-4 py-2 rounded-xl bg-[#FFFAF7] hover:bg-[#FFF7F2] border border-[#E8D9D4] font-semibold text-[#4A173A]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingReassign || !selectedTelecallerId}
                      className="px-5 py-2 rounded-xl bg-[#4A173A] hover:bg-[#6A2853] text-white font-semibold shadow-xs border border-[#B76E79]/30 disabled:opacity-40 flex items-center gap-1.5"
                    >
                      {savingReassign ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Reassigning...</span>
                        </>
                      ) : (
                        'Confirm Assignment'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit Customer Details Modal */}
          {editModalOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in overflow-y-auto">
              <div className="bg-[#FFFDFC] rounded-3xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl border border-[#E8D9D4] space-y-5 animate-scale-in my-8 max-h-[92vh] flex flex-col">
                <div className="flex items-center justify-between pb-3.5 border-b border-[#E8D9D4] shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#4A173A] text-white flex items-center justify-center">
                      <Edit3 className="w-4 h-4 text-[#E8C7A8]" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#4A173A]">Edit Customer Profile</h3>
                      <p className="text-xs text-[#6F5963]">Reg ID: {customer.customer_code} · {customer.customer_name}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditModalOpen(false)}
                    className="p-1.5 text-[#6F5963] hover:text-[#4A173A] hover:bg-[#FFF7F2] rounded-xl transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveEdit} className="space-y-5 text-xs overflow-y-auto pr-1 flex-1">
                  {/* Section 1: Customer Contact & Showroom */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#4A173A] pb-1 border-b border-[#E8D9D4]/60">
                      <User className="w-3.5 h-3.5 text-[#B76E79]" />
                      <span>Customer Contact & Showroom Location</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-[10.5px] font-bold uppercase text-[#6F5963] mb-1">
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
                        <label className="block text-[10.5px] font-bold uppercase text-[#6F5963] mb-1">
                          Mobile Number (10 Digits) <span className="text-rose-500">*</span>
                        </label>
                        <div className="flex rounded-xl border border-[#E8D9D4] bg-[#FFFAF7] overflow-hidden focus-within:border-[#B76E79]">
                          <span className="px-3 py-2.5 bg-[#F6E2E5]/50 border-r border-[#E8D9D4] text-xs font-mono font-bold text-[#4A173A] select-none">
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
                            className="flex-1 px-3 py-2.5 text-xs font-mono font-semibold text-[#2B1722] bg-transparent outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10.5px] font-bold uppercase text-[#6F5963] mb-1">
                          Alternate Mobile (Optional)
                        </label>
                        <div className="flex rounded-xl border border-[#E8D9D4] bg-[#FFFAF7] overflow-hidden focus-within:border-[#B76E79]">
                          <span className="px-3 py-2.5 bg-[#F6E2E5]/50 border-r border-[#E8D9D4] text-xs font-mono font-bold text-[#4A173A] select-none">
                            +91
                          </span>
                          <input
                            type="tel"
                            inputMode="numeric"
                            maxLength={10}
                            value={editForm.alternate_mobile}
                            onChange={(e) => setEditForm({ ...editForm, alternate_mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                            placeholder="Optional alternate mobile"
                            className="flex-1 px-3 py-2.5 text-xs font-mono font-semibold text-[#2B1722] bg-transparent outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10.5px] font-bold uppercase text-[#6F5963] mb-1">
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
                        <label className="block text-[10.5px] font-bold uppercase text-[#6F5963] mb-1">
                          Store Location Showroom <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={editForm.location_id}
                          onChange={(e) => setEditForm({ ...editForm, location_id: Number(e.target.value) })}
                          className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-xs text-[#4A173A] focus:outline-none focus:border-[#B76E79]"
                        >
                          {STORE_LOCATIONS_LIST.map((loc) => (
                            <option key={loc.id} value={loc.id}>
                              {loc.storeName} ({loc.city})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10.5px] font-bold uppercase text-[#6F5963] mb-1">
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
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#4A173A] pb-1 border-b border-[#E8D9D4]/60">
                      <Heart className="w-3.5 h-3.5 text-[#B76E79]" />
                      <span>Wedding & Shopping Details</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-[10.5px] font-bold uppercase text-[#6F5963] mb-1">
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
                        <label className="block text-[10.5px] font-bold uppercase text-[#6F5963] mb-1">
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
                        <label className="block text-[10.5px] font-bold uppercase text-[#6F5963] mb-1">
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
                        <label className="block text-[10.5px] font-bold uppercase text-[#6F5963] mb-1">
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
                        <label className="block text-[10.5px] font-bold uppercase text-[#6F5963] mb-1">
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
                        <label className="block text-[10.5px] font-bold uppercase text-[#6F5963] mb-1">
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
                        <label className="block text-[10.5px] font-bold uppercase text-[#6F5963] mb-1">
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
                        <label className="block text-[10.5px] font-bold uppercase text-[#6F5963] mb-1">
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

                  {/* Section 3: Telecalling & Notes */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#4A173A] pb-1 border-b border-[#E8D9D4]/60">
                      <PhoneCall className="w-3.5 h-3.5 text-[#B76E79]" />
                      <span>Telecaller Follow-up & Special Notes</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-[10.5px] font-bold uppercase text-[#6F5963] mb-1">
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
                      <label className="block text-[10.5px] font-bold uppercase text-[#6F5963] mb-1">
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

                  {/* Modal Footer */}
                  <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#E8D9D4] shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditModalOpen(false)}
                      disabled={savingEdit}
                      className="px-4 py-2.5 rounded-xl bg-[#FFFAF7] hover:bg-[#FFF7F2] border border-[#E8D9D4] font-semibold text-xs text-[#4A173A] transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingEdit}
                      className="px-6 py-2.5 rounded-xl bg-[#4A173A] hover:bg-[#6A2853] text-white font-semibold text-xs shadow-md border border-[#B76E79]/30 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
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
                </form>
              </div>
            </div>
          )}

          {/* Move to Old Customers Modal */}
          {archiveModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
              <div className="bg-[#FFFDFC] border border-[#E8D9D4] rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                    <Archive className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#4A173A]">Move Customer to Old Customers?</h3>
                    <p className="text-xs text-[#6F5963]">
                      The customer record and complete history will remain permanently available in the Old Customers section.
                    </p>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
                  <p className="font-semibold">{customer.customer_name} ({customer.customer_code})</p>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    This action updates the lifecycle status to <strong>OLD_CUSTOMER</strong>. No customer or call history records will be deleted.
                  </p>
                </div>

                <form onSubmit={handleMoveToOld} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-[#6F5963] uppercase tracking-wider mb-1.5">
                      Archive Reason / Note (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={archiveReason}
                      onChange={(e) => setArchiveReason(e.target.value)}
                      placeholder="e.g. Wedding shopping completed, relocated, or historical lead"
                      className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl text-xs text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-2">
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
                      disabled={savingArchive}
                      className="px-5 py-2 rounded-xl bg-[#4A173A] hover:bg-[#6A2853] text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {savingArchive ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Moving Customer...</span>
                        </>
                      ) : (
                        <>
                          <Archive className="w-3.5 h-3.5" />
                          <span>Move Customer</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Restore Customer Modal */}
          {restoreModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
              <div className="bg-[#FFFDFC] border border-[#E8D9D4] rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#4A173A]">Restore Customer?</h3>
                    <p className="text-xs text-[#6F5963]">
                      Return this customer to the active Wedding Customer Register.
                    </p>
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900">
                  <p className="font-semibold">{customer.customer_name} ({customer.customer_code})</p>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    The customer's previous status ({(customer as any).previous_status || 'New Lead'}), call history, and requirements will be restored without creating any duplicate records.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
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
                    {savingRestore ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Restoring Customer...</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore Customer</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </PageContainer>
    </DashboardLayout>
  );
}
