/**
 * Pragmatic Zod schema for dashboard tile patches used by add_dashboard_tile.
 * Aligns with CreateDashboardTileBase (+ properties) from `@lightdash-tools/common`.
 */

import { z } from 'zod';

import { formatZodIssues, rejectForbiddenKeys } from './parse-helpers.js';

import type { PayloadParseResult } from './parse-helpers.js';

const DASHBOARD_TILE_TYPES = [
  'saved_chart',
  'sql_chart',
  'markdown',
  'loom',
  'heading',
  'data_app',
] as const;

const TILE_FORBIDDEN_KEYS = [
  'projectUuid',
  'organizationUuid',
  'createdAt',
  'updatedAt',
  'dashboardUuid',
] as const;

/**
 * Tile object accepted by add_dashboard_tile.
 * `@see CreateDashboardTileBase` / DashboardTileTypes in `@lightdash-tools/common`
 */
export const dashboardTileSchema = z
  .object({
    type: z.enum(DASHBOARD_TILE_TYPES),
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
    uuid: z.string().optional(),
    tabUuid: z.string().nullish(),
    properties: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

/** Parse + normalize a dashboard tile; hash via the composed tiles array at apply. */
export function parseDashboardTile(input: unknown): PayloadParseResult<Record<string, unknown>> {
  const forbidden = rejectForbiddenKeys(input, TILE_FORBIDDEN_KEYS);
  if (forbidden) {
    return forbidden;
  }
  const parsed = dashboardTileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: 'INVALID_ARGUMENT',
      message: `Invalid dashboard tile: ${formatZodIssues(parsed.error)}`,
    };
  }
  return { ok: true, data: parsed.data as Record<string, unknown> };
}
