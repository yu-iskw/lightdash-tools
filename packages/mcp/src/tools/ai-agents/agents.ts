/**
 * Project AI agent inventory tools (ai-agent-ops and ai-agent-chat profiles).
 */

import {
  buildSecureCreateAiAgentBody,
  collectElevationWarnings,
  collectElevationWarningsFromPatch,
  digestCreateAgentPayload,
  formatAgentPermissionSummary,
  normalizeAgentTags,
  WRITE_NONDESTRUCTIVE,
  type AgentCreatePayloadFields,
  type UpdateAiAgent,
} from '@lightdash-tools/common';
import { z } from 'zod';

import { resolveProjectScope } from '../../governance/project-scope.js';
import {
  confirmCreateAgentPreviewToken,
  CreateAgentPreviewError,
  mintDraftCreateAgentPreviewToken,
} from '../../policy/create-agent-preview.js';
import { projectScopeErrorResult } from '../query/reader-tool-helpers.js';
import {
  jsonToolResult,
  registerToolSafe,
  wrapTool,
  wrapToolContextual,
  READ_ONLY_DEFAULT,
  withLightdashBlockedMarker,
} from '../shared.js';
import { defineTool } from '../types.js';

import {
  buildCreateAgentConfirmationMessage,
  previewExploreCountForTags,
} from './create-elicitation.js';
import { gateCreateProjectAgent } from './gate-create-project-agent.js';
import {
  agentUuidField,
  optionalProjectUuidField,
  withAiAgentProjectScope,
  type AiAgentScopeArgs,
} from './helpers.js';
import { warningsForAgentTags } from './tag-warnings.js';

import type { McpContextProvider } from '../../server/request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

const TAGS_FIELD_DESCRIPTION =
  'Explore/field allowlist matching dbt model tags and/or Lightdash meta field tags (OR). ' +
  'Null or empty = all project explores. Verify with get_explore_access_summary before setting; ' +
  'invented tags that match nothing yield TAGS_MATCH_NO_EXPLORES.';

const projectAgentPatchFields = {
  description: z.string().nullable().optional().describe('Agent description'),
  instruction: z.string().nullable().optional().describe('System instruction for the agent'),
  tags: z.array(z.string()).nullable().optional().describe(TAGS_FIELD_DESCRIPTION),
  enableDataAccess: z
    .boolean()
    .optional()
    .describe(
      'Read rows behind a chart (default: off). Requires explicit true to enable warehouse data access.',
    ),
  enableContentTools: z
    .boolean()
    .optional()
    .describe(
      'Create and edit saved content (default: off). Requires data access when enabled upstream.',
    ),
  enableSqlMode: z
    .boolean()
    .optional()
    .describe(
      'Run SQL against the warehouse (default: off). Subject to per-query user approval in Lightdash.',
    ),
  enableSelfImprovement: z
    .boolean()
    .optional()
    .describe('Allow self-improvement features (default: off)'),
  enableUserContext: z
    .boolean()
    .optional()
    .describe('See user information — name, role, groups (default: off)'),
  adminOnly: z
    .boolean()
    .optional()
    .describe(
      'Restrict to admins & developers only (default: on). Set false for everyone or use userAccess/groupAccess.',
    ),
  groupAccess: z.array(z.string()).optional().describe('Group UUIDs with access'),
  userAccess: z.array(z.string()).optional().describe('User UUIDs with access'),
  spaceAccess: z.array(z.string()).optional().describe('Space UUIDs with access'),
  mcpServerUuids: z.array(z.string()).optional().describe('Nested MCP server UUIDs'),
} as const;

type ProjectAgentPatchArgs = {
  description?: string | null;
  instruction?: string | null;
  tags?: string[] | null;
  enableDataAccess?: boolean;
  enableContentTools?: boolean;
  enableSqlMode?: boolean;
  enableSelfImprovement?: boolean;
  enableUserContext?: boolean;
  adminOnly?: boolean;
  groupAccess?: string[];
  userAccess?: string[];
  spaceAccess?: string[];
  mcpServerUuids?: string[];
};

