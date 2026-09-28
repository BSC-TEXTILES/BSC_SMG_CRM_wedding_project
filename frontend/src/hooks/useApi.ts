/**
 * Centralized React Query API Hooks
 * 
 * Provides type-safe, cached, and automatically synchronized data fetching
 * for all entities across the application.
 * 
 * Usage:
 *   const { data: employees, isLoading } = useEmployees({ locationId: 1 });
 *   const { mutate: updateEmployee } = useUpdateEmployee();
 */

import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';
import { API, Auth, apiFetch } from '../services/api';
import { queryKeys, invalidateQueries } from './queryKeys';

export { queryKeys, invalidateQueries };

// ============================================================================
// Query Client Factory
// ============================================================================

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000, // 30 seconds
        gcTime: 5 * 60 * 1000, // 5 minutes
        retry: (failureCount, error: any) => {
          if (error?.status === 401 || error?.status === 403) return false;
          return failureCount < 2;
        },
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

// ============================================================================
// Auth & Session Hooks
// ============================================================================

export function useSession() {
  return useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => {
      const session = Auth.get();
      if (!session) return null;
      return session;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: typeof window !== 'undefined',
  });
}

export function usePermissions() {
  return useQuery({
    queryKey: queryKeys.auth.permissions,
    queryFn: () => API.getMyPermissions(),
    staleTime: 5 * 60 * 1000,
    enabled: Auth.check(),
  });
}

export function usePageSettings() {
  return useQuery({
    queryKey: queryKeys.auth.pageSettings,
    queryFn: () => API.getPageSettings(),
    staleTime: 10 * 60 * 1000,
    enabled: Auth.check(),
  });
}

// ============================================================================
// Employee / Candidate Hooks
// ============================================================================

export function useEmployees(params: { locationId?: string | number } = {}) {
  return useQuery({
    queryKey: queryKeys.employees.list(params),
    queryFn: () => API.getEmployees(params),
    staleTime: 30 * 1000,
  });
}

export function useEmployeeProfile(id: string | number) {
  return useQuery({
    queryKey: queryKeys.employees.profile(id),
    queryFn: () => API.getEmployeeProfile(id),
    enabled: !!id,
    staleTime: 60 * 1000,
  });
}

export function useEmployeeDocuments(id: string | number) {
  return useQuery({
    queryKey: queryKeys.employees.documents(id),
    queryFn: () => API.getEmployeeDocuments(id),
    enabled: !!id,
    staleTime: 60 * 1000,
  });
}

export function useEmployeeAudit(id: string | number) {
  return useQuery({
    queryKey: queryKeys.employees.audit(id),
    queryFn: () => API.getEmployeeAudit(id),
    enabled: !!id,
    staleTime: 60 * 1000,
  });
}

export function useEmployeePhotoUrl(id: string | number) {
  return API.getEmployeePhotoUrl(id);
}

// Mutations
export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string | number; data: any }) => 
      API.updateCandidate(String(id), data),
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.employees.all });
      
      // Snapshot previous value
      const previousEmployees = queryClient.getQueryData(queryKeys.employees.lists());
      const previousDetail = queryClient.getQueryData(queryKeys.employees.detail(id));
      
      // Optimistically update
      queryClient.setQueryData(queryKeys.employees.detail(id), (old: any) => ({
        ...old,
        ...data,
        updatedAt: new Date().toISOString(),
      }));
      
      // Update in lists
      queryClient.setQueriesData(
        { queryKey: queryKeys.employees.lists() },
        (old: any) => {
          if (!old) return old;
          if (old.employees) {
            return {
              ...old,
              employees: old.employees.map((emp: any) => 
                String(emp.appNo) === String(id) || String(emp.id) === String(id)
                  ? { ...emp, ...data }
                  : emp
              ),
            };
          }
          return old;
        }
      );
      
      return { previousEmployees, previousDetail };
    },
    onError: (err, { id }, context: any) => {
      // Rollback on error
      if (context?.previousEmployees) {
        queryClient.setQueryData(queryKeys.employees.lists(), context.previousEmployees);
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(queryKeys.employees.detail(id), context.previousDetail);
      }
    },
    onSettled: (data, error, { id }) => {
      // Invalidate and refetch
      invalidateQueries.employees(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.detail(id) });
    },
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string | number) => API.deleteCandidate(String(id)),
    onSettled: () => {
      invalidateQueries.employees(queryClient);
    },
  });
}

export function useUploadEmployeePhoto() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, file }: { id: string | number; file: File }) => 
      API.uploadEmployeePhoto(id, file),
    onSettled: (data, error, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.documents(id) });
    },
  });
}

