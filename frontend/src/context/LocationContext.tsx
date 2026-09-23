import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { API, Auth, UserSession } from '../services/api';

export interface LocationItem {
  id: number;
  code: string;
  name: string;
  storeName: string;
  location_name?: string;
  location_code?: string;
}

export interface ActiveLocation {
  id: number | 'ALL';
  code: string;
  name: string;
  shortName: string;
}

export const MASTER_LOCATIONS: LocationItem[] = [
  { id: 1, code: 'BEL', name: 'Belagavi', storeName: 'BSC Textiles Belagavi', location_name: 'Belagavi', location_code: 'BEL' },
  { id: 2, code: 'DAV', name: 'Davanagere', storeName: 'BSC Textiles Davanagere', location_name: 'Davanagere', location_code: 'DAV' },
  { id: 3, code: 'SHI', name: 'Shivamogga', storeName: 'BSC Textiles Shivamogga', location_name: 'Shivamogga', location_code: 'SHI' }
];

export const ALL_LOCATION_OBJECT: ActiveLocation = {
  id: 'ALL',
  code: 'ALL',
  name: 'All Locations',
  shortName: 'ALL'
};

export type LocationStatus = 'loading' | 'ready' | 'error';

interface LocationContextType {
  activeLocation: ActiveLocation;
  currentLocation: string; // 'ALL' | '1' | '2' | '3' for compatibility
  locationStatus: LocationStatus;
  setCurrentLocation: (locId: string | number) => void;
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
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('loading');

  const activeMasterList = useMemo(() => {
    return dbLocations.length > 0 ? dbLocations : MASTER_LOCATIONS;
  }, [dbLocations]);

  // Determine initial location based strictly on authentication and role
  const resolveInitialLocation = useCallback((sess: UserSession | null): string => {
    if (!sess) return 'ALL';

    const roleNorm = (sess.role || '').toLowerCase().replace(/[_\s-]+/g, ' ');
    const isAdminRole = ['admin', 'super admin', 'system administrator'].includes(roleNorm);
    const isGlobal = isAdminRole && (!sess.locationId || sess.isGlobalAdmin === true);

    if (isGlobal) {
      const saved = localStorage.getItem('bsc_selected_location');
      return saved || 'ALL';
    }

    if (sess.locationId) {
      return String(sess.locationId);
    }

    if (Array.isArray(sess.allowedLocations) && sess.allowedLocations.length > 0) {
      const first = sess.allowedLocations[0];
      return String(first && typeof first === 'object' ? (first as any).id : (first ?? ''));
    }

    return '';
  }, []);

  const [currentLocation, setCurrentLocationState] = useState<string>(() => {
    const sess = Auth.get();
    return resolveInitialLocation(sess);
  });

