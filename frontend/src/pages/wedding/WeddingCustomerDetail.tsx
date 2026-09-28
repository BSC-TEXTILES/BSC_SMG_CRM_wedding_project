import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import PageContainer from '../../components/ui/PageContainer';
import ToastContainer, { showToast } from '../../components/Toast';
import { API, Auth, UserSession } from '../../services/api';
import WeddingNav from './WeddingNav';
import {
  WeddingCustomer,
  CallLog,
  CUSTOMER_STATUSES,
  CALL_OUTCOMES,
  getStatusBadge
} from './weddingTypes';
import {
  User,
  Heart,
  Calendar,
  Clock,
  PhoneCall,
  MapPin,
  MessageCircle,
  FileText,
  History,
  TrendingUp,
  ShoppingBag,
  Sparkles,
  ArrowLeft,
  Edit2,
  CircleCheck,
  Plus,
  X,
  CircleAlert,
  RefreshCw,
  Award,
  Users,
  ExternalLink
} from 'lucide-react';

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
              { label: 'Customer Register', href: '/wedding-crm/customers' },
              { label: customer.customer_code }
            ]}
            actions={
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <Link
                  to="/wedding-crm/customers"
                  className="px-3 py-2 bg-[#FFFDFC] hover:bg-[#FFF7F2] border border-[#E8D9D4] rounded-xl text-xs font-semibold text-[#4A173A] flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </Link>

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
              </div>
            }
          />

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
            {customer.wedding_date && (
              <div className="bg-[#F6E2E5] border border-[#E8D9D4] rounded-2xl p-3 sm:px-5 flex items-center gap-3 text-[#4A173A]">
                <Heart className="w-6 h-6 text-[#B76E79] flex-shrink-0" />
                <div>
                  <div className="text-[10px] font-bold uppercase text-[#6F5963]">Wedding Date</div>
                  <div className="text-sm font-bold text-[#4A173A]">{new Date(customer.wedding_date).toLocaleDateString()}</div>
                </div>
                {(() => {
                  const diffDays = Math.ceil(
                    (new Date(customer.wedding_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
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
                <div className="flex items-center gap-2 font-bold text-sm text-[#4A173A] border-b border-[#E8D9D4] pb-2">
                  <User className="w-4 h-4 text-[#B76E79]" />
                  <span>Customer Details</span>
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
                      {customer.created_at ? new Date(customer.created_at).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 2: Wedding & Shopping Details */}
              <div className="bg-[#FFFDFC] p-5 rounded-3xl border border-[#E8D9D4] shadow-xs space-y-3 text-xs">
                <div className="flex items-center gap-2 font-bold text-sm text-[#4A173A] border-b border-[#E8D9D4] pb-2">
                  <Heart className="w-4 h-4 text-[#B76E79]" />
                  <span>Wedding & Shopping Information</span>
                </div>
                <div className="space-y-2">
                  {customer.wedding_date ? (
                    <div className="flex justify-between">
                      <span className="text-[#6F5963]">Wedding Date:</span>
                      <strong className="text-[#B76E79]">
                        {new Date(customer.wedding_date).toLocaleDateString()}
                      </strong>
                    </div>
                  ) : null}
                  <div className="flex justify-between">
                    <span className="text-[#6F5963]">Expected Shopping:</span>
                    <strong className="text-[#4A173A]">
                      {customer.expected_shopping_date ? new Date(customer.expected_shopping_date).toLocaleDateString() : 'TBD'}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6F5963]">Category:</span>
                    <strong className="text-[#2B1722]">{customer.preferred_shopping_category || 'General Wedding'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6F5963]">Budget Range:</span>
                    <strong className="text-[#198754]">{customer.budget || 'Not Decided'}</strong>
                  </div>
                  {customer.estimated_family_size ? (
                    <div className="flex justify-between">
                      <span className="text-[#6F5963]">Family Size:</span>
                      <strong className="text-[#2B1722]">{customer.estimated_family_size} members</strong>
                    </div>
                  ) : null}
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
                      {customer.follow_up_date ? new Date(customer.follow_up_date).toLocaleDateString() : 'None'}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6F5963]">Preferred Call Time:</span>
                    <span className="text-[#2B1722] font-medium">{customer.preferred_call_time || 'Any Time'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6F5963]">Total Calls Made:</span>
                    <strong className="text-[#4A173A]">{customer.total_calls_count || callLogs.length}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6F5963]">Last Call Outcome:</span>
                    <strong className="text-[#4A173A]">{customer.last_call_outcome || 'Pending First Call'}</strong>
                  </div>
                </div>
              </div>
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

                      {log.next_follow_up_date && (
                        <div className="text-[11px] text-[#C58A18] font-bold">
                          Next follow-up scheduled for: {new Date(log.next_follow_up_date).toLocaleDateString()} ({log.next_follow_up_time || 'Any Time'})
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
                        {n.created_by || 'Staff'} · {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
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
                        <div>{sh.created_at ? new Date(sh.created_at).toLocaleDateString() : ''}</div>
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
                        Reg ID: <strong className="text-[#4A173A]">{customer.customer_code}</strong> · Wedding Date: <strong>{customer.wedding_date ? new Date(customer.wedding_date).toLocaleDateString() : 'TBD'}</strong> · Telecaller: <strong>{customer.assigned_telecaller || 'Unassigned'}</strong>
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
                          {reg.wedding_date && (
                            <span>Wedding Date: <strong className="text-[#B76E79]">{new Date(reg.wedding_date).toLocaleDateString()}</strong></span>
                          )}
                          {reg.bride_name && <span>Bride: <strong>{reg.bride_name}</strong></span>}
                          {reg.groom_name && <span>Groom: <strong>{reg.groom_name}</strong></span>}
                          {reg.wedding_venue && <span>Venue: <strong>{reg.wedding_venue}</strong></span>}
                          {reg.location_name && <span>Store: <strong>{reg.location_name}</strong></span>}
                        </div>
                      </div>
                      <div className="text-[11px] text-[#6F5963] text-right">
                        Registered: {new Date(reg.created_at).toLocaleDateString()}
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
                          {cust.wedding_date && (
                            <span>Wedding Date: <strong className="text-[#B76E79]">{new Date(cust.wedding_date).toLocaleDateString()}</strong></span>
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
        </div>
      </PageContainer>
    </DashboardLayout>
  );
}
