/**
 * Centralized Query Keys for React Query
 * 
 * All query keys are defined here to ensure consistency and enable
 * precise cache invalidation across the application.
 * 
 * Structure: [entity, action, ...params]
 * Example: ['employees', 'list', { locationId: 1 }]
 */

export const queryKeys = {
  // Authentication & Session
  auth: {
    session: ['auth', 'session'] as const,
    permissions: ['auth', 'permissions'] as const,
    myPermissions: ['auth', 'my-permissions'] as const,
    pageSettings: ['auth', 'page-settings'] as const,
  },

  // Employees / Candidates
  employees: {
    all: ['employees'] as const,
    lists: () => [...queryKeys.employees.all, 'list'] as const,
    list: (params: Record<string, any> = {}) => [...queryKeys.employees.lists(), params] as const,
    details: () => [...queryKeys.employees.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.employees.details(), id] as const,
    profile: (id: string | number) => [...queryKeys.employees.detail(id), 'profile'] as const,
    documents: (id: string | number) => [...queryKeys.employees.detail(id), 'documents'] as const,
    audit: (id: string | number) => [...queryKeys.employees.detail(id), 'audit'] as const,
    photo: (id: string | number) => [...queryKeys.employees.detail(id), 'photo'] as const,
  },

  // Wedding CRM
  wedding: {
    all: ['wedding'] as const,
    stats: (locationId?: number | string) => [...queryKeys.wedding.all, 'stats', locationId] as const,
    customers: {
      all: ['wedding', 'customers'] as const,
      lists: () => [...queryKeys.wedding.customers.all, 'list'] as const,
      list: (params: Record<string, any> = {}) => [...queryKeys.wedding.customers.lists(), params] as const,
      details: () => [...queryKeys.wedding.customers.all, 'detail'] as const,
      detail: (id: string | number) => [...queryKeys.wedding.customers.details(), id] as const,
      fullProfile: (id: string | number) => [...queryKeys.wedding.customers.detail(id), 'full-profile'] as const,
      visits: (customerId: string | number) => [...queryKeys.wedding.customers.detail(customerId), 'visits'] as const,
      appointments: (customerId: string | number) => [...queryKeys.wedding.customers.detail(customerId), 'appointments'] as const,
      purchases: (customerId: string | number) => [...queryKeys.wedding.customers.detail(customerId), 'purchases'] as const,
      notes: (customerId: string | number) => [...queryKeys.wedding.customers.detail(customerId), 'notes'] as const,
      communications: (customerId: string | number) => [...queryKeys.wedding.customers.detail(customerId), 'communications'] as const,
      statusHistory: (customerId: string | number) => [...queryKeys.wedding.customers.detail(customerId), 'status-history'] as const,
      documents: (customerId: string | number) => [...queryKeys.wedding.customers.detail(customerId), 'documents'] as const,
    },
    telecallers: (locationId?: number | string) => [...queryKeys.wedding.all, 'telecallers', locationId] as const,
    callingDesk: (params: Record<string, any> = {}) => [...queryKeys.wedding.all, 'calling-desk', params] as const,
    calendar: (params: Record<string, any> = {}) => [...queryKeys.wedding.all, 'calendar', params] as const,
    analytics: (params: Record<string, any> = {}) => [...queryKeys.wedding.all, 'analytics', params] as const,
    pipeline: (locationId?: number | string) => [...queryKeys.wedding.all, 'pipeline', locationId] as const,
    upcoming: (params: Record<string, any> = {}) => [...queryKeys.wedding.all, 'upcoming', params] as const,
    search: (query: string, locationId?: number | string) => [...queryKeys.wedding.all, 'search', query, locationId] as const,
    reports: (params: Record<string, any> = {}) => [...queryKeys.wedding.all, 'reports', params] as const,
    sources: () => [...queryKeys.wedding.all, 'sources'] as const,
    employeePerformance: (locationId?: number | string) => [...queryKeys.wedding.all, 'employee-performance', locationId] as const,
    enhancedDashboard: (locationId?: number | string) => [...queryKeys.wedding.all, 'enhanced-dashboard', locationId] as const,
    charts: (locationId?: number | string) => [...queryKeys.wedding.all, 'charts', locationId] as const,
    importLogs: (limit?: number) => [...queryKeys.wedding.all, 'import-logs', limit] as const,
  },

  // User Management
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (params: Record<string, any> = {}) => [...queryKeys.users.lists(), params] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.users.details(), id] as const,
    permissions: (id: string | number) => [...queryKeys.users.detail(id), 'permissions'] as const,
    modules: () => [...queryKeys.users.all, 'modules'] as const,
  },

  // Admin Users
  adminUsers: {
    all: ['admin-users'] as const,
    lists: () => [...queryKeys.adminUsers.all, 'list'] as const,
    list: (params: Record<string, any> = {}) => [...queryKeys.adminUsers.lists(), params] as const,
    details: () => [...queryKeys.adminUsers.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.adminUsers.details(), id] as const,
    permissions: (id: string | number) => [...queryKeys.adminUsers.detail(id), 'permissions'] as const,
    modules: () => [...queryKeys.adminUsers.all, 'modules'] as const,
  },

  // Candidates
  candidates: {
    all: ['candidates'] as const,
    lists: () => [...queryKeys.candidates.all, 'list'] as const,
    list: (params: Record<string, any> = {}) => [...queryKeys.candidates.lists(), params] as const,
    details: () => [...queryKeys.candidates.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.candidates.details(), id] as const,
    activity: (params: Record<string, any> = {}) => [...queryKeys.candidates.all, 'activity', params] as const,
    kpis: (params: Record<string, any> = {}) => [...queryKeys.candidates.all, 'kpis', params] as const,
    pendingActions: () => [...queryKeys.candidates.all, 'pending-actions'] as const,
    sourceBreakdown: () => [...queryKeys.candidates.all, 'source-breakdown'] as const,
  },

  // Interviews
  interviews: {
    all: ['interviews'] as const,
    lists: () => [...queryKeys.interviews.all, 'list'] as const,
    list: (params: Record<string, any> = {}) => [...queryKeys.interviews.lists(), params] as const,
    questions: (params: Record<string, any> = {}) => [...queryKeys.interviews.all, 'questions', params] as const,
    callStatus: (appNo: string) => [...queryKeys.interviews.all, 'call-status', appNo] as const,
    selected: () => [...queryKeys.interviews.all, 'selected'] as const,
    rejected: () => [...queryKeys.interviews.all, 'rejected'] as const,
  },

  // Offers
  offers: {
    all: ['offers'] as const,
    lists: () => [...queryKeys.offers.all, 'list'] as const,
    list: (params: Record<string, any> = {}) => [...queryKeys.offers.lists(), params] as const,
  },

  // Department Hiring & Section Allocation
  deptHiring: {
    all: ['dept-hiring'] as const,
    targets: () => [...queryKeys.deptHiring.all, 'targets'] as const,
    target: (params: Record<string, any> = {}) => [...queryKeys.deptHiring.targets(), params] as const,
    sections: () => [...queryKeys.deptHiring.all, 'sections'] as const,
    sectionAllocations: () => [...queryKeys.deptHiring.all, 'section-allocations'] as const,
  },

  // CRM Store Operations
  crm: {
    all: ['crm'] as const,
    settings: () => [...queryKeys.crm.all, 'settings'] as const,
    sections: () => [...queryKeys.crm.all, 'sections'] as const,
    footfall: (params: Record<string, any> = {}) => [...queryKeys.crm.all, 'footfall', params] as const,
    feedbackQuestions: () => [...queryKeys.crm.all, 'feedback-questions'] as const,
    feedbackStats: (params: Record<string, any> = {}) => [...queryKeys.crm.all, 'feedback-stats', params] as const,
    feedbacks: (params: Record<string, any> = {}) => [...queryKeys.crm.all, 'feedbacks', params] as const,
    callQueue: (params: Record<string, any> = {}) => [...queryKeys.crm.all, 'call-queue', params] as const,
    diverts: (params: Record<string, any> = {}) => [...queryKeys.crm.all, 'diverts', params] as const,
    divertUpdates: (divertId: string) => [...queryKeys.crm.all, 'divert-updates', divertId] as const,
    cashSettlement: (date?: string) => [...queryKeys.crm.all, 'cash', date] as const,
    vmPoints: () => [...queryKeys.crm.all, 'vm-points'] as const,
    vmSubmissions: () => [...queryKeys.crm.all, 'vm-submissions'] as const,
    vmFloors: () => [...queryKeys.crm.all, 'vm-floors'] as const,
    vmPhotos: (params: Record<string, any> = {}) => [...queryKeys.crm.all, 'vm-photos', params] as const,
  },

  // MCheck
  mcheck: {
    all: ['mcheck'] as const,
    modules: () => [...queryKeys.mcheck.all, 'modules'] as const,
    dashboard: (date?: string) => [...queryKeys.mcheck.all, 'dashboard', date] as const,
    moduleDetail: (moduleId: number | string, date?: string) => [...queryKeys.mcheck.all, 'module-detail', moduleId, date] as const,
    reports: (params: Record<string, any> = {}) => [...queryKeys.mcheck.all, 'reports', params] as const,
    history: (params: Record<string, any> = {}) => [...queryKeys.mcheck.all, 'history', params] as const,
    trend: (days?: number) => [...queryKeys.mcheck.all, 'trend', days] as const,
    auditLog: (checkpointId: number | string, responseDate?: string) => [...queryKeys.mcheck.all, 'audit', checkpointId, responseDate] as const,
    adminStructure: () => [...queryKeys.mcheck.all, 'admin-structure'] as const,
  },

  // Broadcasts
  broadcasts: {
    all: ['broadcasts'] as const,
    lists: () => [...queryKeys.broadcasts.all, 'list'] as const,
    list: (params: Record<string, any> = {}) => [...queryKeys.broadcasts.lists(), params] as const,
  },

  // Feedback QR
  feedbackQr: {
    all: ['feedback-qr'] as const,
    lists: () => [...queryKeys.feedbackQr.all, 'list'] as const,
    list: (params: Record<string, any> = {}) => [...queryKeys.feedbackQr.lists(), params] as const,
    stats: (params: Record<string, any> = {}) => [...queryKeys.feedbackQr.all, 'stats', params] as const,
    locations: (params: Record<string, any> = {}) => [...queryKeys.feedbackQr.all, 'locations', params] as const,
    sections: (params: Record<string, any> = {}) => [...queryKeys.feedbackQr.all, 'sections', params] as const,
    forms: () => [...queryKeys.feedbackQr.all, 'forms'] as const,
    detail: (id: number | string) => [...queryKeys.feedbackQr.all, 'detail', id] as const,
    scans: (qrCodeId: string) => [...queryKeys.feedbackQr.all, 'scans', qrCodeId] as const,
  },

  // Locations
  locations: {
    all: ['locations'] as const,
    lists: () => [...queryKeys.locations.all, 'list'] as const,
    list: (params: Record<string, any> = {}) => [...queryKeys.locations.lists(), params] as const,
    detail: (id: number | string) => [...queryKeys.locations.all, 'detail', id] as const,
    public: () => [...queryKeys.locations.all, 'public'] as const,
    globalStats: () => [...queryKeys.locations.all, 'global-stats'] as const,
  },

  // Telecaller Dashboard
  telecaller: {
    all: ['telecaller'] as const,
    stats: (locationId?: number | string) => [...queryKeys.telecaller.all, 'stats', locationId] as const,
    pipeline: (locationId?: number | string) => [...queryKeys.telecaller.all, 'pipeline', locationId] as const,
  },

  // Feedback Collection
  feedback: {
    all: ['feedback'] as const,
    lists: () => [...queryKeys.feedback.all, 'list'] as const,
    list: (params: Record<string, any> = {}) => [...queryKeys.feedback.lists(), params] as const,
  },

  // Divert
  divert: {
    all: ['divert'] as const,
    lists: () => [...queryKeys.divert.all, 'list'] as const,
    list: (params: Record<string, any> = {}) => [...queryKeys.divert.lists(), params] as const,
  },

  // Attendance
  attendance: {
    all: ['attendance'] as const,
    lists: () => [...queryKeys.attendance.all, 'list'] as const,
    list: (params: Record<string, any> = {}) => [...queryKeys.attendance.lists(), params] as const,
  },

  // Batch Plan
  batchPlan: {
    all: ['batch-plan'] as const,
    lists: () => [...queryKeys.batchPlan.all, 'list'] as const,
    list: (params: Record<string, any> = {}) => [...queryKeys.batchPlan.lists(), params] as const,
  },

  // DOJ Desk
  dojDesk: {
    all: ['doj-desk'] as const,
    lists: () => [...queryKeys.dojDesk.all, 'list'] as const,
    list: (params: Record<string, any> = {}) => [...queryKeys.dojDesk.lists(), params] as const,
  },

  // Settings
  settings: {
    all: ['settings'] as const,
    users: () => [...queryKeys.settings.all, 'users'] as const,
    roles: () => [...queryKeys.settings.all, 'roles'] as const,
    designations: () => [...queryKeys.settings.all, 'designations'] as const,
    pageVisibility: () => [...queryKeys.settings.all, 'page-visibility'] as const,
  },

  // Security
  security: {
    all: ['security'] as const,
    systemLogs: (params: Record<string, any> = {}) => [...queryKeys.security.all, 'system-logs', params] as const,
    liveActivity: (limit?: number) => [...queryKeys.security.all, 'live-activity', limit] as const,
    dashboardStats: () => [...queryKeys.security.all, 'dashboard-stats'] as const,
    activeSessions: () => [...queryKeys.security.all, 'active-sessions'] as const,
    auditLogs: (params: Record<string, any> = {}) => [...queryKeys.security.all, 'audit-logs', params] as const,
    shieldStatus: () => [...queryKeys.security.all, 'shield-status'] as const,
    events: (limit?: number) => [...queryKeys.security.all, 'events', limit] as const,
  },

  // User Tracking
  userTracking: {
    all: ['user-tracking'] as const,
    active: () => [...queryKeys.userTracking.all, 'active'] as const,
    stats: () => [...queryKeys.userTracking.all, 'stats'] as const,
    activity: (params: Record<string, any> = {}) => [...queryKeys.userTracking.all, 'activity', params] as const,
    login: () => [...queryKeys.userTracking.all, 'login'] as const,
    logout: () => [...queryKeys.userTracking.all, 'logout'] as const,
  },

  // Dashboard
  dashboard: {
    all: ['dashboard'] as const,
    hr: (locationId?: number | string) => [...queryKeys.dashboard.all, 'hr', locationId] as const,
    manager: (locationId?: number | string) => [...queryKeys.dashboard.all, 'manager', locationId] as const,
  },

  // Landing
  landing: {
    all: ['landing'] as const,
    stats: () => [...queryKeys.landing.all, 'stats'] as const,
    locations: () => [...queryKeys.landing.all, 'locations'] as const,
  },

  // Chat
  chat: {
    all: ['chat'] as const,
    status: () => [...queryKeys.chat.all, 'status'] as const,
    messages: () => [...queryKeys.chat.all, 'messages'] as const,
  },

  // Kiosk
  kiosk: {
    all: ['kiosk'] as const,
    pins: () => [...queryKeys.kiosk.all, 'pins'] as const,
  },
};

