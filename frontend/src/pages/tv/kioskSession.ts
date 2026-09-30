import type { KioskLocation } from './kioskTypes';

/**
 * Kiosk session storage.
 *
 * The bearer token the server issues after a correct PIN lives in sessionStorage:
 * it survives a page refresh (so the TV is not re-prompted constantly) but dies with
 * the tab, which is the right lifetime for a shared showroom screen. It is never
 * written to localStorage under a loose key, never rendered, and never logged — the
 * previous build stored it as localStorage['token'] and printed the factory PIN on
 * the access screen itself.
 *
 * Unlocking is still only *presented* as granted by this module: every data request
 * carries the token and the server decides. Editing these keys cannot authorise a
 * kiosk, because an unusable token simply earns a 401.
 */

const TOKEN_KEY = 'bsc_kiosk_token';
const EXPIRES_KEY = 'bsc_kiosk_expires_at';
const LOCATION_KEY = 'bsc_kiosk_location';

/** Applies to the TV kiosk and any other PIN gate sharing this session. */
export const KIOSK_TYPES = ['tv', 'greeter', 'cash', 'kiosk', 'manager'] as const;
export type KioskType = (typeof KIOSK_TYPES)[number];

const storage = (): Storage | null => {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    // Private browsing / disabled storage: the kiosk stays locked rather than throwing.
    return null;
  }
};

export interface KioskSession {
  token: string;
  expiresAt: number;
  location: KioskLocation;
}

export function saveKioskSession(session: KioskSession): void {
  const s = storage();
  if (!s) return;
  s.setItem(TOKEN_KEY, session.token);
  s.setItem(EXPIRES_KEY, String(session.expiresAt));
  s.setItem(LOCATION_KEY, JSON.stringify(session.location));
}

/** Returns null when absent, malformed or past expiry. */
export function readKioskSession(): KioskSession | null {
  const s = storage();
  if (!s) return null;
  const token = s.getItem(TOKEN_KEY);
  const rawExpiry = s.getItem(EXPIRES_KEY);
  const rawLocation = s.getItem(LOCATION_KEY);
  if (!token || !rawExpiry || !rawLocation) return null;

  const expiresAt = Number(rawExpiry);
  if (!Number.isFinite(expiresAt) || Date.now() >= expiresAt) {
    clearKioskSession();
    return null;
  }

  try {
    const location = JSON.parse(rawLocation) as KioskLocation;
    if (!location || typeof location.id !== 'number' || location.id <= 0) return null;
    return { token, expiresAt, location };
  } catch {
    clearKioskSession();
    return null;
  }
}

export function getKioskToken(): string | null {
  return readKioskSession()?.token ?? null;
}

/** Locking clears the credential and the chosen store in one step. */
export function clearKioskSession(): void {
  const s = storage();
  if (!s) return;
  s.removeItem(TOKEN_KEY);
  s.removeItem(EXPIRES_KEY);
  s.removeItem(LOCATION_KEY);
}

/** Milliseconds until the kiosk must unlock again; null when not unlocked. */
export function kioskSessionRemainingMs(): number | null {
  const session = readKioskSession();
  return session ? Math.max(0, session.expiresAt - Date.now()) : null;
}
