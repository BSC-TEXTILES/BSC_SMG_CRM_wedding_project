import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, MapPin, Phone, Mail, ShieldCheck, X } from 'lucide-react';

export const ProfileFooter: React.FC = () => {
  const [cookieModalOpen, setCookieModalOpen] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <footer className="bg-[var(--pf-bg-alt)] border-t border-[var(--pf-border)] pt-16 pb-12 transition-colors">
        <div className="pf-container">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8 pb-12 border-b border-[var(--pf-border)]">
            {/* Col 1: Brand & Heritage */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--pf-burgundy)] flex items-center justify-center text-white font-serif text-lg font-bold shadow-xs">
                  B
                </div>
                <div>
                  <span className="font-serif text-xl font-bold tracking-tight text-[var(--pf-text-main)] block">
                    BSC Textiles
                  </span>
                  <span className="text-[10px] uppercase tracking-widest text-[var(--pf-gold)] font-bold">
                    Est. 1948 · Flagship House
                  </span>
                </div>
              </div>
              <p className="text-xs text-[var(--pf-text-muted)] leading-relaxed max-w-sm">
                The cloth is still sold on the counter. Curating certified pure Mulberry Kanjeevarams, bridal silks, bespoke menswear, and heirloom handlooms under one roof across Belagavi, Davanagere, and Shivamogga.
              </p>
              <div className="flex items-center gap-2 pt-2">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--pf-gold-light)] border border-[var(--pf-gold-border)] text-[var(--pf-gold)] text-[11px] font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Certified Silk Mark Partner</span>
                </div>
              </div>
            </div>

            {/* Col 2: Navigation Links */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--pf-gold)]">Navigation</h4>
              <ul className="space-y-2 text-xs">
                <li><Link to="/" className="text-[var(--pf-text-muted)] hover:text-[var(--pf-burgundy)] transition-colors">Home</Link></li>
                <li><Link to="/about" className="text-[var(--pf-text-muted)] hover:text-[var(--pf-burgundy)] transition-colors">About Heritage</Link></li>
                <li><Link to="/experience" className="text-[var(--pf-text-muted)] hover:text-[var(--pf-burgundy)] transition-colors">Milestones Timeline</Link></li>
                <li><Link to="/skills" className="text-[var(--pf-text-muted)] hover:text-[var(--pf-burgundy)] transition-colors">Craftsmanship Skills</Link></li>
                <li><Link to="/projects" className="text-[var(--pf-text-muted)] hover:text-[var(--pf-burgundy)] transition-colors">Portfolio Showcase</Link></li>
                <li><Link to="/achievements" className="text-[var(--pf-text-muted)] hover:text-[var(--pf-burgundy)] transition-colors">Awards & Honors</Link></li>
              </ul>
            </div>

            {/* Col 3: Services */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--pf-gold)]">Specialties</h4>
              <ul className="space-y-2 text-xs">
                <li><Link to="/services" className="text-[var(--pf-text-muted)] hover:text-[var(--pf-burgundy)] transition-colors">Bridal Trousseau Curation</Link></li>
                <li><Link to="/services" className="text-[var(--pf-text-muted)] hover:text-[var(--pf-burgundy)] transition-colors">Pure Mulberry Silk</Link></li>
                <li><Link to="/services" className="text-[var(--pf-text-muted)] hover:text-[var(--pf-burgundy)] transition-colors">Bespoke Suiting & Tailoring</Link></li>
                <li><Link to="/services" className="text-[var(--pf-text-muted)] hover:text-[var(--pf-burgundy)] transition-colors">Private VIP Suite</Link></li>
                <li><Link to="/services" className="text-[var(--pf-text-muted)] hover:text-[var(--pf-burgundy)] transition-colors">Heirloom Restoration</Link></li>
                <li><Link to="/gallery" className="text-[var(--pf-text-muted)] hover:text-[var(--pf-burgundy)] transition-colors">Media Gallery</Link></li>
              </ul>
            </div>

            {/* Col 4: Flagship Counters & Contact */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--pf-gold)]">Destinations</h4>
              <div className="space-y-2 text-xs text-[var(--pf-text-muted)]">
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-[var(--pf-gold)] shrink-0 mt-0.5" />
                  <span><strong>Belagavi Flagship:</strong> Khade Bazar & Kirloskar Rd</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-[var(--pf-gold)] shrink-0 mt-0.5" />
                  <span><strong>Davanagere:</strong> Coen Road Silk Pavilion</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-[var(--pf-gold)] shrink-0 mt-0.5" />
                  <span><strong>Shivamogga:</strong> Vidyanagar Complex</span>
                </div>
                <div className="pt-1 flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-[var(--pf-gold)]" />
                  <a href="tel:+918312421948" className="hover:underline font-mono">+91 831 242 1948</a>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-[var(--pf-gold)]" />
                  <a href="mailto:contact@bsctextiles.com" className="hover:underline">contact@bsctextiles.com</a>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--pf-text-subtle)]">
            <div>
              © 1948 – {new Date().getFullYear()} BSC Textiles. All rights reserved. Registered Indian Trademark.
            </div>

            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              <button
                type="button"
                onClick={() => setPrivacyModalOpen(true)}
                className="hover:text-[var(--pf-text-main)] transition-colors underline-offset-4 hover:underline"
              >
                Privacy Policy
              </button>
              <button
                type="button"
                onClick={() => setTermsModalOpen(true)}
                className="hover:text-[var(--pf-text-main)] transition-colors underline-offset-4 hover:underline"
              >
                Terms of Service
              </button>
              <button
                type="button"
                onClick={() => setCookieModalOpen(true)}
                className="hover:text-[var(--pf-text-main)] transition-colors underline-offset-4 hover:underline"
              >
                Cookie Preferences
              </button>
              <Link to="/admin" className="hover:text-[var(--pf-gold)] transition-colors">
                Admin
              </Link>
              <button
                type="button"
                onClick={scrollToTop}
                className="p-2 rounded-full border border-[var(--pf-border)] text-[var(--pf-text-muted)] hover:text-[var(--pf-text-main)] hover:bg-[var(--pf-bg)] transition-colors"
                aria-label="Scroll to top"
                title="Scroll to top"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Cookie Preferences Modal */}
      {cookieModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[var(--pf-bg-card)] border border-[var(--pf-border)] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl text-[var(--pf-text-main)]">
            <div className="flex items-center justify-between border-b border-[var(--pf-border)] pb-3">
              <h3 className="font-serif font-bold text-base">Cookie & Privacy Preferences</h3>
              <button onClick={() => setCookieModalOpen(false)} className="p-1 rounded text-[var(--pf-text-muted)] hover:bg-[var(--pf-bg-alt)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-[var(--pf-text-muted)] leading-relaxed">
              We use strictly necessary technical cookies to maintain your session, theme preferences, and form authenticity. No third-party behavioral ad tracking is conducted.
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--pf-bg-alt)]">
                <span className="font-semibold">Essential Site Storage</span>
                <span className="text-[10px] uppercase font-bold text-[var(--pf-gold)]">Always Active</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--pf-bg-alt)]">
                <span className="font-semibold">Theme & Local Preferences</span>
                <span className="text-[10px] uppercase font-bold text-emerald-600">Enabled</span>
              </div>
            </div>
            <button
              onClick={() => setCookieModalOpen(false)}
              className="w-full pf-btn-primary justify-center text-xs"
            >
              Save Preferences
            </button>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {privacyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[var(--pf-bg-card)] border border-[var(--pf-border)] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl max-h-[85vh] overflow-y-auto text-[var(--pf-text-main)]">
            <div className="flex items-center justify-between border-b border-[var(--pf-border)] pb-3">
              <h3 className="font-serif font-bold text-base">Privacy Commitment</h3>
              <button onClick={() => setPrivacyModalOpen(false)} className="p-1 rounded text-[var(--pf-text-muted)] hover:bg-[var(--pf-bg-alt)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-xs text-[var(--pf-text-muted)] space-y-3 leading-relaxed">
              <p>At BSC Textiles, we hold the privacy of our patrons and visiting bridal families with utmost sacred care.</p>
              <p><strong>1. Information Collection:</strong> When you submit a bridal appointment inquiry or contact request, your name, telephone, and email are solely used by our counter desk to schedule your reserved session.</p>
              <p><strong>2. No Selling of Data:</strong> We never sell, lease, or monetize customer telephone numbers or wedding dates to third-party telemarketers or external vendors.</p>
              <p><strong>3. Security:</strong> All client inquiries are transmitted via encrypted protocols and stored on secure enterprise databases.</p>
            </div>
            <button onClick={() => setPrivacyModalOpen(false)} className="w-full pf-btn-secondary justify-center text-xs">
              Close Privacy Statement
            </button>
          </div>
        </div>
      )}

      {/* Terms of Service Modal */}
      {termsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[var(--pf-bg-card)] border border-[var(--pf-border)] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl max-h-[85vh] overflow-y-auto text-[var(--pf-text-main)]">
            <div className="flex items-center justify-between border-b border-[var(--pf-border)] pb-3">
              <h3 className="font-serif font-bold text-base">Terms & Silk Certification</h3>
              <button onClick={() => setTermsModalOpen(false)} className="p-1 rounded text-[var(--pf-text-muted)] hover:bg-[var(--pf-bg-alt)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-xs text-[var(--pf-text-muted)] space-y-3 leading-relaxed">
              <p><strong>Counter Service:</strong> All pure silk sarees and fabric yardage are unrolled and inspected in your physical presence prior to final billing.</p>
              <p><strong>Silk Mark Guarantee:</strong> Pure silk products bear the authentic Silk Mark holographic tag issued in accordance with the Central Silk Board.</p>
              <p><strong>Consultation Suites:</strong> VIP private suite appointments are reserved for 120 minutes to guarantee relaxed, family-centric shopping.</p>
            </div>
            <button onClick={() => setTermsModalOpen(false)} className="w-full pf-btn-secondary justify-center text-xs">
              Close Terms
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ProfileFooter;
