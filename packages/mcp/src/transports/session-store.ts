import type { McpAuthMode } from '../auth/auth-mode.js';
import type { McpContextProvider } from '../request-context.js';
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
}

export class SessionStore {
  private readonly sessions = new Map<string, SessionEntry>();
  private readonly subjectSessionCounts = new Map<string, number>();

  constructor(
    private readonly sessionTtlMs: number,
    private readonly maxSessions: number,
    /** `0` disables the per-subject cap (unlimited per subject; global maxSessions still applies). */
    private readonly maxSessionsPerSubject: number,
  ) {}

  get(sessionId: string): SessionEntry | undefined {
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
  }

  delete(sessionId: string): void {
    const entry = this.sessions.get(sessionId);
    if (entry) {
      this.decrementSubjectCount(entry);
    }
    this.sessions.delete(sessionId);
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
    }
    this.sessions.clear();
    this.subjectSessionCounts.clear();
  }
}
