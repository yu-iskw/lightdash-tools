import { extractProjectUuidsFromToolArgs } from './agentops/extract-yaml-project';
import { ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS, ENV_LIGHTDASH_TOOLS_SAFETY_MODE } from './env';

/** Removed allowlist env — fail closed if still set. */
const ENV_ALLOWED_PROJECTS_REMOVED = 'LIGHTDASH_TOOLS_ALLOWED_PROJECTS';

/**
 * Semantic impact classification for operations (RFC Phase 0).
 * Used by {@link OperationPolicy} and {@link isOperationAllowed}.
 */
export type SafetyImpact =
  | 'credential-sensitive'
  | 'external-side-effect'
  | 'read'
  | 'write-destructive'
  | 'write-nondestructive';

/**
 * Hierarchical safety modes for Lightdash AI tools and CLI.
 */
export enum SafetyMode {
  READ_ONLY = 'read-only',
  /** Deprecated alias — prefer {@link SafetyMode.WRITE_NONDESTRUCTIVE}. */
  WRITE_IDEMPOTENT = 'write-idempotent',
  WRITE_NONDESTRUCTIVE = 'write-nondestructive',
  WRITE_DESTRUCTIVE = 'write-destructive',
}

/**
 * MCP tool annotations (hints for client display and approval).
 * See MCP spec Tool annotations.
 */
export type ToolAnnotations = {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
};

/** Policy describing the semantic impact of an operation. */
export type OperationPolicy = {
  impact: SafetyImpact;
};

/** Preset: read-only, non-destructive, idempotent, closed-world. Use for list/get/compile tools. */
export const READ_ONLY_DEFAULT: ToolAnnotations = {
  readOnlyHint: true,
  openWorldHint: false,
  destructiveHint: false,
  idempotentHint: true,
};

/**
 * Preset: read-only but non-idempotent (transient warehouse execution).
 * Used by content-reader saved-chart/tile runs (ADR-0012).
 */
export const READ_ONLY_TRANSIENT: ToolAnnotations = {
  readOnlyHint: true,
  openWorldHint: false,
  destructiveHint: false,
  idempotentHint: false,
};

/**
 * Legacy preset: write, non-destructive, idempotent (e.g. upsert by slug).
 * Prefer {@link WRITE_NONDESTRUCTIVE} for new tools; idempotent behavior is not implied by safety mode.
 */
export const WRITE_IDEMPOTENT: ToolAnnotations = {
  readOnlyHint: false,
  openWorldHint: false,
  destructiveHint: false,
  idempotentHint: true,
};

/** Preset: write, non-destructive, closed-world. Use for create/update tools without idempotency guarantee. */
export const WRITE_NONDESTRUCTIVE: ToolAnnotations = {
  readOnlyHint: false,
  openWorldHint: false,
  destructiveHint: false,
  idempotentHint: false,
};

/** Preset: write, non-destructive, open-world. Use for LLM generation and similar external interactions. */
export const WRITE_OPEN_WORLD: ToolAnnotations = {
  readOnlyHint: false,
  openWorldHint: true,
  destructiveHint: false,
  idempotentHint: false,
};

/** Preset: write, destructive, non-idempotent. Use for delete/remove tools. */
export const WRITE_DESTRUCTIVE: ToolAnnotations = {
  readOnlyHint: false,
  openWorldHint: false,
  destructiveHint: true,
  idempotentHint: false,
};

/**
 * Validates if an operation is allowed in the current safety mode using MCP tool annotations.
 * Unknown modes default to permissive for backward compatibility.
 */
export function isAllowed(mode: SafetyMode | string, annotations: ToolAnnotations): boolean {
  switch (mode) {
    case SafetyMode.READ_ONLY:
      return !!annotations.readOnlyHint;
    case SafetyMode.WRITE_NONDESTRUCTIVE:
    case SafetyMode.WRITE_IDEMPOTENT:
      return !!annotations.readOnlyHint || !annotations.destructiveHint;
    case SafetyMode.WRITE_DESTRUCTIVE:
      return true;
    default:
      return true;
  }
}

/**
 * Validates if an operation is allowed in the current safety mode using semantic impact policy.
 * Unknown modes fail closed.
 */
