import { describe, expect, it } from 'vitest';

import { parseChartUpsertBody } from './chart-upsert.js';
import { parseDashboardTile } from './dashboard-tile.js';
import {
  parseDashboardChangesBody,
  parseDashboardCreateBody,
  parseDashboardUpdateBody,
} from './dashboard.js';

const validChart = {
  name: 'Revenue',
  tableName: 'orders',
  slug: 'revenue',
  spaceSlug: 'analytics',
  version: 1,
  chartConfig: { type: 'cartesian', config: {} },
  metricQuery: {
    exploreName: 'orders',
    dimensions: [],
    metrics: [],
    filters: {},
    sorts: [],
    limit: 500,
  },
};

describe('parseChartUpsertBody', () => {
  it('accepts a minimal valid upsert body', () => {
    const parsed = parseChartUpsertBody(validChart);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.name).toBe('Revenue');
      expect(parsed.data.slug).toBe('revenue');
    }
  });

  it('rejects missing required fields', () => {
    const parsed = parseChartUpsertBody({ name: 'Revenue' });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.code).toBe('INVALID_ARGUMENT');
      expect(parsed.message).toContain('tableName');
    }
  });

  it('rejects server-managed keys', () => {
    const parsed = parseChartUpsertBody({ ...validChart, uuid: 'c1', updatedAt: 't1' });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.message).toMatch(/uuid|updatedAt/);
    }
  });

  it('rejects unknown keys via strict()', () => {
    const parsed = parseChartUpsertBody({ ...validChart, unexpected: true });
    expect(parsed.ok).toBe(false);
  });
});

describe('parseDashboardCreateBody / parseDashboardUpdateBody', () => {
  const validCreate = {
    name: 'Ops',
    tiles: [],
    tabs: [],
  };

  it('accepts a minimal create body', () => {
    const parsed = parseDashboardCreateBody(validCreate);
    expect(parsed.ok).toBe(true);
  });

  it('rejects create without name', () => {
    const parsed = parseDashboardCreateBody({ tiles: [], tabs: [] });
    expect(parsed.ok).toBe(false);
  });

  it('accepts partial update bodies', () => {
    const parsed = parseDashboardUpdateBody({ name: 'Renamed', tiles: [{ type: 'markdown' }] });
    expect(parsed.ok).toBe(true);
  });

  it('rejects empty update bodies', () => {
    const parsed = parseDashboardUpdateBody({});
    expect(parsed.ok).toBe(false);
  });

  it('rejects server-managed keys on create', () => {
    const parsed = parseDashboardCreateBody({ ...validCreate, uuid: 'd1' });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.message).toContain('uuid');
    }
  });

  it('parseDashboardChangesBody accepts create or update shapes', () => {
    expect(parseDashboardChangesBody(validCreate).ok).toBe(true);
    expect(parseDashboardChangesBody({ description: 'only desc' }).ok).toBe(true);
  });
});

describe('parseDashboardTile', () => {
  it('accepts a saved_chart tile with layout fields', () => {
    const parsed = parseDashboardTile({
      type: 'saved_chart',
      x: 0,
      y: 0,
      w: 6,
      h: 4,
      properties: { savedChartUuid: 'c1' },
    });
    expect(parsed.ok).toBe(true);
  });

  it('rejects missing layout fields', () => {
    const parsed = parseDashboardTile({ type: 'markdown' });
    expect(parsed.ok).toBe(false);
  });

  it('rejects unknown tile types and forbidden keys', () => {
    expect(parseDashboardTile({ type: 'unknown', x: 0, y: 0, w: 1, h: 1 }).ok).toBe(false);
    expect(
      parseDashboardTile({
        type: 'markdown',
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        dashboardUuid: 'd1',
      }).ok,
    ).toBe(false);
  });
});
