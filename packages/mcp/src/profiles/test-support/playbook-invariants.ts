/**
 * Shared playbook coverage checks for profile prompt tests.
 */

import { expect } from 'vitest';

import { getProfile, listToolIds } from '../index.js';

import type { ProfileId } from '../types.js';

export function expectPlaybookCoversProfileTools(profileId: ProfileId, markdown: string): void {
  for (const id of listToolIds(getProfile(profileId))) {
    expect(markdown.includes(id) || markdown.includes(`lightdash_${id}`)).toBe(true);
  }
  expect(markdown).not.toMatch(/\bldt__/);
}
