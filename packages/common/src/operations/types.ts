/**
 * Shared typed operation registry (RFC Section 7).
 * Single source of truth for HTTP, CLI, and MCP exposure of Lightdash API operations.
 */

import type { SafetyImpact, ToolAnnotations } from '../safety';

export type { SafetyImpact };

/** Whether an operation may appear on MCP/CLI agent surfaces. */
export type AgentExposure = 'agent' | 'client-only';

/** HTTP verbs supported by registered operations. */
export type HttpMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';

/**
 * Capability profiles group operations for selective exposure (CLI profiles, MCP subsets).
 */
export type CapabilityProfile =
  | 'conversations'
  | 'core-lifecycle'
  | 'discovery-readonly'
  | 'evaluations';

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
  /** OpenAPI-style path template (includes `/api/v1` prefix). */
  path: string;
};

export type OperationMcp = {
  /** MCP tool name without the `ldt__` prefix. */
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
  mcp: OperationMcp;
  cli: OperationCli;
  /** `agent` (default) = may be exposed on MCP/CLI; `client-only` = typed client only. */
  agentExposure?: AgentExposure;
  profiles: readonly CapabilityProfile[];
  /** When set, documents the ordered client-side HTTP steps behind this operation. */
  workflow?: readonly OperationWorkflowStep[];
};

const VALID_PROFILES = new Set<CapabilityProfile>([
  'conversations',
  'core-lifecycle',
  'discovery-readonly',
  'evaluations',
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
  if (impact === 'read' && annotations.idempotentHint !== true) {
    throw new Error(
      `Operation '${id}': read operations must set mcp.annotations.idempotentHint = true`,
    );
  }
  if (impact === 'write-destructive' && annotations.idempotentHint === true) {
    throw new Error(
      `Operation '${id}': destructive operations must not set mcp.annotations.idempotentHint = true`,
    );
  }
}

/**
 * Defines a typed operation descriptor with RFC consistency checks.
 * Throws when authorization impact disagrees with MCP annotations or profiles are invalid.
 */
export function defineOperation<T extends OperationDescriptor>(
  descriptor: T,
): T & { agentExposure: AgentExposure } {
  assertNonEmpty(descriptor.id, 'id');
  assertNonEmpty(descriptor.summary, 'summary');
  assertNonEmpty(descriptor.http.path, 'http.path');

  const agentExposure = descriptor.agentExposure ?? 'agent';

  if (agentExposure === 'agent') {
    assertNonEmpty(descriptor.mcp.toolName, 'mcp.toolName');
    assertNonEmpty(descriptor.cli.commandPath, 'cli.commandPath');
  }

  if (agentExposure === 'client-only' && descriptor.mcp.taskSupport.exposed) {
    throw new Error(
      `Operation '${descriptor.id}': client-only operations must set mcp.taskSupport.exposed to false`,
    );
  }

  if (descriptor.profiles.length === 0) {
    throw new Error(`Operation '${descriptor.id}' must declare at least one capability profile`);
  }

  for (const profile of descriptor.profiles) {
    if (!VALID_PROFILES.has(profile)) {
      throw new Error(`Operation '${descriptor.id}' has unknown capability profile '${profile}'`);
    }
  }

  const expectedImpact = expectedImpactFromAnnotations(descriptor.mcp.annotations);
  if (descriptor.authorization.safetyImpact !== expectedImpact) {
    throw new Error(
      `Operation '${descriptor.id}': authorization.safetyImpact is '${descriptor.authorization.safetyImpact}' but MCP annotations imply '${expectedImpact}'`,
    );
  }

  validateIdempotentHint(
    descriptor.mcp.annotations,
    descriptor.authorization.safetyImpact,
    descriptor.id,
  );

  return { ...descriptor, agentExposure };
}
