/**
 * MCP tools: explores (list, get, dimensions, lineage).
 */

import { READ_ONLY_DEFAULT } from '@lightdash-tools/common';
import { z } from 'zod';

import { summarizeExplores, withDimensionFieldIds } from './explore-helpers.js';
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
        'List explore summaries (name, label, tags) for a project; optional search and limit',
      inputSchema: z.object({
        projectUuid: projectUuidField(),
        search: z.string().optional().describe('Filter by name, label, or tag'),
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
          const list = Array.isArray(explores) ? explores : [];
          return jsonToolResult(summarizeExplores(list, { search, limit }));
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
        'List dimensions for an explore; each item includes fieldId ({table}_{name}) for compile_query',
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
          const result = await c.v1.explores.listDimensions(projectUuid, exploreId);
          const list = Array.isArray(result) ? result : [];
          return jsonToolResult(withDimensionFieldIds(list));
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
