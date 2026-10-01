/**
 * Customer Feedback store-access resolution.
 *
 * Uses the application's existing authentication state — the session written at
 * login (`role`, `locationId`, `allowedLocations`, `isGlobalAdmin`) — with the
 * same rules `LocationContext` applies, so the feedback page can never offer a
 * store the signed-in user is not already allowed to access. No new permission
 * system and no extra API calls.
 *
 * Public visitors (no session) keep the existing public behaviour: every store
 * is listed, because the public QR/website feedback flow is not permission
 * scoped. Signed-in staff only ever see their own stores.
 */

import { STORE_LOCATIONS_LIST } from '../../config/storeLocations';
import type { CentralStoreLocation } from '../../config/storeLocations';
import type { UserSession } from '../../services/api';
import type { LocationStatus } from '../../context/LocationContext';

export type FeedbackAccessState = 'loading' | 'ready' | 'error' | 'empty';

export interface FeedbackStoreAccess {
  /** false → public customer (unauthenticated): full public store list. */
  authenticated: boolean;
  state: FeedbackAccessState;
  stores: CentralStoreLocation[];
  /** Human readable access scope for signed-in staff, null for the public. */
  accessLabel: string | null;
}

const ADMIN_ROLES = ['admin', 'super admin', 'system administrator'];

const normalizeRole = (role?: string): string =>
  (role || '').toLowerCase().replace(/[_\s-]+/g, ' ').trim();

/** 'Shivamogga' | 'Belagavi & Shivamogga' | 'All stores' */
export function describeStoreAccess(stores: CentralStoreLocation[]): string {
  if (stores.length >= STORE_LOCATIONS_LIST.length) return 'All stores';
  if (stores.length === 1) return stores[0].city;
  return stores.map((store) => store.city).join(' & ');
}

export function resolveFeedbackStoreAccess(
  session: UserSession | null,
  locationStatus: LocationStatus
): FeedbackStoreAccess {
  // Public visitor — existing public store-selection behaviour (all stores).
  if (!session) {
    return {
      authenticated: false,
      state: 'ready',
      stores: STORE_LOCATIONS_LIST,
      accessLabel: null
    };
  }

  // Signed in: never render the store list while access data is unresolved,
  // and never silently fall back to every location on failure.
  if (locationStatus === 'loading') {
    return { authenticated: true, state: 'loading', stores: [], accessLabel: null };
  }
  if (locationStatus === 'error') {
    return { authenticated: true, state: 'error', stores: [], accessLabel: null };
  }

  try {
    const roleNorm = normalizeRole(session.role);
    const isSuperAdmin = roleNorm === 'super admin';
    const isAdminRole = ADMIN_ROLES.includes(roleNorm);
    const isGlobalAdmin =
      isSuperAdmin || (isAdminRole && (!session.locationId || session.isGlobalAdmin === true));

    // Super Admin / global Admin — all stores.
    if (isGlobalAdmin) {
      const stores = STORE_LOCATIONS_LIST;
      return {
        authenticated: true,
        state: 'ready',
        stores,
        accessLabel: describeStoreAccess(stores)
      };
    }

    const allowedIds =
      Array.isArray(session.allowedLocations) && session.allowedLocations.length > 0
        ? session.allowedLocations
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id) && id > 0)
        : session.locationId
          ? [Number(session.locationId)]
          : [];

    // Signed in but no store assigned — never fall back to the full list.
    if (allowedIds.length === 0) {
      return { authenticated: true, state: 'empty', stores: [], accessLabel: null };
    }

    const stores = STORE_LOCATIONS_LIST.filter((store) => allowedIds.includes(store.id));

    // Access data references stores this build cannot resolve — fail closed.
    if (stores.length === 0) {
      return { authenticated: true, state: 'error', stores: [], accessLabel: null };
    }

    return {
      authenticated: true,
      state: 'ready',
      stores,
      accessLabel: describeStoreAccess(stores)
    };
  } catch {
    return { authenticated: true, state: 'error', stores: [], accessLabel: null };
  }
}
