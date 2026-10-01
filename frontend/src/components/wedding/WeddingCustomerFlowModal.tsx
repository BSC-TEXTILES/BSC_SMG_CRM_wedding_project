import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { API } from '../../services/api';
import { parseDate, formatDateDisplay, formatDateTimeDisplay } from '../../utils/dateUtils';
import { getStatusBadge, CALL_OUTCOMES, CALL_STATUSES, WEDDING_STATUSES, CALL_TIMES, ARCHIVE_SUCCESS_MESSAGE, ARCHIVE_READONLY_MESSAGE } from '../../pages/wedding/weddingTypes';
import { showToast } from '../Toast';
import {
  X,
  PhoneCall,
  Calendar,
  Sparkles,
  MapPin,
  Clock,
  UserCheck,
  CheckCircle2,
  FileText,
  TrendingUp,
  ExternalLink,
  MessageCircle,
  PlusCircle,
  RefreshCw,
  ShoppingBag,
  Award,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';

export interface WeddingCustomerFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId?: number | string | null;
  initialCustomer?: any;
  onFlowUpdated?: (data?: any) => void;
}

export default function WeddingCustomerFlowModal({
  isOpen,
  onClose,
  customerId,
  initialCustomer,
  onFlowUpdated
}: WeddingCustomerFlowModalProps) {
  const [loading, setLoading] = useState(false);
  const [customer, setCustomer] = useState<any>(initialCustomer || null);
  const [callLogs, setCallLogs] = useState<any[]>([]);
  const [statusHistory, setStatusHistory] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);

  // Track newly added live steps in this session
  const [recentSteps, setRecentSteps] = useState<any[]>([]);

  // Active action tab for adding a step
  const [actionTab, setActionTab] = useState<'call' | 'status' | 'note'>('call');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [callForm, setCallForm] = useState({
    call_outcome: 'Connected',
    call_status: 'Completed',
    remarks: '',
    customer_response: '',
    next_follow_up_date: '',
    next_follow_up_time: 'Morning (10 AM - 1 PM)',
    expected_shopping_date: ''
  });

  const [statusForm, setStatusForm] = useState({
    new_status: '',
    change_reason: ''
  });

  const [noteForm, setNoteForm] = useState({
    note: '',
    note_type: 'Requirement'
  });

  const loadProfile = useCallback(async () => {
    const id = customerId || initialCustomer?.id || initialCustomer?.customer_id;
    if (!id) return;

    setLoading(true);
    try {
      const [fullProfileRes, custRes] = await Promise.all([
        API.getWeddingFullProfile(id).catch(() => null),
        API.getWeddingCustomerById(id).catch(() => null)
      ]);

      const custData = fullProfileRes?.customer || custRes?.customer || custRes?.data || initialCustomer;
      setCustomer(custData);

      const logs = fullProfileRes?.callLogs || custRes?.callLogs || [];
      setCallLogs(Array.isArray(logs) ? logs : []);

      const stHistory = fullProfileRes?.statusHistory || [];
      setStatusHistory(Array.isArray(stHistory) ? stHistory : []);

      const nts = fullProfileRes?.notes || [];
      setNotes(Array.isArray(nts) ? nts : []);

      const appts = fullProfileRes?.appointments || [];
      setAppointments(Array.isArray(appts) ? appts : []);

      if (custData?.customer_status) {
        setStatusForm(prev => ({ ...prev, new_status: custData.customer_status }));
      }
      if (custData?.expected_shopping_date) {
        setCallForm(prev => ({
          ...prev,
          expected_shopping_date: String(custData.expected_shopping_date).slice(0, 10),
          next_follow_up_date: custData.follow_up_date ? String(custData.follow_up_date).slice(0, 10) : ''
        }));
      }
    } catch (err: any) {
      showToast('Error loading customer journey flow: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [customerId, initialCustomer]);

  useEffect(() => {
    if (isOpen) {
      setRecentSteps([]);
      loadProfile();
    }
  }, [isOpen, loadProfile]);

  if (!isOpen) return null;

  const resolvedCustomer = customer || initialCustomer || {};
  const statusBadge = getStatusBadge(resolvedCustomer.customer_status || 'New');
  const targetId = resolvedCustomer.id || customerId || initialCustomer?.id || initialCustomer?.customer_id;

  // Build unified chronological timeline
  interface TimelineStep {
    id: string;
    type: 'registration' | 'assignment' | 'call' | 'status' | 'note' | 'appointment';
    title: string;
    timestamp: string;
    rawDate?: string;
    badge?: string;
    badgeColor?: string;
    actor?: string;
    content?: string;
    details?: Record<string, any>;
    isLive?: boolean;
  }

  const steps: TimelineStep[] = [];

  // 1. Newly created live steps in this session
  recentSteps.forEach((st) => {
    steps.push({
      ...st,
      isLive: true
    });
  });

  // 2. Call Logs
  callLogs.forEach((cl, i) => {
    const isSuccess = ['Connected', 'Shopping Confirmed', 'Won / Converted'].includes(cl.call_outcome);
    steps.push({
      id: `call-${cl.id || i}`,
      type: 'call',
      title: `Call Touchpoint: ${cl.call_outcome || 'Call Logged'}`,
      timestamp: `${cl.call_date || ''} ${cl.call_time || ''}`.trim() || cl.created_at || 'Recent',
      rawDate: cl.call_date || cl.created_at,
      badge: cl.call_outcome,
      badgeColor: isSuccess ? 'bg-[#E8F5EE] text-[#198754] border-[#198754]/30' : 'bg-[#FFF4D6] text-[#C58A18] border-[#C58A18]/30',
      actor: cl.telecaller_name || 'Telecaller Desk',
      content: cl.remarks || cl.customer_response || 'No specific conversation remarks noted.',
      details: {
        nextFollowUp: cl.next_follow_up_date ? `${formatDateDisplay(cl.next_follow_up_date)} (${cl.next_follow_up_time || 'Any Time'})` : null,
        updatedShoppingDate: cl.expected_shopping_date_updated ? formatDateDisplay(cl.expected_shopping_date_updated) : null
      }
    });
  });

  // 3. Status Transitions
  statusHistory.forEach((sh, i) => {
    steps.push({
      id: `status-${sh.id || i}`,
      type: 'status',
      title: `Status Progression: ${sh.new_status}`,
      timestamp: formatDateTimeDisplay(sh.created_at, 'Recorded'),
      rawDate: sh.created_at,
      badge: sh.new_status,
      badgeColor: 'bg-[#EDF3F0] text-[#082821] border-[#082821]/30',
      actor: sh.changed_by || 'Staff / System',
      content: sh.change_reason ? `Reason: ${sh.change_reason}` : `Customer status transitioned from ${sh.old_status || 'Initial'} to ${sh.new_status}.`
    });
  });

  // 4. Notes
  notes.forEach((nt, i) => {
    steps.push({
      id: `note-${nt.id || i}`,
      type: 'note',
      title: `Customer Requirement / Note`,
      timestamp: formatDateTimeDisplay(nt.created_at, 'Recorded'),
      rawDate: nt.created_at,
      badge: nt.note_type || 'General',
      badgeColor: 'bg-[#EDF3F0] text-[#123C35] border-[#E1DDD3]',
      actor: nt.created_by || 'Staff Member',
      content: nt.note_content || nt.note || nt.details || ''
    });
  });

  // 5. Appointments
  appointments.forEach((ap, i) => {
    steps.push({
      id: `appt-${ap.id || i}`,
      type: 'appointment',
      title: `Store Visit Scheduled`,
      timestamp: `${formatDateDisplay(ap.appointment_date)} ${ap.appointment_time || ''}`,
      rawDate: ap.appointment_date,
      badge: ap.appointment_status || 'Scheduled',
      badgeColor: 'bg-[#EDF3F0] text-[#C9A45C] border-[#C9A45C]/30',
      actor: ap.telecaller_name || 'Telecaller',
      content: ap.appointment_notes || 'Customer scheduled store visit for wedding shopping.'
    });
  });

  // 6. Registration Baseline Step (Initial Flow Origin)
  if (resolvedCustomer.created_at) {
    steps.push({
      id: 'reg-origin',
      type: 'registration',
      title: 'Wedding Customer Registration Created',
      timestamp: formatDateTimeDisplay(resolvedCustomer.created_at, 'Registered'),
      rawDate: resolvedCustomer.created_at,
      badge: resolvedCustomer.lead_source || 'Registered Lead',
      badgeColor: 'bg-[#F7F5F0] text-[#123C35] border-[#E1DDD3]',
      actor: resolvedCustomer.created_by || 'Registration Desk',
      content: resolvedCustomer.customer_notes
        ? `Customer registered at ${resolvedCustomer.location_name || 'BSC Textiles'}. Initial Note: "${resolvedCustomer.customer_notes}"`
        : `Customer registered at ${resolvedCustomer.location_name || 'BSC Textiles'}. Requirements: ${resolvedCustomer.preferred_shopping_category || 'General Wedding Shopping'}.`
    });
  }

  // Sort steps reverse-chronologically so newest updates are on top
  steps.sort((a, b) => {
    if (a.isLive && !b.isLive) return -1;
    if (!a.isLive && b.isLive) return 1;
    const dateA = a.rawDate ? new Date(a.rawDate).getTime() : 0;
    const dateB = b.rawDate ? new Date(b.rawDate).getTime() : 0;
    return dateB - dateA;
  });

  // Handle Log Call (Submits & Appends New Step)
  const handleLogCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId) return;

    setIsSubmitting(true);
    try {
      const now = new Date();
      const callDate = now.toISOString().slice(0, 10);
      const callTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      await API.logWeddingCall({
        customer_id: targetId,
        call_date: callDate,
        call_time: callTime,
        call_status: callForm.call_status,
        call_outcome: callForm.call_outcome,
        remarks: callForm.remarks || 'Follow-up discussion recorded',
        customer_response: callForm.customer_response || undefined,
        next_follow_up_date: callForm.next_follow_up_date || undefined,
        next_follow_up_time: callForm.next_follow_up_time || undefined,
        expected_shopping_date_updated: callForm.expected_shopping_date || undefined
      });

      // Instantly inject new step into live view
      const newStep: TimelineStep = {
        id: `live-call-${Date.now()}`,
        type: 'call',
        title: `Call Touchpoint: ${callForm.call_outcome}`,
        timestamp: `${callDate} ${callTime} (Just now)`,
        rawDate: now.toISOString(),
        badge: callForm.call_outcome,
        badgeColor: 'bg-[#E8F5EE] text-[#198754] border-[#198754]/30',
        actor: 'Current Staff',
        content: callForm.remarks || 'New call touchpoint recorded in customer flow.',
        details: {
          nextFollowUp: callForm.next_follow_up_date ? `${formatDateDisplay(callForm.next_follow_up_date)} (${callForm.next_follow_up_time})` : null,
          updatedShoppingDate: callForm.expected_shopping_date ? formatDateDisplay(callForm.expected_shopping_date) : null
        },
        isLive: true
      };

      setRecentSteps(prev => [newStep, ...prev]);
      showToast('New call step added to flow successfully!', 'success');

      // Reset form
      setCallForm(prev => ({
        ...prev,
        remarks: '',
        customer_response: ''
      }));

      // Notify parent to update Call History or Dashboard
      if (onFlowUpdated) onFlowUpdated();
    } catch (err: any) {
      showToast('Failed to save call step: ' + err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Update Status (Submits & Appends New Step)
  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId || !statusForm.new_status) return;

    setIsSubmitting(true);
    try {
      const res: any = await API.changeWeddingCustomerStatus(targetId, statusForm.new_status, statusForm.change_reason);
      if (res?.success === false) {
        showToast(res.message || 'Failed to update customer status', 'error');
        return;
      }

      const newStep: TimelineStep = {
        id: `live-status-${Date.now()}`,
        type: 'status',
        title: `Status Progression: ${statusForm.new_status}`,
        timestamp: 'Just now',
        rawDate: new Date().toISOString(),
        badge: statusForm.new_status,
        badgeColor: 'bg-[#EDF3F0] text-[#082821] border-[#082821]/30',
        actor: 'Current Staff',
        content: statusForm.change_reason ? `Reason: ${statusForm.change_reason}` : `Status advanced to ${statusForm.new_status}`,
        isLive: true
      };

      setRecentSteps(prev => [newStep, ...prev]);
      setCustomer((prev: any) => ({
        ...prev,
        customer_status: statusForm.new_status,
        ...(res?.archived ? { lifecycle_status: 'OLD_CUSTOMER', archived_at: new Date().toISOString() } : {})
      }));

      // A completion status archives the record permanently — say so explicitly.
      if (res?.archived || res?.lifecycle_status === 'OLD_CUSTOMER') {
        showToast(ARCHIVE_SUCCESS_MESSAGE, 'success');
      } else {
        showToast(`Status updated to "${statusForm.new_status}" and new step added!`, 'success');
      }

      setStatusForm(prev => ({ ...prev, change_reason: '' }));
      if (onFlowUpdated) onFlowUpdated();
    } catch (err: any) {
      // 409 OLD_CUSTOMER_READONLY — archived rows refuse status changes until restored.
      if (err?.status === 409 || err?.data?.code === 'OLD_CUSTOMER_READONLY') {
        showToast(err.message || ARCHIVE_READONLY_MESSAGE, 'error');
      } else {
        showToast(err.message || 'Failed to update customer status', 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Add Note (Submits & Appends New Step)
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId || !noteForm.note.trim()) return;

    setIsSubmitting(true);
    try {
      await API.createWeddingNote(targetId, {
        note: noteForm.note.trim(),
        note_type: noteForm.note_type
      });

      const newStep: TimelineStep = {
        id: `live-note-${Date.now()}`,
        type: 'note',
        title: `Customer Requirement / Preference Added`,
        timestamp: 'Just now',
        rawDate: new Date().toISOString(),
        badge: noteForm.note_type,
        badgeColor: 'bg-[#EDF3F0] text-[#123C35] border-[#E1DDD3]',
        actor: 'Current Staff',
        content: noteForm.note.trim(),
        isLive: true
      };

      setRecentSteps(prev => [newStep, ...prev]);
      showToast('New requirement step added to customer flow!', 'success');
      setNoteForm(prev => ({ ...prev, note: '' }));

      if (onFlowUpdated) onFlowUpdated();
    } catch (err: any) {
      showToast('Failed to add note: ' + err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const weddingDateObj = parseDate(resolvedCustomer.wedding_date);
  const daysUntilWedding = weddingDateObj
    ? Math.ceil((weddingDateObj.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const cleanPhone = (resolvedCustomer.mobile_number || resolvedCustomer.mobile || '').replace(/\D/g, '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-[#FFFFFF] w-full max-w-5xl rounded-3xl border border-[#E1DDD3] shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh] animate-scale-in">
        
        {/* Top Header */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-[#123C35] to-[#082821] text-white flex items-start justify-between relative shrink-0">
          <div className="space-y-1.5 pr-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/15 border border-white/20 text-[#E4CB92]">
                Wedding Customer Lifecycle Flow
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusBadge.bg}`}>
                {resolvedCustomer.customer_status || 'New'}
              </span>
              {resolvedCustomer.priority && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF4D6] text-[#C58A18] border border-[#C58A18]/20">
                  ★ {resolvedCustomer.priority} Priority
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-baseline gap-2.5 pt-0.5">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {resolvedCustomer.customer_name || 'Wedding Customer'}
              </h2>
              <span className="text-xs text-[#E4CB92] font-mono">
                ({resolvedCustomer.customer_code || resolvedCustomer.registration_id || 'BSC-WED'})
              </span>
            </div>

            {/* Quick Contact & Store metadata */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-white/80 pt-1">
              <span className="flex items-center gap-1 font-medium">
                📱 {resolvedCustomer.mobile_number || resolvedCustomer.mobile || '—'}
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#E4CB92]" />
                {resolvedCustomer.location_name || 'BSC Showroom'}
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-[#E4CB92]" />
                Telecaller: <strong className="text-white">{resolvedCustomer.assigned_telecaller || 'Unassigned'}</strong>
              </span>
            </div>
          </div>

          {/* Close & Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {targetId && (
              <Link
                to={`/wedding-crm/customers/${targetId}`}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white transition-colors"
                title="Open full customer profile"
              >
                <span>Full Profile</span>
                <ExternalLink className="w-3.5 h-3.5 text-[#E4CB92]" />
              </Link>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Close Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Customer Wedding Details Banner */}
        <div className="bg-[#EDF3F0] px-4 sm:px-6 py-3 border-b border-[#E1DDD3] grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs shrink-0">
          <div>
            <div className="text-[10px] font-bold uppercase text-[#65716C]">Bride / Groom</div>
            <div className="font-bold text-[#123C35] truncate mt-0.5">
              {resolvedCustomer.bride_name ? `👰 ${resolvedCustomer.bride_name}` : ''}
              {resolvedCustomer.bride_name && resolvedCustomer.groom_name ? ' · ' : ''}
              {resolvedCustomer.groom_name ? `🤵 ${resolvedCustomer.groom_name}` : (!resolvedCustomer.bride_name ? 'TBD' : '')}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase text-[#65716C]">Wedding Date</div>
            <div className="font-bold text-[#C9A45C] flex items-center gap-1 mt-0.5">
              <Calendar className="w-3.5 h-3.5 text-[#C9A45C]" />
              <span>{formatDateDisplay(resolvedCustomer.wedding_date, 'Date TBD')}</span>
              {daysUntilWedding !== null && daysUntilWedding > 0 && (
                <span className="text-[10px] text-[#C58A18] font-bold">({daysUntilWedding}d left)</span>
              )}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase text-[#65716C]">Expected Shopping</div>
            <div className="font-bold text-[#123C35] flex items-center gap-1 mt-0.5">
              <ShoppingBag className="w-3.5 h-3.5 text-[#C9A45C]" />
              <span>{formatDateDisplay(resolvedCustomer.expected_shopping_date, 'Not Decided')}</span>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase text-[#65716C]">Preferred Category</div>
            <div className="font-bold text-[#17201D] truncate mt-0.5">
              {resolvedCustomer.preferred_shopping_category || 'General Wedding'}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase text-[#65716C]">Budget Range</div>
            <div className="font-bold text-[#198754] mt-0.5">
              {resolvedCustomer.budget || resolvedCustomer.budget_range || 'Not Decided'}
            </div>
          </div>

          <div className="flex items-center gap-2 justify-end col-span-2 sm:col-span-1">
            {cleanPhone && (
              <a
                href={`https://wa.me/91${cleanPhone}?text=Namaste%20${encodeURIComponent(resolvedCustomer.customer_name || 'Customer')}%2C%20greetings%20from%20BSC%20Exclusive%20Textiles!`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 bg-[#198754] hover:bg-[#16805B] text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs transition-colors"
                title="Send WhatsApp message"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">WhatsApp</span>
              </a>
            )}
            <button
              onClick={loadProfile}
              disabled={loading}
              className="p-1.5 bg-[#FFFFFF] hover:bg-[#EDF3F0] border border-[#E1DDD3] rounded-lg text-[#123C35] transition-colors"
              title="Refresh flow"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#C9A45C] ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Modal Main Body (2 Columns: Left = Interactive Update Form, Right = Visual Flow Timeline) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-[#E1DDD3]">
          
          {/* Left: Interactive "Add New Step / Update Flow" (5 Columns) */}
          <div className="lg:col-span-5 p-4 sm:p-5 flex flex-col justify-between overflow-y-auto bg-[#F7F5F0]/60">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#E1DDD3]">
                <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-[#123C35]">
                  <PlusCircle className="w-4 h-4 text-[#C9A45C]" />
                  <span>Update Customer Flow & Advance Step</span>
                </div>
                <span className="text-[10px] font-semibold text-[#198754] bg-[#E8F5EE] px-2 py-0.5 rounded-full border border-[#198754]/20">
                  Live Update
                </span>
              </div>

              {/* Action Tabs */}
              <div className="grid grid-cols-3 gap-1.5 bg-[#E1DDD3]/40 p-1 rounded-xl text-xs font-bold text-[#65716C]">
                <button
                  type="button"
                  onClick={() => setActionTab('call')}
                  className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    actionTab === 'call'
                      ? 'bg-[#123C35] text-white shadow-2xs'
                      : 'hover:text-[#123C35] hover:bg-white/50'
                  }`}
                >
                  <PhoneCall className="w-3 h-3" />
                  <span>Log Call</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActionTab('status')}
                  className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    actionTab === 'status'
                      ? 'bg-[#123C35] text-white shadow-2xs'
                      : 'hover:text-[#123C35] hover:bg-white/50'
                  }`}
                >
                  <TrendingUp className="w-3 h-3" />
                  <span>Status</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActionTab('note')}
                  className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    actionTab === 'note'
                      ? 'bg-[#123C35] text-white shadow-2xs'
                      : 'hover:text-[#123C35] hover:bg-white/50'
                  }`}
                >
                  <FileText className="w-3 h-3" />
                  <span>Add Note</span>
                </button>
              </div>

              {/* Tab 1: Log Call Form */}
              {actionTab === 'call' && (
                <form onSubmit={handleLogCall} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#65716C] mb-1">
                      Call Outcome *
                    </label>
                    <select
                      value={callForm.call_outcome}
                      onChange={(e) => setCallForm({ ...callForm, call_outcome: e.target.value })}
                      className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E1DDD3] rounded-xl font-bold text-xs text-[#17201D] focus:outline-none focus:border-[#C9A45C]"
                    >
                      {CALL_OUTCOMES.map((out) => (
                        <option key={out} value={out}>{out}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[#65716C] mb-1">
                        Next Follow-up Date
                      </label>
                      <input
                        type="date"
                        value={callForm.next_follow_up_date}
                        onChange={(e) => setCallForm({ ...callForm, next_follow_up_date: e.target.value })}
                        className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E1DDD3] rounded-xl font-medium text-xs text-[#17201D] focus:outline-none focus:border-[#C9A45C]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[#65716C] mb-1">
                        Preferred Time
                      </label>
                      <select
                        value={callForm.next_follow_up_time}
                        onChange={(e) => setCallForm({ ...callForm, next_follow_up_time: e.target.value })}
                        className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E1DDD3] rounded-xl font-medium text-xs text-[#17201D] focus:outline-none focus:border-[#C9A45C]"
                      >
                        {CALL_TIMES.map((tm) => (
                          <option key={tm} value={tm}>{tm}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#65716C] mb-1">
                      Expected Shopping Date (if confirmed)
                    </label>
                    <input
                      type="date"
                      value={callForm.expected_shopping_date}
                      onChange={(e) => setCallForm({ ...callForm, expected_shopping_date: e.target.value })}
                      className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E1DDD3] rounded-xl font-semibold text-xs text-[#17201D] focus:outline-none focus:border-[#C9A45C]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#65716C] mb-1">
                      Conversation Remarks & Customer Response *
                    </label>
                    <textarea
                      rows={3}
                      value={callForm.remarks}
                      onChange={(e) => setCallForm({ ...callForm, remarks: e.target.value })}
                      placeholder="e.g. Spoke with bride's mother; looking for pure Mysore silk sarees; visiting showroom this Saturday..."
                      required
                      className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E1DDD3] rounded-xl font-medium text-xs text-[#17201D] focus:outline-none focus:border-[#C9A45C]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || !callForm.remarks.trim()}
                    className="w-full py-2.5 bg-[#123C35] hover:bg-[#082821] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md border border-[#C9A45C]/30 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving Step to Flow...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#E4CB92]" />
                        <span>Add Call Step to Flow</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Tab 2: Update Status Form */}
              {actionTab === 'status' && (
                <form onSubmit={handleUpdateStatus} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#65716C] mb-1">
                      New Customer Status *
                    </label>
                    <select
                      value={statusForm.new_status}
                      onChange={(e) => setStatusForm({ ...statusForm, new_status: e.target.value })}
                      required
                      className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E1DDD3] rounded-xl font-bold text-xs text-[#123C35] focus:outline-none focus:border-[#C9A45C]"
                    >
                      <option value="">-- Choose New Status --</option>
                      {WEDDING_STATUSES.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#65716C] mb-1">
                      Transition Reason / Context
                    </label>
                    <textarea
                      rows={3}
                      value={statusForm.change_reason}
                      onChange={(e) => setStatusForm({ ...statusForm, change_reason: e.target.value })}
                      placeholder="e.g. Customer confirmed shopping visit date; or advanced to store visit completed..."
                      className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E1DDD3] rounded-xl font-medium text-xs text-[#17201D] focus:outline-none focus:border-[#C9A45C]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || !statusForm.new_status}
                    className="w-full py-2.5 bg-[#123C35] hover:bg-[#082821] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md border border-[#C9A45C]/30 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Updating Status Step...</span>
                      </>
                    ) : (
                      <>
                        <TrendingUp className="w-3.5 h-3.5 text-[#E4CB92]" />
                        <span>Advance Status Step</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Tab 3: Add Note Form */}
              {actionTab === 'note' && (
                <form onSubmit={handleAddNote} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#65716C] mb-1">
                      Note Category
                    </label>
                    <select
                      value={noteForm.note_type}
                      onChange={(e) => setNoteForm({ ...noteForm, note_type: e.target.value })}
                      className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E1DDD3] rounded-xl font-semibold text-xs text-[#17201D] focus:outline-none focus:border-[#C9A45C]"
                    >
                      <option value="Requirement">Bridal / Saree Requirement</option>
                      <option value="Color & Fabric">Color & Fabric Preference</option>
                      <option value="VIP Handling">VIP / Family Handling</option>
                      <option value="Budget Note">Budget & Pricing Note</option>
                      <option value="General">General Note</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#65716C] mb-1">
                      Requirement Details *
                    </label>
                    <textarea
                      rows={4}
                      value={noteForm.note}
                      onChange={(e) => setNoteForm({ ...noteForm, note: e.target.value })}
                      placeholder="Add specific details: e.g. Customer requested pastel pink bridal lehenga with heavy zardozi work; budget ₹1.8L..."
                      required
                      className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E1DDD3] rounded-xl font-medium text-xs text-[#17201D] focus:outline-none focus:border-[#C9A45C]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || !noteForm.note.trim()}
                    className="w-full py-2.5 bg-[#123C35] hover:bg-[#082821] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md border border-[#C9A45C]/30 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Adding Note to Flow...</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-3.5 h-3.5 text-[#E4CB92]" />
                        <span>Add Requirement Step</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* Quick summary footer on left */}
            <div className="pt-4 mt-4 border-t border-[#E1DDD3] text-[11px] text-[#65716C] space-y-1">
              <div className="flex justify-between">
                <span>Total Flow Milestones:</span>
                <strong className="text-[#123C35]">{steps.length} Steps</strong>
              </div>
              <div className="flex justify-between">
                <span>Completed Calls:</span>
                <strong className="text-[#198754]">{callLogs.length + recentSteps.filter(s => s.type === 'call').length} calls</strong>
              </div>
            </div>
          </div>

          {/* Right: Chronological Customer Flow Stepper (7 Columns) */}
          <div className="lg:col-span-7 p-4 sm:p-6 overflow-y-auto bg-[#FFFFFF] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E1DDD3]">
              <div>
                <h3 className="font-bold text-sm text-[#123C35] flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#C9A45C]" />
                  <span>Customer Journey & Interaction Flow</span>
                </h3>
                <p className="text-[11px] text-[#65716C]">
                  Chronological progression of wedding consultations, telecaller calls, appointments and status milestones.
                </p>
              </div>

              <span className="text-xs font-bold text-[#123C35] bg-[#EDF3F0] px-2.5 py-1 rounded-xl border border-[#E1DDD3]">
                {steps.length} Milestones
              </span>
            </div>

            {/* Timeline Stepper Container */}
            <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-[#123C35] before:via-[#C9A45C] before:to-[#E1DDD3]">
              
              {loading && steps.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#C9A45C] mx-auto" />
                  <div className="text-xs text-[#65716C]">Loading customer journey milestones...</div>
                </div>
              ) : steps.length === 0 ? (
                <div className="py-12 text-center bg-[#F7F5F0] rounded-2xl border border-[#E1DDD3] p-6 space-y-2">
                  <Sparkles className="w-8 h-8 text-[#C9A45C] mx-auto opacity-70" />
                  <div className="font-bold text-sm text-[#123C35]">New Customer Journey</div>
                  <div className="text-xs text-[#65716C]">
                    No calls or status transitions recorded yet. Use the panel on the left to record the first step!
                  </div>
                </div>
              ) : (
                steps.map((st, idx) => {
                  let Icon = PhoneCall;
                  let dotColor = 'bg-[#C9A45C] ring-[#C9A45C]/20';
                  if (st.type === 'registration') {
                    Icon = Sparkles;
                    dotColor = 'bg-[#123C35] ring-[#123C35]/20';
                  } else if (st.type === 'status') {
                    Icon = TrendingUp;
                    dotColor = 'bg-[#082821] ring-[#082821]/20';
                  } else if (st.type === 'note') {
                    Icon = FileText;
                    dotColor = 'bg-[#C58A18] ring-[#C58A18]/20';
                  } else if (st.type === 'appointment') {
                    Icon = Calendar;
                    dotColor = 'bg-[#198754] ring-[#198754]/20';
                  }

                  return (
                    <div
                      key={st.id}
                      className={`relative group transition-all ${
                        st.isLive ? 'animate-pulse-subtle' : ''
                      }`}
                    >
                      {/* Stepper Dot */}
                      <div
                        className={`absolute -left-[31px] sm:-left-[35px] top-1 w-6 h-6 rounded-full ${dotColor} text-white flex items-center justify-center ring-4 shadow-sm z-10`}
                      >
                        <Icon className="w-3 h-3" />
                      </div>

                      {/* Step Card */}
                      <div
                        className={`p-4 rounded-2xl border transition-all text-xs space-y-2 ${
                          st.isLive
                            ? 'bg-[#E8F5EE]/40 border-[#198754] shadow-sm'
                            : 'bg-[#F7F5F0] hover:bg-[#FFFFFF] border-[#E1DDD3] hover:border-[#C9A45C] shadow-2xs'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#123C35] text-xs">
                              {st.title}
                            </span>
                            {st.badge && (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.badgeColor || 'bg-white text-[#123C35] border-[#E1DDD3]'}`}
                              >
                                {st.badge}
                              </span>
                            )}
                            {st.isLive && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#198754] text-white animate-bounce">
                                ✨ Just Added Step
                              </span>
                            )}
                          </div>

                          <span className="text-[11px] font-semibold text-[#65716C] flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#9A858D]" />
                            {st.timestamp}
                          </span>
                        </div>

                        {/* Content text */}
                        <div className="text-[#17201D] bg-[#FFFFFF] p-2.5 rounded-xl border border-[#E1DDD3]/70 leading-relaxed font-normal">
                          {st.content}
                        </div>

                        {/* Step Details & Next Actions */}
                        {st.details && (
                          <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-[#65716C]">
                            {st.details.nextFollowUp && (
                              <span className="text-[#C58A18] font-bold flex items-center gap-1">
                                📅 Next Call: {st.details.nextFollowUp}
                              </span>
                            )}
                            {st.details.updatedShoppingDate && (
                              <span className="text-[#198754] font-bold flex items-center gap-1">
                                🛍️ Shopping Date: {st.details.updatedShoppingDate}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Actor badge */}
                        <div className="text-[10px] font-semibold text-[#9A858D] flex items-center justify-between pt-0.5">
                          <span>Recorded by: <strong className="text-[#123C35]">{st.actor}</strong></span>
                          <span className="text-[#C9A45C] font-bold">Step #{steps.length - idx}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Modal Bottom Footer */}
        <div className="p-3 sm:p-4 bg-[#F7F5F0] border-t border-[#E1DDD3] flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="text-[#65716C] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#198754]" />
            <span>All flow updates are synchronized live across Wedding CRM, Desk & Dashboard.</span>
          </div>

          <div className="flex items-center gap-2">
            {targetId && (
              <Link
                to={`/wedding-crm/customers/${targetId}`}
                className="px-4 py-2 rounded-xl bg-[#FFFFFF] hover:bg-[#EDF3F0] border border-[#E1DDD3] font-semibold text-xs text-[#123C35] flex items-center gap-1.5 transition-colors"
              >
                <span>Open Profile</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-[#123C35] hover:bg-[#082821] text-white font-semibold text-xs shadow-md border border-[#C9A45C]/30 transition-all cursor-pointer"
            >
              Close Flow
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
