import { describe, expect, it } from 'vitest';

import {
  TileNotFoundError,
  applyTileAdd,
  applyTileMove,
  applyTileRemove,
  applyTileResize,
  assertMoveContentLengths,
  baselineFromMoveContentManifest,
  baselineFromResource,
  buildDashboardUpdateBody,
  buildMoveContentItem,
  buildMoveContentManifest,
  buildMoveContentProposal,
  buildMoveContentResourceKey,
  fetchChartBaselineOptional,
  matchMoveContentResolved,
  moveContentItemFromSummary,
  moveContentTargetSpaceFromRecord,
  resolveChartPreviewCurrent,
  resolveCompareVersionIds,
  resolveMoveContentManifest,
  shallowDiff,
  sortByUuidStable,
  stableStringify,
} from './developer-helpers.js';

describe('stableStringify', () => {
  it('sorts object keys so structurally-equal values match', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
  });

  it('sorts nested object keys recursively', () => {
    expect(stableStringify({ outer: { b: 1, a: 2 } })).toBe(
      stableStringify({ outer: { a: 2, b: 1 } }),
    );
  });

  it('preserves array order', () => {
    expect(stableStringify([1, 2, 3])).not.toBe(stableStringify([3, 2, 1]));
  });
});

describe('shallowDiff', () => {
  it('reports added, removed, and changed top-level keys', () => {
    const before = { name: 'Foo', description: 'old', keep: 1 };
    const after = { name: 'Foo', description: 'new', added: true };
    const diff = shallowDiff(before, after);
    expect(diff.added).toEqual(['added']);
    expect(diff.removed).toEqual(['keep']);
    expect(diff.changed).toEqual(['description']);
  });

  it('treats deep-equal nested values as unchanged', () => {
    const before = { config: { a: 1, b: 2 } };
    const after = { config: { b: 2, a: 1 } };
    expect(shallowDiff(before, after).changed).toEqual([]);
  });

  it('handles null/non-object inputs as empty objects', () => {
    expect(shallowDiff(null, { name: 'New' })).toEqual({
      added: ['name'],
      removed: [],
      changed: [],
    });
    expect(shallowDiff({ name: 'Old' }, null)).toEqual({
      added: [],
      removed: ['name'],
      changed: [],
    });
  });

  it('returns no differences for identical objects', () => {
    const value = { a: 1, b: 'two' };
    expect(shallowDiff(value, value)).toEqual({ added: [], removed: [], changed: [] });
  });
});

describe('applyTileAdd', () => {
  it('appends the new tile', () => {
    const tiles = [{ uuid: 't1' }];
    const next = applyTileAdd(tiles, { uuid: 't2' });
    expect(next).toEqual([{ uuid: 't1' }, { uuid: 't2' }]);
    expect(tiles).toEqual([{ uuid: 't1' }]);
  });
});

describe('applyTileMove', () => {
  it('updates x/y on the matching tile by uuid', () => {
    const tiles = [
      { uuid: 't1', x: 0, y: 0 },
      { uuid: 't2', x: 5, y: 5 },
    ];
    const next = applyTileMove(tiles, 't1', 1, 2);
    expect(next).toEqual([
      { uuid: 't1', x: 1, y: 2 },
      { uuid: 't2', x: 5, y: 5 },
    ]);
  });

  it('matches the legacy tileUuid alias', () => {
    const tiles = [{ tileUuid: 't1', x: 0, y: 0 }];
    const next = applyTileMove(tiles, 't1', 3, 4);
    expect(next).toEqual([{ tileUuid: 't1', x: 3, y: 4 }]);
  });

  it('leaves x/y untouched when omitted', () => {
    const tiles = [{ uuid: 't1', x: 0, y: 0 }];
    const next = applyTileMove(tiles, 't1', undefined, 9);
    expect(next).toEqual([{ uuid: 't1', x: 0, y: 9 }]);
  });

  it('throws TileNotFoundError for an unknown uuid', () => {
    expect(() => applyTileMove([{ uuid: 't1' }], 'missing', 1, 1)).toThrow(TileNotFoundError);
  });
});

