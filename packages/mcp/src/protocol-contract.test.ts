/**
 * Protocol contract: legacy (InMemoryTransport / initialize) and modern
 * (createMcpHandler + StreamableHTTPClientTransport with versionNegotiation).
 * No Lightdash network calls — stub McpContextProvider only.
 */
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler, InMemoryTransport } from '@modelcontextprotocol/server';
import { afterEach, describe, expect, it } from 'vitest';

import { SEMANTIC_LAYER_TOOL_IDS } from './personas/semantic-layer/v1/index.js';
import { createLightdashMcpServer } from './server/server.js';
import { TOOL_PREFIX } from './tools/shared.js';

import type { McpContextProvider } from './server/request-context.js';
import type { McpHttpHandler, McpServer } from '@modelcontextprotocol/server';

const EXPECTED_TOOL_COUNT = SEMANTIC_LAYER_TOOL_IDS.length;

function createStubContextProvider(): McpContextProvider {
  return {
    getContext: async () => ({
      lightdashClient: {} as never,
      auth: { mode: 'env' as const },
    }),
  };
}

async function connectViaHandlerFetch(handler: McpHttpHandler, client: Client): Promise<void> {
  const transport = new StreamableHTTPClientTransport(new URL('http://test.local/mcp'), {
    fetch: (url, init) => handler.fetch(new Request(url, init)),
  });
  await client.connect(transport);
}

describe('MCP protocol contract (legacy InMemoryTransport)', () => {
  let server: McpServer | undefined;
  let mcpClient: Client | undefined;

  afterEach(async () => {
    await mcpClient?.close().catch(() => undefined);
    await server?.close().catch(() => undefined);
    mcpClient = undefined;
    server = undefined;
  });

  it('initialize and tools/list expose lightdash_ tools including list_projects', async () => {
    const contextProvider = createStubContextProvider();
    server = createLightdashMcpServer(contextProvider);

    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    mcpClient = new Client({ name: 'protocol-contract-test', version: '0.0.0' });
    await mcpClient.connect(clientTransport);

    const { tools } = await mcpClient.listTools();
    expect(tools).toHaveLength(EXPECTED_TOOL_COUNT);
    expect(tools.every((t) => t.name.startsWith(TOOL_PREFIX))).toBe(true);
    expect(tools.some((t) => t.name === `${TOOL_PREFIX}list_projects`)).toBe(true);
    expect(tools.some((t) => t.name === `${TOOL_PREFIX}compile_query`)).toBe(true);
  });
});

describe('MCP protocol contract (modern createMcpHandler)', () => {
  let handler: McpHttpHandler | undefined;
  let mcpClient: Client | undefined;

  afterEach(async () => {
    await mcpClient?.close().catch(() => undefined);
    await handler?.close().catch(() => undefined);
    mcpClient = undefined;
    handler = undefined;
  });

  it('discovers 2026-07-28 then tools/list via handler.fetch', async () => {
    const contextProvider = createStubContextProvider();
    handler = createMcpHandler(() => createLightdashMcpServer(contextProvider), {
      legacy: 'stateless',
    });

    mcpClient = new Client(
      { name: 'protocol-contract-modern', version: '0.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    );
    await connectViaHandlerFetch(handler, mcpClient);

    expect(mcpClient.getProtocolEra()).toBe('modern');

    const { tools } = await mcpClient.listTools();
    expect(tools).toHaveLength(EXPECTED_TOOL_COUNT);
    expect(tools.every((t) => t.name.startsWith(TOOL_PREFIX))).toBe(true);
    expect(tools.some((t) => t.name === `${TOOL_PREFIX}list_projects`)).toBe(true);
  });

  it('legacy:stateless still serves initialize clients on the same factory', async () => {
    const contextProvider = createStubContextProvider();
    handler = createMcpHandler(() => createLightdashMcpServer(contextProvider), {
      legacy: 'stateless',
    });

    // Default Client connects legacy (initialize handshake).
    mcpClient = new Client({ name: 'protocol-contract-legacy-http', version: '0.0.0' });
    await connectViaHandlerFetch(handler, mcpClient);

    expect(mcpClient.getProtocolEra()).toBe('legacy');

    const { tools } = await mcpClient.listTools();
    expect(tools).toHaveLength(EXPECTED_TOOL_COUNT);
    expect(tools.some((t) => t.name === `${TOOL_PREFIX}list_projects`)).toBe(true);
  });
});
