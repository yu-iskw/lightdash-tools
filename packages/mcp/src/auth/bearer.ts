import type { IncomingMessage } from 'node:http';

/** Extracts a bearer token from Authorization header. */
export function extractBearerToken(req: IncomingMessage): string | undefined {
  const authorization = req.headers.authorization;
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
    return undefined;
  }
  const token = authorization.slice('Bearer '.length).trim();
  return token.length > 0 ? token : undefined;
}
