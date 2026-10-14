import { expect, test } from '@playwright/test';

test('a cleared CMS slug falls back to the filename', async ({
  page,
  request,
}) => {
  const response = await page.goto('/blog/fixture-recent/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('.article-header h1')).toHaveText(
    '测试样例：近期文章',
  );
  const index = await request.get('/search-index.json');
  const entries: { title: string; url: string }[] = await index.json();
  expect(entries.find(({ title }) => title === '测试样例：近期文章')?.url).toBe(
    '/blog/fixture-recent/',
  );
});

test('special tags have distinct reachable pages and retain their labels', async ({
  page,
}) => {
  await page.goto('/blog/fixture-recent/');
  const links = page.locator('.article-header .post-tags a');
  const tags = await links.evaluateAll((nodes) =>
    nodes.map((node) => ({
      label: node.textContent!.trim(),
      href: node.getAttribute('href')!,
    })),
  );
  expect(tags.map(({ label }) => label)).toEqual([
    'AI/ML',
    '100%',
    'AI%2FML',
    '~41-49-2f-4d-4c',
    '.',
    '..',
  ]);
  expect(new Set(tags.map(({ href }) => href)).size).toBe(tags.length);
  for (const { label, href } of tags) {
    expect(href).toMatch(/^\/blog\/tags\/[^/]+\/$/);
    const response = await page.goto(href);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(label);
    await expect(page.locator('.blog-entry h3')).toHaveText([
      '测试样例：近期文章',
    ]);
  }

  await page.goto('/blog/fixture-published/');
  await expect(
    page
      .locator('.article-header .post-tags')
      .getByRole('link', { name: '测试' }),
  ).toHaveAttribute('href', `/blog/tags/${encodeURIComponent('测试')}/`);
});
