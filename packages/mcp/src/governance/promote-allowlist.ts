/**
 * Fail-closed allowlist check for dashboard promote targets (ADR-0008 / ADR-0017).
 *
 * Source projectUuid is already gated by registerToolSafe / resolveProjectScope.
 * Upstream comes from Data Ops config and nested PromotionChanges — validate those
 * when LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS is restricted.
 */

import { ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS } from '@lightdash-tools/common';

import { findUnavailableProjectUuids, getAvailableProjectsPolicy } from './available-projects.js';
import { ProjectScopeError } from './project-scope.js';

import type { DashboardPromoteDiffResults } from '@lightdash-tools/client';

function readProjectUuid(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') {
    return undefined;
  }
  const value = (data as { projectUuid?: unknown }).projectUuid;
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function collectFromRows(rows: { data: unknown }[] | undefined, into: Set<string>): void {
  for (const row of rows ?? []) {
    const uuid = readProjectUuid(row.data);
    if (uuid) {
      into.add(uuid.toLowerCase());
    }
  }
}

/** Unique project UUIDs found on PromotionChanges item payloads. */
export function extractPromoteDiffProjectUuids(diff: DashboardPromoteDiffResults): string[] {
  const uuids = new Set<string>();
  collectFromRows(diff.charts, uuids);
  collectFromRows(diff.dashboards, uuids);
  collectFromRows(diff.spaces, uuids);
  collectFromRows(diff.sqlCharts, uuids);
  // PromotedApp has no projectUuid in OpenAPI; walk defensively for future fields.
  collectFromRows(diff.dataApps, uuids);
  return [...uuids];
}

/**
 * When the shared allowlist is restricted, every known promotion target UUID must be a member.
 * Fail closed if no target UUID can be determined.
 */
export function assertPromoteTargetsAllowlisted(input: {
  upstreamProjectUuid?: string | null;
  promoteDiff: DashboardPromoteDiffResults;
}): void {
  const policy = getAvailableProjectsPolicy();
  if (!policy.restricted) {
    return;
  }

  const targets = new Set<string>();
  const upstream = input.upstreamProjectUuid?.trim();
  if (upstream) {
    targets.add(upstream.toLowerCase());
  }
  for (const uuid of extractPromoteDiffProjectUuids(input.promoteDiff)) {
    targets.add(uuid);
  }

  if (targets.size === 0) {
    throw new ProjectScopeError(
      'PROJECT_NOT_AVAILABLE',
      'Cannot determine upstream project for promotion',
    );
  }

  const unavailable = findUnavailableProjectUuids([...targets]);
  if (unavailable.length > 0) {
    throw new ProjectScopeError(
      'PROJECT_NOT_AVAILABLE',
      `projectUuid '${unavailable.join(', ')}' is not in ${ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS}`,
    );
  }
}
