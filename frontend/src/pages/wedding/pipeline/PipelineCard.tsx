import { useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import {
  ArrowRightLeft,
  CalendarClock,
  CircleAlert,
  ClipboardList,
  Copy,
  Eye,
  MessageSquarePlus,
  MoreHorizontal,
  Phone,
  PhoneCall,
  ShoppingBag,
  Star,
  Store,
  Trophy,
  X,
  Check
} from 'lucide-react';

import { parseDate } from '../../../utils/dateUtils';
import { STAGE_LABELS, STAGE_PRESENTATION } from './types';
import type { PipelineCustomer, QuickActionKind, StageKey } from './types';
import {
  DASH,
  callsLogged,
  countValue,
  dateText,
  display,
  effectiveDaysOverdue,
  followUpsLogged,
  isDueToday,
  journeyProgress,
  nextContactTime
} from './pipelineDerived';

/**
 * PipelineCard — one customer inside a stage column.
 *
 * Hierarchy, top to bottom: who the customer is (name + code + status chip),
 * how far along the funnel they are (JourneyTracker), when they are next due
 * (the only coloured block on the card), then a compact labelled grid for
 * everything else, then their own words (latest feedback), then the action row.
 * Empty values render as a muted dash — the card never
 * prints undefined / null / NaN / Invalid Date, because every string goes
 * through `display()` and every date through `dateText()`, both of which answer
 * '' for unusable input.
 *
 * Quick actions and the kind each one raises (the board owns the modal):
 *   Update → opens the detail drawer, where the editable fields live
 *   Call → 'call' · Add Feedback → 'feedback'
 *   Schedule Follow-Up → 'follow_up' · Move Stage → 'stage'
 * View and the card body both call `onOpen`. "More" holds Add Note, the three
 * journey actions (Record Visit → 'visit', Shopping Plan → 'shopping', Mark Won →
 * 'convert') and the two things that are not CRM writes: dialling the number and
 * copying it.
 *
 * The component is presentational: it fetches nothing and imports no API client.
 */

export interface PipelineCardProps {
  customer: PipelineCustomer;
  /** Server Asia/Kolkata day (YYYY-MM-DD) from the board response. */
  today: string;
  onOpen: (c: PipelineCustomer) => void;
  onAction: (kind: QuickActionKind, c: PipelineCustomer) => void;
}

const labelClass = 'text-[9px] font-black uppercase tracking-wider text-[#6F5963]';

const textActionClass =
  'inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-[#E8D9D4] ' +
  'bg-[#FFFDFC] px-2 text-[9px] font-black uppercase tracking-wider text-[#4A173A] transition-colors ' +
  'hover:border-[#B76E79] hover:bg-[#FFF7F2] focus:outline-none focus:border-[#B76E79]';

const iconActionClass =
  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#E8D9D4] ' +
  'bg-[#FFFDFC] text-[#4A173A] transition-colors hover:border-[#B76E79] hover:bg-[#FFF7F2] ' +
  'focus:outline-none focus:border-[#B76E79]';

/** One full-width row inside the expanded "More" panel. */
const menuItemClass =
  'flex w-full items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#E8D9D4] ' +
  'bg-[#FFFAF7] px-2 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#4A173A] ' +
  'transition-colors hover:bg-[#FFF7F2] focus:outline-none focus:border-[#B76E79]';

const Field = ({ label, value }: { label: string; value?: string | null }) => {
  const text = value || '';
  return (
    <div className="min-w-0">
      <dt className={labelClass}>{label}</dt>
      <dd
        className={`mt-0.5 line-clamp-2 break-words text-[10px] font-bold leading-snug ${
          text ? 'text-[#2B1722]' : 'text-[#6F5963]/70'
        }`}
        title={text || undefined}
      >
        {text || DASH}
      </dd>
    </div>
  );
};

/* ── JourneyTracker ─────────────────────────────────────────────────────
 * The order-tracking bar shared by the card and the drawer header, so the two
 * can never disagree about where a customer stands. Derivation lives in
 * `journeyProgress` (pipelineDerived) — the stages come from the funnel order,
 * never from a status string matched in the UI.
 *
 * completed = tick · current = filled dot labelled "Current" · upcoming = hollow.
 * Off-funnel stages (`not_moving`, `other`) get their own honest band: every dot
 * stays hollow and the stage is named, so nothing is shown as progressed.
 */

const DOT_BASE = 'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[8px]';

export function JourneyTracker({
  stageKey,
  variant = 'compact'
}: {
  stageKey: StageKey;
  /** `compact` fits a 270px card column; `full` labels every step (drawer header). */
  variant?: 'compact' | 'full';
}) {
  const progress = journeyProgress(stageKey);
  const showLabels = variant === 'full';

  if (!progress.onFunnel) {
    return (
      <div
        className="rounded-xl border border-[#6F5963]/30 bg-[#F4F2F0] px-2 py-1.5"
        aria-label={`Off the funnel: ${progress.offFunnelLabel}`}
      >
        <p className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-[#6F5963]/40 bg-[#FFFDFC] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#6F5963]">
            <CircleAlert className="h-2.5 w-2.5" aria-hidden="true" />
            Off funnel
          </span>
          <span className="break-words text-[9px] font-black uppercase tracking-wider text-[#4A173A]">
            {progress.offFunnelLabel}
          </span>
        </p>
        <div className="mt-1.5 flex items-center gap-1" aria-hidden="true">
          {Array.from({ length: progress.totalCount }).map((_, index) => (
            <span key={index} className="h-1.5 w-1.5 shrink-0 rounded-full border border-[#6F5963]/40" />
          ))}
          <span className="ml-1 text-[8px] font-bold uppercase tracking-wider text-[#6F5963]/80">
            Not scored
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-[#E8D9D4] bg-[#FFFDFC] px-2 py-1.5"
      aria-label={`Journey step ${Number(progress.currentIndex) + 1} of ${progress.totalCount}: ${
        STAGE_LABELS[stageKey]
      }`}
    >
      <ol className={`flex items-center ${showLabels ? 'w-full' : 'justify-start'}`}>
        {progress.steps.map((step, index) => {
          const isLast = index === progress.steps.length - 1;
          return (
            <li key={step.key} className={`flex items-center ${showLabels ? 'flex-1 last:flex-none' : ''}`}>
              <span className="flex flex-col items-center gap-0.5" aria-current={step.state === 'current' ? 'step' : undefined}>
                <span
                  className={`${DOT_BASE} ${
                    step.state === 'completed'
                      ? 'border-[#198754] bg-[#198754] text-white'
                      : step.state === 'current'
                      ? 'border-[#4A173A] bg-[#4A173A] ring-2 ring-[#B76E79]/35'
                      : 'border-[#E8D9D4] bg-[#FFFDFC]'
                  }`}
                >
                  {step.state === 'completed' ? (
                    <Check className="h-2.5 w-2.5" strokeWidth={3.5} aria-hidden="true" />
                  ) : step.state === 'current' ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden="true" />
                  ) : null}
                </span>
                {showLabels && (
                  <span
                    className={`mt-0.5 max-w-full truncate text-center text-[8px] font-black uppercase tracking-wider ${
                      step.state === 'current'
                        ? 'text-[#4A173A]'
                        : step.state === 'completed'
                        ? 'text-[#198754]'
                        : 'text-[#6F5963]/70'
                    }`}
                    title={step.label}
                  >
                    {step.short}
                  </span>
                )}
              </span>
              {!isLast && (
                <span
                  aria-hidden="true"
                  className={`mx-0.5 h-px ${
                    showLabels
                      ? 'flex-1 min-w-[8px] self-start mt-2'
                      : 'w-2 flex-none'
                  } ${step.state === 'completed' ? 'bg-[#198754]/55' : 'bg-[#E8D9D4]'}`}
                />
              )}
            </li>
          );
        })}
      </ol>

      <p className="mt-1.5 border-t border-[#F3E7E2] pt-1.5 break-words text-[9px] font-black uppercase tracking-wider text-[#4A173A]">
        <span className="text-[#B76E79]">Current</span> · {STAGE_LABELS[stageKey]}
        <span className="ml-1 font-bold text-[#6F5963]">
          (step {Number(progress.currentIndex) + 1} of {progress.totalCount})
        </span>
      </p>
    </div>
  );
}

export default function PipelineCard({ customer, today, onOpen, onAction }: PipelineCardProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');

  const presentation = STAGE_PRESENTATION[customer.stage_key] || STAGE_PRESENTATION.other;

  const name = display(customer.customer_name) || `Customer #${customer.id}`;
  const code = display(customer.customer_code);
  const mobile = display(customer.mobile_number);
  const store = display(customer.location_name) || display(customer.location_code);
  const telecaller = display(customer.assigned_telecaller) || display(customer.last_contacted_by);
  const status = display(customer.customer_status);
  // A row whose status is blank still has a stage assigned by the backend, so the
  // chip names the stage rather than printing a dash.
  const chipLabel = status || STAGE_LABELS[customer.stage_key] || DASH;
  const priority = display(customer.priority);
  const outcome = display(customer.last_call_outcome) || display(customer.call_status);
  const feedback = display(customer.latest_feedback);
  const category = display(customer.preferred_shopping_category);
  const time = nextContactTime(customer);

  const calls = callsLogged(customer);
  const followUps = followUpsLogged(customer);
  // Both are board aggregates from GET /pipeline/board — never counted in the UI.
  const visits = countValue(customer.visits_count);
  const notes = countValue(customer.notes_count);

  const daysLate = effectiveDaysOverdue(customer, today);
  const overdue = daysLate > 0;
  const dueToday = isDueToday(customer.follow_up_date, today);
  const highPriority = /^(urgent|vip|high)$/i.test(priority);

  const cardTone = overdue
    ? 'bg-[#FDE8E7] border-[#B42318]/40 hover:border-[#B42318]'
    : dueToday
    ? 'bg-[#FFF4D6] border-[#C58A18]/40 hover:border-[#C58A18]'
    : `bg-[#FFFAF7] ${presentation.accent} hover:border-[#B76E79] hover:bg-[#FFFDFC]`;

  const urgencyTone = overdue
    ? 'bg-[#FFFDFC] border-[#B42318]/35 text-[#B42318]'
    : dueToday
    ? 'bg-[#FFFDFC] border-[#C58A18]/35 text-[#C58A18]'
    : 'bg-[#FFFDFC] border-[#E8D9D4] text-[#4A173A]';

  const urgencyLabel = overdue
    ? `Overdue by ${daysLate} ${daysLate === 1 ? 'day' : 'days'}`
    : dueToday
    ? 'Follow-up today'
    : parseDate(customer.follow_up_date)
    ? 'Next follow-up'
    : 'No follow-up scheduled';

  const openCard = () => onOpen(customer);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openCard();
    }
  };

  const run = (kind: QuickActionKind) => (event: MouseEvent) => {
    event.stopPropagation();
    onAction(kind, customer);
  };

  const toggleMore = (event: MouseEvent) => {
    event.stopPropagation();
    setCopyMessage('');
    setMoreOpen((open) => !open);
  };

  const copyValue = (value: string, label: string) => async (event: MouseEvent) => {
    event.stopPropagation();
    const clipboard = typeof navigator !== 'undefined' ? (navigator as any).clipboard : undefined;
    if (!clipboard?.writeText) {
      setCopyMessage('Clipboard is blocked here — select the text to copy');
      return;
    }
    try {
      await clipboard.writeText(value);
      setCopyMessage(`${label} copied`);
    } catch {
      setCopyMessage('Clipboard is blocked here — select the text to copy');
    }
  };

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`${name}, ${chipLabel}${overdue ? `, overdue by ${daysLate} days` : ''}`}
      onClick={openCard}
      onKeyDown={handleKeyDown}
      className={`group flex cursor-pointer flex-col rounded-2xl border p-3 shadow-2xs transition-colors focus:outline-none focus:border-[#B76E79] ${cardTone}`}
    >
      {/* 1 — identity */}
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="line-clamp-2 break-words text-[12px] font-black leading-tight text-[#2B1722] transition-colors group-hover:text-[#4A173A]">
            {name}
          </h4>
          <p className="mt-0.5 break-all text-[9px] font-bold uppercase tracking-wider text-[#6F5963]">
            {code || DASH}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`max-w-[110px] truncate rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${presentation.chip}`}
            title={chipLabel}
          >
            {chipLabel}
          </span>
          {highPriority && (
            <span className="inline-flex items-center gap-0.5 whitespace-nowrap rounded-full border border-[#B76E79]/40 bg-[#FFFDFC] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#B76E79]">
              <Star className="h-2.5 w-2.5 fill-[#B76E79] text-[#B76E79]" aria-hidden="true" />
              {priority}
            </span>
          )}
        </div>
      </header>

      {/* 2 — how far along the journey this customer is */}
      <div className="mt-2">
        <JourneyTracker stageKey={customer.stage_key} />
      </div>

      {/* 2 — the one thing that must be readable at a glance */}
      <div className={`mt-2 rounded-xl border px-2 py-1.5 ${urgencyTone}`}>
        <p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider">
          {overdue ? (
            <CircleAlert className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
          ) : (
            <CalendarClock className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
          )}
          <span className="truncate">{urgencyLabel}</span>
        </p>
        <p className="mt-0.5 break-words text-[10px] font-bold leading-snug text-[#2B1722]">
          {dateText(customer.follow_up_date, { day: '2-digit', month: 'short', year: 'numeric' }) || DASH}
          {time && <span className="font-semibold text-[#6F5963]"> · {time}</span>}
        </p>
      </div>

      {/* 3 — the rest of the record, as a compact labelled grid */}
      <dl className="mt-2 grid grid-cols-2 items-start gap-x-2 gap-y-2">
        <Field label="Mobile" value={mobile} />
        <Field label="Current status" value={status} />
        <Field label="Store" value={store} />
        <Field label="Telecaller" value={telecaller} />
        <Field label="Wedding" value={dateText(customer.wedding_date)} />
        <Field
          label="Exp. shopping"
          value={dateText(customer.expected_shopping_date)}
        />
        <Field label="Category" value={category} />
        <Field label="Priority" value={priority} />
        <Field label="Last contact" value={dateText(customer.last_call_date)} />
        <Field label="Last call result" value={outcome} />
        <Field label="Calls" value={calls === null ? '' : String(calls)} />
        <Field label="Follow-ups" value={followUps === null ? '' : String(followUps)} />
        <Field label="Visits" value={visits === null ? '' : String(visits)} />
        <Field label="Notes" value={notes === null ? '' : String(notes)} />
      </dl>

      {/* 4 — in the customer's own words */}
      <div className="mt-2 rounded-xl border border-[#E8D9D4] bg-[#FFFDFC] px-2 py-1.5">
        <p className={labelClass}>Latest feedback</p>
        <p
          className={`mt-0.5 line-clamp-2 break-words text-[10px] font-bold leading-snug ${
            feedback ? 'text-[#2B1722]' : 'text-[#6F5963]/70'
          }`}
          title={feedback || undefined}
        >
          {feedback || DASH}
        </p>
      </div>

      {/* 5 — actions. Two groups that wrap as units, pinned to the bottom of the
          card so a short card and a tall one in the same column still read alike. */}
      <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-[#E8D9D4] pt-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              openCard();
            }}
            className={textActionClass}
            title={`Open ${name}`}
          >
            <Eye className="h-3 w-3 text-[#B76E79]" aria-hidden="true" />
            View
          </button>
          <button
            type="button"
            onClick={openCard}
            className={textActionClass}
            title="Update this customer's details"
          >
            <ClipboardList className="h-3 w-3 text-[#B76E79]" aria-hidden="true" />
            Update
          </button>
          <button
            type="button"
            onClick={run('call')}
            className={textActionClass}
            title="Log a call"
          >
            <PhoneCall className="h-3 w-3 text-[#B76E79]" aria-hidden="true" />
            Call
          </button>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={run('feedback')}
            className={iconActionClass}
            aria-label="Add feedback"
            title="Add feedback"
          >
            <MessageSquarePlus className="h-3.5 w-3.5 text-[#B76E79]" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={run('follow_up')}
            className={iconActionClass}
            aria-label="Schedule follow-up"
            title="Schedule follow-up"
          >
            <CalendarClock className="h-3.5 w-3.5 text-[#B76E79]" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={run('stage')}
            className={iconActionClass}
            aria-label="Move stage"
            title="Move stage"
          >
            <ArrowRightLeft className="h-3.5 w-3.5 text-[#B76E79]" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={toggleMore}
            aria-expanded={moreOpen}
            className={iconActionClass}
            aria-label="More actions"
            title="More actions"
          >
            {moreOpen ? (
              <X className="h-3.5 w-3.5 text-[#B76E79]" aria-hidden="true" />
            ) : (
              <MoreHorizontal className="h-3.5 w-3.5 text-[#B76E79]" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded inline (never absolutely positioned) so a scrolling stage
          column cannot clip it. */}
      {moreOpen && (
        <div
          className="mt-2 space-y-1.5 rounded-xl border border-[#E8D9D4] bg-[#FFFDFC] p-2"
          onClick={(event) => event.stopPropagation()}
        >
          <p className="flex items-center justify-between gap-2">
            <span className={labelClass}>More</span>
            <button
              type="button"
              onClick={toggleMore}
              className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-[#E8D9D4] bg-[#FFFAF7] text-[#4A173A] transition-colors hover:bg-[#FFF7F2]"
              aria-label="Close more actions"
              title="Close"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </p>

          {mobile ? (
            <a
              href={`tel:${mobile.replace(/[^\d+]/g, '')}`}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#E8D9D4] bg-[#FFFAF7] px-2 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#4A173A] transition-colors hover:bg-[#FFF7F2]"
            >
              <Phone className="h-3 w-3 shrink-0 text-[#B76E79]" aria-hidden="true" />
              <span className="truncate">Dial {mobile}</span>
            </a>
          ) : (
            <p className="rounded-lg border border-[#E8D9D4] bg-[#FFFAF7] px-2 py-1.5 text-[10px] font-bold text-[#6F5963]">
              No mobile on this record
            </p>
          )}

          {mobile && (
            <button
              type="button"
              onClick={copyValue(mobile, 'Mobile number')}
              className="flex w-full items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#E8D9D4] bg-[#FFFAF7] px-2 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#4A173A] transition-colors hover:bg-[#FFF7F2]"
            >
              <Copy className="h-3 w-3 shrink-0 text-[#B76E79]" aria-hidden="true" />
              <span className="truncate">Copy mobile number</span>
            </button>
          )}

          {code && (
            <button
              type="button"
              onClick={copyValue(code, 'Customer code')}
              className="flex w-full items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#E8D9D4] bg-[#FFFAF7] px-2 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#4A173A] transition-colors hover:bg-[#FFF7F2]"
            >
              <Copy className="h-3 w-3 shrink-0 text-[#B76E79]" aria-hidden="true" />
              <span className="truncate">Copy {code}</span>
            </button>
          )}

          <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-[#6F5963]">Journey</p>

          <button
            type="button"
            onClick={run('visit')}
            className={menuItemClass}
          >
            <Store className="h-3 w-3 shrink-0 text-[#B76E79]" aria-hidden="true" />
            <span className="truncate">Record store visit</span>
          </button>

          <button
            type="button"
            onClick={run('shopping')}
            className={menuItemClass}
          >
            <ShoppingBag className="h-3 w-3 shrink-0 text-[#B76E79]" aria-hidden="true" />
            <span className="truncate">Update shopping plan</span>
          </button>

          <button
            type="button"
            onClick={run('convert')}
            className={menuItemClass}
          >
            <Trophy className="h-3 w-3 shrink-0 text-[#B76E79]" aria-hidden="true" />
            <span className="truncate">Mark won / converted</span>
          </button>

          <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-[#6F5963]">Record</p>

          <button
            type="button"
            onClick={run('note')}
            className={menuItemClass}
          >
            <ClipboardList className="h-3 w-3 shrink-0 text-[#B76E79]" aria-hidden="true" />
            <span className="truncate">Add note</span>
          </button>

          {copyMessage && (
            <p className="text-[9px] font-bold leading-snug text-[#6F5963]">{copyMessage}</p>
          )}
        </div>
      )}
    </article>
  );
}
