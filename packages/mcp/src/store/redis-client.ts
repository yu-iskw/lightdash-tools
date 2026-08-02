/**
 * Lazy shared Redis client for MCP ephemeral store backends (ADR-0016).
 */

import { createClient, type RedisClientType } from 'redis';

import type { EphemeralStoreConfig } from './types.js';

let sharedClient: RedisClientType | undefined;
let sharedClientUrl: string | undefined;
let connectPromise: Promise<RedisClientType> | undefined;

/** Return a connected Redis client for `config.redisUrl` (one shared connection). */
export async function getSharedRedisClient(
  config: Extract<EphemeralStoreConfig, { backend: 'redis' }>,
): Promise<RedisClientType> {
  if (sharedClient?.isOpen && sharedClientUrl === config.redisUrl) {
    return sharedClient;
  }
  if (connectPromise && sharedClientUrl === config.redisUrl) {
    return connectPromise;
  }

  sharedClientUrl = config.redisUrl;
  const client = createClient({ url: config.redisUrl });
  client.on('error', (err: Error) => {
    console.error('MCP Redis client error:', err.message);
  });

  connectPromise = client
    .connect()
    .then(() => {
      sharedClient = client as RedisClientType;
      return sharedClient;
    })
    .catch((err: unknown) => {
      connectPromise = undefined;
      sharedClient = undefined;
      sharedClientUrl = undefined;
      throw err;
    });

  return connectPromise;
}

/** Test helper: drop the shared client (does not quit a live connection unless open). */
export async function resetSharedRedisClientForTests(): Promise<void> {
  const client = sharedClient;
  sharedClient = undefined;
  sharedClientUrl = undefined;
  connectPromise = undefined;
  if (client?.isOpen) {
    await client.quit();
  }
}
