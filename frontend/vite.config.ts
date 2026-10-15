import { defineConfig } from 'vite';

const FRONTEND_PORT = 5230;
const BACKEND_PORT = 8230;

export default defineConfig({
  root: '.',
  publicDir: 'public',
  server: {
    fs: { allow: ['..'] },
    port: FRONTEND_PORT,
    host: false,
    strictPort: true,
    proxy: { '/api': { target: `http://127.0.0.1:${BACKEND_PORT}`, changeOrigin: true, ws: true } },
  },
  preview: {
    port: FRONTEND_PORT + 1,
    host: false,
    strictPort: true,
    proxy: { '/api': { target: `http://127.0.0.1:${BACKEND_PORT}`, changeOrigin: true, ws: true } },
  },
  build: { outDir: 'dist', sourcemap: true, target: 'es2022', chunkSizeWarningLimit: 1600 },
});
