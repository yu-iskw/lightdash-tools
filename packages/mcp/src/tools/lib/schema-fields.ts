import { z } from 'zod';

export const PROJECT_UUID_DESC = 'Project UUID';

export const projectUuidField = (): z.ZodString => z.string().describe(PROJECT_UUID_DESC);

/** OpenAPI UuidOrSlug field (dashboard/chart identifiers). */
export const uuidOrSlugField = (description = 'UUID or slug'): z.ZodString =>
  z.string().describe(description);
