import React, { useState, useEffect, useMemo } from 'react';
import { ProfileHeader } from '../components/ProfileHeader';
import { ProfileFooter } from '../components/ProfileFooter';
import { ProjectDetailModal } from '../components/ProjectDetailModal';
import { ProfileApi } from '../api';
import { ProjectItem } from '../types';
import { Search, ArrowRight } from 'lucide-react';

export const ProfileProjects: React.FC = () => {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState<'featured' | 'newest' | 'title'>('featured');
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);

  useEffect(() => {
    document.title = 'Portfolio Showcase & Historic Weaves — BSC Textiles';

    async function loadData() {
      try {
        const data = await ProfileApi.getProjects();
        setProjects(data || []);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const categories = useMemo(() => {
    const list = ['All', ...Array.from(new Set(projects.map(p => p.category).filter(Boolean)))];
    return list;
  }, [projects]);

  // Debounced search & filter
  const filteredProjects = useMemo(() => {
    let result = [...projects];

    if (selectedCategory !== 'All') {
      result = result.filter(p => p.category?.toLowerCase() === selectedCategory.toLowerCase());
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.short_description.toLowerCase().includes(q) ||
        p.client_name?.toLowerCase().includes(q) ||
        p.technologies?.some(t => t.toLowerCase().includes(q))
      );
    }

    if (sortBy === 'featured') {
      result.sort((a, b) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0));
    } else if (sortBy === 'newest') {
      result.sort((a, b) => (b.id || 0) - (a.id || 0));
    } else if (sortBy === 'title') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    }

    return result;
  }, [projects, selectedCategory, searchQuery, sortBy]);

  return (
    <div className="flex flex-col min-h-screen">
      <ProfileHeader />

      <main className="flex-1 py-10 sm:py-16">
        <div className="pf-container space-y-10">
          {/* Header */}
          <div className="space-y-3 max-w-2xl border-b border-[var(--pf-border)] pb-8">
            <span className="pf-subheading">Portfolio & Archival Weaves</span>
            <h1 className="font-serif text-3xl sm:text-5xl font-bold text-[var(--pf-text-main)]">
              Curated Masterworks & Projects
            </h1>
            <p className="text-xs sm:text-sm text-[var(--pf-text-muted)] leading-relaxed">
              Explore royal bridal trousseaus, historic pit-loom revivals, flagship showroom architecture, and bespoke suiting commissions curated across our lineage.
            </p>
          </div>

          {/* Search, Filter & Sort Controls */}
          <div className="pf-card p-4 sm:p-5 flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Category pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? 'bg-[var(--pf-burgundy)] text-white shadow-xs'
                      : 'border border-[var(--pf-border)] bg-[var(--pf-bg-alt)] text-[var(--pf-text-muted)] hover:text-[var(--pf-text-main)]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Search and Sort */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 sm:w-60">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--pf-text-subtle)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search weaves, silks..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg-alt)] text-xs text-[var(--pf-text-main)] placeholder-[var(--pf-text-subtle)] focus:outline-none focus:border-[var(--pf-gold)]"
                />
              </div>

              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="px-3 py-1.5 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg-alt)] text-xs font-semibold text-[var(--pf-text-main)] focus:outline-none focus:border-[var(--pf-gold)]"
              >
                <option value="featured">Sort: Featured</option>
                <option value="newest">Sort: Newest</option>
                <option value="title">Sort: Title</option>
              </select>
            </div>
          </div>

          {/* Projects Grid */}
          {loading ? (
            <div className="py-20 text-center text-xs text-[var(--pf-text-muted)]">
              Loading projects and archival case studies...
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="py-20 text-center pf-card p-12 space-y-3">
              <p className="font-serif text-lg font-bold text-[var(--pf-text-main)]">No projects found</p>
              <p className="text-xs text-[var(--pf-text-muted)]">
                Try changing your search terms or category selection.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredProjects.map(project => (
                <div
                  key={project.id}
                  onClick={() => setSelectedProject(project)}
                  className="pf-card group overflow-hidden cursor-pointer flex flex-col justify-between hover:border-[var(--pf-gold-border)]"
                >
                  <div>
                    {/* Cover Visual */}
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-[var(--pf-bg-alt)]">
                      <img
                        src={project.cover_image}
                        alt={project.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-xs text-white text-[9px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full">
                        {project.category}
                      </div>
                      {project.is_featured && (
                        <div className="absolute top-3 right-3 bg-[var(--pf-gold)] text-white text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full shadow-xs">
                          Signature
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-5 sm:p-6 space-y-3">
                      <h3 className="font-serif text-lg font-bold text-[var(--pf-text-main)] group-hover:text-[var(--pf-burgundy)] transition-colors">
                        {project.title}
                      </h3>
                      <p className="text-xs text-[var(--pf-text-muted)] line-clamp-3 leading-relaxed">
                        {project.short_description}
                      </p>

                      {/* Materials tags */}
                      {project.technologies && (
                        <div className="flex flex-wrap gap-1 pt-2">
                          {project.technologies.slice(0, 3).map((tech, i) => (
                            <span
                              key={i}
                              className="text-[10px] px-2 py-0.5 rounded bg-[var(--pf-bg-alt)] border border-[var(--pf-border-soft)] text-[var(--pf-text-subtle)] font-medium"
                            >
                              {tech}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div className="p-5 sm:p-6 pt-0 border-t border-[var(--pf-border-soft)] mt-4 flex items-center justify-between text-xs font-bold text-[var(--pf-gold)]">
                    <span>View Case Study</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <ProfileFooter />

      <ProjectDetailModal
        project={selectedProject}
        onClose={() => setSelectedProject(null)}
      />
    </div>
  );
};

export default ProfileProjects;
