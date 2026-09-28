import React from 'react';
import { useCountUp, useReveal } from './hooks';

type RevealVariant = 'up' | 'fade' | 'left' | 'right' | 'scale' | 'clip' | 'mask';

interface RevealProps {
  children: React.ReactNode;
  as?: keyof JSX.IntrinsicElements;
  variant?: RevealVariant;
  delay?: number;
  duration?: number;
  className?: string;
  id?: string;
  style?: React.CSSProperties;
}

/** Single reveal primitive — every section uses a different variant on purpose. */
export function Reveal({
  children,
  as = 'div',
  variant = 'up',
  delay = 0,
  duration = 900,
  className = '',
  id,
  style
}: RevealProps) {
  const ref = useReveal<HTMLElement>(0.12);
  const Tag = as as React.ElementType;
  return (
    <Tag
      ref={ref as never}
      id={id}
      className={className}
      data-reveal={variant}
      style={{ ['--rv-delay']: `${delay}ms`, ['--rv-d']: `${duration}ms`, ...style }}
    >
      {children}
    </Tag>
  );
}

export interface HeadlineLine {
  text: string;
  accent?: boolean;
}

interface WordsProps {
  lines: (string | HeadlineLine)[];
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  delay?: number;
  stagger?: number;
  id?: string;
}

/**
 * Editorial headline reveal: each line sits inside an overflow mask and every
 * word rises into place with a tight stagger — the classic film-title wipe.
 */
export function Words({ lines, as = 'h1', className = '', delay = 0, stagger = 60, id }: WordsProps) {
  const ref = useReveal<HTMLElement>(0.2);
  const Tag = as as React.ElementType;
  let index = -1;

  return (
    <Tag
      ref={ref as never}
      id={id}
      className={`mw ${className}`}
      data-mw="root"
      style={{ ['--mw-base']: `${delay}ms`, ['--mw-step']: `${stagger}ms` }}
    >
      {lines.map((line, li) => {
        const parsed: HeadlineLine = typeof line === 'string' ? { text: line } : line;
        const words = parsed.text.split(' ').filter(Boolean);
        return (
          <span className="mw__line" key={li}>
            {words.map((w) => {
              index += 1;
              return (
                <span className="mw__mask" key={`${li}-${index}`}>
                  <span
                    className={`mw__word${parsed.accent ? ' is-accent' : ''}`}
                    style={{ ['--i']: index } as React.CSSProperties}
                  >
                    {w}
                  </span>
                  {'\u00A0'}
                </span>
              );
            })}
          </span>
        );
      })}
    </Tag>
  );
}

interface CounterProps {
  value: number;
  suffix?: string;
  className?: string;
}

export function Counter({ value, suffix = '', className = '' }: CounterProps) {
  const { ref, shown } = useCountUp(value);
  return (
    <span ref={ref} className={className}>
      {value > 0 ? shown.toLocaleString('en-IN') : '—'}
      {suffix}
    </span>
  );
}

/** Thin animated rule used as an editorial divider. */
export function Rule({ className = '', delay = 0 }: { className?: string; delay?: number }) {
  const ref = useReveal<HTMLSpanElement>(0.4);
  return (
    <span
      ref={ref}
      data-reveal="mask"
      className={`rule ${className}`}
      style={{ ['--rv-delay']: `${delay}ms` } as React.CSSProperties}
      aria-hidden="true"
    />
  );
}

/** Eyebrow / kicker label with a small marker dot. */
export function Eyebrow({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <Reveal as="p" variant="up" className={`eyebrow ${className}`}>
      <span className="eyebrow__dot" aria-hidden="true" />
      {children}
    </Reveal>
  );
}
