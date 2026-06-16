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
  ENV_LIGHTDASH_TOOLS_MCP_DANGEROUSLY_ALLOW_ANY_ORIGIN,
  ENV_LIGHTDASH_TOOLS_MCP_DANGEROUSLY_ALLOW_UNAUTHENTICATED,
  ENV_LIGHTDASH_TOOLS_MCP_DANGEROUSLY_GRANT_ALL_SCOPES,
  ENV_LIGHTDASH_TOOLS_MCP_DANGEROUSLY_SKIP_TOKEN_VALIDATION,
  ENV_LIGHTDASH_TOOLS_MCP_EXPERIMENTAL_IDENTITY_OAUTH,
  ENV_LIGHTDASH_TOOLS_MCP_HTTP_HOST,
  ENV_LIGHTDASH_TOOLS_MCP_HTTP_PORT,
  ENV_LIGHTDASH_TOOLS_MCP_MAX_BODY_BYTES,
  ENV_LIGHTDASH_TOOLS_MCP_MAX_SESSIONS,
  ENV_LIGHTDASH_TOOLS_MCP_MAX_SESSIONS_PER_SUBJECT,
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
  maxSessionsPerSubject: number;
  sessionCleanupMs: number;
  requiredScopes: string[];
  scopesSupported: string[];
  validateToken: boolean;
  tokenValidationCacheTtlMs: number;
  grantAllScopesWhenUnknown: boolean;
  /** Explicit operator opt-in for identity-only OAuth (no resource/audience binding). */
  experimentalIdentityOAuth: boolean;
  /** Reflect any browser Origin when CORS allowlist is empty (not for production OAuth). */
  dangerouslyAllowAnyOrigin: boolean;
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

function assertExperimentalIdentityOAuthPolicy(
  authMode: McpAuthMode,
  experimentalIdentityOAuth: boolean,
  env: NodeJS.ProcessEnv,
): void {
  if (authMode !== MCP_AUTH_MODE_LIGHTDASH_OAUTH || env.NODE_ENV !== 'production') {
    return;
  }

  if (experimentalIdentityOAuth) {
    return;
  }

  throw new Error(
    `${ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE}=${MCP_AUTH_MODE_LIGHTDASH_OAUTH} is experimental identity-only OAuth in v1. ` +
      `It validates Lightdash user identity via GET /api/v1/user but cannot prove the token was issued for this MCP resource (no resource/audience binding). ` +
      `For production hosted MCP without those limitations, use ${MCP_AUTH_MODE_SHARED_KEY}. ` +
      `To accept the risk, set ${ENV_LIGHTDASH_TOOLS_MCP_EXPERIMENTAL_IDENTITY_OAUTH}=1 after reading docs/mcp-oauth-http.md.`,
  );
}

function assertAllowedOriginsPolicy(
  authMode: McpAuthMode,
  allowedOrigins: string[],
  dangerouslyAllowAnyOrigin: boolean,
  env: NodeJS.ProcessEnv,
): void {
  if (authMode !== MCP_AUTH_MODE_LIGHTDASH_OAUTH || env.NODE_ENV !== 'production') {
    return;
  }

  if (allowedOrigins.length > 0 || dangerouslyAllowAnyOrigin) {
    return;
  }

  throw new Error(
    `${ENV_LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS} is required in production ${MCP_AUTH_MODE_LIGHTDASH_OAUTH} mode. ` +
      `Set an explicit CORS origin allowlist for browser-facing deployments, or set ${ENV_LIGHTDASH_TOOLS_MCP_DANGEROUSLY_ALLOW_ANY_ORIGIN}=1 ` +
      `only when you accept reflecting any browser Origin.`,
  );
}

function assertLightdashOAuthScopePolicy(authMode: McpAuthMode, requiredScopes: string[]): void {
  if (authMode !== MCP_AUTH_MODE_LIGHTDASH_OAUTH || requiredScopes.length === 0) {
    return;
  }

  throw new Error(
    `${ENV_LIGHTDASH_TOOLS_MCP_REQUIRED_SCOPES} cannot be set when auth mode is ${MCP_AUTH_MODE_LIGHTDASH_OAUTH}. ` +
      `Lightdash OAuth access credentials are opaque, so MCP cannot verify JWT scope claims from Lightdash. ` +
      `Leave ${ENV_LIGHTDASH_TOOLS_MCP_REQUIRED_SCOPES} unset and rely on Lightdash RBAC plus LIGHTDASH_TOOLS_SAFETY_MODE.`,
  );
}

function defaultScopesSupported(authMode: McpAuthMode): string[] {
  return authMode === MCP_AUTH_MODE_LIGHTDASH_OAUTH ? [] : [...DEFAULT_SCOPES_SUPPORTED];
}

