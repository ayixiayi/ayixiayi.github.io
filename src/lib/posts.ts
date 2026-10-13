import { getCollection } from 'astro:content';

// Every public surface shares this boundary, including routes and machine-readable feeds.
export async function getPublishedPosts() {
  return (await getCollection('blog', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );
}

export function postUrl(id: string) {
  return `/blog/${id.split('/').map(encodeURIComponent).join('/')}/`;
}

/** The share card generated for a post at build time. */
export function cardUrl(id: string) {
  return `/og/${id.split('/').map(encodeURIComponent).join('/')}.png`;
}

export function formatDate(date: Date) {
  return date.toISOString().slice(0, 10).replaceAll('-', '.');
}

export function readingMinutes(body = '') {
  const chinese =
    body.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu)
      ?.length ?? 0;
  const words =
    body
      .replace(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu, '')
      .match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
  return Math.max(1, Math.ceil(chinese / 350 + words / 220));
}

export function tagUrl(tag: string) {
  return `/blog/tags/${encodeURIComponent(tag)}/`;
}

type Post = Awaited<ReturnType<typeof getPublishedPosts>>[number];

/** Every tag in use, most-used first, with how many posts carry it. */
export function tagCounts(posts: Post[]) {
  const counts = new Map<string, number>();
  for (const post of posts)
    for (const tag of post.data.tags)
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'zh'));
}
