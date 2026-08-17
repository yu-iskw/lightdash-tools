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

  it('enables a disabled filter when override values are non-empty', () => {
    const disabledSaved = {
      dimensions: [
        {
          id: 'f1',
          target: { fieldId: 'x' },
          operator: 'equals',
          values: [],
          disabled: true,
        },
      ],
      metrics: [],
      tableCalculations: [],
    };
    const { filters } = applyFilterValueOverrides(disabledSaved, [
      { id: 'f1', values: ['organic'] },
    ]);
    expect(filters.dimensions?.[0]?.values).toEqual(['organic']);
    expect(filters.dimensions?.[0]?.disabled).toBe(false);
  });

  it('keeps disabled when override values are empty', () => {
    const disabledSaved = {
      dimensions: [
        {
          id: 'f1',
          target: { fieldId: 'x' },
          operator: 'equals',
          values: [],
          disabled: true,
        },
      ],
      metrics: [],
      tableCalculations: [],
    };
    const { filters } = applyFilterValueOverrides(disabledSaved, [{ id: 'f1', values: [] }]);
    expect(filters.dimensions?.[0]?.disabled).toBe(true);
  });

  it('enables required filters even when override values are empty', () => {
    const requiredSaved = {
      dimensions: [
        {
          id: 'f1',
          target: { fieldId: 'x' },
          operator: 'equals',
          values: [],
          disabled: true,
          required: true,
        },
      ],
      metrics: [],
      tableCalculations: [],
    };
    const { filters } = applyFilterValueOverrides(requiredSaved, [{ id: 'f1', values: [] }]);
    expect(filters.dimensions?.[0]?.disabled).toBe(false);
  });

  it('rejects unknown filter ids', () => {
    expect(() => applyFilterValueOverrides(saved, [{ id: 'nope', values: ['x'] }])).toThrow(
      FilterOverrideError,
    );
  });
});
