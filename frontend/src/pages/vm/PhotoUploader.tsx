import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Images,
  Eye,
  Trash2,
  Replace,
  RefreshCw,
  Loader2,
  CircleCheck,
  CircleAlert,
  Clock3,
  CloudOff,
  ImageOff,
  Undo2,
  Info
} from 'lucide-react';
import { API } from '../../services/api';
import { showToast } from '../../components/Toast';
import VmCameraModal from '../../components/ui/VmCameraModal';
import type { PhotoUploaderProps, VmPhoto } from './vmTypes';
import PhotoLightbox from './PhotoLightbox';
import {
  MAX_FILE_RULE,
  VM_DEFAULT_MAX_PHOTOS,
  VM_MAX_FILE_LABEL,
  capMessage,
  currentLocationMeta,
  errorFromUnknown,
  fetchPhotoBytes,
  fileFromBlob,
  formatBytes,
  formatPhotoDate,
  isAbortError,
  newAttemptId,
  parsePhotoListResponse,
  photoInScope,
  photoSignature,
  sortPhotosOldestFirst,
  startVmPhotoUpload,
  supportsInAppCamera,
  validatePhotoFile,
  validatePhotoSelection,
  type LightboxPhotoItem,
  type PhotoScope,
  type VmPendingPhoto,
  type VmPhotoMeta,
  type VmUploadHandle,
  type VmUploadStatus
} from './photoUtils';

/**
 * PhotoUploader — the section-scoped inspection photo area of the redesigned VM
 * Checklist.
 *
 * How a photo gets saved, end to end:
 *
 *   1. [Take Photo] opens the in-app camera (`VmCameraModal`) on devices that
 *      allow `getUserMedia`, and falls back to `<input capture="environment">`
 *      elsewhere. [Choose from Gallery] is a plain multi-select file input.
 *      Nobody is ever asked to type a path.
 *   2. The pick is validated on the client (JPG/PNG, 5 MB, section cap) and gets
 *      an immediate thumbnail with an explicit status: Queuing → Uploading % →
 *      Uploaded / Failed.
 *   3. It is uploaded to `POST /api/vm/photos` straight away, one file per
 *      XMLHttpRequest so progress and Retry are per photo. `submissionId` is the
 *      Draft audit id the parent already created, alongside floor/section/pointId
 *      and the session's store — so a saved photo survives refresh and
 *      logout/login because it lives in `vm_checklist_photos`, not in memory.
 *   4. On completion the section is re-read through `API.getVmSectionPhotos` —
 *      the server is the source of truth — and `onPhotosChanged` gets that fresh
 *      list. A tile only leaves the "pending" state when the re-read proves its
 *      row exists.
 *
 * Failure handling is equally explicit: if `auditId` has not arrived yet the file
 * is queued and dispatched by an effect the moment it does (never discarded,
 * never blocked); one selection maps to exactly one upload attempt, and Retry
 * re-sends only a row-less attempt, so nothing can double-insert.
 */

/** Seconds the "Removed — Undo" bar stays live. */
const UNDO_WINDOW_MS = 12000;

const STATUS_META: Record<VmUploadStatus, { label: string; tone: string; icon: React.ComponentType<{ className?: string }> }> = {
  queued: { label: 'Queuing', tone: 'bg-[#FFF4D6] text-[#8A5A06] border-[#E7C98A]', icon: Clock3 },
  uploading: { label: 'Uploading', tone: 'bg-[#EAF1FA] text-[#2B4E9B] border-[#BFD3F2]', icon: Loader2 },
  uploaded: { label: 'Uploaded', tone: 'bg-[#E8F5EE] text-[#0F6B45] border-[#B7E0CB]', icon: CircleCheck },
  failed: { label: 'Failed', tone: 'bg-[#FDE8E7] text-[#8F1D14] border-[#F2BDB8]', icon: CircleAlert }
};

interface SavedPhotoTileProps {
  photo: VmPhoto;
  number: number;
  scopeLabel: string;
  busy: boolean;
  canEdit: boolean;
  onView: () => void;
  onRemove: () => void;
  onReplace: () => void;
  onSaveCaption: (photo: VmPhoto, caption: string) => Promise<void> | void;
}

/** Mirrors the server's own cap so a long note is stopped here, not lost on save. */
const MAX_CAPTION_LENGTH = 500;

