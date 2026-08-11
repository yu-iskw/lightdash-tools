import { requireBoundRole } from '../compile/bind';
import { toDisplayString } from '../format/escape';
import { formatValue } from '../format/number';

import type { VisualizationWarning } from '../errors';
import type { LayoutBar, LayoutNode } from '../layout/types';
import type { TemplateCompileContext, VisualizationTemplate } from './contracts';

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

function sortRows(
  rows: Array<Record<string, unknown>>,
  valueField: string,
  sortDescending: boolean,
): Array<Record<string, unknown>> {
  return [...rows].sort((a, b) => {
    const av = asNumber(a[valueField]) ?? 0;
    const bv = asNumber(b[valueField]) ?? 0;
    return sortDescending ? bv - av : av - bv;
  });
}

function findEmphasizedIndex(
  rows: Array<Record<string, unknown>>,
  field: string,
  mode: 'max' | 'min' | 'none',
): number {
  if (mode === 'none') return -1;
  let best: number | null = null;
  let emphasizedIndex = -1;
  rows.forEach((row, index) => {
    const n = asNumber(row[field]);
    if (n === null) return;
    if (best === null || (mode === 'max' && n > best) || (mode === 'min' && n < best)) {
      best = n;
      emphasizedIndex = index;
    }
  });
  return emphasizedIndex;
}

function buildBars(
  context: TemplateCompileContext,
  rows: Array<Record<string, unknown>>,
  warnings: VisualizationWarning[],
): LayoutBar[] {
  const categoryField = requireBoundRole(context.boundRoles, 'category');
  const valueField = requireBoundRole(context.boundRoles, 'value');
  const secondaryField = context.boundRoles.secondaryValue;
  const valueCol = context.dataset.columns.find((c) => c.fieldId === valueField);
  const secondaryCol = secondaryField
    ? context.dataset.columns.find((c) => c.fieldId === secondaryField)
    : undefined;

  const values = rows.map((r) => asNumber(r[valueField]) ?? 0);
  const maxAbs = Math.max(...values.map((v) => Math.abs(v)), 1);
  const emphasisMode = context.spec.emphasis?.mode ?? 'max';
  const emphasisField = context.spec.emphasis?.field ?? valueField;
  const emphasizedIndex = findEmphasizedIndex(rows, emphasisField, emphasisMode);

  return rows.map((row, index) => {
    const raw = asNumber(row[valueField]) ?? 0;
    const label = toDisplayString(row[categoryField]);
    if (label.length > 40) {
      warnings.push({
        code: 'LONG_LABELS',
        message: `Long category label truncated visually: ${label.slice(0, 40)}…`,
      });
    }
    if (row[valueField] === null || row[valueField] === undefined) {
      warnings.push({
        code: 'NULL_VALUES',
        message: `Null value for category ${label}`,
      });
    }
    return {
      kind: 'bar' as const,
      id: `bar-${index}`,
      label,
      valueLabel: formatValue(raw, valueCol?.format),
      secondaryLabel:
        secondaryField !== undefined
          ? formatValue(row[secondaryField], secondaryCol?.format)
          : undefined,
      ratio: Math.abs(raw) / maxAbs,
      emphasized: index === emphasizedIndex,
    };
  });
}

function prepareRankedRows(
  context: TemplateCompileContext,
  warnings: VisualizationWarning[],
): {
  rows: Array<Record<string, unknown>>;
  title: string;
  message: string | undefined;
} {
  const options =
    context.spec.visual.type === 'template' && context.spec.visual.template === 'ranked-cards'
      ? context.spec.visual.options
      : undefined;

  const maxRows = options?.maxRows ?? 20;
  const sortDescending = options?.sortDescending !== false;
  const valueField = requireBoundRole(context.boundRoles, 'value');
  const categoryField = requireBoundRole(context.boundRoles, 'category');
  const valueCol = context.dataset.columns.find((c) => c.fieldId === valueField);
  const categoryCol = context.dataset.columns.find((c) => c.fieldId === categoryField);

  let rows = sortRows(context.dataset.rows, valueField, sortDescending);
  if (rows.length > maxRows) {
    warnings.push({
      code: 'DATA_TRUNCATED',
      message: `ranked-cards truncated to ${maxRows} rows`,
      details: { rowCount: rows.length, maxRows },
    });
    rows = rows.slice(0, maxRows);
  }
  if (rows.length > 12) {
    warnings.push({
      code: 'HIGH_CARDINALITY',
      message: 'High category cardinality may reduce readability',
      details: { rowCount: rows.length },
    });
  }

  return {
    rows,
    title:
      context.spec.accessibility?.title ??
      context.spec.metadata?.title ??
      `${categoryCol?.label ?? 'Category'} by ${valueCol?.label ?? 'value'}`,
    message: context.spec.intent?.message,
  };
}

export const rankedCardsTemplate: VisualizationTemplate = {
  id: 'ranked-cards',
  version: '1.0.0',
  title: 'Ranked cards',
  description: 'Ranked categorical comparison with value bars',
  intents: ['rank', 'executive-summary'],
  requirements: {
    category: { required: true, dataTypes: ['string'] },
    value: { required: true, dataTypes: ['number'] },
    secondaryValue: { required: false, dataTypes: ['number'] },
  },
  supportedTargets: ['svg', 'standalone-html', 'lightdash-custom-chart'],
  maxRows: 20,
  compile(context: TemplateCompileContext) {
    const warnings: VisualizationWarning[] = [];
    const { rows, title, message } = prepareRankedRows(context, warnings);
    const bars = buildBars(context, rows, warnings);
    const children: LayoutNode[] = [{ kind: 'text', id: 'title', text: title, role: 'title' }];
    if (message) {
      children.push({ kind: 'text', id: 'message', text: message, role: 'subtitle' });
    }
    children.push(...bars);

    return {
      layout: {
        width: 640,
        height: Math.max(72 + bars.length * 36 + (message ? 24 : 0), 160),
        title,
        description: context.spec.accessibility?.description ?? context.spec.metadata?.description,
        root: { kind: 'group', id: 'root', direction: 'column', gap: 10, children },
      },
      warnings,
    };
  },
};
