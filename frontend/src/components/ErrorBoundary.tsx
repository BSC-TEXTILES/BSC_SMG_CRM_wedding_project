import React from 'react';
import { OctagonAlert, RefreshCw } from 'lucide-react';

/**
 * ErrorBoundary
 * ─────────────
 * Last line of defence for the React tree. A rendering error anywhere in the
 * app now shows a calm, professional recovery screen instead of a white page.
 *
 * Deployments also swap code-split chunk hashes on every release; if a user
 * with an open tab requests a stale chunk the router throws a ChunkLoadError.
 * We detect that case and reload the page automatically (once per session)
 * so the update applies silently.
 */

interface State {
  hasError: boolean;
  chunkReloadAttempted: boolean;
  error?: Error | null;
  errorInfo?: any;
  showDetails?: boolean;
}

const CHUNK_RELOAD_KEY = 'bsc_chunk_reload';

export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, chunkReloadAttempted: false, error: null, errorInfo: null, showDetails: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    const isChunkError =
      /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk|Failed to fetch dynamically imported/i.test(
        String(error && (error.message || error))
      );
    if (isChunkError && !sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
      // New deployment: refresh once so the browser picks up the new hashes
      sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
      window.location.reload();
      return;
    }
    console.error('[ErrorBoundary Caught]', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReload = () => {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    window.location.reload();
  };

  handleClearCacheAndReload = () => {
    try {
      sessionStorage.clear();
      localStorage.removeItem(CHUNK_RELOAD_KEY);
      localStorage.removeItem('bsc_shield_bypass');
    } catch (e) {}
    window.location.href = '/login';
  };

  handleGoHome = () => {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || 'An unexpected rendering error occurred';
      const errorStack = this.state.error?.stack || '';

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white rounded-3xl shadow-2xl border border-accent-soft p-6 sm:p-8 text-center animate-fade-in">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mb-5 shadow-xs">
              <OctagonAlert className="w-8 h-8 text-[#C0392B]" strokeWidth={1.75} />
            </div>
            <h2 className="text-xl font-black text-primary tracking-tight mb-2">Something went wrong</h2>
            <p className="text-xs text-primary font-medium leading-relaxed mb-5">
              An unexpected error interrupted this page. Your data is safe —
              reloading the application or navigating back usually resolves the issue.
            </p>

            <div className="flex flex-col gap-2.5 mb-5">
              <button
                onClick={this.handleReload}
                className="w-full py-2.5 px-4 rounded-xl bg-primary text-white font-extrabold text-xs tracking-wide hover:bg-primary-hover active:scale-[0.99] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Application</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={this.handleGoHome}
                  className="py-2.5 px-3 rounded-xl bg-white border border-accent text-primary font-extrabold text-xs hover:bg-gray-50 active:scale-[0.99] transition-all shadow-xs cursor-pointer"
                >
                  Go to Dashboard
                </button>
                <button
                  onClick={this.handleClearCacheAndReload}
                  className="py-2.5 px-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-extrabold text-xs hover:bg-rose-100 active:scale-[0.99] transition-all shadow-xs cursor-pointer"
                >
                  Clear Cache &amp; Re-login
                </button>
              </div>
            </div>

            {/* Expandable Error Diagnostics */}
            <div className="mt-4 pt-4 border-t border-gray-100 text-left">
              <button
                type="button"
                onClick={() => this.setState({ showDetails: !this.state.showDetails })}
                className="text-[11px] font-bold text-gray-500 hover:text-primary transition-colors flex items-center justify-between w-full cursor-pointer"
              >
                <span>Error Diagnostics</span>
                <span>{this.state.showDetails ? '▲ Hide' : '▼ Show Details'}</span>
              </button>

              {this.state.showDetails && (
                <div className="mt-2.5 p-3 rounded-xl bg-gray-900 text-emerald-400 font-mono text-[10px] overflow-x-auto max-h-52 leading-relaxed">
                  <div className="text-rose-400 font-bold mb-1">{errorMsg}</div>
                  <pre className="whitespace-pre-wrap text-gray-400">{errorStack}</pre>
                </div>
              )}
            </div>

            <p className="text-[10px] text-primary/60 font-semibold mt-4">
              If this keeps happening, please contact your System Administrator.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
