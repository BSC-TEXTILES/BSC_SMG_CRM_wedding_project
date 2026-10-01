import { useLocation } from 'react-router-dom';

/**
 * ── Central Breadcrumb System ────────────────────────────────────────────
 * Single source of truth for breadcrumb trails across the entire portal.
 *
 * Rules:
 * 1. Root is always "BSC Portal" pointing to "/dashboard".
 * 2. Never show duplicate breadcrumbs (e.g., "Dashboard > Dashboard" -> "Dashboard").
 * 3. Strict consecutive deduplication: if parent === current, only render one.
 * 4. Derived automatically from the route hierarchy and/or verified sub-items.
 * 5. Leaf crumb represents the current active page and is never clickable.
 */

export interface BreadcrumbCrumb {
  label: string;
  href?: string;
}

export const BREADCRUMB_ROOT_LABEL = 'BSC Portal';
export const BREADCRUMB_ROOT_HREF = '/dashboard';

/**
 * Canonical route hierarchy definitions:
 * Maps routes to their parent sections and human-readable page labels.
 */
interface RouteHierarchyDef {
  parent?: { label: string; href?: string };
  label: string;
}

export const ROUTE_HIERARCHY: Record<string, RouteHierarchyDef> = {
  // Overview / Core Enterprise
  '/dashboard': { label: 'Dashboard' },
  '/hr-dashboard': { label: 'HR Talent Dashboard' },
  '/manager-dashboard': { label: 'Store Floor Operations Dashboard' },
  '/employees': { label: 'Employee & Store Directory' },
  '/user-management': { label: 'User Management' },
  '/attendance': { label: 'Attendance & Roster' },

  // Wedding CRM
  '/wedding-crm': { parent: { label: 'Wedding CRM', href: '/wedding-crm/dashboard' }, label: 'Dashboard' },
  '/wedding-crm/dashboard': { parent: { label: 'Wedding CRM', href: '/wedding-crm/dashboard' }, label: 'Dashboard' },
  '/wedding-crm/customers': { parent: { label: 'Wedding CRM', href: '/wedding-crm/dashboard' }, label: 'Customer Register' },
  '/wedding-crm/customers/new': { parent: { label: 'Wedding CRM', href: '/wedding-crm/dashboard' }, label: 'Customer Registration' },
  '/wedding/customer-registration': { parent: { label: 'Wedding CRM', href: '/wedding-crm/dashboard' }, label: 'Customer Registration' },
  '/wedding-registration': { parent: { label: 'Wedding CRM', href: '/wedding-crm/dashboard' }, label: 'Customer Registration' },
  '/wedding/public-registration': { parent: { label: 'Wedding CRM', href: '/wedding-crm/dashboard' }, label: 'Customer Registration' },
  '/wedding-crm/telecaller': { parent: { label: 'Wedding CRM', href: '/wedding-crm/dashboard' }, label: 'Telecaller Desk' },
  '/wedding-crm/calls': { parent: { label: 'Wedding CRM', href: '/wedding-crm/dashboard' }, label: 'Call History' },
  '/wedding-crm/calendar': { parent: { label: 'Wedding CRM', href: '/wedding-crm/dashboard' }, label: 'Calendar' },
  '/wedding-crm/pipeline': { parent: { label: 'Wedding CRM', href: '/wedding-crm/dashboard' }, label: 'Status Pipeline' },
  '/wedding-crm/status-board': { parent: { label: 'Wedding CRM', href: '/wedding-crm/dashboard' }, label: 'Status Pipeline' },
  '/wedding-crm/reports': { parent: { label: 'Wedding CRM', href: '/wedding-crm/dashboard' }, label: 'Reports' },
  '/wedding-crm/import': { parent: { label: 'Wedding CRM', href: '/wedding-crm/dashboard' }, label: 'Import Customers' },
  '/wedding-crm/old-customers': { parent: { label: 'Wedding CRM', href: '/wedding-crm/dashboard' }, label: 'Old Customers' },
  '/wedding-operations': { parent: { label: 'Wedding CRM', href: '/wedding-crm/dashboard' }, label: 'Operations Desk' },

  // Store Operations
  '/telecaller/desk': { parent: { label: 'Store Operations', href: '/dashboard' }, label: 'Telecaller Desk' },
  '/telecaller-dashboard': { parent: { label: 'Store Operations', href: '/dashboard' }, label: 'Telecaller Dashboard' },
  '/footfall': { parent: { label: 'Store Operations', href: '/dashboard' }, label: 'Hourly Footfall' },
  '/feedback-collection': { parent: { label: 'Store Operations', href: '/dashboard' }, label: 'Feedback Collection' },
  '/feedback-list': { parent: { label: 'Store Operations', href: '/dashboard' }, label: 'Feedback Call Queue' },
  '/feedback-qr-management': { parent: { label: 'Store Operations', href: '/dashboard' }, label: 'Feedback QR Code' },
  '/feedback-qr': { parent: { label: 'Store Operations', href: '/dashboard' }, label: 'Feedback QR Code' },

  // Talent & HR
  '/candidates': { parent: { label: 'Talent', href: '/dashboard' }, label: 'Candidate CRM' },
  '/openings': { parent: { label: 'Talent', href: '/dashboard' }, label: 'Manpower Planning' },
  '/section-allocation': { parent: { label: 'Talent', href: '/dashboard' }, label: 'Section Allocation' },
  '/offer-process': { parent: { label: 'Talent', href: '/dashboard' }, label: 'Offer Desk' },
  '/doj-desk': { parent: { label: 'Talent', href: '/dashboard' }, label: 'DOJ & Not Joined Desk' },
  '/department-hiring': { parent: { label: 'Talent', href: '/dashboard' }, label: 'Department Hiring Status' },

  // Daily Operations
  '/daily-mcheck': { parent: { label: 'Daily Operations', href: '/dashboard' }, label: 'MCheck Store Audit' },
  '/mcheck-reports': { parent: { label: 'Daily Operations', href: '/dashboard' }, label: 'MCheck Reports' },
  '/mcheck-history': { parent: { label: 'Daily Operations', href: '/dashboard' }, label: 'MCheck History' },
  '/vm-checklist': { parent: { label: 'Daily Operations', href: '/dashboard' }, label: 'VM Checklist' },
  '/vm-dashboard': { parent: { label: 'Daily Operations', href: '/dashboard' }, label: 'VM Dashboard' },
  '/divert': { parent: { label: 'Daily Operations', href: '/dashboard' }, label: 'Sourcing Diverts' },
  '/batch-plan': { parent: { label: 'Daily Operations', href: '/dashboard' }, label: 'Batch Plan' },
  '/pm-view': { parent: { label: 'Daily Operations', href: '/dashboard' }, label: 'Purchase Manager View' },
  '/cash-settlement': { parent: { label: 'Daily Operations', href: '/dashboard' }, label: 'Cash Settlement' },

  // Administration
  '/broadcast-center': { parent: { label: 'Administration', href: '/dashboard' }, label: 'Broadcast Center' },
  '/settings': { parent: { label: 'Administration', href: '/dashboard' }, label: 'System Settings' },
  '/system-admin': { parent: { label: 'Administration', href: '/dashboard' }, label: 'System Administrator' },

  // Public Portals & Kiosks
  '/apply': { label: 'Job Applicant Registration' },
  '/feedback-public': { label: 'Customer Feedback QR' },
  '/tv': { label: 'Live TV Kiosk' },
  '/greeter': { label: 'Greeter Kiosk' },
};

