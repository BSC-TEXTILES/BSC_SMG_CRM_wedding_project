import { useMemo } from 'react';
import type { MouseEvent } from 'react';
import { CalendarClock, CheckCircle2, ClipboardList, PhoneCall, CircleAlert } from 'lucide-react';

import type { PipelineCustomer, QuickActionKind } from './types';
import {
  DASH,
  dateText,
  display,
  effectiveDaysOverdue,
  nextContactTime,
  overdueCustomers,
  serverDaysOverdue,
  sortByUrgency
} from './pipelineDerived';

/**
 * OverdueFollowUps — the overdue book, kept out of the pipeline columns.
 *
 * The board sorts overdue rows to the top of every column, which is exactly how
 * they get lost, so this section takes the same loaded rows and gives them their
 * own table. Rows are re-derived from `customers` (no second request): a row is
 * overdue when the server's `overdue_days` is positive or its `follow_up_date`
 * falls before `today`, the server's Asia/Kolkata day.
 *
 * The Days overdue cell prefers `overdue_days` as the query computed it, because
 * that is the value the server filtered and ordered on, and falls back to the
 * same arithmetic locally.
 */

export interface OverdueFollowUpsProps {
  customers: PipelineCustomer[];
  /** Server Asia/Kolkata day (YYYY-MM-DD) from the board response. */
  today: string;
  onOpen: (c: PipelineCustomer) => void;
  onAction: (kind: QuickActionKind, c: PipelineCustomer) => void;
}

const headClass =
  'px-3 py-2 text-[9px] font-black uppercase tracking-wider text-[#65716C] whitespace-nowrap';

const cellClass = 'px-3 py-2.5 align-top text-[10px] font-bold leading-snug text-[#17201D]';

const actionClass =
  'inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-[#E1DDD3] ' +
  'bg-[#FFFFFF] px-2 text-[9px] font-black uppercase tracking-wider text-[#123C35] transition-colors ' +
  'hover:border-[#C9A45C] hover:bg-[#EDF3F0] focus:outline-none focus:border-[#C9A45C]';

