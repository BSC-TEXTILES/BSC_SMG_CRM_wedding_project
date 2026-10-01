import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '../components/layouts/DashboardLayout';
import PageContainer from '../components/ui/PageContainer';
import { showToast } from '../components/Toast';
import {
  Activity,
  Award,
  BarChart3,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Clock,
  Eye,
  Filter,
  History as HistoryIcon,
  Layers,
  MapPin,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Store,
  Trash2,
  TrendingUp,
  User,
  X
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { API, Auth } from '../services/api';
import { permissionsCache } from '../context/PermissionsCache';
import { useRealtimeSection } from '../hooks/useRealtimeSection';

import StepIndicator from './vm/StepIndicator';
import FloorStep from './vm/FloorStep';
import SectionStep from './vm/SectionStep';
import AuditStep from './vm/AuditStep';
import ReviewStep from './vm/ReviewStep';
import HistoryStep from './vm/HistoryStep';
import PhotoLightbox from './vm/PhotoLightbox';
import { useVmAuditFlow } from './vm/useVmAuditFlow';
import { VM_SHIFTS } from './vm/vmTypes';
import type { VmPhoto } from './vm/vmTypes';
import {
  VM_FLOW_STEPS,
  formatBytes,
  formatVmDate,
  liveScoreDisplay,
  mapAuditList,
  mapPhoto,
  photoSrc,
  scoreDisplay,
  toLightboxItems,
  uniqueStrings,
  vmErrorMessage,
  type VmMappedAuditListItem
} from './vm/vmFlowUtils';

type ViewKey = 'flow' | 'gallery' | 'analytics';

const CHART_COLORS = {
  pass: '#198754',
  review: '#C58A18',
  fail: '#B42318',
  plum: '#4A173A',
  rose: '#B76E79'
};

const GALLERY_CONTROL =
  'w-full text-xs font-bold text-[#4A173A] bg-white border border-[#E8D9D4] rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#B76E79]/35 focus:border-[#B76E79] transition-all shadow-2xs';
const GALLERY_LABEL = 'block text-[11px] font-black uppercase tracking-wider text-[#6F5963] mb-1.5 flex items-center gap-1.5';

const TOOLTIP_STYLE = {
  backgroundColor: '#FFFDFC',
  border: '1px solid #E8D9D4',
  borderRadius: 14,
  fontSize: 11,
  fontWeight: 700,
  color: '#4A173A'
} as const;

/**
 * Visual Merchandising Checklist — step-driven audit desk.
 *
 * The audit path is a guided flow (Floor → Section → Audit → Photos → Submit) with
 * exactly one step rendered at a time under a sticky rail, and History for the
 * filed records. The gallery and analytics that used to share this screen are kept
 * as peer views, so nothing was lost in the redesign.
 *
 * Every figure is read from the backend: floors with their drafts, last audit date
 * and latest score from GET /vm/floor-summary; checkpoint counts from GET /vm/points;
 * the audit itself from the draft endpoints (POST /vm/audits/draft,
 * PUT /vm/audits/:id/draft, POST /vm/audits/:id/submit); history from
 * GET /vm/audits(+/:id); weak points from GET /vm/attention. Nothing is hardcoded.
 */
export default function VmChecklist() {
  const session = Auth.get();
  const userRole = String(session?.role || '').trim().toLowerCase();
  const isAdmin = !session || ['admin', 'super admin', 'system administrator'].includes(userRole);
  const isManager = ['manager', 'store manager', 'floor manager', 'vm', 'crm manager'].includes(userRole);
  const inspectorName = session?.fullName || session?.displayName || session?.username || '';
  const userLocationName = session?.locationName || '';

  // The backend gates every VM write on vm_checklist/can_add, so the UI asks the
  // same question and hides write controls for read-only users. Hiding is a comfort
  // only — the API still enforces it.
  const [canWriteAcm, setCanWriteAcm] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    permissionsCache
      .get()
      .then(() => {
        if (alive) setCanWriteAcm(permissionsCache.canAction('vm_checklist', 'can_add', session?.role));
      })
      .catch(() => {
        if (alive) setCanWriteAcm(isAdmin || isManager);
      });
    return () => {
      alive = false;
    };
  }, [isAdmin, isManager, session?.role]);
  const canWrite = canWriteAcm ?? (isAdmin || isManager);

  // Deep links: /vm-checklist?tab=history&auditId=… opens a saved record, and
  // ?tab=gallery|analytics jumps straight to a reading view.
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const initialStep = requestedTab === 'history' ? 'history' : 'floor';
  const flow = useVmAuditFlow({ initialStep });

  const [view, setView] = useState<ViewKey>(
    requestedTab === 'gallery' ? 'gallery' : requestedTab === 'analytics' ? 'analytics' : 'flow'
  );
  const [focusAuditId, setFocusAuditId] = useState<string | null>(searchParams.get('auditId') || null);

  // Another device or tab filed something: refresh the step-1 cards quietly.
  useRealtimeSection(['vm'], () => void flow.loadFloors({ silent: true }), { debounceMs: 900 });

  // ── Lightbox for the gallery (PhotoUploader and History bring their own) ───
  const [galleryViewer, setGalleryViewer] = useState<{ items: ReturnType<typeof toLightboxItems>; index: number } | null>(null);

  // ── Gallery view ──────────────────────────────────────────────────────────
  const [galleryFilters, setGalleryFilters] = useState({
    locationId: '',
    floor: 'All',
    section: 'All',
    date: '',
    inspector: 'All',
    shift: 'All',
    minScore: ''
  });
  const [galleryPhotos, setGalleryPhotos] = useState<VmPhoto[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const gallerySeqRef = useRef(0);
  const galleryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<VmPhoto | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState(false);

  const loadGallery = useCallback(async () => {
    const seq = ++gallerySeqRef.current;
    setGalleryLoading(true);
    try {
      const params: {
        locationId?: string;
        floor?: string;
        section?: string;
        date?: string;
        inspector?: string;
        shift?: string;
        minScore?: number;
        maxScore?: number;
        limit?: number;
      } = { limit: 200 };
      if (galleryFilters.locationId) params.locationId = galleryFilters.locationId;
      if (galleryFilters.floor !== 'All') params.floor = galleryFilters.floor;
      if (galleryFilters.section !== 'All') params.section = galleryFilters.section;
      if (galleryFilters.date) params.date = galleryFilters.date;
      if (galleryFilters.inspector !== 'All') params.inspector = galleryFilters.inspector;
      if (galleryFilters.shift !== 'All') params.shift = galleryFilters.shift;
      // "Below 50%" is a ceiling, not a floor, so it goes to maxScore instead of
      // being smuggled through minScore as a range string the server cannot parse.
      if (galleryFilters.minScore === 'below50') params.maxScore = 49;
      else if (galleryFilters.minScore) params.minScore = Number(galleryFilters.minScore);

      const res = await API.getVmPhotos(params);
      if (seq !== gallerySeqRef.current) return;
      if (!res || res.success === false) {
        throw new Error((res as { message?: string })?.message || 'The photo gallery was rejected by the server.');
      }
      const list = Array.isArray((res as { photos?: unknown[] })?.photos) ? (res as { photos: unknown[] }).photos : [];
      setGalleryPhotos(list.map(mapPhoto));
      setGalleryError(null);
    } catch (err) {
      if (seq !== gallerySeqRef.current) return;
      setGalleryError(vmErrorMessage(err, 'Unable to load the VM photo gallery. Please try again.'));
      setGalleryPhotos([]);
    } finally {
      if (seq === gallerySeqRef.current) setGalleryLoading(false);
    }
  }, [galleryFilters]);

  // Only the visible view fetches, and filter typing is debounced.
  useEffect(() => {
    if (view !== 'gallery') return;
    if (galleryTimerRef.current) clearTimeout(galleryTimerRef.current);
    galleryTimerRef.current = setTimeout(() => void loadGallery(), 250);
    return () => {
      if (galleryTimerRef.current) clearTimeout(galleryTimerRef.current);
    };
  }, [view, loadGallery]);

  const confirmDeletePhoto = useCallback(async () => {
    if (!photoToDelete || deletingPhoto) return;
    const id = photoToDelete.id;
    setDeletingPhoto(true);
    try {
      await API.deleteVmPhoto(id);
      setGalleryPhotos((prev) => prev.filter((p) => p.id !== id));
      setGalleryViewer(null);
      showToast('Photo deleted successfully.', 'success');
      setPhotoToDelete(null);
    } catch (err) {
      showToast(vmErrorMessage(err, 'Unable to delete this photo.'), 'error');
    } finally {
      setDeletingPhoto(false);
    }
  }, [deletingPhoto, photoToDelete]);

  // ── Analytics view ────────────────────────────────────────────────────────
  const [auditFilters, setAuditFilters] = useState({
    floor: 'All',
    section: 'All',
    status: 'All',
    dateFrom: '',
    dateTo: ''
  });
  const [analyticsAudits, setAnalyticsAudits] = useState<VmMappedAuditListItem[]>([]);
  const [analyticsTotal, setAnalyticsTotal] = useState(0);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const analyticsSeqRef = useRef(0);
  const analyticsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadAnalytics = useCallback(async () => {
    const seq = ++analyticsSeqRef.current;
    setAnalyticsLoading(true);
    try {
      const params: {
        floor?: string;
        section?: string;
        status?: string;
        dateFrom?: string;
        dateTo?: string;
        limit?: number;
      } = { limit: 300 };
      if (auditFilters.floor !== 'All') params.floor = auditFilters.floor;
      if (auditFilters.section !== 'All') params.section = auditFilters.section;
      if (auditFilters.status !== 'All') params.status = auditFilters.status;
      if (auditFilters.dateFrom) params.dateFrom = auditFilters.dateFrom;
      if (auditFilters.dateTo) params.dateTo = auditFilters.dateTo;

      const res = await API.getVmAudits(params);
      if (seq !== analyticsSeqRef.current) return;
      if (!res || res.success === false) {
        throw new Error((res as { message?: string })?.message || 'The analytics feed was rejected by the server.');
      }
      const mapped = mapAuditList(res);
      setAnalyticsAudits(mapped.audits);
      setAnalyticsTotal(mapped.total);
      setAnalyticsError(null);
    } catch (err) {
      if (seq !== analyticsSeqRef.current) return;
      setAnalyticsError(vmErrorMessage(err, 'Unable to load VM analytics. Please try again.'));
      setAnalyticsAudits([]);
      setAnalyticsTotal(0);
    } finally {
      if (seq === analyticsSeqRef.current) setAnalyticsLoading(false);
    }
  }, [auditFilters]);

  useEffect(() => {
    if (view !== 'analytics') return;
    if (analyticsTimerRef.current) clearTimeout(analyticsTimerRef.current);
    analyticsTimerRef.current = setTimeout(() => void loadAnalytics(), 300);
    return () => {
      if (analyticsTimerRef.current) clearTimeout(analyticsTimerRef.current);
    };
  }, [view, loadAnalytics]);

  // Aggregates cover only the filed rows GET /vm/audits returned, so a chart can
  // never disagree with the history list. N/A leaves the denominator, as everywhere.
  const analytics = useMemo(() => {
    const rows = analyticsAudits.filter((a) => a.status !== 'Draft');
    const byFloor = new Map<string, { total: number; count: number }>();
    const bySection = new Map<string, { total: number; count: number }>();
    const byDate = new Map<string, { total: number; count: number }>();
    const byQuestion = new Map<string, { passed: number; failed: number }>();

    const push = (map: Map<string, { total: number; count: number }>, key: string, score: number) => {
      const cur = map.get(key) || { total: 0, count: 0 };
      cur.total += score;
      cur.count += 1;
      map.set(key, cur);
    };

    rows.forEach((a) => {
      push(byFloor, a.floor || 'Unknown', a.scorePercent);
      push(bySection, a.section || 'Unknown', a.scorePercent);
      push(byDate, formatVmDate(a.entryDate) || a.entryDate || 'Unknown', a.scorePercent);
      // The audits feed already carries each record's answers, so per-question pass
      // rates need no extra request.
      a.entries.forEach((e) => {
        if (!e.pointId) return;
        const cur = byQuestion.get(e.pointId) || { passed: 0, failed: 0 };
        if (e.score === 'Pass') cur.passed += 1;
        else if (e.score === 'Fail') cur.failed += 1;
        byQuestion.set(e.pointId, cur);
      });
    });

    const toSeries = (map: Map<string, { total: number; count: number }>) =>
      Array.from(map.entries())
        .map(([name, v]) => ({ name, score: Math.round(v.total / Math.max(1, v.count)), audits: v.count }))
        .sort((a, b) => b.audits - a.audits);

    const averageScore = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.scorePercent, 0) / rows.length) : null;
    const latest = rows.map((r) => r.entryDate).sort()[rows.length - 1] || null;

    const questionSeries = Array.from(byQuestion.entries())
      .map(([pointId, v]) => {
        const graded = v.passed + v.failed;
        const title = flow.questions.find((q) => q.id === pointId)?.title || pointId;
        return {
          id: pointId,
          name: title,
          rate: graded > 0 ? Math.round((v.passed / graded) * 100) : null,
          graded
        };
      })
      .filter((q): q is { id: string; name: string; graded: number; rate: number } => q.rate !== null)
      .sort((a, b) => a.rate - b.rate);

    return {
      rows,
      floors: toSeries(byFloor),
      sections: toSeries(bySection),
      trend: Array.from(byDate.entries()).map(([date, v]) => ({
        date,
        score: Math.round(v.total / Math.max(1, v.count))
      })),
      status: [
        { name: 'Completed', value: rows.filter((r) => r.status === 'Completed').length, color: CHART_COLORS.pass },
        { name: 'Review', value: rows.filter((r) => r.status === 'Review').length, color: CHART_COLORS.review }
      ].filter((s) => s.value > 0),
      drafts: analyticsAudits.filter((r) => r.status === 'Draft').length,
      averageScore,
      latest,
      questionSeries
    };
  }, [analyticsAudits, flow.questions]);

  const goToHistoryWithAudit = useCallback(
    (id: string) => {
      setFocusAuditId(id);
      setView('flow');
      flow.goToStep('history');
    },
    [flow]
  );

  const handleFocusHandled = useCallback(() => setFocusAuditId(null), []);

  const gallerySectionOptions = useMemo(() => {
    const scoped = flow.floors.filter((f) => galleryFilters.floor === 'All' || f.name === galleryFilters.floor);
    return uniqueStrings(scoped.flatMap((f) => f.sections));
  }, [flow.floors, galleryFilters.floor]);

  const inspectorOptions = useMemo(() => uniqueStrings(analyticsAudits.map((a) => a.submittedBy)), [analyticsAudits]);

  const analyticsSectionOptions = useMemo(() => {
    const scoped = flow.floors.filter((f) => auditFilters.floor === 'All' || f.name === auditFilters.floor);
    return uniqueStrings(scoped.flatMap((f) => f.sections));
  }, [auditFilters.floor, flow.floors]);

  // ── Step body: only the current step renders ──────────────────────────────
  const stepBody = () => {
    switch (flow.step) {
      case 'floor':
        return (
          <FloorStep
            floors={flow.floors}
            loading={flow.floorsLoading}
            error={flow.floorsError}
            onRetry={() => void flow.loadFloors()}
            onSelect={flow.chooseFloor}
            canAudit={canWrite}
            today={flow.today}
            checkpointCount={flow.checkpointCount}
            isAdmin={isAdmin}
            onFloorCreated={() => void flow.loadFloors()}
          />
        );

      case 'section':
        return (
          <SectionStep
            floorName={flow.floorName}
            floor={flow.selectedFloor}
            checkpointCount={flow.checkpointCount}
            loading={flow.questionsLoading}
            error={flow.questionsError}
            onRetry={() => void flow.loadQuestions()}
            onSelect={flow.chooseSection}
            canAudit={canWrite}
          />
        );

      case 'audit':
        return (
          <AuditStep
            floorName={flow.floorName}
            sectionName={flow.sectionName}
            shift={flow.shift}
            onShiftChange={(next) => void flow.changeShift(next)}
            questions={flow.questions}
            questionsLoading={flow.questionsLoading}
            questionsError={flow.questionsError}
            onRetryQuestions={() => void flow.loadQuestions()}
            answers={flow.answers}
            onScoreChange={flow.setAnswerScore}
            onNoteChange={flow.setAnswerNote}
            liveScore={flow.liveScore}
            pendingCount={flow.pendingCount}
            auditId={flow.auditId}
            draftLoading={flow.draftLoading}
            draftError={flow.draftError}
            onRetryDraft={flow.retryOpenDraft}
            draftResumed={flow.draftResumed}
            draftStatus={flow.draftStatus}
            entryDate={flow.entryDate}
            saveState={flow.saveState}
            savedAt={flow.savedAt}
            saveError={flow.saveError}
            isDirty={flow.isDirty}
            onSaveNow={() => void flow.saveDraftNow()}
            canWrite={canWrite}
            onNext={flow.goNext}
          />
        );

      case 'photos':
      case 'submit':
        return (
          <ReviewStep
            step={flow.step}
            floorName={flow.floorName}
            sectionName={flow.sectionName}
            shift={flow.shift}
            entryDate={flow.entryDate}
            auditId={flow.auditId}
            questions={flow.questions}
            answers={flow.answers}
            liveScore={flow.liveScore}
            serverScore={flow.serverScore}
            photos={flow.photos}
            photosLoading={flow.photosLoading}
            onPhotosChanged={flow.handlePhotosChanged}
            submitIssues={flow.submitIssues}
            submitting={flow.submitting}
            submitError={flow.submitError}
            onSubmit={() => void flow.submitAudit()}
            onBackToAudit={() => flow.goToStep('audit')}
            onGoToSubmit={() => flow.goToStep('submit')}
            canWrite={canWrite}
            inspectorName={inspectorName}
          />
        );

      case 'history':
      default:
        return (
          <HistoryStep
            floors={flow.floors}
            attention={flow.attention}
            attentionLoading={flow.attentionLoading}
            attentionError={flow.attentionError}
            onRetryAttention={() => void flow.loadAttention()}
            canWrite={canWrite}
            onResumeDraft={flow.resumeDraftFor}
            loadAuditDetail={flow.loadAuditDetail}
            detailLoading={flow.detailLoading}
            detailError={flow.detailError}
            focusAuditId={focusAuditId}
            onFocusHandled={handleFocusHandled}
          />
        );
    }
  };

  const isStepDone = useCallback(
    (key: string) => {
      switch (key) {
        case 'floor':
          return !!flow.floorName;
        case 'section':
          return !!flow.sectionName;
        case 'audit':
          return !!flow.auditId && flow.questions.length > 0 && flow.liveScore.rated === flow.questions.length;
        case 'photos':
          return flow.visited.includes('photos');
        case 'submit':
          return !!flow.lastSubmitted;
        default:
          return false;
      }
    },
    [
      flow.auditId,
      flow.floorName,
      flow.lastSubmitted,
      flow.liveScore.rated,
      flow.questions.length,
      flow.sectionName,
      flow.visited
    ]
  );

  const submitted = flow.lastSubmitted;

  return (
    <DashboardLayout
      title="Visual Merchandising Checklist"
      subtitle="Store floor styling & display standards audit desk"
      breadcrumbs={[{ label: 'Store Operations' }, { label: 'VM Checklist' }]}
    >
      <PageContainer maxWidth="full">
        <div className="space-y-4">
          {/* View switch: the guided audit, then the two reading views. */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 bg-[#FFFDFC] border border-[#E8D9D4] rounded-2xl p-1 self-start flex-wrap shadow-2xs">
              <ViewTab active={view === 'flow'} onClick={() => setView('flow')} icon={<ClipboardList className="w-3.5 h-3.5" />}>
                Audit flow
              </ViewTab>
              <ViewTab active={view === 'gallery'} onClick={() => setView('gallery')} icon={<Camera className="w-3.5 h-3.5" />}>
                Photo gallery
                {galleryPhotos.length > 0 && (
                  <span
                    className={`ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-black ${
                      view === 'gallery' ? 'bg-white/25 text-white' : 'bg-[#B76E79]/20 text-[#4A173A]'
                    }`}
                  >
                    {galleryPhotos.length}
                  </span>
                )}
              </ViewTab>
              <ViewTab active={view === 'analytics'} onClick={() => setView('analytics')} icon={<BarChart3 className="w-3.5 h-3.5" />}>
                Analytics
              </ViewTab>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#FFFDFC] border border-[#E8D9D4] text-[11px] font-bold text-[#6F5963]">
                <Store className="w-3.5 h-3.5 text-[#B76E79]" />
                <span>{userLocationName || 'All stores I can access'}</span>
              </span>
              {inspectorName && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#FFFDFC] border border-[#E8D9D4] text-[11px] font-bold text-[#6F5963]">
                  <Activity className="w-3.5 h-3.5 text-[#B76E79]" />
                  <span>Auditor: {inspectorName}</span>
                </span>
              )}
              {!canWrite && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#EAF1FA] border border-[#356AE6]/25 text-[11px] font-black text-[#356AE6]">
                  <HistoryIcon className="w-3.5 h-3.5" />
                  <span>View-only VM access</span>
                </span>
              )}
            </div>
          </div>

          {submitted && (
            <div className="flex items-start justify-between gap-3 bg-[#E8F5EE] border border-[#198754]/30 rounded-3xl px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs font-black text-[#198754]">Audit report submitted successfully.</p>
                <p className="text-[11px] font-bold text-[#4A173A] mt-0.5">
                  Filed as {submitted.status} with a {liveScoreDisplay(submitted.score)} compliance score (
                  {submitted.score.passed} pass / {submitted.score.failed} fail / {submitted.score.notApplicable} N/A /{' '}
                  {submitted.score.unrated} unrated).
                </p>
                <p className="text-[11px] font-semibold text-[#6F5963] mt-0.5">
                  The server recomputed this figure from the stored answers — N/A is excluded from the denominator.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => goToHistoryWithAudit(submitted.auditId)}
                  className="px-3 py-1.5 rounded-xl bg-[#198754] hover:bg-[#146c46] text-white text-[11px] font-black transition-colors cursor-pointer"
                >
                  Open record
                </button>
                <button
                  type="button"
                  onClick={flow.dismissSubmitted}
                  aria-label="Dismiss confirmation"
                  className="p-1.5 rounded-xl bg-white border border-[#198754]/25 text-[#198754] hover:bg-[#E8F5EE] transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {view === 'flow' && (
            <>
              <StepIndicator
                steps={VM_FLOW_STEPS}
                current={flow.step}
                isDone={isStepDone}
                isOpenable={(key) => flow.canVisit(key).ok}
                onSelect={flow.goToStep}
                onBack={flow.goBack}
                canGoBack={flow.step !== 'floor'}
                trailing={
                  flow.auditId && flow.step !== 'history' ? (
                    <button
                      type="button"
                      onClick={() => flow.resetFlow('floor')}
                      title="Leave this audit — its draft stays saved — and pick another floor"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[#E8D9D4] bg-white text-[#4A173A] text-[11px] font-black hover:bg-[#FFF7F2] transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#B76E79]" />
                      <span className="hidden sm:inline">New audit</span>
                    </button>
                  ) : null
                }
              />
              <div className="pt-1">{stepBody()}</div>
            </>
          )}

          {view === 'gallery' && (
            <section className="bg-[#FFFDFC] border border-[#E8D9D4] rounded-3xl shadow-sm overflow-hidden">
              {/* Gallery Header */}
              <div className="p-5 sm:p-6 border-b border-[#E8D9D4] bg-gradient-to-r from-[#FFFDFC] via-[#FFF9F6] to-[#FAF5F2] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#4A173A] to-[#6A2853] text-[#FAF6F0] flex items-center justify-center shadow-md shrink-0">
                    <Camera className="w-6 h-6 text-[#E8C7A8]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-black uppercase tracking-wider text-[#B76E79]">
                        Store Visual Merchandising Gallery
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#198754]/10 text-[#198754] border border-[#198754]/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#198754] animate-pulse" />
                        Live Studio
                      </span>
                    </div>
                    <h2 className="text-lg sm:text-xl font-black text-[#4A173A] tracking-tight mt-0.5">
                      Inspection Evidence & Store Exhibits
                    </h2>
                    <p className="text-xs font-semibold text-[#6F5963] mt-0.5">
                      {galleryLoading
                        ? 'Refreshing inspection photos…'
                        : `${galleryPhotos.length} photo${galleryPhotos.length === 1 ? '' : 's'} matching current filters`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => void loadGallery()}
                    disabled={galleryLoading}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E8D9D4] bg-white text-[#4A173A] text-xs font-bold hover:bg-[#FFF7F2] hover:border-[#B76E79]/50 shadow-2xs transition-all disabled:opacity-60 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-[#B76E79] ${galleryLoading ? 'animate-spin' : ''}`} />
                    <span>{galleryLoading ? 'Refreshing…' : 'Refresh Feed'}</span>
                  </button>
                </div>
              </div>

              {/* Filters Station */}
              <div className="p-4 sm:p-5 border-b border-[#E8D9D4] bg-[#FFF9F6]/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5 text-[#B76E79]" />
                    <span className="text-xs font-black uppercase tracking-wider text-[#4A173A]">Filter Evidence</span>
                    {Object.values(galleryFilters).some((v) => v !== '' && v !== 'All') && (
                      <span className="px-2 py-0.5 rounded-full bg-[#B76E79]/15 text-[#4A173A] text-[10px] font-bold border border-[#B76E79]/20">
                        Active Filters
                      </span>
                    )}
                  </div>

                  {/* Quick Date Presets */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#6F5963] mr-1">Quick:</span>
                    {[
                      { label: 'All Dates', value: '' },
                      { label: 'Today', value: new Date().toISOString().split('T')[0] },
                      {
                        label: 'Yesterday',
                        value: new Date(Date.now() - 86400000).toISOString().split('T')[0]
                      }
                    ].map((preset) => {
                      const isActive = galleryFilters.date === preset.value;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setGalleryFilters((p) => ({ ...p, date: preset.value }))}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            isActive
                              ? 'bg-[#4A173A] text-white shadow-xs'
                              : 'bg-white border border-[#E8D9D4] text-[#6F5963] hover:text-[#4A173A] hover:bg-[#FFFDFC]'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {(isAdmin || isManager) && (
                    <label className="block">
                      <span className={GALLERY_LABEL}>
                        <Store className="w-3.5 h-3.5 text-[#B76E79]" />
                        <span>Store Location</span>
                      </span>
                      <select
                        value={galleryFilters.locationId}
                        onChange={(e) => setGalleryFilters((p) => ({ ...p, locationId: e.target.value }))}
                        className={GALLERY_CONTROL}
                      >
                        <option value="">All stores I can see</option>
                        <option value="1">Belagavi</option>
                        <option value="2">Davanagere</option>
                        <option value="3">Shivamogga</option>
                      </select>
                    </label>
                  )}

                  <label className="block">
                    <span className={GALLERY_LABEL}>
                      <Layers className="w-3.5 h-3.5 text-[#B76E79]" />
                      <span>Store Floor</span>
                    </span>
                    <select
                      value={galleryFilters.floor}
                      onChange={(e) => setGalleryFilters((p) => ({ ...p, floor: e.target.value, section: 'All' }))}
                      className={GALLERY_CONTROL}
                    >
                      <option value="All">All floors</option>
                      {flow.floors.map((f) => (
                        <option key={f.name} value={f.name}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className={GALLERY_LABEL}>
                      <Sparkles className="w-3.5 h-3.5 text-[#B76E79]" />
                      <span>Floor Section</span>
                    </span>
                    <select
                      value={galleryFilters.section}
                      onChange={(e) => setGalleryFilters((p) => ({ ...p, section: e.target.value }))}
                      className={GALLERY_CONTROL}
                    >
                      <option value="All">All sections</option>
                      {gallerySectionOptions.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className={GALLERY_LABEL}>
                      <Calendar className="w-3.5 h-3.5 text-[#B76E79]" />
                      <span>Inspection Date</span>
                    </span>
                    <input
                      type="date"
                      value={galleryFilters.date}
                      onChange={(e) => setGalleryFilters((p) => ({ ...p, date: e.target.value }))}
                      className={GALLERY_CONTROL}
                    />
                  </label>

                  <label className="block">
                    <span className={GALLERY_LABEL}>
                      <Clock className="w-3.5 h-3.5 text-[#B76E79]" />
                      <span>Audit Shift</span>
                    </span>
                    <select
                      value={galleryFilters.shift}
                      onChange={(e) => setGalleryFilters((p) => ({ ...p, shift: e.target.value }))}
                      className={GALLERY_CONTROL}
                    >
                      <option value="All">All shifts</option>
                      {VM_SHIFTS.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className={GALLERY_LABEL}>
                      <Award className="w-3.5 h-3.5 text-[#B76E79]" />
                      <span>Audit Score</span>
                    </span>
                    <select
                      value={galleryFilters.minScore}
                      onChange={(e) => setGalleryFilters((p) => ({ ...p, minScore: e.target.value }))}
                      className={GALLERY_CONTROL}
                    >
                      <option value="">Any score</option>
                      <option value="90">90% and above (Pass)</option>
                      <option value="80">80% and above</option>
                      <option value="50">50% and above</option>
                      <option value="below50">Below 50% (Attention)</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className={GALLERY_LABEL}>
                      <User className="w-3.5 h-3.5 text-[#B76E79]" />
                      <span>Inspector</span>
                    </span>
                    <select
                      value={galleryFilters.inspector}
                      onChange={(e) => setGalleryFilters((p) => ({ ...p, inspector: e.target.value }))}
                      className={GALLERY_CONTROL}
                    >
                      <option value="All">All inspectors</option>
                      {inspectorOptions.map((i) => (
                        <option key={i} value={i}>
                          {i}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() =>
                        setGalleryFilters({
                          locationId: '',
                          floor: 'All',
                          section: 'All',
                          date: '',
                          inspector: 'All',
                          shift: 'All',
                          minScore: ''
                        })
                      }
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#E8D9D4] bg-white text-xs font-black uppercase tracking-wider text-[#4A173A] hover:bg-[#FFF7F2] hover:border-[#B76E79] shadow-2xs transition-all cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-[#B76E79]" />
                      <span>Reset Filters</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Photo Exhibition Area */}
              <div className="p-4 sm:p-6">
                {galleryError ? (
                  <div className="py-10 px-6 text-center bg-[#FFFDFC] border border-[#B42318]/30 rounded-3xl max-w-lg mx-auto shadow-xs">
                    <CircleAlert className="w-8 h-8 text-[#B42318] mx-auto mb-3" />
                    <p className="text-sm font-black text-[#4A173A]">Unable to load the photo gallery</p>
                    <p className="text-xs text-[#6F5963] mt-1 break-words">{galleryError}</p>
                    <button
                      type="button"
                      onClick={() => void loadGallery()}
                      className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-[#4A173A] hover:bg-[#6A2853] text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-md"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry Gallery</span>
                    </button>
                  </div>
                ) : galleryLoading && galleryPhotos.length === 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                      <div
                        key={i}
                        className="bg-white border border-[#E8D9D4] rounded-2xl overflow-hidden shadow-xs animate-pulse"
                      >
                        <div className="aspect-[4/3] bg-[#FAF5F2]" />
                        <div className="p-3.5 space-y-2">
                          <div className="h-3.5 bg-[#FAF5F2] rounded-md w-3/4" />
                          <div className="h-3 bg-[#FAF5F2] rounded-md w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : galleryPhotos.length === 0 ? (
                  <div className="py-16 px-6 text-center max-w-md mx-auto">
                    <div className="w-16 h-16 rounded-3xl bg-[#FAF5F2] border border-[#E8D9D4] flex items-center justify-center mx-auto mb-4 text-[#B76E79] shadow-inner">
                      <Camera className="w-8 h-8" />
                    </div>
                    <h3 className="text-base font-black text-[#4A173A]">No inspection photos found</h3>
                    <p className="text-xs text-[#6F5963] mt-1.5 leading-relaxed">
                      No photos match the selected filters. Clear your filters or launch a new audit to capture fresh store floor evidence.
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setGalleryFilters({
                          locationId: '',
                          floor: 'All',
                          section: 'All',
                          date: '',
                          inspector: 'All',
                          shift: 'All',
                          minScore: ''
                        })
                      }
                      className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-[#E8D9D4] hover:bg-[#FFF7F2] text-[#4A173A] text-xs font-bold transition-all cursor-pointer shadow-2xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-[#B76E79]" />
                      <span>Clear All Filters</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {galleryPhotos.map((photo, index) => {
                      const isEvidence = Boolean(photo.pointId);
                      return (
                        <div
                          key={photo.id}
                          className="group relative bg-white border border-[#E8D9D4] hover:border-[#B76E79] rounded-2xl overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col hover:-translate-y-1"
                        >
                          {/* Photo Thumbnail Container */}
                          <div
                            onClick={() => {
                              const items = toLightboxItems(galleryPhotos);
                              setGalleryViewer({ items, index: Math.min(Math.max(index, 0), items.length - 1) });
                            }}
                            className="relative aspect-[4/3] bg-gradient-to-br from-[#20101C] to-[#120810] cursor-pointer overflow-hidden"
                            role="button"
                            tabIndex={0}
                            aria-label={`Inspect photo for ${photo.floor} ${photo.section}`}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                const items = toLightboxItems(galleryPhotos);
                                setGalleryViewer({ items, index: Math.min(Math.max(index, 0), items.length - 1) });
                              }
                            }}
                          >
                            <img
                              src={photoSrc(photo)}
                              alt={`${photo.floor} ${photo.section}`}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />

                            {/* Floating Badges */}
                            <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1 pointer-events-none">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#180f16]/85 backdrop-blur-md border border-white/20 text-white text-[10px] font-black shadow-md truncate max-w-[65%]">
                                <MapPin className="w-3 h-3 text-[#E8C7A8] shrink-0" />
                                <span className="truncate">{photo.floor}</span>
                              </span>

                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border backdrop-blur-md shadow-md ${
                                  isEvidence
                                    ? 'bg-amber-950/80 border-amber-400/40 text-amber-200'
                                    : 'bg-[#4A173A]/80 border-[#B76E79]/40 text-[#FAF6F0]'
                                }`}
                              >
                                {isEvidence ? (
                                  <>
                                    <CheckCircle2 className="w-3 h-3 text-amber-300" />
                                    <span>Checkpoint</span>
                                  </>
                                ) : (
                                  <>
                                    <Layers className="w-3 h-3 text-[#E8C7A8]" />
                                    <span>Section Shot</span>
                                  </>
                                )}
                              </span>
                            </div>

                            {/* Hover Overlay Button */}
                            <div className="absolute inset-0 bg-[#351027]/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center p-4">
                              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#4A173A] text-white text-xs font-black shadow-xl border border-white/20 transform scale-95 group-hover:scale-100 transition-transform duration-200">
                                <Eye className="w-4 h-4 text-[#E8C7A8]" />
                                <span>Inspect Photo</span>
                              </span>
                            </div>
                          </div>

                          {/* Card Body & Details */}
                          <div className="p-3.5 flex-1 flex flex-col justify-between border-t border-[#E8D9D4] bg-[#FFFDFC]">
                            <div>
                              <p className="text-xs font-black text-[#4A173A] truncate" title={`${photo.floor} → ${photo.section}`}>
                                {photo.section}
                              </p>
                              <div className="flex items-center gap-2 text-[11px] font-medium text-[#6F5963] mt-1.5 flex-wrap">
                                <span className="inline-flex items-center gap-1">
                                  <User className="w-3 h-3 text-[#B76E79]" />
                                  <span className="font-bold text-[#4A173A]">{photo.uploadedBy || 'Auditor'}</span>
                                </span>
                                <span>•</span>
                                <span className="inline-flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-[#B76E79]" />
                                  <span>{formatVmDate(photo.inspectionDate || photo.createdAt) || 'Today'}</span>
                                </span>
                              </div>
                            </div>

                            {/* Action footer */}
                            <div className="mt-3 pt-2.5 border-t border-[#F0E4E0] flex items-center justify-between text-[11px]">
                              <span className="text-[10px] font-bold text-[#6F5963] bg-[#FAF5F2] border border-[#E8D9D4] px-2 py-0.5 rounded-md">
                                {formatBytes(photo.fileSize)}
                              </span>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const items = toLightboxItems(galleryPhotos);
                                    setGalleryViewer({ items, index: Math.min(Math.max(index, 0), items.length - 1) });
                                  }}
                                  className="text-[11px] font-bold text-[#4A173A] hover:text-[#B76E79] transition-colors cursor-pointer"
                                >
                                  View
                                </button>

                                {canWrite && (
                                  <>
                                    <span className="text-[#E8D9D4]">|</span>
                                    <button
                                      type="button"
                                      onClick={() => setPhotoToDelete(photo)}
                                      title="Delete this inspection photo"
                                      className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>Delete</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          )}

          {view === 'analytics' && (
            <section className="space-y-4">
              <div className="bg-[#FFFDFC] border border-[#E8D9D4] rounded-3xl p-4 sm:p-5 shadow-xs">
                <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-wider text-[#B76E79] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>VM analytics</span>
                    </p>
                    <h2 className="text-base sm:text-lg font-black text-[#4A173A] tracking-tight mt-0.5">
                      Filed audits, floor by floor
                    </h2>
                    <p className="text-[11px] font-semibold text-[#6F5963] mt-0.5">
                      {analyticsLoading
                        ? 'Loading audits…'
                        : `${analytics.rows.length} filed audit${analytics.rows.length === 1 ? '' : 's'} in view · ${analyticsTotal} total for these filters`}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 flex-wrap">
                    <Metric label="Audits filed" value={String(analytics.rows.length)} icon={<ClipboardList className="w-3.5 h-3.5" />} />
                    <Metric label="Average score" value={scoreDisplay(analytics.averageScore)} icon={<TrendingUp className="w-3.5 h-3.5" />} />
                    <Metric label="Drafts open" value={String(analytics.drafts)} icon={<Activity className="w-3.5 h-3.5" />} />
                    <Metric label="Latest audit" value={formatVmDate(analytics.latest) || '—'} icon={<HistoryIcon className="w-3.5 h-3.5" />} />
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-[#E8D9D4] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                  <label className="block">
                    <span className={GALLERY_LABEL}>Floor</span>
                    <select
                      value={auditFilters.floor}
                      onChange={(e) => setAuditFilters((p) => ({ ...p, floor: e.target.value, section: 'All' }))}
                      className={GALLERY_CONTROL}
                    >
                      <option value="All">All floors</option>
                      {flow.floors.map((f) => (
                        <option key={f.name} value={f.name}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className={GALLERY_LABEL}>Section</span>
                    <select
                      value={auditFilters.section}
                      onChange={(e) => setAuditFilters((p) => ({ ...p, section: e.target.value }))}
                      className={GALLERY_CONTROL}
                    >
                      <option value="All">All sections</option>
                      {analyticsSectionOptions.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className={GALLERY_LABEL}>Status</span>
                    <select
                      value={auditFilters.status}
                      onChange={(e) => setAuditFilters((p) => ({ ...p, status: e.target.value }))}
                      className={GALLERY_CONTROL}
                    >
                      <option value="All">All statuses</option>
                      <option value="Completed">Completed</option>
                      <option value="Review">Review</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className={GALLERY_LABEL}>From</span>
                    <input
                      type="date"
                      value={auditFilters.dateFrom}
                      onChange={(e) => setAuditFilters((p) => ({ ...p, dateFrom: e.target.value }))}
                      className={GALLERY_CONTROL}
                    />
                  </label>
                  <label className="block">
                    <span className={GALLERY_LABEL}>To</span>
                    <input
                      type="date"
                      value={auditFilters.dateTo}
                      onChange={(e) => setAuditFilters((p) => ({ ...p, dateTo: e.target.value }))}
                      className={GALLERY_CONTROL}
                    />
                  </label>
                </div>
              </div>

              {analyticsError ? (
                <div className="bg-[#FFFDFC] border border-[#B42318]/30 rounded-3xl p-6 text-center">
                  <CircleAlert className="w-6 h-6 text-[#B42318] mx-auto mb-2" />
                  <p className="text-sm font-black text-[#4A173A]">Unable to load VM analytics</p>
                  <p className="text-xs text-[#6F5963] mt-1 break-words max-w-lg mx-auto">{analyticsError}</p>
                  <button
                    type="button"
                    onClick={() => void loadAnalytics()}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-[#4A173A] hover:bg-[#6A2853] text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry</span>
                  </button>
                </div>
              ) : analyticsLoading ? (
                <div className="bg-[#FFFDFC] border border-[#E8D9D4] rounded-3xl py-16 text-center">
                  <RefreshCw className="w-5 h-5 animate-spin text-[#B76E79] mx-auto mb-2" />
                  <p className="text-xs font-bold text-[#6F5963]">Loading audits…</p>
                </div>
              ) : analytics.rows.length === 0 ? (
                <div className="bg-[#FFFDFC] border border-[#E8D9D4] rounded-3xl py-12 px-6 text-center">
                  <ClipboardList className="w-8 h-8 text-[#B76E79] mx-auto mb-3" />
                  <p className="text-sm font-black text-[#4A173A]">No completed audits on record yet</p>
                  <p className="text-xs text-[#6F5963] mt-1 max-w-md mx-auto">
                    Charts appear as soon as the first audit is submitted. Nothing is drawn for an empty history — no
                    invented percentages.
                  </p>
                  {analytics.drafts > 0 && (
                    <p className="text-[11px] font-bold text-[#356AE6] mt-2">
                      {analytics.drafts} draft{analytics.drafts === 1 ? ' is' : 's are'} still open — a draft is not a
                      completed inspection.
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <ChartCard title="Average score by floor" hint="Mean of the filed audits on each floor.">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={analytics.floors} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E8D9D4" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6F5963', fontWeight: 700 }} interval={0} height={46} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#6F5963' }} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#FFF7F2' }} />
                        <Bar dataKey="score" name="Avg score" radius={[8, 8, 0, 0]}>
                          {analytics.floors.map((entry) => (
                            <Cell
                              key={entry.name}
                              fill={entry.score >= 80 ? CHART_COLORS.pass : entry.score >= 50 ? CHART_COLORS.review : CHART_COLORS.fail}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard title="Average score by section" hint="Which section needs the most styling attention.">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={analytics.sections.slice(0, 8)} layout="vertical" margin={{ top: 6, right: 12, left: 8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E8D9D4" horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#6F5963' }} />
                        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 9, fill: '#4A173A', fontWeight: 700 }} interval={0} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#FFF7F2' }} />
                        <Bar dataKey="score" name="Avg score" radius={[0, 8, 8, 0]} fill={CHART_COLORS.plum} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard title="Score trend" hint="Average filed score per audit day.">
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={analytics.trend} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E8D9D4" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#6F5963', fontWeight: 700 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#6F5963' }} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Line type="monotone" dataKey="score" name="Avg score" stroke={CHART_COLORS.rose} strokeWidth={2.5} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard title="Audit status mix" hint="Completed versus Review, exactly as the server filed them.">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={analytics.status} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={2} stroke="#FFFDFC">
                          {analytics.status.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Legend wrapperStyle={{ fontSize: 10, fontWeight: 800 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <div className="lg:col-span-2 bg-[#FFFDFC] border border-[#E8D9D4] rounded-3xl p-4 sm:p-5 shadow-xs">
                    <h3 className="text-xs font-black uppercase tracking-wider text-[#4A173A]">
                      Weakest checkpoints (pass rate, N/A excluded)
                    </h3>
                    <p className="text-[11px] font-semibold text-[#6F5963] mt-0.5">
                      Computed from the answers stored on the audits in view — the same denominator the audit score uses.
                    </p>
                    <div className="mt-3 space-y-2">
                      {analytics.questionSeries.length === 0 ? (
                        <p className="text-[11px] font-semibold text-[#6F5963] italic">
                          No graded answers in this slice of history yet.
                        </p>
                      ) : (
                        analytics.questionSeries.slice(0, 8).map((q) => (
                          <div key={q.id} className="flex items-center gap-3">
                            <p className="text-[11px] font-bold text-[#4A173A] w-1/2 shrink-0 truncate" title={q.name}>
                              {q.name}
                            </p>
                            <div className="flex-1 h-2.5 rounded-full bg-[#FFF7F2] border border-[#E8D9D4] overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${q.rate}%`,
                                  backgroundColor: q.rate >= 80 ? CHART_COLORS.pass : q.rate >= 50 ? CHART_COLORS.review : CHART_COLORS.fail
                                }}
                              />
                            </div>
                            <p className="text-[11px] font-black text-[#6F5963] w-12 text-right shrink-0">{q.rate}%</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </PageContainer>

      {galleryViewer && galleryViewer.items.length > 0 && (
        <PhotoLightbox items={galleryViewer.items} startIndex={galleryViewer.index} onClose={() => setGalleryViewer(null)} />
      )}

      {photoToDelete && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-[#180f16]/75 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-label="Delete photo"
          onClick={() => !deletingPhoto && setPhotoToDelete(null)}
        >
          <div className="w-full max-w-sm bg-[#FFFDFC] border border-[#E8D9D4] rounded-3xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3 border border-rose-200 shadow-sm">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-[#4A173A]">Delete Inspection Photo?</h3>
            <p className="text-xs font-semibold text-[#6F5963] mt-1.5 leading-relaxed">
              This photo for <span className="text-[#4A173A] font-bold">{photoToDelete.floor} → {photoToDelete.section}</span> will be permanently removed from the audit record.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setPhotoToDelete(null)}
                disabled={deletingPhoto}
                className="px-4 py-2.5 rounded-xl border border-[#E8D9D4] bg-white text-[#4A173A] text-xs font-bold hover:bg-[#FFF7F2] transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
              >
                Keep Photo
              </button>
              <button
                type="button"
                onClick={() => void confirmDeletePhoto()}
                disabled={deletingPhoto}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#B42318] hover:bg-[#911d14] text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-md"
              >
                {deletingPhoto ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{deletingPhoto ? 'Deleting…' : 'Delete Photo'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

// ── View chrome ─────────────────────────────────────────────────────────────

function ViewTab({
  active,
  onClick,
  icon,
  children
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-xl text-[12px] font-black transition-colors cursor-pointer ${
        active ? 'bg-[#4A173A] text-white shadow-xs' : 'text-[#4A173A] hover:bg-[#FFF7F2]'
      }`}
    >
      <span className={active ? 'text-[#E8C7A8]' : 'text-[#B76E79]'}>{icon}</span>
      <span>{children}</span>
    </button>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="bg-[#FFF7F2] border border-[#E8D9D4] rounded-2xl px-3 py-2 min-w-[120px]">
      <p className="text-[11px] font-black uppercase tracking-wider text-[#6F5963] flex items-center gap-1">
        <span className="text-[#B76E79]">{icon}</span>
        {label}
      </p>
      <p className="text-sm font-black text-[#4A173A] mt-0.5 truncate">{value}</p>
    </div>
  );
}

function ChartCard({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div className="bg-[#FFFDFC] border border-[#E8D9D4] rounded-3xl p-4 sm:p-5 shadow-xs min-w-0">
      <h3 className="text-xs font-black uppercase tracking-wider text-[#4A173A]">{title}</h3>
      <p className="text-[11px] font-semibold text-[#6F5963] mt-0.5 mb-3">{hint}</p>
      <div className="w-full min-w-0">{children}</div>
    </div>
  );
}
