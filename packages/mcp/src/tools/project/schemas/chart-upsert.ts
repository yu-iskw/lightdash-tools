/**
 * Pragmatic Zod schema for chart-as-code upsert bodies (content-developer).
 * Aligns with UpsertChartAsCodeBody from `@lightdash-tools/common` without full OpenAPI codegen.
 * Required authoring fields + `.strict()` to reject server-managed / unknown keys.
 */

import { z } from 'zod';

import { formatZodIssues, rejectForbiddenKeys } from './parse-helpers.js';

import type { PayloadParseResult } from './parse-helpers.js';

/** Server-managed / non-authoring keys that must not appear on upsert payloads. */
const CHART_UPSERT_FORBIDDEN_KEYS = [
  'uuid',
  'projectUuid',
  'organizationUuid',
  'createdAt',
  'createdBy',
  'updatedAt',
  'updatedBy',
  'downloadedAt',
  'verification',
  'spaceUuid',
] as const;

/**
 * Chart upsert / preview `changes` body.
 * `@see UpsertChartAsCodeBody` in `@lightdash-tools/common`
 */
export const chartUpsertBodySchema = z
  .object({
    name: z.string().min(1),
    description: z.string().nullish(),
    tableName: z.string().min(1),
    slug: z.string().min(1),
    spaceSlug: z.string().min(1),
    version: z.number(),
    chartConfig: z.unknown(),
    metricQuery: z.record(z.string(), z.unknown()),
    pivotConfig: z.unknown().optional(),
    tableConfig: z.unknown().optional(),
    parameters: z.unknown().optional(),
    dashboardSlug: z.string().optional(),
    contentType: z.literal('chart').optional(),
    verified: z.boolean().optional(),
    force: z.boolean().optional(),
    spaceNames: z.record(z.string(), z.string()).optional(),
    publicSpaceCreate: z.boolean().optional(),
    skipSpaceCreate: z.boolean().optional(),
  })
  .strict();

/** Parse + normalize a chart upsert body; hash the returned object at preview/apply. */
export function parseChartUpsertBody(input: unknown): PayloadParseResult<Record<string, unknown>> {
  const forbidden = rejectForbiddenKeys(input, CHART_UPSERT_FORBIDDEN_KEYS);
  if (forbidden) {
    return forbidden;
  }
  const parsed = chartUpsertBodySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: 'INVALID_ARGUMENT',
      message: `Invalid chart upsert body: ${formatZodIssues(parsed.error)}`,
    };
  }
  return { ok: true, data: parsed.data as Record<string, unknown> };
}
