/**
 * Factory for OAuthBrokerStore (ADR-0016).
 */

import { InMemoryOAuthBrokerStore } from '../auth/oauth-broker/pending-store.js';

import { resolveEphemeralStoreConfig } from './config.js';
import { getSharedRedisClient } from './redis-client.js';
import { RedisOAuthBrokerStore } from './redis-oauth-broker-store.js';

import type { EphemeralStoreConfig } from './types.js';
import type {
  OAuthBrokerStore,
  OAuthBrokerStoreOptions,
} from '../auth/oauth-broker/pending-store.js';

export function createOAuthBrokerStore(
  config: EphemeralStoreConfig = resolveEphemeralStoreConfig(),
  options: OAuthBrokerStoreOptions = {},
): OAuthBrokerStore {
  if (config.backend === 'memory') {
    return new InMemoryOAuthBrokerStore(options);
  }
  return new RedisOAuthBrokerStore(() => getSharedRedisClient(config), options);
}
