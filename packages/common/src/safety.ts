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
  const mode = process.env.LIGHTDASH_AI_MODE;
  if (Object.values(SafetyMode).includes(mode as SafetyMode)) {
    return mode as SafetyMode;
  }
  return SafetyMode.WRITE_DESTRUCTIVE;
}
