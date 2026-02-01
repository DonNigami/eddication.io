import { defineConfig } from 'vite';
import fullReload from 'vite-plugin-full-reload';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    fullReload(['public/**/*', 'index.html']),
  ],
  base: './',
  envDir: resolve(__dirname, '../..'),
  server: {
    port: 5174,
    strictPort: true,
    host: true,
    https: true,
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
