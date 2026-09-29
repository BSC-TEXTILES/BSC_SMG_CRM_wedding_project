import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Disable React DevTools in production
if (import.meta.env.PROD || process.env.NODE_ENV === 'production') {
  if (typeof window !== 'undefined') {
    (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ = { isDisabled: true };
  }
}

// Suppress benign third-party library errors
if (typeof window !== 'undefined') {
  const originalError = window.console.error;
  window.console.error = (...args) => {
    const message = args.join(' ');
    if (message.includes("Cannot read properties of undefined (reading 'startTime')") ||
        message.includes('startTime') && message.includes('reportAllChanges')) {
      return; // Suppress this specific benign error from devtools-detector
    }
    originalError.apply(window.console, args);
  };

  window.addEventListener('error', (event) => {
    if (event.message && event.message.includes("Cannot read properties of undefined (reading 'startTime')")) {
      event.preventDefault();
      return false;
    }
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && event.reason.message && event.reason.message.includes("Cannot read properties of undefined (reading 'startTime')")) {
      event.preventDefault();
      return false;
    }
  }, true);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Register high-performance asset caching service worker in production
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && (import.meta.env.PROD || process.env.NODE_ENV === 'production')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      console.log('[BSC ServiceWorker] Active with scope:', reg.scope);
    }).catch((err) => {
      console.warn('[BSC ServiceWorker] Registration failed:', err);
    });
  });
}