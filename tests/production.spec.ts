import { expect, test } from '@playwright/test';

const productionURL = 'http://127.0.0.1:4322';

test('deployable output excludes isolated test articles', async ({
  request,
}) => {
  for (const path of [
    '/',
    '/blog/',
    '/rss.xml',
    '/search-index.json',
    '/sitemap-0.xml',
  ]) {
    const response = await request.get(new URL(path, productionURL).href);
    expect(response.ok()).toBe(true);
    expect(await response.text()).not.toMatch(
      /\/blog\/fixture-(published|recent|draft)\//,
    );
  }
  for (const slug of ['fixture-published', 'fixture-recent', 'fixture-draft']) {
    const response = await request.get(`${productionURL}/blog/${slug}/`);
    expect(response.status()).toBe(404);
  }
});

test('real published articles have reachable pages and matching titles', async ({
  page,
  request,
}) => {
  const response = await request.get(`${productionURL}/search-index.json`);
  expect(response.ok()).toBe(true);
  const entries: { kind: string; title: string; url: string }[] =
    await response.json();
  // Authors can publish, unpublish, rename or remove posts without updating tests.
  for (const post of entries.filter((entry) => entry.kind === '文章')) {
    const article = await page.goto(new URL(post.url, productionURL).href);
    expect(article?.status()).toBe(200);
    await expect(page.locator('.article-header h1')).toHaveText(post.title);
  }
});
