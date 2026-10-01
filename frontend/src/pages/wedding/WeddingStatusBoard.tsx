import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import PageContainer from '../../components/ui/PageContainer';
import ToastContainer, { showToast } from '../../components/Toast';
import { API, Auth, UserSession } from '../../services/api';
import { permissionsCache } from '../../context/PermissionsCache';
import { useRealtimeSection } from '../../hooks/useRealtimeSection';
import WeddingNav from './WeddingNav';
import LocationFilterSelect from '../../components/ui/LocationFilterSelect';
import { RefreshCw, Plus, CircleAlert } from 'lucide-react';

import PipelineCard from './pipeline/PipelineCard';
import PipelineFilters, { EMPTY_PIPELINE_FILTERS, PipelineFilterState } from './pipeline/PipelineFilters';
import TodaysWorkPanel from './pipeline/TodaysWorkPanel';
import OverdueFollowUps from './pipeline/OverdueFollowUps';
import CustomerDetailDrawer from './pipeline/CustomerDetailDrawer';
import QuickActionModal from './pipeline/QuickActionModal';
import { groupByStage } from './pipeline/pipelineDerived';
import type { PipelineCustomer, PipelineStage, QuickActionKind } from './pipeline/types';
import { STAGE_PRESENTATION } from './pipeline/types';

/**
 * Wedding Status Pipeline — daily customer workspace.
 *
 * One scoped board request feeds the stage columns, Today's Work and the overdue
 * list, so the three can never disagree. Stage membership is assigned by the
 * backend (`stage_key`), which is what stops a customer from disappearing when
 * its status is one this screen has never seen before.
 */

// Rendering hundreds of cards at once makes the board sluggish; columns expand
// on demand instead.
const CARDS_PER_STAGE_INIT = 30;
const CARDS_PER_STAGE_STEP = 30;

