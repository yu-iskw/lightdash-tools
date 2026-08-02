/**
 * Shared parse-result helpers for content-developer payload Zod schemas.
 */

import type { z } from 'zod';

export type PayloadParseResult<T> =
  { ok: false; code: 'INVALID_ARGUMENT'; message: string } | { ok: true; data: T };

export function formatZodIssues(err: z.ZodError): string {
  return err.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      return `${path}: ${issue.message}`;
    })
    .join('; ');
}

export function rejectForbiddenKeys(
  input: unknown,
  forbidden: readonly string[],
): PayloadParseResult<never> | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      ok: false,
      code: 'INVALID_ARGUMENT',
      message: 'Payload must be a JSON object',
    };
  }
  const keys = Object.keys(input as Record<string, unknown>);
  const hit = keys.find((key) => forbidden.includes(key));
  if (hit != null) {
    return {
      ok: false,
      code: 'INVALID_ARGUMENT',
      message: `Payload rejects server-managed key '${hit}'`,
    };
  }
  return null;
}
