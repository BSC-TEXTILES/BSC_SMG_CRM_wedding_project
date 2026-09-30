import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Global counter for safe nested/multiple modal scroll locking
let activeModalCount = 0;
let previousBodyOverflow = '';

export function lockBodyScroll() {
  if (typeof document === 'undefined') return;
  if (activeModalCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  activeModalCount++;
}

export function unlockBodyScroll() {
  if (typeof document === 'undefined') return;
  activeModalCount = Math.max(0, activeModalCount - 1);
  if (activeModalCount === 0) {
    document.body.style.overflow = previousBodyOverflow || '';
  }
}

/**
 * Safety valve: force-resets all body scroll locks.
 * Call on route changes to prevent stale overflow:hidden from
 * unmounted modals leaving the page stuck.
 */
export function forceResetBodyScroll() {
  if (typeof document === 'undefined') return;
  activeModalCount = 0;
  document.body.style.overflow = '';
  previousBodyOverflow = '';
}

// Safety: clear scroll lock on page unload to prevent stuck state
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (activeModalCount > 0) forceResetBodyScroll();
  });
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'details > summary',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

function getFocusable(card: HTMLElement): HTMLElement[] {
  return Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.getClientRects().length > 0 && el.getAttribute('aria-hidden') !== 'true'
  );
}

export interface ModalPortalProps {
  isOpen: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  closeOnBackdropClick?: boolean;
  closeOnEsc?: boolean;
  className?: string;
  containerClassName?: string;
  zIndex?: number;
  ariaLabel?: string;
}

export default function ModalPortal({
  isOpen,
  onClose,
  children,
  closeOnBackdropClick = true,
  closeOnEsc = true,
  className = '',
  containerClassName = '',
  zIndex = 1000,
  ariaLabel = 'Modal Dialog'
}: ModalPortalProps) {
  const [mounted, setMounted] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  // Latest-value refs. The open/close effect below deliberately depends ONLY on
  // `isOpen`: parents routinely pass inline `onClose={() => ...}` callbacks, and
  // putting those in the dependency array made the effect tear down and re-run on
  // every parent re-render. Its cleanup restored focus to the element that had
  // opened the modal — so every keystroke in a controlled input re-rendered the
  // parent, yanked focus out of the field, and made the form impossible to type
  // into. Callbacks are therefore read through refs instead.
  const onCloseRef = useRef(onClose);
  const closeOnEscRef = useRef(closeOnEsc);
  const closeOnBackdropRef = useRef(closeOnBackdropClick);

  useEffect(() => { onCloseRef.current = onClose; });
  useEffect(() => { closeOnEscRef.current = closeOnEsc; });
  useEffect(() => { closeOnBackdropRef.current = closeOnBackdropClick; });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    // Capture the element that had focus before opening
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      previouslyFocusedElementRef.current = document.activeElement;
    }

    lockBodyScroll();

    // Move focus into the dialog so keyboard and screen-reader users start
    // inside it. Children that manage their own focus win (checked first).
    const focusFrame = window.requestAnimationFrame(() => {
      const card = cardRef.current;
      if (card && !card.contains(document.activeElement)) {
        card.focus();
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscRef.current) {
        e.preventDefault();
        onCloseRef.current?.();
        return;
      }

      if (e.key !== 'Tab') return;

      const card = cardRef.current;
      if (!card) return;

      const focusable = getFocusable(card);
      if (focusable.length === 0) {
        e.preventDefault();
        card.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (!active || !card.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', handleKeyDown);
      unlockBodyScroll();
      // Restore focus on close
      const prev = previouslyFocusedElementRef.current;
      if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
        try {
          prev.focus();
        } catch {
          // Ignore focus restore errors
        }
      }
    };
  }, [isOpen]);

  if (!mounted || !isOpen || typeof document === 'undefined') {
    return null;
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && closeOnBackdropRef.current && onCloseRef.current) {
      onCloseRef.current();
    }
  };

  return createPortal(
    <div
      ref={backdropRef}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={handleBackdropClick}
      style={{ zIndex }}
      className={`bsc-modal-backdrop ${className}`}
    >
      <div
        ref={cardRef}
        tabIndex={-1}
        style={{ zIndex: zIndex + 100 }}
        className={`bsc-modal-card w-full flex justify-center pointer-events-auto outline-none ${containerClassName}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
