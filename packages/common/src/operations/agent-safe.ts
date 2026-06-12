/**
 * Agent-safe surface policy helpers (ADR-0037).
 */

import { listOperations } from './registry';

/** MCP tool names that must never be registered, derived from client-only registry entries. */
export function listBannedMcpToolNames(): readonly string[] {
  return listOperations()
    .filter(
      (operation) =>
        operation.agentExposure === 'client-only' && operation.mcp.toolName.trim().length > 0,
    )
    .map((operation) => operation.mcp.toolName);
}

/** Banned MCP tool names (without `ldt__` prefix) for regression tests. */
export const IRRECOVERABLE_TOOL_DENYLIST = listBannedMcpToolNames();
