/**
 * photoUtils.ts — the non-JSX half of the VM Checklist section photo area.
 *
 * Everything here is pure or network-level, so `PhotoUploader.tsx` stays about
 * rendering and state:
 *
 *   • client-side validation (JPG/PNG only, 5 MB per file, 5 per section) that
 *     reports the *real* reason, because a store employee has to know which of
 *     the four photos they just picked was rejected and why;
 *   • `VmPhoto` normalisation from whatever the photo endpoints return
 *     (`mapVmPhoto()` in backend/src/controllers/vmPhotoController.js already
 *     sends camelCase, but audit-detail and legacy paths still leak snake_case);
 *   • an XMLHttpRequest uploader, because `apiFetch` can only resolve or throw —
 *     it can never report bytes moved, and per-photo progress is a hard
 *     requirement here. It targets the exact same endpoint, field name and auth
 *     headers as `API.uploadVmPhotos`, so the backend cannot tell the difference;
 *   • an authenticated byte fetch used by Remove → Undo, so a removed photo can
 *     be re-saved from its original bytes instead of being faked from state.
 *
 * Deliberately *not* here: the inspection date. `vmTypes.ts` and the backend
 * both state that the audit day is the server's Asia/Kolkata calendar day;
 * sending a browser-derived date would reintroduce the UTC off-by-one bug that
 * `getISTDateString()` was written to fix. The browser sends no date and the
 * server stamps it.
 */
import { API, Auth, getCsrfToken } from '../../services/api';
import type { VmPhoto } from './vmTypes';

/** api.ts `getApiBase()` is `/api`; this is the same route `API.uploadVmPhotos` posts to. */
export const VM_PHOTO_ENDPOINT = '/api/vm/photos';

/** Mirrors backend `VM_PHOTO_LIMITS` (upload.js) and `VM_MAX_IMAGE_SIZE_BYTES` (vmPhotoController.js). */
export const VM_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const VM_MAX_FILE_LABEL = '5 MB';
export const VM_DEFAULT_MAX_PHOTOS = 5;

/** The checklist accepts flat raster stills only — no HEIC, no screenshots of PDFs. */
export const VM_ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png'];
const VM_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

export type VmUploadStatus = 'queued' | 'uploading' | 'uploaded' | 'failed';

/** Why a photo is still sitting in the queue instead of on the wire. */
export type VmQueueReason = 'awaiting-audit' | null;

/**
 * One selected file and its upload attempt.
 *
 * `attemptId` is the de-dupe key: a file is given exactly one attempt, the
 * uploader refuses to dispatch an attempt twice, and Retry only ever re-sends an
 * attempt that never received a server row — so one selection can never become
 * two rows in `vm_checklist_photos`.
 */
export interface VmPendingPhoto {
  attemptId: string;
  /** Server row id once the POST has been acknowledged; null until then. */
  photoId: string | null;
  file: File;
  /** Object URL for the immediate preview. Revoked on remove/commit/unmount. */
  previewUrl: string;
  fileName: string;
  fileSize: number;
  status: VmUploadStatus;
  /** 0-100, or 0 when nothing has been sent yet. */
  progress: number;
  error: string | null;
  reason: VmQueueReason;
  /**
   * Where this file belongs, frozen at the moment it was picked. The parent can
   * change floor/section/pointId while an attempt is still queued, and a photo
   * shot for Silk Sarees must never be filed under Normal Sarees because the
   * user navigated while the browser had the file.
   */
  destination: { floor: string; section: string; pointId: string | null };
  /** Set by [Replace]: the row that this upload takes the place of. */
  replacePhotoId?: string | null;
}

/** A photo the lightbox can show — a saved row or a local not-yet-uploaded preview. */
export interface LightboxPhotoItem {
  id: string;
  url: string;
  fileName: string;
  fileSize: number;
  /** Null for saved photos: they are on the server. */
  status: VmUploadStatus | null;
  floor: string;
  section: string;
  pointId?: string | null;
  uploadedBy?: string | null;
  inspectionDate?: string | null;
  createdAt?: string | null;
  /** True when `url` is a local object URL, so the viewer can say so honestly. */
  local?: boolean;
}

export interface PhotoScope {
  floor: string;
  section: string;
  auditId: string | null;
}

/** Multipart fields accepted by `POST /vm/photos` (see api.ts `uploadVmPhotos`). */
export interface VmPhotoMeta {
  floor?: string;
  section?: string;
  pointId?: string | null;
  submissionId?: string | null;
  locationId?: string | number | null;
  locationName?: string | null;
}

