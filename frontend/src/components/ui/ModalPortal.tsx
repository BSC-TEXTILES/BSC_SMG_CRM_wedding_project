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
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

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

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEsc && onClose) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      unlockBodyScroll();
      // Restore focus on close
      if (previouslyFocusedElementRef.current) {
        try {
          previouslyFocusedElementRef.current.focus();
        } catch {
          // Ignore focus restore errors
        }
      }
    };
  }, [isOpen, closeOnEsc, onClose]);

  if (!mounted || !isOpen || typeof document === 'undefined') {
    return null;
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && closeOnBackdropClick && onClose) {
      onClose();
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
        style={{ zIndex: zIndex + 100 }}
        className={`bsc-modal-card w-full flex justify-center pointer-events-auto ${containerClassName}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
