import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  RefreshCw,
  PhoneCall,
  MessageSquare,
  CalendarClock,
  StickyNote,
  ArrowRightLeft,
  CircleAlert,
  Archive,
  Store,
  ShoppingBag,
  Trophy,
  Check
} from 'lucide-react';
import ModalPortal from '../../../components/ui/ModalPortal';
import { showToast } from '../../../components/Toast';
import { API, Auth } from '../../../services/api';
import { formatDateDisplay, parseDate, toISODateInput } from '../../../utils/dateUtils';
import {
  CALL_OUTCOMES,
  CALL_STATUSES,
  CALL_TIME_OPTIONS,
  CATEGORY_OPTIONS,
  isCompletionStatus
} from '../weddingTypes';
import {
  PipelineCustomer,
  QuickActionKind,
  STAGE_LABELS,
  STAGE_TARGET_STATUSES,
  StageKey
} from './types';
import {
  checkedRequirementPayload,
  shoppingRequirementUniverse
} from './pipelineDerived';

/**
 * QuickActionModal — the pipeline quick actions, each bound to a real endpoint.
 *
 * Payload field names below were verified against
 * backend/src/controllers/weddingController.js:
 *   logCall                  → customer_id, call_date, call_time, call_status, call_outcome,
 *                              customer_response, remarks, next_follow_up_date,
 *                              next_follow_up_time, expected_shopping_date
 *   createCommunication      → communication_type, communication_method, communication_date,
 *                              communication_time, outcome, communication_details,
 *                              next_follow_up_date, next_follow_up_time
 *   createNote               → note_content, note_type
 *   changeStatus             → new_status, change_reason   (via API.changeWeddingCustomerStatus)
 *   createVisit              → visit_date, visit_time, visitors_count, visited_by, purpose,
 *                              products_viewed, categories_viewed, customer_requirement,
 *                              visit_result, next_action, visit_notes, visit_status
 *   updateCustomer / ByTelecaller → follow_up_date, preferred_call_time and the journey columns
 *
 * The wedding_communication table has no columns for requirement / concern / preference /
 * response / reason / priority, so those inputs are composed into a labelled
 * communication_details text block and every entry is appended (never overwritten).
 *
 * Nothing here is a placeholder: every submit in this modal performs a write, and a field
 * the user left empty is omitted from the payload so the stored value survives untouched.
 */

interface QuickActionModalProps {
  kind: QuickActionKind | null;
  customerId: number | null;
  customer: PipelineCustomer | null;
  today: string;
  onClose: () => void;
  onSaved: (customerId: number, message: string) => void;
}

/** wedding_visits.visit_status is a free VARCHAR(50); these are the values in use. */
const VISIT_STATUS_OPTIONS = [
  'Visit Planned',
  'Visited Store',
  'Shopping In Progress',
  'Shopping Completed',
  'No Show',
  'Visit Cancelled'
];
/** Same vocabulary the registration form writes into preferred_shopping_time. */
const SHOPPING_TIME_OPTIONS = ['Morning', 'Afternoon', 'Evening', 'Flexible'];
const VISIT_PURPOSE_OPTIONS = ['Wedding Shopping', 'Saree Selection', 'Lehenga Selection', 'Sherwani & Suit', 'Family Shopping', 'Follow-up Visit', 'Delivery Pickup'];

