import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const articlePath = '/blog/fixture-published/';
const mockEndpoint = 'https://comments.mock.test';

test('article load fires zero comment API requests until expanded and handles unconfigured endpoint gracefully', async ({
  page,
}) => {
  const commentRequests: string[] = [];
  page.on('request', (request) => {
    if (
      request.url().includes('/api/comments') ||
      request.url().includes('turnstile')
    ) {
      commentRequests.push(request.url());
    }
  });

  await page.goto(articlePath);
  const colophon = page.locator('aside.colophon');
  await expect(colophon).toBeVisible();
  await expect(
    colophon.getByRole('button', { name: '复制链接' }),
  ).toBeVisible();

  const toggle = page.locator('[data-comments-toggle]');
  await expect(toggle).toHaveText('展开评论');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#comments-panel')).toBeHidden();
  expect(commentRequests).toEqual([]);

  // Simulate an unconfigured deployment and verify graceful fallback without network calls.
  await page.locator('[data-comments]').evaluate((el) => {
    el.setAttribute('data-endpoint', '');
  });

  await toggle.click();
  await expect(toggle).toHaveText('收起评论');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#comments-panel')).toBeVisible();
  await expect(page.locator('[data-comments-status]')).toContainText(
    '评论服务尚未配置后端地址',
  );
  await expect(page.locator('[data-comment-submit]')).toBeDisabled();
  expect(commentRequests).toEqual([]);
});

test('expanded comments render 1-level threads safely, post comments/replies, handle errors and pass axe', async ({
  page,
}) => {
  const store: {
    id: string;
    slug: string;
    parent_id: string | null;
    author: string;
    website: string | null;
    body: string;
    is_owner: boolean;
    created_at: string;
  }[] = [
    {
      id: 'c-root-1',
      slug: 'fixture-published',
      parent_id: null,
      author: '站长',
      website: 'https://www.ayixiayi.com/',
      body: '欢迎讨论。\n<script>window.__xss = true;</script>',
      is_owner: true,
      created_at: '2026-10-01T08:00:00.000Z',
    },
    {
      id: 'c-reply-1',
      slug: 'fixture-published',
      parent_id: 'c-root-1',
      author: '访客甲',
      website: 'javascript:alert(1)',
      body: '二级回复测试',
      is_owner: false,
      created_at: '2026-10-01T09:00:00.000Z',
    },
  ];
  let postCount = 0;

  await page.route(`${mockEndpoint}/api/comments*`, async (route) => {
    const req = route.request();
    if (req.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          slug: 'fixture-published',
          count: store.length,
          comments: store,
        }),
      });
      return;
    }
    if (req.method() === 'POST') {
      postCount += 1;
      if (postCount === 3) {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({ error: '发言过于频繁，请稍后再试。' }),
        });
        return;
      }
      const body = req.postDataJSON() as {
        slug: string;
        author: string;
        website?: string;
        body: string;
        parent_id?: string;
      };
      const created = {
        id: `c-new-${postCount}`,
        slug: body.slug,
        parent_id: body.parent_id ?? null,
        author: body.author,
        website: body.website ?? null,
        body: body.body,
        is_owner: false,
        created_at: '2026-11-24T12:00:00.000Z',
      };
      store.push(created);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          status: 'approved',
          comment: created,
        }),
      });
    }
  });

  await page.goto(articlePath);
  await page.locator('[data-comments]').evaluate((el, endpoint) => {
    el.setAttribute('data-endpoint', endpoint);
  }, mockEndpoint);

  await page.getByRole('button', { name: '展开评论' }).click();
  await expect(page.locator('[data-comments-status]')).toHaveText(
    '共 2 条评论',
  );

  // Verify XSS payload is rendered strictly as plain text and javascript: URL is not linked.
  const rootItem = page.locator('[data-comment-id="c-root-1"]');
  await expect(rootItem.locator('.comment-owner')).toHaveText('作者');
  await expect(rootItem.locator('.comment-body').first()).toContainText(
    '<script>window.__xss = true;</script>',
  );
  expect(
    await page.evaluate(
      () => (window as unknown as { __xss?: boolean }).__xss ?? false,
    ),
  ).toBe(false);
  const replyItem = page.locator('[data-comment-id="c-reply-1"]');
  await expect(replyItem.locator('a.comment-author-link')).toHaveCount(0);
  await expect(rootItem.locator('.comment-replies')).toContainText(
    '二级回复测试',
  );

  // Client-side validation error on empty fields
  await page.locator('[data-comment-submit]').click();
  await expect(page.locator('[data-form-status]')).toHaveText(
    '昵称需为 1–40 个字符。',
  );
  await expect(page.locator('#comment-author')).toHaveAttribute(
    'aria-invalid',
    'true',
  );

  // Submit top-level comment
  await page.locator('#comment-author').fill('测试访客');
  await page.locator('#comment-body').fill('这是一条新的测试评论');
  await page.locator('[data-comment-submit]').click();
  await expect(page.locator('[data-form-status]')).toHaveText('评论已发布。');
  await expect(page.locator('[data-comments-status]')).toHaveText(
    '共 3 条评论',
  );

  // Reply to root comment
  await rootItem.locator('> .comment-reply').click();
  await expect(page.locator('[data-reply-banner]')).toBeVisible();
  await page.locator('#comment-body').fill('回复站长的一条留言');
  await page.locator('[data-comment-submit]').click();
  await expect(page.locator('[data-comments-status]')).toHaveText(
    '共 4 条评论',
  );
  await expect(rootItem.locator('.comment-replies')).toContainText(
    '回复站长的一条留言',
  );

  // 429 rate-limit error feedback
  await page.locator('#comment-body').fill('触发限流的评论');
  await page.locator('[data-comment-submit]').click();
  await expect(page.locator('[data-form-status]')).toHaveText(
    '发言过于频繁，请稍后再试。',
  );

  // Accessibility check on expanded comments UI
  const axe = await new AxeBuilder({ page })
    .include('.colophon')
    .include('.comments')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(axe.violations).toEqual([]);
});
