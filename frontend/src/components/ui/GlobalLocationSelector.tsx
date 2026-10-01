import { useState, useRef, useEffect } from 'react';
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
  } = useLocationContext();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // For single-location users: show clean, read-only location badge with Lock icon
  if (!canSwitch && availableLocations.length <= 1) {
    const loc = availableLocations[0];
    const displayName = loc ? loc.name : activeLocation.name || 'Store';
    return (
      <div
        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F7F4ED] border border-[#E2DDD2] text-[#123C35] text-[13px] font-semibold shadow-xs select-none shrink-0"
        title={`Your account is strictly scoped to ${displayName}`}
      >
        <MapPin className="w-3.5 h-3.5 text-[#123C35] shrink-0" />
        <span className="truncate max-w-[120px] sm:max-w-[180px] font-semibold">
          📍 {displayName}
        </span>
        <Lock className="w-3 h-3 text-[#687080] shrink-0 ml-0.5" />
      </div>
    );
  }

  // Multi-location or Global Admin: responsive interactive dropdown
  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F7F4ED] hover:bg-white border border-[#E2DDD2] hover:border-[#C9A45C] text-[#123C35] transition-all shadow-xs text-[13px] font-semibold cursor-pointer group shrink-0 select-none focus:outline-none focus:ring-2 focus:ring-[#C9A45C]"
        title="Switch active store location"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Location selector"
      >
        <MapPin className="w-3.5 h-3.5 text-[#123C35] group-hover:scale-110 transition-transform shrink-0" />

        {/* Desktop: ◉ ACTIVE: All Locations ⌄ */}
        <span className="hidden lg:inline text-[13px] font-semibold tracking-tight text-[#123C35]">
          <span className="text-[#C9A45C] mr-1.5 font-bold">◉</span>
          ACTIVE: {activeLocation.name}
        </span>

        {/* Tablet: ◉ All Locations */}
        <span className="hidden sm:inline lg:hidden text-[13px] font-semibold tracking-tight text-[#123C35]">
          <span className="text-[#C9A45C] mr-1 font-bold">◉</span>
          {activeLocation.name}
        </span>

        {/* Mobile: ◉ All Stores */}
        <span className="sm:hidden text-[13px] font-semibold tracking-tight truncate max-w-[95px] text-[#123C35]">
          <span className="text-[#C9A45C] mr-1 font-bold">◉</span>
          {activeLocation.id === 'ALL' ? 'All Stores' : activeLocation.shortName}
        </span>

        <ChevronDown
          className={`w-3.5 h-3.5 text-[#123C35] transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 mt-2 w-64 rounded-2xl bg-white shadow-2xl border border-[#E2DDD2] py-2 z-50 animate-in fade-in duration-150"
        >
          <div className="px-3.5 py-1.5 border-b border-[#E2DDD2]">
            <p className="text-[10px] uppercase tracking-wider font-extrabold text-[#687080]">
              LOCATION
            </p>
          </div>

          <div className="py-1 px-1.5 space-y-0.5">
            {/* Global option for Admin */}
            {isGlobalAdmin && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setCurrentLocation('ALL');
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-left transition-colors rounded-xl cursor-pointer ${
                  currentLocation === 'ALL'
                    ? 'bg-[#EDF3F0] text-[#123C35] font-bold'
                    : 'text-[#182033] hover:bg-[#F7F4ED]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`text-xs ${currentLocation === 'ALL' ? 'text-[#C9A45C] font-black' : 'text-[#687080]'}`}>
                    {currentLocation === 'ALL' ? '✓' : '•'}
                  </span>
                  <span>All Locations</span>
                </div>
                {currentLocation === 'ALL' && <Check className="w-3.5 h-3.5 text-[#C9A45C] shrink-0" />}
              </button>
            )}

            {/* Specific authorized stores */}
            {availableLocations.map((loc) => {
              const isSelected = String(loc.id) === currentLocation;
              return (
                <button
                  key={loc.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setCurrentLocation(String(loc.id));
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-left transition-colors rounded-xl cursor-pointer ${
                    isSelected
                      ? 'bg-[#EDF3F0] text-[#123C35] font-bold'
                      : 'text-[#182033] hover:bg-[#F7F4ED]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`text-xs ${isSelected ? 'text-[#C9A45C] font-black' : 'text-[#687080]'}`}>
                      {isSelected ? '✓' : '•'}
                    </span>
                    <span className="truncate">{loc.name}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#C9A45C] shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
