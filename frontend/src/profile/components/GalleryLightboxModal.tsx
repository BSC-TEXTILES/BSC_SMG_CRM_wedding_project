import React from 'react';
import { GalleryItem } from '../types';
import { X, ChevronLeft, ChevronRight, Tag } from 'lucide-react';

interface GalleryLightboxModalProps {
  item: GalleryItem | null;
  items: GalleryItem[];
  onClose: () => void;
  onSelect: (item: GalleryItem) => void;
}

export const GalleryLightboxModal: React.FC<GalleryLightboxModalProps> = ({
  item,
  items,
  onClose,
  onSelect
}) => {
  if (!item) return null;

  const currentIndex = items.findIndex(i => i.id === item.id);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    const prev = (currentIndex - 1 + items.length) % items.length;
    onSelect(items[prev]);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = (currentIndex + 1) % items.length;
    onSelect(items[next]);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-in fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        aria-label="Close lightbox"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Prev button */}
      {items.length > 1 && (
        <button
          onClick={handlePrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors hidden sm:block"
          aria-label="Previous image"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Next button */}
      {items.length > 1 && (
        <button
          onClick={handleNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors hidden sm:block"
          aria-label="Next image"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Image container */}
      <div
        className="relative max-w-5xl w-full max-h-[88vh] flex flex-col items-center justify-center"
        onClick={e => e.stopPropagation()}
      >
        <div className="relative max-h-[70vh] w-auto overflow-hidden rounded-xl shadow-2xl">
          <img
            src={item.media_url}
            alt={item.title}
            className="max-h-[70vh] w-auto object-contain mx-auto"
          />
        </div>

        {/* Caption bar */}
        <div className="mt-4 p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 text-white max-w-2xl w-full text-center space-y-1">
          <div className="flex items-center justify-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-[var(--pf-gold)] text-white">
              {item.category}
            </span>
            <span className="text-xs text-white/70">
              {currentIndex + 1} of {items.length}
            </span>
          </div>
          <h3 className="font-serif text-base sm:text-lg font-bold">{item.title}</h3>
          {item.caption && <p className="text-xs text-white/80">{item.caption}</p>}
        </div>
      </div>
    </div>
  );
};

export default GalleryLightboxModal;
