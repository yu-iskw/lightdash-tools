/**
 * Registration-time safety asserts for organization-audit tools.
 */

import type { ToolAnnotations } from '@lightdash-tools/common';

export type OrganizationAuditSafetyInput = {
  shortName: string;
  annotations: ToolAnnotations;
  httpMethod: 'GET';
  executesWarehouseQuery?: boolean;
  mayExposeRowData?: boolean;
};

/** Throws when a tool violates organization-audit read-only metadata policy. */
export function assertOrganizationAuditToolSafe(input: OrganizationAuditSafetyInput): void {
  if (input.httpMethod !== 'GET') {
    throw new Error(`organization-audit forbids non-GET tool '${input.shortName}'`);
  }
  if (input.annotations.readOnlyHint !== true) {
    throw new Error(`organization-audit requires readOnlyHint for '${input.shortName}'`);
  }
  if (input.executesWarehouseQuery) {
    throw new Error(`organization-audit forbids warehouse query execution ('${input.shortName}')`);
  }
  if (input.mayExposeRowData) {
    throw new Error(`organization-audit forbids row-level data exposure ('${input.shortName}')`);
  }
}
