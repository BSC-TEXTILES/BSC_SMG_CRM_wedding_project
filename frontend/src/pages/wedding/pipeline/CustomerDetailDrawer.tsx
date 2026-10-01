import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  X,
  RefreshCw,
  PhoneCall,
  MessageSquare,
  CalendarClock,
  StickyNote,
  ArrowRightLeft,
  CircleAlert,
  Edit3,
  Save,
  ExternalLink,
  Archive,
  User,
  Heart,
  ShoppingBag,
  History,
  MapPinned,
  FileText,
  FolderOpen,
  ListChecks,
  Plus,
  Trophy,
  Store,
  IndianRupee,
  Check
} from 'lucide-react';
import ModalPortal from '../../../components/ui/ModalPortal';
import { showToast } from '../../../components/Toast';
import { API, Auth } from '../../../services/api';
import { formatDateDisplay, formatDateTimeDisplay, parseDate, toISODateInput } from '../../../utils/dateUtils';
import {
  BUDGET_RANGES,
  CALL_TIME_OPTIONS,
  CATEGORY_OPTIONS,
  getStatusBadge,
  isCompletionStatus
} from '../weddingTypes';
import {
  QuickActionKind,
  STAGE_LABELS,
  STAGE_PRESENTATION,
  STAGE_TARGET_STATUSES,
  StageKey
} from './types';
import { JourneyTracker } from './PipelineCard';
import {
  WEDDING_FUNCTION_OPTIONS,
  boolText,
  boolValue,
  checkedRequirementPayload,
  rupeeText,
  shoppingRequirementMap,
  shoppingRequirementText,
  shoppingRequirementUniverse,
  weddingFunctionLabels,
  weddingFunctionValues
} from './pipelineDerived';

/**
 * CustomerDetailDrawer — right-side slide-in customer panel for the Wedding Status Pipeline.
 *
 * Built on ModalPortal (portal-to-body, scroll lock, Escape, backdrop click, z-index) and
 * loads GET /wedding-crm/customers/:id/full-profile lazily, only while open.
 *
 * Inline editing is the point of this panel, so every editable control below maps to a
 * column that the write endpoint actually honours (weddingController.js):
 *   PUT /customers/:id                 (updateCustomer — manager authority)
 *     customer_name, mobile_number, email, alternate_mobile, wedding_date, wedding_city,
 *     bride_name, groom_name, expected_shopping_date, preferred_shopping_category,
 *     estimated_family_size, budget (+budget_range), follow_up_date, preferred_call_time,
 *     assigned_telecaller(_id), customer_status, call_status, customer_notes, lead_source,
 *     location_id
 *     + the extended whitelist (buildExtendedFieldUpdate / EXTENSIBLE_CUSTOMER_FIELDS):
 *     priority, preferred_contact_method, preferred_followup_time, additional_notes,
 *     bride_age, bride_contact, bride_shopping_required, groom_age, groom_contact,
 *     groom_shopping_required, wedding_date_flexibility, wedding_venue, wedding_type,
 *     wedding_functions (JSON array), guest_count, shopping_requirements (JSON object),
 *     preferred_shopping_date, preferred_shopping_time, expected_visitors
 *   PUT /customers/:id/telecaller-edit (updateCustomerByTelecaller — telecaller authority)
 *     alternate_mobile, preferred_call_time, wedding_date, expected_shopping_date,
 *     preferred_shopping_category, budget, estimated_family_size, bride_name, groom_name,
 *     wedding_city, customer_status, follow_up_date, customer_notes
 *
 * Only the manager endpoint carries the extended journey fields, so those fields are
 * scoped 'full' below: a telecaller sees them read-only instead of being handed a box
 * that cannot save. The server stays authoritative either way — hiding a control is a
 * convenience, never the permission check.
 */

interface CustomerDetailDrawerProps {
  customerId: number | null;
  open: boolean;
  /** Server Asia/Kolkata calendar day (YYYY-MM-DD) — never the browser date. */
  today: string;
  /**
   * The `stage_key` the board response carried for this row. The full-profile
   * endpoint does not compute a stage, so without it the panel would have to map
   * the status string itself — which is exactly what the backend already decides.
   * It falls back to that mapping only when the board has not supplied one.
   */
  stageKey?: StageKey | null;
  canEdit: boolean;
  onClose: () => void;
  onChanged: (customerId: number) => void;
  onAction: (kind: QuickActionKind, customerId: number) => void;
}

type Scope = 'full' | 'limited';

type FieldKind =
  | 'text'
  | 'textarea'
  | 'date'
  | 'number'
  | 'select'
  | 'bool'
  | 'functions'
  | 'requirements';

interface FieldDef {
  name: string;
  label: string;
  kind: FieldKind;
  options?: string[];
  scopes: Scope[];
  hint?: string;
  maxLength?: number;
}

const MANAGER_ROLES = ['Admin', 'Super Admin', 'Manager', 'HR', 'Wedding Collection Manager', 'system administrator'];

/** weddingController.js COMPLETION_STATUSES minus the legacy alias. */
const WON_STATUSES = ['Converted'];
const COMPLETED_STATUSES = ['Wedding Process Completed'];

/* Vocabularies mirrored from the registration form (pages/WeddingRegistration.tsx),
   which is what writes these columns today. Any stored value outside the list is
   still offered as an extra option, so an edit never silently rewrites it. */
const WEDDING_TYPES = ['Hindu Wedding', 'Muslim Wedding', 'Christian Wedding', 'Jain Wedding', 'Sikh Wedding', 'Other'];
const DATE_FLEXIBILITY_OPTIONS = ['Fixed Date', 'Flexible Date', 'Not Decided'];
const CONTACT_METHOD_OPTIONS = ['Phone Call', 'WhatsApp', 'SMS', 'Email'];
const SHOPPING_TIME_OPTIONS = ['Morning', 'Afternoon', 'Evening', 'Flexible'];
const FOLLOWUP_TIME_OPTIONS = [...CALL_TIME_OPTIONS, '9 AM – 12 PM', '12 PM – 3 PM', '3 PM – 6 PM', '6 PM – 9 PM']
  .filter((v, i, arr) => arr.indexOf(v) === i);
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Urgent'];

/** wedding_visits.visit_status / wedding_purchases are free VARCHARs server-side.
   These are the values this store already uses; the stored value stays selectable. */
const VISIT_STATUS_OPTIONS = ['Visit Planned', 'Visited Store', 'Shopping In Progress', 'Shopping Completed', 'No Show', 'Visit Cancelled'];
const PURCHASE_STATUS_OPTIONS = ['Purchase Completed', 'Partial Purchase', 'Purchase Planned', 'Return Requested'];
const PAYMENT_STATUS_OPTIONS = ['Paid', 'Partially Paid', 'Pending', 'Refunded'];

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'customer', label: 'Customer' },
  { key: 'wedding', label: 'Wedding' },
  { key: 'shopping', label: 'Shopping Plan' },
  { key: 'visits', label: 'Store Visits' },
  { key: 'progress', label: 'Shopping Progress' },
  { key: 'conversion', label: 'Conversion' },
  { key: 'calls', label: 'Call History' },
  { key: 'followups', label: 'Follow-Ups' },
  { key: 'feedback', label: 'Feedback' },
  { key: 'status', label: 'Status Tracker' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'notes', label: 'Notes' },
  { key: 'documents', label: 'Documents' }
] as const;

type TabKey = (typeof TABS)[number]['key'];

const SECTION_FIELDS: Record<string, FieldDef[]> = {
  overview: [
    { name: 'follow_up_date', label: 'Next Follow-Up Date', kind: 'date', scopes: ['full', 'limited'] },
    { name: 'preferred_call_time', label: 'Preferred Call Time', kind: 'select', options: CALL_TIME_OPTIONS, scopes: ['full', 'limited'] },
    {
      name: 'preferred_followup_time',
      label: 'Preferred Follow-Up Time',
      kind: 'select',
      options: FOLLOWUP_TIME_OPTIONS,
      scopes: ['full'],
      hint: 'Saved on the customer record — this is the slot the next call is promised for.'
    },
    { name: 'priority', label: 'Priority', kind: 'select', options: PRIORITY_OPTIONS, scopes: ['full'] },
    {
      name: 'assigned_telecaller',
      label: 'Assigned Telecaller',
      kind: 'select',
      scopes: ['full'],
      hint: 'Choosing someone assigns or reassigns the book. The endpoint keeps the current owner when the field is sent empty, so use Assign on the desk to unassign.'
    },
    {
      name: 'customer_notes',
      label: 'Customer Notes (record field)',
      kind: 'textarea',
      scopes: ['full', 'limited'],
      hint: 'Managers can clear this field; the telecaller endpoint only stores non-empty notes.'
    },
    {
      name: 'additional_notes',
      label: 'Additional Notes',
      kind: 'textarea',
      scopes: ['full'],
      hint: 'Encrypted at rest and decrypted when this profile is read.'
    }
  ],
  customer: [
    { name: 'customer_name', label: 'Customer Name', kind: 'text', scopes: ['full'], maxLength: 150 },
    { name: 'mobile_number', label: 'Mobile Number', kind: 'text', scopes: ['full'], maxLength: 20 },
    { name: 'alternate_mobile', label: 'Alternate Mobile', kind: 'text', scopes: ['full', 'limited'], maxLength: 20 },
    { name: 'email', label: 'Email', kind: 'text', scopes: ['full'], maxLength: 150 },
    { name: 'estimated_family_size', label: 'Estimated Family Size', kind: 'number', scopes: ['full', 'limited'] },
    { name: 'lead_source', label: 'Lead Source', kind: 'text', scopes: ['full'], maxLength: 100 },
    {
      name: 'preferred_contact_method',
      label: 'Preferred Contact Method',
      kind: 'select',
      options: CONTACT_METHOD_OPTIONS,
      scopes: ['full']
    }
  ],
  wedding: [
    { name: 'wedding_date', label: 'Wedding Date', kind: 'date', scopes: ['full', 'limited'] },
    { name: 'wedding_date_flexibility', label: 'Date Flexibility', kind: 'select', options: DATE_FLEXIBILITY_OPTIONS, scopes: ['full'] },
    { name: 'wedding_venue', label: 'Wedding Venue', kind: 'text', scopes: ['full'], maxLength: 200 },
    { name: 'wedding_city', label: 'Wedding City', kind: 'text', scopes: ['full', 'limited'], maxLength: 100 },
    { name: 'wedding_type', label: 'Wedding Type', kind: 'select', options: WEDDING_TYPES, scopes: ['full'] },
    { name: 'guest_count', label: 'Guest Count', kind: 'number', scopes: ['full'] },
    { name: 'bride_name', label: 'Bride Name', kind: 'text', scopes: ['full', 'limited'], maxLength: 150 },
    { name: 'bride_age', label: 'Bride Age', kind: 'number', scopes: ['full'] },
    { name: 'bride_contact', label: 'Bride Contact', kind: 'text', scopes: ['full'], maxLength: 20 },
    { name: 'bride_shopping_required', label: 'Bride Shopping Required', kind: 'bool', scopes: ['full'] },
    { name: 'groom_name', label: 'Groom Name', kind: 'text', scopes: ['full', 'limited'], maxLength: 150 },
    { name: 'groom_age', label: 'Groom Age', kind: 'number', scopes: ['full'] },
    { name: 'groom_contact', label: 'Groom Contact', kind: 'text', scopes: ['full'], maxLength: 20 },
    { name: 'groom_shopping_required', label: 'Groom Shopping Required', kind: 'bool', scopes: ['full'] },
    {
      name: 'wedding_functions',
      label: 'Wedding Functions',
      kind: 'functions',
      scopes: ['full'],
      hint: 'Stored as a JSON array of function ids, exactly as the registration form writes them.'
    }
  ],
  shopping: [
    { name: 'expected_shopping_date', label: 'Expected Shopping Date', kind: 'date', scopes: ['full', 'limited'] },
    { name: 'preferred_shopping_date', label: 'Preferred Shopping Date', kind: 'date', scopes: ['full'] },
    { name: 'preferred_shopping_time', label: 'Preferred Shopping Time', kind: 'select', options: SHOPPING_TIME_OPTIONS, scopes: ['full'] },
    {
      name: 'preferred_shopping_category',
      label: 'Preferred Category',
      kind: 'select',
      options: CATEGORY_OPTIONS,
      scopes: ['full', 'limited']
    },
    { name: 'budget', label: 'Budget', kind: 'select', options: BUDGET_RANGES, scopes: ['full', 'limited'] },
    { name: 'expected_visitors', label: 'Expected Visitors', kind: 'number', scopes: ['full'] },
    {
      name: 'shopping_requirements',
      label: 'Shopping Requirements',
      kind: 'requirements',
      scopes: ['full'],
      hint: 'Stored as a JSON object of requirement categories. Categories already on this record stay listed.'
    }
  ]
};

// ── tiny display helpers ───────────────────────────────────────────────────
const text = (v: any): string => {
  if (v === null || v === undefined) return '';
  const s = String(v).trim();
  if (!s || /^0{4}[-/]0{2}[-/]0{2}/.test(s)) return '';
  return s;
};
const show = (v: any, fallback = 'Not provided'): string => text(v) || fallback;
const showDate = (v: any, fallback = 'Not scheduled'): string =>
  parseDate(v) ? formatDateDisplay(v, fallback) : fallback;
const clockOf = (v: any): string => {
  const s = text(v);
  if (s && /^\d{1,2}:\d{2}/.test(s)) {
    const [h, m] = s.split(':');
    return `${String(h).padStart(2, '0')}:${String(m).slice(0, 2)}`;
  }
  const d = parseDate(v);
  if (!d) return '';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};
const normaliseMobile = (v: any): string => {
  const digits = text(v).replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  return text(v);
};
const stageOfStatus = (status?: string | null): StageKey => {
  const s = (status || '').trim();
  const keys = Object.keys(STAGE_TARGET_STATUSES) as StageKey[];
  for (const key of keys) {
    if ((STAGE_TARGET_STATUSES[key] || []).some((v) => v.toLowerCase() === s.toLowerCase())) return key;
  }
  return 'other';
};
const daysBetween = (fromISO: string, toISO: string): number => {
  const a = parseDate(fromISO);
  const b = parseDate(toISO);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
};

