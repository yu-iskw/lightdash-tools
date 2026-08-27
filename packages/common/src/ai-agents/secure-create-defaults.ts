/**
 * Secure-by-default flags for Lightdash AI agent create (MCP, CLI, agentops).
 * More conservative than Lightdash UI defaults — elevation is explicit opt-in.
 */

import { createHash } from 'node:crypto';

import type { CreateAiAgent } from '../types/v1/lightdash-api.js';

export const SECURE_AGENT_CREATE_DEFAULTS = {
  enableDataAccess: false,
  enableContentTools: false,
  enableSqlMode: false,
  enableUserContext: false,
  adminOnly: true,
  enableSelfImprovement: false,
} as const;

export type SecureAgentCreateFlags = {
  enableDataAccess?: boolean;
  enableContentTools?: boolean;
  enableSqlMode?: boolean;
  enableUserContext?: boolean;
  adminOnly?: boolean;
  enableSelfImprovement?: boolean;
};

export type ResolvedSecureAgentCreateFlags = {
  enableDataAccess: boolean;
  enableContentTools: boolean;
  enableSqlMode: boolean;
  enableUserContext: boolean;
  adminOnly: boolean;
  enableSelfImprovement: boolean;
};

export const AGENT_PERMISSION_UI_LABELS = {
  enableDataAccess: 'Read rows behind chart',
  enableContentTools: 'Create/edit content',
  enableSqlMode: 'SQL mode',
  enableUserContext: 'User context',
  enableSelfImprovement: 'Self-improvement',
  adminOnly: 'Admins & developers only',
} as const;

export type AgentCreatePayloadFields = SecureAgentCreateFlags & {
  name: string;
  description?: string | null;
  instruction?: string | null;
  tags?: string[] | null;
  groupAccess?: string[];
  userAccess?: string[];
  spaceAccess?: string[];
  mcpServerUuids?: string[];
};

export type BuildSecureCreateAiAgentInput = AgentCreatePayloadFields & {
  projectUuid: string;
};

function sortedStrings(values: string[] | undefined): string[] {
  return values === undefined ? [] : [...values].sort();
}

function canonicalTagsForDigest(tags: string[] | null | undefined): string[] | null {
  const normalized = normalizeAgentTags(tags);
  return normalized == null ? null : sortedStrings(normalized);
}

function canonicalCreateAgentPayload(payload: AgentCreatePayloadFields): Record<string, unknown> {
  const flags = resolveSecureAgentCreateFlags(payload);
  return {
    adminOnly: flags.adminOnly,
    description: payload.description ?? null,
    enableContentTools: flags.enableContentTools,
    enableDataAccess: flags.enableDataAccess,
    enableSelfImprovement: flags.enableSelfImprovement,
    enableSqlMode: flags.enableSqlMode,
    enableUserContext: flags.enableUserContext,
    groupAccess: sortedStrings(payload.groupAccess),
    instruction: payload.instruction ?? null,
    mcpServerUuids: sortedStrings(payload.mcpServerUuids),
    name: payload.name,
    spaceAccess: sortedStrings(payload.spaceAccess),
    tags: canonicalTagsForDigest(payload.tags),
    userAccess: sortedStrings(payload.userAccess),
  };
}

/** Canonical digest of create fields (order-stable). Shared by elicitation and preview tokens. */
export function digestCreateAgentPayload(payload: AgentCreatePayloadFields): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalCreateAgentPayload(payload)))
    .digest('hex');
}

/** Empty tag list means all explores — normalize to null for API/digest consistency. */
export function normalizeAgentTags(tags: string[] | null | undefined): string[] | null {
  if (tags == null || tags.length === 0) {
    return null;
  }
  return tags;
}

export type AgentElevationWarningCode =
  | 'ELEVATED_CONTENT_TOOLS'
  | 'ELEVATED_CONTENT_WITHOUT_DATA'
  | 'ELEVATED_DATA_ACCESS'
  | 'ELEVATED_PUBLIC_VISIBILITY'
  | 'ELEVATED_SQL_MODE'
  | 'ELEVATED_USER_CONTEXT';

export type AgentElevationWarning = {
  code: AgentElevationWarningCode;
  message: string;
};

export type AgentCreateVisibilityInput = SecureAgentCreateFlags & {
  groupAccess?: string[];
  userAccess?: string[];
};

