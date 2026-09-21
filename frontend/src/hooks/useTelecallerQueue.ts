import { useState, useEffect, useCallback, useRef } from 'react';
import { requestManager } from '../utils/requestManager';
import { toastManager } from '../utils/toastManager';
import { Auth } from '../services/api';

export function useTelecallerQueue(locationFilter: number | '' = '') {
  const [loading, setLoading] = useState(true);
  const [deskSummary, setDeskSummary] = useState({
    assignedCalls: 0,
    pendingCalls: 0,
    completedToday: 0,
    connectedCalls: 0,
    callbackCount: 0,
    remainingCalls: 0,
    dailyTarget: 40
  });

  const [queueRecords, setQueueRecords] = useState({
    dueToday: [],
    overdue: [],
    callbacks: [],
    upcoming: [],
    priority: [],
    newLeads: [],
    myQueue: []
  });

  const isTabVisible = useRef(true);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchDashboardData = useCallback(async (isPolling = false) => {
    if (!isPolling) setLoading(true);
    try {
      const session = Auth.get();
      if (!session?.token) return;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.token}`,
        'x-auth-token': session.token
      };

      if (locationFilter !== '') {
        headers['X-Location-Id'] = String(locationFilter);
      }

      const queryParams = new URLSearchParams();
      if (locationFilter !== '') queryParams.append('location_id', String(locationFilter));
      
      const url = `/api/wedding-crm/calling-desk${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

      const res = await requestManager.fetchWithRetry(url, {
        method: 'GET',
        headers,
        maxRetries: 3,
        baseDelayMs: 1000
      });

      if (res?.data) {
        const d = res.data;
        // Backend returns nested structure: { summary, counts, queues }
        const q = d.queues || d;
        const s = d.summary || d.counts || d;

        const dueToday = Array.isArray(q.dueToday) ? q.dueToday : (Array.isArray(q.due_today) ? q.due_today : []);
        const overdue = Array.isArray(q.overdue) ? q.overdue : [];
        const callbacks = Array.isArray(q.callbackRequests) ? q.callbackRequests : (Array.isArray(q.callbacks) ? q.callbacks : []);
        const upcoming = Array.isArray(q.upcoming) ? q.upcoming : [];
        const priority = Array.isArray(q.priorityCalls) ? q.priorityCalls : (Array.isArray(q.priority) ? q.priority : []);
        const newLeads = Array.isArray(q.newCustomers) ? q.newCustomers : (Array.isArray(q.new_customers) ? q.new_customers : []);

        const currentUserName = session?.fullName || session?.username || '';
        const userRole = (session?.role || '').toLowerCase();
        const isAdminOrManager = userRole.includes('admin') || userRole.includes('manager') || session?.isGlobalAdmin;

        const myQueue = [...dueToday, ...overdue, ...callbacks].filter(
          (c: any) => c.assigned_telecaller && c.assigned_telecaller.toLowerCase().includes(currentUserName.toLowerCase())
        );

        setQueueRecords({
          dueToday,
          overdue,
          callbacks,
          upcoming,
          priority,
          newLeads,
          myQueue: myQueue.length > 0 ? myQueue : (isAdminOrManager ? [...dueToday, ...overdue] : dueToday)
        });

        const completed = Number(s.completedToday) || Number(s.completed) || 0;
        const target = 40;
        setDeskSummary({
          assignedCalls: Number(s.assignedCalls) || dueToday.length + overdue.length,
          pendingCalls: Number(s.pendingCalls) || Number(s.pending) || dueToday.length + overdue.length,
          completedToday: completed,
          connectedCalls: Number(s.connectedCalls) || 0,
          callbackCount: Number(s.callbackCount) || callbacks.length,
          remainingCalls: Math.max(0, target - completed),
          dailyTarget: target
        });
      }
    } catch (err: any) {
      if (err.status === 429) {
        toastManager.error('rate-limit', 'Too many requests from this IP, please try again later.', { dedupe: true, maxCount: 1 });
      } else {
        toastManager.error('queue-fetch', 'Error loading telecaller queue: ' + err.message, { dedupe: true });
      }
    } finally {
      if (!isPolling) setLoading(false);
    }
  }, [locationFilter]);

  // Smart Poller logic with visibility awareness and jitter
  useEffect(() => {
    fetchDashboardData(false);

    const handleVisibilityChange = () => {
      isTabVisible.current = !document.hidden;
      if (isTabVisible.current) {
        // Fetch immediately when tab becomes visible again
        fetchDashboardData(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const startPolling = () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      
      // Base interval 45 seconds + random jitter up to 5 seconds
      const jitter = Math.floor(Math.random() * 5000);
      const interval = 45000 + jitter;

      pollTimerRef.current = setTimeout(() => {
        if (isTabVisible.current) {
          fetchDashboardData(true).finally(() => {
            startPolling();
          });
        } else {
          // Check again shortly if it became visible, without hitting API
          startPolling(); 
        }
      }, interval);
    };

    startPolling();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [fetchDashboardData]);

  return {
    loading,
    deskSummary,
    queueRecords,
    refreshQueue: () => fetchDashboardData(false)
  };
}
