import { describe, expect, it, vi } from 'vitest';

import { registerToolsByIds } from '../tools/registry.js';
import { TOOL_PREFIX } from '../tools/shared.js';

import {
  DEFAULT_PERSONA_ID,
  getDefaultPersona,
  getPersona,
  getPersonaByPath,
  listPersonaPaths,
  PERSONAS,
  SEMANTIC_LAYER_PERSONA_PATH,
} from './index.js';

describe('personas', () => {
  it('ships only semantic-layer with fixed path', () => {
    expect(Object.keys(PERSONAS)).toEqual(['semantic-layer']);
    expect(DEFAULT_PERSONA_ID).toBe('semantic-layer');
    expect(listPersonaPaths()).toEqual([SEMANTIC_LAYER_PERSONA_PATH]);
    expect(getPersonaByPath(SEMANTIC_LAYER_PERSONA_PATH)?.id).toBe('semantic-layer');
    expect(getPersonaByPath('/mcp')).toBeUndefined();
  });

  it('normalizes trailing slashes when resolving path', () => {
    expect(getPersonaByPath(`${SEMANTIC_LAYER_PERSONA_PATH}/`)?.id).toBe('semantic-layer');
  });

  it('semantic-layer allowlists exactly nine tools', () => {
    const persona = getPersona('semantic-layer');
    expect(persona.toolIds).toHaveLength(9);
    expect(getDefaultPersona().toolIds).toEqual(persona.toolIds);
  });

  it('registerToolsByIds registers only allowlisted ids', () => {
    const registered: string[] = [];
    const mockServer = {
      registerTool: vi.fn((name: string) => {
        registered.push(name);
      }),
    };
    const mockCtx = { getContext: async () => ({ lightdashClient: {} }) };

    registerToolsByIds(mockServer as never, mockCtx as never, ['list_projects', 'compile_query']);

    expect(registered).toEqual([`${TOOL_PREFIX}list_projects`, `${TOOL_PREFIX}compile_query`]);
  });
});
