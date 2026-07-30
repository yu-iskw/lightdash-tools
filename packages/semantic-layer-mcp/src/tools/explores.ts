/**
 * MCP tools: explores (list, get, dimensions, lineage).
 */

import { READ_ONLY_DEFAULT } from '@lightdash-tools/common';
import { z } from 'zod';

import { summarizeDimensions, summarizeExplores } from './explore-helpers.js';
import { exploreIdField, projectUuidField } from './schema-fields.js';
import { jsonToolResult, wrapTool } from './shared.js';

import type { McpContextProvider } from '../request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

export function registerExploresTools(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  server.registerTool(
    'list_explores',
    {
      title: 'List explores',
      description:
        'List explore summaries (name, label, tags, databaseName, schemaName, errors?, warnings?); optional search/limit (client-side after full list fetch)',
      inputSchema: z.object({
        projectUuid: projectUuidField(),
        search: z.string().optional().describe('Filter by name, label, tag, database, or schema'),
        limit: z.number().int().positive().optional().describe('Max explores to return'),
      }),
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({
          projectUuid,
          search,
          limit,
        }: {
          projectUuid: string;
          search?: string;
          limit?: number;
        }) => {
          const explores = await c.v1.explores.listExplores(projectUuid);
          return jsonToolResult(summarizeExplores(explores, { search, limit }));
        },
    ),
  );

  server.registerTool(
    'get_explore',
    {
      title: 'Get explore',
      description:
        'Get an explore by project UUID and explore ID (includes tables, dimensions, and metrics)',
      inputSchema: z.object({
        projectUuid: projectUuidField(),
        exploreId: exploreIdField(),
      }),
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({ projectUuid, exploreId }: { projectUuid: string; exploreId: string }) => {
          const explore = await c.v1.explores.getExplore(projectUuid, exploreId);
          return jsonToolResult(explore);
        },
    ),
  );

  server.registerTool(
    'list_dimensions',
    {
      title: 'List dimensions',
      description:
        'List compact dimensions (name, label, table, type, fieldId). Defaults to base-table only (`table` === exploreId); set baseTableOnly=false for joined tables.',
      inputSchema: z.object({
        projectUuid: projectUuidField(),
        exploreId: exploreIdField(),
        baseTableOnly: z
          .boolean()
          .optional()
          .describe('When true (default), only dimensions on the explore base table'),
      }),
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({
          projectUuid,
          exploreId,
          baseTableOnly,
        }: {
          projectUuid: string;
          exploreId: string;
          baseTableOnly?: boolean;
        }) => {
          const result = await c.v1.explores.listDimensions(projectUuid, exploreId);
          const baseOnly = baseTableOnly !== false;
          return jsonToolResult(
            summarizeDimensions(result, baseOnly ? { baseTable: exploreId } : undefined),
          );
        },
    ),
  );

  server.registerTool(
    'get_field_lineage',
    {
      title: 'Get field lineage',
      description: 'Get upstream lineage for a specific field in an explore',
      inputSchema: z.object({
        projectUuid: projectUuidField(),
        exploreId: exploreIdField(),
        fieldId: z.string().describe('Field ID'),
      }),
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({
          projectUuid,
          exploreId,
          fieldId,
        }: {
          projectUuid: string;
          exploreId: string;
          fieldId: string;
        }) => {
          const result = await c.v1.explores.getFieldLineage(projectUuid, exploreId, fieldId);
          return jsonToolResult(result);
        },
    ),
  );
}
