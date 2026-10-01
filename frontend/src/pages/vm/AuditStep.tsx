import { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleMinus,
  ClipboardList,
  Clock,
  CloudUpload,
  MessageSquare,
  RefreshCw,
  Save,
  XCircle
} from 'lucide-react';
import type { VmAuditStatus, VmQuestion, VmScore, VmScoreValue, VmShiftId } from './vmTypes';
import { VM_SHIFTS } from './vmTypes';
import {
  VM_ANSWER_OPTIONS,
  VM_NOTE_FIELDS,
  failNeedsAction,
  formatVmTime,
  questionNumber,
  shiftCaption,
  type VmAnswer,
  type VmAnswerMap,
  type VmNoteField
} from './vmFlowUtils';
import {
  VM_RAISED,
  VmEmptyState,
  VmErrorState,
  VmPill,
  VmProgressBar,
  VmScoreDial,
  VmSectionHeader,
  VmSkeletonCard,
  vmBtnPrimary,
  vmBtnSecondary,
  vmCard,
  vmLabel,
  type VmTone
} from './VmPrimitives';

export type VmSaveState = 'idle' | 'saving' | 'saved' | 'error';

interface AuditStepProps {
  floorName: string;
  sectionName: string;

  shift: VmShiftId;
  onShiftChange: (next: VmShiftId) => void;

  questions: VmQuestion[];
  questionsLoading: boolean;
  questionsError: string | null;
  onRetryQuestions: () => void;

  answers: VmAnswerMap;
  onScoreChange: (pointId: string, score: VmScoreValue) => void;
  onNoteChange: (pointId: string, field: VmNoteField, value: string) => void;

  /** Live preview, computed with the server's own rule (N/A out of the denominator). */
  liveScore: VmScore;
  pendingCount: number;

  auditId: string | null;
  draftLoading: boolean;
  draftError: string | null;
  onRetryDraft: () => void;
  draftResumed: boolean;
  draftStatus: VmAuditStatus | null;
  entryDate: string;

  saveState: VmSaveState;
  savedAt: string | null;
  saveError: string | null;
  isDirty: boolean;
  onSaveNow: () => void;

  canWrite: boolean;
  onNext: () => void;
}

/** Card padding shared by the header blocks, so one surface reads as one panel. */
const PANEL_BLOCK = 'px-4 py-4 sm:px-5 sm:py-5';
const STAT_TILE = 'rounded-2xl border border-[#E1DDD3] bg-[#EDF3F0] px-3.5 py-3';
const NOTE_FIELD_LABEL = 'text-[11px] font-black uppercase tracking-[0.07em] text-[#65716C]';
const OPTIONAL_TAG = 'text-[11px] font-bold uppercase tracking-[0.07em] text-[#C9A45C]';
const CALLOUT = 'flex items-start gap-2 rounded-2xl px-3 py-2.5 text-[12px] font-bold leading-snug';

/** Left rail + pill per outcome: readable from across a shop floor, at a glance. */
const OUTCOME: Record<'Pass' | 'Fail' | 'NA' | 'none', { rail: string; tone: VmTone; label: string }> = {
  Pass: { rail: 'bg-[#198754]', tone: 'positive', label: 'Pass' },
  Fail: { rail: 'bg-[#B42318]', tone: 'danger', label: 'Fail' },
  NA: { rail: 'bg-[#123C35]', tone: 'neutral', label: 'N/A' },
  none: { rail: 'bg-[#EDE4E7]', tone: 'muted', label: 'Not rated' }
};

/** Same `draftStatus` value as before, just coloured. */
const DRAFT_TONE: Record<string, VmTone> = { Draft: 'brand', Review: 'warning', Completed: 'positive' };

const outcomeOf = (score: VmScoreValue | '') => (score === 'Pass' || score === 'Fail' || score === 'NA' ? score : 'none');

/**
 * Step 3 — shift + checkpoint evaluation.
 *
 * Each checkpoint is its own card with three large touch targets and its own
 * Comment / Observation / Corrective action fields, which are saved against that
 * checkpoint (never folded into one general audit note).
 */
