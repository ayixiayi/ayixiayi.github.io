import { getCollection } from 'astro:content';

// Every public surface shares this boundary, including routes and machine-readable feeds.
export async function getPublishedPosts() {
  const posts = (await getCollection('blog', ({ data }) => !data.draft)).sort(
    (a, b) =>
      b.data.pubDate.valueOf() - a.data.pubDate.valueOf() ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const seen = new Set<string>();
  for (const post of posts) {
    if (seen.has(post.id)) {
      throw new Error(`Duplicate published post id: "${post.id}"`);
    }
    seen.add(post.id);
  }
  return posts;
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

/**
 * Strip Markdown syntax to plain searchable/countable prose while keeping
 * readable text (link labels, alt text, code identifiers like `openmemory_store`).
 */
export function stripMarkdown(body = '') {
  return body
    .replace(/\r\n?/g, '\n')
    .replace(/^[ \t]*(`{3,}|~{3,})[^\n]*$/gm, '')
    .replace(/^[ \t]*\[[^\]]+\]:[ \t]+\S+.*$/gm, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/<\/?[a-zA-Z][^>]*>/g, ' ')
    .replace(/^[ \t]*(?:[-*_][ \t]*){3,}$/gm, ' ')
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
    .replace(/^[ \t]*>[ \t]?/gm, '')
    .replace(/^[ \t]*(?:[-*+]|\d+\.)[ \t]+/gm, '')
    .replace(/(\*\*|__|~~)([^*\n_~]+?)\1/g, '$2')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/(^|[^\p{L}\p{N}_])_([^_\n]+)_(?=[^\p{L}\p{N}_]|$)/gu, '$1$2')
    .replace(/\\([\\`*_{}[\]()#+\-.!~>])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function readingMinutes(body = '') {
  const plain = stripMarkdown(body);
  const chinese =
    plain.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu)
      ?.length ?? 0;
  const words =
    plain
      .replace(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu, '')
      .match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
  return Math.max(1, Math.ceil(chinese / 350 + words / 220));
}

export function projectSlug(title: string) {
  const slug = title
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'project';
}

export function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Shift heading tags down one level (`<h1>`→`<h2>`, ..., `<h5>`→`<h6>`) when
 * rendered Markdown prose contains an `<h1>`, preserving heading `id`s for the
 * table of contents and leaving `<pre>`/`<code>` blocks untouched.
 */
export function demoteHeadingsHtml(html: string) {
  const parts = html.split(/(<pre\b[\s\S]*?<\/pre>|<code\b[\s\S]*?<\/code>)/gi);
  const hasH1 = parts.some(
    (part, index) => index % 2 === 0 && /<h1(?:\s|>)/i.test(part),
  );
  if (!hasH1) return html;
  return parts
    .map((part, index) =>
      index % 2 === 1
        ? part
        : part.replace(
            /<(\/?)h([1-5])(?=[\s>])/gi,
            (_, close: string, level: string) =>
              `<${close}h${Number(level) + 1}`,
          ),
    )
    .join('');
}

export function tagKey(tag: string) {
  return tag.toLowerCase();
}

/** Keep ordinary tag addresses; encode all others into one unambiguous segment. */
export function tagSlug(tag: string) {
  const canonical = tagKey(tag);
  if (
    /^[\p{L}\p{N}_-]+$/u.test(canonical) &&
    canonical === canonical.normalize()
  )
    return canonical;
  // The reserved prefix is never used by the unchanged form. Encoding every
  // code point also keeps literal escape sequences distinct from their inputs.
  return `~${[...canonical].map((char) => char.codePointAt(0)!.toString(16)).join('-')}`;
}

export function tagUrl(tag: string) {
  return `/blog/tags/${encodeURIComponent(tagSlug(tag))}/`;
}

type Post = Awaited<ReturnType<typeof getPublishedPosts>>[number];

/** Every tag in use, grouped case-insensitively, most-used first. */
export function tagCounts(posts: Post[]) {
  const groups = new Map<string, { tag: string; count: number }>();
  for (const post of posts) {
    const seenInPost = new Set<string>();
    for (const tag of post.data.tags) {
      const key = tagKey(tag);
      if (seenInPost.has(key)) continue;
      seenInPost.add(key);
      const existing = groups.get(key);
      if (existing) existing.count += 1;
      else groups.set(key, { tag, count: 1 });
    }
  }
  return [...groups.values()].sort(
    (a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'zh'),
  );
}
