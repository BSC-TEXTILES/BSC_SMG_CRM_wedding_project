import React, { createContext, useContext, useState, useEffect } from 'react';
import { API, Auth, UserSession } from '../services/api';

export interface LocationItem {
  id: number;
  code: string;
  name: string;
  storeName: string;
  location_name?: string;
  location_code?: string;
}

export const MASTER_LOCATIONS: LocationItem[] = [
  { id: 1, code: 'BEL', name: 'Belagavi', storeName: 'BSC Textiles Belagavi', location_name: 'Belagavi', location_code: 'BEL' },
  { id: 2, code: 'DAV', name: 'Davanagere', storeName: 'BSC Textiles Davanagere', location_name: 'Davanagere', location_code: 'DAV' },
  { id: 3, code: 'SHI', name: 'Shivamogga', storeName: 'BSC Textiles Shivamogga', location_name: 'Shivamogga', location_code: 'SHI' }
];

interface LocationContextType {
  currentLocation: string; // 'ALL' | '1' | '2' | '3'
  setCurrentLocation: (locId: string) => void;
  availableLocations: LocationItem[];
  allLocations: LocationItem[];
  canSwitch: boolean;
  isGlobalAdmin: boolean;
  currentLocationLabel: string;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<UserSession | null>(() => Auth.get());
  const [dbLocations, setDbLocations] = useState<LocationItem[]>(MASTER_LOCATIONS);
  const [currentLocation, setCurrentLocationState] = useState<string>(() => {
    const sess = Auth.get();
    const isGlobal = !sess?.locationId || sess?.isGlobalAdmin || ['Admin', 'Super Admin'].includes(sess?.role || '');
    const saved = localStorage.getItem('bsc_selected_location');
    if (isGlobal) {
      return saved || 'ALL';
    }
    if (sess?.locationId) {
      return String(sess.locationId);
    }
    return saved || '1';
  });

  // Load locations dynamically from API
  useEffect(() => {
    API.getLocations().then((res: any) => {
      if (res?.locations && Array.isArray(res.locations) && res.locations.length > 0) {
        setDbLocations(res.locations);
      }
    }).catch(() => {});
  }, []);

  // Synchronize with external changes (e.g. storage or custom event from page selectors)
  useEffect(() => {
    const handleAuthChange = () => {
      const updatedSess = Auth.get();
      setSession(updatedSess);
      const isGlobal = !updatedSess?.locationId || updatedSess?.isGlobalAdmin || ['Admin', 'Super Admin'].includes(updatedSess?.role || '');
      if (!isGlobal && updatedSess?.locationId) {
        setCurrentLocationState(String(updatedSess.locationId));
        localStorage.setItem('bsc_selected_location', String(updatedSess.locationId));
      }
    };
    const handleLocationEvent = (e: any) => {
      const newLoc = e?.detail?.locationId;
      if (newLoc !== undefined && newLoc !== null) {
        setCurrentLocationState(String(newLoc));
      }
    };
    window.addEventListener('storage', handleAuthChange);
    window.addEventListener('bsc_location_changed', handleLocationEvent);
    return () => {
      window.removeEventListener('storage', handleAuthChange);
      window.removeEventListener('bsc_location_changed', handleLocationEvent);
    };
  }, []);

  const isGlobalAdmin = !session?.locationId || session?.isGlobalAdmin || ['Admin', 'Super Admin'].includes(session?.role || '');

  const activeMasterList = dbLocations.length > 0 ? dbLocations : MASTER_LOCATIONS;

  // Calculate available locations for the user
  const availableLocations = React.useMemo(() => {
    if (!session) return [];
    if (isGlobalAdmin) return activeMasterList;

    const allowed = Array.isArray(session.allowedLocations) && session.allowedLocations.length > 0
      ? session.allowedLocations
      : (session.locationId ? [session.locationId] : [1]);

    return activeMasterList.filter(loc => allowed.includes(loc.id));
  }, [session, isGlobalAdmin, activeMasterList]);

  const canSwitch = isGlobalAdmin || availableLocations.length > 1;

  // Validate that the currently selected location is actually permitted
  useEffect(() => {
    if (!session) return;
    if (isGlobalAdmin) return; // Can access any location

    const allowedIds = availableLocations.map(l => String(l.id));
    // For non-global admin, 'ALL' is NEVER allowed. Must match one of allowedIds
    if (!allowedIds.includes(currentLocation)) {
      const fallback = allowedIds[0] || (session.locationId ? String(session.locationId) : '1');
      setCurrentLocationState(fallback);
      localStorage.setItem('bsc_selected_location', fallback);
    }
  }, [session, isGlobalAdmin, availableLocations, currentLocation]);

  const setCurrentLocation = (locId: string) => {
    const val = String(locId || (isGlobalAdmin ? 'ALL' : (session?.locationId ? String(session.locationId) : '1')));
    // Non-global admin cannot switch to 'ALL' or unauthorized location
    if (!isGlobalAdmin) {
      const allowedIds = availableLocations.map(l => String(l.id));
      if (!allowedIds.includes(val)) return;
    }
    setCurrentLocationState(val);
    localStorage.setItem('bsc_selected_location', val);
    // Dispatch custom event so listeners throughout the app can re-fetch data
    window.dispatchEvent(new CustomEvent('bsc_location_changed', { detail: { locationId: val } }));
  };

  const currentLocationLabel = React.useMemo(() => {
    if (currentLocation === 'ALL') return isGlobalAdmin ? 'All Locations' : 'All Assigned';
    const loc = activeMasterList.find(l => String(l.id) === currentLocation);
    return loc ? `${loc.name} (${loc.code})` : 'Davanagere (DAV)';
  }, [currentLocation, isGlobalAdmin, activeMasterList]);

  return (
    <LocationContext.Provider
      value={{
        currentLocation,
        setCurrentLocation,
        availableLocations,
        allLocations: activeMasterList,
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