/* ── small formatters ─────────────────────────────────────────────── */

export function formatBytes(bytes: number): string {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) {
    const kb = n / 1024;
    return `${kb >= 100 ? Math.round(kb) : kb.toFixed(1)} KB`;
  }
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** `8.4 MB / 5 MB` — the cap line under the counter. */
export const MAX_FILE_RULE = `${VM_MAX_FILE_LABEL} per photo`;

export function formatPhotoDate(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  const isoDay = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDay) return isoDay[1];
  return raw;
}

export function photoLabel(photo: VmPhoto | LightboxPhotoItem): string {
  return photo.pointId ? 'Question evidence' : 'Section shot';
}

/* ── validation ───────────────────────────────────────────────────── */

export function fileExtension(name: string): string {
  const raw = String(name || '');
  const dot = raw.lastIndexOf('.');
  return dot > -1 ? raw.slice(dot).toLowerCase() : '';
}

export function isJpgOrPng(file: File): boolean {
  const ext = fileExtension(file.name);
  if (VM_ALLOWED_EXTENSIONS.includes(ext)) return true;
  const mime = String(file.type || '').toLowerCase();
  return VM_ALLOWED_MIME_TYPES.includes(mime);
}

export function capMessage(maxPhotos: number): string {
  return `This section already has ${maxPhotos} photos. Remove one to add another.`;
}

/** One file, one real reason — null means it may go to the server. */
export function validatePhotoFile(file: File): string | null {
  if (!isJpgOrPng(file)) {
    return `"${file.name}" is not a JPG or PNG image.`;
  }
  if (file.size > VM_MAX_FILE_BYTES) {
    return `"${file.name}" is ${formatBytes(file.size)} — the limit is ${VM_MAX_FILE_LABEL}.`;
  }
  if (file.size <= 0) {
    return `"${file.name}" is empty — re-take the photo.`;
  }
  return null;
}

export interface PhotoSelectionResult {
  accepted: File[];
  /** Ordered, de-duplicated, human-readable rejection reasons. */
  errors: string[];
  /** True when the section cap stopped the selection mid-way. */
  capped: boolean;
}

/**
 * Validate a whole pick against the remaining room in the section.
 *
 * Rejects bad files individually instead of failing the batch, and never lets a
 * 12-photo gallery pick silently become 5.
 */
export function validatePhotoSelection(
  files: File[],
  opts: { occupied: number; maxPhotos: number }
): PhotoSelectionResult {
  const maxPhotos = Math.max(1, Math.floor(Number(opts.maxPhotos) || VM_DEFAULT_MAX_PHOTOS));
  const occupied = Math.max(0, Math.floor(Number(opts.occupied) || 0));
  const accepted: File[] = [];
  const errors: string[] = [];
  let capped = false;

  const push = (message: string) => {
    if (!errors.includes(message)) errors.push(message);
  };

  if (occupied >= maxPhotos) {
    push(capMessage(maxPhotos));
    return { accepted, errors, capped: true };
  }

  const seen = new Set<string>();
  for (const file of files) {
    if (occupied + accepted.length >= maxPhotos) {
      push(capMessage(maxPhotos));
      capped = true;
      break;
    }
    const key = `${file.name.toLowerCase()}|${file.size}|${file.lastModified}`;
    if (seen.has(key)) {
      push(`"${file.name}" was picked twice in this selection — added once.`);
      continue;
    }
    const invalid = validatePhotoFile(file);
    if (invalid) {
      push(invalid);
      continue;
    }
    seen.add(key);
    accepted.push(file);
  }

  return { accepted, errors, capped };
}

/* ── server response normalisation ────────────────────────────────── */

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : null;

