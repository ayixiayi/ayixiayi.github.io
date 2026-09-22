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

export function displayTag(tag: string) {
  return tag.replace(/^[#＃]+/, '');
}
