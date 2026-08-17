import { describe, expect, it } from 'vitest';

import { ProjectScopeError } from '../../governance/project-scope.js';
import { ResultLimitError } from '../../policy/result-limits.js';

import { FilterOverrideError } from './filter-overrides.js';
import {
  codedErrorResult,
  isCoverageComplete,
  projectScopeErrorResult,
  readerExecutionErrorResult,
} from './reader-tool-helpers.js';

describe('codedErrorResult', () => {
  it('returns isError with JSON error body', () => {
    const result = codedErrorResult('QUERY_FAILED', 'boom');
    expect(result.isError).toBe(true);
    expect('_lightdashBlocked' in result).toBe(false);
    expect(result.structuredContent).toEqual({ error: { code: 'QUERY_FAILED', message: 'boom' } });
    const first = result.content[0];
    expect(first?.type).toBe('text');
    if (first?.type === 'text') {
      expect(JSON.parse(first.text)).toEqual({
        error: { code: 'QUERY_FAILED', message: 'boom' },
      });
    }
  });

  it('marks scope / not-executable / ownership / budget denials as blocked', () => {
    for (const code of [
      'PROJECT_SCOPE_REQUIRED',
      'CONTENT_NOT_EXECUTABLE',
      'CONTENT_NOT_FOUND',
      'INVALID_FILTER_OVERRIDE',
      'INVALID_PARAMETER_OVERRIDE',
      'QUERY_NOT_FOUND',
      'QUERY_BUDGET_EXCEEDED',
      'ROW_LIMIT_EXCEEDED',
      'CHART_SLUG_EXISTS',
      'PREVIEW_STALE',
    ]) {
      const result = codedErrorResult(code, 'denied');
      expect(result.isError).toBe(true);
      expect((result as { _lightdashBlocked?: boolean })._lightdashBlocked).toBe(true);
    }
  });
});

describe('projectScopeErrorResult', () => {
  it('maps ProjectScopeError to blocked coded result', () => {
    const result = projectScopeErrorResult(
      new ProjectScopeError('PROJECT_SCOPE_MISMATCH', 'conflict'),
    );
    expect(result.isError).toBe(true);
    expect((result as { _lightdashBlocked?: boolean })._lightdashBlocked).toBe(true);
  });
});

describe('readerExecutionErrorResult', () => {
  it('maps ProjectScopeError, ResultLimitError, and FilterOverrideError', () => {
    const scope = readerExecutionErrorResult(
      new ProjectScopeError('PROJECT_SCOPE_REQUIRED', 'need project'),
    );
    expect(scope.structuredContent).toEqual({
      error: { code: 'PROJECT_SCOPE_REQUIRED', message: 'need project' },
    });

    const limit = readerExecutionErrorResult(
      new ResultLimitError('ROW_LIMIT_EXCEEDED', 'too many'),
    );
    expect(limit.structuredContent).toEqual({
      error: { code: 'ROW_LIMIT_EXCEEDED', message: 'too many' },
    });

    const filter = readerExecutionErrorResult(new FilterOverrideError('bad filter'));
    expect(filter.structuredContent).toEqual({
      error: { code: 'INVALID_FILTER_OVERRIDE', message: 'bad filter' },
    });
  });

  it('rethrows unexpected errors', () => {
    expect(() => readerExecutionErrorResult(new Error('nope'))).toThrow('nope');
  });
});

describe('isCoverageComplete', () => {
  it('returns true only for non-truncated complete results', () => {
    expect(isCoverageComplete({ status: 'complete', truncated: false })).toBe(true);
    expect(isCoverageComplete({ status: 'complete', truncated: true })).toBe(false);
    expect(isCoverageComplete({ status: 'running', truncated: false })).toBe(false);
    expect(isCoverageComplete({ status: 'failed', truncated: false })).toBe(false);
    expect(isCoverageComplete({ status: 'cancelled', truncated: false })).toBe(false);
  });
});
