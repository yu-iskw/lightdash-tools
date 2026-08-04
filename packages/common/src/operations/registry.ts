/**
 * Central operation catalog — aggregates domain modules and exposes lookup helpers.
 */

import { AI_AGENT_OPERATIONS } from './ai-agents';
import { CLI_CONTENT_OPERATIONS } from './cli-content';
import { CONTENT_DEVELOPER_OPERATIONS } from './content-developer';
import { CONTENT_GOVERNANCE_OPERATIONS } from './content-governance';
import { CONTENT_READER_OPERATIONS } from './content-reader';
import { DATA_ANALYST_OPERATIONS } from './data-analyst';
import { ORGANIZATION_AUDIT_OPERATIONS } from './organization-audit';
import { MCP_TOOLS_BY_PROFILE } from './profile-membership';
import { SEMANTIC_LAYER_OPERATIONS } from './semantic-layer';
import { PROFILE_IDS } from './types';
import { USER_OPERATIONS } from './users';

import type { OperationDescriptor, ProfileId } from './types';

const AGENT_EXPOSURE_CLIENT_ONLY = 'client-only' as const;

const ALL_OPERATIONS: readonly OperationDescriptor[] = [
  ...AI_AGENT_OPERATIONS,
  ...USER_OPERATIONS,
  ...SEMANTIC_LAYER_OPERATIONS,
  ...ORGANIZATION_AUDIT_OPERATIONS,
  ...CONTENT_READER_OPERATIONS,
  ...CONTENT_DEVELOPER_OPERATIONS,
  ...CONTENT_GOVERNANCE_OPERATIONS,
  ...DATA_ANALYST_OPERATIONS,
  ...CLI_CONTENT_OPERATIONS,
];

const operationsById = new Map<string, OperationDescriptor>(
  ALL_OPERATIONS.map((operation) => [operation.id, operation]),
);

if (operationsById.size !== ALL_OPERATIONS.length) {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const operation of ALL_OPERATIONS) {
    if (seen.has(operation.id)) {
      duplicates.push(operation.id);
    }
    seen.add(operation.id);
  }
  throw new Error(`Duplicate operation ids in registry: ${duplicates.join(', ')}`);
}

const operationsByMcpToolName = new Map<string, OperationDescriptor>();
for (const operation of ALL_OPERATIONS) {
  if (operation.agentExposure === AGENT_EXPOSURE_CLIENT_ONLY || operation.mcp === undefined) {
    continue;
  }
  // Index only exposed tools so lookups match registerToolsByIds / schema honesty.
  if (!operation.mcp.taskSupport.exposed) {
    continue;
  }
  const toolName = operation.mcp.toolName;
  if (operationsByMcpToolName.has(toolName)) {
    throw new Error(`Duplicate MCP toolName in operation catalog: ${toolName}`);
  }
  operationsByMcpToolName.set(toolName, operation);
}

const EXPOSED_MCP_TOOL_NAMES: readonly string[] = ALL_OPERATIONS.filter(
  (operation) =>
    operation.agentExposure === 'agent' &&
    operation.mcp !== undefined &&
    operation.mcp.taskSupport.exposed,
).map((operation) => {
  const mcp = operation.mcp;
  if (mcp === undefined) {
    throw new Error(`Invariant: exposed filter retained operation without mcp (${operation.id})`);
  }
  return mcp.toolName;
});

const BANNED_MCP_TOOL_NAMES: readonly string[] = ALL_OPERATIONS.filter(
  (operation) =>
    operation.agentExposure === AGENT_EXPOSURE_CLIENT_ONLY &&
    typeof operation.bannedMcpToolName === 'string' &&
    operation.bannedMcpToolName.trim().length > 0,
).map((operation) => {
  const banned = operation.bannedMcpToolName;
  if (banned === undefined) {
    throw new Error(`Invariant: banned filter retained operation without name (${operation.id})`);
  }
  return banned;
});

function freezeProfileToolNames(
  id: ProfileId,
  names: readonly string[],
  operationsByTool: ReadonlyMap<string, OperationDescriptor>,
  mounted: Set<string>,
): readonly string[] {
  if (new Set(names).size !== names.length) {
    throw new Error(`Duplicate MCP tool names in profile membership for '${id}'`);
  }
  for (const toolName of names) {
    if (!operationsByTool.has(toolName)) {
      throw new Error(`Profile '${id}' lists unknown or non-exposed MCP tool '${toolName}'`);
    }
    mounted.add(toolName);
  }
  return Object.freeze([...names]);
}

function assertProfileMembershipTables(
  operationsByTool: ReadonlyMap<string, OperationDescriptor>,
  exposedToolNames: readonly string[],
): ReadonlyMap<ProfileId, readonly string[]> {
  const map = new Map<ProfileId, readonly string[]>();
  const mounted = new Set<string>();

  for (const id of PROFILE_IDS) {
    // eslint-disable-next-line security/detect-object-injection -- ProfileId from PROFILE_IDS
    const names = MCP_TOOLS_BY_PROFILE[id];
    map.set(id, freezeProfileToolNames(id, names, operationsByTool, mounted));
  }

  for (const toolName of exposedToolNames) {
    if (!mounted.has(toolName)) {
      throw new Error(
        `Exposed MCP tool '${toolName}' is not mounted on any profile in profile-membership.ts`,
      );
    }
  }

  return map;
}

/** Precomputed tool names per serving profile (literal membership tables). */
const MCP_TOOL_NAMES_BY_PROFILE: ReadonlyMap<ProfileId, readonly string[]> =
  assertProfileMembershipTables(operationsByMcpToolName, EXPOSED_MCP_TOOL_NAMES);

/** Returns a registered operation by id, or undefined when not found. */
export function getOperation(id: string): OperationDescriptor | undefined {
  return operationsById.get(id);
}

/** Returns the agent operation registered for an MCP tool name (sans prefix), if any. */
export function getOperationByMcpToolName(toolName: string): OperationDescriptor | undefined {
  return operationsByMcpToolName.get(toolName);
}

/** Returns every registered operation descriptor. */
export function listOperations(): readonly OperationDescriptor[] {
  return ALL_OPERATIONS;
}

/** Returns agent-surface operations mounted on the given MCP serving profile. */
export function getOperationsByProfile(profile: ProfileId): readonly OperationDescriptor[] {
  const names = new Set(listMcpToolNamesByProfile(profile));
  return ALL_OPERATIONS.filter((operation) => {
    if (operation.agentExposure === AGENT_EXPOSURE_CLIENT_ONLY || operation.mcp === undefined) {
      return false;
    }
    if (!operation.mcp.taskSupport.exposed) {
      return false;
    }
    return names.has(operation.mcp.toolName);
  });
}

/** MCP tool names (sans prefix) with `mcp.taskSupport.exposed === true`. */
export function listExposedMcpToolNames(): readonly string[] {
  return EXPOSED_MCP_TOOL_NAMES;
}

/** MCP tool names that must never be registered (client-only denylist). */
export function listBannedMcpToolNames(): readonly string[] {
  return BANNED_MCP_TOOL_NAMES;
}

/** Exposed MCP tool names for a serving profile (registration source). */
export function listMcpToolNamesByProfile(profile: ProfileId): readonly string[] {
  const names = MCP_TOOL_NAMES_BY_PROFILE.get(profile);
  if (names === undefined) {
    throw new Error(`Unknown profile id: ${profile}`);
  }
  return names;
}
