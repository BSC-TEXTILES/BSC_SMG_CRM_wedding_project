import React, { useCallback, useEffect, useState, Suspense, lazy } from 'react';
import Lenis from 'lenis';
import HeaderNav from './components/HeaderNav';
import BscLoader from './components/BscLoader';
import CinematicHero from './sections/CinematicHero';
import LegacySection from './sections/LegacySection';
import EditorialCollections from './sections/EditorialCollections';
import WeddingSuiteSection from './sections/WeddingSuiteSection';
import StoreLocationsSection from './sections/StoreLocationsSection';
import ShivamoggaEventSection from './sections/ShivamoggaEventSection';
import CraftsmanshipSection from './sections/CraftsmanshipSection';
import ContactDesksSection from './sections/ContactDesksSection';
import LuxuryFooter from './components/LuxuryFooter';
import './landing.css';

const BscThreeCanvas = lazy(() => import('./components/BscThreeCanvas'));

const SECTION_IDS = [
  'hero',
  'legacy',
  'collections',
  'wedding',
  'stores',
  'shivamogga-event',
  'about',
  'contact'
];

export default function LandingPage() {
  const [activeSection, setActiveSection] = useState('hero');
  const [scrollY, setScrollY] = useState(0);
  const [isLoaderFinished, setIsLoaderFinished] = useState(false);

  /* ── Document Metadata ─────────────────────────────────────────────── */
  useEffect(() => {
    const previous = document.title;
    document.title = 'BSC Textiles';
    return () => {
      document.title = previous;
    };
  }, []);

  /* ── Smooth Scrolling with Lenis (only on non-reduced motion) ───────── */
  useEffect(() => {
    const coarse = !window.matchMedia('(pointer: fine)').matches;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (coarse || reduce) return;

    let instance: Lenis | null = null;
    let raf = 0;
    try {
      instance = new Lenis({
        duration: 1.05,
        smoothWheel: true,
        syncTouch: false,
        wheelMultiplier: 1,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t))
      });
      const loop = (time: number) => {
        instance?.raf(time);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    } catch {
      instance = null;
    }

    return () => {
      cancelAnimationFrame(raf);
      instance?.destroy();
    };
  }, []);

  /* ── Track Active Section and Scroll Depth ─────────────────────────── */
  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY || 0;
      setScrollY(currentY);

      const scrollPos = currentY + 200;
      for (const id of SECTION_IDS) {
        const el = document.getElementById(id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPos >= top && scrollPos < top + height) {
            setActiveSection(id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavigate = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  return (
    <div className="relative min-h-screen w-full bg-[#120B07] text-[#2B1722] selection:bg-[#B76E79] selection:text-white">
      {/* ============================================================== */}
      {/* 0. ELEGANT INTRO LOADER SEQUENCE                               */}
      {/* ============================================================== */}
      <BscLoader onComplete={() => setIsLoaderFinished(true)} />

      {/* ============================================================== */}
      {/* 1. THREE.JS 3D SCROLL & PARTICLE CANVAS (Lazily Streamed)      */}
      {/* ============================================================== */}
      <Suspense fallback={null}>
        <BscThreeCanvas scrollY={scrollY} />
      </Suspense>

      {/* ============================================================== */}
      {/* 2. OUTER CINEMATIC BACKGROUND (100% Full Viewport)             */}
      {/* ============================================================== */}
      <div className="bsc-outer-env" aria-hidden="true">
        <img
          src="/images/floor.webp"
          alt=""
          width={1920}
          height={1080}
          className="bsc-outer-bg-img"
          loading="eager"
          decoding="async"
        />
        <div className="bsc-outer-vignette" />
      </div>

      {/* ============================================================== */}
      {/* 3. CENTERED WEBSITE FRAME (Sitting Over Background)            */}
      {/* ============================================================== */}
      <div className="relative z-10 py-3 sm:py-6 lg:py-8">
        <div className="bsc-main-window-frame">
          {/* Top Minimal Navigation */}
          <HeaderNav activeSection={activeSection} onNavigate={handleNavigate} />

          {/* Main Website Sections */}
          <main id="main-content" className="flex flex-col">
            {/* 1. Hero Section + Floating Glass Card + 3D Scroll Depth */}
            <CinematicHero onScrollTo={handleNavigate} scrollY={scrollY} />

            {/* 2. BSC Heritage & Legacy Visual Timeline */}
            <LegacySection />

            {/* 3. Editorial 3D Collections Gallery */}
            <EditorialCollections />

            {/* 4. Wedding Shopping & Private Suites */}
            <WeddingSuiteSection />

            {/* 5. Flagship Store Locations */}
            <StoreLocationsSection />

            {/* 6. Shivamogga Flagship Announcement */}
            <ShivamoggaEventSection />

            {/* 7. Craftsmanship & Silk Mark Guarantee */}
            <CraftsmanshipSection />

            {/* 8. Interactive Contact & Service Desks */}
            <ContactDesksSection />
          </main>

          {/* Luxury Footer */}
          <LuxuryFooter />
        </div>
      </div>
    </div>
  );
}

