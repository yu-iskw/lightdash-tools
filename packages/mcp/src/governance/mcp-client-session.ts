/**
 * MCP client session identity for content-reader budget/ledger bookkeeping.
 * Prefer auth subject for concurrency budgets (ADR-0019). `extra.sessionId` is used when
 * present; otherwise fall back to a process-scoped id (stdio / sessionless HTTP).
 */

import { AsyncLocalStorage } from 'node:async_hooks';

import { getSessionId } from '@lightdash-tools/common';

const mcpClientSessionAls = new AsyncLocalStorage<string>();

/** Resolve a per-client session id from MCP tool `extra`, or process-scoped stdio fallback. */
export function resolveMcpClientSessionId(extra?: unknown): string {
  if (extra !== null && typeof extra === 'object' && 'sessionId' in extra) {
    const sessionId = (extra as { sessionId?: unknown }).sessionId;
    if (typeof sessionId === 'string' && sessionId.trim() !== '') {
      return sessionId;
    }
  }
  return `process:${getSessionId()}`;
}

export function runWithMcpClientSessionAsync<T>(
  sessionId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return mcpClientSessionAls.run(sessionId, fn);
}

/** Current MCP client session (ALS); falls back to process-scoped id outside wrapTool. */
export function getMcpClientSessionId(): string {
  return mcpClientSessionAls.getStore() ?? `process:${getSessionId()}`;
}
