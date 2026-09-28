import React, { useEffect, useRef, useState } from 'react';

const WORDS = ['Handloom silk', 'Kanchipuram', 'Wedding lists', 'Karnataka, 1938'];

interface LoaderProps {
  phase: 'load' | 'out' | 'done';
  onReady: () => void;
}

/**
 * Brand loader — animated mark, live percentage and a hairline progress rule.
 * It hands over to the hero mid-wipe so the reveal reads as one movement.
 */
export default function Loader({ phase, onReady }: LoaderProps) {
  const [pct, setPct] = useState(0);
  const [word, setWord] = useState(0);
  const fired = useRef(false);

  useEffect(() => {
    const finish = () => {
      setPct(100);
      if (!fired.current) {
        fired.current = true;
        onReady();
      }
    };

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // requestAnimationFrame is suspended in a background tab. If the ramp were the
    // only path to onReady, the loader would stay on screen forever in a hidden tab.
    if (reduce || document.hidden) {
      finish();
      return;
    }

    const start = performance.now();
    const duration = 1150;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 2.2);
      setPct(Math.round(eased * 100));
      if (t < 1) {
        raf = requestAnimationFrame(step);
      } else {
        finish();
      }
    };
    raf = requestAnimationFrame(step);

    // Wall-clock deadline so completion never depends on frame scheduling.
    const deadline = window.setTimeout(finish, duration + 320);
    const onHide = () => {
      if (document.hidden) finish();
    };
    document.addEventListener('visibilitychange', onHide);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(deadline);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [onReady]);

  useEffect(() => {
    const id = window.setInterval(() => setWord((w) => (w + 1) % WORDS.length), 430);
    return () => window.clearInterval(id);
  }, []);

  if (phase === 'done') return null;

  return (
    <div
      className={`loader${phase === 'out' ? ' is-out' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={`Loading experience ${pct} percent`}
    >
      <div className="loader__top">
        <span>BSC Textiles</span>
        <span>Est. 1938 · Karnataka</span>
      </div>

      <div className="loader__center">
        <svg className="loader__mark" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
          <rect x="6" y="6" width="88" height="88" fill="none" stroke="#B88D42" strokeWidth="1.5" />
          <path d="M6 34h88M6 66h88M34 6v88M66 6v88" fill="none" stroke="#B88D42" strokeWidth="1" opacity="0.7" />
          <path d="M6 6l88 88M94 6L6 94" fill="none" stroke="#B88D42" strokeWidth="0.75" opacity="0.35" />
          <rect className="fill-cell" x="34" y="34" width="32" height="32" fill="#D3AB63" />
        </svg>
        <p className="loader__word" key={word}>
          {WORDS[word]}
        </p>
      </div>

      <div className="loader__bottom" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20 }}>
          <span className="loader__count">{String(pct).padStart(3, '0')}</span>
          <span style={{ paddingBottom: 10 }}>Preparing the floor</span>
        </div>
        <div className="loader__bar" style={{ ['--load']: pct / 100 } as React.CSSProperties}>
          <span />
        </div>
      </div>
    </div>
  );
}
