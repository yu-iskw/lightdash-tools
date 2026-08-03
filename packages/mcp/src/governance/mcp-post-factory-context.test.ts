import { describe, expect, it } from 'vitest';

import {
  getMcpPostFactoryStore,
  runWithMcpPostFactoryAsync,
  runWithMcpPostFactorySync,
} from './mcp-post-factory-context.js';

import type { PersonaDefinition } from '../personas/types.js';
import type { McpContextProvider } from '../server/request-context.js';

function stubStore(id: string) {
  return {
    contextProvider: { getContext: async () => ({}) } as unknown as McpContextProvider,
    persona: { id } as PersonaDefinition,
  };
}

describe('mcp-post-factory-context ALS', () => {
  it('isolates overlapping async runs by persona id', async () => {
    const seen: string[] = [];

    await Promise.all([
      runWithMcpPostFactoryAsync(stubStore('a'), async () => {
        await new Promise((r) => setTimeout(r, 20));
        seen.push(getMcpPostFactoryStore()?.persona.id ?? 'missing');
      }),
      runWithMcpPostFactoryAsync(stubStore('b'), async () => {
        await new Promise((r) => setTimeout(r, 5));
        seen.push(getMcpPostFactoryStore()?.persona.id ?? 'missing');
      }),
    ]);

    expect(seen.sort()).toEqual(['a', 'b']);
  });

  it('exposes store inside sync factory callback', () => {
    const store = stubStore('sync');
    const got = runWithMcpPostFactorySync(store, () => getMcpPostFactoryStore()?.persona.id);
    expect(got).toBe('sync');
    expect(getMcpPostFactoryStore()).toBeUndefined();
  });
});
