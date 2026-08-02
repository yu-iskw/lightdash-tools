/**
 * Shared ephemeral-store backend selection (ADR-0016).
 *
 * Preview ledger, Streamable HTTP sessions, and OAuth broker pending state
 * share this config surface; domain adapters implement behind it.
 */

export type StoreBackend = 'memory' | 'redis';

export type EphemeralStoreConfig = { backend: 'memory' } | { backend: 'redis'; redisUrl: string };
