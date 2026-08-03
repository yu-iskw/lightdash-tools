/**
 * MCP tools: projects (list, get) — shared catalog entries.
 */

import { requireServerPersona } from '../../audit/server-persona.js';
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

import type { McpContextProvider } from '../../server/request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

const READER_CAPABILITIES = {
  canDiscoverContent: true,
  canExecuteSavedCharts: true,
  canExecuteSqlCharts: false,
  canExecuteDashboardTiles: true,
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

const SCOPED_GET_PROJECT_BY_PERSONA: Readonly<Record<string, ScopedGetProjectConfig>> = {
  'content-reader': {
    capabilitiesKey: 'readerCapabilities',
    capabilities: READER_CAPABILITIES,
  },
  'content-developer': {
    capabilitiesKey: 'developerCapabilities',
    capabilities: DEVELOPER_CAPABILITIES,
  },
  'data-analyst': {
    capabilitiesKey: 'analystCapabilities',
    capabilities: ANALYST_CAPABILITIES,
  },
};

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

export function registerGetProject(server: McpServer, contextProvider: McpContextProvider): void {
  const personaId = requireServerPersona(server, 'get_project');
  // eslint-disable-next-line security/detect-object-injection -- personaId from requireServerPersona
  const scoped = SCOPED_GET_PROJECT_BY_PERSONA[personaId];
  if (scoped) {
    registerScopedGetProject(server, contextProvider, scoped);
    return;
  }
  registerPinAwareGetProject(server, contextProvider);
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
    {
      title: 'Get project',
      description:
        'Get project metadata by UUID (no warehouse/dbt credentials or contact overrides). projectUuid is optional when X-Lightdash-Project is set.',
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
