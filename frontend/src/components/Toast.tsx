import React, { useState, useEffect } from 'react';
import { CircleCheck, CircleAlert, Info, AlertTriangle, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warn';
}

let toastListener: ((toast: ToastMessage) => void) | null = null;

export const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warn' = 'info') => {
  if (toastListener) {
    toastListener({
      id: Math.random().toString(),
      message,
      type
    });
  }
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    toastListener = (newToast) => {
      setToasts(prev => [...prev, newToast]);
      // Duration: success 4.5s, error 6s, warn 5s, info 4s
      const duration = newToast.type === 'error' ? 6000
        : newToast.type === 'warn' ? 5000
        : newToast.type === 'success' ? 4500
        : 4000;
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== newToast.id));
      }, duration);
    };
    return () => {
      toastListener = null;
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 pointer-events-none" style={{ maxWidth: '420px', width: '100%' }}>
      {toasts.map(t => {
        const bgMap: Record<string, string> = {
          success: 'bg-emerald-800 text-white border-emerald-600',
          error: 'bg-red-800 text-white border-red-600',
          warn: 'bg-amber-700 text-white border-amber-500',
          info: 'bg-slate-800 text-white border-slate-600'
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
            className={`pointer-events-auto flex items-start justify-between p-3.5 rounded-xl border shadow-2xl ${bgMap[t.type] || bgMap.info}`}
            style={{
              animation: 'toastSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
              fontSize: '13px',
              lineHeight: '1.4',
            }}
          >
            <div className="flex items-start gap-2.5">
              <Icon className="w-[18px] h-[18px] flex-shrink-0 mt-0.5" />
              <span className="font-semibold">{t.message}</span>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="p-1 hover:opacity-75 transition-opacity flex-shrink-0 ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(100px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

