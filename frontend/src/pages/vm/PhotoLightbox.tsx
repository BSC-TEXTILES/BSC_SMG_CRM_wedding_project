import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCw,
  ImageOff,
  HardDrive,
  Cloud,
  Download,
  Calendar,
  User,
  MapPin,
  Sparkles,
  CheckCircle2,
  Layers
} from 'lucide-react';
import { formatBytes, formatPhotoDate, photoLabel, type LightboxPhotoItem } from './photoUtils';

/**
 * PhotoLightbox — Luxury Full-Screen Inspection Studio for Visual Merchandising.
 *
 * Polished to BSC Textiles aesthetic:
 *   • Obsidian & Plum glassmorphism backdrop with subtle ambient glow
 *   • Clean location & evidence badges (never exposed raw file hashes as headers)
 *   • Floating pill toolbar with zoom, rotation, fit & download actions
 *   • Interactive thumbnail carousel with active gold ring
 *   • Keyboard control: Escape, Arrow Left/Right, +/-, 0
 *   • Scroll and touch containment to prevent background bleed
 */

export interface PhotoLightboxProps {
  /** Ordered exactly as the gallery grid shows them, so the numbers agree. */
  items: LightboxPhotoItem[];
  startIndex?: number;
  onClose: () => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

const clampZoom = (value: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100));

