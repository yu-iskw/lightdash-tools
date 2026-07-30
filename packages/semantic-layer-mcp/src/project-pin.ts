/**
 * Optional project pin (Lightdash-compatible `X-Lightdash-Project`).
 * HTTP request header only — not env/CLI.
 * @see https://docs.lightdash.com/references/integrations/lightdash-mcp
 */

import { AsyncLocalStorage } from 'node:async_hooks';

import { validateUuid } from '@lightdash-tools/common';

import type { IncomingMessage } from 'node:http';

const HEADER_LIGHTDASH_PROJECT = 'x-lightdash-project';

const projectPinAls = new AsyncLocalStorage<string | undefined>();

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

/** Request-scoped pin from `X-Lightdash-Project` (HTTP ALS). */
export function getPinnedProjectUuid(): string | undefined {
  return projectPinAls.getStore();
}

export function runWithProjectPinAsync<T>(
  pinnedProjectUuid: string | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  return projectPinAls.run(pinnedProjectUuid, fn);
}
