import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { closeAuditLog, getSessionId, initAuditLog, logAuditEntry } from './audit';

describe('audit', () => {
  const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

  afterEach(() => {
    stderrSpy.mockClear();
  });

  it('getSessionId returns a stable UUID for the process', () => {
    expect(getSessionId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(getSessionId()).toBe(getSessionId());
  });

  it('initAuditLog announces stderr destination when no file path is given', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      initAuditLog();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[audit] Writing to stderr'),
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('logAuditEntry writes NDJSON to stderr by default', () => {
    initAuditLog();

    logAuditEntry({
      timestamp: '2026-01-01T00:00:00.000Z',
      sessionId: getSessionId(),
      tool: 'test_tool',
      tokenHash: 'abc123',
      subject: 'user-uuid',
      status: 'success',
      durationMs: 12,
    });

    const auditLine = stderrSpy.mock.calls
      .map(([chunk]) => String(chunk))
      .find((line) => line.includes('"tool":"test_tool"'));
    expect(auditLine).toBeDefined();
    expect(auditLine).toContain('[audit]');
    expect(auditLine).toContain('"status":"success"');
    expect(auditLine).toContain('"tokenHash":"abc123"');
    expect(auditLine).toContain('"subject":"user-uuid"');
  });

  it('logAuditEntry appends to a file when initAuditLog receives a path', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'audit-test-'));
    const filePath = join(dir, 'audit.ndjson');

    try {
      initAuditLog(filePath);

      logAuditEntry({
        timestamp: '2026-01-01T00:00:00.000Z',
        sessionId: getSessionId(),
        tool: 'file_tool',
        projectUuids: ['uuid-a'],
        status: 'blocked',
        durationMs: 3,
      });

      await closeAuditLog();

      // filePath is a temp path from mkdtempSync in this test only
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const contents = readFileSync(filePath, 'utf8');
      expect(contents).toContain('"tool":"file_tool"');
      expect(contents).toContain('"projectUuids":["uuid-a"]');
      expect(contents).toContain('"status":"blocked"');
    } finally {
      await closeAuditLog();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
