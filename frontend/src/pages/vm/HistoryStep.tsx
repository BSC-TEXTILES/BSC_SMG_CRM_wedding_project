import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Filter,
  History,
  ImageOff,
  Layers,
  PencilRuler,
  RefreshCw,
  RotateCcw,
  Search,
  Store,
  User,
  X
} from 'lucide-react';
import { API } from '../../services/api';
import PhotoLightbox from './PhotoLightbox';
import {
  VmEmptyState,
  VmErrorState,
  VmPill,
  VmProgressBar,
  VmSectionHeader,
  VmSkeletonCard,
  scoreTone,
  vmBtnGhost,
  vmBtnPrimary,
  vmBtnSecondary,
  vmCard,
  vmClickableCard,
  vmLabel,
  vmMeta,
  vmTitle,
  type VmTone
} from './VmPrimitives';
import type { VmFloorSummary, VmPhoto } from './vmTypes';
import { VM_SHIFTS } from './vmTypes';
import {
  VM_FILTER_DEBOUNCE_MS,
  dashIfEmpty,
  formatBytes,
  formatVmDate,
  formatVmTime,
  mapAuditList,
  photoSrc,
  scoreDisplay,
  toLightboxItems,
  uniqueStrings,
  vmErrorMessage,
  type VmAttentionMapped,
  type VmMappedAuditDetail,
  type VmMappedAuditListItem
} from './vmFlowUtils';

/** Shared filter-control styling, aligned with the primitives' surface language. */
const FILTER_CLASS =
  'w-full min-h-[40px] text-[13px] font-semibold text-[#2B1722] bg-white border border-[#E8D9D4] rounded-xl ' +
  'px-3 transition-colors focus:outline-none focus:border-[#B76E79] focus:ring-2 focus:ring-[#B76E79]/35';

/** Status colour comes from the shared tone scale, matching the draft chip in the audit step. */
const statusTone = (status?: string | null): VmTone => {
  const s = String(status || '').toLowerCase();
  if (s === 'completed') return 'positive';
  if (s === 'review') return 'warning';
  if (s === 'draft') return 'brand';
  return 'muted';
};

const answerTone = (score?: string | null): VmTone => {
  const s = String(score || '').toLowerCase();
  if (s === 'pass') return 'positive';
  if (s === 'fail') return 'danger';
  if (s === 'na') return 'neutral';
  return 'muted';
};

interface HistoryStepProps {
  /** Floor/section filter options come from the same floor summary as step 1. */
  floors: VmFloorSummary[];
  attention: VmAttentionMapped | null;
  attentionLoading: boolean;
  attentionError: string | null;
  onRetryAttention: () => void;

  canWrite: boolean;
  onResumeDraft: (floor: string, section: string, shift: string) => void;

  loadAuditDetail: (id: string) => Promise<VmMappedAuditDetail | null>;
  detailLoading: boolean;
  detailError: string | null;

  /** Open one audit straight away — used when Analytics links into a record. */
  focusAuditId?: string | null;
  onFocusHandled?: () => void;
}

const EMPTY_FILTERS = {
  locationId: '',
  floor: 'All',
  section: 'All',
  shift: 'All',
  dateFrom: '',
  dateTo: '',
  auditor: 'All',
  status: 'All',
  minScore: '',
  search: ''
};

type VmHistoryFilters = typeof EMPTY_FILTERS;

const PAGE_SIZE = 25;

/**
 * History — every filed audit, plus the drafts still open.
 *
 * Rows come from GET /vm/audits (server-side filters) and a row click re-reads the
 * complete saved record through GET /vm/audits/:id, so what is shown is what was
 * filed. The VM tables are genuinely empty in a fresh store, so an honest empty
 * state is rendered instead of invented rows.
 */
