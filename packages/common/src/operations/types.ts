/**
 * Shared typed operation catalog (ADR-0013 / ADR-0006).
 * Single source of truth for HTTP, CLI, and MCP exposure of Lightdash API operations.
 * MCP mount membership lives in profile-membership.ts (literal tables).
 */

import type { SafetyImpact, ToolAnnotations } from '../safety';

export type { SafetyImpact };

/** Whether an operation may appear on MCP/CLI agent surfaces. */
export type AgentExposure = 'agent' | 'client-only';

/** HTTP verbs supported by registered operations. */
export type HttpMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';

/** Runtime list of every MCP serving profile id (ADR-0006; fixed mounts / stdio). */
export const PROFILE_IDS = [
  'ai-agent-ops',
  'content-developer',
  'content-governance',
  'content-reader',
  'data-analyst',
  'organization-audit',
  'semantic-layer',
] as const;

/** MCP serving profile ids aligned to fixed HTTP mounts / stdio subcommands (ADR-0006). */
export type ProfileId = (typeof PROFILE_IDS)[number];

/**
 * MCP response sensitivity class (ADR-0011).
 * Documents which redaction class handlers must apply; does not auto-redact.
 */
export type SensitivityClass = 'none' | 'pii.email' | 'secret.connection' | 'secret.destination';

/** MCP task semantics for an operation. */
export type McpTaskSupport = {
  /** When true, the operation is exposed as an MCP tool. */
  exposed: boolean;
  /**
   * When true, the operation may complete asynchronously via MCP Tasks.
   * Long-running evaluation runs and LLM generation are task-eligible.
   */
  taskEligible: boolean;
};

export type OperationAuthorization = {
  safetyImpact: SafetyImpact;
};

export type OperationHttp = {
  method: HttpMethod;
  /** OpenAPI-style path template (includes `/api/v1` or `/api/v2` prefix). */
  path: string;
};

export type OperationMcp = {
  /** MCP tool name without the `lightdash_` prefix. */
  toolName: string;
  annotations: ToolAnnotations;
  taskSupport: McpTaskSupport;
};

export type OperationCli = {
  /** Space-delimited CLI command path from the root program (e.g. `agents list`). */
  commandPath: string;
};

/** Optional multi-step HTTP workflow when a single registry entry orchestrates several API calls. */
export type OperationWorkflowStep = {
  method: HttpMethod;
  path: string;
  summary: string;
};

export type OperationDescriptor = {
  /** Stable dot-separated identifier (e.g. `ai-agents.project.agents.list`). */
  id: string;
  summary: string;
  http: OperationHttp;
  authorization: OperationAuthorization;
  /**
   * Response sensitivity class for agent surfaces (ADR-0011).
   * Defaults to `none` when omitted from `defineOperation` input.
   */
  sensitivity: SensitivityClass;
  /** `agent` (default) = may appear on MCP and/or CLI; `client-only` = typed client only. */
  agentExposure: AgentExposure;
  /** Present when the operation is registered (or reserved) as an MCP tool. */
  mcp?: OperationMcp;
  /** Present when a real CLI command exists (`commandPath` must match Commander). */
  cli?: OperationCli;
  /** Irrecoverable denylist name for client-only ops (sans `lightdash_` prefix). */
  bannedMcpToolName?: string;
  /** When set, documents the ordered client-side HTTP steps behind this operation. */
  workflow?: readonly OperationWorkflowStep[];
};

/** Input to `defineOperation` before defaults are applied. */
export type OperationDefinitionInput = Omit<
  OperationDescriptor,
  'agentExposure' | 'sensitivity'
> & {
  agentExposure?: AgentExposure;
  sensitivity?: SensitivityClass;
};

const VALID_SENSITIVITY = new Set<SensitivityClass>([
  'none',
  'pii.email',
  'secret.connection',
  'secret.destination',
]);

function assertNonEmpty(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`Operation ${field} must be a non-empty string`);
  }
}

function expectedImpactFromAnnotations(annotations: ToolAnnotations): SafetyImpact {
  if (annotations.readOnlyHint) {
    return 'read';
  }
  if (annotations.destructiveHint) {
    return 'write-destructive';
  }
  if (annotations.openWorldHint) {
    return 'external-side-effect';
  }
  return 'write-nondestructive';
}

function validateIdempotentHint(
  annotations: ToolAnnotations,
  impact: SafetyImpact,
  id: string,
): void {
  if (impact === 'write-destructive' && annotations.idempotentHint === true) {
    throw new Error(
      `Operation '${id}': destructive operations must not set mcp.annotations.idempotentHint = true`,
    );
  }
}

function validateClientOnlyOperation(input: OperationDefinitionInput): OperationDescriptor {
  if (input.mcp !== undefined || input.cli !== undefined) {
    throw new Error(
      `Operation '${input.id}': client-only operations must omit mcp and cli metadata`,
    );
  }
  if (input.bannedMcpToolName !== undefined && input.bannedMcpToolName.trim().length === 0) {
    throw new Error(`Operation '${input.id}': bannedMcpToolName must be non-empty when set`);
  }
  return {
    ...input,
    agentExposure: 'client-only',
    sensitivity: input.sensitivity ?? 'none',
  };
}

function validateAgentMcp(input: OperationDefinitionInput): void {
  if (input.mcp === undefined) {
    return;
  }
  assertNonEmpty(input.mcp.toolName, 'mcp.toolName');
  const expectedImpact = expectedImpactFromAnnotations(input.mcp.annotations);
  if (input.authorization.safetyImpact !== expectedImpact) {
    throw new Error(
      `Operation '${input.id}': authorization.safetyImpact is '${input.authorization.safetyImpact}' but MCP annotations imply '${expectedImpact}'`,
    );
  }
  validateIdempotentHint(input.mcp.annotations, input.authorization.safetyImpact, input.id);
}

/**
 * Defines a typed operation descriptor with catalog consistency checks (ADR-0013).
 * Agent ops require at least one of `mcp` or `cli`. Client-only ops omit both.
 * MCP mount membership is declared in profile-membership.ts, not on the descriptor.
 */
export function defineOperation(input: OperationDefinitionInput): OperationDescriptor {
  assertNonEmpty(input.id, 'id');
  assertNonEmpty(input.summary, 'summary');
  assertNonEmpty(input.http.path, 'http.path');

  const sensitivity = input.sensitivity ?? 'none';
  if (!VALID_SENSITIVITY.has(sensitivity)) {
    throw new Error(`Operation '${input.id}' has unknown sensitivity '${String(sensitivity)}'`);
  }

  const agentExposure = input.agentExposure ?? 'agent';
  if (agentExposure === 'client-only') {
    return validateClientOnlyOperation({ ...input, sensitivity });
  }

  if (input.mcp === undefined && input.cli === undefined) {
    throw new Error(`Operation '${input.id}': agent operations require mcp and/or cli metadata`);
  }

  validateAgentMcp(input);
  if (input.cli !== undefined) {
    assertNonEmpty(input.cli.commandPath, 'cli.commandPath');
  }

  return { ...input, agentExposure: 'agent', sensitivity };
}
