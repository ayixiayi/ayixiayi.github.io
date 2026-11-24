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

test('RSS feed declares atom self link and article categories', async ({
  request,
}) => {
  const response = await request.get('/rss.xml');
  expect(response.ok()).toBe(true);
  const xml = await response.text();
  expect(xml).toContain('xmlns:atom="http://www.w3.org/2005/Atom"');
  expect(xml).toContain(
    '<atom:link href="https://www.ayixiayi.com/rss.xml" rel="self" type="application/rss+xml"',
  );
  expect(xml).toContain('<category>测试</category>');
  expect(xml).toContain('<category>样例</category>');
});

test('search index strips Markdown syntax from article body text', async ({
  request,
}) => {
  const response = await request.get('/search-index.json');
  expect(response.ok()).toBe(true);
  const entries: { kind: string; title: string; text: string }[] =
    await response.json();
  const published = entries.find(({ title }) => title === '测试样例：公开文章');
  expect(published).toBeDefined();
  expect(published!.text).toContain('工具与方法');
  expect(published!.text).not.toContain('## ');
});

test('About first paragraph sits cleanly below the chapter banner', async ({
  page,
}) => {
  await page.goto('/about/');
  const band = await page.locator('.chapter-band').boundingBox();
  const firstParagraph = await page
    .locator('.about-page .prose p')
    .first()
    .boundingBox();
  expect(band).not.toBeNull();
  expect(firstParagraph).not.toBeNull();
  expect(firstParagraph!.y).toBeGreaterThanOrEqual(band!.y + band!.height);
});
