import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import ToastContainer, { showToast } from '../../components/Toast';
import { API, Auth, UserSession } from '../../services/api';
import { getSidebarCollapsed, subscribeSidebarCollapsed } from '../../utils/sidebarState';
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(getSidebarCollapsed());

  useEffect(() => {
    return subscribeSidebarCollapsed(setCollapsed);
  }, []);

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

      showToast('Call logged and recorded successfully', 'success');
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
      showToast(`Status updated to "${newStatus}"`, 'success');
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
      showToast('Note added successfully', 'success');
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
      <div className="min-h-screen bg-[#F6F4EF] flex items-center justify-center">
        <div className="flex items-center gap-2 text-xs font-bold text-primary">
          <RefreshCw className="w-5 h-5 animate-spin text-[#C9A45C]" />
          Loading wedding customer profile...
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-[#F6F4EF] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl border border-[#DFDDD7] text-center max-w-md space-y-4">
          <CircleAlert className="w-10 h-10 text-[#C7374A] mx-auto" />
          <h2 className="text-lg font-black text-[#182033]">Customer Not Found</h2>
          <p className="text-xs text-muted">
            The requested customer profile does not exist or you do not have permission to view it.
          </p>
          <Link
            to="/wedding-crm/customers"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#101C36] text-[#C9A45C] font-bold rounded-xl text-xs"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Customer Register
          </Link>
        </div>
      </div>
    );
  }

  const badge = getStatusBadge(customer.customer_status);

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
          title={customer ? `Customer Profile: ${customer.customer_name}` : 'Customer Details'}
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto space-y-6">
          <ToastContainer />

          <WeddingNav
            currentPageTitle={customer.customer_name}
            breadcrumbs={[
              { label: 'Customer Register', href: '/wedding-crm/customers' },
              { label: customer.customer_code }
            ]}
            actions={
              <div className="flex items-center gap-2">
                <Link
                  to="/wedding-crm/customers"
                  className="px-3 py-2 bg-white hover:bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl text-xs font-bold text-[#182033] flex items-center gap-1.5 transition-colors"
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
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-all"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Log Call</span>
                </button>

                <a
                  href={`https://wa.me/91${customer.mobile_number.replace(/\D/g, '')}?text=Namaste%20${encodeURIComponent(customer.customer_name)}%2C%20greetings%20from%20BSC%20Exclusive%20Textiles!`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>

                <button
                  onClick={handleOpenReassign}
                  className="px-3.5 py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors"
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
                  className="px-3.5 py-2 bg-[#101C36] hover:bg-[#07101F] text-[#C9A45C] font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md border border-[#C9A45C]/30"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Update Status</span>
                </button>
              </div>
            }
          />

          {/* Customer Header Card */}
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#DFDDD7] shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#101C36] text-[#C9A45C] font-black text-xl flex items-center justify-center border border-[#C9A45C]/30 shadow-md">
                {customer.customer_name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl sm:text-2xl font-black text-[#182033]">
                    {customer.customer_name}
                  </h2>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${badge.bg}`}>
                    {customer.customer_status}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted font-semibold mt-1">
                  <span>Reg ID: <strong className="text-[#101C36]">{customer.customer_code}</strong></span>
                  <span>·</span>
                  <span>📱 {customer.mobile_number}</span>
                  <span>·</span>
                  <span>📍 {customer.location_name || 'Store'}</span>
                  <span>·</span>
                  <span>Telecaller: <strong className="text-primary">{customer.assigned_telecaller || 'Unassigned'}</strong></span>
                </div>
              </div>
            </div>

            {/* Wedding Countdown Pill */}
            {customer.wedding_date && (
              <div className="bg-pink-50 border border-pink-200 rounded-2xl p-3 sm:px-5 flex items-center gap-3 text-pink-900">
                <Heart className="w-6 h-6 text-pink-600 flex-shrink-0" />
                <div>
                  <div className="text-[10px] font-black uppercase text-pink-700">Wedding Date</div>
                  <div className="text-sm font-black">{new Date(customer.wedding_date).toLocaleDateString()}</div>
                </div>
                {(() => {
                  const diffDays = Math.ceil(
                    (new Date(customer.wedding_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                  );
                  return diffDays > 0 ? (
                    <div className="ml-auto pl-3 border-l border-pink-200 text-right">
                      <div className="text-base font-black text-pink-700">{diffDays}</div>
                      <div className="text-[9px] uppercase font-bold text-pink-500">Days Left</div>
                    </div>
                  ) : null;
                })()}
              </div>
            )}
          </div>

          {/* Tabs Bar */}
          <div className="flex items-center gap-2 border-b border-[#DFDDD7] pb-2 text-xs font-bold">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-xl transition-all ${
                activeTab === 'overview'
                  ? 'bg-[#101C36] text-[#C9A45C] shadow-md'
                  : 'bg-white text-muted hover:text-primary border border-[#DFDDD7]'
              }`}
            >
              Overview & Requirements
            </button>
            <button
              onClick={() => setActiveTab('calls')}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === 'calls'
                  ? 'bg-[#101C36] text-[#C9A45C] shadow-md'
                  : 'bg-white text-muted hover:text-primary border border-[#DFDDD7]'
              }`}
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Call History ({callLogs.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === 'notes'
                  ? 'bg-[#101C36] text-[#C9A45C] shadow-md'
                  : 'bg-white text-muted hover:text-primary border border-[#DFDDD7]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Notes & Preferences</span>
            </button>
            <button
              onClick={() => setActiveTab('status_history')}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === 'status_history'
                  ? 'bg-[#101C36] text-[#C9A45C] shadow-md'
                  : 'bg-white text-muted hover:text-primary border border-[#DFDDD7]'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Status Audit History</span>
            </button>
            <button
              onClick={() => setActiveTab('associated_weddings')}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === 'associated_weddings'
                  ? 'bg-[#101C36] text-[#C9A45C] shadow-md'
                  : 'bg-white text-muted hover:text-primary border border-[#DFDDD7]'
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
              <div className="bg-white p-5 rounded-3xl border border-[#DFDDD7] shadow-xs space-y-3 text-xs">
                <div className="flex items-center gap-2 font-black text-sm text-[#182033] border-b border-[#DFDDD7] pb-2">
                  <User className="w-4 h-4 text-[#C9A45C]" />
                  <span>Customer Details</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted">Full Name:</span>
                    <strong className="text-primary">{customer.customer_name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Mobile Number:</span>
                    <strong className="text-primary">{customer.mobile_number}</strong>
                  </div>
                  {customer.email && (
                    <div className="flex justify-between">
                      <span className="text-muted">Email:</span>
                      <span className="text-primary font-medium">{customer.email}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted">Store Location:</span>
                    <span className="text-primary font-bold">{customer.location_name || 'Store'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Lead Source:</span>
                    <span className="text-primary font-medium">{customer.lead_source || 'In-store Walkin'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Registration Date:</span>
                    <span className="text-primary font-medium">
                      {customer.created_at ? new Date(customer.created_at).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 2: Wedding & Shopping Details */}
              <div className="bg-white p-5 rounded-3xl border border-[#DFDDD7] shadow-xs space-y-3 text-xs">
                <div className="flex items-center gap-2 font-black text-sm text-[#182033] border-b border-[#DFDDD7] pb-2">
                  <Heart className="w-4 h-4 text-pink-600" />
                  <span>Wedding & Shopping Information</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted">Wedding Date:</span>
                    <strong className="text-pink-700">
                      {customer.wedding_date ? new Date(customer.wedding_date).toLocaleDateString() : 'TBD'}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Expected Shopping:</span>
                    <strong className="text-blue-800">
                      {customer.expected_shopping_date ? new Date(customer.expected_shopping_date).toLocaleDateString() : 'TBD'}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Category:</span>
                    <strong className="text-primary">{customer.preferred_shopping_category || 'General Wedding'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Budget Range:</span>
                    <strong className="text-emerald-700">{customer.budget || 'Not Decided'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Family Size:</span>
                    <strong className="text-primary">{customer.estimated_family_size || 2} members</strong>
                  </div>
                </div>
              </div>

              {/* Section 3: Follow-up & Telecaller Desk */}
              <div className="bg-white p-5 rounded-3xl border border-[#DFDDD7] shadow-xs space-y-3 text-xs">
                <div className="flex items-center gap-2 font-black text-sm text-[#182033] border-b border-[#DFDDD7] pb-2">
                  <PhoneCall className="w-4 h-4 text-[#C98218]" />
                  <span>Follow-up & Telecaller Desk</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted">Assigned Telecaller:</span>
                    <strong className="text-primary">{customer.assigned_telecaller || 'Unassigned'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Next Follow-up Date:</span>
                    <strong className="text-amber-800">
                      {customer.follow_up_date ? new Date(customer.follow_up_date).toLocaleDateString() : 'None'}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Preferred Call Time:</span>
                    <span className="text-primary font-medium">{customer.preferred_call_time || 'Any Time'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Total Calls Made:</span>
                    <strong className="text-primary">{customer.total_calls_count || callLogs.length}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Last Call Outcome:</span>
                    <strong className="text-primary">{customer.last_call_outcome || 'Pending First Call'}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CALL HISTORY */}
          {activeTab === 'calls' && (
            <div className="bg-white rounded-3xl border border-[#DFDDD7] shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-[#182033] uppercase tracking-wider">
                  Call & Follow-up Logs ({callLogs.length})
                </h3>
                <button
                  onClick={() => setCallModalOpen(true)}
                  className="px-3.5 py-1.5 bg-[#101C36] text-[#C9A45C] font-bold rounded-xl text-xs flex items-center gap-1 shadow-xs border border-[#C9A45C]/30"
                >
                  <Plus className="w-3.5 h-3.5" /> Log Call
                </button>
              </div>

              {callLogs.length === 0 ? (
                <div className="text-center py-10 text-muted text-xs">
                  No call logs recorded for this customer yet. Click "Log Call" to record the first contact.
                </div>
              ) : (
                <div className="space-y-3">
                  {callLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-4 rounded-2xl bg-[#F6F4EF] border border-[#DFDDD7] text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-primary">{log.call_outcome}</span>
                          <span className="text-muted">·</span>
                          <span className="text-muted font-semibold">
                            By {log.telecaller_name || 'Telecaller'}
                          </span>
                        </div>
                        <div className="text-muted font-bold text-[11px]">
                          {log.call_date} {log.call_time}
                        </div>
                      </div>

                      {log.remarks && (
                        <p className="text-gray-800 bg-white p-2.5 rounded-xl border border-[#DFDDD7] italic">
                          "{log.remarks}"
                        </p>
                      )}

                      {log.next_follow_up_date && (
                        <div className="text-[11px] text-amber-800 font-bold">
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
            <div className="bg-white rounded-3xl border border-[#DFDDD7] shadow-xs p-5 space-y-5">
              <h3 className="text-sm font-black text-[#182033] uppercase tracking-wider">
                Customer Notes & Preferences
              </h3>

              <form onSubmit={handleAddNote} className="space-y-3">
                <textarea
                  rows={3}
                  placeholder="Add a new customer requirement, preference (e.g. Kanjeevaram pure silk, budget notes)..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="w-full p-3 bg-[#F6F4EF] border border-[#DFDDD7] rounded-2xl text-xs focus:outline-none focus:border-[#C9A45C]"
                />
                <button
                  type="submit"
                  disabled={savingNote || !noteText.trim()}
                  className="px-4 py-2 bg-[#101C36] text-[#C9A45C] font-black rounded-xl text-xs shadow-md border border-[#C9A45C]/30 disabled:opacity-40"
                >
                  {savingNote ? 'Saving...' : 'Add Note'}
                </button>
              </form>

              {notes.length === 0 && !customer.customer_notes ? (
                <div className="text-center py-6 text-muted text-xs">No notes recorded yet.</div>
              ) : (
                <div className="space-y-2.5 pt-3 border-t border-[#DFDDD7]">
                  {customer.customer_notes && (
                    <div className="p-3 bg-[#F6F4EF] rounded-xl border border-[#DFDDD7] text-xs">
                      <div className="text-[10px] uppercase font-bold text-muted mb-1">Registration Note</div>
                      <p className="text-primary italic">{customer.customer_notes}</p>
                    </div>
                  )}
                  {notes.map((n: any, idx: number) => (
                    <div key={idx} className="p-3 bg-[#F6F4EF] rounded-xl border border-[#DFDDD7] text-xs space-y-1">
                      <p className="text-primary">{n.note || n.details}</p>
                      <div className="text-[10px] text-muted font-bold">
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
            <div className="bg-white rounded-3xl border border-[#DFDDD7] shadow-xs p-5 space-y-4">
              <h3 className="text-sm font-black text-[#182033] uppercase tracking-wider">
                Status Transitions & Audit Trail
              </h3>

              {statusHistory.length === 0 ? (
                <div className="text-center py-8 text-muted text-xs">
                  Initial lead status is "{customer.customer_status}". No further status transitions logged.
                </div>
              ) : (
                <div className="space-y-3">
                  {statusHistory.map((sh: any, idx: number) => (
                    <div key={idx} className="p-3 bg-[#F6F4EF] rounded-xl border border-[#DFDDD7] text-xs flex items-center justify-between">
                      <div>
                        <div className="font-bold text-primary">
                          Changed to <span className="text-[#C98218]">{sh.new_status}</span>
                        </div>
                        {sh.change_reason && <p className="text-muted mt-0.5">{sh.change_reason}</p>}
                      </div>
                      <div className="text-right text-[10px] text-muted font-bold">
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
            <div className="bg-white rounded-3xl border border-[#DFDDD7] shadow-xs p-5 space-y-6">
              <div>
                <h3 className="text-sm font-black text-[#182033] uppercase tracking-wider">
                  Associated Wedding Registrations for Mobile: {customer.mobile_number}
                </h3>
                <p className="text-xs text-muted mt-1">
                  Families often plan multiple weddings (e.g. son, daughter, sibling). All wedding registrations registered under this mobile number are tracked here independently.
                </p>
              </div>

              {associatedRegistrations.length === 0 && associatedCustomers.length === 0 ? (
                <div className="text-center py-10 bg-[#F6F4EF] rounded-2xl border border-[#DFDDD7] text-muted text-xs">
                  This customer currently has one active wedding registration ({customer.customer_code}). Future wedding registrations with this mobile number will appear here automatically.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Active Primary Record Banner */}
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-[#101C36] text-sm">{customer.customer_name}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#101C36] text-[#C9A45C]">Current Active Record</span>
                      </div>
                      <div className="text-muted text-[11px] mt-1">
                        Reg ID: <strong className="text-[#101C36]">{customer.customer_code}</strong> · Wedding Date: <strong>{customer.wedding_date ? new Date(customer.wedding_date).toLocaleDateString() : 'TBD'}</strong> · Telecaller: <strong>{customer.assigned_telecaller || 'Unassigned'}</strong>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-amber-900 bg-amber-100 px-3 py-1 rounded-xl">
                      Status: {customer.customer_status}
                    </span>
                  </div>

                  {/* List of other registrations */}
                  {associatedRegistrations.map((reg) => (
                    <div
                      key={reg.id}
                      className="p-4 rounded-2xl bg-[#F6F4EF] border border-[#DFDDD7] hover:border-primary/40 transition-all text-xs flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#182033] text-sm">{reg.customer_name}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                            Reg ID: {reg.registration_id}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-200 text-gray-800">
                            {reg.status || 'New'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted text-[11px]">
                          {reg.wedding_date && (
                            <span>Wedding Date: <strong className="text-pink-700">{new Date(reg.wedding_date).toLocaleDateString()}</strong></span>
                          )}
                          {reg.bride_name && <span>Bride: <strong>{reg.bride_name}</strong></span>}
                          {reg.groom_name && <span>Groom: <strong>{reg.groom_name}</strong></span>}
                          {reg.wedding_venue && <span>Venue: <strong>{reg.wedding_venue}</strong></span>}
                          {reg.location_name && <span>Store: <strong>{reg.location_name}</strong></span>}
                        </div>
                      </div>
                      <div className="text-[11px] text-muted text-right">
                        Registered: {new Date(reg.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}

                  {/* Other CRM Customer records if any */}
                  {associatedCustomers.map((cust) => (
                    <div
                      key={cust.id}
                      className="p-4 rounded-2xl bg-[#F6F4EF] border border-[#DFDDD7] hover:border-primary/40 transition-all text-xs flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#182033] text-sm">{cust.customer_name}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                            CRM Code: {cust.customer_code}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-200 text-gray-800">
                            {cust.customer_status}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted text-[11px]">
                          {cust.wedding_date && (
                            <span>Wedding Date: <strong className="text-pink-700">{new Date(cust.wedding_date).toLocaleDateString()}</strong></span>
                          )}
                          {cust.location_name && <span>Store: <strong>{cust.location_name}</strong></span>}
                          <span>Telecaller: <strong>{cust.assigned_telecaller || 'Unassigned'}</strong></span>
                        </div>
                      </div>
                      <Link
                        to={`/wedding-crm/customers/${cust.id}`}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-gray-100 border border-[#DFDDD7] text-xs font-bold text-[#182033] flex items-center gap-1"
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
              <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#DFDDD7] space-y-4 animate-scale-in">
                <div className="flex items-center justify-between pb-3 border-b border-[#DFDDD7]">
                  <h3 className="text-base font-black text-[#182033]">
                    Log Call: {customer.customer_name}
                  </h3>
                  <button onClick={() => setCallModalOpen(false)} className="p-1 text-muted hover:bg-[#F6F4EF] rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveCall} className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-muted mb-1">
                        Call Outcome *
                      </label>
                      <select
                        value={callForm.call_outcome}
                        onChange={(e) => setCallForm({ ...callForm, call_outcome: e.target.value })}
                        className="w-full px-3 py-2 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-bold"
                      >
                        {CALL_OUTCOMES.map((out) => (
                          <option key={out} value={out}>
                            {out}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-muted mb-1">
                        Next Follow-up Date
                      </label>
                      <input
                        type="date"
                        value={callForm.next_follow_up_date}
                        onChange={(e) => setCallForm({ ...callForm, next_follow_up_date: e.target.value })}
                        className="w-full px-3 py-2 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-muted mb-1">
                        Preferred Call Time
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 11 AM"
                        value={callForm.next_follow_up_time}
                        onChange={(e) => setCallForm({ ...callForm, next_follow_up_time: e.target.value })}
                        className="w-full px-3 py-2 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-muted mb-1">
                        Expected Shopping Date
                      </label>
                      <input
                        type="date"
                        value={callForm.expected_shopping_date}
                        onChange={(e) => setCallForm({ ...callForm, expected_shopping_date: e.target.value })}
                        className="w-full px-3 py-2 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-muted mb-1">
                      Call Notes & Customer Response
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Notes from customer call..."
                      value={callForm.remarks}
                      onChange={(e) => setCallForm({ ...callForm, remarks: e.target.value })}
                      className="w-full px-3 py-2 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-medium"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#DFDDD7]">
                    <button
                      type="button"
                      onClick={() => setCallModalOpen(false)}
                      className="px-4 py-2 rounded-xl bg-[#F6F4EF] hover:bg-[#DFDDD7] font-bold text-[#182033]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingCall}
                      className="px-5 py-2 rounded-xl bg-[#101C36] hover:bg-[#07101F] text-[#C9A45C] font-black shadow-md border border-[#C9A45C]/30"
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
              <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-[#DFDDD7] space-y-4 animate-scale-in">
                <div className="flex items-center justify-between pb-3 border-b border-[#DFDDD7]">
                  <h3 className="text-base font-black text-[#182033]">Update Customer Status</h3>
                  <button onClick={() => setStatusModalOpen(false)} className="p-1 text-muted hover:bg-[#F6F4EF] rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveStatus} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-muted mb-1">
                      New Status *
                    </label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="w-full px-3 py-2 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-bold"
                    >
                      {CUSTOMER_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-muted mb-1">
                      Reason / Remarks
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Why is the status transitioning?"
                      value={statusReason}
                      onChange={(e) => setStatusReason(e.target.value)}
                      className="w-full px-3 py-2 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-medium"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#DFDDD7]">
                    <button
                      type="button"
                      onClick={() => setStatusModalOpen(false)}
                      className="px-4 py-2 rounded-xl bg-[#F6F4EF] hover:bg-[#DFDDD7] font-bold text-[#182033]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingStatus || !newStatus}
                      className="px-5 py-2 rounded-xl bg-[#101C36] hover:bg-[#07101F] text-[#C9A45C] font-black shadow-md border border-[#C9A45C]/30 disabled:opacity-40"
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
              <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#DFDDD7] space-y-4 animate-scale-in">
                <div className="flex items-center justify-between pb-3 border-b border-[#DFDDD7]">
                  <div>
                    <h3 className="text-base font-black text-[#182033]">Reassign Telecaller</h3>
                    <p className="text-xs text-muted">Customer: {customer.customer_name} ({customer.customer_code})</p>
                  </div>
                  <button onClick={() => setReassignModalOpen(false)} className="p-1 text-muted hover:bg-[#F6F4EF] rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveReassign} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-muted mb-1">
                      Currently Assigned
                    </label>
                    <div className="p-2.5 bg-[#F6F4EF] rounded-xl border border-[#DFDDD7] font-bold text-[#182033]">
                      {customer.assigned_telecaller || 'Unassigned'}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-muted mb-1">
                      Select New Telecaller / CRM Staff *
                    </label>
                    <select
                      value={selectedTelecallerId}
                      onChange={(e) => setSelectedTelecallerId(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-bold text-sm text-[#182033]"
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

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#DFDDD7]">
                    <button
                      type="button"
                      onClick={() => setReassignModalOpen(false)}
                      className="px-4 py-2 rounded-xl bg-[#F6F4EF] hover:bg-[#DFDDD7] font-bold text-[#182033]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingReassign || !selectedTelecallerId}
                      className="px-5 py-2 rounded-xl bg-[#101C36] hover:bg-[#07101F] text-[#C9A45C] font-black shadow-md border border-[#C9A45C]/30 disabled:opacity-40 flex items-center gap-1.5"
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
        </main>
      </div>
    </div>
  );
}
