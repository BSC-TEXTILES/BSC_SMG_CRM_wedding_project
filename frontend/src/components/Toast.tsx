import React, { useState, useEffect, useRef } from 'react';
import { CircleCheck, CircleAlert, Info, AlertTriangle, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warn';
}

type ToastListener = (toast: ToastMessage) => void;
const listeners = new Set<ToastListener>();
let activeContainerInstanceId: string | null = null;

/**
 * Sanitize raw backend, SQL, or database error traces into clear, professional messages.
 */
function sanitizeMessage(message: string, type: 'success' | 'error' | 'info' | 'warn'): string {
  if (!message || typeof message !== 'string') {
    return type === 'success' ? 'Saved successfully.' : 'Unable to complete the operation. Please try again.';
  }

  const trimmed = message.trim();

  // If message contains SQL or database error patterns
  if (/ER_DUP_ENTRY|Duplicate entry/i.test(trimmed)) {
    return 'A record with this information already exists in the system.';
  }
  if (/foreign key constraint fails|ER_NO_REFERENCED_ROW/i.test(trimmed)) {
    return 'The referenced record is not available or has been modified. Please verify and try again.';
  }
  if (/SQL|syntax error|Unknown column|SELECT\s+|INSERT\s+|UPDATE\s+|DELETE\s+|ER_/i.test(trimmed)) {
    return 'Something went wrong while saving the information. Please try again or contact system support.';
  }

  return trimmed;
}

export const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warn' = 'info') => {
  const cleanMessage = sanitizeMessage(message, type);
  const toast: ToastMessage = {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    message: cleanMessage,
    type
  };

  listeners.forEach(listener => {
    try {
      listener(toast);
    } catch (e) {
      console.warn('[Toast Dispatch Error]', e);
    }
  });
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const instanceIdRef = useRef<string>(Math.random().toString(36).substring(2, 9));
  const isPrimaryRef = useRef<boolean>(false);

  useEffect(() => {
    // Primary container election: only one container renders at a time
    if (!activeContainerInstanceId) {
      activeContainerInstanceId = instanceIdRef.current;
      isPrimaryRef.current = true;
    } else if (activeContainerInstanceId === instanceIdRef.current) {
      isPrimaryRef.current = true;
    }

    const handler: ToastListener = (newToast) => {
      // Only the active primary container renders toasts
      if (!isPrimaryRef.current && activeContainerInstanceId !== instanceIdRef.current) {
        return;
      }

      setToasts(prev => {
        // Prevent instant identical duplicates within 1 second
        if (prev.some(t => t.message === newToast.message && t.type === newToast.type)) {
          return prev;
        }
        return [...prev, newToast];
      });

      // Duration: success 4.5s, error 6s, warn 5s, info 4s
      const duration = newToast.type === 'error' ? 6000
        : newToast.type === 'warn' ? 5000
        : newToast.type === 'success' ? 4500
        : 4000;

      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== newToast.id));
      }, duration);
    };

    listeners.add(handler);

    return () => {
      listeners.delete(handler);
      if (activeContainerInstanceId === instanceIdRef.current) {
        activeContainerInstanceId = null;
      }
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // If not primary container or no toasts, render nothing
  if (!isPrimaryRef.current && activeContainerInstanceId && activeContainerInstanceId !== instanceIdRef.current) {
    return null;
  }

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[99999] flex flex-col gap-2.5 pointer-events-none"
      style={{ maxWidth: '440px', width: 'calc(100vw - 32px)' }}
    >
      {toasts.map(t => {
        const bgMap: Record<string, string> = {
          success: 'bg-[#103E2B] text-white border-[#107044] shadow-emerald-950/40',
          error: 'bg-[#5C161E] text-white border-[#A12333] shadow-rose-950/40',
          warn: 'bg-[#593907] text-white border-[#A66C0F] shadow-amber-950/40',
          info: 'bg-[#101C36] text-white border-[#C9A45C] shadow-slate-950/40'
        };

        const iconMap: Record<string, any> = {
          success: CircleCheck,
          error: CircleAlert,
          warn: AlertTriangle,
          info: Info
        };

        const Icon = iconMap[t.type] || Info;

        return (
          <div
            key={t.id}
            role="alert"
            className={`pointer-events-auto flex items-start justify-between p-3.5 sm:p-4 rounded-2xl border shadow-2xl backdrop-blur-md ${bgMap[t.type] || bgMap.info}`}
            style={{
              animation: 'toastSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
              fontSize: '13px',
              lineHeight: '1.45'
            }}
          >
            <div className="flex items-start gap-3">
              <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex flex-col">
                <span className="font-bold tracking-tight">{t.message}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0 ml-3 cursor-pointer"
              title="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(120px) scale(0.95); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

