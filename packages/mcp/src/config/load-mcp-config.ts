import {
  ENV_LIGHTDASH_URL,
  ENV_LIGHTDASH_PROXY_AUTHORIZATION,
  SecretString,
} from '@lightdash-tools/client';

import {
  MCP_AUTH_MODE_LIGHTDASH_OAUTH,
  MCP_AUTH_MODE_NONE,
  MCP_AUTH_MODE_SHARED_KEY,
} from '../auth/auth-mode.js';
import { getDefaultProfile, listProfilePaths } from '../profiles/index.js';

import {
  parseEnabledProfiles,
  resolveRootMcpPath,
  type EnabledProfilesPolicy,
} from './enabled-profiles.js';
import {
  ENV_LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS,
  ENV_LIGHTDASH_TOOLS_MCP_HTTP_HOST,
  ENV_LIGHTDASH_TOOLS_MCP_HTTP_PORT,
  ENV_PLATFORM_PORT,
  ENV_LIGHTDASH_TOOLS_MCP_MAX_BODY_BYTES,
  ENV_LIGHTDASH_TOOLS_MCP_PATH,
  ENV_LIGHTDASH_TOOLS_MCP_PROFILES,
  ENV_LIGHTDASH_TOOLS_MCP_PROMPT_CONTEXT,
  ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL,
  ENV_LIGHTDASH_TOOLS_MCP_REQUIRED_SCOPES,
  ENV_LIGHTDASH_TOOLS_MCP_SCOPES_SUPPORTED,
  ENV_LIGHTDASH_TOOLS_MCP_SHARED_KEY,
  ENV_LIGHTDASH_TOOLS_MCP_TOKEN_VALIDATION_CACHE_TTL_MS,
  ENV_LIGHTDASH_TOOLS_MCP_VALIDATE_TOKEN,
  ENV_LIGHTDASH_TOOLS_OAUTH_CLIENT_ID,
  ENV_LIGHTDASH_TOOLS_OAUTH_CLIENT_SECRET,
  ENV_MCP_ALLOWED_ORIGINS,
  ENV_MCP_API_KEY,
  ENV_MCP_AUTH_ENABLED,
  ENV_MCP_HTTP_PORT,
  ENV_MCP_MAX_BODY_BYTES,
  ENV_MCP_PUBLIC_URL,
  ENV_MCP_SERVER_PORT,
  OAUTH_CALLBACK_PATH,
} from './env.js';
import { normalizeLightdashUrl, normalizePublicUrl, isLocalHttpOrigin } from './normalize-url.js';
import { assertObsoleteEnvRejected } from './obsolete-env.js';
import { parsePromptContextPolicy, type PromptContextPolicy } from './prompt-context-policy.js';
import { requirePublicUrl } from './public-url.js';
import { readEnv } from './read-env.js';

import type { McpAuthMode } from '../auth/auth-mode.js';

const DEFAULT_SCOPES_SUPPORTED = ['read', 'write', 'mcp:read', 'mcp:write'] as const;

const warnedAliases = new Set<string>();