describe('applyTileRemove', () => {
  it('removes the matching tile', () => {
    const tiles = [{ uuid: 't1' }, { uuid: 't2' }];
    expect(applyTileRemove(tiles, 't1')).toEqual([{ uuid: 't2' }]);
  });

  it('throws TileNotFoundError for an unknown uuid', () => {
    expect(() => applyTileRemove([{ uuid: 't1' }], 'missing')).toThrow(TileNotFoundError);
  });
});

describe('applyTileResize', () => {
  it('updates w/h on the matching tile', () => {
    const tiles = [{ uuid: 't1', w: 1, h: 1 }];
    expect(applyTileResize(tiles, 't1', 4, 3)).toEqual([{ uuid: 't1', w: 4, h: 3 }]);
  });

  it('throws TileNotFoundError for an unknown uuid', () => {
    expect(() => applyTileResize([{ uuid: 't1' }], 'missing', 1, 1)).toThrow(TileNotFoundError);
  });
});

describe('buildDashboardUpdateBody', () => {
  it('preserves editable current fields and applies overrides', () => {
    const current = {
      name: 'Dash',
      description: 'desc',
      tiles: [{ uuid: 't1' }],
      filters: { dimensions: [] },
      tabs: [],
      parameters: {},
      uuid: 'ignored-readonly-field',
    };
    const body = buildDashboardUpdateBody(current, { tiles: [{ uuid: 't2' }] });
    expect(body).toEqual({
      name: 'Dash',
      description: 'desc',
      tiles: [{ uuid: 't2' }],
      filters: { dimensions: [] },
      tabs: [],
      parameters: {},
    });
  });
});

describe('resolveCompareVersionIds', () => {
  const history = [
    { versionUuid: 'v1', createdAt: '2026-01-01T00:00:00.000Z' },
    { versionUuid: 'v2', createdAt: '2026-01-03T00:00:00.000Z' },
    { versionUuid: 'v3', createdAt: '2026-01-02T00:00:00.000Z' },
  ];

  it('uses explicit version ids when both are provided', () => {
    expect(resolveCompareVersionIds(history, 'v1', 'v3')).toEqual(['v1', 'v3']);
  });

  it('falls back to the two most recent entries when ids are omitted', () => {
    expect(resolveCompareVersionIds(history)).toEqual(['v2', 'v3']);
  });

  it('rejects when only one explicit version id is provided', () => {
    expect(() => resolveCompareVersionIds(history, 'v1')).toThrow(
      /versionUuidA and versionUuidB must both be provided/,
    );
    expect(() => resolveCompareVersionIds(history, undefined, 'v3')).toThrow(
      /versionUuidA and versionUuidB must both be provided/,
    );
  });

  it('throws when fewer than two history entries exist', () => {
    expect(() => resolveCompareVersionIds([history[0]])).toThrow(
      /At least two version-history entries/,
    );
  });
});

describe('buildMoveContentItem', () => {
  it('builds a chart item with the given source', () => {
    expect(buildMoveContentItem('c1', 'chart', 'sql')).toEqual({
      contentType: 'chart',
      uuid: 'c1',
      source: 'sql',
    });
  });

  it('defaults chart source to dbt_explore', () => {
    expect(buildMoveContentItem('c1', 'chart')).toEqual({
      contentType: 'chart',
      uuid: 'c1',
      source: 'dbt_explore',
    });
  });

  it('builds dashboard/data_app items without a source field', () => {
    expect(buildMoveContentItem('d1', 'dashboard')).toEqual({
      contentType: 'dashboard',
      uuid: 'd1',
    });
    expect(buildMoveContentItem('a1', 'data_app')).toEqual({ contentType: 'data_app', uuid: 'a1' });
  });
});

