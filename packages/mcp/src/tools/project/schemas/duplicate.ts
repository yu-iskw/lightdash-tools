/**
 * Duplicate preview/apply proposed payloads (content-developer).
 * Must match the objects hashed by duplicate_chart / duplicate_dashboard.
 */

import { z } from 'zod';

import { formatZodIssues } from './parse-helpers.js';

import type { PayloadParseResult } from './parse-helpers.js';

export const chartDuplicateChangesSchema = z
  .object({
    sourceChartUuidOrSlug: z.string().min(1),
    newSlug: z.string().min(1),
    newName: z.string().min(1).optional(),
  })
  .strict();

export const dashboardDuplicateChangesSchema = z
  .object({
    newName: z.string().min(1).optional(),
  })
  .strict();

/** True when `changes` looks like a chart-duplicate proposal (not chart-as-code upsert). */
export function isChartDuplicateChanges(input: unknown): boolean {
  return (
    typeof input === 'object' &&
    input !== null &&
    !Array.isArray(input) &&
    'sourceChartUuidOrSlug' in input &&
    'newSlug' in input
  );
}

/** True when `changes` is only an optional newName (duplicate dashboard proposal). */
export function isDashboardDuplicateChanges(input: unknown): boolean {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return false;
  }
  return Object.keys(input as Record<string, unknown>).every((key) => key === 'newName');
}

/** Normalize so undefined optional fields are omitted (stable hash with apply). */
export function normalizeDuplicateChartProposed(input: {
  sourceChartUuidOrSlug: string;
  newSlug: string;
  newName?: string;
}): Record<string, unknown> {
  const proposed: Record<string, unknown> = {
    sourceChartUuidOrSlug: input.sourceChartUuidOrSlug,
    newSlug: input.newSlug,
  };
  if (input.newName !== undefined) {
    proposed.newName = input.newName;
  }
  return proposed;
}

/** Normalize dashboard duplicate proposed payload for preview/apply hash parity. */
export function normalizeDuplicateDashboardProposed(input: {
  newName?: string;
}): Record<string, unknown> {
  const proposed: Record<string, unknown> = {};
  if (input.newName !== undefined) {
    proposed.newName = input.newName;
  }
  return proposed;
}

export function parseChartDuplicateChanges(
  input: unknown,
): PayloadParseResult<Record<string, unknown>> {
  const parsed = chartDuplicateChangesSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: 'INVALID_ARGUMENT',
      message: `Invalid chart duplicate changes: ${formatZodIssues(parsed.error)}`,
    };
  }
  return {
    ok: true,
    data: normalizeDuplicateChartProposed(parsed.data),
  };
}

export function parseDashboardDuplicateChanges(
  input: unknown,
): PayloadParseResult<Record<string, unknown>> {
  const parsed = dashboardDuplicateChangesSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: 'INVALID_ARGUMENT',
      message: `Invalid dashboard duplicate changes: ${formatZodIssues(parsed.error)}`,
    };
  }
  return {
    ok: true,
    data: normalizeDuplicateDashboardProposed(parsed.data),
  };
}
