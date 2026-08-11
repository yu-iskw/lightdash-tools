import { requireBoundRole } from '../compile/bind';
import { VisualizationError } from '../errors';
import { toDisplayString } from '../format/escape';
import { formatValue } from '../format/number';
import { buildAlignedMetricQuery, toCustomChartResult } from '../targets/custom-chart/compile';
import { LIGHTDASH_THEME } from '../theme/lightdash';

import type { VisualizationDataset } from '../data/dataset';
import type { VisualizationWarning } from '../errors';
import type { TemplateCompileContext, VisualizationTemplate } from './contracts';
import type { LayoutBar, LayoutNode } from '../layout/types';
import type { FieldRoleMap, VisualizationSpecV1 } from '../spec/types';

const RANKED_CARDS_ID = 'ranked-cards' as const;
const DEFAULT_RANKED_MAX_ROWS = 20;

function rankedCardsOptions(spec: VisualizationSpecV1) {
  return spec.visual.type === 'template' && spec.visual.template === RANKED_CARDS_ID
    ? spec.visual.options
    : undefined;
}

/** Presentation top-N for ranked-cards (options.maxRows) or the template default. */
export function resolveRankedCardsMaxRows(
  spec: VisualizationSpecV1,
  fallback: number = DEFAULT_RANKED_MAX_ROWS,
): number {
  return rankedCardsOptions(spec)?.maxRows ?? fallback;
}

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

/**
 * One sort authority for prep + Custom Chart metricQuery.
 * Author query.sorts win when present; they must be a single sort on the value role.
 */
function resolveSortDescending(
  spec: VisualizationSpecV1,
  valueField: string,
  optionsSortDescending: boolean,
): boolean {
  const sorts = spec.data.query.sorts;
  if (!sorts || sorts.length === 0) return optionsSortDescending;
  if (sorts.length !== 1 || sorts[0]?.fieldId !== valueField) {
    throw new VisualizationError(
      'INVALID_SPEC',
      `ranked-cards query.sorts must be a single sort on value role "${valueField}"`,
      { sorts, valueField },
    );
  }
  return sorts[0].descending;
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

/** Shared prep for layout + Custom Chart so targets see the same ordered/truncated rows. */
export function prepareRankedCardsData(input: {
  spec: VisualizationSpecV1;
  dataset: VisualizationDataset;
  boundRoles: FieldRoleMap;
}): {
  rows: Array<Record<string, unknown>>;
  categoryField: string;
  valueField: string;
  secondaryField?: string;
  maxRows: number;
  sortDescending: boolean;
  title: string;
  message: string | undefined;
  warnings: VisualizationWarning[];
} {
  const warnings: VisualizationWarning[] = [];
  const options = rankedCardsOptions(input.spec);

  const configuredMaxRows = resolveRankedCardsMaxRows(input.spec);
  const queryLimit = input.spec.data.query.limit;
  // Same top-N for SVG/HTML prep and Custom Chart metricQuery (honor query.limit when tighter).
  const maxRows =
    typeof queryLimit === 'number' ? Math.min(configuredMaxRows, queryLimit) : configuredMaxRows;
  const valueField = requireBoundRole(input.boundRoles, 'value');
  const categoryField = requireBoundRole(input.boundRoles, 'category');
  const secondaryField = input.boundRoles.secondaryValue;
  const sortDescending = resolveSortDescending(
    input.spec,
    valueField,
    options?.sortDescending !== false,
  );
  const valueCol = input.dataset.columns.find((c) => c.fieldId === valueField);
  const categoryCol = input.dataset.columns.find((c) => c.fieldId === categoryField);

  let rows = sortRows(input.dataset.rows, valueField, sortDescending);
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
    categoryField,
    valueField,
    secondaryField,
    maxRows,
    sortDescending,
    title:
      input.spec.accessibility?.title ??
      input.spec.metadata?.title ??
      `${categoryCol?.label ?? 'Category'} by ${valueCol?.label ?? 'value'}`,
    message: input.spec.intent?.message,
    warnings,
  };
}

