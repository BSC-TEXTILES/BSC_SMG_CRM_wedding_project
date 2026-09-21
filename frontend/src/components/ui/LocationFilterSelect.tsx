import React from 'react';
import { MapPin, Globe, Lock, ChevronDown } from 'lucide-react';
import { useLocationContext, MASTER_LOCATIONS, LocationItem } from '../../context/LocationContext';
import { Auth } from '../../services/api';

interface LocationFilterSelectProps {
  value?: number | string;
  onChange?: (locId: number | '') => void;
  className?: string;
  showAllOption?: boolean;
  allOptionLabel?: string;
  autoSyncGlobal?: boolean;
  disabled?: boolean;
}

export default function LocationFilterSelect({
  value,
  onChange,
  className = '',
  showAllOption = true,
  allOptionLabel = '🌐 All Locations',
  autoSyncGlobal = true,
  disabled = false
}: LocationFilterSelectProps) {
  const {
    currentLocation,
    setCurrentLocation,
    availableLocations,
    allLocations,
    canSwitch,
    isGlobalAdmin
  } = useLocationContext();

  const session = Auth.get();
  const effectiveIsGlobal = isGlobalAdmin || !session?.locationId || ['Admin', 'Super Admin'].includes(session?.role || '');

  // Active locations to display in the selector
  const displayLocations: LocationItem[] = (
    availableLocations && availableLocations.length > 0 ? availableLocations : allLocations && allLocations.length > 0 ? allLocations : MASTER_LOCATIONS
  ).map((loc) => {
    const id = Number(loc.id) || 0;
    const name = loc.location_name || loc.name || (id === 1 ? 'Belagavi' : id === 2 ? 'Davanagere' : id === 3 ? 'Shivamogga' : `Store ${id}`);
    const code = (loc.location_code || loc.code || (id === 1 ? 'BEL' : id === 2 ? 'DAV' : id === 3 ? 'SHI' : 'LOC')).toUpperCase();
    return {
      ...loc,
      id,
      name,
      code,
      location_name: name,
      location_code: code
    };
  });

  // Normalize current selected value
  const currentValue = value !== undefined
    ? (value === '' || value === 'ALL' ? '' : String(value))
    : (currentLocation === 'ALL' ? '' : String(currentLocation));

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const rawVal = e.target.value;
    const numericVal = rawVal ? Number(rawVal) : '';

    if (autoSyncGlobal) {
      const globalVal = rawVal ? String(rawVal) : 'ALL';
      setCurrentLocation(globalVal);
    }

    if (onChange) {
      onChange(numericVal);
    }
  };

  // If user is restricted to a single branch, show fixed lock badge
  if (!effectiveIsGlobal && !canSwitch && displayLocations.length <= 1) {
    const singleLoc = displayLocations[0] || MASTER_LOCATIONS.find(l => l.id === (session?.locationId || 2)) || MASTER_LOCATIONS[1];
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F6F4EF] border border-[#DFDDD7] text-[#182033] text-xs font-bold shadow-2xs select-none ${className}`}
        title={`Your account is scoped strictly to ${singleLoc.name} (${singleLoc.code})`}
      >
        <MapPin className="w-3.5 h-3.5 text-[#C9A45C] flex-shrink-0" />
        <span className="truncate max-w-[130px]">{singleLoc.name} ({singleLoc.code})</span>
        <Lock className="w-3 h-3 text-[#687080] flex-shrink-0" />
      </div>
    );
  }

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <div className="absolute left-2.5 sm:left-3 pointer-events-none text-[#C9A45C] flex items-center justify-center z-10">
        {currentValue === '' ? (
          <Globe className="w-3.5 h-3.5 text-[#16805B]" />
        ) : (
          <MapPin className="w-3.5 h-3.5 text-[#C9A45C]" />
        )}
      </div>

      <select
        value={currentValue}
        onChange={handleChange}
        disabled={disabled}
        aria-label="Filter by store location"
        className="w-full pl-8 sm:pl-8.5 pr-8 py-2 bg-white hover:bg-[#FDFBF7] focus:bg-white border border-[#DFDDD7] hover:border-[#C9A45C] focus:border-[#C9A45C] focus:ring-1 focus:ring-[#C9A45C] rounded-xl text-xs font-bold text-[#182033] transition-all shadow-2xs cursor-pointer appearance-none outline-none disabled:opacity-60 disabled:cursor-not-allowed min-w-[145px] sm:min-w-[170px]"
      >
        {showAllOption && (
          <option value="">
            {allOptionLabel}
          </option>
        )}
        {displayLocations.map((loc) => (
          <option key={loc.id} value={String(loc.id)}>
            📍 {loc.name} ({loc.code})
          </option>
        ))}
      </select>

      <div className="absolute right-2.5 pointer-events-none text-[#687080] flex items-center justify-center z-10">
        <ChevronDown className="w-3.5 h-3.5" />
      </div>
    </div>
  );
}
