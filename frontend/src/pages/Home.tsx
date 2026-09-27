import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { API, Auth, UserSession } from '../services/api';
import { getDefaultLandingRoute } from '../utils/moduleRegistry';
import {
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  CheckCircle,
  ChevronRight,
  Clock,
  Crown,
  Heart,
  LogIn,
  MapPin,
  Menu,
  MessageCircle,
  MessageSquare,
  Phone,
  Search,
  ShieldCheck,
  Star,
  Store,
  X
} from 'lucide-react';
import './Home.styles.css';

interface StoreLocation {
  id: number;
  location_code: string;
  location_name: string;
  store_name: string;
  address: string;
  phone: string;
  email?: string;
  status?: string;
}

interface LandingStats {
  totalStores: number;
  totalCustomers: number;
  totalFeedback: number;
  csatRating: number;
  totalStaff: number;
  totalFootfall: number;
}

const YEARS_AT_THE_COUNTER = new Date().getFullYear() - 1938;

const NAV_LINKS = [
  { id: 'house', label: 'The House' },
  { id: 'floor', label: 'Showroom Floor' },
  { id: 'collections', label: 'Department Counters' },
  { id: 'wedding-trousseau', label: 'Wedding Shopping' },
  { id: 'stores', label: 'Flagship Stores' }
];

const DEPT_RAIL_LINKS = [
  { id: 'house', label: 'The House' },
  { id: 'floor', label: 'Showroom' },
  { id: 'women', label: 'Women' },
  { id: 'jewellery', label: 'Jewellery' },
  { id: 'suits', label: 'Suits' },
  { id: 'men', label: 'Men' },
  { id: 'brands', label: 'Brands' },
  { id: 'home', label: 'Home Furnishing' },
  { id: 'towels', label: 'Towels' },
  { id: 'wedding-trousseau', label: 'Wedding' },
  { id: 'stores', label: 'Stores' },
  { id: 'why', label: 'Why BSC' }
];

const mapsHref = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

/* ── Brand mark ───────────────────────────────────────────────────────── */
function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      <rect x="0.75" y="0.75" width="38.5" height="38.5" rx="9" fill="#101C36" />
      <rect x="0.75" y="0.75" width="38.5" height="38.5" rx="9" fill="none" stroke="#C9A45C" strokeWidth="1.5" />
      <g stroke="#C9A45C" strokeWidth="1.5" strokeLinecap="round">
        <path d="M11 14h18" opacity="0.9" />
        <path d="M11 20h18" opacity="0.65" />
        <path d="M11 26h18" opacity="0.4" />
        <path d="M14 11v18" opacity="0.55" />
        <path d="M20 11v18" opacity="0.9" />
        <path d="M26 11v18" opacity="0.55" />
      </g>
      <rect x="17.5" y="17.5" width="5" height="5" fill="#E4CB92" />
    </svg>
  );
}

/* ── Illustrated portraits for customer stories ── */
const PORTRAITS = [
  { bg: '#EFE4D3', skin: '#C58A5B', hair: '#241A14', cloth: '#7E2B3B', style: 'bun' },
  { bg: '#E2E8F1', skin: '#8B5A3A', hair: '#141110', cloth: '#1F3A5F', style: 'short' },
  { bg: '#E4EBE4', skin: '#DCA477', hair: '#3A2A1D', cloth: '#2E6A54', style: 'long' }
] as const;

function Portrait({ index }: { index: number }) {
  const p = PORTRAITS[index % PORTRAITS.length];
  return (
    <span className="block w-11 h-11 shrink-0 rounded-full overflow-hidden ring-1 ring-[#E3DDD1]">
      <svg viewBox="0 0 64 64" width="44" height="44" aria-hidden="true" focusable="false">
        <rect width="64" height="64" fill={p.bg} />
        <rect x="28" y="33" width="8" height="9" rx="3" fill={p.skin} />
        <path d="M10 64c1.5-12 10-19 22-19s20.5 7 22 19z" fill={p.cloth} />
        <circle cx="32" cy="27" r="12.5" fill={p.skin} />
        {p.style === 'bun' && <circle cx="32" cy="13.5" r="5" fill={p.hair} />}
        {p.style === 'long' ? (
          <path
            d="M18.5 31c0-9 6.2-16 13.5-16s13.5 7 13.5 16v12h-4.5V30c0-6-3.8-10.5-9-10.5s-9 4.5-9 10.5v13h-4.5z"
            fill={p.hair}
          />
        ) : (
          <path d="M19.5 27.5c0-8.5 5.6-14.5 12.5-14.5s12.5 6 12.5 14.5v.5c-1-6.5-5-9.5-12.5-9.5s-11.5 3-12.5 9.5z" fill={p.hair} />
        )}
        <circle cx="27.6" cy="27.5" r="1.5" fill="#2A2119" />
        <circle cx="36.4" cy="27.5" r="1.5" fill="#2A2119" />
        <path
          d="M29 32.4c1.1 1.5 4.9 1.5 6 0"
          stroke="#2A2119"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </span>
  );
}

