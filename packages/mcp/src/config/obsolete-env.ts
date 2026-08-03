/**
 * Reject obsolete MCP env vars fail-closed (shared by stdio + HTTP startup).
 */

import {
  ENV_LIGHTDASH_TOOLS_MCP_ALLOW_INSECURE_PUBLIC_URL,
  ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE,
  ENV_LIGHTDASH_TOOLS_MCP_DANGEROUSLY_ALLOW_ANY_ORIGIN,
  ENV_LIGHTDASH_TOOLS_MCP_DANGEROUSLY_ALLOW_UNAUTHENTICATED,
  ENV_LIGHTDASH_TOOLS_MCP_DANGEROUSLY_GRANT_ALL_SCOPES,
  ENV_LIGHTDASH_TOOLS_MCP_DANGEROUSLY_SKIP_TOKEN_VALIDATION,
  ENV_LIGHTDASH_TOOLS_MCP_EXPERIMENTAL_IDENTITY_OAUTH,
  ENV_LIGHTDASH_TOOLS_MCP_INSECURE_DEV,
  ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL,
  ENV_LIGHTDASH_TOOLS_MCP_REDIS_URL,
  ENV_LIGHTDASH_TOOLS_MCP_SHARED_KEY,
  ENV_LIGHTDASH_TOOLS_MCP_STORE,
  ENV_LIGHTDASH_TOOLS_OAUTH_CLIENT_ID,
  ENV_LIGHTDASH_TOOLS_OAUTH_CLIENT_SECRET,
} from './env.js';

const OBSOLETE_ENV_VARS = [
  ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE,
  ENV_LIGHTDASH_TOOLS_MCP_EXPERIMENTAL_IDENTITY_OAUTH,
  ENV_LIGHTDASH_TOOLS_MCP_DANGEROUSLY_ALLOW_ANY_ORIGIN,
  ENV_LIGHTDASH_TOOLS_MCP_DANGEROUSLY_ALLOW_UNAUTHENTICATED,
  ENV_LIGHTDASH_TOOLS_MCP_DANGEROUSLY_GRANT_ALL_SCOPES,
  ENV_LIGHTDASH_TOOLS_MCP_DANGEROUSLY_SKIP_TOKEN_VALIDATION,
  ENV_LIGHTDASH_TOOLS_MCP_ALLOW_INSECURE_PUBLIC_URL,
  ENV_LIGHTDASH_TOOLS_MCP_INSECURE_DEV,
  ENV_LIGHTDASH_TOOLS_MCP_STORE,
  ENV_LIGHTDASH_TOOLS_MCP_REDIS_URL,
] as const;

function readEnv(name: string, env: NodeJS.ProcessEnv): string | undefined {
  // eslint-disable-next-line security/detect-object-injection -- env var names are fixed constants
  const value = env[name];
  if (value === undefined || value === '') return undefined;
  return value;
}

/** Fail closed when operators still set removed MCP env vars. */
export function assertObsoleteEnvRejected(env: NodeJS.ProcessEnv = process.env): void {
  for (const name of OBSOLETE_ENV_VARS) {
    if (readEnv(name, env) !== undefined) {
      if (name === ENV_LIGHTDASH_TOOLS_MCP_STORE || name === ENV_LIGHTDASH_TOOLS_MCP_REDIS_URL) {
        throw new Error(
          `${name} is removed (ADR-0019). ` +
            `MCP HTTP is now stateless (sessionless) and has no Redis ephemeral store. ` +
            `Remove this variable from your environment.`,
        );
      }
      throw new Error(
        `${name} is removed. Auth is inferred from credentials: set ` +
          `${ENV_LIGHTDASH_TOOLS_OAUTH_CLIENT_ID}, ${ENV_LIGHTDASH_TOOLS_OAUTH_CLIENT_SECRET}, ` +
          `and ${ENV_LIGHTDASH_TOOLS_MCP_PUBLIC_URL} for hosted OAuth; ` +
          `or ${ENV_LIGHTDASH_TOOLS_MCP_SHARED_KEY} + LIGHTDASH_API_KEY for shared-key; ` +
          `or NODE_ENV=development for local unauthenticated HTTP. ` +
          `See docs/operators/mcp-oauth.md and ADR-0007.`,
      );
    }
  }
}
