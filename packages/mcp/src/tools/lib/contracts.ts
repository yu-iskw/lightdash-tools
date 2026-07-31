/**
 * Shared audit contracts for organization-audit MCP tools.
 */

export type ApiResolution = {
  capability: string;
  selectedVersion: 'v1' | 'v2';
  method: 'GET';
  pathTemplate: string;
  reason: 'compatibility_override' | 'v2_incomplete' | 'v2_preferred' | 'v2_unavailable';
};

export type AuditWarningCode =
  | 'INCOMPLETE_EFFECTIVE_ACCESS'
  | 'INCONSISTENT_REFERENCE'
  | 'PARTIAL_VISIBILITY'
  | 'REDACTED'
  | 'TRUNCATED'
  | 'UNSUPPORTED_CAPABILITY'
  | 'V1_FALLBACK';

export type AuditWarning = {
  code: AuditWarningCode;
  message: string;
  resourceUuid?: string;
};

export type AuditCoverage = {
  observedAt: string;
  organizationUuid: string;
  projectUuids?: string[];
  projectPin?: string;
  apiResolutions: ApiResolution[];
  inaccessibleScopes: Array<{
    scopeType: 'organization' | 'project' | 'resource' | 'space';
    scopeUuid?: string;
    reason: 'forbidden' | 'not_found' | 'unknown' | 'unsupported';
  }>;
  unsupportedCapabilities: string[];
  /** Defaults false — callers must set true only when retrieval is known complete. */
  complete: boolean;
};

export function emptyCoverage(organizationUuid: string, projectPin?: string): AuditCoverage {
  return {
    observedAt: new Date().toISOString(),
    organizationUuid,
    projectPin,
    apiResolutions: [],
    inaccessibleScopes: [],
    unsupportedCapabilities: [],
    complete: false,
  };
}

/** Whether a single Knex-style page is the last page. */
export function isPageComplete(
  returned: number,
  totalResults?: number,
  totalPageCount?: number,
  page?: number,
): boolean {
  if (typeof totalResults === 'number') {
    return (
      returned >= totalResults ||
      (typeof page === 'number' && page >= (totalPageCount ?? Number.POSITIVE_INFINITY))
    );
  }
  if (typeof totalPageCount === 'number' && typeof page === 'number') {
    return page >= totalPageCount;
  }
  // Unknown totals: single response without pagination metadata is treated incomplete.
  return false;
}