export function isOperationAllowed(mode: SafetyMode | string, policy: OperationPolicy): boolean {
  switch (mode) {
    case SafetyMode.READ_ONLY:
      return policy.impact === 'read';
    case SafetyMode.WRITE_NONDESTRUCTIVE:
    case SafetyMode.WRITE_IDEMPOTENT:
      return (
        policy.impact === 'read' ||
        policy.impact === 'write-nondestructive' ||
        policy.impact === 'external-side-effect'
      );
    case SafetyMode.WRITE_DESTRUCTIVE:
      return true;
    default:
      return false;
  }
}

/**
 * Resolves safety mode from environment variable.
 * Accepts `write-idempotent` as a deprecated alias for `write-nondestructive`.
 */
export function getSafetyModeFromEnv(): SafetyMode {
  const mode = process.env[ENV_LIGHTDASH_TOOLS_SAFETY_MODE];
  if (mode === SafetyMode.WRITE_IDEMPOTENT) {
    return SafetyMode.WRITE_NONDESTRUCTIVE;
  }
  if (Object.values(SafetyMode).includes(mode as SafetyMode)) {
    return mode as SafetyMode;
  }
  return SafetyMode.READ_ONLY;
}

/**
 * Parses allowed project UUIDs from the LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS environment
 * variable (comma-separated). Returns an empty array when the variable is unset, meaning
 * all projects are allowed.
 *
 * Throws if the removed name LIGHTDASH_TOOLS_ALLOWED_PROJECTS is still set.
 * Note: CLI `--projects` takes priority over this env var.
 */
export function getAllowedProjectUuidsFromEnv(): string[] {
  const legacy = process.env.LIGHTDASH_TOOLS_ALLOWED_PROJECTS;
  if (legacy !== undefined && legacy.trim() !== '') {
    throw new Error(
      `${ENV_ALLOWED_PROJECTS_REMOVED} is no longer supported. ` +
        `Use ${ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS} instead.`,
    );
  }
  const raw = process.env.LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS ?? '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Returns true if a single projectUuid is permitted by the allowlist.
 * An empty allowlist means all projects are allowed.
 */
export function isProjectAllowed(allowedUuids: readonly string[], projectUuid: string): boolean {
  if (allowedUuids.length === 0) return true;
  return allowedUuids.includes(projectUuid);
}

/**
 * Returns true when every UUID in projectUuids is permitted by the allowlist.
 * An empty allowlist means all projects are allowed.
 * An empty projectUuids array is trivially allowed.
 */
export function areAllProjectsAllowed(
  allowedUuids: readonly string[],
  projectUuids: readonly string[],
): boolean {
  if (allowedUuids.length === 0) return true;
  return projectUuids.every((uuid) => allowedUuids.includes(uuid));
}

/**
 * Extracts all project UUIDs from tool or command arguments.
 * Handles both MCP-style objects and CLI-style argument arrays.
 */
export function extractProjectUuids(args: unknown): string[] {
  if (args === null || args === undefined) return [];
  const uuids: string[] = [];

  if (Array.isArray(args)) {
    // CLI: positional arguments + options object
    for (const arg of args) {
      if (typeof arg === 'string' && /^[0-9a-f-]{36}$/i.test(arg)) {
        // Looks like a UUID positional arg
        uuids.push(arg);
      } else if (typeof arg === 'object' && arg !== null) {
        // Looks like options object or nested args
        const a = arg as Record<string, unknown>;
        // Check various naming conventions used across CLI and MCP
        const keys = ['projects', 'project', 'projectUuid', 'projectUuids'];
        for (const key of keys) {
          const val = a[key];
          if (typeof val === 'string') {
            uuids.push(val);
          } else if (Array.isArray(val)) {
            for (const item of val) {
              if (typeof item === 'string') uuids.push(item);
            }
          }
        }
      }
    }
  } else if (typeof args === 'object') {
    // MCP or single options object
    const a = args as Record<string, unknown>;
    const keys = ['projects', 'project', 'projectUuid', 'projectUuids'];
    for (const key of keys) {
      const val = a[key];
      if (typeof val === 'string') {
        uuids.push(val);
      } else if (Array.isArray(val)) {
        for (const item of val) {
          if (typeof item === 'string') uuids.push(item);
        }
      }
    }
  }

  uuids.push(...extractProjectUuidsFromToolArgs(args));

  return [...new Set(uuids)].filter((u) => u.length > 0);
}
