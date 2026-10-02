/**
 * ensureFilterIds / ensureFilterNode unit tests.
 */

import { describe, expect, it } from 'vitest';

import { ensureFilterIds, ensureFilterNode } from './ensure-filter-ids.js';

describe('ensureFilterNode', () => {
  it('fills missing group id on and-group and rule ids', () => {
    const result = ensureFilterNode({
      and: [
        {
          target: { fieldId: 'orders_status' },
          operator: 'equals',
          values: ['completed'],
        },
      ],
    }) as {
      id: string;
      and: Array<{ id: string; target: { fieldId: string }; operator: string }>;
    };

    expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(result.and).toHaveLength(1);
    expect(result.and[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(result.and[0].target.fieldId).toBe('orders_status');
    expect(result.and[0].operator).toBe('equals');
  });

  it('fills missing group id on or-group', () => {
    const result = ensureFilterNode({
      or: [{ target: { fieldId: 'orders_status' }, operator: 'isNull' }],
    }) as { id: string; or: unknown[] };

    expect(result.id).toBeTruthy();
    expect(result.or).toHaveLength(1);
  });

  it('preserves existing non-empty ids', () => {
    const input = {
      id: 'group-1',
      and: [
        {
          id: 'rule-1',
          target: { fieldId: 'orders_status' },
          operator: 'equals',
          values: ['shipped'],
        },
      ],
    };
    const result = ensureFilterNode(input) as typeof input;

    expect(result.id).toBe('group-1');
    expect(result.and[0].id).toBe('rule-1');
  });

  it('fills nested group ids', () => {
    const result = ensureFilterNode({
      id: 'root',
      and: [
        {
          or: [{ target: { fieldId: 'orders_status' }, operator: 'equals', values: ['a'] }],
        },
      ],
    }) as {
      id: string;
      and: Array<{ id: string; or: Array<{ id: string }> }>;
    };

    expect(result.id).toBe('root');
    expect(result.and[0].id).toBeTruthy();
    expect(result.and[0].or[0].id).toBeTruthy();
  });

  it('leaves both and and or untouched', () => {
    const input = {
      and: [],
      or: [],
    };
    expect(ensureFilterNode(input)).toBe(input);
  });

  it('passes through unrecognized shapes', () => {
    const input = { foo: 1 };
    expect(ensureFilterNode(input)).toBe(input);
  });

  it('passes through non-objects', () => {
    expect(ensureFilterNode(null)).toBe(null);
    expect(ensureFilterNode('x')).toBe('x');
    expect(ensureFilterNode(1)).toBe(1);
  });

  it('treats empty string id as missing', () => {
    const result = ensureFilterNode({
      id: '',
      and: [{ id: '', target: { fieldId: 'a' }, operator: 'equals' }],
    }) as { id: string; and: Array<{ id: string }> };

    expect(result.id.length).toBeGreaterThan(0);
    expect(result.and[0].id.length).toBeGreaterThan(0);
  });
});

describe('ensureFilterIds', () => {
  it('returns empty filters unchanged', () => {
    const empty = {};
    expect(ensureFilterIds(empty)).toBe(empty);
  });

  it('returns non-objects unchanged', () => {
    expect(ensureFilterIds(undefined)).toBeUndefined();
    expect(ensureFilterIds(null)).toBe(null);
    expect(ensureFilterIds('x')).toBe('x');
  });

  it('fills ids under dimensions and metrics', () => {
    const result = ensureFilterIds({
      dimensions: {
        and: [{ target: { fieldId: 'orders_status' }, operator: 'equals', values: ['a'] }],
      },
      metrics: {
        or: [{ target: { fieldId: 'orders_count' }, operator: 'greaterThan', values: [0] }],
      },
    }) as {
      dimensions: { id: string; and: Array<{ id: string }> };
      metrics: { id: string; or: Array<{ id: string }> };
    };

    expect(result.dimensions.id).toBeTruthy();
    expect(result.dimensions.and[0].id).toBeTruthy();
    expect(result.metrics.id).toBeTruthy();
    expect(result.metrics.or[0].id).toBeTruthy();
  });

  it('fills tableCalculations group when present', () => {
    const result = ensureFilterIds({
      tableCalculations: {
        and: [{ target: { fieldId: 'calc_1' }, operator: 'equals', values: [1] }],
      },
    }) as { tableCalculations: { id: string; and: Array<{ id: string }> } };

    expect(result.tableCalculations.id).toBeTruthy();
    expect(result.tableCalculations.and[0].id).toBeTruthy();
  });

  it('leaves array-valued keys unchanged', () => {
    const filters = {
      dimensions: [{ target: { fieldId: 'orders_status' }, operator: 'equals' }],
    };
    expect(ensureFilterIds(filters)).toBe(filters);
  });

  it('preserves unrelated keys', () => {
    const result = ensureFilterIds({
      dimensions: {
        id: 'd1',
        and: [{ id: 'r1', target: { fieldId: 'a' }, operator: 'equals' }],
      },
      custom: true,
    }) as { custom: boolean; dimensions: { id: string } };

    expect(result.custom).toBe(true);
    expect(result.dimensions.id).toBe('d1');
  });
});
