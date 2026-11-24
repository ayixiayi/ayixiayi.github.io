/** Autumn of the first year at SJTU; the current grade follows from it. */
const enrolled = 2025;

export const grades = [
  { zh: '大一', en: 'Freshman' },
  { zh: '大二', en: 'Sophomore' },
  { zh: '大三', en: 'Junior' },
  { zh: '大四', en: 'Senior' },
] as const;

/**
 * The grade on a given day. Academic years turn over on 1 September,
 * Beijing time; the site is rebuilt that day so the pages keep up.
 */
export function standing(today = new Date()) {
  const beijing = new Date(today.getTime() + 8 * 60 * 60 * 1000);
  const year =
    beijing.getUTCFullYear() - enrolled + (beijing.getUTCMonth() >= 8 ? 1 : 0);
  return grades[Math.min(Math.max(year, 1), grades.length) - 1];
}

const grade = standing();

export const site = {
  name: 'ayixiayi',
  url: 'https://www.ayixiayi.com',
  description: `SJTU 自动化 · ${grade.en} · 兴趣导向型开发者。`,
  github: 'https://github.com/ayixiayi',
  grade,
  comments: {
    endpoint: 'https://mysite-comments.ayixiayi.workers.dev',
    turnstileSiteKey: '',
  },
};

export const navigation = [
  { href: '/projects/', label: '项目' },
  { href: '/blog/', label: '博客' },
  { href: '/plates/', label: '画册' },
  { href: '/about/', label: '关于' },
];
