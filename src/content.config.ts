import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Tags typed in the CMS arrive in many shapes ("#随想", "＃随想＃recap",
 * "随想, recap"). Split on hash marks and list separators, trim, and drop
 * duplicates so every page sees the same clean list.
 */
const tags = z
  .array(z.string())
  .default([])
  .transform((raw) => [
    ...new Set(
      raw
        .flatMap((tag) => tag.split(/[#＃,，、]/))
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ]);

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    tags,
    // An optional short address (/blog/<slug>/); without it the file name is used.
    slug: z
      .string()
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        'slug 只能包含小写字母、数字和连字符，例如 tool-paradox',
      )
      .optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
