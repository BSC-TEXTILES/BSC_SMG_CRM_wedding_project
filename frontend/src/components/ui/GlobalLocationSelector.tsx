import React, { useState, useRef, useEffect } from 'react';
import { MapPin, ChevronDown, Check, Lock } from 'lucide-react';
import { useLocationContext } from '../../context/LocationContext';

export default function GlobalLocationSelector() {
  const { 
    activeLocation, 
    currentLocation, 
    setCurrentLocation, 
    availableLocations, 
    canSwitch, 
    isGlobalAdmin, 
    currentLocationLabel 
  } = useLocationContext();

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

  // For single-location users: show clean, read-only location badge with Lock icon
  if (!canSwitch && availableLocations.length <= 1) {
    const loc = availableLocations[0];
    const displayName = loc ? loc.name : activeLocation.name || 'Store';
    return (
      <div 
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#F6F4EF] border border-[#DFDDD7] text-[#182033] text-xs font-bold shadow-2xs select-none flex-shrink-0"
        title={`Your account is strictly scoped to ${displayName}`}
      >
        <MapPin className="w-3.5 h-3.5 text-[#C9A45C] flex-shrink-0" />
        <span className="truncate max-w-[120px] sm:max-w-[180px] font-black">
          📍 {displayName}
        </span>
        <Lock className="w-2.5 h-2.5 text-[#C9A45C] flex-shrink-0 ml-0.5" />
      </div>
    );
  }

  // Multi-location or Global Admin: responsive interactive dropdown
  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white hover:bg-[#F6F4EF] border border-[#DFDDD7] hover:border-[#C9A45C] text-[#182033] transition-all shadow-2xs text-xs font-bold cursor-pointer group flex-shrink-0 select-none"
        title="Switch active store location"
        aria-expanded={isOpen}
      >
        <MapPin className="w-3.5 h-3.5 text-[#C9A45C] group-hover:scale-110 transition-transform flex-shrink-0" />
        
        {/* Desktop: ACTIVE: All Locations ▼ */}
        <span className="hidden lg:inline text-xs font-black tracking-tight">
          ACTIVE: {activeLocation.name}
        </span>

        {/* Tablet: All Locations ▼ */}
        <span className="hidden sm:inline lg:hidden text-xs font-black tracking-tight">
          {activeLocation.name}
        </span>

        {/* Mobile: 📍 All Locations */}
        <span className="sm:hidden text-xs font-black tracking-tight truncate max-w-[90px]">
          {activeLocation.id === 'ALL' ? 'All Stores' : activeLocation.shortName}
        </span>

        <ChevronDown className={`w-3.5 h-3.5 text-[#687080] transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-60 rounded-2xl bg-white shadow-xl border border-[#DFDDD7] py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3 py-1.5 border-b border-[#DFDDD7]">
            <p className="text-[10px] uppercase tracking-wider font-extrabold text-[#687080]">
              Select Store Location
            </p>
          </div>

          <div className="py-1">
            {/* Global option for Admin */}
            {isGlobalAdmin && (
              <button
                type="button"
                onClick={() => {
                  setCurrentLocation('ALL');
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-left transition-colors cursor-pointer ${
                  currentLocation === 'ALL'
                    ? 'bg-[#101C36]/10 text-[#101C36] font-bold'
                    : 'text-[#182033] hover:bg-[#F6F4EF]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${currentLocation === 'ALL' ? 'bg-[#C9A45C]' : 'bg-transparent border border-[#DFDDD7]'}`} />
                  <span>All Locations</span>
                </div>
                {currentLocation === 'ALL' && <Check className="w-3.5 h-3.5 text-[#C9A45C]" />}
              </button>
            )}

            {/* Specific stores list: Belagavi, Davanagere, Shivamogga */}
            {availableLocations.map((loc) => {
              const isSelected = String(loc.id) === currentLocation;
              return (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => {
                    setCurrentLocation(String(loc.id));
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#101C36]/10 text-[#101C36] font-bold'
                      : 'text-[#182033] hover:bg-[#F6F4EF]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-[#C9A45C]' : 'bg-transparent border border-[#DFDDD7]'}`} />
                    <span className="truncate">{loc.name}</span>
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