describe('assertMoveContentLengths', () => {
  it('accepts matching lengths', () => {
    expect(() =>
      assertMoveContentLengths(['a', 'b'], ['chart', 'dashboard'], ['dbt_explore', 'sql']),
    ).not.toThrow();
  });

  it('accepts omitted chartSources', () => {
    expect(() => assertMoveContentLengths(['a', 'b'], ['chart', 'dashboard'])).not.toThrow();
  });

  it('throws when contentTypes length mismatches itemUuids', () => {
    expect(() => assertMoveContentLengths(['a', 'b'], ['chart'])).toThrow(
      /contentTypes must have the same length/,
    );
  });

  it('throws when chartSources length mismatches itemUuids', () => {
    expect(() => assertMoveContentLengths(['a', 'b'], ['chart', 'chart'], ['dbt_explore'])).toThrow(
      /chartSources must have the same length/,
    );
  });
});

describe('buildMoveContentResourceKey', () => {
  it('sorts UUIDs so preview and apply share one key', () => {
    expect(buildMoveContentResourceKey(['b', 'a', 'c'])).toBe('a,b,c');
  });
});

describe('buildMoveContentProposal', () => {
  it('requires contentTypes and normalizes omitted chartSources to null', () => {
    expect(
      buildMoveContentProposal({
        itemUuids: ['a'],
        targetSpaceUuid: 's1',
        contentTypes: ['chart'],
      }),
    ).toEqual({
      itemUuids: ['a'],
      targetSpaceUuid: 's1',
      contentTypes: ['chart'],
      chartSources: null,
    });
  });

  it('includes chartSources so drift changes the hash', () => {
    const withSources = buildMoveContentProposal({
      itemUuids: ['a'],
      targetSpaceUuid: 's1',
      contentTypes: ['chart'],
      chartSources: ['sql'],
    });
    expect(withSources).toEqual({
      itemUuids: ['a'],
      targetSpaceUuid: 's1',
      contentTypes: ['chart'],
      chartSources: ['sql'],
    });
    expect(stableStringify(withSources)).not.toBe(
      stableStringify(
        buildMoveContentProposal({
          itemUuids: ['a'],
          targetSpaceUuid: 's1',
          contentTypes: ['chart'],
        }),
      ),
    );
  });
});

describe('resolveChartPreviewCurrent', () => {
  const notFound = Object.assign(new Error('missing'), { statusCode: 404 });

  it('loads the chart when chartUuidOrSlug is set', async () => {
    const current = { uuid: 'c1', slug: 'revenue' };
    const result = await resolveChartPreviewCurrent({
      chartUuidOrSlug: 'c1',
      slug: 'ignored',
      getSavedChart: async (id) => {
        expect(id).toBe('c1');
        return current;
      },
      isNotFound: () => false,
    });
    expect(result).toEqual({ kind: 'ok', current });
  });

  it('allows create when slug lookup is not found', async () => {
    const result = await resolveChartPreviewCurrent({
      slug: 'new-chart',
      getSavedChart: async () => {
        throw notFound;
      },
      isNotFound: (err) => err === notFound,
    });
    expect(result).toEqual({ kind: 'ok', current: null });
  });

  it('rejects create when slug already exists', async () => {
    const result = await resolveChartPreviewCurrent({
      slug: 'taken',
      getSavedChart: async () => ({ uuid: 'existing', slug: 'taken' }),
      isNotFound: () => false,
    });
    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.code).toBe('CHART_SLUG_EXISTS');
      expect(result.message).toContain('taken');
    }
  });
});

describe('baselineFromResource', () => {
  it('returns undefined for null or empty identity fields', () => {
    expect(baselineFromResource(null)).toBeUndefined();
    expect(baselineFromResource({ name: 'x' })).toBeUndefined();
  });

  it('extracts string uuid/slug/updatedAt', () => {
    expect(
      baselineFromResource({
        uuid: 'u1',
        slug: 's1',
        updatedAt: '2026-08-01T00:00:00.000Z',
      }),
    ).toEqual({ uuid: 'u1', slug: 's1', updatedAt: '2026-08-01T00:00:00.000Z' });
  });
});

