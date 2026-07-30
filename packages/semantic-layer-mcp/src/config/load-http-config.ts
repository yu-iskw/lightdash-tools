/**
 * HTTP config for semantic-layer MCP (lightdash-oauth or none+PAT).
 */

import {
  ENV_LIGHTDASH_API_KEY,
  ENV_LIGHTDASH_URL,
  ENV_LIGHTDASH_PROXY_AUTHORIZATION,
  SecretString,
} from '@lightdash-tools/client';

import {
  MCP_AUTH_MODE_LIGHTDASH_OAUTH,
  MCP_AUTH_MODE_NONE,
  MCP_HTTP_AUTH_MODES,
  type McpAuthMode,
} from '../auth/auth-mode.js';

import {
  isLocalHttpOrigin,
  normalizeLightdashUrl,
  normalizeMcpPath,
  normalizePublicUrl,
} from './normalize-url.js';

const ENV_PUBLIC_URL = 'LIGHTDASH_TOOLS_MCP_PUBLIC_URL';
const ENV_HTTP_HOST = 'LIGHTDASH_TOOLS_MCP_HTTP_HOST';
const ENV_HTTP_PORT = 'LIGHTDASH_TOOLS_MCP_HTTP_PORT';
const ENV_MCP_PATH = 'LIGHTDASH_TOOLS_MCP_PATH';
const ENV_AUTH_MODE = 'LIGHTDASH_TOOLS_MCP_AUTH_MODE';
const ENV_ALLOWED_ORIGINS = 'LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS';
const ENV_MAX_BODY = 'LIGHTDASH_TOOLS_MCP_MAX_BODY_BYTES';
const ENV_SESSION_TTL = 'LIGHTDASH_TOOLS_MCP_SESSION_TTL_MS';
const ENV_MAX_SESSIONS = 'LIGHTDASH_TOOLS_MCP_MAX_SESSIONS';
const ENV_MAX_SESSIONS_PER_SUBJECT = 'LIGHTDASH_TOOLS_MCP_MAX_SESSIONS_PER_SUBJECT';
const ENV_SESSION_CLEANUP = 'LIGHTDASH_TOOLS_MCP_SESSION_CLEANUP_MS';
const ENV_VALIDATE_TOKEN = 'LIGHTDASH_TOOLS_MCP_VALIDATE_TOKEN';
const ENV_SKIP_TOKEN_VALIDATION = 'LIGHTDASH_TOOLS_MCP_DANGEROUSLY_SKIP_TOKEN_VALIDATION';
const ENV_TOKEN_CACHE_TTL = 'LIGHTDASH_TOOLS_MCP_TOKEN_VALIDATION_CACHE_TTL_MS';
const ENV_EXPERIMENTAL_IDENTITY = 'LIGHTDASH_TOOLS_MCP_EXPERIMENTAL_IDENTITY_OAUTH';
const ENV_ALLOW_ANY_ORIGIN = 'LIGHTDASH_TOOLS_MCP_DANGEROUSLY_ALLOW_ANY_ORIGIN';
const ENV_ALLOW_INSECURE_PUBLIC_URL = 'LIGHTDASH_TOOLS_MCP_ALLOW_INSECURE_PUBLIC_URL';

export interface McpHttpConfig {
  lightdashUrl: string;
  proxyAuthorization?: SecretString;
  host: string;
  port: number;
  publicUrl?: string;
  mcpPath: string;
  authMode: McpAuthMode;
  allowedOrigins: string[];
  maxBodyBytes: number;
  sessionTtlMs: number;
  maxSessions: number;
  maxSessionsPerSubject: number;
  sessionCleanupMs: number;
  scopesSupported: string[];
  validateToken: boolean;
  tokenValidationCacheTtlMs: number;
  experimentalIdentityOAuth: boolean;
  dangerouslyAllowAnyOrigin: boolean;
}

