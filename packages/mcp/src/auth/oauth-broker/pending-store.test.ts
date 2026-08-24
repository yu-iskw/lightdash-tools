/**
 * In-memory OAuthBrokerStore unit tests (ADR-0019).
 * Redis backend removed per ADR-0019; always memory.
 */

import { describe, expect, it } from 'vitest';

import { InMemoryOAuthBrokerStore } from './pending-store.js';

const RESOURCE = 'https://mcp.example.com/semantic-layer/v1/mcp';

function pendingInput(clientId = 'c1') {
  return {
    clientId,
    redirectUri: 'http://127.0.0.1:1/cb',
    codeChallenge: 'ch',
    codeChallengeMethod: 'S256',
    resource: RESOURCE,
  };
}

async function consentedPending(
  store: InMemoryOAuthBrokerStore,
  input = pendingInput(),
) {
  const pending = await store.createPending(input);
  const marked = await store.markConsented(pending!.brokerState);
  return marked!;
}

describe('InMemoryOAuthBrokerStore', () => {
  it('createPending / takePending is single-use and keeps the MCP resource', async () => {
    const store = new InMemoryOAuthBrokerStore();
    const pending = await store.createPending(pendingInput());
    expect(pending?.brokerState).toBeTruthy();
    expect(pending?.resource).toBe(RESOURCE);
    expect(pending?.csrfToken).toBeTruthy();
    expect(pending?.consented).toBe(false);
    expect((await store.takePending(pending!.brokerState))?.clientId).toBe('c1');
    expect(await store.takePending(pending!.brokerState)).toBeUndefined();
  });

  it('issueCode / takeCode is single-use and carries MCP resource/scope', async () => {
    const store = new InMemoryOAuthBrokerStore();
    const pending = await consentedPending(store, { ...pendingInput(), scope: 'mcp:read' });
    const issued = await store.issueCode(pending, { accessToken: 'tok' });
    expect(issued?.accessToken).toBe('tok');
    expect(issued?.resource).toBe(RESOURCE);
    expect(issued?.scope).toBe('mcp:read');
    expect((await store.takeCode(issued!.code))?.clientId).toBe('c1');
    expect(await store.takeCode(issued!.code)).toBeUndefined();
  });

  it('does not substitute a downstream token scope for the MCP scope', async () => {
    const store = new InMemoryOAuthBrokerStore();
    const pending = await consentedPending(store, { ...pendingInput(), scope: 'mcp:write' });
    const issued = await store.issueCode(pending, { accessToken: 'tok' });
    expect(issued?.scope).toBe('mcp:write');
  });

  it('restoreCode re-inserts a taken code for retry', async () => {
    const store = new InMemoryOAuthBrokerStore({ codeTtlMs: 60_000 });
    const pending = await consentedPending(store);
    const issued = await store.issueCode(pending, { accessToken: 'tok' });
    const taken = await store.takeCode(issued!.code);
    expect(taken?.accessToken).toBe('tok');
    expect(await store.getCode(issued!.code)).toBeUndefined();

    await store.restoreCode(taken!);
    expect((await store.takeCode(issued!.code))?.accessToken).toBe('tok');
  });

  it('restoreCode skips codes whose TTL has already elapsed', async () => {
    const store = new InMemoryOAuthBrokerStore({ codeTtlMs: 1_000 });
    const pending = await consentedPending(store);
    const issued = await store.issueCode(pending, { accessToken: 'tok' });
    const taken = await store.takeCode(issued!.code);
    expect(taken).toBeDefined();

    await store.restoreCode({ ...taken!, createdAt: Date.now() - 5_000 });
    expect(await store.getCode(issued!.code)).toBeUndefined();
  });

  it('getCode / deleteCode still work for peek diagnostics', async () => {
    const store = new InMemoryOAuthBrokerStore();
    const pending = await consentedPending(store);
    const issued = await store.issueCode(pending, { accessToken: 'tok' });
    expect((await store.getCode(issued!.code))?.clientId).toBe('c1');
    await store.deleteCode(issued!.code);
    expect(await store.getCode(issued!.code)).toBeUndefined();
  });

  it('registerClient binds exact redirect URIs', async () => {
    const store = new InMemoryOAuthBrokerStore();
    const client = await store.registerClient(['http://127.0.0.1:8787/cb']);
    expect(client).toBeDefined();
    expect(
      await store.isRedirectAllowedForClient(client!.clientId, 'http://127.0.0.1:8787/cb'),
    ).toBe(true);
    expect(
      await store.isRedirectAllowedForClient(client!.clientId, 'https://evil.example/cb'),
    ).toBe(false);
  });

  it('enforces maxPending after cleanup', async () => {
    const store = new InMemoryOAuthBrokerStore({ maxPending: 1 });
    const first = await store.createPending(pendingInput());
    expect(first).toBeDefined();
    expect(await store.createPending(pendingInput('c2'))).toBeUndefined();
  });

  it('enforces maxClients', async () => {
    const store = new InMemoryOAuthBrokerStore({ maxClients: 1 });
    expect(await store.registerClient(['http://127.0.0.1:1/cb'])).toBeDefined();
    expect(await store.registerClient(['http://127.0.0.1:1/cb2'])).toBeUndefined();
  });

  it('stores unverified DCR clientName and markConsented without consuming pending', async () => {
    const store = new InMemoryOAuthBrokerStore();
    const client = await store.registerClient(['http://127.0.0.1:1/cb'], 'Demo Client');
    expect(client?.clientName).toBe('Demo Client');
    const pending = await store.createPending(pendingInput(client!.clientId));
    expect(await store.getPending(pending!.brokerState)).toMatchObject({ consented: false });
    const marked = await store.markConsented(pending!.brokerState);
    expect(marked?.consented).toBe(true);
    expect((await store.getPending(pending!.brokerState))?.consented).toBe(true);
    expect((await store.takePending(pending!.brokerState))?.consented).toBe(true);
    expect(await store.takePending(pending!.brokerState)).toBeUndefined();
  });

  it('refuses to issue a code until the pending authorization is consented', async () => {
    const store = new InMemoryOAuthBrokerStore();
    const pending = await store.createPending(pendingInput());
    expect(await store.issueCode(pending!, { accessToken: 'tok' })).toBeUndefined();
    const consented = await store.markConsented(pending!.brokerState);
    expect(await store.issueCode(consented!, { accessToken: 'tok' })).toBeDefined();
  });
});
