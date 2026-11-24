import { expect, test, type Page } from '@playwright/test';
import type { LandscapeHandle } from '../src/art/landscape';

async function captureArtActions(page: Page) {
  await page.evaluate(() => {
    HTMLAnchorElement.prototype.click = function () {
      document.documentElement.dataset.artDownload = JSON.stringify({
        href: this.href,
        filename: this.download,
      });
    };
    Object.defineProperty(navigator.clipboard, 'writeText', {
      configurable: true,
      value: async (text: string) => {
        document.documentElement.dataset.artCopied = text;
      },
    });
  });
}

test('a failed seed request shares and downloads the displayed poster', async ({
  page,
}) => {
  await page.route(/\/landscape[.-].*\.js$/, (route) => route.abort());
  await page.goto('/?seed=1971');
  const art = page.locator('generative-landscape');
  await expect(art).toHaveAttribute('data-state', 'error');
  const defaultSeed = await art.getAttribute('data-seed');
  await captureArtActions(page);
  await page.locator('[data-copy]').click();
  await expect(page.locator('html')).toHaveAttribute(
    'data-art-copied',
    new URL(`/?seed=${defaultSeed}`, page.url()).href,
  );
  await page.locator('[data-download]').click();
  const download = JSON.parse(
    (await page.locator('html').getAttribute('data-art-download'))!,
  );
  expect(download).toEqual({
    href: new URL('/images/landscape.webp', page.url()).href,
    filename: `ayixiayi-seed-${defaultSeed}.webp`,
  });
  expect(new URL(page.url()).searchParams.get('seed')).toBe(defaultSeed);
});

for (const snapshotAvailable of [true, false]) {
  test(`failed regeneration preserves the ${snapshotAvailable ? 'previous painting' : 'poster when snapshot encoding fails'}`, async ({
    page,
  }) => {
    await page.goto('/?seed=1971');
    const art = page.locator('generative-landscape');
    await expect(art).toHaveAttribute('data-state', 'ready', {
      timeout: 20000,
    });
    const defaultSeed = await art.getAttribute('data-seed');
    await captureArtActions(page);
    await page.evaluate((snapshotAvailable) => {
      if (!snapshotAvailable) {
        HTMLCanvasElement.prototype.toBlob = (callback) => callback(null);
      }
      const createElement = document.createElement.bind(document);
      // Fail the next renderer's canvas allocation after snapshotting finishes.
      document.createElement = ((
        name: string,
        options?: ElementCreationOptions,
      ) => {
        if (name === 'canvas') {
          document.createElement = createElement;
          throw new Error('Simulated canvas allocation failure');
        }
        return createElement(name, options);
      }) as typeof document.createElement;
    }, snapshotAvailable);
    await page.locator('[data-random]').click();
    await expect(art).toHaveAttribute('data-state', 'error');
    const displayedSeed = snapshotAvailable ? '1971' : defaultSeed;
    const fallback = await page
      .locator('[data-art-fallback]')
      .getAttribute('src');
    if (snapshotAvailable) expect(fallback).toMatch(/^blob:/);
    else expect(fallback).toBe('/images/landscape.webp');
    await page.locator('[data-copy]').click();
    await expect(page.locator('html')).toHaveAttribute(
      'data-art-copied',
      new URL(`/?seed=${displayedSeed}`, page.url()).href,
    );
    await page.locator('[data-download]').click();
    const download = JSON.parse(
      (await page.locator('html').getAttribute('data-art-download'))!,
    );
    expect(download).toEqual({
      href: new URL(fallback!, page.url()).href,
      filename: `ayixiayi-seed-${displayedSeed}.webp`,
    });
    expect(new URL(page.url()).searchParams.get('seed')).toBe(displayedSeed);
  });
}

test('copy cannot replace the generation status while the engine loads', async ({
  page,
}) => {
  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/landscape[.-].*\.js$/, async (route) => {
    await held;
    await route.abort();
  });
  try {
    await page.goto('/');
    await captureArtActions(page);
    await page.locator('[data-random]').click();
    await expect(page.locator('[data-copy]')).toBeDisabled();
    await page.locator('[data-copy]').dispatchEvent('click');
    await expect(page.locator('[data-art-status]')).toHaveText('正在生成…');
    expect(
      await page.locator('html').getAttribute('data-art-copied'),
    ).toBeNull();
  } finally {
    release!();
  }
  await expect(page.locator('generative-landscape')).toHaveAttribute(
    'data-state',
    'error',
  );
});

test('the same seed is pixel-identical across different drawing frame budgets', async ({
  page,
}) => {
  const modules: string[] = [];
  page.on('request', (request) => {
    if (/\/landscape[.-].*\.js$/.test(request.url()))
      modules.push(request.url());
  });
  await page.goto('/?seed=1847');
  await expect(page.locator('generative-landscape')).toHaveAttribute(
    'data-state',
    'ready',
    { timeout: 20000 },
  );
  const landscapeUrl = modules.find((url) => /\/landscape[.-]/.test(url))!;
  expect(landscapeUrl).toBeTruthy();
  const identical = await page.evaluate(
    async ({ landscapeUrl }) => {
      const { renderLandscape } = await import(landscapeUrl);
      const render = async (frameBudgetMs: number) => {
        const host = document.createElement('div');
        document.body.append(host);
        let handle: LandscapeHandle | undefined;
        try {
          return await new Promise<string>((resolve, reject) => {
            handle = renderLandscape(host, {
              seed: 1847,
              width: 1600,
              height: 1000,
              frameBudgetMs,
              onComplete: () =>
                resolve(host.querySelector('canvas')!.toDataURL()),
              onError: reject,
            });
          });
        } finally {
          handle?.remove();
          host.remove();
        }
      };
      return (await render(0)) === (await render(12));
    },
    { landscapeUrl },
  );
  expect(identical).toBe(true);
});