export default function AuditStep(props: AuditStepProps) {
  const {
    floorName,
    sectionName,
    shift,
    onShiftChange,
    questions,
    questionsLoading,
    questionsError,
    onRetryQuestions,
    answers,
    onScoreChange,
    onNoteChange,
    liveScore,
    pendingCount,
    auditId,
    draftLoading,
    draftError,
    onRetryDraft,
    draftResumed,
    draftStatus,
    entryDate,
    saveState,
    savedAt,
    saveError,
    isDirty,
    onSaveNow,
    canWrite,
    onNext
  } = props;

  const totalQuestions = questions.length;
  const progressPercent = totalQuestions > 0 ? Math.round((liveScore.rated / totalQuestions) * 100) : 0;
  const failGaps = useMemo(
    () => questions.filter((q) => failNeedsAction(answers[q.id])).length,
    [answers, questions]
  );

  if (questionsLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <VmSectionHeader
          icon={<RefreshCw className="w-5 h-5 animate-spin" />}
          title="Loading audit checklist…"
          subtitle="The checkpoints are being read from the VM checklist."
        />
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <VmSkeletonCard key={i} lines={4} />
          ))}
        </div>
      </div>
    );
  }

  if (questionsError) {
    return (
      <VmErrorState
        title="The audit checklist could not be loaded"
        message={questionsError}
        onRetry={onRetryQuestions}
      />
    );
  }

  if (totalQuestions === 0) {
    return (
      <VmEmptyState
        icon={<ClipboardList className="w-5 h-5" />}
        title="No active checkpoints on the VM checklist"
        hint="Ask a System Administrator to activate the Visual Merchandising checkpoints before an audit can be recorded."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Audit header: title, breadcrumb, live score, shift, draft state ─── */}
      <section className={vmCard('overflow-hidden')}>
        <div className={`${PANEL_BLOCK} border-b border-[#E1DDD3]`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <VmSectionHeader
              className="min-w-0 flex-1"
              icon={<ClipboardList className="w-5 h-5" />}
              title="Visual Merchandising Audit"
              subtitle={
                <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                  <span className="font-black text-[#123C35]">{floorName || '—'}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#C9A45C]" aria-hidden="true" />
                  <span className="font-black text-[#123C35]">{sectionName || '—'}</span>
                  {entryDate && <span>· {entryDate}</span>}
                </span>
              }
            />
            <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
              <VmPill tone="brand" icon={<Clock className="w-3.5 h-3.5" />}>
                {shiftCaption(shift)}
              </VmPill>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className={STAT_TILE}>
              <VmScoreDial
                percent={liveScore.graded > 0 ? liveScore.percent : null}
                label="Live compliance"
                caption="N/A excluded"
                size={76}
              />
              <div className="mt-3">
                <VmProgressBar
                  value={liveScore.rated}
                  total={totalQuestions}
                  tone="brand"
                  label={`${liveScore.rated} of ${totalQuestions} rated · ${progressPercent}% complete`}
                />
                <p className="mt-1.5 text-[12px] font-bold text-[#65716C]">{pendingCount} pending</p>
              </div>
            </div>

            <div className={STAT_TILE}>
              <p className={vmLabel}>Pass · Fail · N/A</p>
              <dl className="mt-2 grid grid-cols-3 gap-2">
                <OutcomeStat label="Pass" value={liveScore.passed} tone="text-[#146B41]" />
                <OutcomeStat label="Fail" value={liveScore.failed} tone="text-[#9B1C15]" />
                <OutcomeStat label="N/A" value={liveScore.notApplicable} tone="text-[#65716C]" />
              </dl>
              <p className={`mt-2.5 text-[12px] font-bold ${failGaps > 0 ? 'text-[#B42318]' : 'text-[#65716C]'}`}>
                {failGaps > 0 ? `${failGaps} Fail need action` : 'all fails explained'}
              </p>
            </div>
          </div>
        </div>

        {/* Shift selector — a shift is a separate audit, so changing it re-enters the draft endpoint. */}
        <div className={`${PANEL_BLOCK} space-y-3`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#65716C]">
              <Clock className="w-4 h-4 text-[#C9A45C]" aria-hidden="true" />
              <span>Audit shift</span>
            </p>
            <SaveIndicator
              saveState={saveState}
              savedAt={savedAt}
              saveError={saveError}
              isDirty={isDirty}
              canWrite={canWrite}
              onSaveNow={onSaveNow}
            />
          </div>

          <div className="grid grid-cols-1 xs:grid-cols-3 gap-2.5">
            {VM_SHIFTS.map((option) => {
              const selected = option.id === shift;
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={!canWrite || draftLoading}
                  onClick={() => onShiftChange(option.id)}
                  aria-pressed={selected}
                  className={`flex min-h-[72px] cursor-pointer items-start gap-2.5 rounded-2xl border px-3 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    selected
                      ? `border-[#123C35] bg-[#123C35] text-white ring-2 ring-[#C9A45C]/45 ${VM_RAISED}`
                      : 'border-[#E1DDD3] bg-white text-[#123C35] hover:border-[#C9A45C] hover:bg-[#EDF3F0]'
                  }`}
                >
                  <span
                    className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                      selected ? 'border-[#E4CB92] bg-[#E4CB92]/20 text-[#E4CB92]' : 'border-[#E1DDD3] bg-[#EDF3F0] text-transparent'
                    }`}
                    aria-hidden="true"
                  >
                    <Check className="w-3.5 h-3.5" strokeWidth={3} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-black leading-tight sm:text-[14px]">{option.label}</span>
                    <span
                      className={`mt-1 block text-[11px] font-bold leading-tight ${
                        selected ? 'text-[#E4CB92]' : 'text-[#65716C]'
                      }`}
                    >
                      {option.hint}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-[12px] font-semibold leading-snug text-[#65716C]">
            {shiftCaption(shift)} is its own audit record. Switching shift opens — or resumes — that shift&rsquo;s draft;
            it never overwrites another shift&rsquo;s audit.
          </p>

          {draftLoading && (
            <p className={`${CALLOUT} border border-[#C9A45C]/40 bg-[#EDF3F0] text-[#123C35]`}>
              <RefreshCw className="mt-px w-4 h-4 shrink-0 animate-spin text-[#C9A45C]" />
              <span>Opening this audit&rsquo;s draft…</span>
            </p>
          )}

          {!draftLoading && draftError && (
            <div className="flex items-start justify-between gap-3 rounded-2xl border border-[#B42318]/30 bg-[#FDE8E7] px-3 py-2.5">
              <span className="flex min-w-0 items-start gap-2 text-[12px] font-bold leading-snug text-[#9B1C15]">
                <CircleAlert className="mt-px w-4 h-4 shrink-0 text-[#B42318]" />
                <span className="break-words">{draftError}</span>
              </span>
              <button
                type="button"
                onClick={onRetryDraft}
                className="inline-flex min-h-[36px] shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-[#B42318]/30 bg-white px-3 text-[12px] font-black text-[#9B1C15] transition-colors hover:bg-[#FDE8E7]"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          )}

          {!draftLoading && !draftError && auditId && (
            <p className="flex flex-wrap items-center gap-2 text-[12px] font-bold text-[#65716C]">
              <VmPill tone={DRAFT_TONE[String(draftStatus || 'Draft')]}>{draftStatus || 'Draft'}</VmPill>
              <span>
                {draftResumed
                  ? 'Resumed from your saved draft — answers and photos came back from the server.'
                  : 'A draft record was created, so nothing is lost if this screen closes.'}
              </span>
            </p>
          )}
        </div>
      </section>

      {/* ── Checkpoints ────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {questions.map((question, index) => (
          <QuestionCard
            key={question.id}
            question={question}
            index={index}
            answer={answers[question.id]}
            disabled={!canWrite || draftLoading || !auditId}
            onScoreChange={onScoreChange}
            onNoteChange={onNoteChange}
          />
        ))}
      </div>

      {/* ── Step footer ────────────────────────────────────────────────────── */}
      <div className={vmCard(`${PANEL_BLOCK} flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center`)}>
        <p className="min-w-0 text-[13px] font-bold leading-snug text-[#65716C]">
          {pendingCount > 0
            ? `${pendingCount} checkpoint${pendingCount === 1 ? '' : 's'} still to rate — every one needs Pass, Fail or N/A before submitting.`
            : failGaps > 0
              ? `All ${totalQuestions} checkpoints rated. ${failGaps} Fail answer${failGaps === 1 ? 's need' : 's need'} a comment or corrective action.`
              : `All ${totalQuestions} checkpoints rated. Add section photos next, then submit.`}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" disabled={!canWrite || !auditId || saveState === 'saving'} onClick={onSaveNow} className={vmBtnSecondary}>
            <Save className="w-4 h-4 text-[#C9A45C]" />
            <span>Save Draft</span>
          </button>
          <button type="button" disabled={!canWrite || !auditId || pendingCount > 0} onClick={onNext} className={vmBtnPrimary}>
            <span>Continue to photos</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Question card ───────────────────────────────────────────────────────────

interface QuestionCardProps {
  question: VmQuestion;
  index: number;
  answer?: VmAnswer;
  disabled: boolean;
  onScoreChange: (pointId: string, score: VmScoreValue) => void;
  onNoteChange: (pointId: string, field: VmNoteField, value: string) => void;
}

function QuestionCard({ question, index, answer, disabled, onScoreChange, onNoteChange }: QuestionCardProps) {
  const current: VmAnswer = answer || { score: '', comment: '', observation: '', correctiveAction: '' };
  const savedNotes = VM_NOTE_FIELDS.filter((f) => current[f.field].trim() !== '').length;
  const needsAction = failNeedsAction(current);
  const noteWithoutScore = !current.score && savedNotes > 0;

  const outcome = OUTCOME[outcomeOf(current.score)];

  const [manualOpen, setManualOpen] = useState<Record<string, boolean>>({});
  // Notes are revealed when they matter: a Fail, or a question that already has notes.
  const open = manualOpen[question.id] ?? (current.score === 'Fail' || savedNotes > 0);

  const toggle = () => setManualOpen((prev) => ({ ...prev, [question.id]: !open }));

  return (
    <div
      className={`${vmCard('relative overflow-hidden p-4 pl-5 transition-colors sm:p-5 sm:pl-6')} ${
        needsAction ? 'ring-1 ring-[#B42318]/40' : ''
      }`}
    >
      {/* Outcome rail: the answer is legible before the auditor reads the text. */}
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${outcome.rail}`} />

      <div className="flex min-w-0 items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#123C35] text-[15px] font-black leading-none text-white">
          {questionNumber(question, index)}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-[15px] font-black leading-[1.55] text-[#17201D]">{question.title}</h3>
          {question.description && (
            <p className="mt-1.5 break-words text-[13px] font-semibold leading-relaxed text-[#65716C]">
              {question.description}
            </p>
          )}
        </div>
        <VmPill tone={outcome.tone} className="mt-0.5">
          {outcome.label}
        </VmPill>
      </div>

      {/* Three large touch targets, never tiny icons. */}
      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-2.5">
        {VM_ANSWER_OPTIONS.map((option) => {
          const selected = current.score === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => onScoreChange(question.id, option.value)}
              className={`flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-2xl border px-2 py-2.5 text-[13px] font-black tracking-wide transition-all disabled:cursor-not-allowed disabled:opacity-60 sm:text-[14px] ${
                selected ? option.selected : option.idle
              }`}
            >
              <AnswerIcon value={option.value} />
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>

      {/* Per-question fields: Comment, Observation, Corrective action. */}
      <div className="mt-3.5">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-between gap-2.5 rounded-2xl border border-[#E1DDD3] bg-[#EDF3F0] px-3.5 py-2.5 text-left text-[13px] font-bold text-[#123C35] transition-colors hover:bg-[#EDF3F0]"
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            <MessageSquare className="w-4 h-4 shrink-0 text-[#C9A45C]" />
            <span className="truncate">Comment · Observation · Corrective action</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-2">
            {needsAction && (
              <VmPill tone="danger" icon={<CircleAlert className="w-3.5 h-3.5" />}>
                Needs action
              </VmPill>
            )}
            {savedNotes > 0 && <VmPill tone="neutral">{savedNotes} saved</VmPill>}
            <ChevronDown className={`w-4 h-4 text-[#C9A45C] transition-transform ${open ? 'rotate-180' : ''}`} />
          </span>
        </button>

        {open && (
          <div className="mt-3 space-y-3">
            {VM_NOTE_FIELDS.map((field) => (
              <div key={field.field}>
                <label
                  htmlFor={`${question.id}-${field.field}`}
                  className="mb-1.5 flex items-center justify-between gap-2"
                >
                  <span className={NOTE_FIELD_LABEL}>
                    {field.label}
                    <span className="ml-1 font-bold normal-case text-[#C9A45C]">(this checkpoint only)</span>
                  </span>
                  {field.field !== 'observation' && <span className={OPTIONAL_TAG}>optional</span>}
                </label>
                <textarea
                  id={`${question.id}-${field.field}`}
                  rows={2}
                  disabled={disabled}
                  value={current[field.field]}
                  onChange={(e) => onNoteChange(question.id, field.field, e.target.value)}
                  placeholder={field.placeholder}
                  className="min-h-[64px] w-full resize-y rounded-2xl border border-[#E1DDD3] bg-white px-3.5 py-2.5 text-[14px] font-semibold leading-relaxed text-[#17201D] transition-colors placeholder:text-[#9A858D] focus:border-[#C9A45C] focus:outline-none focus:ring-2 focus:ring-[#C9A45C]/35 disabled:opacity-60"
                />
              </div>
            ))}

            {needsAction && (
              <p className={`${CALLOUT} border border-[#B42318]/25 bg-[#FDE8E7] text-[#9B1C15]`}>
                <CircleAlert className="mt-px w-4 h-4 shrink-0 text-[#B42318]" />
                <span>Marked Fail: add a Comment or a Corrective action — the server will not file this audit without one.</span>
              </p>
            )}

            {noteWithoutScore && (
              <p className={`${CALLOUT} border border-[#C58A18]/25 bg-[#FFF4D6] text-[#8A5B00]`}>
                <CircleAlert className="mt-px w-4 h-4 shrink-0 text-[#C58A18]" />
                <span>These notes are kept on screen until this checkpoint is rated Pass, Fail or N/A.</span>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Icon stays visible on both idle and selected buttons, so the meaning is not colour-only. */
function AnswerIcon({ value }: { value: VmScoreValue }) {
  if (value === 'Pass') return <Check className="w-4 h-4 shrink-0" strokeWidth={3} />;
  if (value === 'Fail') return <XCircle className="w-4 h-4 shrink-0" />;
  return <CircleMinus className="w-4 h-4 shrink-0" />;
}

// ── Header pieces ───────────────────────────────────────────────────────────

function OutcomeStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="min-w-0">
      <dt className={vmLabel}>{label}</dt>
      <dd className={`mt-1 text-[20px] font-black leading-none ${tone}`}>{value}</dd>
    </div>
  );
}

function SaveIndicator({
  saveState,
  savedAt,
  saveError,
  isDirty,
  canWrite,
  onSaveNow
}: {
  saveState: VmSaveState;
  savedAt: string | null;
  saveError: string | null;
  isDirty: boolean;
  canWrite: boolean;
  onSaveNow: () => void;
}) {
  if (!canWrite) {
    return <span className="text-[12px] font-bold text-[#65716C]">Read-only</span>;
  }
  if (saveState === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#356AE6]">
        <CloudUpload className="w-4 h-4 animate-pulse" />
        <span>Saving…</span>
      </span>
    );
  }
  if (saveState === 'error') {
    return (
      <button
        type="button"
        onClick={onSaveNow}
        className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-xl border border-[#B42318]/30 bg-[#FDE8E7] px-2.5 text-[12px] font-black text-[#9B1C15] transition-colors hover:bg-[#F9D6D4]"
        title={saveError || 'Autosave failed'}
      >
        <RefreshCw className="w-4 h-4" />
        <span>Not saved — retry</span>
      </button>
    );
  }
  if (isDirty) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#C58A18]">
        <Save className="w-4 h-4" />
        <span>Unsaved edits — autosaving</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#198754]">
      <Check className="w-4 h-4" strokeWidth={3} />
      <span>{savedAt ? `Saved${formatVmTime(savedAt) ? ` · ${formatVmTime(savedAt)}` : ''}` : 'Draft ready'}</span>
    </span>
  );
}
