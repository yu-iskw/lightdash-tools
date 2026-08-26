/**
 * Classify / resolve saved charts via content search before chart GET.
 */

import { asPaginated } from '../lib/api-shape.js';

import type { LightdashClient } from '@lightdash-tools/client';

export type ChartSourceClass = 'semantic' | 'sql' | 'unknown';

export type ChartContentMatch = {
  uuid: string;
  slug?: string;
  source?: string;
  name?: string;
  description?: string | null;
  space?: { uuid: string; name: string };
  lastUpdatedAt?: string | null;
};

export type ChartSourceResolution = {
  class: ChartSourceClass;
  uuid?: string;
  slug?: string;
  name?: string;
  description?: string | null;
  space?: { uuid: string; name: string };
  lastUpdatedAt?: string | null;
};

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function optionalStringOrNull(value: unknown): string | null | undefined {
  if (typeof value === 'string' || value === null) {
    return value;
  }
  return undefined;
}

function spaceNameUuid(value: unknown): { uuid: string; name: string } | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const space = value as { uuid?: unknown; name?: unknown };
  if (typeof space.uuid === 'string' && typeof space.name === 'string') {
    return { uuid: space.uuid, name: space.name };
  }
  return undefined;
}

function toChartContentMatch(match: Record<string, unknown>): ChartContentMatch | undefined {
  if (typeof match.uuid !== 'string') {
    return undefined;
  }
  return {
    uuid: match.uuid,
    slug: optionalString(match.slug),
    source: optionalString(match.source),
    name: optionalString(match.name),
    description: optionalStringOrNull(match.description),
    space: spaceNameUuid(match.space),
    lastUpdatedAt: optionalStringOrNull(match.lastUpdatedAt),
  };
}

/** Exact uuid/slug chart hit from `search_content` (first page). */
export async function findChartContentMatch(
  client: LightdashClient,
  projectUuid: string,
  chartUuidOrSlug: string,
): Promise<ChartContentMatch | undefined> {
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
  return match ? toChartContentMatch(match) : undefined;
}

function classFromSource(source: string | undefined): ChartSourceClass {
  if (source === 'sql') {
    return 'sql';
  }
  if (source === 'dbt_explore') {
    return 'semantic';
  }
  return 'unknown';
}

/** Classify plus identity from one search (avoid a second search on the SQL reveal path). */
export async function resolveChartSource(
  client: LightdashClient,
  projectUuid: string,
  chartUuidOrSlug: string,
): Promise<ChartSourceResolution> {
  const match = await findChartContentMatch(client, projectUuid, chartUuidOrSlug);
  if (!match) {
    return { class: 'unknown' };
  }
  return {
    class: classFromSource(match.source),
    uuid: match.uuid,
    slug: match.slug,
    name: match.name,
    description: match.description,
    space: match.space,
    lastUpdatedAt: match.lastUpdatedAt,
  };
}

/**
 * Look up chart source from search_content (`ChartContent.source`).
 * Returns unknown when no exact uuid/slug match is found.
 */
export async function classifyChartSource(
  client: LightdashClient,
  projectUuid: string,
  chartUuidOrSlug: string,
): Promise<ChartSourceClass> {
  return (await resolveChartSource(client, projectUuid, chartUuidOrSlug)).class;
}