/** Loud warnings for operator misconfiguration. Call once at HTTP server startup. */
export function emitMcpHttpSecurityWarnings(config: McpHttpConfig): void {
  if (config.authMode === MCP_AUTH_MODE_NONE) {
    console.warn(
      'Warning: LIGHTDASH_TOOLS_MCP_AUTH_MODE=none — MCP HTTP endpoint is unauthenticated. Use lightdash-oauth or shared-key in production.',
    );
  }

  if (config.authMode === MCP_AUTH_MODE_LIGHTDASH_OAUTH) {
    console.warn(
      'Warning: LIGHTDASH_TOOLS_MCP_AUTH_MODE=lightdash-oauth is experimental identity-only OAuth. ' +
        'Token validation confirms Lightdash user identity via GET /api/v1/user only; it does not prove the token was issued for this MCP resource. ' +
        'Lightdash exposes /.well-known/oauth-authorization-server for OAuth discovery; the gap is resource/audience-bound token validation, not metadata. ' +
        'Authorization is Lightdash RBAC plus process-level safety mode / project allowlists, not MCP-local scopes or audience binding.',
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

  if (config.authMode === MCP_AUTH_MODE_LIGHTDASH_OAUTH && config.scopesSupported.length > 0) {
    console.warn(
      `Warning: ${ENV_LIGHTDASH_TOOLS_MCP_SCOPES_SUPPORTED} advertises OAuth scopes, but Lightdash OAuth credentials are opaque. ` +
        'MCP-local scope enforcement applies only when access tokens carry decodable JWT scope claims.',
    );
  }

  if (config.allowedOrigins.length === 0) {
    const corsWarning =
      config.authMode === MCP_AUTH_MODE_LIGHTDASH_OAUTH
        ? `Warning: ${ENV_LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS} is empty — CORS reflects any browser Origin. ` +
          'Set an explicit allowlist for browser-facing OAuth deployments; production requires an allowlist or ' +
          `${ENV_LIGHTDASH_TOOLS_MCP_DANGEROUSLY_ALLOW_ANY_ORIGIN}=1.`
        : `Warning: ${ENV_LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS} is empty — CORS reflects any browser Origin. ` +
          'Set an explicit allowlist for browser-facing deployments.';
    console.warn(corsWarning);
  }

  if (config.authMode === MCP_AUTH_MODE_LIGHTDASH_OAUTH && config.maxSessionsPerSubject > 0) {
    console.warn(
      `Note: in-memory sessions are capped at ${config.maxSessions} global and ${config.maxSessionsPerSubject} per OAuth subject. ` +
        'Use gateway-level rate limits and short session TTLs for multi-tenant production deployments.',
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

  const experimentalIdentityOAuth = parseBooleanEnv(
    ENV_LIGHTDASH_TOOLS_MCP_EXPERIMENTAL_IDENTITY_OAUTH,
    readEnv(ENV_LIGHTDASH_TOOLS_MCP_EXPERIMENTAL_IDENTITY_OAUTH, env),
    false,
  );
  assertExperimentalIdentityOAuthPolicy(authMode, experimentalIdentityOAuth, env);

  const dangerouslyAllowAnyOrigin = parseBooleanEnv(
    ENV_LIGHTDASH_TOOLS_MCP_DANGEROUSLY_ALLOW_ANY_ORIGIN,
    readEnv(ENV_LIGHTDASH_TOOLS_MCP_DANGEROUSLY_ALLOW_ANY_ORIGIN, env),
    false,
  );
  assertAllowedOriginsPolicy(authMode, parseCsv(allowedOriginsRaw), dangerouslyAllowAnyOrigin, env);

  const requiredScopes = readScopeList(env, ENV_LIGHTDASH_TOOLS_MCP_REQUIRED_SCOPES, []);
  assertLightdashOAuthScopePolicy(authMode, requiredScopes);

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
    maxSessionsPerSubject: readNumberEnv(
      env,
      ENV_LIGHTDASH_TOOLS_MCP_MAX_SESSIONS_PER_SUBJECT,
      [],
      10,
    ),
    sessionCleanupMs: readNumberEnv(
      env,
      ENV_LIGHTDASH_TOOLS_MCP_SESSION_CLEANUP_MS,
      [{ name: ENV_MCP_SESSION_CLEANUP_MS, newName: ENV_LIGHTDASH_TOOLS_MCP_SESSION_CLEANUP_MS }],
      60_000,
    ),
    requiredScopes,
    scopesSupported: readScopeList(
      env,
      ENV_LIGHTDASH_TOOLS_MCP_SCOPES_SUPPORTED,
      defaultScopesSupported(authMode),
    ),
    validateToken,
    tokenValidationCacheTtlMs: readNumberEnv(
      env,
      ENV_LIGHTDASH_TOOLS_MCP_TOKEN_VALIDATION_CACHE_TTL_MS,
      [],
      10_000,
    ),
    grantAllScopesWhenUnknown,
    experimentalIdentityOAuth,
    dangerouslyAllowAnyOrigin,
  };
}

export function requiresLightdashApiKey(authMode: McpAuthMode): boolean {
  return authMode === MCP_AUTH_MODE_NONE || authMode === MCP_AUTH_MODE_SHARED_KEY;
}
