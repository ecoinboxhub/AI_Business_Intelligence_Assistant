import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub repo: https://github.com/ecoinboxhub/AI_Business_Intelligence_Assistant
const REPO_BASE = '/AI_Business_Intelligence_Assistant/';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Sets base path matching GitHub repository name for Pages hosting.
  // Production builds get the sub-path; local dev stays at root.
  base: mode === 'production' ? REPO_BASE : '/',
  server: {
    port: 3030,
    strictPort: true,
  },
  build: {
    // The largest chunk is the vendored recharts library, split out for caching.
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          charts: ['recharts'],
          icons: ['lucide-react'],
        },
      },
    },
  },
}));
