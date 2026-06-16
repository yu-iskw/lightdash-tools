/**
 * MCP tools: dashboards (list).
 */

import { projectUuidField } from './schema-fields.js';
import {
  READ_ONLY_CAPABILITY,
  READ_ONLY_DEFAULT,
  registerToolSafe,
  wrapToolAnnotated,
} from './shared.js';

import type { McpContextProvider } from '../request-context.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerListDashboardsTool(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'list_dashboards',
    {
      title: 'List dashboards',
      description: 'List dashboards in a project',
      inputSchema: { projectUuid: projectUuidField() },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapToolAnnotated(
      contextProvider,
      READ_ONLY_CAPABILITY,
      (c) =>
        async ({ projectUuid }: { projectUuid: string }) => {
          const dashboards = await c.v1.dashboards.listDashboards(projectUuid);
          return { content: [{ type: 'text', text: JSON.stringify(dashboards, null, 2) }] };
        },
    ),
  );
}

export function registerDashboardTools(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerListDashboardsTool(server, contextProvider);
}
