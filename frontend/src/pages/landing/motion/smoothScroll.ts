let lenis: {
  scrollTo: (t: unknown, o?: Record<string, unknown>) => void;
  stop: () => void;
  start: () => void;
  destroy: () => void;
} | null = null;

let locks = 0;

export function setLenis(instance: typeof lenis) {
  lenis = instance;
}

export function getLenis() {
  return lenis;
}

/** Reference-counted scroll lock — works for both native scroll and Lenis. */
export function lockScroll(on: boolean) {
  locks = Math.max(0, locks + (on ? 1 : -1));
  const locked = locks > 0;
  if (lenis) {
    if (locked) lenis.stop();
    else lenis.start();
  }
  document.documentElement.style.overflow = locked ? 'hidden' : '';
}

/** Shared, animation-aware section scrolling used by nav, footer and CTAs. */
export function scrollToId(id: string, offset = -96) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (lenis && !reduced) {
    lenis.scrollTo(el, { offset, duration: 1.25 });
    return;
  }
  const top = el.getBoundingClientRect().top + window.scrollY + offset;
  window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
}
