import { useCallback, useEffect, useState } from 'react';
import Lenis from 'lenis';
import { API, Auth, UserSession } from '../../services/api';
import { getDefaultLandingRoute } from '../../utils/moduleRegistry';
import { NAV_LINKS } from './content';
import { lockScroll, scrollToId, setLenis } from './motion/smoothScroll';
import { useActiveSection, useMediaQuery } from './motion/hooks';
import Loader from './components/Loader';
import Navigation from './components/Navigation';
import Cursor from './components/Cursor';
import Footer from './components/Footer';
import Hero from './sections/Hero';
import Ticker from './sections/Ticker';
import House from './sections/House';
import Stats from './sections/Stats';
import Counters from './sections/Counters';
import Featured from './sections/Featured';
import Wedding from './sections/Wedding';
import Stores from './sections/Stores';
import { Highlights, Stories } from './sections/Highlights';
import { Cta, Desks } from './sections/Cta';
import './landing.css';

interface StoreLocation {
  location_name?: string;
  address?: string;
  phone?: string;
}

interface LandingStats {
  totalStores: number;
  totalCustomers: number;
  totalFeedback: number;
  csatRating: number;
  totalStaff?: number;
  totalFootfall?: number;
}

type Phase = 'load' | 'out' | 'done';

export default function LandingPage() {
  // Opened into a background tab? Skip the intro entirely rather than park the
  // reader behind the loader with the viewport locked.
  const [phase, setPhase] = useState<Phase>(() => (typeof document !== 'undefined' && document.hidden ? 'done' : 'load'));
  const [session, setSession] = useState<UserSession | null>(() => Auth.get());
  const [staffRoute, setStaffRoute] = useState('/dashboard');
  const [stats, setStats] = useState<LandingStats>({
    totalStores: 3,
    totalCustomers: 0,
    totalFeedback: 0,
    csatRating: 99
  });
  const [loading, setLoading] = useState(true);

  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const finePointer = useMediaQuery('(pointer: fine)');
  const active = useActiveSection(NAV_LINKS.map((l) => l.id));

  /* ── document metadata ─────────────────────────────────────────────── */
  useEffect(() => {
    const previous = document.title;
    document.title =
      'BSC Textiles — Pure Silk Sarees, Wedding Suites & Menswear | Belagavi · Davanagere · Shivamogga';
    return () => {
      document.title = previous;
    };
  }, []);

  /* ── staff route for the signed-in state ───────────────────────────── */
  useEffect(() => {
    if (session && Auth.check()) {
      const route = getDefaultLandingRoute(session, null);
      setStaffRoute(route || '/dashboard');
    }
  }, [session]);

  /* ── live counters ─────────────────────────────────────────────────── */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await API.getLandingStats().catch(() => null);
        if (alive && res?.success && res.data) setStats(res.data as LandingStats);
      } catch (err) {
        console.warn('[Landing] stats unavailable', err);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* ── smooth scrolling (fine pointers only, never under reduced motion) ─ */
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
      setLenis(instance);
      const loop = (time: number) => {
        instance?.raf(time);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    } catch {
      instance = null;
      setLenis(null);
    }

    return () => {
      cancelAnimationFrame(raf);
      try {
        instance?.destroy();
      } catch {
        /* noop */
      }
      setLenis(null);
    };
  }, []);

  /* ── loader → hero handover ────────────────────────────────────────── */
  const handleReady = useCallback(() => {
    setPhase((p) => (p === 'load' ? 'out' : p));
  }, []);

  useEffect(() => {
    if (phase === 'load') {
      lockScroll(true);
      return () => lockScroll(false);
    }
    if (phase === 'out') {
      // Hold the viewport only while the loader is still wiping off screen.
      lockScroll(true);
      const t = window.setTimeout(() => setPhase('done'), reduced ? 240 : 1150);
      return () => {
        window.clearTimeout(t);
        lockScroll(false);
      };
    }
    return;
  }, [phase, reduced]);

  /* ── the intro may never hold the site ───────────────────────────────── */
  useEffect(() => {
    // The loader ramp is driven by requestAnimationFrame, which browsers suspend in
    // a background tab. Without these escapes the page can sit covered, with the
    // viewport locked, until someone focuses the tab.
    const hardStop = window.setTimeout(() => setPhase('done'), 3000);
    const onShow = () => {
      if (document.hidden) setPhase('done');
    };
    document.addEventListener('visibilitychange', onShow);
    return () => {
      window.clearTimeout(hardStop);
      document.removeEventListener('visibilitychange', onShow);
    };
  }, []);

  const revealed = phase !== 'load';

  const isStaff = Boolean(session && Auth.check());

  const proofLine =
    stats.totalFeedback > 0
      ? `${stats.csatRating}% positive across ${stats.totalFeedback.toLocaleString('en-IN')} feedback slips`
      : 'Silk Mark certified — authentic handloom guaranteed';

  const familiesLine =
    stats.totalCustomers > 0 ? `${stats.totalCustomers.toLocaleString('en-IN')} wedding lists on file` : null;

  return (
    <div className="bsc-site">
      <a className="skip" href="#main-content">
        Skip to main content
      </a>

      <Cursor enabled={finePointer && revealed} />

      <Navigation
        ready={revealed}
        active={active}
        isStaff={isStaff}
        staffRoute={staffRoute}
      />

      <main id="main-content">
        <Hero ready={revealed} proofLine={proofLine} familiesLine={familiesLine} />
        <Ticker />
        <House />
        <Stats stats={stats} loading={loading} />
        <Counters />
        <Featured />
        <Wedding />
        <Stores />
        <Highlights />
        <Stories csat={stats.csatRating} />
        <Cta />
        <Desks />
      </main>

      <Footer onNavigate={scrollToId} />

      <Loader phase={phase} onReady={handleReady} />
    </div>
  );
}
