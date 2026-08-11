import { VisualizationError } from '../../errors';
import { prepareRankedCardsData } from '../../templates/ranked-cards';
import { LIGHTDASH_THEME } from '../../theme/lightdash';

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
    limit: number;
    tableCalculations: unknown[];
  };
  warnings: VisualizationWarning[];
}

type WalkFrame = { value: unknown; inValues: boolean };

function pushChildren(
  stack: WalkFrame[],
  record: Record<string, unknown>,
  inValues: boolean,
): void {
  for (const [key, child] of Object.entries(record)) {
    if (child && typeof child === 'object') {
      stack.push({ value: child, inValues: inValues || key === 'values' });
    }
  }
}

function rejectExternalUrl(record: Record<string, unknown>, inValues: boolean): void {
  if (!inValues && typeof record.url === 'string') {
    throw new VisualizationError(
      'EXTERNAL_RESOURCE_BLOCKED',
      'Vega-Lite specs must not reference external URLs in governed Custom Chart compile',
    );
  }
}

/** Block Vega-Lite data.url (and nested data sources), not row field ids named `url`. */
function assertNoExternalDataUrls(spec: Record<string, unknown>): void {
  const stack: WalkFrame[] = [{ value: spec, inValues: false }];
  while (stack.length > 0) {
    const frame = stack.pop();
    if (!frame?.value || typeof frame.value !== 'object') continue;
    if (Array.isArray(frame.value)) {
      for (const item of frame.value) {
        stack.push({ value: item, inValues: frame.inValues });
      }
      continue;
    }
    const record = frame.value as Record<string, unknown>;
    rejectExternalUrl(record, frame.inValues);
    pushChildren(stack, record, frame.inValues);
  }
}

function rankedCardsVegaLite(
  spec: VisualizationSpecV1,
  dataset: VisualizationDataset,
  boundRoles: FieldRoleMap,
): { vega: Record<string, unknown>; warnings: VisualizationWarning[]; limit: number } {
  const prepared = prepareRankedCardsData({ spec, dataset, boundRoles });
  const warnings = [...prepared.warnings];

  if (prepared.secondaryField !== undefined) {
    warnings.push({
      code: 'UNSUPPORTED_OPTION_IGNORED',
      message: 'Custom Chart compile ignores secondaryValue for ranked-cards (SVG/HTML only)',
      details: { fieldId: prepared.secondaryField },
    });
  }
  if (spec.emphasis && spec.emphasis.mode !== 'none') {
    warnings.push({
      code: 'UNSUPPORTED_OPTION_IGNORED',
      message:
        'Custom Chart compile ignores emphasis highlighting for ranked-cards (SVG/HTML only)',
      details: { mode: spec.emphasis.mode, field: spec.emphasis.field },
    });
  }

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
  return { vega, warnings, limit: prepared.rows.length };
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

  const {
    vega,
    warnings,
    limit: preparedLimit,
  } = rankedCardsVegaLite(input.spec, input.dataset, input.boundRoles);
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
      limit: q.limit ?? preparedLimit,
      tableCalculations: [],
    },
    warnings,
  };
}
