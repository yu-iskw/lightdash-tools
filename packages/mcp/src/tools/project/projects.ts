/**
 * MCP tools: projects (list, get) — shared catalog entries.
 */

import { getPinnedProjectUuid } from '../../governance/project-pin.js';
import { CREDENTIALS_OMITTED_WARNING, toProjectSummary } from '../lib/redaction.js';
import { projectUuidField } from '../lib/schema-fields.js';
import { jsonToolResult, registerToolSafe, wrapTool, READ_ONLY_DEFAULT } from '../shared.js';

import type { McpContextProvider } from '../../server/request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

export function registerListProjects(server: McpServer, contextProvider: McpContextProvider): void {
  registerToolSafe(
    server,
    'list_projects',
    {
      title: 'List projects',
      description:
        'List project metadata in the current organization (or the pinned project when X-Lightdash-Project is set). Connection credentials are never returned.',
      inputSchema: {},
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(contextProvider, (c) => async () => {
      const pinned = getPinnedProjectUuid();
      const projects = pinned
        ? [await c.v1.projects.getProject(pinned)]
        : await c.v1.projects.listProjects();
      return jsonToolResult({
        data: projects.map((p) => toProjectSummary(p)),
        warnings: [CREDENTIALS_OMITTED_WARNING],
      });
    }),
  );
}

export function registerGetProject(server: McpServer, contextProvider: McpContextProvider): void {
  registerToolSafe(
    server,
    'get_project',
    {
      title: 'Get project',
      description:
        'Get project metadata by UUID (no warehouse/dbt credentials or contact overrides)',
      inputSchema: { projectUuid: projectUuidField() },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(contextProvider, (c) => async ({ projectUuid }: { projectUuid: string }) => {
      const project = await c.v1.projects.getProject(projectUuid);
      return jsonToolResult({
        data: toProjectSummary(project),
        warnings: [CREDENTIALS_OMITTED_WARNING],
      });
    }),
  );
}
