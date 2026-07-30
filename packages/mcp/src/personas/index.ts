/**
 * Shipped MCP personas (path → definition). No PERSONA/PATH env knobs.
 */

import { normalizeMcpPath } from '../config/normalize-url.js';

import { semanticLayerPersona } from './semantic-layer/index.js';

import type { PersonaDefinition, PersonaId } from './types.js';

export type { PersonaDefinition, PersonaId } from './types.js';
export { SEMANTIC_LAYER_PERSONA_PATH } from './semantic-layer/index.js';

/** Sole shipped persona until more are added under personas/. */
export const DEFAULT_PERSONA_ID: PersonaId = 'semantic-layer';

export const PERSONAS: Record<PersonaId, PersonaDefinition> = {
  'semantic-layer': semanticLayerPersona,
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
