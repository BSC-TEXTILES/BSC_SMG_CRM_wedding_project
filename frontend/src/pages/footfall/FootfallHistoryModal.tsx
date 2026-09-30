import { useEffect, useState } from 'react';
import ModalPortal from '../../components/ui/ModalPortal';
import { API } from '../../services/api';
import { X, History, AlertCircle, ScrollText, Inbox } from 'lucide-react';
import { SourceBadge, EditedBadge } from './FootfallBadges';
import {
  formatIstDate,
  formatIstTime,
  formatSlotLabel,
  historyFieldLabel,
  formatHistoryValue,
  storeLabel,
  type FootfallEditTarget,
  type FootfallHistoryRow,
  type FootfallStoreOption
} from './shared';

interface FootfallHistoryModalProps {
  entry: FootfallEditTarget | null;
  stores: FootfallStoreOption[];
  onClose: () => void;
}

export default function FootfallHistoryModal({ entry, stores, onClose }: FootfallHistoryModalProps) {
  const [rows, setRows] = useState<FootfallHistoryRow[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const entryId = entry ? String(entry.id) : null;

  useEffect(() => {
    if (!entryId) return;
    let cancelled = false;
    setState('loading');
    setError(null);
    (async () => {
      try {
        const res = await API.getFootfallEntryHistory(entryId);
        if (cancelled) return;
        // The API returns newest first (ORDER BY id DESC); rendered as received.
        setRows(Array.isArray(res?.history) ? res.history : []);
        setState('ready');
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || 'Unable to load the edit history. Please try again.');
        setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entryId]);

  return (
    <ModalPortal isOpen={Boolean(entry)} onClose={onClose} ariaLabel="Footfall Entry Edit History">
      {entry && (
        <div className="card-glass p-5 sm:p-7 max-w-3xl w-full space-y-4 shadow-2xl rounded-3xl border border-white/40 bg-white text-primary max-h-[92vh] overflow-y-auto">
          <div className="flex items-start justify-between gap-3 border-b border-accent-soft pb-3">
            <div>
              <h3 className="text-base sm:text-lg font-black text-primary flex items-center gap-2">
                <History className="w-5 h-5 text-accent shrink-0" />
                <span>Footfall Edit History</span>
              </h3>
              <p className="text-[11px] font-semibold text-primary/70 mt-1">
                Every correction recorded against this entry, newest first.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 shrink-0"
              aria-label="Close edit history"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Entry context */}
          <div className="p-4 rounded-2xl bg-background border border-accent-soft space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-primary">
              <SourceBadge source={entry.source} />
              {entry.editCount !== undefined && <EditedBadge editCount={entry.editCount} />}
              <span className="px-2 py-0.5 rounded-lg bg-white border border-accent-soft whitespace-nowrap">
                {formatIstDate(entry.entryDate)} · {formatSlotLabel(Number(entry.slotHour))}
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-white border border-accent-soft whitespace-nowrap">
                {storeLabel(stores, entry.locationId, `Store #${entry.locationId}`)}
              </span>
            </div>
            <div className="text-[10px] font-mono text-primary/50 break-all">Record ID: {entry.id}</div>
          </div>

          {state === 'loading' && (
            <div className="py-8 text-center text-xs font-bold text-primary/70">Loading edit history...</div>
          )}

          {state === 'error' && (
            <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {state === 'ready' && rows.length === 0 && (
            <div className="py-8 px-4 text-center space-y-2 rounded-2xl bg-background border border-accent-soft">
              <Inbox className="w-6 h-6 text-accent mx-auto" />
              <p className="text-xs font-bold text-primary">No edits recorded for this entry yet.</p>
              <p className="text-[11px] font-semibold text-primary/65">
                It still holds the values it was created with.
              </p>
            </div>
          )}

          {state === 'ready' && rows.length > 0 && (
            <div className="space-y-2">
              {rows.map((row, index) => (
                <div
                  key={`${row.field_changed || 'field'}-${row.created_at || 'time'}-${index}`}
                  className="p-3.5 rounded-2xl bg-white border border-accent-soft space-y-1.5 shadow-2xs"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
                      {String(row.action || 'Edited')}
                    </span>
                    <span className="text-xs font-black text-primary">
                      {historyFieldLabel(row.field_changed)}:
                    </span>
                    <span className="text-xs font-mono text-primary/60 line-through decoration-accent/70">
                      {formatHistoryValue(row.field_changed, row.old_value, stores)}
                    </span>
                    <span className="text-accent font-black text-xs">&rarr;</span>
                    <span className="text-xs font-mono font-black text-primary">
                      {formatHistoryValue(row.field_changed, row.new_value, stores)}
                    </span>
                  </div>

                  <div className="text-[11px] font-bold text-primary/75 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>Edited by: {row.edited_by || '—'}</span>
                    <span className="text-accent">·</span>
                    <span>Role: {row.edited_by_role || '—'}</span>
                    <span className="text-accent">·</span>
                    <span>Date: {formatIstDate(row.created_at)}</span>
                    <span className="text-accent">·</span>
                    <span>Time: {formatIstTime(row.created_at)}</span>
                  </div>

                  {row.reason && (
                    <p className="text-[11px] font-semibold text-primary/70 flex items-start gap-1.5 pt-0.5">
                      <ScrollText className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                      <span>Reason: {row.reason}</span>
                    </p>
                  )}
                </div>
              ))}

              <p className="text-[10.5px] font-bold uppercase tracking-wider text-primary/55 pt-1">
                {rows.length} change{rows.length === 1 ? '' : 's'} shown · oldest retained record: {formatIstDate(rows[rows.length - 1]?.created_at)}
              </p>
            </div>
          )}

          <div className="flex justify-end pt-1 border-t border-accent-soft">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-black bg-background border border-accent-soft text-[#5D4E42] hover:bg-white transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </ModalPortal>
  );
}
