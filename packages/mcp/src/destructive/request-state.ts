/**
 * HMAC-signed requestState codec for destructive confirmation binding (ADR-0015).
 * (SDK createRequestStateCodec signs; payload is not encrypted.)
 */

import { createRequestStateCodec } from '@modelcontextprotocol/server';

import {
  DESTRUCTIVE_REQUEST_STATE_KEY_PURPOSE,
  resolveRequestStateKey,
} from '../auth/request-state-key.js';

import type { DestructiveRequestState } from './types.js';
import type { RequestStateCodec, ServerContext } from '@modelcontextprotocol/server';

const TTL_SECONDS = 10 * 60;

let codec: RequestStateCodec<DestructiveRequestState> | undefined;

function getDestructiveRequestStateCodec(): RequestStateCodec<DestructiveRequestState> {
  if (!codec) {
    codec = createRequestStateCodec<DestructiveRequestState>({
      key: resolveRequestStateKey(DESTRUCTIVE_REQUEST_STATE_KEY_PURPOSE),
      ttlSeconds: TTL_SECONDS,
    });
  }
  return codec;
}

/** Reset codec (tests only). */
export function resetDestructiveRequestStateCodecForTests(): void {
  codec = undefined;
}

export async function mintDestructiveRequestState(
  state: DestructiveRequestState,
  serverContext: ServerContext,
): Promise<string> {
  return getDestructiveRequestStateCodec().mint(state, serverContext);
}

export async function verifyDestructiveRequestState(
  token: string | undefined,
  serverContext: ServerContext,
): Promise<DestructiveRequestState | undefined> {
  if (token === undefined || token.length === 0) {
    return undefined;
  }
  try {
    return await getDestructiveRequestStateCodec().verify(token, serverContext);
  } catch {
    return undefined;
  }
}

export { getDestructiveRequestStateCodec };
