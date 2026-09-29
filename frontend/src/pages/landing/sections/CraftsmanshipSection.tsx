import React from 'react';
import { LANDING_DATA } from '../landingData';
import { ShieldCheck, HeartHandshake, Award } from 'lucide-react';

export default function CraftsmanshipSection() {
  const { about } = LANDING_DATA;

  return (
    <section id="about" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-t border-[#E8DFC8]/60 bg-[#FAF7F2]">
      <div className="max-w-6xl mx-auto">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-[10px] sm:text-xs font-bold tracking-[0.2em] uppercase text-[#B76E79]">
            {about.kicker}
          </span>
          <h2 className="font-serif text-3xl sm:text-5xl font-medium text-[#1A120C] mt-2.5">
            {about.title}
          </h2>
          <blockquote className="mt-6 p-6 rounded-3xl bg-white/70 backdrop-blur-md border border-[#E8DFC8] font-serif italic text-base sm:text-lg text-[#4A173A] leading-relaxed shadow-sm">
            {about.quote}
            <footer className="mt-3 text-xs not-italic uppercase tracking-widest text-[#B76E79] font-sans font-bold">
              — {about.author}
            </footer>
          </blockquote>
        </div>

        {/* 3 Pillars of Authenticity */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {about.points.map((pt, idx) => (
            <div
              key={idx}
              className="p-8 rounded-3xl bg-white/80 border border-[#E8DFC8] shadow-md hover:shadow-xl transition-shadow flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FAF7F2] border border-[#E8DFC8] flex items-center justify-center text-[#B76E79]">
                  {idx === 0 && <HeartHandshake className="w-5 h-5" />}
                  {idx === 1 && <ShieldCheck className="w-5 h-5" />}
                  {idx === 2 && <Award className="w-5 h-5" />}
                </div>

                <h3 className="font-serif text-lg font-bold text-[#1C1510]">
                  {pt.title}
                </h3>

                <p className="text-xs sm:text-sm text-[#5F4E44] leading-relaxed">
                  {pt.desc}
                </p>
              </div>

              <div className="pt-4 border-t border-[#E8DFC8]/60 text-[11px] font-bold text-[#8B5A72] uppercase tracking-wider">
                BSC Guarantee
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
