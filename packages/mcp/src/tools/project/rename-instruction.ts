/**
 * Rename instructions bound by content-developer preview tokens (ADR-0036).
 * The server rewrites chart references. This module only checks the instruction
 * before a token is minted or a rename is posted.
 */

import type { RenameImpactBaseline } from '../../policy/preview-ledger.js';
import type { components } from '@lightdash-tools/common';

export type RenameRejectCode =
  'RENAME_DRY_RUN' | 'RENAME_FIELD_PREFIX' | 'RENAME_TARGET' | 'RENAME_UNCHANGED';

export class RenameRejectedError extends Error {
  readonly code: RenameRejectCode;

  constructor(code: RenameRejectCode, message: string) {
    super(message);
    this.name = 'RenameRejectedError';
    this.code = code;
  }
}

export type RenameKind = 'field' | 'model';

export type ChartRenameInstruction = {
  scope: 'chart';
  chartUuid: string;
  type: RenameKind;
  from: string;
  to: string;
};

export type DashboardFilterRenameInstruction = {
  scope: 'dashboard-filter';
  dashboardUuid: string;
  type: RenameKind;
  from: string;
  to: string;
};

export type ProjectRenameInstruction = {
  scope: 'project';
  type: RenameKind;
  from: string;
  to: string;
  model: string | null;
};

export type RenameInstruction =
  ChartRenameInstruction | DashboardFilterRenameInstruction | ProjectRenameInstruction;

type RenameChangeList = components['schemas']['ApiRenameResponse']['results'];

/** Reject a no-op rename before a preview token is minted. */
export function assertRenameNamesDiffer(from: string, to: string): void {
  if (from === to) {
    throw new RenameRejectedError(
      'RENAME_UNCHANGED',
      'from and to are the same, so there is nothing to rename',
    );
  }
}

/**
 * The replacement must be an id the field dropdown returned.
 * Joined tables are included. The missing id (`from`) often is not.
 */
export function assertListedFieldId(
  fields: Readonly<Record<string, readonly string[]>>,
  to: string,
): void {
  const listed = Object.values(fields).some((ids) => ids.includes(to));
  if (!listed) {
    throw new RenameRejectedError(
      'RENAME_FIELD_PREFIX',
      'The new field id must be one returned by list_rename_fields',
    );
  }
}

/** Apply tools write. A dry run belongs on preview_rename. */
export function assertApplyIsNotDryRun(dryRun: boolean | undefined): void {
  if (dryRun === true) {
    throw new RenameRejectedError(
      'RENAME_DRY_RUN',
      'dryRun does not apply a rename. Call preview_rename.',
    );
  }
}

export function projectRenameResourceKey(
  instruction: Pick<ProjectRenameInstruction, 'from' | 'model' | 'to' | 'type'>,
): string {
  return `project:${instruction.type}:${instruction.model ?? ''}:${instruction.from}:${instruction.to}`;
}

export function projectRenameBody(
  instruction: ProjectRenameInstruction,
  dryRun?: boolean,
): components['schemas']['ApiRenameBody'] {
  return {
    type: instruction.type,
    from: instruction.from,
    to: instruction.to,
    ...(instruction.model == null ? {} : { model: instruction.model }),
    ...(dryRun === undefined ? {} : { dryRun }),
  };
}

function sortedUuids(items: readonly { uuid: string }[]): string[] {
  return items.map((item) => item.uuid).sort();
}

/** Stable uuid lists stored on the project rename baseline. */
export function renameImpactFromChanges(results: RenameChangeList): RenameImpactBaseline {
  return {
    alerts: sortedUuids(results.alerts),
    charts: sortedUuids(results.charts),
    dashboardSchedulers: sortedUuids(results.dashboardSchedulers),
    dashboards: sortedUuids(results.dashboards),
  };
}