export default function HistoryStep({
  floors,
  attention,
  attentionLoading,
  attentionError,
  onRetryAttention,
  canWrite,
  onResumeDraft,
  loadAuditDetail,
  detailLoading,
  detailError,
  focusAuditId,
  onFocusHandled
}: HistoryStepProps) {
  const [filters, setFilters] = useState<VmHistoryFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const [audits, setAudits] = useState<VmMappedAuditListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestSeqRef = useRef(0);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const pageRef = useRef(page);
  pageRef.current = page;

  const [detail, setDetail] = useState<VmMappedAuditDetail | null>(null);

  // The saved record, the gallery and the audit uploader all open the same lightbox.
  const [viewer, setViewer] = useState<{ items: ReturnType<typeof toLightboxItems>; index: number } | null>(null);
  const openViewer = useCallback((photos: VmPhoto[], index: number) => {
    const items = toLightboxItems(photos || []);
    if (items.length === 0) return;
    setViewer({ items, index: Math.min(Math.max(index, 0), items.length - 1) });
  }, []);

  const loadHistory = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      const seq = ++requestSeqRef.current;
      if (silent) setRefreshing(true);
      else setLoading(true);

      const f = filtersRef.current;
      const params: {
        locationId?: string;
        floor?: string;
        section?: string;
        dateFrom?: string;
        dateTo?: string;
        auditor?: string;
        status?: string;
        minScore?: number;
        search?: string;
        limit?: number;
        page?: number;
      } = { limit: PAGE_SIZE, page: pageRef.current };
      if (f.locationId) params.locationId = f.locationId;
      if (f.floor && f.floor !== 'All') params.floor = f.floor;
      if (f.section && f.section !== 'All') params.section = f.section;
      if (f.dateFrom) params.dateFrom = f.dateFrom;
      if (f.dateTo) params.dateTo = f.dateTo;
      if (f.auditor && f.auditor !== 'All') params.auditor = f.auditor;
      if (f.status && f.status !== 'All') params.status = f.status;
      if (f.minScore) params.minScore = Number(f.minScore);
      if (f.search.trim()) params.search = f.search.trim();

      try {
        const res = await API.getVmAudits(params);
        if (seq !== requestSeqRef.current) return;
        if (!res || res.success === false) {
          throw new Error((res as { message?: string })?.message || 'The audit history was rejected by the server.');
        }
        const mapped = mapAuditList(res);
        setAudits(mapped.audits);
        setTotal(mapped.total);
        setTotalPages(Math.max(1, mapped.totalPages));
        setError(null);
      } catch (err) {
        if (seq !== requestSeqRef.current) return;
        setError(vmErrorMessage(err, 'Unable to load the audit history. Please try again.'));
        if (!silent) {
          setAudits([]);
          setTotal(0);
          setTotalPages(1);
        }
      } finally {
        if (seq === requestSeqRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    []
  );

  // Debounced server-side filtering, so typing does not fire a request per keystroke.
  const [debouncedFilters, setDebouncedFilters] = useState<VmHistoryFilters>(filters);
  const filterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
    filterTimerRef.current = setTimeout(() => setDebouncedFilters(filters), VM_FILTER_DEBOUNCE_MS);
    return () => {
      if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
    };
  }, [filters]);

  const filterKey = JSON.stringify(debouncedFilters);

  // A filter change returns to page 1. `filterKey` and `page` are both part of the
  // fetch key below, so one committed change never produces two requests.
  const prevFilterKeyRef = useRef(filterKey);
  useEffect(() => {
    if (prevFilterKeyRef.current === filterKey) return;
    prevFilterKeyRef.current = filterKey;
    setPage(1);
  }, [filterKey]);

  useEffect(() => {
    void loadHistory();
  }, [filterKey, page, loadHistory]);

  // Filter options are derived from the rows already loaded, never invented.
  const inspectorOptions = useMemo(() => uniqueStrings(audits.map((a) => a.submittedBy)), [audits]);
  const sectionOptions = useMemo(() => {
    const scoped = floors.filter((f) => filters.floor === 'All' || f.name === filters.floor);
    return uniqueStrings(scoped.flatMap((f) => f.sections));
  }, [floors, filters.floor]);

  // `shift` has no server parameter, so it refines the page in place. Every other
  // filter is applied by GET /vm/audits.
  const rows = useMemo(
    () => (filters.shift === 'All' ? audits : audits.filter((a) => a.shift === filters.shift)),
    [audits, filters.shift]
  );

  const activeFilterCount = useMemo(() => {
    let n = 0;
    const f = filters;
    if (f.locationId) n++;
    if (f.floor !== 'All') n++;
    if (f.section !== 'All') n++;
    if (f.shift !== 'All') n++;
    if (f.dateFrom) n++;
    if (f.dateTo) n++;
    if (f.auditor !== 'All') n++;
    if (f.status !== 'All') n++;
    if (f.minScore) n++;
    if (f.search.trim()) n++;
    return n;
  }, [filters]);

  const openDetail = useCallback(
    async (id: string) => {
      const loaded = await loadAuditDetail(id);
      if (loaded) setDetail(loaded);
    },
    [loadAuditDetail]
  );

  // Analytics can hand a specific audit id over; open it and let the parent clear it.
  useEffect(() => {
    if (!focusAuditId) return;
    void openDetail(focusAuditId).then(() => onFocusHandled?.());
  }, [focusAuditId, openDetail, onFocusHandled]);

  const setField = <K extends keyof VmHistoryFilters,>(key: K) => (value: VmHistoryFilters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-4">
      <AttentionPanel
        attention={attention}
        loading={attentionLoading}
        error={attentionError}
        onRetry={onRetryAttention}
      />

      <section className={vmCard('overflow-hidden')}>
        <div className="flex flex-col gap-4 border-b border-[#E8D9D4] p-4 sm:p-5 lg:flex-row lg:items-end lg:justify-between">
          <VmSectionHeader
            icon={<History className="w-5 h-5" />}
            title="Submitted audits & open drafts"
            subtitle={
              loading
                ? 'Loading history…'
                : `${total} record${total === 1 ? '' : 's'} matching the filters${
                    filters.shift !== 'All' ? ' · shift refined on this page' : ''
                  }`
            }
            className="min-w-0"
          />
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => loadHistory({ silent: true })}
              disabled={loading || refreshing}
              className={vmBtnSecondary}
            >
              <RefreshCw className={`w-4 h-4 text-[#B76E79] ${loading || refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="space-y-3 border-b border-[#E8D9D4] bg-[#FFF7F2] p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`${vmLabel} inline-flex items-center gap-1.5`}>
              <Filter className="w-3.5 h-3.5 text-[#B76E79]" />
              <span>Filters</span>
            </span>
            {activeFilterCount > 0 && <VmPill tone="brand">{activeFilterCount} active</VmPill>}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <FilterField label="Store" icon={<Store className="w-3 h-3" />}>
              <select
                value={filters.locationId}
                onChange={(e) => setField('locationId')(e.target.value)}
                className={FILTER_CLASS}
              >
                <option value="">All stores I can see</option>
                <option value="1">Belagavi</option>
                <option value="2">Davanagere</option>
                <option value="3">Shivamogga</option>
              </select>
            </FilterField>

            <FilterField label="Floor">
              <select value={filters.floor} onChange={(e) => setFilters((p) => ({ ...p, floor: e.target.value, section: 'All' }))} className={FILTER_CLASS}>
                <option value="All">All floors</option>
                {floors.map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="Section">
              <select value={filters.section} onChange={(e) => setField('section')(e.target.value)} className={FILTER_CLASS}>
                <option value="All">All sections</option>
                {sectionOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="Shift">
              <select value={filters.shift} onChange={(e) => setField('shift')(e.target.value)} className={FILTER_CLASS}>
                <option value="All">All shifts</option>
                {VM_SHIFTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="From date">
              <input type="date" value={filters.dateFrom} onChange={(e) => setField('dateFrom')(e.target.value)} className={FILTER_CLASS} />
            </FilterField>
            <FilterField label="To date">
              <input type="date" value={filters.dateTo} onChange={(e) => setField('dateTo')(e.target.value)} className={FILTER_CLASS} />
            </FilterField>

            <FilterField label="Inspector" icon={<User className="w-3 h-3" />}>
              <select value={filters.auditor} onChange={(e) => setField('auditor')(e.target.value)} className={FILTER_CLASS}>
                <option value="All">All inspectors</option>
                {inspectorOptions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="Status">
              <select value={filters.status} onChange={(e) => setField('status')(e.target.value)} className={FILTER_CLASS}>
                <option value="All">All statuses</option>
                <option value="Completed">Completed</option>
                <option value="Review">Review</option>
                <option value="Draft">Draft (not submitted)</option>
              </select>
            </FilterField>

            <FilterField label="Minimum score">
              <select value={filters.minScore} onChange={(e) => setField('minScore')(e.target.value)} className={FILTER_CLASS}>
                <option value="">Any score</option>
                <option value="80">80 and above</option>
                <option value="50">50 and above</option>
                <option value="1">Below 50 only</option>
              </select>
            </FilterField>

            <FilterField label="Search" icon={<Search className="w-3 h-3" />}>
              <div className="relative">
                <input
                  value={filters.search}
                  onChange={(e) => setField('search')(e.target.value)}
                  placeholder="Floor, section, inspector…"
                  className={`${FILTER_CLASS} pr-8`}
                />
                {filters.search && (
                  <button
                    type="button"
                    onClick={() => setField('search')('')}
                    aria-label="Clear search"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-[#6F5963] hover:bg-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </FilterField>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className={`${vmMeta} max-w-2xl leading-snug`}>
              Date filters use the server&rsquo;s Asia/Kolkata entry date, so an early-morning audit stays on its own day.
            </p>
            <button
              type="button"
              onClick={() => {
                setFilters(EMPTY_FILTERS);
                setPage(1);
              }}
              disabled={activeFilterCount === 0}
              className={vmBtnGhost}
            >
              <RotateCcw className="w-4 h-4 text-[#B76E79]" />
              <span>Clear Filters</span>
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {loading ? (
            <div className="space-y-2.5" aria-busy="true">
              <p className={`${vmMeta} flex items-center gap-2`}>
                <RefreshCw className="w-4 h-4 animate-spin text-[#B76E79]" />
                <span>Loading history…</span>
              </p>
              {[0, 1, 2, 3].map((row) => (
                <VmSkeletonCard key={row} lines={2} />
              ))}
            </div>
          ) : error ? (
            <VmErrorState
              title="Unable to load the audit history"
              message={error}
              onRetry={() => loadHistory()}
            />
          ) : rows.length === 0 ? (
            <VmEmptyState
              icon={<History className="w-5 h-5" />}
              title={total > 0 ? 'No audit on this page matches the shift filter' : 'No VM audits recorded yet'}
              hint={
                total > 0
                  ? 'Other records exist for these filters — widen the shift choice.'
                  : activeFilterCount > 0
                    ? 'Nothing matches these filters. Clear them to see every record on file.'
                    : 'Completed inspections will appear here as soon as the first audit is submitted.'
              }
            />
          ) : (
            <div className="space-y-3">
              {/* Desktop / tablet landscape: one aligned table with a sticky header and
                  internal scroll, so a long history never adds a second page scrollbar. */}
              <div className="hidden max-h-[560px] overflow-auto table-sticky-head rounded-xl border border-[#E8D9D4] bg-[#FFFDFC] lg:block">
                <table className="w-full min-w-[1140px] border-collapse text-left">
                  <thead>
                    <tr>
                      <Th>Date</Th>
                      <Th>Time</Th>
                      <Th>Floor</Th>
                      <Th>Section</Th>
                      <Th>Shift</Th>
                      <Th align="right">Score</Th>
                      <Th align="right">Passed</Th>
                      <Th align="right">Failed</Th>
                      <Th align="right">N/A</Th>
                      <Th>Inspector</Th>
                      <Th align="right">Photos</Th>
                      <Th>Status</Th>
                      <Th align="right">Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((audit) => (
                      <HistoryTableRow
                        key={audit.id}
                        audit={audit}
                        canWrite={canWrite}
                        onOpen={() => openDetail(audit.id)}
                        onResume={() => onResumeDraft(audit.floor, audit.section, audit.shift)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Below tablet landscape the same rows stack as cards. */}
              <ul className="space-y-2.5 lg:hidden">
                {rows.map((audit) => (
                  <li key={audit.id}>
                    <HistoryRow
                      audit={audit}
                      canWrite={canWrite}
                      onOpen={() => openDetail(audit.id)}
                      onResume={() => onResumeDraft(audit.floor, audit.section, audit.shift)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!loading && !error && totalPages > 1 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#E8D9D4] pt-4">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className={vmBtnSecondary}
              >
                <ChevronLeft className="w-4 h-4 text-[#B76E79]" />
                <span>Previous</span>
              </button>
              <p className={`${vmMeta} whitespace-nowrap`}>
                Page {page} of {totalPages} · {total} records
              </p>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className={vmBtnSecondary}
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4 text-[#B76E79]" />
              </button>
            </div>
          )}
        </div>
      </section>

      {viewer && viewer.items.length > 0 && (
        <PhotoLightbox items={viewer.items} startIndex={viewer.index} onClose={() => setViewer(null)} />
      )}

      {detail && (
        <AuditDetailModal
          detail={detail}
          loading={detailLoading}
          error={detailError}
          canWrite={canWrite}
          onClose={() => setDetail(null)}
          onResume={() => onResumeDraft(detail.floor, detail.section, detail.shift)}
          onOpenPhoto={(index) => openViewer(detail.photos, index)}
        />
      )}
    </div>
  );
}

// ── One history row (desktop table) ─────────────────────────────────────────

const TD_BASE = 'border-b border-[#EDE4E7] px-3 py-3 align-middle text-[13px] font-semibold text-[#2B1722]';

/**
 * Headings stick to the top of the list's own scroll box, so a long history stays
 * readable without a second page scrollbar. The divider is an inset shadow rather
 * than a border because `border-collapse` detaches a sticky row's border.
 */
function Th({ children, align = 'left' }: { children: ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      scope="col"
      className={`${vmLabel} sticky top-0 z-10 whitespace-nowrap bg-[#FFF7F2] px-3 py-2.5 shadow-[inset_0_-1px_0_0_#E8D9D4] ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = 'left',
  className = ''
}: {
  children: ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  const alignClass = align === 'right' ? 'text-right tabular-nums' : align === 'center' ? 'text-center' : 'text-left';
  return <td className={`${TD_BASE} ${alignClass} ${className}`}>{children}</td>;
}

function HistoryTableRow({
  audit,
  canWrite,
  onOpen,
  onResume
}: {
  audit: VmMappedAuditListItem;
  canWrite: boolean;
  onOpen: () => void;
  onResume: () => void;
}) {
  const isDraft = audit.status === 'Draft';
  return (
    <tr className="cursor-pointer bg-[#FFFDFC] transition-colors hover:bg-[#FFF7F2]" onClick={onOpen}>
      <Td className="whitespace-nowrap font-bold text-[#2B1722]">
        {formatVmDate(audit.entryDate) || audit.entryDate || '—'}
      </Td>
      <Td className="whitespace-nowrap text-[#6F5963]">
        {formatVmTime(audit.submittedAt || audit.createdAt) || '—'}
      </Td>
      <Td>
        <span className="inline-block max-w-[170px] truncate align-middle font-bold text-[#4A173A]" title={audit.floor}>
          {audit.floor || '—'}
        </span>
      </Td>
      <Td>
        <span className="inline-block max-w-[190px] truncate align-middle font-bold text-[#4A173A]" title={audit.section}>
          {audit.section || '—'}
        </span>
      </Td>
      <Td className="whitespace-nowrap text-[#6F5963]">{audit.shift || '—'}</Td>
      <Td align="right">
        <VmPill tone={scoreTone(audit.scorePercent)}>{scoreDisplay(audit.scorePercent)}</VmPill>
      </Td>
      <Td align="right">
        <span className="text-[13px] font-black text-[#146B41]">{audit.passedCount}</span>
      </Td>
      <Td align="right">
        <span className="text-[13px] font-black text-[#9B1C15]">{audit.failedCount}</span>
      </Td>
      <Td align="right">
        <span className="text-[13px] font-black text-[#6F5963]">{audit.naCount}</span>
      </Td>
      <Td>
        <span
          className="block max-w-[190px] truncate font-semibold"
          title={audit.submittedBy || 'No inspector recorded'}
        >
          {dashIfEmpty(audit.submittedBy, 'No inspector recorded')}
        </span>
        {audit.locationName && (
          <span className="mt-0.5 block max-w-[190px] truncate text-[12px] font-semibold text-[#6F5963]">
            {audit.locationName}
          </span>
        )}
      </Td>
      <Td align="right">
        <span className="inline-flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5 text-[#B76E79]" />
          <span className="text-[13px] font-black">{audit.photoCount}</span>
        </span>
      </Td>
      <Td className="whitespace-nowrap">
        <VmPill tone={statusTone(audit.status)}>{isDraft ? 'Draft — not submitted' : audit.status}</VmPill>
      </Td>
      <Td align="right" className="w-[1%] whitespace-nowrap">
        <span className="flex items-center justify-end gap-2">
          {isDraft && canWrite && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onResume();
              }}
              className={vmBtnPrimary}
            >
              <PencilRuler className="w-4 h-4" />
              <span>Resume</span>
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            className={vmBtnSecondary}
          >
            <span>Open</span>
            <ChevronRight className="w-4 h-4 text-[#B76E79]" />
          </button>
        </span>
      </Td>
    </tr>
  );
}

