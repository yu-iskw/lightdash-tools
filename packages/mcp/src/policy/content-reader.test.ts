/**
 * Content-reader safety assert unit tests.
 */

import { describe, expect, it } from 'vitest';

import {
  METADATA_SAFETY,
  SAVED_EXECUTION_SAFETY,
  assertContentReaderSafe,
} from './content-reader.js';

describe('assertContentReaderSafe', () => {
  it('accepts metadata and saved-execution presets', () => {
    expect(() => assertContentReaderSafe(METADATA_SAFETY)).not.toThrow();
    expect(() => assertContentReaderSafe(SAVED_EXECUTION_SAFETY)).not.toThrow();
  });

  it('rejects arbitrary query capability', () => {
    expect(() =>
      assertContentReaderSafe({
        ...METADATA_SAFETY,
        queryCapability: 'raw_sql',
      }),
    ).toThrow(/saved-content/);
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
