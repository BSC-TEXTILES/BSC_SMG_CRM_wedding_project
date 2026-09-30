import { useEffect, useRef, useState } from 'react';
import { CalendarDays, RotateCcw, Search, X } from 'lucide-react';

import type { PipelineStage } from './types';
import { display } from './pipelineDerived';

/**
 * PipelineFilters — the single toolbar that drives GET /wedding-crm/pipeline/board.
 *
 * It owns no data: it renders the `stages` and `telecallers` it is handed and
 * emits a complete PipelineFilterState through onChange on every interaction.
 * Nothing is ever mutated — each control spreads `value` into a new object, so
 * the parent can hold one state blob and hand it straight to the API client
 * (search, stage, telecaller_id, priority, call_status, overdue, due_today,
 * follow_up_from, follow_up_to are exactly the keys the endpoint reads).
 *
 * The search box is the one piece of local state it keeps: keystrokes are held
 * for 300ms before being emitted so typing does not fire a request per letter.
 */

export interface PipelineFilterState {
  search: string;
  stage: string;
  telecaller_id: string;
  priority: string;
  call_status: string;
  date_preset: 'all' | 'overdue' | 'today';
  follow_up_from: string;
  follow_up_to: string;
}

/** The untouched toolbar — also what Clear Filters emits. */
export const EMPTY_PIPELINE_FILTERS: PipelineFilterState = {
  search: '',
  stage: 'all',
  telecaller_id: 'all',
  priority: 'all',
  call_status: 'all',
  date_preset: 'all',
  follow_up_from: '',
  follow_up_to: ''
};

export interface PipelineFiltersProps {
  value: PipelineFilterState;
  onChange: (next: PipelineFilterState) => void;
  stages: PipelineStage[];
  telecallers: { id: number; name: string }[];
  busy: boolean;
}

const SEARCH_DEBOUNCE_MS = 300;

/** Values wedding_customers.call_status actually carries (weddingController:
 * the pending-call and callback aggregates filter on this same vocabulary). */
const CALL_STATUS_OPTIONS = [
  'Pending',
  'Scheduled',
  'In Progress',
  'Connected',
  'Call Back Requested',
  'No Answer',
  'Busy',
  'Switched Off',
  'Completed',
  'Cancelled'
];

const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Urgent'];

const DATE_PRESETS: { key: PipelineFilterState['date_preset']; label: string; hint: string }[] = [
  { key: 'all', label: 'All', hint: 'No follow-up date filter' },
  { key: 'overdue', label: 'Overdue', hint: 'Follow-up date before the server date' },
  { key: 'today', label: 'Today', hint: 'Follow-up date on the server date' }
];

const fieldLabelClass = 'mb-1 block text-[9px] font-black uppercase tracking-wider text-[#6F5963]';

const controlClass =
  'w-full rounded-xl border border-[#E8D9D4] bg-[#FFFAF7] px-3 py-2 text-xs font-semibold ' +
  'text-[#2B1722] shadow-2xs transition-colors focus:border-[#B76E79] focus:outline-none ' +
  'disabled:opacity-60';

/** True when the toolbar is back at its starting values. */
export const isPipelineFilterEmpty = (filters: PipelineFilterState): boolean =>
  !filters ||
  Object.keys(EMPTY_PIPELINE_FILTERS).every(
    (key) =>
      (filters as any)[key] === (EMPTY_PIPELINE_FILTERS as any)[key]
  );

const countActiveFilters = (filters: PipelineFilterState): number =>
  Object.keys(EMPTY_PIPELINE_FILTERS).filter(
    (key) => (filters as any)[key] !== (EMPTY_PIPELINE_FILTERS as any)[key]
  ).length;

