import type { IncomingMessage } from 'node:http';

const BEARER_PREFIX = /^bearer\s+/i;

/** Extracts a bearer token from Authorization header (case-insensitive scheme). */
export function extractBearerToken(req: IncomingMessage): string | undefined {
  const authorization = req.headers.authorization;
  if (typeof authorization !== 'string' || !BEARER_PREFIX.test(authorization)) {
    return undefined;
  }
  const token = authorization.replace(BEARER_PREFIX, '').trim();
  return token.length > 0 ? token : undefined;
}
