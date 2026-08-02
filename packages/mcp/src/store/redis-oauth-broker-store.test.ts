import { describe, expect, it, vi } from 'vitest';

import {
  OAUTH_CLIENTS_INDEX_KEY,
  OAUTH_REDIS_KEY_PREFIX,
  REGISTER_CLIENT_LUA,
  RedisOAuthBrokerStore,
} from './redis-oauth-broker-store.js';

import type { RedisClientType } from 'redis';

type FakeRedis = {
  strings: Map<string, string>;
  /** clientId -> expiresAt ms */
  clientIndex: Map<string, number>;
  eval: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  getDel: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
};

function createFakeRedis(): FakeRedis {
  const strings = new Map<string, string>();
  const clientIndex = new Map<string, number>();

  const evalFn = vi.fn(
    async (script: string, opts: { keys: string[]; arguments: string[] }): Promise<number> => {
      if (script !== REGISTER_CLIENT_LUA) {
        throw new Error('unexpected lua script');
      }
      const [indexKey, clientKey] = opts.keys;
      const [nowRaw, maxRaw, ttlRaw, clientJson, clientId] = opts.arguments;
      expect(indexKey).toBe(OAUTH_CLIENTS_INDEX_KEY);
      const now = Number(nowRaw);
      const maxClients = Number(maxRaw);
      const ttlMs = Number(ttlRaw);
      for (const [id, expiresAt] of [...clientIndex.entries()]) {
        if (expiresAt <= now) {
          clientIndex.delete(id);
        }
      }
      if (clientIndex.size >= maxClients) {
        return 0;
      }
      strings.set(clientKey, clientJson);
      clientIndex.set(clientId, now + ttlMs);
      return 1;
    },
  );

  return {
    strings,
    clientIndex,
    eval: evalFn,
    get: vi.fn(async (key: string) => strings.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      strings.set(key, value);
      return 'OK';
    }),
    getDel: vi.fn(async (key: string) => {
      const value = strings.get(key) ?? null;
      strings.delete(key);
      return value;
    }),
    del: vi.fn(async (key: string) => {
      strings.delete(key);
      return 1;
    }),
  };
}

describe('RedisOAuthBrokerStore.registerClient', () => {
  it('registers until maxClients then returns undefined', async () => {
    const fake = createFakeRedis();
    const store = new RedisOAuthBrokerStore(async () => fake as unknown as RedisClientType, {
      maxClients: 1,
      clientTtlMs: 60_000,
    });

    const first = await store.registerClient(['http://127.0.0.1:8787/cb']);
    expect(first).toBeDefined();
    expect(fake.clientIndex.size).toBe(1);
    expect(fake.strings.size).toBe(1);

    const second = await store.registerClient(['http://127.0.0.1:8787/cb2']);
    expect(second).toBeUndefined();
    expect(fake.clientIndex.size).toBe(1);
  });

  it('prunes expired index members before enforcing capacity', async () => {
    const fake = createFakeRedis();
    const past = Date.now() - 10_000;
    fake.clientIndex.set('expired-client', past);

    const store = new RedisOAuthBrokerStore(async () => fake as unknown as RedisClientType, {
      maxClients: 1,
      clientTtlMs: 60_000,
    });

    const registered = await store.registerClient(['http://127.0.0.1:8787/cb']);
    expect(registered).toBeDefined();
    expect(fake.clientIndex.has('expired-client')).toBe(false);
    expect(fake.clientIndex.size).toBe(1);
    expect([...fake.strings.keys()][0]).toBe(
      `${OAUTH_REDIS_KEY_PREFIX}client:${registered!.clientId}`,
    );
  });
});
