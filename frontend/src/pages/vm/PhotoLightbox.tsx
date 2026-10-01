import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ImageOff,
  Download,
  Calendar,
  User,
  MapPin,
  CheckCircle2,
  Layers,
  HardDrive,
  Cloud,
  Maximize2,
  Loader2,
  Store
} from 'lucide-react';
import { formatBytes, formatPhotoDate, type LightboxPhotoItem } from './photoUtils';

/**
 * PhotoLightbox — Elegant Modal Viewer for Visual Merchandising Inspection Evidence.
 *
 * Polished to BSC Textiles aesthetic:
 *   • Subtle darkened backdrop with background page visible behind
 *   • Constrained luxury modal dialog card (85-90% viewport width, 75-85% height on desktop)
 *   • Initial open is always "Fit to View" (complete image visible, no forced 100%+ zoom)
 *   • Original aspect ratio preserved without stretching or improper cropping
 *   • Clearly visible top-right close button [ X ], never overlapped by the photo
 *   • Smooth zoom controls: Fit to View → 125% → 150% → 200% → 300%
 *   • Drag-to-pan when zoomed in; zero unnecessary panning at Fit to View
 *   • Smooth previous / next navigation with zoom reset between photos
 *   • Full metadata: Section, Floor, Store Location, Inspection Date, Inspector, File Size
 *   • Click backdrop outside to close; clicking image does NOT close
 *   • ESC key to close; arrow keys to navigate; clean loading & error fallback states
 *   • Scroll-lock on body while open, clean release on unmount
 */

export interface PhotoLightboxProps {
  /** Ordered exactly as the gallery grid shows them. */
  items: LightboxPhotoItem[];
  startIndex?: number;
  onClose: () => void;
}

const ZOOM_STEPS = [1, 1.25, 1.5, 2, 3];
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

