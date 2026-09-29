import React, { useState } from 'react';
import { LANDING_DATA, StoreLocationData } from '../landingData';
import { MapPin, Phone, Mail, Clock, Navigation, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function StoreLocationsSection() {
  const { stores } = LANDING_DATA;
  const [activeStoreId, setActiveStoreId] = useState<string>(stores[0].id);

  const handleMapsClick = (query: string) => {
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  return (
    <section
      id="stores"
      className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-t border-[#E8DFC8]/60 bg-[#FAF7F2] select-none [perspective:1200px]"
    >
      <div className="max-w-7xl mx-auto">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <span className="text-[10px] sm:text-xs font-bold tracking-[0.2em] uppercase text-[#B76E79]">
            THREE FLAGSHIP DESTINATIONS
          </span>
          <h2 className="font-serif text-3xl sm:text-5xl font-medium text-[#1A120C] mt-2.5">
            Visit Our Showrooms
          </h2>
          <p className="text-sm sm:text-base text-[#6F5F53] mt-3 font-normal leading-relaxed">
            Experience Karnataka’s foremost textile and wedding floors across Davanagere, Belagavi, and Shivamogga.
          </p>
        </div>

        {/* Store Tabs for Active Focus */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {stores.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveStoreId(s.id)}
              className={`px-5 py-2.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all duration-300 cursor-pointer ${
                activeStoreId === s.id
                  ? 'bg-[#1C1510] text-[#FAF7F2] shadow-md scale-105'
                  : 'bg-white/70 text-[#6F5F53] hover:bg-white hover:text-[#1C1510] border border-[#E8DFC8]'
              }`}
            >
              {s.city.split(' ')[0]}
            </button>
          ))}
        </div>

        {/* 3 Store Cards in 3D Depth Space */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 sm:gap-10 [transform-style:preserve-3d]">
          {stores.map((store) => {
            const isSelected = activeStoreId === store.id;

            return (
              <div
                key={store.id}
                onClick={() => setActiveStoreId(store.id)}
                className={`rounded-3xl overflow-hidden bg-white/85 backdrop-blur-md border transition-all duration-500 flex flex-col justify-between cursor-pointer ${
                  isSelected
                    ? 'border-[#B76E79] shadow-2xl scale-[1.02] [transform:translateZ(20px)] ring-2 ring-[#B76E79]/20'
                    : 'border-[#E8DFC8] shadow-md opacity-90 hover:opacity-100 hover:shadow-xl'
                }`}
              >
                <div>
                  {/* Store Header Image with 3D Depth */}
                  <div className="relative h-56 sm:h-64 overflow-hidden bg-[#E8DFC8]/20">
                    <img
                      src={store.image}
                      alt={store.city}
                      className="w-full h-full object-cover hover:scale-108 transition-transform duration-700 ease-out"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    
                    {/* City Pill */}
                    <div className="absolute top-4 left-4">
                      <span className="px-3 py-1 rounded-full bg-white/90 backdrop-blur-md text-[10px] font-bold tracking-wider uppercase text-[#1C1510] shadow-sm">
                        {store.established}
                      </span>
                    </div>

                    {/* Bottom Image Overlay */}
                    <div className="absolute bottom-4 left-4 right-4 text-white">
                      <span className="text-[10px] uppercase tracking-wider text-[#E8C7A8] font-bold">
                        {store.badge}
                      </span>
                      <h3 className="font-serif text-xl font-bold leading-tight mt-0.5">
                        {store.city}
                      </h3>
                    </div>
                  </div>

                  {/* Details Section */}
                  <div className="p-6 space-y-4">
                    <div className="space-y-2.5 text-xs text-[#5F4E44]">
                      <div className="flex items-start gap-2.5">
                        <MapPin className="w-4 h-4 text-[#B76E79] shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{store.address}</span>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <Phone className="w-4 h-4 text-[#B76E79] shrink-0" />
                        <a
                          href={`tel:${store.phone.replace(/\s+/g, '')}`}
                          className="font-semibold text-[#1C1510] hover:underline"
                        >
                          {store.phone}
                        </a>
                      </div>

                      {store.email && (
                        <div className="flex items-center gap-2.5">
                          <Mail className="w-4 h-4 text-[#B76E79] shrink-0" />
                          <span className="font-medium text-[#1C1510]">{store.email}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2.5">
                        <Clock className="w-4 h-4 text-[#B76E79] shrink-0" />
                        <span>{store.hours}</span>
                      </div>
                    </div>

                    {/* Departments Badge List */}
                    <div className="pt-3 border-t border-[#E8DFC8]/60">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-[#8B5A72] mb-2">
                        Featured Departments
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {store.departments.map((dept, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded-full bg-[#FAF7F2] border border-[#E8DFC8] text-[11px] font-medium text-[#4A173A]"
                          >
                            {dept}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="p-6 pt-0 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMapsClick(store.mapsQuery);
                    }}
                    className="flex-1 py-2.5 rounded-full border border-[#D5C6B5] hover:bg-[#FAF7F2] text-[#1C1510] text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Navigation className="w-3.5 h-3.5 text-[#B76E79]" />
                    <span>Get Directions</span>
                  </button>

                  <Link
                    to="/wedding/customer-registration"
                    onClick={(e) => e.stopPropagation()}
                    className="px-4 py-2.5 rounded-full bg-[#1C1510] hover:bg-[#32231A] text-[#FAF7F2] text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1 shadow-sm"
                  >
                    <span>Book</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#E8C7A8]" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
