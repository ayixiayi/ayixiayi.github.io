import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Run against `npm run dev`, or pass the base URL of a current local preview.
// Flags:
//   --plates       Render only the curated gallery plates (public/images/plates/seed-<N>.webp).
//   --poster-only  Render only the main poster (public/images/landscape.webp) and OG crop.
// Default renders both the main poster/OG crop and all curated plates.
const args = process.argv.slice(2);
const platesOnly = args.includes('--plates');
const posterOnly = args.includes('--poster-only');
const baseUrlArg = args.find((arg) => !arg.startsWith('--'));
const baseUrl = new URL('/', baseUrlArg ?? 'http://127.0.0.1:4321');

const platesJsonUrl = new URL('../src/data/plates.json', import.meta.url);
const plates = JSON.parse(await readFile(platesJsonUrl, 'utf8'));

/**
 * Navigate to `/?seed=<seed>`, wait for the generative canvas to finish, and
 * return the encoded WebP buffer (and optional 1200x630 JPEG OG crop).
 */
async function renderSeed(page, seed, { includeOgCrop = false } = {}) {
  const target = new URL('/', baseUrl);
  target.searchParams.set('seed', String(seed));
  const response = await page.goto(target.href);
  if (!response?.ok()) {
    throw new Error(
      `Failed to load ${target.href} (HTTP ${response?.status() ?? 'unknown'}).`,
    );
  }
  await page.locator('generative-landscape[data-state="ready"]').waitFor({
    timeout: 30000,
  });
  const image = await page
    .locator('canvas')
    .evaluate((canvas) => canvas.toDataURL('image/webp', 0.9));
  if (!image.startsWith('data:image/webp;base64,')) {
    throw new Error(
      `The browser did not encode a WebP image for seed ${seed}.`,
    );
  }
  const webp = Buffer.from(image.split(',')[1], 'base64');

  let ogJpeg;
  if (includeOgCrop) {
    // Share cards for articles are laid over this 1200 × 630 crop of the same painting.
    const card = await page.locator('canvas').evaluate((canvas) => {
      const crop = document.createElement('canvas');
      crop.width = 1200;
      crop.height = 630;
      const context = crop.getContext('2d');
      if (!context)
        throw new Error('Unable to acquire 2D context for OG crop.');
      context.drawImage(canvas, 400, 160, 1200, 630, 0, 0, 1200, 630);
      return crop.toDataURL('image/jpeg', 0.86);
    });
    if (!card.startsWith('data:image/jpeg;base64,')) {
      throw new Error('The browser did not encode a JPEG OG card base.');
    }
    ogJpeg = Buffer.from(card.split(',')[1], 'base64');
  }

  return { webp, ogJpeg };
}

const browser = await chromium.launch();

try {
  const page = await browser.newPage();
  const imagesDir = new URL('../public/images/', import.meta.url);
  const platesDir = new URL('../public/images/plates/', import.meta.url);
  await mkdir(imagesDir, { recursive: true });

  let defaultSeed;
  let defaultWebp;

  if (!platesOnly) {
    const initialResponse = await page.goto(baseUrl.href);
    if (!initialResponse?.ok()) {
      throw new Error(
        `Failed to load ${baseUrl.href} (HTTP ${initialResponse?.status() ?? 'unknown'}).`,
      );
    }
    defaultSeed = await page
      .locator('generative-landscape')
      .getAttribute('data-seed');
    if (!defaultSeed) {
      throw new Error('The homepage does not declare a default seed.');
    }
    const { webp, ogJpeg } = await renderSeed(page, defaultSeed, {
      includeOgCrop: true,
    });
    defaultWebp = webp;
    await writeFile(new URL('landscape.webp', imagesDir), webp);
    console.log(
      `Rendered public/images/landscape.webp (seed ${defaultSeed}, ${webp.length} bytes)`,
    );
    await writeFile(
      new URL('../src/assets/og-base.jpg', import.meta.url),
      ogJpeg,
    );
    console.log(`Rendered src/assets/og-base.jpg (${ogJpeg.length} bytes)`);
  }

  if (!posterOnly) {
    await mkdir(platesDir, { recursive: true });
    for (const plate of plates) {
      const seed = Number(plate.seed);
      if (!Number.isInteger(seed) || seed < 1 || seed > 999999) {
        throw new Error(
          `Invalid plate seed in src/data/plates.json: ${plate.seed}`,
        );
      }
      const bytes =
        defaultWebp && String(seed) === String(defaultSeed)
          ? defaultWebp
          : (await renderSeed(page, seed)).webp;
      const filename = `seed-${seed}.webp`;
      await writeFile(new URL(filename, platesDir), bytes);
      console.log(
        `Rendered public/images/plates/${filename} (${bytes.length} bytes)`,
      );
    }
  }
} finally {
  await browser.close();
}
