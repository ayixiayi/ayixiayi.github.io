import { expect, test } from '@playwright/test';

test('seed changes composition rather than only the surface texture', async ({
  page,
}) => {
  const centers: number[] = [];
  for (const seed of [2020, 1971]) {
    await page.goto(`/?seed=${seed}`);
    await expect(page.locator('generative-landscape')).toHaveAttribute(
      'data-state',
      'ready',
      { timeout: 20000 },
    );
    const focalPoint = await page
      .locator('canvas')
      .evaluate((canvas: HTMLCanvasElement) => {
        const data = canvas
          .getContext('2d')!
          .getImageData(0, 0, canvas.width, canvas.height).data;
        let totalX = 0;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          // Locate the warm highlights, not blue-gray terrain or noise differences.
          if (
            data[i] > 195 &&
            data[i] - data[i + 1] > 15 &&
            data[i + 1] - data[i + 2] > 30
          ) {
            totalX += (i / 4) % canvas.width;
            count++;
          }
        }
        return { x: totalX / count, count };
      });
    expect(focalPoint.count).toBeGreaterThan(5);
    centers.push(focalPoint.x);
  }
  expect(Math.abs(centers[0] - centers[1])).toBeGreaterThan(130);
});

test('the palace stays inside the narrow homepage crop', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/?seed=1847');
  await expect(page.locator('generative-landscape')).toHaveAttribute(
    'data-state',
    'ready',
    { timeout: 20000 },
  );
  const bounds = await page
    .locator('canvas')
    .evaluate((canvas: HTMLCanvasElement) => {
      const pixels = canvas
        .getContext('2d')!
        .getImageData(0, 0, canvas.width, canvas.height).data;
      let left = canvas.width;
      let right = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (
          pixels[i] > 195 &&
          pixels[i] - pixels[i + 1] > 15 &&
          pixels[i + 1] - pixels[i + 2] > 30
        ) {
          left = Math.min(left, (i / 4) % canvas.width);
          right = Math.max(right, (i / 4) % canvas.width);
        }
      }
      // Convert painted pixels into the actual object-fit:cover viewport.
      const box = canvas.getBoundingClientRect();
      const scale = Math.max(
        box.width / canvas.width,
        box.height / canvas.height,
      );
      const position =
        parseFloat(getComputedStyle(canvas).objectPosition) / 100;
      const offset = (box.width - canvas.width * scale) * position;
      return {
        left: left * scale + offset,
        right: right * scale + offset,
        width: box.width,
      };
    });
  expect(bounds.right).toBeGreaterThan(bounds.left);
  expect(bounds.left).toBeGreaterThan(8);
  expect(bounds.right).toBeLessThan(bounds.width - 8);
});

test('homepage seed URLs reproduce the same image', async ({ page }) => {
  const pixels = () =>
    page
      .locator('canvas')
      .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  await page.goto('/?seed=1847');
  await expect(page.locator('generative-landscape')).toHaveAttribute(
    'data-state',
    'ready',
    { timeout: 20000 },
  );
  const first = await pixels();
  await page.goto('/?seed=2718');
  await expect(page.locator('generative-landscape')).toHaveAttribute(
    'data-state',
    'ready',
  );
  expect(await pixels()).not.toBe(first);
  await page.goto('/?seed=1847');
  await expect(page.locator('generative-landscape')).toHaveAttribute(
    'data-state',
    'ready',
  );
  expect(await pixels()).toBe(first);
});

test('random generation changes the seed and preserves keyboard focus', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(crypto, 'getRandomValues', {
      value: (values: Uint32Array) => {
        values[0] = 999997;
        return values;
      },
    });
  });
  await page.goto('/?seed=1');
  const art = page.locator('generative-landscape');
  const regenerate = page.getByRole('button', { name: '重新生成图像' });
  await expect(art).toHaveAttribute('data-state', 'ready', { timeout: 20000 });
  await regenerate.focus();
  await page.keyboard.press('Enter');
  await expect(art).toHaveAttribute('data-state', 'ready');
  await expect(page).toHaveURL(/seed=999999/);
  await expect(regenerate).toBeFocused();
  await page.keyboard.press('Enter');
  const search = page.getByRole('button', { name: '搜索站点' });
  await search.focus();
  await expect(art).toHaveAttribute('data-state', 'ready');
  await expect(page).toHaveURL(/seed=999998/);
  await expect(search).toBeFocused();
});

test('the homepage does not load the drawing engine until requested', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('[data-art-fallback]')).toBeVisible();
  expect(
    await page
      .locator('[data-art-fallback]')
      .evaluate(
        (image: HTMLImageElement) =>
          image.complete && image.naturalWidth === 1600,
      ),
  ).toBe(true);
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(requests.filter((url) => /\/p5[.-]/.test(url))).toEqual([]);
  await page.getByRole('button', { name: '重新生成图像' }).click();
  await expect(page.locator('generative-landscape')).toHaveAttribute(
    'data-state',
    'ready',
    { timeout: 20000 },
  );
  expect(requests.some((url) => /\/p5[.-]/.test(url))).toBe(true);
  const first = await page
    .locator('canvas')
    .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  await page.waitForTimeout(150);
  expect(
    await page
      .locator('canvas')
      .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL()),
  ).toBe(first);
});

test('invalid seed URLs retain the static fallback', async ({ page }) => {
  for (const seed of ['-1', '1000000', '1.5', 'bad']) {
    await page.goto(`/?seed=${seed}`);
    await expect(
      page.getByRole('button', { name: '重新生成图像' }),
    ).toBeVisible();
    await expect(page.locator('generative-landscape')).toHaveAttribute(
      'data-state',
      'poster',
    );
    await expect(page.locator('canvas')).toHaveCount(0);
  }
});
