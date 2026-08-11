/**
 * Prompt-context policy unit tests.
 */

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PROMPT_CONTEXT_POLICY,
  parsePromptContextPolicy,
  resolvePromptContextPolicy,
} from './prompt-context-policy.js';

describe('parsePromptContextPolicy', () => {
  it('defaults to compact when unset or empty', () => {
    expect(parsePromptContextPolicy(undefined)).toBe(DEFAULT_PROMPT_CONTEXT_POLICY);
    expect(parsePromptContextPolicy('')).toBe('compact');
    expect(parsePromptContextPolicy('   ')).toBe('compact');
  });

  it('accepts allowed values', () => {
    expect(parsePromptContextPolicy('compact')).toBe('compact');
    expect(parsePromptContextPolicy('compatible')).toBe('compatible');
    expect(parsePromptContextPolicy('embedded')).toBe('embedded');
  });

  it('fails closed on unknown values', () => {
    expect(() => parsePromptContextPolicy('uri-only')).toThrow(
      /LIGHTDASH_TOOLS_MCP_PROMPT_CONTEXT/,
    );
  });
});

describe('resolvePromptContextPolicy', () => {
  it('prefers CLI over env', () => {
    expect(
      resolvePromptContextPolicy({
        cli: 'embedded',
        env: { LIGHTDASH_TOOLS_MCP_PROMPT_CONTEXT: 'compatible' },
      }),
    ).toBe('embedded');
  });

  it('uses env when CLI omitted', () => {
    expect(
      resolvePromptContextPolicy({
        env: { LIGHTDASH_TOOLS_MCP_PROMPT_CONTEXT: 'compatible' },
      }),
    ).toBe('compatible');
  });
});
