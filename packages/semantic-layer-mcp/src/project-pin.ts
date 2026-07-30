/**
 * Optional project pin (Lightdash-compatible `X-Lightdash-Project`).
 * @see https://docs.lightdash.com/references/integrations/lightdash-mcp
 */

import { AsyncLocalStorage } from 'node:async_hooks';

import { ENV_LIGHTDASH_TOOLS_PINNED_PROJECT, validateUuid } from '@lightdash-tools/common';

import type { IncomingMessage } from 'node:http';

const HEADER_LIGHTDASH_PROJECT = 'x-lightdash-project';

const projectPinAls = new AsyncLocalStorage<string | undefined>();

/** CLI `--pin-project` override; `undefined` wrapper means “use env”. */
let staticPinnedProject: { value: string | undefined } | undefined;

/**
 * Sets process pin from CLI (`--pin-project`). Invalid UUID → no pin (overrides env).
 * Mirrors `setStaticAllowedProjectUuids` for the allowlist.
 */
export function setStaticPinnedProjectUuid(uuid: string | undefined): void {
  staticPinnedProject = { value: uuid };
}

/** Clears CLI override so env pin applies (tests / process reset). */
export function clearStaticPinnedProjectUuid(): void {
  staticPinnedProject = undefined;
}

/**
 * Parses a project pin. Invalid UUIDs are ignored (official Lightdash MCP behavior).
 */
export function parsePinnedProjectUuid(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  try {
    return validateUuid(trimmed);
  } catch {
    return undefined;
  }
}

export function extractPinnedProjectFromRequest(req: IncomingMessage): string | undefined {
  // eslint-disable-next-line security/detect-object-injection -- fixed header name
  const header = req.headers[HEADER_LIGHTDASH_PROJECT];
  const raw = typeof header === 'string' ? header : Array.isArray(header) ? header[0] : undefined;
  return parsePinnedProjectUuid(raw);
}

function getProcessPinnedProjectUuid(): string | undefined {
  if (staticPinnedProject !== undefined) return staticPinnedProject.value;
  // eslint-disable-next-line security/detect-object-injection -- fixed env name constant
  return parsePinnedProjectUuid(process.env[ENV_LIGHTDASH_TOOLS_PINNED_PROJECT]);
}

/** Request-scoped pin (HTTP) wins over CLI/env process pin. */
export function getPinnedProjectUuid(): string | undefined {
  const fromRequest = projectPinAls.getStore();
  if (fromRequest !== undefined) return fromRequest;
  return getProcessPinnedProjectUuid();
}

export function runWithProjectPinAsync<T>(
  pinnedProjectUuid: string | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  return projectPinAls.run(pinnedProjectUuid, fn);
}
