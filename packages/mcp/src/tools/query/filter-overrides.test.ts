import { describe, expect, it } from 'vitest';

import { FilterOverrideError, applyFilterValueOverrides } from './filter-overrides.js';

describe('applyFilterValueOverrides', () => {
  const saved = {
    dimensions: [{ id: 'f1', target: { fieldId: 'x' }, operator: 'equals', values: ['a'] }],
    metrics: [],
    tableCalculations: [],
  };

  it('patches values only', () => {
    const { filters } = applyFilterValueOverrides(saved, [{ id: 'f1', values: ['b'] }]);
    expect(filters.dimensions?.[0]?.values).toEqual(['b']);
    expect(filters.dimensions?.[0]?.operator).toBe('equals');
    expect(filters.dimensions?.[0]?.target).toEqual({ fieldId: 'x' });
  });

  it('rejects unknown filter ids', () => {
    expect(() => applyFilterValueOverrides(saved, [{ id: 'nope', values: ['x'] }])).toThrow(
      FilterOverrideError,
    );
  });
});
