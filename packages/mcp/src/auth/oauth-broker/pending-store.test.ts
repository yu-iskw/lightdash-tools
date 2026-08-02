/**
 * In-memory OAuthBrokerStore unit tests (ADR-0016).
 * Redis path is covered only when LIGHTDASH_TOOLS_MCP_REDIS_URL is set
 * (skipped otherwise — no Redis required for default CI).
 */

import { afterEach, describe, expect, it } from 'vitest';

import { createOAuthBrokerStore } from '../../store/create-oauth-broker-store.js';
import { resetSharedRedisClientForTests } from '../../store/redis-client.js';

import { InMemoryOAuthBrokerStore } from './pending-store.js';

describe('InMemoryOAuthBrokerStore', () => {
  it('createPending / takePending is single-use', async () => {
    const store = new InMemoryOAuthBrokerStore();
    const pending = await store.createPending({
      clientId: 'c1',
      redirectUri: 'http://127.0.0.1:1/cb',
      codeChallenge: 'ch',
      codeChallengeMethod: 'S256',
    });
    expect(pending?.brokerState).toBeTruthy();
    expect((await store.takePending(pending!.brokerState))?.clientId).toBe('c1');
    expect(await store.takePending(pending!.brokerState)).toBeUndefined();
  });

  it('issueCode / getCode / deleteCode round-trip', async () => {
    const store = new InMemoryOAuthBrokerStore();
    const pending = await store.createPending({
      clientId: 'c1',
      redirectUri: 'http://127.0.0.1:1/cb',
      codeChallenge: 'ch',
      codeChallengeMethod: 'S256',
    });
    const issued = await store.issueCode(pending!, { accessToken: 'tok' });
    expect(issued?.accessToken).toBe('tok');
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
    const first = await store.createPending({
      clientId: 'c1',
      redirectUri: 'http://127.0.0.1:1/cb',
      codeChallenge: 'ch',
      codeChallengeMethod: 'S256',
    });
    expect(first).toBeDefined();
    expect(
      await store.createPending({
        clientId: 'c2',
        redirectUri: 'http://127.0.0.1:1/cb',
        codeChallenge: 'ch',
        codeChallengeMethod: 'S256',
      }),
    ).toBeUndefined();
  });
});

describe('createOAuthBrokerStore', () => {
  it('returns memory store by default', async () => {
    const store = createOAuthBrokerStore({ backend: 'memory' });
    const pending = await store.createPending({
      clientId: 'c1',
      redirectUri: 'http://127.0.0.1:1/cb',
      codeChallenge: 'ch',
      codeChallengeMethod: 'S256',
    });
    expect(pending?.brokerState).toBeTruthy();
  });

  const redisUrl = process.env.LIGHTDASH_TOOLS_MCP_REDIS_URL?.trim();
  const describeRedis = redisUrl ? describe : describe.skip;

  describeRedis('redis backend', () => {
    afterEach(async () => {
      await resetSharedRedisClientForTests();
    });

    it('persists pending across store instances', async () => {
      const config = { backend: 'redis' as const, redisUrl: redisUrl! };
      const a = createOAuthBrokerStore(config);
      const pending = await a.createPending({
        clientId: 'c1',
        redirectUri: 'http://127.0.0.1:1/cb',
        codeChallenge: 'ch',
        codeChallengeMethod: 'S256',
      });
      expect(pending).toBeDefined();

      const b = createOAuthBrokerStore(config);
      const taken = await b.takePending(pending!.brokerState);
      expect(taken?.clientId).toBe('c1');
    });
  });
});
