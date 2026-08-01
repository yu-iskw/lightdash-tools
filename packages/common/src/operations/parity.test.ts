import { describe, expect, it } from 'vitest';

import { listBannedMcpToolNames, listOperations } from './registry';

describe('agent-safe surface parity', () => {
  it('requires MCP tool name or CLI path for agent operations', () => {
    const agentOps = listOperations().filter((operation) => operation.agentExposure === 'agent');

    expect(agentOps.length).toBeGreaterThan(0);

    for (const operation of agentOps) {
      const hasMcp = operation.mcp !== undefined && operation.mcp.toolName.trim().length > 0;
      const hasCli = operation.cli !== undefined && operation.cli.commandPath.trim().length > 0;
      expect(hasMcp || hasCli).toBe(true);
    }
  });

  it('keeps client-only banned MCP tool names off the agent surface', () => {
    const banned = listBannedMcpToolNames();
    expect(banned).toContain('delete_member');

    for (const operation of listOperations()) {
      if (operation.agentExposure !== 'client-only') {
        continue;
      }
      expect(operation.mcp).toBeUndefined();
      expect(operation.cli).toBeUndefined();
      if (operation.bannedMcpToolName) {
        expect(banned).toContain(operation.bannedMcpToolName);
      }
    }
  });
});
