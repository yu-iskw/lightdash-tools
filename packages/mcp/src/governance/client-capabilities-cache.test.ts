import { CLIENT_CAPABILITIES_META_KEY, McpServer } from '@modelcontextprotocol/server';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  extractClientCapabilitiesFromBody,
  getRememberedClientCapabilities,
  prepareServerClientCapabilities,
  rememberClientCapabilities,
  resetClientCapabilitiesCacheForTests,
  resolveCapabilitiesPrincipalKey,
  seedClientCapabilitiesOntoServer,
} from './client-capabilities-cache.js';

describe('client-capabilities-cache', () => {
  beforeEach(() => {
    resetClientCapabilitiesCacheForTests();
  });

  it('resolves principal key preferring subject then tokenHash', () => {
    expect(resolveCapabilitiesPrincipalKey({ subject: 'u1', tokenHash: 't1' })).toBe('subject:u1');
    expect(resolveCapabilitiesPrincipalKey({ tokenHash: 't1' })).toBe('token:t1');
    expect(resolveCapabilitiesPrincipalKey({})).toBe('anonymous');
    expect(resolveCapabilitiesPrincipalKey({ subject: 'u1' }, '/content-governance/v1/mcp')).toBe(
      'subject:u1@/content-governance/v1/mcp',
    );
  });

  it('skips cache for anonymous principals to avoid cross-client collision', () => {
    rememberClientCapabilities({}, { elicitation: { form: {} } });
    expect(getRememberedClientCapabilities({})).toBeUndefined();

    const server = new McpServer({ name: 't', version: '0.0.0' });
    prepareServerClientCapabilities(
      server,
      {
        jsonrpc: '2.0',
        method: 'initialize',
        params: { capabilities: { elicitation: { form: {} } } },
        id: 1,
      },
      {},
    );
    expect(getRememberedClientCapabilities({})).toBeUndefined();

    prepareServerClientCapabilities(
      server,
      {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'x', arguments: {} },
        id: 2,
      },
      {},
    );
    expect(readSeededClientCapabilities(server)).toBeUndefined();
  });

  it('isolates cache entries by persona scope', () => {
    rememberClientCapabilities(
      { subject: 'u1' },
      { elicitation: { form: {} } },
      { scope: '/content-governance/v1/mcp' },
    );
    expect(
      getRememberedClientCapabilities({ subject: 'u1' }, '/semantic-layer/v1/mcp'),
    ).toBeUndefined();
    expect(
      getRememberedClientCapabilities({ subject: 'u1' }, '/content-governance/v1/mcp'),
    ).toEqual({ elicitation: { form: {} } });
  });

  it('remembers and returns capabilities until TTL expires', () => {
    rememberClientCapabilities({ subject: 'u1' }, { elicitation: { form: {} } }, { ttlMs: 60_000 });
    expect(getRememberedClientCapabilities({ subject: 'u1' })).toEqual({
      elicitation: { form: {} },
    });

    rememberClientCapabilities({ subject: 'u1' }, { elicitation: { form: {} } }, { ttlMs: -1 });
    expect(getRememberedClientCapabilities({ subject: 'u1' })).toBeUndefined();
  });

  it('overwrites capabilities on re-initialize for the same principal', () => {
    rememberClientCapabilities({ subject: 'u1' }, { roots: {} });
    rememberClientCapabilities({ subject: 'u1' }, { elicitation: { form: {} } });
    expect(getRememberedClientCapabilities({ subject: 'u1' })).toEqual({
      elicitation: { form: {} },
    });
  });

  it('extracts capabilities from initialize and from _meta', () => {
    expect(
      extractClientCapabilitiesFromBody({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          capabilities: { elicitation: { form: {} } },
          clientInfo: { name: 't', version: '1' },
        },
        id: 1,
      }),
    ).toEqual({
      fromInitialize: true,
      clientCapabilities: { elicitation: { form: {} } },
    });

    expect(
      extractClientCapabilitiesFromBody({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'x',
          arguments: {},
          _meta: { [CLIENT_CAPABILITIES_META_KEY]: { elicitation: { form: {} } } },
        },
        id: 2,
      }),
    ).toEqual({
      fromInitialize: false,
      clientCapabilities: { elicitation: { form: {} } },
    });

    expect(extractClientCapabilitiesFromBody([{ method: 'initialize' }])).toEqual({
      fromInitialize: false,
    });
  });

  it('seeds Server getClientCapabilities for elicitation shim', () => {
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    expect(readSeededClientCapabilities(server)).toBeUndefined();
    seedClientCapabilitiesOntoServer(server, { elicitation: { form: {} } });
    expect(readSeededClientCapabilities(server)).toEqual({ elicitation: { form: {} } });
  });

  it('prepare remembers initialize then seeds a fresh server from cache', () => {
    const scope = '/content-governance/v1/mcp';
    const first = new McpServer({ name: 'a', version: '0.0.0' });
    prepareServerClientCapabilities(
      first,
      {
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: { elicitation: { form: {} } },
          clientInfo: { name: 'c', version: '1' },
        },
        id: 1,
      },
      { subject: 'user-a' },
      scope,
    );
    // Initialize path only remembers; SDK seeds this connection from params.
    expect(readSeededClientCapabilities(first)).toBeUndefined();
    expect(getRememberedClientCapabilities({ subject: 'user-a' }, scope)).toEqual({
      elicitation: { form: {} },
    });

    const second = new McpServer({ name: 'b', version: '0.0.0' });
    prepareServerClientCapabilities(
      second,
      {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'lightdash_delete_chart', arguments: {} },
        id: 2,
      },
      { subject: 'user-a' },
      scope,
    );
    expect(readSeededClientCapabilities(second)).toEqual({ elicitation: { form: {} } });
  });

  it('prepare prefers per-request _meta over cache', () => {
    rememberClientCapabilities({ subject: 'u1' }, { roots: {} });
    const server = new McpServer({ name: 't', version: '0.0.0' });
    prepareServerClientCapabilities(
      server,
      {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'x',
          arguments: {},
          _meta: { [CLIENT_CAPABILITIES_META_KEY]: { elicitation: { form: {} } } },
        },
        id: 1,
      },
      { subject: 'u1' },
    );
    expect(readSeededClientCapabilities(server)).toEqual({ elicitation: { form: {} } });
  });
});

/** Read seeded identity without calling deprecated getClientCapabilities(). */
function readSeededClientCapabilities(mcpServer: McpServer): unknown {
  return (mcpServer.server as unknown as { _clientCapabilities?: unknown })._clientCapabilities;
}
