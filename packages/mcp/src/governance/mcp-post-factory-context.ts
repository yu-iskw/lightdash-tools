/**
 * Per-POST store for the process-lifetime `createMcpHandler` factory.
 * Auth / Origin / pin stay outside the handler; the factory only needs
 * contextProvider + profile (ADR-0019).
 */

import { AsyncLocalStorage } from 'node:async_hooks';

import type { PromptContextPolicy } from '../config/prompt-context-policy.js';
import type { ProfileDefinition } from '../profiles/types.js';
import type { McpContextProvider } from '../server/request-context.js';

export type McpPostFactoryStore = {
  contextProvider: McpContextProvider;
  profile: ProfileDefinition;
  promptContextPolicy?: PromptContextPolicy;
};

const mcpPostFactoryAls = new AsyncLocalStorage<McpPostFactoryStore>();

export function getMcpPostFactoryStore(): McpPostFactoryStore | undefined {
  return mcpPostFactoryAls.getStore();
}

export function runWithMcpPostFactoryAsync<T>(
  store: McpPostFactoryStore,
  fn: () => Promise<T>,
): Promise<T> {
  return mcpPostFactoryAls.run(store, fn);
}

/** Sync variant for adapters that invoke the factory synchronously. */
export function runWithMcpPostFactorySync<T>(store: McpPostFactoryStore, fn: () => T): T {
  return mcpPostFactoryAls.run(store, fn);
}