export function useRemoveEmployeePhoto() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string | number) => API.removeEmployeePhoto(id),
    onSettled: (data, error, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.documents(id) });
    },
  });
}

export function useUploadEmployeeDocument() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, file, documentType }: { id: string | number; file: File; documentType: string }) => 
      API.uploadEmployeeDocument(id, file, documentType),
    onSettled: (data, error, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.documents(id) });
    },
  });
}

export function useDeleteEmployeeDocument() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, docId }: { id: string | number; docId: string | number }) => 
      API.deleteEmployeeDocument(id, docId),
    onSettled: (data, error, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.documents(id) });
    },
  });
}

export function useBulkImportEmployees() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (employees: any[]) => 
      apiFetch('/employees/bulk', {
        method: 'POST',
        body: JSON.stringify({ employees }),
      }),
    onSettled: () => {
      invalidateQueries.employees(queryClient);
    },
  });
}

// ============================================================================
// Wedding CRM Hooks
// ============================================================================

export function useWeddingStats(locationId?: number | string) {
  return useQuery({
    queryKey: queryKeys.wedding.stats(locationId),
    queryFn: () => API.getWeddingStats(locationId),
    staleTime: 30 * 1000,
    enabled: Auth.check(),
  });
}

export function useWeddingCustomers(params: Record<string, any> = {}) {
  return useQuery({
    queryKey: queryKeys.wedding.customers.list(params),
    queryFn: () => API.getWeddingCustomers(params),
    staleTime: 30 * 1000,
    enabled: Auth.check(),
  });
}

export function useWeddingCustomer(id: string | number) {
  return useQuery({
    queryKey: queryKeys.wedding.customers.detail(id),
    queryFn: () => API.getWeddingCustomerById(id),
    enabled: !!id,
    staleTime: 60 * 1000,
  });
}

export function useWeddingFullProfile(id: string | number) {
  return useQuery({
    queryKey: queryKeys.wedding.customers.fullProfile(id),
    queryFn: () => API.getWeddingFullProfile(id),
    enabled: !!id,
    staleTime: 60 * 1000,
  });
}

export function useWeddingTelecallers(locationId?: number | string) {
  return useQuery({
    queryKey: queryKeys.wedding.telecallers(locationId),
    queryFn: () => API.getWeddingTelecallers(locationId),
    staleTime: 5 * 60 * 1000,
    enabled: Auth.check(),
  });
}

export function useWeddingCallingDesk(params: Record<string, any> = {}) {
  return useQuery({
    queryKey: queryKeys.wedding.callingDesk(params),
    queryFn: () => API.getWeddingCallingDesk(params),
    staleTime: 15 * 1000,
    enabled: Auth.check(),
  });
}

export function useWeddingCalendar(params: Record<string, any> = {}) {
  return useQuery({
    queryKey: queryKeys.wedding.calendar(params),
    queryFn: () => API.getWeddingCalendar(params),
    staleTime: 60 * 1000,
    enabled: Auth.check(),
  });
}

export function useWeddingPipeline(locationId?: number | string) {
  return useQuery({
    queryKey: queryKeys.wedding.pipeline(locationId),
    queryFn: () => API.getWeddingPipeline(locationId),
    staleTime: 60 * 1000,
    enabled: Auth.check(),
  });
}

export function useWeddingUpcoming(days?: number, locationId?: number | string) {
  return useQuery({
    queryKey: queryKeys.wedding.upcoming({ days, locationId }),
    queryFn: () => API.getWeddingUpcoming(days, locationId),
    staleTime: 60 * 1000,
    enabled: Auth.check(),
  });
}

export function useWeddingEmployeePerformance(locationId?: number | string) {
  return useQuery({
    queryKey: queryKeys.wedding.employeePerformance(locationId),
    queryFn: () => API.getWeddingEmployeePerformance(locationId),
    staleTime: 60 * 1000,
    enabled: Auth.check(),
  });
}

export function useWeddingEnhancedDashboard(locationId?: number | string) {
  return useQuery({
    queryKey: queryKeys.wedding.enhancedDashboard(locationId),
    queryFn: () => API.getWeddingEnhancedDashboard(locationId),
    staleTime: 60 * 1000,
    enabled: Auth.check(),
  });
}

export function useWeddingCharts(locationId?: number | string) {
  return useQuery({
    queryKey: queryKeys.wedding.charts(locationId),
    queryFn: () => API.getWeddingDashboardCharts(locationId),
    staleTime: 60 * 1000,
    enabled: Auth.check(),
  });
}

