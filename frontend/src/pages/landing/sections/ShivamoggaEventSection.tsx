import React from 'react';
import { LANDING_DATA } from '../landingData';
import { Sparkles, MapPin, Calendar, Check, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ShivamoggaEventSection() {
  const { shivamoggaEvent } = LANDING_DATA;

  const handleDirections = () => {
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shivamoggaEvent.cta.mapsQuery)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  return (
    <section id="shivamogga-event" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-t border-[#E8DFC8]/60 bg-[#F5EFE6]/70">
      <div className="max-w-7xl mx-auto">
        
        {/* Cinematic Announcement Frame */}
        <div className="relative rounded-[32px] sm:rounded-[44px] overflow-hidden bg-[#1A120C] text-[#FAF7F2] p-8 sm:p-14 lg:p-20 shadow-2xl border-2 border-[#38271C]">
          
          {/* Background Image Texture */}
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-luminosity scale-105 transition-transform duration-1000"
            style={{ backgroundImage: `url('/images/suit.webp')` }}
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1A120C] via-[#1A120C]/80 to-transparent" />

          <div className="relative z-10 max-w-3xl space-y-6">
            
            {/* Pill */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#E8C7A8]/15 border border-[#E8C7A8]/30 text-[#E8C7A8] text-[10px] sm:text-xs font-bold uppercase tracking-[0.18em]">
              <Sparkles className="w-3.5 h-3.5 text-[#E8C7A8]" />
              {shivamoggaEvent.kicker}
            </div>

            <h2 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-medium leading-[1.06] tracking-tight">
              {shivamoggaEvent.title}
            </h2>

            <p className="text-sm sm:text-base text-[#D4C3B5] leading-relaxed font-light">
              {shivamoggaEvent.description}
            </p>

            {/* Glass Information Panel */}
            <div className="p-6 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl space-y-4 my-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-[#E8C7A8] shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#A69385]">
                      Inaugural Season
                    </span>
                    <p className="font-serif text-sm font-bold text-white">
                      {shivamoggaEvent.date}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-[#E8C7A8] shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#A69385]">
                      Location
                    </span>
                    <p className="text-xs text-[#D4C3B5] leading-relaxed">
                      {shivamoggaEvent.venue}
                    </p>
                  </div>
                </div>
              </div>

              {/* Highlights Checkmarks */}
              <div className="pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {shivamoggaEvent.highlights.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-[#E8DFC8]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#B76E79]" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
              <button
                type="button"
                onClick={handleDirections}
                className="w-full sm:w-auto px-7 py-3.5 rounded-full bg-[#FAF7F2] hover:bg-white text-[#1C1510] text-xs font-bold uppercase tracking-wider shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
              >
                <span>{shivamoggaEvent.cta.label}</span>
                <ArrowRight className="w-4 h-4 text-[#B76E79]" />
              </button>

              <Link
                to="/wedding/customer-registration"
                className="w-full sm:w-auto px-6 py-3.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-[#FAF7F2] text-xs font-bold uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2"
              >
                <span>Register for Wedding Visit</span>
              </Link>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
