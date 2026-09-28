import React, { useState, useEffect } from 'react';
import { ProfileHeader } from '../components/ProfileHeader';
import { ProfileFooter } from '../components/ProfileFooter';
import { ProfileApi } from '../api';
import { SkillItem } from '../types';
import { Sparkles, Layers, Award, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const ProfileSkills: React.FC = () => {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('All');

  useEffect(() => {
    document.title = 'Skills & Master Capabilities — BSC Textiles';

    async function loadData() {
      try {
        const data = await ProfileApi.getSkills();
        setSkills(data || []);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const categories = ['All', ...Array.from(new Set(skills.map(s => s.category).filter(Boolean)))];

  const filtered = activeCategory === 'All'
    ? skills
    : skills.filter(s => s.category === activeCategory);

  return (
    <div className="flex flex-col min-h-screen">
      <ProfileHeader />

      <main className="flex-1 py-10 sm:py-16">
        <div className="pf-container space-y-12">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[var(--pf-border)] pb-8">
            <div className="space-y-2 max-w-xl">
              <span className="pf-subheading">Competencies & Craftsmanship</span>
              <h1 className="font-serif text-3xl sm:text-5xl font-bold text-[var(--pf-text-main)]">
                Skills & Disciplines
              </h1>
              <p className="text-xs sm:text-sm text-[var(--pf-text-muted)] leading-relaxed">
                Refined textile competencies spanning pure silk appraisal, Korvai pit-loom weaving, bridal trousseau curation, bespoke suiting design, and large-scale retail floor leadership.
              </p>
            </div>

            {/* Category tabs */}
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

          {/* Categorized Skills Grid */}
          {loading ? (
            <div className="py-20 text-center text-xs text-[var(--pf-text-muted)]">
              Loading craftsmanship skills...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center pf-card p-12 text-xs text-[var(--pf-text-muted)]">
              No skills found in this discipline.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filtered.map(skill => (
                <div
                  key={skill.id}
                  className="pf-card p-6 space-y-4 hover:border-[var(--pf-gold-border)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="pf-badge-gold text-[10px] mb-1 inline-block">{skill.category}</span>
                      <h3 className="font-serif text-base sm:text-lg font-bold text-[var(--pf-text-main)]">
                        {skill.name}
                      </h3>
                    </div>
                    {skill.years_of_experience > 0 && (
                      <span className="text-[11px] font-mono font-bold text-[var(--pf-gold)] bg-[var(--pf-gold-light)] px-2.5 py-1 rounded-md shrink-0">
                        {skill.years_of_experience} Yrs
                      </span>
                    )}
                  </div>

                  {/* Subtle, elegant progress bar (avoiding gaudy percentages) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-[var(--pf-text-subtle)] font-medium">
                      <span>Proficiency & Depth</span>
                      <span className="font-mono text-[var(--pf-text-main)] font-bold">{skill.proficiency}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[var(--pf-bg-alt)] overflow-hidden border border-[var(--pf-border-soft)]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[var(--pf-gold)] to-[var(--pf-burgundy)] transition-all duration-700"
                        style={{ width: `${skill.proficiency}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action Footer */}
          <div className="pt-8 text-center flex flex-wrap items-center justify-center gap-4">
            <Link to="/services" className="pf-btn-primary text-xs">
              <span>Explore Signature Services</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/projects" className="pf-btn-secondary text-xs">
              <span>View Portfolio Showcase</span>
            </Link>
          </div>
        </div>
      </main>

      <ProfileFooter />
    </div>
  );
};

export default ProfileSkills;
