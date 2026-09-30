/**
 * pipelineDerived — the pure derivation layer for the Wedding Status Pipeline.
 *
 * Two rules hold for every function in this file:
 *
 *  1. Nothing here reads the clock. Every date test receives `today`, the
 *     Asia/Kolkata calendar day returned by GET /wedding-crm/pipeline/board as
 *     `PipelineBoardResponse.today`. `new Date()` would disagree with the
 *     server for any browser outside IST and could flip a card's state between
 *     two renders of the same payload, so it is never called. When `today` is
 *     missing the date tests answer `false` ("not provable") rather than guess.
 *  2. Nothing here throws and nothing here prints a junk word. Values that
 *     arrive as null, as the MySQL zero date, or as the literal strings
 *     'null' / 'undefined' / 'NaN' / 'Invalid Date' come back as '' so the
 *     caller renders one muted dash.
 *
 * The backend already decides stage membership (`stage_key`) and already
 * resolves the aggregate counts, so these helpers only order, bucket and label.
 */

import { formatDateDisplay, parseDate } from '../../../utils/dateUtils';
import {
  FUNNEL_STAGE_ORDER,
  STAGE_LABELS,
  STAGE_PRESENTATION
} from './types';
import type { PipelineCustomer, PipelineStage, StageKey } from './types';

export const MS_PER_DAY = 86400000;

/** The only "no value" glyph rendered by the pipeline. Never the word undefined. */
export const DASH = '—';

/* ── text safety ─────────────────────────────────────────────────── */

const JUNK_WORDS = new Set([
  '',
  '-',
  '--',
  DASH,
  'null',
  'undefined',
  'nan',
  'nat',
  'none',
  'n/a',
  'na',
  'invalid date',
  'not scheduled',
  'unassigned'
]);

/**
 * Coerce any API value into printable text, or '' when there is nothing real to
 * show. Numbers are printed only when finite; booleans and objects are never
 * stringified into the UI.
 */
export const display = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return '';
  if (value instanceof Date || (typeof value === 'object' && 'toISOString' in (value as any))) return '';
  const text = String(value).trim();
  if (!text) return '';
  if (JUNK_WORDS.has(text.toLowerCase())) return '';
  if (/^0{4}[-/]0{2}[-/]0{2}/.test(text)) return '';
  if (/^nan\b/i.test(text)) return '';
  if (/invalid date/i.test(text)) return '';
  return text;
};

/** Printable text or the muted dash. */
export const displayOrDash = (value: unknown): string => display(value) || DASH;

/** True when there is something real to render. */
export const hasText = (value: unknown): boolean => display(value) !== '';

/** A finite count above zero, else null — so "0 calls" never reads as "1". */
export const countValue = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
};

/* ── dates, always against the server's IST day ──────────────────── */

