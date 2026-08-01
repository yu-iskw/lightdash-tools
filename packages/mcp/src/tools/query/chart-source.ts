/**
 * Classify saved charts as semantic vs SQL via content search before semantic GET.
 */

import { asPaginated } from '../lib/api-shape.js';

import type { LightdashClient } from '@lightdash-tools/client';

export type ChartSourceClass = 'semantic' | 'sql' | 'unknown';

/**
 * Look up chart source from search_content (`ChartContent.source`).
 * Returns unknown when no exact uuid/slug match is found.
 */
export async function classifyChartSource(
  client: LightdashClient,
  projectUuid: string,
  chartUuidOrSlug: string,
): Promise<ChartSourceClass> {
  const result = await client.v2.content.searchContent({
    projectUuids: [projectUuid],
    contentTypes: ['chart'],
    search: chartUuidOrSlug,
    pageSize: 25,
  });
  const { data } = asPaginated<Record<string, unknown>>(result);
  const match = data.find((item) => {
    if (item.contentType !== 'chart') {
      return false;
    }
    return item.uuid === chartUuidOrSlug || item.slug === chartUuidOrSlug;
  });
  if (!match) {
    return 'unknown';
  }
  if (match.source === 'sql') {
    return 'sql';
  }
  if (match.source === 'dbt_explore') {
    return 'semantic';
  }
  return 'unknown';
}