export default function OverdueFollowUps({
  customers,
  today,
  onOpen,
  onAction
}: OverdueFollowUpsProps) {
  const rows = useMemo(
    () => sortByUrgency(overdueCustomers(customers, today), today),
    [customers, today]
  );

  const act = (kind: QuickActionKind, customer: PipelineCustomer) => (event: MouseEvent) => {
    event.stopPropagation();
    onAction(kind, customer);
  };

  return (
    <section
      className="overflow-hidden rounded-3xl border border-[#B42318]/25 bg-[#FFFFFF] shadow-2xs"
      aria-label="Overdue follow-ups"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E1DDD3] bg-[#FDE8E7] px-3 py-2.5 sm:px-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#123C35]">
            <CircleAlert className="h-3.5 w-3.5 shrink-0 text-[#B42318]" aria-hidden="true" />
            Overdue Follow-Ups
          </h2>
          <p className="mt-0.5 text-[10px] font-semibold text-[#65716C]">
            {rows.length} {rows.length === 1 ? 'customer' : 'customers'} past the follow-up date on{' '}
            <span className="font-black text-[#B42318]">
              {dateText(today) || display(today) || DASH}
            </span>{' '}
            (server, IST) · most overdue first
          </p>
        </div>
        <span className="rounded-full bg-[#B42318] px-2.5 py-0.5 text-[10px] font-black text-white">
          {rows.length}
        </span>
      </header>

      {rows.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-[11px] font-black uppercase tracking-wider text-[#123C35]">
            No overdue follow-ups
          </p>
          <p className="mt-1 text-[10px] font-semibold text-[#65716C]">
            Every follow-up date in the loaded board is today or later.
          </p>
        </div>
      ) : (
        <div className="table-frame custom-scrollbar">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead className="bg-[#F7F5F0]">
              <tr className="border-b border-[#E1DDD3]">
                <th scope="col" className={headClass}>
                  Customer
                </th>
                <th scope="col" className={headClass}>
                  Due date
                </th>
                <th scope="col" className={headClass}>
                  Days overdue
                </th>
                <th scope="col" className={headClass}>
                  Assigned telecaller
                </th>
                <th scope="col" className={headClass}>
                  Last call
                </th>
                <th scope="col" className={headClass}>
                  Latest feedback
                </th>
                <th scope="col" className={`${headClass} text-right`}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1DDD3]">
              {rows.map((customer) => {
                const name = display(customer.customer_name) || `Customer #${customer.id}`;
                const code = display(customer.customer_code);
                const mobile = display(customer.mobile_number);
                const days = effectiveDaysOverdue(customer, today);
                const fromServer = serverDaysOverdue(customer) !== null;
                const telecaller =
                  display(customer.assigned_telecaller) || display(customer.last_contacted_by);
                const lastCall = dateText(customer.last_call_date, {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                });
                const outcome = display(customer.last_call_outcome) || display(customer.call_status);
                const feedback = display(customer.latest_feedback);
                const time = nextContactTime(customer);

                return (
                  <tr
                    key={customer.id}
                    className="transition-colors hover:bg-[#EDF3F0]"
                  >
                    <td className={cellClass}>
                      <button
                        type="button"
                        onClick={() => onOpen(customer)}
                        className="block max-w-[220px] text-left focus:outline-none"
                        title={`Open ${name}`}
                      >
                        <span className="block truncate text-[11px] font-black leading-tight text-[#17201D]">
                          {name}
                        </span>
                        <span className="mt-0.5 block truncate text-[9px] font-bold uppercase tracking-wider text-[#65716C]">
                          {[code, mobile].filter(Boolean).join(' · ') || DASH}
                        </span>
                      </button>
                    </td>
                    <td className={cellClass}>
                      <span className="block whitespace-nowrap text-[#B42318]">
                        {dateText(customer.follow_up_date, { day: '2-digit', month: 'short', year: 'numeric' }) ||
                          DASH}
                      </span>
                      <span className="mt-0.5 block truncate text-[9px] font-bold uppercase tracking-wider text-[#65716C]">
                        {time || display(customer.customer_status) || DASH}
                      </span>
                    </td>
                    <td className={cellClass}>
                      <span
                        className="inline-flex items-center whitespace-nowrap rounded-full bg-[#B42318] px-2 py-0.5 text-[10px] font-black text-white"
                        title={
                          fromServer
                            ? 'overdue_days from the board query'
                            : 'computed against the server date'
                        }
                      >
                        {days} {days === 1 ? 'day' : 'days'}
                      </span>
                    </td>
                    <td className={`${cellClass} max-w-[160px]`}>
                      <span className={`block truncate ${telecaller ? '' : 'text-[#65716C]/70'}`}>
                        {telecaller || DASH}
                      </span>
                    </td>
                    <td className={`${cellClass} max-w-[180px]`}>
                      <span className="block whitespace-nowrap">
                        {lastCall || <span className="text-[#65716C]/70">{DASH}</span>}
                      </span>
                      <span
                        className={`mt-0.5 block truncate text-[9px] font-bold uppercase tracking-wider ${
                          outcome ? 'text-[#65716C]' : 'text-[#65716C]/70'
                        }`}
                        title={outcome || undefined}
                      >
                        {outcome || DASH}
                      </span>
                    </td>
                    <td className={`${cellClass} max-w-[260px] min-w-[200px]`}>
                      <p
                        className={`line-clamp-2 break-words ${
                          feedback ? 'font-semibold text-[#17201D]' : 'font-bold text-[#65716C]/70'
                        }`}
                        title={feedback || undefined}
                      >
                        {feedback || DASH}
                      </p>
                    </td>
                    <td className={`${cellClass} w-[260px]`}>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={act('call', customer)}
                          className={actionClass}
                          title="Log a call"
                        >
                          <PhoneCall className="h-3 w-3 text-[#C9A45C]" aria-hidden="true" />
                          Call Now
                        </button>
                        <button
                          type="button"
                          onClick={act('note', customer)}
                          className={actionClass}
                          title="Post an update"
                        >
                          <ClipboardList className="h-3 w-3 text-[#C9A45C]" aria-hidden="true" />
                          Update
                        </button>
                        <button
                          type="button"
                          onClick={act('follow_up', customer)}
                          className={actionClass}
                          title="Reschedule the follow-up"
                        >
                          <CalendarClock className="h-3 w-3 text-[#C9A45C]" aria-hidden="true" />
                          Reschedule
                        </button>
                        <button
                          type="button"
                          onClick={act('stage', customer)}
                          className={actionClass}
                          title="Mark this follow-up done by moving the status"
                        >
                          <CheckCircle2 className="h-3 w-3 text-[#C9A45C]" aria-hidden="true" />
                          Complete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
