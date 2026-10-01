import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layouts/DashboardLayout';
import PageContainer from '../components/ui/PageContainer';
import ToastContainer, { showToast } from '../components/Toast';
import ModalPortal from '../components/ui/ModalPortal';
import { API, Auth } from '../services/api';
import { useLocationContext } from '../context/LocationContext';
import { useRealtimeSection } from '../hooks/useRealtimeSection';
import { formatDateDisplay, formatDateTimeDisplay, formatISTDate } from '../utils/dateUtils';
import {
  Calendar, CircleAlert, CircleCheck, Clock, Download, Eye, FileText, Filter, Hash,
  History, MapPin, MessageSquare, Phone, RefreshCw, RotateCcw, Search, Send, ShieldAlert,
  Star, ThumbsDown, ThumbsUp, Trash2, TriangleAlert, User, UserCheck, X
} from 'lucide-react';

/* ════════════════════════════════════════════════════════════════════════
   VOCABULARY & PURE HELPERS
   Single source of truth for follow-up statuses, survey questions and the
   store registry so the table, the mobile cards, the filter bar and the
   resolution desk can never drift apart again.
   ════════════════════════════════════════════════════════════════════════ */

interface BadgeTone {
  label: string;
  className: string;
  Icon: any;
}

/**
 * Canonical follow-up statuses. `in_progress` / `escalated` / `closed` are
 * legacy values still present on older rows; they are rendered here so no
 * record ever falls through to a wrong badge.
 */
const FOLLOW_UP_BADGES: Record<string, BadgeTone> = {
  new: { label: 'New', className: 'bg-amber-50 text-amber-800 border-amber-200', Icon: Clock },
  pending: { label: 'Pending Call', className: 'bg-amber-50 text-amber-800 border-amber-200', Icon: Clock },
  called: { label: 'Called', className: 'bg-blue-50 text-blue-800 border-blue-200', Icon: Phone },
  in_progress: { label: 'In Progress', className: 'bg-blue-50 text-blue-800 border-blue-200', Icon: Phone },
  escalated: { label: 'Escalated', className: 'bg-purple-50 text-purple-800 border-purple-200', Icon: ShieldAlert },
  escalated_manager: { label: 'Escalated', className: 'bg-purple-50 text-purple-800 border-purple-200', Icon: ShieldAlert },
  resolved: { label: 'Resolved', className: 'bg-emerald-50 text-emerald-800 border-emerald-200', Icon: CircleCheck },
  closed: { label: 'Closed', className: 'bg-emerald-50 text-emerald-800 border-emerald-200', Icon: CircleCheck }
};

const followUpBadge = (status: any): BadgeTone => {
  const raw = String(status ?? '').trim();
  if (!raw) return { label: 'Not Recorded', className: 'bg-gray-50 text-gray-600 border-gray-200', Icon: CircleAlert };
  return FOLLOW_UP_BADGES[raw.toLowerCase()]
    || { label: raw, className: 'bg-gray-50 text-gray-600 border-gray-200', Icon: CircleAlert };
};

/** Statuses the resolution desk may write. Values match `followUpBadge` keys exactly. */
const RESOLUTION_STATUSES = [
  { value: 'called', label: 'Called — Follow-up In Progress' },
  { value: 'escalated_manager', label: 'Escalated to Store Manager' },
  { value: 'resolved', label: 'Resolved — Customer Satisfied' }
];

/** Folds auto/legacy statuses onto the closest selectable action. */
const toResolutionStatus = (status: any): string => {
  const raw = String(status ?? '').trim().toLowerCase();
  if (raw === 'resolved' || raw === 'closed') return 'resolved';
  if (raw === 'escalated' || raw === 'escalated_manager') return 'escalated_manager';
  return 'called';
};

/** Server-side values accepted by GET /crm/feedbacks?followUp= */
const FOLLOW_UP_FILTERS = [
  { value: 'all', label: 'All Follow-ups' },
  { value: 'needs_follow_up', label: 'Open (Any Stage)' },
  { value: 'new', label: 'New' },
  { value: 'pending', label: 'Pending Call' },
  { value: 'called', label: 'Called / In Progress' },
  { value: 'escalated_manager', label: 'Escalated to Manager' },
  { value: 'resolved', label: 'Resolved' }
];

const DATE_PRESETS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'Last 7 Days' },
  { value: 'month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'custom', label: 'Custom Range' }
];

