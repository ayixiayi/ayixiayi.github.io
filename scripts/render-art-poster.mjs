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
} finally {
  await browser.close();
}