function Stars({ rating, label }: { rating: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1" role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`w-3.5 h-3.5 ${
            n <= rating ? 'text-[#C9A45C] fill-[#C9A45C]' : 'text-[#C9A45C]/35'
          }`}
        />
      ))}
    </span>
  );
}

/* ── Count-up animation for metric numbers ── */
function Counter({ value, loading }: { value: number; loading: boolean }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const frame = useRef<number | null>(null);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const el = ref.current;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!el || reduce || value <= 0) {
      setShown(value);
      return;
    }

    let played = false;
    const run = () => {
      if (played) return;
      played = true;
      const start = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / 1100);
        setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
        if (p < 1) frame.current = requestAnimationFrame(step);
      };
      frame.current = requestAnimationFrame(step);
    };

    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && run()),
      { threshold: 0.35 }
    );
    io.observe(el);

    const settle = window.setTimeout(() => setShown(value), 1600);

    return () => {
      io.disconnect();
      window.clearTimeout(settle);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [value]);

  if (loading && value <= 0) {
    return (
      <span ref={ref} className="lp-skeleton h-[0.9em] w-16 align-middle" aria-hidden="true" />
    );
  }

  return (
    <span ref={ref}>
      {value > 0 ? shown.toLocaleString('en-IN') : '—'}
    </span>
  );
}

export default function Home() {
  const [session, setSession] = useState<UserSession | null>(() => Auth.get());
  const [userLandingRoute, setUserLandingRoute] = useState<string>('/login');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('house');
  const [scrollProgress, setScrollProgress] = useState(0);

  const [locations, setLocations] = useState<StoreLocation[]>([]);
  const [stats, setStats] = useState<LandingStats>({
    totalStores: 3,
    totalCustomers: 0,
    totalFeedback: 0,
    csatRating: 99,
    totalStaff: 0,
    totalFootfall: 0
  });
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (session && Auth.check()) {
      const route = getDefaultLandingRoute(session, null);
      setUserLandingRoute(route || '/dashboard');
    }
  }, [session]);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [statsRes, locRes] = await Promise.all([
          API.getLandingStats().catch(() => null),
          API.getLandingLocations().catch(() => null)
        ]);

        if (isMounted) {
          if (statsRes?.success && statsRes.data) setStats(statsRes.data);
          if (locRes?.locations && Array.isArray(locRes.locations)) setLocations(locRes.locations);
          else if (locRes?.data && Array.isArray(locRes.data)) setLocations(locRes.data);
        }
      } catch (err) {
        console.warn('[Landing] Live data fetch note:', err);
      } finally {
        if (isMounted) setLoadingData(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  /* Page title & meta */
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'BSC Textiles — Pure Silk Sarees, Wedding & Menswear | Belagavi, Davanagere, Shivamogga';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  /* Scroll position & progress calculation */
  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      setScrollProgress(Math.min(100, Math.max(0, progress)));
      setNavScrolled(scrollTop > 18);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Intersection observer for active section tracking */
  useEffect(() => {
    const trackedIds = DEPT_RAIL_LINKS.map((d) => d.id);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-20% 0px -60% 0px' }
    );

    trackedIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  /* Section reveal observer */
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof IntersectionObserver === 'undefined') {
      nodes.forEach((n) => n.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.08, rootMargin: '0px 0px -6% 0px' }
    );
    nodes.forEach((n) => !n.classList.contains('is-visible') && io.observe(n));
    return () => io.disconnect();
  }, []);

  /* Close drawer on Escape */
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileMenuOpen]);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (!element) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  const storeRows = [
    {
      key: 'belagavi',
      badge: 'Flagship Showroom Floor',
      est: 'Est. 1938',
      name: 'BSC Textiles, Belagavi',
      address: 'Khade Bazar / Raviwar Peth, Tilakwadi, Belagavi, Karnataka 590001',
      phone: '+91 831 242 1938',
      hours: '10:30 AM – 8:30 PM · Seven days',
      departments: 'Royal Bridal Silks · Jewellery Suite · Menswear',
      featured: false
    },
    {
      key: 'davanagere',
      badge: 'Home & Linen Floor',
      est: 'Est. 1978',
      name: 'BSC Textiles, Davanagere',
      address: 'Mandipet / PB Road, MCC B Block, Davanagere, Karnataka 577001',
      phone: '+91 8192 221938',
      hours: '10:30 AM – 8:00 PM · Seven days',
      departments: 'Home Furnishing · Luxury Towels · Bed Linens',
      featured: true
    },
    {
      key: 'shivamogga',
      badge: 'Suit Desk & Branded Menswear',
      est: 'Est. 1992',
      name: 'BSC Textiles, Shivamogga',
      address: 'Nehru Road / Durgigudi Main Road, Shivamogga, Karnataka 577201',
      phone: '+91 8182 221938',
      hours: '11:00 AM – 8:00 PM · Tuesday to Sunday (Mon by appt.)',
      departments: 'Bespoke Tailoring · Sherwanis · Bandhgalas',
      featured: false
    }
  ].map((row, i) => {
    const live = locations[i];
    const liveAddress = typeof live?.address === 'string' ? live.address.trim() : '';
    const livePhone = typeof live?.phone === 'string' ? live.phone.trim() : '';
    return {
      ...row,
      address: liveAddress || row.address,
      phone: livePhone || row.phone
    };
  });

  const proofLine =
    stats.totalFeedback > 0
      ? `${stats.csatRating}% positive across ${stats.totalFeedback.toLocaleString('en-IN')} customer feedback slips`
      : 'Silk Mark certified — authentic handloom guaranteed';

  const familiesLine =
    stats.totalCustomers > 0 ? `${stats.totalCustomers.toLocaleString('en-IN')} wedding lists on file` : null;

  return (
    <div className="bsc-lp relative min-h-screen overflow-x-hidden">
      {/* ── Top Scroll Progress Bar (Bared Page Indicator) ─────────── */}
      <div
        className="lp-scroll-progress"
        style={{ width: `${scrollProgress}%` }}
        aria-hidden="true"
      />

      <a href="#main-content" className="lp-skip">
        Skip to main content
      </a>

      {/* ── Announcement rail ─────────────────────────────────────── */}
      <div className="relative z-30 bg-[#07101F] border-b border-[#C9A45C]/25">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <Link
            to="/wedding-registration"
            className="group inline-flex items-center gap-2 text-[11px] sm:text-xs text-[#E4CB92] hover:text-[#FFF6E2] transition-colors"
          >
            <span className="uppercase tracking-[0.16em] font-semibold">Muhurtham Season</span>
            <span className="hidden sm:inline text-[#A9B3C4]">
              private draping suites are open all seven days
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-[#F3DC9B]">
              Book your hour
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>

          <div className="flex items-center gap-4 text-[11px] text-[#A9B3C4]">
            <span className="hidden md:inline">Belagavi · Davanagere · Shivamogga</span>
            <a
              href="tel:+918192221938"
              className="inline-flex items-center gap-1.5 text-[#E4CB92] hover:text-[#FFF6E2] transition-colors font-medium"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>+91 8192 221938</span>
            </a>
          </div>
        </div>
      </div>

      {/* ── Main Sticky Header ────────────────────────────────────── */}
      <header className={`lp-nav sticky top-0 z-40 ${navScrolled ? 'is-scrolled' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[4.5rem] flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3 group shrink-0" aria-label="BSC Textiles, home">
            <img src="/logo.webp" width={53} height={40} alt="BSC Textiles" className="h-10 sm:h-11 w-auto object-contain shrink-0" />
            <span className="flex flex-col leading-none text-left">
              <span className="lp-serif text-[1.15rem] font-semibold tracking-[-0.01em] text-[#101C36] group-hover:text-[#8A6317] transition-colors">
                BSC Textiles
              </span>
              <span className="mt-1 text-[9.5px] font-semibold uppercase tracking-[0.22em] text-[#5D6573]">
                Est. 1938 · Karnataka
              </span>
            </span>
          </Link>

          <nav aria-label="Primary" className="hidden lg:flex items-center gap-7">
            {NAV_LINKS.map((link) => (
              <button
                key={link.id}
                onClick={() => scrollToSection(link.id)}
                className={`lp-navlink cursor-pointer ${activeSection === link.id ? 'is-active' : ''}`}
                aria-current={activeSection === link.id ? 'true' : undefined}
              >
                {link.label}
              </button>
            ))}
          </nav>

          <div className="hidden sm:flex items-center gap-3">
            <Link
              to="/wedding-registration"
              className="lp-btn lp-btn--navy lp-btn--sm lp-btn--shine"
            >
              <Heart className="w-4 h-4 text-[#E4CB92] fill-[#E4CB92]" />
              <span>Register Wedding</span>
            </Link>

            <Link
              to={session && Auth.check() ? userLandingRoute : '/login'}
              className="lp-btn lp-btn--quiet lp-btn--sm"
            >
              <LogIn className="w-4 h-4" />
              <span>{session && Auth.check() ? 'Workspace' : 'Staff Login'}</span>
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="lg:hidden p-2.5 -mr-2 rounded-lg text-[#101C36] hover:bg-[#F1ECE3] transition-colors"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div
            id="mobile-menu"
            className="lg:hidden border-t border-[#E3DDD1] bg-[#FFFDF9] px-5 py-5 shadow-[0_24px_40px_-28px_rgba(16,28,54,0.5)] lp-fade-panel"
          >
            <nav aria-label="Mobile" className="flex flex-col">
              {NAV_LINKS.map((link) => (
                <button
                  key={link.id}
                  onClick={() => scrollToSection(link.id)}
                  className="text-left py-3 text-sm font-medium text-[#4A5261] hover:text-[#8A6317] border-b border-[#F1ECE3] transition-colors"
                >
                  {link.label}
                </button>
              ))}
            </nav>

            <div className="mt-5 flex flex-col gap-3">
              <Link
                to="/wedding-registration"
                onClick={() => setMobileMenuOpen(false)}
                className="lp-btn lp-btn--navy lp-btn--block"
              >
                <Heart className="w-4 h-4 text-[#E4CB92] fill-[#E4CB92]" />
                Register Wedding
              </Link>
              <Link
                to={session && Auth.check() ? userLandingRoute : '/login'}
                onClick={() => setMobileMenuOpen(false)}
                className="lp-btn lp-btn--quiet lp-btn--block"
              >
                <LogIn className="w-4 h-4" />
                {session && Auth.check() ? 'Open Staff Workspace' : 'Staff Login'}
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ── Sticky Department Scrolling Bar ───────────────────────── */}
      <nav className="lp-dept-bar" aria-label="Department Directory">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ul className="lp-dept-rail">
            {DEPT_RAIL_LINKS.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => scrollToSection(item.id)}
                  className={`lp-dept-pill ${activeSection === item.id ? 'is-active' : ''}`}
                >
                  <span>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* ── Main Content Body ─────────────────────────────────────── */}
      <main id="main-content" className="relative z-10">
        {/* 1 · Hero Section featuring authentic real floor.jpg & real photoshoot photo */}
        <section className="lp-grain relative isolate flex items-center overflow-hidden bg-[#07101F]">
          <div className="absolute inset-0 -z-10">
            <img
              src="/images/floor.webp"
              srcSet="/images/floor-sm.webp 900w, /images/floor.webp 1800w"
              sizes="100vw"
              width={1800}
              height={1201}
              alt="BSC Textiles authentic flagship showroom floor in Belagavi"
              {...{ fetchpriority: 'high' }}
              loading="eager"
              decoding="async"
              className="w-full h-full object-cover object-[center_35%]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#07101F]/95 via-[#07101F]/75 to-[#07101F]/30" />
            <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(7,16,31,0.92),rgba(7,16,31,0.25)_45%,rgba(7,16,31,0.60))]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_20%_40%,rgba(201,164,92,0.18),transparent)]" />
          </div>

          <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
            <div className="max-w-2xl lp-onink">
              <p
                data-reveal
                className="inline-flex items-center gap-2 rounded-full border border-[#C9A45C]/45 bg-[#07101F]/75 px-3.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-[#E4CB92] backdrop-blur-sm"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Cloth House · Belagavi · Davanagere · Shivamogga · Est. 1938
              </p>

              <h1
                data-reveal
                style={{ transitionDelay: '90ms' }}
                className="lp-display mt-6 text-white [text-wrap:balance]"
              >
                The cloth is still sold <span className="lp-accent">on the counter</span>.
              </h1>

              <p
                data-reveal
                style={{ transitionDelay: '180ms' }}
                className="lp-lede lp-measure mt-6 text-[#D5DCE7]"
              >
                BSC Textiles keeps menswear, womenswear, suits, jewellery, towels and home linen in one
                building. Wedding shopping is a booked hour, so a family list is not rushed between other
                customers. Every saree leaves with a Silk Mark tag and its weaver guild certificate.
              </p>

              <div
                data-reveal
                style={{ transitionDelay: '270ms' }}
                className="mt-9 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <Link to="/wedding-registration" className="lp-btn lp-btn--gold lp-btn--shine">
                  Reserve Wedding Hour
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => scrollToSection('collections')}
                  className="lp-btn lp-btn--onink-quiet"
                >
                  Explore The Floors
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div
                data-reveal
                style={{ transitionDelay: '360ms' }}
                className="mt-10 pt-6 border-t border-white/15 flex flex-wrap items-center gap-x-6 gap-y-3 text-[13px] text-[#C6CEDA]"
              >
                <span className="inline-flex items-center gap-2">
                  <Stars rating={5} label="5 out of 5 stars" />
                  <span>{proofLine}</span>
                </span>
                <span className="inline-flex items-center gap-2">
                  <Store className="w-4 h-4 text-[#C9A45C]" />
                  3 flagship stores · open 10:30 AM – 8:30 PM
                </span>
                <span className="inline-flex items-center gap-2">
                  <Crown className="w-4 h-4 text-[#C9A45C]" />
                  {familiesLine || `${YEARS_AT_THE_COUNTER} years, four generations`}
                </span>
              </div>
            </div>
          </div>

          {/* Real Photoshoot Showcase Card (Desktop) */}
          <div className="hidden lg:flex absolute bottom-8 right-8 max-w-sm items-center gap-3.5 rounded-xl border border-white/20 bg-[#07101F]/85 p-3.5 backdrop-blur-md shadow-2xl">
            <img
              src="/images/women-real.webp"
              width={75}
              height={100}
              alt="Real Photoshoot: Authentic Mulberry Silk Saree with Gold Zari"
              className="w-16 h-20 rounded-lg object-cover object-[50%_15%] ring-1 ring-[#C9A45C]/50 shrink-0"
            />
            <div className="text-[11.5px] leading-relaxed text-[#C6CEDA]">
              <span className="block font-semibold text-white">Pure Mulberry Kanjeevaram</span>
              Authentic handloom with Korvai gold zari border · Tested at the counter
            </div>
          </div>
        </section>

        {/* 2 · Live Metrics Band */}
        <section className="lp-onink bg-[#101C36] border-y border-[#C9A45C]/25 py-12 lg:py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="sr-only">BSC Textiles at a glance</h2>
            <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-8">
              <div className="text-center lg:text-left flex flex-col">
                <dt className="order-2 mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#C6CEDA]">
                  Flagship Boutiques
                </dt>
                <dd className="order-1">
                  <span className="lp-serif text-4xl lg:text-5xl font-semibold text-[#F3DC9B] tracking-[-0.02em] block">
                    <Counter value={stats.totalStores || 3} loading={false} />
                  </span>
                  <span className="mt-1 text-[11.5px] text-[#A9B3C4] block">Belagavi · Davanagere · Shivamogga</span>
                </dd>
              </div>

              <div className="text-center lg:text-left lg:border-l lg:border-white/10 lg:pl-8 flex flex-col">
                <dt className="order-2 mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#C6CEDA]">
                  Years at the counter
                </dt>
                <dd className="order-1">
                  <span className="lp-serif text-4xl lg:text-5xl font-semibold text-white tracking-[-0.02em] block">
                    {YEARS_AT_THE_COUNTER}
                  </span>
                  <span className="mt-1 text-[11.5px] text-[#A9B3C4] block">Fourth generation, same address</span>
                </dd>
              </div>

              <div className="text-center lg:text-left border-t border-white/10 pt-8 lg:border-t-0 lg:pt-0 lg:border-l lg:border-white/10 lg:pl-8 flex flex-col">
                <dt className="order-2 mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#C6CEDA]">
                  Positive store feedback
                </dt>
                <dd className="order-1">
                  <span className="lp-serif text-4xl lg:text-5xl font-semibold text-[#F3DC9B] tracking-[-0.02em] block">
                    <Counter value={stats.csatRating} loading={loadingData} />
                    <span className="text-2xl lg:text-3xl align-top">%</span>
                  </span>
                  <span className="mt-1 text-[11.5px] text-[#A9B3C4] block">
                    {stats.totalFeedback > 0
                      ? `${stats.totalFeedback.toLocaleString('en-IN')} customer slips on file`
                      : 'A feedback slip filled after every visit'}
                  </span>
                </dd>
              </div>

              <div className="text-center lg:text-left border-t border-white/10 pt-8 lg:border-t-0 lg:pt-0 lg:border-l lg:border-white/10 lg:pl-8 flex flex-col">
                <dt className="order-2 mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#C6CEDA]">
                  Wedding lists on file
                </dt>
                <dd className="order-1">
                  <span className="lp-serif text-4xl lg:text-5xl font-semibold text-white tracking-[-0.02em] block">
                    <Counter value={stats.totalCustomers} loading={loadingData} />
                  </span>
                  <span className="mt-1 text-[11.5px] text-[#A9B3C4] block">Counted live from the bridal desk</span>
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* 3 · The House Section featuring about.jpg */}
        <section id="house" className="bg-[#F6F4EF] py-20 lg:py-28 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            <figure className="lg:col-span-6" data-reveal>
              <div className="lp-frame rounded-2xl overflow-hidden p-2.5 bg-white shadow-xl">
                <div className="relative overflow-hidden rounded-xl lp-image-zoom bg-[#EFECE6]">
                  <img
                    src="/images/about.webp"
                    srcSet="/images/about-sm.webp 800w, /images/about.webp 1400w"
                    sizes="(max-width: 1024px) 100vw, 44vw"
                    width={1400}
                    height={934}
                    alt="Knitwear and fine dresses on wooden hangers in evening shop window"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-[380px] lg:h-[500px] object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#07101F]/80 to-transparent" />
                  <figcaption className="absolute bottom-4 left-4 right-4 text-[12px] text-[#E7ECF4]">
                    <span className="block font-semibold text-[#F3DC9B] uppercase tracking-[0.14em] text-[10px]">
                      Evening light on the rail
                    </span>
                    Cloth is opened on the counter, examined by hand, and marked before you leave.
                  </figcaption>
                </div>
              </div>
            </figure>

            <div className="lg:col-span-6" data-reveal>
              <p className="lp-eyebrow">The house</p>
              <h2 className="lp-h2 mt-4 [text-wrap:balance]">
                Most of what we sell is <span className="lp-accent">chosen in person</span>.
              </h2>
              <div className="lp-rule mt-7 w-16 bg-[#C9A45C]" />

              <p className="lp-body lp-measure mt-7 text-[15.5px]">
                BSC Textiles is a premier textile and bridal house in Belagavi, Davanagere, and Shivamogga.
                The work is ordinary in the best sense: a bale is opened. A shoulder is marked. A chain is
                held to the light. A towel is unfolded so you can feel the weight.
              </p>
              <p className="lp-body lp-measure mt-5">
                Families come back because the same counter remembers them. A school shirt one year, a suit
                the next, then a wedding list with both sides written on facing pages.
              </p>

              <dl className="mt-8 grid sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-[#E3DDD1] bg-[#FFFDF9] p-4">
                  <dt className="text-[13.5px] font-semibold text-[#101C36]">Cloth, opened</dt>
                  <dd className="mt-1 text-[12.5px] text-[#5D6573]">You see the weave before you decide.</dd>
                </div>
                <div className="rounded-xl border border-[#E3DDD1] bg-[#FFFDF9] p-4">
                  <dt className="text-[13.5px] font-semibold text-[#101C36]">Lists, by name</dt>
                  <dd className="mt-1 text-[12.5px] text-[#5D6573]">A wedding note stays with the person who started it.</dd>
                </div>
                <div className="rounded-xl border border-[#E3DDD1] bg-[#FFFDF9] p-4">
                  <dt className="text-[13.5px] font-semibold text-[#101C36]">Suits, on the body</dt>
                  <dd className="mt-1 text-[12.5px] text-[#5D6573]">The fitting is marked here, not guessed from a chart.</dd>
                </div>
                <div className="rounded-xl border border-[#E3DDD1] bg-[#FFFDF9] p-4">
                  <dt className="text-[13.5px] font-semibold text-[#101C36]">Jewellery, quietly</dt>
                  <dd className="mt-1 text-[12.5px] text-[#5D6573]">Trays come out away from the busy aisle.</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        {/* 4 · Flagship Showroom Floor Section featuring floor.jpg */}
        <section id="floor" className="bg-[#101C36] py-20 lg:py-24 px-4 sm:px-6 lg:px-8 lp-onink">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              <div className="lg:col-span-5" data-reveal>
                <p className="inline-flex items-center gap-2 rounded-full border border-[#C9A45C]/40 bg-[#C9A45C]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#F3DC9B]">
                  <Store className="w-3.5 h-3.5" />
                  Showroom Architecture
                </p>
                <h2 className="lp-h2 mt-4 text-white [text-wrap:balance]">
                  The flagship bridal showroom floor, <span className="lp-accent">Belagavi</span>.
                </h2>
                <p className="lp-body lp-measure mt-5 text-[#D5DCE7]">
                  Under chandeliers and hand-polished teak counters, the Belagavi floor hosts Karnataka's
                  most celebrated bridal handlooms. Over 2,400 handpicked pure Kanchipuram and Banarasi sarees
                  are kept in individual cedar sleeves.
                </p>
                <ul className="mt-6 space-y-3 text-[13px] text-[#C6CEDA]">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle className="w-4 h-4 text-[#E4CB92] shrink-0" />
                    <span>Dedicated bridal draping suites with private family seating</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle className="w-4 h-4 text-[#E4CB92] shrink-0" />
                    <span>In-house burn-testing station for pure gold and silver zari</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle className="w-4 h-4 text-[#E4CB92] shrink-0" />
                    <span>Master tailors on-site for immediate blouse and suit markings</span>
                  </li>
                </ul>
                <div className="mt-8">
                  <Link to="/wedding-registration" className="lp-btn lp-btn--gold lp-btn--shine">
                    Book an Hour on This Floor
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              <figure className="lg:col-span-7" data-reveal>
                <div className="rounded-2xl overflow-hidden border border-[#C9A45C]/40 shadow-2xl lp-image-zoom">
                  <img
                    src="/images/floor.webp"
                    srcSet="/images/floor-sm.webp 700w, /images/floor.webp 1400w"
                    sizes="(max-width: 1024px) 100vw, 55vw"
                    width={1400}
                    height={934}
                    alt="BSC Textiles grand bridal showroom floor with silk counters and chandeliers"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-[400px] lg:h-[520px] object-cover"
                  />
                </div>
                <p className="mt-3 text-right text-[11px] text-[#A9B3C4]">
                  Belagavi Flagship · Khade Bazar & Tilakwadi · Open daily
                </p>
              </figure>
            </div>
          </div>
        </section>

        {/* 5 · Department Collections Section featuring women.jpg, jewellery.jpg, suit.jpg, men.jpg, brands.jpg, home.jpg, towels.jpg */}
        <section id="collections" className="bg-[#F1ECE3] py-20 lg:py-28 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <header className="max-w-3xl" data-reveal>
              <p className="lp-eyebrow">The floors</p>
              <h2 className="lp-h2 mt-4 [text-wrap:balance]">
                What the building holds — <span className="lp-accent">nine counters</span>.
              </h2>
              <p className="lp-lede lp-measure mt-4">
                You do not need all of them in one visit. Stock changes with the bale. Every department has
                its dedicated master counter and specialist staff.
              </p>
            </header>

            {/* Department 1: Women featuring authentic real photoshoot photo */}
            <article id="women" className="mt-14 lp-dept-card grid grid-cols-1 lg:grid-cols-12" data-reveal>
              <div className="lg:col-span-6 relative min-h-[360px] lg:min-h-[500px] lp-image-zoom bg-[#E5DFD4]">
                <img
                  src="/images/women-real.webp"
                  width={1200}
                  height={1800}
                  alt="Authentic photoshoot: Model in royal purple silk saree with handcrafted gold zari border"
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover object-[50%_15%]"
                />
                <span className="absolute top-4 left-4 lp-dept-tag">
                  Department 01 · Authentic Handloom Silks
                </span>
              </div>
              <div className="lg:col-span-6 p-7 sm:p-10 lg:p-12 flex flex-col justify-center">
                <p className="lp-eyebrow">Women</p>
                <h3 className="lp-h2 mt-3 text-[1.8rem] lg:text-[2.2rem]">
                  Sarees, suits, and cloth for an ordinary Thursday.
                </h3>
                <p className="lp-body mt-4 text-[15.5px]">
                  Silk stays covered until you ask to see it. Dress material, everyday suits, and bridal
                  Kanjeevarams are on the same floor — so a wedding saree and a weekday set do not require two shops.
                </p>
                <div className="mt-6 flex flex-wrap gap-2 text-[12px] font-semibold text-[#182033]">
                  <span className="bg-[#FAF5EA] border border-[#E3DDD1] rounded-md px-3 py-1">Kanchipuram Korvai</span>
                  <span className="bg-[#FAF5EA] border border-[#E3DDD1] rounded-md px-3 py-1">Banarasi Katan Silk</span>
                  <span className="bg-[#FAF5EA] border border-[#E3DDD1] rounded-md px-3 py-1">Handloom Dress Materials</span>
                </div>
                <div className="mt-8 pt-6 border-t border-[#E3DDD1]">
                  <button
                    type="button"
                    onClick={() => scrollToSection('wedding-trousseau')}
                    className="inline-flex items-center gap-2 font-semibold text-[#8A6317] hover:text-[#101C36] transition-colors"
                  >
                    View Wedding Cloth <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </article>

            {/* Department 2 & 3: Pair (Jewellery featuring jewellery.jpg & Suits featuring suit.jpg) */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Jewellery featuring jewellery.jpg */}
              <article id="jewellery" className="lp-dept-card flex flex-col" data-reveal>
                <div className="relative h-[320px] lp-image-zoom bg-[#E7E2D8]">
                  <img
                    src="/images/jewellery.webp"
                    srcSet="/images/jewellery-sm.webp 800w, /images/jewellery.webp 1400w"
                    sizes="(max-width: 768px) 100vw, 45vw"
                    width={1400}
                    height={970}
                    alt="Gold temple necklace and matching earrings with ruby red stones on velvet tray"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-4 left-4 lp-dept-tag">
                    Department 02 · Jewellery
                  </span>
                </div>
                <div className="p-7 sm:p-8 flex-1 flex flex-col">
                  <h3 className="lp-h3">Jewellery Suite</h3>
                  <p className="lp-body mt-3 text-[14.5px]">
                    Gold and handcrafted set pieces, shown tray by tray. The room is off the aisle,
                    so you are not deciding a ceremonial necklace in a crowd.
                  </p>
                  <p className="mt-auto pt-6 text-[12.5px] font-semibold text-[#8A6317]">
                    Quiet consultation room · By appointment or counter request
                  </p>
                </div>
              </article>

              {/* Suits featuring suit.jpg */}
              <article id="suits" className="lp-dept-card flex flex-col" data-reveal>
                <div className="relative h-[320px] lp-image-zoom bg-[#E7E2D8]">
                  <img
                    src="/images/suit.webp"
                    srcSet="/images/suit-sm.webp 700w, /images/suit.webp 1200w"
                    sizes="(max-width: 768px) 100vw, 45vw"
                    width={1200}
                    height={1200}
                    alt="Tailor with striped shirt holding a bespoke grey checked suit jacket"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-4 left-4 lp-dept-tag">
                    Department 03 · Suits & Tailoring
                  </span>
                </div>
                <div className="p-7 sm:p-8 flex-1 flex flex-col">
                  <h3 className="lp-h3">Suits & Bespoke Tailoring</h3>
                  <p className="lp-body mt-3 text-[14.5px]">
                    A fitting table, not a size you guess from a hanger. Shoulders, chest and sleeve
                    are marked on the body before you leave. Monday fittings by appointment on Coen Road.
                  </p>
                  <p className="mt-auto pt-6 text-[12.5px] font-semibold text-[#8A6317]">
                    First fitting to collection in 5 days · Master cut
                  </p>
                </div>
              </article>
            </div>

            {/* Department 4: Men featuring men.jpg */}
            <article id="men" className="mt-8 lp-dept-card grid grid-cols-1 lg:grid-cols-12 items-center" data-reveal>
              <div className="lg:col-span-6 p-7 sm:p-10 lg:p-12 order-2 lg:order-1">
                <span className="lp-dept-tag">Department 04 · Menswear</span>
                <h3 className="lp-h2 mt-4 text-[1.8rem] lg:text-[2.2rem]">
                  Shirts, trousers, and what you wear when the invitation is formal.
                </h3>
                <p className="lp-body mt-4 text-[15px]">
                  Alterations are noted on the floor, not sent across town. If the shirt needs a wedding
                  jacket as well, the suit desk already has your measurements on file.
                </p>
                <div className="mt-6 flex flex-wrap gap-2 text-[12px] font-semibold text-[#182033]">
                  <span className="bg-[#FAF5EA] border border-[#E3DDD1] rounded-md px-3 py-1">Egyptian Giza Cotton</span>
                  <span className="bg-[#FAF5EA] border border-[#E3DDD1] rounded-md px-3 py-1">Tussar & Matka Silk Kurthas</span>
                  <span className="bg-[#FAF5EA] border border-[#E3DDD1] rounded-md px-3 py-1">Pure Linen Shirting</span>
                </div>
              </div>
              <div className="lg:col-span-6 relative h-[320px] lg:h-[420px] lp-image-zoom bg-[#E7E2D8] order-1 lg:order-2">
                <img
                  src="/images/men.webp"
                  srcSet="/images/men-sm.webp 800w, /images/men.webp 1400w"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  width={1400}
                  height={715}
                  alt="Close detail of crisp white dress shirt beside pale blue shirting"
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              </div>
            </article>

            {/* Department 5, 6, 7 & 8: Quiet Grid (Brands featuring brands.jpg, Home featuring home.jpg, Towels featuring towels.jpg, Other) */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Brands featuring brands.jpg */}
              <article id="brands" className="lp-dept-card flex flex-col" data-reveal>
                <div className="h-56 relative lp-image-zoom bg-[#E7E2D8]">
                  <img
                    src="/images/brands.webp"
                    srcSet="/images/brands-sm.webp 800w, /images/brands.webp 1400w"
                    sizes="(max-width: 640px) 100vw, 25vw"
                    width={1400}
                    height={934}
                    alt="Shop wall of curated premium shirts and dresses"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-3 left-3 lp-dept-tag">05 · Brands</span>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <h4 className="lp-h3 text-[1.2rem]">Curated Brands</h4>
                  <p className="mt-2 text-[13px] leading-relaxed text-[#5D6573]">
                    A short rail of labels the house actually stocks. Only verified mills with authentic weaving pedigree.
                  </p>
                </div>
              </article>

              {/* Home Furnishing featuring home.jpg */}
              <article id="home" className="lp-dept-card flex flex-col" data-reveal>
                <div className="h-56 relative lp-image-zoom bg-[#E7E2D8]">
                  <img
                    src="/images/home.webp"
                    srcSet="/images/home-sm.webp 800w, /images/home.webp 1600w"
                    sizes="(max-width: 640px) 100vw, 25vw"
                    width={1600}
                    height={1465}
                    alt="Wooden bed dressed in warm rust linen with striped pillows"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-3 left-3 lp-dept-tag">06 · Home</span>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <h4 className="lp-h3 text-[1.2rem]">Home Furnishing</h4>
                  <p className="mt-2 text-[13px] leading-relaxed text-[#5D6573]">
                    Bed linen, pure cotton covers, and cloth for the household. Davanagere keeps the fullest range.
                  </p>
                </div>
              </article>

              {/* Towels featuring towels.jpg */}
              <article id="towels" className="lp-dept-card flex flex-col" data-reveal>
                <div className="h-56 relative lp-image-zoom bg-[#E7E2D8]">
                  <img
                    src="/images/towels.webp"
                    srcSet="/images/towels-sm.webp 600w, /images/towels.webp 1000w"
                    sizes="(max-width: 640px) 100vw, 25vw"
                    width={1000}
                    height={1452}
                    alt="Grey and white luxury bath towels on wooden rail"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-3 left-3 lp-dept-tag">07 · Towels</span>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <h4 className="lp-h3 text-[1.2rem]">Towels & Bath</h4>
                  <p className="mt-2 text-[13px] leading-relaxed text-[#5D6573]">
                    Bath and guest towels. Heavy GSM weight and combed zero-twist weave, felt by hand before buying.
                  </p>
                </div>
              </article>

              {/* Counter 09 (Other) */}
              <article className="lp-dept-card flex flex-col p-6 justify-between bg-[#FAF7F2]" data-reveal>
                <div>
                  <span className="lp-dept-tag">08 & 09 · Seasonal</span>
                  <h4 className="lp-h3 mt-4 text-[1.2rem]">Small Gifts & Seasonal</h4>
                  <p className="mt-2 text-[13px] leading-relaxed text-[#5D6573]">
                    Seasonal cloth, ceremonial angavastrams, small gift pieces and dhotis. Ask at the counter if not on the main aisle.
                  </p>
                </div>
                <div className="pt-4 border-t border-[#E3DDD1]">
                  <span className="text-[12px] font-semibold text-[#8A6317]">Always in stock</span>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* 6 · Wedding Shopping Section featuring wedding.jpg */}
        <section id="wedding-trousseau" className="bg-[#07101F] py-20 lg:py-28 px-4 sm:px-6 lg:px-8 lp-onink">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
              <figure className="lg:col-span-5" data-reveal>
                <div className="rounded-2xl overflow-hidden border border-[#C9A45C]/40 shadow-2xl lp-image-zoom bg-[#101C36]">
                  <img
                    src="/images/wedding.webp"
                    srcSet="/images/wedding-sm.webp 700w, /images/wedding.webp 1200w"
                    sizes="(max-width: 1024px) 100vw, 42vw"
                    width={1200}
                    height={1800}
                    alt="Bride dressed in auspicious vermilion and gold silk saree wearing traditional temple necklace"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-[450px] lg:h-[580px] object-cover"
                  />
                  <div className="p-4 bg-[#101C36] border-t border-[#C9A45C]/20 text-[12px] text-[#D5DCE7]">
                    <span className="font-semibold text-[#F3DC9B]">Wedding Silk, Shown in Daylight · </span>
                    Examined one bale at a time in the private family suite.
                  </div>
                </div>
              </figure>

              <div className="lg:col-span-7" data-reveal>
                <p className="inline-flex items-center gap-2 rounded-full border border-[#C9A45C]/40 bg-[#C9A45C]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#F3DC9B]">
                  <Crown className="w-3.5 h-3.5" />
                  Wedding Shopping By Appointment
                </p>

                <h2 className="lp-h2 mt-4 text-white [text-wrap:balance]">
                  Register the list <span className="lp-accent">before the family arrives</span>.
                </h2>

                <p className="lp-body lp-measure mt-4 text-[#D5DCE7] text-[15.5px]">
                  Wedding shopping at BSC Textiles is a booked hour, not a walk-in between other customers.
                  Bring your list, or start one here. We set aside trousseau cloth, the groom’s suit, jewellery,
                  clothes for the wedding party, and linen for the new home.
                </p>

                <ul className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { title: 'Trousseau cloth', desc: 'Sarees and dress material, opened one bale at a time.' },
                    { title: "Groom's ensemble", desc: 'Marked on the body at our master suit desk.' },
                    { title: 'Temple Jewellery', desc: 'Shown in a dedicated room, away from the open floor.' },
                    { title: 'Wedding party', desc: 'Colour-matched clothes for the people standing with you.' },
                    { title: 'Home linen', desc: 'Towels and bed linen for the new household.' },
                    { title: 'Family gifts', desc: 'Small commemorative pieces that do not need a second market.' }
                  ].map((item) => (
                    <li
                      key={item.title}
                      className="rounded-xl border border-white/10 bg-white/[0.04] p-4 transition-colors hover:border-[#C9A45C]/40 hover:bg-white/[0.07]"
                    >
                      <strong className="block text-[14px] text-white">{item.title}</strong>
                      <span className="mt-1 block text-[12.5px] text-[#A9B3C4] leading-relaxed">{item.desc}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-10 pt-7 border-t border-white/15 flex flex-col sm:flex-row gap-3">
                  <Link to="/wedding-registration" className="lp-btn lp-btn--gold lp-btn--shine">
                    <Heart className="w-4 h-4 fill-[#101C36]" />
                    Register for Wedding Shopping
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link to="/wedding-registration" className="lp-btn lp-btn--onink-quiet">
                    Book Consultation
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 7 · Flagship Stores Section */}
        <section id="stores" className="bg-[#F1ECE3] py-20 lg:py-28 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="max-w-3xl" data-reveal>
              <p className="lp-eyebrow">Where to come</p>
              <h2 className="lp-h2 mt-4 [text-wrap:balance]">
                Three counters. <span className="lp-accent">One house</span>.
              </h2>
              <p className="lp-lede lp-measure mt-4">
                Walk in, or write ahead so the suite and stylist are waiting when your family arrives.
                Every floor keeps the same meticulous standards across Karnataka.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-7">
              {storeRows.map((store, i) => (
                <article
                  key={store.key}
                  data-reveal
                  style={{ transitionDelay: `${i * 70}ms` }}
                  className={`lp-card lp-card--hover relative flex flex-col p-6 lg:p-7 ${
                    store.featured ? 'ring-1 ring-[#C9A45C] lg:-mt-3 lg:mb-3' : ''
                  }`}
                >
                  {store.featured && (
                    <span className="absolute -top-3 left-6 rounded-full bg-[#101C36] px-3 py-1 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[#F3DC9B]">
                      Central Home Floor
                    </span>
                  )}

                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-md border border-[#C9A45C] bg-[#FAF5EA] px-2.5 py-1 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[#8A6317]">
                      {store.badge}
                    </span>
                    <span className="text-[11.5px] font-medium text-[#5D6573]">{store.est}</span>
                  </div>

                  <h3 className="lp-h3 mt-4 text-[1.15rem]">{store.name}</h3>

                  <p className="mt-3 flex items-start gap-2.5 text-[13px] leading-relaxed text-[#4A5261]">
                    <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-[#8A6317]" />
                    <span>{store.address}</span>
                  </p>

                  <p className="mt-2.5 flex items-center gap-2.5 text-[13px] font-medium text-[#182033]">
                    <Clock className="w-4 h-4 shrink-0 text-[#8A6317]" />
                    {store.hours}
                  </p>

                  <div className="mt-3 text-[12px] text-[#5D6573] bg-[#FAF7F2] p-2.5 rounded-lg border border-[#E3DDD1]">
                    <span className="font-semibold text-[#182033]">Specialization: </span>
                    {store.departments}
                  </div>

                  <div className="lp-rule mt-6" />

                  <div className="mt-4 flex flex-col gap-3">
                    <a
                      href={`tel:${store.phone.replace(/\s+/g, '')}`}
                      className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#101C36] hover:text-[#8A6317] transition-colors"
                    >
                      <Phone className="w-4 h-4 text-[#8A6317]" />
                      {store.phone}
                    </a>

                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[12.5px]">
                      <a
                        href={mapsHref(store.address)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-[#8A6317] hover:text-[#101C36] transition-colors"
                      >
                        Directions
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </a>
                      <Link
                        to="/wedding-registration"
                        className="font-semibold text-[#101C36] hover:text-[#8A6317] transition-colors"
                      >
                        Book This Store →
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 8 · Why Stay Section */}
        <section id="why" className="bg-[#F6F4EF] py-20 px-4 sm:px-6 lg:px-8 border-t border-[#E3DDD1]">
          <div className="max-w-7xl mx-auto">
            <div className="max-w-2xl" data-reveal>
              <p className="lp-eyebrow">Why stay</p>
              <h2 className="lp-h2 mt-4 [text-wrap:balance]">
                Families come back because the visit is simple.
              </h2>
              <p className="lp-body mt-3">
                No plastic cards, no points, no pressure. If you have visited before, the counter will remember.
              </p>
            </div>

            <ol className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { n: '01', title: 'The counter', desc: 'Cloth is opened and draped, not described from a tag.' },
                { n: '02', title: 'The same person', desc: 'A wedding note can be picked up by the stylist who started it.' },
                { n: '03', title: 'The range', desc: 'A shirt, a saree, a towel and a chain without crossing the market.' },
                { n: '04', title: 'The fitting', desc: 'Suits and blouses are marked on the body by our master drapers.' },
                { n: '05', title: 'The room', desc: 'Jewellery and gold pieces are shown away from the busy aisle.' },
                { n: '06', title: 'The hour', desc: 'Book a consultation ahead of time instead of waiting with a full family.' }
              ].map((reason) => (
                <li
                  key={reason.n}
                  data-reveal
                  className="lp-card p-6 flex flex-col justify-between"
                >
                  <div>
                    <span className="lp-serif text-[1.2rem] font-semibold text-[#8A6317]">{reason.n}</span>
                    <h3 className="mt-2 text-[1.1rem] font-semibold text-[#101C36]">{reason.title}</h3>
                    <p className="mt-2 text-[13px] leading-relaxed text-[#5D6573]">{reason.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 9 · Family Stories & Testimonials */}
        <section id="stories" className="bg-[#F1ECE3] py-20 px-4 sm:px-6 lg:px-8 border-t border-[#E3DDD1]">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6" data-reveal>
              <div className="max-w-2xl">
                <p className="lp-eyebrow">From the families</p>
                <h2 className="lp-h2 mt-4 [text-wrap:balance]">
                  What people say <span className="lp-accent">after the wedding</span>.
                </h2>
              </div>

              <div className="lp-card px-5 py-4 lg:min-w-[19rem]">
                <div className="flex items-center gap-3">
                  <Stars rating={5} label="5 out of 5 stars" />
                  <span className="lp-serif text-lg font-semibold text-[#101C36]">
                    {stats.csatRating}% Positive
                  </span>
                </div>
                <p className="mt-1.5 text-[12px] text-[#5D6573]">
                  Verified feedback slips filled at our three store counters.
                </p>
              </div>
            </div>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              <figure data-reveal className="lp-card lp-card--hover p-6">
                <Stars rating={5} label="5 out of 5 stars" />
                <blockquote className="mt-4 text-[14px] leading-[1.7] text-[#182033]">
                  “We registered on a Tuesday and by Saturday three Korvai-border Kanjeevarams were
                  waiting in Suite 2 with our name on the card. The manager brought the burn test to the table
                  so my mother was completely at ease. Blouse pieces came back stitched in four days.”
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <Portrait index={0} />
                  <span>
                    <span className="block text-[13.5px] font-semibold text-[#101C36]">Meghana Kulkarni</span>
                    <span className="block text-[11.5px] text-[#5D6573]">Bride · Belagavi</span>
                  </span>
                </figcaption>
              </figure>

              <figure data-reveal style={{ transitionDelay: '80ms' }} className="lp-card lp-card--hover p-6 md:mt-8">
                <Stars rating={5} label="5 out of 5 stars" />
                <blockquote className="mt-4 text-[14px] leading-[1.7] text-[#182033]">
                  “The bandhgala and trousers were marked on the body on Sunday and collected on Thursday.
                  No second trip, no delay. The master tailor checked the shoulder drop himself.”
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <Portrait index={1} />
                  <span>
                    <span className="block text-[13.5px] font-semibold text-[#101C36]">Farhan Qureshi</span>
                    <span className="block text-[11.5px] text-[#5D6573]">Groom's family · Davanagere</span>
                  </span>
                </figcaption>
              </figure>

              <figure data-reveal style={{ transitionDelay: '160ms' }} className="lp-card lp-card--hover p-6 md:mt-4">
                <Stars rating={5} label="5 out of 5 stars" />
                <blockquote className="mt-4 text-[14px] leading-[1.7] text-[#182033]">
                  “We had a wedding list with 14 family members. BSC assigned us a private suite with refreshments.
                  Every saree and suit was handled seamlessly under one roof.”
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <Portrait index={2} />
                  <span>
                    <span className="block text-[13.5px] font-semibold text-[#101C36]">Anagha Bhat</span>
                    <span className="block text-[11.5px] text-[#5D6573]">Family of fourteen · Shivamogga</span>
                  </span>
                </figcaption>
              </figure>
            </div>
          </div>
        </section>

        {/* 10 · Public Desks & Staff Portal */}
        <section className="bg-[#F6F4EF] border-t border-[#E3DDD1] py-14 lg:py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="max-w-2xl" data-reveal>
              <p className="lp-eyebrow">Public desks</p>
              <h2 className="lp-h2 mt-3 text-[1.7rem] lg:text-[2.1rem]">
                Everything else, <span className="lp-accent">one click away</span>.
              </h2>
            </div>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
              <Link
                to="/login"
                data-reveal
                className="group sm:col-span-2 lp-card lp-card--hover lp-onink relative overflow-hidden !bg-[#101C36] !border-[#C9A45C]/35 p-6"
              >
                <div className="pointer-events-none absolute -right-10 -bottom-12 h-44 w-44 rounded-full bg-[#C9A45C]/15 blur-2xl" />
                <div className="relative flex items-start justify-between gap-4">
                  <div>
                    <span className="inline-flex items-center gap-2 rounded-md border border-[#C9A45C]/40 bg-[#C9A45C]/10 px-2.5 py-1 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[#F3DC9B]">
                      <LogIn className="w-3 h-3" />
                      Staff Workspace
                    </span>
                    <h3 className="lp-h3 mt-4 text-[1.2rem]">Internal Staff Portal</h3>
                    <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-[#A9B3C4]">
                      Wedding CRM, telecaller desk, customer registry, orders and HR management.
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#E4CB92] group-hover:gap-2.5 transition-all">
                      Sign in to portal
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                  <Briefcase className="w-8 h-8 shrink-0 text-[#C9A45C]/70" />
                </div>
              </Link>

              <Link to="/apply" data-reveal className="lp-card lp-card--hover group p-6">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#C9A45C]/40 bg-[#FAF5EA] text-[#8A6317]">
                  <Briefcase className="w-5 h-5" />
                </span>
                <h3 className="lp-h4 mt-4">Careers at BSC</h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#5D6573]">
                  Floor, draping and telecaller roles across three Karnataka stores.
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#8A6317] group-hover:gap-2 transition-all">
                  See Openings <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>

              <Link to="/feedback-public" data-reveal className="lp-card lp-card--hover group p-6">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#C9A45C]/40 bg-[#FAF5EA] text-[#8A6317]">
                  <MessageSquare className="w-5 h-5" />
                </span>
                <h3 className="lp-h4 mt-4">Rate Your Visit</h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#5D6573]">
                  Takes two minutes. Store managers review feedback daily.
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#8A6317] group-hover:gap-2 transition-all">
                  Leave Feedback <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>

              <Link to="/track" data-reveal className="lp-card lp-card--hover group p-6">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#C9A45C]/40 bg-[#FAF5EA] text-[#8A6317]">
                  <Search className="w-5 h-5" />
                </span>
                <h3 className="lp-h4 mt-4">Track an Order</h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#5D6573]">
                  Blouse stitching, alterations and dispatch by reference ID.
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#8A6317] group-hover:gap-2 transition-all">
                  Track Status <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="lp-onink bg-[#0B1220] border-t border-[#C9A45C]/25 px-4 sm:px-6 lg:px-8 pt-14 pb-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-12 gap-x-8 gap-y-10 pb-10">
            <div className="col-span-2 lg:col-span-4">
              <div className="flex items-center gap-3">
                <div className="bg-white/95 rounded-lg p-1.5 flex items-center justify-center shrink-0 shadow-sm border border-[#C9A45C]/30"><img src="/logo.webp" width={42} height={32} alt="BSC Textiles" className="h-8 w-auto object-contain shrink-0" /></div>
                <span className="lp-serif text-lg font-semibold tracking-[-0.01em] text-white">
                  BSC Textiles
                </span>
              </div>
              <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-[#A9B3C4]">
                A premier handloom silk house working directly with master weaving families in Kanchipuram,
                Varanasi, Arani and Dharmavaram — and with wedding families across Karnataka since 1938.
              </p>
              <p className="mt-4 text-[11.5px] font-medium text-[#E4CB92]">
                Silk Mark Organization of India certified partner
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3 text-[12.5px]">
                <a
                  href="tel:+918192221938"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-[#C6CEDA] hover:border-[#C9A45C] hover:text-[#F3DC9B] transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  +91 8192 221938
                </a>
                <a
                  href="https://wa.me/918192221938"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-[#C6CEDA] hover:border-[#25D366] hover:text-[#25D366] transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                </a>
              </div>
            </div>

            <nav className="lg:col-span-2" aria-label="Departments">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
                Departments
              </h3>
              <ul className="mt-4 space-y-2.5 text-[13px] text-[#A9B3C4]">
                <li><button onClick={() => scrollToSection('women')} className="hover:text-[#F3DC9B] transition-colors text-left">Womenswear & Sarees</button></li>
                <li><button onClick={() => scrollToSection('jewellery')} className="hover:text-[#F3DC9B] transition-colors text-left">Jewellery Suite</button></li>
                <li><button onClick={() => scrollToSection('suits')} className="hover:text-[#F3DC9B] transition-colors text-left">Suits & Tailoring</button></li>
                <li><button onClick={() => scrollToSection('men')} className="hover:text-[#F3DC9B] transition-colors text-left">Menswear</button></li>
                <li><button onClick={() => scrollToSection('home')} className="hover:text-[#F3DC9B] transition-colors text-left">Home Furnishing</button></li>
                <li><button onClick={() => scrollToSection('towels')} className="hover:text-[#F3DC9B] transition-colors text-left">Luxury Towels</button></li>
              </ul>
            </nav>

            <nav className="lg:col-span-2" aria-label="Visit">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
                Stores
              </h3>
              <ul className="mt-4 space-y-2.5 text-[13px] text-[#A9B3C4]">
                <li><button onClick={() => scrollToSection('stores')} className="hover:text-[#F3DC9B] transition-colors text-left">Belagavi Flagship</button></li>
                <li><button onClick={() => scrollToSection('stores')} className="hover:text-[#F3DC9B] transition-colors text-left">Davanagere Central</button></li>
                <li><button onClick={() => scrollToSection('stores')} className="hover:text-[#F3DC9B] transition-colors text-left">Shivamogga Floor</button></li>
                <li className="text-[#F3DC9B]">Daily, 10:30 AM – 8:30 PM</li>
              </ul>
            </nav>

            <nav className="lg:col-span-2" aria-label="Help">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
                Help & Desks
              </h3>
              <ul className="mt-4 space-y-2.5 text-[13px] text-[#A9B3C4]">
                <li><Link to="/wedding-registration" className="hover:text-[#F3DC9B] transition-colors">Register Wedding</Link></li>
                <li><Link to="/track" className="hover:text-[#F3DC9B] transition-colors">Track an Order</Link></li>
                <li><Link to="/feedback-public" className="hover:text-[#F3DC9B] transition-colors">Rate Your Visit</Link></li>
                <li><Link to="/apply" className="hover:text-[#F3DC9B] transition-colors">Careers</Link></li>
                <li><Link to="/login" className="hover:text-[#F3DC9B] transition-colors">Staff Login</Link></li>
              </ul>
            </nav>

            <nav className="col-span-2 lg:col-span-2" aria-label="Legal">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
                Legal
              </h3>
              <ul className="mt-4 space-y-2.5 text-[13px] text-[#A9B3C4]">
                <li><Link to="/madt/privacy" className="hover:text-[#F3DC9B] transition-colors">Privacy Policy</Link></li>
                <li><Link to="/madt/terms" className="hover:text-[#F3DC9B] transition-colors">Terms of Use</Link></li>
                <li>
                  <a
                    href={mapsHref('BSC Textiles Tilakwadi Belagavi')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 hover:text-[#F3DC9B] transition-colors"
                  >
                    Find Flagship
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                </li>
              </ul>
            </nav>
          </div>

          <div className="lp-rule bg-[#1C283F]" />

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left text-[11.5px] text-[#7E8899]">
            <p>
              © {new Date().getFullYear()} BSC Textiles Private Limited · Handloom Silk House · Made in Belagavi, Karnataka
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#C9A45C]" />
                Silk Mark certified
              </span>
              <Link to="/madt/privacy" className="hover:text-[#F3DC9B] transition-colors">
                Privacy
              </Link>
              <Link to="/madt/terms" className="hover:text-[#F3DC9B] transition-colors">
                Terms
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
