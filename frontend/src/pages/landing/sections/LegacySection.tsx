import React from 'react';
import { LANDING_DATA } from '../landingData';
import { Award, Compass, History, ShieldCheck } from 'lucide-react';

export default function LegacySection() {
  const { legacy } = LANDING_DATA;

  return (
    <section id="legacy" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-t border-[#E8DFC8]/60 bg-[#FAF7F2]">
      <div className="max-w-6xl mx-auto">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16 sm:mb-20">
          <span className="text-[10px] sm:text-xs font-bold tracking-[0.2em] uppercase text-[#B76E79]">
            {legacy.kicker}
          </span>
          <h2 className="font-serif text-3xl sm:text-5xl font-medium text-[#1A120C] mt-2.5">
            {legacy.title}
          </h2>
          <p className="text-sm sm:text-base text-[#6F5F53] mt-3 font-normal leading-relaxed">
            {legacy.subtitle}
          </p>
        </div>

        {/* Narrative & Real Floor Imagery Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          
          {/* Left Column: Authentic Photography */}
          <div className="lg:col-span-6 relative">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border-2 border-[#E8DFC8]">
              <img
                src="/images/floor.webp"
                alt="BSC Textiles showroom floor"
                className="w-full h-[380px] sm:h-[460px] object-cover hover:scale-105 transition-transform duration-700 ease-out"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              
              {/* Floating Glass Stamp */}
              <div className="absolute bottom-6 left-6 right-6 p-4 rounded-2xl bg-white/80 backdrop-blur-md border border-white/60 shadow-lg flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-[#8B5A72]">
                    Silk Mark Certified
                  </p>
                  <p className="font-serif text-sm font-bold text-[#1C1510]">
                    Authentic Handlooms Since 1938
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-[#1C1510] text-[#E8C7A8] flex items-center justify-center font-serif text-xs font-bold">
                  86y
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Historical Narrative & Stats */}
          <div className="lg:col-span-6 space-y-6">
            <div className="space-y-4 text-xs sm:text-sm md:text-base leading-relaxed text-[#5F4E44]">
              {legacy.bodyParagraphs.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>

            {/* Milestones Horizontal Flow */}
            <div className="pt-4 grid grid-cols-2 gap-4">
              {legacy.milestones.map((m, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-white/70 border border-[#E8DFC8] shadow-sm hover:shadow-md transition-shadow"
                >
                  <span className="font-mono text-xs font-bold text-[#B76E79]">
                    {m.year}
                  </span>
                  <h4 className="font-serif text-sm font-bold text-[#1C1510] mt-1">
                    {m.title}
                  </h4>
                  <p className="text-[11px] text-[#6F5F53] leading-normal mt-1">
                    {m.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* Key Heritage Metrics */}
            <div className="pt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-[#E8DFC8]">
              {legacy.stats.map((stat, idx) => (
                <div key={idx} className="text-center sm:text-left">
                  <div className="font-serif text-2xl sm:text-3xl font-bold text-[#1C1510]">
                    {stat.value}
                  </div>
                  <div className="text-xs font-bold text-[#4A173A] mt-0.5">
                    {stat.label}
                  </div>
                  <div className="text-[10px] text-[#8B776A] mt-0.5">
                    {stat.sub}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
