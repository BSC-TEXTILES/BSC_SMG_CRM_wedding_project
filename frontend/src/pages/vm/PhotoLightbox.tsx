import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCw,
  ImageOff,
  HardDrive,
  Cloud
} from 'lucide-react';
import { formatBytes, formatPhotoDate, photoLabel, type LightboxPhotoItem } from './photoUtils';

/**
 * PhotoLightbox — full-size inspection photo for the VM Checklist.
 *
 * Sizing rules that matter on a shop-floor handset: the overlay owns its scroll
 * (`overflow-auto` + `overscroll-contain`) and the page behind it is locked, so a
 * zoomed photo can be panned without dragging the whole checklist with it and
 * without ever producing horizontal page scroll.
 *
 * Keyboard: Escape closes, ←/→ step through the section, +/- zoom, 0 resets.
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
  const viewportRef = useRef<HTMLDivElement | null>(null);

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
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, goPrev, goNext, zoomIn, zoomOut, resetView]);

  // Wheel zoom needs a real (non-passive) listener so the gesture does not also
  // scroll the page; React's synthetic onWheel is registered passive.
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`VM inspection photo ${position} of ${total}`}
      className="fixed inset-0 z-[120] flex flex-col bg-black/92 backdrop-blur-sm animate-fade-in"
    >
      {/* Header: counter + close */}
      <div className="flex items-center justify-between gap-3 px-3 sm:px-5 py-3 border-b border-white/10 bg-black/60 shrink-0">
        <div className="min-w-0">
          <p className="text-[13px] font-black tracking-wide text-white truncate">
            Photo #{position} of {total}
          </p>
          <p className="text-[11px] font-semibold text-white/60 truncate">
            {current.floor} — {current.section}
            {current.pointId ? ' · question evidence' : ' · section shot'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close photo viewer"
          title="Close (Esc)"
          className="w-11 h-11 shrink-0 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Viewport — the only scrollable region */}
      <div
        ref={viewportRef}
        className="relative flex-1 overflow-auto overscroll-contain"
        onClick={() => onClose()}
      >
        <div className="min-h-full w-full flex items-center justify-center p-3 sm:p-6">
          {failed ? (
            <div
              onClick={(event) => event.stopPropagation()}
              className="max-w-md w-full mx-auto rounded-2xl bg-neutral-900 border border-white/15 p-6 text-center space-y-3"
            >
              <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/20 text-rose-300 flex items-center justify-center">
                <ImageOff className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-black text-white">Photo could not be displayed</h4>
              <p className="text-xs text-white/70 leading-relaxed">
                {current.local
                  ? 'This on-device preview is no longer available. Re-take or re-select the photo.'
                  : `The stored image "${current.fileName}" could not be read from the server. Check your connection, or remove and re-upload the photo.`}
              </p>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setFailed(false);
                }}
                className="mt-1 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Try again
              </button>
            </div>
          ) : (
            <img
              key={`${current.id}-${displayUrl}`}
              src={displayUrl}
              alt={`${current.fileName} — ${current.floor} ${current.section}`}
              onError={() => setFailed(true)}
              onClick={(event) => {
                event.stopPropagation();
                if (zoom > 1) resetView();
                else zoomIn();
              }}
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: 'center center'
              }}
              className={`max-w-full rounded-xl shadow-2xl transition-transform duration-200 ${
                zoom > 1 ? 'cursor-zoom-out max-h-none' : 'cursor-zoom-in max-h-[70vh]'
              } object-contain`}
              draggable={false}
            />
          )}
        </div>

        {/* Prev / next float over the viewport, never over the image centre */}
        {canNavigate && (
          <>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                goPrev();
              }}
              aria-label="Previous photo"
              title="Previous (←)"
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/15 flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                goNext();
              }}
              aria-label="Next photo"
              title="Next (→)"
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/15 flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {/* Zoom / rotate controls */}
      <div
        className="flex items-center justify-center gap-2 px-3 py-2.5 border-t border-white/10 bg-black/60 shrink-0 flex-wrap"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={zoomOut}
          disabled={zoom <= MIN_ZOOM}
          aria-label="Zoom out"
          title="Zoom out (-)"
          className="w-11 h-11 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-35 disabled:hover:bg-white/10 text-white flex items-center justify-center transition-colors cursor-pointer"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="min-w-[3.75rem] text-center text-[11px] font-black text-white/80 tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={zoomIn}
          disabled={zoom >= MAX_ZOOM}
          aria-label="Zoom in"
          title="Zoom in (+)"
          className="w-11 h-11 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-35 disabled:hover:bg-white/10 text-white flex items-center justify-center transition-colors cursor-pointer"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => setRotation((prev) => (prev + 90) % 360)}
          aria-label="Rotate photo"
          title="Rotate 90°"
          className="w-11 h-11 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
        >
          <RotateCw className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={resetView}
          aria-label="Reset zoom and rotation"
          title="Reset (0)"
          className="h-11 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Maximize2 className="w-4 h-4" />
          <span>Fit</span>
        </button>
      </div>

      {/* Metadata + thumbnails */}
      <div
        className="px-3 sm:px-5 py-3 bg-black/70 border-t border-white/10 shrink-0"
        onClick={(event) => event.stopPropagation()}
      >
        {canNavigate && (
          <div className="flex gap-2 overflow-x-auto overscroll-x-contain pb-3">
            {safeItems.map((item, itemIndex) => (
              <button
                key={`${item.id}_${itemIndex}`}
                type="button"
                onClick={() => setIndex(itemIndex)}
                aria-label={`Show photo ${itemIndex + 1}`}
                aria-current={itemIndex === index}
                className={`shrink-0 w-14 h-14 xs:w-16 xs:h-16 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                  itemIndex === index
                    ? 'border-accent opacity-100'
                    : 'border-white/20 opacity-60 hover:opacity-90'
                }`}
              >
                <img
                  src={item.url}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(event) => {
                    (event.currentTarget as HTMLImageElement).style.opacity = '0.25';
                  }}
                />
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-white/70 font-semibold">
          <span className="inline-flex items-center gap-1.5 text-white">
            {current.local ? (
              <HardDrive className="w-3.5 h-3.5 text-amber-300" />
            ) : (
              <Cloud className="w-3.5 h-3.5 text-emerald-300" />
            )}
            <span className="truncate max-w-[12rem] sm:max-w-xs">{current.fileName}</span>
          </span>
          <span>{formatBytes(current.fileSize)}</span>
          <span>{photoLabel(current)}</span>
          {current.uploadedBy && <span>By {current.uploadedBy}</span>}
          {formatPhotoDate(current.inspectionDate) && <span>Audit date {formatPhotoDate(current.inspectionDate)}</span>}
          {current.local && (
            <span className="text-amber-300 font-bold">On this device — not uploaded yet</span>
          )}
        </div>
      </div>
    </div>
  );
}
