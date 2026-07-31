/**
 * MCP runtime config: Lightdash client + audit path.
 * Credentials: LIGHTDASH_URL, LIGHTDASH_API_KEY (stdio / shared-key).
 * Process safety mode / allowlist / dry-run are not used on MCP (persona-first; ADR-0006).
 */

import { LightdashClient, mergeConfig } from '@lightdash-tools/client';
import {
  ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECTS,
  ENV_LIGHTDASH_TOOLS_DRY_RUN,
  ENV_LIGHTDASH_TOOLS_SAFETY_MODE,
} from '@lightdash-tools/common';

import type { PartialLightdashClientConfig } from '@lightdash-tools/client';

/** CLI-only guardrail env vars that MCP deliberately ignores (ADR-0008). */
const CLI_ONLY_GUARDRAIL_ENV_VARS = [
  ENV_LIGHTDASH_TOOLS_SAFETY_MODE,
  ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECTS,
  ENV_LIGHTDASH_TOOLS_DRY_RUN,
] as const;

/**
 * Warn once when operators set CLI guardrail env vars on MCP.
 * Those vars do not scope MCP; persona toolIds + HTTP pin + RBAC do.
 */
export function warnIgnoredCliGuardrailEnvVars(
  env: NodeJS.ProcessEnv = process.env,
  warn: (message: string) => void = console.warn,
): void {
  const set: string[] = [];
  for (const name of CLI_ONLY_GUARDRAIL_ENV_VARS) {
    const value =
      name === ENV_LIGHTDASH_TOOLS_SAFETY_MODE
        ? env.LIGHTDASH_TOOLS_SAFETY_MODE
        : name === ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECTS
          ? env.LIGHTDASH_TOOLS_ALLOWED_PROJECTS
          : env.LIGHTDASH_TOOLS_DRY_RUN;
    if (value !== undefined && value !== '') {
      set.push(name);
    }
  }
  if (set.length === 0) {
    return;
  }
  warn(
    `Warning: ${set.join(', ')} ${set.length === 1 ? 'is' : 'are'} set but ignored by MCP. ` +
      'Those variables apply to the CLI only. MCP authorization is persona toolIds + auth/RBAC + optional X-Lightdash-Project (ADR-0008).',
  );
}

/** Undefined → audit log goes to stderr. */
export function getAuditLogPath(): string | undefined {
  return process.env.LIGHTDASH_TOOLS_AUDIT_LOG || undefined;
}

export function getClient(config?: PartialLightdashClientConfig): LightdashClient {
  const merged = mergeConfig(config);
  return new LightdashClient(merged);
}
