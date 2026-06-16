import type { McpAuthMode } from '../auth/auth-mode.js';
import type { McpContextProvider } from '../request-context.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

export interface SessionAuthState {
  mode: McpAuthMode;
  tokenHash?: string;
  subject?: string;
  organizationUuid?: string;
}

export interface SessionEntry {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  lastAccessAt: number;
  auth: SessionAuthState;
  contextProvider?: McpContextProvider;
}

export class SessionStore {
  private readonly sessions = new Map<string, SessionEntry>();

  constructor(
    private readonly sessionTtlMs: number,
    private readonly maxSessions: number,
  ) {}

  get(sessionId: string): SessionEntry | undefined {
    return this.sessions.get(sessionId);
  }

  set(sessionId: string, entry: SessionEntry): void {
    this.sessions.set(sessionId, entry);
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
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
        this.sessions.delete(sessionId);
        onClose(entry, sessionId);
      }
    }
  }

  get size(): number {
    return this.sessions.size;
  }

  canAcceptNewSession(onClose: (entry: SessionEntry, sessionId: string) => void): boolean {
    this.cleanupExpired(onClose);
    return this.sessions.size < this.maxSessions;
  }

  drainAll(onClose: (entry: SessionEntry, sessionId: string) => void): void {
    for (const [sessionId, entry] of this.sessions) {
      onClose(entry, sessionId);
    }
    this.sessions.clear();
  }
}
