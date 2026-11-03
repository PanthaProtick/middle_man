/// <reference types="vitest" />
import react from '@vitejs/plugin-react'
import process from 'node:process'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Deployment tier differs from Vite's optimized build mode. Expose only this
  // public platform label, never the backend environment or other process values.
  define: { 'import.meta.env.VERCEL_ENV': JSON.stringify(process.env.VERCEL_ENV ?? '') },
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, '/');
          if (normalized.includes('clerk') || normalized.includes('@clerk')) {
            return 'clerk';
          }
          if (normalized.includes('lucide-react')) {
            return 'icons';
          }
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 5000,
  },
})
