/**
 * MCP tools: dashboards (list).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LightdashClient } from '@lightdash-tools/client';
import { z } from 'zod';
import { wrapTool, registerToolSafe } from './shared.js';

export function registerDashboardTools(server: McpServer, client: LightdashClient): void {
  registerToolSafe(
    server,
    'list_dashboards',
    {
      title: 'List dashboards',
      description: 'List dashboards in a project',
      inputSchema: { projectUuid: z.string().describe('Project UUID') },
    },
    wrapTool(client, (c) => async ({ projectUuid }: { projectUuid: string }) => {
      const dashboards = await c.v1.dashboards.listDashboards(projectUuid);
      return { content: [{ type: 'text', text: JSON.stringify(dashboards, null, 2) }] };
    }),
  );
}
