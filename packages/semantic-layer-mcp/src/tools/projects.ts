/**
 * MCP tools: projects (list, get).
 */

import { READ_ONLY_DEFAULT } from '@lightdash-tools/common';
import { z } from 'zod';

import { projectUuidField } from './schema-fields.js';
import { jsonToolResult, wrapTool } from './shared.js';

import type { McpContextProvider } from '../request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

export function registerProjectTools(server: McpServer, contextProvider: McpContextProvider): void {
  server.registerTool(
    'list_projects',
    {
      title: 'List projects',
      description: 'List all projects in the current organization',
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(contextProvider, (c) => async () => {
      const projects = await c.v1.projects.listProjects();
      return jsonToolResult(projects);
    }),
  );

  server.registerTool(
    'get_project',
    {
      title: 'Get project',
      description: 'Get a project by UUID',
      inputSchema: z.object({ projectUuid: projectUuidField() }),
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(contextProvider, (c) => async ({ projectUuid }: { projectUuid: string }) => {
      const project = await c.v1.projects.getProject(projectUuid);
      return jsonToolResult(project);
    }),
  );
}
