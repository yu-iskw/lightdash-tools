/**
 * Content-reader safety assert unit tests.
 */

import { describe, expect, it } from 'vitest';

import {
  METADATA_SAFETY,
  METRIC_QUERY_SAFETY,
  SAVED_EXECUTION_SAFETY,
  IMAGE_SNAPSHOT_SAFETY,
  assertContentReaderSafe,
} from './content-reader.js';

describe('assertContentReaderSafe', () => {
  it('accepts metadata, saved-execution, metric-query, and image-snapshot presets', () => {
    expect(() => assertContentReaderSafe(METADATA_SAFETY)).not.toThrow();
    expect(() => assertContentReaderSafe(SAVED_EXECUTION_SAFETY)).not.toThrow();
    expect(() => assertContentReaderSafe(METRIC_QUERY_SAFETY)).not.toThrow();
    expect(() => assertContentReaderSafe(IMAGE_SNAPSHOT_SAFETY)).not.toThrow();
  });

  it('rejects raw SQL query capability', () => {
    expect(() =>
      assertContentReaderSafe({
        ...METADATA_SAFETY,
        queryCapability: 'raw_sql',
      }),
    ).toThrow(/saved-content or arbitrary-semantic/);
  });

  it('rejects row-level results', () => {
    expect(() =>
      assertContentReaderSafe({
        ...SAVED_EXECUTION_SAFETY,
        resultCapability: 'row_level',
      }),
    ).toThrow(/Row-level/);
  });

  it('rejects client-only exposure', () => {
    expect(() =>
      assertContentReaderSafe({
        ...METADATA_SAFETY,
        agentExposure: 'client-only',
      }),
    ).toThrow(/client-only/);
  });
});