export function useWeddingImportLogs(limit: number = 50) {
  return useQuery({
    queryKey: queryKeys.wedding.importLogs(limit),
    queryFn: () => API.getWeddingImportLogs(limit),
    staleTime: 60 * 1000,
    enabled: Auth.check(),
  });
}

export function useWeddingSources() {
  return useQuery({
    queryKey: queryKeys.wedding.sources(),
    queryFn: () => API.getWeddingCustomerSources(),
    staleTime: 10 * 60 * 1000,
    enabled: Auth.check(),
  });
}

// Wedding Mutations
export function useCreateWeddingCustomer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (payload: any) => API.createWeddingCustomer(payload),
    onSettled: () => {
      invalidateQueries.weddingCustomers(queryClient);
    },
  });
}

export function useUpdateWeddingCustomer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string | number; data: any }) => 
      API.updateWeddingCustomer(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.wedding.customers.all });
      
      const previousDetail = queryClient.getQueryData(queryKeys.wedding.customers.detail(id));
      
      queryClient.setQueryData(queryKeys.wedding.customers.detail(id), (old: any) => ({
        ...old,
        ...data,
        updatedAt: new Date().toISOString(),
      }));
      
      queryClient.setQueriesData(
        { queryKey: queryKeys.wedding.customers.lists() },
        (old: any) => {
          if (!old) return old;
          if (old.customers) {
            return {
              ...old,
              customers: old.customers.map((c: any) => 
                String(c.id) === String(id)
                  ? { ...c, ...data }
                  : c
              ),
            };
          }
          return old;
        }
      );
      
      return { previousDetail };
    },
    onError: (err, { id }, context: any) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(queryKeys.wedding.customers.detail(id), context.previousDetail);
      }
    },
    onSettled: (data, error, { id }) => {
      invalidateQueries.weddingCustomers(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.wedding.customers.detail(id) });
    },
  });
}

export function useDeleteWeddingCustomer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string | number) => API.deleteWeddingCustomer(id),
    onSettled: () => {
      invalidateQueries.weddingCustomers(queryClient);
    },
  });
}

export function useAssignWeddingTelecaller() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ customerId, telecallerId, telecallerName }: { customerId: string | number; telecallerId: string | number; telecallerName?: string }) => 
      API.assignWeddingTelecaller(customerId, telecallerId, telecallerName),
    onSettled: () => {
      invalidateQueries.weddingCustomers(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.wedding.telecallers() });
    },
  });
}

export function useLogWeddingCall() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (payload: any) => API.logWeddingCall(payload),
    onSettled: () => {
      invalidateQueries.weddingCustomers(queryClient);
    },
  });
}

export function useChangeWeddingCustomerStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ customerId, newStatus, reason }: { customerId: string | number; newStatus: string; reason?: string }) => 
      API.changeWeddingCustomerStatus(customerId, newStatus, reason),
    onSettled: () => {
      invalidateQueries.weddingCustomers(queryClient);
    },
  });
}

export function useImportWeddingCustomers() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (formData: FormData) => API.importWeddingCustomers(formData),
    onSettled: () => {
      invalidateQueries.weddingCustomers(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.wedding.importLogs() });
    },
  });
}

export function useBulkUpdateWeddingStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ customerIds, newStatus }: { customerIds: number[]; newStatus: string }) => 
      API.weddingBulkUpdateStatus(customerIds, newStatus),
    onSettled: () => {
      invalidateQueries.weddingCustomers(queryClient);
    },
  });
}

export function useBulkAssignWeddingTelecaller() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ customerIds, telecaller, telecallerId }: { customerIds: number[]; telecaller: string; telecallerId?: number }) => 
      API.weddingBulkAssign(customerIds, telecaller, telecallerId),
    onSettled: () => {
      invalidateQueries.weddingCustomers(queryClient);
    },
  });
}

export function useMergeWeddingCustomers() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ primaryId, duplicateId }: { primaryId: string | number; duplicateId: string | number }) => 
      API.mergeWeddingCustomers(primaryId, duplicateId),
    onSettled: () => {
      invalidateQueries.weddingCustomers(queryClient);
    },
  });
}

// ============================================================================
// User Management Hooks
// ============================================================================

export function useAdminUsers() {
  return useQuery({
    queryKey: queryKeys.adminUsers.list(),
    queryFn: () => API.getAdminUsers(),
    staleTime: 60 * 1000,
    enabled: Auth.check(),
  });
}

export function useAdminUser(id: string | number) {
  return useQuery({
    queryKey: queryKeys.adminUsers.detail(id),
    queryFn: () => API.getAdminUser(id),
    enabled: !!id,
    staleTime: 60 * 1000,
  });
}