/** Canonical route → human-readable page label mapping for backwards compatibility */
export const ROUTE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(ROUTE_HIERARCHY).map(([route, def]) => [route, def.label])
);

/** Tokens that keep special casing when humanizing raw slugs. */
const TOKEN_OVERRIDES: Record<string, string> = {
  crm: 'CRM',
  qr: 'QR',
  vm: 'VM',
  tv: 'TV',
  hr: 'HR',
  id: 'ID',
  fnf: 'FnF',
  mcheck: 'MCheck',
  bsc: 'BSC',
  doj: 'DOJ',
};

function humanizeToken(token: string): string {
  const lower = token.toLowerCase();
  if (TOKEN_OVERRIDES[lower]) return TOKEN_OVERRIDES[lower];
  return token.charAt(0).toUpperCase() + token.slice(1);
}

/** Fallback for routes missing from the registry: "/store-ops/x" → "Store Ops X". */
export function humanizePath(pathname: string): string {
  return pathname
    .split('/')
    .filter(Boolean)
    .map(seg => seg.split(/[-_]+/).filter(Boolean).map(humanizeToken).join(' '))
    .filter(Boolean)
    .join(' ');
}

/**
 * Guards against undefined / null / [object Object] leaking into a trail.
 */
export function sanitizeCrumbLabel(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  const s = String(raw).trim();
  if (!s) return '';
  if (s === 'undefined' || s === 'null' || s === '[object Object]') return '';
  return s;
}

