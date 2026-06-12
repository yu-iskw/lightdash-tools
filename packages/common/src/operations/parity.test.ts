import { describe, expect, it } from 'vitest';

import { listBannedMcpToolNames } from './agent-safe';
import { listOperations } from './registry';

describe('agent-safe surface parity', () => {
  it('requires MCP tool name and CLI path for exposed agent operations', () => {
    const exposedAgentOps = listOperations().filter(
      (operation) =>
        operation.agentExposure === 'agent' && operation.mcp.taskSupport.exposed === true,
    );

    expect(exposedAgentOps.length).toBeGreaterThan(0);

    for (const operation of exposedAgentOps) {
      expect(operation.mcp.toolName.trim().length).toBeGreaterThan(0);
      expect(operation.cli.commandPath.trim().length).toBeGreaterThan(0);
    }
  });

  it('keeps client-only banned MCP tool names off the agent surface', () => {
    const banned = listBannedMcpToolNames();
    expect(banned).toContain('delete_member');

    for (const operation of listOperations()) {
      if (operation.agentExposure !== 'client-only') {
        continue;
      }
      expect(operation.mcp.taskSupport.exposed).toBe(false);
      if (operation.mcp.toolName.trim().length > 0) {
        expect(banned).toContain(operation.mcp.toolName);
      }
    }
  });
});
