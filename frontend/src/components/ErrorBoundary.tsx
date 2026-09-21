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
}

const CHUNK_RELOAD_KEY = 'bsc_chunk_reload';

export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, chunkReloadAttempted: false };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    const isChunkError =
      /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(
        String(error && (error.message || error))
      );
    if (isChunkError && !sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
      // New deployment: refresh once so the browser picks up the new hashes
      sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
      window.location.reload();
      return;
    }
    console.error('[ErrorBoundary]', error);
  }

  handleReload = () => {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-accent-soft p-8 text-center animate-fade-in">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mb-5">
              <OctagonAlert className="w-8 h-8 text-[#C0392B]" strokeWidth={1.75} />
            </div>
            <h2 className="text-xl font-black text-primary tracking-tight mb-2">Something went wrong</h2>
            <p className="text-xs text-primary font-medium leading-relaxed mb-6">
              An unexpected error interrupted this page. Your data is safe —
              reloading the application usually resolves the issue.
            </p>
            <button
              onClick={this.handleReload}
              className="w-full py-3 px-4 rounded-xl bg-primary text-white font-extrabold text-xs tracking-wide hover:bg-primary-hover active:scale-[0.99] transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload Application</span>
            </button>
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
