/**
 * Persona safety invariant: all content-reader tools register as read-only GET.
 */

import { READ_ONLY_DEFAULT } from '@lightdash-tools/common';
import { describe, expect, it, vi } from 'vitest';

import { CONTENT_READER_TOOL_IDS } from '../../personas/content-reader/v1/index.js';
import { registerToolsByIds } from '../registry.js';
import { TOOL_PREFIX } from '../shared.js';

const EXECUTION_TOOL_IDS = new Set([
  'run_chart',
  'run_dashboard_tile',
  'get_query_result',
  'cancel_query',
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

    registerToolsByIds(mockServer as never, mockCtx as never, CONTENT_READER_TOOL_IDS, {
      personaId: 'content-reader',
    });

    expect(CONTENT_READER_TOOL_IDS).toHaveLength(13);
    expect(annotationsByName.size).toBe(CONTENT_READER_TOOL_IDS.length);
    for (const id of CONTENT_READER_TOOL_IDS) {
      const annotations = annotationsByName.get(`${TOOL_PREFIX}${id}`) as {
        readOnlyHint?: boolean;
        idempotentHint?: boolean;
      };
      expect(annotations?.readOnlyHint).toBe(true);
      if (EXECUTION_TOOL_IDS.has(id)) {
        expect(annotations?.idempotentHint).toBe(false);
      } else {
        expect(annotations).toMatchObject(READ_ONLY_DEFAULT);
      }
    }
  });
});
