import {
  isAllowed,
  getSafetyModeFromEnv,
  SafetyMode,
  buildAuditLogEntry,
  logAuditEntry,
  areAllProjectsAllowed,
  getAllowedProjectUuidsFromEnv,
  extractProjectUuids,
  validateResourceId,
  validateResourceIdsInObject,
} from '@lightdash-tools/common';

import type { AuditStatus, ToolAnnotations } from '@lightdash-tools/common';
import type { Command } from 'commander';

/**
 * Resolves the safety mode from the command line options or environment variables.
 * CLI --safety-mode takes priority over LIGHTDASH_TOOLS_SAFETY_MODE.
 */
export function getSafetyMode(cmd: Command): SafetyMode {
  const options = cmd.optsWithGlobals() as { safetyMode?: string };
  if (options.safetyMode && Object.values(SafetyMode).includes(options.safetyMode as SafetyMode)) {
    return options.safetyMode as SafetyMode;
  }
  return getSafetyModeFromEnv();
}

/**
 * Resolves whether dry-run mode is active from CLI or environment.
 */
export function isDryRun(cmd: Command): boolean {
  let root = cmd;
  while (root.parent) {
    root = root.parent;
  }
  const options = root.opts() as { dryRun?: boolean };
  if (options.dryRun === true) return true;
  const v = process.env.LIGHTDASH_TOOLS_DRY_RUN;
  return v === '1' || v === 'true' || v === 'yes';
}

/**
 * Resolves the allowed project UUIDs from the command line options or environment variables.
 * We specifically want the root --projects flag as the security guardrail.
 * CLI --projects takes priority over LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS.
 */
export function getAllowedProjects(cmd: Command): string[] {
  let root = cmd;
  while (root.parent) {
    root = root.parent;
  }
  const options = root.opts() as { projects?: string };
  const raw = options.projects;
  if (raw) {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  try {
    return getAllowedProjectUuidsFromEnv();
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

/**
 * Enforces project allowlist for project UUIDs parsed from bundle/gate YAML.
 * wrapAction only inspects CLI args, so bundle.spec.projectUuid must be checked separately.
 */
export function assertAllowedProject(cmd: Command, projectUuid: string): void {
  validateResourceId(projectUuid);
  const allowedProjects = getAllowedProjects(cmd);
  if (allowedProjects.length > 0 && !areAllProjectsAllowed(allowedProjects, [projectUuid])) {
    console.error(
      `Error: Project [${projectUuid}] is not in the list of allowed projects. Allowed: [${allowedProjects.join(', ')}].`,
    );
    process.exit(1);
  }
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

function recordCliAudit(
  tool: string,
  status: AuditStatus,
  startMs: number,
  projectUuids: string[] | undefined,
): void {
  logAuditEntry(buildAuditLogEntry({ tool, status, startMs, projectUuids }));
}

/**
 * Wraps a CLI action with safety-mode enforcement and audit logging.
 */
export function wrapAction<T extends unknown[]>(
  annotations: ToolAnnotations,
  action: (...args: T) => Promise<void> | void,
): (this: Command, ...args: T) => Promise<void> {
  return async function (this: Command, ...args: T): Promise<void> {
    const start = Date.now();
    const commandPath = getCommandPath(this);
    const mode = getSafetyMode(this);
    const allowedProjects = getAllowedProjects(this);
    const targetProjects = [
      ...new Set([...extractProjectUuids(args), ...extractProjectUuids(this.opts())]),
    ];
    const projectUuids = targetProjects.length > 0 ? targetProjects : undefined;

    // ── Input Validation ─────────────────────────────────────────────────────
    // Validate only known identifier fields (RESOURCE_ID_KEYS) in objects.
    // Do NOT validate bare positional strings—they may be free-form (query, name, etc.).
    try {
      for (const arg of args as unknown[]) {
        validateResourceIdsInObject(arg);
      }
      validateResourceIdsInObject(this.opts());
    } catch (err) {
      recordCliAudit(commandPath, 'blocked', start, projectUuids);
      console.error(
        `Error: Invalid resource ID: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    }

    // ── Safety Mode Enforcement ──────────────────────────────────────────────
    if (!isAllowed(mode, annotations)) {
      recordCliAudit(commandPath, 'blocked', start, projectUuids);
      console.error(
        `Error: This command is disabled in ${mode} mode. To enable it, use --safety-mode or set LIGHTDASH_TOOLS_SAFETY_MODE.`,
      );
      process.exit(1);
    }

    // ── Dry-Run (Write Commands Only) ────────────────────────────────────────
    const isReadOnly = !!annotations.readOnlyHint;
    if (!isReadOnly && isDryRun(this)) {
      recordCliAudit(commandPath, 'blocked', start, projectUuids);
      console.log(
        `[DRY-RUN] Would execute: ${commandPath} with args: ${JSON.stringify(args)}. No changes were made.`,
      );
      return;
    }

    // ── Project Guardrail Enforcement ────────────────────────────────────────
    if (allowedProjects.length > 0) {
      const deniedProjects = targetProjects.filter(
        (p) => !areAllProjectsAllowed(allowedProjects, [p]),
      );
      if (deniedProjects.length > 0) {
        recordCliAudit(commandPath, 'blocked', start, projectUuids);
        console.error(
          `Error: Project(s) [${deniedProjects.join(', ')}] are not in the list of allowed projects. Allowed: [${allowedProjects.join(', ')}].`,
        );
        process.exit(1);
      }
    }

    try {
      const result = await action.apply(this, args);
      recordCliAudit(commandPath, 'success', start, projectUuids);
      return result;
    } catch (err) {
      recordCliAudit(commandPath, 'error', start, projectUuids);
      throw err;
    }
  };
}
