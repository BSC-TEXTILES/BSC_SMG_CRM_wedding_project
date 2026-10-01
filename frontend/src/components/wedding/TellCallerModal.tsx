import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2, CircleAlert, Clock, RefreshCw, Search, Send, Store, User, Users, X
} from 'lucide-react';
import { API } from '../../services/api';
import { lockBodyScroll, unlockBodyScroll } from '../ui/ModalPortal';
import { showToast } from '../Toast';
import { formatDateTimeDisplay } from '../../utils/dateUtils';

/**
 * "Tell Caller" — a CRM Manager sends an instruction about one customer to one
 * telecaller. It does NOT change the assignment (that stays Reassign Telecaller).
 *
 * The telecaller list is whatever the server returns for the signed-in user: a store
 * manager only ever receives their own store's staff, and the send endpoint re-checks
 * it, so this component cannot be talked into another store by editing the client.
 */

export interface TellCallerCustomer {
  id: number | string;
  customer_name: string;
  customer_code?: string | null;
  mobile_number?: string | null;
  location_id?: number | string | null;
  location_name?: string | null;
  wedding_date?: string | null;
  expected_shopping_date?: string | null;
  customer_status?: string | null;
  assigned_telecaller?: string | null;
  assigned_telecaller_id?: number | string | null;
}

interface TelecallerOption {
  id: number;
  full_name: string;
  name?: string;
  role?: string;
  designation?: string | null;
  department?: string | null;
  location_id?: number | null;
  location_name?: string | null;
  location_code?: string | null;
  assigned_count?: number;
  last_activity?: string | null;
}

interface InstructionRow {
  id: number;
  telecallerName: string;
  sentByName?: string | null;
  message: string;
  status: string;
  priority?: string;
  createdAt?: string | null;
  seenAt?: string | null;
  acknowledgedAt?: string | null;
  completedAt?: string | null;
}

const PRIORITIES = ['Normal', 'High', 'Urgent'];
const MESSAGE_MAX = 2000;

const STATUS_STYLE: Record<string, string> = {
  New: 'bg-[#EDF3F0] text-[#082821] border-[#C9A45C]/30',
  Seen: 'bg-[#EAF1FA] text-[#356AE6] border-[#356AE6]/25',
  Acknowledged: 'bg-[#FFF4D6] text-[#8A6212] border-[#C58A18]/30',
  Completed: 'bg-[#E8F5EE] text-[#198754] border-[#198754]/25'
};

