import { SafetyMode } from '@lightdash-tools/common';

import {
  setStaticSafetyMode,
  setStaticAllowedProjectUuids,
  setDryRunMode,
} from './config/runtime.js';

import type { Command } from 'commander';

export function applyGuardrailOptions(options: {
  safetyMode?: string;
  projects?: string;
  dryRun?: boolean;
}): void {
  if (options.safetyMode) {
    if (Object.values(SafetyMode).includes(options.safetyMode as SafetyMode)) {
      setStaticSafetyMode(options.safetyMode as SafetyMode);
    } else {
      console.error(`Invalid safety mode: ${options.safetyMode}`);
      process.exit(1);
    }
  }

  if (options.projects) {
    const uuids = options.projects
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    setStaticAllowedProjectUuids(uuids);
  }

  if (options.dryRun) {
    setDryRunMode(true);
  }
}

/** Registers guardrail CLI flags on a Commander command (parent or subcommand). */
export function addGuardrailOptions(command: Command): Command {
  return command
    .option(
      '--safety-mode <mode>',
      'Filter registered tools by safety mode (read-only, write-idempotent, write-destructive)',
    )
    .option(
      '--projects <uuids>',
      'Comma-separated list of allowed project UUIDs (overrides LIGHTDASH_TOOLS_ALLOWED_PROJECTS; empty = all allowed)',
    )
    .option(
      '--dry-run',
      'Simulate write operations without executing them (overrides LIGHTDASH_TOOLS_DRY_RUN)',
    );
}

export function resolveGuardrailOptions(
  command: Command,
  subcommandOptions: Record<string, unknown> = {},
): { safetyMode?: string; projects?: string; dryRun?: boolean } {
  const parentOpts = command.parent?.opts() ?? {};
  return {
    safetyMode:
      (subcommandOptions.safetyMode as string | undefined) ??
      (parentOpts.safetyMode as string | undefined),
    projects:
      (subcommandOptions.projects as string | undefined) ??
      (parentOpts.projects as string | undefined),
    dryRun:
      (subcommandOptions.dryRun as boolean | undefined) ??
      (parentOpts.dryRun as boolean | undefined),
  };
}
