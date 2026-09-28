import React, { useState, useEffect } from 'react';
import { ProfileHeader } from '../components/ProfileHeader';
import { ProfileFooter } from '../components/ProfileFooter';
import { ProfileApi } from '../api';
import { AchievementItem } from '../types';
import {
  Award,
  ShieldCheck,
  Calendar,
  ExternalLink,
  Medal,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const ProfileAchievements: React.FC = () => {
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');

  useEffect(() => {
    document.title = 'Honors, Awards & Accreditations — BSC Textiles';

    async function loadData() {
      try {
        const data = await ProfileApi.getAchievements();
        setAchievements(data || []);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const categories = ['All', ...Array.from(new Set(achievements.map(a => a.category).filter(Boolean)))];

  const filtered = activeCategory === 'All'
    ? achievements
    : achievements.filter(a => a.category === activeCategory);

  return (
    <div className="flex flex-col min-h-screen">
      <ProfileHeader />

      <main className="flex-1 py-10 sm:py-16">
        <div className="pf-container space-y-12">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[var(--pf-border)] pb-8">
            <div className="space-y-3 max-w-2xl">
              <span className="pf-subheading">National Honors & Accreditations</span>
              <h1 className="font-serif text-3xl sm:text-5xl font-bold text-[var(--pf-text-main)]">
                Recognitions & Milestones
              </h1>
              <p className="text-xs sm:text-sm text-[var(--pf-text-muted)] leading-relaxed">
                Celebrating seven decades of handloom purity, official Silk Mark compliance, artisan advocacy, and generational retail customer satisfaction.
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    activeCategory === cat
                      ? 'bg-[var(--pf-burgundy)] text-white shadow-xs'
                      : 'border border-[var(--pf-border)] bg-[var(--pf-bg-card)] text-[var(--pf-text-muted)] hover:text-[var(--pf-text-main)]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="py-20 text-center text-xs text-[var(--pf-text-muted)]">
              Loading achievements and honors...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {filtered.map(ach => (
                <div
                  key={ach.id}
                  className="pf-card p-6 sm:p-8 flex flex-col justify-between space-y-4 hover:border-[var(--pf-gold-border)]"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-[var(--pf-gold-light)] border border-[var(--pf-gold-border)] text-[var(--pf-gold)] flex items-center justify-center shadow-xs">
                        <Award className="w-6 h-6" />
                      </div>
                      <div className="text-right">
                        <span className="pf-badge-gold text-[10px] inline-block mb-1">{ach.category}</span>
                        <div className="text-xs font-mono font-bold text-[var(--pf-text-subtle)]">
                          {ach.issue_date}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <h3 className="font-serif text-xl font-bold text-[var(--pf-text-main)]">
                        {ach.title}
                      </h3>
                      <p className="text-xs font-bold text-[var(--pf-gold)]">
                        {ach.organization}
                      </p>
                    </div>

                    <p className="text-xs sm:text-sm text-[var(--pf-text-muted)] leading-relaxed">
                      {ach.description}
                    </p>
                  </div>

                  {ach.credential_url && ach.credential_url !== '#' && (
                    <div className="pt-4 border-t border-[var(--pf-border-soft)]">
                      <a
                        href={ach.credential_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--pf-burgundy)] hover:underline"
                      >
                        <span>Verify Accreditation / Reference</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Verification Guarantee */}
          <div className="p-8 rounded-2xl bg-[var(--pf-bg-alt)] border border-[var(--pf-border)] flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[var(--pf-gold-light)] border border-[var(--pf-gold-border)] text-[var(--pf-gold)] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div className="space-y-0.5">
                <h4 className="font-serif font-bold text-base text-[var(--pf-text-main)]">
                  The BSC Silk Mark Certification Guarantee
                </h4>
                <p className="text-xs text-[var(--pf-text-muted)]">
                  Every pure silk piece sold across Belagavi, Davanagere, and Shivamogga undergoes laboratory burn & chemical testing.
                </p>
              </div>
            </div>
            <Link to="/contact" className="pf-btn-secondary text-xs shrink-0">
              Inquire with Desk
            </Link>
          </div>
        </div>
      </main>

      <ProfileFooter />
    </div>
  );
};

export default ProfileAchievements;
