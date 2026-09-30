import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
// @ts-expect-error plain ESM module shared with the production server
import { createApi } from './server/kochwerk.mjs';

// Mount the same API the production server uses, so dev and prod behave identically.
function api(): Plugin {
  const handler = createApi({ cacheFile: 'data/menu.json' });
  return {
    name: 'cantina-api',
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  };
}

export default defineConfig({
  plugins: [svelte(), api()],
  server: { port: 5200, strictPort: true },
  preview: { port: 5201, strictPort: true },
  build: { target: 'es2022' },
});