export function useAdminUserPermissions(id: string | number) {
  return useQuery({
    queryKey: queryKeys.adminUsers.permissions(id),
    queryFn: () => API.getAdminUserPermissions(id),
    enabled: !!id,
    staleTime: 60 * 1000,
  });
}

export function useAdminModules() {
  return useQuery({
    queryKey: queryKeys.adminUsers.modules(),
    queryFn: () => API.getAdminModules(),
    staleTime: 10 * 60 * 1000,
    enabled: Auth.check(),
  });
}

export function useCreateAdminUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: any) => API.createAdminUser(data),
    onSettled: () => {
      invalidateQueries.adminUsers(queryClient);
    },
  });
}

export function useUpdateAdminUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string | number; data: any }) => 
      API.updateAdminUser(id, data),
    onSettled: (data, error, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers.detail(id) });
      invalidateQueries.adminUsers(queryClient);
    },
  });
}

export function useUpdateAdminUserPermissions() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, permissions }: { id: string | number; permissions: any[] }) => 
      API.updateAdminUserPermissions(id, permissions),
    onSettled: (data, error, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers.permissions(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers.detail(id) });
      invalidateQueries.adminUsers(queryClient);
    },
  });
}

export function useToggleAdminUserStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string | number; data?: { duration?: string; customDate?: string; reason?: string } }) => 
      API.toggleAdminUserStatus(id, data),
    onSettled: (data, error, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers.detail(id) });
      invalidateQueries.adminUsers(queryClient);
    },
  });
}

export function useDeleteAdminUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string | number) => API.deleteAdminUser(id),
    onSettled: () => {
      invalidateQueries.adminUsers(queryClient);
    },
  });
}

export function useResetAdminUserPassword() {
  return useMutation({
    mutationFn: ({ id, password }: { id: string | number; password: string }) => 
      API.resetAdminUserPassword(id, password),
  });
}

// ============================================================================
// Candidate Hooks
// ============================================================================

export function useCandidates(params: Record<string, any> = {}) {
  return useQuery({
    queryKey: queryKeys.candidates.list(params),
    queryFn: () => API.getCandidates(params),
    staleTime: 30 * 1000,
    enabled: Auth.check(),
  });
}

export function useCandidate(appNo: string) {
  return useQuery({
    queryKey: queryKeys.candidates.detail(appNo),
    queryFn: () => API.getCandidates({ appNo }).then(res => res.candidates?.[0]),
    enabled: !!appNo,
    staleTime: 60 * 1000,
  });
}

export function useUpdateCandidate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ appNo, updates, candName, doneBy }: { appNo: string; updates: any; candName?: string; doneBy?: string }) => 
      API.updateCandidate(appNo, updates, candName, doneBy),
    onSettled: () => {
      invalidateQueries.candidates(queryClient);
    },
  });
}

export function useDeleteCandidate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (appNo: string) => API.deleteCandidate(appNo),
    onSettled: () => {
      invalidateQueries.candidates(queryClient);
    },
  });
}

export function useCandidateKPIs(params: Record<string, any> = {}) {
  return useQuery({
    queryKey: queryKeys.candidates.kpis(params),
    queryFn: () => API.getKPIs(params.range, params.fromDate, params.toDate),
    staleTime: 60 * 1000,
    enabled: Auth.check(),
  });
}

// ============================================================================
// Interview Hooks
// ============================================================================

export function useInterviews(params: Record<string, any> = {}) {
  return useQuery({
    queryKey: queryKeys.interviews.list(params),
    queryFn: () => API.getInterviews(),
    staleTime: 60 * 1000,
    enabled: Auth.check(),
  });
}

export function useInterviewQuestions(params: Record<string, any> = {}) {
  return useQuery({
    queryKey: queryKeys.interviews.questions(params),
    queryFn: () => API.getInterviewQuestions(params.desig, params.round),
    staleTime: 10 * 60 * 1000,
    enabled: Auth.check(),
  });
}

export function useCallStatus(appNo: string) {
  return useQuery({
    queryKey: queryKeys.interviews.callStatus(appNo),
    queryFn: () => API.getCallStatus(appNo),
    enabled: !!appNo,
    staleTime: 30 * 1000,
  });
}

// ============================================================================
// Department Hiring & Section Allocation Hooks
// ============================================================================

export function useHiringTargets() {
  return useQuery({
    queryKey: queryKeys.deptHiring.targets(),
    queryFn: () => API.getHiringTargets(),
    staleTime: 60 * 1000,
    enabled: Auth.check(),
  });
}

