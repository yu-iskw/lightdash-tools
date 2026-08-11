import { VisualizationError } from '../../errors';

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
export function assertNoExternalDataUrls(spec: Record<string, unknown>): void {
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

/** Align LVS query + explore with OpenAPI MetricQuery required fields. */
export function buildAlignedMetricQuery(
  spec: VisualizationSpecV1,
  displayRowCount: number,
): CustomChartCompileResult['metricQuery'] {
  const q = spec.data.query;
  // Keep live re-query limit aligned with the embedded/truncated visual row count.
  const limit = typeof q.limit === 'number' ? Math.min(q.limit, displayRowCount) : displayRowCount;
  return {
    exploreName: spec.data.source.explore,
    dimensions: q.dimensions,
    metrics: q.metrics,
    filters: q.filters ?? {},
    sorts: q.sorts ?? [],
    limit,
    tableCalculations: [],
  };
}

export function toCustomChartResult(input: {
  vegaSpec: Record<string, unknown>;
  metricQuery: CustomChartCompileResult['metricQuery'];
  warnings: VisualizationWarning[];
}): CustomChartCompileResult {
  assertNoExternalDataUrls(input.vegaSpec);
  return {
    chartConfig: {
      type: 'custom',
      config: { spec: input.vegaSpec },
    },
    metricQuery: input.metricQuery,
    warnings: input.warnings,
  };
}
