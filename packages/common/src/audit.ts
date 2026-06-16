/**
 * Structured audit logger for Lightdash tool invocations (MCP and CLI).
 *
 * Each operation is recorded as a single NDJSON line containing:
 *   timestamp, sessionId, tool/command name, projectUuids (if present), status, durationMs,
 *   and optional OAuth attribution fields (tokenHash, subject) when available.
 *
 * Output destination:
 *   - If LIGHTDASH_TOOLS_AUDIT_LOG is set to a file path, entries are appended to that file.
 *   - Otherwise entries are written to stderr with an "[audit]" prefix.
 */

import { randomUUID } from 'node:crypto';
import { createWriteStream, type WriteStream } from 'node:fs';

export type AuditStatus = 'blocked' | 'error' | 'success';

export type AuditLogEntry = {
  timestamp: string;
  sessionId: string;
  /** MCP tool name or CLI command name. */
  tool: string;
  /** Project UUIDs involved in the call, if any (covers both projectUuid and projectUuids[]). */
  projectUuids?: string[];
  /** SHA-256 hash of the OAuth bearer token (never the raw token). */
  tokenHash?: string;
  /** Lightdash user UUID when the call runs under OAuth bearer auth. */
  subject?: string;
  status: AuditStatus;
  durationMs: number;
};

/** Unique ID for the current process lifetime. Generated once at module load. */
const SESSION_ID = randomUUID();

let _writeStream: WriteStream | undefined;

export function getSessionId(): string {
  return SESSION_ID;
}

/**
 * Initialise the audit log. Call once at process startup.
 * If filePath is provided, entries are appended to that file; otherwise stderr is used.
 */
export function initAuditLog(filePath?: string): void {
  if (filePath) {
    _writeStream = createWriteStream(filePath, { flags: 'a' });
    _writeStream.on('error', (err) => {
      console.error('[audit] Failed to write to audit log file:', err);
    });
    console.error(`[audit] Writing to file: ${filePath} (session: ${SESSION_ID})`);
  } else {
    console.error(`[audit] Writing to stderr (session: ${SESSION_ID})`);
  }
}

/** Append one NDJSON entry to the configured output. */
export function logAuditEntry(entry: AuditLogEntry): void {
  const line = `${JSON.stringify(entry)}\n`;
  if (_writeStream) {
    _writeStream.write(line);
  } else {
    process.stderr.write(`[audit] ${line}`);
  }
}

/** Closes the file stream, if any. Awaits pending writes before resolving. */
export function closeAuditLog(): Promise<void> {
  const stream = _writeStream;
  if (!stream) return Promise.resolve();
  return new Promise((resolve, reject) => {
    stream.end(() => {
      _writeStream = undefined;
      resolve();
    });
    stream.on('error', reject);
  });
}
