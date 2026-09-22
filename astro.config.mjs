// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.ayixiayi.com',
  output: 'static',
  trailingSlash: 'always',
  compressHTML: true,
  integrations: [sitemap({ filter: (page) => !page.endsWith('/404/') })],
  devToolbar: { enabled: false },
});
