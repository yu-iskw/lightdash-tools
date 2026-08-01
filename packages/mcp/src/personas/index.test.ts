import { describe, expect, it, vi } from 'vitest';

import { registerToolsByIds } from '../tools/registry.js';
import { TOOL_PREFIX } from '../tools/shared.js';

import { CONTENT_READER_TOOL_IDS } from './content-reader/v1/index.js';
import { ORGANIZATION_AUDIT_TOOL_IDS } from './organization-audit/v1/index.js';

import {
  CONTENT_READER_PERSONA_PATH,
  DEFAULT_PERSONA_ID,
  getDefaultPersona,
  getPersona,
  getPersonaByPath,
  getPersonaServerName,
  listPersonaPaths,
  ORGANIZATION_AUDIT_PERSONA_PATH,
  parsePersonaId,
  PERSONAS,
  SEMANTIC_LAYER_PERSONA_PATH,
} from './index.js';

describe('personas', () => {
  it('ships semantic-layer, organization-audit, and content-reader with fixed paths', () => {
    expect(Object.keys(PERSONAS).sort()).toEqual([
      'content-reader',
      'organization-audit',
      'semantic-layer',
    ]);
    expect(DEFAULT_PERSONA_ID).toBe('semantic-layer');
    expect(listPersonaPaths().sort()).toEqual(
      [
        CONTENT_READER_PERSONA_PATH,
        ORGANIZATION_AUDIT_PERSONA_PATH,
        SEMANTIC_LAYER_PERSONA_PATH,
      ].sort(),
    );
    expect(getPersonaByPath(SEMANTIC_LAYER_PERSONA_PATH)?.id).toBe('semantic-layer');
    expect(getPersonaByPath(ORGANIZATION_AUDIT_PERSONA_PATH)?.id).toBe('organization-audit');
    expect(getPersonaByPath(CONTENT_READER_PERSONA_PATH)?.id).toBe('content-reader');
    expect(getPersonaByPath('/mcp')).toBeUndefined();
  });

  it('normalizes trailing slashes when resolving path', () => {
    expect(getPersonaByPath(`${SEMANTIC_LAYER_PERSONA_PATH}/`)?.id).toBe('semantic-layer');
    expect(getPersonaByPath(`${ORGANIZATION_AUDIT_PERSONA_PATH}/`)?.id).toBe('organization-audit');
    expect(getPersonaByPath(`${CONTENT_READER_PERSONA_PATH}/`)?.id).toBe('content-reader');
  });

  it('semantic-layer allowlists exactly nine tools', () => {
    const persona = getPersona('semantic-layer');
    expect(persona.toolIds).toHaveLength(9);
    expect(getDefaultPersona().toolIds).toEqual(persona.toolIds);
  });

  it('organization-audit allowlists 18 tools and short server name', () => {
    const persona = getPersona('organization-audit');
    expect(persona.toolIds).toHaveLength(18);
    expect(persona.toolIds).toEqual([...ORGANIZATION_AUDIT_TOOL_IDS]);
    expect(getPersonaServerName(persona)).toBe('lightdash-mcp-org-audit');
  });

  it('content-reader allowlists 13 tools and server name', () => {
    const persona = getPersona('content-reader');
    expect(persona.toolIds).toHaveLength(13);
    expect(persona.toolIds).toEqual([...CONTENT_READER_TOOL_IDS]);
    expect(getPersonaServerName(persona)).toBe('lightdash-mcp-content');
  });

  it('keeps combined server+tool wire names under 60 characters', () => {
    for (const persona of Object.values(PERSONAS)) {
      const serverName = getPersonaServerName(persona);
      for (const id of persona.toolIds) {
        const combined = serverName.length + (TOOL_PREFIX + id).length;
        expect(combined, `${serverName}+${TOOL_PREFIX}${id}`).toBeLessThanOrEqual(60);
      }
    }
  });

  it('parsePersonaId validates known ids only', () => {
    expect(parsePersonaId('semantic-layer')).toBe('semantic-layer');
    expect(parsePersonaId('organization-audit')).toBe('organization-audit');
    expect(parsePersonaId('content-reader')).toBe('content-reader');
    expect(parsePersonaId('nope')).toBeUndefined();
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
