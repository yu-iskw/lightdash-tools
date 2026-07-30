/**
 * Server config: Lightdash client + optional project allowlist (stdio).
 */

import { LightdashClient, mergeConfig } from '@lightdash-tools/client';
import { getAllowedProjectUuidsFromEnv } from '@lightdash-tools/common';

let globalStaticAllowedProjectUuids: string[] | undefined;

export function getAllowedProjectUuids(): string[] {
  return globalStaticAllowedProjectUuids ?? getAllowedProjectUuidsFromEnv();
}

/** Sets allowed projects for this process (CLI `--projects` overrides env). */
export function setStaticAllowedProjectUuids(uuids: string[]): void {
  globalStaticAllowedProjectUuids = uuids;
}

/** Clears CLI override so env allowlist applies (tests / process reset). */
export function clearStaticAllowedProjectUuids(): void {
  globalStaticAllowedProjectUuids = undefined;
}

export function getClient(): LightdashClient {
  return new LightdashClient(mergeConfig(undefined));
}