export default function PhotoLightbox({ items, startIndex = 0, onClose }: PhotoLightboxProps) {
  const safeItems = useMemo(() => (Array.isArray(items) ? items.filter(Boolean) : []), [items]);
  const total = safeItems.length;

  const [index, setIndex] = useState<number>(() => {
    const requested = Math.floor(Number(startIndex) || 0);
    if (!Array.isArray(items) || items.length === 0) return 0;
    return Math.min(Math.max(requested, 0), items.length - 1);
  });

  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [loading, setLoading] = useState<boolean>(true);
  const [failed, setFailed] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageStageRef = useRef<HTMLDivElement | null>(null);

  const current = safeItems[Math.min(index, Math.max(total - 1, 0))] ?? null;

  // Reset viewing parameters when switching photos
  const resetView = useCallback(() => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
    setIsDragging(false);
  }, []);

  const goPrev = useCallback(() => {
    resetView();
    setIndex((prev) => (total <= 1 ? 0 : prev <= 0 ? total - 1 : prev - 1));
  }, [total, resetView]);

  const goNext = useCallback(() => {
    resetView();
    setIndex((prev) => (total <= 1 ? 0 : prev >= total - 1 ? 0 : prev + 1));
  }, [total, resetView]);

  const zoomIn = useCallback(() => {
    setZoom((prev) => {
      const nextStep = ZOOM_STEPS.find((step) => step > prev + 0.05);
      return nextStep ?? MAX_ZOOM;
    });
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((prev) => {
      const lower = [...ZOOM_STEPS].reverse().find((step) => step < prev - 0.05);
      const target = lower ?? MIN_ZOOM;
      if (target <= 1) setPan({ x: 0, y: 0 });
      return target;
    });
  }, []);

  const rotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  // Every photo switch: resets zoom, rotation, pan, error state and marks loading
  useEffect(() => {
    resetView();
    setFailed(false);
    setLoading(true);
  }, [index, resetView]);

  // Lock page scrolling while the modal is open; restore on unmount
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;

    // Prevent content jump when scrollbar disappears
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, []);

  // Keyboard navigation & controls
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrev();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goNext();
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        zoomIn();
      } else if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        zoomOut();
      } else if (event.key === '0') {
        event.preventDefault();
        resetView();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, goPrev, goNext, zoomIn, zoomOut, resetView]);

  // Mouse drag-to-pan when zoomed in
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoom <= 1) return;
    e.preventDefault();
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (total === 0 || !current) return null;

  const position = Math.min(index + 1, total);
  const displayUrl = current.url;
  const canNavigate = total > 1;

  const isQuestionEvidence = Boolean(current.pointId);
  const displayLocation = `${current.floor || 'Floor'} → ${current.section || 'Section'}`;
  const storeDisplay = current.locationName || (current.locationId === 1 ? 'Belagavi' : current.locationId === 2 ? 'Davanagere' : current.locationId === 3 ? 'Shivamogga' : null);
  const downloadFileName = current.fileName || `vm-inspection-${current.floor}-${current.section}.jpg`;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={`BSC Textiles VM Inspection Photo ${position} of ${total}`}
      onClick={(e) => {
        // Clicking the subtle backdrop overlay outside the modal dialog closes it
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[120] flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-[#0E070C]/80 backdrop-blur-sm animate-fade-in select-none"
    >
      {/* ── Constrained Modal Dialog Card ───────────────────────────────────── */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl max-h-[94vh] sm:max-h-[90vh] bg-[#170E16] text-[#FAF6F0] border border-[#C9A45C]/30 rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden"
      >
        {/* ── Top Header ──────────────────────────────────────────────────────── */}
        <header className="relative z-20 flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 bg-[#20121D] border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* Index Counter Pill */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-[#C9A45C]/25 to-[#123C35]/40 border border-[#C9A45C]/40 text-[#FAF6F0] text-xs font-black tracking-wide shrink-0">
              <span>{position}</span>
              <span className="text-[#C9A45C]">/</span>
              <span>{total}</span>
            </div>

            {/* Context & Location Badges */}
            <div className="min-w-0 flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-black text-white tracking-tight truncate hidden md:inline">
                BSC Textiles — VM Inspection Photo
              </span>

              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 border border-white/10 text-xs font-bold text-white truncate">
                <MapPin className="w-3.5 h-3.5 text-[#E4CB92] shrink-0" />
                <span className="truncate">{displayLocation}</span>
              </div>

              {storeDisplay && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#123C35]/60 border border-[#C9A45C]/30 text-xs font-bold text-[#FAF6F0] truncate">
                  <Store className="w-3.5 h-3.5 text-[#E4CB92] shrink-0" />
                  <span className="truncate">{storeDisplay}</span>
                </div>
              )}

              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                  isQuestionEvidence
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-200'
                    : 'bg-[#C9A45C]/20 border-[#C9A45C]/40 text-[#F5E6E8]'
                }`}
              >
                {isQuestionEvidence ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-amber-300 shrink-0" />
                    <span className="hidden sm:inline">Checkpoint Evidence</span>
                  </>
                ) : (
                  <>
                    <Layers className="w-3 h-3 text-[#E4CB92] shrink-0" />
                    <span className="hidden sm:inline">Section Shot</span>
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Action icons: Download + Close [ X ] */}
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={displayUrl}
              download={downloadFileName}
              target="_blank"
              rel="noreferrer"
              title="Download photo"
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-[#C9A45C]/30 text-white border border-white/10 hover:border-[#C9A45C]/50 flex items-center justify-center transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
            >
              <Download className="w-4 h-4" />
            </a>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close photo viewer"
              title="Close (Esc)"
              className="w-9 h-9 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 border border-rose-500/35 flex items-center justify-center transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* ── Image Viewing Stage ─────────────────────────────────────────────── */}
        <div
          ref={imageStageRef}
          onClick={(e) => {
            // Clicking the padding outside the photo closes the modal safely
            if (e.target === e.currentTarget) {
              onClose();
            }
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`relative flex-1 min-h-[260px] max-h-[58vh] sm:max-h-[64vh] md:max-h-[68vh] bg-[#11080F] flex items-center justify-center overflow-hidden p-3 sm:p-5 select-none ${
            zoom > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
          }`}
        >
          {/* Loading indicator */}
          {loading && !failed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70 bg-[#11080F]/60 backdrop-blur-xs z-10">
              <Loader2 className="w-8 h-8 text-[#C9A45C] animate-spin" />
              <p className="text-xs font-bold text-[#E4CB92]">Loading photo...</p>
            </div>
          )}

          {/* Error fallback state */}
          {failed ? (
            <div className="max-w-md w-full mx-auto rounded-2xl bg-[#1c1219]/90 border border-rose-500/30 p-6 text-center space-y-3 shadow-xl backdrop-blur-md">
              <div className="w-12 h-12 mx-auto rounded-xl bg-rose-500/20 text-rose-300 flex items-center justify-center ring-4 ring-rose-500/10">
                <ImageOff className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-black text-white">Unable to load this photo</h4>
                <p className="text-xs text-white/70 leading-relaxed mt-1">
                  The inspection photo could not be retrieved from the server.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFailed(false);
                  setLoading(true);
                }}
                className="mt-1 px-4 py-2 rounded-xl bg-[#C9A45C] hover:bg-[#a55e69] text-white text-xs font-black transition-all cursor-pointer shadow-md"
              >
                Retry Loading
              </button>
            </div>
          ) : (
            <div
              className="relative max-w-full max-h-full flex items-center justify-center transition-transform duration-150 ease-out"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: 'center center'
              }}
              onClick={(e) => {
                // Clicking directly on the image must NOT close the viewer
                e.stopPropagation();
              }}
            >
              <img
                key={`${current.id}-${displayUrl}`}
                src={displayUrl}
                alt={`${current.floor} ${current.section} visual inspection`}
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setFailed(true);
                }}
                className="max-w-full max-h-[54vh] sm:max-h-[60vh] md:max-h-[64vh] object-contain rounded-xl shadow-2xl border border-white/10 select-none pointer-events-auto"
                draggable={false}
              />
            </div>
          )}

          {/* Floating Left / Right Navigation Controls */}
          {canNavigate && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goPrev();
                }}
                aria-label="Previous photo"
                title="Previous Photo (← Arrow)"
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#180f16]/85 hover:bg-[#C9A45C] text-white border border-white/20 hover:border-[#C9A45C] backdrop-blur-md flex items-center justify-center transition-all shadow-xl hover:scale-110 active:scale-95 cursor-pointer z-10"
              >
                <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goNext();
                }}
                aria-label="Next photo"
                title="Next Photo (→ Arrow)"
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#180f16]/85 hover:bg-[#C9A45C] text-white border border-white/20 hover:border-[#C9A45C] backdrop-blur-md flex items-center justify-center transition-all shadow-xl hover:scale-110 active:scale-95 cursor-pointer z-10"
              >
                <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </>
          )}
        </div>

        {/* ── Zoom & View Controls Toolbar ────────────────────────────────────── */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="px-4 py-2 bg-[#1B0F19] border-t border-white/10 flex items-center justify-center gap-1.5 sm:gap-2 shrink-0 flex-wrap"
        >
          <button
            type="button"
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Zoom out"
            title="Zoom out (-)"
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={resetView}
            title="Reset to Fit to View (0)"
            className={`min-w-[5.5rem] px-3 py-1 rounded-lg text-center text-[11px] font-black tracking-wide border transition-all cursor-pointer ${
              zoom === 1
                ? 'bg-[#C9A45C]/20 border-[#C9A45C]/50 text-[#FAF6F0]'
                : 'bg-white/10 border-white/15 text-white hover:bg-white/20'
            }`}
          >
            {zoom === 1 ? 'Fit to View' : `${Math.round(zoom * 100)}%`}
          </button>

          <button
            type="button"
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Zoom in"
            title="Zoom in (+)"
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-white/20 mx-1" />

          <button
            type="button"
            onClick={rotate}
            aria-label="Rotate photo clockwise"
            title="Rotate 90° Clockwise"
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={resetView}
            aria-label="Reset zoom and rotation"
            title="Fit to View (0)"
            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5 text-[#E4CB92]" />
            <span>Reset</span>
          </button>

          {zoom > 1 && (
            <span className="text-[10px] text-white/50 ml-1 font-medium hidden sm:inline">
              (Drag photo to pan)
            </span>
          )}
        </div>

        {/* ── Bottom Drawer: Thumbnails Strip + Rich Metadata ─────────────────── */}
        <footer
          onClick={(e) => e.stopPropagation()}
          className="px-4 sm:px-6 py-3 bg-[#1F121C] border-t border-white/10 shrink-0"
        >
          {/* Thumbnails row when multiple photos */}
          {canNavigate && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2.5 mb-2 border-b border-white/10 scrollbar-thin scrollbar-thumb-white/20">
              {safeItems.map((item, itemIndex) => {
                const isSelected = itemIndex === index;
                return (
                  <button
                    key={`${item.id}_${itemIndex}`}
                    type="button"
                    onClick={() => {
                      resetView();
                      setIndex(itemIndex);
                    }}
                    aria-label={`Jump to photo ${itemIndex + 1}`}
                    aria-current={isSelected}
                    className={`shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden border-2 transition-all cursor-pointer relative ${
                      isSelected
                        ? 'border-[#C9A45C] ring-2 ring-[#C9A45C]/60 scale-105 shadow-md shadow-[#C9A45C]/30'
                        : 'border-white/15 opacity-60 hover:opacity-100 hover:border-white/40'
                    }`}
                  >
                    <img
                      src={item.url}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(event) => {
                        (event.currentTarget as HTMLImageElement).style.opacity = '0.3';
                      }}
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-[#C9A45C]/20 pointer-events-none" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Clean Metadata Badges Row */}
          <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3 text-[11px]">
            <div className="flex flex-wrap items-center gap-2 text-white/80 font-medium">
              {/* Storage status badge */}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white font-semibold">
                {current.local ? (
                  <>
                    <HardDrive className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <span className="text-amber-200">Device Draft</span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-emerald-200">Cloud Synced</span>
                  </>
                )}
              </span>

              {/* Section & Floor */}
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/90">
                <span className="text-white/50">Section:</span>
                <span className="font-bold text-white">{current.section}</span>
              </span>

              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/90">
                <span className="text-white/50">Floor:</span>
                <span className="font-bold text-white">{current.floor}</span>
              </span>

              {storeDisplay && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/90">
                  <span className="text-white/50">Store:</span>
                  <span className="font-bold text-white">{storeDisplay}</span>
                </span>
              )}

              {/* Auditor */}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/90">
                <User className="w-3.5 h-3.5 text-[#E4CB92]" />
                <span className="text-white/50">Inspector:</span>
                <span className="font-bold text-white">{current.uploadedBy || 'Store Auditor'}</span>
              </span>

              {/* Audit Date */}
              {current.inspectionDate && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/90">
                  <Calendar className="w-3.5 h-3.5 text-[#E4CB92]" />
                  <span className="text-white/50">Date:</span>
                  <span className="font-bold text-white">{formatPhotoDate(current.inspectionDate)}</span>
                </span>
              )}

              {/* File size */}
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/90">
                <span className="text-white/50">Size:</span>
                <span className="font-bold">{formatBytes(current.fileSize)}</span>
              </span>
            </div>

            {/* Quick Keyboard shortcuts hint */}
            <div className="hidden lg:flex items-center gap-2 text-[10px] text-white/40 font-mono">
              <span>← / → Nav</span>
              <span>•</span>
              <span>+ / - Zoom</span>
              <span>•</span>
              <span>0 Fit</span>
              <span>•</span>
              <span>Esc Close</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
