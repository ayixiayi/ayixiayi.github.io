import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Tags typed in the CMS arrive in many shapes ("#随想", "＃随想＃recap",
 * "随想, recap", empty YAML null, or a bare scalar string). Split on hash marks
 * and list separators, trim, and deduplicate case-insensitively while keeping
 * the first-seen display casing so every page sees the same clean list.
 */
const tags = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === '') return [];
    if (typeof value === 'string') return [value];
    return value;
  },
  z
    .array(z.string())
    .default([])
    .transform((raw) => {
      const seen = new Map<string, string>();
      for (const tag of raw
        .flatMap((entry) => entry.split(/[#＃,，、]/))
        .map((entry) => entry.trim())
        .filter(Boolean)) {
        const key = tag.toLowerCase();
        if (!seen.has(key)) seen.set(key, tag);
      }
      return [...seen.values()];
    }),
);

const optionalString = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.string().trim().min(1).optional(),
);

const optionalUrl = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.url().optional(),
);

const optionalDate = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.coerce.date().optional(),
);

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string().trim().min(1),
    description: z.string().trim().min(1),
    pubDate: z.coerce.date(),
    updatedDate: optionalDate,
    tags,
    // An optional short address (/blog/<slug>/); without it the file name is used.
    slug: z.preprocess(
      // Clearing the optional CMS field writes an empty string; empty YAML is null.
      (value) => (value === '' || value === null ? undefined : value),
      z
        .string()
        .regex(
          /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
          'slug 只能包含小写字母、数字和连字符，例如 tool-paradox',
        )
        .optional(),
    ),
    draft: z.preprocess(
      (value) => (value === '' || value === null ? undefined : value),
      z.boolean().default(false),
    ),
    comments: z.preprocess(
      (value) => (value === '' || value === null ? undefined : value),
      z.boolean().default(true),
    ),
  }),
});

const projects = defineCollection({
  // Absolute file URL keeps the real project catalogue shared across prod and fixture test builds.
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: new URL('./content/projects', import.meta.url),
  }),
  schema: z.object({
    title: z.string().trim().min(1),
    subtitle: optionalString,
    summary: z.string().trim().min(1),
    tags,
    stack: tags,
    repo: z.string().trim().min(1),
    demo: optionalUrl,
    motif: z.enum(['memory', 'orchestration', 'music']),
    status: z.enum(['active', 'maintained', 'archived']).default('active'),
    period: z.string().trim().min(1),
    order: z.number().int().min(1),
    featured: z.boolean().default(true),
    milestoneDate: optionalDate,
    credits: optionalString,
    highlights: z.preprocess(
      (value) => (value === undefined || value === null ? [] : value),
      z.array(z.string().trim().min(1)).default([]),
    ),
    sources: z.preprocess(
      (value) => (value === undefined || value === null ? [] : value),
      z
        .array(
          z.object({
            label: z.string().trim().min(1),
            url: z.url(),
          }),
        )
        .default([]),
    ),
    slug: z.preprocess(
      (value) => (value === '' || value === null ? undefined : value),
      z
        .string()
        .regex(
          /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
          'slug 只能包含小写字母、数字和连字符，例如 openmem',
        )
        .optional(),
    ),
  }),
});

export const collections = { blog, projects };
