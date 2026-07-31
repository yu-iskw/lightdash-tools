import { timingSafeEqualString } from '../../transports/http-response.js';
import { extractBearerToken } from '../bearer.js';

import type { McpHttpConfig } from '../../config/load-mcp-config.js';
import type { IncomingMessage } from 'node:http';

export interface SharedKeyAuthSuccess {
  ok: true;
}

export interface SharedKeyAuthFailure {
  ok: false;
  status: number;
  body: Record<string, string>;
}

export type SharedKeyAuthResult = SharedKeyAuthFailure | SharedKeyAuthSuccess;

/** Validates MCP endpoint shared key from Bearer or X-API-Key header. */
export function authenticateSharedKey(
  req: IncomingMessage,
  config: McpHttpConfig,
): SharedKeyAuthResult {
  const expected = config.sharedKey?.expose();
  if (!expected) {
    return {
      ok: false,
      status: 500,
      body: { error: 'Server auth misconfiguration: shared key is missing' },
    };
  }

  const apiKey = req.headers['x-api-key'];
  const key = typeof apiKey === 'string' ? apiKey.trim() : undefined;
  const provided = extractBearerToken(req) ?? key;

  if (!provided || !timingSafeEqualString(provided, expected)) {
    return { ok: false, status: 401, body: { error: 'Unauthorized' } };
  }

  return { ok: true };
}
