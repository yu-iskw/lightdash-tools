/**
 * Content-developer safety assert + error-mapping unit tests.
 */

import { describe, expect, it } from 'vitest';

import { ProjectScopeError } from '../governance/project-scope.js';

import {
  COMPARE_SAFETY,
  DISCOVERY_SAFETY,
  PREVIEW_SAFETY,
  VALIDATE_SAFETY,
  WRITE_SAFETY,
  assertContentDeveloperSafe,
  developerErrorResult,
} from './content-developer.js';
import { PreviewLedgerError } from './preview-ledger.js';

describe('assertContentDeveloperSafe', () => {
  it('accepts all built-in safety presets', () => {
    for (const safety of [
      DISCOVERY_SAFETY,
      PREVIEW_SAFETY,
      VALIDATE_SAFETY,
      COMPARE_SAFETY,
      WRITE_SAFETY,
    ]) {
      expect(() => assertContentDeveloperSafe(safety)).not.toThrow();
    }
  });

  it('rejects a non-none query capability', () => {
    expect(() =>
      assertContentDeveloperSafe({ ...DISCOVERY_SAFETY, queryCapability: 'sql' as 'none' }),
    ).toThrow(/warehouse query/);
  });

  it('rejects row-level/bulk result capability', () => {
    expect(() =>
      assertContentDeveloperSafe({
        ...DISCOVERY_SAFETY,
        resultCapability: 'row_level' as 'metadata',
      }),
    ).toThrow(/row-level/i);
  });

  it('rejects client-only exposure', () => {
    expect(() =>
      assertContentDeveloperSafe({ ...DISCOVERY_SAFETY, agentExposure: 'client-only' as 'agent' }),
    ).toThrow(/client-only/);
  });
});

describe('developerErrorResult', () => {
  it('maps ProjectScopeError to a coded blocked result', () => {
    const result = developerErrorResult(
      new ProjectScopeError('PROJECT_SCOPE_REQUIRED', 'no project'),
    );
    expect(result.isError).toBe(true);
    const first = result.content[0];
    expect(first?.type).toBe('text');
    if (first?.type === 'text') {
      expect(first.text).toContain('PROJECT_SCOPE_REQUIRED');
    }
  });

  it('maps PreviewLedgerError to a coded blocked result', () => {
    const result = developerErrorResult(new PreviewLedgerError('PREVIEW_STALE', 'stale preview'));
    expect(result.isError).toBe(true);
    const first = result.content[0];
    expect(first?.type).toBe('text');
    if (first?.type === 'text') {
      expect(first.text).toContain('PREVIEW_STALE');
      const parsed = JSON.parse(first.text) as {
        error: { code: string; message: string; recovery?: string; playbookUri?: string };
      };
      expect(parsed.error.recovery).toMatch(/preview_\*/);
      expect(parsed.error.playbookUri).toBe(
        'lightdash://playbooks/content-developer/recovery/preview-stale',
      );
    }
  });

  it('rethrows unrelated errors', () => {
    expect(() => developerErrorResult(new Error('boom'))).toThrow('boom');
  });
});
