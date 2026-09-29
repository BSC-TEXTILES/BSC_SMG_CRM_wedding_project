import React from 'react';
import { LANDING_DATA } from '../landingData';
import { ShieldCheck, Calendar, Clock, MapPin } from 'lucide-react';
import { LazyImage } from '../../../components/ui/LazyImage';

export default function LegacySection() {
  const { legacy } = LANDING_DATA;
  const timelineItems = legacy.timeline || (legacy as any).milestones || [];

  return (
    <section
      id="legacy"
      className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-t border-[#E8DFC8]/60 bg-[#FAF7F2] select-none [perspective:1200px]"
    >
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

        {/* Narrative & Real Floor Imagery Grid with 3D Depth */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          
          {/* Left Column: Authentic Photography with 3D Perspective */}
          <div className="lg:col-span-6 relative [transform-style:preserve-3d] transition-transform duration-500 hover:[transform:rotateY(-3deg)_rotateX(2deg)]">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border-2 border-[#E8DFC8]">
              <LazyImage
                src="/images/floor.webp"
                alt="BSC Textiles showroom floor"
                width={600}
                height={480}
                className="w-full h-[380px] sm:h-[480px] object-cover hover:scale-105 transition-transform duration-700 ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
              
              {/* Floating Glass Stamp with Z-Index Depth */}
              <div className="absolute bottom-6 left-6 right-6 p-4 sm:p-5 rounded-2xl bg-white/85 backdrop-blur-xl border border-white/60 shadow-xl flex items-center justify-between [transform:translateZ(24px)]">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-[#8B5A72]">
                    Silk Mark Certified
                  </p>
                  <p className="font-serif text-sm sm:text-base font-bold text-[#1C1510]">
                    Authentic Handlooms Since 1938
                  </p>
                  <p className="text-[11px] text-[#5F4E44] mt-0.5">
                    Tested at the counter before elders and family
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-[#1C1510] text-[#E8C7A8] flex items-center justify-center font-serif text-xs sm:text-sm font-bold shadow-md shrink-0 ml-3">
                  86y
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Historical Narrative & 3D Timeline */}
          <div className="lg:col-span-6 space-y-6">
            <div className="space-y-4 text-xs sm:text-sm md:text-base leading-relaxed text-[#5F4E44]">
              {legacy.bodyParagraphs.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>

            {/* 3D Timeline Visual Step Flow */}
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {timelineItems.map((m: any, idx: number) => (
                <div
                  key={idx}
                  className="p-4 sm:p-5 rounded-2xl bg-white/80 backdrop-blur-sm border border-[#E8DFC8] shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-[#B76E79]/50"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-bold text-[#B76E79]">
                      {m.year}
                    </span>
                    {m.city && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B5A72] flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#B76E79]" />
                        {m.city}
                      </span>
                    )}
                  </div>
                  <h4 className="font-serif text-sm font-bold text-[#1C1510]">
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
