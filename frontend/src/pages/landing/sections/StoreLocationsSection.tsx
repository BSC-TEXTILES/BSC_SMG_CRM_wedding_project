import React, { useState, useEffect } from 'react';
import { LANDING_DATA, StoreLocationData } from '../landingData';
import { MapPin, Phone, Mail, Clock, Navigation, ArrowRight, Store, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LazyImage } from '../../../components/ui/LazyImage';

export type CityFilter = 'davanagere' | 'belagavi' | 'shivamogga' | 'all';

/**
 * Helper to programmatically select a showroom from anywhere on the landing page
 * and smoothly scroll to the store section.
 */
export const selectShowroomCity = (city: CityFilter) => {
  window.dispatchEvent(new CustomEvent('bsc-select-city', { detail: city }));
  const el = document.getElementById('stores');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' });
  }
};

export default function StoreLocationsSection() {
  const { stores } = LANDING_DATA;
  const [selectedCity, setSelectedCity] = useState<CityFilter>('davanagere');

  // Listen for showroom selection events from other components (Hero, Footer, Navigation)
  useEffect(() => {
    const handleSelectCity = (e: Event) => {
      const customEvent = e as CustomEvent<CityFilter>;
      if (customEvent.detail) {
        setSelectedCity(customEvent.detail);
      }
    };
    window.addEventListener('bsc-select-city', handleSelectCity);
    return () => window.removeEventListener('bsc-select-city', handleSelectCity);
  }, []);

  const handleMapsClick = (query: string) => {
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const displayedStores = selectedCity === 'all'
    ? stores
    : stores.filter((s) => s.id === selectedCity);

  return (
    <section
      id="stores"
      className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-t border-[#E8DFC8]/60 bg-[#FAF7F2] select-none [perspective:1200px]"
    >
      <div className="max-w-7xl mx-auto">
        
        {/* Section Header with Simple English */}
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
          <span className="text-[10px] sm:text-xs font-bold tracking-[0.2em] uppercase text-[#B76E79]">
            OUR SHOWROOMS
          </span>
          <h2 className="font-serif text-3xl sm:text-5xl font-medium text-[#1A120C] mt-2.5">
            Visit Our Stores
          </h2>
          <p className="text-sm sm:text-base text-[#6F5F53] mt-3 font-normal leading-relaxed">
            Click on any city below to see the showroom address, timings, and contact details.
          </p>
        </div>

        {/* City Selection Buttons: Davanagere, Belagavi, Shivamogga, All Showrooms */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 mb-10">
          <button
            type="button"
            onClick={() => setSelectedCity('davanagere')}
            className={`px-5 py-2.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all duration-300 cursor-pointer flex items-center gap-2 ${
              selectedCity === 'davanagere'
                ? 'bg-[#1C1510] text-[#FAF7F2] shadow-lg scale-105 ring-2 ring-[#B76E79]/50'
                : 'bg-white/80 text-[#5F4E44] hover:bg-white hover:text-[#1C1510] border border-[#E8DFC8]'
            }`}
          >
            <Store className="w-3.5 h-3.5 text-[#B76E79]" />
            <span>Davanagere</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCity('belagavi')}
            className={`px-5 py-2.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all duration-300 cursor-pointer flex items-center gap-2 ${
              selectedCity === 'belagavi'
                ? 'bg-[#1C1510] text-[#FAF7F2] shadow-lg scale-105 ring-2 ring-[#B76E79]/50'
                : 'bg-white/80 text-[#5F4E44] hover:bg-white hover:text-[#1C1510] border border-[#E8DFC8]'
            }`}
          >
            <Store className="w-3.5 h-3.5 text-[#B76E79]" />
            <span>Belagavi</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCity('shivamogga')}
            className={`px-5 py-2.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all duration-300 cursor-pointer flex items-center gap-2 ${
              selectedCity === 'shivamogga'
                ? 'bg-[#1C1510] text-[#FAF7F2] shadow-lg scale-105 ring-2 ring-[#B76E79]/50'
                : 'bg-white/80 text-[#5F4E44] hover:bg-white hover:text-[#1C1510] border border-[#E8DFC8]'
            }`}
          >
            <Store className="w-3.5 h-3.5 text-[#B76E79]" />
            <span>Shivamogga</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCity('all')}
            className={`px-5 py-2.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all duration-300 cursor-pointer ${
              selectedCity === 'all'
                ? 'bg-[#1C1510] text-[#FAF7F2] shadow-lg scale-105 ring-2 ring-[#B76E79]/50'
                : 'bg-white/80 text-[#5F4E44] hover:bg-white hover:text-[#1C1510] border border-[#E8DFC8]'
            }`}
          >
            <span>All Showrooms</span>
          </button>
        </div>

        {/* Display Single Selected Showroom with Rich Details */}
        {selectedCity !== 'all' && displayedStores.length === 1 && (
          <div className="max-w-4xl mx-auto rounded-3xl overflow-hidden bg-white/95 backdrop-blur-md border border-[#E8DFC8] shadow-2xl transition-all duration-500 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-12 items-stretch">
              
              {/* Left Column: Image with Badge */}
              <div className="md:col-span-5 relative min-h-[280px] md:min-h-full overflow-hidden bg-[#E8DFC8]/30">
                <LazyImage
                  src={displayedStores[0].image}
                  alt={displayedStores[0].city}
                  width={600}
                  height={500}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent pointer-events-none" />
                
                <div className="absolute top-4 left-4">
                  <span className="px-3.5 py-1 rounded-full bg-white/95 backdrop-blur-md text-[10px] font-bold tracking-wider uppercase text-[#1C1510] shadow-md">
                    {displayedStores[0].established}
                  </span>
                </div>

                <div className="absolute bottom-5 left-5 right-5 text-white">
                  <span className="text-[10px] uppercase tracking-wider text-[#E8C7A8] font-bold">
                    {displayedStores[0].badge}
                  </span>
                  <h3 className="font-serif text-2xl font-bold leading-tight mt-1">
                    {displayedStores[0].city}
                  </h3>
                  <p className="text-xs text-[#FAF7F2]/80 mt-0.5">
                    {displayedStores[0].name}
                  </p>
                </div>
              </div>

              {/* Right Column: Address, Timing, Phone, Actions */}
              <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-widest text-[#B76E79]">
                      Showroom Address & Details
                    </span>
                    <h4 className="font-serif text-xl sm:text-2xl font-bold text-[#1C1510] mt-1">
                      {displayedStores[0].city}
                    </h4>
                  </div>

                  <div className="space-y-3 text-xs sm:text-sm text-[#5F4E44]">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-[#B76E79] shrink-0 mt-0.5" />
                      <span className="leading-relaxed font-medium text-[#1C1510]">
                        {displayedStores[0].address}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-[#B76E79] shrink-0" />
                      <span>{displayedStores[0].hours}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-[#B76E79] shrink-0" />
                      <a
                        href={`tel:${displayedStores[0].phone.replace(/\s+/g, '')}`}
                        className="font-semibold text-[#1C1510] hover:text-[#B76E79] hover:underline"
                      >
                        {displayedStores[0].phone}
                      </a>
                    </div>

                    {displayedStores[0].email && (
                      <div className="flex items-center gap-3">
                        <Mail className="w-4 h-4 text-[#B76E79] shrink-0" />
                        <a
                          href={`mailto:${displayedStores[0].email}`}
                          className="text-[#6F5F53] hover:text-[#1C1510] hover:underline"
                        >
                          {displayedStores[0].email}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Available Departments */}
                  <div className="pt-3 border-t border-[#E8DFC8]/60">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-[#8B5A72] mb-2.5">
                      Available Sections at this Store
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {displayedStores[0].departments.map((dept, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 rounded-full bg-[#FAF7F2] border border-[#E8DFC8] text-xs font-medium text-[#4A173A] flex items-center gap-1.5"
                        >
                          <CheckCircle className="w-3 h-3 text-[#B76E79]" />
                          <span>{dept}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Primary & Secondary Action Buttons */}
                <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleMapsClick(displayedStores[0].mapsQuery)}
                    className="w-full sm:flex-1 py-3 px-5 rounded-full border border-[#D5C6B5] hover:bg-[#FAF7F2] text-[#1C1510] text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Navigation className="w-4 h-4 text-[#B76E79]" />
                    <span>Get Directions on Map</span>
                  </button>

                  <Link
                    to="/wedding/customer-registration"
                    className="w-full sm:flex-1 py-3 px-5 rounded-full bg-[#1C1510] hover:bg-[#32231A] text-[#FAF7F2] text-xs font-bold uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 shadow-md hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <span>Register for Wedding Shopping</span>
                    <ArrowRight className="w-4 h-4 text-[#E8C7A8]" />
                  </Link>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* Display All 3 Store Cards When "All Showrooms" is Selected */}
        {selectedCity === 'all' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 sm:gap-10 [transform-style:preserve-3d] animate-fade-in">
            {stores.map((store) => (
              <div
                key={store.id}
                className="rounded-3xl overflow-hidden bg-white/90 backdrop-blur-md border border-[#E8DFC8] shadow-md hover:shadow-xl transition-all duration-500 flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-56 sm:h-64 overflow-hidden bg-[#E8DFC8]/20">
                    <LazyImage
                      src={store.image}
                      alt={store.city}
                      width={400}
                      height={256}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-700 ease-out"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />
                    
                    <div className="absolute top-4 left-4">
                      <span className="px-3 py-1 rounded-full bg-white/90 backdrop-blur-md text-[10px] font-bold tracking-wider uppercase text-[#1C1510] shadow-sm">
                        {store.established}
                      </span>
                    </div>

                    <div className="absolute bottom-4 left-4 right-4 text-white">
                      <span className="text-[10px] uppercase tracking-wider text-[#E8C7A8] font-bold">
                        {store.badge}
                      </span>
                      <h3 className="font-serif text-xl font-bold leading-tight mt-0.5">
                        {store.city}
                      </h3>
                    </div>
                  </div>

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

                      <div className="flex items-center gap-2.5">
                        <Clock className="w-4 h-4 text-[#B76E79] shrink-0" />
                        <span>{store.hours}</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#E8DFC8]/60">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-[#8B5A72] mb-2">
                        Available Sections
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

                <div className="p-6 pt-0 flex flex-col sm:flex-row items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleMapsClick(store.mapsQuery)}
                    className="w-full sm:flex-1 py-2.5 rounded-full border border-[#D5C6B5] hover:bg-[#FAF7F2] text-[#1C1510] text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Navigation className="w-3.5 h-3.5 text-[#B76E79]" />
                    <span>Directions</span>
                  </button>

                  <Link
                    to="/wedding/customer-registration"
                    className="w-full sm:flex-1 py-2.5 rounded-full bg-[#1C1510] hover:bg-[#32231A] text-[#FAF7F2] text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1 shadow-sm"
                  >
                    <span>Register</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#E8C7A8]" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </section>
  );
}
