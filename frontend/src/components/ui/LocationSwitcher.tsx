import React, { useState, useRef, useEffect } from 'react';
import { MapPin, ChevronDown, Check, Lock } from 'lucide-react';
import { useLocationContext } from '../../context/LocationContext';

export default function LocationSwitcher() {
  const { currentLocation, setCurrentLocation, availableLocations, canSwitch, isGlobalAdmin, currentLocationLabel } = useLocationContext();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!canSwitch && availableLocations.length <= 1) {
    // Single location assigned user (e.g. User 1 - Ananya): show fixed branch indicator
    const singleLoc = availableLocations[0];
    return (
      <div 
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#F6F4EF] border border-[#DFDDD7] text-[#182033] text-[11px] font-bold shadow-2xs select-none"
        title={`Your account is scoped strictly to ${singleLoc?.name || 'Assigned Location'}`}
      >
        <MapPin className="w-3.5 h-3.5 text-[#C9A45C] flex-shrink-0" />
        <span className="truncate max-w-[130px] sm:max-w-[180px]">Assigned Location: {singleLoc ? `${singleLoc.name} (${singleLoc.code})` : 'Location'}</span>
        <Lock className="w-2.5 h-2.5 text-[#C9A45C] flex-shrink-0" />
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1 sm:py-1.5 rounded-xl bg-white hover:bg-[#F6F4EF] border border-[#DFDDD7] hover:border-[#C9A45C] text-[#182033] transition-all shadow-2xs text-[11px] sm:text-xs font-bold cursor-pointer group"
        title="Switch active store branch"
        aria-expanded={isOpen}
      >
        <MapPin className="w-3.5 h-3.5 text-[#C9A45C] group-hover:scale-110 transition-transform flex-shrink-0" />
        <span className="truncate max-w-[120px] sm:max-w-[180px] md:max-w-none">
          {currentLocation === 'ALL' ? 'Active: All Locations' : `Active Location: ${currentLocationLabel}`}
        </span>
        <ChevronDown className={`w-3 h-3 text-[#687080] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-56 rounded-2xl bg-white shadow-xl border border-[#DFDDD7] py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3 py-1.5 border-b border-[#DFDDD7]">
            <p className="text-[10px] uppercase tracking-wider font-extrabold text-[#687080]">Select Branch Scope</p>
          </div>

          <div className="py-1">
            {/* All locations option (strictly for Global Admin) */}
            {isGlobalAdmin && (
              <button
                type="button"
                onClick={() => {
                  setCurrentLocation('ALL');
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-left transition-colors ${
                  currentLocation === 'ALL'
                    ? 'bg-[#101C36]/10 text-[#101C36] font-bold'
                    : 'text-[#182033] hover:bg-[#F6F4EF]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${currentLocation === 'ALL' ? 'bg-[#C9A45C]' : 'bg-transparent border border-[#DFDDD7]'}`} />
                  <span>All Locations (Global Scope)</span>
                </div>
                {currentLocation === 'ALL' && <Check className="w-3.5 h-3.5 text-[#C9A45C]" />}
              </button>
            )}

            {/* List individual allowed branches */}
            {availableLocations.map(loc => {
              const isSelected = String(loc.id) === currentLocation;
              return (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => {
                    setCurrentLocation(String(loc.id));
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-left transition-colors ${
                    isSelected
                      ? 'bg-[#101C36]/10 text-[#101C36] font-bold'
                      : 'text-[#182033] hover:bg-[#F6F4EF]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-[#C9A45C]' : 'bg-transparent border border-[#DFDDD7]'}`} />
                    <span>{loc.name} <span className="text-[10px] text-[#687080] font-mono">({loc.code})</span></span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#C9A45C]" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
