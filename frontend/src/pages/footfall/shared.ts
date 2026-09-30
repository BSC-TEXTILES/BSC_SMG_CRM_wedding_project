/**
 * Shared display helpers and types for the Hourly Footfall register
 * (frontend/src/pages/Footfall.tsx) and its dialog components.
 *
 * Footfall rows are keyed by the IST calendar day and the API returns DATETIME
 * columns as IST wall-clock strings ('YYYY-MM-DD HH:mm:ss'). A driver or JSON
 * round-trip can hand back a UTC instant instead ('...Z'), so every value is
 * resolved through Asia/Kolkata here and nothing is ever allowed to render
 * "Invalid Date" — an unparseable value falls back to the raw text, and an
 * absent value to an em dash.
 */

export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Server-side gate for correcting a footfall record (crmController.js
 * FOOTFALL_MANAGEMENT_ROLES). Mirrored here only to show or hide controls —
 * the backend enforces it regardless, so a hidden button is never the control.
 */
export const FOOTFALL_MANAGEMENT_ROLES = ['Admin', 'Super Admin', 'System Administrator', 'Manager', 'Store Manager'];

export function isFootfallManagementRole(role?: string | null): boolean {
  const value = String(role || '').trim().toLowerCase();
  if (!value) return false;
  return FOOTFALL_MANAGEMENT_ROLES.some(r => r.trim().toLowerCase() === value);
}

type WallClock = { y: number; mo: number; d: number; hh: number; mm: number; ss: number };

function istParts(from: Date): WallClock | null {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).formatToParts(from);
    const pick = (type: string) => Number(parts.find(p => p.type === type)?.value || '0');
    const hour = pick('hour');
    return {
      y: pick('year'),
      mo: pick('month'),
      d: pick('day'),
      hh: hour === 24 ? 0 : hour,
      mm: pick('minute'),
      ss: pick('second')
    };
  } catch {
    return null;
  }
}

/**
 * Resolve any value the API may send into IST wall-clock parts.
 *  - 'YYYY-MM-DD'                -> calendar day, no instant involved
 *  - 'YYYY-MM-DD HH:mm:ss'       -> documented IST wall clock
 *  - 'YYYY-MM-DDTHH:mm:ss.sssZ'  -> UTC instant, converted with Intl (never sliced)
 */
export function toIstWallClock(value?: string | number | Date | null): WallClock | null {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : istParts(value);
  }

  const raw = String(value);
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(raw);
  const fromParts = (): WallClock | null =>
    m ? { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]), hh: m[4] === undefined ? 0 : Number(m[4]), mm: m[5] === undefined ? 0 : Number(m[5]), ss: m[6] === undefined ? 0 : Number(m[6]) } : null;

  if (m) {
    // A trailing Z or numeric offset means this is an instant, so slicing the
    // string would silently show UTC instead of the IST register day.
    const isInstant = /(?:Z|[+-]\d{2}:?\d{2})$/.test(raw);
    if (!isInstant) return fromParts();
    const asDate = new Date(raw);
    return isNaN(asDate.getTime()) ? fromParts() : (istParts(asDate) || fromParts());
  }

  const asDate = new Date(raw);
  return isNaN(asDate.getTime()) ? null : istParts(asDate);
}

