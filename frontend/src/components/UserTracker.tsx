import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { API, Auth } from '../services/api';

// Track navigation history to avoid duplicate tracking
let lastTrackedPath = '';
let lastTrackedTime = 0;

export default function UserTracker() {
  const location = useLocation();

  useEffect(() => {
    const session = Auth.get();
    if (!session || !session.username) {
      return; // No user logged in, don't track
    }

    // Skip tracking for certain public pages
    const publicPages = [
      '/login',
      '/',
      '/feedback-public',
      '/feedback-qr',
      '/wedding-registration',
      '/wedding/customer-registration',
      '/track',
      '/greeter',
      '/footfall',
      '/tv'
    ];

    if (publicPages.includes(location.pathname)) {
      return;
    }

    // Avoid duplicate tracking for the same path within 1 second
    const currentPath = location.pathname + location.search;
    const now = Date.now();
    if (currentPath === lastTrackedPath && now - lastTrackedTime < 1000) {
      return;
    }

    // Track page navigation
    const trackPageView = () => {
      try {
        const session = Auth.get();
        if (session && session.username) {
          API.trackUserActivity(
            session.id,
            session.username,
            'Page Navigation',
            document.title || location.pathname,
            location.pathname + location.search,
            {
              from: location.state?.from,
              referrer: document.referrer
            }
          ).catch(() => {}); // Don't block navigation on tracking failure
          
          // Update tracking state
          lastTrackedPath = currentPath;
          lastTrackedTime = now;
        }
      } catch (e) {
        // Silently fail
      }
    };

    // Track page view with a small delay to avoid rapid successive tracking
    const timer = setTimeout(trackPageView, 200);

    return () => {
      clearTimeout(timer);
    };
  }, [location]);

  return null; // This component doesn't render anything
}