type CreateProjectAgentArgs = ProjectAgentPatchArgs & {
  name: string;
  projectUuid?: string;
  createConfirmToken?: string;
};

function buildCreatePayload(args: CreateProjectAgentArgs): AgentCreatePayloadFields {
  const { name, projectUuid, createConfirmToken, ...patch } = args;
  void projectUuid;
  void createConfirmToken;
  return { name, ...patch };
}

async function resolveCreateProjectUuid(
  projectUuid: string | undefined,
): Promise<
  | { ok: false; result: ReturnType<typeof projectScopeErrorResult> }
  | { ok: true; projectUuid: string }
> {
  try {
    return { ok: true, projectUuid: resolveProjectScope({ projectUuid }).projectUuid };
  } catch (err) {
    return { ok: false, result: projectScopeErrorResult(err) };
  }
}

function assignIfDefined<T extends object, K extends keyof T>(
  target: Partial<T>,
  key: K,
  value: T[K] | undefined,
): void {
  if (value !== undefined) {
    // eslint-disable-next-line security/detect-object-injection -- key is a fixed literal at each call site
    target[key] = value;
  }
}

function buildUpdateProjectAgentBody(
  agentUuid: string,
  args: ProjectAgentPatchArgs & { name?: string },
): UpdateAiAgent {
  const patch: Partial<UpdateAiAgent> = {};
  assignIfDefined(patch, 'name', args.name);
  assignIfDefined(patch, 'description', args.description);
  assignIfDefined(patch, 'instruction', args.instruction);
  if (args.tags !== undefined) {
    assignIfDefined(patch, 'tags', normalizeAgentTags(args.tags));
  }
  assignIfDefined(patch, 'enableDataAccess', args.enableDataAccess);
  assignIfDefined(patch, 'enableContentTools', args.enableContentTools);
  assignIfDefined(patch, 'enableSqlMode', args.enableSqlMode);
  assignIfDefined(patch, 'enableSelfImprovement', args.enableSelfImprovement);
  assignIfDefined(patch, 'enableUserContext', args.enableUserContext);
  assignIfDefined(patch, 'adminOnly', args.adminOnly);
  assignIfDefined(patch, 'groupAccess', args.groupAccess);
  assignIfDefined(patch, 'userAccess', args.userAccess);
  assignIfDefined(patch, 'spaceAccess', args.spaceAccess);
  assignIfDefined(patch, 'mcpServerUuids', args.mcpServerUuids);
  return { uuid: agentUuid, ...patch };
}

export function registerListProjectAgents(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'list_project_agents',
    {
      title: 'List project AI agents',
      description: 'List AI agents in the resolved project (project-scoped API).',
      inputSchema: { projectUuid: optionalProjectUuidField() },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({ projectUuid }: { projectUuid?: string }) =>
          withAiAgentProjectScope(projectUuid, async (scope) => ({
            data: await c.v1.aiAgents.listAgents(scope.projectUuid),
          })),
    ),
  );
}

export function registerGetProjectAgent(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'get_project_agent',
    {
      title: 'Get project AI agent',
      description: 'Get a single AI agent configuration in the resolved project.',
      inputSchema: {
        projectUuid: optionalProjectUuidField(),
        agentUuid: agentUuidField(),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({ projectUuid, agentUuid }: AiAgentScopeArgs) =>
          withAiAgentProjectScope(projectUuid, async (scope) => ({
            data: await c.v1.aiAgents.getAgent(scope.projectUuid, agentUuid),
          })),
    ),
  );
}

