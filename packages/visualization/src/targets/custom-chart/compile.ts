import { VisualizationError } from '../../errors';
import { LIGHTDASH_THEME } from '../../theme/lightdash';
import { prepareRankedCardsData } from '../../templates/ranked-cards';

import type { VisualizationDataset } from '../../data/dataset';
import type { VisualizationWarning } from '../../errors';
import type { FieldRoleMap, VisualizationSpecV1 } from '../../spec/types';

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

function assertNoExternalDataUrls(spec: Record<string, unknown>): void {
  const stack: unknown[] = [spec];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') continue;
    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }
    const record = current as Record<string, unknown>;
    if (typeof record.url === 'string') {
      throw new VisualizationError(
        'EXTERNAL_RESOURCE_BLOCKED',
        'Vega-Lite specs must not reference external URLs in governed Custom Chart compile',
      );
    }
    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') stack.push(value);
    }
  }
}

function rankedCardsVegaLite(
  spec: VisualizationSpecV1,
  dataset: VisualizationDataset,
  boundRoles: FieldRoleMap,
): { vega: Record<string, unknown>; warnings: VisualizationWarning[] } {
  const prepared = prepareRankedCardsData({ spec, dataset, boundRoles });
  const values = prepared.rows.map((row) => ({
    [prepared.categoryField]: row[prepared.categoryField],
    [prepared.valueField]: row[prepared.valueField],
  }));

  const vega: Record<string, unknown> = {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    description:
      spec.accessibility?.description ?? spec.metadata?.description ?? spec.metadata?.title,
    data: { values },
    mark: { type: 'bar' },
    encoding: {
      y: {
        field: prepared.categoryField,
        type: 'nominal',
        sort: '-x',
        title:
          dataset.columns.find((c) => c.fieldId === prepared.categoryField)?.label ??
          prepared.categoryField,
      },
      x: {
        field: prepared.valueField,
        type: 'quantitative',
        title:
          dataset.columns.find((c) => c.fieldId === prepared.valueField)?.label ??
          prepared.valueField,
      },
      color: { value: LIGHTDASH_THEME.palette.bar },
    },
    config: {
      view: { stroke: null },
    },
  };
  assertNoExternalDataUrls(vega);
  return { vega, warnings: prepared.warnings };
}

export function compileCustomChart(input: {
  spec: VisualizationSpecV1;
  dataset: VisualizationDataset;
  boundRoles: FieldRoleMap;
  templateId: string;
}): CustomChartCompileResult {
  if (input.templateId !== 'ranked-cards') {
    throw new VisualizationError(
      'TEMPLATE_TARGET_UNSUPPORTED',
      `Template "${input.templateId}" does not support lightdash-custom-chart`,
      { templateId: input.templateId },
    );
  }

  const { vega, warnings } = rankedCardsVegaLite(input.spec, input.dataset, input.boundRoles);
  const q = input.spec.data.query;
  return {
    chartConfig: {
      type: 'custom',
      config: { spec: vega },
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
