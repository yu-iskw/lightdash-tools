/**
 * MCP tools: projects (list, get) — shared catalog entries.
 */

import { getPinnedProjectUuid } from '../governance/project-pin.js';

import { projectUuidField } from './schema-fields.js';
import { jsonToolResult, registerToolSafe, wrapTool, READ_ONLY_DEFAULT } from './shared.js';

import type { McpContextProvider } from '../server/request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

export function registerListProjects(server: McpServer, contextProvider: McpContextProvider): void {
  registerToolSafe(
    server,
    'list_projects',
    {
      title: 'List projects',
      description:
        'List all projects in the current organization (or the single pinned project when X-Lightdash-Project is set)',
      inputSchema: {},
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(contextProvider, (c) => async () => {
      const pinned = getPinnedProjectUuid();
      if (pinned) {
        const project = await c.v1.projects.getProject(pinned);
        return jsonToolResult([project]);
      }
      const projects = await c.v1.projects.listProjects();
      return jsonToolResult(projects);
    }),
  );
}

export function registerGetProject(server: McpServer, contextProvider: McpContextProvider): void {
  registerToolSafe(
    server,
    'get_project',
    {
      title: 'Get project',
      description: 'Get a project by UUID',
      inputSchema: { projectUuid: projectUuidField() },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(contextProvider, (c) => async ({ projectUuid }: { projectUuid: string }) => {
      const project = await c.v1.projects.getProject(projectUuid);
      return jsonToolResult(project);
    }),
  );
}
