import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const API_TARGET = process.env.VITE_API_URL || 'http://localhost:5000';

/**
 * When the API server is not running, the proxy used to hand the browser a bare
 * 500 with no body, so an offline backend looked exactly like a broken endpoint —
 * fifteen "Server error. Please try again or contact your administrator" lines and
 * no way to tell the two apart. This reports the actual cause instead.
 */
function reportProxyFailure(name: string) {
  return (proxy: { on(event: string, cb: (...a: any[]) => void): void }) => {
    proxy.on('error', (err: any, req: any, res: any) => {
      const code = err?.code || 'PROXY_ERROR';
      const target = `${API_TARGET}${(req?.url as string) || ''}`;
      console.warn(`[vite proxy] ${name} -> ${target} unreachable (${code}). Is the backend running?`);
      if (res && typeof res.writeHead === 'function' && !res.headersSent) {
        const body = JSON.stringify({
          success: false,
          message: `The ${name} server at ${API_TARGET} is not reachable (${code}). Start the backend and reload.`,
          errors: [code],
          backendOffline: true
        });
        res.writeHead(503, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
        res.end(body);
      } else if (res && typeof res.destroy === 'function') {
        res.destroy();
      }
    });
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        configure: reportProxyFailure('API'),
      },
      '/uploads': {
        target: API_TARGET,
        changeOrigin: true,
        configure: reportProxyFailure('upload'),
      },
      '/socket.io': {
        target: API_TARGET,
        changeOrigin: true,
        ws: true,
        configure: reportProxyFailure('realtime'),
      }
    }
  },
  build: {
    target: 'es2022',
    // Split heavy vendor libraries so business code updates don't invalidate
    // the whole cache, and the browser can download them in parallel.
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['recharts'],
          'vendor-icons': ['lucide-react'],
          'vendor-xlsx': ['xlsx'],
          'vendor-three': ['three'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  // esbuild 0.28 cannot lower parameter destructuring to Vite 5's legacy default
  // targets, which breaks both dev pre-bundling and the production transpile pass.
  optimizeDeps: {
    esbuildOptions: { target: 'es2022' },
  },
  esbuild: {
    target: 'es2022',
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
});
