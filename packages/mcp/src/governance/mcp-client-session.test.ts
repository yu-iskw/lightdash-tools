import { describe, expect, it, vi } from 'vitest';

vi.mock('@lightdash-tools/common', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- vitest importOriginal
  const actual = await importOriginal<typeof import('@lightdash-tools/common')>();
  return {
    ...actual,
    getSessionId: () => 'process-session-uuid',
  };
});

import {
  getMcpClientSessionId,
  resolveMcpClientSessionId,
  runWithMcpClientSessionAsync,
} from './mcp-client-session.js';

describe('resolveMcpClientSessionId', () => {
  it('uses non-empty sessionId from extra', () => {
    expect(resolveMcpClientSessionId({ sessionId: 'mcp-http-session' })).toBe('mcp-http-session');
  });

  it('falls back to process-scoped id when extra lacks sessionId', () => {
    expect(resolveMcpClientSessionId(undefined)).toBe('process:process-session-uuid');
    expect(resolveMcpClientSessionId({})).toBe('process:process-session-uuid');
    expect(resolveMcpClientSessionId({ sessionId: '' })).toBe('process:process-session-uuid');
    expect(resolveMcpClientSessionId({ sessionId: '   ' })).toBe('process:process-session-uuid');
    expect(resolveMcpClientSessionId({ sessionId: 42 })).toBe('process:process-session-uuid');
  });
});

describe('getMcpClientSessionId ALS', () => {
  it('reads session from runWithMcpClientSessionAsync', async () => {
    await runWithMcpClientSessionAsync('als-session', async () => {
      expect(getMcpClientSessionId()).toBe('als-session');
    });
  });

  it('falls back outside ALS', () => {
    expect(getMcpClientSessionId()).toBe('process:process-session-uuid');
  });
});
