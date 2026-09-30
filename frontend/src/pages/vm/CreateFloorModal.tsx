import React, { useState, useEffect } from 'react';
import {
  X,
  Building2,
  MapPin,
  Layers,
  Plus,
  Trash2,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { API } from '../../services/api';
import {
  vmBtnPrimary,
  vmBtnSecondary,
  vmLabel,
  vmHeading,
  vmBody,
  VM_SURFACE
} from './VmPrimitives';

interface CreateFloorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newFloor: any) => void;
  defaultLocationId?: number | string | null;
}

const FLOOR_PRESETS = [
  { name: 'Ground Floor', code: 'GF', desc: 'Main Entrance & Saree Galleria' },
  { name: 'First Floor', code: '1F', desc: 'High-Value Silk & Luxury Sarees' },
  { name: 'Second Floor', code: '2F', desc: 'Ladies Wear and Kids Wear' },
  { name: 'Third Floor', code: '3F', desc: 'Mens Wear and Home Furnishing' },
  { name: 'Fourth Floor', code: '4F', desc: 'Bridal Studio & Exclusive Collections' },
  { name: 'Fifth Floor', code: '5F', desc: 'Corporate & Bulk Orders / Event Lounge' },
  { name: 'Mezzanine Floor', code: 'MEZZ', desc: 'Accessories, Jewellery & Alterations' },
  { name: 'Basement Floor', code: 'B1', desc: 'Value Collections & Stock Staging' }
];

const SECTION_SUGGESTIONS = [
  'Silk Sarees (Upto Lakhs)',
  'Bridal Lehengas & Gowns',
  'Normal Sarees',
  'Ladies Kurti & Dress Materials',
  'Kids Wear & Traditional',
  'Mens Ethnic & Suiting',
  'Accessories & Jewellery',
  'Home Furnishing & Curtains',
  'Ready to Wear / Western',
  'Pattu Pavada & Teen Ethnic'
];

