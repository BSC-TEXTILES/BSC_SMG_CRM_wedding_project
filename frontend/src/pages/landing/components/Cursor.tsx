import { useEffect, useRef } from 'react';

interface CursorProps {
  enabled: boolean;
}

/**
 * Desktop cursor: a precise dot plus a trailing ring that swells into a
 * label ("View" / "Explore" / "Drag") over marked elements. Disabled on any
 * touch / coarse pointer device where it would only get in the way.
 */
export default function Cursor({ enabled }: CursorProps) {
  const dot = useRef<HTMLDivElement | null>(null);
  const ring = useRef<HTMLDivElement | null>(null);
  const label = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const fine = window.matchMedia('(pointer: fine)').matches;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine) return;

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let rx = x;
    let ry = y;
    let raf = 0;
    let visible = false;

    const paint = () => {
      rx += (x - rx) * 0.16;
      ry += (y - ry) * 0.16;
      if (dot.current) dot.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      if (ring.current) ring.current.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      raf = requestAnimationFrame(paint);
    };
    raf = requestAnimationFrame(paint);

    const show = () => {
      if (visible) return;
      visible = true;
      dot.current?.classList.add('is-on');
      ring.current?.classList.add('is-on');
    };

    const onMove = (e: MouseEvent) => {
      x = e.clientX;
      y = e.clientY;
      show();

      const target = e.target as HTMLElement | null;
      if (!target || !target.closest) return;

      const tagged = target.closest('[data-cursor]') as HTMLElement | null;
      const interactive = target.closest('a, button, [role="button"]') as HTMLElement | null;

      if (tagged) {
        const kind = tagged.dataset.cursor || 'view';
        if (label.current) label.current.textContent = kind;
        ring.current?.classList.add('is-label');
        ring.current?.classList.remove('is-link');
      } else if (interactive) {
        ring.current?.classList.add('is-link');
        ring.current?.classList.remove('is-label');
      } else {
        ring.current?.classList.remove('is-label', 'is-link');
      }
    };

    const onLeave = () => {
      visible = false;
      dot.current?.classList.remove('is-on');
      ring.current?.classList.remove('is-on');
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseleave', onLeave);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <div ref={dot} className="cursor" aria-hidden="true" data-cursor-dot />
      <div ref={ring} className="cursor-ring" aria-hidden="true">
        <span ref={label}>View</span>
      </div>
    </>
  );
}
