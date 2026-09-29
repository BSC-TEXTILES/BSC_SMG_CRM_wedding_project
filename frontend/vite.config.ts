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
