import {
  ENV_LIGHTDASH_URL,
  ENV_LIGHTDASH_PROXY_AUTHORIZATION,
  SecretString,
} from '@lightdash-tools/client';
import { z } from 'zod';

import {
  MCP_AUTH_MODE_LIGHTDASH_OAUTH,
  MCP_AUTH_MODE_NONE,
  MCP_AUTH_MODE_SHARED_KEY,
  MCP_HTTP_AUTH_MODES,
} from '../auth/auth-mode.js';

import {
  ENV_LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS,
  ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE,
  ENV_LIGHTDASH_TOOLS_MCP_HTTP_HOST,
  ENV_LIGHTDASH_TOOLS_MCP_HTTP_PORT,
  ENV_LIGHTDASH_TOOLS_MCP_MAX_BODY_BYTES,
  ENV_LIGHTDASH_TOOLS_MCP_MAX_SESSIONS,
  ENV_LIGHTDASH_TOOLS_MCP_PATH,
  ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL,
  ENV_LIGHTDASH_TOOLS_MCP_REQUIRED_SCOPES,
  ENV_LIGHTDASH_TOOLS_MCP_SCOPES_SUPPORTED,
  ENV_LIGHTDASH_TOOLS_MCP_SESSION_CLEANUP_MS,
  ENV_LIGHTDASH_TOOLS_MCP_SESSION_TTL_MS,
  ENV_LIGHTDASH_TOOLS_MCP_SHARED_KEY,
  ENV_LIGHTDASH_TOOLS_MCP_TOKEN_VALIDATION_CACHE_TTL_MS,
  ENV_LIGHTDASH_TOOLS_MCP_VALIDATE_TOKEN,
  ENV_MCP_ALLOWED_ORIGINS,
  ENV_MCP_API_KEY,
  ENV_MCP_AUTH_ENABLED,
  ENV_MCP_HTTP_PORT,
  ENV_MCP_MAX_BODY_BYTES,
  ENV_MCP_MAX_SESSIONS,
  ENV_MCP_PUBLIC_URL,
  ENV_MCP_SERVER_PORT,
  ENV_MCP_SESSION_CLEANUP_MS,
  ENV_MCP_SESSION_TTL_MS,
} from './env.js';
import { normalizeLightdashUrl, normalizePublicUrl } from './normalize-url.js';

import type { McpAuthMode } from '../auth/auth-mode.js';

const warnedAliases = new Set<string>();

function warnDeprecatedAlias(oldName: string, newName: string): void {
  if (warnedAliases.has(oldName)) return;
  warnedAliases.add(oldName);
  console.warn(`Warning: ${oldName} is deprecated. Use ${newName}.`);
}

function readEnv(name: string): string | undefined {
  // eslint-disable-next-line security/detect-object-injection -- env var names are fixed constants in this module
  const value = process.env[name];
  if (value === undefined || value === '') return undefined;
  return value;
}

