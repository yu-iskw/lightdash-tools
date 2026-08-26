/**
 * Query summary + data/sql artifact packaging (ADR-0032).
 */

import { describe, expect, it } from 'vitest';

import { buildQueryArtifactResult, toQuerySummaryPayload } from './query-artifact-result.js';

import type { NormalizedQueryResult } from './result-normalizer.js';

const baseNormalized = {
  queryUuid: 'q1',
  status: 'complete',
  columns: { a: { type: 'number' } },
  rows: [{ a: 1 }, { a: 2 }],
  rowCount: 2,
  truncated: false,
  warnings: [],
} as unknown as NormalizedQueryResult;

describe('toQuerySummaryPayload', () => {
  it('strips rows and preserves rowCount', () => {
    const summary = toQuerySummaryPayload(baseNormalized);
    expect(summary.rows).toBeUndefined();
    expect(summary.rowCount).toBe(2);
    expect(summary.queryUuid).toBe('q1');
  });
});

describe('buildQueryArtifactResult', () => {
  it('attaches data resource by default and omits rows from summary JSON', () => {
    const result = buildQueryArtifactResult({
      profile: 'content-reader',
      projectUuid: '550e8400-e29b-41d4-a716-446655440000',
      projectPinned: true,
      normalized: baseNormalized,
      include: new Set(['data']),
      complete: true,
      warnings: [],
    });

    const summaryText = (result.content[0] as { text: string }).text;
    expect(summaryText).not.toContain('"a":1');
    expect(JSON.parse(summaryText).data.rows).toBeUndefined();
    expect(result.structuredContent?.artifacts).toEqual([
      expect.objectContaining({ kind: 'data', included: true }),
    ]);
    expect(result.content).toHaveLength(2);
    expect(result.content[1]).toMatchObject({
      type: 'resource',
      resource: { mimeType: 'application/json', text: JSON.stringify([{ a: 1 }, { a: 2 }]) },
    });
  });

  it('marks data catalog included=false when include omits data', () => {
    const result = buildQueryArtifactResult({
      profile: 'data-analyst',
      projectUuid: '550e8400-e29b-41d4-a716-446655440000',
      projectPinned: false,
      normalized: baseNormalized,
      include: new Set(),
      complete: true,
      warnings: [],
    });
    expect(result.content).toHaveLength(1);
    expect(result.structuredContent?.artifacts).toEqual([
      expect.objectContaining({ kind: 'data', included: false }),
    ]);
  });

  it('attaches SQL only when include has sql and extras.sql provides the body', () => {
    const result = buildQueryArtifactResult({
      profile: 'content-reader',
      projectUuid: '550e8400-e29b-41d4-a716-446655440000',
      projectPinned: true,
      normalized: baseNormalized,
      include: new Set(['data', 'sql']),
      complete: true,
      warnings: [],
      extras: { sql: { savedSqlUuid: 's1', sql: 'SELECT 1' } },
    });
    const sqlPart = result.content.find(
      (c) =>
        c.type === 'resource' &&
        (c as { resource?: { mimeType?: string } }).resource?.mimeType === 'text/sql',
    );
    expect(sqlPart).toMatchObject({
      type: 'resource',
      resource: { text: 'SELECT 1' },
    });
    expect(JSON.stringify(result.structuredContent)).not.toContain('SELECT 1');
  });
});
