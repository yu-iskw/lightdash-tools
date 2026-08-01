/**
 * Shipped MCP personas (path → definition). No PERSONA/PATH env knobs.
 */

import { normalizeMcpPath } from '../config/normalize-url.js';

import { contentReaderPersona } from './content-reader/v1/index.js';
import { organizationAuditPersona } from './organization-audit/v1/index.js';
import { semanticLayerPersona } from './semantic-layer/v1/index.js';

import type { PersonaDefinition, PersonaId } from './types.js';

export type { PersonaDefinition, PersonaId } from './types.js';
export { SEMANTIC_LAYER_PERSONA_PATH } from './semantic-layer/v1/index.js';
export { ORGANIZATION_AUDIT_PERSONA_PATH } from './organization-audit/v1/index.js';
export { CONTENT_READER_PERSONA_PATH } from './content-reader/v1/index.js';

/** Default stdio persona (backward compatible). */
export const DEFAULT_PERSONA_ID: PersonaId = 'semantic-layer';

export const PERSONAS: Record<PersonaId, PersonaDefinition> = {
  'semantic-layer': semanticLayerPersona,
  'organization-audit': organizationAuditPersona,
  'content-reader': contentReaderPersona,
};

const PERSONAS_BY_PATH = new Map<string, PersonaDefinition>(
  Object.values(PERSONAS).map((persona) => [persona.path, persona]),
);

export function getPersona(id: PersonaId): PersonaDefinition {
  // eslint-disable-next-line security/detect-object-injection -- PersonaId union
  return PERSONAS[id];
}

export function getDefaultPersona(): PersonaDefinition {
  return getPersona(DEFAULT_PERSONA_ID);
}

/** Resolve persona from an HTTP request path, or undefined if unknown. */
export function getPersonaByPath(path: string): PersonaDefinition | undefined {
  try {
    return PERSONAS_BY_PATH.get(normalizeMcpPath(path));
  } catch {
    return undefined;
  }
}

export function listPersonaPaths(): string[] {
  return [...PERSONAS_BY_PATH.keys()];
}

/** Parse a CLI persona id; returns undefined when invalid. */
export function parsePersonaId(value: string): PersonaId | undefined {
  if (value === 'semantic-layer' || value === 'organization-audit' || value === 'content-reader') {
    return value;
  }
  return undefined;
}

/** MCP server display name for a persona. */
export function getPersonaServerName(persona: PersonaDefinition): string {
  return persona.serverName ?? `lightdash-mcp-${persona.id}`;
}
