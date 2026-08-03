/**
 * Structured audit logger for Lightdash tool invocations (MCP and CLI).
 *
 * Each operation is recorded as a single NDJSON line. On stderr the line is pure JSON
 * (Cloud Logging–parseable); text prefixes prevent jsonPayload parsing on Cloud Run.
 *
 * If LIGHTDASH_TOOLS_AUDIT_LOG is a file path, entries are appended there; otherwise stderr.
 */

import { randomUUID } from 'node:crypto';
import { createWriteStream, type WriteStream } from 'node:fs';

export type AuditStatus =
  | 'blocked'
  | 'confirmation_cancelled'
  | 'confirmation_declined'
  | 'confirmation_requested'
  | 'deletion_failed'
  | 'deletion_succeeded'
  | 'error'
  | 'promotion_failed'
  | 'promotion_succeeded'
  | 'resource_changed'
  | 'success';

/** Cloud Logging LogSeverity-compatible strings for structured stderr JSON. */
export type AuditSeverity = 'ERROR' | 'INFO' | 'NOTICE' | 'WARNING';

export type AuditLogEntry = {
  /** Stable filter key for Cloud Logging (`jsonPayload.channel="audit"`). */
  channel: 'audit';
  severity: AuditSeverity;
  message: string;
  timestamp: string;
  /** Process-lifetime instance id (not the MCP client session). */
  sessionId: string;
  tool: string;
  projectUuids?: string[];
  /** SHA-256 hash of the OAuth bearer token (never the raw token). */
  tokenHash?: string;
  /** Lightdash user UUID when the call runs under OAuth bearer auth. */
  subject?: string;
  clientSessionId?: string;
  personaId?: string;
  status: AuditStatus;
  durationMs: number;
};

export type BuildAuditLogEntryInput = {
  tool: string;
  status: AuditStatus;
  /** Epoch ms when the operation started (`durationMs = now - startMs`). */
  startMs: number;
  projectUuids?: string[];
  tokenHash?: string;
  subject?: string;
  clientSessionId?: string;
  personaId?: string;
};

/** Unique ID for the current process lifetime. Generated once at module load. */
const SESSION_ID = randomUUID();

let _writeStream: WriteStream | undefined;

export function getSessionId(): string {
  return SESSION_ID;
}

/** Map audit status to Cloud Logging severity. */
export function auditSeverityForStatus(status: AuditStatus): AuditSeverity {
  switch (status) {
    case 'success':
      return 'INFO';
    case 'deletion_succeeded':
    case 'promotion_succeeded':
      return 'NOTICE';
    case 'blocked':
    case 'confirmation_cancelled':
    case 'confirmation_declined':
    case 'confirmation_requested':
    case 'resource_changed':
      return 'WARNING';
    case 'deletion_failed':
    case 'error':
    case 'promotion_failed':
      return 'ERROR';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

/** Assemble a full audit entry (shared by CLI and MCP). */
export function buildAuditLogEntry(input: BuildAuditLogEntryInput): AuditLogEntry {
  const projectUuids =
    input.projectUuids && input.projectUuids.length > 0 ? input.projectUuids : undefined;
  return {
    channel: 'audit',
    severity: auditSeverityForStatus(input.status),
    message: `${input.tool} ${input.status}`,
    timestamp: new Date().toISOString(),
    sessionId: SESSION_ID,
    tool: input.tool,
    projectUuids,
    tokenHash: input.tokenHash,
    subject: input.subject,
    clientSessionId: input.clientSessionId,
    personaId: input.personaId,
    status: input.status,
    durationMs: Date.now() - input.startMs,
  };
}

/**
 * Initialise the audit log. Call once at process startup.
 * If filePath is provided, entries are appended to that file; otherwise stderr is used.
 * Startup banners go to stdout so they do not mix with structured audit JSON on stderr.
 */
export function initAuditLog(filePath?: string): void {
  if (filePath) {
    _writeStream = createWriteStream(filePath, { flags: 'a' });
    _writeStream.on('error', (err) => {
      // Diagnostic only — not an audit row.
      console.error('[audit] Failed to write to audit log file:', err);
    });
    console.log(`[audit] Writing to file: ${filePath} (session: ${SESSION_ID})`);
  } else {
    console.log(`[audit] Writing to stderr (session: ${SESSION_ID})`);
  }
}

/** Append one NDJSON entry to the configured output. */
export function logAuditEntry(entry: AuditLogEntry): void {
  const line = `${JSON.stringify(entry)}\n`;
  if (_writeStream) {
    _writeStream.write(line);
  } else {
    process.stderr.write(line);
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