/** Local midnight ms for the calendar day a value falls on, else null. */
const dayStartMs = (value: unknown): number | null => {
  const d = parseDate(value);
  if (!d) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** Whole calendar days from `from` up to `to`; null when either is unusable. */
export const daysBetween = (from: unknown, to: unknown): number | null => {
  const a = dayStartMs(from);
  const b = dayStartMs(to);
  if (a === null || b === null) return null;
  return Math.round((b - a) / MS_PER_DAY);
};

/** Strictly before the server's IST day. */
export const isOverdue = (followUpDate?: string | null, today?: string | null): boolean => {
  const diff = daysBetween(followUpDate, today);
  return diff !== null && diff > 0;
};

/** The same calendar day as the server's IST day. */
export const isDueToday = (followUpDate?: string | null, today?: string | null): boolean => {
  const diff = daysBetween(followUpDate, today);
  return diff !== null && diff === 0;
};

/** Future relative to the server's IST day. */
export const isUpcoming = (followUpDate?: string | null, today?: string | null): boolean => {
  const diff = daysBetween(followUpDate, today);
  return diff !== null && diff < 0;
};

/** Days late against `today`; 0 when it is today, in the future or unusable. */
export const daysOverdue = (followUpDate?: string | null, today?: string | null): number => {
  const diff = daysBetween(followUpDate, today);
  if (diff === null || diff <= 0) return 0;
  return diff;
};

/** `DATEDIFF(CURDATE(), follow_up_date)` from the board query, when it is usable. */
export const serverDaysOverdue = (customer?: PipelineCustomer | null): number | null => {
  const raw = customer?.overdue_days as unknown;
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
};

/**
 * Days late, preferring the server's `overdue_days` (that is the value the query
 * sorted and filtered on) and falling back to `today` arithmetic.
 */
export const effectiveDaysOverdue = (customer: PipelineCustomer, today?: string | null): number => {
  const fromServer = serverDaysOverdue(customer);
  if (fromServer !== null) return fromServer;
  return daysOverdue(customer.follow_up_date, today);
};

/** Formatted date or '' — the caller decides where to put the dash. */
export const dateText = (value: unknown, opts?: Intl.DateTimeFormatOptions): string => {
  if (!parseDate(value)) return '';
  return formatDateDisplay(value, '', opts || { day: '2-digit', month: 'short', year: 'numeric' });
};

/** Short form used inside dense rows: "12 Oct". */
export const shortDateText = (value: unknown): string =>
  dateText(value, { day: '2-digit', month: 'short' });

/** '09:30' | '0930' | '9:30 AM' → '9:30 AM'; free-text slots pass through. */
export const formatTimeText = (value: unknown): string => {
  const raw = display(value);
  if (!raw) return '';
  const m = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?(?:\.\d+)?\s*([AaPp][Mm])?$/);
  if (!m) return raw;
  const hour = Number(m[1]);
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return raw;
  const suffix = (m[3] || (hour >= 12 ? 'PM' : 'AM')).toUpperCase();
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${m[2]} ${suffix}`;
};

/** Preferred slot for the next contact, falling back to the call slot. */
export const nextContactTime = (customer: PipelineCustomer): string =>
  display(customer.preferred_followup_time) || formatTimeText(customer.preferred_call_time);

/** Where a follow-up sits relative to the server's day. */
export type FollowUpState = 'overdue' | 'today' | 'upcoming' | 'unscheduled';

export const followUpState = (customer: PipelineCustomer, today?: string | null): FollowUpState => {
  if (!parseDate(customer.follow_up_date)) return 'unscheduled';
  if (effectiveDaysOverdue(customer, today) > 0) return 'overdue';
  if (isDueToday(customer.follow_up_date, today)) return 'today';
  return 'upcoming';
};

/* ── counts ──────────────────────────────────────────────────────── */

/** Logged calls: the subquery count first, the denormalised column second. */
export const callsLogged = (customer: PipelineCustomer): number | null =>
  countValue(customer.calls_logged) ?? countValue(customer.total_calls_count);

export const followUpsLogged = (customer: PipelineCustomer): number | null =>
  countValue(customer.followups_logged);

/* ── status predicates ───────────────────────────────────────────── */

const hasSignal = (source: PipelineCustomer, needles: string[]): boolean => {
  const hay = `${String(source.customer_status || '')} ${String(source.call_status || '')} ${String(
    source.last_call_outcome || ''
  )}`.toLowerCase();
  return needles.some((needle) => hay.includes(needle));
};

/**
 * The customer asked to be called back: the call_status the calling desk writes
 * ('Call Back Requested') or a logged outcome that mentions a call back.
 */
export const isCallbackRequested = (customer: PipelineCustomer): boolean => {
  const callStatus = display(customer.call_status).toLowerCase();
  const outcome = display(customer.last_call_outcome).toLowerCase();
  return (
    callStatus === 'call back requested' ||
    callStatus === 'callback' ||
    outcome.includes('call back') ||
    outcome.includes('callback')
  );
};

/**
 * "Awaiting response" — we have reached the customer's record but there has been
 * no two-way conversation, so the ball is with the customer, not the telecaller:
 *   · an unanswered attempt: No Answer / Busy / Switched Off / Wrong Number /
 *     Invalid Number, or customer_status 'No Response' (stage follow_up);
 *   · or an untouched new lead that has never been called.
 * Deliberately excludes 'Connected — …' outcomes, which are conversations.
 */
export const isAwaitingResponse = (customer: PipelineCustomer): boolean => {
  if (isCallbackRequested(customer)) return false;
  if (
    hasSignal(customer, [
      'no answer',
      'no response',
      'switched off',
      'wrong number',
      'invalid number',
      'busy'
    ])
  ) {
    return true;
  }
  const neverCalled = (callsLogged(customer) ?? 0) === 0 && !parseDate(customer.last_call_date);
  return neverCalled && customer.stage_key === 'new';
};

export const isNewLead = (customer: PipelineCustomer): boolean => customer.stage_key === 'new';

/**
 * Statuses that finish a customer's call for the day. Everything else the desk
 * writes — Pending (the column default), Scheduled, In Progress, Call Back
 * Requested, No Answer, Busy, Switched Off, No Response — still owes the
 * customer a call, matching the pending-call aggregate in weddingController
 * (`call_status IN ('Pending','Call Back Requested','No Answer','Busy')`).
 */
const CALL_ALREADY_MADE = ['completed', 'connected', 'cancelled'];

export const callStillOwed = (customer: PipelineCustomer): boolean => {
  const status = display(customer.call_status).toLowerCase();
  if (!status) return true;
  return !CALL_ALREADY_MADE.includes(status);
};

/* ── ordering ────────────────────────────────────────────────────── */

/** Lower sorts first. Unknown / blank priorities keep their place at the back. */
export const priorityRank = (priority?: string | null): number => {
  switch (display(priority).toLowerCase()) {
    case 'urgent':
    case 'vip':
    case 'high':
      return 0;
    case 'medium':
    case 'normal':
      return 1;
    case 'low':
      return 2;
    default:
      return 3;
  }
};

const recencyMs = (customer: PipelineCustomer): number => {
  const d = parseDate(customer.updated_at) || parseDate(customer.created_at);
  return d ? d.getTime() : 0;
};

const followUpMs = (customer: PipelineCustomer): number | null => {
  const d = parseDate(customer.follow_up_date);
  return d ? d.getTime() : null;
};

const compareFollowUpAsc = (a: PipelineCustomer, b: PipelineCustomer): number => {
  const av = followUpMs(a);
  const bv = followUpMs(b);
  // A customer with no scheduled follow-up is never more urgent than one with a date.
  if (av === null && bv === null) return recencyMs(b) - recencyMs(a);
  if (av === null) return 1;
  if (bv === null) return -1;
  if (av !== bv) return av - bv;
  return recencyMs(b) - recencyMs(a);
};

/**
 * The board's reading order: overdue first (worst first), then today, then the
 * upcoming diary, then anything unscheduled. Inside each tier Urgent leads, and
 * equal dates fall back to the most recently touched record.
 *
 * `today` only sharpens the overdue/today split — when it is absent the server's
 * `overdue_days` still classifies each row, and the follow-up date ordering is
 * unchanged, so no browser clock is consulted either way.
 */
export const sortByUrgency = (
  customers: PipelineCustomer[],
  today?: string | null
): PipelineCustomer[] => {
  const tierOf = (c: PipelineCustomer): number => {
    if (effectiveDaysOverdue(c, today) > 0 || serverDaysOverdue(c) !== null) return 0;
    if (isDueToday(c.follow_up_date, today)) return 1;
    return parseDate(c.follow_up_date) ? 2 : 3;
  };
  return [...(customers || [])].sort((a, b) => {
    const tier = tierOf(a) - tierOf(b);
    if (tier !== 0) return tier;
    if (tierOf(a) === 0) {
      // Most overdue leads the queue.
      const days = effectiveDaysOverdue(b, today) - effectiveDaysOverdue(a, today);
      if (days !== 0) return days;
    }
    const rank = priorityRank(a.priority) - priorityRank(b.priority);
    if (rank !== 0) return rank;
    return compareFollowUpAsc(a, b);
  });
};

/* ── stage grouping ──────────────────────────────────────────────── */

const ALL_STAGE_KEYS = Object.keys(STAGE_PRESENTATION) as StageKey[];

const emptyStageMap = (): Record<StageKey, PipelineCustomer[]> => {
  const map = {} as Record<StageKey, PipelineCustomer[]>;
  for (const key of ALL_STAGE_KEYS) map[key] = [];
  return map;
};

/**
 * Rows bucketed by the `stage_key` the backend assigned. Every key in `stages`
 * and every known stage exists in the result, so a column can render `[]`
 * instead of `undefined`. Unknown keys collected from the rows survive under
 * their own key so nothing is silently dropped.
 */
export const groupByStage = (
  customers: PipelineCustomer[],
  stages: PipelineStage[]
): Record<StageKey, PipelineCustomer[]> => {
  const map = emptyStageMap();
  for (const stage of stages || []) {
    if (stage && !map[stage.key]) map[stage.key] = [];
  }
  for (const customer of customers || []) {
    if (!customer) continue;
    const key = (customer.stage_key || 'other') as StageKey;
    if (!map[key]) map[key] = [];
    map[key].push(customer);
  }
  return map;
};

export interface PipelineStageGroup {
  stage: PipelineStage;
  customers: PipelineCustomer[];
}

/**
 * The same buckets as ordered column data, pre-sorted by urgency. Columns come
 * back in the order `stages` supplies, so the board cannot drift from the server.
 */
export const stageGroups = (
  customers: PipelineCustomer[],
  stages: PipelineStage[],
  today?: string | null
): PipelineStageGroup[] => {
  const buckets = groupByStage(customers, stages);
  return (stages || []).map((stage) => ({
    stage,
    customers: sortByUrgency(buckets[stage.key] || [], today)
  }));
};

/* ── today's work ────────────────────────────────────────────────── */

export type TodayWorkKey =
  | 'calls_due_today'
  | 'followups_due_today'
  | 'overdue_followups'
  | 'new_leads'
  | 'awaiting_response'
  | 'callback_requested'
  | 'shopping_today'
  | 'visits_today'
  | 'recently_updated';

/** tone maps onto the palette the board already uses for these states. */
export type TodayWorkTone = 'alert' | 'due' | 'positive' | 'neutral';

export interface TodayWorkBucket {
  key: TodayWorkKey;
  label: string;
  hint: string;
  tone: TodayWorkTone;
  customers: PipelineCustomer[];
}

export interface TodayWorkSummary {
  /** Echoes the server day the buckets were built against. */
  today: string;
  buckets: TodayWorkBucket[];
  byKey: Record<TodayWorkKey, PipelineCustomer[]>;
  callsDueToday: PipelineCustomer[];
  followUpsDueToday: PipelineCustomer[];
  overdueFollowUps: PipelineCustomer[];
  newLeads: PipelineCustomer[];
  awaitingResponse: PipelineCustomer[];
  callbackRequested: PipelineCustomer[];
  shoppingPlannedToday: PipelineCustomer[];
  storeVisitsToday: PipelineCustomer[];
  recentlyUpdated: PipelineCustomer[];
}

/** Rows with a follow-up date earlier than the server's day. */
export const overdueCustomers = (
  customers: PipelineCustomer[],
  today?: string | null
): PipelineCustomer[] =>
  (customers || []).filter(
    (c) => serverDaysOverdue(c) !== null || isOverdue(c?.follow_up_date, today)
  );

/** Rows whose follow-up falls on the server's day. */
export const dueTodayCustomers = (
  customers: PipelineCustomer[],
  today?: string | null
): PipelineCustomer[] => (customers || []).filter((c) => isDueToday(c?.follow_up_date, today));

/**
 * Every "today" counter for the desk, derived from the rows already on screen —
 * no extra request, so the strip can never disagree with the board.
 *
 * A follow-up date doubles as the call schedule on this endpoint, so the two
 * today buckets split by whether the call itself is still owed: `calls_due_today`
 * holds rows passing `callStillOwed`, `followups_due_today` holds every row
 * scheduled for today.
 *
 * `store_visits_today` uses the freshest evidence the board payload carries: the
 * row's status change is what records a visit, so a `visited` row updated on the
 * server's day is a visit that happened today.
 */
export const countTodayWork = (
  customers: PipelineCustomer[],
  today: string
): TodayWorkSummary => {
  const rows = customers || [];

  const followUpsDueToday = dueTodayCustomers(rows, today);
  const callsDueToday = followUpsDueToday.filter(callStillOwed);
  const overdueFollowUps = sortByUrgency(overdueCustomers(rows, today), today);
  const newLeads = rows.filter(isNewLead);
  const awaitingResponse = rows.filter(isAwaitingResponse);
  const callbackRequested = rows.filter(isCallbackRequested);
  const shoppingPlannedToday = rows.filter((c) => isDueToday(c.expected_shopping_date, today));
  const storeVisitsToday = rows.filter(
    (c) => c.stage_key === 'visited' && isDueToday(c.updated_at, today)
  );
  const recentlyUpdated = rows.filter((c) => isDueToday(c.updated_at, today));

  const byKey: Record<TodayWorkKey, PipelineCustomer[]> = {
    calls_due_today: callsDueToday,
    followups_due_today: followUpsDueToday,
    overdue_followups: overdueFollowUps,
    new_leads: newLeads,
    awaiting_response: awaitingResponse,
    callback_requested: callbackRequested,
    shopping_today: shoppingPlannedToday,
    visits_today: storeVisitsToday,
    recently_updated: recentlyUpdated
  };

  const buckets: TodayWorkBucket[] = [
    {
      key: 'calls_due_today',
      label: 'Calls due today',
      hint: 'Scheduled for today and not logged as completed',
      tone: 'due',
      customers: callsDueToday
    },
    {
      key: 'followups_due_today',
      label: 'Follow-ups today',
      hint: 'Every customer scheduled on the server date',
      tone: 'due',
      customers: followUpsDueToday
    },
    {
      key: 'overdue_followups',
      label: 'Overdue',
      hint: 'Follow-up date is past the server date',
      tone: 'alert',
      customers: overdueFollowUps
    },
    {
      key: 'new_leads',
      label: 'New leads',
      hint: 'Registered and not worked yet',
      tone: 'neutral',
      customers: newLeads
    },
    {
      key: 'awaiting_response',
      label: 'Awaiting response',
      hint: 'No answer, busy, wrong number or untried new lead',
      tone: 'neutral',
      customers: awaitingResponse
    },
    {
      key: 'callback_requested',
      label: 'Callback requested',
      hint: 'The customer asked us to call back',
      tone: 'due',
      customers: callbackRequested
    },
    {
      key: 'shopping_today',
      label: 'Shopping today',
      hint: 'Expected shopping date is today',
      tone: 'positive',
      customers: shoppingPlannedToday
    },
    {
      key: 'visits_today',
      label: 'Store visits today',
      hint: 'Reached Visited Store today',
      tone: 'positive',
      customers: storeVisitsToday
    },
    {
      key: 'recently_updated',
      label: 'Updated today',
      hint: 'Record touched on the server date',
      tone: 'neutral',
      customers: recentlyUpdated
    }
  ];

  return {
    today: display(today),
    buckets,
    byKey,
    callsDueToday,
    followUpsDueToday,
    overdueFollowUps,
    newLeads,
    awaitingResponse,
    callbackRequested,
    shoppingPlannedToday,
    storeVisitsToday,
    recentlyUpdated
  };
};

/* ── journey tracker ─────────────────────────────────────────────── */

export type JourneyStepState = 'completed' | 'current' | 'upcoming';

export interface JourneyStep {
  key: StageKey;
  label: string;
  short: string;
  state: JourneyStepState;
}

export interface JourneyProgress {
  /** The funnel in FUNNEL_STAGE_ORDER, each step already classified. Empty when the
   *  customer sits off-funnel — the caller then renders `offFunnelLabel` instead of
   *  inventing a position the funnel does not have. */
  steps: JourneyStep[];
  onFunnel: boolean;
  /** Index of the current stage inside `steps`, or null when off-funnel. */
  currentIndex: number | null;
  completedCount: number;
  totalCount: number;
  /** Stage label for the off-funnel keys; '' when the customer is on the funnel. */
  offFunnelLabel: string;
}

/** Two-word maximum, so the tracker fits a 270px card without clipping. */
const FUNNEL_SHORT_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  follow_up: 'Follow-Up',
  shopping_planned: 'Shopping',
  visited: 'Visited',
  won: 'Won'
};

/**
 * Where a `stage_key` sits in the funnel. `not_moving` and `other` are deliberately
 * NOT given a position: a stalled or unclassified journey is reported as such, and
 * the completed/upcoming dots are never drawn as if it had progressed.
 */
export const journeyProgress = (stageKey?: StageKey | null): JourneyProgress => {
  const key = (stageKey || 'other') as StageKey;
  const currentIndex = FUNNEL_STAGE_ORDER.indexOf(key);

  if (currentIndex === -1) {
    return {
      steps: [],
      onFunnel: false,
      currentIndex: null,
      completedCount: 0,
      totalCount: FUNNEL_STAGE_ORDER.length,
      offFunnelLabel: STAGE_LABELS[key] || 'Needs Review'
    };
  }

  const steps: JourneyStep[] = FUNNEL_STAGE_ORDER.map((stage, index) => ({
    key: stage,
    label: STAGE_LABELS[stage],
    short: FUNNEL_SHORT_LABELS[stage] || STAGE_LABELS[stage],
    state: index < currentIndex ? 'completed' : index === currentIndex ? 'current' : 'upcoming'
  }));

  return {
    steps,
    onFunnel: true,
    currentIndex,
    completedCount: currentIndex,
    totalCount: FUNNEL_STAGE_ORDER.length,
    offFunnelLabel: ''
  };
};

/* ── JSON journey columns (wedding_functions / shopping_requirements) ──── */

/**
 * The vocabulary the registration form writes into `wedding_functions`
 * (WeddingRegistration.tsx). Values are stored as these ids; a row carrying a
 * label or an unknown string still round-trips untouched.
 */
export const WEDDING_FUNCTION_OPTIONS: { id: string; label: string }[] = [
  { id: 'engagement', label: 'Engagement' },
  { id: 'haldi', label: 'Haldi' },
  { id: 'mehendi', label: 'Mehendi' },
  { id: 'sangeet', label: 'Sangeet' },
  { id: 'wedding', label: 'Wedding' },
  { id: 'reception', label: 'Reception' },
  { id: 'other', label: 'Other' }
];

/**
 * `shopping_requirements` is a JSON object keyed by requirement category. The
 * registration form writes `{ category: [items] }`; the pipeline writes
 * `{ category: true }`. Both shapes are read here, so the checkbox set always
 * shows what is actually stored.
 */
export const SHOPPING_REQUIREMENT_CATEGORIES: string[] = [
  'Sarees',
  'Menswear',
  'Lehengas',
  'Kids',
  'Jewellery',
  'Other'
];

const FUNCTION_LABEL_BY_ID = new Map(
  WEDDING_FUNCTION_OPTIONS.map((f) => [f.id.toLowerCase(), f.label])
);
const FUNCTION_ID_BY_LABEL = new Map(
  WEDDING_FUNCTION_OPTIONS.map((f) => [f.label.toLowerCase(), f.id])
);

/** Stored values (ids where known) as a de-duplicated array of strings. */
export const weddingFunctionValues = (raw: unknown): string[] => {
  let list: unknown[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (raw && typeof raw === 'object') list = Object.entries(raw as Record<string, unknown>)
    .filter(([, v]) => v === true || v === 1 || (Array.isArray(v) && v.length > 0))
    .map(([k]) => k);
  else {
    const textValue = display(raw);
    list = textValue ? textValue.split(',').map((part) => part.trim()).filter(Boolean) : [];
  }

  const seen: string[] = [];
  for (const item of list) {
    const value = display(item);
    if (!value) continue;
    const normalised = FUNCTION_ID_BY_LABEL.get(value.toLowerCase()) ||
      (FUNCTION_LABEL_BY_ID.has(value.toLowerCase()) ? value.toLowerCase() : value);
    if (!seen.includes(normalised)) seen.push(normalised);
  }
  return seen;
};

/** Printable "Engagement, Sangeet, Reception" for a read-only row. */
export const weddingFunctionLabels = (raw: unknown): string =>
  weddingFunctionValues(raw)
    .map((value) => FUNCTION_LABEL_BY_ID.get(value.toLowerCase()) || value)
    .join(', ');

/** `{ category: true }` for checked, `false` for unchecked-but-known. */
export const shoppingRequirementMap = (raw: unknown): Record<string, boolean> => {
  const map: Record<string, boolean> = {};
  if (!raw) return map;

  if (Array.isArray(raw)) {
    for (const item of raw) {
      const value = display(item);
      if (value) map[value] = true;
    }
    return map;
  }

  if (typeof raw === 'object') {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      const label = display(key);
      if (!label) continue;
      const checked = Array.isArray(value)
        ? value.length > 0
        : typeof value === 'boolean'
        ? value
        : value === null
        ? false
        : display(value) !== '';
      map[label] = checked;
    }
    return map;
  }

  const textValue = display(raw);
  if (textValue) {
    for (const part of textValue.split(',')) {
      const label = part.trim();
      if (label) map[label] = true;
    }
  }
  return map;
};

/** Every category worth offering: the canonical list plus anything already stored. */
export const shoppingRequirementUniverse = (raw: unknown): string[] => {
  const stored = Object.keys(shoppingRequirementMap(raw));
  const all = [...SHOPPING_REQUIREMENT_CATEGORIES];
  for (const key of stored) if (!all.includes(key)) all.push(key);
  return all;
};

/** Only the checked categories, as the payload the JSON column should hold. */
export const checkedRequirementPayload = (categories: string[]): Record<string, boolean> => {
  const payload: Record<string, boolean> = {};
  for (const key of categories) if (key) payload[key] = true;
  return payload;
};

/**
 * Printable "Sarees, Menswear" for a read-only row. A registration row stores
 * `{ category: [items] }`, so the items are named too — the checkbox editor
 * works on categories, this shows what the column really holds.
 */
export const shoppingRequirementText = (raw: unknown): string => {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const parts = Object.entries(raw as Record<string, unknown>)
      .map(([key, value]) => {
        const label = display(key);
        if (!label) return '';
        const checked = Array.isArray(value) ? value.length > 0 : boolValue(value);
        if (!checked) return '';
        if (Array.isArray(value)) {
          const items = value.map((v) => display(v)).filter(Boolean).join(', ');
          return items ? `${label} (${items})` : label;
        }
        return label;
      })
      .filter(Boolean);
    if (parts.length) return parts.join(', ');
  }
  return Object.entries(shoppingRequirementMap(raw))
    .filter(([, checked]) => checked)
    .map(([key]) => key)
    .join(', ');
};

/* ── booleans ────────────────────────────────────────────────────── */

/** DB 0/1, JSON true/false and 'Yes' all mean the same thing here. */
export const boolValue = (raw: unknown): boolean => {
  if (typeof raw === 'boolean') return raw;
  if (raw === null || raw === undefined) return false;
  if (typeof raw === 'number') return raw !== 0;
  const textValue = display(raw).toLowerCase();
  return textValue === 'true' || textValue === 'yes' || textValue === '1' || textValue === 't';
};

/** Printable yes/no for a read-only row; '' when the column was never written. */
export const boolText = (raw: unknown): string => {
  if (raw === null || raw === undefined || raw === '') return '';
  return boolValue(raw) ? 'Yes' : 'No';
};

/* ── money ───────────────────────────────────────────────────────── */

/** ₹ amount from any numeric API value; '' when there is nothing to print. */
export const rupeeText = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};
