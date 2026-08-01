/**
 * Central operation catalog — aggregates domain modules and exposes lookup helpers.
 */

import { AI_AGENT_OPERATIONS } from './ai-agents';
import { CLI_CONTENT_OPERATIONS } from './cli-content';
import { CONTENT_DEVELOPER_OPERATIONS } from './content-developer';
import { CONTENT_READER_OPERATIONS } from './content-reader';
import { ORGANIZATION_AUDIT_OPERATIONS } from './organization-audit';
import { SEMANTIC_LAYER_OPERATIONS } from './semantic-layer';
import { USER_OPERATIONS } from './users';

import type { CapabilityProfile, OperationDescriptor } from './types';

const AGENT_EXPOSURE_CLIENT_ONLY = 'client-only' as const;

const ALL_OPERATIONS: readonly OperationDescriptor[] = [
  ...AI_AGENT_OPERATIONS,
  ...USER_OPERATIONS,
  ...SEMANTIC_LAYER_OPERATIONS,
  ...ORGANIZATION_AUDIT_OPERATIONS,
  ...CONTENT_READER_OPERATIONS,
  ...CONTENT_DEVELOPER_OPERATIONS,
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

/** Returns agent-surface operations that include the given capability profile. */
export function getOperationsByProfile(profile: CapabilityProfile): readonly OperationDescriptor[] {
  return ALL_OPERATIONS.filter(
    (operation) =>
      operation.agentExposure !== 'client-only' && operation.profiles.includes(profile),
  );
}

/** MCP tool names (sans prefix) with `mcp.taskSupport.exposed === true`. */
export function listExposedMcpToolNames(): readonly string[] {
  return EXPOSED_MCP_TOOL_NAMES;
}

/** MCP tool names that must never be registered (client-only denylist). */
export function listBannedMcpToolNames(): readonly string[] {
  return BANNED_MCP_TOOL_NAMES;
}

/** Exposed MCP tool names for a capability profile (persona allowlist source). */
export function listMcpToolNamesByProfile(profile: CapabilityProfile): readonly string[] {
  return getOperationsByProfile(profile).flatMap((operation) => {
    const mcp = operation.mcp;
    if (mcp === undefined || mcp.taskSupport.exposed !== true) {
      return [];
    }
    return [mcp.toolName];
  });
}
