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
