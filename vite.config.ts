import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`       -> production build (dist/). Requires Supabase env vars: never ship demo mode to the real QR.
// `npm run build:demo`  -> single self-contained HTML file for sharing a clickable demo (dist-demo/).
// `npm run build:live`  -> production code against a placeholder Supabase URL (.env.live), for tests/e2e/live.spec.ts.
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  if (command === 'build' && mode === 'production' && !(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY)) {
    throw new Error(
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set for a production build. ' +
        'Without them the app runs in demo mode (menu stored in one browser). Use `npm run build:demo` for a demo.',
    );
  }
  return {
    // Relative asset paths: works at a domain root and under a GitHub Pages project path (/repo-name/).
    base: './',
    plugins: [react(), ...(mode === 'demo' ? [viteSingleFile()] : [])],
    build: {
      outDir: mode === 'demo' ? 'dist-demo' : mode === 'live' ? 'dist-live' : 'dist',
      target: ['es2019', 'safari13'],
      manifest: mode !== 'demo', // read by scripts/check-size.mjs
    },
  };
});
