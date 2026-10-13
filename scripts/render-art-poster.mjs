import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

// Run against `npm run dev`, or pass the base URL of a current local preview.
const url = new URL('/', process.argv[2] ?? 'http://127.0.0.1:4321');
const browser = await chromium.launch();

try {
  const page = await browser.newPage();
  await page.goto(url.href);
  const seed = await page
    .locator('generative-landscape')
    .getAttribute('data-seed');
  if (!seed) throw new Error('The homepage does not declare a default seed.');
  url.searchParams.set('seed', seed);
  await page.goto(url.href);
  await page.locator('generative-landscape[data-state="ready"]').waitFor({
    timeout: 30000,
  });
  const image = await page
    .locator('canvas')
    .evaluate((canvas) => canvas.toDataURL('image/webp', 0.9));
  if (!image.startsWith('data:image/webp;base64,')) {
    throw new Error('The browser did not encode a WebP poster.');
  }
  const directory = new URL('../public/images/', import.meta.url);
  await mkdir(directory, { recursive: true });
  const bytes = Buffer.from(image.split(',')[1], 'base64');
  await writeFile(new URL('landscape.webp', directory), bytes);
  console.log(`Rendered public/images/landscape.webp (${bytes.length} bytes)`);

  // Share cards for articles are laid over this 1200 × 630 crop of the same painting.
  const card = await page.locator('canvas').evaluate((canvas) => {
    const crop = document.createElement('canvas');
    crop.width = 1200;
    crop.height = 630;
    crop
      .getContext('2d')
      .drawImage(canvas, 400, 160, 1200, 630, 0, 0, 1200, 630);
    return crop.toDataURL('image/jpeg', 0.86);
  });
  const cardBytes = Buffer.from(card.split(',')[1], 'base64');
  await writeFile(
    new URL('../src/assets/og-base.jpg', import.meta.url),
    cardBytes,
  );
  console.log(`Rendered src/assets/og-base.jpg (${cardBytes.length} bytes)`);
} finally {
  await browser.close();
}