function sanitizeHref(href: unknown): string | undefined {
  if (typeof href !== 'string') return undefined;
  const s = href.trim();
  return s && s !== '#' ? s : undefined;
}

function normalizeKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Builds the full trail for a pathname:
 *   [BSC Portal] → [Parent if applicable] → [Page] → [...subItems]
 *
 * Enforces strict deduplication:
 * - Never produces "Dashboard > Dashboard"
 * - Removes consecutive duplicate labels
 * - If parent label equals current label, only renders once
 * - The final crumb is never clickable (current page)
 */
export function buildBreadcrumbs(pathname: string, subItems?: BreadcrumbCrumb[] | null): BreadcrumbCrumb[] {
  // Always begin with the root authenticated portal
  const trail: BreadcrumbCrumb[] = [{ label: BREADCRUMB_ROOT_LABEL, href: BREADCRUMB_ROOT_HREF }];

  // Find known hierarchy for this route or fallback
  const hierarchy = ROUTE_HIERARCHY[pathname];
  const pageLabel = hierarchy?.label || ROUTE_LABELS[pathname] || humanizePath(pathname) || 'Dashboard';
  const parent = hierarchy?.parent;

  // Add parent section if available and not root
  if (parent && parent.label) {
    trail.push({ label: parent.label, href: parent.href || BREADCRUMB_ROOT_HREF });
  }

  // Add the base page crumb
  trail.push({ label: pageLabel, href: pathname });

  // Process sub-items if provided (e.g. customer name, active tab, detail modal)
  if (Array.isArray(subItems) && subItems.length > 0) {
    for (const item of subItems) {
      const label = sanitizeCrumbLabel(item?.label);
      if (!label) continue;
      trail.push({ label, href: sanitizeHref(item?.href) });
    }
  }

  // ── STRICT DEDUPLICATION PASS ──────────────────────────────────────────
  // 1. Remove consecutive duplicates (e.g. "Dashboard" followed by "Dashboard")
  // 2. Remove items matching root label if repeated
  // 3. If parent === current, collapse into one
  const deduped: BreadcrumbCrumb[] = [];

  for (const crumb of trail) {
    const label = sanitizeCrumbLabel(crumb.label);
    if (!label) continue;

    const norm = normalizeKey(label);

    // Skip duplicate root label
    if (deduped.length > 0 && norm === normalizeKey(BREADCRUMB_ROOT_LABEL)) {
      continue;
    }

    // Skip consecutive identical labels
    if (deduped.length > 0) {
      const prevNorm = normalizeKey(deduped[deduped.length - 1].label);
      if (prevNorm === norm) {
        // If the new item has a more specific href, adopt it
        if (!deduped[deduped.length - 1].href && crumb.href) {
          deduped[deduped.length - 1].href = crumb.href;
        }
        continue;
      }
    }

    deduped.push({ label, href: crumb.href });
  }

  // Final check: if only root remains or trail is empty, ensure at least [BSC Portal, Dashboard]
  if (deduped.length === 1 && deduped[0].label === BREADCRUMB_ROOT_LABEL) {
    deduped.push({ label: 'Dashboard' });
  }

  // The last item in the trail is the CURRENT active page: NEVER clickable!
  if (deduped.length > 0) {
    deduped[deduped.length - 1].href = undefined;
  }

  return deduped;
}

/**
 * Route-derived breadcrumb trail for the current location.
 * Re-renders on every route change (browser back/forward, refresh, direct
 * URL entry all produce the correct trail — no stale state is possible).
 */
export function useBreadcrumbs(subItems?: BreadcrumbCrumb[] | null): BreadcrumbCrumb[] {
  const { pathname } = useLocation();
  const subKey = Array.isArray(subItems)
    ? subItems.map(c => `${c?.label ?? ''}|${c?.href ?? ''}`).join('§')
    : '';
  return buildBreadcrumbs(pathname, subKey ? (subItems as BreadcrumbCrumb[]) : null);
}
