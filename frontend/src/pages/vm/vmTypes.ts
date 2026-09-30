/**
 * VM Checklist audit flow — shared contract.
 *
 * These types are the single definition of what the backend returns and what the
 * guided flow sends. `vmController` / `vmPhotoController` implement them and the
 * /vm-checklist steps consume them, so the two cannot drift apart.
 *
 * Question count is never fixed here: `totalQuestions` always comes from
 * `vmchecklistpoints`, so adding or retiring a checkpoint needs no UI change.
 */

export type VmScoreValue = 'Pass' | 'Fail' | 'NA';

export type VmAuditStatus = 'Draft' | 'Completed' | 'Review';

/** Shifts offered by the audit form, matching existing `vmsubmissions.shift` values. */
export const VM_SHIFTS = [
  { id: 'Opening', label: 'Opening Audit', hint: '10 AM' },
  { id: 'Mid-Day', label: 'Mid-Day Check', hint: '3 PM' },
  { id: 'Closing', label: 'Closing Audit', hint: '9 PM' }
] as const;

export type VmShiftId = (typeof VM_SHIFTS)[number]['id'];

/** A checklist question as stored in `vmchecklistpoints`. */
export interface VmQuestion {
  id: string;
  title: string;
  description?: string | null;
  position?: number;
}

/**
 * One answered question. `comment` / `observation` / `correctiveAction` belong to
 * this question only — they are never folded into one general audit note.
 */
export interface VmAuditEntry {
  pointId: string;
  pointTitle: string;
  score: VmScoreValue;
  comment: string;
  observation: string;
  correctiveAction: string;
}

/** Score block. `percent` excludes N/A from the denominator. */
export interface VmScore {
  percent: number;
  passed: number;
  failed: number;
  notApplicable: number;
  unrated: number;
  totalQuestions: number;
  /** Questions that carry a Pass/Fail/NA answer. */
  rated: number;
  /** Passed + Failed — the denominator used for `percent`. */
  graded: number;
}

export interface VmPhoto {
  id: string;
  submissionId: string | null;
  floor: string;
  section: string;
  pointId?: string | null;
  fileName: string;
  fileSize: number;
  mimeType?: string | null;
  uploadedBy?: string | null;
  inspectionDate?: string | null;
  createdAt?: string | null;
  /** Short observation recorded against this image (not a general audit note). */
  caption?: string | null;
  label?: string | null;
  correctiveAction?: string | null;
  photoOrder?: number;
  updatedAt?: string | null;
  updatedBy?: string | null;
  /** Server image route; authenticated, never a blob/object URL. */
  url: string;
}

/** Floor card for step 1. */
export interface VmFloorSummary {
  id?: string;
  location_id?: number | null;
  name: string;
  description: string;
  sections: string[];
  sectionCount: number;
  /** Completed audits only, across every date for this floor. */
  totalAudits: number;
  lastAuditDate: string | null;
  /** Score of the most recent completed audit on this floor. */
  lastScore: number | null;
  /** True when an unfinished Draft exists for this floor at any shift. */
  hasDraft: boolean;
  draftSections: string[];
  /** Sections never audited yet, so the store knows what is outstanding. */
  unauditedSections: string[];
}

export interface VmFloorSummaryResponse {
  success: boolean;
  floors: VmFloorSummary[];
  /** Server Asia/Kolkata day (YYYY-MM-DD) — never derived in the browser. */
  today: string;
  totalQuestions: number;
}

/** Draft create/resume response. */
export interface VmDraftResponse {
  success: boolean;
  auditId: string;
  status: VmAuditStatus;
  floor: string;
  section: string;
  shift: VmShiftId;
  entryDate: string;
  /** False on first creation; true when an existing draft was resumed. */
  resumed: boolean;
  entries: VmAuditEntry[];
  photos: VmPhoto[];
  score: VmScore;
}

/** Autosave result. */
export interface VmDraftSaveResponse {
  success: boolean;
  savedAt: string;
  score: VmScore;
  progress: { rated: number; total: number };
}

export interface VmAuditListItem {
  id: string;
  entryDate: string;
  shift: VmShiftId;
  floor: string;
  section: string;
  scorePercent: number;
  status: VmAuditStatus;
  submittedBy: string;
  passedCount: number;
  failedCount: number;
  naCount: number;
  totalQuestions: number;
  photoCount: number;
  createdAt: string | null;
  submittedAt: string | null;
}

export interface VmAuditDetail extends VmAuditListItem {
  locationId: number;
  locationName: string | null;
  remarks: string;
  entries: VmAuditEntry[];
  photos: VmPhoto[];
}

/** Computed from stored audits — never hardcoded. */
export interface VmAttentionQuestion {
  pointId: string;
  pointTitle: string;
  passRate: number;
  passed: number;
  failed: number;
  notApplicable: number;
  audits: number;
}

export interface VmAttentionSection {
  floor: string;
  section: string;
  passRate: number;
  audits: number;
  avgScore: number;
}

export interface VmAttentionResponse {
  success: boolean;
  lowestQuestions: VmAttentionQuestion[];
  lowestSections: VmAttentionSection[];
  /** Completed audits the calculation covers. */
  auditsConsidered: number;
}

export interface VmAuditListParams {
  locationId?: number | string;
  floor?: string;
  section?: string;
  shift?: string;
  dateFrom?: string;
  dateTo?: string;
  auditor?: string;
  status?: string;
  minScore?: number;
  maxScore?: number;
  search?: string;
  limit?: number;
  page?: number;
}

/**
 * Photo area prop contract. `vm/PhotoUploader.tsx` implements it and the audit
 * step consumes it; keeping it here means neither side can rename a member and
 * leave the other compiling against a shape that no longer exists.
 */
export interface PhotoUploaderProps {
  /** Draft audit the photos attach to. Photos stay usable when null (not yet created). */
  auditId: string | null;
  floor: string;
  section: string;
  /** Question id when the shot is evidence for one checkpoint; omit for section shots. */
  pointId?: string | null;
  /** Already-persisted photos for this section/audit, from the server. */
  photos: VmPhoto[];
  maxPhotos?: number;
  disabled?: boolean;
  /** Emitted after every successful server-side change so the parent can stay in sync. */
  onPhotosChanged: (photos: VmPhoto[]) => void;
  onView?: (photo: VmPhoto) => void;
}
