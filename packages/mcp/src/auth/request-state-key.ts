/**
 * Shared HMAC key for MCP opaque tokens (previewToken + destructive requestState).
 * Env: LIGHTDASH_TOOLS_MCP_REQUEST_STATE_KEY (≥32 bytes).
 */

import { ENV_LIGHTDASH_TOOLS_MCP_REQUEST_STATE_KEY } from '../config/env.js';

const TEST_FALLBACK_KEY = 'lightdash-tools-dev-request-state-key!!';

export const PREVIEW_TOKEN_KEY_PURPOSE = 'content-developer preview tokens are enabled';
export const DESTRUCTIVE_REQUEST_STATE_KEY_PURPOSE =
  'content-governance destructive tools are enabled';
/** HTTP ships all profiles; preview + destructive elicitation share one signing key. */
export const HTTP_SIGNED_STATE_KEY_PURPOSE =
  'HTTP MCP exposes content-developer preview tokens and content-governance destructive tools';

function isTestRuntime(): boolean {
  return process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
}

function readConfiguredKey(): string | undefined {
  const key = process.env.LIGHTDASH_TOOLS_MCP_REQUEST_STATE_KEY;
  return typeof key === 'string' ? key : undefined;
}

function isUsableKey(key: string | undefined): key is string {
  return key !== undefined && key.length >= 32;
}

/** Resolve the HMAC signing key (configured env or test fallback). */
export function resolveRequestStateKey(purpose: string): string {
  const configured = readConfiguredKey();
  if (isUsableKey(configured)) {
    return configured;
  }
  if (isTestRuntime()) {
    return TEST_FALLBACK_KEY;
  }
  throw new Error(
    `${ENV_LIGHTDASH_TOOLS_MCP_REQUEST_STATE_KEY} must be set to a secret of at least 32 bytes when ${purpose}`,
  );
}

/**
 * Fail closed when content-governance / content-developer signed tokens are needed.
 * Vitest/NODE_ENV=test may use a deterministic fallback (checked via resolve).
 */
export function assertRequestStateKeyConfigured(purpose: string): void {
  resolveRequestStateKey(purpose);
}

/** Fail fast when HTTP starts with profiles that require signed preview/destructive tokens. */
export function assertHttpSignedStateKeyConfigured(): void {
  assertRequestStateKeyConfigured(HTTP_SIGNED_STATE_KEY_PURPOSE);
}

export { ENV_LIGHTDASH_TOOLS_MCP_REQUEST_STATE_KEY };
