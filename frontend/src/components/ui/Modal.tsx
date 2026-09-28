import React from 'react';
import { X } from 'lucide-react';
import ModalPortal, { ModalPortalProps } from './ModalPortal';

export interface ModalProps extends Omit<ModalPortalProps, 'children'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full';
  showCloseButton?: boolean;
}

const maxWidthMap: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  full: 'max-w-[calc(100vw-2rem)]'
};

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  maxWidth = 'lg',
  showCloseButton = true,
  closeOnBackdropClick = true,
  closeOnEsc = true,
  className = '',
  containerClassName = '',
  zIndex = 1000,
  ariaLabel
}: ModalProps) {
  const modalAriaLabel = typeof title === 'string' ? title : ariaLabel || 'Modal Dialog';

  return (
    <ModalPortal
      isOpen={isOpen}
      onClose={onClose}
      closeOnBackdropClick={closeOnBackdropClick}
      closeOnEsc={closeOnEsc}
      className={className}
      containerClassName={containerClassName}
      zIndex={zIndex}
      ariaLabel={modalAriaLabel}
    >
      <div
        className={`bg-white rounded-3xl shadow-2xl ${maxWidthMap[maxWidth] || 'max-w-lg'} w-full overflow-hidden border border-accent/40 flex flex-col max-h-[92vh]`}
      >
        {/* Dark Maroon Brand Header */}
        {(title || showCloseButton) && (
          <div className="bg-primary text-white p-5 flex items-center justify-between border-b border-accent/30 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {icon && (
                <div className="w-10 h-10 rounded-xl bg-accent text-white font-black text-lg flex items-center justify-center shadow-md flex-shrink-0">
                  {icon}
                </div>
              )}
              <div className="min-w-0">
                {title && (
                  <h3 className="font-extrabold text-white text-base truncate">
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p className="text-xs text-accent font-medium truncate">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            {showCloseButton && onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all flex-shrink-0 ml-3"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs bg-background">
          {children}
        </div>

        {/* Optional Footer */}
        {footer && (
          <div className="p-4 bg-background border-t border-accent-soft flex items-center justify-end gap-2 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </ModalPortal>
  );
}
