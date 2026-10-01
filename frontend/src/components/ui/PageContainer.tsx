import React, { createContext, useContext } from 'react';

export const PageContainerContext = createContext<boolean>(false);

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'full' | '7xl' | '6xl' | '5xl' | '4xl';
}

/**
 * Global Executive PageContainer:
 * Standardized spacing and alignment system across the BSC Portal:
 * - Desktop (lg, xl, 2xl): px-8 py-8 (32px)
 * - Tablet (sm, md): px-6 py-6 (24px)
 * - Mobile: px-4 py-4 (16px)
 * - Max Width: 1600px centered (mx-auto)
 *
 * Horizontally aligns with Topbar Title & Breadcrumbs strip.
 * Protects against nested double-padding via PageContainerContext.
 */
export default function PageContainer({
  children,
  className = '',
  maxWidth = 'full'
}: PageContainerProps) {
  const isNested = useContext(PageContainerContext);

  if (isNested) {
    // Nested container: strip outer padding/margin to prevent duplicate offsets
    return (
      <div className={`w-full min-w-0 box-border space-y-5 sm:space-y-6 ${className}`}>
        {children}
      </div>
    );
  }

  const maxWidthClasses = {
    full: 'w-full max-w-[1600px] mx-auto',
    '7xl': 'w-full max-w-7xl mx-auto',
    '6xl': 'w-full max-w-6xl mx-auto',
    '5xl': 'w-full max-w-5xl mx-auto',
    '4xl': 'w-full max-w-4xl mx-auto'
  };

  return (
    <PageContainerContext.Provider value={true}>
      <div
        className={`w-full min-w-0 box-border px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 space-y-5 sm:space-y-6 ${
          maxWidthClasses[maxWidth] || 'w-full max-w-[1600px] mx-auto'
        } ${className}`}
      >
        {children}
      </div>
    </PageContainerContext.Provider>
  );
}
