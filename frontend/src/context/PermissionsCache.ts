/**
 * PermissionsCache — module-level singleton cache for /my-permissions and
 * /settings/page-visibility. These are loaded ONCE after authentication and
 * shared across every RouteGuard, Sidebar, and component that needs them.
 *
 * WHY: RouteGuard previously called API.getMyPermissions() on every mount +
 * every pathname change, causing 10–20 redundant requests per page navigation
 * and triggering rate-limiting (HTTP 429).
 *
 * USAGE:
 *   import { permissionsCache } from '../context/PermissionsCache';
 *   const { myPerms, pageSettings } = await permissionsCache.get();
 */

import { API } from '../services/api';

interface CachedPermissions {
  myPerms: any;
  pageSettings: any;
}

class PermissionsCacheService {
  private cache: CachedPermissions | null = null;
  private loading: Promise<CachedPermissions> | null = null;
  private loadedAt = 0;

  /** Cache TTL: 5 minutes. Permissions rarely change mid-session. */
  private TTL_MS = 5 * 60 * 1000;

  /** Call this to warm the cache immediately after login. */
  async prefetch(): Promise<void> {
    await this.get();
  }

  /**
   * Returns cached permissions, or fetches them if not yet loaded / stale.
   * Deduplicates concurrent callers: multiple awaits on get() during the same
   * fetch share a single in-flight Promise.
   */
  async get(): Promise<CachedPermissions> {
    const now = Date.now();
    if (this.cache && now - this.loadedAt < this.TTL_MS) {
      return this.cache;
    }

    // Deduplicate: if already loading, return the same promise
    if (this.loading) {
      return this.loading;
    }

    this.loading = Promise.all([
      API.getMyPermissions().catch(() => null),
      API.getPageSettings().catch(() => null)
    ]).then(([myPerms, pageSettingsRes]) => {
      const result: CachedPermissions = {
        myPerms,
        pageSettings: pageSettingsRes?.settings ?? pageSettingsRes ?? null
      };
      this.cache = result;
      this.loadedAt = Date.now();
      this.loading = null;
      return result;
    }).catch((err) => {
      this.loading = null;
      return { myPerms: null, pageSettings: null };
    });

    return this.loading;
  }

  /** Invalidate so the next get() re-fetches. Call after role/permission changes. */
  invalidate(): void {
    this.cache = null;
    this.loadedAt = 0;
    this.loading = null;
  }
}

export const permissionsCache = new PermissionsCacheService();
