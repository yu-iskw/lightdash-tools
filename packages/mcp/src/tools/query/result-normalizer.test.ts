import { describe, expect, it } from 'vitest';

import { normalizeAsyncQueryResult } from './result-normalizer.js';

describe('normalizeAsyncQueryResult', () => {
  it('maps running statuses', () => {
    const result = normalizeAsyncQueryResult({ queryUuid: 'q1', status: 'executing' });
    expect(result.status).toBe('running');
  });

  it('truncates rows and cells', () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      m: { value: { raw: i, formatted: String(i) } },
    }));
    const result = normalizeAsyncQueryResult(
      {
        queryUuid: 'q1',
        status: 'ready',
        columns: { m: { label: 'Metric', type: 'number' } },
        rows,
      },
      { maxRows: 2 },
    );
    expect(result.status).toBe('complete');
    expect(result.rows).toHaveLength(2);
    expect(result.truncated).toBe(true);
    expect(result.fields[0]?.label).toBe('Metric');
  });

  it('marks truncated when totalResults exceeds maxRows even if page is full', () => {
    const rows = Array.from({ length: 2 }, (_, i) => ({
      m: { value: { raw: i, formatted: String(i) } },
    }));
    const result = normalizeAsyncQueryResult(
      {
        queryUuid: 'q1',
        status: 'ready',
        columns: { m: { label: 'Metric', type: 'number' } },
        rows,
        totalResults: 50,
      },
      { maxRows: 2 },
    );
    expect(result.truncated).toBe(true);
    expect(result.warnings).toContain('TRUNCATED');
    expect(result.rows).toHaveLength(2);
  });
});
