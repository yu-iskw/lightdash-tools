import { describe, expect, it } from 'vitest';

import { ProjectScopeError } from '../../governance/project-scope.js';

import { codedErrorResult, projectScopeErrorResult } from './reader-tool-helpers.js';

describe('codedErrorResult', () => {
  it('returns isError with JSON error body', () => {
    const result = codedErrorResult('QUERY_FAILED', 'boom');
    expect(result.isError).toBe(true);
    expect('_lightdashBlocked' in result).toBe(false);
    expect(result.structuredContent).toEqual({ error: { code: 'QUERY_FAILED', message: 'boom' } });
    expect(JSON.parse(result.content[0].text)).toEqual({
      error: { code: 'QUERY_FAILED', message: 'boom' },
    });
  });

  it('marks scope / not-executable / ownership / budget denials as blocked', () => {
    for (const code of [
      'PROJECT_SCOPE_REQUIRED',
      'CONTENT_NOT_EXECUTABLE',
      'CONTENT_NOT_FOUND',
      'INVALID_FILTER_OVERRIDE',
      'INVALID_PARAMETER_OVERRIDE',
      'QUERY_NOT_OWNED',
      'QUERY_BUDGET_EXCEEDED',
      'ROW_LIMIT_EXCEEDED',
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
