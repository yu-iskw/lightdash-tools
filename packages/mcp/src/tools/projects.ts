/**
 * MCP tools: projects (list, get).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LightdashClient } from '@lightdash-tools/client';
import { z } from 'zod';
import { wrapTool, registerToolSafe, READ_ONLY_DEFAULT } from './shared.js';

export function registerProjectTools(server: McpServer, client: LightdashClient): void {
  registerToolSafe(
    server,
    'list_projects',
    {
      title: 'List projects',
      description: 'List all projects in the current organization',
      inputSchema: {},
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(client, () => async () => {
      const projects = await client.v1.projects.listProjects();
      return { content: [{ type: 'text', text: JSON.stringify(projects, null, 2) }] };
    }),
  );
  registerToolSafe(
    server,
    'get_project',
    {
      title: 'Get project',
      description: 'Get a project by UUID',
      inputSchema: { projectUuid: z.string().describe('Project UUID') },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(client, (c) => async ({ projectUuid }: { projectUuid: string }) => {
      const project = await c.v1.projects.getProject(projectUuid);
      return { content: [{ type: 'text', text: JSON.stringify(project, null, 2) }] };
    }),
  );
}
