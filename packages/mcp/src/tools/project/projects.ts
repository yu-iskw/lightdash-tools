/**
 * MCP tools: projects (list, get).
 */

import { filterProjectsByAvailability } from '../../governance/available-projects.js';
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
import { defineTool, defineToolVariant } from '../types.js';

import type { McpContextProvider } from '../../server/request-context.js';
import type { ToolModule } from '../types.js';
import type { McpServer } from '@modelcontextprotocol/server';

const READER_CAPABILITIES = {
  canDiscoverContent: true,
  canExecuteSavedCharts: true,
  canExecuteSqlCharts: false,
  canExecuteDashboardTiles: true,
  canExecuteDashboardSqlTiles: true,
  canRevealSqlBodies: true,
} as const;

const DEVELOPER_CAPABILITIES = {
  canDiscoverContent: true,
  canMutateContent: true,
  canExecuteSavedCharts: false,
  canExecuteSqlCharts: false,
  canExecuteDashboardTiles: false,
} as const;

const ANALYST_CAPABILITIES = {
  canDiscoverExplores: true,
  canCompileMetricQuery: true,
  canRunMetricQuery: true,
  canExecuteSavedCharts: false,
  canExecuteSqlCharts: false,
  canMutateContent: false,
} as const;

type ScopedGetProjectConfig = {
  capabilitiesKey: 'analystCapabilities' | 'developerCapabilities' | 'readerCapabilities';
  capabilities: Readonly<Record<string, boolean>>;
};

const GET_PROJECT_TOOL_OPTIONS = {
  title: 'Get project',
  description:
    'Get project metadata by UUID (no warehouse/dbt credentials or contact overrides). projectUuid is optional when X-Lightdash-Project is set.',
  inputSchema: { projectUuid: projectUuidField().optional() },
  annotations: READ_ONLY_DEFAULT,
} as const;

export function registerListProjects(server: McpServer, contextProvider: McpContextProvider): void {
  registerToolSafe(
    server,
    'list_projects',
    {
      title: 'List projects',
      description:
        'List project metadata in the current organization (or the pinned project when X-Lightdash-Project is set). When LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS is set, only those projects are returned. Connection credentials are never returned.',
      inputSchema: {},
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(contextProvider, (c) => async () => {
      const pinned = getPinnedProjectUuid();
      const projects = pinned
        ? [await c.v1.projects.getProject(pinned)]
        : await c.v1.projects.listProjects();
      const summaries = filterProjectsByAvailability(projects.map((p) => toProjectSummary(p)));
      return jsonToolResult({
        data: summaries,
        warnings: [CREDENTIALS_OMITTED_WARNING],
      });
    }),
  );
}

/** Project-scope-aware get_project (pin → tool arg → PROJECT_SCOPE_REQUIRED). */
function registerScopedGetProject(
  server: McpServer,
  contextProvider: McpContextProvider,
  config: ScopedGetProjectConfig,
): void {
  const { capabilitiesKey, capabilities } = config;
  registerToolSafe(
    server,
    'get_project',
    GET_PROJECT_TOOL_OPTIONS,
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
    GET_PROJECT_TOOL_OPTIONS,
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

function getProjectModule(register: ToolModule['register']): ToolModule {
  return defineToolVariant('get_project', register);
}

function scopedGetProjectVariant(config: ScopedGetProjectConfig): ToolModule {
  return getProjectModule((server, contextProvider) => {
    registerScopedGetProject(server, contextProvider, config);
  });
}

// ToolModule exports (profile mounts)
export const listProjectsTool = defineTool('list_projects', registerListProjects);
/** Pin-aware get_project (semantic-layer and other non-scoped mounts). */
export const getProjectTool = getProjectModule(registerPinAwareGetProject);
export const getProjectReaderTool = scopedGetProjectVariant({
  capabilitiesKey: 'readerCapabilities',
  capabilities: READER_CAPABILITIES,
});
export const getProjectDeveloperTool = scopedGetProjectVariant({
  capabilitiesKey: 'developerCapabilities',
  capabilities: DEVELOPER_CAPABILITIES,
});
export const getProjectAnalystTool = scopedGetProjectVariant({
  capabilitiesKey: 'analystCapabilities',
  capabilities: ANALYST_CAPABILITIES,
});
