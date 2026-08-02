/**
 * Resolve LIGHTDASH_TOOLS_MCP_STORE (+ REDIS_URL) for ephemeral MCP state (ADR-0016).
 */

import { ENV_LIGHTDASH_TOOLS_MCP_REDIS_URL, ENV_LIGHTDASH_TOOLS_MCP_STORE } from '../config/env.js';

import type { EphemeralStoreConfig, StoreBackend } from './types.js';

function readEnv(name: string, env: NodeJS.ProcessEnv): string | undefined {
  // eslint-disable-next-line security/detect-object-injection -- env var names are fixed constants
  const value = env[name];
  if (value == null) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseStoreBackend(raw: string | undefined): StoreBackend {
  if (raw == null || raw === 'memory') {
    return 'memory';
  }
  if (raw === 'redis') {
    return 'redis';
  }
  throw new Error(`${ENV_LIGHTDASH_TOOLS_MCP_STORE} must be 'memory' or 'redis' (got '${raw}').`);
}

/**
 * Parse store backend env. Fail closed when `redis` is selected without a URL.
 * Default is memory (stdio/tests and single-instance HTTP).
 */
export function resolveEphemeralStoreConfig(
  env: NodeJS.ProcessEnv = process.env,
): EphemeralStoreConfig {
  const backend = parseStoreBackend(readEnv(ENV_LIGHTDASH_TOOLS_MCP_STORE, env));
  if (backend === 'memory') {
    return { backend: 'memory' };
  }
  const redisUrl = readEnv(ENV_LIGHTDASH_TOOLS_MCP_REDIS_URL, env);
  if (!redisUrl) {
    throw new Error(
      `${ENV_LIGHTDASH_TOOLS_MCP_REDIS_URL} is required when ${ENV_LIGHTDASH_TOOLS_MCP_STORE}=redis.`,
    );
  }
  return { backend: 'redis', redisUrl };
}

/** Warn when HTTP uses in-memory ephemeral state (multi-instance / restart loss). */
export function emitEphemeralStoreHttpWarning(
  config: EphemeralStoreConfig = resolveEphemeralStoreConfig(),
): void {
  if (config.backend === 'memory') {
    console.warn(
      `Warning: MCP HTTP ephemeral store is in-memory (${ENV_LIGHTDASH_TOOLS_MCP_STORE}=memory). ` +
        'Preview ledger, transport sessions, and OAuth pending state are lost on process restart ' +
        'and are not shared across instances. Use sticky routing or set ' +
        `${ENV_LIGHTDASH_TOOLS_MCP_STORE}=redis with ${ENV_LIGHTDASH_TOOLS_MCP_REDIS_URL} for horizontal scale.`,
    );
  }
}
