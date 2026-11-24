import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { site } from '../data/site';
import { getPublishedPosts, postUrl } from '../lib/posts';

export async function GET(context: APIContext) {
  const posts = await getPublishedPosts();
  const baseSite = context.site ?? site.url;
  const selfUrl = new URL('/rss.xml', baseSite).href;
  return rss({
    title: `${site.name} · 随笔与记录`,
    description: site.description,
    site: baseSite,
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: postUrl(post.id),
      categories: post.data.tags,
    })),
    customData: `<language>zh-CN</language><atom:link href="${selfUrl}" rel="self" type="application/rss+xml"/>`,
  });
}
