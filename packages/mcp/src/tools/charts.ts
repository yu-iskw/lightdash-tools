/**
 * MCP tools: charts (list).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LightdashClient } from '@lightdash-tools/client';
import { z } from 'zod';
import { wrapTool, registerToolSafe } from './shared.js';

export function registerChartTools(server: McpServer, client: LightdashClient): void {
  registerToolSafe(
    server,
    'list_charts',
    {
      title: 'List charts',
      description: 'List charts in a project',
      inputSchema: { projectUuid: z.string().describe('Project UUID') },
    },
    wrapTool(client, (c) => async ({ projectUuid }: { projectUuid: string }) => {
      const charts = await c.v1.charts.listCharts(projectUuid);
      return { content: [{ type: 'text', text: JSON.stringify(charts, null, 2) }] };
    }),
  );
}
