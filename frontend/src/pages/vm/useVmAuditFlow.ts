/**
 * useVmAuditFlow — the state machine behind the guided VM checklist.
 *
 * Owns: step navigation, the step-1 floor summary, the checkpoint list, the draft
 * audit lifecycle (create/resume/autosave/submit) and the draft's photos.
 *
 * Endpoint map
 *   step 1 Floor    GET  /vm/floor-summary        (API.getVmFloorSummary)
 *   step 2 Section  GET  /vm/points               (API.getVmPoints — checkpoint count)
 *   step 3 Audit    POST /vm/audits/draft         (API.createOrResumeVmDraft, idempotent)
 *                 PUT  /vm/audits/:id/draft      (API.saveVmDraft — debounced autosave)
 *   step 4 Photos   GET  /vm/photos?…             (API.getVmSectionPhotos) + PhotoUploader
 *   step 5 Submit   POST /vm/audits/:id/submit   (API.submitVmAudit)
 *   History         GET  /vm/audits, /vm/audits/:id, /vm/attention (HistoryStep)
 *
 * Draft resume is what makes answers survive a refresh or a logout: entering an
 * audit always POSTs the same idempotent tuple (store, floor, section, shift, IST
 * day, auditor) and the server hands back the stored entries, photos and score.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API } from '../../services/api';
import { showToast } from '../../components/Toast';
import { VM_SHIFTS, type VmAuditStatus, type VmFloorSummary, type VmPhoto, type VmQuestion, type VmScore, type VmScoreValue, type VmShiftId } from './vmTypes';
import {
  VM_AUTOSAVE_DEBOUNCE_MS,
  VM_STEP_ORDER,
  answerSignature,
  answersFromEntries,
  buildDraftEntries,
  computeVmScore,
  EMPTY_VM_ANSWER,
  mapAttention,
  mapAuditDetail,
  mapDraftResponse,
  mapFloorSummary,
  mapPhoto,
  mapQuestions,
  mapScore,
  stepIndex,
  validateAuditForSubmit,
  vmErrorMessage,
  type VmAnswerMap,
  type VmAttentionMapped,
  type VmMappedAuditDetail,
  type VmNoteField,
  type VmStepKey,
  type VmSubmitIssue
} from './vmFlowUtils';

export type VmSaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface VmSubmittedResult {
  auditId: string;
  score: VmScore;
  status: VmAuditStatus;
  entryDate: string;
}

export interface UseVmAuditFlowOptions {
  /** Start the flow on a step other than Floor (used when the user has view-only access). */
  initialStep?: VmStepKey;
}

