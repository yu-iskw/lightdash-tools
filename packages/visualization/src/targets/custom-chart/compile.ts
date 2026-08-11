/**
 * Custom Chart (Vega-Lite) compile for supported templates.
 */

import { VisualizationError } from '../../errors';

import type { VisualizationDataset } from '../../data/dataset';
import type { VisualizationWarning } from '../../errors';
import type { VisualizationSpecV1 } from '../../spec/types';

export interface CustomChartCompileResult {
  chartConfig: {
    type: 'custom';
    config: {
      spec: Record<string, unknown>;
    };
  };
  metricQuery: {
    exploreName: string;
    dimensions: string[];
    metrics: string[];
    filters: { dimensions?: unknown; metrics?: unknown };
    sorts: Array<{ fieldId: string; descending: boolean; nullsFirst?: boolean }>;
    limit?: number;
  };
  warnings: VisualizationWarning[];
}

function assertNoExternalResources(spec: Record<string, unknown>): void {
  const json = JSON.stringify(spec);
  if (/"url"\s*:/.test(json)) {
    throw new VisualizationError(
      'EXTERNAL_RESOURCE_BLOCKED',
      'Vega-Lite specs must not reference external URLs in governed Custom Chart compile',
    );
  }
}

function rankedCardsVegaLite(
  spec: VisualizationSpecV1,
  dataset: VisualizationDataset,
  boundRoles: Partial<Record<string, string>>,
): Record<string, unknown> {
  const category = boundRoles.category!;
  const value = boundRoles.value!;
  const values = dataset.rows.map((row) => ({
    [category]: row[category],
    [value]: row[value],
  }));

  const vega: Record<string, unknown> = {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    description:
      spec.accessibility?.description ?? spec.metadata?.description ?? spec.metadata?.title,
    data: { values },
    mark: { type: 'bar', tooltip: true },
    encoding: {
      y: {
        field: category,
        type: 'nominal',
        sort: '-x',
        title: dataset.columns.find((c) => c.fieldId === category)?.label ?? category,
      },
      x: {
        field: value,
        type: 'quantitative',
        title: dataset.columns.find((c) => c.fieldId === value)?.label ?? value,
      },
      color: { value: '#0e7c86' },
    },
    config: {
      view: { stroke: null },
    },
  };
  assertNoExternalResources(vega);
  return vega;
}

export function compileCustomChart(input: {
  spec: VisualizationSpecV1;
  dataset: VisualizationDataset;
  boundRoles: Partial<Record<string, string>>;
  templateId: string;
}): CustomChartCompileResult {
  if (input.spec.visual.type !== 'template') {
    throw new VisualizationError(
      'VEGA_LITE_ESCAPE_HATCH_BANNED',
      'Governed Custom Chart compile rejects type: vegaLite in MVP; use a supported template',
    );
  }

  let vegaSpec: Record<string, unknown>;
  const warnings: VisualizationWarning[] = [];

  switch (input.templateId) {
    case 'ranked-cards':
      vegaSpec = rankedCardsVegaLite(input.spec, input.dataset, input.boundRoles);
      break;
    case 'metric-hero':
      throw new VisualizationError(
        'TEMPLATE_TARGET_UNSUPPORTED',
        'metric-hero does not support lightdash-custom-chart in MVP',
        { templateId: input.templateId },
      );
    default:
      throw new VisualizationError(
        'TEMPLATE_TARGET_UNSUPPORTED',
        `Template "${input.templateId}" does not support lightdash-custom-chart`,
        { templateId: input.templateId },
      );
  }

  const q = input.spec.data.query;
  return {
    chartConfig: {
      type: 'custom',
      config: { spec: vegaSpec },
    },
    metricQuery: {
      exploreName: input.spec.data.source.explore,
      dimensions: q.dimensions,
      metrics: q.metrics,
      filters: q.filters ?? {},
      sorts: q.sorts ?? [],
      limit: q.limit,
    },
    warnings,
  };
}
