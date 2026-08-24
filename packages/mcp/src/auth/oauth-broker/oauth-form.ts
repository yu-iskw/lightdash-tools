import { parseJsonBody, readBody } from '../../transports/http-body.js';
import { sendJson } from '../../transports/http-response.js';

import type { IncomingMessage, ServerResponse } from 'node:http';

function appendJsonValueToParams(params: URLSearchParams, key: string, value: unknown): void {
  if (typeof value === 'string') {
    params.set(key, value);
    return;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    params.set(key, String(value));
    return;
  }

  if (!Array.isArray(value)) {
    return;
  }

  for (const item of value) {
    if (typeof item === 'string') {
      params.append(key, item);
    }
  }
}

function jsonObjectToSearchParams(parsed: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(parsed)) {
    appendJsonValueToParams(params, key, value);
  }
  return params;
}

function readJsonFormParams(res: ServerResponse, rawBuf: Buffer): URLSearchParams | undefined {
  try {
    const parsed = parseJsonBody(rawBuf);
    if (parsed === undefined) return new URLSearchParams();
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      sendJson(res, 400, { error: 'invalid_request', error_description: 'Invalid JSON body' });
      return undefined;
    }
    return jsonObjectToSearchParams(parsed as Record<string, unknown>);
  } catch {
    sendJson(res, 400, { error: 'invalid_request', error_description: 'Invalid JSON body' });
    return undefined;
  }
}

/** Reads an OAuth form or JSON body into URLSearchParams. */
export async function readFormOrJson(
  req: IncomingMessage,
  res: ServerResponse,
  maxBodyBytes: number,
): Promise<URLSearchParams | undefined> {
  const rawBuf = await readBody(req, res, maxBodyBytes);
  if (rawBuf === undefined) return undefined;
  if (rawBuf.length === 0) return new URLSearchParams();

  const contentType = req.headers['content-type'] ?? '';
  if (contentType.includes('application/json')) {
    return readJsonFormParams(res, rawBuf);
  }

  return new URLSearchParams(rawBuf.toString('utf8'));
}