function pickStr(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function pickNum(row: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = Number(row[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function pickNullableStr(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (value === undefined || value === null) continue;
    if (value === '') return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  }
  return null;
}

/** Ensure the photo URL always points at the authenticated stream route. */
export function resolvePhotoUrl(photo: Pick<VmPhoto, 'id' | 'url'>): string {
  const raw = String(photo.url || '').trim();
  if (raw && /^\/api\/vm\/photos\//.test(raw)) return raw;
  if (raw && /^https?:\/\//.test(raw)) return raw;
  return API.getVmPhotoFileUrl(photo.id);
}

/** One `vm_checklist_photos` row → the frozen `VmPhoto` contract. */
export function toVmPhoto(raw: unknown): VmPhoto | null {
  const row = asRecord(raw);
  if (!row) return null;
  const id = pickStr(row, ['id', 'photoId', 'photo_id']);
  if (!id) return null;

  const url = pickStr(row, ['url', 'streamUrl', 'stream_url']) || API.getVmPhotoFileUrl(id);

  return {
    id,
    submissionId: pickNullableStr(row, ['submissionId', 'submission_id']),
    floor: pickStr(row, ['floor']),
    section: pickStr(row, ['section']),
    pointId: pickNullableStr(row, ['pointId', 'point_id']),
    fileName: pickStr(row, ['fileName', 'file_name', 'original_name']) || 'vm-photo.jpg',
    fileSize: pickNum(row, ['fileSize', 'file_size']),
    mimeType: pickNullableStr(row, ['mimeType', 'mime_type']),
    uploadedBy: pickNullableStr(row, ['uploadedBy', 'uploaded_by']),
    inspectionDate: pickNullableStr(row, ['inspectionDate', 'inspection_date']),
    createdAt: pickNullableStr(row, ['createdAt', 'created_at']),
    url: resolvePhotoUrl({ id, url })
  };
}

/** `{ success, photos: [...] }` (or a bare array) → `VmPhoto[]`. Never throws. */
export function parsePhotoListResponse(raw: unknown): VmPhoto[] {
  const row = asRecord(raw);
  const list = Array.isArray(row?.photos)
    ? (row!.photos as unknown[])
    : Array.isArray(raw)
      ? (raw as unknown[])
      : [];
  const out: VmPhoto[] = [];
  for (const item of list) {
    const photo = toVmPhoto(item);
    if (photo && !out.some((p) => p.id === photo.id)) out.push(photo);
  }
  return out;
}

/**
 * Section-scoped gallery rule: a shot taken for Silk Sarees must never surface
 * under Normal Sarees, and an audit's evidence must never leak into the next
 * audit. The server filters too — this is the client-side proof of it, because
 * the parent hands us its own `photos` array which may be audit-wide.
 */
export function photoInScope(photo: VmPhoto, scope: PhotoScope): boolean {
  if (!scope.floor.trim() || !scope.section.trim()) return false;
  if (String(photo.floor) !== String(scope.floor)) return false;
  if (String(photo.section) !== String(scope.section)) return false;
  if (scope.auditId && String(photo.submissionId ?? '') !== String(scope.auditId)) return false;
  return true;
}

/** Oldest first, so photo numbers stay stable while a section fills up. */
export function sortPhotosOldestFirst(photos: VmPhoto[]): VmPhoto[] {
  return [...photos].sort((a, b) => {
    const at = Date.parse(String(a.createdAt || ''));
    const bt = Date.parse(String(b.createdAt || ''));
    if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return at - bt;
    return String(a.id).localeCompare(String(b.id));
  });
}

export function photoSignature(photos: VmPhoto[]): string {
  return photos.map((p) => p.id).join('|');
}

export function newAttemptId(): string {
  const rand = Math.random().toString(36).slice(2, 9);
  return `vm_attempt_${Date.now().toString(36)}_${rand}`;
}

/* ── auth headers (XHR mirror of apiFetch) ────────────────────────── */

/**
 * Rebuild the headers `apiFetch` attaches, because a progress-reporting XHR has
 * to opt in by hand. Kept in sync deliberately: Bearer + `x-auth-token`
 * fallback, the double-submit CSRF cookie, device id and the multi-location
 * header. No storage credential is read or sent here — the backend owns the
 * disk path.
 */
export function buildVmAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const session = Auth.get();
  const token = Auth.getToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers['x-auth-token'] = token;
  }
  const csrf = getCsrfToken();
  if (csrf) headers['x-csrf-token'] = csrf;

  try {
    const deviceId = typeof localStorage !== 'undefined' ? localStorage.getItem('bsc_chat_device_id') : null;
    if (deviceId) headers['x-device-id'] = deviceId;
  } catch {
    /* storage blocked — the session headers above are still enough */
  }

  const storage = typeof localStorage !== 'undefined' ? localStorage : null;
  const activeLoc = storage ? storage.getItem('bsc_selected_location') : null;
  const isGlobal =
    !session?.locationId ||
    session?.isGlobalAdmin ||
    ['Admin', 'Super Admin'].includes(String(session?.role || ''));

  if (!isGlobal && session?.locationId) {
    const allowed =
      Array.isArray(session.allowedLocations) && session.allowedLocations.length > 0
        ? session.allowedLocations.map((id) => String(id))
        : [String(session.locationId)];
    headers['X-Location-Id'] =
      activeLoc && allowed.includes(activeLoc) ? activeLoc : String(session.locationId);
  } else if (activeLoc && activeLoc !== 'ALL') {
    headers['X-Location-Id'] = activeLoc;
  }

  return headers;
}

/** Store context for the multipart body — `Auth` session only, never typed by the user. */
export function currentLocationMeta(): { locationId: string | null; locationName: string | null } {
  const session = Auth.get();
  return {
    locationId: session?.locationId != null ? String(session.locationId) : null,
    locationName: session?.locationName ? String(session.locationName) : null
  };
}

/**
 * Exactly the fields `API.uploadVmPhotos` sends (both camelCase and snake_case
 * spellings, since the controller accepts either), with one file under the
 * `photos` field the route declares.
 */
export function buildPhotoFormData(file: File, meta: VmPhotoMeta): FormData {
  const fd = new FormData();
  fd.append('photos', file, file.name);
  if (meta.floor) fd.append('floor', meta.floor);
  if (meta.section) fd.append('section', meta.section);
  if (meta.submissionId) {
    fd.append('submissionId', String(meta.submissionId));
    fd.append('submission_id', String(meta.submissionId));
  }
  if (meta.pointId) {
    fd.append('pointId', String(meta.pointId));
    fd.append('point_id', String(meta.pointId));
  }
  if (meta.locationId != null && String(meta.locationId) !== '') {
    fd.append('locationId', String(meta.locationId));
    fd.append('location_id', String(meta.locationId));
  }
  if (meta.locationName) {
    fd.append('location_name', String(meta.locationName));
    fd.append('locationName', String(meta.locationName));
  }
  return fd;
}

/* ── errors ───────────────────────────────────────────────────────── */

export interface VmError extends Error {
  status?: number;
  aborted?: boolean;
}

export function errorFromUnknown(err: unknown, fallback: string): VmError {
  if (err instanceof Error) return err as VmError;
  const wrapped: VmError = new Error(typeof err === 'string' && err ? err : fallback);
  return wrapped;
}

/** Turn an upload failure into the sentence a store employee can act on. */
export function readableUploadError(body: unknown, status: number): string {
  const row = asRecord(body);
  const fromServer =
    (typeof row?.message === 'string' && row.message) ||
    (typeof row?.error === 'string' && row.error) ||
    (typeof asRecord(row?.error)?.message === 'string' ? String(asRecord(row?.error)!.message) : '');
  if (fromServer) return fromServer;

  switch (status) {
    case 400:
    case 422:
      return 'The server rejected this photo. Check it is a JPG or PNG under 5 MB, then tap Retry.';
    case 401:
      return 'Your session expired — sign in again, then tap Retry.';
    case 403:
      return 'Your role cannot attach VM inspection photos to this store.';
    case 404:
      return 'The audit this photo belongs to no longer exists, so it cannot be saved.';
    case 413:
      return `The photo is larger than the server accepts (${VM_MAX_FILE_LABEL}).`;
    case 429:
      return 'Too many uploads at once — wait a few seconds and tap Retry.';
    case 0:
      return 'Network error while uploading — check the connection and tap Retry.';
    default:
      return `Upload failed (HTTP ${status}). Tap Retry to send it again.`;
  }
}

/* ── the XHR upload engine ────────────────────────────────────────── */

export interface VmUploadResult {
  /** Row ids the server created and confirmed — normally exactly one. */
  photoIds: string[];
  message: string;
}

export interface VmUploadHandle {
  promise: Promise<VmUploadResult>;
  abort: () => void;
}

/**
 * POST one file to `/vm/photos` with progress.
 *
 * One file per request on purpose: `apiFetch` would have to batch them, and a
 * batch gives no way to mark just *this* photo failed or to retry just this one.
 */
export function startVmPhotoUpload(opts: {
  file: File;
  meta: VmPhotoMeta;
  onProgress?: (percent: number) => void;
}): VmUploadHandle {
  const xhr = new XMLHttpRequest();
  let aborted = false;

  const promise = new Promise<VmUploadResult>((resolve, reject) => {
    xhr.open('POST', VM_PHOTO_ENDPOINT, true);
    xhr.withCredentials = true;
    xhr.responseType = 'text';

    const headers = buildVmAuthHeaders();
    Object.keys(headers).forEach((key) => {
      try {
        xhr.setRequestHeader(key, headers[key]);
      } catch {
        /* forbidden header — the cookie already carries it */
      }
    });

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        // 99% until the server has answered: bytes leaving the browser is not
        // the same claim as a row existing, and the UI must not overstate it.
        opts.onProgress?.(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      }
    };

    xhr.onload = () => {
      if (aborted) return;
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText || 'null');
      } catch {
        body = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        const row = asRecord(body);
        if (row && row.success === false) {
          const failure: VmError = new Error(readableUploadError(body, xhr.status));
          failure.status = xhr.status;
          reject(failure);
          return;
        }
        const photos = parsePhotoListResponse(body);
        const photoIds = photos.map((p) => p.id);
        if (photoIds.length === 0) {
          const failure: VmError = new Error(
            'The server accepted the photo but returned no record of it. Tap Retry to send it once more.'
          );
          failure.status = xhr.status;
          reject(failure);
          return;
        }
        opts.onProgress?.(100);
        resolve({
          photoIds,
          message: typeof row?.message === 'string' ? row.message : 'Photo saved on the server.'
        });
        return;
      }
      const failure: VmError = new Error(readableUploadError(body, xhr.status));
      failure.status = xhr.status;
      reject(failure);
    };

    xhr.onerror = () => {
      if (aborted) return;
      const failure: VmError = new Error(
        'Network error while uploading — check the connection and tap Retry.'
      );
      failure.status = 0;
      reject(failure);
    };

    xhr.ontimeout = () => {
      if (aborted) return;
      const failure: VmError = new Error('The upload timed out. Tap Retry to send it again.');
      failure.status = 0;
      reject(failure);
    };

    xhr.onabort = () => {
      if (aborted) return;
      const failure: VmError = new Error('Upload cancelled.');
      failure.aborted = true;
      reject(failure);
    };

    xhr.send(buildPhotoFormData(opts.file, opts.meta));
  });

  return {
    promise,
    abort: () => {
      aborted = true;
      try {
        xhr.abort();
      } catch {
        /* already finished */
      }
    }
  };
}