export function useSectionAllocations() {
  return useQuery({
    queryKey: queryKeys.deptHiring.sectionAllocations(),
    queryFn: () => API.getSectionAllocations(),
    staleTime: 60 * 1000,
    enabled: Auth.check(),
  });
}

export function useDepartmentSections() {
  return useQuery({
    queryKey: queryKeys.deptHiring.sections(),
    queryFn: () => API.getDepartmentSections(),
    staleTime: 10 * 60 * 1000,
    enabled: Auth.check(),
  });
}

// ============================================================================
// CRM Store Operations Hooks
// ============================================================================

export function useCrmSettings() {
  return useQuery({
    queryKey: queryKeys.crm.settings(),
    queryFn: () => API.getCrmSettings(),
    staleTime: 10 * 60 * 1000,
    enabled: Auth.check(),
  });
}

export function useCrmSections() {
  return useQuery({
    queryKey: queryKeys.crm.sections(),
    queryFn: () => API.getSections(),
    staleTime: 10 * 60 * 1000,
    enabled: Auth.check(),
  });
}

export function useFootfall(params: Record<string, any> = {}) {
  return useQuery({
    queryKey: queryKeys.crm.footfall(params),
    queryFn: () => API.getFootfall(params.date, params.locationId),
    staleTime: 60 * 1000,
    enabled: Auth.check(),
  });
}

export function useUpsertFootfall() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (payload: any) => API.upsertFootfall(payload),
    onSettled: () => {
      invalidateQueries.crm(queryClient);
    },
  });
}

export function useFeedbackQuestions() {
  return useQuery({
    queryKey: queryKeys.crm.feedbackQuestions(),
    queryFn: () => API.getFeedbackQuestions(),
    staleTime: 10 * 60 * 1000,
  });
}

export function useFeedbackStats(params: Record<string, any> = {}) {
  return useQuery({
    queryKey: queryKeys.crm.feedbackStats(params),
    queryFn: () => API.getFeedbackStats(params),
    staleTime: 60 * 1000,
    enabled: Auth.check(),
  });
}

export function useFeedbacks(params: Record<string, any> = {}) {
  return useQuery({
    queryKey: queryKeys.crm.feedbacks(params),
    queryFn: () => API.getFeedbacks(params),
    staleTime: 30 * 1000,
    enabled: Auth.check(),
  });
}

export function useSubmitFeedback() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (payload: any) => API.submitFeedback(payload),
    onSettled: () => {
      invalidateQueries.feedback(queryClient);
    },
  });
}

export function useCallQueue(params: Record<string, any> = {}) {
  return useQuery({
    queryKey: queryKeys.crm.callQueue(params),
    queryFn: () => API.getCallQueue(params),
    staleTime: 30 * 1000,
    enabled: Auth.check(),
  });
}

export function useUpdateCallQueue() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (payload: any) => API.updateCallQueue(payload),
    onSettled: () => {
      invalidateQueries.crm(queryClient);
    },
  });
}

export function useDiverts(params: Record<string, any> = {}) {
  return useQuery({
    queryKey: queryKeys.crm.diverts(params),
    queryFn: () => API.getDiverts(params),
    staleTime: 30 * 1000,
    enabled: Auth.check(),
  });
}

export function useCreateDivert() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (payload: any) => API.createDivert(payload),
    onSettled: () => {
      invalidateQueries.divert(queryClient);
    },
  });
}

export function useUpdateDivert() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (payload: any) => API.updateDivert(payload),
    onSettled: () => {
      invalidateQueries.divert(queryClient);
    },
  });
}

export function useDivertUpdates(divertId: string) {
  return useQuery({
    queryKey: queryKeys.crm.divertUpdates(divertId),
    queryFn: () => API.getDivertUpdates(divertId),
    enabled: !!divertId,
    staleTime: 30 * 1000,
  });
}

export function useCashSettlement(date?: string) {
  return useQuery({
    queryKey: queryKeys.crm.cashSettlement(date),
    queryFn: () => API.getCashSettlement(date),
    staleTime: 60 * 1000,
    enabled: Auth.check(),
  });
}

export function useSaveCashSettlement() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (payload: any) => API.saveCashSettlement(payload),
    onSettled: () => {
      invalidateQueries.crm(queryClient);
    },
  });
}

export function useVmPoints() {
  return useQuery({
    queryKey: queryKeys.crm.vmPoints(),
    queryFn: () => API.getVmPoints(),
    staleTime: 10 * 60 * 1000,
    enabled: Auth.check(),
  });
}

