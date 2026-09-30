/**
 * Time and row-shape helpers for the Greeter kiosk ↔ Hourly Footfall integration.
 *
 * Footfall rows are keyed by the Asia/Kolkata calendar day and hour. Reading the
 * device clock instead — `new Date().toISOString().split('T')[0]` for the day and
 * `new Date().getHours()` for the slot — files real visitors under the wrong day
 * before 05:30 IST, and under the wrong hour on any tablet not set to IST. Every
 * timestamp the kiosk sends is therefore derived in the store timezone.
 *
 * The hour is never clamped to the 10:00–21:59 operating window: an entry made
 * outside business hours is real data and keeps its true slot hour.
 */

export function istToday(): string {
  try {
    // en-CA emits YYYY-MM-DD, which is the exact format the API validates.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  } catch {
    // Engine without the zone: shift UTC by +05:30 rather than trust the device clock.
    const shifted = new Date(Date.now() + (5 * 60 + 30) * 60 * 1000);
    return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
  }
}

export function istNowHour(): number {
  let raw = Number.NaN;
  try {
    raw = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }).format(new Date()));
  } catch {
    raw = Number.NaN;
  }
  if (!Number.isFinite(raw)) {
    // Some engines lack the zone; derive from UTC + 05:30 instead of the device clock.
    const now = new Date();
    return (now.getUTCHours() + 5 + (now.getUTCMinutes() >= 30 ? 1 : 0)) % 24;
  }
  // Some engines answer '24' for midnight under an h24 hour cycle; the slot is 0.
  return ((Math.trunc(raw) % 24) + 24) % 24;
}

/** 24-hour slot value → 12-hour clock label. 0 → '12:00 AM', 24 → '12:00 AM'. */
export function clockLabel(hour: number): string {
  const value = Number(hour);
  if (!Number.isFinite(value)) return '—';
  const normalized = ((Math.trunc(value) % 24) + 24) % 24;
  const suffix = normalized >= 12 ? 'PM' : 'AM';
  const hour12 = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${hour12}:00 ${suffix}`;
}

/** Inclusive slot range label, e.g. '10:00 AM – 11:00 AM'. */
export function formatHourRange(hour: number): string {
  const value = Number(hour);
  if (!Number.isFinite(value)) return '—';
  return `${clockLabel(value)} – ${clockLabel(value + 1)}`;
}

/**
 * The API answers DATE/DATETIME as IST wall-clock strings (`dateStrings: true`),
 * so the day is read positionally rather than through new Date(), which would
 * reinterpret it as a UTC instant.
 */
export function toEntryDateString(value?: string | null): string {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value ?? '').trim());
  return match ? match[1] : istToday();
}

/** 'YYYY-MM-DD HH:mm:ss' (IST wall clock) → 'hh:mm AM/PM'. */
export function formatIstClock(value?: string | null): string {
  if (!value) return '—';
  const match = /^\d{4}-\d{2}-\d{2}[T ](\d{2}):(\d{2})/.exec(String(value));
  if (!match) return String(value);
  return clockLabelRaw(Number(match[1]), match[2]);
}

function clockLabelRaw(hour24: number, minutes: string): string {
  if (!Number.isFinite(hour24)) return `--:${minutes}`;
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${String(hour12).padStart(2, '0')}:${minutes} ${suffix}`;
}

/** A row from GET /crm/footfall/entries (API.getFootfallEntries). */
export interface FootfallEntryRow {
  id: string;
  location_id: number | string;
  entryDate: string;
  slotHour: number | string;
  visitors: number | string;
  remarks?: string | null;
  submittedBy?: string | null;
  entry_source?: string | null;
  created_by?: string | null;
  created_by_role?: string | null;
  updated_by?: string | null;
  updated_by_role?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  location_name?: string | null;
  location_code?: string | null;
  edit_count?: number | string;
  last_edited_at?: string | null;
}

export const entryVisitors = (entry: Pick<FootfallEntryRow, 'visitors'>): number => Number(entry.visitors) || 0;
export const entryHour = (entry: Pick<FootfallEntryRow, 'slotHour'>): number => Number(entry.slotHour) || 0;
export const entryEditCount = (entry: Pick<FootfallEntryRow, 'edit_count'>): number => Number(entry.edit_count) || 0;

/** Rows are ordered by slot hour so the kiosk list reads top-down through the day. */
export const bySlotHour = (a: FootfallEntryRow, b: FootfallEntryRow): number => entryHour(a) - entryHour(b);