function clockOf(hour: number, minute: number): string {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${suffix}`;
}

/** '30 Sep 2026' */
export function formatIstDate(value?: string | number | Date | null): string {
  if (!value) return '—';
  const p = toIstWallClock(value);
  if (!p) return String(value);
  return `${String(p.d).padStart(2, '0')} ${MONTHS_SHORT[p.mo - 1]} ${p.y}`;
}

/** '30/09/26 10:42 AM' — compact timestamp for table cells. */
export function formatIstStamp(value?: string | number | Date | null): string {
  if (!value) return '—';
  const p = toIstWallClock(value);
  if (!p) return String(value);
  return `${String(p.d).padStart(2, '0')}/${String(p.mo).padStart(2, '0')}/${String(p.y).slice(2)} ${clockOf(p.hh, p.mm)}`;
}

/** '10:42 AM' — the time half of an audit-trail line. */
export function formatIstTime(value?: string | number | Date | null): string {
  if (!value) return '—';
  const p = toIstWallClock(value);
  if (!p) return String(value);
  return clockOf(p.hh, p.mm);
}

/** 'YYYY-MM-DD' for <input type="date"> and for comparing a socket payload with the viewed date. */
export function istDateStringFrom(value?: string | number | Date | null): string | null {
  const p = toIstWallClock(value);
  if (!p) return null;
  return `${p.y}-${String(p.mo).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

/** '10:00 AM – 11:00 AM' for an hour slot, including hours outside the register grid. */
export function formatSlotLabel(hour: number): string {
  const h = Number(hour);
  if (!Number.isFinite(h) || h < 0 || h > 23) return '—';
  const toClockLabel = (value: number) => {
    if (value === 0) return '12:00 AM';
    if (value > 12) return `${value - 12}:00 PM`;
    if (value === 12) return '12:00 PM';
    return `${value}:00 AM`;
  };
  const next = h + 1 === 24 ? 0 : h + 1;
  return `${toClockLabel(h)} – ${toClockLabel(next)}`;
}

/** One row of /crm/footfall/entries — the raw shape the API returns (camelCase + snake_case mix). */
export interface FootfallEntryRow {
  id: string;
  location_id?: number | string;
  entryDate?: string | number | Date;
  slotHour?: number | string;
  visitors?: number | string;
  remarks?: string | null;
  submittedBy?: string | null;
  entry_source?: string | null;
  created_by?: string | null;
  created_by_role?: string | null;
  updated_by?: string | null;
  updated_by_role?: string | null;
  createdAt?: string | number | Date;
  updatedAt?: string | number | Date;
  location_name?: string | null;
  location_code?: string | null;
  edit_count?: number | string;
  last_edited_at?: string | number | Date | null;
}

/** One row of footfall_edit_history. */
export interface FootfallHistoryRow {
  field_changed?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  action?: string | null;
  edited_by?: string | null;
  edited_by_role?: string | null;
  reason?: string | null;
  created_at?: string | number | Date | null;
}

/** The minimal record both the entries table and the slot grid can offer a dialog. */
export interface FootfallEditTarget {
  id: string;
  visitors: number;
  entryDate: string;
  slotHour: number;
  locationId: number;
  remarks: string;
  source?: string | null;
  recordedBy?: string | null;
  editCount?: number;
}

/** Store choices offered in the edit dialog (from LocationContext). */
export interface FootfallStoreOption {
  id: number | string;
  name: string;
  code?: string;
}

export function storeLabel(stores: FootfallStoreOption[], id: number | string | null | undefined, fallback = '—'): string {
  const found = (stores || []).find(s => String(s.id) === String(id));
  if (!found) return fallback;
  return found.code ? `${found.name} (${found.code})` : found.name;
}

/**
 * Human-readable value for one audit-trail field, so a stored 'location_id'
 * row reads as a store name and an hour reads as a time window rather than a
 * bare number. Paired with historyFieldLabel it renders the line
 * "Footfall Count: 25 → 29".
 */
export function formatHistoryValue(field: string | null | undefined, value: string | null | undefined, stores: FootfallStoreOption[]): string {
  if (value === null || value === undefined || value === '') {
    return field === 'remarks' ? '(blank)' : '—';
  }
  switch (String(field)) {
    case 'visitors': {
      const n = Number(value);
      return Number.isFinite(n) ? n.toLocaleString('en-IN') : value;
    }
    case 'entryDate':
      return formatIstDate(value);
    case 'slotHour': {
      const h = Number(value);
      return Number.isFinite(h) ? `${formatSlotLabel(h)} · ${h}:00` : value;
    }
    case 'location_id':
      return storeLabel(stores, value, `Store #${value}`);
    case 'remarks':
      return value;
    default:
      return value;
  }
}

export function historyFieldLabel(field: string | null | undefined): string {
  switch (String(field)) {
    case 'visitors': return 'Footfall Count';
    case 'entryDate': return 'Register Date';
    case 'slotHour': return 'Hour Slot';
    case 'location_id': return 'Store Location';
    case 'remarks': return 'Remarks';
    case 'entry_source': return 'Entry Source';
    default: {
      const raw = String(field || 'Field');
      return raw
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
    }
  }
}
