/**
 * MCP tools: explores (list, get, dimensions, lineage) — shared catalog.
 */

import { z } from 'zod';

import { resolveProjectScope } from '../../governance/project-scope.js';
import { optionalProjectUuidField } from '../lib/schema-fields.js';
import { projectScopeErrorResult } from '../query/reader-tool-helpers.js';
import { jsonToolResult, registerToolSafe, wrapTool, READ_ONLY_DEFAULT } from '../shared.js';

import {
  flattenExploreDimensions,
  summarizeDimensions,
  summarizeExplores,
} from './explore-helpers.js';
import { exploreIdField } from './schema-fields.js';

import type { McpContextProvider } from '../../server/request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

export function registerListExplores(server: McpServer, contextProvider: McpContextProvider): void {
  registerToolSafe(
    server,
    'list_explores',
    {
      title: 'List explores',
      description:
        'List explore summaries (name, label, tags, databaseName, schemaName, errors?, warnings?); optional search/limit (client-side after full list fetch). projectUuid optional when X-Lightdash-Project is set.',
      inputSchema: {
        projectUuid: optionalProjectUuidField(),
        search: z.string().optional().describe('Filter by name, label, tag, database, or schema'),
        limit: z.number().int().positive().optional().describe('Max explores to return'),
      },
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
          projectUuid?: string;
          search?: string;
          limit?: number;
        }) => {
          try {
            const scope = resolveProjectScope({ projectUuid });
            const explores = await c.v1.explores.listExplores(scope.projectUuid);
            return jsonToolResult(summarizeExplores(explores, { search, limit }));
          } catch (err) {
            return projectScopeErrorResult(err);
          }
        },
    ),
  );
}

export function registerGetExplore(server: McpServer, contextProvider: McpContextProvider): void {
  registerToolSafe(
    server,
    'get_explore',
    {
      title: 'Get explore',
      description:
        'Get an explore by project UUID and explore ID (includes tables, dimensions, and metrics). projectUuid optional when X-Lightdash-Project is set.',
      inputSchema: {
        projectUuid: optionalProjectUuidField(),
        exploreId: exploreIdField(),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({ projectUuid, exploreId }: { projectUuid?: string; exploreId: string }) => {
          try {
            const scope = resolveProjectScope({ projectUuid });
            const explore = await c.v1.explores.getExplore(scope.projectUuid, exploreId);
            return jsonToolResult(explore);
          } catch (err) {
            return projectScopeErrorResult(err);
          }
        },
    ),
  );
}

export function registerListDimensions(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'list_dimensions',
    {
      title: 'List dimensions',
      description:
        'List compact dimensions (name, label, table, type, fieldId). Defaults to base-table only (`table` === explore.baseTable); set baseTableOnly=false for joined tables. projectUuid optional when X-Lightdash-Project is set.',
      inputSchema: {
        projectUuid: optionalProjectUuidField(),
        exploreId: exploreIdField(),
        baseTableOnly: z
          .boolean()
          .optional()
          .describe('When true (default), only dimensions on the explore base table'),
      },
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
          projectUuid?: string;
          exploreId: string;
          baseTableOnly?: boolean;
        }) => {
          try {
            const scope = resolveProjectScope({ projectUuid });
            const explore = await c.v1.explores.getExplore(scope.projectUuid, exploreId);
            const { baseTable, dimensions } = flattenExploreDimensions(explore);
            const baseOnly = baseTableOnly !== false;
            return jsonToolResult(
              summarizeDimensions(dimensions, baseOnly ? { baseTable } : undefined),
            );
          } catch (err) {
            return projectScopeErrorResult(err);
          }
        },
    ),
  );
}

export function registerGetFieldLineage(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'get_field_lineage',
    {
      title: 'Get field lineage',
      description: 'Get upstream lineage for a specific field in an explore',
      inputSchema: {
        projectUuid: optionalProjectUuidField(),
        exploreId: exploreIdField(),
        fieldId: z
          .string()
          .describe('Field id `{table}_{name}` or short field name (see semantic-layer playbook)'),
      },
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
          projectUuid?: string;
          exploreId: string;
          fieldId: string;
        }) => {
          try {
            const scope = resolveProjectScope({ projectUuid });
            const result = await c.v1.explores.getFieldLineage(
              scope.projectUuid,
              exploreId,
              fieldId,
            );
            return jsonToolResult(result);
          } catch (err) {
            return projectScopeErrorResult(err);
          }
        },
    ),
  );
}
