import React, { useState, useEffect } from 'react';
import { ProfileHeader } from '../components/ProfileHeader';
import { ProfileFooter } from '../components/ProfileFooter';
import { ProfileApi } from '../api';
import { TestimonialItem } from '../types';
import { Star, Quote, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const ProfileTestimonials: React.FC = () => {
  const [testimonials, setTestimonials] = useState<TestimonialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCarouselIdx, setActiveCarouselIdx] = useState(0);

  useEffect(() => {
    document.title = 'Client & Family Testimonials — BSC Textiles';

    async function loadData() {
      try {
        const data = await ProfileApi.getTestimonials();
        setTestimonials(data || []);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handlePrev = () => {
    setActiveCarouselIdx(prev => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const handleNext = () => {
    setActiveCarouselIdx(prev => (prev + 1) % testimonials.length);
  };

  const activeItem = testimonials[activeCarouselIdx];

  return (
    <div className="flex flex-col min-h-screen">
      <ProfileHeader />

      <main className="flex-1 py-10 sm:py-16">
        <div className="pf-container space-y-16">
          {/* Header */}
          <div className="space-y-3 max-w-2xl border-b border-[var(--pf-border)] pb-8">
            <span className="pf-subheading">Generational Family Trust</span>
            <h1 className="font-serif text-3xl sm:text-5xl font-bold text-[var(--pf-text-main)]">
              What People Say After the Wedding
            </h1>
            <p className="text-xs sm:text-sm text-[var(--pf-text-muted)] leading-relaxed">
              Serving three generations of families across Belagavi, Davanagere, Shivamogga, and across India with personalized counter consultations and pure silk perfection.
            </p>
          </div>

          {/* Accessible Featured Carousel */}
          {!loading && testimonials.length > 0 && activeItem && (
            <div className="pf-card p-8 sm:p-12 border-2 border-[var(--pf-gold-border)] relative overflow-hidden bg-gradient-to-br from-[var(--pf-bg-card)] to-[var(--pf-bg-alt)]">
              <Quote className="w-16 h-16 text-[var(--pf-gold)]/20 absolute -top-2 right-6" />

              <div className="max-w-3xl mx-auto text-center space-y-6 relative z-10">
                <div className="flex justify-center gap-1 text-amber-500">
                  {[...Array(activeItem.rating || 5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-current" />
                  ))}
                </div>

                <p className="font-serif text-lg sm:text-2xl text-[var(--pf-text-main)] italic leading-relaxed">
                  "{activeItem.testimonial_text}"
                </p>

                <div className="flex flex-col items-center gap-2 pt-2">
                  <img
                    src={activeItem.avatar_url}
                    alt={activeItem.client_name}
                    className="w-14 h-14 rounded-full object-cover border-2 border-[var(--pf-gold)] shadow-md"
                  />
                  <div>
                    <h3 className="font-serif font-bold text-base text-[var(--pf-text-main)]">
                      {activeItem.client_name}
                    </h3>
                    <span className="text-xs text-[var(--pf-gold)] font-bold block">
                      {activeItem.position} · {activeItem.company}
                    </span>
                    <span className="text-[10px] text-[var(--pf-text-subtle)] block">
                      {activeItem.date_given}
                    </span>
                  </div>
                </div>

                {/* Carousel Controls */}
                <div className="flex items-center justify-center gap-4 pt-4">
                  <button
                    onClick={handlePrev}
                    className="p-2 rounded-full border border-[var(--pf-border)] text-[var(--pf-text-muted)] hover:bg-[var(--pf-bg)] hover:text-[var(--pf-text-main)] transition-colors"
                    aria-label="Previous testimonial"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <div className="flex gap-1.5">
                    {testimonials.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveCarouselIdx(idx)}
                        className={`h-2 rounded-full transition-all ${
                          activeCarouselIdx === idx
                            ? 'w-6 bg-[var(--pf-burgundy)]'
                            : 'w-2 bg-[var(--pf-border-strong)]'
                        }`}
                        aria-label={`Go to slide ${idx + 1}`}
                      />
                    ))}
                  </div>

                  <button
                    onClick={handleNext}
                    className="p-2 rounded-full border border-[var(--pf-border)] text-[var(--pf-text-muted)] hover:bg-[var(--pf-bg)] hover:text-[var(--pf-text-main)] transition-colors"
                    aria-label="Next testimonial"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Grid of All Verified Reviews */}
          <div className="space-y-6">
            <h2 className="font-serif text-2xl font-bold text-[var(--pf-text-main)]">
              All Verified Family Reviews
            </h2>

            {loading ? (
              <div className="py-20 text-center text-xs text-[var(--pf-text-muted)]">
                Loading family testimonials...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {testimonials.map(t => (
                  <div
                    key={t.id}
                    className="pf-card p-6 flex flex-col justify-between space-y-4 hover:border-[var(--pf-gold-border)]"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex gap-0.5 text-amber-500">
                          {[...Array(t.rating || 5)].map((_, i) => (
                            <Star key={i} className="w-3.5 h-3.5 fill-current" />
                          ))}
                        </div>
                        <span className="text-[10px] font-mono text-[var(--pf-text-subtle)]">
                          {t.date_given}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-[var(--pf-text-muted)] leading-relaxed italic">
                        "{t.testimonial_text}"
                      </p>
                    </div>

                    <div className="pt-4 border-t border-[var(--pf-border-soft)] flex items-center gap-3">
                      <img
                        src={t.avatar_url}
                        alt={t.client_name}
                        className="w-10 h-10 rounded-full object-cover border border-[var(--pf-border)]"
                      />
                      <div>
                        <h4 className="font-serif text-xs font-bold text-[var(--pf-text-main)]">
                          {t.client_name}
                        </h4>
                        <span className="text-[10px] text-[var(--pf-text-subtle)] block">
                          {t.company}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action CTA */}
          <div className="p-8 rounded-2xl bg-[var(--pf-bg-alt)] border border-[var(--pf-border)] text-center space-y-4">
            <h3 className="font-serif text-xl sm:text-2xl font-bold text-[var(--pf-text-main)]">
              Experience the counter difference for your family.
            </h3>
            <p className="text-xs text-[var(--pf-text-muted)] max-w-md mx-auto">
              Our showroom floors welcome you seven days a week with certified silk experts and dedicated hospitality.
            </p>
            <div className="pt-2">
              <Link to="/contact" className="pf-btn-primary text-xs inline-flex">
                <span>Book Bridal Suite</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </main>

      <ProfileFooter />
    </div>
  );
};

export default ProfileTestimonials;