function readEnv(name: string, env: NodeJS.ProcessEnv): string | undefined {
  // eslint-disable-next-line security/detect-object-injection -- fixed env names
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

function parseBooleanEnv(name: string, value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  if (value === '1' || value === 'true' || value === 'yes') return true;
  if (value === '0' || value === 'false' || value === 'no') return false;
  throw new Error(`Invalid ${name}: ${value}. Expected 1, true, yes, 0, false, or no.`);
}

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function readIntEnv(env: NodeJS.ProcessEnv, name: string, defaultValue: string): number {
  return parsePositiveIntegerEnv(name, readEnv(name, env) ?? defaultValue);
}

function resolveAuthMode(env: NodeJS.ProcessEnv): McpAuthMode {
  const authModeRaw = readEnv(ENV_AUTH_MODE, env) ?? MCP_AUTH_MODE_LIGHTDASH_OAUTH;
  if (!(MCP_HTTP_AUTH_MODES as readonly string[]).includes(authModeRaw)) {
    throw new Error(
      `${ENV_AUTH_MODE} must be ${MCP_HTTP_AUTH_MODES.join(' or ')} for @lightdash-tools/semantic-layer-mcp HTTP (got ${authModeRaw}).`,
    );
  }
  return authModeRaw as McpAuthMode;
}

function assertNoneRequiresPat(env: NodeJS.ProcessEnv, authMode: McpAuthMode): void {
  if (authMode !== MCP_AUTH_MODE_NONE) return;
  if (!readEnv(ENV_LIGHTDASH_API_KEY, env)) {
    throw new Error(
      `${ENV_LIGHTDASH_API_KEY} is required when ${ENV_AUTH_MODE}=${MCP_AUTH_MODE_NONE} (upstream Lightdash API uses ApiKey PAT).`,
    );
  }
  if (env.NODE_ENV === 'production') {
    throw new Error(
      `${ENV_AUTH_MODE}=${MCP_AUTH_MODE_NONE} is not allowed in production (unauthenticated MCP HTTP). Use ${MCP_AUTH_MODE_LIGHTDASH_OAUTH}.`,
    );
  }
}

function assertProductionIdentityOAuth(
  env: NodeJS.ProcessEnv,
  authMode: McpAuthMode,
  enabled: boolean,
): void {
  if (authMode !== MCP_AUTH_MODE_LIGHTDASH_OAUTH) return;
  if (env.NODE_ENV === 'production' && !enabled) {
    throw new Error(
      `Set ${ENV_EXPERIMENTAL_IDENTITY}=1 in production to acknowledge identity-only OAuth ` +
        `(no resource/audience binding). See docs/mcp-oauth-http.md.`,
    );
  }
}

function assertPublicUrlHttps(env: NodeJS.ProcessEnv, publicUrl: string | undefined): void {
  if (!publicUrl || publicUrl.startsWith('https://') || isLocalHttpOrigin(publicUrl)) {
    return;
  }
  const allowInsecure = parseBooleanEnv(
    ENV_ALLOW_INSECURE_PUBLIC_URL,
    readEnv(ENV_ALLOW_INSECURE_PUBLIC_URL, env),
    false,
  );
  if (!allowInsecure) {
    throw new Error(
      `${ENV_PUBLIC_URL} must use https:// (got ${publicUrl}). ` +
        `For local http://localhost only, or set ${ENV_ALLOW_INSECURE_PUBLIC_URL}=1.`,
    );
  }
}

function resolveValidateToken(env: NodeJS.ProcessEnv, authMode: McpAuthMode): boolean {
  if (authMode === MCP_AUTH_MODE_NONE) {
    return false;
  }
  const skipValidation = parseBooleanEnv(
    ENV_SKIP_TOKEN_VALIDATION,
    readEnv(ENV_SKIP_TOKEN_VALIDATION, env),
    false,
  );
  const validateToken = skipValidation
    ? false
    : parseBooleanEnv(ENV_VALIDATE_TOKEN, readEnv(ENV_VALIDATE_TOKEN, env), true);

  if (env.NODE_ENV === 'production' && !validateToken) {
    throw new Error('Token validation cannot be disabled in production');
  }
  return validateToken;
}

/**
 * Loads HTTP config.
 * - `lightdash-oauth`: Bearer on the MCP endpoint; OAuth client id/secret stay on the host.
 * - `none`: unauthenticated MCP endpoint; upstream Lightdash calls use LIGHTDASH_API_KEY (PAT).
 */
export function loadMcpHttpConfig(env: NodeJS.ProcessEnv = process.env): McpHttpConfig {
  const lightdashUrlRaw = readEnv(ENV_LIGHTDASH_URL, env);
  if (!lightdashUrlRaw) {
    throw new Error(`${ENV_LIGHTDASH_URL} is required for HTTP mode`);
  }

  const authMode = resolveAuthMode(env);
  assertNoneRequiresPat(env, authMode);

  const mcpPath = normalizeMcpPath(readEnv(ENV_MCP_PATH, env) ?? '/mcp');
  const publicUrlRaw = readEnv(ENV_PUBLIC_URL, env);
  const publicUrl = publicUrlRaw ? normalizePublicUrl(publicUrlRaw, mcpPath) : undefined;

  const experimentalIdentityOAuth = parseBooleanEnv(
    ENV_EXPERIMENTAL_IDENTITY,
    readEnv(ENV_EXPERIMENTAL_IDENTITY, env),
    false,
  );
  assertProductionIdentityOAuth(env, authMode, experimentalIdentityOAuth);
  assertPublicUrlHttps(env, publicUrl);

  const validateToken = resolveValidateToken(env, authMode);
  const portRaw = readEnv(ENV_HTTP_PORT, env) ?? readEnv('PORT', env) ?? '8080';
  const proxyAuth = readEnv(ENV_LIGHTDASH_PROXY_AUTHORIZATION, env);

  return {
    lightdashUrl: normalizeLightdashUrl(lightdashUrlRaw),
    proxyAuthorization: proxyAuth ? new SecretString(proxyAuth) : undefined,
    host: readEnv(ENV_HTTP_HOST, env) ?? '0.0.0.0',
    port: parsePositiveIntegerEnv(ENV_HTTP_PORT, portRaw),
    publicUrl,
    mcpPath,
    authMode,
    allowedOrigins: parseCsv(readEnv(ENV_ALLOWED_ORIGINS, env)),
    maxBodyBytes: readIntEnv(env, ENV_MAX_BODY, String(1024 * 1024)),
    sessionTtlMs: readIntEnv(env, ENV_SESSION_TTL, String(30 * 60 * 1000)),
    maxSessions: readIntEnv(env, ENV_MAX_SESSIONS, '100'),
    maxSessionsPerSubject: readIntEnv(env, ENV_MAX_SESSIONS_PER_SUBJECT, '10'),
    sessionCleanupMs: readIntEnv(env, ENV_SESSION_CLEANUP, String(60 * 1000)),
    scopesSupported: [],
    validateToken,
    tokenValidationCacheTtlMs: readIntEnv(env, ENV_TOKEN_CACHE_TTL, '10000'),
    experimentalIdentityOAuth,
    dangerouslyAllowAnyOrigin: parseBooleanEnv(
      ENV_ALLOW_ANY_ORIGIN,
      readEnv(ENV_ALLOW_ANY_ORIGIN, env),
      false,
    ),
  };
}

export function emitMcpHttpSecurityWarnings(config: McpHttpConfig): void {
  if (config.authMode === MCP_AUTH_MODE_NONE) {
    console.warn(
      `Warning: ${ENV_AUTH_MODE}=${MCP_AUTH_MODE_NONE} — MCP HTTP endpoint is unauthenticated. ` +
        `Upstream Lightdash API uses ${ENV_LIGHTDASH_API_KEY}. Use ${MCP_AUTH_MODE_LIGHTDASH_OAUTH} for hosted deployments.`,
    );
  } else {
    console.warn(
      `Warning: ${ENV_AUTH_MODE}=${MCP_AUTH_MODE_LIGHTDASH_OAUTH} is experimental identity-only OAuth. ` +
        'Tokens are not resource/audience-bound to this MCP server. OAuth client id/secret stay on the MCP host.',
    );
  }
  if (config.dangerouslyAllowAnyOrigin && config.allowedOrigins.length === 0) {
    console.warn(`Warning: CORS allows any Origin (${ENV_ALLOW_ANY_ORIGIN}=1).`);
  }
}
