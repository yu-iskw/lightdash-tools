/**
 * MCP tools: projects (list, get) — shared catalog entries.
 */

import { getPinnedProjectUuid } from '../../governance/project-pin.js';
import { resolveProjectScope } from '../../governance/project-scope.js';
import { CREDENTIALS_OMITTED_WARNING, toProjectSummary } from '../lib/redaction.js';
import { projectUuidField } from '../lib/schema-fields.js';
import { projectScopeErrorResult } from '../query/reader-tool-helpers.js';
import {
  blockedToolContent,
  jsonToolResult,
  registerToolSafe,
  wrapTool,
  READ_ONLY_DEFAULT,
} from '../shared.js';

import type { McpContextProvider } from '../../server/request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

export type RegisterToolOptions = {
  personaId?: string;
};

const READER_CAPABILITIES = {
  canDiscoverContent: true,
  canExecuteSavedCharts: true,
  canExecuteSqlCharts: false,
  canExecuteDashboardTiles: true,
};

const DEVELOPER_CAPABILITIES = {
  canDiscoverContent: true,
  canMutateContent: true,
  canExecuteSavedCharts: false,
  canExecuteSqlCharts: false,
  canExecuteDashboardTiles: false,
};

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

export function registerGetProject(
  server: McpServer,
  contextProvider: McpContextProvider,
  options?: RegisterToolOptions,
): void {
  if (options?.personaId === 'content-reader') {
    registerScopedGetProject(server, contextProvider, 'readerCapabilities', READER_CAPABILITIES);
    return;
  }
  if (options?.personaId === 'content-developer') {
    registerScopedGetProject(
      server,
      contextProvider,
      'developerCapabilities',
      DEVELOPER_CAPABILITIES,
    );
    return;
  }
  registerPinAwareGetProject(server, contextProvider);
}

/**
 * Project-scope-aware get_project shared by content-reader and content-developer (ADR-0012, ADR-0014).
 * Precedence: X-Lightdash-Project -> LIGHTDASH_TOOLS_PROJECT_UUID -> tool projectUuid -> PROJECT_SCOPE_REQUIRED.
 */
function registerScopedGetProject(
  server: McpServer,
  contextProvider: McpContextProvider,
  capabilitiesKey: 'developerCapabilities' | 'readerCapabilities',
  capabilities: Record<string, boolean>,
): void {
  registerToolSafe(
    server,
    'get_project',
    {
      title: 'Get project',
      description:
        'Get project metadata by UUID (no warehouse/dbt credentials or contact overrides). projectUuid is optional when X-Lightdash-Project or LIGHTDASH_TOOLS_PROJECT_UUID is set.',
      inputSchema: { projectUuid: projectUuidField().optional() },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(contextProvider, (c) => async ({ projectUuid }: { projectUuid?: string }) => {
      try {
        const scope = resolveProjectScope({ projectUuid });
        const project = await c.v1.projects.getProject(scope.projectUuid);
        return jsonToolResult({
          data: {
            ...toProjectSummary(project),
            pinned: scope.projectPinned,
            [capabilitiesKey]: capabilities,
          },
          context: {
            projectUuid: scope.projectUuid,
            projectPinned: scope.projectPinned,
            source: scope.source,
          },
          warnings: [CREDENTIALS_OMITTED_WARNING],
        });
      } catch (err) {
        return projectScopeErrorResult(err);
      }
    }),
  );
}

function registerPinAwareGetProject(server: McpServer, contextProvider: McpContextProvider): void {
  registerToolSafe(
    server,
    'get_project',
    {
      title: 'Get project',
      description:
        'Get project metadata by UUID (no warehouse/dbt credentials or contact overrides). projectUuid is optional when X-Lightdash-Project is set.',
      inputSchema: { projectUuid: projectUuidField().optional() },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(contextProvider, (c) => async ({ projectUuid }: { projectUuid?: string }) => {
      const pinned = getPinnedProjectUuid();
      const resolved = projectUuid ?? pinned;
      if (!resolved) {
        return blockedToolContent(
          'Error: projectUuid is required when X-Lightdash-Project is not set.',
        );
      }
      const project = await c.v1.projects.getProject(resolved);
      return jsonToolResult({
        data: toProjectSummary(project),
        warnings: [CREDENTIALS_OMITTED_WARNING],
      });
    }),
  );
}
