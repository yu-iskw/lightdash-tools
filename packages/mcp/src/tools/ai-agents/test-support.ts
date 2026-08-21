/**
 * Shared test harness for AI-agent MCP tools.
 */

import { vi } from 'vitest';

import { TOOL_PREFIX } from '../shared.js';

import type { McpContextProvider } from '../../server/request-context.js';

export type AiAgentToolResult = {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
};

export type RegisteredAiAgentTool = {
  handler: (args: Record<string, unknown>, extra?: unknown) => Promise<AiAgentToolResult>;
  options: { inputSchema: Record<string, unknown> };
};

export function mockAiAgentsContext(
  aiAgents: Record<string, ReturnType<typeof vi.fn>>,
): McpContextProvider {
  return {
    getContext: async () => ({
      lightdashClient: {
        v1: { aiAgents },
      },
      auth: { mode: 'none' as const },
    }),
  } as unknown as McpContextProvider;
}

export function registeredAiAgentTool(
  register: (server: never, ctx: McpContextProvider) => void,
  ctx: McpContextProvider,
  toolId: string,
  server: { registerTool: ReturnType<typeof vi.fn> } = { registerTool: vi.fn() },
): RegisteredAiAgentTool {
  register(server as never, ctx);
  const call = server.registerTool.mock.calls.find(
    (entry) => entry[0] === `${TOOL_PREFIX}${toolId}`,
  );
  if (call === undefined) {
    throw new Error(`Expected ${TOOL_PREFIX}${toolId} to be registered`);
  }
  return {
    options: call[1] as { inputSchema: Record<string, unknown> },
    handler: call[2] as RegisteredAiAgentTool['handler'],
  };
}

export function parseAiAgentToolBody(result: AiAgentToolResult): Record<string, unknown> {
  return JSON.parse(result.content[0].text) as Record<string, unknown>;
}
