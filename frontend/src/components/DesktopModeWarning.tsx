import React, { useState, useEffect } from 'react';
import { Monitor, X } from 'lucide-react';

// Configure the mobile breakpoint width here (pixels)
const MOBILE_BREAKPOINT = 768;

export default function DesktopModeWarning() {
  const [isVisible, setIsVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const checkViewport = () => {
      if (window.innerWidth < MOBILE_BREAKPOINT) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
        setDismissed(false); // Reset dismissal if they go back to desktop size
      }
    };

    // Initial check on mount
    checkViewport();

    // Listen for resize and orientation changes
    window.addEventListener('resize', checkViewport);
    window.addEventListener('orientationchange', checkViewport);

    return () => {
      window.removeEventListener('resize', checkViewport);
      window.removeEventListener('orientationchange', checkViewport);
    };
  }, []);

  if (!isVisible || dismissed) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-5">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border-2 border-primary overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-primary p-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-accent" />
            <h3 className="font-bold text-sm">Desktop Mode Recommended</h3>
          </div>
          <button 
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          <p className="text-sm font-bold text-primary text-center leading-relaxed">
            Please open this website in Desktop Mode for the best experience.
          </p>
          <div className="mt-6 flex justify-center">
            <button 
              type="button"
              onClick={() => setDismissed(true)}
              className="px-6 py-2.5 rounded-xl bg-primary text-white font-bold text-sm shadow-md shadow-primary/20 hover:bg-primary-hover active:scale-95 transition-all"
            >
              Continue Anyway
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