describe('fetchChartBaselineOptional', () => {
  const notFound = Object.assign(new Error('missing'), { statusCode: 404 });

  it('returns baseline when the chart exists', async () => {
    const baseline = await fetchChartBaselineOptional({
      chartUuidOrSlug: 'c1',
      getSavedChart: async () => ({ uuid: 'c1', slug: 'rev', updatedAt: 't1' }),
      isNotFound: () => false,
    });
    expect(baseline).toEqual({ uuid: 'c1', slug: 'rev', updatedAt: 't1' });
  });

  it('returns undefined on not-found', async () => {
    const baseline = await fetchChartBaselineOptional({
      chartUuidOrSlug: 'missing',
      getSavedChart: async () => {
        throw notFound;
      },
      isNotFound: (err) => err === notFound,
    });
    expect(baseline).toBeUndefined();
  });
});

describe('sortByUuidStable / buildMoveContentManifest', () => {
  it('sorts items by uuid for a hash-stable manifest', () => {
    const manifest = buildMoveContentManifest({
      items: [
        {
          uuid: 'b',
          contentType: 'dashboard',
          spaceUuid: 's1',
          updatedAt: 't2',
          source: null,
        },
        {
          uuid: 'a',
          contentType: 'chart',
          spaceUuid: 's0',
          updatedAt: 't1',
          source: 'sql',
        },
      ],
      targetSpace: { uuid: 's9', name: 'Dest' },
    });
    expect(manifest.items.map((item) => item.uuid)).toEqual(['a', 'b']);
    expect(sortByUuidStable([{ uuid: 'z' }, { uuid: 'm' }]).map((i) => i.uuid)).toEqual(['m', 'z']);
    expect(manifest.targetSpace).toEqual({ uuid: 's9', name: 'Dest' });
  });

  it('changes fingerprint when space or updatedAt drifts', () => {
    const base = buildMoveContentManifest({
      items: [
        {
          uuid: 'a',
          contentType: 'chart',
          spaceUuid: 's0',
          updatedAt: 't1',
          source: 'dbt_explore',
        },
      ],
      targetSpace: { uuid: 's9', name: 'Dest' },
    });
    const drifted = buildMoveContentManifest({
      items: [
        {
          uuid: 'a',
          contentType: 'chart',
          spaceUuid: 's1',
          updatedAt: 't1',
          source: 'dbt_explore',
        },
      ],
      targetSpace: { uuid: 's9', name: 'Dest' },
    });
    const baseBaseline = baselineFromMoveContentManifest(base);
    const driftedBaseline = baselineFromMoveContentManifest(drifted);
    expect(baseBaseline.updatedAt).not.toBe(driftedBaseline.updatedAt);
    expect(baseBaseline).toEqual({
      updatedAt: expect.any(String),
      uuid: 'a',
    });
    expect(baseBaseline).not.toHaveProperty('items');
    expect(baseBaseline).not.toHaveProperty('targetSpace');
  });
});

describe('moveContentItemFromSummary / moveContentTargetSpaceFromRecord', () => {
  it('extracts chart identity, space, source, and lastUpdatedAt', () => {
    expect(
      moveContentItemFromSummary({
        uuid: 'c1',
        contentType: 'chart',
        source: 'sql',
        lastUpdatedAt: '2026-08-01T00:00:00.000Z',
        space: { uuid: 's1', name: 'Analytics' },
      }),
    ).toEqual({
      uuid: 'c1',
      contentType: 'chart',
      spaceUuid: 's1',
      updatedAt: '2026-08-01T00:00:00.000Z',
      source: 'sql',
    });
  });

  it('rejects unsupported content types', () => {
    expect(moveContentItemFromSummary({ uuid: 's1', contentType: 'space' })).toBeNull();
  });

  it('normalizes null target space and named spaces', () => {
    expect(moveContentTargetSpaceFromRecord(null, null)).toEqual({ uuid: null, name: null });
    expect(moveContentTargetSpaceFromRecord('s9', { uuid: 's9', name: 'Dest' })).toEqual({
      uuid: 's9',
      name: 'Dest',
    });
  });
});

