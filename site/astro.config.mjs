import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import icon from 'astro-icon';
import react from '@astrojs/react';

// Project Pages: served at https://marlburrow.github.io/kinbot/
export default defineConfig({
  site: 'https://marlburrow.github.io',
  base: '/kinbot',
  integrations: [
    tailwind({ applyBaseStyles: false }), // we ship our own reset + tokens in global.css
    icon(),
    react(), // for @lobehub/icons (colored provider marks, SSR-only, no client JS)
  ],
  vite: {
    // @lobehub/icons ships extensionless internal ESM imports — bundle it so Vite resolves them.
    ssr: { noExternal: ['@lobehub/icons'] },
  },
});
