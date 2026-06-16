import { IRRECOVERABLE_TOOL_DENYLIST } from '@lightdash-tools/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { TOOL_PREFIX } from './tools/shared.js';

import type { McpContextProvider } from './request-context.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export { TOOL_PREFIX };

export function createStubMcpContextProvider(): McpContextProvider {
  return {
    getContext: async () => ({ lightdashClient: {} }),
  } as unknown as McpContextProvider;
}

export function assertNoIrrecoverableTools(toolNames: string[]): void {
  for (const toolName of IRRECOVERABLE_TOOL_DENYLIST) {
    if (toolNames.includes(`${TOOL_PREFIX}${toolName}`)) {
      throw new Error(`Unexpected irrecoverable tool registered: ${TOOL_PREFIX}${toolName}`);
    }
  }
}

export async function listRegisteredToolNamesForTest(server: McpServer): Promise<string[]> {
  const maybeRegisteredTools = (
    server as unknown as { _registeredTools?: Record<string, { enabled?: boolean }> }
  )._registeredTools;
  if (maybeRegisteredTools) {
    return Object.entries(maybeRegisteredTools)
      .filter(([, tool]) => tool.enabled !== false)
      .map(([name]) => name);
  }

  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);

  const mcpClient = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });
  await mcpClient.connect(clientTransport);

  const toolsResult = await mcpClient.listTools();

  await mcpClient.close();
  await server.close();

  return toolsResult.tools.map((tool) => tool.name);
}
