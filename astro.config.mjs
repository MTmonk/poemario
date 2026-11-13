import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://mtmonk.github.io',
  base: '/poemario',
  trailingSlash: 'always',
  integrations: [react()],
});
