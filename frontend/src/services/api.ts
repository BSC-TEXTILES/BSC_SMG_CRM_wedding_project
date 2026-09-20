/**
 * BSC Enterprise HRMS API Client Service
 */

const getApiBase = () => {
  return '/api';
};

export interface UserSession {
  id?: number | string;
  username: string;
  role: 'HR' | 'Manager' | 'Admin' | 'Super Admin' | string;
  fullName: string;
  displayName: string;
  name?: string;
  employeeId?: string | number;
  token?: string;
  // ── Multi-Location Fields ──
  locationId?: number | null;     // null = Global Admin (all locations)
  locationCode?: string | null;   // 'BEL' | 'DAV' | 'SHI'
  locationName?: string | null;   // 'Belagavi' | 'Davanagere' | 'Shivamogga'
  allowedLocations?: number[];    // array of location IDs user can access
  isGlobalAdmin?: boolean;        // true if locationId is null
}

export const Auth = {
  save(session: UserSession) {
    try {
      localStorage.setItem('bsc_crm_session', JSON.stringify({
        ...session,
        loginAt: Date.now()
      }));
      
      // Track login in user tracking system
      const ipAddress = typeof window !== 'undefined' ? (window as any).ipAddress : undefined;
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : undefined;
      API.trackUserLogin(
        session.id,
        session.username,
        ipAddress,
        userAgent,
        session.locationId,
        session.locationName
      ).catch(() => {}); // Don't block login on tracking failure
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
    if (!session || !session.token) {
      this.clear();
      return false;
    }
    // Absolute session lifetime: 6 hours. Users who never sign out are
    // logged out automatically (matches the server token + cookie max-age).
    const SESSION_MS = parseInt(String(6 * 60 * 60 * 1000), 10);
    if (Date.now() - session.loginAt > SESSION_MS) {
      this.clear();
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
    return session?.isGlobalAdmin === true || session?.locationId === null || session?.locationId === undefined;
  },

  clear() {
    try {
      localStorage.removeItem('bsc_crm_session');
    } catch (e) {}
  },

  logout() {
    // Best-effort server notification so the sign-out is recorded in the
    // admin's login-activity trail. Never blocks the redirect.
    try {
      const session = this.get();
      if (session && session.token) {
        // Track logout
        API.trackUserLogout(session.id, session.username).catch(() => {});
        
        // Call the backend logout
        fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.token}`,
            'x-auth-token': session.token
          },
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

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const session = Auth.get();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>)
  };

  if (session && session.token) {
    headers['Authorization'] = `Bearer ${session.token}`;
    headers['x-auth-token'] = session.token; // Fallback for Hostinger Apache stripping Authorization header
  }

  // CSRF Protection
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(/(?:^|; )_csrf=([^;]*)/);
    if (match) {
      headers['x-csrf-token'] = match[1];
    }
  }

  // Dynamic multi-location header injection
  const activeLoc = typeof localStorage !== 'undefined' ? localStorage.getItem('bsc_selected_location') : null;
  if (activeLoc && activeLoc !== 'ALL') {
    headers['X-Location-Id'] = activeLoc;
  } else if (session && session.locationId) {
    headers['X-Location-Id'] = String(session.locationId);
  }

  const apiBase = getApiBase();
  const url = endpoint.startsWith('http') ? endpoint : `${apiBase}${endpoint}`;

  try {
    const res = await fetch(url, {
      ...options,
      headers
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      // Provide user-friendly error messages based on status code
      let errorMessage = errorData.message;
      if (!errorMessage) {
        switch (res.status) {
          case 401:
            errorMessage = 'Authentication failed. Please check your credentials.';
            break;
          case 403:
            errorMessage = 'Access denied. You do not have permission to perform this action.';
            break;
          case 404:
            errorMessage = 'The requested resource was not found. Please contact your administrator.';
            break;
          case 423:
            errorMessage = 'Account temporarily locked due to too many failed attempts. Please try again later.';
            break;
          case 429:
            errorMessage = 'Too many requests. Please wait and try again.';
            break;
          case 500:
          case 503:
            errorMessage = 'Server error. Please try again or contact your administrator.';
            break;
          default:
            errorMessage = `Request failed. Please try again. (Error: ${res.status})`;
        }
      }
      const error: any = new Error(errorMessage);
      error.status = res.status; // Lets callers distinguish 400/404/429/500 failures
      error.errors = errorData.errors || [];
      throw error;
    }
    return await res.json();
  } catch (err: any) {
    console.warn(`[API Fetch Error: ${endpoint}]`, err.message);
    // If the error is a network error (not an API response error), provide a user-friendly message
    if (!err.status) {
      const networkError: any = new Error('Network error. Please check your internet connection and try again.');
      networkError.status = 0;
      networkError.errors = [];
      throw networkError;
    }
    throw err;
  }
};

// Legacy Apps Script API Action Dispatcher Wrapper for 100% compatibility
export const API = {
  fileUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    return url.startsWith('http') ? url : `http://localhost:5000${url.startsWith('/') ? '' : '/'}${url}`;
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
  async verifyUser(username: string, password: string, captchaId?: string, captchaText?: string) {
    return apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, captchaId, captchaText })
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

  // Developer Tools Detection Security Shield
  async getShieldStatus() {
    return apiFetch('/security/shield-status');
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

  // User Tracking
  async trackUserLogin(userId: string | number, username: string, ipAddress?: string, userAgent?: string, locationId?: number | null, locationName?: string | null) {
    return apiFetch('/user-tracking/login', {
      method: 'POST',
      body: JSON.stringify({ userId, username, ipAddress, userAgent, locationId, locationName })
    });
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
    if (session && session.token) {
      headers['Authorization'] = `Bearer ${session.token}`;
      headers['x-auth-token'] = session.token;
    }
    if (candName) {
      headers['x-candidate-name'] = encodeURIComponent(candName);
    }
    if (appNo) {
      headers['x-app-no'] = appNo;
    }
    const apiBase = getApiBase();
    const url = `${apiBase}/candidates/upload-documents`;
    const res = await fetch(url, { method: 'POST', headers, body: formData });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  },
  async getCandidates(filters: any = {}) {
    const query = new URLSearchParams(filters).toString();
    return apiFetch(`/candidates?${query}`);
  },
  async getEmployees() {
    return apiFetch('/employees');
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
    const payload = typeof identifier === 'object' ? identifier : (!isNaN(Number(identifier)) ? { id: identifier } : { username: identifier });
    return apiFetch('/settings/users/delete', { method: 'POST', body: JSON.stringify(payload) });
  },
  async getPageSettings() { 
    return await apiFetch('/settings/page-visibility'); 
  },
  async savePageSettings(settings: any) { return apiFetch('/settings/page-visibility', { method: 'POST', body: JSON.stringify({ settings }) }); },
  async getRoles() { return apiFetch('/settings/roles'); },
  async getDesignations() { return apiFetch('/settings/designations'); },
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
  async getAdminUserPermissions(id: number | string) {
    const res = await apiFetch(`/admin/users/${id}/permissions`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async updateAdminUserPermissions(id: number | string, permissions: any[]) { return apiFetch(`/admin/users/${id}/permissions`, { method: 'PUT', body: JSON.stringify({ permissions }) }); },
  async toggleAdminUserStatus(id: number | string) {
    const res = await apiFetch(`/admin/users/${id}/toggle-status`, { method: 'POST' });
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
  async verifyPin(payload: { type: string; pin: string }) { return apiFetch('/crm/verify-pin', { method: 'POST', body: JSON.stringify(payload) }); },
  async getSections() { return apiFetch('/crm/sections'); },
  async getFootfall(date?: string) { return apiFetch(`/crm/footfall${date ? `?date=${date}` : ''}`); },
  async upsertFootfall(payload: any) { return apiFetch('/crm/footfall/upsert', { method: 'POST', body: JSON.stringify(payload) }); },
  async getFeedbackQuestions() { return apiFetch('/crm/feedback-questions'); },
  async getFeedbackStats() { return apiFetch('/crm/feedback-stats'); },
  async getFeedbacks(params?: { date?: string; startDate?: string; endDate?: string; isNegative?: string; search?: string }) {
    const q = new URLSearchParams(params as any).toString();
    return apiFetch(`/crm/feedbacks${q ? `?${q}` : ''}`);
  },
  async submitFeedback(payload: any) { return apiFetch('/crm/feedback', { method: 'POST', body: JSON.stringify(payload) }); },
  async getCallQueue(params?: { date?: string; startDate?: string; endDate?: string; status?: string; search?: string }) {
    const q = new URLSearchParams(params as any).toString();
    return apiFetch(`/crm/call-queue${q ? `?${q}` : ''}`);
  },
  async updateCallQueue(payload: any) { return apiFetch('/crm/call-queue/update', { method: 'POST', body: JSON.stringify(payload) }); },
  async getDiverts() { return apiFetch('/crm/diverts'); },
  async createDivert(payload: any) { return apiFetch('/crm/diverts/create', { method: 'POST', body: JSON.stringify(payload) }); },
  async updateDivert(payload: any) { return apiFetch('/crm/diverts/update', { method: 'POST', body: JSON.stringify(payload) }); },
  async getDivertUpdates(divertId: string) { return apiFetch(`/crm/diverts/updates?divertId=${divertId}`); },
  async getCashSettlement(date?: string) { return apiFetch(`/cash${date ? `?date=${date}` : ''}`); },
  async saveCashSettlement(payload: any) { return apiFetch('/cash/save', { method: 'POST', body: JSON.stringify(payload) }); },
  async getVmPoints() { return apiFetch('/vm/points'); },
  async getVmSubmissions() { return apiFetch('/vm/submissions'); },
  async submitVm(payload: any) { return apiFetch('/vm/submit', { method: 'POST', body: JSON.stringify(payload) }); },
  async getVmFloors() { return apiFetch('/vm/floors'); },
  async createVmFloor(payload: any) { return apiFetch('/vm/floors', { method: 'POST', body: JSON.stringify(payload) }); },
  async deleteVmFloor(payload: any) { return apiFetch('/vm/floors/delete', { method: 'POST', body: JSON.stringify(typeof payload === 'object' ? payload : { id: payload }) }); },

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
    if (session && session.token) {
      headers['Authorization'] = `Bearer ${session.token}`;
      headers['x-auth-token'] = session.token;
    }
    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/mcheck/upload-photo`, { method: 'POST', headers, body: formData });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  },
  async getMCheckAdminStructure() { return apiFetch('/mcheck/admin/structure'); },
  async saveMCheckAdminModule(payload: any) { return apiFetch('/mcheck/admin/module', { method: 'POST', body: JSON.stringify(payload) }); },
  async saveMCheckAdminCheckpoint(payload: any) { return apiFetch('/mcheck/admin/checkpoint', { method: 'POST', body: JSON.stringify(payload) }); },
  async reorderMCheckCheckpoints(order: any[]) { return apiFetch('/mcheck/admin/reorder', { method: 'POST', body: JSON.stringify({ order }) }); },
  getMCheckExportUrl(type: 'pdf' | 'excel', params?: { date?: string; fromDate?: string; toDate?: string; module_id?: string; status?: string }) {
    const apiBase = getApiBase();
    const q = params ? new URLSearchParams(params as any).toString() : '';
    return `${apiBase}/mcheck/export/${type === 'pdf' ? 'pdf' : 'excel'}${q ? `?${q}` : ''}`;
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
      const list = extractList(res);
      if (list.length > 0) {
        return { success: true, locations: list, data: list };
      }
      // Fallback if empty
      const fb = await apiFetch('/locations');
      const fbList = extractList(fb);
      return { success: true, locations: fbList, data: fbList };
    } catch (err) {
      console.warn('[API.getPublicLocations] /landing/locations failed, trying /locations:', err);
      try {
        const fb = await apiFetch('/locations');
        const fbList = extractList(fb);
        return { success: true, locations: fbList, data: fbList };
      } catch (e2) {
        throw err;
      }
    }
  },
  // Authenticated endpoint for admin/staff pages
  async getLocations() {
    const res = await apiFetch('/locations');
    const list = Array.isArray(res) ? res : (Array.isArray(res?.locations) ? res.locations : (Array.isArray(res?.data) ? res.data : []));
    return { success: true, locations: list, data: list };
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
  async updateWeddingCustomer(id: number | string, payload: any) {
    const res = await apiFetch(`/wedding-crm/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async deleteWeddingCustomer(id: number | string) {
    const res = await apiFetch(`/wedding-crm/customers/${id}`, {
      method: 'DELETE'
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
  async getWeddingExportData(params?: any) {
    const q = params ? new URLSearchParams(cleanQueryParams(params)).toString() : '';
    const res = await apiFetch(`/wedding-crm/export${q ? `?${q}` : ''}`);
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

  // ── Wedding CRM: Pipeline ────────────────────────────────────
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
  async getWeddingFullProfile(id: number | string) {
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
  async changeWeddingCustomerStatus(customerId: number | string, newStatus: string, reason?: string) {
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
    sortBy?: string;
    sortOrder?: string;
  }) {
    const q = params ? new URLSearchParams(cleanQueryParams(params)).toString() : '';
    const res = await apiFetch(`/feedback-qr${q ? `?${q}` : ''}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  async getQrCodeStats(params?: { status?: string; locationId?: string }) {
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
    sectionId?: string;
    sectionName?: string;
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

  async getSectionsForQr(locationId?: number | string) {
    const q = locationId ? new URLSearchParams({ locationId: String(locationId) }).toString() : '';
    const res = await apiFetch(`/feedback-qr/sections${q ? `?${q}` : ''}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  async getFeedbackForms() {
    const res = await apiFetch('/feedback-qr/forms');
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  async exportQrCodes(params?: { format?: string; status?: string; locationId?: number | string }) {
    const q = params ? new URLSearchParams(cleanQueryParams(params)).toString() : '';
    const res = await apiFetch(`/feedback-qr/export${q ? `?${q}` : ''}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  // Track QR scan (public endpoint)
  async trackQrScan(qrCodeId: string, source?: string) {
    const res = await apiFetch(`/feedback-qr/scan/${qrCodeId}`, {
      method: 'POST',
      body: JSON.stringify({ source })
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  // ── Workflow & Approval Module ─────────────────────────────────────
  };

