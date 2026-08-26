/**
 * Resolve saved SQL charts via sqlRunner GET (ADR-0032 reveal path).
 */

import { validateUuid } from '@lightdash-tools/common';

import { isNotFoundError } from '../lib/api-errors.js';

import { findChartContentMatch } from './chart-source.js';

import type { LightdashClient, SqlChart } from '@lightdash-tools/client';

function looksLikeUuid(id: string): boolean {
  try {
    validateUuid(id);
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch a saved SQL chart by UUID or slug (authored SQL included in the client payload).
 * Callers must keep `sql` out of the MCP summary body (artifact opt-in only).
 * Non-404 API failures are rethrown (not treated as “try another path”).
 */
export async function resolveSavedSqlChart(
  client: LightdashClient,
  projectUuid: string,
  chartUuidOrSlug: string,
): Promise<SqlChart> {
  if (looksLikeUuid(chartUuidOrSlug)) {
    try {
      return await client.v1.sqlRunner.getSavedSqlChart(projectUuid, chartUuidOrSlug);
    } catch (err) {
      if (!isNotFoundError(err)) {
        throw err;
      }
    }
  }
  try {
    return await client.v1.sqlRunner.getSavedSqlChartBySlug(projectUuid, chartUuidOrSlug);
  } catch (err) {
    if (!isNotFoundError(err)) {
      throw err;
    }
  }
  const match = await findChartContentMatch(client, projectUuid, chartUuidOrSlug);
  if (!match || match.source !== 'sql') {
    throw new Error(`Saved SQL chart '${chartUuidOrSlug}' was not found`);
  }
  return client.v1.sqlRunner.getSavedSqlChart(projectUuid, match.uuid);
}
