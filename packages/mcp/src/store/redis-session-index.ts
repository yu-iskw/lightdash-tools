/**
 * Redis session *index* for hybrid SessionStore (ADR-0016).
 *
 * Stores only serializable metadata (sessionId, auth, lastAccessAt, personaId).
 * Live MCP transport/server objects stay process-local — see SessionStore docs.
 *
 * Key prefix: `lightdash-tools:mcp:session:`.
 */

import type { PersonaId } from '../personas/types.js';
import type { SessionAuthState } from '../transports/session-store.js';
import type { RedisClientType } from 'redis';

export const SESSION_REDIS_KEY_PREFIX = 'lightdash-tools:mcp:session:';

/** Serializable fields mirrored to Redis for multi-instance awareness / TTL. */
export type SessionIndexRecord = {
  sessionId: string;
  lastAccessAt: number;
  auth: SessionAuthState;
  personaId: PersonaId;
};

function sessionKey(sessionId: string): string {
  return `${SESSION_REDIS_KEY_PREFIX}${sessionId}`;
}

export class RedisSessionIndex {
  constructor(
    private readonly getClient: () => Promise<RedisClientType>,
    private readonly sessionTtlMs: number,
  ) {}

  async put(record: SessionIndexRecord): Promise<void> {
    const client = await this.getClient();
    await client.set(sessionKey(record.sessionId), JSON.stringify(record), {
      PX: this.sessionTtlMs,
    });
  }

  async touch(sessionId: string, lastAccessAt: number): Promise<void> {
    const client = await this.getClient();
    const raw = await client.get(sessionKey(sessionId));
    if (raw == null) {
      return;
    }
    const record = JSON.parse(raw) as SessionIndexRecord;
    record.lastAccessAt = lastAccessAt;
    await client.set(sessionKey(sessionId), JSON.stringify(record), {
      PX: this.sessionTtlMs,
    });
  }

  async delete(sessionId: string): Promise<void> {
    const client = await this.getClient();
    await client.del(sessionKey(sessionId));
  }

  /** Read index metadata (does not imply local transport ownership). */
  async get(sessionId: string): Promise<SessionIndexRecord | undefined> {
    const client = await this.getClient();
    const raw = await client.get(sessionKey(sessionId));
    if (raw == null) {
      return undefined;
    }
    return JSON.parse(raw) as SessionIndexRecord;
  }
}
