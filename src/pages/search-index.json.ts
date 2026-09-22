import { projects } from '../data/site';
import { getPublishedPosts, postUrl } from '../lib/posts';

export async function GET() {
  const posts = await getPublishedPosts();
  return Response.json([
    ...posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      url: postUrl(post.id),
      kind: '文章',
      text: [
        post.data.title,
        post.data.description,
        ...(post.data.tags ?? []),
        post.body,
      ].join(' '),
    })),
    ...projects.map((project) => ({
      title: project.title,
      description: project.description,
      url: `/projects/#${project.title.toLowerCase()}`,
      kind: '项目',
      text: [project.title, project.description, ...project.tags].join(' '),
    })),
  ]);
}