export function useVmAuditFlow(options: UseVmAuditFlowOptions = {}) {
  const { initialStep = 'floor' } = options;

  // ── Navigation ────────────────────────────────────────────────────────────
  const [step, setStep] = useState<VmStepKey>(initialStep);
  const [visited, setVisited] = useState<VmStepKey[]>([initialStep]);
  const stepRef = useRef<VmStepKey>(initialStep);
  stepRef.current = step;

  // ── Step 1: floors ────────────────────────────────────────────────────────
  const [floors, setFloors] = useState<VmFloorSummary[]>([]);
  const [floorsLoading, setFloorsLoading] = useState(true);
  const [floorsError, setFloorsError] = useState<string | null>(null);
  const [today, setToday] = useState('');
  const [summaryTotalQuestions, setSummaryTotalQuestions] = useState(0);
  const floorsSeqRef = useRef(0);

  // ── Step 2/3: selection + checkpoints ─────────────────────────────────────
  const [floorName, setFloorName] = useState('');
  const [sectionName, setSectionName] = useState('');
  const [questions, setQuestions] = useState<VmQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const questionsSeqRef = useRef(0);

  const [shift, setShift] = useState<VmShiftId>('Opening');
  const [answers, setAnswers] = useState<VmAnswerMap>({});

  // ── Draft audit ───────────────────────────────────────────────────────────
  const [auditId, setAuditId] = useState<string | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<VmAuditStatus | null>(null);
  const [draftResumed, setDraftResumed] = useState(false);
  const [entryDate, setEntryDate] = useState('');
  const [serverScore, setServerScore] = useState<VmScore | null>(null);
  const draftSeqRef = useRef(0);
  const openedScopeRef = useRef('');
  const auditIdRef = useRef<string | null>(null);
  auditIdRef.current = auditId;

  // ── Autosave ──────────────────────────────────────────────────────────────
  const [saveState, setSaveState] = useState<VmSaveState>('idle');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveSeqRef = useRef(0);
  /** Signature of the answers the server already holds; set on load and on save. */
  const syncedKeyRef = useRef('');
  const answersRef = useRef<VmAnswerMap>(answers);
  answersRef.current = answers;
  const questionsRef = useRef<VmQuestion[]>(questions);
  questionsRef.current = questions;
  const shiftRef = useRef<VmShiftId>(shift);
  shiftRef.current = shift;
  const dirtyRef = useRef(false);
  dirtyRef.current = isDirty;

  // ── Step 4: photos ────────────────────────────────────────────────────────
  const [photos, setPhotos] = useState<VmPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const photosSeqRef = useRef(0);
  const photosLoadedForRef = useRef<string>('');

  // ── Step 5: submit ────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitIssues, setSubmitIssues] = useState<VmSubmitIssue[]>([]);
  const [lastSubmitted, setLastSubmitted] = useState<VmSubmittedResult | null>(null);
  const submittingRef = useRef(false);

  // ── Data loads ────────────────────────────────────────────────────────────

  const loadFloors = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    const seq = ++floorsSeqRef.current;
    if (silent) setFloorsError(null);
    else setFloorsLoading(true);
    try {
      const res = await API.getVmFloorSummary();
      if (seq !== floorsSeqRef.current) return;
      if (!res || res.success === false) {
        throw new Error(res?.message || 'The floor summary was rejected by the server.');
      }
      const mapped = mapFloorSummary(res);
      setFloors(mapped.floors);
      setToday(mapped.today);
      setSummaryTotalQuestions(mapped.totalQuestions);
      setFloorsError(null);
    } catch (err) {
      if (seq !== floorsSeqRef.current) return;
      setFloorsError(vmErrorMessage(err, 'Unable to load the store floors. Please try again.'));
      if (!silent) setFloors([]);
    } finally {
      if (seq === floorsSeqRef.current) setFloorsLoading(false);
    }
  }, []);

  const loadQuestions = useCallback(async () => {
    const seq = ++questionsSeqRef.current;
    setQuestionsLoading(true);
    try {
      const res = await API.getVmPoints();
      if (seq !== questionsSeqRef.current) return;
      if (!res || res.success === false) {
        throw new Error(res?.message || 'The checklist could not be loaded.');
      }
      const mapped = mapQuestions(res);
      setQuestions(mapped);
      setQuestionsError(null);
    } catch (err) {
      if (seq !== questionsSeqRef.current) return;
      setQuestionsError(vmErrorMessage(err, 'Unable to load the audit checklist. Please try again.'));
      setQuestions([]);
    } finally {
      if (seq === questionsSeqRef.current) setQuestionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFloors();
    void loadQuestions();
  }, [loadFloors, loadQuestions]);

  // ── Draft open (create or resume) ─────────────────────────────────────────

  const openDraft = useCallback(async (floor: string, section: string, nextShift: VmShiftId) => {
    const seq = ++draftSeqRef.current;
    setDraftLoading(true);
    setDraftError(null);
    try {
      const res = await API.createOrResumeVmDraft({ floor, section, shift: nextShift });
      if (seq !== draftSeqRef.current) return;
      const draft = mapDraftResponse(res);
      if (!draft.auditId) throw new Error('The server did not return an audit id.');

      const loaded = answersFromEntries(draft.entries);
      syncedKeyRef.current = answerSignature(loaded);
      setAnswers(loaded);
      setAuditId(draft.auditId);
      setDraftStatus(draft.status as VmAuditStatus);
      setDraftResumed(draft.resumed);
      setEntryDate(draft.entryDate);
      setServerScore(draft.score);
      setPhotos(draft.photos);
      setIsDirty(false);
      setSaveState('idle');
      setSaveError(null);

      if (draft.resumed) {
        showToast('Draft resumed — your saved answers and photos are back.', 'info');
      }
    } catch (err) {
      if (seq !== draftSeqRef.current) return;
      const message = vmErrorMessage(err, 'Unable to open this audit draft. Please try again.');
      setDraftError(message);
      setAuditId(null);
      showToast(message, 'error');
    } finally {
      if (seq === draftSeqRef.current) setDraftLoading(false);
    }
  }, []);

  /**
   * The draft is opened by the (floor, section, shift) tuple, and only once that
   * tuple is complete — so switching shift or section always re-enters the
   * idempotent endpoint instead of writing over a different audit.
   */
  const draftScope =
    step !== 'floor' && step !== 'section' && step !== 'history' && floorName && sectionName
      ? `${floorName}||${sectionName}||${shift}`
      : '';

  useEffect(() => {
    if (!draftScope) return;
    if (openedScopeRef.current === draftScope) return;
    // Claim the scope before the request so a StrictMode double-invoke of this
    // effect cannot send two POST /vm/audits/draft calls for the same audit.
    openedScopeRef.current = draftScope;
    const parts = draftScope.split('||');
    void openDraft(parts[0], parts[1], parts[2] as VmShiftId);
  }, [draftScope, openDraft]);

  // ── Autosave ──────────────────────────────────────────────────────────────

  /** Save whatever the auditor has typed right now; returns whether the server took it. */
  const saveDraftNow = useCallback(async (): Promise<boolean> => {
    const id = auditIdRef.current;
    if (!id) return false;
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    const seq = ++saveSeqRef.current;
    const snapshotKey = answerSignature(answersRef.current);
    setSaveState('saving');
    setSaveError(null);
    try {
      const res = await API.saveVmDraft(id, {
        shift: shiftRef.current,
        entries: buildDraftEntries(questionsRef.current, answersRef.current)
      });
      if (seq !== saveSeqRef.current) return true;
      if (!res || res.success === false) {
        throw new Error(res?.message || 'The draft save was rejected by the server.');
      }
      // The server recomputes the score on every save; the live preview uses the
      // same rule, so the two figures agree before the auditor even submits.
      setServerScore(mapScore((res as { score?: unknown }).score));
      setSavedAt(String((res as { savedAt?: unknown }).savedAt || new Date().toISOString()));
      setSaveState('saved');
      setIsDirty(false);
      syncedKeyRef.current = snapshotKey;
      return true;
    } catch (err) {
      if (seq !== saveSeqRef.current) return false;
      const message = vmErrorMessage(err, 'Autosave failed. Your answers are still on this screen.');
      setSaveState('error');
      setSaveError(message);
      return false;
    }
  }, []);

  const answerKey = useMemo(() => answerSignature(answers), [answers]);

  useEffect(() => {
    if (!auditId || draftLoading) return;
    // Never fire for unchanged data: the draft load seeds the signature.
    if (answerKey === syncedKeyRef.current) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    setIsDirty(true);
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      void saveDraftNow();
    }, VM_AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [answerKey, auditId, draftLoading, saveDraftNow]);

  // ── Step navigation ───────────────────────────────────────────────────────

  const markVisited = useCallback((key: VmStepKey) => {
    setVisited((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }, []);

  const moveStep = useCallback((key: VmStepKey) => {
    if (key !== stepRef.current) {
      // Leaving the audit or photo step flushes pending edits instead of dropping them.
      if ((stepRef.current === 'audit' || stepRef.current === 'photos') && dirtyRef.current) {
        void saveDraftNow();
      }
      stepRef.current = key;
      setStep(key);
      markVisited(key);
    }
  }, [markVisited, saveDraftNow]);

  const canVisit = useCallback(
    (key: VmStepKey): { ok: boolean; reason?: string } => {
      if (key === 'floor') return { ok: true };
      if (key === 'history') return { ok: true };
      if (key === 'section') {
        return floorName ? { ok: true } : { ok: false, reason: 'Choose a floor first.' };
      }
      if (key === 'audit') {
        return sectionName ? { ok: true } : { ok: false, reason: 'Choose a section first.' };
      }
      if (!auditId) return { ok: false, reason: 'The audit draft is not open yet.' };
      return { ok: true };
    },
    [auditId, floorName, sectionName]
  );

  const goToStep = useCallback(
    (key: VmStepKey) => {
      const gate = canVisit(key);
      if (!gate.ok) {
        if (gate.reason) showToast(gate.reason, 'warn');
        return;
      }
      moveStep(key);
    },
    [canVisit, moveStep]
  );

  const goNext = useCallback(() => {
    const idx = stepIndex(stepRef.current);
    const next = VM_STEP_ORDER[Math.min(idx + 1, VM_STEP_ORDER.length - 1)];
    goToStep(next);
  }, [goToStep]);

  const goBack = useCallback(() => {
    const idx = stepIndex(stepRef.current);
    if (idx === 0) return;
    const prev = VM_STEP_ORDER[idx - 1];
    // History sits at the end of the strip but is a peer view: Back from it goes
    // to wherever the auditor was working, or to the floor list.
    if (stepRef.current === 'history') {
      moveStep(auditIdRef.current ? 'submit' : 'floor');
      return;
    }
    moveStep(prev);
  }, [moveStep]);

  // ── Step 1 → 2 ────────────────────────────────────────────────────────────

  const chooseFloor = useCallback(
    (name: string) => {
      setFloorName(name);
      setSectionName('');
      openedScopeRef.current = '';
      setAuditId(null);
      setAnswers({});
      setPhotos([]);
      moveStep('section');
    },
    [moveStep]
  );

  const chooseSection = useCallback(
    (section: string) => {
      setSectionName(section);
      setSubmitError(null);
      setSubmitIssues([]);
      moveStep('audit');
    },
    [moveStep]
  );

  /** Jump straight back into an open Draft found in History. */
  const resumeDraftFor = useCallback(
    (floor: string, section: string, nextShift: string) => {
      const isKnownShift = VM_SHIFTS.some((s) => s.id === nextShift);
      if (!isKnownShift) {
        showToast(`Shift "${nextShift || '—'}" is not part of the guided flow any more.`, 'warn');
        return;
      }
      setFloorName(floor);
      setSectionName(section);
      setShift(nextShift as VmShiftId);
      openedScopeRef.current = '';
      moveStep('audit');
    },
    [moveStep]
  );

  const selectedFloor: VmFloorSummary | null = useMemo(
    () => floors.find((f) => f.name === floorName) || null,
    [floors, floorName]
  );

  /** Checkpoint count comes from the checklist table, never a literal. */
  const checkpointCount = questions.length || summaryTotalQuestions;

  // ── Step 3: answers ───────────────────────────────────────────────────────

  const setAnswerScore = useCallback((pointId: string, score: VmScoreValue) => {
    setAnswers((prev) => {
      const current = prev[pointId] || EMPTY_VM_ANSWER;
      // Tapping the active option again clears it: an unanswered checkpoint is
      // neither a Pass, a Fail nor N/A and must leave the denominator.
      const nextScore: VmScoreValue | '' = current.score === score ? '' : score;
      return { ...prev, [pointId]: { ...current, score: nextScore } };
    });
  }, []);

  const setAnswerNote = useCallback((pointId: string, field: VmNoteField, value: string) => {
    setAnswers((prev) => {
      const current = prev[pointId] || EMPTY_VM_ANSWER;
      return { ...prev, [pointId]: { ...current, [field]: value } };
    });
  }, []);

  const liveScore = useMemo(() => computeVmScore(questions, answers), [questions, answers]);

  const pendingCount = Math.max(0, questions.length - liveScore.rated);

  /**
   * Shift change is a different audit (the draft key includes the shift), so the
   * pending answers are flushed to the old draft first and never overwritten.
   */
  const changeShift = useCallback(
    async (next: VmShiftId) => {
      if (next === shift) return;
      if (dirtyRef.current && auditIdRef.current) {
        await saveDraftNow();
      }
      openedScopeRef.current = '';
      setShift(next);
    },
    [saveDraftNow, shift]
  );

  const retryOpenDraft = useCallback(() => {
    if (!floorName || !sectionName) return;
    openedScopeRef.current = '';
    setDraftError(null);
    void openDraft(floorName, sectionName, shift);
  }, [floorName, openDraft, sectionName, shift]);

  // ── Step 4: photos ────────────────────────────────────────────────────────

  const refreshPhotos = useCallback(async () => {
    const id = auditIdRef.current;
    if (!id || !floorName || !sectionName) return;
    const seq = ++photosSeqRef.current;
    setPhotosLoading(true);
    try {
      const res = await API.getVmSectionPhotos({ floor: floorName, section: sectionName, submissionId: id });
      if (seq !== photosSeqRef.current) return;
      const list = Array.isArray((res as { photos?: unknown[] })?.photos)
        ? (res as { photos: unknown[] }).photos
        : [];
      setPhotos(list.map(mapPhoto));
      photosLoadedForRef.current = id;
    } catch {
      // The draft response already carries the photo list; a failed refresh keeps it.
    } finally {
      if (seq === photosSeqRef.current) setPhotosLoading(false);
    }
  }, [floorName, sectionName]);

  // Entering the photo step re-reads the audit's photos once, so a shot uploaded in
  // another tab or before a refresh shows up without a manual reload.
  useEffect(() => {
    if (step !== 'photos' || !auditId) return;
    if (photosLoadedForRef.current === auditId) return;
    photosLoadedForRef.current = auditId;
    void refreshPhotos();
  }, [step, auditId, refreshPhotos]);

  const handlePhotosChanged = useCallback((next: VmPhoto[]) => {
    setPhotos(Array.isArray(next) ? next : []);
  }, []);

  // ── Step 5: submit ────────────────────────────────────────────────────────

  const resetFlow = useCallback(
    (toStep: VmStepKey = 'floor') => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      saveSeqRef.current += 1;
      draftSeqRef.current += 1;
      openedScopeRef.current = '';
      syncedKeyRef.current = '';
      photosLoadedForRef.current = '';
      setFloorName('');
      setSectionName('');
      setAnswers({});
      setAuditId(null);
      setPhotos([]);
      setDraftStatus(null);
      setDraftResumed(false);
      setEntryDate('');
      setServerScore(null);
      setSaveState('idle');
      setSaveError(null);
      setSavedAt(null);
      setIsDirty(false);
      setSubmitError(null);
      setSubmitIssues([]);
      setShift('Opening');
      moveStep(toStep);
    },
    [moveStep]
  );

  const submitAudit = useCallback(async (): Promise<boolean> => {
    if (submittingRef.current) return false;

    const issues = validateAuditForSubmit({
      floor: floorName,
      section: sectionName,
      shift,
      questions,
      answers
    });
    setSubmitIssues(issues);
    if (issues.length > 0) {
      showToast('This audit is not ready to submit yet. See the checklist below.', 'warn');
      return false;
    }

    const id = auditIdRef.current;
    if (!id) {
      setSubmitError('The audit draft is not open yet. Please retry opening it.');
      return false;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);

    try {
      // File the saved draft, not an unsaved screen state: if autosave could not
      // reach the server, submitting would record stale answers.
      if (dirtyRef.current) {
        const flushed = await saveDraftNow();
        if (!flushed) {
          throw new Error('Your latest answers could not be saved, so nothing was submitted. Check the connection and try again.');
        }
      }

      const res = await API.submitVmAudit(id, { confirm: true });
      const draft = mapDraftResponse(res);
      if (!draft.auditId) throw new Error(res?.message || 'The server did not confirm the submission.');

      setLastSubmitted({
        auditId: draft.auditId,
        // The figure the store sees is the one the server recomputed.
        score: draft.score,
        status: draft.status as VmAuditStatus,
        entryDate: draft.entryDate
      });
      showToast('Audit report submitted successfully.', 'success');
      resetFlow('floor');
      void loadFloors({ silent: true });
      return true;
    } catch (err) {
      const message = vmErrorMessage(err, 'Unable to submit the audit report. Please try again.');
      setSubmitError(message);
      showToast(message, 'error');
      return false;
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [answers, floorName, loadFloors, questions, resetFlow, saveDraftNow, sectionName, shift]);

  const dismissSubmitError = useCallback(() => setSubmitError(null), []);

  /** Hide the post-submit banner without disturbing the flow. */
  const dismissSubmitted = useCallback(() => setLastSubmitted(null), []);

  // ── History / attention reads used by the History step ────────────────────
  const [attention, setAttention] = useState<VmAttentionMapped | null>(null);
  const [attentionLoading, setAttentionLoading] = useState(false);
  const [attentionError, setAttentionError] = useState<string | null>(null);
  const attentionSeqRef = useRef(0);

  const loadAttention = useCallback(async () => {
    const seq = ++attentionSeqRef.current;
    setAttentionLoading(true);
    try {
      const res = await API.getVmAttention();
      if (seq !== attentionSeqRef.current) return;
      if (!res || res.success === false) throw new Error(res?.message || 'The attention list was rejected.');
      setAttention(mapAttention(res));
      setAttentionError(null);
    } catch (err) {
      if (seq !== attentionSeqRef.current) return;
      setAttentionError(vmErrorMessage(err, 'Unable to load areas requiring attention.'));
      setAttention(null);
    } finally {
      if (seq === attentionSeqRef.current) setAttentionLoading(false);
    }
  }, []);

  useEffect(() => {
    if (step !== 'history') return;
    void loadAttention();
  }, [step, loadAttention]);

  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailSeqRef = useRef(0);

  const loadAuditDetail = useCallback(async (id: string): Promise<VmMappedAuditDetail | null> => {
    const seq = ++detailSeqRef.current;
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await API.getVmAuditDetail(id);
      if (seq !== detailSeqRef.current) return null;
      const detail = mapAuditDetail(res);
      if (!detail) throw new Error('This audit record could not be read.');
      return detail;
    } catch (err) {
      if (seq === detailSeqRef.current) {
        setDetailError(vmErrorMessage(err, 'Unable to open this saved audit.'));
      }
      return null;
    } finally {
      if (seq === detailSeqRef.current) setDetailLoading(false);
    }
  }, []);

  return {
    // navigation
    step,
    visited,
    canVisit,
    goToStep,
    goNext,
    goBack,
    resetFlow,
    // step 1
    floors,
    floorsLoading,
    floorsError,
    loadFloors,
    today,
    // step 2
    floorName,
    sectionName,
    selectedFloor,
    chooseFloor,
    chooseSection,
    checkpointCount,
    // step 3
    questions,
    questionsLoading,
    questionsError,
    loadQuestions,
    shift,
    changeShift,
    answers,
    setAnswerScore,
    setAnswerNote,
    liveScore,
    pendingCount,
    // draft + autosave
    auditId,
    draftLoading,
    draftError,
    retryOpenDraft,
    draftResumed,
    draftStatus,
    entryDate,
    serverScore,
    saveState,
    savedAt,
    saveError,
    isDirty,
    saveDraftNow,
    // step 4
    photos,
    photosLoading,
    refreshPhotos,
    handlePhotosChanged,
    // step 5
    submitting,
    submitError,
    dismissSubmitError,
    submitIssues,
    lastSubmitted,
    submitAudit,
    dismissSubmitted,
    // history helpers
    resumeDraftFor,
    attention,
    attentionLoading,
    attentionError,
    loadAttention,
    detailLoading,
    detailError,
    loadAuditDetail
  };
}

export type VmAuditFlow = ReturnType<typeof useVmAuditFlow>;