export default function WeddingStatusBoard() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(() => Auth.get());

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [customers, setCustomers] = useState<PipelineCustomer[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [today, setToday] = useState<string>('');
  // A board request that failed is not an empty pipeline: keep the two states apart.
  const [boardError, setBoardError] = useState<string | null>(null);
  const [filters, setFilters] = useState<PipelineFilterState>(EMPTY_PIPELINE_FILTERS);
  const [stageLimits, setStageLimits] = useState<Record<string, number>>({});

  const [locationFilter, setLocationFilter] = useState<number | ''>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('bsc_selected_location') : null;
    return saved && saved !== 'ALL' ? Number(saved) : '';
  });

  const [canEdit, setCanEdit] = useState(false);
  const [drawerCustomerId, setDrawerCustomerId] = useState<number | null>(null);
  // Bumped to re-mount the drawer after a quick action writes to the same record.
  const [drawerKey, setDrawerKey] = useState(0);
  const [action, setAction] = useState<{ kind: QuickActionKind; customerId: number } | null>(null);

  // Latest-callback refs keep loadBoard stable so filter typing cannot retrigger it.
  const filtersRef = useRef(filters);
  const locationRef = useRef(locationFilter);
  const requestSeqRef = useRef(0);
  filtersRef.current = filters;
  locationRef.current = locationFilter;

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    const sess = Auth.get();
    setSession(sess);
    if (sess?.locationId && !sess.isGlobalAdmin) setLocationFilter(sess.locationId);

    let alive = true;
    permissionsCache.get().then(() => {
      if (alive) {
        setCanEdit(
          permissionsCache.canAction('wedding_crm', 'can_edit', sess?.role) ||
          permissionsCache.canAction('wedding_crm', 'can_add', sess?.role)
        );
      }
    }).catch(() => { if (alive) setCanEdit(false); });
    return () => { alive = false; };
  }, [navigate]);

  useEffect(() => {
    const handleLocChange = (e: any) => {
      const locId = e?.detail?.locationId;
      setLocationFilter(locId && locId !== 'ALL' ? Number(locId) : '');
    };
    window.addEventListener('bsc_location_changed', handleLocChange);
    return () => window.removeEventListener('bsc_location_changed', handleLocChange);
  }, []);

  const loadBoard = useCallback(async ({ silent = false } = {}) => {
    const seq = ++requestSeqRef.current;
    if (silent) setRefreshing(true); else setLoading(true);

    try {
      const f = filtersRef.current;
      const params: Record<string, any> = {};
      if (f.search.trim()) params.search = f.search.trim();
      if (f.stage && f.stage !== 'all') params.stage = f.stage;
      if (f.telecaller_id && f.telecaller_id !== 'all') params.telecaller_id = f.telecaller_id;
      if (f.priority && f.priority !== 'all') params.priority = f.priority;
      if (f.call_status && f.call_status !== 'all') params.call_status = f.call_status;
      if (f.date_preset === 'overdue') params.overdue = '1';
      if (f.date_preset === 'today') params.due_today = '1';
      if (f.follow_up_from && f.follow_up_to) {
        params.follow_up_from = f.follow_up_from;
        params.follow_up_to = f.follow_up_to;
      }
      if (locationRef.current !== '') params.location_id = locationRef.current;
      params.limit = 1000;

      const res = await API.getWeddingPipelineBoard(params);
      if (seq !== requestSeqRef.current) return;

      if (!res || res.success === false) throw new Error(res?.message || 'Unable to load the pipeline');
      setCustomers(Array.isArray(res.customers) ? res.customers : []);
      setStages(Array.isArray(res.stages) ? res.stages : []);
      if (res.today) setToday(res.today);
      setBoardError(null);
    } catch (err: any) {
      if (seq !== requestSeqRef.current) return;
      let message = 'Unable to load the Wedding Status Pipeline. Please try again.';
      if (err?.status === 401) {
        message = 'Your session has expired. Please sign in again.';
      } else if (err?.status === 403) {
        message = 'Access denied. You do not have permission to view the Wedding Pipeline.';
      } else if (err?.message && /Failed to fetch|NetworkError|network|connection/i.test(err.message)) {
        message = 'Unable to connect to the server. Please check your connection and try again.';
      } else if (err?.message && !/Unknown column|SELECT|SQL|syntax error|ER_/i.test(err.message)) {
        message = err.message.startsWith('Unable to') || err.message.startsWith('Failed to')
          ? err.message
          : `Unable to load the Wedding Status Pipeline. ${err.message}`;
      }
      setBoardError(message);
      // A failed load must not render as an empty pipeline. Keep the last good
      // cards when only refreshing; clear them when the board was never loaded.
      if (!silent) {
        setCustomers([]);
        setStages([]);
      }
      showToast(message, 'error');
    } finally {
      if (seq === requestSeqRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    loadBoard();
  }, [loadBoard, locationFilter]);

  // Debounced server-side filtering; typing does not refetch per keystroke.
  const filterTimerRef = useRef<any>(null);
  const [debouncedFilters, setDebouncedFilters] = useState<PipelineFilterState>(filters);
  useEffect(() => {
    if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
    filterTimerRef.current = setTimeout(() => setDebouncedFilters(filters), 300);
    return () => clearTimeout(filterTimerRef.current);
  }, [filters]);

  // The mount effect above already fetched the unfiltered board, so the first
  // render of this key must not fire a second identical request.
  const boardKeyRef = useRef<string | null>(null);
  const debouncedKey = JSON.stringify(debouncedFilters);
  useEffect(() => {
    if (boardKeyRef.current === null) {
      boardKeyRef.current = debouncedKey;
      return;
    }
    if (boardKeyRef.current === debouncedKey) return;
    boardKeyRef.current = debouncedKey;
    loadBoard({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedKey]);

  // New calls, feedback, follow-ups or status changes elsewhere refresh only this
  // board's data — no page reload, no lost filters.
  useRealtimeSection(['wedding', 'callqueue', 'feedback'], () => loadBoard({ silent: true }), { debounceMs: 800 });

  const grouped = useMemo(() => groupByStage(customers, stages), [customers, stages]);

  const overdueCustomers = useMemo(
    () => customers.filter((c) => (Number(c.overdue_days) || 0) > 0),
    [customers]
  );

  const telecallerOptions = useMemo(() => {
    const seen = new Map<number, string>();
    customers.forEach((c) => {
      if (c.assigned_telecaller_id && c.assigned_telecaller && !seen.has(c.assigned_telecaller_id)) {
        seen.set(c.assigned_telecaller_id, c.assigned_telecaller);
      }
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [customers]);

  const customerById = useMemo(() => {
    const map = new Map<number, PipelineCustomer>();
    customers.forEach((c) => map.set(c.id, c));
    return map;
  }, [customers]);

  // The drawer reads the stage the server assigned, the same row the card used.
  const drawerCustomer = drawerCustomerId !== null ? customerById.get(drawerCustomerId) : undefined;

  const openCustomer = useCallback((c: PipelineCustomer) => setDrawerCustomerId(c.id), []);
  const openAction = useCallback((kind: QuickActionKind, c: PipelineCustomer) => setAction({ kind, customerId: c.id }), []);
  const openActionById = useCallback((kind: QuickActionKind, customerId: number) => setAction({ kind, customerId }), []);

  const showMore = (stageKey: string) =>
    setStageLimits((prev) => ({ ...prev, [stageKey]: (prev[stageKey] || CARDS_PER_STAGE_INIT) + CARDS_PER_STAGE_STEP }));

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.search.trim()) n++;
    if (filters.stage && filters.stage !== 'all') n++;
    if (filters.telecaller_id && filters.telecaller_id !== 'all') n++;
    if (filters.priority && filters.priority !== 'all') n++;
    if (filters.call_status && filters.call_status !== 'all') n++;
    if (filters.date_preset !== 'all') n++;
    if (filters.follow_up_from && filters.follow_up_to) n++;
    return n;
  }, [filters]);

  return (
    <DashboardLayout
      title="Wedding Status Pipeline"
      breadcrumbs={[{ label: 'Wedding CRM', href: '/wedding-crm/dashboard' }, { label: 'Status Pipeline' }]}
    >
      <PageContainer maxWidth="full">
        <div className="space-y-5">
          <ToastContainer />

          <WeddingNav
            currentPageTitle="Wedding Status Pipeline"
            actions={
              <div className="flex items-center gap-2 flex-wrap">
                <LocationFilterSelect
                  value={locationFilter}
                  onChange={(val) => setLocationFilter(val)}
                />
                <button
                  onClick={() => loadBoard({ silent: true })}
                  disabled={loading || refreshing}
                  className="px-3.5 py-2 bg-[#FFFFFF] hover:bg-[#EDF3F0] border border-[#E1DDD3] rounded-xl text-xs font-bold text-[#123C35] flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-[#C9A45C] ${loading || refreshing ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
                <Link
                  to="/wedding/customer-registration"
                  className="px-4 py-2 bg-[#123C35] hover:bg-[#082821] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs border border-[#123C35] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-[#E4CB92]" />
                  <span>Add Customer</span>
                </Link>
              </div>
            }
          />

          <PipelineFilters
            value={filters}
            onChange={setFilters}
            stages={stages}
            telecallers={telecallerOptions}
            busy={loading || refreshing}
          />

          {boardError && customers.length > 0 && (
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-[#FDE8E7] border border-[#B42318]/30 rounded-2xl">
              <span className="flex items-center gap-2 text-[11px] font-bold text-[#B42318] min-w-0">
                <CircleAlert className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{boardError} Showing the last loaded data.</span>
              </span>
              <button
                onClick={() => loadBoard()}
                className="shrink-0 px-3 py-1 rounded-lg bg-[#B42318] hover:bg-[#8f1c14] text-white text-[10px] font-black uppercase tracking-wider transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          <TodaysWorkPanel
            customers={customers}
            today={today}
            loading={loading}
            onOpen={openCustomer}
            onAction={openAction}
          />

          {!loading && overdueCustomers.length > 0 && (
            <OverdueFollowUps
              customers={overdueCustomers}
              today={today}
              onOpen={openCustomer}
              onAction={openAction}
            />
          )}

          {loading ? (
            <div className="py-20 text-center text-xs text-[#65716C]">
              <RefreshCw className="w-5 h-5 animate-spin text-[#C9A45C] mx-auto mb-2" />
              Loading wedding pipeline...
            </div>
          ) : boardError && customers.length === 0 ? (
            <div className="py-16 px-6 text-center bg-[#FFFFFF] border border-[#B42318]/30 rounded-3xl">
              <CircleAlert className="w-6 h-6 text-[#B42318] mx-auto mb-3" />
              <p className="text-sm font-black text-[#123C35]">Unable to load the Wedding Status Pipeline.</p>
              <p className="text-xs text-[#65716C] mt-1 max-w-xl mx-auto break-words">{boardError}</p>
              <button
                onClick={() => loadBoard()}
                className="mt-5 px-4 py-2 bg-[#123C35] hover:bg-[#082821] text-white font-bold rounded-xl text-xs inline-flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          ) : customers.length === 0 ? (
            <div className="py-16 text-center bg-[#FFFFFF] border border-[#E1DDD3] rounded-3xl">
              <p className="text-sm font-black text-[#123C35]">No customers match these filters</p>
              <p className="text-xs text-[#65716C] mt-1">
                {activeFilterCount > 0 ? 'Clear the filters to see the full pipeline.' : 'New registrations will appear here automatically.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto sm:overflow-x-hidden pb-4 -mx-4 sm:mx-0 px-4 sm:px-0">
              {/* Phone: one stage at a time, 85vw wide so a 320px viewport still shows
                  the whole card. Tablet up: a real grid, so the horizontal scroller can
                  never clip a column and only the page owns the vertical scrollbar. */}
              <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 min-w-0">
                {stages
                  .filter((s) => s.key !== 'other' || (grouped['other'] || []).length > 0)
                  .map((stage) => {
                    const cards = grouped[stage.key] || [];
                    const limit = stageLimits[stage.key] || CARDS_PER_STAGE_INIT;
                    const presentation = STAGE_PRESENTATION[stage.key] || STAGE_PRESENTATION.other;

                    return (
                      <div
                        key={stage.key}
                        className={`bg-[#FFFFFF] rounded-3xl border ${presentation.accent} shadow-xs flex flex-col min-h-[320px] sm:min-h-[420px] max-h-[80vh] sm:max-h-[70vh] xl:max-h-[62vh] w-[min(85vw,330px)] sm:w-auto shrink-0 sm:shrink min-w-0`}
                      >
                        <div className={`flex items-center justify-between gap-2 px-4 py-3 border-b border-[#E1DDD3] ${presentation.headerBg} rounded-t-3xl sticky top-0 z-10`}>
                          <h3 className="min-w-0 flex-1 break-words text-[11px] font-black text-[#123C35] uppercase tracking-wider leading-tight">
                            <span className="whitespace-nowrap">{stage.order}.</span> {stage.label}
                          </h3>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black whitespace-nowrap shrink-0 ${presentation.chip}`}>
                            {stage.count}
                          </span>
                        </div>

                        <div className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-3">
                          {cards.length === 0 ? (
                            <div className="py-12 text-center text-[11px] text-[#65716C]">
                              No customers in this stage
                            </div>
                          ) : (
                            <>
                              {cards.slice(0, limit).map((cust) => (
                                <PipelineCard
                                  key={cust.id}
                                  customer={cust}
                                  today={today}
                                  onOpen={openCustomer}
                                  onAction={openAction}
                                />
                              ))}
                              {cards.length > limit && (
                                <button
                                  onClick={() => showMore(stage.key)}
                                  className="w-full py-2 rounded-xl border border-[#E1DDD3] bg-[#F7F5F0] hover:bg-[#EDF3F0] text-[11px] font-bold text-[#123C35] transition-colors"
                                >
                                  Show {Math.min(CARDS_PER_STAGE_STEP, cards.length - limit)} more of {cards.length}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </PageContainer>

      <CustomerDetailDrawer
        key={`drawer-${drawerCustomerId ?? 'none'}-${drawerKey}`}
        customerId={drawerCustomerId}
        open={drawerCustomerId !== null}
        today={today}
        stageKey={drawerCustomer?.stage_key ?? null}
        canEdit={canEdit}
        onClose={() => setDrawerCustomerId(null)}
        onChanged={() => loadBoard({ silent: true })}
        onAction={openActionById}
      />

      <QuickActionModal
        kind={action?.kind ?? null}
        customerId={action?.customerId ?? null}
        customer={action ? customerById.get(action.customerId) ?? null : null}
        today={today}
        onClose={() => setAction(null)}
        onSaved={(customerId) => {
          loadBoard({ silent: true });
          // Re-mount an open drawer so it re-reads the record it just changed.
          if (drawerCustomerId === customerId) setDrawerKey((k) => k + 1);
        }}
      />
    </DashboardLayout>
  );
}
