/**
 * ranked-cards template — categorical ranking with bars.
 */

import { formatValue } from '../format/number';
import { toDisplayString } from '../format/escape';

import type { VisualizationTemplate, TemplateCompileContext } from './contracts';
import type { LayoutBar, LayoutNode } from '../layout/types';
import type { RankedCardsOptions } from '../spec/types';

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
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
    const warnings = [];
    const options = (context.spec.visual.type === 'template' &&
    context.spec.visual.template === 'ranked-cards'
      ? context.spec.visual.options
      : undefined) as RankedCardsOptions | undefined;

    const maxRows = options?.maxRows ?? 20;
    const sortDescending = options?.sortDescending !== false;
    const categoryField = context.boundRoles.category!;
    const valueField = context.boundRoles.value!;
    const secondaryField = context.boundRoles.secondaryValue;

    const valueCol = context.dataset.columns.find((c) => c.fieldId === valueField);
    const categoryCol = context.dataset.columns.find((c) => c.fieldId === categoryField);
    const secondaryCol = secondaryField
      ? context.dataset.columns.find((c) => c.fieldId === secondaryField)
      : undefined;

    let rows = [...context.dataset.rows];
    rows.sort((a, b) => {
      const av = asNumber(a[valueField]) ?? 0;
      const bv = asNumber(b[valueField]) ?? 0;
      return sortDescending ? bv - av : av - bv;
    });

    if (rows.length > maxRows) {
      warnings.push({
        code: 'DATA_TRUNCATED' as const,
        message: `ranked-cards truncated to ${maxRows} rows`,
        details: { rowCount: rows.length, maxRows },
      });
      rows = rows.slice(0, maxRows);
    }

    if (rows.length > 12) {
      warnings.push({
        code: 'HIGH_CARDINALITY' as const,
        message: 'High category cardinality may reduce readability',
        details: { rowCount: rows.length },
      });
    }

    const values = rows.map((r) => asNumber(r[valueField]) ?? 0);
    const maxAbs = Math.max(...values.map((v) => Math.abs(v)), 1);

    const emphasisMode = context.spec.emphasis?.mode ?? 'max';
    const emphasisField = context.spec.emphasis?.field ?? valueField;
    let emphasizedIndex = -1;
    if (emphasisMode !== 'none') {
      let best: number | null = null;
      rows.forEach((row, index) => {
        const n = asNumber(row[emphasisField]);
        if (n === null) return;
        if (
          best === null ||
          (emphasisMode === 'max' && n > best) ||
          (emphasisMode === 'min' && n < best)
        ) {
          best = n;
          emphasizedIndex = index;
        }
      });
    }

    const bars: LayoutBar[] = rows.map((row, index) => {
      const raw = asNumber(row[valueField]) ?? 0;
      const label = toDisplayString(row[categoryField]);
      if (label.length > 40) {
        warnings.push({
          code: 'LONG_LABELS' as const,
          message: `Long category label truncated visually: ${label.slice(0, 40)}…`,
        });
      }
      if (row[valueField] === null || row[valueField] === undefined) {
        warnings.push({
          code: 'NULL_VALUES' as const,
          message: `Null value for category ${label}`,
        });
      }
      const secondary =
        secondaryField !== undefined
          ? formatValue(row[secondaryField], secondaryCol?.format)
          : undefined;
      return {
        kind: 'bar',
        id: `bar-${index}`,
        label,
        valueLabel: formatValue(raw, valueCol?.format),
        secondaryLabel: secondary,
        ratio: Math.abs(raw) / maxAbs,
        emphasized: index === emphasizedIndex,
      };
    });

    const title =
      context.spec.accessibility?.title ??
      context.spec.metadata?.title ??
      `${categoryCol?.label ?? 'Category'} by ${valueCol?.label ?? 'value'}`;
    const message = context.spec.intent?.message;

    const titleNodes: LayoutNode[] = [
      {
        kind: 'text',
        id: 'title',
        text: title,
        role: 'title',
      },
    ];
    if (message) {
      titleNodes.push({
        kind: 'text',
        id: 'message',
        text: message,
        role: 'subtitle',
      });
    }
    const children: LayoutNode[] = [...titleNodes, ...bars];

    const height = 72 + bars.length * 36 + (message ? 24 : 0);

    return {
      layout: {
        width: 640,
        height: Math.max(height, 160),
        title,
        description: context.spec.accessibility?.description ?? context.spec.metadata?.description,
        root: {
          kind: 'group',
          id: 'root',
          direction: 'column',
          gap: 10,
          children,
        },
      },
      warnings,
    };
  },
};