export default function PipelineFilters({
  value,
  onChange,
  stages,
  telecallers,
  busy
}: PipelineFiltersProps) {
  const [searchText, setSearchText] = useState(() => display(value?.search));

  // Latest props without making them effect dependencies: the debounce must only
  // restart when the typed text changes, never when the parent re-renders.
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };

  // Adopt an external reset (Clear Filters higher up, a location change) so the
  // box can never show a term the board is no longer filtering by.
  useEffect(() => {
    setSearchText((current) =>
      current === (value?.search || '') ? current : display(value?.search)
    );
  }, [value?.search]);

  useEffect(() => {
    if (searchText === (latest.current.value.search || '')) return;
    const timer = window.setTimeout(() => {
      const { value: current, onChange: emit } = latest.current;
      emit({ ...current, search: searchText });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  const set = (patch: Partial<PipelineFilterState>) => {
    onChange({ ...value, ...patch });
  };

  const clearAll = () => {
    setSearchText('');
    onChange({ ...EMPTY_PIPELINE_FILTERS });
  };

  const activeCount = countActiveFilters(value);
  const pendingSearch = searchText !== (value.search || '');
  const rangeInverted = Boolean(
    value.follow_up_from && value.follow_up_to && value.follow_up_from > value.follow_up_to
  );

  return (
    <section
      aria-label="Pipeline filters"
      aria-busy={busy}
      className="rounded-3xl border border-[#E8D9D4] bg-[#FFFDFC] p-3 shadow-2xs sm:p-4"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <label className={fieldLabelClass} htmlFor="pipeline-search">
            Search
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#B76E79]"
              aria-hidden="true"
            />
            <input
              id="pipeline-search"
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Name, customer ID, mobile, email, telecaller or store"
              autoComplete="off"
              className={`${controlClass} pl-8 pr-8`}
            />
            {searchText && (
              <button
                type="button"
                onClick={() => setSearchText('')}
                aria-label="Clear search text"
                className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-lg border border-[#E8D9D4] bg-[#FFFDFC] text-[#4A173A] transition-colors hover:bg-[#FFF7F2]"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
          </div>
          <p className="mt-1 text-[9px] font-semibold text-[#6F5963]">
            {pendingSearch ? 'Waiting for the search to settle…' : 'Matches on this board only'}
          </p>
        </div>

        <div className="w-[150px] min-w-[130px]">
          <label className={fieldLabelClass} htmlFor="pipeline-stage">
            Stage
          </label>
          <select
            id="pipeline-stage"
            value={value.stage}
            disabled={busy}
            onChange={(event) => set({ stage: event.target.value })}
            className={controlClass}
          >
            <option value="all">All stages</option>
            {(stages || []).map((stage) => (
              <option key={stage.key} value={stage.key}>
                {stage.label} ({stage.count})
              </option>
            ))}
          </select>
        </div>

        <div className="w-[160px] min-w-[140px]">
          <label className={fieldLabelClass} htmlFor="pipeline-telecaller">
            Telecaller
          </label>
          <select
            id="pipeline-telecaller"
            value={value.telecaller_id}
            disabled={busy}
            onChange={(event) => set({ telecaller_id: event.target.value })}
            className={controlClass}
          >
            <option value="all">All telecallers</option>
            {(telecallers || []).map((telecaller) => (
              <option key={telecaller.id} value={String(telecaller.id)}>
                {telecaller.name}
              </option>
            ))}
          </select>
        </div>

        <div className="w-[120px] min-w-[110px]">
          <label className={fieldLabelClass} htmlFor="pipeline-priority">
            Priority
          </label>
          <select
            id="pipeline-priority"
            value={value.priority}
            disabled={busy}
            onChange={(event) => set({ priority: event.target.value })}
            className={controlClass}
          >
            <option value="all">Any</option>
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="w-[160px] min-w-[140px]">
          <label className={fieldLabelClass} htmlFor="pipeline-call-status">
            Call status
          </label>
          <select
            id="pipeline-call-status"
            value={value.call_status}
            disabled={busy}
            onChange={(event) => set({ call_status: event.target.value })}
            className={controlClass}
          >
            <option value="all">Any</option>
            {CALL_STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-[#E8D9D4] pt-3">
        <div>
          <span className={fieldLabelClass}>Follow-up window</span>
          <div
            role="group"
            aria-label="Follow-up date preset"
            className="inline-flex flex-wrap gap-1 rounded-xl border border-[#E8D9D4] bg-[#FFFAF7] p-1"
          >
            {DATE_PRESETS.map((preset) => {
              const isActive = value.date_preset === preset.key;
              return (
                <button
                  key={preset.key}
                  type="button"
                  disabled={busy}
                  title={preset.hint}
                  aria-pressed={isActive}
                  onClick={() => set({ date_preset: preset.key })}
                  className={`h-7 whitespace-nowrap rounded-lg px-3 text-[10px] font-black uppercase tracking-wider transition-colors focus:outline-none disabled:opacity-60 ${
                    isActive
                      ? 'bg-[#4A173A] text-white'
                      : 'bg-transparent text-[#6F5963] hover:bg-[#FFF7F2] hover:text-[#4A173A]'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="w-[140px] min-w-[130px]">
            <label className={fieldLabelClass} htmlFor="pipeline-followup-from">
              Follow-up from
            </label>
            <input
              id="pipeline-followup-from"
              type="date"
              value={value.follow_up_from}
              disabled={busy}
              onChange={(event) => set({ follow_up_from: event.target.value })}
              className={controlClass}
            />
          </div>
          <div className="w-[140px] min-w-[130px]">
            <label className={fieldLabelClass} htmlFor="pipeline-followup-to">
              Follow-up to
            </label>
            <input
              id="pipeline-followup-to"
              type="date"
              value={value.follow_up_to}
              disabled={busy}
              onChange={(event) => set({ follow_up_to: event.target.value })}
              className={controlClass}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 whitespace-nowrap text-[9px] font-black uppercase tracking-wider text-[#6F5963]">
            <CalendarDays className="h-3 w-3 text-[#B76E79]" aria-hidden="true" />
            {activeCount} {activeCount === 1 ? 'filter' : 'filters'} active
          </span>
          <button
            type="button"
            onClick={clearAll}
            disabled={activeCount === 0 && !pendingSearch}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#E8D9D4] bg-[#FFFDFC] px-3 text-[10px] font-black uppercase tracking-wider text-[#4A173A] shadow-2xs transition-colors hover:border-[#B76E79] hover:bg-[#FFF7F2] focus:outline-none disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5 text-[#B76E79]" aria-hidden="true" />
            Clear Filters
          </button>
        </div>
      </div>

      {rangeInverted && (
        <p className="mt-2 rounded-xl border border-[#B42318]/30 bg-[#FDE8E7] px-3 py-2 text-[10px] font-bold text-[#B42318]">
          The follow-up range is reversed — “from” is after “to”, so the board will come back empty.
        </p>
      )}
    </section>
  );
}