function parsePositiveIntegerEnv(name: string, value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid ${name}: ${value}. Expected a non-negative integer.`);
  }
  return parsed;
}

function readNumberEnv(
  primary: string,
  aliases: Array<{ name: string; newName: string }>,
  defaultValue: number,
): number {
  const primaryValue = readEnv(primary);
  if (primaryValue !== undefined) {
    return parsePositiveIntegerEnv(primary, primaryValue);
  }
  for (const alias of aliases) {
    const aliasValue = readEnv(alias.name);
    if (aliasValue !== undefined) {
      warnDeprecatedAlias(alias.name, alias.newName);
      return parsePositiveIntegerEnv(alias.name, aliasValue);
    }
  }
  return defaultValue;
}

function readStringEnv(
  primary: string,
  aliases: Array<{ name: string; newName: string }>,
): string | undefined {
  const primaryValue = readEnv(primary);
  if (primaryValue !== undefined) return primaryValue;
  for (const alias of aliases) {
    const aliasValue = readEnv(alias.name);
    if (aliasValue !== undefined) {
      warnDeprecatedAlias(alias.name, alias.newName);
      return aliasValue;
    }
  }
  return undefined;
}

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseBooleanEnv(name: string, value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  if (value === '1' || value === 'true' || value === 'yes') return true;
  if (value === '0' || value === 'false' || value === 'no') return false;
  throw new Error(`Invalid ${name}: ${value}. Expected 1, true, yes, 0, false, or no.`);
}

function resolveAuthMode(): McpAuthMode {
  const explicit = readEnv(ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE);
  if (explicit) {
    const parsed = z.enum(MCP_HTTP_AUTH_MODES).safeParse(explicit);
    if (!parsed.success) {
      throw new Error(
        `Invalid ${ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE}: ${explicit}. Expected ${MCP_HTTP_AUTH_MODES.join(', ')}.`,
      );
    }
    return parsed.data;
  }

  const legacyEnabled = readEnv(ENV_MCP_AUTH_ENABLED);
  if (legacyEnabled === '1' || legacyEnabled === 'true' || legacyEnabled === 'yes') {
    warnDeprecatedAlias(
      ENV_MCP_AUTH_ENABLED,
      `${ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE}=${MCP_AUTH_MODE_SHARED_KEY}`,
    );
    return MCP_AUTH_MODE_SHARED_KEY;
  }

  return MCP_AUTH_MODE_NONE;
}

export interface McpHttpConfig {
  lightdashUrl: string;
  proxyAuthorization?: SecretString;
  host: string;
  port: number;
  publicUrl?: string;
  mcpPath: string;
  authMode: McpAuthMode;
  sharedKey?: SecretString;
  allowedOrigins: string[];
  maxBodyBytes: number;
  sessionTtlMs: number;
  maxSessions: number;
  sessionCleanupMs: number;
  requiredScopes: string[];
  scopesSupported: string[];
  validateToken: boolean;
  tokenValidationCacheTtlMs: number;
}

function assertAuthModeRequirements(
  authMode: McpAuthMode,
  publicUrlRaw: string | undefined,
  sharedKeyRaw: string | undefined,
): void {
  if (authMode === MCP_AUTH_MODE_LIGHTDASH_OAUTH && !publicUrlRaw) {
    throw new Error(
      `${ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL} is required when auth mode is ${MCP_AUTH_MODE_LIGHTDASH_OAUTH}.`,
    );
  }

  if (authMode === MCP_AUTH_MODE_SHARED_KEY && !sharedKeyRaw) {
    throw new Error(
      `${ENV_LIGHTDASH_TOOLS_MCP_SHARED_KEY} is required when auth mode is ${MCP_AUTH_MODE_SHARED_KEY}.`,
    );
  }
}

function readScopeList(primary: string, fallback: string[]): string[] {
  const parsed = parseCsv(readEnv(primary));
  return parsed.length > 0 ? parsed : fallback;
}

export function loadMcpHttpConfig(_env: NodeJS.ProcessEnv = process.env): McpHttpConfig {
  const lightdashUrlRaw = readEnv(ENV_LIGHTDASH_URL);
  if (!lightdashUrlRaw) {
    throw new Error(`${ENV_LIGHTDASH_URL} is required.`);
  }

  const authMode = resolveAuthMode();
  const publicUrlRaw = readStringEnv(ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL, [
    { name: ENV_MCP_PUBLIC_URL, newName: ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL },
  ]);
  const sharedKeyRaw = readStringEnv(ENV_LIGHTDASH_TOOLS_MCP_SHARED_KEY, [
    { name: ENV_MCP_API_KEY, newName: ENV_LIGHTDASH_TOOLS_MCP_SHARED_KEY },
  ]);
  assertAuthModeRequirements(authMode, publicUrlRaw, sharedKeyRaw);

  const allowedOriginsRaw = readStringEnv(ENV_LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS, [
    { name: ENV_MCP_ALLOWED_ORIGINS, newName: ENV_LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS },
  ]);

  const proxyAuth = readEnv(ENV_LIGHTDASH_PROXY_AUTHORIZATION);

  return {
    lightdashUrl: normalizeLightdashUrl(lightdashUrlRaw),
    proxyAuthorization: proxyAuth ? new SecretString(proxyAuth) : undefined,
    host: readEnv(ENV_LIGHTDASH_TOOLS_MCP_HTTP_HOST) ?? '0.0.0.0',
    port: readNumberEnv(
      ENV_LIGHTDASH_TOOLS_MCP_HTTP_PORT,
      [
        { name: ENV_MCP_HTTP_PORT, newName: ENV_LIGHTDASH_TOOLS_MCP_HTTP_PORT },
        { name: ENV_MCP_SERVER_PORT, newName: ENV_LIGHTDASH_TOOLS_MCP_HTTP_PORT },
      ],
      3100,
    ),
    publicUrl: publicUrlRaw ? normalizePublicUrl(publicUrlRaw) : undefined,
    mcpPath: readEnv(ENV_LIGHTDASH_TOOLS_MCP_PATH) ?? '/mcp',
    authMode,
    sharedKey: sharedKeyRaw ? new SecretString(sharedKeyRaw) : undefined,
    allowedOrigins: parseCsv(allowedOriginsRaw),
    maxBodyBytes: readNumberEnv(
      ENV_LIGHTDASH_TOOLS_MCP_MAX_BODY_BYTES,
      [{ name: ENV_MCP_MAX_BODY_BYTES, newName: ENV_LIGHTDASH_TOOLS_MCP_MAX_BODY_BYTES }],
      1024 * 1024,
    ),
    sessionTtlMs: readNumberEnv(
      ENV_LIGHTDASH_TOOLS_MCP_SESSION_TTL_MS,
      [{ name: ENV_MCP_SESSION_TTL_MS, newName: ENV_LIGHTDASH_TOOLS_MCP_SESSION_TTL_MS }],
      30 * 60 * 1000,
    ),
    maxSessions: readNumberEnv(
      ENV_LIGHTDASH_TOOLS_MCP_MAX_SESSIONS,
      [{ name: ENV_MCP_MAX_SESSIONS, newName: ENV_LIGHTDASH_TOOLS_MCP_MAX_SESSIONS }],
      100,
    ),
    sessionCleanupMs: readNumberEnv(
      ENV_LIGHTDASH_TOOLS_MCP_SESSION_CLEANUP_MS,
      [{ name: ENV_MCP_SESSION_CLEANUP_MS, newName: ENV_LIGHTDASH_TOOLS_MCP_SESSION_CLEANUP_MS }],
      60_000,
    ),
    requiredScopes: readScopeList(ENV_LIGHTDASH_TOOLS_MCP_REQUIRED_SCOPES, ['mcp:read']),
    scopesSupported: readScopeList(ENV_LIGHTDASH_TOOLS_MCP_SCOPES_SUPPORTED, [
      'mcp:read',
      'mcp:write',
    ]),
    validateToken: parseBooleanEnv(
      ENV_LIGHTDASH_TOOLS_MCP_VALIDATE_TOKEN,
      readEnv(ENV_LIGHTDASH_TOOLS_MCP_VALIDATE_TOKEN),
      authMode === MCP_AUTH_MODE_LIGHTDASH_OAUTH,
    ),
    tokenValidationCacheTtlMs: readNumberEnv(
      ENV_LIGHTDASH_TOOLS_MCP_TOKEN_VALIDATION_CACHE_TTL_MS,
      [],
      30_000,
    ),
  };
}

export function requiresLightdashApiKey(authMode: McpAuthMode): boolean {
  return authMode === MCP_AUTH_MODE_NONE || authMode === MCP_AUTH_MODE_SHARED_KEY;
}
