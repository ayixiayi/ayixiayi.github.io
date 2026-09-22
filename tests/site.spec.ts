import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { existsSync, readFileSync } from 'node:fs';

const publishedTitle = '如果你需要“学”才能使用AI工具，那你根本就不需要它。';
const publishedPath = '/blog/如果你需要学才能使用ai工具那你根本就不需要它/';
const draftTitle = '好几个月没写博客了';

test('navigation is limited to content sections without decorative copy', async ({
  page,
}) => {
  expect(existsSync('dist/art/index.html')).toBe(false);
  await page.goto('/');
  await expect(
    page.getByRole('navigation', { name: '主导航' }).getByRole('link'),
  ).toHaveText(['项目', '博客', '关于']);
  await expect(page).toHaveTitle('ayixiayi');
  await expect(
    page.locator('main').getByRole('heading', { level: 2 }),
  ).toHaveText(['项目', '博客']);
  await expect(page.locator('footer')).not.toContainText('慢慢探索');
  await expect(
    page.locator('main').getByRole('link', { name: /画室/ }),
  ).toHaveCount(0);
});

test('project illustrations are decorative and preserve each card destination', async ({
  page,
}) => {
  const projects = [
    ['OpenMemory-enhanced', 'https://github.com/ayixiayi/OpenMemory-enhanced'],
    ['OhMyAmpcode', 'mailto:ayixiayi@gmail.com'],
    ['MusicBarOs', 'https://github.com/ayixiayi/MusicBarOs'],
  ];
  for (const route of ['/', '/projects/']) {
    await page.goto(route);
    await expect(page.locator('.project-card')).toHaveCount(3);
    await expect(page.locator('.project-card h3')).toHaveText(
      projects.map(([title]) => title),
    );
    for (const [title, url] of projects) {
      const card = page
        .locator('.project-card')
        .filter({ has: page.getByRole('heading', { name: title }) });
      await expect(card).toHaveAttribute('href', url);
      await expect(card).toHaveAccessibleName(new RegExp(`^${title}`));
      await expect(card.locator('.project-visual')).toHaveAttribute(
        'aria-hidden',
        'true',
      );
      await expect(card.locator('.project-visual svg')).toBeVisible();
    }
    const oma = page.locator('.project-card').nth(1);
    await expect(oma).not.toHaveAttribute('target');
    await expect(oma).toContainText(
      '如需查看代码或试用，请通过以下邮箱联系我。',
    );
    await expect(oma).toContainText('ayixiayi@gmail.com');
    await expect(
      page.locator('a[href*="github.com/ayixiayi/ohmyampcode" i]'),
    ).toHaveCount(0);
  }
});

test('OMA search leads to the contact card without exposing a repository URL', async ({
  page,
  request,
}) => {
  const index = await request.get('/search-index.json');
  expect(await index.text()).not.toMatch(/github\.com\/ayixiayi\/ohmyampcode/i);
  await page.goto('/');
  await page.getByRole('button', { name: '搜索站点' }).click();
  await page.getByRole('searchbox').fill('ohmyampcode');
  const result = page
    .getByRole('dialog')
    .getByRole('link', { name: /OhMyAmpcode/ });
  await expect(result).toHaveAttribute(
    'href',
    'http://127.0.0.1:4322/projects/#ohmyampcode',
  );
  await result.click();
  await expect(page).toHaveURL('/projects/#ohmyampcode');
  await expect(page.getByRole('link', { name: /OhMyAmpcode/ })).toHaveAttribute(
    'href',
    'mailto:ayixiayi@gmail.com',
  );
  await expect(
    page.getByText('ayixiayi@gmail.com', { exact: true }),
  ).toBeInViewport();
});

test('project-page search closes the dialog and focuses the destination card', async ({
  page,
}) => {
  await page.goto('/projects/');
  const trigger = page.getByRole('button', { name: '搜索站点' });
  const dialog = page.getByRole('dialog');
  await trigger.click();
  await page.getByRole('searchbox').fill('ohmyampcode');
  await dialog.getByRole('link', { name: /OhMyAmpcode/ }).focus();
  await page.keyboard.press('Enter');
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL('/projects/#ohmyampcode');
  await expect(page.locator('#ohmyampcode')).toBeFocused();
  await expect(
    page.getByText('ayixiayi@gmail.com', { exact: true }),
  ).toBeInViewport();
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});

test('About identifies the artwork inspiration and explains how to revisit a generated landscape', async ({
  page,
}) => {
  await page.goto('/about/');
  const prose = page.locator('.about-page .prose');
  await expect(prose.getByRole('heading', { level: 2 })).toHaveText([
    '关于本站',
    '链接',
  ]);
  await expect(prose).toContainText('Theodor Kittelsen');
  await expect(
    prose.getByRole('link', {
      name: 'Far, far away Soria Moria Palace shimmered like Gold',
    }),
  ).toHaveAttribute(
    'href',
    'https://www.nasjonalmuseet.no/en/collection/object/NG.M.00546',
  );
  await expect(
    prose.getByRole('link', { name: 'p5.js', exact: true }),
  ).toHaveAttribute('href', 'https://p5js.org/');
  await expect(prose).toContainText('点击首页的「重新生成」');
  await expect(prose).toContainText(
    '保留生成后的页面地址，可以再次打开同一构图',
  );
});

