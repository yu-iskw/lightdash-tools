/**
 * MCP tools: explores (list, get).
 */

import { z } from 'zod';

import { exploreIdField, projectUuidField } from './schema-fields.js';
import { wrapTool, registerToolSafe, READ_ONLY_DEFAULT } from './shared.js';

import type { LightdashClient } from '@lightdash-tools/client';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerExploresTools(server: McpServer, client: LightdashClient): void {
  registerToolSafe(
    server,
    'list_explores',
    {
      title: 'List explores',
      description: 'List all explores in a project',
      inputSchema: { projectUuid: projectUuidField() },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(client, (c) => async ({ projectUuid }: { projectUuid: string }) => {
      const explores = await c.v1.explores.listExplores(projectUuid);
      return { content: [{ type: 'text', text: JSON.stringify(explores, null, 2) }] };
    }),
  );
  registerToolSafe(
    server,
    'get_explore',
    {
      title: 'Get explore',
      description:
        'Get an explore by project UUID and explore ID (includes tables, dimensions, and metrics)',
      inputSchema: {
        projectUuid: projectUuidField(),
        exploreId: exploreIdField(),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      client,
      (c) =>
        async ({ projectUuid, exploreId }: { projectUuid: string; exploreId: string }) => {
          const explore = await c.v1.explores.getExplore(projectUuid, exploreId);
          return { content: [{ type: 'text', text: JSON.stringify(explore, null, 2) }] };
        },
    ),
  );
  registerToolSafe(
    server,
    'list_dimensions',
    {
      title: 'List dimensions',
      description: 'List all dimensions for a specific explore',
      inputSchema: {
        projectUuid: projectUuidField(),
        exploreId: exploreIdField(),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      client,
      (c) =>
        async ({ projectUuid, exploreId }: { projectUuid: string; exploreId: string }) => {
          const result = await c.v1.explores.listDimensions(projectUuid, exploreId);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        },
    ),
  );
  registerToolSafe(
    server,
    'get_field_lineage',
    {
      title: 'Get field lineage',
      description: 'Get upstream lineage for a specific field in an explore',
      inputSchema: {
        projectUuid: projectUuidField(),
        exploreId: exploreIdField(),
        fieldId: z.string().describe('Field ID'),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      client,
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
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        },
    ),
  );
}
