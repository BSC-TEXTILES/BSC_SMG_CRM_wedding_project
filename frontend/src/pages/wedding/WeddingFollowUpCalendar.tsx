import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import PageContainer from '../../components/ui/PageContainer';
import ToastContainer, { showToast } from '../../components/Toast';
import { API, Auth, UserSession } from '../../services/api';
import WeddingNav from './WeddingNav';
import { getStatusBadge } from './weddingTypes';
import LocationFilterSelect from '../../components/ui/LocationFilterSelect';
import { useRealtimeSection } from '../../hooks/useRealtimeSection';
import { dateKey, formatDateDisplay } from '../../utils/dateUtils';
import {
  Calendar as CalendarIcon,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Eye,
  Heart,
  PhoneCall,
  PhoneForwarded,
  ShoppingBag,
  Store
} from 'lucide-react';

/** Every CRM event kind the calendar can render, derived from real customer fields. */
type WeddingEventType =
  | 'Wedding Date'
  | 'Shopping Date'
  | 'Follow-up'
  | 'Call'
  | 'Callback'
  | 'Visit'
  | 'Shopping Confirmed';

interface WeddingEvent {
  key: string;
  date: string;               // 'YYYY-MM-DD' bucket key produced by dateKey()
  type: WeddingEventType;
  customerId: number;
  customerName: string;
  customerCode: string;
  mobile: string;
  locationName: string;
  customerStatus: string;
  assignedTelecaller?: string;
  time?: string;
  detail?: string;
  eventStatus?: string;
}

/**
 * Type metadata. `group` is the event-type filter family, colours reuse the
 * existing Wedding CRM brand system (see weddingTypes.getStatusBadge).
 */
const EVENT_TYPE_META: Record<
  WeddingEventType,
  { group: string; dot: string; chip: string; icon: any }
> = {
  'Wedding Date': {
    group: 'wedding',
    dot: 'bg-[#B76E79]',
    chip: 'bg-[#F6E2E5] text-[#4A173A] border-[#B76E79]/40',
    icon: Heart
  },
  'Shopping Date': {
    group: 'shopping',
    dot: 'bg-[#6A2853]',
    chip: 'bg-[#EDE7F6] text-[#6A2853] border-[#6A2853]/30',
    icon: ShoppingBag
  },
  'Follow-up': {
    group: 'followup',
    dot: 'bg-[#4A173A]',
    chip: 'bg-[#F6E2E5] text-[#4A173A] border-[#4A173A]/30',
    icon: CalendarDays
  },
  'Call': {
    group: 'call',
    dot: 'bg-[#C58A18]',
    chip: 'bg-[#FFF4D6] text-[#C58A18] border-[#C58A18]/30',
    icon: PhoneCall
  },
  'Callback': {
    group: 'callback',
    dot: 'bg-[#B42318]',
    chip: 'bg-[#FDE8E7] text-[#B42318] border-[#B42318]/25',
    icon: PhoneForwarded
  },
  'Visit': {
    group: 'visit',
    dot: 'bg-[#198754]',
    chip: 'bg-[#E8F5EE] text-[#198754] border-[#198754]/30',
    icon: Store
  },
  'Shopping Confirmed': {
    group: 'confirmed',
    dot: 'bg-[#C9A45C]',
    chip: 'bg-[#FFF7F2] text-[#8A6D3B] border-[#C9A45C]/40',
    icon: CircleCheck
  }
};

const EVENT_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Events' },
  { value: 'wedding', label: 'Wedding Date' },
  { value: 'shopping', label: 'Shopping Date' },
  { value: 'call', label: 'Calls' },
  { value: 'followup', label: 'Follow-ups' },
  { value: 'visit', label: 'Visits' },
  { value: 'callback', label: 'Callbacks' },
  { value: 'confirmed', label: 'Shopping Confirmed' }
];

const TYPE_ORDER = Object.keys(EVENT_TYPE_META) as WeddingEventType[];

/** filter value -> the event type whose dot is shown on that chip */
const GROUP_TO_TYPE = TYPE_ORDER.reduce((acc: Record<string, WeddingEventType>, t) => {
  acc[EVENT_TYPE_META[t].group] = t;
  return acc;
}, {});

