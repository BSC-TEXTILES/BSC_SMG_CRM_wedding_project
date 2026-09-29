import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowUp } from 'lucide-react';
import { selectShowroomCity } from '../sections/StoreLocationsSection';

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
              <div className="p-1 rounded-xl bg-white/10 border border-white/15">
                <img
                  src="/Main_logo_mobile.png"
                  alt="BSC Textiles"
                  width={40}
                  height={40}
                  loading="lazy"
                  decoding="async"
                  className="h-10 w-auto object-contain"
                />
              </div>
              <div>
                <span className="font-serif tracking-widest text-base font-bold text-white uppercase block">
                  BSC TEXTILES
                </span>
                <span className="text-[10px] tracking-wider text-[#E8C7A8] uppercase">
                  FIVE GENERATIONS · ESTD 1938
                </span>
              </div>
            </div>

            <p className="text-xs text-[#A69385] leading-relaxed max-w-sm">
              Karnataka’s trusted textile house for pure silk sarees, custom tailoring, wedding shopping, and home furnishings.
            </p>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-[#E8C7A8]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#B76E79]" />
              <span>Silk Mark Organization of India Member</span>
            </div>
          </div>

          {/* Showroom Cities Column with Direct Single Showroom Filter Trigger */}
          <div className="md:col-span-4 space-y-3">
            <h4 className="text-xs uppercase tracking-widest font-bold text-[#E8C7A8]">
              Our Showrooms (Click to View)
            </h4>
            <ul className="space-y-2.5 text-xs text-[#D4C3B5]">
              <li>
                <button
                  type="button"
                  onClick={() => selectShowroomCity('davanagere')}
                  className="text-left hover:text-[#E8C7A8] transition-colors cursor-pointer group flex items-start gap-1"
                >
                  <span className="text-[#B76E79] group-hover:translate-x-0.5 transition-transform">›</span>
                  <span>
                    <strong className="text-white group-hover:underline">Davanagere:</strong> Medical College Rd, MCC B Block
                  </span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => selectShowroomCity('belagavi')}
                  className="text-left hover:text-[#E8C7A8] transition-colors cursor-pointer group flex items-start gap-1"
                >
                  <span className="text-[#B76E79] group-hover:translate-x-0.5 transition-transform">›</span>
                  <span>
                    <strong className="text-white group-hover:underline">Belagavi:</strong> Khade Bazar / Tilakwadi
                  </span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => selectShowroomCity('shivamogga')}
                  className="text-left hover:text-[#E8C7A8] transition-colors cursor-pointer group flex items-start gap-1"
                >
                  <span className="text-[#B76E79] group-hover:translate-x-0.5 transition-transform">›</span>
                  <span>
                    <strong className="text-white group-hover:underline">Shivamogga:</strong> BH Rd, Durgigudi
                  </span>
                </button>
              </li>
            </ul>
          </div>

          {/* Quick Nav Column */}
          <div className="md:col-span-4 space-y-3">
            <h4 className="text-xs uppercase tracking-widest font-bold text-[#E8C7A8]">
              Quick Links
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs text-[#D4C3B5]">
              <a href="#hero" className="hover:text-white transition-colors">Home</a>
              <a href="#legacy" className="hover:text-white transition-colors">Our Story</a>
              <a href="#collections" className="hover:text-white transition-colors">Collections</a>
              <a href="#wedding" className="hover:text-white transition-colors">Wedding Suite</a>
              <a href="#stores" className="hover:text-white transition-colors">Our Stores</a>
              <a href="#shivamogga-event" className="hover:text-white transition-colors">Shivamogga Store</a>
              <Link to="/wedding/customer-registration" className="text-[#B76E79] hover:underline font-bold col-span-2">
                Register for Wedding Shopping
              </Link>
              <Link to="/login" className="hover:text-white transition-colors">
                Staff Login
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
