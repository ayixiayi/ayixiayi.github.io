import { expect, test } from '@playwright/test';

test('the table of contents keeps the current section active between headings', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/blog/fixture-published/');
  await page.evaluate(async () => {
    await document.fonts.ready;
    // Make a long section without coupling this regression to fixture prose.
    const firstHeading = document.querySelector('.prose :is(h1, h2, h3)')!;
    const paragraph = document.createElement('p');
    paragraph.textContent = 'A long section keeps its heading active.';
    paragraph.style.minHeight = `${innerHeight * 2}px`;
    firstHeading.after(paragraph);
  });
  const currentSection = page.locator('.toc nav a').first();
  const firstHeadingTop = await page
    .locator('.prose :is(h1, h2, h3)')
    .first()
    .evaluate((heading) => heading.getBoundingClientRect().top + scrollY);
  await page.evaluate(
    (top) => scrollTo({ top, behavior: 'instant' }),
    firstHeadingTop - 100,
  );
  await expect(currentSection).toHaveClass(/is-active/);
  await page.evaluate(async (top) => {
    scrollTo({ top, behavior: 'instant' });
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  }, firstHeadingTop + 120);
  await expect(currentSection).toHaveClass(/is-active/);
  await expect(page.locator('.toc > a[href="#main"]')).not.toHaveClass(
    /is-active/,
  );
});

test('the header changes state only once while scrolling across its boundary', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/about/');
  const boundary = await page.evaluate(async () => {
    await document.fonts.ready;
    const stage = document.querySelector<HTMLElement>('.chapter-band')!;
    const header = document.querySelector<HTMLElement>('[data-header]')!;
    return stage.offsetTop + stage.offsetHeight * 0.55 - header.offsetHeight;
  });
  const states: boolean[] = [];
  for (let top = Math.floor(boundary) - 4; top <= boundary + 24; top += 1) {
    states.push(
      await page.evaluate(async (top) => {
        scrollTo({ top, behavior: 'instant' });
        // Allow the scroll event and the header's scheduled update to run.
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        return document
          .querySelector('[data-header]')!
          .classList.contains('is-solid');
      }, top),
    );
  }
  expect(states[0]).toBe(false);
  expect(states.at(-1)).toBe(true);
  expect(states.slice(states.indexOf(true)).every(Boolean)).toBe(true);
});

test('the header recalculates its boundary when the viewport is resized', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto('/about/');
  await page.evaluate(async () => {
    await document.fonts.ready;
    scrollTo({ top: 150, behavior: 'instant' });
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  const header = page.locator('[data-header]');
  await expect(header).not.toHaveClass(/is-solid/);
  await page.setViewportSize({ width: 400, height: 900 });
  await expect(header).toHaveClass(/is-solid/);
});

test('adjacent articles follow the published timeline', async ({ page }) => {
  await page.goto('/blog/fixture-recent/');
  const neighbors = page.getByRole('navigation', { name: '相邻文章' });
  await expect(neighbors.getByRole('link')).toHaveCount(1);
  await neighbors.getByRole('link', { name: /较早一篇.*公开文章/ }).click();
  await expect(page).toHaveURL('/blog/fixture-published/');
  await expect(neighbors.getByRole('link')).toHaveCount(1);
  await expect(
    neighbors.getByRole('link', { name: /较新一篇.*近期文章/ }),
  ).toHaveAttribute('href', '/blog/fixture-recent/');
});

test('a project title outranks body mentions and can be opened from the keyboard', async ({
  page,
}) => {
  await page.goto('/projects/');
  await page.getByRole('button', { name: '搜索站点' }).click();
  const input = page.getByRole('searchbox');
  const results = page
    .getByRole('list', { name: '搜索结果' })
    .getByRole('link');
  await input.fill('ＯｐｅｎＭｅｍ');
  await expect(results).toHaveCount(2);
  await expect(results.nth(0)).toContainText('项目');
  await expect(results.nth(1)).toContainText('近期文章');
  await input.press('ArrowDown');
  await expect(results.nth(0)).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(results.nth(1)).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect(input).toBeFocused();
  await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true });
  await expect(input).toBeFocused();
  await input.press('Enter');
  await expect(page).toHaveURL('/projects/#openmem');
  await expect(page.locator('#openmem')).toBeFocused();
});

test.describe('homepage without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the project shortcut reaches the project shelf', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: '浏览项目', exact: true }).click();
    await expect(page).toHaveURL('/#projects-title');
    await expect(page.locator('#projects-title')).toBeInViewport();
  });

  test('the latest article shortcut opens the newest published article', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /读最新文章/ }).click();
    await expect(page).toHaveURL('/blog/fixture-recent/');
  });
});
