import React, { useState, useEffect, useRef, memo } from 'react';
import { AssetManager } from '../../utils/assetManager';

export interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  width?: number | string;
  height?: number | string;
  aspectRatio?: string;
  priority?: boolean;
  placeholderColor?: string;
  rootMargin?: string;
  className?: string;
  containerClassName?: string;
}

export const LazyImage: React.FC<LazyImageProps> = memo(({
  src,
  alt,
  width,
  height,
  aspectRatio,
  priority = false,
  placeholderColor = 'bg-[#1C1510]/5',
  rootMargin = '300px',
  className = '',
  containerClassName = '',
  style,
  ...rest
}) => {
  // Check if image is already cached in memory
  const alreadyCached = AssetManager.isImageCached(src);
  const [isInView, setIsInView] = useState(priority || alreadyCached);
  const [isLoaded, setIsLoaded] = useState(alreadyCached);
  const [hasError, setHasError] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (priority || alreadyCached || isInView) return;

    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin,
        threshold: 0.01
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [priority, alreadyCached, isInView, rootMargin]);

  // Load through centralized AssetManager when in view
  useEffect(() => {
    if (!isInView || isLoaded || hasError) return;

    AssetManager.loadImage(src)
      .then(() => {
        setIsLoaded(true);
      })
      .catch(() => {
        setHasError(true);
      });
  }, [isInView, isLoaded, hasError, src]);

  // Calculate container aspect ratio or explicit style
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    ...(aspectRatio ? { aspectRatio } : {}),
    ...(width && !aspectRatio ? { width: typeof width === 'number' ? `${width}px` : width } : {}),
    ...(height && !aspectRatio ? { height: typeof height === 'number' ? `${height}px` : height } : {}),
    ...style
  };

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden select-none ${containerClassName}`}
      style={containerStyle}
    >
      {/* Subtle luxury placeholder (visible only while loading and not yet cached) */}
      {!isLoaded && !hasError && (
        <div
          className={`absolute inset-0 ${placeholderColor} animate-pulse pointer-events-none transition-opacity duration-500`}
          aria-hidden="true"
        />
      )}

      {/* Fallback state on error */}
      {hasError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[#FAF7F2] text-[#8B776A] text-[11px] p-2 text-center border border-[#E8DFC8]">
          <span className="font-serif italic">BSC Textiles</span>
        </div>
      ) : isInView ? (
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          onLoad={() => {
            AssetManager.markImageLoaded(src);
            setIsLoaded(true);
          }}
          onError={() => setHasError(true)}
          className={`w-full h-full object-cover transition-opacity duration-500 ease-out ${
            isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-[1.01]'
          } ${className}`}
          {...rest}
        />
      ) : null}
    </div>
  );
});

LazyImage.displayName = 'LazyImage';