export default function CreateFloorModal({
  isOpen,
  onClose,
  onSuccess,
  defaultLocationId
}: CreateFloorModalProps) {
  const [locations, setLocations] = useState<Array<{ id: number | string; name: string }>>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | string>(defaultLocationId || 2);
  const [floorName, setFloorName] = useState('');
  const [floorCode, setFloorCode] = useState('');
  const [description, setDescription] = useState('');
  const [sections, setSections] = useState<string[]>([]);
  const [currentSectionInput, setCurrentSectionInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load locations for store selector
  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    API.getLocations()
      .then((res: any) => {
        if (!alive) return;
        const locs = res?.locations || res?.data || [];
        setLocations(locs);
        if (locs.length > 0 && !defaultLocationId) {
          setSelectedLocationId(locs[0].id);
        }
      })
      .catch((err: any) => {
        console.warn('[CreateFloorModal] Could not fetch locations:', err);
      });
    return () => {
      alive = false;
    };
  }, [isOpen, defaultLocationId]);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: typeof FLOOR_PRESETS[0]) => {
    setFloorName(preset.name);
    setFloorCode(preset.code);
    if (!description || description === preset.desc) {
      setDescription(preset.desc);
    }
  };

  const handleAddSection = (sectionName?: string) => {
    const target = (sectionName || currentSectionInput).trim();
    if (!target) return;
    if (sections.some((s) => s.toLowerCase() === target.toLowerCase())) {
      setError(`Section "${target}" is already in the list.`);
      return;
    }
    setError(null);
    setSections([...sections, target]);
    if (!sectionName) {
      setCurrentSectionInput('');
    }
  };

  const handleRemoveSection = (index: number) => {
    setSections(sections.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = floorName.trim();
    if (!trimmedName) {
      setError('Please enter a floor name.');
      return;
    }

    if (sections.length === 0) {
      setError('Please configure at least one section for this floor.');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        name: trimmedName,
        floor_code: floorCode.trim() || undefined,
        location_id: selectedLocationId ? Number(selectedLocationId) : 2,
        description: description.trim(),
        sections
      };

      const res: any = await API.createVmFloor(payload);
      if (res && (res.success || res.floor)) {
        onSuccess(res.floor || { name: trimmedName, sections });
        onClose();
      } else {
        setError(res?.message || 'Failed to create floor. Please verify details.');
      }
    } catch (err: any) {
      setError(err?.message || 'An error occurred while creating the store floor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-[#FFFDFC] border border-[#E8D9D4] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8D9D4] bg-gradient-to-r from-[#FFF7F2] to-white">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#4A173A] text-white shadow-sm">
              <Building2 className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[18px] font-black text-[#4A173A]">Create New Store Floor</h2>
                <span className="inline-flex items-center gap-1 rounded-full border border-[#4A173A]/20 bg-[#4A173A]/10 px-2 py-0.5 text-[10px] font-black uppercase text-[#4A173A]">
                  <ShieldCheck className="w-3 h-3 text-[#4A173A]" />
                  Admin Only
                </span>
              </div>
              <p className="text-[12px] font-semibold text-[#6F5963]">
                Add a new floor level and assign showroom merchandising sections.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl p-2 text-[#6F5963] hover:bg-[#FFF7F2] hover:text-[#4A173A] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-[13px] font-bold text-red-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Location / Store Selector */}
          <div>
            <label className={`${vmLabel} block mb-1.5 flex items-center gap-1.5`}>
              <MapPin className="w-3.5 h-3.5 text-[#B76E79]" />
              Store Showroom Location
            </label>
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="w-full rounded-xl border border-[#E8D9D4] bg-white px-3.5 py-2.5 text-[13px] font-bold text-[#4A173A] focus:border-[#B76E79] focus:outline-none focus:ring-2 focus:ring-[#B76E79]/20"
            >
              {locations.length > 0 ? (
                locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} Showroom (ID: {loc.id})
                  </option>
                ))
              ) : (
                <option value={2}>Davanagere Showroom (Default)</option>
              )}
            </select>
          </div>

          {/* Quick presets row */}
          <div>
            <label className={`${vmLabel} block mb-1.5 flex items-center gap-1.5`}>
              <Sparkles className="w-3.5 h-3.5 text-[#B76E79]" />
              Quick Floor Presets
            </label>
            <div className="flex flex-wrap gap-1.5">
              {FLOOR_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className={`rounded-xl px-2.5 py-1 text-[11px] font-bold transition-all ${
                    floorName === p.name
                      ? 'bg-[#4A173A] text-white shadow-sm'
                      : 'border border-[#E8D9D4] bg-[#FFF7F2] text-[#6F5963] hover:border-[#B76E79] hover:text-[#4A173A]'
                  }`}
                >
                  {p.name} ({p.code})
                </button>
              ))}
            </div>
          </div>

          {/* Floor Name & Code Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className={`${vmLabel} block mb-1.5`}>
                Floor Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={floorName}
                onChange={(e) => setFloorName(e.target.value)}
                placeholder="e.g. Ground Floor, Fourth Floor"
                className="w-full rounded-xl border border-[#E8D9D4] bg-white px-3.5 py-2.5 text-[13px] font-bold text-[#4A173A] placeholder-[#6F5963]/50 focus:border-[#B76E79] focus:outline-none focus:ring-2 focus:ring-[#B76E79]/20"
              />
            </div>

            <div>
              <label className={`${vmLabel} block mb-1.5`}>Floor Code / Level</label>
              <input
                type="text"
                value={floorCode}
                onChange={(e) => setFloorCode(e.target.value)}
                placeholder="e.g. GF, 4F, MEZZ"
                className="w-full rounded-xl border border-[#E8D9D4] bg-white px-3.5 py-2.5 text-[13px] font-bold text-[#4A173A] placeholder-[#6F5963]/50 focus:border-[#B76E79] focus:outline-none focus:ring-2 focus:ring-[#B76E79]/20 uppercase"
              />
            </div>
          </div>

          {/* Merchandising Focus / Description */}
          <div>
            <label className={`${vmLabel} block mb-1.5`}>Merchandising Focus & Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Bridal Sarees, Silk Galleria & High-Value Collections"
              className="w-full rounded-xl border border-[#E8D9D4] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#4A173A] placeholder-[#6F5963]/50 focus:border-[#B76E79] focus:outline-none focus:ring-2 focus:ring-[#B76E79]/20"
            />
          </div>

          {/* Sections Configuration */}
          <div className="rounded-2xl border border-[#E8D9D4] bg-[#FFF7F2] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className={`${vmLabel} block flex items-center gap-1.5 text-[#4A173A]`}>
                  <Layers className="w-3.5 h-3.5 text-[#B76E79]" />
                  Store Sections on this Floor <span className="text-red-500">*</span>
                </label>
                <p className="text-[11px] font-semibold text-[#6F5963]">
                  Checklists and photo audits are performed per section.
                </p>
              </div>
              <span className="rounded-full bg-white border border-[#E8D9D4] px-2.5 py-0.5 text-[11px] font-black text-[#4A173A]">
                {sections.length} section{sections.length === 1 ? '' : 's'}
              </span>
            </div>

            {/* Input to type new section */}
            <div className="flex gap-2">
              <input
                type="text"
                value={currentSectionInput}
                onChange={(e) => setCurrentSectionInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSection();
                  }
                }}
                placeholder="Type section name (e.g. Bridal Studio) and press Enter"
                className="flex-1 rounded-xl border border-[#E8D9D4] bg-white px-3.5 py-2 text-[13px] font-bold text-[#4A173A] placeholder-[#6F5963]/50 focus:border-[#B76E79] focus:outline-none focus:ring-2 focus:ring-[#B76E79]/20"
              />
              <button
                type="button"
                onClick={() => handleAddSection()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#4A173A] px-3.5 py-2 text-[12px] font-bold text-white hover:bg-[#6A2853] transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>

            {/* Popular suggestions */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-[#6F5963] mb-1.5">
                Popular Section Presets:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SECTION_SUGGESTIONS.map((sug) => {
                  const alreadyAdded = sections.some((s) => s.toLowerCase() === sug.toLowerCase());
                  return (
                    <button
                      key={sug}
                      type="button"
                      disabled={alreadyAdded}
                      onClick={() => handleAddSection(sug)}
                      className={`rounded-lg px-2 py-0.5 text-[10px] font-bold transition-all ${
                        alreadyAdded
                          ? 'opacity-40 cursor-not-allowed bg-gray-200 text-gray-500'
                          : 'bg-white border border-[#E8D9D4] text-[#4A173A] hover:border-[#B76E79] hover:bg-[#FFFDFC]'
                      }`}
                    >
                      + {sug}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Configured sections chip list */}
            {sections.length > 0 ? (
              <div className="pt-2">
                <p className="text-[11px] font-black uppercase tracking-wider text-[#4A173A] mb-1.5">
                  Assigned Sections List:
                </p>
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1">
                  {sections.map((sec, idx) => (
                    <div
                      key={idx}
                      className="group inline-flex items-center gap-1.5 rounded-xl border border-[#B76E79]/30 bg-white px-3 py-1.5 text-[12px] font-bold text-[#4A173A] shadow-sm"
                    >
                      <span>{sec}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSection(idx)}
                        className="rounded-full p-0.5 text-[#6F5963] hover:bg-red-50 hover:text-red-600 transition-colors"
                        title="Remove section"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-[#E8D9D4] bg-white/60 p-3 text-center text-[12px] font-semibold italic text-[#6F5963]">
                No sections added yet. Type a section name above or click one of the presets.
              </p>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E8D9D4]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className={vmBtnSecondary}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={vmBtnPrimary}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Floor…</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Save Store Floor</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
