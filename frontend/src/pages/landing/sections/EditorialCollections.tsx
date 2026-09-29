import React, { useState } from 'react';
import { LANDING_DATA, CollectionItem } from '../landingData';
import { ArrowUpRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function EditorialCollections() {
  const { collectionsOverview } = LANDING_DATA;
  const [selectedItem, setSelectedItem] = useState<CollectionItem>(collectionsOverview.items[0]);

  return (
    <section id="collections" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-t border-[#E8DFC8]/60 bg-[#F5EFE6]/60">
      <div className="max-w-7xl mx-auto">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 sm:mb-16">
          <div className="max-w-2xl">
            <span className="text-[10px] sm:text-xs font-bold tracking-[0.2em] uppercase text-[#B76E79]">
              {collectionsOverview.kicker}
            </span>
            <h2 className="font-serif text-3xl sm:text-5xl font-medium text-[#1A120C] mt-2.5">
              {collectionsOverview.title}
            </h2>
            <p className="text-sm sm:text-base text-[#6F5F53] mt-3 font-normal leading-relaxed">
              {collectionsOverview.subtitle}
            </p>
          </div>

          <div className="mt-4 md:mt-0">
            <Link
              to="/wedding/customer-registration"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#1C1510] text-[#FAF7F2] text-xs font-semibold tracking-wider uppercase shadow-md hover:bg-[#32231A] transition-colors"
            >
              <span>Book Floor Appointment</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#E8C7A8]" />
            </Link>
          </div>
        </div>

        {/* Editorial Collection Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {collectionsOverview.items.map((item) => (
            <div
              key={item.id}
              className="group relative rounded-3xl overflow-hidden bg-white/70 backdrop-blur-sm border border-[#E8DFC8] shadow-md hover:shadow-xl transition-all duration-500 flex flex-col"
            >
              {/* Image Container */}
              <div className="relative h-64 sm:h-72 overflow-hidden bg-[#E8DFC8]/30">
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />
                
                {/* Floating Glass Tag */}
                <div className="absolute top-4 left-4">
                  <span className="px-3 py-1 rounded-full bg-white/85 backdrop-blur-md text-[10px] font-bold tracking-wider uppercase text-[#1C1510] shadow-sm">
                    {item.tag}
                  </span>
                </div>

                {/* Index Code */}
                <div className="absolute top-4 right-4">
                  <span className="font-mono text-xs font-bold text-white/90">
                    {item.code}
                  </span>
                </div>

                {/* Floating Bottom Card Over Image */}
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <p className="text-[10px] tracking-wider uppercase text-[#E8C7A8] font-bold">
                    {item.category}
                  </p>
                  <h3 className="font-serif text-lg font-bold leading-tight mt-0.5">
                    {item.title}
                  </h3>
                </div>
              </div>

              {/* Content Description & Highlights */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <p className="text-xs text-[#5F4E44] leading-relaxed">
                  {item.description}
                </p>

                {item.details && item.details.length > 0 && (
                  <div className="pt-2 border-t border-[#E8DFC8]/60 space-y-1.5">
                    {item.details.slice(0, 3).map((detail, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-[11px] text-[#6F5F53]">
                        <CheckCircle2 className="w-3 h-3 text-[#B76E79] shrink-0" />
                        <span className="truncate">{detail}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
