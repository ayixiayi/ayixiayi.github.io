import { getPublishedPosts, postUrl, stripMarkdown } from '../lib/posts';
import { getPlates, getProjects, projectUrl } from '../lib/projects';

export async function GET() {
  const [posts, projects] = await Promise.all([
    getPublishedPosts(),
    getProjects(),
  ]);
  const plates = getPlates();

  return Response.json([
    ...posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      url: postUrl(post.id),
      kind: '文章',
      tags: post.data.tags,
      text: [
        post.data.title,
        post.data.description,
        ...post.data.tags,
        stripMarkdown(post.body),
      ].join(' '),
    })),
    ...projects.map((project) => ({
      title: project.data.title,
      description: project.data.summary,
      url: projectUrl(project),
      kind: '项目',
      tags: project.data.tags,
      text: [
        project.data.title,
        project.data.subtitle ?? '',
        project.data.summary,
        ...project.data.tags,
        ...project.data.stack,
        ...project.data.highlights,
        stripMarkdown(project.body),
      ]
        .filter(Boolean)
        .join(' '),
    })),
    {
      title: '风景图录',
      description:
        '六幅精选程序生成山谷与远景宫殿构图，可按种子编号重新绘制或下载。',
      url: '/plates/',
      kind: '图录',
      tags: ['生成艺术', '图录', 'Seed'],
      text: [
        '风景图录',
        'Plates',
        '生成艺术',
        '程序风景',
        '种子',
        ...plates.flatMap((plate) => [
          plate.title,
          plate.caption,
          `seed ${plate.seed}`,
        ]),
      ].join(' '),
    },
  ]);
}
