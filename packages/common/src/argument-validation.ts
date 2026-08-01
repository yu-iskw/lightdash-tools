/**
 * Descriptor-driven argument validation for CLI and MCP tools (RFC Phase 0).
 * Validates known resource identifier keys with semantic type rules.
 */

import {
  rejectControlChars,
  validateFingerprint,
  validateSlug,
  validateUuid,
  validateUuidOrSlug,
} from './input-validation';

/** Object keys whose string values are treated as resource identifiers. */
export const RESOURCE_ID_KEYS = new Set([
  'project',
  'projectUuid',
  'projectUuids',
  'projects',
  'agentUuid',
  'threadUuid',
  'messageUuid',
  'promptUuid',
  'evalUuid',
  'runUuid',
  'artifactUuid',
  'versionUuid',
  'mcpServerUuid',
  'toolCallId',
  'fingerprint',
  'savedQueryUuid',
  'slug',
  'userUuid',
  'groupUuid',
  'spaceUuid',
  'spaceUuids',
  'parentSpaceUuid',
  'targetSpaceUuid',
  'itemUuids',
  'roleUuid',
  'dashboardUuid',
  'dashboardUuidOrSlug',
  'sourceDashboardUuid',
  'schedulerUuid',
  'organizationUuid',
  'chartUuid',
  'chartUuidOrSlug',
  'tileUuid',
  'newSlug',
]);

/** Keys that accept OpenAPI UuidOrSlug (UUID or slug), not UUID-only. */
const UUID_OR_SLUG_KEYS = new Set([
  'dashboardUuid',
  'dashboardUuidOrSlug',
  'chartUuid',
  'chartUuidOrSlug',
]);

export type ArgumentSource = 'body' | 'option' | 'positional';

export type ArgumentSemanticType =
  'boolean' | 'fingerprint' | 'free-text' | 'json' | 'number' | 'slug' | 'uuid-or-slug' | 'uuid';

/** Per-argument validation metadata supplied by CLI/MCP command definitions. */
export interface ArgumentDescriptor {
  name: string;
  source: ArgumentSource;
  semanticType: ArgumentSemanticType;
  required?: boolean;
}

function isMissing(value: unknown): boolean {
  return value === undefined || value === null;
}

function requireString(value: unknown, name: string, label: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Argument '${name}' must be a string ${label}`);
  }
  return value;
}

function validateUuidArgument(value: unknown, name: string): void {
  validateUuid(requireString(value, name, 'UUID'));
}

function validateSlugArgument(value: unknown, name: string): void {
  validateSlug(requireString(value, name, 'slug'));
}

function validateFingerprintArgument(value: unknown, name: string): void {
  validateFingerprint(requireString(value, name, 'fingerprint'));
}

function validateFreeTextArgument(value: unknown, _name: string): void {
  if (typeof value === 'string') {
    rejectControlChars(value);
  }
}

function validateJsonArgument(value: unknown, name: string): void {
  if (typeof value !== 'string') {
    return;
  }
  rejectControlChars(value);
  try {
    JSON.parse(value);
  } catch {
    throw new Error(`Argument '${name}' must be valid JSON`);
  }
}

function validateBooleanArgument(value: unknown, name: string): void {
  if (typeof value !== 'boolean') {
    throw new Error(`Argument '${name}' must be a boolean`);
  }
}

function validateNumberArgument(value: unknown, name: string): void {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`Argument '${name}' must be a number`);
  }
}

function validateUuidOrSlugArgument(value: unknown, name: string): void {
  validateUuidOrSlug(requireString(value, name, 'UUID or slug'));
}

function validateBySemanticType(
  value: unknown,
  semanticType: ArgumentSemanticType,
  name: string,
): void {
  switch (semanticType) {
    case 'boolean':
      validateBooleanArgument(value, name);
      break;
    case 'fingerprint':
      validateFingerprintArgument(value, name);
      break;
    case 'free-text':
      validateFreeTextArgument(value, name);
      break;
    case 'json':
      validateJsonArgument(value, name);
      break;
    case 'number':
      validateNumberArgument(value, name);
      break;
    case 'slug':
      validateSlugArgument(value, name);
      break;
    case 'uuid':
      validateUuidArgument(value, name);
      break;
    case 'uuid-or-slug':
      validateUuidOrSlugArgument(value, name);
      break;
    default: {
      const exhaustive: never = semanticType;
      throw new Error(`Unknown semantic type: ${exhaustive}`);
    }
  }
}

function validateResourceIdValue(key: string, value: string): void {
  if (key === 'slug' || key === 'newSlug') {
    validateSlug(value);
    return;
  }
  if (key === 'fingerprint' || key === 'toolCallId') {
    validateFingerprint(value);
    return;
  }
  if (UUID_OR_SLUG_KEYS.has(key)) {
    validateUuidOrSlug(value);
    return;
  }
  validateUuid(value);
}

function validateResourceIdValues(key: string, value: unknown): void {
  if (typeof value === 'string') {
    validateResourceIdValue(key, value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item !== 'string') {
        throw new Error(`Argument '${key}' must be a string or string array`);
      }
      validateResourceIdValue(key, item);
    }
  }
}

/**
 * Validates tool arguments against explicit descriptors.
 * Identifier semantic types (`uuid`, `slug`, `fingerprint`) receive strict validation.
 */
export function validateArguments(
  args: Record<string, unknown>,
  descriptors: ArgumentDescriptor[],
): void {
  for (const descriptor of descriptors) {
    const value = args[descriptor.name];
    if (isMissing(value)) {
      if (descriptor.required) {
        throw new Error(`Required argument '${descriptor.name}' is missing`);
      }
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        validateBySemanticType(item, descriptor.semanticType, descriptor.name);
      }
    } else {
      validateBySemanticType(value, descriptor.semanticType, descriptor.name);
    }
  }
}

/**
 * Recursively walks an object (and nested arrays/objects) and validates any
 * string value under a key in {@link RESOURCE_ID_KEYS}.
 */
export function validateResourceIdsInObject(obj: unknown): void {
  if (obj === null || obj === undefined) {
    return;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      validateResourceIdsInObject(item);
    }
    return;
  }

  if (typeof obj !== 'object') {
    return;
  }

  const record = obj as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (RESOURCE_ID_KEYS.has(key)) {
      validateResourceIdValues(key, value);
    }
    validateResourceIdsInObject(value);
  }
}
