/**
 * MCP tools: projects (list, get) — shared catalog entries.
 */

import { projectUuidField } from './schema-fields.js';
import {
  READ_ONLY_CAPABILITY,
  jsonToolResult,
  registerToolSafe,
  wrapToolAnnotated,
} from './shared.js';

import type { McpContextProvider } from '../request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

export function registerListProjects(server: McpServer, contextProvider: McpContextProvider): void {
  registerToolSafe(
    server,
    'list_projects',
    {
      title: 'List projects',
      description: 'List all projects in the current organization',
      inputSchema: {},
      annotations: READ_ONLY_CAPABILITY.annotations,
    },
    wrapToolAnnotated(contextProvider, READ_ONLY_CAPABILITY, (c) => async () => {
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
      annotations: READ_ONLY_CAPABILITY.annotations,
    },
    wrapToolAnnotated(
      contextProvider,
      READ_ONLY_CAPABILITY,
      (c) =>
        async ({ projectUuid }: { projectUuid: string }) => {
          const project = await c.v1.projects.getProject(projectUuid);
          return jsonToolResult(project);
        },
    ),
  );
}
