import React, { useCallback, useEffect, useState } from 'react';
import LandingNav from './editorial/LandingNav';
import {
  LandingCollections,
  LandingFooter,
  LandingHero,
  LandingHeritage,
  LandingStores,
  LandingWedding
} from './editorial/LandingSections';
import { prefersReducedMotion } from './editorial/useReveal';
import './editorial/editorial.css';

/**
 * Public landing page — an image-free editorial composition.
 *
 * Deliberately loads no photography, no WebGL canvas and no third-party smooth
 * scroll library: the document itself is the only scroll container, so there is
 * exactly one scrollbar and no image requests at all.
 */

const SECTION_IDS = ['hero', 'collections', 'wedding', 'stores', 'about', 'contact'];

export default function LandingPage() {
  const [activeSection, setActiveSection] = useState('hero');

  /* ── Document metadata ─────────────────────────────────────────────────── */
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'BSC Textiles — Pure Silk Sarees, Bespoke Menswear & Wedding Shopping';

    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = meta?.getAttribute('content') ?? null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }
    meta.setAttribute(
      'content',
      'BSC Textiles — Karnataka’s heritage house for pure silk sarees, bespoke menswear, bridal trousseaus and curated luxury textiles across Belagavi, Davanagere and Shivamogga.'
    );

    return () => {
      document.title = previousTitle;
      if (meta && previousDescription !== null) meta.setAttribute('content', previousDescription);
    };
  }, []);

  /* ── Active section for the navigation underline ───────────────────────── */
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
    );

    SECTION_IDS.forEach((id) => {
      const node = document.getElementById(id);
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, []);

  /* ── In-page navigation ────────────────────────────────────────────────── */
  const handleNavigate = useCallback((id: string) => {
    const node = document.getElementById(id);
    if (!node) return;
    node.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'start'
    });
    setActiveSection(id);
  }, []);

  return (
    <div className="bsc-ed-page">
      <a href="#main-content" className="bsc-ed-skip">Skip to main content</a>

      <LandingNav activeSection={activeSection} onNavigate={handleNavigate} />

      <main id="main-content">
        <LandingHero onNavigate={handleNavigate} />
        <LandingCollections onNavigate={handleNavigate} />
        <LandingHeritage />
        <LandingWedding />
        <LandingStores />
      </main>

      <LandingFooter onNavigate={handleNavigate} />
    </div>
  );
}
