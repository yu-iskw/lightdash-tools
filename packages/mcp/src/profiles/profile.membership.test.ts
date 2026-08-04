import {
  listExposedMcpToolNames,
  listMcpToolNamesByProfile,
  listOperations,
  PROFILE_IDS,
} from '@lightdash-tools/common';
import { describe, expect, it } from 'vitest';

import { PROFILES } from './index.js';

describe('profile catalog membership', () => {
  it('ships exactly the catalog PROFILE_IDS', () => {
    expect(Object.keys(PROFILES).sort()).toEqual([...PROFILE_IDS].sort());
  });

  it('every shipped profile exposes at least one MCP tool from the catalog', () => {
    for (const id of PROFILE_IDS) {
      expect(listMcpToolNamesByProfile(id).length).toBeGreaterThan(0);
    }
  });

  it('every exposed MCP tool is tagged with at least one serving profile', () => {
    const exposed = new Set(listExposedMcpToolNames());
    for (const operation of listOperations()) {
      if (operation.mcp?.taskSupport.exposed !== true) {
        continue;
      }
      expect(operation.profiles.length).toBeGreaterThan(0);
      expect(exposed.has(operation.mcp.toolName)).toBe(true);
    }
  });

  it('listMcpToolNamesByProfile matches only exposed tools for each profile', () => {
    for (const id of PROFILE_IDS) {
      for (const toolName of listMcpToolNamesByProfile(id)) {
        const op = listOperations().find((o) => o.mcp?.toolName === toolName);
        expect(op?.mcp?.taskSupport.exposed).toBe(true);
        expect(op?.profiles).toContain(id);
      }
    }
  });

  it('every ProfileDefinition.mcpToolNames matches listMcpToolNamesByProfile', () => {
    for (const id of PROFILE_IDS) {
      const profile = PROFILES[id];
      expect(profile.mcpToolNames).toEqual(listMcpToolNamesByProfile(id));
    }
  });
});
