import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Search,
  Filter,
  Trash2,
  CircleCheck,
  CircleX,
  TriangleAlert,
  Clock,
  Laptop,
  Eye,
  Activity
} from 'lucide-react';
import { API, Auth, UserSession } from '../services/api';
import { NotificationService } from '../services/notificationService';
import { DevToolsDetector, DevToolsDetectionState } from '../services/devToolsDetector';
import { showToast } from './Toast';

interface SecurityEventItem {
  id: number;
  username: string;
  action: string;
  details: any;
  ipAddress: string | null;
  createdAt: string;
}

interface DevToolsMonitoringPanelProps {
  session: UserSession | null;
  className?: string;
}

export default function DevToolsMonitoringPanel({ session, className = '' }: DevToolsMonitoringPanelProps) {
  const isAdmin = session?.role === 'Admin' || session?.role === 'Super Admin';

  // State
  const [shieldEnabled, setShieldEnabled] = useState(false);
  const [shieldBusy, setShieldBusy] = useState(false);
  const [detectorState, setDetectorState] = useState<DevToolsDetectionState>(DevToolsDetector.getState());

  // History events
  const [events, setEvents] = useState<SecurityEventItem[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<'ALL' | 'OPENED' | 'CLOSED'>('ALL');

  // Load Shield status
  const loadShieldStatus = useCallback(async () => {
    try {
      const res = await API.getShieldStatus();
      if (res && typeof res.enabled === 'boolean') {
        setShieldEnabled(res.enabled);
        DevToolsDetector.arm(res.enabled);
      }
    } catch {}
  }, []);

  // Load History Events
  const loadEvents = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingEvents(true);
    try {
      const res = await API.getSecurityEvents(100);
      if (res && Array.isArray(res.events)) {
        setEvents(res.events);
      }
    } catch (err: any) {
      // Quiet fail
    } finally {
      setLoadingEvents(false);
    }
  }, [isAdmin]);

  // Initial load and live subscriptions
  useEffect(() => {
    if (!isAdmin) return;

    loadShieldStatus();
    loadEvents();

    // Subscribe to detector live state changes
    const unsubDetector = DevToolsDetector.subscribe((state) => {
      setDetectorState(state);
    });

    // Subscribe to real-time shield toggle pushes
    const unsubShield = NotificationService.onShieldChanged((enabled) => {
      setShieldEnabled(enabled);
      DevToolsDetector.arm(enabled);
    });

    // Subscribe to real-time security events logged across the system
    const unsubSecurityEvents = NotificationService.onSecurityEvent((newEvent) => {
      setEvents((prev) => [newEvent, ...prev.slice(0, 99)]);
    });

    // Subscribe to security events cleared
    const unsubCleared = NotificationService.onSecurityEventsCleared(() => {
      setEvents([]);
    });

    // Background polling fallback every 15 seconds for events
    const pollInterval = window.setInterval(() => {
      loadEvents();
    }, 15000);

    return () => {
      unsubDetector();
      unsubShield();
      unsubSecurityEvents();
      unsubCleared();
      window.clearInterval(pollInterval);
    };
  }, [isAdmin, loadShieldStatus, loadEvents]);

  // Toggle Shield Switch
  const handleToggleShield = async () => {
    if (shieldBusy) return;
    setShieldBusy(true);
    const nextState = !shieldEnabled;
    try {
      const res = await API.toggleShield(nextState);
      if (res && typeof res.enabled === 'boolean') {
        setShieldEnabled(res.enabled);
        DevToolsDetector.arm(res.enabled);
        showToast(
          res.enabled
            ? 'Developer Tools Detection enabled — monitoring supported browser signals live.'
            : 'Developer Tools Detection disabled.',
          'success'
        );
      }
    } catch (err: any) {
      showToast('Error updating detection toggle: ' + (err.message || 'Server error'), 'error');
    } finally {
      setShieldBusy(false);
    }
  };

  // Clear Event History
  const handleClearHistory = async () => {
    if (!window.confirm('Clear all Developer Tools detection history? This action cannot be undone.')) {
      return;
    }
    setClearing(true);
    try {
      await API.clearSecurityEvents();
      setEvents([]);
      showToast('Detection history log cleared successfully.', 'success');
    } catch (err: any) {
      showToast('Failed to clear history: ' + (err.message || 'Error'), 'error');
    } finally {
      setClearing(false);
    }
  };

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (actionFilter === 'OPENED' && ev.action !== 'DEVTOOLS_DETECTED') return false;
      if (actionFilter === 'CLOSED' && ev.action !== 'DEVTOOLS_CLOSED') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchUser = ev.username?.toLowerCase().includes(q);
        const matchAction = ev.action?.toLowerCase().includes(q);
        const matchIp = ev.ipAddress?.toLowerCase().includes(q);
        const matchPage = ev.details?.page?.toLowerCase().includes(q);
        const matchSource = ev.details?.source?.toLowerCase().includes(q);
        return matchUser || matchAction || matchIp || matchPage || matchSource;
      }

      return true;
    });
  }, [events, actionFilter, searchQuery]);

  // If not admin, completely invisible
  if (!isAdmin) return null;

  const isOpen = detectorState.isOpen && shieldEnabled;

  return (
    <div className={`card-glass p-5 border-2 border-accent/30 space-y-5 bg-gradient-to-r from-white via-white to-background ${className}`}>
      {/* Header & Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-accent/20 pb-4">
        <div className="space-y-1 max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-primary text-accent text-[10px] font-black uppercase tracking-wider shadow-2xs">
            <ShieldAlert className="w-3.5 h-3.5 text-accent" />
            <span>Live Security Monitoring Hub</span>
          </div>
          <h3 className="font-black text-primary text-base tracking-tight flex items-center gap-2">
            <span>Developer Tools Detection</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${shieldEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
              {shieldEnabled ? 'Active' : 'Disabled'}
            </span>
          </h3>
          <p className="text-xs text-primary font-medium leading-relaxed">
            Continuously monitors supported browser inspection signals and attached debuggers live. External environments (VS Code, CMD, PowerShell, terminals) are safely distinguished and will not trigger false alerts.
          </p>
        </div>

        {/* Master ON/OFF Toggle */}
        <div className="flex items-center gap-3 bg-background/90 p-2 sm:p-2.5 rounded-2xl border border-accent/25 self-stretch sm:self-auto justify-between sm:justify-end shadow-2xs">
          <div className="text-right sm:pr-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-primary">Detection Engine</div>
            <div className={`text-xs font-black ${shieldEnabled ? 'text-emerald-700' : 'text-primary'}`}>
              {shieldEnabled ? 'ARMED & MONITORING' : 'OFF'}
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleShield}
            disabled={shieldBusy}
            aria-pressed={shieldEnabled}
            aria-label="Toggle Developer Tools Detection"
            title={shieldEnabled ? 'Click to Turn OFF Detection' : 'Click to Turn ON Detection'}
            className={`relative inline-flex h-9 w-[78px] items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent flex-shrink-0 cursor-pointer ${
              shieldEnabled ? 'bg-emerald-600' : 'bg-[#C5B8AD]'
            } ${shieldBusy ? 'opacity-60 cursor-wait' : ''}`}
          >
            <span
              className={`inline-block h-7 w-7 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                shieldEnabled ? 'translate-x-[44px]' : 'translate-x-1'
              }`}
            />
            <span
              className={`absolute text-[10px] font-black uppercase tracking-wider select-none ${
                shieldEnabled ? 'left-3 text-black' : 'right-2.5 text-[#5D4E42]'
              }`}
            >
              {shieldEnabled ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>
      </div>

      {/* Live Monitoring KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Current Status */}
        <div className="p-4 rounded-xl bg-white border border-accent/25 shadow-2xs">
          <div className="text-[10px] font-black text-primary/60 uppercase tracking-wider flex items-center justify-between">
            <span>Current Status</span>
            <Activity className="w-3.5 h-3.5 text-accent" />
          </div>
          <div className="mt-2">
            {!shieldEnabled ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-gray-100 text-gray-700">
                <span className="w-2 h-2 rounded-full bg-gray-400" />
                <span>Monitoring Inactive</span>
              </span>
            ) : isOpen ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-red-100 text-red-700 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-red-600" />
                <span>Developer Tools: OPEN</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CircleCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Developer Tools: CLOSED</span>
              </span>
            )}
          </div>
          <div className="text-[10px] text-primary/50 font-medium mt-1">
            {shieldEnabled ? (isOpen ? 'Active inspection detected' : 'Normal user mode') : 'Click ON to arm shield'}
          </div>
        </div>

        {/* Card 2: Last Detection */}
        <div className="p-4 rounded-xl bg-white border border-accent/25 shadow-2xs">
          <div className="text-[10px] font-black text-primary/60 uppercase tracking-wider flex items-center justify-between">
            <span>Last Detection</span>
            <ShieldAlert className="w-3.5 h-3.5 text-accent" />
          </div>
          <div className="mt-2 text-xs font-extrabold text-primary truncate">
            {detectorState.lastDetection
              ? `${detectorState.lastDetection.time} · ${detectorState.lastDetection.confidence}`
              : 'None'}
          </div>
          <div className="text-[10px] text-primary/50 font-medium mt-1 truncate">
            {detectorState.lastDetection ? detectorState.lastDetection.source : 'No detection events recorded'}
          </div>
        </div>

        {/* Card 3: Last Checked */}
        <div className="p-4 rounded-xl bg-white border border-accent/25 shadow-2xs">
          <div className="text-[10px] font-black text-primary/60 uppercase tracking-wider flex items-center justify-between">
            <span>Last Checked</span>
            <Clock className="w-3.5 h-3.5 text-accent" />
          </div>
          <div className="mt-2 text-xs font-mono font-black text-primary">
            {detectorState.lastChecked}
          </div>
          <div className="text-[10px] text-primary/50 font-medium mt-1">
            {shieldEnabled ? 'Real-time 500ms continuous pulse' : 'Clock running (engine paused)'}
          </div>
        </div>

        {/* Card 4: Detection Source */}
        <div className="p-4 rounded-xl bg-white border border-accent/25 shadow-2xs">
          <div className="text-[10px] font-black text-primary/60 uppercase tracking-wider flex items-center justify-between">
            <span>Detection Source</span>
            <Laptop className="w-3.5 h-3.5 text-accent" />
          </div>
          <div className="mt-2 text-xs font-extrabold text-primary truncate">
            {shieldEnabled && isOpen ? detectorState.source : 'Browser inspection signal'}
          </div>
          <div className="text-[10px] text-primary/50 font-medium mt-1">
            {shieldEnabled && isOpen ? `Confidence: ${detectorState.confidence}` : 'Supported browser signals'}
          </div>
        </div>
      </div>

      {/* Detection History Section */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-black text-primary uppercase tracking-wider flex items-center gap-2">
              <Laptop className="w-4 h-4 text-accent" />
              <span>Developer Tools Detection History</span>
            </h4>
            <p className="text-[11px] text-primary font-medium">
              Real-time audit log of inspection tools opened and closed across all client sessions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:flex-none">
              <Search className="w-3.5 h-3.5 text-primary/40 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search user, page, IP..."
                className="w-full sm:w-44 pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white border border-accent/25 focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Filter */}
            <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-xl border border-accent/25 text-xs font-bold text-primary">
              <Filter className="w-3 h-3 text-accent" />
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value as any)}
                className="bg-transparent focus:outline-none text-xs cursor-pointer font-bold"
              >
                <option value="ALL">All Events</option>
                <option value="OPENED">Opened Only</option>
                <option value="CLOSED">Closed Only</option>
              </select>
            </div>

            {/* Refresh */}
            <button
              type="button"
              onClick={loadEvents}
              disabled={loadingEvents}
              className="p-1.5 rounded-xl bg-white border border-accent/25 text-primary hover:bg-gray-50 transition-colors cursor-pointer shadow-2xs"
              title="Refresh Event Log"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-accent ${loadingEvents ? 'animate-spin' : ''}`} />
            </button>

            {/* Clear History */}
            {events.length > 0 && (
              <button
                type="button"
                onClick={handleClearHistory}
                disabled={clearing}
                className="px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold flex items-center gap-1.5 border border-red-200 transition-colors cursor-pointer"
                title="Clear Detection Logs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* History Table */}
        <div className="rounded-xl border border-accent/20 overflow-hidden shadow-2xs bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-primary text-white text-[10px] font-black uppercase tracking-wider border-b border-accent/20">
                <tr>
                  <th className="py-2.5 px-3">Date / Time</th>
                  <th className="py-2.5 px-3">User</th>
                  <th className="py-2.5 px-3">Detection Event</th>
                  <th className="py-2.5 px-3">Source &amp; Confidence</th>
                  <th className="py-2.5 px-3">Page Location</th>
                  <th className="py-2.5 px-3 text-right">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-accent/10">
                {loadingEvents && events.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-primary/60">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto text-accent mb-2" />
                      <p className="font-bold">Loading security events...</p>
                    </td>
                  </tr>
                ) : filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-primary/60">
                      <ShieldCheck className="w-8 h-8 text-accent/50 mx-auto mb-2" />
                      <p className="font-bold text-sm text-primary">No Developer Tools detections recorded</p>
                      <p className="text-xs text-primary/50 mt-0.5">
                        {shieldEnabled ? 'The monitoring engine is active and will log when tools are opened.' : 'Turn ON the detection engine to begin recording events.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map((ev) => {
                    const isOpened = ev.action === 'DEVTOOLS_DETECTED';
                    const source = ev.details?.source || (isOpened ? 'Browser inspection' : 'Closed');
                    const confidence = ev.details?.confidence || (isOpened ? 'High' : 'Normal');
                    const page = ev.details?.page || '—';

                    return (
                      <tr key={ev.id} className="hover:bg-accent/5 transition-colors">
                        {/* Timestamp */}
                        <td className="py-2.5 px-3 whitespace-nowrap font-medium text-primary">
                          {ev.createdAt
                            ? new Date(ev.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
                            : '—'}
                        </td>

                        {/* User */}
                        <td className="py-2.5 px-3 font-extrabold text-primary">
                          @{ev.username || 'unknown'}
                        </td>

                        {/* Event */}
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              isOpened ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {isOpened ? <CircleX className="w-3 h-3 text-red-600" /> : <CircleCheck className="w-3 h-3 text-emerald-600" />}
                            <span>{isOpened ? 'DevTools Opened' : 'DevTools Closed'}</span>
                          </span>
                        </td>

                        {/* Source & Confidence */}
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-primary text-[11px]">{source}</div>
                          {isOpened && (
                            <span className="text-[9px] font-black text-accent uppercase">
                              Confidence: {confidence}
                            </span>
                          )}
                        </td>

                        {/* Page */}
                        <td className="py-2.5 px-3 font-mono text-[11px] text-primary">
                          {page}
                        </td>

                        {/* IP Address */}
                        <td className="py-2.5 px-3 text-right font-mono text-[10px] text-primary/60">
                          {ev.ipAddress || '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="p-2.5 bg-primary/5 border-t border-accent/10 flex items-center justify-between text-[11px] text-primary/60 font-semibold">
            <span>Showing {filteredEvents.length} recorded events</span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-accent" />
              Live Socket.IO Stream Active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
