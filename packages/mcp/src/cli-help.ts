/**
 * Offline Commander help inventory from profile mounts (ADR-0022).
 * Loaded only when help text is rendered (see bin.ts) so Cloud Run `http` boot stays light.
 */

import { PROFILE_IDS } from '@lightdash-tools/common';

import { getProfile, isProfileLoaded } from './profiles/index.js';
import { loadProfileModuleSync } from './profiles/profile-modules.js';
import { TOOL_PREFIX } from './tools/shared.js';

import type { ProfileDefinition, ProfileId } from './profiles/types.js';

function profileForHelp(id: ProfileId): ProfileDefinition {
  if (isProfileLoaded(id)) {
    return getProfile(id);
  }
  // CLI help under dist/bin (CJS): sync require. Vitest suites should preload first.
  return loadProfileModuleSync(id);
}

/** Profile id → path → short tool ids for `stdio --help` / `http --help`. */
export function formatProfilesHelp(): string {
  const lines: string[] = [
    '',
    `Profiles (id, HTTP path, tools as short ids; wire name = ${TOOL_PREFIX}<id>):`,
  ];

  for (const id of PROFILE_IDS) {
    const profile = profileForHelp(id);
    lines.push(`  ${id}  ${profile.path}`);
    lines.push(`    ${profile.tools.map((tool) => tool.id).join(', ')}`);
  }

  lines.push('');
  return lines.join('\n');
}
