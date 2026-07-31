/**
 * Persona safety invariant: all org-audit tools register as read-only GET.
 */

import { READ_ONLY_DEFAULT } from '@lightdash-tools/common';
import { describe, expect, it, vi } from 'vitest';

import { ORGANIZATION_AUDIT_TOOL_IDS } from '../../personas/organization-audit/v1/index.js';
import { registerToolsByIds } from '../registry.js';
import { TOOL_PREFIX } from '../shared.js';

describe('organization-audit safety invariants', () => {
  it('registers only readOnlyHint tools for the allowlist', () => {
    const annotationsByName = new Map<string, unknown>();
    const mockServer = {
      registerTool: vi.fn((name: string, options: { annotations?: unknown }) => {
        annotationsByName.set(name, options.annotations);
      }),
    };
    const mockCtx = { getContext: async () => ({ lightdashClient: {} }) };

    registerToolsByIds(mockServer as never, mockCtx as never, ORGANIZATION_AUDIT_TOOL_IDS);

    expect(annotationsByName.size).toBe(ORGANIZATION_AUDIT_TOOL_IDS.length);
    for (const id of ORGANIZATION_AUDIT_TOOL_IDS) {
      const annotations = annotationsByName.get(`${TOOL_PREFIX}${id}`) as {
        readOnlyHint?: boolean;
      };
      expect(annotations?.readOnlyHint).toBe(true);
      expect(annotations).toMatchObject(READ_ONLY_DEFAULT);
    }
  });
});
