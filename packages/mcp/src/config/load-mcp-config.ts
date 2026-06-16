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
  ENV_LIGHTDASH_TOOLS_MCP_ALLOW_INSECURE_PUBLIC_URL,
  ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE,
  ENV_LIGHTDASH_TOOLS_MCP_DANGEROUSLY_ALLOW_UNAUTHENTICATED,
  ENV_LIGHTDASH_TOOLS_MCP_DANGEROUSLY_GRANT_ALL_SCOPES,
  ENV_LIGHTDASH_TOOLS_MCP_DANGEROUSLY_SKIP_TOKEN_VALIDATION,
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
import {
  normalizeLightdashUrl,
  normalizeMcpPath,
  normalizePublicUrl,
  isLocalHttpOrigin,
} from './normalize-url.js';

import type { McpAuthMode } from '../auth/auth-mode.js';

const DEFAULT_SCOPES_SUPPORTED = ['read', 'write', 'mcp:read', 'mcp:write'] as const;

const warnedAliases = new Set<string>();

function warnDeprecatedAlias(oldName: string, newName: string): void {
  if (warnedAliases.has(oldName)) return;
  warnedAliases.add(oldName);
  console.warn(`Warning: ${oldName} is deprecated. Use ${newName}.`);
}

function readEnv(name: string, env: NodeJS.ProcessEnv): string | undefined {
  // eslint-disable-next-line security/detect-object-injection -- env var names are fixed constants in this module
  const value = env[name];
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
  env: NodeJS.ProcessEnv,
  primary: string,
  aliases: Array<{ name: string; newName: string }>,
  defaultValue: number,
): number {
  const primaryValue = readEnv(primary, env);
  if (primaryValue !== undefined) {
    return parsePositiveIntegerEnv(primary, primaryValue);
  }
  for (const alias of aliases) {
    const aliasValue = readEnv(alias.name, env);
    if (aliasValue !== undefined) {
      warnDeprecatedAlias(alias.name, alias.newName);
      return parsePositiveIntegerEnv(alias.name, aliasValue);
    }
  }
  return defaultValue;
}