export const isAbortError = (err: unknown): boolean =>
  !!err && typeof err === 'object' && (err as VmError).aborted === true;

/* ── authenticated bytes, for Remove → Undo ───────────────────────── */

/**
 * Read a stored photo back as bytes. `apiFetch` always `res.json()`s, so an
 * image needs its own call — same endpoint and headers the `<img>` tag uses.
 */
export async function fetchPhotoBytes(photo: VmPhoto): Promise<Blob> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(resolvePhotoUrl(photo), {
      method: 'GET',
      credentials: 'include',
      headers: buildVmAuthHeaders(),
      signal: controller.signal
    });
    if (!res.ok) {
      throw new Error(
        res.status === 401 || res.status === 403
          ? 'You no longer have access to this photo, so it cannot be restored.'
          : `Could not read the photo back from the server (HTTP ${res.status}).`
      );
    }
    return await res.blob();
  } finally {
    clearTimeout(timeout);
  }
}

/** Rebuild a `File` from restored bytes without losing the original name. */
export function fileFromBlob(blob: Blob, fileName: string): File {
  const ext = fileExtension(fileName);
  const type =
    blob.type && VM_ALLOWED_MIME_TYPES.includes(blob.type.toLowerCase())
      ? blob.type
      : ext === '.png'
        ? 'image/png'
        : 'image/jpeg';
  const safeName = fileName && fileName.trim() ? fileName : `vm-photo${ext || '.jpg'}`;
  return new File([blob], safeName, { type, lastModified: Date.now() });
}

/* ── device capability ────────────────────────────────────────────── */

/**
 * In-app capture needs `getUserMedia`, which browsers only hand out on a secure
 * context. When it is missing, the uploader drops to `<input capture="environment">`
 * instead of showing a dead button — but nobody is ever asked for a file path.
 */
export function supportsInAppCamera(): boolean {
  if (typeof navigator === 'undefined') return false;
  const hasMedia = !!(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function');
  const secure =
    typeof window === 'undefined'
      ? false
      : Boolean(window.isSecureContext) ||
        ['localhost', '127.0.0.1', '[::1]'].includes(String(window.location?.hostname || ''));
  return hasMedia && secure;
}
