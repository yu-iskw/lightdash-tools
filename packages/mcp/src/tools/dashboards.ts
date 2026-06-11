/**
 * MCP tools: dashboards (list).
 */

import { projectUuidField } from './schema-fields.js';
import { wrapTool, registerToolSafe, READ_ONLY_DEFAULT } from './shared.js';

import type { LightdashClient } from '@lightdash-tools/client';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerDashboardTools(server: McpServer, client: LightdashClient): void {
  registerToolSafe(
    server,
    'list_dashboards',
    {
      title: 'List dashboards',
      description: 'List dashboards in a project',
      inputSchema: { projectUuid: projectUuidField() },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(client, (c) => async ({ projectUuid }: { projectUuid: string }) => {
      const dashboards = await c.v1.dashboards.listDashboards(projectUuid);
      return { content: [{ type: 'text', text: JSON.stringify(dashboards, null, 2) }] };
    }),
  );
}
