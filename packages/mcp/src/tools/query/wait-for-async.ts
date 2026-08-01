/**
 * Shared async-query wait/poll helper for content-reader execution tools.
 */

import { normalizeAsyncQueryResult } from './result-normalizer.js';

import type { NormalizedQueryResult } from './result-normalizer.js';
import type { LightdashClient } from '@lightdash-tools/client';

const POLL_INTERVAL_MS = 500;
/** Tiny page while status is still running to avoid fetching full row pages. */
const RUNNING_PAGE_SIZE = 1;

export async function waitForAsyncQueryResults(
  client: LightdashClient,
  projectUuid: string,
  queryUuid: string,
  opts: { waitMs: number; maxRows: number; page?: number },
): Promise<NormalizedQueryResult> {
  const page = opts.page ?? 1;
  const fullPageSize = Math.min(opts.maxRows, 1000);

  // waitMs <= 0: single fetch with full page — never enter the timeout loop
  // (which would fabricate QUERY_TIMEOUT from an undefined last payload).
  if (opts.waitMs <= 0) {
    const raw = await client.v2.query.getAsyncQueryResults(projectUuid, queryUuid, {
      page,
      pageSize: fullPageSize,
    });
    return normalizeAsyncQueryResult(raw, { maxRows: opts.maxRows });
  }

  const deadline = Date.now() + opts.waitMs;
  let last: unknown;
  while (Date.now() < deadline) {
    last = await client.v2.query.getAsyncQueryResults(projectUuid, queryUuid, {
      page,
      pageSize: RUNNING_PAGE_SIZE,
    });
    const normalized = normalizeAsyncQueryResult(last, { maxRows: opts.maxRows });
    if (normalized.status !== 'running') {
      if (normalized.status === 'complete') {
        last = await client.v2.query.getAsyncQueryResults(projectUuid, queryUuid, {
          page,
          pageSize: fullPageSize,
        });
        return normalizeAsyncQueryResult(last, { maxRows: opts.maxRows });
      }
      return normalized;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  const normalized = normalizeAsyncQueryResult(last, { maxRows: opts.maxRows });
  return {
    ...normalized,
    status: normalized.status === 'complete' ? normalized.status : 'running',
    warnings: [...normalized.warnings, 'QUERY_TIMEOUT'],
  };
}