function warnDeprecatedAlias(oldName: string, newName: string): void {
  if (warnedAliases.has(oldName)) return;
  warnedAliases.add(oldName);
  console.warn(`Warning: ${oldName} is deprecated. Use ${newName}.`);
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
  /** Silent fallback (e.g. Cloud Run `PORT`); read only when primary/aliases unset. */
  silentFallback?: string,
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
  if (silentFallback !== undefined) {
    const fallbackValue = readEnv(silentFallback, env);
    if (fallbackValue !== undefined) {
      return parsePositiveIntegerEnv(silentFallback, fallbackValue);
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

function inferAuthMode(params: {
  env: NodeJS.ProcessEnv;
  oauthClientId: string | undefined;
  oauthClientSecret: string | undefined;
  publicUrlRaw: string | undefined;
  sharedKeyRaw: string | undefined;
}): McpAuthMode {
  const { env, oauthClientId, oauthClientSecret, publicUrlRaw, sharedKeyRaw } = params;

  const hasOAuthId = Boolean(oauthClientId);
  const hasOAuthSecret = Boolean(oauthClientSecret);
  if (hasOAuthId !== hasOAuthSecret) {
    throw new Error(
      `Both ${ENV_LIGHTDASH_TOOLS_OAUTH_CLIENT_ID} and ${ENV_LIGHTDASH_TOOLS_OAUTH_CLIENT_SECRET} are required for hosted OAuth.`,
    );
  }

  if (hasOAuthId && hasOAuthSecret) {
    if (!publicUrlRaw) {
      throw new Error(
        `${ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL} is required when OAuth client credentials are set.`,
      );
    }
    return MCP_AUTH_MODE_LIGHTDASH_OAUTH;
  }

  if (sharedKeyRaw) {
    return MCP_AUTH_MODE_SHARED_KEY;
  }

  const legacyEnabled = readEnv(ENV_MCP_AUTH_ENABLED, env);
  if (legacyEnabled === '1' || legacyEnabled === 'true' || legacyEnabled === 'yes') {
    warnDeprecatedAlias(
      ENV_MCP_AUTH_ENABLED,
      `${ENV_LIGHTDASH_TOOLS_MCP_SHARED_KEY} (+ LIGHTDASH_API_KEY)`,
    );
    return MCP_AUTH_MODE_SHARED_KEY;
  }

  if (env.NODE_ENV === 'production') {
    throw new Error(
      `Unauthenticated MCP HTTP is not allowed in production. ` +
        `Set ${ENV_LIGHTDASH_TOOLS_OAUTH_CLIENT_ID}/${ENV_LIGHTDASH_TOOLS_OAUTH_CLIENT_SECRET}/` +
        `${ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL} for OAuth, or ${ENV_LIGHTDASH_TOOLS_MCP_SHARED_KEY} ` +
        `with LIGHTDASH_API_KEY for shared-key, or set NODE_ENV=development for local unauthenticated HTTP.`,
    );
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
  /** HTTP mount allowlist. Unrestricted when LIGHTDASH_TOOLS_MCP_PROFILES is unset. */
  enabledProfiles: EnabledProfilesPolicy;
  /** Progressive-disclosure prompt embedding policy (default compact). */
  promptContextPolicy: PromptContextPolicy;
  authMode: McpAuthMode;
  sharedKey?: SecretString;
  /** Server-held Lightdash OAuth application client id (broker mode). */
  oauthClientId?: string;
  /** Server-held Lightdash OAuth application client secret (broker mode). */
  oauthClientSecret?: SecretString;
  allowedOrigins: string[];
  maxBodyBytes: number;
  requiredScopes: string[];
  scopesSupported: string[];
  validateToken: boolean;
  tokenValidationCacheTtlMs: number;
}

function assertPublicUrlSecurity(authMode: McpAuthMode, publicUrl: string | undefined): void {
  if (authMode !== MCP_AUTH_MODE_LIGHTDASH_OAUTH || !publicUrl) return;

  if (publicUrl.startsWith('https://')) return;
  if (isLocalHttpOrigin(publicUrl)) return;

  throw new Error(
    `${ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL} must use https:// in OAuth mode (got ${publicUrl}). ` +
      `For local HTTP testing use http://localhost or http://127.0.0.1.`,
  );
}

function assertValidateTokenPolicy(
  authMode: McpAuthMode,
  validateToken: boolean,
  env: NodeJS.ProcessEnv,
): void {
  if (authMode !== MCP_AUTH_MODE_LIGHTDASH_OAUTH || validateToken) return;

  if (env.NODE_ENV !== 'development') {
    throw new Error(
      `${ENV_LIGHTDASH_TOOLS_MCP_VALIDATE_TOKEN}=false disables OAuth token validation and is not allowed in production. ` +
        `Unset it, or set NODE_ENV=development only when you accept the risk.`,
    );
  }
}

function assertLightdashOAuthScopePolicy(
  authMode: McpAuthMode,
  requiredScopes: string[],
  scopesSupportedEnvSet: boolean,
): void {
  if (authMode !== MCP_AUTH_MODE_LIGHTDASH_OAUTH) {
    return;
  }

  if (requiredScopes.length > 0) {
    throw new Error(
      `${ENV_LIGHTDASH_TOOLS_MCP_REQUIRED_SCOPES} cannot be set in OAuth broker mode. ` +
        `Leave it unset and rely on Lightdash RBAC plus the profile tool surface (ADR-0006).`,
    );
  }

  if (scopesSupportedEnvSet) {
    throw new Error(
      `${ENV_LIGHTDASH_TOOLS_MCP_SCOPES_SUPPORTED} cannot be set in OAuth broker mode. ` +
        `Leave scopes unset (metadata uses an empty scopes_supported list).`,
    );
  }
}

function emitLightdashOAuthSecurityWarnings(config: McpHttpConfig): void {
  if (config.authMode !== MCP_AUTH_MODE_LIGHTDASH_OAUTH) {
    return;
  }

  console.warn(
    'Note: hosted OAuth uses a server-held Lightdash confidential client (OAuth broker). ' +
      'Token validation confirms Lightdash user identity via GET /api/v1/user; ' +
      'opaque Lightdash tokens are not fully resource/audience-bound until upstream supports it. ' +
      `Register redirect URI ${getOAuthCallbackUrl(config)} in Lightdash.`,
  );

  if (!config.validateToken) {
    console.warn(
      `Warning: ${ENV_LIGHTDASH_TOOLS_MCP_VALIDATE_TOKEN}=false — MCP accepts any bearer token without calling Lightdash. ` +
        'Use only for local development.',
    );
  }

  emitNgrokFreeInterstitialWarning(config.publicUrl);
}

/** Free ngrok serves ERR_NGROK_6024 for browser-UA GETs; Cursor's post-callback rediscovery uses Mozilla UA. */
function emitNgrokFreeInterstitialWarning(publicUrl: string | undefined): void {
  if (!publicUrl) return;
  const host = new URL(publicUrl).hostname.toLowerCase();
  if (!host.endsWith('.ngrok-free.app') && !host.endsWith('.ngrok-free.dev')) {
    return;
  }
  console.warn(
    `Warning: ${ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL} is ngrok Free (${host}). ` +
      'Cursor re-fetches OAuth metadata with a browser UA and gets interstitial HTML instead of JSON. ' +
      'Use Cloudflare Tunnel (or paid ngrok) for local public HTTPS.',
  );
}

function emitCorsSecurityWarnings(config: McpHttpConfig): void {
  if (config.allowedOrigins.length > 0) {
    return;
  }

  console.warn(
    `Warning: ${ENV_LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS} is empty — profile MCP routes do not reflect browser Origins. ` +
      'OAuth broker/discovery routes still reflect Origin.',
  );
}

export function emitMcpHttpSecurityWarnings(config: McpHttpConfig): void {
  if (config.authMode === MCP_AUTH_MODE_NONE) {
    console.warn(
      'Warning: MCP HTTP endpoint is unauthenticated. Use OAuth client credentials or shared-key in production.',
    );
  }

  emitLightdashOAuthSecurityWarnings(config);
  emitCorsSecurityWarnings(config);
}

function readScopeList(env: NodeJS.ProcessEnv, primary: string, fallback: string[]): string[] {
  const parsed = parseCsv(readEnv(primary, env));
  return parsed.length > 0 ? parsed : fallback;
}

interface HttpAuthInputs {
  oauthClientId: string | undefined;
  oauthClientSecretRaw: string | undefined;
  publicUrlRaw: string | undefined;
  sharedKeyRaw: string | undefined;
  authMode: McpAuthMode;
}

function readHttpAuthInputs(env: NodeJS.ProcessEnv): HttpAuthInputs {
  const oauthClientId = readEnv(ENV_LIGHTDASH_TOOLS_OAUTH_CLIENT_ID, env);
  const oauthClientSecretRaw = readEnv(ENV_LIGHTDASH_TOOLS_OAUTH_CLIENT_SECRET, env);
  const publicUrlRaw = readStringEnv(env, ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL, [
    { name: ENV_MCP_PUBLIC_URL, newName: ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL },
  ]);
  const sharedKeyRaw = readStringEnv(env, ENV_LIGHTDASH_TOOLS_MCP_SHARED_KEY, [
    { name: ENV_MCP_API_KEY, newName: ENV_LIGHTDASH_TOOLS_MCP_SHARED_KEY },
  ]);

  const authMode = inferAuthMode({
    env,
    oauthClientId,
    oauthClientSecret: oauthClientSecretRaw,
    publicUrlRaw,
    sharedKeyRaw,
  });

  return {
    oauthClientId,
    oauthClientSecretRaw,
    publicUrlRaw,
    sharedKeyRaw,
    authMode,
  };
}

function resolveOAuthCredentials(
  authMode: McpAuthMode,
  oauthClientId: string | undefined,
  oauthClientSecretRaw: string | undefined,
): Pick<McpHttpConfig, 'oauthClientId' | 'oauthClientSecret'> {
  return {
    oauthClientId: authMode === MCP_AUTH_MODE_LIGHTDASH_OAUTH ? oauthClientId : undefined,
    oauthClientSecret:
      authMode === MCP_AUTH_MODE_LIGHTDASH_OAUTH && oauthClientSecretRaw
        ? new SecretString(oauthClientSecretRaw)
        : undefined,
  };
}

export function loadMcpHttpConfig(env: NodeJS.ProcessEnv = process.env): McpHttpConfig {
  const lightdashUrlRaw = readEnv(ENV_LIGHTDASH_URL, env);
  if (!lightdashUrlRaw) {
    throw new Error(`${ENV_LIGHTDASH_URL} is required.`);
  }

  if (readEnv(ENV_LIGHTDASH_TOOLS_MCP_PATH, env) !== undefined) {
    throw new Error(
      `${ENV_LIGHTDASH_TOOLS_MCP_PATH} is unused and rejected. ` +
        `The MCP endpoint path is profile-owned (${getDefaultProfile().path}); leave this variable unset.`,
    );
  }

  assertObsoleteEnvRejected(env);

  const { oauthClientId, oauthClientSecretRaw, publicUrlRaw, sharedKeyRaw, authMode } =
    readHttpAuthInputs(env);

  if (authMode === MCP_AUTH_MODE_SHARED_KEY && !sharedKeyRaw) {
    throw new Error(
      `${ENV_LIGHTDASH_TOOLS_MCP_SHARED_KEY} is required for shared-key HTTP auth ` +
        `(set it with LIGHTDASH_API_KEY for upstream Lightdash calls).`,
    );
  }

  const allowedOriginsRaw = readStringEnv(env, ENV_LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS, [
    { name: ENV_MCP_ALLOWED_ORIGINS, newName: ENV_LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS },
  ]);
  const allowedOrigins = parseCsv(allowedOriginsRaw);

  const proxyAuth = readEnv(ENV_LIGHTDASH_PROXY_AUTHORIZATION, env);

  const enabledProfiles = parseEnabledProfiles(readEnv(ENV_LIGHTDASH_TOOLS_MCP_PROFILES, env));
  const promptContextPolicy = parsePromptContextPolicy(
    readEnv(ENV_LIGHTDASH_TOOLS_MCP_PROMPT_CONTEXT, env),
  );
  const mcpPath = resolveRootMcpPath(enabledProfiles);
  const publicUrl = publicUrlRaw ? normalizePublicUrl(publicUrlRaw, listProfilePaths()) : undefined;
  assertPublicUrlSecurity(authMode, publicUrl);

  const validateToken = parseBooleanEnv(
    ENV_LIGHTDASH_TOOLS_MCP_VALIDATE_TOKEN,
    readEnv(ENV_LIGHTDASH_TOOLS_MCP_VALIDATE_TOKEN, env),
    authMode === MCP_AUTH_MODE_LIGHTDASH_OAUTH,
  );
  assertValidateTokenPolicy(authMode, validateToken, env);

  const requiredScopes = readScopeList(env, ENV_LIGHTDASH_TOOLS_MCP_REQUIRED_SCOPES, []);
  const scopesSupportedEnvSet =
    readEnv(ENV_LIGHTDASH_TOOLS_MCP_SCOPES_SUPPORTED, env) !== undefined;
  assertLightdashOAuthScopePolicy(authMode, requiredScopes, scopesSupportedEnvSet);

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
      ENV_PLATFORM_PORT,
    ),
    publicUrl,
    mcpPath,
    enabledProfiles,
    promptContextPolicy,
    authMode,
    sharedKey: sharedKeyRaw ? new SecretString(sharedKeyRaw) : undefined,
    ...resolveOAuthCredentials(authMode, oauthClientId, oauthClientSecretRaw),
    allowedOrigins,
    maxBodyBytes: readNumberEnv(
      env,
      ENV_LIGHTDASH_TOOLS_MCP_MAX_BODY_BYTES,
      [{ name: ENV_MCP_MAX_BODY_BYTES, newName: ENV_LIGHTDASH_TOOLS_MCP_MAX_BODY_BYTES }],
      1024 * 1024,
    ),
    requiredScopes,
    scopesSupported: readScopeList(
      env,
      ENV_LIGHTDASH_TOOLS_MCP_SCOPES_SUPPORTED,
      authMode === MCP_AUTH_MODE_LIGHTDASH_OAUTH ? [] : [...DEFAULT_SCOPES_SUPPORTED],
    ),
    validateToken,
    tokenValidationCacheTtlMs: readNumberEnv(
      env,
      ENV_LIGHTDASH_TOOLS_MCP_TOKEN_VALIDATION_CACHE_TTL_MS,
      [],
      10_000,
    ),
  };
}

export function requiresLightdashApiKey(authMode: McpAuthMode): boolean {
  return authMode === MCP_AUTH_MODE_NONE || authMode === MCP_AUTH_MODE_SHARED_KEY;
}

export function getOAuthCallbackUrl(config: McpHttpConfig): string {
  return `${requirePublicUrl(config, 'OAuth callback URL')}${OAUTH_CALLBACK_PATH}`;
}
