import React, { useState, useEffect } from 'react';
import { ProfileHeader } from '../components/ProfileHeader';
import { ProfileFooter } from '../components/ProfileFooter';
import { ProfileApi } from '../api';
import { ExperienceItem } from '../types';
import {
  Briefcase,
  Calendar,
  MapPin,
  CheckCircle2,
  Award,
  ArrowRight,
  Filter
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const ProfileExperience: React.FC = () => {
  const [experiences, setExperiences] = useState<ExperienceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<'All' | 'Current' | 'Heritage'>('All');

  useEffect(() => {
    document.title = 'Experience & Heritage Milestones — BSC Textiles';

    async function loadData() {
      try {
        const data = await ProfileApi.getExperience();
        setExperiences(data || []);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filtered = experiences.filter(item => {
    if (selectedFilter === 'Current') return item.is_current;
    if (selectedFilter === 'Heritage') return !item.is_current;
    return true;
  });

  return (
    <div className="flex flex-col min-h-screen">
      <ProfileHeader />

      <main className="flex-1 py-10 sm:py-16">
        <div className="pf-container space-y-12">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[var(--pf-border)] pb-8">
            <div className="space-y-2 max-w-xl">
              <span className="pf-subheading">Career & Heritage Timeline</span>
              <h1 className="font-serif text-3xl sm:text-5xl font-bold text-[var(--pf-text-main)]">
                Experience & Milestones
              </h1>
              <p className="text-xs sm:text-sm text-[var(--pf-text-muted)] leading-relaxed">
                Seven decades of master curation, artisan guild leadership, retail floor expansion, and handloom preservation across Karnataka and South India.
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-2">
              {(['All', 'Current', 'Heritage'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setSelectedFilter(tab)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                    selectedFilter === tab
                      ? 'bg-[var(--pf-burgundy)] text-white shadow-xs'
                      : 'border border-[var(--pf-border)] bg-[var(--pf-bg-card)] text-[var(--pf-text-muted)] hover:text-[var(--pf-text-main)]'
                  }`}
                >
                  {tab === 'All' ? 'All Roles' : tab === 'Current' ? 'Active Roles' : 'Historic Milestones'}
                </button>
              ))}
            </div>
          </div>

          {/* Timeline View */}
          {loading ? (
            <div className="py-20 text-center text-xs text-[var(--pf-text-muted)]">
              Loading experience timeline...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center pf-card p-12 text-xs text-[var(--pf-text-muted)]">
              No milestones found matching the selected filter.
            </div>
          ) : (
            <div className="relative border-l-2 border-[var(--pf-gold-border)] ml-4 sm:ml-8 pl-6 sm:pl-10 space-y-12">
              {filtered.map((item, index) => (
                <div key={item.id} className="relative group">
                  {/* Timeline Dot */}
                  <div className="absolute -left-[31px] sm:-left-[47px] top-1.5 w-6 h-6 rounded-full bg-[var(--pf-bg)] border-2 border-[var(--pf-burgundy)] flex items-center justify-center shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-[var(--pf-gold)]" />
                  </div>

                  <div className="pf-card p-6 sm:p-8 space-y-6 hover:border-[var(--pf-gold-border)]">
                    {/* Top Row: Role & Dates */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-[var(--pf-border-soft)] pb-4">
                      <div className="space-y-1">
                        <span className="pf-badge-gold text-[10px] inline-block">{item.employment_type}</span>
                        <h3 className="font-serif text-xl sm:text-2xl font-bold text-[var(--pf-text-main)]">
                          {item.position}
                        </h3>
                        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-[var(--pf-gold)]">
                          <span>{item.company}</span>
                          <span>·</span>
                          <span className="flex items-center gap-1 text-[var(--pf-text-subtle)]">
                            <MapPin className="w-3.5 h-3.5" />
                            {item.location}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs font-mono font-bold px-3 py-1.5 rounded-lg bg-[var(--pf-bg-alt)] border border-[var(--pf-border)] text-[var(--pf-text-main)] self-start">
                        <Calendar className="w-3.5 h-3.5 text-[var(--pf-gold)]" />
                        <span>
                          {item.start_date} — {item.is_current ? 'Present' : item.end_date}
                        </span>
                      </div>
                    </div>

                    {/* Responsibilities */}
                    {item.responsibilities && item.responsibilities.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--pf-gold)]">
                          Key Responsibilities & Stewardship
                        </h4>
                        <ul className="space-y-2">
                          {item.responsibilities.map((resp, i) => (
                            <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-[var(--pf-text-muted)] leading-relaxed">
                              <CheckCircle2 className="w-4 h-4 text-[var(--pf-burgundy)] shrink-0 mt-0.5" />
                              <span>{resp}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Achievements */}
                    {item.achievements && item.achievements.length > 0 && (
                      <div className="space-y-2 bg-[var(--pf-bg-alt)] p-4 rounded-xl border border-[var(--pf-border-soft)]">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--pf-gold)] flex items-center gap-1.5">
                          <Award className="w-4 h-4" />
                          <span>Key Milestones & Honors</span>
                        </h4>
                        <ul className="space-y-1.5">
                          {item.achievements.map((ach, i) => (
                            <li key={i} className="text-xs sm:text-sm text-[var(--pf-text-main)] font-medium list-disc list-inside">
                              {ach}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Skills Used */}
                    {item.skills_used && item.skills_used.length > 0 && (
                      <div className="pt-2 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] uppercase font-bold text-[var(--pf-text-subtle)] mr-2">Skills Applied:</span>
                        {item.skills_used.map((skill, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 rounded-full bg-[var(--pf-bg-alt)] text-[11px] font-semibold text-[var(--pf-text-main)] border border-[var(--pf-border)]"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer CTA */}
          <div className="pt-8 text-center">
            <Link to="/skills" className="pf-btn-primary text-xs inline-flex">
              <span>View Skills & Craftsmanship</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>

      <ProfileFooter />
    </div>
  );
};

export default ProfileExperience;
