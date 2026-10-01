/**
 * BSC Enterprise HRMS API Client Service
 */

const getApiBase = () => {
  return '/api';
};

/**
 * Read the double-submit `_csrf` cookie so raw `fetch()` calls that bypass
 * `apiFetch` (logout, security-event logging, keepalive calls) still satisfy
 * the backend CSRF middleware. Returns null when the cookie is absent.
 */
export function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|; )_csrf=([^;]*)/);
  return match ? match[1] : null;
}

export interface UserSession {
  id?: number | string;
  username: string;
  role: 'HR' | 'Manager' | 'Admin' | 'Super Admin' | string;
  fullName: string;
  displayName: string;
  name?: string;
  employeeId?: string | number;
  token?: string | null;
  // ── Multi-Location Fields ──
  locationId?: number | null;     // null = Global Admin (all locations)
  locationCode?: string | null;   // 'BEL' | 'DAV' | 'SHI'
  locationName?: string | null;   // 'Belagavi' | 'Davanagere' | 'Shivamogga'
  allowedLocations?: number[];    // array of location IDs user can access
  isGlobalAdmin?: boolean;        // true if locationId is null
  modules?: string[];             // assigned ACM modules
}

// Re-entrancy guard: Auth.clear() notifies listeners synchronously, and a
// listener may call Auth.check() which can call Auth.clear() again.
// Without this flag a missing/expired session would loop forever:
// clear() -> 'bsc_auth_changed' -> Auth.check() -> clear() -> ... RangeError.
let authClearDispatching = false;
let isLoggingOut = false;

export const Auth = {
  save(session: UserSession, token?: string | null, refreshToken?: string | null) {
    try {
      isLoggingOut = false;
      const activeToken = token || session.token || null;
      if (activeToken) {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('bsc_token', activeToken);
        }
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('bsc_token', activeToken);
        }
      }
      if (refreshToken && typeof localStorage !== 'undefined') {
        localStorage.setItem('bsc_refresh_token', refreshToken);
      }
      const sessionToStore = {
        id: session.id,
        username: session.username,
        role: session.role,
        fullName: session.fullName,
        displayName: session.displayName,
        name: session.name,
        employeeId: session.employeeId,
        locationId: session.locationId,
        locationCode: session.locationCode,
        locationName: session.locationName,
        allowedLocations: session.allowedLocations,
        isGlobalAdmin: session.isGlobalAdmin,
        modules: session.modules,
        token: activeToken,
        loginAt: Date.now()
      };
      localStorage.setItem('bsc_crm_session', JSON.stringify(sessionToStore));
      
      // Track login in user tracking system (safe, non-blocking)
      const ipAddress = typeof window !== 'undefined' ? (window as any).ipAddress : undefined;
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : undefined;
      if (session?.id || session?.username) {
        API.trackUserLogin(
          session.id,
          session.username,
          ipAddress,
          userAgent,
          session.locationId,
          session.locationName
        ).catch(() => {});
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bsc_auth_changed', { detail: sessionToStore }));
      }
    } catch (e) {}
  },

  get(): (UserSession & { loginAt: number }) | null {
    try {
      const data = localStorage.getItem('bsc_crm_session');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  check(): boolean {
    const session = this.get();
    if (!session || !session.id || !session.username || !session.role) {
      return false;
    }
    // Absolute session lifetime: 6 hours
    const SESSION_MS = 6 * 60 * 60 * 1000;
    const loginTime = Number(session.loginAt);
    if (!loginTime || isNaN(loginTime) || loginTime <= 0) {
      // Auto-heal missing loginAt timestamp rather than invalidating valid session
      session.loginAt = Date.now();
      try {
        localStorage.setItem('bsc_crm_session', JSON.stringify(session));
      } catch (e) {}
      return true;
    }
    if (Date.now() - loginTime > SESSION_MS) {
      return false;
    }
    return true;
  },

  // Returns location info from session (from JWT decoded on login)
  getLocation(): { locationId: number | null; locationCode: string | null; locationName: string | null } {
    const session = this.get();
    return {
      locationId: session?.locationId ?? null,
      locationCode: session?.locationCode ?? null,
      locationName: session?.locationName ?? null
    };
  },

  // True if user is Global Admin (no specific location assigned)
  isGlobalAdmin(): boolean {
    const session = this.get();
    if (!session) return false;
    const isSuperAdmin = session.role === 'Super Admin';
    const isAdminRole = ['Admin', 'Super Admin'].includes(session.role || '');
    return isSuperAdmin || (isAdminRole && (!session.locationId || session.isGlobalAdmin === true));
  },

  getToken(): string | null {
    if (typeof sessionStorage !== 'undefined') {
      const stored = sessionStorage.getItem('bsc_token');
      if (stored) return stored;
    }
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('bsc_token');
      if (stored) return stored;
    }
    const session = this.get();
    return session?.token || null;
  },

  clear() {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('bsc_token');
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('bsc_token');
        localStorage.removeItem('bsc_refresh_token');
        localStorage.removeItem('bsc_selected_location');
      }
      const hadSession = !!localStorage.getItem('bsc_crm_session');
      localStorage.removeItem('bsc_crm_session');

      if (hadSession && !authClearDispatching && typeof window !== 'undefined') {
        authClearDispatching = true;
        try {
          window.dispatchEvent(new Event('bsc_auth_changed'));
        } finally {
          authClearDispatching = false;
        }
      }
    } catch (e) {}
  },

  logout() {
    // Best-effort server notification so the sign-out is recorded in the
    // admin's login-activity trail. Never blocks the redirect.
    // The backend will clear the HttpOnly cookie
    try {
      const session = this.get();
      if (session) {
        // Track logout
        API.trackUserLogout(session.id, session.username).catch(() => {});
        
        // Call the backend logout (cookie will be sent automatically)
        fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': getCsrfToken() || ''
          },
          credentials: 'include', // Include HttpOnly cookie
          keepalive: true
        }).catch(() => {});
      }
    } catch { /* offline — session clears locally regardless */ }
    this.clear();
    if (typeof window !== 'undefined') {
      window.location.replace('/login');
    }
  }
};

/**
 * triggerSecurityLogout — Centralized immediate security force-logout.
 * Clears local session, storage flags, and redirects to /login with security notice.
 */
export function triggerSecurityLogout(
  reason: string = 'Session expired. Please log in again.',
  violationPath: string = ''
) {
  if (isLoggingOut) return;
  isLoggingOut = true;
  try {
    Auth.clear();
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('bsc_selected_location');
      localStorage.setItem('bsc_logout_reason', reason);
    }
  } catch (e) {}

  if (typeof window !== 'undefined') {
    const currentPath = window.location.pathname;
    if (!currentPath.startsWith('/login')) {
      window.location.replace('/login');
    }
  }
}

// ── Silent Refresh State ──────────────────────────────────────────────────────
let isRefreshingToken = false;
let refreshPromise: Promise<boolean> | null = null;

