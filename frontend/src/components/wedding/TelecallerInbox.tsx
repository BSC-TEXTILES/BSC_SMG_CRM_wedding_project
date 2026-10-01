import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, ChevronRight, CircleAlert, Clock, Inbox, Megaphone, RefreshCw, Store
} from 'lucide-react';
import { API } from '../../services/api';
import { showToast } from '../Toast';
import { useRealtimeSection } from '../../hooks/useRealtimeSection';
import { formatDateTimeDisplay } from '../../utils/dateUtils';

/**
 * Instructions a CRM Manager has sent to the signed-in telecaller.
 *
 * The server scopes this list to the authenticated account (`mine=1` is resolved from
 * the token, never from the client), so this component cannot be pointed at another
 * store's inbox. Opening it marks unseen items Seen, and the two actions move the
 * status forward only — the manager's record of what was asked has to stay truthful.
 */

interface Instruction {
  id: number;
  customerId: number;
  customerCode?: string | null;
  customerName: string;
  message: string;
  status: string;
  priority?: string;
  sentByName?: string | null;
  sentByRole?: string | null;
  locationName?: string | null;
  createdAt?: string | null;
  seenAt?: string | null;
  acknowledgedAt?: string | null;
  completedAt?: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  New: 'bg-[#EDF3F0] text-[#082821] border-[#C9A45C]/30',
  Seen: 'bg-[#EAF1FA] text-[#356AE6] border-[#356AE6]/25',
  Acknowledged: 'bg-[#FFF4D6] text-[#8A6212] border-[#C58A18]/30',
  Completed: 'bg-[#E8F5EE] text-[#198754] border-[#198754]/25'
};

const PRIORITY_STYLE: Record<string, string> = {
  High: 'border-[#C58A18]/30 bg-[#FFFFFF]',
  Urgent: 'border-[#B42318]/35 bg-[#FDE8E7]/60'
};

