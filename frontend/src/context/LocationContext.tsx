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
    const isAdminRole = ['Admin', 'Super Admin', 'system administrator'].includes(sess?.role || '');
    const isGlobal = isAdminRole && (!sess?.locationId || sess?.isGlobalAdmin === true);
    if (isGlobal) {
      const saved = localStorage.getItem('bsc_selected_location');
      return saved || 'ALL';
    }
    if (sess?.locationId) {
      return String(sess.locationId);
    }
    return '3';
  });

  // Load locations dynamically from API
  useEffect(() => {
    API.getLocations().then((res: any) => {
      if (res?.locations && Array.isArray(res.locations) && res.locations.length > 0) {
        setDbLocations(res.locations);
      }
    }).catch(() => {});
  }, []);

  const isAdminRole = ['Admin', 'Super Admin', 'system administrator'].includes(session?.role || '');
  const isGlobalAdmin = isAdminRole && (!session?.locationId || session?.isGlobalAdmin === true);

  const activeMasterList = dbLocations.length > 0 ? dbLocations : MASTER_LOCATIONS;

  // Calculate available locations for the user
  const availableLocations = React.useMemo(() => {
    if (!session) return [];
    if (isGlobalAdmin) return activeMasterList;

    const allowed = Array.isArray(session.allowedLocations) && session.allowedLocations.length > 0
      ? session.allowedLocations.map((l: any) => (typeof l === 'object' && l !== null ? Number(l.id) : Number(l)))
      : (session.locationId ? [Number(session.locationId)] : [3]);

    return activeMasterList.filter(loc => allowed.includes(loc.id));
  }, [session, isGlobalAdmin, activeMasterList]);

  const canSwitch = isGlobalAdmin || availableLocations.length > 1;

  // Synchronize with external changes (e.g. storage or custom event from page selectors)
  useEffect(() => {
    const handleAuthChange = () => {
      const updatedSess = Auth.get();
      setSession(updatedSess);
      const isAdm = ['Admin', 'Super Admin', 'system administrator'].includes(updatedSess?.role || '');
      const isGlob = isAdm && (!updatedSess?.locationId || updatedSess?.isGlobalAdmin === true);
      if (!isGlob && updatedSess?.locationId) {
        const target = String(updatedSess.locationId);
        setCurrentLocationState(target);
        localStorage.setItem('bsc_selected_location', target);
      }
    };
    const handleLocationEvent = (e: any) => {
      const newLoc = e?.detail?.locationId;
      if (newLoc !== undefined && newLoc !== null) {
        const currentSess = Auth.get();
        const isAdm = ['Admin', 'Super Admin', 'system administrator'].includes(currentSess?.role || '');
        const isGlob = isAdm && (!currentSess?.locationId || currentSess?.isGlobalAdmin === true);
        if (!isGlob) {
          const allowed = (Array.isArray(currentSess?.allowedLocations) && currentSess.allowedLocations.length > 0)
            ? currentSess.allowedLocations.map((l: any) => String(typeof l === 'object' && l !== null ? l.id : l))
            : [String(currentSess?.locationId || '3')];
          if (newLoc === 'ALL' || !allowed.includes(String(newLoc))) {
            console.warn('[LocationContext] Blocked attempt to select unauthorized location:', newLoc);
            return;
          }
        }
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

  // Validate that the currently selected location is actually permitted
  useEffect(() => {
    if (!session) return;
    if (isGlobalAdmin) return; // Super admin can access any location or 'ALL'

    const allowedIds = availableLocations.map(l => String(l.id));
    // For non-global admin, 'ALL' is NEVER allowed. Must match one of allowedIds
    if (!allowedIds.includes(currentLocation) || currentLocation === 'ALL') {
      const fallback = (session.locationId ? String(session.locationId) : allowedIds[0]) || '3';
      setCurrentLocationState(fallback);
      localStorage.setItem('bsc_selected_location', fallback);
      window.dispatchEvent(new CustomEvent('bsc_location_changed', { detail: { locationId: fallback } }));
    }
  }, [session, isGlobalAdmin, availableLocations, currentLocation]);

  const setCurrentLocation = (locId: string) => {
    // Non-global admin cannot switch to 'ALL' or unauthorized location
    if (!isGlobalAdmin) {
      const allowedIds = availableLocations.map(l => String(l.id));
      if (locId === 'ALL' || !allowedIds.includes(String(locId))) {
        console.warn('[LocationContext] Unauthorized attempt to switch location blocked:', locId);
        return;
      }
    }
    const val = String(locId || (isGlobalAdmin ? 'ALL' : (session?.locationId ? String(session.locationId) : '3')));
    setCurrentLocationState(val);
    localStorage.setItem('bsc_selected_location', val);
    // Dispatch custom event so listeners throughout the app can re-fetch data
    window.dispatchEvent(new CustomEvent('bsc_location_changed', { detail: { locationId: val } }));
  };

  const currentLocationLabel = React.useMemo(() => {
    if (currentLocation === 'ALL') return isGlobalAdmin ? 'All Locations' : 'All Assigned';
    const loc = activeMasterList.find(l => String(l.id) === currentLocation);
    return loc ? `${loc.name} (${loc.code})` : 'Shivamogga (SHI)';
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
