/**
 * Resolve saved SQL charts via sqlRunner GET (ADR-0032 reveal path).
 */

import { asPaginated } from '../lib/api-shape.js';

import type { LightdashClient, SqlChart } from '@lightdash-tools/client';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Look up saved SQL UUID from content search when the caller passed a slug. */
async function savedSqlUuidFromSearch(
  client: LightdashClient,
  projectUuid: string,
  chartUuidOrSlug: string,
): Promise<string | undefined> {
  const result = await client.v2.content.searchContent({
    projectUuids: [projectUuid],
    contentTypes: ['chart'],
    search: chartUuidOrSlug,
    pageSize: 25,
  });
  const { data } = asPaginated<Record<string, unknown>>(result);
  const match = data.find((item) => {
    if (item.contentType !== 'chart' || item.source !== 'sql') {
      return false;
    }
    return item.uuid === chartUuidOrSlug || item.slug === chartUuidOrSlug;
  });
  return typeof match?.uuid === 'string' ? match.uuid : undefined;
}

/**
 * Fetch a saved SQL chart by UUID or slug (authored SQL included in the client payload).
 * Callers must keep `sql` out of the MCP summary body (artifact opt-in only).
 */
export async function resolveSavedSqlChart(
  client: LightdashClient,
  projectUuid: string,
  chartUuidOrSlug: string,
): Promise<SqlChart> {
  if (UUID_RE.test(chartUuidOrSlug)) {
    try {
      return await client.v1.sqlRunner.getSavedSqlChart(projectUuid, chartUuidOrSlug);
    } catch {
      // Fall through to slug / search resolution.
    }
  }
  try {
    return await client.v1.sqlRunner.getSavedSqlChartBySlug(projectUuid, chartUuidOrSlug);
  } catch {
    const uuid = await savedSqlUuidFromSearch(client, projectUuid, chartUuidOrSlug);
    if (!uuid) {
      throw new Error(`Saved SQL chart '${chartUuidOrSlug}' was not found`);
    }
    return client.v1.sqlRunner.getSavedSqlChart(projectUuid, uuid);
  }
}