test('the About illustration sits beside the text or below it on small screens', async ({
  page,
}) => {
  await page.goto('/about/');
  const image = page.getByRole('img', { name: '程序生成的山谷与远景宫殿' });
  await expect(image).toBeVisible();
  expect(
    await image.evaluate(
      (node: HTMLImageElement) => node.complete && node.naturalWidth > 0,
    ),
  ).toBe(true);
  const illustration = await image.boundingBox();
  const prose = await page.locator('.about-page .prose').boundingBox();
  expect(illustration).not.toBeNull();
  expect(prose).not.toBeNull();
  if (page.viewportSize()!.width > 800) {
    expect(illustration!.x).toBeGreaterThan(prose!.x + prose!.width);
  } else {
    expect(illustration!.y).toBeGreaterThan(prose!.y + prose!.height);
  }
});

test('the identity is updated without changing the author’s writing', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText(/SJTU 自动化.*Sophomore/)).toBeVisible();
  await expect(page.locator('main')).not.toContainText('Freshman');
  await page.goto('/about/');
  await expect(page.locator('main')).not.toContainText('大一');
  await page.goto(publishedPath);
  await expect(
    page.getByRole('heading', { name: publishedTitle, exact: true }),
  ).toBeVisible();
  await expect(page.locator('article')).toContainText('工具悖论');
});

test('drafts do not produce a publicly accessible build artifact', () => {
  expect(existsSync(`dist/blog/${draftTitle}/index.html`)).toBe(false);
});

test('RSS, sitemap and search use only published posts', async ({
  request,
}) => {
  const feed = await request.get('/rss.xml');
  expect(feed.ok()).toBe(true);
  expect(feed.headers()['content-type']).toContain('xml');
  const rss = await feed.text();
  expect(rss).toContain(publishedTitle);
  expect(rss).not.toContain(draftTitle);
  const search = await request.get('/search-index.json');
  expect(search.ok()).toBe(true);
  const entries = await search.json();
  expect(
    entries.some((entry: { title: string }) => entry.title === publishedTitle),
  ).toBe(true);
  expect(
    entries.some((entry: { title: string }) => entry.title === 'MusicBarOs'),
  ).toBe(true);
  expect(JSON.stringify(entries)).not.toContain(draftTitle);
  const sitemap = readFileSync('dist/sitemap-0.xml', 'utf8');
  expect(decodeURI(sitemap)).toContain(publishedPath);
  expect(decodeURI(sitemap)).not.toContain(draftTitle);
});

test('search handles Chinese body text, case-insensitive projects and no results', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '搜索站点' }).click();
  const dialog = page.getByRole('dialog');
  const search = dialog.getByRole('searchbox');
  await expect(search).toBeFocused();
  await search.fill('工具悖论');
  await expect(
    dialog.getByRole('link', { name: new RegExp('如果你需要') }),
  ).toBeVisible();
  await expect(dialog.getByRole('link', { name: /MusicBarOs/ })).toHaveCount(0);
  await search.fill('  musicbaros  ');
  await expect(dialog.getByRole('link', { name: /MusicBarOs/ })).toBeVisible();
  await search.fill(draftTitle);
  await expect(dialog.getByText('没有找到匹配的内容')).toBeVisible();
  await search.fill('<img src=x onerror=alert(1)>');
  await expect(dialog.locator('img')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: '搜索站点' })).toBeFocused();
});

test('search reports a failed index fetch and can retry', async ({ page }) => {
  await page.route('**/search-index.json', (route) =>
    route.fulfill({ status: 503, body: 'Unavailable' }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: '搜索站点' }).click();
  await expect(
    page.getByRole('dialog').getByText('搜索暂时不可用，请重试。'),
  ).toBeVisible();
  await page.unroute('**/search-index.json');
  await page.getByRole('button', { name: '重试' }).click();
  await page.getByRole('searchbox').fill('MCP');
  await expect(
    page.getByRole('dialog').getByRole('link', { name: /OpenMemory-enhanced/ }),
  ).toBeVisible();
});

test('article contents link to real heading anchors', async ({ page }) => {
  await page.goto(publishedPath);
  const toc = page.getByRole('navigation', { name: '文章目录' });
  await toc.getByRole('link', { name: '半年以后', exact: true }).click();
  await expect(page).toHaveURL(/#.+/);
  await expect(
    page.locator('.prose').getByRole('heading', { name: '半年以后' }),
  ).toBeInViewport();
  await expect(page.locator('time')).toHaveAttribute('datetime', /2026-03-24/);
});

test('the site remains readable and navigable without JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4322/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('[data-art-fallback]')).toBeVisible();
  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('link', { name: '博客' })
    .click();
  await expect(
    page.getByRole('link', { name: new RegExp('如果你需要') }),
  ).toBeVisible();
  await context.close();
});

test('feeds and metadata use the existing custom domain', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    'content',
    'https://www.ayixiayi.com/',
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    'https://www.ayixiayi.com/images/landscape.webp',
  );
  for (const path of [
    '/rss.xml',
    '/sitemap-index.xml',
    '/sitemap-0.xml',
    '/robots.txt',
  ]) {
    const response = await request.get(path);
    expect(response.ok()).toBe(true);
    const content = await response.text();
    expect(content).toContain('https://www.ayixiayi.com/');
    expect(content).not.toContain('https://ayixiayi.github.io/');
  }
});

for (const route of ['/', '/projects/', '/blog/', '/about/', '/404.html']) {
  test(`${route} has accessible navigation, metadata and no horizontal overflow`, async ({
    page,
  }) => {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      /^https:\/\/www\.ayixiayi\.com\//,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(result.violations).toEqual([]);
  });
}
