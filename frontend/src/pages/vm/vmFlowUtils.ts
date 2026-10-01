/**
 * VM guided-audit flow helpers.
 *
 * Pure functions only (no React, no state) so the step components and the flow
 * hook can share one implementation of the scoring rule, the payload mapping and
 * the formatting used by every step.
 *
 * Every shape here is the one described in `vmTypes.ts`, which mirrors
 * `backend/src/controllers/vmController.js`. Nothing is invented: the question
 * list, checkpoint counts, scores and audit rows all come from the server.
 */

import { API } from '../../services/api';
import type { LightboxPhotoItem } from './photoUtils';
import {
  VM_SHIFTS,
  type VmAuditEntry,
  type VmAuditStatus,
  type VmFloorSummary,
  type VmPhoto,
  type VmQuestion,
  type VmScore,
  type VmScoreValue
} from './vmTypes';

// ── Step machine ────────────────────────────────────────────────────────────

export type VmStepKey = 'floor' | 'section' | 'audit' | 'photos' | 'submit' | 'history';

/** The order the guided flow walks through; `history` is the landing place after submit. */
export const VM_STEP_ORDER: VmStepKey[] = ['floor', 'section', 'audit', 'photos', 'submit', 'history'];

export interface VmStepDescriptor {
  key: VmStepKey;
  label: string;
  caption: string;
}

export const VM_STEP_DESCRIPTORS: VmStepDescriptor[] = [
  { key: 'floor', label: 'Floor', caption: 'Choose the store floor' },
  { key: 'section', label: 'Section', caption: 'Choose the section' },
  { key: 'audit', label: 'Audit', caption: 'Shift + checkpoints' },
  { key: 'photos', label: 'Photos', caption: 'Section evidence' },
  { key: 'submit', label: 'Submit', caption: 'Review and file' },
  { key: 'history', label: 'History', caption: 'Saved audits' }
];

export function stepIndex(key: VmStepKey): number {
  const i = VM_STEP_ORDER.indexOf(key);
  return i < 0 ? 0 : i;
}

/** The five numbered steps; History is reached from the flow rather than numbered. */
export const VM_FLOW_STEPS: VmStepDescriptor[] = VM_STEP_DESCRIPTORS.filter((s) => s.key !== 'history');

/** Debounce windows: answers autosave, filters refetch. */
export const VM_AUTOSAVE_DEBOUNCE_MS = 1200;
export const VM_FILTER_DEBOUNCE_MS = 350;

// ── Answers ─────────────────────────────────────────────────────────────────

export interface VmAnswer {
  score: VmScoreValue | '';
  comment: string;
  observation: string;
  correctiveAction: string;
}

export type VmAnswerMap = Record<string, VmAnswer>;

export const EMPTY_VM_ANSWER: VmAnswer = { score: '', comment: '', observation: '', correctiveAction: '' };

export type VmNoteField = 'comment' | 'observation' | 'correctiveAction';

export const VM_NOTE_FIELDS: { field: VmNoteField; label: string; placeholder: string }[] = [
  { field: 'comment', label: 'Comment', placeholder: 'What was observed on the floor for this checkpoint…' },
  { field: 'observation', label: 'Observation', placeholder: 'Fact recorded during the walkthrough (optional)…' },
  { field: 'correctiveAction', label: 'Corrective action', placeholder: 'Who is fixing it and by when…' }
];

export const VM_ANSWER_OPTIONS: {
  value: VmScoreValue;
  label: string;
  selected: string;
  idle: string;
}[] = [
  {
    value: 'Pass',
    label: 'PASS',
    selected: 'bg-[#198754] text-white border-[#198754] ring-2 ring-[#198754]/30 shadow-sm',
    idle: 'bg-[#FFFFFF] text-[#123C35] border-[#E1DDD3] hover:border-[#198754]/60 hover:bg-[#E8F5EE]'
  },
  {
    value: 'Fail',
    label: 'FAIL',
    selected: 'bg-[#B42318] text-white border-[#B42318] ring-2 ring-[#B42318]/30 shadow-sm',
    idle: 'bg-[#FFFFFF] text-[#123C35] border-[#E1DDD3] hover:border-[#B42318]/60 hover:bg-[#FDE8E7]'
  },
  {
    value: 'NA',
    label: 'N/A',
    selected: 'bg-[#123C35] text-white border-[#123C35] ring-2 ring-[#123C35]/25 shadow-sm',
    idle: 'bg-[#FFFFFF] text-[#123C35] border-[#E1DDD3] hover:border-[#123C35]/50 hover:bg-[#EDF3F0]'
  }
];

