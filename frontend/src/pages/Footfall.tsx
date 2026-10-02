import { useState, useEffect, useMemo, useRef } from 'react';
import DashboardLayout from '../components/layouts/DashboardLayout';
import PageContainer from '../components/ui/PageContainer';
import { BarChart3, Clock, Users, Calendar, Save, CircleCheck, Sparkles, Check, Activity, FileText, Download, TrendingUp, Zap, Store, MapPin, Filter, RotateCcw, Pencil, History, Inbox } from 'lucide-react';
import { API, Auth } from '../services/api';
import { realtimeClient } from '../services/realtimeClient';
import { useLocationContext } from '../context/LocationContext';
import { showToast } from '../components/Toast';
import MetricCard from '../components/ui/MetricCard';
import * as XLSX from 'xlsx';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import FootfallEditModal from './footfall/FootfallEditModal';
import FootfallHistoryModal from './footfall/FootfallHistoryModal';
import { SourceBadge, EditedBadge, EditorCell } from './footfall/FootfallBadges';
import {
  formatSlotLabel,
  formatIstDate,
  formatIstStamp,
  istDateStringFrom,
  isFootfallManagementRole,
  type FootfallEntryRow,
  type FootfallEditTarget
} from './footfall/shared';

/**
 * Footfall rows are keyed by the IST calendar day. `toISOString().split('T')[0]`
 * yields the UTC day, which is still the previous day until 05:30 IST — an
 * early-morning entry would be filed under yesterday and never appear as today's.
 */
function istToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
  return parts; // en-CA already emits YYYY-MM-DD
}

function istNowHour(): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }).format(new Date()));
}

/** The same rule shifted by whole days, resolved in IST rather than UTC. */
function istOffsetDay(daysBack: number): string {
  const shifted = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(shifted);
}

type SlotMeta = {
  visitors: number;
  remarks: string;
  submittedBy?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Present on every row the API returns; lets a grid slot be corrected or audited. */
  entryId?: string;
  entrySource?: string | null;
};

