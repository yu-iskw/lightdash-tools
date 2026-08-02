/**
 * Precondition digests for stale-target detection (ADR-0015).
 */

import { hashStableValue } from '../tools/lib/stable-stringify.js';

import type { DestructiveResourceType, ResourcePrecondition } from './types.js';

export function hashPreconditionMaterial(material: unknown): string {
  return hashStableValue(material);
}

export function buildContentPrecondition(input: {
  resourceType: DestructiveResourceType;
  resourceId: string;
  projectUuid: string;
  name: string;
  updatedAt: string;
  spaceUuid?: string;
}): ResourcePrecondition {
  return {
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    projectUuid: input.projectUuid,
    digest: hashPreconditionMaterial({
      name: input.name,
      updatedAt: input.updatedAt,
      spaceUuid: input.spaceUuid ?? null,
    }),
  };
}

export function samePrecondition(a: ResourcePrecondition, b: ResourcePrecondition): boolean {
  return (
    a.resourceType === b.resourceType &&
    a.resourceId === b.resourceId &&
    a.projectUuid === b.projectUuid &&
    a.digest === b.digest
  );
}
