/**
 * Hierarchical safety modes for Lightdash AI tools and CLI.
 */
export enum SafetyMode {
  READ_ONLY = 'read-only',
  WRITE_IDEMPOTENT = 'write-idempotent',
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

/** Preset: read-only, non-destructive, idempotent, closed-world. Use for list/get/compile tools. */
export const READ_ONLY_DEFAULT: ToolAnnotations = {
  readOnlyHint: true,
  openWorldHint: false,
  destructiveHint: false,
  idempotentHint: true,
};

/** Preset: write, non-destructive, idempotent (e.g. upsert by slug). Use for create/update tools. */
export const WRITE_IDEMPOTENT: ToolAnnotations = {
  readOnlyHint: false,
  openWorldHint: false,
  destructiveHint: false,
  idempotentHint: true,
};

/** Preset: write, destructive, non-idempotent. Use for delete/remove tools. */
export const WRITE_DESTRUCTIVE: ToolAnnotations = {
  readOnlyHint: false,
  openWorldHint: false,
  destructiveHint: true,
  idempotentHint: false,
};

/**
 * Validates if an operation is allowed in the current safety mode.
 */
export function isAllowed(mode: SafetyMode | string, annotations: ToolAnnotations): boolean {
  switch (mode) {
    case SafetyMode.READ_ONLY:
      return !!annotations.readOnlyHint;
    case SafetyMode.WRITE_IDEMPOTENT:
      return !!annotations.readOnlyHint || !annotations.destructiveHint;
    case SafetyMode.WRITE_DESTRUCTIVE:
      return true;
    default:
      return true; // Default to most permissive if mode is unknown
  }
}

/**
 * Resolves safety mode from environment variable.
 */
export function getSafetyModeFromEnv(): SafetyMode {
  const mode = process.env.LIGHTDASH_TOOL_SAFETY_MODE;
  if (Object.values(SafetyMode).includes(mode as SafetyMode)) {
    return mode as SafetyMode;
  }
  return SafetyMode.READ_ONLY;
}

/**
 * Parses allowed project UUIDs from the LIGHTDASH_TOOLS_ALLOWED_PROJECTS environment
 * variable (comma-separated). Returns an empty array when the variable is unset, meaning
 * all projects are allowed.
 *
 * Note: CLI/MCP flags (--allowed-projects) always take priority over this env var.
 */
export function getAllowedProjectUuidsFromEnv(): string[] {
  const raw = process.env.LIGHTDASH_TOOLS_ALLOWED_PROJECTS ?? '';
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
    const keys = ['project', 'projectUuid', 'projectUuids'];
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

  return [...new Set(uuids)].filter((u) => u.length > 0);
}
