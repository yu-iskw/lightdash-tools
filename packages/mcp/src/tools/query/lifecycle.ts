/**
 * Query lifecycle tools: poll results and cancel queries by queryUuid handle.
 */

import { z } from 'zod';

import { ProjectScopeError, resolveProjectScope } from '../../governance/project-scope.js';
import { SAVED_EXECUTION_SAFETY, registerContentReaderTool } from '../../policy/content-reader.js';
import { contentReaderEnvelope } from '../../policy/envelope.js';
import { clampWaitMs } from '../../policy/result-limits.js';
import { includeArtifactsField, parseIncludeArtifacts } from '../lib/artifacts.js';
import { projectUuidField } from '../lib/schema-fields.js';
import { jsonToolResult, wrapTool } from '../shared.js';
import { defineTool } from '../types.js';

import { buildQueryArtifactResult } from './query-artifact-result.js';
import { findQueryLedgerEntry, releaseQueryLedgerBudget } from './query-ledger.js';
import {
  codedErrorResult,
  isCoverageComplete,
  isTerminalStatus,
  warningFromNormalizedMessage,
} from './reader-tool-helpers.js';
import { normalizeAsyncQueryResult } from './result-normalizer.js';
import { waitForAsyncQueryResults } from './wait-for-async.js';

import type { McpContextProvider } from '../../server/request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

export function registerGetQueryResult(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerContentReaderTool(
    server,
    'get_query_result',
    {
      title: 'Get query result',
      description:
        'Poll or retrieve a query started by this profile (by queryUuid handle). Rows are a separate data artifact by default (ADR-0032). Shared by content-reader and data-analyst.',
      safety: SAVED_EXECUTION_SAFETY,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        queryUuid: z.string(),
        waitMs: z.number().int().nonnegative().optional(),
        page: z.number().int().positive().optional(),
        pageSize: z.number().int().positive().max(1000).optional(),
        includeArtifacts: includeArtifactsField(['data']),
      },
    },
    (profile) =>
      wrapTool(
        contextProvider,
        (c) =>
          async (args: {
            projectUuid?: string;
            queryUuid: string;
            waitMs?: number;
            page?: number;
            pageSize?: number;
            includeArtifacts?: Array<'data'>;
          }) => {
            try {
              const scope = resolveProjectScope({ projectUuid: args.projectUuid });
              // Ledger is best-effort (same replica); queryUuid is the durable handle.
              const ledgerEntry = findQueryLedgerEntry({
                projectUuid: scope.projectUuid,
                queryUuid: args.queryUuid,
              });
              const include = parseIncludeArtifacts(args.includeArtifacts, ['data']);

              const waitMs = clampWaitMs(args.waitMs ?? 0);
              const pageSize = args.pageSize ?? 100;
              const page = args.page ?? 1;
              const normalized =
                waitMs > 0
                  ? await waitForAsyncQueryResults(c, scope.projectUuid, args.queryUuid, {
                      waitMs,
                      maxRows: pageSize,
                      page,
                    })
                  : normalizeAsyncQueryResult(
                      await c.v2.query.getAsyncQueryResults(scope.projectUuid, args.queryUuid, {
                        page,
                        pageSize,
                      }),
                      { maxRows: pageSize },
                    );

              if (ledgerEntry && isTerminalStatus(normalized.status)) {
                releaseQueryLedgerBudget(ledgerEntry);
              }

              return buildQueryArtifactResult({
                profile,
                projectUuid: scope.projectUuid,
                projectPinned: scope.projectPinned,
                normalized,
                include,
                complete: isCoverageComplete(normalized),
                warnings: normalized.warnings.map(warningFromNormalizedMessage),
              });
            } catch (err) {
              if (err instanceof ProjectScopeError) {
                return codedErrorResult(err.code, err.message);
              }
              throw err;
            }
          },
      ),
  );
}

export function registerCancelQuery(server: McpServer, contextProvider: McpContextProvider): void {
  registerContentReaderTool(
    server,
    'cancel_query',
    {
      title: 'Cancel query',
      description: 'Cancel a running query by queryUuid handle',
      safety: SAVED_EXECUTION_SAFETY,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        queryUuid: z.string(),
      },
    },
    (profile) =>
      wrapTool(
        contextProvider,
        (c) => async (args: { projectUuid?: string; queryUuid: string }) => {
          try {
            const scope = resolveProjectScope({ projectUuid: args.projectUuid });
            const ledgerEntry = findQueryLedgerEntry({
              projectUuid: scope.projectUuid,
              queryUuid: args.queryUuid,
            });
            await c.v2.query.cancelAsyncQuery(scope.projectUuid, args.queryUuid);
            if (ledgerEntry) {
              releaseQueryLedgerBudget(ledgerEntry);
            }
            return jsonToolResult(
              contentReaderEnvelope(
                { queryUuid: args.queryUuid, cancelled: true },
                {
                  profile,
                  projectUuid: scope.projectUuid,
                  projectPinned: scope.projectPinned,
                },
              ),
            );
          } catch (err) {
            if (err instanceof ProjectScopeError) {
              return codedErrorResult(err.code, err.message);
            }
            throw err;
          }
        },
      ),
  );
}

// ToolModule exports (profile mounts)
export const getQueryResultTool = defineTool('get_query_result', registerGetQueryResult);
export const cancelQueryTool = defineTool('cancel_query', registerCancelQuery);
