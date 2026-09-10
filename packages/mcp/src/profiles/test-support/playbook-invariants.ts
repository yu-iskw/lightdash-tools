/**
 * Shared playbook coverage checks for profile prompt tests.
 */

import { expect } from 'vitest';

import { getProfile, listToolIds, preloadProfiles } from '../index.js';

import type { ProfileId } from '../types.js';

export async function expectPlaybookCoversProfileTools(
  profileId: ProfileId,
  markdown: string,
): Promise<void> {
  await preloadProfiles([profileId]);
  for (const id of listToolIds(getProfile(profileId))) {
    expect(markdown.includes(id) || markdown.includes(`lightdash_${id}`)).toBe(true);
  }
  expect(markdown).not.toMatch(/\bldt__/);
}