// ── One history row (stacked card) ──────────────────────────────────────────

function HistoryRow({
  audit,
  canWrite,
  onOpen,
  onResume
}: {
  audit: VmMappedAuditListItem;
  canWrite: boolean;
  onOpen: () => void;
  onResume: () => void;
}) {
  const isDraft = audit.status === 'Draft';
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`${vmClickableCard} space-y-3 p-4`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-black text-[#4A173A] truncate" title={formatVmDate(audit.entryDate)}>
            {formatVmDate(audit.entryDate) || audit.entryDate || '—'}
          </p>
          <p className={`${vmMeta} mt-0.5`}>
            {formatVmTime(audit.submittedAt || audit.createdAt) || '—'} · {audit.shift}
          </p>
        </div>
        <VmPill tone={statusTone(audit.status)}>{isDraft ? 'Draft — not submitted' : audit.status}</VmPill>
      </div>

      <div className="min-w-0">
        <p className="text-[13px] font-bold text-[#2B1722] truncate" title={`${audit.floor} → ${audit.section}`}>
          {audit.floor} <span className="text-[#B76E79]">→</span> {audit.section}
        </p>
        <p className={`${vmMeta} mt-0.5 truncate`}>
          {audit.locationName ? `${audit.locationName} · ` : ''}
          {dashIfEmpty(audit.submittedBy, 'No inspector recorded')}
        </p>
      </div>

      <dl className="grid grid-cols-4 gap-2">
        <MiniCell label="Score" value={scoreDisplay(audit.scorePercent)} tone={scoreTone(audit.scorePercent)} />
        <MiniCell label="Pass" value={String(audit.passedCount)} tone="positive" />
        <MiniCell label="Fail" value={String(audit.failedCount)} tone="danger" />
        <MiniCell label="N/A" value={String(audit.naCount)} tone="muted" />
      </dl>

      <div className="flex items-center justify-between gap-2">
        <MiniCell
          label="Photos"
          value={String(audit.photoCount)}
          tone="neutral"
          icon={<Camera className="w-3 h-3" />}
          className="w-[104px]"
        />
        <div className="flex items-center gap-2">
          {isDraft && canWrite && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onResume();
              }}
              className={vmBtnPrimary}
            >
              <PencilRuler className="w-4 h-4" />
              <span>Resume</span>
            </button>
          )}
          <span className="inline-flex items-center gap-1 text-[12px] font-black text-[#6A2853]">
            <span>Open</span>
            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </div>
  );
}

