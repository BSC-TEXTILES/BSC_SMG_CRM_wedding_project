import { useEffect, useRef, useState } from 'react';

/* ────────────────────────────────────────────────────────────────────────────
   Motion layer — a deliberately small, dependency-free scroll engine.
   Every subscriber is driven from one shared requestAnimationFrame loop, and
   every write is a transform / custom-property so the compositor does the work.
   ──────────────────────────────────────────────────────────────────────────── */

type Subscriber = () => void;

const subscribers = new Set<Subscriber>();
let frame = 0;

function pump() {
  frame = 0;
  subscribers.forEach((fn) => {
    try {
      fn();
    } catch {
      /* a broken subscriber must never stop the loop */
    }
  });
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(pump);
}

function subscribe(fn: Subscriber) {
  subscribers.add(fn);
  schedule();
  return () => {
    subscribers.delete(fn);
  };
}

if (typeof window !== 'undefined') {
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
}

export const clamp = (v: number, min = 0, max = 1) => (v < min ? min : v > max ? max : v);

export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const on = () => setMatches(mql.matches);
    on();
    mql.addEventListener('change', on);
    return () => mql.removeEventListener('change', on);
  }, [query]);
  return matches;
}

/** Reveals once, when the element enters the viewport. */
export function useReveal<T extends HTMLElement>(threshold = 0.14) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-in');
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        });
      },
      { threshold, rootMargin: '0px 0px -8% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return ref;
}

/**
 * Writes `--p` (0 → 1 progress of the element travelling through the
 * viewport) on every frame it is on screen. Used to drive scale / clip / fade
 * compositions without any layout reads after the first pass.
 */
export function useScrollProgress<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  onProgress?: (p: number) => void
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let last = -1;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const span = rect.height + vh;
      const p = clamp((vh - rect.top) / span);
      if (Math.abs(p - last) < 0.0015) return;
      last = p;
      el.style.setProperty('--p', p.toFixed(4));
      onProgress?.(p);
    };
    update();
    return subscribe(update);
  }, [ref, onProgress]);
}

/** Hero-style progress measured from the top of the element to the top of the viewport. */
export function useExitProgress<T extends HTMLElement>(ref: React.RefObject<T | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let last = -1;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const span = Math.max(rect.height * 0.85, 1);
      const p = clamp(-rect.top / span);
      if (Math.abs(p - last) < 0.0015) return;
      last = p;
      el.style.setProperty('--p', p.toFixed(4));
    };
    update();
    return subscribe(update);
  }, [ref]);
}

/** Subtle vertical drift for imagery — writes `--py` in pixels. */
export function useParallax<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  distance = 60
) {
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    let last = NaN;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      if (rect.bottom < -200 || rect.top > vh + 200) return;
      const p = clamp((vh - rect.top) / (vh + rect.height));
      const v = (p - 0.5) * -2 * distance;
      if (Math.abs(v - last) < 0.4) return;
      last = v;
      el.style.setProperty('--py', `${v.toFixed(2)}px`);
    };
    update();
    return subscribe(update);
  }, [ref, distance]);
}

export function useDocumentScroll(onState: (state: { y: number; progress: number }) => void) {
  const cb = useRef(onState);
  cb.current = onState;
  useEffect(() => {
    let lastY = -1;
    const update = () => {
      const y = window.scrollY || 0;
      const doc = document.documentElement.scrollHeight - window.innerHeight;
      const progress = doc > 0 ? clamp(y / doc) : 0;
      if (Math.abs(y - lastY) < 1) return;
      lastY = y;
      cb.current({ y, progress });
    };
    update();
    return subscribe(update);
  }, []);
}

/** Count-up for metrics — plays once when visible. */
export function useCountUp(value: number) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || value <= 0) {
      setShown(value);
      return;
    }
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      setShown(value);
      return;
    }
    let raf = 0;
    let played = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || played) return;
        played = true;
        io.disconnect();
        const start = performance.now();
        const step = (now: number) => {
          const p = clamp((now - start) / 1200);
          setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
          if (p < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    const settle = window.setTimeout(() => setShown(value), 2200);
    return () => {
      io.disconnect();
      window.clearTimeout(settle);
      cancelAnimationFrame(raf);
    };
  }, [value]);
  return { ref, shown };
}

/** Which section id currently owns the viewport (drives nav state). */
export function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0] ?? '');
  const key = ids.join(',');
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const list = key.split(',').filter(Boolean);
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: '-30% 0px -55% 0px', threshold: 0 }
    );
    list.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [key]);
  return active;
}