function buildBars(
  context: TemplateCompileContext,
  prepared: ReturnType<typeof prepareRankedCardsData>,
): LayoutBar[] {
  const { rows, categoryField, valueField, secondaryField, warnings } = prepared;
  const valueCol = context.dataset.columns.find((c) => c.fieldId === valueField);
  const secondaryCol = secondaryField
    ? context.dataset.columns.find((c) => c.fieldId === secondaryField)
    : undefined;

  const values = rows.map((r) => asNumber(r[valueField]) ?? 0);
  let maxAbs = 1;
  for (const v of values) maxAbs = Math.max(maxAbs, Math.abs(v));
  const emphasisMode = context.spec.emphasis?.mode ?? 'max';
  const emphasisField = context.spec.emphasis?.field ?? valueField;
  const emphasizedIndex = findEmphasizedIndex(rows, emphasisField, emphasisMode);

  return rows.map((row, index) => {
    const cell = row[valueField];
    const numeric = values[index];
    const label = toDisplayString(row[categoryField]);
    if (label.length > 40) {
      warnings.push({
        code: 'LONG_LABELS',
        message: `Long category label may overflow layout: ${label.slice(0, 40)}…`,
      });
    }
    if (cell === null || cell === undefined) {
      warnings.push({
        code: 'NULL_VALUES',
        message: `Null value for category ${label}`,
      });
    }
    return {
      kind: 'bar' as const,
      id: `bar-${index}`,
      label,
      // Format the original cell so null/missing stays "—" (not "$0").
      valueLabel: formatValue(cell, valueCol?.format),
      secondaryLabel:
        secondaryField !== undefined
          ? formatValue(row[secondaryField], secondaryCol?.format)
          : undefined,
      ratio: Math.abs(numeric) / maxAbs,
      emphasized: index === emphasizedIndex,
    };
  });
}

export const rankedCardsTemplate: VisualizationTemplate = {
  id: RANKED_CARDS_ID,
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
  maxRows: DEFAULT_RANKED_MAX_ROWS,
  compile(context: TemplateCompileContext) {
    const prepared = prepareRankedCardsData(context);
    const bars = buildBars(context, prepared);
    const children: LayoutNode[] = [
      { kind: 'text', id: 'title', text: prepared.title, role: 'title' },
    ];
    if (prepared.message) {
      children.push({ kind: 'text', id: 'message', text: prepared.message, role: 'subtitle' });
    }
    children.push(...bars);

    return {
      layout: {
        width: 640,
        height: Math.max(72 + bars.length * 36 + (prepared.message ? 24 : 0), 160),
        title: prepared.title,
        description: context.spec.accessibility?.description ?? context.spec.metadata?.description,
        root: { kind: 'group', id: 'root', direction: 'column', gap: 10, children },
      },
      warnings: prepared.warnings,
    };
  },
  compileCustomChart(context: TemplateCompileContext) {
    const prepared = prepareRankedCardsData(context);
    const warnings = [...prepared.warnings];

    if (prepared.secondaryField !== undefined) {
      warnings.push({
        code: 'UNSUPPORTED_OPTION_IGNORED',
        message: 'Custom Chart compile ignores secondaryValue for ranked-cards (SVG/HTML only)',
        details: { fieldId: prepared.secondaryField },
      });
    }
    if (context.spec.emphasis && context.spec.emphasis.mode !== 'none') {
      warnings.push({
        code: 'UNSUPPORTED_OPTION_IGNORED',
        message:
          'Custom Chart compile ignores emphasis highlighting for ranked-cards (SVG/HTML only)',
        details: { mode: context.spec.emphasis.mode, field: context.spec.emphasis.field },
      });
    }

    const values = prepared.rows.map((row) => ({
      [prepared.categoryField]: row[prepared.categoryField],
      [prepared.valueField]: row[prepared.valueField],
    }));

    const vegaSpec: Record<string, unknown> = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description:
        context.spec.accessibility?.description ??
        context.spec.metadata?.description ??
        context.spec.metadata?.title,
      data: { values },
      mark: { type: 'bar' },
      encoding: {
        y: {
          field: prepared.categoryField,
          type: 'nominal',
          // Match prepareRankedCardsData / SVG order ('-x' = descending by measure).
          sort: prepared.sortDescending ? '-x' : 'x',
          title:
            context.dataset.columns.find((c) => c.fieldId === prepared.categoryField)?.label ??
            prepared.categoryField,
        },
        x: {
          field: prepared.valueField,
          type: 'quantitative',
          title:
            context.dataset.columns.find((c) => c.fieldId === prepared.valueField)?.label ??
            prepared.valueField,
        },
        color: { value: LIGHTDASH_THEME.palette.bar },
      },
      config: {
        view: { stroke: null },
      },
    };

    return toCustomChartResult({
      vegaSpec,
      metricQuery: buildAlignedMetricQuery(context.spec, {
        presentationLimit: prepared.maxRows,
        valueField: prepared.valueField,
        sortDescending: prepared.sortDescending,
      }),
      warnings,
    });
  },
};