function SavedPhotoTile({
  photo,
  number,
  scopeLabel,
  busy,
  canEdit,
  onView,
  onRemove,
  onReplace,
  onSaveCaption
}: SavedPhotoTileProps) {
  const [broken, setBroken] = useState(false);
  const [captionOpen, setCaptionOpen] = useState(false);
  const [draftCaption, setDraftCaption] = useState(photo.caption || '');
  const [savingCaption, setSavingCaption] = useState(false);

  return (
    <div className="rounded-xl border border-[#E8D9D4] bg-white overflow-hidden flex flex-col shadow-[0_1px_2px_rgba(74,23,58,0.06)]">
      <div className="relative aspect-[4/3] bg-[#F6EFEA] flex items-center justify-center">
        {broken ? (
          <div className="text-center px-2 py-3">
            <ImageOff className="w-6 h-6 mx-auto text-[#B08DA0]" />
            <p className="mt-1.5 text-[11px] font-bold text-[#6F5963] leading-snug">
              Server image unavailable
            </p>
          </div>
        ) : (
          <img
            src={photo.url}
            alt={`${photo.fileName} — ${scopeLabel}`}
            loading="lazy"
            onError={() => setBroken(true)}
            onClick={onView}
            className="w-full h-full object-contain cursor-zoom-in"
          />
        )}
        <span className="absolute top-1.5 left-1.5 rounded-md bg-[#4A173A]/90 px-1.5 py-0.5 text-[11px] font-black text-white tabular-nums">
          #{number}
        </span>
        <span className="absolute top-1.5 right-1.5 rounded-md bg-[#E8F5EE]/95 border border-[#B7E0CB] px-1.5 py-0.5 text-[11px] font-black text-[#0F6B45]">
          Saved
        </span>
      </div>

      <div className="p-2 flex flex-col gap-1.5 flex-1">
        <p className="text-[11px] font-bold text-[#2B1722] truncate" title={photo.fileName}>
          {photo.fileName}
        </p>
        <p className="text-[11px] font-semibold text-[#6F5963] tabular-nums">
          {formatBytes(photo.fileSize)}
          {photo.pointId ? ' · question' : ' · section'}
          {formatPhotoDate(photo.inspectionDate) ? ` · ${formatPhotoDate(photo.inspectionDate)}` : ''}
        </p>

        {/* §27 the observation belongs to this image, so it is shown and edited here
            rather than folded into a general audit note. */}
        {photo.caption ? (
          <p className="text-[11px] font-semibold text-[#4A173A] leading-snug line-clamp-2" title={photo.caption}>
            “{photo.caption}”
          </p>
        ) : null}
        {canEdit && (
          <button
            type="button"
            onClick={() => { setDraftCaption(photo.caption || ''); setCaptionOpen((v) => !v); }}
            aria-expanded={captionOpen}
            className="self-start inline-flex items-center gap-1 text-[11px] font-bold text-[#6A2853] hover:underline cursor-pointer"
          >
            <Info className="w-3.5 h-3.5" />
            {photo.caption ? 'Edit observation' : 'Add observation'}
          </button>
        )}
        {captionOpen && canEdit && (
          <div className="space-y-1">
            <textarea
              value={draftCaption}
              onChange={(e) => setDraftCaption(e.target.value)}
              rows={2}
              maxLength={MAX_CAPTION_LENGTH}
              placeholder="What does this photo show? e.g. Rack 4 needs realignment."
              className="w-full rounded-lg border border-[#E8D9D4] bg-[#FFFAF7] px-2 py-1.5 text-[11px] font-semibold text-[#2B1722] focus:border-[#B76E79] focus:outline-none resize-y"
            />
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={savingCaption}
                onClick={async () => { setSavingCaption(true); try { await onSaveCaption(photo, draftCaption.trim()); setCaptionOpen(false); } finally { setSavingCaption(false); } }}
                className="flex-1 min-h-[36px] inline-flex items-center justify-center gap-1 rounded-lg bg-[#4A173A] text-white text-[11px] font-bold disabled:opacity-50 cursor-pointer"
              >
                {savingCaption ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CircleCheck className="w-3.5 h-3.5" />}
                Save
              </button>
              <button
                type="button"
                onClick={() => setCaptionOpen(false)}
                className="min-h-[36px] px-2 rounded-lg border border-[#E8D9D4] bg-white text-[#4A173A] text-[11px] font-bold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="mt-auto flex items-center gap-1 pt-1">
          <button
            type="button"
            onClick={onView}
            title="View full size"
            aria-label={`View photo ${number}`}
            className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1 rounded-lg border border-[#E8D9D4] bg-white text-[#4A173A] text-[11px] font-bold hover:bg-[#FFF7F2] transition-colors cursor-pointer"
          >
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">View</span>
          </button>
          <button
            type="button"
            onClick={onReplace}
            disabled={!canEdit || busy}
            title="Replace this photo (keeps the same slot)"
            aria-label={`Replace photo ${number}`}
            className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1 rounded-lg border border-[#E8D9D4] bg-white text-[#6A2853] text-[11px] font-bold hover:bg-[#FFF7F2] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Replace className="w-4 h-4" />}
            <span className="hidden sm:inline">Replace</span>
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={!canEdit || busy}
            title="Remove this photo"
            aria-label={`Remove photo ${number}`}
            className="w-11 min-h-[40px] inline-flex items-center justify-center rounded-lg border border-[#F2BDB8] bg-[#FDE8E7] text-[#8F1D14] hover:bg-[#FAD5D2] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface PendingPhotoTileProps {
  attempt: VmPendingPhoto;
  number: number;
  scopeLabel: string;
  canEdit: boolean;
  onView: () => void;
  onRetry: () => void;
  onDiscard: () => void;
}

function PendingPhotoTile({
  attempt,
  number,
  scopeLabel,
  canEdit,
  onView,
  onRetry,
  onDiscard
}: PendingPhotoTileProps) {
  const meta = STATUS_META[attempt.status];
  const StatusIcon = meta.icon;
  const isUploading = attempt.status === 'uploading';
  const canDiscard = canEdit && attempt.status !== 'uploading' && attempt.status !== 'uploaded';

  return (
    <div
      className={`rounded-xl border bg-white overflow-hidden flex flex-col shadow-[0_1px_2px_rgba(74,23,58,0.06)] ${
        attempt.status === 'failed' ? 'border-[#F2BDB8]' : 'border-[#E8D9D4]'
      }`}
    >
      <div className="relative aspect-[4/3] bg-[#F6EFEA] flex items-center justify-center">
        <img
          src={attempt.previewUrl}
          alt={`${attempt.fileName} — ${scopeLabel}`}
          onClick={onView}
          className={`w-full h-full object-contain cursor-zoom-in ${isUploading ? 'opacity-70' : ''}`}
        />
        <span className="absolute top-1.5 left-1.5 rounded-md bg-[#4A173A]/90 px-1.5 py-0.5 text-[11px] font-black text-white tabular-nums">
          #{number}
        </span>
        <span
          className={`absolute top-1.5 right-1.5 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-black ${meta.tone}`}
        >
          <StatusIcon className={`w-3 h-3 ${isUploading ? 'animate-spin' : ''}`} />
          {meta.label}
          {isUploading && attempt.progress > 0 ? ` ${attempt.progress}%` : ''}
        </span>
      </div>

      <div className="p-2 flex flex-col gap-1.5 flex-1">
        <p className="text-[11px] font-bold text-[#2B1722] truncate" title={attempt.fileName}>
          {attempt.fileName}
        </p>
        <p className="text-[11px] font-semibold text-[#6F5963] tabular-nums">
          {formatBytes(attempt.fileSize)}
          {attempt.destination.pointId ? ' · question' : ' · section'}
        </p>

        {isUploading ? (
          <div className="h-1.5 rounded-full bg-[#F0E2DC] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#B76E79] transition-all duration-200"
              style={{ width: `${Math.max(6, attempt.progress)}%` }}
              aria-hidden="true"
            />
          </div>
        ) : null}

        {attempt.status === 'queued' && attempt.reason === 'awaiting-audit' ? (
          <p className="text-[11px] font-semibold text-[#8A5A06] leading-snug">
            Waiting for the audit to be created — it uploads by itself the moment it exists.
          </p>
        ) : null}

        {attempt.status === 'failed' ? (
          <p className="text-[11px] font-semibold text-[#8F1D14] leading-snug break-words">
            {attempt.error || 'Upload failed.'}
          </p>
        ) : null}

        {attempt.status === 'uploaded' ? (
          <p className="text-[11px] font-semibold text-[#0F6B45] leading-snug">
            Saved on the server — refreshing this section…
          </p>
        ) : null}

        <div className="mt-auto flex items-center gap-1 pt-1">
          <button
            type="button"
            onClick={onView}
            title="View this preview"
            aria-label={`Preview photo ${number}`}
            className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1 rounded-lg border border-[#E8D9D4] bg-white text-[#4A173A] text-[11px] font-bold hover:bg-[#FFF7F2] transition-colors cursor-pointer"
          >
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">View</span>
          </button>
          {attempt.status === 'failed' ? (
            <button
              type="button"
              onClick={onRetry}
              disabled={!canEdit}
              title="Re-send only this photo"
              aria-label={`Retry upload for photo ${number}`}
              className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1 rounded-lg border border-[#B7E0CB] bg-[#E8F5EE] text-[#0F6B45] text-[11px] font-bold hover:bg-[#D8EFE3] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Retry</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDiscard}
            disabled={!canDiscard}
            title={
              isUploading
                ? 'This photo is uploading — wait for it to finish'
                : attempt.status === 'uploaded'
                  ? 'Already saved; use Remove on the saved photo'
                  : 'Discard this photo before it uploads'
            }
            aria-label={`Discard photo ${number}`}
            className="w-11 min-h-[40px] inline-flex items-center justify-center rounded-lg border border-[#F2BDB8] bg-[#FDE8E7] text-[#8F1D14] hover:bg-[#FAD5D2] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PhotoUploader(props: PhotoUploaderProps) {
  const {
    auditId,
    floor,
    section,
    pointId = null,
    photos,
    maxPhotos = VM_DEFAULT_MAX_PHOTOS,
    disabled = false,
    onPhotosChanged,
    onView
  } = props;

  const limit = Math.max(1, Math.floor(Number(maxPhotos) || VM_DEFAULT_MAX_PHOTOS));

  const [serverPhotos, setServerPhotos] = useState<VmPhoto[]>([]);
  const [pending, setPending] = useState<VmPendingPhoto[]>([]);
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [listError, setListError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState<boolean>(false);
  const [confirmPhoto, setConfirmPhoto] = useState<VmPhoto | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [busyPhotoId, setBusyPhotoId] = useState<string | null>(null);
  const [undoPhoto, setUndoPhoto] = useState<VmPhoto | null>(null);
  const [undoBusy, setUndoBusy] = useState<boolean>(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const captureInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);

  const mountedRef = useRef<boolean>(true);
  const requestSeqRef = useRef<number>(0);
  const dispatchedRef = useRef<Set<string>>(new Set());
  const objectUrlsRef = useRef<Map<string, string>>(new Map());
  const handlesRef = useRef<Map<string, VmUploadHandle>>(new Map());
  const serverPhotosRef = useRef<VmPhoto[]>([]);
  const pendingRef = useRef<VmPendingPhoto[]>([]);
  const auditIdRef = useRef<string | null>(auditId);
  const scopeRef = useRef<PhotoScope & { pointId: string | null }>({
    floor,
    section,
    auditId,
    pointId
  });
  const undoBytesRef = useRef<Blob | null>(null);
  const undoTimerRef = useRef<number | null>(null);
  const replaceTargetRef = useRef<VmPhoto | null>(null);
  const lastEmittedRef = useRef<string>('');
  const callbacksRef = useRef<{
    onPhotosChanged?: (list: VmPhoto[]) => void;
    onView?: (photo: VmPhoto) => void;
  }>({ onPhotosChanged, onView });

  // Latest props into refs, so the upload engine never reads a stale closure and
  // never has to re-run because a parent re-rendered with a new function identity.
  useEffect(() => {
    callbacksRef.current = { onPhotosChanged, onView };
  });
  useEffect(() => {
    auditIdRef.current = auditId;
  }, [auditId]);
  useEffect(() => {
    scopeRef.current = { floor, section, auditId, pointId: pointId ?? null };
  }, [floor, section, auditId, pointId]);
  useEffect(() => {
    serverPhotosRef.current = serverPhotos;
  }, [serverPhotos]);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const canUseInAppCamera = useMemo(() => supportsInAppCamera(), []);

  const revokePreview = useCallback((attemptId: string) => {
    const url = objectUrlsRef.current.get(attemptId);
    objectUrlsRef.current.delete(attemptId);
    if (url) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* nothing to revoke */
      }
    }
  }, []);

  // Every object URL this instance created is released when it really goes away.
  // The revoke is deferred because StrictMode (src/main.tsx) runs
  // mount → cleanup → mount on the same state: revoking synchronously would kill
  // the previews of the instance that is about to be re-mounted. A real unmount
  // leaves `mountedRef` false, so the revoke then runs as intended.
  useEffect(() => {
    const urls = objectUrlsRef;
    const pendingAttempts = pendingRef;
    const dispatched = dispatchedRef;
    return () => {
      window.setTimeout(() => {
        if (mountedRef.current) return;
        const stranded = pendingAttempts.current.filter(
          (item) => item.status === 'queued' && !dispatched.current.has(item.attemptId)
        );
        if (stranded.length > 0) {
          showToast(
            `${stranded.length} photo(s) for ${stranded[0].destination.section} were still queued when this section closed. Open it again to add them.`,
            'warn'
          );
        }
        urls.current.forEach((url) => {
          try {
            URL.revokeObjectURL(url);
          } catch {
            /* ignore */
          }
        });
        urls.current.clear();
      }, 0);
    };
  }, []);

  const clearUndo = useCallback(() => {
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    undoBytesRef.current = null;
    setUndoPhoto(null);
  }, []);

  useEffect(() => () => {
    if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current);
  }, []);

  const currentScope = useCallback(
    (): PhotoScope => ({
      floor: scopeRef.current.floor,
      section: scopeRef.current.section,
      auditId: auditIdRef.current
    }),
    []
  );

  const emitPhotos = useCallback((list: VmPhoto[]) => {
    const signature = photoSignature(list);
    if (signature === lastEmittedRef.current) return;
    lastEmittedRef.current = signature;
    callbacksRef.current.onPhotosChanged?.(list);
  }, []);

  const applyServerPhotos = useCallback(
    (list: VmPhoto[]) => {
      const sorted = sortPhotosOldestFirst(list);
      serverPhotosRef.current = sorted;
      if (mountedRef.current) setServerPhotos(sorted);
      emitPhotos(sorted);
      return sorted;
    },
    [emitPhotos]
  );

  /**
   * Re-read this exact section from the server.
   *
   * Sequence-guarded: the parent remounts this component on section change and an
   * older response landing afterwards would show the wrong gallery, so any
   * response that has been superseded — or arrives after unmount — is dropped.
   */
  const loadSectionPhotos = useCallback(async (): Promise<VmPhoto[] | null> => {
    const scope = currentScope();
    const seq = ++requestSeqRef.current;

    if (!scope.floor.trim() || !scope.section.trim()) {
      if (mountedRef.current) {
        setLoadingList(false);
        setListError(null);
      }
      applyServerPhotos([]);
      return [];
    }

    if (mountedRef.current) {
      setLoadingList(true);
      setListError(null);
    }

    try {
      const res = await API.getVmSectionPhotos({
        floor: scope.floor,
        section: scope.section,
        submissionId: scope.auditId ?? undefined
      });
      if (!mountedRef.current || seq !== requestSeqRef.current) return null;
      const fresh = applyServerPhotos(
        parsePhotoListResponse(res).filter((photo) => photoInScope(photo, scope))
      );
      return fresh;
    } catch (err) {
      if (!mountedRef.current || seq !== requestSeqRef.current) return null;
      setListError(
        errorFromUnknown(err, 'Unable to load the photos for this section.').message
      );
      return null;
    } finally {
      if (mountedRef.current && seq === requestSeqRef.current) setLoadingList(false);
    }
  }, [applyServerPhotos, currentScope]);

  // Photos are per floor + section (+ audit): a section change is a new gallery.
  const scopeKey = `${auditId ?? ''}||${floor}||${section}`;
  useEffect(() => {
    requestSeqRef.current += 1; // invalidate any response still in flight
    lastEmittedRef.current = '';
    clearUndo();
    void loadSectionPhotos();
  }, [scopeKey, clearUndo, loadSectionPhotos]);

  /**
   * Adopt the parent's list when it genuinely differs (e.g. a resumed Draft is
   * loaded after mount, or a section is reopened). Filtered by scope first, so an
   * audit-wide array from the parent can never leak other sections' photos here.
   */
  const scopedFromProps = useMemo(() => {
    const list = Array.isArray(photos) ? photos : [];
    const scope: PhotoScope = { floor, section, auditId };
    return sortPhotosOldestFirst(list.filter((photo) => photo && photoInScope(photo, scope)));
  }, [photos, floor, section, auditId]);

  useEffect(() => {
    // Adopt the parent's list only when this instance has nothing to show yet
    // (e.g. a resumed Draft is loaded after mount). Anything beyond that is
    // deliberately ignored: after every change this component makes it re-reads
    // the section itself, so a half-updated parent copy must never be able to
    // wipe a row the server has already confirmed.
    if (serverPhotosRef.current.length > 0 || scopedFromProps.length === 0) return;
    lastEmittedRef.current = photoSignature(scopedFromProps);
    serverPhotosRef.current = scopedFromProps;
    setServerPhotos(scopedFromProps);
  }, [scopedFromProps]);

  const pendingSig = useMemo(
    () => pending.map((item) => `${item.attemptId}:${item.status}`).join(','),
    [pending]
  );

  const visiblePending = useMemo(
    () => pending.filter((item) => item.destination.floor === floor && item.destination.section === section),
    [pending, floor, section]
  );

  const savedCount = serverPhotos.length;
  const totalCount = savedCount + visiblePending.length;
  const atLimit = totalCount >= limit;
  const roomLeft = Math.max(0, limit - totalCount);
  const nothingSelected = !floor.trim() || !section.trim();

  const patchAttempt = useCallback((attemptId: string, patch: Partial<VmPendingPhoto>) => {
    setPending((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        if (item.attemptId !== attemptId) return item;
        const merged: VmPendingPhoto = { ...item, ...patch };
        let dirty = false;
        (Object.keys(patch) as (keyof VmPendingPhoto)[]).forEach((key) => {
          if (item[key] !== merged[key]) dirty = true;
        });
        if (!dirty) return item;
        changed = true;
        return merged;
      });
      return changed ? next : prev;
    });
  }, []);

  const dropAttempt = useCallback(
    (attemptId: string) => {
      handlesRef.current.get(attemptId)?.abort();
      handlesRef.current.delete(attemptId);
      dispatchedRef.current.delete(attemptId);
      revokePreview(attemptId);
      if (pendingRef.current.some((item) => item.attemptId === attemptId)) {
        pendingRef.current = pendingRef.current.filter((item) => item.attemptId !== attemptId);
        setPending(pendingRef.current);
      }
    },
    [revokePreview]
  );

  /**
   * Send one attempt to the server.
   *
   * `dispatchedRef` is the single-use latch: an attempt can only leave the
   * browser once per attempt id, which is what stops a re-render, an effect
   * re-run or a double click from creating a second row for one selection.
   */
  const runUpload = useCallback(
    async (attempt: VmPendingPhoto): Promise<void> => {
      if (dispatchedRef.current.has(attempt.attemptId)) return;

      const liveAuditId = auditIdRef.current;
      if (!liveAuditId) {
        // Draft not created yet: hold the file, do not drop it, do not upload it
        // somewhere else. The queue effect below fires again when auditId lands.
        patchAttempt(attempt.attemptId, {
          status: 'queued',
          reason: 'awaiting-audit',
          error: null
        });
        return;
      }

      dispatchedRef.current.add(attempt.attemptId);
      patchAttempt(attempt.attemptId, {
        status: 'uploading',
        reason: null,
        progress: 0,
        error: null
      });

      const location = currentLocationMeta();
      const meta: VmPhotoMeta = {
        floor: attempt.destination.floor,
        section: attempt.destination.section,
        pointId: attempt.destination.pointId,
        submissionId: liveAuditId,
        locationId: location.locationId,
        locationName: location.locationName
      };

      const handle = startVmPhotoUpload({
        file: attempt.file,
        meta,
        onProgress: (percent) => patchAttempt(attempt.attemptId, { progress: percent })
      });
      handlesRef.current.set(attempt.attemptId, handle);

      try {
        const result = await handle.promise;
        handlesRef.current.delete(attempt.attemptId);
        const photoId = result.photoIds[0] ?? null;
        patchAttempt(attempt.attemptId, {
          status: 'uploaded',
          photoId,
          progress: 100,
          error: null
        });

        // The instance may have been replaced by the parent's remount while this
        // was in flight. The row is persisted either way; the live instance reads
        // it back, so stop here rather than emitting into a dead scope.
        if (!mountedRef.current) return;

        let snapshot = await loadSectionPhotos();

        // `apiFetch` de-duplicates identical concurrent GETs, so two photos
        // finishing together can both be handed the first one's snapshot. The row
        // is already on the server — re-read a bounded number of times until this
        // exact id shows up, instead of letting the auditor guess.
        let rereads = 0;
        while (
          photoId &&
          mountedRef.current &&
          rereads < 2 &&
          (!snapshot || !snapshot.some((photo) => photo.id === photoId))
        ) {
          await new Promise((resolve) => window.setTimeout(resolve, 500));
          rereads += 1;
          if (!mountedRef.current) return;
          snapshot = await loadSectionPhotos();
        }
        if (!mountedRef.current) return;

        if (photoId && snapshot?.some((photo) => photo.id === photoId)) {
          dropAttempt(attempt.attemptId);
          showToast(`Photo "${attempt.fileName}" saved for ${attempt.destination.section}.`, 'success');
        } else if (photoId) {
          patchAttempt(attempt.attemptId, {
            status: 'uploaded',
            error: 'Saved on the server, but the section list has not caught up yet.'
          });
          showToast('Upload accepted — the section list is still catching up.', 'warn');
        } else {
          patchAttempt(attempt.attemptId, {
            status: 'failed',
            error: 'The server accepted the upload but returned no photo record. Tap Retry.'
          });
          showToast(`"${attempt.fileName}" has no server record yet — tap Retry.`, 'error');
        }
      } catch (err) {
        handlesRef.current.delete(attempt.attemptId);
        if (isAbortError(err)) {
          dispatchedRef.current.delete(attempt.attemptId);
          patchAttempt(attempt.attemptId, { status: 'queued', progress: 0, reason: null });
          return;
        }
        const message = errorFromUnknown(err, 'Upload failed.').message;
        patchAttempt(attempt.attemptId, { status: 'failed', error: message, progress: 0 });
        if (mountedRef.current) {
          showToast(`"${attempt.fileName}" did not upload — ${message}`, 'error');
        }
      }
    },
    [dropAttempt, loadSectionPhotos, patchAttempt]
  );

  // Flush the queue: every queued attempt that has never been dispatched goes now.
  // This is also what releases the files held while auditId was null.
  useEffect(() => {
    if (nothingSelected) return;
    pendingRef.current.forEach((item) => {
      if (item.status !== 'queued' || item.photoId) return;
      if (dispatchedRef.current.has(item.attemptId)) return;
      void runUpload(item);
    });
  }, [pendingSig, auditId, nothingSelected, runUpload]);

  /** Occupied slots = saved rows for this section + its pending previews. */
  const liveCount = useCallback((): number => {
    const scope = currentScope();
    const saved = serverPhotosRef.current.filter((photo) => photoInScope(photo, scope)).length;
    const inFlight = pendingRef.current.filter(
      (item) => item.destination.floor === scope.floor && item.destination.section === scope.section
    ).length;
    return saved + inFlight;
  }, [currentScope]);

  const enqueueFiles = useCallback(
    (
      files: File[],
      options?: {
        replacePhotoId?: string | null;
        /** Undo uses this to put a question's evidence back on the same question. */
        destination?: { floor: string; section: string; pointId: string | null };
      }
    ): VmPendingPhoto[] => {
      const destination =
        options?.destination ??
        {
          floor: scopeRef.current.floor,
          section: scopeRef.current.section,
          pointId: scopeRef.current.pointId
        };
      if (!destination.floor.trim() || !destination.section.trim()) {
        showToast('Select a floor and section before adding inspection photos.', 'error');
        return [];
      }

      const occupied = liveCount() - (options?.replacePhotoId ? 1 : 0);
      const result = validatePhotoSelection(files, { occupied, maxPhotos: limit });
      result.errors.forEach((message) => showToast(message, 'error'));
      if (result.accepted.length === 0) return [];

      const created: VmPendingPhoto[] = result.accepted.map((file) => {
        const previewUrl = URL.createObjectURL(file);
        const attemptId = newAttemptId();
        objectUrlsRef.current.set(attemptId, previewUrl);
        return {
          attemptId,
          photoId: null,
          file,
          previewUrl,
          fileName: file.name,
          fileSize: file.size,
          status: 'queued' as VmUploadStatus,
          progress: 0,
          error: null,
          reason: null,
          destination,
          replacePhotoId: options?.replacePhotoId ?? null
        };
      });

      // pendingRef is written synchronously as well as through setState, so a
      // second pick that arrives before this render can never overrun the cap.
      pendingRef.current = [...pendingRef.current, ...created];
      setPending(pendingRef.current);
      return created;
    },
    [limit, liveCount]
  );

  /* ── pickers ─────────────────────────────────────────────────── */

  const handleGalleryFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const files = Array.from(input.files || []);
    input.value = ''; // a re-render must never re-fire the same change event
    if (files.length === 0) return;
    const created = enqueueFiles(files);
    if (created.length > 0 && created.length < files.length) {
      showToast(
        `${created.length} of ${files.length} photo(s) added — the rest were rejected.`,
        'warn'
      );
    }
  };

  const handleCameraFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const files = Array.from(input.files || []);
    input.value = '';
    if (files.length === 0) return;
    enqueueFiles(files);
  };

  const handleCapturedFromModal = (file: File) => {
    const invalid = validatePhotoFile(file);
    if (invalid) {
      showToast(invalid, 'error');
      return;
    }
    if (liveCount() >= limit) {
      showToast(capMessage(limit), 'error');
      return;
    }
    enqueueFiles([file]);
  };

  const openTakePhoto = () => {
    if (disabled || atLimit || nothingSelected) return;
    if (canUseInAppCamera) {
      setCameraOpen(true);
      return;
    }
    captureInputRef.current?.click();
  };

  const openGalleryPicker = () => {
    if (disabled || atLimit || nothingSelected) return;
    galleryInputRef.current?.click();
  };

  /* ── per-photo actions ───────────────────────────────────────── */

  const retryAttempt = useCallback(
    (attemptId: string) => {
      const target = pendingRef.current.find((item) => item.attemptId === attemptId);
      if (!target) return;
      if (target.status === 'uploading') return;
      if (target.photoId) {
        // A row exists already — re-sending the bytes would duplicate it.
        showToast('This photo is already saved. Re-reading the section list.', 'info');
        void loadSectionPhotos();
        return;
      }
      // Row-less attempt: safe to clear the latch and send exactly this file again.
      dispatchedRef.current.delete(attemptId);
      patchAttempt(attemptId, { status: 'queued', error: null, progress: 0, reason: null });
    },
    [loadSectionPhotos, patchAttempt]
  );

  const discardAttempt = useCallback(
    (attemptId: string) => {
      const target = pendingRef.current.find((item) => item.attemptId === attemptId);
      if (!target) return;
      if (target.status === 'uploading') {
        showToast('This photo is uploading — wait for it to finish before removing it.', 'warn');
        return;
      }
      dropAttempt(attemptId);
      showToast('Photo discarded before upload.', 'info');
    },
    [dropAttempt]
  );

  const armUndo = useCallback(
    (photo: VmPhoto, blob: Blob | null) => {
      if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current);
      undoBytesRef.current = blob;
      setUndoPhoto(photo);
      undoTimerRef.current = window.setTimeout(() => {
        undoTimerRef.current = null;
        undoBytesRef.current = null;
        setUndoPhoto(null);
      }, UNDO_WINDOW_MS);
    },
    []
  );

  const removeServerPhoto = async () => {
    const photo = confirmPhoto;
    if (!photo || deleting) return;
    setDeleting(true);
    try {
      // Snapshot the bytes first: the DELETE is a soft delete, and
      // GET /vm/photos/:id/file only serves non-deleted rows, so Undo has to read
      // the image while it is still there.
      const blob = await fetchPhotoBytes(photo).catch(() => null);

      const res = await API.deleteVmPhoto(photo.id);
      if (res && res.success === false) {
        throw new Error(
          typeof res.message === 'string' && res.message
            ? res.message
            : 'The server refused to delete this photo.'
        );
      }

      const optimistic = serverPhotosRef.current.filter((item) => item.id !== photo.id);
      applyServerPhotos(optimistic);
      setConfirmPhoto(null);

      const fresh = await loadSectionPhotos(); // reconcile: the server is the truth
      if (!fresh) {
        showToast('The photo was deleted, but the section list could not be re-read.', 'warn');
      }

      armUndo(photo, blob);
      showToast(
        blob
          ? `Photo "${photo.fileName}" removed — Undo for ${UNDO_WINDOW_MS / 1000}s.`
          : `Photo "${photo.fileName}" removed. Re-upload it if you need it back.`,
        'warn'
      );
    } catch (err) {
      showToast(`Could not remove the photo — ${errorFromUnknown(err, 'Server error.').message}`, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const restoreUndonePhoto = async () => {
    const photo = undoPhoto;
    if (!photo || undoBusy) return;
    setUndoBusy(true);
    try {
      let blob = undoBytesRef.current;
      if (!blob) {
        blob = await fetchPhotoBytes(photo).catch(() => null);
      }
      if (!blob) {
        showToast(
          'The original image could not be read back from the server, so this photo cannot be restored.',
          'error'
        );
        clearUndo();
        return;
      }
      const file = fileFromBlob(blob, photo.fileName);
      const invalid = validatePhotoFile(file);
      if (invalid) {
        showToast(invalid, 'error');
        clearUndo();
        return;
      }
      const created = enqueueFiles([file], {
        destination: {
          floor: photo.floor || scopeRef.current.floor,
          section: photo.section || scopeRef.current.section,
          pointId: photo.pointId ?? null
        }
      });
      if (created.length === 0) {
        showToast(capMessage(limit), 'error');
        return;
      }
      clearUndo();
      showToast(`Restoring "${photo.fileName}"…`, 'info');
    } finally {
      setUndoBusy(false);
    }
  };

  /**
   * Saves an observation against one image. The server is authoritative — the list
   * is re-read afterwards rather than trusting the optimistic value — so a failed
   * PATCH can never leave a caption on screen that was never stored.
   */
  const handleSaveCaption = async (photo: VmPhoto, caption: string) => {
    try {
      const res: any = await API.updateVmPhotoMetadata(photo.id, { caption: caption || null });
      if (res && res.success === false) throw new Error(res.message || 'save failed');
      await loadSectionPhotos();
      showToast('Photo details updated successfully.', 'success');
    } catch (err) {
      const message = errorFromUnknown(err, 'Unable to save the photo observation.').message;
      showToast(message, 'error');
    }
  };

  const startReplace = (photo: VmPhoto) => {
    if (disabled) return;
    replaceTargetRef.current = photo;
    replaceInputRef.current?.click();
  };

  const handleReplaceFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const files = Array.from(input.files || []);
    input.value = '';
    const oldPhoto = replaceTargetRef.current;
    replaceTargetRef.current = null;
    if (!oldPhoto || files.length === 0) return;

    const replacement = files[0];
    const invalid = validatePhotoFile(replacement);
    if (invalid) {
      showToast(invalid, 'error');
      return;
    }

    setBusyPhotoId(oldPhoto.id);
    let blob: Blob | null = null;
    try {
      blob = await fetchPhotoBytes(oldPhoto).catch(() => null);
      const res = await API.deleteVmPhoto(oldPhoto.id);
      if (res && res.success === false) {
        throw new Error(
          typeof res.message === 'string' && res.message
            ? res.message
            : 'The server refused to delete the photo being replaced.'
        );
      }
      applyServerPhotos(serverPhotosRef.current.filter((item) => item.id !== oldPhoto.id));
    } catch (err) {
      setBusyPhotoId(null);
      showToast(
        `"${oldPhoto.fileName}" is still saved — the replacement was not sent (${errorFromUnknown(
          err,
          'Server error.'
        ).message})`,
        'error'
      );
      return;
    }
    setBusyPhotoId(null);

    // The old row is gone, so the new file takes its exact slot in this section —
    // including the question it was evidence for.
    const created = enqueueFiles([replacement], {
      replacePhotoId: oldPhoto.id,
      destination: {
        floor: oldPhoto.floor || scopeRef.current.floor,
        section: oldPhoto.section || scopeRef.current.section,
        pointId: oldPhoto.pointId ?? null
      }
    });
    if (created.length === 0) {
      void loadSectionPhotos();
      showToast(
        `The original photo was removed but the replacement was not accepted. Add it again.`,
        'warn'
      );
      return;
    }
    armUndo(oldPhoto, blob);
    showToast(`Uploading the replacement for "${oldPhoto.fileName}".`, 'info');
  };

  /* ── viewer ──────────────────────────────────────────────────── */

  const lightboxItems = useMemo((): LightboxPhotoItem[] => {
    const scopeLabelFloor = floor;
    const scopeLabelSection = section;
    return [
      ...serverPhotos.map((photo) => ({
        id: photo.id,
        url: photo.url,
        fileName: photo.fileName,
        fileSize: photo.fileSize,
        status: null,
        floor: photo.floor || scopeLabelFloor,
        section: photo.section || scopeLabelSection,
        pointId: photo.pointId ?? null,
        uploadedBy: photo.uploadedBy ?? null,
        inspectionDate: photo.inspectionDate ?? null,
        createdAt: photo.createdAt ?? null,
        local: false
      })),
      ...visiblePending.map((item) => ({
        id: item.attemptId,
        url: item.previewUrl,
        fileName: item.fileName,
        fileSize: item.fileSize,
        status: item.status,
        floor: item.destination.floor,
        section: item.destination.section,
        pointId: item.destination.pointId,
        uploadedBy: null,
        inspectionDate: null,
        createdAt: null,
        local: true
      }))
    ];
  }, [serverPhotos, visiblePending, floor, section]);

  const openViewer = (index: number, photo?: VmPhoto) => {
    if (lightboxItems.length === 0) return;
    setLightboxIndex(Math.min(Math.max(index, 0), lightboxItems.length - 1));
    // The lightbox is always rendered here, so [View] is never a dead button.
    // `onView` additionally tells the parent which photo the auditor opened; it is
    // notified, not delegated to.
    if (photo) callbacksRef.current.onView?.(photo);
  };

  const closeViewer = () => setLightboxIndex(null);

  /* ── render ──────────────────────────────────────────────────── */

  const scopeLabel = `${floor || 'No floor'} — ${section || 'No section'}`;
  const pickBlockedReason = disabled
    ? 'This audit is read-only, so photos cannot be added or removed.'
    : nothingSelected
      ? 'Pick a floor and section to load its photo gallery.'
      : atLimit
        ? capMessage(limit)
        : '';

  return (
    <section
      className="rounded-2xl border border-[#E8D9D4] bg-[#FFFDFC] p-3 sm:p-4 shadow-[0_2px_10px_rgba(74,23,58,0.05)]"
      aria-label="Section inspection photos"
    >
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,.jpg,.jpeg,.png"
        multiple
        className="hidden"
        onChange={handleGalleryFiles}
        aria-hidden="true"
        tabIndex={-1}
      />
      {/* Fallback for devices without getUserMedia: the OS camera, not a path box. */}
      <input
        ref={captureInputRef}
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        className="hidden"
        onChange={handleCameraFiles}
        aria-hidden="true"
        tabIndex={-1}
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/jpeg,image/png,.jpg,.jpeg,.png"
        className="hidden"
        onChange={handleReplaceFiles}
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h3 className="text-[15px] sm:text-base font-black text-[#4A173A] tracking-tight flex items-center gap-2">
            <Camera className="w-4 h-4 text-[#B76E79] shrink-0" aria-hidden="true" />
            Section Inspection Photos
          </h3>
          <p className="mt-1 text-xs font-bold text-[#6F5963] truncate">
            {scopeLabel}
            {pointId ? <span className="ml-1 text-[#B76E79]">· evidence for this question</span> : null}
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-[#9A858D]">
            JPG or PNG only · {MAX_FILE_RULE} · up to {limit} per section
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-1 text-[11px] font-black tabular-nums ${
              atLimit
                ? 'border-[#F2BDB8] bg-[#FDE8E7] text-[#8F1D14]'
                : 'border-[#E8D9D4] bg-[#FFF7F2] text-[#4A173A]'
            }`}
            aria-live="polite"
          >
            {totalCount} / {limit} Photos
            {!atLimit && totalCount > 0 ? <span className="font-bold"> · {roomLeft} left</span> : null}
          </span>
          {!loadingList && !listError && totalCount > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-[#0F6B45]">
              <CircleCheck className="w-3.5 h-3.5" aria-hidden="true" />
              {savedCount} saved
            </span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={openTakePhoto}
          disabled={disabled || atLimit || nothingSelected}
          className="min-h-[44px] flex-1 xs:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-[#4A173A] px-4 py-2.5 text-xs font-black text-white shadow-sm hover:bg-[#6A2853] disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <Camera className="w-4 h-4" aria-hidden="true" />
          Take Photo
        </button>
        <button
          type="button"
          onClick={openGalleryPicker}
          disabled={disabled || atLimit || nothingSelected}
          className="min-h-[44px] flex-1 xs:flex-none inline-flex items-center justify-center gap-2 rounded-xl border border-[#B76E79] bg-white px-4 py-2.5 text-xs font-black text-[#6A2853] hover:bg-[#FFF7F2] disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <Images className="w-4 h-4" aria-hidden="true" />
          Choose from Gallery
        </button>
        {(atLimit || disabled || nothingSelected) && pickBlockedReason ? (
          <p className="w-full text-[11px] font-bold text-[#8F1D14] flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
            {pickBlockedReason}
          </p>
        ) : null}
      </div>

      {/* Undo bar — Remove is reversible, so a mis-tap cannot lose evidence */}
      {undoPhoto ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-[#E7C98A] bg-[#FFF4D6] px-3 py-2.5">
          <Undo2 className="w-4 h-4 text-[#8A5A06] shrink-0" aria-hidden="true" />
          <p className="text-[11px] font-bold text-[#5C3D06] min-w-0 flex-1">
            Removed "{undoPhoto.fileName}" from this section.
          </p>
          <button
            type="button"
            onClick={restoreUndonePhoto}
            disabled={undoBusy || disabled}
            className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg bg-[#4A173A] px-3 py-2 text-[11px] font-black text-white hover:bg-[#6A2853] disabled:opacity-50 transition-colors cursor-pointer"
          >
            {undoBusy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Undo2 className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            Undo
          </button>
          <button
            type="button"
            onClick={clearUndo}
            className="min-h-[38px] rounded-lg border border-[#E7C98A] px-3 py-2 text-[11px] font-bold text-[#8A5A06] hover:bg-[#FBEAC6] transition-colors cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {/* Loading / error / empty */}
      {loadingList ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#E8D9D4] bg-[#FFF7F2] px-3 py-4">
          <Loader2 className="w-4 h-4 animate-spin text-[#B76E79]" aria-hidden="true" />
          <p className="text-xs font-bold text-[#6F5963]">Loading photos…</p>
        </div>
      ) : listError ? (
        <div className="mt-3 rounded-xl border border-[#F2BDB8] bg-[#FDE8E7] px-3 py-3.5">
          <p className="text-xs font-black text-[#8F1D14] flex items-center gap-2">
            <CloudOff className="w-4 h-4 shrink-0" aria-hidden="true" />
            Could not load this section's photos.
          </p>
          <p className="mt-1 text-[11px] font-semibold text-[#8F1D14]/85 break-words">{listError}</p>
          <button
            type="button"
            onClick={() => void loadSectionPhotos()}
            className="mt-2.5 min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-[#4A173A] px-3.5 py-2 text-[11px] font-black text-white hover:bg-[#6A2853] transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : totalCount === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-[#E8D9D4] bg-[#FFF7F2] px-3 py-6 text-center">
          <ImageOff className="w-7 h-7 mx-auto text-[#C9A0AA]" aria-hidden="true" />
          <p className="mt-2 text-xs font-black text-[#4A173A]">No photos for this section yet.</p>
          <p className="mt-1 text-[11px] font-semibold text-[#6F5963]">
            Take one with the camera or pick it from the gallery — it saves to the server immediately.
          </p>
        </div>
      ) : null}

      {/* Gallery: 2-up on a phone, more columns on tablet/desktop */}
      {!loadingList && totalCount > 0 ? (
        <div
          className="mt-3 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3"
        >
          {serverPhotos.map((photo, index) => (
            <SavedPhotoTile
              key={photo.id}
              photo={photo}
              number={index + 1}
              scopeLabel={scopeLabel}
              busy={busyPhotoId === photo.id}
              canEdit={!disabled}
              onView={() => openViewer(index, photo)}
              onRemove={() => setConfirmPhoto(photo)}
              onReplace={() => startReplace(photo)}
              onSaveCaption={handleSaveCaption}
            />
          ))}
          {visiblePending.map((attempt, index) => (
            <PendingPhotoTile
              key={attempt.attemptId}
              attempt={attempt}
              number={savedCount + index + 1}
              scopeLabel={scopeLabel}
              canEdit={!disabled}
              onView={() => openViewer(savedCount + index)}
              onRetry={() => retryAttempt(attempt.attemptId)}
              onDiscard={() => discardAttempt(attempt.attemptId)}
            />
          ))}
        </div>
      ) : null}

      <p className="mt-3 text-[11px] font-semibold text-[#9A858D] leading-relaxed">
        Photos are stored on the server against this audit ({auditId ? `#${auditId}` : 'audit not created yet'})
        , so they survive a refresh or signing out. {!canUseInAppCamera ? 'This device uses the built-in camera app for Take Photo.' : ''}
      </p>

      {/* Camera capture — the app's existing in-app camera, not a reimplementation */}
      <VmCameraModal
        isOpen={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onPhotoCaptured={handleCapturedFromModal}
        floor={floor || 'Store'}
        section={section || 'Section'}
      />

      {/* Remove confirmation */}
      {confirmPhoto ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm photo removal"
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => (deleting ? undefined : setConfirmPhoto(null))}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[#E8D9D4] bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h4 className="text-sm font-black text-[#4A173A]">Remove this photo?</h4>
            <p className="mt-1.5 text-xs font-semibold text-[#6F5963] break-words">
              "{confirmPhoto.fileName}" ({formatBytes(confirmPhoto.fileSize)}) will be deleted from{' '}
              {confirmPhoto.floor || floor} — {confirmPhoto.section || section}. You can undo it for{' '}
              {UNDO_WINDOW_MS / 1000} seconds afterwards.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmPhoto(null)}
                disabled={deleting}
                className="flex-1 min-h-[44px] rounded-xl border border-[#E8D9D4] bg-white px-3 py-2.5 text-xs font-black text-[#4A173A] hover:bg-[#FFF7F2] disabled:opacity-50 transition-colors cursor-pointer"
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={() => void removeServerPhoto()}
                disabled={deleting}
                className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#B42318] px-3 py-2.5 text-xs font-black text-white hover:bg-[#98170E] disabled:opacity-60 transition-colors cursor-pointer"
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                )}
                {deleting ? 'Removing' : 'Remove photo'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Full-size viewer. Never mounted with an empty list: the lightbox locks
          page scrolling while it is open, so it must unmount as soon as the last
          photo of this section disappears (removed or uploaded meanwhile). */}
      {lightboxIndex !== null && lightboxItems.length > 0 ? (
        <PhotoLightbox
          items={lightboxItems}
          startIndex={Math.min(lightboxIndex, lightboxItems.length - 1)}
          onClose={closeViewer}
        />
      ) : null}
    </section>
  );
}
