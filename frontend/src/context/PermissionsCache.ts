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
 *   const canEdit = permissionsCache.canAction('wedding_crm', 'can_edit', role);
 */

import { API } from '../services/api';

export interface ActionPermission {
  module: string;
  can_view: boolean;
  can_add?: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
  can_export?: boolean;
  can_approve?: boolean;
}

export type PermissionAction = 'can_view' | 'can_add' | 'can_edit' | 'can_delete' | 'can_export' | 'can_approve';

export interface CachedPermissions {
  myPerms: {
    isAdmin?: boolean;
    custom?: boolean;
    modules?: string[];
    permissions?: ActionPermission[];
  } | null;
  pageSettings: Record<string, boolean> | null;
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
        myPerms: myPerms?.data || myPerms || null,
        pageSettings: pageSettingsRes?.settings ?? pageSettingsRes ?? null
      };
      this.cache = result;
      this.loadedAt = Date.now();
      this.loading = null;
      return result;
    }).catch(() => {
      this.loading = null;
      return { myPerms: null, pageSettings: null };
    });

    return this.loading;
  }

  /**
   * Helper to evaluate whether the current user is allowed to perform a specific action on a module.
   * Admin / Super Admin always return true.
   * If user has explicit ACM permissions, evaluates the corresponding action flag.
   * Otherwise falls back to role privileges.
   */
  canAction(module: string, action: PermissionAction = 'can_view', userRole?: string): boolean {
    const role = (userRole || '').trim().toLowerCase().replace(/[_\s-]+/g, ' ');
    if (role === 'admin' || role === 'super admin' || role === 'system administrator') {
      return true;
    }

    const myPerms = this.cache?.myPerms;
    if (myPerms?.isAdmin) {
      return true;
    }

    // Custom ACM permissions
    if (myPerms?.custom && Array.isArray(myPerms.permissions)) {
      const row = myPerms.permissions.find((p: any) => p.module === module);
      if (row) {
        return Boolean((row as any)[action]);
      }
      // If module not found in explicit permissions list, deny
      return false;
    }

    // Fallback: role-based defaults
    if (action === 'can_view') {
      return true;
    }

    // Non-view actions fallback for managerial/privileged roles
    return ['manager', 'hr', 'store manager', 'floor manager'].includes(role);
  }

  /** Invalidate so the next get() re-fetches. Call after role/permission changes. */
  invalidate(): void {
    this.cache = null;
    this.loadedAt = 0;
    this.loading = null;
  }
}

export const permissionsCache = new PermissionsCacheService();
