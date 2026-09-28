import React, { createContext, useContext } from 'react';

export const PageContainerContext = createContext<boolean>(false);

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'full' | '7xl' | '6xl' | '5xl' | '4xl';
}

/**
 * Global Standard PageContainer:
 * Standardized spacing system across the BSC Portal:
 * - Desktop (lg, xl, 2xl): px-6 py-6 (24px)
 * - Tablet (sm, md): px-5 py-5 (20px)
 * - Mobile: px-4 py-4 (16px)
 *
 * Guarantees w-full, min-w-0, max-w-full, box-border.
 * Aligns perfectly with Topbar Title & Breadcrumb margins.
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
    full: 'w-full max-w-full',
    '7xl': 'w-full max-w-7xl',
    '6xl': 'w-full max-w-6xl',
    '5xl': 'w-full max-w-5xl',
    '4xl': 'w-full max-w-4xl'
  };

  return (
    <PageContainerContext.Provider value={true}>
      <div
        className={`w-full min-w-0 max-w-full box-border px-4 sm:px-5 lg:px-6 py-4 sm:py-5 lg:py-6 space-y-5 sm:space-y-6 ${
          maxWidthClasses[maxWidth] || 'w-full max-w-full'
        } ${className}`}
      >
        {children}
      </div>
    </PageContainerContext.Provider>
  );
}
