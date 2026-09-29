import React from 'react';
import { Link } from 'react-router-dom';
import { Crown, Sparkles, CheckCircle, ArrowRight, ShieldCheck, HeartHandshake } from 'lucide-react';
import { LANDING_DATA } from '../landingData';
import { LazyImage } from '../../../components/ui/LazyImage';

export default function WeddingSuiteSection() {
  const { weddingExperience } = LANDING_DATA;

  return (
    <section id="wedding" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-t border-[#E8DFC8]/60 bg-[#FAF7F2]">
      <div className="max-w-7xl mx-auto">
        
        {/* Full-width Luxury Card */}
        <div className="relative rounded-[32px] sm:rounded-[40px] overflow-hidden bg-[#1C1510] text-[#FAF7F2] p-8 sm:p-14 lg:p-20 shadow-2xl border-2 border-[#32231A]">
          
          {/* Subtle Background Pattern / Image */}
          <div
            className="absolute inset-0 opacity-20 bg-cover bg-center pointer-events-none mix-blend-luminosity"
            style={{ backgroundImage: `url('/images/wedding.webp')` }}
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#1C1510] via-[#1C1510]/95 to-[#1C1510]/70 pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
            
            {/* Left Content Column */}
            <div className="lg:col-span-7 space-y-6">
              
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[#E8C7A8] text-[10px] sm:text-xs font-bold tracking-[0.16em] uppercase">
                <Crown className="w-3.5 h-3.5 text-[#E8C7A8]" />
                {weddingExperience.kicker}
              </div>

              <h2 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-medium leading-[1.08] tracking-tight">
                {weddingExperience.title}
              </h2>

              <p className="text-sm sm:text-base text-[#D4C3B5] leading-relaxed max-w-xl font-light">
                {weddingExperience.subtitle}
              </p>

              {/* 4 Wedding Pillars */}
              <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {weddingExperience.features.map((feat, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm space-y-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#B76E79]" />
                      <h4 className="font-serif text-sm font-bold text-[#FAF7F2]">
                        {feat.title}
                      </h4>
                    </div>
                    <p className="text-xs text-[#B5A599] leading-relaxed">
                      {feat.desc}
                    </p>
                  </div>
                ))}
              </div>

              {/* Primary Wedding Registration CTA */}
              <div className="pt-4 flex flex-col sm:flex-row items-center gap-4">
                <Link
                  to={weddingExperience.cta.href}
                  className="w-full sm:w-auto px-8 py-4 rounded-full bg-[#B76E79] hover:bg-[#A85F6A] text-white text-xs sm:text-sm font-bold tracking-wider uppercase shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center gap-2.5"
                >
                  <span>{weddingExperience.cta.label}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                
                <span className="text-xs text-[#A69385] tracking-wide">
                  Zero waiting · Reserved family suites
                </span>
              </div>
            </div>

            {/* Right Column: Visual Frame */}
            <div className="lg:col-span-5 relative">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border-2 border-[#E8DFC8]/30">
                <LazyImage
                  src="/images/coll-bridal-1200.webp"
                  alt="Bridal Silk Consultation"
                  width={500}
                  height={420}
                  className="w-full h-[360px] sm:h-[420px] object-cover"
                />
                
                {/* Floating Glass Consultation Card */}
                <div className="absolute bottom-6 left-6 right-6 p-4 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/20 text-white shadow-xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#E8C7A8] tracking-widest">
                    Exclusive Hospitality
                  </span>
                  <p className="font-serif text-sm font-bold">
                    Private Bridal Suite 01
                  </p>
                  <p className="text-[11px] text-[#D4C3B5]">
                    Personalized stylist, family seating & pure zari inspection.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
