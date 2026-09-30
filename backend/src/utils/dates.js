/**
 * Shared date normalisation for wedding CRM writes.
 *
 * Every DATE column must receive either a strict 'YYYY-MM-DD' string or NULL.
 * Passing a raw client value (e.g. '20/11/2026' or '') lets MySQL coerce it to
 * the zero date '0000-00-00' in non-strict mode, which later surfaces in the UI
 * as "Invalid Date".
 */

// Rejects impossible calendar dates such as 31-02-2026, which a regex alone accepts.
function toIsoDate(y, mo, d) {
  const year = parseInt(y, 10);
  const month = parseInt(mo, 10);
  const day = parseInt(d, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const probe = new Date(year, month - 1, day);
  if (probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day) {
    return null;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Accepts Date objects, 'YYYY-MM-DD', ISO timestamps, 'DD-MM-YYYY' and
 * 'DD/MM/YYYY' (the Excel/CSV template formats), and returns 'YYYY-MM-DD' or
 * null. MySQL zero dates and unparseable input both return null.
 */
function parseDate(raw) {
  if (raw === null || raw === undefined) return null;

  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    return toIsoDate(raw.getFullYear(), raw.getMonth() + 1, raw.getDate());
  }

  const v = String(raw).trim();
  if (!v) return null;
  // '0000-00-00', '0000-00-00 00:00:00' and any all-zero date are "no value".
  if (/^0{4}[-/]0{2}[-/]0{2}/.test(v)) return null;
  if (/^0{2}[-/]0{2}[-/]0{4}$/.test(v)) return null;

  // ISO date or ISO timestamp — take the calendar day as written, not as UTC.
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return toIsoDate(m[1], m[2], m[3]);

  // DD-MM-YYYY / DD/MM/YYYY (template + Indian convention)
  m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return toIsoDate(m[3], m[2], m[1]);

  const d = new Date(v);
  if (!isNaN(d.getTime())) {
    return toIsoDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  return null;
}

/** Same as parseDate but preserves "not supplied" separately from "invalid". */
function parseDateOrUndefined(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === '') return undefined;
  return parseDate(raw);
}

/**
 * The IST calendar day for an instant, independent of the host timezone.
 *
 * The pattern this replaces added +05:30 *after* already correcting with
 * getTimezoneOffset(); on a machine set to IST the two adjustments cancel and
 * the UTC date comes back, so anything recorded between 00:00 and 05:30 IST
 * was filed under the previous day. Three controllers had copies of it.
 */
function getISTDateString(date = new Date(), offsetMs = 0) {
  const shifted = new Date(date.getTime() + offsetMs);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(shifted);
}

/** Hour (0-23) on the IST clock, independent of the host timezone. */
function getISTHour(date = new Date()) {
  return Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    hour12: false
  }).format(date));
}

module.exports = { parseDate, parseDateOrUndefined, toIsoDate, getISTDateString, getISTHour };
