/**
 * MCP tools: query (compile, run).
 */

import { z } from 'zod';

import { projectUuidField } from './schema-fields.js';
import {
  READ_ONLY_CAPABILITY,
  READ_ONLY_DEFAULT,
  registerToolSafe,
  wrapToolAnnotated,
} from './shared.js';

import type { McpContextProvider } from '../request-context.js';
import type { LightdashClient } from '@lightdash-tools/client';
import type {
  ExecuteAsyncMetricQueryRequestParams,
  ReadyQueryResultsPage,
} from '@lightdash-tools/common';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

type ResultRow = ReadyQueryResultsPage['rows'][number];

/** Hard row cap for run_metric_query (= Lightdash's default pageSize). */
const ROW_CAP = 500;
/** Overall poll timeout; the query is cancelled and an error returned past this point. */
const TIMEOUT_MS = 30_000;
/** Poll backoff schedule in ms: immediate first check, then bounded backoff to a 2s ceiling. */
const POLL_SCHEDULE_MS = [0, 300, 600, 1200];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextDelayMs(attempt: number): number {
  // eslint-disable-next-line security/detect-object-injection -- attempt is an internal counter, not user input
  return attempt < POLL_SCHEDULE_MS.length ? POLL_SCHEDULE_MS[attempt] : 2000;
}

/**
 * Polls getAsyncQueryResults for one page until it's ready, throwing on
 * error/expired/cancelled or on overall timeout (cancelling the query first).
 */
async function pollForReadyPage(
  client: LightdashClient,
  projectUuid: string,
  queryUuid: string,
  page: number,
  deadline: number,
): Promise<ReadyQueryResultsPage> {
  for (let attempt = 0; ; attempt += 1) {
    const delay = nextDelayMs(attempt);
    if (delay > 0) {
      await sleep(delay);
    }
    if (Date.now() >= deadline) {
      await client.v2.query.cancelAsyncQuery(projectUuid, queryUuid).catch(() => undefined);
      throw new Error(
        `run_metric_query timed out after ${TIMEOUT_MS / 1000}s waiting for query ${queryUuid} ` +
          '— narrow the query (add filters, a limit, or a coarser time grain) and try again.',
      );
    }

    const result = await client.v2.query.getAsyncQueryResults(projectUuid, queryUuid, {
      page,
      pageSize: ROW_CAP,
    });

    switch (result.status) {
      case 'ready':
        return result;
      case 'error':
      case 'expired':
        throw new Error(result.error ?? `Query ${queryUuid} ${result.status}`);
      case 'cancelled':
        throw new Error(`Query ${queryUuid} was cancelled.`);
      case 'pending':
      case 'queued':
      case 'executing':
        break; // keep polling
    }
  }
}

export function registerQueryTools(server: McpServer, contextProvider: McpContextProvider): void {
  registerToolSafe(
    server,
    'compile_query',
    {
      title: 'Compile query',
      description: 'Compile a metric query for an explore without executing it',
      inputSchema: {
        projectUuid: projectUuidField(),
        exploreId: z.string().describe('Explore ID'),
        metricQuery: z
          .record(z.string(), z.unknown())
          .describe('Metric query object (dimensions, metrics, filters, etc.)'),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapToolAnnotated(
      contextProvider,
      READ_ONLY_CAPABILITY,
      (c) =>
        async ({
          projectUuid,
          exploreId,
          metricQuery,
        }: {
          projectUuid: string;
          exploreId: string;
          metricQuery: Record<string, unknown>;
        }) => {
          const result = await c.v1.query.compileQuery(
            projectUuid,
            exploreId,
            metricQuery as never,
          );
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        },
    ),
  );

  registerToolSafe(
    server,
    'run_metric_query',
    {
      title: 'Run metric query',
      description:
        'Execute a metric query for an explore and return result rows, under the ' +
        "caller's own Lightdash permissions (same governance as compile_query, but " +
        'actually run against the warehouse). Runs asynchronously under the hood ' +
        '(execute, then poll until ready) and returns one JSON result. Rows are ' +
        `hard-capped at ${ROW_CAP}; check the returned \`truncated\` flag and ` +
        '`totalResults`, and add a `limit` or coarser aggregation to the metric ' +
        'query rather than relying on pagination for large results.',
      inputSchema: {
        projectUuid: projectUuidField(),
        exploreId: z.string().describe('Explore ID'),
        metricQuery: z
          .record(z.string(), z.unknown())
          .describe('Metric query object (dimensions, metrics, filters, sorts, limit, etc.)'),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapToolAnnotated(
      contextProvider,
      READ_ONLY_CAPABILITY,
      (c) =>
        async ({
          projectUuid,
          exploreId,
          metricQuery,
        }: {
          projectUuid: string;
          exploreId: string;
          metricQuery: Record<string, unknown>;
        }) => {
          const body = {
            context: 'mcp.run_metric_query',
            query: { ...metricQuery, exploreName: exploreId },
          } as unknown as ExecuteAsyncMetricQueryRequestParams;

          const {
            queryUuid,
            fields,
            metricQuery: resolvedMetricQuery,
          } = await c.v2.query.runMetricQuery(projectUuid, body);

          const deadline = Date.now() + TIMEOUT_MS;
          const rows: ResultRow[] = [];
          let page = 1;
          let lastPage: ReadyQueryResultsPage;

          for (;;) {
            const pageResult = await pollForReadyPage(c, projectUuid, queryUuid, page, deadline);
            rows.push(...pageResult.rows);
            lastPage = pageResult;
            if (rows.length >= ROW_CAP || pageResult.nextPage == null) {
              break;
            }
            page = pageResult.nextPage;
          }

          const cappedRows = rows.slice(0, ROW_CAP);
          const truncated = cappedRows.length < lastPage.totalResults;
          const payload = {
            rows: cappedRows,
            columns: lastPage.columns,
            fields,
            metricQuery: resolvedMetricQuery,
            totalResults: lastPage.totalResults,
            truncated,
          };
          return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
        },
    ),
  );
}
