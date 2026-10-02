/**
 * Rename instructions bound by content-developer preview tokens (ADR-0036).
 * The server rewrites chart references. This module only checks the instruction
 * before a token is minted or a rename is posted.
 */

import { RenameRejectedError } from '../../policy/rename-rejected.js';

import type { RenameImpactBaseline } from '../../policy/preview-ledger.js';
import type { components } from '@lightdash-tools/common';

export { RenameRejectedError };

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

const RENAME_NAME = /^[a-z0-9_]+$/;

/**
 * Upstream chart rename compiles `from` into a regular expression.
 * Names stay on the identifier alphabet the CLI already allows, plus digits.
 */
export function assertRenameToken(value: string, label: string): void {
  if (!RENAME_NAME.test(value)) {
    throw new RenameRejectedError(
      'RENAME_TARGET',
      `${label} must contain only lowercase letters, digits, and underscores`,
    );
  }
}

/** Reject a no-op rename before a preview token is minted. */
export function assertRenameNamesDiffer(from: string, to: string): void {
  assertRenameToken(from, 'from');
  assertRenameToken(to, 'to');
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
      'RENAME_FIELD_UNLISTED',
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

/**
 * `POST /rename/preview` with a model treats `from` and `to` as full field ids.
 * `POST /rename` looks the field up by short name on that explore's base table.
 * The job body is the short name. The preview body keeps the full id.
 */
export function projectFieldShortName(model: string, fieldId: string): string {
  const prefix = `${model}_`;
  if (!fieldId.startsWith(prefix) || fieldId.length === prefix.length) {
    throw new RenameRejectedError(
      'RENAME_TARGET',
      `A project field id must start with "${prefix}"`,
    );
  }
  const shortName = fieldId.slice(prefix.length);
  assertRenameToken(shortName, 'field name');
  return shortName;
}

export function projectRenameJobBody(
  instruction: ProjectRenameInstruction,
): components['schemas']['ApiRenameBody'] {
  if (instruction.type === 'model') {
    return {
      type: instruction.type,
      from: instruction.from,
      to: instruction.to,
      ...(instruction.model == null ? {} : { model: instruction.model }),
    };
  }
  if (instruction.type === 'field') {
    if (instruction.model == null) {
      throw new RenameRejectedError(
        'RENAME_TARGET',
        'A project field rename needs model set to the explore name, plus full field ids',
      );
    }
    return {
      type: 'field',
      model: instruction.model,
      from: projectFieldShortName(instruction.model, instruction.from),
      to: projectFieldShortName(instruction.model, instruction.to),
    };
  }
  const unhandled: never = instruction.type;
  throw new RenameRejectedError('RENAME_TARGET', `Unknown rename type '${String(unhandled)}'`);
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
