/**
 * Soft warnings when agent spaceAccess UUIDs are not found in the project.
 */

export type AgentSpaceWarningCode = 'SPACE_LIST_UNAVAILABLE' | 'SPACES_NOT_IN_PROJECT';

export type AgentSpaceWarning = {
  code: AgentSpaceWarningCode;
  message: string;
};

export type ResolvedSpaceRef = {
  uuid: string;
  name: string;
};

export type ProjectSpacesClient = {
  listSpacesInProject: (projectUuid: string) => Promise<ResolvedSpaceRef[]>;
};

/** Non-empty spaceAccess only; null/empty skip (all project spaces). */
export function effectiveAgentSpaceAccess(spaceAccess: string[] | undefined): string[] | undefined {
  if (spaceAccess == null || spaceAccess.length === 0) {
    return undefined;
  }
  return spaceAccess;
}

export type SpaceAccessValidationResult =
  { error: Error } | { resolved: ResolvedSpaceRef[]; unknownUuids: string[] } | { skipped: true };

/** Validate spaceAccess UUIDs against the project space list. */
export async function fetchSpaceAccessValidation(
  client: ProjectSpacesClient,
  projectUuid: string,
  spaceAccess: string[] | undefined,
): Promise<SpaceAccessValidationResult> {
  const effective = effectiveAgentSpaceAccess(spaceAccess);
  if (effective === undefined) {
    return { skipped: true };
  }

  try {
    const spaces = await client.listSpacesInProject(projectUuid);
    const byUuid = new Map(spaces.map((space) => [space.uuid, space]));
    const resolved: ResolvedSpaceRef[] = [];
    const unknownUuids: string[] = [];
    for (const uuid of effective) {
      const space = byUuid.get(uuid);
      if (space === undefined) {
        unknownUuids.push(uuid);
      } else {
        resolved.push({ uuid: space.uuid, name: space.name });
      }
    }
    return { resolved, unknownUuids };
  } catch (err) {
    return { error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/** Human-readable space scope line for create confirmation / preview. */
export function formatSpaceAccessPreviewLine(
  spaceAccess: string[] | undefined,
  validation: SpaceAccessValidationResult,
): string {
  if ('skipped' in validation) {
    return 'Space access: (all project spaces)';
  }
  if ('error' in validation) {
    const count = effectiveAgentSpaceAccess(spaceAccess)?.length ?? 0;
    return `Space access: ${count} UUID(s) configured (names unavailable — space list call failed)`;
  }
  if (validation.unknownUuids.length > 0) {
    const known = formatResolvedSpaceRefs(validation.resolved);
    const unknown = validation.unknownUuids.join(', ');
    const effective = effectiveAgentSpaceAccess(spaceAccess);
    const count = effective?.length ?? validation.resolved.length + validation.unknownUuids.length;
    return known.length > 0
      ? `Space access: ${count} UUID(s) — known: ${known}; not in project: ${unknown}`
      : `Space access: ${count} UUID(s) not found in project: ${unknown}`;
  }
  return `Space access: ${validation.resolved.length} space(s): ${formatResolvedSpaceRefs(validation.resolved)}`;
}

function formatResolvedSpaceRefs(spaces: ResolvedSpaceRef[]): string {
  return spaces.map((s) => `${s.name} (${s.uuid})`).join(', ');
}

/** Derive soft warnings from a prior validation result (no upstream call). */
export function warningsFromSpaceAccessValidation(
  result: SpaceAccessValidationResult,
): AgentSpaceWarning[] {
  if ('skipped' in result) {
    return [];
  }
  if ('error' in result) {
    return [
      {
        code: 'SPACE_LIST_UNAVAILABLE',
        message: `Could not verify agent spaceAccess UUIDs: ${result.error.message}`,
      },
    ];
  }
  if (result.unknownUuids.length > 0) {
    const known = formatResolvedSpaceRefs(result.resolved);
    return [
      {
        code: 'SPACES_NOT_IN_PROJECT',
        message:
          `spaceAccess includes UUID(s) not found in this project: ${result.unknownUuids.join(', ')}.` +
          (known.length > 0 ? ` Known: ${known}.` : '') +
          ' Discover valid UUIDs via content-reader list_spaces — do not invent.',
      },
    ];
  }
  return [];
}

/**
 * After create/update with non-empty spaceAccess, warn when UUIDs are missing from the project.
 * Never fails the mutation.
 */
export async function warningsForAgentSpaceAccess(
  client: ProjectSpacesClient,
  projectUuid: string,
  spaceAccess: string[] | undefined,
): Promise<AgentSpaceWarning[]> {
  const result = await fetchSpaceAccessValidation(client, projectUuid, spaceAccess);
  return warningsFromSpaceAccessValidation(result);
}
