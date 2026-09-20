import React, { createContext, useContext, useState, useEffect } from 'react';
import { Auth, UserSession } from '../services/api';

export interface LocationItem {
  id: number;
  code: string;
  name: string;
  storeName: string;
}

export const MASTER_LOCATIONS: LocationItem[] = [
  { id: 1, code: 'BEL', name: 'Belagavi', storeName: 'BSC Textiles Belagavi' },
  { id: 2, code: 'DAV', name: 'Davanagere', storeName: 'BSC Textiles Davanagere' },
  { id: 3, code: 'SHI', name: 'Shivamogga', storeName: 'BSC Textiles Shivamogga' }
];

interface LocationContextType {
  currentLocation: string; // 'ALL' | '1' | '2' | '3'
  setCurrentLocation: (locId: string) => void;
  availableLocations: LocationItem[];
  canSwitch: boolean;
  isGlobalAdmin: boolean;
  currentLocationLabel: string;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<UserSession | null>(() => Auth.get());
  const [currentLocation, setCurrentLocationState] = useState<string>(() => {
    return localStorage.getItem('bsc_selected_location') || 'ALL';
  });

  useEffect(() => {
    const handleAuthChange = () => {
      setSession(Auth.get());
    };
    window.addEventListener('storage', handleAuthChange);
    return () => window.removeEventListener('storage', handleAuthChange);
  }, []);

  const isGlobalAdmin = !session?.locationId || session?.isGlobalAdmin || ['Admin', 'Super Admin'].includes(session?.role || '');

  // Calculate available locations for the user
  const availableLocations = React.useMemo(() => {
    if (!session) return [];
    if (isGlobalAdmin) return MASTER_LOCATIONS;

    const allowed = Array.isArray(session.allowedLocations) && session.allowedLocations.length > 0
      ? session.allowedLocations
      : (session.locationId ? [session.locationId] : [2]);

    return MASTER_LOCATIONS.filter(loc => allowed.includes(loc.id));
  }, [session, isGlobalAdmin]);

  const canSwitch = isGlobalAdmin || availableLocations.length > 1;

  // Validate that the currently selected location is actually permitted
  useEffect(() => {
    if (!session) return;
    if (isGlobalAdmin) return; // Can access any location

    const allowedIds = availableLocations.map(l => String(l.id));
    if (currentLocation !== 'ALL' && !allowedIds.includes(currentLocation)) {
      // Auto-revert to the user's primary or first allowed location
      const fallback = allowedIds[0] || String(session.locationId || 2);
      setCurrentLocationState(fallback);
      localStorage.setItem('bsc_selected_location', fallback);
    }
  }, [session, isGlobalAdmin, availableLocations, currentLocation]);

  const setCurrentLocation = (locId: string) => {
    setCurrentLocationState(locId);
    localStorage.setItem('bsc_selected_location', locId);
    // Dispatch custom event so listeners throughout the app can re-fetch data
    window.dispatchEvent(new CustomEvent('bsc_location_changed', { detail: { locationId: locId } }));
  };

  const currentLocationLabel = React.useMemo(() => {
    if (currentLocation === 'ALL') return isGlobalAdmin ? 'All Locations' : 'All Assigned';
    const loc = MASTER_LOCATIONS.find(l => String(l.id) === currentLocation);
    return loc ? `${loc.name} (${loc.code})` : 'Davanagere (DAV)';
  }, [currentLocation, isGlobalAdmin]);

  return (
    <LocationContext.Provider
      value={{
        currentLocation,
        setCurrentLocation,
        availableLocations,
        canSwitch,
        isGlobalAdmin,
        currentLocationLabel
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocationContext = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocationContext must be used within a LocationProvider');
  }
  return context;
};
