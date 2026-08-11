/**
 * metric-hero template — single headline KPI (+ optional secondary).
 */

import { formatValue } from '../format/number';
import { toDisplayString } from '../format/escape';

import type { VisualizationTemplate, TemplateCompileContext } from './contracts';
import type { LayoutNode } from '../layout/types';

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
    const warnings = [];
    const row = context.dataset.rows[0] ?? {};
    const valueField = context.boundRoles.value!;
    const secondaryField = context.boundRoles.secondaryValue;
    const valueCol = context.dataset.columns.find((c) => c.fieldId === valueField);
    const secondaryCol = secondaryField
      ? context.dataset.columns.find((c) => c.fieldId === secondaryField)
      : undefined;

    if (context.dataset.rows.length > 1) {
      warnings.push({
        code: 'DATA_TRUNCATED' as const,
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
    const secondary =
      secondaryField !== undefined
        ? formatValue(row[secondaryField], secondaryCol?.format)
        : undefined;

    const children: LayoutNode[] = [
      {
        kind: 'text' as const,
        id: 'title',
        text: title,
        role: 'title' as const,
      },
      {
        kind: 'text' as const,
        id: 'kpi',
        text: primary,
        role: 'kpi' as const,
      },
      {
        kind: 'text' as const,
        id: 'kpi-label',
        text: valueCol?.label ?? toDisplayString(valueField),
        role: 'label' as const,
      },
    ];

    if (secondary !== undefined && secondaryField) {
      children.push({
        kind: 'text' as const,
        id: 'secondary',
        text: secondary,
        role: 'body' as const,
      });
      children.push({
        kind: 'text' as const,
        id: 'secondary-label',
        text: secondaryCol?.label ?? toDisplayString(secondaryField),
        role: 'muted' as const,
      });
    }

    if (message) {
      children.push({
        kind: 'text' as const,
        id: 'message',
        text: message,
        role: 'subtitle' as const,
      });
    }

    return {
      layout: {
        width: 480,
        height: secondary ? 220 : 180,
        title,
        description: context.spec.accessibility?.description ?? context.spec.metadata?.description,
        root: {
          kind: 'group',
          id: 'root',
          direction: 'column',
          gap: 8,
          children: [
            {
              kind: 'card',
              id: 'hero-card',
              children,
            },
          ],
        },
      },
      warnings,
    };
  },
};
