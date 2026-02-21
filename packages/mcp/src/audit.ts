/**
 * Structured audit logger for MCP tool invocations.
 *
 * Each tool call is recorded as a single NDJSON line containing:
 *   timestamp, sessionId, tool name, projectUuid (if present), status, and durationMs.
 *
 * Output destination:
 *   - If LIGHTDASH_AUDIT_LOG is set to a file path, entries are appended to that file.
 *   - Otherwise entries are written to stderr with an "[audit]" prefix.
 */

import { createWriteStream, type WriteStream } from 'node:fs';
import { randomUUID } from 'node:crypto';

export type AuditStatus = 'success' | 'error' | 'blocked';

export type AuditLogEntry = {
  timestamp: string;
  sessionId: string;
  tool: string;
  projectUuid?: string;
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
 * Initialise the audit log. Call once at server startup.
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
