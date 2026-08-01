/**
 * Shared budget / ledger / wait / normalize path for content-reader saved execution.
 */

import { getToolAuditAuth } from '../../audit/tool-audit-context.js';
import { getMcpClientSessionId } from '../../governance/mcp-client-session.js';
import { acquireQueryBudget, clampWaitMs, releaseQueryBudget } from '../../policy/result-limits.js';
import { asRecord } from '../lib/api-shape.js';

import { addQueryLedgerEntry } from './query-ledger.js';
import { codedErrorResult, warningFromNormalizedMessage } from './reader-tool-helpers.js';
import { waitForAsyncQueryResults } from './wait-for-async.js';

import type { ContentReaderWarning } from '../../policy/envelope.js';
import type { TextContent } from '../shared.js';
import type { NormalizedQueryResult } from './result-normalizer.js';
import type { LightdashClient } from '@lightdash-tools/client';

export type BoundedSavedQuerySourceType = 'chart' | 'dashboard_tile';

export type RunBoundedSavedQueryArgs = {
  client: LightdashClient;
  projectUuid: string;
  sourceType: BoundedSavedQuerySourceType;
  sourceUuid: string;
  limit: number;
  waitForResults?: boolean;
  timeoutMs?: number;
  /** Kick off the async query; must resolve to a payload with queryUuid. */
  execute: () => Promise<unknown>;
};

export type RunBoundedSavedQueryOk = {
  ok: true;
  queryUuid: string;
  normalized: NormalizedQueryResult;
  warnings: ContentReaderWarning[];
};

export type RunBoundedSavedQueryFail = {
  ok: false;
  result: TextContent;
};

export type RunBoundedSavedQueryResult = RunBoundedSavedQueryFail | RunBoundedSavedQueryOk;

/**
 * Acquire budget, execute, ledger, wait/normalize, and map envelope warnings.
 * Chart/tile validation stays in the tool handlers.
 */
export async function runBoundedSavedQuery(
  args: RunBoundedSavedQueryArgs,
): Promise<RunBoundedSavedQueryResult> {
  const sessionId = getMcpClientSessionId();
  const userUuid = getToolAuditAuth()?.subject;
  acquireQueryBudget(sessionId, userUuid);
  try {
    const exec = await args.execute();
    const execRecord = asRecord(exec);
    const queryUuid = String(execRecord.queryUuid ?? '');
    if (!queryUuid) {
      return {
        ok: false,
        result: codedErrorResult('QUERY_FAILED', 'Lightdash did not return a queryUuid'),
      };
    }

    addQueryLedgerEntry({
      queryUuid,
      sessionId,
      userUuid,
      projectUuid: args.projectUuid,
      sourceType: args.sourceType,
      sourceUuid: args.sourceUuid,
    });

    const waitMs = clampWaitMs(args.timeoutMs);
    const shouldWait = args.waitForResults !== false;
    const normalized = shouldWait
      ? await waitForAsyncQueryResults(args.client, args.projectUuid, queryUuid, {
          waitMs,
          maxRows: args.limit,
        })
      : {
          queryUuid,
          status: 'running' as const,
          fields: [],
          truncated: false,
          warnings: ['QUERY_RUNNING'],
        };

    return {
      ok: true,
      queryUuid,
      normalized,
      warnings: normalized.warnings.map(warningFromNormalizedMessage),
    };
  } finally {
    releaseQueryBudget(sessionId, userUuid);
  }
}
