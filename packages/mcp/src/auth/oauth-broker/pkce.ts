import { createHash } from 'node:crypto';

import { timingSafeEqualString } from '../../transports/http-response.js';

/** Verifies S256 PKCE code_verifier against stored challenge (PLAIN is not supported). */
export function verifyPkce(
  codeVerifier: string | undefined,
  codeChallenge: string,
  codeChallengeMethod: string,
): boolean {
  if (!codeVerifier) {
    return false;
  }

  // AS metadata advertises S256 only — reject PLAIN and unknown methods.
  if (codeChallengeMethod.toUpperCase() !== 'S256') {
    return false;
  }

  const computed = createHash('sha256').update(codeVerifier).digest('base64url');
  return timingSafeEqualString(computed, codeChallenge);
}