/** Stored answers back into the editable map, keyed by checkpoint id. */
export function answersFromEntries(entries?: VmAuditEntry[] | null): VmAnswerMap {
  const map: VmAnswerMap = {};
  (entries || []).forEach((e) => {
    const id = String(e?.pointId || '');
    if (!id) return;
    map[id] = {
      score: normaliseScore(e.score),
      comment: String(e.comment ?? ''),
      observation: String(e.observation ?? ''),
      correctiveAction: String(e.correctiveAction ?? '')
    };
  });
  return map;
}

/** Any server answer value into the UI value (unanswered stays empty, never 'Pass'). */
export function normaliseScore(raw: unknown): VmScoreValue | '' {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'pass') return 'Pass';
  if (v === 'fail' || v === 'failed') return 'Fail';
  if (v === 'na' || v === 'n/a' || v === 'n.a' || v === 'not applicable') return 'NA';
  return '';
}

/**
 * Autosave payload — only checkpoints that actually carry an answer.
 *
 * The server rejects an entry whose score is not Pass/Fail/NA
 * (`rejectBadEntries`), so an untouched checkpoint is simply absent rather than
 * sent with a fake default. This is also why the old page's silent
 * `score: scores[p.id]?.score || 'Pass'` default cannot be reused here.
 */
export function buildDraftEntries(questions: VmQuestion[], answers: VmAnswerMap): VmAuditEntry[] {
  const entries: VmAuditEntry[] = [];
  questions.forEach((q) => {
    const a = answers[q.id];
    if (!a || !a.score) return;
    entries.push({
      pointId: q.id,
      pointTitle: q.title,
      score: a.score,
      comment: a.comment.trim(),
      observation: a.observation.trim(),
      correctiveAction: a.correctiveAction.trim()
    });
  });
  return entries;
}

/** Cheap stable key for "did anything the user can edit actually change". */
export function answerSignature(answers: VmAnswerMap): string {
  return Object.keys(answers)
    .sort()
    .map((id) => {
      const a = answers[id];
      return `${id}:${a.score}|${a.comment}|${a.observation}|${a.correctiveAction}`;
    })
    .join(';');
}

// ── Scoring ─────────────────────────────────────────────────────────────────

export interface VmScoreParts {
  passed: number;
  failed: number;
  na: number;
  totalQuestions: number;
}

/**
 * THE scoring rule, identical to `buildScore()` in vmController.js:
 *
 *   graded = Pass + Fail                    (N/A leaves the denominator entirely)
 *   percent = round(Pass / graded * 100)    (0 when nothing is graded yet)
 *   rated   = graded + N/A
 *   unrated = totalQuestions - rated        (never touched by the auditor)
 *
 * Nothing here is a literal target score: 100/92/80 never appear as a computed
 * result. `totalQuestions` comes from the active checkpoint list, so adding or
 * retiring a checkpoint changes the maths without a UI change.
 */
export function buildScore({ passed, failed, na, totalQuestions }: VmScoreParts): VmScore {
  const graded = passed + failed;
  const rated = graded + na;
  const total = Number(totalQuestions) || 0;
  return {
    percent: graded > 0 ? Math.round((passed / graded) * 100) : 0,
    passed,
    failed,
    notApplicable: na,
    unrated: Math.max(0, total - rated),
    totalQuestions: total,
    rated,
    graded
  };
}

/** Live preview of the compliance score while the auditor is still answering. */
export function computeVmScore(questions: VmQuestion[], answers: VmAnswerMap): VmScore {
  let passed = 0;
  let failed = 0;
  let na = 0;
  questions.forEach((q) => {
    const s = answers[q.id]?.score;
    if (s === 'Pass') passed += 1;
    else if (s === 'Fail') failed += 1;
    else if (s === 'NA') na += 1;
  });
  return buildScore({ passed, failed, na, totalQuestions: questions.length });
}

