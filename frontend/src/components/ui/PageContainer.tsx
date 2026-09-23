import React from 'react';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'full' | '7xl' | '6xl' | '5xl' | '4xl';
}

/**
 * Global Standard PageContainer:
 * Ensures strict responsive padding:
 * - Desktop: px-6 py-6 (or px-8 py-6)
 * - Tablet: px-5 py-5
 * - Mobile: px-3.5 py-4
 * Guarantees min-w-0, w-full, no horizontal scroll, and centered max-width.
 */
export default function PageContainer({
  children,
  className = '',
  maxWidth = '7xl'
}: PageContainerProps) {
  const maxWidthClasses = {
    full: 'max-w-full',
    '7xl': 'max-w-7xl',
    '6xl': 'max-w-6xl',
    '5xl': 'max-w-5xl',
    '4xl': 'max-w-4xl'
  };

  return (
    <div
      className={`w-full min-w-0 mx-auto px-3.5 sm:px-5 lg:px-6 xl:px-8 py-4 sm:py-5 lg:py-6 space-y-5 sm:space-y-6 ${
        maxWidthClasses[maxWidth]
      } ${className}`}
    >
      {children}
    </div>
  );
}
