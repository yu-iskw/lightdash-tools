/**
 * Factory for hybrid SessionStore (ADR-0016).
 */

import { SessionStore } from '../transports/session-store.js';

import { resolveEphemeralStoreConfig } from './config.js';
import { getSharedRedisClient } from './redis-client.js';
import { RedisSessionIndex } from './redis-session-index.js';

import type { EphemeralStoreConfig } from './types.js';

export type CreateSessionStoreOptions = {
  sessionTtlMs: number;
  maxSessions: number;
  /** `0` disables the per-subject cap. */
  maxSessionsPerSubject: number;
};

/**
 * Build a SessionStore for the configured ephemeral backend.
 *
 * - memory: process-local Map only
 * - redis: process-local transports + Redis session index (sticky still required
 *   for Streamable HTTP transport affinity)
 */
export function createSessionStore(
  config: EphemeralStoreConfig = resolveEphemeralStoreConfig(),
  options: CreateSessionStoreOptions,
): SessionStore {
  if (config.backend === 'memory') {
    return new SessionStore(
      options.sessionTtlMs,
      options.maxSessions,
      options.maxSessionsPerSubject,
    );
  }

  const index = new RedisSessionIndex(() => getSharedRedisClient(config), options.sessionTtlMs);
  return new SessionStore(
    options.sessionTtlMs,
    options.maxSessions,
    options.maxSessionsPerSubject,
    index,
  );
}
