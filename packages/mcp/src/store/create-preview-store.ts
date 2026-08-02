/**
 * Factory + process singleton for PreviewStore (ADR-0016).
 */

import { resolveEphemeralStoreConfig } from './config.js';
import { InMemoryPreviewStore } from './in-memory-preview-store.js';
import { getSharedRedisClient } from './redis-client.js';
import { RedisPreviewStore } from './redis-preview-store.js';

import type { EphemeralStoreConfig } from './types.js';
import type { PreviewStore } from '../policy/preview-ledger.js';

export function createPreviewStore(
  config: EphemeralStoreConfig = resolveEphemeralStoreConfig(),
): PreviewStore {
  if (config.backend === 'memory') {
    return new InMemoryPreviewStore();
  }
  return new RedisPreviewStore(() => getSharedRedisClient(config));
}

let processStore: PreviewStore | undefined;

/** Lazy process singleton (memory by default; redis when configured). */
export function getPreviewStore(): PreviewStore {
  if (!processStore) {
    processStore = createPreviewStore();
  }
  return processStore;
}

/** Test helper: inject or clear the process singleton. */
export function setPreviewStoreForTests(store: PreviewStore | undefined): void {
  processStore = store;
}