export default function CustomerDetailDrawer({
  customerId,
  open,
  today,
  stageKey: boardStageKey,
  canEdit,
  onClose,
  onChanged,
  onAction
}: CustomerDetailDrawerProps) {
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const [timelineEvents, setTimelineEvents] = useState<any[] | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState('');

  const [extraDocs, setExtraDocs] = useState<any[] | null>(null);

  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [sectionError, setSectionError] = useState('');
  const [sectionNotice, setSectionNotice] = useState('');

  const [noteDraft, setNoteDraft] = useState({ note_content: '', note_type: 'General' });
  const [savingNote, setSavingNote] = useState(false);

  // Store-visit and purchase forms are per-record inline editors, not modals: the
  // whole point of this panel is managing the journey without leaving the page.
  const [visitForm, setVisitForm] = useState<any | null>(null);
  const [savingVisit, setSavingVisit] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState<any | null>(null);
  const [savingPurchase, setSavingPurchase] = useState(false);
  const [convertDraft, setConvertDraft] = useState({ new_status: '', change_reason: '' });
  const [convertConfirmed, setConvertConfirmed] = useState(false);
  const [savingConvert, setSavingConvert] = useState(false);

  const [telecallers, setTelecallers] = useState<any[]>([]);

  const customer: any = profile?.customer || null;

  // Which write endpoint this user goes through. The server stays authoritative;
  // a 403 simply retries through the other endpoint (see writeCustomerFields).
  const scope: Scope = useMemo(() => {
    const sessRole = String(Auth.get()?.role || '');
    return MANAGER_ROLES.includes(sessRole) ? 'full' : 'limited';
  }, []);

  const isoToday = toISODateInput(today) || today;

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (customerId === null || customerId === undefined) return;
    if (!options?.silent) {
      setLoading(true);
      setError('');
    }
    try {
      const res: any = await API.getWeddingFullProfile(customerId);
      setProfile(res || null);
      setError('');
    } catch (err: any) {
      const msg = String(err?.message || '').trim()
        || 'We could not open this customer. Please try again.';
      setError(msg);
      if (!options?.silent) setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  // Lazy: fetch only while the drawer is open for a customer.
  useEffect(() => {
    if (!open || customerId === null || customerId === undefined) return;
    setActiveTab('overview');
    setEditingSection(null);
    setTimelineEvents(null);
    setTimelineError('');
    setExtraDocs(null);
    setNoteDraft({ note_content: '', note_type: 'General' });
    setVisitForm(null);
    setPurchaseForm(null);
    setConvertDraft({ new_status: '', change_reason: '' });
    setConvertConfirmed(false);
    load();
  }, [open, customerId, load]);

  useEffect(() => {
    if (!open || customerId === null || customerId === undefined) return;
    API.getWeddingTelecallers(customer?.location_id)
      .then((res: any) => {
        setTelecallers(Array.isArray(res?.telecallers) ? res.telecallers : (Array.isArray(res?.data) ? res.data : []));
      })
      .catch(() => setTelecallers([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customerId]);

  // Timeline tab: fetched on first use only.
  useEffect(() => {
    if (!open || activeTab !== 'timeline' || customerId === null || timelineEvents !== null || timelineLoading) return;
    let cancelled = false;
    setTimelineLoading(true);
    setTimelineError('');
    API.getWeddingCustomerTimeline(customerId)
      .then((res: any) => {
        if (cancelled) return;
        setTimelineEvents(Array.isArray(res?.timeline) ? res.timeline : []);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setTimelineError(String(err?.message || 'We could not load the activity timeline.'));
      })
      .finally(() => { if (!cancelled) setTimelineLoading(false); });
    return () => { cancelled = true; };
  }, [open, activeTab, customerId, timelineEvents, timelineLoading]);

  // Documents tab: profile.documents is authoritative; confirm with the dedicated endpoint.
  useEffect(() => {
    if (!open || activeTab !== 'documents' || customerId === null || extraDocs !== null) return;
    let cancelled = false;
    API.getWeddingDocuments(customerId)
      .then((res: any) => {
        if (cancelled) return;
        setExtraDocs(Array.isArray(res?.documents) ? res.documents : []);
      })
      .catch(() => { if (!cancelled) setExtraDocs([]); });
    return () => { cancelled = true; };
  }, [open, activeTab, customerId, extraDocs]);

  const callLogs: any[] = Array.isArray(profile?.callLogs) ? profile.callLogs : [];
  const visits: any[] = Array.isArray(profile?.visits) ? profile.visits : [];
  const purchases: any[] = Array.isArray(profile?.purchases) ? profile.purchases : [];
  const notes: any[] = Array.isArray(profile?.notes) ? profile.notes : [];
  const communications: any[] = Array.isArray(profile?.communications) ? profile.communications : [];
  const statusHistory: any[] = Array.isArray(profile?.statusHistory) ? profile.statusHistory : [];
  const auditLogs: any[] = Array.isArray(profile?.auditLogs) ? profile.auditLogs : [];
  const profileDocs: any[] = Array.isArray(profile?.documents) ? profile.documents : [];

  const followUpComms = useMemo(
    () => communications.filter((c) => text(c.communication_type).toLowerCase() === 'follow-up'),
    [communications]
  );
  const feedbackComms = useMemo(
    () => communications.filter((c) => text(c.communication_type).toLowerCase() === 'feedback'),
    [communications]
  );
  const documents = useMemo(() => {
    const merged = [...profileDocs];
    const seen = new Set(merged.map((d: any) => `doc-${d.id}`));
    (extraDocs || []).forEach((d: any) => {
      // Never drop a row: only add documents the profile response did not carry.
      if (!seen.has(`doc-${d.id}`)) merged.push(d);
    });
    return merged;
  }, [profileDocs, extraDocs]);

  const isOverdue = (value: any) => {
    const d = toISODateInput(value);
    if (!d || !isoToday) return false;
    return d < isoToday;
  };
  const isDueToday = (value: any) => {
    const d = toISODateInput(value);
    return Boolean(d && isoToday && d === isoToday);
  };

  // ── Editing ──────────────────────────────────────────────────────────────
  /** The draft holds each kind in the shape its control needs, not as a string. */
  const fieldInitial = (f: FieldDef): any => {
    const raw = customer?.[f.name];
    switch (f.kind) {
      case 'date':
        return toISODateInput(raw);
      case 'number':
        return raw === null || raw === undefined ? '' : String(raw);
      case 'bool':
        return boolValue(raw);
      case 'functions':
        return weddingFunctionValues(raw);
      case 'requirements':
        return shoppingRequirementMap(raw);
      default: {
        if (f.name === 'mobile_number' || f.name === 'alternate_mobile') {
          return text(raw).replace(/\D/g, '').slice(-10);
        }
        return text(raw);
      }
    }
  };

  /** Arrays and JSON maps compare by content, so auntouched checkbox never "changes". */
  const sameFieldValue = (a: any, b: any): boolean => {
    if (a === b) return true;
    if (Array.isArray(a) && Array.isArray(b)) {
      return a.length === b.length && a.every((v, i) => v === b[i]);
    }
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      const ak = Object.keys(a);
      const bk = Object.keys(b);
      if (ak.length !== bk.length) return false;
      return ak.every((k) => Object.prototype.hasOwnProperty.call(b, k) && Boolean(a[k]) === Boolean(b[k]));
    }
    return false;
  };

  /** Value → what the API accepts. Dates go through toISODateInput, never raw strings. */
  const fieldPayload = (f: FieldDef, next: any): any => {
    switch (f.kind) {
      case 'date': {
        const iso = toISODateInput(next);
        return iso || null;
      }
      case 'number': {
        const raw = String(next ?? '').trim();
        if (!raw) return null;
        const n = parseInt(raw, 10);
        return Number.isFinite(n) ? n : null;
      }
      case 'bool':
        return Boolean(next);
      case 'functions':
        return Array.isArray(next) ? next : [];
      case 'requirements': {
        const map = next && typeof next === 'object' && !Array.isArray(next) ? next : {};
        return checkedRequirementPayload(Object.keys(map).filter((k) => map[k]));
      }
      default: {
        const s = String(next ?? '').trim();
        if (f.name === 'mobile_number' || f.name === 'alternate_mobile') {
          // mobile_number is NOT NULL: an emptied primary mobile is rejected by the
          // validation below rather than sent. An emptied alternate is a real clear.
          return s ? normaliseMobile(s) : null;
        }
        return s || null;
      }
    }
  };

  const openSection = (sectionKey: string) => {
    const fields = (SECTION_FIELDS[sectionKey] || []).filter((f) => f.scopes.includes(scope));
    const next: Record<string, any> = {};
    fields.forEach((f) => { next[f.name] = fieldInitial(f); });
    if (sectionKey === 'overview' && scope === 'full') {
      next.assigned_telecaller = customer?.assigned_telecaller ? text(customer.assigned_telecaller) : '';
      next.assigned_telecaller_id = customer?.assigned_telecaller_id ? String(customer.assigned_telecaller_id) : '';
    }
    setDraft(next);
    setSectionError('');
    setSectionNotice('');
    setEditingSection(sectionKey);
  };

  const closeSection = () => {
    if (saving) return;
    setEditingSection(null);
    setSectionError('');
    setSectionNotice('');
  };

  const writeCustomerFields = async (payload: Record<string, any>) => {
    if (customerId === null) return;
    if (scope === 'full') {
      try {
        return await API.updateWeddingCustomer(customerId, payload);
      } catch (err: any) {
        if (err?.status === 403) return await API.updateWeddingCustomerByTelecaller(customerId, payload);
        throw err;
      }
    }
    try {
      return await API.updateWeddingCustomerByTelecaller(customerId, payload);
    } catch (err: any) {
      if (err?.status === 403) return await API.updateWeddingCustomer(customerId, payload);
      throw err;
    }
  };

  /**
   * One save path for every customer field, shared by the section editors and the
   * shopping-progress editor. Success is only ever announced after the request
   * actually resolved, and a server 400 message is shown verbatim.
   */
  const saveCustomerPatch = async (payload: Record<string, any>): Promise<boolean> => {
    if (customerId === null) return false;
    setSaving(true);
    setSectionError('');
    try {
      const res: any = await writeCustomerFields(payload);
      if (res?.success === false) throw new Error(text(res?.message) || 'save failed');
      showToast('Customer updated successfully.', 'success');
      setEditingSection(null);
      await load({ silent: true });
      onChanged(customerId);
      return true;
    } catch (err: any) {
      // apiFetch rethrows the server `message`, so "Enter a valid date for
      // preferredShoppingDate." reaches the user unchanged.
      setSectionError(String(err?.message || '').trim() || 'Unable to save changes. Please try again.');
      showToast('Unable to save changes. Please try again.', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveSection = async (sectionKey: string) => {
    if (customerId === null || saving) return;
    const fields = (SECTION_FIELDS[sectionKey] || []).filter((f) => f.scopes.includes(scope));
    const payload: Record<string, any> = {};

    for (const f of fields) {
      const next = draft[f.name];
      if (sameFieldValue(next, fieldInitial(f))) continue;
      payload[f.name] = fieldPayload(f, next);
    }

    if (sectionKey === 'overview' && scope === 'full') {
      const callerId = String(draft.assigned_telecaller_id ?? '').trim();
      const caller = telecallers.find((t: any) => String(t.id) === callerId);
      if (caller && String(customer?.assigned_telecaller_id ?? '') !== callerId) {
        payload.assigned_telecaller_id = caller.id;
        payload.assigned_telecaller = caller.full_name || caller.username || '';
      }
    }

    if (Object.keys(payload).length === 0) {
      setSectionNotice('Nothing changed to save.');
      return;
    }

    // Local guards only — the server validates again and its wording wins.
    if (fields.some((f) => f.name === 'mobile_number')) {
      const digits = String(draft.mobile_number ?? '').replace(/\D/g, '');
      if (digits.length !== 10) {
        setSectionError('Please enter a valid 10-digit mobile number.');
        return;
      }
    }
    if (fields.some((f) => f.name === 'customer_name') && !String(draft.customer_name ?? '').trim()) {
      setSectionError('Customer name is required.');
      return;
    }
    const badNumber = fields.find(
      (f) => f.kind === 'number' &&
        String(draft[f.name] ?? '').trim() !== '' &&
        !Number.isFinite(parseInt(String(draft[f.name]), 10))
    );
    if (badNumber) {
      setSectionError(`Enter a whole number for ${badNumber.label}.`);
      return;
    }
    const badDate = fields.find(
      (f) => f.kind === 'date' &&
        String(draft[f.name] ?? '').trim() !== '' &&
        !parseDate(draft[f.name])
    );
    if (badDate) {
      setSectionError(`Enter a valid date for ${badDate.label}.`);
      return;
    }

    await saveCustomerPatch(payload);
  };

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (customerId === null || savingNote) return;
    if (!noteDraft.note_content.trim()) {
      setSectionError('Note content is required.');
      return;
    }
    setSavingNote(true);
    setSectionError('');
    try {
      const res: any = await API.createWeddingNote(customerId, {
        note_content: noteDraft.note_content.trim(),
        note_type: noteDraft.note_type
      });
      showToast(text(res?.message) || 'Note added.', 'success');
      setNoteDraft({ note_content: '', note_type: 'General' });
      await load({ silent: true });
      onChanged(customerId);
    } catch (err: any) {
      setSectionError(String(err?.message || '').trim() || 'The note could not be saved. Please try again.');
      showToast('Unable to save changes. Please try again.', 'error');
    } finally {
      setSavingNote(false);
    }
  };

  // ── Store visits: create & edit in place via the visit endpoints ─────────
  const blankVisit = useCallback(() => ({
    id: null as number | null,
    visit_date: isoToday,
    visit_time: '',
    visitors_count: '',
    visited_by: text(Auth.get()?.fullName || ''),
    purpose: '',
    products_viewed: '',
    categories_viewed: '',
    customer_requirement: '',
    visit_result: '',
    next_action: '',
    visit_notes: '',
    visit_status: 'Visit Planned'
  }), [isoToday]);

  const openVisitForm = (v?: any) => {
    if (savingVisit) return;
    if (!v) {
      setVisitForm(blankVisit());
    } else {
      setVisitForm({
        id: v.id,
        visit_date: toISODateInput(v.visit_date) || isoToday,
        visit_time: /^\d{1,2}:\d{2}/.test(text(v.visit_time)) ? text(v.visit_time).slice(0, 5) : '',
        visitors_count: v.visitors_count === null || v.visitors_count === undefined ? '' : String(v.visitors_count),
        visited_by: text(v.visited_by || v.created_by),
        purpose: text(v.purpose),
        products_viewed: text(v.products_viewed),
        categories_viewed: text(v.categories_viewed),
        customer_requirement: text(v.customer_requirement),
        visit_result: text(v.visit_result),
        next_action: text(v.next_action),
        visit_notes: text(v.visit_notes),
        visit_status: text(v.visit_status) || 'Visit Planned'
      });
    }
    setSectionError('');
  };

  const saveVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (customerId === null || savingVisit || !visitForm) return;

    const visitDate = toISODateInput(visitForm.visit_date);
    // createVisit answers 400 when either is missing, so the form asks first.
    if (!visitDate) {
      setSectionError('Visit date is required.');
      return;
    }
    if (!/^\d{1,2}:\d{2}$/.test(String(visitForm.visit_time || '').trim())) {
      setSectionError('Visit time is required (24-hour HH:MM).');
      return;
    }

    const visitors = String(visitForm.visitors_count ?? '').trim();
    if (visitors && !Number.isFinite(parseInt(visitors, 10))) {
      setSectionError('Enter a whole number for Visitors Count.');
      return;
    }

    // Every column the endpoint writes is sent, because updateVisit overwrites the
    // whole row — a partial payload would blank the fields left out.
    const payload: Record<string, any> = {
      visit_date: visitDate,
      visit_time: String(visitForm.visit_time).trim(),
      visitors_count: visitors ? parseInt(visitors, 10) : 1,
      visited_by: text(visitForm.visited_by) || null,
      purpose: text(visitForm.purpose) || null,
      products_viewed: text(visitForm.products_viewed) || null,
      categories_viewed: text(visitForm.categories_viewed) || null,
      customer_requirement: text(visitForm.customer_requirement) || null,
      visit_result: text(visitForm.visit_result) || null,
      next_action: text(visitForm.next_action) || null,
      visit_notes: text(visitForm.visit_notes) || null,
      visit_status: text(visitForm.visit_status) || 'Visit Planned'
    };

    setSavingVisit(true);
    setSectionError('');
    try {
      const res: any = visitForm.id
        ? await API.updateWeddingVisit(visitForm.id, payload)
        : await API.createWeddingVisit(customerId, payload);
      if (res?.success === false) throw new Error(text(res?.message) || 'save failed');
      showToast(visitForm.id ? 'Visit updated successfully.' : 'Store visit recorded.', 'success');
      setVisitForm(null);
      await load({ silent: true });
      onChanged(customerId);
    } catch (err: any) {
      setSectionError(String(err?.message || '').trim() || 'Unable to save changes. Please try again.');
      showToast('Unable to save changes. Please try again.', 'error');
    } finally {
      setSavingVisit(false);
    }
  };

  // ── Purchases: the conversion record ─────────────────────────────────────
  const blankPurchase = useCallback(() => ({
    bill_number: '',
    purchase_date: isoToday,
    store_location: text(customer?.location_name || ''),
    total_amount: '',
    discount_amount: '',
    net_amount: '',
    payment_status: 'Pending',
    sales_employee: '',
    product_categories: '',
    purchase_notes: '',
    purchase_status: 'Purchase Completed'
  }), [isoToday, customer?.location_name]);

  const openPurchaseForm = () => {
    if (savingPurchase) return;
    setPurchaseForm(blankPurchase());
    setSectionError('');
  };

  const savePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (customerId === null || savingPurchase || !purchaseForm) return;

    const purchaseDate = toISODateInput(purchaseForm.purchase_date);
    if (!purchaseDate) {
      setSectionError('Purchase date is required.');
      return;
    }
    const numeric = ['total_amount', 'discount_amount', 'net_amount'];
    const bad = numeric.find((k) => {
      const raw = String(purchaseForm[k] ?? '').trim();
      return raw !== '' && !Number.isFinite(Number(raw));
    });
    if (bad) {
      setSectionError('Enter a valid amount for the bill figures.');
      return;
    }

    const total = Number(String(purchaseForm.total_amount ?? '').trim() || 0);
    const discount = Number(String(purchaseForm.discount_amount ?? '').trim() || 0);
    const netRaw = String(purchaseForm.net_amount ?? '').trim();
    const net = netRaw !== '' ? Number(netRaw) : Math.max(0, total - discount);

    const payload: Record<string, any> = {
      bill_number: text(purchaseForm.bill_number) || null,
      purchase_date: purchaseDate,
      store_location: text(purchaseForm.store_location) || null,
      total_amount: total,
      discount_amount: discount,
      net_amount: net,
      payment_status: text(purchaseForm.payment_status) || 'Pending',
      sales_employee: text(purchaseForm.sales_employee) || null,
      product_categories: text(purchaseForm.product_categories) || null,
      purchase_notes: text(purchaseForm.purchase_notes) || null,
      purchase_status: text(purchaseForm.purchase_status) || 'Purchase Completed'
    };

    setSavingPurchase(true);
    setSectionError('');
    try {
      const res: any = await API.createWeddingPurchase(customerId, payload);
      if (res?.success === false) throw new Error(text(res?.message) || 'save failed');
      showToast('Purchase recorded.', 'success');
      setPurchaseForm(null);
      await load({ silent: true });
      onChanged(customerId);
    } catch (err: any) {
      setSectionError(String(err?.message || '').trim() || 'Unable to save changes. Please try again.');
      showToast('Unable to save changes. Please try again.', 'error');
    } finally {
      setSavingPurchase(false);
    }
  };

  // ── Conversion: the status write, with the archive step kept deliberate ──
  const convertTargets = useMemo(() => [...WON_STATUSES, ...COMPLETED_STATUSES], []);
  const convertArchives = isCompletionStatus(convertDraft.new_status);

  const saveConversion = async () => {
    if (customerId === null || savingConvert) return;
    if (!convertDraft.new_status) {
      setSectionError('Select the status that marks this wedding won.');
      return;
    }
    if (convertArchives && !convertConfirmed) {
      setSectionError('Please confirm the completion step before saving.');
      return;
    }
    setSavingConvert(true);
    setSectionError('');
    try {
      const res: any = await API.changeWeddingCustomerStatus(
        customerId,
        convertDraft.new_status,
        text(convertDraft.change_reason) || undefined
      );
      if (res?.success === false) throw new Error(text(res?.message) || 'save failed');
      showToast(
        res?.archived
          ? 'Customer completed and moved to Old Customers.'
          : `Customer marked as ${convertDraft.new_status}.`,
        'success'
      );
      setConvertDraft({ new_status: '', change_reason: '' });
      setConvertConfirmed(false);
      await load({ silent: true });
      onChanged(customerId);
    } catch (err: any) {
      // 409 OLD_CUSTOMER_READONLY and every other server message arrives verbatim.
      setSectionError(String(err?.message || '').trim() || 'Unable to save changes. Please try again.');
      showToast('Unable to save changes. Please try again.', 'error');
    } finally {
      setSavingConvert(false);
    }
  };

  // ── Activity timeline: append-only merge of every history source ─────────
  const journey = useMemo(() => {
    type Ev = { key: string; ts: number; day: string; time: string; action: string; detail: string; actor: string; source: string };
    const events: Ev[] = [];
    const push = (ev: Ev) => { if (ev.ts) events.push(ev); };

    auditLogs.forEach((a: any) => {
      const ts = a.created_at ? new Date(a.created_at).getTime() : 0;
      push({
        key: `audit-${a.id}`,
        ts,
        day: toISODateInput(a.created_at),
        time: clockOf(a.created_at),
        action: text(a.action) || 'Activity',
        detail: text(a.details),
        actor: text(a.user_name) || 'System',
        source: 'Audit'
      });
    });

    statusHistory.forEach((s: any) => {
      const ts = s.created_at ? new Date(s.created_at).getTime() : 0;
      push({
        key: `status-${s.id}`,
        ts,
        day: toISODateInput(s.created_at),
        time: clockOf(s.created_at),
        action: `Status: ${show(s.old_status, '—')} → ${show(s.new_status, '—')}`,
        detail: text(s.change_reason),
        actor: text(s.changed_by) || 'Staff',
        source: 'Status'
      });
    });

    callLogs.forEach((c: any) => {
      const day = toISODateInput(c.call_date) || toISODateInput(c.created_at);
      const ts = parseDate(day) ? new Date(`${day}T${clockOf(c.call_time) || '00:00'}:00`).getTime() : 0;
      push({
        key: `call-${c.id}`,
        ts: ts || (c.created_at ? new Date(c.created_at).getTime() : 0),
        day,
        time: clockOf(c.call_time),
        action: `Call — ${show(c.call_outcome, 'no outcome')}`,
        detail: [
          text(c.call_status) ? `Status: ${text(c.call_status)}` : '',
          text(c.customer_response) ? `Response: ${text(c.customer_response)}` : '',
          text(c.remarks) ? `Remarks: ${text(c.remarks)}` : '',
          text(c.next_follow_up_date) ? `Next follow-up: ${showDate(c.next_follow_up_date)}${text(c.next_follow_up_time) ? ` (${text(c.next_follow_up_time)})` : ''}` : ''
        ].filter(Boolean).join(' · '),
        actor: text(c.telecaller_name) || 'Telecaller',
        source: 'Call'
      });
    });

    communications.forEach((c: any) => {
      const day = toISODateInput(c.communication_date) || toISODateInput(c.created_at);
      const ts = parseDate(day) ? new Date(`${day}T${clockOf(c.communication_time) || '00:00'}:00`).getTime() : 0;
      push({
        key: `comm-${c.id}`,
        ts: ts || (c.created_at ? new Date(c.created_at).getTime() : 0),
        day,
        time: clockOf(c.communication_time),
        action: `${show(c.communication_type, 'Communication')} — ${show(c.communication_method, 'no method')}`,
        detail: [text(c.communication_details), text(c.outcome) ? `Outcome: ${text(c.outcome)}` : '',
          text(c.next_follow_up_date) ? `Next follow-up: ${showDate(c.next_follow_up_date)}` : ''].filter(Boolean).join('\n'),
        actor: text(c.employee_name) || 'Staff',
        source: 'Communication'
      });
    });

    notes.forEach((n: any) => {
      const ts = n.created_at ? new Date(n.created_at).getTime() : 0;
      push({
        key: `note-${n.id}`,
        ts,
        day: toISODateInput(n.created_at),
        time: clockOf(n.created_at),
        action: `Note (${show(n.note_type, 'General')})`,
        detail: text(n.note_content),
        actor: text(n.created_by) || 'Staff',
        source: 'Note'
      });
    });

    visits.forEach((v: any) => {
      const day = toISODateInput(v.visit_date) || toISODateInput(v.created_at);
      const ts = parseDate(day) ? new Date(`${day}T${clockOf(v.visit_time) || '00:00'}:00`).getTime() : 0;
      push({
        key: `visit-${v.id}`,
        ts: ts || (v.created_at ? new Date(v.created_at).getTime() : 0),
        day,
        time: clockOf(v.visit_time),
        action: `Visit — ${show(v.visit_status, 'store visit')}`,
        detail: [
          text(v.purpose) ? `Purpose: ${text(v.purpose)}` : '',
          v.visitors_count ? `Visitors: ${v.visitors_count}` : '',
          text(v.visit_result) ? `Result: ${text(v.visit_result)}` : '',
          text(v.visit_notes) ? `Notes: ${text(v.visit_notes)}` : ''
        ].filter(Boolean).join(' · '),
        actor: text(v.created_by) || text(v.visited_by) || 'Store Staff',
        source: 'Visit'
      });
    });

    const seen = new Set(events.map((e) => e.key));
    (timelineEvents || []).forEach((t: any) => {
      const key = String(t.id || `srv-${t.type}-${t.timestamp}`);
      // Server rows for calls / visits / audits are already merged above; this keeps
      // the registration and WhatsApp events the profile payload does not carry.
      if (seen.has(key)) return;
      const ts = t.timestamp ? new Date(t.timestamp).getTime() : 0;
      if (!ts) return;
      push({
        key,
        ts,
        day: toISODateInput(t.timestamp),
        time: clockOf(t.timestamp),
        action: text(t.title) || show(t.type, 'Activity'),
        detail: [text(t.details), text(t.subdetails)].filter(Boolean).join(' · '),
        actor: text(t.actor) || 'System',
        source: show(t.type, 'Activity')
      });
    });

    // Every event stays; only exact duplicates across the two feeds collapse.
    const sorted = events.sort((a, b) => b.ts - a.ts);
    const groups: { day: string; items: Ev[] }[] = [];
    for (const ev of sorted) {
      const day = ev.day || 'unknown';
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.items.push(ev);
      else groups.push({ day, items: [ev] });
    }
    return { groups, total: sorted.length };
  }, [auditLogs, statusHistory, callLogs, communications, notes, visits, timelineEvents]);

  // ── Follow-up history: Follow-Up communications + scheduled dates ────────
  const followUpRows = useMemo(() => {
    const rows: {
      key: string; sort: number; date: any; time: string; title: string;
      detail: string; actor: string; source: string; next: any; nextTime: string;
    }[] = [];
    followUpComms.forEach((c: any) => {
      const day = toISODateInput(c.communication_date) || toISODateInput(c.created_at);
      rows.push({
        key: `comm-${c.id}`,
        sort: day ? new Date(`${day}T${clockOf(c.communication_time) || '00:00'}:00`).getTime() : 0,
        date: c.communication_date,
        time: clockOf(c.communication_time),
        title: `Follow-Up logged · ${show(c.communication_method, 'no method')}`,
        detail: [text(c.communication_details), text(c.outcome) ? `Next action: ${text(c.outcome)}` : '']
          .filter(Boolean).join('\n'),
        actor: text(c.employee_name) || 'Staff',
        source: 'Follow-Up log',
        next: c.next_follow_up_date,
        nextTime: text(c.next_follow_up_time)
      });
    });
    callLogs.forEach((c: any) => {
      if (!text(c.next_follow_up_date)) return;
      const day = toISODateInput(c.next_follow_up_date);
      rows.push({
        key: `call-next-${c.id}`,
        sort: day ? new Date(`${day}T${clockOf(c.next_follow_up_time) || '00:00'}:00`).getTime() : 0,
        date: c.next_follow_up_date,
        time: clockOf(c.next_follow_up_time),
        title: `Follow-up scheduled from call · ${show(c.call_outcome, 'no outcome')}`,
        detail: text(c.remarks),
        actor: text(c.telecaller_name) || 'Telecaller',
        source: 'Call log',
        next: c.next_follow_up_date,
        nextTime: text(c.next_follow_up_time)
      });
    });
    return rows.sort((a, b) => b.sort - a.sort);
  }, [followUpComms, callLogs]);

  const sortedFeedback = useMemo(
    () => [...feedbackComms].sort((a, b) => {
      const ad = `${toISODateInput(a.communication_date)} ${clockOf(a.communication_time)}`;
      const bd = `${toISODateInput(b.communication_date)} ${clockOf(b.communication_time)}`;
      return bd.localeCompare(ad);
    }),
    [feedbackComms]
  );
  const sortedVisits = useMemo(
    () => [...visits].sort((a, b) => (toISODateInput(b.visit_date) || '').localeCompare(toISODateInput(a.visit_date) || '')),
    [visits]
  );
  const sortedPurchases = useMemo(
    () => [...purchases].sort((a, b) => (toISODateInput(b.purchase_date) || '').localeCompare(toISODateInput(a.purchase_date) || '')),
    [purchases]
  );
  const purchaseTotal = useMemo(
    () => purchases.reduce((sum, p) => {
      const net = Number(p.net_amount ?? p.total_amount ?? 0);
      return sum + (Number.isFinite(net) ? net : 0);
    }, 0),
    [purchases]
  );
  /**
   * Status history as an order tracker: oldest first, every row kept, because a
   * journey read bottom-up is how the manager follows one customer.
   */
  const statusTracker = useMemo(() => {
    return [...statusHistory].sort((a, b) => {
      const at = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
      return at - bt;
    });
  }, [statusHistory]);
  const sortedCalls = useMemo(
    () => [...callLogs].sort((a, b) => {
      const ad = toISODateInput(a.call_date) || toISODateInput(a.created_at);
      const bd = toISODateInput(b.call_date) || toISODateInput(b.created_at);
      return (bd || '').localeCompare(ad || '');
    }),
    [callLogs]
  );

  const openTab = (k: TabKey) => {
    setActiveTab(k);
    // A stale banner from another section must not follow the user across tabs.
    setSectionError('');
    setSectionNotice('');
  };

  const inputCls = 'w-full px-3 py-2 bg-[#F7F5F0] border border-[#E1DDD3] rounded-xl text-xs font-semibold text-[#17201D] focus:outline-none focus:border-[#C9A45C] disabled:opacity-60';
  const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-[#65716C] mb-1';

  // ── Inline section editor ────────────────────────────────────────────────
  // Rendered as a plain function (not a nested component type) so the inputs keep
  // focus while the user types.
  const renderSectionEditor = (sectionKey: string, title: string) => {
    if (!canEdit) return null;
    const all = SECTION_FIELDS[sectionKey] || [];
    const editable = all.filter((f) => f.scopes.includes(scope));
    const managerOnly = all.filter((f) => f.scopes.length === 1 && f.scopes[0] === 'full');
    const isEditing = editingSection === sectionKey;

    if (!editable.length) {
      return (
        <p className="text-[10px] font-semibold text-[#65716C] bg-[#EDF3F0] border border-[#E1DDD3] rounded-2xl px-3 py-2">
          These details are maintained by your manager — the customer update endpoint does not accept any
          field in this section for your role.
        </p>
      );
    }

    if (!isEditing) {
      return (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[9px] font-bold uppercase tracking-wider text-[#65716C]">
            {scope === 'limited' && managerOnly.length
              ? `Manager only: ${managerOnly.map((f) => f.label).join(', ')}`
              : 'Editable'}
          </span>
          <button
            type="button"
            onClick={() => openSection(sectionKey)}
            className="px-3 py-1.5 rounded-xl bg-[#FFFFFF] hover:bg-[#EDF3F0] border border-[#E1DDD3] text-[10px] font-bold text-[#123C35] flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Edit3 className="w-3 h-3 text-[#C9A45C]" />
            <span>Edit</span>
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-3 rounded-2xl border border-[#E1DDD3] bg-[#F7F5F0] p-3.5">
        <div className="text-[10px] font-black uppercase tracking-wider text-[#123C35]">Edit {title}</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {editable.map((f) => {
            const value = draft[f.name];

            // ── telecaller picker keeps its id/name pairing ──
            if (f.name === 'assigned_telecaller') {
              const names = telecallers.map((t: any) => t.full_name || t.username || String(t.id));
              const current = String(value ?? '');
              const opts = current && !names.includes(current) ? [...names, current] : names;
              return (
                <div key={f.name}>
                  <label className={labelCls}>{f.label}</label>
                  <select
                    value={current}
                    disabled={saving}
                    onChange={(e) => {
                      const caller = telecallers.find(
                        (t: any) => (t.full_name || t.username || String(t.id)) === e.target.value
                      );
                      setDraft({
                        ...draft,
                        assigned_telecaller: e.target.value,
                        assigned_telecaller_id: caller ? String(caller.id) : ''
                      });
                    }}
                    className={inputCls}
                  >
                    <option value="">Not set</option>
                    {opts.map((o) => (
                      <option key={String(o)} value={o}>{o}</option>
                    ))}
                  </select>
                  {f.hint && <p className="text-[9px] text-[#65716C] mt-1">{f.hint}</p>}
                </div>
              );
            }

            // ── yes / no, written as the 0/1 the boolean column stores ──
            if (f.kind === 'bool') {
              return (
                <div key={f.name}>
                  <label className={labelCls}>{f.label}</label>
                  <label className="flex items-center gap-2 rounded-xl border border-[#E1DDD3] bg-[#FFFFFF] px-3 py-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(value)}
                      disabled={saving}
                      onChange={(e) => setDraft({ ...draft, [f.name]: e.target.checked })}
                      className="accent-[#C9A45C]"
                    />
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#123C35]">
                      {value ? 'Yes' : 'No'}
                    </span>
                  </label>
                  {f.hint && <p className="text-[9px] text-[#65716C] mt-1">{f.hint}</p>}
                </div>
              );
            }

            // ── wedding_functions: JSON array of function ids ──
            if (f.kind === 'functions') {
              const selected: string[] = Array.isArray(value) ? value : [];
              const storedIds = weddingFunctionValues(customer?.[f.name]);
              const extra = selected
                .concat(storedIds)
                .filter((v) => !WEDDING_FUNCTION_OPTIONS.some((o) => o.id === v));
              const seenExtra: string[] = [];
              const extras = extra.filter((v) => (seenExtra.includes(v) ? false : (seenExtra.push(v), true)));
              return (
                <div key={f.name} className="sm:col-span-2">
                  <label className={labelCls}>{f.label}</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[...WEDDING_FUNCTION_OPTIONS.map((o) => ({ id: o.id, label: o.label })),
                      ...extras.map((v) => ({ id: v, label: v }))].map((option) => {
                      const on = selected.includes(option.id);
                      return (
                        <label
                          key={option.id}
                          className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[10px] font-bold cursor-pointer transition-colors ${
                            on
                              ? 'bg-[#123C35] text-white border-[#123C35]'
                              : 'bg-[#FFFFFF] text-[#123C35] border-[#E1DDD3] hover:bg-[#EDF3F0]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={saving}
                            onChange={(e) => setDraft({
                              ...draft,
                              [f.name]: e.target.checked
                                ? [...selected, option.id]
                                : selected.filter((v) => v !== option.id)
                            })}
                            className="sr-only"
                          />
                          {on && <Check className="w-2.5 h-2.5" />}
                          {option.label}
                        </label>
                      );
                    })}
                  </div>
                  {f.hint && <p className="text-[9px] text-[#65716C] mt-1">{f.hint}</p>}
                </div>
              );
            }

            // ── shopping_requirements: JSON object of requirement categories ──
            if (f.kind === 'requirements') {
              const map = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
              const universe = shoppingRequirementUniverse(customer?.[f.name]);
              return (
                <div key={f.name} className="sm:col-span-2">
                  <label className={labelCls}>{f.label}</label>
                  <div className="flex flex-wrap gap-1.5">
                    {universe.map((category) => {
                      const on = Boolean(map[category]);
                      return (
                        <label
                          key={category}
                          className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[10px] font-bold cursor-pointer transition-colors ${
                            on
                              ? 'bg-[#C9A45C] text-white border-[#C9A45C]'
                              : 'bg-[#FFFFFF] text-[#123C35] border-[#E1DDD3] hover:bg-[#EDF3F0]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={saving}
                            onChange={(e) => setDraft({
                              ...draft,
                              [f.name]: { ...map, [category]: e.target.checked }
                            })}
                            className="sr-only"
                          />
                          {on && <Check className="w-2.5 h-2.5" />}
                          {category}
                        </label>
                      );
                    })}
                  </div>
                  {f.hint && <p className="text-[9px] text-[#65716C] mt-1">{f.hint}</p>}
                </div>
              );
            }

            const options = f.options;
            const currentText = String(value ?? '');
            return (
              <div key={f.name} className={f.kind === 'textarea' ? 'sm:col-span-2' : ''}>
                <label className={labelCls}>{f.label}</label>
                {f.kind === 'select' && options ? (
                  // A stored value outside the list stays selectable, so saving the
                  // form can never rewrite a word the registration captured.
                  <select
                    value={currentText}
                    disabled={saving}
                    onChange={(e) => setDraft({ ...draft, [f.name]: e.target.value })}
                    className={inputCls}
                  >
                    <option value="">Not set</option>
                    {(currentText && !options.includes(currentText) ? [...options, currentText] : options).map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                ) : f.kind === 'textarea' ? (
                  <textarea
                    rows={3}
                    value={currentText}
                    maxLength={f.maxLength}
                    disabled={saving}
                    onChange={(e) => setDraft({ ...draft, [f.name]: e.target.value })}
                    className={inputCls}
                  />
                ) : (
                  <input
                    type={f.kind === 'date' ? 'date' : f.kind === 'number' ? 'number' : 'text'}
                    value={currentText}
                    maxLength={f.maxLength}
                    disabled={saving}
                    onChange={(e) => setDraft({ ...draft, [f.name]: e.target.value })}
                    className={inputCls}
                  />
                )}
                {f.hint && <p className="text-[9px] text-[#65716C] mt-1">{f.hint}</p>}
              </div>
            );
          })}
        </div>

        {scope === 'limited' && managerOnly.length > 0 && (
          <p className="text-[9px] font-semibold text-[#65716C]">
            Not editable for your role (manager endpoint only): {managerOnly.map((f) => f.label).join(', ')}.
          </p>
        )}
        {sectionNotice && (
          <p className="text-[10px] font-bold text-[#C58A18]">{sectionNotice}</p>
        )}
        {sectionError && (
          <div className="flex items-start gap-2 text-[10px] font-bold text-[#B42318] bg-[#FDE8E7] border border-[#B42318]/40 rounded-2xl px-3 py-2">
            <CircleAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{sectionError}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={closeSection}
            disabled={saving}
            className="px-3.5 py-1.5 rounded-xl bg-[#FFFFFF] hover:bg-[#EDF3F0] border border-[#E1DDD3] text-[10px] font-bold text-[#123C35] disabled:opacity-50 cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => saveSection(sectionKey)}
            disabled={saving}
            className="px-3.5 py-1.5 rounded-xl bg-[#123C35] hover:bg-[#082821] text-white text-[10px] font-bold flex items-center gap-1.5 disabled:opacity-60 cursor-pointer transition-colors"
          >
            {saving ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Saving…</span>
              </>
            ) : (
              <>
                <Save className="w-3 h-3" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  // ── Inline visit / purchase editors ──────────────────────────────────────
  // Same rule as renderSectionEditor: plain functions, so the fields keep focus.
  const renderVisitForm = () => {
    if (!visitForm) return null;
    const set = (patch: Record<string, any>) => setVisitForm({ ...visitForm, ...patch });
    return (
      <form onSubmit={saveVisit} className="space-y-3 rounded-2xl border border-[#E1DDD3] bg-[#FFFFFF] p-3.5">
        <div className="text-[10px] font-black uppercase tracking-wider text-[#123C35]">
          {visitForm.id ? `Edit Visit #${visitForm.id}` : 'Record Store Visit'}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Visit Date *</label>
            <input type="date" value={String(visitForm.visit_date ?? '')} disabled={savingVisit} onChange={(e) => set({ visit_date: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Visit Time *</label>
            <input type="time" value={String(visitForm.visit_time ?? '')} disabled={savingVisit} onChange={(e) => set({ visit_time: e.target.value })} className={inputCls} />
            <p className="text-[9px] text-[#65716C] mt-1">Required by the visit endpoint.</p>
          </div>
          <div>
            <label className={labelCls}>Visitors Count</label>
            <input type="number" min={1} value={String(visitForm.visitors_count ?? '')} disabled={savingVisit} onChange={(e) => set({ visitors_count: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Visited By</label>
            <input type="text" maxLength={150} value={String(visitForm.visited_by ?? '')} disabled={savingVisit} onChange={(e) => set({ visited_by: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Purpose</label>
            <input type="text" maxLength={150} value={String(visitForm.purpose ?? '')} disabled={savingVisit} onChange={(e) => set({ purpose: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Visit Status</label>
            <select value={String(visitForm.visit_status ?? '')} disabled={savingVisit} onChange={(e) => set({ visit_status: e.target.value })} className={inputCls}>
              {VISIT_STATUS_OPTIONS.map((o) => (<option key={o} value={o}>{o}</option>))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Categories Viewed</label>
            <input type="text" maxLength={200} value={String(visitForm.categories_viewed ?? '')} disabled={savingVisit} onChange={(e) => set({ categories_viewed: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Products Viewed</label>
            <input type="text" maxLength={255} value={String(visitForm.products_viewed ?? '')} disabled={savingVisit} onChange={(e) => set({ products_viewed: e.target.value })} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Customer Requirement</label>
            <input type="text" maxLength={255} value={String(visitForm.customer_requirement ?? '')} disabled={savingVisit} onChange={(e) => set({ customer_requirement: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Visit Result</label>
            <input type="text" maxLength={150} value={String(visitForm.visit_result ?? '')} disabled={savingVisit} onChange={(e) => set({ visit_result: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Next Action</label>
            <input type="text" maxLength={150} value={String(visitForm.next_action ?? '')} disabled={savingVisit} onChange={(e) => set({ next_action: e.target.value })} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Visit Notes</label>
            <textarea rows={2} value={String(visitForm.visit_notes ?? '')} disabled={savingVisit} onChange={(e) => set({ visit_notes: e.target.value })} className={inputCls} />
            <p className="text-[9px] text-[#65716C] mt-1">Stored encrypted at rest; shown decrypted on this panel.</p>
          </div>
        </div>

        {sectionError && (
          <div className="flex items-start gap-2 text-[10px] font-bold text-[#B42318] bg-[#FDE8E7] border border-[#B42318]/40 rounded-2xl px-3 py-2">
            <CircleAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{sectionError}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => { setVisitForm(null); setSectionError(''); }} disabled={savingVisit} className="px-3.5 py-1.5 rounded-xl bg-[#FFFFFF] hover:bg-[#EDF3F0] border border-[#E1DDD3] text-[10px] font-bold text-[#123C35] disabled:opacity-50 cursor-pointer transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={savingVisit} className="px-3.5 py-1.5 rounded-xl bg-[#123C35] hover:bg-[#082821] text-white text-[10px] font-bold flex items-center gap-1.5 disabled:opacity-60 cursor-pointer transition-colors">
            {savingVisit ? (<><RefreshCw className="w-3 h-3 animate-spin" /><span>Saving…</span></>) : (<><Save className="w-3 h-3" /><span>{visitForm.id ? 'Save Visit' : 'Record Visit'}</span></>)}
          </button>
        </div>
      </form>
    );
  };

  const renderPurchaseForm = () => {
    if (!purchaseForm) return null;
    const set = (patch: Record<string, any>) => setPurchaseForm({ ...purchaseForm, ...patch });
    const total = Number(String(purchaseForm.total_amount ?? '').trim() || 0);
    const discount = Number(String(purchaseForm.discount_amount ?? '').trim() || 0);
    const netOverride = String(purchaseForm.net_amount ?? '').trim();
    const netPreview = netOverride !== '' ? Number(netOverride) : Math.max(0, total - discount);

    return (
      <form onSubmit={savePurchase} className="space-y-3 rounded-2xl border border-[#E1DDD3] bg-[#FFFFFF] p-3.5">
        <div className="text-[10px] font-black uppercase tracking-wider text-[#123C35]">Record Purchase</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Bill Number</label>
            <input type="text" maxLength={50} value={String(purchaseForm.bill_number ?? '')} disabled={savingPurchase} onChange={(e) => set({ bill_number: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Purchase Date *</label>
            <input type="date" value={String(purchaseForm.purchase_date ?? '')} disabled={savingPurchase} onChange={(e) => set({ purchase_date: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Store Location</label>
            <input type="text" maxLength={150} value={String(purchaseForm.store_location ?? '')} disabled={savingPurchase} onChange={(e) => set({ store_location: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Sales Employee</label>
            <input type="text" maxLength={150} value={String(purchaseForm.sales_employee ?? '')} disabled={savingPurchase} onChange={(e) => set({ sales_employee: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Total Amount</label>
            <input type="number" min={0} step="0.01" value={String(purchaseForm.total_amount ?? '')} disabled={savingPurchase} onChange={(e) => set({ total_amount: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Discount</label>
            <input type="number" min={0} step="0.01" value={String(purchaseForm.discount_amount ?? '')} disabled={savingPurchase} onChange={(e) => set({ discount_amount: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Net Amount</label>
            <input type="number" min={0} step="0.01" value={netOverride} disabled={savingPurchase} onChange={(e) => set({ net_amount: e.target.value })} className={inputCls} />
            <p className="text-[9px] text-[#65716C] mt-1">Blank sends total − discount ({rupeeText(netPreview) || '₹0'}).</p>
          </div>
          <div>
            <label className={labelCls}>Payment Status</label>
            <select value={String(purchaseForm.payment_status ?? '')} disabled={savingPurchase} onChange={(e) => set({ payment_status: e.target.value })} className={inputCls}>
              {PAYMENT_STATUS_OPTIONS.map((o) => (<option key={o} value={o}>{o}</option>))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Purchase Status</label>
            <select value={String(purchaseForm.purchase_status ?? '')} disabled={savingPurchase} onChange={(e) => set({ purchase_status: e.target.value })} className={inputCls}>
              {PURCHASE_STATUS_OPTIONS.map((o) => (<option key={o} value={o}>{o}</option>))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Product Categories</label>
            <input type="text" maxLength={255} value={String(purchaseForm.product_categories ?? '')} disabled={savingPurchase} onChange={(e) => set({ product_categories: e.target.value })} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Purchase Notes</label>
            <textarea rows={2} value={String(purchaseForm.purchase_notes ?? '')} disabled={savingPurchase} onChange={(e) => set({ purchase_notes: e.target.value })} className={inputCls} />
          </div>
        </div>

        {sectionError && (
          <div className="flex items-start gap-2 text-[10px] font-bold text-[#B42318] bg-[#FDE8E7] border border-[#B42318]/40 rounded-2xl px-3 py-2">
            <CircleAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{sectionError}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => { setPurchaseForm(null); setSectionError(''); }} disabled={savingPurchase} className="px-3.5 py-1.5 rounded-xl bg-[#FFFFFF] hover:bg-[#EDF3F0] border border-[#E1DDD3] text-[10px] font-bold text-[#123C35] disabled:opacity-50 cursor-pointer transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={savingPurchase} className="px-3.5 py-1.5 rounded-xl bg-[#123C35] hover:bg-[#082821] text-white text-[10px] font-bold flex items-center gap-1.5 disabled:opacity-60 cursor-pointer transition-colors">
            {savingPurchase ? (<><RefreshCw className="w-3 h-3 animate-spin" /><span>Saving…</span></>) : (<><IndianRupee className="w-3 h-3" /><span>Record Purchase</span></>)}
          </button>
        </div>
      </form>
    );
  };

  // The board response decides the stage; the profile endpoint never recomputes it,
  // so the panel uses the server's answer and only falls back to a status lookup.
  const stageKey: StageKey = boardStageKey ?? stageOfStatus(customer?.customer_status);
  const stageChip = STAGE_PRESENTATION[stageKey];
  const badge = getStatusBadge(customer?.customer_status);
  const followUpDate = toISODateInput(customer?.follow_up_date);
  const overdueDays = followUpDate ? Math.abs(daysBetween(followUpDate, isoToday)) : 0;

  return (
    <ModalPortal
      isOpen={Boolean(open && customerId !== null)}
      onClose={saving ? () => undefined : onClose}
      closeOnEsc={!saving}
      containerClassName="!justify-end"
      ariaLabel={customer ? `Customer detail: ${customer.customer_name}` : 'Customer detail panel'}
      zIndex={1200}
    >
      <div className="w-full max-w-[760px] h-[calc(100vh-2rem)] bg-[#FFFFFF] border border-[#E1DDD3] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E1DDD3] bg-[#F7F5F0] flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            {customer ? (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-black text-[#123C35] truncate">
                    {show(customer.customer_name, 'Unnamed customer')}
                  </h3>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${badge.bg}`}>
                    {show(customer.customer_status, 'Unknown status')}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${stageChip.chip}`}>
                    {STAGE_LABELS[stageKey]}
                  </span>
                  {profile?.is_old_customer && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-[#65716C] text-white flex items-center gap-1">
                      <Archive className="w-2.5 h-2.5" /> Archived
                    </span>
                  )}
                </div>
                <div className="text-[10px] font-semibold text-[#65716C] mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                  <span>{show(customer.customer_code, 'No ID')}</span>
                  <span>·</span>
                  <span>{show(customer.mobile_number, 'No mobile')}</span>
                  <span>·</span>
                  <span>{show(customer.location_name, 'Store')}</span>
                </div>
              </>
            ) : (
              <h3 className="text-sm font-black text-[#123C35] uppercase tracking-wider">
                {error ? 'Customer unavailable' : 'Loading customer…'}
              </h3>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {customer && (
              <Link
                to={`/wedding-crm/customers/${customer.id}`}
                className="px-3 py-1.5 rounded-xl bg-[#FFFFFF] hover:bg-[#EDF3F0] border border-[#E1DDD3] text-[10px] font-bold text-[#123C35] flex items-center gap-1 transition-colors"
              >
                <ExternalLink className="w-3 h-3 text-[#C9A45C]" />
                <span>Full Profile</span>
              </Link>
            )}
            <button
              type="button"
              onClick={() => !saving && onClose()}
              className="p-1.5 rounded-lg text-[#65716C] hover:text-[#123C35] hover:bg-[#EDF3F0] cursor-pointer"
              title="Close panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Journey tracker — the same funnel read used by the board cards. */}
        {customer && (
          <div className="px-5 py-3 border-b border-[#E1DDD3] bg-[#FFFFFF] shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[9px] font-black uppercase tracking-wider text-[#65716C]">Journey</span>
              <span className="h-px flex-1 bg-[#E1DDD3]" aria-hidden="true" />
            </div>
            <JourneyTracker stageKey={stageKey} variant="full" />
          </div>
        )}

        <div className="px-4 py-2 border-b border-[#E1DDD3] bg-[#FFFFFF] flex gap-1.5 overflow-x-auto shrink-0">
          {TABS.map((t) => {
            const count =
              t.key === 'calls' ? callLogs.length :
              t.key === 'followups' ? followUpRows.length :
              t.key === 'feedback' ? feedbackComms.length :
              t.key === 'visits' ? visits.length :
              t.key === 'conversion' ? purchases.length :
              t.key === 'status' ? statusHistory.length :
              t.key === 'notes' ? notes.length :
              t.key === 'documents' ? documents.length :
              t.key === 'timeline' ? journey.total : null;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => openTab(t.key)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-bold whitespace-nowrap transition-colors ${
                  activeTab === t.key
                    ? 'bg-[#C9A45C] text-white'
                    : 'bg-[#FFFFFF] text-[#65716C] hover:text-[#123C35] border border-[#E1DDD3]'
                }`}
              >
                {t.label}
                {count !== null ? <span className="ml-1 opacity-80">({count})</span> : null}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 overscroll-contain">
          {loading && (
            <div className="py-20 flex flex-col items-center gap-2 text-[11px] font-bold text-[#65716C]">
              <RefreshCw className="w-5 h-5 animate-spin text-[#C9A45C]" />
              <span>Loading customer history…</span>
            </div>
          )}

          {!loading && error && (
            <div className="py-14 text-center space-y-3">
              <CircleAlert className="w-6 h-6 text-[#B42318] mx-auto" />
              <p className="text-xs font-bold text-[#123C35] max-w-md mx-auto leading-relaxed">{error}</p>
              <button
                type="button"
                onClick={() => load()}
                className="px-4 py-2 bg-[#123C35] hover:bg-[#082821] text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>
            </div>
          )}

          {!loading && !error && !customer && (
            <EmptyState label="No customer record was returned for this card." />
          )}

          {!loading && customer && (
            <>
              {profile?.is_old_customer && (
                <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-2xl bg-[#F4F2F0] border border-[#65716C]/30 text-[10px] font-bold text-[#4A3B43]">
                  <Archive className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>
                    This journey is archived in Old Customers. Details can still be corrected, but status changes
                    stay blocked until the record is restored — the server enforces this.
                  </span>
                </div>
              )}

              {/* A — Overview */}
              {activeTab === 'overview' && (
                <>
                  <Card>
                    <SectionTitle icon={ListChecks} title="Pipeline Position" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                      <InfoRow label="Stage" value={STAGE_LABELS[stageKey]} />
                      <InfoRow label="Status" value={show(customer.customer_status, 'Unknown')} />
                      <InfoRow label="Call Status" value={show(customer.call_status, 'No call status')} />
                      <InfoRow label="Priority" value={show(customer.priority, 'Not set')} tone={
                        text(customer.priority) === 'Urgent' ? 'danger' : text(customer.priority) === 'High' ? 'warn' : 'default'
                      } />
                      <InfoRow label="Assigned Telecaller" value={show(customer.assigned_telecaller, 'Unassigned')} />
                      <InfoRow label="Lead Source" value={show(customer.lead_source, 'Not recorded')} />
                      <InfoRow
                        label="Next Follow-Up"
                        value={
                          followUpDate
                            ? `${formatDateDisplay(followUpDate, 'Not scheduled')}${
                                isOverdue(followUpDate) ? ` · overdue by ${overdueDays} day${overdueDays === 1 ? '' : 's'}` :
                                isDueToday(followUpDate) ? ' · due today' : ''
                              }`
                            : 'Not scheduled'
                        }
                        tone={isOverdue(followUpDate) ? 'danger' : isDueToday(followUpDate) ? 'warn' : 'default'}
                      />
                      <InfoRow label="Preferred Call Time" value={show(customer.preferred_call_time, 'Any Time')} />
                      <InfoRow label="Total Calls" value={String(customer.total_calls_count ?? callLogs.length)} />
                      <InfoRow
                        label="Last Call"
                        value={
                          text(customer.last_call_date) || text(customer.last_call_outcome)
                            ? `${showDate(customer.last_call_date, 'No date')} · ${show(customer.last_call_outcome, 'No outcome recorded')}`
                            : 'No call logged yet'
                        }
                      />
                      <InfoRow label="Last Contacted By" value={show(customer.last_contacted_by, 'Nobody yet')} />
                      <InfoRow label="Location" value={show(customer.location_name, 'Store')} />
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1">
                      {[
                        { label: 'Calls', value: callLogs.length },
                        { label: 'Follow-Ups', value: followUpComms.length },
                        { label: 'Feedback', value: feedbackComms.length },
                        { label: 'Visits', value: visits.length },
                        { label: 'Purchases', value: purchases.length },
                        { label: 'Notes', value: notes.length }
                      ].map((m) => (
                        <div key={m.label} className="bg-[#F7F5F0] border border-[#E1DDD3] rounded-2xl px-2 py-2 text-center">
                          <div className="text-sm font-black text-[#123C35]">{m.value}</div>
                          <div className="text-[9px] font-bold uppercase tracking-wider text-[#65716C]">{m.label}</div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {canEdit && (
                    <Card>
                      <SectionTitle icon={PhoneCall} title="Quick Actions" />
                      <QuickActions customerId={customerId} onAction={onAction} />
                    </Card>
                  )}

                  <Card>
                    <SectionTitle icon={CalendarClock} title="Follow-Up Commitment" />
                    <InfoRow label="Follow-Up Date" value={followUpDate ? formatDateDisplay(followUpDate, 'Not scheduled') : 'Not scheduled'} tone={isOverdue(followUpDate) ? 'danger' : 'default'} />
                    <InfoRow label="Preferred Follow-Up Time" value={show(customer.preferred_followup_time, 'Any Time')} />
                    <InfoRow label="Preferred Contact Method" value={show(customer.preferred_contact_method, 'Not recorded')} />
                    {renderSectionEditor('overview', 'follow-up details')}
                  </Card>

                  <Card>
                    <SectionTitle icon={ArrowRightLeft} title="Status Tracker" />
                    <StatusTracker rows={statusTracker} today={isoToday} />
                    {text(customer.additional_notes) && (
                      <div className="rounded-2xl border border-[#E1DDD3] bg-[#EDF3F0] p-3">
                        <div className="text-[9px] font-black uppercase tracking-wider text-[#123C35] mb-1">
                          Additional Notes (encrypted at rest)
                        </div>
                        <p className="text-[10px] text-[#17201D] whitespace-pre-line">{text(customer.additional_notes)}</p>
                      </div>
                    )}
                  </Card>
                </>
              )}

              {/* B — Customer Details */}
              {activeTab === 'customer' && (
                <Card>
                  <SectionTitle icon={User} title="Customer Details" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                    <InfoRow label="Name" value={show(customer.customer_name)} />
                    <InfoRow label="Mobile" value={show(customer.mobile_number, 'No mobile number')} />
                    <InfoRow label="Alternate Mobile" value={show(customer.alternate_mobile, 'Not provided')} />
                    <InfoRow label="Email" value={show(customer.email, 'Not provided')} />
                    <InfoRow label="Estimated Family Size" value={customer.estimated_family_size ? String(customer.estimated_family_size) : 'Not recorded'} />
                    <InfoRow label="Preferred Contact Method" value={show(customer.preferred_contact_method, 'Not recorded')} />
                    <InfoRow label="Lead Source" value={show(customer.lead_source, 'Not recorded')} />
                    <InfoRow label="Customer Code" value={show(customer.customer_code, 'Not recorded')} />
                    <InfoRow label="Store" value={show(customer.location_name, 'Store')} />
                    <InfoRow label="Created" value={customer.created_at ? formatDateTimeDisplay(customer.created_at, 'Not recorded') : 'Not recorded'} />
                    <InfoRow label="Last Updated" value={customer.updated_at ? formatDateTimeDisplay(customer.updated_at, 'Not recorded') : 'Not recorded'} />
                    <InfoRow label="Registered By" value={show(customer.created_by, 'Not recorded')} />
                    <InfoRow label="Last Updated By" value={show(customer.last_updated_by, 'Not recorded')} />
                  </div>
                  {renderSectionEditor('customer', 'customer details')}
                </Card>
              )}

              {/* C — Wedding Details: every captured column is editable here */}
              {activeTab === 'wedding' && (
                <Card>
                  <SectionTitle icon={Heart} title="Wedding Details" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                    <InfoRow label="Wedding Date" value={showDate(customer.wedding_date, 'Not decided')} />
                    <InfoRow label="Date Flexibility" value={show(customer.wedding_date_flexibility, 'Not recorded')} />
                    <InfoRow label="Wedding Venue" value={show(customer.wedding_venue, 'Not recorded')} />
                    <InfoRow label="Wedding City" value={show(customer.wedding_city, 'Not recorded')} />
                    <InfoRow label="Wedding Type" value={show(customer.wedding_type, 'Not recorded')} />
                    <InfoRow label="Guest Count" value={customer.guest_count ? String(customer.guest_count) : 'Not recorded'} />
                    <InfoRow label="Bride Name" value={show(customer.bride_name, 'Not recorded')} />
                    <InfoRow label="Bride Age" value={customer.bride_age ? String(customer.bride_age) : 'Not recorded'} />
                    <InfoRow label="Bride Contact" value={show(customer.bride_contact, 'Not recorded')} />
                    <InfoRow label="Bride Shopping" value={boolText(customer.bride_shopping_required) || 'Not recorded'} />
                    <InfoRow label="Groom Name" value={show(customer.groom_name, 'Not recorded')} />
                    <InfoRow label="Groom Age" value={customer.groom_age ? String(customer.groom_age) : 'Not recorded'} />
                    <InfoRow label="Groom Contact" value={show(customer.groom_contact, 'Not recorded')} />
                    <InfoRow label="Groom Shopping" value={boolText(customer.groom_shopping_required) || 'Not recorded'} />
                    <InfoRow label="Wedding Functions" value={weddingFunctionLabels(customer.wedding_functions) || 'Not recorded'} />
                  </div>
                  <div className="flex items-end justify-between gap-2 flex-wrap">
                    <p className="text-[9px] font-semibold text-[#65716C]">
                      {weddingFunctionValues(customer.wedding_functions).length > 0
                        ? 'Functions are stored as a JSON array on wedding_functions.'
                        : 'No wedding function captured yet.'}
                    </p>
                    {canEdit && scope === 'limited' && (
                      <p className="text-[9px] font-semibold text-[#65716C]">
                        Your role writes name, city and date fields only — the rest is maintained by a manager.
                      </p>
                    )}
                  </div>
                  {renderSectionEditor('wedding', 'wedding details')}
                </Card>
              )}

              {/* D — Shopping Requirements */}
              {activeTab === 'shopping' && (
                <Card>
                  <SectionTitle icon={ShoppingBag} title="Shopping Requirements" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                    <InfoRow label="Expected Shopping Date" value={showDate(customer.expected_shopping_date, 'Not scheduled')} tone={isOverdue(customer.expected_shopping_date) ? 'danger' : 'default'} />
                    <InfoRow label="Preferred Shopping Date" value={showDate(customer.preferred_shopping_date, 'Not scheduled')} />
                    <InfoRow label="Preferred Shopping Time" value={show(customer.preferred_shopping_time, 'Not recorded')} />
                    <InfoRow label="Preferred Category" value={show(customer.preferred_shopping_category, 'Not recorded')} />
                    <InfoRow label="Budget" value={show(customer.budget || customer.budget_range, 'Not decided')} />
                    <InfoRow label="Expected Visitors" value={customer.expected_visitors ? String(customer.expected_visitors) : 'Not recorded'} />
                    <InfoRow label="Guest Count" value={customer.guest_count ? String(customer.guest_count) : 'Not recorded'} />
                    <InfoRow label="Family Size" value={customer.estimated_family_size ? String(customer.estimated_family_size) : (customer.family_size ? String(customer.family_size) : 'Not recorded')} />
                    <InfoRow label="Shopping Requirements" value={shoppingRequirementText(customer.shopping_requirements) || 'Not recorded'} />
                  </div>
                  <p className="text-[9px] font-semibold text-[#65716C]">
                    Visits and bills against this plan live on the Store Visits, Shopping Progress and Conversion tabs.
                  </p>
                  {renderSectionEditor('shopping', 'shopping requirements')}
                </Card>
              )}

              {/* E — Call History */}
              {activeTab === 'calls' && (
                <Card>
                  <SectionTitle icon={PhoneCall} title="Call History" />
                  {sortedCalls.length === 0 ? (
                    <EmptyState label="No calls have been logged for this customer yet." />
                  ) : (
                    <>
                      <p className="text-[9px] font-semibold text-[#65716C]">
                        Call history is append-only — existing rows are never edited. Use “Log Call” to add a new entry.
                      </p>
                      <div className="space-y-2.5">
                        {sortedCalls.map((c: any) => (
                          <div key={`call-${c.id}`} className="bg-[#F7F5F0] border border-[#E1DDD3] rounded-2xl p-3 space-y-1.5">
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <div className="text-[11px] font-black text-[#123C35]">
                                {showDate(c.call_date, 'No date')} {clockOf(c.call_time) ? `· ${clockOf(c.call_time)}` : ''}
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                                /Interested|Confirmed|Planned/i.test(text(c.call_outcome))
                                  ? 'bg-[#E8F5EE] text-[#198754]'
                                  : /No Answer|Busy|Switched|Wrong/i.test(text(c.call_outcome))
                                  ? 'bg-[#FFF4D6] text-[#C58A18]'
                                  : 'bg-[#EDE7F6] text-[#082821]'
                              }`}>
                                {show(c.call_outcome, 'No outcome')}
                              </span>
                            </div>
                            <div className="text-[10px] font-semibold text-[#65716C] flex flex-wrap gap-x-3">
                              <span>Telecaller: {show(c.telecaller_name, 'Unknown')}</span>
                              <span>Status: {show(c.call_status, '—')}</span>
                            </div>
                            {text(c.customer_response) && (
                              <p className="text-[10px] font-semibold text-[#17201D]">
                                Response: {text(c.customer_response)}
                              </p>
                            )}
                            {text(c.remarks) && (
                              <p className="text-[10px] text-[#65716C] whitespace-pre-line">{text(c.remarks)}</p>
                            )}
                            <div className="text-[10px] font-bold text-[#123C35] pt-1 border-t border-[#E1DDD3]">
                              Next follow-up:{' '}
                              {text(c.next_follow_up_date)
                                ? `${formatDateDisplay(c.next_follow_up_date, 'Not scheduled')}${text(c.next_follow_up_time) ? ` (${text(c.next_follow_up_time)})` : ''}`
                                : 'Not scheduled'}
                              {text(c.expected_shopping_date_updated) ? ` · Shopping ${formatDateDisplay(c.expected_shopping_date_updated, 'Not scheduled')}` : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </Card>
              )}

              {/* F — Follow-Up History */}
              {activeTab === 'followups' && (
                <Card>
                  <SectionTitle icon={CalendarClock} title="Follow-Up History" />
                  {followUpRows.length === 0 ? (
                    <EmptyState label="No follow-ups logged and no next follow-up dates scheduled yet." />
                  ) : (
                    <div className="space-y-2.5">
                      {followUpRows.map((r) => {
                        const nextDate = r.next;
                        return (
                          <div key={r.key} className="bg-[#F7F5F0] border border-[#E1DDD3] rounded-2xl p-3 space-y-1">
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <span className="text-[11px] font-black text-[#123C35]">
                                {showDate(r.date, 'No date')} {r.time ? `· ${r.time}` : ''}
                              </span>
                              <span className="text-[9px] font-bold uppercase tracking-wider text-[#082821] bg-[#EDE7F6] px-2 py-0.5 rounded-full">
                                {r.source}
                              </span>
                            </div>
                            <div className="text-[10px] font-bold text-[#17201D]">{r.title}</div>
                            {r.detail && <p className="text-[10px] text-[#65716C] whitespace-pre-line">{r.detail}</p>}
                            <div className="text-[10px] font-semibold text-[#65716C]">
                              By: {r.actor} · For: {nextDate ? formatDateDisplay(nextDate, 'Not scheduled') : 'Not scheduled'}
                              {(nextDate && isOverdue(nextDate)) ? <span className="text-[#B42318] font-bold"> · overdue</span> : null}
                              {(nextDate && isDueToday(nextDate)) ? <span className="text-[#C58A18] font-bold"> · today</span> : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-[9px] font-semibold text-[#65716C]">
                    Rows combine Follow-Up communication entries with the next follow-up dates carried by call logs.
                    The status history table stores no follow-up date, so it contributes nothing to this list.
                  </p>
                </Card>
              )}

              {/* G — Feedback */}
              {activeTab === 'feedback' && (
                <Card>
                  <SectionTitle icon={MessageSquare} title="Feedback" />
                  {sortedFeedback.length === 0 ? (
                    <EmptyState label="No feedback has been recorded for this customer yet." />
                  ) : (
                    <div className="space-y-2.5">
                      {sortedFeedback.map((f: any) => (
                        <div key={`fb-${f.id}`} className="bg-[#F7F5F0] border border-[#E1DDD3] rounded-2xl p-3 space-y-1">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <span className="text-[11px] font-black text-[#123C35]">
                              {showDate(f.communication_date, 'No date')} {clockOf(f.communication_time) ? `· ${clockOf(f.communication_time)}` : ''}
                            </span>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-[#65716C]">
                              {show(f.communication_method, 'no method')}
                            </span>
                          </div>
                          <div className="text-[10px] font-semibold text-[#65716C]">Recorded by: {show(f.employee_name, 'Staff')}</div>
                          {text(f.communication_details) && (
                            <p className="text-[10px] text-[#17201D] whitespace-pre-line">{text(f.communication_details)}</p>
                          )}
                          <div className="text-[10px] font-bold text-[#123C35] pt-1 border-t border-[#E1DDD3] space-y-0.5">
                            <div>Outcome / Next Action: {show(f.outcome, 'Not recorded')}</div>
                            <div>
                              Next Follow-Up:{' '}
                              {text(f.next_follow_up_date)
                                ? `${formatDateDisplay(f.next_follow_up_date, 'Not scheduled')}${text(f.next_follow_up_time) ? ` (${text(f.next_follow_up_time)})` : ''}`
                                : 'Not scheduled'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[9px] font-semibold text-[#65716C]">
                    Every feedback entry is a separate appended row — earlier feedback is never replaced.
                  </p>
                </Card>
              )}

              {/* H — Activity Timeline */}
              {activeTab === 'timeline' && (
                <Card>
                  <SectionTitle icon={History} title="Complete Customer Journey" />
                  {timelineLoading && !timelineEvents ? (
                    <div className="py-10 flex flex-col items-center gap-2 text-[11px] font-bold text-[#65716C]">
                      <RefreshCw className="w-4 h-4 animate-spin text-[#C9A45C]" />
                      <span>Loading activity timeline…</span>
                    </div>
                  ) : timelineError ? (
                    <div className="py-8 text-center space-y-3">
                      <p className="text-[11px] font-bold text-[#B42318] max-w-md mx-auto">{timelineError}</p>
                      <button
                        type="button"
                        onClick={() => {
                          setTimelineEvents(null);
                          setTimelineError('');
                        }}
                        className="px-4 py-2 bg-[#123C35] hover:bg-[#082821] text-white text-[10px] font-bold rounded-xl inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Retry Timeline</span>
                      </button>
                    </div>
                  ) : journey.groups.length === 0 ? (
                    <EmptyState label="No activity has been recorded for this customer yet." />
                  ) : (
                    <>
                      <div className="text-[9px] font-semibold text-[#65716C]">
                        {journey.total} events from audit logs, status changes, calls, communications, notes and visits —
                        grouped by day, newest first. Nothing here is deduplicated away or overwritten.
                      </div>
                      <div className="space-y-4">
                        {journey.groups.map((g) => {
                          const dayLabel = g.day === 'unknown' ? 'Undated entries' : formatDateDisplay(g.day, 'Undated entries');
                          const overdueDay = g.day !== 'unknown' && g.day < isoToday;
                          return (
                            <div key={g.day} className="space-y-2">
                              <div className="flex items-center gap-2 sticky top-0 bg-[#FFFFFF] py-1">
                                <span className="text-[10px] font-black uppercase tracking-wider text-[#123C35]">{dayLabel}</span>
                                {g.day === isoToday && (
                                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-[#FFF4D6] text-[#C58A18]">TODAY</span>
                                )}
                                {overdueDay && g.day !== isoToday && (
                                  <span className="text-[9px] font-bold text-[#65716C]">{g.items.length} entr{g.items.length === 1 ? 'y' : 'ies'}</span>
                                )}
                              </div>
                              <div className="space-y-1.5 pl-3 border-l-2 border-[#E1DDD3]">
                                {g.items.map((ev) => (
                                  <div key={ev.key} className="bg-[#F7F5F0] border border-[#E1DDD3] rounded-2xl px-3 py-2">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                      <span className="text-[10px] font-black text-[#123C35]">{ev.action}</span>
                                      <span className="text-[9px] font-bold text-[#65716C]">
                                        {ev.time ? `${ev.time} · ` : ''}{ev.source}
                                      </span>
                                    </div>
                                    <div className="text-[9px] font-bold uppercase tracking-wider text-[#C9A45C] mt-0.5">
                                      {ev.actor}
                                    </div>
                                    {ev.detail && (
                                      <p className="text-[10px] text-[#65716C] whitespace-pre-line mt-1">{ev.detail}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </Card>
              )}

              {/* I — Store Visits: recorded and corrected in place */}
              {activeTab === 'visits' && (
                <Card>
                  <SectionTitle icon={MapPinned} title="Store Visits" />
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-[9px] font-semibold text-[#65716C]">
                      Each visit is one wedding_visits row. Notes are encrypted at rest by the server.
                    </p>
                    {canEdit && !visitForm && (
                      <button
                        type="button"
                        onClick={() => openVisitForm()}
                        className="px-3 py-1.5 rounded-xl bg-[#123C35] hover:bg-[#082821] text-white text-[10px] font-bold flex items-center gap-1.5 disabled:opacity-60 cursor-pointer transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Record Store Visit</span>
                      </button>
                    )}
                  </div>

                  {visitForm && renderVisitForm()}

                  {sortedVisits.length === 0 && !visitForm ? (
                    <EmptyState
                      label={
                        canEdit
                          ? 'No store visit yet. Record one and this customer moves to Visited Store.'
                          : 'This customer has not visited the store yet.'
                      }
                    />
                  ) : (
                    <div className="space-y-2.5">
                      {sortedVisits.map((v: any) => (
                        <div key={`visit-${v.id}`} className="bg-[#F7F5F0] border border-[#E1DDD3] rounded-2xl p-3 space-y-1">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <span className="text-[11px] font-black text-[#123C35]">
                              {showDate(v.visit_date, 'No date')} {clockOf(v.visit_time) ? `· ${clockOf(v.visit_time)}` : ''}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-[#EDE7F6] text-[#082821]">
                                {show(v.visit_status, 'Visit')}
                              </span>
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => openVisitForm(v)}
                                  disabled={savingVisit}
                                  className="px-2 py-0.5 rounded-lg bg-[#FFFFFF] hover:bg-[#EDF3F0] border border-[#E1DDD3] text-[9px] font-black uppercase tracking-wider text-[#123C35] flex items-center gap-1 disabled:opacity-50 cursor-pointer transition-colors"
                                >
                                  <Edit3 className="w-2.5 h-2.5 text-[#C9A45C]" />
                                  <span>Edit</span>
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                            <InfoRow label="Purpose" value={show(v.purpose, 'Not recorded')} />
                            <InfoRow label="Visitors" value={v.visitors_count ? String(v.visitors_count) : 'Not recorded'} />
                            <InfoRow label="Visited By" value={show(v.visited_by || v.created_by, 'Not recorded')} />
                            <InfoRow label="Result" value={show(v.visit_result, 'Not recorded')} />
                            <InfoRow label="Next Action" value={show(v.next_action, 'Not recorded')} />
                            <InfoRow label="Categories Viewed" value={show(v.categories_viewed, 'Not recorded')} />
                            <InfoRow label="Products Viewed" value={show(v.products_viewed, 'Not recorded')} />
                            <InfoRow label="Requirement" value={show(v.customer_requirement, 'Not recorded')} />
                          </div>
                          {text(v.visit_notes) && (
                            <p className="text-[10px] text-[#65716C] whitespace-pre-line pt-1 border-t border-[#E1DDD3]">
                              {text(v.visit_notes)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}

              {/* J — Shopping Progress: plan columns plus the visits and purchases
                     they produced. No invented field — every row is a real column. */}
              {activeTab === 'progress' && (
                <>
                  <Card>
                    <SectionTitle icon={ShoppingBag} title="Shopping Plan" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                      <InfoRow label="Expected Shopping Date" value={showDate(customer.expected_shopping_date, 'Not scheduled')} tone={isOverdue(customer.expected_shopping_date) ? 'danger' : 'default'} />
                      <InfoRow label="Preferred Shopping Date" value={showDate(customer.preferred_shopping_date, 'Not scheduled')} />
                      <InfoRow label="Preferred Time" value={show(customer.preferred_shopping_time, 'Not recorded')} />
                      <InfoRow label="Category" value={show(customer.preferred_shopping_category, 'Not recorded')} />
                      <InfoRow label="Requirements" value={shoppingRequirementText(customer.shopping_requirements) || 'Not recorded'} />
                      <InfoRow label="Functions" value={weddingFunctionLabels(customer.wedding_functions) || 'Not recorded'} />
                      <InfoRow label="Expected Visitors" value={customer.expected_visitors ? String(customer.expected_visitors) : 'Not recorded'} />
                      <InfoRow label="Budget" value={show(customer.budget || customer.budget_range, 'Not decided')} />
                    </div>
                    {renderSectionEditor('shopping', 'shopping plan')}
                  </Card>

                  <Card>
                    <SectionTitle icon={Store} title="Visits Against This Plan" />
                    {sortedVisits.length === 0 ? (
                      <EmptyState label="No store visit has been logged against this shopping plan yet." />
                    ) : (
                      <div className="space-y-2">
                        {sortedVisits.map((v: any) => (
                          <div key={`progress-visit-${v.id}`} className="bg-[#F7F5F0] border border-[#E1DDD3] rounded-2xl px-3 py-2 flex items-start justify-between gap-2 flex-wrap">
                            <div className="min-w-0">
                              <div className="text-[10px] font-black text-[#123C35]">
                                {showDate(v.visit_date, 'No date')} {clockOf(v.visit_time) ? `· ${clockOf(v.visit_time)}` : ''}
                              </div>
                              <div className="text-[9px] font-semibold text-[#65716C] flex flex-wrap gap-x-2">
                                <span>{show(v.visit_status, 'Visit')}</span>
                                {text(v.purpose) && <span>· {text(v.purpose)}</span>}
                                {v.visitors_count ? <span>· {v.visitors_count} visitor{Number(v.visitors_count) === 1 ? '' : 's'}</span> : null}
                              </div>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black shrink-0 ${
                              /Completed|Converted|Positive/i.test(text(v.visit_result))
                                ? 'bg-[#E8F5EE] text-[#198754]'
                                : /Pending|Planned/i.test(text(v.visit_status))
                                ? 'bg-[#FFF4D6] text-[#C58A18]'
                                : 'bg-[#EDE7F6] text-[#082821]'
                            }`}>
                              {show(v.visit_result, 'No result yet')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-[9px] font-semibold text-[#65716C]">
                      Visits are recorded on the Store Visits tab — the same wedding_visits rows feed this list.
                    </p>
                  </Card>

                  <Card>
                    <SectionTitle icon={IndianRupee} title="Purchases So Far" />
                    {sortedPurchases.length === 0 ? (
                      <EmptyState label="Nothing has been billed for this wedding yet. Record it on the Conversion tab." />
                    ) : (
                      <div className="space-y-2">
                        {sortedPurchases.map((p: any) => (
                          <div key={`progress-purchase-${p.id}`} className="bg-[#F7F5F0] border border-[#E1DDD3] rounded-2xl px-3 py-2 flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-[10px] font-black text-[#123C35]">
                                {showDate(p.purchase_date, 'No date')}
                                {text(p.bill_number) ? ` · Bill ${text(p.bill_number)}` : ''}
                              </div>
                              <div className="text-[9px] font-semibold text-[#65716C]">
                                {show(p.product_categories, 'Categories not recorded')}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-[11px] font-black text-[#123C35]">{rupeeText(p.net_amount ?? p.total_amount) || '—'}</div>
                              <div className="text-[9px] font-bold uppercase tracking-wider text-[#65716C]">{show(p.payment_status, 'Payment status unknown')}</div>
                            </div>
                          </div>
                        ))}
                        <div className="flex items-center justify-between gap-2 rounded-2xl bg-[#EDF3F0] border border-[#E1DDD3] px-3 py-2">
                          <span className="text-[9px] font-black uppercase tracking-wider text-[#123C35]">Billed total</span>
                          <span className="text-[11px] font-black text-[#123C35]">{rupeeText(purchaseTotal)}</span>
                        </div>
                      </div>
                    )}
                  </Card>
                </>
              )}

              {/* K — Conversion: the bill, then the terminal status write */}
              {activeTab === 'conversion' && (
                <>
                  <Card>
                    <SectionTitle icon={IndianRupee} title="Purchases" />
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-[9px] font-semibold text-[#65716C]">
                        {sortedPurchases.length === 0
                          ? 'No purchase has been billed for this customer.'
                          : `${sortedPurchases.length} bill${sortedPurchases.length === 1 ? '' : 's'} · ${rupeeText(purchaseTotal)} billed.`}
                      </p>
                      {canEdit && !purchaseForm && (
                        <button
                          type="button"
                          onClick={openPurchaseForm}
                          className="px-3 py-1.5 rounded-xl bg-[#123C35] hover:bg-[#082821] text-white text-[10px] font-bold flex items-center gap-1.5 disabled:opacity-60 cursor-pointer transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Record Purchase</span>
                        </button>
                      )}
                    </div>

                    {purchaseForm && renderPurchaseForm()}

                    {sortedPurchases.length === 0 && !purchaseForm ? (
                      <EmptyState label="Nothing billed yet. A purchase here is the proof behind a Won stage." />
                    ) : (
                      <div className="space-y-2.5">
                        {sortedPurchases.map((p: any) => (
                          <div key={`purchase-${p.id}`} className="bg-[#F7F5F0] border border-[#E1DDD3] rounded-2xl p-3 space-y-1">
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <span className="text-[11px] font-black text-[#123C35]">
                                {showDate(p.purchase_date, 'No date')}{text(p.bill_number) ? ` · Bill ${text(p.bill_number)}` : ''}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                                /Paid|Completed/i.test(text(p.payment_status))
                                  ? 'bg-[#E8F5EE] text-[#198754]'
                                  : /Pending/i.test(text(p.payment_status))
                                  ? 'bg-[#FFF4D6] text-[#C58A18]'
                                  : 'bg-[#EDE7F6] text-[#082821]'
                              }`}>
                                {show(p.payment_status, 'No payment status')}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                              <InfoRow label="Store" value={show(p.store_location || p.location_name, 'Not recorded')} />
                              <InfoRow label="Sales Employee" value={show(p.sales_employee, 'Not recorded')} />
                              <InfoRow label="Categories" value={show(p.product_categories, 'Not recorded')} />
                              <InfoRow label="Purchase Status" value={show(p.purchase_status, 'Not recorded')} />
                              <InfoRow label="Total" value={rupeeText(p.total_amount) || 'Not recorded'} />
                              <InfoRow label="Discount" value={rupeeText(p.discount_amount) || 'None'} />
                              <InfoRow label="Net Amount" value={rupeeText(p.net_amount ?? p.total_amount) || 'Not recorded'} />
                            </div>
                            {text(p.purchase_notes) && (
                              <p className="text-[10px] text-[#65716C] whitespace-pre-line pt-1 border-t border-[#E1DDD3]">
                                {text(p.purchase_notes)}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>

                  <Card>
                    <SectionTitle icon={Trophy} title="Mark Won / Converted" />
                    <InfoRow label="Current Stage" value={STAGE_LABELS[stageKey]} />
                    <InfoRow label="Current Status" value={show(customer.customer_status, 'Unknown')} />
                    {canEdit ? (
                      <div className="space-y-3 rounded-2xl border border-[#E1DDD3] bg-[#F7F5F0] p-3.5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className={labelCls}>Conversion Status *</label>
                            <select
                              value={convertDraft.new_status}
                              disabled={savingConvert}
                              onChange={(e) => {
                                setConvertDraft({ ...convertDraft, new_status: e.target.value });
                                setConvertConfirmed(false);
                              }}
                              className={inputCls}
                            >
                              <option value="">Select a status</option>
                              {convertTargets.map((s) => (
                                <option key={s} value={s}>
                                  {s}{isCompletionStatus(s) ? ' — completes & archives' : ''}
                                </option>
                              ))}
                            </select>
                            <p className="text-[9px] text-[#65716C] mt-1">
                              Converted keeps the journey active. “Wedding Process Completed” closes it.
                            </p>
                          </div>
                          <div>
                            <label className={labelCls}>Reason</label>
                            <textarea
                              rows={3}
                              value={convertDraft.change_reason}
                              disabled={savingConvert}
                              onChange={(e) => setConvertDraft({ ...convertDraft, change_reason: e.target.value })}
                              placeholder="Why is this wedding won? (stored in the status history)"
                              className={inputCls}
                            />
                          </div>
                        </div>

                        {convertArchives && (
                          <div className="rounded-2xl border border-[#B42318]/40 bg-[#FDE8E7] p-3 space-y-2">
                            <div className="flex items-start gap-2">
                              <Archive className="w-4 h-4 text-[#B42318] mt-0.5 shrink-0" />
                              <p className="text-[11px] font-bold text-[#8B1A12] leading-relaxed">
                                “{convertDraft.new_status}” archives this customer into Old Customers. The move
                                is effectively irreversible from this screen — status changes stay blocked until a
                                restore. History, visits, bills and notes are kept.
                              </p>
                            </div>
                            <label className="flex items-center gap-2 text-[11px] font-black text-[#8B1A12] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={convertConfirmed}
                                disabled={savingConvert}
                                onChange={(e) => setConvertConfirmed(e.target.checked)}
                                className="accent-[#B42318]"
                              />
                              Yes, complete this wedding journey and archive the customer
                            </label>
                          </div>
                        )}

                        {sectionError && (
                          <div className="flex items-start gap-2 text-[10px] font-bold text-[#B42318] bg-[#FDE8E7] border border-[#B42318]/40 rounded-2xl px-3 py-2">
                            <CircleAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span>{sectionError}</span>
                          </div>
                        )}

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={saveConversion}
                            disabled={savingConvert || !convertDraft.new_status || (convertArchives && !convertConfirmed)}
                            className="px-3.5 py-1.5 rounded-xl bg-[#123C35] hover:bg-[#082821] text-white text-[10px] font-bold flex items-center gap-1.5 disabled:opacity-60 cursor-pointer transition-colors"
                          >
                            {savingConvert ? (
                              <>
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                <span>Saving…</span>
                              </>
                            ) : (
                              <>
                                <Trophy className="w-3 h-3" />
                                <span>Mark Converted</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] font-semibold text-[#65716C] bg-[#EDF3F0] border border-[#E1DDD3] rounded-2xl px-3 py-2">
                        Status changes are written by the CRM Manager endpoint. Your role can follow the journey,
                        not close it.
                      </p>
                    )}
                  </Card>
                </>
              )}

              {/* L — Status history as an order tracker (every row, oldest first) */}
              {activeTab === 'status' && (
                <Card>
                  <SectionTitle icon={ArrowRightLeft} title="Status History" />
                  <StatusTracker rows={statusTracker} today={isoToday} />
                  <p className="text-[9px] font-semibold text-[#65716C]">
                    Read from wedding_status_history. Every change stays — nothing is trimmed, and the oldest
                    entry is never removed.
                  </p>
                </Card>
              )}

              {/* J — Notes */}
              {activeTab === 'notes' && (
                <Card>
                  <SectionTitle icon={FileText} title="Notes" />
                  {canEdit && (
                    <form onSubmit={addNote} className="space-y-2.5 rounded-2xl border border-[#E1DDD3] bg-[#F7F5F0] p-3.5">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Note Type</label>
                          <select
                            value={noteDraft.note_type}
                            disabled={savingNote}
                            onChange={(e) => setNoteDraft({ ...noteDraft, note_type: e.target.value })}
                            className={inputCls}
                          >
                            {['General', 'Preference', 'Feedback', 'Follow-Up', 'Visit', 'Warning', 'Other'].map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>Note Content *</label>
                          <input
                            type="text"
                            value={noteDraft.note_content}
                            disabled={savingNote}
                            onChange={(e) => setNoteDraft({ ...noteDraft, note_content: e.target.value })}
                            placeholder="Add a note for this wedding journey"
                            className={inputCls}
                          />
                        </div>
                      </div>
                      {sectionError && (
                        <div className="flex items-start gap-2 text-[10px] font-bold text-[#B42318] bg-[#FDE8E7] border border-[#B42318]/40 rounded-2xl px-3 py-2">
                          <CircleAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          <span>{sectionError}</span>
                        </div>
                      )}
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={savingNote}
                          className="px-3.5 py-1.5 rounded-xl bg-[#123C35] hover:bg-[#082821] text-white text-[10px] font-bold flex items-center gap-1.5 disabled:opacity-60 cursor-pointer transition-colors"
                        >
                          {savingNote ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>Saving…</span>
                            </>
                          ) : (
                            <>
                              <StickyNote className="w-3 h-3" />
                              <span>Add Note</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  )}
                  {notes.length === 0 ? (
                    <EmptyState label="No notes have been added to this customer yet." />
                  ) : (
                    <div className="space-y-2.5">
                      {notes.map((n: any) => (
                        <div key={`note-${n.id}`} className="bg-[#F7F5F0] border border-[#E1DDD3] rounded-2xl p-3 space-y-1">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-[9px] font-black uppercase tracking-wider text-[#082821] bg-[#EDE7F6] px-2 py-0.5 rounded-full">
                              {show(n.note_type, 'General')}
                            </span>
                            <span className="text-[9px] font-bold text-[#65716C]">
                              {n.created_at ? formatDateTimeDisplay(n.created_at, 'Not recorded') : 'Not recorded'}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#17201D] whitespace-pre-line">{show(n.note_content, 'Empty note')}</p>
                          <div className="text-[9px] font-bold uppercase tracking-wider text-[#C9A45C]">
                            {show(n.created_by, 'Staff')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {text(customer.customer_notes) && (
                    <div className="rounded-2xl border border-[#E1DDD3] bg-[#EDF3F0] p-3">
                      <div className="text-[9px] font-black uppercase tracking-wider text-[#123C35] mb-1">
                        Customer Notes Field (record)
                      </div>
                      <p className="text-[10px] text-[#17201D] whitespace-pre-line">{text(customer.customer_notes)}</p>
                    </div>
                  )}
                </Card>
              )}

              {/* K — Documents */}
              {activeTab === 'documents' && (
                <Card>
                  <SectionTitle icon={FolderOpen} title="Documents" />
                  {documents.length === 0 ? (
                    <EmptyState label="No documents are attached to this customer. The Wedding CRM has no document upload endpoint, so nothing can be added from here." />
                  ) : (
                    <div className="space-y-2">
                      {documents.map((d: any) => (
                        <div key={`doc-${d.id}`} className="bg-[#F7F5F0] border border-[#E1DDD3] rounded-2xl p-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[11px] font-black text-[#123C35] truncate">{show(d.file_name, 'Untitled file')}</div>
                            <div className="text-[9px] font-bold text-[#65716C] flex flex-wrap gap-x-2">
                              <span>{show(d.document_type, 'Document')}</span>
                              <span>·</span>
                              <span>{show(d.file_extension, '').toUpperCase() || 'FILE'}</span>
                              {d.file_size ? <span>· {Math.round(Number(d.file_size) / 1024)} KB</span> : null}
                              <span>·</span>
                              <span>{show(d.uploaded_by, 'Unknown')}</span>
                              <span>·</span>
                              <span>{d.created_at ? formatDateTimeDisplay(d.created_at, 'Not recorded') : 'Not recorded'}</span>
                            </div>
                          </div>
                          {text(d.file_path) && (
                            <a
                              href={API.fileUrl(d.file_path) || '#'}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 rounded-xl bg-[#FFFFFF] hover:bg-[#EDF3F0] border border-[#E1DDD3] text-[10px] font-bold text-[#123C35] flex items-center gap-1 shrink-0 transition-colors"
                            >
                              <ExternalLink className="w-3 h-3 text-[#C9A45C]" />
                              <span>Open</span>
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}

              {canEdit && activeTab !== 'overview' && (
                <Card>
                  <SectionTitle icon={PhoneCall} title="Quick Actions" />
                  <QuickActions customerId={customerId} onAction={onAction} />
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}

/* ── Stable module-level presentational pieces ─────────────────────────────
   Declared outside the drawer so their identity never changes between renders
   (a nested component type would remount the inline edit inputs on every key). */

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#FFFFFF] border border-[#E1DDD3] rounded-2xl p-4 space-y-3 shadow-2xs ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b border-[#E1DDD3]">
      <Icon className="w-4 h-4 text-[#C9A45C]" />
      <h4 className="text-[11px] font-black uppercase tracking-wider text-[#123C35]">{title}</h4>
    </div>
  );
}

function InfoRow({ label, value, tone = 'default' }: { label: string; value: any; tone?: 'default' | 'danger' | 'warn' }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1 border-b border-[#E1DDD3] last:border-0">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#65716C] shrink-0">{label}</span>
      <span
        className={`min-w-0 flex-1 break-words text-right text-xs font-bold ${
          tone === 'danger' ? 'text-[#B42318]' : tone === 'warn' ? 'text-[#C58A18]' : 'text-[#17201D]'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="py-10 text-center text-[11px] font-semibold text-[#65716C] bg-[#F7F5F0] border border-dashed border-[#E1DDD3] rounded-2xl">
      {label}
    </div>
  );
}

/**
 * StatusTracker — wedding_status_history read as an order tracker.
 *
 * Oldest first and every row kept: a journey that took nine status changes has to
 * show nine. Each entry is date · time · Old → New · who · remarks, and the newest
 * one carries the filled dot so "where are we now" is answerable at a glance.
 */
function StatusTracker({ rows, today }: { rows: any[]; today: string }) {
  if (!rows.length) {
    return <EmptyState label="No status change has been recorded for this customer yet." />;
  }

  return (
    <ol className="space-y-2 border-l-2 border-[#E1DDD3] pl-3">
      {rows.map((s: any, index: number) => {
        const isLatest = index === rows.length - 1;
        const day = toISODateInput(s.created_at);
        const time = clockOf(s.created_at);
        const reason = text(s.change_reason);
        const onToday = Boolean(day && today && day === today);
        return (
          <li key={`st-${s.id ?? `${s.created_at}-${index}`}`} className="relative">
            <span
              aria-hidden="true"
              className={`absolute -left-[18px] top-2 h-2.5 w-2.5 rounded-full border-2 ${
                isLatest ? 'border-[#123C35] bg-[#123C35]' : 'border-[#E1DDD3] bg-[#FFFFFF]'
              }`}
            />
            <div
              className={`rounded-2xl border p-3 ${
                isLatest ? 'border-[#C9A45C]/45 bg-[#EDF3F0]' : 'border-[#E1DDD3] bg-[#F7F5F0]'
              }`}
            >
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#123C35]">
                  {day ? formatDateDisplay(day, 'Unknown date') : 'Date not recorded'}
                  {time ? <span className="font-bold text-[#65716C]"> · {time}</span> : null}
                </span>
                {isLatest && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-[#123C35] text-white">
                    Current
                  </span>
                )}
                {onToday && !isLatest && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-[#FFF4D6] text-[#C58A18]">TODAY</span>
                )}
              </div>

              <div className="mt-1 flex items-center gap-1.5 flex-wrap text-[11px] font-black text-[#17201D]">
                <span>{show(s.old_status, '—')}</span>
                <ArrowRightLeft className="w-3 h-3 text-[#C9A45C]" aria-hidden="true" />
                <span>{show(s.new_status, '—')}</span>
              </div>

              <div className="mt-1 text-[9px] font-bold uppercase tracking-wider text-[#C9A45C]">
                {show(s.changed_by, 'Staff')}
              </div>

              {reason && (
                <p className="mt-1 text-[10px] text-[#65716C] whitespace-pre-line">
                  <span className="font-black uppercase tracking-wider text-[9px]">Remarks · </span>
                  {reason}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function QuickActions({ customerId, onAction }: { customerId: number | null; onAction: (kind: QuickActionKind, id: number) => void }) {
  const actions: { kind: QuickActionKind; label: string; icon: any }[] = [
    { kind: 'call', label: 'Log Call', icon: PhoneCall },
    { kind: 'feedback', label: 'Feedback', icon: MessageSquare },
    { kind: 'follow_up', label: 'Follow-Up', icon: CalendarClock },
    { kind: 'note', label: 'Add Note', icon: StickyNote },
    { kind: 'stage', label: 'Move Stage', icon: ArrowRightLeft },
    { kind: 'visit', label: 'Record Visit', icon: Store },
    { kind: 'shopping', label: 'Shopping Plan', icon: ShoppingBag },
    { kind: 'convert', label: 'Mark Won', icon: Trophy }
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {actions.map((a) => {
        const AIcon = a.icon;
        return (
          <button
            key={a.kind}
            type="button"
            onClick={() => customerId !== null && onAction(a.kind, customerId)}
            className="px-2.5 py-2 rounded-xl bg-[#FFFFFF] hover:bg-[#EDF3F0] border border-[#E1DDD3] text-[10px] font-bold text-[#123C35] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <AIcon className="w-3.5 h-3.5 shrink-0 text-[#C9A45C]" />
            <span className="truncate">{a.label}</span>
          </button>
        );
      })}
    </div>
  );
}
