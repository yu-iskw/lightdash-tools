import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

import type { McpHttpConfig } from '../../config/load-mcp-config.js';

const TOKEN_PREFIX = 'ldmcp1';
const KEY_CONTEXT = 'lightdash-tools:mcp-oauth-access-token:v1';
const AAD = Buffer.from(KEY_CONTEXT, 'utf8');
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const MAX_TOKEN_LENGTH = 16 * 1024;

export interface McpAccessTokenPayload {
  v: 1;
  /** Server-held downstream Lightdash credential. Never return this field to MCP clients. */
  lightdashAccessToken: string;
  /** MCP OAuth client_id that completed the broker flow. */
  clientId: string;
  /** Exact RFC 8707 MCP protected-resource URI this token is valid for. */
  resource: string;
  /** MCP authorization scope, not the downstream Lightdash token scope. */
  scope?: string;
  /** Unix timestamp in seconds. */
  iat: number;
  /** Unix timestamp in seconds. */
  exp: number;
}

function deriveEncryptionKey(config: McpHttpConfig): Buffer {
  if (!config.oauthClientSecret) {
    throw new Error('OAuth client secret is required to protect MCP access tokens');
  }

  // The confidential Lightdash client secret is already shared by every broker replica.
  // Derive a purpose-specific 256-bit key so the raw secret is never used directly as an AES key.
  return createHmac('sha256', config.oauthClientSecret.expose()).update(KEY_CONTEXT).digest();
}

function isPayload(value: unknown): value is McpAccessTokenPayload {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    record.v === 1 &&
    typeof record.lightdashAccessToken === 'string' &&
    record.lightdashAccessToken.length > 0 &&
    typeof record.clientId === 'string' &&
    record.clientId.length > 0 &&
    typeof record.resource === 'string' &&
    record.resource.length > 0 &&
    (record.scope === undefined || typeof record.scope === 'string') &&
    typeof record.iat === 'number' &&
    Number.isSafeInteger(record.iat) &&
    typeof record.exp === 'number' &&
    Number.isSafeInteger(record.exp)
  );
}

export function mintMcpAccessToken(
  config: McpHttpConfig,
  input: {
    lightdashAccessToken: string;
    clientId: string;
    resource: string;
    scope?: string;
    expiresAtMs: number;
  },
  nowMs = Date.now(),
): { accessToken: string; expiresIn: number } {
  const nowSeconds = Math.floor(nowMs / 1000);
  const exp = Math.floor(input.expiresAtMs / 1000);
  const expiresIn = exp - nowSeconds;
  if (expiresIn <= 0) {
    throw new Error('Upstream Lightdash access token is already expired');
  }

  const payload: McpAccessTokenPayload = {
    v: 1,
    lightdashAccessToken: input.lightdashAccessToken,
    clientId: input.clientId,
    resource: input.resource,
    scope: input.scope,
    iat: nowSeconds,
    exp,
  };

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', deriveEncryptionKey(config), iv);
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    accessToken: [
      TOKEN_PREFIX,
      iv.toString('base64url'),
      ciphertext.toString('base64url'),
      tag.toString('base64url'),
    ].join('.'),
    expiresIn,
  };
}

/**
 * Authenticates/decrypts an MCP-issued bearer token and enforces its exact resource audience.
 * Returns undefined for malformed, tampered, expired, or cross-resource tokens.
 */
export function verifyMcpAccessToken(
  config: McpHttpConfig,
  token: string,
  expectedResource: string,
  nowMs = Date.now(),
): McpAccessTokenPayload | undefined {
  if (token.length === 0 || token.length > MAX_TOKEN_LENGTH) return undefined;

  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== TOKEN_PREFIX) return undefined;

  try {
    const iv = Buffer.from(parts[1]!, 'base64url');
    const ciphertext = Buffer.from(parts[2]!, 'base64url');
    const tag = Buffer.from(parts[3]!, 'base64url');
    if (iv.length !== IV_BYTES || tag.length !== AUTH_TAG_BYTES || ciphertext.length === 0) {
      return undefined;
    }

    const decipher = createDecipheriv('aes-256-gcm', deriveEncryptionKey(config), iv);
    decipher.setAAD(AAD);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    const parsed = JSON.parse(plaintext) as unknown;
    if (!isPayload(parsed)) return undefined;

    const nowSeconds = Math.floor(nowMs / 1000);
    if (parsed.exp <= nowSeconds || parsed.iat > nowSeconds + 60) return undefined;
    if (parsed.resource !== expectedResource) return undefined;

    return parsed;
  } catch {
    return undefined;
  }
}
