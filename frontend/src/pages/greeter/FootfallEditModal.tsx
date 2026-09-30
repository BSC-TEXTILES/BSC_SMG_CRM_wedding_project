import React, { useEffect, useMemo, useState } from 'react';
import { Clock, History, Minus, Pencil, Plus, Save, TriangleAlert, Users, X } from 'lucide-react';
import ModalPortal from '../../components/ui/ModalPortal';
import { API } from '../../services/api';
import { showToast } from '../../components/Toast';
import {
  type FootfallEntryRow,
  clockLabel,
  entryEditCount,
  entryHour,
  entryVisitors,
  formatHourRange,
  formatIstClock,
  toEntryDateString
} from './footfallUtils';

/** Kept in sync with the strings the kiosk contract promises the operator. */
export const SAVE_SUCCESS_MESSAGE = 'Footfall entry updated successfully.';
export const SAVE_FAILURE_MESSAGE = 'Unable to save footfall entry. Please try again.';

interface FootfallEditModalProps {
  entry: FootfallEntryRow | null;
  /** Management may correct an absolute count; everyone else only adds or removes. */
  isManagement: boolean;
  actorName: string;
  locationLabel: string;
  onClose: () => void;
  onSaved: () => void;
}

const STEP_PRESETS = [-5, -1, 1, 5];

