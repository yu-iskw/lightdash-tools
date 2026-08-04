import { PROFILE_IDS } from '@lightdash-tools/common';
import { describe, expect, it } from 'vitest';

import { formatProfilesHelp } from './cli-help.js';
import { getProfile, listToolIds } from './profiles/index.js';
import { TOOL_PREFIX } from './tools/shared.js';

describe('formatProfilesHelp', () => {
  it('lists every profile id, path, and mounted tool id in PROFILE_IDS order', () => {
    const text = formatProfilesHelp();

    expect(text).toContain(`wire name = ${TOOL_PREFIX}<id>`);

    for (const id of PROFILE_IDS) {
      const profile = getProfile(id);
      expect(text).toContain(id);
      expect(text).toContain(profile.path);
      for (const toolId of listToolIds(profile)) {
        expect(text).toContain(toolId);
      }
    }

    const firstId = PROFILE_IDS[0];
    const lastId = PROFILE_IDS[PROFILE_IDS.length - 1];
    expect(text.indexOf(firstId)).toBeLessThan(text.indexOf(lastId));
  });
});
