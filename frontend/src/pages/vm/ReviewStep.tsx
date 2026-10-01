import { useMemo, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Info,
  RefreshCw,
  Send,
  X,
  XCircle
} from 'lucide-react';
import PhotoUploader from './PhotoUploader';
import {
  VmPill,
  VmProgressBar,
  VmScoreDial,
  VmSectionHeader,
  scoreTone,
  vmBody,
  vmBtnPrimary,
  vmBtnSecondary,
  vmCard,
  vmLabel,
  vmMeta,
  vmTitle
} from './VmPrimitives';
import type { VmPhoto, VmQuestion, VmScore, VmShiftId } from './vmTypes';
import {
  failNeedsAction,
  formatVmDate,
  liveScoreDisplay,
  questionNumber,
  shiftCaption,
  validateAuditForSubmit,
  type VmAnswerMap,
  type VmSubmitIssue
} from './vmFlowUtils';

interface ReviewStepProps {
  /** Step 4 renders the photo area; step 5 renders the review and submit gate. */
  step: 'photos' | 'submit';

  floorName: string;
  sectionName: string;
  shift: VmShiftId;
  entryDate: string;

  auditId: string | null;
  questions: VmQuestion[];
  answers: VmAnswerMap;
  liveScore: VmScore;
  /** Score the server recomputed on the last draft save, when there is one. */
  serverScore: VmScore | null;

  photos: VmPhoto[];
  photosLoading: boolean;
  onPhotosChanged: (photos: VmPhoto[]) => void;

  submitIssues: VmSubmitIssue[];
  submitting: boolean;
  submitError: string | null;
  onSubmit: () => void;
  /** Step 3, so the auditor can fix an unrated or unexplained checkpoint. */
  onBackToAudit: () => void;
  /** Step 5 from the photo step. */
  onGoToSubmit: () => void;

  canWrite: boolean;
  inspectorName: string;
}

const SECTION_SCOPE = '__section__';

/** One select style for the scope picker, so the photo step matches the filter group. */
const CONTROL_CLASS =
  'w-full min-h-[40px] text-[13px] font-semibold text-[#17201D] bg-white border border-[#E1DDD3] rounded-xl ' +
  'px-3 transition-colors focus:outline-none focus:border-[#C9A45C] focus:ring-2 focus:ring-[#C9A45C]/35';

/**
 * Steps 4 and 5 — photo evidence, then the review-and-submit gate.
 *
 * Uploading is entirely `vm/PhotoUploader`'s job (see its frozen
 * `PhotoUploaderProps` in vmTypes); this component only decides which audit and
 * which scope the shots attach to, and keeps the parent's list in sync.
 */
