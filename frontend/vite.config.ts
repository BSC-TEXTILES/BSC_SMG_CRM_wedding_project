import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

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
        target: process.env.VITE_API_URL || 'http://localhost:5000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            const authHeader = req.headers.authorization;
            if (authHeader) {
              console.log('[Vite Proxy] Forwarding Authorization header:', authHeader.substring(0, 30) + '...');
            } else {
              console.log('[Vite Proxy] No Authorization header in request to:', req.url);
            }
          });
        },
      },
      '/uploads': {
        target: process.env.VITE_API_URL || 'http://localhost:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: process.env.VITE_API_URL || 'http://localhost:5000',
        changeOrigin: true,
        ws: true,
      }
    }
  },
  build: {
    // Split heavy vendor libraries so business code updates don't invalidate
    // the whole cache, and the browser can download them in parallel.
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['recharts'],
          'vendor-icons': ['lucide-react'],
          'vendor-xlsx': ['xlsx'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
});
