/**
 * Profile safety invariant: all org-audit tools register as read-only GET.
 */

import { READ_ONLY_DEFAULT } from '@lightdash-tools/common';
import { describe, expect, it, vi } from 'vitest';

import { bindServerProfile } from '../../audit/server-profile.js';
import { getProfile, listToolIds } from '../../profiles/index.js';
import { registerTools } from '../registry.js';
import { TOOL_PREFIX } from '../shared.js';

describe('organization-audit safety invariants', () => {
  it('registers only readOnlyHint tools for profile-mounted tools', () => {
    const annotationsByName = new Map<string, unknown>();
    const mockServer = {
      registerTool: vi.fn((name: string, options: { annotations?: unknown }) => {
        annotationsByName.set(name, options.annotations);
      }),
    };
    const mockCtx = { getContext: async () => ({ lightdashClient: {} }) };
    const profile = getProfile('organization-audit');
    const toolIds = listToolIds(profile);

    bindServerProfile(mockServer, profile.id);
    registerTools(mockServer as never, mockCtx as never, profile.tools);

    expect(annotationsByName.size).toBe(toolIds.length);
    for (const id of toolIds) {
      const annotations = annotationsByName.get(`${TOOL_PREFIX}${id}`) as {
        readOnlyHint?: boolean;
      };
      expect(annotations?.readOnlyHint).toBe(true);
      expect(annotations).toMatchObject(READ_ONLY_DEFAULT);
    }
  });
});
