import React, { useEffect, useRef, useState } from 'react';

/** True when the visitor has asked the OS/browser to reduce motion. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface RevealOptions {
  /** Fraction of the element that must be visible before revealing. */
  threshold?: number;
  /** Stagger in milliseconds, applied as an inline transition delay. */
  delay?: number;
}

/**
 * Scroll reveal used across the landing page.
 *
 * The element is rendered visible immediately when the visitor prefers reduced
 * motion, and also when IntersectionObserver is unavailable, so content can
 * never be stranded invisible by a failed animation.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>({
  threshold = 0.15,
  delay = 0
}: RevealOptions = {}) {
  const ref = useRef<T | null>(null);
  const [shown, setShown] = useState<boolean>(() => prefersReducedMotion());

  useEffect(() => {
    if (shown) return;
    const node = ref.current;
    if (!node) return;

    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
          }
        });
      },
      { threshold, rootMargin: '0px 0px -8% 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [shown, threshold]);

  return {
    ref,
    shown,
    style: delay ? { transitionDelay: `${delay}ms` } : undefined
  };
}

interface RevealProps extends RevealOptions {
  as?: 'div' | 'section' | 'li' | 'header' | 'footer';
  className?: string;
  children: React.ReactNode;
  id?: string;
  ariaLabelledby?: string;
}

/** Declarative wrapper so sections stay readable. */
export function Reveal({
  as: Tag = 'div',
  className = '',
  children,
  id,
  ariaLabelledby,
  threshold,
  delay
}: RevealProps) {
  const { ref, shown, style } = useReveal<HTMLDivElement>({ threshold, delay });
  return (
    <Tag
      id={id}
      ref={ref as never}
      aria-labelledby={ariaLabelledby}
      style={style}
      className={`bsc-reveal ${shown ? 'bsc-reveal-in' : ''} ${className}`}
    >
      {children}
    </Tag>
  );
}