export default function TelecallerInbox() {
  const [items, setItems] = useState<Instruction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await API.getTelecallerInstructions({ mine: 1, limit: 50 });
      if (res?.success === false) throw new Error(res.message || 'load failed');
      const list: Instruction[] = res?.instructions || res?.data?.instructions || [];
      setItems(list);

      // Anything still unread is by definition seen now that the desk is open.
      const unseen = list.filter((i) => i.status === 'New');
      if (unseen.length > 0) {
        const updated = await Promise.all(
          unseen.map((i) =>
            API.updateTelecallerInstructionStatus(i.id, 'Seen')
              .then((r: any) => r?.data?.instruction || r?.instruction)
              .catch(() => null)
          )
        );
        setItems((current) => current.map((row) => {
          const next = updated.find((u: any) => u && u.id === row.id);
          return next || row;
        }));
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to load your CRM instructions. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Live: a manager sending an instruction refreshes this list without a reload.
  useRealtimeSection(['wedding'], () => { load(true); }, { debounceMs: 800 });

  const open = useMemo(() => items.filter((i) => i.status !== 'Completed'), [items]);
  const visible = showAll ? items : open.slice(0, 6);
  const newCount = items.filter((i) => i.status === 'New' || i.status === 'Seen').length;

  const move = async (id: number, status: 'Acknowledged' | 'Completed') => {
    setBusyId(id);
    try {
      const res = await API.updateTelecallerInstructionStatus(id, status);
      if (res?.success === false) throw new Error(res.message || 'update failed');
      const updated = res?.instruction || res?.data?.instruction;
      setItems((current) => current.map((row) => (row.id === id && updated ? updated : row)));
      showToast(`Instruction marked as ${status.toLowerCase()}.`, 'success');
    } catch (err: any) {
      showToast(err?.message || `Unable to mark this instruction as ${status.toLowerCase()}. Please try again.`, 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-[#E1DDD3] bg-[#FFFFFF] shadow-2xs overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-[#E1DDD3] bg-[#EDF3F0]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#123C35] shrink-0">
            <Megaphone className="h-4 w-4 text-[#E4CB92]" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-[#123C35]">CRM Instructions</h2>
            <p className="text-[11px] text-[#65716C] truncate">
              Instructions sent to you about a customer. The assignment itself does not change.
            </p>
          </div>
          {newCount > 0 && (
            <span className="ml-1 shrink-0 rounded-full bg-[#EDF3F0] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#082821]">
              {newCount} new
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border border-[#E1DDD3] bg-[#FFFFFF] px-3 py-1.5 text-[11px] font-bold text-[#123C35] transition-colors hover:bg-[#EDF3F0] disabled:opacity-60 cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-[#C9A45C] ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {loading && items.length === 0 && (
        <div className="space-y-2 p-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-[#EDF3F0]" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="flex items-start gap-2 p-4">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#B42318]" />
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-[#9B1C15]">{error}</p>
            <button type="button" onClick={() => load()} className="mt-1 text-[11px] font-bold text-[#9B1C15] underline cursor-pointer">
              Try again
            </button>
          </div>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="flex items-center gap-2.5 p-5 text-[#65716C]">
          <Inbox className="h-5 w-5 shrink-0 text-[#C9A45C]" />
          <div>
            <p className="text-[12px] font-bold text-[#123C35]">No instructions yet.</p>
            <p className="text-[11px]">A CRM Manager’s note about a customer will appear here the moment it is sent.</p>
          </div>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="divide-y divide-[#F0E4DF]">
          {visible.map((item) => (
            <article
              key={item.id}
              className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between ${PRIORITY_STYLE[item.priority || ''] || ''}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${STATUS_STYLE[item.status] || STATUS_STYLE.New}`}>
                    {item.status}
                  </span>
                  {item.priority && item.priority !== 'Normal' && (
                    <span className="rounded-full border border-[#C58A18]/30 bg-[#FFF4D6] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#8A6212]">
                      {item.priority}
                    </span>
                  )}
                  <Link
                    to={`/wedding-crm/customers/${item.customerId}`}
                    className="truncate text-[13px] font-bold text-[#123C35] hover:underline"
                    title={item.customerName}
                  >
                    {item.customerName}
                  </Link>
                  <span className="font-mono text-[10px] text-[#9A858D]">{item.customerCode || `#${item.customerId}`}</span>
                </div>

                <p className="mt-1.5 break-words text-[12px] leading-relaxed text-[#17201D]">“{item.message}”</p>

                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-[#9A858D]">
                  <span>From <strong className="font-semibold text-[#65716C]">{item.sentByName || 'CRM'}</strong>{item.sentByRole ? ` (${item.sentByRole})` : ''}</span>
                  {item.locationName && (
                    <span className="flex items-center gap-1">
                      <Store className="h-3 w-3" />
                      <span>{item.locationName}</span>
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{formatDateTimeDisplay(item.createdAt || '')}</span>
                  </span>
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {item.status !== 'Completed' && item.status !== 'Acknowledged' && (
                  <button
                    type="button"
                    onClick={() => move(item.id, 'Acknowledged')}
                    disabled={busyId === item.id}
                    className="rounded-xl border border-[#C58A18]/30 bg-[#FFF4D6] px-3 py-1.5 text-[11px] font-bold text-[#8A6212] transition-colors hover:bg-[#FFF4D6]/70 disabled:opacity-60 cursor-pointer"
                  >
                    Acknowledge
                  </button>
                )}
                {item.status !== 'Completed' && (
                  <button
                    type="button"
                    onClick={() => move(item.id, 'Completed')}
                    disabled={busyId === item.id}
                    className="flex items-center gap-1.5 rounded-xl border border-[#198754]/25 bg-[#E8F5EE] px-3 py-1.5 text-[11px] font-bold text-[#198754] transition-colors hover:bg-[#198754]/15 disabled:opacity-60 cursor-pointer"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Completed</span>
                  </button>
                )}
                <Link
                  to={`/wedding-crm/customers/${item.customerId}`}
                  className="flex items-center gap-1 rounded-xl border border-[#E1DDD3] bg-[#FFFFFF] px-3 py-1.5 text-[11px] font-bold text-[#123C35] transition-colors hover:bg-[#EDF3F0]"
                >
                  <span>Open</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </article>
          ))}

          {open.length > 6 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="w-full px-4 py-2.5 text-left text-[11px] font-bold text-[#C9A45C] hover:bg-[#EDF3F0] cursor-pointer"
            >
              {showAll ? 'Show fewer' : `Show all ${items.length} instructions`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
