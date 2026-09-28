import React, { useState, useEffect } from 'react';
import { ProfileHeader } from '../components/ProfileHeader';
import { ProfileFooter } from '../components/ProfileFooter';
import { ServiceInquiryModal } from '../components/ServiceInquiryModal';
import { ProfileApi } from '../api';
import { ServiceItem } from '../types';
import {
  Crown,
  Sparkles,
  Scissors,
  Gift,
  Store,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';

const ICON_MAP: Record<string, React.ReactNode> = {
  Crown: <Crown className="w-5 h-5" />,
  Sparkles: <Sparkles className="w-5 h-5" />,
  Scissors: <Scissors className="w-5 h-5" />,
  Gift: <Gift className="w-5 h-5" />,
  Store: <Store className="w-5 h-5" />,
  ShieldCheck: <ShieldCheck className="w-5 h-5" />
};

export const ProfileServices: React.FC = () => {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);

  useEffect(() => {
    document.title = 'Bespoke Services & Bridal Consultations — BSC Textiles';

    async function loadData() {
      try {
        const data = await ProfileApi.getServices();
        setServices(data || []);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <ProfileHeader />

      <main className="flex-1 py-10 sm:py-16">
        <div className="pf-container space-y-12">
          {/* Header */}
          <div className="space-y-3 max-w-2xl border-b border-[var(--pf-border)] pb-8">
            <span className="pf-subheading">Dedicated Counter Services</span>
            <h1 className="font-serif text-3xl sm:text-5xl font-bold text-[var(--pf-text-main)]">
              Services & Private Consultations
            </h1>
            <p className="text-xs sm:text-sm text-[var(--pf-text-muted)] leading-relaxed">
              Every bridal trousseau and tailoring project is assigned an exclusive senior stylist and a private viewing suite, ensuring unhurried, authentic counter service.
            </p>
          </div>

          {/* Services Grid */}
          {loading ? (
            <div className="py-20 text-center text-xs text-[var(--pf-text-muted)]">
              Loading service offerings...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {services.map(service => (
                <div
                  key={service.id}
                  className="pf-card p-6 sm:p-8 flex flex-col justify-between space-y-6 hover:border-[var(--pf-gold-border)]"
                >
                  <div className="space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--pf-gold-light)] border border-[var(--pf-gold-border)] text-[var(--pf-gold)] flex items-center justify-center shadow-xs">
                      {ICON_MAP[service.icon_name] || <Sparkles className="w-6 h-6" />}
                    </div>

                    <div className="space-y-1">
                      <span className="pf-badge-gold text-[10px]">Bespoke Specialty</span>
                      <h3 className="font-serif text-xl font-bold text-[var(--pf-text-main)]">
                        {service.title}
                      </h3>
                    </div>

                    <p className="text-xs text-[var(--pf-text-muted)] leading-relaxed">
                      {service.detailed_description || service.short_description}
                    </p>

                    {service.features && service.features.length > 0 && (
                      <div className="pt-3 border-t border-[var(--pf-border-soft)] space-y-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--pf-gold)] block">
                          Included Features
                        </span>
                        <ul className="space-y-1.5">
                          {service.features.map((feat, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-xs text-[var(--pf-text-muted)]">
                              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--pf-burgundy)] shrink-0 mt-0.5" />
                              <span>{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="pt-6 border-t border-[var(--pf-border-soft)] space-y-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[10px] uppercase font-bold text-[var(--pf-text-subtle)]">Starting Price</span>
                      <span className="font-serif text-sm font-bold text-[var(--pf-burgundy)]">{service.starting_price}</span>
                    </div>

                    <button
                      onClick={() => setSelectedService(service)}
                      className="w-full pf-btn-primary justify-center text-xs"
                    >
                      <span>{service.cta_text || 'Reserve Private Suite'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Consultation Promise Banner */}
          <div className="rounded-2xl bg-[var(--pf-bg-alt)] border border-[var(--pf-border)] p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1">
              <h3 className="font-serif font-bold text-lg text-[var(--pf-text-main)]">Looking for custom wedding party coordination?</h3>
              <p className="text-xs text-[var(--pf-text-muted)]">
                We coordinate matching silks, dhotis, and safas across 50+ family members with customized gift packaging.
              </p>
            </div>
            <Link to="/contact?service=custom-wedding" className="pf-btn-secondary text-xs shrink-0">
              Speak with Master Stylist
            </Link>
          </div>
        </div>
      </main>

      <ProfileFooter />

      <ServiceInquiryModal
        service={selectedService}
        onClose={() => setSelectedService(null)}
      />
    </div>
  );
};

export default ProfileServices;