export function useVmSubmissions() {
  return useQuery({
    queryKey: queryKeys.crm.vmSubmissions(),
    queryFn: () => API.getVmSubmissions(),
    staleTime: 60 * 1000,
    enabled: Auth.check(),
  });
}

export function useSubmitVm() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (payload: any) => API.submitVm(payload),
    onSettled: () => {
      invalidateQueries.vm(queryClient);
    },
  });
}

export function useVmFloors() {
  return useQuery({
    queryKey: queryKeys.crm.vmFloors(),
    queryFn: () => API.getVmFloors(),
    staleTime: 10 * 60 * 1000,
    enabled: Auth.check(),
  });
}

export function useVmPhotos(params: Record<string, any> = {}) {
  return useQuery({
    queryKey: queryKeys.crm.vmPhotos(params),
    queryFn: () => API.getVmPhotos(params),
    staleTime: 60 * 1000,
    enabled: Auth.check(),
  });
}

export function useUploadVmPhotos() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ filesOrFormData, meta }: { filesOrFormData: File[] | File | FormData; meta?: any }) => 
      API.uploadVmPhotos(filesOrFormData, meta),
    onSettled: () => {
      invalidateQueries.vm(queryClient);
    },
  });
}

export function useDeleteVmPhoto() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (photoId: string) => API.deleteVmPhoto(photoId),
    onSettled: () => {
      invalidateQueries.vm(queryClient);
    },
  });
}

export function useLinkVmPhotos() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ submissionId, photoIds }: { submissionId: string; photoIds: string[] }) => 
      API.linkVmPhotos(submissionId, photoIds),
    onSettled: () => {
      invalidateQueries.vm(queryClient);
    },
  });
}

export function useVmPhotoFileUrl(photoId: string) {
  return API.getVmPhotoFileUrl(photoId);
}

// ============================================================================
// MCheck Hooks
// ============================================================================

export function useMCheckModules() {
  return useQuery({
    queryKey: queryKeys.mcheck.modules(),
    queryFn: () => API.getMCheckModules(),
    staleTime: 10 * 60 * 1000,
    enabled: Auth.check(),
  });
}

export function useMCheckDashboard(date?: string) {
  return useQuery({
    queryKey: queryKeys.mcheck.dashboard(date),
    queryFn: () => API.getMCheckDashboard(date),
    staleTime: 30 * 1000,
    enabled: Auth.check(),
  });
}

export function useMCheckModuleDetail(moduleId: number | string, date?: string) {
  return useQuery({
    queryKey: queryKeys.mcheck.moduleDetail(moduleId, date),
    queryFn: () => API.getMCheckModuleDetail(moduleId, date),
    enabled: !!moduleId,
    staleTime: 30 * 1000,
  });
}

export function useSaveMCheckResponse() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (payload: any) => API.saveMCheckResponse(payload),
    onSettled: () => {
      invalidateQueries.mcheck(queryClient);
    },
  });
}

export function useSubmitAllMCheck() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (payload: any) => API.submitAllMCheck(payload),
    onSettled: () => {
      invalidateQueries.mcheck(queryClient);
    },
  });
}

export function useMCheckReports(params: Record<string, any> = {}) {
  return useQuery({
    queryKey: queryKeys.mcheck.reports(params),
    queryFn: () => API.getMCheckReports(params),
    staleTime: 60 * 1000,
    enabled: Auth.check(),
  });
}

export function useMCheckHistory(params: Record<string, any> = {}) {
  return useQuery({
    queryKey: queryKeys.mcheck.history(params),
    queryFn: () => API.getMCheckHistory(params),
    staleTime: 60 * 1000,
    enabled: Auth.check(),
  });
}

export function useMCheckTrend(days?: number) {
  return useQuery({
    queryKey: queryKeys.mcheck.trend(days),
    queryFn: () => API.getMCheckTrend(days),
    staleTime: 60 * 1000,
    enabled: Auth.check(),
  });
}

export function useMCheckAuditLog(checkpointId: number | string, responseDate?: string) {
  return useQuery({
    queryKey: queryKeys.mcheck.auditLog(checkpointId, responseDate),
    queryFn: () => API.getMCheckAuditLog(checkpointId, responseDate),
    enabled: !!checkpointId,
    staleTime: 60 * 1000,
  });
}

export function useUploadMCheckPhoto() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (formData: FormData) => API.uploadMCheckPhoto(formData),
    onSettled: () => {
      invalidateQueries.mcheck(queryClient);
    },
  });
}

// ============================================================================
// Broadcast Hooks
// ============================================================================

