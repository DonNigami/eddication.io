import { defineConfig } from 'vite';
import fullReload from 'vite-plugin-full-reload';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get the correct directory path in ESM
const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    fullReload(['public/**/*', 'index.html']),
  ],
  // Use relative paths for assets so the app works from any subdirectory
  base: './',
  // Look for .env files in the monorepo root (2 levels up)
  envDir: resolve(__dirname, '../..'),
  server: {
    port: 5174,
    strictPort: true,
    host: true,
  },
  build: {
    target: 'es2015',
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'liff': ['@line/liff'],
          'supabase': ['@supabase/supabase-js'],
        },
      },
    },
  },
});
