import { z } from 'zod';

export const PROJECT_UUID_DESC = 'Project UUID';

/** Prompt-body hint when projectUuid arg is omitted (HTTP pin or PROJECT_SCOPE_REQUIRED). */
export const PROMPT_PROJECT_UUID_HINT =
  '(pass on every tool, or use HTTP pin — else PROJECT_SCOPE_REQUIRED)' as const;

/** Eager prompt line for optional projectUuid (HTTP pin or ask). */
export function formatPromptProjectUuidLine(projectUuid?: string): string {
  return `Project UUID: ${projectUuid ?? PROMPT_PROJECT_UUID_HINT}.`;
}

export const projectUuidField = (): z.ZodString => z.string().describe(PROJECT_UUID_DESC);

/** Optional projectUuid when HTTP pin (`X-Lightdash-Project`) can resolve scope. */
export const optionalProjectUuidField = (): z.ZodOptional<z.ZodString> =>
  projectUuidField().optional();

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
