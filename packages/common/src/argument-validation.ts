/**
 * Resource-identifier validation for CLI and MCP tools.
 * Validates known resource identifier keys when walking tool/command argument objects.
 */

import {
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
  'versionUuidA',
  'versionUuidB',
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
  'sourceChartUuidOrSlug',
  'contentUuidOrSlug',
  'tileUuid',
  'newSlug',
]);

/** Keys that accept OpenAPI UuidOrSlug (UUID or slug), not UUID-only. */
const UUID_OR_SLUG_KEYS = new Set([
  'dashboardUuid',
  'dashboardUuidOrSlug',
  'chartUuid',
  'chartUuidOrSlug',
  'sourceChartUuidOrSlug',
  'contentUuidOrSlug',
]);

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
