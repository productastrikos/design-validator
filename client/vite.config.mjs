import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Migrated from Create React App. The source uses .js files that contain JSX, so
// esbuild is told to treat .js as JSX (dev transform + dependency pre-bundling).
// Dev-only ports. Production listen ports are set by the process manager
// (pm2), never here — see DEPLOY.md.
const DEV_PORT     = Number(process.env.PORT)         || 3309;
const DEV_API_PORT = Number(process.env.API_PORT)     || 4309;

export default defineConfig({
  plugins: [react()],
  server: {
    port: DEV_PORT,
    proxy: {
      // Dev: forward API calls to the Express server (replaces CRA's "proxy" field)
      '/api': `http://localhost:${DEV_API_PORT}`,
    },
  },
  preview: { port: DEV_PORT },
  build: {
    outDir: 'dist',      // served by pm2 `serve`; Express also falls back to it
    sourcemap: false,
  },
  // Treat src/*.js as JSX (Vite/esbuild only does this for .jsx by default).
  esbuild: { loader: 'jsx', include: /src\/.*\.js$/, exclude: [] },
  optimizeDeps: { esbuildOptions: { loader: { '.js': 'jsx' } } },
});