/** Merge partial create args over secure defaults (explicit false/true honored). */
export function resolveSecureAgentCreateFlags(
  partial: SecureAgentCreateFlags,
): ResolvedSecureAgentCreateFlags {
  return {
    enableDataAccess: partial.enableDataAccess ?? SECURE_AGENT_CREATE_DEFAULTS.enableDataAccess,
    enableContentTools:
      partial.enableContentTools ?? SECURE_AGENT_CREATE_DEFAULTS.enableContentTools,
    enableSqlMode: partial.enableSqlMode ?? SECURE_AGENT_CREATE_DEFAULTS.enableSqlMode,
    enableUserContext: partial.enableUserContext ?? SECURE_AGENT_CREATE_DEFAULTS.enableUserContext,
    adminOnly: partial.adminOnly ?? SECURE_AGENT_CREATE_DEFAULTS.adminOnly,
    enableSelfImprovement:
      partial.enableSelfImprovement ?? SECURE_AGENT_CREATE_DEFAULTS.enableSelfImprovement,
  };
}

/** Build a create-agent API body with secure defaults applied (MCP, CLI, agentops). */
export function buildSecureCreateAiAgentBody(input: BuildSecureCreateAiAgentInput): CreateAiAgent {
  const flags = resolveSecureAgentCreateFlags(input);
  return {
    name: input.name,
    projectUuid: input.projectUuid,
    description: input.description ?? null,
    instruction: input.instruction ?? null,
    tags: normalizeAgentTags(input.tags),
    integrations: [],
    imageUrl: null,
    groupAccess: input.groupAccess ?? [],
    userAccess: input.userAccess ?? [],
    spaceAccess: input.spaceAccess ?? [],
    enableDataAccess: flags.enableDataAccess,
    enableContentTools: flags.enableContentTools,
    enableSqlMode: flags.enableSqlMode,
    enableUserContext: flags.enableUserContext,
    adminOnly: flags.adminOnly,
    enableSelfImprovement: flags.enableSelfImprovement,
    version: 1,
    ...(input.mcpServerUuids !== undefined ? { mcpServerUuids: input.mcpServerUuids } : {}),
  };
}

function onOff(value: boolean): string {
  return value ? 'on' : 'off';
}

function formatVisibility(
  resolved: ResolvedSecureAgentCreateFlags,
  input: AgentCreateVisibilityInput,
): string {
  if (resolved.adminOnly) {
    return 'Admins & developers only';
  }
  const groupCount = input.groupAccess?.length ?? 0;
  const userCount = input.userAccess?.length ?? 0;
  if (groupCount > 0 || userCount > 0) {
    return `Specific users/groups (${userCount} user(s), ${groupCount} group(s))`;
  }
  return 'Everyone in the project';
}

/** Human-readable permission lines for create elicitation (UI-aligned labels). */
export function formatAgentPermissionSummary(
  partial: SecureAgentCreateFlags,
  visibilityInput: Pick<AgentCreateVisibilityInput, 'groupAccess' | 'userAccess'> = {},
): string[] {
  const resolved = resolveSecureAgentCreateFlags(partial);
  return [
    `  ${AGENT_PERMISSION_UI_LABELS.enableDataAccess}: ${onOff(resolved.enableDataAccess)}`,
    `  ${AGENT_PERMISSION_UI_LABELS.enableContentTools}: ${onOff(resolved.enableContentTools)}`,
    `  ${AGENT_PERMISSION_UI_LABELS.enableSqlMode}: ${onOff(resolved.enableSqlMode)}`,
    `  ${AGENT_PERMISSION_UI_LABELS.enableUserContext}: ${onOff(resolved.enableUserContext)}`,
    `  ${AGENT_PERMISSION_UI_LABELS.enableSelfImprovement}: ${onOff(resolved.enableSelfImprovement)}`,
    `  Who can use: ${formatVisibility(resolved, { ...partial, ...visibilityInput })}`,
  ];
}

const CONTENT_WITHOUT_DATA_WARNING: AgentElevationWarning = {
  code: 'ELEVATED_CONTENT_WITHOUT_DATA',
  message:
    'Content editing is enabled without data access. Lightdash locks content tools until data access is on.',
};

type CapabilityElevationCheck = {
  code: AgentElevationWarningCode;
  isActive: (resolved: ResolvedSecureAgentCreateFlags) => boolean;
  isPatchActive: (patch: SecureAgentCreateFlags) => boolean;
  createMessage: string;
  updateMessage: string;
};

