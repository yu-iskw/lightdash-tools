/**
 * Catalog invariant: every profile-mounted tool registers with annotations.readOnlyHint.
 */

import { describe, expect, it, vi } from 'vitest';

import { bindServerProfile } from '../audit/server-profile.js';
import { PROFILES, listToolIds } from '../profiles/index.js';
import { registerTools } from './registry.js';
import { TOOL_PREFIX } from './shared.js';

describe('required MCP tool annotations', () => {
  it.each(Object.values(PROFILES))(
    '$id tools register with a boolean annotations.readOnlyHint',
    (profile) => {
      const annotationsByName = new Map<string, { readOnlyHint?: boolean } | undefined>();
      const mockServer = {
        registerTool: vi.fn(
          (name: string, options: { annotations?: { readOnlyHint?: boolean } }) => {
            annotationsByName.set(name, options.annotations);
          },
        ),
        registerResource: vi.fn(),
      };
      const mockCtx = { getContext: async () => ({ lightdashClient: {} }) };

      bindServerProfile(mockServer, profile.id);
      registerTools(mockServer as never, mockCtx as never, profile.tools);

      const toolIds = listToolIds(profile);
      expect(annotationsByName.size).toBe(toolIds.length);

      const missingReadOnlyHint = toolIds.filter((id) => {
        const annotations = annotationsByName.get(`${TOOL_PREFIX}${id}`);
        return typeof annotations?.readOnlyHint !== 'boolean';
      });
      expect(missingReadOnlyHint).toEqual([]);
    },
  );
});