// API page size used when scanning the location's customers (not a result count).
const CUSTOMER_PAGE_SIZE = 1000;
// Guards against a malformed pagination response looping forever.
const MAX_CUSTOMER_PAGES = 10;

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/** Mirrors WeddingCustomerRegister / WeddingCrmDashboard location-access logic. */
function isGlobalViewer() {
  const sess = Auth.get();
  const isAdminRole = ['Admin', 'Super Admin', 'system administrator'].includes(sess?.role || '');
  return isAdminRole && (!sess?.locationId || sess?.isGlobalAdmin === true);
}

/** One event record per customer field, carrying the identity the card needs. */
function buildEvent(customer: any, date: string, type: WeddingEventType, extra: Partial<WeddingEvent> = {}): WeddingEvent {
  return {
    key: `${type}:${customer.id}:${date}`,
    date,
    type,
    customerId: Number(customer.id),
    customerName: customer.customer_name || 'Unnamed customer',
    customerCode: customer.customer_code || `ID #${customer.id}`,
    mobile: customer.mobile_number ? String(customer.mobile_number) : '',
    locationName: customer.location_name || customer.location_code || 'Store',
    customerStatus: customer.customer_status || '',
    assignedTelecaller: customer.assigned_telecaller || undefined,
    ...extra
  };
}

