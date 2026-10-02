/**
 * Rename instructions stored in the preview ledger (ADR-0018).
 * The server rewrites chart references. This module only checks the instruction
 * before it is stored or applied.
 */

import { isRecord } from '../lib/stable-stringify.js';

import type { RenameImpactBaseline } from '../../policy/preview-ledger.js';
import type { components } from '@lightdash-tools/common';

export type RenameRejectCode =
  'RENAME_DRY_RUN' | 'RENAME_FIELD_PREFIX' | 'RENAME_SCOPE' | 'RENAME_TARGET' | 'RENAME_UNCHANGED';

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
  tableName: string | null;
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

/** Reject an empty or no-op rename before the ledger is written. */
export function assertRenameNamesDiffer(from: string, to: string): void {
  if (from === '' || to === '') {
    throw new RenameRejectedError('RENAME_TARGET', 'from and to must both be non-empty');
  }
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

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  // eslint-disable-next-line security/detect-object-injection -- key is a fixed instruction field
  return nonEmptyString(record[key]);
}

function readKind(record: Record<string, unknown>): RenameKind {
  const type = record.type;
  if (type === 'field' || type === 'model') {
    return type;
  }
  throw new RenameRejectedError('RENAME_SCOPE', 'Rename instruction type must be field or model');
}

function requireName(record: Record<string, unknown>, key: 'from' | 'to'): string {
  const value = readString(record, key);
  if (value == null) {
    throw new RenameRejectedError('RENAME_SCOPE', 'Rename instruction is missing from or to');
  }
  return value;
}

function parseChartInstruction(
  value: Record<string, unknown>,
  type: RenameKind,
  from: string,
  to: string,
): ChartRenameInstruction {
  const chartUuid = readString(value, 'chartUuid');
  if (chartUuid == null) {
    throw new RenameRejectedError('RENAME_SCOPE', 'Chart rename instruction is missing chartUuid');
  }
  return {
    scope: 'chart',
    chartUuid,
    type,
    from,
    to,
    tableName: readString(value, 'tableName') ?? null,
  };
}

function parseDashboardInstruction(
  value: Record<string, unknown>,
  type: RenameKind,
  from: string,
  to: string,
): DashboardFilterRenameInstruction {
  const dashboardUuid = readString(value, 'dashboardUuid');
  if (dashboardUuid == null) {
    throw new RenameRejectedError(
      'RENAME_SCOPE',
      'Dashboard filter rename instruction is missing dashboardUuid',
    );
  }
  return { scope: 'dashboard-filter', dashboardUuid, type, from, to };
}

/** Read a ledger `proposed` value back into a rename instruction. */
export function parseRenameInstruction(value: unknown): RenameInstruction {
  if (!isRecord(value)) {
    throw new RenameRejectedError('RENAME_SCOPE', 'Preview payload is not a rename instruction');
  }
  const type = readKind(value);
  const from = requireName(value, 'from');
  const to = requireName(value, 'to');
  if (value.scope === 'chart') {
    return parseChartInstruction(value, type, from, to);
  }
  if (value.scope === 'dashboard-filter') {
    return parseDashboardInstruction(value, type, from, to);
  }
  if (value.scope === 'project') {
    return { scope: 'project', type, from, to, model: readString(value, 'model') ?? null };
  }
  throw new RenameRejectedError('RENAME_SCOPE', 'Preview payload is not a rename instruction');
}
