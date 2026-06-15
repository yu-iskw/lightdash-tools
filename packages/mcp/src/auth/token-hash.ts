import { createHash } from 'node:crypto';

/** SHA-256 hash of a bearer token for session binding and cache keys. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