export default function TellCallerModal({
  customer,
  onClose,
  onSent
}: {
  customer: TellCallerCustomer;
  onClose: () => void;
  onSent?: () => void;
}) {
  const [telecallers, setTelecallers] = useState<TelecallerOption[]>([]);
  const [history, setHistory] = useState<InstructionRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState('Normal');
  const [messageError, setMessageError] = useState<string | null>(null);

  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const callers = await API.getWeddingTelecallers();
      const list: TelecallerOption[] = callers?.telecallers || callers?.data?.telecallers || [];
      setTelecallers(list);
      // Pre-select whoever the customer is already assigned to, when they are on the list.
      const assigned = list.find((t) => String(t.id) === String(customer.assigned_telecaller_id || ''));
      setSelectedId((prev) => prev || (assigned ? String(assigned.id) : ''));
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load the telecaller list for your stores. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [customer.id, customer.assigned_telecaller_id]);

  // A failed history read is reported, not hidden: the manager must not conclude from
  // an empty list that nobody has been instructed yet.
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await API.getTelecallerInstructions({ customer_id: customer.id, limit: 20 });
      if (res?.success === false) throw new Error(res.message || 'load failed');
      setHistory(res?.instructions || res?.data?.instructions || []);
    } catch (err: any) {
      setHistoryError(err?.message || 'Unable to load the instructions already sent for this customer.');
    } finally {
      setHistoryLoading(false);
    }
  }, [customer.id]);

  useEffect(() => { load(); loadHistory(); }, [load, loadHistory]);

  useEffect(() => {
    lockBodyScroll();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !sending) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      unlockBodyScroll();
    };
  }, [onClose, sending]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return telecallers;
    return telecallers.filter((t) =>
      [t.full_name, t.name, t.designation, t.department, t.location_name, t.location_code, String(t.id)]
        .some((v) => String(v || '').toLowerCase().includes(q))
    );
  }, [telecallers, query]);

  const selected = telecallers.find((t) => String(t.id) === selectedId) || null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current || sending) return;

    const trimmed = message.trim();
    if (!trimmed) {
      setMessageError('Please enter a message for the telecaller.');
      return;
    }
    setMessageError(null);
    if (!selected) {
      setSendError('Choose the telecaller this instruction is for.');
      return;
    }

    setSending(true);
    setSendError(null);
    inFlight.current = true;
    try {
      const res = await API.sendTelecallerInstruction(customer.id, {
        telecaller_user_id: selected.id,
        message: trimmed,
        priority
      });
      if (res?.success === false) throw new Error(res.message || 'send failed');

      showToast('Message sent to the telecaller successfully.', 'success');
      onSent?.();
      onClose();
    } catch (err: any) {
      // A refused duplicate is worth showing plainly: it means the first send worked.
      setSendError(err?.message || 'Unable to send the message to the telecaller. Please try again.');
      showToast(err?.message || 'Unable to send the message to the telecaller. Please try again.', 'error');
      if (err?.data?.duplicate) {
        await load();
      }
    } finally {
      setSending(false);
      inFlight.current = false;
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overscroll-contain animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget && !sending) onClose(); }}
    >
      <div
        className="bg-[#FFFFFF] rounded-2xl sm:rounded-3xl w-full max-w-2xl max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)] shadow-2xl border border-[#E1DDD3] flex flex-col overflow-hidden animate-scale-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tell-caller-title"
      >
        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b border-[#E1DDD3] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#123C35] flex items-center justify-center shrink-0">
              <Send className="w-4 h-4 text-[#E4CB92]" />
            </div>
            <div className="min-w-0">
              <h3 id="tell-caller-title" className="text-base font-bold text-[#123C35]">Tell Caller</h3>
              <p className="text-xs text-[#65716C] truncate">
                Send an instruction to a telecaller — the assignment itself does not change.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => !sending && onClose()}
            className="p-1.5 text-[#65716C] hover:text-[#123C35] hover:bg-[#EDF3F0] rounded-xl transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSend} className="flex-1 overflow-y-auto min-h-0 px-5 sm:px-6 py-5 space-y-5 text-xs custom-scrollbar">
          {/* Customer in focus */}
          <div className="rounded-xl border border-[#E1DDD3] bg-[#EDF3F0] p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#65716C]">Customer</span>
              <span className="text-[10px] font-mono text-[#9A858D]">{customer.customer_code || `#${customer.id}`}</span>
            </div>
            <p className="mt-1 text-sm font-bold text-[#123C35] break-words">{customer.customer_name}</p>
            <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
              <Detail label="Mobile" value={customer.mobile_number || '—'} mono />
              <Detail label="Store" value={customer.location_name || '—'} />
              <Detail label="Status" value={customer.customer_status || '—'} />
              <Detail label="Wedding date" value={formatDate(customer.wedding_date)} />
              <Detail label="Expected shopping" value={formatDate(customer.expected_shopping_date)} />
              <Detail label="Assigned telecaller" value={customer.assigned_telecaller || 'Unassigned'} />
            </dl>
          </div>

          {loading && (
            <p className="flex items-center gap-2 text-[12px] font-bold text-[#356AE6]">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Loading telecallers for your stores…</span>
            </p>
          )}

          {!loading && loadError && (
            <div className="flex items-start gap-2 rounded-xl border border-[#B42318]/30 bg-[#FDE8E7] px-3 py-2.5">
              <CircleAlert className="w-4 h-4 shrink-0 mt-0.5 text-[#B42318]" />
              <div className="min-w-0">
                <p className="break-words text-[12px] font-bold leading-snug text-[#9B1C15]">{loadError}</p>
                <button type="button" onClick={load} className="mt-1.5 font-bold text-[#9B1C15] underline cursor-pointer">
                  Try again
                </button>
              </div>
            </div>
          )}

          {!loading && !loadError && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="tell-caller-search" className="text-[10px] font-bold uppercase tracking-wider text-[#65716C]">
                  Select telecaller <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-[#9A858D]">{filtered.length} of {telecallers.length} available</span>
              </div>

              <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 w-3.5 h-3.5 -translate-y-1/2 text-[#9A858D]" />
                <input
                  id="tell-caller-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, role or store"
                  autoComplete="off"
                  className="w-full rounded-xl border border-[#E1DDD3] bg-[#F7F5F0] py-2.5 pl-9 pr-3 font-semibold text-[#17201D] placeholder:font-normal placeholder:text-[#9A858D] focus:border-[#C9A45C] focus:outline-none"
                />
              </div>

              {telecallers.length === 0 ? (
                <p className="mt-3 rounded-xl border border-[#E1DDD3] bg-[#EDF3F0] px-3 py-3 text-[12px] font-semibold text-[#65716C]">
                  No telecaller accounts are available for your stores. An administrator needs to activate one in User Management.
                </p>
              ) : (
                <div className="mt-2.5 max-h-64 space-y-1.5 overflow-y-auto rounded-xl border border-[#E1DDD3] bg-[#F7F5F0] p-2 custom-scrollbar" role="radiogroup" aria-label="Telecaller">
                  {filtered.length === 0 && (
                    <p className="px-2 py-3 text-[12px] font-semibold text-[#65716C]">No telecaller matches “{query}”.</p>
                  )}
                  {filtered.map((t) => {
                    const isSelected = String(t.id) === selectedId;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setSelectedId(String(t.id))}
                        className={`w-full rounded-xl border px-3 py-2.5 text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#C9A45C] bg-[#123C35] text-white shadow-xs'
                            : 'border-[#E1DDD3] bg-[#FFFFFF] text-[#17201D] hover:border-[#C9A45C]/50 hover:bg-[#EDF3F0]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className={`truncate text-xs font-bold ${isSelected ? 'text-white' : 'text-[#17201D]'}`}>
                              {t.full_name || t.name}
                            </p>
                            <p className={`mt-0.5 truncate text-[10px] ${isSelected ? 'text-[#E4CB92]' : 'text-[#65716C]'}`}>
                              {[t.designation || t.role, t.department].filter(Boolean).join(' · ') || 'Telecaller'}
                            </p>
                          </div>
                          <div className={`shrink-0 text-right text-[10px] ${isSelected ? 'text-[#E4CB92]' : 'text-[#9A858D]'}`}>
                            <p className="flex items-center justify-end gap-1 font-bold uppercase tracking-wide">
                              <Store className="w-3 h-3" />
                              <span>{t.location_name || 'All Locations'}</span>
                            </p>
                            <p className="mt-0.5">{t.assigned_count ?? 0} customers</p>
                          </div>
                        </div>
                        {isSelected && (
                          <p className="mt-1 flex items-center gap-1 text-[10px] font-bold text-[#E4CB92]">
                            <CheckCircle2 className="w-3 h-3" /> Selected
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="tell-caller-message" className="text-[10px] font-bold uppercase tracking-wider text-[#65716C]">
                Instruction <span className="text-rose-500">*</span>
              </label>
              <span className={`text-[10px] ${message.length > MESSAGE_MAX - 100 ? 'text-[#C58A18]' : 'text-[#9A858D]'}`}>
                {message.length}/{MESSAGE_MAX}
              </span>
            </div>
            <textarea
              id="tell-caller-message"
              rows={4}
              maxLength={MESSAGE_MAX}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                if (messageError && e.target.value.trim()) setMessageError(null);
              }}
              aria-invalid={Boolean(messageError)}
              aria-describedby={messageError ? 'tell-caller-message-error' : 'tell-caller-message-help'}
              placeholder="e.g. Please call the customer after 6 PM."
              className={`mt-2 w-full rounded-xl border bg-[#F7F5F0] px-3.5 py-2.5 font-medium text-xs text-[#17201D] focus:outline-none ${
                messageError ? 'border-[#B42318]' : 'border-[#E1DDD3] focus:border-[#C9A45C]'
              }`}
            />
            {messageError ? (
              <p id="tell-caller-message-error" role="alert" className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-[#A52A1A]">
                <CircleAlert className="w-3.5 h-3.5 shrink-0" />
                <span>{messageError}</span>
              </p>
            ) : (
              <p id="tell-caller-message-help" className="mt-1.5 text-[11px] text-[#9A858D]">
                The telecaller sees this in their desk with the customer’s name attached.
              </p>
            )}
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#65716C]">Priority</span>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {PRIORITIES.map((p) => {
                const isSelected = priority === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    aria-pressed={isSelected}
                    className={`min-h-[38px] rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#123C35] bg-[#123C35] text-white'
                        : 'border-[#E1DDD3] bg-[#F7F5F0] text-[#123C35] hover:border-[#C9A45C]/60'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          {sendError && (
            <div className="flex items-start gap-2 rounded-xl border border-[#B42318]/30 bg-[#FDE8E7] px-3 py-2.5" role="alert">
              <CircleAlert className="w-4 h-4 shrink-0 mt-0.5 text-[#B42318]" />
              <p className="break-words text-[12px] font-bold leading-snug text-[#9B1C15]">{sendError}</p>
            </div>
          )}

          {historyLoading && (
            <p className="flex items-center gap-2 text-[11px] font-bold text-[#65716C]">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Loading the instructions already sent…</span>
            </p>
          )}

          {!historyLoading && historyError && (
            <div className="flex items-start gap-2 rounded-xl border border-[#C58A18]/30 bg-[#FFF4D6] px-3 py-2.5">
              <CircleAlert className="mt-0.5 w-4 h-4 shrink-0 text-[#8A6212]" />
              <div className="min-w-0">
                <p className="break-words text-[11px] font-bold leading-snug text-[#8A6212]">{historyError}</p>
                <button type="button" onClick={loadHistory} className="mt-1 text-[11px] font-bold text-[#8A6212] underline cursor-pointer">
                  Try again
                </button>
              </div>
            </div>
          )}

          {!historyLoading && !historyError && history.length > 0 && (
            <div>
              <h4 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#65716C]">
                <Clock className="w-3.5 h-3.5 text-[#C9A45C]" />
                <span>Instructions already sent ({history.length})</span>
              </h4>
              <ul className="mt-2 space-y-2">
                {history.map((h) => (
                  <li key={h.id} className="rounded-xl border border-[#E1DDD3] bg-white px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-bold text-[#123C35]">
                        <User className="w-3 h-3 shrink-0 text-[#C9A45C]" />
                        <span className="truncate">{h.telecallerName}</span>
                      </span>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${STATUS_STYLE[h.status] || STATUS_STYLE.New}`}>
                        {h.status}
                      </span>
                    </div>
                    <p className="mt-1 break-words text-[11px] leading-snug text-[#17201D]">{h.message}</p>
                    <p className="mt-1 text-[10px] text-[#9A858D]">
                      {h.sentByName ? `${h.sentByName} · ` : ''}{formatDateTimeDisplay(h.createdAt || '')}
                      {h.priority && h.priority !== 'Normal' ? ` · ${h.priority}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </form>

        <div className="flex items-center justify-end gap-3 px-5 sm:px-6 py-4 border-t border-[#E1DDD3] shrink-0">
          <button
            type="button"
            onClick={() => !sending && onClose()}
            disabled={sending}
            className="rounded-xl border border-[#E1DDD3] bg-[#F7F5F0] px-4 py-2 font-semibold text-xs text-[#123C35] hover:bg-[#EDF3F0] disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSend}
            disabled={sending || loading || !selected || !message.trim()}
            className="flex items-center gap-1.5 rounded-xl border border-[#C9A45C]/30 bg-[#123C35] px-5 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-[#082821] disabled:opacity-40 cursor-pointer"
          >
            {sending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 text-[#E4CB92]" />}
            <span>{sending ? 'Sending...' : 'Send to Telecaller'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[9px] font-bold uppercase tracking-wider text-[#9A858D]">{label}</dt>
      <dd className={`mt-0.5 truncate text-[11px] font-bold text-[#17201D] ${mono ? 'font-mono' : ''}`} title={value}>{value}</dd>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
