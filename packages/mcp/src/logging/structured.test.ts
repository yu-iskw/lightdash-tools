import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { emitStructuredLog } from './structured.js';

describe('emitStructuredLog', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it('writes one RFC-shaped NDJSON line to stderr', () => {
    emitStructuredLog({
      level: 'info',
      component: 'mcp.http',
      event: 'server.start',
      message: 'HTTP server listening',
      port: 3100,
    });

    expect(stderrSpy).toHaveBeenCalledOnce();
    const line = String(stderrSpy.mock.calls[0]?.[0]);
    const parsed = JSON.parse(line.trim()) as Record<string, unknown>;

    expect(parsed.level).toBe('info');
    expect(parsed.component).toBe('mcp.http');
    expect(parsed.event).toBe('server.start');
    expect(parsed.message).toBe('HTTP server listening');
    expect(parsed.port).toBe(3100);
    expect(typeof parsed.timestamp).toBe('string');
    expect(typeof parsed.sessionId).toBe('string');
  });
});