export function registerPreviewCreateAgent(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'preview_create_agent',
    {
      title: 'Preview create project AI agent',
      description:
        'Preview a new Lightdash AI agent create (permission matrix + explore tag scope). ' +
        'Returns createPreviewToken for confirm_create_agent. No upstream write.',
      inputSchema: {
        projectUuid: optionalProjectUuidField(),
        name: z.string().min(1).describe('Agent display name'),
        ...projectAgentPatchFields,
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapToolContextual(contextProvider, (ctx) => {
      const aiAgents = ctx.lightdashClient.v1.aiAgents;
      return async (rawArgs: CreateProjectAgentArgs) => {
        const scope = await resolveCreateProjectUuid(rawArgs.projectUuid);
        if (!scope.ok) {
          return scope.result;
        }
        const payload = buildCreatePayload(rawArgs);
        const exploreCount = await previewExploreCountForTags(
          aiAgents,
          scope.projectUuid,
          payload.tags,
        );
        const payloadDigest = digestCreateAgentPayload(payload);
        const { createPreviewToken, claims } = await mintDraftCreateAgentPreviewToken({
          subject: ctx.subject,
          projectUuid: scope.projectUuid,
          agentName: payload.name,
          payloadDigest,
          serverContext: ctx.serverContext,
        });
        const permissionSummary = formatAgentPermissionSummary(payload, {
          groupAccess: payload.groupAccess,
          userAccess: payload.userAccess,
        });
        const confirmationMessage = buildCreateAgentConfirmationMessage({
          name: payload.name,
          payload,
          tags: payload.tags,
          exploreCount,
        });
        const elevationPreviewWarnings = collectElevationWarnings(payload);
        return withAiAgentProjectScope(scope.projectUuid, async () => ({
          data: {
            createPreviewToken,
            previewId: claims.previewId,
            payloadDigest,
            permissionSummary,
            confirmationMessage,
            exploreCount,
          },
          warnings: elevationPreviewWarnings,
        }));
      };
    }),
  );
}

export function registerConfirmCreateAgent(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'confirm_create_agent',
    {
      title: 'Confirm create project AI agent preview',
      description:
        'Confirm a preview_create_agent draft after human approval. Returns createConfirmToken ' +
        'for create_project_agent. No upstream write.',
      inputSchema: {
        projectUuid: optionalProjectUuidField(),
        name: z.string().min(1).describe('Agent display name (must match preview)'),
        createPreviewToken: z.string().min(1).describe('Draft token from preview_create_agent'),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapToolContextual(
      contextProvider,
      (ctx) =>
        async (rawArgs: { projectUuid?: string; name: string; createPreviewToken: string }) => {
          const scope = await resolveCreateProjectUuid(rawArgs.projectUuid);
          if (!scope.ok) {
            return scope.result;
          }
          try {
            const { createConfirmToken, claims } = await confirmCreateAgentPreviewToken({
              createPreviewToken: rawArgs.createPreviewToken,
              subject: ctx.subject,
              projectUuid: scope.projectUuid,
              agentName: rawArgs.name,
              serverContext: ctx.serverContext,
            });
            return withAiAgentProjectScope(scope.projectUuid, async () => ({
              data: {
                createConfirmToken,
                previewId: claims.previewId,
                status: claims.status,
              },
            }));
          } catch (err) {
            if (err instanceof CreateAgentPreviewError) {
              return withLightdashBlockedMarker(
                jsonToolResult({
                  status: 'blocked',
                  code: err.code,
                  message: err.message,
                  created: false,
                }),
              );
            }
            throw err;
          }
        },
    ),
  );
}

export function registerCreateProjectAgent(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'create_project_agent',
    {
      title: 'Create project AI agent',
      description:
        'Create a Lightdash AI agent in the resolved project. Requires MCP form elicitation ' +
        '(human confirm_create) or, when form elicitation is unavailable, a validated ' +
        'createConfirmToken from preview_create_agent -> confirm_create_agent. After accept, ' +
        'non-empty tags that match no explores yield TAGS_MATCH_NO_EXPLORES (agent is still created). ' +
        'For integrations, imageUrl, or modelConfig use CLI agents create --file or agentops apply.',
      inputSchema: {
        projectUuid: optionalProjectUuidField(),
        name: z.string().min(1).describe('Agent display name'),
        createConfirmToken: z
          .string()
          .optional()
          .describe(
            'Validated token from confirm_create_agent when the client lacks MCP form elicitation',
          ),
        ...projectAgentPatchFields,
      },
      annotations: WRITE_NONDESTRUCTIVE,
    },
    wrapToolContextual(contextProvider, (ctx) => {
      const aiAgents = ctx.lightdashClient.v1.aiAgents;
      return async (rawArgs: CreateProjectAgentArgs) => {
        const scope = await resolveCreateProjectUuid(rawArgs.projectUuid);
        if (!scope.ok) {
          return scope.result;
        }

        const payload = buildCreatePayload(rawArgs);
        const gate = await gateCreateProjectAgent({
          server,
          ctx,
          projectUuid: scope.projectUuid,
          payload,
          exploreAccessClient: aiAgents,
          createConfirmToken: rawArgs.createConfirmToken,
        });
        if (!gate.proceed) {
          return gate.result;
        }

        return withAiAgentProjectScope(scope.projectUuid, async (resolvedScope) => {
          const data = await aiAgents.createAgent(
            resolvedScope.projectUuid,
            buildSecureCreateAiAgentBody({ ...payload, projectUuid: resolvedScope.projectUuid }),
          );
          const tagWarnings = await warningsForAgentTags(
            aiAgents,
            resolvedScope.projectUuid,
            payload.tags,
          );
          const permissionWarnings = collectElevationWarnings(payload);
          return { data, warnings: [...tagWarnings, ...permissionWarnings] };
        });
      };
    }),
  );
}

export function registerUpdateProjectAgent(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'update_project_agent',
    {
      title: 'Update project AI agent',
      description:
        'Patch a Lightdash AI agent in the resolved project. Omit fields to leave them unchanged. ' +
        'No form elicitation. When tags are set and match no explores, returns TAGS_MATCH_NO_EXPLORES ' +
        '(update still applied). Agent delete is not available on MCP — use CLI agents delete.',
      inputSchema: {
        projectUuid: optionalProjectUuidField(),
        agentUuid: agentUuidField(),
        name: z.string().min(1).optional().describe('Agent display name'),
        ...projectAgentPatchFields,
      },
      annotations: WRITE_NONDESTRUCTIVE,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({
          projectUuid,
          agentUuid,
          ...patch
        }: AiAgentScopeArgs & ProjectAgentPatchArgs & { name?: string }) =>
          withAiAgentProjectScope(projectUuid, async (scope) => {
            const data = await c.v1.aiAgents.updateAgent(
              scope.projectUuid,
              agentUuid,
              buildUpdateProjectAgentBody(agentUuid, patch),
            );
            const tagWarnings =
              patch.tags === undefined
                ? []
                : await warningsForAgentTags(c.v1.aiAgents, scope.projectUuid, patch.tags);
            const permissionWarnings = collectElevationWarningsFromPatch(patch);
            return { data, warnings: [...tagWarnings, ...permissionWarnings] };
          }),
    ),
  );
}

