import {
  assertNoIrrecoverableTools,
  createStubMcpContextProvider,
  listRegisteredToolNamesForTest,
} from '@lightdash-tools/mcp/testing';
import { describe, expect, it } from 'vitest';

import { AGENT_VIEWER_MCP_TOOL_NAMES, createAgentViewerServer } from './index.js';

describe('mcp-agent-viewer tool surface', () => {
  it('registers only the curated viewer tools', async () => {
    const server = createAgentViewerServer({
      contextProvider: createStubMcpContextProvider(),
    });
    const toolNames = (await listRegisteredToolNamesForTest(server)).sort();

    expect(toolNames).toEqual([...AGENT_VIEWER_MCP_TOOL_NAMES].sort());
  });

  it('does not expose write or destructive tools', async () => {
    const server = createAgentViewerServer({
      contextProvider: createStubMcpContextProvider(),
    });
    const toolNames = await listRegisteredToolNamesForTest(server);

    expect(toolNames.some((name) => name.includes('delete_'))).toBe(false);
    expect(toolNames.some((name) => name.startsWith('ldt__upsert_'))).toBe(false);
    expect(toolNames.some((name) => name.startsWith('ldt__create_'))).toBe(false);
    expect(toolNames.some((name) => name.startsWith('ldt__update_'))).toBe(false);
    expect(toolNames.some((name) => name.startsWith('ldt__grant_'))).toBe(false);
    expect(toolNames.some((name) => name.startsWith('ldt__revoke_'))).toBe(false);
    expect(toolNames.some((name) => name.startsWith('ldt__ai_agentops_'))).toBe(false);

    assertNoIrrecoverableTools(toolNames);
  });
});
