// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://eddynorris.github.io',
  base: '/portafolio',
  integrations: [react()],
  vite: {
    ssr: {
      noExternal: ['@react-three/drei', '@react-three/postprocessing', 'postprocessing'],
    },
  },
});
