import { useLocation } from 'react-router-dom';

/**
 * ── Central Breadcrumb System ────────────────────────────────────────────
 * Single source of truth for breadcrumb trails across the entire portal.
 *
 * A trail is always derived from the CURRENT route (never hardcoded per page):
 *   BSC Portal  →  <Page>  →  <sub-item: active tab / entity details>
 *
 * Pages may append sub-items (active tab, entity name, detail modals) via
 * the `subItems` argument of useBreadcrumbs() or the Topbar `breadcrumbs`
 * prop. Everything else is generated here so labels, separators, hierarchy
 * and click behaviour stay identical on every page.
 */

export interface BreadcrumbCrumb {
  label: string;
  href?: string;
}

export const BREADCRUMB_ROOT_LABEL = 'BSC Portal';

/** The authenticated portal root every "BSC Portal" crumb navigates to. */
export const BREADCRUMB_ROOT_HREF = '/dashboard';

/**
 * Canonical route → human-readable page label.
 * Labels mirror the Sidebar navigation vocabulary exactly, so the breadcrumb
 * always matches the name the user clicked in the menu.
 */
export const ROUTE_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/wedding-crm': 'Wedding Follow-up CRM',
  '/footfall': 'Hourly Footfall',
  '/feedback-collection': 'Feedback Collection',
  '/feedback-list': 'Feedback Call Queue',
  '/feedback-qr': 'Feedback QR Code',
  '/feedback-public': 'Customer Feedback QR',
  '/divert': 'Sourcing Diverts',
  '/pm-view': 'Purchase Manager View',
  '/vm-checklist': 'VM Checklist',
  '/attendance': 'Attendance & Roster',
  '/daily-mcheck': 'Daily MCheck',
  '/mcheck-reports': 'MCheck Reports',
  '/mcheck-history': 'MCheck History',
  '/candidates': 'Candidate CRM',
  '/wedding-registration': 'Wedding Registration',
  '/offer-process': 'Offer Desk',
  '/openings': 'Manpower Planning',
  '/employees': 'Employee Directory',
  '/department-hiring': 'Department Hiring Status',
  '/section-allocation': 'Section Allocation',
  '/broadcast-center': 'Broadcast Center',
  '/user-management': 'User Management',
  '/settings': 'System Settings',
  '/system-admin': 'System Administrator',
  '/greeter': 'Greeter Kiosk',
  '/tv': 'Live TV Kiosk',
  '/cash-settlement': 'Cash Settlement',
};

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
 * Guards against undefined / null / [object Object] leaking into a trail
 * (e.g. while an entity name is still loading). Invalid labels are dropped
 * so the trail stays valid; pages pass 'Loading…' explicitly while fetching.
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

/**
 * Builds the full trail for a pathname:
 *   [BSC Portal] → [Page] → [...subItems]
 * When sub-items exist the page crumb becomes a clickable parent pointing at
 * the current route; the last sub-item is the current page (never clickable).
 */
export function buildBreadcrumbs(pathname: string, subItems?: BreadcrumbCrumb[] | null): BreadcrumbCrumb[] {
  const trail: BreadcrumbCrumb[] = [{ label: BREADCRUMB_ROOT_LABEL, href: BREADCRUMB_ROOT_HREF }];

  const pageLabel = ROUTE_LABELS[pathname] || humanizePath(pathname) || 'Dashboard';
  const hasSubs = Array.isArray(subItems) && subItems.some(item => sanitizeCrumbLabel(item?.label));
  trail.push({ label: pageLabel, href: hasSubs ? pathname : undefined });

  if (hasSubs) {
    for (const item of subItems!) {
      const label = sanitizeCrumbLabel(item?.label);
      if (!label) continue;
      trail.push({ label, href: sanitizeHref(item?.href) });
    }
  }

  return trail;
}

/**
 * Route-derived breadcrumb trail for the current location.
 * Re-renders on every route change (browser back/forward, refresh, direct
 * URL entry all produce the correct trail — no stale state is possible).
 *
 * @param subItems optional dynamic children of the page crumb (active tab,
 *                 entity name, detail modal). Never includes the root.
 */
export function useBreadcrumbs(subItems?: BreadcrumbCrumb[] | null): BreadcrumbCrumb[] {
  const { pathname } = useLocation();
  const subKey = Array.isArray(subItems) ? subItems.map(c => `${c?.label ?? ''}|${c?.href ?? ''}`).join('§') : '';
  return buildBreadcrumbs(pathname, subKey ? (subItems as BreadcrumbCrumb[]) : null);
}
