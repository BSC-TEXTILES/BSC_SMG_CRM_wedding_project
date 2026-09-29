import React from 'react';
import { Link } from 'react-router-dom';
import { LANDING_DATA } from '../landingData';
import { ShieldCheck, ArrowUp, Heart } from 'lucide-react';

export default function LuxuryFooter() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-[#140D08] text-[#FAF7F2] border-t-2 border-[#2A1D13] pt-16 pb-12 px-4 sm:px-6 lg:px-8 select-none">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Top Tier: Brand, Showrooms & Fast Links */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 border-b border-[#2A1D13] pb-12">
          
          {/* Brand Mark Column */}
          <div className="md:col-span-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FAF7F2] text-[#140D08] flex items-center justify-center font-serif text-lg font-bold">
                B
              </div>
              <div>
                <span className="font-serif tracking-widest text-base font-bold text-white uppercase block">
                  BSC EXCLUSIVE
                </span>
                <span className="text-[10px] tracking-wider text-[#A69385] uppercase">
                  FIVE GENERATIONS · ESTD 1938
                </span>
              </div>
            </div>

            <p className="text-xs text-[#A69385] leading-relaxed max-w-sm">
              Karnataka’s premier textile house for pure silk sarees, bespoke tailoring, bridal trousseaus, and curated home furnishings.
            </p>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-[#E8C7A8]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#B76E79]" />
              <span>Silk Mark Organization of India Member</span>
            </div>
          </div>

          {/* Showroom Cities Column */}
          <div className="md:col-span-4 space-y-3">
            <h4 className="text-xs uppercase tracking-widest font-bold text-[#E8C7A8]">
              Showroom Flagships
            </h4>
            <ul className="space-y-2 text-xs text-[#D4C3B5]">
              <li>
                <strong className="text-white">Belagavi:</strong> Khade Bazar / Raviwar Peth, Tilakwadi
              </li>
              <li>
                <strong className="text-white">Davanagere:</strong> Mandipet / PB Road, MCC B Block
              </li>
              <li>
                <strong className="text-white">Shivamogga:</strong> Nehru Road / Durgigudi Main Road
              </li>
            </ul>
          </div>

          {/* Quick Nav Column */}
          <div className="md:col-span-4 space-y-3">
            <h4 className="text-xs uppercase tracking-widest font-bold text-[#E8C7A8]">
              Navigation & Portals
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs text-[#D4C3B5]">
              <a href="#hero" className="hover:text-white transition-colors">Home</a>
              <a href="#legacy" className="hover:text-white transition-colors">Our Legacy</a>
              <a href="#collections" className="hover:text-white transition-colors">Collections</a>
              <a href="#wedding" className="hover:text-white transition-colors">Wedding Suite</a>
              <a href="#stores" className="hover:text-white transition-colors">Stores</a>
              <a href="#shivamogga-event" className="hover:text-white transition-colors">Shivamogga</a>
              <Link to="/wedding/customer-registration" className="text-[#B76E79] hover:underline font-bold">
                Wedding Register
              </Link>
              <Link to="/login" className="hover:text-white transition-colors">
                Staff Portal
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Tier: Copyright & Scroll to Top */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#8B776A]">
          <div>
            © {new Date().getFullYear()} BSC Textiles Private Limited. All rights reserved.
          </div>

          <button
            type="button"
            onClick={scrollToTop}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-[#FAF7F2] transition-colors cursor-pointer"
          >
            <span>Back to top</span>
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </footer>
  );
}
