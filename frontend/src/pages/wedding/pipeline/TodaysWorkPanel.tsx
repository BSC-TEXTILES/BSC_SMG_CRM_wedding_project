import { useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import { CalendarClock, ChevronDown, PhoneCall, RefreshCw, X } from 'lucide-react';

import { parseDate } from '../../../utils/dateUtils';
import type { PipelineCustomer, QuickActionKind } from './types';
import {
  DASH,
  countTodayWork,
  dateText,
  display,
  effectiveDaysOverdue,
  isDueToday,
  nextContactTime
} from './pipelineDerived';
import type { TodayWorkKey, TodayWorkTone } from './pipelineDerived';

/**
 * TodaysWorkPanel — the counters a telecaller opens the board for.
 *
 * Every tile is derived from the rows already loaded by the board endpoint
 * (`countTodayWork`), so the strip cannot disagree with the columns underneath
 * it and no second request is made.
 *
 * Tile behaviour: exactly one customer → the tile opens that customer. Several
 * → the tile expands an inline list of clickable rows, each with its own Call
 * and Schedule Follow-Up actions. Zero → the tile renders as a plain figure
 * rather than a button, so nothing on screen is inert.
 *
 * The date tests all run against `today` (the server's Asia/Kolkata day), never
 * the browser clock.
 */

export interface TodaysWorkPanelProps {
  customers: PipelineCustomer[];
  /** Server Asia/Kolkata day (YYYY-MM-DD) from the board response. */
  today: string;
  loading: boolean;
  onOpen: (c: PipelineCustomer) => void;
  onAction: (kind: QuickActionKind, c: PipelineCustomer) => void;
}

const toneTile: Record<TodayWorkTone, string> = {
  alert: 'bg-[#FDE8E7] border-[#B42318]/35 text-[#B42318]',
  due: 'bg-[#FFF4D6] border-[#C58A18]/35 text-[#C58A18]',
  positive: 'bg-[#E8F5EE] border-[#198754]/30 text-[#198754]',
  neutral: 'bg-[#FFFFFF] border-[#E1DDD3] text-[#123C35]'
};

const tileButtonClass =
  'flex w-full flex-col items-start gap-0.5 rounded-2xl border p-2.5 text-left transition-colors ' +
  'hover:border-[#C9A45C] focus:outline-none focus:border-[#C9A45C]';

const rowActionClass =
  'inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-[#E1DDD3] ' +
  'bg-[#F7F5F0] px-2 text-[9px] font-black uppercase tracking-wider text-[#123C35] transition-colors ' +
  'hover:border-[#C9A45C] hover:bg-[#EDF3F0] focus:outline-none focus:border-[#C9A45C]';

export default function TodaysWorkPanel({
  customers,
  today,
  loading,
  onOpen,
  onAction
}: TodaysWorkPanelProps) {
  const [expanded, setExpanded] = useState<TodayWorkKey | null>(null);

  const summary = useMemo(() => countTodayWork(customers, today), [customers, today]);
  const active = summary.buckets.find((bucket) => bucket.key === expanded) || null;

  const rowMeta = (customer: PipelineCustomer): string => {
    const days = effectiveDaysOverdue(customer, today);
    const when = dateText(customer.follow_up_date, { day: '2-digit', month: 'short' });
    const time = nextContactTime(customer);
    const schedule = [when ? `Follow-up ${when}` : 'No follow-up', time].filter(Boolean).join(' · ');
    if (days > 0) return `Overdue ${days}d · ${schedule}`;
    if (isDueToday(customer.follow_up_date, today)) return `Today · ${schedule}`;
    return schedule;
  };

  const stop = (event: MouseEvent) => event.stopPropagation();

  const handleTileClick = (key: TodayWorkKey, list: PipelineCustomer[]) => {
    // One match: the tile is the customer, so open it. Several: expand the list
    // inline, because narrowing the board belongs to the parent.
    if (list.length === 1) {
      setExpanded(null);
      onOpen(list[0]);
      return;
    }
    setExpanded((current) => (current === key ? null : key));
  };

  return (
    <section
      className="rounded-3xl border border-[#E1DDD3] bg-[#FFFFFF] p-3 shadow-2xs sm:p-4"
      aria-label="Today's work"
    >
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[11px] font-black uppercase tracking-wider text-[#123C35]">
            Today&apos;s Work
          </h2>
          <p className="mt-0.5 text-[10px] font-semibold text-[#65716C]">
            {loading ? (
              <span className="inline-flex items-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin text-[#C9A45C]" aria-hidden="true" />
                Loading the board…
              </span>
            ) : (
              <>
                <span className="font-black text-[#C9A45C]">
                  {dateText(today) || display(today) || DASH}
                </span>{' '}
                · server (IST) date · {summary.buckets.length} counters from{' '}
                {(customers || []).length} loaded {customers?.length === 1 ? 'customer' : 'customers'}
              </>
            )}
          </p>
        </div>
        {active && !loading && (
          <button
            type="button"
            onClick={() => setExpanded(null)}
            className="inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-[#E1DDD3] bg-[#F7F5F0] px-2 text-[9px] font-black uppercase tracking-wider text-[#123C35] transition-colors hover:border-[#C9A45C] hover:bg-[#EDF3F0]"
          >
            <X className="h-3 w-3 text-[#C9A45C]" aria-hidden="true" />
            Hide list
          </button>
        )}
      </header>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-9">
        {summary.buckets.map((bucket) => {
          const size = bucket.customers.length;
          const classes = `${toneTile[bucket.tone]} ${
            expanded === bucket.key ? 'border-[#C9A45C]' : ''
          }`;
          const count = loading ? DASH : String(size);

          if (loading || size === 0) {
            return (
              <div
                key={bucket.key}
                className={`flex w-full flex-col items-start gap-0.5 rounded-2xl border p-2.5 ${classes} ${
                  loading ? '' : 'opacity-70'
                }`}
                title={bucket.hint}
              >
                <span className="text-base font-black leading-none">{count}</span>
                <span className="text-[9px] font-black uppercase leading-tight tracking-wider text-[#65716C]">
                  {bucket.label}
                </span>
              </div>
            );
          }

          return (
            <button
              key={bucket.key}
              type="button"
              onClick={() => handleTileClick(bucket.key, bucket.customers)}
              className={`${tileButtonClass} ${classes}`}
              title={
                size === 1
                  ? `${bucket.hint} — opens ${display(bucket.customers[0].customer_name) || 'the customer'}`
                  : `${bucket.hint} — show all ${size}`
              }
              aria-expanded={expanded === bucket.key}
            >
              <span className="text-base font-black leading-none">{count}</span>
              <span className="text-[9px] font-black uppercase leading-tight tracking-wider text-[#65716C]">
                {bucket.label}
              </span>
              <span className="inline-flex items-center gap-0.5 text-[9px] font-black uppercase tracking-wider">
                {size === 1 ? (
                  'Open customer'
                ) : (
                  <>
                    <ChevronDown
                      className={`h-2.5 w-2.5 transition-colors ${
                        expanded === bucket.key ? 'text-[#C9A45C]' : ''
                      }`}
                      aria-hidden="true"
                    />
                    {expanded === bucket.key ? 'Hide' : `Show ${size}`}
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {active && !loading && (
        <div className="mt-3 rounded-2xl border border-[#E1DDD3] bg-[#F7F5F0] p-2">
          <p className="flex flex-wrap items-center justify-between gap-2 px-1 pb-1.5">
            <span className="text-[9px] font-black uppercase tracking-wider text-[#65716C]">
              {active.label} · {active.customers.length}
            </span>
            <span className="text-[9px] font-semibold text-[#65716C]">{active.hint}</span>
          </p>
          <ul className="max-h-[280px] space-y-1.5 overflow-y-auto">
            {/* Only reachable when a reload empties an open counter. */}
            {active.customers.length === 0 && (
              <li className="rounded-xl border border-[#E1DDD3] bg-[#FFFFFF] px-2 py-2 text-center text-[10px] font-bold text-[#65716C]">
                Nothing is left in this counter after the last load.
              </li>
            )}
            {active.customers.map((customer) => {
              const name = display(customer.customer_name) || `Customer #${customer.id}`;
              const code = display(customer.customer_code);
              const overdue = effectiveDaysOverdue(customer, today) > 0;
              const hasDate = Boolean(parseDate(customer.follow_up_date));
              return (
                <li
                  key={customer.id}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E1DDD3] bg-[#FFFFFF] px-2 py-1.5"
                >
                  <button
                    type="button"
                    onClick={() => onOpen(customer)}
                    className="min-w-0 flex-1 text-left focus:outline-none hover:text-[#123C35]"
                    title={`Open ${name}`}
                  >
                    <span className="block truncate text-[11px] font-black leading-tight text-[#17201D]">
                      {name}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[#65716C]">
                      {overdue && (
                        <CircleMeta />
                      )}
                      <span className="truncate">
                        {[code || DASH, display(customer.assigned_telecaller) || 'Unassigned', rowMeta(customer)]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(event) => {
                        stop(event);
                        onAction('call', customer);
                      }}
                      className={rowActionClass}
                      title="Log a call"
                    >
                      <PhoneCall className="h-3 w-3 text-[#C9A45C]" aria-hidden="true" />
                      Call
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        stop(event);
                        onAction('follow_up', customer);
                      }}
                      className={rowActionClass}
                      title={hasDate ? 'Reschedule follow-up' : 'Schedule follow-up'}
                    >
                      <CalendarClock className="h-3 w-3 text-[#C9A45C]" aria-hidden="true" />
                      {hasDate ? 'Reschedule' : 'Follow-up'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Small red marker kept as its own element so the row markup stays readable. */
const CircleMeta = () => (
  <span
    className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#B42318]"
    aria-hidden="true"
  />
);
