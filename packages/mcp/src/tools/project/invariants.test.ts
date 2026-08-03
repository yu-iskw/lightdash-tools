/**
 * Profile safety invariant: all content-reader tools register as read-only GET.
 */

import { READ_ONLY_DEFAULT, listMcpToolNamesByProfile } from '@lightdash-tools/common';
import { describe, expect, it, vi } from 'vitest';

import { bindServerProfile } from '../../audit/server-profile.js';
import { registerToolsByIds } from '../registry.js';
import { TOOL_PREFIX } from '../shared.js';

/** Tools that are read-only but not idempotent (warehouse / headless work). */
const NON_IDEMPOTENT_TOOL_IDS = new Set([
  'run_chart',
  'run_dashboard_tile',
  'get_query_result',
  'cancel_query',
  'export_chart_image',
]);

describe('content-reader safety invariants', () => {
  it('registers only readOnlyHint tools for the allowlist', () => {
    const annotationsByName = new Map<string, unknown>();
    const mockServer = {
      registerTool: vi.fn((name: string, options: { annotations?: unknown }) => {
        annotationsByName.set(name, options.annotations);
      }),
    };
    const mockCtx = { getContext: async () => ({ lightdashClient: {} }) };
    const toolIds = listMcpToolNamesByProfile('content-reader');

    bindServerProfile(mockServer, 'content-reader');
    registerToolsByIds(mockServer as never, mockCtx as never, toolIds);

    expect(toolIds).toHaveLength(14);
    expect(annotationsByName.size).toBe(toolIds.length);
    for (const id of toolIds) {
      const annotations = annotationsByName.get(`${TOOL_PREFIX}${id}`) as {
        readOnlyHint?: boolean;
        idempotentHint?: boolean;
      };
      expect(annotations?.readOnlyHint).toBe(true);
      if (NON_IDEMPOTENT_TOOL_IDS.has(id)) {
        expect(annotations?.idempotentHint).toBe(false);
      } else {
        expect(annotations).toMatchObject(READ_ONLY_DEFAULT);
      }
    }
  });
});