export default function ReviewStep(props: ReviewStepProps) {
  const {
    step,
    floorName,
    sectionName,
    shift,
    entryDate,
    auditId,
    questions,
    answers,
    liveScore,
    serverScore,
    photos,
    photosLoading,
    onPhotosChanged,
    submitIssues,
    submitting,
    submitError,
    onSubmit,
    onBackToAudit,
    onGoToSubmit,
    canWrite,
    inspectorName
  } = props;

  // ── Hook block ────────────────────────────────────────────────────────────
  // Every hook in this component sits above the `step === 'photos'` early return
  // below. A hook after that return would change the hook count between steps 4
  // and 5 and crash the render ("Rendered more hooks than during the previous
  // render"), so any new hook belongs here and nowhere else.
  const [scope, setScope] = useState<string>(SECTION_SCOPE);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const scopedPhotos = useMemo(() => {
    if (scope === SECTION_SCOPE) return photos.filter((p) => !p.pointId);
    return photos.filter((p) => p.pointId === scope);
  }, [photos, scope]);

  // Validated live, so the gate reflects the answers as they stand — and any issue
  // the server reported (a checkpoint retired mid-audit, for instance) is kept too.
  const issues = useMemo(() => {
    const live = validateAuditForSubmit({ floor: floorName, section: sectionName, shift, questions, answers });
    const carried = submitIssues.filter((i) => !live.some((l) => l.kind === i.kind));
    return [...live, ...carried];
  }, [answers, floorName, questions, sectionName, shift, submitIssues]);

  // ── Derived values (plain arithmetic, no hooks) ───────────────────────────
  const pointIdForUploader = scope === SECTION_SCOPE ? null : scope;
  const sectionShotCount = photos.filter((p) => !p.pointId).length;
  const evidenceCount = photos.length - sectionShotCount;

  const blocking = issues.some((i) => i.kind === 'scope');
  const unrated = issues.find((i) => i.kind === 'unrated');
  const failNotes = issues.find((i) => i.kind === 'fail-action');
  const ready = !unrated && !failNotes && !blocking && !!auditId;
  const shownScore = serverScore || liveScore;
  const openFails = questions.filter((q) => failNeedsAction(answers[q.id]));

  // Nothing is graded yet, so the score is unknown rather than 0% — the dial draws
  // a dash for null, exactly like the dash `liveScoreDisplay` already returns.
  const dialPercent = shownScore.graded > 0 ? shownScore.percent : null;
  const scoreCaption =
    shownScore.graded > 0
      ? `${shownScore.passed} pass of ${shownScore.graded} graded · ${shownScore.notApplicable} N/A excluded`
      : 'No Pass/Fail answer on this audit yet';
  const completionPercent =
    shownScore.totalQuestions > 0
      ? Math.round((shownScore.rated / shownScore.totalQuestions) * 100)
      : null;

  const contextFacts = [
    { label: 'Floor', value: floorName || '—' },
    { label: 'Section', value: sectionName || '—' },
    { label: 'Shift', value: shiftCaption(shift) || '—' },
    { label: 'Entry date', value: formatVmDate(entryDate) || entryDate || '—' },
    { label: 'Inspector', value: inspectorName || '—' },
    { label: 'Checkpoints', value: String(shownScore.totalQuestions) }
  ];

  if (step === 'photos') {
    return (
      <div className="space-y-4">
        <section className={vmCard('p-4 sm:p-5')}>
          <VmSectionHeader
            icon={<Camera className="w-5 h-5" />}
            title="Section photo evidence"
            subtitle="Photograph the section as it stands. The uploader owns capture, progress and saved shots."
            right={<VmPill tone="neutral">{photos.length} photo{photos.length === 1 ? '' : 's'} on this audit</VmPill>}
          />
          <ContextFacts facts={contextFacts} />
        </section>

        <section className={vmCard('p-4 sm:p-5 space-y-4')}>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="min-w-0">
              <h3 className={vmTitle}>Attach this shot to</h3>
              <p className={`${vmMeta} mt-1 max-w-lg leading-snug`}>
                Section-level photos are the default; a checkpoint is for before/after evidence on a specific answer.
              </p>
            </div>
            <label className="block min-w-0 sm:w-[340px]">
              <span className={`${vmLabel} mb-1 block`}>Photo scope</span>
              <select value={scope} onChange={(e) => setScope(e.target.value)} className={CONTROL_CLASS}>
                <option value={SECTION_SCOPE}>Section: {sectionName || '—'}</option>
                {questions.map((q, i) => (
                  <option key={q.id} value={q.id}>
                    Q{questionNumber(q, i)} · {q.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <VmPill tone="neutral" icon={<Camera className="w-3 h-3" />}>
              {sectionShotCount} section photo{sectionShotCount === 1 ? '' : 's'}
            </VmPill>
            <VmPill tone="neutral" icon={<ClipboardList className="w-3 h-3" />}>
              {evidenceCount} checkpoint photo{evidenceCount === 1 ? '' : 's'}
            </VmPill>
            {photosLoading && (
              <VmPill tone="muted" icon={<RefreshCw className="w-3 h-3 animate-spin" />}>
                Loading saved photos…
              </VmPill>
            )}
          </div>

          {/* The uploader owns capture, compression, progress, retry and viewing. */}
          <PhotoUploader
            key={`${auditId || 'no-audit'}::${scope}`}
            auditId={auditId}
            floor={floorName}
            section={sectionName}
            pointId={pointIdForUploader}
            photos={scopedPhotos}
            disabled={!canWrite || !auditId}
            onPhotosChanged={onPhotosChanged}
          />

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-[#E1DDD3] pt-4">
            <p className={`${vmMeta} min-w-0 leading-snug`}>
              {auditId
                ? 'Photos are stored against this draft audit, so they survive a refresh or a logout.'
                : 'The audit draft is not open yet — finish the checklist first.'}
            </p>
            <button type="button" onClick={onGoToSubmit} className={`${vmBtnPrimary} shrink-0`}>
              <span>Review &amp; submit</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      </div>
    );
  }

  // ── Step 5: review + submit ───────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <section className={vmCard('p-4 sm:p-5')}>
        <VmSectionHeader
          icon={<ClipboardList className="w-5 h-5" />}
          title="Review & submit audit report"
          subtitle="The figures below are the ones the server files. Check them against your answers before submitting."
          right={
            <>
              <VmPill tone={ready ? 'positive' : 'warning'}>
                {ready ? 'Ready to submit' : 'Not ready yet'}
              </VmPill>
              <VmPill tone={serverScore ? 'brand' : 'muted'}>
                {serverScore ? 'Score saved on the server' : 'Live preview of your answers'}
              </VmPill>
            </>
          }
        />
        <ContextFacts facts={contextFacts} />
      </section>

      {/* Score summary: dial, Pass/Fail/N-A breakdown and rated-of-total progress. */}
      <section className={vmCard('p-4 sm:p-5 space-y-4')}>
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8">
          <VmScoreDial percent={dialPercent} label="Compliance score" caption={scoreCaption} size={112} />

          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap gap-2">
              <VmPill tone="positive" icon={<CheckCircle2 className="w-3 h-3" />}>
                Pass {shownScore.passed}
              </VmPill>
              <VmPill tone="danger" icon={<XCircle className="w-3 h-3" />}>
                Fail {shownScore.failed}
              </VmPill>
              <VmPill tone="muted">N/A {shownScore.notApplicable}</VmPill>
              <VmPill tone={shownScore.unrated > 0 ? 'warning' : 'muted'}>
                Unrated {shownScore.unrated}
              </VmPill>
              <VmPill tone="neutral" icon={<Camera className="w-3 h-3" />}>
                {photos.length} photo{photos.length === 1 ? '' : 's'}
              </VmPill>
            </div>

            <VmProgressBar
              value={shownScore.rated}
              total={shownScore.totalQuestions}
              tone={scoreTone(completionPercent)}
              label={`Rated ${shownScore.rated} of ${shownScore.totalQuestions} checkpoints`}
            />

            <p className={vmMeta}>
              {sectionShotCount} section photo{sectionShotCount === 1 ? '' : 's'} · {evidenceCount} checkpoint
              photo{evidenceCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        <p className="flex items-start gap-2 rounded-xl bg-[#EDF3F0] border border-[#E1DDD3] px-3 py-2.5 text-[12px] font-semibold leading-relaxed text-[#65716C]">
          <Info className="w-4 h-4 shrink-0 mt-px text-[#C9A45C]" />
          <span>
            Compliance score = Pass ÷ (Pass + Fail). N/A checkpoints leave the denominator and unrated ones are
            listed below, so the figure the server files can be checked against these numbers.
          </span>
        </p>
      </section>

      {/* Validation gate — mirrors the server's own submit checks. */}
      <section className={vmCard('p-4 sm:p-5 space-y-3')}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            <h3 className={vmTitle}>Before submitting</h3>
            <p className={`${vmMeta} mt-1`}>
              These are the same checks the submit endpoint runs, so a green line here is a line the server accepts.
            </p>
          </div>
          <VmPill tone={ready ? 'positive' : 'warning'}>
            {ready ? 'All checks passed' : 'Items need attention'}
          </VmPill>
        </div>

        <ul className="divide-y divide-[#E1DDD3] rounded-xl border border-[#E1DDD3] bg-white">
          <RequirementRow ok={!blocking && !!floorName && !!sectionName && !!shift} label="Floor, section and shift chosen" />
          <RequirementRow
            ok={!unrated}
            label={`Every checkpoint rated (${liveScore.rated} of ${liveScore.totalQuestions})`}
            detail={unrated?.message}
            fix={{ label: 'Back to checklist', onClick: onBackToAudit }}
          />
          <RequirementRow
            ok={!failNotes}
            label={`Every Fail carries a comment or corrective action (${openFails.length} open)`}
            detail={failNotes?.message}
            fix={{ label: 'Back to checklist', onClick: onBackToAudit }}
          />
          <RequirementRow
            ok={!!auditId}
            label="Draft audit is open on the server"
            detail={auditId ? `Audit ${auditId}` : 'Open the checklist to create the draft record.'}
          />
        </ul>

        {photos.length === 0 && (
          <p className="flex items-start gap-2 rounded-xl bg-[#FFF4D6] border border-[#C58A18]/25 px-3 py-2.5 text-[12px] font-bold leading-snug text-[#8A5B00]">
            <Camera className="w-4 h-4 shrink-0 mt-px" />
            <span>
              No photos attached. A completed inspection is expected to show the section — go back to the photo step if
              the floor was changed today.
            </span>
          </p>
        )}

        {submitError && (
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-[#FDE8E7] border border-[#B42318]/30 px-3 py-2.5">
            <span className="flex items-start gap-2 text-[12px] font-bold text-[#9B1C15] min-w-0">
              <CircleAlert className="w-4 h-4 shrink-0 mt-px" />
              <span className="break-words">{submitError}</span>
            </span>
            <button
              type="button"
              onClick={() => onSubmit()}
              disabled={submitting || !ready}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-[#B42318] px-3 py-2 text-[12px] font-bold text-white transition-colors hover:bg-[#8f1c14] disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-[#E1DDD3] pt-4">
          <button type="button" onClick={onBackToAudit} className={vmBtnSecondary}>
            <ChevronLeft className="w-4 h-4 text-[#C9A45C]" />
            <span>Back to the checklist</span>
          </button>

          <button type="button" disabled={!canWrite || !ready || submitting} onClick={() => setConfirmOpen(true)} className={vmBtnPrimary}>
            {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 text-[#E4CB92]" />}
            <span>{submitting ? 'Submitting report…' : 'Submit Audit Report'}</span>
          </button>
        </div>

        {!canWrite && (
          <p className={`${vmMeta} leading-snug`}>
            Your VM access is view-only, so submitting is disabled. The backend enforces the same rule.
          </p>
        )}
      </section>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#351027]/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vm-submit-confirm-title"
          onClick={() => !submitting && setConfirmOpen(false)}
        >
          <div
            className="w-full max-w-md bg-[#FFFFFF] border border-[#E1DDD3] rounded-2xl shadow-xl p-5 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FFF4D6] border border-[#C58A18]/25">
                <Send className="w-5 h-5 text-[#C58A18]" />
              </span>
              <div className="min-w-0">
                <h3 id="vm-submit-confirm-title" className="text-[16px] font-black leading-snug text-[#123C35]">
                  Are you sure you want to submit this audit?
                </h3>
                <p className={`${vmMeta} mt-1 leading-snug`}>
                  {floorName} → {sectionName} · {shiftCaption(shift)}. Once filed, the record is read-only: submitted
                  audits are never overwritten.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <DialogStat label="Compliance" value={liveScoreDisplay(shownScore)} tone="neutral" />
              <DialogStat label="Pass" value={String(shownScore.passed)} tone="positive" />
              <DialogStat label="Fail" value={String(shownScore.failed)} tone="danger" />
            </div>

            <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={submitting}
                className={vmBtnSecondary}
              >
                <X className="w-4 h-4 text-[#C9A45C]" />
                <span>Cancel</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmOpen(false);
                  void onSubmit();
                }}
                disabled={submitting}
                className={vmBtnPrimary}
              >
                {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 text-[#E4CB92]" />}
                <span>{submitting ? 'Submitting…' : 'Yes, submit this audit'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Bits ────────────────────────────────────────────────────────────────────

/** Floor → section → shift → date band: the same facts on both steps, at a readable size. */
function ContextFacts({ facts }: { facts: { label: string; value: string }[] }) {
  return (
    <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-[#E1DDD3] pt-4 md:grid-cols-3 xl:grid-cols-6">
      {facts.map((fact) => (
        <div key={fact.label} className="min-w-0">
          <dt className={vmLabel}>{fact.label}</dt>
          <dd className={`${vmBody} mt-1 truncate`} title={fact.value}>
            {fact.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function RequirementRow({
  ok,
  label,
  detail,
  fix
}: {
  ok: boolean;
  label: string;
  detail?: string;
  fix?: { label: string; onClick: () => void };
}) {
  return (
    <li className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3 py-3 ${ok ? 'bg-[#E8F5EE]/50' : 'bg-[#FFF4D6]/50'}`}>
      <span className="flex items-start gap-2.5 min-w-0">
        {ok ? (
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#198754]" />
        ) : (
          <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#C58A18]" />
        )}
        <span className="min-w-0">
          <span className={`block text-[13px] font-bold ${ok ? 'text-[#146B41]' : 'text-[#17201D]'}`}>{label}</span>
          {!ok && detail && (
            <span className={`${vmMeta} mt-0.5 block break-words leading-snug`}>{detail}</span>
          )}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <VmPill tone={ok ? 'positive' : 'warning'}>{ok ? 'Ready' : 'Action needed'}</VmPill>
        {!ok && fix && (
          <button type="button" onClick={fix.onClick} className={vmBtnSecondary}>
            {fix.label}
          </button>
        )}
      </span>
    </li>
  );
}

function DialogStat({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: 'neutral' | 'positive' | 'danger';
}) {
  const tones: Record<'neutral' | 'positive' | 'danger', string> = {
    neutral: 'bg-[#EDF3F0] text-[#123C35] border-[#E1DDD3]',
    positive: 'bg-[#E8F5EE] text-[#146B41] border-[#198754]/25',
    danger: 'bg-[#FDE8E7] text-[#9B1C15] border-[#B42318]/25'
  };
  return (
    <div className={`rounded-xl border px-3 py-2 min-w-0 ${tones[tone]}`}>
      <p className={vmLabel}>{label}</p>
      <p className="mt-0.5 text-[15px] font-black leading-none">{value}</p>
    </div>
  );
}
