/**
 * metric-hero template — single headline KPI (+ optional secondary).
 */

import { toDisplayString } from '../format/escape';
import { formatValue } from '../format/number';

import type { VisualizationWarning } from '../errors';
import type { TemplateCompileContext, VisualizationTemplate } from './contracts';
import type { LayoutNode } from '../layout/types';

function buildMetricHeroChildren(context: TemplateCompileContext): {
  children: LayoutNode[];
  title: string;
  warnings: VisualizationWarning[];
} {
  const warnings: VisualizationWarning[] = [];
  const row = context.dataset.rows[0] ?? {};
  const valueField = context.boundRoles.value!;
  const secondaryField = context.boundRoles.secondaryValue;
  const valueCol = context.dataset.columns.find((c) => c.fieldId === valueField);
  const secondaryCol = secondaryField
    ? context.dataset.columns.find((c) => c.fieldId === secondaryField)
    : undefined;

  if (context.dataset.rows.length > 1) {
    warnings.push({
      code: 'DATA_TRUNCATED',
      message: 'metric-hero uses the first row only',
      details: { rowCount: context.dataset.rows.length },
    });
  }

  const title =
    context.spec.accessibility?.title ??
    context.spec.metadata?.title ??
    valueCol?.label ??
    'Metric';
  const message = context.spec.intent?.message;
  const primary = formatValue(row[valueField], valueCol?.format);

  const children: LayoutNode[] = [
    { kind: 'text', id: 'title', text: title, role: 'title' },
    { kind: 'text', id: 'kpi', text: primary, role: 'kpi' },
    {
      kind: 'text',
      id: 'kpi-label',
      text: valueCol?.label ?? toDisplayString(valueField),
      role: 'label',
    },
  ];

  if (secondaryField) {
    children.push({
      kind: 'text',
      id: 'secondary',
      text: formatValue(row[secondaryField], secondaryCol?.format),
      role: 'body',
    });
    children.push({
      kind: 'text',
      id: 'secondary-label',
      text: secondaryCol?.label ?? toDisplayString(secondaryField),
      role: 'muted',
    });
  }

  if (message) {
    children.push({ kind: 'text', id: 'message', text: message, role: 'subtitle' });
  }

  return { children, title, warnings };
}

export const metricHeroTemplate: VisualizationTemplate = {
  id: 'metric-hero',
  version: '1.0.0',
  title: 'Metric hero',
  description: 'One headline KPI with optional secondary value',
  intents: ['overview', 'executive-summary'],
  requirements: {
    value: { required: true, dataTypes: ['number'] },
    secondaryValue: { required: false, dataTypes: ['number'] },
    label: { required: false, dataTypes: ['string'] },
  },
  supportedTargets: ['svg', 'standalone-html'],
  maxRows: 1,
  compile(context: TemplateCompileContext) {
    const { children, title, warnings } = buildMetricHeroChildren(context);
    const hasSecondary = Boolean(context.boundRoles.secondaryValue);
    return {
      layout: {
        width: 480,
        height: hasSecondary ? 220 : 180,
        title,
        description: context.spec.accessibility?.description ?? context.spec.metadata?.description,
        root: {
          kind: 'group',
          id: 'root',
          direction: 'column',
          gap: 8,
          children: [{ kind: 'card', id: 'hero-card', children }],
        },
      },
      warnings,
    };
  },
};
