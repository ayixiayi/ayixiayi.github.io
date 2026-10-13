import type { APIRoute, InferGetStaticPropsType } from 'astro';
import { getPublishedPosts, formatDate, readingMinutes } from '../../lib/posts';
import { shareCard } from '../../lib/og';

export async function getStaticPaths() {
  const posts = await getPublishedPosts();
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
}

type Props = InferGetStaticPropsType<typeof getStaticPaths>;

export const GET: APIRoute<Props> = async ({ props: { post } }) => {
  const png = await shareCard(
    post.data.title,
    `${formatDate(post.data.pubDate)}  ·  约 ${readingMinutes(post.body)} 分钟阅读`,
  );
  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png' },
  });
};