const STORES = [
  { key: 'belagavi', locId: '1', code: 'BEL', name: 'Belagavi', dot: 'bg-blue-500', chip: 'bg-blue-50 text-blue-800 border-blue-200' },
  { key: 'davanagere', locId: '2', code: 'DAV', name: 'Davanagere', dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  { key: 'shivamogga', locId: '3', code: 'SHI', name: 'Shivamogga', dot: 'bg-purple-500', chip: 'bg-purple-50 text-purple-800 border-purple-200' }
];

/** The five survey questions collected by the in-store QR kiosk. */
const SURVEY_QUESTIONS = [
  { key: 'q1', heading: 'Overall Experience', full: '1. Overall Shopping Experience' },
  { key: 'q2', heading: 'Product Found', full: '2. Product Availability' },
  { key: 'q3', heading: 'Collection Quality', full: '3. Collection Quality & Variety' },
  { key: 'q4', heading: 'Staff Courtesy', full: '4. Staff Courtesy & Helpfulness' },
  { key: 'q5', heading: 'Recommendation', full: '5. Recommendation & NPS' }
];

/**
 * Mirrors the backend escalation rule (crmController.evaluateFeedbackEscalation,
 * lines 449-453) question by question, so an answer chip can never be coloured
 * differently from the sentiment the server actually recorded for this ticket.
 */
const isNegativeAnswer = (key: string, value: string): boolean => {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return false;
  if (key === 'q1') return v.includes('dissatisfied');
  if (key === 'q2') return v === 'no';
  if (key === 'q3' || key === 'q4') return v === 'poor' || v === 'very poor';
  if (key === 'q5') return v.includes('not recommend');
  return false;
};

const parseAnswers = (raw: any): Record<string, any> => {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

/**
 * A customer's actual answer, or '' when the question was skipped.
 * Empty must render as "Not answered" — never as a made-up rating.
 */
const answerOf = (answers: Record<string, any>, row: any, key: string): string => {
  const raw = answers?.[key] ?? row?.[key];
  if (raw === null || raw === undefined) return '';
  if (Array.isArray(raw)) return raw.filter(Boolean).join(', ').trim();
  return String(raw).trim();
};

/** Markers written by the kiosk when it compiles the free-text answers. */
const VOICE_MARKERS = [
  { marker: 'Liked Most:', label: 'Liked Most', Icon: ThumbsUp, tone: 'bg-emerald-50 border-emerald-200 text-emerald-900' },
  { marker: 'Can Improve:', label: 'Can Improve', Icon: Star, tone: 'bg-background border-accent-soft text-primary' },
  { marker: 'Comments:', label: 'Additional Comments', Icon: FileText, tone: 'bg-blue-50 border-blue-200 text-blue-900' },
  { marker: 'Voice:', label: 'Feedback Text', Icon: MessageSquare, tone: 'bg-background border-accent-soft text-primary' }
];

const splitVoice = (raw: string) => {
  const text = String(raw || '').trim();
  if (!text) return { hasMarkers: false, sections: [] as { label: string; text: string; Icon: any; tone: string }[] };

  const sections = VOICE_MARKERS.reduce<any[]>((acc, m) => {
    const start = text.indexOf(m.marker);
    if (start === -1) return acc;
    const after = text.slice(start + m.marker.length);
    const nextMarker = after.search(/\n(?:Liked Most:|Can Improve:|Comments:|Voice:)/);
    const value = (nextMarker === -1 ? after : after.slice(0, nextMarker)).trim();
    if (!value) return acc;
    acc.push({ label: m.label, text: value, Icon: m.Icon, tone: m.tone });
    return acc;
  }, []);

  return { hasMarkers: sections.length > 0, sections };
};

const storeOf = (f: any) => {
  const id = Number(f?.location_id);
  const code = String(f?.locationCode || '').toUpperCase();
  const match = STORES.find(s => (id > 0 && Number(s.locId) === id) || (code && s.code === code));
  if (match) return { ...match, name: f?.locationName || match.name };
  return {
    key: '',
    locId: String(id || ''),
    code: code || '—',
    name: f?.locationName || 'Store Not Recorded',
    dot: 'bg-gray-400',
    chip: 'bg-gray-50 text-gray-700 border-gray-200'
  };
};

/** Real derived percentage; '—' whenever there is nothing to divide by. */
const rate = (part: any, whole: any): string => {
  const p = Number(part);
  const w = Number(whole);
  if (!isFinite(p) || !isFinite(w) || w <= 0) return '—';
  return `${Math.round((p / w) * 100)}%`;
};

const toNumberOrNull = (v: any): number | null => {
  const n = Number(v);
  return isFinite(n) ? n : null;
};

/** Compact IST-safe date. Never renders "Invalid Date" for MySQL zero dates. */
const shortDate = (v: any): string => {
  const raw = String(v ?? '').trim();
  if (!raw || /^0{4}[-/]0{2}[-/]0{2}/.test(raw)) return '—';
  return formatDateDisplay(raw, '—');
};

const ticketRef = (id: any): string => {
  const raw = String(id ?? '');
  if (!raw) return '—';
  return raw.startsWith('FB-') ? raw : `FB-${raw}`;
};

/* ── Small presentational primitives (module scope: stable identity) ───── */

function StatusBadge({ status, className = '' }: { status: any; className?: string }) {
  const { label, Icon, className: tone } = followUpBadge(status);
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide ${tone} ${className}`}>
      <Icon className="w-3 h-3 shrink-0" />
      <span>{label}</span>
    </span>
  );
}

function SentimentBadge({ isNegative }: { isNegative: any }) {
  const negative = !!isNegative;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide ${
      negative ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
    }`}>
      {negative ? <ThumbsDown className="w-3 h-3 shrink-0" /> : <ThumbsUp className="w-3 h-3 shrink-0" />}
      <span>{negative ? 'Negative' : 'Positive'}</span>
    </span>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[9.5px] font-black uppercase tracking-wider text-[#8B6F76]">{label}</span>
      {children}
    </div>
  );
}

function EmptyHint({ icon: Icon, title, children }: { icon: any; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-accent-soft bg-background">
        <Icon className="h-5 w-5 text-[#9A858D]" />
      </div>
      <div className="text-sm font-extrabold text-primary">{title}</div>
      {children && <p className="max-w-md text-xs font-medium text-[#65716C]">{children}</p>}
    </div>
  );
}

export default function FeedbackCollection() {
  const navigate = useNavigate();
  const { currentLocation, setCurrentLocation, currentLocationLabel, canSwitch } = useLocationContext();

  // Feedbacks & stats (stats arrive already scoped to the active filters)
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ total: 0, positive: 0, negative: 0, needsFollowUp: 0 });
  // Deliberately empty by default: a store key that is absent from `byLocation`
  // means "no data available", and must render as '—' rather than a false 0.
  const [locationBreakdown, setLocationBreakdown] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [sentimentFilter, setSentimentFilter] = useState<string>('all');
  const [followUpFilter, setFollowUpFilter] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<string>('all');
  const [startDateInput, setStartDateInput] = useState<string>('');
  const [endDateInput, setEndDateInput] = useState<string>('');

  // Resolution desk modal
  const [selectedFeedback, setSelectedFeedback] = useState<any | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState<string>('called');
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [resolutionFollowUpDate, setResolutionFollowUpDate] = useState<string>('');
  const [savingResolution, setSavingResolution] = useState<boolean>(false);

  // Real follow-up history for the open ticket
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [historyError, setHistoryError] = useState<string>('');
  const [followUpHistory, setFollowUpHistory] = useState<any[] | null>(null);
  const [callQueueState, setCallQueueState] = useState<any | null>(null);
  const historyTokenRef = useRef<number>(0);

  const filtersActive =
    !!search.trim() || sentimentFilter !== 'all' || followUpFilter !== 'all' || datePreset !== 'all';

  const handleResetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setSentimentFilter('all');
    setFollowUpFilter('all');
    setDatePreset('all');
    setStartDateInput('');
    setEndDateInput('');
  };

  const getActiveLocationName = () => {
    const store = STORES.find(s => s.locId === String(currentLocation) || s.code === String(currentLocation).toUpperCase());
    return store ? store.name : (currentLocationLabel || 'Selected Store');
  };

  const getLocationBadgeText = () => {
    if (!currentLocation || currentLocation === 'ALL') return 'ALL STORES';
    const store = STORES.find(s => s.locId === String(currentLocation) || s.code === String(currentLocation).toUpperCase());
    if (store) return `Store: ${store.name} (${store.code})`;
    return `Store: ${currentLocationLabel || currentLocation}`;
  };

  const closeTicket = () => {
    historyTokenRef.current += 1;
    setSelectedFeedback(null);
  };

  const openTicket = async (f: any) => {
    setSelectedFeedback(f);
    setResolutionNotes(String(f?.actionTaken || f?.notes || ''));
    setResolutionStatus(toResolutionStatus(f?.status));
    setResolutionFollowUpDate('');

    const token = ++historyTokenRef.current;
    setFollowUpHistory(null);
    setCallQueueState(null);
    setHistoryError('');
    setHistoryLoading(true);
    try {
      const res = await API.getFeedbackFollowUpHistory(f.id);
      if (token !== historyTokenRef.current) return;
      setFollowUpHistory(Array.isArray(res?.history) ? res.history : []);
      setCallQueueState(res?.followUp || null);
    } catch (err: any) {
      if (token !== historyTokenRef.current) return;
      // The endpoint is store-scoped: another store's ticket answers 404.
      setHistoryError(err?.status === 404
        ? 'Follow-up history is not available for this ticket in the current store view.'
        : (err?.message || 'Follow-up history could not be loaded.'));
    } finally {
      if (token === historyTokenRef.current) setHistoryLoading(false);
    }
  };

  const handleSaveResolution = async (statusOverride?: string) => {
    if (!selectedFeedback) return;
    setSavingResolution(true);
    try {
      const notes = resolutionNotes.trim();
      const payload: any = {
        id: selectedFeedback.id,
        feedbackId: selectedFeedback.id,
        status: statusOverride || resolutionStatus
      };
      // Send only what the executive typed — an empty note stays empty in the log.
      if (notes) payload.notes = notes;
      if (resolutionFollowUpDate) payload.followUpDate = resolutionFollowUpDate;

      await API.updateCallQueue(payload);
      showToast('Follow-up update saved.', 'success');
      closeTicket();
      loadFeedbacks();
    } catch (err: any) {
      showToast('Failed to save follow-up: ' + (err?.message || 'Please try again'), 'error');
    } finally {
      setSavingResolution(false);
    }
  };

  const handleDeleteFeedback = async (id: string) => {
    if (!id) return;
    if (!window.confirm('Delete this feedback record permanently? This cannot be undone.')) return;
    try {
      await API.deleteFeedback(id);
      showToast('Feedback record deleted.', 'success');
      if (selectedFeedback?.id === id) closeTicket();
      loadFeedbacks();
    } catch (err: any) {
      showToast('Failed to delete feedback: ' + (err?.message || 'Please try again'), 'error');
    }
  };

  // NOTE: Clear Feedback authorisation is under separate review — behaviour untouched.
  const handleClearAllFeedbacks = async () => {
    const locMsg = currentLocation && currentLocation !== 'ALL' ? `for ${getActiveLocationName()}` : 'across all locations';
    if (!window.confirm(`Are you sure you want to permanently delete ALL feedback details ${locMsg}? This cannot be undone.`)) return;
    try {
      await API.clearAllFeedbacks(currentLocation && currentLocation !== 'ALL' ? currentLocation : undefined);
      showToast('All feedback details cleared', 'success');
      closeTicket();
      loadFeedbacks();
    } catch (err: any) {
      showToast('Failed to clear feedbacks: ' + (err?.message || 'Error'), 'error');
    }
  };

  const loadFeedbacks = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      // IST calendar-day boundaries come from the shared date utility.
      const iso = (ms: number) => formatISTDate(new Date(ms));
      const now = Date.now();
      const todayStr = iso(now);

      if (datePreset === 'today') {
        params.date = todayStr;
      } else if (datePreset === 'yesterday') {
        params.date = iso(now - 86400000);
      } else if (datePreset === 'week') {
        params.startDate = iso(now - 6 * 86400000);
        params.endDate = todayStr;
      } else if (datePreset === 'month') {
        const start = new Date();
        start.setDate(1);
        params.startDate = iso(start.getTime());
        params.endDate = todayStr;
      } else if (datePreset === 'last_month') {
        const nowD = new Date();
        const start = new Date(nowD.getFullYear(), nowD.getMonth() - 1, 1);
        const end = new Date(nowD.getFullYear(), nowD.getMonth(), 0);
        params.startDate = iso(start.getTime());
        params.endDate = iso(end.getTime());
      } else if (datePreset === 'custom') {
        if (startDateInput) params.startDate = startDateInput;
        if (endDateInput) params.endDate = endDateInput;
      }

      if (sentimentFilter === 'negative') params.isNegative = 'true';
      if (sentimentFilter === 'positive') params.isNegative = 'false';
      if (followUpFilter && followUpFilter !== 'all') params.followUp = followUpFilter;
      if (debouncedSearch) params.search = debouncedSearch;
      if (currentLocation && currentLocation !== 'ALL') params.location_id = currentLocation;

      const [res, statsRes] = await Promise.all([
        API.getFeedbacks(params),
        API.getFeedbackStats(currentLocation && currentLocation !== 'ALL' ? { location_id: currentLocation } : undefined)
          .catch(() => null)
      ]);

      if (res?.success) {
        setFeedbacks(res.feedbacks || []);
        if (res.stats) setStats(res.stats);
      }
      setLocationBreakdown(statsRes?.byLocation || {});
    } catch (err: any) {
      console.warn('getFeedbacks background sync:', err?.message || err);
    } finally {
      setLoading(false);
    }
  }, [datePreset, startDateInput, endDateInput, sentimentFilter, followUpFilter, debouncedSearch, currentLocation]);

  // Real-time automatic updates for feedback and callqueue sections
  useRealtimeSection(['feedback', 'callqueue'], () => {
    loadFeedbacks();
  });

  // Keep the latest loader behind a ref so the 8s poll is created once and is
  // never torn down by a keystroke or a filter change.
  const loadRef = useRef<() => void>(() => {});
  useEffect(() => {
    loadRef.current = () => { loadFeedbacks(); };
  }, [loadFeedbacks]);

  // Debounce the search box before it becomes a query dependency.
  useEffect(() => {
    const value = search.trim();
    if (value === debouncedSearch) return;
    const t = setTimeout(() => setDebouncedSearch(value), 350);
    return () => clearTimeout(t);
  }, [search, debouncedSearch]);

  // Route guard only — never a data dependency.
  useEffect(() => {
    if (!Auth.check()) navigate('/login', { replace: true });
  }, [navigate]);

  // Loads on mount and again whenever the query (filters / store) changes.
  useEffect(() => {
    if (!Auth.check()) return;
    loadFeedbacks();
  }, [loadFeedbacks]);

  // Stable 8s poll: reads the latest loader through a ref so changing a filter
  // or typing in the search box never tears down and recreates the interval.
  useEffect(() => {
    const interval = setInterval(() => loadRef.current(), 8000);
    return () => clearInterval(interval);
  }, []);

  const handleExportCSV = () => {
    if (feedbacks.length === 0) {
      showToast('No feedback records to export', 'error');
      return;
    }

    const headers = ['Feedback ID', 'Store Location', 'Date', 'Time', 'Customer Name', 'Mobile', 'Sentiment', 'Follow-up Status', 'Survey Answers', 'Customer Voice Notes'];
    const rows = feedbacks.map(f => {
      const store = storeOf(f);
      const answers = parseAnswers(f.answers);
      const answerSummary = SURVEY_QUESTIONS
        .map(q => `${q.heading}: ${answerOf(answers, f, q.key) || 'Not answered'}`)
        .join(' | ');

      return [
        `"${ticketRef(f.id)}"`,
        `"${store.name} (${store.code})"`,
        `"${f.entryDate || ''}"`,
        `"${f.entryTime || ''}"`,
        `"${String(f.customerName || 'Anonymous').replace(/"/g, '""')}"`,
        `"${(f.mobile || '').replace(/"/g, '""')}"`,
        f.isNegative ? 'Negative' : 'Positive',
        `"${String(f.status || 'not recorded')}"`,
        `"${answerSummary.replace(/"/g, '""')}"`,
        `"${(f.voice || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const activeStore = STORES.find(s => s.locId === String(currentLocation));
    const locSlug = activeStore ? activeStore.name.replace(/\s+/g, '_') : 'All_Stores';
    link.setAttribute('download', `BSC_Customer_Feedbacks_${locSlug}_${formatISTDate(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Exported ${feedbacks.length} feedback records (${locSlug}) to CSV`, 'success');
  };

  const total = toNumberOrNull(stats.total) ?? feedbacks.length;
  const positive = toNumberOrNull(stats.positive) ?? 0;
  const negative = toNumberOrNull(stats.negative) ?? 0;
  const needsFollowUp = toNumberOrNull(stats.needsFollowUp) ?? negative;
  const selectedAnswers = selectedFeedback ? parseAnswers(selectedFeedback.answers) : {};
  const selectedVoice = selectedFeedback ? splitVoice(selectedFeedback.voice) : { hasMarkers: false, sections: [] as any[] };

  return (
    <DashboardLayout title="Customer Feedback Collection & Analytics">
      <ToastContainer />
      <PageContainer maxWidth="full">
        <div className="space-y-4">

          {/* ── Header & actions ─────────────────────────────────────── */}
          <div className="card-glass flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="flex items-center gap-2 text-base font-black tracking-tight text-primary">
                  <MessageSquare className="h-4 w-4 text-accent" />
                  <span>Customer Feedback Repository</span>
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full border border-accent-soft bg-background px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-primary">
                  <MapPin className="h-2.5 w-2.5 text-accent" />
                  <span>{getLocationBadgeText()}</span>
                </span>
              </div>
              <p className="mt-1 text-[11px] font-medium leading-relaxed text-[#65716C]">
                Live survey responses, satisfaction scores and follow-up actions recorded by the in-store QR kiosks.
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                onClick={() => loadFeedbacks()}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-accent-soft bg-white px-3 py-1.5 text-xs font-extrabold text-primary transition-colors hover:bg-background"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              {feedbacks.length > 0 && (
                <button
                  onClick={handleClearAllFeedbacks}
                  title="Permanently remove feedback details"
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-extrabold text-rose-700 transition-colors hover:bg-rose-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Clear Feedback</span>
                </button>
              )}
              <button
                onClick={handleExportCSV}
                className="btn-gold inline-flex items-center gap-1.5 whitespace-nowrap text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* ── KPI strip (filtered result set) ──────────────────────── */}
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <div className="card-glass p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#65716C]">Total Feedbacks</span>
                <MessageSquare className="h-3.5 w-3.5 shrink-0 text-accent" />
              </div>
              <div className="mt-1 text-2xl font-black leading-none text-primary">{total}</div>
              <div className="mt-1 truncate text-[10.5px] font-semibold text-[#8B6F76]">
                {currentLocation && currentLocation !== 'ALL' ? getActiveLocationName() : 'All stores'}
                {filtersActive ? ' · filters applied' : ' · all submissions'}
              </div>
            </div>

            <div className="card-glass p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#65716C]">Satisfied</span>
                <ThumbsUp className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              </div>
              <div className="mt-1 text-2xl font-black leading-none text-emerald-700">{positive}</div>
              <div className="mt-1 truncate text-[10.5px] font-semibold text-[#8B6F76]">{rate(positive, total)} of this view</div>
            </div>

            <div className="card-glass p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#65716C]">Needs Follow-up</span>
                <ThumbsDown className="h-3.5 w-3.5 shrink-0 text-rose-600" />
              </div>
              <div className="mt-1 text-2xl font-black leading-none text-rose-700">{needsFollowUp}</div>
              <div className="mt-1 truncate text-[10.5px] font-semibold text-[#8B6F76]">Negative responses in this view</div>
            </div>

            <div className="card-glass p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#65716C]">Satisfaction Rate</span>
                <Star className="h-3.5 w-3.5 shrink-0 text-accent" />
              </div>
              <div className="mt-1 text-2xl font-black leading-none text-primary">{rate(positive, total)}</div>
              <div className="mt-1 truncate text-[10.5px] font-semibold text-[#8B6F76]">Positive ÷ total responses</div>
            </div>
          </div>

          {/* ── Store summary: one compact, clickable row (global viewers only) ── */}
          {canSwitch && (
          <div className="card-glass p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-primary">
                <MapPin className="h-3.5 w-3.5 text-accent" />
                <span>Store Performance</span>
              </div>
              {currentLocation !== 'ALL' && (
                <button
                  onClick={() => setCurrentLocation('ALL')}
                  className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-accent-soft bg-white px-2 py-1 text-[10px] font-black uppercase text-primary transition-colors hover:bg-background"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>All Stores</span>
                </button>
              )}
            </div>

            <div className="mt-2.5 grid grid-cols-1 gap-2.5 md:grid-cols-3">
              {STORES.map(store => {
                const entry = locationBreakdown[store.key];
                const known = !!entry;
                const isActive = String(currentLocation) === store.locId || String(currentLocation).toUpperCase() === store.code;
                const storeTotal = toNumberOrNull(entry?.total);
                const storePositive = toNumberOrNull(entry?.positive);
                const storeFollowUp = toNumberOrNull(entry?.needsFollowUp);

                return (
                  <button
                    key={store.key}
                    onClick={() => setCurrentLocation(store.locId)}
                    aria-pressed={isActive}
                    className={`flex min-w-0 flex-col gap-2 rounded-xl border bg-white p-3 text-left transition-colors hover:bg-background ${
                      isActive ? 'border-accent ring-1 ring-accent/30' : 'border-accent-soft'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${store.dot}`} />
                        <span className="truncate text-[11px] font-black uppercase tracking-wide text-primary">
                          {store.name} ({store.code})
                        </span>
                      </span>
                      {isActive && (
                        <span className="shrink-0 rounded-full bg-accent-soft px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-primary">Active</span>
                      )}
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 border-t border-accent-soft pt-2">
                      <div className="min-w-0">
                        <div className="truncate text-[9px] font-bold uppercase text-[#8B6F76]">Total</div>
                        <div className="text-sm font-black text-primary">{known ? (storeTotal ?? 0) : '—'}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[9px] font-bold uppercase text-[#8B6F76]">Positive</div>
                        <div className="text-sm font-black text-emerald-700">{known ? (storePositive ?? 0) : '—'}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[9px] font-bold uppercase text-[#8B6F76]">Follow-up</div>
                        <div className="text-sm font-black text-rose-700">{known ? (storeFollowUp ?? 0) : '—'}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[9px] font-bold uppercase text-[#8B6F76]">Satisfied</div>
                        <div className="text-sm font-black text-primary">{known ? rate(storePositive, storeTotal) : '—'}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {currentLocation !== 'ALL' && (
              <p className="mt-2 text-[10.5px] font-medium text-[#8B6F76]">
                Per-store figures are only published for the selected store — the others show “—” rather than a zero.
              </p>
            )}
          </div>
          )}

          {/* ── Unified filter bar ───────────────────────────────────── */}
          <div className="card-glass p-3.5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
              <FilterField label="Search">
                <div className="relative w-full xl:w-[280px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9A858D]" />
                  <input
                    type="text"
                    placeholder="Name, mobile or feedback text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="input-modern py-2 text-xs font-semibold"
                    aria-label="Search customer feedback"
                  />
                </div>
              </FilterField>

              {canSwitch && (
                <FilterField label="Store">
                  <select
                    value={currentLocation}
                    onChange={(e) => setCurrentLocation(e.target.value)}
                    className="select-modern py-2 text-xs font-bold xl:w-[170px]"
                    aria-label="Filter by store"
                  >
                    <option value="ALL">All Stores</option>
                    {STORES.map(s => (
                      <option key={s.locId} value={s.locId}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                </FilterField>
              )}

              <FilterField label="Sentiment">
                <select
                  value={sentimentFilter}
                  onChange={(e) => setSentimentFilter(e.target.value)}
                  className="select-modern py-2 text-xs font-bold xl:w-[150px]"
                  aria-label="Filter by sentiment"
                >
                  <option value="all">All Sentiments</option>
                  <option value="positive">Positive</option>
                  <option value="negative">Negative</option>
                </select>
              </FilterField>

              <FilterField label="Follow-up">
                <select
                  value={followUpFilter}
                  onChange={(e) => setFollowUpFilter(e.target.value)}
                  className="select-modern py-2 text-xs font-bold xl:w-[175px]"
                  aria-label="Filter by follow-up status"
                >
                  {FOLLOW_UP_FILTERS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Date Range">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={datePreset}
                    onChange={(e) => setDatePreset(e.target.value)}
                    className="select-modern py-2 text-xs font-bold w-[150px]"
                    aria-label="Filter by date range"
                  >
                    {DATE_PRESETS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  {datePreset === 'custom' && (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="date"
                        value={startDateInput}
                        max={endDateInput || undefined}
                        onChange={(e) => setStartDateInput(e.target.value)}
                        className="input-modern py-2 text-xs font-semibold w-[142px]"
                        aria-label="Start date"
                      />
                      <span className="text-[11px] font-bold text-[#8B6F76]">to</span>
                      <input
                        type="date"
                        value={endDateInput}
                        min={startDateInput || undefined}
                        onChange={(e) => setEndDateInput(e.target.value)}
                        className="input-modern py-2 text-xs font-semibold w-[142px]"
                        aria-label="End date"
                      />
                    </div>
                  )}
                </div>
              </FilterField>

              <div className="flex items-center gap-2 xl:ml-auto">
                <span className="hidden items-center gap-1 text-[10px] font-black uppercase tracking-wider text-[#8B6F76] sm:inline-flex">
                  <Filter className="h-3 w-3" />
                  <span>{filtersActive ? 'Filters applied' : 'No filters'}</span>
                </span>
                <button
                  onClick={handleResetFilters}
                  disabled={!filtersActive}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-accent-soft bg-white px-3 py-2 text-xs font-extrabold text-primary transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset Filters</span>
                </button>
              </div>
            </div>
          </div>

          {/* ── Feedback log ─────────────────────────────────────────── */}
          <div className="card-glass p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-accent-soft pb-2.5">
              <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-primary">
                <MessageSquare className="h-3.5 w-3.5 text-accent" />
                <span>Survey Log ({feedbacks.length})</span>
              </h3>
              <span className="text-[11px] font-semibold text-[#65716C]">
                {positive} positive · {negative} negative · refreshed automatically
              </span>
            </div>

            {loading ? (
              <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                <RefreshCw className="h-6 w-6 animate-spin text-accent" />
                <div className="text-sm font-extrabold text-primary">Loading feedback entries…</div>
                <p className="text-xs font-medium text-[#8B6F76]">Fetching the latest kiosk responses.</p>
              </div>
            ) : feedbacks.length === 0 ? (
              <EmptyHint
                icon={MessageSquare}
                title={filtersActive
                  ? 'No feedback matches these filters'
                  : (currentLocation && currentLocation !== 'ALL'
                    ? `No feedback submitted at ${getActiveLocationName()} yet`
                    : 'No feedback submitted yet')}
              >
                {filtersActive
                  ? 'Try widening the date range or resetting the filters above.'
                  : 'Responses from the Customer Experience Survey will appear here in real time.'}
              </EmptyHint>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden table-frame custom-scrollbar md:block">
                  <table className="w-full min-w-[1080px] border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-accent-soft bg-background text-[10px] font-black uppercase tracking-wider text-[#65716C]">
                        <th className="whitespace-nowrap px-3 py-2.5">Date &amp; Time</th>
                        <th className="whitespace-nowrap px-3 py-2.5">Store</th>
                        <th className="whitespace-nowrap px-3 py-2.5">Customer</th>
                        <th className="whitespace-nowrap px-3 py-2.5">Experience</th>
                        <th className="whitespace-nowrap px-3 py-2.5">Product Found</th>
                        <th className="whitespace-nowrap px-3 py-2.5">Sentiment</th>
                        <th className="whitespace-nowrap px-3 py-2.5">Follow-up</th>
                        <th className="whitespace-nowrap px-3 py-2.5">Voice of Customer</th>
                        <th className="w-[190px] whitespace-nowrap border-l border-accent-soft px-3 py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-accent-soft">
                      {feedbacks.map((f: any) => {
                        const answers = parseAnswers(f.answers);
                        const store = storeOf(f);
                        const overall = answerOf(answers, f, 'q1');
                        const found = answerOf(answers, f, 'q2');

                        return (
                          <tr
                            key={f.id}
                            onClick={(e) => {
                              // Nested controls keep their own behaviour; a bare row click opens the ticket.
                              if ((e.target as HTMLElement).closest('a,button,input,select,textarea')) return;
                              openTicket(f);
                            }}
                            className="cursor-pointer align-top transition-colors hover:bg-accent-soft/60"
                          >
                            <td className="px-3 py-3">
                              <div className="whitespace-nowrap font-mono text-[11px] font-bold text-primary">{shortDate(f.entryDate)}</div>
                              {f.entryTime && (
                                <div className="mt-0.5 flex items-center gap-1 whitespace-nowrap text-[10.5px] font-semibold text-[#8B6F76]">
                                  <Clock className="h-3 w-3 shrink-0 text-accent" />
                                  <span>{String(f.entryTime)}</span>
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10.5px] font-black uppercase tracking-wide ${store.chip}`}>
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span>{store.name} ({store.code})</span>
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-1.5 font-extrabold text-primary">
                                <User className="h-3.5 w-3.5 shrink-0 text-accent" />
                                <span className="truncate">{f.customerName || 'Anonymous'}</span>
                              </div>
                              {f.mobile ? (
                                <div className="mt-0.5 flex items-center gap-1 whitespace-nowrap font-mono text-[10.5px] font-semibold text-[#8B6F76]">
                                  <Phone className="h-3 w-3 shrink-0" />
                                  <span>{f.mobile}</span>
                                </div>
                              ) : (
                                <div className="mt-0.5 text-[10.5px] font-semibold text-[#9A858D]">Mobile not provided</div>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              {overall ? (
                                <span className={`inline-block max-w-[150px] truncate rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                                  isNegativeAnswer('q1', overall) ? 'bg-rose-50 text-rose-800' : 'bg-accent-soft text-primary'
                                }`} title={overall}>
                                  {overall}
                                </span>
                              ) : (
                                <span className="text-[11px] font-semibold text-[#9A858D]">Not answered</span>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              {found ? (
                                <span className="text-[11px] font-bold text-[#17201D]" title={found}>{found}</span>
                              ) : (
                                <span className="text-[11px] font-semibold text-[#9A858D]">Not answered</span>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <SentimentBadge isNegative={f.isNegative} />
                            </td>
                            <td className="px-3 py-3">
                              <StatusBadge status={f.status} />
                            </td>
                            <td className="max-w-[240px] px-3 py-3">
                              <p className="truncate text-[11px] font-medium leading-relaxed text-[#5D4E42]" title={f.voice || ''}>
                                {f.voice ? f.voice : <span className="text-[#9A858D]">No written comments</span>}
                              </p>
                            </td>
                            <td className="w-[190px] border-l border-accent-soft px-3 py-3 text-right align-middle">
                              <div className="inline-flex flex-nowrap items-center justify-end gap-1.5">
                                <button
                                  onClick={() => openTicket(f)}
                                  className="shrink-0 whitespace-nowrap rounded-xl border border-primary px-2.5 py-1.5 text-[11px] font-extrabold text-primary transition-colors hover:bg-primary hover:text-white"
                                >
                                  <span className="inline-flex items-center gap-1">
                                    <Eye className="h-3.5 w-3.5" /> View Ticket
                                  </span>
                                </button>
                                <button
                                  onClick={() => handleDeleteFeedback(f.id)}
                                  title="Delete this feedback record"
                                  className="shrink-0 whitespace-nowrap rounded-xl border border-rose-200 p-1.5 text-rose-600 transition-colors hover:bg-rose-600 hover:text-white"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="space-y-2.5 md:hidden">
                  {feedbacks.map((f: any) => {
                    const answers = parseAnswers(f.answers);
                    const store = storeOf(f);
                    const overall = answerOf(answers, f, 'q1');
                    const found = answerOf(answers, f, 'q2');

                    return (
                      <div
                        key={f.id}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('a,button,input,select,textarea')) return;
                          openTicket(f);
                        }}
                        className="cursor-pointer space-y-2.5 rounded-xl border border-accent-soft bg-white p-3.5 active:bg-accent-soft/50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${store.chip}`}>
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span>{store.name} ({store.code})</span>
                          </span>
                          <span className="whitespace-nowrap text-[10px] font-semibold text-[#8B6F76]">
                            {shortDate(f.entryDate)}{f.entryTime ? ` · ${String(f.entryTime)}` : ''}
                          </span>
                        </div>

                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 truncate text-sm font-extrabold text-primary">
                              <User className="h-3.5 w-3.5 shrink-0 text-accent" />
                              <span className="truncate">{f.customerName || 'Anonymous'}</span>
                            </div>
                            {f.mobile && (
                              <a
                                href={`tel:${f.mobile}`}
                                className="mt-0.5 inline-flex items-center gap-1 font-mono text-[11px] font-bold text-primary hover:underline"
                              >
                                <Phone className="h-3 w-3 shrink-0" />
                                <span>{f.mobile}</span>
                              </a>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <SentimentBadge isNegative={f.isNegative} />
                            <StatusBadge status={f.status} />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="max-w-full truncate rounded-md bg-primary/5 px-2 py-0.5 text-[10px] font-bold text-primary">
                            Experience: {overall || 'Not answered'}
                          </span>
                          <span className="max-w-full truncate rounded-md bg-primary/5 px-2 py-0.5 text-[10px] font-bold text-primary">
                            Found: {found || 'Not answered'}
                          </span>
                        </div>

                        <p className="truncate text-[11px] font-medium text-[#5D4E42]">
                          {f.voice ? `“${f.voice}”` : <span className="text-[#9A858D]">No written comments</span>}
                        </p>

                        <div className="flex items-center justify-end gap-2 border-t border-accent-soft pt-2">
                          <button
                            onClick={() => openTicket(f)}
                            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl border border-primary px-3 py-1.5 text-xs font-extrabold text-primary transition-colors hover:bg-primary hover:text-white"
                          >
                            <Eye className="h-3.5 w-3.5" /> View Ticket
                          </button>
                          <button
                            onClick={() => handleDeleteFeedback(f.id)}
                            title="Delete this feedback record"
                            className="shrink-0 rounded-xl border border-rose-200 p-1.5 text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* ── Ticket / resolution desk ─────────────────────────────── */}
          <ModalPortal
            isOpen={!!selectedFeedback}
            onClose={closeTicket}
            ariaLabel="Customer Feedback Ticket"
          >
            {selectedFeedback && (
              <div className="card-glass max-h-[92vh] w-full max-w-4xl space-y-5 overflow-y-auto rounded-2xl border border-black/40 bg-white p-5 text-primary sm:p-6">

                {/* Header */}
                <div className="flex items-start justify-between gap-4 border-b border-accent-soft pb-4">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <SentimentBadge isNegative={selectedFeedback.isNegative} />
                      <StatusBadge status={selectedFeedback.status} />
                      <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10.5px] font-black uppercase tracking-wide ${storeOf(selectedFeedback).chip}`}>
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span>{storeOf(selectedFeedback).name} ({storeOf(selectedFeedback).code})</span>
                      </span>
                    </div>

                    <h2 className="truncate text-xl font-black tracking-tight text-primary">
                      {selectedFeedback.customerName || 'Anonymous Customer'}
                    </h2>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5 text-[11px] font-semibold text-[#65716C]">
                      <span className="inline-flex items-center gap-1 font-mono">
                        <Hash className="h-3 w-3 shrink-0 text-accent" />
                        <span>{ticketRef(selectedFeedback.id)}</span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3 shrink-0 text-accent" />
                        <span>{shortDate(selectedFeedback.entryDate)}{selectedFeedback.entryTime ? ` · ${String(selectedFeedback.entryTime)}` : ''}</span>
                      </span>
                      {selectedFeedback.mobile ? (
                        <a href={`tel:${selectedFeedback.mobile}`} className="inline-flex items-center gap-1 font-mono font-bold text-primary hover:underline">
                          <Phone className="h-3 w-3 shrink-0 text-accent" />
                          <span>{selectedFeedback.mobile}</span>
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3 shrink-0 text-[#9A858D]" />
                          <span className="text-[#9A858D]">Mobile not provided</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={closeTicket}
                    title="Close"
                    className="shrink-0 rounded-xl bg-gray-100 p-2 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-900"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Escalation notice — reflects the real status, never an assumed one */}
                {selectedFeedback.isNegative && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-3.5">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <div className="shrink-0 rounded-xl bg-rose-600 p-2 text-white">
                        <TriangleAlert className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10.5px] font-black uppercase tracking-wider text-rose-900">Negative Feedback</div>
                        <p className="mt-0.5 text-[11px] font-semibold leading-relaxed text-rose-800">
                          This response was flagged for follow-up. Record the outcome below so the store team can track it.
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={selectedFeedback.status} className="shrink-0" />
                  </div>
                )}

                {/* Survey responses */}
                <div className="space-y-2">
                  <h4 className="flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-wider text-primary">
                    <FileText className="h-3.5 w-3.5 text-accent" />
                    <span>Survey Responses</span>
                  </h4>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {SURVEY_QUESTIONS.map(q => {
                      const value = answerOf(selectedAnswers, selectedFeedback, q.key);
                      return (
                        <div key={q.key} className="flex items-center justify-between gap-3 rounded-xl border border-accent-soft bg-white px-3 py-2.5">
                          <span className="min-w-0 truncate text-[11px] font-bold uppercase tracking-wide text-[#65716C]" title={q.full}>
                            {q.full}
                          </span>
                          {value ? (
                            <span className={`shrink-0 whitespace-nowrap rounded-lg border px-2.5 py-1 text-[11px] font-extrabold ${
                              isNegativeAnswer(q.key, value) ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-accent-soft bg-accent-soft text-primary'
                            }`}>
                              {value}
                            </span>
                          ) : (
                            <span className="shrink-0 whitespace-nowrap text-[11px] font-semibold text-[#9A858D]">Not answered</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Voice of customer */}
                <div className="space-y-2">
                  <h4 className="flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-wider text-primary">
                    <MessageSquare className="h-3.5 w-3.5 text-accent" />
                    <span>Voice of Customer</span>
                  </h4>

                  {!selectedFeedback.voice ? (
                    <div className="rounded-xl border border-accent-soft bg-background px-3 py-4 text-center text-[11px] font-semibold text-[#9A858D]">
                      The customer did not leave any written comments.
                    </div>
                  ) : !selectedVoice.hasMarkers ? (
                    <div className="rounded-xl border border-accent-soft bg-white px-3.5 py-3">
                      <div className="text-[9.5px] font-black uppercase tracking-wider text-[#8B6F76]">Customer’s Words</div>
                      <p className="mt-1 whitespace-pre-line text-xs font-semibold leading-relaxed text-[#17201D]">{selectedFeedback.voice}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
                      {selectedVoice.sections.map((section: any, idx: number) => (
                        <div key={idx} className={`space-y-1 rounded-xl border p-3 ${section.tone}`}>
                          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider">
                            <section.Icon className="h-3.5 w-3.5 shrink-0" />
                            <span>{section.label}</span>
                          </div>
                          <p className="whitespace-pre-line break-words text-xs font-semibold leading-relaxed">{section.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Real follow-up history */}
                <div className="space-y-2 border-t border-accent-soft pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-wider text-primary">
                      <History className="h-3.5 w-3.5 text-accent" />
                      <span>Follow-up Activity</span>
                    </h4>
                    {callQueueState && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] font-semibold text-[#65716C]">
                        <span className="inline-flex items-center gap-1">
                          <span className="font-black uppercase tracking-wide text-[#8B6F76]">Status</span>
                          <StatusBadge status={callQueueState.status} />
                        </span>
                        <span>
                          <span className="font-black uppercase tracking-wide text-[#8B6F76]">Attempts</span>{' '}
                          {callQueueState.attempts === null || callQueueState.attempts === undefined ? '—' : Number(callQueueState.attempts)}
                        </span>
                        {callQueueState.updatedAt && (
                          <span>{formatDateTimeDisplay(callQueueState.updatedAt, '—')}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {historyLoading ? (
                    <div className="flex items-center gap-2 rounded-xl border border-accent-soft bg-background px-3 py-4 text-[11px] font-bold text-[#65716C]">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-accent" />
                      <span>Loading follow-up history…</span>
                    </div>
                  ) : historyError ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-[11px] font-semibold text-rose-800">
                      {historyError}
                    </div>
                  ) : !followUpHistory || followUpHistory.length === 0 ? (
                    <div className="rounded-xl border border-accent-soft bg-background px-3 py-5 text-center">
                      <div className="text-[11px] font-extrabold text-primary">No follow-up activity recorded yet</div>
                      <p className="mt-0.5 text-[10.5px] font-medium text-[#8B6F76]">
                        Saving a note below creates the first entry in this ticket’s history.
                      </p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-accent-soft overflow-hidden rounded-xl border border-accent-soft">
                      {followUpHistory.map((log: any) => {
                        const when = log.callDate
                          ? shortDate(log.callDate)
                          : formatDateTimeDisplay(log.createdAt, '—');
                        return (
                          <li key={log.id || `${log.feedbackId}-${log.createdAt}`} className="bg-white px-3 py-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="text-[11px] font-extrabold text-primary">{log.callOutcome || 'Follow-up Entry'}</span>
                                {log.issueCategory && (
                                  <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-wide text-primary">{log.issueCategory}</span>
                                )}
                                <span className="text-[10.5px] font-semibold text-[#8B6F76]">{log.executive || 'Unnamed executive'}</span>
                              </div>
                              <span className="whitespace-nowrap text-[10.5px] font-semibold text-[#8B6F76]">{when}</span>
                            </div>
                            {log.notes && (
                              <p className="mt-1 whitespace-pre-line break-words text-[11px] font-medium leading-relaxed text-[#5D4E42]">{log.notes}</p>
                            )}
                            {log.followUpDate && (
                              <div className="mt-1 text-[10.5px] font-bold text-amber-700">Next follow-up: {shortDate(log.followUpDate)}</div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {/* Resolution workspace */}
                <div className="space-y-3 rounded-2xl border border-accent-soft bg-background p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-wider text-primary">
                      <UserCheck className="h-3.5 w-3.5 text-accent" />
                      <span>Record Follow-up Action</span>
                    </h4>
                    <span className="text-[10px] font-semibold text-[#8B6F76]">Logged against {ticketRef(selectedFeedback.id)}</span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FilterField label="Action Status">
                      <select
                        value={resolutionStatus}
                        onChange={(e) => setResolutionStatus(e.target.value)}
                        className="select-modern bg-white py-2 text-xs font-bold"
                        aria-label="Follow-up action status"
                      >
                        {RESOLUTION_STATUSES.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </FilterField>

                    <FilterField label="Next Follow-up Date (optional)">
                      <input
                        type="date"
                        value={resolutionFollowUpDate}
                        onChange={(e) => setResolutionFollowUpDate(e.target.value)}
                        className="input-modern bg-white py-2 text-xs font-semibold"
                        aria-label="Next follow-up date"
                      />
                    </FilterField>
                  </div>

                  <FilterField label="Resolution Notes">
                    <textarea
                      rows={3}
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      placeholder="Call outcome, explanation given, voucher issued…"
                      className="textarea-modern bg-white text-xs font-medium"
                    />
                  </FilterField>

                  <p className="text-[10.5px] font-medium leading-relaxed text-[#8B6F76]">
                    Notes are optional. A history entry is written only when notes are provided; the status change always saves.
                  </p>
                </div>

                {/* Footer actions */}
                <div className="flex flex-col items-center justify-between gap-2.5 border-t border-accent-soft pt-4 sm:flex-row">
                  <div className="flex w-full items-center gap-2 sm:w-auto">
                    <button
                      onClick={closeTicket}
                      className="w-full whitespace-nowrap rounded-xl border border-accent-soft bg-white px-4 py-2 text-xs font-extrabold text-primary transition-colors hover:bg-background sm:w-auto"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => handleDeleteFeedback(selectedFeedback.id)}
                      title="Permanently delete this ticket"
                      className="inline-flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-extrabold text-rose-700 transition-colors hover:bg-rose-100 sm:w-auto"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete Ticket</span>
                    </button>
                  </div>

                  <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
                    <button
                      onClick={() => handleSaveResolution('escalated_manager')}
                      disabled={savingResolution}
                      className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-accent-soft bg-white px-3.5 py-2 text-xs font-extrabold text-primary transition-colors hover:bg-background disabled:opacity-50"
                    >
                      <ShieldAlert className="h-3.5 w-3.5 text-purple-700" />
                      <span>Escalate to Manager</span>
                    </button>

                    <button
                      onClick={() => handleSaveResolution('resolved')}
                      disabled={savingResolution}
                      className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-accent-soft bg-white px-3.5 py-2 text-xs font-extrabold text-primary transition-colors hover:bg-background disabled:opacity-50"
                    >
                      <CircleCheck className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Mark Resolved</span>
                    </button>

                    <button
                      onClick={() => handleSaveResolution()}
                      disabled={savingResolution}
                      className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-primary px-4 py-2 text-xs font-extrabold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>{savingResolution ? 'Saving…' : `Save as ${followUpBadge(resolutionStatus).label}`}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </ModalPortal>
        </div>
      </PageContainer>
    </DashboardLayout>
  );
}