export const EMPTY_VM_SCORE: VmScore = {
  percent: 0,
  passed: 0,
  failed: 0,
  notApplicable: 0,
  unrated: 0,
  totalQuestions: 0,
  rated: 0,
  graded: 0
};

/** A score with nothing graded yet is unknown, not 0% — so it renders as a dash. */
export function scoreDisplay(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return `${Math.round(Number(value))}%`;
}

/** Preview text for the live header: dash until the first Pass/Fail exists. */
export function liveScoreDisplay(score: VmScore): string {
  return score.graded > 0 ? `${score.percent}%` : '—';
}

export function scoreBadgeClasses(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return 'bg-[#EDF3F0] text-[#65716C] border-[#E1DDD3]';
  }
  const n = Number(value);
  if (n >= 80) return 'bg-[#E8F5EE] text-[#198754] border-[#198754]/25';
  if (n >= 50) return 'bg-[#FFF4D6] text-[#C58A18] border-[#C58A18]/25';
  return 'bg-[#FDE8E7] text-[#B42318] border-[#B42318]/25';
}

export function statusBadgeClasses(status?: string | null): string {
  const s = String(status || '').toLowerCase();
  if (s === 'draft') return 'bg-[#EAF1FA] text-[#356AE6] border-[#356AE6]/25';
  if (s === 'review') return 'bg-[#FFF4D6] text-[#C58A18] border-[#C58A18]/25';
  if (s === 'completed') return 'bg-[#E8F5EE] text-[#198754] border-[#198754]/25';
  return 'bg-[#EDF3F0] text-[#65716C] border-[#E1DDD3]';
}

// ── Submit validation ───────────────────────────────────────────────────────

export interface VmSubmitIssue {
  kind: 'scope' | 'unrated' | 'fail-action';
  message: string;
  pointIds: string[];
}

/** Fail requires a comment or a corrective action; a bare observation is not a follow-up. */
export function failNeedsAction(answer?: VmAnswer): boolean {
  if (!answer || answer.score !== 'Fail') return false;
  return !(answer.comment.trim() || answer.correctiveAction.trim());
}

export function questionNumber(question: VmQuestion, index: number): number {
  const p = Number(question.position);
  return Number.isFinite(p) && p > 0 ? p : index + 1;
}

/**
 * Client-side mirror of the server's submit gate, so the auditor sees the problem
 * before the round-trip. The server still re-checks everything.
 */
export function validateAuditForSubmit(input: {
  floor?: string | null;
  section?: string | null;
  shift?: string | null;
  questions: VmQuestion[];
  answers: VmAnswerMap;
}): VmSubmitIssue[] {
  const issues: VmSubmitIssue[] = [];
  const missing: string[] = [];
  if (!String(input.floor || '').trim()) missing.push('floor');
  if (!String(input.section || '').trim()) missing.push('section');
  if (!String(input.shift || '').trim()) missing.push('shift');
  if (missing.length > 0) {
    issues.push({
      kind: 'scope',
      message: `Choose the ${missing.join(' and ')} before submitting this audit.`,
      pointIds: []
    });
  }

  const unrated = input.questions.filter((q) => !input.answers[q.id]?.score);
  if (unrated.length > 0) {
    const preview = unrated
      .slice(0, 3)
      .map((q) => `Q${questionNumber(q, input.questions.indexOf(q))} ${q.title}`)
      .join('; ');
    issues.push({
      kind: 'unrated',
      message:
        `${unrated.length} of ${input.questions.length} checkpoints are unanswered: ${preview}` +
        (unrated.length > 3 ? ' …' : ''),
      pointIds: unrated.map((q) => q.id)
    });
  }

  const openFails = input.questions.filter((q) => failNeedsAction(input.answers[q.id]));
  if (openFails.length > 0) {
    const preview = openFails.slice(0, 3).map((q) => q.title).join('; ');
    issues.push({
      kind: 'fail-action',
      message:
        `${openFails.length} failed checkpoint(s) need a corrective action or a comment before this audit can be filed: ${preview}` +
        (openFails.length > 3 ? ' …' : ''),
      pointIds: openFails.map((q) => q.id)
    });
  }

  return issues;
}

