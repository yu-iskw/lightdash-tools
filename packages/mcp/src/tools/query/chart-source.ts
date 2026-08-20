/**
 * Classify saved charts as semantic vs SQL via content search before semantic GET.
 */

import { asPaginated } from '../lib/api-shape.js';

import type { LightdashClient } from '@lightdash-tools/client';

export type ChartSourceClass = 'semantic' | 'sql' | 'unknown';

export type ChartSourceMatch = {
  class: ChartSourceClass;
  uuid?: string;
  slug?: string;
  name?: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function looksLikeUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Opaque SQL identity when search classification missed (prefer slug; UUID is allowed). */
export function sqlChartMatchFromId(
  chartUuidOrSlug: string,
  extras?: Pick<ChartSourceMatch, 'name' | 'slug' | 'uuid'>,
): ChartSourceMatch {
  const uuid = extras?.uuid ?? (looksLikeUuid(chartUuidOrSlug) ? chartUuidOrSlug : undefined);
  const slug = extras?.slug ?? (looksLikeUuid(chartUuidOrSlug) ? undefined : chartUuidOrSlug);
  return { class: 'sql', uuid, slug, name: extras?.name };
}

function matchFromSearchItem(item: Record<string, unknown>): ChartSourceMatch {
  const uuid = typeof item.uuid === 'string' ? item.uuid : undefined;
  const slug = typeof item.slug === 'string' ? item.slug : undefined;
  const name = typeof item.name === 'string' ? item.name : undefined;
  if (item.source === 'sql') {
    return { class: 'sql', uuid, slug, name };
  }
  if (item.source === 'dbt_explore') {
    return { class: 'semantic', uuid, slug, name };
  }
  return { class: 'unknown', uuid, slug, name };
}

/**
 * Look up chart source from search_content (`ChartContent.source`).
 * UUID lookups use the exact `uuids` filter — text search does not match UUIDs.
 * Returns unknown when no exact uuid/slug match is found.
 */
export async function resolveChartSource(
  client: LightdashClient,
  projectUuid: string,
  chartUuidOrSlug: string,
): Promise<ChartSourceMatch> {
  const byUuid = looksLikeUuid(chartUuidOrSlug);
  const result = await client.v2.content.searchContent({
    projectUuids: [projectUuid],
    contentTypes: ['chart'],
    ...(byUuid
      ? { uuids: [chartUuidOrSlug], pageSize: 1 }
      : { search: chartUuidOrSlug, pageSize: 25 }),
  });
  const { data } = asPaginated<Record<string, unknown>>(result);
  const match = data.find((item) => {
    if (item.contentType !== 'chart') {
      return false;
    }
    return item.uuid === chartUuidOrSlug || item.slug === chartUuidOrSlug;
  });
  if (!match) {
    return { class: 'unknown' };
  }
  return matchFromSearchItem(match);
}
