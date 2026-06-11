/**
 * RFC structured logging for the MCP HTTP server (stderr NDJSON).
 *
 * Distinct from the audit log: operational events (startup, sessions, errors)
 * rather than per-tool invocation records.
 */

import { getSessionId } from '../audit.js';

export type StructuredLogLevel = 'debug' | 'error' | 'info' | 'warn';

export type StructuredLogEntry = Record<string, unknown> & {
  timestamp: string;
  level: StructuredLogLevel;
  component: string;
  event: string;
  message: string;
  sessionId?: string;
};

export type StructuredLogInput = Record<string, unknown> & {
  timestamp?: string;
  sessionId?: string;
  level: StructuredLogLevel;
  component: string;
  event: string;
  message: string;
};

/**
 * Emits one RFC-shaped JSON log line to stderr.
 */
export function emitStructuredLog(input: StructuredLogInput): void {
  const { timestamp, sessionId, level, component, event, message, ...rest } = input;
  const entry: StructuredLogEntry = {
    ...rest,
    timestamp: timestamp ?? new Date().toISOString(),
    sessionId: sessionId ?? getSessionId(),
    level,
    component,
    event,
    message,
  };

  process.stderr.write(`${JSON.stringify(entry)}\n`);
}
