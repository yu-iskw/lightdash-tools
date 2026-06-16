import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionStore, type SessionEntry } from './session-store.js';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

function createMockEntry(lastAccessAt: number): SessionEntry {
  return {
    transport: {} as StreamableHTTPServerTransport,
    server: {} as McpServer,
    lastAccessAt,
    auth: { mode: 'lightdash-oauth', tokenHash: 'hash-a' },
  };
}

describe('SessionStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores, retrieves, and deletes sessions', () => {
    const store = new SessionStore(60_000, 10, 5);
    const entry = createMockEntry(Date.now());

    store.set('session-1', entry);
    expect(store.get('session-1')).toBe(entry);
    expect(store.size).toBe(1);

    store.delete('session-1');
    expect(store.get('session-1')).toBeUndefined();
    expect(store.size).toBe(0);
  });

  it('touch updates lastAccessAt for an existing session', () => {
    const store = new SessionStore(60_000, 10, 5);
    const entry = createMockEntry(1_000);
    store.set('session-1', entry);

    vi.setSystemTime(new Date('2026-06-15T12:00:05Z'));
    store.touch('session-1');

    expect(store.get('session-1')?.lastAccessAt).toBe(Date.now());
  });

  it('cleanupExpired removes stale sessions and invokes onClose', () => {
    const store = new SessionStore(1_000, 10, 5);
    const stale = createMockEntry(Date.now() - 2_000);
    const fresh = createMockEntry(Date.now());
    store.set('stale', stale);
    store.set('fresh', fresh);

    const onClose = vi.fn();
    store.cleanupExpired(onClose);

    expect(store.get('stale')).toBeUndefined();
    expect(store.get('fresh')).toBe(fresh);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith(stale, 'stale');
  });

  it('canAcceptNewSession enforces maxSessions after cleanup', () => {
    const store = new SessionStore(60_000, 2, 5);
    store.set('a', createMockEntry(Date.now()));
    store.set('b', createMockEntry(Date.now()));

    const onClose = vi.fn();
    expect(store.canAcceptNewSession(undefined, onClose)).toBe(false);

    store.delete('a');
    expect(store.canAcceptNewSession(undefined, onClose)).toBe(true);
  });

  it('canAcceptNewSession closes expired sessions via onClose', () => {
    const store = new SessionStore(1_000, 2, 5);
    const stale = createMockEntry(Date.now() - 2_000);
    store.set('stale', stale);
    store.set('fresh', createMockEntry(Date.now()));

    const onClose = vi.fn();
    expect(store.canAcceptNewSession(undefined, onClose)).toBe(true);

    expect(store.get('stale')).toBeUndefined();
    expect(store.get('fresh')).toBeDefined();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith(stale, 'stale');
  });

  it('canAcceptNewSession enforces maxSessionsPerSubject', () => {
    const store = new SessionStore(60_000, 10, 2);
    const subjectEntry = (subject: string): SessionEntry => ({
      ...createMockEntry(Date.now()),
      auth: { mode: 'lightdash-oauth', tokenHash: 'hash-a', subject },
    });

    store.set('a', subjectEntry('user-a'));
    store.set('b', subjectEntry('user-a'));

    const onClose = vi.fn();
    expect(store.canAcceptNewSession('user-a', onClose)).toBe(false);
    expect(store.canAcceptNewSession('user-b', onClose)).toBe(true);
  });
});
