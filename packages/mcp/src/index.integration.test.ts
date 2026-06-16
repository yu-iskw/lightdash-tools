import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, it, expect } from 'vitest';

import { EnvContextProvider } from './auth/env-context-provider.js';
import { validateLightdashAccessToken } from './auth/lightdash-token-validation.js';
import { getClient } from './config';
import { registerTools } from './tools';
import { TOOL_PREFIX } from './tools/shared';

import type { McpHttpConfig } from './config/load-mcp-config.js';

const hasCredentials = !!process.env.LIGHTDASH_API_KEY && !!process.env.LIGHTDASH_URL;
const hasOAuthToken =
  !!process.env.LIGHTDASH_TOOLS_TEST_OAUTH_ACCESS_TOKEN && !!process.env.LIGHTDASH_URL;

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
    const contextProvider = new EnvContextProvider({ client });
    const server = new McpServer({ name: 'test-server', version: '1.0.0' });
    registerTools(server, contextProvider);

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

describe.runIf(hasOAuthToken)('MCP Integration (OAuth access token)', () => {
  it('validates live OAuth bearer token against Lightdash', async () => {
    const lightdashUrl = process.env.LIGHTDASH_URL!.replace(/\/$/, '');
    const config: McpHttpConfig = {
      lightdashUrl,
      host: '127.0.0.1',
      port: 3100,
      publicUrl: 'https://mcp.example.com',
      mcpPath: '/mcp',
      authMode: 'lightdash-oauth',
      allowedOrigins: [],
      maxBodyBytes: 1024 * 1024,
      sessionTtlMs: 60_000,
      maxSessions: 10,
      sessionCleanupMs: 60_000,
      requiredScopes: ['mcp:read'],
      scopesSupported: ['mcp:read', 'mcp:write'],
      validateToken: true,
      tokenValidationCacheTtlMs: 30_000,
      grantAllScopesWhenUnknown: false,
    };

    const user = await validateLightdashAccessToken(
      config,
      process.env.LIGHTDASH_TOOLS_TEST_OAUTH_ACCESS_TOKEN!,
    );

    expect(user.userUuid).toBeDefined();
    expect(user.email).toBeDefined();
    console.error(`OAuth token authenticated as: ${user.email} (${user.userUuid})`);
  });
});
