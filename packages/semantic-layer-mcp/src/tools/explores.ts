/**
 * MCP tools: explores (list, get, dimensions, lineage).
 */

import { READ_ONLY_DEFAULT } from '@lightdash-tools/common';
import { z } from 'zod';

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
      description: 'List all explores in a project',
      inputSchema: z.object({ projectUuid: projectUuidField() }),
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(contextProvider, (c) => async ({ projectUuid }: { projectUuid: string }) => {
      const explores = await c.v1.explores.listExplores(projectUuid);
      return jsonToolResult(explores);
    }),
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
      description: 'List all dimensions for a specific explore',
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
          return jsonToolResult(result);
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
