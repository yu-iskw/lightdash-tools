/**
 * Pragmatic Zod schemas for dashboard create/update bodies (content-developer).
 * Aligns with CreateDashboard / UpdateDashboard from `@lightdash-tools/common`.
 */

import { z } from 'zod';

import { formatZodIssues, rejectForbiddenKeys } from './parse-helpers.js';

import type { PayloadParseResult } from './parse-helpers.js';

const DASHBOARD_FORBIDDEN_KEYS = [
  'uuid',
  'projectUuid',
  'organizationUuid',
  'createdAt',
  'createdBy',
  'updatedAt',
  'updatedBy',
  'downloadedAt',
  'verification',
  'slug',
] as const;

const dashboardTileOrUnknown = z.unknown();

/**
 * Dashboard create body (preview + create_dashboard).
 * `@see CreateDashboard` in `@lightdash-tools/common`
 */
export const dashboardCreateBodySchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    tiles: z.array(dashboardTileOrUnknown),
    tabs: z.array(z.unknown()),
    spaceUuid: z.string().optional(),
    filters: z.unknown().optional(),
    parameters: z.unknown().optional(),
    pinnedParameters: z.array(z.string()).optional(),
    config: z.unknown().optional(),
    colorPaletteUuid: z.string().nullish(),
  })
  .strict();

/**
 * Dashboard update / preview `changes` body (partial allowlist).
 * `@see UpdateDashboard` in `@lightdash-tools/common`
 */
export const dashboardUpdateBodySchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    tiles: z.array(dashboardTileOrUnknown).optional(),
    tabs: z.array(z.unknown()).optional(),
    spaceUuid: z.string().optional(),
    filters: z.unknown().optional(),
    parameters: z.unknown().optional(),
    pinnedParameters: z.array(z.string()).optional(),
    config: z.unknown().optional(),
    colorPaletteUuid: z.string().nullish(),
    preserveVerification: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Dashboard update body must include at least one field',
  });

/**
 * Preview `changes` accept create-shaped or update-shaped payloads.
 * Create requires name+tiles+tabs; otherwise treat as update allowlist.
 */
export const dashboardChangesBodySchema = z.union([
  dashboardCreateBodySchema,
  dashboardUpdateBodySchema,
]);

function parseWithSchema(
  input: unknown,
  schema: z.ZodType,
  label: string,
): PayloadParseResult<Record<string, unknown>> {
  const forbidden = rejectForbiddenKeys(input, DASHBOARD_FORBIDDEN_KEYS);
  if (forbidden) {
    return forbidden;
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: 'INVALID_ARGUMENT',
      message: `Invalid ${label}: ${formatZodIssues(parsed.error)}`,
    };
  }
  return { ok: true, data: parsed.data as Record<string, unknown> };
}

export function parseDashboardCreateBody(
  input: unknown,
): PayloadParseResult<Record<string, unknown>> {
  return parseWithSchema(input, dashboardCreateBodySchema, 'dashboard create body');
}

export function parseDashboardUpdateBody(
  input: unknown,
): PayloadParseResult<Record<string, unknown>> {
  return parseWithSchema(input, dashboardUpdateBodySchema, 'dashboard update body');
}

export function parseDashboardChangesBody(
  input: unknown,
): PayloadParseResult<Record<string, unknown>> {
  return parseWithSchema(input, dashboardChangesBodySchema, 'dashboard changes body');
}
