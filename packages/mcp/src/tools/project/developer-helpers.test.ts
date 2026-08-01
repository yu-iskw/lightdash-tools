import { describe, expect, it } from 'vitest';

import {
  TileNotFoundError,
  applyTileAdd,
  applyTileMove,
  applyTileRemove,
  applyTileResize,
  assertMoveContentLengths,
  buildDashboardUpdateBody,
  buildMoveContentItem,
  buildMoveContentProposal,
  buildMoveContentResourceKey,
  resolveCompareVersionIds,
  shallowDiff,
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

  it('falls back to the two most recent entries when only one id is provided', () => {
    expect(resolveCompareVersionIds(history, 'v1')).toEqual(['v2', 'v3']);
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