export default function Footfall() {
  const { currentLocation, allLocations, isGlobalAdmin, canSwitch } = useLocationContext();
  const session = Auth.get();

  const [date, setDate] = useState<string>(istToday());
  const [selectedStoreId, setSelectedStoreId] = useState<string>(() => {
    if (session?.locationId) return String(session.locationId);
    if (currentLocation && currentLocation !== 'ALL') return currentLocation;
    return '1'; // Default Belagavi
  });

  const effectiveLocationId = useMemo(() => {
    if (currentLocation && currentLocation !== 'ALL') return currentLocation;
    return selectedStoreId || '1';
  }, [currentLocation, selectedStoreId]);

  const activeStore = useMemo(() => {
    return allLocations.find(l => String(l.id) === String(effectiveLocationId)) || allLocations[0] || { id: 1, name: 'Belagavi', code: 'BEL' };
  }, [allLocations, effectiveLocationId]);

  const [slots, setSlots] = useState<Record<number, SlotMeta>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [savingSlot, setSavingSlot] = useState<number | null>(null);
  const localOverridesRef = useRef<Record<number, SlotMeta>>({});
  // Guards against a slow response for an earlier date/store overwriting a newer one
  const requestSeqRef = useRef(0);

  // Entry list is a second read model: it carries origin, editor and edit count,
  // and is what the Source / Greeter filters are applied to server-side.
  const [entries, setEntries] = useState<FootfallEntryRow[]>([]);
  const [entriesLoading, setEntriesLoading] = useState<boolean>(true);
  // A failed read must not read as "nothing was recorded today" — the register looks
  // identical either way, and a store that is closed for the day is very different
  // from a store whose counts never arrived.
  const [entriesError, setEntriesError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [greeterFilter, setGreeterFilter] = useState<string>('all');
  const [sourceOptions, setSourceOptions] = useState<string[]>([]);
  const [recorderOptions, setRecorderOptions] = useState<string[]>([]);
  const entriesSeqRef = useRef(0);
  const [editingEntry, setEditingEntry] = useState<FootfallEditTarget | null>(null);
  const [historyEntry, setHistoryEntry] = useState<FootfallEditTarget | null>(null);

  // The socket subscription is registered per date/store, not per filter, so the
  // handler reads the applied filters through a ref instead of a stale closure.
  const filterRef = useRef<{ source: string; greeter: string }>({ source: 'all', greeter: 'all' });

  const isManagementUser = useMemo(() => isFootfallManagementRole(session?.role), [session?.role]);

  const slotHours = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

  const fetchFootfall = async (selectedDate: string, storeId: string | number) => {
    const seq = ++requestSeqRef.current;
    try {
      const res = await API.getFootfall(selectedDate, Number(storeId));
      if (seq !== requestSeqRef.current) return;
      const map: Record<number, SlotMeta> = {};
      if (res && res.entries && Array.isArray(res.entries)) {
        res.entries.forEach((e: any) => {
          map[e.slotHour] = {
            visitors: Number(e.visitors) || 0,
            remarks: e.remarks || '',
            submittedBy: e.submittedBy || undefined,
            createdAt: e.createdAt || undefined,
            updatedAt: e.updatedAt || undefined,
            entryId: e.id ? String(e.id) : undefined,
            entrySource: e.entry_source || null
          };
        });
      }
      setSlots(map);
    } catch (err: any) {
      if (seq !== requestSeqRef.current) return;
      console.error(err);
      showToast('Unable to load today\'s footfall counts. Please try again.', 'error');
    } finally {
      if (seq === requestSeqRef.current) setLoading(false);
    }
  };

  const collectRecorders = (rows: FootfallEntryRow[]): string[] => {
    const names = new Set<string>();
    rows.forEach(r => {
      const name = String(r.created_by || r.submittedBy || '').trim();
      if (name) names.add(name);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  };

  const fetchEntries = async (
    selectedDate: string,
    storeId: string | number,
    source?: string,
    greeter?: string
  ) => {
    const activeSource = source !== undefined ? source : filterRef.current.source;
    const activeGreeter = greeter !== undefined ? greeter : filterRef.current.greeter;
    const seq = ++entriesSeqRef.current;
    setEntriesLoading(true);
    try {
      const res = await API.getFootfallEntries({
        date: selectedDate,
        locationId: Number(storeId),
        source: activeSource,
        greeter: activeGreeter
      });
      if (seq !== entriesSeqRef.current) return;
      const rows: FootfallEntryRow[] = res && Array.isArray(res.entries) ? res.entries : [];
      setEntries(rows);
      setEntriesError(null);
      if (res && Array.isArray(res.sources) && res.sources.length > 0) {
        setSourceOptions(res.sources.map((s: any) => String(s)));
      }
      // Options come from the unfiltered pass only, so narrowing the list can
      // never erase the other names from the dropdown.
      if (activeGreeter === 'all') {
        setRecorderOptions(collectRecorders(rows));
      } else {
        setRecorderOptions(prev => (prev.includes(activeGreeter) ? prev : [...prev, activeGreeter]));
      }
    } catch (err: any) {
      if (seq !== entriesSeqRef.current) return;
      console.error(err);
      setEntriesError(err?.message || 'Unable to load footfall entries.');
      showToast('Unable to load footfall entries. Please try again.', 'error');
    } finally {
      if (seq === entriesSeqRef.current) setEntriesLoading(false);
    }
  };

  useEffect(() => {
    filterRef.current = { source: sourceFilter, greeter: greeterFilter };
  }, [sourceFilter, greeterFilter]);

  useEffect(() => {
    setLoading(true);
    localOverridesRef.current = {};
    fetchFootfall(date, effectiveLocationId);

    // Reuse the app's single shared socket instead of opening one per page mount.
    const offSocket = realtimeClient.onSocket((socket) => {
      const onFootfallUpdated = (data: any) => {
        const eventDate = istDateStringFrom(data?.entryDate);
        if (data && eventDate === date && (!data.location_id || Number(data.location_id) === Number(effectiveLocationId))) {
          setSlots(prev => {
            if (localOverridesRef.current[data.slotHour]) return prev;
            const previous = prev[data.slotHour];
            return {
              ...prev,
              [data.slotHour]: {
                visitors: Number(data.visitors) || 0,
                // A correction push carries no remarks/submittedBy, so keep what
                // is already on the card instead of blanking it.
                remarks: data.remarks ?? previous?.remarks ?? '',
                submittedBy: data.submittedBy ?? previous?.submittedBy ?? undefined,
                createdAt: previous?.createdAt,
                updatedAt: data.updatedAt || previous?.updatedAt,
                entryId: data.entry_id ? String(data.entry_id) : previous?.entryId,
                entrySource: data.source || previous?.entrySource || null
              }
            };
          });
          // The entries list is a separate read model (source, editor, edit count),
          // so a push has to refresh it too — not just the slot grid.
          fetchEntries(date, effectiveLocationId);
        }
      };
      socket.on('footfall:updated', onFootfallUpdated);
      // Handed back to the shared client so it detaches on unmount and before the
      // next reconnection; without it every date or store change left another
      // handler on the same socket and one push refetched the page several times.
      return () => { socket.off('footfall:updated', onFootfallUpdated); };
    });

    // Polling fallback for missed pushes; reuses fetchFootfall so the stale-response
    // guard and error handling stay in one place.
    const interval = setInterval(() => {
      fetchFootfall(date, effectiveLocationId);
      fetchEntries(date, effectiveLocationId);
    }, 15000);

    return () => {
      offSocket();
      clearInterval(interval);
    };
  }, [date, effectiveLocationId]);

  useEffect(() => {
    fetchEntries(date, effectiveLocationId, sourceFilter, greeterFilter);
  }, [date, effectiveLocationId, sourceFilter, greeterFilter]);

  const handleSaveSlot = async (hour: number) => {
    setSavingSlot(hour);
    try {
      const slotData = slots[hour] || { visitors: 0, remarks: '' };
      const res = await API.upsertFootfall({
        entryDate: date,
        slotHour: hour,
        visitors: Number(slotData.visitors) || 0,
        remarks: slotData.remarks || '',
        submittedBy: session?.fullName || session?.username || 'Floor Manager',
        location_id: Number(effectiveLocationId)
      });
      // Clear local override after successful save
      delete localOverridesRef.current[hour];

      // Adopt the row the server actually stored, so the grid shows persisted
      // values and real timestamps rather than whatever was typed.
      const saved = res && res.entry;
      if (saved) {
        setSlots(prev => ({
          ...prev,
          [hour]: {
            visitors: Number(saved.visitors) || 0,
            remarks: saved.remarks || '',
            submittedBy: saved.submittedBy || undefined,
            createdAt: saved.createdAt || undefined,
            updatedAt: saved.updatedAt || undefined,
            entryId: saved.id ? String(saved.id) : prev[hour]?.entryId,
            entrySource: saved.entry_source || prev[hour]?.entrySource || null
          }
        }));
      }

      // Re-read the section so today's total and every card reflect the save
      // without a page reload or re-login. The entries table is a separate read
      // model, so it is re-read alongside the grid.
      await fetchFootfall(date, effectiveLocationId);
      await fetchEntries(date, effectiveLocationId);

      const formatHour = hour > 12 ? `${hour - 12}:00 PM` : hour === 12 ? '12:00 PM' : `${hour}:00 AM`;
      showToast(`Footfall for ${formatHour} at ${activeStore.name} saved successfully.`, 'success');
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Unable to save the footfall entry. Please try again.', 'error');
    } finally {
      setSavingSlot(null);
    }
  };

  const handleExportExcel = () => {
    const exportData = slotHours.map(hour => {
      const slot = slots[hour] || { visitors: 0, remarks: '' };
      const formatHour = hour > 12 ? `${hour - 12}:00 PM` : hour === 12 ? '12:00 PM' : `${hour}:00 AM`;
      const formatEndHour = (hour + 1) > 12 ? `${(hour + 1) - 12}:00 PM` : (hour + 1) === 12 ? '12:00 PM' : `${hour + 1}:00 AM`;
      return {
        'Date': date,
        'Store': activeStore.name,
        'Slot': `Slot ${hour - 9}`,
        'Time Operating Window': `${formatHour} - ${formatEndHour}`,
        'Visitors Count': Number(slot.visitors) || 0,
        'Floor Remarks': slot.remarks || '—'
      };
    });

    // Late or early kiosk hours have no grid card; exported too so the sheet
    // always reconciles with the daily total shown on screen.
    outsideGridSlots.forEach(({ hour, slot }) => {
      exportData.push({
        'Date': date,
        'Store': activeStore.name,
        'Slot': `Outside grid (${String(hour).padStart(2, '0')}:00)`,
        'Time Operating Window': formatSlotLabel(hour),
        'Visitors Count': Number(slot.visitors) || 0,
        'Floor Remarks': slot.remarks || '—'
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Hourly Footfall');
    XLSX.writeFile(workbook, `BSC_Hourly_Footfall_${activeStore.name}_${date}.xlsx`);
  };

  const todayStr = useMemo(() => istToday(), []);
  const currentHourNow = useMemo(() => istNowHour(), []);
  const isTodaySelected = date === todayStr;

  const totalFootfall = useMemo(() => {
    return Object.values(slots).reduce((sum, s) => sum + (Number(s.visitors) || 0), 0);
  }, [slots]);

  const completedSlotsCount = useMemo(() => {
    return slotHours.filter(h => (slots[h]?.visitors || 0) > 0).length;
  }, [slots]);

  const pendingSlotsCount = useMemo(() => {
    return slotHours.length - completedSlotsCount;
  }, [completedSlotsCount]);

  const recordedEntries = useMemo(() => {
    return slotHours
      .map(hour => ({ hour, slot: slots[hour] }))
      .filter((entry): entry is { hour: number; slot: SlotMeta } =>
        Boolean(entry.slot && (Number(entry.slot.visitors) > 0 || entry.slot.createdAt)));
  }, [slots]);

  /**
   * The grid renders a fixed 10:00 – 22:00 window, but a kiosk click at 22:15 is
   * filed under hour 22 and would otherwise disappear from the UI while still
   * counting in the day total. Those hours are surfaced separately so the grid
   * plus this list always equals the reported total.
   */
  const outsideGridSlots = useMemo(() => {
    return Object.keys(slots)
      .map(key => Number(key))
      .filter(hour => Number.isFinite(hour) && !slotHours.includes(hour))
      .sort((a, b) => a - b)
      .map(hour => ({ hour, slot: slots[hour] }))
      .filter(row => Number(row.slot.visitors) > 0 || Boolean(row.slot.entryId));
  }, [slots]);

  const gridTotal = useMemo(() => {
    return slotHours.reduce((sum, hour) => sum + (Number(slots[hour]?.visitors) || 0), 0);
  }, [slots]);

  const outsideGridTotal = useMemo(() => {
    return outsideGridSlots.reduce((sum, row) => sum + (Number(row.slot.visitors) || 0), 0);
  }, [outsideGridSlots]);

  const entriesTotal = useMemo(() => {
    return entries.reduce((sum, row) => sum + (Number(row.visitors) || 0), 0);
  }, [entries]);

  const filtersActive = sourceFilter !== 'all' || greeterFilter !== 'all';

  const clearEntryFilters = () => {
    setSourceFilter('all');
    setGreeterFilter('all');
  };

  const chartData = useMemo(() => {
    return slotHours.map(hour => {
      const slot = slots[hour] || { visitors: 0, remarks: '' };
      const formatHour = hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`;
      return {
        time: formatHour,
        visitors: Number(slot.visitors) || 0
      };
    });
  }, [slots]);

  const peakHourSlot = useMemo(() => {
    let max = 0;
    let maxHour = 10;
    slotHours.forEach(h => {
      const v = Number(slots[h]?.visitors || 0);
      if (v > max) {
        max = v;
        maxHour = h;
      }
    });
    const formatHour = maxHour > 12 ? `${maxHour - 12}:00 PM` : maxHour === 12 ? '12:00 PM' : `${maxHour}:00 AM`;
    return { hourStr: formatHour, count: max };
  }, [slots]);

  /** Rows come from /crm/footfall/entries and carry the id every dialog needs. */
  const entryToTarget = (row: FootfallEntryRow): FootfallEditTarget => ({
    id: String(row.id),
    visitors: Number(row.visitors) || 0,
    entryDate: istDateStringFrom(row.entryDate) || date,
    slotHour: Number(row.slotHour),
    locationId: Number(row.location_id) || Number(effectiveLocationId),
    remarks: row.remarks || '',
    source: row.entry_source || null,
    recordedBy: row.created_by || row.submittedBy || null,
    editCount: Number(row.edit_count) || 0
  });

  /** Grid/out-of-grid cards only know what getFootfall returns. */
  const slotToTarget = (hour: number, slot: SlotMeta): FootfallEditTarget => ({
    id: String(slot.entryId || ''),
    visitors: Number(slot.visitors) || 0,
    entryDate: date,
    slotHour: hour,
    locationId: Number(effectiveLocationId),
    remarks: slot.remarks || '',
    source: slot.entrySource || null,
    recordedBy: slot.submittedBy || null
  });

  // A correction can move the record to another date/hour/store, so both read
  // models for the viewed day are re-read instead of patching rows in place.
  const refreshAfterCorrection = async () => {
    await Promise.all([
      fetchFootfall(date, effectiveLocationId),
      fetchEntries(date, effectiveLocationId)
    ]);
  };

  return (
    <DashboardLayout
      title="Hourly Footfall Register"
      subtitle="Realtime store visitor tracking across floor operating hours (10:00 AM – 10:00 PM)"
    >
      <PageContainer maxWidth="full">
        <div className="space-y-6">

        {/* Top Controls: Glass Date Selector + Excel Export Button */}
        <div className="space-y-5">
          <div className="card-glass p-5 lg:p-6 flex flex-col gap-4 border border-accent-soft/80 bg-white/70 backdrop-blur-xl shadow-md rounded-2xl">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary text-accent flex items-center justify-center shadow-lg shrink-0">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <label className="block text-[10.5px] font-black uppercase text-primary tracking-widest mb-1">
                    Store Log Register Date
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="px-3.5 py-2 rounded-xl border border-accent-soft bg-white/90 font-extrabold text-xs text-primary outline-none shadow-xs focus:ring-2 focus:ring-accent/40 transition-all"
                    />
                    <button
                      onClick={() => setDate(todayStr)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                        isTodaySelected
                          ? 'bg-primary text-accent shadow-md ring-1 ring-accent/30'
                          : 'bg-background border border-accent-soft text-[#5D4E42] hover:bg-white'
                      }`}
                    >
                      Today
                    </button>
                    <button
                      onClick={() => setDate(istOffsetDay(1))}
                      className="px-3.5 py-2 rounded-xl text-xs font-black bg-background border border-accent-soft text-[#5D4E42] hover:bg-white transition-all"
                    >
                      Yesterday
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="px-3.5 py-2 rounded-xl bg-emerald-100/80 border border-emerald-300/50 text-emerald-800 text-xs font-black flex items-center gap-1.5 shadow-2xs">
                  <Zap className="w-4 h-4 text-emerald-600 animate-pulse" />
                  <span>Socket Push Sync Active</span>
                </span>

                <button
                  onClick={handleExportExcel}
                  className="btn-gold px-4 py-2 text-xs font-black flex items-center gap-2 shadow-sm rounded-xl"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Register (.xlsx)</span>
                </button>
              </div>
            </div>

            {/* Store Location Tabs (for Admins / Multi-store users) */}
            {(isGlobalAdmin || canSwitch || allLocations.length > 1) && (
              <div className="w-full flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-accent-soft/80">
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-accent" />
                  <span className="text-[10.5px] font-black uppercase text-primary tracking-widest">
                    Active Store Location:
                  </span>
                  <span className="text-xs font-bold text-accent px-2 py-0.5 rounded-lg bg-primary">
                    {activeStore.name} ({activeStore.code})
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {allLocations.map((loc) => {
                    const isSelected = String(loc.id) === String(effectiveLocationId);
                    return (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => setSelectedStoreId(String(loc.id))}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer ${
                          isSelected
                            ? 'bg-primary text-accent ring-2 ring-accent/40 shadow-sm'
                            : 'bg-white border border-accent-soft text-[#5D4E42] hover:bg-[#F7F5F0]'
                        }`}
                      >
                        <MapPin className={`w-3.5 h-3.5 ${isSelected ? 'text-accent' : 'text-primary/60'}`} />
                        <span>{loc.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Entry filters — applied server-side to the Recorded Footfall Entries list */}
            <div className="w-full flex flex-wrap items-end gap-3 pt-3 border-t border-accent-soft/80">
              <div className="flex items-center gap-2 self-center">
                <Filter className="w-4 h-4 text-accent" />
                <span className="text-[10.5px] font-black uppercase text-primary tracking-widest">
                  Filter Entries:
                </span>
              </div>

              <div className="min-w-[150px]">
                <label className="block text-[10px] font-black uppercase text-primary/70 tracking-wider mb-1">
                  Entry Source
                </label>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-accent-soft bg-white text-xs font-extrabold text-primary outline-none shadow-2xs focus:ring-2 focus:ring-accent/40 transition-all"
                >
                  <option value="all">All sources</option>
                  {sourceOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              <div className="min-w-[160px]">
                <label className="block text-[10px] font-black uppercase text-primary/70 tracking-wider mb-1">
                  Greeter / Recorded By
                </label>
                <select
                  value={greeterFilter}
                  onChange={(e) => setGreeterFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-accent-soft bg-white text-xs font-extrabold text-primary outline-none shadow-2xs focus:ring-2 focus:ring-accent/40 transition-all"
                >
                  <option value="all">All recorders</option>
                  {recorderOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={clearEntryFilters}
                disabled={!filtersActive}
                className="px-3.5 py-2 rounded-xl text-xs font-black bg-background border border-accent-soft text-[#5D4E42] hover:bg-white transition-all flex items-center gap-1.5 disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear Filters</span>
              </button>

              <span className="text-[10.5px] font-bold text-primary/70 ml-auto max-w-full">
                {filtersActive
                  ? `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} · ${entriesTotal.toLocaleString('en-IN')} visitors matched. Register grid keeps every hour.`
                  : `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} listed · filters apply to the entry list only`}
              </span>
            </div>
          </div>

          {/* 4 Summary Analytics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Daily Visitors"
              value={totalFootfall.toLocaleString('en-IN')}
              subtext={outsideGridTotal > 0
                ? `${gridTotal.toLocaleString('en-IN')} in the 12 operating slots + ${outsideGridTotal.toLocaleString('en-IN')} outside the grid`
                : `Sum of 12 operating slots for ${formatIstDate(date)}`}
              icon={Users}
              color="navy"
            />
            <MetricCard
              title="Completed Slots"
              value={`${completedSlotsCount} / 12`}
              subtext="Hours with recorded visitor counts"
              icon={CircleCheck}
              color="emerald"
            />
            <MetricCard
              title="Peak Rush Hour"
              value={peakHourSlot.count > 0 ? peakHourSlot.hourStr : '—'}
              subtext={`Highest traffic: ${peakHourSlot.count} visitors`}
              icon={TrendingUp}
              color="gold"
            />
            <MetricCard
              title="Operating Coverage"
              value="12 Hours"
              subtext="Realtime synchronized floor tracking"
              icon={Activity}
              color="indigo"
            />
          </div>
        </div>

        {/* Peak Hour Traffic Visual Heatmap Chart */}
        <div className="card-glass p-5 lg:p-6 border border-accent-soft/80 bg-white/80 backdrop-blur-xl shadow-lg rounded-2xl space-y-3">
          <div className="flex items-center justify-between border-b border-accent-soft pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-accent" />
              <h3 className="font-extrabold text-primary text-sm uppercase tracking-wider">
                Store Hourly Traffic Distribution Heatmap
              </h3>
            </div>
            <span className="text-xs font-bold text-primary font-mono">
              Peak Slot: <strong className="text-accent">{peakHourSlot.hourStr} ({peakHourSlot.count} Visitors)</strong>
            </span>
          </div>

          <div className="h-44 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="visitorGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-accent-soft)" />
                <XAxis dataKey="time" stroke="var(--color-primary)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--color-primary)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--color-primary)', borderRadius: '12px', border: 'none', color: '#000', fontSize: '12px', fontWeight: 'bold' }}
                  itemStyle={{ color: 'var(--color-accent)' }}
                />
                <Area type="monotone" dataKey="visitors" stroke="var(--color-accent)" strokeWidth={3} fillOpacity={1} fill="url(#visitorGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>



        {/* Section Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-accent-soft pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-accent" />
            <h3 className="font-extrabold text-primary text-base tracking-tight">Hourly Store Entry Slots</h3>
          </div>
          <span className="text-xs font-bold text-primary bg-white/60 px-3 py-1 rounded-full border border-accent-soft">
            12 Hourly Slots (10 AM - 10 PM){outsideGridSlots.length > 0 ? ` + ${outsideGridSlots.length} recorded outside this window` : ''}
          </span>
        </div>

        {/* Hourly Slot Entry Responsive Grid */}
        {loading ? (
          <div className="card-glass p-12 text-center text-xs text-primary font-bold">
            Loading hourly footfall register for {formatIstDate(date)}...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {slotHours.map((hour) => {
              const slot = slots[hour] || { visitors: 0, remarks: '' };
              const formatHour = hour > 12 ? `${hour - 12}:00 PM` : hour === 12 ? '12:00 PM' : `${hour}:00 AM`;
              const formatEndHour = (hour + 1) > 12 ? `${(hour + 1) - 12}:00 PM` : (hour + 1) === 12 ? '12:00 PM' : `${hour + 1}:00 AM`;

              const isCurrentSlot = isTodaySelected && currentHourNow === hour;
              const isSaved = (slot.visitors || 0) > 0;

              return (
                <div
                  key={hour}
                  className={`card-glass p-5 flex flex-col justify-between transition-all duration-200 relative group hover:-translate-y-1 hover:shadow-xl rounded-2xl ${
                    isCurrentSlot
                      ? 'border-2 border-accent shadow-xl ring-4 ring-accent/15 bg-gradient-to-br from-amber-50/60 to-amber-100/30'
                      : isSaved
                      ? 'border-l-4 border-l-emerald-600 bg-white/80'
                      : 'border-l-4 border-l-primary/30 bg-white/60'
                  }`}
                >
                  <div>
                    {/* Time Slot Header */}
                    <div className="flex items-center justify-between border-b border-accent-soft/80 pb-3 mb-3">
                      <div>
                        <div className="flex items-center gap-1.5 font-black text-primary text-sm tracking-tight">
                          <Clock className={`w-4 h-4 ${isCurrentSlot ? 'text-accent animate-pulse' : 'text-primary'}`} />
                          <span>{formatHour} – {formatEndHour}</span>
                        </div>
                        <div className="text-[10px] text-primary font-bold font-mono mt-0.5">
                          Slot {hour - 9} of 12
                        </div>
                      </div>

                      {/* Status Badges */}
                      {isCurrentSlot ? (
                        <span className="px-2.5 py-1 rounded-full bg-accent text-white text-[10px] font-black uppercase tracking-wider shadow-xs flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Current
                        </span>
                      ) : isSaved ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-100/90 text-emerald-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border border-emerald-300/50">
                          <Check className="w-3 h-3 text-emerald-600" /> Saved
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-background border border-accent-soft text-primary text-[10px] font-bold uppercase tracking-wider">
                          Pending
                        </span>
                      )}
                    </div>

                    {/* Inputs */}
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-extrabold text-primary mb-1">
                          Visitor Footfall Count
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            value={slot.visitors || ''}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 0;
                              setSlots({
                                ...slots,
                                [hour]: { ...slot, visitors: val }
                              });
                              localOverridesRef.current[hour] = { visitors: val, remarks: slot.remarks };
                            }}
                            placeholder="0"
                            className="w-full text-base font-black font-mono pl-9 pr-3 py-2 rounded-xl border border-accent-soft bg-white text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all shadow-2xs"
                          />
                          <Users className="w-4 h-4 text-primary absolute left-3 top-3" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-extrabold text-primary mb-1">
                          Floor Notes / Remarks
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={slot.remarks || ''}
                            onChange={(e) => {
                              setSlots({
                                ...slots,
                                [hour]: { ...slot, remarks: e.target.value }
                              });
                              localOverridesRef.current[hour] = { visitors: slot.visitors, remarks: e.target.value };
                            }}
                            placeholder="e.g. Rush in Womens Sarees"
                            className="w-full text-xs font-semibold pl-8 pr-3 py-2 rounded-xl border border-accent-soft bg-white text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all shadow-2xs"
                          />
                          <FileText className="w-3.5 h-3.5 text-primary absolute left-3 top-2.5" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Save Button */}
                  <button
                    onClick={() => handleSaveSlot(hour)}
                    disabled={savingSlot === hour}
                    className={`mt-4 w-full py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-xs active:scale-[0.98] disabled:opacity-50 ${
                      isCurrentSlot
                        ? 'bg-accent text-white hover:bg-[#996515] shadow-md'
                        : isSaved
                        ? 'bg-primary text-white hover:bg-primary'
                        : 'bg-primary text-white hover:bg-primary'
                    }`}
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{savingSlot === hour ? 'Logging Entry...' : isSaved ? 'Update Slot Log' : 'Save Slot Log'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Outside the operating window — real hours the fixed grid cannot show */}
        {outsideGridSlots.length > 0 && (
          <div className="card-glass p-5 lg:p-6 border border-accent-soft/80 bg-white/80 backdrop-blur-xl shadow-lg rounded-2xl space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-accent-soft pb-3">
              <div className="flex items-center gap-2">
                <Inbox className="w-5 h-5 text-accent" />
                <h3 className="font-extrabold text-primary text-sm uppercase tracking-wider">
                  Recorded Outside the 10 AM - 10 PM Grid
                </h3>
              </div>
              <span className="text-[11px] font-bold text-primary/70">
                {outsideGridSlots.length} {outsideGridSlots.length === 1 ? 'hour' : 'hours'} · {outsideGridTotal.toLocaleString('en-IN')} visitors
              </span>
            </div>

            <p className="text-[11px] font-semibold text-primary/65">
              Kiosk clicks are filed under the hour they happened in, including closing-time and late entries.
              These hours are counted in the daily total above but have no card in the fixed entry grid.
            </p>

            <div className="table-frame custom-scrollbar -mx-1">
              <table className="w-full min-w-[760px] text-left border-collapse">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-primary/70 border-b border-accent-soft">
                    <th className="py-2 px-2 font-black">Hour</th>
                    <th className="py-2 px-2 font-black text-right">Footfall</th>
                    <th className="py-2 px-2 font-black">Source</th>
                    <th className="py-2 px-2 font-black">Recorded By</th>
                    <th className="py-2 px-2 font-black">Last Updated</th>
                    <th className="py-2 px-2 font-black">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {outsideGridSlots.map(({ hour, slot }) => {
                    const canAct = Boolean(slot.entryId);
                    return (
                      <tr
                        key={`outside-${hour}`}
                        className={`border-b border-accent-soft/60 text-xs font-semibold text-primary ${
                          String(slot.entrySource || '').toLowerCase().includes('greeter') ? 'bg-accent/5' : ''
                        }`}
                      >
                        <td className="py-2 px-2 whitespace-nowrap">
                          {formatSlotLabel(hour)}
                          <span className="block text-[10px] font-mono text-primary/55">{String(hour).padStart(2, '0')}:00 IST</span>
                        </td>
                        <td className="py-2 px-2 text-right font-black tabular-nums">{(Number(slot.visitors) || 0).toLocaleString('en-IN')}</td>
                        <td className="py-2 px-2"><SourceBadge source={slot.entrySource} /></td>
                        <td className="py-2 px-2 whitespace-nowrap">{slot.submittedBy || '—'}</td>
                        <td className="py-2 px-2 whitespace-nowrap font-mono">{formatIstStamp(slot.updatedAt || slot.createdAt)}</td>
                        <td className="py-2 px-2">
                          {canAct ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setHistoryEntry(slotToTarget(hour, slot))}
                                title="View edit history for this hour"
                                className="px-2.5 py-1.5 rounded-lg bg-white border border-accent-soft text-[10px] font-black uppercase tracking-wider text-primary hover:bg-[#F7F5F0] transition-all flex items-center gap-1 whitespace-nowrap"
                              >
                                <History className="w-3 h-3 text-accent" />
                                <span>History</span>
                              </button>
                              {isManagementUser && (
                                <button
                                  type="button"
                                  onClick={() => setEditingEntry(slotToTarget(hour, slot))}
                                  title="Correct this footfall entry"
                                  className="px-2.5 py-1.5 rounded-lg bg-primary text-white text-[10px] font-black uppercase tracking-wider hover:bg-[#082821] transition-all flex items-center gap-1 whitespace-nowrap"
                                >
                                  <Pencil className="w-3 h-3" />
                                  <span>Edit</span>
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-primary/45">Read only</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="text-xs font-black text-primary">
                    <td className="py-2 px-2">Outside-grid total</td>
                    <td className="py-2 px-2 text-right tabular-nums">{outsideGridTotal.toLocaleString('en-IN')}</td>
                    <td className="py-2 px-2 font-semibold text-primary/70" colSpan={4}>
                      Grid {gridTotal.toLocaleString('en-IN')} + outside {outsideGridTotal.toLocaleString('en-IN')} = {totalFootfall.toLocaleString('en-IN')} daily visitors
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Recorded Entries — audit view for the selected store and date */}
        <div className="card-glass p-5 lg:p-6 border border-accent-soft/80 bg-white/80 backdrop-blur-xl shadow-lg rounded-2xl space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-accent-soft pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-accent" />
              <h3 className="font-extrabold text-primary text-sm uppercase tracking-wider">
                Recorded Footfall Entries
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-primary/70">
                {activeStore.name} · {formatIstDate(date)}
              </span>
              {entriesLoading && (
                <span className="text-[10px] font-black uppercase tracking-wider text-accent">Refreshing...</span>
              )}
              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border whitespace-nowrap ${
                isManagementUser
                  ? 'bg-primary/10 border-primary/25 text-primary'
                  : 'bg-background border-accent-soft text-[#5D4E42]'
              }`}>
                {isManagementUser ? 'Management: corrections enabled' : 'Corrections limited to management'}
              </span>
            </div>
          </div>

          <div className="table-frame custom-scrollbar -mx-1">
            <table className="w-full min-w-[1080px] text-left border-collapse">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-primary/70 border-b border-accent-soft">
                  <th className="py-2 px-2 font-black">Date</th>
                  <th className="py-2 px-2 font-black">Location</th>
                  <th className="py-2 px-2 font-black">Slot</th>
                  <th className="py-2 px-2 font-black text-right">Footfall</th>
                  <th className="py-2 px-2 font-black">Source</th>
                  <th className="py-2 px-2 font-black">Entered By</th>
                  <th className="py-2 px-2 font-black">Entry Time</th>
                  <th className="py-2 px-2 font-black">Last Updated By</th>
                  <th className="py-2 px-2 font-black">Edits</th>
                  <th className="py-2 px-2 font-black">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-6 px-2 text-center text-xs font-semibold text-primary/60">
                      {entriesLoading ? (
                        'Loading footfall entries...'
                      ) : entriesError ? (
                        <span className="inline-flex flex-col items-center gap-2">
                          <span className="text-rose-700 font-bold">
                            The entry list could not be loaded: {entriesError}
                          </span>
                          <span className="text-[11px] font-bold text-primary/60">
                            The visitor counts above may be incomplete. This is a connection problem, not an empty day.
                          </span>
                          <button
                            type="button"
                            onClick={() => fetchEntries(date, effectiveLocationId)}
                            className="px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-black uppercase tracking-wider hover:bg-primary-dark cursor-pointer"
                          >
                            Try again
                          </button>
                        </span>
                      ) : filtersActive
                        ? `No entries match the selected filters for ${activeStore.name} on ${formatIstDate(date)}.`
                        : `No footfall recorded for ${activeStore.name} on ${formatIstDate(date)} yet.`}
                    </td>
                  </tr>
                ) : (
                  entries.map((row) => {
                    const hour = Number(row.slotHour);
                    const outsideGrid = !slotHours.includes(hour);
                    const canAct = Boolean(row.id);
                    return (
                      <tr
                        key={String(row.id)}
                        className={`border-b border-accent-soft/60 text-xs font-semibold text-primary ${
                          String(row.entry_source || '').toLowerCase().includes('greeter') ? 'bg-accent/5' : ''
                        }`}
                      >
                        <td className="py-2 px-2 whitespace-nowrap font-mono">{formatIstDate(row.entryDate || date)}</td>
                        <td className="py-2 px-2 whitespace-nowrap">{row.location_name || activeStore.name}{row.location_code ? ` (${row.location_code})` : ''}</td>
                        <td className="py-2 px-2 whitespace-nowrap">
                          {formatSlotLabel(hour)}
                          {outsideGrid && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded-md bg-primary text-accent text-[9px] font-black uppercase tracking-wider">
                              Outside grid
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-right font-black tabular-nums">{(Number(row.visitors) || 0).toLocaleString('en-IN')}</td>
                        <td className="py-2 px-2"><SourceBadge source={row.entry_source} /></td>
                        <td className="py-2 px-2"><EditorCell name={row.created_by || row.submittedBy} role={row.created_by_role} /></td>
                        <td className="py-2 px-2 whitespace-nowrap font-mono">{formatIstStamp(row.createdAt)}</td>
                        <td className="py-2 px-2">
                          <EditorCell name={row.updated_by} role={row.updated_by_role} />
                          <span className="block text-[10px] font-mono text-primary/60 mt-0.5">
                            {formatIstStamp(row.updatedAt || row.createdAt)}
                          </span>
                        </td>
                        <td className="py-2 px-2"><EditedBadge editCount={row.edit_count} lastEditedAt={row.last_edited_at} /></td>
                        <td className="py-2 px-2">
                          {canAct ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setHistoryEntry(entryToTarget(row))}
                                title="View edit history for this entry"
                                className="px-2.5 py-1.5 rounded-lg bg-white border border-accent-soft text-[10px] font-black uppercase tracking-wider text-primary hover:bg-[#F7F5F0] transition-all flex items-center gap-1 whitespace-nowrap"
                              >
                                <History className="w-3 h-3 text-accent" />
                                <span>History</span>
                              </button>
                              {isManagementUser && (
                                <button
                                  type="button"
                                  onClick={() => setEditingEntry(entryToTarget(row))}
                                  title="Correct this footfall entry"
                                  className="px-2.5 py-1.5 rounded-lg bg-primary text-white text-[10px] font-black uppercase tracking-wider hover:bg-[#082821] transition-all flex items-center gap-1 whitespace-nowrap"
                                >
                                  <Pencil className="w-3 h-3" />
                                  <span>Edit</span>
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-primary/45">No record id</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {entries.length > 0 && (
                <tfoot>
                  <tr className="text-xs font-black text-primary">
                    <td className="py-2 px-2" colSpan={3}>
                      Total for {activeStore.name}{filtersActive ? ' (filtered)' : ''}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">{entriesTotal.toLocaleString('en-IN')}</td>
                    <td className="py-2 px-2 font-semibold text-primary/70" colSpan={6}>
                      {entries.length} {entries.length === 1 ? 'entry' : 'entries'} listed · register total {totalFootfall.toLocaleString('en-IN')}
                      {filtersActive ? ' (filters hide rows above)' : ` across ${recordedEntries.length} of ${slotHours.length} operating slots + ${outsideGridSlots.length} outside`}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Management correction + audit trail dialogs */}
        <FootfallEditModal
          entry={editingEntry}
          stores={allLocations.map(loc => ({ id: loc.id, name: loc.name, code: loc.code }))}
          canChangeLocation={isGlobalAdmin || canSwitch || allLocations.length > 1}
          onClose={() => setEditingEntry(null)}
          onUpdated={refreshAfterCorrection}
        />
        <FootfallHistoryModal
          entry={historyEntry}
          stores={allLocations.map(loc => ({ id: loc.id, name: loc.name, code: loc.code }))}
          onClose={() => setHistoryEntry(null)}
        />
        </div>
      </PageContainer>
    </DashboardLayout>
  );
}
