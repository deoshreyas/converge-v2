import { defineCollection, z } from 'astro:content';

const guidesCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    author: z.string(),
    description: z.string(),
    bannerImg: z.string(),
  }),
});

export const collections = {
  guides: guidesCollection,
};