describe('matchMoveContentResolved', () => {
  const resolved = [
    {
      uuid: 'a',
      contentType: 'chart' as const,
      spaceUuid: 's0',
      updatedAt: 't1',
      source: 'sql' as const,
    },
    {
      uuid: 'b',
      contentType: 'dashboard' as const,
      spaceUuid: 's0',
      updatedAt: 't2',
      source: null,
    },
  ];

  it('accepts matching types and chart sources', () => {
    expect(
      matchMoveContentResolved({
        itemUuids: ['a', 'b'],
        contentTypes: ['chart', 'dashboard'],
        chartSources: ['sql', 'dbt_explore'],
        resolvedItems: resolved,
      }),
    ).toBeNull();
  });

  it('rejects type mismatches', () => {
    const err = matchMoveContentResolved({
      itemUuids: ['a'],
      contentTypes: ['dashboard'],
      resolvedItems: resolved,
    });
    expect(err?.code).toBe('INVALID_ARGUMENT');
    expect(err?.message).toContain('chart');
  });

  it('rejects chart source mismatches', () => {
    const err = matchMoveContentResolved({
      itemUuids: ['a'],
      contentTypes: ['chart'],
      chartSources: ['dbt_explore'],
      resolvedItems: resolved,
    });
    expect(err?.code).toBe('INVALID_ARGUMENT');
    expect(err?.message).toContain('sql');
  });
});

describe('resolveMoveContentManifest', () => {
  const notFound = Object.assign(new Error('missing'), { statusCode: 404 });

  it('builds a sorted manifest from injected lookups', async () => {
    const result = await resolveMoveContentManifest({
      itemUuids: ['b', 'a'],
      contentTypes: ['dashboard', 'chart'],
      chartSources: ['dbt_explore', 'sql'],
      targetSpaceUuid: 's9',
      findContentByUuid: async (uuid) => {
        if (uuid === 'a') {
          return {
            uuid: 'a',
            contentType: 'chart',
            source: 'sql',
            lastUpdatedAt: 't1',
            space: { uuid: 's0' },
          };
        }
        if (uuid === 'b') {
          return {
            uuid: 'b',
            contentType: 'dashboard',
            lastUpdatedAt: 't2',
            space: { uuid: 's0' },
          };
        }
        return null;
      },
      getSpace: async (spaceUuid) => ({ uuid: spaceUuid, name: 'Dest' }),
      isNotFound: () => false,
    });
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.manifest.items.map((item) => item.uuid)).toEqual(['a', 'b']);
      expect(result.manifest.targetSpace).toEqual({ uuid: 's9', name: 'Dest' });
    }
  });

  it('returns CONTENT_NOT_FOUND for missing items or target space', async () => {
    const missingItem = await resolveMoveContentManifest({
      itemUuids: ['missing'],
      contentTypes: ['chart'],
      targetSpaceUuid: null,
      findContentByUuid: async () => null,
      getSpace: async () => ({ uuid: 's9' }),
      isNotFound: () => false,
    });
    expect(missingItem).toEqual({
      kind: 'error',
      error: { code: 'CONTENT_NOT_FOUND', message: "Content 'missing' was not found" },
    });

    const missingSpace = await resolveMoveContentManifest({
      itemUuids: ['a'],
      contentTypes: ['chart'],
      targetSpaceUuid: 'gone',
      findContentByUuid: async () => ({
        uuid: 'a',
        contentType: 'chart',
        source: 'dbt_explore',
        space: { uuid: 's0' },
      }),
      getSpace: async () => {
        throw notFound;
      },
      isNotFound: (err) => err === notFound,
    });
    expect(missingSpace.kind).toBe('error');
    if (missingSpace.kind === 'error') {
      expect(missingSpace.error.code).toBe('CONTENT_NOT_FOUND');
    }
  });
});
