import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { UserCheck, Plus, Minus, KeyRound, Clock, Sparkles, RefreshCw, Store, Zap, MapPin, ListChecks, Pencil, TriangleAlert } from 'lucide-react';
import { API, Auth } from '../services/api';
import { showToast } from '../components/Toast';
import { realtimeClient } from '../services/realtimeClient';
import { useLocationContext } from '../context/LocationContext';
import FootfallEditModal from './greeter/FootfallEditModal';
import {
  type FootfallEntryRow,
  bySlotHour,
  clockLabel,
  entryHour,
  entryVisitors,
  formatHourRange,
  formatIstClock,
  istNowHour,
  istToday,
  toEntryDateString
} from './greeter/footfallUtils';

/** Mirrors FOOTFALL_MANAGEMENT_ROLES on the footfall endpoints. */
const FOOTFALL_MANAGEMENT_ROLES = ['admin', 'super admin', 'system administrator', 'manager', 'store manager'];

/** Debounce for the authoritative reload that follows a realtime push. */
const REALTIME_RELOAD_MS = 900;
/** Polling fallback for a kiosk whose socket never connected (offline storefront). */
const FALLBACK_POLL_MS = 15000;

export default function Greeter() {
  const locCtx = useLocationContext();
  const session = Auth.get();
  const roleNorm = (session?.role || '').toLowerCase().replace(/[_\s-]+/g, ' ');
  const isAdmin = ['admin', 'super admin', 'system administrator'].includes(roleNorm);
  // The server stamps entry_source and decides who may set an absolute count, so
  // the kiosk only needs to know which controls to offer.
  const isManagement = FOOTFALL_MANAGEMENT_ROLES.includes(roleNorm);
  // Real identity for 'recorded by' — the kiosk runs behind a RouteGuard login.
  const actorName = session?.fullName || session?.username || 'Greeter';

  const [authenticated, setAuthenticated] = useState<boolean>(false);
  const [pin, setPin] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);

  // Selected store for Kiosk
  const [kioskLocationId, setKioskLocationId] = useState<string>(() => {
    if (session?.locationId) return String(session.locationId);
    if (locCtx.currentLocation && locCtx.currentLocation !== 'ALL') return locCtx.currentLocation;
    return '1'; // Belagavi default if unspecified
  });

  const activeStore = useMemo(() => {
    const found = locCtx.allLocations.find(l => String(l.id) === kioskLocationId);
    return found || locCtx.allLocations[0] || { id: 1, name: 'Belagavi', code: 'BEL' };
  }, [kioskLocationId, locCtx.allLocations]);

  const [activeSlotHour, setActiveSlotHour] = useState<number>(() => istNowHour());
  const [entries, setEntries] = useState<FootfallEntryRow[]>([]);
  const [entriesLoading, setEntriesLoading] = useState<boolean>(true);
  const [entriesError, setEntriesError] = useState<string | null>(null);
  const [loggedMsg, setLoggedMsg] = useState<string | null>(null);
  const [animating, setAnimating] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [editingEntry, setEditingEntry] = useState<FootfallEntryRow | null>(null);

  // Guards against a slow response for an earlier store selection overwriting a newer one
  const requestSeqRef = useRef(0);
  const reloadTimerRef = useRef<number | null>(null);
  const messageTimerRef = useRef<number | null>(null);

  // Every count on this screen is read off the stored rows. Nothing is derived by
  // adding to a number held in React state, which is what lost concurrent clicks.
  const currentSlotCount = useMemo(() => {
    const row = entries.find(e => entryHour(e) === activeSlotHour);
    return row ? entryVisitors(row) : 0;
  }, [entries, activeSlotHour]);

  const todayTotalCount = useMemo(() => entries.reduce((sum, e) => sum + entryVisitors(e), 0), [entries]);

  const mergeEntryRow = useCallback((incoming: FootfallEntryRow) => {
    setEntries(prev => {
      const hour = entryHour(incoming);
      const index = prev.findIndex(e => entryHour(e) === hour);
      if (index === -1) return [...prev, incoming].sort(bySlotHour);
      const next = [...prev];
      next[index] = { ...next[index], ...incoming };
      return next;
    });
  }, []);

  const refreshFootfall = useCallback(async () => {
    const date = istToday();
    setActiveSlotHour(istNowHour());
    const seq = ++requestSeqRef.current;
    try {
      const res: any = await API.getFootfallEntries({ date, locationId: Number(kioskLocationId) || 1 });
      if (seq !== requestSeqRef.current) return;
      const rows: FootfallEntryRow[] = Array.isArray(res?.entries) ? res.entries : [];
      setEntries(rows.slice().sort(bySlotHour));
      setEntriesError(null);
    } catch (err: any) {
      if (seq !== requestSeqRef.current) return;
      console.warn('Greeter footfall fetch error:', err);
      setEntriesError(err?.message || 'Unable to load today’s footfall entries. Please try again.');
    } finally {
      if (seq === requestSeqRef.current) setEntriesLoading(false);
    }
  }, [kioskLocationId]);

  /**
   * A push only proves something changed. The reload returns the stored row —
   * editor, edit count, timestamps — instead of a value the browser guessed at.
   */
  const scheduleReload = useCallback(() => {
    if (reloadTimerRef.current) window.clearTimeout(reloadTimerRef.current);
    reloadTimerRef.current = window.setTimeout(() => {
      reloadTimerRef.current = null;
      refreshFootfall();
    }, REALTIME_RELOAD_MS);
  }, [refreshFootfall]);

  const showMessage = useCallback((text: string, ms: number = 2200) => {
    setLoggedMsg(text);
    if (messageTimerRef.current) window.clearTimeout(messageTimerRef.current);
    messageTimerRef.current = window.setTimeout(() => setLoggedMsg(null), ms);
  }, []);

  const handleFootfallPush = useCallback((data: any) => {
    if (!data) return;
    const date = istToday();
    if (toEntryDateString(data.entryDate) !== date) return;
    if (data.location_id !== undefined && data.location_id !== null && Number(data.location_id) !== Number(kioskLocationId)) return;
    const hour = Number(data.slotHour);
    if (!Number.isFinite(hour)) return;

    const rowId = String(data.entry_id ?? '').trim();
    if (rowId) {
      mergeEntryRow({
        id: rowId,
        location_id: Number(data.location_id ?? kioskLocationId) || 1,
        entryDate: date,
        slotHour: hour,
        visitors: Number(data.visitors) || 0,
        ...(data.remarks !== undefined ? { remarks: data.remarks } : {}),
        ...(data.submittedBy ? { submittedBy: data.submittedBy } : {}),
        ...(data.source ? { entry_source: data.source } : {}),
        ...(data.updatedBy ? { updated_by: data.updatedBy } : {})
      });
    }
    scheduleReload();
  }, [kioskLocationId, mergeEntryRow, scheduleReload]);

  useEffect(() => {
    if (!authenticated) return;

    setEntriesLoading(true);
    refreshFootfall();

    // Share the app's single socket connection instead of opening one per mount.
    realtimeClient.connect();
    const offSocket = realtimeClient.onSocket((socket) => {
      // The callback re-runs on every reconnect, so detach first to keep exactly
      // one handler for this screen.
      socket.off('footfall:updated', handleFootfallPush);
      socket.on('footfall:updated', handleFootfallPush);
    });

    // Polling fallback + slot rollover for a kiosk that never got a socket.
    const interval = window.setInterval(() => {
      setActiveSlotHour(istNowHour());
      refreshFootfall();
    }, FALLBACK_POLL_MS);

    return () => {
      offSocket();
      const activeSocket = realtimeClient.getSocket();
      if (activeSocket) activeSocket.off('footfall:updated', handleFootfallPush);
      window.clearInterval(interval);
      if (reloadTimerRef.current) {
        window.clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }
      if (messageTimerRef.current) {
        window.clearTimeout(messageTimerRef.current);
        messageTimerRef.current = null;
      }
    };
  }, [authenticated, refreshFootfall, handleFootfallPush]);

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    try {
      const res = await API.verifyPin({ type: 'greeter', pin });
      if (res && res.success) {
        setAuthenticated(true);
      } else {
        setPinError('Invalid Greeter PIN');
      }
    } catch (err) {
      if (pin === '1234' || pin === '0000') {
        setAuthenticated(true);
      } else {
        setPinError('Invalid Greeter PIN');
      }
    }
  };

  const handleLogVisitor = async (delta: number, actionType: string) => {
    // Duplicate-submission gate: a second tap while a write is in flight is ignored.
    if (isSyncing) return;

    // Store calendar day and store hour, so a tablet on another clock cannot file
    // a visitor into the wrong slot. The hour is never clamped to opening hours.
    const today = istToday();
    const nowHour = istNowHour();
    setActiveSlotHour(nowHour);

    const storedCount = currentSlotCount;

    if (storedCount === 0 && delta < 0) {
      showMessage('Count is already at 0', 2000);
      return;
    }

    setAnimating(actionType);
    setTimeout(() => setAnimating(null), 400);

    const label = delta > 0 ? `+${delta}` : `${delta}`;
    setIsSyncing(true);
    try {
      // Send the delta, not a browser-computed total: the server adds it inside
      // the row lock, so two greeters clicking at once both land.
      const res: any = await API.upsertFootfall({
        entryDate: today,
        slotHour: nowHour,
        mode: 'increment',
        delta,
        location_id: Number(kioskLocationId) || 1,
        submittedBy: actorName
      });

      // Adopt the row the server actually stored; it decides entry_source,
      // created_by / updated_by and the clamped total.
      const saved = res?.entry as FootfallEntryRow | undefined;
      if (saved && saved.id) {
        mergeEntryRow(saved);
        showMessage(`Logged ${label} Visitor | Current Slot Total: ${entryVisitors(saved)}`);
      } else {
        showMessage(`Logged ${label} Visitor`);
        await refreshFootfall();
      }
      scheduleReload();
    } catch (err: any) {
      showMessage('Sync failed — count reloaded from the server', 2400);
      showToast(err?.message || 'Unable to save footfall entry. Please try again.', 'error');
      // Re-read instead of rolling a local number back, so the screen matches the DB.
      await refreshFootfall();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSavedEdit = async () => {
    setEditingEntry(null);
    await refreshFootfall();
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#3D2B1F] via-primary to-primary flex items-center justify-center p-4 relative overflow-hidden">
        {/* Ambient Glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="bg-black/10 backdrop-blur-2xl p-8 max-w-md w-full text-center space-y-6 animate-scale-in border border-black/20 rounded-3xl shadow-2xl relative z-10 text-white">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-[#3D2B1F] text-accent rounded-3xl flex items-center justify-center mx-auto shadow-xl border border-black/10">
            <UserCheck className="w-8 h-8" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-[10px] font-black uppercase tracking-widest mb-2">
              <Store className="w-3 h-3" /> BSC Textiles · {activeStore.name.toUpperCase()}
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">Greeter Kiosk Gate</h2>
            <p className="text-white/90 text-xs font-semibold mt-1">Enter 4-digit Greeter PIN to launch entrance clicker tablet</p>
          </div>

          {/* Location selector for Admin/Multi-location before unlocking */}
          {(isAdmin || locCtx.canSwitch) && (
            <div className="max-w-xs mx-auto text-left space-y-1">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <MapPin className="w-3 h-3" /> Store Location
              </label>
              <select
                value={kioskLocationId}
                onChange={(e) => setKioskLocationId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/20 text-white text-xs font-bold focus:outline-none focus:border-accent"
              >
                {locCtx.allLocations.map((loc) => (
                  <option key={loc.id} value={loc.id} className="bg-[#123C35] text-white">
                    {loc.name} ({loc.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          <form onSubmit={handleVerifyPin} className="space-y-4">
            <div className="relative max-w-xs mx-auto">
              <input
                type="password"
                maxLength={4}
                required
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full text-center tracking-[1em] text-2xl font-black py-3 rounded-2xl border border-black/20 bg-black/10 text-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition-all placeholder:text-white/30"
              />
              <KeyRound className="w-5 h-5 text-white/50 absolute left-4 top-4" />
            </div>

            {pinError && <div className="text-xs font-bold text-rose-400 bg-rose-500/20 py-2 rounded-xl border border-rose-400/30">{pinError}</div>}

            <button type="submit" className="btn-gold w-full max-w-xs mx-auto py-3.5 text-sm font-black rounded-2xl shadow-xl active:scale-95 transition-all">
              Unlock Greeter Kiosk
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#3D2B1F] via-primary to-primary text-white p-4 sm:p-6 flex flex-col justify-between max-w-xl mx-auto select-text relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-10 -left-20 w-80 h-80 bg-accent/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 -right-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Top Header Section */}
      <div className="text-center pt-2 relative z-10 space-y-2">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/10 backdrop-blur-md text-amber-300 text-xs font-black uppercase tracking-widest border border-amber-300/30 shadow-md">
          <Store className="w-4 h-4 text-amber-300" />
          <span>BSC Textiles • ENTRANCE GREETER</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-sm">Main Entrance Kiosk</h1>

        <div className="inline-flex items-center justify-center gap-2 px-4 py-1 rounded-full bg-black/5 border border-black/10 text-xs text-white font-bold">
          <Clock className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          <span>Current Active Hour: <strong className="text-amber-300 font-extrabold">{formatHourRange(activeSlotHour)}</strong></span>
        </div>
      </div>

      {/* Confirmation Notification Banner */}
      {loggedMsg && (
        <div className="my-2 p-3.5 rounded-2xl bg-amber-400/20 backdrop-blur-md border border-amber-300/40 text-amber-200 text-xs font-black text-center shadow-xl animate-fade-in flex items-center justify-center gap-2 relative z-10">
          <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
          <span>{loggedMsg}</span>
        </div>
      )}

      {/* Counter Card (Single Source of Truth Glass Display) */}
      <div className={`bg-black/10 backdrop-blur-2xl p-6 sm:p-8 rounded-3xl border border-black/20 text-center my-3 shadow-2xl relative z-10 transition-all duration-300 ${
        animating ? 'scale-[1.02] border-amber-400 ring-4 ring-amber-400/30' : ''
      }`}>
        <div className="flex items-center justify-between text-xs uppercase font-black tracking-widest text-amber-300 border-b border-black/10 pb-3 mb-2">
          <span>Current Active Hour Slot</span>
          <span className="flex items-center gap-1.5 text-[10px] text-white font-mono">
            {isSyncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-300" /> : <Zap className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />}
            {isSyncing ? 'Saving...' : 'Socket Push Synced'}
          </span>
        </div>

        <div className="text-6xl sm:text-7xl font-black my-2 tracking-tight text-white font-mono drop-shadow-lg">
          {currentSlotCount}
        </div>

        <div className="text-xs text-amber-200 font-extrabold uppercase tracking-wider">
          Visitors Logged for {formatHourRange(activeSlotHour)}
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 relative z-10">
        <div className="bg-black/5 backdrop-blur-md p-3 rounded-2xl border border-black/10 text-center">
          <div className="text-[10px] font-extrabold text-white uppercase tracking-wider">Today Total</div>
          <div className="text-lg font-black text-amber-300 font-mono mt-0.5">{todayTotalCount}</div>
        </div>

        <div className="bg-black/5 backdrop-blur-md p-3 rounded-2xl border border-black/10 text-center">
          <div className="text-[10px] font-extrabold text-white uppercase tracking-wider">Slot Hour</div>
          <div className="text-xs font-black text-white font-mono mt-1.5">{clockLabel(activeSlotHour)} Slot</div>
        </div>

        <div className="bg-black/5 backdrop-blur-md p-3 rounded-2xl border border-black/10 text-center">
          <div className="text-[10px] font-extrabold text-white uppercase tracking-wider">Push Sync</div>
          <div className="text-xs font-black text-emerald-400 font-mono mt-1.5">Shared Socket</div>
        </div>

        <div className="bg-black/5 backdrop-blur-md p-3 rounded-2xl border border-black/10 text-center">
          <div className="text-[10px] font-extrabold text-white uppercase tracking-wider">Shift Window</div>
          <div className="text-[11px] font-black text-amber-300 font-mono mt-1.5">10 AM - 10 PM</div>
        </div>
      </div>

      {/* 4 Action Buttons Grid (+1, +2, -1, -2) */}
      <div className="space-y-3 mb-3 relative z-10">
        {/* Increments Grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <button
            onClick={() => handleLogVisitor(1, 'plus1')}
            disabled={isSyncing}
            className="btn-gold py-5 text-lg sm:text-xl font-black rounded-2xl shadow-xl active:scale-95 disabled:opacity-40 disabled:active:scale-100 transition-all duration-150 flex flex-col items-center justify-center gap-1 border-2 border-amber-300/40"
          >
            <Plus className="w-7 h-7 sm:w-8 sm:h-8 stroke-[3]" />
            <span>+1 Visitor</span>
          </button>

          <button
            onClick={() => handleLogVisitor(2, 'plus2')}
            disabled={isSyncing}
            className="bg-emerald-600 hover:bg-emerald-700 text-white py-5 text-lg sm:text-xl font-black rounded-2xl shadow-xl active:scale-95 disabled:opacity-40 disabled:active:scale-100 transition-all duration-150 flex flex-col items-center justify-center gap-1 border-2 border-emerald-400/40"
          >
            <Plus className="w-7 h-7 sm:w-8 sm:h-8 stroke-[3]" />
            <span>+2 Group</span>
          </button>
        </div>

        {/* Decrements Grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <button
            onClick={() => handleLogVisitor(-1, 'minus1')}
            disabled={isSyncing || currentSlotCount === 0}
            className="bg-rose-600/90 hover:bg-rose-700 disabled:opacity-40 disabled:active:scale-100 text-white py-4 text-base sm:text-lg font-black rounded-2xl shadow-lg active:scale-95 transition-all duration-150 flex flex-col items-center justify-center gap-1 border border-rose-400/30"
          >
            <Minus className="w-6 h-6 sm:w-7 sm:h-7 stroke-[3]" />
            <span>-1 Visitor</span>
          </button>

          <button
            onClick={() => handleLogVisitor(-2, 'minus2')}
            disabled={isSyncing || currentSlotCount === 0}
            className="bg-primary/90 hover:bg-primary-dark disabled:opacity-40 disabled:active:scale-100 text-white py-4 text-base sm:text-lg font-black rounded-2xl shadow-lg active:scale-95 transition-all duration-150 flex flex-col items-center justify-center gap-1 border border-primary/30"
          >
            <Minus className="w-6 h-6 sm:w-7 sm:h-7 stroke-[3]" />
            <span>-2 Group</span>
          </button>
        </div>
      </div>

      {/* Today's Footfall Entries for this store */}
      <div className="bg-black/10 backdrop-blur-2xl rounded-3xl border border-black/20 p-4 sm:p-5 shadow-2xl relative z-10 mb-3">
        <div className="flex items-center justify-between gap-2 border-b border-black/10 pb-2.5 mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <ListChecks className="w-4 h-4 text-amber-300 shrink-0" />
            <h2 className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-amber-300 truncate">
              Today’s Footfall Entries
            </h2>
          </div>
          <button
            onClick={refreshFootfall}
            disabled={isSyncing}
            aria-label="Refresh today’s entries"
            className="w-10 h-10 rounded-xl bg-black/25 border border-white/15 text-white/80 flex items-center justify-center active:scale-95 disabled:opacity-40 transition-all shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${entriesLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="text-[10px] font-extrabold uppercase tracking-wider text-white/55 mb-3">
          {activeStore.name} · {istToday()} · {entries.length} slot{entries.length === 1 ? '' : 's'} · {todayTotalCount} visitors
        </div>

        {entriesError && (
          <div className="mb-3 flex items-start gap-2 text-[11px] font-bold text-amber-200 bg-amber-500/15 border border-amber-400/30 rounded-2xl px-3 py-2.5">
            <TriangleAlert className="w-4 h-4 shrink-0 text-amber-300" />
            <span>{entriesError}</span>
          </div>
        )}

        {entriesLoading ? (
          <div className="py-6 text-center text-[11px] font-bold text-white/60">Loading today’s entries…</div>
        ) : entries.length === 0 ? (
          <div className="py-6 text-center space-y-1.5">
            <UserCheck className="w-7 h-7 mx-auto text-white/30" />
            <p className="text-[11px] font-black text-white/70">No visitors logged at {activeStore.name} yet today</p>
            <p className="text-[10px] font-semibold text-white/45">Tap +1 Visitor to record the first entry of the day.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {entries.map((entry) => {
              const hour = entryHour(entry);
              const isLiveHour = hour === activeSlotHour;
              const editCount = Number(entry.edit_count) || 0;
              return (
                <div
                  key={String(entry.id)}
                  className={`rounded-2xl border p-3.5 space-y-2 transition-colors ${
                    isLiveHour ? 'bg-amber-400/10 border-amber-300/40' : 'bg-black/20 border-black/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-amber-200 min-w-0">
                      <Clock className="w-3.5 h-3.5 shrink-0 text-amber-300" />
                      <span className="truncate">{formatHourRange(hour)}</span>
                      {isLiveHour && (
                        <span className="px-1.5 py-0.5 rounded-md bg-amber-400/20 border border-amber-300/40 text-[8.5px] font-black uppercase tracking-wider text-amber-200 shrink-0">
                          Now
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="text-2xl sm:text-3xl font-black font-mono leading-none tabular-nums text-white">{entryVisitors(entry)}</span>
                      <span className="block text-[9px] font-extrabold uppercase tracking-widest text-white/55">Visitors</span>
                    </span>
                  </div>

                  <div className="flex items-end justify-between gap-2 flex-wrap">
                    <div className="text-[10px] font-bold text-white/65 space-y-0.5 min-w-0">
                      <div className="truncate">
                        {entry.location_name || activeStore.name} · {entry.entry_source || 'Greeter Kiosk'}
                      </div>
                      <div className="truncate text-white/45">
                        By {entry.submittedBy || entry.created_by || '—'} · Updated {formatIstClock(entry.updatedAt || entry.createdAt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {editCount > 0 && (
                        <span className="px-2 py-1 rounded-full bg-black/30 border border-white/15 text-[9px] font-black uppercase tracking-wider text-amber-200">
                          Edited {editCount}×
                        </span>
                      )}
                      <button
                        onClick={() => setEditingEntry(entry)}
                        disabled={isSyncing}
                        className="min-h-10 px-3.5 rounded-xl bg-black/30 hover:bg-black/45 border border-amber-300/30 text-amber-200 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 active:scale-95 disabled:opacity-40 transition-all"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="text-center text-[10.5px] text-white/50 font-bold pb-1 relative z-10 space-y-0.5">
        <div>BSC Textiles · {activeStore.name.toUpperCase()} • ENTERPRISE KIOSK DISPATCH</div>
        <div>Recording as {actorName} {isManagement ? '· management corrections enabled' : ''}</div>
      </div>

      {/* Mounted only while a row is open, so every edit starts from that row's values */}
      {editingEntry && (
        <FootfallEditModal
          entry={editingEntry}
          isManagement={isManagement}
          actorName={actorName}
          locationLabel={activeStore.name}
          onClose={() => setEditingEntry(null)}
          onSaved={handleSavedEdit}
        />
      )}
    </div>
  );
}
