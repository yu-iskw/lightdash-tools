import { describe, it, expect } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { getClient } from './config';
import { registerTools } from './tools';
import { TOOL_PREFIX } from './tools/shared';

const hasCredentials = !!process.env.LIGHTDASH_API_KEY && !!process.env.LIGHTDASH_URL;

describe.runIf(hasCredentials)('MCP Integration (Real API)', () => {
  it('should authenticate and fetch current organization', async () => {
    const client = getClient();
    // getCurrentOrganization is a better test for connectivity
    const org = await client.v1.organizations.getCurrentOrganization();
    expect(org).toBeDefined();
    expect(org.organizationUuid).toBeDefined();
    expect(org.name).toBeDefined();
    console.error(`Authenticated to organization: ${org.name}`);
  });

  it('should execute list_projects tool with real API', async () => {
    const client = getClient();
    const server = new McpServer({ name: 'test-server', version: '1.0.0' });
    registerTools(server, client);

    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);

    const mcpClient = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });
    await mcpClient.connect(clientTransport);

    // Call the tool through the MCP client
    const result = await mcpClient.callTool({
      name: TOOL_PREFIX + 'list_projects',
      arguments: {},
    });

    if (result.isError) {
      console.error('Tool execution failed:', result.content);
    }
    expect(result).toBeDefined();
    expect(result.isError).toBeFalsy();
    expect(Array.isArray(result.content)).toBe(true);
    const content = result.content as { text: string }[];

    const textContent = content[0];
    if (textContent && 'text' in textContent) {
      expect(typeof textContent.text).toBe('string');
      console.error(`Tool list_projects output: ${textContent.text.slice(0, 100)}...`);
    }

    await mcpClient.close();
    await server.close();
  });
});
