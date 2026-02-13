import { isAllowed, getSafetyModeFromEnv, SafetyMode } from '@lightdash-tools/common';
import type { ToolAnnotations } from '@lightdash-tools/common';
import type { Command } from 'commander';

/**
 * Resolves the safety mode from the command line options or environment variables.
 */
export function getSafetyMode(cmd: Command): SafetyMode {
  const options = cmd.optsWithGlobals() as { mode?: string };
  if (options.mode && Object.values(SafetyMode).includes(options.mode as SafetyMode)) {
    return options.mode as SafetyMode;
  }
  return getSafetyModeFromEnv();
}

/**
 * Wraps a CLI action with a safety check.
 */
export function wrapAction<T extends unknown[]>(
  annotations: ToolAnnotations,
  action: (...args: T) => Promise<void> | void,
) {
  return async function (this: Command, ...args: T) {
    const mode = getSafetyMode(this);
    if (!isAllowed(mode, annotations)) {
      console.error(
        `Error: This command is disabled in ${mode} mode. To enable it, use --mode or set LIGHTDASH_AI_MODE.`,
      );
      process.exit(1);
    }
    return action.apply(this, args);
  };
}
