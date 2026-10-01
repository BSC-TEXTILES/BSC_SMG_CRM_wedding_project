'use strict';

/**
 * Single source of truth for where uploaded files live.
 *
 * `UPLOAD_DIR=./uploads` was resolved against `process.cwd()`, so the storage
 * location changed with the directory node was started from: run from `backend/`
 * and files land in `backend/uploads`, run from the repository root and they land
 * in `uploads/`. The database row kept pointing at whichever root wrote it, which
 * is how an upload could succeed and still show as a broken image. Everything now
 * resolves a relative `UPLOAD_DIR` against this app's own folder, and reads fall
 * back to the previous roots so records written before this change still display.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const APP_ROOT = path.join(__dirname, '..', '..'); // backend/
const REPO_ROOT = path.join(APP_ROOT, '..');

dotenv.config({ path: path.join(REPO_ROOT, '.env') });
dotenv.config({ path: path.join(APP_ROOT, '.env') });

/** Every folder an uploader may write into, across all modules. */
const UPLOAD_SUBDIRS = [
  'applicants',
  'candidate-resumes',
  'candidate-photos',
  'employee-photos',
  'employee-documents',
  'offer-letters',
  'relieving-letters',
  'experience-certificates',
  'mcheck-photos',
  'vm-checklist',
  'diverts',
  'profile-media',
  'misc'
];

function resolveUploadRoot() {
  const configured = String(process.env.UPLOAD_DIR || '').trim();
  if (!configured) return path.join(APP_ROOT, 'uploads');
  if (path.isAbsolute(configured)) return configured;
  return path.resolve(APP_ROOT, configured);
}

const UPLOAD_ROOT = resolveUploadRoot();

/** Older roots that may still hold files referenced by existing records. */
const LEGACY_UPLOAD_ROOTS = [
  path.join(REPO_ROOT, 'uploads'),
  path.join(REPO_ROOT, '..', 'uploads')
].filter((dir) => dir !== UPLOAD_ROOT);

const ALL_UPLOAD_ROOTS = [UPLOAD_ROOT, ...LEGACY_UPLOAD_ROOTS];

function ensureUploadDirs(baseDir = UPLOAD_ROOT) {
  try {
    if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
    UPLOAD_SUBDIRS.forEach((sub) => {
      const subPath = path.join(baseDir, sub);
      if (!fs.existsSync(subPath)) fs.mkdirSync(subPath, { recursive: true });
    });
    return true;
  } catch (err) {
    console.warn(`[Uploads] Could not prepare ${baseDir}: ${err.message}`);
    return false;
  }
}

/**
 * Any stored value — `/uploads/vm-checklist/a.jpg`, `uploads/applicants/X/a.jpg`,
 * `vm-checklist/a.jpg` or a bare filename — normalised to the URL form the browser
 * is given. Absolute http(s) URLs are returned untouched so cloud storage keeps
 * working if it is ever configured.
 */
function toStoredUrlPath(stored) {
  const raw = String(stored || '').trim();
  if (!raw) return null;
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;

  const relative = raw
    .split(/[?#]/)[0]
    .replace(/\\/g, '/')
    .replace(/^[A-Za-z]:\//, '')
    .replace(/^\.?\/?(?:uploads\/)?/, '')
    .split('/')
    .filter((part) => part && part !== '.' && part !== '..');

  if (relative.length === 0) return null;
  return `/uploads/${relative.join('/')}`;
}

function isInside(root, target) {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Locate the physical file behind a stored path or URL.
 *
 * Only file names and known subdirectories are ever joined, and the result has to
 * stay inside an upload root, so a crafted `../` in a database value cannot escape
 * to the filesystem.
 *
 * @param {string} stored the value from the database or the request URL
 * @param {{appNo?: string, roots?: string[]}} [options]
 * @returns {string|null} absolute path, or null when the file is genuinely absent
 */
function findStoredFile(stored, options = {}) {
  const urlPath = toStoredUrlPath(stored);
  if (!urlPath || /^https?:\/\//i.test(urlPath)) return null;

  const segments = urlPath.replace(/^\/uploads\/?/, '').split('/').filter(Boolean);
  const fileName = path.basename(segments[segments.length - 1] || '');
  if (!fileName) return null;

  const roots = options.roots || ALL_UPLOAD_ROOTS;
  const appNo = String(options.appNo || '').replace(/[^A-Za-z0-9_-]/g, '');
  const search = [];

  if (segments.length > 1) search.push(segments.join('/'));
  if (appNo) search.push(path.posix.join('applicants', appNo, fileName));
  search.push(...UPLOAD_SUBDIRS.map((sub) => path.posix.join(sub, fileName)));
  search.push(fileName);

  for (const root of roots) {
    for (const rel of search) {
      const target = path.join(root, rel);
      if (!isInside(root, target)) continue;
      try {
        if (fs.existsSync(target) && fs.statSync(target).isFile()) return target;
      } catch (err) { /* unreadable candidate — keep looking */ }
    }
  }
  return null;
}

ensureUploadDirs(UPLOAD_ROOT);

module.exports = {
  APP_ROOT,
  REPO_ROOT,
  UPLOAD_ROOT,
  UPLOAD_SUBDIRS,
  LEGACY_UPLOAD_ROOTS,
  ALL_UPLOAD_ROOTS,
  ensureUploadDirs,
  toStoredUrlPath,
  findStoredFile
};
