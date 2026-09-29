import React, { useEffect, useState } from 'react';

interface BscLoaderProps {
  onComplete: () => void;
}

export default function BscLoader({ onComplete }: BscLoaderProps) {
  const [phase, setPhase] = useState<'logo' | 'brand' | 'fadeout' | 'done'>('logo');

  useEffect(() => {
    // If loader already completed in this session, skip immediately
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('bsc_app_loaded')) {
      onComplete();
      return;
    }

    // If opened in background tab, skip directly
    if (typeof document !== 'undefined' && document.hidden) {
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('bsc_app_loaded', '1');
      onComplete();
      return;
    }

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const t1 = setTimeout(() => setPhase('brand'), isMobile ? 220 : 400);
    const t2 = setTimeout(() => setPhase('fadeout'), isMobile ? 650 : 1100);
    const t3 = setTimeout(() => {
      setPhase('done');
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('bsc_app_loaded', '1');
      onComplete();
    }, isMobile ? 950 : 1500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  if (phase === 'done') return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#140D08] text-[#FAF7F2] transition-opacity duration-500 select-none ${
        phase === 'fadeout' ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col items-center gap-5 text-center px-6">
        {/* Exact Official BSC Master Logo */}
        <div className="relative">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white/5 border border-white/10 p-2 shadow-2xl flex items-center justify-center backdrop-blur-md animate-pulse">
            <img
              src="/Main_logo_web.png"
              alt="BSC Textiles"
              width={96}
              height={96}
              decoding="async"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="absolute -inset-3 rounded-full bg-[#E8C7A8]/10 blur-xl pointer-events-none" />
        </div>

        {/* Brand Reveal */}
        <div
          className={`space-y-1.5 transition-all duration-700 transform ${
            phase === 'brand' || phase === 'fadeout'
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-2'
          }`}
        >
          <h1 className="font-serif tracking-[0.2em] text-lg sm:text-xl font-bold text-[#E8C7A8] uppercase">
            BSC Textiles
          </h1>
          <p className="text-[10px] sm:text-xs font-medium tracking-[0.16em] uppercase text-[#A69385]">
            Established 1938 · Five Generations
          </p>
        </div>

        {/* Minimal Progress Line */}
        <div className="w-28 h-[2px] bg-white/10 rounded-full overflow-hidden mt-2">
          <div className="w-full h-full bg-gradient-to-r from-[#B76E79] via-[#E8C7A8] to-[#B76E79] animate-[shimmer_1.5s_infinite]" />
        </div>
      </div>
    </div>
  );
}
