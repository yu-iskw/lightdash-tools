/**
 * Shared budget / ledger / wait / normalize path for bounded async queries
 * (content-reader saved execution and data-analyst metric-query; ADR-0012 / ADR-0020).
 */

import { getToolAuditAuth } from '../../audit/tool-audit-context.js';
import { getMcpClientSessionId } from '../../governance/mcp-client-session.js';
import { acquireQueryBudget, clampWaitMs, releaseQueryBudget } from '../../policy/result-limits.js';
import { asRecord } from '../lib/api-shape.js';

import {
  addQueryLedgerEntry,
  releaseQueryLedgerBudget,
  type QueryLedgerSourceType,
} from './query-ledger.js';
import {
  codedErrorResult,
  isTerminalStatus,
  warningFromNormalizedMessage,
} from './reader-tool-helpers.js';
import { waitForAsyncQueryResults } from './wait-for-async.js';

import type { ContentReaderWarning } from '../../policy/envelope.js';
import type { TextContent } from '../shared.js';
import type { NormalizedQueryResult } from './result-normalizer.js';
import type { LightdashClient } from '@lightdash-tools/client';

export type RunBoundedSavedQueryArgs = {
  client: LightdashClient;
  projectUuid: string;
  sourceType: QueryLedgerSourceType;
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
 * Concurrency budget is released only when the query reaches a terminal status;
 * still-running queries keep the slot until get_query_result / cancel_query.
 */
export async function runBoundedSavedQuery(
  args: RunBoundedSavedQueryArgs,
): Promise<RunBoundedSavedQueryResult> {
  const sessionId = getMcpClientSessionId();
  const userUuid = getToolAuditAuth()?.subject;
  acquireQueryBudget(sessionId, userUuid);
  let ledgered = false;
  try {
    const exec = await args.execute();
    const execRecord = asRecord(exec);
    const queryUuid = String(execRecord.queryUuid ?? '');
    if (!queryUuid) {
      releaseQueryBudget(sessionId, userUuid);
      return {
        ok: false,
        result: codedErrorResult('QUERY_FAILED', 'Lightdash did not return a queryUuid'),
      };
    }

    const ledgerEntry = addQueryLedgerEntry({
      queryUuid,
      sessionId,
      userUuid,
      projectUuid: args.projectUuid,
      sourceType: args.sourceType,
      sourceUuid: args.sourceUuid,
      budgetHeld: true,
    });
    ledgered = true;

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

    if (isTerminalStatus(normalized.status)) {
      releaseQueryLedgerBudget(ledgerEntry);
    }

    return {
      ok: true,
      queryUuid,
      normalized,
      warnings: normalized.warnings.map(warningFromNormalizedMessage),
    };
  } catch (err) {
    if (!ledgered) {
      releaseQueryBudget(sessionId, userUuid);
    }
    throw err;
  }
}