export function useBroadcasts(params: Record<string, any> = {}) {
  return useQuery({
    queryKey: queryKeys.broadcasts.list(params),
    queryFn: () => API.getBroadcasts(),
    staleTime: 60 * 1000,
    enabled: Auth.check(),
  });
}

export function useCreateBroadcast() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (payload: any) => API.createBroadcast(payload),
    onSettled: () => {
      invalidateQueries.broadcasts(queryClient);
    },
  });
}

export function useDeleteBroadcast() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string | number) => API.deleteBroadcast(id),
    onSettled: () => {
      invalidateQueries.broadcasts(queryClient);
    },
  });
}

// ============================================================================
// Locations Hooks
// ============================================================================

export function useLocations() {
  return useQuery({
    queryKey: queryKeys.locations.list(),
    queryFn: () => API.getLocations(),
    staleTime: 10 * 60 * 1000,
  });
}

export function usePublicLocations() {
  return useQuery({
    queryKey: queryKeys.locations.public(),
    queryFn: () => API.getPublicLocations(),
    staleTime: 10 * 60 * 1000,
  });
}

export function useLocation(id: number | string) {
  return useQuery({
    queryKey: queryKeys.locations.detail(id),
    queryFn: () => API.getLocation(id),
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
  });
}

export function useGlobalStats() {
  return useQuery({
    queryKey: queryKeys.locations.globalStats(),
    queryFn: () => API.getGlobalStats(),
    staleTime: 60 * 1000,
    enabled: Auth.check(),
  });
}

// ============================================================================
// Telecaller Dashboard Hooks
// ============================================================================

export function useTelecallerStats(locationId?: number | string) {
  return useQuery({
    queryKey: queryKeys.telecaller.stats(locationId),
    queryFn: () => API.getTelecallerDashboardStats(locationId),
    staleTime: 30 * 1000,
    enabled: Auth.check(),
  });
}

export function useTelecallerPipeline(locationId?: number | string) {
  return useQuery({
    queryKey: queryKeys.telecaller.pipeline(locationId),
    queryFn: () => API.getTelecallerFollowUpPipeline(locationId),
    staleTime: 60 * 1000,
    enabled: Auth.check(),
  });
}

// ============================================================================
// Feedback QR Hooks
// ============================================================================

export function useFeedbackQrCodes(params: Record<string, any> = {}) {
  return useQuery({
    queryKey: queryKeys.feedbackQr.list(params),
    queryFn: () => API.getQrCodes(params),
    staleTime: 60 * 1000,
    enabled: Auth.check(),
  });
}

export function useFeedbackQrStats(params: Record<string, any> = {}) {
  return useQuery({
    queryKey: queryKeys.feedbackQr.stats(params),
    queryFn: () => API.getQrCodeStats(params),
    staleTime: 60 * 1000,
    enabled: Auth.check(),
  });
}

export function useCreateFeedbackQr() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (payload: any) => API.createQrCode(payload),
    onSettled: () => {
      invalidateQueries.feedbackQr(queryClient);
    },
  });
}

export function useUpdateFeedbackQr() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string | number; data: any }) => 
      API.updateQrCode(id, data),
    onSettled: () => {
      invalidateQueries.feedbackQr(queryClient);
    },
  });
}

export function useDeleteFeedbackQr() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string | number) => API.deleteQrCode(id),
    onSettled: () => {
      invalidateQueries.feedbackQr(queryClient);
    },
  });
}

export function useToggleFeedbackQrStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string | number) => API.toggleQrCodeStatus(id),
    onSettled: () => {
      invalidateQueries.feedbackQr(queryClient);
    },
  });
}

export function useRegenerateFeedbackQr() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string | number) => API.regenerateQrCode(id),
    onSettled: () => {
      invalidateQueries.feedbackQr(queryClient);
    },
  });
}

// ============================================================================
// Security Hooks
// ============================================================================

export function useSecurityShieldStatus() {
  return useQuery({
    queryKey: queryKeys.security.shieldStatus(),
    queryFn: () => API.getShieldStatus(),
    staleTime: 30 * 1000,
    enabled: Auth.check(),
  });
}

export function useToggleSecurityShield() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (enabled: boolean) => API.toggleShield(enabled),
    onSettled: () => {
      invalidateQueries.security(queryClient);
    },
  });
}

export function useSecurityEvents(limit: number = 50) {
  return useQuery({
    queryKey: queryKeys.security.events(limit),
    queryFn: () => API.getSecurityEvents(limit),
    staleTime: 30 * 1000,
    enabled: Auth.check(),
  });
}

