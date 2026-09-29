/**
 * Centralized Master Date Utility (Frontend)
 * Enforces Indian Standard Time (IST / Asia/Kolkata, UTC+5:30) date boundaries.
 */

/**
 * Parses every date shape the CRM can receive: an ISO calendar date
 * ('YYYY-MM-DD'), an ISO timestamp, a Date object, and the 'DD-MM-YYYY' /
 * 'DD/MM/YYYY' forms used by the registration form and the Excel/CSV template.
 *
 * Returns null for anything unparseable — including the MySQL zero date
 * '0000-00-00', which is truthy as a string but renders as "Invalid Date"
 * through `new Date(...)`.
 */
export const parseDate = (value: any): Date | null => {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  const v = String(value).trim();
  if (!v) return null;
  if (/^0{4}[-/]0{2}[-/]0{2}/.test(v)) return null;
  if (/^0{2}[-/]0{2}[-/]0{4}$/.test(v)) return null;

  // ISO calendar date or ISO timestamp: use the literal calendar day so an
  // IST-stored date is not shifted by UTC parsing.
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }

  // DD-MM-YYYY / DD/MM/YYYY / DD.MM.YYYY
  m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[T\s].*)?$/);
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return isNaN(d.getTime()) ? null : d;
  }

  const fallback = new Date(v);
  return isNaN(fallback.getTime()) ? null : fallback;
};

/** True when the value resolves to a real calendar date. */
export const isValidDate = (value: any): boolean => parseDate(value) !== null;

/**
 * Display formatter. Returns the fallback (default 'Not Scheduled') whenever the
 * value is missing or unparseable, so the UI never prints "Invalid Date".
 */
export const formatDateDisplay = (
  value: any,
  fallback: string = 'Not Scheduled',
  options?: Intl.DateTimeFormatOptions
): string => {
  const d = parseDate(value);
  if (!d) return fallback;
  return d.toLocaleDateString('en-GB', options || { day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * Display formatter for TIMESTAMP columns (created_at / updated_at / last_call_date).
 * Falls back rather than printing "Invalid Date".
 */
export const formatDateTimeDisplay = (
  value: any,
  fallback: string = '—'
): string => {
  if (value === null || value === undefined || String(value).trim() === '') return fallback;
  if (/^0{4}[-/]0{2}[-/]0{2}/.test(String(value).trim())) return fallback;

  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return fallback;
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

/** 'YYYY-MM-DD' for <input type="date"> and for API payloads. */export const toISODateInput = (value: any): string => {
  const d = parseDate(value);
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Calendar day key ('YYYY-MM-DD') used to bucket events by day. */
export const dateKey = (value: any): string => toISODateInput(value);

export const formatISTDate = (d: any): string => {  if (!d) return '';
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.trim())) {
    return d.trim();
  }
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';

  const options: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
  const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(dt);
  const year = parts.find(p => p.type === 'year')?.value || '';
  const month = parts.find(p => p.type === 'month')?.value || '';
  const day = parts.find(p => p.type === 'day')?.value || '';
  return `${year}-${month}-${day}`;
};

export const getISTDateRange = (range: string, fromDate?: string, toDate?: string) => {
  const now = new Date();
  const todayStr = formatISTDate(now);
  const [ty, tm, td] = todayStr.split('-').map(Number);

  let startTime = 0;
  let endTime = Infinity;

  if (range === 'today') {
    startTime = new Date(ty, tm - 1, td, 0, 0, 0, 0).getTime();
    endTime = new Date(ty, tm - 1, td, 23, 59, 59, 999).getTime();
  } else if (range === 'yesterday') {
    const yest = new Date(ty, tm - 1, td - 1);
    const yStr = formatISTDate(yest);
    const [yy, ym, yd] = yStr.split('-').map(Number);
    startTime = new Date(yy, ym - 1, yd, 0, 0, 0, 0).getTime();
    endTime = new Date(yy, ym - 1, yd, 23, 59, 59, 999).getTime();
  } else if (range === 'week' || range === '7days') {
    startTime = Date.now() - 7 * 86400000;
    endTime = Date.now();
  } else if (range === 'month' || range === '30days') {
    startTime = Date.now() - 30 * 86400000;
    endTime = Date.now();
  } else if (range === 'last_month') {
    const firstDayLastMonth = new Date(ty, tm - 2, 1, 0, 0, 0, 0);
    const lastDayLastMonth = new Date(ty, tm - 1, 0, 23, 59, 59, 999);
    startTime = firstDayLastMonth.getTime();
    endTime = lastDayLastMonth.getTime();
  } else if (range === 'custom' && fromDate) {
    const fParts = fromDate.split('-').map(Number);
    startTime = new Date(fParts[0], fParts[1] - 1, fParts[2], 0, 0, 0, 0).getTime();
    if (toDate) {
      const tParts = toDate.split('-').map(Number);
      endTime = new Date(tParts[0], tParts[1] - 1, tParts[2], 23, 59, 59, 999).getTime();
    } else {
      endTime = startTime + 86400000 - 1;
    }
  }

  return { startTime, endTime, todayStr };
};

export const isDateInRange = (dateInput: any, range: string, fromDate?: string, toDate?: string): boolean => {
  if (!range || range === 'all') return true;
  if (!dateInput) return false;

  const { startTime, endTime, todayStr } = getISTDateRange(range, fromDate, toDate);

  if (range === 'today') {
    return formatISTDate(dateInput) === todayStr;
  }

  const dt = new Date(dateInput);
  if (isNaN(dt.getTime())) return false;
  const t = dt.getTime();
  return t >= startTime && t <= endTime;
};

export const getBusinessDate = (record: any, moduleType: string): any => {
  if (!record) return null;
  const mod = (moduleType || '').toUpperCase().trim();

  if (mod === 'CRM' || mod === 'CANDIDATES') {
    return record.created_at || record.createdAt || null;
  }
  if (mod === 'INTERVIEW') {
    return record.interview_date || record.interviewDate || record.created_at || record.createdAt || null;
  }
  if (mod === 'OFFER_PENDING') {
    return record.created_at || record.createdAt || null;
  }
  if (mod === 'OFFER_ACCEPTED') {
    return record.confirm_date || record.confirmDate || record.updated_at || record.updatedAt || record.created_at || record.createdAt || null;
  }
  if (mod === 'JOINED' || mod === 'EMPLOYEES' || mod === 'OFFER_JOINED') {
    return record.actual_doj || record.actualDoj || record.offered_doj || record.offeredDoj || record.updated_at || record.updatedAt || record.created_at || record.createdAt || null;
  }

  return record.created_at || record.createdAt || null;
};
