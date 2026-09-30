import { useMemo, useState } from 'react';
import ModalPortal from '../../components/ui/ModalPortal';
import { showToast } from '../../components/Toast';
import { API } from '../../services/api';
import { X, Pencil, Save, Users, AlertCircle, Calendar, Clock, Store, FileText, ShieldAlert } from 'lucide-react';
import { SourceBadge } from './FootfallBadges';
import {
  formatSlotLabel,
  formatIstDate,
  storeLabel,
  type FootfallEditTarget,
  type FootfallStoreOption
} from './shared';

export interface FootfallEditModalProps {
  /** The record being corrected; the dialog is mounted per record id. Null closes it. */
  entry: FootfallEditTarget | null;
  stores: FootfallStoreOption[];
  /** Single-store users are clamped server-side, so the select stays read-only. */
  canChangeLocation: boolean;
  onClose: () => void;
  /** Called after a successful update so the page re-reads only the affected data. */
  onUpdated: () => void;
}

interface FormProps extends FootfallEditModalProps {
  entry: FootfallEditTarget;
  saving: boolean;
  setSaving: (value: boolean) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const inputClass =
  'w-full px-3 py-2 rounded-xl border border-accent-soft bg-white text-primary text-sm font-extrabold outline-none shadow-2xs focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all';
const labelClass = 'block text-[10.5px] font-black uppercase text-primary tracking-widest mb-1';

function EditForm({ entry, stores, canChangeLocation, onClose, onUpdated, saving, setSaving }: FormProps) {
  const [visitors, setVisitors] = useState<string>(String(Number(entry.visitors) || 0));
  const [entryDate, setEntryDate] = useState<string>(entry.entryDate);
  const [slotHour, setSlotHour] = useState<string>(String(Number(entry.slotHour)));
  const [locationId, setLocationId] = useState<string>(String(entry.locationId));
  const [remarks, setRemarks] = useState<string>(entry.remarks || '');
  const [reason, setReason] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const parsedVisitors = Number(visitors);
  const parsedHour = Number(slotHour);
  const parsedLocation = Number(locationId);

  // Moving an entry off the slot it was filed under is the disruptive case, so
  // the audit trail must say why. A plain count/remarks fix stays optional.
  const isStructuralMove =
    entryDate !== entry.entryDate ||
    parsedHour !== Number(entry.slotHour) ||
    parsedLocation !== Number(entry.locationId);

  const fieldError = useMemo<string | null>(() => {
    if (visitors.trim() === '') return 'Enter the corrected visitor count.';
    if (!Number.isInteger(parsedVisitors) || parsedVisitors < 0) return 'Visitor count must be a whole number of 0 or more.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) return 'Choose the register date for this entry.';
    if (!Number.isInteger(parsedHour) || parsedHour < 0 || parsedHour > 23) return 'Choose an hour between 0 and 23.';
    if (canChangeLocation && !parsedLocation) return 'Choose the store location.';
    if (isStructuralMove && reason.trim() === '') return 'A reason is required when you change the date, hour or store of an entry.';
    return null;
  }, [visitors, parsedVisitors, entryDate, parsedHour, canChangeLocation, parsedLocation, isStructuralMove, reason]);

  const hasChanges =
    parsedVisitors !== Number(entry.visitors) ||
    entryDate !== entry.entryDate ||
    parsedHour !== Number(entry.slotHour) ||
    parsedLocation !== Number(entry.locationId) ||
    remarks.trim() !== String(entry.remarks || '');

  const requestClose = () => {
    if (saving) return; // never unmount mid-request
    onClose();
  };

  const handleSubmit = async () => {
    if (saving) return;
    if (fieldError) {
      setError(fieldError);
      showToast(fieldError, 'error');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // Updates the existing row by id — a correction never inserts a second record.
      await API.updateFootfallEntry(String(entry.id), {
        visitors: parsedVisitors,
        entryDate,
        slotHour: parsedHour,
        location_id: parsedLocation,
        remarks: remarks.trim(),
        reason: reason.trim() || undefined
      });
      showToast('Footfall entry updated successfully.', 'success');
      onUpdated();
      onClose();
    } catch (err: any) {
      // apiFetch keeps the server `message` verbatim, so a 403 reads exactly as
      // the backend wrote it ("Only management users can correct a footfall record.").
      const message = err?.message || 'Unable to update footfall entry. Please try again.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card-glass p-5 sm:p-7 max-w-2xl w-full space-y-5 shadow-2xl rounded-3xl border border-white/40 bg-white text-primary max-h-[92vh] overflow-y-auto">
      <div className="flex items-start justify-between gap-3 border-b border-accent-soft pb-3">
        <div>
          <h3 className="text-base sm:text-lg font-black text-primary flex items-center gap-2">
            <Pencil className="w-5 h-5 text-accent shrink-0" />
            <span>Correct Footfall Entry</span>
          </h3>
          <p className="text-[11px] font-semibold text-primary/70 mt-1">
            Updates the existing record in place. Every change is written to the edit history.
          </p>
        </div>
        <button
          type="button"
          onClick={requestClose}
          disabled={saving}
          className="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 shrink-0 disabled:opacity-40"
          aria-label="Close correction dialog"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Record context */}
      <div className="p-4 rounded-2xl bg-background border border-accent-soft space-y-2">
        <div className="text-[10px] font-black uppercase tracking-wider text-accent">Record Being Corrected</div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-primary">
          <SourceBadge source={entry.source} />
          <span className="px-2 py-0.5 rounded-lg bg-white border border-accent-soft whitespace-nowrap">
            {formatIstDate(entry.entryDate)} · {formatSlotLabel(Number(entry.slotHour))}
          </span>
          <span className="px-2 py-0.5 rounded-lg bg-white border border-accent-soft whitespace-nowrap">
            {storeLabel(stores, entry.locationId, `Store #${entry.locationId}`)}
          </span>
        </div>
        <div className="text-[11px] font-semibold text-primary/70">
          Recorded by {entry.recordedBy || '—'} · Current count {(Number(entry.visitors) || 0).toLocaleString('en-IN')} visitors
          {entry.editCount ? ` · ${entry.editCount} previous edit(s)` : ''}
        </div>
        <div className="text-[10px] font-mono text-primary/50 break-all">Record ID: {entry.id}</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="footfall-edit-visitors">Corrected Visitor Count *</label>
          <div className="relative">
            <Users className="w-4 h-4 text-primary absolute left-3 top-3 z-10 pointer-events-none" />
            <input
              id="footfall-edit-visitors"
              type="number"
              min="0"
              step="1"
              value={visitors}
              onChange={(e) => setVisitors(e.target.value)}
              className={`${inputClass} pl-9 font-mono text-base`}
            />
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="footfall-edit-date">Register Date</label>
          <div className="relative">
            <Calendar className="w-4 h-4 text-primary absolute left-3 top-3 z-10 pointer-events-none" />
            <input
              id="footfall-edit-date"
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className={`${inputClass} pl-9 font-mono text-xs`}
            />
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="footfall-edit-hour">Hour Slot</label>
          <select
            id="footfall-edit-hour"
            value={slotHour}
            onChange={(e) => setSlotHour(e.target.value)}
            className={inputClass}
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>{`${String(h).padStart(2, '0')}:00 — ${formatSlotLabel(h)}`}</option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="footfall-edit-location">Store Location</label>
          {canChangeLocation ? (
            <select
              id="footfall-edit-location"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className={inputClass}
            >
              {stores.map((s) => (
                <option key={String(s.id)} value={String(s.id)}>
                  {s.code ? `${s.name} (${s.code})` : s.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="px-3 py-2 rounded-xl bg-background border border-accent-soft text-sm font-extrabold text-primary flex flex-wrap items-center gap-2">
              <Store className="w-4 h-4 text-accent shrink-0" />
              <span>{storeLabel(stores, entry.locationId, `Store #${entry.locationId}`)}</span>
              <span className="ml-auto text-[10px] font-black uppercase tracking-wider text-primary/55">Locked to your store</span>
            </div>
          )}
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="footfall-edit-remarks">Floor Remarks</label>
          <div className="relative">
            <FileText className="w-3.5 h-3.5 text-primary absolute left-3 top-3 z-10 pointer-events-none" />
            <input
              id="footfall-edit-remarks"
              type="text"
              value={remarks}
              maxLength={255}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Two families returned after lunch"
              className={`${inputClass} pl-9 text-xs font-semibold`}
            />
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="footfall-edit-reason">
            Reason for Correction {isStructuralMove ? '*' : '(optional, recommended)'}
          </label>
          <textarea
            id="footfall-edit-reason"
            value={reason}
            maxLength={255}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="e.g. Kiosk double-tap counted 4 visitors twice"
            className={`${inputClass} font-semibold text-xs resize-y`}
          />
          <p className="text-[10.5px] font-semibold text-primary/65 mt-1 flex items-start gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
            <span>
              Stored in the audit trail and shown in History. Required when the date, hour or store changes;
              only management users can save a correction.
            </span>
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1 border-t border-accent-soft">
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-primary/60 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-accent shrink-0" />
          <span>
            {!hasChanges
              ? 'No changes to save yet'
              : isStructuralMove
                ? 'Moves this record to another slot'
                : 'Correcting this record in place'}
          </span>
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={requestClose}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-xs font-black bg-background border border-accent-soft text-[#5D4E42] hover:bg-white transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            // Guards double submit: a pending save cannot fire a second UPDATE.
            disabled={saving || !hasChanges}
            className="px-4 py-2 rounded-xl text-xs font-black bg-primary text-white hover:bg-[#6A2853] transition-all shadow-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving Correction...' : 'Save Correction'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FootfallEditModal(props: FootfallEditModalProps) {
  const { entry, onClose } = props;
  // Lifted so a save in flight also blocks the Escape and backdrop close paths.
  const [saving, setSaving] = useState<boolean>(false);

  return (
    <ModalPortal
      isOpen={Boolean(entry)}
      onClose={onClose}
      closeOnBackdropClick={!saving}
      closeOnEsc={!saving}
      ariaLabel="Correct Footfall Entry"
    >
      {entry && <EditForm key={entry.id} {...props} entry={entry} saving={saving} setSaving={setSaving} />}
    </ModalPortal>
  );
}
