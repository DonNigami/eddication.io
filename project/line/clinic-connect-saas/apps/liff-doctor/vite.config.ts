import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get the correct directory path in ESM
const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Look for .env files in the monorepo root (2 levels up)
  envDir: resolve(__dirname, '../..'),
  server: {
    port: 5175,
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