const CAPABILITY_ELEVATIONS: CapabilityElevationCheck[] = [
  {
    code: 'ELEVATED_DATA_ACCESS',
    isActive: (resolved) => resolved.enableDataAccess,
    isPatchActive: (patch) => patch.enableDataAccess === true,
    createMessage:
      'Agent has data access enabled (Read rows behind chart). Warehouse row values may be sent to the LLM.',
    updateMessage:
      'Update enables data access (Read rows behind chart). Warehouse row values may be sent to the LLM.',
  },
  {
    code: 'ELEVATED_CONTENT_TOOLS',
    isActive: (resolved) => resolved.enableContentTools,
    isPatchActive: (patch) => patch.enableContentTools === true,
    createMessage:
      'Agent has content editing enabled. It may create or mutate saved charts and dashboards.',
    updateMessage:
      'Update enables content editing. The agent may create or mutate saved charts and dashboards.',
  },
  {
    code: 'ELEVATED_SQL_MODE',
    isActive: (resolved) => resolved.enableSqlMode,
    isPatchActive: (patch) => patch.enableSqlMode === true,
    createMessage:
      'Agent has SQL mode enabled. It may run raw SQL against the warehouse (subject to user approval per query).',
    updateMessage:
      'Update enables SQL mode. The agent may run raw SQL against the warehouse (subject to user approval per query).',
  },
  {
    code: 'ELEVATED_USER_CONTEXT',
    isActive: (resolved) => resolved.enableUserContext,
    isPatchActive: (patch) => patch.enableUserContext === true,
    createMessage:
      'Agent has user context enabled. It receives the requesting user name, role, and group memberships.',
    updateMessage:
      'Update enables user context. The agent receives the requesting user name, role, and group memberships.',
  },
];

function visibilityElevationMessage(
  groupCount: number,
  userCount: number,
  prefix: string,
  messages: { everyone: string; specific: string },
): AgentElevationWarning {
  return {
    code: 'ELEVATED_PUBLIC_VISIBILITY',
    message:
      groupCount === 0 && userCount === 0
        ? `${prefix} ${messages.everyone}`
        : `${prefix} ${messages.specific}`,
  };
}

/** Warn when resolved flags deviate from the secure baseline. */
export function collectElevationWarnings(
  partial: AgentCreateVisibilityInput,
): AgentElevationWarning[] {
  const resolved = resolveSecureAgentCreateFlags(partial);
  const warnings: AgentElevationWarning[] = [];

  for (const check of CAPABILITY_ELEVATIONS) {
    if (check.isActive(resolved)) {
      warnings.push({ code: check.code, message: check.createMessage });
    }
  }

  if (!resolved.adminOnly) {
    warnings.push(
      visibilityElevationMessage(
        partial.groupAccess?.length ?? 0,
        partial.userAccess?.length ?? 0,
        'Agent visibility is',
        {
          everyone:
            'Everyone in the project (adminOnly: false). All project members can use this agent.',
          specific:
            'limited to specific users/groups (adminOnly: false). Verify access lists before release.',
        },
      ),
    );
  }
  if (resolved.enableContentTools && !resolved.enableDataAccess) {
    warnings.push(CONTENT_WITHOUT_DATA_WARNING);
  }

  return warnings;
}

function pushCapabilityElevation(
  warnings: AgentElevationWarning[],
  patch: Pick<AgentCreateVisibilityInput, 'groupAccess' | 'userAccess'> & SecureAgentCreateFlags,
): void {
  for (const check of CAPABILITY_ELEVATIONS) {
    if (check.isPatchActive(patch)) {
      warnings.push({ code: check.code, message: check.updateMessage });
    }
  }

  if (patch.enableContentTools === true && patch.enableDataAccess === false) {
    warnings.push({
      ...CONTENT_WITHOUT_DATA_WARNING,
      message:
        'Content editing enabled without data access in this patch. Lightdash locks content tools until data access is on.',
    });
  }
}

function pushVisibilityElevation(
  warnings: AgentElevationWarning[],
  patch: Pick<AgentCreateVisibilityInput, 'groupAccess' | 'userAccess'> & SecureAgentCreateFlags,
): void {
  if (patch.adminOnly === false) {
    warnings.push(
      visibilityElevationMessage(
        patch.groupAccess?.length ?? 0,
        patch.userAccess?.length ?? 0,
        'Update sets visibility to',
        {
          everyone: 'Everyone in the project (adminOnly: false).',
          specific: `specific users/groups (adminOnly: false; ${patch.userAccess?.length ?? 0} user(s), ${patch.groupAccess?.length ?? 0} group(s)).`,
        },
      ),
    );
  }
}

/** Elevation warnings for update patches — only fields explicitly set in the patch. */
export function collectElevationWarningsFromPatch(
  patch: Pick<AgentCreateVisibilityInput, 'groupAccess' | 'userAccess'> & SecureAgentCreateFlags,
): AgentElevationWarning[] {
  const warnings: AgentElevationWarning[] = [];
  pushCapabilityElevation(warnings, patch);
  pushVisibilityElevation(warnings, patch);
  return warnings;
}
