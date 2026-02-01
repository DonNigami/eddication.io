import { defineConfig } from 'vite';
import fullReload from 'vite-plugin-full-reload';
export default defineConfig({
    plugins: [
        fullReload(['public/**/*', 'index.html']),
    ],
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
