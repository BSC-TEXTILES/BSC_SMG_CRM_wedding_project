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
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-primary/5 border border-accent-soft text-primary text-[11px] font-bold shadow-2xs select-none"
        title={`Your account is scoped strictly to ${singleLoc?.name || 'Assigned Branch'}`}
      >
        <MapPin className="w-3.5 h-3.5 text-accent flex-shrink-0" />
        <span className="truncate max-w-[90px] sm:max-w-[120px]">{singleLoc ? `${singleLoc.name} (${singleLoc.code})` : 'Branch'}</span>
        <Lock className="w-2.5 h-2.5 text-accent/70 flex-shrink-0" />
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1 sm:py-1.5 rounded-xl bg-white hover:bg-background/80 border border-accent-soft hover:border-accent text-primary transition-all shadow-2xs text-[11px] sm:text-xs font-bold cursor-pointer group"
        title="Switch active store branch"
        aria-expanded={isOpen}
      >
        <MapPin className="w-3.5 h-3.5 text-accent group-hover:scale-110 transition-transform flex-shrink-0" />
        <span className="truncate max-w-[85px] sm:max-w-[130px] md:max-w-none">
          {currentLocationLabel}
        </span>
        <ChevronDown className={`w-3 h-3 text-primary/60 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-56 rounded-2xl bg-white shadow-xl border border-accent-soft py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3 py-1.5 border-b border-accent-soft/60">
            <p className="text-[10px] uppercase tracking-wider font-extrabold text-primary/60">Select Branch Scope</p>
          </div>

          <div className="py-1">
            {/* All locations option (if user is global admin or has multiple branches) */}
            <button
              type="button"
              onClick={() => {
                setCurrentLocation('ALL');
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-left transition-colors ${
                currentLocation === 'ALL'
                  ? 'bg-primary/10 text-primary font-bold'
                  : 'text-primary/80 hover:bg-background'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${currentLocation === 'ALL' ? 'bg-accent' : 'bg-transparent border border-primary/30'}`} />
                <span>{isGlobalAdmin ? 'All Stores (Global)' : 'All Assigned Branches'}</span>
              </div>
              {currentLocation === 'ALL' && <Check className="w-3.5 h-3.5 text-accent" />}
            </button>

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
                      ? 'bg-primary/10 text-primary font-bold'
                      : 'text-primary/80 hover:bg-background'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-accent' : 'bg-transparent border border-primary/30'}`} />
                    <span>{loc.name} <span className="text-[10px] text-primary/60 font-mono">({loc.code})</span></span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-accent" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
