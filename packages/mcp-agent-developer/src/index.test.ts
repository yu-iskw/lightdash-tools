import {
  assertNoIrrecoverableTools,
  createStubMcpContextProvider,
  listRegisteredToolNamesForTest,
} from '@lightdash-tools/mcp/testing';
import { describe, expect, it } from 'vitest';

import { AGENT_DEVELOPER_MCP_TOOL_NAMES, createAgentDeveloperServer } from './index.js';

describe('mcp-agent-developer tool surface', () => {
  it('registers only the curated developer tools', async () => {
    const server = createAgentDeveloperServer({
      contextProvider: createStubMcpContextProvider(),
    });
    const toolNames = (await listRegisteredToolNamesForTest(server)).sort();

    expect(toolNames).toEqual([...AGENT_DEVELOPER_MCP_TOOL_NAMES].sort());
  });

  it('does not expose destructive or high-risk tools', async () => {
    const server = createAgentDeveloperServer({
      contextProvider: createStubMcpContextProvider(),
    });
    const toolNames = await listRegisteredToolNamesForTest(server);

    expect(toolNames.some((name) => name.includes('delete_'))).toBe(false);
    expect(toolNames.some((name) => name.startsWith('ldt__grant_'))).toBe(false);
    expect(toolNames.some((name) => name.startsWith('ldt__revoke_'))).toBe(false);
    expect(toolNames.some((name) => name.startsWith('ldt__generate_agent_'))).toBe(false);
    expect(toolNames.some((name) => name.startsWith('ldt__continue_agent_'))).toBe(false);
    expect(toolNames).not.toContain('ldt__ai_agentops_evaluate_gate');
    expect(toolNames).not.toContain('ldt__list_admin_agents');

    assertNoIrrecoverableTools(toolNames);
  });
});
