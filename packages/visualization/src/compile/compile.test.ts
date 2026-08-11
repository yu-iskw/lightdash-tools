/**
 * Golden + unit tests for LVS compile / render.
 */

import { describe, expect, it } from 'vitest';

import {
  VisualizationError,
  compileVisualization,
  parseVisualizationDataset,
  recommendVisualization,
  validateVisualizationSpec,
} from '../index';

const rankingDataset = parseVisualizationDataset({
  columns: [
    {
      fieldId: 'orders_region',
      label: 'Region',
      semanticType: 'dimension',
      dataType: 'string',
    },
    {
      fieldId: 'orders_total_revenue',
      label: 'Revenue',
      semanticType: 'metric',
      dataType: 'number',
      format: { type: 'currency', currency: 'USD' },
    },
    {
      fieldId: 'orders_revenue_yoy',
      label: 'YoY',
      semanticType: 'metric',
      dataType: 'number',
      format: { type: 'percent', maximumFractionDigits: 1 },
    },
  ],
  rows: [
    { orders_region: 'APAC', orders_total_revenue: 8_400_000, orders_revenue_yoy: 0.31 },
    { orders_region: 'EMEA', orders_total_revenue: 6_100_000, orders_revenue_yoy: 0.12 },
    {
      orders_region: 'North America',
      orders_total_revenue: 5_200_000,
      orders_revenue_yoy: 0.08,
    },
    { orders_region: 'LATAM', orders_total_revenue: 2_100_000, orders_revenue_yoy: 0.04 },
  ],
});

const kpiDataset = parseVisualizationDataset({
  columns: [
    {
      fieldId: 'orders_total_revenue',
      label: 'Revenue',
      semanticType: 'metric',
      dataType: 'number',
      format: { type: 'currency', currency: 'USD' },
    },
    {
      fieldId: 'orders_revenue_yoy',
      label: 'YoY',
      semanticType: 'metric',
      dataType: 'number',
      format: { type: 'percent' },
    },
  ],
  rows: [{ orders_total_revenue: 23_400_000, orders_revenue_yoy: 0.175 }],
});

const rankedSpec = {
  version: '1' as const,
  metadata: { title: 'Revenue health' },
  intent: { type: 'rank' as const, message: 'APAC is the strongest growth region' },
  data: {
    source: { type: 'metricQuery' as const, explore: 'orders' },
    query: {
      dimensions: ['orders_region'],
      metrics: ['orders_total_revenue', 'orders_revenue_yoy'],
    },
    roles: {
      category: 'orders_region',
      value: 'orders_total_revenue',
      secondaryValue: 'orders_revenue_yoy',
    },
  },
  visual: { type: 'template' as const, template: 'ranked-cards' as const },
  emphasis: { mode: 'max' as const, field: 'orders_revenue_yoy' },
  interaction: {
    tooltip: true,
    selection: { type: 'single' as const, field: 'orders_region' },
    actions: [{ trigger: 'selection' as const, action: { type: 'rerunQuery' as const } }],
  },
  accessibility: {
    title: 'Revenue by region',
    description: 'Regions ranked by total revenue',
  },
};

const kpiSpec = {
  version: '1' as const,
  metadata: { title: 'Total revenue' },
  intent: { type: 'overview' as const },
  data: {
    source: { type: 'metricQuery' as const, explore: 'orders' },
    query: {
      dimensions: [],
      metrics: ['orders_total_revenue', 'orders_revenue_yoy'],
    },
    roles: {
      value: 'orders_total_revenue',
      secondaryValue: 'orders_revenue_yoy',
    },
  },
  visual: { type: 'template' as const, template: 'metric-hero' as const },
};

describe('validateVisualizationSpec', () => {
  it('accepts a valid ranked-cards document', () => {
    const spec = validateVisualizationSpec(rankedSpec);
    expect(spec.version).toBe('1');
    expect(spec.visual.type).toBe('template');
  });

  it('rejects unsupported versions', () => {
    expect(() => validateVisualizationSpec({ ...rankedSpec, version: '2' })).toThrow(
      VisualizationError,
    );
  });

  it('rejects empty roles', () => {
    expect(() =>
      validateVisualizationSpec({
        ...rankedSpec,
        data: { ...rankedSpec.data, roles: {} },
      }),
    ).toThrow(VisualizationError);
  });
});