// ── Server payload mapping ──────────────────────────────────────────────────

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toStr(value: unknown, fallback = ''): string {
  return value === null || value === undefined || value === '' ? fallback : String(value);
}

function toNum(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toOptNum(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** GET /vm/points → VmQuestion[] (raw `vmchecklistpoints` rows, checklist order). */
export function mapQuestions(payload: unknown): VmQuestion[] {
  const rows = asList(asRecord(payload).points);
  return rows
    .map((raw) => {
      const r = asRecord(raw);
      return {
        id: toStr(r.id),
        title: toStr(r.title),
        description: r.description === undefined ? null : toStr(r.description, '') || null,
        position: toNum(r.position, 0)
      } satisfies VmQuestion;
    })
    .filter((q) => q.id && q.title)
    .sort((a, b) => (a.position || 0) - (b.position || 0));
}

/** GET /vm/floor-summary → the step 1 cards, exactly as the server computed them. */
export function mapFloorSummary(payload: unknown): {
  floors: VmFloorSummary[];
  today: string;
  totalQuestions: number;
} {
  const res = asRecord(payload);
  const floors = asList(res.floors).map((raw) => {
    const f = asRecord(raw);
    const sections = asList(f.sections).map((s) => String(s));
    return {
      name: toStr(f.name),
      description: toStr(f.description, ''),
      sections,
      sectionCount: toNum(f.sectionCount, sections.length),
      totalAudits: toNum(f.totalAudits, 0),
      lastAuditDate: f.lastAuditDate === null || f.lastAuditDate === undefined ? null : toStr(f.lastAuditDate),
      lastScore: toOptNum(f.lastScore),
      hasDraft: Boolean(f.hasDraft),
      draftSections: asList(f.draftSections).map((s) => String(s)),
      unauditedSections: asList(f.unauditedSections).map((s) => String(s))
    } satisfies VmFloorSummary;
  });
  return {
    floors: floors.filter((f) => f.name),
    today: toStr(res.today, ''),
    totalQuestions: toNum(res.totalQuestions, 0)
  };
}

/** POST /vm/audits/draft + PUT …/draft + POST …/submit share this envelope. */
export function mapDraftResponse(payload: unknown) {
  const res = asRecord(payload);
  return {
    success: res.success !== false,
    auditId: toStr(res.auditId, ''),
    status: toStr(res.status, 'Draft') as VmAuditStatus,
    floor: toStr(res.floor, ''),
    section: toStr(res.section, ''),
    shift: toStr(res.shift, 'Opening'),
    entryDate: toStr(res.entryDate, ''),
    resumed: Boolean(res.resumed),
    entries: asList(res.entries).map(mapEntry),
    photos: asList(res.photos).map(mapPhoto),
    score: mapScore(res.score)
  };
}

export function mapScore(raw: unknown): VmScore {
  const s = asRecord(raw);
  const passed = toNum(s.passed, 0);
  const failed = toNum(s.failed, 0);
  const na = toNum(s.notApplicable, 0);
  const total = toNum(s.totalQuestions, 0);
  // Recomputed with the same rule instead of trusting `percent`, so a server that
  // ever stores a legacy value cannot make the header disagree with the buttons.
  const built = buildScore({ passed, failed, na, totalQuestions: total });
  const percent = toOptNum(s.percent);
  return { ...built, percent: percent === null ? built.percent : Math.round(percent) };
}

export function mapEntry(raw: unknown): VmAuditEntry {
  const e = asRecord(raw);
  return {
    pointId: toStr(e.pointId || e.id),
    pointTitle: toStr(e.pointTitle || e.title),
    score: (normaliseScore(e.score) || String(e.score ?? '')) as VmScoreValue,
    comment: toStr(e.comment ?? e.remarks ?? '', ''),
    observation: toStr(e.observation, ''),
    correctiveAction: toStr(e.correctiveAction ?? e.corrective_action, '')
  };
}

export function mapPhoto(raw: unknown): VmPhoto {
  const p = asRecord(raw);
  const id = toStr(p.id);
  return {
    id,
    submissionId: p.submissionId === undefined || p.submissionId === null ? null : toStr(p.submissionId),
    locationId: (() => {
      const rawLoc = p.locationId !== undefined && p.locationId !== null ? p.locationId : (p.location_id !== undefined ? p.location_id : null);
      return typeof rawLoc === 'string' || typeof rawLoc === 'number' ? rawLoc : null;
    })(),
    locationName: toStr(p.locationName ?? p.location_name, '') || null,
    floor: toStr(p.floor, ''),
    section: toStr(p.section, ''),
    pointId: p.pointId === undefined || p.pointId === null ? null : toStr(p.pointId),
    fileName: toStr(p.fileName ?? p.original_name, 'photo'),
    fileSize: toNum(p.fileSize, 0),
    mimeType: p.mimeType === undefined || p.mimeType === null ? null : toStr(p.mimeType),
    uploadedBy: p.uploadedBy === undefined || p.uploadedBy === null ? null : toStr(p.uploadedBy),
    inspectionDate: p.inspectionDate === undefined || p.inspectionDate === null ? null : toStr(p.inspectionDate),
    createdAt: p.createdAt === undefined || p.createdAt === null ? null : toStr(p.createdAt),
    url: toStr(p.url) || API.getVmPhotoFileUrl(id)
  };
}

export function mapAuditListItem(raw: unknown) {
  const a = asRecord(raw);
  return {
    id: toStr(a.id),
    entryDate: toStr(a.entryDate, ''),
    shift: toStr(a.shift, 'Opening'),
    floor: toStr(a.floor, ''),
    section: toStr(a.section, ''),
    scorePercent: toNum(a.scorePercent, 0),
    status: toStr(a.status, 'Completed') as VmAuditStatus,
    submittedBy: toStr(a.submittedBy, ''),
    passedCount: toNum(a.passedCount ?? a.passed_count, 0),
    failedCount: toNum(a.failedCount ?? a.failed_count, 0),
    naCount: toNum(a.naCount ?? a.na_count, 0),
    unratedCount: toNum(a.unratedCount ?? a.unrated_count, 0),
    totalQuestions: toNum(a.totalQuestions ?? a.total_questions, 0),
    photoCount: toNum(a.photoCount, 0),
    createdAt: a.createdAt === undefined || a.createdAt === null ? null : toStr(a.createdAt),
    submittedAt: a.submittedAt === undefined || a.submittedAt === null ? null : toStr(a.submittedAt),
    locationId: toOptNum(a.locationId ?? a.location_id),
    locationName: a.locationName === undefined || a.locationName === null ? null : toStr(a.locationName),
    remarks: toStr(a.remarks, ''),
    entries: asList(a.entries).map(mapEntry),
    photos: asList(a.photos).map(mapPhoto)
  };
}

export type VmMappedAuditListItem = ReturnType<typeof mapAuditListItem>;

/** GET /vm/audits → page of typed history rows (raw row + camelCase mirrors). */
export function mapAuditList(payload: unknown): {
  audits: VmMappedAuditListItem[];
  total: number;
  page: number;
  totalPages: number;
} {
  const res = asRecord(payload);
  return {
    audits: asList(res.audits).map(mapAuditListItem).filter((a) => a.id),
    total: toNum(res.total, 0),
    page: toNum(res.page, 1),
    totalPages: toNum(res.totalPages, 1)
  };
}

/**
 * GET /vm/audits/:id → the complete saved audit.
 *
 * The detail envelope nests the record under `audit` and adds a recomputed
 * `score`, so the history modal shows the server's own figures.
 */
export function mapAuditDetail(payload: unknown): VmMappedAuditDetail | null {
  const audit = asRecord(asRecord(payload).audit);
  if (Object.keys(audit).length === 0) return null;
  return {
    ...mapAuditListItem(audit),
    score: mapScore(audit.score)
  };
}

export interface VmMappedAuditDetail extends VmMappedAuditListItem {
  score: VmScore;
}

export function mapAttention(payload: unknown) {
  const res = asRecord(payload);
  return {
    success: res.success !== false,
    auditsConsidered: toNum(res.auditsConsidered, 0),
    lowestQuestions: asList(res.lowestQuestions).map((raw) => {
      const q = asRecord(raw);
      return {
        pointId: toStr(q.pointId),
        pointTitle: toStr(q.pointTitle, toStr(q.pointId)),
        // The server sends null when nothing is graded; that is "no data", not 0%.
        passRate: toOptNum(q.passRate),
        passed: toNum(q.passed, 0),
        failed: toNum(q.failed, 0),
        notApplicable: toNum(q.notApplicable, 0),
        audits: toNum(q.audits, 0)
      };
    }),
    lowestSections: asList(res.lowestSections).map((raw) => {
      const s = asRecord(raw);
      return {
        floor: toStr(s.floor, ''),
        section: toStr(s.section, ''),
        passRate: toOptNum(s.passRate),
        audits: toNum(s.audits, 0),
        avgScore: toOptNum(s.avgScore)
      };
    })
  };
}

export type VmAttentionMapped = ReturnType<typeof mapAttention>;

// ── Dates & labels ──────────────────────────────────────────────────────────

const VM_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * `vmsubmissions` dates arrive as server-side strings already resolved in
 * Asia/Kolkata (`dateStrings: true`, +05:30 session). Re-serialising them through
 * `new Date().toISOString()` moves anything before 05:30 back a day, so the digits
 * are read straight off the string instead.
 */
export function splitVmStamp(value?: string | null): { date: string; time: string } | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    return {
      date: `${m[1]}-${m[2]}-${m[3]}`,
      time: m[4] && m[5] ? `${m[4]}:${m[5]}` : ''
    };
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`
  };
}

/** '2026-09-30' → '30 Sep 2026'; missing data yields '' so the caller can dash it. */
export function formatVmDate(value?: string | null): string {
  const parts = splitVmStamp(value);
  if (!parts) return '';
  const [y, m, d] = parts.date.split('-');
  const month = VM_MONTHS[Number(m) - 1];
  if (!month) return parts.date;
  return `${Number(d)} ${month} ${y}`;
}

export function formatVmTime(value?: string | null): string {
  const parts = splitVmStamp(value);
  return parts?.time ? parts.time : '';
}

export function formatVmDateTime(value?: string | null): string {
  const date = formatVmDate(value);
  const time = formatVmTime(value);
  if (!date) return '';
  return time ? `${date} · ${time}` : date;
}

export function dashIfEmpty(value?: string | null, dash = '—'): string {
  const s = String(value ?? '').trim();
  return s ? s : dash;
}

/** The shift chip copy: "Opening Audit · 10 AM". */
export function shiftCaption(shift?: string | null): string {
  const found = VM_SHIFTS.find((s) => s.id === shift);
  if (found) return `${found.label} · ${found.hint}`;
  return String(shift || '');
}

export function photoSrc(photo?: VmPhoto | null): string {
  if (!photo) return '';
  return photo.url || API.getVmPhotoFileUrl(photo.id);
}

/**
 * `VmPhoto[]` in the order `PhotoLightbox` expects, so the saved record, the
 * gallery and the audit's own uploader all share one viewer (`vm/PhotoLightbox`).
 */
export function toLightboxItems(photos: VmPhoto[]): LightboxPhotoItem[] {
  return (photos || []).map((p) => ({
    id: p.id,
    url: photoSrc(p),
    fileName: p.fileName,
    fileSize: p.fileSize,
    status: null,
    floor: p.floor,
    section: p.section,
    locationId: p.locationId ?? null,
    locationName: p.locationName ?? null,
    pointId: p.pointId ?? null,
    uploadedBy: p.uploadedBy ?? null,
    inspectionDate: p.inspectionDate ?? null,
    createdAt: p.createdAt ?? null,
    local: false
  }));
}

export function formatBytes(value?: number | null): string {
  const bytes = Number(value || 0);
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function uniqueStrings(values: (string | null | undefined)[], ignore: string[] = []): string[] {
  const set = new Set<string>();
  values.forEach((v) => {
    const s = String(v ?? '').trim();
    if (s && !ignore.includes(s)) set.add(s);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/**
 * Error copy for a failed request.
 *
 * `apiFetch` already resolves the backend `message` / `error` fields, so the real
 * 400 "not ready" and 409 "already submitted" texts reach the UI verbatim.
 */
export function vmErrorMessage(err: unknown, fallback: string): string {
  const e = err as { message?: string; status?: number } | null;
  const msg = String(e?.message || '').trim();
  return msg || fallback;
}

export function vmErrorStatus(err: unknown): number {
  const e = err as { status?: number } | null;
  return Number(e?.status || 0);
}