export default function FootfallEditModal({
  entry,
  isManagement,
  actorName,
  locationLabel,
  onClose,
  onSaved
}: FootfallEditModalProps) {
  const [delta, setDelta] = useState<number>(0);
  const [absolute, setAbsolute] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const currentVisitors = entryVisitors(entry || { visitors: 0 });
  const originalRemarks = entry?.remarks ? String(entry.remarks) : '';
  // The server only keeps remarks that carry content, and the kiosk normally
  // leaves the field empty, so it is offered only on rows that already use it.
  const remarksEditable = Boolean(originalRemarks.trim());
  const previewCount = Math.max(0, currentVisitors + delta);
  const absoluteNumber = Number(absolute);
  const absoluteValid = absolute.trim() !== '' && Number.isFinite(absoluteNumber) && absoluteNumber >= 0;
  const remarksChanged = remarks !== originalRemarks;
  const visitorsChanged = isManagement ? absoluteValid && Math.trunc(absoluteNumber) !== currentVisitors : delta !== 0;

  useEffect(() => {
    if (!entry) return;
    setDelta(0);
    setReason('');
    setError(null);
    setAbsolute(String(entryVisitors(entry)));
    setRemarks(entry.remarks ? String(entry.remarks) : '');
    // Keyed on the id so a realtime refresh under the open modal cannot discard typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.id]);

  const canSubmit = useMemo(() => {
    if (!entry || saving) return false;
    if (isManagement) return visitorsChanged || remarksChanged;
    // A non-management correction is an increment, and the server rejects a zero
    // delta — remarks alone cannot be rewritten without adjusting the count.
    return delta !== 0;
  }, [entry, saving, isManagement, visitorsChanged, remarksChanged, delta]);

  const handleSave = async () => {
    if (!entry || saving || !canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      let res: any;
      if (isManagement) {
        // Correct the stored row by id — updates the same record, never a duplicate.
        res = await API.updateFootfallEntry(String(entry.id), {
          visitors: Math.trunc(absoluteNumber),
          ...(remarksEditable ? { remarks } : {}),
          ...(reason.trim() ? { reason: reason.trim() } : {})
        });
      } else {
        // Server-side atomic add/remove, so a concurrent click cannot be lost.
        res = await API.upsertFootfall({
          entryDate: toEntryDateString(entry.entryDate),
          slotHour: entryHour(entry),
          mode: 'increment',
          delta,
          location_id: Number(entry.location_id) || undefined,
          ...(remarksEditable ? { remarks } : {}),
          submittedBy: actorName
        });
      }
      showToast(res?.message || SAVE_SUCCESS_MESSAGE, 'success');
      onSaved();
    } catch (err: any) {
      const status = Number(err?.status);
      const serverMessage = typeof err?.message === 'string' ? err.message : '';
      // 400/403/404 answers are already plain English (including the management-only
      // rule), so they are shown verbatim instead of a generic failure string.
      const message = [400, 403, 404].includes(status) && serverMessage ? serverMessage : SAVE_FAILURE_MESSAGE;
      setError(message);
      showToast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!entry) return null;

  const hour = entryHour(entry);
  const editCount = entryEditCount(entry);
  const blockClass = 'bg-black/25 border border-white/10 rounded-2xl px-3 py-2.5';
  const labelClass = 'text-[9.5px] font-black uppercase tracking-widest text-white/55';
  const valueClass = 'text-xs font-black text-white mt-0.5 truncate';

  return (
    <ModalPortal
      isOpen
      onClose={onClose}
      closeOnBackdropClick={!saving}
      closeOnEsc={!saving}
      zIndex={1200}
      ariaLabel="Edit footfall entry"
      containerClassName="px-3 sm:px-4"
    >
      <div className="w-full max-w-md bg-gradient-to-br from-[#3D2B1F] to-[#0B1220] text-white border border-black/30 rounded-3xl shadow-2xl backdrop-blur-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-4 sm:px-5 pt-4 pb-3 border-b border-black/20">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-amber-400/15 border border-amber-300/30 flex items-center justify-center shrink-0">
              <Pencil className="w-4 h-4 text-amber-300" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black tracking-tight text-white truncate">Edit Footfall Entry</h3>
              <p className="text-[10.5px] font-bold text-amber-200 truncate">
                {formatHourRange(hour)} · {entry.location_name || locationLabel}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="w-10 h-10 rounded-2xl bg-black/25 border border-white/15 text-white/80 flex items-center justify-center active:scale-95 transition-all disabled:opacity-40 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 sm:px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div className={blockClass}>
              <div className={labelClass}>Recorded by</div>
              <div className={valueClass}>{entry.submittedBy || entry.created_by || '—'}</div>
            </div>
            <div className={blockClass}>
              <div className={labelClass}>Source</div>
              <div className={valueClass}>{entry.entry_source || 'Greeter Kiosk'}</div>
            </div>
            <div className={blockClass}>
              <div className={labelClass}>Entry date</div>
              <div className={`${valueClass} font-mono`}>{toEntryDateString(entry.entryDate)}</div>
            </div>
            <div className={blockClass}>
              <div className={labelClass}>Last updated</div>
              <div className={`${valueClass} font-mono flex items-center gap-1.5`}>
                <History className="w-3 h-3 text-amber-300 shrink-0" />
                <span>{formatIstClock(entry.updatedAt || entry.createdAt)}</span>
              </div>
            </div>
          </div>

          <div className="bg-black/30 border border-amber-300/25 rounded-3xl p-4 text-center">
            <div className="text-[9.5px] font-black uppercase tracking-widest text-amber-300">Current count</div>
            <div className="text-5xl font-black font-mono text-white leading-none mt-1.5 tabular-nums flex items-center justify-center gap-2">
              <Users className="w-6 h-6 text-amber-300/70" />
              {currentVisitors}
            </div>
            <div className="text-[10.5px] font-bold text-white/65 mt-1.5">
              {clockLabel(hour)} slot · {editCount > 0 ? `edited ${editCount}×` : 'never edited'}
            </div>
          </div>

          {isManagement ? (
            <div className="space-y-3">
              <div>
                <label htmlFor="greeter-absolute-count" className="block text-[10px] font-black uppercase tracking-widest text-amber-300 mb-1.5">
                  Set exact visitor count
                </label>
                <input
                  id="greeter-absolute-count"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={absolute}
                  onChange={(e) => setAbsolute(e.target.value)}
                  className="w-full text-center text-2xl font-black font-mono py-3 rounded-2xl border border-white/20 bg-black/30 text-white focus:outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-300/30"
                />
              </div>
              <div>
                <label htmlFor="greeter-reason" className="block text-[10px] font-black uppercase tracking-widest text-white/60 mb-1.5">
                  Correction reason (audit trail)
                </label>
                <input
                  id="greeter-reason"
                  type="text"
                  maxLength={255}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Two counts logged for the same group"
                  className="w-full text-xs font-semibold px-3 py-2.5 rounded-2xl border border-white/15 bg-black/25 text-white placeholder:text-white/30 focus:outline-none focus:border-amber-300"
                />
              </div>
              {!absoluteValid && (
                <p className="text-[10.5px] font-bold text-rose-300">Enter a visitor count of 0 or more.</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-amber-300">Add or remove visitors</div>
              <div className="flex items-center justify-center gap-2">
                {STEP_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDelta(prev => prev + preset)}
                    disabled={saving}
                    className={`flex-1 min-h-12 rounded-2xl border text-sm font-black font-mono active:scale-95 transition-all disabled:opacity-40 ${
                      preset > 0
                        ? 'bg-emerald-600/80 border-emerald-400/40 text-white hover:bg-emerald-700'
                        : 'bg-rose-600/80 border-rose-400/30 text-white hover:bg-rose-700'
                    }`}
                  >
                    {preset > 0 ? `+${preset}` : preset}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between gap-2 bg-black/25 border border-white/10 rounded-2xl px-3 py-2.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Adjustment</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDelta(prev => prev - 1)}
                    disabled={saving}
                    aria-label="Decrease adjustment"
                    className="w-10 h-10 rounded-xl bg-rose-600/80 border border-rose-400/30 flex items-center justify-center active:scale-95 disabled:opacity-40"
                  >
                    <Minus className="w-4 h-4 stroke-[3]" />
                  </button>
                  <span className={`min-w-[3.5rem] text-center text-xl font-black font-mono tabular-nums ${delta > 0 ? 'text-emerald-300' : delta < 0 ? 'text-rose-300' : 'text-white/50'}`}>
                    {delta > 0 ? `+${delta}` : delta}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDelta(prev => prev + 1)}
                    disabled={saving}
                    aria-label="Increase adjustment"
                    className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-300/40 text-amber-200 flex items-center justify-center active:scale-95 disabled:opacity-40"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs font-black text-amber-200">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {delta === 0 ? `No change — count stays at ${currentVisitors}` : `New count: ${previewCount} (was ${currentVisitors})`}
                </span>
              </div>
              {delta === 0 && (
                <p className="text-[10.5px] font-bold text-white/55 text-center">
                  {remarksChanged
                    ? 'Adjust the count by at least 1 to save this note.'
                    : 'Use + or − to correct the count. Only management can set an exact number.'}
                </p>
              )}
            </div>
          )}

          {remarksEditable && (
            <div>
              <label htmlFor="greeter-remarks" className="block text-[10px] font-black uppercase tracking-widest text-white/60 mb-1.5">
                Remarks
              </label>
              <input
                id="greeter-remarks"
                type="text"
                maxLength={255}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                disabled={saving}
                className="w-full text-xs font-semibold px-3 py-2.5 rounded-2xl border border-white/15 bg-black/25 text-white focus:outline-none focus:border-amber-300 disabled:opacity-50"
              />
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 text-[11px] font-bold text-rose-200 bg-rose-500/20 border border-rose-400/40 rounded-2xl px-3 py-2.5">
              <TriangleAlert className="w-4 h-4 shrink-0 text-rose-300" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="px-4 sm:px-5 pb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 min-h-12 rounded-2xl border border-white/15 bg-black/25 text-white/85 text-xs font-black uppercase tracking-wider active:scale-95 transition-all disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSubmit}
            className="btn-gold flex-1 min-h-12 rounded-2xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving…' : isManagement ? 'Save correction' : 'Save adjustment'}</span>
          </button>
        </div>
      </div>
    </ModalPortal>
  );
}
