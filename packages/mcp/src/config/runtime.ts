/**
 * MCP runtime config: Lightdash client + audit path.
 * Credentials: LIGHTDASH_URL, LIGHTDASH_API_KEY (stdio / shared-key).
 * Project allowlist: LIGHTDASH_TOOLS_ALLOWED_PROJECTS (shared with CLI).
 * Process safety-mode / dry-run are CLI-only (ADR-0008).
 */

import { LightdashClient, mergeConfig } from '@lightdash-tools/client';
import {
  ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECTS,
  ENV_LIGHTDASH_TOOLS_DRY_RUN,
  ENV_LIGHTDASH_TOOLS_SAFETY_MODE,
} from '@lightdash-tools/common';

import { ENV_MCP_AVAILABLE_PROJECT_UUIDS_DEPRECATED } from '../governance/available-projects.js';

import type { PartialLightdashClientConfig } from '@lightdash-tools/client';

/** CLI-only guardrail env vars that MCP deliberately ignores (ADR-0008). */
const CLI_ONLY_GUARDRAIL_ENV_VARS = [
  ENV_LIGHTDASH_TOOLS_SAFETY_MODE,
  ENV_LIGHTDASH_TOOLS_DRY_RUN,
] as const;

/**
 * Warn when operators set CLI-only guardrails, removed project default, or deprecated allowlist alias.
 */
export function warnIgnoredCliGuardrailEnvVars(
  env: NodeJS.ProcessEnv = process.env,
  warn: (message: string) => void = console.warn,
): void {
  const ignored = CLI_ONLY_GUARDRAIL_ENV_VARS.filter((name) => {
    const value = env[name];
    return value !== undefined && value !== '';
  });
  if (ignored.length > 0) {
    warn(
      `Warning: ${ignored.join(', ')} ${ignored.length === 1 ? 'is' : 'are'} set but ignored by MCP. ` +
        'Those variables apply to the CLI only. MCP uses persona toolIds + auth/RBAC + optional ' +
        `${ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECTS} + optional X-Lightdash-Project (ADR-0008).`,
    );
  }

  const deprecatedAllowlist = env[ENV_MCP_AVAILABLE_PROJECT_UUIDS_DEPRECATED];
  if (deprecatedAllowlist !== undefined && deprecatedAllowlist.trim() !== '') {
    warn(
      `Warning: ${ENV_MCP_AVAILABLE_PROJECT_UUIDS_DEPRECATED} is deprecated. ` +
        `Use ${ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECTS} (shared with the CLI).`,
    );
  }

  const removedDefault = env.LIGHTDASH_TOOLS_PROJECT_UUID;
  if (removedDefault !== undefined && removedDefault.trim() !== '') {
    warn(
      'Warning: LIGHTDASH_TOOLS_PROJECT_UUID is no longer used by MCP. ' +
        'Pass projectUuid on tools or set X-Lightdash-Project. ' +
        `Optional ceiling: ${ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECTS}.`,
    );
  }
}

/** Undefined → audit log goes to stderr. */
export function getAuditLogPath(): string | undefined {
  return process.env.LIGHTDASH_TOOLS_AUDIT_LOG || undefined;
}

export function getClient(config?: PartialLightdashClientConfig): LightdashClient {
  const merged = mergeConfig(config);
  return new LightdashClient(merged);
}
