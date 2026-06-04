// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
// Static site only — RSVP/admin APIs live in netlify/functions/, not Astro SSR.
export default defineConfig({
  output: 'static',
  vite: {
    // Allow importing JSON from the data/ directory at build time
    resolve: {
      alias: {
        '@data': new URL('./data', import.meta.url).pathname,
      },
    },
  },
});