export default function WeddingFollowUpCalendar() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(() => Auth.get());

  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'list'>('month');

  const [events, setEvents] = useState<WeddingEvent[]>([]);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  // Only the very first load swaps the whole panel out; later loads (month /
  // location / real-time refresh) keep the grid on screen.
  const [initialised, setInitialised] = useState(false);

  // Filter - initialized from persistent selection
  const [locationFilter, setLocationFilter] = useState<number | ''>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('bsc_selected_location') : null;
    return saved && saved !== 'ALL' ? Number(saved) : '';
  });
  // Event-type filter ('all' or one of the EVENT_FILTERS values)
  const [eventFilter, setEventFilter] = useState<string>('all');

  const customersCacheRef = useRef<{ key: string; customers: any[] } | null>(null);

  // Listen to global location changes (e.g. from Topbar), clamped for branch users
  useEffect(() => {
    const handleLocationChange = (e: any) => {
      if (!isGlobalViewer()) {
        const sess = Auth.get();
        if (sess?.locationId) setLocationFilter(sess.locationId);
        return;
      }
      const newLoc = e?.detail?.locationId;
      const parsed = newLoc && newLoc !== 'ALL' ? Number(newLoc) : '';
      setLocationFilter(parsed);
    };
    window.addEventListener('bsc_location_changed', handleLocationChange);
    return () => window.removeEventListener('bsc_location_changed', handleLocationChange);
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const todayKey = dateKey(new Date());
  const effectiveLoc = locationFilter !== '' ? locationFilter : undefined;

  /** Every date-carrying field on the customer payload becomes its own event. */
  const buildCustomerEvents = useCallback((customers: any[]): WeddingEvent[] => {
    const out: WeddingEvent[] = [];
    const add = (c: any, raw: any, type: WeddingEventType, extra: Partial<WeddingEvent> = {}) => {
      // dateKey() returns '' for NULL, MySQL '0000-00-00' and unparseable strings,
      // so "Invalid Date" can never reach the grid.
      const day = dateKey(raw);
      if (!day) return;
      out.push(buildEvent(c, day, type, extra));
    };

    (customers || []).forEach((c: any) => {
      add(c, c.wedding_date, 'Wedding Date');
      add(c, c.expected_shopping_date, 'Shopping Date');
      add(c, c.follow_up_date, 'Follow-up', { time: c.preferred_call_time || undefined });
      add(c, c.last_call_date, 'Call', {
        detail: c.last_call_outcome ? `Outcome: ${c.last_call_outcome}` : undefined
      });
      if (c.call_status === 'Call Back Requested') {
        add(c, c.follow_up_date, 'Callback', { time: c.preferred_call_time || undefined });
      }
      if (c.customer_status === 'Shopping Date Confirmed') {
        add(c, c.expected_shopping_date, 'Shopping Confirmed');
      }
    });
    return out;
  }, []);

  /**
   * Store visits & shopping appointments come from the extended calendar endpoint
   * (wedding_visits + wedding_appointments in one request) and are enriched from
   * the loaded customer list, so no phantom customer is ever rendered.
   */
  const buildVisitEvents = useCallback((rows: any[], customers: any[]): WeddingEvent[] => {
    const byId: Record<string, any> = {};
    (customers || []).forEach((c: any) => { byId[String(c.id)] = c; });

    const out: WeddingEvent[] = [];
    (rows || []).forEach((r: any) => {
      if (r.event_type !== 'appointment' && r.event_type !== 'visit') return;
      const c = byId[String(r.customer_id)];
      if (!c) return;
      const day = dateKey(r.date);
      if (!day) return;
      const isAppt = r.event_type === 'appointment';
      out.push(
        buildEvent(c, day, 'Visit', {
          key: `Visit:${c.id}:${day}:${r.id}`,
          time: r.time ? String(r.time) : undefined,
          detail: r.purpose || (isAppt ? 'Shopping appointment' : 'Store visit'),
          eventStatus: r.appointment_status || r.visit_status || undefined
        })
      );
    });
    return out;
  }, []);

  const fetchCustomers = useCallback(async (force = false): Promise<any[]> => {
    const cacheKey = effectiveLoc === undefined ? 'ALL' : String(effectiveLoc);
    if (!force && customersCacheRef.current && customersCacheRef.current.key === cacheKey) {
      return customersCacheRef.current.customers;
    }

    const collected: any[] = [];
    let page = 1;
    while (page <= MAX_CUSTOMER_PAGES) {
      const params: any = { limit: CUSTOMER_PAGE_SIZE, page };
      if (effectiveLoc !== undefined) params.location_id = effectiveLoc;
      const res = await API.getWeddingCustomers(params);
      const rows = Array.isArray(res?.customers) ? res.customers : [];
      collected.push(...rows);
      const total = Number(res?.pagination?.total) || rows.length;
      if (rows.length === 0 || collected.length >= total) break;
      page += 1;
    }

    customersCacheRef.current = { key: cacheKey, customers: collected };
    return collected;
  }, [effectiveLoc]);

  const loadCalendar = useCallback(async (options: { forceCustomers?: boolean } = {}) => {
    setLoading(true);
    try {
      const customers = await fetchCustomers(Boolean(options.forceCustomers));

      let visitRows: any[] = [];
      try {
        const extRes = await API.getWeddingExtendedCalendar(year, month + 1, effectiveLoc);
        visitRows = Array.isArray(extRes?.events) ? extRes.events : [];
      } catch {
        visitRows = [];
      }

      setEvents([...buildCustomerEvents(customers), ...buildVisitEvents(visitRows, customers)]);
    } catch (err: any) {
      showToast('Error loading CRM calendar: ' + (err.message || 'Server error'), 'error');
    } finally {
      setLoading(false);
      setInitialised(true);
    }
  }, [year, month, effectiveLoc, fetchCustomers, buildCustomerEvents, buildVisitEvents]);

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    const sess = Auth.get();
    setSession(sess);
    if (sess?.locationId && !isGlobalViewer()) {
      setLocationFilter(sess.locationId);
    }
    loadCalendar();
  }, [loadCalendar, navigate]);

  // Real-time sync for wedding customer / registration / call-queue changes
  useRealtimeSection(['wedding', 'wedding_reg', 'callqueue'], () => {
    loadCalendar({ forceCustomers: true });
  });

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Keep the highlighted day inside the month being viewed
  useEffect(() => {
    if (!selectedDateStr || !selectedDateStr.startsWith(monthKey)) {
      setSelectedDateStr(monthKey === todayKey.slice(0, 7) ? todayKey : `${monthKey}-01`);
    }
  }, [monthKey, todayKey, selectedDateStr]);

  const monthEvents = useMemo(
    () => events.filter((e) => e.date.slice(0, 7) === monthKey),
    [events, monthKey]
  );

  const filteredEvents = useMemo(
    () => (eventFilter === 'all' ? monthEvents : monthEvents.filter((e) => EVENT_TYPE_META[e.type].group === eventFilter)),
    [monthEvents, eventFilter]
  );

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    monthEvents.forEach((e) => {
      const g = EVENT_TYPE_META[e.type].group;
      counts[g] = (counts[g] || 0) + 1;
    });
    return counts;
  }, [monthEvents]);

  const eventsByDay = useMemo(() => {
    const map: Record<string, WeddingEvent[]> = {};
    filteredEvents.forEach((e) => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    Object.values(map).forEach((list) =>
      list.sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || a.customerName.localeCompare(b.customerName))
    );
    return map;
  }, [filteredEvents]);

  const selectedDayEvents = eventsByDay[selectedDateStr || ''] || [];

  // Generate days in month
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const blanks = Array.from({ length: firstDayIndex }, (_, i) => i);
  const daysArray = Array.from({ length: totalDays }, (_, i) => i + 1);

  const dateHref = (customerId: number) => `/wedding-crm/customers/${customerId}`;

  const openEvent = (ev: WeddingEvent) => navigate(dateHref(ev.customerId));

  const eventCard = (ev: WeddingEvent) => {
    const meta = EVENT_TYPE_META[ev.type];
    const Icon = meta.icon;
    const badge = getStatusBadge(ev.customerStatus);
    const waDigits = ev.mobile.replace(/\D/g, '');

    return (
      <div
        key={ev.key}
        onClick={() => openEvent(ev)}
        className="p-3.5 rounded-2xl bg-[#FFFAF7] border border-[#E8D9D4] hover:border-[#B76E79] text-xs space-y-2 transition-all shadow-2xs cursor-pointer"
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-black ${meta.chip}`}>
            <Icon className="w-3 h-3" />
            {ev.type}
          </span>
          {ev.customerStatus && (
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}>
              {ev.customerStatus}
            </span>
          )}
        </div>

        <Link
          to={dateHref(ev.customerId)}
          onClick={(e) => e.stopPropagation()}
          className="block font-black text-[#4A173A] hover:text-[#6A2853] hover:underline"
        >
          {ev.customerName}
        </Link>

        <div className="text-[#6F5963] space-y-1 text-[11px]">
          <div className="flex items-center gap-1.5 font-semibold text-[#2B1722] flex-wrap">
            <span className="text-[#6A2853]">{ev.customerCode}</span>
            <span>·</span>
            <span>📱 {ev.mobile || 'No mobile'}</span>
            <span>·</span>
            <span>📍 {ev.locationName}</span>
          </div>
          {ev.eventStatus && (
            <div className="text-[#198754] font-bold">Status: {ev.eventStatus}</div>
          )}
          {ev.time && (
            <div className="text-[#C58A18] font-bold">Window: {ev.time}</div>
          )}
          {ev.detail && (
            <div className="text-[#6F5963]">{ev.detail}</div>
          )}
          <div className="text-[#4A173A] font-bold">
            Assigned: {ev.assignedTelecaller || 'Unassigned'}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[#E8D9D4]">
          {waDigits ? (
            <a
              href={`https://wa.me/91${waDigits}?text=Namaste%20${encodeURIComponent(ev.customerName)}%2C%20greetings%20from%20BSC%20Exclusive!`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => { e.stopPropagation(); }}
              className="text-[11px] font-bold text-[#198754] hover:underline"
            >
              WhatsApp
            </a>
          ) : (
            <span className="text-[11px] text-[#9A858D] font-bold">No mobile</span>
          )}

          <Link
            to={dateHref(ev.customerId)}
            onClick={(e) => e.stopPropagation()}
            className="px-2.5 py-1 bg-[#4A173A] hover:bg-[#6A2853] text-white rounded-lg text-[10px] font-bold shadow-xs flex items-center gap-1 transition-colors"
          >
            <Eye className="w-3 h-3 text-[#B76E79]" /> View Record
          </Link>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout
      title="Follow-up Calendar"
      breadcrumbs={[{ label: 'Wedding CRM', href: '/wedding-crm/dashboard' }, { label: 'Calendar' }]}
    >
      <PageContainer maxWidth="full">
        <div className="space-y-6">
          <ToastContainer />

          <WeddingNav
            currentPageTitle="Follow-up Calendar"
            actions={
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <LocationFilterSelect
                  value={locationFilter}
                  onChange={(val) => setLocationFilter(val)}
                />
                <div className="flex items-center bg-[#FFFDFC] rounded-xl border border-[#E8D9D4] p-1 text-xs font-bold shadow-xs">
                  <button
                    onClick={() => setViewMode('month')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      viewMode === 'month' ? 'bg-[#B76E79] text-white shadow-xs' : 'text-[#6F5963] hover:text-[#4A173A]'
                    }`}
                  >
                    Month View
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      viewMode === 'list' ? 'bg-[#B76E79] text-white shadow-xs' : 'text-[#6F5963] hover:text-[#4A173A]'
                    }`}
                  >
                    List View
                  </button>
                </div>
              </div>
            }
          />

          {/* Calendar Header Navigator */}
          <div className="bg-[#FFFDFC] p-4 sm:p-5 rounded-2xl border border-[#E8D9D4] shadow-xs flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#4A173A] text-[#B76E79] flex items-center justify-center font-black shadow-xs">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-[#4A173A]">
                  {monthNames[month]} {year}
                </h2>
                <div className="text-xs text-[#6F5963] font-semibold">
                  Wedding dates · shopping dates · calls · follow-ups · store visits
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="px-2.5 py-1 rounded-lg bg-[#FFF7F2] border border-[#E8D9D4] text-[11px] font-black text-[#4A173A]">
                  {filteredEvents.length} event{filteredEvents.length === 1 ? '' : 's'} this month
                </span>
                {loading && (
                  <span className="text-[10px] font-bold text-[#B76E79]">Updating…</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevMonth}
                className="p-2 rounded-xl bg-[#FFF7F2] hover:bg-[#E8D9D4] text-[#4A173A] border border-[#E8D9D4] transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-3 py-1.5 rounded-xl bg-[#FFF7F2] hover:bg-[#E8D9D4] text-xs font-bold text-[#4A173A] border border-[#E8D9D4] transition-colors"
              >
                Today
              </button>
              <button
                onClick={handleNextMonth}
                className="p-2 rounded-xl bg-[#FFF7F2] hover:bg-[#E8D9D4] text-[#4A173A] border border-[#E8D9D4] transition-colors"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Event Type Filter */}
          <div className="bg-[#FFFDFC] p-4 sm:p-5 rounded-2xl border border-[#E8D9D4] shadow-xs flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#6F5963]">
                Event Type
              </span>
              {EVENT_FILTERS.map((f) => {
                const isActive = eventFilter === f.value;
                const chipType = f.value === 'all' ? undefined : GROUP_TO_TYPE[f.value];
                const count = f.value === 'all' ? monthEvents.length : (typeCounts[f.value] || 0);
                return (
                  <button
                    key={f.value}
                    onClick={() => setEventFilter(f.value)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all ${
                      isActive
                        ? 'bg-[#B76E79] text-white border-[#B76E79] shadow-xs'
                        : 'bg-[#FFF7F2] text-[#6F5963] border-[#E8D9D4] hover:text-[#4A173A] hover:border-[#B76E79]'
                    }`}
                  >
                    {chipType && <span className={`w-1.5 h-1.5 rounded-full ${EVENT_TYPE_META[chipType].dot}`} />}
                    {f.label}
                    <span className={`px-1.5 rounded-md text-[10px] font-black ${isActive ? 'bg-white/20' : 'bg-[#E8D9D4]/60 text-[#4A173A]'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="text-[11px] text-[#6F5963] font-semibold">
              Click any event to open the customer record
            </div>
          </div>

          {loading && !initialised ? (
            <div className="bg-[#FFFDFC] rounded-3xl border border-[#E8D9D4] shadow-xs p-12 text-center">
              <CalendarIcon className="w-8 h-8 text-[#B76E79] mx-auto mb-3 animate-pulse" />
              <div className="text-sm font-black text-[#4A173A]">Loading CRM calendar…</div>
              <div className="text-xs text-[#6F5963] mt-1">Wedding dates, shopping plans, calls, follow-ups and store visits.</div>
            </div>
          ) : viewMode === 'list' ? (
            /* ── Agenda / List view of the month's events ───────────────── */
            <div className="bg-[#FFFDFC] rounded-3xl border border-[#E8D9D4] shadow-xs p-5 space-y-5">
              <div className="border-b border-[#E8D9D4] pb-3">
                <h3 className="text-sm font-black text-[#4A173A] uppercase tracking-wider">
                  {monthNames[month]} {year} · Agenda
                </h3>
                <div className="text-xs text-[#6F5963]">
                  {filteredEvents.length} event{filteredEvents.length === 1 ? '' : 's'} scheduled
                </div>
              </div>

              {filteredEvents.length === 0 ? (
                <div className="text-center py-12 text-[#6F5963] text-xs">
                  <CalendarIcon className="w-8 h-8 text-[#B76E79] mx-auto mb-2 opacity-80" />
                  <div className="font-bold text-sm text-[#4A173A]">No events this month</div>
                  <div className="text-xs text-[#6F5963] mt-0.5">
                    Adjust the event-type or location filter, or pick another month.
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {Object.keys(eventsByDay)
                    .sort((a, b) => a.localeCompare(b))
                    .map((day) => (
                      <div key={day} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-black uppercase tracking-wider text-[#4A173A]">
                            {formatDateDisplay(day, day, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                          <span className="text-[10px] font-bold text-[#6F5963]">
                            · {eventsByDay[day].length} event{eventsByDay[day].length === 1 ? '' : 's'}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                          {eventsByDay[day].map((ev) => eventCard(ev))}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ) : (
            /* ── Month grid ─────────────────────────────────────────────── */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Calendar Grid (2 Cols) */}
              <div className="lg:col-span-2 bg-[#FFFDFC] rounded-3xl border border-[#E8D9D4] shadow-xs p-5 space-y-4">
                {/* Day of Week Labels */}
                <div className="grid grid-cols-7 gap-1 text-center font-black text-[11px] uppercase tracking-wider text-[#6F5963] border-b border-[#E8D9D4] pb-2">
                  <span>Sun</span>
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span>Sat</span>
                </div>

                {/* Day Grid */}
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                  {blanks.map((b) => (
                    <div key={`blank-${b}`} className="min-h-[70px] sm:min-h-[85px] bg-[#FFF7F2]/60 rounded-xl border border-dashed border-[#E8D9D4]/50" />
                  ))}

                  {daysArray.map((dayNum) => {
                    const dateStr = `${monthKey}-${String(dayNum).padStart(2, '0')}`;
                    const dayEvents = eventsByDay[dateStr] || [];
                    const count = dayEvents.length;
                    const isSelected = selectedDateStr === dateStr;
                    const isToday = todayKey === dateStr;
                    const dayTypes = Array.from(new Set(dayEvents.map((e) => e.type)));

                    return (
                      <div
                        key={dayNum}
                        onClick={() => setSelectedDateStr(dateStr)}
                        className={`min-h-[70px] sm:min-h-[85px] p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'border-[#B76E79] bg-[#4A173A] text-white shadow-md'
                            : isToday
                            ? 'border-[#B76E79] bg-[#F6E2E5]/50'
                            : 'border-[#E8D9D4] bg-[#FFFAF7] hover:bg-white hover:border-[#B76E79]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-black ${isSelected ? 'text-[#E8C7A8]' : isToday ? 'text-[#B76E79]' : 'text-[#2B1722]'}`}>
                            {dayNum}
                          </span>
                          {isToday && (
                            <span className="text-[8px] bg-[#B76E79] text-white px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider">
                              Today
                            </span>
                          )}
                        </div>

                        {count > 0 && (
                          <div className="mt-1 space-y-1">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded-lg text-[9px] font-black ${
                                isSelected
                                  ? 'bg-[#B76E79] text-white'
                                  : 'bg-[#F6E2E5] text-[#4A173A] border border-[#E8D9D4]'
                              }`}
                            >
                              {count} event{count === 1 ? '' : 's'}
                            </span>
                            <div className="flex items-center gap-1 flex-wrap">
                              {dayTypes.slice(0, 4).map((t) => (
                                <span
                                  key={t}
                                  title={`${t}: ${dayEvents.filter((e) => e.type === t).length}`}
                                  className={`w-1.5 h-1.5 rounded-full ${EVENT_TYPE_META[t].dot}`}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-3 flex-wrap pt-1 border-t border-[#E8D9D4]">
                  {(Object.keys(EVENT_TYPE_META) as WeddingEventType[]).map((t) => (
                    <span key={t} className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#6F5963]">
                      <span className={`w-1.5 h-1.5 rounded-full ${EVENT_TYPE_META[t].dot}`} />
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Selected Date Events Detail Panel (1 Col) */}
              <div className="bg-[#FFFDFC] rounded-3xl border border-[#E8D9D4] shadow-xs p-5 space-y-4">
                <div className="border-b border-[#E8D9D4] pb-3">
                  <h3 className="text-sm font-black text-[#4A173A] uppercase tracking-wider">
                    Events for {selectedDateStr ? formatDateDisplay(selectedDateStr, selectedDateStr, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : 'Selected Day'}
                  </h3>
                  <div className="text-xs text-[#6F5963]">
                    {selectedDayEvents.length} event{selectedDayEvents.length === 1 ? '' : 's'} on this date
                  </div>
                </div>

                {selectedDayEvents.length === 0 ? (
                  <div className="text-center py-12 text-[#6F5963] text-xs">
                    <CalendarIcon className="w-8 h-8 text-[#B76E79] mx-auto mb-2 opacity-80" />
                    <div className="font-bold text-sm text-[#4A173A]">No events for this date</div>
                    <div className="text-xs text-[#6F5963] mt-0.5">
                      Select another date on the calendar, or widen the event-type filter.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {selectedDayEvents.map((ev) => eventCard(ev))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </PageContainer>
    </DashboardLayout>
  );
}
