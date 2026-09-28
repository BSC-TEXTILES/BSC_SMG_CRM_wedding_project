import React, { useState, useEffect } from 'react';
import { ProfileHeader } from '../components/ProfileHeader';
import { ProfileFooter } from '../components/ProfileFooter';
import { GalleryLightboxModal } from '../components/GalleryLightboxModal';
import { ProfileApi } from '../api';
import { GalleryItem } from '../types';
import { Eye, Image as ImageIcon } from 'lucide-react';

export const ProfileGallery: React.FC = () => {
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null);

  useEffect(() => {
    document.title = 'Media Gallery & Showroom Floor — BSC Textiles';

    async function loadData() {
      try {
        const data = await ProfileApi.getGallery();
        setGallery(data || []);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const categories = ['All', ...Array.from(new Set(gallery.map(g => g.category).filter(Boolean)))];

  const filtered = activeCategory === 'All'
    ? gallery
    : gallery.filter(g => g.category === activeCategory);

  return (
    <div className="flex flex-col min-h-screen">
      <ProfileHeader />

      <main className="flex-1 py-10 sm:py-16">
        <div className="pf-container space-y-12">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[var(--pf-border)] pb-8">
            <div className="space-y-3 max-w-2xl">
              <span className="pf-subheading">Visual Archives</span>
              <h1 className="font-serif text-3xl sm:text-5xl font-bold text-[var(--pf-text-main)]">
                Media & Showroom Gallery
              </h1>
              <p className="text-xs sm:text-sm text-[var(--pf-text-muted)] leading-relaxed">
                Photographic glimpses of authentic Mulberry Kanjeevarams, master tailoring lounges, teakwood counter floors, and precious customer moments across Belagavi, Davanagere, and Shivamogga.
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

          {/* Media Grid */}
          {loading ? (
            <div className="py-20 text-center text-xs text-[var(--pf-text-muted)]">
              Loading media gallery...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center pf-card p-12 text-xs text-[var(--pf-text-muted)]">
              No media items found in this collection.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map(item => (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className="pf-card group overflow-hidden cursor-pointer flex flex-col justify-between hover:border-[var(--pf-gold-border)]"
                >
                  {/* Visual container with aspect ratio */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--pf-bg-alt)]">
                    <img
                      src={item.media_url}
                      alt={item.title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />

                    {/* Tag badge */}
                    <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-xs text-white text-[9px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full">
                      {item.category}
                    </div>

                    {/* Hover Inspect Icon */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="p-3 rounded-full bg-white/90 text-[var(--pf-burgundy)] shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform">
                        <Eye className="w-5 h-5" />
                      </div>
                    </div>
                  </div>

                  {/* Caption & title */}
                  <div className="p-4 space-y-1">
                    <h3 className="font-serif text-sm sm:text-base font-bold text-[var(--pf-text-main)] group-hover:text-[var(--pf-burgundy)] transition-colors">
                      {item.title}
                    </h3>
                    {item.caption && (
                      <p className="text-[11px] text-[var(--pf-text-muted)] line-clamp-2 leading-relaxed">
                        {item.caption}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <ProfileFooter />

      {/* Lightbox modal */}
      <GalleryLightboxModal
        item={selectedItem}
        items={filtered}
        onClose={() => setSelectedItem(null)}
        onSelect={item => setSelectedItem(item)}
      />
    </div>
  );
};

export default ProfileGallery;
