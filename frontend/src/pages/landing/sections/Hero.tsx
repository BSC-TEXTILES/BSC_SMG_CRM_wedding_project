import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, Crown, ShieldCheck, Store } from 'lucide-react';
import { YEARS_AT_THE_COUNTER } from '../content';
import { scrollToId } from '../motion/smoothScroll';
import { useExitProgress, useParallax } from '../motion/hooks';
import { Words } from '../motion/Reveal';

interface HeroProps {
  ready: boolean;
  proofLine: string;
  familiesLine: string | null;
}

export default function Hero({ ready, proofLine, familiesLine }: HeroProps) {
  const root = useRef<HTMLElement | null>(null);
  const img = useRef<HTMLImageElement | null>(null);
  useExitProgress(root);
  useParallax(img, 46);

  return (
    <section
      ref={root}
      className={`hero${ready ? ' is-ready' : ''}`}
      id="top"
      aria-label="BSC Textiles"
    >
      <div className="hero__frame">
        <img
          ref={img}
          className="hero__img"
          src="/images/floor.webp"
          srcSet="/images/floor-sm.webp 900w, /images/floor.webp 1800w"
          sizes="100vw"
          width={1800}
          height={1201}
          alt="The BSC Textiles flagship showroom floor in Belagavi, silk counters under chandeliers"
          // React 18 does not recognise camelCase fetchPriority and drops it, so the
          // lowercase DOM attribute is spread to keep the LCP hint on the element.
          {...{ fetchpriority: 'high' }}
          loading="eager"
          decoding="async"
        />
      </div>
      <div className="hero__veil" aria-hidden="true" />
      <div className="hero__grain" aria-hidden="true" />

      <div className="wrap hero__inner">
        <span className="hero__eyebrow-badge anim" style={{ ['--d']: '220ms' } as React.CSSProperties}>
          <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
          Silk Mark certified · Belagavi · Davanagere · Shivamogga
        </span>

        <Words
          as="h1"
          className="hero__title"
          delay={420}
          stagger={58}
          lines={[{ text: 'The cloth is still sold' }, { text: 'on the counter.', accent: true }]}
        />

        <p className="hero__lede anim" style={{ ['--d']: '820ms' } as React.CSSProperties}>
          Menswear, womenswear, suits, jewellery, towels and home linen under one roof. Wedding
          shopping is a booked hour, so a family list is never rushed between other customers —
          and every saree leaves with its Silk Mark tag and weaver guild certificate.
        </p>

        <div className="hero__cta anim" style={{ ['--d']: '960ms' } as React.CSSProperties}>
          <Link to="/wedding-registration" className="btn btn--gold" data-cursor="explore">
            <span>Reserve a wedding hour</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
          <button
            type="button"
            className="btn btn--onink"
            onClick={() => scrollToId('counters')}
            data-cursor="explore"
          >
            <span>Walk the floors</span>
            <ChevronDown className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="hero__proof anim" style={{ ['--d']: '1100ms' } as React.CSSProperties}>
          <span>
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            {proofLine}
          </span>
          <span>
            <Store className="w-4 h-4" aria-hidden="true" />
            Three flagship floors · 10:30 AM – 8:30 PM
          </span>
          <span>
            <Crown className="w-4 h-4" aria-hidden="true" />
            {familiesLine || `${YEARS_AT_THE_COUNTER} years, four generations`}
          </span>
        </div>
      </div>

      <aside className="hero__card" style={{ ['--d']: '1420ms' } as React.CSSProperties} aria-hidden="true">
        <img
          src="/images/women-real.webp"
          width={600}
          height={400}
          alt=""
          loading="lazy"
          decoding="async"
        />
        <strong>Pure mulberry Kanjeevaram</strong>
        <p>Korvai gold zari border, tested at the counter before it is folded.</p>
      </aside>

      <div className="hero__scroll" aria-hidden="true">
        <i />
        Scroll
      </div>
    </section>
  );
}