export async function silentRefreshToken(): Promise<boolean> {
  if (isRefreshingToken && refreshPromise) {
    return refreshPromise;
  }
  isRefreshingToken = true;
  refreshPromise = (async () => {
    try {
      const csrf = getCsrfToken() || '';
      const token = Auth.getToken();
      const storedRefresh = typeof localStorage !== 'undefined' ? localStorage.getItem('bsc_refresh_token') : null;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-csrf-token': csrf
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['x-auth-token'] = token;
      }

      const apiBase = getApiBase();
      const refreshUrl = `${apiBase}/auth/refresh`;

      const res = await fetch(refreshUrl, {
        method: 'POST',
        headers,
        body: storedRefresh ? JSON.stringify({ refreshToken: storedRefresh }) : undefined,
        credentials: 'include'
      });

      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        const newAuthToken = json?.data?.token || json?.token;
        if (newAuthToken) {
          if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('bsc_token', newAuthToken);
          if (typeof localStorage !== 'undefined') localStorage.setItem('bsc_token', newAuthToken);
          const current = Auth.get();
          if (current) {
            current.token = newAuthToken;
            current.loginAt = Date.now();
            try {
              localStorage.setItem('bsc_crm_session', JSON.stringify(current));
            } catch (e) {}
          }
        }
        const newRefresh = json?.data?.refreshToken || json?.refreshToken;
        if (newRefresh && typeof localStorage !== 'undefined') {
          localStorage.setItem('bsc_refresh_token', newRefresh);
        }
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      isRefreshingToken = false;
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

// Background auto-refresh access token every 30 minutes if user session is active
if (typeof window !== 'undefined') {
  setInterval(() => {
    if (Auth.check()) {
      silentRefreshToken().catch(() => {});
    }
  }, 30 * 60 * 1000);
}

/**
 * Strip undefined/null/empty values before building URLSearchParams.
 * URLSearchParams converts `undefined` to the literal string "undefined",
 * which backends treat as a real filter value (e.g. WHERE status = 'undefined'),
 * returning zero results.
 */
function cleanQueryParams(obj: Record<string, any>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '') out[k] = String(v);
  }
  return out;
}

// In-Flight GET Request Deduplication Map
const inFlightGetRequests = new Map<string, Promise<any>>();

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const method = (options.method || 'GET').toUpperCase();
  const isGet = method === 'GET';

  const session = Auth.get();
  const token = Auth.getToken();
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>)
  };

  // Dual-Auth: Attach Bearer token if present alongside credentials: 'include' cookies
  if (token && !headers['Authorization'] && !headers['authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  // Belt-and-suspenders: also send x-auth-token for backend fallback extraction
  if (token) {
    headers['x-auth-token'] = token;
  }

  // CSRF Protection
  const csrfToken = getCsrfToken();
  if (csrfToken) {
    headers['x-csrf-token'] = csrfToken;
  }

  // Device ID for anonymous tracking
  const deviceId = typeof localStorage !== 'undefined' ? localStorage.getItem('bsc_chat_device_id') : null;
  if (deviceId) {
    headers['x-device-id'] = deviceId;
  }

  // Dynamic multi-location header injection
  const isSuperAdmin = session?.role === 'Super Admin';
  const isAdminRole = ['Admin', 'Super Admin'].includes(session?.role || '');
  const isGlobal = isSuperAdmin || (isAdminRole && (!session?.locationId || session?.isGlobalAdmin === true));
  let activeLoc = typeof localStorage !== 'undefined' ? localStorage.getItem('bsc_selected_location') : null;

  if (!isGlobal && session?.locationId) {
    // Non-global user: strictly enforce session location unless allowedLocations includes activeLoc
    const allowed = Array.isArray(session.allowedLocations) && session.allowedLocations.length > 0
      ? session.allowedLocations.map(String)
      : [String(session.locationId)];
    if (activeLoc && allowed.includes(activeLoc)) {
      headers['X-Location-Id'] = activeLoc;
    } else {
      headers['X-Location-Id'] = String(session.locationId);
    }
  } else if (activeLoc && activeLoc !== 'ALL') {
    headers['X-Location-Id'] = activeLoc;
  }

  const apiBase = getApiBase();
  let normalizedEndpoint = endpoint;
  if (normalizedEndpoint.startsWith('/api/')) {
    normalizedEndpoint = normalizedEndpoint.slice(4);
  } else if (normalizedEndpoint === '/api') {
    normalizedEndpoint = '';
  }
  const url = normalizedEndpoint.startsWith('http') 
    ? normalizedEndpoint 
    : `${apiBase}${normalizedEndpoint.startsWith('/') ? normalizedEndpoint : `/${normalizedEndpoint}`}`;

  // Deduplicate concurrent in-flight GET requests
  const dedupKey = isGet ? `${url}__${headers['X-Location-Id'] || ''}__${token || ''}` : null;
  if (dedupKey && inFlightGetRequests.has(dedupKey)) {
    return inFlightGetRequests.get(dedupKey)!;
  }

  const executeFetch = async () => {
  // A backend that is restarting is a temporary condition, not a user error. Only
  // reads are retried — replaying a POST could duplicate an audit or an upload — and
  // only twice, with a growing pause, so a server that is genuinely down reports an
  // error instead of silently filling the network tab.
  const MAX_TRANSIENT_RETRIES = isGet ? 2 : 0;
  const RETRYABLE_GATEWAY_STATUS = [502, 503, 504];
  let transientAttempt = 0;

  try {
    let res: Response;
    for (;;) {
      try {
        res = await fetch(url, {
          ...options,
          headers,
          credentials: 'include' // Include HttpOnly cookies
        });
      } catch (networkErr) {
        if (transientAttempt < MAX_TRANSIENT_RETRIES) {
          await new Promise((r) => setTimeout(r, 600 * Math.pow(3, transientAttempt)));
          transientAttempt += 1;
          continue;
        }
        throw networkErr;
      }
      if (RETRYABLE_GATEWAY_STATUS.includes(res.status) && transientAttempt < MAX_TRANSIENT_RETRIES) {
        await new Promise((r) => setTimeout(r, 600 * Math.pow(3, transientAttempt)));
        transientAttempt += 1;
        continue;
      }
      break;
    }

    const isAuthRoute = endpoint.includes('/auth/login') ||
                        endpoint.includes('/auth/refresh') ||
                        endpoint.includes('/auth/verify-2fa') ||
                        endpoint.includes('/auth/logout') ||
                        endpoint.includes('/auth/lock-status') ||
                        endpoint.includes('/auth/captcha') ||
                        endpoint.includes('/security/log-event') ||
                        endpoint.includes('/user-tracking') ||
                        endpoint.includes('/my-permissions') ||
                        endpoint.includes('/settings/page');

    // On 401, attempt silent refresh once and replay request
    if (res.status === 401 && !isAuthRoute) {
      const refreshed = await silentRefreshToken();
      if (refreshed) {
        const newCsrf = getCsrfToken();
        if (newCsrf) headers['x-csrf-token'] = newCsrf;
        // Update Bearer token and fallback header from refreshed session
        const newToken = Auth.getToken();
        if (newToken) {
          headers['Authorization'] = `Bearer ${newToken}`;
          headers['x-auth-token'] = newToken;
        }
        res = await fetch(url, {
          ...options,
          headers,
          credentials: 'include'
        });
      }
    }

    if (!res.ok) {
      const isForceLogout = res.headers && res.headers.get && res.headers.get('X-Force-Logout') === 'true';
      
      // If server explicitly confirmed session is revoked (X-Force-Logout)
      // or if an authenticated business route is STILL 401 after refresh failed,
      // terminate the dead session cleanly and bring the user to /login with reason.
      if ((isForceLogout || res.status === 401) && !isAuthRoute) {
        const errorData = await res.json().catch(() => ({}));
        const msg = errorData.message || 'Session expired. Please log in again.';
        triggerSecurityLogout(msg, typeof window !== 'undefined' ? window.location.pathname : '');
        const error: any = new Error(msg);
        error.status = res.status;
        error.errors = errorData.errors || [];
        throw error;
      }
      const errorData = await res.json().catch(() => ({}));
      // Backend errors arrive either as `message` or as a plain-string `error`
      // (some routes send `error: { code, message }`). Resolve both so callers
      // surface the real validation text instead of a generic status message.
      let errorMessage: string | undefined =
        errorData.message ||
        (typeof errorData.error === 'string' ? errorData.error : errorData.error?.message);
      if (!errorMessage) {
        switch (res.status) {
          case 400:
          case 422:
            errorMessage = 'Please review the highlighted fields and correct them before trying again.';
            break;
          case 401:
            errorMessage = 'Authentication failed. Please check your credentials.';
            break;
          case 403:
            errorMessage = 'Access denied. You do not have permission to perform this action.';
            break;
          case 404:
            errorMessage = 'The requested resource was not found. Please contact your administrator.';
            break;
          case 409:
            errorMessage = 'This request conflicts with existing data. Please refresh and try again.';
            break;
          case 413:
            errorMessage = 'The uploaded file is too large.';
            break;
          case 423:
            errorMessage = 'Account temporarily locked due to too many failed attempts. Please try again later.';
            break;
          case 429:
            errorMessage = 'Too many requests. Please wait and try again.';
            break;
          case 500:
            errorMessage = 'Unable to load data. Please try again.';
            break;
          case 502:
          case 503:
          case 504:
            // The proxy answers 503 when the backend is not reachable; saying
            // "temporarily unavailable" is both true and actionable.
            errorMessage = 'Live data service is temporarily unavailable. Please try again in a moment.';
            break;
          default:
            errorMessage = `Request failed. Please try again. (Error: ${res.status})`;
        }
      }
      const error: any = new Error(errorMessage);
      error.status = res.status; // Lets callers distinguish 400/404/429/500 failures
      error.errors = errorData.errors || [];
      error.data = errorData;
      error.response = { data: errorData, status: res.status };
      throw error;
    }
    return await res.json();
  } catch (err: any) {
    console.warn(`[API Fetch Error: ${endpoint}]`, err.message);
    // If the error is a network error (not an API response error), provide a user-friendly message
    if (!err.status) {
      // The request never reached the API. Say that plainly rather than blaming the
      // user's internet, and mark it so a screen can offer a retry.
      const networkError: any = new Error(
        'The live data service is temporarily unavailable. Please try again in a moment.'
      );
      networkError.status = 0;
      networkError.errors = [err?.message || 'network'];
      networkError.backendUnavailable = true;
      throw networkError;
    }
    throw err;
  }
  };

  if (dedupKey) {
    const promise = executeFetch().finally(() => {
      inFlightGetRequests.delete(dedupKey);
    });
    inFlightGetRequests.set(dedupKey, promise);
    return promise;
  }

  return executeFetch();
};

function normalizeLocationList(rawList: any[]): any[] {
  const defaults = [
    { id: 1, code: 'BEL', name: 'Belagavi', storeName: 'BSC Textiles Belagavi' },
    { id: 2, code: 'DAV', name: 'Davanagere', storeName: 'BSC Textiles Davanagere' },
    { id: 3, code: 'SHI', name: 'Shivamogga', storeName: 'BSC Textiles Shivamogga' }
  ];
  const list = Array.isArray(rawList) && rawList.length > 0 ? rawList : defaults;
  return list.map((loc: any) => {
    const id = Number(loc.id) || 0;
    const code = String(loc.location_code || loc.code || loc.locationCode || (id === 1 ? 'BEL' : id === 2 ? 'DAV' : id === 3 ? 'SHI' : 'LOC')).trim().toUpperCase();
    const name = String(loc.location_name || loc.name || loc.locationName || (code === 'BEL' || id === 1 ? 'Belagavi' : code === 'DAV' || id === 2 ? 'Davanagere' : code === 'SHI' || id === 3 ? 'Shivamogga' : `Store ${id}`)).trim();
    const storeName = loc.store_name || loc.storeName || `BSC Textiles ${name}`;
    return {
      ...loc,
      id,
      name,
      location_name: name,
      locationName: name,
      code,
      location_code: code,
      locationCode: code,
      store_name: storeName,
      storeName
    };
  });
}

/**
 * Archive metadata returned by the Wedding CRM write endpoints.
 *
 * The backend moves a customer into the permanent Old Customers archive as soon
 * as customer_status becomes a completion status ('Wedding Process Completed' or
 * the bare 'Completed' alias), so every write path that can set a status returns
 * these two fields alongside `message`.
 *
 * PUT /customers/:id/status answers 409 with
 * "This customer is in Old Customers. Restore the record before changing its status."
 * and DELETE /customers/:id answers 403 with
 * "Completed customer records are permanently protected."
 * Both surface through apiFetch as `err.message` plus `err.status`.
 */
export interface WeddingArchiveResult {
  success?: boolean;
  message?: string;
  archived?: boolean;
  lifecycle_status?: 'ACTIVE' | 'OLD_CUSTOMER' | 'ARCHIVED';
  data?: Record<string, any>;
  [key: string]: any;
}

/**
 * GET /wedding-crm/customers/:id/full-profile payload (flattened by the spread below).
 * `associatedCustomers` carries every other journey registered on the same mobile,
 * including permanently archived ones (lifecycle_status, archived_at, archived_by,
 * previous_customer_id), so a repeat customer stays traceable in both directions.
 */
export interface WeddingFullProfileResult extends WeddingArchiveResult {
  customer?: Record<string, any>;
  associatedCustomers?: Record<string, any>[];
  associatedRegistrations?: Record<string, any>[];
  statusHistory?: Record<string, any>[];
  is_old_customer?: boolean;
}

// Legacy Apps Script API Action Dispatcher Wrapper for 100% compatibility
export const API = {
  fileUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    // Use absolute URLs as-is; convert relative paths to root-relative so the
    // browser resolves them against the actual production host (Hostinger).
    // NEVER hardcode localhost — it breaks on every deployment environment.
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return url.startsWith('/') ? url : `/${url}`;
  },
  // Generic HTTP helpers for REST endpoints
  async get(endpoint: string) {
    return apiFetch(endpoint, { method: 'GET' });
  },
  async post(endpoint: string, body?: any) {
    return apiFetch(endpoint, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  },
  async put(endpoint: string, body?: any) {
    return apiFetch(endpoint, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  },
  async delete(endpoint: string, body?: any) {
    return apiFetch(endpoint, {
      method: 'DELETE',
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  },

  async call(action: string, params: any = {}) {
    try {
      const res = await apiFetch('/legacy', {
        method: 'POST',
        body: JSON.stringify({ action, ...params })
      });
      return res;
    } catch (err: any) {
      console.warn(`[Legacy Dispatch Error: ${action}]`, err.message);
      return { success: false, error: err.message };
    }
  },

  // Auth
  async login(username: string, password: string, captchaId?: string, captchaText?: string) {
    return apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, captchaId, captchaText })
    });
  },

  // Step 2: Verify 2FA OTP
  async verify2fa(userId: number | string, otp: string, partialAuth?: any) {
    return apiFetch('/auth/verify-2fa', {
      method: 'POST',
      body: JSON.stringify({ userId, otp, partialAuth })
    });
  },

  // Resend 2FA OTP
  async resend2fa(userId: number | string) {
    return apiFetch('/auth/resend-2fa', {
      method: 'POST',
      body: JSON.stringify({ userId })
    });
  },

  // Check server-side lockout status for account/IP
  async getLockStatus(username?: string) {
    const q = username ? `?username=${encodeURIComponent(username)}` : '';
    return apiFetch(`/auth/lock-status${q}`);
  },

  // Numeric captcha for the sign-in screen (server-generated SVG + opaque id)
  async getCaptcha() {
    return apiFetch('/auth/captcha');
  },

  // Password reset
  async requestPasswordReset(email: string) {
    return apiFetch('/auth/request-password-reset', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  },

  async verifyPasswordResetToken(token: string) {
    return apiFetch(`/auth/verify-password-reset-token?token=${encodeURIComponent(token)}`);
  },

  async resetPassword(token: string, newPassword: string) {
    return apiFetch('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword })
    });
  },

  // Authenticated user password update (Available to ALL ROLES)
  async changePassword(currentPassword: string, newPassword: string, confirmPassword?: string) {
    return apiFetch('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
    });
  },

  // Administrator reset user password
  async adminResetUserPassword(userId: number | string, password: string) {
    return apiFetch(`/settings/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password })
    });
  },

  // Email verification
  async sendEmailVerification(email: string) {
    return apiFetch('/auth/send-verification', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  },

  async verifyEmail(token: string) {
    return apiFetch(`/auth/verify-email?token=${encodeURIComponent(token)}`);
  },

  async resendEmailVerification(email: string) {
    return apiFetch('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  },

  // Developer Tools Detection Security Shield
  async getShieldStatus() {
    try {
      return await apiFetch('/security/shield-status');
    } catch {
      return { success: false, enabled: false };
    }
  },
  async toggleShield(enabled: boolean) {
    return apiFetch('/security/shield-toggle', {
      method: 'POST',
      body: JSON.stringify({ enabled })
    });
  },
  async getSecurityEvents(limit: number = 50) {
    return apiFetch(`/security/events?limit=${limit}`);
  },
  async clearSecurityEvents() {
    return apiFetch('/security/clear-events', { method: 'POST' });
  },
  async logSecurityEvent(event: string, details?: any) {
    return apiFetch('/security/log-event', {
      method: 'POST',
      body: JSON.stringify({ event, details })
    });
  },

  // System Administrator endpoints
  async getSystemLogs(params?: { limit?: number; offset?: number; module?: string; action?: string }) {
    const q = params ? new URLSearchParams(params as any).toString() : '';
    return apiFetch(`/security/system-logs${q ? `?${q}` : ''}`);
  },
  async getLiveActivity(limit?: number) {
    return apiFetch(`/security/live-activity${limit ? `?limit=${limit}` : ''}`);
  },
  async getDashboardStats() {
    return apiFetch('/security/dashboard-stats');
  },
  async getHRDashboard(locationId?: number | string) {
    const q = locationId ? `?locationId=${encodeURIComponent(locationId)}` : '';
    return apiFetch(`/dashboard/hr${q}`);
  },
  async getManagerDashboard(locationId?: number | string) {
    const q = locationId ? `?locationId=${encodeURIComponent(locationId)}` : '';
    return apiFetch(`/dashboard/manager${q}`);
  },

  // ── Public Landing Page APIs ─────────────────────────────────────
  async getLandingStats() {
    return apiFetch('/landing/stats');
  },
  async getLandingLocations() {
    return apiFetch('/landing/locations');
  },
  async submitLandingEnquiry(data: any) {
    return apiFetch('/landing/enquiry', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // ── Server-Side Route Validation ─────────────────────────────────
  async validateRoute(pathname: string) {
    try {
      return await apiFetch('/security/validate-route', {
        method: 'POST',
        body: JSON.stringify({ pathname })
      });
    } catch {
      return { success: true, allowed: true, reason: 'Validation unavailable — frontend guard active' };
    }
  },

  // ── Session Activity ─────────────────────────────────────────────
  async getSessionActivity(params?: { userId?: number; username?: string; action?: string; limit?: number; offset?: number }) {
    const q = params ? new URLSearchParams(params as any).toString() : '';
    return apiFetch(`/security/session-activity${q ? `?${q}` : ''}`);
  },

  // ── Force Logout (Admin) ─────────────────────────────────────────
  async forceLogoutUser(userId?: number, username?: string, reason?: string) {
    return apiFetch('/security/force-logout', {
      method: 'POST',
      body: JSON.stringify({ userId, username, reason })
    });
  },

  // ── Consent ──────────────────────────────────────────────────────
  async getConsentStatus() {
    return apiFetch('/consent/status');
  },
  async acceptConsent(privacyPolicyAccepted: boolean, termsAccepted: boolean) {
    return apiFetch('/consent/accept', {
      method: 'POST',
      body: JSON.stringify({ privacyPolicyAccepted, termsAccepted })
    });
  },
  async getPolicyVersions() {
    return apiFetch('/consent/policy-versions');
  },
  async getUserConsents(params?: { username?: string; status?: string; limit?: number; offset?: number }) {
    const q = params ? new URLSearchParams(params as any).toString() : '';
    return apiFetch(`/consent/admin/user-consents${q ? `?${q}` : ''}`);
  },

  // User Tracking
  async trackUserLogin(userId: string | number, username: string, ipAddress?: string, userAgent?: string, locationId?: number | null, locationName?: string | null) {
    if (!userId && !username) return { success: true };
    return apiFetch('/user-tracking/login', {
      method: 'POST',
      body: JSON.stringify({ userId, username, ipAddress, userAgent, locationId, locationName })
    }).catch(() => ({ success: true }));
  },
  
  async trackUserLogout(userId: string | number, username: string, ipAddress?: string) {
    return apiFetch('/user-tracking/logout', {
      method: 'POST',
      body: JSON.stringify({ userId, username, ipAddress })
    });
  },
  
  async trackUserActivity(userId: string | number, username: string, action: string, page?: string, url?: string, metadata?: any) {
    return apiFetch('/user-tracking/activity', {
      method: 'POST',
      body: JSON.stringify({ userId, username, action, page, url, metadata })
    });
  },
  
  async getActiveUsers() {
    return apiFetch('/user-tracking/active');
  },
  
  async getUserTrackingStats() {
    return apiFetch('/user-tracking/stats');
  },
  
  async getUserActivity(params?: { userId?: string | number; username?: string; action?: string; fromDate?: string; toDate?: string; limit?: number; offset?: number }) {
    const query = new URLSearchParams(params as any).toString();
    return apiFetch(`/user-tracking/activity${query ? `?${query}` : ''}`);
  },

  // Candidates
  async uploadDocuments(formData: FormData, candName?: string, appNo?: string) {
    const session = Auth.get();
    const headers: Record<string, string> = {};
    if (session) {
      // CSRF token
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }
    }
    if (candName) {
      headers['x-candidate-name'] = encodeURIComponent(candName);
    }
    if (appNo) {
      headers['x-app-no'] = appNo;
    }
    const apiBase = getApiBase();
    const url = `${apiBase}/candidates/upload-documents`;
    const res = await fetch(url, { method: 'POST', headers, body: formData, credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  },
  async getCandidates(filters: any = {}) {
    const query = new URLSearchParams(filters).toString();
    return apiFetch(`/candidates?${query}`);
  },
  async getEmployees(params?: { locationId?: string | number }) {
    const q = params ? new URLSearchParams(cleanQueryParams(params)).toString() : '';
    return apiFetch(`/employees${q ? `?${q}` : ''}`);
  },
  async getEmployeeProfile(id: string | number) {
    return apiFetch(`/employees/${id}`);
  },
  async getEmployeeDetails(id: string | number) {
    return apiFetch(`/employees/${id}`);
  },
  async createEmployee(data: any) {
    return apiFetch('/employees', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  async updateEmployee(id: string | number, data: any) {
    return apiFetch(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },
  async deleteEmployee(id: string | number) {
    return apiFetch(`/employees/${id}`, {
      method: 'DELETE'
    });
  },
  async requestEmployeeAccess(id: string | number, reason?: string) {
    return apiFetch(`/employees/${id}/access-request`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  },
  async getEmployeeAccessRequests() {
    return apiFetch('/employees/access-requests');
  },
  async resolveEmployeeAccessRequest(id: string | number, action: 'APPROVE' | 'REJECT') {
    return apiFetch(`/employees/access-requests/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ action })
    });
  },
  async uploadEmployeePhoto(id: string | number, file: File) {
    const fd = new FormData();
    fd.append('photo', file);
    return apiFetch(`/employees/${id}/photo`, { method: 'POST', body: fd });
  },
  async removeEmployeePhoto(id: string | number) {
    return apiFetch(`/employees/${id}/photo`, { method: 'DELETE' });
  },
  getEmployeePhotoUrl(id: string | number) {
    const apiBase = getApiBase();
    return `${apiBase}/employees/${id}/photo`;
  },
  async getEmployeeDocuments(id: string | number) {
    return apiFetch(`/employees/${id}/documents`);
  },
  async uploadEmployeeDocument(id: string | number, file: File, documentType: string) {
    const fd = new FormData();
    fd.append('document', file);
    fd.append('documentType', documentType);
    return apiFetch(`/employees/${id}/documents`, { method: 'POST', body: fd });
  },
  async replaceEmployeeDocument(id: string | number, docId: string | number, file: File, documentType?: string) {
    const fd = new FormData();
    fd.append('document', file);
    if (documentType) fd.append('documentType', documentType);
    return apiFetch(`/employees/${id}/documents/${docId}`, { method: 'PUT', body: fd });
  },
  async deleteEmployeeDocument(id: string | number, docId: string | number) {
    return apiFetch(`/employees/${id}/documents/${docId}`, { method: 'DELETE' });
  },
  getEmployeeDocumentViewUrl(id: string | number, docId: string | number) {
    const apiBase = getApiBase();
    return `${apiBase}/employees/${id}/documents/${docId}/view`;
  },
  getEmployeeDocumentDownloadUrl(id: string | number, docId: string | number) {
    const apiBase = getApiBase();
    return `${apiBase}/employees/${id}/documents/${docId}/download`;
  },
  async addCandidate(data: any) {
    // Legacy route uses /add or we just map it in our generic call
    return apiFetch('/candidates', {
      method: 'POST',
      body: JSON.stringify({ data })
    });
  },
  async deleteCandidate(appNo: string) {
    return apiFetch(`/candidates/${appNo}`, {
      method: 'DELETE'
    });
  },
  async updateCandidate(appNo: string, updates: any, candName?: string, doneBy?: string) {
    return apiFetch(`/candidates/${appNo}`, {
      method: 'PUT',
      body: JSON.stringify({ appNo, updates, candName, doneBy })
    });
  },
  async checkDuplicate(phone: string) {
    return apiFetch(`/candidates/check-duplicate?phone=${encodeURIComponent(phone)}`);
  },
  async getNextAppNo() {
    return apiFetch('/candidates/next-app-no');
  },
  async getKPIs(dateRange?: string, fromDate?: string, toDate?: string) {
    const params = new URLSearchParams();
    if (dateRange) params.append('range', dateRange);
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    const qs = params.toString();
    return apiFetch(`/candidates/kpis${qs ? `?${qs}` : ''}`);
  },
  async getPendingActions() {
    return apiFetch('/candidates/pending-actions');
  },
  async getSourceBreakdown() {
    return apiFetch('/candidates/source-breakdown');
  },
  async getActivityFull(appNo: string) {
    return apiFetch(`/candidates/activity-full?appNo=${encodeURIComponent(appNo)}`);
  },
  async getActivity(params: { limit?: number } = {}) {
    return apiFetch(`/candidates/activity?limit=${params.limit || 10}`);
  },

  // Interviews
  async getInterviews() {
    return apiFetch('/interviews');
  },
  async getInterviewQuestions(desig?: string, round?: string) {
    const query = new URLSearchParams({ desig: desig || '', round: round || 'HR' }).toString();
    return apiFetch(`/interviews/questions?${query}`);
  },
  async saveCallStep(p: any) {
    return apiFetch('/interviews/save-call-step', {
      method: 'POST',
      body: JSON.stringify(p)
    });
  },
  async getCallStatus(appNo: string) {
    return apiFetch(`/interviews/call-status?appNo=${encodeURIComponent(appNo)}`);
  },
  async saveScore(appNo: string, round: string, scores: any, offeredSalary?: string, offeredDoj?: string) {
    return apiFetch('/interviews/save-score', {
      method: 'POST',
      body: JSON.stringify({ appNo, round, scores, offeredSalary, offeredDoj })
    });
  },
  async generateInterviewToken(p: any) {
    return apiFetch('/interviews/generate-token', {
      method: 'POST',
      body: JSON.stringify(p)
    });
  },
  async approveSelection(p: any) {
    return apiFetch('/interviews/approve-selection', {
      method: 'POST',
      body: JSON.stringify(p)
    });
  },
  async rejectCandidate(p: any) {
    return apiFetch('/interviews/reject-candidate', {
      method: 'POST',
      body: JSON.stringify(p)
    });
  },
  async getSelectedCandidates() {
    return apiFetch('/interviews/selected');
  },
  async getRejectedCandidates() {
    return apiFetch('/interviews/rejected');
  },

  // Offers
  async getOffers() {
    return apiFetch('/offers');
  },
  async createDirectOffer(p: any) {
    return apiFetch('/offers/direct', {
      method: 'POST',
      body: JSON.stringify(p)
    });
  },
  async logOfferCall(p: any) {
    return apiFetch('/offers/log-call', {
      method: 'POST',
      body: JSON.stringify(p)
    });
  },
  async updateOfferStatus(p: any) {
    return apiFetch('/offers/update-status', {
      method: 'POST',
      body: JSON.stringify(p)
    });
  },
  async updateOfferDetails(p: any) {
    return apiFetch('/offers/update-details', {
      method: 'POST',
      body: JSON.stringify(p)
    });
  },
  async acceptOffer(p: any) {
    return apiFetch('/offers/accept', {
      method: 'POST',
      body: JSON.stringify(p)
    });
  },
  async rejectOffer(p: any) {
    return apiFetch('/offers/reject', {
      method: 'POST',
      body: JSON.stringify(p)
    });
  },
  async markJoined(p: any) {
    return apiFetch('/offers/mark-joined', {
      method: 'POST',
      body: JSON.stringify(p)
    });
  },

  // Settings
  async getUsers() { return apiFetch('/settings/users'); },
  async addUser(p: any) { return apiFetch('/settings/users/add', { method: 'POST', body: JSON.stringify(p) }); },
  async updateUser(p: any) { return apiFetch('/settings/users/update', { method: 'POST', body: JSON.stringify(p) }); },
  async deleteUser(identifier: number | string | { id?: number | string; username?: string }) {
    const raw = typeof identifier === 'object' ? (identifier.id ?? identifier.username) : identifier;
    const id = raw === undefined || raw === null ? '' : String(raw);
    if (!id) {
      return Promise.reject(new Error('User ID or username is required for deletion'));
    }
    return apiFetch(`/settings/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  async getPageSettings() { 
    return await apiFetch('/settings/page-visibility'); 
  },
  async savePageSettings(settings: any) { return apiFetch('/settings/page-visibility', { method: 'POST', body: JSON.stringify({ settings }) }); },
  async getRoles() { return apiFetch('/settings/roles'); },
  async getDesignations() { return apiFetch('/settings/designations'); },
  async getDepartments() { return apiFetch('/settings/departments'); },
  async getPublicDesignations() { return API.call('getPublicDesignations'); },
  async addDesignation(name: string) { return apiFetch('/settings/designations/add', { method: 'POST', body: JSON.stringify({ name }) }); },
  async deleteDesignation(name: string) { return apiFetch('/settings/designations/delete', { method: 'POST', body: JSON.stringify({ name }) }); },

  // ── User Management (Admin) ─────────────────────────────────
  async getAdminUsers() {
    const res = await apiFetch('/admin/users');
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getAdminUser(id: number | string) {
    const res = await apiFetch(`/admin/users/${id}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async createAdminUser(data: any) { return apiFetch('/admin/users', { method: 'POST', body: JSON.stringify(data) }); },
  async updateAdminUser(id: number | string, data: any) { return apiFetch(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
  async deleteAdminUser(id: number | string) { return apiFetch(`/admin/users/${id}`, { method: 'DELETE' }); },
  /**
   * Downloads the approved employee/user import CSV. The header row is
   * produced by the backend from the same EMPLOYEE_CSV_HEADERS constant the
   * validator uses, so the downloaded sample can never drift from what the
   * server will accept.
   */
  async downloadUserImportTemplate() {
    const apiBase = getApiBase();
    const token = Auth.getToken();
    const csrfToken = getCsrfToken();
    const res = await fetch(`${apiBase}/admin/users/import-template`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}`, 'x-auth-token': token } : {}),
        ...(csrfToken ? { 'x-csrf-token': csrfToken } : {})
      }
    });
    if (!res.ok) {
      let message = 'Could not download the approved CSV file. Please try again.';
      try {
        const body = await res.json();
        if (body && body.message) message = body.message;
      } catch (e) { /* non-JSON body */ }
      throw new Error(message);
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'BSC_User_Import_Template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    return { success: true };
  },
  /** Bulk-imports approved user accounts from a .csv file. */
  async importAdminUsersCsv(file: File) {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return apiFetch('/admin/users/import-csv', { method: 'POST', body: formData });
  },
  async getAdminUserPermissions(id: number | string) {
    const res = await apiFetch(`/admin/users/${id}/permissions`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async updateAdminUserPermissions(id: number | string, permissions: any[]) { return apiFetch(`/admin/users/${id}/permissions`, { method: 'PUT', body: JSON.stringify({ permissions }) }); },
  async toggleAdminUserStatus(id: number | string, data?: { duration?: string; customDate?: string; reason?: string }) {
    const res = await apiFetch(`/admin/users/${id}/toggle-status`, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async resetAdminUserPassword(id: number | string, password: string) {
    const res = await apiFetch(`/admin/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getAdminModules() {
    const res = await apiFetch('/admin/users/modules');
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getMyPermissions() {
    if (typeof window !== 'undefined' && !Auth.check()) {
      return { success: true, data: { isAdmin: false, modules: [], permissions: [] } };
    }
    const res = await apiFetch('/my-permissions');
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  // Broadcasts
  async getBroadcasts() { return apiFetch('/broadcasts'); },
  async createBroadcast(payload: any) { return apiFetch('/broadcasts', { method: 'POST', body: JSON.stringify(payload) }); },
  async deleteBroadcast(id: string | number) { return apiFetch(`/broadcasts/${id}`, { method: 'DELETE' }); },

  // Department Hiring & Section Allocation
  async getHiringTargets() { return apiFetch('/dept-hiring/targets'); },
  async saveHiringTarget(payload: any) { return apiFetch('/dept-hiring/targets', { method: 'POST', body: JSON.stringify(payload) }); },
  async getSectionAllocations() { return apiFetch('/section-allocations'); },
  async saveSectionAllocation(payload: any) { return apiFetch('/section-allocations', { method: 'POST', body: JSON.stringify(payload) }); },
  async bulkSaveSectionAllocation(payload: any) { return apiFetch('/section-allocations/bulk', { method: 'POST', body: JSON.stringify(payload) }); },

  // Department Sections CRUD
  async getDepartmentSections() { return apiFetch('/dept-hiring/sections'); },
  async addDepartmentSection(payload: any) { return apiFetch('/dept-hiring/sections/add', { method: 'POST', body: JSON.stringify(payload) }); },
  async editDepartmentSection(payload: any) { return apiFetch('/dept-hiring/sections/edit', { method: 'POST', body: JSON.stringify(payload) }); },
  async deleteDepartmentSection(payload: number | string | { id?: number | string; department?: string; sectionName?: string }) { 
    const bodyObj = typeof payload === 'object' ? payload : { id: payload };
    return apiFetch('/dept-hiring/sections/delete', { method: 'POST', body: JSON.stringify(bodyObj) }); 
  },

  // CRM Store Operations
  async getCrmSettings() { return apiFetch('/crm/settings'); },
  async updateCrmSettings(payload: any) { return apiFetch('/crm/settings/update', { method: 'POST', body: JSON.stringify(payload) }); },
  async verifyPin(payload: { type: string; pin: string; locationId?: number | string }) { return apiFetch('/crm/verify-pin', { method: 'POST', body: JSON.stringify(payload) }); },
  /**
   * The TV board is a kiosk surface: it carries the bearer token issued by a correct
   * PIN instead of relying on a logged-in admin session, and the server scopes every
   * figure to the location bound inside that token.
   */
  async getTvDisplayData(locationId?: string | number, kioskToken?: string | null) {
    const q = locationId ? `?locationId=${encodeURIComponent(String(locationId))}` : '';
    // A stale Authorization header from the app session must not outrank the kiosk
    // token, so this is sent as an explicit override rather than relying on apiFetch.
    return apiFetch(`/crm/tv-display${q}`, kioskToken ? { headers: { Authorization: `Bearer ${kioskToken}` } } : {});
  },
  async getSections() { return apiFetch('/crm/sections'); },
  async getFootfall(date?: string, locationId?: string | number) {
    const p: any = {};
    if (date) p.date = date;
    if (locationId) p.locationId = locationId;
    const q = new URLSearchParams(cleanQueryParams(p)).toString();
    return apiFetch(`/crm/footfall${q ? `?${q}` : ''}`);
  },
  /** Today's entries with origin and editor, for the kiosk list and management filters. */
  async getFootfallEntries(params?: { date?: string; locationId?: number | string; source?: string; greeter?: string }) {
    const p: Record<string, string> = {};
    if (params?.date) p.date = params.date;
    if (params?.locationId) p.locationId = String(params.locationId);
    if (params?.source && params.source !== 'all') p.source = params.source;
    if (params?.greeter && params.greeter !== 'all') p.greeter = params.greeter;
    const q = new URLSearchParams(cleanQueryParams(p)).toString();
    const res = await apiFetch(`/crm/footfall/entries${q ? `?${q}` : ''}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  /** Correct a specific record by id — updates the existing row, never inserts one. */
  async updateFootfallEntry(id: string, payload: {
    visitors?: number; entryDate?: string; slotHour?: number;
    location_id?: number; remarks?: string; reason?: string;
  }) {
    const res = await apiFetch(`/crm/footfall/entry/${encodeURIComponent(id)}`, {
      method: 'PUT', body: JSON.stringify(payload)
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getFootfallEntryHistory(id: string) {
    const res = await apiFetch(`/crm/footfall/entry/${encodeURIComponent(id)}/history`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async upsertFootfall(payload: any) {
    const bodyPayload = { ...payload };
    if (!bodyPayload.location_id && !bodyPayload.locationId) {
      const activeLoc = typeof localStorage !== 'undefined' ? localStorage.getItem('bsc_selected_location') : null;
      if (activeLoc && activeLoc !== 'ALL') {
        const parsed = parseInt(activeLoc, 10);
        if (!isNaN(parsed) && parsed > 0) bodyPayload.location_id = parsed;
      }
      if (!bodyPayload.location_id) {
        const sess = Auth.get();
        if (sess?.locationId) bodyPayload.location_id = sess.locationId;
      }
    }
    return apiFetch('/crm/footfall/upsert', { method: 'POST', body: JSON.stringify(bodyPayload) });
  },
  async getFeedbackQuestions() { return apiFetch('/crm/feedback-questions'); },
  async getFeedbackStats(params?: { location_id?: string | number; locationId?: string | number }) {
    const q = params ? new URLSearchParams(params as any).toString() : '';
    return apiFetch(`/crm/feedback-stats${q ? `?${q}` : ''}`);
  },
  async getFeedbacks(params?: { date?: string; startDate?: string; endDate?: string; isNegative?: string; search?: string; followUp?: string; location_id?: string | number; locationId?: string | number }) {
    const q = params ? new URLSearchParams(params as any).toString() : '';
    return apiFetch(`/crm/feedbacks${q ? `?${q}` : ''}`);
  },
  async deleteFeedback(id: string) { return apiFetch(`/crm/feedbacks/${id}`, { method: 'DELETE' }); },
  async getFeedbackFollowUpHistory(id: string) { return apiFetch(`/crm/feedbacks/${encodeURIComponent(id)}/follow-up-history`); },
  async clearAllFeedbacks(locationId?: string) {
    const q = locationId ? `?locationId=${encodeURIComponent(locationId)}` : '';
    return apiFetch(`/crm/feedbacks${q}`, { method: 'DELETE' });
  },
  async submitFeedback(payload: any) { return apiFetch('/crm/feedback', { method: 'POST', body: JSON.stringify(payload) }); },
  async getCallQueue(params?: { date?: string; startDate?: string; endDate?: string; status?: string; search?: string; location_id?: string | number; locationId?: string | number }) {
    const q = params ? new URLSearchParams(cleanQueryParams(params)).toString() : '';
    return apiFetch(`/crm/call-queue${q ? `?${q}` : ''}`);
  },
  async updateCallQueue(payload: any) { return apiFetch('/crm/call-queue/update', { method: 'POST', body: JSON.stringify(payload) }); },
  async getDiverts(params?: { locationId?: string | number }) {
    const q = params ? new URLSearchParams(cleanQueryParams(params)).toString() : '';
    return apiFetch(`/crm/diverts${q ? `?${q}` : ''}`);
  },
  async createDivert(payload: any) { return apiFetch('/crm/diverts/create', { method: 'POST', body: JSON.stringify(payload) }); },
  async updateDivert(payload: any) { return apiFetch('/crm/diverts/update', { method: 'POST', body: JSON.stringify(payload) }); },
  async getDivertUpdates(divertId: string) { return apiFetch(`/crm/diverts/updates?divertId=${divertId}`); },
  async uploadDivertImage(file: File) {
    const fd = new FormData();
    fd.append('image', file);
    return apiFetch('/crm/diverts/upload-image', { method: 'POST', body: fd });
  },
  async exportDiverts() { return apiFetch('/crm/diverts/export'); },
  async getStoreDirectory(search?: string) {
    return apiFetch(`/directory${search ? `?search=${encodeURIComponent(search)}` : ''}`);
  },
  async exportStoreDirectory() { return apiFetch('/directory/export'); },
  async getCashSettlement(date?: string) { return apiFetch(`/cash${date ? `?date=${date}` : ''}`); },
  async saveCashSettlement(payload: any) { return apiFetch('/cash/save', { method: 'POST', body: JSON.stringify(payload) }); },
  async getVmPoints() { return apiFetch('/vm/points'); },
  async getVmSubmissions(params?: any) {
    const q = params ? new URLSearchParams(cleanQueryParams(params)).toString() : '';
    return apiFetch(`/vm/submissions${q ? `?${q}` : ''}`);
  },
  async getVmDashboard(params?: {
    locationId?: string | number;
    floor?: string;
    section?: string;
    dateRange?: string;
    dateFrom?: string;
    dateTo?: string;
    auditor?: string;
    status?: string;
  }) {
    const q = params ? new URLSearchParams(cleanQueryParams(params)).toString() : '';
    return apiFetch(`/vm/dashboard${q ? `?${q}` : ''}`);
  },
  async getVmAudits(params?: {
    locationId?: string | number;
    floor?: string;
    section?: string;
    dateRange?: string;
    dateFrom?: string;
    dateTo?: string;
    auditor?: string;
    status?: string;
    minScore?: number;
    maxScore?: number;
    search?: string;
    limit?: number;
    page?: number;
  }) {
    const q = params ? new URLSearchParams(cleanQueryParams(params)).toString() : '';
    return apiFetch(`/vm/audits${q ? `?${q}` : ''}`);
  },
  async getVmAuditDetail(id: string) {
    return apiFetch(`/vm/audits/${encodeURIComponent(id)}`);
  },
  async exportVmAudits(params?: any) {
    const q = params ? new URLSearchParams(cleanQueryParams(params)).toString() : '';
    const apiBase = getApiBase();
    const token = Auth.getToken();
    const response = await fetch(`${apiBase}/vm/audits/export${q ? `?${q}` : ''}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    if (!response.ok) throw new Error('Failed to export VM audits');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vm_audits_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    return { success: true };
  },
  async submitVm(payload: any) { return apiFetch('/vm/submit', { method: 'POST', body: JSON.stringify(payload) }); },
  async getVmFloors() { return apiFetch('/vm/floors'); },
  async createVmFloor(payload: any) { return apiFetch('/vm/floors', { method: 'POST', body: JSON.stringify(payload) }); },
  async deleteVmFloor(payload: any) { return apiFetch('/vm/floors/delete', { method: 'POST', body: JSON.stringify(typeof payload === 'object' ? payload : { id: payload }) }); },
  async getVmPhotos(params?: { locationId?: string | number; floor?: string; section?: string; submissionId?: string; pointId?: string; date?: string; dateFrom?: string; dateTo?: string; inspector?: string; status?: string; shift?: string; minScore?: number; maxScore?: number; limit?: number; offset?: number }) {
    const q = params ? new URLSearchParams(cleanQueryParams(params)).toString() : '';
    return apiFetch(`/vm/photos${q ? `?${q}` : ''}`);
  },
  async uploadVmPhotos(
    filesOrFormData: File[] | File | FormData,
    meta?: {
      floor?: string;
      section?: string;
      location_name?: string;
      locationName?: string;
      locationId?: string | number;
      location_id?: string | number;
      pointId?: string;
      point_id?: string;
      submissionId?: string;
      submission_id?: string;
      inspectionDate?: string;
      inspection_date?: string;
    }
  ) {
    if (filesOrFormData instanceof FormData) {
      return apiFetch('/vm/photos', { method: 'POST', body: filesOrFormData });
    }
    const fd = new FormData();
    const files = Array.isArray(filesOrFormData) ? filesOrFormData : [filesOrFormData];
    files.forEach((file) => {
      fd.append('photos', file);
    });
    if (meta) {
      if (meta.floor) fd.append('floor', meta.floor);
      if (meta.section) fd.append('section', meta.section);
      if (meta.location_name || meta.locationName) {
        fd.append('location_name', meta.location_name || meta.locationName || '');
        fd.append('locationName', meta.locationName || meta.location_name || '');
      }
      if (meta.locationId || meta.location_id) {
        fd.append('locationId', String(meta.locationId || meta.location_id));
        fd.append('location_id', String(meta.location_id || meta.locationId));
      }
      if (meta.pointId || meta.point_id) {
        fd.append('pointId', meta.pointId || meta.point_id || '');
        fd.append('point_id', meta.point_id || meta.pointId || '');
      }
      if (meta.submissionId || meta.submission_id) {
        fd.append('submissionId', meta.submissionId || meta.submission_id || '');
        fd.append('submission_id', meta.submission_id || meta.submissionId || '');
      }
      if (meta.inspectionDate || meta.inspection_date) {
        fd.append('inspectionDate', meta.inspectionDate || meta.inspection_date || '');
      }
    }
    return apiFetch('/vm/photos', { method: 'POST', body: fd });
  },
  async deleteVmPhoto(photoId: string) {
    return apiFetch(`/vm/photos/${photoId}`, { method: 'DELETE' });
  },
  /** Caption, label, corrective action, question link or display order. */
  async updateVmPhotoMetadata(photoId: string, payload: {
    caption?: string | null; label?: string | null; correctiveAction?: string | null;
    pointId?: string | null; photoOrder?: number;
  }) {
    return apiFetch(`/vm/photos/${encodeURIComponent(photoId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },
  /** Swaps the bytes on an existing photo record; the audit link is preserved. */
  async replaceVmPhoto(photoId: string, file: File) {
    const fd = new FormData();
    fd.append('photo', file);
    return apiFetch(`/vm/photos/${encodeURIComponent(photoId)}/file`, { method: 'PUT', body: fd });
  },
  async getVmPhotoHistory(photoId: string) {
    return apiFetch(`/vm/photos/${encodeURIComponent(photoId)}/history`);
  },
  async linkVmPhotos(submissionId: string, photoIds: string[]) {
    return apiFetch('/vm/photos/link', { method: 'POST', body: JSON.stringify({ submissionId, photoIds }) });
  },
  getVmPhotoFileUrl(photoId: string) {
    const apiBase = getApiBase();
    return `${apiBase}/vm/photos/${photoId}/file`;
  },

  // ── VM guided audit flow (see frontend/src/pages/vm/vmTypes.ts) ──
  /** Step 1 cards: sections, last audit date, latest score and open drafts. */
  async getVmFloorSummary() {
    return apiFetch('/vm/floor-summary');
  },
  /** Idempotent per user + location + floor + section + shift + IST date. */
  async createOrResumeVmDraft(payload: { floor: string; section: string; shift: string }) {
    return apiFetch('/vm/audits/draft', { method: 'POST', body: JSON.stringify(payload) });
  },
  /** Debounced autosave of answers, comments and corrective actions. */
  async saveVmDraft(auditId: string, payload: { shift?: string; entries: unknown[] }) {
    return apiFetch(`/vm/audits/${encodeURIComponent(auditId)}/draft`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },
  /** Server re-computes the score and rejects unanswered questions. */
  async submitVmAudit(auditId: string, payload: { confirm: true }) {
    return apiFetch(`/vm/audits/${encodeURIComponent(auditId)}/submit`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  async getVmAttention(params?: { dateFrom?: string; dateTo?: string; locationId?: number | string }) {
    const q = params ? new URLSearchParams(cleanQueryParams(params)).toString() : '';
    return apiFetch(`/vm/attention${q ? `?${q}` : ''}`);
  },
  /** Who opened, changed, filed and attached evidence to one checklist, newest first. */
  async getVmAuditHistory(auditId: string) {
    return apiFetch(`/vm/audits/${encodeURIComponent(auditId)}/history`);
  },
  /** Photos already stored for one section, optionally scoped to a single audit. */
  async getVmSectionPhotos(params: { floor: string; section: string; submissionId?: string; date?: string }) {
    const q = new URLSearchParams(cleanQueryParams(params as Record<string, unknown>)).toString();
    return apiFetch(`/vm/photos?${q}`);
  },

  // Chat (Gemini AI)
  async getChatStatus() { return apiFetch('/chat/status'); },
  async getChatMessages() { return apiFetch('/chat/messages'); },
  async sendChatMessage(message: string) { return apiFetch('/chat/send', { method: 'POST', body: JSON.stringify({ message }) }); },
  async clearChatMessages() { return apiFetch('/chat/messages', { method: 'DELETE' }); },

  // MCheck — Daily Management Checklist
  async getMCheckModules() { return apiFetch('/mcheck/modules'); },
  async getMCheckDashboard(date?: string) { return apiFetch(`/mcheck/dashboard${date ? `?date=${date}` : ''}`); },
  async getMCheckModuleDetail(moduleId: number | string, date?: string) { return apiFetch(`/mcheck/module/${moduleId}${date ? `?date=${date}` : ''}`); },
  async saveMCheckResponse(payload: any) { return apiFetch('/mcheck/response/save', { method: 'POST', body: JSON.stringify(payload) }); },
  async submitAllMCheck(payload: any) { return apiFetch('/mcheck/response/submit-all', { method: 'POST', body: JSON.stringify(payload) }); },
  async getMCheckReports(params?: { date?: string; fromDate?: string; toDate?: string; module_id?: string; status?: string; search?: string }) {
    const q = new URLSearchParams(params as any).toString();
    return apiFetch(`/mcheck/reports${q ? `?${q}` : ''}`);
  },
  async getMCheckHistory(params?: { limit?: number; offset?: number }) {
    const q = new URLSearchParams(params as any).toString();
    return apiFetch(`/mcheck/history${q ? `?${q}` : ''}`);
  },
  async getMCheckTrend(days?: number) { return apiFetch(`/mcheck/trend${days ? `?days=${days}` : ''}`); },
  async getMCheckAuditLog(checkpointId: number | string, responseDate?: string) {
    return apiFetch(`/mcheck/audit?checkpoint_id=${checkpointId}${responseDate ? `&response_date=${responseDate}` : ''}`);
  },
  async uploadMCheckPhoto(formData: FormData) {
    const session = Auth.get();
    const headers: Record<string, string> = {};
    if (session) {
      // CSRF token
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }
    }
    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/mcheck/upload-photo`, { method: 'POST', headers, body: formData, credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  },
  async getMCheckAdminStructure() { return apiFetch('/mcheck/admin/structure'); },
  async saveMCheckAdminModule(payload: any) { return apiFetch('/mcheck/admin/module', { method: 'POST', body: JSON.stringify(payload) }); },
  async saveMCheckAdminCheckpoint(payload: any) { return apiFetch('/mcheck/admin/checkpoint', { method: 'POST', body: JSON.stringify(payload) }); },
  async reorderMCheckCheckpoints(order: any[]) { return apiFetch('/mcheck/admin/reorder', { method: 'POST', body: JSON.stringify({ order }) }); },
  getMCheckExportUrl(type: 'pdf' | 'excel', params?: { date?: string; fromDate?: string; toDate?: string; module_id?: string; status?: string; locationId?: string }) {
    const apiBase = getApiBase();
    const activeLoc = typeof localStorage !== 'undefined' ? localStorage.getItem('bsc_selected_location') : null;
    const mergedParams: any = { ...params };
    // Token is in HttpOnly cookie, not in URL
    if (activeLoc && !mergedParams.locationId && activeLoc !== 'ALL') {
      mergedParams.locationId = activeLoc;
    }
    const q = cleanQueryParams(mergedParams);
    const qs = new URLSearchParams(q).toString();
    return `${apiBase}/mcheck/export/${type === 'pdf' ? 'pdf' : 'excel'}${qs ? `?${qs}` : ''}`;
  },

  // ── Locations ────────────────────────────────────────────────
  // Public endpoint for landing/registration pages (no auth required)
  async getPublicLocations() {
    const extractList = (raw: any): any[] => {
      if (!raw) return [];
      if (Array.isArray(raw)) return raw;
      if (Array.isArray(raw.locations)) return raw.locations;
      if (Array.isArray(raw.data)) return raw.data;
      return [];
    };

    try {
      const res = await apiFetch('/landing/locations');
      const list = normalizeLocationList(extractList(res));
      if (list.length > 0) {
        return { success: true, locations: list, data: list };
      }
      // Fallback if empty
      const fb = await apiFetch('/locations');
      const fbList = normalizeLocationList(extractList(fb));
      return { success: true, locations: fbList, data: fbList };
    } catch (err) {
      console.warn('[API.getPublicLocations] /landing/locations failed, trying /locations:', err);
      try {
        const fb = await apiFetch('/locations');
        const fbList = normalizeLocationList(extractList(fb));
        return { success: true, locations: fbList, data: fbList };
      } catch (e2) {
        const fallback = normalizeLocationList([]);
        return { success: true, locations: fallback, data: fallback };
      }
    }
  },
  // Authenticated endpoint for admin/staff pages
  async getLocations() {
    try {
      const res = await apiFetch('/locations');
      const list = Array.isArray(res) ? res : (Array.isArray(res?.locations) ? res.locations : (Array.isArray(res?.data) ? res.data : []));
      const normalized = normalizeLocationList(list);
      return { success: true, locations: normalized, data: normalized };
    } catch (err) {
      console.warn('[API.getLocations] Failed, using standard location fallback:', err);
      const fallback = normalizeLocationList([]);
      return { success: true, locations: fallback, data: fallback };
    }
  },
  async getLocation(id: number | string) {
    const res = await apiFetch(`/locations/${id}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getGlobalStats() {
    const res = await apiFetch('/global-stats');
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  // ── Wedding Customer Follow-up CRM ───────────────────────────
  async getWeddingStats(locationId?: number | string) {
    const res = await apiFetch(`/wedding-crm/stats${locationId ? `?location_id=${locationId}` : ''}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getWeddingCustomers(params?: {
    date_filter?: string;
    status?: string;
    call_status?: string;
    location_id?: number | string;
    telecaller_id?: number | string;
    search?: string;
    from_date?: string;
    to_date?: string;
    limit?: number;
    offset?: number;
  }) {
    const q = params ? new URLSearchParams(cleanQueryParams(params)).toString() : '';
    const res = await apiFetch(`/wedding-crm/customers${q ? `?${q}` : ''}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async checkWeddingDuplicate(phone: string) {
    const res = await apiFetch('/wedding-crm/check-duplicate', {
      method: 'POST',
      body: JSON.stringify({ phone })
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async createWeddingCustomer(payload: any) {
    const res = await apiFetch('/wedding-crm/customers', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getWeddingCustomerById(id: number | string) {
    const res = await apiFetch(`/wedding-crm/customers/${id}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async updateWeddingCustomer(id: number | string, payload: any): Promise<WeddingArchiveResult> {
    const res = await apiFetch(`/wedding-crm/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async deleteWeddingCustomer(id: number | string): Promise<WeddingArchiveResult> {
    // Completed/archived rows are immutable: the backend answers 403 with
    // { message: 'Completed customer records are permanently protected.' }, which
    // apiFetch rethrows as err.message — callers must surface that, not a generic error.
    const res = await apiFetch(`/wedding-crm/customers/${id}`, {
      method: 'DELETE'
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getWeddingOldCustomers(params?: {
    search?: string;
    location_id?: number | string;
    telecaller_id?: number | string;
    previous_status?: string;
    customer_status?: string;
    shopping_category?: string;
    archived_from?: string;
    archived_to?: string;
    wedding_from?: string;
    wedding_to?: string;
    shopping_from?: string;
    shopping_to?: string;
    date_filter?: string;
    limit?: number;
    offset?: number;
    page?: number;
    sort_by?: string;
    sort_order?: string;
  }) {
    const q = params ? new URLSearchParams(cleanQueryParams(params)).toString() : '';
    const res = await apiFetch(`/wedding-crm/old-customers${q ? `?${q}` : ''}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async moveWeddingCustomerToOld(id: number | string, reason?: string) {
    const res = await apiFetch(`/wedding-crm/customers/${id}/archive`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async restoreWeddingOldCustomer(id: number | string) {
    const res = await apiFetch(`/wedding-crm/customers/${id}/restore`, {
      method: 'POST'
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async autoArchiveWeddingCustomers() {
    const res = await apiFetch('/wedding-crm/old-customers/auto-archive', {
      method: 'POST'
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async logWeddingCall(payload: any) {
    const res = await apiFetch('/wedding-crm/log-call', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async updateWeddingCustomerByTelecaller(id: number | string, payload: any) {
    const res = await apiFetch(`/wedding-crm/customers/${id}/telecaller-edit`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getWeddingCustomerTimeline(id: number | string) {
    const res = await apiFetch(`/wedding-crm/customers/${id}/timeline`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getWeddingWhatsAppTemplates(id: number | string) {
    const res = await apiFetch(`/wedding-crm/customers/${id}/whatsapp-templates`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async sendWeddingWhatsAppMessage(id: number | string, payload: { template_type?: string; custom_message?: string; recipient_phone?: string }) {
    const res = await apiFetch(`/wedding-crm/customers/${id}/whatsapp-send`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getWeddingWhatsAppLogs(id: number | string) {
    const res = await apiFetch(`/wedding-crm/customers/${id}/whatsapp-logs`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getWeddingTelecallerPerformance(params?: any) {
    const q = params ? new URLSearchParams(cleanQueryParams(params)).toString() : '';
    const res = await apiFetch(`/wedding-crm/telecaller-performance${q ? `?${q}` : ''}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getWeddingCallingDesk(params?: { queue?: string; location_id?: number | string }) {
    const q = params ? new URLSearchParams(cleanQueryParams(params)).toString() : '';
    const res = await apiFetch(`/wedding-crm/calling-desk${q ? `?${q}` : ''}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getWeddingCalendar(params?: { month?: string; location_id?: number | string }) {
    const q = params ? new URLSearchParams(cleanQueryParams(params)).toString() : '';
    const res = await apiFetch(`/wedding-crm/calendar${q ? `?${q}` : ''}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getWeddingAnalytics(params?: { from_date?: string; to_date?: string; location_id?: number | string }) {
    const q = params ? new URLSearchParams(cleanQueryParams(params)).toString() : '';
    const res = await apiFetch(`/wedding-crm/analytics${q ? `?${q}` : ''}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getWeddingTelecallers(locationId?: number | string) {
    const res = await apiFetch(`/wedding-crm/telecallers${locationId ? `?location_id=${locationId}` : ''}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async assignWeddingTelecaller(customerId: number | string, telecallerId: number | string, telecallerName?: string) {
    const res = await apiFetch(`/wedding-crm/customers/${customerId}`, {
      method: 'PUT',
      body: JSON.stringify({
        assigned_telecaller_id: telecallerId,
        assigned_telecaller: telecallerName
      })
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  // ── Tell Caller: CRM Manager instructions to a telecaller ──
  async sendTelecallerInstruction(customerId: number | string, payload: { telecaller_user_id: number | string; message: string; priority?: string }) {
    const res = await apiFetch(`/wedding-crm/customers/${customerId}/telecaller-instructions`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getTelecallerInstructions(params?: {
    customer_id?: number | string; telecaller_id?: number | string; mine?: number;
    status?: string; dateFrom?: string; dateTo?: string; search?: string; limit?: number; offset?: number;
  }) {
    const q = params ? new URLSearchParams(cleanQueryParams(params as Record<string, unknown>)).toString() : '';
    try {
      const res = await apiFetch(`/wedding-crm/telecaller-instructions${q ? `?${q}` : ''}`);
      return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
    } catch (err: any) {
      if (err?.status === 404 || (err?.message && err.message.includes('Not found'))) {
        try {
          const fallbackRes = await apiFetch(`/telecaller-instructions${q ? `?${q}` : ''}`);
          return (fallbackRes && fallbackRes.data !== undefined) ? { ...fallbackRes, ...fallbackRes.data } : fallbackRes;
        } catch {
          return { success: true, instructions: [], total: 0 };
        }
      }
      throw err;
    }
  },
  async updateTelecallerInstructionStatus(id: number | string, status: 'Seen' | 'Acknowledged' | 'Completed') {
    const res = await apiFetch(`/wedding-crm/telecaller-instructions/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async checkWeddingCustomerDuplicate(payload: { mobile: string; customerId?: number | string }) {
    const res = await apiFetch('/wedding-crm/check-duplicate', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getWeddingRegistrationsByMobile(mobile: string) {
    const res = await apiFetch('/wedding-crm/check-duplicate', {
      method: 'POST',
      body: JSON.stringify({ mobile })
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getWeddingExportData(params?: any) {
    const q = params ? new URLSearchParams(cleanQueryParams(params)).toString() : '';
    const res = await apiFetch(`/wedding-crm/export${q ? `?${q}` : ''}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async importWeddingCustomers(formData: FormData) {
    const res = await apiFetch('/wedding-crm/import-csv', {
      method: 'POST',
      body: formData
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async importWeddingCsv(formData: FormData) {
    return this.importWeddingCustomers(formData);
  },
  async downloadWeddingTemplate(format: 'csv' | 'xlsx' = 'csv') {
    const ext = format === 'xlsx' ? 'xlsx' : 'csv';
    const endpoint = `/wedding-crm/template-${ext}`;
    const apiBase = getApiBase();
    const url = endpoint.startsWith('http') ? endpoint : `${apiBase}${endpoint}`;

    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include'
    });

    if (!res.ok) {
      throw new Error(`Failed to download template (Status ${res.status})`);
    }

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `BSC_Wedding_Customers_Template.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  },

  /**
   * Server-generated .xlsx error report for a failed import run.
   * Every cell is sanitized against spreadsheet formula injection.
   */
  async downloadWeddingErrorReport(payload: {
    fileName: string;
    summary: string;
    counts?: Record<string, number>;
    errors: Array<{ row: number; customerName?: string; mobile?: string; reason: string }>;
  }) {
    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/wedding-crm/import-error-report`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': getCsrfToken() || ''
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      let message = `Failed to generate the error report (Status ${res.status})`;
      try {
        const body = await res.json();
        if (body && body.message) message = body.message;
      } catch (e) { /* non-JSON error body */ }
      throw new Error(message);
    }

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = 'BSC_Wedding_Import_Errors.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  },

  async getWeddingImportLogs(limit = 50) {
    const res = await apiFetch(`/wedding-crm/import-logs?limit=${limit}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  async deleteWeddingImportLog(id: number | string) {
    const res = await apiFetch(`/wedding-crm/import-logs/${id}`, { method: 'DELETE' });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  async clearWeddingImportLogs() {
    const res = await apiFetch('/wedding-crm/import-logs', { method: 'DELETE' });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  // ── Wedding CRM: Google Sheets Integration ───────────────────
  async getGoogleSheetsStatus() {
    const res = await apiFetch('/wedding-crm/google/status');
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getGoogleAuthUrl() {
    const res = await apiFetch('/wedding-crm/google/auth-url');
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async disconnectGoogleAccount() {
    const res = await apiFetch('/wedding-crm/google/disconnect', { method: 'POST' });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async saveGoogleConfig(clientId: string, clientSecret: string) {
    const res = await apiFetch('/wedding-crm/google/config', {
      method: 'POST',
      body: JSON.stringify({ clientId, clientSecret })
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getGoogleSpreadsheets(search?: string) {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    const res = await apiFetch(`/wedding-crm/google/sheets${q}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getGoogleSpreadsheetDetails(spreadsheetId: string) {
    const res = await apiFetch(`/wedding-crm/google/sheets/${encodeURIComponent(spreadsheetId)}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async previewGoogleSheet(spreadsheetId: string, sheetName: string) {
    const q = `?sheetName=${encodeURIComponent(sheetName)}`;
    const res = await apiFetch(`/wedding-crm/google/sheets/${encodeURIComponent(spreadsheetId)}/preview${q}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async importGoogleSheet(payload: { spreadsheetId: string; sheetName: string; locationId: number | string }) {
    const res = await apiFetch('/wedding-crm/google/import', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  // ── Wedding CRM: Enhanced Dashboard ──────────────────────────
  async getWeddingEnhancedDashboard(locationId?: number | string) {
    const q = locationId ? `?location_id=${locationId}` : '';
    const res = await apiFetch(`/wedding-crm/dashboard/enhanced${q}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getWeddingDashboardCharts(locationId?: number | string) {
    const q = locationId ? `?location_id=${locationId}` : '';
    const res = await apiFetch(`/wedding-crm/dashboard/charts${q}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  // ── Wedding CRM: Employee Performance ────────────────────────
  async getWeddingEmployeePerformance(locationId?: number | string) {
    const q = locationId ? `?location_id=${locationId}` : '';
    const res = await apiFetch(`/wedding-crm/employee-performance${q}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  async getWeddingCustomerFlowStream(params?: {
    location_id?: number | string;
    search?: string;
    status?: string;
    priority?: string;
    view?: 'all' | 'calls_only';
    page?: number;
    limit?: number;
  }) {
    const q = params ? new URLSearchParams(cleanQueryParams(params)).toString() : '';
    const res = await apiFetch(`/wedding-crm/flow-stream${q ? `?${q}` : ''}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  // ── Wedding CRM: Pipeline ────────────────────────────────────
  /**
   * Redesigned pipeline workspace feed: active customers with their call,
   * follow-up, feedback, visit and note counts resolved server-side in one
   * query, each row tagged with its stage_key and a per-stage count.
   */
  async getWeddingPipelineBoard(params?: {
    search?: string;
    stage?: string;
    telecaller_id?: number | string;
    priority?: string;
    call_status?: string;
    overdue?: '1';
    due_today?: '1';
    follow_up_from?: string;
    follow_up_to?: string;
    location_id?: number | string;
    limit?: number;
  }) {
    const q = params ? new URLSearchParams(cleanQueryParams(params)).toString() : '';
    const res = await apiFetch(`/wedding-crm/pipeline/board${q ? `?${q}` : ''}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  async getWeddingPipeline(locationId?: number | string) {
    const q = locationId ? `?location_id=${locationId}` : '';
    const res = await apiFetch(`/wedding-crm/pipeline${q}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  // ── Wedding CRM: Upcoming Weddings ───────────────────────────
  async getWeddingUpcoming(days?: number, locationId?: number | string) {
    const params: Record<string, string> = {};
    if (days) params.days = String(days);
    if (locationId) params.location_id = String(locationId);
    const q = new URLSearchParams(cleanQueryParams(params)).toString();
    const res = await apiFetch(`/wedding-crm/upcoming-weddings${q ? `?${q}` : ''}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  // ── Wedding CRM: Advanced Search ─────────────────────────────
  async searchWeddingCustomers(query: string, locationId?: number | string) {
    const params: Record<string, string> = { q: query };
    if (locationId) params.location_id = String(locationId);
    const q = new URLSearchParams(cleanQueryParams(params)).toString();
    const res = await apiFetch(`/wedding-crm/search?${q}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  // ── Wedding CRM: Reports ─────────────────────────────────────
  async getWeddingReports(reportType?: string, locationId?: number | string) {
    const params: Record<string, string> = {};
    if (reportType) params.report_type = reportType;
    if (locationId) params.location_id = String(locationId);
    const q = new URLSearchParams(cleanQueryParams(params)).toString();
    const res = await apiFetch(`/wedding-crm/reports${q ? `?${q}` : ''}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  // ── Wedding CRM: Customer Sources ────────────────────────────
  async getWeddingCustomerSources() {
    const res = await apiFetch('/wedding-crm/sources');
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  // ── Wedding CRM: Full Profile ────────────────────────────────
  async getWeddingFullProfile(id: number | string): Promise<WeddingFullProfileResult> {
    const res = await apiFetch(`/wedding-crm/customers/${id}/full-profile`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  // ── Wedding CRM: Visits ──────────────────────────────────────
  async getWeddingVisits(customerId: number | string) {
    const res = await apiFetch(`/wedding-crm/customers/${customerId}/visits`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async createWeddingVisit(customerId: number | string, payload: any) {
    const res = await apiFetch(`/wedding-crm/customers/${customerId}/visits`, {
      method: 'POST', body: JSON.stringify(payload)
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async updateWeddingVisit(visitId: number | string, payload: any) {
    const res = await apiFetch(`/wedding-crm/visits/${visitId}`, {
      method: 'PUT', body: JSON.stringify(payload)
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  // ── Wedding CRM: Appointments ────────────────────────────────
  async getWeddingAppointments(customerId: number | string) {
    const res = await apiFetch(`/wedding-crm/customers/${customerId}/appointments`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async createWeddingAppointment(customerId: number | string, payload: any) {
    const res = await apiFetch(`/wedding-crm/customers/${customerId}/appointments`, {
      method: 'POST', body: JSON.stringify(payload)
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async updateWeddingAppointment(appointmentId: number | string, payload: any) {
    const res = await apiFetch(`/wedding-crm/appointments/${appointmentId}`, {
      method: 'PUT', body: JSON.stringify(payload)
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  // ── Wedding CRM: Purchases ───────────────────────────────────
  async getWeddingPurchases(customerId: number | string) {
    const res = await apiFetch(`/wedding-crm/customers/${customerId}/purchases`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async createWeddingPurchase(customerId: number | string, payload: any) {
    const res = await apiFetch(`/wedding-crm/customers/${customerId}/purchases`, {
      method: 'POST', body: JSON.stringify(payload)
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async updateWeddingPurchase(purchaseId: number | string, payload: any) {
    const res = await apiFetch(`/wedding-crm/purchases/${purchaseId}`, {
      method: 'PUT', body: JSON.stringify(payload)
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  // ── Wedding CRM: Notes ───────────────────────────────────────
  async getWeddingNotes(customerId: number | string) {
    const res = await apiFetch(`/wedding-crm/customers/${customerId}/notes`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async createWeddingNote(customerId: number | string, payload: any) {
    const res = await apiFetch(`/wedding-crm/customers/${customerId}/notes`, {
      method: 'POST', body: JSON.stringify(payload)
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  // ── Wedding CRM: Communication History ───────────────────────
  async getWeddingCommunications(customerId: number | string) {
    const res = await apiFetch(`/wedding-crm/customers/${customerId}/communications`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async createWeddingCommunication(customerId: number | string, payload: any) {
    const res = await apiFetch(`/wedding-crm/customers/${customerId}/communications`, {
      method: 'POST', body: JSON.stringify(payload)
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  // ── Wedding CRM: Status History ──────────────────────────────
  async getWeddingStatusHistory(customerId: number | string) {
    const res = await apiFetch(`/wedding-crm/customers/${customerId}/status-history`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  // Returns `archived: true` + `lifecycle_status: 'OLD_CUSTOMER'` when newStatus is a
  // completion status; throws 409 (OLD_CUSTOMER_READONLY) when the row is already archived.
  async changeWeddingCustomerStatus(customerId: number | string, newStatus: string, reason?: string): Promise<WeddingArchiveResult> {
    const res = await apiFetch(`/wedding-crm/customers/${customerId}/status`, {
      method: 'PUT', body: JSON.stringify({ new_status: newStatus, change_reason: reason })
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  // ── Wedding CRM: Documents ───────────────────────────────────
  async getWeddingDocuments(customerId: number | string) {
    const res = await apiFetch(`/wedding-crm/customers/${customerId}/documents`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  // ── Wedding CRM: Merge ───────────────────────────────────────
  async mergeWeddingCustomers(primaryId: number | string, duplicateId: number | string) {
    const res = await apiFetch('/wedding-crm/customers/merge', {
      method: 'POST', body: JSON.stringify({ primary_id: primaryId, duplicate_id: duplicateId })
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  // ── Wedding CRM: Bulk Operations ─────────────────────────────
  async weddingBulkUpdateStatus(customerIds: number[], newStatus: string) {
    const res = await apiFetch('/wedding-crm/bulk/status', {
      method: 'POST', body: JSON.stringify({ customer_ids: customerIds, new_status: newStatus })
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async weddingBulkAssign(customerIds: number[], telecaller: string, telecallerId?: number) {
    const res = await apiFetch('/wedding-crm/bulk/assign', {
      method: 'POST', body: JSON.stringify({ customer_ids: customerIds, assigned_telecaller: telecaller, assigned_telecaller_id: telecallerId })
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  // ── Telecaller Dashboard ─────────────────────────────────────
  async getTelecallerDashboardStats(locationId?: number | string) {
    const q = locationId ? `?location_id=${locationId}` : '';
    const res = await apiFetch(`/telecaller-dashboard/stats${q}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getTelecallerFollowUpPipeline(locationId?: number | string) {
    const q = locationId ? `?location_id=${locationId}` : '';
    const res = await apiFetch(`/telecaller-dashboard/pipeline${q}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getTelecallerCallHistory(params?: { limit?: number; offset?: number; date?: string; location_id?: number | string }) {
    const q = params ? new URLSearchParams(cleanQueryParams(params)).toString() : '';
    const res = await apiFetch(`/telecaller-dashboard/call-history${q ? `?${q}` : ''}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getTelecallerPerformance(params?: { period?: string; location_id?: number | string }) {
    const q = params ? new URLSearchParams(cleanQueryParams(params)).toString() : '';
    const res = await apiFetch(`/telecaller-dashboard/performance${q ? `?${q}` : ''}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getTelecallerCustomerDetail(customerId: number | string) {
    const res = await apiFetch(`/telecaller-dashboard/customers/${customerId}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getTelecallerRecentCustomers(limit?: number) {
    const q = limit ? `?limit=${limit}` : '';
    const res = await apiFetch(`/telecaller-dashboard/recent-customers${q}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  // ── Wedding CRM: Extended Calendar ───────────────────────────
  async getWeddingExtendedCalendar(year: number, month: number, locationId?: number | string) {
    const params: Record<string, string> = { year: String(year), month: String(month) };
    if (locationId) params.location_id = String(locationId);
    const q = new URLSearchParams(cleanQueryParams(params)).toString();
    const res = await apiFetch(`/wedding-crm/calendar/extended?${q}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  // ── Wedding Registration (Public Portal) ──────────────────────
  async createWeddingRegistration(payload: any) {
    const res = await apiFetch('/wedding-registration/public/wedding-registration', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async checkWeddingRegistrationDuplicate(phone: string) {
    const res = await apiFetch('/wedding-registration/public/wedding-registration/check-duplicate', {
      method: 'POST',
      body: JSON.stringify({ phone })
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getNextWeddingRegId(locationId: number | string) {
    const res = await apiFetch(`/wedding-registration/public/wedding-registration/next-id?location_id=${locationId}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async trackWeddingRegistration(registration_id: string, mobile: string) {
    const res = await apiFetch('/wedding-registration/public/wedding-registration/track', {
      method: 'POST',
      body: JSON.stringify({ registration_id, mobile })
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  // ── Wedding Registration (Admin) ─────────────────────────────
  async getWeddingRegistrationStats(locationId?: number | string) {
    const res = await apiFetch(`/wedding-registration/wedding-registrations/stats${locationId ? `?location_id=${locationId}` : ''}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getWeddingRegistrations(params?: {
    status?: string;
    locationId?: number | string;
    search?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }) {
    const q = params ? new URLSearchParams(cleanQueryParams(params)).toString() : '';
    const res = await apiFetch(`/wedding-registration/wedding-registrations${q ? `?${q}` : ''}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getWeddingRegistrationById(id: number | string) {
    const res = await apiFetch(`/wedding-registration/wedding-registrations/${id}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async updateWeddingRegistration(id: number | string, payload: any) {
    const res = await apiFetch(`/wedding-registration/wedding-registrations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async resendWeddingRegistrationEmail(id: number | string) {
    const res = await apiFetch(`/wedding-registration/wedding-registrations/${id}/resend-email`, {
      method: 'POST'
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async deleteWeddingRegistration(id: number | string) {
    const res = await apiFetch(`/wedding-registration/wedding-registrations/${id}`, {
      method: 'DELETE'
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async exportWeddingRegistrations(params?: any) {
    const q = params ? new URLSearchParams(cleanQueryParams(params)).toString() : '';
    const res = await apiFetch(`/wedding-registration/wedding-registrations/export${q ? `?${q}` : ''}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  // ── Feedback QR Code Module ─────────────────────────────────────
  async getQrCodes(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    locationId?: number | string;
    floor?: string;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const q = params ? new URLSearchParams(cleanQueryParams(params)).toString() : '';
    const res = await apiFetch(`/feedback-qr${q ? `?${q}` : ''}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  async getQrCodeStats(params?: { status?: string; locationId?: string; floor?: string }) {
    const q = params ? new URLSearchParams(cleanQueryParams(params)).toString() : '';
    const res = await apiFetch(`/feedback-qr/stats${q ? `?${q}` : ''}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  async getQrCodeById(id: string | number) {
    const res = await apiFetch(`/feedback-qr/${id}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  async createQrCode(data: {
    name: string;
    description?: string;
    locationId: number | string;
    locationCode: string;
    locationName: string;
    sectionId?: string;
    sectionName?: string;
    feedbackFormId?: string;
    status?: 'active' | 'inactive' | 'archived';
  }) {
    const res = await apiFetch('/feedback-qr', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  async updateQrCode(id: string | number, data: {
    name?: string;
    description?: string;
    locationId?: number | string;
    locationCode?: string;
    locationName?: string;
    sectionId?: string;
    sectionName?: string;
    floor?: string;
    feedbackFormId?: string;
    status?: 'active' | 'inactive' | 'archived';
  }) {
    const res = await apiFetch(`/feedback-qr/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  async deleteQrCode(id: string | number) {
    const res = await apiFetch(`/feedback-qr/${id}`, {
      method: 'DELETE'
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  async toggleQrCodeStatus(id: string | number) {
    const res = await apiFetch(`/feedback-qr/${id}/toggle-status`, {
      method: 'POST'
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  async regenerateQrCode(id: string | number) {
    const res = await apiFetch(`/feedback-qr/${id}/regenerate`, {
      method: 'POST'
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

async getQrCodeScans(qrCodeId: string, params?: { page?: number; limit?: number; date?: string }) {
    const q = params ? new URLSearchParams(cleanQueryParams(params)).toString() : '';
    const res = await apiFetch(`/feedback-qr/${qrCodeId}/scans${q ? `?${q}` : ''}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  async getLocationsForQr() {
    const res = await apiFetch('/feedback-qr/locations');
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  async getLocationQrCodes(locationId?: number | string) {
    const q = locationId ? `?locationId=${encodeURIComponent(String(locationId))}` : '';
    return await apiFetch(`/feedback-qr/location-codes${q}`);
  },

  async generateLocationQrCodes(locationId?: number | string) {
    const q = locationId ? `?locationId=${encodeURIComponent(String(locationId))}` : '';
    return await apiFetch(`/feedback-qr/generate-locations${q}`, {
      method: 'POST'
    });
  },

  async getSectionsForQr(locationId?: number | string) {
    const q = locationId ? new URLSearchParams({ locationId: String(locationId) }).toString() : '';
    const res = await apiFetch(`/feedback-qr/sections${q ? `?${q}` : ''}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  async getFeedbackForms() {
    const res = await apiFetch('/feedback-qr/forms');
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  async exportQrCodes(params?: { format?: string; status?: string; locationId?: number | string; floor?: string }) {
    const q = params ? new URLSearchParams(cleanQueryParams(params)).toString() : '';
    const res = await apiFetch(`/feedback-qr/export${q ? `?${q}` : ''}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  // Track QR scan (public endpoint) - location based
  async trackQrScanByLocation(locationCode: string, source?: string) {
    const res = await apiFetch(`/feedback-qr/scan/location/${locationCode}`, {
      method: 'POST',
      body: JSON.stringify({ source })
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  // Track QR scan (public endpoint) - legacy qrCodeId based
  async trackQrScan(qrCodeId: string, source?: string) {
    const res = await apiFetch(`/feedback-qr/scan/${qrCodeId}`, {
      method: 'POST',
      body: JSON.stringify({ source })
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  // Employee Audit
  async getEmployeeAudit(employeeId: number | string) {
    const res = await apiFetch(`/employees/${employeeId}/audit`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  // Employee Directory Export
  async exportEmployeeDirectory() {
    return apiFetch('/directory/export');
  },

  // Employee Bulk Import (CSV & Excel)
  async bulkImportEmployees(employees: any[]) {
    return apiFetch('/employees/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ employees })
    });
  },

  // ── Workflow & Approval Module ─────────────────────────────────────
  };

