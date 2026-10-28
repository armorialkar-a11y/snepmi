import { fileURLToPath } from 'node:url';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const webRoot = path.dirname(fileURLToPath(import.meta.url));

const apiTarget = process.env.DEV_API_ORIGIN || 'http://localhost:8080';

export default defineConfig({
  root: webRoot,
  plugins: [react()],
  build: {
    outDir: path.join(webRoot, 'dist'),
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: Number(process.env.DEV_WEB_PORT || 5173),
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/media': { target: apiTarget, changeOrigin: true },
      '/images': { target: apiTarget, changeOrigin: true },
    },
  },
});