const ZOOM_STEPS = [1, 1.5, 2, 3, 4];

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
  const [failed, setFailed] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const current = safeItems[Math.min(index, Math.max(total - 1, 0))] ?? null;

  const goPrev = useCallback(() => {
    setIndex((prev) => (total <= 1 ? 0 : prev <= 0 ? total - 1 : prev - 1));
  }, [total]);

  const goNext = useCallback(() => {
    setIndex((prev) => (total <= 1 ? 0 : prev >= total - 1 ? 0 : prev + 1));
  }, [total]);

  const zoomIn = useCallback(() => {
    setZoom((prev) => {
      const nextStep = ZOOM_STEPS.find((step) => step > prev);
      return clampZoom(nextStep ?? MAX_ZOOM);
    });
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((prev) => {
      const lower = [...ZOOM_STEPS].reverse().find((step) => step < prev);
      return clampZoom(lower ?? MIN_ZOOM);
    });
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setRotation(0);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Every photo starts at 1x — otherwise a zoomed shot bleeds into the next one.
  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setFailed(false);
    if (viewportRef.current) {
      viewportRef.current.scrollTop = 0;
      viewportRef.current.scrollLeft = 0;
    }
  }, [index]);

  // Lock the page behind the overlay for its lifetime, then hand the scroll back.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
    };
  }, []);

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
      } else if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, goPrev, goNext, zoomIn, zoomOut, resetView, toggleFullscreen]);

  // Wheel zoom
  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.deltaY < 0) zoomIn();
      else zoomOut();
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [zoomIn, zoomOut]);

  if (total === 0 || !current) return null;

  const position = Math.min(index + 1, total);
  const displayUrl = current.url;
  const canNavigate = total > 1;

  // Clean title for display (avoids ugly technical hash names)
  const isQuestionEvidence = Boolean(current.pointId);
  const displayLocation = `${current.floor || 'Floor'} — ${current.section || 'Section'}`;
  const downloadFileName = current.fileName || `vm-inspection-${current.floor}-${current.section}.jpg`;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={`VM inspection photo ${position} of ${total}`}
      className="fixed inset-0 z-[120] flex flex-col bg-[#0b070a]/95 text-white backdrop-blur-xl animate-fade-in select-none"
    >
      {/* Subtle ambient lighting orb */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(183,110,121,0.09)_0%,rgba(74,23,58,0.04)_45%,transparent_75%)]" />

      {/* ── Top Header Navigation Bar ────────────────────────────────────────── */}
      <header className="relative z-20 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-[#150d14]/90 backdrop-blur-md border-b border-white/10 shrink-0 shadow-lg">
        <div className="flex items-center gap-3 min-w-0">
          {/* Index Counter Pill */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-[#B76E79]/25 to-[#4A173A]/40 border border-[#B76E79]/40 text-[#FAF6F0] text-xs font-black tracking-wide shrink-0">
            <span>{position}</span>
            <span className="text-[#B76E79]">/</span>
            <span>{total}</span>
          </div>

          {/* Location & Context Badges */}
          <div className="min-w-0 flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 border border-white/10 text-xs font-bold text-white truncate">
              <MapPin className="w-3.5 h-3.5 text-[#E8C7A8] shrink-0" />
              <span className="truncate">{displayLocation}</span>
            </div>

            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                isQuestionEvidence
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-200'
                  : 'bg-[#B76E79]/20 border-[#B76E79]/40 text-[#F5E6E8]'
              }`}
            >
              {isQuestionEvidence ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-amber-300" />
                  <span>Question Evidence</span>
                </>
              ) : (
                <>
                  <Layers className="w-3 h-3 text-[#E8C7A8]" />
                  <span>Section Overview</span>
                </>
              )}
            </span>
          </div>
        </div>

        {/* Right Action Icons: Download, Fullscreen, Close */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Direct Download Button */}
          <a
            href={displayUrl}
            download={downloadFileName}
            target="_blank"
            rel="noreferrer"
            title="Download full-resolution photo"
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-[#B76E79]/30 text-white border border-white/10 hover:border-[#B76E79]/50 flex items-center justify-center transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
          >
            <Download className="w-4 h-4" />
          </a>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit full screen (F)' : 'Enter full screen (F)'}
            className="hidden sm:flex w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/10 flex items-center justify-center transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close photo viewer"
            title="Close (Esc)"
            className="w-10 h-10 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 border border-rose-500/30 flex items-center justify-center transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95 ml-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ── Viewport Stage (Only scrollable container) ───────────────────────── */}
      <div
        ref={viewportRef}
        className="relative flex-1 overflow-auto overscroll-contain flex items-center justify-center p-4 sm:p-8"
        onClick={() => onClose()}
      >
        <div className="min-h-full w-full flex items-center justify-center">
          {failed ? (
            <div
              onClick={(event) => event.stopPropagation()}
              className="max-w-md w-full mx-auto rounded-3xl bg-[#1c1219]/90 border border-rose-500/30 p-8 text-center space-y-4 shadow-2xl backdrop-blur-xl"
            >
              <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/20 text-rose-300 flex items-center justify-center ring-8 ring-rose-500/10">
                <ImageOff className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-base font-black text-white">Photo Display Unavailable</h4>
                <p className="text-xs text-white/70 leading-relaxed mt-1.5">
                  {current.local
                    ? 'This on-device preview is no longer available. Re-capture or select the photo again.'
                    : `The stored inspection photo could not be retrieved from the server.`}
                </p>
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setFailed(false);
                }}
                className="mt-2 px-5 py-2.5 rounded-xl bg-[#B76E79] hover:bg-[#a55e69] text-white text-xs font-black transition-all cursor-pointer shadow-lg hover:shadow-[#B76E79]/25 hover:scale-105"
              >
                Retry Loading
              </button>
            </div>
          ) : (
            <div
              onClick={(event) => event.stopPropagation()}
              className="relative inline-flex items-center justify-center transition-transform duration-300 ease-out"
            >
              <img
                key={`${current.id}-${displayUrl}`}
                src={displayUrl}
                alt={`${current.floor} ${current.section} visual inspection`}
                onError={() => setFailed(true)}
                onClick={() => {
                  if (zoom > 1) resetView();
                  else zoomIn();
                }}
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transformOrigin: 'center center'
                }}
                className={`max-w-full rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] border border-white/10 transition-transform duration-200 select-none ${
                  zoom > 1 ? 'cursor-zoom-out max-h-none' : 'cursor-zoom-in max-h-[68vh]'
                } object-contain`}
                draggable={false}
              />
            </div>
          )}
        </div>

        {/* Floating Left / Right Navigation Controls */}
        {canNavigate && (
          <>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                goPrev();
              }}
              aria-label="Previous photo"
              title="Previous Photo (← Arrow)"
              className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-[#180f16]/80 hover:bg-[#B76E79]/60 text-white border border-white/15 hover:border-[#B76E79] backdrop-blur-md flex items-center justify-center transition-all shadow-2xl hover:scale-110 active:scale-95 cursor-pointer z-10"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                goNext();
              }}
              aria-label="Next photo"
              title="Next Photo (→ Arrow)"
              className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-[#180f16]/80 hover:bg-[#B76E79]/60 text-white border border-white/15 hover:border-[#B76E79] backdrop-blur-md flex items-center justify-center transition-all shadow-2xl hover:scale-110 active:scale-95 cursor-pointer z-10"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </div>

      {/* ── Modern Floating Zoom / Rotate Capsule Toolbar ───────────────────── */}
      <div
        className="absolute bottom-28 sm:bottom-28 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-[#150d14]/90 backdrop-blur-xl border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={zoomOut}
          disabled={zoom <= MIN_ZOOM}
          aria-label="Zoom out"
          title="Zoom out (-)"
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10 text-white flex items-center justify-center transition-colors cursor-pointer"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={resetView}
          title="Reset zoom to 100% (0)"
          className="min-w-[3.5rem] px-2 py-1 rounded-full text-center text-[11px] font-black text-[#FAF6F0] hover:bg-white/10 transition-colors cursor-pointer tabular-nums"
        >
          {Math.round(zoom * 100)}%
        </button>

        <button
          type="button"
          onClick={zoomIn}
          disabled={zoom >= MAX_ZOOM}
          aria-label="Zoom in"
          title="Zoom in (+)"
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10 text-white flex items-center justify-center transition-colors cursor-pointer"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-white/20 mx-0.5" />

        <button
          type="button"
          onClick={() => setRotation((prev) => (prev + 90) % 360)}
          aria-label="Rotate photo clockwise"
          title="Rotate 90° Clockwise"
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
        >
          <RotateCw className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={resetView}
          aria-label="Reset zoom and rotation"
          title="Reset view (0)"
          className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
        >
          <Maximize2 className="w-3.5 h-3.5 text-[#E8C7A8]" />
          <span>Fit</span>
        </button>
      </div>

      {/* ── Bottom Drawer: Thumbnails Strip + Rich Metadata ─────────────────── */}
      <footer
        className="relative z-20 px-4 sm:px-6 py-3 bg-[#130b12]/95 backdrop-blur-xl border-t border-white/10 shrink-0 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Thumbnails row when multiple photos */}
        {canNavigate && (
          <div className="flex items-center gap-2.5 overflow-x-auto overscroll-x-contain pb-2.5 scrollbar-thin scrollbar-thumb-white/20">
            {safeItems.map((item, itemIndex) => {
              const isSelected = itemIndex === index;
              return (
                <button
                  key={`${item.id}_${itemIndex}`}
                  type="button"
                  onClick={() => setIndex(itemIndex)}
                  aria-label={`Jump to photo ${itemIndex + 1}`}
                  aria-current={isSelected}
                  className={`shrink-0 w-13 h-13 sm:w-15 sm:h-15 rounded-xl overflow-hidden border-2 transition-all cursor-pointer relative ${
                    isSelected
                      ? 'border-[#B76E79] ring-2 ring-[#B76E79]/60 scale-105 shadow-md shadow-[#B76E79]/30'
                      : 'border-white/15 opacity-55 hover:opacity-90 hover:border-white/40'
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
                    <div className="absolute inset-0 bg-[#B76E79]/15 pointer-events-none" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Clean Metadata Badges Row */}
        <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4 pt-1 text-[11px]">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-white/80 font-medium">
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

            {/* File size */}
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/90">
              <span className="text-white/50">Size:</span>
              <span className="font-bold">{formatBytes(current.fileSize)}</span>
            </span>

            {/* Auditor */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/90">
              <User className="w-3.5 h-3.5 text-[#E8C7A8]" />
              <span className="text-white/50">Inspector:</span>
              <span className="font-bold text-white">{current.uploadedBy || 'Store Auditor'}</span>
            </span>

            {/* Audit Date */}
            {current.inspectionDate && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/90">
                <Calendar className="w-3.5 h-3.5 text-[#E8C7A8]" />
                <span className="text-white/50">Date:</span>
                <span className="font-bold text-white">{formatPhotoDate(current.inspectionDate)}</span>
              </span>
            )}
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
  );
}