export function registerGetUserAgentPreferences(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'get_user_agent_preferences',
    {
      title: 'Get user agent preferences',
      description:
        "Read the current user's per-project default AI agent (null when none is set). Does not set or delete preferences.",
      inputSchema: { projectUuid: optionalProjectUuidField() },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({ projectUuid }: { projectUuid?: string }) =>
          withAiAgentProjectScope(projectUuid, async (scope) => ({
            data: await c.v1.aiAgents.getUserAgentPreferences(scope.projectUuid),
          })),
    ),
  );
}

// ToolModule exports (profile mounts)
export const listProjectAgentsTool = defineTool('list_project_agents', registerListProjectAgents);
export const getProjectAgentTool = defineTool('get_project_agent', registerGetProjectAgent);
export const previewCreateAgentTool = defineTool(
  'preview_create_agent',
  registerPreviewCreateAgent,
);
export const confirmCreateAgentTool = defineTool(
  'confirm_create_agent',
  registerConfirmCreateAgent,
);
export const createProjectAgentTool = defineTool(
  'create_project_agent',
  registerCreateProjectAgent,
);
export const updateProjectAgentTool = defineTool(
  'update_project_agent',
  registerUpdateProjectAgent,
);
export const getUserAgentPreferencesTool = defineTool(
  'get_user_agent_preferences',
  registerGetUserAgentPreferences,
);
