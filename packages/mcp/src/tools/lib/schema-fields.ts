import { z } from 'zod';

export const PROJECT_UUID_DESC = 'Project UUID';

export const projectUuidField = (): z.ZodString => z.string().describe(PROJECT_UUID_DESC);

/** OpenAPI UuidOrSlug field (dashboard/chart identifiers). */
export const uuidOrSlugField = (description = 'UUID or slug'): z.ZodString =>
  z.string().describe(description);

/** Opt-in full email addresses in MCP responses (default redacted). */
export const includeEmailField = (): z.ZodOptional<z.ZodBoolean> =>
  z.boolean().optional().describe('Return full emails when true (default false)');

/** Domains treated as internal when classifying redacted emails. */
export const allowedEmailDomainsField = (): z.ZodOptional<z.ZodArray<z.ZodString>> =>
  z
    .array(z.string())
    .optional()
    .describe('Domains treated as internal when classifying redacted emails');
