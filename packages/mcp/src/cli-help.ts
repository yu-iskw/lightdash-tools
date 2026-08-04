/**
 * Offline Commander help inventory from profile mounts (ADR-0022).
 */

import { PROFILE_IDS } from '@lightdash-tools/common';

import { getProfile, listToolIds } from './profiles/index.js';
import { TOOL_PREFIX } from './tools/shared.js';

/** Profile id → path → short tool ids for `stdio --help` / `http --help`. */
export function formatProfilesHelp(): string {
  const lines: string[] = [
    '',
    `Profiles (id, HTTP path, tools as short ids; wire name = ${TOOL_PREFIX}<id>):`,
  ];

  for (const id of PROFILE_IDS) {
    const profile = getProfile(id);
    lines.push(`  ${id}  ${profile.path}`);
    lines.push(`    ${listToolIds(profile).join(', ')}`);
  }

  lines.push('');
  return lines.join('\n');
}
