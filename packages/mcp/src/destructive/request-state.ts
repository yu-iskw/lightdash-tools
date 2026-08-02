/**
 * HMAC-signed requestState codec for destructive confirmation binding (ADR-0015).
 * (SDK createRequestStateCodec signs; payload is not encrypted.)
 */

import { createRequestStateCodec } from '@modelcontextprotocol/server';

import type { DestructiveRequestState } from './types.js';
import type { RequestStateCodec, ServerContext } from '@modelcontextprotocol/server';

const ENV_REQUEST_STATE_KEY = 'LIGHTDASH_TOOLS_MCP_REQUEST_STATE_KEY';
const TTL_SECONDS = 10 * 60;
const TEST_FALLBACK_KEY = 'lightdash-tools-dev-request-state-key!!';

let codec: RequestStateCodec<DestructiveRequestState> | undefined;

function isTestRuntime(): boolean {
  return process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
}

function readRequestStateKeyEnv(): string | undefined {
  const key = process.env.LIGHTDASH_TOOLS_MCP_REQUEST_STATE_KEY;
  return typeof key === 'string' ? key : undefined;
}

function hasConfiguredRequestStateKey(): boolean {
  const key = readRequestStateKeyEnv();
  return key !== undefined && key.length >= 32;
}

/**
 * Fail closed when content-governance destructive tools run without a secret key.
 * Vitest/NODE_ENV=test may use a deterministic fallback for contract tests.
 */
export function assertDestructiveRequestStateKeyConfigured(): void {
  if (isTestRuntime()) {
    return;
  }
  if (!hasConfiguredRequestStateKey()) {
    throw new Error(
      `${ENV_REQUEST_STATE_KEY} must be set to a secret of at least 32 bytes when content-governance destructive tools are enabled`,
    );
  }
}

function resolveKey(): string {
  const configured = readRequestStateKeyEnv();
  if (configured !== undefined && configured.length >= 32) {
    return configured;
  }
  if (isTestRuntime()) {
    return TEST_FALLBACK_KEY;
  }
  throw new Error(
    `${ENV_REQUEST_STATE_KEY} must be set to a secret of at least 32 bytes when content-governance destructive tools are enabled`,
  );
}

export function getDestructiveRequestStateCodec(): RequestStateCodec<DestructiveRequestState> {
  if (!codec) {
    codec = createRequestStateCodec<DestructiveRequestState>({
      key: resolveKey(),
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
