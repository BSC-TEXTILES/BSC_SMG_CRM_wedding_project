/**
 * Live TV Kiosk — shared types.
 *
 * Anything the board shows must arrive from the server or be null. Nullable fields
 * here are deliberate: the previous version substituted 98% / 4.9 / "OPEN" when a
 * query returned nothing, which put invented numbers on a showroom screen. A null
 * means "no data available", and the UI must say exactly that.
 */

export interface KioskLocation {
  id: number;
  code: string;
  name: string;
}

/** POST /crm/verify-pin. The token is a bearer credential — never render or log it. */
export interface KioskVerifyResponse {
  success: boolean;
  message?: string;
  token?: string;
  /** Epoch ms after which the kiosk must unlock again. */
  expiresAt?: number;
  location?: KioskLocation;
}

export interface TvFootfallPanel {
  todayTotal: number;
  currentHourVisitors: number;
  hourlyAverage: number | null;
  /** Null when no entry exists today — never a guessed peak. */
  peakHour: { hour: number; label: string; visitors: number } | null;
  distribution: { hour: number; label: string; visitors: number; isCurrent: boolean; isPeak: boolean }[];
  entryCount: number;
}

export interface TvCsatPanel {
  /** Null until real feedback exists. */
  satisfactionPct: number | null;
  averageRating: number | null;
  totalFeedback: number;
  responsesToday: number;
  positiveCount: number;
  negativeCount: number;
}

export interface TvDivertPanel {
  totalActive: number;
  urgentCount: number;
  inProgressCount: number;
  completedTodayCount: number;
  pendingCount: number;
  recentDiverts: { id: string; product: string; quantity: number; section: string; status: string }[];
}

export interface TvFeedEvent {
  id: string;
  /** Epoch ms or an ISO string from the server. */
  at: number | string | null;
  label: string;
  detail?: string;
  kind: 'footfall' | 'feedback' | 'divert' | 'vm' | 'broadcast' | 'other';
}

export interface TvBroadcastPanel {
  /** Null when nothing is currently broadcast — the board then hides the tile. */
  id: number | string | null;
  title: string | null;
  message: string | null;
  priority?: string | null;
  category?: string | null;
}

export interface TvStoreStatus {
  isOpen: boolean;
  statusText: string;
  openTime: string;
  closeTime: string;
  currentHour: number;
  /** True when these hours come from saved settings rather than the system default. */
  hoursAreConfigured: boolean;
  timeZone: string;
}

export interface TvDisplayPayload {
  success: boolean;
  store: KioskLocation & { storeName?: string; address?: string };
  status: TvStoreStatus;
  footfall: TvFootfallPanel;
  csat: TvCsatPanel;
  diverts: TvDivertPanel;
  feed: TvFeedEvent[];
  broadcast: TvBroadcastPanel;
  /** Server Asia/Kolkata instant, so the clock and "updated" stamp agree with IST. */
  serverTime?: string;
  istDate?: string;
}