function readStringEnv(
  env: NodeJS.ProcessEnv,
  primary: string,
  aliases: Array<{ name: string; newName: string }>,
): string | undefined {
  const primaryValue = readEnv(primary, env);
  if (primaryValue !== undefined) return primaryValue;
  for (const alias of aliases) {
    const aliasValue = readEnv(alias.name, env);
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

function resolveAuthMode(env: NodeJS.ProcessEnv): McpAuthMode {
  const explicit = readEnv(ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE, env);
  if (explicit) {
    const parsed = z.enum(MCP_HTTP_AUTH_MODES).safeParse(explicit);
    if (!parsed.success) {
      throw new Error(
        `Invalid ${ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE}: ${explicit}. Expected ${MCP_HTTP_AUTH_MODES.join(', ')}.`,
      );
    }
    return parsed.data;
  }

  const legacyEnabled = readEnv(ENV_MCP_AUTH_ENABLED, env);
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
  grantAllScopesWhenUnknown: boolean;
}

function assertPublicUrlSecurity(
  authMode: McpAuthMode,
  publicUrl: string | undefined,
  env: NodeJS.ProcessEnv,
): void {
  if (authMode !== MCP_AUTH_MODE_LIGHTDASH_OAUTH || !publicUrl) return;

  if (publicUrl.startsWith('https://')) return;

  const allowInsecure = parseBooleanEnv(
    ENV_LIGHTDASH_TOOLS_MCP_ALLOW_INSECURE_PUBLIC_URL,
    readEnv(ENV_LIGHTDASH_TOOLS_MCP_ALLOW_INSECURE_PUBLIC_URL, env),
    false,
  );
  if (allowInsecure) return;

  if (isLocalHttpOrigin(publicUrl)) return;

  throw new Error(
    `${ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL} must use https:// in lightdash-oauth mode (got ${publicUrl}). ` +
      `For local HTTP testing set ${ENV_LIGHTDASH_TOOLS_MCP_ALLOW_INSECURE_PUBLIC_URL}=1.`,
  );
}

function assertValidateTokenPolicy(
  authMode: McpAuthMode,
  validateToken: boolean,
  env: NodeJS.ProcessEnv,
): void {
  if (authMode !== MCP_AUTH_MODE_LIGHTDASH_OAUTH || validateToken) return;

  const dangerouslyAllowed = parseBooleanEnv(
    ENV_LIGHTDASH_TOOLS_MCP_DANGEROUSLY_SKIP_TOKEN_VALIDATION,
    readEnv(ENV_LIGHTDASH_TOOLS_MCP_DANGEROUSLY_SKIP_TOKEN_VALIDATION, env),
    false,
  );
  const isDevelopment = env.NODE_ENV === 'development';

  if (!isDevelopment && !dangerouslyAllowed) {
    throw new Error(
      `${ENV_LIGHTDASH_TOOLS_MCP_VALIDATE_TOKEN}=false disables OAuth token validation and is not allowed in production. ` +
        `Unset it, set NODE_ENV=development for local dev, or set ${ENV_LIGHTDASH_TOOLS_MCP_DANGEROUSLY_SKIP_TOKEN_VALIDATION}=1 ` +
        `only when you accept the security risk.`,
    );
  }
}

function assertAuthModeProductionPolicy(authMode: McpAuthMode, env: NodeJS.ProcessEnv): void {
  if (authMode !== MCP_AUTH_MODE_NONE || env.NODE_ENV !== 'production') return;

  const dangerouslyAllowed = parseBooleanEnv(
    ENV_LIGHTDASH_TOOLS_MCP_DANGEROUSLY_ALLOW_UNAUTHENTICATED,
    readEnv(ENV_LIGHTDASH_TOOLS_MCP_DANGEROUSLY_ALLOW_UNAUTHENTICATED, env),
    false,
  );

  if (!dangerouslyAllowed) {
    throw new Error(
      `${ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE}=${MCP_AUTH_MODE_NONE} is not allowed in production. ` +
        `Use lightdash-oauth or shared-key, or set ${ENV_LIGHTDASH_TOOLS_MCP_DANGEROUSLY_ALLOW_UNAUTHENTICATED}=1 ` +
        `only when you accept the security risk.`,
    );
  }
}

function assertGrantAllScopesPolicy(env: NodeJS.ProcessEnv, enabled: boolean): void {
  if (!enabled || env.NODE_ENV !== 'production') return;

  throw new Error(
    `${ENV_LIGHTDASH_TOOLS_MCP_DANGEROUSLY_GRANT_ALL_SCOPES}=true grants all MCP scopes to opaque or claimless tokens and is not allowed in production. ` +
      `Use JWT access tokens with scope claims, or set NODE_ENV=development for local testing.`,
  );
}

/** Loud warnings for operator misconfiguration. Call once at HTTP server startup. */
export function emitMcpHttpSecurityWarnings(config: McpHttpConfig): void {
  if (config.authMode === MCP_AUTH_MODE_NONE) {
    console.warn(
      'Warning: LIGHTDASH_TOOLS_MCP_AUTH_MODE=none — MCP HTTP endpoint is unauthenticated. Use lightdash-oauth or shared-key in production.',
    );
  }

  if (config.authMode === MCP_AUTH_MODE_LIGHTDASH_OAUTH && !config.validateToken) {
    console.warn(
      `Warning: ${ENV_LIGHTDASH_TOOLS_MCP_VALIDATE_TOKEN}=false — MCP accepts any bearer token without calling Lightdash. ` +
        'Use only for local development.',
    );
  }

  if (config.grantAllScopesWhenUnknown) {
    console.warn(
      `Warning: ${ENV_LIGHTDASH_TOOLS_MCP_DANGEROUSLY_GRANT_ALL_SCOPES}=true — opaque or claimless tokens are granted every supported MCP scope.`,
    );
  }

  if (config.allowedOrigins.length === 0) {
    console.warn(
      `Warning: ${ENV_LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS} is empty — CORS reflects any browser Origin. ` +
        'Set an explicit allowlist for browser-facing deployments.',
    );
  }
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

function readScopeList(env: NodeJS.ProcessEnv, primary: string, fallback: string[]): string[] {
  const parsed = parseCsv(readEnv(primary, env));
  return parsed.length > 0 ? parsed : fallback;
}

export function loadMcpHttpConfig(env: NodeJS.ProcessEnv = process.env): McpHttpConfig {
  const lightdashUrlRaw = readEnv(ENV_LIGHTDASH_URL, env);
  if (!lightdashUrlRaw) {
    throw new Error(`${ENV_LIGHTDASH_URL} is required.`);
  }

  const authMode = resolveAuthMode(env);
  assertAuthModeProductionPolicy(authMode, env);

  const publicUrlRaw = readStringEnv(env, ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL, [
    { name: ENV_MCP_PUBLIC_URL, newName: ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL },
  ]);
  const sharedKeyRaw = readStringEnv(env, ENV_LIGHTDASH_TOOLS_MCP_SHARED_KEY, [
    { name: ENV_MCP_API_KEY, newName: ENV_LIGHTDASH_TOOLS_MCP_SHARED_KEY },
  ]);
  assertAuthModeRequirements(authMode, publicUrlRaw, sharedKeyRaw);

  const allowedOriginsRaw = readStringEnv(env, ENV_LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS, [
    { name: ENV_MCP_ALLOWED_ORIGINS, newName: ENV_LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS },
  ]);

  const proxyAuth = readEnv(ENV_LIGHTDASH_PROXY_AUTHORIZATION, env);

  const mcpPathRaw = readEnv(ENV_LIGHTDASH_TOOLS_MCP_PATH, env) ?? '/mcp';
  const mcpPath = normalizeMcpPath(mcpPathRaw);
  const publicUrl = publicUrlRaw ? normalizePublicUrl(publicUrlRaw, mcpPath) : undefined;
  assertPublicUrlSecurity(authMode, publicUrl, env);

  const validateToken = parseBooleanEnv(
    ENV_LIGHTDASH_TOOLS_MCP_VALIDATE_TOKEN,
    readEnv(ENV_LIGHTDASH_TOOLS_MCP_VALIDATE_TOKEN, env),
    authMode === MCP_AUTH_MODE_LIGHTDASH_OAUTH,
  );
  assertValidateTokenPolicy(authMode, validateToken, env);

  const grantAllScopesWhenUnknown = parseBooleanEnv(
    ENV_LIGHTDASH_TOOLS_MCP_DANGEROUSLY_GRANT_ALL_SCOPES,
    readEnv(ENV_LIGHTDASH_TOOLS_MCP_DANGEROUSLY_GRANT_ALL_SCOPES, env),
    false,
  );
  assertGrantAllScopesPolicy(env, grantAllScopesWhenUnknown);

  return {
    lightdashUrl: normalizeLightdashUrl(lightdashUrlRaw),
    proxyAuthorization: proxyAuth ? new SecretString(proxyAuth) : undefined,
    host: readEnv(ENV_LIGHTDASH_TOOLS_MCP_HTTP_HOST, env) ?? '0.0.0.0',
    port: readNumberEnv(
      env,
      ENV_LIGHTDASH_TOOLS_MCP_HTTP_PORT,
      [
        { name: ENV_MCP_HTTP_PORT, newName: ENV_LIGHTDASH_TOOLS_MCP_HTTP_PORT },
        { name: ENV_MCP_SERVER_PORT, newName: ENV_LIGHTDASH_TOOLS_MCP_HTTP_PORT },
      ],
      3100,
    ),
    publicUrl,
    mcpPath,
    authMode,
    sharedKey: sharedKeyRaw ? new SecretString(sharedKeyRaw) : undefined,
    allowedOrigins: parseCsv(allowedOriginsRaw),
    maxBodyBytes: readNumberEnv(
      env,
      ENV_LIGHTDASH_TOOLS_MCP_MAX_BODY_BYTES,
      [{ name: ENV_MCP_MAX_BODY_BYTES, newName: ENV_LIGHTDASH_TOOLS_MCP_MAX_BODY_BYTES }],
      1024 * 1024,
    ),
    sessionTtlMs: readNumberEnv(
      env,
      ENV_LIGHTDASH_TOOLS_MCP_SESSION_TTL_MS,
      [{ name: ENV_MCP_SESSION_TTL_MS, newName: ENV_LIGHTDASH_TOOLS_MCP_SESSION_TTL_MS }],
      30 * 60 * 1000,
    ),
    maxSessions: readNumberEnv(
      env,
      ENV_LIGHTDASH_TOOLS_MCP_MAX_SESSIONS,
      [{ name: ENV_MCP_MAX_SESSIONS, newName: ENV_LIGHTDASH_TOOLS_MCP_MAX_SESSIONS }],
      100,
    ),
    sessionCleanupMs: readNumberEnv(
      env,
      ENV_LIGHTDASH_TOOLS_MCP_SESSION_CLEANUP_MS,
      [{ name: ENV_MCP_SESSION_CLEANUP_MS, newName: ENV_LIGHTDASH_TOOLS_MCP_SESSION_CLEANUP_MS }],
      60_000,
    ),
    requiredScopes: readScopeList(env, ENV_LIGHTDASH_TOOLS_MCP_REQUIRED_SCOPES, []),
    scopesSupported: readScopeList(env, ENV_LIGHTDASH_TOOLS_MCP_SCOPES_SUPPORTED, [
      ...DEFAULT_SCOPES_SUPPORTED,
    ]),
    validateToken,
    tokenValidationCacheTtlMs: readNumberEnv(
      env,
      ENV_LIGHTDASH_TOOLS_MCP_TOKEN_VALIDATION_CACHE_TTL_MS,
      [],
      30_000,
    ),
    grantAllScopesWhenUnknown,
  };
}

export function requiresLightdashApiKey(authMode: McpAuthMode): boolean {
  return authMode === MCP_AUTH_MODE_NONE || authMode === MCP_AUTH_MODE_SHARED_KEY;
}
