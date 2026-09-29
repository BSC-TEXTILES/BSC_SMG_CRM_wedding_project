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
  ChevronLeft,
  Calendar,
  Layers,
  MapPin,
  Clock
} from 'lucide-react';
import { LANDING_DATA, FloatingCardData } from '../landingData';

interface CinematicHeroProps {
  onScrollTo?: (id: string) => void;
}

export default function CinematicHero({ onScrollTo }: CinematicHeroProps) {
  const cards = LANDING_DATA.floatingCards;
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<number | null>(null);

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

  return (
    <section
      id="hero"
      className="relative min-h-[90vh] sm:min-h-[94vh] flex flex-col items-center justify-between text-center px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14 pb-12 overflow-hidden select-none"
    >
      {/* Subtle Warm Photographic Overlay Texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-25 mix-blend-multiply bg-cover bg-center transition-transform duration-[12000ms] ease-out hover:scale-105"
        style={{ backgroundImage: `url('/images/hero-bg.webp')` }}
        aria-hidden="true"
      />

      {/* Atmospheric Vignette Gradients */}
      <div
        className="absolute inset-0 pointer-events-none bg-gradient-to-b from-[#FAF7F2]/40 via-transparent to-[#FAF7F2]/90"
        aria-hidden="true"
      />

      {/* ============================================================== */}
      {/* CENTERED HERO CONTENT                                          */}
      {/* ============================================================== */}
      <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center mt-2 sm:mt-6">
        
        {/* 1. Small Capsule / Badge Above Heading */}
        <div className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-1.5 rounded-full bg-white/70 backdrop-blur-md border border-[#E4D8C4] shadow-sm mb-6 sm:mb-8 transition-transform duration-300 hover:scale-105">
          <span className="w-1.5 h-1.5 rounded-full bg-[#B76E79] animate-pulse" />
          <span className="text-[10px] sm:text-xs font-bold tracking-[0.18em] uppercase text-[#4A173A]">
            {LANDING_DATA.hero.badge}
          </span>
        </div>

        {/* 2. Large Editorial Heading */}
        <h1 className="font-serif text-4xl sm:text-6xl md:text-7xl lg:text-[84px] leading-[1.08] sm:leading-[1.04] tracking-[-0.02em] font-medium text-[#1A120C]">
          <span>{LANDING_DATA.hero.headingLine1}</span>
          <br />
          <span className="italic font-normal text-[#B76E79]">
            {LANDING_DATA.hero.headingLine2}
          </span>
        </h1>

        {/* 3. Supporting Text */}
        <p className="mt-5 sm:mt-7 max-w-xl mx-auto text-xs sm:text-sm md:text-base leading-relaxed text-[#5F4E44] font-normal tracking-wide">
          {LANDING_DATA.hero.supportingText}
        </p>

        {/* 4. Action Buttons (Primary Dark Pill + Secondary Light Pill) */}
        <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center gap-3.5 sm:gap-4 w-full sm:w-auto">
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
            className="w-full sm:w-auto px-6 py-3.5 rounded-full bg-white/60 hover:bg-white/90 backdrop-blur-md border border-[#E0D4C3] text-[#2B1B12] text-xs sm:text-sm font-semibold tracking-wider uppercase shadow-sm transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
          >
            <span>{LANDING_DATA.hero.secondaryCta.label}</span>
            <ChevronDown className="w-4 h-4 text-[#8B776A]" />
          </button>
        </div>

        {/* Subtle Proof Strip */}
        <div className="mt-6 sm:mt-8 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-[11px] font-medium text-[#7C6A5E]">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#B76E79]" />
            Silk Mark Certified
          </span>
          <span className="hidden sm:inline-block opacity-40">•</span>
          <span className="flex items-center gap-1.5">
            <Store className="w-3.5 h-3.5 text-[#B76E79]" />
            Three Karnataka Showrooms
          </span>
          <span className="hidden sm:inline-block opacity-40">•</span>
          <span className="flex items-center gap-1.5">
            <Crown className="w-3.5 h-3.5 text-[#B76E79]" />
            Private Family Suites
          </span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 5. FLOATING GLASS CARD (LOWER-CENTER HERO)                    */}
      {/* ============================================================== */}
      <div
        className="relative z-20 w-full max-w-xl mx-auto mt-12 sm:mt-14"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div
          className={`relative overflow-hidden rounded-3xl bg-white/70 backdrop-blur-xl border border-white/60 p-5 sm:p-6 shadow-[0_20px_50px_rgba(28,21,16,0.12)] transition-all duration-500 transform ${
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
                className="w-7 h-7 rounded-full bg-[#FAF7F2] hover:bg-white text-[#4A173A] border border-[#E8DFC8] flex items-center justify-center transition-colors"
                aria-label="Previous Highlight"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleNextCard}
                className="w-7 h-7 rounded-full bg-[#FAF7F2] hover:bg-white text-[#4A173A] border border-[#E8DFC8] flex items-center justify-center transition-colors"
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
                className={`h-1.5 rounded-full transition-all duration-300 ${
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