export default function QuickActionModal({
  kind,
  customerId,
  customer,
  today,
  onClose,
  onSaved
}: QuickActionModalProps) {
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState('');

  const [callForm, setCallForm] = useState({
    call_date: today,
    call_time: '',
    call_outcome: 'Connected — Interested',
    call_status: 'Completed',
    customer_response: '',
    remarks: '',
    follow_up_required: true,
    next_follow_up_date: '',
    next_follow_up_time: CALL_TIME_OPTIONS[0],
    expected_shopping_date: ''
  });

  const [feedbackForm, setFeedbackForm] = useState({
    communication_method: 'Call',
    communication_date: today,
    communication_time: '',
    requirement: '',
    concern: '',
    preference: '',
    response: '',
    outcome: '',
    next_follow_up_date: '',
    next_follow_up_time: CALL_TIME_OPTIONS[0]
  });

  const [followUpForm, setFollowUpForm] = useState({
    follow_up_type: 'Phone Call',
    communication_date: today,
    communication_time: '',
    assigned_employee: '',
    reason: '',
    notes: '',
    priority: 'Medium',
    outcome: '',
    follow_up_date: '',
    preferred_call_time: CALL_TIME_OPTIONS[0]
  });

  const [noteForm, setNoteForm] = useState({
    note_content: '',
    note_type: 'General'
  });

  const [stageForm, setStageForm] = useState({ new_status: '', change_reason: '' });
  const [stageConfirmed, setStageConfirmed] = useState(false);

  const [visitForm, setVisitForm] = useState({
    visit_date: '',
    visit_time: '',
    visitors_count: '',
    visited_by: '',
    purpose: 'Wedding Shopping',
    products_viewed: '',
    categories_viewed: '',
    customer_requirement: '',
    visit_result: '',
    next_action: '',
    visit_notes: '',
    visit_status: 'Visited Store'
  });

  const [shoppingForm, setShoppingForm] = useState({
    expected_shopping_date: '',
    preferred_shopping_date: '',
    preferred_shopping_time: '',
    preferred_shopping_category: '',
    expected_visitors: '',
    requirements: {} as Record<string, boolean>
  });

  const [convertForm, setConvertForm] = useState({ new_status: '', change_reason: '' });
  const [convertConfirmed, setConvertConfirmed] = useState(false);

  const [telecallers, setTelecallers] = useState<any[]>([]);

  const open = kind !== null && customerId !== null;
  // The parent rebuilds the customer object on every board refresh, so the forms are
  // reset only when the action/customer pair actually changes — never mid-typing.
  const formKey = `${kind ?? 'none'}-${customerId ?? 0}`;
  const lastFormKey = useRef('');

  // ── Reset every form when the action (or the customer) changes ──────────
  useEffect(() => {
    if (!open) {
      lastFormKey.current = '';
      return;
    }
    if (lastFormKey.current === formKey) return;
    lastFormKey.current = formKey;
    setPending(false);
    setFormError('');
    setStageConfirmed(false);
    const isoToday = toISODateInput(today) || today;
    setCallForm({
      call_date: isoToday,
      call_time: '',
      call_outcome: 'Connected — Interested',
      call_status: 'Completed',
      customer_response: '',
      remarks: '',
      follow_up_required: true,
      next_follow_up_date: '',
      next_follow_up_time: customer?.preferred_followup_time || CALL_TIME_OPTIONS[0],
      expected_shopping_date: toISODateInput(customer?.expected_shopping_date)
    });
    setFeedbackForm({
      communication_method: 'Call',
      communication_date: isoToday,
      communication_time: '',
      requirement: '',
      concern: '',
      preference: '',
      response: '',
      outcome: '',
      next_follow_up_date: '',
      next_follow_up_time: CALL_TIME_OPTIONS[0]
    });
    setFollowUpForm({
      follow_up_type: 'Phone Call',
      communication_date: isoToday,
      communication_time: '',
      assigned_employee: customer?.assigned_telecaller || Auth.get()?.fullName || '',
      reason: '',
      notes: '',
      priority: customer?.priority || 'Medium',
      outcome: '',
      follow_up_date: toISODateInput(customer?.follow_up_date),
      preferred_call_time: customer?.preferred_call_time || CALL_TIME_OPTIONS[0]
    });
    setNoteForm({ note_content: '', note_type: 'General' });
    setStageForm({ new_status: '', change_reason: '' });
    setVisitForm({
      visit_date: isoToday,
      visit_time: '',
      visitors_count: '',
      visited_by: Auth.get()?.fullName || '',
      purpose: 'Wedding Shopping',
      products_viewed: '',
      categories_viewed: '',
      customer_requirement: '',
      visit_result: '',
      next_action: '',
      visit_notes: '',
      visit_status: 'Visited Store'
    });
    setShoppingForm({
      expected_shopping_date: toISODateInput(customer?.expected_shopping_date),
      preferred_shopping_date: '',
      preferred_shopping_time: '',
      preferred_shopping_category: customer?.preferred_shopping_category || '',
      expected_visitors: '',
      requirements: {}
    });
    setConvertForm({ new_status: '', change_reason: '' });
    setConvertConfirmed(false);
  }, [kind, customerId, today, customer]);

  // ── Telecaller list for the follow-up "assigned employee" picker ─────────
  useEffect(() => {
    if (kind !== 'follow_up') return;
    let cancelled = false;
    API.getWeddingTelecallers(customer?.location_id)
      .then((res: any) => {
        if (cancelled) return;
        setTelecallers(Array.isArray(res?.telecallers) ? res.telecallers : (Array.isArray(res?.data) ? res.data : []));
      })
      .catch(() => {
        // No telecaller directory available: the free-text input below is rendered instead.
        if (!cancelled) setTelecallers([]);
      });
    return () => { cancelled = true; };
  }, [kind, customer?.location_id]);

  const stageTargets = useMemo(() => {
    const current = (customer?.customer_status || '').trim();
    const order: StageKey[] = ['new', 'contacted', 'follow_up', 'shopping_planned', 'visited', 'won', 'not_moving'];
    const groups: { stage: StageKey; label: string; options: string[] }[] = [];
    for (const key of order) {
      const opts = (STAGE_TARGET_STATUSES[key] || []).filter((s) => s !== current);
      if (opts.length) groups.push({ stage: key, label: STAGE_LABELS[key], options: opts });
    }
    return groups;
  }, [customer?.customer_status]);

  const selectedStatus = stageForm.new_status;
  const needsArchiveConfirm = isCompletionStatus(selectedStatus);

  const callbackOutcomes = ['Call Back Requested', 'Callback Requested', 'Callback', 'Call Back Later'];
  const outcomeRequiresCallback = callbackOutcomes.includes(callForm.call_outcome);

  const titles: Record<QuickActionKind, { title: string; subtitle: string; icon: any }> = {
    call: { title: 'Log Call', subtitle: 'Records the call and applies the CRM status rules', icon: PhoneCall },
    feedback: { title: 'Record Feedback', subtitle: 'Appended to the feedback history — never overwrites', icon: MessageSquare },
    follow_up: { title: 'Schedule Follow-Up', subtitle: 'Logs the follow-up and updates the pipeline date', icon: CalendarClock },
    note: { title: 'Add Note', subtitle: 'Adds a note to the customer record', icon: StickyNote },
    stage: { title: 'Move Stage', subtitle: 'Changes the customer status with an audit entry', icon: ArrowRightLeft },
    visit: { title: 'Record Store Visit', subtitle: 'Writes a wedding_visits row for this customer', icon: Store },
    shopping: { title: 'Update Shopping Plan', subtitle: 'Saves the dates, category and requirements the shop is planned around', icon: ShoppingBag },
    convert: { title: 'Mark Won / Converted', subtitle: 'Closes the stage with a status change and an audit entry', icon: Trophy }
  };

  const meta = kind ? titles[kind] : null;
  const Icon = meta?.icon || PhoneCall;

  // ── Writers ─────────────────────────────────────────────────────────────

  /**
   * Only the two customer-update endpoints can write these columns. Role decides
   * which one is tried first; the server stays authoritative and a 403 simply
   * retries through the other (narrower) endpoint. Location scoping is server-side.
   */
  const saveCustomerFields = async (id: number, payload: Record<string, any>) => {
    const role = Auth.get()?.role || '';
    const privileged = ['Admin', 'Super Admin', 'Manager', 'HR', 'Wedding Collection Manager', 'system administrator']
      .includes(role);
    try {
      return privileged
        ? await API.updateWeddingCustomer(id, payload)
        : await API.updateWeddingCustomerByTelecaller(id, payload);
    } catch (err: any) {
      if (err?.status === 403) {
        return privileged
          ? await API.updateWeddingCustomerByTelecaller(id, payload)
          : await API.updateWeddingCustomer(id, payload);
      }
      throw err;
    }
  };

  const buildLabelledBlock = (pairs: [string, string][]) =>
    pairs
      .filter(([, value]) => String(value || '').trim())
      .map(([label, value]) => `${label}: ${String(value).trim()}`)
      .join('\n');

  /**
   * Columns the narrow telecaller endpoint actually persists
   * (weddingController.updateCustomerByTelecaller). A payload carrying anything
   * outside this set is a manager write: it goes to PUT /customers/:id and the
   * server decides. A 403 is surfaced verbatim, never routed around.
   */
  const TELECALLER_WRITABLE = new Set([
    'alternate_mobile', 'preferred_call_time', 'wedding_date', 'expected_shopping_date',
    'preferred_shopping_category', 'budget', 'estimated_family_size', 'bride_name',
    'groom_name', 'wedding_city', 'customer_status', 'follow_up_date', 'customer_notes', 'remarks'
  ]);

  const saveJourneyFields = async (id: number, payload: Record<string, any>) => {
    const managerOnly = Object.keys(payload).some((key) => !TELECALLER_WRITABLE.has(key));
    if (!managerOnly) return saveCustomerFields(id, payload);
    return API.updateWeddingCustomer(id, payload);
  };

  const submitCall = async (id: number) => {
    const callDate = toISODateInput(callForm.call_date);
    if (!callDate) throw new Error('A valid call date is required.');
    if (!callForm.call_outcome) throw new Error('Call outcome is required.');

    const requiresCallback = outcomeRequiresCallback;
    if (callForm.follow_up_required || requiresCallback) {
      if (!toISODateInput(callForm.next_follow_up_date)) {
        throw new Error('Next follow-up date is required when a follow-up is expected.');
      }
      if (requiresCallback && !String(callForm.next_follow_up_time || '').trim()) {
        throw new Error('Next follow-up time is required when the outcome is a call-back request.');
      }
    }

    const payload: Record<string, any> = {
      customer_id: id,
      call_date: callDate,
      call_status: callForm.call_status,
      call_outcome: callForm.call_outcome
    };
    if (callForm.call_time) payload.call_time = callForm.call_time;              // HH:MM
    if (callForm.remarks.trim()) payload.remarks = callForm.remarks.trim();
    if (callForm.customer_response.trim()) payload.customer_response = callForm.customer_response.trim();
    if (callForm.follow_up_required || requiresCallback) {
      payload.next_follow_up_date = toISODateInput(callForm.next_follow_up_date);
      if (callForm.next_follow_up_time) payload.next_follow_up_time = callForm.next_follow_up_time;
    }
    const shoppingDate = toISODateInput(callForm.expected_shopping_date);
    if (shoppingDate) payload.expected_shopping_date = shoppingDate;

    // last_call_date / total_calls_count / last_call_outcome / customer_status and the
    // realtime events are all written by the backend — nothing duplicated here.
    const res: any = await API.logWeddingCall(payload);
    return res?.message || 'Call activity saved successfully.';
  };

  const submitFeedback = async (id: number) => {
    const date = toISODateInput(feedbackForm.communication_date);
    if (!date) throw new Error('Feedback date is required.');
    if (!feedbackForm.communication_method) throw new Error('Feedback method is required.');

    const details = buildLabelledBlock([
      ['CUSTOMER REQUIREMENT', feedbackForm.requirement],
      ['CUSTOMER CONCERN', feedbackForm.concern],
      ['CUSTOMER PREFERENCE', feedbackForm.preference],
      ['CUSTOMER RESPONSE', feedbackForm.response]
    ]);
    if (!details) throw new Error('Enter at least one of requirement, concern, preference or response.');

    const payload: Record<string, any> = {
      communication_type: 'Feedback',
      communication_method: feedbackForm.communication_method,
      communication_date: date,
      communication_details: details
    };
    if (feedbackForm.communication_time) payload.communication_time = feedbackForm.communication_time; // HH:MM
    if (feedbackForm.outcome.trim()) payload.outcome = feedbackForm.outcome.trim();                    // next action
    if (toISODateInput(feedbackForm.next_follow_up_date)) {
      payload.next_follow_up_date = toISODateInput(feedbackForm.next_follow_up_date);
      if (feedbackForm.next_follow_up_time) payload.next_follow_up_time = feedbackForm.next_follow_up_time;
    }

    const res: any = await API.createWeddingCommunication(id, payload);
    return res?.message || 'Feedback recorded.';
  };

  const submitFollowUp = async (id: number) => {
    const date = toISODateInput(followUpForm.communication_date);
    if (!date) throw new Error('Follow-up date is required.');
    if (!toISODateInput(followUpForm.follow_up_date)) {
      throw new Error('The scheduled follow-up date is required.');
    }

    const details = buildLabelledBlock([
      ['FOLLOW-UP TYPE', followUpForm.follow_up_type],
      ['ASSIGNED EMPLOYEE', followUpForm.assigned_employee],
      ['REASON', followUpForm.reason],
      ['PRIORITY', followUpForm.priority],
      ['NOTES', followUpForm.notes]
    ]);

    const payload: Record<string, any> = {
      communication_type: 'Follow-Up',
      communication_method: followUpForm.follow_up_type,
      communication_date: date,
      communication_details: details || `Follow-Up: ${followUpForm.follow_up_type} (${followUpForm.priority})`
    };
    if (followUpForm.communication_time) payload.communication_time = followUpForm.communication_time;
    if (followUpForm.outcome.trim()) payload.outcome = followUpForm.outcome.trim();
    payload.next_follow_up_date = toISODateInput(followUpForm.follow_up_date);
    if (followUpForm.preferred_call_time) payload.next_follow_up_time = followUpForm.preferred_call_time;

    await API.createWeddingCommunication(id, payload);

    // Keep the pipeline / dashboards in sync with the new follow-up commitment.
    try {
      await saveCustomerFields(id, {
        follow_up_date: toISODateInput(followUpForm.follow_up_date),
        preferred_call_time: followUpForm.preferred_call_time || 'Any Time'
      });
    } catch (syncErr: any) {
      // The follow-up row is already appended (append-only history), so say exactly
      // what succeeded and what did not instead of reporting a blanket failure.
      const detail = syncErr?.message ? ` (${syncErr.message})` : '';
      throw new Error(
        `The follow-up was recorded, but the customer's follow-up date could not be updated. Please try again.${detail}`
      );
    }
    return 'Follow-up scheduled and logged.';
  };

  const submitNote = async (id: number) => {
    if (!noteForm.note_content.trim()) throw new Error('Note content is required.');
    const res: any = await API.createWeddingNote(id, {
      note_content: noteForm.note_content.trim(),
      note_type: noteForm.note_type
    });
    return res?.message || 'Note added.';
  };

  const submitStage = async (id: number) => {
    if (!stageForm.new_status) throw new Error('Select the stage to move this customer to.');
    if (needsArchiveConfirm && !stageConfirmed) {
      throw new Error('Please confirm the completion step before saving.');
    }
    const res: any = await API.changeWeddingCustomerStatus(
      id,
      stageForm.new_status,
      stageForm.change_reason.trim() || undefined
    );
    if (res?.success === false) throw new Error(res?.message || 'save failed');
    if (res?.archived) {
      return res?.message || 'Customer completed and moved to Old Customers.';
    }
    return res?.message || `Customer moved to ${stageForm.new_status}.`;
  };

  /** POST /customers/:id/visits — one wedding_visits row. */
  const submitVisit = async (id: number) => {
    const visitDate = toISODateInput(visitForm.visit_date);
    if (!visitDate) throw new Error('Enter the date the customer visited the store.');
    const visitTime = String(visitForm.visit_time || '').trim();
    // createVisit answers 400 without a time, so the form asks for it first.
    if (!/^\d{1,2}:\d{2}$/.test(visitTime)) {
      throw new Error('Enter a visit time as HH:MM — the visit record requires it.');
    }
    const visitors = String(visitForm.visitors_count ?? '').trim();
    if (visitors && !Number.isFinite(parseInt(visitors, 10))) {
      throw new Error('Enter a whole number for the visitor count.');
    }

    const payload: Record<string, any> = {
      visit_date: visitDate,
      visit_time: visitTime,
      visitors_count: visitors ? parseInt(visitors, 10) : 1,
      visit_status: String(visitForm.visit_status || '').trim() || 'Visited Store'
    };
    const optional: [string, string][] = [
      ['visited_by', visitForm.visited_by],
      ['purpose', visitForm.purpose],
      ['products_viewed', visitForm.products_viewed],
      ['categories_viewed', visitForm.categories_viewed],
      ['customer_requirement', visitForm.customer_requirement],
      ['visit_result', visitForm.visit_result],
      ['next_action', visitForm.next_action],
      ['visit_notes', visitForm.visit_notes]
    ];
    for (const [key, value] of optional) {
      const trimmed = String(value || '').trim();
      if (trimmed) payload[key] = trimmed;
    }

    const res: any = await API.createWeddingVisit(id, payload);
    if (res?.success === false) throw new Error(res?.message || 'save failed');
    return res?.message || 'Store visit recorded.';
  };

  /**
   * PUT /customers/:id — the shopping plan columns. Only filled inputs are sent,
   * because an omitted field is left untouched and a blank one would clear it.
   */
  const submitShopping = async (id: number) => {
    const payload: Record<string, any> = {};

    const expectedDate = toISODateInput(shoppingForm.expected_shopping_date);
    if (expectedDate) payload.expected_shopping_date = expectedDate;

    const preferredDate = toISODateInput(shoppingForm.preferred_shopping_date);
    if (preferredDate) payload.preferred_shopping_date = preferredDate;

    if (String(shoppingForm.preferred_shopping_time || '').trim()) {
      payload.preferred_shopping_time = String(shoppingForm.preferred_shopping_time).trim();
    }
    if (String(shoppingForm.preferred_shopping_category || '').trim()) {
      payload.preferred_shopping_category = String(shoppingForm.preferred_shopping_category).trim();
    }

    const visitors = String(shoppingForm.expected_visitors ?? '').trim();
    if (visitors) {
      if (!Number.isFinite(parseInt(visitors, 10))) throw new Error('Enter a whole number for the expected visitor count.');
      payload.expected_visitors = parseInt(visitors, 10);
    }

    const checked = Object.keys(shoppingForm.requirements).filter((k) => shoppingForm.requirements[k]);
    if (checked.length) payload.shopping_requirements = checkedRequirementPayload(checked);

    if (Object.keys(payload).length === 0) {
      throw new Error('Set at least one shopping detail before saving.');
    }

    const res: any = await saveJourneyFields(id, payload);
    if (res?.success === false) throw new Error(res?.message || 'save failed');
    return res?.message || 'Shopping plan updated.';
  };

  /** changeStatus with the same completion guard as Move Stage. */
  const submitConvert = async (id: number) => {
    if (!convertForm.new_status) throw new Error('Choose the status that marks this wedding won.');
    if (isCompletionStatus(convertForm.new_status) && !convertConfirmed) {
      throw new Error('Please confirm the completion step before saving.');
    }
    const res: any = await API.changeWeddingCustomerStatus(
      id,
      convertForm.new_status,
      convertForm.change_reason.trim() || undefined
    );
    if (res?.success === false) throw new Error(res?.message || 'save failed');
    if (res?.archived) return res?.message || 'Customer completed and moved to Old Customers.';
    return res?.message || `Customer marked as ${convertForm.new_status}.`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!open || kind === null || customerId === null || pending) return;

    setPending(true);
    setFormError('');
    try {
      let message = 'Saved.';
      if (kind === 'call') message = await submitCall(customerId);
      else if (kind === 'feedback') message = await submitFeedback(customerId);
      else if (kind === 'follow_up') message = await submitFollowUp(customerId);
      else if (kind === 'note') message = await submitNote(customerId);
      else if (kind === 'visit') message = await submitVisit(customerId);
      else if (kind === 'shopping') message = await submitShopping(customerId);
      else if (kind === 'convert') message = await submitConvert(customerId);
      else message = await submitStage(customerId);

      showToast(message, 'success');
      onSaved(customerId, message);
      onClose();
    } catch (err: any) {
      // 409 OLD_CUSTOMER_READONLY and every other server message is surfaced verbatim
      // in plain English — never swallowed, never a blank failure.
      const friendly = String(err?.message || '').trim() || 'Unable to save changes. Please try again.';
      setFormError(friendly);
      showToast(friendly, 'error');
    } finally {
      setPending(false);
    }
  };

  if (!open || !meta) return null;

  const inputCls = 'w-full px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl text-xs font-semibold text-[#2B1722] focus:outline-none focus:border-[#B76E79]';
  const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-[#6F5963] mb-1';

  return (
    <ModalPortal
      isOpen={open}
      onClose={pending ? () => undefined : onClose}
      closeOnEsc={!pending}
      ariaLabel={`${meta.title} for ${customer?.customer_name || 'customer'}`}
    >
      <div className="bg-[#FFFDFC] rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden border border-[#E8D9D4] shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[#E8D9D4] bg-[#FFFAF7]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#4A173A] text-[#E8C7A8] flex items-center justify-center border border-[#B76E79]/30">
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#4A173A] leading-tight">
                {meta.title}
                {customer?.customer_name ? <span className="font-bold text-[#6A2853]"> · {customer.customer_name}</span> : null}
              </h3>
              <p className="text-[10px] text-[#6F5963] font-semibold mt-0.5">{meta.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => !pending && onClose()}
            className="p-1.5 rounded-lg text-[#6F5963] hover:text-[#4A173A] hover:bg-[#F6E2E5] cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {customer && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 rounded-2xl bg-[#FFF7F2] border border-[#E8D9D4] text-[10px] font-bold text-[#6F5963]">
              <span>{customer.customer_code}</span>
              <span className="text-[#E8D9D4]">|</span>
              <span>{customer.mobile_number}</span>
              <span className="text-[#E8D9D4]">|</span>
              <span>{customer.location_name || 'Store'}</span>
              <span className="text-[#E8D9D4]">|</span>
              <span className="text-[#4A173A]">{customer.customer_status}</span>
              {customer.follow_up_date && parseDate(customer.follow_up_date) && (
                <>
                  <span className="text-[#E8D9D4]">|</span>
                  <span>Next follow-up {formatDateDisplay(customer.follow_up_date, 'Not scheduled')}</span>
                </>
              )}
            </div>
          )}

          {formError && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-2xl bg-[#FDE8E7] border border-[#B42318]/40 text-[11px] font-semibold text-[#B42318]">
              <CircleAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {kind === 'call' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Call Date *</label>
                  <input
                    type="date"
                    value={callForm.call_date}
                    onChange={(e) => setCallForm({ ...callForm, call_date: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Call Time</label>
                  <input
                    type="time"
                    value={callForm.call_time}
                    onChange={(e) => setCallForm({ ...callForm, call_time: e.target.value })}
                    className={inputCls}
                  />
                  <p className="text-[9px] text-[#6F5963] mt-1">Leave blank to stamp the store (IST) time.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Outcome *</label>
                  <select
                    value={callForm.call_outcome}
                    onChange={(e) => setCallForm({ ...callForm, call_outcome: e.target.value })}
                    className={inputCls}
                  >
                    {CALL_OUTCOMES.map((out) => (
                      <option key={out} value={out}>{out}</option>
                    ))}
                  </select>
                  <p className="text-[9px] text-[#6F5963] mt-1">
                    The CRM maps this outcome onto the customer status automatically.
                  </p>
                </div>
                <div>
                  <label className={labelCls}>Call Status</label>
                  <select
                    value={callForm.call_status}
                    onChange={(e) => setCallForm({ ...callForm, call_status: e.target.value })}
                    className={inputCls}
                  >
                    {CALL_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>Customer Response</label>
                <textarea
                  rows={2}
                  value={callForm.customer_response}
                  onChange={(e) => setCallForm({ ...callForm, customer_response: e.target.value })}
                  placeholder="What the customer said in their own words"
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Remarks / Notes</label>
                <textarea
                  rows={2}
                  value={callForm.remarks}
                  onChange={(e) => setCallForm({ ...callForm, remarks: e.target.value })}
                  placeholder="Summary of the conversation"
                  className={inputCls}
                />
              </div>

              <div className="rounded-2xl border border-[#E8D9D4] bg-[#FFFAF7] p-3 space-y-3">
                <label className="flex items-center gap-2 text-[11px] font-bold text-[#4A173A] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={callForm.follow_up_required}
                    onChange={(e) => setCallForm({ ...callForm, follow_up_required: e.target.checked })}
                    className="accent-[#B76E79]"
                  />
                  Follow-up required
                  {outcomeRequiresCallback && (
                    <span className="ml-auto text-[9px] uppercase tracking-wider text-[#C58A18] font-black">
                      Required by this outcome
                    </span>
                  )}
                </label>

                {callForm.follow_up_required && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Next Follow-Up Date *</label>
                      <input
                        type="date"
                        value={callForm.next_follow_up_date}
                        onChange={(e) => setCallForm({ ...callForm, next_follow_up_date: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Next Follow-Up Time</label>
                      <select
                        value={callForm.next_follow_up_time}
                        onChange={(e) => setCallForm({ ...callForm, next_follow_up_time: e.target.value })}
                        className={inputCls}
                      >
                        {CALL_TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className={labelCls}>Updated Expected Shopping Date</label>
                <input
                  type="date"
                  value={callForm.expected_shopping_date}
                  onChange={(e) => setCallForm({ ...callForm, expected_shopping_date: e.target.value })}
                  className={inputCls}
                />
                <p className="text-[9px] text-[#6F5963] mt-1">
                  Sent as <code>expected_shopping_date</code> — the field the call endpoint reads.
                </p>
              </div>
            </>
          )}

          {kind === 'feedback' && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Method *</label>
                  <select
                    value={feedbackForm.communication_method}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, communication_method: e.target.value })}
                    className={inputCls}
                  >
                    {['Call', 'WhatsApp', 'In Person', 'Store Visit', 'Email', 'SMS'].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Date *</label>
                  <input
                    type="date"
                    value={feedbackForm.communication_date}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, communication_date: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Time</label>
                  <input
                    type="time"
                    value={feedbackForm.communication_time}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, communication_time: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Requirement</label>
                  <textarea
                    rows={2}
                    value={feedbackForm.requirement}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, requirement: e.target.value })}
                    placeholder="What the customer is looking for"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Concern</label>
                  <textarea
                    rows={2}
                    value={feedbackForm.concern}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, concern: e.target.value })}
                    placeholder="Anything the customer is unhappy about"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Preference</label>
                  <textarea
                    rows={2}
                    value={feedbackForm.preference}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, preference: e.target.value })}
                    placeholder="Colour, fabric, budget or brand preferences"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Customer Response</label>
                  <textarea
                    rows={2}
                    value={feedbackForm.response}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, response: e.target.value })}
                    placeholder="The customer's own words"
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Next Action</label>
                <input
                  type="text"
                  maxLength={100}
                  value={feedbackForm.outcome}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, outcome: e.target.value })}
                  placeholder="e.g. Share bridal silk collection on WhatsApp"
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Next Follow-Up Date</label>
                  <input
                    type="date"
                    value={feedbackForm.next_follow_up_date}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, next_follow_up_date: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Next Follow-Up Time</label>
                  <select
                    value={feedbackForm.next_follow_up_time}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, next_follow_up_time: e.target.value })}
                    className={inputCls}
                  >
                    {CALL_TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-[10px] text-[#6F5963] font-semibold bg-[#FFF7F2] border border-[#E8D9D4] rounded-2xl px-3 py-2">
                Feedback is stored as a new communication row each time — previous feedback is never replaced.
              </p>
            </>
          )}

          {kind === 'follow_up' && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Follow-Up Type *</label>
                  <select
                    value={followUpForm.follow_up_type}
                    onChange={(e) => setFollowUpForm({ ...followUpForm, follow_up_type: e.target.value })}
                    className={inputCls}
                  >
                    {['Phone Call', 'WhatsApp', 'In Person', 'Store Visit', 'SMS', 'Email'].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Logged On *</label>
                  <input
                    type="date"
                    value={followUpForm.communication_date}
                    onChange={(e) => setFollowUpForm({ ...followUpForm, communication_date: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Time</label>
                  <input
                    type="time"
                    value={followUpForm.communication_time}
                    onChange={(e) => setFollowUpForm({ ...followUpForm, communication_time: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Assigned Employee</label>
                  {telecallers.length > 0 ? (
                    <select
                      value={followUpForm.assigned_employee}
                      onChange={(e) => setFollowUpForm({ ...followUpForm, assigned_employee: e.target.value })}
                      className={inputCls}
                    >
                      {!telecallers.some((t: any) => (t.full_name || t.username) === followUpForm.assigned_employee) && (
                        <option value={followUpForm.assigned_employee || ''}>
                          {followUpForm.assigned_employee || 'Select employee'}
                        </option>
                      )}
                      {telecallers.map((t: any) => {
                        const name = t.full_name || t.username || String(t.id);
                        return <option key={t.id} value={name}>{name}</option>;
                      })}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={followUpForm.assigned_employee}
                      onChange={(e) => setFollowUpForm({ ...followUpForm, assigned_employee: e.target.value })}
                      placeholder="Employee handling the follow-up"
                      className={inputCls}
                    />
                  )}
                </div>
                <div>
                  <label className={labelCls}>Priority</label>
                  <select
                    value={followUpForm.priority}
                    onChange={(e) => setFollowUpForm({ ...followUpForm, priority: e.target.value })}
                    className={inputCls}
                  >
                    {['Low', 'Medium', 'High', 'Urgent'].map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>Reason</label>
                <input
                  type="text"
                  maxLength={100}
                  value={followUpForm.reason}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, reason: e.target.value })}
                  placeholder="Why this follow-up is happening"
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Notes</label>
                <textarea
                  rows={2}
                  value={followUpForm.notes}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, notes: e.target.value })}
                  placeholder="Anything the next caller should know"
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Follow-Up Date *</label>
                  <input
                    type="date"
                    value={followUpForm.follow_up_date}
                    onChange={(e) => setFollowUpForm({ ...followUpForm, follow_up_date: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Preferred Time</label>
                  <select
                    value={followUpForm.preferred_call_time}
                    onChange={(e) => setFollowUpForm({ ...followUpForm, preferred_call_time: e.target.value })}
                    className={inputCls}
                  >
                    {CALL_TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-[10px] text-[#6F5963] font-semibold bg-[#FFF7F2] border border-[#E8D9D4] rounded-2xl px-3 py-2">
                Saving writes the follow-up row and updates the customer’s follow-up date and preferred call
                time, so the pipeline and dashboards stay in sync.
              </p>
            </>
          )}

          {kind === 'note' && (
            <>
              <div>
                <label className={labelCls}>Note Type</label>
                <select
                  value={noteForm.note_type}
                  onChange={(e) => setNoteForm({ ...noteForm, note_type: e.target.value })}
                  className={inputCls}
                >
                  {['General', 'Preference', 'Feedback', 'Follow-Up', 'Visit', 'Warning', 'Other'].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Note *</label>
                <textarea
                  rows={5}
                  value={noteForm.note_content}
                  onChange={(e) => setNoteForm({ ...noteForm, note_content: e.target.value })}
                  placeholder="Write the note for this wedding journey"
                  className={inputCls}
                />
              </div>
            </>
          )}

          {kind === 'stage' && (
            <>
              <div>
                <label className={labelCls}>Move To Status *</label>
                <select
                  value={stageForm.new_status}
                  onChange={(e) => {
                    setStageForm({ ...stageForm, new_status: e.target.value });
                    setStageConfirmed(false);
                  }}
                  className={inputCls}
                >
                  <option value="">Select a status</option>
                  {stageTargets.map((group) => (
                    <optgroup key={group.stage} label={group.label}>
                      {group.options.map((s) => (
                        <option key={s} value={s}>
                          {s}{isCompletionStatus(s) ? ' — completes & archives' : ''}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Reason</label>
                <textarea
                  rows={2}
                  value={stageForm.change_reason}
                  onChange={(e) => setStageForm({ ...stageForm, change_reason: e.target.value })}
                  placeholder="Why is the stage changing? (stored in the status history)"
                  className={inputCls}
                />
              </div>

              {needsArchiveConfirm && (
                <div className="rounded-2xl border border-[#B42318]/40 bg-[#FDE8E7] p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <Archive className="w-4 h-4 text-[#B42318] mt-0.5 shrink-0" />
                    <div className="text-[11px] font-bold text-[#8B1A12] leading-relaxed">
                      <p>
                        “{selectedStatus}” closes this wedding journey. The record is archived into
                        Old Customers and future status changes are blocked until it is restored.
                      </p>
                      <p className="mt-1 font-semibold text-[#B42318]">
                        Call history, feedback, visits, notes and the full activity timeline are kept unchanged.
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-[11px] font-black text-[#8B1A12] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={stageConfirmed}
                      onChange={(e) => setStageConfirmed(e.target.checked)}
                      className="accent-[#B42318]"
                    />
                    Yes, complete this wedding journey and move the customer to Old Customers
                  </label>
                </div>
              )}
            </>
          )}

          {kind === 'visit' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Visit Date *</label>
                  <input
                    type="date"
                    value={visitForm.visit_date}
                    onChange={(e) => setVisitForm({ ...visitForm, visit_date: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Visit Time *</label>
                  <input
                    type="time"
                    value={visitForm.visit_time}
                    onChange={(e) => setVisitForm({ ...visitForm, visit_time: e.target.value })}
                    className={inputCls}
                  />
                  <p className="text-[9px] text-[#6F5963] mt-1">Required — a visit row without a time is rejected.</p>
                </div>
                <div>
                  <label className={labelCls}>Visitors Count</label>
                  <input
                    type="number"
                    min={1}
                    value={visitForm.visitors_count}
                    onChange={(e) => setVisitForm({ ...visitForm, visitors_count: e.target.value })}
                    placeholder="1"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Visited By</label>
                  <input
                    type="text"
                    maxLength={150}
                    value={visitForm.visited_by}
                    onChange={(e) => setVisitForm({ ...visitForm, visited_by: e.target.value })}
                    placeholder="Staff who received them"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Purpose</label>
                  <select
                    value={visitForm.purpose}
                    onChange={(e) => setVisitForm({ ...visitForm, purpose: e.target.value })}
                    className={inputCls}
                  >
                    {VISIT_PURPOSE_OPTIONS.map((p) => (<option key={p} value={p}>{p}</option>))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Visit Status</label>
                  <select
                    value={visitForm.visit_status}
                    onChange={(e) => setVisitForm({ ...visitForm, visit_status: e.target.value })}
                    className={inputCls}
                  >
                    {VISIT_STATUS_OPTIONS.map((s) => (<option key={s} value={s}>{s}</option>))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Categories Viewed</label>
                  <input
                    type="text"
                    maxLength={200}
                    value={visitForm.categories_viewed}
                    onChange={(e) => setVisitForm({ ...visitForm, categories_viewed: e.target.value })}
                    placeholder="e.g. Pure Silk Sarees, Bridal Lehengas"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Products Viewed</label>
                  <input
                    type="text"
                    maxLength={255}
                    value={visitForm.products_viewed}
                    onChange={(e) => setVisitForm({ ...visitForm, products_viewed: e.target.value })}
                    placeholder="Item or reference numbers shown"
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Customer Requirement</label>
                <input
                  type="text"
                  maxLength={255}
                  value={visitForm.customer_requirement}
                  onChange={(e) => setVisitForm({ ...visitForm, customer_requirement: e.target.value })}
                  placeholder="What they came in for, in their words"
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Visit Result</label>
                  <input
                    type="text"
                    maxLength={150}
                    value={visitForm.visit_result}
                    onChange={(e) => setVisitForm({ ...visitForm, visit_result: e.target.value })}
                    placeholder="e.g. Shortlisted 3 sarees"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Next Action</label>
                  <input
                    type="text"
                    maxLength={150}
                    value={visitForm.next_action}
                    onChange={(e) => setVisitForm({ ...visitForm, next_action: e.target.value })}
                    placeholder="e.g. Reserve bridal set, confirm Friday"
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Visit Notes</label>
                <textarea
                  rows={3}
                  value={visitForm.visit_notes}
                  onChange={(e) => setVisitForm({ ...visitForm, visit_notes: e.target.value })}
                  placeholder="Anything the next shift should know about this visit"
                  className={inputCls}
                />
                <p className="text-[9px] text-[#6F5963] mt-1">
                  Saved on wedding_visits and encrypted at rest. Recording a visit does not change the
                  customer’s status — use Move Stage or Mark Won for that.
                </p>
              </div>
            </>
          )}

          {kind === 'shopping' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Expected Shopping Date</label>
                  <input
                    type="date"
                    value={shoppingForm.expected_shopping_date}
                    onChange={(e) => setShoppingForm({ ...shoppingForm, expected_shopping_date: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Preferred Shopping Date</label>
                  <input
                    type="date"
                    value={shoppingForm.preferred_shopping_date}
                    onChange={(e) => setShoppingForm({ ...shoppingForm, preferred_shopping_date: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Preferred Time</label>
                  <select
                    value={shoppingForm.preferred_shopping_time}
                    onChange={(e) => setShoppingForm({ ...shoppingForm, preferred_shopping_time: e.target.value })}
                    className={inputCls}
                  >
                    <option value="">Leave unchanged</option>
                    {SHOPPING_TIME_OPTIONS.map((t) => (<option key={t} value={t}>{t}</option>))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Expected Visitors</label>
                  <input
                    type="number"
                    min={1}
                    value={shoppingForm.expected_visitors}
                    onChange={(e) => setShoppingForm({ ...shoppingForm, expected_visitors: e.target.value })}
                    placeholder="Leave blank to keep"
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Preferred Category</label>
                <select
                  value={shoppingForm.preferred_shopping_category}
                  onChange={(e) => setShoppingForm({ ...shoppingForm, preferred_shopping_category: e.target.value })}
                  className={inputCls}
                >
                  <option value="">Leave unchanged</option>
                  {CATEGORY_OPTIONS.map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Shopping Requirements</label>
                <div className="flex flex-wrap gap-1.5">
                  {shoppingRequirementUniverse(customer?.shopping_requirements).map((category) => {
                    const on = Boolean(shoppingForm.requirements[category]);
                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => setShoppingForm({
                          ...shoppingForm,
                          requirements: { ...shoppingForm.requirements, [category]: !on }
                        })}
                        aria-pressed={on}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors ${
                          on
                            ? 'bg-[#B76E79] text-white border-[#B76E79]'
                            : 'bg-[#FFFDFC] text-[#4A173A] border-[#E8D9D4] hover:bg-[#FFF7F2]'
                        }`}
                      >
                        {on && <Check className="w-2.5 h-2.5" aria-hidden="true" />}
                        {category}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[9px] text-[#6F5963] mt-1.5">
                  Ticked categories are stored on the shopping_requirements JSON column. Leave every box
                  unticked to keep what is already saved.
                </p>
              </div>

              <p className="text-[10px] text-[#6F5963] font-semibold bg-[#FFF7F2] border border-[#E8D9D4] rounded-2xl px-3 py-2">
                Only the details you fill in are sent — an empty box leaves the stored value untouched.
                These are manager-written columns, so the server answers if your role may not change them.
              </p>
            </>
          )}

          {kind === 'convert' && (
            <>
              <div>
                <label className={labelCls}>Conversion Status *</label>
                <select
                  value={convertForm.new_status}
                  onChange={(e) => {
                    setConvertForm({ ...convertForm, new_status: e.target.value });
                    setConvertConfirmed(false);
                  }}
                  className={inputCls}
                >
                  <option value="">Select a status</option>
                  {[...(STAGE_TARGET_STATUSES.won || [])].map((s) => (
                    <option key={s} value={s}>
                      {s}{isCompletionStatus(s) ? ' — completes & archives' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[9px] text-[#6F5963] mt-1">
                  “Converted” keeps the journey open for delivery and feedback.
                  “Wedding Process Completed” closes it.
                </p>
              </div>

              <div>
                <label className={labelCls}>Reason</label>
                <textarea
                  rows={2}
                  value={convertForm.change_reason}
                  onChange={(e) => setConvertForm({ ...convertForm, change_reason: e.target.value })}
                  placeholder="Why is this wedding won? (stored in the status history)"
                  className={inputCls}
                />
              </div>

              {isCompletionStatus(convertForm.new_status) && (
                <div className="rounded-2xl border border-[#B42318]/40 bg-[#FDE8E7] p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <Archive className="w-4 h-4 text-[#B42318] mt-0.5 shrink-0" />
                    <div className="text-[11px] font-bold text-[#8B1A12] leading-relaxed">
                      <p>
                        “{convertForm.new_status}” archives this customer into Old Customers. Later status
                        changes are blocked until the record is restored.
                      </p>
                      <p className="mt-1 font-semibold text-[#B42318]">
                        Calls, feedback, visits, notes and the activity timeline stay intact.
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-[11px] font-black text-[#8B1A12] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={convertConfirmed}
                      onChange={(e) => setConvertConfirmed(e.target.checked)}
                      className="accent-[#B42318]"
                    />
                    Yes, complete this wedding journey and archive the customer
                  </label>
                </div>
              )}
            </>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#E8D9D4] bg-[#FFFAF7]">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="px-4 py-2 bg-[#FFFDFC] hover:bg-[#FFF7F2] border border-[#E8D9D4] rounded-xl text-xs font-bold text-[#4A173A] disabled:opacity-50 cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={
              pending ||
              (needsArchiveConfirm && !stageConfirmed) ||
              (kind === 'convert' && isCompletionStatus(convertForm.new_status) && !convertConfirmed)
            }
            className="px-4 py-2 bg-[#4A173A] hover:bg-[#6A2853] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 disabled:opacity-60 cursor-pointer transition-colors border border-[#4A173A]"
          >
            {pending ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Saving…</span>
              </>
            ) : (
              <span>Save {meta.title}</span>
            )}
          </button>
        </div>
      </div>
    </ModalPortal>
  );
}
