import { build, preview } from 'astro';
import { fileURLToPath } from 'node:url';
import config from '../astro.config.mjs';

// The real pages and content schema read isolated Markdown fixtures via root.
// Neither the CMS content directory nor the deployable dist/ is modified.
const options = {
  ...config,
  configFile: false,
  root: fileURLToPath(new URL('./fixtures/', import.meta.url)),
  srcDir: fileURLToPath(new URL('../src/', import.meta.url)),
  publicDir: fileURLToPath(new URL('../public/', import.meta.url)),
  outDir: fileURLToPath(new URL('../dist-test/', import.meta.url)),
  cacheDir: fileURLToPath(new URL('../.astro-test/', import.meta.url)),
  server: { host: '127.0.0.1', port: 4323 },
  force: true,
};

await build(options);
await preview(options);