describe('compileVisualization', () => {
  it('renders deterministic SVG for ranked-cards', () => {
    const a = compileVisualization({
      spec: rankedSpec,
      dataset: rankingDataset,
      target: 'svg',
    });
    const b = compileVisualization({
      spec: rankedSpec,
      dataset: rankingDataset,
      target: 'svg',
    });
    expect(a.svg).toBeDefined();
    expect(a.svg).toBe(b.svg);
    expect(a.svg).toContain('<svg');
    expect(a.svg).toContain('APAC');
    expect(a.warnings.some((w) => w.code === 'CAPABILITY_DEGRADED')).toBe(true);
  });

  it('escapes XSS payload values in SVG and HTML', () => {
    const xssDataset = parseVisualizationDataset({
      columns: rankingDataset.columns,
      rows: [
        {
          orders_region: '<img src=x onerror=alert(1)>',
          orders_total_revenue: 1,
          orders_revenue_yoy: 0.1,
        },
      ],
    });
    const svgResult = compileVisualization({
      spec: rankedSpec,
      dataset: xssDataset,
      target: 'svg',
    });
    expect(svgResult.svg).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(svgResult.svg).not.toContain('<img src=x onerror=alert(1)>');

    const htmlResult = compileVisualization({
      spec: rankedSpec,
      dataset: xssDataset,
      target: 'standalone-html',
    });
    expect(htmlResult.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(htmlResult.html).not.toContain('<img src=x onerror=alert(1)>');
  });

  it('does not embed dataset rows in HTML by default', () => {
    const result = compileVisualization({
      spec: rankedSpec,
      dataset: rankingDataset,
      target: 'standalone-html',
    });
    expect(result.html).toBeDefined();
    expect(result.html).not.toContain('id="lvs-data"');
  });

  it('embeds dataset rows as parseable JSON when embedData is true', () => {
    const result = compileVisualization({
      spec: rankedSpec,
      dataset: rankingDataset,
      target: 'standalone-html',
      embedData: true,
    });
    expect(result.html).toContain('id="lvs-data"');
    expect(result.html).toContain('Protect it according to data sensitivity');
    const match = result.html?.match(
      /<script type="application\/json" id="lvs-data">([\s\S]*?)<\/script>/,
    );
    expect(match?.[1]).toBeDefined();
    const parsed = JSON.parse(match![1]!) as { rows: unknown[] };
    expect(parsed.rows).toHaveLength(4);
  });

  it('script-escapes </script> in embedded dataset JSON', () => {
    const evilDataset = parseVisualizationDataset({
      columns: rankingDataset.columns,
      rows: [
        {
          orders_region: '</script><script>alert(1)</script>',
          orders_total_revenue: 1,
          orders_revenue_yoy: 0.1,
        },
      ],
    });
    const result = compileVisualization({
      spec: rankedSpec,
      dataset: evilDataset,
      target: 'standalone-html',
      embedData: true,
    });
    expect(result.html).toContain('\\u003c/script>');
    expect(result.html).not.toMatch(/id="lvs-data">[\s\S]*?<\/script><script>/);
    const match = result.html?.match(
      /<script type="application\/json" id="lvs-data">([\s\S]*?)<\/script>/,
    );
    const parsed = JSON.parse(match![1]!) as { rows: Array<Record<string, unknown>> };
    expect(parsed.rows[0]?.orders_region).toBe('</script><script>alert(1)</script>');
  });

  it('does not emit selection UI for HTML (capability not implemented)', () => {
    const result = compileVisualization({
      spec: rankedSpec,
      dataset: rankingDataset,
      target: 'standalone-html',
      strict: false,
    });
    expect(result.html).not.toContain("querySelectorAll('[data-bar]')");
    expect(result.html).not.toContain('.selected');
  });

  it('fails required capability in strict mode and degrades when non-strict', () => {
    const withRequired = {
      ...rankedSpec,
      capabilities: { required: ['tooltip' as const] },
    };
    expect(() =>
      compileVisualization({
        spec: withRequired,
        dataset: rankingDataset,
        target: 'svg',
      }),
    ).toThrow(/Required capability "tooltip"/);

    const degraded = compileVisualization({
      spec: withRequired,
      dataset: rankingDataset,
      target: 'svg',
      strict: false,
    });
    expect(degraded.capability.degraded).toContain('tooltip');
    expect(degraded.warnings.some((w) => w.code === 'CAPABILITY_DEGRADED')).toBe(true);
  });

  it('labels null ranked values as missing instead of zero', () => {
    const nullDataset = parseVisualizationDataset({
      columns: rankingDataset.columns,
      rows: [
        { orders_region: 'APAC', orders_total_revenue: null, orders_revenue_yoy: 0.1 },
        { orders_region: 'EMEA', orders_total_revenue: 100, orders_revenue_yoy: 0.1 },
      ],
    });
    const result = compileVisualization({
      spec: { ...rankedSpec, interaction: undefined, emphasis: { mode: 'none' as const } },
      dataset: nullDataset,
      target: 'svg',
      strict: false,
    });
    expect(result.warnings.some((w) => w.code === 'NULL_VALUES')).toBe(true);
    expect(result.svg).toContain('—');
    expect(result.svg).not.toMatch(/\$0(\.00)?/);
  });

  it('rejects role fields missing from the LVS query', () => {
    expect(() =>
      compileVisualization({
        spec: {
          ...rankedSpec,
          data: {
            ...rankedSpec.data,
            query: {
              dimensions: ['orders_region'],
              metrics: ['orders_total_revenue'],
            },
            roles: {
              category: 'orders_region',
              value: 'orders_total_revenue',
              secondaryValue: 'orders_revenue_yoy',
            },
          },
        },
        dataset: rankingDataset,
        target: 'svg',
        strict: false,
      }),
    ).toThrow(/must appear in data\.query/);
  });

  it('uses presentation maxRows for Custom Chart limit even when fixture is shorter', () => {
    const shortRows = parseVisualizationDataset({
      columns: rankingDataset.columns,
      rows: [
        { orders_region: 'APAC', orders_total_revenue: 10, orders_revenue_yoy: 0.1 },
        { orders_region: 'EMEA', orders_total_revenue: 5, orders_revenue_yoy: 0.1 },
      ],
    });
    const result = compileVisualization({
      spec: {
        ...rankedSpec,
        data: {
          ...rankedSpec.data,
          query: {
            ...rankedSpec.data.query,
            limit: 500,
          },
        },
        visual: {
          type: 'template' as const,
          template: 'ranked-cards' as const,
          options: { maxRows: 10 },
        },
        emphasis: { mode: 'none' as const },
        interaction: undefined,
      },
      dataset: shortRows,
      target: 'lightdash-custom-chart',
      strict: false,
    });
    expect(result.customChart?.metricQuery.limit).toBe(10);
    expect(
      (result.customChart?.chartConfig.config.spec as { data: { values: unknown[] } }).data.values,
    ).toHaveLength(2);
  });

  it('truncates prep to query.limit when tighter than options.maxRows', () => {
    const manyRows = parseVisualizationDataset({
      columns: rankingDataset.columns,
      rows: Array.from({ length: 8 }, (_, i) => ({
        orders_region: `R${i}`,
        orders_total_revenue: 100 - i,
        orders_revenue_yoy: 0.01,
      })),
    });
    const result = compileVisualization({
      spec: {
        ...rankedSpec,
        data: {
          ...rankedSpec.data,
          query: {
            ...rankedSpec.data.query,
            limit: 3,
          },
        },
        visual: {
          type: 'template' as const,
          template: 'ranked-cards' as const,
          options: { maxRows: 10 },
        },
        emphasis: { mode: 'none' as const },
        interaction: undefined,
      },
      dataset: manyRows,
      target: 'lightdash-custom-chart',
      strict: false,
    });
    expect(result.customChart?.metricQuery.limit).toBe(3);
    expect(
      (result.customChart?.chartConfig.config.spec as { data: { values: unknown[] } }).data.values,
    ).toHaveLength(3);
    expect(result.warnings.some((w) => w.code === 'DATA_TRUNCATED')).toBe(true);
  });

  it('scales dataset hard limit from options.maxRows, not frozen template.maxRows', () => {
    const wide = parseVisualizationDataset({
      columns: rankingDataset.columns,
      rows: Array.from({ length: 101 }, (_, i) => ({
        orders_region: `R${i}`,
        orders_total_revenue: 100 - i,
        orders_revenue_yoy: 0.01,
      })),
    });
    // Default template.maxRows=20 → hard limit 100 would reject 101 rows.
    expect(() =>
      compileVisualization({
        spec: rankedSpec,
        dataset: wide,
        target: 'svg',
        strict: false,
      }),
    ).toThrow(/hard limit is 100/);
    expect(() =>
      compileVisualization({
        spec: {
          ...rankedSpec,
          visual: {
            type: 'template' as const,
            template: 'ranked-cards' as const,
            options: { maxRows: 50 },
          },
        },
        dataset: wide,
        target: 'svg',
        strict: false,
      }),
    ).not.toThrow();
  });

  it('aligns prep and metricQuery sorts from a single value-role query.sort', () => {
    const result = compileVisualization({
      spec: {
        ...rankedSpec,
        data: {
          ...rankedSpec.data,
          query: {
            ...rankedSpec.data.query,
            sorts: [{ fieldId: 'orders_total_revenue', descending: false }],
          },
        },
        visual: {
          type: 'template' as const,
          template: 'ranked-cards' as const,
          options: { sortDescending: true, maxRows: 10 },
        },
        emphasis: { mode: 'none' as const },
        interaction: undefined,
      },
      dataset: rankingDataset,
      target: 'lightdash-custom-chart',
      strict: false,
    });
    expect(result.customChart?.metricQuery.sorts).toEqual([
      { fieldId: 'orders_total_revenue', descending: false },
    ]);
    const encoding = (
      result.customChart?.chartConfig.config.spec as { encoding: { y: { sort: string } } }
    ).encoding;
    expect(encoding.y.sort).toBe('x');
  });

  it('rejects ranked-cards query.sorts that are not a single value-role sort', () => {
    expect(() =>
      compileVisualization({
        spec: {
          ...rankedSpec,
          data: {
            ...rankedSpec.data,
            query: {
              ...rankedSpec.data.query,
              sorts: [{ fieldId: 'orders_region', descending: true }],
            },
          },
        },
        dataset: rankingDataset,
        target: 'svg',
        strict: false,
      }),
    ).toThrow(/query\.sorts must be a single sort on value role/);
  });

  it('compiles ranked-cards to Custom Chart golden shape', () => {
    const result = compileVisualization({
      spec: rankedSpec,
      dataset: rankingDataset,
      target: 'lightdash-custom-chart',
      strict: false,
    });
    expect(result.customChart).toEqual(
      expect.objectContaining({
        chartConfig: {
          type: 'custom',
          config: {
            spec: expect.objectContaining({
              $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
              mark: expect.objectContaining({ type: 'bar' }),
              data: expect.objectContaining({ values: expect.any(Array) }),
            }),
          },
        },
        metricQuery: expect.objectContaining({
          exploreName: 'orders',
          dimensions: ['orders_region'],
          metrics: ['orders_total_revenue', 'orders_revenue_yoy'],
          tableCalculations: [],
          limit: expect.any(Number),
        }),
      }),
    );
    const values = (result.customChart?.chartConfig.config.spec as { data: { values: unknown[] } })
      .data.values;
    expect(values).toHaveLength(4);
    expect(result.warnings.some((w) => w.code === 'UNSUPPORTED_OPTION_IGNORED')).toBe(true);
  });

  it('allows field id url inside Custom Chart data.values', () => {
    const urlFieldDataset = parseVisualizationDataset({
      columns: [
        {
          fieldId: 'url',
          label: 'URL',
          semanticType: 'dimension',
          dataType: 'string',
        },
        {
          fieldId: 'orders_total_revenue',
          label: 'Revenue',
          semanticType: 'metric',
          dataType: 'number',
        },
      ],
      rows: [
        { url: 'https://example.com/a', orders_total_revenue: 10 },
        { url: 'https://example.com/b', orders_total_revenue: 5 },
      ],
    });
    const urlSpec = {
      ...rankedSpec,
      data: {
        source: { type: 'metricQuery' as const, explore: 'orders' },
        query: {
          dimensions: ['url'],
          metrics: ['orders_total_revenue'],
        },
        roles: {
          category: 'url',
          value: 'orders_total_revenue',
        },
      },
      emphasis: { mode: 'none' as const },
      interaction: undefined,
    };
    const result = compileVisualization({
      spec: urlSpec,
      dataset: urlFieldDataset,
      target: 'lightdash-custom-chart',
      strict: false,
    });
    expect(result.customChart?.chartConfig.config.spec).toBeDefined();
    const values = (
      result.customChart?.chartConfig.config.spec as {
        data: { values: Array<Record<string, unknown>> };
      }
    ).data.values;
    expect(values[0]?.url).toBe('https://example.com/a');
  });

  it('aligns Custom Chart sort and limit with SVG truncation', () => {
    const manyRows = parseVisualizationDataset({
      columns: rankingDataset.columns,
      rows: [
        { orders_region: 'low', orders_total_revenue: 1, orders_revenue_yoy: 0.01 },
        { orders_region: 'mid', orders_total_revenue: 5, orders_revenue_yoy: 0.01 },
        { orders_region: 'high', orders_total_revenue: 9, orders_revenue_yoy: 0.01 },
      ],
    });
    const ascendingSpec = {
      ...rankedSpec,
      data: {
        ...rankedSpec.data,
        query: {
          ...rankedSpec.data.query,
          limit: 500,
        },
      },
      visual: {
        type: 'template' as const,
        template: 'ranked-cards' as const,
        options: { sortDescending: false, maxRows: 2 },
      },
      emphasis: { mode: 'none' as const },
    };
    const custom = compileVisualization({
      spec: ascendingSpec,
      dataset: manyRows,
      target: 'lightdash-custom-chart',
      strict: false,
    });
    const encoding = (
      custom.customChart?.chartConfig.config.spec as {
        encoding: { y: { sort: string } };
        data: { values: Array<Record<string, unknown>> };
      }
    ).encoding;
    expect(encoding.y.sort).toBe('x');
    expect(custom.customChart?.metricQuery.limit).toBe(2);
    expect(custom.customChart?.metricQuery.sorts).toEqual([
      { fieldId: 'orders_total_revenue', descending: false },
    ]);
    expect(
      (custom.customChart?.chartConfig.config.spec as { data: { values: unknown[] } }).data.values,
    ).toHaveLength(2);
  });

  it('truncates Custom Chart rows consistently with SVG bar count', () => {
    const manyRows = parseVisualizationDataset({
      columns: rankingDataset.columns,
      rows: Array.from({ length: 25 }, (_, i) => ({
        orders_region: `R${i}`,
        orders_total_revenue: 100 - i,
        orders_revenue_yoy: 0.01,
      })),
    });
    const truncatedSpec = {
      ...rankedSpec,
      visual: {
        type: 'template' as const,
        template: 'ranked-cards' as const,
        options: { maxRows: 5 },
      },
    };
    const svg = compileVisualization({
      spec: truncatedSpec,
      dataset: manyRows,
      target: 'svg',
      strict: false,
    });
    const custom = compileVisualization({
      spec: truncatedSpec,
      dataset: manyRows,
      target: 'lightdash-custom-chart',
      strict: false,
    });
    const barCount = (svg.svg?.match(/id="bar-\d+"/g) ?? []).length;
    const values = (custom.customChart?.chartConfig.config.spec as { data: { values: unknown[] } })
      .data.values;
    expect(values).toHaveLength(5);
    expect(barCount).toBe(5);
    expect(custom.warnings.filter((w) => w.code === 'DATA_TRUNCATED')).toHaveLength(1);
  });

  it('rejects metric-hero for Custom Chart target', () => {
    expect(() =>
      compileVisualization({
        spec: kpiSpec,
        dataset: kpiDataset,
        target: 'lightdash-custom-chart',
      }),
    ).toThrow(/does not support target/);
  });

  it('rejects vegaLite visual at schema validation', () => {
    expect(() =>
      validateVisualizationSpec({
        ...rankedSpec,
        visual: { type: 'vegaLite', spec: { data: { url: 'https://evil.example/data.json' } } },
      }),
    ).toThrow(VisualizationError);
  });

  it('fails missing required roles', () => {
    expect(() =>
      compileVisualization({
        spec: {
          ...rankedSpec,
          data: {
            ...rankedSpec.data,
            roles: { value: 'orders_total_revenue' },
          },
        },
        dataset: rankingDataset,
        target: 'svg',
      }),
    ).toThrow(/requires role "category"/);
  });

  it('renders metric-hero SVG', () => {
    const result = compileVisualization({
      spec: kpiSpec,
      dataset: kpiDataset,
      target: 'svg',
    });
    expect(result.svg).toContain('Revenue');
    expect(result.templateId).toBe('metric-hero');
  });
});

describe('recommendVisualization', () => {
  it('prefers ranked-cards for categorical multi-row data', () => {
    const recs = recommendVisualization({ dataset: rankingDataset, intent: 'rank' });
    expect(recs[0]?.templateId).toBe('ranked-cards');
    expect(recs[0]?.score).toBeGreaterThan(0);
  });

  it('prefers metric-hero for single-row KPI data', () => {
    const recs = recommendVisualization({ dataset: kpiDataset, intent: 'overview' });
    expect(recs[0]?.templateId).toBe('metric-hero');
  });
});
