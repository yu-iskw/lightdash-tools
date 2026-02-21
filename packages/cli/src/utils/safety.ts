import {
  isAllowed,
  getSafetyModeFromEnv,
  SafetyMode,
  logAuditEntry,
  getSessionId,
} from '@lightdash-tools/common';
import type { ToolAnnotations } from '@lightdash-tools/common';
import type { Command } from 'commander';

/**
 * Resolves the safety mode from the command line options or environment variables.
 * CLI --safety-mode takes priority over LIGHTDASH_TOOL_SAFETY_MODE.
 */
export function getSafetyMode(cmd: Command): SafetyMode {
  const options = cmd.optsWithGlobals() as { safetyMode?: string };
  if (options.safetyMode && Object.values(SafetyMode).includes(options.safetyMode as SafetyMode)) {
    return options.safetyMode as SafetyMode;
  }
  return getSafetyModeFromEnv();
}

/** Builds a human-readable command path (e.g. "lightdash-ai charts list"). */
function getCommandPath(cmd: Command): string {
  const parts: string[] = [];
  let current: Command | null = cmd;
  while (current) {
    const n = current.name();
    if (n) parts.unshift(n);
    current = current.parent;
  }
  return parts.join(' ');
}

/**
 * Wraps a CLI action with safety-mode enforcement and audit logging.
 */
export function wrapAction<T extends unknown[]>(
  annotations: ToolAnnotations,
  action: (...args: T) => Promise<void> | void,
) {
  return async function (this: Command, ...args: T) {
    const start = Date.now();
    const commandPath = getCommandPath(this);
    const mode = getSafetyMode(this);

    if (!isAllowed(mode, annotations)) {
      logAuditEntry({
        timestamp: new Date().toISOString(),
        sessionId: getSessionId(),
        tool: commandPath,
        status: 'blocked',
        durationMs: Date.now() - start,
      });
      console.error(
        `Error: This command is disabled in ${mode} mode. To enable it, use --safety-mode or set LIGHTDASH_TOOL_SAFETY_MODE.`,
      );
      process.exit(1);
    }

    try {
      const result = await action.apply(this, args);
      logAuditEntry({
        timestamp: new Date().toISOString(),
        sessionId: getSessionId(),
        tool: commandPath,
        status: 'success',
        durationMs: Date.now() - start,
      });
      return result;
    } catch (err) {
      logAuditEntry({
        timestamp: new Date().toISOString(),
        sessionId: getSessionId(),
        tool: commandPath,
        status: 'error',
        durationMs: Date.now() - start,
      });
      throw err;
    }
  };
}
