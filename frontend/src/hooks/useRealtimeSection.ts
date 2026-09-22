import { useEffect, useRef } from 'react';
import { realtimeClient, RealtimeEntity } from '../services/realtimeClient';

interface UseRealtimeSectionOptions {
  debounceMs?: number;
  enabled?: boolean;
}

/**
 * useRealtimeSection
 * 
 * Subscribes to real-time entity update events without triggering full page reloads,
 * navigation changes, or destroying form/filter/tab states.
 * 
 * @param entities Array of entities to listen to e.g. ['user', 'wedding', 'feedback']
 * @param onUpdate Callback function to invoke when data changes
 * @param options Debounce configuration and enable toggle
 */
export function useRealtimeSection(
  entities: RealtimeEntity[],
  onUpdate: (eventDetail?: any) => void,
  options: UseRealtimeSectionOptions = {}
) {
  const { debounceMs = 350, enabled = true } = options;
  const timeoutRef = useRef<any>(null);
  const onUpdateRef = useRef(onUpdate);

  // Keep latest callback reference
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (!enabled || !entities || entities.length === 0) return;

    // Ensure client connection is active
    realtimeClient.connect();

    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        try {
          onUpdateRef.current(customEvent.detail);
        } catch (err) {
          console.warn('[useRealtimeSection] Error in section update handler:', err);
        }
      }, debounceMs);
    };

    // Attach listener for each requested entity
    const eventNames = entities.map(ent => `realtime:${ent}`);
    eventNames.forEach(evt => {
      window.addEventListener(evt, handler);
    });

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      eventNames.forEach(evt => {
        window.removeEventListener(evt, handler);
      });
    };
  }, [entities.join(','), debounceMs, enabled]);
}