// Helper to invalidate related queries
export const invalidateQueries = {
  employees: (queryClient: any, params?: Record<string, any>) => {
    if (params) {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.list(params) });
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.employees.lists() });
    queryClient.invalidateQueries({ queryKey: queryKeys.employees.all });
  },
  weddingCustomers: (queryClient: any, params?: Record<string, any>) => {
    if (params) {
      queryClient.invalidateQueries({ queryKey: queryKeys.wedding.customers.list(params) });
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.wedding.customers.lists() });
    queryClient.invalidateQueries({ queryKey: queryKeys.wedding.customers.all });
    // Also invalidate related queries
    queryClient.invalidateQueries({ queryKey: queryKeys.wedding.stats() });
    queryClient.invalidateQueries({ queryKey: queryKeys.wedding.pipeline() });
    queryClient.invalidateQueries({ queryKey: queryKeys.telecaller.stats() });
  },
  adminUsers: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers.lists() });
    queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers.all });
  },
  users: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() });
    queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
  },
  candidates: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.candidates.lists() });
    queryClient.invalidateQueries({ queryKey: queryKeys.candidates.all });
  },
  interviews: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.interviews.lists() });
    queryClient.invalidateQueries({ queryKey: queryKeys.interviews.all });
  },
  offers: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.offers.lists() });
    queryClient.invalidateQueries({ queryKey: queryKeys.offers.all });
  },
  deptHiring: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.deptHiring.all });
  },
  crm: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.crm.all });
  },
  mcheck: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.mcheck.all });
  },
  broadcasts: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.broadcasts.lists() });
    queryClient.invalidateQueries({ queryKey: queryKeys.broadcasts.all });
  },
  locations: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.locations.lists() });
    queryClient.invalidateQueries({ queryKey: queryKeys.locations.all });
  },
  feedbackQr: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.feedbackQr.lists() });
    queryClient.invalidateQueries({ queryKey: queryKeys.feedbackQr.all });
  },
  feedback: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.feedback.lists() });
    queryClient.invalidateQueries({ queryKey: queryKeys.feedback.all });
  },
  divert: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.divert.lists() });
    queryClient.invalidateQueries({ queryKey: queryKeys.divert.all });
  },
  vm: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.crm.all });
  },
  security: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.security.all });
  },
  userTracking: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.userTracking.all });
  },
};

export default queryKeys;