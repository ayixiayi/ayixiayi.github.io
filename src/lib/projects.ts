import { getCollection, type CollectionEntry } from 'astro:content';
import nowData from '../data/now.json';
import platesData from '../data/plates.json';
import { postUrl } from './posts';

export type ProjectEntry = CollectionEntry<'projects'>;
export type ProjectStatus = ProjectEntry['data']['status'];

export const projectStatusLabels: Record<ProjectStatus, string> = {
  active: '进行中',
  maintained: '维护中',
  archived: '已归档',
};

export async function getProjects(): Promise<ProjectEntry[]> {
  const entries = (await getCollection('projects')).sort(
    (a, b) => a.data.order - b.data.order || a.id.localeCompare(b.id),
  );
  const seen = new Set<string>();
  for (const project of entries) {
    if (seen.has(project.id)) {
      throw new Error(`Duplicate project id: "${project.id}"`);
    }
    seen.add(project.id);
  }
  return entries;
}

export async function getFeaturedProjects(): Promise<ProjectEntry[]> {
  return (await getProjects()).filter((project) => project.data.featured);
}

export function projectUrl(project: Pick<ProjectEntry, 'id'> | string) {
  const id = typeof project === 'string' ? project : project.id;
  return `/projects/${id.split('/').map(encodeURIComponent).join('/')}/`;
}

export interface TimelineEntry {
  date: Date;
  kind: 'post' | 'project';
  kindLabel: '文章' | '项目';
  title: string;
  summary: string;
  url: string;
}

/** Merge published blog posts and dated project milestones, newest first. */
export function getTimelineEntries(
  posts: CollectionEntry<'blog'>[],
  projects: ProjectEntry[],
): TimelineEntry[] {
  const items: TimelineEntry[] = [
    ...posts.map((post) => ({
      date: post.data.pubDate,
      kind: 'post' as const,
      kindLabel: '文章' as const,
      title: post.data.title,
      summary: post.data.description,
      url: postUrl(post.id),
    })),
    ...projects.flatMap((project) =>
      project.data.milestoneDate
        ? [
            {
              date: project.data.milestoneDate,
              kind: 'project' as const,
              kindLabel: '项目' as const,
              title: project.data.title,
              summary: project.data.summary,
              url: projectUrl(project),
            },
          ]
        : [],
    ),
  ];
  return items.sort(
    (a, b) =>
      b.date.valueOf() - a.date.valueOf() ||
      a.title.localeCompare(b.title, 'zh'),
  );
}

export interface NowItem {
  label: string;
  title: string;
  detail: string;
}

export interface NowData {
  updated: string;
  items: NowItem[];
}

export function getNowData(): NowData {
  return nowData as NowData;
}

export interface PlateEntry {
  numeral: string;
  seed: number;
  title: string;
  caption: string;
  image: string;
  isDefault?: boolean;
}

export function getPlates(): PlateEntry[] {
  return platesData as PlateEntry[];
}
