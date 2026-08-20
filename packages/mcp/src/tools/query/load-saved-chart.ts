/**
 * Resolve a saved chart as semantic GET payload or opaque SQL identity (ADR-0027).
 */

import { isNotFoundError } from '../lib/api-errors.js';
import { asRecord } from '../lib/api-shape.js';

import { resolveChartSource, sqlChartMatchFromId, type ChartSourceMatch } from './chart-source.js';

import type { LightdashClient } from '@lightdash-tools/client';

export type LoadedSavedChart =
  { kind: 'semantic'; chart: Record<string, unknown> } | { kind: 'sql'; match: ChartSourceMatch };

export async function loadSavedChartOrOpaqueSql(
  client: LightdashClient,
  projectUuid: string,
  chartUuidOrSlug: string,
  opts: { notFoundAsSql: boolean },
): Promise<LoadedSavedChart> {
  const match = await resolveChartSource(client, projectUuid, chartUuidOrSlug);
  if (match.class === 'sql') {
    return { kind: 'sql', match: sqlChartMatchFromId(chartUuidOrSlug, match) };
  }
  try {
    return {
      kind: 'semantic',
      chart: asRecord(await client.v2.charts.getSavedChart(projectUuid, chartUuidOrSlug)),
    };
  } catch (err) {
    if (opts.notFoundAsSql && isNotFoundError(err)) {
      return { kind: 'sql', match: sqlChartMatchFromId(chartUuidOrSlug, match) };
    }
    throw err;
  }
}