function FilterField({
  label,
  icon,
  children
}: {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className={`${vmLabel} mb-1 flex items-center gap-1`}>
        {icon && <span className="text-[#B76E79]">{icon}</span>}
        <span>{label}</span>
      </span>
      {children}
    </label>
  );
}

const STAT_TEXT: Record<VmTone, string> = {
  neutral: 'text-[#6A2853]',
  brand: 'text-[#4A173A]',
  positive: 'text-[#146B41]',
  warning: 'text-[#8A5B00]',
  danger: 'text-[#9B1C15]',
  muted: 'text-[#6F5963]'
};

function MiniCell({
  label,
  value,
  tone,
  icon,
  className = ''
}: {
  label: string;
  value: string;
  tone: VmTone;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 rounded-xl border border-[#E8D9D4] bg-[#FFF7F2] px-2 py-1.5 text-center ${className}`}>
      <p className={`${vmLabel} flex items-center justify-center gap-1`}>
        {icon}
        {label}
      </p>
      <p className={`mt-1 text-[14px] font-black leading-none ${STAT_TEXT[tone]}`}>{value}</p>
    </div>
  );
}

// ── Saved audit detail ──────────────────────────────────────────────────────

function AuditDetailModal({
  detail,
  loading,
  error,
  canWrite,
  onClose,
  onResume,
  onOpenPhoto
}: {
  detail: VmMappedAuditDetail;
  loading: boolean;
  error: string | null;
  canWrite: boolean;
  onClose: () => void;
  onResume: () => void;
  onOpenPhoto: (index: number) => void;
}) {
  const isDraft = detail.status === 'Draft';
  // Same value the record was filed with — the nested score when present, the list value otherwise.
  const detailScore = detail.score?.percent ?? detail.scorePercent;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-0 sm:p-4 bg-[#351027]/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label={`VM audit for ${detail.floor} ${detail.section}`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl h-[100dvh] sm:h-auto sm:max-h-[88vh] bg-[#FFFDFC] sm:rounded-2xl border-0 sm:border border-[#E8D9D4] shadow-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 bg-[#4A173A] px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.07em] text-[#E8C7A8]">Saved VM audit record</p>
            <h3 className="mt-1 break-words text-[17px] font-black leading-tight text-white">
              {detail.floor} → {detail.section}
            </h3>
            <p className="mt-1 text-[12px] font-semibold text-[#E8D9D4]">
              {formatVmDate(detail.entryDate) || detail.entryDate || '—'} · {detail.shift}
              {detail.submittedAt ? ` · submitted ${formatVmTime(detail.submittedAt)}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isDraft && canWrite && (
              <button
                type="button"
                onClick={() => {
                  onResume();
                  onClose();
                }}
                className="hidden min-h-[40px] items-center gap-1.5 rounded-xl bg-[#E8C7A8] px-3 text-[12px] font-black text-[#4A173A] transition-colors hover:bg-white cursor-pointer sm:inline-flex"
              >
                <PencilRuler className="w-4 h-4" />
                <span>Resume draft</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close audit record"
              className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-white transition-colors hover:bg-white/20 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-5">
          <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <SummaryCell label="Score" value={scoreDisplay(detailScore)} tone={scoreTone(detailScore)} />
            <SummaryCell label="Pass" value={String(detail.passedCount)} tone="positive" />
            <SummaryCell label="Fail" value={String(detail.failedCount)} tone="danger" />
            <SummaryCell label="N/A (excluded)" value={String(detail.naCount)} tone="muted" />
            <SummaryCell
              label="Unrated"
              value={String(detail.unratedCount)}
              tone={detail.unratedCount > 0 ? 'warning' : 'muted'}
            />
            <SummaryCell label="Checkpoints" value={String(detail.totalQuestions)} tone="brand" />
            <SummaryCell label="Photos" value={String(detail.photoCount)} tone="neutral" />
            <SummaryCell label="Inspector" value={dashIfEmpty(detail.submittedBy, '—')} tone="neutral" />
          </dl>

          <div className="flex flex-wrap items-center gap-2">
            <VmPill tone={statusTone(detail.status)}>
              {isDraft ? 'Draft — not a completed inspection' : detail.status}
            </VmPill>
            {detail.locationName && <VmPill tone="neutral">{detail.locationName}</VmPill>}
          </div>

          {Boolean(dashIfEmpty(detail.remarks, '').trim()) && (
            <div className="rounded-xl border border-[#E8D9D4] bg-[#FFF7F2] px-3 py-2.5">
              <p className={vmLabel}>Audit remarks</p>
              <p className="mt-1 break-words text-[13px] font-semibold leading-relaxed text-[#2B1722]">{detail.remarks}</p>
            </div>
          )}

          {loading && (
            <p className="flex items-center gap-2 text-[12px] font-bold text-[#356AE6]">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Loading the saved answers…</span>
            </p>
          )}

          {!loading && error && (
            <div className="flex items-start gap-2 rounded-xl border border-[#B42318]/30 bg-[#FDE8E7] px-3 py-2.5">
              <CircleAlert className="w-4 h-4 shrink-0 mt-0.5 text-[#B42318]" />
              <span className="break-words text-[12px] font-bold leading-snug text-[#9B1C15]">{error}</span>
            </div>
          )}

          <div className="space-y-2.5">
            <h4 className={vmTitle}>Checkpoint answers as filed</h4>
            {detail.entries.length === 0 ? (
              <p className="rounded-xl border border-[#E8D9D4] bg-[#FFF7F2] px-3 py-2.5 text-[13px] font-semibold leading-snug text-[#6F5963]">
                No checkpoint answers are stored on this record.
              </p>
            ) : (
              detail.entries.map((entry, index) => (
                <div key={`${entry.pointId}-${index}`} className="rounded-xl border border-[#E8D9D4] bg-white p-3 sm:p-4">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#4A173A] text-[12px] font-black text-white">
                      {index + 1}
                    </span>
                    <p className="min-w-0 flex-1 break-words text-[14px] font-black leading-snug text-[#2B1722]">
                      {dashIfEmpty(entry.pointTitle, 'Checkpoint title unavailable')}
                    </p>
                    <VmPill tone={answerTone(entry.score)} className="shrink-0">
                      {entry.score === 'NA' ? 'N/A' : entry.score || '—'}
                    </VmPill>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    <EntryNote label="Comment" value={entry.comment} />
                    <EntryNote label="Observation" value={entry.observation} />
                    <EntryNote label="Corrective action" value={entry.correctiveAction} />
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-2.5">
            <h4 className={`${vmLabel} flex items-center gap-1.5`}>
              <Camera className="w-3.5 h-3.5 text-[#B76E79]" />
              <span>Photos on this audit ({detail.photos.length})</span>
            </h4>
            {detail.photos.length === 0 ? (
              <VmEmptyState
                icon={<ImageOff className="w-5 h-5" />}
                title="No photos were attached to this audit."
                hint="Section shots are added on the photo step before a report is submitted."
              />
            ) : (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                {detail.photos.map((photo, index) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => onOpenPhoto(index)}
                    className="overflow-hidden rounded-xl border border-[#E8D9D4] bg-white text-left transition-colors hover:border-[#B76E79] cursor-pointer"
                  >
                    <span className="block aspect-[4/3] bg-[#FFF7F2]">
                      <img
                        src={photoSrc(photo)}
                        alt={photo.fileName}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </span>
                    <span className="block px-2.5 py-2">
                      <span className="block truncate text-[12px] font-bold text-[#2B1722]" title={photo.fileName}>
                        {photo.fileName}
                      </span>
                      <span className="mt-0.5 block text-[11px] font-semibold text-[#6F5963]">
                        {photo.pointId ? 'Checkpoint evidence' : 'Section shot'} · {formatBytes(photo.fileSize)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCell({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: VmTone }) {
  return (
    <div className="min-w-0 rounded-xl border border-[#E8D9D4] bg-[#FFF7F2] px-3 py-2">
      <dt className={vmLabel}>{label}</dt>
      <dd className={`mt-1 truncate text-[15px] font-black leading-none ${STAT_TEXT[tone]}`} title={value}>
        {value}
      </dd>
    </div>
  );
}

function EntryNote({ label, value }: { label: string; value: string }) {
  const filled = String(value || '').trim() !== '';
  return (
    <div
      className={`min-w-0 rounded-xl border px-3 py-2 ${
        filled ? 'border-[#E8D9D4] bg-[#FFFDFC]' : 'border-dashed border-[#E8D9D4] bg-[#FFF7F2]'
      }`}
    >
      <p className={vmLabel}>{label}</p>
      <p
        className={`mt-1 break-words text-[13px] font-semibold leading-snug ${
          filled ? 'text-[#2B1722]' : 'text-[#8C7A84]'
        }`}
      >
        {filled ? value : 'Not recorded'}
      </p>
    </div>
  );
}

// ── Areas requiring attention ───────────────────────────────────────────────

function AttentionPanel({
  attention,
  loading,
  error,
  onRetry
}: {
  attention: VmAttentionMapped | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const considered = attention?.auditsConsidered ?? 0;

  return (
    <section className={vmCard('p-4 sm:p-5')}>
      <VmSectionHeader
        icon={<Layers className="w-5 h-5" />}
        title="Lowest performing sections and checkpoints"
        subtitle="Computed by the server from filed audits only. Pass rate ignores N/A, exactly like the audit score."
        right={
          <button type="button" onClick={onRetry} disabled={loading} className={vmBtnSecondary}>
            <RefreshCw className={`w-4 h-4 text-[#B76E79] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        }
      />

      {loading ? (
        <div className="mt-4 space-y-3" aria-busy="true">
          <p className={`${vmMeta} flex items-center gap-2`}>
            <RefreshCw className="w-4 h-4 animate-spin text-[#B76E79]" />
            <span>Calculating attention areas from filed audits…</span>
          </p>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <VmSkeletonCard lines={3} />
            <VmSkeletonCard lines={3} />
          </div>
        </div>
      ) : error ? (
        <div className="mt-4">
          <VmErrorState
            title="Areas requiring attention could not be calculated"
            message={error}
            onRetry={onRetry}
          />
        </div>
      ) : considered === 0 ? (
        <div className="mt-4">
          <VmEmptyState
            icon={<ClipboardList className="w-5 h-5" />}
            title="Not enough audit data yet"
            hint={
              <>
                {attention ? `${attention.auditsConsidered} completed audits are on file for this store. ` : ''}
                Weak points are ranked once real inspections exist — no figures are shown for an empty history.
              </>
            }
          />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <AttentionColumn
            title="Lowest performing sections"
            empty="No section has a graded audit yet."
            items={(attention?.lowestSections || []).slice(0, 6).map((s) => ({
              key: `${s.floor}-${s.section}`,
              primary: `${s.floor} → ${s.section}`,
              rate: s.passRate,
              meta: `${s.audits} audit${s.audits === 1 ? '' : 's'} · avg ${scoreDisplay(s.avgScore)}`
            }))}
          />
          <AttentionColumn
            title="Lowest performing checkpoints"
            empty="No checkpoint has a graded answer yet."
            items={(attention?.lowestQuestions || []).slice(0, 6).map((q) => ({
              key: q.pointId,
              primary: q.pointTitle,
              rate: q.passRate,
              meta: `${q.audits} answer${q.audits === 1 ? '' : 's'} · ${q.passed} pass / ${q.failed} fail / ${q.notApplicable} N/A`
            }))}
          />
        </div>
      )}
    </section>
  );
}

/**
 * One ranked list. `rate` is the server's own pass rate and is null when nothing
 * on that section or checkpoint has been graded yet — drawn as a dash with no bar,
 * never as a fabricated 0%.
 */
function AttentionColumn({
  title,
  empty,
  items
}: {
  title: string;
  empty: string;
  items: { key: string; primary: string; rate: number | null; meta: string }[];
}) {
  return (
    <div className="rounded-xl border border-[#E8D9D4] bg-[#FFF7F2] p-3 sm:p-4">
      <h3 className={vmLabel}>{title}</h3>
      <ul className="mt-3 space-y-2.5">
        {items.length === 0 ? (
          <li className="text-[13px] font-semibold leading-snug text-[#6F5963]">{empty}</li>
        ) : (
          items.map((item) => (
            <li key={item.key} className="rounded-xl border border-[#E8D9D4] bg-white px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 break-words text-[13px] font-bold leading-snug text-[#2B1722]">{item.primary}</p>
                <VmPill tone={scoreTone(item.rate)} className="shrink-0">
                  {item.rate === null ? 'No graded data' : `${item.rate}%`}
                </VmPill>
              </div>
              <p className={`${vmMeta} mt-1`}>{item.meta}</p>
              {item.rate !== null && (
                <div className="mt-2">
                  <VmProgressBar value={item.rate} total={100} tone={scoreTone(item.rate)} />
                </div>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
