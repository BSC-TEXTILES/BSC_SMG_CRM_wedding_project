import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { DEPARTMENTS } from '../content';
import { Eyebrow, Reveal, Words } from '../motion/Reveal';

/**
 * Interactive gallery — a horizontal, snap-scrolling rail of department plates.
 * Desktop users can drag it; everyone else gets native touch momentum.
 */
export default function Counters() {
  const rail = useRef<HTMLDivElement | null>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);
  const drag = useRef({ active: false, startX: 0, startLeft: 0, moved: 0 });

  const sync = useCallback(() => {
    const el = rail.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 8);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    sync();
    const el = rail.current;
    if (!el) return;
    el.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    return () => {
      el.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
    };
  }, [sync]);

  const step = (dir: number) => {
    const el = rail.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('.card');
    const amount = (card ? card.offsetWidth : 320) + 24;
    el.scrollBy({ left: dir * amount, behavior: 'smooth' });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const el = rail.current;
    if (!el || e.pointerType === 'touch') return;
    drag.current = { active: true, startX: e.clientX, startLeft: el.scrollLeft, moved: 0 };
    el.classList.add('is-dragging');
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const el = rail.current;
    if (!el || !drag.current.active) return;
    const dx = e.clientX - drag.current.startX;
    drag.current.moved = Math.abs(dx);
    el.scrollLeft = drag.current.startLeft - dx;
  };

  const endDrag = () => {
    const el = rail.current;
    drag.current.active = false;
    el?.classList.remove('is-dragging');
  };

  return (
    <section id="counters" className="sec sec--paper2">
      <div className="wrap">
        <div className="rail__head">
          <div>
            <Eyebrow>02 — The counters</Eyebrow>
            <Words
              as="h2"
              className="t-h2"
              delay={60}
              stagger={44}
              lines={[{ text: 'Nine counters,' }, { text: 'one building.', accent: true }]}
            />
            <Reveal as="p" variant="up" delay={140} className="t-lede" style={{ marginTop: 20 }}>
              You do not need all of them in one visit. Stock changes with the bale, but every
              department keeps its own master counter and specialist staff.
            </Reveal>
          </div>

          <div className="rail__nav" role="group" aria-label="Gallery controls">
            <button
              type="button"
              className="rail__btn"
              onClick={() => step(-1)}
              disabled={!canPrev}
              aria-label="Previous counter"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="rail__btn"
              onClick={() => step(1)}
              disabled={!canNext}
              aria-label="Next counter"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={rail}
        className="rail"
        data-cursor="drag"
        data-lenis-prevent
        role="region"
        aria-label="Department gallery — scroll horizontally"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onPointerCancel={endDrag}
        onScroll={sync}
      >
        <div style={{ flex: '0 0 var(--gut, 24px)' }} aria-hidden="true" />
        {DEPARTMENTS.map((dept, i) => (
          <Reveal
            as="article"
            key={dept.id}
            className="card"
            variant="up"
            delay={Math.min(i, 4) * 70}
          >
            <div className="card__frame">
              <span className="card__no">{dept.no}</span>
              <img
                src={dept.img}
                srcSet={dept.sm ? `${dept.sm} 700w, ${dept.img} 1400w` : undefined}
                sizes="(max-width: 767px) 72vw, 26vw"
                width={1200}
                height={1600}
                alt={`${dept.kicker} — ${dept.title}`}
                loading="lazy"
                decoding="async"
                draggable={false}
                style={{ objectPosition: dept.pos || 'center' }}
              />
              <span className="card__veil" aria-hidden="true" />
              <span className="card__kicker">{dept.kicker}</span>
            </div>
            <div className="card__body">
              <h3 className="card__title">{dept.title}</h3>
              <p className="card__blurb">{dept.blurb}</p>
              <span className="card__line" aria-hidden="true" />
            </div>
          </Reveal>
        ))}
        <div style={{ flex: '0 0 var(--gut, 24px)' }} aria-hidden="true" />
      </div>
    </section>
  );
}
