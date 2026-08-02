/**
 * Streamable HTTP MCP session store (ADR-0007 / ADR-0016).
 *
 * ## Hybrid design (when LIGHTDASH_TOOLS_MCP_STORE=redis)
 *
 * `SessionEntry` holds live `transport` / `server` objects that **cannot** be
 * serialized to Redis. This store therefore always keeps those objects in a
 * process-local Map.
 *
 * When a Redis session index is attached (via `createSessionStore`):
 * - Serializable metadata (sessionId, auth, lastAccessAt, personaId) is also
 *   written to Redis for multi-instance *awareness* / TTL / ops visibility.
 * - `get()` only returns a session when the transport lives on **this** process.
 *   Redis metadata without a local entry is treated as not found (clear failure
 *   when a request lands on the wrong replica).
 * - Streamable HTTP transport affinity still requires **sticky sessions** or a
 *   single instance for in-flight transports. OAuth pending state (separate
 *   store) is the fully shared multi-instance path.
 *
 * Capacity checks (`maxSessions` / per-subject) remain process-local.
 */

import type { McpAuthMode } from '../auth/auth-mode.js';
import type { PersonaId } from '../personas/types.js';
import type { McpContextProvider } from '../server/request-context.js';
import type { RedisSessionIndex } from '../store/redis-session-index.js';
import type { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import type { McpServer } from '@modelcontextprotocol/server';

export interface SessionAuthState {
  mode: McpAuthMode;
  tokenHash?: string;
  subject?: string;
  organizationUuid?: string;
}

export interface SessionEntry {
  transport: NodeStreamableHTTPServerTransport;
  server: McpServer;
  lastAccessAt: number;
  auth: SessionAuthState;
  contextProvider?: McpContextProvider;
  /** Persona that owns this session (must match request path). */
  personaId: PersonaId;
}

export class SessionStore {
  private readonly sessions = new Map<string, SessionEntry>();
  private readonly subjectSessionCounts = new Map<string, number>();

  constructor(
    private readonly sessionTtlMs: number,
    private readonly maxSessions: number,
    /** `0` disables the per-subject cap (unlimited per subject; global maxSessions still applies). */
    private readonly maxSessionsPerSubject: number,
    /**
     * Optional Redis index for serializable session metadata (hybrid mode).
     * Live transport/server objects remain in `sessions` only.
     */
    private readonly sessionIndex?: RedisSessionIndex,
  ) {}

  get(sessionId: string): SessionEntry | undefined {
    // Local-only: Redis index without a local transport is a cross-instance miss.
    return this.sessions.get(sessionId);
  }

  set(sessionId: string, entry: SessionEntry): void {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      this.decrementSubjectCount(existing);
    }

    this.sessions.set(sessionId, entry);
    const subject = entry.auth.subject;
    if (subject) {
      this.subjectSessionCounts.set(subject, (this.subjectSessionCounts.get(subject) ?? 0) + 1);
    }

    if (this.sessionIndex) {
      void this.sessionIndex
        .put({
          sessionId,
          lastAccessAt: entry.lastAccessAt,
          auth: entry.auth,
          personaId: entry.personaId,
        })
        .catch((err: unknown) => {
          console.error(`Failed to persist session index ${sessionId}:`, err);
        });
    }
  }

  delete(sessionId: string): void {
    const entry = this.sessions.get(sessionId);
    if (entry) {
      this.decrementSubjectCount(entry);
    }
    this.sessions.delete(sessionId);

    if (this.sessionIndex) {
      void this.sessionIndex.delete(sessionId).catch((err: unknown) => {
        console.error(`Failed to delete session index ${sessionId}:`, err);
      });
    }
  }

  private decrementSubjectCount(entry: SessionEntry): void {
    const subject = entry.auth.subject;
    if (!subject) return;

    const count = this.subjectSessionCounts.get(subject) ?? 0;
    if (count <= 1) {
      this.subjectSessionCounts.delete(subject);
    } else {
      this.subjectSessionCounts.set(subject, count - 1);
    }
  }

  touch(sessionId: string): void {
    const entry = this.sessions.get(sessionId);
    if (entry) {
      entry.lastAccessAt = Date.now();
      if (this.sessionIndex) {
        void this.sessionIndex.touch(sessionId, entry.lastAccessAt).catch((err: unknown) => {
          console.error(`Failed to touch session index ${sessionId}:`, err);
        });
      }
    }
  }

  cleanupExpired(onClose: (entry: SessionEntry, sessionId: string) => void): void {
    const now = Date.now();
    for (const [sessionId, entry] of this.sessions) {
      if (now - entry.lastAccessAt > this.sessionTtlMs) {
        this.delete(sessionId);
        onClose(entry, sessionId);
      }
    }
  }

  get size(): number {
    return this.sessions.size;
  }

  canAcceptNewSession(
    subject: string | undefined,
    onClose: (entry: SessionEntry, sessionId: string) => void,
  ): boolean {
    this.cleanupExpired(onClose);
    if (this.sessions.size >= this.maxSessions) {
      return false;
    }
    if (
      subject &&
      this.maxSessionsPerSubject > 0 &&
      (this.subjectSessionCounts.get(subject) ?? 0) >= this.maxSessionsPerSubject
    ) {
      return false;
    }
    return true;
  }

  drainAll(onClose: (entry: SessionEntry, sessionId: string) => void): void {
    for (const [sessionId, entry] of this.sessions) {
      onClose(entry, sessionId);
      if (this.sessionIndex) {
        void this.sessionIndex.delete(sessionId).catch((err: unknown) => {
          console.error(`Failed to delete session index ${sessionId} on drain:`, err);
        });
      }
    }
    this.sessions.clear();
    this.subjectSessionCounts.clear();
  }
}
