import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ChevronDown,
  Sparkles,
  ShieldCheck,
  Store,
  Crown,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { LANDING_DATA, FloatingCardData } from '../landingData';
import { selectShowroomCity } from './StoreLocationsSection';

interface CinematicHeroProps {
  onScrollTo?: (id: string) => void;
  scrollY?: number;
}

export default function CinematicHero({ onScrollTo, scrollY = 0 }: CinematicHeroProps) {
  const cards = LANDING_DATA.floatingCards;
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Mouse Parallax for subtle 3D tilt
  const [mouseTilt, setMouseTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (window.innerWidth < 768) return;
      const x = (e.clientX / window.innerWidth - 0.5) * 8; // -4deg to +4deg
      const y = (e.clientY / window.innerHeight - 0.5) * -8;
      setMouseTilt({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Auto-advance the floating glass cards every 5.2 seconds
  useEffect(() => {
    if (isPaused) return;

    timerRef.current = window.setInterval(() => {
      handleNextCard();
    }, 5200);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentCardIndex, isPaused]);

  const handleNextCard = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentCardIndex((prev) => (prev + 1) % cards.length);
      setIsTransitioning(false);
    }, 280);
  };

  const handlePrevCard = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentCardIndex((prev) => (prev - 1 + cards.length) % cards.length);
      setIsTransitioning(false);
    }, 280);
  };

  const handleSelectCard = (index: number) => {
    if (index === currentCardIndex) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentCardIndex(index);
      setIsTransitioning(false);
    }, 280);
  };

  const currentCard: FloatingCardData = cards[currentCardIndex];

  // 3D Scroll transformations:
  // As scrollY increases (0 to 600px):
  // 1. Logo decreases in scale from 1 to 0.75
  // 2. Hero text moves slightly upward
  // 3. Hero content opacity gently recedes
  const scrollClamped = Math.min(Math.max(scrollY, 0), 600);
  const progress = scrollClamped / 600;

  const logoScale = 1 - progress * 0.28;
  const contentTranslateY = -progress * 70;
  const contentOpacity = 1 - progress * 0.45;
  const bgScale = 1 + progress * 0.12;

  return (
    <section
      id="hero"
      className="relative min-h-[94vh] flex flex-col items-center justify-between text-center px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-12 overflow-hidden select-none [perspective:1200px]"
    >
      {/* Subtle Atmospheric Vignette Gradients (No photo images) */}
      <div
        className="absolute inset-0 pointer-events-none bg-gradient-to-b from-[#FAF7F2]/60 via-transparent to-[#FAF7F2]/95"
        aria-hidden="true"
      />

      {/* ============================================================== */}
      {/* CENTERED HERO CONTENT (3D Depth Linked)                        */}
      {/* ============================================================== */}
      <div
        className="relative z-10 max-w-4xl mx-auto flex flex-col items-center mt-2 sm:mt-4 transition-transform duration-300 ease-out"
        style={{
          transform: `translate3d(${mouseTilt.x}px, ${contentTranslateY + mouseTilt.y}px, 0) rotateX(${mouseTilt.y * 0.5}deg) rotateY(${mouseTilt.x * 0.5}deg)`,
          opacity: contentOpacity
        }}
      >
        {/* Official BSC Textiles Master Logo with 3D Scroll Scaling */}
        <div
          className="mb-4 sm:mb-6 transition-transform duration-300 ease-out"
          style={{ transform: `scale(${logoScale})` }}
        >
          <div className="relative group">
            <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-white/70 backdrop-blur-md border border-[#E4D8C4] p-2.5 shadow-lg flex items-center justify-center transition-transform duration-500 group-hover:scale-105">
              <img
                src="/Main_logo_web.png"
                alt="BSC Textiles"
                width={112}
                height={112}
                fetchPriority="high"
                decoding="async"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="absolute -inset-2 rounded-full bg-[#E8C7A8]/20 blur-md pointer-events-none -z-10" />
          </div>
        </div>

        {/* 1. Small Capsule / Badge Above Heading */}
        <div className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-1.5 rounded-full bg-white/70 backdrop-blur-md border border-[#E4D8C4] shadow-sm mb-5 transition-transform duration-300 hover:scale-105">
          <span className="w-1.5 h-1.5 rounded-full bg-[#B76E79] animate-pulse" />
          <span className="text-[10px] sm:text-xs font-bold tracking-[0.18em] uppercase text-[#4A173A]">
            {LANDING_DATA.hero.badge}
          </span>
        </div>

        {/* 2. Primary Brand Heading: BSC Textiles */}
        <h1 className="font-serif text-4xl sm:text-6xl md:text-7xl lg:text-[88px] leading-[1.04] tracking-[-0.02em] font-medium text-[#1A120C]">
          <span>{LANDING_DATA.hero.title}</span>
        </h1>

        {/* 3. Luxury Editorial Subtitle */}
        <p className="font-serif italic text-lg sm:text-2xl md:text-3xl text-[#B76E79] mt-2 font-normal tracking-wide">
          {LANDING_DATA.hero.subtitle}
        </p>

        {/* 4. Supporting Text */}
        <p className="mt-4 sm:mt-5 max-w-xl mx-auto text-xs sm:text-sm md:text-base leading-relaxed text-[#5F4E44] font-normal tracking-wide">
          {LANDING_DATA.hero.supportingText}
        </p>

        {/* 5. Action Buttons (Primary Dark Pill + Secondary Light Pill) */}
        <div className="mt-7 sm:mt-8 flex flex-col sm:flex-row items-center gap-3.5 sm:gap-4 w-full sm:w-auto">
          {/* Primary CTA */}
          <Link
            to={LANDING_DATA.hero.primaryCta.href}
            className="w-full sm:w-auto px-7 py-3.5 rounded-full bg-[#1C1510] hover:bg-[#32231A] text-[#FAF7F2] text-xs sm:text-sm font-semibold tracking-wider uppercase shadow-lg shadow-black/10 transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center gap-2.5"
          >
            <span>{LANDING_DATA.hero.primaryCta.label}</span>
            <ArrowRight className="w-4 h-4 text-[#E8C7A8]" />
          </Link>

          {/* Secondary CTA */}
          <button
            type="button"
            onClick={() => {
              if (onScrollTo) {
                onScrollTo(LANDING_DATA.hero.secondaryCta.targetId);
              } else {
                document
                  .getElementById(LANDING_DATA.hero.secondaryCta.targetId)
                  ?.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="w-full sm:w-auto px-6 py-3.5 rounded-full bg-white/60 hover:bg-white/90 backdrop-blur-md border border-[#E0D4C3] text-[#2B1B12] text-xs sm:text-sm font-semibold tracking-wider uppercase shadow-sm transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{LANDING_DATA.hero.secondaryCta.label}</span>
            <ChevronDown className="w-4 h-4 text-[#8B776A]" />
          </button>
        </div>

        {/* Subtle Proof Strip */}
        <div className="mt-5 sm:mt-6 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-[11px] font-medium text-[#7C6A5E]">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#B76E79]" />
            100% Pure Silk (Silk Mark)
          </span>
          <span className="hidden sm:inline-block opacity-40">•</span>
          <button
            type="button"
            onClick={() => {
              if (onScrollTo) {
                onScrollTo('stores');
              } else {
                document.getElementById('stores')?.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="flex items-center gap-1.5 hover:text-[#1C1510] transition-colors cursor-pointer font-semibold"
          >
            <Store className="w-3.5 h-3.5 text-[#B76E79]" />
            Davanagere · Belagavi · Shivamogga
          </button>
          <span className="hidden sm:inline-block opacity-40">•</span>
          <span className="flex items-center gap-1.5">
            <Crown className="w-3.5 h-3.5 text-[#B76E79]" />
            Private Family Suites
          </span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 5B. EDITORIAL BRIDAL SHOWCASE (Royal Bride Masterpiece)        */}
      {/* ============================================================== */}
      <div
        className="relative z-15 w-full max-w-5xl mx-auto mt-8 sm:mt-12 transition-transform duration-500 ease-out [transform-style:preserve-3d]"
        style={{
          transform: `translate3d(${mouseTilt.x * -0.7}px, ${mouseTilt.y * -0.7}px, 15px) rotateX(${mouseTilt.y * -0.2}deg) rotateY(${mouseTilt.x * -0.2}deg)`
        }}
      >
        <div className="relative rounded-[28px] sm:rounded-[36px] overflow-hidden shadow-[0_30px_90px_rgba(28,21,16,0.25)] border-2 border-[#E8DFC8]/80 bg-[#120B07] group">
          <img
            src="/images/hero_royal_bride.jpg"
            alt="BSC Textiles — Carrying her blessings and light forward"
            width={1024}
            height={601}
            fetchPriority="high"
            decoding="async"
            className="w-full h-auto max-h-[580px] object-cover sm:object-contain transition-transform duration-700 ease-out group-hover:scale-[1.02]"
          />
          {/* Subtle soft vignette overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10 pointer-events-none" />
        </div>
      </div>

      {/* ============================================================== */}
      {/* 6. FLOATING GLASS CARD (3D Depth Linked)                       */}
      {/* ============================================================== */}
      <div
        className="relative z-20 w-full max-w-xl mx-auto mt-8 sm:mt-10 transition-transform duration-300 ease-out"
        style={{
          transform: `translate3d(${mouseTilt.x * -0.6}px, ${mouseTilt.y * -0.6}px, 20px) rotateX(${mouseTilt.y * -0.3}deg) rotateY(${mouseTilt.x * -0.3}deg)`
        }}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div
          className={`relative overflow-hidden rounded-3xl bg-white/75 backdrop-blur-2xl border border-white/60 p-5 sm:p-6 shadow-[0_25px_60px_rgba(28,21,16,0.15)] transition-all duration-500 transform ${
            isTransitioning ? 'opacity-0 scale-[0.98] blur-[2px]' : 'opacity-100 scale-100 blur-0'
          }`}
        >
          {/* Card Top Pill & Controls */}
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1C1510] text-[#E8C7A8] text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.14em]">
              <Sparkles className="w-3 h-3 text-[#E8C7A8]" />
              {currentCard.tag}
            </span>

            {/* Prev / Next Minimal Arrows */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePrevCard}
                className="w-7 h-7 rounded-full bg-[#FAF7F2] hover:bg-white text-[#4A173A] border border-[#E8DFC8] flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Previous Highlight"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleNextCard}
                className="w-7 h-7 rounded-full bg-[#FAF7F2] hover:bg-white text-[#4A173A] border border-[#E8DFC8] flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Next Highlight"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card Body */}
          <div className="text-left space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-serif text-lg sm:text-xl font-bold text-[#1C1510]">
                {currentCard.title}
              </h3>
              {currentCard.stat && (
                <span className="text-xs font-bold text-[#B76E79] tracking-wider uppercase font-mono">
                  {currentCard.stat}
                </span>
              )}
            </div>

            <p className="text-xs font-semibold text-[#8B5A72] tracking-wide">
              {currentCard.subtitle}
            </p>

            <p className="text-xs sm:text-[13px] leading-relaxed text-[#5F4E44] pt-1">
              {currentCard.description}
            </p>

            {/* Quick Showroom Buttons for Davanagere, Belagavi, Shivamogga */}
            {currentCard.id === 2 && (
              <div className="pt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => selectShowroomCity('davanagere')}
                  className="px-3 py-1.5 rounded-full bg-[#1C1510] text-[#FAF7F2] text-[11px] font-bold uppercase tracking-wider hover:bg-[#32231A] transition-all cursor-pointer shadow-sm"
                >
                  Davanagere
                </button>
                <button
                  type="button"
                  onClick={() => selectShowroomCity('belagavi')}
                  className="px-3 py-1.5 rounded-full bg-[#1C1510] text-[#FAF7F2] text-[11px] font-bold uppercase tracking-wider hover:bg-[#32231A] transition-all cursor-pointer shadow-sm"
                >
                  Belagavi
                </button>
                <button
                  type="button"
                  onClick={() => selectShowroomCity('shivamogga')}
                  className="px-3 py-1.5 rounded-full bg-[#1C1510] text-[#FAF7F2] text-[11px] font-bold uppercase tracking-wider hover:bg-[#32231A] transition-all cursor-pointer shadow-sm"
                >
                  Shivamogga
                </button>
              </div>
            )}

            <div className="pt-2 flex items-center justify-between text-[11px] font-semibold text-[#4A173A] border-t border-[#E8DFC8]/60 mt-3">
              <span className="flex items-center gap-1 text-[#B76E79]">
                ✓ {currentCard.highlight}
              </span>
              <span className="text-[10px] text-[#A69385] tracking-widest uppercase">
                {currentCardIndex + 1} of {cards.length}
              </span>
            </div>
          </div>

          {/* Interactive Dots / Timeline Indicators */}
          <div className="flex items-center justify-center gap-1.5 mt-4 pt-2">
            {cards.map((card, idx) => (
              <button
                key={card.id}
                type="button"
                onClick={() => handleSelectCard(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  idx === currentCardIndex
                    ? 'w-7 bg-[#1C1510]'
                    : 'w-1.5 bg-[#D9CBBC] hover:bg-[#A69385]'
                }`}
                aria-label={`View card ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
