import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.woff2'],
  optimizeDeps: {
    exclude: ['@electric-sql/pglite'],
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
