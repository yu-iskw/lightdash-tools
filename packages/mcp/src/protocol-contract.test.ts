/**
 * In-memory protocol contract: createLightdashMcpServer + Client via InMemoryTransport.
 * No Lightdash network calls — stub McpContextProvider only.
 */
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { afterEach, describe, expect, it } from 'vitest';

import { createLightdashMcpServer } from './server/server.js';
import { TOOL_PREFIX } from './tools/shared.js';

import type { McpContextProvider } from './server/request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

function createStubContextProvider(): McpContextProvider {
  return {
    getContext: async () => ({
      lightdashClient: {} as never,
      auth: { mode: 'env' as const },
    }),
  };
}

describe('MCP protocol contract (InMemoryTransport)', () => {
  let server: McpServer | undefined;
  let mcpClient: Client | undefined;

  afterEach(async () => {
    await mcpClient?.close().catch(() => undefined);
    await server?.close().catch(() => undefined);
    mcpClient = undefined;
    server = undefined;
  });

  it('initialize and tools/list expose ldt__ tools including list_projects', async () => {
    const contextProvider = createStubContextProvider();
    server = createLightdashMcpServer(contextProvider);

    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    mcpClient = new Client({ name: 'protocol-contract-test', version: '0.0.0' });
    await mcpClient.connect(clientTransport);

    const { tools } = await mcpClient.listTools();
    expect(tools).toHaveLength(9);
    expect(tools.every((t) => t.name.startsWith(TOOL_PREFIX))).toBe(true);
    expect(tools.some((t) => t.name === `${TOOL_PREFIX}list_projects`)).toBe(true);
    expect(tools.some((t) => t.name === `${TOOL_PREFIX}compile_query`)).toBe(true);
  });
});