export function useClearSecurityEvents() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => API.clearSecurityEvents(),
    onSettled: () => {
      invalidateQueries.security(queryClient);
    },
  });
}

export function useLogSecurityEvent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ event, details }: { event: string; details?: any }) => 
      API.logSecurityEvent(event, details),
  });
}

// ============================================================================
// User Tracking Hooks
// ============================================================================

export function useActiveUsers() {
  return useQuery({
    queryKey: queryKeys.userTracking.active(),
    queryFn: () => API.getActiveUsers(),
    staleTime: 30 * 1000,
    enabled: Auth.check(),
  });
}

export function useUserTrackingStats() {
  return useQuery({
    queryKey: queryKeys.userTracking.stats(),
    queryFn: () => API.getUserTrackingStats(),
    staleTime: 60 * 1000,
    enabled: Auth.check(),
  });
}

// ============================================================================
// Dashboard Hooks
// ============================================================================

export function useHrDashboard(locationId?: number | string) {
  return useQuery({
    queryKey: queryKeys.dashboard.hr(locationId),
    queryFn: () => API.getHRDashboard(locationId),
    staleTime: 60 * 1000,
    enabled: Auth.check(),
  });
}

export function useManagerDashboard(locationId?: number | string) {
  return useQuery({
    queryKey: queryKeys.dashboard.manager(locationId),
    queryFn: () => API.getManagerDashboard(locationId),
    staleTime: 60 * 1000,
    enabled: Auth.check(),
  });
}

// ============================================================================
// Settings Hooks
// ============================================================================

export function useRoles() {
  return useQuery({
    queryKey: queryKeys.settings.roles(),
    queryFn: () => API.getRoles(),
    staleTime: 10 * 60 * 1000,
    enabled: Auth.check(),
  });
}

export function useDesignations() {
  return useQuery({
    queryKey: queryKeys.settings.designations(),
    queryFn: () => API.getDesignations(),
    staleTime: 10 * 60 * 1000,
    enabled: Auth.check(),
  });
}

export function useSavePageSettings() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (settings: any) => API.savePageSettings(settings),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.pageSettings });
    },
  });
}

// ============================================================================
// Utility Hooks
// ============================================================================

export function useInvalidateAll() {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries();
  };
}

export function usePrefetchQuery() {
  const queryClient = useQueryClient();
  
  return (key: any, queryFn: () => Promise<any>) => {
    queryClient.prefetchQuery({ queryKey: key, queryFn });
  };
}

export function useQueryCache() {
  const queryClient = useQueryClient();
  
  return {
    get: (key: any) => queryClient.getQueryData(key),
    set: (key: any, data: any) => queryClient.setQueryData(key, data),
    remove: (key: any) => queryClient.removeQueries({ queryKey: key }),
  };
}

export function useRealtimeInvalidation(queryClient: QueryClient) {
  // This hook connects real-time events to query invalidation
  // It should be called once at the app root level
  return {
    setupListeners: () => {
      const handleEmployeeUpdate = (e: CustomEvent) => {
        const payload = e.detail;
        if (payload?.id) {
          queryClient.invalidateQueries({ queryKey: queryKeys.employees.detail(payload.id) });
        }
        invalidateQueries.employees(queryClient);
      };
      
      const handleWeddingUpdate = (e: CustomEvent) => {
        const payload = e.detail;
        if (payload?.id) {
          queryClient.invalidateQueries({ queryKey: queryKeys.wedding.customers.detail(payload.id) });
        }
        invalidateQueries.weddingCustomers(queryClient);
      };
      
      const handleUserUpdate = (e: CustomEvent) => {
        const payload = e.detail;
        if (payload?.id) {
          queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers.detail(payload.id) });
        }
        invalidateQueries.adminUsers(queryClient);
      };
      
      const handlePermissionsUpdate = () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.permissions });
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.myPermissions });
      };
      
      window.addEventListener('realtime:employee', handleEmployeeUpdate as any);
      window.addEventListener('realtime:wedding', handleWeddingUpdate as any);
      window.addEventListener('realtime:user', handleUserUpdate as any);
      window.addEventListener('realtime:permissions', handlePermissionsUpdate as any);
      
      return () => {
        window.removeEventListener('realtime:employee', handleEmployeeUpdate as any);
        window.removeEventListener('realtime:wedding', handleWeddingUpdate as any);
        window.removeEventListener('realtime:user', handleUserUpdate as any);
        window.removeEventListener('realtime:permissions', handlePermissionsUpdate as any);
      };
    },
  };
}

// Export API for direct use when needed
export { API, Auth, apiFetch } from '../services/api';
export type { UserSession } from '../services/api';