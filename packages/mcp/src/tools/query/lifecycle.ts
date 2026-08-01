/**
 * Query lifecycle tools: poll results and cancel session-owned queries.
 */

import { z } from 'zod';

import { getToolAuditAuth } from '../../audit/tool-audit-context.js';
import { getMcpClientSessionId } from '../../governance/mcp-client-session.js';
import { ProjectScopeError, resolveProjectScope } from '../../governance/project-scope.js';
import { SAVED_EXECUTION_SAFETY, registerContentReaderTool } from '../../policy/content-reader.js';
import { contentReaderEnvelope } from '../../policy/envelope.js';
import { clampWaitMs } from '../../policy/result-limits.js';
import { projectUuidField } from '../lib/schema-fields.js';
import { jsonToolResult, wrapTool } from '../shared.js';

import { QueryLedgerError, getOwnedQueryLedgerEntry } from './query-ledger.js';
import { codedErrorResult, warningFromNormalizedMessage } from './reader-tool-helpers.js';
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
      description: 'Poll or retrieve a query started by this persona (session-owned only)',
      safety: SAVED_EXECUTION_SAFETY,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        queryUuid: z.string(),
        waitMs: z.number().int().nonnegative().optional(),
        page: z.number().int().positive().optional(),
        pageSize: z.number().int().positive().max(1000).optional(),
      },
    },
    wrapTool(
      contextProvider,
      (c) =>
        async (args: {
          projectUuid?: string;
          queryUuid: string;
          waitMs?: number;
          page?: number;
          pageSize?: number;
        }) => {
          try {
            const scope = resolveProjectScope({ projectUuid: args.projectUuid });
            const sessionId = getMcpClientSessionId();
            const userUuid = getToolAuditAuth()?.subject;
            getOwnedQueryLedgerEntry({
              projectUuid: scope.projectUuid,
              queryUuid: args.queryUuid,
              sessionId,
              userUuid,
            });

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

            return jsonToolResult(
              contentReaderEnvelope(normalized, {
                projectUuid: scope.projectUuid,
                projectPinned: scope.projectPinned,
                complete: !normalized.truncated,
                truncated: normalized.truncated,
                warnings: normalized.warnings.map(warningFromNormalizedMessage),
              }),
            );
          } catch (err) {
            if (err instanceof ProjectScopeError || err instanceof QueryLedgerError) {
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
      description: 'Cancel a running session-owned query',
      safety: SAVED_EXECUTION_SAFETY,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        queryUuid: z.string(),
      },
    },
    wrapTool(contextProvider, (c) => async (args: { projectUuid?: string; queryUuid: string }) => {
      try {
        const scope = resolveProjectScope({ projectUuid: args.projectUuid });
        const sessionId = getMcpClientSessionId();
        const userUuid = getToolAuditAuth()?.subject;
        getOwnedQueryLedgerEntry({
          projectUuid: scope.projectUuid,
          queryUuid: args.queryUuid,
          sessionId,
          userUuid,
        });
        await c.v2.query.cancelAsyncQuery(scope.projectUuid, args.queryUuid);
        return jsonToolResult(
          contentReaderEnvelope(
            { queryUuid: args.queryUuid, cancelled: true },
            { projectUuid: scope.projectUuid, projectPinned: scope.projectPinned },
          ),
        );
      } catch (err) {
        if (err instanceof ProjectScopeError || err instanceof QueryLedgerError) {
          return codedErrorResult(err.code, err.message);
        }
        throw err;
      }
    }),
  );
}