  // Load locations dynamically from API
  useEffect(() => {
    let isMounted = true;
    API.getLocations()
      .then((res: any) => {
        if (!isMounted) return;
        if (res?.locations && Array.isArray(res.locations) && res.locations.length > 0) {
          const mapped = res.locations.map((l: any) => ({
            id: Number(l.id),
            code: String(l.location_code || (l.id === 1 ? 'BEL' : l.id === 2 ? 'DAV' : 'SHI')).toUpperCase(),
            name: String(l.location_name || (l.id === 1 ? 'Belagavi' : l.id === 2 ? 'Davanagere' : 'Shivamogga')),
            storeName: `BSC Textiles ${l.location_name || (l.id === 1 ? 'Belagavi' : l.id === 2 ? 'Davanagere' : 'Shivamogga')}`,
            location_name: l.location_name,
            location_code: l.location_code
          }));
          setDbLocations(mapped);
        }
      })
      .catch((err) => {
        console.warn('[LocationContext] Using fallback master locations:', err);
      })
      .finally(() => {
        if (isMounted) setLocationStatus('ready');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const roleNorm = (session?.role || '').toLowerCase().replace(/[_\s-]+/g, ' ');
  const isAdminRole = ['admin', 'super admin', 'system administrator'].includes(roleNorm);
  const isGlobalAdmin = isAdminRole && (!session?.locationId || session?.isGlobalAdmin === true);

  // Available locations strictly scoped by authorization
  const availableLocations = useMemo(() => {
    if (!session) return activeMasterList;
    if (isGlobalAdmin) return activeMasterList;

    const allowed = Array.isArray(session.allowedLocations) && session.allowedLocations.length > 0
      ? session.allowedLocations.map((l: any) => (typeof l === 'object' && l !== null ? Number(l.id) : Number(l)))
      : (session.locationId ? [Number(session.locationId)] : []);

    return activeMasterList.filter(loc => allowed.includes(loc.id));
  }, [session, isGlobalAdmin, activeMasterList]);

  const canSwitch = isGlobalAdmin || availableLocations.length > 1;

  // Active Location Object
  const activeLocation = useMemo<ActiveLocation>(() => {
    if (currentLocation === 'ALL' || (!currentLocation && isGlobalAdmin)) {
      return ALL_LOCATION_OBJECT;
    }
    const numId = Number(currentLocation);
    const found = activeMasterList.find(l => l.id === numId);
    if (found) {
      return {
        id: found.id,
        code: found.code,
        name: found.name,
        shortName: found.name
      };
    }
    // If user has assigned location
    if (session?.locationId) {
      const locId = Number(session.locationId);
      const name = session.locationName || (locId === 1 ? 'Belagavi' : locId === 2 ? 'Davanagere' : 'Shivamogga');
      const code = session.locationCode || (locId === 1 ? 'BEL' : locId === 2 ? 'DAV' : 'SHI');
      return { id: locId, code, name, shortName: name };
    }
    return ALL_LOCATION_OBJECT;
  }, [currentLocation, isGlobalAdmin, activeMasterList, session]);

  // Synchronize with external changes
  useEffect(() => {
    const handleAuthChange = () => {
      const updatedSess = Auth.get();
      setSession(updatedSess);
      const newLoc = resolveInitialLocation(updatedSess);
      if (newLoc) {
        setCurrentLocationState(newLoc);
        localStorage.setItem('bsc_selected_location', newLoc);
      }
    };

    const handleLocationEvent = (e: any) => {
      const newLoc = e?.detail?.locationId;
      if (newLoc !== undefined && newLoc !== null) {
        const currentSess = Auth.get();
        const roleN = (currentSess?.role || '').toLowerCase().replace(/[_\s-]+/g, ' ');
        const isAdm = ['admin', 'super admin', 'system administrator'].includes(roleN);
        const isGlob = isAdm && (!currentSess?.locationId || currentSess?.isGlobalAdmin === true);

        if (!isGlob) {
          const allowed = (Array.isArray(currentSess?.allowedLocations) && currentSess.allowedLocations.length > 0)
            ? currentSess.allowedLocations.map((l: any) => String(typeof l === 'object' && l !== null ? l.id : l))
            : (currentSess?.locationId ? [String(currentSess.locationId)] : []);
          
          if (newLoc === 'ALL' || !allowed.includes(String(newLoc))) {
            console.warn('[LocationContext] Blocked unauthorized location selection:', newLoc);
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
  }, [resolveInitialLocation]);

  // Validate active selection against permissions
  useEffect(() => {
    if (!session) return;
    if (isGlobalAdmin) return;

    const allowedIds = availableLocations.map(l => String(l.id));
    if (allowedIds.length > 0 && (!allowedIds.includes(currentLocation) || currentLocation === 'ALL')) {
      const target = (session.locationId ? String(session.locationId) : allowedIds[0]);
      if (target && target !== currentLocation) {
        setCurrentLocationState(target);
        localStorage.setItem('bsc_selected_location', target);
        window.dispatchEvent(new CustomEvent('bsc_location_changed', { detail: { locationId: target } }));
      }
    }
  }, [session, isGlobalAdmin, availableLocations, currentLocation]);

  const setCurrentLocation = useCallback((locId: string | number) => {
    const strVal = String(locId);
    if (!isGlobalAdmin) {
      const allowedIds = availableLocations.map(l => String(l.id));
      if (strVal === 'ALL' || !allowedIds.includes(strVal)) {
        console.warn('[LocationContext] Unauthorized attempt to switch location:', locId);
        return;
      }
    }
    setCurrentLocationState(strVal);
    localStorage.setItem('bsc_selected_location', strVal);
    window.dispatchEvent(new CustomEvent('bsc_location_changed', { detail: { locationId: strVal } }));
  }, [isGlobalAdmin, availableLocations]);

  const currentLocationLabel = useMemo(() => {
    if (currentLocation === 'ALL') {
      return isGlobalAdmin ? 'All Locations' : 'All Assigned';
    }
    const loc = activeMasterList.find(l => String(l.id) === currentLocation);
    if (loc) return `${loc.name} (${loc.code})`;
    if (session?.locationName) return `${session.locationName} (${session.locationCode || ''})`;
    return 'Location not set';
  }, [currentLocation, isGlobalAdmin, activeMasterList, session]);

  return (
    <LocationContext.Provider
      value={{
        activeLocation,
        currentLocation,
        locationStatus,
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
